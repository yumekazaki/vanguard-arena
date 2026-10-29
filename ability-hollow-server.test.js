"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const FAMILY = "auto-hollow-placement-retire-turn-end-v1";

function card(id) {
  const result = catalog.find(item => String(item.id) === String(id));
  assert.ok(result, `catalog card ${id} exists`);
  return result;
}

function unit(definition, uid, controller, extra = {}) {
  return {
    uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade), ownerPlayerId: controller, controllerPlayerId: controller, ...extra
  };
}

function hollowDefinitions() {
  const definitions = [];
  for (const definition of catalog) {
    for (const ability of Engine.parseCardAbilitiesCached(definition)) {
      if (ability.definition?.source?.patternId === FAMILY) definitions.push({ definition, ability });
    }
  }
  return definitions;
}

function setup({ cardId = "cfa-3937", controllerSide = "bot" } = {}) {
  const sourceDefinition = card(cardId);
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.definition?.source?.patternId === FAMILY);
  assert.ok(ability);
  const controllerId = controllerSide === "bot" ? "guest" : "host";
  const source = unit(sourceDefinition, `${controllerId}-hollow-source`, controllerId, { circle: "rear-left", rested: false });
  const other = unit(card("cfa-3"), `${controllerId}-other-unit`, controllerId, { circle: "rear-right", hollowed: false });
  const players = {
    human: { playerId: "host", vanguard: unit(card("cfa-3"), "host-vg", "host"), rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "guest", vanguard: unit(card("cfa-3"), "guest-vg", "guest"), rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  players[controllerSide].rear[0] = source;
  players[controllerSide].rear[1] = other;
  const state = {
    matchId: "hollow-server", stateVersion: 4, turn: 3, side: controllerSide, phase: 4,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [],
    players, pendingAttack: null, pendingTurnEnd: null
  };
  return { state, source, other, ability, controllerSide, controllerId };
}

function placementEvent(fixture, cardInstanceId = fixture.source.uid, location = "rear-left") {
  const player = fixture.state.players[fixture.controllerSide];
  const instance = [...(player.rear || []), player.vanguard].find(candidate => candidate?.uid === cardInstanceId);
  return Engine.createGameEvent(fixture.state, {
    type: "card.placed", actingPlayerId: fixture.controllerId, turnPlayerId: fixture.controllerId,
    sourceCardInstanceId: cardInstanceId, sourceOwnerPlayerId: instance?.ownerPlayerId || fixture.controllerId,
    sourceControllerPlayerId: instance?.controllerPlayerId || fixture.controllerId,
    cardInstanceId, subjectCardInstanceId: cardInstanceId,
    subjectOwnerPlayerId: instance?.ownerPlayerId || fixture.controllerId,
    subjectControllerPlayerId: instance?.controllerPlayerId || fixture.controllerId,
    previousLocation: "hand", currentLocation: location, circle: location, timingWindow: "call-resolution"
  });
}

function discover(fixture, event = placementEvent(fixture)) {
  return Reducer.discoverAutoTriggers(fixture.state, [event], Engine);
}

function response(fixture, authUid, accept, actionId = "hollow-decision") {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: authUid, actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("exact 32-card Hollow family is restricted to source RC placement and a source-only Hollow effect", () => {
  const family = hollowDefinitions();
  assert.equal(family.length, 32);
  assert.equal(new Set(family.map(item => item.definition.id)).size, 32);
  assert.equal(new Set(family.map(item => item.ability.printedText)).size, 3);
  for (const { definition, ability } of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(definition.id).some(item => item.id === ability.id), `${ability.id} is in the production registry`);
    assert.equal(ability.cardId, definition.id);
    assert.equal(ability.definition.effects.length, 1);
    assert.deepEqual(ability.definition.effects[0], { op: "set-hollowed", target: "source" });
    assert.equal(ability.trigger.eventType, "card.placed");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
  assert.equal(Reducer.supportsServerEffectOperation("set-hollowed"), false,
    "the operation is admitted only for the exact reviewed ability family");
});

test("a joining player's own RC placement queues and marks only that exact source if accepted", () => {
  const fixture = setup({ controllerSide: "bot" });
  const result = discover(fixture);
  assert.equal(result.queued.length, 1);
  assert.equal(fixture.state.pendingAbility.triggerControllerPlayerId, "guest");
  assert.equal(fixture.state.pendingAbility.instance.uid, fixture.source.uid);
  assert.equal(fixture.state.pendingAbility.ability.canDecline, true);
  assert.equal(response(fixture, "auth-guest", true).ok, true);
  assert.equal(fixture.source.hollowed, true);
  assert.equal(fixture.source.hollowedExpiry, "guest");
  assert.equal(fixture.other.hollowed, false);
  assert.equal(fixture.other.hollowedExpiry, undefined);
});

test("host and joining player receive independent Hollow decisions for their own source", () => {
  const host = setup({ cardId: "cfa-3553", controllerSide: "human" });
  assert.equal(discover(host).queued.length, 1);
  assert.equal(host.state.pendingAbility.triggerControllerPlayerId, "host");
  const guestCannotAnswer = response(host, "auth-guest", true, "wrong-owner");
  assert.equal(guestCannotAnswer.ok, false);
  assert.equal(guestCannotAnswer.reason, "source-not-controlled");
  assert.equal(host.source.hollowed, undefined);
  assert.equal(response(host, "auth-host", true, "host-accept").ok, true);
  assert.equal(host.source.hollowedExpiry, "host");
});

test("declining optional Hollow leaves the source unchanged, including keyword-only AUTO text", () => {
  const fixture = setup({ cardId: "cfa-3937" });
  assert.equal(fixture.ability.printedText, "AUTO: Hollow.");
  assert.equal(discover(fixture).queued.length, 1);
  assert.equal(fixture.state.pendingAbility.ability.canDecline, true);
  const result = response(fixture, "auth-guest", false, "decline-hollow");
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.source.hollowed, undefined);
  assert.equal(fixture.source.hollowedExpiry, undefined);
  assert.equal(fixture.state.pendingAbility, null);
});

test("unrelated placement, Vanguard placement, and a missing source cannot trigger Hollow", () => {
  const wrongSubject = setup();
  const otherEvent = placementEvent(wrongSubject, wrongSubject.other.uid, "rear-right");
  assert.equal(discover(wrongSubject, otherEvent).queued.length, 0);

  const wrongCircle = setup();
  const vanguardEvent = placementEvent(wrongCircle, wrongCircle.source.uid, "vanguard");
  assert.equal(discover(wrongCircle, vanguardEvent).queued.length, 0);

  const stale = setup();
  assert.equal(discover(stale).queued.length, 1);
  stale.state.players.bot.rear[0] = null;
  const before = JSON.stringify(stale.state);
  const result = response(stale, "auth-guest", true, "source-left-rc");
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(stale.state), before);
});

test("turn-end cleanup retires only units hollowed for the ending controller and emits standard retire events", () => {
  const fixture = setup({ controllerSide: "bot" });
  const expiredHost = unit(card("cfa-3"), "host-expired", "host", { circle: "rear-left", hollowed: true, hollowedExpiry: "guest" });
  const currentHostHollow = unit(card("cfa-3"), "host-current-turn", "host", { circle: "rear-right", hollowed: true, hollowedExpiry: "host" });
  fixture.state.players.human.rear = [expiredHost, currentHostHollow];
  fixture.source.hollowed = true;
  fixture.source.hollowedExpiry = "guest";
  fixture.other.hollowed = false;
  fixture.state.pendingTurnEnd = { side: "bot", playerId: "guest", turn: fixture.state.turn, cleanupQueued: false };
  const events = Reducer.continueTurnEnd(fixture.state, Engine);
  assert.deepEqual(events.filter(event => event.type === "card.retired").map(event => event.cardInstanceId).sort(), [expiredHost.uid, fixture.source.uid].sort());
  assert.equal(fixture.state.players.bot.rear[0], null);
  assert.ok(fixture.state.players.bot.drop.some(instance => instance.uid === fixture.source.uid));
  assert.ok(fixture.state.players.human.drop.some(instance => instance.uid === expiredHost.uid));
  assert.equal(fixture.state.players.human.rear[1], currentHostHollow);
  assert.equal(fixture.state.players.bot.rear[1], fixture.other);
  assert.ok(events.filter(event => event.type === "card.retired").every(event => event.timingWindow === "turn-end-cleanup"));
});

test("invalid source location or hollow metadata rejects before any state is changed", () => {
  const wrongCircle = setup();
  assert.equal(discover(wrongCircle).queued.length, 1);
  wrongCircle.state.players.bot.rear[0] = null;
  wrongCircle.state.players.bot.vanguard = wrongCircle.source;
  const before = JSON.stringify(wrongCircle.state);
  const result = response(wrongCircle, "auth-guest", true, "moved-to-vanguard");
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(wrongCircle.state), before);
});
