"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0021.js");

const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const parsed = new Map();
for (const card of cards.values()) {
  for (const ability of Engine.parseCardAbilitiesCached(card)) parsed.set(ability.id, ability);
}

test("all 37 reserved ability IDs have exact catalog text and a supported or concrete blocked result", () => {
  const assignment = require("./ability-work-batches.json").batches.find(batch => batch.batchId === audit.batchId);
  assert.ok(assignment);
  assert.deepEqual([...assignment.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.equal(audit.abilityIds.length, 37);
  assert.equal(new Set(audit.abilityIds).size, 37);
  assert.deepEqual(audit.alreadySupportedAbilityIds, ["cfa-10568:1"]);
  assert.deepEqual(audit.proposedDefinitions, []);

  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(blocked.size, 36);
  for (const abilityId of audit.abilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, `missing exact parsed ability ${abilityId}`);
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    assert.equal(ability.cardId, cardId, abilityId);
    assert.equal(typeof ability.printedText, "string", abilityId);
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId} should remain supported`);
      assert.equal(ability.definition.id, abilityId);
      assert.equal(ability.definition.cardId, cardId);
      assert.equal(ability.definition.printedText, ability.printedText);
    } else {
      assert.equal(ability.definition, null, `${abilityId} must stay unsupported`);
      assert.equal(typeof blocked.get(abilityId)?.blocker, "string", abilityId);
      assert.ok(blocked.get(abilityId).blocker.length > 30, abilityId);
    }
  }
  assert.deepEqual([...blocked.keys()].sort(), audit.abilityIds.filter(id => !supported.has(id)).sort());
});

test("Tear Knight, Theo continuous power stays on its source RC and Maelstrom controller turn", () => {
  const ability = parsed.get("cfa-10568:1");
  const evaluate = (overrides = {}) => Engine.evaluateContinuousEffects([ability], {
    location: "rear-guard",
    isControllerTurn: true,
    controllerVanguardCardNames: ["Blue Storm Dragon, Maelstrom"],
    sourceInstanceId: "theo-instance",
    targetInstanceId: "theo-instance",
    ...overrides
  });
  assert.equal(evaluate().power, 5000);
  assert.equal(evaluate({ location: "vanguard" }).power, 0);
  assert.equal(evaluate({ isControllerTurn: false }).power, 0);
  assert.equal(evaluate({ controllerVanguardCardNames: ["Chronojet Dragon"] }).power, 0);
  assert.equal(evaluate({ targetInstanceId: "different-card-instance" }).power, 0);
});

test("official card text references are traceable and do not imply unsupported abilities are compiled", () => {
  assert.equal(audit.verifiedOfficialAbilities.length, 5);
  for (const item of audit.verifiedOfficialAbilities) {
    assert.ok(audit.abilityIds.includes(item.abilityId));
    assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
    assert.ok(item.officialPrintedText.length > 20);
  }
  for (const id of ["cfa-10557:0", "cfa-10557:1", "cfa-10557:2", "cfa-10568:0"]) {
    assert.equal(parsed.get(id).definition, null, `${id} is still blocked pending trusted handlers`);
  }
});
