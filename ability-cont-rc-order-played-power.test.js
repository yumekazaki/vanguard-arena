"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-order-played-power-v1";
const EXPECTED = new Map([
  ["cfa-12634:1", 5000], ["cfa-8261:1", 5000], ["cfa-8262:1", 2000],
  ["cfa-8511:0", 5000], ["cfa-8848:0", 2000]
]);
const cards = loadCatalog();

function abilityFor(id) {
  const card = cards.find(item => String(item.id) === id.split(":")[0]);
  return Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
}

test("the exact five order-played Rear-Guard CONT abilities preserve their printed bonuses", () => {
  const found = new Map();
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
  }
  assert.deepEqual([...found.keys()].sort(), [...EXPECTED.keys()].sort());
  assert.equal(auditCatalog(cards).patterns[PATTERN], EXPECTED.size);
  for (const [id, amount] of EXPECTED) {
    const ability = found.get(id);
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.definition.effects, [{ op: "continuous-power", target: "source", amount, duration: "continuous", condition: { op: "order-played-this-turn" } }]);
  }
  assert.deepEqual(auditCatalog(cards).invalidCompiled, []);
});

test("order-played power is continuous only on RC, during its controller's turn, after an order", () => {
  for (const side of ["human", "bot"]) for (const [id, amount] of EXPECTED) {
    const ability = abilityFor(id);
    const result = (location, isControllerTurn, orderPlayedThisTurn) => Engine.evaluateContinuousEffects([ability], { location, isControllerTurn, orderPlayedThisTurn }).power;
    assert.equal(result("rear-guard", true, true), amount, `${side}/${id} active condition`);
    assert.equal(result("rear-guard", true, false), 0, `${side}/${id} no order`);
    assert.equal(result("rear-guard", false, true), 0, `${side}/${id} opponent turn`);
    assert.equal(result("vanguard", true, true), 0, `${side}/${id} wrong circle`);
    assert.equal(result("guardian", true, true), 0, `${side}/${id} wrong zone`);
  }
});

test("trusted battle power applies the order-played CONT to either player's exact Rear-Guard", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const makePlayer = (playerId, vanguard, rear = []) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  for (const side of ["human", "bot"]) for (const [id, amount] of EXPECTED) {
    const actor = side === "human" ? "host" : "guest", opponent = side === "human" ? "guest" : "host", otherSide = side === "human" ? "bot" : "human";
    const source = { uid: `${id}-${side}`, cardId: id.split(":")[0], cardName: id, type: "Normal Unit", unitCard: true, grade: 2, power: 10000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: actor, controllerPlayerId: actor };
    const enemy = { uid: `enemy-${id}-${side}`, cardId: "enemy-vg", cardName: "Enemy Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, ownerPlayerId: opponent, controllerPlayerId: opponent };
    const state = { matchId: `order-cont-${id}-${side}`, stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true, ordersPlayedThisTurn: 1, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
    state.players[side] = makePlayer(actor, { ...enemy, uid: `friendly-${id}-${side}`, ownerPlayerId: actor, controllerPlayerId: actor }, [{ ...source }, null, null, null, null]);
    state.players[otherSide] = makePlayer(opponent, { ...enemy });
    const result = Reducer.applyGameAction(state, { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `order-power-${id}-${side}`, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: enemy.uid } }, seats, Engine);
    assert.equal(result.ok, true, `${side}/${id}: ${result.reason}`);
    assert.equal(result.state.pendingAttack.power, 10000 + amount, `${side}/${id}`);
  }
});
