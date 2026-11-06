"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const FAMILY = [
  ["cfa-11973", 1, "Conceited Noble, Philander", 10000],
  ["cfa-13454", 2, '"Zo-Zo-Zo-Zombie-kun" Zombie-kun', 10000],
  ["cfa-13912", 0, "Awakening Green Dragon, Merdiaiser", 5000]
];
const PATTERN = "cont-rc-own-turn-drop-count-power-v1";

function abilityFor(cardId, abilityIndex) {
  const card = CATALOG.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  return Engine.parseCardAbilitiesCached(card).find(ability => ability.id === `${cardId}:${abilityIndex}`);
}

function evaluate(ability, { controllerId, controllerDropCount, isControllerTurn, location = "rear-guard" }) {
  return Engine.evaluateContinuousEffects([ability], {
    location,
    isControllerTurn,
    controllerPlayerId: controllerId,
    controllerDropCount,
    sourceInstanceId: `source-${controllerId}`,
    targetInstanceId: `source-${controllerId}`
  }).power;
}

test("the three exact RC abilities compile with their printed power amounts and threshold", () => {
  for (const [cardId, index, name, power] of FAMILY) {
    const card = CATALOG.get(cardId);
    const ability = abilityFor(cardId, index);
    assert.ok(ability, `${name} has a structured definition`);
    assert.equal(card.name, name);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.printedText, `CONT [RC]: During your turn, if your drop has ten or more cards, this unit gets power +${power}.`);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.conditionStatus, "modeled");
    assert.equal(ability.definition.conditionsReviewed, true);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.effects, [{
      op: "continuous-power",
      target: "source",
      amount: power,
      duration: "continuous",
      condition: { op: "all", conditions: [
        { op: "controller-turn" },
        { op: "controller-drop-count-at-least", count: 10 }
      ] }
    }]);
  }
});

test("ten cards in the exact controller's Drop grant power for either seat only during that player's turn", () => {
  for (const [cardId, index, , power] of FAMILY) {
    const ability = abilityFor(cardId, index);
    for (const controllerId of ["host-player", "joining-player"]) {
      assert.equal(evaluate(ability, { controllerId, controllerDropCount: 10, isControllerTurn: true }), power, `${cardId}/${controllerId}/10`);
      assert.equal(evaluate(ability, { controllerId, controllerDropCount: 9, isControllerTurn: true }), 0, `${cardId}/${controllerId}/9`);
      assert.equal(evaluate(ability, { controllerId, controllerDropCount: 10, isControllerTurn: false }), 0, `${cardId}/${controllerId}/opponent turn`);
      assert.equal(evaluate(ability, { controllerId, controllerDropCount: 10, isControllerTurn: true, location: "vanguard" }), 0, `${cardId}/${controllerId}/VC`);
      assert.equal(evaluate(ability, { controllerId, controllerDropCount: undefined, isControllerTurn: true }), 0, `${cardId}/${controllerId}/missing Drop count`);
    }
  }
});

test("an opponent's Drop and cards in other zones do not satisfy the condition", () => {
  for (const [cardId, index, , power] of FAMILY) {
    const ability = abilityFor(cardId, index);
    const hostZones = { drop: Array(9).fill({}), soul: Array(10).fill({}), hand: Array(6).fill({}) };
    const joiningZones = { drop: Array(10).fill({}), soul: [], hand: [] };
    const hostControllerDropCount = hostZones.drop.length;
    const joiningControllerDropCount = joiningZones.drop.length;
    assert.equal(evaluate(ability, { controllerId: "host-player", controllerDropCount: hostControllerDropCount, isControllerTurn: true }), 0, `${cardId}/host sees only own Drop`);
    assert.equal(evaluate(ability, { controllerId: "joining-player", controllerDropCount: joiningControllerDropCount, isControllerTurn: true }), power, `${cardId}/joining player sees own Drop`);
    assert.notEqual(hostZones.soul.length, hostControllerDropCount, "Soul cards are not counted as Drop cards");
    assert.notEqual(hostZones.hand.length, hostControllerDropCount, "hand cards are not counted as Drop cards");
  }
});

test("client and authoritative continuous-power contexts count the active card controller's Drop", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const reducer = fs.readFileSync("ability-server-reducer.js", "utf8");
  assert.match(app, /common=\{sourceAttackedThisBattle:attack\?\.attackerUid===instance\.uid,controllerDamageCards:[\s\S]*?controllerDropCount:\(player\.drop\|\|\[\]\)\.length/);
  assert.match(reducer, /function serverContinuousPower[\s\S]*?controllerPlayerId: player\.playerId,\s*controllerDropCount: \(player\.drop \|\| \[\]\)\.length,/);
});

