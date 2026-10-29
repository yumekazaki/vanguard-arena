'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const IDS = ['cfa-4311', 'cfa-4348', 'cfa-4602', 'cfa-4977'];
const TEXT = 'ACT [RC]: [Rest this unit] Choose one of your other units in the front row, and it gets power +2000 until end of turn.';
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
function instance(id, uid, playerId, extra = {}) {
  const definition = cards.get(String(id));
  return { uid, cardId: String(id), cardName: definition?.name, type: definition?.type || 'Unit', grade: Number(definition?.grade ?? 0), ownerPlayerId: playerId, controllerPlayerId: playerId, rested: false, turnPowerBoost: 0, ...extra };
}
function fixture(id, side = 'human') {
  const opponentSide = side === 'human' ? 'bot' : 'human';
  const playerId = side === 'human' ? 'host-player' : 'guest-player';
  const opponentId = side === 'human' ? 'guest-player' : 'host-player';
  const source = instance(id, `source-${side}-${id}`, playerId);
  const target = instance('cfa-3', `target-${side}-${id}`, playerId);
  const own = { playerId, vanguard: instance('cfa-3', `vg-${side}-${id}`, playerId), rear: [target, null, source, null, null], hand: [], soul: [], damage: [], deck: [], drop: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: instance('cfa-3', `opp-vg-${side}-${id}`, opponentId), rear: Array(5).fill(null), hand: [], soul: [], damage: [], deck: [], drop: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: `rest-front-row-${side}-${id}`, stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0, processedActionIds: [], pendingAbility: null, pendingTrigger: null, pendingAbilities: [], players: { [side]: own, [opponentSide]: opponent } };
  const ability = Engine.parseCardAbilitiesCached(cards.get(id)).find(item => item.id === `${id}:1`);
  assert.ok(ability, `${id}:1`);
  return { state, own, opponent, source, target, ability, side };
}
function activate(f, actionId = `activate-${f.source.uid}`, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid, targetUid = f.target.uid) {
  return Reducer.applyManualAbilityActivation(f.state, { actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion, payload: { sourceCardInstanceId: f.source.uid, abilityId: f.ability.id, selection: { targetUid, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
}

test('four exact front-row power ACT definitions have trusted costs and effects', () => {
  for (const id of IDS) {
    const f = fixture(id);
    assert.equal(f.ability.printedText, TEXT);
    assert.deepEqual(f.ability.requiredLocation, ['rear-guard']);
    assert.deepEqual(f.ability.costs, [{ type: 'rest-source', count: 1 }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: 'modify-power-target', target: 'chosen', amount: 2000, duration: 'turn', targetFilter: { controller: 'source-controller', cardType: 'unit', excludeSource: true, row: 'front' } }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, id);
  }
});

test('host and joining player independently rest their source and power a friendly front-row unit', () => {
  for (const id of IDS) for (const side of ['human', 'bot']) {
    const f = fixture(id, side);
    const result = activate(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.source.rested, true);
    assert.equal(f.target.turnPowerBoost, 2000);
    assert.equal(f.opponent.rear.every(card => !card), true);
  }
});

test('back-row or foreign targets, an already-rested source, wrong seat, and replay are rejected atomically', () => {
  const id = IDS[0];
  const backRow = fixture(id); backRow.own.rear[0] = null; backRow.own.rear[2] = backRow.target; backRow.own.rear[3] = backRow.source;
  let before = JSON.stringify(backRow.state); assert.equal(activate(backRow).ok, false); assert.equal(JSON.stringify(backRow.state), before);
  const foreign = fixture(id); foreign.opponent.rear[0] = instance('cfa-3', 'foreign-target', foreign.opponent.playerId);
  before = JSON.stringify(foreign.state); assert.equal(activate(foreign, 'foreign', seats.hostAuthUid, 'foreign-target').ok, false); assert.equal(JSON.stringify(foreign.state), before);
  const rested = fixture(id); rested.source.rested = true;
  before = JSON.stringify(rested.state); assert.equal(activate(rested).ok, false); assert.equal(JSON.stringify(rested.state), before);
  const joining = fixture(id, 'bot');
  before = JSON.stringify(joining.state); assert.equal(activate(joining, 'proxy', seats.hostAuthUid).ok, false); assert.equal(JSON.stringify(joining.state), before);
  const repeat = fixture(id); assert.equal(activate(repeat, 'first').ok, true); before = JSON.stringify(repeat.state); assert.equal(activate(repeat, 'second').ok, false); assert.equal(JSON.stringify(repeat.state), before);
});
