"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-11079", "cfa-11080", "cfa-11082", "cfa-11083", "cfa-11085", "cfa-11086", "cfa-11088", "cfa-11089", "cfa-11091", "cfa-11092"];
const TEXT = "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.";
const PATTERN = "cont-gc-opponent-grade-shield-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));

function instance(cardId, uid, playerId, grade) {
  const definition = cards.get(cardId) || {};
  return {
    uid, cardId, cardName: definition.name || cardId, type: definition.type || "Unit",
    trigger: definition.trigger || "", unitCard: true, grade,
    power: Number(definition.power || 0), shield: Number(definition.shield || 0),
    critical: 1, drive: 1, rested: false, locked: false,
    ownerPlayerId: playerId, controllerPlayerId: playerId
  };
}

function fixture(cardId, defenderSide, opponentGrade, ownGrade) {
  const printed = cards.get(cardId);
  assert.ok(printed, `catalog card ${cardId}`);
  const ownerId = defenderSide === "human" ? "host-player" : "guest-player";
  const opponentSide = defenderSide === "human" ? "bot" : "human";
  const opponentId = defenderSide === "human" ? "guest-player" : "host-player";
  const guardian = instance(cardId, `guardian-${cardId}-${defenderSide}-${opponentGrade}`, ownerId, Number(printed.grade));
  const ownVanguard = instance("cfa-1", `own-vg-${cardId}-${defenderSide}-${opponentGrade}`, ownerId, ownGrade);
  const opponentVanguard = instance("cfa-1", `opponent-vg-${cardId}-${defenderSide}-${opponentGrade}`, opponentId, opponentGrade);
  const makePlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], damage: [],
    drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  const defender = makePlayer(ownerId), attacker = makePlayer(opponentId);
  defender.vanguard = ownVanguard;
  defender.hand.push(guardian);
  attacker.vanguard = opponentVanguard;
  const players = defenderSide === "human" ? { human: defender, bot: attacker } : { human: attacker, bot: defender };
  const attackerSide = opponentSide;
  const state = {
    matchId: `gc-opponent-shield-${cardId}-${defenderSide}-${opponentGrade}`,
    stateVersion: 1, eventSequence: 0, side: attackerSide, turn: 3, phase: 5,
    firstTurnComplete: true, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: {
      battleId: `battle-${cardId}-${defenderSide}-${opponentGrade}`,
      attackerSide, attackerPlayerId: opponentId, attackerUid: opponentVanguard.uid, attackerZone: "vanguard",
      defenderSide, defenderPlayerId: ownerId, targetUid: ownVanguard.uid, targetZone: "vanguard",
      power: 30000, targetPower: 10000, critical: 1, guardCards: [], defenderDone: false,
      maxDriveChecks: 1, driveCountChosen: false
    },
    players
  };
  return { state, guardian, defender, defenderSide, opponentGrade, baseShield: Number(printed.shield) };
}

function guard(f) {
  return Reducer.applyGameAction(f.state, {
    actorAuthUid: f.defenderSide === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `guard-${f.state.matchId}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "guard", cardInstanceId: f.guardian.uid }
  }, seats, Engine);
}

test("the ten printed shield CONT abilities are trusted, exact, Guardian-only, and never manually activated", () => {
  for (const cardId of IDS) {
    const row = cards.get(cardId);
    assert.ok(row, cardId);
    const abilities = Engine.parseCardAbilitiesCached(row);
    const parsed = abilities.find(ability => ability.id === `${cardId}:1`);
    assert.ok(parsed, `${cardId}:1 parses`);
    assert.equal(parsed.kind, "CONT", cardId);
    assert.equal(parsed.printedText, TEXT, cardId);
    assert.equal(parsed.definition.source.patternId, PATTERN, cardId);
    assert.deepEqual(parsed.requiredLocation, ["guardian"], cardId);
    assert.deepEqual(parsed.effects, [{ op: "continuous-shield", target: "source", amount: 5000, duration: "continuous", condition: { op: "opponent-vanguard-grade-at-least", grade: 3 } }], cardId);
    assert.equal(parsed.trigger, null, cardId);
    assert.equal(Engine.isManuallyActivatable(parsed), false, cardId);
    assert.ok(abilities.some(ability => ability.id === `${cardId}:0`), `${cardId} keeps its independent alias ability`);
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(cardId).filter(definition => definition.id === `${cardId}:1`);
    assert.equal(trusted.length, 1, `${cardId} trusted server definition`);
    assert.equal(trusted[0].printedText, TEXT, cardId);
    assert.deepEqual(trusted[0].requiredLocation, ["guardian"], cardId);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(definition => definition.id === `${cardId}:0`), `${cardId} keeps its trusted alias sibling`);
  }
});

test("the server applies +5000 only on GC from the opponent Vanguard grade for both seats", () => {
  for (const cardId of IDS) for (const defenderSide of ["human", "bot"]) {
    const below = fixture(cardId, defenderSide, 2, 4);
    const belowResult = guard(below);
    assert.equal(belowResult.ok, true, `${cardId}/${defenderSide}/opponent grade 2: ${belowResult.reason || ""}`);
    assert.equal(belowResult.state.pendingAttack.targetPower, 10000 + below.baseShield, `${cardId}/${defenderSide} ignores own grade 4`);
    assert.equal(belowResult.state.pendingAbility, null, `${cardId}/${defenderSide} CONT creates no prompt`);
    assert.equal((belowResult.state.pendingAbilities || []).length, 0, `${cardId}/${defenderSide} CONT creates no pending trigger`);

    const threshold = fixture(cardId, defenderSide, 3, 1);
    const thresholdResult = guard(threshold);
    assert.equal(thresholdResult.ok, true, `${cardId}/${defenderSide}/opponent grade 3: ${thresholdResult.reason || ""}`);
    assert.equal(thresholdResult.state.pendingAttack.targetPower, 10000 + threshold.baseShield + 5000, `${cardId}/${defenderSide} uses opponent grade 3 despite own grade 1`);
    assert.equal(thresholdResult.state.pendingAbility, null, `${cardId}/${defenderSide} CONT creates no prompt`);
    assert.equal((thresholdResult.state.pendingAbilities || []).length, 0, `${cardId}/${defenderSide} CONT creates no pending trigger`);
    assert.ok(thresholdResult.state.players[defenderSide].guardCircle.some(card => card.uid === threshold.guardian.uid), `${cardId}/${defenderSide} resolves on its controller's guard`);
  }
});

test("the shared shield evaluator rejects grade, circle, and missing-opponent-grade mismatches", () => {
  for (const cardId of IDS) {
    const ability = Engine.parseCardAbilitiesCached(cards.get(cardId)).find(item => item.id === `${cardId}:1`);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: 3, controllerVanguardGrade: 1 }).shield, 5000, cardId);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: 2, controllerVanguardGrade: 4 }).shield, 0, cardId);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: null, controllerVanguardGrade: 4 }).shield, 0, cardId);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "rear-guard", opponentVanguardGrade: 3 }).shield, 0, cardId);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "vanguard", opponentVanguardGrade: 3 }).shield, 0, cardId);
  }
});
