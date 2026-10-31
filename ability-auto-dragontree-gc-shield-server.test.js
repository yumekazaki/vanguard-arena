'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const IDS = ['cfa-13498', 'cfa-13566', 'cfa-13607', 'cfa-13609', 'cfa-13638'];
const PATTERN = 'auto-gc-dragontree-grant-retire-to-soul-shield-battle-v1';
const GRANTED_PATTERN = 'auto-dragontree-gc-granted-retire-to-soul-v1';
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };

function instance(cardId, uid, playerId, overrides = {}) {
  const definition = cards.get(String(cardId));
  assert.ok(definition, `missing catalog card ${cardId}`);
  return { uid, cardId: String(cardId), cardName: definition.name, type: definition.type || 'Unit', grade: Number(definition.grade || 0), power: Number(definition.power || 0), critical: Number(definition.critical || 1), unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function abilityFor(cardId) {
  const definition = cards.get(cardId);
  return Engine.parseCardAbilities(definition).find(ability => ability.definition?.source?.patternId === PATTERN);
}

function fixture(cardId, side = 'bot', { marker = 'rear-left' } = {}) {
  const other = side === 'human' ? 'bot' : 'human';
  const ownerId = side === 'human' ? 'player-host' : 'player-guest';
  const attackerId = other === 'human' ? 'player-host' : 'player-guest';
  const battleId = `battle-${cardId}-${side}`;
  const source = instance(cardId, `guard-${cardId}-${side}`, ownerId, { zone: 'guardian', circle: 'guardian', position: 'rest' });
  const attacker = instance('cfa-3', `attacker-${side}`, attackerId, { zone: 'vanguard' });
  const target = instance('cfa-3', `target-${side}`, ownerId, { zone: 'vanguard' });
  const player = (playerId, vanguard, fields = {}) => ({ playerId, vanguard, rear: Array(5).fill(null), hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], giftZones: [], ...fields });
  const defender = player(ownerId, target, {
    guardCircle: [source],
    giftZones: marker ? [{ type: 'Dragontree', zone: marker }] : []
  });
  const attacking = player(attackerId, attacker);
  const players = side === 'human' ? { human: defender, bot: attacking } : { human: attacking, bot: defender };
  const attack = { battleId, attackerSide: other, attackerUid: attacker.uid, attackerPlayerId: attackerId, attackerZone: 'vanguard', defenderSide: side, targetUid: target.uid, targetZone: 'vanguard', guardCards: [source], power: 15000, targetPower: 10000, critical: 1 };
  const state = { matchId: `match-${cardId}-${side}`, stateVersion: 1, turn: 4, side: other, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingAttack: attack, players };
  const event = Engine.createGameEvent(state, {
    type: 'card.placed', actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: 'hand', currentLocation: 'guardian', circle: 'guardian', phase: 'battle', timingWindow: 'guard-placement', battleId
  });
  return { cardId, side, other, ownerId, attackerId, battleId, source, attacker, defender, state, event, ability: abilityFor(cardId) };
}

function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function decide(f, accept = true, auth = f.side === 'human' ? seats.hostAuthUid : seats.guestAuthUid, abilityId = null) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth,
    actionId: `resolve-${f.source.uid}-${f.state.stateVersion}-${accept}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: 'ability-response', accept, selection: { instanceUid: f.source.uid, abilityId: abilityId || f.state.pendingAbility?.ability?.id || f.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

function retirementEvent(f, patch = {}) {
  return Engine.createGameEvent(f.state, {
    type: 'card.retired', actingPlayerId: f.ownerId, turnPlayerId: f.attackerId,
    sourceCardInstanceId: f.source.uid, sourceOwnerPlayerId: f.ownerId, sourceControllerPlayerId: f.ownerId,
    cardInstanceId: f.source.uid, subjectCardInstanceId: f.source.uid, subjectOwnerPlayerId: f.ownerId, subjectControllerPlayerId: f.ownerId,
    previousLocation: 'guardian', currentLocation: 'drop', circle: 'guardian', phase: 'battle', timingWindow: 'guardian-retirement', battleId: f.battleId,
    ...patch
  });
}

test('all five exact printed abilities have a trusted, mandatory +5000 shield definition', () => {
  assert.equal(IDS.length, 5);
  for (const cardId of IDS) {
    const definition = cards.get(cardId);
    const ability = abilityFor(cardId);
    assert.ok(definition && ability, cardId);
    assert.match(ability.printedText, /^AUTO: When this unit is put on GC,/);
    assert.match(ability.printedText, /you may put this card into soul/);
    assert.equal(ability.canDecline, false, cardId);
    assert.equal(ability.definition.optional, false, cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(item => item.source?.patternId === PATTERN), true, cardId);
  }
});

test('the guard controller alone gets and resolves the effect on host or joining seat', () => {
  for (const cardId of IDS) for (const side of ['human', 'bot']) {
    const f = fixture(cardId, side);
    assert.ok(f.ability, cardId);
    const queued = discover(f);
    assert.equal(queued.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(queued.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.ability.canDecline, false);
    const result = decide(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.source.battleShieldBoost, 5000);
    assert.equal(f.source.battleShieldExpiryBattleId, f.battleId);
    assert.equal(f.state.pendingAttack.targetPower, 15000);
    assert.equal(f.source.gcDragontreeRetireToSoulBattleId, f.battleId);
  }
});

test('a granted AUTO follows the exact guard instance through retirement and only its controller may move it to Soul', () => {
  for (const side of ['human', 'bot']) {
    const f = fixture(IDS[0], side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(decide(f).ok, true);
    f.defender.guardCircle = [];
    f.source.zone = 'drop';
    f.defender.drop.push(f.source);
    const retired = retirementEvent(f);
    const queued = discover(f, retired);
    assert.equal(queued.queued.length, 1, `${side}: ${JSON.stringify({ skipped: queued.skipped, marker: f.source.gcDragontreeRetireToSoulBattleId, state: f.state.pendingAttack, retired, located: Engine.locateCardInstance(f.state, f.source.uid) })}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.ability.definition.source.patternId, GRANTED_PATTERN);
    assert.equal(f.state.pendingAbility.ability.canDecline, true);
    const result = decide(f, true);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.defender.drop.length, 0);
    assert.deepEqual(f.defender.soul.map(card => card.uid), [f.source.uid]);
    assert.equal(f.source.gcDragontreeRetireToSoulBattleId, undefined);
  }
});

test('the granted retirement AUTO is optional and host cannot decide for the joining player', () => {
  const declined = fixture(IDS[1], 'bot');
  assert.equal(discover(declined).queued.length, 1);
  assert.equal(decide(declined).ok, true);
  declined.defender.guardCircle = [];
  declined.source.zone = 'drop';
  declined.defender.drop.push(declined.source);
  assert.equal(discover(declined, retirementEvent(declined)).queued.length, 1);
  assert.equal(decide(declined, false).ok, true);
  assert.deepEqual(declined.defender.drop.map(card => card.uid), [declined.source.uid]);
  assert.equal(declined.defender.soul.length, 0);
  assert.equal(declined.source.gcDragontreeRetireToSoulBattleId, undefined);

  const joined = fixture(IDS[2], 'bot');
  assert.equal(discover(joined).queued.length, 1);
  const before = JSON.stringify(joined.state);
  assert.equal(decide(joined, true, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(joined.state), before);
});

test('the AUTO rejects missing, opponent-owned, or Vanguard-only markers and other GC entrants', () => {
  for (const cardId of IDS) {
    const noMarker = fixture(cardId, 'bot', { marker: null });
    assert.equal(discover(noMarker).queued.length, 0, `${cardId}/no-marker`);

    const opponentMarker = fixture(cardId, 'bot', { marker: null });
    opponentMarker.state.players.human.giftZones.push({ type: 'Dragontree', zone: 'rear-left' });
    assert.equal(discover(opponentMarker).queued.length, 0, `${cardId}/opponent-marker`);

    const vanguardMarker = fixture(cardId, 'bot', { marker: 'vanguard' });
    assert.equal(discover(vanguardMarker).queued.length, 0, `${cardId}/vanguard-marker`);

    const otherEntrant = fixture(cardId, 'bot');
    const forged = Engine.createGameEvent(otherEntrant.state, {
      ...otherEntrant.event, eventId: 'other-guard-entered', sourceCardInstanceId: 'other-uid', cardInstanceId: 'other-uid',
      subjectCardInstanceId: 'other-uid', sourceOwnerPlayerId: otherEntrant.ownerId, subjectOwnerPlayerId: otherEntrant.ownerId
    });
    assert.equal(discover(otherEntrant, forged).queued.length, 0, `${cardId}/other-entrant`);
  }
});

test('wrong-battle and duplicate entry events cannot create a second or invalid prompt', () => {
  const wrong = fixture(IDS[3], 'bot');
  const wrongBattle = Engine.createGameEvent(wrong.state, { ...wrong.event, eventId: 'wrong-battle-event', battleId: 'other-battle' });
  assert.equal(discover(wrong, wrongBattle).queued.length, 0);

  const duplicate = fixture(IDS[4], 'bot');
  assert.equal(discover(duplicate).queued.length, 1);
  assert.equal(discover(duplicate).queued.length, 0);
  assert.equal(Number(Boolean(duplicate.state.pendingAbility)) + (duplicate.state.pendingAbilities || []).length, 1);
});

test('the temporary ability and shield expire when that exact battle closes', () => {
  const f = fixture(IDS[3], 'bot');
  assert.equal(discover(f).queued.length, 1);
  assert.equal(decide(f).ok, true);
  assert.equal(f.source.gcDragontreeRetireToSoulBattleId, f.battleId);
  assert.equal(f.source.battleShieldBoost, 5000);
  f.state.pendingAttack.defenderDone = true;
  f.state.pendingAttack.driveCountPrompt = false;
  f.state.pendingAttack.driveChecksRemaining = 0;
  f.state.pendingAttack.awaitingDrive = false;
  f.state.pendingAttack.blocked = true;
  const result = Reducer.applyGameAction(f.state, {
    actorAuthUid: seats.hostAuthUid,
    actionId: `close-${f.battleId}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { action: 'resolveBattle' }
  }, seats, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.pendingAttack, null);
  assert.equal(f.source.gcDragontreeRetireToSoulBattleId, undefined);
  assert.equal(f.source.battleShieldBoost, undefined);
  assert.equal(f.source.battleShieldExpiryBattleId, undefined);
});

test('invalid response, lost source, or lost marker causes no partial shield or granted ability', () => {
  const invalid = fixture(IDS[0], 'bot');
  assert.equal(discover(invalid).queued.length, 1);
  const beforeInvalid = JSON.stringify(invalid.state);
  assert.equal(decide(invalid, true, seats.guestAuthUid, 'wrong-ability').ok, false);
  assert.equal(JSON.stringify(invalid.state), beforeInvalid);

  const moved = fixture(IDS[1], 'bot');
  assert.equal(discover(moved).queued.length, 1);
  moved.defender.guardCircle = [];
  moved.source.zone = 'drop';
  moved.defender.drop.push(moved.source);
  const beforeMoved = JSON.stringify(moved.state);
  assert.equal(decide(moved).ok, false);
  assert.equal(JSON.stringify(moved.state), beforeMoved);
  assert.equal(moved.state.pendingAttack.targetPower, 10000);
  assert.equal(moved.source.battleShieldBoost, undefined);
  assert.equal(moved.source.gcDragontreeRetireToSoulBattleId, undefined);

  const markerRemoved = fixture(IDS[2], 'bot');
  assert.equal(discover(markerRemoved).queued.length, 1);
  markerRemoved.defender.giftZones = [];
  const beforeMarker = JSON.stringify(markerRemoved.state);
  assert.equal(decide(markerRemoved).ok, false);
  assert.equal(JSON.stringify(markerRemoved.state), beforeMarker);
  assert.equal(markerRemoved.source.battleShieldBoost, undefined);
  assert.equal(markerRemoved.state.pendingAttack.targetPower, 10000);
});

test('retiring a different source, from the wrong destination, or in another battle cannot resolve the temporary AUTO', () => {
  const f = fixture(IDS[4], 'bot');
  assert.equal(discover(f).queued.length, 1);
  assert.equal(decide(f).ok, true);
  f.defender.guardCircle = [];
  f.source.zone = 'drop';
  f.defender.drop.push(f.source);
  for (const patch of [
    { eventId: 'retire-other-source', sourceCardInstanceId: 'other', cardInstanceId: 'other', subjectCardInstanceId: 'other' },
    { eventId: 'retire-to-soul', currentLocation: 'soul' },
    { eventId: 'retire-other-battle', battleId: 'other-battle' }
  ]) assert.equal(discover(f, retirementEvent(f, patch)).queued.length, 0, JSON.stringify(patch));
  assert.equal(f.defender.soul.length, 0);
});
