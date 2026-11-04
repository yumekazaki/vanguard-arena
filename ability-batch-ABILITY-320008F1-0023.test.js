"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0023.js");

const parsed = new Map();
for (const card of loadCatalog()) {
  for (const ability of Engine.parseCardAbilitiesCached(card)) parsed.set(ability.id, ability);
}

test("all 38 reserved IDs have exact catalog text and an explicit support or blocker result", () => {
  const assignment = require("./ability-work-batches.json").batches
    .find(batch => batch.batchId === audit.batchId);
  assert.ok(assignment);
  assert.deepEqual([...assignment.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.equal(audit.abilityIds.length, 38);
  assert.equal(new Set(audit.abilityIds).size, 38);
  assert.deepEqual(audit.alreadySupportedAbilityIds, ["cfa-10622:0", "cfa-1062:0", "cfa-1062:1"]);
  assert.equal(audit.supportedDefinitions.length, 3);
  assert.equal(audit.unsupportedAbilities.length, 35);
  assert.equal(audit.proposedDefinitions.length, 0);

  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blocked = new Map(audit.unsupportedAbilities.map(item => [item.abilityId, item]));
  assert.equal(blocked.size, 35);
  for (const abilityId of audit.abilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, `missing parsed catalog ability ${abilityId}`);
    assert.equal(ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")), abilityId);
    assert.equal(typeof ability.printedText, "string");
    assert.ok(ability.printedText.length > 10, abilityId);
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId} is expected to remain supported`);
      assert.equal(ability.definition.id, abilityId);
      assert.equal(ability.definition.cardId, ability.cardId);
      assert.equal(ability.definition.printedText, ability.printedText);
      assert.equal(blocked.has(abilityId), false);
    } else {
      assert.equal(ability.definition, null, `${abilityId} must remain unsupported`);
      assert.equal(typeof blocked.get(abilityId)?.blocker, "string", abilityId);
      assert.ok(blocked.get(abilityId).blocker.length > 40, abilityId);
      assert.equal(blocked.get(abilityId).catalogPrintedText, ability.printedText);
    }
  }
  assert.deepEqual([...blocked.keys()].sort(), audit.abilityIds.filter(id => !supported.has(id)).sort());
});

test("the three compiled entries are existing exact production definitions, not new proposals", () => {
  const expected = new Map([
    ["cfa-10622:0", "auto-rc-placement-counter-blast-place-dragontree-marker-v1"],
    ["cfa-1062:0", "auto-forerunner-same-clan-ride-call-source-v1"],
    ["cfa-1062:1", "act-source-to-soul-optional-up-to-one-friendly-power-v1"]
  ]);
  for (const definition of audit.supportedDefinitions) {
    assert.equal(definition.definitionSource, expected.get(definition.abilityId));
    assert.equal(parsed.get(definition.abilityId).definition.printedText, definition.printedText);
  }
  assert.deepEqual(audit.proposedDefinitions, []);
});

test("official source checks are linked to Bushiroad entries and do not imply blocked text is compiled", () => {
  assert.equal(audit.verifiedOfficialAbilities.length, 5);
  for (const item of audit.verifiedOfficialAbilities) {
    assert.ok(audit.abilityIds.includes(item.abilityId));
    assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\/\?cardno=/);
    assert.ok(item.officialPrintedText.length > 25);
  }
  for (const item of audit.verifiedOfficialAbilities) {
    if (audit.alreadySupportedAbilityIds.includes(item.abilityId)) continue;
    assert.equal(parsed.get(item.abilityId).definition, null, `${item.abilityId} must not be promoted from source check alone`);
  }
});
