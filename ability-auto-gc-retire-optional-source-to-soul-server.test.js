'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');
const PATTERN = 'auto-gc-retire-optional-source-to-soul-v1';
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).filter(ability => ability.definition?.source?.patternId === PATTERN));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
function instance(definition, uid, playerId, overrides = {}) { return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || 'Unit', grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...overrides }; }
function fixture(ability, side) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const turnSide = side === 'human' ? 'bot' : 'human';
  const turnPlayerId = turnSide === 'human' ? 'player-host' : 'player-guest';
  const source = instance(cards.get(ability.cardId), `source-${side}-${ability.id}`, ownerId, { zone: 'drop' });
  const own = { playerId: ownerId, vanguard: instance(cards.get('cfa-3'), `vg-${side}`, ownerId), rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [source], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: turnPlayerId, vanguard: instance(cards.get('cfa-3'), `opp-vg-${side}`, turnPlayerId), rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `gc-retire-${ability.id}-${side}`, stateVersion: 1, turn: 2, side: turnSide, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingAttack: null, players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: 'card.retired', actingPlayerId: turnPlayerId, turnPlayerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: 'guardian', currentLocation: 'drop', circle: 'guardian', phase: 'battle', timingWindow: 'guardian-retirement' });
  return { state, event, source, own, side, ownerId, turnSide };
}
function decide(f, accept, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `gc-retire-${f.source.uid}`, expectedStateVersion: f.state.stateVersion, payload: { type: 'ability-response', accept, selection: { instanceUid: f.source.uid, abilityId: f.abilityId } } }, seats, Engine);
}
test('all 15 exact GC retirement-to-Soul abilities are trusted, optional, and source-scoped', () => {
  assert.equal(family.length, 15);
  for (const ability of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(entry => entry.id === ability.id), ability.id);
    assert.equal(ability.definition.optional, true);
    assert.equal(ability.trigger.eventType, 'card.retired');
    assert.equal(ability.trigger.sourceLocation, 'guardian');
    assert.equal(ability.trigger.destinationLocation, 'drop');
    assert.deepEqual(ability.definition.effects, [{ op: 'move-source-to-soul', target: 'source', from: 'drop' }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});
test('only the retired GC card owner receives the optional Soul prompt on either seat', () => {
  for (const ability of family) for (const side of ['human', 'bot']) {
    const f = fixture(ability, side); f.abilityId = ability.id;
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${ability.id}/${side}: ${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = decide(f, true);
    assert.equal(result.ok, true, `${ability.id}/${side}: ${result.reason}`);
    assert.deepEqual(f.own.soul.map(card => card.uid), [f.source.uid]);
    assert.equal(f.own.drop.length, 0);
  }
});
test('declining leaves the exact retired source in Drop, and host cannot proxy the joining player', () => {
  const ability = family[0];
  const declined = fixture(ability, 'bot'); declined.abilityId = ability.id;
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
  assert.equal(decide(declined, false).ok, true);
  assert.deepEqual(declined.own.drop.map(card => card.uid), [declined.source.uid]);
  assert.equal(declined.own.soul.length, 0);

  const joined = fixture(ability, 'bot'); joined.abilityId = ability.id;
  assert.equal(Reducer.discoverAutoTriggers(joined.state, [joined.event], Engine).queued.length, 1);
  const before = JSON.stringify(joined.state), proxy = decide(joined, true, seats.hostAuthUid);
  assert.equal(proxy.ok, false);
  assert.equal(JSON.stringify(joined.state), before);
});
test('a non-retirement movement or a different card instance cannot trigger the ability', () => {
  const ability = family[0];
  for (const patch of [
    { type: 'card.moved' },
    { previousLocation: 'hand' },
    { currentLocation: 'soul' },
    { subjectCardInstanceId: 'different-card', cardInstanceId: 'different-card', sourceCardInstanceId: 'different-card' }
  ]) {
    const f = fixture(ability, 'human');
    assert.equal(Reducer.discoverAutoTriggers(f.state, [{ ...f.event, ...patch }], Engine).queued.length, 0, JSON.stringify(patch));
  }
});
