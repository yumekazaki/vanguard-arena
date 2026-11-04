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
const definition = catalog.find(card => String(card.id) === "cfa-10873");

function instance(cardId, uid, playerId, extra = {}) {
  const card = catalog.find(item => String(item.id) === cardId) || {};
  return { uid, cardId, cardName: card.name || cardId, name: card.name || cardId,
    type: card.type || "Unit", grade: Number(card.grade || 0), ownerPlayerId: playerId,
    controllerPlayerId: playerId, ...extra };
}

function fixture(ownerSide = "bot", markers = ["rear-left", "rear-right", "rear-back-left"]) {
  const ownerPlayerId = ownerSide === "human" ? "player-host" : "player-guest";
  const opponentSide = ownerSide === "human" ? "bot" : "human";
  const opponentPlayerId = opponentSide === "human" ? "player-host" : "player-guest";
  const authUid = ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const opponentAuthUid = opponentSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const ability = Engine.parseCardAbilities(definition).find(item => item.id === "cfa-10873:0");
  Engine.registerAbilityDefinitions([ability.definition]);
  const source = instance("cfa-10873", "lahbart-source", ownerPlayerId, { zone: "rear-guard", circle: "rear-left" });
  const top = instance("test-top", "deck-top", ownerPlayerId);
  const own = {
    playerId: ownerPlayerId,
    vanguard: instance("test-vanguard", "lahbart-vanguard", ownerPlayerId, { zone: "vanguard", circle: "vanguard", cardName: "Test Vanguard", name: "Test Vanguard" }),
    rear: [source, null, null, null, null], hand: [], drop: [], soul: [instance("test-soul", "soul-cost", ownerPlayerId)],
    damage: [instance("test-damage", "cb-cost", ownerPlayerId, { faceDown: false })], deck: [top], bind: [],
    guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [], accelZones: 0,
    giftZones: markers.map(zone => ({ type: "Dragontree", zone }))
  };
  const opponent = {
    playerId: opponentPlayerId, vanguard: instance("test-opponent-vanguard", "opponent-vanguard", opponentPlayerId, { zone: "vanguard", circle: "vanguard" }),
    rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [],
    orders: [], gDeck: [], gZone: [], triggerZone: [], accelZones: 0, giftZones: []
  };
  const state = { matchId: "lahbart-three-markers", stateVersion: 1, eventSequence: 0, processedActionIds: [],
    processedAbilityTriggers: [], pendingAbilities: [], phase: 3, turn: 1, side: opponentSide,
    players: { [ownerSide]: own, [opponentSide]: opponent } };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerPlayerId, turnPlayerId: opponentPlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerPlayerId, sourceControllerPlayerId: ownerPlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerPlayerId,
    subjectControllerPlayerId: ownerPlayerId, previousLocation: "hand", currentLocation: "rear-guard",
    circle: "rear-left", phase: "main", timingWindow: "rear-placement"
  });
  return { ability, authUid, opponentAuthUid, ownerPlayerId, ownerSide, own, source, top, state, event };
}

function decide(f, accept = true, actorAuthUid = f.authUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `lahbart-${accept ? "accept" : "decline"}-${actorAuthUid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
      costSelections: { cb: ["cb-cost"], sb: ["soul-cost"], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("Lahbart compiles as a source-specific Rear-Guard AUTO with the printed condition, costs, and draw", () => {
  const f = fixture();
  assert.equal(f.ability.definition?.source?.patternId, "auto-rc-three-dragontree-markers-counter-soul-draw-v1");
  assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(f.ability.trigger.circles, ["rear-guard"]);
  assert.deepEqual(f.ability.conditions, [{ type: "controller-dragontree-marker-count-at-least", count: 3 }]);
  assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 1 }, { type: "soul-blast", count: 1 }]);
  assert.equal(f.ability.canDecline, true);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
});

test("three distinct Dragontree Rear-Guard markers trigger and resolve for host and joining player", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, side);
    const result = decide(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.own.hand.some(card => card.uid === f.top.uid), true);
    assert.equal(f.own.deck.length, 0);
    assert.equal(f.own.damage[0].faceDown, true);
    assert.equal(f.own.soul.length, 0);
    assert.equal(f.own.drop.length, 1);
  }
});

test("fewer than three distinct Rear-Guard markers do not trigger", () => {
  const f = fixture("bot", ["rear-left", "rear-right"]);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
});

test("an Accel Circle Dragontree marker counts with Rear-Guard markers", () => {
  const f = fixture("bot", ["rear-left", "rear-right", "accel-1"]);
  f.own.accelZones = 1;
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
});

test("Vanguard markers and duplicate markers on one circle do not meet the three-RC condition", () => {
  const f = fixture("bot", ["rear-left", "rear-right", "vanguard"]);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  const duplicate = fixture("bot", ["rear-left", "rear-right", "rear-right"]);
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 0);
});

test("a different card placement or Vanguard placement does not trigger Lahbart", () => {
  const wrongCircle = fixture();
  const vanguardEvent = Engine.createGameEvent(wrongCircle.state, {
    ...wrongCircle.event, type: "card.placed", currentLocation: "vanguard", circle: "vanguard"
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [vanguardEvent], Engine).queued.length, 0);
  const wrongSource = fixture();
  const otherSourceEvent = Engine.createGameEvent(wrongSource.state, {
    ...wrongSource.event, sourceCardInstanceId: "other-card-instance", sourceControllerPlayerId: wrongSource.ownerPlayerId
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [otherSourceEvent], Engine).queued.length, 0);
});

test("insufficient cost is rejected without partially resolving the draw", () => {
  const f = fixture();
  Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  f.own.damage[0].faceDown = true;
  const result = decide(f);
  assert.equal(result.ok, false);
  assert.equal(f.own.hand.length, 0);
  assert.equal(f.own.deck[0].uid, f.top.uid);
  assert.equal(f.own.soul.length, 1);
});

test("the controller can decline the cost without paying or drawing", () => {
  const f = fixture();
  Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  const result = decide(f, false);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.own.hand.length, 0);
  assert.equal(f.own.damage[0].faceDown, false);
  assert.equal(f.own.soul.length, 1);
});

test("the opponent cannot resolve the controller's Lahbart AUTO", () => {
  const f = fixture();
  Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  const result = decide(f, true, f.opponentAuthUid);
  assert.equal(result.ok, false);
  assert.equal(f.own.hand.length, 0);
  assert.equal(f.own.damage[0].faceDown, false);
  assert.equal(f.own.soul.length, 1);
});

test("browser condition context counts Dragontree markers by distinct Rear-Guard circle", () => {
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  assert.match(app, /function dragontreeMarkerCountOnRearGuard\(player\)/);
  assert.match(app, /controllerDragontreeMarkerCountOnRearGuard:dragontreeMarkerCountOnRearGuard\(player\)/);
});
