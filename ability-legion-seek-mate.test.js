"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const Worker = require("./supabase/functions/match-worker/worker-core.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

function makeMatch() {
  const leader = { uid: "leader-1", cardId: "cfa-1934", cardName: "Brawler, Skybeat Dragon", grade: 3, ownerPlayerId: "player-a", controllerPlayerId: "player-a", position: "stand" };
  const playerA = {
    playerId: "player-a", vanguard: leader, rear: Array(5).fill(null), deck: [
      { uid: "mate-in-deck", cardId: "mate", cardName: "Brawler, Skyhowl Dragon", grade: 2, ownerPlayerId: "player-a", controllerPlayerId: "player-a" },
      { uid: "deck-other", cardId: "other", cardName: "Other", ownerPlayerId: "player-a", controllerPlayerId: "player-a" }
    ],
    hand: [], damage: [], drop: [1, 2, 3, 4].map(index => ({ uid: `drop-${index}`, cardId: `drop-${index}`, cardName: `Drop ${index}`, ownerPlayerId: "player-a", controllerPlayerId: "player-a" })),
    soul: [], bind: [], usedAbilities: [], orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck: [], gZone: [], removed: []
  };
  const playerB = { playerId: "player-b", vanguard: { uid: "opp-vg", cardId: "opp", cardName: "Opponent", grade: 3, ownerPlayerId: "player-b", controllerPlayerId: "player-b" }, rear: Array(5).fill(null), deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck: [], gZone: [], removed: [] };
  return { leader, playerA, playerB, state: { matchId: "legion-test", stateVersion: 1, processedActionIds: [], eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], turn: 1, side: "host", phase: 4, players: { host: playerA, guest: playerB } } };
}

const seats = { hostAuthUid: "auth-a", guestAuthUid: "auth-b", hostSide: "host", guestSide: "guest" };
const abilityId = "cfa-1934:0";
const command = (state, leader, actionId, selection, actorAuthUid = "auth-a") => ({ actorAuthUid, actionId, expectedStateVersion: state.stateVersion, payload: { sourceCardInstanceId: leader.uid, abilityId, selection } });

test("exact legacy Seek Mate definitions cover every matching catalog ability and preserve once-per-game rules", () => {
  let matches = 0;
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== "act-seek-mate-legion-v1") continue;
    matches++;
    assert.equal(ability.kind, "ACT", card.id);
    assert.equal(ability.once, true, card.id);
    assert.deepEqual(ability.usageRestriction, { type: "once-per-game", scope: "ability-instance", reset: "game" }, card.id);
    assert.deepEqual(ability.conditions, [
      { type: "source-never-legioned" },
      { type: "opponent-vanguard-grade-at-least", count: 3 },
      { type: "controller-drop-count-at-least", count: 4 }
    ], card.id);
  }
  assert.equal(matches, 101);
});

test("Legion AUTO trigger matching is tied to the exact leader or the controller's Vanguard event", () => {
  const own = Engine.parseCardAbilities({ id: "own-legion-auto", text: "AUTO [VC]: When this unit Legion, draw a card." })[0];
  assert.equal(own.trigger.eventType, "unit.legioned");
  const event = { type: "unit.legioned", sourceCardInstanceId: "leader-a", subjectCardInstanceId: "leader-a", subjectControllerPlayerId: "player-a", currentLocation: "vanguard" };
  assert.equal(Engine.eventMatchesAbilityTrigger(own, "legion", event, "leader-a", "vanguard", "vanguard", "player-a"), true);
  assert.equal(Engine.eventMatchesAbilityTrigger(own, "legion", event, "different-leader", "vanguard", "vanguard", "player-a"), false);
  const broad = Engine.parseCardAbilities({ id: "vanguard-legion-auto", text: "AUTO [RC]: When your vanguard Legion, draw a card." })[0];
  assert.equal(broad.trigger.eventType, "unit.legioned");
  assert.equal(Engine.eventMatchesAbilityTrigger(broad, "legion", event, "rear-guard-source", "rear-left", "vanguard", "player-a"), true);
});

test("Seek Mate ACT returns four owned Drop cards, searches the exact mate, and records one game use", () => {
  const { state, leader, playerA } = makeMatch();
  const selection = { legionDropUids: ["drop-1", "drop-2", "drop-3", "drop-4"], effectUid: "mate-in-deck" };
  const result = Reducer.applyManualAbilityActivation(state, command(state, leader, "legion-once", selection), seats, Engine);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(playerA.drop.length, 0);
  assert.equal(playerA.deck.some(card => card.uid === "mate-in-deck"), false);
  assert.equal(leader.legionMate.uid, "mate-in-deck");
  assert.equal(leader.legionMateInstanceId, "mate-in-deck");
  assert.equal(leader.legionMate.legionLeaderInstanceId, leader.uid);
  assert.equal(leader.everLegioned, true);
  assert.equal(playerA.deck.length, 5);
  assert.equal(playerA.usedAbilities.length, 1);
  assert.equal(Engine.locateCardInstance(state, "mate-in-deck").legionRole, "mate");
  const canonical = Worker.validateCanonicalMatchState(state, state.stateVersion, { hostSide: "host", guestSide: "guest" });
  assert.equal(canonical.ok, true, JSON.stringify(canonical));
  assert.equal(canonical.cardCount, 8);
  state.turn++;
  const repeated = Reducer.applyManualAbilityActivation(state, command(state, leader, "legion-twice", selection), seats, Engine);
  assert.deepEqual(repeated, { ok: false, reason: "activation-usage-restriction" });
});

test("Seek Mate rejects wrong mate names and does not partially pay its four-card cost", () => {
  const { state, leader, playerA } = makeMatch();
  playerA.deck[0].cardName = "Not the printed mate";
  const beforeDrop = playerA.drop.map(card => card.uid);
  const beforeDeck = playerA.deck.map(card => card.uid);
  const result = Reducer.applyManualAbilityActivation(state, command(state, leader, "legion-wrong-mate", { legionDropUids: beforeDrop, effectUid: "mate-in-deck" }), seats, Engine);
  assert.equal(result.ok, false);
  assert.deepEqual(playerA.drop.map(card => card.uid), beforeDrop);
  assert.deepEqual(playerA.deck.map(card => card.uid), beforeDeck);
  assert.equal(playerA.usedAbilities.length, 0);
  assert.equal(leader.legionMate, undefined);
});

test("joining player can activate their own Seek Mate without host approval", () => {
  const { state, playerB } = makeMatch();
  playerB.vanguard = { uid: "guest-legion-leader", cardId: "cfa-1934", cardName: "Brawler, Skybeat Dragon", grade: 3, ownerPlayerId: "player-b", controllerPlayerId: "player-b", position: "stand" };
  playerB.drop = [1, 2, 3, 4].map(index => ({ uid: `guest-drop-${index}`, cardId: `gd-${index}`, cardName: `Guest Drop ${index}`, ownerPlayerId: "player-b", controllerPlayerId: "player-b" }));
  playerB.deck = [{ uid: "guest-mate", cardId: "mate", cardName: "Brawler, Skyhowl Dragon", grade: 2, ownerPlayerId: "player-b", controllerPlayerId: "player-b" }];
  state.side = "guest";
  const result = Reducer.applyManualAbilityActivation(state, command(state, playerB.vanguard, "guest-legion", { legionDropUids: playerB.drop.map(card => card.uid), effectUid: "guest-mate" }, "auth-b"), seats, Engine);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(playerB.vanguard.legionMate.uid, "guest-mate");
  assert.equal(playerB.usedAbilities.length, 1);
  assert.equal(state.players.host.usedAbilities?.length || 0, 0);
});

test("Seek Mate can search a matching card among the four cards just returned from Drop", () => {
  const { state, leader, playerA } = makeMatch();
  playerA.deck = [{ uid: "deck-other", cardId: "other", cardName: "Other", ownerPlayerId: "player-a", controllerPlayerId: "player-a" }];
  playerA.drop[2].cardId = "mate-from-drop";
  playerA.drop[2].cardName = "Brawler, Skyhowl Dragon";
  const result = Reducer.applyManualAbilityActivation(state, command(state, leader, "legion-returned-mate", { legionDropUids: playerA.drop.map(card => card.uid), effectUid: playerA.drop[2].uid }), seats, Engine);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(leader.legionMate.uid, "drop-3");
  assert.equal(playerA.deck.some(card => card.uid === "drop-3"), false);
  assert.equal(playerA.deck.length, 4);
});

test("Seek Mate may resolve without a mate when no matching card is selected", () => {
  const { state, leader, playerA } = makeMatch();
  const result = Reducer.applyManualAbilityActivation(state, command(state, leader, "legion-no-mate", { legionDropUids: playerA.drop.map(card => card.uid), effectUid: null }), seats, Engine);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(leader.legionMate, undefined);
  assert.equal(leader.everLegioned, undefined);
  assert.equal(playerA.drop.length, 0);
  assert.equal(playerA.deck.length, 6);
  assert.equal(playerA.usedAbilities.length, 1);
});

test("trusted resolution queues a Legion AUTO for the exact player and leader that Legioned", () => {
  const { state, leader, playerA } = makeMatch();
  const reviewedAct = Engine.getReviewedAbilityDefinitionsForCard("cfa-1934").find(item => item.id === abilityId);
  const syntheticCardId = "test-legion-auto-leader";
  Engine.registerAbilityDefinitions([
    { ...reviewedAct, id: `${syntheticCardId}:0`, cardId: syntheticCardId },
    { id: `${syntheticCardId}:1`, cardId: syntheticCardId, kind: "AUTO", printedText: "AUTO [VC]: When this unit Legion, draw a card.", effects: [{ op: "draw", count: 1 }] }
  ]);
  leader.cardId = syntheticCardId;
  const result = Reducer.applyManualAbilityActivation(state, { ...command(state, leader, "legion-queues-auto", { legionDropUids: playerA.drop.map(card => card.uid), effectUid: "mate-in-deck" }), payload: { ...command(state, leader, "legion-queues-auto", {}, "auth-a").payload, abilityId: `${syntheticCardId}:0`, selection: { legionDropUids: playerA.drop.map(card => card.uid), effectUid: "mate-in-deck" } } }, seats, Engine);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.events.some(event => event.type === "unit.legioned"), JSON.stringify(result.events));
  assert.equal(state.pendingAbility?.side, "host");
  assert.equal(state.pendingAbility?.instance.uid, leader.uid);
  assert.equal(state.pendingAbility?.ability.id, `${syntheticCardId}:1`);
});
