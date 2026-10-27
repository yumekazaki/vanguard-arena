"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = [
  ["cfa-5115", "Deletor"], ["cfa-5274", "Blue Wave"], ["cfa-5348", "Machining"],
  ["cfa-5354", "Honorary Professor"], ["cfa-5357", "Musketeer"], ["cfa-5370", "Darkface"],
  ["cfa-5600", "Regalia"], ["cfa-5656", "PR<3ISM"]
];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const card = id => catalog.find(item => String(item.id) === String(id));

function instance(id, uid, playerId, cardName, extra = {}) {
  return { uid, cardId: String(id), cardName, type: "Unit", grade: 1, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(cardId, fragment, ownerSide = "bot", targetName = `Test ${fragment} Unit`) {
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest";
  const attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = attackerSide === "human" ? "player-host" : "player-guest";
  const printed = card(cardId);
  assert.ok(printed, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(printed).find(item => item.id === `${cardId}:1`);
  assert.ok(ability?.definition, `${cardId}:1 compiles`);
  Engine.registerAbilityDefinitions([ability.definition]);
  const source = instance(cardId, `source-${ownerSide}`, ownerId, printed.name, { zone: "guardian", circle: "guardian" });
  const hand = [instance("cfa-2", `discard-${ownerSide}`, ownerId, "Hand Unit")];
  const target = instance("target-card", `target-${ownerSide}`, ownerId, targetName, { circle: "rear-left", zone: "rear-guard" });
  const opponentVanguard = instance("cfa-3", `opponent-vg-${ownerSide}`, attackerId, "Opponent Vanguard", { grade: 3, circle: "vanguard", zone: "vanguard" });
  const players = {
    human: { playerId: "player-host", vanguard: ownerSide === "human" ? instance("cfa-3", "vg-host", ownerId, "Host Vanguard", { grade: 3, circle: "vanguard", zone: "vanguard" }) : opponentVanguard, rear: ownerSide === "human" ? [target] : [], hand: ownerSide === "human" ? hand : [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: ownerSide === "human" ? [source] : [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: ownerSide === "bot" ? instance("cfa-3", "vg-guest", ownerId, "Guest Vanguard", { grade: 3, circle: "vanguard", zone: "vanguard" }) : opponentVanguard, rear: ownerSide === "bot" ? [target] : [], hand: ownerSide === "bot" ? hand : [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: ownerSide === "bot" ? [source] : [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: "gc-named-sentinel", stateVersion: 1, turn: 2, side: attackerSide, phase: 3, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], players,
    pendingAttack: { battleId: "battle-gc-named", attackerSide, attackerUid: opponentVanguard.uid, attackerZone: "vanguard", defenderSide: ownerSide, targetUid: target.uid, targetZone: "rear-left", guardCards: [], power: 18000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", timingWindow: "guard" });
  return { state, source, target, hand, ability, event, ownerSide, fragment };
}

function discover(f, changes = {}) {
  return Reducer.discoverAutoTriggers(f.state, [{ ...f.event, ...changes }], Engine);
}

function resolve(f, { accept = true, targetUid = f.target.uid, discardUid = f.hand[0]?.uid, authUid, actionId = `resolve-${f.ownerSide}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid || (f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid), actionId,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
      targetUid, costSelections: { cb: [], sb: [], discard: discardUid ? [discardUid] : [], reveal: [] } } } }, seats, Engine);
}

test("eight exact named-unit Sentinel abilities preserve printed source, cost, and card-name filter", () => {
  for (const [cardId, fragment] of FAMILY) {
    const f = fixture(cardId, fragment);
    assert.equal(f.ability.definition.source.patternId, "auto-gc-sentinel-protect-friendly-unit-name-filter-v1");
    assert.deepEqual(f.ability.requiredLocation, ["guardian"]);
    assert.equal(f.ability.trigger.eventType, "card.placed");
    assert.equal(f.ability.trigger.sourceLocation, "hand");
    assert.equal(f.ability.canDecline, true);
    assert.deepEqual(f.ability.costs, [{ type: "discard", count: 1 }]);
    assert.equal(f.ability.definition.effects[0].targetFilter.cardNameContains, fragment);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player privately resolve their own name-filtered Sentinel and discard", () => {
  for (const [cardId, fragment] of FAMILY) {
    for (const ownerSide of ["human", "bot"]) {
      const f = fixture(cardId, fragment, ownerSide);
      const found = discover(f);
      assert.equal(found.queued.length, 1, cardId);
      assert.equal(f.state.pendingAbility.side, ownerSide, cardId);
      const result = resolve(f);
      assert.equal(result.ok, true, `${cardId}: ${result.reason}`);
      assert.equal(f.state.pendingAttack.perfectGuard, true);
      const own = f.state.players[ownerSide], other = f.state.players[ownerSide === "human" ? "bot" : "human"];
      assert.deepEqual(own.drop.map(item => item.uid), [f.hand[0].uid]);
      assert.deepEqual(other.hand, []);
    }
  }
});

test("wrong card name, foreign target, foreign player, or unavailable discard reject atomically", () => {
  const wrongName = fixture("cfa-5115", "Deletor", "bot", "Ordinary Unit");
  discover(wrongName);
  const beforeWrongName = JSON.stringify(wrongName.state);
  assert.equal(resolve(wrongName).ok, false);
  assert.equal(JSON.stringify(wrongName.state), beforeWrongName);

  const foreign = fixture("cfa-5115", "Deletor");
  const opposing = instance("enemy", "foreign-target", "player-host", "Deletor Vanguard", { circle: "vanguard", zone: "vanguard" });
  foreign.state.players.human.vanguard = opposing;
  discover(foreign);
  const beforeForeign = JSON.stringify(foreign.state);
  assert.equal(resolve(foreign, { targetUid: opposing.uid }).ok, false);
  assert.equal(JSON.stringify(foreign.state), beforeForeign);

  const wrongSeat = fixture("cfa-5115", "Deletor", "bot");
  discover(wrongSeat);
  const beforeWrongSeat = JSON.stringify(wrongSeat.state);
  assert.equal(resolve(wrongSeat, { authUid: seats.hostAuthUid }).ok, false);
  assert.equal(JSON.stringify(wrongSeat.state), beforeWrongSeat);

  const missingCost = fixture("cfa-5115", "Deletor", "human");
  discover(missingCost);
  const beforeMissingCost = JSON.stringify(missingCost.state);
  assert.equal(resolve(missingCost, { discardUid: null }).ok, false);
  assert.equal(JSON.stringify(missingCost.state), beforeMissingCost);
});

test("the same Guardian ability does not trigger for another source, circle, or origin", () => {
  const f = fixture("cfa-5115", "Deletor");
  assert.equal(discover(f, { sourceCardInstanceId: "different-card", subjectCardInstanceId: "different-card", cardInstanceId: "different-card" }).queued.length, 0);
  assert.equal(discover(f, { currentLocation: "rear-left", circle: "rear-guard" }).queued.length, 0);
  assert.equal(discover(f, { previousLocation: "drop" }).queued.length, 0);
});

test("declining the optional Sentinel ability pays no discard and grants no protection", () => {
  const f = fixture("cfa-5656", "PR<3ISM", "bot");
  assert.equal(discover(f).queued.length, 1);
  const result = resolve(f, { accept: false });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.pendingAttack.perfectGuard, undefined);
  assert.equal(f.state.players.bot.hand.length, 1);
  assert.equal(f.state.players.bot.drop.length, 0);
});
