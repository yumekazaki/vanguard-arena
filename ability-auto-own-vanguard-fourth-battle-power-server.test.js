'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const CARD_ID = 'cfa-1612';
const ABILITY_ID = `${CARD_ID}:1`;
const PATTERN = 'auto-own-vanguard-attack-fourth-battle-power-v1';
const CATALOG = loadCatalog();
const CARDS = new Map(CATALOG.map(card => [String(card.id), card]));
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const CARD = CARDS.get(CARD_ID);
assert.ok(CARD, 'catalog contains Cobalt Wave Dragon');
const ABILITY = Engine.parseCardAbilitiesCached(CARD).find(item => item.id === ABILITY_ID);
assert.ok(ABILITY, 'Cobalt Wave Dragon has the fourth-battle AUTO');

function makeInstance(cardId, uid, playerId, extra = {}) {
  const card = CARDS.get(String(cardId));
  return {
    uid, cardId: String(cardId), cardName: card?.name, type: card?.type || 'Unit',
    grade: Number(card?.grade), clan: card?.clan, clans: card?.clans || [],
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true,
    power: Number(card?.power) || 10000, critical: 1, ...extra
  };
}

function fixture(side = 'human', { priorAttacks = 3, targetZone = 'vanguard' } = {}) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human';
  const otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = makeInstance(CARD_ID, `cobalt-${side}`, ownerId);
  const target = makeInstance('cfa-696', `target-${side}`, otherId);
  const own = { playerId: ownerId, vanguard: source, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: target, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  if (targetZone === 'rear-guard') opponent.rear[0] = makeInstance('cfa-679', `target-rear-${side}`, otherId);
  const targetInstance = targetZone === 'vanguard' ? target : opponent.rear[0];
  const state = {
    matchId: `cobalt-${side}-${priorAttacks}-${targetZone}`, stateVersion: 1, turn: 4, phase: 5, side,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null,
    players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own }
  };
  for (let index = 0; index < priorAttacks; index++) Engine.recordAttackCount(state, ownerId, `prior-attack-${side}-${index}`);
  Engine.recordAttackCount(state, ownerId, source.uid);
  const battleId = `battle-${side}-${priorAttacks}-${targetZone}`;
  state.pendingAttack = {
    battleId, attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownerId, attackerZone: 'vanguard',
    defenderSide: otherSide, targetUid: targetInstance.uid, targetZone, power: source.power,
    targetPower: targetInstance.power, critical: 1
  };
  const event = attackEvent({ state, source, target: targetInstance, ownerId, battleId, sourceZone: 'vanguard', targetZone });
  return { state, event, source, target: targetInstance, own, opponent, side, ownerId, otherSide, otherId };
}

function attackEvent({ state, source, target, ownerId, battleId = state.pendingAttack.battleId, sourceZone = 'vanguard', targetZone = 'vanguard' }) {
  return Engine.createGameEvent(state, {
    type: 'unit.attacked', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: source.ownerPlayerId, sourceControllerPlayerId: source.controllerPlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: source.ownerPlayerId, subjectControllerPlayerId: source.controllerPlayerId,
    attackingCardInstanceIds: [source.uid], previousLocation: sourceZone, currentLocation: sourceZone,
    targetCardInstanceIds: [target.uid], targetLocation: targetZone, battleId,
    phase: 'battle', timingWindow: 'attack-declared'
  });
}

function resolve(f, actorAuthUid = f.side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId: ABILITY_ID } }
  }, SEATS, Engine);
}

test('Cobalt Wave uses the official VC-only fourth-or-later battle wording', () => {
  assert.equal(ABILITY.id, 'cfa-1612:1');
  assert.equal(CARD.name, 'Cobalt Wave Dragon');
  assert.match(CARD.text, /AUTO \[VC\]: When this unit attacks a vanguard, if it is the fourth battle of that turn or more/);
  assert.equal(ABILITY.definition?.source?.patternId, PATTERN);
  assert.equal(ABILITY.definition?.source?.officialTextVerified, true);
  assert.ok(Engine.getReviewedAbilityDefinitionsForCard(CARD_ID).some(definition => definition.id === ABILITY_ID));
  assert.deepEqual(ABILITY.requiredLocation, ['vanguard']);
  assert.equal(ABILITY.trigger?.eventType, 'unit.attacked');
  assert.equal(ABILITY.trigger?.subject, 'source');
  assert.deepEqual(ABILITY.conditions, [{ type: 'total-attack-count-this-turn-at-least', count: 4 }]);
  assert.deepEqual(ABILITY.definition.effects, [{ op: 'modify-power', target: 'source', amount: 5000, duration: 'battle' }]);
  assert.equal(Reducer.supportsServerAbilityEffects(ABILITY), true);
});

test('the fourth battle is included and the correct host or joining player resolves the Vanguard power', () => {
  for (const side of ['human', 'bot']) for (const priorAttacks of [3, 4]) {
    const f = fixture(side, { priorAttacks });
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}, battle ${priorAttacks + 1}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}, battle ${priorAttacks + 1}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, f.source.power + 5000);
  }
});

test('the third battle, a Rear-Guard target, a Rear-Guard source, and another unit attacking do not trigger it', () => {
  const thirdBattle = fixture('human', { priorAttacks: 2 });
  assert.equal(Reducer.discoverAutoTriggers(thirdBattle.state, [thirdBattle.event], Engine).queued.length, 0);

  const rearGuardTarget = fixture('human', { targetZone: 'rear-guard' });
  assert.equal(Reducer.discoverAutoTriggers(rearGuardTarget.state, [rearGuardTarget.event], Engine).queued.length, 0);

  const rearGuardSource = fixture('human');
  rearGuardSource.own.vanguard = makeInstance('cfa-696', 'replacement-vanguard', rearGuardSource.ownerId);
  rearGuardSource.own.rear[0] = rearGuardSource.source;
  rearGuardSource.state.pendingAttack.attackerZone = 'rear-guard';
  rearGuardSource.state.pendingAttack.attackerUid = rearGuardSource.source.uid;
  rearGuardSource.event = attackEvent({ ...rearGuardSource, source: rearGuardSource.source, target: rearGuardSource.target, sourceZone: 'rear-guard' });
  assert.equal(Reducer.discoverAutoTriggers(rearGuardSource.state, [rearGuardSource.event], Engine).queued.length, 0);

  const otherAttacker = fixture('human');
  const other = makeInstance('cfa-679', 'different-attacker', otherAttacker.ownerId);
  otherAttacker.own.rear[0] = other;
  otherAttacker.state.pendingAttack.attackerUid = other.uid;
  otherAttacker.state.pendingAttack.attackerZone = 'rear-guard';
  otherAttacker.event = attackEvent({ ...otherAttacker, source: other, target: otherAttacker.target, sourceZone: 'rear-guard' });
  assert.equal(Reducer.discoverAutoTriggers(otherAttacker.state, [otherAttacker.event], Engine).queued.length, 0);
});

test('stale conditions and duplicate event delivery cannot apply the battle modifier twice', () => {
  const stale = fixture('human');
  assert.equal(Reducer.discoverAutoTriggers(stale.state, [stale.event], Engine).queued.length, 1);
  stale.state.attacksByPlayerTurn[`${stale.state.turn}:${stale.ownerId}`] = 3;
  const before = stale.state.pendingAttack.power;
  assert.equal(resolve(stale).ok, false);
  assert.equal(stale.state.pendingAttack.power, before);

  const duplicate = fixture('bot');
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 0);
  assert.equal(resolve(duplicate).ok, true);
  assert.equal(duplicate.state.pendingAttack.power, duplicate.source.power + 5000);
});
