"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0026.js");
Engine.registerAbilityDefinitions(contribution);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const productionDefinitionIds = new Set(require("./ability-definitions.js").map(definition => definition.id));

const BATCH_ID = "ABILITY-320008F1-0026";
const EXPECTED = [
  "cfa-10690:0", "cfa-10690:1", "cfa-10691:0", "cfa-10693:0", "cfa-10694:0",
  "cfa-10694:1", "cfa-10695:0", "cfa-10696:0", "cfa-10697:0", "cfa-10699:0",
  "cfa-1069:0", "cfa-1069:1", "cfa-1069:2", "cfa-10700:0", "cfa-10701:0",
  "cfa-10702:0", "cfa-10703:0", "cfa-10704:0", "cfa-10705:0", "cfa-10707:0",
  "cfa-10708:0", "cfa-10709:0", "cfa-1070:0", "cfa-1070:1", "cfa-1070:2",
  "cfa-10710:0", "cfa-10710:1", "cfa-10711:0", "cfa-10712:0", "cfa-10712:1",
  "cfa-10713:0", "cfa-10713:1", "cfa-10714:0", "cfa-10714:1", "cfa-1071:0"
];
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const batch = require("./ability-work-batches.json").batches.find(item =>
  item.abilityIds.length === EXPECTED.length && EXPECTED.every(id => item.abilityIds.includes(id)));
const audit = contribution.audit;
const proposed = new Map(audit.proposedDefinitions.map(definition => [definition.id, definition]));
const productionIds = new Set(audit.alreadySupportedAbilityIds);
const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));

function parsedAbility(abilityId) {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = catalogById.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `parsed ability ${abilityId} exists`);
  return ability;
}

test("batch 0026 lists all 35 unique abilities and assigns each exactly one review status", () => {
  assert.ok(batch);
  assert.deepEqual([...batch.abilityIds].sort(), [...EXPECTED].sort());
  assert.deepEqual([...audit.abilityIds].sort(), [...EXPECTED].sort());
  assert.equal(new Set(EXPECTED).size, 35);
  assert.deepEqual([...productionIds].sort(), ["cfa-1070:2", "cfa-1071:0"]);
  assert.deepEqual([...proposed.keys()].sort(), ["cfa-10709:0", "cfa-10713:1"]);
  assert.equal(productionIds.size + proposed.size + blocked.size, EXPECTED.length);
  for (const id of EXPECTED) {
    const ability = parsedAbility(id);
    assert.equal(ability.printedText.length > 20, true, id);
    if (productionIds.has(id)) {
      assert.ok(ability.definition, id);
      if (["AUTO", "ACT"].includes(ability.kind)) assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
      else assert.equal(ability.definition.source?.patternId, "cont-lord-attack-restriction-v1", id);
    } else if (proposed.has(id)) {
      assert.deepEqual(ability.definition, proposed.get(id), id);
      assert.equal(productionDefinitionIds.has(id), false, `${id} is not present in production definitions`);
    } else {
      assert.equal(ability.definition, null, `${id} must remain explicitly unsupported`);
      assert.ok(blocked.get(id)?.blocker?.length > 40, id);
      assert.equal(blocked.get(id).catalogPrintedText, ability.printedText, id);
    }
  }
});

test("the proposed Madison AUTO matches only Madison boosting Addison on the controller's turn", () => {
  const ability = parsedAbility("cfa-10709:0");
  assert.equal(ability.requiredLocation[0], "rear-guard");
  assert.equal(ability.trigger.eventType, "unit.boosted");
  assert.equal(ability.trigger.subject, "source");
  assert.equal(ability.trigger.boostedUnitName, "Blaze Maiden, Addison");
  assert.equal(ability.definition.effects[0].op, "soul-charge");
  assert.equal(ability.definition.effects[0].count, 2);
  const matching = {
    type: "unit.boosted", eventId: "boost-madison-1", battleId: "battle-1", phase: "battle", timingWindow: "boost-step",
    actingPlayerId: "player-a", turnPlayerId: "player-a", sourceControllerPlayerId: "player-a",
    sourceCardInstanceId: "madison-instance", subjectCardInstanceId: "madison-instance", cardInstanceId: "madison-instance",
    boosterCardInstanceId: "madison-instance", boostedCardInstanceId: "addison-instance", boostedCardName: "Blaze Maiden, Addison"
  };
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "boost", matching, "madison-instance", "rear-guard", "rear-guard", "player-a"), true);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "boost", { ...matching, boostedCardName: "Other Unit" }, "madison-instance", "rear-guard", "rear-guard", "player-a"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "boost", matching, "different-source-instance", "rear-guard", "rear-guard", "player-a"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "boost", { ...matching, turnPlayerId: "player-b" }, "madison-instance", "rear-guard", "rear-guard", "player-a"), false);
  assert.equal(productionDefinitionIds.has(ability.id), false);
});

test("the proposed Cadafael AUTO is limited to its controller's Ride Phase and exact Hand source", () => {
  const ability = parsedAbility("cfa-10713:1");
  assert.deepEqual(ability.requiredLocation, ["hand"]);
  assert.deepEqual(ability.costs, [{ type: "source-discard", count: 1 }]);
  assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-grade-at-most", count: 1 }]);
  assert.deepEqual(ability.definition.effects, [{ op: "search-top-up-to-one-grade-to-hand", target: "controller", lookCount: 5, maximumGrade: 2 }]);
  const matching = { type: "phase.changed", eventId: "ride-phase-start-a", phase: "ride", timingWindow: "phase-start", actingPlayerId: "player-a", turnPlayerId: "player-a" };
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "phase", matching, "cadafael-instance", "hand", "hand", "player-a"), true);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "phase", { ...matching, phase: "main" }, "cadafael-instance", "hand", "hand", "player-a"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "phase", { ...matching, turnPlayerId: "player-b" }, "cadafael-instance", "hand", "hand", "player-a"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "phase", matching, "cadafael-instance", "rear-guard", "rear-guard", "player-a"), false);
  assert.equal(productionDefinitionIds.has(ability.id), false);
  assert.match(ability.definition.source.review, /local snapshot omits 'up to one'/);
});

test("official card references cover only abilities whose printed wording was checked", () => {
  assert.equal(audit.verifiedOfficialAbilities.length, 5);
  for (const item of audit.verifiedOfficialAbilities) {
    assert.ok(EXPECTED.includes(item.abilityId));
    assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\/\?cardno=/);
    assert.ok(item.officialPrintedText.length > 30);
  }
  assert.ok(audit.officialTextVerifiedAbilityIds.includes("cfa-10713:1"));
  assert.equal(audit.fullCardVerification, "none");
});
