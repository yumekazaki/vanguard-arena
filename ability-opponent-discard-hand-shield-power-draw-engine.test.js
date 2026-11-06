"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const VanguardAbilityEngine = require("./ability-engine.js");
globalThis.VanguardAbilityEngine = VanguardAbilityEngine;
const definitions = require("./ability-definitions.js");

const ability = definitions.find(item => item.id === "cfa-7952:1");
assert.ok(ability, "the reviewed Sadamune AUTO is registered");

function fixture({ opponentHand = [], opponentDeck = [{ uid: "opponent-draw", cardId: "drawn-card" }] } = {}) {
  const source = {
    uid: "source-sadamune",
    cardId: "cfa-7952",
    ownerPlayerId: "controller-player",
    controllerPlayerId: "controller-player",
    zone: "rear-guard",
    circle: "rear-left",
    power: 9000,
    turnPowerBoost: 0
  };
  const otherSource = {
    uid: "other-copy",
    cardId: "cfa-7952",
    ownerPlayerId: "controller-player",
    controllerPlayerId: "controller-player",
    power: 9000,
    turnPowerBoost: 0
  };
  const controller = { playerId: "controller-player", hand: [], drop: [], soul: [], deck: [] };
  const opponent = { playerId: "opponent-player", hand: opponentHand, drop: [], soul: [], deck: opponentDeck };
  const match = { players: { human: controller, guest: opponent }, turn: 7 };
  const emitted = [];
  const definitionsById = new Map([
    ["shield-15000", { shield: 15000 }],
    ["shield-10000", { shield: 10000 }],
    ["drawn-card", { shield: 0 }]
  ]);
  const context = {
    match,
    source,
    sourceInPlay: true,
    sourceZone: "rear-guard",
    sourceCircle: "rear-left",
    sourceControllerPlayerId: controller.playerId,
    player: controller,
    side: "human",
    sidePlayerId: controller.playerId,
    actorPlayerId: controller.playerId,
    turnSide: "human",
    turnPlayerId: controller.playerId,
    turnId: match.turn,
    opponentSide: "guest",
    opponentPlayer: opponent,
    opponentPlayerId: opponent.playerId,
    abilityId: ability.id,
    abilityForContinuation: ability,
    eventId: "placement-event-1",
    cardDefinitionForInstance: card => definitionsById.get(card.cardId) || null,
    emitEvent: event => emitted.push(event)
  };
  return { source, otherSource, controller, opponent, match, context, emitted };
}

function effect(context, extra = {}) {
  return VanguardAbilityEngine.resolveEffectProgram(
    ability.effects,
    VanguardAbilityEngine.EFFECT_HANDLERS,
    { ...context, ...extra }
  );
}

test("the AUTO pauses for the opponent's private hand choice without partially resolving", () => {
  const chosen = { uid: "opponent-shield", cardId: "shield-15000", ownerPlayerId: "opponent-player", controllerPlayerId: "opponent-player", zone: "hand" };
  const { source, opponent, match, context, emitted } = fixture({ opponentHand: [chosen] });
  let costPayments = 0;

  const result = VanguardAbilityEngine.resolveEffectProgram(
    ability.effects,
    VanguardAbilityEngine.EFFECT_HANDLERS,
    { ...context, allowEffectChoiceSuspension: true },
    () => { costPayments++; return true; }
  );

  assert.equal(result.ok, true);
  assert.equal(result.suspended, true);
  assert.deepEqual(result.continuation, { effectIndex: 0, priorEffectResults: [] });
  assert.equal(costPayments, 1);
  assert.deepEqual(opponent.hand, [chosen]);
  assert.deepEqual(opponent.drop, []);
  assert.equal(opponent.deck.length, 1);
  assert.equal(source.turnPowerBoost, 0);
  assert.equal(match.pendingEffectChoice.choiceType, "opponent-discard-from-hand");
  assert.equal(match.pendingEffectChoice.chooserPlayerId, "opponent-player");
  assert.equal(match.pendingEffectChoice.controllerPlayerId, "controller-player");
  assert.equal(match.pendingEffectChoice.sourceCardInstanceId, source.uid);
  assert.equal(match.pendingEffectChoice.abilityId, ability.id);
  assert.deepEqual(emitted, []);
});

test("resume discards only the opponent's selected card, gives its shield to the exact source, and draws for the opponent", () => {
  const selected = { uid: "selected-15k", cardId: "shield-15000", ownerPlayerId: "opponent-player", controllerPlayerId: "opponent-player", zone: "hand" };
  const remains = { uid: "kept-10k", cardId: "shield-10000", ownerPlayerId: "opponent-player", controllerPlayerId: "opponent-player", zone: "hand" };
  const { source, otherSource, opponent, context, emitted } = fixture({ opponentHand: [selected, remains] });
  let costPayments = 0;
  const first = VanguardAbilityEngine.resolveEffectProgram(
    ability.effects,
    VanguardAbilityEngine.EFFECT_HANDLERS,
    { ...context, allowEffectChoiceSuspension: true },
    () => { costPayments++; return true; }
  );
  assert.equal(first.suspended, true);

  const resumed = effect(context, {
    effectChoiceUid: selected.uid,
    effectResumeIndex: first.continuation.effectIndex,
    effectPriorResults: first.continuation.priorEffectResults
  });

  assert.equal(resumed.ok, true);
  assert.equal(resumed.suspended, undefined);
  assert.equal(costPayments, 1, "resume does not invoke the cost-payment callback a second time");
  assert.deepEqual(opponent.hand, [remains, { uid: "opponent-draw", cardId: "drawn-card", zone: "hand", circle: null }]);
  assert.equal(opponent.drop.length, 1);
  assert.equal(opponent.drop[0].uid, selected.uid);
  assert.equal(opponent.drop[0].zone, "drop");
  assert.equal(source.turnPowerBoost, 15000);
  assert.equal(source.turnPowerExpiry, "controller-player");
  assert.equal(otherSource.turnPowerBoost, 0);
  assert.equal(emitted.some(event => event.type === "card.discarded" && event.cardInstanceId === selected.uid && event.actingPlayerId === "opponent-player"), true);
  assert.equal(emitted.some(event => event.type === "characteristic.changed" && event.cardInstanceId === source.uid && event.after.power === 24000), true);
  assert.equal(emitted.some(event => event.type === "card.drawn" && event.cardInstanceId === "opponent-draw" && event.subjectOwnerPlayerId === "opponent-player"), true);
});

test("a card controlled by someone else cannot be selected and rejection is atomic", () => {
  const foreign = { uid: "foreign-card", cardId: "shield-15000", ownerPlayerId: "controller-player", controllerPlayerId: "controller-player", zone: "hand" };
  const { source, opponent, match, context, emitted } = fixture({ opponentHand: [foreign] });
  const result = effect(context, { effectChoiceUid: foreign.uid });

  assert.equal(result.ok, false);
  assert.deepEqual(opponent.hand, [foreign]);
  assert.deepEqual(opponent.drop, []);
  assert.equal(opponent.deck.length, 1);
  assert.equal(source.turnPowerBoost, 0);
  assert.equal(match.pendingEffectChoice, undefined);
  assert.deepEqual(emitted, []);
});

test("if the opponent has no hand, the ability skips the choice and still draws one card", () => {
  const { source, opponent, match, context, emitted } = fixture({ opponentHand: [] });
  const result = effect(context);

  assert.equal(result.ok, true);
  assert.equal(result.suspended, undefined);
  assert.equal(result.results[0].discardedCardInstanceId, null);
  assert.equal(result.results[0].powerAdded, 0);
  assert.deepEqual(opponent.hand, [{ uid: "opponent-draw", cardId: "drawn-card", zone: "hand", circle: null }]);
  assert.deepEqual(opponent.drop, []);
  assert.equal(source.turnPowerBoost, 0);
  assert.equal(match.pendingEffectChoice, undefined);
  assert.deepEqual(emitted.map(event => event.type), ["card.drawn"]);
});
