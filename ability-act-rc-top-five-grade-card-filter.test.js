"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "act-rc-counter-blast-source-to-soul-top-five-grade-three-search-v1";
const GENERIC_CARD_IDS = ["cfa-2405", "cfa-2439", "cfa-2474", "cfa-3505", "cfa-3519"];
const CLAN_CARD_IDS = ["cfa-83", "cfa-178", "cfa-235", "cfa-265", "cfa-323", "cfa-381", "cfa-444", "cfa-707", "cfa-733", "cfa-781", "cfa-834", "cfa-899", "cfa-953", "cfa-989", "cfa-1068", "cfa-1229", "cfa-1599", "cfa-5531"];
const CATALOG = loadCatalog();

function abilityFor(cardId) {
  const card = CATALOG.find(item => item.id === cardId);
  assert.ok(card, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilities(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `compiled family ability for ${cardId}`);
  return ability;
}

test("the five generic-card texts impose only grade 3+ and allow a non-Unit card", () => {
  for (const cardId of GENERIC_CARD_IDS) {
    const ability = abilityFor(cardId);
    const filter = ability.definition.effects[0].filter;
    assert.deepEqual(filter, { minGrade: 3 }, cardId);
    const step = ability.definition.effects[0];
    const candidate = { uid: "grade-three-order", cardId: "normal-order" };
    const context = {
      player: { deck: [candidate], hand: [] },
      effectUid: candidate.uid,
      cardDefinitionForInstance: () => ({ grade: 3, type: "Normal Order" }),
      shuffleDeck() {},
    };
    assert.equal(Engine.EFFECT_HANDLERS[step.op].validate(step, context), true, `${cardId} accepts printed grade 3+ Order`);
    context.cardDefinitionForInstance = () => ({ grade: 2, type: "Normal Order" });
    assert.equal(Engine.EFFECT_HANDLERS[step.op].validate(step, context), false, `${cardId} rejects below-grade card`);
  }
});

test("the 18 clan-qualified texts retain both the Unit and exact printed clan filters", () => {
  for (const cardId of CLAN_CARD_IDS) {
    const ability = abilityFor(cardId);
    const filter = ability.definition.effects[0].filter;
    assert.equal(filter.minGrade, 3, cardId);
    assert.equal(filter.cardType, "unit", cardId);
    assert.equal(typeof filter.clan, "string", cardId);
    assert.ok(filter.clan.length > 0, cardId);
    assert.equal(Engine.matchesTargetFilter(filter, { targetCard: { type: "Normal Unit", grade: 3, clan: filter.clan } }), true, cardId);
    assert.equal(Engine.matchesTargetFilter(filter, { targetCard: { type: "Normal Unit", grade: 3, clan: "Different Clan" } }), false, cardId);
    assert.equal(Engine.matchesTargetFilter(filter, { targetCard: { type: "Normal Unit", grade: 2, clan: filter.clan } }), false, cardId);
  }
});

test("family scope remains 23 real catalog cards split into five generic and eighteen clan-qualified records", () => {
  const familyIds = new Set([...GENERIC_CARD_IDS, ...CLAN_CARD_IDS]);
  const matches = [];
  for (const card of CATALOG) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) matches.push(`${card.id}:${ability.id}`);
  }
  assert.equal(matches.length, 23);
  assert.equal(familyIds.size, 23);
  for (const cardId of GENERIC_CARD_IDS) assert.ok(matches.includes(`${cardId}:${cardId}:1`), cardId);
  for (const cardId of CLAN_CARD_IDS) assert.ok(matches.includes(`${cardId}:${cardId}:1`), cardId);
});
