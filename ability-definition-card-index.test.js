"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");

function definition(id, cardId, count = 1) {
  return {
    id,
    cardId,
    kind: "AUTO",
    printedText: `AUTO: Card-index fixture ${id}.`,
    source: { dataset: "regression", review: "per-card definition index" },
    effects: [{ op: "draw", count }]
  };
}

test("reviewed-definition card index handles duplicates, conflicts, and late registrations", () => {
  const cardId = "definition-card-index-fixture";
  const first = definition(`${cardId}:0`, cardId);
  const second = definition(`${cardId}:1`, cardId, 2);

  assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard(cardId), []);
  Engine.registerAbilityDefinitions([first]);
  assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard(cardId).map(item => item.id), [first.id]);

  Engine.registerAbilityDefinitions([first]);
  assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard(cardId).map(item => item.id), [first.id], "re-registering an identical definition does not duplicate the card index");

  const conflicting = { ...first, effects: [{ op: "draw", count: 2 }] };
  assert.throws(() => Engine.registerAbilityDefinitions([conflicting]), /Conflicting ability definition/);
  assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard(cardId).map(item => item.id), [first.id], "a conflict leaves the card index unchanged");

  Engine.registerAbilityDefinitions([second]);
  assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard(cardId).map(item => item.id), [first.id, second.id], "late registrations are visible immediately");

  const returned = Engine.getReviewedAbilityDefinitionsForCard(cardId);
  returned[0].effects[0].count = 99;
  assert.equal(Engine.getReviewedAbilityDefinitionsForCard(cardId)[0].effects[0].count, 1, "callers receive defensive copies");
  assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard("definition-card-index-missing"), []);
});
