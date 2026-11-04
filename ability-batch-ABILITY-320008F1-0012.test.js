"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0012.js");

const batchId = "ABILITY-320008F1-0012";
const expected = [
  "cfa-10313:0", "cfa-10314:0", "cfa-10315:0", "cfa-10317:0", "cfa-10318:0",
  "cfa-10319:0", "cfa-10320:0", "cfa-10321:0", "cfa-10322:0", "cfa-10323:0",
  "cfa-10324:0", "cfa-10325:0", "cfa-10326:0", "cfa-10327:0", "cfa-10328:0",
  "cfa-10329:0", "cfa-1032:0", "cfa-10330:0", "cfa-10331:0", "cfa-10332:0",
  "cfa-10332:1", "cfa-10333:0", "cfa-10333:1", "cfa-10334:0", "cfa-10335:0",
  "cfa-10336:0", "cfa-1033:0", "cfa-1033:1"
];
const supportedIds = ["cfa-10335:0"];
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const abilities = new Map();
for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) abilities.set(ability.id, { card, ability });
const assignment = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8")).assignments.find(item => item.batchId === batchId);
const batch = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8")).batches.find(item => item.batchId === batchId);

test("the assignment, batch, and contribution cover exactly 28 abilities on 25 cards", () => {
  assert.ok(assignment && batch);
  assert.ok((assignment.status === "in-progress" && assignment.workerOwner === "worker-ability-batch-0012") ||
    (assignment.status === "reserved" && assignment.workerOwner === "primary-session"));
  assert.deepEqual([...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].sort(), expected.slice().sort());
  assert.equal(batch.status, assignment.status);
  assert.equal(batch.workerOwner, assignment.workerOwner);
  assert.deepEqual(batch.abilityIds, assignment.abilityIds);
  assert.equal(batch.cardIds.length, new Set(assignment.abilityIds.map(id => id.slice(0, id.lastIndexOf(":")))).size);
  assert.equal(contribution.audit.batchId, batchId);
  assert.deepEqual(contribution.audit.abilityIds, expected);
  assert.deepEqual(contribution.audit.proposedDefinitionIds, []);
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, supportedIds);
  assert.equal(contribution.audit.unsupportedSiblings.length, 27);
  assert.equal(contribution.audit.cards.length, 25);
  assert.equal(contribution.length, 0);
});

test("all catalog text is preserved and unsupported AUTO, ACT, and CONT entries remain unavailable", () => {
  const supported = new Set(contribution.audit.alreadySupportedAbilityIds);
  const blockers = new Map(contribution.audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(supported.size + blockers.size, expected.length);
  for (const abilityId of expected) {
    const found = abilities.get(abilityId);
    assert.ok(found, `${abilityId} exists in the catalog`);
    assert.ok(found.card.text.includes(found.ability.printedText), `${abilityId} keeps exact catalog wording`);
    assert.equal(found.ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    if (supported.has(abilityId)) {
      assert.ok(found.ability.definition, `${abilityId} has a production definition`);
      assert.equal(found.ability.definition.source.patternId, "cont-rc-opponent-vanguard-grade-power-v1");
      assert.equal(Engine.isManuallyActivatable(found.ability), false, "CONT remains passive");
      continue;
    }
    const blocked = blockers.get(abilityId);
    assert.ok(blocked, `${abilityId} has one blocker record`);
    assert.equal(blocked.kind, found.ability.kind);
    assert.equal(blocked.catalogPrintedText, found.ability.printedText);
    assert.equal(blocked.officialPrintedText, null);
    assert.ok(blocked.blocker.length > 80, `${abilityId} has a concrete blocker`);
    assert.equal(found.ability.definition, null, `${abilityId} remains uncompiled rather than guessed`);
    assert.equal(Reducer.supportsServerAbilityEffects(found.ability), false, `${abilityId} has no trusted server program`);
    if (found.ability.kind === "AUTO") assert.equal(Engine.autoAbilityReadiness(found.ability).ok, false, abilityId);
    if (found.ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(found.ability, {}).ok, false, abilityId);
    if (found.ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(found.ability), false, abilityId);
  }
});

test("Dual Electrose Dragon remains a passive RC CONT with exact grade, turn, and circle limits", () => {
  const ability = abilities.get("cfa-10335:0").ability;
  assert.equal(ability.definition.source.patternId, "cont-rc-opponent-vanguard-grade-power-v1");
  assert.equal(ability.kind, "CONT");
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 3, isControllerTurn: true }).power, 5000);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 2, isControllerTurn: true }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "rear-guard", opponentVanguardGrade: 3, isControllerTurn: false }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "vanguard", opponentVanguardGrade: 3, isControllerTurn: true }).power, 0);
});
