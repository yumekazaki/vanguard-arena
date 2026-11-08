"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const VanguardAbilityEngine = require("./ability-engine.js");
VanguardAbilityEngine.registerAbilityDefinitions(require("./ability-definitions.js"));

const members = [
  ["cfa-455", "Demon Bike of the Witching Hour"],
  ["cfa-475", "Hades Carriage of the Witching Hour"],
  ["cfa-483", "Demon Chariot of the Witching Hour"]
];

test("Witching Hour Soul-count CONT abilities count only exact-name Soul cards on VC and RC during their controller's turn", () => {
  const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
  const catalog = loadCatalog();

  for (const [cardId, exactName] of members) {
    const card = catalog.find(item => item.id === cardId);
    assert.ok(card, `catalog contains ${cardId}`);
    const [ability] = VanguardAbilityEngine.parseCardAbilities(card);
    assert.equal(ability.id, `${cardId}:0`);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.definition?.source?.patternId, "cont-soul-card-count-exact-name-power-v1");
    assert.deepEqual(ability.definition.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(ability.definition.effects[0].cardName, exactName);
    assert.equal(ability.definition.effects[0].cardNameContains, undefined);

    const soulCardNames = [exactName, exactName, `${exactName} Custom`, `Other ${exactName}`];
    for (const location of ["vanguard", "rear-guard"]) {
      assert.equal(VanguardAbilityEngine.evaluateContinuousEffects([ability], {
        location,
        isControllerTurn: true,
        soulCardNames
      }).power, 4000, `${cardId} gets +2000 for each exact-name Soul copy at ${location}`);
    }
    assert.equal(VanguardAbilityEngine.evaluateContinuousEffects([ability], {
      location: "rear-guard",
      isControllerTurn: false,
      soulCardNames
    }).power, 0, `${cardId} has no power increase during the opponent's turn`);
    assert.equal(VanguardAbilityEngine.evaluateContinuousEffects([ability], {
      location: "guardian",
      isControllerTurn: true,
      soulCardNames
    }).power, 0, `${cardId} has no power increase outside VC and RC`);
  }
});

test("the shared parser preserves exact-name wording instead of silently using a name fragment", () => {
  const exactName = "Example Witching Hour Unit";
  const [ability] = VanguardAbilityEngine.parseCardAbilities({
    id: "soul-exact-name-parser-fixture",
    text: `CONT [VC/RC]: During your turn, this unit gets power +2000 for each card named "${exactName}" in your soul.`
  });
  assert.equal(ability.definition?.source?.patternId, "cont-soul-card-count-exact-name-power-v1");
  assert.deepEqual(ability.definition.requiredLocation, ["vanguard", "rear-guard"]);
  assert.equal(ability.definition.effects[0].cardName, exactName);
  assert.equal(ability.definition.effects[0].cardNameContains, undefined);
  assert.equal(VanguardAbilityEngine.evaluateContinuousEffects([ability], {
    location: "vanguard",
    isControllerTurn: true,
    soulCardNames: [exactName, `${exactName} Custom`]
  }).power, 2000);
});
