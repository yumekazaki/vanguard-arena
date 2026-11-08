"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PRINTED_TEXT = "CONT: The original power of your grade 3 cards with the Limit Break 4 ability become 13000. (Including heart cards)";
const CARD_IDS = ["cfa-12577", "cfa-12580", "cfa-12591"];
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function cardInstance(cardId, uid, playerId) {
  const card = catalog.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name || "Unit", type: card?.type || "Unit",
    unitCard: true, grade: Number(card?.grade || 0), power: Number(card?.power || 0), critical: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId, rested: false };
}

function abilityFor(cardId) {
  const card = catalog.get(cardId);
  assert.ok(card, `${cardId} exists in the card catalog`);
  assert.ok(card.text.includes(PRINTED_TEXT), `${cardId} retains the exact printed text`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:1`);
  assert.ok(ability, `${cardId}:1 parses`);
  return ability;
}

function evaluate(ability, controllerPlayerId, targetCards, overrides = {}) {
  const cardId = ability.cardId;
  const sourceInstanceId = `crest-${cardId}-${controllerPlayerId}`;
  return Engine.evaluateContinuousEffects([ability], {
    sourceLocation: "crest",
    sourceCardId: cardId,
    sourceInstanceId,
    targetInstanceId: targetCards[0]?.instanceId || "field-target",
    targetCircle: "vanguard",
    controllerPlayerId,
    targetCards,
    ...overrides
  });
}

function gradeThree(playerId, { instanceId = "grade-three", originalPower = 11000, hasLimitBreak4 = true } = {}) {
  return { instanceId, grade: 3, originalPower, hasLimitBreak4, controllerPlayerId: playerId, isHeart: false };
}

test("the three Crest cards compile this exact ability as a Crest-only CONT with no manual prompt", () => {
  for (const cardId of CARD_IDS) {
    const ability = abilityFor(cardId);
    assert.equal(ability.kind, "CONT", cardId);
    assert.equal(ability.printedText, PRINTED_TEXT, cardId);
    assert.equal(ability.definition?.id, ability.id, `${cardId}: stable ability identity`);
    assert.equal(ability.definition?.cardId, cardId, `${cardId}: owning card identity`);
    assert.deepEqual(ability.requiredLocation, ["crest"], `${cardId}: effect is sourced from its Crest zone`);
    assert.ok(ability.definition.effects.some(effect => effect.op === "continuous-original-power-set"),
      `${cardId}: reusable original-power handler is used`);
    assert.equal(Engine.isManuallyActivatable(ability), false, `${cardId}: CONT must not offer Activate Skill`);
    assert.equal(Engine.canActivateManualAbility(ability, {}).reason, "not-manual", `${cardId}: no manual activation prompt`);
  }
});

test("the controller's Grade 3 Limit Break 4 original power becomes 13000 for either online seat", () => {
  for (const cardId of CARD_IDS) for (const controllerPlayerId of ["host-player", "joiner-player"]) {
    const ability = abilityFor(cardId);
    const result = evaluate(ability, controllerPlayerId, [gradeThree(controllerPlayerId)]);
    assert.equal(result.power, 2000, `${cardId}/${controllerPlayerId}: 13000 minus the printed 11000`);

    const rearGuard = evaluate(ability, controllerPlayerId,
      [gradeThree(controllerPlayerId, { instanceId: "rear-guard-grade-three" })], { targetCircle: "rear-left" });
    assert.equal(rearGuard.power, 2000, `${cardId}/${controllerPlayerId}: a Grade 3 rear-guard also receives the change`);

    const already13000 = evaluate(ability, controllerPlayerId,
      [gradeThree(controllerPlayerId, { originalPower: 13000 })]);
    assert.equal(already13000.power, 0, `${cardId}/${controllerPlayerId}: no extra power when original power is already 13000`);

    const reduced = evaluate(ability, controllerPlayerId,
      [gradeThree(controllerPlayerId, { originalPower: 15000 })]);
    assert.equal(reduced.power, -2000, `${cardId}/${controllerPlayerId}: original power above 13000 is reduced to 13000`);
  }
});

test("actual printed Limit Break text is used to identify an eligible unit", () => {
  const card = catalog.get("cfa-37");
  assert.ok(card, "Origin Mage, Ildona is present in the real catalog");
  assert.equal(card.name, "Origin Mage, Ildona");
  assert.equal(Number(card.grade), 3);
  assert.equal(Number(card.power), 10000);
  assert.equal(Engine.cardHasLimitBreakFourAbility(card), true,
    "the real printed Limit Break 4 ability is parsed rather than inferred from a card name");
  const ability = abilityFor(CARD_IDS[0]);
  const target = {
    instanceId: "ildona-on-field",
    grade: Number(card.grade),
    originalPower: Number(card.power),
    hasLimitBreak4: Engine.cardHasLimitBreakFourAbility(card),
    controllerPlayerId: "host-player",
    isHeart: false
  };
  assert.equal(evaluate(ability, "host-player", [target]).power, 3000,
    "10,000 original power becomes 13,000 through the same reusable rule");
});

test("authoritative attack power uses the Crest ability for host and joining player", () => {
  for (const cardId of CARD_IDS) for (const side of ["human", "bot"]) {
    const ownerId = side === "human" ? "host-player" : "guest-player";
    const opponentId = side === "human" ? "guest-player" : "host-player";
    const vanguard = cardInstance("cfa-37", `vanguard-${cardId}-${side}`, ownerId);
    const opposingVanguard = cardInstance("cfa-3", `opposing-vanguard-${cardId}-${side}`, opponentId);
    const crest = { ...cardInstance(cardId, `crest-${cardId}-${side}`, ownerId), type: "Crest" };
    const makePlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [],
      soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], crests: [] });
    const players = { human: makePlayer("host-player"), bot: makePlayer("guest-player") };
    players[side].vanguard = vanguard;
    players[side].crests.push(crest);
    players[side === "human" ? "bot" : "human"].vanguard = opposingVanguard;
    const state = { matchId: `crest-${cardId}-${side}`, stateVersion: 1, eventSequence: 0, processedActionIds: [],
      processedAbilityTriggers: [], processedEventIds: [], turn: 2, side, phase: 5, firstTurnComplete: true,
      pendingAbilities: [], players };
    const result = Reducer.applyGameAction(state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `attack-${cardId}-${side}`, expectedStateVersion: state.stateVersion,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: vanguard.uid,
        targetCardInstanceId: opposingVanguard.uid }
    }, seats, Engine);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(result.state.pendingAttack.power, 13000, `${cardId}/${side}: server applies +3000 to real 10,000 LB4 vanguard`);
  }
});

test("a G-unit's Grade 3 Limit Break 4 heart receives the original-power change", () => {
  for (const cardId of CARD_IDS) for (const controllerPlayerId of ["host-player", "joiner-player"]) {
    const ability = abilityFor(cardId);
    const fieldVanguardId = `g-unit-${controllerPlayerId}`;
    const targetAndHeart = [
      { instanceId: fieldVanguardId, grade: 4, originalPower: 15000, hasLimitBreak4: false,
        controllerPlayerId, isHeart: false },
      { instanceId: `heart-${controllerPlayerId}`, heartOfInstanceId: fieldVanguardId, grade: 3, originalPower: 11000, hasLimitBreak4: true,
        controllerPlayerId, isHeart: true }
    ];
    const result = evaluate(ability, controllerPlayerId, targetAndHeart, { targetInstanceId: fieldVanguardId });
    assert.equal(result.power, 2000, `${cardId}/${controllerPlayerId}: eligible heart is included, G-unit itself is not`);
  }
});

test("wrong controller, grade, missing Limit Break 4, or missing exact target identity do not change power", () => {
  for (const cardId of CARD_IDS) {
    const ability = abilityFor(cardId);
    const controllerPlayerId = "host-player";
    const cases = [
      { label: "opponent-controlled Grade 3", cards: [gradeThree("joiner-player")] },
      { label: "Grade 2 with Limit Break 4", cards: [{ ...gradeThree(controllerPlayerId), grade: 2 }] },
      { label: "Grade 3 without Limit Break 4", cards: [gradeThree(controllerPlayerId, { hasLimitBreak4: false })] }
    ];
    for (const item of cases) {
      assert.equal(evaluate(ability, controllerPlayerId, item.cards).power, 0, `${cardId}: ${item.label}`);
    }
    assert.equal(evaluate(ability, controllerPlayerId, [gradeThree(controllerPlayerId)], {
      targetInstanceId: "different-field-instance"
    }).power, 0, `${cardId}: exact field instance must be the evaluated target`);
    const fieldTarget = gradeThree(controllerPlayerId, { instanceId: "field-target" });
    const unrelatedCard = gradeThree(controllerPlayerId, { instanceId: "other-field-unit" });
    assert.equal(evaluate(ability, controllerPlayerId, [fieldTarget, unrelatedCard]).power, 2000,
      `${cardId}: a continuous calculation cannot modify unrelated field cards`);
    assert.equal(evaluate(ability, controllerPlayerId, [gradeThree(controllerPlayerId)], {
      sourceCardId: CARD_IDS.find(id => id !== cardId)
    }).power, 0, `${cardId}: a different Crest card cannot source this ability`);
    assert.equal(evaluate(ability, controllerPlayerId, [gradeThree(controllerPlayerId)], {
      sourceInstanceId: ""
    }).power, 0, `${cardId}: a missing exact Crest instance cannot source this ability`);
    assert.equal(evaluate(ability, controllerPlayerId, [gradeThree(controllerPlayerId)], {
      sourceInstanceId: "grade-three"
    }).power, 0, `${cardId}: a source ID equal to the target ID is rejected`);
  }
});

test("the effect stops applying as soon as its Crest source leaves the Crest zone", () => {
  for (const cardId of CARD_IDS) {
    const ability = abilityFor(cardId);
    const target = [gradeThree("host-player")];
    for (const sourceLocation of ["rear-guard", "drop", "hand"]) {
      assert.equal(evaluate(ability, "host-player", target, { sourceLocation }).power, 0,
        `${cardId}: no modification while the Crest is in ${sourceLocation}`);
    }
  }
});
