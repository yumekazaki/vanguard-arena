"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN_ID = "cont-vanguard-limit-break-4-active-at-three-or-less-v1";

test("all 24 rear-guard Limit Break enablers remain passive and enable only the Vanguard's Limit Break 4", () => {
  const matches = [];
  for (const card of loadCatalog()) {
    for (const ability of Engine.parseCardAbilitiesCached(card)) {
      if (ability.definition?.source?.patternId === PATTERN_ID) matches.push({ card, ability });
    }
  }
  assert.equal(matches.length, 24);
  for (const { card, ability } of matches) {
    assert.equal(ability.kind, "CONT", card.id);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], card.id);
    assert.deepEqual(ability.definition.keywords, ["vanguard-limit-break-4-active-at-three-or-less"], card.id);
    assert.equal(ability.definition.effects, undefined, card.id);
    assert.equal(Engine.isManuallyActivatable(ability), false, card.id);
  }

  const limitBreak = Engine.parseCardAbilities({
    id: "limit-break-batch-vanguard",
    text: "AUTO [VC] Limit Break 4: When this unit attacks a vanguard, this unit gets power +5000 until end of that battle."
  })[0];
  assert.equal(Engine.evaluateAbilityConditions(limitBreak, { damageCount: 3, vanguardLimitBreakActive: false }), false);
  assert.equal(Engine.evaluateAbilityConditions(limitBreak, { damageCount: 3, vanguardLimitBreakActive: true }), true);
  assert.equal(Engine.evaluateAbilityConditions(limitBreak, { damageCount: 4, vanguardLimitBreakActive: false }), true);
  assert.equal(Engine.evaluateAbilityConditions(limitBreak, { damageCount: 2, vanguardLimitBreakActive: false }), false);
});
