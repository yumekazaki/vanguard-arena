"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog(), cards = new Map(catalog.map(card => [String(card.id), card]));
const entries = [["cfa-128", "AUTO [RC]: When your vanguard drive check reveals a grade 3 «Nova Grappler», stand this unit."], ["cfa-143", "AUTO [RC]: When your vanguard drive check reveals a grade 3 «Nova Grappler», stand this unit."], ["cfa-1602", "AUTO [RC]: When your vanguards drive check reveals a grade 3 «Nova Grappler», stand this unit."]];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function instance(cardId, uid, playerId, extra = {}) { const def = cards.get(cardId); return { uid, cardId, cardName: def?.name || cardId, type: def?.type || "Unit", grade: Number(def?.grade ?? 0), clan: def?.clan, clans: def?.clans || (def?.clan ? [def.clan] : []), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra }; }
function fixture(cardId, side = "human", checkedId = "cfa-154") {
  const playerId = side === "human" ? "host-player" : "guest-player", opponentSide = side === "human" ? "bot" : "human", opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const source = instance(cardId, `stand-source-${cardId}-${side}`, playerId, { zone: "rear-guard", circle: "rear-left", rested: true });
  const vanguard = instance("cfa-154", `stand-vanguard-${cardId}-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
  const defender = instance("cfa-154", `stand-defender-${cardId}-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const checked = instance(checkedId, `stand-checked-${cardId}-${side}`, playerId, { zone: "deck" });
  const own = { playerId, vanguard, rear: [source, null, null, null, null], deck: [checked], triggerZone: [], hand: [], soul: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: defender, rear: Array(5).fill(null), deck: [], triggerZone: [], hand: [], soul: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const battleId = `stand-battle-${cardId}-${side}`;
  const state = { matchId: `drive-stand-${cardId}-${side}`, stateVersion: 1, turn: 2, phase: 5, side, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingCheckCard: null, players: { [side]: own, [opponentSide]: opponent }, pendingAttack: { battleId, attackerSide: side, attackerUid: vanguard.uid, attackerZone: "vanguard", attackerPlayerId: playerId, defenderSide: opponentSide, targetUid: defender.uid, targetZone: "vanguard", awaitingDrive: true, driveChecksRemaining: 1, driveChecksPerformed: 0, driveChecksComplete: false, driveCountChosen: true } };
  return { state, own, opponent, source, vanguard, checked, side, playerId, battleId };
}
function checkDrive(f) { return Reducer.applyGameAction(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `real-drive-${f.side}-${f.source.cardId}`, expectedStateVersion: f.state.stateVersion, payload: { type: "game-action", action: "driveCheck" } }, seats, Engine); }
function resolve(f, abilityId, actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) { return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-drive-stand-${f.side}-${f.source.cardId}`, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId } } }, seats, Engine); }

test("the three real Rear-Guard grade-three Nova Grappler drive-check abilities are production trusted", () => {
  for (const [cardId, printedText] of entries) {
    const ability = Engine.parseCardAbilities(cards.get(cardId))[0];
    assert.equal(ability.printedText, printedText);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(definition => definition.id === ability.id), cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "drive.checked", subject: "controller", circles: [], checkKind: "drive", checkSourceLocation: "vanguard", revealedGrade: 3, revealedClan: "Nova Grappler" });
    assert.equal(ability.canDecline, false);
  }
});

test("the actual Vanguard drive check privately queues and resolves each source for either player", () => {
  for (const [cardId] of entries) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side), ability = Engine.parseCardAbilities(cards.get(cardId))[0];
    const action = checkDrive(f); assert.equal(action.ok, true, `${cardId}/${side}: ${action.reason}`);
    const event = action.events.find(item => item.type === "drive.checked");
    assert.ok(event); assert.equal(event.checkedCardInstanceId, f.checked.uid); assert.equal(event.checkedCardGrade, 3); assert.equal(event.checkedCardClan, "Nova Grappler");
    assert.equal(f.state.pendingAbility?.side, side); assert.equal(f.state.pendingAbility?.instance?.uid, f.source.uid);
    assert.equal(resolve(f, ability.id).ok, true);
    assert.equal(f.source.rested, false);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0);
  }
});

test("wrong reveal metadata, opponent checks, non-Vanguard checks, stale sources, and host proxying are rejected", () => {
  const ability = Engine.parseCardAbilities(cards.get("cfa-128"))[0];
  for (const checkedId of ["cfa-31", "cfa-105"]) {
    const f = fixture("cfa-128", "human", checkedId), result = checkDrive(f); assert.equal(result.ok, true);
    assert.equal(f.state.pendingAbility, null);
  }
  const wrongSource = fixture("cfa-128"), result = checkDrive(wrongSource), event = result.events.find(item => item.type === "drive.checked");
  assert.ok(event);
  for (const patch of [
    { checkedCardGrade: 2 },
    { checkedCardClan: "Royal Paladin", checkedCardClans: ["Royal Paladin"] },
    { actingPlayerId: "guest-player", turnPlayerId: "guest-player", sourceControllerPlayerId: "guest-player" }
  ]) {
    const altered = Engine.createGameEvent(wrongSource.state, { ...event, ...patch, eventId: undefined, sequence: undefined });
    assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [altered], Engine).queued.length, 0, JSON.stringify(patch));
  }
  const nonVanguard = fixture("cfa-128"), nonVanguardResult = checkDrive(nonVanguard), nonVanguardEvent = nonVanguardResult.events.find(item => item.type === "drive.checked");
  nonVanguard.state.pendingAttack.attackerZone = "rear-guard";
  assert.equal(Reducer.discoverAutoTriggers(nonVanguard.state, [nonVanguardEvent], Engine).queued.length, 0);
  const stale = fixture("cfa-128"), staleResult = checkDrive(stale), staleEvent = staleResult.events.find(item => item.type === "drive.checked");
  stale.own.rear[0] = null;
  assert.equal(Reducer.discoverAutoTriggers(stale.state, [staleEvent], Engine).queued.length, 0);
  const joining = fixture("cfa-143", "bot"), joinAbility = Engine.parseCardAbilities(cards.get("cfa-143"))[0], joinResult = checkDrive(joining);
  assert.equal(joinResult.ok, true); assert.equal(joining.state.pendingAbility.side, "bot");
  const before = JSON.stringify(joining.state); assert.equal(resolve(joining, joinAbility.id, seats.hostAuthUid).ok, false); assert.equal(JSON.stringify(joining.state), before);
  assert.equal(ability.id, "cfa-128:0");
});
