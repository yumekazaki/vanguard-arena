"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");
const definitions = require("./ability-contributions/batch-PRIMARY-WORKER-CONT-SAME-COLUMN-KEYWORD-4.js");
Engine.registerAbilityDefinitions(definitions);
const ids = ["cfa-4023", "cfa-4101", "cfa-4614", "cfa-5080"];
const text = 'CONT [RC]: All of your other rear-guards in the same column as this unit get "CONT [RC]: Resist".';
const cards = loadCatalog().filter(card => ids.includes(card.id));

test("the reserved batch accounts for all 12 exact abilities and exports only the eight supported siblings", () => {
  assert.equal(cards.length, 4);
  assert.deepEqual(definitions.map(d => d.id).sort(), ids.flatMap(id => [`${id}:0`, `${id}:2`]).sort());
  for (const card of cards) {
    const abilities = Engine.parseCardAbilities(card);
    assert.deepEqual(abilities.map(a => a.id), [0, 1, 2].map(i => `${card.id}:${i}`));
    assert.deepEqual(abilities.map(a => a.kind), ["AUTO", "CONT", "ACT"]);
    assert.equal(abilities[1].printedText, text);
    for (const ability of abilities.filter(a => a.definition)) {
      assert.deepEqual(definitions.find(d => d.id === ability.id), ability.definition);
      assert.ok(card.text.includes(ability.printedText));
    }
  }
  const audit = auditCatalog(cards);
  assert.equal(audit.abilityBlocks, 12);
  assert.equal(audit.compiled, 8);
  assert.equal(audit.unsupported, 4);
  assert.equal(audit.cardsWithAllAbilityBlocksCompiledAndAuditValid, 0);
  assert.deepEqual(audit.invalidCompiled, []);
});

for (const card of cards) {
  test(`${card.id}:1 stays unsupported and cannot be activated or treated as source Resist`, () => {
    const ability = Engine.parseCardAbilities(card)[1];
    assert.equal(ability.definition, null);
    assert.equal(Engine.isManuallyActivatable(ability), false);
    assert.deepEqual(Engine.canActivateManualAbility(ability), { ok: false, reason: "not-manual" });
    assert.equal(Engine.hasAbilityKeyword([ability], "resist"), false);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], {
      sourceCardId: card.id, sourceInstanceId: "source", targetInstanceId: "other",
      sourceLocation: "rear-guard", sourceFaceUp: true
    }), []);
  });
  test(`${card.id}:1 cross-unit Resist needs a shared schema extension`, () => {
    // A dependency probe, not a proposed runtime definition. Never register a source-only
    // Resist keyword: that would protect the grantor rather than its other rear-guards.
    const candidate = {
      id: `${card.id}:1`, cardId: card.id, kind: "CONT", printedText: text,
      requiredLocation: ["rear-guard"], source: { review: "Unsupported dependency probe" },
      continuousEffects: [{ type: "grant-keyword", target: "other-controller-rearguards-same-column",
        keyword: "resist", duration: "continuous", condition: { op: "always" } }]
    };
    assert.throws(() => Engine.registerAbilityDefinitions([candidate]), /unsupported or invalid continuous effect/);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(d => d.id === candidate.id), false);
  });
}
