"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0017.js").audit;
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const registry = require("node:fs").readFileSync("ability-work-registry.jsonl", "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const registryById = new Map(registry.map(record => [record.abilityId, record]));

test("all 41 reserved ability IDs have exact catalog text and a supported, proposed, or concrete blocked result", () => {
  const assignment = require("./ability-work-batches.json").batches.find(batch => batch.batchId === audit.batchId);
  assert.ok(assignment);
  assert.deepEqual(audit.abilityIds, assignment.abilityIds);
  assert.equal(new Set(audit.abilityIds).size, 41);
  assert.deepEqual(audit.counts, { assigned: 41, alreadySupported: 8, proposed: 0, blocked: 33 });

  const supported = new Set(audit.alreadySupportedAbilityIds);
  const proposed = new Set(audit.proposedDefinitionIds);
  const blockers = new Map(audit.unsupportedSiblings.map(record => [record.abilityId, record]));
  assert.equal(supported.size + proposed.size + blockers.size, audit.abilityIds.length);
  for (const abilityId of audit.abilityIds) {
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    const card = byCard.get(cardId);
    const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(card && ability, `catalog record exists for ${abilityId}`);
    assert.ok(card.text.includes(ability.printedText), `catalog source text contains ${abilityId}`);
    assert.ok(registryById.has(abilityId), `registry entry exists for ${abilityId}`);
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId} has a production definition`);
      if (ability.kind === "CONT") {
        assert.equal(Engine.hasAbilityKeyword(card, "sentinel") || Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, abilityId);
        assert.equal(Engine.isManuallyActivatable(ability), false, `${abilityId} must not become a manual skill`);
      } else {
        assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, abilityId);
        assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
      }
    } else if (proposed.has(abilityId)) {
      assert.fail(`No proposals are considered safe for integration in this batch: ${abilityId}`);
    } else {
      const blocker = blockers.get(abilityId);
      assert.ok(blocker?.blocker, `concrete blocker exists for ${abilityId}`);
      assert.equal(blocker.catalogPrintedText, ability.printedText, abilityId);
    }
  }
  assert.deepEqual(audit.alreadySupportedAbilityIds, ["cfa-10440:0", "cfa-10444:0", "cfa-10445:0", "cfa-10445:1", "cfa-1044:0", "cfa-10452:0", "cfa-10456:0", "cfa-10459:0"]);
  assert.deepEqual(audit.proposedDefinitionIds, []);
});

test("officially verified draw candidates remain blocked when the trusted server gate or cost preflight is missing", () => {
  const penguin = byCard.get("cfa-1045");
  const penguinAbility = Engine.parseCardAbilitiesCached(penguin).find(item => item.id === "cfa-1045:0");
  const penguinBlocker = audit.unsupportedSiblings.find(item => item.abilityId === "cfa-1045:0");
  assert.equal(penguinBlocker.officialReference, "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F059EN");
  assert.equal(penguinBlocker.officialPrintedText, "[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have an <Aqua Force> vanguard, you may pay the cost. If you do, draw a card.");
  assert.equal(penguinAbility.definition, null);
  assert.match(penguinBlocker.blocker, /does not generally preflight single Soul Blast costs/);
  assert.equal(Engine.canPayAbilityCosts({ costs: [{ type: "soul-blast", count: 2 }] }, { soulCount: 1 }), false);
  assert.equal(Engine.canPayAbilityCosts({ costs: [{ type: "soul-blast", count: 2 }] }, { soulCount: 2 }), true);

  const balih = byCard.get("cfa-10453");
  const balihAbility = Engine.parseCardAbilitiesCached(balih).find(item => item.id === "cfa-10453:1");
  const balihBlocker = audit.unsupportedSiblings.find(item => item.abilityId === "cfa-10453:1");
  assert.equal(balihBlocker.officialReference, "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2FEX09EN");
  assert.equal(balihBlocker.officialPrintedText, "[AUTO]:When this card is discarded from hand for the cost of [Stride], draw a card.");
  assert.equal(balihAbility.definition, null);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(balihAbility, Engine), false);
  assert.equal(Reducer.supportsServerAbilityEffects(balihAbility), false);
  assert.match(balihBlocker.blocker, /no trusted server definition/);
});
