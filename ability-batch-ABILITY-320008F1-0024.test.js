"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0024.js");

const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const parsed = new Map();
for (const card of cards.values()) {
  for (const ability of Engine.parseCardAbilitiesCached(card)) parsed.set(ability.id, ability);
}

test("batch 0024 matches its two registries and contains exactly 38 unique assigned abilities", () => {
  const registry = require("./ability-work-assignments.json");
  const assignment = registry.completedAssignments.find(item => item.batchId === audit.batchId);
  const batch = require("./ability-work-batches.json").batches.find(item => item.batchId === audit.batchId);
  assert.ok(assignment);
  assert.ok(batch);
  assert.equal(assignment.auditOnly, true);
  assert.equal(assignment.status, "completed");
  assert.equal(assignment.workerOwner, "worker-ability-0024");
  assert.equal(batch.status, "available");
  assert.equal(batch.workerOwner, null);
  assert.deepEqual([...assignment.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.deepEqual([...batch.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.equal(audit.abilityIds.length, 38);
  assert.equal(new Set(audit.abilityIds).size, 38);
});

test("all 38 exact catalog abilities are classified against current production support", () => {
  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.deepEqual(audit.alreadySupportedAbilityIds, [
    "cfa-10635:1", "cfa-10636:1", "cfa-10639:0", "cfa-10662:0", "cfa-1066:0", "cfa-1066:1"
  ]);
  assert.equal(supported.size, 6);
  assert.equal(blocked.size, 32);

  for (const abilityId of audit.abilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, `missing parsed ability ${abilityId}`);
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    assert.equal(ability.cardId, cardId, abilityId);
    assert.equal(typeof ability.printedText, "string", abilityId);
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId} should have a production definition`);
      assert.equal(ability.definition.id, abilityId);
      assert.equal(ability.definition.cardId, cardId);
      assert.equal(ability.definition.printedText, ability.printedText);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${abilityId} server handler`);
      assert.equal(audit.supportedDefinitions.find(item => item.abilityId === abilityId)?.serverHandlerSupported, true);
    } else {
      const item = blocked.get(abilityId);
      assert.equal(ability.definition, null, `${abilityId} must remain unsupported`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId} must not pass the server handler guard`);
      assert.equal(item?.catalogPrintedText, ability.printedText, `${abilityId} exact local wording`);
      assert.equal(item?.officialPrintedText, null, `${abilityId} must not claim unverified official wording`);
      assert.equal(item?.officialReference, null, `${abilityId} must not claim an unverified official source`);
      assert.ok(item?.blocker?.length > 50, `${abilityId} needs a specific technical blocker`);
    }
  }
  assert.deepEqual([...blocked.keys()].sort(), audit.abilityIds.filter(id => !supported.has(id)).sort());
});

test("no new ability is proposed or represented as officially verified without a Bushiroad source review", () => {
  assert.deepEqual(audit.proposedDefinitions, []);
  assert.deepEqual(audit.verifiedOfficialAbilities, []);
  assert.equal(audit.supportedDefinitions.length, 6);
});
