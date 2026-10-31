"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

const IDS = ["cfa-10030:0", "cfa-5816:0", "cfa-6543:0", "cfa-9947:0"];

test("all four exact RC CONT power cards use the controller Vanguard grade threshold and circle", () => {
  for (const id of IDS) {
    const { ability } = abilityFor(id, "cont-rc-controller-vanguard-grade-power-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "rear-guard", controllerVanguardGrade: 2 }).power, 0);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "rear-guard", controllerVanguardGrade: 3 }).power, 3000);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "vanguard", controllerVanguardGrade: 3 }).power, 0);
  }
});
