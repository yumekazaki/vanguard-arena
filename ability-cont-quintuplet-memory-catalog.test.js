"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-memory-distinct-race-power-or-shield-v1";
const MEMORY_CONDITION = {
  op: "controller-memory-has-at-least-n-different-card-names-of-race",
  count: 3,
  race: "Quintuplet"
};
const GC_TEXT = "CONT [GC]: If your memory has three or more <Quintuplet> with different card names, this unit gets shield +5000.\n\n(Hold TAB to view the related card.)";
const RC_TEXT = "CONT [RC]: If your memory has three or more <Quintuplet> with different card names, this unit gets power +2000. (Active on opponent’s turn too)";

const EXPECTED = new Map([
  ["cfa-11522", { kind: "GC", amount: 5000, effect: "continuous-shield", autoText: "AUTO: When this unit is placed by riding from \"The Quintessential Quintuplets\", you get a \"The Quintuplets’ Memories\" crest." }],
  ["cfa-11542", { kind: "GC", amount: 5000, effect: "continuous-shield", autoText: "AUTO: When this unit is placed by riding from \"The Quintessential Quintuplets\", you get a \"The Quintuplets’ Memories\" crest." }],
  ["cfa-11554", { kind: "GC", amount: 5000, effect: "continuous-shield", autoText: "AUTO: When this unit is placed by riding from \"The Quintessential Quintuplets\", you get a \"The Quintuplets’ Memories\" crest." }],
  ["cfa-11603", { kind: "GC", amount: 5000, effect: "continuous-shield", autoText: "AUTO: When this unit is placed by riding from \"The Quintessential Quintuplets\", you get a \"The Quintuplets’ Memories\" crest, search your deck for up to one <Quintuplet>, put it into the memory, and shuffle the deck." }],
  ["cfa-11667", { kind: "GC", amount: 5000, effect: "continuous-shield", autoText: "AUTO: When this unit is placed by riding from \"The Quintessential Quintuplets\", you get a \"The Quintuplets’ Memories\" crest." }],
  ["cfa-11526", { kind: "RC", amount: 2000, effect: "continuous-power", autoText: "AUTO: When this unit is placed on RC during your main phase, if you have a <Quintuplet> vanguard, look at the top three cards of your deck, choose up to one <Quintuplet> from among them, put it into memory, and shuffle the deck." }],
  ["cfa-11545", { kind: "RC", amount: 2000, effect: "continuous-power", autoText: "AUTO: When this unit is placed on RC during your main phase, if you have a <Quintuplet> vanguard, look at the top three cards of your deck, choose up to one <Quintuplet> from among them, put it into memory, and shuffle the deck." }],
  ["cfa-11607", { kind: "RC", amount: 2000, effect: "continuous-power", autoText: "AUTO: When this unit is placed on RC during your main phase, if you have a <Quintuplet> vanguard, look at the top three cards of your deck, choose up to one <Quintuplet> from among them, put it into memory, and shuffle the deck." }],
  ["cfa-11671", { kind: "RC", amount: 2000, effect: "continuous-power", autoText: "AUTO: When this unit is placed on RC during your main phase, if you have a <Quintuplet> vanguard, look at the top three cards of your deck, choose up to one <Quintuplet> from among them, put it into memory, and shuffle the deck." }]
]);

const cards = loadCatalog();
function catalogCard(cardId) {
  const card = cards.find(entry => String(entry.id) === cardId);
  assert.ok(card, `authoritative catalog card ${cardId} exists`);
  return card;
}

test("the nine catalog Quintuplet memory CONT abilities compile with exact race, count, zone, and effect", () => {
  assert.equal(auditCatalog(cards).patterns[PATTERN], EXPECTED.size, "only the nine reviewed CONT abilities use this family");
  const compiledIds = [];
  for (const [cardId, expected] of EXPECTED) {
    const card = catalogCard(cardId);
    const parsed = Engine.parseCardAbilitiesCached(card);
    const ability = parsed.find(item => item.id === `${cardId}:1`);
    assert.ok(ability, `${cardId}:1 catalog CONT block is parsed`);
    assert.equal(ability.kind, "CONT", `${cardId}:1 ability type`);

    const printedText = expected.kind === "GC" ? GC_TEXT : RC_TEXT;
    assert.equal(ability.printedText, printedText, `${cardId}:1 exact catalog text`);
    assert.ok(ability.definition, `${cardId}:1 is missing the reviewed Quintuplet memory CONT implementation`);
    assert.equal(ability.conditionStatus, "modeled", `${cardId}:1 condition has a reviewed structured evaluator`);
    assert.equal(ability.definition.cardId, cardId, `${cardId}:1 definition source card`);
    assert.equal(ability.definition.id, `${cardId}:1`, `${cardId}:1 definition ID`);
    assert.equal(ability.definition.printedText, printedText, `${cardId}:1 definition preserves printed text`);
    assert.equal(ability.definition.source?.patternId, PATTERN, `${cardId}:1 reusable CONT family`);
    assert.deepEqual(ability.requiredLocation, expected.kind === "GC" ? ["guardian"] : ["rear-guard"], `${cardId}:1 legal zone`);
    assert.equal(ability.trigger, null, `${cardId}:1 continuous ability has no trigger window`);
    assert.deepEqual(ability.definition.effects, [{
      op: expected.effect,
      target: "source",
      amount: expected.amount,
      duration: "continuous",
      condition: MEMORY_CONDITION
    }], `${cardId}:1 exact effect and distinct-memory requirement`);
    compiledIds.push(ability.id);
  }
  assert.deepEqual(compiledIds.sort(), [...EXPECTED.keys()].map(cardId => `${cardId}:1`).sort());
});

test("each matching catalog AUTO sibling remains separate from the memory CONT compiler", () => {
  for (const [cardId, expected] of EXPECTED) {
    const parsed = Engine.parseCardAbilitiesCached(catalogCard(cardId));
    const auto = parsed.find(item => item.id === `${cardId}:0`);
    const continuous = parsed.find(item => item.id === `${cardId}:1`);
    assert.equal(parsed.length, 2, `${cardId} keeps its two printed abilities distinct`);
    assert.ok(auto, `${cardId}:0 AUTO sibling remains parsed`);
    assert.equal(auto.kind, "AUTO", `${cardId}:0 is not absorbed by the CONT compiler`);
    assert.equal(auto.printedText, expected.autoText, `${cardId}:0 exact AUTO text is preserved`);
    assert.notEqual(auto.definition?.source?.patternId, PATTERN, `${cardId}:0 does not receive the CONT definition`);
    assert.equal(continuous?.kind, "CONT", `${cardId}:1 remains the separate CONT`);
  }
});

test("the similar Miku CONT without different-card-name wording is not assigned this definition", () => {
  const ability = Engine.parseCardAbilitiesCached(catalogCard("cfa-11558")).find(item => item.id === "cfa-11558:1");
  assert.equal(ability?.kind, "CONT");
  assert.match(ability?.printedText || "", /three or more <Quintuplet>, this unit gets power \+2000/i);
  assert.doesNotMatch(ability?.printedText || "", /different card names/i);
  assert.notEqual(ability?.definition?.source?.patternId, PATTERN, "a broader, different requirement must not be treated as equivalent");
});

test("browser memory projection uses the owning player's Order Zone and printed card identity", () => {
  const byId = new Map(cards.map(card => [String(card.id), card]));
  const player = {
    playerId: "local-player",
    orders: [
      { uid: "memory-ichika", cardId: "cfa-11526", ownerPlayerId: "other-owner", controllerPlayerId: "local-player" },
      { uid: "memory-nino", cardId: "cfa-11545", ownerPlayerId: "local-player", faceDown: true },
      { uid: "opponent-card", cardId: "cfa-11607", ownerPlayerId: "opponent", controllerPlayerId: "opponent" }
    ]
  };
  const memory = Engine.getControllerMemoryCards(player, cardId => byId.get(cardId));
  assert.equal(memory.length, 2, "opponent-controlled Order Zone cards cannot satisfy this player's condition");
  assert.deepEqual(memory.map(card => card.uid), ["memory-ichika", "memory-nino"]);
  assert.equal(memory[0].ownerPlayerId, "other-owner", "ownership remains separate from control");
  assert.equal(memory[0].controllerPlayerId, "local-player");
  assert.equal(memory[0].zone, "memory");
  assert.ok(memory[0].races.includes("Quintuplet"), "race is read from the authoritative catalog text");
  assert.deepEqual(memory[0].names, ["Stealth-mode Actress, Ichika Nakano"]);
  assert.equal(memory[1].faceDown, true, "face-down Order Zone cards are explicitly marked for the shared evaluator");
});

test("browser shield and power calculations pass the matching player's Memory context", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert.match(app, /function controllerMemoryCards\(side\)\{const player=match\?\.players\?\.\[side\];return window\.VanguardAbilityEngine\.getControllerMemoryCards\(player,id=>cardMap\.get\(id\)\)\}/);
  assert.match(app, /controllerPlayerId:player\?\.playerId,controllerMemoryCards:controllerMemoryCards\(side\),controllerVanguardGrade/);
  assert.match(app, /controllerGZoneCards,controllerPlayerId:player\.playerId,controllerMemoryCards:controllerMemoryCards\(side\),normalOrderPlayedThisTurn/);
});
