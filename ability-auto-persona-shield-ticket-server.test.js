'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const IDS = ['cfa-13707', 'cfa-13709', 'cfa-13710', 'cfa-13711', 'cfa-13712', 'cfa-13713'];
const AUTO_TEXT = 'AUTO: When this card is placed on RC from hand other than by a unit card’s ability or discarded from hand while riding from the ride deck, choose a card with persona ride from your ride deck, and you may reveal it. If you revealed a card or have a vanguard with persona ride, COST [Soul Blast 1], and put a Persona Shield ticket into hand.';
const CONT_TEXT = 'CONT [Hand]: During your turn, when you would discard a card while riding from ride deck or choose a card from hand by your card’s ability, this card cannot be chosen or discarded.';
const PATTERN = 'auto-hand-rc-or-ride-deck-discard-persona-shield-ticket-v1';
const PERSONA_RIDE_ID = 'cfa-10400';
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const ABILITIES = IDS.map(cardId => {
  const card = CATALOG.get(cardId);
  assert.ok(card, `catalog contains ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `exact AUTO ${cardId}:0 exists`);
  return ability;
});

function instance(cardId, uid, playerId, extra = {}) {
  const card = CATALOG.get(String(cardId));
  assert.ok(card, `catalog contains ${cardId}`);
  return {
    uid, cardId: String(cardId), cardName: card.name, type: card.type,
    grade: Number(card.grade), ownerPlayerId: playerId, controllerPlayerId: playerId,
    unitCard: /\b(?:unit|trigger)\b/i.test(String(card.type)), shield: Number(card.shield || 0),
    ...extra
  };
}

function fixture({ cardId = 'cfa-13707', side = 'human', branch = 'place', personaVanguard = false, withSoul = true, withRideCard = true } = {}) {
  const playerId = side === 'human' ? 'player-host' : 'player-guest';
  const otherSide = side === 'human' ? 'bot' : 'human';
  const otherId = otherSide === 'human' ? 'player-host' : 'player-guest';
  const source = instance(cardId, `persona-source-${side}`, playerId, { circle: 'rear-left', rested: false });
  const vanguard = instance(personaVanguard ? PERSONA_RIDE_ID : 'cfa-1', `vanguard-${side}`, playerId, { circle: 'vanguard' });
  const own = {
    playerId, format: 'standard', vanguard, rear: Array(5).fill(null), accelZones: 0, accelTypes: [],
    giftZones: [], deck: [], hand: [], soul: [], drop: [], bind: [], damage: [], orders: [],
    guardCircle: [], triggerZone: [], gDeck: [], gZone: [], energy: 0, rideDeck: [], ridePerformed: false
  };
  const enemy = {
    playerId: otherId, format: 'standard', vanguard: instance('cfa-1', `enemy-vanguard-${side}`, otherId),
    rear: Array(5).fill(null), accelZones: 0, accelTypes: [], giftZones: [], deck: [], hand: [], soul: [],
    drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [],
    energy: 0, rideDeck: [], ridePerformed: false
  };
  if (branch === 'place') own.rear[0] = source;
  else own.drop.push(source);
  if (withSoul) own.soul.push(instance('cfa-2', `soul-${side}`, playerId));
  if (withRideCard) own.rideDeck.push(instance(PERSONA_RIDE_ID, `persona-ride-${side}`, playerId));
  const state = {
    matchId: `persona-shield-${side}-${branch}-${cardId}`, stateVersion: 1, turn: 3, side,
    phase: branch === 'place' ? 4 : 2, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [],
    processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null,
    players: side === 'human' ? { human: own, bot: enemy } : { human: enemy, bot: own }
  };
  const event = Engine.createGameEvent(state, branch === 'place' ? {
    type: 'card.placed', actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId,
    subjectControllerPlayerId: playerId, previousLocation: 'hand', currentLocation: 'rear-left', circle: 'rear-left',
    phase: 'main', timingWindow: 'normal-call'
  } : {
    type: 'card.discarded', actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId,
    subjectControllerPlayerId: playerId, previousLocation: 'hand', currentLocation: 'drop',
    phase: 'ride', timingWindow: 'ride-deck-cost', discardReason: 'ride-deck-cost'
  });
  return { state, side, playerId, otherSide, otherId, source, own, enemy, event };
}

function authFor(side) { return side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid; }

function discover(f) {
  const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(result.queued.length, 1, `${f.source.cardId}/${f.side}: ${JSON.stringify(result.skipped)}`);
  assert.equal(f.state.pendingAbility.side, f.side);
  assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
  assert.equal(f.state.pendingAbility.ability.canDecline, false);
  return f.state.pendingAbility.ability;
}

function resolve(f, ability, { revealUid = null, soulUid = null, actionId = `resolve-${f.side}-${f.event.eventId}` } = {}) {
  const selection = { instanceUid: f.source.uid, abilityId: ability.id, costSelections: {} };
  if (revealUid) selection.effectUid = revealUid;
  if (soulUid) selection.costSelections.sb = [soulUid];
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authFor(f.side), actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept: true, selection }
  }, SEATS, Engine);
}

test('the six exact :0 AUTO records and Persona Shield CONT compile as narrow trusted definitions', () => {
  assert.equal(ABILITIES.length, 6);
  for (const ability of ABILITIES) {
    assert.equal(ability.printedText, AUTO_TEXT);
    assert.equal(ability.definition?.source?.patternId, PATTERN);
    assert.equal(ability.definition?.optional, false);
    assert.deepEqual(ability.definition?.costs, [{ type: 'soul-blast', count: 1 }]);
    assert.equal(ability.trigger?.anyOf?.length, 2);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    const other = Engine.parseCardAbilitiesCached(CATALOG.get(ability.cardId)).find(item => item.id === `${ability.cardId}:1`);
    assert.equal(other?.definition?.source?.patternId, 'auto-own-attack-target-grade-power-battle-v1');
  }
  const shield = Engine.parseCardAbilitiesCached(CATALOG.get('cfa-13708')).find(item => item.id === 'cfa-13708:0');
  assert.equal(shield.printedText, CONT_TEXT);
  assert.equal(shield.definition?.source?.patternId, 'cont-persona-shield-ticket-hand-protection-v1');
  assert.deepEqual(shield.definition?.continuousRestrictions, [{ type: 'persona-shield-hand-protection', ownTurnOnly: true, protectRideDeckDiscard: true, protectCardAbilityChoices: true }]);
  for (const id of IDS) assert.deepEqual(Engine.getReviewedAbilityDefinitionsForCard(id).map(item => item.id).sort(), [`${id}:0`, `${id}:1`].sort());
});

test('each of the six exact source instances recognizes both the hand-to-RC and Ride Deck discard branch', () => {
  for (const cardId of IDS) for (const branch of ['place', 'discard']) {
    const f = fixture({ cardId, side: branch === 'place' ? 'human' : 'bot', branch });
    const ability = discover(f);
    assert.equal(ability.id, `${cardId}:0`);
    const forged = { ...f.event, eventId: `${f.event.eventId}:forged`, subjectCardInstanceId: 'other-card', cardInstanceId: 'other-card' };
    const rejected = fixture({ cardId, side: f.side, branch });
    assert.equal(Reducer.discoverAutoTriggers(rejected.state, [forged], Engine).queued.length, 0, `${cardId}/${branch} rejects another event subject`);
  }
});

test('normal hand placement and Ride Deck cost discard resolve for either seat with that controller’s reveal and Soul Blast', () => {
  for (const side of ['human', 'bot']) {
    const place = fixture({ cardId: IDS[side === 'human' ? 0 : 5], side, branch: 'place' });
    const ability = discover(place);
    const soulUid = place.own.soul[0].uid, revealUid = place.own.rideDeck[0].uid;
    const result = resolve(place, ability, { soulUid, revealUid, actionId: `place-${side}` });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(place.own.soul.length, 0);
    assert.equal(place.own.drop.some(card => card.uid === soulUid), true);
    assert.equal(place.own.rideDeck.some(card => card.uid === revealUid), true);
    assert.equal(result.events.some(event => event.type === 'card.revealed' && event.cardInstanceId === revealUid), true);
    const ticket = place.own.hand.find(card => card.cardId === 'cfa-13708');
    assert.ok(ticket);
    assert.equal(ticket.ownerPlayerId, place.playerId);
    assert.equal(ticket.controllerPlayerId, place.playerId);
    assert.equal(ticket.personaShieldTicket, true);
    assert.equal(place.enemy.hand.some(card => card.cardId === 'cfa-13708'), false);
  }

  const rideDiscard = fixture({ cardId: 'cfa-13711', side: 'bot', branch: 'place' });
  rideDiscard.own.rear[0] = null;
  rideDiscard.own.hand.push(rideDiscard.source);
  rideDiscard.state.phase = 2;
  rideDiscard.own.rideDeck.push(instance('cfa-1', 'ride-deck-rider-bot', rideDiscard.playerId));
  const rideAction = Reducer.applyGameAction(rideDiscard.state, {
    actorAuthUid: SEATS.guestAuthUid, actionId: 'ride-deck-trigger', expectedStateVersion: rideDiscard.state.stateVersion,
    payload: { action: 'rideDeck', rideDeckCardInstanceId: 'ride-deck-rider-bot', discardCardInstanceId: rideDiscard.source.uid }
  }, SEATS, Engine);
  assert.equal(rideAction.ok, true, JSON.stringify(rideAction));
  assert.ok(rideDiscard.state.pendingAbility, 'Ride Deck action discovers the discarded source AUTO');
  assert.equal(rideDiscard.state.pendingAbility.instance.uid, rideDiscard.source.uid);
  const ability = rideDiscard.state.pendingAbility.ability;
  const soulUid = rideDiscard.own.soul[0].uid, revealUid = rideDiscard.own.rideDeck.find(card => card.cardId === PERSONA_RIDE_ID).uid;
  const result = resolve(rideDiscard, ability, { soulUid, revealUid, actionId: 'ride-discard-bot' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(rideDiscard.own.hand.some(card => card.cardId === 'cfa-13708' && card.ownerPlayerId === rideDiscard.playerId), true);
});

test('placement from a non-Unit card ability qualifies while placement from a Unit ability does not', () => {
  const f = fixture({ cardId: 'cfa-13710', side: 'human', branch: 'place' });
  const normalOrder = [...CATALOG.values()].find(card => /order/i.test(String(card.type || '')));
  assert.ok(normalOrder, 'a non-Unit Order definition is available');
  const order = instance(normalOrder.id, 'order-ability-source', f.playerId);
  f.own.orders.push(order);
  const event = Engine.createGameEvent(f.state, {
    type: 'card.placed', actingPlayerId: f.playerId, turnPlayerId: f.playerId,
    sourceCardInstanceId: order.uid, sourceOwnerPlayerId: f.playerId, sourceControllerPlayerId: f.playerId,
    abilitySourceInstanceId: order.uid, abilitySourceOwnerPlayerId: f.playerId, abilitySourceControllerPlayerId: f.playerId,
    cardInstanceId: f.source.uid, subjectCardInstanceId: f.source.uid, subjectOwnerPlayerId: f.playerId,
    subjectControllerPlayerId: f.playerId, previousLocation: 'hand', currentLocation: 'rear-left',
    phase: 'main', timingWindow: 'effect-placement'
  });
  const discovery = Reducer.discoverAutoTriggers(f.state, [event], Engine);
  assert.equal(discovery.queued.length, 1, JSON.stringify(discovery.skipped));
  const ability = f.state.pendingAbility.ability;
  const result = resolve(f, ability, { revealUid: f.own.rideDeck[0].uid, soulUid: f.own.soul[0].uid, actionId: 'non-unit-effect-placement' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.own.hand.some(card => card.cardId === 'cfa-13708'), true);
});

test('a Persona Ride Vanguard permits ticket generation without revealing; no qualifying condition has no cost or ticket', () => {
  const vanguardPersona = fixture({ cardId: 'cfa-13709', side: 'bot', branch: 'place', personaVanguard: true, withRideCard: false });
  const ability = discover(vanguardPersona);
  const soulUid = vanguardPersona.own.soul[0].uid;
  const result = resolve(vanguardPersona, ability, { soulUid, actionId: 'vanguard-persona-no-reveal' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(vanguardPersona.own.hand.filter(card => card.cardId === 'cfa-13708').length, 1);
  assert.equal(result.events.some(event => event.type === 'card.revealed'), false);
  assert.equal(vanguardPersona.own.drop.some(card => card.uid === soulUid), true);

  const noCondition = fixture({ cardId: 'cfa-13710', side: 'human', branch: 'place', withSoul: false, withRideCard: false });
  const noConditionAbility = discover(noCondition);
  const noEffect = resolve(noCondition, noConditionAbility, { actionId: 'no-persona-no-ticket' });
  assert.equal(noEffect.ok, true, JSON.stringify(noEffect));
  assert.equal(noCondition.own.hand.some(card => card.cardId === 'cfa-13708'), false);
  assert.equal(noCondition.own.soul.length, 0);
});

test('rejects Unit ability placement, stale or wrong-zone events, and a non-Persona-Ride reveal without cost loss', () => {
  const byUnit = fixture({ cardId: 'cfa-13707', side: 'human', branch: 'place' });
  const unitSource = instance('cfa-20', 'unit-ability-source', byUnit.playerId, { circle: 'rear-right' });
  byUnit.own.rear[1] = unitSource;
  const unitEvent = Engine.createGameEvent(byUnit.state, {
    type: 'card.placed', actingPlayerId: byUnit.playerId, turnPlayerId: byUnit.playerId,
    sourceCardInstanceId: unitSource.uid, sourceOwnerPlayerId: byUnit.playerId, sourceControllerPlayerId: byUnit.playerId,
    abilitySourceInstanceId: unitSource.uid, abilitySourceOwnerPlayerId: byUnit.playerId, abilitySourceControllerPlayerId: byUnit.playerId,
    cardInstanceId: byUnit.source.uid, subjectCardInstanceId: byUnit.source.uid, subjectOwnerPlayerId: byUnit.playerId,
    subjectControllerPlayerId: byUnit.playerId, previousLocation: 'hand', currentLocation: 'rear-left',
    phase: 'main', timingWindow: 'effect-placement'
  });
  assert.equal(Reducer.discoverAutoTriggers(byUnit.state, [unitEvent], Engine).queued.length, 0);
  assert.equal(Reducer.discoverAutoTriggers(byUnit.state, [{ ...byUnit.event, previousLocation: 'drop' }], Engine).queued.length, 0);
  assert.equal(Reducer.discoverAutoTriggers(byUnit.state, [{ ...byUnit.event, currentLocation: 'guardian' }], Engine).queued.length, 0);

  const invalidReveal = fixture({ cardId: 'cfa-13713', side: 'bot', branch: 'place' });
  const invalidAbility = discover(invalidReveal);
  invalidReveal.own.rideDeck[0] = instance('cfa-1', 'not-persona-ride', invalidReveal.playerId);
  const soulUid = invalidReveal.own.soul[0].uid;
  const rejected = resolve(invalidReveal, invalidAbility, { soulUid, revealUid: 'not-persona-ride', actionId: 'bad-reveal' });
  assert.equal(rejected.ok, false);
  assert.equal(invalidReveal.own.soul.some(card => card.uid === soulUid), true);
  assert.equal(invalidReveal.own.hand.some(card => card.cardId === 'cfa-13708'), false);

  const duplicate = fixture({ cardId: 'cfa-13712', side: 'human', branch: 'place' });
  const duplicateAbility = discover(duplicate);
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 0);
  const duplicateResult = resolve(duplicate, duplicateAbility, {
    actionId: 'duplicate-shield-resolution', revealUid: duplicate.own.rideDeck[0].uid, soulUid: duplicate.own.soul[0].uid
  });
  assert.equal(duplicateResult.ok, true);
  const second = resolve(duplicate, duplicateAbility, { actionId: 'duplicate-shield-resolution-replay' });
  assert.equal(second.ok, false);
  assert.equal(duplicate.own.hand.filter(card => card.cardId === 'cfa-13708').length, 1);
  assert.equal(Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event], Engine).queued.length, 0);
});

test('Persona Shield is protected from Ride Deck discard and the owner’s ability choices during that owner’s turn', () => {
  const f = fixture({ side: 'human', branch: 'discard', withRideCard: false });
  f.own.hand.push(instance('cfa-13708', 'persona-ticket', f.playerId, { unitCard: false, personaShieldTicket: true }));
  f.own.rideDeck.push(instance('cfa-1', 'ride-source', f.playerId));
  const protectedRide = Reducer.applyGameAction(f.state, {
    actorAuthUid: SEATS.hostAuthUid, actionId: 'protected-ride-cost', expectedStateVersion: f.state.stateVersion,
    payload: { action: 'rideDeck', rideDeckCardInstanceId: 'ride-source', discardCardInstanceId: 'persona-ticket' }
  }, SEATS, Engine);
  assert.equal(protectedRide.ok, false);
  assert.equal(protectedRide.reason, 'persona-shield-ticket-protected-from-ride-deck-cost');
  assert.equal(f.own.hand.some(card => card.uid === 'persona-ticket'), true);

  f.state.pendingAbility = { side: 'human', instance: f.source, triggerControllerPlayerId: f.playerId, ability: { id: 'cfa-13707:1' } };
  const protectedChoice = Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: SEATS.hostAuthUid, actionId: 'protected-ability-choice', expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: 'cfa-13707:1', targetUid: 'persona-ticket' } }
  }, SEATS, Engine);
  assert.equal(protectedChoice.ok, false);
  assert.equal(protectedChoice.reason, 'persona-shield-ticket-protected-from-ability-choice');

  const manualSource = instance('cfa-133', 'manual-ability-source', f.playerId, { circle: 'rear-right' });
  f.own.rear[1] = manualSource;
  f.state.pendingAbility = null;
  f.state.phase = 4;
  const manualAbility = Engine.parseCardAbilitiesCached(CATALOG.get('cfa-133')).find(item => item.kind === 'ACT');
  assert.ok(manualAbility?.definition, 'the regression fixture has a reviewed ACT ability');
  const protectedManualChoice = Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: SEATS.hostAuthUid, actionId: 'protected-manual-ability-choice', expectedStateVersion: f.state.stateVersion,
    payload: { sourceCardInstanceId: manualSource.uid, abilityId: manualAbility.id, selection: { targetUid: 'persona-ticket' } }
  }, SEATS, Engine);
  assert.equal(protectedManualChoice.ok, false);
  assert.equal(protectedManualChoice.reason, 'persona-shield-ticket-protected-from-ability-choice');

  f.state.side = 'bot';
  f.state.pendingAbility = null;
  const otherTurnChoice = Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: SEATS.hostAuthUid, actionId: 'other-turn-selection', expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: 'cfa-13707:1', targetUid: 'persona-ticket' } }
  }, SEATS, Engine);
  assert.notEqual(otherTurnChoice.reason, 'persona-shield-ticket-protected-from-ability-choice');

  f.state.side = 'human';
  f.state.pendingAbility = null;
  f.state.phase = 2;
  f.own.hand.push(instance('cfa-2', 'ordinary-discard', f.playerId));
  const ordinaryRide = Reducer.applyGameAction(f.state, {
    actorAuthUid: SEATS.hostAuthUid, actionId: 'ordinary-ride-cost', expectedStateVersion: f.state.stateVersion,
    payload: { action: 'rideDeck', rideDeckCardInstanceId: 'ride-source', discardCardInstanceId: 'ordinary-discard' }
  }, SEATS, Engine);
  assert.equal(ordinaryRide.ok, true, JSON.stringify(ordinaryRide));
  assert.equal(f.own.hand.some(card => card.uid === 'persona-ticket'), true);
});
