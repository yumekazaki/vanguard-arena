'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const SPECS = [
  { cardId: 'cfa-2950', abilityId: 'cfa-2950:0', name: 'Night Sky Eagle', officialTextVerified: false },
  { cardId: 'cfa-3294', abilityId: 'cfa-3294:0', name: 'Steam Maiden, Merianna', officialTextVerified: true }
];
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const PATTERN = 'auto-generation-break-rc-placement-self-power-turn-v1';
let sequence = 0;

function makeCard(cardId, uid, playerId, extra = {}) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog contains ${cardId}`);
  return {
    uid, cardId: String(cardId), cardName: definition.name, type: definition.type,
    grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function fixture(spec, side = 'human', { gb = true, from = 'hand', circle = 'rear-left', inVanguard = false } = {}) {
  const serial = ++sequence;
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const opponentId = side === 'human' ? 'player-guest' : 'player-host';
  const source = makeCard(spec.cardId, `gb-placement-source-${serial}`, ownerId);
  const own = {
    playerId: ownerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [],
    orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: gb ? [makeCard('cfa-4000', `face-up-g-${serial}`, ownerId, { gDeckCard: true, faceUp: true })] : [],
    accelZones: 0, accelTypes: [], giftZones: []
  };
  const enemy = {
    playerId: opponentId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [],
    orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], accelZones: 0, accelTypes: [], giftZones: []
  };
  if (inVanguard) own.vanguard = source;
  else own.rear[0] = source;
  const state = {
    matchId: `generation-break-rc-placement-${serial}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 4, side,
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

function resolve(f) {
  const auth = f.side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth, actionId: `resolve-${f.state.matchId}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId: f.spec.abilityId } }
  }, SEATS, Engine);
}

test('the exact Generation Break placement family compiles for Night Sky Eagle and Steam Maiden, Merianna', () => {
  for (const spec of SPECS) {
    const card = CATALOG.get(spec.cardId);
    const parsed = Engine.parseCardAbilitiesCached(card);
    const ability = parsed.find(item => item.id === spec.abilityId);
    assert.equal(parsed.length, 1, `${spec.cardId} has one printed ability in the catalog`);
    assert.equal(card.name, spec.name);
    assert.match(ability.printedText, /^AUTO Generation Break 1 /);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.source.officialTextVerified, spec.officialTextVerified);
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.deepEqual(ability.conditions, [{ type: 'generation-break', count: 1 }]);
    assert.deepEqual(ability.definition.effects, [{ op: 'modify-power', target: 'source', amount: 4000, duration: 'turn', noOpIfSourceNotInPlay: true }]);
    assert.equal(ability.canDecline, false);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test('host and joining player resolve only their own exact placed source after Generation Break 1 is met', () => {
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
    assert.equal(f.source.turnPowerBoost, 4000);
    assert.equal(f.source.turnPowerExpiry, f.ownerId);
    assert.equal(f.state.pendingAbility, null);
    assert.equal(f.enemy.rear.every(card => card == null), true);
  }
});

test('rejects missing Generation Break, Vanguard placement, Rear-Guard movement, unrelated source, and forged controller', () => {
  for (const spec of SPECS) {
    const noGb = fixture(spec, 'human', { gb: false });
    assert.equal(Reducer.discoverAutoTriggers(noGb.state, [noGb.event], Engine).queued.length, 0);

    const vanguard = fixture(spec, 'human', { inVanguard: true });
    assert.equal(Reducer.discoverAutoTriggers(vanguard.state, [vanguard.event], Engine).queued.length, 0);

    const moved = fixture(spec, 'human', { from: 'rear-left', circle: 'rear-right' });
    moved.own.rear[0] = null;
    moved.own.rear[1] = moved.source;
    assert.equal(Reducer.discoverAutoTriggers(moved.state, [moved.event], Engine).queued.length, 0);

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

    const forged = fixture(spec);
    const forgedEvent = { ...forged.event, actingPlayerId: 'player-guest', sourceControllerPlayerId: 'player-guest', subjectControllerPlayerId: 'player-guest' };
    assert.equal(Reducer.discoverAutoTriggers(forged.state, [forgedEvent], Engine).queued.length, 0);
  }
});

test('duplicate placement events do not queue or apply the mandatory AUTO twice', () => {
  const f = fixture(SPECS[1]);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(resolve(f).ok, true);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(f.source.turnPowerBoost, 4000);
});

test('if the placed source leaves play before resolution, its mandatory effect safely resolves as a no-op', () => {
  const f = fixture(SPECS[1]);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  f.own.rear[0] = null;
  f.own.drop.push(f.source);
  f.source.zone = 'drop';
  const result = resolve(f);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.state.pendingAbility, null);
  assert.equal(f.source.turnPowerBoost || 0, 0);
});
