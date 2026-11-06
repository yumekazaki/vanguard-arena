"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cardById = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const abilityId = "cfa-10630:0";
const sourceAbilityId = "cfa-12553:1";

function cardInstance(cardId, uid, playerId, circle = null) {
  const card = cardById.get(cardId) || {};
  return { uid, cardId, cardName: card.name || cardId, unitCard: true, grade: Number(card.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, circle, zone: circle ? "rear-guard" : undefined,
    faceUp: true, rested: false };
}

function fixture(side = "human", placement = "effect-placement") {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const source = cardInstance("cfa-10630", `placed-${side}`, playerId, "rear-right");
  const abilitySource = cardInstance("cfa-12553", `ability-source-${side}`, playerId, "rear-left");
  const top = cardInstance("cfa-100", `deck-top-${side}`, playerId);
  const second = cardInstance("cfa-101", `deck-second-${side}`, playerId);
  const makePlayer = id => ({ playerId: id, vanguard: cardInstance("cfa-9100", `vg-${id}`, id),
    rear: [], hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    guardCircle: [], gDeck: [], gZone: [], removed: [], triggerZone: [], crests: [] });
  const players = { human: makePlayer("player-host"), bot: makePlayer("player-guest") };
  players[side].rear = [abilitySource, source];
  players[side].deck = [second, top];
  const state = { matchId: `effect-placement-soul-charge-${side}-${placement}`, stateVersion: 1, turn: 2,
    side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [],
    processedActionIds: [], pendingAbility: null, pendingAbilities: [], players };
  const location = { zone: "rear-guard", circle: "rear-left" };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: abilitySource.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    abilitySourceInstanceId: abilitySource.uid, abilitySourceOwnerPlayerId: playerId,
    abilitySourceControllerPlayerId: playerId, abilitySourceLocation: location, sourceAbilityId,
    effectProvenance: { cause: "card-effect", sourceCardInstanceId: abilitySource.uid,
      sourceControllerPlayerId: playerId, abilitySourceInstanceId: abilitySource.uid,
      abilitySourceControllerPlayerId: playerId, actingPlayerId: playerId, sourceAbilityId, abilitySourceLocation: location },
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "drop", currentLocation: "rear-right", circle: "rear-right",
    phase: "main", timingWindow: placement
  });
  return { state, event, source, top, side, playerId, opponentSide };
}

function decision(f, accept, actionId = `soul-charge-${f.side}-${accept}`) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId } }
  }, seats, Engine);
}

test("the exact card has an optional Rear-Guard effect-placement Soul Charge AUTO", () => {
  const card = cardById.get("cfa-10630");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.equal(ability?.definition?.source?.patternId, "auto-rc-effect-placement-optional-soul-charge-one-v1");
  assert.equal(ability?.kind, "AUTO");
  assert.equal(ability?.canDecline, true);
  assert.deepEqual(ability?.requiredLocation, ["rear-guard"]);
  assert.equal(ability?.trigger?.status, "recognized-trigger");
  assert.equal(ability?.trigger?.eventType, "card.placed");
  assert.equal(ability?.trigger?.subject, "source");
  assert.deepEqual(ability?.trigger?.circles, ["rear-guard"]);
  assert.equal(ability?.trigger?.effectPlacementOnly, true);
  assert.deepEqual(ability?.definition?.effects, [{ op: "soul-charge", count: 1 }]);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("only its controller receives the effect-placement prompt and resolves the optional Soul Charge", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 1, `${side}: ${JSON.stringify(result)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const resolved = decision(f, true);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.deepEqual(f.state.players[side].soul.map(card => card.uid), [f.top.uid]);
    assert.equal(f.state.players[side].deck.length, 1);
    assert.equal(f.state.players[f.opponentSide].soul.length, 0);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  }
});

test("normal calls, wrong circles, unrelated instances, and forged host decisions cannot trigger it", () => {
  const normalCall = fixture("bot", "normal-call");
  assert.equal(Reducer.discoverAutoTriggers(normalCall.state, [normalCall.event], Engine).queued.length, 0);

  const wrongCircle = fixture("bot");
  const guardianEvent = Engine.createGameEvent(wrongCircle.state, {
    ...wrongCircle.event, eventId: "wrong-effect-placement-circle", currentLocation: "guardian", circle: "guardian"
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [guardianEvent], Engine).queued.length, 0);

  const unrelated = fixture("bot");
  const otherUnitEvent = Engine.createGameEvent(unrelated.state, {
    ...unrelated.event, eventId: "unrelated-unit-placement", cardInstanceId: "other-unit",
    subjectCardInstanceId: "other-unit", subjectOwnerPlayerId: unrelated.playerId,
    subjectControllerPlayerId: unrelated.playerId
  });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [otherUnitEvent], Engine).queued.length, 0);

  const guest = fixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(guest.state, [guest.event], Engine).queued.length, 1);
  const forged = Reducer.applyAbilityDecision(guest.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "host-cannot-resolve-guest-soul-charge",
    expectedStateVersion: guest.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: guest.source.uid, abilityId } }
  }, seats, Engine);
  assert.equal(forged.ok, false);
  assert.equal(guest.state.players.bot.soul.length, 0);
});
