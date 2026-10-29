"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-4311", "cfa-4348", "cfa-4602", "cfa-4977"];
const TEXT = "ACT [RC] Generation Break 1: [Put this unit into your soul] Choose one of your units, and it gets power +2000 until end of turn.";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const card = id => catalog.find(entry => String(entry.id) === id);

function makeState({ side = "bot", gb = 1, sourceZone = "rear-left", opponentTarget = false } = {}) {
  const ownId = side === "bot" ? "guest-player" : "host-player";
  const otherId = side === "bot" ? "host-player" : "guest-player";
  const sourceCardId = IDS[0];
  const source = { uid: `source-${side}`, cardId: sourceCardId, ownerPlayerId: ownId, controllerPlayerId: ownId, unitCard: true, zone: sourceZone === "rear-left" ? "rear-guard" : sourceZone, circle: sourceZone, rested: false };
  const ownVanguard = sourceZone === "vanguard" ? source : { uid: `vg-${side}`, cardId: "cfa-3", cardName: "Vanguard", grade: 3, ownerPlayerId: ownId, controllerPlayerId: ownId, unitCard: true, zone: "vanguard", circle: "vanguard", turnPowerBoost: 0 };
  const own = { playerId: ownId, vanguard: ownVanguard, rear: sourceZone === "rear-left" ? [source, null, null, null, null] : Array(5).fill(null), soul: [], drop: [], hand: [], deck: [], damage: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: Array.from({ length: gb }, (_, i) => ({ uid: `g-${side}-${i}`, cardId: "g-unit", ownerPlayerId: ownId, faceUp: true, gDeckCard: true })) };
  const otherVanguard = { uid: `opp-vg-${side}`, cardId: "cfa-3", cardName: "Opponent Vanguard", grade: 3, ownerPlayerId: otherId, controllerPlayerId: otherId, unitCard: true, zone: "vanguard", circle: "vanguard" };
  const other = { playerId: otherId, vanguard: otherVanguard, rear: opponentTarget ? [{ uid: "foreign-target", cardId: "target", ownerPlayerId: otherId, controllerPlayerId: otherId, unitCard: true, circle: "rear-left", turnPowerBoost: 0 }, null, null, null, null] : Array(5).fill(null), soul: [], drop: [], hand: [], deck: [], damage: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  return { matchId: "gb-source-soul-act", stateVersion: 1, processedActionIds: [], side, phase: 4, turn: 2, players: side === "bot" ? { human: other, bot: own } : { human: own, bot: other }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null };
}

function activate(state, side, targetUid, actorAuthUid) {
  const source = state.players[side].rear.find(Boolean) || (IDS.includes(String(state.players[side].vanguard?.cardId)) ? state.players[side].vanguard : null);
  return Reducer.applyManualAbilityActivation(state, { actorAuthUid: actorAuthUid || (side === "bot" ? "auth-guest" : "auth-host"), actionId: `act-${side}-${state.stateVersion}`, expectedStateVersion: state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: `${source.cardId}:2`, selection: { targetUid } } }, seats, Engine);
}

test("four exact Rear-Guard ACT definitions preserve GB1, source-to-Soul cost, friendly target, and power duration", () => {
  for (const id of IDS) {
    const printed = card(id);
    const ability = Engine.parseCardAbilities(printed).find(item => item.id === `${id}:2`);
    assert.ok(ability, `${id}:2 exists`);
    assert.equal(ability.printedText, TEXT);
    assert.equal(ability.gb, 1);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
    assert.equal(ability.choiceStatus, "modeled");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    assert.equal(ability.definition.source.patternId, "act-rc-gb-source-to-soul-choose-friendly-unit-power-v1");
  }
});

test("host and joining player independently pay source-to-Soul and choose their own friendly power target", () => {
  for (const side of ["human", "bot"]) {
    const state = makeState({ side });
    const own = state.players[side];
    const target = own.vanguard;
    const source = own.rear[0];
    const result = activate(state, side, target.uid);
    assert.equal(result.ok, true, result.reason);
    assert.equal(own.rear[0], null);
    assert.equal(own.soul.at(-1).uid, source.uid);
    assert.equal(target.turnPowerBoost, 2000);
    assert.equal(target.turnPowerExpiry, state.players[side].playerId);
    assert.equal(state.players[side === "bot" ? "human" : "bot"].vanguard.turnPowerBoost || 0, 0);
  }
});

test("GB1, source circle, controller permission, and friendly-target restrictions reject without partial effects", () => {
  const noGb = makeState({ gb: 0 });
  const noGbBefore = JSON.stringify(noGb);
  assert.equal(activate(noGb, "bot", noGb.players.bot.vanguard.uid).reason, "activation-condition-not-met");
  assert.equal(JSON.stringify(noGb), noGbBefore);

  const wrongCircle = makeState({ sourceZone: "vanguard" });
  const wrongCircleBefore = JSON.stringify(wrongCircle);
  assert.equal(activate(wrongCircle, "bot", wrongCircle.players.bot.vanguard.uid).reason, "activation-wrong-zone");
  assert.equal(JSON.stringify(wrongCircle), wrongCircleBefore);

  const foreignTarget = makeState({ opponentTarget: true });
  const foreignBefore = JSON.stringify(foreignTarget);
  assert.equal(activate(foreignTarget, "bot", "foreign-target").ok, false);
  assert.equal(JSON.stringify(foreignTarget), foreignBefore);

  const forged = makeState();
  const forgedBefore = JSON.stringify(forged);
  assert.equal(activate(forged, "bot", forged.players.bot.vanguard.uid, "auth-host").ok, false);
  assert.equal(JSON.stringify(forged), forgedBefore);
});
