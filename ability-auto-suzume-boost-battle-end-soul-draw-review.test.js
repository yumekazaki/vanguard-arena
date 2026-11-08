"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

test("Suzume's exact boost text is source-checked and trusted for authoritative play", () => {
  const card = loadCatalog().find(item => item.id === "cfa-13400");
  const abilities = Engine.parseCardAbilitiesCached(card);
  const ability = abilities.find(item => item.id === "cfa-13400:1");

  assert.ok(ability);
  assert.equal(ability.definition?.source?.patternId, "auto-boost-power-and-battle-end-source-soul-draw-v1");
  assert.equal(ability.definition?.source?.officialTextVerified, true);
  assert.equal(ability.definition?.source?.dataset, "Bushiroad official card list");
  assert.equal(ability.definition?.source?.officialCardNumber, "DZ-SS04/CR02");
  assert.equal(ability.definition?.source?.officialLanguage, "ja");
  assert.equal(ability.definition?.source?.officialReference, "https://cf-vanguard.com/cardlist/?cardno=DZ-SS04%2FCR02");
  assert.equal(ability.definition?.source?.officialCrossReference, "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS09%2F010EN");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.equal(ability.trigger?.eventType, "unit.boosted");
  assert.equal(ability.trigger?.subject, "source");
  assert.deepEqual(ability.conditions, [{ type: "any-of", conditions: [
    { type: "opponent-rear-guards-at-most", count: 1 },
    { type: "order-played-this-turn" }
  ] }]);
  assert.deepEqual(ability.definition?.effects, [
    { op: "modify-power", target: "source", amount: 5000, duration: "battle" },
    { op: "schedule-boosted-battle-end-source-soul-draw", target: "source", due: "battle-close-step" }
  ]);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
});
