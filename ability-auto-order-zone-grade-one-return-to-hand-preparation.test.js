"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const { proposedDefinitions } = require("./ability-contributions/batch-ABILITY-76D8A0B8-0050.js");

const PATTERN = "auto-order-zone-grade-one-placement-return-source-hand-v1";
const PRINTED_TEXT = "AUTO [Order Zone]: When your grade 1 card is put into your order zone, put this card into your hand. (This effect is mandatory)";
const EXPECTED = new Map([
  ["cfa-12298:3", "cfa-12298"],
  ["cfa-12299:1", "cfa-12299"],
  ["cfa-12312:1", "cfa-12312"]
]);
const catalog = loadCatalog();
const definitionsById = new Map(proposedDefinitions.map(definition => [definition.id, definition]));

function card(uid, cardId, ownerPlayerId, controllerPlayerId, grade = 1) {
  return { uid, cardId, ownerPlayerId, controllerPlayerId, grade };
}

function fixture({ sourceSide = "human", subjectSide = sourceSide, grade = 1, destination = "order", previousLocation = "hand", sourceInOrder = true, sourceIsSubject = false, turnSide = "bot", actingSide = sourceSide } = {}) {
  const playerIds = { human: "host-player", bot: "guest-player" };
  const otherSide = sourceSide === "human" ? "bot" : "human";
  const ownerId = playerIds[sourceSide];
  const sourceId = "cfa-12299:1";
  const sourceCardId = EXPECTED.get(sourceId);
  const source = card("ability-source", sourceCardId, playerIds[otherSide], ownerId, 1);
  const subject = sourceIsSubject ? source : card("placed-card", "generic-grade-card", playerIds[subjectSide], playerIds[subjectSide], grade);
  const emptyPlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: emptyPlayer(playerIds.human), bot: emptyPlayer(playerIds.bot) };
  if (sourceInOrder) players[sourceSide].orders.push(source);
  else players[sourceSide].hand.push(source);
  if (!sourceIsSubject && destination === "order") players[subjectSide].orders.push(subject);
  else if (!sourceIsSubject && destination === "rear-left") players[subjectSide].rear[0] = subject;

  const state = { matchId: "order-grade-one-preparation", stateVersion: 1, eventSequence: 0, players };
  const definition = definitionsById.get(sourceId);
  const locatedSource = Engine.locateCardInstance(state, source.uid);
  const subjectControllerPlayerId = sourceIsSubject ? ownerId : playerIds[subjectSide];
  const event = Engine.createGameEvent(state, {
    type: "card.placed",
    actingPlayerId: playerIds[actingSide],
    turnPlayerId: playerIds[turnSide],
    sourceCardInstanceId: subject.uid,
    sourceOwnerPlayerId: subject.ownerPlayerId,
    sourceControllerPlayerId: subject.controllerPlayerId,
    cardInstanceId: subject.uid,
    subjectCardInstanceId: subject.uid,
    subjectOwnerPlayerId: subject.ownerPlayerId,
    subjectControllerPlayerId,
    subjectCardGrade: grade,
    previousLocation,
    currentLocation: destination,
    circle: destination,
    phase: "main",
    timingWindow: "effect-order-zone-placement"
  });

  return {
    state,
    definition,
    source,
    subject,
    locatedSource,
    event,
    sourceControllerPlayerId: ownerId,
    subjectZone: destination
  };
}

function isEligible(f) {
  return Boolean(f.locatedSource && !f.locatedSource.ambiguous &&
    Engine.eventMatchesAbilityTrigger(
      f.definition,
      "place",
      f.event,
      f.source.uid,
      f.locatedSource.zone,
      f.subjectZone,
      f.locatedSource.controllerPlayerId
    ) &&
    Engine.evaluateAbilityConditions(f.definition, {
      eventSubjectGrade: f.event.subjectCardGrade
    }));
}

test("the three registered abilities have identical exact text and retain separate card abilities", () => {
  assert.equal(definitionsById.size, EXPECTED.size);
  for (const [abilityId, cardId] of EXPECTED) {
    const definition = definitionsById.get(abilityId);
    assert.ok(definition, abilityId);
    assert.equal(definition.cardId, cardId);
    assert.equal(definition.kind, "AUTO");
    assert.equal(definition.printedText, PRINTED_TEXT);
    assert.equal(definition.source.patternId, PATTERN);
    assert.deepEqual(definition.requiredLocation, ["order"]);
    assert.deepEqual(definition.trigger.circles, ["order"]);
    assert.equal(definition.trigger.destinationLocation, "order");
    assert.equal(definition.trigger.subjectControllerRelation, "source-controller");
    assert.deepEqual(definition.conditions, [{ type: "event-subject-grade-equals", count: 1 }]);
    assert.equal(definition.optional, false);
    assert.equal(definition.canDecline, false);
    assert.deepEqual(definition.effects, [{ op: "move-source-order-to-hand", target: "source", from: "order" }]);

    const cardDefinition = catalog.find(cardData => String(cardData.id) === cardId);
    assert.ok(cardDefinition, `catalog contains ${cardId}`);
    assert.equal(Number(cardDefinition.grade), 1, `${cardId} is grade 1`);
    const parsed = Engine.parseCardAbilitiesCached(cardDefinition);
    assert.equal(parsed.find(ability => ability.id === abilityId)?.printedText, PRINTED_TEXT, `${abilityId} exact catalog text`);
    assert.ok(parsed.length > 1, `${cardId} retains its other printed abilities independently`);
  }
});

test("matching Order Zone placement is eligible for either seat and is independent of turn player", () => {
  for (const sourceSide of ["human", "bot"]) {
    const f = fixture({ sourceSide, subjectSide: sourceSide, turnSide: sourceSide === "human" ? "bot" : "human" });
    assert.equal(f.locatedSource.zone, "order");
    assert.equal(f.locatedSource.instance.uid, f.source.uid);
    assert.equal(f.event.turnPlayerId, sourceSide === "human" ? "guest-player" : "host-player");
    assert.equal(isEligible(f), true, sourceSide);
  }
});

test("placement by an opponent still qualifies when the placed card is controlled by the source player", () => {
  const f = fixture({ sourceSide: "human", subjectSide: "human", actingSide: "bot", turnSide: "bot", previousLocation: "drop" });
  assert.equal(f.event.actingPlayerId, "guest-player");
  assert.equal(f.event.subjectControllerPlayerId, "host-player");
  assert.equal(f.locatedSource.controllerPlayerId, "host-player");
  assert.equal(isEligible(f), true);
});

test("a grade 1 source placed into Order Zone can satisfy its own trigger", () => {
  const f = fixture({ sourceIsSubject: true, previousLocation: "rear-left", turnSide: "bot" });
  assert.equal(f.event.subjectCardInstanceId, f.source.uid);
  assert.equal(f.locatedSource.zone, "order");
  assert.equal(isEligible(f), true);
});

test("grade, destination, source location, and event type are strict eligibility requirements", () => {
  const wrongGrade = fixture({ grade: 2 });
  assert.equal(Engine.eventMatchesAbilityTrigger(wrongGrade.definition, "place", wrongGrade.event, wrongGrade.source.uid, "order", "order", wrongGrade.sourceControllerPlayerId), true);
  assert.equal(Engine.evaluateAbilityConditions(wrongGrade.definition, { eventSubjectGrade: 2 }), false);
  assert.equal(isEligible(wrongGrade), false);

  const wrongDestination = fixture({ destination: "rear-left" });
  assert.equal(isEligible(wrongDestination), false);

  const sourceElsewhere = fixture({ sourceInOrder: false });
  assert.equal(sourceElsewhere.locatedSource.zone, "hand");
  assert.equal(isEligible(sourceElsewhere), false);

  const wrongEvent = fixture();
  assert.equal(isEligible({ ...wrongEvent, event: Object.freeze({ ...wrongEvent.event, type: "card.drawn" }) }), false);
});

test("a placement controlled by the opponent does not satisfy 'your grade 1 card'", () => {
  const f = fixture({ sourceSide: "human", subjectSide: "bot" });
  assert.equal(f.event.subjectControllerPlayerId, "guest-player");
  assert.equal(f.locatedSource.controllerPlayerId, "host-player");
  assert.equal(isEligible(f), false);
});

test("the data proposal specifies mandatory Order Zone-to-hand movement without resolving it", () => {
  for (const definition of proposedDefinitions) {
    assert.equal(definition.optional, false);
    assert.equal(definition.canDecline, false);
    assert.equal(definition.effects[0].target, "source");
    assert.equal(definition.effects[0].from, "order");
    assert.equal(definition.effects[0].op, "move-source-order-to-hand");
  }
});
