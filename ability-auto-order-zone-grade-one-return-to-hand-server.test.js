"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PATTERN = "auto-order-zone-grade-one-placement-return-source-hand-v1";
const SOURCE_IDS = ["cfa-12298", "cfa-12299", "cfa-12312"];
const PLACED_GRADE_ONE_ID = "cfa-7525";
const GRADE_TWO_ID = "cfa-7351";

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(definition, `catalog card ${cardId}`);
  return { uid, cardId: String(cardId), cardName: definition.name, type: definition.type, grade: definition.grade,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function emptyPlayer(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], deck: [], bind: [],
    orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
}
function fixture(sourceCardId = SOURCE_IDS[1], side = "human", options = {}) {
  const otherSide = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const otherId = otherSide === "human" ? "host-player" : "guest-player";
  const sourceDefinition = catalog.find(item => String(item.id) === sourceCardId);
  assert.equal(Number(sourceDefinition?.grade), 1, `${sourceCardId} is a grade 1 source`);
  const source = card(sourceCardId, `order-source-${side}`, ownerId, { zone: "order", circle: "order" });
  const subjectId = options.subjectCardId || PLACED_GRADE_ONE_ID;
  const subject = options.sameCard ? source : card(subjectId, `placed-card-${side}`, options.subjectSide ? (options.subjectSide === "human" ? "host-player" : "guest-player") : ownerId, { zone: "order", circle: "order" });
  const players = { human: emptyPlayer("host-player"), bot: emptyPlayer("guest-player") };
  players[side].orders = options.sameCard ? [source] : [source, subject];
  players[side].vanguard = card("cfa-3", `vanguard-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  players[otherSide].vanguard = card("cfa-3", `vanguard-${otherSide}`, otherId, { zone: "vanguard", circle: "vanguard" });
  if (options.subjectSide) {
    players[side].orders = [source];
    players[options.subjectSide].orders.push(subject);
  }
  const state = { matchId: "order-grade-one-return", stateVersion: 7, turn: 3, phase: "main", side: otherSide,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [],
    pendingAbility: null, pendingTrigger: null, players };
  const actionSource = players[otherSide].vanguard;
  const event = Engine.createGameEvent(state, {
    eventId: `place-order-${side}-${sourceCardId}-${options.subjectCardId || "grade-one"}`,
    type: options.eventType || "card.placed", actingPlayerId: options.actorPlayerId || otherId,
    turnPlayerId: otherId, sourceCardInstanceId: actionSource.uid, sourceOwnerPlayerId: actionSource.ownerPlayerId,
    sourceControllerPlayerId: actionSource.controllerPlayerId, cardInstanceId: subject.uid, subjectCardInstanceId: subject.uid,
    subjectOwnerPlayerId: subject.ownerPlayerId, subjectControllerPlayerId: subject.controllerPlayerId,
    subjectCardGrade: options.claimedSubjectGrade ?? Number(catalog.find(item => String(item.id) === String(subject.cardId))?.grade),
    previousLocation: options.previousLocation || "hand", currentLocation: options.currentLocation || "order", circle: options.circle || "order",
    phase: "main", timingWindow: "order-zone-placement"
  });
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${sourceCardId} has the compiled ability`);
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, event, ability, source, subject, side, otherSide, ownerId, otherId, discovered };
}
function respond(f, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, accept = true) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth, actionId: `resolve-${f.side}-${f.source.cardId}-${f.event.eventId}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

test("the exact three catalog abilities use a trusted mandatory Order Zone return handler", () => {
  for (const cardId of SOURCE_IDS) {
    const definition = catalog.find(item => String(item.id) === cardId);
    const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.definition?.source?.patternId === PATTERN);
    assert.ok(ability, cardId);
    assert.equal(ability.id, `${cardId}:${cardId === "cfa-12298" ? 3 : 1}`);
    assert.equal(ability.kind, "AUTO");
    assert.deepEqual(ability.requiredLocation, ["order"]);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.conditions, [{ type: "event-subject-grade-equals", count: 1 }]);
    assert.equal(ability.effects[0].op, "move-source-order-to-hand");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    assert.equal(Reducer.supportsServerAbilityEffects({ ...ability, definition: { ...ability.definition, printedText: "different text" } }), false);
  }
});

test("host and joining player each resolve only their own Order Zone source", () => {
  for (const side of ["human", "bot"]) for (const sourceId of SOURCE_IDS) {
    const f = fixture(sourceId, side);
    assert.equal(f.discovered.queued.length, 1, `${side}/${sourceId}: ${JSON.stringify(f.discovered)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    assert.equal(f.state.pendingAbility.eventContext.gameEvent.subjectCardInstanceId, f.subject.uid);
    const result = respond(f);
    assert.equal(result.ok, true, `${side}/${sourceId}: ${result.reason}`);
    assert.deepEqual(f.state.players[side].hand.map(item => item.uid), [f.source.uid]);
    assert.equal(f.state.players[side].orders.some(item => item.uid === f.source.uid), false);
    assert.equal(f.state.players[side].orders.some(item => item.uid === f.subject.uid), true);
    assert.equal(f.state.players[f.otherSide].hand.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.moved"]);
    assert.equal(result.events[0].cardInstanceId, f.source.uid);
    assert.equal(result.events[0].previousLocation, "order");
    assert.equal(result.events[0].currentLocation, "hand");
  }
});

test("the placed grade 1 may be another unit or Order Zone card and its acting player is not a trigger restriction", () => {
  const f = fixture(SOURCE_IDS[1], "human", { actorPlayerId: "guest-player" });
  assert.equal(f.discovered.queued.length, 1);
  assert.equal(respond(f).ok, true);
  const self = fixture(SOURCE_IDS[0], "bot", { sameCard: true });
  assert.equal(self.discovered.queued.length, 1, "placing the source itself qualifies");
  assert.equal(respond(self).ok, true);
});

test("wrong grade, controller, destination, previous zone, event type, or claimed grade cannot queue the ability", () => {
  const cases = [
    { subjectCardId: GRADE_TWO_ID },
    { subjectSide: "bot" },
    { currentLocation: "rear-left", circle: "rear-left" },
    { previousLocation: "order" },
    { eventType: "card.moved" },
    { claimedSubjectGrade: 2 }
  ];
  for (const options of cases) {
    const f = fixture(SOURCE_IDS[1], "human", options);
    assert.equal(f.discovered.queued.length, 0, JSON.stringify(options));
  }
});

test("duplicate placement events queue once, and the opponent cannot resolve the controller's prompt", () => {
  const f = fixture(SOURCE_IDS[1], "bot");
  f.state.pendingAbility = null;
  f.state.pendingAbilities = [];
  f.state.processedAbilityTriggers = [];
  const duplicate = Reducer.discoverAutoTriggers(f.state, [f.event, f.event], Engine);
  assert.equal(duplicate.queued.length, 1);
  assert.equal(respond(f, seats.hostAuthUid).ok, false);
  assert.equal(respond(f).ok, true);
});

test("a stale source is rejected without moving the placed card or partially resolving", () => {
  const f = fixture(SOURCE_IDS[1], "human");
  assert.equal(f.discovered.queued.length, 1);
  f.state.players.human.orders = f.state.players.human.orders.filter(item => item.uid !== f.source.uid);
  f.state.players.human.hand.push(f.source);
  const before = f.state.players.human.hand.map(item => item.uid);
  const result = respond(f);
  assert.equal(result.ok, false);
  assert.deepEqual(f.state.players.human.hand.map(item => item.uid), before);
  assert.equal(f.state.players.human.orders.some(item => item.uid === f.subject.uid), true);
});

test("the mandatory effect cannot be declined", () => {
  const f = fixture(SOURCE_IDS[1], "human");
  assert.equal(f.discovered.queued.length, 1);
  assert.equal(respond(f, seats.hostAuthUid, false).ok, false);
  assert.equal(f.state.players.human.orders.some(item => item.uid === f.source.uid), true);
});
