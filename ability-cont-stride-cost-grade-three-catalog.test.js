"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
const definitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(definitions);
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog(process.cwd());
const cards = new Map(catalog.map(card => [String(card.id), card]));
const patternId = "cont-hand-stride-cost-treated-grade-three-v1";
const abilityIds = definitions
  .filter(definition => definition.source?.patternId === patternId)
  .filter(definition => Engine.parseCardAbilitiesCached(cards.get(String(definition.cardId))).length === 1)
  .map(definition => definition.id);

test("all 24 sole-skill critical triggers preserve the exact hand-only Stride replacement", () => {
  assert.equal(abilityIds.length, 24);
  assert.equal(new Set(abilityIds.map(id => id.split(":")[0])).size, 24);
  for (const abilityId of abilityIds) {
    const card = cards.get(abilityId.split(":")[0]);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(card && ability, `${abilityId}: catalog card and parsed ability exist`);
    assert.equal(Engine.parseCardAbilitiesCached(card).length, 1, `${abilityId}: all printed abilities accounted for`);
    assert.ok(card.text.includes(ability.printedText), `${abilityId}: original printed skill text is retained`);
    assert.match(ability.printedText, /^CONT \[Hand\]: While (?:you are )?paying the cost for Stride, this card may be discarded as a grade 3\.$/i, abilityId);
    assert.equal(ability.kind, "CONT", abilityId);
    assert.deepEqual(ability.requiredLocation, ["hand"], abilityId);
    assert.deepEqual(ability.definition.effects, [{
      op: "continuous-grade", target: "source", amount: 3, duration: "stride-payment",
      condition: { op: "paying-stride-cost" }, mode: "treat-as-grade-three"
    }], abilityId);
    assert.equal(Engine.isManuallyActivatable(ability), false, `${abilityId}: CONT is not a manual skill`);
  }
});

test("each exact card counts as grade 3 only from hand during its controller's Stride payment", () => {
  for (const abilityId of abilityIds) {
    const ability = Engine.parseCardAbilitiesCached(cards.get(abilityId.split(":")[0])).find(item => item.id === abilityId);
    for (const controllerSide of ["human", "bot"]) {
      const ownHandDuringPayment = Engine.evaluateStrideCostGrade([ability], { location: "hand", isPayingStrideCost: true, controllerSide });
      assert.deepEqual(ownHandDuringPayment, { grade: 0, treatedAsGradeThree: true }, `${controllerSide} ${abilityId}: own Stride payment`);
      assert.deepEqual(Engine.evaluateStrideCostGrade([ability], { location: "hand", isPayingStrideCost: false, controllerSide }), { grade: 0 }, `${controllerSide} ${abilityId}: outside cost payment`);
      assert.deepEqual(Engine.evaluateStrideCostGrade([ability], { location: "rear-guard", isPayingStrideCost: true, controllerSide }), { grade: 0 }, `${controllerSide} ${abilityId}: not in hand`);
    }
  }
});

test("the live Stride legality path evaluates the selected hand card only while paying Stride", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /evaluateStrideCostGrade\(cardAbilities\(card\),\{location:"hand",isPayingStrideCost\}\)/);
  assert.match(app, /strideGrade\(instance,isPayingStrideCost=false\)/);
});
