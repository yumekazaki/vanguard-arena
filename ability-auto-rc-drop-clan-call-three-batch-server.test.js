"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const registeredDefinitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(registeredDefinitions);
const definitions = registeredDefinitions.filter(definition => ["cfa-752:0", "cfa-755:0", "cfa-765:0"].includes(definition.id));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = Object.freeze([
  ["cfa-752", "Transport Dragon, Brachioporter", "Carrier Dragon, Brachiocarrier", "BT08/080EN"],
  ["cfa-755", "Carrier Dragon, Brachiocarrier", "Citadel Dragon, Brachiocastle", "BT08/076EN"],
  ["cfa-765", "Citadel Dragon, Brachiocastle", "Transport Dragon, Brachioporter", "BT08/074EN"]
]);
const PATTERN = "auto-rc-drop-tachikaze-counter-blast-search-named-call-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
let nextFixture = 0;

function catalogCard(cardId) {
  const card = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(card, `catalog card ${cardId} exists`);
  return card;
}

function instance(cardId, uid, playerId, overrides = {}) {
  const rules = catalogCard(cardId);
  return {
    uid, cardId: String(cardId), cardName: rules.name, name: rules.name, type: rules.type,
    grade: rules.grade, clan: rules.clan, ownerPlayerId: playerId, controllerPlayerId: playerId,
    ...overrides
  };
}

function fixture(cardId, side = "human", { faceUpDamage = true, namedTarget = true } = {}) {
  const id = ++nextFixture;
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const [familyCardId, , targetName] = FAMILY.find(item => item[0] === cardId);
  assert.equal(familyCardId, cardId);
  const source = instance(cardId, `source-${id}`, playerId, { zone: "drop", circle: null });
  const targetRecord = catalog.find(item => item.name === targetName);
  assert.ok(targetRecord, `target ${targetName} exists in catalog`);
  const target = instance(targetRecord.id, `target-${id}`, playerId, { zone: "deck" });
  const unrelated = instance("cfa-766", `unrelated-${id}`, playerId, { zone: "deck" });
  const vanguard = instance("cfa-766", `tachikaze-vanguard-${id}`, playerId, { zone: "vanguard", circle: "vanguard" });
  const opposingVanguard = instance("cfa-31", `opponent-vanguard-${id}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const counterBlastCard = instance("cfa-752", `damage-${id}`, playerId, { faceDown: !faceUpDamage });
  const player = playerId => ({
    playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [],
    damage: [], bind: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [],
    removed: [], extra: [], accelZones: 0
  });
  const state = {
    matchId: `tachikaze-drop-${id}`, stateVersion: 11, eventSequence: 0, turn: 3, phase: 4, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    players: { human: player("host-player"), bot: player("guest-player") }
  };
  state.players[side].vanguard = vanguard;
  state.players[side].drop = [source];
  state.players[side].damage = [counterBlastCard];
  state.players[side].deck = namedTarget ? [target, unrelated] : [unrelated];
  state.players[opponentSide].vanguard = opposingVanguard;
  return { id, state, side, playerId, opponentId, source, target, unrelated, vanguard, counterBlastCard, opponentSide };
}

function movementEvent(game, {
  card = game.source, eventType = "card.retired", previousLocation = "rear-left", currentLocation = "drop",
  actorPlayerId = game.playerId, turnPlayerId = game.playerId
} = {}) {
  return Engine.createGameEvent(game.state, {
    type: eventType, actingPlayerId: actorPlayerId, turnPlayerId,
    sourceCardInstanceId: card.uid, sourceOwnerPlayerId: card.ownerPlayerId,
    sourceControllerPlayerId: card.controllerPlayerId, cardInstanceId: card.uid,
    subjectCardInstanceId: card.uid, subjectOwnerPlayerId: card.ownerPlayerId,
    subjectControllerPlayerId: card.controllerPlayerId,
    previousLocation, currentLocation, circle: previousLocation, phase: "main", timingWindow: "effect-move"
  });
}

function discover(game, event = game.event) {
  return Reducer.discoverAutoTriggers(game.state, [event], Engine);
}

function answer(game, accept, selection = {}, authUid = game.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(game.state, {
    actorAuthUid: authUid, actionId: `tachikaze-${game.id}-${accept}-${nextFixture++}`,
    expectedStateVersion: game.state.stateVersion,
    payload: {
      type: "ability-response", accept,
      selection: {
        instanceUid: game.source.uid, abilityId: `${game.source.cardId}:0`,
        costSelections: { cb: accept ? [game.counterBlastCard.uid] : [], sb: [], discard: [], reveal: [] },
        ...selection
      }
    }
  }, seats, Engine);
}

test("BT08 chain has exact reviewed text, source-bound RC-to-Drop trigger, optional CB1, and named call effect", () => {
  assert.deepEqual(definitions.map(item => item.id).sort(), FAMILY.map(([id]) => `${id}:0`).sort());
  for (const [cardId, sourceName, targetName, cardNumber] of FAMILY) {
    const card = catalogCard(cardId);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
    assert.ok(ability, `${cardId}:0 parses`);
    assert.equal(card.name, sourceName);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.source.officialCardNumber, cardNumber);
    assert.equal(ability.printedText, `AUTO: [Counter Blast 1] When this unit is put into the drop zone from RC, if you have a «Tachikaze» vanguard, you may pay the cost. If you do, search your deck for up to one card named "${targetName}", call it to RC, and shuffle your deck.`);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.trigger.status, "recognized-trigger");
    assert.equal(ability.trigger.subject, "event-subject", "event subject UID is the exact retiring source instance");
    assert.equal(ability.trigger.sourceLocation, "rear-guard");
    assert.equal(ability.trigger.destinationLocation, "drop");
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: "Tachikaze" }]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.definition.effects, [{
      op: "search-deck-named-call-to-rearguard", target: "controller", cardName: targetName,
      maximum: 1, destination: "rear-guard", position: "stand", opensSourceCircle: true
    }]);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, true);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player each receive and resolve their own exact-instance chain prompt once", () => {
  for (const [cardId] of FAMILY) for (const side of ["human", "bot"]) {
    const game = fixture(cardId, side);
    game.event = movementEvent(game);
    const first = discover(game);
    assert.equal(first.queued.length, 1, `${cardId}/${side}: one AUTO queued`);
    assert.equal(game.state.pendingAbility.side, side, `${cardId}/${side}: prompt belongs to controller`);
    assert.equal(game.state.pendingAbility.instance.uid, game.source.uid, "the moved card instance owns the ability");
    assert.equal(game.state.pendingAbility.ability.id, `${cardId}:0`);
    assert.equal(discover(game).queued.length, 0, "same event cannot prompt or pay twice (Q272)");

    const result = answer(game, true, { effectUid: game.target.uid, callZone: "rear-left" });
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(game.state.players[side].damage[0].faceDown, true, "controller pays Counter Blast 1");
    assert.equal(game.state.players[side].rear[0].uid, game.target.uid, "exact named deck card is called into vacated RC");
    assert.equal(game.state.players[side].rear[0].rested, false, "called unit is standing");
    assert.equal(game.state.players[side].deck.some(card => card.uid === game.target.uid), false);
    assert.equal(game.state.players[side].deck.some(card => card.uid === game.unrelated.uid), true);
    assert.equal(game.state.players[game.opponentSide].damage[0], undefined, "other player pays no cost");
    assert.equal(game.state.players[game.opponentSide].rear.every(card => card === null), true, "other field is unaffected");
  }
});

test("only the exact source instance moving from RC to Drop with a Tachikaze Vanguard queues", () => {
  const wrongCard = fixture("cfa-752", "human");
  const anotherCopy = instance("cfa-752", `second-source-${wrongCard.id}`, wrongCard.playerId, { zone: "drop" });
  wrongCard.state.players.human.drop.push(anotherCopy);
  wrongCard.event = movementEvent(wrongCard, { card: anotherCopy });
  const exactCopyResult = discover(wrongCard);
  assert.equal(exactCopyResult.queued.length, 1, "the moved copy's own AUTO queues");
  assert.equal(wrongCard.state.pendingAbility.instance.uid, anotherCopy.uid, "the event cannot be attributed to the other same-name copy");
  assert.notEqual(wrongCard.state.pendingAbility.instance.uid, wrongCard.source.uid);

  const fromVanguard = fixture("cfa-752", "human");
  fromVanguard.event = movementEvent(fromVanguard, { previousLocation: "vanguard" });
  assert.equal(discover(fromVanguard).queued.length, 0, "Vanguard-to-Drop does not satisfy RC source requirement");

  const toHand = fixture("cfa-752", "human");
  toHand.event = movementEvent(toHand, { currentLocation: "hand" });
  assert.equal(discover(toHand).queued.length, 0, "RC-to-hand does not satisfy Drop destination requirement");

  const wrongClan = fixture("cfa-752", "human");
  wrongClan.state.players.human.vanguard = instance("cfa-31", `non-tachi-${wrongClan.id}`, wrongClan.playerId, { zone: "vanguard", circle: "vanguard" });
  wrongClan.event = movementEvent(wrongClan);
  assert.equal(discover(wrongClan).queued.length, 0, "a non-Tachikaze Vanguard fails the printed condition");
});

test("retired, moved, and discarded-to-Drop event forms retain exact identity and trigger only once", () => {
  for (const eventType of ["card.retired", "card.moved", "card.discarded"]) {
    const game = fixture("cfa-755", "bot");
    game.event = movementEvent(game, { eventType, actorPlayerId: game.opponentId });
    const found = discover(game);
    assert.equal(found.queued.length, 1, `${eventType} is a recognized RC-to-Drop event`);
    assert.equal(game.state.pendingAbility.side, "bot", "opponent's action still prompts the source controller");
    assert.equal(discover(game).queued.length, 0, `${eventType} duplicate is claimed once`);
  }
});

test("declining the optional Counter Blast does not alter cost, deck, or field", () => {
  const game = fixture("cfa-752", "bot");
  game.event = movementEvent(game, { actorPlayerId: game.opponentId });
  discover(game);
  const beforeDeck = game.state.players.bot.deck.map(card => card.uid);
  const result = answer(game, false);
  assert.equal(result.ok, true, result.reason);
  assert.equal(game.state.players.bot.damage[0].faceDown, false);
  assert.deepEqual(game.state.players.bot.deck.map(card => card.uid), beforeDeck);
  assert.equal(game.state.players.bot.rear.every(card => card === null), true);
  assert.equal(game.state.pendingAbility, null);
});

test("wrong target and occupied RC are rejected before Counter Blast is paid", () => {
  for (const invalid of ["wrong-target", "occupied-circle"]) {
    const game = fixture("cfa-765", "human");
    if (invalid === "occupied-circle") game.state.players.human.rear[1] = instance("cfa-766", `occupied-${game.id}`, game.playerId);
    game.event = movementEvent(game);
    discover(game);
    const before = JSON.stringify(game.state);
    const result = answer(game, true, {
      effectUid: invalid === "wrong-target" ? game.unrelated.uid : game.target.uid,
      callZone: invalid === "wrong-target" ? "rear-left" : "rear-right"
    });
    assert.equal(result.ok, false, `${invalid}: illegal call rejected`);
    assert.equal(JSON.stringify(game.state), before, `${invalid}: invalid target cannot partially pay CB`);
  }
});

test("up-to-one search may find no target, still pays CB and resolves the official shuffle path", () => {
  const game = fixture("cfa-755", "human", { namedTarget: false });
  game.event = movementEvent(game);
  discover(game);
  const result = answer(game, true);
  assert.equal(result.ok, true, result.reason);
  assert.equal(game.state.players.human.damage[0].faceDown, true);
  assert.deepEqual(game.state.players.human.deck.map(card => card.uid), [game.unrelated.uid]);
  assert.equal(game.state.players.human.rear.every(card => card === null), true);
});

test("an unpayable Counter Blast cannot be accepted or partially applied", () => {
  const noCounterBlast = fixture("cfa-752", "human", { faceUpDamage: false });
  noCounterBlast.event = movementEvent(noCounterBlast);
  assert.equal(discover(noCounterBlast).queued.length, 1, "the AUTO event and Tachikaze condition were met; its cost is handled when the player chooses");
  const before = JSON.stringify(noCounterBlast.state);
  const result = answer(noCounterBlast, true, { effectUid: noCounterBlast.target.uid, callZone: "rear-left" });
  assert.equal(result.ok, false, "the controller cannot resolve by paying a face-down damage card");
  assert.equal(JSON.stringify(noCounterBlast.state), before, "rejected payment cannot change damage, deck, or circles");
});

test("the reusable named-call handler shuffles after both a call and a missing target", () => {
  const step = definitions[0].effects[0];
  const handler = Engine.EFFECT_HANDLERS[step.op];
  assert.ok(handler, "shared engine handler is registered");

  const called = fixture("cfa-752", "human");
  let shuffleCalls = 0;
  const callContext = {
    player: called.state.players.human, source: called.source, sourceInPlay: false,
    effectUid: called.target.uid, callZone: "rear-left",
    cardDefinitionForInstance: card => catalogCard(card.cardId),
    shuffleDeck: () => { shuffleCalls += 1; }, emitEvent: () => {}
  };
  assert.equal(handler.validate(step, callContext), true);
  assert.equal(handler.apply(step, callContext).calledCardInstanceId, called.target.uid);
  assert.equal(shuffleCalls, 1, "successful call is followed by one shuffle");

  const missing = fixture("cfa-755", "human", { namedTarget: false });
  let missingShuffleCalls = 0;
  const noTargetContext = {
    player: missing.state.players.human, source: missing.source, sourceInPlay: false,
    effectUid: null, callZone: null,
    cardDefinitionForInstance: card => catalogCard(card.cardId),
    shuffleDeck: () => { missingShuffleCalls += 1; }, emitEvent: () => {}
  };
  assert.equal(handler.validate(step, noTargetContext), true, "up to one allows no target when absent");
  assert.equal(handler.apply(step, noTargetContext).calledCardInstanceId, null);
  assert.equal(missingShuffleCalls, 1, "the deck is shuffled even when no target is found");
});

