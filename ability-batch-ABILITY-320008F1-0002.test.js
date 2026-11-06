"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0002.js");

const BATCH_ID = "ABILITY-320008F1-0002";
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const assignment = require("./ability-work-assignments.json").assignments.find(item => item.batchId === BATCH_ID);
const batch = require("./ability-work-batches.json").batches.find(item => item.batchId === BATCH_ID);
const audit = contribution.audit;
const unsupportedById = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));

function parsedAbility(abilityId) {
  const separator = abilityId.lastIndexOf(":");
  const cardId = abilityId.slice(0, separator);
  const card = catalogById.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `parsed ability ${abilityId} exists`);
  return { card, ability };
}

test("ABILITY-320008F1-0002 accounts for the exact reserved assignment", () => {
  assert.ok(assignment, "atomic assignment exists");
  assert.ok(batch, "batch manifest entry exists");
  assert.deepEqual(assignment.abilityIds, batch.abilityIds, "assignment and manifest agree");
  assert.equal(audit.batchId, BATCH_ID);
  assert.deepEqual(audit.abilityIds, [...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].sort());
  assert.equal(new Set(audit.abilityIds).size, 43);
  assert.equal(audit.cards.length, 25);
  assert.equal(contribution.length, 2, "the two complete stand-trigger definitions are emitted");
  assert.deepEqual(audit.implementedAbilityIds, ["cfa-10025:1", "cfa-10026:1"]);
  assert.equal(audit.alreadySupportedAbilityIds.length, 9);
  assert.equal(audit.unsupportedSiblings.length, 32);
  assert.equal(unsupportedById.size, 32, "unsupported records have unique IDs");
  assert.deepEqual(
    new Set(audit.cards.map(card => card.cardId)),
    new Set([...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].map(id => id.slice(0, id.lastIndexOf(":"))))
  );
});

test("every assigned record preserves its exact catalog card, ability ID, kind, and text", () => {
  for (const abilityId of audit.abilityIds) {
    const { card, ability } = parsedAbility(abilityId);
    const cardRecord = audit.cards.find(item => item.cardId === card.id);
    assert.ok(cardRecord, `${abilityId} has a card record`);
    assert.equal(cardRecord.name, card.name, `${abilityId} card name`);
    if (unsupportedById.has(abilityId)) {
      const record = unsupportedById.get(abilityId);
      assert.equal(record.kind, ability.kind, `${abilityId} kind`);
      assert.equal(record.catalogPrintedText, ability.printedText, `${abilityId} exact catalog text`);
      assert.equal(record.officialPrintedText, null, `${abilityId} is not falsely labeled official-text checked`);
      assert.ok(record.blocker.length > 40, `${abilityId} has a concrete dependency/blocker`);
    } else if (audit.implementedAbilityIds.includes(abilityId)) {
      const record = contribution.find(item => item.id === abilityId);
      assert.ok(record, `${abilityId} has a new compiled definition`);
      assert.equal(record.printedText, ability.printedText, `${abilityId} exact catalog text`);
      assert.deepEqual(record, ability.definition, `${abilityId} production and contribution definitions match`);
    } else {
      const record = audit.supportedProductionDefinitions.find(item => item.abilityId === abilityId);
      assert.ok(record, `${abilityId} has a production-support record`);
      assert.equal(record.kind, ability.kind);
      assert.equal(record.printedText, ability.printedText, `${abilityId} exact catalog text`);
      assert.ok(ability.definition, `${abilityId} still has a production compiled definition`);
    }
  }
});

test("unsupported AUTO, ACT, and CONT abilities remain unavailable for both players", () => {
  for (const abilityId of unsupportedById.keys()) {
    const { ability } = parsedAbility(abilityId);
    assert.ok(!ability.definition, `${abilityId} has no executable definition`);

    if (ability.kind === "AUTO") {
      assert.equal(Engine.autoAbilityReadiness(ability).ok, false, `${abilityId} is not eligible to resolve`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId} is not server-resolvable`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, `${abilityId} is not server-trusted`);
    } else if (ability.kind === "ACT") {
      for (const playerId of ["host-player", "joining-player"]) {
        const result = Engine.canActivateManualAbility(ability, {
          cardInstanceId: `${abilityId}-${playerId}`,
          controllerPlayerId: playerId,
          actorPlayerId: playerId,
          turnPlayerId: playerId,
          phase: "main",
          inPermittedZone: true,
          conditions: {},
          resources: {}
        });
        assert.deepEqual(result, { ok: false, reason: "unsupported-effect" }, `${abilityId} cannot be activated by ${playerId}`);
      }
    } else if (ability.kind === "CONT") {
      assert.deepEqual(Engine.canActivateManualAbility(ability, {}), { ok: false, reason: "not-manual" }, `${abilityId} is never manually activated`);
      assert.ok(!ability.definition, `${abilityId} continuous effect remains unavailable`);
    } else {
      assert.fail(`${abilityId} has unexpected ability kind ${ability.kind}`);
    }
  }
});

test("the nine existing production definitions remain available and exact", () => {
  for (const abilityId of audit.alreadySupportedAbilityIds) {
    const { ability } = parsedAbility(abilityId);
    assert.ok(ability.definition, `${abilityId} keeps its production definition`);
    assert.equal(ability.definition.kind, ability.kind);
    if (ability.kind === "AUTO") {
      assert.deepEqual(Engine.autoAbilityReadiness(ability), { ok: true }, abilityId);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, abilityId);
    } else {
      assert.notEqual(Engine.canActivateManualAbility(ability, {}).ok, true, `${abilityId} CONT is not exposed as manual activation`);
    }
  }
});

test("cfa-10050 embedded RevolDress AUTO is recorded as a parser limitation, not a second ability", () => {
  const { card, ability } = parsedAbility("cfa-10050:0");
  const embeddedText = "RevolDress - AUTO [VC]: At the end of the battle this unit attacked, choose up to one card with \"RevolForm\" in its card name from your hand, ride it as stand, and it gets drive -2 until end of turn.";
  const parsed = Engine.parseCardAbilitiesCached(card);
  assert.equal(parsed.filter(item => item.id === "cfa-10050:0").length, 1);
  assert.equal(parsed.some(item => item.id === "cfa-10050:2"), false);
  assert.ok(ability.printedText.includes(embeddedText));
  assert.equal(audit.parserLimitations[0].parsedAbilityId, "cfa-10050:0");
  assert.match(audit.parserLimitations[0].note, /does not emit a separate ability record\/ID/);
  assert.equal(unsupportedById.get("cfa-10050:0").officialPrintedText, null);
});
