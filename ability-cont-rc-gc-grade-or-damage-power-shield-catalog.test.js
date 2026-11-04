"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

const IDS = ["cfa-12787:0", "cfa-12795:0", "cfa-12804:0", "cfa-12831:0", "cfa-12873:0", "cfa-12949:0"];

test("all six exact dual-circle CONT abilities honor either Vanguard-grade or damage conditions", () => {
  for (const id of IDS) {
    const { ability } = abilityFor(id, "cont-rc-gc-vanguard-grade-or-damage-power-shield-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard", "guardian"]);
    const gradeBehind = { controllerVanguardGrade: 2, opponentVanguardGrade: 3, controllerDamageCount: 0 };
    const damageThreshold = { controllerVanguardGrade: 3, opponentVanguardGrade: 3, controllerDamageCount: 4 };
    const neither = { controllerVanguardGrade: 3, opponentVanguardGrade: 3, controllerDamageCount: 3 };
    assert.equal(engine.evaluateContinuousEffects([ability], { ...gradeBehind, location: "rear-guard" }).power, 5000);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { ...gradeBehind, location: "guardian" }).shield, 5000);
    assert.equal(engine.evaluateContinuousEffects([ability], { ...damageThreshold, location: "rear-guard" }).power, 5000);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { ...damageThreshold, location: "guardian" }).shield, 5000);
    assert.equal(engine.evaluateContinuousEffects([ability], { ...neither, location: "rear-guard" }).power, 0);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { ...neither, location: "guardian" }).shield, 0);
  }
});
