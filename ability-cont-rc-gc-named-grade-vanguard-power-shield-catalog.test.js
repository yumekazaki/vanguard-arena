"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

const EXPECTED = [
  ["cfa-12534:0", "Rezael", 5000],
  ["cfa-12566:0", "Krysrain", 5000],
  ["cfa-12713:0", "Blangdmire", 5000],
  ["cfa-12951:0", "Lilfa", 10000],
  ["cfa-13168:0", "Lisciafael", 5000],
  ["cfa-13829:0", "Varga", 10000]
];

test("all six named-grade dual-circle CONT abilities preserve their name, grade, power, and shield values", () => {
  for (const [id, name, amount] of EXPECTED) {
    const { ability } = abilityFor(id, "cont-rc-gc-named-grade-vanguard-power-shield-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard", "guardian"]);
    const namedGrade3 = { controllerVanguardGrade: 3, controllerVanguardCardNames: [name] };
    assert.equal(engine.evaluateContinuousEffects([ability], { ...namedGrade3, location: "rear-guard" }).power, amount);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { ...namedGrade3, location: "guardian" }).shield, amount);
    assert.equal(engine.evaluateContinuousEffects([ability], { ...namedGrade3, location: "rear-guard", controllerVanguardGrade: 2 }).power, 0);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { ...namedGrade3, location: "guardian", controllerVanguardCardNames: ["Unrelated Vanguard"] }).shield, 0);
    assert.equal(engine.evaluateContinuousEffects([ability], { ...namedGrade3, location: "vanguard" }).power, 0);
  }
});
