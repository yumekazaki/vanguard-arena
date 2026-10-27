"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_IDS = ["cfa-5289", "cfa-5299", "cfa-5303", "cfa-5306", "cfa-5307", "cfa-5310", "cfa-5344", "cfa-5350", "cfa-5352"];
const PATTERN_ID = "auto-g-guardian-discard-bind-heal-charge-choice-v1";

function player(playerId) {
  return { playerId, vanguard: null, rear: [], hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gZone: [], gDeck: [], extra: [], removed: [], crests: [], usedAbilities: [] };
}

test("the from-hand G-Guardian wording is registered for all nine exact catalog cards", () => {
  const cards = loadCatalog();
  const catalogReport = auditCatalog(cards);
  assert.equal(catalogReport.patterns[PATTERN_ID], 48);

  for (const cardId of BATCH_IDS) {
    const card = cards.find(candidate => candidate.id === cardId);
    assert.ok(card, `missing catalog card ${cardId}`);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN_ID);
    assert.ok(ability, `missing compiled ability for ${cardId}`);
    assert.equal(ability.id, `${cardId}:0`);
    assert.match(ability.printedText, /discarded from hand for the cost of calling a G guardian/i);
    assert.equal(ability.trigger.status, "recognized-trigger");
    assert.equal(ability.trigger.eventType, "card.discarded");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.trigger.circles, []);
    assert.equal(ability.trigger.destinationLocation, "drop");
    assert.equal(ability.trigger.sourceLocation, "hand");
    assert.equal(ability.trigger.discardReason, "g-guardian-cost");
    assert.deepEqual(ability.costs, [
      { type: "source-bind", count: 1 },
      { type: "bind-heal-from-drop", count: 1, filter: { trigger: "Heal" } }
    ]);
    assert.deepEqual(ability.definition.effects, [{ op: "g-guardian-discard-charge-choice", target: "controller" }]);
    assert.equal(ability.costStatus, "supported-cost");
    assert.equal(ability.choiceStatus, "modeled");
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(definition => definition.id === ability.id), true);
  }
});

test("the trusted reducer maps the exact trigger decision to its joining card controller", () => {
  const card = loadCatalog().find(candidate => candidate.id === "cfa-5289");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN_ID);
  const source = { uid: "guest-heal-source", cardId: card.id, cardName: card.name, type: "Normal Unit", grade: 0, trigger: "Heal", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const otherHeal = { uid: "guest-other-heal", cardId: "other-heal", type: "Normal Unit", grade: 0, trigger: "Heal", ownerPlayerId: "guest-player", controllerPlayerId: "guest-player" };
  const state = {
    matchId: "g-guardian-from-hand", stateVersion: 7, eventSequence: 0, turn: 3, side: "human", phase: 5,
    pendingAbility: null, pendingAbilities: [], processedAbilityTriggers: [], processedActionIds: [],
    players: { human: player("host-player"), bot: player("guest-player") }
  };
  state.players.bot.drop.push(source, otherHeal);
  const event = Engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: "guest-player", turnPlayerId: "host-player",
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: "guest-player", sourceControllerPlayerId: "guest-player",
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: "guest-player", subjectControllerPlayerId: "guest-player",
    previousLocation: "hand", currentLocation: "drop", discardReason: "g-guardian-cost", timingWindow: "g-guardian-cost"
  });

  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "discard", event, source.uid, "hand", "drop", "guest-player"), true);
  const pending = {
    side: "bot", field: "drop", instance: source, ability,
    triggerControllerPlayerId: "guest-player",
    eventContext: { event: "discard", eventId: event.eventId, gameEvent: event, subjectZone: "drop", turnPlayerId: "host-player" }
  };
  state.pendingAbility = pending;

  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  assert.equal(Reducer.playerSideForSeat(state, "auth-guest", seats), "bot");
  assert.equal(Reducer.playerSideForSeat(state, "auth-host", seats), "human");
  const selection = {
    instanceUid: source.uid, abilityId: "cfa-5289:0", effectUid: otherHeal.uid,
    chargeChoice: "soul-charge", costSelections: { cb: [], sb: [], discard: [], reveal: [] }, damageUids: []
  };
  const request = { actionId: "guest-g-guardian-choice", matchId: state.matchId, expectedStateVersion: state.stateVersion, accept: true, selection };
  assert.equal(Engine.validateAbilityDecision(state, { ...request, actorPlayerId: "guest-player" }, "guest-player", pending).ok, true);
  assert.equal(Engine.validateAbilityDecision(state, { ...request, actorPlayerId: "host-player" }, "host-player", pending).reason, "source-not-controlled");
  assert.equal(Engine.validateAbilityDecision(state, { ...request, actorPlayerId: "guest-player", selection: { ...selection, effectUid: source.uid } }, "guest-player", pending).reason, "invalid-bind-heal-target");
  assert.equal(Engine.validateAbilityDecision(state, { ...request, actorPlayerId: "guest-player", selection: { ...selection, chargeChoice: "draw" } }, "guest-player", pending).reason, "invalid-charge-choice");
});

test("the G-Guardian batch trigger rejects another source, wrong discard cause, and wrong movement", () => {
  const card = loadCatalog().find(candidate => candidate.id === "cfa-5289");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN_ID);
  const eventFor = (changes = {}) => Engine.createGameEvent({ matchId: "g-guardian-trigger-negative" }, {
    type: "card.discarded", actingPlayerId: "guest-player", turnPlayerId: "host-player",
    sourceCardInstanceId: "source-a", sourceOwnerPlayerId: "guest-player", sourceControllerPlayerId: "guest-player",
    subjectCardInstanceId: "source-a", subjectOwnerPlayerId: "guest-player", subjectControllerPlayerId: "guest-player",
    previousLocation: "hand", currentLocation: "drop", discardReason: "g-guardian-cost", ...changes
  });
  const matches = (event, uid = "source-a", sourceZone = "hand", subjectZone = "drop") => Engine.eventMatchesAbilityTrigger(ability, "discard", event, uid, sourceZone, subjectZone, "guest-player");

  assert.equal(matches(eventFor()), true);
  assert.equal(matches(eventFor(), "another-copy"), false);
  assert.equal(matches(eventFor({ discardReason: "stride-cost" })), false);
  assert.equal(matches(eventFor({ discardReason: "ordinary-discard" })), false);
  assert.equal(matches(eventFor({ previousLocation: "soul" }), "source-a", "soul"), false);
  assert.equal(matches(eventFor({ currentLocation: "bind" })), false);
  assert.equal(matches(eventFor({ subjectCardInstanceId: "other-card" })), true);
});
