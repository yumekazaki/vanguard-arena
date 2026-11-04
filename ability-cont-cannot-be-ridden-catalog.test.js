"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { abilityFor, engine } = require("./ability-continuous-family-test-support.js");

const IDS = ["cfa-10772:0", "cfa-10824:0", "cfa-10895:0", "cfa-13426:0", "cfa-7580:0", "cfa-7631:0"];

test("all six exact Cannot Be Ridden CONT cards prohibit riding without becoming manual skills", () => {
  for (const id of IDS) {
    const { card, ability } = abilityFor(id, "cont-card-cannot-be-ridden-v1");
    assert.deepEqual(ability.definition.keywords, ["cannot-be-ridden"]);
    assert.equal(ability.requiredLocation.length, 0);
    assert.equal(engine.canRideCard(card), false);
  }
});
