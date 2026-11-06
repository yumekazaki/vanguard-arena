'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const PATTERN = 'auto-boosted-clan-vanguard-hit-return-source-hand-v1';
const FAMILIES = [
  { source: 'cfa-403', clan: 'Oracle Think Tank' },
  { source: 'cfa-710', clan: 'Angel Feather' },
  { source: 'cfa-940', clan: 'Aqua Force' }
];
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const cardForClan = clan => [...catalog.values()].find(card => String(card.clan || '').toLowerCase() === clan.toLowerCase() && card.type === 'Unit');

function instance(cardId, uid, playerId, changes = {}) {
  const card = catalog.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name, type: card?.type || 'Unit', grade: Number(card?.grade), clan: card?.clan,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 16000, critical: 1, rested: false, ...changes };
}

function fixture(family, side) {
  const otherSide = side === 'human' ? 'bot' : 'human';
  const ownerId = side === 'human' ? 'host-player' : 'guest-player';
  const otherId = otherSide === 'human' ? 'host-player' : 'guest-player';
  const attackerCard = cardForClan(family.clan);
  assert.ok(attackerCard, `catalog has a ${family.clan} unit`);
  const attacker = instance(attackerCard.id, `attacker-${side}-${family.source}`, ownerId, { grade: 2, power: 20000 });
  const booster = instance(family.source, `booster-${side}-${family.source}`, ownerId, { boostAbility: true });
  const defender = instance('cfa-3', `defender-${side}-${family.source}`, otherId, { grade: 3, power: 10000 });
  const player = id => ({ playerId: id, vanguard: null, rear: [], soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [], removed: [] });
  const players = { human: player('host-player'), bot: player('guest-player') };
  players[side].rear = [attacker, null, booster, null, null];
  players[otherSide].vanguard = defender;
  const state = { matchId: `boosted-clan-return-${side}-${family.source}`, stateVersion: 1, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], eventSequence: 0,
    authoritySeats: { hostSide: 'human', guestSide: 'bot' }, side, turn: 2, phase: 5, players, pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null };
  return { state, attacker, booster, defender, side, otherSide, ownerId, otherId };
}

function action(f, actorSide, actionId, payload) {
  const actorAuthUid = actorSide === 'human' ? seats.hostAuthUid : seats.guestAuthUid;
  return Reducer.applyGameAction(f.state, { actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'game-action', ...payload } }, seats, Engine);
}

function playBoostedHit(f) {
  const attack = action(f, f.side, `attack-${f.side}-${f.state.matchId}`, { action: 'attack', attackerCardInstanceId: f.attacker.uid, targetCardInstanceId: f.defender.uid, boosterCardInstanceId: f.booster.uid });
  assert.equal(attack.ok, true, attack.reason);
  const noGuard = action(f, f.otherSide, `no-guard-${f.otherSide}-${f.state.matchId}`, { action: 'noGuard' });
  assert.equal(noGuard.ok, true, noGuard.reason);
  const hit = action(f, f.side, `resolve-hit-${f.side}-${f.state.matchId}`, { action: 'resolveBattle' });
  assert.equal(hit.ok, true, hit.reason);
  return hit;
}

const abilities = FAMILIES.flatMap(family => Engine.parseCardAbilitiesCached(catalog.get(family.source) || {}).filter(ability => ability.definition?.source?.patternId === PATTERN));

test('the article variants compile into the same exact-clan boosted-hit return ability', () => {
  assert.equal(abilities.length, FAMILIES.length);
  for (const family of FAMILIES) {
    const ability = abilities.find(item => item.cardId === family.source);
    assert.ok(ability, family.source);
    assert.equal(ability.trigger.eventType, 'attack.hit');
    assert.equal(ability.trigger.subject, 'booster');
    assert.equal(ability.trigger.targetLocation, 'vanguard');
    assert.equal(ability.trigger.requiresBoostedBattle, true);
    assert.equal(ability.trigger.boostedUnitClan, family.clan);
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.equal(ability.canDecline, true);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test('the host and joining player each resolve their own optional ability and return the exact booster to hand', () => {
  for (const family of FAMILIES) for (const side of ['human', 'bot']) {
    const f = fixture(family, side), hit = playBoostedHit(f), event = hit.events.find(item => item.type === 'attack.hit');
    assert.ok(event, `${family.source}/${side} emitted attack.hit`);
    assert.equal(event.boosterCardInstanceId, f.booster.uid, JSON.stringify({ event, pending: f.state.pendingAbility }));
    assert.equal(event.boostedCardInstanceId, f.attacker.uid);
    assert.equal(f.state.pendingAbility?.instance?.uid, f.booster.uid, JSON.stringify({ event, pendingAbility: f.state.pendingAbility, pendingAbilities: f.state.pendingAbilities }));
    assert.equal(f.state.pendingAbility?.side, side);
    assert.equal(f.state.pendingAbility?.triggerControllerPlayerId, f.ownerId);
    const ability = abilities.find(item => item.cardId === family.source);
    const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: side === 'human' ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `resolve-return-${side}-${family.source}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.booster.uid, abilityId: ability.id } } }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.players[side].rear.some(card => card?.uid === f.booster.uid), false);
    assert.ok(f.state.players[side].hand.some(card => card.uid === f.booster.uid));
    assert.equal(f.state.players[f.otherSide].hand.some(card => card.uid === f.booster.uid), false);
    assert.equal(f.state.pendingAbility, null);
  }
});

test('declining the optional effect clears it without moving the booster', () => {
  const family = FAMILIES[0], f = fixture(family, 'bot'), hit = playBoostedHit(f);
  assert.ok(hit.events.some(item => item.type === 'attack.hit'));
  const ability = abilities.find(item => item.cardId === family.source);
  const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: seats.guestAuthUid, actionId: 'decline-oracle-booster-return', expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept: false, selection: { instanceUid: f.booster.uid, abilityId: ability.id } } }, seats, Engine);
  assert.equal(result.ok, true, `${result.reason}: ${JSON.stringify(f.state.pendingAbility)}`);
  assert.ok(f.state.players.bot.rear.some(card => card?.uid === f.booster.uid));
  assert.equal(f.state.players.bot.hand.some(card => card.uid === f.booster.uid), false);
  assert.equal(f.state.pendingAbility, null);
});
