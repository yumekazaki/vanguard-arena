"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const FAMILY = "auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1";
const IDS = ["cfa-10635", "cfa-10636", "cfa-10758", "cfa-10760", "cfa-10863", "cfa-10864", "cfa-10926", "cfa-10927", "cfa-11050", "cfa-11051", "cfa-11264", "cfa-11265", "cfa-11584", "cfa-11585", "cfa-11902", "cfa-11903", "cfa-12024", "cfa-12025", "cfa-12170", "cfa-12171", "cfa-12209", "cfa-12210"];

function card(cardId) {
  const found = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(found, `catalog card ${cardId} exists`);
  return found;
}

function instance(definition, uid, playerId, overrides = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade), clan: definition.clan, clans: definition.clans,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function setup({ ownerSide = "bot", sourceCardId = IDS[0], vanguardGrade = 1, deck = null } = {}) {
  const sourceDef = card(sourceCardId);
  const ability = Engine.parseCardAbilitiesCached(sourceDef).find(item => item.definition?.source?.patternId === FAMILY);
  assert.ok(ability, `${sourceCardId} is in the reviewed Ride Phase family`);
  const ownerId = ownerSide === "human" ? "host" : "guest";
  const opponentSide = ownerSide === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "host" : "guest";
  const source = instance(sourceDef, `${ownerSide}-hand-source`, ownerId);
  const defaultCandidate = instance(card("cfa-2"), `${ownerSide}-grade2-candidate`, ownerId, { grade: 2, type: "Unit" });
  const owner = { playerId: ownerId, vanguard: instance(card("cfa-3"), `${ownerSide}-vg`, ownerId, { grade: vanguardGrade, unitCard: true }),
    rear: [null, null, null, null, null], hand: [source], soul: [], drop: [], deck: deck || [instance(card("cfa-3"), `${ownerSide}-grade3-bottom`, ownerId, { grade: 3, type: "Unit" }), defaultCandidate],
    damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: instance(card("cfa-3"), `${opponentSide}-vg`, opponentId, { grade: 3, unitCard: true }),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: "hand-ride-phase-search", stateVersion: 5, processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], turn: 2,
    side: ownerSide, phase: 2, players: ownerSide === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner } };
  return { state, source, ability, owner, ownerSide, ownerId, opponentSide, opponentId };
}

function phaseEvent(fixture, overrides = {}) {
  return Engine.createGameEvent(fixture.state, { type: "phase.changed", actingPlayerId: fixture.ownerId,
    turnPlayerId: fixture.ownerId, phase: "ride", timingWindow: "phase-start", before: { phase: "draw" },
    after: { phase: "ride" }, ...overrides });
}

function discover(fixture, event = phaseEvent(fixture)) {
  const result = Reducer.discoverAutoTriggers(fixture.state, [event], Engine);
  return { ...result, event };
}

function decide(fixture, selection = {}, { auth = fixture.ownerSide === "human" ? "auth-host" : "auth-guest", actionId = "resolve-hand-ride-search" } = {}) {
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: auth, actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid,
      abilityId: fixture.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] }, ...selection } }
  }, seats, Engine);
}

test("only the exact 22 catalog definitions are registered and trusted; generic grade search remains unsupported", () => {
  const abilities = [];
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) {
    if (ability.definition?.source?.patternId === FAMILY) abilities.push(ability);
  }
  assert.equal(abilities.length, 22);
  assert.deepEqual(abilities.map(item => item.cardId).sort(), IDS.slice().sort());
  assert.ok(abilities.every(item => Reducer.supportsServerAbilityEffects(item)));
  assert.ok(IDS.every(id => Engine.getReviewedAbilityDefinitionsForCard(id).some(item => item.source?.patternId === FAMILY)),
    "all 22 catalog-compiled definitions are in the trusted static registry");
  assert.equal(Reducer.supportsServerEffectOperation("search-top-up-to-one-grade-to-hand"), false);
  const tampered = structuredClone(abilities[0]);
  tampered.definition.effects[0].maximumGrade = 3;
  assert.equal(Reducer.supportsServerAbilityEffects(tampered), false);
});

test("Ride Phase prompt belongs to each source in that controller's hand, independent of the ridden card", () => {
  for (const ownerSide of ["human", "bot"]) {
    const fixture = setup({ ownerSide });
    const event = phaseEvent(fixture, { sourceCardInstanceId: `${fixture.ownerSide}-different-rider`,
      subjectCardInstanceId: `${fixture.ownerSide}-different-rider`, cardInstanceId: `${fixture.ownerSide}-different-rider` });
    const result = discover(fixture, event);
    assert.equal(result.queued.length, 1);
    assert.equal(fixture.state.pendingAbility.instance.uid, fixture.source.uid);
    assert.equal(fixture.state.pendingAbility.triggerControllerPlayerId, fixture.ownerId);
    assert.equal(fixture.state.pendingAbility.eventContext.gameEvent.eventId, event.eventId);
  }

  const unrelatedRide = setup({ ownerSide: "bot" });
  const rideEvent = Engine.createGameEvent(unrelatedRide.state, { type: "card.ridden", actingPlayerId: unrelatedRide.ownerId,
    turnPlayerId: unrelatedRide.ownerId, sourceCardInstanceId: unrelatedRide.source.uid,
    subjectCardInstanceId: unrelatedRide.source.uid, previousLocation: "hand", currentLocation: "vanguard", phase: "ride" });
  assert.equal(discover(unrelatedRide, rideEvent).queued.length, 0, "a ride action is not the Ride Phase start trigger");
});

test("matching trigger requires the controller's own Ride Phase start and Vanguard grade 1 or less", () => {
  const invalidEvents = [
    { phase: "main" },
    { timingWindow: "normal-ride" },
    { turnPlayerId: "host", actingPlayerId: "host" }
  ];
  for (const overrides of invalidEvents) {
    const fixture = setup({ ownerSide: "bot" });
    assert.equal(discover(fixture, phaseEvent(fixture, overrides)).queued.length, 0, JSON.stringify(overrides));
  }
  const highVanguard = setup({ ownerSide: "human", vanguardGrade: 2 });
  const event = phaseEvent(highVanguard);
  const first = discover(highVanguard, event);
  assert.equal(first.queued.length, 0);
  assert.ok(first.skipped.some(item => item.reason === "condition-not-met"));
  highVanguard.owner.vanguard.grade = 1;
  assert.equal(discover(highVanguard, event).queued.length, 0, "the old phase event cannot retroactively trigger after state changes");
});

test("source must remain in its exact controller hand at discovery and resolution", () => {
  const outOfHand = setup({ ownerSide: "bot" });
  outOfHand.owner.hand = [];
  outOfHand.owner.rear[0] = outOfHand.source;
  const notInHand = discover(outOfHand);
  assert.equal(notInHand.queued.length, 0);
  assert.ok(notInHand.skipped.some(item => item.reason === "source-not-in-hand"));

  const stale = setup({ ownerSide: "bot" });
  discover(stale);
  stale.owner.hand = [];
  stale.owner.rear[0] = stale.source;
  const before = JSON.stringify(stale.state);
  const result = decide(stale, {}, { actionId: "stale-source-after-prompt" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "ride-phase-source-or-event-invalid");
  assert.equal(JSON.stringify(stale.state), before, "stale source rejection is atomic");

  const staleCondition = setup({ ownerSide: "human", vanguardGrade: 1 });
  discover(staleCondition);
  staleCondition.owner.vanguard.grade = 2;
  const beforeCondition = JSON.stringify(staleCondition.state);
  const conditionResult = decide(staleCondition, {}, { actionId: "condition-changed-after-prompt" });
  assert.equal(conditionResult.ok, false);
  assert.equal(conditionResult.reason, "ride-phase-condition-no-longer-met");
  assert.equal(JSON.stringify(staleCondition.state), beforeCondition);
});

test("activation discards this exact source, searches only the top five for grade 2 or lower, and publicly reveals the choice", () => {
  for (const ownerSide of ["human", "bot"]) {
    const ownerId = ownerSide === "human" ? "host" : "guest";
    const lowOrder = instance(card("cfa-7351"), `${ownerSide}-grade2-order`, ownerId, { grade: 2, type: "Normal Order" });
    const grade3 = instance(card("cfa-98"), `${ownerSide}-grade3-top`, ownerId, { grade: 3, type: "Unit" });
    const fixture = setup({ ownerSide, deck: [lowOrder, grade3] });
    assert.equal(discover(fixture).queued.length, 1);
    const result = decide(fixture, { effectUid: lowOrder.uid }, { actionId: `resolve-selected-${ownerSide}` });
    assert.equal(result.ok, true, result.reason);
    assert.equal(fixture.owner.hand.some(item => item.uid === fixture.source.uid), false);
    assert.ok(fixture.owner.drop.some(item => item.uid === fixture.source.uid), "the ability pays by discarding its exact source");
    assert.ok(fixture.owner.hand.some(item => item.uid === lowOrder.uid), "grade-2 Normal Order is legal: text says card, not unit");
    assert.ok(fixture.owner.deck.some(item => item.uid === grade3.uid));
    const reveal = result.events.find(item => item.type === "card.revealed" && item.cardInstanceId === lowOrder.uid);
    assert.ok(reveal);
    assert.equal(reveal.previousLocation, "deck");
    assert.equal(reveal.currentLocation, "hand");
    assert.equal(reveal.revealedCardId, lowOrder.cardId);
    assert.equal(reveal.revealedCardName, lowOrder.cardName);
    assert.equal(reveal.revealedCardGrade, 2);
  }

  const outside = setup({ ownerSide: "bot", deck: [instance(card("cfa-2"), "below-top-five-grade2", "guest", { grade: 2 }),
    ...Array.from({ length: 5 }, (_, index) => instance(card("cfa-98"), `top-five-grade3-${index}`, "guest", { grade: 3 }))] });
  discover(outside);
  const before = JSON.stringify(outside.state);
  assert.equal(decide(outside, { effectUid: "below-top-five-grade2" }, { actionId: "reject-outside-top-five" }).ok, false);
  assert.equal(JSON.stringify(outside.state), before);

  const overGrade = setup({ ownerSide: "bot", deck: [instance(card("cfa-98"), "grade3-candidate", "guest", { grade: 3 })] });
  discover(overGrade);
  const beforeGrade = JSON.stringify(overGrade.state);
  assert.equal(decide(overGrade, { effectUid: "grade3-candidate" }, { actionId: "reject-grade3" }).ok, false);
  assert.equal(JSON.stringify(overGrade.state), beforeGrade);
});

test("up-to-one permits no search, shuffles the looked cards back, and still pays only the source discard", () => {
  const fixture = setup({ ownerSide: "bot" });
  const deck = fixture.owner.deck.map(item => item.uid);
  discover(fixture);
  const result = decide(fixture, { effectUid: null }, { actionId: "no-search-choice" });
  assert.equal(result.ok, true, result.reason);
  assert.ok(fixture.owner.drop.some(item => item.uid === fixture.source.uid));
  assert.deepEqual(fixture.owner.hand, []);
  assert.deepEqual(new Set(fixture.owner.deck.map(item => item.uid)), new Set(deck));
  assert.equal(result.events.some(item => item.type === "card.revealed"), false);
});

test("duplicate phase events, wrong seats, and duplicate actions cannot resolve the ability twice", () => {
  const fixture = setup({ ownerSide: "bot" });
  const event = phaseEvent(fixture);
  assert.equal(discover(fixture, event).queued.length, 1);
  assert.equal(discover(fixture, event).queued.length, 0);
  const before = JSON.stringify(fixture.state);
  assert.equal(decide(fixture, {}, { auth: "auth-host", actionId: "host-forges-guest-source" }).ok, false);
  assert.equal(JSON.stringify(fixture.state), before);
  const hostFixture = setup({ ownerSide: "human" });
  discover(hostFixture);
  const beforeHost = JSON.stringify(hostFixture.state);
  assert.equal(decide(hostFixture, {}, { auth: "auth-guest", actionId: "guest-forges-host-source" }).ok, false);
  assert.equal(JSON.stringify(hostFixture.state), beforeHost);
  const valid = decide(fixture, { effectUid: null }, { actionId: "once-only-resolution" });
  assert.equal(valid.ok, true, valid.reason);
  const duplicate = decide(fixture, { effectUid: null }, { actionId: "once-only-resolution" });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "duplicate-action");
});
