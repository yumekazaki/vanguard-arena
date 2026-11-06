'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const CARD_ID = 'cfa-7952';
const ABILITY_ID = `${CARD_ID}:1`;
const PATTERN = 'auto-rc-opponent-discard-shield-power-draw-v1';
const SEATS = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const SOURCE_DEFINITION = CATALOG.get(CARD_ID);
const CHOICE_DEFINITION = CATALOG.get('cfa-1');
assert.ok(SOURCE_DEFINITION, 'Sadamune is present in the card catalog');
assert.equal(Number(CHOICE_DEFINITION?.shield), 10000, 'the chosen real card has a known printed shield value');

function instance(cardId, uid, playerId, zone) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog contains ${cardId}`);
  return {
    uid,
    cardId: String(cardId),
    cardName: definition.name,
    type: definition.type,
    grade: Number(definition.grade || 0),
    shield: Number(definition.shield || 0),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    zone,
    ...(zone === 'rear-guard' ? { circle: 'rear-left' } : {})
  };
}

function fixture(controllerSide = 'human', { opponentHand = true } = {}) {
  const controllerId = controllerSide === 'human' ? 'player-host' : 'player-guest';
  const chooserSide = controllerSide === 'human' ? 'bot' : 'human';
  const chooserId = chooserSide === 'human' ? 'player-host' : 'player-guest';
  const makePlayer = playerId => ({
    playerId,
    vanguard: instance('cfa-1', `vg-${playerId}`, playerId, 'vanguard'),
    rear: Array(5).fill(null),
    hand: [], soul: [], damage: [], deck: [], drop: [], bind: [], orders: [],
    guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  });
  const players = { human: makePlayer('player-host'), bot: makePlayer('player-guest') };
  const controller = players[controllerSide], chooser = players[chooserSide];
  const source = instance(CARD_ID, `sadamune-${controllerSide}`, controllerId, 'rear-guard');
  controller.rear[0] = source;
  const soul = instance('cfa-2', `soul-${controllerSide}`, controllerId, 'soul');
  controller.soul.push(soul);
  const chosen = instance('cfa-1', `opponent-choice-${controllerSide}`, chooserId, 'hand');
  if (opponentHand) chooser.hand.push(chosen);
  const drawn = instance('cfa-3', `opponent-draw-${controllerSide}`, chooserId, 'deck');
  chooser.deck.push(drawn);
  const state = {
    matchId: `opponent-discard-shield-${controllerSide}`,
    stateVersion: 4,
    eventSequence: 0,
    turn: 6,
    side: controllerSide,
    phase: 4,
    players,
    processedActionIds: [],
    processedEventIds: [],
    processedAbilityTriggers: [],
    pendingAbility: null,
    pendingAbilities: [],
    pendingEffectChoice: null
  };
  const event = Engine.createGameEvent(state, {
    eventId: `sadamune-placed-${controllerSide}`,
    type: 'card.placed',
    actingPlayerId: controllerId,
    turnPlayerId: controllerId,
    sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: controllerId,
    sourceControllerPlayerId: controllerId,
    cardInstanceId: source.uid,
    subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: controllerId,
    subjectControllerPlayerId: controllerId,
    previousLocation: 'hand',
    currentLocation: 'rear-left',
    circle: 'rear-left',
    phase: 'main',
    timingWindow: 'normal-call'
  });
  const ability = Engine.parseCardAbilitiesCached(SOURCE_DEFINITION).find(item => item.id === ABILITY_ID);
  assert.ok(ability, 'the exact second AUTO is present');
  return { state, event, source, soul, chosen, drawn, controller, chooser, controllerSide, chooserSide, controllerId, chooserId, ability };
}

function authFor(side) { return side === 'human' ? SEATS.hostAuthUid : SEATS.guestAuthUid; }

function discover(f) {
  assert.equal(f.ability.definition?.source?.patternId, PATTERN);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(result.queued.length, 1, JSON.stringify(result.skipped));
  assert.equal(f.state.pendingAbility.side, f.controllerSide);
  assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
  return f.state.pendingAbility.ability;
}

function payCost(f, actionId = `activate-${f.controllerSide}`) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authFor(f.controllerSide),
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      type: 'ability-response',
      accept: true,
      selection: {
        instanceUid: f.source.uid,
        abilityId: ABILITY_ID,
        costSelections: { cb: [], sb: [f.soul.uid], discard: [], reveal: [] }
      }
    }
  }, SEATS, Engine);
}

function choose(f, {
  actorAuthUid = authFor(f.chooserSide),
  actionId = `choose-${f.chooserSide}`,
  expectedStateVersion = f.state.stateVersion,
  instanceUid = f.source.uid,
  abilityId = ABILITY_ID,
  effectChoiceUid = f.chosen.uid
} = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion,
    payload: { type: 'ability-response', accept: true, selection: { instanceUid, abilityId, effectChoiceUid } }
  }, SEATS, Engine);
}

test('host and joining player resolve the opponent-private discard choice in their own seat', () => {
  for (const controllerSide of ['human', 'bot']) {
    const f = fixture(controllerSide);
    discover(f);

    const suspended = payCost(f);
    assert.equal(suspended.ok, true, `${controllerSide}: ${JSON.stringify(suspended)}`);
    assert.equal(suspended.resolution, 'waiting-for-authorized-opponent-choice');
    assert.equal(f.state.pendingAbility, null);
    assert.equal(f.state.pendingEffectChoice?.chooserSide, f.chooserSide);
    assert.equal(f.state.pendingEffectChoice?.chooserPlayerId, f.chooserId);
    assert.equal(f.state.pendingEffectChoice?.controllerSide, f.controllerSide);
    assert.equal(f.state.pendingEffectChoice?.controllerPlayerId, f.controllerId);
    assert.deepEqual(f.controller.soul, [], 'Soul Blast is paid before suspending');
    assert.equal(f.controller.drop.some(card => card.uid === f.soul.uid), true);
    assert.equal(f.chooser.hand.some(card => card.uid === f.chosen.uid), true, 'the choice remains private and unresolved until the chooser decides');
    assert.deepEqual(f.chooser.drop, []);
    assert.equal(f.chooser.hand.some(card => card.uid === f.drawn.uid), false, 'the follow-up draw waits for the discard choice');

    const unauthorizedBefore = JSON.stringify(f.state);
    const unauthorized = choose(f, { actorAuthUid: authFor(f.controllerSide), actionId: `wrong-seat-${controllerSide}` });
    assert.equal(unauthorized.ok, false);
    assert.equal(unauthorized.reason, 'effect-choice-not-authorized');
    assert.equal(JSON.stringify(f.state), unauthorizedBefore, 'the controller cannot make the opponent’s choice');

    const staleBefore = JSON.stringify(f.state);
    const stale = choose(f, { actionId: `stale-${controllerSide}`, expectedStateVersion: f.state.stateVersion - 1 });
    assert.equal(stale.ok, false);
    assert.equal(stale.reason, 'stale-state-version');
    assert.equal(JSON.stringify(f.state), staleBefore, 'stale decisions do not partially resolve the effect');

    const forgedBefore = JSON.stringify(f.state);
    const forged = choose(f, { actionId: `foreign-card-${controllerSide}`, effectChoiceUid: f.soul.uid });
    assert.equal(forged.ok, false);
    assert.equal(forged.reason, 'effect-choice-card-not-in-own-hand');
    assert.equal(JSON.stringify(f.state), forgedBefore, 'a card outside the chooser’s hand cannot be discarded');

    const completed = choose(f);
    assert.equal(completed.ok, true, `${controllerSide}: ${JSON.stringify(completed)}`);
    assert.equal(completed.effectChoiceResolved, true);
    assert.equal(f.state.pendingEffectChoice, null);
    assert.equal(f.state.pendingAbility, null);
    assert.deepEqual(f.controller.soul, [], 'resuming does not pay Soul Blast a second time');
    assert.equal(f.controller.drop.filter(card => card.uid === f.soul.uid).length, 1);
    assert.equal(f.chooser.hand.some(card => card.uid === f.chosen.uid), false);
    assert.equal(f.chooser.drop.some(card => card.uid === f.chosen.uid), true);
    assert.equal(f.chooser.hand.some(card => card.uid === f.drawn.uid), true, 'the chooser draws the card after discarding');
    assert.equal(f.chooser.deck.some(card => card.uid === f.drawn.uid), false);
    assert.equal(Number(f.source.turnPowerBoost), Number(f.chosen.shield));
    assert.equal(f.source.turnPowerExpiry, f.controllerId);
    const discardEvent = completed.events.find(event => event.type === 'card.discarded' && event.cardInstanceId === f.chosen.uid);
    assert.ok(discardEvent, 'the selected hand instance produces one discard event');
    assert.equal(discardEvent.subjectOwnerPlayerId, f.chooserId);
    assert.equal(discardEvent.subjectControllerPlayerId, f.chooserId);
    assert.equal(discardEvent.effectProvenance?.sourceAbilityId, ABILITY_ID);
    const drawEvent = completed.events.find(event => event.type === 'card.drawn' && event.cardInstanceId === f.drawn.uid);
    assert.ok(drawEvent, 'the opponent draw is emitted after the selected discard');
    assert.equal(drawEvent.subjectOwnerPlayerId, f.chooserId);
    assert.equal(drawEvent.subjectControllerPlayerId, f.chooserId);

    const replayBefore = JSON.stringify(f.state);
    const replay = choose(f);
    assert.equal(replay.ok, false);
    assert.equal(replay.reason, 'duplicate-action');
    assert.equal(JSON.stringify(f.state), replayBefore, 'replaying the accepted action cannot resolve the choice twice');
  }
});

test('a foreign-owned card placed in the chooser hand is rejected without resolving or charging again', () => {
  const f = fixture('human');
  discover(f);
  assert.equal(payCost(f).ok, true);
  const stolen = instance('cfa-4', 'foreign-owned-hand-card', f.controllerId, 'hand');
  stolen.controllerPlayerId = f.chooserId;
  f.chooser.hand.push(stolen);
  const before = JSON.stringify(f.state);
  const rejected = choose(f, { actionId: 'foreign-owned-choice', effectChoiceUid: stolen.uid });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'effect-choice-card-not-in-own-hand');
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(f.controller.soul.length, 0, 'the already-paid cost remains paid once, without repeated payment');
});

test('when the opponent has no hand, the AUTO completes without suspending and still draws for that opponent', () => {
  const f = fixture('bot', { opponentHand: false });
  discover(f);
  const result = payCost(f);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.state.pendingEffectChoice, null);
  assert.equal(f.state.pendingAbility, null);
  assert.deepEqual(f.controller.soul, []);
  assert.equal(f.source.turnPowerBoost || 0, 0, 'there is no discarded shield to add');
  assert.deepEqual(f.chooser.hand.map(card => card.uid), [f.drawn.uid]);
  assert.deepEqual(f.chooser.deck, []);
});
