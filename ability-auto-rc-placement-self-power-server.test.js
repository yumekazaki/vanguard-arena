'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const SPECS = [
  { cardId: 'cfa-8754', abilityId: 'cfa-8754:0', amount: 10000 },
  { cardId: 'cfa-8759', abilityId: 'cfa-8759:1', amount: 2000 },
  { cardId: 'cfa-9151', abilityId: 'cfa-9151:0', amount: 5000 }
];
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const PATTERN = 'auto-rc-placement-self-power-v1';
let sequence = 0;

function makeCard(cardId, uid, playerId) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog contains ${cardId}`);
  return {
    uid, cardId: String(cardId), cardName: definition.name, type: definition.type,
    grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId
  };
}

function fixture(spec, side = 'human', { from = 'hand', circle = 'rear-left', inVanguard = false } = {}) {
  const serial = ++sequence;
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const opponentId = side === 'human' ? 'player-guest' : 'player-host';
  const source = makeCard(spec.cardId, `placement-source-${serial}`, ownerId);
  const own = {
    playerId: ownerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [],
    orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], accelZones: 0, accelTypes: [], giftZones: []
  };
  const enemy = {
    playerId: opponentId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [],
    orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], accelZones: 0, accelTypes: [], giftZones: []
  };
  if (inVanguard) own.vanguard = source;
  else own.rear[0] = source;
  const state = {
    matchId: `rc-placement-self-power-${serial}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 4, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, players: side === 'human' ? { human: own, bot: enemy } : { human: enemy, bot: own }
  };
  const event = Engine.createGameEvent(state, {
    type: 'card.placed', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: from, currentLocation: inVanguard ? 'vanguard' : circle, circle: inVanguard ? 'vanguard' : circle,
    phase: 'main', timingWindow: 'call'
  });
  const ability = Engine.parseCardAbilitiesCached(CATALOG.get(spec.cardId)).find(item => item.id === spec.abilityId);
  assert.ok(ability, `${spec.abilityId} is parsed`);
  return { state, side, ownerId, source, own: state.players[side], enemy: state.players[side === 'human' ? 'bot' : 'human'], event, ability, spec };
}

function resolve(f, accept = true) {
  const auth = f.side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth, actionId: `resolve-${f.state.matchId}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept, selection: { instanceUid: f.source.uid, abilityId: f.spec.abilityId } }
  }, SEATS, Engine);
}

test('the three exact Bushiroad AUTO definitions preserve each printed power amount', () => {
  for (const spec of SPECS) {
    const f = fixture(spec), definition = f.ability.definition;
    assert.equal(f.ability.printedText, definition.printedText);
    assert.equal(definition.source.patternId, PATTERN);
    assert.equal(definition.effects.length, 1);
    assert.deepEqual(definition.effects[0], {
      op: 'modify-power', target: 'source', amount: spec.amount, duration: 'turn', noOpIfSourceNotInPlay: true
    });
    assert.deepEqual(definition.requiredLocation, ['rear-guard']);
    assert.equal(f.ability.canDecline, false);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test('host and joining player resolve only their own exact source power trigger', () => {
  for (const spec of SPECS) for (const side of ['human', 'bot']) {
    const f = fixture(spec, side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${spec.abilityId}/${side}: ${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side).pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side === 'human' ? 'bot' : 'human').pendingAbility, null);
    const result = resolve(f);
    assert.equal(result.ok, true, `${spec.abilityId}/${side}: ${JSON.stringify(result)}`);
    assert.equal(f.source.turnPowerBoost, spec.amount);
    assert.equal(f.source.turnPowerExpiry, f.ownerId);
    assert.equal(f.state.pendingAbility, null);
    assert.equal(f.enemy.rear.every(card => card == null), true);
  }
});

test('rejects unrelated units, Vanguard placement, Rear-Guard movement, and forged controller identity', () => {
  for (const spec of SPECS) {
    const unrelated = fixture(spec);
    const other = makeCard('cfa-20', `unrelated-${sequence}`, unrelated.ownerId);
    unrelated.own.rear[1] = other;
    const otherEvent = Engine.createGameEvent(unrelated.state, {
      type: 'card.placed', actingPlayerId: unrelated.ownerId, turnPlayerId: unrelated.ownerId,
      sourceCardInstanceId: other.uid, sourceOwnerPlayerId: unrelated.ownerId, sourceControllerPlayerId: unrelated.ownerId,
      cardInstanceId: other.uid, subjectCardInstanceId: other.uid, subjectOwnerPlayerId: unrelated.ownerId, subjectControllerPlayerId: unrelated.ownerId,
      previousLocation: 'hand', currentLocation: 'rear-right', circle: 'rear-right', phase: 'main', timingWindow: 'call'
    });
    assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [otherEvent], Engine).queued.length, 0);

    const vanguard = fixture(spec, 'human', { inVanguard: true });
    assert.equal(Reducer.discoverAutoTriggers(vanguard.state, [vanguard.event], Engine).queued.length, 0);

    const moved = fixture(spec, 'human', { from: 'rear-left', circle: 'rear-right' });
    moved.own.rear[0] = null;
    moved.own.rear[1] = moved.source;
    assert.equal(Reducer.discoverAutoTriggers(moved.state, [moved.event], Engine).queued.length, 0);

    const forged = fixture(spec);
    const forgedEvent = { ...forged.event, actingPlayerId: 'player-guest', sourceControllerPlayerId: 'player-guest', subjectControllerPlayerId: 'player-guest' };
    assert.equal(Reducer.discoverAutoTriggers(forged.state, [forgedEvent], Engine).queued.length, 0);
  }
});

test('a duplicated placement event cannot queue or apply the same AUTO twice', () => {
  const f = fixture(SPECS[1]);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(resolve(f).ok, true);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(f.source.turnPowerBoost, SPECS[1].amount);
});

test('if the source leaves play while its placement AUTO is pending, the mandatory prompt still resolves cleanly as a no-op', () => {
  const f = fixture(SPECS[2]);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  f.own.rear[0] = null;
  f.own.drop.push(f.source);
  f.source.zone = 'drop';
  const result = resolve(f);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.state.pendingAbility, null);
  assert.equal(f.source.turnPowerBoost || 0, 0);
});

