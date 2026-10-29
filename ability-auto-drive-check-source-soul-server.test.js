"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cards = new Map(catalog.map(card => [String(card.id), card]));

function instance(cardId, uid, playerId, extra = {}) {
  const definition = cards.get(String(cardId));
  return { uid, cardId, cardName: definition?.name || cardId, type: definition?.type || "Unit",
    grade: Number(definition?.grade || 0), clan: definition?.clan, clans: definition?.clans,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(cardId, side = "human") {
  const sourceAbilityId = cardId === "cfa-4080" ? "cfa-4080:2" : "cfa-7087:0";
  const ability = Engine.parseCardAbilities(cards.get(cardId)).find(item => item.id === sourceAbilityId);
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const source = instance(cardId, `source-${side}`, playerId, { zone: "rear-guard", circle: "rear-left" });
  const attacker = instance("cfa-9421", `vanguard-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
  const target = instance("cfa-3", `target-${side}`, playerId, { zone: "rear-guard", circle: "rear-right" });
  const checked = instance("normal-check", `checked-${side}`, playerId, { zone: "trigger", triggerType: null });
  const own = { playerId, vanguard: attacker, rear: [source, target, null, null, null], hand: [], soul: [],
    drop: [], deck: [instance("deck-card", `deck-${side}`, playerId)], damage: [], bind: [], orders: [],
    guardCircle: [], triggerZone: [checked], gDeck: [], gZone: [{ uid: `g-unit-${side}`, gDeckCard: true, faceUp: true }] };
  const enemy = { playerId: opponentId, vanguard: instance("cfa-3", `enemy-vanguard-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" }),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const battleId = `drive-${cardId}-${side}`;
  const state = { matchId: `drive-${cardId}`, stateVersion: 1, eventSequence: 0, processedEventIds: [], processedActionIds: [],
    processedAbilityTriggers: [], pendingAbilities: [], pendingCheckCard: { side, uid: checked.uid, destination: "hand", checkKind: "drive", battleId },
    turn: 3, side, phase: 5, players: { [side]: own, [opponentSide]: enemy },
    pendingAttack: { battleId, attackerSide: side, attackerPlayerId: playerId, attackerUid: attacker.uid, attackerZone: "vanguard",
      defenderSide: opponentSide, targetUid: enemy.vanguard.uid, targetZone: "vanguard", driveChecksRemaining: 0,
      maxDriveChecks: 1, driveChecksPerformed: 1, driveChecksComplete: true, awaitingDrive: false, power: 13000, targetPower: 10000, guardCards: [] } };
  const event = Engine.createGameEvent(state, { type: "drive.checked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: attacker.uid, sourceControllerPlayerId: playerId, checkedCardInstanceId: checked.uid,
    cardInstanceId: checked.uid, subjectCardInstanceId: checked.uid, subjectControllerPlayerId: playerId,
    checkedCardTriggerType: "", checkKind: "drive", checkIndex: 1, previousLocation: "deck", currentLocation: "trigger",
    battleId, phase: "battle", timingWindow: "drive-check" });
  return { ability, attacker, checked, enemy, event, own, playerId, side, source, state, target };
}

function resolve(f, extra = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `resolve-${f.ability.id}-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
      costSelections: { cb: [], sb: [], discard: [], reveal: [] }, ...extra } } }, seats, Engine);
}

test("Fetter Creator Van's optional GB1 drive-check ability is production-trusted and resolves source-to-Soul before drawing", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-4080", side);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), true);
    assert.equal(f.own.rear.some(card => card?.uid === f.source.uid), false);
    assert.equal(f.own.hand.some(card => card.uid === `deck-${side}`), true);
  }
});

test("Fetter Creator Van rejects a missing Generation Break, trigger check, and opponent drive check", () => {
  const noGb = fixture("cfa-4080"); noGb.own.gZone[0].faceUp = false;
  assert.equal(Reducer.discoverAutoTriggers(noGb.state, [noGb.event], Engine).queued.length, 0);
  const trigger = fixture("cfa-4080"); trigger.event = Engine.createGameEvent(trigger.state, { ...trigger.event, checkedCardTriggerType: "draw", eventId: "trigger-check" });
  assert.equal(Reducer.discoverAutoTriggers(trigger.state, [trigger.event], Engine).queued.length, 0);
  const otherPlayer = fixture("cfa-4080"); otherPlayer.event = Engine.createGameEvent(otherPlayer.state, { ...otherPlayer.event, actingPlayerId: "guest-player", turnPlayerId: "guest-player", eventId: "opponent-check" });
  assert.equal(Reducer.discoverAutoTriggers(otherPlayer.state, [otherPlayer.event], Engine).queued.length, 0);
});

test("Waveflow Dragon's mandatory drive-check ability retires its exact source before choosing a friendly Rear-Guard", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-7087", side);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(resolve(f, { targetUid: f.target.uid }).ok, true);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), true);
    assert.equal(f.target.turnPowerBoost, 5000);
    assert.equal(f.target.turnPowerExpiry, f.target.controllerPlayerId);
  }
});

test("Waveflow Dragon does not trigger from a different player's drive check or a Trigger Unit", () => {
  const trigger = fixture("cfa-7087"); trigger.event = Engine.createGameEvent(trigger.state, { ...trigger.event, checkedCardTriggerType: "critical", eventId: "trigger-check" });
  assert.equal(Reducer.discoverAutoTriggers(trigger.state, [trigger.event], Engine).queued.length, 0);
  const otherPlayer = fixture("cfa-7087"); otherPlayer.event = Engine.createGameEvent(otherPlayer.state, { ...otherPlayer.event, actingPlayerId: "guest-player", turnPlayerId: "guest-player", eventId: "opponent-check" });
  assert.equal(Reducer.discoverAutoTriggers(otherPlayer.state, [otherPlayer.event], Engine).queued.length, 0);
});
