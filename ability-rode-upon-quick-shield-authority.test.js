"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Definitions = require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-rode-upon-draw-quick-shield-v1";
const TEXT = "AUTO: When rode upon, draw a card. Then, if your opponent’s vanguard is grade 1 or greater, put a Quick Shield ticket into your hand.";
const ABILITY_ID = cardId => `${cardId}:0`;

function makeState({ side = "bot", opponentGrade = 1, sourceCardId = "cfa-5673", eventTarget = "old-vanguard", eventType = "card.ridden", sourcePreviousLocation = "vanguard", actionId = "ride-response-1" } = {}) {
  const actorPlayerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentPlayerId = opponentSide === "human" ? "host-player" : "guest-player";
  const oldVanguard = { uid: "old-vanguard", cardId: sourceCardId, cardName: "Lizard Runner, Undeux", grade: 0, unitCard: true, type: "Unit", ownerPlayerId: actorPlayerId, controllerPlayerId: actorPlayerId };
  const rider = { uid: "new-rider", cardId: "test-rider", cardName: "Test Rider", grade: 1, unitCard: true, type: "Unit", ownerPlayerId: actorPlayerId, controllerPlayerId: actorPlayerId };
  const makePlayer = (playerId, vanguard) => ({ playerId, vanguard, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck: [], gZone: [], removed: [], quickShields: 0 });
  const players = {
    human: makePlayer("host-player", side === "human" ? rider : { uid: "opp-vg", cardId: "opp-vg-card", grade: opponentGrade, type: "Unit", unitCard: true, ownerPlayerId: "host-player", controllerPlayerId: "host-player" }),
    bot: makePlayer("guest-player", side === "bot" ? rider : { uid: "opp-vg", cardId: "opp-vg-card", grade: opponentGrade, type: "Unit", unitCard: true, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" }),
  };
  players[side].soul.push(oldVanguard);
  players[side].deck.push({ uid: "draw-top", cardId: "normal-card", ownerPlayerId: actorPlayerId, controllerPlayerId: actorPlayerId });
  const state = { matchId: "quick-shield-match", stateVersion: 8, processedActionIds: [], eventSequence: 0, side, phase: 2, turn: 1, players, pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingTurnEnd: null };
  const rideEvent = Engine.createGameEvent(state, {
    eventId: "ride-event-1", type: eventType, actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: actorPlayerId, sourceControllerPlayerId: actorPlayerId,
    subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: actorPlayerId, subjectControllerPlayerId: actorPlayerId,
    targetCardInstanceIds: [eventTarget], targetPreviousLocation: sourcePreviousLocation,
    targetCurrentLocation: "soul", targetLocation: "vanguard", previousLocation: "hand", currentLocation: "vanguard",
    phase: "ride", timingWindow: "normal-ride",
  });
  const discovery = Reducer.discoverAutoTriggers(state, [rideEvent], Engine);
  return { state, rideEvent, discovery, oldVanguard, rider, side, actorPlayerId, opponentPlayerId, actionId };
}

function answerPending(fixture, { actionId = fixture.actionId, actorAuthUid = fixture.side === "human" ? "auth-host" : "auth-guest", accept = true } = {}) {
  const pending = fixture.state.pendingAbility;
  assert.ok(pending, "expected server-owned pending ability");
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { accept, selection: { instanceUid: pending.instance.uid, abilityId: pending.ability.id } },
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
}

function uidFor(matchId, actionId, eventId, sourceUid) {
  const value = `${matchId}\u0000${actionId}\u0000${eventId}\u0000${sourceUid}`;
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < value.length; i++) { hash ^= BigInt(value.charCodeAt(i)); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return `token-quick-shield-${hash.toString(16).padStart(16, "0")}`;
}

test("all 115 catalog abilities are registered with exact original text and the correct ridden-event target", () => {
  const family = Definitions.filter(definition => definition.source?.patternId === PATTERN);
  assert.equal(family.length, 115);
  assert.equal(new Set(family.map(definition => definition.cardId)).size, 115);
  assert.ok(family.every(definition => definition.id === ABILITY_ID(definition.cardId) && definition.printedText === TEXT));
  assert.ok(family.every(definition => definition.trigger?.eventType === "card.ridden" && definition.trigger.subject === "event-target" && definition.trigger.circles?.[0] === "vanguard"));
  const catalog = loadCatalog(), matches = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) matches.push(ability);
  assert.equal(matches.length, 115);
  assert.ok(matches.every(ability => Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(definition => definition.id === ability.id)));
});

test("host and joining player each receive and resolve only their own ridden Vanguard's Quick Shield ability", () => {
  for (const side of ["human", "bot"]) {
    const fixture = makeState({ side });
    assert.equal(fixture.discovery.queued.length, 1);
    assert.equal(fixture.state.pendingAbility.side, side);
    assert.equal(fixture.state.pendingAbility.instance.uid, fixture.oldVanguard.uid);
    assert.equal(fixture.state.pendingAbility.triggerControllerPlayerId, fixture.actorPlayerId);
    assert.equal(fixture.state.pendingAbility.eventContext.gameEvent.subjectCardInstanceId, fixture.rider.uid);
    assert.deepEqual(fixture.state.pendingAbility.eventContext.gameEvent.targetCardInstanceIds, [fixture.oldVanguard.uid]);
    const result = answerPending(fixture);
    assert.equal(result.ok, true, result.reason);
    const actor = fixture.state.players[side], opponent = fixture.state.players[side === "human" ? "bot" : "human"];
    assert.equal(actor.deck.length, 0);
    assert.ok(actor.hand.some(card => card.uid === "draw-top"));
    const token = actor.hand.find(card => card.cardId === "token-quick-shield");
    assert.ok(token);
    assert.equal(token.isToken, true);
    assert.equal(token.ownerPlayerId, fixture.actorPlayerId);
    assert.equal(token.controllerPlayerId, fixture.actorPlayerId);
    assert.equal(token.cardName, "Quick Shield");
    assert.equal(token.type, "Quick Shield Token");
    assert.equal(token.grade, 0);
    assert.equal(token.power, 0);
    assert.equal(token.shield, 5000);
    assert.equal(token.zone, "hand");
    assert.equal(actor.quickShields, 1);
    assert.equal(opponent.hand.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.drawn", "card.created"]);
    assert.ok(result.events[0].eventId < result.events[1].eventId || result.events[0].eventId !== result.events[1].eventId);
    assert.equal(result.events[1].subjectCardInstanceId, token.uid);
    assert.equal(result.events[1].subjectOwnerPlayerId, fixture.actorPlayerId);
    assert.equal(result.events[1].subjectControllerPlayerId, fixture.actorPlayerId);
    assert.equal(result.events[1].currentLocation, "hand");
    assert.equal(result.events[1].sourceCardInstanceId, fixture.oldVanguard.uid);
    assert.equal(result.resolvedAbilityId, ABILITY_ID(fixture.oldVanguard.cardId));
  }
});

test("Quick Shield token is gated by the opponent Vanguard grade threshold while the draw still resolves", () => {
  const fixture = makeState({ opponentGrade: 0 });
  assert.equal(fixture.discovery.queued.length, 1);
  const result = answerPending(fixture);
  assert.equal(result.ok, true, result.reason);
  const player = fixture.state.players[fixture.side];
  assert.ok(player.hand.some(card => card.uid === "draw-top"));
  assert.equal(player.hand.some(card => card.cardId === "token-quick-shield"), false);
  assert.equal(player.quickShields, 0);
  assert.deepEqual(result.events.map(event => event.type), ["card.drawn"]);
});

test("ride target matching rejects unrelated copies, rear-guard rides, and unrelated placement events", () => {
  const wrongTarget = makeState({ eventTarget: "some-other-card" });
  assert.equal(wrongTarget.discovery.queued.length, 0);
  const wrongCircle = makeState({ sourcePreviousLocation: "rear-left" });
  assert.equal(wrongCircle.discovery.queued.length, 0);
  const placement = makeState({ eventType: "card.placed" });
  assert.equal(placement.discovery.queued.length, 0);
});

test("duplicate event and action replays cannot duplicate a draw or token; forged opponent response is rejected without mutation", () => {
  const fixture = makeState();
  assert.equal(fixture.discovery.queued.length, 1);
  const duplicate = Reducer.discoverAutoTriggers(fixture.state, [fixture.rideEvent], Engine);
  assert.equal(duplicate.queued.length, 0);
  const beforeForged = JSON.stringify(fixture.state);
  const forged = answerPending(fixture, { actorAuthUid: fixture.side === "bot" ? "auth-host" : "auth-guest", actionId: "forged-action" });
  assert.equal(forged.ok, false);
  assert.equal(forged.reason, "source-not-controlled");
  assert.equal(JSON.stringify(fixture.state), beforeForged);
  const resolved = answerPending(fixture);
  assert.equal(resolved.ok, true, resolved.reason);
  const afterFirst = JSON.stringify(fixture.state);
  const replay = Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: fixture.side === "human" ? "auth-host" : "auth-guest", actionId: fixture.actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: fixture.oldVanguard.uid, abilityId: ABILITY_ID(fixture.oldVanguard.cardId) } },
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, "duplicate-action");
  assert.equal(JSON.stringify(fixture.state), afterFirst);
});

test("invalid deterministic token identity rejects before drawing, and generic create-token remains unsupported", () => {
  const fixture = makeState();
  const player = fixture.state.players[fixture.side];
  const conflictingUid = uidFor(fixture.state.matchId, fixture.actionId, fixture.rideEvent.eventId, fixture.oldVanguard.uid);
  player.hand.push({ uid: conflictingUid, cardId: "unrelated-card", ownerPlayerId: fixture.actorPlayerId, controllerPlayerId: fixture.actorPlayerId });
  const before = JSON.stringify(fixture.state);
  const result = answerPending(fixture);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "quick-shield-token-state-invalid");
  assert.equal(JSON.stringify(fixture.state), before);
  assert.equal(Reducer.supportsServerEffectOperation("create-token"), false);
  const ability = fixture.state.pendingAbility.ability;
  const forged = { ...ability, definition: { ...ability.definition, effects: [{ ...ability.definition.effects[0] }, { ...ability.definition.effects[1], tokenId: "token-protect" }] } };
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
