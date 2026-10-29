"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN_ID = "auto-g-guardian-discard-bind-heal-charge-choice-v1";
const cards = loadCatalog();
const abilities = cards.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN_ID)
  .map(ability => ({ card, ability })));

function player(playerId) {
  return { playerId, vanguard: { uid: `${playerId}-vg`, cardId: "vanguard", ownerPlayerId: playerId, controllerPlayerId: playerId }, rear: [], hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gZone: [], gDeck: [], extra: [], removed: [], crests: [], usedAbilities: [] };
}

function fixture(card, ability, sourceSide) {
  const opponentSide = sourceSide === "human" ? "bot" : "human";
  const sourcePlayerId = sourceSide === "human" ? "host-player" : "guest-player";
  const opponentPlayerId = opponentSide === "human" ? "host-player" : "guest-player";
  const source = { uid: `${card.id}-${sourceSide}-source`, cardId: card.id, type: "Normal Unit", grade: 0, trigger: "Heal", ownerPlayerId: sourcePlayerId, controllerPlayerId: sourcePlayerId };
  const otherHeal = { uid: `${card.id}-${sourceSide}-heal`, cardId: "heal-card", type: "Normal Unit", grade: 0, trigger: "Heal", ownerPlayerId: sourcePlayerId, controllerPlayerId: sourcePlayerId };
  const deckTop = { uid: `${card.id}-${sourceSide}-top`, cardId: "deck-card", ownerPlayerId: sourcePlayerId, controllerPlayerId: sourcePlayerId };
  const own = player(sourcePlayerId), opponent = player(opponentPlayerId);
  own.drop.push(source, otherHeal); own.deck.push(deckTop);
  const state = {
    matchId: `g-guardian-batch-${card.id}-${sourceSide}`, stateVersion: 3, eventSequence: 0,
    side: opponentSide, turn: 4, phase: 5, pendingAbility: null, pendingAbilities: [],
    processedAbilityTriggers: [], processedActionIds: [], processedEventIds: [],
    players: { [sourceSide]: own, [opponentSide]: opponent }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: sourcePlayerId, turnPlayerId: opponentPlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: sourcePlayerId, subjectControllerPlayerId: sourcePlayerId,
    previousLocation: "hand", currentLocation: "drop", discardReason: "g-guardian-cost", timingWindow: "g-guardian-cost"
  });
  return { state, source, otherHeal, deckTop, own, opponent, event, ability, sourceSide, sourcePlayerId };
}

test("all 48 G-Guardian discard charge abilities are trusted and resolve privately for either controller", () => {
  assert.equal(abilities.length, 48);
  for (const { card, ability } of abilities) {
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${card.id} must be trusted by server`);
    for (const sourceSide of ["human", "bot"]) {
      const f = fixture(card, ability, sourceSide);
      const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.equal(discovery.queued.length, 1, `${card.id} should queue once for ${sourceSide}`);
      assert.equal(f.state.pendingAbility.side, sourceSide);
      assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
      assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.sourcePlayerId);

      const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
      const actorAuthUid = sourceSide === "human" ? "auth-host" : "auth-guest";
      const result = Reducer.applyAbilityDecision(f.state, {
        actorAuthUid, actionId: `${card.id}-${sourceSide}-resolve`, expectedStateVersion: f.state.stateVersion,
        payload: { type: "ability-response", accept: true, selection: {
          instanceUid: f.source.uid, abilityId: ability.id, effectUid: f.otherHeal.uid,
          chargeChoice: "soul-charge", costSelections: { cb: [], sb: [], discard: [], reveal: [] }, damageUids: []
        } }
      }, seats, Engine);
      assert.equal(result.ok, true, `${card.id} failed for ${sourceSide}: ${result.reason}`);
      assert.deepEqual(f.own.bind.map(item => item.uid).sort(), [f.source.uid, f.otherHeal.uid].sort());
      assert.deepEqual(f.own.soul.map(item => item.uid), [f.deckTop.uid]);
      assert.equal(f.opponent.bind.length, 0);
      assert.equal(f.opponent.soul.length, 0);
      assert.equal(f.state.pendingAbility, null);
    }
  }
});

test("all 48 G-Guardian discard abilities reject an unrelated discard cause", () => {
  for (const { card, ability } of abilities) {
    const f = fixture(card, ability, "bot");
    const wrongEvent = Engine.createGameEvent(f.state, {
      ...f.event, eventId: `${f.event.eventId}-wrong-cost`, discardReason: "stride-cost"
    });
    assert.equal(Engine.eventMatchesAbilityTrigger(ability, "discard", wrongEvent, f.source.uid, "hand", "drop", f.sourcePlayerId), false, card.id);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [wrongEvent], Engine).queued.length, 0, card.id);
  }
});
