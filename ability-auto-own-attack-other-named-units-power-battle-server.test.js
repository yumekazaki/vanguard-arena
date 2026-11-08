'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const CARD_ID = 'cfa-2149';
const PATTERN = 'auto-own-attack-other-named-units-power-battle-v1';
const OTHER_SEEKERS = ['cfa-1938', 'cfa-1940', 'cfa-1942', 'cfa-1943'];
const CATALOG = loadCatalog();
const CARDS = new Map(CATALOG.map(card => [String(card.id), card]));
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const CARD = CARDS.get(CARD_ID);
assert.ok(CARD, 'catalog contains Heaven Arrow Seeker, Lunate');
const ABILITY = Engine.parseCardAbilitiesCached(CARD).find(item => item.id === `${CARD_ID}:0`);
assert.ok(ABILITY, 'Lunate AUTO exists');

function makeInstance(cardId, uid, playerId, extra = {}) {
  const card = CARDS.get(String(cardId));
  return {
    uid, cardId: String(cardId), cardName: card?.name, type: card?.type || 'Unit',
    grade: Number(card?.grade), clan: card?.clan, clans: card?.clans || [],
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 7000, ...extra
  };
}

function fixture(side = 'human', { zone = 'rear-guard', otherCount = 4, lockedOther = -1, targetZone = 'vanguard' } = {}) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human';
  const otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = makeInstance(CARD_ID, `lunate-${side}-${zone}`, ownerId);
  const target = makeInstance('cfa-696', `target-${side}-${zone}`, otherId);
  const own = { playerId: ownerId, vanguard: null, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: target, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  if (zone === 'vanguard') own.vanguard = source;
  else own.rear[0] = source;
  const count = Math.max(0, Math.min(otherCount, OTHER_SEEKERS.length));
  for (let index = 0; index < count; index++) {
    const seeker = makeInstance(OTHER_SEEKERS[index], `other-seeker-${side}-${index}`, ownerId);
    if (zone === 'vanguard') own.rear[index] = seeker;
    else if (index === 0) own.vanguard = seeker;
    else own.rear[index] = seeker;
    if (index === lockedOther) seeker.locked = true;
  }
  const state = {
    matchId: `lunate-${side}-${zone}-${otherCount}-${targetZone}`, stateVersion: 1, turn: 2, phase: 5, side,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null,
    players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: {
      battleId: `battle-${side}-${zone}-${targetZone}`, attackerSide: side, attackerUid: source.uid,
      attackerPlayerId: ownerId, attackerZone: zone, defenderSide: otherSide,
      targetUid: target.uid, targetZone, power: 7000, targetPower: 13000, critical: 1
    }
  };
  const event = Engine.createGameEvent(state, {
    type: 'unit.attacked', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [source.uid], previousLocation: zone, currentLocation: zone,
    targetCardInstanceIds: [target.uid], targetLocation: targetZone, battleId: state.pendingAttack.battleId,
    phase: 'battle', timingWindow: 'attack-declared'
  });
  return { state, event, source, target, own, opponent, side, ownerId };
}

function resolve(f, actorAuthUid = f.side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId: ABILITY.id } }
  }, SEATS, Engine);
}

test('Lunate uses the official vanguard-attack wording and an exact four-other-Seeker condition', () => {
  assert.equal(CARD.name, 'Heaven Arrow Seeker, Lunate');
  assert.match(CARD.text, /When this unit attacks a vanguard, if the number of other units you have with "Seeker" in its card name is four or more/);
  assert.equal(ABILITY.definition?.source?.patternId, PATTERN);
  assert.equal(ABILITY.definition?.source?.officialTextVerified, true);
  assert.ok(Engine.getReviewedAbilityDefinitionsForCard(CARD_ID).some(definition => definition.id === ABILITY.id));
  assert.deepEqual(ABILITY.requiredLocation, ['vanguard', 'rear-guard']);
  assert.equal(ABILITY.trigger?.eventType, 'unit.attacked');
  assert.equal(ABILITY.trigger?.subject, 'source');
  assert.equal(ABILITY.trigger?.targetLocation, 'vanguard');
  assert.deepEqual(ABILITY.conditions, [{ type: 'controller-field-other-card-name-contains-count-at-least', name: 'Seeker', count: 4 }]);
  assert.deepEqual(ABILITY.definition.effects, [{ op: 'modify-power', target: 'source', amount: 3000, duration: 'battle' }]);
  assert.equal(Reducer.supportsServerAbilityEffects(ABILITY), true);
});

test('the exact attacking Lunate gains battle power for either player from VC or RC', () => {
  for (const side of ['human', 'bot']) for (const zone of ['rear-guard', 'vanguard']) {
    const f = fixture(side, { zone });
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}/${zone}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}/${zone}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, 10000);
  }
});

test('four other matching units are required; the source and locked units do not count', () => {
  const threeOthers = fixture('human', { otherCount: 3 });
  assert.equal(Reducer.discoverAutoTriggers(threeOthers.state, [threeOthers.event], Engine).queued.length, 0);

  const sourceCannotCount = fixture('human', { otherCount: 0, zone: 'vanguard' });
  sourceCannotCount.own.rear[0] = makeInstance(CARD_ID, 'another-lunate', sourceCannotCount.ownerId);
  sourceCannotCount.own.rear[1] = makeInstance(CARD_ID, 'third-lunate', sourceCannotCount.ownerId);
  sourceCannotCount.own.rear[2] = makeInstance(CARD_ID, 'fourth-lunate', sourceCannotCount.ownerId);
  assert.equal(Reducer.discoverAutoTriggers(sourceCannotCount.state, [sourceCannotCount.event], Engine).queued.length, 0);

  const locked = fixture('human', { lockedOther: 3 });
  assert.equal(Reducer.discoverAutoTriggers(locked.state, [locked.event], Engine).queued.length, 0);
});

test('a rear-guard attack does not trigger it; unrelated sources and stale conditions are rejected', () => {
  const rearGuardTarget = fixture('human', { targetZone: 'rear-guard' });
  assert.equal(Reducer.discoverAutoTriggers(rearGuardTarget.state, [rearGuardTarget.event], Engine).queued.length, 0);

  const wrongSource = fixture('human');
  const forged = Engine.createGameEvent(wrongSource.state, {
    ...wrongSource.event, eventId: undefined, sequence: undefined,
    sourceCardInstanceId: 'different-lunate-copy', cardInstanceId: 'different-lunate-copy', subjectCardInstanceId: 'different-lunate-copy'
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [forged], Engine).queued.length, 0);

  const stale = fixture('human');
  assert.equal(Reducer.discoverAutoTriggers(stale.state, [stale.event], Engine).queued.length, 1);
  stale.own.rear[3] = null;
  const before = JSON.stringify(stale.state);
  assert.equal(resolve(stale).ok, false);
  assert.equal(JSON.stringify(stale.state), before);

  const duplicate = fixture('human');
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 0);
  assert.equal(resolve(duplicate).ok, true);
  assert.equal(duplicate.state.pendingAttack.power, 10000);
});
