"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");

const cardId = "test-gzone-stride-window";
const abilityId = `${cardId}:0`;
const definition = {
  id: abilityId,
  cardId,
  cardName: "Test G-Zone Unit",
  kind: "ACT",
  printedText: "ACT [G zone]: Draw a card.",
  activationWindow: "stride",
  requiredLocation: ["g-zone"],
  choicesReviewed: true,
  source: { dataset: "engine regression fixture", patternId: "test-gzone-stride-window" },
  effects: [{ op: "draw", target: "controller", count: 1 }]
};
Engine.registerAbilityDefinitions([definition]);

function fixture({ phase = 3, sourceZone = "gDeck", sourceController = "host-player", faceUp = false } = {}) {
  const source = { uid: "g-unit-1", cardId, cardName: "Test G-Zone Unit", ownerPlayerId: "host-player", controllerPlayerId: sourceController, faceUp, ...(sourceZone === "gDeck" ? { gDeckCard: true } : {}) };
  const drawn = { uid: "deck-card-1", cardId: "test-draw", ownerPlayerId: "host-player", controllerPlayerId: "host-player" };
  const host = {
    playerId: "host-player", vanguard: { uid: "vg-host", cardId: "vg", cardName: "Test Vanguard", grade: 3, ownerPlayerId: "host-player", controllerPlayerId: "host-player" },
    gDeck: [], gZone: [], hand: [], deck: [drawn], drop: [], soul: [], damage: [], rear: Array(5).fill(null), usedAbilities: []
  };
  host[sourceZone].push(source);
  const guest = { playerId: "guest-player", vanguard: null, gDeck: [], gZone: [], hand: [], deck: [], drop: [], soul: [], damage: [], rear: Array(5).fill(null), usedAbilities: [] };
  return {
    source,
    state: { matchId: "gzone-window-test", stateVersion: 1, processedActionIds: [], pendingAbilities: [], side: "human", phase, turn: 1, players: { human: host, bot: guest } },
    host
  };
}

function activate(value) {
  return Reducer.applyManualAbilityActivation(value.state, {
    actorAuthUid: "host-auth",
    actionId: `activate-${value.source.uid}`,
    expectedStateVersion: value.state.stateVersion,
    payload: { sourceCardInstanceId: value.source.uid, abilityId, selection: { costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" }, Engine);
}

test("a trusted G-zone ACT ability resolves for its controller in the Stride window", () => {
  const value = fixture();
  const result = activate(value);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(value.host.hand[0]?.uid, "deck-card-1");
});

test("the same G-zone ability is rejected outside Stride and from another player's G zone", () => {
  const wrongWindow = fixture({ phase: 4 });
  assert.equal(activate(wrongWindow).ok, false);
  const foreign = fixture({ sourceController: "guest-player" });
  assert.equal(activate(foreign).ok, false);
  const faceUp = fixture({ faceUp: true });
  assert.equal(activate(faceUp).ok, false);
});

test("online request validation permits only the seated turn player to request a G-zone ACT in Stride", () => {
  const value = fixture();
  const request = {
    type: "action", action: `manual:activate-skill:${value.source.uid}:${abilityId}`,
    actionId: "remote-gzone-activation", matchId: value.state.matchId,
    actorPlayerId: "host-player", expectedStateVersion: value.state.stateVersion,
    selected: value.source.uid
  };
  assert.equal(Engine.validateRemoteActionRequest(value.state, request, "host-player").ok, true);
  const wrongPhase = fixture({ phase: 4 });
  assert.equal(Engine.validateRemoteActionRequest(wrongPhase.state, { ...request, matchId: wrongPhase.state.matchId }, "host-player").ok, false);
  assert.equal(Engine.validateRemoteActionRequest(value.state, { ...request, actorPlayerId: "guest-player" }, "guest-player").ok, false);
});

test("ordinary field ACT abilities keep their Main Phase timing", () => {
  const value = fixture({ phase: 4, sourceZone: "gDeck" });
  value.source.zone = "rear-guard";
  value.source.circle = "rear-left";
  value.state.players.human.rear[0] = value.state.players.human.gDeck.pop();
  const result = activate(value);
  assert.equal(result.ok, false, "G-zone definition cannot be moved to a field circle to change its timing");
});
