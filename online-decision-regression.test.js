"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateRemoteActionRequest } = require("./ability-engine.js");

function request(action, actionId, overrides = {}) {
  return {
    type: "action",
    action,
    actionId,
    matchId: "joiner-decision-room",
    actorPlayerId: "joining-player",
    expectedStateVersion: 7,
    selected: null,
    ...overrides
  };
}

function state() {
  return {
    matchId: "joiner-decision-room",
    stateVersion: 7,
    processedActionIds: [],
    side: "human",
    phase: 5,
    players: {
      human: { playerId: "host-player", vanguard: { uid: "host-vanguard" }, rear: [], hand: [], damage: [], gDeck: [] },
      bot: {
        playerId: "joining-player",
        vanguard: { uid: "joiner-vanguard" },
        rear: [],
        hand: [{ uid: "heal-cost" }],
        damage: [{ uid: "joiner-damage" }],
        gDeck: [{ uid: "joiner-g-unit", faceUp: false, gDeckCard: true }]
      }
    }
  };
}

test("joining player can choose their own Heal trigger target and skip", () => {
  const game = state();
  game.pendingTrigger = { side: "bot", stage: "heal-target" };
  assert.deepEqual(
    validateRemoteActionRequest(game, request("manual:trigger-pick:joiner-damage", "heal-choice"), "joining-player"),
    { ok: true }
  );
  assert.equal(
    validateRemoteActionRequest(game, request("manual:trigger-pick:host-vanguard", "foreign-heal-choice"), "joining-player").reason,
    "invalid-heal-target"
  );
  assert.deepEqual(
    validateRemoteActionRequest(game, request("manual:trigger-skip", "skip-heal"), "joining-player"),
    { ok: true }
  );
  assert.equal(
    validateRemoteActionRequest(game, request("draw", "unrelated-action"), "joining-player").reason,
    "resolution-in-progress"
  );
});

test("joining player can reveal and flip only their own G-deck card", () => {
  const game = state();
  assert.deepEqual(validateRemoteActionRequest(game, request("manual:gdeck-reveal:joiner-g-unit", "reveal-g"), "joining-player"), { ok: true });
  assert.deepEqual(validateRemoteActionRequest(game, request("manual:gdeck-flip-up:joiner-g-unit", "flip-g"), "joining-player"), { ok: true });
  assert.equal(validateRemoteActionRequest(game, request("manual:gdeck-reveal:host-card", "foreign-reveal"), "joining-player").reason, "gdeck-card-not-owned");
});

test("joining player can pay their own G-Guard cost", () => {
  const game = state();
  game.pendingAttack = { attackerSide: "human", defenderSide: "bot", defenderDone: false };
  assert.deepEqual(
    validateRemoteActionRequest(game, request("manual:g-guard:joiner-g-unit:heal-cost", "joiner-g-guard"), "joining-player"),
    { ok: true }
  );
  assert.equal(
    validateRemoteActionRequest(game, request("manual:g-guard:joiner-g-unit:heal-cost", "host-g-guard", { actorPlayerId: "host-player" }), "joining-player").reason,
    "wrong-actor"
  );
});
