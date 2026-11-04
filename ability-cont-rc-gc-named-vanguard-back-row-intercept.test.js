"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-gc-named-vanguard-back-row-intercept-shield-v1";
const CASES = [
  {
    abilityId: "cfa-13243:0", cardName: "Light Arrow of Aid, Turaut", vanguardName: "Sarevsael",
    printedText: "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Sarevsael\" in its card name, this unit gets \"Intercept\", can intercept from the back row, and gets shield +5000."
  },
  {
    abilityId: "cfa-13253:0", cardName: "Squish Compressor", vanguardName: "Oselargest",
    printedText: "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Oselargest\" in its card name, this unit gets \"Intercept\", can intercept from the back row, and gets shield +5000."
  },
  {
    abilityId: "cfa-13264:0", cardName: "Aegis Absorber", vanguardName: "Asturm",
    printedText: "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Asturm\" in its card name, this unit gets \"Intercept\", can intercept from the back row, and gets shield +5000."
  },
  {
    abilityId: "cfa-13309:0", cardName: "Megabarb Dragon", vanguardName: "Triumph Dragon",
    printedText: "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Triumph Dragon\" in its card name, this unit gets \"Intercept\", can intercept from the back row, and gets shield +5000."
  }
];
const cards = loadCatalog();

function catalogAbility(abilityId) {
  const cardId = abilityId.split(":")[0];
  const card = cards.find(entry => String(entry.id) === cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  assert.equal(card.name, CASES.find(item => item.abilityId === abilityId)?.cardName);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `catalog ability ${abilityId} is parsed`);
  return ability;
}

function contextFor(side, item, overrides = {}) {
  return {
    sourceInstanceId: `${side}-${item.abilityId}`,
    sourceCardId: item.abilityId.split(":")[0],
    sourceLocation: "rear-left",
    sourceFaceUp: true,
    controllerPlayerId: `${side}-player`,
    controllerVanguardGrade: 3,
    controllerVanguardCardNames: [`Vanguard of ${item.vanguardName}`],
    ...overrides
  };
}

function expectedCondition(item) {
  return {
    op: "all",
    conditions: [
      { op: "controller-vanguard-grade-at-least", grade: 3 },
      { op: "controller-vanguard-card-name-contains", name: item.vanguardName }
    ]
  };
}

test("exactly four reviewed catalog CONT abilities share the conditional back-row Intercept family", () => {
  const found = new Map();
  for (const card of cards) {
    for (const ability of Engine.parseCardAbilitiesCached(card)) {
      if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
    }
  }
  assert.deepEqual([...found.keys()].sort(), CASES.map(item => item.abilityId).sort());
  assert.equal(auditCatalog(cards).patterns[PATTERN], CASES.length);

  for (const item of CASES) {
    const ability = found.get(item.abilityId);
    const condition = expectedCondition(item);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.printedText, item.printedText);
    assert.equal(ability.definition.cardId, item.abilityId.split(":")[0]);
    assert.equal(ability.definition.printedText, item.printedText);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ["rear-guard", "guardian"]);
    assert.deepEqual(ability.definition.continuousEffects, [
      { type: "grant-keyword", target: "source", keyword: "intercept", duration: "continuous", condition },
      { type: "grant-keyword", target: "source", keyword: "back-row-intercept", duration: "continuous", condition }
    ]);
    assert.deepEqual(ability.definition.effects, [
      { op: "continuous-shield", target: "source", amount: 5000, duration: "continuous", condition }
    ]);
    assert.equal(Engine.isManuallyActivatable(ability), false, "a CONT never becomes a manual activation");
  }
  assert.deepEqual(auditCatalog(cards).invalidCompiled, []);
});

test("the Intercept and back-row permission are continuously granted only to the exact RC source under its Vanguard condition", () => {
  for (const side of ["host", "joiner"]) for (const item of CASES) {
    const ability = catalogAbility(item.abilityId);
    const valid = contextFor(side, item);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], valid), ["intercept", "back-row-intercept"], `${side}/${item.abilityId} gains both keywords`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], contextFor(side, item, { controllerVanguardGrade: 2 })), [], `${side}/${item.abilityId} rejects a grade 2 Vanguard`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], contextFor(side, item, { controllerVanguardCardNames: ["Unrelated Vanguard"] })), [], `${side}/${item.abilityId} rejects the wrong Vanguard name`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], contextFor(side, item, { controllerVanguardGrade: 2, controllerVanguardCardNames: [`${item.vanguardName} Vanguard`] })), [], `${side}/${item.abilityId} requires both conditions`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], contextFor(side, item, { sourceLocation: "vanguard" })), [], `${side}/${item.abilityId} is not active from VC`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], contextFor(side, item, { sourceFaceUp: false })), [], `${side}/${item.abilityId} is inactive face down`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], contextFor(side, item, { sourceCardId: "another-card" })), [], `${side}/${item.abilityId} cannot grant to a different source card`);
  }
});

test("the +5000 shield applies on RC and GC only while the source controller has the matching grade 3+ Vanguard", () => {
  for (const side of ["host", "joiner"]) for (const item of CASES) {
    const ability = catalogAbility(item.abilityId);
    const base = contextFor(side, item);
    for (const location of ["rear-guard", "guardian"]) {
      assert.deepEqual(Engine.evaluateContinuousShieldEffects([ability], { ...base, location }), { shield: 5000 }, `${side}/${item.abilityId} +5000 on ${location}`);
      assert.deepEqual(Engine.evaluateContinuousShieldEffects([ability], { ...base, location, controllerVanguardGrade: 2 }), { shield: 0 }, `${side}/${item.abilityId} no shield below grade 3`);
      assert.deepEqual(Engine.evaluateContinuousShieldEffects([ability], { ...base, location, controllerVanguardCardNames: ["Unrelated Vanguard"] }), { shield: 0 }, `${side}/${item.abilityId} no shield for unrelated Vanguard`);
    }
    assert.deepEqual(Engine.evaluateContinuousShieldEffects([ability], { ...base, location: "vanguard" }), { shield: 0 }, `${side}/${item.abilityId} no shield on VC`);
  }
});
