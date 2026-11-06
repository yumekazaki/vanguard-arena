"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const definition = require("./ability-contributions/batch-STARHOLDER-DRAGON-ATTACK-HIT-CC2.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

Engine.registerAbilityDefinitions(definition);

const CARD_ID = "cfa-3370";
const ABILITY_ID = `${CARD_ID}:0`;
const card = loadCatalog().find(item => String(item.id) === CARD_ID);

function makeState(attackerSide, { generationBreak = true, attackWithOtherUnit = false, eventType = "attack.hit" } = {}) {
  const defenderSide = attackerSide === "human" ? "bot" : "human";
  const attackerPlayerId = attackerSide === "human" ? "host-player" : "joining-player";
  const defenderPlayerId = attackerSide === "human" ? "joining-player" : "host-player";
  const source = {
    uid: `${attackerSide}-starholder`, cardId: CARD_ID, ownerPlayerId: attackerPlayerId,
    controllerPlayerId: attackerPlayerId, unitCard: true, power: 9000
  };
  const otherAttacker = {
    uid: `${attackerSide}-other-attacker`, cardId: "test-other-unit", ownerPlayerId: attackerPlayerId,
    controllerPlayerId: attackerPlayerId, unitCard: true, power: 9000
  };
  const attacker = attackWithOtherUnit ? otherAttacker : source;
  const attackerZone = attackWithOtherUnit ? "rear-right" : "rear-left";
  const attackerVanguard = {
    uid: `${attackerSide}-vanguard`, cardId: "test-vanguard", ownerPlayerId: attackerPlayerId,
    controllerPlayerId: attackerPlayerId, unitCard: true
  };
  const defenderVanguard = {
    uid: `${defenderSide}-vanguard`, cardId: "test-vanguard", ownerPlayerId: defenderPlayerId,
    controllerPlayerId: defenderPlayerId, unitCard: true
  };
  const generationBreakUnit = {
    uid: `${attackerSide}-face-up-g-unit`, cardId: "test-g-unit", ownerPlayerId: attackerPlayerId,
    controllerPlayerId: attackerPlayerId, gDeckCard: true, faceUp: true
  };
  const makePlayer = (playerId, vanguard, rear = [], gZone = []) => ({
    playerId, vanguard, rear, gZone, hand: [], deck: [], soul: [], drop: [], bind: [], orders: [],
    guardCircle: [], triggerZone: [], damage: [0, 1, 2].map(index => ({
      uid: `${playerId}-damage-${index}`, cardId: "test-damage", ownerPlayerId: playerId,
      controllerPlayerId: playerId, faceDown: true
    }))
  });
  const players = {
    human: makePlayer("host-player", attackerSide === "human" ? attackerVanguard : defenderVanguard,
    attackerSide === "human" ? [source, attackWithOtherUnit ? otherAttacker : null, null, null, null] : [],
      attackerSide === "human" && generationBreak ? [generationBreakUnit] : []),
    bot: makePlayer("joining-player", attackerSide === "bot" ? attackerVanguard : defenderVanguard,
    attackerSide === "bot" ? [source, attackWithOtherUnit ? otherAttacker : null, null, null, null] : [],
      attackerSide === "bot" && generationBreak ? [generationBreakUnit] : [])
  };
  const target = defenderVanguard;
  const state = {
    matchId: "starholder-test", stateVersion: 0, turn: 3, side: attackerSide, players,
    pendingAttack: {
      battleId: `starholder-test:${attackerSide}:battle`, attackerSide, attackerUid: attacker.uid,
      attackerPlayerId, attackerZone, targetUid: target.uid, targetZone: "vanguard",
      defenderSide, defenderPlayerId, power: 15000, targetPower: 10000, blocked: false,
      critical: 1, boostUid: null
    }
  };
  const eventSubject = eventType === "attack.hit" ? target : attacker;
  const event = Engine.createGameEvent(state, {
    type: eventType,
    actingPlayerId: attackerPlayerId,
    turnPlayerId: attackerPlayerId,
    sourceCardInstanceId: attacker.uid,
    cardInstanceId: eventSubject.uid,
    subjectCardInstanceId: eventSubject.uid,
    previousLocation: eventType === "attack.hit" ? undefined : attackerZone,
    currentLocation: eventType === "attack.hit" ? undefined : attackerZone,
    circle: eventType === "attack.hit" ? undefined : attackerZone,
    targetCardInstanceIds: [target.uid],
    targetLocation: "vanguard",
    attackingUnitInstanceId: attacker.uid,
    battleId: state.pendingAttack.battleId,
    phase: "battle",
    timingWindow: eventType === "attack.hit" ? "attack-hit" : "attack-declared"
  });
  return { state, event, source, attackerPlayerId, defenderPlayerId };
}

test("Starholder Dragon definition preserves official text and uses the reviewed generic handlers", () => {
  assert.ok(card);
  assert.match(card.text, /AUTO \[RC\] Generation Break 1: When this unit’s attack hits a vanguard, Counter Charge 2\./);
  const ability = Engine.parseCardAbilities(card).find(item => item.id === ABILITY_ID);
  assert.ok(ability);
  assert.equal(ability.trigger.eventType, "attack.hit");
  assert.equal(ability.trigger.subject, "source");
  assert.equal(ability.trigger.targetLocation, "vanguard");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.conditions, [{ type: "generation-break", count: 1 }]);
  assert.deepEqual(ability.effects, [{ op: "counter-charge", count: 2 }]);
  assert.equal(ability.canDecline, false);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

for (const attackerSide of ["human", "bot"]) {
  test(`own Rear-Guard hit prompts and resolves Counter-Charge 2 for ${attackerSide === "human" ? "host" : "joining player"}`, () => {
    const { state, event, source, attackerPlayerId } = makeState(attackerSide);
    const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
    assert.equal(discovered.queued.length, 1);
    assert.equal(state.pendingAbility.side, attackerSide);
    assert.equal(state.pendingAbility.instance.uid, source.uid);
    assert.equal(state.pendingAbility.ability.id, ABILITY_ID);

    const damage = state.players[attackerSide].damage;
    const result = Reducer.applyAbilityDecision(state, {
      actorAuthUid: attackerSide === "human" ? "auth-host" : "auth-joining",
      actionId: `${attackerSide}-starholder-cc2`,
      expectedStateVersion: state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: {
        instanceUid: source.uid, abilityId: ABILITY_ID, damageUids: [damage[0].uid, damage[1].uid]
      } }
    }, { hostAuthUid: "auth-host", guestAuthUid: "auth-joining", hostSide: "human", guestSide: "bot" }, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(damage.map(card => card.faceDown), [false, false, true]);
    assert.equal(state.players[attackerSide === "human" ? "bot" : "human"].damage.every(card => card.faceDown), true);
    assert.equal(attackerPlayerId, state.players[attackerSide].playerId);
  });
}

test("Generation Break 1 gates the trigger and another unit's attack cannot satisfy this source", () => {
  const withoutGb = makeState("human", { generationBreak: false });
  assert.equal(Reducer.discoverAutoTriggers(withoutGb.state, [withoutGb.event], Engine).queued.length, 0);

  const wrongSource = makeState("bot", { attackWithOtherUnit: true });
  const rejected = Reducer.discoverAutoTriggers(wrongSource.state, [wrongSource.event], Engine);
  assert.equal(rejected.queued.length, 0);
  assert.equal(wrongSource.state.pendingAbilities.length, 0);
});

test("a non-hit attack event cannot trigger Starholder's attack-hit ability", () => {
  const notHit = makeState("human", { eventType: "unit.attacked" });
  assert.equal(Reducer.discoverAutoTriggers(notHit.state, [notHit.event], Engine).queued.length, 0);
});
