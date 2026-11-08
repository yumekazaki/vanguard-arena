'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const SPECS = [
  { cardId: 'cfa-607', abilityId: 'cfa-607:0', cardNumber: 'EB03/009EN', name: 'Dudley Daisy' },
  { cardId: 'cfa-614', abilityId: 'cfa-614:0', cardNumber: 'EB03/018EN', name: 'Dudley Douglass' }
];
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const PATTERN = 'auto-dudley-battle-phase-rc-placement-counter-blast-power-turn-v1';
const OFFICIAL_REFERENCE = 'https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=10&sort=no&view=text';
let sequence = 0;

function makeCard(cardId, uid, playerId) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog contains ${cardId}`);
  return {
    uid, cardId: String(cardId), cardName: definition.name, name: definition.name, type: definition.type,
    grade: Number(definition.grade), clan: definition.clan, power: Number(definition.power),
    ownerPlayerId: playerId, controllerPlayerId: playerId
  };
}

function fixture(spec, side = 'human', { phase = 'battle', circle = 'rear-left', previous = 'hand', clan = 'Spike Brothers' } = {}) {
  const serial = ++sequence;
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const opponentId = side === 'human' ? 'player-guest' : 'player-host';
  const source = makeCard(spec.cardId, `dudley-source-${serial}`, ownerId);
  const vanguardDefinition = Array.from(CATALOG.values()).find(card => card.clan === clan && Number(card.grade) === 3);
  assert.ok(vanguardDefinition, `${clan} grade 3 vanguard exists`);
  const vanguard = makeCard(vanguardDefinition.id, `dudley-vanguard-${serial}`, ownerId);
  const damage = [{ uid: `dudley-damage-${serial}`, cardId: 'cfa-2', ownerPlayerId: ownerId, controllerPlayerId: ownerId, faceDown: false }];
  const own = {
    playerId: ownerId, vanguard, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage,
    bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], accelZones: 0, accelTypes: [], giftZones: []
  };
  const enemy = {
    playerId: opponentId, vanguard: makeCard('cfa-3', `dudley-enemy-vanguard-${serial}`, opponentId), rear: Array(5).fill(null),
    hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [],
    gDeck: [], gZone: [], accelZones: 0, accelTypes: [], giftZones: []
  };
  const circleIndex = circle === 'rear-right' ? 1 : 0;
  own.rear[circleIndex] = source;
  const state = {
    matchId: `dudley-placement-${serial}`, stateVersion: 1, eventSequence: 0, turn: 3,
    phase: phase === 'battle' ? 5 : 4, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    players: side === 'human' ? { human: own, bot: enemy } : { human: enemy, bot: own }
  };
  const event = Engine.createGameEvent(state, {
    type: 'card.placed', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: previous, currentLocation: circle, circle, phase, timingWindow: 'card-placed'
  });
  const card = CATALOG.get(spec.cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === spec.abilityId);
  assert.ok(ability, `${spec.abilityId} is parsed`);
  return { state, side, ownerId, source, own: state.players[side], enemy: state.players[side === 'human' ? 'bot' : 'human'], damage, event, ability, spec };
}

function respond(f, { accept = true, actor = f.side, actionId = `resolve-${f.state.matchId}` } = {}) {
  const cb = accept ? f.damage.map(card => card.uid) : [];
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept, selection: { instanceUid: f.source.uid, abilityId: f.spec.abilityId, costSelections: { cb } } }
  }, SEATS, Engine);
}

test('Dudley Daisy and Dudley Douglass retain the official Counter-Blast and Battle Phase wording', () => {
  for (const spec of SPECS) {
    const card = CATALOG.get(spec.cardId), ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === spec.abilityId);
    assert.equal(card.name, spec.name);
    assert.equal(Engine.parseCardAbilitiesCached(card).length, 1, `${spec.cardId} has no unfinished sibling ability`);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.source.dataset, 'Bushiroad official card list');
    assert.equal(ability.definition.source.officialCardNumber, spec.cardNumber);
    assert.equal(ability.definition.source.officialReference, OFFICIAL_REFERENCE);
    assert.equal(ability.definition.source.officialTextVerified, true);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.deepEqual(ability.trigger, {
      status: 'recognized-trigger', eventType: 'card.placed', subject: 'source', circles: ['rear-guard'],
      sameSourceCircle: false, excludeSourceAsSubject: false, sourceLocation: null,
      requiredPhase: 'battle', turnRelation: 'controller'
    });
    assert.deepEqual(ability.conditions, [{ type: 'controller-vanguard-has-clan', value: 'Spike Brothers' }]);
    assert.deepEqual(ability.costs, [{ type: 'counter-blast', count: 1 }]);
    assert.deepEqual(ability.effects, [{ op: 'modify-power', target: 'source', amount: 5000, duration: 'turn', noOpIfSourceNotInPlay: true }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test('the host and joining player each receive and resolve only their own legal Battle Phase placement AUTO', () => {
  for (const spec of SPECS) for (const side of ['human', 'bot']) {
    const f = fixture(spec, side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${spec.abilityId}/${side}: ${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side).pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side === 'human' ? 'bot' : 'human').pendingAbility, null);
    const result = respond(f);
    assert.equal(result.ok, true, `${spec.abilityId}/${side}: ${JSON.stringify(result)}`);
    assert.equal(f.source.turnPowerBoost, 5000);
    assert.equal(f.source.turnPowerExpiry, f.ownerId);
    assert.equal(f.damage[0].faceDown, true, 'Counter Blast is paid by the ability controller');
    assert.equal(f.state.pendingAbility, null);
  }
});

test('the optional Counter Blast may be declined without changing power or damage', () => {
  for (const spec of SPECS) for (const side of ['human', 'bot']) {
    const f = fixture(spec, side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    const result = respond(f, { accept: false });
    assert.equal(result.ok, true, `${spec.abilityId}/${side}: ${JSON.stringify(result)}`);
    assert.equal(f.source.turnPowerBoost || 0, 0);
    assert.equal(f.damage[0].faceDown, false);
    assert.equal(f.state.pendingAbility, null);
  }
});

test('wrong phase, circle, source, clan, controller, or unavailable cost cannot trigger the effect', () => {
  for (const spec of SPECS) {
    for (const options of [
      { phase: 'main' }, { circle: 'vanguard' }, { circle: 'rear-right', previous: 'rear-left' }, { clan: 'Royal Paladin' }
    ]) {
      const f = fixture(spec, 'human', options);
      assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, `${spec.abilityId}: ${JSON.stringify(options)}`);
    }
    const noCost = fixture(spec, 'bot');
    noCost.damage[0].faceDown = true;
    const unavailable = Reducer.discoverAutoTriggers(noCost.state, [noCost.event], Engine);
    assert.equal(unavailable.queued.length, 0, `${spec.abilityId}: cannot pay Counter Blast`);

    const forged = fixture(spec, 'bot');
    assert.equal(Reducer.discoverAutoTriggers(forged.state, [forged.event], Engine).queued.length, 1);
    const snapshot = JSON.stringify(forged.state);
    const rejected = respond(forged, { actor: 'human', actionId: `forged-${spec.cardId}` });
    assert.equal(rejected.ok, false);
    assert.equal(JSON.stringify(forged.state), snapshot, 'the opponent cannot resolve or pay for the joining player');

    const unrelated = fixture(spec, 'human');
    const other = makeCard('cfa-20', `other-source-${sequence}`, unrelated.ownerId);
    unrelated.own.rear[1] = other;
    const unrelatedEvent = Engine.createGameEvent(unrelated.state, {
      type: 'card.placed', actingPlayerId: unrelated.ownerId, turnPlayerId: unrelated.ownerId,
      sourceCardInstanceId: other.uid, sourceOwnerPlayerId: unrelated.ownerId, sourceControllerPlayerId: unrelated.ownerId,
      cardInstanceId: other.uid, subjectCardInstanceId: other.uid,
      subjectOwnerPlayerId: unrelated.ownerId, subjectControllerPlayerId: unrelated.ownerId,
      previousLocation: 'hand', currentLocation: 'rear-right', circle: 'rear-right', phase: 'battle', timingWindow: 'card-placed'
    });
    assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelatedEvent], Engine).queued.length, 0, 'another card placement cannot trigger this instance');
  }
});

test('a repeated placement event cannot queue the same AUTO twice', () => {
  const f = fixture(SPECS[0], 'bot');
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(respond(f).ok, true);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(f.source.turnPowerBoost, 5000);
});
