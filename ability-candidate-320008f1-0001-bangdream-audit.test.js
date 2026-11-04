"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_ID = "CANDIDATE-320008F1-0001";
const contribution = require("./ability-contributions/batch-CANDIDATE-320008F1-0001.js");
const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));

test("the audit covers exactly the eight catalog abilities on the four assigned V-TB01 cards", () => {
  const audit = contribution.audit;
  assert.equal(contribution.length, 0, "unsupported abilities must not enter the executable registry");
  assert.equal(audit.batchId, BATCH_ID);
  assert.equal(audit.status, "audit-only-unsupported-no-exact-reviewed-handler");
  assert.equal(audit.officialTextChecked, true);
  assert.equal(audit.cards.length, 4);
  assert.equal(audit.unsupportedSiblings.length, 8);
  assert.deepEqual(audit.implementedAbilityIds, []);
  assert.deepEqual(audit.alreadySupportedAbilityIds, []);

  const expectedCardNumbers = new Map([
    ["cfa-7515", "V-TB01/001EN"],
    ["cfa-7648", "V-TB01/002EN"],
    ["cfa-7593", "V-TB01/003EN"],
    ["cfa-7759", "V-TB01/004EN"]
  ]);
  assert.deepEqual(audit.cards.map(card => card.cardId).sort(), [...expectedCardNumbers.keys()].sort());
  for (const sourceCard of audit.cards) {
    assert.equal(sourceCard.cardNumber, expectedCardNumbers.get(sourceCard.cardId));
    assert.match(sourceCard.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\/cardsearch\/\?expansion=159/);
    assert.ok(cardsById.has(sourceCard.cardId), `catalog entry exists for ${sourceCard.cardId}`);
  }

  const expectedAbilityIds = [
    "cfa-7515:0", "cfa-7515:1", "cfa-7593:0", "cfa-7593:1",
    "cfa-7648:0", "cfa-7648:1", "cfa-7759:0", "cfa-7759:1"
  ];
  assert.deepEqual(audit.abilityIds.slice().sort(), expectedAbilityIds.slice().sort());
  assert.deepEqual(audit.unsupportedSiblings.map(item => item.abilityId).sort(), expectedAbilityIds.slice().sort());
});

test("each unsupported record preserves both catalog text and official printed text without claiming an engine definition", () => {
  for (const item of contribution.unsupportedSiblings) {
    const [cardId] = item.abilityId.split(":");
    const card = cardsById.get(cardId);
    assert.ok(card, `catalog card ${cardId} exists`);
    const parsed = Engine.parseCardAbilities(card).find(ability => ability.id === item.abilityId);
    assert.ok(parsed, `catalog parser produced ${item.abilityId}`);
    assert.equal(parsed.kind, item.kind);
    assert.equal(parsed.printedText, item.catalogPrintedText, `preserve local text for ${item.abilityId}`);
    assert.equal(parsed.definition, null, `${item.abilityId} has no exact reviewed compiled handler`);
    assert.ok(item.officialPrintedText.length > 30, `official text preserved for ${item.abilityId}`);
    assert.ok(item.blocker.length > 60, `specific blocker recorded for ${item.abilityId}`);
  }
});

test("the official wording differences in the local catalog are called out for review", () => {
  const byCard = new Map(contribution.audit.cards.map(card => [card.cardId, card.catalogTextDifferences]));
  assert.match(byCard.get("cfa-7515"), /Poppin'Party/);
  assert.match(byCard.get("cfa-7593"), /Pastel＊Palettes/);
  assert.match(byCard.get("cfa-7648"), /Rest icon/);
  assert.match(byCard.get("cfa-7759"), /has been played/);
  assert.match(contribution.audit.textProvenanceNote, /Bushiroad's V-TB01/);
});
