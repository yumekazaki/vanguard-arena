"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const BATCH = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === "auto-self-revealed-damage-check-draw-v1")
  .map(ability => ({ cardId: String(card.id), abilityId: ability.id })));
const cardById = id => catalog.find(card => String(card.id) === String(id));

function instance(card, uid, playerId) {
  return { uid, cardId: String(card.id), cardName: card.name, type: card.type, grade: Number(card.grade),
    ownerPlayerId: playerId, controllerPlayerId: playerId };
}

function fixture(cardId, side = "human") {
  const card = cardById(cardId);
  assert.ok(card, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-self-revealed-damage-check-draw-v1");
  assert.ok(ability, `${cardId} has the reviewed damage-check ability`);
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const attackerSide = side === "human" ? "bot" : "human";
  const attackerId = attackerSide === "human" ? "player-host" : "player-guest";
  const revealed = instance(card, `revealed-${cardId}-${side}`, ownerId);
  const attacker = instance(cardById("cfa-3"), `attacker-${side}`, attackerId);
  const deckCard = instance(cardById("cfa-2"), `draw-${cardId}-${side}`, ownerId);
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? instance(cardById("cfa-3"), `host-vg-${side}`, ownerId) : attacker,
      rear: [], hand: side === "human" ? [] : [], soul: [], drop: [], deck: side === "human" ? [deckCard] : [], damage: side === "human" ? [revealed] : [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? instance(cardById("cfa-3"), `guest-vg-${side}`, ownerId) : attacker,
      rear: [], hand: [], soul: [], drop: [], deck: side === "bot" ? [deckCard] : [], damage: side === "bot" ? [revealed] : [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: "self-damage-check-draw", stateVersion: 2, eventSequence: 0, processedEventIds: [], processedActionIds: [],
    processedAbilityTriggers: [], pendingAbilities: [], turn: 2, side: attackerSide, phase: 5, players,
    pendingAttack: { battleId: `damage-battle-${side}`, attackerSide, attackerUid: attacker.uid, attackerZone: "vanguard",
      defenderSide: side, targetUid: players[side].vanguard.uid, targetZone: "vanguard", damageCheckSide: side,
      damageChecksStarted: true, damageChecksRemaining: 1, guardCards: [], power: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "damage.checked", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attackerId, sourceControllerPlayerId: attackerId,
    cardInstanceId: revealed.uid, subjectCardInstanceId: revealed.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    checkedCardInstanceId: revealed.uid, checkedCardTriggerType: "", checkKind: "damage", checkIndex: 1,
    previousLocation: "deck", currentLocation: "damage", battleId: state.pendingAttack.battleId,
    phase: "battle", timingWindow: "damage-check" });
  return { state, event, ability, ownerSide: side, ownerId, revealed, deckCard };
}

function resolve(f, authUid = f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `resolve-${f.ability.id}-${f.ownerSide}`,
    expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true,
      selection: { instanceUid: f.revealed.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("all 24 catalog damage-check draw abilities use the exact checked card as source and the trusted draw handler", () => {
  assert.equal(BATCH.length, 24);
  for (const { cardId, abilityId } of BATCH) {
    const ability = Engine.parseCardAbilitiesCached(cardById(cardId)).find(item => item.id === abilityId);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(item => item.id === abilityId), abilityId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
    assert.equal(ability.trigger.eventType, "damage.checked", abilityId);
    assert.equal(ability.trigger.subject, "event-subject", abilityId);
    assert.deepEqual(ability.costs, [], abilityId);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }], abilityId);
  }
});

test("the owner of each revealed damage card privately draws for both online seats", () => {
  for (const { cardId } of BATCH) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${cardId}:${side}`);
    assert.equal(f.state.pendingAbility.side, side, `${cardId}:${side}`);
    const result = resolve(f);
    assert.equal(result.ok, true, `${cardId}:${side}: ${result.reason}`);
    assert.equal(f.state.players[side].hand.some(card => card.uid === f.deckCard.uid), true, `${cardId}:${side}`);
    assert.equal(f.state.players[side].damage.some(card => card.uid === f.revealed.uid), true, `${cardId}:${side}`);
    assert.deepEqual(f.state.players[side === "human" ? "bot" : "human"].hand, [], `${cardId}:${side}`);
  }
});

test("another checked instance, a drive check, replay, or the opponent cannot claim the draw", () => {
  const mismatch = fixture(BATCH[0].cardId, "bot");
  assert.equal(Reducer.discoverAutoTriggers(mismatch.state, [{ ...mismatch.event, subjectCardInstanceId: "same-name-copy", cardInstanceId: "same-name-copy" }], Engine).queued.length, 0);
  assert.equal(Reducer.discoverAutoTriggers(mismatch.state, [{ ...mismatch.event, type: "drive.checked", checkKind: "drive", currentLocation: "trigger" }], Engine).queued.length, 0);

  const replay = fixture(BATCH[0].cardId, "bot");
  assert.equal(Reducer.discoverAutoTriggers(replay.state, [replay.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(replay.state, [replay.event], Engine).queued.length, 0);
  const before = JSON.stringify(replay.state);
  assert.equal(resolve(replay, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(replay.state), before);
  assert.equal(resolve(replay).ok, true);
  assert.equal(replay.state.players.bot.hand.length, 1);
});
