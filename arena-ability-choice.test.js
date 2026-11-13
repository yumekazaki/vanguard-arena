"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const choiceView = require("./arena-ability-choice.js");

test("top deck helper clamps counts and returns no cards for a zero look", () => {
  const deck = ["one", "two", "three", "four"];
  assert.deepEqual(choiceView.topDeck(deck, 2), ["three", "four"]);
  assert.deepEqual(choiceView.topDeck(deck, 0), []);
  assert.deepEqual(choiceView.topDeck(deck, -2), []);
  assert.deepEqual(choiceView.topDeck(deck, 99), deck);
  assert.deepEqual(choiceView.topDeck(null, 3), []);
});

test("filtered top-deck ability choices retain all privately examined cards and only eligible choices", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const start = source.indexOf("function abilityChoicePoolBase(");
  const end = source.indexOf("function abilityChoicePool(", start);
  assert.ok(start >= 0 && end > start, "ability choice pool must remain available");
  const deck = [
    { uid: "a", allowed: false }, { uid: "b", allowed: true },
    { uid: "c", allowed: false }, { uid: "d", allowed: true },
  ];
  const context = {
    match: { players: { human: { deck, drop: [], hand: [], damage: [], soul: [], gZone: [], rear: [] } } },
    window: {
      VanguardAbilityChoiceView: choiceView,
      VanguardAbilityEngine: { abilityCardMatchesFilter: (_filter, _side, card) => card.allowed },
    },
  };
  vm.runInNewContext(source.slice(start, end) + ";globalThis.pick = abilityChoicePoolBase;", context);
  const definition = { op: "search-top-up-to-one-filtered-to-hand", lookCount: 3, filter: {} };
  const ability = { raw: "look at the top three cards of your deck", definition: { effects: [definition] } };
  const result = context.pick({ side: "human", ability, effectUid: null, instance: { uid: "source" } });
  assert.deepEqual(Array.from(result.lookedAt, card => card.uid), ["b", "c", "d"]);
  assert.deepEqual(Array.from(result.cards, card => card.uid), ["b", "d"]);
  assert.equal(result.label, "Top 3 cards of deck");
});

test("zero-count filtered top-deck selection cannot expose or select the whole deck", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const start = source.indexOf("function abilityChoicePoolBase(");
  const end = source.indexOf("function abilityChoicePool(", start);
  const context = {
    match: { players: { human: { deck: [{ uid: "hidden" }], drop: [], hand: [], damage: [], soul: [], gZone: [], rear: [] } } },
    window: {
      VanguardAbilityChoiceView: choiceView,
      VanguardAbilityEngine: { abilityCardMatchesFilter: () => true },
    },
  };
  vm.runInNewContext(source.slice(start, end) + ";globalThis.pick = abilityChoicePoolBase;", context);
  const ability = { raw: "look at no cards", definition: { effects: [{ op: "search-top-up-to-one-filtered-to-hand", lookCount: 0, filter: {} }] } };
  const result = context.pick({ side: "human", ability, effectUid: null, instance: { uid: "source" } });
  assert.deepEqual(Array.from(result.lookedAt), []);
  assert.deepEqual(Array.from(result.cards), []);
});
