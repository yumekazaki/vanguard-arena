'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerCardAbilityKeywordIndex(require('./card-ability-keywords.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');
const DEFINITIONS = require('./ability-contributions/batch-PRIMARY-AUTO-GLITTER-PLACEMENT-TOP-FIVE.js');

Engine.registerAbilityDefinitions(DEFINITIONS);

const IDS = ['cfa-13520', 'cfa-13542', 'cfa-13584', 'cfa-13608', 'cfa-13621'];
const PATTERN = 'auto-rc-hand-placement-glitter-top-five-to-hand-return-source-to-soul-v1';
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));

function instance(cardId, uid, playerId, overrides = {}) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog contains ${cardId}`);
  return {
    uid, cardId: String(cardId), cardName: definition.name, type: definition.type,
    grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId,
    ...overrides
  };
}

function fixture({ sourceLocation = 'rear-guard', selectedUid = null, topIds = ['cfa-13520', 'cfa-13542', 'cfa-13584', 'cfa-13608', 'cfa-13621'], controllerPlayerId = 'host', sourceController = controllerPlayerId } = {}) {
  const opponentPlayerId = controllerPlayerId === 'host' ? 'guest' : 'host';
  const source = instance('cfa-13520', 'glitter-auto-source', sourceController, { circle: 'rear-left' });
  const own = {
    playerId: controllerPlayerId, hand: [], soul: [], drop: [], rear: Array(5).fill(null), deck: [],
    vanguard: null, damage: [], bind: [], orders: []
  };
  const enemy = {
    playerId: opponentPlayerId, hand: [], soul: [], drop: [], rear: Array(5).fill(null), deck: [],
    vanguard: null, damage: [], bind: [], orders: []
  };
  if (sourceLocation === 'rear-guard') own.rear[0] = source;
  else if (sourceLocation === 'vanguard') own.vanguard = source;
  else if (sourceLocation === 'opponent-rear-guard') enemy.rear[0] = source;
  own.deck = topIds.map((cardId, index) => instance(cardId, `top-${index}-${cardId}`, own.playerId));
  let shuffleCalls = 0;
  const events = [];
  const context = {
    source, sourceInPlay: ['rear-guard', 'vanguard', 'opponent-rear-guard'].includes(sourceLocation),
    sourceZone: sourceLocation === 'rear-guard' ? 'rear-left' : sourceLocation === 'vanguard' ? 'vanguard' : 'rear-left',
    sourceCircle: ['rear-guard', 'opponent-rear-guard'].includes(sourceLocation) ? 'rear-left' : null,
    player: own, side: controllerPlayerId === 'host' ? 'human' : 'bot', actorPlayerId: controllerPlayerId, effectUid: selectedUid,
    cardDefinitionForInstance: card => CATALOG.get(String(card?.cardId || '')),
    shuffleDeck: deck => { shuffleCalls += 1; deck.reverse(); return deck; },
    emitEvent: event => events.push(event)
  };
  const state = { side: context.side, phase: 4, turn: 3, players: context.side === 'human' ? { human: own, bot: enemy } : { human: enemy, bot: own } };
  return { source, own, enemy, context, state, events, get shuffleCalls() { return shuffleCalls; } };
}

function ability(cardId = IDS[0]) {
  const parsed = Engine.parseCardAbilitiesCached(CATALOG.get(cardId)).find(item => item.id === `${cardId}:0`);
  assert.ok(parsed, `${cardId}:0 parses`);
  return parsed;
}

function run(f, selectedUid = null, program = ability().definition.effects, beforeEffects = null) {
  f.context.effectUid = selectedUid;
  return Engine.resolveEffectProgram(program, Engine.EFFECT_HANDLERS, f.context, beforeEffects);
}

const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
let serverSequence = 0;
function serverFixture(side = 'human', { vanguardCardId = 'cfa-9728', topIds = ['cfa-10590', 'cfa-9728'] } = {}) {
  const ownerId = side === 'human' ? 'host-player' : 'guest-player';
  const opponentId = side === 'human' ? 'guest-player' : 'host-player';
  const source = instance('cfa-13520', `server-glitter-source-${++serverSequence}`, ownerId, { circle: 'rear-left' });
  const makePlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: makePlayer('host-player'), bot: makePlayer('guest-player') };
  const own = players[side], enemy = players[side === 'human' ? 'bot' : 'human'];
  own.vanguard = instance(vanguardCardId, `server-glitter-vanguard-${serverSequence}`, ownerId);
  own.rear[0] = source;
  own.deck = topIds.map((cardId, index) => instance(cardId, `server-glitter-top-${serverSequence}-${index}`, ownerId));
  enemy.vanguard = instance('cfa-3', `server-glitter-opponent-${serverSequence}`, opponentId);
  const state = { matchId: 'glitter-placement', stateVersion: 1, eventSequence: 0, turn: 3, phase: 'main', side, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: 'card.placed', actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: 'hand', currentLocation: 'rear-left', circle: 'rear-left', phase: 'main', timingWindow: 'call'
  });
  return { state, side, ownerId, source, event, own, enemy };
}
function discoverServer(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function respondServer(f, { accept = true, effectUid = null, actorAuthUid = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-glitter-${f.side}-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept, selection: { instanceUid: f.source.uid, abilityId: `${f.source.cardId}:0`, ...(effectUid ? { effectUid } : {}) } }
  }, seats, Engine);
}

test('the five catalog texts compile into exact source-bound hand-to-RC Glitter searches', () => {
  assert.equal(DEFINITIONS.length, IDS.length);
  for (const cardId of IDS) {
    const parsed = ability(cardId), definition = parsed.definition;
    const catalogAbility = Engine.parseCardAbilities({ id: cardId, text: CATALOG.get(cardId).text }).find(item => item.id === `${cardId}:0`);
    assert.equal(parsed.printedText, definition.printedText);
    assert.equal(definition.printedText, catalogAbility?.printedText, `${cardId}:0 exactly matches catalog text`);
    assert.equal(definition.id, `${cardId}:0`);
    assert.equal(definition.source.patternId, PATTERN);
    assert.equal(definition.requiredLocation.includes('rear-guard'), true);
    assert.deepEqual(definition.trigger, {
      status: 'recognized-trigger', eventType: 'card.placed', subject: 'source', circles: ['rear-guard'],
      sourceLocation: 'hand', destinationLocation: 'rear-guard', subjectControllerRelation: 'source-controller'
    });
    assert.deepEqual(definition.conditions, [{ type: 'controller-vanguard-has-ability-keyword', value: 'Glitter' }]);
    assert.deepEqual(definition.effects[0], {
      op: 'search-top-up-to-one-filtered-to-hand', target: 'controller', lookCount: 5, maximum: 1,
      filter: { abilityKeyword: 'Glitter' }
    });
    assert.deepEqual(definition.effects[1].ifPreviousEffectResult, {
      effectIndex: 0, property: 'revealedCardUid', predicate: 'nonempty-string'
    });
  }
  assert.match(ability('cfa-13621').printedText, /chooose up to one Glitter/);
});

test('the controller Vanguard condition and top-five filter recognize only printed Glitter traits', () => {
  const parsed = ability();
  assert.equal(Engine.cardHasAbilityKeyword('cfa-9728', 'Glitter'), true);
  assert.equal(Engine.cardHasAbilityKeyword('cfa-10590', 'Glitter'), false, 'a Glitter-name-gated support ability is not itself a Glitter trait');
  assert.equal(Engine.cardHasAbilityKeyword('cfa-13520', 'Glitter'), false, 'mentioning a Glitter Vanguard does not make this source a Glitter');
  assert.equal(Engine.cardHasAbilityKeyword({ cardId: 'cfa-13520', abilityKeywords: ['Glitter'] }, 'Glitter'), false, 'instance-supplied keyword flags are not authoritative');
  assert.equal(Engine.matchesTargetFilter({ abilityKeyword: 'Glitter' }, { targetCard: CATALOG.get('cfa-9728') }), true);
  assert.equal(Engine.matchesTargetFilter({ abilityKeyword: 'Glitter' }, { targetCard: CATALOG.get('cfa-10590') }), false);
  assert.equal(Engine.matchesTargetFilter({ abilityKeyword: 'Glitter' }, { targetCard: { cardId: 'cfa-13520', abilityKeywords: ['Glitter'] } }), false);
  assert.equal(Engine.matchesTargetFilter({ abilityKeyword: 'Glitter' }, { targetCard: { cardId: 'cfa-9728', abilityKeywords: [] } }), true);
  assert.equal(Engine.evaluateAbilityConditions(parsed, { controllerVanguardCard: 'cfa-9728' }), true);
  assert.equal(Engine.evaluateAbilityConditions(parsed, { controllerVanguardCard: 'cfa-10590' }), false);
  assert.equal(Engine.evaluateAbilityConditions(parsed, {}), false);
});

test('only the exact source placement from hand onto RC matches this AUTO trigger', () => {
  const parsed = ability(), source = instance('cfa-13520', 'trigger-source', 'host');
  const base = {
    type: 'card.placed', eventId: 'placed-trigger-source', sourceCardInstanceId: source.uid,
    subjectCardInstanceId: source.uid, subjectControllerPlayerId: 'host',
    previousLocation: 'hand', currentLocation: 'rear-left'
  };
  const matches = event => Engine.eventMatchesAbilityTrigger(parsed, 'place', event, source.uid, 'rear-left', 'rear-left', 'host');
  assert.equal(matches(base), true);
  assert.equal(matches({ ...base, sourceCardInstanceId: 'different-source', subjectCardInstanceId: 'different-source' }), false);
  assert.equal(matches({ ...base, previousLocation: 'drop' }), false);
  assert.equal(matches({ ...base, currentLocation: 'vanguard' }), false);
  assert.equal(matches({ ...base, subjectControllerPlayerId: 'guest' }), false);
});

test('the controller may reveal zero cards; without a reveal the exact source stays on RC', () => {
  const f = fixture();
  const beforeDeck = f.own.deck.map(card => card.uid);
  const result = run(f, null);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.results[0].revealedCardUid, null);
  assert.equal(f.own.rear[0].uid, f.source.uid);
  assert.equal(f.own.soul.length, 0);
  assert.equal(f.own.hand.length, 0);
  assert.equal(f.own.deck.length, beforeDeck.length);
  assert.equal(f.shuffleCalls, 1);
});

test('each player seat resolves the search through its own deck, hand, Rear-Guard, and Soul', () => {
  for (const controllerPlayerId of ['host', 'guest']) {
    const f = fixture({ controllerPlayerId, topIds: ['cfa-9728', 'cfa-13542', 'cfa-13584', 'cfa-13608', 'cfa-13621'] });
    const chosen = f.own.deck[0];
    const result = run(f, chosen.uid);
    assert.equal(result.ok, true, `${controllerPlayerId}: ${JSON.stringify(result)}`);
    assert.equal(f.own.hand[0]?.uid, chosen.uid);
    assert.equal(f.own.soul[0]?.uid, f.source.uid);
    assert.equal(f.enemy.hand.length, 0);
    assert.equal(f.enemy.soul.length, 0);
    assert.equal(f.shuffleCalls, 1);
  }
});

test('one selected top-five Glitter is revealed and added to hand, shuffles, then moves only the source to Soul', () => {
  const f = fixture({ topIds: ['cfa-13520', 'cfa-9728', 'cfa-13584', 'cfa-13608', 'cfa-13621'] });
  const chosen = f.own.deck[1];
  const originalSource = f.source;
  const result = run(f, chosen.uid);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.own.hand.length, 1);
  assert.equal(f.own.hand[0].uid, chosen.uid);
  assert.equal(f.own.soul.length, 1);
  assert.equal(f.own.soul[0].uid, originalSource.uid);
  assert.equal(f.own.rear[0], null);
  assert.equal(f.own.deck.length, 4);
  assert.equal(f.shuffleCalls, 1);
  assert.equal(f.events.some(event => event.type === 'card.revealed' && event.cardInstanceId === chosen.uid), true);
  assert.equal(f.events.some(event => event.type === 'card.moved' && event.cardInstanceId === originalSource.uid && event.currentLocation === 'soul'), true);
});

test('an invalid selected card and a malformed result dependency are rejected before any state changes', () => {
  const f = fixture({ topIds: ['cfa-9728', 'cfa-13542', 'cfa-13584', 'cfa-13608', 'cfa-13621'] });
  const before = JSON.stringify({ deck: f.own.deck, hand: f.own.hand, rear: f.own.rear, soul: f.own.soul });
  const invalidChoice = run(f, f.own.deck[1].uid);
  assert.equal(invalidChoice.ok, false);
  assert.equal(JSON.stringify({ deck: f.own.deck, hand: f.own.hand, rear: f.own.rear, soul: f.own.soul }), before);
  assert.equal(f.shuffleCalls, 0);

  const malformed = structuredClone(ability().definition.effects);
  malformed[1].ifPreviousEffectResult.effectIndex = 1;
  f.context.effectUid = f.own.deck[0].uid;
  const invalidDependency = Engine.validateEffectProgram(malformed, Engine.EFFECT_HANDLERS, f.context);
  assert.equal(invalidDependency.ok, false);
  assert.equal(invalidDependency.reason, 'invalid-effect-result-dependency');

  malformed[1].ifPreviousEffectResult.effectIndex = 0;
  malformed[1].ifPreviousEffectResult.property = 'lookedCount';
  const untypedDependency = Engine.validateEffectProgram(malformed, Engine.EFFECT_HANDLERS, f.context);
  assert.equal(untypedDependency.ok, false);
  assert.equal(untypedDependency.reason, 'invalid-effect-result-dependency');
});

test('a stale source fails after a valid reveal without committing search, shuffle, movement, or events', () => {
  const f = fixture({ sourceLocation: 'missing', topIds: ['cfa-13520', 'cfa-13542', 'cfa-13584', 'cfa-13608', 'cfa-9728'] });
  const chosen = f.own.deck.at(-1);
  const before = JSON.stringify({ deck: f.own.deck, hand: f.own.hand, rear: f.own.rear, soul: f.own.soul });
  const result = run(f, chosen.uid);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid-effect');
  assert.equal(JSON.stringify({ deck: f.own.deck, hand: f.own.hand, rear: f.own.rear, soul: f.own.soul }), before);
  assert.equal(f.shuffleCalls, 0, 'the invalid dependent source is rejected before search or shuffle begins');
  assert.equal(f.events.length, 0);
});

test('the return-to-Soul step rejects a Vanguard, opponent-zone, or opponent-controlled source', () => {
  const program = [{ op: 'move-source-to-soul', target: 'source', from: 'rear-guard' }];
  for (const [sourceLocation, sourceController] of [['vanguard', 'host'], ['opponent-rear-guard', 'guest'], ['rear-guard', 'guest']]) {
    const f = fixture({ sourceLocation, sourceController });
    const before = JSON.stringify({ ownVanguard: f.own.vanguard, ownRear: f.own.rear, enemyRear: f.enemy.rear, soul: f.own.soul });
    const result = Engine.resolveEffectProgram(program, Engine.EFFECT_HANDLERS, f.context);
    assert.equal(result.ok, false, sourceLocation);
    assert.equal(JSON.stringify({ ownVanguard: f.own.vanguard, ownRear: f.own.rear, enemyRear: f.enemy.rear, soul: f.own.soul }), before);
  }
});

test('all five exact definitions are accepted by the authoritative reducer; forged fields fail closed', () => {
  for (const cardId of IDS) {
    const parsed = ability(cardId);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(parsed, Engine), true, cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(parsed), true, cardId);
  }
  const forged = structuredClone(ability());
  forged.definition.effects[1].from = 'drop';
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  const wrongText = structuredClone(ability('cfa-13621'));
  wrongText.definition.printedText = wrongText.definition.printedText.replace('chooose', 'choose');
  wrongText.printedText = wrongText.definition.printedText;
  assert.equal(Reducer.supportsServerAbilityEffects(wrongText), false, 'catalog typo is intentionally preserved as the exact source text');
});

test('the server prompts the controller of the exact hand-to-RC source on either seat, only with a Glitter Vanguard', () => {
  for (const side of ['human', 'bot']) {
    const f = serverFixture(side);
    const result = discoverServer(f);
    assert.equal(result.queued.length, 1, JSON.stringify(result));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(discoverServer(f).queued.length, 0, 'same event cannot queue the AUTO twice');

    const noGlitter = serverFixture(side, { vanguardCardId: 'cfa-10590' });
    assert.equal(discoverServer(noGlitter).queued.length, 0, 'a card name or other effect mentioning Glitter is not the printed Glitter ability');
    noGlitter.own.vanguard.abilityKeywords = ['Glitter'];
    assert.equal(discoverServer(noGlitter).queued.length, 0, 'client-provided keyword flags cannot forge the vanguard condition');

    const wrongCircle = serverFixture(side);
    wrongCircle.event = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: undefined, currentLocation: 'vanguard', circle: 'vanguard' });
    assert.equal(discoverServer(wrongCircle).queued.length, 0, 'the source must be placed on a Rear-Guard Circle');
  }
});

test('the correct player resolves the top-five choice and conditional source-to-Soul effect', () => {
  for (const side of ['human', 'bot']) {
    const f = serverFixture(side, { topIds: ['cfa-10590', 'cfa-9728'] });
    assert.equal(discoverServer(f).queued.length, 1);
    const glitter = f.own.deck.find(card => card.cardId === 'cfa-9728');
    const result = respondServer(f, { effectUid: glitter.uid });
    assert.equal(result.ok, true, result.reason || JSON.stringify(result));
    assert.equal(f.own.hand.some(card => card.uid === glitter.uid), true);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), true);
    assert.equal(f.own.rear.some(card => card?.uid === f.source.uid), false);
    assert.equal(f.enemy.hand.length, 0);
    assert.equal(f.enemy.soul.length, 0);

    const forged = serverFixture(side, { topIds: ['cfa-10590', 'cfa-9728'] });
    assert.equal(discoverServer(forged).queued.length, 1);
    const invalidChoice = forged.own.deck.find(card => card.cardId === 'cfa-10590');
    const rejected = respondServer(forged, { effectUid: invalidChoice.uid, actorAuthUid: side === 'human' ? seats.guestAuthUid : seats.hostAuthUid });
    assert.equal(rejected.ok, false);
    assert.equal(forged.own.soul.length, 0);
    assert.equal(forged.own.rear[0].uid, forged.source.uid);
  }
});

test('declining is rejected because the printed AUTO is mandatory', () => {
  const f = serverFixture('bot');
  assert.equal(discoverServer(f).queued.length, 1);
  const declined = respondServer(f, { accept: false });
  assert.equal(declined.ok, false);
  assert.equal(f.state.pendingAbility?.instance?.uid, f.source.uid);
});
