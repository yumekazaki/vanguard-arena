"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_IDS = ["cfa-10054", "cfa-10093"];
const ABILITY_TEXT = "AUTO: When this card is discarded from hand during your ride phase, you may call this card to RC.";
const PATTERN_ID = "auto-ride-phase-discard-source-call-standing-v1";
const CARD_NUMBERS = { "cfa-10054": "D-TD03/011EN", "cfa-10093": "D-TD01/011EN" };
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
let sequence = 0;

function card(uid, cardId, playerId) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(definition, `catalog card ${cardId} exists`);
  return { uid, cardId: String(cardId), cardName: definition.name, name: definition.name, type: definition.type, grade: definition.grade,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true };
}

function fixture({ cardId = CARD_IDS[0], side = "human", locked = false, occupied = false } = {}) {
  const id = ++sequence;
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = card(`standing-call-${id}`, cardId, playerId);
  const makePlayer = owner => ({ playerId: owner, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: makePlayer("host-player"), bot: makePlayer("guest-player") };
  players[side].vanguard = card(`vanguard-${id}`, "cfa-31", playerId);
  players[side].drop = [source];
  if (locked) players[side].rear[0] = { locked: true, uid: `locked-${id}` };
  if (occupied) players[side].rear[0] = card(`displaced-${id}`, "cfa-10069", playerId);
  players[opponentSide].vanguard = card(`opponent-vanguard-${id}`, "cfa-31", opponentId);
  const state = { matchId: `standing-call-match-${id}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 2, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "drop", phase: "ride", timingWindow: "normal-ride-cost", discardReason: "ride-cost"
  });
  return { state, event, source, side, playerId, opponentSide };
}

function abilityFor(cardId) {
  const definition = catalog.find(cardDefinition => String(cardDefinition.id) === cardId);
  return Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:0`);
}

function discover(game, event = game.event) { return Reducer.discoverAutoTriggers(game.state, [event], Engine); }
function resolve(game, accept, { authUid = game.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, callZone = "rear-left" } = {}) {
  const abilityId = `${game.source.cardId}:0`;
  return Reducer.applyAbilityDecision(game.state, { actorAuthUid: authUid, actionId: `resolve-standing-call-${game.source.uid}-${accept}`,
    expectedStateVersion: game.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: game.source.uid, abilityId, ...(accept ? { callZone } : {}) } } }, seats, Engine);
}

test("Fectil and Theadore compile only the exact official optional standing-call wording", () => {
  for (const cardId of CARD_IDS) {
    const ability = abilityFor(cardId);
    assert.equal(ability.printedText, ABILITY_TEXT, cardId);
    assert.equal(ability.definition.source.patternId, PATTERN_ID, cardId);
    assert.deepEqual(ability.definition.source.officialCardNumbers, [CARD_NUMBERS[cardId]], cardId);
    assert.deepEqual(ability.effects, [{ op: "call-source-from-drop-rested", target: "source", position: "stand" }], cardId);
    assert.equal(ability.canDecline, true, cardId);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, true, cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("host and joining player privately resolve their own exact discarded card standing on RC", () => {
  for (const side of ["human", "bot"]) {
    for (const cardId of CARD_IDS) {
      const game = fixture({ cardId, side, occupied: true });
      const result = discover(game);
      assert.equal(result.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(result)}`);
      assert.equal(game.state.pendingAbility.side, side);
      assert.equal(game.state.pendingAbility.instance.uid, game.source.uid);
      assert.equal(discover(game).queued.length, 0, "the same event cannot prompt twice");
      const accepted = resolve(game, true);
      assert.equal(accepted.ok, true, accepted.reason);
      assert.equal(game.state.players[side].drop.some(item => item.uid === game.source.uid), false);
      assert.equal(game.state.players[side].rear[0].uid, game.source.uid);
      assert.equal(game.state.players[side].rear[0].rested, false);
      assert.equal(game.state.players[side].rear[0].position, "stand");
      const displaced = game.state.players[side].drop.find(item => item.uid.startsWith("displaced-"));
      assert.ok(displaced, "the former Rear-Guard moves to Drop");
      assert.equal(displaced.zone, "drop");
      assert.equal(displaced.circle, null);
      assert.equal(displaced.rested, false);
      assert.equal(displaced.position, "stand");
      assert.equal(displaced.locked, false);
      assert.equal(displaced.isLocked, false);
      assert.equal(displaced.faceUp, true);
      assert.deepEqual(game.state.players[game.opponentSide].drop, []);
    }
  }
});

test("declining leaves the discarded copy in Drop and does not reopen its prompt", () => {
  const game = fixture({ cardId: "cfa-10093", side: "bot" });
  assert.equal(discover(game).queued.length, 1);
  const result = resolve(game, false);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(game.state.players.bot.drop.map(item => item.uid), [game.source.uid]);
  assert.equal(game.state.pendingAbility, null);
  assert.equal(discover(game).queued.length, 0);
});

test("wrong phase, different discarded instance, and forged event actor are rejected", () => {
  const wrongPhase = fixture();
  wrongPhase.state.phase = 4;
  assert.equal(discover(wrongPhase).queued.length, 0);

  const wrongSource = fixture();
  assert.equal(discover(wrongSource, { ...wrongSource.event, sourceCardInstanceId: "another-copy", cardInstanceId: "another-copy",
    subjectCardInstanceId: "another-copy", eventId: `${wrongSource.event.eventId}-another-copy` }).queued.length, 0);

  const forged = fixture({ side: "bot" });
  assert.equal(discover(forged, { ...forged.event, actingPlayerId: "host-player", turnPlayerId: "host-player",
    eventId: `${forged.event.eventId}-forged` }).queued.length, 0);

  const mismatchedController = fixture();
  mismatchedController.source.controllerPlayerId = "guest-player";
  assert.equal(discover(mismatchedController).queued.length, 0);

  const mismatchedOwner = fixture();
  mismatchedOwner.source.ownerPlayerId = "guest-player";
  assert.equal(discover(mismatchedOwner).queued.length, 0);
});

test("two same-name copies keep the trigger and resolution on the exact discarded instance", () => {
  const game = fixture({ cardId: "cfa-10054" });
  const firstCopy = game.source;
  const secondCopy = card(`second-copy-${sequence}`, "cfa-10054", game.playerId);
  game.state.players[game.side].drop.push(secondCopy);
  game.source = secondCopy;
  game.event = Engine.createGameEvent(game.state, {
    type: "card.discarded", actingPlayerId: game.playerId, turnPlayerId: game.playerId,
    sourceCardInstanceId: secondCopy.uid, sourceOwnerPlayerId: game.playerId, sourceControllerPlayerId: game.playerId,
    cardInstanceId: secondCopy.uid, subjectCardInstanceId: secondCopy.uid, subjectOwnerPlayerId: game.playerId, subjectControllerPlayerId: game.playerId,
    previousLocation: "hand", currentLocation: "drop", phase: "ride", timingWindow: "normal-ride-cost", discardReason: "ride-cost"
  });
  assert.equal(discover(game).queued.length, 1);
  assert.equal(game.state.pendingAbility.instance.uid, secondCopy.uid);
  assert.equal(resolve(game, true).ok, true);
  assert.equal(game.state.players[game.side].rear[0].uid, secondCopy.uid);
  assert.equal(game.state.players[game.side].drop.some(item => item.uid === firstCopy.uid), true);
});

test("the host cannot answer for the joining player's prompt", () => {
  const game = fixture({ side: "bot" });
  assert.equal(discover(game).queued.length, 1);
  const before = JSON.stringify(game.state);
  const result = resolve(game, true, { authUid: seats.hostAuthUid });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(game.state), before);
});

test("no prompt is offered without an unlocked RC and a locked RC cannot be selected", () => {
  const noCircles = fixture({ locked: true });
  noCircles.state.players.human.rear.fill({ locked: true });
  assert.equal(discover(noCircles).queued.length, 0);

  const invalidSelection = fixture();
  invalidSelection.state.players.human.rear[0] = { locked: true, uid: "locked-target" };
  assert.equal(discover(invalidSelection).queued.length, 1);
  const before = JSON.stringify(invalidSelection.state);
  const rejected = resolve(invalidSelection, true, { callZone: "rear-left" });
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(invalidSelection.state), before);

  for (const callZone of ["not-a-circle", "accel-1"]) {
    const invalidZone = fixture();
    assert.equal(discover(invalidZone).queued.length, 1);
    const beforeInvalidZone = JSON.stringify(invalidZone.state);
    const rejectedZone = resolve(invalidZone, true, { callZone });
    assert.equal(rejectedZone.ok, false, callZone);
    assert.equal(JSON.stringify(invalidZone.state), beforeInvalidZone, `${callZone} rejects atomically`);
  }
});

test("the real Standard Ride Deck discard action discovers the correct owner's AUTO", () => {
  for (const side of ["human", "bot"]) {
    for (const [cardId, riderCardId] of [["cfa-10054", "cfa-10093"], ["cfa-10093", "cfa-10054"]]) {
      const game = fixture({ cardId, side });
      const owner = game.state.players[side];
      owner.vanguard = card(`grade-zero-vanguard-${sequence}`, "cfa-1", game.playerId);
      owner.format = "standard";
      owner.hand = [game.source];
      owner.drop = [];
      owner.rideDeck = [card(`ride-deck-rider-${sequence}`, riderCardId, game.playerId)];
      const opponent = game.state.players[game.opponentSide];
      game.state.ridePerformed = false;
      const ridden = Reducer.applyGameAction(game.state, {
        actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
        actionId: `real-ride-deck-${game.source.uid}`, expectedStateVersion: game.state.stateVersion,
        payload: { action: "rideDeck", rideDeckCardInstanceId: owner.rideDeck[0].uid, discardCardInstanceId: game.source.uid }
      }, seats, Engine);
      assert.equal(ridden.ok, true, ridden.reason);
      assert.equal(game.state.pendingAbility?.side, side);
      assert.equal(game.state.pendingAbility?.instance.uid, game.source.uid);
      assert.equal(game.state.players[game.opponentSide], opponent);
      const resolved = resolve(game, true, { callZone: "rear-right" });
      assert.equal(resolved.ok, true, resolved.reason);
      assert.equal(owner.rear[1]?.uid, game.source.uid);
      assert.equal(owner.rear[1]?.rested, false);
    }
  }
});
