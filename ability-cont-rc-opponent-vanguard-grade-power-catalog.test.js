"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

const IDS = ["cfa-10183:0", "cfa-10269:0", "cfa-10335:0", "cfa-10348:0", "cfa-10379:0"];

test("all five exact RC CONT power abilities require the opponent's grade threshold during their controller's turn", () => {
  for (const id of IDS) {
    const { ability } = abilityFor(id, "cont-rc-opponent-vanguard-grade-power-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 3, isControllerTurn: true }).power, 5000);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 2, isControllerTurn: true }).power, 0);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 3, isControllerTurn: false }).power, 0);
    assert.equal(engine.evaluateContinuousEffects([ability], { location: "vanguard", opponentVanguardGrade: 3, isControllerTurn: true }).power, 0);
  }
});
