"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0004.js");
Engine.registerAbilityDefinitions(contribution);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PRINTED = "AUTO [RC]: When this unit attacks a vanguard, if it is the fourth battle of this turn or more, this unit gets power +5000 until end of that battle.";
const PATTERN = "auto-rc-own-attack-fourth-battle-power-battle-v1";

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  return {
    uid,
    cardId: String(cardId),
    cardName: definition?.name || String(cardId),
    grade: Number(definition?.grade ?? 0),
    unitCard: /\bunit\b/i.test(String(definition?.type || "")),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    power: Number(definition?.power ?? 13000),
    critical: 1,
    ...extra
  };
}

function makePlayer(playerId, vanguard) {
  return {
    playerId, vanguard, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], deck: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], giftZones: []
  };
}

function fixture({ side = "human", attackCount = 4, targetZone = "vanguard", attackWithSource = true, sourceZone = "rear-guard" } = {}) {
  const ids = { human: "host-player", bot: "guest-player" };
  const opponentSide = side === "human" ? "bot" : "human";
  const player = playerId => ({
    playerId,
    vanguard: card("cfa-14", `vanguard-${playerId}`, playerId, { zone: "vanguard", circle: "vanguard" }),
    rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], deck: [], bind: [], orders: [],
    guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  });
  const players = { human: player(ids.human), bot: player(ids.bot) };
  const source = card("cfa-10746", `screwbullet-${side}`, ids[side], { zone: sourceZone, circle: sourceZone === "vanguard" ? "vanguard" : "rear-left" });
  if (sourceZone === "vanguard") players[side].vanguard = source;
  else players[side].rear[0] = source;

  const attacker = attackWithSource ? source : card("cfa-3", `other-attacker-${side}`, ids[side], { zone: "rear-guard", circle: "rear-right" });
  if (!attackWithSource) players[side].rear[1] = attacker;
  const target = targetZone === "vanguard"
    ? players[opponentSide].vanguard
    : card("cfa-3", `rear-target-${side}`, ids[opponentSide], { zone: "rear-guard", circle: "rear-left" });
  if (targetZone !== "vanguard") players[opponentSide].rear[0] = target;

  const state = {
    matchId: `screwbullet-${side}-${attackCount}-${targetZone}`,
    stateVersion: 1,
    turn: 3,
    phase: 5,
    side,
    eventSequence: 0,
    processedEventIds: [],
    processedActionIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    pendingAbility: null,
    pendingTrigger: null,
    attacksByPlayerTurn: {},
    players,
    pendingAttack: {
      battleId: `battle-${side}-${attackCount}-${targetZone}`,
      attackerUid: attacker.uid,
      attackerSide: side,
      attackerPlayerId: ids[side],
      attackerZone: attacker.circle,
      defenderSide: opponentSide,
      targetUid: target.uid,
      targetZone,
      power: Number(attacker.power),
      targetPower: Number(target.power),
      critical: Number(attacker.critical),
      boostUid: null,
      driveChecksRemaining: 0,
      driveChecksPerformed: 0,
      maxDriveChecks: 0,
      driveCountChosen: true,
      guardCards: []
    }
  };
  const playerId = ids[side];
  for (let index = 0; index < Math.max(0, attackCount - 1); index++) {
    Engine.recordAttackCount(state, playerId, `prior-attack-${index}`);
  }
  Engine.recordAttackCount(state, playerId, attacker.uid);

  const ability = Engine.parseCardAbilitiesCached(catalog.find(item => String(item.id) === "cfa-10746"))
    .find(item => item.id === "cfa-10746:0");
  const event = Engine.createGameEvent(state, {
    eventId: `${state.matchId}:declared`,
    type: "unit.attacked",
    actingPlayerId: playerId,
    turnPlayerId: playerId,
    sourceCardInstanceId: attacker.uid,
    sourceOwnerPlayerId: attacker.ownerPlayerId,
    sourceControllerPlayerId: attacker.controllerPlayerId,
    cardInstanceId: attacker.uid,
    subjectCardInstanceId: attacker.uid,
    subjectOwnerPlayerId: attacker.ownerPlayerId,
    subjectControllerPlayerId: attacker.controllerPlayerId,
    attackingUnitInstanceId: attacker.uid,
    attackingCardInstanceIds: [attacker.uid],
    targetCardInstanceIds: [target.uid],
    targetLocation: targetZone,
    previousLocation: attacker.circle,
    currentLocation: attacker.circle,
    circle: attacker.circle,
    battleId: state.pendingAttack.battleId,
    phase: "battle",
    timingWindow: "attack-declared"
  });
  return { state, ability, source, attacker, target, side, playerId, event };
}

function discover(f) {
  return Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
}

function resolve(f, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth,
    actionId: `resolve-${f.state.matchId}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

test("Screwbullet Dragon is the exact official text and uses existing attack-count and battle-power handlers", () => {
  const definition = catalog.find(item => String(item.id) === "cfa-10746");
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === "cfa-10746:0");
  const proposed = contribution.find(item => item.id === ability.id);
  assert.equal(ability.printedText, PRINTED);
  assert.equal(proposed.printedText, PRINTED);
  assert.equal(proposed.source.cardNumber, "D-BT10/090EN");
  assert.equal(proposed.source.patternId, PATTERN);
  assert.deepEqual(proposed.requiredLocation, ["rear-guard"]);
  assert.deepEqual(proposed.trigger.circles, ["rear-guard"]);
  assert.equal(proposed.trigger.targetLocation, "vanguard");
  assert.deepEqual(proposed.conditions, [{ type: "total-attack-count-this-turn-at-least", count: 4 }]);
  assert.deepEqual(proposed.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]);
  assert.equal(ability.definition?.source.patternId, PATTERN);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("the fourth-or-later Vanguard attack prompts and resolves for either controller only on this source", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ side, attackCount: 4 });
    const result = discover(f);
    assert.equal(result.queued.length, 1, `${side}: ${JSON.stringify(result)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    assert.equal(resolve(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid).ok, false, "opponent cannot resolve it");
    assert.equal(f.state.pendingAttack.power, f.attacker.power);
    const applied = resolve(f);
    assert.equal(applied.ok, true, `${side}: ${JSON.stringify(applied)}`);
    assert.equal(f.state.pendingAttack.power, f.attacker.power + 5000);
    assert.equal(f.state.players[side].rear[0].uid, f.source.uid);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].rear[0], null);
  }
});

test("fewer than four battles, a Rear-Guard target, another unit attacking, or a Vanguard source do not trigger", () => {
  for (const change of [
    { attackCount: 3 },
    { targetZone: "rear-left" },
    { attackWithSource: false },
    { sourceZone: "vanguard" }
  ]) {
    const f = fixture(change);
    assert.equal(discover(f).queued.length, 0, JSON.stringify(change));
    assert.equal(f.state.pendingAttack.power, f.attacker.power);
  }
});

test("Volheimer's CONT power counts only its controller's Dragontree markers on Rear-Guard Circles", () => {
  const cardId = "cfa-10756";
  const definition = catalog.find(item => String(item.id) === cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:0`);
  const proposed = contribution.find(item => item.id === ability.id);
  assert.equal(ability.printedText, "CONT [RC]: During your turn, this unit gets power +2000 for each of your Dragontree markers on RC.");
  assert.equal(proposed.source.cardNumber, "D-BT10/073EN");
  assert.equal(proposed.source.patternId, "cont-rc-during-turn-power-per-dragontree-marker-v1");
  assert.deepEqual(proposed.requiredLocation, ["rear-guard"]);
  assert.deepEqual(proposed.effects, [{ op: "continuous-power-per-dragontree-marker", target: "source", amount: 2000, duration: "continuous", condition: { op: "controller-turn" } }]);
  assert.equal(ability.kind, "CONT");

  for (const side of ["human", "bot"]) {
    const ownId = side === "human" ? "host-player" : "guest-player";
    const opponentSide = side === "human" ? "bot" : "human";
    const opponentId = side === "human" ? "guest-player" : "host-player";
    const ownVanguard = card("cfa-14", `volheimer-vg-${side}`, ownId, { zone: "vanguard", circle: "vanguard" });
    const opponentVanguard = card("cfa-14", `volheimer-op-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
    const source = card(cardId, `volheimer-source-${side}`, ownId, { zone: "rear-guard", circle: "rear-left" });
    const own = { ...makePlayer(ownId, ownVanguard), rear: [source, null, null, null, null], giftZones: [
      { type: "Dragontree", zone: "rear-left" },
      { type: "Dragontree", zone: "accel-1" },
      { type: "Dragontree", zone: "vanguard" },
      { type: "Force", zone: "rear-right" }
    ] };
    const opponent = { ...makePlayer(opponentId, opponentVanguard), giftZones: [
      { type: "Dragontree", zone: "rear-left" },
      { type: "Dragontree", zone: "rear-right" },
      { type: "Dragontree", zone: "rear-back-left" }
    ] };
    const state = {
      matchId: `volheimer-${side}`,
      stateVersion: 0,
      turn: 2,
      side,
      phase: 5,
      firstTurnComplete: true,
      processedActionIds: [],
      pendingAttack: null,
      pendingAbility: null,
      pendingAbilities: [],
      pendingTrigger: null,
      players: { [side]: own, [opponentSide]: opponent }
    };
    const result = Reducer.applyGameAction(state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `attack-volheimer-${side}`,
      expectedStateVersion: 0,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opponentVanguard.uid }
    }, seats, Engine);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(state.pendingAttack.power, source.power + 4000, `${side}: only two own RC markers count; Vanguard and opponent markers are excluded`);
  }
});

test("the ride-phase search cards and intercept shield card already use trusted production handlers", () => {
  const existing = [
    ["cfa-10758", "cfa-10758:1", "auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1"],
    ["cfa-10760", "cfa-10760:1", "auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1"],
    ["cfa-1076", "cfa-1076:0", "auto-intercept-clan-vanguard-shield-battle-v1"]
  ];
  for (const [cardId, abilityId, pattern] of existing) {
    const definition = catalog.find(item => String(item.id) === cardId);
    const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === abilityId);
    assert.ok(ability, abilityId);
    assert.equal(ability.definition?.source.patternId, pattern, abilityId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
  }
});
