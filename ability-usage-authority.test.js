"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");

test("trusted manual activation enforces once-per-game use across turns", () => {
  const cardId = "test-once-per-game-vanguard";
  const abilityId = `${cardId}:0`;
  const printedText = "ACT [VC]: Once per game, draw a card.";
  Engine.registerAbilityDefinitions([{ id: abilityId, cardId, kind: "ACT", printedText, effects: [{ op: "draw", count: 1 }] }]);

  const source = { uid: "leader-copy", cardId, ownerPlayerId: "player-a", controllerPlayerId: "player-a", unitCard: true };
  const playerA = { playerId: "player-a", vanguard: source, rear: [], deck: [{ uid: "top-card", cardId: "drawn" }], hand: [], damage: [], drop: [], soul: [], bind: [], usedAbilities: [] };
  const playerB = { playerId: "player-b", vanguard: { uid: "opponent-vanguard", cardId: "opponent", ownerPlayerId: "player-b", controllerPlayerId: "player-b", grade: 3 }, rear: [], deck: [], hand: [], damage: [], drop: [], soul: [], bind: [] };
  const state = { matchId: "usage-room", stateVersion: 1, processedActionIds: [], eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], turn: 1, side: "host", phase: 4, players: { host: playerA, guest: playerB } };
  const seats = { hostAuthUid: "auth-a", guestAuthUid: "auth-b", hostSide: "host", guestSide: "guest" };
  const command = actionId => ({ actorAuthUid: "auth-a", actionId, expectedStateVersion: state.stateVersion, payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId, selection: {} } });

  const first = Reducer.applyManualAbilityActivation(state, command("first-use"), seats, Engine);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.deepEqual(playerA.hand.map(card => card.uid), ["top-card"]);
  assert.equal(playerA.usedAbilities.length, 1);

  state.turn = 18;
  const second = Reducer.applyManualAbilityActivation(state, command("second-use"), seats, Engine);
  assert.deepEqual(second, { ok: false, reason: "activation-usage-restriction" });
  assert.deepEqual(playerA.hand.map(card => card.uid), ["top-card"]);
  assert.equal(state.stateVersion, 2);
});
