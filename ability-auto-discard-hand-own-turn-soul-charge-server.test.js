"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
Engine.registerAbilityDefinitions(require("./ability-contributions/batch-ABILITY-76D8A0B8-0336.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const definitions = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(cardId, uid, playerId, extra = {}) {
  const definition = definitions.get(String(cardId));
  return {
    uid,
    cardId: String(cardId),
    cardName: definition?.name || String(cardId),
    type: definition?.type || "Unit",
    grade: Number(definition?.grade ?? 0),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...extra
  };
}

function fixture(side = "human", turnPlayerOverride = null) {
  const otherSide = side === "human" ? "bot" : "human";
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = card("cfa-7942", `yamiyamaneko-${side}`, playerId);
  const soulCard = card("cfa-3", `soul-charge-${side}`, playerId);
  const turnPlayerId = turnPlayerOverride || playerId;
  const own = {
    playerId,
    hand: [],
    drop: [source],
    soul: [],
    deck: [soulCard],
    damage: [],
    rear: [],
    bind: [],
    orders: [],
    guardCircle: [],
    gDeck: [],
    gZone: []
  };
  const opponent = {
    playerId: opponentId,
    hand: [],
    drop: [],
    soul: [],
    deck: [],
    damage: [],
    rear: [],
    bind: [],
    orders: [],
    guardCircle: [],
    gDeck: [],
    gZone: []
  };
  const state = {
    matchId: `yamiyamaneko-discard-soul-charge-${side}`,
    stateVersion: 1,
    turn: 2,
    side: turnPlayerId === playerId ? side : otherSide,
    phase: 4,
    eventSequence: 0,
    processedEventIds: [],
    processedAbilityTriggers: [],
    processedActionIds: [],
    pendingAbility: null,
    pendingAbilities: [],
    players: { [side]: own, [otherSide]: opponent }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.discarded",
    actingPlayerId: playerId,
    turnPlayerId,
    sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: playerId,
    sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid,
    subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: playerId,
    subjectControllerPlayerId: playerId,
    previousLocation: "hand",
    currentLocation: "drop",
    phase: "main",
    timingWindow: "discard-resolution"
  });
  const ability = Engine.parseCardAbilitiesCached(definitions.get("cfa-7942")).find(item => item.id === "cfa-7942:0");
  assert.ok(ability, "the exact catalog ability must parse");
  return { state, event, ability, source, soulCard, own, opponent, side, playerId, opponentId };
}

function resolve(f, actionId = `resolve-${f.side}`, actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "ability-response",
      accept: true,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id }
    }
  }, seats, Engine);
}

test("Yamiyamaneko's exact AUTO is a reviewed controller-turn discard trigger", () => {
  const f = fixture();
  assert.equal(f.ability.printedText, "AUTO: When discarded from hand during your turn, Soul Charge 1.");
  assert.equal(f.ability.definition.source.patternId, "auto-own-turn-self-discard-soul-charge-one-v1");
  assert.equal(f.ability.trigger.eventType, "card.discarded");
  assert.equal(f.ability.trigger.subject, "source");
  assert.equal(f.ability.trigger.sourceLocation, "hand");
  assert.equal(f.ability.trigger.destinationLocation, "drop");
  assert.equal(f.ability.trigger.turnRelation, "controller");
  assert.deepEqual(f.ability.definition.effects, [{ op: "soul-charge", target: "controller", count: 1 }]);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
});

test("the exact discarded card Soul Charges for its controller on either online seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.deepEqual(f.own.soul.map(item => item.uid), [f.soulCard.uid]);
    assert.equal(f.own.deck.length, 0);
    assert.equal(f.own.drop.some(item => item.uid === f.source.uid), true);
    assert.deepEqual(f.opponent.soul, []);
  }
});

test("the trigger rejects an opponent turn and a different card's discard", () => {
  for (const side of ["human", "bot"]) {
    const playerId = side === "human" ? "player-host" : "player-guest";
    const opponentId = side === "human" ? "player-guest" : "player-host";
    const wrongTurn = fixture(side, opponentId);
    assert.equal(Reducer.discoverAutoTriggers(wrongTurn.state, [wrongTurn.event], Engine).queued.length, 0);

    const wrongCard = fixture(side);
    const event = Engine.createGameEvent(wrongCard.state, {
      ...wrongCard.event,
      eventId: `unrelated-discard-${side}`,
      sourceCardInstanceId: "different-ability-source",
      actingPlayerId: playerId,
      turnPlayerId: playerId,
      cardInstanceId: "another-discarded-card",
      subjectCardInstanceId: "another-discarded-card",
      subjectOwnerPlayerId: playerId,
      subjectControllerPlayerId: playerId
    });
    assert.equal(Reducer.discoverAutoTriggers(wrongCard.state, [event], Engine).queued.length, 0);
    assert.equal(wrongCard.state.pendingAbility, null);
    assert.deepEqual(wrongCard.own.soul, []);
  }
});

test("duplicate discard events cannot Soul Charge a second time", () => {
  const f = fixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.deepEqual(f.own.soul.map(item => item.uid), [f.soulCard.uid]);
});

test("the other player cannot resolve the discarded card's AUTO", () => {
  const f = fixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const before = JSON.stringify(f.state);
  const result = resolve(f, "host-forges-guest-yamiyamaneko", seats.hostAuthUid);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(f.state), before);
});
