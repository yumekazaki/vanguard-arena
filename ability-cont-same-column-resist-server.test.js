"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_IDS = ["cfa-4023", "cfa-4101", "cfa-4614", "cfa-5080"];
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));

test("the four exact Forerunner CONT records grant Resist only to a different friendly Rear-Guard in their column", () => {
  for (const cardId of CARD_IDS) {
    const card = cards.get(cardId);
    assert.ok(card, `catalog contains ${cardId}`);
    const ability = Engine.parseCardAbilities(card).find(item => item.id === `${cardId}:1`);
    assert.ok(ability, `${cardId} has its parsed CONT`);
    assert.equal(ability.definition?.source?.patternId, "cont-rc-same-column-grants-resist-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.definition.continuousEffects, [{ type: "grant-keyword", target: "other-friendly-rear-guards-same-column", keyword: "resist", duration: "continuous", condition: { op: "always" } }]);

    const context = {
      sourceInstanceId: `aura-${cardId}`, sourceCardId: cardId, sourceLocation: "rear-guard", sourceCircle: "rear-left",
      sourceFaceUp: true, sourceControllerPlayerId: "host", controllerPlayerId: "host",
      targetInstanceId: `ally-${cardId}`, targetLocation: "rear-guard", targetCircle: "rear-back-left",
      targetControllerPlayerId: "host", targetFaceUp: true, targetLocked: false
    };
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context), ["resist"], `${cardId} grants the keyword across the same column`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, targetCircle: "rear-back-right" }), [], `${cardId} does not grant across columns`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, targetInstanceId: context.sourceInstanceId }), [], `${cardId} does not grant to itself`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, targetControllerPlayerId: "guest" }), [], `${cardId} cannot grant to an opponent`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, sourceCircle: "vanguard" }), [], `${cardId} is inactive away from RC`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, sourceFaceUp: false }), [], `${cardId} is inactive face down or locked`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, targetLocked: true }), [], `${cardId} does not grant to a locked card`);
  }
});

test("an active Resist grant rejects opponent effect targeting while allowing the controller to target the unit", () => {
  const filter = { zone: "rear-guard" };
  const shared = { targetCard: { id: "target" }, targetZone: "rear-left", targetActiveKeywords: ["resist"], targetControllerPlayerId: "guest" };
  assert.equal(Engine.matchesTargetFilter(filter, { ...shared, sourceControllerPlayerId: "host", opponentPlayerId: "guest" }), false);
  assert.equal(Engine.matchesTargetFilter(filter, { ...shared, sourceControllerPlayerId: "guest", opponentPlayerId: "host" }), true);
});
