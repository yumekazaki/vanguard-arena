"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN_ID = "cont-sentinel-keyword-v1";

test("all 410 catalog Sentinel keywords remain passive CONT keywords, never manual activations", () => {
  const matches = [];
  for (const card of loadCatalog()) {
    for (const ability of Engine.parseCardAbilitiesCached(card)) {
      if (ability.definition?.source?.patternId !== PATTERN_ID) continue;
      matches.push({ card, ability });
    }
  }
  assert.equal(matches.length, 410);
  for (const { card, ability } of matches) {
    assert.equal(ability.kind, "CONT", card.id);
    assert.equal(ability.trigger, null, card.id);
    assert.deepEqual(ability.definition.keywords, ["sentinel"], card.id);
    assert.equal(ability.definition.effects, undefined, card.id);
    assert.equal(Engine.hasAbilityKeyword([ability], "sentinel"), true, card.id);
    assert.equal(Engine.hasAbilityKeyword(card, "sentinel"), true, card.id);
    assert.equal(Engine.isManuallyActivatable(ability), false, card.id);
  }
});
