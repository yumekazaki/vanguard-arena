"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const Projection = require("./match-state-projection.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-ride-grade-one-race-top-seven-memory-v1";
const EFFECT = "search-top-up-to-one-filtered-to-memory";
const FAMILY = Object.freeze({
  "cfa-11543": {
    cardNumber: "DZ-BT02/EX15EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT02%2FEX15EN"
  },
  "cfa-11555": {
    cardNumber: "DZ-BT02/EX19EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT02%2FEX19EN"
  },
  "cfa-11668": {
    cardNumber: "DZ-BT02/EX27EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT02%2FEX27EN"
  }
});
const GRADE_ONE_QUINTUPLET = "cfa-11522";
const QUINTUPLET_TARGET = "cfa-11542";
const GRADE_TWO_QUINTUPLET = "cfa-11546";
const NON_QUINTUPLET = "cfa-3";
const CATALOG = loadCatalog();
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(cardId) {
  const value = CATALOG.find(entry => String(entry.id) === String(cardId));
  assert.ok(value, `catalog card ${cardId} exists`);
  return value;
}

function instance(cardId, uid, playerId) {
  const definition = card(cardId);
  return {
    uid,
    cardId: String(cardId),
    cardName: definition.name,
    type: definition.type || "Unit",
    grade: Number(definition.grade || 0),
    unitCard: String(definition.type || "").toLowerCase() === "unit",
    ownerPlayerId: playerId,
    controllerPlayerId: playerId
  };
}

function fixture({
  cardId = "cfa-11543",
  side = "bot",
  previousCardId = GRADE_ONE_QUINTUPLET,
  deckCardIds = [QUINTUPLET_TARGET, NON_QUINTUPLET, NON_QUINTUPLET, NON_QUINTUPLET, NON_QUINTUPLET, NON_QUINTUPLET, NON_QUINTUPLET, GRADE_ONE_QUINTUPLET],
  sourceCardInstanceId,
  targetCardInstanceId,
  eventType = "card.ridden",
  previousLocation = "hand",
  timingWindow = "normal-ride",
  phase = "ride",
  targetCardGrade,
  targetCardRace,
  targetCardRaces
} = {}) {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const rider = instance(cardId, `rider-${side}`, playerId);
  const previousVanguard = instance(previousCardId, `previous-vanguard-${side}`, playerId);
  const deck = deckCardIds.map((id, index) => instance(id, `deck-${side}-${index}`, playerId));
  const owner = {
    playerId,
    vanguard: rider,
    rear: Array(5).fill(null),
    hand: [],
    deck,
    soul: [previousVanguard],
    drop: [],
    damage: [],
    bind: [],
    orders: [],
    crests: [],
    guardCircle: [],
    gDeck: [],
    gZone: [],
    triggerZone: []
  };
  const opponent = {
    playerId: opponentId,
    vanguard: instance("cfa-11521", `opponent-vg-${side}`, opponentId),
    rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [],
    orders: [], crests: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const players = side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const state = {
    matchId: `quintuplet-top-seven-memory-${cardId}-${side}`,
    stateVersion: 3,
    eventSequence: 0,
    turn: 2,
    side,
    phase: 2,
    players,
    processedEventIds: [],
    processedAbilityTriggers: [],
    processedActionIds: [],
    pendingAbility: null,
    pendingAbilities: [],
    pendingAttack: null
  };
  const ability = Engine.parseCardAbilitiesCached(card(cardId)).find(entry => entry.id === `${cardId}:0`);
  assert.ok(ability, `ability ${cardId}:0 parses`);
  const actualPreviousDefinition = card(previousCardId);
  const event = Engine.createGameEvent(state, {
    eventId: `ride-${side}-${cardId}`,
    type: eventType,
    actingPlayerId: playerId,
    turnPlayerId: playerId,
    sourceCardInstanceId: sourceCardInstanceId || rider.uid,
    sourceCardName: card(cardId).name,
    sourceCardGrade: Number(card(cardId).grade),
    sourceOwnerPlayerId: playerId,
    sourceControllerPlayerId: playerId,
    cardInstanceId: sourceCardInstanceId || rider.uid,
    subjectCardInstanceId: sourceCardInstanceId || rider.uid,
    subjectOwnerPlayerId: playerId,
    subjectControllerPlayerId: playerId,
    previousLocation,
    currentLocation: "vanguard",
    targetCardInstanceIds: [targetCardInstanceId || previousVanguard.uid],
    targetCardName: actualPreviousDefinition.name,
    targetCardGrade: targetCardGrade ?? Number(actualPreviousDefinition.grade),
    targetCardRace: targetCardRace ?? (actualPreviousDefinition.race || "Quintuplet"),
    targetCardRaces: targetCardRaces || [targetCardRace || actualPreviousDefinition.race || "Quintuplet"],
    targetOwnerPlayerId: playerId,
    targetControllerPlayerId: playerId,
    targetPreviousLocation: "vanguard",
    targetCurrentLocation: "soul",
    targetLocation: "vanguard",
    phase,
    timingWindow
  });
  return {
    state, event, ability, side, playerId, opponentId, opponentSide,
    owner, opponent, rider, previousVanguard, deck,
    authUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid
  };
}

function discover(f) {
  return Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
}

function resolve(f, {
  actorAuthUid = f.authUid,
  effectUid = null,
  actionId = `resolve-${f.side}-${f.ability.id}-${effectUid || "none"}`
} = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "ability-response",
      accept: true,
      selection: {
        instanceUid: f.rider.uid,
        abilityId: f.ability.id,
        ...(effectUid ? { effectUid } : {})
      }
    }
  }, SEATS, Engine);
}

function rideAction(f, actionId = `server-ride-${f.side}`) {
  // Server action tests start before the ride: move the rider back to hand and
  // the prior grade-1 Vanguard to the Vanguard Circle before invoking the real reducer.
  f.owner.vanguard = f.previousVanguard;
  f.owner.soul = [];
  f.owner.hand = [f.rider];
  return Reducer.applyGameAction(f.state, {
    actorAuthUid: f.authUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "ride", cardInstanceId: f.rider.uid }
  }, SEATS, Engine);
}

test("the three official grade-1 Quintuplet ride abilities compile with a top-seven Memory effect", () => {
  for (const [cardId, source] of Object.entries(FAMILY)) {
    const catalogCard = card(cardId);
    const parsed = Engine.parseCardAbilitiesCached(catalogCard);
    const ability = parsed.find(entry => entry.id === `${cardId}:0`);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.source.dataset, "Bushiroad official card list");
    assert.equal(ability.definition.source.officialCardNumber, source.cardNumber);
    assert.equal(ability.definition.source.officialReference, source.officialReference);
    assert.equal(ability.trigger.eventType, "card.ridden");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.riddenFromGrade, 1);
    assert.equal(ability.trigger.riddenFromRace, "Quintuplet");
    assert.deepEqual(ability.effects, [{
      op: EFFECT,
      target: "controller",
      lookCount: 7,
      maximum: 1,
      filter: { race: "Quintuplet" },
      destination: "memory",
      shuffle: true
    }]);
    assert.equal(ability.canDecline, false);
    assert.equal(ability.definition.optional, false);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, cardId);
  }
});

test("an actual server ride queues the source rider's private prompt for either seat", () => {
  for (const cardId of Object.keys(FAMILY)) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side });
    const result = rideAction(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    const rideEvent = result.events.find(event => event.type === "card.ridden");
    assert.ok(rideEvent, "trusted ride action emits card.ridden");
    assert.equal(rideEvent.sourceCardInstanceId, f.rider.uid);
    assert.equal(rideEvent.targetCardInstanceIds[0], f.previousVanguard.uid);
    assert.equal(rideEvent.targetCardGrade, 1);
    assert.ok((rideEvent.targetCardRaces || []).includes("Quintuplet"));
    assert.equal(f.owner.vanguard.uid, f.rider.uid);
    assert.equal(f.owner.soul[0].uid, f.previousVanguard.uid);
    assert.equal(f.state.pendingAbility?.ability?.id, f.ability.id);
    assert.equal(f.state.pendingAbility?.instance?.uid, f.rider.uid);
    assert.equal(f.state.pendingAbility?.side, side);
    assert.equal(f.state.pendingAbility?.triggerControllerPlayerId, f.playerId);
    assert.equal(Projection.projectForPlayer(f.state, f.playerId).pendingAbility?.ability?.id, f.ability.id);
    assert.equal(Projection.projectForPlayer(f.state, f.opponentId).pendingAbility, null);
  }
});

test("only the exact source's ride from a grade-1 Quintuplet can satisfy the trigger", () => {
  const good = fixture();
  assert.equal(Engine.eventMatchesAbilityTrigger(good.ability, "ride", good.event, good.rider.uid, "vanguard", "vanguard", good.playerId), true);

  const rejected = [
    ["grade two previous unit", { previousCardId: GRADE_TWO_QUINTUPLET }],
    ["wrong race", { previousCardId: "cfa-3", targetCardGrade: 1, targetCardRace: "Non-Quintuplet", targetCardRaces: ["Non-Quintuplet"] }],
    ["wrong event source instance", { sourceCardInstanceId: "different-rider-instance" }],
    ["call instead of ride", { eventType: "card.placed" }],
    ["wrong timing window", { timingWindow: "normal-call" }],
    ["wrong phase", { phase: "main" }]
  ];
  for (const [label, options] of rejected) {
    const f = fixture(options);
    assert.equal(Engine.eventMatchesAbilityTrigger(f.ability, "ride", f.event, f.rider.uid, "vanguard", "vanguard", f.playerId), false, label);
  }
  const wrongTarget = fixture();
  wrongTarget.event = { ...wrongTarget.event, targetCardInstanceIds: [wrongTarget.opponent.vanguard.uid] };
  assert.equal(discover(wrongTarget).queued.length, 0, "a ride target on the opponent's side cannot satisfy the source rider");
  const unrelatedRideSource = fixture({ previousLocation: "rear-left" });
  assert.equal(discover(unrelatedRideSource).queued.length, 0, "a unit moved from a Rear-Guard Circle is not an eligible prior Vanguard");
});

test("both players can choose one matching card from only the top seven and put it into their own Memory", () => {
  for (const cardId of Object.keys(FAMILY)) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side });
    assert.equal(discover(f).queued.length, 1);
    const selected = f.deck[7];
    const outsideTopSeven = f.deck[0];
    assert.equal(card(selected.cardId).name.includes("Nakano"), true);
    const result = resolve(f, { effectUid: selected.uid, actionId: `memory-${cardId}-${side}` });
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.owner.orders.length, 1);
    assert.equal(f.owner.orders[0].uid, selected.uid);
    assert.equal(f.owner.orders[0].zone, "order", "the existing orders zone represents Memory in this rules engine");
    assert.equal(f.owner.orders[0].controllerPlayerId, f.playerId);
    assert.equal(f.opponent.orders.length, 0);
    assert.ok(f.owner.deck.some(item => item.uid === outsideTopSeven.uid), "an eligible card outside the top seven cannot be selected");
    assert.equal(f.owner.deck.length, 7);
    assert.equal(Engine.getControllerMemoryCards(f.owner, id => card(id)).some(item => item.uid === selected.uid), true);
  }
});

test("the optional up-to-one choice may select no card and still resolves the mandatory shuffle", () => {
  const f = fixture({ side: "bot" });
  assert.equal(discover(f).queued.length, 1);
  const beforeUids = new Set(f.owner.deck.map(item => item.uid));
  const result = resolve(f, { actionId: "memory-no-selection" });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.owner.orders.length, 0);
  assert.equal(f.owner.deck.length, 8);
  assert.deepEqual(new Set(f.owner.deck.map(item => item.uid)), beforeUids);
  assert.equal(f.opponent.orders.length, 0);
});

test("wrong targets, forged opponent decisions, and replayed resolutions do not move cards", () => {
  const invalidTarget = fixture();
  assert.equal(discover(invalidTarget).queued.length, 1);
  const before = JSON.stringify({ owner: invalidTarget.owner, opponent: invalidTarget.opponent, pending: invalidTarget.state.pendingAbility });
  const outside = invalidTarget.deck[0];
  assert.equal(resolve(invalidTarget, { effectUid: outside.uid, actionId: "memory-outside-top-seven" }).ok, false);
  assert.equal(JSON.stringify({ owner: invalidTarget.owner, opponent: invalidTarget.opponent, pending: invalidTarget.state.pendingAbility }), before);

  const joined = fixture({ side: "bot" });
  assert.equal(discover(joined).queued.length, 1);
  const forgedBefore = JSON.stringify({ owner: joined.owner, opponent: joined.opponent, pending: joined.state.pendingAbility });
  assert.equal(resolve(joined, { actorAuthUid: SEATS.hostAuthUid, effectUid: joined.deck[0].uid, actionId: "host-cannot-resolve-guest-memory" }).ok, false);
  assert.equal(JSON.stringify({ owner: joined.owner, opponent: joined.opponent, pending: joined.state.pendingAbility }), forgedBefore);

  const replay = fixture({ side: "human" });
  assert.equal(discover(replay).queued.length, 1);
  const selected = replay.deck[7];
  const accepted = resolve(replay, { effectUid: selected.uid, actionId: "memory-once-only" });
  assert.equal(accepted.ok, true, accepted.reason);
  const after = JSON.stringify({ owner: replay.owner, opponent: replay.opponent, pending: replay.state.pendingAbility, abilities: replay.state.pendingAbilities });
  assert.equal(discover(replay).queued.length, 0);
  assert.equal(resolve(replay, { effectUid: selected.uid, actionId: "memory-once-only" }).ok, false);
  assert.equal(JSON.stringify({ owner: replay.owner, opponent: replay.opponent, pending: replay.state.pendingAbility, abilities: replay.state.pendingAbilities }), after);
});

test("catalog siblings lacking official text confirmation are not promoted by this batch", () => {
  for (const cardId of ["cfa-11523", "cfa-11604"]) {
    const ability = Engine.parseCardAbilitiesCached(card(cardId)).find(entry => entry.id === `${cardId}:0`);
    assert.ok(ability);
    assert.notEqual(ability.definition?.source?.patternId, PATTERN, `${cardId} stays uncompiled until primary text confirmation`);
  }
});
