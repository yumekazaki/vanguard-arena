"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");

const CHARGE_PATTERN = "auto-charge-effect-placement-bottom-deck-after-battle-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const card = (uid, cardId, playerId, extra = {}) => ({ uid, cardId, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 1, power: 8000, rested: false, ...extra });

function chargeState(side = "bot", cardId = "cfa-4142", timingWindow = "effect-placement", location = "rear-left") {
  const sourcePlayerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const source = card(`charge-${side}`, cardId, sourcePlayerId, { circle: location });
  const state = {
    matchId: "charge-authority-match", stateVersion: 7, processedActionIds: [], turn: 3, phase: 4, side,
    players: {
      human: { playerId: "host-player", vanguard: card("host-vg", "host-vg", "host-player"), rear: side === "human" ? [source, null, null, null, null] : [null, null, null, null, null], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], guardCircle: [], triggerZone: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], removed: [] },
      bot: { playerId: "guest-player", vanguard: card("guest-vg", "guest-vg", "guest-player"), rear: side === "bot" ? [source, null, null, null, null] : [null, null, null, null, null], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], guardCircle: [], triggerZone: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], removed: [] }
    }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: sourcePlayerId, turnPlayerId: sourcePlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: sourcePlayerId,
    subjectControllerPlayerId: sourcePlayerId, previousLocation: "soul", currentLocation: location,
    circle: location, phase: 4, timingWindow
  });
  return { state, event, source, side, sourcePlayerId, opponentSide };
}

test("registered Charge catalog definitions exactly preserve all 23 records and optional wording", () => {
  const definitions = Engine.getReviewedAbilityDefinitionsForCard("cfa-3429");
  assert.equal(definitions.length, 1);
  assert.equal(definitions[0].source.patternId, CHARGE_PATTERN);
  const { loadCatalog } = require("./scripts/audit-ability-catalog.js"), found = [];
  for (const catalogCard of loadCatalog()) for (const ability of Engine.parseCardAbilities(catalogCard)) {
    if (ability.definition?.source?.patternId === CHARGE_PATTERN) found.push(ability);
  }
  assert.equal(found.length, 23);
  assert.ok(found.every(ability => Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(item => item.id === ability.id)));
  assert.equal(found.find(ability => ability.cardId === "cfa-3429").canDecline, false);
  assert.ok(found.filter(ability => ability.cardId !== "cfa-3429").every(ability => ability.canDecline));
  assert.ok(found.every(ability => Reducer.supportsServerAbilityEffects(ability)));
});

test("Charge prompts and resolves only for the exact effect-placed Rear-Guard controlled by either seat", () => {
  for (const side of ["human", "bot"]) {
    const { state, event, source, sourcePlayerId } = chargeState(side);
    const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(state.pendingAbility?.side, side);
    assert.equal(state.pendingAbility?.instance.uid, source.uid);
    assert.equal(state.pendingAbility?.triggerControllerPlayerId, sourcePlayerId);
    const actorAuthUid = side === "human" ? "auth-host" : "auth-guest";
    const resolved = Reducer.applyAbilityDecision(state, {
      actorAuthUid, actionId: `charge-resolve-${side}`, expectedStateVersion: state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: state.pendingAbility.ability.id } }
    }, SEATS, Engine);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason}`);
    assert.equal(source.charging, true);
    assert.equal(source.chargingExpiry, sourcePlayerId);
    assert.equal(state.pendingAbility, null);
    assert.equal(state.pendingAbilities.length, 0);
  }
});

test("Charge rejects normal calls, Vanguard placement, unrelated card instances, and duplicate event delivery", () => {
  for (const [timingWindow, location, sourceMatches] of [
    ["normal-call", "rear-left", true],
    ["effect-placement", "vanguard", true],
    ["effect-placement", "rear-left", false]
  ]) {
    const setup = chargeState("bot", "cfa-4142", timingWindow, location);
    const event = sourceMatches ? setup.event : Engine.createGameEvent(setup.state, {
      type: "card.placed", actingPlayerId: setup.sourcePlayerId, turnPlayerId: setup.sourcePlayerId,
      sourceCardInstanceId: "different-copy", sourceOwnerPlayerId: setup.sourcePlayerId, sourceControllerPlayerId: setup.sourcePlayerId,
      cardInstanceId: "different-copy", subjectCardInstanceId: "different-copy", subjectOwnerPlayerId: setup.sourcePlayerId,
      subjectControllerPlayerId: setup.sourcePlayerId, previousLocation: "soul", currentLocation: "rear-left", phase: 4,
      timingWindow: "effect-placement"
    });
    assert.equal(Reducer.discoverAutoTriggers(setup.state, [event], Engine).queued.length, 0);
    assert.equal(Boolean(setup.state.pendingAbility), false);
  }
  const setup = chargeState();
  assert.equal(Reducer.discoverAutoTriggers(setup.state, [setup.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(setup.state, [setup.event], Engine).queued.length, 0);
  assert.equal(setup.state.pendingAbilities.length, 0);
});

test("Charge declines remain optional except for the mandatory printed reminder", () => {
  for (const [cardId, acceptsDecline] of [["cfa-3429", false], ["cfa-3474", true], ["cfa-4142", true]]) {
    const setup = chargeState("bot", cardId), discovered = Reducer.discoverAutoTriggers(setup.state, [setup.event], Engine);
    assert.equal(discovered.queued.length, 1);
    const result = Reducer.applyAbilityDecision(setup.state, {
      actorAuthUid: "auth-guest", actionId: `charge-decline-${cardId}`, expectedStateVersion: setup.state.stateVersion,
      payload: { type: "ability-response", accept: false, selection: { instanceUid: setup.source.uid, abilityId: setup.state.pendingAbility.ability.id } }
    }, SEATS, Engine);
    if (acceptsDecline) {
      assert.equal(result.ok, true, result.reason);
      assert.equal(setup.source.charging, undefined);
    } else {
      assert.equal(result.ok, false);
      assert.equal(setup.state.pendingAbility?.instance.uid, setup.source.uid);
    }
  }
});
