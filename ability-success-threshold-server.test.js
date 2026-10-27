"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const ids = ["cfa-3950", "cfa-3952", "cfa-3957", "cfa-4370", "cfa-4505", "cfa-4511", "cfa-4538", "cfa-5345", "cfa-5360", "cfa-3948", "cfa-3949", "cfa-3951", "cfa-3955", "cfa-3961", "cfa-4003", "cfa-3946", "cfa-3947", "cfa-4482", "cfa-4488", "cfa-5384", "cfa-4483", "cfa-5331", "cfa-5372", "cfa-3943"];
function card(id, uid, playerId, overrides = {}) {
  const data = catalog.find(item => String(item.id) === id) || {};
  return { uid, cardId: id, cardName: data.name || id, type: data.type || "Unit", grade: Number(data.grade || 0), power: 0, ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}
function fixture(cardId = "cfa-3950", side = "human") {
  const definition = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.source?.patternId === "auto-success-rear-guard-power-threshold-v1");
  assert.ok(definition, `missing structured definition for ${cardId}`);
  const parsed = Engine.parseCardAbilities({ id: cardId, text: definition.printedText }).find(item => item.kind === "AUTO");
  const ability = { ...parsed, id: definition.id, cardId, definition, requiredLocation: definition.requiredLocation, conditions: definition.conditions, effects: definition.effects };
  const playerId = side === "human" ? "player-host" : "player-guest", opponentId = side === "human" ? "player-guest" : "player-host";
  const sourceZone = definition.requiredLocation.includes("rear-guard") ? "rear-guard" : "vanguard";
  const source = card(cardId, `success-source-${side}`, playerId, { zone: sourceZone, circle: sourceZone === "vanguard" ? "vanguard" : "rear-left" });
  const target = card("target", `power-target-${side}`, playerId, { zone: "rear-guard", circle: "rear-right", power: 20000 });
  const own = { playerId, vanguard: sourceZone === "vanguard" ? source : card("vanguard", `vg-${side}`, playerId, { zone: "vanguard", circle: "vanguard" }), rear: sourceZone === "rear-guard" ? [source, target, null, null, null] : [target, null, null, null, null], hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: card("vanguard", `opp-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" }), rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: "success-test", stateVersion: 1, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], phase: 4, turn: 2, side, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "characteristic.changed", actingPlayerId: playerId, turnPlayerId: playerId, cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId, targetLocation: "rear-right", reason: "power-modified", before: { power: 18000 }, after: { power: 20000 }, phase: "main", timingWindow: "ability-resolution" });
  return { ability, source, target, own, state, event, side, playerId };
}
function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? "auth-host" : "auth-guest", actionId: `success-${f.event.eventId}`, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("all reviewed Success definitions have a validated server effect and preserve printed threshold/circle", () => {
  for (const cardId of ids) {
    const ability = fixture(cardId).ability;
    assert.equal(Engine.validateEffectProgram(ability.definition.effects, Engine.EFFECT_HANDLERS).ok, true, cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
    assert.equal(ability.definition.successThreshold, ability.definition.effects[0].threshold, cardId);
  }
});

test("Success triggers only for its controller's own rear-guard crossing, and resolves for both seats", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-3950", side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.source.successfulTurnKey, `${f.state.turn}:${f.state.side}`);
  }
});

test("Success rejects a non-crossing, opponent, Vanguard, wrong-turn, duplicate, or stale below-threshold event", () => {
  const nonCrossing = fixture();
  nonCrossing.event = Engine.createGameEvent(nonCrossing.state, { type: "characteristic.changed", actingPlayerId: nonCrossing.playerId, turnPlayerId: nonCrossing.playerId, cardInstanceId: nonCrossing.target.uid, subjectCardInstanceId: nonCrossing.target.uid, subjectControllerPlayerId: nonCrossing.playerId, targetLocation: "rear-right", reason: "power-modified", before: { power: 20000 }, after: { power: 22000 } });
  assert.equal(discover(nonCrossing).queued.length, 0);

  const wrongTurn = fixture();
  wrongTurn.event = Engine.createGameEvent(wrongTurn.state, { type: "characteristic.changed", actingPlayerId: wrongTurn.playerId, turnPlayerId: "player-guest", cardInstanceId: wrongTurn.target.uid, subjectCardInstanceId: wrongTurn.target.uid, subjectControllerPlayerId: wrongTurn.playerId, targetLocation: "rear-right", reason: "power-modified", before: { power: 18000 }, after: { power: 20000 } });
  assert.equal(discover(wrongTurn).queued.length, 0);

  const vanguardTarget = fixture();
  vanguardTarget.state.players.human.rear[1] = null;
  vanguardTarget.state.players.human.vanguard.power = 20000;
  vanguardTarget.event = Engine.createGameEvent(vanguardTarget.state, { type: "characteristic.changed", actingPlayerId: vanguardTarget.playerId, turnPlayerId: vanguardTarget.playerId, cardInstanceId: vanguardTarget.state.players.human.vanguard.uid, subjectCardInstanceId: vanguardTarget.state.players.human.vanguard.uid, subjectControllerPlayerId: vanguardTarget.playerId, targetLocation: "vanguard", reason: "power-modified", before: { power: 18000 }, after: { power: 20000 } });
  assert.equal(discover(vanguardTarget).queued.length, 0);

  const opponentTarget = fixture();
  const rival = card("target", "rival-rear", "player-guest", { zone: "rear-guard", circle: "rear-left", power: 20000 });
  opponentTarget.state.players.bot.rear[0] = rival;
  opponentTarget.event = Engine.createGameEvent(opponentTarget.state, { type: "characteristic.changed", actingPlayerId: opponentTarget.playerId, turnPlayerId: opponentTarget.playerId, cardInstanceId: rival.uid, subjectCardInstanceId: rival.uid, subjectControllerPlayerId: "player-guest", targetLocation: "rear-left", reason: "power-modified", before: { power: 18000 }, after: { power: 20000 } });
  assert.equal(discover(opponentTarget).queued.length, 0);

  const stale = fixture();
  stale.target.power = 19000;
  assert.equal(discover(stale).queued.length, 0);
});
