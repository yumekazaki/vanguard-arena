"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

const IDS = ["cfa-11650:0", "cfa-11704:0", "cfa-3509:1", "cfa-4587:0"];

test("all four exact GC Generation Break shield CONT cards check live face-up G count on GC only", () => {
  for (const id of IDS) {
    const { ability } = abilityFor(id, "cont-gc-generation-break-shield-v1");
    assert.deepEqual(ability.requiredLocation, ["guardian"]);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { location: "guardian", generationBreakCount: 0 }).shield, 0);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { location: "guardian", generationBreakCount: 1 }).shield, 5000);
    assert.equal(engine.evaluateContinuousShieldEffects([ability], { location: "rear-guard", generationBreakCount: 1 }).shield, 0);
  }
});
