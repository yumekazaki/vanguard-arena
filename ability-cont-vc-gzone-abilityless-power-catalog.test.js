"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

test("Cycloned's exact face-up VC/G-zone CONT power applies only to friendly abilityless targets on its controller's turn", () => {
  const { ability } = abilityFor("cfa-7474:0", "cont-vc-gzone-abilityless-controller-units-power-v1");
  assert.deepEqual(ability.requiredLocation, ["vanguard", "g-zone"]);
  const base = { isControllerTurn: true, sourceFaceUp: true, targetHasNoAbilities: true };
  for (const sourceLocation of ["vanguard", "g-zone"]) {
    assert.equal(engine.evaluateContinuousEffects([ability], { ...base, sourceLocation }).power, 5000);
    assert.equal(engine.evaluateContinuousEffects([ability], { ...base, sourceLocation, targetHasNoAbilities: false }).power, 0);
    assert.equal(engine.evaluateContinuousEffects([ability], { ...base, sourceLocation, sourceFaceUp: false }).power, 0);
  }
  assert.equal(engine.evaluateContinuousEffects([ability], { ...base, sourceLocation: "g-zone", isControllerTurn: false }).power, 0);
  assert.equal(engine.evaluateContinuousEffects([ability], { ...base, sourceLocation: "hand" }).power, 0);
});
