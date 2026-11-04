"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const definition = require("./ability-definitions.js").find(item => item.id === "cfa-6666:0");

assert.ok(definition, "the official Spear-X Dragon G-zone ACT is registered");

function fixture({ side = "human", opponentGrade = 2, turnStartGrade = 3, ownGrade = 3, faceUp = false, stridePerformed = false } = {}) {
  const ids = { human: "host-player", bot: "guest-player" };
  const makePlayer = key => ({
    playerId: ids[key],
    vanguard: { uid: `vg-${key}`, cardId: `vg-${key}`, cardName: "Grade Three Vanguard", type: "Unit", grade: key === side ? ownGrade : opponentGrade, ownerPlayerId: ids[key], controllerPlayerId: ids[key] },
    gDeck: [], gZone: [], hand: [], deck: [], drop: [], soul: [], damage: [], rear: Array(5).fill(null), usedAbilities: []
  });
  const players = { human: makePlayer("human"), bot: makePlayer("bot") };
  const player = players[side], otherSide = side === "human" ? "bot" : "human";
  const source = { uid: `g-speax-${side}`, cardId: "cfa-6666", cardName: "Golden Dragon, Spear-X Dragon", type: "G Unit", grade: 4, ownerPlayerId: player.playerId, controllerPlayerId: player.playerId, faceUp, gDeckCard: true };
  player.gZone.push(source);
  const discard = { uid: `discard-${side}`, cardId: `discard-${side}`, cardName: "Cost Card", type: "Unit", grade: 1, ownerPlayerId: player.playerId, controllerPlayerId: player.playerId };
  player.hand.push(discard);
  const damage = [1, 2].map(n => ({ uid: `cb-${side}-${n}`, cardId: `cb-${side}-${n}`, ownerPlayerId: player.playerId, controllerPlayerId: player.playerId, faceDown: false }));
  player.damage.push(...damage);
  const state = {
    matchId: "speax-stride-test", stateVersion: 1, processedActionIds: [], pendingAbilities: [], pendingTurnEnd: null,
    side, phase: 3, turn: 2, turnStartGrades: { [side]: turnStartGrade }, stridePerformed,
    players
  };
  return { state, player, source, discard, damage, side };
}

function activate(value, overrides = {}) {
  const isHost = value.side === "human";
  const actorAuthUid = isHost ? "host-auth" : "guest-auth";
  const actorPlayerId = isHost ? "host-player" : "guest-player";
  return Reducer.applyManualAbilityActivation(value.state, {
    actorAuthUid,
    actionId: `activate-speax-${value.side}`,
    expectedStateVersion: value.state.stateVersion,
    payload: {
      sourceCardInstanceId: value.source.uid,
      abilityId: definition.id,
      selection: { costSelections: { cb: value.damage.map(card => card.uid), discard: [value.discard.uid], sb: [], gradeSumDiscard: [], reveal: [], dropToDeckBottom: [], ...(overrides.costSelections || {}) }, ...overrides }
    }
  }, { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" }, Engine);
}

test("Spear-X Dragon pays its printed ACT cost and strides the exact face-down G-zone instance for either seat", () => {
  for (const side of ["human", "bot"]) {
    const value = fixture({ side });
    const result = activate(value);
    assert.equal(result.ok, true, `${side}: ${JSON.stringify(result)}`);
    assert.equal(value.player.vanguard.uid, value.source.uid);
    assert.equal(value.player.vanguard.strideHeart.uid, `vg-${side}`);
    assert.equal(value.player.gZone.some(card => card.uid === value.source.uid), false);
    assert.equal(value.player.hand.some(card => card.uid === value.discard.uid), false);
    assert.equal(value.player.drop.some(card => card.uid === value.discard.uid), true);
    assert.equal(value.state.stridePerformed, true);
    assert.ok(result.events.some(event => event.type === "card.stridden" && event.cardInstanceId === value.source.uid));
    assert.ok(result.events.some(event => event.type === "card.discarded" && event.subjectCardInstanceId === value.discard.uid && event.discardReason === "ability-cost"));
  }
});

test("Spear-X Dragon rejects a non-Stride window, a face-up source, a spent Stride, or unmet base Stride grades without mutating state", () => {
  for (const value of [
    fixture({ faceUp: true }),
    fixture({ stridePerformed: true }),
    fixture({ turnStartGrade: 2 }),
    fixture({ ownGrade: 2, turnStartGrade: 3 })
  ]) {
    const before = JSON.stringify(value.state);
    const result = activate(value);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(JSON.stringify(value.state), before);
  }
  const wrongPhase = fixture();
  wrongPhase.state.phase = 4;
  const before = JSON.stringify(wrongPhase.state);
  assert.equal(activate(wrongPhase).ok, false);
  assert.equal(JSON.stringify(wrongPhase.state), before);
});

test("Spear-X Dragon rejects insufficient or forged cost selections transactionally", () => {
  const insufficient = fixture();
  insufficient.player.damage[0].faceDown = true;
  const before = JSON.stringify(insufficient.state);
  assert.equal(activate(insufficient).ok, false);
  assert.equal(JSON.stringify(insufficient.state), before);

  const forged = fixture();
  const result = activate(forged, { costSelections: { cb: ["not-a-damage-card"], discard: [forged.discard.uid] } });
  assert.equal(result.ok, false);
  assert.equal(forged.player.vanguard.uid, `vg-${forged.side}`);
  assert.equal(forged.player.gZone[0]?.uid, forged.source.uid);
});

