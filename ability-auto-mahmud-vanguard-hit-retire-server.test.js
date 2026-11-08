"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-2497";
const ABILITY_ID = "cfa-2497:0";
const PATTERN = "auto-vanguard-own-attack-hit-opponent-rear-retire-v1";
const PRINTED_TEXT = "AUTO [VC]: When this unit’s attack hits a vanguard, choose one of your opponent’s rear-guards, and retire it.";
const CATALOG = loadCatalog();
const MAHMUD = CATALOG.find(card => String(card.id) === CARD_ID);
const GENERIC_UNIT = CATALOG.find(card => card.type === "Unit" && String(card.id) !== CARD_ID);
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let serial = 0;

assert.ok(MAHMUD, "Mahmud exists in the card catalog");
assert.ok(GENERIC_UNIT, "catalog contains a unit for target and opponent Vanguard fixtures");

function card(uid, cardId, playerId, overrides = {}) {
  const definition = CATALOG.find(item => String(item.id) === String(cardId));
  return {
    uid,
    cardId: String(cardId),
    cardName: definition?.name || "Test Unit",
    type: definition?.type || "Unit",
    unitCard: true,
    grade: Number(definition?.grade ?? 1),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...overrides
  };
}

function fixture(side = "human", { targetZone = "vanguard" } = {}) {
  const id = ++serial;
  const actorId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const opponentSide = side === "human" ? "bot" : "human";
  const source = card(`mahmud-${id}`, CARD_ID, actorId, { grade: 4, power: 15000 });
  const opponentVanguard = card(`opponent-vanguard-${id}`, GENERIC_UNIT.id, opponentId, { grade: 3, power: 13000 });
  const opponentRearOne = card(`opponent-rear-one-${id}`, GENERIC_UNIT.id, opponentId, { grade: 1, circle: "rear-left" });
  const opponentRearTwo = card(`opponent-rear-two-${id}`, GENERIC_UNIT.id, opponentId, { grade: 1, circle: "rear-right" });
  const ownRear = card(`own-rear-${id}`, GENERIC_UNIT.id, actorId, { grade: 1, circle: "rear-left" });
  const own = {
    playerId: actorId,
    vanguard: source,
    rear: [ownRear, null, null, null, null],
    hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [],
    guardCircle: [], gDeck: [], gZone: [], triggerZone: [], removed: [], accelZones: 0, giftZones: []
  };
  const opponent = {
    playerId: opponentId,
    vanguard: opponentVanguard,
    rear: [opponentRearOne, opponentRearTwo, null, null, null],
    hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [],
    guardCircle: [], gDeck: [], gZone: [], triggerZone: [], removed: [], accelZones: 0, giftZones: []
  };
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const battleId = `mahmud-battle-${id}`;
  const attackTarget = targetZone === "vanguard" ? opponentVanguard : opponentRearOne;
  const state = {
    matchId: `mahmud-hit-retire-${id}`,
    stateVersion: 1,
    eventSequence: 0,
    turn: 3,
    side,
    phase: 5,
    processedActionIds: [],
    processedEventIds: [],
    processedAbilityTriggers: [],
    pendingAbility: null,
    pendingAbilities: [],
    pendingTrigger: null,
    players,
    pendingAttack: {
      battleId,
      attackerSide: side,
      attackerPlayerId: actorId,
      attackerUid: source.uid,
      attackerZone: "vanguard",
      defenderSide: opponentSide,
      defenderPlayerId: opponentId,
      targetUid: attackTarget.uid,
      targetZone,
      power: 50000,
      targetPower: Number(attackTarget.power || 10000),
      critical: 1,
      blocked: false
    }
  };
  const event = Engine.createGameEvent(state, {
    type: "attack.hit",
    actingPlayerId: actorId,
    turnPlayerId: actorId,
    sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: actorId,
    sourceControllerPlayerId: actorId,
    cardInstanceId: attackTarget.uid,
    subjectCardInstanceId: attackTarget.uid,
    subjectOwnerPlayerId: opponentId,
    subjectControllerPlayerId: opponentId,
    attackingUnitInstanceId: source.uid,
    attackingCardInstanceIds: [source.uid],
    targetCardInstanceIds: [attackTarget.uid],
    targetLocation: targetZone,
    currentLocation: "vanguard",
    previousLocation: "vanguard",
    battleId,
    phase: "battle",
    timingWindow: "attack-hit"
  });
  const ability = Engine.parseCardAbilitiesCached(MAHMUD).find(item => item.id === ABILITY_ID);
  assert.ok(ability?.definition, `${ABILITY_ID} has a compiled exact definition`);
  return { state, event, ability, source, side, actorId, opponentId, opponentSide, opponentRearOne, opponentRearTwo, ownRear };
}

function discover(f) {
  return Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
}

function resolve(f, targetUid, { actorSide = f.side, actionId = `resolve-${f.state.matchId}` } = {}) {
  const actorAuthUid = actorSide === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "ability-response",
      accept: true,
      selection: {
        instanceUid: f.source.uid,
        abilityId: ABILITY_ID,
        targetUid,
        costSelections: { cb: [], sb: [], discard: [], reveal: [] }
      }
    }
  }, SEATS, Engine);
}

function zoneSnapshot(state) {
  return Object.fromEntries(Object.entries(state.players).map(([side, player]) => [side, {
    vanguard: player.vanguard?.uid || null,
    rear: (player.rear || []).map(card => card?.uid || null),
    drop: (player.drop || []).map(card => card.uid)
  }]));
}

test("Mahmud retains the exact mandatory Vanguard-hit retire definition and supported server effect", () => {
  const f = fixture();
  assert.equal(f.ability.printedText, PRINTED_TEXT);
  assert.equal(f.ability.definition.source.patternId, PATTERN);
  assert.equal(f.ability.definition.source.officialCardNumber, "G-BT01/030EN");
  assert.equal(f.ability.definition.source.officialTextVerified, true);
  assert.equal(f.ability.definition.source.officialPrintedText, "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.");
  assert.deepEqual(f.ability.requiredLocation, ["vanguard"]);
  assert.deepEqual(f.ability.trigger, {
    status: "recognized-trigger", eventType: "attack.hit", subject: "source", targetLocation: "vanguard", circles: []
  });
  assert.equal(f.ability.canDecline, false);
  assert.deepEqual(f.ability.definition.effects, [{
    op: "retire-target", target: "chosen", targetFilter: { controller: "opponent", zone: "rear-guard" }
  }]);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
});

test("the host and joining player each receive and resolve only their own Mahmud hit choice", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const result = discover(f);
    assert.equal(result.queued.length, 1, `${side}: ${JSON.stringify(result.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.actorId);

    const resolved = resolve(f, f.opponentRearOne.uid);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason}`);
    assert.equal(f.state.pendingAbility, null);
    assert.equal(f.state.players[f.side].vanguard.uid, f.source.uid, "Mahmud remains the attacking Vanguard");
    assert.equal(f.state.players[f.opponentSide].rear.some(unit => unit?.uid === f.opponentRearOne.uid), false);
    assert.equal(f.state.players[f.opponentSide].drop.some(unit => unit?.uid === f.opponentRearOne.uid), true);
    assert.equal(f.state.players[f.opponentSide].rear.some(unit => unit?.uid === f.opponentRearTwo.uid), true, "the unchosen opposing Rear-Guard remains");
    assert.equal(f.state.players[f.side].rear.some(unit => unit?.uid === f.ownRear.uid), true, "the controller's own Rear-Guard is not retired");

    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, "a replayed hit event cannot enqueue the ability twice");
    assert.equal(f.state.players[f.opponentSide].drop.filter(unit => unit.uid === f.opponentRearOne.uid).length, 1);
  }
});

test("another unit's attack, a Rear-Guard hit, and a stale battle event cannot trigger Mahmud", () => {
  const wrongSource = fixture();
  const otherAttacker = wrongSource.ownRear;
  wrongSource.state.pendingAttack = {
    ...wrongSource.state.pendingAttack,
    attackerUid: otherAttacker.uid,
    attackerZone: "rear-left"
  };
  const otherAttackEvent = Engine.createGameEvent(wrongSource.state, {
    ...wrongSource.event,
    eventId: `other-attacker-${wrongSource.state.matchId}`,
    sourceCardInstanceId: otherAttacker.uid,
    sourceOwnerPlayerId: wrongSource.actorId,
    sourceControllerPlayerId: wrongSource.actorId,
    attackingUnitInstanceId: otherAttacker.uid,
    attackingCardInstanceIds: [otherAttacker.uid],
    currentLocation: "rear-left",
    previousLocation: "rear-left",
    battleId: wrongSource.state.pendingAttack.battleId
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [otherAttackEvent], Engine).queued.length, 0);

  const rearGuardHit = fixture("human", { targetZone: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(rearGuardHit.state, [rearGuardHit.event], Engine).queued.length, 0,
    "the trigger requires a hit on the opposing Vanguard");

  const staleBattle = fixture();
  const staleEvent = { ...staleBattle.event, battleId: `stale-${staleBattle.event.battleId}` };
  assert.equal(Reducer.discoverAutoTriggers(staleBattle.state, [staleEvent], Engine).queued.length, 0,
    "the event must belong to the authoritative pending battle");

  for (const f of [wrongSource, rearGuardHit, staleBattle]) {
    assert.equal(f.state.pendingAbility, null);
    assert.equal(f.state.players[f.opponentSide].rear.some(unit => unit?.uid === f.opponentRearOne.uid), true);
    assert.equal(f.state.players[f.opponentSide].drop.length, 0);
  }
});

test("invalid target choices are rejected atomically without retiring any unit", () => {
  for (const side of ["human", "bot"]) {
    for (const target of ["ownRear", "opponentVanguard", "attackingSource"]) {
      const f = fixture(side);
      assert.equal(discover(f).queued.length, 1);
      const invalidUid = target === "ownRear" ? f.ownRear.uid
        : target === "opponentVanguard" ? f.state.players[f.opponentSide].vanguard.uid
          : f.source.uid;
      const before = zoneSnapshot(f.state);
      const version = f.state.stateVersion;
      const result = resolve(f, invalidUid, { actionId: `invalid-${target}-${side}-${f.state.matchId}` });
      assert.equal(result.ok, false, `${side}/${target} should be rejected`);
      assert.equal(f.state.stateVersion, version);
      assert.deepEqual(zoneSnapshot(f.state), before);
      assert.equal(f.state.pendingAbility.side, side, "the valid prompt remains available to its controller");
    }
  }
});
