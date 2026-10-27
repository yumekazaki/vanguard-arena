"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-named-vanguard-power-battle-v1";
const cards = loadCatalog();
const reviewedFamily = cards.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => ability.definition));

function abilityFor(cardId) {
  const card = cards.find(item => item.id === cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${cardId} compiles to ${PATTERN}`);
  return { card, ability };
}

function fixture({ cardId = "cfa-27", side = "bot", vanguardName, sourceZone = "rear-left", attackerUid = "source", targetZone = "vanguard" } = {}) {
  const { card, ability } = abilityFor(cardId);
  const ownerId = side === "human" ? "host" : "guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest" : "host";
  const conditionName = ability.conditions[0].value;
  const source = { uid: "source", cardId: card.id, cardName: card.name, ownerPlayerId: ownerId, controllerPlayerId: ownerId, power: 10000, unitCard: true };
  const vanguard = { uid: "friendly-vg", cardId: "friendly-vg", name: vanguardName ?? `Test ${conditionName} Vanguard`, cardName: vanguardName ?? `Test ${conditionName} Vanguard`, ownerPlayerId: ownerId, controllerPlayerId: ownerId, grade: 3 };
  const opponentVanguard = { uid: "opponent-vg", cardId: "opponent-vg", name: "Opponent Vanguard", cardName: "Opponent Vanguard", ownerPlayerId: opponentId, controllerPlayerId: opponentId, grade: 3 };
  const rear = [source, null, null, null, null];
  const state = { matchId: "own-attack-named-vg-regression", stateVersion: 0, turn: 4, side, phase: 5, processedActionIds: [], players: {
    human: { playerId: "host", vanguard: side === "human" ? vanguard : opponentVanguard, rear: side === "human" ? rear : [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] },
    bot: { playerId: "guest", vanguard: side === "bot" ? vanguard : opponentVanguard, rear: side === "bot" ? rear : [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] }
  } };
  if (sourceZone === "vanguard") {
    state.players[side].vanguard = source;
    state.players[side].rear[0] = null;
  }
  const currentCircle = sourceZone === "vanguard" ? "vanguard" : sourceZone;
  const targetUid = targetZone === "vanguard" ? opponentVanguard.uid : "opponent-rear";
  state.pendingAttack = { battleId: "own-attack-battle", attackerSide: side, attackerUid: attackerUid === "source" ? source.uid : attackerUid, attackerZone: currentCircle, targetUid, targetZone, power: 10000, critical: 1 };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: attackerUid === "source" ? source.uid : attackerUid, sourceControllerPlayerId: ownerId,
    subjectCardInstanceId: attackerUid === "source" ? source.uid : attackerUid, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [attackerUid === "source" ? source.uid : attackerUid],
    targetCardInstanceIds: [targetUid], targetLocation: targetZone, currentLocation: currentCircle,
    battleId: "own-attack-battle", phase: "battle", timingWindow: "attack-declared"
  });
  return { state, event, source, ability, side, ownerId, conditionName };
}

function resolve(f) {
  const authUid = f.side === "human" ? "auth-host" : "auth-guest";
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid, actionId: "activate-own-attack-trigger", expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
}

test("83 named-Vanguard own-attack abilities retain exact source, condition, amount, and battle duration", () => {
  const family = [];
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    family.push(ability);
    assert.equal(ability.kind, "AUTO", card.id);
    assert.equal(ability.trigger.eventType, "unit.attacked", card.id);
    assert.equal(ability.trigger.subject, "source", card.id);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], card.id);
    assert.equal(ability.conditions?.length, 1, card.id);
    assert.equal(ability.conditions[0].type, "controller-vanguard-name-contains", card.id);
    assert.ok(ability.conditions[0].value, card.id);
    assert.equal(ability.definition.effects?.length, 1, card.id);
    assert.equal(ability.definition.effects[0].op, "modify-power", card.id);
    assert.equal(ability.definition.effects[0].target, "source", card.id);
    assert.ok([2000, 3000, 5000].includes(ability.definition.effects[0].amount), card.id);
    assert.equal(ability.definition.effects[0].duration, "battle", card.id);
  }
  assert.equal(family.length, 83);
  assert.equal(reviewedFamily.length, 83);
  for (const definition of reviewedFamily) {
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(definition.cardId).find(item => item.id === definition.id);
    assert.ok(trusted, `${definition.id} exists in the production trusted registry`);
    assert.deepEqual(trusted.conditions, definition.conditions, `${definition.id} retains its printed Vanguard-name condition`);
    assert.deepEqual(trusted.effects, definition.effects, `${definition.id} retains its printed power and duration`);
  }
  assert.equal(family.filter(ability => ability.definition.effects[0].amount === 2000).length, 14);
  assert.equal(family.filter(ability => ability.definition.effects[0].amount === 3000).length, 68);
  assert.equal(family.filter(ability => ability.definition.effects[0].amount === 5000).length, 1);
});

test("matching RC attack resolves for either seat and applies only the printed battle power", () => {
  for (const [side, cardId, amount] of [["bot", "cfa-1706", 2000], ["human", "cfa-27", 3000], ["bot", "cfa-9370", 5000]]) {
    const f = fixture({ side, cardId });
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${side}/${cardId}`);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}/${cardId}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, 10000 + amount);
    assert.equal(f.source.turnPowerBoost, undefined, "battle bonus is not retained as a turn modifier");
    f.state.pendingAttack = null;
    assert.equal(f.source.power, 10000, "after the battle, the source has no residual power modifier");
  }
});

test("unmatched Vanguard name, other attacker, and non-RC source do not trigger; a valid Rear-Guard target is not required", () => {
  const positive = fixture({ cardId: "cfa-27" });
  const wrongName = fixture({ cardId: "cfa-27", vanguardName: "Completely Unrelated" });
  assert.equal(Reducer.discoverAutoTriggers(wrongName.state, [wrongName.event], Engine).queued.length, 0);

  const wrongAttacker = fixture({ cardId: "cfa-27", attackerUid: "another-card" });
  assert.equal(Reducer.discoverAutoTriggers(wrongAttacker.state, [wrongAttacker.event], Engine).queued.length, 0);

  const rearGuardTarget = fixture({ cardId: "cfa-27", targetZone: "rear-guard" });
  assert.equal(Reducer.discoverAutoTriggers(rearGuardTarget.state, [rearGuardTarget.event], Engine).queued.length, 1);

  const wrongCircle = fixture({ cardId: "cfa-27", sourceZone: "vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);

  const control = Reducer.discoverAutoTriggers(positive.state, [positive.event], Engine);
  assert.equal(control.queued.length, 1, "negative cases are tied to this ability's actual conditions");
});

test("replaying the same attack event and decision cannot stack the battle modifier twice", () => {
  const f = fixture({ cardId: "cfa-27" });
  const first = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(first.queued.length, 1);
  const replay = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(replay.queued.length, 0);
  const accepted = resolve(f);
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(f.state.pendingAttack.power, 13000);
  const duplicate = Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: "auth-guest", actionId: "activate-own-attack-trigger", expectedStateVersion: f.state.stateVersion - 1,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "duplicate-action");
  assert.equal(f.state.pendingAttack.power, 13000);
});
