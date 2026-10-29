"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-8378", "cfa-8386", "cfa-8398", "cfa-8406", "cfa-8418", "cfa-8908"];
const TEXT = "AUTO [RC]: When this unit boosts, this unit gets power +2000 until end of turn.";
const PATTERN = "auto-own-boost-turn-power-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function rowFor(id) { return catalog.find(row => String(row.id) === String(id)); }
function card(uid, cardId, playerId) {
  const row = rowFor(cardId);
  return { uid, cardId: String(cardId), cardName: row?.name || "Test Unit", type: "Unit", grade: Number(row?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(cardId = IDS[0], side = "human") {
  const row = rowFor(cardId), ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled exact ability ${cardId}:0`);
  const opponent = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const n = ++sequence, source = card(`booster-${n}`, cardId, ownerId), attacker = card(`attacker-${n}`, "cfa-1", ownerId), target = card(`target-${n}`, "cfa-3", opponentId);
  source.rested = true;
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = attacker; players[side].rear[0] = source; players[opponent].vanguard = target;
  const battleId = `battle-${n}`;
  const state = { matchId: "auto-own-boost-turn-power", stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players,
    pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide: side, attackerPlayerId: ownerId, attackerZone: "vanguard", targetUid: target.uid, targetZone: "vanguard", defenderSide: opponent, power: 20000, targetPower: 10000, critical: 1, boostUid: source.uid, boostPower: 5000 } };
  const event = Engine.createGameEvent(state, { type: "unit.boosted", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    boosterCardInstanceId: source.uid, boostedCardInstanceId: attacker.uid, previousLocation: "rear-left", currentLocation: "rear-left", circle: "rear-left",
    targetLocation: "vanguard", targetCardInstanceIds: [attacker.uid], battleId, phase: "battle", timingWindow: "boost-step", after: { rested: true } });
  return { state, ability, event, source, attacker, target, side, ownerId, battleId };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-boost-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("six catalog cards have the exact independent RC own-boost +2000 turn AUTO", () => {
  for (const id of IDS) {
    const row = rowFor(id); assert.ok(row, id);
    const abilities = Engine.parseCardAbilitiesCached(row), ability = abilities.find(item => item.id === `${id}:0`);
    assert.ok(ability, id); assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], id);
    assert.equal(ability.trigger.eventType, "unit.boosted", id); assert.equal(ability.trigger.subject, "source", id);
    assert.deepEqual(ability.costs, [], id); assert.deepEqual(ability.conditions, [], id);
    assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 2000, duration: "turn" }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    assert.equal(abilities.filter(item => item.id !== ability.id).length, Math.max(0, abilities.length - 1), id);
  }
});

test("the exact booster prompts and resolves for its own controller from either online seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side), found = discover(f);
    assert.equal(found.queued.length, 1, JSON.stringify(found));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(discover(f).queued.length, 0, "replayed event cannot queue duplicate trigger");
    const proxy = resolve(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid);
    assert.equal(proxy.ok, false, "the host cannot resolve the joining player's ability by proxy");
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.source.turnPowerBoost, 2000);
    assert.equal(f.state.pendingAttack.power, 22000);
    assert.equal(resolve(f).ok, false, "a repeated action cannot apply the effect twice");
  }
});

test("another booster, unrelated attack, stale battle/source, wrong seat, and altered definitions are rejected", () => {
  const f = fixture();
  for (const change of [
    { boosterCardInstanceId: "other-booster", sourceCardInstanceId: "other-booster", cardInstanceId: "other-booster", subjectCardInstanceId: "other-booster" },
    { boostedCardInstanceId: "other-attacker", targetCardInstanceIds: ["other-attacker"] },
    { battleId: "stale-battle" },
    { timingWindow: "attack-declared" },
    { sourceOwnerPlayerId: "guest-player" }
  ]) {
    const bad = Engine.createGameEvent(f.state, { ...f.event, ...change, eventId: undefined });
    assert.equal(discover(f, bad).queued.length, 0, JSON.stringify(change));
  }
  const another = card("other-booster", IDS[0], f.ownerId); another.rested = true; f.state.players[f.side].rear[1] = another;
  const otherEvent = Engine.createGameEvent(f.state, { ...f.event, sourceCardInstanceId: another.uid, cardInstanceId: another.uid, subjectCardInstanceId: another.uid,
    boosterCardInstanceId: another.uid, sourceOwnerPlayerId: f.ownerId, subjectOwnerPlayerId: f.ownerId, eventId: undefined });
  assert.equal(discover(f, otherEvent).queued.length, 0, "a duplicate card name cannot substitute for the actual booster instance");

  const staleSource = fixture(); staleSource.state.players[staleSource.side].rear[0] = null;
  assert.equal(discover(staleSource).queued.length, 0);
  const movedAfterQueue = fixture(); assert.equal(discover(movedAfterQueue).queued.length, 1);
  movedAfterQueue.state.players[movedAfterQueue.side].rear[0] = null;
  movedAfterQueue.state.players[movedAfterQueue.side].drop.push(movedAfterQueue.source);
  assert.equal(resolve(movedAfterQueue).ok, false, "source leaving RC after queueing invalidates the trigger");
  assert.equal(movedAfterQueue.source.turnPowerBoost || 0, 0);
  const proxy = fixture(IDS[0], "bot"); discover(proxy);
  assert.equal(resolve(proxy, seats.hostAuthUid).ok, false);
  assert.equal(proxy.source.turnPowerBoost || 0, 0);

  const base = fixture().ability;
  for (const mutate of [
    ability => { ability.definition.printedText = ability.definition.printedText.replace("+2000", "+3000"); },
    ability => { ability.requiredLocation = ["vanguard"]; },
    ability => { ability.trigger.eventType = "unit.attacked"; },
    ability => { ability.definition.effects[0].duration = "battle"; },
    ability => { ability.definition.id = "cfa-8386:0"; }
  ]) {
    const forged = structuredClone(base); mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
