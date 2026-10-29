"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const CARD_IDS = ["cfa-2526", "cfa-2538", "cfa-2678", "cfa-2691", "cfa-3033"];
const definition = id => catalog.find(card => String(card.id) === String(id));

test("all five exact attacked-source power abilities are supported with their printed circle, amount, and battle duration", () => {
  for (const id of CARD_IDS) {
    const card = definition(id);
    assert.ok(card);
    const ability = Engine.parseCardAbilities(card)[0];
    assert.equal(ability.definition?.source?.patternId, "auto-attacked-source-battle-power-v1");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-defending-source-power", target: "source", amount: 5000, duration: "battle" }]);
  }
});

test("defending host and joining player each receive and resolve only their own attacked unit's AUTO", () => {
  for (const targetSide of ["human", "bot"]) {
    const attackerSide = targetSide === "human" ? "bot" : "human";
    const targetPlayerId = targetSide === "human" ? "host-player" : "guest-player";
    const attackerPlayerId = attackerSide === "human" ? "host-player" : "guest-player";
    const targetDefinition = definition("cfa-2526");
    const reviewedAbility = Engine.parseCardAbilities(targetDefinition)[0];
    Engine.registerAbilityDefinitions([reviewedAbility.definition]);
    const source = { uid: `defender-${targetSide}`, cardId: String(targetDefinition.id), cardName: targetDefinition.name, type: "Unit", grade: Number(targetDefinition.grade), ownerPlayerId: targetPlayerId, controllerPlayerId: targetPlayerId, zone: "rear-guard", circle: "rear-left" };
    const attacker = { uid: `attacker-${targetSide}`, cardId: "cfa-31", ownerPlayerId: attackerPlayerId, controllerPlayerId: attackerPlayerId, zone: "vanguard", circle: "vanguard" };
    const player = playerId => ({ playerId, vanguard: null, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
    const state = { matchId: "attacked-self-power", stateVersion: 1, side: attackerSide, phase: "battle", turn: 3, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], players: { human: player("host-player"), bot: player("guest-player") }, pendingAttack: { battleId: `battle-${targetSide}`, attackerUid: attacker.uid, attackerSide, attackerPlayerId, attackerZone: "vanguard", targetUid: source.uid, targetZone: "rear-left", defenderSide: targetSide, targetPower: 8000, power: 12000, guardCards: [] } };
    state.players[targetSide].rear.push(source);
    state.players[attackerSide].vanguard = attacker;
    const event = Engine.createGameEvent(state, { type: "attack.declared", actingPlayerId: attackerPlayerId, turnPlayerId: attackerPlayerId, sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attackerPlayerId, sourceControllerPlayerId: attackerPlayerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: targetPlayerId, subjectControllerPlayerId: targetPlayerId, currentLocation: "rear-left", targetCardInstanceIds: [source.uid], targetLocation: "rear-left", attackingUnitInstanceId: attacker.uid, attackingCardInstanceIds: [attacker.uid], battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "attack-declared" });
    const unrelatedEvent = Engine.createGameEvent(state, { type: "attack.declared", actingPlayerId: attackerPlayerId, turnPlayerId: attackerPlayerId, sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attackerPlayerId, sourceControllerPlayerId: attackerPlayerId, cardInstanceId: "different-target", subjectCardInstanceId: "different-target", currentLocation: "rear-left", targetCardInstanceIds: ["different-target"], targetLocation: "rear-left", attackingUnitInstanceId: attacker.uid, battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "attack-declared" });
    assert.equal(Reducer.discoverAutoTriggers(state, [unrelatedEvent], Engine).queued.length, 0);
    const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
    assert.equal(discovered.queued.length, 1);
    assert.equal(state.pendingAbility.side, targetSide);
    assert.equal(state.pendingAbility.instance.uid, source.uid);
    const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
    const beforeWrongPlayer = JSON.stringify(state);
    assert.equal(Reducer.applyAbilityDecision(state, { actorAuthUid: targetSide === "human" ? "auth-guest" : "auth-host", actionId: `forged-before-${targetSide}`, expectedStateVersion: state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: state.pendingAbility.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine).ok, false);
    assert.equal(JSON.stringify(state), beforeWrongPlayer);
    const result = Reducer.applyAbilityDecision(state, { actorAuthUid: targetSide === "human" ? "auth-host" : "auth-guest", actionId: `resolve-${targetSide}`, expectedStateVersion: state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: state.pendingAbility.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(state.pendingAttack.targetPower, 13000);
    assert.equal(Reducer.applyAbilityDecision(state, { actorAuthUid: targetSide === "human" ? "auth-guest" : "auth-host", actionId: `forged-${targetSide}`, expectedStateVersion: state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: state.pendingAbility?.ability?.id || "fake", costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine).ok, false);
  }
});

