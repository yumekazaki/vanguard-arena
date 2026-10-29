"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const FAMILY = "auto-rc-from-hand-reveal-grade-three-search-name-discard-v1";

function card(cardId) {
  const found = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(found, `catalog card ${cardId} exists`);
  return found;
}

function instance(definition, uid, playerId, overrides = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function setup({ ownerSide = "bot", cardId = "cfa-2471", revealable = true, placementCircle = "rear-left", previousLocation = "hand", eventSourceUid = null } = {}) {
  const ownerPlayerId = ownerSide === "human" ? "host" : "guest";
  const sourceDefinition = card(cardId);
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.definition?.source?.patternId === FAMILY);
  assert.ok(ability, `${cardId} belongs to the reviewed family`);
  assert.ok(Engine.getReviewedAbilityDefinitionsForCard(sourceDefinition.id).some(item => item.id === ability.id),
    "the production registry, not a test-only registration, must trust this exact ability");
  const source = instance(sourceDefinition, `${ownerSide}-search-source`, ownerPlayerId, { circle: "rear-left", zone: "rear-guard" });
  const reveal = instance(revealable ? card("cfa-2480") : card("cfa-2"), `${ownerSide}-reveal`, ownerPlayerId);
  const discard = instance(card("cfa-2"), `${ownerSide}-discard`, ownerPlayerId);
  const targetFragment = ability.definition.effects[0].nameContains;
  const searchDefinition = catalog.find(item => Number(item.grade) === 3 && String(item.name).toLowerCase().includes(targetFragment.toLowerCase()));
  assert.ok(searchDefinition, `catalog has a Grade 3 card matching ${targetFragment}`);
  const searched = instance(searchDefinition, `${ownerSide}-search-target`, ownerPlayerId);
  const foreignDeckCard = instance(searchDefinition, "opponent-search-target", ownerSide === "human" ? "guest" : "host");
  const ownPlayer = {
    playerId: ownerPlayerId, vanguard: instance(card("cfa-3"), `${ownerSide}-vg`, ownerPlayerId),
    rear: [source, null, null, null, null], hand: [reveal, discard], soul: [], drop: [],
    deck: [searched, instance(card("cfa-3"), `${ownerSide}-non-match`, ownerPlayerId)],
    damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const opponentId = ownerSide === "human" ? "guest" : "host";
  const opponent = { playerId: opponentId, vanguard: instance(card("cfa-3"), `${opponentId}-vg`, opponentId),
    rear: [null, null, null, null, null], hand: [instance(card("cfa-2"), `${opponentId}-hand`, opponentId)], soul: [], drop: [],
    deck: [foreignDeckCard], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = ownerSide === "human" ? { human: ownPlayer, bot: opponent } : { human: opponent, bot: ownPlayer };
  const state = { matchId: "rc-grade-three-name-search", stateVersion: 1, turn: 7, side: ownerSide, phase: 3,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerPlayerId, turnPlayerId: ownerPlayerId,
    sourceCardInstanceId: eventSourceUid || source.uid, sourceOwnerPlayerId: ownerPlayerId,
    sourceControllerPlayerId: ownerPlayerId, cardInstanceId: eventSourceUid || source.uid,
    subjectCardInstanceId: eventSourceUid || source.uid, subjectOwnerPlayerId: ownerPlayerId,
    subjectControllerPlayerId: ownerPlayerId, previousLocation, currentLocation: placementCircle, timingWindow: "normal-call"
  });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, source, ability, reveal, discard, searched, foreignDeckCard, event, discovery, ownerSide, ownerPlayerId };
}

function decide(fixture, selection, actionId = "resolve-name-search") {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: fixture.ownerSide === "human" ? "auth-host" : "auth-guest",
    actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: [], discard: [], reveal: [fixture.reveal.uid] }, ...selection
    } }
  }, seats, Engine);
}

test("only the 24 exact Grade 3 name-search records receive trusted server support", () => {
  const records = [];
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) {
    if (ability.definition?.source?.patternId === FAMILY) records.push(ability);
  }
  assert.equal(records.length, 24);
  assert.equal(new Set(records.map(ability => ability.definition.effects[0].nameContains)).size, 24,
    "each card's distinct name fragment remains bound to its printed text");
  assert.ok(records.every(ability => Reducer.supportsServerAbilityEffects(ability)));
  assert.equal(Reducer.supportsServerEffectOperation("search-deck-named-grade-three-then-discard"), false,
    "the generic search-and-discard operation remains unsupported");
  const tampered = structuredClone(records[0]);
  tampered.definition.effects[0].nameContains = "unprinted target";
  assert.equal(Reducer.supportsServerAbilityEffects(tampered), false);
  const foreignCardId = { ...structuredClone(records[0]), cardId: "cfa-not-in-reviewed-family",
    definition: { ...structuredClone(records[0].definition), cardId: "cfa-not-in-reviewed-family" } };
  assert.equal(Reducer.supportsServerAbilityEffects(foreignCardId), false);
});

test("host and joining player search their own deck, reveal/pay from their own hand, and may discard the searched card", () => {
  for (const ownerSide of ["human", "bot"]) {
    const fixture = setup({ ownerSide });
    assert.equal(fixture.discovery.queued.length, 1);
    assert.equal(fixture.state.pendingAbility?.instance.uid, fixture.source.uid);
    assert.equal(fixture.state.pendingAbility?.triggerControllerPlayerId, fixture.ownerPlayerId);
    const own = fixture.state.players[ownerSide];
    const opponent = fixture.state.players[ownerSide === "human" ? "bot" : "human"];
    const unrelatedDeckUid = own.deck[1].uid;
    const result = decide(fixture, { effectUid: fixture.searched.uid, effectDiscardUid: fixture.searched.uid }, `resolve-search-${ownerSide}`);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(new Set(own.hand.map(item => item.uid)), new Set([fixture.reveal.uid, fixture.discard.uid]));
    assert.deepEqual(own.drop.map(item => item.uid), [fixture.searched.uid]);
    assert.deepEqual(new Set(own.deck.map(item => item.uid)), new Set([unrelatedDeckUid]));
    assert.deepEqual(opponent.hand.map(item => item.uid), [`${ownerSide === "human" ? "guest" : "host"}-hand`]);
    assert.deepEqual(opponent.deck.map(item => item.uid), [fixture.foreignDeckCard.uid]);
    assert.ok(result.events.some(event => event.type === "card.revealed" && event.cardInstanceId === fixture.searched.uid));
    assert.ok(result.events.some(event => event.type === "card.discarded" && event.cardInstanceId === fixture.searched.uid));
  }
});

test("the optional no-search branch still shuffles and discards from the actor's hand", () => {
  const fixture = setup({ ownerSide: "human" });
  const own = fixture.state.players.human;
  const deckUids = new Set(own.deck.map(item => item.uid));
  const result = decide(fixture, { effectUid: null, effectDiscardUid: fixture.discard.uid }, "resolve-no-search");
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(own.hand.map(item => item.uid), [fixture.reveal.uid]);
  assert.deepEqual(own.drop.map(item => item.uid), [fixture.discard.uid]);
  assert.deepEqual(new Set(own.deck.map(item => item.uid)), deckUids);
});

test("unaffordable reveal cost prevents a prompt and consumes the exact event", () => {
  const fixture = setup({ ownerSide: "bot", revealable: false });
  assert.equal(fixture.discovery.queued.length, 0);
  assert.equal(fixture.state.pendingAbility ?? null, null);
  assert.ok(fixture.discovery.skipped.some(item => item.abilityId === fixture.ability.id && item.reason === "unpayable-cost"));
  fixture.state.players.bot.hand.push(instance(card("cfa-2480"), "late-grade-three", "guest"));
  const repeated = Reducer.discoverAutoTriggers(fixture.state, [fixture.event], Engine);
  assert.equal(repeated.queued.length, 0, "a later state change cannot retroactively activate the old placement event");
});

test("source placement must be this exact unit, from hand, onto RC", () => {
  for (const options of [
    { placementCircle: "vanguard" },
    { previousLocation: "drop" },
    { eventSourceUid: "another-copy" }
  ]) {
    const fixture = setup(options);
    assert.equal(fixture.discovery.queued.length, 0, JSON.stringify(options));
    assert.equal(fixture.state.pendingAbility ?? null, null);
  }
});

test("foreign or invalid searched cards and an invalid reveal cost reject atomically", () => {
  for (const invalidChoice of [
    fixture => ({ effectUid: fixture.foreignDeckCard.uid, effectDiscardUid: fixture.discard.uid }),
    fixture => ({ effectUid: "absent-from-both-decks", effectDiscardUid: fixture.discard.uid })
  ]) {
    const fixture = setup({ ownerSide: "bot" });
    const before = JSON.stringify(fixture.state);
    const result = decide(fixture, invalidChoice(fixture), `reject-search-${Math.random()}`);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(fixture.state), before, "search failure must not pay the reveal cost or mutate zones");
  }

  const badReveal = setup({ ownerSide: "bot" });
  badReveal.state.players.bot.hand[0] = instance(card("cfa-2"), badReveal.reveal.uid, badReveal.ownerPlayerId);
  const beforeBadReveal = JSON.stringify(badReveal.state);
  const badCost = decide(badReveal, { effectUid: null, effectDiscardUid: badReveal.discard.uid }, "reject-grade-two-reveal");
  assert.equal(badCost.ok, false);
  assert.equal(JSON.stringify(badReveal.state), beforeBadReveal, "wrong-grade reveal must not partially resolve the effect");
});

test("host cannot resolve the joining player's trigger or search from the host's private zones", () => {
  const fixture = setup({ ownerSide: "bot" });
  const before = JSON.stringify(fixture.state);
  const result = Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: "auth-host", actionId: "host-forges-guest-name-search", expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: fixture.source.uid, abilityId: fixture.ability.id,
      costSelections: { cb: [], sb: [], discard: [], reveal: [fixture.reveal.uid] },
      effectUid: fixture.searched.uid, effectDiscardUid: fixture.discard.uid
    } }
  }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "source-not-controlled");
  assert.equal(JSON.stringify(fixture.state), before);
});
