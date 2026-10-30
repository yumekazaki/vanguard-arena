"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

function setup(otherHealTrigger = "heal") {
  const card = loadCatalog().find(item => item.id === "cfa-5289");
  const ability = Engine.parseCardAbilities(card).find(item => item.definition?.source?.patternId === "auto-g-guardian-discard-bind-heal-charge-choice-v1");
  assert.ok(ability);
  const source = { uid: "guest-discarded-heal", cardId: card.id, cardName: card.name, triggerType: "heal", ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const otherHeal = { uid: "guest-drop-heal", cardId: "heal-card", triggerType: "heal", ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const top = { uid: "guest-deck-top", cardId: "deck-card", ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const state = { matchId: "gguardian-authority", stateVersion: 0, turn: 4, side: "human", phase: 3, eventSequence: 0, processedEventIds: [], processedActionIds: [], players: {
    human: { playerId: "host", vanguard: { uid: "host-vg", cardId: "host-vg", ownerPlayerId: "host", controllerPlayerId: "host" }, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] },
    bot: { playerId: "guest", vanguard: { uid: "guest-vg", cardId: "guest-vg", ownerPlayerId: "guest", controllerPlayerId: "guest" }, rear: [], hand: [], soul: [], drop: [source, otherHeal], deck: [top], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] }
  } };
  const event = Engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: "guest", turnPlayerId: "host",
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: "guest", sourceControllerPlayerId: "guest",
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: "guest", subjectControllerPlayerId: "guest",
    previousLocation: "hand", currentLocation: "drop", discardReason: "g-guardian-cost", timingWindow: "stride-cost"
  });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  // Revalidate the selected target at resolution in case its authoritative
  // definition changed after the trigger became eligible.
  otherHeal.triggerType = otherHealTrigger;
  return { state, source, otherHeal, ability, discovery };
}

test("the exact G-Guardian discard AUTO queues for its joining controller and resolves its Heal bind and Soul Charge", () => {
  const setupState = setup();
  assert.equal(setupState.discovery.queued.length, 1);
  assert.equal(setupState.state.pendingAbility.triggerControllerPlayerId, "guest");
  assert.equal(setupState.state.pendingAbility.instance.uid, setupState.source.uid);
  assert.equal(Reducer.applyAbilityDecision(setupState.state, {
    actorAuthUid: "auth-host", actionId: "host-cannot-pay-guest-ability", expectedStateVersion: 0,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: setupState.source.uid, abilityId: setupState.ability.id, effectUid: setupState.otherHeal.uid, chargeChoice: "soul-charge" } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine).reason, "source-not-controlled");

  const result = Reducer.applyAbilityDecision(setupState.state, {
    actorAuthUid: "auth-guest", actionId: "guest-pays-guest-ability", expectedStateVersion: 0,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: setupState.source.uid, abilityId: setupState.ability.id, effectUid: setupState.otherHeal.uid, chargeChoice: "soul-charge" } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(setupState.state.players.bot.drop.length, 0);
  assert.deepEqual(setupState.state.players.bot.bind.map(card => card.uid).sort(), [setupState.source.uid, setupState.otherHeal.uid].sort());
  assert.equal(setupState.state.players.bot.soul[0].uid, "guest-deck-top");
  assert.equal(setupState.state.players.human.bind.length, 0);
  assert.equal(setupState.state.pendingAbility, null);
});

test("G-Guardian discard AUTO rejects a non-Heal Drop selection without paying or moving cards", () => {
  const invalid = setup("draw");
  assert.equal(invalid.discovery.queued.length, 1);
  const stateBefore = JSON.stringify(invalid.state.players.bot);
  const result = Engine.validateAbilityDecision(invalid.state, {
    actionId: "invalid-heal-choice", matchId: invalid.state.matchId, expectedStateVersion: 0, actorPlayerId: "guest", accept: true,
    selection: { instanceUid: invalid.source.uid, abilityId: invalid.ability.id, effectUid: invalid.otherHeal.uid, chargeChoice: "soul-charge" }
  }, "guest", invalid.state.pendingAbility);
  assert.deepEqual(result, { ok: false, reason: "invalid-bind-heal-target" });
  assert.equal(JSON.stringify(invalid.state.players.bot), stateBefore);
});
