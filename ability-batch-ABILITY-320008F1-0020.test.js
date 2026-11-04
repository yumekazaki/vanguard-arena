"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0020.js");
const audit = contribution.audit;
const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, "ability-work-assignments.json"), "utf8"))
  .assignments.find(item => item.batchId === "ABILITY-320008F1-0020");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "card-verification-manifest.json"), "utf8"));
const recordById = new Map(manifest.records.map(record => [String(record.abilityId), record]));
const cards = loadCatalog();
const cardById = new Map(cards.map(card => [String(card.id), card]));

function getAbility(abilityId) {
  const separator = abilityId.lastIndexOf(":");
  const card = cardById.get(abilityId.slice(0, separator));
  return card && Engine.parseCardAbilitiesCached(card).find(ability => ability.id === abilityId);
}

test("all 42 reserved ability IDs are audited exactly once with supported or concrete blocked outcomes", () => {
  assert.ok(assignment);
  assert.ok(["in-progress", "reserved"].includes(assignment.status));
  assert.equal(assignment.workerOwner, assignment.status === "in-progress" ? "worker-ability-0020" : "primary-review");
  assert.deepEqual([...audit.abilityIds].sort(), [...assignment.abilityIds].sort());
  assert.equal(new Set(audit.abilityIds).size, 42);
  assert.equal(audit.alreadySupportedAbilityIds.length, 10);
  assert.equal(audit.unsupportedSiblings.length, 32);
  assert.deepEqual(audit.proposedDefinitionIds, []);
  assert.deepEqual(audit.implementedAbilityIds, []);
  assert.deepEqual(contribution, [], "audit-only work must not be registered in the production definitions");
});

test("existing production definitions retain exact local text and passing ability-level evidence", () => {
  for (const item of audit.supportedProductionDefinitions) {
    const ability = getAbility(item.abilityId);
    const record = recordById.get(item.abilityId);
    assert.ok(ability?.definition, item.abilityId);
    assert.equal(ability.definition.printedText, ability.printedText, item.abilityId);
    assert.equal(item.printedText, ability.printedText, item.abilityId);
    assert.equal(record?.status, "tests-passing", item.abilityId);
    assert.ok(record.testFiles.length > 0, item.abilityId);
    assert.ok(record.testCases.length > 0, item.abilityId);
    if (ability.kind === "AUTO" || ability.kind === "ACT") {
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, item.abilityId);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, item.abilityId);
    }
  }
});

test("blocked entries still have no production definition and each records its specific missing rule mechanic", () => {
  for (const item of audit.unsupportedSiblings) {
    const ability = getAbility(item.abilityId);
    assert.ok(ability, item.abilityId);
    assert.equal(item.catalogPrintedText, ability.printedText, item.abilityId);
    assert.equal(ability.definition, null, item.abilityId);
    assert.equal(item.officialPrintedText, null, item.abilityId);
    assert.equal(item.officialReference, null, item.abilityId);
    assert.ok(item.blocker.length > 70, item.abilityId);
  }
});
