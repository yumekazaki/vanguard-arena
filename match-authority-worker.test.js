"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");

const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

test("server discovers a reviewed AUTO only for the exact source card event and queues it once", () => {
  const source = { uid: "attack-source-copy", cardId: "cfa-103", ownerPlayerId: "player-host", controllerPlayerId: "player-host" };
  const state = {
    matchId: "event-discovery-room", stateVersion: 4, eventSequence: 0, turn: 2, side: "human", phase: 5,
    processedAbilityTriggers: [], players: {
      human: { playerId: "player-host", vanguard: source, rear: [], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [] },
      bot: { playerId: "player-guest", vanguard: null, rear: [], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [] }
    }
  };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: "player-host", turnPlayerId: "player-host",
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: source.ownerPlayerId,
    sourceControllerPlayerId: source.controllerPlayerId, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: source.ownerPlayerId, subjectControllerPlayerId: source.controllerPlayerId,
    currentLocation: "vanguard", battleId: "battle-1", timingWindow: "attack-declared"
  });
  const first = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(first.queued.length, 1);
  assert.equal(state.pendingAbility.instance.uid, source.uid);
  assert.equal(state.pendingAbility.ability.id, "cfa-103:0");
  assert.equal(state.pendingAbility.eventContext.eventId, event.eventId);
  const duplicate = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(duplicate.queued.length, 0);
  assert.equal(state.pendingAbilities.length, 0);

  const unrelated = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: "player-host", turnPlayerId: "player-host",
    sourceCardInstanceId: "another-copy", subjectCardInstanceId: "another-copy", currentLocation: "vanguard"
  });
  assert.equal(Reducer.discoverAutoTriggers(state, [unrelated], Engine).queued.length, 0);
  assert.equal(state.pendingAbility.instance.uid, source.uid);

  const controlledAcrossSides = { uid: "controlled-from-opponent-zone", cardId: "cfa-103", ownerPlayerId: "player-guest", controllerPlayerId: "player-host" };
  const crossState = {
    matchId: "control-room", eventSequence: 0, turn: 3, side: "human", phase: 5,
    players: {
      human: { playerId: "player-host", vanguard: null, rear: [], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [] },
      bot: { playerId: "player-guest", vanguard: null, rear: [controlledAcrossSides], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [] }
    }
  };
  const controlledAttack = Engine.createGameEvent(crossState, {
    type: "unit.attacked", actingPlayerId: "player-host", turnPlayerId: "player-host",
    sourceCardInstanceId: controlledAcrossSides.uid, sourceOwnerPlayerId: "player-guest",
    sourceControllerPlayerId: "player-host", subjectCardInstanceId: controlledAcrossSides.uid,
    subjectOwnerPlayerId: "player-guest", subjectControllerPlayerId: "player-host",
    currentLocation: "rear-left", battleId: "battle-controlled"
  });
  assert.equal(Reducer.discoverAutoTriggers(crossState, [controlledAttack], Engine).queued.length, 1);
  assert.equal(crossState.pendingAbility.side, "human");
  assert.equal(crossState.pendingAbility.triggerControllerPlayerId, "player-host");
});

test("server evaluates a modeled AUTO condition against authoritative player state", () => {
  const cardId = "server-condition-auto-fixture", abilityId = `${cardId}:0`;
  Engine.registerAbilityDefinitions([{
    id: abilityId, cardId, kind: "AUTO",
    printedText: "AUTO [RC]: When this unit is placed on RC, if your opponent has no rear-guards, draw a card.",
    source: { dataset: "regression-fixture", review: "modeled no-opponent-rear-guards condition" },
    effects: [{ op: "draw", count: 1 }]
  }]);
  const source = { uid: "conditional-source", cardId, ownerPlayerId: "player-host", controllerPlayerId: "player-host" };
  const state = {
    matchId: "condition-room", eventSequence: 0, stateVersion: 0, turn: 1, side: "human", phase: 4,
    players: {
      human: { playerId: "player-host", vanguard: null, rear: [source], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [] },
      bot: { playerId: "player-guest", vanguard: null, rear: [], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [] }
    }
  };
  const makePlacedEvent = () => Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: "player-host", turnPlayerId: "player-host",
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: source.ownerPlayerId,
    sourceControllerPlayerId: source.controllerPlayerId, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: source.ownerPlayerId, subjectControllerPlayerId: source.controllerPlayerId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left", timingWindow: "call-resolution"
  });

  const eligible = Reducer.discoverAutoTriggers(state, [makePlacedEvent()], Engine);
  assert.equal(eligible.queued.length, 1);
  assert.equal(state.pendingAbility.ability.id, abilityId);

  state.pendingAbility = null;
  state.pendingAbilities = [];
  state.processedAbilityTriggers = [];
  state.players.bot.rear.push({ uid: "opponent-rear", cardId: "other", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" });
  const ineligible = Reducer.discoverAutoTriggers(state, [makePlacedEvent()], Engine);
  assert.equal(ineligible.queued.length, 0);
  assert.equal(state.pendingAbility, null);
});

test("authoritative attack calculation includes Great Daiyusha's live Limit Break critical",()=>{
  const makeState=(damageCount,soulCount)=>{
    const attacker={uid:"daiyusha-vg",cardId:"cfa-264",cardName:"Ultimate Dimensional Robo, Great Daiyusha",unitCard:true,grade:3,power:11000,critical:1,ownerPlayerId:"player-host",controllerPlayerId:"player-host"};
    const state={matchId:"daiyusha-attack",stateVersion:0,processedActionIds:[],turn:3,side:"human",phase:5,firstTurnComplete:true,players:{
      human:{playerId:"player-host",vanguard:attacker,rear:[],guardCircle:[],orders:[],drop:[],hand:[],soul:Array.from({length:soulCount},(_,i)=>({uid:`soul-${i}`,cardId:`soul-${i}`,cardName:`Dimensional Robo, unit ${i}`,ownerPlayerId:"player-host",controllerPlayerId:"player-host"})),bind:[],damage:Array.from({length:damageCount},(_,i)=>({uid:`damage-${i}`})),deck:[]},
      bot:{playerId:"player-guest",vanguard:{uid:"opponent-vg",cardId:"enemy-vg",unitCard:true,power:10000,critical:1,ownerPlayerId:"player-guest",controllerPlayerId:"player-guest"},rear:[],guardCircle:[],orders:[],drop:[],hand:[],soul:[],bind:[],damage:[],deck:[]}
    }};
    const result=Reducer.applyGameAction(state,{actorAuthUid:"auth-host",actionId:"declare-daiyusha",expectedStateVersion:0,payload:{action:"attack",attackerCardInstanceId:attacker.uid,targetCardInstanceId:"opponent-vg"}},seats,Engine);
    assert.equal(result.ok,true);
    return state.pendingAttack;
  };
  assert.equal(makeState(4,3).critical,2);
  assert.equal(makeState(3,3).critical,1);
});

test("authoritative attacks apply Perfect Raizer's Soul threshold critical only when four matching cards are present",()=>{
  const declare=(count,otherRaizer=false)=>{
    const source={uid:"perfect-raizer-vg",cardId:"cfa-165",cardName:"Perfect Raizer",unitCard:true,grade:3,power:11000,critical:1,ownerPlayerId:"player-host",controllerPlayerId:"player-host"};
    const state={matchId:"raizer-attack",stateVersion:0,processedActionIds:[],turn:4,side:"human",phase:5,firstTurnComplete:true,players:{
      human:{playerId:"player-host",vanguard:source,rear:otherRaizer?[{uid:"raizer-rear",cardId:"raizer-rear",cardName:"Raizer Unit",unitCard:true,grade:1,power:8000,ownerPlayerId:"player-host",controllerPlayerId:"player-host"}]:[],guardCircle:[],orders:[],drop:[],hand:[],soul:Array.from({length:count},(_,i)=>({uid:`raizer-soul-${i}`,cardId:`raizer-soul-${i}`,cardName:i===0?"Perfect Raizer":`Raizer Unit ${i}`,ownerPlayerId:"player-host",controllerPlayerId:"player-host"})),bind:[],damage:[],deck:[]},
      bot:{playerId:"player-guest",vanguard:{uid:"opponent-vg-raizer",cardId:"enemy-vg",unitCard:true,power:10000,critical:1,ownerPlayerId:"player-guest",controllerPlayerId:"player-guest"},rear:[],guardCircle:[],orders:[],drop:[],hand:[],soul:[],bind:[],damage:[],deck:[]}
    }};
    const result=Reducer.applyGameAction(state,{actorAuthUid:"auth-host",actionId:`raizer-attack-${count}`,expectedStateVersion:0,payload:{action:"attack",attackerCardInstanceId:source.uid,targetCardInstanceId:"opponent-vg-raizer"}},seats,Engine);
    assert.equal(result.ok,true);return state.pendingAttack;
  };
  const qualified=declare(4),underThreshold=declare(3),qualifiedWithOtherRaizer=declare(4,true);assert.equal(qualified.critical,2);assert.equal(qualified.power,21000);assert.equal(underThreshold.critical,1);assert.equal(underThreshold.power,18000);assert.equal(qualifiedWithOtherRaizer.critical,2);assert.equal(qualifiedWithOtherRaizer.power,23000);
});

function fixture() {
  const ability = Engine.parseCardAbilities({ id: "engorge-real-text", text: "AUTO [VC/RC]: Engorge." })[0];
  const source = { uid: "attacker-copy-1", cardId: "engorge-real-text", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" };
  const rearOne = { uid: "rear-copy-1", cardId: "rear-unit", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" };
  const rearTwo = { uid: "rear-copy-2", cardId: "rear-unit", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" };
  const state = {
    matchId: "match-1", stateVersion: 8, processedActionIds: [],
    players: {
      human: { playerId: "player-host", vanguard: null, rear: [], drop: [], hand: [], damage: [], soul: [], deck: [], bind: [] },
      bot: { playerId: "player-guest", vanguard: null, rear: [source, rearOne, rearTwo], drop: [], hand: [], damage: [], soul: [], deck: [], bind: [] }
    },
    pendingAttack: { attackerUid: source.uid, attackerSide: "bot", battleId: "battle-42" },
    pendingAbility: {
      side: "bot", instance: source, field: "rear-guard", ability,
      triggerControllerPlayerId: "player-guest",
      eventContext: { event: "attack", eventId: "event-42", battleId: "battle-42", gameEvent: { eventId: "event-42", type: "unit.attacked", sourceCardInstanceId: source.uid, subjectCardInstanceId: source.uid, sourceControllerPlayerId: "player-guest" } }
    }
  };
  return { state, source, rearOne, rearTwo };
}
function command(actorAuthUid, selection, extra = {}) {
  return {
    actorAuthUid, actionId: "decision-1", expectedStateVersion: 8,
    payload: { accept: true, selection: { instanceUid: "attacker-copy-1", abilityId: "engorge-real-text:0", engorgeTargetUids: ["rear-copy-1"], ...selection } },
    ...extra
  };
}

test("trusted reducer lets the joining player's seat resolve its own exact Engorge trigger", () => {
  const { state, source, rearOne, rearTwo } = fixture();
  const result = Reducer.applyEngorgeDecision(state, command("auth-guest", {}), seats, Engine);
  assert.equal(result.ok, true);
  assert.deepEqual(result.events.map(event => [event.type, event.cardInstanceId]), [
    ["card.retired", rearOne.uid], ["unit.became_engorged", source.uid]
  ]);
  assert.equal(result.events[0].sourceCardInstanceId, source.uid);
  assert.equal(result.events[0].sourceControllerPlayerId, "player-guest");
  assert.equal(result.events[0].subjectCardInstanceId, rearOne.uid);
  assert.equal(result.events[0].currentLocation, "drop");
  assert.equal(new Set(result.events.map(event => event.eventId)).size, result.events.length);
  assert.deepEqual(state.players.bot.rear, [source, null, rearTwo]);
  assert.deepEqual(state.players.bot.drop, [rearOne]);
  assert.equal(source.engorged, true);
  assert.equal(source.engorgeRetiredCount, 1);
  assert.equal(state.stateVersion, 9);
  assert.equal(state.pendingAbility, null);
});

test("host cannot resolve the joining player's prompt, and unseated identities are rejected", () => {
  const first = fixture();
  assert.deepEqual(Reducer.applyEngorgeDecision(first.state, command("auth-host", {}), seats, Engine), { ok: false, reason: "source-not-controlled" });
  assert.equal(first.state.players.bot.drop.length, 0);
  const second = fixture();
  assert.equal(Reducer.applyEngorgeDecision(second.state, command("auth-outsider", {}), seats, Engine).reason, "actor-not-seated");
});

test("stale, unrelated, duplicate, or invalid target decisions do not partially resolve", () => {
  const stale = fixture();
  assert.equal(Reducer.applyEngorgeDecision(stale.state, command("auth-guest", {}, { expectedStateVersion: 7 }), seats, Engine).reason, "stale-state-version");
  assert.equal(stale.state.players.bot.drop.length, 0);

  const unrelated = fixture();
  unrelated.state.pendingAttack.attackerUid = "different-copy";
  assert.equal(Reducer.applyEngorgeDecision(unrelated.state, command("auth-guest", {}), seats, Engine).reason, "invalid-engorge-selection");
  assert.equal(unrelated.state.players.bot.drop.length, 0);

  const invalidTarget = fixture();
  const bad = command("auth-guest", { engorgeTargetUids: ["attacker-copy-1"] });
  assert.equal(Reducer.applyEngorgeDecision(invalidTarget.state, bad, seats, Engine).reason, "invalid-engorge-selection");
  assert.equal(invalidTarget.state.players.bot.drop.length, 0);

  const repeated = fixture();
  assert.equal(Reducer.applyEngorgeDecision(repeated.state, command("auth-guest", {}), seats, Engine).ok, true);
  assert.equal(Reducer.applyEngorgeDecision(repeated.state, command("auth-guest", {}), seats, Engine).reason, "duplicate-action");
  assert.equal(repeated.state.players.bot.drop.length, 1);
});

test("trusted reducer resolves the host player's own prompt through the same seat mapping", () => {
  const { state } = fixture();
  const ability = Engine.parseCardAbilities({ id: "engorge-real-text", text: "AUTO [VC/RC]: Engorge." })[0];
  const source = { uid: "host-attacker", cardId: "engorge-real-text", ownerPlayerId: "player-host", controllerPlayerId: "player-host" };
  const retired = { uid: "host-rear", cardId: "rear-unit", ownerPlayerId: "player-host", controllerPlayerId: "player-host" };
  state.players.human.rear = [source, retired];
  state.pendingAttack = { attackerUid: source.uid, attackerSide: "human" };
  const eventId = "host-event";
  state.pendingAbility = { side: "human", field: "rear-left", instance: source, ability, triggerControllerPlayerId: "player-host", eventContext: { event: "attack", eventId, gameEvent: { eventId, type: "unit.attacked", sourceCardInstanceId: source.uid, subjectCardInstanceId: source.uid, sourceControllerPlayerId: "player-host" } } };
  const hostCommand = command("auth-host", { instanceUid: source.uid, abilityId: ability.id, engorgeTargetUids: [retired.uid] }, { actionId: "host-decision" });
  assert.equal(Reducer.applyEngorgeDecision(state, hostCommand, seats, Engine).ok, true);
  assert.equal(state.players.human.drop[0].uid, retired.uid);
});

test("the owning player can decline the optional trigger without applying its effect", () => {
  const { state, source, rearOne, rearTwo } = fixture();
  const decline = command("auth-guest", { instanceUid: source.uid, abilityId: "engorge-real-text:0" });
  decline.payload.accept = false;
  const result = Reducer.applyEngorgeDecision(state, decline, seats, Engine);
  assert.equal(result.ok, true);
  assert.deepEqual(result.events, []);
  assert.deepEqual(state.players.bot.rear, [source, rearOne, rearTwo]);
  assert.equal(source.engorged, undefined);
  assert.equal(state.pendingAbility, null);
});

function simpleAbilityState({ effects, costs = [], withSoul = true }) {
  const source = { uid: "source-copy", cardId: "supported-card", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" };
  const ability = { id: "supported-card:auto:1", kind: "AUTO", trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] }, requiredLocation: ["rear-guard"], costs, once: false, conditionStatus: "no-explicit-condition-detected", costStatus: costs.length ? "modeled" : "no-cost", definition: { kind: "AUTO", effects } };
  const player = { playerId: "player-guest", vanguard: null, rear: [source], deck: [{ uid: "draw-copy", cardId: "drawn-card", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" }], hand: [], damage: [], soul: withSoul ? [{ uid: "soul-copy", cardId: "soul-card", ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" }] : [], drop: [], bind: [] };
  const eventId = "simple-event";
  const state = { matchId: "match-simple", stateVersion: 3, processedActionIds: [], turn: 2, players: { human: { playerId: "player-host" }, bot: player }, pendingAbility: { side: "bot", field: "rear-left", instance: source, ability, triggerControllerPlayerId: "player-guest", eventContext: { event: "place", eventId, subjectZone: "rear-left", gameEvent: { eventId, type: "card.placed", sourceCardInstanceId: source.uid, subjectCardInstanceId: source.uid, sourceControllerPlayerId: "player-guest", currentLocation: "rear-left" } } } };
  const command = { actorAuthUid: "auth-guest", actionId: "simple-decision", expectedStateVersion: 3, payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: ability.id, costSelections: { cb: [], sb: costs.some(cost => cost.type === "soul-blast") ? ["soul-copy"] : [], discard: [], reveal: [] } } } };
  return { state, source, player, command };
}

test("trusted ability reducer resolves a supported draw effect for the owning seat", () => {
  const { state, player, command } = simpleAbilityState({ effects: [{ op: "draw", target: "controller", count: 1 }] });
  const result = Reducer.applyAbilityDecision(state, command, seats, Engine);
  assert.equal(result.ok, true);
  assert.equal(player.hand[0].uid, "draw-copy");
  assert.equal(result.events[0].type, "card.drawn");
  assert.equal(state.stateVersion, 4);
  assert.equal(state.pendingAbility, null);
});

test("trusted ability reducer pays a Soul-Blast before the effect and rejects unavailable costs atomically", () => {
  const options = { effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }], costs: [{ type: "soul-blast", count: 1 }] };
  const legal = simpleAbilityState(options);
  const result = Reducer.applyAbilityDecision(legal.state, legal.command, seats, Engine);
  assert.equal(result.ok, true);
  assert.equal(legal.source.turnPowerBoost, 5000);
  assert.deepEqual(legal.player.soul, []);
  assert.equal(legal.player.drop[0].uid, "soul-copy");

  const illegal = simpleAbilityState({ ...options, withSoul: false });
  assert.equal(Reducer.applyAbilityDecision(illegal.state, illegal.command, seats, Engine).ok, false);
  assert.equal(illegal.source.turnPowerBoost, undefined);
  assert.equal(illegal.state.pendingAbility.instance.uid, illegal.source.uid);
  assert.deepEqual(illegal.player.drop, []);
});

test("trusted ability reducer rejects effect operations outside its server allowlist", () => {
  const { state, command, source } = simpleAbilityState({ effects: [{ op: "reorder-deck-card", target: "chosen", destination: "player-choice" }] });
  assert.equal(Reducer.applyAbilityDecision(state, command, seats, Engine).reason, "unsupported-server-ability");
  assert.equal(state.players.bot.rear[0], source);
  assert.equal(state.stateVersion, 3);
});

test("trusted ability reducer rechecks the exact queued trigger event before resolving", () => {
  const missing = simpleAbilityState({ effects: [{ op: "draw", target: "controller", count: 1 }] });
  delete missing.state.pendingAbility.eventContext.gameEvent;
  assert.equal(Reducer.applyAbilityDecision(missing.state, missing.command, seats, Engine).reason, "trigger-event-missing");
  assert.deepEqual(missing.player.hand, []);

  const mismatched = simpleAbilityState({ effects: [{ op: "draw", target: "controller", count: 1 }] });
  mismatched.state.pendingAbility.eventContext.gameEvent.sourceCardInstanceId = "different-copy";
  assert.equal(Reducer.applyAbilityDecision(mismatched.state, mismatched.command, seats, Engine).reason, "trigger-event-mismatch");
  assert.deepEqual(mismatched.player.hand, []);
});
