"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const card = catalog.find(item => item.id === "cfa-11692");
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const inst = (uid, cardId, ownerPlayerId, extra = {}) => ({ uid, cardId, ownerPlayerId, controllerPlayerId: ownerPlayerId, unitCard: true, ...extra });

function fixture(sourceSide = "bot", legion = true) {
  const ability = Engine.parseCardAbilities(card).find(item => item.id === "cfa-11692:0");
  assert.ok(ability?.definition);
  const opposingSide = sourceSide === "bot" ? "human" : "bot";
  const controllerId = sourceSide === "bot" ? "guest" : "host";
  const opponentId = sourceSide === "bot" ? "host" : "guest";
  const source = inst(`source-${sourceSide}`, card.id, controllerId, { zone: "rear-guard", circle: "rear-left" });
  const vanguard = inst(`vg-${sourceSide}`, "legion-vg", controllerId, legion ? { legionMateInstanceId: `mate-${sourceSide}` } : {});
  const opponentVanguard = inst(`vg-${opposingSide}`, "opponent-vg", opponentId);
  const own = { playerId: controllerId, vanguard, rear: [source, null, null, null, null], hand: [], soul: [], drop: [], deck: [inst(`draw-${sourceSide}`, "draw-card", controllerId)], damage: [], bind: [], orders: [], guardCircle: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] };
  const state = { matchId: "legion-hit-draw", stateVersion: 0, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], turn: 2, side: sourceSide, players: sourceSide === "bot" ? { human: opponent, bot: own } : { human: own, bot: opponent }, pendingAttack: { battleId: `battle-${sourceSide}`, attackerSide: sourceSide, attackerUid: source.uid, attackerZone: "rear-left", attackerPlayerId: controllerId, defenderSide: opposingSide, targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 20000, targetPower: 10000 } };
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: controllerId, turnPlayerId: controllerId, sourceCardInstanceId: source.uid, sourceControllerPlayerId: controllerId, subjectCardInstanceId: opponentVanguard.uid, subjectControllerPlayerId: opponentId, targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", attackingUnitInstanceId: source.uid, battleId: `battle-${sourceSide}`, phase: "battle", timingWindow: "attack-hit" });
  return { ability, source, own, opponent, state, event, sourceSide, controllerId };
}

test("the five exact Legion hit-draw cards compile with source, hit target, condition, and draw semantics", () => {
  const expected = new Set(["cfa-11692", "cfa-2143", "cfa-2150", "cfa-2279", "cfa-2344"]);
  const found = [];
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) {
    if (ability.definition?.source?.patternId !== "auto-rc-own-attack-hit-legion-draw-v1") continue;
    found.push(definition.id);
    assert.equal(ability.trigger.eventType, "attack.hit");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetLocation, "vanguard");
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-is-legion" }]);
    assert.deepEqual(ability.effects, [{ op: "draw", target: "controller", count: 1 }]);
    assert.equal(ability.choiceStatus, "modeled");
  }
  assert.deepEqual(new Set(found), expected);
  assert.equal(found.length, expected.size);
});

test("hit ability resolves privately for the joining attacker, while wrong source or non-Legion Vanguard is rejected", () => {
  for (const sourceSide of ["human", "bot"]) {
    const f = fixture(sourceSide);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === f.ability.id), true);
    assert.equal(Engine.locateCardInstance(f.state, f.source.uid)?.controllerPlayerId, f.controllerId);
    assert.equal(Engine.eventMatchesAbilityTrigger(f.ability, "hit", f.event, f.source.uid, "rear-guard", "vanguard", f.controllerId), true, JSON.stringify({ trigger: f.ability.trigger, event: f.event }));
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, JSON.stringify(discovery));
    assert.equal(f.state.pendingAbility.side, sourceSide);
    const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: sourceSide === "bot" ? "auth-guest" : "auth-host", actionId: `draw-${sourceSide}`, expectedStateVersion: 0, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.own.hand.some(item => item.uid === `draw-${sourceSide}`), true);
    assert.equal(f.opponent.hand.length, 0);
  }
  const noLegion = fixture("bot", false);
  assert.equal(Reducer.discoverAutoTriggers(noLegion.state, [noLegion.event], Engine).queued.length, 0);
  const otherUnitAttacked = fixture("bot");
  const unrelated = Engine.createGameEvent(otherUnitAttacked.state, { ...otherUnitAttacked.event, eventId: "unrelated-attacker", sourceCardInstanceId: "different-source", attackingUnitInstanceId: "different-source" });
  assert.equal(Reducer.discoverAutoTriggers(otherUnitAttacked.state, [unrelated], Engine).queued.length, 0);
  const rearHit = fixture("bot");
  const wrongTarget = Engine.createGameEvent(rearHit.state, { ...rearHit.event, eventId: "rear-guard-hit", targetLocation: "rear-guard" });
  assert.equal(Reducer.discoverAutoTriggers(rearHit.state, [wrongTarget], Engine).queued.length, 0);
});
