"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-2101", "cfa-3565", "cfa-4004"];
const PATTERN_ID = "auto-rc-return-to-hand-counter-soul-blast-draw-v1";
const PRINTED_TEXT = "AUTO: [Counter Blast 1 & Soul Blast 1] When this unit is returned to your hand from RC, you may pay the cost. If you do, draw a card.";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = IDS[0], side = "human") {
  const card = catalog.find(item => item.id === cardId);
  assert.ok(card, `${cardId} exists in the trusted catalog`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability?.definition, `${cardId}:0 is compiled`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `return-source-${side}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 1 };
  const cbCard = { uid: `cb-${side}`, cardId: `cb-${side}`, ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: false };
  const soulCard = { uid: `soul-${side}`, cardId: `soul-${side}`, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const drawnCard = { uid: `draw-${side}`, cardId: `draw-${side}`, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const players = {
    human: { playerId: "player-host", vanguard: null, rear: [], hand: side === "human" ? [source] : [], damage: side === "human" ? [cbCard] : [], soul: side === "human" ? [soulCard] : [], deck: side === "human" ? [drawnCard] : [], drop: [], bind: [], orders: [], crests: [], extra: [], guardCircle: [], gDeck: [], gZone: [], removed: [] },
    bot: { playerId: "player-guest", vanguard: null, rear: [], hand: side === "bot" ? [source] : [], damage: side === "bot" ? [cbCard] : [], soul: side === "bot" ? [soulCard] : [], deck: side === "bot" ? [drawnCard] : [], drop: [], bind: [], orders: [], crests: [], extra: [], guardCircle: [], gDeck: [], gZone: [], removed: [] }
  };
  const state = { matchId: "return-to-hand-test", stateVersion: 1, eventSequence: 0, turn: 2, side, phase: 4, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, {
    type: "card.moved", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "rear-left", currentLocation: "hand", phase: "main", timingWindow: "effect-resolution"
  });
  return { state, event, ability, source, card, side, playerId, opponentId, cbCard, soulCard, drawnCard };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function respond(f, { accept = true, actor = f.side, actionId = `resolve-${f.side}`, cbUid = f.cbCard.uid, sbUid = f.soulCard.uid } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: [cbUid], sb: [sbUid] } } }
  }, seats, Engine);
}

test("the three exact AUTO definitions preserve the source-return trigger, costs, optionality, and draw", () => {
  for (const cardId of IDS) {
    const f = fixture(cardId);
    assert.equal(f.ability.definition.source.patternId, PATTERN_ID, cardId);
    assert.equal(f.ability.kind, "AUTO", cardId);
    assert.equal(f.ability.printedText, PRINTED_TEXT, cardId);
    assert.equal(f.ability.trigger.eventType, "card.moved", cardId);
    assert.equal(f.ability.trigger.subject, "source", cardId);
    assert.equal(f.ability.trigger.sourceLocation, "rear-guard", cardId);
    assert.equal(f.ability.trigger.destinationLocation, "hand", cardId);
    assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 1 }, { type: "soul-blast", count: 1 }], cardId);
    assert.equal(f.ability.canDecline, true, cardId);
    assert.deepEqual(f.ability.definition.effects, [{ op: "draw", count: 1 }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
  }
});

test("only the exact returned source prompts its controller, for host and joiner", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
  }

  const wrongInstance = fixture(IDS[0], "bot");
  wrongInstance.event = Engine.createGameEvent(wrongInstance.state, {
    type: "card.moved", actingPlayerId: wrongInstance.playerId, turnPlayerId: wrongInstance.playerId,
    sourceCardInstanceId: "different-copy", sourceOwnerPlayerId: wrongInstance.playerId, sourceControllerPlayerId: wrongInstance.playerId,
    cardInstanceId: "different-copy", subjectCardInstanceId: "different-copy", subjectOwnerPlayerId: wrongInstance.playerId,
    subjectControllerPlayerId: wrongInstance.playerId, previousLocation: "rear-left", currentLocation: "hand", phase: "main", timingWindow: "effect-resolution"
  });
  assert.equal(discover(wrongInstance).queued.length, 0);

  const wrongDestination = fixture(IDS[0], "bot");
  wrongDestination.event = Engine.createGameEvent(wrongDestination.state, {
    type: "card.moved", actingPlayerId: wrongDestination.playerId, turnPlayerId: wrongDestination.playerId,
    sourceCardInstanceId: wrongDestination.source.uid, sourceOwnerPlayerId: wrongDestination.playerId, sourceControllerPlayerId: wrongDestination.playerId,
    cardInstanceId: wrongDestination.source.uid, subjectCardInstanceId: wrongDestination.source.uid, subjectOwnerPlayerId: wrongDestination.playerId,
    subjectControllerPlayerId: wrongDestination.playerId, previousLocation: "rear-left", currentLocation: "drop", phase: "main", timingWindow: "effect-resolution"
  });
  assert.equal(discover(wrongDestination).queued.length, 0);
});

test("accept pays the controller's Counter-Blast and Soul-Blast then draws; duplicate response is rejected", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[1], side);
    assert.equal(discover(f).queued.length, 1);
    const actionId = `resolve-return-draw-${side}`;
    const result = respond(f, { actionId });
    assert.equal(result.ok, true, result.reason);
    const player = f.state.players[side];
    assert.equal(player.damage[0].faceDown, true);
    assert.equal(player.soul.length, 0);
    assert.deepEqual(player.drop.map(card => card.uid), [f.soulCard.uid]);
    assert.deepEqual(player.hand.map(card => card.uid), [f.source.uid, f.drawnCard.uid]);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.length, 0);
    const duplicate = respond(f, { actionId });
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.reason, "duplicate-action");
    assert.equal(player.hand.filter(card => card.uid === f.drawnCard.uid).length, 1);
  }
});

test("decline does not pay either cost or draw, and host cannot proxy the joining player's prompt", () => {
  const declined = fixture(IDS[2], "human");
  assert.equal(discover(declined).queued.length, 1);
  const declineResult = respond(declined, { accept: false });
  assert.equal(declineResult.ok, true, declineResult.reason);
  assert.equal(declined.state.players.human.damage[0].faceDown, false);
  assert.equal(declined.state.players.human.soul.length, 1);
  assert.equal(declined.state.players.human.deck.length, 1);
  assert.equal(declined.state.players.human.hand.length, 1);

  const joined = fixture(IDS[0], "bot");
  assert.equal(discover(joined).queued.length, 1);
  const forged = respond(joined, { actor: "human", actionId: "host-proxies-joiner-return-draw" });
  assert.equal(forged.ok, false);
  assert.equal(joined.state.pendingAbility.instance.uid, joined.source.uid, "the joiner's own decision remains pending");
  assert.equal(joined.state.players.bot.damage[0].faceDown, false);
  assert.equal(joined.state.players.bot.soul.length, 1);
  assert.equal(joined.state.players.bot.deck.length, 1);
});

test("invalid cost choices reject without partial payment or drawing; duplicate event discovery queues once", () => {
  const f = fixture(IDS[0], "bot");
  assert.equal(discover(f).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  const result = respond(f, { sbUid: "forged-soul-instance" });
  assert.equal(result.ok, false);
  assert.equal(f.state.players.bot.damage[0].faceDown, false);
  assert.equal(f.state.players.bot.soul.length, 1);
  assert.equal(f.state.players.bot.drop.length, 0);
  assert.equal(f.state.players.bot.deck.length, 1);
});
