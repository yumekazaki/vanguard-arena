'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const PATTERN = 'auto-boosted-clan-vanguard-hit-soul-charge-v1';
const FAMILIES = [
  { source: 'cfa-1353', clan: 'Genesis' },
  { source: 'cfa-454', clan: 'Dark Irregulars' },
  { source: 'cfa-788', clan: 'Pale Moon' }
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
  assert.ok(attackerCard, `catalog has a ${family.clan} Unit`);
  const attacker = instance(attackerCard.id, `attacker-${side}-${family.source}`, ownerId, { grade: 2, power: 20000 });
  const booster = instance(family.source, `booster-${side}-${family.source}`, ownerId, { boostAbility: true });
  const defender = instance('cfa-3', `defender-${side}-${family.source}`, otherId, { grade: 3, power: 10000 });
  const player = id => ({ playerId: id, vanguard: null, rear: [], soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], extra: [], removed: [] });
  const players = { human: player('host-player'), bot: player('guest-player') };
  players[side].rear = [attacker, null, booster, null, null];
  players[side].deck = [instance('cfa-4', `charge-${side}-${family.source}`, ownerId)];
  players[otherSide].vanguard = defender;
  const state = { matchId: `boosted-clan-hit-${side}-${family.source}`, stateVersion: 1, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], eventSequence: 0,
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

test('three clan-specific abilities preserve their distinct printed clan and optional Soul Charge', () => {
  assert.equal(abilities.length, 3);
  for (const family of FAMILIES) {
    const ability = abilities.find(item => item.cardId === family.source);
    assert.ok(ability);
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

test('a real reducer-generated boosted Vanguard hit prompts and resolves the booster controller for host and joining player', () => {
  for (const family of FAMILIES) for (const side of ['human', 'bot']) {
    const f = fixture(family, side), hit = playBoostedHit(f), event = hit.events.find(item => item.type === 'attack.hit');
    assert.ok(event, `${family.source}/${side} emitted attack.hit`);
    assert.equal(event.boosterCardInstanceId, f.booster.uid);
    assert.equal(event.boostedCardInstanceId, f.attacker.uid);
    assert.equal(event.attackingUnitInstanceId, f.attacker.uid);
    assert.equal(event.boostedCardClan, family.clan);
    assert.equal(f.state.pendingAbility?.instance?.uid, f.booster.uid);
    assert.equal(f.state.pendingAbility?.side, side);
    assert.equal(f.state.pendingAbility?.triggerControllerPlayerId, f.ownerId);
    const ability = abilities.find(item => item.cardId === family.source);
    const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: side === 'human' ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `resolve-soul-charge-${side}-${family.source}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: 'ability-response', accept: true, selection: { instanceUid: f.booster.uid, abilityId: ability.id } } }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.state.players[side].soul.map(card => card.uid), [`charge-${side}-${family.source}`]);
    assert.equal(f.state.players[f.otherSide].soul.length, 0);
  }
});

test('the player may decline and a different clan does not offer the ability', () => {
  const family = FAMILIES[0], ability = abilities.find(item => item.cardId === family.source), declined = fixture(family, 'bot');
  playBoostedHit(declined);
  const declineResult = Reducer.applyAbilityDecision(declined.state, { actorAuthUid: seats.guestAuthUid, actionId: 'decline-genesis-booster', expectedStateVersion: declined.state.stateVersion,
    payload: { type: 'ability-response', accept: false, selection: { instanceUid: declined.booster.uid, abilityId: ability.id } } }, seats, Engine);
  assert.equal(declineResult.ok, true, declineResult.reason);
  assert.equal(declined.state.players.bot.soul.length, 0);
  assert.equal(declined.state.pendingAbility, null);

  const wrongClan = fixture(family, 'bot');
  const nova = cardForClan('Nova Grappler');
  Object.assign(wrongClan.attacker, { cardId: nova.id, cardName: nova.name, clan: nova.clan });
  const wrongClanHit = playBoostedHit(wrongClan);
  assert.equal(wrongClanHit.events.find(event => event.type === 'attack.hit')?.boostedCardClan, 'Nova Grappler');
  assert.notEqual(wrongClan.state.pendingAbility?.instance?.uid, wrongClan.booster.uid);
});

test('existing boosted-hit Soul Charge and discard-draw handlers accept the reducer-generated attacker identity', () => {
  const cases = [
    { source: 'cfa-443', abilityId: 'cfa-443:0', side: 'human', effect: 'return-source' },
    { source: 'cfa-11589', abilityId: 'cfa-11589:1', side: 'bot', effect: 'discard-draw' }
  ];
  for (const item of cases) {
    const f = fixture({ source: item.source, clan: 'Genesis' }, item.side);
    const ability = Engine.parseCardAbilitiesCached(catalog.get(item.source)).find(candidate => candidate.id === item.abilityId);
    assert.ok(ability, item.abilityId);
    if (item.effect === 'discard-draw') f.state.players[item.side].hand.push(instance('cfa-4', `discard-${item.side}`, f.ownerId));
    const hit = playBoostedHit(f), event = hit.events.find(candidate => candidate.type === 'attack.hit');
    assert.equal(event.boosterCardInstanceId, f.booster.uid);
    assert.equal(event.boostedCardInstanceId, f.attacker.uid);
    assert.equal(f.state.pendingAbility?.ability?.id, item.abilityId);
    const selection = { instanceUid: f.booster.uid, abilityId: item.abilityId };
    if (item.effect === 'discard-draw') selection.costSelections = { discard: [`discard-${item.side}`] };
    const resolved = Reducer.applyAbilityDecision(f.state, { actorAuthUid: item.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `resolve-${item.effect}-${item.side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: 'ability-response', accept: true, selection } }, seats, Engine);
    assert.equal(resolved.ok, true, resolved.reason);
    if (item.effect === 'return-source') {
      assert.ok(f.state.players[item.side].soul.some(card => card.uid === `charge-${item.side}-${item.source}`));
      assert.ok(f.state.players[item.side].deck.some(card => card.uid === f.booster.uid));
      assert.equal(f.state.players[item.side].rear.some(card => card?.uid === f.booster.uid), false);
    } else {
      assert.ok(f.state.players[item.side].drop.some(card => card.uid === `discard-${item.side}`));
      assert.ok(f.state.players[item.side].hand.some(card => card.uid === `charge-${item.side}-${item.source}`));
    }
  }
});
