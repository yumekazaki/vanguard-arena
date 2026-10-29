"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Definitions = require("./ability-definitions.js");

Engine.registerAbilityDefinitions(Definitions);

test("joining player's ride ability accepts the UI's empty optional selection defaults once", () => {
  const definition = Definitions.find(item => item.source?.patternId === "auto-rode-upon-draw-quick-shield-v1");
  assert.ok(definition);
  const ability = Engine.parseCardAbilities({
    id: definition.cardId,
    text: definition.printedText,
  }).find(item => item.id === definition.id);
  assert.ok(ability);

  const playerId = "joining-player";
  const instance = { uid: "ridden-vanguard-instance", cardId: definition.cardId, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const pending = {
    side: "bot",
    field: "vanguard",
    instance,
    ability,
    triggerControllerPlayerId: playerId,
    eventContext: { eventId: "ride-event-1" },
  };
  const state = {
    matchId: "quick-shield-online",
    stateVersion: 12,
    processedActionIds: [],
    players: {
      human: { playerId: "host-player", hand: [], damage: [], soul: [], rear: [], drop: [] },
      bot: { playerId, hand: [], damage: [], soul: [], rear: [], drop: [] },
    },
    pendingAbility: null,
    pendingAbilities: [pending],
  };
  const request = {
    type: "ability-response",
    matchId: state.matchId,
    actorPlayerId: playerId,
    actionId: "joiner-ability-1",
    expectedStateVersion: state.stateVersion,
    accept: true,
    selection: {
      instanceUid: instance.uid,
      abilityId: ability.id,
      costSelections: { cb: [], sb: [], discard: [], reveal: [] },
      effectUid: null,
      effectSourceZone: null,
      deckBottomUids: [],
      legionDropUids: [],
      engorgeTargetUids: [],
      callZone: null,
      targetUid: null,
      effectDiscardUid: null,
      deckDestination: null,
      damageUids: [],
      optionalNoTarget: false,
      chargeChoice: null,
      effectChoice: null,
      circleZone: null,
      revelationTopUid: null,
    },
  };

  assert.equal(Engine.validateRemoteRequest(state, request, playerId).ok, true);
  assert.equal(Engine.validateAbilityDecision(state, request, playerId, pending).ok, true);
  assert.equal(Engine.claimRemoteRequest(state, request.actionId), true);
  assert.equal(Engine.validateAbilityDecision(state, request, playerId, pending).reason, "duplicate-action");
});
