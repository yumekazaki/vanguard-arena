"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(cardId) {
  const found = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(found, `catalog card ${cardId} exists`);
  return found;
}

function instance(definition, uid, playerId, circle = null) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId,
    ...(circle ? { circle, zone: circle === "vanguard" ? "vanguard" : "rear-guard" } : {}) };
}

function setup({ ownerSide = "bot", subjectCircle = "rear-back-left", sourceCardId = "cfa-3002" } = {}) {
  const ownerPlayerId = ownerSide === "human" ? "host" : "guest";
  const sourceDefinition = card(sourceCardId);
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.definition?.source?.patternId === "auto-harmony-same-column-association-v1");
  assert.ok(ability, `${sourceCardId} has a reviewed Harmony ability`);
  assert.ok(Engine.getReviewedAbilityDefinitionsForCard(sourceDefinition.id).some(item => item.id === ability.id), `${ability.id} is trusted in production`);
  const sourceCircle = "rear-left";
  const source = instance(sourceDefinition, `${ownerSide}-harmony-source`, ownerPlayerId, sourceCircle);
  const subject = instance(card("cfa-3"), `${ownerSide}-placed-copy`, ownerPlayerId, subjectCircle);
  const ownerPlayer = { playerId: ownerPlayerId, vanguard: instance(card("cfa-3"), `${ownerSide}-vg`, ownerPlayerId, "vanguard"),
    rear: [sourceCircle === "rear-left" ? source : null, null, subjectCircle === "rear-back-left" ? subject : null,
      subjectCircle === "rear-back-center" ? subject : null, subjectCircle === "rear-back-right" ? subject : null],
    hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponentId = ownerSide === "human" ? "guest" : "host";
  const opponent = { playerId: opponentId, vanguard: instance(card("cfa-3"), `${opponentId}-vg`, opponentId, "vanguard"),
    rear: [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = ownerSide === "human" ? { human: ownerPlayer, bot: opponent } : { human: opponent, bot: ownerPlayer };
  const state = { matchId: "harmony-association-server", stateVersion: 1, turn: 4, side: "human", phase: 2,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], harmonyAssociations: [], players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerPlayerId,
    turnPlayerId: players[state.side].playerId, sourceCardInstanceId: subject.uid,
    sourceOwnerPlayerId: ownerPlayerId, sourceControllerPlayerId: ownerPlayerId, cardInstanceId: subject.uid,
    subjectCardInstanceId: subject.uid, subjectOwnerPlayerId: ownerPlayerId, subjectControllerPlayerId: ownerPlayerId,
    previousLocation: "hand", currentLocation: subjectCircle, timingWindow: "call" });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, source, subject, ability, event, ownerSide, ownerPlayerId, discovery };
}

function resolve(fixture, actionId = "resolve-harmony") {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: fixture.ownerSide === "human" ? "auth-host" : "auth-guest",
    actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: [], discard: [], reveal: [] }
    } }
  }, seats, Engine);
}

test("only the exact 47 reviewed Harmony records receive trusted association support", () => {
  const records = [];
  for (const item of catalog) for (const ability of Engine.parseCardAbilitiesCached(item)) {
    if (ability.definition?.source?.patternId === "auto-harmony-same-column-association-v1") records.push(ability);
  }
  assert.equal(records.length, 47);
  assert.equal(Reducer.supportsServerEffectOperation("associate-harmony-units"), false,
    "Harmony is supported only as the exact reviewed ability, never as a generic operation");
  assert.ok(records.every(ability => Reducer.supportsServerAbilityEffects(ability)));
  const tampered = structuredClone(records[0]);
  tampered.definition.effects[0].duration = "battle";
  assert.equal(Reducer.supportsServerAbilityEffects(tampered), false);
  const unrelated = { ...structuredClone(records[0]), cardId: "not-a-reviewed-harmony-card",
    definition: { ...structuredClone(records[0].definition), cardId: "not-a-reviewed-harmony-card" } };
  assert.equal(Reducer.supportsServerAbilityEffects(unrelated), false);
});

test("host and joining player's exact Harmony source associate with the exact same-column placed unit", () => {
  for (const ownerSide of ["human", "bot"]) {
    const fixture = setup({ ownerSide });
    assert.equal(fixture.discovery.queued.length, 1);
    assert.equal(fixture.state.pendingAbility?.instance.uid, fixture.source.uid);
    assert.equal(fixture.state.pendingAbility?.triggerControllerPlayerId, fixture.ownerPlayerId);
    assert.equal(fixture.state.pendingAbility?.eventContext.eventSubjectUid, fixture.subject.uid);
    assert.equal(fixture.state.pendingAbility?.eventContext.harmonySameColumnAtTrigger, true);
    assert.equal(fixture.state.pendingAbility?.eventContext.harmonyTurnKey, "4:human");

    // Existing Harmony semantics preserve the trigger even if the units move to
    // different columns before resolution, as long as both remain in play.
    fixture.source.circle = "rear-right";
    const result = resolve(fixture, `resolve-harmony-${ownerSide}`);
    assert.equal(result.ok, true, result.reason);
    assert.equal(fixture.state.harmonyAssociations.length, 1);
    assert.deepEqual(fixture.state.harmonyAssociations[0], {
      firstUid: fixture.source.uid, secondUid: fixture.subject.uid,
      controllerPlayerId: fixture.ownerPlayerId, turnKey: "4:human"
    });
    assert.equal(Engine.isCardInHarmony(fixture.state, fixture.source.uid, "4:human"), true);
    assert.equal(Engine.isCardInHarmony(fixture.state, fixture.subject.uid, "4:human"), true);
    assert.deepEqual(result.events.filter(event => event.type === "unit.became_harmony").map(event => event.cardInstanceId).sort(),
      [fixture.source.uid, fixture.subject.uid].sort());
  }
});

test("Harmony does not trigger for another column, another controller, the source itself, or a mismatched event subject", () => {
  const wrongColumn = setup({ subjectCircle: "rear-back-right" });
  assert.equal(wrongColumn.discovery.queued.length, 0);
  assert.equal(wrongColumn.state.pendingAbility ?? null, null);

  const otherController = setup();
  const opponent = otherController.state.players.human;
  const subject = otherController.state.players.bot.rear[2];
  otherController.state.players.bot.rear[2] = null;
  subject.ownerPlayerId = opponent.playerId; subject.controllerPlayerId = opponent.playerId; subject.circle = "rear-back-left";
  opponent.rear[2] = subject;
  const before = otherController.discovery.queued.length;
  const foreignEvent = Engine.createGameEvent(otherController.state, { type: "card.placed", actingPlayerId: opponent.playerId,
    turnPlayerId: otherController.state.players.human.playerId, cardInstanceId: subject.uid, subjectCardInstanceId: subject.uid,
    subjectOwnerPlayerId: opponent.playerId, subjectControllerPlayerId: opponent.playerId, previousLocation: "hand",
    currentLocation: "rear-back-left" });
  assert.equal(Reducer.discoverAutoTriggers(otherController.state, [foreignEvent], Engine).queued.length, 0);
  assert.equal(before, 1, "fixture first queued the legitimate placement before mutating ownership");

  const self = setup();
  self.state.players.bot.rear[2] = self.source;
  self.state.players.bot.rear[0] = null;
  const selfEvent = Engine.createGameEvent(self.state, { type: "card.placed", actingPlayerId: self.ownerPlayerId,
    turnPlayerId: self.state.players.human.playerId, cardInstanceId: self.source.uid, subjectCardInstanceId: self.source.uid,
    subjectControllerPlayerId: self.ownerPlayerId, previousLocation: "hand", currentLocation: "rear-back-left" });
  assert.equal(Reducer.discoverAutoTriggers(self.state, [selfEvent], Engine).queued.length, 0);

  const mismatched = setup();
  const wrongSubjectEvent = Engine.createGameEvent(mismatched.state, { type: "card.placed", actingPlayerId: mismatched.ownerPlayerId,
    turnPlayerId: mismatched.state.players.human.playerId, cardInstanceId: mismatched.subject.uid,
    subjectCardInstanceId: mismatched.source.uid, subjectControllerPlayerId: mismatched.ownerPlayerId,
    previousLocation: "hand", currentLocation: "rear-back-left" });
  assert.equal(Reducer.discoverAutoTriggers(mismatched.state, [wrongSubjectEvent], Engine).queued.length, 0);
});

test("associations remain across lane changes, are removed when a unit leaves play, and expire at end of turn", () => {
  const fixture = setup();
  const turnKey = fixture.state.pendingAbility.eventContext.harmonyTurnKey;
  assert.equal(Engine.createHarmonyAssociation(fixture.state, fixture.source.uid, fixture.subject.uid, turnKey), true);
  fixture.state.players.bot.rear[0] = null;
  fixture.state.players.bot.rear[1] = fixture.source;
  fixture.source.circle = "rear-right";
  assert.equal(Engine.isCardInHarmony(fixture.state, fixture.subject.uid, turnKey), true,
    "a lane move does not end a valid in-play association");

  fixture.state.players.bot.rear[1] = null;
  fixture.state.players.bot.soul.push(fixture.source);
  const leaveEvent = Engine.createGameEvent(fixture.state, { type: "card.moved", actingPlayerId: fixture.ownerPlayerId,
    turnPlayerId: fixture.state.players.human.playerId, cardInstanceId: fixture.source.uid, subjectCardInstanceId: fixture.source.uid,
    subjectControllerPlayerId: fixture.ownerPlayerId, previousLocation: "rear-right", currentLocation: "soul" });
  Reducer.discoverAutoTriggers(fixture.state, [leaveEvent], Engine);
  assert.equal(Engine.isCardInHarmony(fixture.state, fixture.subject.uid, turnKey), false,
    "the reducer removes association when an associated unit leaves the field");

  const ending = setup();
  const endingKey = ending.state.pendingAbility.eventContext.harmonyTurnKey;
  assert.equal(Engine.createHarmonyAssociation(ending.state, ending.source.uid, ending.subject.uid, endingKey), true);
  ending.state.pendingAbility = null; ending.state.pendingAbilities = [];
  ending.state.pendingTurnEnd = { playerId: "host", side: "human", turn: 4, cleanupQueued: true };
  Reducer.continueTurnEnd(ending.state, Engine);
  assert.equal(Engine.isCardInHarmony(ending.state, ending.source.uid, endingKey), false,
    "server turn-end processing expires the active turn's Harmony links");
});

test("a host cannot resolve the joining player's queued Harmony association", () => {
  const fixture = setup({ ownerSide: "bot" });
  const before = JSON.stringify(fixture.state);
  const result = Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: "auth-host", actionId: "host-forges-guest-harmony", expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: [], discard: [], reveal: [] }
    } }
  }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "source-not-controlled");
  assert.equal(JSON.stringify(fixture.state), before);
});
