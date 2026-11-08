"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const CASES = [
  { crestId: "cfa-10476", name: "Chronojet", unitId: "cfa-2480" },
  { crestId: "cfa-10668", name: "Messiah", unitId: "cfa-2881", cardNumber: "D-SS04/T01EN" },
  { crestId: "cfa-12182", name: "Demon Stealth Dragon, Shiranui", unitId: "cfa-4827", cardNumber: "D-SS09/T01EN" },
  { crestId: "cfa-12183", name: "Luard", unitId: "cfa-4226", cardNumber: "D-SS10/T01EN" },
  { crestId: "cfa-13177", name: "Nightrose", unitId: "cfa-3422", cardNumber: "DZ-SS03/T01EN" },
  { crestId: "cfa-13186", name: "Harri", unitId: "cfa-3280", cardNumber: "DZ-SS02/T01EN" }
];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function abilityFor({ crestId, name }) {
  const crest = catalog.get(crestId);
  assert.ok(crest, crestId + " exists in the local catalog");
  const printedText = crestId === "cfa-10476"
    ? "CONT: The original power of your grade 3 cards with \"Chronojet\" in their card names becomes 13000. (Including Heart cards)"
    : "CONT: The original power of your grade 3 cards with \"" + name + "\" in their card names become 13000. (Including heart cards)";
  assert.ok(crest.text.includes(printedText), crestId + " retains its exact printed ability text");
  const ability = Engine.parseCardAbilitiesCached(crest).find(item => item.id === crestId + ":1");
  assert.ok(ability?.definition, crestId + ":1 compiles");
  return ability;
}
function evaluate(ability, playerId, targetCards, overrides = {}) {
  return Engine.evaluateContinuousEffects([ability], {
    sourceLocation: "crest",
    sourceCardId: ability.cardId,
    sourceInstanceId: `crest-${ability.cardId}-${playerId}`,
    targetInstanceId: targetCards[0]?.instanceId || "field-target",
    targetCircle: "vanguard",
    controllerPlayerId: playerId,
    targetCards,
    ...overrides
  });
}

function targetRecord(cardId, playerId, instanceId = `unit-${cardId}`) {
  const card = catalog.get(cardId);
  assert.ok(card, `${cardId} exists in the local catalog`);
  return { instanceId, cardName: card.name, grade: Number(card.grade), originalPower: Number(card.power),
    controllerPlayerId: playerId, hasLimitBreak4: false, isHeart: false };
}

function cardInstance(cardId, uid, playerId) {
  const card = catalog.get(cardId);
  return { uid, cardId, cardName: card.name, type: card.type, unitCard: true,
    grade: Number(card.grade || 0), power: Number(card.power || 0), critical: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId, rested: false };
}

test("each named Stride Crest compiles exact primary text as a passive Crest CONT", () => {
  for (const item of CASES) {
    const ability = abilityFor(item);
    assert.equal(ability.kind, "CONT", item.crestId);
    assert.deepEqual(ability.requiredLocation, ["crest"], item.crestId);
    assert.equal(ability.definition.source?.officialTextVerified, true, item.crestId);
    assert.equal(ability.definition.source?.officialCardNumber, item.cardNumber, item.crestId);
    assert.equal(ability.definition.effects[0].cardNameContains, item.name, item.crestId);
    assert.equal(Engine.isManuallyActivatable(ability), false, `${item.crestId}: CONT is not manually activated`);
  }
});

test("the named original-power effect is exact, continuously recalculated, and works for either online player", () => {
  for (const item of CASES) for (const playerId of ["host-player", "joining-player"]) {
    const ability = abilityFor(item);
    const unit = targetRecord(item.unitId, playerId);
    assert.equal(unit.grade, 3);
    assert.ok(unit.cardName.includes(item.name));
    assert.equal(evaluate(ability, playerId, [unit]).power, 13000 - unit.originalPower,
      `${item.crestId}/${playerId}: set original power to 13000`);
    assert.equal(evaluate(ability, playerId, [{ ...unit, originalPower: 13000 }]).power, 0,
      `${item.crestId}/${playerId}: already-13000 original power is not modified twice`);
  }
});

test("only the controller's matching Grade 3 units and matching Grade 3 hearts are affected", () => {
  for (const item of CASES) {
    const ability = abilityFor(item), playerId = "host-player";
    const matching = targetRecord(item.unitId, playerId, "matching-grade-three");
    const nonmatchingCard = targetRecord(CASES.find(other => other.name !== item.name).unitId, playerId, "other-name-grade-three");
    assert.equal(evaluate(ability, playerId, [nonmatchingCard]).power, 0, `${item.crestId}: unrelated name is excluded`);
    assert.equal(evaluate(ability, playerId, [{ ...matching, grade: 2 }]).power, 0, `${item.crestId}: Grade 2 is excluded`);
    assert.equal(evaluate(ability, playerId, [{ ...matching, controllerPlayerId: "joining-player" }]).power, 0,
      `${item.crestId}: opponent-controlled cards are excluded`);

    const heartVanguard = { instanceId: "stride-unit", grade: 4, originalPower: 15000,
      controllerPlayerId: playerId, cardName: "Stride unit", isHeart: false };
    const matchingHeart = { ...matching, instanceId: "matching-heart", heartOfInstanceId: heartVanguard.instanceId, isHeart: true };
    assert.equal(evaluate(ability, playerId, [heartVanguard, matchingHeart], { targetInstanceId: heartVanguard.instanceId }).power,
      13000 - matchingHeart.originalPower, `${item.crestId}: matching heart's original power is included`);
    const unrelatedHeart = { ...nonmatchingCard, instanceId: "unrelated-heart", heartOfInstanceId: heartVanguard.instanceId, isHeart: true };
    assert.equal(evaluate(ability, playerId, [heartVanguard, unrelatedHeart], { targetInstanceId: heartVanguard.instanceId }).power, 0,
      `${item.crestId}: a nonmatching heart is excluded`);
  }
});

test("the authoritative battle reducer applies the Crest to the correct host or joining player", () => {
  for (const item of CASES) for (const side of ["human", "bot"]) {
    const ownerId = side === "human" ? "host-player" : "joining-player";
    const opponentId = side === "human" ? "joining-player" : "host-player";
    const vanguard = cardInstance(item.unitId, `vanguard-${item.crestId}-${side}`, ownerId);
    const opposingVanguard = cardInstance("cfa-3", `opposing-vanguard-${item.crestId}-${side}`, opponentId);
    const crest = { ...cardInstance(item.crestId, `crest-${item.crestId}-${side}`, ownerId), type: "Crest" };
    const makePlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [],
      soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], crests: [] });
    const players = { human: makePlayer("host-player"), bot: makePlayer("joining-player") };
    players[side].vanguard = vanguard;
    players[side].crests.push(crest);
    players[side === "human" ? "bot" : "human"].vanguard = opposingVanguard;
    const state = { matchId: `named-crest-${item.crestId}-${side}`, stateVersion: 1, eventSequence: 0,
      processedActionIds: [], processedAbilityTriggers: [], processedEventIds: [], turn: 2, side, phase: 5,
      firstTurnComplete: true, pendingAbilities: [], players };
    const result = Reducer.applyGameAction(state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `attack-${item.crestId}-${side}`, expectedStateVersion: state.stateVersion,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: vanguard.uid,
        targetCardInstanceId: opposingVanguard.uid }
    }, seats, Engine);
    assert.equal(result.ok, true, `${item.crestId}/${side}: ${result.reason}`);
    assert.equal(result.state.pendingAttack.power, 13000, `${item.crestId}/${side}: source controller gets the corrected original power`);
  }
});

test("a named Crest stops applying outside its Crest zone and cannot be cross-wired to another name", () => {
  const item = CASES[0], ability = abilityFor(item), target = targetRecord(item.unitId, "host-player");
  assert.equal(evaluate(ability, "host-player", [target], { sourceLocation: "drop" }).power, 0);
  assert.equal(evaluate(ability, "host-player", [target], { sourceCardId: CASES[1].crestId }).power, 0);
  const tampered = structuredClone(ability);
  tampered.definition.effects[0].cardNameContains = CASES[1].name;
  assert.equal(evaluate(tampered, "host-player", [target]).power, 0,
    "the per-card name allowlist prevents another Crest's fragment from being substituted");
});
