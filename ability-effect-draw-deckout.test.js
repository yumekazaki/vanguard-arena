'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
const Reducer = require('./ability-server-reducer.js');

const seats = { hostAuthUid: 'draw-host-auth', guestAuthUid: 'draw-guest-auth', hostSide: 'human', guestSide: 'bot' };
function card(uid, cardId = 'draw-fixture-unit', playerId = 'draw-host') {
  return { uid, cardId, cardName: cardId, type: 'Unit', unitCard: true, grade: 1, ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function baseState({ deck = [], side = 'human' } = {}) {
  const host = { playerId: 'draw-host', vanguard: card('host-vg', 'draw-vg', 'draw-host'), rear: Array(5).fill(null), deck: deck.map(item => ({ ...item })), hand: [], soul: [], drop: [], bind: [], damage: [], orders: [], crests: [], guardCircle: [], gZone: [], gDeck: [], triggerZone: [] };
  const guest = { playerId: 'draw-guest', vanguard: card('guest-vg', 'draw-vg', 'draw-guest'), rear: Array(5).fill(null), deck: [], hand: [], soul: [], drop: [], bind: [], damage: [], orders: [], crests: [], guardCircle: [], gZone: [], gDeck: [], triggerZone: [] };
  return { matchId: 'effect-draw-deckout', stateVersion: 1, eventSequence: 0, turn: 2, side, phase: 4, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, pendingAttack: null, players: { human: host, bot: guest } };
}
function engineContext(deckCount, { drawCount = 1, sequence = false } = {}) {
  const player = { playerId: 'draw-host', deck: Array.from({ length: deckCount }, (_, i) => card(`draw-${i}`)), hand: [], soul: [], damage: [{ uid: 'down-damage', faceDown: true }] };
  const events = [], callbackResults = [];
  const effects = [{ op: 'draw', count: drawCount }];
  if (sequence) effects.push({ op: 'counter-charge', count: 1 });
  const context = { player, side: 'human', actorPlayerId: player.playerId, selectedDamageUids: ['down-damage'], emitEvent: event => events.push(event), onEffectDeckOut: info => callbackResults.push(info) };
  return { player, events, callbackResults, context, effects };
}

test('effect draws succeed through the last available card and deck out only on a short draw', () => {
  for (const [deckCount, drawCount, expectedDrawn, deckedOut] of [
    [0, 1, 0, true], [1, 1, 1, false], [1, 2, 1, true], [2, 2, 2, false]
  ]) {
    const f = engineContext(deckCount, { drawCount });
    const result = Engine.resolveEffectProgram(f.effects, Engine.EFFECT_HANDLERS, f.context);
    assert.equal(result.ok, true, `${deckCount}/${drawCount}`);
    assert.equal(f.player.hand.length, expectedDrawn, `${deckCount}/${drawCount}`);
    assert.equal(f.player.deck.length, deckCount - expectedDrawn, `${deckCount}/${drawCount}`);
    assert.equal(result.deckOut != null, deckedOut, `${deckCount}/${drawCount}`);
    assert.equal(f.events.filter(event => event.type === 'card.drawn').length, expectedDrawn);
    assert.equal(f.callbackResults.length, deckedOut ? 1 : 0);
    if (deckedOut) assert.deepEqual(result.deckOut, { side: 'human', playerId: 'draw-host', requested: drawCount, drawn: expectedDrawn });
  }
});

test('deck-out commits the partial draw, preserves earlier costs, and stops later effects', () => {
  const f = engineContext(1, { drawCount: 2, sequence: true });
  const result = Engine.resolveEffectProgram(f.effects, Engine.EFFECT_HANDLERS, f.context, draft => {
    draft.player.soul.push(card('paid-source'));
    return true;
  });
  assert.equal(result.ok, true);
  assert.equal(result.applied, 1);
  assert.equal(result.results[0], 1);
  assert.equal(result.deckOut.drawn, 1);
  assert.equal(f.player.soul.some(item => item.uid === 'paid-source'), true);
  assert.equal(f.player.hand.length, 1);
  assert.equal(f.player.damage[0].faceDown, true, 'the following Counter Charge did not resolve after deck-out');
  assert.equal(f.events.filter(event => event.type === 'card.drawn').length, 1);
});

const manualDefinition = {
  id: 'effect-draw-manual:0', cardId: 'effect-draw-manual', kind: 'ACT',
  printedText: 'ACT [RC]: [Put this unit into your soul], draw a card.', requiredLocation: ['rear-guard'],
  costs: [{ type: 'source-to-soul', count: 1 }], costsReviewed: true, choicesReviewed: true,
  source: { patternId: 'test-act-source-to-soul-draw-deckout' },
  effects: [{ op: 'draw', count: 1 }]
};
const autoDefinition = {
  id: 'effect-draw-auto:0', cardId: 'effect-draw-auto', kind: 'AUTO',
  printedText: 'AUTO [RC]: When this unit is placed on RC, draw a card.', requiredLocation: ['rear-guard'],
  trigger: { status: 'recognized-trigger', eventType: 'card.placed', subject: 'source', circles: ['rear-guard'] },
  conditionsReviewed: true, costsReviewed: true, choicesReviewed: true,
  source: { patternId: 'test-auto-draw-deckout' }, effects: [{ op: 'draw', count: 1 }]
};
Engine.registerAbilityDefinitions([manualDefinition, autoDefinition]);

function manualFixture(side = 'human') {
  const state = baseState({ side }), player = state.players[side], source = card(`manual-source-${side}`, manualDefinition.cardId, player.playerId);
  player.rear[0] = source;
  return { state, player, source, side };
}
function activateManual(f) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `manual-draw-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'manual-ability-activation', sourceCardInstanceId: f.source.uid, abilityId: manualDefinition.id }
  }, seats, Engine);
}

test('an ACT draw that exhausts its deck keeps its paid source-to-Soul cost and ends the match', () => {
  for (const side of ['human', 'bot']) {
    const f = manualFixture(side);
    const result = activateManual(f);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.player.rear.includes(f.source), false);
    assert.equal(f.player.soul.some(item => item.uid === f.source.uid), true);
    assert.equal(f.state.ended, true);
    assert.equal(f.state.loserSide, side);
    assert.equal(f.state.winnerSide, side === 'human' ? 'bot' : 'human');
    assert.equal(f.state.endReason, 'deck-empty');
    assert.deepEqual(result.events.map(event => event.type), ['card.moved', 'game.ended']);
    assert.equal(result.events[1].reason, 'deck-empty');
    assert.equal(result.events[1].loserPlayerId, f.player.playerId);
    assert.equal(result.events[1].winnerPlayerId, side === 'human' ? 'draw-guest' : 'draw-host');
    const replay = activateManual(f);
    assert.equal(replay.ok, false);
    assert.equal(replay.reason, 'match-ended');
  }
});

test('an AUTO effect draw ends the match for the ability controller and emits game.ended', () => {
  const state = baseState(), player = state.players.human, source = card('auto-source', autoDefinition.cardId, player.playerId);
  player.rear[0] = source;
  const event = Engine.createGameEvent(state, {
    type: 'card.placed', actingPlayerId: player.playerId, turnPlayerId: player.playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: source.ownerPlayerId, sourceControllerPlayerId: source.controllerPlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: source.ownerPlayerId, subjectControllerPlayerId: source.controllerPlayerId,
    previousLocation: 'hand', currentLocation: 'rear-left', circle: 'rear-left', phase: 'main', timingWindow: 'call-resolution'
  });
  const parsed = Engine.parseCardAbilities({ id: autoDefinition.cardId, text: autoDefinition.printedText })[0];
  const ability = { ...parsed, id: autoDefinition.id, definition: autoDefinition, requiredLocation: autoDefinition.requiredLocation, trigger: autoDefinition.trigger, effects: autoDefinition.effects, conditionStatus: 'no-explicit-condition-detected', costStatus: 'no-cost', choiceStatus: 'no-explicit-choice-detected' };
  state.pendingAbility = {
    side: 'human', field: 'rear-left', instance: source, ability,
    triggerControllerPlayerId: player.playerId,
    eventContext: { event: 'place', eventId: event.eventId, gameEvent: event, sourceZone: 'hand', subjectZone: 'rear-left', turnPlayerId: player.playerId }
  };
  const result = Reducer.applyAbilityDecision(state, {
    actorAuthUid: seats.hostAuthUid, actionId: 'auto-draw-empty-deck', expectedStateVersion: state.stateVersion,
    payload: { type: 'ability-response', accept: true, selection: { instanceUid: source.uid, abilityId: autoDefinition.id } }
  }, seats, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.ended, true);
  assert.equal(state.loserSide, 'human');
  assert.equal(state.pendingAbility, null);
  assert.equal(result.events.at(-1).type, 'game.ended');
  assert.equal(result.events.at(-1).loserPlayerId, player.playerId);
});
