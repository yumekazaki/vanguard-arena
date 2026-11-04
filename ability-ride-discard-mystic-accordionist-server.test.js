"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-10071";
const ABILITY_ID = `${CARD_ID}:0`;
const PATTERN_ID = "auto-ride-phase-discard-source-to-soul-v1";
const PRINTED_TEXT = "AUTO: When this card is discarded from hand during your ride phase, you may put this card into your soul.";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const cardDefinition = catalog.find(card => String(card.id) === CARD_ID);
const ability = Engine.parseCardAbilitiesCached(cardDefinition).find(item => item.id === ABILITY_ID);
let sequence = 0;

function card(uid, cardId, playerId) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(definition, `catalog card ${cardId} exists`);
  return { uid, cardId: String(cardId), cardName: definition.name, name: definition.name, type: definition.type, grade: definition.grade,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true };
}

function fixture(side = "human") {
  const id = ++sequence;
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = card(`accordionist-${id}`, CARD_ID, playerId);
  const player = owner => ({ playerId: owner, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = card(`vanguard-${id}`, "cfa-31", playerId);
  players[side].drop = [source];
  players[opponentSide].vanguard = card(`opponent-vanguard-${id}`, "cfa-31", opponentId);
  const state = { matchId: `accordionist-match-${id}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 2, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "drop", phase: "ride", timingWindow: "normal-ride-cost", discardReason: "ride-cost"
  });
  return { state, event, source, side, playerId };
}

function discover(game, event = game.event) { return Reducer.discoverAutoTriggers(game.state, [event], Engine); }
function resolve(game, accept, authUid = game.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(game.state, { actorAuthUid: authUid, actionId: `resolve-accordionist-${game.source.uid}-${accept}`,
    expectedStateVersion: game.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: game.source.uid, abilityId: ABILITY_ID } } }, seats, Engine);
}

test("Mystic Accordionist's exact optional Ride-phase discard AUTO compiles to move-source-to-Soul", () => {
  assert.equal(cardDefinition.name, "Mystic Accordionist");
  assert.equal(ability.printedText, PRINTED_TEXT);
  assert.equal(ability.definition.source.patternId, PATTERN_ID);
  assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "card.discarded", subject: "source", circles: [], destinationLocation: "drop",
    sourceLocation: "hand", excludeSourceAsSubject: false, requiredPhase: "ride", turnRelation: "controller" });
  assert.equal(ability.canDecline, true);
  assert.deepEqual(ability.effects, [{ op: "move-source-to-soul", target: "source", from: "drop" }]);
  assert.equal(Engine.autoAbilityReadiness(ability).ok, true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("both host and joining player are prompted privately and may move only their discarded copy", () => {
  for (const side of ["human", "bot"]) {
    const game = fixture(side);
    const result = discover(game);
    assert.equal(result.queued.length, 1, JSON.stringify(result));
    assert.equal(game.state.pendingAbility.side, side);
    assert.equal(game.state.pendingAbility.instance.uid, game.source.uid);
    assert.equal(discover(game).queued.length, 0, "duplicate event processing does not queue a second prompt");
    const resolved = resolve(game, true);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.deepEqual(game.state.players[side].drop, []);
    assert.deepEqual(game.state.players[side].soul.map(item => item.uid), [game.source.uid]);
    assert.deepEqual(game.state.players[side === "human" ? "bot" : "human"].soul, []);
  }
});

test("declining is allowed and leaves the exact source in Drop without reopening the prompt", () => {
  const game = fixture("bot");
  assert.equal(discover(game).queued.length, 1);
  const result = resolve(game, false);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(game.state.players.bot.drop.map(item => item.uid), [game.source.uid]);
  assert.deepEqual(game.state.players.bot.soul, []);
  assert.equal(game.state.pendingAbility, null);
  assert.equal(discover(game).queued.length, 0);
});

test("wrong phase, another card's discard, and a forged acting player do not trigger", () => {
  const wrongPhase = fixture();
  wrongPhase.state.phase = 5;
  assert.equal(discover(wrongPhase, { ...wrongPhase.event, phase: "battle", eventId: `${wrongPhase.event.eventId}-battle` }).queued.length, 0);

  const wrongCard = fixture();
  assert.equal(discover(wrongCard, { ...wrongCard.event, cardInstanceId: "other-card", sourceCardInstanceId: "other-card", subjectCardInstanceId: "other-card",
    eventId: `${wrongCard.event.eventId}-other-card` }).queued.length, 0);

  const forgedActor = fixture("bot");
  assert.equal(discover(forgedActor, { ...forgedActor.event, actingPlayerId: "host-player", turnPlayerId: "host-player",
    eventId: `${forgedActor.event.eventId}-forged-actor` }).queued.length, 0);
});

test("the host cannot resolve a joining player's Accordionist prompt", () => {
  const game = fixture("bot");
  assert.equal(discover(game).queued.length, 1);
  const before = JSON.stringify(game.state);
  const result = resolve(game, true, seats.hostAuthUid);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(game.state), before);
});
