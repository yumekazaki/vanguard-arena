"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const ABILITY_IDS = ["cfa-7314:0", "cfa-9026:0", "cfa-9450:0"];
const CARD_IDS = ABILITY_IDS.map(id => id.slice(0, id.lastIndexOf(":")));
const TEXT = "AUTO: When this card is discarded from hand during your turn, you may call this card to RC as rest.";
const PATTERN = "auto-turn-discard-source-call-rested-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
let sequence = 0;

function fixture(cardId = CARD_IDS[0], side = "human", { actingOpponent = false } = {}) {
  const index = ++sequence;
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const definition = catalog.find(card => String(card.id) === cardId);
  assert.ok(definition, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === ABILITY_IDS[CARD_IDS.indexOf(cardId)]);
  assert.ok(ability, `${cardId} has its exact discard AUTO`);
  const source = { uid: `discarded-${cardId}-${index}`, cardId, cardName: definition.name, ownerPlayerId: playerId,
    controllerPlayerId: playerId, zone: "drop", faceUp: true };
  const empty = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: empty("host-player"), bot: empty("guest-player") };
  players[side].drop.push(source);
  players[side].vanguard = { uid: `vg-${index}`, cardId: "cfa-3", ownerPlayerId: playerId, controllerPlayerId: playerId, zone: "vanguard", grade: 3 };
  players[opponentSide].vanguard = { uid: `opp-vg-${index}`, cardId: "cfa-4", ownerPlayerId: opponentId, controllerPlayerId: opponentId, zone: "vanguard", grade: 3 };
  const state = { matchId: `turn-discard-call-${index}`, stateVersion: 1, turn: 2, phase: "main", side, eventSequence: 0,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: actingOpponent ? opponentId : playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "drop", phase: "main", timingWindow: "main-phase-discard"
  });
  return { state, ability, source, event, side, playerId, opponentSide };
}

function discover(game, event = game.event) { return Reducer.discoverAutoTriggers(game.state, [event], Engine); }
function resolve(game, accept, { authUid = game.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, callZone = "rear-left" } = {}) {
  return Reducer.applyAbilityDecision(game.state, {
    actorAuthUid: authUid, actionId: `resolve-turn-discard-${game.source.uid}-${accept}`, expectedStateVersion: game.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: game.source.uid, abilityId: game.ability.id, ...(accept ? { callZone } : {}) } }
  }, seats, Engine);
}

test("Shulia, Gigi, and Brainy Papio compile only the official own-turn discarded-source call effect", () => {
  for (const [index, cardId] of CARD_IDS.entries()) {
    const definition = catalog.find(card => String(card.id) === cardId);
    const abilities = Engine.parseCardAbilitiesCached(definition);
    const ability = abilities.find(item => item.id === ABILITY_IDS[index]);
    assert.equal(ability?.id, ABILITY_IDS[index], cardId);
    assert.equal(ability?.printedText, TEXT, cardId);
    assert.equal(ability.definition.source.patternId, PATTERN, cardId);
    assert.ok(ability.definition.source.officialReference, cardId);
    assert.equal(ability.definition.conditionsReviewed, true, cardId);
    assert.equal(ability.definition.costsReviewed, true, cardId);
    assert.equal(ability.definition.choicesReviewed, true, cardId);
    assert.equal(ability.trigger.status, "recognized-trigger", cardId);
    assert.equal(ability.trigger.eventType, "card.discarded", cardId);
    assert.equal(ability.trigger.subject, "source", cardId);
    assert.equal(ability.trigger.sourceLocation, "hand", cardId);
    assert.equal(ability.trigger.destinationLocation, "drop", cardId);
    assert.equal(ability.trigger.turnRelation, "controller", cardId);
    assert.deepEqual(ability.conditions, [{ type: "controller-turn" }], cardId);
    assert.deepEqual(ability.costs, [], cardId);
    assert.deepEqual(ability.effects, [{ op: "call-source-from-drop-rested", target: "source", position: "rest" }], cardId);
    assert.equal(ability.canDecline, true, cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("the controller resolves their own matching discard prompt from either online seat", () => {
  for (const cardId of CARD_IDS) for (const side of ["human", "bot"]) {
    const game = fixture(cardId, side);
    assert.equal(discover(game).queued.length, 1, `${cardId}/${side}`);
    assert.equal(game.state.pendingAbility.side, side);
    const result = resolve(game, true, { callZone: "rear-right" });
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(game.state.players[side].rear[1].uid, game.source.uid);
    assert.equal(game.state.players[side].rear[1].rested, true);
    assert.equal(game.state.players[side].drop.some(card => card.uid === game.source.uid), false);
    assert.equal(game.state.players[game.opponentSide].rear.filter(Boolean).length, 0);
  }
});

test("an opponent-caused discard still triggers only during the source controller's turn", () => {
  const game = fixture(CARD_IDS[2], "bot", { actingOpponent: true });
  assert.equal(game.event.actingPlayerId, "host-player");
  assert.equal(discover(game).queued.length, 1);
  assert.equal(game.state.pendingAbility.side, "bot");
  assert.equal(resolve(game, true).ok, true);
  assert.equal(game.state.players.bot.rear[0].uid, game.source.uid);
});

test("wrong turn, another instance, wrong zones, stale timing, and duplicate discard events cannot prompt or resolve", () => {
  for (const change of [
    { turnPlayerId: "guest-player" },
    { previousLocation: "rear-left" },
    { currentLocation: "soul" },
    { cardInstanceId: "another-copy", sourceCardInstanceId: "another-copy", subjectCardInstanceId: "another-copy" },
    { sourceOwnerPlayerId: "guest-player", subjectOwnerPlayerId: "guest-player" }
  ]) {
    const game = fixture();
    const invalid = { ...game.event, ...change, eventId: `${game.event.eventId}-${Object.keys(change)[0]}` };
    assert.equal(discover(game, invalid).queued.length, 0, JSON.stringify(change));
  }
  const duplicate = fixture();
  assert.equal(discover(duplicate, duplicate.event).queued.length, 1);
  duplicate.state.pendingAbility = null;
  duplicate.state.pendingAbilities = [];
  duplicate.state.processedAbilityTriggers = [];
  assert.equal(discover(duplicate, duplicate.event).queued.length, 1);
  assert.equal(discover(duplicate, duplicate.event).queued.length, 0);

  const stale = fixture();
  assert.equal(discover(stale).queued.length, 1);
  stale.state.phase = "battle";
  const before = JSON.stringify(stale.state);
  const rejected = resolve(stale, true);
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(stale.state), before);
});

test("decline is final, the other seat cannot resolve, and locked circles are rejected atomically", () => {
  const declined = fixture(CARD_IDS[1], "bot");
  assert.equal(discover(declined).queued.length, 1);
  assert.equal(resolve(declined, false).ok, true);
  assert.equal(declined.state.pendingAbility, null);
  assert.equal(discover(declined).queued.length, 0);

  const wrongSeat = fixture(CARD_IDS[0], "bot");
  assert.equal(discover(wrongSeat).queued.length, 1);
  const beforeWrongSeat = JSON.stringify(wrongSeat.state);
  assert.equal(resolve(wrongSeat, true, { authUid: seats.hostAuthUid }).ok, false);
  assert.equal(JSON.stringify(wrongSeat.state), beforeWrongSeat);

  const illegalTarget = fixture(CARD_IDS[0]);
  illegalTarget.state.players.human.rear[0] = { uid: "locked-circle", locked: true };
  assert.equal(discover(illegalTarget).queued.length, 1);
  const beforeIllegalTarget = JSON.stringify(illegalTarget.state);
  assert.equal(resolve(illegalTarget, true, { callZone: "rear-left" }).ok, false);
  assert.equal(JSON.stringify(illegalTarget.state), beforeIllegalTarget);

  const noCircle = fixture(CARD_IDS[0]);
  noCircle.state.players.human.rear.fill({ locked: true });
  assert.equal(discover(noCircle).queued.length, 0);
});
