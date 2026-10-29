"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const EXPECTED = new Map([
  ["cfa-5929:0", ["Scout, Rather Lose Life Than Honesty", 12]],
  ["cfa-9195:0", ["Ryu’s Buddies", 9]],
  ["cfa-11929:0", ["Thoughts Spun Out", 8]],
  ["cfa-11930:0", ["Each of their Dreams", 8]],
  ["cfa-11931:0", ["Together with Everyone", 8]],
  ["cfa-12001:0", ["Thoughts Spun Out", 8]],
  ["cfa-12002:0", ["Each of Their Dreams", 8]],
  ["cfa-12003:0", ["Together with Everyone", 8]],
  ["cfa-13973:0", ["Thoughts Spun Out", 8]],
  ["cfa-13974:0", ["Each of Their Dreams", 8]],
  ["cfa-13975:0", ["Together with Everyone", 8]],
  ["cfa-7512:0", ["Sparkling Memories!", 12]],
  ["cfa-7513:0", ["Heart-pounding Dreams!", 8]],
  ["cfa-7610:0", ["Sparkling Memories!", 12]],
  ["cfa-7611:0", ["Heart-pounding Dreams!", 8]],
  ["cfa-7654:0", ["Sparkling Memories!", 12]],
  ["cfa-7655:0", ["Heart-pounding Dreams!", 8]],
  ["cfa-7663:0", ["Sparkling Memories!", 12]],
  ["cfa-7664:0", ["Heart-pounding Dreams!", 8]],
  ["cfa-7736:0", ["Sparkling Memories!", 12]],
  ["cfa-7737:0", ["Heart-pounding Dreams!", 8]],
  ["cfa-7773:0", ["Sparkling Memories!", 12]],
  ["cfa-7774:0", ["Heart-pounding Dreams!", 8]]
]);

test("all eleven exact printed CONT deck-copy restrictions compile as non-activatable named limits", () => {
  const catalog = loadCatalog();
  for (const [abilityId, [cardName, maximum]] of EXPECTED) {
    const card = catalog.find(item => String(item.id) === abilityId.split(":")[0]);
    assert.ok(card, `${abilityId} card exists in the catalog`);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(ability?.definition, `${abilityId} has a structured definition`);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.definition.source.patternId, "cont-named-deck-copy-limit-v1");
    assert.deepEqual(ability.definition.continuousRestrictions, [{ type: "named-deck-copy-limit", cardName, maximum }]);
    assert.equal(ability.definition.effects, undefined, "deck construction restrictions are not activated effects");
  }
});

test("all twenty-three real named deck-copy restrictions remain tied to their exact printed card names and limits", () => {
  const catalog = loadCatalog();
  let matches = 0;
  for (const card of catalog) {
    for (const ability of Engine.parseCardAbilitiesCached(card)) {
      if (ability.definition?.source?.patternId !== "cont-named-deck-copy-limit-v1") continue;
      matches++;
      const expected = EXPECTED.get(ability.id);
      assert.ok(expected, `${ability.id} is included in the reviewed real-card list`);
      assert.deepEqual(ability.definition.continuousRestrictions, [{ type: "named-deck-copy-limit", cardName: expected[0], maximum: expected[1] }], ability.id);
      assert.equal(ability.kind, "CONT", ability.id);
      assert.equal(ability.definition.effects, undefined, `${ability.id} is not a manually activated effect`);
    }
  }
  assert.equal(matches, 23);
  assert.equal(EXPECTED.size, matches);
});
