"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const ABILITY_IDS = ["cfa-3088:1", "cfa-4205:1"];
const CARD_IDS = ABILITY_IDS.map(id => id.slice(0, id.lastIndexOf(":")));
const PATTERN = "cont-rc-cannot-be-chosen-by-opponent-v1";
const catalog = loadCatalog();
const cardById = new Map(catalog.map(card => [String(card.id), card]));

test("cfa-3088:1 and cfa-4205:1 compile the exact official RC-only Resist wording", () => {
  for (const [index, abilityId] of ABILITY_IDS.entries()) {
    const cardId = CARD_IDS[index];
    const card = cardById.get(cardId);
    assert.ok(card, cardId);
    assert.match(card.text, /CONT\s*\[RC\]:\s*This unit cannot be chosen by the effects of your opponent[’']s cards\./i, cardId);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(ability, abilityId);
    assert.equal(ability.kind, "CONT", abilityId);
    assert.equal(ability.definition?.source?.patternId, PATTERN, abilityId);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], abilityId);
    assert.deepEqual(ability.definition?.keywords, ["resist"], abilityId);
    assert.equal(ability.definition?.source?.officialTextVerified, true, abilityId);
    assert.match(ability.definition?.source?.officialReference || "", /en\.cf-vanguard\.com\/cardlist\//, abilityId);
    assert.match(ability.definition?.source?.rulesReference || "", /Comprehensive-Rules-4\.52\.pdf$/, abilityId);
    assert.equal(Engine.isManuallyActivatable(ability), false, abilityId);
  }
});

test("both player seats block only opponent choices of their exact rear-guard targets", () => {
  for (const [index, cardId] of CARD_IDS.entries()) {
    const targetCard = cardById.get(cardId);
    const abilityId = ABILITY_IDS[index];
    for (const owner of ["host", "joining-player"]) {
      const opponent = owner === "host" ? "joining-player" : "host";
      const target = { uid: `${abilityId}-${owner}`, cardId, ownerPlayerId: owner, controllerPlayerId: owner };
      const base = { target, targetCard, targetZone: "rear-left", targetControllerPlayerId: owner };
      assert.equal(Engine.matchesTargetFilter({}, { ...base, sourceControllerPlayerId: opponent }), false, `${abilityId} protects ${owner}'s RC from opponent choice`);
      assert.equal(Engine.matchesTargetFilter({}, { ...base, sourceControllerPlayerId: owner }), true, `${abilityId} does not prevent its controller's choice`);
      assert.equal(Engine.matchesTargetFilter({}, { ...base, targetZone: "hand", sourceControllerPlayerId: opponent }), true, `${abilityId} protection ends off RC`);
      assert.equal(Engine.matchesTargetFilter({}, { ...base, targetZone: "vanguard", sourceControllerPlayerId: opponent }), true, `${abilityId} does not protect a Vanguard Circle target`);
    }
  }
});

