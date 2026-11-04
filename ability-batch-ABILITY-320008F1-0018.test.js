"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0018.js");
const audit = contribution.audit;
const assignment = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "ability-work-batches.json"), "utf8")).batches.find(batch => batch.batchId === audit.batchId);
const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));

test("batch assignment is complete and every assigned ID has an exact catalog audit", () => {
  assert.ok(assignment);
  assert.equal(assignment.abilityIds.length, 39);
  assert.equal(new Set(assignment.cardIds).size, 25);
  assert.deepEqual([...audit.abilityIds].sort(), [...assignment.abilityIds].sort());
  assert.equal(new Set(audit.abilityIds).size, 39);
  assert.equal(audit.alreadySupportedAbilityIds.length, 4);
  assert.equal(audit.unsupportedSiblings.length, 35);
  assert.deepEqual(audit.proposedDefinitionIds, []);

  const blockerById = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  const supported = new Set(audit.alreadySupportedAbilityIds);
  for (const abilityId of assignment.abilityIds) {
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    const card = byCard.get(cardId);
    assert.ok(card, `${abilityId} card exists in the catalog`);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(ability, `${abilityId} parses as an ability`);
    assert.ok(card.text.includes(ability.printedText), `${abilityId} retains its exact catalog text`);
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId} has a production definition`);
      assert.ok(!blockerById.has(abilityId), `${abilityId} is not listed as blocked`);
    } else {
      assert.ok(blockerById.has(abilityId), `${abilityId} has a concrete blocker`);
      assert.ok(blockerById.get(abilityId).blocker.length > 40, `${abilityId} blocker identifies the missing mechanic`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, `${abilityId} is not misreported as server-supported`);
    }
  }
});

test("already supported CONT definitions enforce their printed source conditions and zones", () => {
  const maelstromCard = byCard.get("cfa-1048");
  const maelstrom = Engine.parseCardAbilitiesCached(maelstromCard).find(item => item.id === "cfa-1048:1");
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(maelstrom, Engine), true);
  assert.deepEqual(Engine.evaluateContinuousEffects([maelstrom], {
    sourceLocation: "vanguard", sourceInstanceId: "glory", targetInstanceId: "glory",
    soulCardNames: ["Blue Storm Dragon, Maelstrom"]
  }), { power: 2000, critical: 0, drive: 0 });
  assert.deepEqual(Engine.evaluateContinuousEffects([maelstrom], {
    sourceLocation: "vanguard", sourceInstanceId: "glory", targetInstanceId: "glory", soulCardNames: ["Other Maelstrom"]
  }), { power: 0, critical: 0, drive: 0 });
  assert.deepEqual(Engine.evaluateContinuousEffects([maelstrom], {
    sourceLocation: "rear-guard", sourceInstanceId: "glory", targetInstanceId: "glory",
    soulCardNames: ["Blue Storm Dragon, Maelstrom"]
  }), { power: 0, critical: 0, drive: 0 });
  assert.deepEqual(Engine.evaluateContinuousEffects([maelstrom], {
    sourceLocation: "vanguard", sourceInstanceId: "glory", targetInstanceId: "different-unit",
    soulCardNames: ["Blue Storm Dragon, Maelstrom"]
  }), { power: 0, critical: 0, drive: 0 });

  const lordCard = byCard.get("cfa-1048");
  const lord = Engine.parseCardAbilitiesCached(lordCard).find(item => item.id === "cfa-1048:2");
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(lord, Engine), true);
  const sourceCard = { clan: "Aqua Force" };
  assert.equal(Engine.evaluateContinuousRestrictions([lord], { location: "vanguard", sourceCard, sourceInstanceId: "glory", controlledUnits: [] }).legal, true);
  assert.deepEqual(Engine.evaluateContinuousRestrictions([lord], {
    location: "vanguard", sourceCard, sourceInstanceId: "glory",
    controlledUnits: [{ uid: "other-unit", card: { clan: "Kagero" } }]
  }).restrictions.map(item => item.reason), ["lord-requires-all-other-units-to-share-a-clan"]);
  assert.equal(Engine.evaluateContinuousRestrictions([lord], {
    location: "guardian", sourceCard, sourceInstanceId: "glory",
    controlledUnits: [{ uid: "other-unit", card: { clan: "Kagero" } }]
  }).legal, true, "a Vanguard/Rear-Guard CONT restriction is inactive outside its circles");
});

test("already supported Sentinel keyword and Guardian AUTO remain correctly classified", () => {
  const card = byCard.get("cfa-10472");
  const abilities = Engine.parseCardAbilitiesCached(card);
  const sentinel = abilities.find(item => item.id === "cfa-10472:0");
  const protect = abilities.find(item => item.id === "cfa-10472:2");
  assert.equal(Engine.cardHasAbilityKeyword(card, "Sentinel"), true);
  assert.equal(Engine.cardHasAbilityKeyword(byCard.get("cfa-10471"), "Sentinel"), false);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(sentinel, Engine), false, "keyword CONT is represented by keyword metadata, not a server effect program");
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(protect, Engine), true);
  assert.equal(protect.definition.source.patternId, "auto-gc-sentinel-protect-friendly-unit-v1");
});
