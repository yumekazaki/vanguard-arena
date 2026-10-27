"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function makeState({ legion = false } = {}) {
  const boosterDefinition = catalog.find(card => card.id === "cfa-1942");
  assert.ok(boosterDefinition);
  const booster = { uid: "guest-booster", cardId: boosterDefinition.id, cardName: boosterDefinition.name, grade: boosterDefinition.grade, unitCard: true, power: 7000, ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" };
  const guestVanguard = { uid: "guest-vanguard", cardId: "guest-vanguard-def", cardName: "Legion Vanguard", grade: 3, unitCard: true, ownerPlayerId: "player-guest", controllerPlayerId: "player-guest", ...(legion ? { legionMateInstanceId: "guest-legion-mate" } : {}) };
  const hostVanguard = { uid: "host-vanguard", cardId: "host-vanguard-def", grade: 3, unitCard: true, ownerPlayerId: "player-host", controllerPlayerId: "player-host" };
  const guest = { playerId: "player-guest", vanguard: guestVanguard, rear: [booster, null, null, null, null], hand: [], deck: [], drop: [], soul: [], bind: [], damage: [], guardCircle: [], orders: [] };
  const host = { playerId: "player-host", vanguard: hostVanguard, rear: [null, null, null, null, null], hand: [], deck: [], drop: [], soul: [], bind: [], damage: [], guardCircle: [], orders: [] };
  const state = { matchId: "legion-boost-room", stateVersion: 4, processedActionIds: [], eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], turn: 2, side: "bot", phase: 5, players: { human: host, bot: guest } };
  const event = Engine.createGameEvent(state, {
    type: "unit.boosted", actingPlayerId: "player-guest", turnPlayerId: "player-guest",
    sourceCardInstanceId: booster.uid, sourceOwnerPlayerId: booster.ownerPlayerId, sourceControllerPlayerId: booster.controllerPlayerId,
    subjectCardInstanceId: booster.uid, subjectControllerPlayerId: booster.controllerPlayerId,
    boosterCardInstanceId: booster.uid, boostedCardInstanceId: guestVanguard.uid,
    targetCardInstanceIds: [guestVanguard.uid], targetLocation: "vanguard", currentLocation: "rear-left",
    phase: "battle", timingWindow: "boost-step", battleId: "legion-boost-room:attack-1"
  });
  return { state, event, booster, guestVanguard };
}

test("14 real Legion-Vanguard boost abilities compile with exact source and Vanguard target requirements", () => {
  const found = catalog.flatMap(card => Engine.parseCardAbilities(card).filter(ability => ability.definition?.source?.patternId === "auto-rc-boost-vanguard-legion-power-battle-v1"));
  assert.equal(found.length, 14);
  for (const ability of found) {
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-is-legion" }]);
    assert.equal(ability.conditionStatus, "modeled");
    assert.equal(ability.trigger.eventType, "unit.boosted");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetLocation, "vanguard");
  }
  const instance = Engine.createCardInstance("legion-vanguard", "player-guest", "legion-vanguard-1", { legionMateInstanceId: "legion-mate-1" });
  assert.equal(instance.legionMateInstanceId, "legion-mate-1");
  assert.throws(() => Engine.createCardInstance("legion-vanguard", "player-guest", "legion-vanguard-1", { legionMateInstanceId: "legion-vanguard-1" }), /distinct, stable mate instance ID/);
});

test("boost trigger rejects another booster, non-Vanguard targets, and a Vanguard without a Legion mate", () => {
  const ability = Engine.parseCardAbilities(catalog.find(card => card.id === "cfa-1942")).find(item => item.kind === "AUTO");
  const { state, event, booster, guestVanguard } = makeState();
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "boost", event, booster.uid, "rear-left", "rear-left", "player-guest"), true);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "boost", event, "different-booster", "rear-left", "rear-left", "player-guest"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "boost", { ...event, targetLocation: "rear-guard" }, booster.uid, "rear-left", "rear-left", "player-guest"), false);
  assert.equal(Engine.evaluateAbilityConditions(ability, { controllerVanguardIsLegion: false }), false);
  assert.equal(Engine.evaluateAbilityConditions(ability, { controllerVanguardIsLegion: true }), true);
  assert.equal(guestVanguard.legionMateInstanceId, undefined);
});

test("joining player receives the Legion boost prompt only when their Vanguard has a Legion mate link", () => {
  const withoutLegion = makeState();
  const rejected = Reducer.discoverAutoTriggers(withoutLegion.state, [withoutLegion.event], Engine);
  assert.equal(rejected.queued.length, 0);
  assert.equal(withoutLegion.state.pendingAbility ?? null, null);

  const withLegion = makeState({ legion: true });
  const accepted = Reducer.discoverAutoTriggers(withLegion.state, [withLegion.event], Engine);
  assert.equal(accepted.queued.length, 1);
  assert.equal(withLegion.state.pendingAbility.side, "bot");
  assert.equal(withLegion.state.pendingAbility.triggerControllerPlayerId, "player-guest");
  assert.equal(withLegion.state.pendingAbility.instance.uid, withLegion.booster.uid);
});

test("trusted attack action carries the Vanguard target and lets the guest resolve their own trigger", () => {
  const { state, booster, guestVanguard } = makeState({ legion: true });
  state.players.bot.rear = [null, null, null, booster, null];
  booster.boostAbility = true;
  guestVanguard.power = 13000;
  guestVanguard.critical = 1;
  const hostVanguard = state.players.human.vanguard;
  hostVanguard.power = 13000;
  state.pendingAbility = null;
  state.pendingAbilities = [];
  state.pendingTrigger = null;
  state.pendingAttack = null;
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const attack = Reducer.applyGameAction(state, {
    actorAuthUid: "auth-guest", actionId: "guest-vanguard-boosts", expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: guestVanguard.uid, targetCardInstanceId: hostVanguard.uid, boosterCardInstanceId: booster.uid }
  }, seats, Engine);
  assert.equal(attack.ok, true);
  const event = attack.events.find(item => item.type === "unit.boosted");
  assert.equal(event.targetLocation, "vanguard");
  assert.equal(state.pendingAbility.side, "bot");
  const result = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "guest-accepts-legion-boost", expectedStateVersion: state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: booster.uid, abilityId: state.pendingAbility.ability.id } }
  }, seats, Engine);
  assert.equal(result.ok, true);
  assert.equal(state.pendingAttack.power, 24000);
  assert.equal(state.pendingAbility ?? null, null);
});
