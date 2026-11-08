"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const SOURCED_CARDS = [
  { cardId: "cfa-3195", abilityId: "cfa-3195:1", name: "Battle Siren, Melania", cardNumber: "G-CB02/020EN", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=G-CB02%2F020EN&expansion=66&view=text" },
  { cardId: "cfa-3255", abilityId: "cfa-3255:1", name: "Recon-in-force Orca Soldier", cardNumber: "G-CB02/030EN", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=G-CB02%2F030EN" }
];
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const activeCircles = [
  ["vanguard", "vanguard"],
  ["rear-left", "rear-guard"],
  ["guardian", "guardian"]
];

test("official G-CB02 Resist records preserve the exact text, source, and VC/RC/GC locations", () => {
  for (const expected of SOURCED_CARDS) {
    const card = catalog.get(expected.cardId);
    assert.ok(card, expected.cardId);
    assert.equal(card.name, expected.name);
    assert.match(card.text, /CONT\s*\[VC\/RC\/GC\]:\s*Resist \(This unit cannot be chosen by the effects of your opponent’s cards\.\)/);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === expected.abilityId);
    assert.ok(ability, expected.abilityId);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.definition?.source?.patternId, "cont-resist-keyword-v1");
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard", "guardian"]);
    assert.deepEqual(ability.definition?.keywords, ["resist"]);
    assert.equal(ability.definition?.source?.dataset, "Bushiroad Official Card List");
    assert.equal(ability.definition?.source?.officialTextVerified, true);
    assert.equal(ability.definition?.source?.cardNumber, expected.cardNumber);
    assert.equal(ability.definition?.source?.officialReference, expected.officialReference);
    assert.equal(Engine.isManuallyActivatable(ability), false);
  }
});

test("Resist blocks opponent choices only in the printed circles for both player seats", () => {
  for (const expected of SOURCED_CARDS) {
    const card = catalog.get(expected.cardId);
    for (const owner of ["host", "joining-player"]) {
      const opponent = owner === "host" ? "joining-player" : "host";
      for (const [targetZone] of activeCircles) {
        const context = {
          target: { uid: `${expected.abilityId}-${owner}` },
          targetCard: card,
          targetZone,
          targetControllerPlayerId: owner,
          sourceControllerPlayerId: opponent
        };
        assert.equal(Engine.matchesTargetFilter({}, context), false, `${expected.abilityId} rejects opponent choice in ${targetZone} for ${owner}`);
        assert.equal(Engine.matchesTargetFilter({}, { ...context, sourceControllerPlayerId: owner }), true, `${expected.abilityId} allows its controller to choose in ${targetZone}`);
      }

      for (const targetZone of ["hand", "soul", "drop", "damage", "bind", "order-zone"]) {
        const context = {
          target: { uid: `${expected.abilityId}-${owner}-off-circle` },
          targetCard: card,
          targetZone,
          targetControllerPlayerId: owner,
          sourceControllerPlayerId: opponent
        };
        assert.equal(Engine.matchesTargetFilter({}, context), true, `${expected.abilityId} is inactive outside its printed circles (${targetZone})`);
      }
    }
  }
});

test("the generic Resist compiler derives each variant's printed circle selector", () => {
  const variants = [
    ["VC", ["vanguard"]],
    ["RC", ["rear-guard"]],
    ["GC", ["guardian"]],
    ["VC/GC", ["vanguard", "guardian"]]
  ];
  for (const [selector, expectedLocations] of variants) {
    const card = { id: `test-resist-${selector}`, type: "Normal Unit", text: `CONT [${selector}]: Resist.` };
    const ability = Engine.parseCardAbilitiesCached(card)[0];
    assert.equal(ability.definition?.source?.patternId, "cont-resist-keyword-v1");
    assert.deepEqual(ability.requiredLocation, expectedLocations, selector);
  }
});
