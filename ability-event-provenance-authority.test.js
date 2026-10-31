"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");

const CARD_ID = "cfa-1002";
const TEXT = "AUTO [VC/RC]: When this unit attacks a vanguard, if you have a «Nova Grappler» vanguard, this unit gets power +2000 until end of that battle.";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function card(uid, cardId, ownerPlayerId, extra = {}) {
  return { uid, cardId, ownerPlayerId, controllerPlayerId: ownerPlayerId, type: "Unit", unitCard: true, grade: 3, power: 10000, ...extra };
}

function fixture(attackerSide) {
  const attackerPlayerId = attackerSide === "human" ? "host-player" : "guest-player";
  const defenderSide = attackerSide === "human" ? "bot" : "human";
  const defenderPlayerId = defenderSide === "human" ? "host-player" : "guest-player";
  const n = ++sequence;
  const source = card(`attacker-${n}`, CARD_ID, attackerPlayerId, { cardName: "Nova Grappler Vanguard", clan: "Nova Grappler" });
  const target = card(`target-${n}`, "cfa-3", defenderPlayerId, { cardName: "Opponent Vanguard", clan: "Kagero" });
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[attackerSide].vanguard = source;
  players[defenderSide].vanguard = target;
  const battleId = `battle-${n}`;
  const state = {
    matchId: "event-provenance-regression", stateVersion: 1, eventSequence: 0, turn: 1, side: attackerSide, phase: 5,
    processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null,
    players,
    pendingAttack: {
      battleId, attackerUid: source.uid, attackerSide, attackerZone: "vanguard", attackerPlayerId,
      attackingCardInstanceIds: [source.uid], defenderSide, targetUid: target.uid, targetZone: "vanguard",
      guardCards: [], power: 10000, targetPower: 10000, critical: 1
    }
  };
  const ability = Engine.parseCardAbilities({ id: CARD_ID, text: TEXT }).find(item => item.id === `${CARD_ID}:0`);
  assert.ok(ability?.definition, "the exact supported attack AUTO is available");
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: attackerPlayerId, turnPlayerId: attackerPlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: attackerPlayerId, sourceControllerPlayerId: attackerPlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: attackerPlayerId, subjectControllerPlayerId: attackerPlayerId,
    attackingCardInstanceIds: [source.uid], targetCardInstanceIds: [target.uid], targetLocation: "vanguard",
    currentLocation: "vanguard", previousLocation: "vanguard", battleId,
    phase: "battle", timingWindow: "attack-declared"
  });
  return { state, source, target, ability, event, attackerSide, attackerPlayerId, defenderSide };
}

function discover(f, event = f.event) {
  return Reducer.discoverAutoTriggers(f.state, [event], Engine);
}

function resolve(f) {
  const auth = f.attackerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth, actionId: `resolve-${f.event.eventId}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

function cloneEvent(f, changes) {
  return Engine.createGameEvent(f.state, { ...f.event, ...changes, eventId: undefined });
}

test("a trusted attack event is discovered and resolved for either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const discovery = discover(f);
    assert.equal(discovery.queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, 12000, side);
  }
});

test("contradictory or unresolved source and subject provenance is rejected before queueing", () => {
  for (const changes of [
    { sourceOwnerPlayerId: "guest-player" },
    { sourceControllerPlayerId: "guest-player" },
    { subjectOwnerPlayerId: "guest-player" },
    { subjectControllerPlayerId: "guest-player" },
    { sourceCardInstanceId: "missing-source" },
    { subjectCardInstanceId: "missing-subject" },
    { sourceOwnerPlayerId: null },
    { attackingUnitInstanceId: "missing-attacker" },
    { targetCardInstanceIds: ["missing-target"] }
  ]) {
    const f = fixture("human");
    const discovery = discover(f, cloneEvent(f, changes));
    assert.equal(discovery.queued.length, 0, JSON.stringify(changes));
    assert.equal(f.state.pendingAbility, null, JSON.stringify(changes));
  }

  const ambiguous = fixture("human");
  ambiguous.state.players.bot.rear[0] = { ...ambiguous.source };
  assert.equal(discover(ambiguous).queued.length, 0, "duplicate instance IDs are ambiguous");
});

test("a stale, missing, or contradictory battle context cannot queue an AUTO", () => {
  for (const changes of [
    { battleId: "stale-battle" },
    { battleId: null },
    { targetLocation: "rear-left" },
    { currentLocation: "rear-left" },
    { previousLocation: "rear-left" },
    { actingPlayerId: "guest-player" },
    { turnPlayerId: "guest-player" }
  ]) {
    const f = fixture("human");
    const event = cloneEvent(f, changes);
    assert.equal(discover(f, event).queued.length, 0, JSON.stringify(changes));
    assert.equal(f.state.pendingAbility, null, JSON.stringify(changes));
  }
  const wrongAttacker = fixture("human");
  assert.equal(discover(wrongAttacker, cloneEvent(wrongAttacker, { attackingUnitInstanceId: wrongAttacker.target.uid })).queued.length, 0);
  const wrongTarget = fixture("human");
  assert.equal(discover(wrongTarget, cloneEvent(wrongTarget, { targetCardInstanceIds: [wrongTarget.source.uid] })).queued.length, 0);
});

test("resolution revalidates queued identity and battle provenance without mutating effects", () => {
  for (const side of ["human", "bot"]) {
    for (const [change, reason] of [
      [{ battleId: "stale-after-queue" }, /event-provenance-battle-id-mismatch/],
      [{ sourceControllerPlayerId: side === "human" ? "guest-player" : "host-player" }, /event-provenance-controller-mismatch/]
    ]) {
      const f = fixture(side);
      assert.equal(discover(f).queued.length, 1, side);
      f.state.pendingAbility.eventContext.gameEvent = cloneEvent(f, change);
      f.state.pendingAbility.eventContext.eventId = f.state.pendingAbility.eventContext.gameEvent.eventId;
      const before = JSON.stringify(f.state);
      const result = resolve(f);
      assert.equal(result.ok, false, `${side}: invalid queued provenance should be rejected`);
      assert.match(result.reason, reason);
      assert.equal(JSON.stringify(f.state), before, `${side}: rejection must not partially apply the effect`);
    }
  }
});

