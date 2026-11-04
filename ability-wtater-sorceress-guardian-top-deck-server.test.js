"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function definition(cardId) { return catalog.find(card => String(card.id) === cardId); }

function instance(cardId, uid, playerId, extra = {}) {
  const card = definition(cardId) || {};
  return {
    uid, cardId, cardName: card.name || cardId, name: card.name || cardId,
    type: card.type || "Unit", grade: Number(card.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function fixture(ownerSide = "bot", sorceress = true) {
  const ownerPlayerId = ownerSide === "human" ? "player-host" : "player-guest";
  const opponentSide = ownerSide === "human" ? "bot" : "human";
  const opponentPlayerId = opponentSide === "human" ? "player-host" : "player-guest";
  const authUid = ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const opponentAuthUid = opponentSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const ability = Engine.parseCardAbilities(definition("cfa-10883")).find(item => item.id === "cfa-10883:0");
  Engine.registerAbilityDefinitions([ability.definition]);

  const source = instance("cfa-10883", "wtater-source", ownerPlayerId, { zone: "guardian", circle: "guardian", position: "rest" });
  const vanguard = instance("test-sorceress-vanguard", "wtater-vanguard", ownerPlayerId, {
    zone: "vanguard", circle: "vanguard", cardName: sorceress ? "Test Sorceress Vanguard" : "Test Other Vanguard",
    name: sorceress ? "Test Sorceress Vanguard" : "Test Other Vanguard"
  });
  const top = instance("test-top", "deck-top", ownerPlayerId);
  const bottom = instance("test-bottom", "deck-bottom", ownerPlayerId);
  const own = {
    playerId: ownerPlayerId, vanguard, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [],
    deck: [bottom, top], bind: [], guardCircle: [source], orders: [], gDeck: [], gZone: [], triggerZone: []
  };
  const opponent = {
    playerId: opponentPlayerId,
    vanguard: instance("test-opponent-vanguard", "wtater-opponent-vanguard", opponentPlayerId, { zone: "vanguard", circle: "vanguard" }),
    rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [],
    orders: [], gDeck: [], gZone: [], triggerZone: []
  };
  const state = {
    matchId: "wtater-top-deck", stateVersion: 1, eventSequence: 0, processedActionIds: [],
    processedAbilityTriggers: [], pendingAbilities: [], phase: 3, turn: 1, side: opponentSide,
    players: { [ownerSide]: own, [opponentSide]: opponent }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerPlayerId, turnPlayerId: opponentPlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerPlayerId, sourceControllerPlayerId: ownerPlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerPlayerId,
    subjectControllerPlayerId: ownerPlayerId, previousLocation: "hand", currentLocation: "guardian",
    circle: "guardian", phase: "guard", timingWindow: "guard-call"
  });
  return { ability, authUid, opponentAuthUid, ownerPlayerId, ownerSide, own, source, top, bottom, state, event };
}

function decide(f, destination, actorAuthUid = f.authUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId: `wtater-${destination || "invalid"}-${actorAuthUid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      accept: true,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id, deckDestination: destination }
    }
  }, seats, Engine);
}

test("Wtater compiles from the exact official text into a mandatory GC AUTO", () => {
  const f = fixture();
  assert.equal(f.ability.definition?.source?.patternId, "auto-gc-sorceress-top-deck-order-v1");
  assert.deepEqual(f.ability.requiredLocation, ["guardian"]);
  assert.deepEqual(f.ability.trigger.circles, ["guardian"]);
  assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-name-contains", value: "Sorceress" }]);
  assert.equal(f.ability.canDecline, false);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
});

test("the controller may put the exact revealed top card on top or bottom", () => {
  for (const side of ["human", "bot"]) {
    for (const destination of ["top", "bottom"]) {
      const f = fixture(side);
      const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.equal(discovered.queued.length, 1, `${side} ${destination}`);
      const result = decide(f, destination);
      assert.equal(result.ok, true, result.reason);
      assert.equal(f.own.deck[destination === "top" ? 1 : 0].uid, f.top.uid);
      assert.equal(f.own.deck.includes(f.bottom), true);
    }
  }
});

test("a missing Sorceress Vanguard or another card's placement does not trigger Wtater", () => {
  const wrongCondition = fixture("bot", false);
  assert.equal(Reducer.discoverAutoTriggers(wrongCondition.state, [wrongCondition.event], Engine).queued.length, 0);

  const wrongSource = fixture();
  const event = Engine.createGameEvent(wrongSource.state, {
    type: "card.placed", actingPlayerId: wrongSource.ownerPlayerId, turnPlayerId: "player-host",
    sourceCardInstanceId: "some-other-card", sourceOwnerPlayerId: wrongSource.ownerPlayerId,
    sourceControllerPlayerId: wrongSource.ownerPlayerId, cardInstanceId: wrongSource.source.uid,
    subjectCardInstanceId: wrongSource.source.uid, subjectOwnerPlayerId: wrongSource.ownerPlayerId,
    subjectControllerPlayerId: wrongSource.ownerPlayerId, previousLocation: "hand", currentLocation: "guardian",
    circle: "guardian", phase: "guard", timingWindow: "guard-call"
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [event], Engine).queued.length, 0);
});

test("another player cannot resolve the owner's choice, and an invalid deck destination is rejected", () => {
  const f = fixture("bot");
  Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  const before = f.own.deck.map(card => card.uid);
  assert.equal(decide(f, "top", f.opponentAuthUid).ok, false);
  assert.deepEqual(f.own.deck.map(card => card.uid), before);
  assert.equal(decide(f, "sideways").ok, false);
  assert.deepEqual(f.own.deck.map(card => card.uid), before);
});

test("a tampered Wtater effect or printed ability is not server-supported", () => {
  const f = fixture();
  const tamperedEffect = structuredClone(f.ability);
  tamperedEffect.definition.effects[0].requireTopCard = false;
  assert.equal(Reducer.supportsServerAbilityEffects(tamperedEffect), false);
  const tamperedText = structuredClone(f.ability);
  tamperedText.definition.printedText += " Draw a card.";
  assert.equal(Reducer.supportsServerAbilityEffects(tamperedText), false);
});

test("the browser selects and previews the current top card for Wtater", () => {
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  assert.match(app, /function abilityChoicePool\(x\)\{const reorderStep=x\.ability\.definition\?\.effects\?\.find\(item=>item\.op==="reorder-deck-card"\)/);
  assert.match(app, /cards\.length===1&&!x\.effectUid\)x\.effectUid=topCard\.uid/);
  assert.match(app, /const revealedDefinition=cardMap\.get\(revealed\.cardId\);html\+='<div class="ability-revealed-card">/);
  assert.match(app, /Your deck is empty; there is no card to reorder\./);
  assert.doesNotMatch(app, /Your deck is empty; the effect proceeds to its draw step\./);
});
