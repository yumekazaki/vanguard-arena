"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const cardIds = ["cfa-169", "cfa-274", "cfa-561", "cfa-743", "cfa-901", "cfa-948", "cfa-974", "cfa-1148", "cfa-1511"];
const excludedNames = new Map([
  ["cfa-169", "Scout of Darkness, Vortimer"], ["cfa-274", "Bringer of Knowledge, Lox"],
  ["cfa-561", "Mermaid Idol, Riviere"], ["cfa-743", "Military Dragon, Raptor Sergeant"],
  ["cfa-901", "Stealth Dragon, Magatsu Breath"], ["cfa-948", "Arboros Dragon, Branch"],
  ["cfa-974", "Eye of Destruction, Zeal"], ["cfa-1148", "Bowstring of Heaven and Earth, Artemis"],
  ["cfa-1511", "Gravity Ball Dragon"]
]);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();

function abilityFor(cardId) {
  const card = catalog.find(candidate => candidate.id === cardId);
  assert.ok(card, `missing real card ${cardId}`);
  return Engine.parseCardAbilities(card).find(ability => ability.raw.includes("other than a card named"));
}

function makeRideState({ riderName, riderClan = "Gold Paladin", sourceId = "starter-copy", cardId = "cfa-169" }) {
  const sourceCard = catalog.find(card => card.id === cardId);
  const rider = { uid: "guest-rider", cardId: "guest-rider-def", cardName: riderName, clan: riderClan, grade: 1, unitCard: true, ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" };
  const source = { uid: sourceId, cardId, cardName: sourceCard.name, grade: sourceCard.grade, unitCard: true, ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" };
  const opponentVanguard = { uid: "host-vanguard", cardId: "host-vanguard-def", grade: 1, unitCard: true, ownerPlayerId: "player-host", controllerPlayerId: "player-host" };
  const player = { playerId: "player-guest", vanguard: source, hand: [rider], rear: [null, null, null, null, null], soul: [], drop: [], bind: [], damage: [], deck: [], guardCircle: [], orders: [] };
  const state = { matchId: "ride-name-room", stateVersion: 0, processedActionIds: [], eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], turn: 2, side: "bot", phase: 2, firstTurnComplete: true, ridePerformed: false, players: { human: { playerId: "player-host", vanguard: opponentVanguard, hand: [], rear: [], soul: [], drop: [], bind: [], damage: [], deck: [], guardCircle: [], orders: [] }, bot: player } };
  return { state, player, source, rider };
}

test("nine real ride triggers preserve the named rider exclusion and exact source identity", () => {
  const found = [];
  for (const cardId of cardIds) {
    const ability = abilityFor(cardId);
    assert.ok(ability, `${cardId} trigger not compiled`);
    assert.equal(ability.id, `${cardId}:1`);
    assert.equal(ability.definition.source.patternId, "auto-ridden-unit-clan-optional-source-call-v1");
    assert.equal(ability.trigger.excludedRiderName, excludedNames.get(cardId));
    assert.equal(ability.trigger.subject, "ridden-unit");
    assert.equal(ability.canDecline, true);
    found.push(ability);
  }
  assert.equal(found.length, 9);
});

test("ride trigger rejects the excluded card, wrong clan, missing name, and a different ridden instance", () => {
  const ability = abilityFor("cfa-169"), { state, source } = makeRideState({ riderName: "A different Gold Paladin" });
  const eventFor = (overrides = {}) => Engine.createGameEvent(state, {
    type: "card.ridden", actingPlayerId: "player-guest", turnPlayerId: "player-guest",
    sourceCardInstanceId: "guest-rider", sourceCardName: "A different Gold Paladin", sourceCardClan: "Gold Paladin",
    subjectCardInstanceId: "guest-rider", targetCardInstanceIds: [source.uid], targetPreviousLocation: "vanguard",
    targetCurrentLocation: "soul", targetLocation: "vanguard", currentLocation: "vanguard", ...overrides
  });
  const matches = (event, uid = source.uid) => Engine.eventMatchesAbilityTrigger(ability, "ride", event, uid, "vanguard", "vanguard", "player-guest");
  assert.equal(matches(eventFor()), true);
  assert.equal(matches(eventFor({ sourceCardName: "Scout of Darkness, Vortimer" })), false);
  assert.equal(matches(eventFor({ sourceCardClan: "Royal Paladin" })), false);
  assert.equal(matches(eventFor({ sourceCardName: null })), false);
  assert.equal(matches(eventFor({ targetCardInstanceIds: ["another-starter"] })), false);
  assert.equal(matches(eventFor(), "another-copy-of-same-card"), false);
});

test("the joining player's legal ride prompt and optional Soul call stay with that player", () => {
  const { state, player, source, rider } = makeRideState({ riderName: "Gold Paladin Rider" });
  const ride = Reducer.applyGameAction(state, { actorAuthUid: "auth-guest", actionId: "guest-rides-starter", expectedStateVersion: 0, payload: { action: "ride", cardInstanceId: rider.uid } }, seats, Engine);
  assert.equal(ride.ok, true);
  assert.equal(ride.events.find(event => event.type === "card.ridden")?.sourceCardName, "Gold Paladin Rider");
  assert.equal(state.pendingAbility?.side, "bot");
  assert.equal(state.pendingAbility?.instance.uid, source.uid);
  assert.equal(state.pendingAbility?.triggerControllerPlayerId, "player-guest");
  const resolved = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "guest-accepts-forerunner", expectedStateVersion: 1,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: "cfa-169:1", callZone: "rear-left", costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
  assert.equal(resolved.ok, true);
  assert.equal(player.soul.length, 0);
  assert.equal(player.rear[0].uid, source.uid);
  assert.equal(player.rear[0].rested, false);
  assert.equal(state.pendingAbility ?? null, null);
});

test("the named excluded rider does not offer the optional source call", () => {
  const { state, source, rider } = makeRideState({ riderName: "Scout of Darkness, Vortimer" });
  const ride = Reducer.applyGameAction(state, { actorAuthUid: "auth-guest", actionId: "guest-rides-excluded-name", expectedStateVersion: 0, payload: { action: "ride", cardInstanceId: rider.uid } }, seats, Engine);
  assert.equal(ride.ok, true);
  assert.equal(state.pendingAbility ?? null, null);
  assert.equal((state.pendingAbilities || []).length, 0);
  assert.ok(state.players.bot.soul.some(card => card.uid === source.uid));
});
