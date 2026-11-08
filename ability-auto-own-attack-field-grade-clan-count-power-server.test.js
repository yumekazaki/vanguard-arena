'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const PATTERN = 'auto-own-attack-field-grade-clan-count-power-battle-v1';
const IDS = ['cfa-679', 'cfa-696'];
const CATALOG = loadCatalog();
const CARDS = new Map(CATALOG.map(card => [String(card.id), card]));
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const ABILITIES = IDS.map(cardId => {
  const card = CARDS.get(cardId);
  assert.ok(card, `catalog contains ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 exists`);
  return ability;
});

function makeInstance(cardId, uid, playerId, extra = {}) {
  const card = CARDS.get(String(cardId));
  return {
    uid, cardId: String(cardId), cardName: card?.name, type: card?.type || 'Unit',
    grade: Number(card?.grade), clan: card?.clan, clans: card?.clans || [],
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 10000, ...extra
  };
}

function fixture(ability, side = 'human', { zone = 'rear-guard', qualifyingUnits = true } = {}) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human';
  const otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = makeInstance(ability.cardId, `source-${ability.cardId}-${side}-${zone}`, ownerId);
  const target = makeInstance('cfa-696', `opponent-target-${ability.cardId}-${side}`, otherId);
  const own = { playerId: ownerId, vanguard: null, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: target, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  if (zone === 'vanguard') own.vanguard = source;
  else own.rear[0] = source;
  if (qualifyingUnits) {
    if (zone === 'vanguard') {
      own.rear[0] = makeInstance('cfa-696', `qualifying-rear-${side}`, ownerId);
      if (Number(source.grade) !== 3) own.rear[1] = makeInstance('cfa-696', `qualifying-rear-extra-${side}`, ownerId);
    }
    else {
      own.vanguard = makeInstance('cfa-696', `qualifying-vanguard-${side}`, ownerId);
      own.rear[1] = makeInstance('cfa-696', `qualifying-rear-${side}`, ownerId);
    }
  } else if (zone === 'rear-guard') {
    own.vanguard = makeInstance('cfa-679', `nonqualifying-vanguard-${side}`, ownerId);
    own.rear[1] = makeInstance('cfa-679', `nonqualifying-rear-${side}`, ownerId);
  } else {
    own.rear[0] = makeInstance('cfa-679', `nonqualifying-rear-${side}`, ownerId);
  }
  const state = {
    matchId: `palamedes-${ability.id}-${side}-${zone}`, stateVersion: 1, turn: 3, phase: 5, side,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null,
    players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: {
      battleId: `battle-${ability.id}-${side}-${zone}`, attackerSide: side, attackerUid: source.uid,
      attackerPlayerId: ownerId, attackerZone: zone, defenderSide: otherSide,
      targetUid: target.uid, targetZone: 'vanguard', power: 10000, targetPower: 13000, critical: 1
    }
  };
  const event = Engine.createGameEvent(state, {
    type: 'unit.attacked', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [source.uid], previousLocation: zone, currentLocation: zone,
    targetCardInstanceIds: [target.uid], targetLocation: 'vanguard', battleId: state.pendingAttack.battleId,
    phase: 'battle', timingWindow: 'attack-declared'
  });
  return { state, event, source, target, own, opponent, side, ownerId, otherId, otherSide };
}

function resolve(f, ability, actorAuthUid = f.side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id } }
  }, SEATS, Engine);
}

test('the two Palamedes abilities retain their exact source, circle, field-count condition, and battle power', () => {
  assert.equal(ABILITIES.length, 2);
  for (const ability of ABILITIES) {
    assert.equal(ability.definition?.source?.patternId, PATTERN, ability.id);
    assert.equal(ability.definition?.source?.officialTextVerified, true, ability.id);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(definition => definition.id === ability.id), ability.id);
    assert.deepEqual(ability.requiredLocation, ['vanguard', 'rear-guard']);
    assert.equal(ability.trigger?.eventType, 'unit.attacked');
    assert.equal(ability.trigger?.subject, 'source');
    assert.deepEqual(ability.conditions, [{ type: 'controller-field-grade-clan-count-at-least', grade: 3, clan: 'Royal Paladin', count: 2 }]);
    assert.deepEqual(ability.definition.effects, [{ op: 'modify-power', target: 'source', amount: 3000, duration: 'battle' }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});

test('the exact attacker gains power for either player when their live grade 3 Royal Paladin count qualifies', () => {
  for (const ability of ABILITIES) for (const side of ['human', 'bot']) for (const zone of ['rear-guard', 'vanguard']) {
    const f = fixture(ability, side, { zone });
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${ability.id}/${side}/${zone}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f, ability);
    assert.equal(result.ok, true, `${ability.id}/${side}/${zone}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, 13000);
  }
});

test('the grade 2 source is excluded from the count, while the attacking grade 3 Palamedes counts itself', () => {
  const grade2 = ABILITIES.find(ability => ability.cardId === 'cfa-679');
  const grade3 = ABILITIES.find(ability => ability.cardId === 'cfa-696');
  const noSelfCount = fixture(grade2, 'human', { qualifyingUnits: false });
  noSelfCount.own.vanguard = makeInstance('cfa-696', 'only-grade-three-palamedes', noSelfCount.ownerId);
  const skipped = Reducer.discoverAutoTriggers(noSelfCount.state, [noSelfCount.event], Engine);
  assert.equal(skipped.queued.length, 0);
  assert.equal(noSelfCount.state.pendingAbilities.length, 0);

  const lockedIsNotAUnit = fixture(grade2, 'human');
  lockedIsNotAUnit.own.rear[1].locked = true;
  assert.equal(Reducer.discoverAutoTriggers(lockedIsNotAUnit.state, [lockedIsNotAUnit.event], Engine).queued.length, 0);

  const selfCounts = fixture(grade3, 'human', { zone: 'rear-guard', qualifyingUnits: false });
  selfCounts.own.vanguard = makeInstance('cfa-679', 'grade-two-vanguard', selfCounts.ownerId);
  selfCounts.own.rear[1] = makeInstance('cfa-696', 'other-grade-three-palamedes', selfCounts.ownerId);
  const queued = Reducer.discoverAutoTriggers(selfCounts.state, [selfCounts.event], Engine);
  assert.equal(queued.queued.length, 1);
  assert.equal(resolve(selfCounts, grade3).ok, true);
  assert.equal(selfCounts.state.pendingAttack.power, 13000);
});

test('the attack trigger rejects unrelated attackers, wrong circles, wrong targets, stale conditions, and duplicate events', () => {
  const ability = ABILITIES[0];
  const otherAttacker = fixture(ability);
  const forgedSourceEvent = Engine.createGameEvent(otherAttacker.state, {
    ...otherAttacker.event, eventId: undefined, sequence: undefined,
    sourceCardInstanceId: 'different-card-copy', cardInstanceId: 'different-card-copy', subjectCardInstanceId: 'different-card-copy'
  });
  assert.equal(Reducer.discoverAutoTriggers(otherAttacker.state, [forgedSourceEvent], Engine).queued.length, 0);

  const wrongCircle = fixture(ability);
  const forgedCircleEvent = Engine.createGameEvent(wrongCircle.state, {
    ...wrongCircle.event, eventId: undefined, sequence: undefined, previousLocation: 'hand', currentLocation: 'vanguard'
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [forgedCircleEvent], Engine).queued.length, 0);

  const wrongTarget = fixture(ability);
  const forgedTargetEvent = Engine.createGameEvent(wrongTarget.state, {
    ...wrongTarget.event, eventId: undefined, sequence: undefined,
    targetCardInstanceIds: ['friendly-target'], targetLocation: 'rear-guard'
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [forgedTargetEvent], Engine).queued.length, 0);

  const stale = fixture(ability);
  assert.equal(Reducer.discoverAutoTriggers(stale.state, [stale.event], Engine).queued.length, 1);
  stale.own.rear[1] = null;
  stale.own.vanguard = makeInstance('cfa-679', 'grade-two-replacement', stale.ownerId);
  const before = JSON.stringify(stale.state);
  assert.equal(resolve(stale, ability).ok, false);
  assert.equal(JSON.stringify(stale.state), before);

  const duplicate = fixture(ability);
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 0);
  assert.equal(resolve(duplicate, ability).ok, true);
  assert.equal(duplicate.state.pendingAttack.power, 13000);
});
