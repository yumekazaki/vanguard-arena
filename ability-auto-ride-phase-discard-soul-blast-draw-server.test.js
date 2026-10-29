'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const IDS = ['cfa-12254', 'cfa-12267', 'cfa-12276', 'cfa-12352', 'cfa-12358', 'cfa-12373'];
const TEXT = 'AUTO: When this card is discarded from hand during your ride phase, COST [Soul Blast 2], and draw a card.';
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
function card(id, uid, playerId) {
  const definition = cards.get(String(id));
  return { uid, cardId: String(id), cardName: definition?.name || String(id), type: definition?.type || 'Unit', grade: Number(definition?.grade ?? 0), ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(id, side = 'human', soulCount = 2) {
  const otherSide = side === 'human' ? 'bot' : 'human';
  const playerId = side === 'human' ? 'player-host' : 'player-guest';
  const opponentId = side === 'human' ? 'player-guest' : 'player-host';
  const definition = cards.get(id);
  const source = card(id, `source-${side}-${id}`, playerId);
  const soul = Array.from({ length: soulCount }, (_, index) => card('cfa-3', `soul-${side}-${id}-${index}`, playerId));
  const drawn = card('cfa-4', `draw-${side}-${id}`, playerId);
  const own = { playerId, vanguard: card('cfa-3', `vg-${side}-${id}`, playerId), rear: Array(5).fill(null), hand: [], soul, damage: [], deck: [drawn], drop: [source], bind: [], orders: [], gDeck: [], gZone: [], guardCircle: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: card('cfa-3', `opp-vg-${side}-${id}`, opponentId), rear: Array(5).fill(null), hand: [], soul: [], damage: [], deck: [], drop: [], bind: [], orders: [], gDeck: [], gZone: [], guardCircle: [], triggerZone: [] };
  const state = { matchId: `ride-discard-draw-${side}-${id}`, stateVersion: 1, turn: 2, side, phase: 2, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], players: { [side]: own, [otherSide]: opponent } };
  const event = Engine.createGameEvent(state, { type: 'card.discarded', actingPlayerId: playerId, turnPlayerId: playerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId, previousLocation: 'hand', currentLocation: 'drop', phase: 'ride', timingWindow: 'discard' });
  const ability = Engine.parseCardAbilitiesCached(definition).find(entry => entry.id === `${id}:0`);
  assert.ok(ability, `${id}:0 must parse`);
  return { state, event, source, soul, drawn, own, opponent, ability, side, playerId };
}
function decide(f, actionId = `resolve-${f.source.uid}`, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { sb: f.soul.slice(0, 2).map(item => item.uid) } } } }, seats, Engine);
}

test('six exact Ride-phase discard abilities are validated and available to both seats', () => {
  for (const id of IDS) {
    const f = fixture(id);
    assert.equal(f.ability.printedText, TEXT);
    assert.equal(f.ability.trigger.eventType, 'card.discarded');
    assert.equal(f.ability.trigger.subject, 'source');
    assert.equal(f.ability.trigger.sourceLocation, 'hand');
    assert.equal(f.ability.trigger.destinationLocation, 'drop');
    assert.deepEqual(f.ability.costs, [{ type: 'soul-blast', count: 2 }]);
    assert.equal(f.ability.canDecline, false);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, id);
    for (const side of ['human', 'bot']) {
      const seatFixture = fixture(id, side);
      const found = Reducer.discoverAutoTriggers(seatFixture.state, [seatFixture.event], Engine);
      assert.equal(found.queued.length, 1, `${id}/${side}: ${JSON.stringify(found.skipped)}`);
      assert.equal(seatFixture.state.pendingAbility.side, side);
      const resolved = decide(seatFixture);
      assert.equal(resolved.ok, true, `${id}/${side}: ${resolved.reason}`);
      assert.equal(seatFixture.own.soul.length, 0);
      assert.deepEqual(seatFixture.own.hand.map(item => item.uid), [seatFixture.drawn.uid]);
      assert.deepEqual(seatFixture.opponent.hand, []);
    }
  }
});

test('unpayable cost, wrong event facts, duplicate events, and opponent proxy cannot activate the ability', () => {
  const id = IDS[0];
  for (const side of ['human', 'bot']) {
    const noSoul = fixture(id, side, 1);
    assert.equal(Reducer.discoverAutoTriggers(noSoul.state, [noSoul.event], Engine).queued.length, 0);
    const wrongTurn = fixture(id, side);
    wrongTurn.state.side = side === 'human' ? 'bot' : 'human';
    assert.equal(Reducer.discoverAutoTriggers(wrongTurn.state, [wrongTurn.event], Engine).queued.length, 0);
    const wrongCard = fixture(id, side);
    assert.equal(Reducer.discoverAutoTriggers(wrongCard.state, [{ ...wrongCard.event, eventId: `wrong-${side}`, cardInstanceId: 'other', subjectCardInstanceId: 'other', sourceCardInstanceId: 'other' }], Engine).queued.length, 0);
    const wrongPhase = fixture(id, side);
    assert.equal(Reducer.discoverAutoTriggers(wrongPhase.state, [{ ...wrongPhase.event, eventId: `phase-${side}`, phase: 'main' }], Engine).queued.length, 0);
    const proxy = fixture(id, side);
    assert.equal(Reducer.discoverAutoTriggers(proxy.state, [proxy.event], Engine).queued.length, 1);
    const before = JSON.stringify(proxy.state);
    const wrongActor = side === 'human' ? seats.guestAuthUid : seats.hostAuthUid;
    const rejected = decide(proxy, `proxy-${side}`, wrongActor);
    assert.equal(rejected.ok, false);
    assert.equal(JSON.stringify(proxy.state), before);
  }
});

test('a duplicate discard event cannot create a second pending activation', () => {
  const f = fixture(IDS[1], 'bot');
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
});
