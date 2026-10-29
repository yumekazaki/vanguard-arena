'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');
const PATTERN = 'auto-afterimage-opponent-bound-card-to-hand-return-source-v1';
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).filter(ability => ability.definition?.source?.patternId === PATTERN));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
function instance(definition, uid, playerId) { return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || 'Unit', grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true }; }
function fixture(ability, side, { handCount = 6 } = {}) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human', otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = instance(cards.get(ability.cardId), `afterimage-${side}-${ability.id}`, ownerId);
  const moved = instance(cards.get('cfa-3'), `bound-to-hand-${side}-${ability.id}`, otherId);
  const own = { playerId: ownerId, vanguard: instance(cards.get('cfa-3'), `vg-${side}`, ownerId), rear: [source, null, null, null, null], soul: [], deck: [], hand: Array.from({ length: handCount }, (_, index) => instance(cards.get('cfa-3'), `hand-${side}-${index}`, ownerId)), drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: instance(cards.get('cfa-3'), `opp-vg-${side}`, otherId), rear: Array(5).fill(null), soul: [], deck: [], hand: [moved], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `afterimage-${ability.id}-${side}`, stateVersion: 1, turn: 3, side: otherSide, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingAttack: null, players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: 'card.moved', actingPlayerId: otherId, turnPlayerId: otherId, sourceCardInstanceId: moved.uid, sourceOwnerPlayerId: otherId, sourceControllerPlayerId: otherId, cardInstanceId: moved.uid, subjectCardInstanceId: moved.uid, subjectOwnerPlayerId: otherId, subjectControllerPlayerId: otherId, previousLocation: 'bind', currentLocation: 'hand', phase: 'main', timingWindow: 'bound-card-return' });
  return { state, event, source, moved, own, opponent, side, ownerId, otherSide, otherId };
}
function decide(f, abilityId, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `afterimage-${f.source.uid}`, expectedStateVersion: f.state.stateVersion, payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId } } }, seats, Engine);
}
test('all 14 exact Afterimage records are trusted, optional, and source-scoped', () => {
  assert.equal(family.length, 14);
  for (const ability of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(entry => entry.id === ability.id), ability.id);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.deepEqual(ability.conditions, [{ type: 'controller-hand-size-at-most', count: 6 }]);
    assert.equal(ability.trigger.eventType, 'card.moved');
    assert.equal(ability.trigger.sourceLocation, 'bind');
    assert.equal(ability.trigger.destinationLocation, 'hand');
    assert.equal(ability.trigger.movedCardOwnerRelation, 'opponent');
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.definition.effects, [{ op: 'move-source-to-hand', target: 'source', from: 'rear-guard' }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});
test('both host and joining player receive their own Afterimage prompt and return only their source', () => {
  for (const ability of family) for (const side of ['human', 'bot']) {
    const f = fixture(ability, side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${ability.id}/${side}: ${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = decide(f, ability.id);
    assert.equal(result.ok, true, `${ability.id}/${side}: ${result.reason}`);
    assert.deepEqual(f.own.hand.slice(-1).map(card => card.uid), [f.source.uid]);
    assert.equal(f.own.rear[0], null);
    assert.ok(f.opponent.hand.some(card => card.uid === f.moved.uid));
  }
});
test('wrong owner, wrong movement, excess hand, and non-Rear-Guard source never trigger', () => {
  const ability = family[0];
  for (const patch of [
    { subjectOwnerPlayerId: 'player-host', sourceOwnerPlayerId: 'player-host', subjectControllerPlayerId: 'player-host', sourceControllerPlayerId: 'player-host' },
    { previousLocation: 'drop' },
    { currentLocation: 'drop' },
    { sourceCardInstanceId: 'unrelated' }
  ]) {
    const f = fixture(ability, 'human');
    assert.equal(Reducer.discoverAutoTriggers(f.state, [{ ...f.event, ...patch }], Engine).queued.length, 0, JSON.stringify(patch));
  }
  const tooMany = fixture(ability, 'bot', { handCount: 7 });
  assert.equal(Reducer.discoverAutoTriggers(tooMany.state, [tooMany.event], Engine).queued.length, 0);
  const offCircle = fixture(ability, 'bot'); offCircle.own.rear[0] = null; offCircle.own.vanguard = offCircle.source;
  assert.equal(Reducer.discoverAutoTriggers(offCircle.state, [offCircle.event], Engine).queued.length, 0);
});
test('decline is harmless and resolution rechecks hand size, source location, and joiner authority', () => {
  const ability = family[0];
  const declined = fixture(ability, 'bot');
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
  const declinedResult = Reducer.applyAbilityDecision(declined.state, { actorAuthUid: seats.guestAuthUid, actionId: 'afterimage-decline', expectedStateVersion: declined.state.stateVersion, payload: { type: 'ability-response', accept: false, selection: { instanceUid: declined.source.uid, abilityId: ability.id } } }, seats, Engine);
  assert.equal(declinedResult.ok, true);
  assert.equal(declined.own.rear[0].uid, declined.source.uid);
  assert.equal(declined.own.hand.some(card => card.uid === declined.source.uid), false);

  for (const stale of ['hand', 'source']) {
    const f = fixture(ability, 'bot');
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    if (stale === 'hand') f.own.hand.push(instance(cards.get('cfa-4'), 'seventh-card', f.ownerId));
    else { f.own.rear[0] = null; f.own.drop.push(f.source); }
    const before = JSON.stringify(f.state);
    const result = decide(f, ability.id);
    assert.equal(result.ok, false, stale);
    assert.equal(JSON.stringify(f.state), before, stale);
  }

  const joiner = fixture(ability, 'bot');
  assert.equal(Reducer.discoverAutoTriggers(joiner.state, [joiner.event], Engine).queued.length, 1);
  const before = JSON.stringify(joiner.state), proxy = decide(joiner, ability.id, seats.hostAuthUid);
  assert.equal(proxy.ok, false);
  assert.equal(JSON.stringify(joiner.state), before);
});
