"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-2064", "cfa-2378", "cfa-2742"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
function fixture(side = "bot", cardId = IDS[0], zone = "rear-left", faceDownCount = 1) {
  const owner = side === "human" ? "host" : "guest", opponent = side === "human" ? "guest" : "host", opponentSide = side === "human" ? "bot" : "human";
  const source = { uid: "attacker", cardId, ownerPlayerId: owner, controllerPlayerId: owner, unitCard: true, type: "Unit", power: 10000 };
  const ownVg = { uid: "own-vg", cardId: "own-vg", ownerPlayerId: owner, controllerPlayerId: owner, unitCard: true, type: "Unit", grade: 3 };
  const oppVg = { uid: "opp-vg", cardId: "opp-vg", ownerPlayerId: opponent, controllerPlayerId: opponent, unitCard: true, type: "Unit", grade: 3 };
  const down = Array.from({ length: faceDownCount }, (_, i) => ({ uid: `own-down-${i}`, cardId: `damage-${i}`, ownerPlayerId: owner, controllerPlayerId: owner, faceDown: true }));
  const up = { uid: "own-up", cardId: "damage-up", ownerPlayerId: owner, controllerPlayerId: owner, faceDown: false };
  const own = player(owner), other = player(opponent); own.vanguard = zone === "vanguard" ? source : ownVg; own.damage = [...down, up];
  if (zone !== "vanguard") own.rear[0] = source;
  other.vanguard = oppVg;
  const state = { matchId: `mandatory-hit-countercharge-${side}-${zone}`, stateVersion: 1, turn: 3, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    players: side === "human" ? { human: own, bot: other } : { human: other, bot: own },
    pendingAttack: { battleId: "hit-battle", closing: true, attackerSide: side, attackerPlayerId: owner, attackerUid: source.uid, attackerZone: zone, defenderSide: opponentSide, targetUid: oppVg.uid, targetZone: "vanguard", power: 20000, targetPower: 10000, critical: 1 } };
  const ability = Engine.parseCardAbilitiesCached(catalog.find(c => c.id === cardId)).find(a => a.id === `${cardId}:0`);
  assert.ok(ability, `${cardId} compiles`);
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: owner, turnPlayerId: owner, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: owner, sourceControllerPlayerId: owner,
    cardInstanceId: oppVg.uid, subjectCardInstanceId: oppVg.uid, subjectOwnerPlayerId: opponent, subjectControllerPlayerId: opponent,
    targetCardInstanceIds: [oppVg.uid], targetLocation: "vanguard", attackingUnitInstanceId: source.uid, currentLocation: zone, previousLocation: zone,
    battleId: "hit-battle", phase: "battle", timingWindow: "attack-hit" });
  return { state, ability, source, own, other, down, up, side, event, oppVg };
}
function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function decide(f, authUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `hit-countercharge-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, damageUids: [f.down[0]?.uid] } } }, seats, Engine);
}

test("the three exact mandatory hit abilities require this own attack to hit the opposing Vanguard", () => {
  for (const cardId of IDS) {
    const f = fixture("bot", cardId);
    assert.equal(f.ability.definition.source.patternId, "auto-own-attack-hit-counter-charge-v1");
    assert.deepEqual(f.ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(f.ability.trigger.eventType, "attack.hit");
    assert.equal(f.ability.trigger.subject, "source");
    assert.deepEqual(f.ability.effects, [{ op: "counter-charge", count: 1 }]);
    assert.equal(f.ability.canDecline, false);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player independently Counter Charge their own selected damage from VC or RC", () => {
  for (const side of ["human", "bot"]) for (const zone of ["vanguard", "rear-left"]) {
    const f = fixture(side, IDS[0], zone);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = decide(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.down[0].faceDown, false);
    assert.equal(f.up.faceDown, false);
    assert.equal(f.other.damage.length, 0);
  }
});

test("different attacker, non-Vanguard target, stale battle, forged player, or no face-down Damage never grants a prompt", () => {
  const unrelated = fixture(); unrelated.event = { ...unrelated.event, sourceCardInstanceId: "another-unit", attackingUnitInstanceId: "another-unit" };
  assert.equal(discover(unrelated).queued.length, 0);
  const wrongTarget = fixture(); wrongTarget.state.pendingAttack.targetZone = "rear-left"; wrongTarget.event = { ...wrongTarget.event, targetLocation: "rear-left" };
  assert.equal(discover(wrongTarget).queued.length, 0);
  const stale = fixture(); stale.state.pendingAttack.battleId = "stale";
  assert.equal(discover(stale).queued.length, 0);
  const proxy = fixture(); assert.equal(discover(proxy).queued.length, 1);
  const before = JSON.stringify(proxy.state);
  assert.equal(decide(proxy, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(proxy.state), before);
  const noDamage = fixture("bot", IDS[1], "rear-left", 0);
  const skipped = discover(noDamage);
  assert.equal(skipped.queued.length, 0);
  assert.ok(skipped.skipped.some(item => item.reason === "no-face-down-damage"));
  assert.equal(discover(noDamage).queued.length, 0);
});

test("missing or forged Damage selection is rejected, and a forged card definition is not trusted", () => {
  const f = fixture(); assert.equal(discover(f).queued.length, 1);
  const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: seats.guestAuthUid, actionId: "bad-damage-selection", expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, damageUids: ["host-damage"] } } }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(f.down[0].faceDown, true);
  assert.equal(f.state.pendingAttack.power, 20000);
  const tampered = { ...f.ability, definition: { ...f.ability.definition, printedText: f.ability.printedText.replace("Counter Charge 1", "Counter Charge 2") } };
  assert.equal(Reducer.supportsServerAbilityEffects(tampered), false);
});
