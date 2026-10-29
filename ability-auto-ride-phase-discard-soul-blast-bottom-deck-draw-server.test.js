'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');
const PATTERN = 'auto-ride-phase-discard-soul-blast-bottom-deck-draw-v1';
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).filter(ability => ability.definition?.source?.patternId === PATTERN));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
function instance(definition, uid, playerId) { return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || 'Unit', grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true }; }
function fixture(ability, side, { soulCount = 1, turnSide = side } = {}) {
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const turnPlayerId = turnSide === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human', otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = instance(cards.get(ability.cardId), `discarded-${side}-${ability.id}`, ownerId);
  const soul = Array.from({ length: soulCount }, (_, index) => instance(cards.get('cfa-3'), `soul-${side}-${ability.id}-${index}`, ownerId));
  const top = instance(cards.get('cfa-3'), `top-${side}-${ability.id}`, ownerId);
  const oldBottom = instance(cards.get('cfa-4'), `bottom-${side}-${ability.id}`, ownerId);
  const own = { playerId: ownerId, vanguard: instance(cards.get('cfa-3'), `vg-${side}-${ability.id}`, ownerId), rear: Array(5).fill(null), soul, deck: [oldBottom, top], hand: [], drop: [source], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: instance(cards.get('cfa-3'), `opp-vg-${side}-${ability.id}`, otherId), rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `ride-discard-${ability.id}-${side}`, stateVersion: 1, turn: 2, side: turnSide, phase: 2, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingAttack: null, players: side === 'human' ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: 'card.discarded', actingPlayerId: ownerId, turnPlayerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: 'hand', currentLocation: 'drop', phase: 'ride', timingWindow: 'ride-phase-discard' });
  return { state, event, source, own, side, ownerId, turnPlayerId, top, oldBottom, soul };
}
function decide(f, abilityId, options = {}) {
  const actorAuthUid = options.actorAuthUid || (f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid);
  const selection = { instanceUid: f.source.uid, abilityId, costSelections: { sb: options.soulCostUid ? [options.soulCostUid] : [] }, ...(options.payCost === false ? { payCost: false } : {}) };
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: options.actionId || `ride-discard-${f.source.uid}`, expectedStateVersion: f.state.stateVersion, payload: { type: 'ability-response', accept: true, selection } }, seats, Engine);
}
test('all 15 Ride-phase discard definitions are trusted with exact source, owner turn, costs, and draw order', () => {
  assert.equal(family.length, 15);
  for (const ability of family) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(entry => entry.id === ability.id), ability.id);
    assert.equal(ability.trigger.eventType, 'card.discarded');
    assert.equal(ability.trigger.sourceLocation, 'hand');
    assert.equal(ability.trigger.destinationLocation, 'drop');
    assert.equal(ability.trigger.requiredPhase, 'ride');
    assert.equal(ability.trigger.turnRelation, 'controller');
    assert.deepEqual(ability.costs, [{ type: 'soul-blast', count: 1 }, { type: 'source-to-bottom-deck', count: 1 }]);
    assert.deepEqual(ability.definition.effects, [{ op: 'draw', count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
  }
});
test('the exact discarded source controller pays Soul Blast, returns that source to deck bottom, then draws for either seat', () => {
  for (const ability of family) for (const side of ['human', 'bot']) {
    const f = fixture(ability, side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${ability.id}/${side}: ${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const soulCostUid = f.soul[0].uid;
    const result = decide(f, ability.id, { soulCostUid });
    assert.equal(result.ok, true, `${ability.id}/${side}: ${result.reason}`);
    assert.deepEqual(f.own.soul, []);
    assert.deepEqual(f.own.drop.map(card => card.uid), [soulCostUid]);
    assert.deepEqual(f.own.deck.map(card => card.uid), [f.source.uid, f.oldBottom.uid]);
    assert.deepEqual(f.own.hand.map(card => card.uid), [f.top.uid]);
  }
});
test('unpayable Soul Blast, wrong player turn, wrong source movement, and opponent proxy create no legal resolution', () => {
  for (const side of ['human', 'bot']) {
    const unpayable = fixture(family[0], side, { soulCount: 0 });
    assert.equal(Reducer.discoverAutoTriggers(unpayable.state, [unpayable.event], Engine).queued.length, 0);
    const wrongTurn = fixture(family[0], side, { turnSide: side === 'human' ? 'bot' : 'human' });
    assert.equal(Reducer.discoverAutoTriggers(wrongTurn.state, [wrongTurn.event], Engine).queued.length, 0);
    const wrongMove = fixture(family[0], side);
    assert.equal(Reducer.discoverAutoTriggers(wrongMove.state, [{ ...wrongMove.event, previousLocation: 'rear-left' }], Engine).queued.length, 0);
    const proxy = fixture(family[0], side);
    assert.equal(Reducer.discoverAutoTriggers(proxy.state, [proxy.event], Engine).queued.length, 1);
    const before = JSON.stringify(proxy.state);
    const result = decide(proxy, family[0].id, { soulCostUid: proxy.soul[0].uid, actorAuthUid: side === 'bot' ? seats.hostAuthUid : seats.guestAuthUid });
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(proxy.state), before);
  }
});
test('declining payment leaves Soul, Drop, Deck, and hand unchanged; duplicate events do not reopen the prompt', () => {
  const ability = family[0], f = fixture(ability, 'bot');
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const duplicate = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(duplicate.queued.length, 0);
  const before = { soul: f.own.soul.map(card => card.uid), drop: f.own.drop.map(card => card.uid), deck: f.own.deck.map(card => card.uid), hand: f.own.hand.map(card => card.uid) };
  const declined = decide(f, ability.id, { payCost: false });
  assert.equal(declined.ok, true, declined.reason);
  assert.deepEqual({ soul: f.own.soul.map(card => card.uid), drop: f.own.drop.map(card => card.uid), deck: f.own.deck.map(card => card.uid), hand: f.own.hand.map(card => card.uid) }, before);
});
