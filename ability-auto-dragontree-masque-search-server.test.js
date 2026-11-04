'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const IDS = ['cfa-10830', 'cfa-10850', 'cfa-11627', 'cfa-11952'];
const ABILITY_TEXT = 'AUTO: When this unit is placed on RC, COST [Counter Blast 1 & Soul Blast 1], choose one of your RC without any Dragontree markers, and put a Dragontree marker. Search your deck for up to one "Masque of Hydragrum", reveal it and put it into your hand, and shuffle your deck.';
const PATTERN = 'auto-rc-placement-counter-soul-blast-dragontree-marker-masque-search-v1';
const MARKER_EFFECT = {
  op: 'place-circle-marker',
  target: 'chosen-controller-circle',
  markerType: 'Dragontree',
  circleTypes: ['rear-guard']
};
const SEARCH_EFFECT = {
  op: 'search-deck-same-name-to-hand',
  target: 'controller',
  maximum: 1,
  cardName: 'Masque of Hydragrum'
};
const COSTS = [
  { type: 'counter-blast', count: 1 },
  { type: 'soul-blast', count: 1 }
];
const SEATS = {
  hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest',
  hostSide: 'human', guestSide: 'bot'
};
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));

function candidateDefinition(cardId) {
  return {
    id: `${cardId}:0`, cardId, kind: 'AUTO', printedText: ABILITY_TEXT,
    requiredLocation: ['rear-guard'], optional: false,
    trigger: {
      status: 'recognized-trigger', eventType: 'card.placed', subject: 'source',
      circles: ['rear-guard']
    },
    conditionsReviewed: true, costs: COSTS, costsReviewed: true, choicesReviewed: true,
    source: {
      dataset: 'Local card catalog', patternId: PATTERN,
      review: 'Exact catalog wording: exact source placed on RC; pay CB1 and SB1, place a Dragontree marker on one unmarked own RC, then may search up to one exact-name Masque of Hydragrum, reveal, add to hand, and shuffle.'
    },
    effects: [MARKER_EFFECT, SEARCH_EFFECT]
  };
}

// Keep this regression runnable before production integration. Once production
// definitions exist, use them; otherwise register test-only candidate data so
// the authoritative reducer is exercised and fails at its support gates.
for (const cardId of IDS) {
  const abilityId = `${cardId}:0`;
  const registered = Engine.getReviewedAbilityDefinitionsForCard(cardId).some(definition => definition.id === abilityId);
  if (!registered) Engine.registerAbilityDefinitions([candidateDefinition(cardId)]);
}

const ABILITIES = IDS.map(cardId => {
  const catalogCard = CATALOG.get(cardId);
  assert.ok(catalogCard, `catalog missing ${cardId}`);
  assert.ok(catalogCard.text.includes(ABILITY_TEXT), `exact ability text missing from ${cardId}`);
  const ability = Engine.parseCardAbilities({ id: cardId, text: ABILITY_TEXT }).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `AUTO ability missing for ${cardId}`);
  return ability;
});

function card(cardId, uid, playerId) {
  const definition = CATALOG.get(cardId);
  return {
    uid, cardId, cardName: definition?.name, grade: Number(definition?.grade || 0),
    type: definition?.type || 'Unit', ownerPlayerId: playerId,
    controllerPlayerId: playerId, unitCard: /unit/i.test(String(definition?.type || ''))
  };
}

function fixture(ability, side = 'human') {
  const ownId = side === 'human' ? 'player-host' : 'player-guest';
  const enemyId = side === 'human' ? 'player-guest' : 'player-host';
  const source = card(ability.cardId, `source-${ability.cardId}-${side}`, ownId);
  const ally = card('cfa-20', `ally-${side}`, ownId);
  const masque = card('cfa-10829', `masque-${side}`, ownId);
  const deckCards = [
    masque,
    { ...card('cfa-20', `deck-a-${side}`, ownId), cardName: 'Deck Unit A' },
    { ...card('cfa-20', `deck-b-${side}`, ownId), cardName: 'Deck Unit B' }
  ];
  const own = {
    playerId: ownId, vanguard: card('cfa-20', `vanguard-${side}`, ownId),
    rear: [source, ally, null, null, null], accelZones: 1, accelTypes: [], giftZones: [],
    deck: deckCards, hand: [], soul: [card('cfa-20', `soul-cost-${side}`, ownId)], drop: [],
    bind: [], damage: [{ uid: `damage-cost-${side}`, faceDown: false, ownerPlayerId: ownId, controllerPlayerId: ownId }],
    orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  };
  const enemy = {
    playerId: enemyId, vanguard: card('cfa-20', `enemy-vanguard-${side}`, enemyId),
    rear: Array(5).fill(null), accelZones: 0, accelTypes: [], giftZones: [], deck: [], hand: [],
    soul: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [],
    gDeck: [], gZone: []
  };
  const state = {
    matchId: `dragontree-masque-${side}-${ability.cardId}`, stateVersion: 1, turn: 2,
    side, phase: 2, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [],
    processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    players: side === 'human' ? { human: own, bot: enemy } : { human: enemy, bot: own }
  };
  const event = Engine.createGameEvent(state, {
    type: 'card.placed', actingPlayerId: ownId, turnPlayerId: ownId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId,
    sourceControllerPlayerId: ownId, cardInstanceId: source.uid,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownId,
    subjectControllerPlayerId: ownId, previousLocation: 'hand',
    currentLocation: 'rear-left', circle: 'rear-left', timingWindow: 'placement'
  });
  return { ability, side, ownId, enemyId, source, ally, masque, own, enemy, state, event };
}

function authFor(side) { return side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid; }
function decision(f, selection = {}, actionId = `resolve-${f.side}-${f.ability.cardId}`, auth = authFor(f.side)) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth, actionId, expectedStateVersion: f.state.stateVersion,
    payload: {
      accept: true,
      selection: {
        instanceUid: f.source.uid, abilityId: f.ability.id,
        circleZone: 'rear-right',
        costSelections: { cb: [`damage-cost-${f.side}`], sb: [`soul-cost-${f.side}`] },
        ...selection
      }
    }
  }, SEATS, Engine);
}

function discover(f, event = f.event) {
  return Reducer.discoverAutoTriggers(f.state, [event], Engine);
}

function relevantState(f) {
  return JSON.stringify({
    damage: f.own.damage, soul: f.own.soul, drop: f.own.drop,
    rear: f.own.rear, deck: f.own.deck, hand: f.own.hand,
    markers: f.own.giftZones, version: f.state.stateVersion,
    actionIds: f.state.processedActionIds,
    pending: f.state.pendingAbility && {
      side: f.state.pendingAbility.side, abilityId: f.state.pendingAbility.ability.id,
      sourceUid: f.state.pendingAbility.instance.uid
    }
  });
}

function assertPrivatePrompt(f, result) {
  assert.equal(result.queued.length, 1, `${f.ability.id}/${f.side}: ${JSON.stringify(result.skipped)}`);
  assert.equal(f.state.pendingAbility.side, f.side);
  assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
  assert.equal(Engine.projectPendingAbilitiesForSide(f.state, f.side).pendingAbility.instance.uid, f.source.uid);
  assert.equal(Engine.projectPendingAbilitiesForSide(f.state, f.side === 'human' ? 'bot' : 'human').pendingAbility, null);
}

function withShuffleCounter(run) {
  const crypto = globalThis.crypto;
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues;
  let calls = 0;
  crypto.getRandomValues = function (sample) { calls += 1; return original.call(this, sample); };
  try { return { result: run(), shuffleCalls: calls }; }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else delete crypto.getRandomValues;
  }
}

test('all four catalog entries are exact reviewed AUTO definitions for RC placement, CB1+SB1, marker, and Masque search', () => {
  for (const ability of ABILITIES) {
    assert.equal(ability.printedText, ABILITY_TEXT);
    assert.equal(ability.definition?.source?.patternId, PATTERN);
    assert.equal(ability.kind, 'AUTO');
    assert.deepEqual(ability.requiredLocation, ['rear-guard']);
    assert.equal(ability.trigger?.eventType, 'card.placed');
    assert.equal(ability.trigger?.subject, 'source');
    assert.deepEqual(ability.trigger?.circles, ['rear-guard']);
    assert.deepEqual(ability.costs, COSTS);
    assert.equal(ability.definition?.optional, false);
    assert.deepEqual(ability.definition?.effects, [MARKER_EFFECT, SEARCH_EFFECT]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true,
      `${ability.id} must be accepted by authoritative server validation`);
  }
});

test('each card resolves for host and joining player: exact source RC event, both costs, own marker, private exact-name reveal/add, and shuffle', () => {
  for (const ability of ABILITIES) for (const side of ['human', 'bot']) {
    const f = fixture(ability, side);
    assertPrivatePrompt(f, discover(f));
    const { result, shuffleCalls } = withShuffleCounter(() => decision(f, { effectUid: f.masque.uid }));
    assert.equal(result.ok, true, `${ability.id}/${side}: ${JSON.stringify(result)}`);
    assert.equal(result.resolvedAbilityId, ability.id);
    assert.deepEqual(f.own.giftZones, [{ type: 'Dragontree', zone: 'rear-right' }]);
    assert.deepEqual(f.enemy.giftZones, []);
    assert.equal(f.own.damage[0].faceDown, true, 'Counter Blast is paid by the ability controller');
    assert.equal(f.own.soul.length, 0, 'Soul Blast is paid by the ability controller');
    assert.ok(f.own.drop.some(item => item.uid === `soul-cost-${side}`), 'Soul Blast card moves to its owner’s drop');
    assert.ok(f.own.hand.some(item => item.uid === f.masque.uid), 'the exact Masque card enters the controller’s hand');
    assert.ok(!f.enemy.hand.some(item => item.uid === f.masque.uid));
    assert.ok(!f.own.deck.some(item => item.uid === f.masque.uid));
    assert.deepEqual(new Set(f.own.deck.map(item => item.uid)), new Set([`deck-a-${side}`, `deck-b-${side}`]));
    assert.ok(result.events.some(event => event.type === 'card.revealed' && event.cardInstanceId === f.masque.uid));
    assert.ok(shuffleCalls > 0, 'the deck shuffle uses the authoritative secure shuffle');
  }
});

test('the search is up to one: declining the search still pays costs, places the marker, and shuffles', () => {
  const f = fixture(ABILITIES[0]);
  assertPrivatePrompt(f, discover(f));
  const originalDeckUids = f.own.deck.map(item => item.uid);
  const { result, shuffleCalls } = withShuffleCounter(() => decision(f));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(f.own.giftZones, [{ type: 'Dragontree', zone: 'rear-right' }]);
  assert.equal(f.own.damage[0].faceDown, true);
  assert.equal(f.own.soul.length, 0);
  assert.equal(f.own.hand.length, 0);
  assert.deepEqual(new Set(f.own.deck.map(item => item.uid)), new Set(originalDeckUids));
  assert.ok(shuffleCalls > 0, 'the deck is shuffled even when no card is selected');
  assert.equal(result.events.some(event => event.type === 'card.revealed'), false);
});

test('only the exact source placement on its own RC prompts; wrong instance, controller, owner, event, and circle are rejected', () => {
  const mutations = [
    { sourceCardInstanceId: 'another-card' },
    { cardInstanceId: 'another-card' },
    { subjectCardInstanceId: 'another-card' },
    { actingPlayerId: 'opponent', sourceControllerPlayerId: 'opponent', subjectControllerPlayerId: 'opponent' },
    { sourceOwnerPlayerId: 'opponent', subjectOwnerPlayerId: 'opponent' },
    { type: 'card.moved' },
    { currentLocation: 'vanguard', circle: 'vanguard' },
    { currentLocation: 'rear-right', circle: 'rear-right' }
  ];
  for (const mutation of mutations) {
    const f = fixture(ABILITIES[0]);
    const result = discover(f, { ...f.event, ...mutation });
    assert.equal(result.queued.length, 0, JSON.stringify(mutation));
    assert.equal(f.state.pendingAbility, null);
  }
});

test('invalid controller, Vanguard or marked target, unavailable costs, invalid Masque, and stale selections reject without partial payment/effects', () => {
  const f = fixture(ABILITIES[0]);
  assertPrivatePrompt(f, discover(f));
  const beforeWrongPlayer = relevantState(f);
  assert.equal(decision(f, {}, 'wrong-seat', SEATS.guestAuthUid).ok, false);
  assert.equal(relevantState(f), beforeWrongPlayer);

  const invalidCircle = fixture(ABILITIES[0]);
  assertPrivatePrompt(invalidCircle, discover(invalidCircle));
  const beforeVanguard = relevantState(invalidCircle);
  assert.equal(decision(invalidCircle, { circleZone: 'vanguard' }).ok, false);
  assert.equal(relevantState(invalidCircle), beforeVanguard);

  const markedTarget = fixture(ABILITIES[0]);
  assertPrivatePrompt(markedTarget, discover(markedTarget));
  markedTarget.own.giftZones.push({ type: 'Dragontree', zone: 'rear-right' });
  const beforeMarked = relevantState(markedTarget);
  assert.equal(decision(markedTarget).ok, false);
  assert.equal(relevantState(markedTarget), beforeMarked);

  const staleTarget = fixture(ABILITIES[0]);
  assertPrivatePrompt(staleTarget, discover(staleTarget));
  staleTarget.own.rear.length = 1;
  const beforeMissingCircle = relevantState(staleTarget);
  assert.equal(decision(staleTarget).ok, false);
  assert.equal(relevantState(staleTarget), beforeMissingCircle);

  const noSoul = fixture(ABILITIES[0]);
  assertPrivatePrompt(noSoul, discover(noSoul));
  noSoul.own.soul.length = 0;
  const beforeNoSoul = relevantState(noSoul);
  assert.equal(decision(noSoul).ok, false);
  assert.equal(relevantState(noSoul), beforeNoSoul, 'failed Soul Blast cannot leave a paid Counter Blast or marker');

  const badMasque = fixture(ABILITIES[0]);
  assertPrivatePrompt(badMasque, discover(badMasque));
  const beforeWrongCard = relevantState(badMasque);
  assert.equal(decision(badMasque, { effectUid: `deck-a-human` }).ok, false);
  assert.equal(relevantState(badMasque), beforeWrongCard, 'a non-Masque deck UID cannot partially resolve the ability');

  const staleMasque = fixture(ABILITIES[0]);
  assertPrivatePrompt(staleMasque, discover(staleMasque));
  staleMasque.own.deck.splice(staleMasque.own.deck.findIndex(item => item.uid === staleMasque.masque.uid), 1);
  const beforeStaleCard = relevantState(staleMasque);
  assert.equal(decision(staleMasque, { effectUid: staleMasque.masque.uid }).ok, false);
  assert.equal(relevantState(staleMasque), beforeStaleCard, 'stale searched-card UID cannot pay costs or place the marker');
});

test('stale cost selections reject atomically, and a duplicate successful request cannot resolve twice', () => {
  const staleCost = fixture(ABILITIES[0]);
  assertPrivatePrompt(staleCost, discover(staleCost));
  staleCost.own.damage[0].faceDown = true;
  const beforeStaleCost = relevantState(staleCost);
  assert.equal(decision(staleCost).ok, false);
  assert.equal(relevantState(staleCost), beforeStaleCost);

  const f = fixture(ABILITIES[0], 'bot');
  assertPrivatePrompt(f, discover(f));
  const actionId = 'single-resolution-only';
  const success = decision(f, { effectUid: f.masque.uid }, actionId);
  assert.equal(success.ok, true, JSON.stringify(success));
  const afterSuccess = relevantState(f);
  const duplicate = decision(f, { effectUid: f.masque.uid }, actionId);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, 'duplicate-action');
  assert.equal(relevantState(f), afterSuccess);
});
