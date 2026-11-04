"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

const IDS = ["cfa-10033:0", "cfa-7111:0", "cfa-7382:0", "cfa-9943:0", "cfa-9950:0"];

test("all five exact attack-battle CONT power cards apply only while their own RC unit attacks a Vanguard", () => {
  for (const id of IDS) {
    const { ability } = abilityFor(id, "cont-rc-attacks-vanguard-battle-power-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "rear-guard", attackingVanguard: false }).power, 0);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "rear-guard", attackingVanguard: true }).power, 3000);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "vanguard", attackingVanguard: true }).power, 0);
  }
});
