"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0009.js");

const expected = [
  "cfa-10237:0", "cfa-10238:0", "cfa-10239:0", "cfa-10239:1", "cfa-10240:0",
  "cfa-10242:0", "cfa-10243:0", "cfa-10243:1", "cfa-10244:0", "cfa-10244:1",
  "cfa-10246:0", "cfa-10247:0", "cfa-10248:0", "cfa-10249:0", "cfa-10249:1",
  "cfa-10250:0", "cfa-10251:0", "cfa-10251:1", "cfa-10252:0", "cfa-10252:1",
  "cfa-10253:0", "cfa-10254:0", "cfa-10255:0", "cfa-10255:1", "cfa-10256:0",
  "cfa-10256:1", "cfa-10257:0", "cfa-10258:0", "cfa-10259:0", "cfa-1025:0",
  "cfa-10261:0", "cfa-10262:0", "cfa-1026:0"
];
const supportedIds = ["cfa-1025:0"];
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const abilities = new Map();
for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) abilities.set(ability.id, { card, ability });
const assignment = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8")).assignments.find(item => item.batchId === "ABILITY-320008F1-0009");
const batch = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8")).batches.find(item => item.batchId === "ABILITY-320008F1-0009");

test("batch 0009 audit exactly covers its 33 reserved abilities and 25 assigned cards", () => {
  assert.ok(assignment && batch);
  assert.equal(assignment.status, "reserved");
  assert.equal(assignment.workerOwner, "primary-session");
  assert.deepEqual(assignment.abilityIds, expected);
  assert.equal(batch.status, "reserved");
  assert.equal(batch.workerOwner, "primary-session");
  assert.deepEqual(batch.abilityIds, expected);
  assert.equal(batch.cardIds.length, 25);
  assert.equal(contribution.audit.batchId, "ABILITY-320008F1-0009");
  assert.deepEqual(contribution.audit.abilityIds, expected);
  assert.deepEqual(contribution.audit.proposedDefinitionIds, [], "no unverified production-like proposals");
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, supportedIds);
  assert.equal(contribution.audit.unsupportedSiblings.length, 32);
  assert.equal(contribution.audit.cards.length, 25);
  assert.equal(contribution.length, 0);
});

test("all ability text is preserved and every unsupported skill remains unavailable", () => {
  const supported = new Set(contribution.audit.alreadySupportedAbilityIds);
  const blockers = new Map(contribution.audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(supported.size + blockers.size, expected.length);
  for (const abilityId of expected) {
    const found = abilities.get(abilityId);
    assert.ok(found, `${abilityId} parses from its assigned card`);
    assert.ok(found.card.text.includes(found.ability.printedText), `${abilityId} retains exact catalog text`);
    assert.equal(found.ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    if (supported.has(abilityId)) {
      assert.ok(found.ability.definition, `${abilityId} has a production definition`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(found.ability, Engine), true, `${abilityId} is trusted`);
      assert.equal(Reducer.supportsServerAbilityEffects(found.ability), true, `${abilityId} has a server effect handler`);
      assert.equal(found.ability.definition.source.patternId, "act-counter-blast-source-power-during-turn-v1");
      continue;
    }
    const blocked = blockers.get(abilityId);
    assert.ok(blocked, `${abilityId} has one blocker record`);
    assert.equal(blocked.kind, found.ability.kind);
    assert.equal(blocked.catalogPrintedText, found.ability.printedText);
    assert.ok(blocked.blocker.length > 80, `${abilityId} has a specific missing mechanic or legality gate`);
    assert.equal(found.ability.definition, null, `${abilityId} remains uncompiled rather than guessed`);
    assert.equal(Reducer.supportsServerAbilityEffects(found.ability), false, `${abilityId} cannot resolve in production`);
    if (found.ability.kind === "AUTO") assert.equal(Engine.autoAbilityReadiness(found.ability).ok, false, abilityId);
    if (found.ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(found.ability, {}).ok, false, abilityId);
    if (found.ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(found.ability), false, abilityId);
  }
});

test("five source-checked Lyrical texts retain official provenance while remaining uncompiled", () => {
  assert.equal(contribution.audit.officialTextChecked, false, "official review is partial for the batch");
  assert.deepEqual([...contribution.audit.officiallyCheckedAbilityIds].sort(), [
    "cfa-10251:0", "cfa-10251:1", "cfa-10252:0", "cfa-10252:1", "cfa-10254:0"
  ]);
  for (const abilityId of contribution.audit.officiallyCheckedAbilityIds) {
    const blocked = contribution.audit.unsupportedSiblings.find(item => item.abilityId === abilityId);
    assert.ok(blocked?.officialReference, `${abilityId} official card page recorded`);
    assert.ok(blocked?.officialCardNumber, `${abilityId} card number recorded`);
    assert.ok(blocked?.officialPrintedText, `${abilityId} official text preserved`);
    assert.equal(blocked.catalogPrintedText, abilities.get(abilityId).ability.printedText);
    assert.equal(abilities.get(abilityId).ability.definition, null, `${abilityId} is not compiled without a trusted handler`);
  }
});

test("the supported Parabolic Moose ACT has existing host/joiner and atomic-cost regression coverage", () => {
  const ability = abilities.get("cfa-1025:0").ability;
  assert.equal(ability.definition.source.patternId, "act-counter-blast-source-power-during-turn-v1");
  assert.equal(ability.printedText, "ACT [VC/RC]: [Counter Blast 2] During this turn, this unit gets power +4000.");
  const definition = contribution.audit.supportedProductionDefinitions.find(item => item.abilityId === "cfa-1025:0");
  assert.ok(definition);
  assert.equal(definition.definitionSource, ability.definition.source.patternId);
  const testText = fs.readFileSync("ability-act-counter-blast-source-power-server.test.js", "utf8");
  assert.match(testText, /\["cfa-1025", \["Parabolic Moose", 2, 4000\]\]/);
  assert.match(testText, /host and joining player can activate each exact ability/i);
  assert.match(testText, /activation rejects insufficient or forged Counter Blast selections/i);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});
