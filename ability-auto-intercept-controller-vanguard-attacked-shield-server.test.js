'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const IDS = [['cfa-4353', 1], ['cfa-4483', 2], ['cfa-4534', 1], ['cfa-5184', 1]];
const TEXT = "AUTO: When this unit intercepts during the battle that your vanguard was attacked, this unit gets shield +5000 until end of that battle.";
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
function instance(id, uid, playerId, extra = {}) {
  const definition = cards.get(String(id));
  return { uid, cardId: String(id), cardName: definition?.name, type: definition?.type || 'Unit', grade: Number(definition?.grade ?? 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture(cardId, abilityIndex, side = 'human') {
  const opponentSide = side === 'human' ? 'bot' : 'human';
  const playerId = side === 'human' ? 'player-host' : 'player-guest';
  const opponentId = side === 'human' ? 'player-guest' : 'player-host';
  const source = instance(cardId, `guard-${side}-${cardId}`, playerId, { zone: 'guardian', circle: 'guardian' });
  const vanguard = instance('cfa-3', `vg-${side}-${cardId}`, playerId, { grade: 3 });
  const attacker = instance('cfa-3', `attacker-${side}-${cardId}`, opponentId, { grade: 3 });
  const owner = { playerId, vanguard, rear: Array(5).fill(null), hand: [], soul: [], damage: [], deck: [], drop: [], bind: [], orders: [], guardCircle: [source], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: attacker, rear: Array(5).fill(null), hand: [], soul: [], damage: [], deck: [], drop: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: `intercept-vg-${side}-${cardId}`, stateVersion: 1, turn: 2, side: opponentSide, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], players: { [side]: owner, [opponentSide]: opponent }, pendingAttack: { battleId: `battle-${side}-${cardId}`, attackerSide: opponentSide, attackerUid: attacker.uid, attackerZone: 'vanguard', defenderSide: side, targetUid: vanguard.uid, targetZone: 'vanguard', guardCards: [source], power: 18000, targetPower: 10000, critical: 1 } };
  const ability = Engine.parseCardAbilitiesCached(cards.get(cardId)).find(item => item.id === `${cardId}:${abilityIndex}`);
  assert.ok(ability, `${cardId}:${abilityIndex}`);
  const event = Engine.createGameEvent(state, { type: 'card.placed', actingPlayerId: playerId, turnPlayerId: opponentId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId, previousLocation: 'rear-right', currentLocation: 'guardian', circle: 'guardian', targetCardInstanceIds: [vanguard.uid], targetLocation: 'vanguard', phase: 'battle', timingWindow: 'intercept', battleId: state.pendingAttack.battleId });
  return { state, source, owner, opponent, ability, event, side };
}
function resolve(f, actionId, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test('all four attacked-Vanguard Intercept abilities have exact trusted definitions', () => {
  for (const [id, index] of IDS) {
    const f = fixture(id, index);
    assert.equal(f.ability.printedText, TEXT);
    assert.deepEqual(f.ability.conditions, [{ type: 'controller-vanguard-is-attacked-unit' }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: 'modify-shield-source', target: 'source', amount: 5000, duration: 'battle' }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, f.ability.id);
    const tampered = structuredClone(f.ability); tampered.definition.effects[0].amount = 10000;
    assert.equal(Reducer.supportsServerAbilityEffects(tampered), false, f.ability.id);
  }
});

test('host and joining player each receive and resolve only their own Intercept shield', () => {
  for (const [id, index] of IDS) for (const side of ['human', 'bot']) {
    const f = fixture(id, index, side);
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1, `${id}/${side}: ${JSON.stringify(found.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f, `resolve-${side}-${id}`);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.source.battleShieldBoost, 5000);
    assert.equal(f.source.battleShieldExpiryBattleId, f.state.pendingAttack.battleId);
    assert.equal(f.opponent.pendingAttack, undefined);
  }
});

test('a Rear-Guard attack, wrong intercepted card, duplicate event, and opponent proxy cannot grant shield', () => {
  for (const [id, index] of IDS) {
    const wrongTarget = fixture(id, index);
    wrongTarget.state.pendingAttack.targetZone = 'rear-guard';
    wrongTarget.state.pendingAttack.targetUid = 'other-rear';
    assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine).queued.length, 0);
    const wrongCard = fixture(id, index);
    assert.equal(Reducer.discoverAutoTriggers(wrongCard.state, [{ ...wrongCard.event, eventId: `other-${id}`, cardInstanceId: 'other', subjectCardInstanceId: 'other', sourceCardInstanceId: 'other' }], Engine).queued.length, 0);
    const f = fixture(id, index, 'bot');
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
    const before = JSON.stringify(f.state);
    assert.equal(resolve(f, `proxy-${id}`, seats.hostAuthUid).ok, false);
    assert.equal(JSON.stringify(f.state), before);
  }
});
