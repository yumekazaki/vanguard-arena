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
  const faceDownDamage = { uid: `${card.id}-${sourceSide}-damage`, cardId: "damage-card", faceDown: true, ownerPlayerId: sourcePlayerId, controllerPlayerId: sourcePlayerId };
  const own = player(sourcePlayerId), opponent = player(opponentPlayerId);
  own.drop.push(source, otherHeal); own.deck.push(deckTop); own.damage.push(faceDownDamage);
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
  return { state, source, otherHeal, deckTop, faceDownDamage, own, opponent, event, ability, sourceSide, sourcePlayerId };
}

test("all 48 G-Guardian charge cards are fully represented as sole Heal-trigger abilities", () => {
  assert.equal(new Set(abilities.map(({ card }) => card.id)).size, 48);
  for (const { card, ability } of abilities) {
    const parsed = Engine.parseCardAbilitiesCached(card);
    assert.equal(parsed.length, 1, `${card.id} has no other unreviewed printed ability`);
    assert.equal(card.type, "Trigger", `${card.id} remains a trigger card`);
    assert.equal(String(card.trigger).toLowerCase(), "heal", `${card.id} remains a Heal trigger`);
    assert.equal(Number(card.grade), 0, `${card.id} has grade-zero metadata`);
    assert.ok(Number.isFinite(Number(card.power)), `${card.id} has power metadata`);
    assert.ok([10000, 15000].includes(Number(card.shield)), `${card.id} has a validated shield value`);
    assert.ok(card.text.includes(ability.raw), `${card.id} preserves the printed ability text`);
    assert.equal(ability.kind, "AUTO", card.id);
    assert.equal(ability.canDecline, ability.raw.toLowerCase().includes("you may pay the cost"), `${card.id} preserves optional vs mandatory timing`);
    assert.deepEqual(ability.trigger, {
      status: "recognized-trigger", eventType: "card.discarded", subject: "source", circles: [],
      sourceLocation: "hand", destinationLocation: "drop", discardReason: "g-guardian-cost"
    }, `${card.id} requires this exact card discarded from hand for a G-Guardian cost`);
    assert.deepEqual(ability.costs, [
      { type: "source-bind", count: 1 },
      { type: "bind-heal-from-drop", count: 1, filter: { trigger: "Heal" } }
    ], `${card.id} binds this card and a different Heal trigger`);
    assert.deepEqual(ability.definition.effects, [{ op: "g-guardian-discard-charge-choice", target: "controller" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${card.id} has an authoritative resolver`);
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(card.id).find(item => item.id === ability.id);
    assert.ok(trusted, `${card.id} has a trusted server definition`);
    assert.equal(trusted.printedText, ability.printedText);
    assert.deepEqual(trusted.costs, ability.costs);
    assert.deepEqual(trusted.effects, ability.definition.effects);
  }
  assert.equal(cards.find(card => card.id === "cfa-5573").shield, 15000, "the official Heal-trigger erratum is reflected in shield metadata");
});

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
      const unauthorizedAuthUid = sourceSide === "human" ? "auth-guest" : "auth-host";
      const forged = Reducer.applyAbilityDecision(f.state, {
        actorAuthUid: unauthorizedAuthUid, actionId: `${card.id}-${sourceSide}-forged`, expectedStateVersion: f.state.stateVersion,
        payload: { type: "ability-response", accept: true, selection: {
          instanceUid: f.source.uid, abilityId: ability.id, effectUid: f.otherHeal.uid, chargeChoice: "soul-charge",
          costSelections: { cb: [], sb: [], discard: [], reveal: [] }, damageUids: []
        } }
      }, seats, Engine);
      assert.equal(forged.ok, false, `${card.id}: the other player cannot resolve this controller's ability`);
      assert.ok(f.state.pendingAbility, `${card.id}: rejecting a forged choice preserves the owner's prompt`);
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

test("Counter Charge and Soul Charge choices resolve for all 48 cards and both players", () => {
  for (const { card, ability } of abilities) for (const sourceSide of ["human", "bot"]) for (const chargeChoice of ["counter-charge", "soul-charge"]) {
    const f = fixture(card, ability, sourceSide);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${card.id}/${sourceSide}/${chargeChoice}`);
    const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: sourceSide === "human" ? "auth-host" : "auth-guest",
      actionId: `${card.id}-${sourceSide}-${chargeChoice}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: {
        instanceUid: f.source.uid, abilityId: ability.id, effectUid: f.otherHeal.uid, chargeChoice,
        costSelections: { cb: [], sb: [], discard: [], reveal: [] }, damageUids: chargeChoice === "counter-charge" ? [f.faceDownDamage.uid] : []
      } }
    }, seats, Engine);
    assert.equal(result.ok, true, `${card.id}/${sourceSide}/${chargeChoice}: ${result.reason}`);
    assert.deepEqual(f.own.bind.map(item => item.uid).sort(), [f.source.uid, f.otherHeal.uid].sort());
    assert.equal(f.opponent.bind.length, 0);
    assert.equal(f.opponent.soul.length, 0);
    if (chargeChoice === "counter-charge") {
      assert.equal(f.faceDownDamage.faceDown, false, `${card.id} Counter Charges the controller's damage`);
      assert.equal(f.own.soul.length, 0);
      assert.equal(f.own.deck.length, 1);
    } else {
      assert.equal(f.faceDownDamage.faceDown, true, `${card.id} does not Counter Charge after choosing Soul Charge`);
      assert.deepEqual(f.own.soul.map(item => item.uid), [f.deckTop.uid]);
      assert.equal(f.own.deck.length, 0);
    }
  }
});

test("unavailable Heal bind costs do not queue, and invalid Heal selections are rejected for all 48 cards", () => {
  for (const { card, ability } of abilities) for (const sourceSide of ["human", "bot"]) {
    const noHeal = fixture(card, ability, sourceSide);
    noHeal.own.drop = [noHeal.source];
    const unavailable = Reducer.discoverAutoTriggers(noHeal.state, [noHeal.event], Engine);
    assert.equal(unavailable.queued.length, 0, `${card.id}/${sourceSide}: no other Heal to bind`);

    const invalidTarget = fixture(card, ability, sourceSide);
    const queued = Reducer.discoverAutoTriggers(invalidTarget.state, [invalidTarget.event], Engine);
    assert.equal(queued.queued.length, 1, `${card.id}/${sourceSide}: costs are available before choice`);
    invalidTarget.otherHeal.triggerType = "Draw";
    const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
    const result = Reducer.applyAbilityDecision(invalidTarget.state, {
      actorAuthUid: sourceSide === "human" ? "auth-host" : "auth-guest",
      actionId: `${card.id}-${sourceSide}-invalid-heal`, expectedStateVersion: invalidTarget.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: {
        instanceUid: invalidTarget.source.uid, abilityId: ability.id, effectUid: invalidTarget.otherHeal.uid,
        chargeChoice: "soul-charge", costSelections: { cb: [], sb: [], discard: [], reveal: [] }, damageUids: []
      } }
    }, seats, Engine);
    assert.equal(result.ok, false, `${card.id}/${sourceSide}: a non-Heal target is illegal`);
    assert.ok(invalidTarget.own.drop.some(item => item.uid === invalidTarget.source.uid));
    assert.ok(invalidTarget.own.drop.some(item => item.uid === invalidTarget.otherHeal.uid));
    assert.equal(invalidTarget.own.bind.length, 0, `${card.id}: invalid choice has no partial payment`);
  }
});

test("optional wording can be declined; mandatory COST wording cannot", () => {
  for (const { card, ability } of abilities) for (const sourceSide of ["human", "bot"]) {
    const f = fixture(card, ability, sourceSide);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${card.id}/${sourceSide}`);
    const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: sourceSide === "human" ? "auth-host" : "auth-guest",
      actionId: `${card.id}-${sourceSide}-decline`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: false, selection: { instanceUid: f.source.uid, abilityId: ability.id } }
    }, seats, Engine);
    if (ability.canDecline) {
      assert.equal(result.ok, true, `${card.id}: optional skill can be declined`);
      assert.equal(f.state.pendingAbility, null);
      assert.deepEqual(f.own.drop.map(item => item.uid).sort(), [f.source.uid, f.otherHeal.uid].sort());
      assert.equal(f.own.bind.length, 0);
    } else {
      assert.equal(result.ok, false, `${card.id}: mandatory AUTO cannot be declined`);
      assert.equal(result.reason, "mandatory-ability");
      assert.ok(f.state.pendingAbility, `${card.id}: mandatory prompt remains pending`);
      assert.equal(f.own.bind.length, 0);
    }
  }
});
