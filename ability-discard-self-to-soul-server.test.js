"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-10174", "cfa-6865", "cfa-8590"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = IDS[0], side = "human", turnPlayerOverride = null) {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-hand-discard-self-optional-to-soul-v1");
  assert.ok(ability, `${cardId} compiles the optional discard AUTO`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `discarded-${side}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 1 };
  const players = {
    human: { playerId: "player-host", hand: [], drop: side === "human" ? [source] : [], soul: [], deck: [], damage: [], rear: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] },
    bot: { playerId: "player-guest", hand: [], drop: side === "bot" ? [source] : [], soul: [], deck: [], damage: [], rear: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] }
  };
  const state = { matchId: "discard-self-to-soul-test", stateVersion: 1, turn: 4, side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players };
  const turnPlayerId = turnPlayerOverride || playerId;
  const event = Engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: playerId, turnPlayerId,
    sourceCardInstanceId: `discard-effect-${side}`, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "drop", phase: turnPlayerId === playerId ? "main" : "opponent-turn", timingWindow: "discard-resolution"
  });
  return { state, event, ability, source, side, playerId, opponentId };
}

test("three catalog records compile as optional self-discard-to-Soul AUTO abilities", () => {
  for (const cardId of IDS) {
    const ability = Engine.parseCardAbilitiesCached(catalog.find(item => item.id === cardId)).find(item => item.id === `${cardId}:0`);
    assert.equal(ability.definition?.source?.patternId, "auto-hand-discard-self-optional-to-soul-v1", cardId);
    assert.equal(ability.canDecline, true, cardId);
    assert.deepEqual(ability.requiredLocation, ["hand"], cardId);
    assert.equal(ability.trigger.eventType, "card.discarded", cardId);
    assert.equal(ability.trigger.subject, "event-subject", cardId);
    assert.equal(ability.trigger.turnRelation, "controller", cardId);
    assert.deepEqual(ability.definition.effects, [{ op: "move-source-to-soul", target: "source", from: "drop" }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("the discarded card's controller alone chooses whether that exact card moves to Soul", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `discard-self-to-soul-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
    }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.state.players[side].soul.map(card => card.uid), [f.source.uid]);
    assert.equal(f.state.players[side].drop.length, 0);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].soul.length, 0);
  }
});

test("decline, an opponent turn, another discarded card, and host proxying cannot resolve it", () => {
  const declined = fixture();
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
  const declineResult = Reducer.applyAbilityDecision(declined.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "declined-discard-self-to-soul", expectedStateVersion: declined.state.stateVersion,
    payload: { type: "ability-response", accept: false, selection: { instanceUid: declined.source.uid, abilityId: declined.ability.id } }
  }, seats, Engine);
  assert.equal(declineResult.ok, true, declineResult.reason);
  assert.ok(declined.state.players.human.drop.some(card => card.uid === declined.source.uid));
  assert.equal(declined.state.players.human.soul.length, 0);

  const opponentTurn = fixture(IDS[0], "human", "player-guest");
  assert.equal(Reducer.discoverAutoTriggers(opponentTurn.state, [opponentTurn.event], Engine).queued.length, 0);

  const unrelated = fixture();
  const otherDiscard = Engine.createGameEvent(unrelated.state, { ...unrelated.event, eventId: "other-discarded-card", cardInstanceId: "unrelated-card", subjectCardInstanceId: "unrelated-card" });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [otherDiscard], Engine).queued.length, 0);

  const guest = fixture(IDS[0], "bot");
  assert.equal(Reducer.discoverAutoTriggers(guest.state, [guest.event], Engine).queued.length, 1);
  const forged = Reducer.applyAbilityDecision(guest.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "host-forges-guest-discard-trigger", expectedStateVersion: guest.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: guest.source.uid, abilityId: guest.ability.id } }
  }, seats, Engine);
  assert.equal(forged.ok, false);
  assert.ok(guest.state.players.bot.drop.some(card => card.uid === guest.source.uid));
});
