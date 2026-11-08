"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");
engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

test("Refablishment Dock preserves and independently models both exact printed abilities", () => {
  const card = loadCatalog().find(entry => String(entry.id) === "cfa-9115");
  assert.ok(card, "Refablishment Dock is present in the card catalog");

  const abilities = engine.parseCardAbilitiesCached(card);
  assert.deepEqual(abilities.map(ability => ability.id), ["cfa-9115:0", "cfa-9115:1"]);

  const draw = abilities[0];
  assert.equal(draw.kind, "AUTO");
  assert.equal(draw.printedText, "AUTO: When this card is put into the Order Zone, draw a card.");
  assert.equal(draw.trigger.eventType, "card.placed");
  assert.equal(draw.trigger.subject, "source");
  assert.deepEqual(draw.trigger.circles, ["order"]);
  assert.deepEqual(draw.effects, [{ op: "draw", count: 1 }]);
  assert.equal(draw.definition.source.cardNumber, "D-BT03/093EN");
  assert.match(draw.definition.source.officialReference, /cardno=D-BT03%2F093EN/);

  const boost = abilities[1];
  assert.equal(boost.kind, "CONT");
  assert.equal(boost.printedText, 'CONT [Order Zone]: All of your grade 2 rear-guards get "Boost".');
  assert.deepEqual(boost.definition.requiredLocation, ["order"]);
  assert.deepEqual(boost.definition.continuousEffects, [{
    type: "grant-keyword",
    target: "controller-rear-guards-of-grade",
    keyword: "boost",
    grade: 2,
    duration: "continuous",
    condition: { op: "always" }
  }]);
  assert.match(boost.definition.source.officialReference, /en\.cf-vanguard\.com\/cardlist/);
});
