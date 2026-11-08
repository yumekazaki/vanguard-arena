'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const PATTERN = 'auto-rc-own-attack-power-per-count-battle-v1';
const TARGET_IDS = ['cfa-13049', 'cfa-13057', 'cfa-13060', 'cfa-13071', 'cfa-13083', 'cfa-13113', 'cfa-12058'];
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).filter(ability => TARGET_IDS.includes(String(ability.cardId)) && ability.definition?.source?.patternId === PATTERN));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };

function instance(cardId, uid, playerId, extra = {}) {
  const card = cards.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name || '', type: card?.type || 'Unit', grade: Number(card?.grade ?? 0), ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 10000, ...extra };
}

function fixture(ability, side = 'human') {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const opponentSide = side === 'human' ? 'bot' : 'human';
  const opponentId = opponentSide === 'human' ? 'player-host' : 'player-guest';
  const source = instance(ability.cardId, `source-${ability.id}-${side}`, ownerId);
  const target = instance(catalog.find(card => Number(card.grade) >= 3)?.id || catalog[0].id, `target-${ability.id}-${side}`, opponentId);
  const rear = Array(5).fill(null);
  rear[0] = source;
  const own = { playerId: ownerId, vanguard: instance(catalog[0].id, `vg-${side}`, ownerId), rear, soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], accelZones: 0, guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: target, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], accelZones: 0, guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `power-count-${ability.id}-${side}`, stateVersion: 1, turn: 4, side, phase: 4, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const attack = { battleId: `battle-${ability.id}-${side}`, attackerUid: source.uid, attackerSide: side, attackerZone: 'rear-left', attackerPlayerId: ownerId, attackingCardInstanceIds: [source.uid], defenderSide: opponentSide, targetUid: target.uid, targetZone: 'vanguard', power: 10000, targetPower: 10000, critical: 1, boostUid: null };
  state.pendingAttack = attack;
  const event = Engine.createGameEvent(state, { type: 'unit.attacked', actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, previousLocation: 'rear-left', currentLocation: 'rear-left', targetCardInstanceIds: [target.uid], targetLocation: 'vanguard', battleId: attack.battleId, attackingCardInstanceIds: [source.uid], phase: 'battle', timingWindow: 'attack-declared' });
  return { state, event, source, target, own, opponent, side, ownerId };
}

function resolve(f, ability) {
  const authUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid;
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `resolve-${f.source.uid}`, expectedStateVersion: f.state.stateVersion, payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id } } }, seats, Engine);
}

function seedCount(f, countBy) {
  if (countBy === 'controller-rear-guards') {
    f.own.rear[1] = instance('test-unit', 'own-active', f.ownerId);
    f.own.rear[2] = instance('test-unit', 'own-locked', f.ownerId, { locked: true });
  } else if (countBy === 'controller-drop') f.own.drop = Array.from({ length: 12 }, (_, i) => instance('test-unit', `drop-${i}`, f.ownerId));
  else if (countBy === 'controller-soul') f.own.soul = Array.from({ length: 7 }, (_, i) => instance('test-unit', `soul-${i}`, f.ownerId));
  else if (countBy === 'opponent-rear-guards') {
    f.opponent.rear[0] = instance('test-unit', 'opponent-active', f.opponent.playerId);
    f.opponent.rear[1] = instance('test-unit', 'opponent-locked', f.opponent.playerId, { locked: true });
  } else if (countBy === 'controller-set-orders') f.own.orders = [
    instance('test-set-order-a', 'set-order-a', f.ownerId, { type: 'Set Order', unitCard: false }),
    instance('test-set-order-b', 'set-order-b', f.ownerId, { type: 'Set Order', unitCard: false }),
    instance('test-normal-order', 'normal-order', f.ownerId, { type: 'Normal Order', unitCard: false })
  ];
  else if (countBy === 'opponent-open-rear-guards') {
    f.opponent.accelZones = 2;
    f.opponent.rear = Array(7).fill(null);
    f.opponent.rear[0] = instance('test-unit', 'opponent-occupied', f.opponent.playerId);
    f.opponent.rear[1] = instance('test-unit', 'opponent-locked-occupied', f.opponent.playerId, { locked: true });
  }
}

test('the exact real-card family compiles only its own-attack per-count AUTO abilities', () => {
  assert.equal(family.length, 7);
  for (const id of TARGET_IDS) {
    const ability = family.find(item => item.cardId === id);
    assert.ok(ability, id);
    assert.equal(ability.kind, 'AUTO');
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.equal(ability.trigger.eventType, 'unit.attacked');
    assert.equal(ability.trigger.subject, 'source');
    assert.deepEqual(ability.trigger.circles, ['rear-guard']);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
});

test('Wastelander Dragon has an explicit authoritative definition with source-review status retained', () => {
  const card = cards.get('cfa-12058');
  assert.ok(card, 'Wastelander Dragon must exist in the audited card snapshot');
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === 'cfa-12058:2');
  assert.ok(ability, 'expected exact Rear-Guard attack ability');
  assert.equal(ability.printedText, "AUTO [RC]: When this unit attacks, this unit gets power +2000 until end of that battle for each of your opponent’s open RC.");
  assert.equal(ability.definition?.source?.patternId, PATTERN);
  assert.equal(ability.definition?.source?.officialCardNumber, 'D-BT13/057EN');
  assert.equal(ability.definition?.source?.officialTextVerified, false);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
});

test('host and joining player resolve the live count on their own exact attack', () => {
  for (const ability of family) for (const side of ['human', 'bot']) {
    const f = fixture(ability, side), effect = ability.definition.effects[0];
    seedCount(f, effect.countBy);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${ability.id}/${side}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f, ability);
    assert.equal(result.ok, true, `${ability.id}/${side}: ${result.reason}`);
    const expectedCounts = { 'controller-rear-guards': 2, 'controller-drop': 2, 'controller-soul': 2, 'opponent-rear-guards': 1, 'controller-set-orders': 2, 'opponent-open-rear-guards': 5 };
    assert.equal(f.state.pendingAttack.power, 10000 + expectedCounts[effect.countBy] * Number(effect.amountPerCount), ability.id);
    assert.equal(f.source.turnPowerBoost || 0, 0, 'battle-only scaling must not persist on the card');
  }
});

test('drop and Soul thresholds round down and locked cards are excluded from Rear-Guard counts', () => {
  for (const ability of family.filter(item => ['controller-drop', 'controller-soul', 'controller-rear-guards', 'opponent-rear-guards'].includes(item.definition.effects[0].countBy))) {
    const f = fixture(ability), by = ability.definition.effects[0].countBy;
    if (by === 'controller-drop') f.own.drop = Array.from({ length: 4 }, (_, i) => instance('test-unit', `small-drop-${i}`, f.ownerId));
    if (by === 'controller-soul') f.own.soul = Array.from({ length: 2 }, (_, i) => instance('test-unit', `small-soul-${i}`, f.ownerId));
    if (by === 'controller-rear-guards') f.own.rear[1] = instance('test-unit', 'only-one-other-rg', f.ownerId);
    if (by === 'opponent-rear-guards') f.opponent.rear[0] = instance('test-unit', 'one-opponent-rg', f.opponent.playerId);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(resolve(f, ability).ok, true, ability.id);
    const expected = by === 'controller-rear-guards' ? 14000 : by === 'opponent-rear-guards' ? 12000 : 10000;
    assert.equal(f.state.pendingAttack.power, expected, ability.id);
  }
});

test('another unit attacking cannot trigger the source ability', () => {
  for (const ability of family) {
    const f = fixture(ability), other = instance('test-attacker', `unrelated-${ability.id}`, f.ownerId);
    f.own.rear[1] = other;
    f.state.pendingAttack = { ...f.state.pendingAttack, attackerUid: other.uid, attackerZone: 'rear-right', battleId: `other-battle-${ability.id}` };
    const unrelatedEvent = Engine.createGameEvent(f.state, { type: 'unit.attacked', actingPlayerId: f.ownerId, turnPlayerId: f.ownerId, sourceCardInstanceId: other.uid, cardInstanceId: other.uid, subjectCardInstanceId: other.uid, previousLocation: 'rear-right', currentLocation: 'rear-right', targetCardInstanceIds: [f.target.uid], targetLocation: 'vanguard', battleId: f.state.pendingAttack.battleId, attackingCardInstanceIds: [other.uid], phase: 'battle', timingWindow: 'attack-declared' });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [unrelatedEvent], Engine).queued.length, 0, ability.id);
  }
});

