"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const ids = ["cfa-2032", "cfa-2046", "cfa-2247", "cfa-2257", "cfa-2523", "cfa-2534", "cfa-2681", "cfa-2695", "cfa-3075"];

function definition(cardId) {
  const result = catalog.find(card => String(card.id) === String(cardId));
  assert.ok(result, `catalog card ${cardId} exists`);
  return result;
}

function instance(card, uid, playerId, overrides = {}) {
  return { uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit", grade: Number(card.grade),
    shield: Number(card.shield || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function setup({ ownerSide = "bot", cardId = ids[0], eventOverrides = {} } = {}) {
  const sourceDef = definition(cardId);
  const ability = Engine.parseCardAbilitiesCached(sourceDef).find(item => item.definition?.source?.patternId === "auto-intercept-shield-battle-v1");
  assert.ok(ability, `${cardId} belongs to the exact intercept family`);
  Engine.registerAbilityDefinitions([ability.definition]);
  const ownerId = ownerSide === "human" ? "host" : "guest";
  const ownerAuth = ownerSide === "human" ? "auth-host" : "auth-guest";
  const source = instance(sourceDef, `${ownerSide}-interceptor`, ownerId, { zone: "guardian", circle: "guardian" });
  const attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = attackerSide === "human" ? "host" : "guest";
  const owner = { playerId: ownerId, vanguard: instance(definition("cfa-3"), `${ownerSide}-vg`, ownerId),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [source], gDeck: [], gZone: [], triggerZone: [] };
  const attacker = { playerId: attackerId, vanguard: instance(definition("cfa-3"), `${attackerSide}-vg`, attackerId),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = ownerSide === "human" ? { human: owner, bot: attacker } : { human: attacker, bot: owner };
  const attack = { battleId: "battle-intercept-1", attackerSide, attackerUid: `${attackerSide}-vg`, attackerZone: "vanguard",
    defenderSide: ownerSide, targetUid: `${ownerSide}-vg`, targetZone: "vanguard", guardCards: [source],
    power: 18000, targetPower: 10000, critical: 1 };
  const state = { matchId: "intercept-shield-server", stateVersion: 1, turn: 4, side: attackerSide, phase: 5,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], players, pendingAttack: attack };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId,
    turnPlayerId: attackerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId,
    sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "rear-guard",
    currentLocation: "guardian", circle: "guardian", phase: "battle", timingWindow: "intercept", battleId: attack.battleId,
    ...eventOverrides });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, source, ability, ownerSide, ownerAuth, discovery, event };
}

function decide(fixture, authUid = fixture.ownerAuth, actionId = "resolve-intercept-shield") {
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: authUid, actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid,
      abilityId: fixture.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("only the nine exact intercept definitions receive support; generic shield modification stays unsupported", () => {
  const abilities = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === "auto-intercept-shield-battle-v1") abilities.push(ability);
  }
  assert.equal(abilities.length, 9);
  assert.deepEqual(abilities.map(item => item.cardId).sort(), ids.slice().sort());
  assert.ok(abilities.every(item => Reducer.supportsServerAbilityEffects(item)));
  assert.equal(Reducer.supportsServerEffectOperation("modify-shield-source"), false);
  const altered = structuredClone(abilities[0]);
  altered.definition.effects[0].amount = 10000;
  assert.equal(Reducer.supportsServerAbilityEffects(altered), false);
});

test("each seat resolves only its own exact interceptor and adds shield to that battle", () => {
  for (const ownerSide of ["human", "bot"]) {
    const fixture = setup({ ownerSide, cardId: ids[ownerSide === "human" ? 1 : 0] });
    assert.equal(fixture.discovery.queued.length, 1);
    assert.equal(fixture.state.pendingAbility.triggerControllerPlayerId, fixture.state.players[ownerSide].playerId);
    const attack = fixture.state.pendingAttack;
    const result = decide(fixture);
    assert.equal(result.ok, true, result.reason);
    assert.equal(attack.targetPower, 15000);
    assert.equal(fixture.source.battleShieldBoost, 5000);
    assert.equal(fixture.source.battleShieldExpiryBattleId, attack.battleId);
  }
});

test("wrong source identity, previous/current location, or battle id cannot queue the ability", () => {
  for (const eventOverrides of [
    { cardInstanceId: "different-copy", subjectCardInstanceId: "different-copy", sourceCardInstanceId: "different-copy" },
    { previousLocation: "hand" },
    { currentLocation: "rear-guard", circle: "rear-guard" },
    { battleId: "stale-battle" }
  ]) {
    const fixture = setup({ eventOverrides });
    assert.equal(fixture.discovery.queued.length, 0, JSON.stringify(eventOverrides));
    assert.equal(fixture.state.pendingAbility ?? null, null);
  }
});

test("wrong active battle and card not registered as this battle's guard reject before resolving", () => {
  const fixture = setup();
  fixture.state.pendingAttack.battleId = "another-battle";
  fixture.state.pendingAttack.guardCards = [];
  const before = JSON.stringify(fixture.state);
  const result = decide(fixture);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(fixture.state), before);
});

test("host cannot proxy the joining controller's shield ability", () => {
  const fixture = setup({ ownerSide: "bot" });
  const before = JSON.stringify(fixture.state);
  const result = decide(fixture, "auth-host", "host-proxy-intercept");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "source-not-controlled");
  assert.equal(JSON.stringify(fixture.state), before);
});
