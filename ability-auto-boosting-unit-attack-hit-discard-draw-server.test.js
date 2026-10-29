'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');
const PATTERN = 'auto-boosting-unit-attack-hit-discard-draw-v1';
const catalog = loadCatalog(), cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).filter(ability => ability.definition?.source?.patternId === PATTERN));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
function instance(cardId, uid, playerId) { const c = cards.get(String(cardId)); return { uid, cardId: String(cardId), cardName: c?.name, type: c?.type || 'Unit', grade: Number(c?.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true }; }
function fixture(ability, side = 'human') {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest', otherSide = side === 'human' ? 'bot' : 'human', otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = instance(ability.cardId, `booster-${side}-${ability.id}`, ownerId), attacker = instance('cfa-3', `attacker-${side}-${ability.id}`, ownerId), defender = instance('cfa-3', `defender-${side}-${ability.id}`, otherId);
  const own = { playerId: ownerId, vanguard: attacker, rear: [source, null, null, null, null], soul: [], deck: [instance('cfa-4', `draw-${side}-${ability.id}`, ownerId)], hand: [instance('cfa-3', `discard-a-${side}-${ability.id}`, ownerId), instance('cfa-3', `discard-b-${side}-${ability.id}`, ownerId)], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: defender, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `boost-hit-${ability.id}-${side}`, stateVersion: 1, turn: 4, side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingAttack: null, players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: 'attack.hit', actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, attackingUnitInstanceId: attacker.uid, boosterCardInstanceId: source.uid, boostedCardInstanceId: source.uid, cardInstanceId: defender.uid, subjectCardInstanceId: defender.uid, subjectOwnerPlayerId: otherId, subjectControllerPlayerId: otherId, targetCardInstanceIds: [defender.uid], targetLocation: 'vanguard', battleId: `battle-${ability.id}`, phase: 'battle', timingWindow: 'attack-hit' });
  return { state, event, source, attacker, defender, own, opponent, side, ownerId };
}
function decide(f, abilityId, accept = true, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.source.uid}`, expectedStateVersion: f.state.stateVersion, payload: { type: 'ability-response', accept, selection: { instanceUid: f.source.uid, abilityId, costSelections: { discard: [`discard-a-${f.side}-${abilityId}`] } } } }, seats, Engine);
}

test('all fourteen trusted abilities preserve the exact trigger, location, cost, optionality, and effect', () => {
  assert.equal(family.length, 14);
  for (const ability of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(entry => entry.id === ability.id), ability.id);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.equal(ability.trigger.eventType, 'attack.hit');
    assert.equal(ability.trigger.subject, 'booster');
    assert.deepEqual(ability.costs, [{ type: 'discard', count: 1 }]);
    assert.equal(ability.canDecline, true);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test('host and joining player resolve only their own exact booster after that battle hits', () => {
  for (const ability of family) for (const side of ['human', 'bot']) {
    const f = fixture(ability, side), result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 1, `${ability.id}/${side}: ${JSON.stringify(result.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const resolved = decide(f, ability.id);
    assert.equal(resolved.ok, true, `${ability.id}/${side}: ${resolved.reason}`);
    assert.ok(f.own.drop.some(card => card.uid === `discard-a-${side}-${ability.id}`));
    assert.ok(f.own.hand.some(card => card.uid === `draw-${side}-${ability.id}`));
    assert.equal(f.opponent.hand.length, 0);
  }
});

test('a different booster, an unboosted attack, an unrelated battle, or the opponent turn never triggers it', () => {
  const ability = family[0];
  for (const patch of [
    { boosterCardInstanceId: 'other-booster', boostedCardInstanceId: 'other-booster' },
    { boosterCardInstanceId: null, boostedCardInstanceId: null },
    { battleId: null },
    { actingPlayerId: 'player-guest', turnPlayerId: 'player-guest' }
  ]) {
    const f = fixture(ability);
    const event = Engine.createGameEvent(f.state, { ...f.event, ...patch, eventId: undefined, sequence: undefined });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0, JSON.stringify(patch));
  }
  const moved = fixture(ability);
  moved.own.rear[0] = null; moved.own.drop.push(moved.source);
  assert.equal(Reducer.discoverAutoTriggers(moved.state, [moved.event], Engine).queued.length, 0);
});

test('declining consumes the event; a joiner prompt cannot be proxied by the host', () => {
  const ability = family[0], declined = fixture(ability);
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
  assert.equal(decide(declined, ability.id, false).ok, true);
  assert.equal(declined.own.hand.length, 2);
  assert.equal(declined.own.drop.length, 0);
  const joiner = fixture(ability, 'bot');
  assert.equal(Reducer.discoverAutoTriggers(joiner.state, [joiner.event], Engine).queued.length, 1);
  const before = JSON.stringify(joiner.state);
  assert.equal(decide(joiner, ability.id, true, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(joiner.state), before);
});
