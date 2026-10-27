"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-controlled-rearguard-named-unit-power-v1";
const catalog = loadCatalog();
const EXPECTED = new Map([
  ["cfa-10432:0", ["Archangel of Solitude-concealing Music, Sandalphon", 5000, "exact", true]],
  ["cfa-11278:0", ["Taroutachi", 10000, "contains", true]],
  ["cfa-12610:1", ["Grhy", 5000, "contains", true]],
  ["cfa-13350:0", ["Aundra", 5000, "contains", true]],
  ["cfa-8878:0", ["Earnescorrect", 2000, "contains", true]],
  ["cfa-8491:0", ["Taroutachi", 10000, "exact", true]],
  ["cfa-8490:0", ["Jiroutachi", 10000, "exact", true]],
  ["cfa-8549:0", ["Aizen Kunitoshi", 5000, "exact", true]],
  ["cfa-8699:0", ["Worldmaker, Izanagi", 10000, "exact", true]],
  ["cfa-8704:0", ["Netherworld Creator, Izanami", 10000, "exact", true]],
  ["cfa-566:0", ["Drive Quartet, Ressac", 3000, "exact", false]],
  ["cfa-567:0", ["Drive Quartet, Shuplu", 3000, "exact", false]],
  ["cfa-568:0", ["Drive Quartet, Flows", 3000, "exact", false]],
  ["cfa-569:0", ["Drive Quartet, Bubblin", 3000, "exact", false]]
]);

function abilityFor(id) {
  const card = catalog.find(item => String(item.id) === id.split(":")[0]);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability?.definition, `${id} compiles`);
  return { card, ability };
}
function conditionFor([name, , matchType, duringTurn]) {
  const nameCondition = { op: matchType === "exact" ? "controller-rearguard-has-card-name" : "controller-rearguard-card-name-contains", name };
  return duringTurn ? { op: "all", conditions: [{ op: "controller-turn" }, nameCondition] } : nameCondition;
}

test("fourteen exact Rear-Guard CONT abilities preserve their name match, turn gate, and power", () => {
  const audit = auditCatalog(catalog), found = new Map();
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
  }
  assert.deepEqual([...found.keys()].sort(), [...EXPECTED.keys()].sort());
  assert.equal(audit.patterns[PATTERN], EXPECTED.size);
  for (const [id, expected] of EXPECTED) {
    const ability = found.get(id), [name, amount] = expected;
    assert.equal(ability.kind, "CONT", id);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], id);
    assert.equal(ability.definition.effects[0].op, "continuous-power", id);
    assert.equal(ability.definition.effects[0].amount, amount, id);
    assert.deepEqual(ability.definition.effects[0].condition, conditionFor(expected), id);
    assert.equal(ability.definition.effects[0].duration, "continuous", id);
    assert.equal(ability.definition.printedText, ability.printedText, id);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(id.split(":")[0]).some(item => item.id === id), id);
  }
  assert.deepEqual(audit.invalidCompiled, []);
});

test("named Rear-Guard CONT checks only the controller's Rear-Guards and the exact printed name rule", () => {
  for (const [id, expected] of EXPECTED) {
    const { ability } = abilityFor(id), [name, amount, matchType, duringTurn] = expected;
    const evaluate = (field, isControllerTurn = true) => Engine.evaluateContinuousEffects([ability], {
      location: "rear-guard", sourceInstanceId: "source", targetInstanceId: "source", isControllerTurn, controllerFieldCards: field
    }).power;
    const matchingName = matchType === "exact" ? name : `Example ${name} unit`;
    assert.equal(evaluate([{ uid: "ally", zone: "rear-guard", names: [matchingName] }]), amount, `${id} qualifying RC`);
    assert.equal(evaluate([{ uid: "ally", zone: "vanguard", names: [matchingName] }]), 0, `${id} VG alone is not an RC`);
    assert.equal(evaluate([{ uid: "enemy", zone: "opponent-rear-guard", names: [matchingName] }]), 0, `${id} opponent's RC is not controlled`);
    const wrongName = matchType === "exact" ? `Example ${name}` : "Unrelated unit";
    assert.equal(evaluate([{ uid: "ally", zone: "rear-guard", names: [wrongName] }]), 0, `${id} rejects wrong name`);
    if (duringTurn) assert.equal(evaluate([{ uid: "ally", zone: "rear-guard", names: [matchingName] }], false), 0, `${id} is limited to controller turn`);
    else assert.equal(evaluate([{ uid: "ally", zone: "rear-guard", names: [matchingName] }], false), amount, `${id} applies on either turn`);
    assert.equal(Engine.evaluateContinuousEffects([ability], { location: "vanguard", controllerFieldCards: [{ zone: "rear-guard", names: [matchingName] }] }).power, 0, `${id} source circle`);
  }
});

test("authoritative attack power uses the correct player's matching Rear-Guard on both seats", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  for (const side of ["human", "bot"]) for (const [id, [name, amount, matchType]] of EXPECTED) for (const matchingSide of [side, side === "human" ? "bot" : "human"]) {
    const opponentSide = side === "human" ? "bot" : "human";
    const ownerId = side === "human" ? "host" : "guest", opponentId = side === "human" ? "guest" : "host";
    const source = { uid: `source-${side}-${id}`, cardId: id.split(":")[0], cardName: "Continuous source", type: "Normal Unit", unitCard: true, grade: 2, power: 10000, critical: 1, drive: 1, ownerPlayerId: ownerId, controllerPlayerId: ownerId };
    const matching = { uid: `match-${side}-${id}`, cardId: `matching-${id}`, cardName: matchType === "exact" ? name : `Example ${name} unit`, type: "Normal Unit", unitCard: true, grade: 1, power: 8000, ownerPlayerId: ownerId, controllerPlayerId: ownerId };
    const vg = { uid: `vg-${side}`, cardId: `vg-${side}`, cardName: "Friendly Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, ownerPlayerId: ownerId, controllerPlayerId: ownerId };
    const opposingVg = { uid: `opposing-${side}`, cardId: `opposing-${side}`, cardName: "Opponent Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, ownerPlayerId: opponentId, controllerPlayerId: opponentId };
    const makePlayer = (playerId, vanguard, rear) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
    const state = { matchId: `named-rearguard-${side}-${id}`, stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, players: {} };
    state.players[side] = makePlayer(ownerId, vg, matchingSide === side ? [matching, source, null, null, null] : [source, null, null, null, null]);
    state.players[opponentSide] = makePlayer(opponentId, opposingVg, matchingSide === opponentSide ? [matching] : []);
    const result = Reducer.applyGameAction(state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `attack-${side}-${id}`, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opposingVg.uid } }, seats, Engine);
    assert.equal(result.ok, true, `${side}/${id}: ${result.reason}`);
    assert.equal(result.state.pendingAttack.power, 10000 + (matchingSide === side ? amount : 0), `${side}/${id} counts only a matching unit controlled by the attacker`);
  }
});
