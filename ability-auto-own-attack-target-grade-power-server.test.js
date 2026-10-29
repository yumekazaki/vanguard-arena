'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const PATTERN = 'auto-own-attack-target-grade-power-battle-v1';
const CATALOG = loadCatalog();
const CARDS = new Map(CATALOG.map(card => [String(card.id), card]));
const IDS = [
  'cfa-13021', 'cfa-13707', 'cfa-13709', 'cfa-13710',
  'cfa-13711', 'cfa-13712', 'cfa-13713'
];
const EXPECTED_TEXT = 'AUTO [RC]: When this unit attacks a grade 3 or greater unit, this unit gets power +5000 until end of that battle.';
const REMINDER = '(SHIFT + left click to get a Persona Shield ticket)';
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const FAMILY = IDS.map(cardId => {
  const card = CARDS.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:1`);
  assert.ok(ability, `${cardId}:1 exists`);
  return ability;
});

function makeInstance(cardId, uid, playerId, extra = {}) {
  const card = CARDS.get(String(cardId));
  return {
    uid, cardId: String(cardId), cardName: card?.name, type: card?.type || 'Unit',
    grade: Number(card?.grade), ownerPlayerId: playerId, controllerPlayerId: playerId,
    unitCard: true, power: 10000, ...extra
  };
}

function fixture(ability, side = 'human', { targetGrade = 3, targetZone = 'vanguard', sourceZone = 'rear-left' } = {}) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human';
  const otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = makeInstance(ability.cardId, `source-${ability.cardId}-${side}`, ownerId);
  const targetDefinition = CATALOG.find(card => Number(card.grade) === targetGrade && /unit/i.test(card.type || 'Unit'));
  assert.ok(targetDefinition, `catalog contains a grade ${targetGrade} target`);
  const target = makeInstance(targetDefinition.id, `target-${ability.cardId}-${side}`, otherId);
  const own = {
    playerId: ownerId, vanguard: null, rear: Array(5).fill(null), soul: [], deck: [], hand: [],
    drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  };
  if (sourceZone === 'vanguard') own.vanguard = source;
  else if (sourceZone === 'hand') own.hand.push(source);
  else if (sourceZone === 'drop') own.drop.push(source);
  else own.rear[0] = source;
  const opponent = {
    playerId: otherId, vanguard: null, rear: Array(5).fill(null), soul: [], deck: [], hand: [],
    drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  };
  if (targetZone === 'vanguard') opponent.vanguard = target;
  else opponent.rear[0] = target;
  const battleId = `battle-${ability.cardId}-${side}`;
  const state = {
    matchId: `target-grade-${ability.cardId}-${side}`, stateVersion: 1, turn: 2, side, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null, pendingTrigger: null,
    players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: {
      battleId, attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownerId,
      attackerZone: sourceZone, defenderSide: otherSide, targetUid: target.uid, targetZone,
      power: 10000, targetPower: 50000, targetGrade, critical: 1
    }
  };
  const event = Engine.createGameEvent(state, {
    type: 'unit.attacked', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [source.uid], previousLocation: sourceZone, currentLocation: sourceZone,
    targetCardInstanceIds: [target.uid], targetLocation: targetZone, battleId,
    phase: 'battle', timingWindow: 'attack-declared'
  });
  return { ability, state, event, source, target, own, opponent, side, ownerId, otherId, otherSide };
}

function resolve(f, { actorAuthUid = f.side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId = `resolve-${f.source.uid}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, SEATS, Engine);
}

test('the seven catalog abilities have only the two intended printed-text variants and trusted definitions', () => {
  assert.equal(FAMILY.length, 7);
  for (const ability of FAMILY) {
    const text = String(ability.printedText || '').replace(/\s+/g, ' ').trim();
    assert.ok(text === EXPECTED_TEXT || text === `${EXPECTED_TEXT} ${REMINDER}`, `${ability.id}: ${text}`);
    assert.equal(ability.definition?.source?.patternId, PATTERN, ability.id);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(definition => definition.id === ability.id), ability.id);
    assert.equal(ability.kind, 'AUTO');
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.equal(ability.trigger?.status, 'recognized-trigger');
    assert.equal(ability.trigger?.eventType, 'unit.attacked');
    assert.equal(ability.trigger?.subject, 'source');
    assert.deepEqual(ability.trigger?.circles, ['rear-guard']);
    assert.deepEqual(ability.conditions, [{ type: 'attack-target-grade-at-least', count: 3 }]);
    assert.deepEqual(ability.costs, []);
    assert.deepEqual(ability.definition.effects, [{ op: 'modify-power', target: 'source', amount: 5000, duration: 'battle' }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test('either player seat gets only its own exact attack trigger against grade 3 or greater units', () => {
  for (const ability of FAMILY) for (const side of ['human', 'bot']) for (const targetZone of ['vanguard', 'rear-left']) {
    const f = fixture(ability, side, { targetGrade: 3, targetZone });
    const queued = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(queued.queued.length, 1, `${ability.id}/${side}/${targetZone}: ${JSON.stringify(queued.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.state.pendingAttack.power, 15000);
    assert.equal(f.target.turnPowerBoost || 0, 0);
  }
});

test('grade 2 targets, wrong attackers, wrong source circles, and wrong controllers cannot trigger', () => {
  const ability = FAMILY[0];
  const gradeTwo = fixture(ability, 'human', { targetGrade: 2 });
  assert.equal(Reducer.discoverAutoTriggers(gradeTwo.state, [gradeTwo.event], Engine).queued.length, 0);
  for (const sourceZone of ['vanguard', 'hand', 'drop']) {
    const f = fixture(ability, 'human', { sourceZone });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, sourceZone);
  }
  const wrongSource = fixture(ability);
  const unrelated = Engine.createGameEvent(wrongSource.state, {
    ...wrongSource.event, sourceCardInstanceId: 'unrelated', cardInstanceId: 'unrelated',
    subjectCardInstanceId: 'unrelated', attackingCardInstanceIds: ['unrelated'], eventId: undefined, sequence: undefined
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [unrelated], Engine).queued.length, 0);
  const wrongController = fixture(ability);
  wrongController.source.controllerPlayerId = wrongController.otherId;
  assert.equal(Reducer.discoverAutoTriggers(wrongController.state, [wrongController.event], Engine).queued.length, 0);
});

test('target grade comes from the authoritative targeted instance, not a forged event field', () => {
  const ability = FAMILY[0];
  const forgedLow = fixture(ability, 'human', { targetGrade: 2 });
  const lowWithSpoof = Engine.createGameEvent(forgedLow.state, { ...forgedLow.event, targetGrade: 3, eventId: undefined, sequence: undefined });
  assert.equal(Reducer.discoverAutoTriggers(forgedLow.state, [lowWithSpoof], Engine).queued.length, 0);
  const forgedHigh = fixture(ability, 'human', { targetGrade: 3 });
  const highWithSpoof = Engine.createGameEvent(forgedHigh.state, { ...forgedHigh.event, targetGrade: 2, eventId: undefined, sequence: undefined });
  assert.equal(Reducer.discoverAutoTriggers(forgedHigh.state, [highWithSpoof], Engine).queued.length, 1);
  const missingTarget = fixture(ability);
  const orphaned = Engine.createGameEvent(missingTarget.state, { ...missingTarget.event, targetCardInstanceIds: ['missing-target'], eventId: undefined, sequence: undefined });
  assert.equal(Reducer.discoverAutoTriggers(missingTarget.state, [orphaned], Engine).queued.length, 0);
});

test('attack event identity and battle window must match the authoritative pending attack', () => {
  const ability = FAMILY[0];
  for (const tamper of [
    event => ({ ...event, battleId: 'other-battle' }),
    event => ({ ...event, targetCardInstanceIds: ['other-target'] }),
    event => ({ ...event, targetLocation: 'rear-guard' }),
    event => ({ ...event, timingWindow: 'attack-step-start' }),
    event => ({ ...event, phase: 'main' }),
    event => ({ ...event, actingPlayerId: 'opponent-player', turnPlayerId: 'opponent-player' })
  ]) {
    const f = fixture(ability);
    const event = Engine.createGameEvent(f.state, { ...tamper(f.event), eventId: undefined, sequence: undefined });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0);
  }
});

test('same attack event replay cannot enqueue or resolve the power twice', () => {
  const f = fixture(FAMILY[0]);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(resolve(f).ok, true);
  const before = JSON.stringify(f.state);
  const duplicate = resolve(f, { actionId: 'duplicate-resolution' });
  assert.equal(duplicate.ok, false);
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(f.state.pendingAttack.power, 15000);
});

test('a battle-only bonus is gone when the authoritative battle closes', () => {
  const f = fixture(FAMILY[0], 'human', { targetGrade: 3, targetZone: 'rear-left' });
  f.state.pendingAttack.targetPower = 50000;
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  assert.equal(f.state.pendingAttack.power, 15000);
  f.state.pendingAttack.defenderDone = true;
  const result = Reducer.applyGameAction(f.state, {
    actorAuthUid: SEATS.hostAuthUid, actionId: 'close-test-battle', expectedStateVersion: f.state.stateVersion,
    payload: { action: 'resolveBattle' }
  }, SEATS, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.pendingAttack, null);
  assert.equal(f.source.battlePowerBoost || 0, 0);
  assert.equal(f.source.turnPowerBoost || 0, 0);
});

test('tampered trusted definitions are not accepted for this exact family', () => {
  const original = FAMILY[0];
  const mutations = [
    ability => ({ ...ability, definition: { ...ability.definition, printedText: ability.definition.printedText.replace('+5000', '+4000') } }),
    ability => ({ ...ability, definition: { ...ability.definition, effects: [{ ...ability.definition.effects[0], amount: 4000 }] } }),
    ability => ({ ...ability, definition: { ...ability.definition, effects: [{ ...ability.definition.effects[0], duration: 'turn' }] } }),
    ability => ({ ...ability, definition: { ...ability.definition, effects: [{ ...ability.definition.effects[0], target: 'chosen' }] } }),
    ability => ({ ...ability, conditions: [{ type: 'attack-target-grade-at-least', count: 2 }] }),
    ability => ({ ...ability, trigger: { ...ability.trigger, circles: ['vanguard'] } }),
    ability => ({ ...ability, id: `${ability.cardId}:0` })
  ];
  for (const mutate of mutations) assert.equal(Reducer.supportsServerAbilityEffects(mutate(original)), false);
});
