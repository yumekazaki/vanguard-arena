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

test("batch 0024 preserves its completed audit while verified abilities leave the active queue", () => {
  const registry = require("./ability-work-assignments.json");
  const assignment = registry.completedAssignments.find(item => item.batchId === audit.batchId);
  const verification = require("./card-verification-manifest.json");
  const fullyVerifiedIds = new Set(verification.records
    .filter(record => record.status === "fully-verified" && record.fullyVerified === true)
    .map(record => record.abilityId));
  const outstandingIds = audit.abilityIds.filter(id => !fullyVerifiedIds.has(id));
  const verifiedIds = audit.abilityIds.filter(id => fullyVerifiedIds.has(id));
  const batch = require("./ability-work-batches.json").batches.find(item => item.status === "in-progress" &&
    item.abilityIds.length === outstandingIds.length && outstandingIds.every(id => item.abilityIds.includes(id)));
  assert.ok(assignment);
  assert.ok(batch);
  const activeAssignment = registry.assignments.find(item => item.batchId === batch.batchId);
  assert.ok(activeAssignment, "remaining IDs retain their active owner after whole-card promotion");
  assert.equal(assignment.auditOnly, true);
  assert.equal(assignment.status, "completed");
  assert.equal(assignment.workerOwner, "worker-ability-0024");
  assert.equal(batch.batchId, activeAssignment.batchId);
  assert.equal(batch.status, "in-progress");
  assert.equal(batch.workerOwner, "primary-session-sprint-0001");
  assert.equal(activeAssignment.status, "in-progress");
  assert.equal(activeAssignment.workerOwner, batch.workerOwner);
  assert.deepEqual([...assignment.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.ok(outstandingIds.every(id => activeAssignment.abilityIds.includes(id)));
  assert.deepEqual(verifiedIds, ["cfa-10656:0"]);
  for (const id of verifiedIds) {
    const record = verification.records.find(item => item.abilityId === id);
    assert.equal(record?.status, "fully-verified", `${id} was removed only after whole-card verification`);
    assert.equal(record?.fullyVerified, true, `${id} retains whole-card verification evidence`);
  }
  assert.deepEqual([...batch.abilityIds].sort(), [...outstandingIds].sort());
  assert.equal(audit.abilityIds.length, 38);
  assert.equal(new Set(audit.abilityIds).size, 38);
});

test("all 38 exact catalog abilities are classified against current production support", () => {
  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.deepEqual(audit.alreadySupportedAbilityIds, [
    "cfa-10630:0", "cfa-10635:1", "cfa-10636:1", "cfa-10639:0", "cfa-10656:0", "cfa-10662:0", "cfa-1066:0", "cfa-1066:1"
  ]);
  assert.equal(supported.size, 8);
  assert.equal(blocked.size, 30);

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

test("carried-forward Prosper and Mouldy Shooter definitions do not claim new official-source verification", () => {
  assert.deepEqual(audit.proposedDefinitions, []);
  assert.deepEqual(audit.verifiedOfficialAbilities, []);
  assert.equal(audit.supportedDefinitions.length, 8);
  const prosper = audit.supportedDefinitions.find(item => item.abilityId === "cfa-10630:0");
  assert.equal(prosper?.definitionSource, "auto-rc-effect-placement-optional-soul-charge-one-v1");
  assert.equal(prosper?.officialPrintedText, null);
  assert.equal(prosper?.officialReference, null);
  const mouldy = audit.supportedDefinitions.find(item => item.abilityId === "cfa-10656:0");
  assert.equal(mouldy?.definitionSource, "cont-rc-gc-named-vanguard-power-shield-v1");
  assert.equal(mouldy?.officialPrintedText, null);
  assert.equal(mouldy?.officialReference, null);
});
