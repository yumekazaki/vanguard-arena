"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");

const FAMILY = [
  ["cfa-8319", "cfa-8319:0", 2000],
  ["cfa-8572", "cfa-8572:0", 5000],
  ["cfa-11635", "cfa-11635:0", 3000],
  ["cfa-11638", "cfa-11638:0", 3000],
  ["cfa-11732", "cfa-11732:1", 3000],
  ["cfa-11758", "cfa-11758:0", 3000],
];
const patternId = "act-source-to-soul-choose-friendly-power-turn-v1";

function matchState({ sourceZone = "rear-left", actor = "guest", targetController = "guest-player" } = {}) {
  const ownerPlayerId = actor === "guest" ? "guest-player" : "host-player";
  const side = actor === "guest" ? "bot" : "human";
  const source = { uid: "source-1", cardId: "cfa-8319", cardName: "Steam Artist, Pithana", ownerPlayerId, controllerPlayerId: ownerPlayerId, unitCard: true, type: "Unit", circle: sourceZone, grade: 0 };
  const target = { uid: "target-1", cardId: "target-card", cardName: "Friendly Unit", ownerPlayerId: targetController, controllerPlayerId: targetController, unitCard: true, type: "Unit", circle: "rear-right", grade: 1, turnPowerBoost: 0 };
  const players = {
    human: { playerId: "host-player", vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [] },
    bot: { playerId: "guest-player", vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [] },
  };
  players[side].rear = [source, targetController === ownerPlayerId ? target : null];
  if (targetController !== ownerPlayerId) players[actor === "guest" ? "human" : "bot"].rear = [target];
  return { matchId: "skill-family-test", stateVersion: 7, processedActionIds: [], side, phase: 4, turn: 1, players, pendingAttack: null, pendingAbility: null, pendingTrigger: null, pendingAbilities: [], pendingTurnEnd: null, authoritySeats: { hostSide: "human", guestSide: "bot" } };
}

function activate(state, { actorAuthUid = "auth-guest", cardId = "cfa-8319", abilityId = "cfa-8319:0", sourceUid = "source-1", targetUid = "target-1", actionId = "action-1", expectedStateVersion = state.stateVersion } = {}) {
  return Reducer.applyManualAbilityActivation(state, {
    actorAuthUid, actionId, expectedStateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: sourceUid, abilityId, selection: { targetUid } },
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
}

test("six exact COST source-to-Soul power cards load reviewed ACT definitions and distinct printed amounts", () => {
  assert.equal(Engine.getReviewedAbilityDefinitionsForCard("cfa-8319").find(item => item.id === "cfa-8319:0")?.source?.patternId, patternId);
  for (const [cardId, abilityId, amount] of FAMILY) {
    const definition = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.id === abilityId);
    assert.ok(definition, `${cardId} registered`);
    assert.equal(definition.kind, "ACT");
    assert.equal(definition.source.patternId, patternId);
    assert.deepEqual(definition.requiredLocation, ["rear-guard"]);
    assert.equal(definition.choicesReviewed, true);
    assert.equal(definition.effects[0].amount, amount);
    const ability = Engine.parseCardAbilities({ id: cardId, text: definition.printedText })[0];
    assert.equal(ability.definition.source.patternId, patternId);
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
    assert.equal(ability.costStatus, "supported-cost");
    assert.equal(ability.choiceStatus, "modeled");
  }
});

test("exact compiler accepts COST and legacy cost syntax but rejects changed timing, circle, or target wording", () => {
  const parse = printedText => Engine.parseCardAbilities({ id: "unregistered-exact-probe", text: printedText })[0];
  const valid = parse("ACT [RC]: COST [Put this unit into your soul], choose one of your units, and it gets power +3000 until end of turn.");
  assert.equal(valid.definition.source.patternId, patternId);
  assert.equal(parse("ACT [RC]: [Put this unit into your soul] Choose one of your units, and that unit gets power +3000 until end of turn.").definition.source.patternId, patternId);
  for (const text of [
    "ACT [VC]: COST [Put this unit into your soul], choose one of your units, and it gets power +3000 until end of turn.",
    "ACT [RC]: COST [Put this unit into your soul], choose up to one of your units, and it gets power +3000 until end of turn.",
    "ACT [RC]: COST [Put this unit into your soul], choose one of your units, and it gets power +3000 until end of battle.",
  ]) assert.equal(parse(text).definition, null, text);
});

test("the joining player's legal ACT pays by moving its exact source to Soul and applies power to the chosen friendly unit", () => {
  const state = matchState();
  const target = state.players.bot.rear[1];
  const result = activate(state);
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.players.bot.rear[0], null);
  assert.equal(state.players.bot.soul.at(-1).uid, "source-1");
  assert.equal(target.turnPowerBoost, 2000);
  assert.deepEqual(state.processedActionIds, ["action-1"]);
  assert.equal(result.resolvedAbilityId, "cfa-8319:0");
});

test("the host can independently resolve the same ACT with their own target and resources", () => {
  const state = matchState({ actor: "host", targetController: "host-player" });
  const source = state.players.human.rear[0];
  source.cardId = "cfa-8572";
  source.cardName = "Buzengou";
  const target = state.players.human.rear[1];
  const result = activate(state, { actorAuthUid: "auth-host", cardId: "cfa-8572", abilityId: "cfa-8572:0" });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.players.human.rear[0], null);
  assert.equal(state.players.human.soul.at(-1).uid, source.uid);
  assert.equal(target.turnPowerBoost, 5000);
  assert.equal(state.players.bot.soul.length, 0);
});

test("activation rejects wrong player, wrong turn, timing, Vanguard circle, and opponent target without partial payment", () => {
  const cases = [
    ["wrong actor", state => activate(state, { actorAuthUid: "auth-host" }), "not-actor-turn"],
    ["wrong turn", state => { state.side = "human"; return activate(state); }, "not-actor-turn"],
    ["wrong phase", state => { state.phase = 3; return activate(state); }, "wrong-timing-window"],
    ["wrong source zone", state => activate(state), "activation-wrong-zone"],
    ["invalid opponent target", state => activate(state, { targetUid: "target-1" }), "ability-target-filter-not-met"],
  ];
  for (const [label, run, expected] of cases) {
    const state = matchState({ targetController: label === "invalid opponent target" ? "host-player" : "guest-player" });
    if (label === "wrong player") state.side = "human";
    if (label === "wrong turn") state.side = "human";
    if (label === "wrong phase") state.phase = 3;
    if (label === "wrong source zone") {
      const source = state.players.bot.rear[0];
      state.players.bot.rear[0] = null;
      source.circle = "vanguard";
      state.players.bot.vanguard = source;
    }
    const before = JSON.stringify(state);
    const result = run(state);
    assert.equal(result.ok, false, label);
    assert.equal(JSON.stringify(state), before, `${label} must not partially pay the cost`);
    assert.ok(String(result.reason).includes(expected) || result.reason === expected, `${label}: ${result.reason}`);
  }
});

test("a successful source-to-Soul ACT cannot be repeated with the same instance or duplicate action", () => {
  const state = matchState();
  const first = activate(state);
  assert.equal(first.ok, true, first.reason);
  const duplicateAction = activate(state, { actionId: "action-1", expectedStateVersion: state.stateVersion });
  assert.equal(duplicateAction.ok, false);
  assert.equal(duplicateAction.reason, "duplicate-action");
  const secondAttempt = activate(state, { actionId: "action-2", expectedStateVersion: state.stateVersion });
  assert.equal(secondAttempt.ok, false);
  assert.equal(secondAttempt.reason, "skill-source-not-controlled-on-field");
});

test("the shared manual eligibility check enforces source controller, turn player, timing, field zone, and cost", () => {
  const ability = Engine.parseCardAbilities({ id: "cfa-8319", text: Engine.getReviewedAbilityDefinitionsForCard("cfa-8319")[0].printedText })[0];
  const legal = { cardInstanceId: "source-1", controllerPlayerId: "player-a", actorPlayerId: "player-a", turnPlayerId: "player-a", phase: "main", inPermittedZone: true, resources: { sourceCanMoveToSoul: true } };
  assert.equal(Engine.canActivateManualAbility(ability, legal).ok, true);
  assert.equal(Engine.canActivateManualAbility(ability, { ...legal, actorPlayerId: "player-b" }).reason, "not-controller");
  assert.equal(Engine.canActivateManualAbility(ability, { ...legal, turnPlayerId: "player-b" }).reason, "not-turn-player");
  assert.equal(Engine.canActivateManualAbility(ability, { ...legal, phase: "battle" }).reason, "wrong-timing-window");
  assert.equal(Engine.canActivateManualAbility(ability, { ...legal, inPermittedZone: false }).reason, "wrong-zone");
  assert.equal(Engine.canActivateManualAbility(ability, { ...legal, resources: { sourceCanMoveToSoul: false } }).reason, "unpayable-cost");
});
