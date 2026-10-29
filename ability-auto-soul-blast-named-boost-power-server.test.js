"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = "auto-soul-blast-named-boost-power-battle-v1";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const byId = id => catalog.find(card => String(card.id) === String(id));

function findBoostedCard(filter) {
  const name = String(filter.cardName || filter.cardNameContains || "").toLocaleLowerCase();
  const card = catalog.find(item => /unit/i.test(String(item.type || "Unit")) &&
    (filter.cardName ? String(item.name || "").toLocaleLowerCase() === name : String(item.name || "").toLocaleLowerCase().includes(name)));
  assert.ok(card, `catalog contains a legal Unit for printed boosted-card filter ${name}`);
  return card;
}

function instance(card, uid, playerId, extra = {}) {
  return { uid, cardId: String(card.id), cardName: card.name, name: card.name, type: card.type || "Unit", grade: Number(card.grade),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(cardId, side = "bot", options = {}) {
  const sourceDefinition = byId(cardId);
  assert.ok(sourceDefinition, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.definition?.source?.patternId === FAMILY);
  assert.ok(ability, `exact Soul Blast named-boost ability on ${cardId}`);
  const actorId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const filter = ability.definition.effects[0].targetFilter;
  const targetDefinition = options.wrongName ? byId("cfa-3") : findBoostedCard(filter);
  const source = instance(sourceDefinition, `booster-${cardId}-${side}`, actorId, { zone: "rear-guard", circle: "rear-left", rested: true });
  const attacker = instance(targetDefinition, `attacker-${cardId}-${side}`, options.opponentTarget ? opponentId : actorId,
    { zone: "vanguard", circle: "vanguard" });
  const soul = Array.from({ length: options.unpayable ? 0 : ability.costs[0].count }, (_, i) =>
    instance(byId("cfa-4"), `soul-${cardId}-${side}-${i}`, actorId, { zone: "soul" }));
  const own = { playerId: actorId, vanguard: options.opponentTarget ? instance(byId("cfa-3"), `own-vg-${side}`, actorId, { zone: "vanguard", circle: "vanguard" }) : attacker,
    rear: [source, null, null, null, null], soul, hand: [], drop: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: options.opponentTarget ? attacker : instance(byId("cfa-3"), `opponent-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" }),
    rear: [], soul: [], hand: [], drop: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: `named-boost-${cardId}-${side}`, stateVersion: 1, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], turn: 3, phase: "battle", side, players: { [side]: own, [side === "human" ? "bot" : "human"]: opponent },
    pendingAttack: { battleId: `battle-${cardId}-${side}`, attackerUid: attacker.uid, attackerSide: options.opponentTarget ? (side === "human" ? "bot" : "human") : side,
      attackerPlayerId: attacker.controllerPlayerId, attackerZone: "vanguard", boostUid: source.uid, power: 10000, defenderSide: side === "human" ? "bot" : "human", targetUid: "defender-vanguard", targetZone: "vanguard" } };
  let event = Engine.createGameEvent(state, { type: "unit.boosted", actingPlayerId: actorId, turnPlayerId: actorId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: actorId, sourceControllerPlayerId: actorId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: actorId, subjectControllerPlayerId: actorId,
    boosterCardInstanceId: source.uid, boostedCardInstanceId: attacker.uid, previousLocation: "rear-left", currentLocation: "rear-left",
    targetLocation: "vanguard", targetCardInstanceIds: [attacker.uid], phase: "battle", timingWindow: "boost-step", battleId: state.pendingAttack.battleId });
  if (options.wrongName) event = { ...event, boostedCardName: "Blaster Javelin" };
  if (options.wrongBooster) event = { ...event, boosterCardInstanceId: "unrelated-booster" };
  return { state, ability, source, attacker, own, opponent, event, side, actorId };
}

function resolve(fixture) {
  const soulCost = fixture.ability.costs[0].count;
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: fixture.side === "human" ? "auth-host" : "auth-guest",
    actionId: `resolve-${fixture.state.matchId}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: fixture.own.soul.slice(0, soulCost).map(card => card.uid), discard: [], reveal: [] } } } }, seats, Engine);
}

test("all 23 exact named-boost abilities are trusted by the production registry and authoritative reducer", () => {
  const family = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === FAMILY) family.push({ card, ability });
  assert.equal(family.length, 23);
  for (const { card, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id), ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
    assert.deepEqual(ability.costs, [{ type: "soul-blast", count: ability.costs[0].count }], ability.id);
    assert.equal(ability.trigger.eventType, "unit.boosted", ability.id);
    assert.equal(ability.trigger.subject, "source", ability.id);
    assert.equal(ability.definition.effects[0].target, "boosted-unit", ability.id);
  }
});

test("each exact name-filtered boost resolves for host and joining player with their own Soul Blast", () => {
  for (const card of catalog) for (const parsed of Engine.parseCardAbilitiesCached(card)) {
    if (parsed.definition?.source?.patternId !== FAMILY) continue;
    for (const side of ["human", "bot"]) {
      const f = fixture(card.id, side);
      const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.ok(discovery.queued.some(item => item.ability?.id === f.ability.id), `${f.ability.id}/${side} queued: ${JSON.stringify(discovery)}`);
      assert.equal(f.state.pendingAbility.side, side, `${f.ability.id}/${side} private owner`);
      assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.some(item => item.ability?.id === f.ability.id), false, `${f.ability.id}/${side} duplicate event`);
      const before = f.own.soul.length;
      const result = resolve(f);
      assert.equal(result.ok, true, `${f.ability.id}/${side}: ${result.reason}`);
      assert.equal(f.own.soul.length, before - f.ability.costs[0].count, f.ability.id);
      assert.equal(f.state.pendingAttack.power, 10000 + Number(f.ability.definition.effects[0].amount), f.ability.id);
      assert.equal(f.opponent.soul.length, 0, f.ability.id);
    }
  }
});

test("declining the optional boost leaves Soul and battle power unchanged", () => {
  const f = fixture("cfa-11", "bot");
  const beforeSoul = f.own.soul.map(card => card.uid);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: "auth-guest", actionId: "decline-named-boost",
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: false,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(f.own.soul.map(card => card.uid), beforeSoul);
  assert.equal(f.state.pendingAttack.power, 10000);
});

test("a wrong boosted name, foreign attacker, wrong booster, or unavailable Soul Blast never prompts", () => {
  const sample = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).map(ability => ({ card, ability })))
    .find(item => item.ability.definition?.source?.patternId === FAMILY);
  for (const options of [{ wrongName: true }, { opponentTarget: true }, { wrongBooster: true }, { unpayable: true }]) {
    const f = fixture(sample.card.id, "bot", options);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.some(item => item.ability?.id === f.ability.id), false,
      `${f.ability.id} must not prompt for ${Object.keys(options)[0]}`);
    assert.equal(f.state.players.bot.pendingAbility, undefined);
    assert.equal(f.state.players.human.soul.length, 0);
  }
});
