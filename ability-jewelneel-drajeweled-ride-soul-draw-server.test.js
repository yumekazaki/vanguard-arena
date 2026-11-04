"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-10069";
const ABILITY_ID = `${CARD_ID}:1`;
const PATTERN_ID = "auto-jewelneel-rode-upon-drajeweled-soul-charge-distinct-grade-draw-v1";
const PRINTED_TEXT = 'AUTO: When this unit is rode upon by a unit with "Drajeweled" in its card name, Soul Charge 1, and if your soul has three or more cards with different grades, draw a card.';
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const jewelneelDefinition = catalog.find(card => String(card.id) === CARD_ID);
const ability = Engine.parseCardAbilitiesCached(jewelneelDefinition).find(candidate => candidate.id === ABILITY_ID);
let sequence = 0;

function definition(cardId) { return catalog.find(card => String(card.id) === String(cardId)); }

function card(uid, cardId, playerId) {
  const data = definition(cardId);
  assert.ok(data, `catalog card ${cardId} exists`);
  return { uid, cardId: String(cardId), cardName: data.name, name: data.name, type: data.type, grade: data.grade,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true };
}

function fixture(side = "human", { qualifyingRider = true, enoughDistinctGrades = true, unrelatedJewelneel = false } = {}) {
  const id = ++sequence;
  const opponentSide = side === "human" ? "bot" : "human";
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = card(`jewelneel-${id}`, CARD_ID, playerId);
  const rider = card(`rider-${id}`, qualifyingRider ? "cfa-10114" : "cfa-31", playerId);
  const player = owner => ({ playerId: owner, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  const sourceExtraSoul = enoughDistinctGrades ? card(`grade-zero-${id}`, "cfa-1", playerId) : card(`duplicate-grade-two-${id}`, "cfa-14", playerId);
  const extraSource = unrelatedJewelneel ? card(`other-jewelneel-${id}`, CARD_ID, playerId) : null;
  players[side].vanguard = rider;
  players[side].soul = [source, sourceExtraSoul, ...(extraSource ? [extraSource] : [])];
  const charged = card(`charged-grade-one-${id}`, "cfa-2", playerId);
  const drawn = card(`drawn-card-${id}`, "cfa-31", playerId);
  players[side].deck = [drawn, charged];
  players[opponentSide].vanguard = card(`opponent-vg-${id}`, "cfa-31", opponentId);
  const state = { matchId: `jewelneel-ride-match-${id}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: "ride", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceCardName: rider.cardName, sourceCardGrade: rider.grade,
    sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [source.uid],
    targetCardName: source.cardName, targetOwnerPlayerId: playerId, targetControllerPlayerId: playerId,
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard", phase: "ride", timingWindow: "normal-ride"
  });
  return { state, event, source, rider, charged, drawn, sourceExtraSoul, extraSource, side, playerId };
}

function discover(game, event = game.event) { return Reducer.discoverAutoTriggers(game.state, [event], Engine); }

function resolve(game, authUid = game.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(game.state, { actorAuthUid: authUid, actionId: `resolve-ride-${game.source.uid}`,
    expectedStateVersion: game.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: game.source.uid, abilityId: ABILITY_ID } } }, seats, Engine);
}

test("Jewelneel's exact Drajeweled ride AUTO compiles to the ordered Soul Charge and conditional draw", () => {
  assert.equal(jewelneelDefinition.name, "Demonic Stone Dragon, Jewelneel");
  assert.equal(jewelneelDefinition.text.includes("When this unit is rode upon by a unit with \"Drajeweled\" in its card name"), true);
  assert.equal(ability.printedText, PRINTED_TEXT);
  assert.equal(ability.definition.source.patternId, PATTERN_ID);
  assert.equal(ability.trigger.eventType, "card.ridden");
  assert.equal(ability.trigger.subject, "ridden-unit");
  assert.equal(ability.canDecline, false);
  assert.deepEqual(ability.effects, [
    { op: "soul-charge", target: "controller", count: 1 },
    { op: "draw", count: 1, condition: { op: "controller-soul-distinct-grades-at-least", count: 3 } }
  ]);
  assert.equal(Engine.autoAbilityReadiness(ability).ok, true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("host and joining player resolve only their own exact ride effect, charging before checking Soul grades", () => {
  for (const side of ["human", "bot"]) {
    const game = fixture(side, { unrelatedJewelneel: true });
    const queued = discover(game);
    assert.equal(queued.queued.length, 1, JSON.stringify(queued));
    assert.equal(game.state.pendingAbility.side, side);
    assert.equal(game.state.pendingAbility.instance.uid, game.source.uid);
    assert.equal(discover(game).queued.length, 0, "replayed ride events cannot queue twice");

    const result = resolve(game);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(game.state.players[side].soul.map(item => item.uid), [game.source.uid, game.sourceExtraSoul.uid, ...(game.extraSource ? [game.extraSource.uid] : []), game.charged.uid]);
    assert.deepEqual(game.state.players[side].hand.map(item => item.uid), [game.drawn.uid]);
    assert.deepEqual(game.state.players[side].deck, []);
    const opponentSide = side === "human" ? "bot" : "human";
    assert.deepEqual(game.state.players[opponentSide].soul, []);
    assert.deepEqual(game.state.players[opponentSide].hand, []);
  }
});

test("fewer than three distinct post-charge Soul grades does not draw or repeat the mandatory ability", () => {
  const game = fixture("bot", { enoughDistinctGrades: false });
  assert.equal(discover(game).queued.length, 1);
  const result = resolve(game);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(game.state.players.bot.soul.map(item => item.uid), [game.source.uid, game.sourceExtraSoul.uid, game.charged.uid]);
  assert.deepEqual(game.state.players.bot.hand, []);
  assert.deepEqual(game.state.players.bot.deck, [game.drawn]);
  assert.equal(game.state.pendingAbility, null);
  assert.equal(discover(game).queued.length, 0);
});

test("an unrelated rider, forged rider identity, or wrong ridden source cannot trigger", () => {
  const wrongRider = fixture("human", { qualifyingRider: false });
  assert.equal(discover(wrongRider).queued.length, 0);

  const forgedRider = fixture();
  assert.equal(discover(forgedRider, { ...forgedRider.event, sourceCardName: "Drajeweled", sourceCardInstanceId: "forged-rider" }).queued.length, 0);

  const wrongSource = fixture();
  assert.equal(discover(wrongSource, { ...wrongSource.event, targetCardInstanceIds: ["other-jewelneel"], eventId: `${wrongSource.event.eventId}-wrong-source` }).queued.length, 0);

  const wrongMove = fixture();
  assert.equal(discover(wrongMove, { ...wrongMove.event, targetCurrentLocation: "drop", eventId: `${wrongMove.event.eventId}-wrong-move` }).queued.length, 0);
});

test("the host cannot resolve a joining player's queued ride ability", () => {
  const game = fixture("bot");
  assert.equal(discover(game).queued.length, 1);
  const before = JSON.stringify(game.state);
  const result = resolve(game, seats.hostAuthUid);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(game.state), before);
});
