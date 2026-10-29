"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PATTERN = "auto-gc-no-grade-three-ride-choice-v1";

function cardInstance(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(card => String(card.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name || "Unit", type: definition?.type || "Unit", grade: Number(definition?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function setup(side = "bot", { rodeGradeThreePlusThisFight = false, battleId = "battle-gg3", targetCritical = 3 } = {}) {
  const ownId = side === "human" ? "host-player" : "guest-player", opponentSide = side === "human" ? "bot" : "human", opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const card = catalog.find(item => String(item.id) === "cfa-8698");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability);
  const source = cardInstance(card.id, `guard-${side}`, ownId, { zone: "guardian", circle: "guardian" });
  const ownVanguard = cardInstance("cfa-3", `own-vg-${side}`, ownId, { zone: "vanguard", circle: "vanguard", power: 10000 });
  const opponentVanguard = cardInstance("cfa-3", `opponent-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard", power: 15000, critical: targetCritical });
  const player = id => ({ playerId: id, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], rodeGradeThreePlusThisFight: false });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = ownVanguard;
  players[side].guardCircle.push(source);
  players[side].rodeGradeThreePlusThisFight = rodeGradeThreePlusThisFight;
  players[opponentSide].vanguard = opponentVanguard;
  const state = { matchId: "g-guardian-grade-three-choice", stateVersion: 1, side: opponentSide, phase: 3, turn: 2, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players,
    pendingAttack: { battleId, attackerSide: opponentSide, attackerUid: opponentVanguard.uid, attackerZone: "vanguard", defenderSide: side, targetUid: ownVanguard.uid, targetZone: "vanguard", power: 20000, targetPower: 10000, critical: targetCritical, guardCards: [] } };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownId, turnPlayerId: opponentId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId, sourceControllerPlayerId: ownId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownId, subjectControllerPlayerId: ownId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", battleId, phase: "guard", timingWindow: "guard"
  });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, side, ownId, opponentId, source, ownVanguard, opponentVanguard, ability, discovery };
}

function respond(fixture, { choice, targetUid, actorAuthUid = fixture.side === "human" ? "auth-host" : "auth-guest", actionId = `resolve-${fixture.side}` }) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id, effectChoice: choice, targetUid } }
  }, seats, Engine);
}

test("all 27 exact grade-three ride restriction choice abilities register and remain ability-scoped", () => {
  const ids = new Set();
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    ids.add(ability.cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
    assert.equal(ability.trigger.sourceLocation, "hand");
    assert.deepEqual(ability.trigger.circles, ["guardian"]);
  }
  assert.equal(ids.size, 27);
  assert.equal(Reducer.supportsServerEffectOperation("g-guardian-grade-three-replacement-choice"), false);
});

test("host and joining player independently choose either exact target and resolve the printed effect", () => {
  for (const side of ["human", "bot"]) {
    const power = setup(side);
    assert.equal(power.discovery.queued.length, 1);
    assert.equal(power.state.pendingAbility.side, side);
    const powerResult = respond(power, { choice: "vanguard-power", targetUid: power.ownVanguard.uid });
    assert.equal(powerResult.ok, true, powerResult.reason);
    assert.equal(power.ownVanguard.turnPowerBoost, 10000);
    assert.equal(power.ownVanguard.turnPowerExpiry, power.ownVanguard.controllerPlayerId);
    assert.equal(power.opponentVanguard.turnPowerBoost || 0, 0);

    const critical = setup(side);
    const criticalResult = respond(critical, { choice: "opponent-critical", targetUid: critical.opponentVanguard.uid });
    assert.equal(criticalResult.ok, true, criticalResult.reason);
    assert.equal(critical.opponentVanguard.battleCriticalBoost, -2);
    assert.equal(critical.opponentVanguard.battleCriticalExpiryBattleId, "battle-gg3");
    assert.equal(critical.state.pendingAttack.critical, 1);
    assert.equal(critical.ownVanguard.battleCriticalBoost || 0, 0);
  }
});

test("wrong actor, unmet fight condition, wrong battle, choice, or target rejects atomically", () => {
  const wrongActor = setup("bot");
  assert.equal(respond(wrongActor, { choice: "vanguard-power", targetUid: wrongActor.ownVanguard.uid, actorAuthUid: "auth-host" }).ok, false);

  const rode = setup("bot", { rodeGradeThreePlusThisFight: true });
  const rodeSnapshot = structuredClone(rode.state);
  assert.equal(rode.discovery.queued.length, 0);
  assert.deepEqual(rode.state, rodeSnapshot);

  const invalidTarget = setup("bot");
  const invalidSnapshot = structuredClone(invalidTarget.state);
  assert.equal(respond(invalidTarget, { choice: "vanguard-power", targetUid: invalidTarget.opponentVanguard.uid }).ok, false);
  assert.deepEqual(invalidTarget.state, invalidSnapshot);

  const invalidChoice = setup("bot");
  assert.equal(respond(invalidChoice, { choice: "unknown", targetUid: invalidChoice.ownVanguard.uid }).ok, false);

  const wrongBattle = setup("bot", { battleId: null });
  wrongBattle.state.pendingAttack.battleId = null;
  const wrongBattleSnapshot = structuredClone(wrongBattle.state);
  assert.equal(respond(wrongBattle, { choice: "opponent-critical", targetUid: wrongBattle.opponentVanguard.uid }).ok, false);
  assert.deepEqual(wrongBattle.state, wrongBattleSnapshot);
});
