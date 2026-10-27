"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function definition(cardId) {
  const card = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(card, `catalog card ${cardId} exists`);
  return card;
}

function instance(card, uid, playerId, overrides = {}) {
  return {
    uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit",
    grade: Number(card.grade), ownerPlayerId: playerId, controllerPlayerId: playerId,
    ...(card.clan ? { clan: card.clan } : {}), ...overrides
  };
}

function setup(cardId, ownerSide = "bot", handCount = 2) {
  const ownerPlayerId = ownerSide === "human" ? "host" : "guest";
  const attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerPlayerId = attackerSide === "human" ? "host" : "guest";
  const card = definition(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-gc-protect-then-conditional-discard-v1");
  assert.ok(ability, `${cardId} has the audited conditional-discard family`);
  Engine.registerAbilityDefinitions([ability.definition]);

  const source = instance(card, `${ownerSide}-guard-source`, ownerPlayerId, { zone: "guardian", circle: "guardian" });
  const ownHand = Array.from({ length: handCount }, (_, index) => instance(definition("cfa-2"), `${ownerSide}-hand-${index}`, ownerPlayerId));
  const target = instance(definition("cfa-3"), `${ownerSide}-attacked-target`, ownerPlayerId, { circle: "rear-left" });
  const otherSideTarget = instance(definition("cfa-3"), `${attackerSide}-vanguard`, attackerPlayerId);
  const players = {
    human: { playerId: "host", vanguard: ownerSide === "human" ? instance(definition("cfa-3"), "host-vanguard", "host") : otherSideTarget,
      rear: ownerSide === "human" ? [target] : [], hand: ownerSide === "human" ? ownHand : [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: ownerSide === "human" ? [source] : [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "guest", vanguard: ownerSide === "bot" ? instance(definition("cfa-3"), "guest-vanguard", "guest") : otherSideTarget,
      rear: ownerSide === "bot" ? [target] : [], hand: ownerSide === "bot" ? ownHand : [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: ownerSide === "bot" ? [source] : [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = {
    matchId: "conditional-discard-guardian-server", stateVersion: 1, turn: 2, side: attackerSide, phase: 3,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], players,
    pendingAttack: { battleId: "battle-conditional-discard", attackerSide, attackerUid: otherSideTarget.uid,
      attackerZone: "vanguard", defenderSide: ownerSide, targetUid: target.uid, targetZone: "rear-left",
      guardCards: [], power: 18000, targetPower: 10000, critical: 1 }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerPlayerId, turnPlayerId: attackerPlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerPlayerId, sourceControllerPlayerId: ownerPlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerPlayerId,
    subjectControllerPlayerId: ownerPlayerId, previousLocation: "hand", currentLocation: "guardian",
    circle: "guardian", timingWindow: "guard"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovered.queued.length, 1, `${ability.id} queues from this source's GC placement`);
  return { state, source, ability, ownHand, target, ownerSide, ownerPlayerId };
}

function resolve(fixture, selection, actionId = "resolve-conditional-discard") {
  const actorAuthUid = fixture.ownerSide === "human" ? "auth-host" : "auth-guest";
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: [], discard: [], reveal: [] }, ...selection
    } }
  }, seats, Engine);
}

for (const [cardId, wording] of [["cfa-8254", "your hand"], ["cfa-13984", "hand"]]) {
  test(`trusted server resolves ${cardId} (${wording}) in order for its controller`, () => {
    const fixture = setup(cardId);
    assert.equal(Reducer.supportsServerEffectOperation("discard-from-hand"), false,
      "the generic discard operation remains unsupported");
    assert.equal(Reducer.supportsServerEffectOperation("protect-target"), true);
    const selectedUid = fixture.ownHand[0].uid, remainingUid = fixture.ownHand[1].uid;
    const result = resolve(fixture, { effectDiscardUid: selectedUid });
    assert.equal(result.ok, true, result.reason);
    assert.equal(fixture.state.pendingAttack.perfectGuard, true);
    assert.equal(fixture.state.pendingAttack.blocked, true);
    assert.deepEqual(fixture.state.players.bot.drop.map(card => card.uid), [selectedUid]);
    assert.deepEqual(fixture.state.players.bot.hand.map(card => card.uid), [remainingUid]);
    assert.deepEqual(fixture.state.players.human.hand, []);
  });
}

test("host and joining player each resolve this family using only their own hand", () => {
  for (const ownerSide of ["human", "bot"]) {
    const fixture = setup("cfa-8254", ownerSide);
    const selectedUid = fixture.ownHand[1].uid, remainingUid = fixture.ownHand[0].uid;
    const result = resolve(fixture, { effectDiscardUid: selectedUid }, `resolve-${ownerSide}`);
    assert.equal(result.ok, true, result.reason);
    const own = fixture.state.players[ownerSide];
    const opponent = fixture.state.players[ownerSide === "human" ? "bot" : "human"];
    assert.deepEqual(own.drop.map(card => card.uid), [selectedUid]);
    assert.deepEqual(own.hand.map(card => card.uid), [remainingUid]);
    assert.deepEqual(opponent.drop, []);
    assert.deepEqual(opponent.hand, []);
    assert.equal(fixture.state.pendingAttack.perfectGuard, true);
  }
});

test("missing, foreign, and stale conditional discard selections reject without partial effects", () => {
  for (const [label, choice] of [["missing", undefined], ["foreign", "host-private-card"], ["stale", "no-longer-in-hand"]]) {
    const fixture = setup("cfa-13984");
    fixture.state.players.human.hand.push(instance(definition("cfa-2"), "host-private-card", "host"));
    const before = JSON.stringify(fixture.state);
    const result = resolve(fixture, choice === undefined ? {} : { effectDiscardUid: choice }, `reject-${label}`);
    assert.equal(result.ok, false, label);
    assert.equal(result.reason, "conditional-discard-selection-required", label);
    assert.equal(JSON.stringify(fixture.state), before, `${label} selection must not partially apply protection or move cards`);
  }
});

test("below the hand threshold resolves protection and skips the conditional discard", () => {
  const fixture = setup("cfa-13984", "bot", 1);
  const result = resolve(fixture, {}, "resolve-below-threshold");
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.state.pendingAttack.perfectGuard, true);
  assert.equal(fixture.state.pendingAttack.blocked, true);
  assert.deepEqual(fixture.state.players.bot.hand.map(card => card.uid), [fixture.ownHand[0].uid]);
  assert.deepEqual(fixture.state.players.bot.drop, []);
});

test("host cannot resolve the joining player's family or discard from their hand", () => {
  const fixture = setup("cfa-8254");
  const before = JSON.stringify(fixture.state);
  const result = Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: "auth-host", actionId: "host-forges-guest-ability", expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: [], discard: [], reveal: [] }, effectDiscardUid: fixture.ownHand[0].uid
    } }
  }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "source-not-controlled");
  assert.equal(JSON.stringify(fixture.state), before);
});
