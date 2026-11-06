"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-11564";
const ABILITY_ID = `${CARD_ID}:0`;
const PRINTED_TEXT = "AUTO [RC]: At the end of your turn, if this unit is on a RC with a Dragontree marker, you may Soul Charge 1.";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const cardDefinition = catalog.find(card => String(card.id) === CARD_ID);
const ability = cardDefinition && Engine.parseCardAbilities(cardDefinition).find(item => item.id === ABILITY_ID);

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  return {
    uid, cardId: String(cardId), cardName: definition?.name || String(cardId),
    grade: Number(definition?.grade || 0), unitCard: /\bunit\b/i.test(definition?.type || ""),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function fixture(side = "human", { markerZone = "rear-left", secondCopy = false } = {}) {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const source = card(CARD_ID, `source-${side}`, playerId, { zone: "rear-guard", circle: "rear-left" });
  const makePlayer = id => ({
    playerId: id,
    vanguard: card("cfa-14", `vg-${id}`, id, { zone: "vanguard", circle: "vanguard" }),
    rear: Array(5).fill(null), hand: [],
    deck: [card("cfa-3", `deck-${id}-1`, id), card("cfa-6", `deck-${id}-2`, id)],
    soul: [], damage: [], drop: [], bind: [], orders: [], guardCircle: [],
    triggerZone: [], gDeck: [], gZone: [],
    giftZones: id === playerId ? [{ type: "Dragontree", zone: markerZone }] : []
  });
  const players = { human: makePlayer("host-player"), bot: makePlayer("guest-player") };
  players[side].rear[0] = source;
  if (secondCopy) players[side].rear[1] = card(CARD_ID, `other-${side}`, playerId, { zone: "rear-guard", circle: "rear-right" });
  const state = {
    matchId: `apathetic-usurper-${side}`, stateVersion: 1, turn: 4, phase: 6, side,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null, pendingTurnEnd: { side, playerId, turn: 4, cleanupQueued: false }, players
  };
  return { state, ability, source, side, playerId };
}

function endEvent(f, overrides = {}) {
  const event = Engine.createGameEvent(f.state, {
    type: "turn.ended", actingPlayerId: f.playerId, turnPlayerId: f.playerId,
    phase: "end", timingWindow: "turn-end", ...overrides
  });
  f.state.pendingTurnEnd.turnEndEvent = event;
  f.state.pendingTurnEnd.turnEndEventId = event.eventId;
  return event;
}

function discover(f, event = endEvent(f)) {
  return Reducer.discoverAutoTriggers(f.state, [event], Engine);
}

function decide(f, { accept = true, actor = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `resolve-${f.side}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: ABILITY_ID } }
  }, seats, Engine);
}

test("Apathetic Usurper compiles only its exact optional Dragontree-circle AUTO", () => {
  assert.ok(cardDefinition);
  assert.equal(ability.printedText, PRINTED_TEXT);
  assert.equal(ability.definition.source.patternId, "auto-rc-end-turn-source-circle-dragontree-soul-charge-v1");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.trigger, {
    status: "recognized-trigger", eventType: "turn.ended", subject: "controller", turnRelation: "controller", circles: []
  });
  assert.deepEqual(ability.conditions, [{ type: "source-circle-has-dragontree-marker" }]);
  assert.deepEqual(ability.effects, [{ op: "soul-charge", count: 1 }]);
  assert.equal(ability.canDecline, true);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("the exact source controller receives and resolves the optional prompt for either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    const otherAuthUid = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(decide(f, { actor: otherAuthUid, actionId: `forged-${side}` }).ok, false);
    const result = decide(f, { actionId: `accept-${side}` });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(f.state.players[side].soul.length, 1);
    assert.match(f.state.players[side].soul[0].uid, new RegExp(`^deck-${f.playerId}-`));
    assert.equal(f.state.players[side].deck.length, 1);
    assert.equal(f.state.players[side].rear[0].uid, f.source.uid);
  }
});

test("a marker on another circle does not activate this copy, while another marked copy has its own trigger", () => {
  const unmarkedSource = fixture("human", { markerZone: "rear-right" });
  assert.equal(discover(unmarkedSource).queued.length, 0);

  const otherCopy = fixture("human", { markerZone: "rear-right", secondCopy: true });
  assert.equal(discover(otherCopy).queued.length, 1);
  assert.equal(otherCopy.state.pendingAbility.instance.uid, "other-human");
  assert.equal(otherCopy.state.pendingAbility.ability.id, ABILITY_ID);

  const vanguardMarker = fixture("human", { markerZone: "vanguard" });
  assert.equal(discover(vanguardMarker).queued.length, 0);
});

test("wrong turn owner and wrong timing window do not queue the AUTO", () => {
  const wrongTurn = fixture("human");
  assert.equal(discover(wrongTurn, endEvent(wrongTurn, { actingPlayerId: "guest-player", turnPlayerId: "guest-player" })).queued.length, 0);
  const wrongWindow = fixture("human");
  assert.equal(discover(wrongWindow, endEvent(wrongWindow, { timingWindow: "phase-start" })).queued.length, 0);
});

test("declining the optional Soul Charge leaves the deck and Soul unchanged", () => {
  const f = fixture("human");
  discover(f);
  const result = decide(f, { accept: false, actionId: "decline-soul-charge" });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.state.players.human.soul.length, 0);
  assert.equal(f.state.players.human.deck.length, 2);
});

test("the marker and source location are revalidated before resolution with no partial Soul Charge", () => {
  for (const invalidate of [
    f => { f.state.players.human.giftZones = []; },
    f => { f.state.players.human.giftZones[0].zone = "rear-right"; },
    f => { f.state.players.human.rear[0] = null; f.state.players.human.drop.push(f.source); }
  ]) {
    const f = fixture("human");
    discover(f);
    invalidate(f);
    const result = decide(f, { actionId: `invalidated-${f.state.eventSequence}` });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(f.state.players.human.soul.length, 0);
    assert.equal(f.state.players.human.deck.length, 2);
  }
});

test("duplicate turn-end event does not repeat the trigger", () => {
  const f = fixture("human");
  const event = endEvent(f);
  assert.equal(discover(f, event).queued.length, 1);
  assert.equal(discover(f, event).queued.length, 0);
});
