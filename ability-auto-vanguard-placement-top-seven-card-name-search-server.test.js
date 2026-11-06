"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerCardAbilityKeywordIndex(require("./card-ability-keywords.js"));
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-7952";
const ABILITY_ID = `${CARD_ID}:0`;
const PATTERN = "auto-vanguard-placement-top-seven-card-name-search-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const sourceDefinition = catalogById.get(CARD_ID);
const nameTargetDefinition = catalog.find(card => /Shiranui/i.test(String(card.name || "")));
const definitions = require("./ability-definitions.js").filter(item => item.source?.patternId === PATTERN);
assert.ok(sourceDefinition, "Sadamune exists in the catalog");
assert.ok(nameTargetDefinition, "a real Shiranui card exists for the search filter");

function makeInstance(definition, uid, playerId, zone = "deck") {
  return {
    uid,
    cardId: String(definition.id),
    cardName: definition.name,
    grade: Number(definition.grade || 0),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    zone,
    ...(zone === "vanguard" ? { circle: "vanguard", faceUp: true } : {})
  };
}

function fixture(side = "bot", { targetPosition = 6, addTarget = true } = {}) {
  const hostId = "host-player", guestId = "guest-player";
  const playerId = { human: hostId, bot: guestId };
  const player = id => ({ playerId: id, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player(hostId), bot: player(guestId) };
  const source = makeInstance(sourceDefinition, `source-${side}`, playerId[side], "vanguard");
  const otherSide = side === "human" ? "bot" : "human";
  players[side].vanguard = source;
  players[otherSide].vanguard = makeInstance(catalogById.get("cfa-31"), `opponent-${side}`, playerId[otherSide], "vanguard");

  const fillerDefinition = catalogById.get("cfa-31");
  const deck = Array.from({ length: 8 }, (_, index) => makeInstance(fillerDefinition, `filler-${side}-${index}`, playerId[side]));
  const target = addTarget ? makeInstance(nameTargetDefinition, `target-${side}`, playerId[side]) : null;
  if (target) deck[targetPosition] = target;
  players[side].deck = deck;

  const state = {
    matchId: `top-seven-${side}`,
    stateVersion: 7,
    eventSequence: 0,
    side,
    firstSide: "human",
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
  const event = Engine.createGameEvent(state, {
    eventId: `placed-${side}-${source.uid}`,
    type: "card.placed",
    actingPlayerId: playerId[side],
    turnPlayerId: playerId[side],
    sourceCardInstanceId: source.uid,
    sourceCardName: sourceDefinition.name,
    sourceOwnerPlayerId: playerId[side],
    sourceControllerPlayerId: playerId[side],
    cardInstanceId: source.uid,
    subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: playerId[side],
    subjectControllerPlayerId: playerId[side],
    previousLocation: "hand",
    currentLocation: "vanguard",
    circle: "vanguard",
    phase: "ride",
    timingWindow: "ride"
  });
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.id === ABILITY_ID);
  assert.ok(ability, "the exact ability is parsed from card text");
  return { state, event, source, target, ability, side, player: players[side], playerId: playerId[side], authUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid };
}

function decide(f, selection = {}, overrides = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: overrides.authUid || f.authUid,
    actionId: overrides.actionId || `resolve-${f.side}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, ...selection } }
  }, seats, Engine);
}

test("the exact VC top-seven name-fragment search definitions are card-specific", () => {
  const definition = definitions.find(item => item.id === ABILITY_ID);
  assert.deepEqual(definitions.map(item => item.id).sort(), ["cfa-7952:0", "cfa-8056:0", "cfa-8163:0"]);
  assert.equal(definition.printedText, "AUTO [VC]: When placed, look at seven cards from the top of your deck, reveal up to one card with \"Shiranui\" in its card name from among them and put it into your hand, and shuffle your deck.");
  assert.equal(definition.source.officialReference, "https://en.cf-vanguard.com/cardlist/?cardno=V-BT11%2F031EN");
  assert.equal(Reducer.supportsServerAbilityEffects(Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.id === ABILITY_ID)), true);
  const siblingAbility = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.id === `${CARD_ID}:1`);
  assert.ok(siblingAbility, "the distinct Rear-Guard ability remains separately represented");
  assert.notEqual(siblingAbility.definition?.source?.patternId, PATTERN);
  assert.equal(siblingAbility.definition?.source?.patternId, "auto-rc-opponent-discard-shield-power-draw-v1");
  assert.equal(Reducer.supportsServerAbilityEffects(siblingAbility), true);
});

test("host and joining player each receive and resolve only their own exact Vanguard placement trigger", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, "a replayed event cannot enqueue a second prompt");

    const result = decide(f, { effectUid: f.target.uid });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(f.player.hand.some(card => card.uid === f.target.uid), true);
    assert.equal(f.player.deck.some(card => card.uid === f.target.uid), false);
    assert.equal(f.player.deck.length, 7);
    assert.equal(f.player.hand.length, 1);
    const opponentSide = side === "human" ? "bot" : "human";
    assert.equal(f.state.players[opponentSide].hand.length, 0, "only the ability controller gains the searched card");
    assert.equal(result.events.some(event => event.type === "card.revealed" && event.cardInstanceId === f.target.uid), true);
  }
});

test("the mandatory AUTO may select no card and still completes its shuffle", () => {
  const f = fixture("bot", { addTarget: false });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = decide(f);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.player.hand.length, 0);
  assert.equal(f.player.deck.length, 8);
  assert.equal(f.state.pendingAbility, null);
});

test("wrong instance, wrong circle, moved source, or opposing player cannot trigger or resolve it", () => {
  const wrongInstance = fixture("bot");
  const forged = Engine.createGameEvent(wrongInstance.state, {
    eventId: "forged-subject",
    type: "card.placed",
    actingPlayerId: wrongInstance.playerId,
    turnPlayerId: wrongInstance.playerId,
    sourceCardInstanceId: "different-instance",
    sourceControllerPlayerId: wrongInstance.playerId,
    cardInstanceId: "different-instance",
    subjectCardInstanceId: "different-instance",
    subjectControllerPlayerId: wrongInstance.playerId,
    previousLocation: "hand",
    currentLocation: "vanguard",
    circle: "vanguard"
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongInstance.state, [forged], Engine).queued.length, 0);

  const wrongCircle = fixture("bot");
  const rearEvent = Engine.createGameEvent(wrongCircle.state, {
    eventId: "wrong-circle",
    type: "card.placed",
    actingPlayerId: wrongCircle.playerId,
    turnPlayerId: wrongCircle.playerId,
    sourceCardInstanceId: wrongCircle.source.uid,
    sourceControllerPlayerId: wrongCircle.playerId,
    cardInstanceId: wrongCircle.source.uid,
    subjectCardInstanceId: wrongCircle.source.uid,
    subjectControllerPlayerId: wrongCircle.playerId,
    previousLocation: "hand",
    currentLocation: "rear-guard",
    circle: "rear-center"
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [rearEvent], Engine).queued.length, 0);

  const moved = fixture("bot");
  moved.state.players.bot.vanguard = null;
  moved.state.players.bot.hand.push(moved.source);
  assert.equal(Reducer.discoverAutoTriggers(moved.state, [moved.event], Engine).queued.length, 0);

  const proxy = fixture("bot");
  Reducer.discoverAutoTriggers(proxy.state, [proxy.event], Engine);
  const before = JSON.stringify(proxy.state);
  const rejected = decide(proxy, { effectUid: proxy.target.uid }, { authUid: seats.hostAuthUid, actionId: "host-cannot-resolve-guest-ability" });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "source-not-controlled");
  assert.equal(JSON.stringify(proxy.state), before);
});

test("a matching name outside the top seven is rejected without changing game state", () => {
  const f = fixture("bot", { targetPosition: 0 });
  Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  const before = JSON.stringify(f.state);
  const result = decide(f, { effectUid: f.target.uid });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(f.state), before, "an invalid selection is atomic");
});
