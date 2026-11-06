"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const families = [
  {
    cardId: "cfa-8056",
    abilityId: "cfa-8056:0",
    nameFragment: "Vanquisher",
    cardNumber: "D-PV01/327EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PV01%2F327EN",
    text: "AUTO [VC]: When placed, look at seven cards from the top of your deck, reveal up to one card with \"Vanquisher\" in its card name from among them and put it into your hand, and shuffle your deck."
  },
  {
    cardId: "cfa-8163",
    abilityId: "cfa-8163:0",
    nameFragment: "Shirayuki",
    cardNumber: "V-SS07/031EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-SS07%2F031EN",
    text: "AUTO [VC]: When placed, look at seven cards from the top of your deck, reveal up to one card with \"Shirayuki\" in its card name from among them and put it into your hand, and shuffle your deck."
  }
];

function makeInstance(definition, uid, playerId) {
  return {
    uid,
    cardId: String(definition.id),
    cardName: definition.name,
    grade: Number(definition.grade || 0),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId
  };
}

function fixture(family, side = "bot", { targetPosition = 6, placeZone = "vanguard" } = {}) {
  const playerIds = { human: "host-player", bot: "guest-player" };
  const player = playerId => ({ playerId, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player(playerIds.human), bot: player(playerIds.bot) };
  const ownerId = playerIds[side], otherSide = side === "human" ? "bot" : "human";
  const sourceDefinition = catalogById.get(family.cardId);
  const source = makeInstance(sourceDefinition, `source-${side}-${family.cardId}`, ownerId);
  if (placeZone === "vanguard") players[side].vanguard = source;
  else players[side].rear = [source];
  players[otherSide].vanguard = makeInstance(catalogById.get("cfa-31"), `opponent-${side}`, playerIds[otherSide]);

  const matchingCard = catalog.find(card => String(card.name || "").toLowerCase().includes(family.nameFragment.toLowerCase()));
  assert.ok(matchingCard, `real catalog target exists for ${family.nameFragment}`);
  const filler = catalogById.get("cfa-31");
  const deck = Array.from({ length: 8 }, (_, index) => makeInstance(filler, `filler-${side}-${index}`, ownerId));
  const target = makeInstance(matchingCard, `target-${side}-${family.cardId}`, ownerId);
  deck[targetPosition] = target;
  players[side].deck = deck;

  const state = {
    matchId: `top-seven-${family.cardId}-${side}`,
    stateVersion: 3,
    eventSequence: 0,
    side,
    turn: 1,
    phase: 2,
    players,
    processedActionIds: [],
    processedEventIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    pendingAbility: null,
    pendingAttack: null
  };
  const location = placeZone === "vanguard" ? "vanguard" : "rear-left";
  const event = Engine.createGameEvent(state, {
    eventId: `placed-${source.uid}`,
    type: "card.placed",
    actingPlayerId: ownerId,
    turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid,
    sourceCardName: sourceDefinition.name,
    sourceOwnerPlayerId: ownerId,
    sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid,
    subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId,
    subjectControllerPlayerId: ownerId,
    previousLocation: "hand",
    currentLocation: location,
    circle: location,
    phase: "ride",
    timingWindow: "ride"
  });
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.id === family.abilityId);
  assert.ok(ability, `${family.cardId}:0 parses from the actual card text`);
  return { state, event, source, target, ability, family, side, ownerId, player: players[side], otherPlayer: players[otherSide], authUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid };
}

function resolve(f, { effectUid = f.target.uid, authUid = f.authUid, actionId = `resolve-${f.side}-${f.family.cardId}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, effectUid } }
  }, seats, Engine);
}

for (const family of families) {
  test(`${family.cardId}:0 has exact reviewed card text and a trusted server definition`, () => {
    const definition = Engine.getReviewedAbilityDefinitionsForCard(family.cardId).find(item => item.id === family.abilityId);
    const ability = Engine.parseCardAbilitiesCached(catalogById.get(family.cardId)).find(item => item.id === family.abilityId);
    assert.equal(definition?.printedText, family.text);
    assert.equal(definition?.source?.dataset, "Bushiroad official card text");
    assert.equal(definition?.source?.cardNumber, family.cardNumber);
    assert.equal(definition?.source?.officialReference, family.reference);
    assert.deepEqual(definition?.effects, [{ op: "search-top-up-to-one-filtered-to-hand", target: "controller", lookCount: 7, maximum: 1, filter: { cardNameContains: family.nameFragment } }]);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  });

  test(`${family.cardId}:0 resolves the exact top-seven AUTO for either online seat`, () => {
    for (const side of ["human", "bot"]) {
      const f = fixture(family, side);
      const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
      assert.equal(discovered.queued.length, 1, `${side}: ${JSON.stringify(discovered.skipped)}`);
      assert.equal(f.state.pendingAbility.side, side);
      assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
      if (side === "bot") {
        const before = JSON.stringify(f.state);
        assert.equal(resolve(f, { authUid: seats.hostAuthUid, actionId: `host-cannot-resolve-${family.cardId}` }).ok, false);
        assert.equal(JSON.stringify(f.state), before);
      }
      const result = resolve(f);
      assert.equal(result.ok, true, `${side}: ${result.reason}`);
      assert.ok(f.player.hand.some(card => card.uid === f.target.uid));
      assert.ok(!f.player.deck.some(card => card.uid === f.target.uid));
      assert.equal(f.player.deck.length, 7);
      assert.equal(f.otherPlayer.hand.length, 0);
      assert.equal(f.state.pendingAbility, null);
    }
  });

  test(`${family.cardId}:0 rejects wrong circles, unrelated instances, and targets outside the top seven`, () => {
    const wrongCircle = fixture(family, "bot", { placeZone: "rear-guard" });
    assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);

    const wrongSource = fixture(family, "bot");
    const unrelated = Engine.createGameEvent(wrongSource.state, {
      ...wrongSource.event,
      eventId: `unrelated-${family.cardId}`,
      sourceCardInstanceId: "different-source",
      cardInstanceId: "different-source",
      subjectCardInstanceId: "different-source"
    });
    assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [unrelated], Engine).queued.length, 0);

    const outsideTopSeven = fixture(family, "bot", { targetPosition: 0 });
    assert.equal(Reducer.discoverAutoTriggers(outsideTopSeven.state, [outsideTopSeven.event], Engine).queued.length, 1);
    const before = JSON.stringify(outsideTopSeven.state);
    const result = resolve(outsideTopSeven);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(outsideTopSeven.state), before, "invalid target rejection is atomic");
  });
}
