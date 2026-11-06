"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0030.js");
const fs = require("node:fs");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const parsed = new Map(catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).map(ability => [ability.id, ability])));

test("batch 0030 exactly classifies 39 abilities without promoting new definitions", () => {
  const queuedAbilityCounts = new Map();
  for (const batch of require("./ability-work-batches.json").batches) {
    for (const id of batch.abilityIds) queuedAbilityCounts.set(id, (queuedAbilityCounts.get(id) || 0) + 1);
  }
  assert.ok(audit.abilityIds.every(id => queuedAbilityCounts.get(id) === 1), "historical audit IDs stay tracked exactly once after queue regrouping");
  assert.equal(audit.abilityIds.length, 39);
  assert.equal(new Set(audit.abilityIds).size, 39);
  assert.deepEqual([...audit.alreadySupportedAbilityIds].sort(), [
    "cfa-10841:0", "cfa-10844:0", "cfa-10844:1", "cfa-10847:0", "cfa-10852:0",
    "cfa-10857:1", "cfa-10858:0", "cfa-10860:0", "cfa-1086:0"
  ]);
  assert.equal(audit.supportedDefinitions.length, 9);
  assert.equal(audit.proposedDefinitions.length, 0);
  assert.equal(audit.unsupportedSiblings.length, 30);
});

test("existing AUTO handlers are trusted; special CONT/keyword support uses its intended runtime path", () => {
  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  const expectedPatterns = {
    "cfa-10841:0": "auto-ride-phase-discard-soul-blast-bottom-deck-draw-v1",
    "cfa-10844:1": "auto-gc-protect-then-conditional-discard-v1",
    "cfa-10847:0": "cont-ride-from-grade-and-named-vanguard-v1",
    "cfa-10852:0": "auto-ride-phase-discard-soul-blast-bottom-deck-draw-v1",
    "cfa-10857:1": "auto-rc-drive-check-trigger-unit-power-turn-v1",
    "cfa-10858:0": "cont-vanguard-card-name-alias-v1",
    "cfa-10860:0": "cont-ride-from-grade-and-named-vanguard-v1",
    "cfa-1086:0": "auto-forerunner-same-clan-ride-call-source-v1"
  };
  for (const id of audit.abilityIds) {
    const ability = parsed.get(id);
    assert.ok(ability, id);
    assert.equal(ability.cardId, id.slice(0, id.lastIndexOf(":")));
    assert.ok(ability.printedText.length > 10, id);
    if (!supported.has(id)) {
      assert.equal(ability.definition, null, id);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, id);
      assert.ok(blocked.get(id)?.blocker?.length > 50, id);
      assert.equal(blocked.get(id)?.catalogPrintedText, ability.printedText);
      continue;
    }
    assert.ok(ability.definition, id);
    assert.equal(ability.definition.id, id);
    assert.equal(ability.definition.printedText, ability.printedText);
    assert.ok(audit.supportedDefinitions.some(item => item.abilityId === id));
    if (expectedPatterns[id]) assert.equal(ability.definition.source?.patternId, expectedPatterns[id], id);
    if (audit.supportModes[id] === "authoritative-auto-resolution") {
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    }
  }

  const sentinel = parsed.get("cfa-10844:0");
  assert.equal(sentinel.kind, "CONT");
  assert.equal(Engine.hasAbilityKeyword([sentinel], "sentinel"), true);
  assert.equal(Engine.isManuallyActivatable(sentinel), false);

  for (const [id, name] of [["cfa-10847:0", "Astroea"], ["cfa-10860:0", "Lianorn"]]) {
    const card = cards.get(id.slice(0, id.lastIndexOf(":")));
    const legal = { name: "Grade 3 " + name + " Vanguard", grade: 3 };
    assert.equal(Engine.canRideCard(card, { vanguardCard: legal }), true, id);
    assert.equal(Engine.canRideCard(card, { vanguardCard: { grade: 3, name: "Different Vanguard" } }), false, id);
  }

  const aquamarine = cards.get("cfa-10858");
  assert.ok(Engine.getCardNames(aquamarine, { location: "vanguard" }).includes("Hexaorb Sorceress"));
  assert.equal(Engine.getCardNames(aquamarine, { location: "rear-guard" }).includes("Hexaorb Sorceress"), false);
});

test("official Bushiroad source reviews are recorded, including the catalog/official-name discrepancy", () => {
  assert.equal(audit.officialTextReviews.length, 19);
  for (const item of audit.officialTextReviews) {
    assert.ok(audit.abilityIds.includes(item.abilityId));
    assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\//);
    assert.ok(item.officialPrintedText.length > 30);
  }
  const mismatch = audit.officialTextReviews.find(item => item.abilityId === "cfa-1086:1");
  assert.equal(mismatch.matchesCatalogText, false);
  assert.match(audit.unsupportedSiblings.find(item => item.abilityId === "cfa-1086:1").blocker, /Conquering Eradicator.*Supreme Army Eradicator/);
  assert.equal(audit.officialTextReviews.find(item => item.abilityId === "cfa-10847:0").matchesCatalogText, true);
  assert.equal(audit.officialTextReviews.find(item => item.abilityId === "cfa-10860:0").matchesCatalogText, true);
});

test("regression suites already exercise the exact supported batch cards through shared verified mechanics", () => {
  const checks = [
    ["ability-auto-ride-phase-discard-soul-blast-bottom-deck-draw-server.test.js", /all 15 Ride-phase discard definitions/],
    ["ability-conditional-discard-guardian-server.test.js", /all 63 exact conditional Guardian Circle definitions/],
    ["ability-candidate-320008f1-0007-named-vanguard-ride-restriction.test.js", /cfa-10847/],
    ["ability-drive-trigger-unit-power-server.test.js", /cfa-10857/],
    ["ability-batch-forerunner-same-clan-ride-call.test.js", /all 362 trusted Forerunner records/],
    ["ability-sentinel-keyword-batch.test.js", /all 410 catalog Sentinel keywords/],
    ["ability-engine.test.js", /zone-unspecified CONT card-name aliases apply in all zones/]
  ];
  for (const [file, pattern] of checks) {
    const contents = fs.readFileSync(file, "utf8");
    assert.match(contents, pattern, file);
  }
});
