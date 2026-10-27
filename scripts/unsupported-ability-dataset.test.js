"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildUnsupportedAbilityDataset } = require("./build-unsupported-ability-dataset.js");

test("unsupported dataset preserves every ability identity while indexing exact text and dependencies", () => {
  const queue = {
    validationEvidenceFresh: true,
    counts: { catalogAbilities: 3 },
    items: [
      { cardId: "cfa-1", abilityId: "cfa-1:0", kind: "AUTO", printedText: "AUTO: When this unit attacks, draw one card.", trigger: { eventType: "unit.attacked" }, conditions: [], costs: [], location: ["rear-guard"], effects: [], missingRequirements: ["choices"], missingEffectHandlers: [], missingServerEffectHandlers: [], mechanicGroup: "candidate:a", mechanicGroupType: "unreviewed-similarity-candidate", workFlags: ["unsupported-or-unreviewed"] },
      { cardId: "cfa-2", abilityId: "cfa-2:1", kind: "AUTO", printedText: "AUTO: When this unit attacks, draw one card.", trigger: { eventType: "unit.attacked" }, conditions: [], costs: [], location: ["rear-guard"], effects: [], missingRequirements: ["choices"], missingEffectHandlers: [], missingServerEffectHandlers: [], mechanicGroup: "candidate:a", mechanicGroupType: "unreviewed-similarity-candidate", workFlags: ["unsupported-or-unreviewed"] },
      { cardId: "cfa-3", abilityId: "cfa-3:0", kind: "ACT", printedText: "ACT [VC]: [Counter Blast 1] Draw one card.", trigger: null, conditions: [], costs: [{ type: "counter-blast", count: 1 }], usageRestriction: { type: "once-per-turn" }, location: ["vanguard"], effects: [], missingRequirements: ["choices"], missingEffectHandlers: [], missingServerEffectHandlers: [], mechanicGroup: "reviewed:act-draw", mechanicGroupType: "reviewed-mechanic", workFlags: ["unsupported-or-unreviewed"] },
      { cardId: "cfa-4", abilityId: "cfa-4:0", kind: "CONT", printedText: "CONT [VC]: This unit gets power +1000.", workFlags: ["missing-regression-evidence"] }
    ]
  };
  const result = buildUnsupportedAbilityDataset(queue, "fixed-time");
  assert.equal(result.counts.unsupportedAbilities, 3);
  assert.equal(result.counts.unsupportedCards, 3);
  assert.equal(result.records.length, 3);
  assert.equal(result.records[0].printedText, queue.items[0].printedText);
  assert.equal(result.exactTextGroups.find(group => group.abilityCount === 2).abilityIds.length, 2);
  assert.equal(result.mechanicGroups.find(group => group.mechanicGroup === "candidate:a").abilityCount, 2);
  assert.ok(result.notes.some(note => note.includes("never permission to infer")));
  const triggerDependency = result.dependencyGraph.nodes.find(node => node.id === "engine:event:unit.attacked");
  assert.equal(triggerDependency.dependentAbilities, 2);
  assert.equal(result.records[0].dependencies.includes("review:choices"), true);
  assert.equal(result.records.find(record => record.abilityId === "cfa-3:0").dependencies.includes("verification:card:cfa-3"), true);
  assert.equal(result.queueValidationEvidenceFresh, true);
});
