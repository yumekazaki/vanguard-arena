"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const Projection = require("./match-state-projection.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-ride-from-named-vanguard-get-crest-v1";
const RIDER_ID = "cfa-11521";
const CREST_ID = "cfa-11531";
const CREST_NAME = "The Quintuplets’ Memories";
const cards = [
  { cardId: "cfa-11522", name: "Night After School Festival, Ichika Nakano" },
  { cardId: "cfa-11542", name: "Night After School Festival, Nino Nakano" },
  { cardId: "cfa-11554", name: "Night After School Festival, Miku Nakano" },
  { cardId: "cfa-11667", name: "Night After School Festival, Itsuki Nakano" }
];
const yotsuba = { cardId: "cfa-11603", name: "Night After School Festival, Yotsuba Nakano" };
const catalog = loadCatalog();
const definition = id => {
  const value = catalog.find(card => String(card.id) === String(id));
  assert.ok(value, `catalog card ${id} exists`);
  return value;
};
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const instance = (cardDefinition, uid, playerId) => ({
  uid, cardId: String(cardDefinition.id), cardName: cardDefinition.name, type: cardDefinition.type || "Unit",
  grade: Number(cardDefinition.grade || 0), unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId
});

function fixture({ card = cards[0], side = "bot", eventType = "card.ridden", timingWindow = "normal-ride", previousLocation = "hand", previousCardId = RIDER_ID, sourceUid, targetUid, targetName, sourceControllerPlayerId, deckIds = [] } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const riderDefinition = definition(card.cardId), previousDefinition = definition(previousCardId);
  const rider = instance(riderDefinition, `${side}-incoming-rider`, ownerId);
  const previousVanguard = instance(previousDefinition, `${side}-previous-vanguard`, ownerId);
  const opponentVanguard = instance(definition(RIDER_ID), `${opponentSide}-vanguard`, opponentId);
  const deck = deckIds.map((id, index) => instance(definition(id), `${side}-deck-${index}`, ownerId));
  const owner = { playerId: ownerId, vanguard: rider, rear: [null, null, null, null, null], hand: [], deck, soul: [previousVanguard], drop: [], damage: [], bind: [], orders: [], crests: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: [null, null, null, null, null], hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], crests: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const state = { matchId: "quintuplet-crest-match", stateVersion: 3, eventSequence: 0, turn: 1, side, firstSide: side, phase: 2, players, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAttack: null };
  const expectedPattern = card.cardId === "cfa-11603" ? "auto-ride-from-named-vanguard-get-crest-search-memory-v1" : PATTERN;
  const ability = Engine.parseCardAbilitiesCached(riderDefinition).find(item => item.definition?.source?.patternId === expectedPattern);
  assert.ok(ability, `${card.cardId} has the reviewed ride/Crest ability`);
  const event = Engine.createGameEvent(state, {
    eventId: `ride-${side}-${card.cardId}`, type: eventType, actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: sourceUid || rider.uid, sourceCardName: riderDefinition.name,
    sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: sourceControllerPlayerId || ownerId,
    cardInstanceId: sourceUid || rider.uid, subjectCardInstanceId: sourceUid || rider.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: sourceControllerPlayerId || ownerId,
    previousLocation, currentLocation: "vanguard", targetCardInstanceIds: [targetUid || previousVanguard.uid],
    targetCardName: targetName || previousDefinition.name, targetOwnerPlayerId: ownerId, targetControllerPlayerId: ownerId,
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow
  });
  return { state, event, ability, side, owner, opponent, rider, previousVanguard, ownerId, authUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, card };
}
function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function hasRideAbilityPrompt(f) {
  const pending = [
    ...(Array.isArray(f.state.pendingAbilities) ? f.state.pendingAbilities : []),
    ...(f.state.pendingAbility ? [f.state.pendingAbility] : [])
  ];
  return pending.some(item => item?.ability?.id === f.ability.id || item?.id === f.ability.id);
}
function resolve(f, authUid = f.authUid, actionId = `ride-crest-${f.side}`, effectUid = undefined) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.rider.uid, abilityId: f.ability.id, ...(effectUid ? { effectUid } : {}) } }
  }, seats, Engine);
}

test("the four exact simple Quintuplets ride abilities compile as mandatory Crest-only AUTO effects", () => {
  for (const card of cards) {
    const catalogCard = definition(card.cardId), parsed = Engine.parseCardAbilitiesCached(catalogCard);
    assert.equal(parsed.length, 2, `${card.cardId} has an AUTO and a CONT`);
    const ability = parsed[0];
    assert.equal(ability.id, `${card.cardId}:0`);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.canDecline, false);
    assert.equal(ability.definition.optional, false);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.trigger.eventType, "card.ridden");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetCardNameEquals, "The Quintessential Quintuplets");
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.deepEqual(ability.effects, [{ op: "create-crest", target: "controller", cardId: CREST_ID, cardName: CREST_NAME }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    assert.ok(catalogCard.text.includes(ability.printedText));
  }
});

test("host and joining player receive the actual Crest only for their own exact named ride", () => {
  for (const card of cards) for (const side of ["human", "bot"]) {
    const f = fixture({ card, side }), queued = discover(f);
    assert.equal(hasRideAbilityPrompt(f), true, `${card.cardId}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.rider.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    assert.equal(Projection.projectForPlayer(f.state, f.ownerId).pendingAbility.side, side);
    assert.equal(Projection.projectForPlayer(f.state, f.opponent.playerId).pendingAbility, null);

    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.owner.crests.length, 1);
    assert.equal(f.owner.crests[0].cardId, CREST_ID);
    assert.equal(f.owner.crests[0].crestName, CREST_NAME);
    assert.equal(f.owner.crests[0].ownerPlayerId, f.ownerId);
    assert.equal(f.owner.crests[0].controllerPlayerId, f.ownerId);
    assert.equal(f.opponent.crests.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.created"]);
    assert.equal(result.events[0].currentLocation, "crest");
  }
});

test("wrong rider, call, source instance, previous Vanguard, location, or timing cannot trigger", () => {
  for (const [label, options] of [
    ["wrong rider", { previousCardId: "cfa-11524" }],
    ["call", { eventType: "card.placed" }],
    ["wrong ridden instance", { targetUid: "another-card-instance" }],
    ["wrong source instance", { sourceUid: "another-card-instance" }],
    ["wrong source origin", { previousLocation: "vanguard" }],
    ["wrong timing", { timingWindow: "stride" }],
    ["wrong controller", { sourceControllerPlayerId: "opponent-player" }]
  ]) {
    const f = fixture(options);
    discover(f);
    assert.equal(hasRideAbilityPrompt(f), false, label);
  }
});

test("the joining player alone resolves the Crest prompt and stale or duplicate requests fail safely", () => {
  const joined = fixture({ side: "bot" });
  discover(joined);
  assert.equal(hasRideAbilityPrompt(joined), true);
  const before = JSON.stringify(joined.state);
  const forged = resolve(joined, seats.hostAuthUid);
  assert.equal(forged.ok, false, `forged request unexpectedly resolved ${joined.ability.id}`);
  assert.equal(JSON.stringify(joined.state), before);

  const stale = fixture({ side: "bot" });
  discover(stale);
  assert.equal(hasRideAbilityPrompt(stale), true);
  const [oldVanguard] = stale.owner.soul.splice(0, 1);
  stale.owner.drop.push(oldVanguard);
  const staleBefore = JSON.stringify(stale.state);
  const rejected = resolve(stale);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "ride-draw-crest-event-context-invalid");
  assert.equal(JSON.stringify(stale.state), staleBefore);
  assert.equal(stale.owner.crests.length, 0);

  const replay = fixture({ side: "human" });
  assert.equal(discover(replay).queued.length, 1);
  const first = resolve(replay);
  assert.equal(first.ok, true, first.reason);
  const after = JSON.stringify(replay.state);
  assert.equal(discover(replay).queued.length, 0);
  const duplicate = resolve(replay);
  assert.equal(duplicate.ok, false);
  assert.equal(JSON.stringify(replay.state), after);
  assert.equal(replay.owner.crests.length, 1);
});

test("Yotsuba creates the Crest first and privately searches the full deck for up to one Quintuplet into Memory", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ card: yotsuba, side, deckIds: ["cfa-11524", "cfa-3"] });
    assert.equal(f.ability.definition.source.patternId, "auto-ride-from-named-vanguard-get-crest-search-memory-v1");
    assert.deepEqual(f.ability.effects.map(effect => effect.op), ["create-crest", "search-deck-up-to-one-filtered-to-memory"]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
    discover(f);
    assert.equal(hasRideAbilityPrompt(f), true);
    assert.equal(Projection.projectForPlayer(f.state, f.opponent.playerId).pendingAbility, null);
    const chosen = f.owner.deck.find(card => card.cardId === "cfa-11524");
    const result = resolve(f, f.authUid, `yotsuba-search-${side}`, chosen.uid);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.owner.crests.length, 1);
    assert.equal(f.owner.orders.length, 1);
    assert.equal(f.owner.orders[0].uid, chosen.uid);
    assert.equal(f.owner.orders[0].zone, "order");
    assert.equal(f.owner.deck.length, 1);
    assert.deepEqual(result.events.map(event => event.type), ["card.created", "card.revealed", "card.placed"]);
    assert.equal(f.opponent.crests.length, 0);
    assert.equal(f.opponent.orders.length, 0);
  }
});

test("Yotsuba may choose no card, and an ineligible search choice rejects the full resolution atomically", () => {
  const none = fixture({ card: yotsuba, deckIds: ["cfa-11524", "cfa-3"] });
  discover(none);
  const noChoice = resolve(none, none.authUid, "yotsuba-no-memory-choice");
  assert.equal(noChoice.ok, true, noChoice.reason);
  assert.equal(none.owner.crests.length, 1);
  assert.equal(none.owner.orders.length, 0);
  assert.equal(none.owner.deck.length, 2);
  assert.deepEqual(noChoice.events.map(event => event.type), ["card.created"]);

  const invalid = fixture({ card: yotsuba, deckIds: ["cfa-11524", "cfa-3"] });
  discover(invalid);
  const ineligible = invalid.owner.deck.find(card => card.cardId === "cfa-3");
  const before = JSON.stringify(invalid.state);
  const rejected = resolve(invalid, invalid.authUid, "yotsuba-invalid-memory-choice", ineligible.uid);
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(invalid.state), before);
  assert.equal(invalid.owner.crests.length, 0);
  assert.equal(invalid.owner.orders.length, 0);
});

