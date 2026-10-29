'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');
const catalog = loadCatalog(), cards = new Map(catalog.map(card => [String(card.id), card]));
const entries = ['cfa-1940', 'cfa-2100', 'cfa-2399'];
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const pattern = 'auto-rc-placement-seeker-counter-blast-retire-grade-two-v1';
function instance(cardId, uid, playerId, extra = {}) { const card = cards.get(String(cardId)); return { uid, cardId: String(cardId), cardName: card?.name || cardId, type: card?.type || 'Unit', grade: Number(card?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra }; }
function fixture(cardId, side = 'human', { seeker = true, target = 'cfa-14', affordable = true } = {}) {
  const ownerId = side === 'human' ? 'host-player' : 'guest-player', otherSide = side === 'human' ? 'bot' : 'human', otherId = otherSide === 'human' ? 'host-player' : 'guest-player';
  const source = instance(cardId, `seeker-source-${cardId}-${side}`, ownerId), vanguard = instance(seeker ? 'cfa-1938' : 'cfa-474', `seeker-vg-${cardId}-${side}`, ownerId), opposingVanguard = instance('cfa-14', `opp-vg-${cardId}-${side}`, otherId);
  const enemy = target ? instance(target, `enemy-rg-${cardId}-${side}`, otherId) : null, cb = instance('cfa-14', `cb-${cardId}-${side}`, ownerId, { faceDown: false });
  const own = { playerId: ownerId, vanguard, rear: [source, null, null, null, null], damage: affordable ? [cb] : [], deck: [], hand: [], soul: [], drop: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: opposingVanguard, rear: [enemy, null, null, null, null], damage: [], deck: [], hand: [], soul: [], drop: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const state = { matchId: `seeker-${cardId}-${side}`, stateVersion: 1, turn: 3, phase: 2, side, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], players: { human: side === 'human' ? own : opponent, bot: side === 'bot' ? own : opponent } };
  const event = Engine.createGameEvent(state, { type: 'card.placed', actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: 'hand', currentLocation: 'rear-guard', circle: 'rear-left', phase: 'main', timingWindow: 'card-placement' });
  return { state, source, vanguard, enemy, cb, own, opponent, event, side, ownerId };
}
function decide(f, accept = true, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid) {
  const ability = Engine.parseCardAbilities(cards.get(f.source.cardId))[0];
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `seeker-answer-${f.source.uid}-${accept}`, expectedStateVersion: f.state.stateVersion, payload: { accept, selection: { instanceUid: f.source.uid, abilityId: ability.id, targetUid: f.enemy?.uid, costSelections: { cb: [f.cb.uid], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
}
test('all three exact catalog Seeker placement abilities preserve their source, Vanguard name condition, cost, target grade, and handler', () => {
  for (const cardId of entries) { const ability = Engine.parseCardAbilities(cards.get(cardId))[0]; assert.equal(ability.definition?.source?.patternId, pattern); assert.ok(cards.get(cardId).text.includes(ability.definition?.printedText)); assert.equal(ability.requiredLocation.join(','), 'rear-guard'); assert.deepEqual(ability.conditions, [{ type: 'controller-vanguard-name-contains', value: 'Seeker' }]); assert.deepEqual(ability.costs, [{ type: 'counter-blast', count: 1 }]); assert.equal(ability.canDecline, true); assert.deepEqual(ability.definition.effects[0].targetFilter, { controller: 'opponent', zone: 'rear-guard', minGrade: 2 }); assert.equal(Reducer.supportsServerAbilityEffects(ability), true); }
});
test('the source controller on either seat pays Counter Blast 1 and retires only an opposing Grade 2+ Rear-Guard', () => {
  for (const cardId of entries) for (const side of ['human', 'bot']) { const f = fixture(cardId, side), found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine); assert.equal(found.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(found.skipped)}`); assert.equal(f.state.pendingAbility.side, side); const result = decide(f); assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`); assert.ok(f.opponent.drop.some(card => card.uid === f.enemy.uid)); assert.equal(f.own.damage[0].faceDown, true); }
});
test('wrong source, circle, Seeker Vanguard, unavailable cost, illegal target, and forged seat never activate the AUTO', () => {
  for (const patch of [{ sourceCardInstanceId: 'another-copy' }, { currentLocation: 'vanguard', circle: 'vanguard' }, { actingPlayerId: 'guest-player', turnPlayerId: 'guest-player' }]) { const f = fixture('cfa-1940'), event = Engine.createGameEvent(f.state, { ...f.event, ...patch, eventId: undefined, sequence: undefined }); assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0); }
  assert.equal(Reducer.discoverAutoTriggers(fixture('cfa-1940', 'human', { seeker: false }).state, [fixture('cfa-1940', 'human', { seeker: false }).event], Engine).queued.length, 0);
  const noCost = fixture('cfa-1940', 'human', { affordable: false }); assert.equal(Reducer.discoverAutoTriggers(noCost.state, [noCost.event], Engine).queued.length, 0);
  for (const target of [null, 'cfa-2']) { const f = fixture('cfa-1940', 'human', { target }); assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0); }
});
test('decline leaves the Counter Blast and opposing unit unchanged, and the host cannot resolve the joining player’s prompt', () => {
  const declined = fixture('cfa-1940'), found = Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine); assert.equal(found.queued.length, 1); assert.equal(decide(declined, false).ok, true); assert.equal(declined.own.damage[0].faceDown, false); assert.ok(declined.opponent.rear[0]);
  const joining = fixture('cfa-2100', 'bot'); assert.equal(Reducer.discoverAutoTriggers(joining.state, [joining.event], Engine).queued.length, 1); const before = JSON.stringify(joining.state); assert.equal(decide(joining, true, seats.hostAuthUid).ok, false); assert.equal(JSON.stringify(joining.state), before);
});
test('the Seeker condition, Counter Blast, and target are revalidated before effects commit', () => {
  const lostCondition = fixture('cfa-1940'); assert.equal(Reducer.discoverAutoTriggers(lostCondition.state, [lostCondition.event], Engine).queued.length, 1); lostCondition.own.vanguard = instance('cfa-474', 'changed-vanguard', lostCondition.ownerId); assert.equal(decide(lostCondition).ok, false); assert.equal(lostCondition.own.damage[0].faceDown, false); assert.ok(lostCondition.opponent.rear[0]);
  const lostTarget = fixture('cfa-2100'); assert.equal(Reducer.discoverAutoTriggers(lostTarget.state, [lostTarget.event], Engine).queued.length, 1); lostTarget.opponent.rear[0] = null; assert.equal(decide(lostTarget).ok, false); assert.equal(lostTarget.own.damage[0].faceDown, false);
});
