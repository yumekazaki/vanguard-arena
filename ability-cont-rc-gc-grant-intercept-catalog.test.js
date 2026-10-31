"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

const IDS = ["cfa-13995:0", "cfa-13999:0", "cfa-14000:0", "cfa-14005:0", "cfa-14010:0", "cfa-14013:0"];

test("all six exact RC/GC Intercept CONT cards grant Intercept and shield only on RC or GC", () => {
  for (const id of IDS) {
    const { ability } = abilityFor(id, "cont-rc-gc-grant-intercept-shield-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard", "guardian"]);
    assert.deepEqual(ability.definition.keywords, ["intercept"]);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { location: "rear-guard" }).shield, 5000);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { location: "guardian" }).shield, 5000);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { location: "vanguard" }).shield, 0);
  }
});
