"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const FAMILY = new Map([
  ["cfa-12845", { name: "Platinamane Stallion", clan: "Gold Paladin", count: 2, reference: "DZ-BT03/FR33EN" }],
  ["cfa-12914", { name: "Spark Spike Dragon", clan: "Narukami", count: 3, reference: "DZ-BT03/023EN" }],
  ["cfa-12924", { name: "Showered Applause Dragon", clan: "Pale Moon", count: 3, reference: "DZ-BT03/024EN" }],
  ["cfa-12926", { name: "Freezing Magic, Froros", clan: "Genesis", count: 2, reference: "DZ-BT03/FR31EN" }],
  ["cfa-13603", { name: "Tear Knight, Eilikrinis", clan: "Aqua Force", count: 3, reference: "DZ-BT06/039EN" }],
  ["cfa-13634", { name: "Demonic Dragon Nymph, Kasin", clan: "Narukami", count: 3, reference: "DZ-BT06/SR05EN" }],
]);
const PATTERN = "cont-conditional-clan-only-identity-v1";

test("six real cards compile the exact, zone-unspecified CONT clan identity", () => {
  let blocks = 0;
  for (const [cardId, expected] of FAMILY) {
    const card = catalog.find(value => value.id === cardId);
    assert.ok(card, cardId);
    assert.equal(card.name, expected.name);
    const abilities = Engine.parseCardAbilitiesCached(card);
    assert.equal(abilities.length, expected.count, `${cardId} whole-card ability count`);
    blocks += abilities.length;
    const ability = abilities[0];
    assert.equal(ability.id, `${cardId}:0`);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.printedText, `CONT: If you have a vanguard with only «${expected.clan}» for its clan, this card is only from «${expected.clan}».`);
    assert.equal(ability.definition?.source?.patternId, PATTERN);
    assert.equal(ability.definition?.source?.officialReference, `https://en.cf-vanguard.com/cardlist/?cardno=${encodeURIComponent(expected.reference)}`);
    assert.equal(ability.conditionStatus, "modeled");
    assert.deepEqual(ability.requiredLocation, []);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-only-clan", value: expected.clan }]);
    assert.deepEqual(ability.definition.clanIdentityEffects, [{ type: "conditional-clan-only", clan: expected.clan, condition: { type: "controller-vanguard-has-only-clan", value: expected.clan }, duration: "continuous" }]);
    assert.equal(Engine.isManuallyActivatable(ability), false);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, false);
  }
  assert.equal(blocks, 16, "whole-card audit covers all sibling ability blocks");
  const report = auditCatalog(catalog);
  assert.deepEqual(report.invalidCompiled, []);
  for (const cardId of FAMILY.keys()) {
    const abilities = Engine.parseCardAbilities(catalog.find(value => value.id === cardId));
    assert.ok(abilities.slice(1).some(ability => !ability.definition), `${cardId} remains incomplete until every sibling ability is supported`);
  }
});

test("the CONT changes effective clan only for an exact single-clan Vanguard and works in all zones", () => {
  const locations = ["vanguard", "rear-left", "rear-back-center", "hand", "deck", "soul", "drop", "guardian", "g-zone", "damage", "bind"];
  for (const [cardId, expected] of FAMILY) {
    const card = catalog.find(value => value.id === cardId);
    const controllerVanguardClans = [expected.clan];
    for (const location of locations) {
      assert.deepEqual(Engine.getCardClans(card, { location, controllerVanguardClans }), [expected.clan], `${cardId} in ${location}`);
      assert.equal(Engine.matchesTargetFilter({ clan: expected.clan }, { targetCard: card, targetZone: location, controllerVanguardClans }), true, `${cardId} clan filter in ${location}`);
    }
    assert.deepEqual(Engine.getCardClans(card), [], `${cardId} without a clan-matching Vanguard`);
    assert.deepEqual(Engine.getCardClans(card, { controllerVanguardClans: [expected.clan, "Kagero"] }), [], `${cardId} with multiple Vanguard clans`);
    assert.deepEqual(Engine.getCardClans(card, { controllerVanguardClans: [expected.clan === "Narukami" ? "Kagero" : "Narukami"] }), [], `${cardId} with a different Vanguard clan`);
    assert.equal(Engine.matchesTargetFilter({ clan: expected.clan }, { targetCard: card, targetZone: "deck", controllerVanguardClans: [] }), false, `${cardId} cannot be selected by clan while inactive`);
  }
  const card = catalog.find(value => value.id === "cfa-12845"), vanguard = { uid: "gold-paladin-vanguard", cardId: "vg-gold-paladin" };
  const targetPlayer = { vanguard };
  const cardDefinitionForInstance = instance => instance?.cardId === vanguard.cardId ? { id: vanguard.cardId, clan: "Gold Paladin", clans: [] } : null;
  assert.deepEqual(Engine.getCardClans(card, { targetPlayer, cardDefinitionForInstance }), ["Gold Paladin"]);
  assert.equal(Engine.matchesTargetFilter({ clan: "Gold Paladin" }, { targetCard: card, target: { uid: "conditional-card" }, targetZone: "rear-left", targetPlayer, cardDefinitionForInstance }), true);
  assert.equal(Engine.matchesTargetFilter({ clan: "Narukami" }, { targetCard: card, target: { uid: "conditional-card" }, targetZone: "rear-left", targetPlayer, cardDefinitionForInstance }), false);
});

test("other abilities count the conditional clan identity in continuous and triggered requirements", () => {
  const conditionalCard = catalog.find(card => card.id === "cfa-12845");
  const field = [{ uid: "source-vanguard", zone: "vanguard" }, { uid: "conditional-rear-guard", cardId: conditionalCard.id, zone: "rear-guard" }];
  const context = { location: "vanguard", sourceInstanceId: "source-vanguard", targetInstanceId: "source-vanguard", controllerVanguardClans: ["Gold Paladin"], controllerFieldCards: field, controllerRearGuardClans: field.slice(1), cardDefinitionForInstance: instance => catalog.find(card => card.id === instance?.cardId) };
  const continuous = { kind: "CONT", requiredLocation: ["vanguard"], definition: { effects: [{ op: "continuous-power", target: "source", amount: 1000, duration: "continuous", condition: { op: "controller-rearguard-clan-count-at-least", clan: "Gold Paladin", count: 1 } }] } };
  assert.equal(Engine.evaluateContinuousEffects([continuous], context).power, 1000);
  assert.equal(Engine.evaluateContinuousEffects([continuous], { ...context, controllerVanguardClans: ["Kagero"] }).power, 0);
  const triggered = { kind: "AUTO", conditions: [{ type: "controller-other-rear-guards-of-clan-at-least", clan: "Gold Paladin", count: 1 }] };
  assert.equal(Engine.evaluateAbilityConditions(triggered, context), true);
  assert.equal(Engine.evaluateAbilityConditions(triggered, { ...context, controllerVanguardClans: ["Kagero"] }), false);
});

test("clan-filtered resource costs accept this card only while the controller Vanguard condition is true", () => {
  const ability = { costStatus: "supported-cost", costs: [{ type: "discard", count: 1, filter: { clan: "Gold Paladin" } }] };
  const selected = { uid: "conditional-cost-copy", cardId: "cfa-12845" };
  const base = { discardableHand: 1, discardableHandCards: [selected], cardDefinitionForInstance: instance => catalog.find(card => card.id === instance?.cardId) };
  assert.equal(Engine.canPayAbilityCosts(ability, { ...base, controllerVanguardClans: ["Gold Paladin"] }), true);
  assert.equal(Engine.canPayAbilityCosts(ability, { ...base, controllerVanguardClans: ["Gold Paladin", "Kagero"] }), false);
  assert.equal(Engine.canPayAbilityCosts(ability, { ...base, controllerVanguardClans: ["Kagero"] }), false);
});

test("clan condition evaluation fails closed for missing, different, or multi-clan Vanguard data", () => {
  const ability = Engine.parseCardAbilities(catalog.find(card => card.id === "cfa-12845"))[0];
  assert.equal(Engine.evaluateAbilityConditions(ability, { controllerVanguardClans: ["Gold Paladin"] }), true);
  assert.equal(Engine.evaluateAbilityConditions(ability, { controllerVanguardClans: ["gold paladin"] }), true);
  assert.equal(Engine.evaluateAbilityConditions(ability, { controllerVanguardClans: ["Gold Paladin", "Kagero"] }), false);
  assert.equal(Engine.evaluateAbilityConditions(ability, { controllerVanguardClans: ["Kagero"] }), false);
  assert.equal(Engine.evaluateAbilityConditions(ability, {}), false);
});

test("the parser rejects near-match clan text and mismatched condition/effect clans", () => {
  const valid = "CONT: If you have a vanguard with only «Gold Paladin» for its clan, this card is only from «Gold Paladin».";
  assert.equal(Engine.compileConditionalClanOnlyIdentityDefinition("fixture", "fixture:0", "AUTO", valid), null);
  assert.equal(Engine.compileConditionalClanOnlyIdentityDefinition("fixture", "fixture:0", "CONT", valid.replace("only «Gold Paladin» for its clan", "«Gold Paladin» for its clan")), null);
  assert.equal(Engine.compileConditionalClanOnlyIdentityDefinition("fixture", "fixture:0", "CONT", valid.replace("only from «Gold Paladin»", "only from «Kagero»")), null);
  assert.throws(() => Engine.registerAbilityDefinitions([{ id: "bad-clan-cont", cardId: "bad-clan", kind: "CONT", printedText: valid, clanIdentityEffects: [{ type: "conditional-clan-only", clan: "Kagero", condition: { type: "controller-vanguard-has-only-clan", value: "Gold Paladin" }, duration: "continuous" }] }]), /invalid clan identity effect/);
});
