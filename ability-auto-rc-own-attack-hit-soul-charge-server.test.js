"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const SPECS = [
  { cardId: "cfa-8404", abilityId: "cfa-8404:0", name: "Selfish Engraver" },
  { cardId: "cfa-13158", abilityId: "cfa-13158:1", name: "Halloween Day (October 31)" }
];
const PATTERN_ID = "auto-rc-own-attack-hit-soul-charge-one-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
let fixtureSequence = 0;

function card(uid, cardId, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId, cardName: definition?.name || "Test unit", type: definition?.type || "Unit", grade: definition?.grade ?? 0,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...extra };
}

function makeFixture(spec, side = "human", targetZone = "vanguard") {
  const index = ++fixtureSequence;
  const opponentSide = side === "human" ? "bot" : "human";
  const sourcePlayerId = side === "human" ? "host-player" : "guest-player";
  const defenderPlayerId = side === "human" ? "guest-player" : "host-player";
  const source = card(`source-${index}`, spec.cardId, sourcePlayerId);
  const sourceVanguard = card(`own-vg-${index}`, "cfa-10", sourcePlayerId, { grade: 3 });
  const target = card(`target-${index}`, "cfa-10", defenderPlayerId, { grade: 3 });
  const charged = card(`charge-${index}`, "cfa-10", sourcePlayerId);
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = sourceVanguard;
  players[side].rear[0] = source;
  players[side].deck = [charged];
  if (targetZone === "vanguard") players[opponentSide].vanguard = target;
  else players[opponentSide].rear[1] = target;
  const sourceLocation = "rear-left";
  const battleId = `selfish-hit-${index}`;
  const state = { matchId: `selfish-match-${index}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players,
    pendingAttack: { battleId, closing: true, attackerSide: side, attackerPlayerId: sourcePlayerId, attackerUid: source.uid, attackerZone: sourceLocation,
      defenderSide: opponentSide, defenderPlayerId, targetUid: target.uid, targetZone, power: 20000, targetPower: 10000, critical: 1 } };
  const definition = catalog.find(item => String(item.id) === spec.cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === spec.abilityId);
  assert.ok(ability, `${spec.abilityId} compiles`);
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: sourcePlayerId, turnPlayerId: sourcePlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: defenderPlayerId, subjectControllerPlayerId: defenderPlayerId,
    targetCardInstanceIds: [target.uid], targetLocation: targetZone, attackingUnitInstanceId: source.uid, currentLocation: sourceLocation,
    previousLocation: sourceLocation, battleId, phase: "battle", timingWindow: "attack-hit" });
  return { state, ability, event, source, target, charged, side, sourcePlayerId, defenderPlayerId, battleId };
}

function resolve(fixture, authUid = fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: authUid, actionId: `resolve-${fixture.battleId}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id } } }, seats, Engine);
}

test("the exact two-card Rear-Guard attack-hit family compiles as mandatory Soul Charge 1", () => {
  for (const spec of SPECS) {
    const definition = catalog.find(cardDefinition => String(cardDefinition.id) === spec.cardId);
    const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === spec.abilityId);
    assert.equal(definition.name, spec.name);
    assert.equal(ability.definition.source.patternId, PATTERN_ID);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
    assert.equal(ability.trigger.eventType, "attack.hit");
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.effects, [{ op: "soul-charge", target: "controller", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("both seats resolve only their own matching Rear-Guard attack hit against either target circle", () => {
  for (const spec of SPECS) for (const side of ["human", "bot"]) for (const targetZone of ["vanguard", "rear-right"]) {
    const fixture = makeFixture(spec, side, targetZone);
    const queued = Reducer.discoverAutoTriggers(fixture.state, [fixture.event], Engine);
    assert.equal(queued.queued.length, 1, JSON.stringify(queued));
    assert.equal(fixture.state.pendingAbility.side, side);
    assert.equal(fixture.state.pendingAbility.instance.uid, fixture.source.uid);
    assert.equal(Reducer.discoverAutoTriggers(fixture.state, [fixture.event], Engine).queued.length, 0, "duplicate event is ignored");
    const result = resolve(fixture);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(fixture.state.players[side].soul.map(item => item.uid), [fixture.charged.uid]);
    assert.deepEqual(fixture.state.players[side === "human" ? "bot" : "human"].soul, []);
  }
});

test("unrelated attackers, forged hit targets, non-hit battles, and proxy players are rejected", () => {
  const unrelated = makeFixture(SPECS[0]);
  const otherAttacker = { ...unrelated.event, eventId: "unrelated-attacker", sourceCardInstanceId: "other-unit", attackingUnitInstanceId: "other-unit" };
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [otherAttacker], Engine).queued.length, 0);

  const forgedTarget = makeFixture(SPECS[0]);
  assert.equal(Reducer.discoverAutoTriggers(forgedTarget.state, [{ ...forgedTarget.event, eventId: "wrong-target", targetCardInstanceIds: ["other-target"] }], Engine).queued.length, 0);

  const notHit = makeFixture(SPECS[0]);
  notHit.state.pendingAttack.blocked = true;
  assert.equal(Reducer.discoverAutoTriggers(notHit.state, [notHit.event], Engine).queued.length, 0);

  const proxy = makeFixture(SPECS[0], "bot");
  assert.equal(Reducer.discoverAutoTriggers(proxy.state, [proxy.event], Engine).queued.length, 1);
  const before = JSON.stringify(proxy.state);
  const rejected = resolve(proxy, seats.hostAuthUid);
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(proxy.state), before);
});

test("a modified effect definition cannot be executed by the server", () => {
  const fixture = makeFixture(SPECS[0]);
  const forged = structuredClone(fixture.ability);
  forged.definition.effects[0].count = 2;
  forged.effects[0].count = 2;
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
