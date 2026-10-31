"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const family = new Map([["cfa-2007", 15000], ["cfa-254", 13000], ["cfa-260", 15000], ["cfa-263", 14000]]);

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => item.id === cardId);
  return { uid, cardId, cardName: definition?.name || cardId, grade: Number(definition?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, power: Number(definition?.power || 0), critical: 1, faceUp: true, unitCard: true, ...extra };
}

function fixture(side = "human", options = {}) {
  const controller = side === "human" ? "host-player" : "guest-player";
  const opponent = side === "human" ? "guest-player" : "host-player";
  const cardId = options.cardId || "cfa-254";
  const threshold = family.get(cardId);
  const source = card(cardId, `source-${side}`, controller, { power: threshold });
  const attacker = options.attackerIsSource === false ? card("cfa-14", `attacker-${side}`, controller, { zone: "rear-guard", circle: "rear-left" }) : source;
  const target = card("cfa-14", `target-${side}`, opponent, { zone: "vanguard", circle: "vanguard" });
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], damage: [], drop: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = source;
  players[side]["rear"][0] = attacker === source ? null : attacker;
  players[side === "human" ? "bot" : "human"].vanguard = target;
  const battleId = `attack-step-${side}`;
  const state = {
    matchId: "attack-step-critical", stateVersion: 3, turn: 2, phase: 5, side, firstSide: "human", eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players,
    pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide: side, attackerPlayerId: controller, attackerZone: attacker === source ? "vanguard" : "rear-left", targetUid: target.uid, targetZone: "vanguard", defenderSide: side === "human" ? "bot" : "human", power: 18000, targetPower: 13000, critical: 1, abilityCriticalBoost: 0, boostUid: null }
  };
  const ability = Engine.parseCardAbilities(catalog.find(item => item.id === cardId)).find(item => item.definition?.source?.patternId === "auto-attack-step-source-power-critical-battle-v1");
  const event = Engine.createGameEvent(state, {
    eventId: `attack-step-event-${side}`, type: "attack.step-started", actingPlayerId: controller, turnPlayerId: controller,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId, sourceControllerPlayerId: controller,
    cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: attacker.ownerPlayerId, subjectControllerPlayerId: controller,
    previousLocation: attacker === source ? "vanguard" : "rear-left", currentLocation: attacker === source ? "vanguard" : "rear-left",
    sourcePowerByCardInstanceId: { [source.uid]: options.sourcePower ?? threshold, [attacker.uid]: options.attackerPower ?? threshold },
    powerIncludesContinuous: true, phase: "battle", timingWindow: "attack-step-start", battleId
  });
  return { state, source, attacker, target, ability, event, side, controller, threshold };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

test("the shared compiler preserves the four verified source-power thresholds and VC restriction", () => {
  for (const [cardId, threshold] of family) {
    const ability = Engine.parseCardAbilities(catalog.find(item => item.id === cardId)).find(item => item.definition?.source?.patternId === "auto-attack-step-source-power-critical-battle-v1");
    assert.ok(ability, `${cardId} should compile from its exact printed text`);
    assert.equal(ability.definition.conditions[0].count, threshold);
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.equal(ability.trigger.eventType, "attack.step-started");
    assert.equal(ability.trigger.subject, "controller");
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-critical", target: "source", amount: 1, duration: "battle" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("the source's power snapshot, not the attack total or another unit's power, gates the trigger", () => {
  const exact = fixture("human", { sourcePower: 13000, attackerPower: 50000, attackerIsSource: false });
  assert.equal(Engine.eventMatchesAbilityTrigger(exact.ability, "attackStep", exact.event, exact.source.uid, "vanguard", null, exact.controller), true);
  assert.equal(Engine.evaluateAbilityConditions(exact.ability, { eventSourcePower: 13000 }), true);
  const exactFound=discover(exact);
  assert.equal(exactFound.queued.length, 1, JSON.stringify(exactFound));
  const below = fixture("human", { sourcePower: 12999, attackerPower: 50000, attackerIsSource: false });
  assert.equal(discover(below).queued.length, 0);
  const missingSnapshot = fixture("human");
  missingSnapshot.event = Engine.createGameEvent(missingSnapshot.state, { ...missingSnapshot.event, eventId: "missing-source-power", sourcePowerByCardInstanceId: {} });
  assert.equal(discover(missingSnapshot).queued.length, 0);
});

test("host and joining player independently resolve their own attack-step critical", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side), found = discover(f);
    assert.equal(found.queued.length, 1, JSON.stringify(found));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(resolve(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid).ok, false);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.state.pendingAttack.critical, 2);
    assert.equal(f.state.pendingAttack.abilityCriticalBoost, 1);
    assert.equal(f.source.battleCriticalBoost, 1);
    assert.equal(f.source.battleCriticalExpiryBattleId, f.state.pendingAttack.battleId);
  }
});

test("a Vanguard's own AUTO triggers at its controller's attack step even when a Rear-Guard is attacking", () => {
  const f = fixture("human", { attackerIsSource: false }), found = discover(f);
  assert.equal(found.queued.length, 1, JSON.stringify(found));
  assert.equal(resolve(f).ok, true);
  assert.equal(f.state.pendingAttack.critical, 1, "the source's critical must not be incorrectly granted to another attacker");
  assert.equal(f.source.battleCriticalBoost, 1);
});

test("battle-duration critical can resolve during the local attack setup window", () => {
  const source = { uid: "offline-vanguard", controllerPlayerId: "player-a" };
  const battleId = "offline-attack-step";
  const match = { pendingAttackSetup: { battleId, attackerUid: source.uid, attackerSide: "human" } };
  const result = Engine.resolveEffectProgram([{ op: "modify-critical", target: "source", amount: 1, duration: "battle" }], Engine.EFFECT_HANDLERS, {
    match, source, sourceInPlay: true, battleId
  });
  assert.equal(result.ok, true);
  assert.equal(match.pendingAttackSetup.battleCriticalBoost, 1);
  assert.equal(source.battleCriticalExpiryBattleId, battleId);
  const staleSource = { uid: "stale-vanguard" }, staleMatch = { pendingAttackSetup: { battleId, attackerUid: staleSource.uid, attackerSide: "human" } };
  const stale = Engine.resolveEffectProgram([{ op: "modify-critical", target: "source", amount: 1, duration: "battle" }], Engine.EFFECT_HANDLERS, {
    match: staleMatch, source: staleSource, sourceInPlay: true, battleId: "different-attack"
  });
  assert.equal(stale.ok, false);
  assert.equal(staleMatch.pendingAttackSetup.battleCriticalBoost, undefined);
  assert.equal(staleSource.battleCriticalBoost, undefined);
});
