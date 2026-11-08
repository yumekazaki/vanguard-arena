'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const CARD_ID = 'cfa-1612';
const ABILITY_ID = `${CARD_ID}:0`;
const PATTERN = 'auto-vanguard-own-rear-guard-third-battle-limit-break-power-critical-turn-v1';
const CATALOG = loadCatalog();
const CARDS = new Map(CATALOG.map(card => [String(card.id), card]));
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const CARD = CARDS.get(CARD_ID);
assert.ok(CARD, 'catalog contains Cobalt Wave Dragon');
const ABILITY = Engine.parseCardAbilitiesCached(CARD).find(item => item.id === ABILITY_ID);
assert.ok(ABILITY, 'Cobalt Wave Dragon has the Limit Break Rear-Guard attack AUTO');

function makeInstance(cardId, uid, playerId, extra = {}) {
  const card = CARDS.get(String(cardId));
  return {
    uid, cardId: String(cardId), cardName: card?.name, type: card?.type || 'Unit',
    grade: Number(card?.grade), clan: card?.clan, clans: card?.clans || [],
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true,
    power: Number(card?.power) || 10000, critical: 1, ...extra
  };
}

function fixture(side = 'human', { priorAttacks = 2, damageCount = 4, targetZone = 'vanguard' } = {}) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human';
  const otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = makeInstance(CARD_ID, `cobalt-${side}`, ownerId);
  const attacker = makeInstance('cfa-679', `attacker-${side}`, ownerId);
  const targetVanguard = makeInstance('cfa-696', `target-${side}`, otherId);
  const own = { playerId: ownerId, vanguard: source, rear: [attacker, null, null, null, null], soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: targetVanguard, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  if (targetZone === 'rear-guard') opponent.rear[0] = makeInstance('cfa-679', `target-rear-${side}`, otherId);
  const target = targetZone === 'vanguard' ? targetVanguard : opponent.rear[0];
  for (let index = 0; index < damageCount; index++) own.damage.push({ uid: `damage-${side}-${index}`, cardId: 'cfa-3', ownerPlayerId: ownerId, controllerPlayerId: ownerId, faceDown: false });
  const state = {
    matchId: `cobalt-lb-${side}-${priorAttacks}-${damageCount}-${targetZone}`, stateVersion: 1, turn: 5, phase: 5, side,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null,
    players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own }
  };
  for (let index = 0; index < priorAttacks; index++) Engine.recordAttackCount(state, ownerId, `prior-attack-${side}-${index}`);
  Engine.recordAttackCount(state, ownerId, attacker.uid);
  const battleId = `battle-lb-${side}-${priorAttacks}-${targetZone}`;
  state.pendingAttack = {
    battleId, attackerSide: side, attackerUid: attacker.uid, attackerPlayerId: ownerId, attackerZone: 'rear-guard',
    defenderSide: otherSide, targetUid: target.uid, targetZone, power: attacker.power,
    targetPower: target.power, critical: 1
  };
  const event = makeAttackEvent({ state, attacker, target, ownerId, battleId, targetZone });
  return { state, event, source, attacker, target, own, opponent, side, ownerId, otherSide, otherId };
}

function makeAttackEvent({ state, attacker, target, ownerId, battleId = state.pendingAttack.battleId, sourceZone = 'rear-guard', targetZone = 'vanguard' }) {
  return Engine.createGameEvent(state, {
    type: 'unit.attacked', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId, sourceControllerPlayerId: attacker.controllerPlayerId,
    cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid,
    subjectOwnerPlayerId: attacker.ownerPlayerId, subjectControllerPlayerId: attacker.controllerPlayerId,
    attackingCardInstanceIds: [attacker.uid], previousLocation: sourceZone, currentLocation: sourceZone,
    targetCardInstanceIds: [target.uid], targetLocation: targetZone, battleId,
    phase: 'battle', timingWindow: 'attack-declared'
  });
}

function resolve(f, actorAuthUid = f.side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-${f.source.uid}-${f.state.pendingAttack?.battleId || f.state.stateVersion}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.source.uid, abilityId: ABILITY_ID } }
  }, SEATS, Engine);
}

test('Cobalt Wave preserves the exact Limit Break and third-or-later own Rear-Guard attack requirements', () => {
  assert.equal(ABILITY.id, 'cfa-1612:0');
  assert.equal(CARD.name, 'Cobalt Wave Dragon');
  assert.match(CARD.text, /Limit Break 4[\s\S]*When one of your rear-guards attacks a vanguard, if it is the third battle of that turn or more/);
  assert.equal(ABILITY.definition?.source?.patternId, PATTERN);
  assert.equal(ABILITY.definition?.source?.officialTextVerified, true);
  assert.ok(Engine.getReviewedAbilityDefinitionsForCard(CARD_ID).some(definition => definition.id === ABILITY_ID));
  assert.deepEqual(ABILITY.requiredLocation, ['vanguard']);
  assert.equal(ABILITY.trigger?.eventType, 'unit.attacked');
  assert.equal(ABILITY.trigger?.subject, 'any');
  assert.deepEqual(ABILITY.conditions, [
    { type: 'limit-break-active', count: 4 },
    { type: 'total-attack-count-this-turn-at-least', count: 3 }
  ]);
  assert.deepEqual(ABILITY.definition.effects, [
    { op: 'modify-power', target: 'source', amount: 2000, duration: 'turn' },
    { op: 'modify-critical', target: 'source', amount: 1, duration: 'turn' }
  ]);
  assert.equal(Reducer.supportsServerAbilityEffects(ABILITY), true);
});

test('a third-or-later friendly Rear-Guard attack gives the exact Vanguard both turn modifiers for either seat', () => {
  for (const side of ['human', 'bot']) for (const priorAttacks of [2, 3]) {
    const f = fixture(side, { priorAttacks });
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}, battle ${priorAttacks + 1}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}, battle ${priorAttacks + 1}: ${result.reason}`);
    assert.equal(f.source.turnPowerBoost, 2000);
    assert.equal(f.source.turnCriticalBoost, 1);
    assert.equal(f.source.turnPowerExpiry, f.ownerId);
    assert.equal(f.source.turnCriticalExpiry, f.ownerId);
  }
});

test('each qualifying Rear-Guard attack triggers again because the AUTO has no once-per-turn limit', () => {
  const f = fixture('human');
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 2000);
  assert.equal(f.source.turnCriticalBoost, 1);

  const secondAttacker = makeInstance('cfa-679', 'second-own-rear-guard', f.ownerId);
  f.own.rear[1] = secondAttacker;
  Engine.recordAttackCount(f.state, f.ownerId, secondAttacker.uid);
  const secondBattleId = `${f.state.matchId}:second-attack`;
  f.state.pendingAttack = {
    battleId: secondBattleId, attackerSide: f.side, attackerUid: secondAttacker.uid,
    attackerPlayerId: f.ownerId, attackerZone: 'rear-guard', defenderSide: f.otherSide,
    targetUid: f.target.uid, targetZone: 'vanguard', power: secondAttacker.power,
    targetPower: f.target.power, critical: 1
  };
  const secondEvent = makeAttackEvent({ state: f.state, attacker: secondAttacker, target: f.target, ownerId: f.ownerId, battleId: secondBattleId });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [secondEvent], Engine).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 4000);
  assert.equal(f.source.turnCriticalBoost, 2);
});

test('the second battle, insufficient damage, own-Vanguard attacks, and Rear-Guard targets do not trigger it', () => {
  const secondBattle = fixture('human', { priorAttacks: 1 });
  assert.equal(Reducer.discoverAutoTriggers(secondBattle.state, [secondBattle.event], Engine).queued.length, 0);

  const limitBreakInactive = fixture('human', { damageCount: 3 });
  assert.equal(Reducer.discoverAutoTriggers(limitBreakInactive.state, [limitBreakInactive.event], Engine).queued.length, 0);

  const rearGuardTarget = fixture('human', { targetZone: 'rear-guard' });
  assert.equal(Reducer.discoverAutoTriggers(rearGuardTarget.state, [rearGuardTarget.event], Engine).queued.length, 0);

  const vanguardAttack = fixture('human');
  vanguardAttack.state.players[vanguardAttack.side].rear[0] = null;
  const vanguard = makeInstance('cfa-696', 'own-vanguard-attacker', vanguardAttack.ownerId);
  vanguardAttack.state.players[vanguardAttack.side].vanguard = vanguardAttack.source;
  vanguardAttack.state.pendingAttack.attackerUid = vanguard.uid;
  vanguardAttack.state.pendingAttack.attackerZone = 'vanguard';
  vanguardAttack.state.pendingAttack.targetUid = vanguardAttack.target.uid;
  vanguardAttack.state.pendingAttack.targetZone = 'vanguard';
  vanguardAttack.event = makeAttackEvent({ ...vanguardAttack, attacker: vanguard, target: vanguardAttack.target, sourceZone: 'vanguard' });
  assert.equal(Reducer.discoverAutoTriggers(vanguardAttack.state, [vanguardAttack.event], Engine).queued.length, 0);
});

test('stale Limit Break and duplicate attack events cannot partially or repeatedly apply the modifiers', () => {
  const stale = fixture('human');
  assert.equal(Reducer.discoverAutoTriggers(stale.state, [stale.event], Engine).queued.length, 1);
  stale.own.damage.pop();
  const before = JSON.stringify({ power: stale.source.turnPowerBoost, critical: stale.source.turnCriticalBoost });
  assert.equal(resolve(stale).ok, false);
  assert.equal(JSON.stringify({ power: stale.source.turnPowerBoost, critical: stale.source.turnCriticalBoost }), before);

  const duplicate = fixture('bot');
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 0);
  assert.equal(resolve(duplicate).ok, true);
  assert.equal(duplicate.source.turnPowerBoost, 2000);
  assert.equal(duplicate.source.turnCriticalBoost, 1);
});
