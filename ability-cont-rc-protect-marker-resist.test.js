"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-11499", "cfa-11500", "cfa-11503", "cfa-12727"];
const TEXT = "CONT [RC]: If the circle this unit is on has a protect marker, this unit cannot be chosen by your opponent’s card effect.";
const PATTERN = "cont-rc-protect-marker-grants-resist-v1";
const card = id => catalog.find(item => item.id === id);

test("four exact RC Protect-marker abilities compile to conditional Resist, not permanent Resist", () => {
  for (const id of IDS) {
    const definition = card(id);
    assert.ok(definition, id);
    const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${id}:1`);
    assert.ok(ability, id);
    assert.equal(ability.kind, "CONT", id);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], id);
    assert.deepEqual(ability.definition.keywords || [], [], id);
    assert.deepEqual(ability.definition.continuousEffects, [{ type: "grant-keyword", target: "source", keyword: "resist", duration: "continuous", condition: { op: "source-circle-has-protect-marker" } }], id);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, id);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(id).some(item => item.id === ability.id && item.source?.patternId === PATTERN), true, id);
  }
});

test("the exact unit gains Resist only on its own marked circle and only while on RC", () => {
  const ability = Engine.parseCardAbilitiesCached(card(IDS[0])).find(item => item.id === `${IDS[0]}:1`);
  const context = { sourceInstanceId: "unit-1", sourceCardId: IDS[0], sourceLocation: "rear-guard", sourceCircle: "rear-left", sourceFaceUp: true };
  assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, sourceCircleHasProtectMarker: true }), ["resist"]);
  assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, sourceCircleHasProtectMarker: false }), []);
  assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, sourceCircleHasProtectMarker: undefined }), []);
  assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, sourceLocation: "vanguard", sourceCircleHasProtectMarker: true }), []);
  assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], { ...context, sourceFaceUp: false, sourceCircleHasProtectMarker: true }), []);
});

test("conditional Resist blocks an opponent's targeted choice, but not the controller or non-targeting effects", () => {
  const ability = Engine.parseCardAbilitiesCached(card(IDS[0])).find(item => item.id === `${IDS[0]}:1`);
  const targetCard = { id: IDS[0], name: card(IDS[0]).name, type: "Unit" };
  const activeKeywords = Engine.evaluateContinuousAbilityKeywords([ability], {
    sourceInstanceId: "unit-1", sourceCardId: IDS[0], sourceLocation: "rear-guard", sourceCircle: "rear-left", sourceFaceUp: true, sourceCircleHasProtectMarker: true
  });
  const target = { targetCard, target: { uid: "unit-1" }, targetZone: "rear-left", targetControllerPlayerId: "player-a", targetActiveKeywords: activeKeywords };
  assert.equal(Engine.matchesTargetFilter({}, { ...target, sourceControllerPlayerId: "player-b" }), false);
  assert.equal(Engine.matchesTargetFilter({}, { ...target, sourceControllerPlayerId: "player-a" }), true);
  assert.equal(Engine.matchesTargetFilter({}, { ...target, targetActiveKeywords: [] , sourceControllerPlayerId: "player-b" }), true);
});

test("the authoritative target projection checks the Protect marker on the unit's exact circle", () => {
  for (const side of ["human", "bot"]) {
    const playerId = side === "human" ? "player-host" : "player-guest";
    const unit = { uid: `protect-resist-${side}`, cardId: IDS[0], ownerPlayerId: playerId, controllerPlayerId: playerId };
    const player = { playerId, rear: [unit, null, null, null, null], giftZones: [{ type: "Protect", zone: "rear-left" }] };
    const state = { players: side === "human" ? { human: player, bot: { playerId: "player-guest", rear: [] } } : { human: { playerId: "player-host", rear: [] }, bot: player } };
    const located = Engine.locateCardInstance(state, unit.uid);
    assert.equal(located.circle, "rear-left", side);
    assert.deepEqual(Reducer.serverGrantedContinuousKeywords(state, located, Engine), ["resist"], side);
    player.giftZones[0].zone = "rear-right";
    assert.deepEqual(Reducer.serverGrantedContinuousKeywords(state, located, Engine), [], side);
  }
});

