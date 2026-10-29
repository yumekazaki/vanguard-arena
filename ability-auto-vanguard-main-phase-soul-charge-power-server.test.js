'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');
const PATTERN = 'auto-vanguard-main-phase-soul-charge-power-v1';
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).filter(ability => ability.definition?.source?.patternId === PATTERN));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
function instance(definition, uid, playerId, overrides = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || 'Unit', grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...overrides };
}
function fixture(ability, side) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const opponentSide = side === 'human' ? 'bot' : 'human';
  const opponentId = opponentSide === 'human' ? 'player-host' : 'player-guest';
  const source = instance(cards.get(ability.cardId), `source-${side}-${ability.id}`, ownerId, { turnPowerBoost: 0 });
  const top = instance(cards.get('cfa-3'), `top-${side}-${ability.id}`, ownerId);
  const own = { playerId: ownerId, vanguard: source, rear: Array(5).fill(null), soul: [], deck: [top], hand: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: instance(cards.get('cfa-3'), `opp-${side}-${ability.id}`, opponentId), rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `main-soul-${ability.id}-${side}`, stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingAttack: null, players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: 'phase.changed', actingPlayerId: ownerId, turnPlayerId: ownerId, phase: 'main', timingWindow: 'phase-start', before: { phase: 'stride' }, after: { phase: 'main' } });
  return { state, event, source, top, own, side, ownerId };
}
function decide(f, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `main-soul-${f.source.uid}`, expectedStateVersion: f.state.stateVersion, payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId: f.abilityId } } }, seats, Engine);
}
test('all 15 Vanguard Main-phase Soul Charge and power definitions are trusted and exact', () => {
  assert.equal(family.length, 15);
  for (const ability of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(entry => entry.id === ability.id), ability.id);
    assert.equal(ability.kind, 'AUTO');
    assert.equal(ability.trigger?.eventType, 'phase.changed');
    assert.equal(ability.trigger?.requiredPhase, 'main');
    assert.deepEqual(ability.requiredLocation, ['vanguard']);
    assert.equal(ability.definition.effects[0].op, 'soul-charge');
    assert.equal(ability.definition.effects[1].op, 'modify-power');
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});
test('the exact Vanguard controller privately resolves Main-phase Soul Charge and power on either online seat', () => {
  for (const ability of family) for (const side of ['human', 'bot']) {
    const f = fixture(ability, side); f.abilityId = ability.id;
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 1, `${ability.id}/${side}: ${JSON.stringify(result.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const resolved = decide(f);
    assert.equal(resolved.ok, true, `${ability.id}/${side}: ${resolved.reason}`);
    assert.deepEqual(f.own.soul.map(card => card.uid), [f.top.uid]);
    assert.equal(f.own.deck.length, 0);
    assert.equal(f.source.turnPowerBoost, ability.definition.effects[1].amount);
    assert.equal(f.source.turnPowerExpiry, f.source.controllerPlayerId);
  }
});
test('wrong phase, opponent phase, and host proxy cannot resolve the joining Vanguard ability', () => {
  const ability = family[0];
  for (const event of [
    Engine.createGameEvent({ matchId: 'bad-phase' }, { type: 'phase.changed', actingPlayerId: 'player-guest', turnPlayerId: 'player-guest', phase: 'battle', timingWindow: 'phase-start', before: { phase: 'main' }, after: { phase: 'battle' } }),
    Engine.createGameEvent({ matchId: 'wrong-player' }, { type: 'phase.changed', actingPlayerId: 'player-host', turnPlayerId: 'player-host', phase: 'main', timingWindow: 'phase-start', before: { phase: 'stride' }, after: { phase: 'main' } })
  ]) {
    const f = fixture(ability, 'bot'); f.abilityId = ability.id;
    assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0);
  }
  const f = fixture(ability, 'bot'); f.abilityId = ability.id;
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const before = JSON.stringify(f.state), result = decide(f, seats.hostAuthUid);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(f.state), before);
});
