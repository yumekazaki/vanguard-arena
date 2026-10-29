"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const definition = catalog.find(card => card.id === "cfa-7474");
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(cardId, uid, playerId, extra = {}) {
  const row = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId, cardName: row?.name || cardId, type: row?.type || "Unit", grade: Number(row?.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(side = "human") {
  const ability = Engine.parseCardAbilities(definition).find(item => item.id === "cfa-7474:1");
  const playerId = side === "human" ? "host-player" : "guest-player", opponentId = side === "human" ? "guest-player" : "host-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const vanguard = card("cfa-7474", `cycloned-${side}`, playerId, { zone: "vanguard", circle: "vanguard", hasAbilities: true });
  const target = card("cfa-3", `rear-${side}`, playerId, { zone: "rear-guard", circle: "rear-left", rested: true });
  const checked = card("cfa-1", `checked-${side}`, playerId, { zone: "trigger", hasAbilities: false, triggerType: null });
  const enemyVanguard = card("cfa-3", `enemy-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const own = { playerId, vanguard, rear: [target, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [checked], gDeck: [], gZone: [] };
  const enemy = { playerId: opponentId, vanguard: enemyVanguard, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const battleId = `cycloned-${side}`;
  const state = { matchId: "cycloned-drive-stand", stateVersion: 1, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [],
    turn: 2, side, phase: 5, players: { [side]: own, [opponentSide]: enemy }, pendingCheckCard: { side, uid: checked.uid, destination: "hand", checkKind: "drive", battleId },
    pendingAttack: { battleId, attackerSide: side, attackerPlayerId: playerId, attackerUid: vanguard.uid, attackerZone: "vanguard", defenderSide: opponentSide, targetUid: enemyVanguard.uid, targetZone: "vanguard", driveChecksRemaining: 0, maxDriveChecks: 1, driveChecksPerformed: 1, driveChecksComplete: true, awaitingDrive: false, power: 15000, targetPower: 10000, guardCards: [] } };
  const event = Engine.createGameEvent(state, { type: "drive.checked", actingPlayerId: playerId, turnPlayerId: playerId, sourceCardInstanceId: vanguard.uid, sourceControllerPlayerId: playerId,
    cardInstanceId: checked.uid, subjectCardInstanceId: checked.uid, subjectControllerPlayerId: playerId, checkedCardInstanceId: checked.uid, checkedCardControllerPlayerId: playerId, checkedCardText: catalog.find(item => item.id === "cfa-1").text, checkedCardTriggerType: "",
    checkKind: "drive", checkIndex: 1, previousLocation: "deck", currentLocation: "trigger", battleId, phase: "battle", timingWindow: "drive-check" });
  return { ability, checked, enemyVanguard, event, own, playerId, side, state, target, vanguard };
}

function resolve(f, targetUid = f.target.uid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `stand-${f.side}`,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: f.vanguard.uid, abilityId: f.ability.id, targetUid } } }, seats, Engine);
}

test("Cycloned's abilityless drive-check stand AUTO is production-trusted and resolved by the Vanguard controller", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, JSON.stringify({ discovered, event: f.event, source: f.vanguard, checked: f.checked, ability: f.ability }));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.target.rested, false);
  }
});

test("Cycloned rejects a skilled Normal Unit, Trigger Unit, another Vanguard's battle, and a foreign drive check", () => {
  const skilled = fixture(); skilled.own.triggerZone[0].cardId = "cfa-2";
  skilled.event = Engine.createGameEvent(skilled.state, { ...skilled.event, checkedCardText: "How much longer are you sleeping? Wake up!", eventId: "skilled-check" });
  assert.equal(Reducer.discoverAutoTriggers(skilled.state, [skilled.event], Engine).queued.length, 0);
  const trigger = fixture(); trigger.event = Engine.createGameEvent(trigger.state, { ...trigger.event, checkedCardTriggerType: "draw", eventId: "trigger-check" });
  assert.equal(Reducer.discoverAutoTriggers(trigger.state, [trigger.event], Engine).queued.length, 0);
  const wrongBattle = fixture(); wrongBattle.event = Engine.createGameEvent(wrongBattle.state, { ...wrongBattle.event, sourceCardInstanceId: "another-vanguard", eventId: "wrong-battle" });
  assert.equal(Reducer.discoverAutoTriggers(wrongBattle.state, [wrongBattle.event], Engine).queued.length, 0);
  const foreign = fixture(); foreign.event = Engine.createGameEvent(foreign.state, { ...foreign.event, actingPlayerId: "guest-player", turnPlayerId: "guest-player", sourceControllerPlayerId: "guest-player", checkedCardControllerPlayerId: "guest-player", subjectControllerPlayerId: "guest-player", eventId: "foreign-check" });
  assert.equal(Reducer.discoverAutoTriggers(foreign.state, [foreign.event], Engine).queued.length, 0);
});
