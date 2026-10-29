"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-intercept-clan-vanguard-shield-battle-v1";
const CARD_IDS = ["cfa-1076", "cfa-1104", "cfa-1462", "cfa-1470", "cfa-151", "cfa-1683", "cfa-212", "cfa-25", "cfa-297", "cfa-345", "cfa-375", "cfa-533", "cfa-580", "cfa-618", "cfa-677", "cfa-722", "cfa-862", "cfa-95"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const card = id => { const found = catalog.find(item => String(item.id) === id); assert.ok(found, `catalog card ${id}`); return found; };
const instance = (definition, uid, playerId, extra = {}) => ({ uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit", grade: Number(definition.grade), shield: Number(definition.shield || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...(definition.clan ? { clan: definition.clan, clans: definition.clans || [definition.clan] } : {}), ...extra });

function setup({ cardId = CARD_IDS[0], side = "bot", clanOverride, eventOverride = {} } = {}) {
  const sourceDef = card(cardId), ability = Engine.parseCardAbilitiesCached(sourceDef).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${cardId} compiles to ${PATTERN}`);
  const clan = ability.conditions[0].value, ownerId = side === "human" ? "host" : "guest", ownerAuth = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const attackerSide = side === "human" ? "bot" : "human", attackerId = attackerSide === "human" ? "host" : "guest";
  const source = instance(sourceDef, `${side}-interceptor`, ownerId, { zone: "guardian", circle: "guardian" });
  const ownerClan = ["opponent", "owner-missing"].includes(clanOverride) ? "Different Clan" : clan;
  const attackerClan = clanOverride === "owner-missing" ? clan : "Different Clan";
  const ownerVanguard = instance({ ...card("cfa-3"), id: `test-owner-vanguard-${side}`, clan: ownerClan, clans: [ownerClan] }, `${side}-vg`, ownerId);
  const attackerVanguard = instance({ ...card("cfa-3"), id: `test-attacker-vanguard-${side}`, clan: attackerClan, clans: [attackerClan] }, `${attackerSide}-vg`, attackerId);
  const owner = { playerId: ownerId, vanguard: ownerVanguard, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [source], gDeck: [], gZone: [], triggerZone: [] };
  const attacker = { playerId: attackerId, vanguard: attackerVanguard, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = side === "human" ? { human: owner, bot: attacker } : { human: attacker, bot: owner };
  const attack = { battleId: "clan-intercept-battle", attackerSide, attackerUid: attackerVanguard.uid, attackerZone: "vanguard", defenderSide: side, targetUid: ownerVanguard.uid, targetZone: "vanguard", guardCards: [source], power: 18000, targetPower: 10000, critical: 1 };
  const state = { matchId: "clan-intercept-authority", stateVersion: 2, turn: 5, side: attackerSide, phase: 5, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], players, pendingAttack: attack };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "rear-right", currentLocation: "guardian", circle: "guardian", phase: "battle", timingWindow: "intercept", battleId: attack.battleId, ...eventOverride });
  const located = Engine.locateCardInstance(state, source.uid);
  assert.deepEqual({ side: located.side, zone: located.zone, circle: located.circle, ownerPlayerId: located.ownerPlayerId, controllerPlayerId: located.controllerPlayerId }, { side, zone: "guardian", circle: "guardian", ownerPlayerId: ownerId, controllerPlayerId: ownerId }, "source should be found only in current GC");
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, event, source, ability, side, ownerId, ownerAuth, clan, discovery };
}

function decide(fixture, authUid = fixture.ownerAuth) {
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: authUid, actionId: `resolve-clan-intercept-${fixture.side}`, expectedStateVersion: fixture.state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id } } }, seats, Engine);
}

test("all 18 clan-qualified Intercept definitions are exact and server-gated", () => {
  const family = [];
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) if (ability.definition?.source?.patternId === PATTERN) family.push(ability);
  assert.equal(family.length, 18);
  assert.deepEqual(family.map(ability => ability.cardId).sort(), CARD_IDS.slice().sort());
  assert.ok(family.every(ability => Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(entry => entry.id === ability.id)), "every family ability is trusted in the production registry");
  assert.ok(family.every(ability => Reducer.supportsServerAbilityEffects(ability)));
  for (const ability of family) {
    assert.equal(ability.kind, "AUTO");
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: ability.conditions[0].value }]);
    assert.equal(ability.definition.effects[0].amount, 5000);
    const altered = structuredClone(ability); altered.definition.effects[0].amount = 10000;
    assert.equal(Reducer.supportsServerAbilityEffects(altered), false, ability.id);
  }
  assert.equal(Reducer.supportsServerEffectOperation("modify-shield-source"), false);
});

test("host and joining defender resolve the exact Intercept shield using their own clan and battle", () => {
  for (const side of ["human", "bot"]) {
    const fixture = setup({ side, cardId: side === "human" ? CARD_IDS[1] : CARD_IDS[0] });
    assert.equal(fixture.discovery.queued.length, 1, `${side}: skipped=${JSON.stringify(fixture.discovery.skipped)} readiness=${JSON.stringify(Engine.autoAbilityReadiness(fixture.ability))} supports=${Reducer.supportsServerAbilityEffects(fixture.ability)}`);
    assert.equal(fixture.state.pendingAbility.side, side);
    const result = decide(fixture);
    assert.equal(result.ok, true, result.reason);
    assert.equal(fixture.state.pendingAttack.targetPower, 15000);
    assert.equal(fixture.source.battleShieldBoost, 5000);
    assert.equal(fixture.source.battleShieldExpiryBattleId, fixture.state.pendingAttack.battleId);
  }
});

test("wrong Vanguard clan, other player's clan, wrong source, location, and battle cannot trigger", () => {
  for (const options of [
    { clanOverride: "owner-missing" }, { clanOverride: "opponent" },
    { eventOverride: { cardInstanceId: "other-copy", subjectCardInstanceId: "other-copy", sourceCardInstanceId: "other-copy" } },
    { eventOverride: { previousLocation: "hand" } },
    { eventOverride: { currentLocation: "rear-left", circle: "rear-left" } },
    { eventOverride: { battleId: "stale-battle" } }
  ]) {
    const fixture = setup(options);
    assert.equal(fixture.discovery.queued.length, 0, JSON.stringify(options));
    assert.equal(fixture.state.pendingAbility || null, null);
  }
});

test("controller clan is rechecked on resolution and host cannot proxy the joining defender", () => {
  const stale = setup();
  assert.equal(stale.discovery.queued.length, 1);
  stale.state.players[stale.side].vanguard.clan = "Changed Clan";
  stale.state.players[stale.side].vanguard.clans = ["Changed Clan"];
  const before = JSON.stringify(stale.state), rejected = decide(stale);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "intercept-shield-condition-no-longer-met");
  assert.equal(JSON.stringify(stale.state), before);

  const joined = setup({ side: "bot" });
  assert.equal(joined.discovery.queued.length, 1);
  const proxy = decide(joined, seats.hostAuthUid);
  assert.equal(proxy.ok, false);
  assert.equal(proxy.reason, "source-not-controlled");
});
