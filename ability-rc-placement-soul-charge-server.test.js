"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = [["cfa-12553", 1], ["cfa-13513", 1], ["cfa-8405", 0]];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = IDS[0][0], side = "human") {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-rc-placement-soul-charge-one-v1");
  assert.ok(ability, `${cardId} compiles the placement AUTO`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const source = { uid: `source-${side}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 1 };
  const top = { uid: `top-${side}`, cardId: "soul-charge-top", ownerPlayerId: playerId, controllerPlayerId: playerId };
  const players = {
    human: { playerId: "player-host", rear: side === "human" ? [source] : [], deck: side === "human" ? [top] : [], hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] },
    bot: { playerId: "player-guest", rear: side === "bot" ? [source] : [], deck: side === "bot" ? [top] : [], hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] }
  };
  const state = { matchId: "placement-soul-charge-test", stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left", phase: "main", timingWindow: "normal-call"
  });
  return { state, event, ability, source, top, side, playerId };
}

test("three catalog abilities compile to the exact mandatory RC Soul Charge AUTO", () => {
  for (const [cardId, index] of IDS) {
    const ability = Engine.parseCardAbilitiesCached(catalog.find(item => item.id === cardId)).find(item => item.id === `${cardId}:${index}`);
    assert.equal(ability.definition?.source?.patternId, "auto-rc-placement-soul-charge-one-v1", cardId);
    assert.equal(ability.canDecline, false, cardId);
    assert.equal(ability.trigger.eventType, "card.placed", cardId);
    assert.equal(ability.trigger.subject, "source", cardId);
    assert.deepEqual(ability.trigger.circles, ["rear-guard"], cardId);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], cardId);
    assert.deepEqual(ability.definition.effects, [{ op: "soul-charge", count: 1 }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("only the exact placed Rear-Guard triggers and its controller Soul Charges on either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0][0], side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `placement-soul-charge-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
    }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.players[side].soul[0]?.uid, f.top.uid);
    assert.equal(f.state.players[side].deck.length, 0);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].soul.length, 0);
  }
});

test("another card, a Vanguard placement, and the host acting for the joining player are rejected", () => {
  const unrelated = fixture(IDS[0][0], "bot");
  const otherCardEvent = Engine.createGameEvent(unrelated.state, { ...unrelated.event, eventId: "other-card-placement", cardInstanceId: "other-card", sourceCardInstanceId: "other-card", subjectCardInstanceId: "other-card" });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [otherCardEvent], Engine).queued.length, 0);

  const wrongCircle = fixture(IDS[0][0], "bot");
  const vanguardEvent = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: "wrong-circle-placement", currentLocation: "vanguard", circle: "vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [vanguardEvent], Engine).queued.length, 0);

  const guest = fixture(IDS[0][0], "bot");
  assert.equal(Reducer.discoverAutoTriggers(guest.state, [guest.event], Engine).queued.length, 1);
  const forged = Reducer.applyAbilityDecision(guest.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "host-forges-guest-placement-skill", expectedStateVersion: guest.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: guest.source.uid, abilityId: guest.ability.id } }
  }, seats, Engine);
  assert.equal(forged.ok, false);
  assert.equal(guest.state.players.bot.soul.length, 0);
});
