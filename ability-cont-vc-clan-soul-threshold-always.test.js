"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const FAMILY = [
  ["cfa-487", "King of Diptera, Beelzebub", "Dark Irregulars", "https://en.cf-vanguard.com/cardlist/?cardno=BT05%2FS07EN"],
  ["cfa-489", "No Life King, Death Anchor", "Dark Irregulars", "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=0&s_param=Dark+Irregulars&sort=no&view=text"],
  ["cfa-822", "Mistress Hurricane", "Pale Moon", "https://en.cf-vanguard.com/cardlist/?cardno=BT05%2F008EN"]
];
const PATTERN = "cont-vc-rc-clan-soul-threshold-power-v1";

function abilityFor(cardId) {
  const card = CATALOG.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  return Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
}

function soulCards(clan, controllerId, count, { zone = "soul", otherControllerId, wrongClan = false } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    uid: `soul-${controllerId}-${index}`,
    zone,
    controllerPlayerId: index === count - 1 && otherControllerId ? otherControllerId : controllerId,
    clans: [wrongClan ? "Royal Paladin" : clan]
  }));
}

function powerFor(ability, { controllerId, soul, location = "vanguard", isControllerTurn = false }) {
  return Engine.evaluateContinuousEffects([ability], {
    location,
    isControllerTurn,
    controllerPlayerId: controllerId,
    sourceInstanceId: `source-${controllerId}`,
    targetInstanceId: `source-${controllerId}`,
    controllerSoulCards: soul
  }).power;
}

test("three exact catalog VC CONT abilities compile without adding a turn restriction", () => {
  for (const [cardId, name, clan, officialReference] of FAMILY) {
    const catalogCard = CATALOG.get(cardId);
    const ability = abilityFor(cardId);
    assert.ok(ability, `${name} gets its structured ability`);
    assert.equal(catalogCard.name, name);
    assert.equal(ability.id, `${cardId}:0`);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.printedText, `CONT [VC]: If you have eight or more «${clan}» in your soul, this unit gets power +1000.`);
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.equal(ability.conditionStatus, "modeled");
    assert.equal(ability.definition.conditionsReviewed, true);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.source.officialReference, officialReference);
    assert.deepEqual(ability.effects, [{
      op: "continuous-power",
      target: "source",
      amount: 1000,
      duration: "continuous",
      condition: { op: "soul-clan-count-at-least", clan, count: 8 }
    }]);
  }
});

test("eight of the controller's clan in Soul grant +1000 on VC for either online seat and either turn", () => {
  for (const [cardId, , clan] of FAMILY) {
    const ability = abilityFor(cardId);
    for (const controllerId of ["host-player", "joining-player"]) {
      const soul = soulCards(clan, controllerId, 8);
      assert.equal(powerFor(ability, { controllerId, soul, isControllerTurn: true }), 1000, `${cardId}/${controllerId}/own turn`);
      assert.equal(powerFor(ability, { controllerId, soul, isControllerTurn: false }), 1000, `${cardId}/${controllerId}/opponent turn`);
    }
  }
});

test("the condition rejects seven cards, opponent-only cards, another clan, and non-Soul zones", () => {
  for (const [cardId, , clan] of FAMILY) {
    const ability = abilityFor(cardId), controllerId = "source-controller";
    assert.equal(powerFor(ability, { controllerId, soul: soulCards(clan, controllerId, 7) }), 0, `${cardId}/seven`);
    assert.equal(powerFor(ability, { controllerId, soul: soulCards(clan, "opponent", 8) }), 0, `${cardId}/opponent Soul`);
    assert.equal(powerFor(ability, { controllerId, soul: soulCards(clan, controllerId, 8, { wrongClan: true }) }), 0, `${cardId}/wrong clan`);
    assert.equal(powerFor(ability, { controllerId, soul: soulCards(clan, controllerId, 8, { zone: "drop" }) }), 0, `${cardId}/wrong zone`);
    assert.equal(powerFor(ability, { controllerId, soul: soulCards(clan, controllerId, 8), location: "rear-guard" }), 0, `${cardId}/RC`);
  }
});

