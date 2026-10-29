"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog(), seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const entries = [["cfa-11397", 0, ["vanguard", "rear-guard"]], ["cfa-11400", 1, ["rear-guard"]]];
function card(id, uid, owner, extra = {}) { const def = catalog.find(item => item.id === id); return { uid, cardId: id, cardName: def?.name || id, type: def?.type || "Unit", grade: Number(def?.grade || 0), ownerPlayerId: owner, controllerPlayerId: owner, ...extra }; }
function fixture(cardId, index, side = "human", sourceZone = "rear-guard", checkedId = "cfa-2") {
  const pid = side === "human" ? "host-player" : "guest-player", enemySide = side === "human" ? "bot" : "human", enemyId = side === "human" ? "guest-player" : "host-player";
  const source = card(cardId, `source-${cardId}-${side}`, pid, { zone: sourceZone, circle: sourceZone === "vanguard" ? "vanguard" : "rear-left" });
  const attacker = sourceZone === "vanguard" ? source : card("cfa-14047", `attacker-${cardId}-${side}`, pid, { zone: "vanguard", circle: "vanguard" });
  const target = card("cfa-14047", `target-${cardId}-${side}`, enemyId, { zone: "vanguard", circle: "vanguard" });
  const checked = card(checkedId, `checked-${cardId}-${side}`, pid, { zone: "trigger", triggerZone: true });
  const own = { playerId: pid, vanguard: sourceZone === "vanguard" ? source : attacker, rear: sourceZone === "rear-guard" ? [source, null, null, null, null] : Array(5).fill(null), triggerZone: [checked], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const other = { playerId: enemyId, vanguard: target, rear: Array(5).fill(null), triggerZone: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const battleId = `battle-${cardId}-${side}`;
  const state = { matchId: `normal-drive-${cardId}-${side}`, stateVersion: 1, turn: 3, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], players: { [side]: own, [enemySide]: other }, pendingAttack: { battleId, attackerSide: side, attackerUid: attacker.uid, attackerZone: "vanguard", attackerPlayerId: pid, defenderSide: enemySide, targetUid: target.uid, targetZone: "vanguard", awaitingDrive: true }, pendingCheckCard: { side, uid: checked.uid, destination: "hand", checkKind: "drive", battleId } };
  const ability = Engine.parseCardAbilities(catalog.find(item => item.id === cardId)).find(item => item.id === `${cardId}:${index}`); assert.ok(ability);
  const event = Engine.createGameEvent(state, { type: "drive.checked", actingPlayerId: pid, turnPlayerId: pid, sourceCardInstanceId: attacker.uid, sourceControllerPlayerId: pid, cardInstanceId: checked.uid, subjectCardInstanceId: checked.uid, checkedCardInstanceId: checked.uid, checkedCardControllerPlayerId: pid, checkedCardTriggerType: "", previousLocation: "deck", currentLocation: "trigger", checkKind: "drive", battleId, phase: "battle", timingWindow: "drive-check" });
  return { state, own, source, checked, event, ability, side, pid };
}
function resolve(f) { return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `resolve-${f.event.eventId}`, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine); }

test("both normal-unit drive-check power definitions are exact and trusted", () => {
  for (const [cardId, index, locations] of entries) {
    const f = fixture(cardId, index); assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
    assert.deepEqual(f.ability.requiredLocation, locations); assert.equal(f.ability.trigger.eventType, "drive.checked"); assert.equal(f.ability.trigger.checkKind, "drive");
    assert.deepEqual(f.ability.costs, []); assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]);
  }
});
test("host and joining player resolve only their own drive-check AUTO for the exact source", () => {
  for (const [cardId, index] of entries) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, index, side, cardId === "cfa-11397" && side === "human" ? "vanguard" : "rear-guard");
    assert.equal(Engine.eventMatchesAbilityTrigger(f.ability, "driveCheck", f.event, f.source.uid, f.source.circle, f.event.currentLocation, f.pid), true, `${cardId}/${side} trigger match ${JSON.stringify({ trigger: f.ability.trigger, location: f.ability.requiredLocation, event: f.event, source: f.source.circle, pid: f.pid })}`);
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine); assert.equal(result.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(result)}`);
    assert.equal(f.state.pendingAbility.side, side); assert.equal(resolve(f).ok, true);
    assert.equal(f.source.turnPowerBoost, 3000); assert.equal(f.source.turnPowerExpiry, f.own.playerId);
  }
});
test("an authoritative driveCheck action queues the exact normal-unit ability for either online seat", () => {
  for (const [cardId, index] of entries) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, index, side, cardId === "cfa-11397" && side === "human" ? "vanguard" : "rear-guard");
    f.own.triggerZone = []; f.own.deck = [f.checked]; f.state.pendingCheckCard = null;
    Object.assign(f.state.pendingAttack, { driveChecksRemaining: 1, maxDriveChecks: 1, awaitingDrive: true });
    const result = Reducer.applyGameAction(f.state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `drive-${side}-${cardId}`, expectedStateVersion: f.state.stateVersion, payload: { type: "game-action", action: "driveCheck" } }, seats, Engine);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.ok(result.events.some(event => event.type === "drive.checked" && event.checkedCardInstanceId === f.checked.uid));
    assert.equal(f.state.pendingAbility?.side, side, `${cardId}/${side} pending: ${JSON.stringify({ result: result.events, pending: f.state.pendingAbilities, current: f.state.pendingAbility })}`); assert.equal(f.state.pendingAbility?.instance?.uid, f.source.uid);
  }
});
test("a trigger, another player's check, wrong circle, stale check card, and different attack do not trigger", () => {
  const trigger = fixture("cfa-11397", 0, "human", "rear-guard", "cfa-3"); assert.equal(Reducer.discoverAutoTriggers(trigger.state, [trigger.event], Engine).queued.length, 0);
  const wrongCircle = fixture("cfa-11400", 1, "human", "vanguard"); assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);
  const stale = fixture("cfa-11397", 0); stale.state.pendingCheckCard.uid = "other-card"; assert.equal(Reducer.discoverAutoTriggers(stale.state, [stale.event], Engine).queued.length, 0);
  const forged = fixture("cfa-11397", 0); forged.event = Engine.createGameEvent(forged.state, { ...forged.event, eventId: undefined, sourceCardInstanceId: "other-vanguard" }); assert.equal(Reducer.discoverAutoTriggers(forged.state, [forged.event], Engine).queued.length, 0);
  const opponentCheck = fixture("cfa-11397", 0); opponentCheck.event = Engine.createGameEvent(opponentCheck.state, { ...opponentCheck.event, eventId: undefined, actingPlayerId: "guest-player", turnPlayerId: "guest-player" }); assert.equal(Reducer.discoverAutoTriggers(opponentCheck.state, [opponentCheck.event], Engine).queued.length, 0);
});
