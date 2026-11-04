'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const PATTERN = 'auto-boosted-attack-hit-soul-charge-return-source-v1';
const CARD_IDS = ['cfa-443', 'cfa-734', 'cfa-785'];
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };

function instance(cardId, uid, playerId, controllerPlayerId = playerId) {
  const card = catalog.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name, type: card?.type || 'Unit', grade: Number(card?.grade), ownerPlayerId: playerId, controllerPlayerId, unitCard: true };
}

function fixture(ability, side = 'human', { emptyDeck = false, stolenBooster = false } = {}) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human';
  const otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = instance(ability.cardId, `booster-${side}-${ability.id}`, stolenBooster ? otherId : ownerId, ownerId);
  const attacker = instance('cfa-3', `attacker-${side}-${ability.id}`, ownerId);
  const defender = instance('cfa-3', `defender-${side}-${ability.id}`, otherId);
  const own = { playerId: ownerId, vanguard: attacker, rear: [source, null, null, null, null], soul: [], deck: emptyDeck ? [] : [instance('cfa-4', `charge-${side}-${ability.id}`, ownerId)], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: defender, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const battleId = `battle-${side}-${ability.id}`;
  const state = {
    matchId: `boost-hit-soul-${ability.id}-${side}`, stateVersion: 1, turn: 4, side, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: {
      battleId, attackerUid: attacker.uid, attackerSide: side, attackerPlayerId: ownerId, attackerZone: 'vanguard',
      boostUid: source.uid, targetUid: defender.uid, targetZone: 'vanguard'
    }, pendingTurnEnd: null,
    players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own }
  };
  const event = Engine.createGameEvent(state, {
    type: 'attack.hit', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    attackingUnitInstanceId: attacker.uid, boosterCardInstanceId: source.uid, boostedCardInstanceId: attacker.uid,
    cardInstanceId: defender.uid, subjectCardInstanceId: defender.uid, subjectOwnerPlayerId: otherId, subjectControllerPlayerId: otherId,
    targetCardInstanceIds: [defender.uid], targetLocation: 'vanguard', battleId, phase: 'battle', timingWindow: 'attack-hit'
  });
  return { state, event, source, attacker, defender, own, opponent, side, ownerId, otherId };
}

function decision(f, ability, accept = true, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept, selection: { instanceUid: f.source.uid, abilityId: ability.id } }
  }, seats, Engine);
}

const family = CARD_IDS.flatMap(cardId => Engine.parseCardAbilitiesCached(catalog.get(cardId) || {}).filter(ability => ability.definition?.source?.patternId === PATTERN));

test('the exact three-card family keeps its boosted-hit trigger optional and tied to the exact Rear-Guard source', () => {
  assert.equal(family.length, 3);
  for (const ability of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(definition => definition.id === ability.id));
    assert.equal(ability.trigger.eventType, 'attack.hit');
    assert.equal(ability.trigger.subject, 'booster');
    assert.equal(ability.trigger.requiresBoostedBattle, true);
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.equal(ability.canDecline, true);
    assert.equal(ability.choiceStatus, 'modeled');
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test('host and joining player independently Soul Charge and return the exact booster to its owner deck', () => {
  for (const ability of family) for (const side of ['human', 'bot']) {
    const f = fixture(ability, side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${ability.id}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = decision(f, ability);
    assert.equal(result.ok, true, `${ability.id}/${side}: ${result.reason}`);
    assert.ok(f.own.soul.some(card => card.uid === `charge-${side}-${ability.id}`));
    assert.ok(f.own.deck.some(card => card.uid === f.source.uid));
    assert.equal(f.own.rear[0], null);
    assert.equal(f.source.controllerPlayerId, f.source.ownerPlayerId);
    assert.equal(f.opponent.soul.length, 0);
  }
});

test('the controller Soul Charges, while a source with a different owner returns to that owner’s deck', () => {
  const ability = family[0], f = fixture(ability, 'human', { stolenBooster: true });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = decision(f, ability);
  assert.equal(result.ok, true, result.reason);
  assert.ok(f.own.soul.some(card => card.uid === `charge-human-${ability.id}`));
  assert.ok(f.opponent.deck.some(card => card.uid === f.source.uid));
  assert.equal(f.own.deck.some(card => card.uid === f.source.uid), false);
  assert.equal(f.source.controllerPlayerId, f.otherId);
});

test('a missing deck resolves the optional ability without moving the booster or repeating the prompt', () => {
  const ability = family[0], f = fixture(ability, 'bot', { emptyDeck: true });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = decision(f, ability);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.own.soul.length, 0);
  assert.equal(f.own.rear[0]?.uid, f.source.uid);
  assert.equal(f.state.pendingAbility, null);
  assert.equal(f.state.pendingAbilities.length, 0);
});

test('a different booster, different battle, unrelated attacker, or foreign player cannot trigger or resolve it', () => {
  const ability = family[0];
  for (const patch of [
    { boosterCardInstanceId: 'different-booster' },
    { boostedCardInstanceId: 'different-booster' },
    { attackingUnitInstanceId: 'different-attacker', sourceCardInstanceId: 'different-attacker' },
    { battleId: 'other-battle' },
    { actingPlayerId: 'player-guest', turnPlayerId: 'player-guest' }
  ]) {
    const f = fixture(ability);
    const event = Engine.createGameEvent(f.state, { ...f.event, ...patch, eventId: undefined, sequence: undefined });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0, JSON.stringify(patch));
  }
  const f = fixture(ability, 'bot');
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const before = JSON.stringify(f.state);
  assert.equal(decision(f, ability, true, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(f.state), before);
});

test('declining consumes this trigger and leaves all cards in their original zones', () => {
  const ability = family[1], f = fixture(ability);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = decision(f, ability, false);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.own.soul.length, 0);
  assert.equal(f.own.rear[0]?.uid, f.source.uid);
  assert.equal(f.state.pendingAbility, null);
  assert.equal(f.state.pendingAbilities.length, 0);
});
