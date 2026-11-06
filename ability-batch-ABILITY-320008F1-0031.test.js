"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const catalog = loadCatalog();
const cardById = new Map(catalog.map(card => [String(card.id), card]));
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0031.js");
Engine.registerAbilityDefinitions(contribution);
const BATCH_ID = "ABILITY-320008F1-0031";
const ASSIGNMENTS = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8"));
const assignedIds = new Set(ASSIGNMENTS.assignments.find(item => item.batchId === BATCH_ID)?.abilityIds || []);
const completedIds = new Set(ASSIGNMENTS.assignments.find(item => item.batchId === BATCH_ID)?.completedAbilityIds || []);
const EXACT_VANGUARD_NAME = "Xeno Almajestar, Astroea=Bico Masques";
const OFFICIAL_REFERENCE = "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F067EN&expansion=203";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function definition(cardId) {
  const card = cardById.get(String(cardId));
  assert.ok(card, `catalog contains ${cardId}`);
  return card;
}

function instance(cardId, uid, playerId, overrides = {}) {
  const card = definition(cardId);
  return {
    uid,
    cardId: String(card.id),
    cardName: card.name,
    type: card.type || "Unit",
    unitCard: true,
    grade: Number(card.grade),
    power: Number(card.power),
    shield: Number(card.shield || 0),
    critical: 1,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...overrides
  };
}

function player(playerId, vanguard, overrides = {}) {
  return {
    playerId,
    vanguard,
    rear: Array(5).fill(null),
    hand: [],
    deck: [],
    soul: [],
    drop: [],
    damage: [],
    bind: [],
    orders: [],
    guardCircle: [],
    gDeck: [],
    gZone: [],
    triggerZone: [],
    ...overrides
  };
}

function attackFixture({ side = "human", vanguardId = "cfa-10847", attackerId = "cfa-10867" } = {}) {
  const opponentSide = side === "human" ? "bot" : "human";
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const vanguard = instance(vanguardId, `${side}-vanguard`, playerId);
  const opponentVanguard = instance("cfa-3", `${opponentSide}-vanguard`, opponentId);
  const source = instance(attackerId, `${side}-attacker`, playerId, { circle: "rear-left", position: "front-left" });
  const own = player(playerId, vanguard);
  own.rear[0] = source;
  const opponent = player(opponentId, opponentVanguard);
  const state = {
    matchId: `zuqaqip-attack-${side}-${vanguardId}-${attackerId}`,
    stateVersion: 1,
    eventSequence: 0,
    turn: 2,
    side,
    phase: 5,
    firstTurnComplete: true,
    processedEventIds: [],
    processedActionIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: null
  };
  return { state, source, own, opponent, side, playerId, opponentSide };
}

function attack(fixture, actionId = `attack-${fixture.source.uid}`) {
  return Reducer.applyGameAction(fixture.state, {
    actorAuthUid: fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: {
      type: "game-action",
      action: "attack",
      attackerCardInstanceId: fixture.source.uid,
      targetCardInstanceId: fixture.opponent.vanguard.uid
    }
  }, seats, Engine);
}

function guardFixture({ defenderSide = "bot", defenderVanguardId = "cfa-10847", attackerVanguardId = "cfa-3" } = {}) {
  const attackerSide = defenderSide === "human" ? "bot" : "human";
  const defenderId = defenderSide === "human" ? "player-host" : "player-guest";
  const attackerId = attackerSide === "human" ? "player-host" : "player-guest";
  const defenderVanguard = instance(defenderVanguardId, `${defenderSide}-vanguard`, defenderId);
  const attackerVanguard = instance(attackerVanguardId, `${attackerSide}-vanguard`, attackerId);
  const guardCard = instance("cfa-10867", `${defenderSide}-guard-copy`, defenderId);
  const defender = player(defenderId, defenderVanguard, { hand: [guardCard] });
  const attacker = player(attackerId, attackerVanguard);
  const state = {
    matchId: `zuqaqip-guard-${defenderSide}-${defenderVanguardId}-${attackerVanguardId}`,
    stateVersion: 1,
    eventSequence: 0,
    turn: 2,
    side: attackerSide,
    phase: 5,
    firstTurnComplete: true,
    processedEventIds: [],
    processedActionIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    players: defenderSide === "human" ? { human: defender, bot: attacker } : { human: attacker, bot: defender },
    pendingAttack: {
      battleId: `battle-${defenderSide}`,
      attackerSide,
      attackerPlayerId: attackerId,
      attackerUid: attackerVanguard.uid,
      attackerZone: "vanguard",
      defenderSide,
      defenderPlayerId: defenderId,
      targetUid: defenderVanguard.uid,
      targetZone: "vanguard",
      guardCards: [],
      power: 20000,
      targetPower: 10000,
      critical: 1,
      defenderDone: false,
      blocked: false
    }
  };
  return { state, defender, attacker, guardCard, defenderSide, defenderId };
}

function guard(fixture, actionId = `guard-${fixture.guardCard.uid}`) {
  return Reducer.applyGameAction(fixture.state, {
    actorAuthUid: fixture.defenderSide === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "game-action", action: "guard", cardInstanceId: fixture.guardCard.uid }
  }, seats, Engine);
}

test("the contribution contains only its assigned exact CONT ability and preserves official source metadata", () => {
  assert.equal(contribution.length, 1);
  const ability = contribution[0];
  assert.equal(assignedIds.has(ability.id), false, "strictly promoted ability is no longer in the open assignment");
  assert.equal(completedIds.has(ability.id), true, "promotion is preserved in the assignment completion record");
  assert.equal(ability.id, "cfa-10867:0");
  assert.equal(ability.cardId, "cfa-10867");
  assert.equal(ability.printedText, definition("cfa-10867").text.split(/\r?\n/).find(line => line.trim().startsWith("CONT")));
  assert.equal(ability.source.officialCardNumber, "D-BT10/067EN");
  assert.equal(ability.source.officialReference, OFFICIAL_REFERENCE);
  assert.deepEqual(ability.requiredLocation, ["rear-guard", "guardian"]);
  assert.equal(Engine.getReviewedAbilityDefinitionsForCard("cfa-10867").some(item => item.id === ability.id), true);
});

test("Zuqaqip is passive and its exact Vanguard-name CONT modifies only its own RC power", () => {
  const card = definition("cfa-10867");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === "cfa-10867:0");
  assert.ok(ability);
  assert.equal(ability.kind, "CONT");
  assert.equal(ability.conditionStatus, "modeled");
  assert.equal(ability.costStatus, "no-cost");
  assert.equal(ability.choiceStatus, "modeled");
  assert.equal(Engine.isManuallyActivatable(ability), false);
  assert.deepEqual(ability.definition.effects.map(effect => [effect.op, effect.location, effect.amount]), [
    ["continuous-power", "rear-guard", 5000],
    ["continuous-shield", "guardian", 5000]
  ]);

  for (const side of ["human", "bot"]) {
    const matching = attackFixture({ side });
    const result = attack(matching);
    assert.equal(result.ok, true, result.reason);
    assert.equal(matching.state.pendingAttack.power, Number(matching.source.power) + 5000, `${side} seat gets the passive power`);

    const nonmatching = attackFixture({ side, vanguardId: "cfa-3" });
    const wrongName = attack(nonmatching, `wrong-name-${side}`);
    assert.equal(wrongName.ok, true, wrongName.reason);
    assert.equal(nonmatching.state.pendingAttack.power, Number(nonmatching.source.power), `${side} seat fails the exact-name condition`);
  }
});

test("a different attacker does not borrow Zuqaqip's self power, and wrong circles do not qualify", () => {
  const unrelated = attackFixture({ attackerId: "cfa-3" });
  unrelated.own.rear[0] = null;
  unrelated.source = instance("cfa-3", "human-unrelated-attacker", unrelated.playerId, { circle: "rear-left", position: "front-left" });
  unrelated.own.rear[0] = unrelated.source;
  const unrelatedAttack = attack(unrelated, "unrelated-card-attacks");
  assert.equal(unrelatedAttack.ok, true, unrelatedAttack.reason);
  assert.equal(unrelated.state.pendingAttack.power, Number(unrelated.source.power));

  const ability = Engine.parseCardAbilitiesCached(definition("cfa-10867")).find(item => item.id === "cfa-10867:0");
  const wrongCirclePower = Engine.evaluateContinuousEffects([ability], {
    location: "vanguard", sourceInstanceId: "zuqaqip-copy", targetInstanceId: "zuqaqip-copy",
    controllerVanguardCardNames: [EXACT_VANGUARD_NAME], isControllerTurn: false
  });
  assert.equal(wrongCirclePower.power, 0);
  const mismatchedInstance = Engine.evaluateContinuousEffects([ability], {
    location: "rear-guard", sourceInstanceId: "zuqaqip-copy", targetInstanceId: "other-copy",
    controllerVanguardCardNames: [EXACT_VANGUARD_NAME], isControllerTurn: false
  });
  assert.equal(mismatchedInstance.power, 0);
});

test("the exact name grants +5000 shield to either defender seat on GC, not to the opponent's guard", () => {
  for (const defenderSide of ["human", "bot"]) {
    const matching = guardFixture({ defenderSide });
    const result = guard(matching);
    assert.equal(result.ok, true, result.reason);
    assert.equal(matching.state.pendingAttack.targetPower, 10000 + Number(matching.guardCard.shield) + 5000);
    assert.equal(matching.defender.guardCircle.some(card => card.uid === matching.guardCard.uid), true);

    const wrongVanguard = guardFixture({ defenderSide, defenderVanguardId: "cfa-3", attackerVanguardId: "cfa-10847" });
    const wrongName = guard(wrongVanguard, `wrong-guard-name-${defenderSide}`);
    assert.equal(wrongName.ok, true, wrongName.reason);
    assert.equal(wrongVanguard.state.pendingAttack.targetPower, 10000 + Number(wrongVanguard.guardCard.shield));
  }
});

test("CONT output is circle-specific, exact-name-only, and remains active during the opponent's turn", () => {
  const ability = Engine.parseCardAbilitiesCached(definition("cfa-10867")).find(item => item.id === "cfa-10867:0");
  const exactContext = {
    sourceInstanceId: "zuqaqip-instance-1",
    targetInstanceId: "zuqaqip-instance-1",
    controllerVanguardCardNames: [EXACT_VANGUARD_NAME],
    isControllerTurn: false
  };
  assert.equal(Engine.evaluateContinuousEffects([ability], { ...exactContext, location: "rear-guard" }).power, 5000);
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], { ...exactContext, location: "guardian" }).shield, 5000);
  assert.equal(Engine.evaluateContinuousEffects([ability], { ...exactContext, location: "guardian" }).power, 0);
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], { ...exactContext, location: "rear-guard" }).shield, 0);

  const wrongName = { ...exactContext, controllerVanguardCardNames: ["Xeno Almajestar, Astroea=Unica"] };
  assert.equal(Engine.evaluateContinuousEffects([ability], { ...wrongName, location: "rear-guard" }).power, 0);
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], { ...wrongName, location: "guardian" }).shield, 0);
  const missingControllerVanguard = { ...exactContext, controllerVanguardCardNames: [] };
  assert.equal(Engine.evaluateContinuousEffects([ability], { ...missingControllerVanguard, location: "rear-guard" }).power, 0);
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], { ...missingControllerVanguard, location: "guardian" }).shield, 0);
});
