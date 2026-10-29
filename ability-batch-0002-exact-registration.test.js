"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-10047";
const ABILITY_ID = "cfa-10047:0";
const PATTERN = "auto-rode-upon-second-player-draw-v1";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardDefinition = id => {
  const card = catalog.find(item => String(item.id) === String(id));
  assert.ok(card, `catalog card ${id} exists`);
  return card;
};
const instance = (definition, uid, playerId, extra = {}) => ({
  uid, cardId: String(definition.id), cardName: definition.name,
  type: definition.type || "Unit", grade: Number(definition.grade || 0),
  ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
});

function fixture({ ownerSide = "bot", wentSecond = true, eventType = "card.ridden", riddenUid } = {}) {
  const previousVanguardDefinition = cardDefinition(CARD_ID);
  const ability = Engine.parseCardAbilitiesCached(previousVanguardDefinition).find(item => item.id === ABILITY_ID);
  assert.ok(ability, "the exact catalog ability parses");
  const ownerId = ownerSide === "human" ? "host" : "guest";
  const opponentSide = ownerSide === "human" ? "bot" : "human";
  const opponentId = ownerSide === "human" ? "guest" : "host";
  const previousVanguard = instance(previousVanguardDefinition, `${ownerSide}-old-vanguard`, ownerId);
  const rider = instance(cardDefinition("cfa-3"), `${ownerSide}-rider`, ownerId, { grade: 1 });
  const opponentVanguard = instance(cardDefinition("cfa-3"), `${opponentSide}-vanguard`, opponentId, { grade: 3 });
  const owner = {
    playerId: ownerId, vanguard: rider, rear: [null, null, null, null, null],
    hand: [], deck: [{ uid: `${ownerSide}-draw`, cardId: "test-draw", ownerPlayerId: ownerId, controllerPlayerId: ownerId }],
    soul: [previousVanguard], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const opponent = {
    playerId: opponentId, vanguard: opponentVanguard, rear: [null, null, null, null, null],
    hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const state = {
    matchId: "batch-0002-ride-draw", stateVersion: 1, eventSequence: 0, turn: 1,
    side: ownerSide, firstSide: wentSecond ? opponentSide : ownerSide, phase: 2,
    players: ownerSide === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner },
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAttack: null
  };
  const event = Engine.createGameEvent(state, {
    type: eventType, actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard",
    targetCardInstanceIds: [riddenUid || previousVanguard.uid], targetPreviousLocation: "vanguard", targetCurrentLocation: "soul",
    targetOwnerPlayerId: ownerId, targetControllerPlayerId: ownerId, targetLocation: "vanguard",
    phase: "ride", timingWindow: "normal-ride"
  });
  return { state, event, ability, previousVanguard, owner, ownerSide, ownerId };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, actorAuthUid = f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-${f.ownerSide}-${f.state.eventSequence}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.previousVanguard.uid, abilityId: ABILITY_ID } }
  }, seats, Engine);
}

test("ABILITY-0002 exact cfa-10047 ride ability is trusted and resolves for its controller only", () => {
  const registered = Engine.getReviewedAbilityDefinitionsForCard(CARD_ID).find(item => item.id === ABILITY_ID);
  assert.ok(registered, "definition is present in the production registry without test-only registration");
  assert.equal(registered.source?.patternId, PATTERN);
  assert.equal(registered.printedText, fixture({}).ability.printedText);

  for (const ownerSide of ["human", "bot"]) {
    const f = fixture({ ownerSide });
    assert.deepEqual(discover(f).queued.map(item => item.instance.uid), [f.previousVanguard.uid]);
    assert.equal(f.state.pendingAbility.side, ownerSide);
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.owner.hand[0].uid, `${ownerSide}-draw`);
    assert.equal(f.owner.deck.length, 0);
    assert.equal(f.state.players[ownerSide === "human" ? "bot" : "human"].hand.length, 0);
  }
});

test("ABILITY-0002 exact cfa-10047 ride ability rejects wrong events, wrong ridden instance, first-player rides, and opponent resolution", () => {
  for (const bad of [
    fixture({ eventType: "card.placed" }),
    fixture({ riddenUid: "other-prior-vanguard" }),
    fixture({ wentSecond: false })
  ]) {
    assert.equal(discover(bad).queued.length, 0);
    assert.equal(bad.state.pendingAbility || null, null);
    assert.equal(bad.owner.deck.length, 1);
  }

  const joinedPlayer = fixture({ ownerSide: "bot" });
  assert.equal(discover(joinedPlayer).queued.length, 1);
  const before = JSON.stringify(joinedPlayer.state);
  const rejected = resolve(joinedPlayer, seats.hostAuthUid);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "source-not-controlled");
  assert.equal(JSON.stringify(joinedPlayer.state), before);
});
