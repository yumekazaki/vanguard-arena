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
const mainPhaseCardId = "test-gzone-main-window";
const mainPhaseAbilityId = `${mainPhaseCardId}:0`;
const mainPhaseDefinition = {
  ...definition,
  id: mainPhaseAbilityId,
  cardId: mainPhaseCardId,
  activationWindow: "main",
  source: { dataset: "engine regression fixture", patternId: "test-gzone-explicit-main-window" }
};
const defaultWindowCardId = "test-gzone-default-window";
const defaultWindowAbilityId = `${defaultWindowCardId}:0`;
const defaultWindowDefinition = { ...definition, id: defaultWindowAbilityId, cardId: defaultWindowCardId };
delete defaultWindowDefinition.activationWindow;
Engine.registerAbilityDefinitions([definition, mainPhaseDefinition, defaultWindowDefinition]);

function fixture({ phase = 3, sourceZone = "gDeck", sourceController, faceUp = false, side = "human", ability = definition } = {}) {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const source = { uid: `g-unit-${side}`, cardId: ability.cardId, cardName: "Test G-Zone Unit", ownerPlayerId: playerId, controllerPlayerId: sourceController || playerId, faceUp, ...(sourceZone === "gDeck" ? { gDeckCard: true } : {}) };
  const drawn = { uid: `deck-card-${side}`, cardId: "test-draw", ownerPlayerId: playerId, controllerPlayerId: playerId };
  const host = {
    playerId: "host-player", vanguard: { uid: "vg-host", cardId: "vg", cardName: "Test Vanguard", grade: 3, ownerPlayerId: "host-player", controllerPlayerId: "host-player" },
    gDeck: [], gZone: [], hand: [], deck: side === "human" ? [drawn] : [], drop: [], soul: [], damage: [], rear: Array(5).fill(null), usedAbilities: []
  };
  const guest = { playerId: "guest-player", vanguard: null, gDeck: [], gZone: [], hand: [], deck: side === "bot" ? [drawn] : [], drop: [], soul: [], damage: [], rear: Array(5).fill(null), usedAbilities: [] };
  const player = side === "human" ? host : guest;
  player[sourceZone].push(source);
  return {
    source,
    abilityId: ability.id,
    player,
    side,
    state: { matchId: "gzone-window-test", stateVersion: 1, processedActionIds: [], pendingAbilities: [], side, phase, turn: 1, players: { human: host, bot: guest } }
  };
}

function activate(value) {
  return Reducer.applyManualAbilityActivation(value.state, {
    actorAuthUid: value.side === "human" ? "host-auth" : "guest-auth",
    actionId: `activate-${value.source.uid}`,
    expectedStateVersion: value.state.stateVersion,
    payload: { sourceCardInstanceId: value.source.uid, abilityId: value.abilityId, selection: { costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" }, Engine);
}

test("a trusted G-zone ACT ability resolves for its controller in the Stride window", () => {
  const value = fixture();
  const result = activate(value);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(value.player.hand[0]?.uid, "deck-card-human");
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

test("online request validation honors a trusted Main Phase G-zone ACT for its own turn player", () => {
  for (const side of ["human", "bot"]) {
    const value = fixture({ phase: 4, side, ability: mainPhaseDefinition });
    const actorPlayerId = value.player.playerId;
    const request = {
      type: "action",
      action: `manual:activate-skill:${value.source.uid}:${value.abilityId}`,
      actionId: `remote-main-gzone-${side}`,
      matchId: value.state.matchId,
      actorPlayerId,
      expectedStateVersion: value.state.stateVersion,
      selected: value.source.uid
    };
    assert.equal(Engine.validateRemoteActionRequest(value.state, request, actorPlayerId).ok, true, side);

    const wrongPhase = fixture({ phase: 3, side, ability: mainPhaseDefinition });
    assert.equal(Engine.validateRemoteActionRequest(wrongPhase.state, {
      ...request,
      matchId: wrongPhase.state.matchId,
      actorPlayerId: wrongPhase.player.playerId,
      selected: wrongPhase.source.uid,
      action: `manual:activate-skill:${wrongPhase.source.uid}:${wrongPhase.abilityId}`
    }, wrongPhase.player.playerId).reason, "wrong-phase", side);
  }
});

test("ordinary field ACT abilities keep their Main Phase timing", () => {
  const value = fixture({ phase: 4, sourceZone: "gDeck" });
  value.source.zone = "rear-guard";
  value.source.circle = "rear-left";
  value.state.players.human.rear[0] = value.state.players.human.gDeck.pop();
  const result = activate(value);
  assert.equal(result.ok, false, "G-zone definition cannot be moved to a field circle to change its timing");
});

test("an explicitly Main Phase G-zone ACT resolves for the controller in either seat", () => {
  for (const side of ["human", "bot"]) {
    const value = fixture({ phase: 4, side, ability: mainPhaseDefinition });
    const result = activate(value);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(value.player.hand[0]?.uid, `deck-card-${side}`);
    assert.deepEqual(value.player.deck, []);
  }
});

test("an explicitly Main Phase G-zone ACT is rejected in the Stride Step without mutation", () => {
  const value = fixture({ phase: 3, ability: mainPhaseDefinition });
  const before = JSON.stringify(value.state);
  const result = activate(value);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "wrong-timing-window");
  assert.equal(JSON.stringify(value.state), before);
});

test("a G-zone ACT without an explicit timing window keeps the Stride Step default", () => {
  const legal = fixture({ phase: 3, ability: defaultWindowDefinition });
  const result = activate(legal);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(legal.player.hand[0]?.uid, "deck-card-human");

  const wrongWindow = fixture({ phase: 4, ability: defaultWindowDefinition });
  const before = JSON.stringify(wrongWindow.state);
  const rejected = activate(wrongWindow);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "wrong-timing-window");
  assert.equal(JSON.stringify(wrongWindow.state), before);
});
