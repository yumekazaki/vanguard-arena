'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const PATTERN = 'cont-cannot-ride-until-divine-skill-used-v1';
const TARGET_IDS = ['cfa-13049', 'cfa-13057', 'cfa-13060', 'cfa-13071', 'cfa-13083', 'cfa-13113'];
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = TARGET_IDS.map(id => {
  const card = cards.get(id);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  return { card, ability };
});
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };

function instance(definition, uid, playerId, extra = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || 'Unit', unitCard: true,
    grade: Number(definition.grade || 0), power: Number(definition.power || 10000), critical: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function attackFixture(definition, side, location) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const opponentSide = side === 'human' ? 'bot' : 'human';
  const opponentId = side === 'human' ? 'player-guest' : 'player-host';
  const source = instance(definition, `${side}-${location}-source`, ownerId);
  const ownVanguard = location === 'vanguard' ? source : instance(cards.get('cfa-3'), `${side}-own-vanguard`, ownerId, { grade: 3 });
  const rear = Array(5).fill(null);
  if (location === 'rear-left') rear[0] = source;
  const target = instance(cards.get('cfa-3'), `${opponentSide}-target`, opponentId, { grade: 3 });
  const own = { playerId: ownerId, vanguard: ownVanguard, rear, guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [], gDeck: [], gZone: [], usedAbilities: [] };
  const opponent = { playerId: opponentId, vanguard: target, rear: Array(5).fill(null), guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [], gDeck: [], gZone: [] };
  const state = { matchId: `divine-attack-${definition.id}-${side}-${location}`, stateVersion: 0, processedActionIds: [], processedAbilityTriggers: [],
    turn: 3, side, phase: 5, firstTurnComplete: true, pendingAttack: null, pendingAbility: null, pendingAbilities: [],
    players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  return { state, owner: own, source, target, auth: side === 'human' ? seats.hostAuthUid : seats.guestAuthUid };
}

function attemptAttack(f, actionId) {
  return Reducer.applyGameAction(f.state, { actorAuthUid: f.auth, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { action: 'attack', attackerCardInstanceId: f.source.uid, targetCardInstanceId: f.target.uid } }, seats, Engine);
}

test('the six exact real-card CONT definitions are trusted, location-wide, and prevent riding', () => {
  assert.equal(family.length, 6);
  for (const { card, ability } of family) {
    assert.ok(ability, card.id);
    assert.equal(ability.kind, 'CONT');
    assert.deepEqual(ability.requiredLocation, []);
    assert.equal(ability.definition.keywords.includes('cannot-be-ridden'), true);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(card.id).some(item => item.id === ability.id));
    assert.equal(Engine.canRideCard(card, { vanguardCard: { grade: 2, name: 'Previous Vanguard' } }), false, card.id);
  }
});

test('the authoritative host and joining-player rules block their own attacks until that player uses Divine Skill', () => {
  for (const { card } of family) for (const side of ['human', 'bot']) for (const location of ['rear-left', 'vanguard']) {
    const f = attackFixture(card, side, location);
    const before = JSON.stringify(f.state);
    const blocked = attemptAttack(f, `blocked-${f.state.matchId}`);
    assert.equal(blocked.ok, false, `${card.id}/${side}/${location}`);
    assert.equal(blocked.reason, 'divine-skill-required-to-attack', `${card.id}/${side}/${location}`);
    assert.equal(JSON.stringify(f.state), before, 'rejected attacks do not mutate authoritative state');

    f.owner.usedAbilities.push(`${f.owner.playerId}:divine-skill:fight`);
    const allowed = attemptAttack(f, `allowed-${f.state.matchId}`);
    assert.equal(allowed.ok, true, `${card.id}/${side}/${location}: ${allowed.reason}`);
  }
});

test('the other player using Divine Skill does not unlock this player’s restricted unit', () => {
  const { card } = family[0];
  const f = attackFixture(card, 'bot', 'rear-left');
  f.state.players.human.usedAbilities = [`${f.state.players.human.playerId}:divine-skill:fight`];
  const result = attemptAttack(f, 'opponent-divine-skill-does-not-unlock');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'divine-skill-required-to-attack');
});

test('Divine Skill parsing preserves the marker and creates one shared once-per-fight usage key', () => {
  const card = cards.get('cfa-12411');
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.divineSkill);
  assert.ok(ability);
  assert.equal(ability.kind, 'ACT');
  assert.equal(ability.once, true);
  assert.deepEqual(ability.usageRestriction, { type: 'once-per-fight', scope: 'divine-skill-player', reset: 'fight' });
  assert.match(ability.printedText, /^\[Divine Skill\] - ACT/);
  const keyA = Engine.abilityUsageKey(1, 'player-one', 'source-a', ability.id, ability.usageRestriction);
  const keyB = Engine.abilityUsageKey(8, 'player-one', 'source-b', 'another-card:4', ability.usageRestriction);
  assert.equal(keyA, keyB);
});

test('an unpaid Divine Skill cost leaves the limit unused; paying it consumes the shared limit', () => {
  const restriction = { type: 'once-per-fight', scope: 'divine-skill-player', reset: 'fight' };
  const player = { playerId: 'player-cost-test', damage: [], soul: [], hand: [], drop: [], rear: [] };
  const source = { uid: 'divine-source', cardId: 'cfa-12411' };
  const ability = { id: 'cfa-12411:1', once: true, usageRestriction: restriction, costs: [{ type: 'counter-blast', count: 1 }] };
  const context = { player, source, turnId: 1, actorPlayerId: player.playerId, sourceZone: 'vanguard' };

  const unpaid = Engine.payAbilityCosts(ability, context, { cb: [] });
  assert.equal(unpaid.ok, false);
  assert.equal(Engine.hasUsedDivineSkillThisFight(player), false);
  assert.deepEqual(player.usedAbilities || [], []);

  player.damage.push({ uid: 'face-up-damage', faceDown: false });
  const paid = Engine.payAbilityCosts(ability, context, { cb: ['face-up-damage'] });
  assert.equal(paid.ok, true);
  assert.ok(player.usedAbilities.includes(`${player.playerId}:divine-skill:fight`));
  assert.equal(Engine.hasUsedDivineSkillThisFight(player), true);
  assert.equal(player.damage[0].faceDown, true);

  const anotherCard = { ...ability, id: 'cfa-12537:1', costs: [] };
  const repeated = Engine.payAbilityCosts(anotherCard, { ...context, source: { uid: 'second-divine-source', cardId: 'cfa-12537' }, turnId: 7 }, {});
  assert.equal(repeated.ok, false);
  assert.equal(repeated.reason, 'usage-restriction');
});
