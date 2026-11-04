"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0022.js");

const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const parsed = new Map();
for (const card of cards.values()) {
  for (const ability of Engine.parseCardAbilitiesCached(card)) parsed.set(ability.id, ability);
}

test("all 40 reserved IDs have exact local text and a compiled or specifically blocked result", () => {
  const assignment = require("./ability-work-batches.json").batches.find(batch => batch.batchId === audit.batchId);
  assert.ok(assignment);
  assert.deepEqual([...assignment.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.equal(audit.abilityIds.length, 40);
  assert.equal(new Set(audit.abilityIds).size, 40);
  assert.deepEqual(audit.alreadySupportedAbilityIds, ["cfa-1058:1", "cfa-1059:0", "cfa-106:0"]);
  assert.deepEqual(audit.proposedDefinitions, []);
  assert.deepEqual(audit.verifiedOfficialAbilities, []);

  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(blocked.size, 37);
  for (const abilityId of audit.abilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, `missing exact parsed ability ${abilityId}`);
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    assert.equal(ability.cardId, cardId, abilityId);
    assert.equal(typeof ability.printedText, "string");
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId} should remain compiled`);
      assert.equal(ability.definition.id, abilityId);
      assert.equal(ability.definition.cardId, cardId);
      assert.equal(ability.definition.printedText, ability.printedText);
    } else {
      assert.equal(ability.definition, null, `${abilityId} must stay unsupported`);
      assert.equal(blocked.get(abilityId)?.catalogPrintedText, ability.printedText);
      assert.ok(blocked.get(abilityId)?.blocker.length > 50, abilityId);
    }
  }
  assert.deepEqual([...blocked.keys()].sort(), audit.abilityIds.filter(id => !supported.has(id)).sort());
});

test("Fantasy Petal Storm Shirayuki Lord restriction is continuous and location-scoped", () => {
  const ability = parsed.get("cfa-1058:1");
  assert.equal(ability.kind, "CONT");
  assert.equal(ability.definition.continuousRestrictions[0].type, "lord");
  const evaluate = (location, controlledUnits) => Engine.evaluateContinuousRestrictions([ability], {
    location,
    sourceCard: { id: "cfa-1058", clans: ["Murakumo"] },
    sourceInstanceId: "shirayuki-instance",
    controlledUnits
  });
  assert.equal(evaluate("vanguard", []).legal, true);
  assert.equal(evaluate("rear-guard", [{ uid: "same-clan", card: { clan: "Murakumo" } }]).legal, true);
  assert.equal(evaluate("vanguard", [{ uid: "foreign", card: { clan: "Kagero" } }]).legal, false);
  assert.equal(evaluate("guardian", [{ uid: "foreign", card: { clan: "Kagero" } }]).legal, true);
});

test("Tamamo Limit Break trigger matches only its own Vanguard attack on a Vanguard", () => {
  const ability = parsed.get("cfa-1059:0");
  const event = {
    type: "unit.attacked",
    subjectCardInstanceId: "tamamo-instance",
    attackingCardInstanceIds: ["tamamo-instance"],
    targetLocation: "vanguard",
    battleId: "battle-1"
  };
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", event, "tamamo-instance", "vanguard", "vanguard", "p1"), true);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", event, "other-vanguard", "vanguard", "vanguard", "p1"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", { ...event, targetLocation: "rear-guard" }, "tamamo-instance", "vanguard", "vanguard", "p1"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", event, "tamamo-instance", "rear-guard", "vanguard", "p1"), false);
  assert.equal(Engine.evaluateAbilityConditions(ability, { damageCount: 4 }), true);
  assert.equal(Engine.evaluateAbilityConditions(ability, { damageCount: 3 }), false);
});

test("Blaujunger named-rider trigger checks the ridden source instance and exact rider name", () => {
  const ability = parsed.get("cfa-106:0");
  const event = {
    type: "card.ridden",
    subjectCardInstanceId: "blaupanzer-instance",
    sourceCardInstanceId: "blaupanzer-instance",
    sourceCardName: "Blaupanzer",
    targetCardInstanceIds: ["blaujunger-instance"]
  };
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "ride", event, "blaujunger-instance", "vanguard", "vanguard", "p1"), true);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "ride", event, "different-blaujunger", "vanguard", "vanguard", "p1"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "ride", { ...event, sourceCardName: "Blaukluger" }, "blaujunger-instance", "vanguard", "vanguard", "p1"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "ride", { ...event, targetCardInstanceIds: ["different-instance"] }, "blaujunger-instance", "vanguard", "vanguard", "p1"), false);
});
