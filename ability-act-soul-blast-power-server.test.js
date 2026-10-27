"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = ["cfa-11253", "cfa-8256", "cfa-8751"];
const TEXT = "ACT [RC]: COST [Soul Blast 2], and this unit gets power +5000 until end of turn.";
const catalog = loadCatalog(process.cwd());
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function setup(side = "bot", soulCount = 2) {
  const playerId = side === "bot" ? "guest-player" : "host-player";
  const source = { uid: `source-${side}`, cardId: FAMILY[0], ownerPlayerId: playerId, controllerPlayerId: playerId, zone: "rear-guard", circle: "rear-left" };
  const player = { playerId, vanguard: { uid: `vg-${side}`, cardId: "cfa-3", grade: 3, ownerPlayerId: playerId, controllerPlayerId: playerId },
    rear: [source, null, null, null, null], soul: Array.from({ length: soulCount }, (_, i) => ({ uid: `soul-${side}-${i}`, cardId: "cfa-3", ownerPlayerId: playerId, faceDown: false })),
    drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const opponentId = side === "bot" ? "host-player" : "guest-player";
  const opponent = { playerId: opponentId, vanguard: { uid: `vg-op-${side}`, cardId: "cfa-3", grade: 3, ownerPlayerId: opponentId, controllerPlayerId: opponentId },
    rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  return { state: { matchId: "soul-blast-act", stateVersion: 2, processedActionIds: [], turn: 3, phase: 4, side,
    players: side === "bot" ? { human: opponent, bot: player } : { human: player, bot: opponent }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null }, source };
}

function activate(state, side, source, overrides = {}) {
  return Reducer.applyManualAbilityActivation(state, { actorAuthUid: side === "bot" ? "auth-guest" : "auth-host", actionId: `act-${side}`, expectedStateVersion: state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: `${source.cardId}:0`, selection: { costSelections: { cb: [], sb: (state.players[side].soul || []).map(card => card.uid).slice(0, 2), discard: [], reveal: [] } }, ...overrides } }, seats, Engine);
}

test("the exact three-card ACT family parses Rear-Guard, Soul Blast 2, and source power", () => {
  for (const cardId of FAMILY) {
    const card = catalog.find(item => String(item.id) === cardId);
    assert.ok(card, `catalog contains ${cardId}`);
    const ability = Engine.parseCardAbilities(card).find(item => item.printedText === TEXT);
    assert.ok(ability, `${cardId} ability found`);
    assert.equal(ability.definition?.source?.patternId, "act-rc-soul-blast-two-source-power-five-thousand-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 2 }]);
    assert.equal(ability.definition.effects[0].op, "modify-power");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player pay their own Soul Blast and boost only the exact ACT source", () => {
  for (const side of ["human", "bot"]) {
    const { state, source } = setup(side);
    const result = activate(state, side, source);
    assert.equal(result.ok, true, result.reason);
    assert.equal(state.players[side].soul.length, 0);
    assert.equal(state.players[side].rear[0].uid, source.uid);
    assert.equal(state.players[side].rear[0].turnPowerBoost, 5000);
    assert.equal(state.players[side === "bot" ? "human" : "bot"].soul.length, 0);
    assert.deepEqual(state.processedActionIds, [`act-${side}`]);
  }
});

test("unpayable costs, wrong circle, and opponent activation reject without partial changes", () => {
  const insufficient = setup("bot", 1);
  let before = JSON.stringify(insufficient.state);
  let result = activate(insufficient.state, "bot", insufficient.source);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unpayable-cost/);
  assert.equal(JSON.stringify(insufficient.state), before);

  const wrongCircle = setup();
  const source = wrongCircle.state.players.bot.rear[0];
  wrongCircle.state.players.bot.rear[0] = null;
  source.circle = "vanguard";
  wrongCircle.state.players.bot.vanguard = source;
  before = JSON.stringify(wrongCircle.state);
  result = activate(wrongCircle.state, "bot", source);
  assert.equal(result.ok, false);
  assert.match(result.reason, /wrong-zone/);
  assert.equal(JSON.stringify(wrongCircle.state), before);

  const forged = setup();
  before = JSON.stringify(forged.state);
  result = Reducer.applyManualAbilityActivation(forged.state, { actorAuthUid: "auth-host", actionId: "forged", expectedStateVersion: 2,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: forged.source.uid, abilityId: `${forged.source.cardId}:0`, selection: {} } }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(forged.state), before);
});
