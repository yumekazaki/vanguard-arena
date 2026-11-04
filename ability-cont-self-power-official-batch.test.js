"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const guide = "https://en.cf-vanguard.com/information/d_title_trial_deck_01_touken_ranbu_-online-_2021/";
const verified = [
  { id: "cfa-848:0", locations: ["rear-guard"], amount: -4000, reference: "https://en.cf-vanguard.com/cardlist/?cardno=BT08%2F098EN" },
  { id: "cfa-1678:3", locations: ["rear-guard"], amount: -1000, reference: "https://en.cf-vanguard.com/cardlist/?cardno=EB09%2FS01EN" },
  { id: "cfa-6217:1", locations: ["rear-guard"], amount: 5000, reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB04%2F018EN" },
  { id: "cfa-6583:0", locations: ["vanguard", "rear-guard"], amount: 10000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=131&sort=no&view=text" },
  { id: "cfa-6816:0", locations: ["vanguard"], amount: 5000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-SS08%2F046EN" },
  { id: "cfa-7391:1", locations: ["rear-guard"], amount: 10000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB14%2F038EN" },
  { id: "cfa-8457:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TTD01%2F003EN" },
  { id: "cfa-8458:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TTD01%2F002EN" },
  { id: "cfa-8474:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-TB02%2F131EN" },
  { id: "cfa-8478:0", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: guide, officialGuide: true },
  { id: "cfa-8482:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-TB02%2F132EN" },
  { id: "cfa-8525:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: guide, officialGuide: true },
  { id: "cfa-8526:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB01%2F031EN" },
  { id: "cfa-8527:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: guide, officialGuide: true },
  { id: "cfa-8556:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: guide, officialGuide: true },
  { id: "cfa-8558:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-TB02%2F138EN" },
  { id: "cfa-8561:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: guide, officialGuide: true },
  { id: "cfa-9182:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB03%2F051EN" },
  { id: "cfa-9188:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB03%2F050EN" },
  { id: "cfa-9239:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TTD03%2F002EN" },
  { id: "cfa-9637:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB02%2F048EN" },
  { id: "cfa-9783:1", locations: ["rear-guard"], amount: 2000, duringYourTurn: true, reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB03%2F125EN" }
];
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const newlyCompiled = new Set(["cfa-848:0", "cfa-1678:3", "cfa-6217:1", "cfa-6583:0", "cfa-6816:0"]);

function expectedPrintedText(record) {
  const circles = record.locations.map(location => location === "vanguard" ? "VC" : "RC").join("/");
  const turn = record.duringYourTurn ? "During your turn, this unit" : "This unit";
  const amount = `${record.amount > 0 ? "+" : ""}${record.amount}`;
  return `CONT [${circles}]: ${turn} gets power ${amount}.`;
}

function findAbility(id) {
  const cardId = id.slice(0, id.lastIndexOf(":"));
  const card = cards.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `catalog ability ${id} exists`);
  return ability;
}

test("22 officially checked CONT records preserve exact text and share their continuous power handlers", () => {
  assert.equal(verified.length, 22);
  for (const record of verified) {
    const ability = findAbility(record.id);
    const definition = ability.definition;
    const expectedText = expectedPrintedText(record);
    assert.equal(ability.kind, "CONT", record.id);
    assert.equal(ability.printedText, expectedText, record.id);
    assert.equal(definition.printedText, expectedText, record.id);
    assert.deepEqual(ability.requiredLocation, record.locations, record.id);
    assert.equal(definition.effects[0].target, "source", record.id);
    assert.equal(definition.effects[0].amount, record.amount, record.id);
    assert.equal(definition.effects[0].duration, "continuous", record.id);
    if (newlyCompiled.has(record.id)) {
      assert.equal(definition.source.patternId, "cont-self-power-adjustment-v1", record.id);
      assert.equal(definition.source.officialReference, record.reference, record.id);
      assert.equal(definition.source.dataset, record.officialGuide ? "Bushiroad official card guide" : "Bushiroad official card list", record.id);
      assert.equal(definition.effects[0].op, "continuous-power-adjustment", record.id);
      assert.deepEqual(definition.effects[0].condition, record.duringYourTurn ? { op: "controller-turn" } : { op: "always" }, record.id);
    } else {
      assert.equal(definition.source.patternId, "cont-rc-own-turn-power-v1", record.id);
      assert.equal(definition.effects[0].op, "continuous-power", record.id);
      assert.deepEqual(definition.effects[0].condition, { op: "controller-turn" }, record.id);
    }
    assert.equal(Engine.isManuallyActivatable(ability), false, `${record.id} CONT is not an ACT prompt`);
  }
});

test("continuous power stays on the exact source, in its printed circle, and during its printed turn window", () => {
  for (const record of verified) {
    const ability = findAbility(record.id);
    for (const location of record.locations) {
      const base = { sourceLocation: location, sourceInstanceId: "source-1", targetInstanceId: "source-1", isControllerTurn: true };
      assert.equal(Engine.evaluateContinuousEffects([ability], base).power, record.amount, `${record.id} at ${location} on controller turn`);
      assert.equal(Engine.evaluateContinuousEffects([ability], { ...base, targetInstanceId: "other-unit" }).power, 0, `${record.id} cannot modify a different instance`);
      assert.equal(Engine.evaluateContinuousEffects([ability], { ...base, sourceLocation: "guardian" }).power, 0, `${record.id} is inactive outside its printed circle`);
      if (record.duringYourTurn) assert.equal(Engine.evaluateContinuousEffects([ability], { ...base, isControllerTurn: false }).power, 0, `${record.id} expires on the opponent's turn`);
      else assert.equal(Engine.evaluateContinuousEffects([ability], { ...base, isControllerTurn: false }).power, record.amount, `${record.id} has no turn restriction`);
    }
    if (record.locations.length === 1) {
      const otherLocation = record.locations[0] === "vanguard" ? "rear-guard" : "vanguard";
      assert.equal(Engine.evaluateContinuousEffects([ability], { sourceLocation: otherLocation, sourceInstanceId: "source-1", targetInstanceId: "source-1", isControllerTurn: true }).power, 0, `${record.id} does not cross circles`);
    }
  }
});

test("known local-text discrepancies remain unsupported", () => {
  for (const id of ["cfa-3299:0", "cfa-9896:1"]) {
    assert.equal(findAbility(id).definition, null, `${id} has not been compiled from the mismatching catalog wording`);
  }
});
