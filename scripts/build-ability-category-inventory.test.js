"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyCardCategories, buildAbilityCategoryInventory } = require("./build-ability-category-inventory.js");

test("rule categories distinguish AUTO, ACT, CONT, ORDER text, and trigger abilities", () => {
  assert.deepEqual(classifyCardCategories({ id: "auto", type: "Unit", text: "AUTO: When this unit attacks, draw a card." }, [
    { kind: "AUTO" }
  ]), { categories: ["automatic"], triggerType: null, explicitAbilityKinds: ["AUTO"] });
  assert.deepEqual(classifyCardCategories({ id: "act", type: "Unit", text: "ACT [RC]: COST [Rest this unit], draw a card." }, [
    { kind: "ACT" }
  ]).categories, ["activated"]);
  assert.deepEqual(classifyCardCategories({ id: "cont", type: "Unit", text: "CONT [VC]: This unit gets +5000." }, [
    { kind: "CONT" }
  ]).categories, ["continuous"]);
  assert.deepEqual(classifyCardCategories({ id: "order", type: "Normal Order", text: "Normal Order\nDraw a card." }, []).categories, ["order"]);
  assert.deepEqual(classifyCardCategories({ id: "trigger", type: "Trigger", text: "Dragon Empire/Dragon/Critical Trigger" }, []).triggerType, "critical");
  assert.deepEqual(classifyCardCategories({ id: "trigger-plural", type: "Trigger", text: "Royal Paladin/High Beast/Critical Triggers" }, []).triggerType, "critical");
  assert.deepEqual(classifyCardCategories({ id: "trigger-metadata", type: "Trigger", trigger: "Heal" }, []).triggerType, "heal");
  assert.deepEqual(classifyCardCategories({ id: "unit", type: "Unit", text: "When revealed for a drive check, reveal a Critical Trigger." }, []).categories, []);
  assert.deepEqual(classifyCardCategories({ id: "music-order", type: "Normal Order Music", text: "CONT [RC]: Boost." }, [
    { kind: "CONT" }
  ]).categories, ["order", "continuous"]);
});

test("category inventory keeps category counts separate from implementation and verification", () => {
  const card = { id: "cfa-1", type: "Normal Order", text: "Normal Order\nAUTO: When played, draw a card." };
  const ability = { id: "cfa-1:0", cardId: "cfa-1", kind: "AUTO", trigger: { eventType: "card.placed" }, definition: { source: { patternId: "auto-order-play-draw-v1" } } };
  const audit = { invalidCompiled: [] };
  const report = buildAbilityCategoryInventory([card], { records: [] }, audit, () => [ability]);
  assert.equal(report.abilityCategories.automatic.blocks, 1);
  assert.equal(report.abilityCategories.automatic.compiled, 1);
  assert.equal(report.abilityCategories.automatic.fullyVerifiedAbilities, 0);
  assert.equal(report.abilityCategories.order.cards, 1);
  assert.equal(report.abilityCategories.order.requiresOrderResolutionAudit, 1);
  assert.equal(report.autoTriggerEvents["card.placed"], 1);
});

test("unclassified trigger cards remain visible for review instead of being guessed", () => {
  const cards = [
    { id: "known", name: "Known Trigger", grade: 0, type: "Trigger", trigger: "Draw" },
    { id: "unknown", name: "Unknown Trigger", grade: 0, type: "Trigger", trigger: "", text: "Some old record with no trigger marker." }
  ];
  const report = buildAbilityCategoryInventory(cards, { records: [] }, { invalidCompiled: [] }, () => []);
  assert.equal(report.abilityCategories.trigger.missingRecognizedType, 1);
  assert.deepEqual(report.abilityCategories.trigger.unclassifiedCards, [{ id: "unknown", name: "Unknown Trigger", grade: 0, declaredTriggerType: "" }]);
});
