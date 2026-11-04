"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0003.js");
const assignments = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8"));
const batches = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8"));
const expected = [
  "cfa-10051:0", "cfa-10051:1", "cfa-10054:0", "cfa-10055:0", "cfa-10056:0",
  "cfa-10058:0", "cfa-10059:0", "cfa-10060:0", "cfa-10064:0", "cfa-10065:0",
  "cfa-10068:0", "cfa-10068:1", "cfa-10069:0", "cfa-10069:1", "cfa-1006:0",
  "cfa-1006:1", "cfa-10070:0", "cfa-10070:1", "cfa-10070:2", "cfa-10071:0",
  "cfa-10072:0", "cfa-10075:0", "cfa-10076:0", "cfa-10077:0", "cfa-10078:0",
  "cfa-10079:0", "cfa-10080:0", "cfa-10081:0", "cfa-10084:0", "cfa-10085:0",
  "cfa-1008:0"
];
const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const abilitiesById = new Map();
for (const card of catalog) {
  for (const ability of Engine.parseCardAbilities(card)) abilitiesById.set(ability.id, { card, ability });
}

test("the local claim and batch manifest agree on all 31 assigned ability IDs", () => {
  const assignment = assignments.assignments.find(item => item.batchId === "ABILITY-320008F1-0003");
  const batch = batches.batches.find(item => item.batchId === "ABILITY-320008F1-0003");
  assert.ok(assignment, "atomic assignment exists");
  assert.ok(batch, "batch manifest entry exists");
  assert.equal(assignment.status, "reserved");
  assert.equal(assignment.workerOwner, "primary-session");
  assert.equal(assignment.previousWorkerOwner, "worker-ability-batch-0003");
  assert.deepEqual([...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].sort(), expected.slice().sort());
  assert.deepEqual(batch.abilityIds.slice().sort(), assignment.abilityIds.slice().sort());
  const batchCardIds = [...new Set(assignment.abilityIds.map(id => id.split(":")[0]))].sort();
  assert.deepEqual(batch.cardIds.slice().sort(), batchCardIds);
  assert.deepEqual(contribution.audit.abilityIds.slice().sort(), expected.slice().sort());
  assert.equal(contribution.audit.cards.length, 25);
});

test("all exact catalog records are preserved and partitioned into existing definitions and unsupported abilities", () => {
  assert.equal(contribution.length, 0, "audit-only contribution registers no runtime definition");
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.equal(contribution.audit.supportedDefinitions.length, 13);
  assert.equal(contribution.audit.unsupportedSiblings.length, 18);
  const supported = new Map(contribution.audit.supportedDefinitions.map(item => [item.abilityId, item]));
  const unsupported = new Map(contribution.audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(supported.size + unsupported.size, expected.length);
  for (const id of expected) {
    const found = abilitiesById.get(id);
    assert.ok(found, id + " exists in catalog");
    const record = supported.get(id) || unsupported.get(id);
    assert.ok(record, id + " is classified exactly once");
    assert.equal(record.catalogPrintedText, found.ability.printedText, id + " exact local printed text");
    assert.equal(record.kind, found.ability.kind, id + " ability type");
    assert.equal(cardsById.get(id.split(":")[0])?.name, contribution.audit.cards.find(card => card.cardId === id.split(":")[0])?.name);
    if (supported.has(id)) {
      assert.ok(found.ability.definition, id + " retains its existing production definition");
      assert.equal(found.ability.definition.source.patternId, record.patternId, id + " trusted pattern");
    } else {
      assert.equal(found.ability.definition, null, id + " has no production definition");
      assert.ok(record.blocker.length > 80, id + " has a concrete blocker");
    }
  }
});

test("the 18 uncompiled skills remain unavailable instead of creating unresolved prompts", () => {
  for (const record of contribution.audit.unsupportedSiblings) {
    const ability = abilitiesById.get(record.abilityId).ability;
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, record.abilityId + " is not server executable");
    if (ability.kind === "AUTO") assert.equal(Engine.autoAbilityReadiness(ability).ok, false, record.abilityId);
    if (ability.kind === "ACT") {
      assert.equal(Engine.isManuallyActivatable(ability), true, record.abilityId + " is an ACT category ability");
      assert.equal(Engine.canActivateManualAbility(ability, {}).ok, false, record.abilityId + " has no trusted effect program");
    }
    if (ability.kind === "CONT") {
      assert.equal(ability.definition, null, record.abilityId);
      assert.equal(ability.effects, null, record.abilityId);
    }
  }
});

test("the thirteen abilities defined in production keep their correct ability category", () => {
  for (const record of contribution.audit.supportedDefinitions) {
    const ability = abilitiesById.get(record.abilityId).ability;
    assert.equal(ability.definition.id, record.abilityId);
    if (ability.kind === "AUTO") {
      assert.equal(Engine.autoAbilityReadiness(ability).ok, true, record.abilityId);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, record.abilityId);
    }
    if (ability.kind === "ACT") {
      assert.equal(Engine.isManuallyActivatable(ability), true, record.abilityId);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, record.abilityId);
    }
    if (ability.kind === "CONT") {
      assert.equal(Engine.isManuallyActivatable(ability), false, record.abilityId);
      assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
        location: "guardian",
        controllerVanguardCardNames: ["Oracle Think Tank Sorceress"]
      }).shield, 10000, record.abilityId + " legal GC/name condition");
      assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
        location: "rear-guard",
        controllerVanguardCardNames: ["Oracle Think Tank Sorceress"]
      }).shield, 0, record.abilityId + " wrong circle");
      assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
        location: "guardian",
        controllerVanguardCardNames: ["Unrelated Vanguard"]
      }).shield, 0, record.abilityId + " unmet Vanguard-name condition");
    }
  }
});
