"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const FAMILY = new Map([
  ["cfa-11209", "Kashuu Kiyomitsu Kiwame"],
  ["cfa-11226", "Kasen Kanesada Kiwame"],
  ["cfa-11247", "Hachisuka Kotetsu Kiwame"],
  ["cfa-11275", "Mutsunokami Yoshiyuki Kiwame"],
  ["cfa-11293", "Yamanbagiri Kunihiro Kiwame"],
]);
const PATTERN = "cont-vc-rc-card-name-alias-v1";

test("five real VC/RC CONT aliases compile with the exact printed name and circles", () => {
  for (const [cardId, alias] of FAMILY) {
    const card = catalog.find(value => value.id === cardId), ability = Engine.parseCardAbilitiesCached(card).find(value => value.id === `${cardId}:0`);
    assert.ok(card, cardId); assert.equal(ability.kind, "CONT"); assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.definition.keywords, [{ name: "card-name-alias", value: alias }]);
    assert.equal(ability.definition.printedText, `CONT [VC/RC]: This unit is also regarded as "${alias}".`);
  }
  assert.deepEqual(auditCatalog(catalog).invalidCompiled, []);
});

test("the alias is active in VC/RC only and retains the card's printed name", () => {
  for (const [cardId, alias] of FAMILY) {
    const card = catalog.find(value => value.id === cardId), serverCard = { id: cardId, name: card.name };
    assert.deepEqual(Engine.getCardNames(serverCard, { location: "vanguard" }), [card.name, alias]);
    assert.deepEqual(Engine.getCardNames(serverCard, { location: "rear-guard" }), [card.name, alias]);
    for (const location of ["hand", "deck", "soul", "drop", "guardian", "g-zone"]) assert.deepEqual(Engine.getCardNames(serverCard, { location }), [card.name], `${cardId} in ${location}`);
    assert.deepEqual(Engine.getCardNames(serverCard), [card.name], `${cardId} without a current field location`);
    assert.equal(Engine.cardHasName(serverCard, alias, { location: "vanguard" }), true);
    assert.equal(Engine.cardHasName(serverCard, alias, { location: "rear-guard" }), true);
    assert.equal(Engine.cardHasName(serverCard, alias, { location: "hand" }), false);
  }
});

test("name comparisons apply aliases only at the current legal location", () => {
  const [cardId, alias] = FAMILY.entries().next().value, source = catalog.find(card => card.id === cardId), matching = { id: "alias-match", name: alias };
  assert.equal(Engine.cardsShareName({ id: cardId, name: source.name }, matching, { leftLocation: "vanguard", rightLocation: "hand" }), true);
  assert.equal(Engine.cardsShareName({ id: cardId, name: source.name }, matching, { leftLocation: "rear-guard", rightLocation: "hand" }), true);
  assert.equal(Engine.cardsShareName({ id: cardId, name: source.name }, matching, { leftLocation: "hand", rightLocation: "hand" }), false);
});

test("all 81 exact global card-name alias CONT definitions apply in every zone", () => {
  let count = 0;
  const seen = new Set();
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== "cont-card-name-alias-v1") continue;
    count++;
    assert.equal(seen.has(ability.id), false, ability.id);
    seen.add(ability.id);
    const alias = ability.definition.keywords.find(keyword => keyword.name === "card-name-alias")?.value;
    assert.ok(alias, ability.id);
    assert.equal(ability.kind, "CONT", ability.id);
    assert.deepEqual(ability.requiredLocation, [], ability.id);
    assert.match(ability.printedText, /^CONT:\s*This card is (?:also )?regarded as ["“]/i, ability.id);
    assert.ok(ability.printedText.includes(alias), ability.id);
    const source = { id: card.id, name: card.name };
    for (const location of ["vanguard", "rear-guard", "hand", "deck", "soul", "drop", "guardian", "g-zone", "damage", "bind", "order"]) {
      assert.deepEqual(Engine.getCardNames(source, { location }), [card.name, alias], `${ability.id} in ${location}`);
    }
  }
  assert.equal(count, 81);
  assert.equal(seen.size, 81);
});
