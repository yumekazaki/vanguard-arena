"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0140.js");
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const allAbilities = new Map([...cards.values()].flatMap(card => Engine.parseCardAbilitiesCached(card).map(ability => [ability.id, { card, ability }])));
const trackedAbilityCounts = new Map();
for (const batch of require("./ability-work-batches.json").batches) {
  for (const id of batch.abilityIds || []) {
    trackedAbilityCounts.set(id, (trackedAbilityCounts.get(id) || 0) + 1);
  }
}
const fullyVerifiedAbilityIds = new Set(require("./card-verification-manifest.json").records
  .filter(record => record.status === "fully-verified" && record.fullyVerified === true)
  .map(record => record.abilityId));
for (const id of fullyVerifiedAbilityIds) trackedAbilityCounts.set(id, (trackedAbilityCounts.get(id) || 0) + 1);

test("batch 0140 audit accounts for each assigned ability with exact catalog text", () => {
  assert.ok(contribution.audit.abilityIds.every(id => trackedAbilityCounts.get(id) === 1), "historical audit IDs stay tracked exactly once after queue regrouping");
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.deepEqual(contribution.audit.proposedDefinitionIds, []);
  assert.equal(contribution.length, 0, "audit must not duplicate definitions already in production");
  assert.equal(contribution.audit.fullyTestedWholeCardIds.length, 0, "this audit does not claim whole-card verification");
  assert.equal(contribution.audit.officialTextChecked, false);

  for (const abilityId of contribution.audit.abilityIds) {
    const entry = allAbilities.get(abilityId);
    assert.ok(entry, `catalog ability exists: ${abilityId}`);
    assert.ok(entry.card.text.includes(entry.ability.printedText), `printed text is preserved exactly: ${abilityId}`);
    const auditRecord = contribution.audit.unsupportedSiblings.find(item => item.abilityId === abilityId);
    if (contribution.audit.alreadySupportedAbilityIds.includes(abilityId)) {
      assert.equal(auditRecord, undefined, `${abilityId} is recorded as existing supported behavior`);
      assert.ok(entry.ability.definition, `existing definition: ${abilityId}`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(entry.ability, Engine), true, `trusted authoritative definition: ${abilityId}`);
      assert.equal(Reducer.supportsServerAbilityEffects(entry.ability), true, `authoritative effects are supported: ${abilityId}`);
      assert.equal(entry.ability.definition.printedText, entry.ability.printedText, `definition text matches catalog: ${abilityId}`);
    } else {
      assert.ok(auditRecord, `unresolved blocker is recorded: ${abilityId}`);
      assert.equal(typeof auditRecord.blocker, "string");
      assert.ok(auditRecord.blocker.length > 40, `blocker is concrete: ${abilityId}`);
      assert.ok(!entry.ability.definition || !Reducer.hasTrustedServerAbilityDefinition(entry.ability, Engine), `unresolved ability is not trusted: ${abilityId}`);
    }
  }
});

test("the one compiled keyword record without an authoritative server gate stays unresolved", () => {
  const entry = allAbilities.get("cfa-1605:0");
  assert.equal(entry.ability.kind, "CONT");
  assert.ok(entry.ability.definition, "the client recognizes the Sentinel keyword");
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(entry.ability, Engine), false);
  assert.ok(contribution.audit.unsupportedSiblings.some(item => item.abilityId === "cfa-1605:0"));
});
