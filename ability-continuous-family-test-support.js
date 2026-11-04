"use strict";

const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");
engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const cards = require("./scripts/audit-ability-catalog.js").loadCatalog();
const cardsById = new Map(cards.map(card => [String(card.id), card]));

function abilityFor(abilityId, patternId) {
  const [cardId] = abilityId.split(":");
  const card = cardsById.get(cardId);
  assert.ok(card, `catalog contains ${cardId}`);
  const ability = engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `parsed ${abilityId}`);
  assert.equal(ability.kind, "CONT");
  assert.equal(ability.definition?.source?.patternId, patternId);
  assert.equal(engine.isManuallyActivatable(ability), false);
  return { card, ability };
}

module.exports = { abilityFor, engine };
