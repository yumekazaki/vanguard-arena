"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = ["cfa-2841", "cfa-3701", "cfa-5742"];
const PATTERN = "auto-gc-named-drop-protect-draw-discard-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const CATALOG = loadCatalog();
const card = id => {
  const result = CATALOG.find(item => String(item.id) === String(id));
  assert.ok(result, `catalog card ${id} exists`);
  return result;
};
const instance = (definition, uid, playerId, extra = {}) => ({
  uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit",
  grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
});

function fixture({ cardId = FAMILY[0], side = "bot", existingCopy = false, payWithCopy = false, attackVanguard = true } = {}) {
  const sourceDefinition = card(cardId), ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.id === `${cardId}:1`);
  assert.ok(ability, `${cardId}:1 is parsed`);
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const attackerSide = side === "human" ? "bot" : "human", attackerId = attackerSide === "human" ? "host-player" : "guest-player";
  const source = instance(sourceDefinition, `source-${side}-${cardId}`, ownerId, { zone: "guardian", circle: "guardian" });
  const costDefinition = payWithCopy ? sourceDefinition : card("cfa-2");
  const cost = instance(costDefinition, `cost-${side}`, ownerId);
  const effectDiscard = instance(card("cfa-3"), `effect-discard-${side}`, ownerId);
  const draw = instance(card("cfa-5"), `draw-${side}`, ownerId);
  const vanguard = instance(card("cfa-3"), `vanguard-${side}`, ownerId, { grade: 3 });
  const attackedRear = instance(card("cfa-3"), `attacked-rear-${side}`, ownerId, { circle: "rear-left" });
  const attacker = instance(card("cfa-3"), `attacker-${side}`, attackerId, { grade: 3 });
  const own = { playerId: ownerId, vanguard, rear: attackVanguard ? [] : [attackedRear], hand: [cost, effectDiscard], soul: [],
    drop: existingCopy ? [instance(sourceDefinition, `existing-${side}`, ownerId)] : [], deck: [draw], damage: [], bind: [], orders: [],
    guardCircle: [source], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: attackerId, vanguard: attacker, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [],
    guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = {
    matchId: `named-drop-gc-${cardId}-${side}`, stateVersion: 1, turn: 3, side: attackerSide, phase: 3,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [],
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: { battleId: `battle-${side}`, attackerSide, attackerUid: attacker.uid, attackerZone: "vanguard",
      defenderSide: side, targetUid: attackVanguard ? vanguard.uid : attackedRear.uid, targetZone: attackVanguard ? "vanguard" : "rear-left",
      guardCards: [source], power: 18000, targetPower: 10000, critical: 1 }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", battleId: state.pendingAttack.battleId,
    phase: "battle", timingWindow: "guard-placement"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovered.queued.length, 1, `${cardId}:${side} exact GC placement queues one prompt: ${JSON.stringify(discovered.skipped)}`);
  return { state, source, ability, side, ownerId, cost, effectDiscard, draw, vanguard, event };
}

function resolve(f, { effectDiscardUid, optionalNoTarget = false, targetUid = f.vanguard.uid, actorAuthUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-${f.side}-${f.ability.cardId}-${f.state.processedActionIds.length}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: f.source.uid, abilityId: f.ability.id, targetUid, optionalNoTarget,
      costSelections: { cb: [], sb: [], discard: [f.cost.uid], reveal: [] },
      ...(effectDiscardUid ? { effectDiscardUid } : {})
    } }
  }, SEATS, Engine);
}

test("the three exact Guardian abilities preserve their source, target wording, and trusted server definitions", () => {
  for (const cardId of FAMILY) {
    const ability = Engine.parseCardAbilitiesCached(card(cardId)).find(item => item.id === `${cardId}:1`);
    assert.equal(ability.definition.source.patternId, PATTERN, cardId);
    assert.equal(ability.definition.trigger.eventType, "card.placed", cardId);
    assert.deepEqual(ability.definition.trigger.circles, ["guardian"], cardId);
    assert.deepEqual(ability.definition.requiredLocation, ["guardian"], cardId);
    assert.equal(ability.definition.effects[0].op, "protect-target", cardId);
    assert.equal(ability.definition.effects[1].op, "conditional-draw-then-discard", cardId);
    assert.equal(ability.definition.effects[0].optionalTarget, cardId === "cfa-3701" ? true : undefined, cardId);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(item => item.id === ability.id), cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("host and joining player resolve their own protect and conditional draw-discard effects", () => {
  for (const cardId of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side, existingCopy: true });
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const otherAuth = side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid;
    const forged = resolve(f, { effectDiscardUid: f.effectDiscard.uid, actorAuthUid: otherAuth });
    assert.equal(forged.ok, false, `${cardId}:${side} rejects the other player's response`);
    assert.equal(f.state.players[side].deck.length, 1);
    const result = resolve(f, { effectDiscardUid: f.effectDiscard.uid });
    assert.equal(result.ok, true, `${cardId}:${side}: ${result.reason}`);
    const own = f.state.players[side];
    assert.equal(f.state.pendingAttack.blocked, true);
    assert.deepEqual(own.hand.map(item => item.uid), [f.draw.uid]);
    assert.deepEqual(own.drop.map(item => item.uid), [`existing-${side}`, f.cost.uid, f.effectDiscard.uid]);
    assert.deepEqual(f.state.players[side === "human" ? "bot" : "human"].hand, []);
  }
});

test("the same-name condition is rechecked after paying the discard cost", () => {
  for (const cardId of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side, payWithCopy: true });
    const result = resolve(f, { effectDiscardUid: f.effectDiscard.uid });
    assert.equal(result.ok, true, `${cardId}:${side}: ${result.reason}`);
    const own = f.state.players[side];
    assert.deepEqual(own.hand.map(item => item.uid), [f.draw.uid]);
    assert.deepEqual(own.drop.map(item => item.uid), [f.cost.uid, f.effectDiscard.uid]);
    assert.equal(f.state.pendingAttack.blocked, true);
  }
});

test("without the exact-name card in Drop after cost, the optional draw-discard step is skipped", () => {
  for (const cardId of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side });
    const result = resolve(f);
    assert.equal(result.ok, true, `${cardId}: ${result.reason}`);
    const own = f.state.players[side];
    assert.equal(f.state.pendingAttack.blocked, true);
    assert.deepEqual(own.hand, [f.effectDiscard]);
    assert.deepEqual(own.drop.map(item => item.uid), [f.cost.uid]);
    assert.deepEqual(own.deck.map(item => item.uid), [f.draw.uid]);
  }
});

test("Aermo's official up-to-one target wording permits the name-conditioned effect when no Vanguard is attacked", () => {
  const f = fixture({ cardId: "cfa-3701", side: "human", existingCopy: true, attackVanguard: false });
  const result = resolve(f, { effectDiscardUid: f.effectDiscard.uid, targetUid: null, optionalNoTarget: true });
  assert.equal(result.ok, true, result.reason);
  assert.notEqual(f.state.pendingAttack.blocked, true);
  assert.deepEqual(f.state.players.human.hand.map(item => item.uid), [f.draw.uid]);
});

test("wrong source identity and an unsupported card cannot use the trusted family", () => {
  const f = fixture({ cardId: FAMILY[0] });
  const wrong = Engine.createGameEvent(f.state, { ...f.event, eventId: undefined, sourceCardInstanceId: "another-copy", cardInstanceId: "another-copy", subjectCardInstanceId: "another-copy" });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [wrong], Engine).queued.length, 0);
  const forged = { ...f.ability, cardId: "cfa-999999", definition: { ...f.ability.definition, cardId: "cfa-999999" } };
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
