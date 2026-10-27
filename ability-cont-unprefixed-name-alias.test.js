"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const EXPECTED = new Map([
  ["cfa-11184:0", ["cfa-11184", "Stealth Fiend, Forktail"]],
  ["cfa-11185:0", ["cfa-11185", "Combine Rusher"]],
  ["cfa-11188:0", ["cfa-11188", "Avaricious Demonic Dragon, Greedon"]],
  ["cfa-13046:0", ["cfa-13046", "Drilling Angel"]],
  ["cfa-13158:0", ["cfa-13158", "Selfish Engraver"]],
  ["cfa-13159:0", ["cfa-13159", "Flagship Dragon, Flagburg Dragon"]]
]);
const cards = loadCatalog();

test("the exact unprefixed global CONT alias text is structured for all six catalog abilities", () => {
  const abilities = new Map();
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (EXPECTED.has(ability.id)) abilities.set(ability.id, { card, ability });
  }
  assert.deepEqual([...abilities.keys()].sort(), [...EXPECTED.keys()].sort());
  for (const [id, [cardId, alias]] of EXPECTED) {
    const item = abilities.get(id);
    assert.equal(item.card.id, cardId);
    assert.equal(item.ability.kind, "CONT");
    assert.equal(item.ability.raw, `This card is also regarded as "${alias}"`);
    assert.deepEqual(item.ability.definition.keywords, [{ name: "card-name-alias", value: alias }]);
    assert.deepEqual(item.ability.definition.requiredLocation, []);
    assert.deepEqual(Engine.getCardNames(item.card), [item.card.name, alias]);
  }
  assert.deepEqual(auditCatalog(cards).invalidCompiled, []);
});

test("the global alias is usable for exact name matching, while added-effect text is not swallowed", () => {
  const source = cards.find(card => card.id === "cfa-11184");
  assert.equal(Engine.cardHasName(source, "Stealth Fiend, Forktail"), true);
  const complex = cards.find(card => card.id === "cfa-13372");
  const complexAlias = Engine.parseCardAbilitiesCached(complex).find(ability => ability.id === "cfa-13372:0");
  assert.equal(complexAlias.definition, null);
});
