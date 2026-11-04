"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");
engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const cases = [
  { orderId: "cfa-9115", abilityId: "cfa-9115:1", grade: 2, text: 'CONT [Order Zone]: All of your grade 2 rear-guards get "Boost".' },
  { orderId: "cfa-9042", abilityId: "cfa-9042:0", grade: 3, text: 'CONT [Order Zone]: All of your grade 3 rear-guards get "Boost".' }
];

function makeState({ orderId = "cfa-9115", orderSide = "host", targetSide = orderSide, targetGrade = 2,
  faceDown = false, orderInOrderZone = true, extraOrders = 0, turnSide = "guest" } = {}) {
  const host = { playerId: "host", vanguard: null, rear: [], orders: [], hand: [], drop: [], soul: [], damage: [], bind: [], guardCircle: [], triggerZone: [] };
  const guest = { playerId: "guest", vanguard: null, rear: [], orders: [], hand: [], drop: [], soul: [], damage: [], bind: [], guardCircle: [], triggerZone: [] };
  const players = { host, guest };
  const orderController = players[orderSide];
  const order = engine.createCardInstance(orderId, orderSide, `order-${orderSide}`, {
    zone: orderInOrderZone ? "order" : "drop", faceUp: !faceDown, faceDown
  });
  (orderInOrderZone ? orderController.orders : orderController.drop).push(order);
  for (let index = 0; index < extraOrders; index++) {
    orderController.orders.push(engine.createCardInstance(orderId, orderSide, `extra-order-${orderSide}-${index}`, { zone: "order" }));
  }
  const target = engine.createCardInstance(`grade-${targetGrade}-unit`, targetSide, `target-${targetSide}`, { zone: "rear", grade: targetGrade });
  players[targetSide].rear.push(target);
  const state = { side: turnSide, players };
  return { state, target, targetLocated: engine.locateCardInstance(state, target.uid), order };
}

test("official exact Order Zone text compiles each printed grade into a source-scoped CONT", () => {
  for (const entry of cases) {
    const card = loadCatalog().find(item => item.id === entry.orderId);
    assert.ok(card, `catalog card ${entry.orderId} exists`);
    const ability = engine.parseCardAbilities(card).find(item => item.id === entry.abilityId);
    assert.ok(card.text.includes(entry.text), `catalog preserves ${entry.text}`);
    assert.equal(ability?.raw, entry.text.replace(/^CONT\s*/, ""));
    assert.equal(ability?.definition?.source?.patternId, "cont-order-zone-grade-rearguards-grant-boost-v1");
    assert.deepEqual(ability.definition.requiredLocation, ["order"]);
    assert.deepEqual(ability.definition.continuousEffects[0], {
      type: "grant-keyword", target: "controller-rear-guards-of-grade", keyword: "boost",
      grade: entry.grade, duration: "continuous", condition: { op: "always" }
    });
    assert.ok(ability.definition.source.officialReference);
  }
});

test("Refablishment Dock grants Boost only to its controller's grade 2 rear-guards on either turn", () => {
  for (const turnSide of ["host", "guest"]) {
    const { state, targetLocated } = makeState({ orderId: "cfa-9115", targetGrade: 2, turnSide });
    assert.deepEqual(reducer.serverGrantedContinuousKeywords(state, targetLocated, engine), ["boost"]);
  }
});

test("Pride to Protect grants Boost only to its controller's grade 3 rear-guards", () => {
  const correct = makeState({ orderId: "cfa-9042", targetGrade: 3 });
  assert.deepEqual(reducer.serverGrantedContinuousKeywords(correct.state, correct.targetLocated, engine), ["boost"]);
  const wrongGrade = makeState({ orderId: "cfa-9042", targetGrade: 2 });
  assert.deepEqual(reducer.serverGrantedContinuousKeywords(wrongGrade.state, wrongGrade.targetLocated, engine), []);
});

test("an order controlled by the joining player grants Boost to that player's units, never the host's", () => {
  const joinerOrder = makeState({ orderId: "cfa-9115", orderSide: "guest", targetSide: "guest", targetGrade: 2 });
  assert.deepEqual(reducer.serverGrantedContinuousKeywords(joinerOrder.state, joinerOrder.targetLocated, engine), ["boost"]);
  const hostTarget = engine.createCardInstance("grade-2-unit", "host", "host-target", { zone: "rear", grade: 2 });
  joinerOrder.state.players.host.rear.push(hostTarget);
  const hostLocated = engine.locateCardInstance(joinerOrder.state, hostTarget.uid);
  assert.deepEqual(reducer.serverGrantedContinuousKeywords(joinerOrder.state, hostLocated, engine), []);
});

test("the Order Zone controller, not the owner field, determines which player's Rear-guards gain Boost", () => {
  const setup = makeState({ orderId: "cfa-9115", orderSide: "host", targetSide: "host", targetGrade: 2 });
  setup.order.ownerPlayerId = "guest";
  setup.order.controllerPlayerId = "host";
  assert.deepEqual(reducer.serverGrantedContinuousKeywords(setup.state, setup.targetLocated, engine), ["boost"]);
});

test("the source must be face up and remain in its controller's Order Zone", () => {
  for (const options of [{ faceDown: true }, { orderInOrderZone: false }]) {
    const setup = makeState({ ...options, orderId: "cfa-9115", targetGrade: 2 });
    assert.deepEqual(reducer.serverGrantedContinuousKeywords(setup.state, setup.targetLocated, engine), []);
  }
});

test("units outside rear-guard circles and nonmatching grades do not gain Boost", () => {
  const setup = makeState({ orderId: "cfa-9115", targetGrade: 3 });
  const unit = setup.target;
  setup.state.players.host.rear = [];
  setup.state.players.host.hand.push(unit);
  const handLocated = engine.locateCardInstance(setup.state, unit.uid);
  assert.deepEqual(reducer.serverGrantedContinuousKeywords(setup.state, handLocated, engine), []);
});

test("multiple matching Set Orders still grant the keyword once", () => {
  const setup = makeState({ orderId: "cfa-9115", targetGrade: 2, extraOrders: 2 });
  assert.deepEqual(reducer.serverGrantedContinuousKeywords(setup.state, setup.targetLocated, engine), ["boost"]);
});

test("matching printed text on an unreviewed card is not authoritative", () => {
  const setup = makeState({ orderId: "cfa-9115", targetGrade: 2 });
  setup.state.players.host.orders[0].cardId = "unreviewed-order";
  const located = engine.locateCardInstance(setup.state, setup.target.uid);
  assert.deepEqual(reducer.serverGrantedContinuousKeywords(setup.state, located, engine), []);
});

test("a grade-matched Set Order lets either seat legally use its rear-guard to boost", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "host", guestSide: "guest" };
  for (const side of ["host", "guest"]) {
    const playerId = side === "host" ? "host" : "guest";
    const opponentSide = side === "host" ? "guest" : "host";
    const opponentId = opponentSide;
    const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), orders: [], hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], guardCircle: [], triggerZone: [], gZone: [] });
    const players = { host: player("host"), guest: player("guest") };
    const own = players[side], opponent = players[opponentSide];
    own.vanguard = { uid: `${side}-vg`, cardId: "cfa-3", ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 3, power: 13000, critical: 1, rested: false };
    opponent.vanguard = { uid: `${opponentSide}-vg`, cardId: "cfa-4", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3, power: 13000, critical: 1, rested: false };
    own.orders.push({ uid: `${side}-order`, cardId: "cfa-9115", ownerPlayerId: playerId, controllerPlayerId: playerId, faceUp: true });
    const booster = { uid: `${side}-booster`, cardId: "unprinted-boost-unit", ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 2, power: 10000, critical: 1, rested: false };
    own.rear[3] = booster;
    const state = { matchId: `order-zone-boost-${side}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], processedEventIds: [], turn: 2, firstTurnComplete: true, side, phase: 5, players, pendingAttack: null, pendingAbility: null, pendingAbilities: [] };
    const result = reducer.applyGameAction(state, { actorAuthUid: side === "host" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `attack-with-order-boost-${side}`, expectedStateVersion: state.stateVersion,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: own.vanguard.uid,
        targetCardInstanceId: opponent.vanguard.uid, boosterCardInstanceId: booster.uid } }, seats, engine);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(result.events.find(event => event.type === "unit.boosted")?.boosterCardInstanceId, booster.uid);
  }
  const setup = makeState({ orderId: "cfa-9115", targetGrade: 2 });
  const nonmatchingBooster = { uid: "grade-3-nonboost", cardId: "unprinted-grade-three", ownerPlayerId: "host", controllerPlayerId: "host", unitCard: true, grade: 3, power: 10000, critical: 1, rested: false };
  setup.state.players.host.rear[3] = nonmatchingBooster;
  setup.state.players.host.vanguard = { uid: "host-attacker", cardId: "cfa-3", ownerPlayerId: "host", controllerPlayerId: "host", unitCard: true, grade: 3, power: 13000, critical: 1, rested: false };
  setup.state.players.guest.vanguard = { uid: "guest-defender", cardId: "cfa-4", ownerPlayerId: "guest", controllerPlayerId: "guest", unitCard: true, grade: 3, power: 13000, critical: 1, rested: false };
  setup.state.matchId = "order-zone-boost-mismatch"; setup.state.stateVersion = 1; setup.state.eventSequence = 0;
  setup.state.processedActionIds = []; setup.state.processedAbilityTriggers = []; setup.state.processedEventIds = [];
  setup.state.side = "host"; setup.state.phase = 5; setup.state.turn = 2; setup.state.firstTurnComplete = true;
  const rejected = reducer.applyGameAction(setup.state, { actorAuthUid: "auth-host", actionId: "grade-mismatch-cannot-boost", expectedStateVersion: setup.state.stateVersion,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: "host-attacker", targetCardInstanceId: "guest-defender", boosterCardInstanceId: nonmatchingBooster.uid } },
    { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "host", guestSide: "guest" }, engine);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "invalid-booster");
});
