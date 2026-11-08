"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = loadCatalog();
const CARDS = new Map(CATALOG.map(card => [String(card.id), card]));
const PATTERN = "cont-hand-stride-cost-named-vanguard-grade-boost-v1";
const FAMILY = [
  {
    cardId: "cfa-3622", abilityId: "cfa-3622:0", nameFragment: "Maiden of", amount: 1,
    printedText: 'CONT [Hand]: While you are paying the cost for Stride, if you have a vanguard with "Maiden of" in its card name, this card gets grade +1.'
  },
  {
    cardId: "cfa-4405", abilityId: "cfa-4405:0", nameFragment: "Alfred", amount: 1,
    printedText: 'CONT [Hand]: While you are paying the cost for Stride, if you have a vanguard with "Alfred" in its card name, this card gets grade +1.'
  },
  {
    cardId: "cfa-5067", abilityId: "cfa-5067:1", nameFragment: "Eradicator", amount: 2,
    printedText: 'CONT [Hand]: While you are paying the cost for Stride, if you have a vanguard with "Eradicator" in its card name, this card gets grade +2.'
  }
];
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const fillerGradeOne = CATALOG.find(card => Number(card.grade) === 1 && /unit/i.test(card.type || "") && !FAMILY.some(entry => entry.cardId === String(card.id)));
assert.ok(fillerGradeOne, "catalog has a normal grade-1 Stride-cost card");

function cardInstance(definition, uid, playerId, extra = {}) {
  return {
    uid,
    cardId: String(definition.id),
    cardName: definition.name,
    name: definition.name,
    type: definition.type,
    grade: Number(definition.grade),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...extra
  };
}

function abilityFor(entry) {
  const card = CARDS.get(entry.cardId);
  assert.ok(card, `${entry.cardId} is present in the catalog`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === entry.abilityId);
  assert.ok(ability, `${entry.abilityId} parses from its exact catalog card`);
  return { card, ability };
}

function fixture(entry, side, { matchingVanguard = true, opponentHasMatchingName = false } = {}) {
  const ownId = side === "human" ? "player-host" : "player-guest";
  const otherId = side === "human" ? "player-guest" : "player-host";
  const ownName = matchingVanguard ? `Test ${entry.nameFragment} Vanguard` : "Unrelated Vanguard";
  const opponentName = opponentHasMatchingName ? `Opponent ${entry.nameFragment} Vanguard` : "Other Vanguard";
  const ownVanguard = {
    uid: `own-vanguard-${entry.cardId}-${side}`, cardId: `fixture-own-vanguard-${side}`,
    cardName: ownName, name: ownName, type: "Unit", grade: 3,
    ownerPlayerId: ownId, controllerPlayerId: ownId
  };
  const opponentVanguard = {
    uid: `opponent-vanguard-${entry.cardId}-${side}`, cardId: `fixture-opponent-vanguard-${side}`,
    cardName: opponentName, name: opponentName, type: "Unit", grade: 3,
    ownerPlayerId: otherId, controllerPlayerId: otherId
  };
  const source = cardInstance(CARDS.get(entry.cardId), `stride-cost-source-${entry.cardId}-${side}`, ownId);
  const additionalCost = entry.amount === 1
    ? cardInstance(fillerGradeOne, `stride-cost-extra-${entry.cardId}-${side}`, ownId)
    : null;
  const strideCard = {
    uid: `stride-unit-${entry.cardId}-${side}`, cardId: `fixture-stride-${entry.cardId}`,
    cardName: "Test Stride Unit", name: "Test Stride Unit", type: "G Unit", grade: 4,
    gDeckCard: true, faceUp: false, ownerPlayerId: ownId, controllerPlayerId: ownId
  };
  const makePlayer = (playerId, vanguard) => ({
    playerId, vanguard, rear: Array(5).fill(null), hand: [], deck: [], damage: [], soul: [],
    drop: [], bind: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [],
    triggerZone: [], guardCircle: [], usedAbilities: []
  });
  const ownPlayer = makePlayer(ownId, ownVanguard);
  const otherPlayer = makePlayer(otherId, opponentVanguard);
  ownPlayer.hand.push(source);
  if (additionalCost) ownPlayer.hand.push(additionalCost);
  ownPlayer.gDeck.push(strideCard);
  const players = side === "human"
    ? { human: ownPlayer, bot: otherPlayer }
    : { human: otherPlayer, bot: ownPlayer };
  const state = {
    matchId: `named-stride-cost-${entry.cardId}-${side}`,
    stateVersion: 1,
    side,
    phase: 3,
    turn: 2,
    stridePerformed: false,
    turnStartGrades: { human: 3, bot: 3 },
    processedActionIds: [],
    processedEventIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    pendingAbility: null,
    pendingTrigger: null,
    pendingAttack: null,
    pendingTurnEnd: null,
    players
  };
  return { state, side, ownId, ownPlayer, source, additionalCost, strideCard, ownVanguard, opponentVanguard };
}

function stride(f, actionId = `stride-${f.side}-${f.source.uid}`) {
  return Reducer.applyGameAction(f.state, {
    actorAuthUid: f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "game-action",
      action: "stride",
      strideCardInstanceId: f.strideCard.uid,
      costCardInstanceIds: [f.source.uid, ...(f.additionalCost ? [f.additionalCost.uid] : [])]
    }
  }, SEATS, Engine);
}

test("the exact Hand CONT definitions keep each printed Vanguard-name fragment and grade amount", () => {
  for (const entry of FAMILY) {
    const { card, ability } = abilityFor(entry);
    assert.ok(card.text.includes(entry.printedText), `${entry.abilityId}: original printed text is preserved`);
    assert.equal(ability.kind, "CONT", entry.abilityId);
    assert.equal(ability.definition.printedText, entry.printedText, entry.abilityId);
    assert.equal(ability.definition.source.patternId, PATTERN, entry.abilityId);
    assert.deepEqual(ability.requiredLocation, ["hand"], entry.abilityId);
    assert.deepEqual(ability.definition.effects, [{
      op: "continuous-grade", target: "source", amount: entry.amount, duration: "stride-payment",
      condition: { op: "all", conditions: [
        { op: "paying-stride-cost" },
        { op: "controller-vanguard-card-name-contains", name: entry.nameFragment }
      ] }
    }], entry.abilityId);
    if (entry.cardId === "cfa-5067") {
      assert.notEqual(ability.definition.source.officialTextVerified, true, "direct official text verification remains pending for cfa-5067");
    }
  }
});

test("the grade bonus requires the matching controller Vanguard and only applies during hand Stride payment", () => {
  for (const entry of FAMILY) {
    const { ability } = abilityFor(entry);
    assert.deepEqual(Engine.evaluateStrideCostGrade([ability], {
      location: "hand", isPayingStrideCost: true,
      controllerVanguardCardNames: [`My ${entry.nameFragment.toLocaleLowerCase()} Vanguard`]
    }), { grade: entry.amount }, `${entry.abilityId}: matching name grants exactly the printed amount`);
    assert.deepEqual(Engine.evaluateStrideCostGrade([ability], {
      location: "hand", isPayingStrideCost: true, controllerVanguardCardNames: ["Unrelated Vanguard"]
    }), { grade: 0 }, `${entry.abilityId}: a nonmatching Vanguard grants no bonus`);
    assert.deepEqual(Engine.evaluateStrideCostGrade([ability], {
      location: "hand", isPayingStrideCost: false,
      controllerVanguardCardNames: [`My ${entry.nameFragment} Vanguard`]
    }), { grade: 0 }, `${entry.abilityId}: outside Stride payment the ordinary grade is unchanged`);
    assert.deepEqual(Engine.evaluateStrideCostGrade([ability], {
      location: "rear-guard", isPayingStrideCost: true,
      controllerVanguardCardNames: [`My ${entry.nameFragment} Vanguard`]
    }), { grade: 0 }, `${entry.abilityId}: the ability does not apply outside hand`);
    assert.deepEqual(Engine.evaluateStrideCostGrade([ability], {
      location: "hand", isPayingStrideCost: true, controllerVanguardCardNames: []
    }), { grade: 0 }, `${entry.abilityId}: a missing Vanguard name cannot satisfy the condition`);
  }
});

test("the authoritative Stride reducer accepts only the correct player's matching-name grade bonus", () => {
  for (const entry of FAMILY) for (const side of ["human", "bot"]) {
    const legal = fixture(entry, side, { matchingVanguard: true });
    const accepted = stride(legal);
    assert.equal(accepted.ok, true, `${entry.abilityId}/${side}: legal named Stride cost is accepted (${accepted.reason || ""})`);
    assert.equal(legal.ownPlayer.vanguard.uid, legal.strideCard.uid, `${entry.abilityId}/${side}: that player's G Unit strides`);
    assert.ok(legal.ownPlayer.drop.some(card => card.uid === legal.source.uid), `${entry.abilityId}/${side}: exact grade bonus card is paid`);
    if (legal.additionalCost) assert.ok(legal.ownPlayer.drop.some(card => card.uid === legal.additionalCost.uid));
    assert.equal(legal.state.stridePerformed, true);

    const wrongName = fixture(entry, side, { matchingVanguard: false, opponentHasMatchingName: true });
    const before = JSON.stringify(wrongName.state);
    const rejected = stride(wrongName);
    assert.equal(rejected.ok, false, `${entry.abilityId}/${side}: opponent's matching Vanguard cannot satisfy the condition`);
    assert.equal(rejected.reason, "stride-cost-grade-insufficient", `${entry.abilityId}/${side}: payment is rejected as insufficient`);
    assert.equal(JSON.stringify(wrongName.state), before, `${entry.abilityId}/${side}: rejection does not partially pay or Stride`);
  }
});
