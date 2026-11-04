"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const byId = new Map(catalog.map(card => [String(card.id), card]));
const battleraizer = byId.get("cfa-104");
const battleraizerAbilities = Engine.parseCardAbilitiesCached(battleraizer);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), soul: [], deck: [], hand: [], damage: [], drop: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
}

function forerunnerFixture(side = "human", riderClan = "Nova Grappler", targetUid) {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const source = { uid: `source-${side}`, cardId: "cfa-104", type: battleraizer.type, grade: 0, clan: "Nova Grappler", clans: ["Nova Grappler"], ownerPlayerId: playerId, controllerPlayerId: playerId };
  const rider = { uid: `rider-${side}`, cardId: "test-rider", type: "Unit", grade: 1, clan: riderClan, clans: [riderClan], ownerPlayerId: playerId, controllerPlayerId: playerId };
  const own = player(playerId), opponent = player(side === "human" ? "guest-player" : "host-player");
  own.vanguard = rider;
  own.soul.push(source);
  const state = { matchId: `batch-0015-forerunner-${side}`, stateVersion: 2, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 2, players: { [side]: own, [opponentSide]: opponent } };
  const event = Engine.createGameEvent(state, {
    type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    sourceCardClan: riderClan, sourceCardClans: [riderClan], cardInstanceId: rider.uid,
    subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [targetUid || source.uid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow: "normal-ride"
  });
  return { state, own, source, side, playerId, event };
}

function boostFixture(side = "human") {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const own = player(playerId), opponent = player(opponentId);
  const source = { uid: `booster-${side}`, cardId: "cfa-104", zone: "rear-guard", circle: "rear-left", rested: true, faceUp: true, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const attacker = { uid: `attacker-${side}`, cardId: "cfa-1", zone: "rear-guard", circle: "rear-right", rested: true, power: 10000, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const target = { uid: `vg-${side}`, cardId: "cfa-14", zone: "vanguard", circle: "vanguard", power: 13000, ownerPlayerId: opponentId, controllerPlayerId: opponentId };
  own.rear[0] = source;
  own.rear[1] = attacker;
  opponent.vanguard = target;
  const battleId = `batch-0015-boost-${side}`;
  const state = { matchId: `batch-0015-boost-${side}`, stateVersion: 1, turn: 7, phase: 5, side, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, scheduledEffects: [], players: { [side]: own, [opponentSide]: opponent }, pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide: side, attackerPlayerId: playerId, attackerZone: "rear-right", targetUid: target.uid, targetZone: "vanguard", defenderSide: opponentSide, power: 10000, targetPower: 13000, critical: 1, boostUid: source.uid, boostPower: 5000 } };
  const ability = battleraizerAbilities.find(item => item.id === "cfa-104:1");
  const event = Engine.createGameEvent(state, { type: "unit.boosted", actingPlayerId: playerId, turnPlayerId: playerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId, boosterCardInstanceId: source.uid, boostedCardInstanceId: attacker.uid, previousLocation: "rear-left", currentLocation: "rear-left", circle: "rear-left", targetLocation: "vanguard", targetCardInstanceIds: [attacker.uid], battleId, phase: "battle", timingWindow: "boost-step", before: { rested: false }, after: { rested: true } });
  return { state, own, source, attacker, ability, event, side };
}

function resolveBoost(f, authUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `resolve-${f.side}`, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("whole-card source text for Battleraizer matches its two exact, trusted printed abilities", () => {
  assert.ok(battleraizer);
  assert.equal(battleraizerAbilities.length, 2, "all printed abilities on cfa-104 must be represented");
  assert.deepEqual(battleraizerAbilities.map(ability => ability.id), ["cfa-104:0", "cfa-104:1"]);
  for (const abilityId of ["cfa-104:0", "cfa-104:1"]) {
    const ability = battleraizerAbilities.find(item => item.id === abilityId);
    assert.ok(ability);
    assert.ok(battleraizer.text.includes(ability.printedText), `${abilityId} exact printed text must be preserved`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, abilityId);
  }
  assert.equal(battleraizerAbilities[0].definition.source.patternId, "auto-ridden-unit-clan-optional-source-call-v1");
  assert.equal(battleraizerAbilities[1].definition.source.patternId, "auto-boost-power-battle-then-return-self-end-phase-v1");
});

test("cfa-104:0 Forerunner resolves the exact ridden source for host and joining player only", () => {
  const ability = battleraizerAbilities.find(item => item.id === "cfa-104:0");
  for (const side of ["human", "bot"]) {
    const f = forerunnerFixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, side);
    const wrongSeat = Reducer.applyAbilityDecision(f.state, { actorAuthUid: side === "human" ? seats.guestAuthUid : seats.hostAuthUid, actionId: `wrong-seat-${side}`, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id, callZone: "rear-left" } } }, seats, Engine);
    assert.equal(wrongSeat.ok, false, side);
    const resolved = Reducer.applyAbilityDecision(f.state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `resolve-forerunner-${side}`, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id, callZone: "rear-left" } } }, seats, Engine);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(f.own.rear[0].uid, f.source.uid, side);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), false, side);
  }
  const wrongRider = forerunnerFixture("human", "Kagero");
  assert.equal(Reducer.discoverAutoTriggers(wrongRider.state, [wrongRider.event], Engine).queued.length, 0);
  const wrongTarget = forerunnerFixture("human", "Nova Grappler", "different-ridden-source");
  assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine).queued.length, 0);
  const declined = forerunnerFixture("human");
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 0, "duplicate ride event is ignored");
  const result = Reducer.applyAbilityDecision(declined.state, { actorAuthUid: seats.hostAuthUid, actionId: "decline-forerunner", expectedStateVersion: declined.state.stateVersion, payload: { accept: false, selection: { instanceUid: declined.source.uid, abilityId: ability.id } } }, seats, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(declined.own.soul[0].uid, declined.source.uid);
  assert.ok(declined.own.rear.every(card => card == null));
});

test("cfa-104:1 boost AUTO modifies only its own battle and returns the exact source at turn end", () => {
  for (const side of ["human", "bot"]) {
    const f = boostFixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, side);
    const wrongSeat = resolveBoost(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid);
    assert.equal(wrongSeat.ok, false, side);
    const resolved = resolveBoost(f);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(f.state.pendingAttack.power, 13000, side);
    assert.equal(f.state.scheduledEffects[0].sourceCardInstanceId, f.source.uid, side);

    f.state.pendingAttack = null;
    f.state.phase = 5;
    f.state.stateVersion++;
    const endPhase = Reducer.applyGameAction(f.state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `advance-end-${side}`, expectedStateVersion: f.state.stateVersion, payload: { action: "advance" } }, seats, Engine);
    assert.equal(endPhase.ok, true, endPhase.reason);
    assert.equal(f.own.rear.includes(f.source), false, side);
    assert.equal(f.own.deck.filter(card => card.uid === f.source.uid).length, 1, side);
  }
  const f = boostFixture("human");
  const unrelated = Engine.createGameEvent(f.state, { ...f.event, eventId: undefined, sourceCardInstanceId: "different-booster", boosterCardInstanceId: "different-booster", cardInstanceId: "different-booster" });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [unrelated], Engine).queued.length, 0);
});
