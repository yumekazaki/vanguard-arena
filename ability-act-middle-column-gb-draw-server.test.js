"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_IDS = ["cfa-4023", "cfa-4101", "cfa-4614", "cfa-5080"];
const TEXT = "ACT [RC in the middle column] Generation Break 1: [Counter Blast 1 & Put this unit into your soul] Draw a card.";
const cards = loadCatalog(process.cwd());

function stateFor({ side = "bot", circle = "rear-back-center", gb = 1, resources = true } = {}) {
  const playerId = side === "bot" ? "guest-player" : "host-player";
  const source = { uid: `source-${side}`, cardId: "cfa-4023", ownerPlayerId: playerId, controllerPlayerId: playerId, zone: "rear-guard", circle };
  const player = { playerId, vanguard: { uid: `vg-${side}`, cardId: "cfa-3", grade: 3, ownerPlayerId: playerId, controllerPlayerId: playerId },
    rear: [null, null, null, circle === "rear-back-center" ? source : null, circle === "rear-left" ? source : null],
    soul: [], drop: [], hand: [], deck: [{ uid: `draw-${side}`, cardId: "cfa-3", ownerPlayerId: playerId }],
    damage: resources ? [{ uid: `damage-${side}`, cardId: "cfa-3", faceDown: false, ownerPlayerId: playerId }] : [],
    bind: [], orders: [], guardCircle: [], gDeck: [], gZone: Array.from({ length: gb }, (_, index) => ({ uid: `g-${side}-${index}`, cardId: "g-unit", faceUp: true, ownerPlayerId: playerId })) };
  const opponentId = side === "bot" ? "host-player" : "guest-player";
  const opponent = { playerId: opponentId, vanguard: { uid: `vg-op-${side}`, cardId: "cfa-3", grade: 3, ownerPlayerId: opponentId, controllerPlayerId: opponentId },
    rear: Array(5).fill(null), soul: [], drop: [], hand: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  return { matchId: "middle-column-act", stateVersion: 1, eventSequence: 0, processedActionIds: [], side, phase: 4, turn: 2,
    players: side === "bot" ? { human: opponent, bot: player } : { human: player, bot: opponent }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null };
}

function activate(state, side, selection = {}) {
  const actorAuthUid = side === "bot" ? "auth-guest" : "auth-host";
  const source = state.players[side].rear[3] || state.players[side].rear[4];
  return Reducer.applyManualAbilityActivation(state, { actorAuthUid, actionId: `activate-${side}`, expectedStateVersion: state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: "cfa-4023:2", selection: { costSelections: { cb: selection.cb || [`damage-${side}`], sb: [], discard: [], reveal: [] } } } },
    { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
}

test("the exact four-card compiler preserves middle-circle, GB1, cost, and draw requirements", () => {
  const matched = [];
  for (const id of CARD_IDS) {
    const card = cards.find(item => String(item.id) === id);
    assert.ok(card, `catalog contains ${id}`);
    const ability = Engine.parseCardAbilities(card).find(item => item.printedText === TEXT);
    assert.ok(ability, `${id} has the expected ability text`);
    assert.equal(ability.definition?.source?.patternId, "act-middle-column-gb-counter-blast-source-soul-draw-v1");
    assert.equal(ability.gb, 1);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.requiredCircle, ["rear-back-center"]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }, { type: "source-to-soul", count: 1 }]);
    assert.deepEqual(ability.definition.effects, [{ op: "draw", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    matched.push(ability.id);
  }
  assert.equal(new Set(matched).size, 4);
  assert.equal(Engine.parseCardAbilities({ id: "cfa-4023", text: TEXT.replace("middle column", "left column") })[0].definition, null);
  assert.equal(Engine.parseCardAbilities({ id: "cfa-999999", text: TEXT })[0].definition, null);
});

test("host and joining player independently pay their own costs and draw when the exact center Rear-Guard meets GB1", () => {
  for (const side of ["human", "bot"]) {
    const state = stateFor({ side });
    const result = activate(state, side);
    assert.equal(result.ok, true, result.reason);
    const player = state.players[side];
    const other = state.players[side === "bot" ? "human" : "bot"];
    assert.equal(player.rear[3], null);
    assert.equal(player.soul.at(-1).uid, `source-${side}`);
    assert.equal(player.hand.at(-1).uid, `draw-${side}`);
    assert.equal(player.damage[0].faceDown, true);
    assert.deepEqual(other.soul, []);
    assert.deepEqual(other.hand, []);
    assert.deepEqual(state.processedActionIds, [`activate-${side}`]);
  }
});

test("illegal circle, insufficient Generation Break, unavailable Counter Blast, and wrong-player requests do not partially resolve", () => {
  const cases = [
    ["wrong circle", stateFor({ circle: "rear-left" }), "activation-wrong-zone"],
    ["no GB", stateFor({ gb: 0 }), "activation-condition-not-met"],
    ["no face-up damage", stateFor({ resources: false }), "activation-unpayable-cost"],
  ];
  for (const [label, state, expected] of cases) {
    const before = JSON.stringify(state);
    const result = activate(state, "bot");
    assert.equal(result.ok, false, `${label}: ${result.reason}`);
    assert.ok(String(result.reason).includes(expected), `${label}: ${result.reason}`);
    assert.equal(JSON.stringify(state), before, `${label} must not pay or resolve anything`);
  }
  const wrongActor = stateFor();
  const before = JSON.stringify(wrongActor);
  const source = wrongActor.players.bot.rear[3];
  const rejected = Reducer.applyManualAbilityActivation(wrongActor, { actorAuthUid: "auth-host", actionId: "wrong-owner", expectedStateVersion: 1,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: "cfa-4023:2", selection: {} } },
  { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(wrongActor), before);
});
