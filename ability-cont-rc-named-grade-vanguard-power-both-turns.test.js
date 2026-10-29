"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-named-grade-vanguard-power-both-turns-v1";
const EXPECTED = new Map([
  ["cfa-12823:1", ["Kotihblaze", 3, 5000]],
  ["cfa-12965:2", ["Welstra", 3, 5000]],
  ["cfa-13172:0", ["Lisciafael", 3, 5000]],
  ["cfa-13334:0", ["Lisciafael", 3, 5000]]
]);
const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function abilitiesById() {
  const found = new Map();
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, { card, ability });
  }
  return found;
}

function vanguardFor(name, grade) {
  return catalog.find(card => Number(card.grade) >= grade && String(card.name || "").toLowerCase().includes(name.toLowerCase()));
}

test("all four exact catalog CONT abilities preserve the grade, name substring, RC, and opponent-turn wording", () => {
  const found = abilitiesById(), audit = auditCatalog(catalog);
  assert.equal(found.size, EXPECTED.size);
  assert.equal(audit.patterns[PATTERN], EXPECTED.size);
  for (const [id, [name, grade, amount]] of EXPECTED) {
    const entry = found.get(id);
    assert.ok(entry, id);
    const { ability } = entry;
    assert.equal(ability.kind, "CONT", id);
    assert.equal(ability.requiredLocation.join(","), "rear-guard", id);
    assert.equal(ability.conditionStatus, "modeled", id);
    assert.deepEqual(ability.definition.effects, [{ op: "continuous-power", target: "source", amount, duration: "continuous",
      condition: { op: "all", conditions: [
        { op: "controller-vanguard-grade-at-least", grade },
        { op: "controller-vanguard-card-name-contains", name }
      ] } }], id);
  }
  assert.equal(audit.invalidCompiled.length, 0);
});

test("named grade Vanguard CONT applies for either player on either turn and only on its source Rear-Guard", () => {
  for (const side of ["human", "bot"]) for (const [id, [name, grade, amount]] of EXPECTED) {
    const ability = abilitiesById().get(id).ability;
    const evaluate = (location, controllerVanguardGrade, controllerVanguardCardNames) => Engine.evaluateContinuousEffects([ability], {
      location, sourceInstanceId: `source-${side}`, targetInstanceId: `source-${side}`,
      controllerVanguardGrade, controllerVanguardCardNames, isControllerTurn: false
    }).power;
    assert.equal(evaluate("rear-guard", grade, [`Example ${name} Vanguard`]), amount, `${side}/${id} active on opponent turn`);
    assert.equal(evaluate("rear-guard", grade, [`Example ${name} Vanguard`]), amount, `${side}/${id} active on controller turn too`);
    assert.equal(evaluate("rear-guard", grade - 1, [`Example ${name} Vanguard`]), 0, `${side}/${id} rejects low grade`);
    assert.equal(evaluate("rear-guard", grade, ["Unrelated Vanguard"]), 0, `${side}/${id} rejects wrong name`);
    assert.equal(evaluate("vanguard", grade, [`Example ${name} Vanguard`]), 0, `${side}/${id} rejects VC source`);
    assert.equal(evaluate("guardian", grade, [`Example ${name} Vanguard`]), 0, `${side}/${id} rejects GC source`);
  }
});

test("trusted battle power includes the exact Rear-Guard CONT for both seats and rejects a wrong Vanguard condition", () => {
  const makePlayer = (playerId, vanguard, rear) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  for (const side of ["human", "bot"]) for (const [abilityId, [name, grade]] of EXPECTED) {
    const cardId = abilityId.slice(0, abilityId.indexOf(":")), sourceCard = cardsById.get(cardId), namedVanguard = vanguardFor(name, grade);
    assert.ok(sourceCard && namedVanguard, `${abilityId} has real catalog source and matching Vanguard`);
    const owner = side === "human" ? "host" : "guest", opponent = side === "human" ? "guest" : "host", opponentSide = side === "human" ? "bot" : "human";
    const source = { uid: `source-${side}-${cardId}`, cardId, cardName: sourceCard.name, type: sourceCard.type, unitCard: true, grade: Number(sourceCard.grade), power: 10000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
    const vg = { uid: `vg-${side}-${cardId}`, cardId: namedVanguard.id, cardName: namedVanguard.name, type: namedVanguard.type, unitCard: true, grade: Number(namedVanguard.grade), power: Number(namedVanguard.power), critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
    const opposingVanguardCard = catalog.find(card => Number(card.grade) >= 3 && !String(card.name || "").toLowerCase().includes(name.toLowerCase()));
    const opposingVanguard = { uid: `opp-vg-${side}-${cardId}`, cardId: opposingVanguardCard.id, cardName: opposingVanguardCard.name, type: opposingVanguardCard.type, unitCard: true, grade: Number(opposingVanguardCard.grade), power: Number(opposingVanguardCard.power), critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: opponent, controllerPlayerId: opponent };
    const state = { matchId: `cont-name-grade-${side}-${cardId}`, stateVersion: 0, turn: 5, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
    state.players[side] = makePlayer(owner, vg, [source, null, null, null, null]);
    state.players[opponentSide] = makePlayer(opponent, opposingVanguard, Array(5).fill(null));
    const action = { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `attack-${side}-${cardId}`, expectedStateVersion: 0,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opposingVanguard.uid } };
    const result = Reducer.applyGameAction(state, action, seats, Engine);
    assert.equal(result.ok, true, `${side}/${cardId}: ${result.reason}`);
    assert.equal(result.state.pendingAttack.power, 15000, `${side}/${cardId} receives its named grade Vanguard bonus`);

    const lowGradeState = { ...state, stateVersion: 0, processedActionIds: [], pendingAttack: null, players: { ...state.players,
      [side]: { ...state.players[side], vanguard: { ...vg, grade: grade - 1 }, rear: [{ ...source, rested: false }, null, null, null, null] } } };
    const lowGrade = Reducer.applyGameAction(lowGradeState, { ...action, actionId: `low-grade-${side}-${cardId}` }, seats, Engine);
    assert.equal(lowGrade.ok, true, `${side}/${cardId} low-grade attack remains legal`);
    assert.equal(lowGrade.state.pendingAttack.power, 10000, `${side}/${cardId} rejects the unmet grade condition`);
  }
});
