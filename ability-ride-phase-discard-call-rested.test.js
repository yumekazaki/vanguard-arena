"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const IDS = ["cfa-12252", "cfa-12264", "cfa-12275", "cfa-12351", "cfa-12355", "cfa-12374"];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
function fixture(id, side = "bot") {
  const definition = catalog.find(card => card.id === id), parsed = Engine.parseCardAbilities(definition)[0];
  Engine.registerAbilityDefinitions([parsed.definition]);
  const playerId = side === "human" ? "player-host" : "player-guest", otherSide = side === "human" ? "bot" : "human";
  const source = { uid: `source-${id}-${side}`, cardId: id, cardName: definition.name, type: definition.type || "Unit", ownerPlayerId: playerId, controllerPlayerId: playerId };
  const player = { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], drop: [source], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: side === "human" ? "player-guest" : "player-host", vanguard: null, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: "ride-discard-call", stateVersion: 3, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 1, phase: "ride", side, players: { [side]: player, [otherSide]: opponent } };
  const event = Engine.createGameEvent(state, { type: "card.discarded", actingPlayerId: playerId, turnPlayerId: playerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId, previousLocation: "hand", currentLocation: "drop", phase: "ride", timingWindow: "ride-cost" });
  return { definition, parsed, source, player, opponent, state, event, side, playerId };
}
function decide(f, accept, actionId) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? "auth-host" : "auth-guest", actionId, expectedStateVersion: f.state.stateVersion, payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.parsed.id, ...(accept ? { callZone: "rear-left" } : {}) } } }, seats, Engine);
}

test("six real ride-phase discard AUTO definitions pass exact authoritative gates", () => {
  for (const id of IDS) {
    const f = fixture(id);
    assert.equal(Reducer.supportsServerAbilityEffects(f.parsed), true, id);
    const forged = structuredClone(f.parsed); forged.definition.effects[0].position = "stand";
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false, `${id} forged effect`);
    const wrongText = structuredClone(f.parsed); wrongText.definition.printedText = "AUTO: When this card is discarded from hand, call it to RC as rest.";
    assert.equal(Reducer.supportsServerAbilityEffects(wrongText), false, `${id} wrong text`);
  }
});

test("exact source discarded from hand during its controller's Ride Phase prompts only that player and calls rested", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = decide(f, true, `resolve-${id}-${side}`);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.player.drop.some(card => card.uid === f.source.uid), false);
    assert.equal(f.player.rear[0].uid, f.source.uid);
    assert.equal(f.player.rear[0].rested, true);
    assert.equal(f.opponent.rear.every(card => !card), true);
  }
});

test("discard outside the Ride Phase, another card's discard, and duplicate events do not activate the source", () => {
  for (const id of IDS) {
    for (const change of [{ phase: "stride" }, { sourceCardInstanceId: "different-card", subjectCardInstanceId: "different-card", cardInstanceId: "different-card" }]) {
      const f = fixture(id), wrong = Object.freeze({ ...f.event, ...change, eventId: `wrong-${id}-${JSON.stringify(change)}` });
      assert.equal(Reducer.discoverAutoTriggers(f.state, [wrong], Engine).queued.length, 0);
      assert.equal(f.player.rear.every(card => !card), true);
    }
    const f = fixture(id);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
    const declined = decide(f, false, `decline-${id}`);
    assert.equal(declined.ok, true, JSON.stringify(declined));
    assert.equal(f.player.drop[0].uid, f.source.uid);
  }
});

test("missing legal circle rejects resolution without moving the discarded source", () => {
  const f = fixture(IDS[0]);
  f.player.rear = Array(5).fill(null).map(() => ({ uid: "locked", locked: true }));
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(f.state.pendingAbility ?? null, null);
  assert.equal(f.player.drop.some(card => card.uid === f.source.uid), true);
  assert.equal(f.player.rear.every(card => card.locked), true);
});
