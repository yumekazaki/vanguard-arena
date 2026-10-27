"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PATTERN = "auto-placement-top-five-grade-three-search-discard-v1";

function definition(cardId) {
  const result = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(result, `catalog card ${cardId}`);
  return result;
}

function card(cardId, uid, playerId, extra = {}) {
  const def = definition(cardId);
  return { uid, cardId: String(cardId), cardName: def.name, type: def.type || "Unit", grade: Number(def.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function setup(side = "bot", { circle = "rear-left", deckCardIds = ["cfa-31", "cfa-2", "cfa-32", "cfa-2", "cfa-33"] } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player", opponentSide = side === "human" ? "bot" : "human", opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const sourceDefinition = definition("cfa-7289");
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability);
  const source = card(sourceDefinition.id, `search-source-${side}`, ownerId, { zone: circle === "vanguard" ? "vanguard" : "rear-guard", circle });
  const player = playerId => ({ playerId, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = circle === "vanguard" ? source : card("cfa-31", `own-vanguard-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  if (circle !== "vanguard") players[side].rear.push(source);
  const oldHandCard = card("cfa-31", `old-hand-${side}`, ownerId);
  players[side].hand.push(oldHandCard);
  players[side].deck = deckCardIds.map((cardId, index) => card(cardId, `deck-${side}-${index}`, ownerId, { zone: "deck" }));
  players[opponentSide].vanguard = card("cfa-31", `opponent-vanguard-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: "placement-top-five", stateVersion: 1, side, phase: 2, turn: 6, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: circle, circle, phase: "call", timingWindow: "call"
  });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, side, ownerId, opponentId, source, ability, oldHandCard, event, discovery };
}

function resolve(fixture, selection, actorAuthUid = fixture.side === "human" ? "auth-host" : "auth-guest", actionId = `resolve-${fixture.side}`) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id, ...selection } }
  }, seats, Engine);
}

test("all 25 exact placement top-five search abilities use only the trusted search-and-discard gate", () => {
  let count = 0;
  for (const cardDefinition of catalog) for (const ability of Engine.parseCardAbilitiesCached(cardDefinition)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    count++;
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
    assert.equal(ability.trigger.eventType, "card.placed");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.trigger.circles, ["vanguard", "rear-guard"]);
    assert.equal(ability.trigger.sourceLocation, "hand");
    assert.equal(ability.conditionStatus, "no-explicit-condition-detected");
    assert.equal(ability.choiceStatus, "modeled");
  }
  assert.equal(count, 25);
  assert.equal(Reducer.supportsServerEffectOperation("search-top-grade-three-to-hand-then-discard"), false);
});

test("host and joining player each privately search, shuffle, and discard from their own hand", () => {
  for (const [side, circle] of [["human", "vanguard"], ["bot", "rear-left"]]) {
    const fixture = setup(side, { circle });
    assert.equal(fixture.discovery.queued.length, 1);
    assert.equal(fixture.state.pendingAbility.side, side);
    const selectedUid = fixture.state.players[side].deck.at(-1).uid;
    const deckUids = fixture.state.players[side].deck.map(item => item.uid);
    const result = resolve(fixture, { effectUid: selectedUid, effectDiscardUid: fixture.oldHandCard.uid });
    assert.equal(result.ok, true, result.reason);
    const own = fixture.state.players[side], opponent = fixture.state.players[side === "human" ? "bot" : "human"];
    assert.equal(own.hand.length, 1);
    assert.equal(own.hand[0].uid, selectedUid);
    assert.deepEqual(own.drop.map(item => item.uid), [fixture.oldHandCard.uid]);
    assert.equal(own.deck.length, deckUids.length - 1);
    assert.deepEqual(new Set(own.deck.map(item => item.uid)), new Set(deckUids.filter(uid => uid !== selectedUid)));
    assert.equal(opponent.hand.length, 0);
    assert.equal(opponent.drop.length, 0);
    assert.ok(result.events.some(event => event.type === "card.discarded" && event.cardInstanceId === fixture.oldHandCard.uid));
    const revealEvent = result.events.find(event => event.type === "card.revealed" && event.cardInstanceId === selectedUid);
    assert.equal(revealEvent?.revealedCardId, String(fixture.state.players[side].hand[0]?.cardId || selectedUid));
    assert.equal(revealEvent?.reason, "search");
    assert.equal(result.events.some(event => event.type === "card.discarded" && event.subjectControllerPlayerId === opponent.playerId), false);
  }
});

test("choosing no Grade 3 still shuffles without discarding; selected Grade 3 may be the discard", () => {
  const declineSearch = setup();
  const originalTop = declineSearch.state.players.bot.deck.map(item => item.uid);
  const noPick = resolve(declineSearch, {});
  assert.equal(noPick.ok, true, noPick.reason);
  assert.equal(declineSearch.state.players.bot.hand[0].uid, declineSearch.oldHandCard.uid);
  assert.equal(declineSearch.state.players.bot.drop.length, 0);
  assert.deepEqual(new Set(declineSearch.state.players.bot.deck.map(item => item.uid)), new Set(originalTop));

  const takeThenDiscard = setup();
  const selectedUid = takeThenDiscard.state.players.bot.deck.at(-1).uid;
  const result = resolve(takeThenDiscard, { effectUid: selectedUid, effectDiscardUid: selectedUid });
  assert.equal(result.ok, true, result.reason);
  assert.equal(takeThenDiscard.state.players.bot.hand.some(item => item.uid === selectedUid), false);
  assert.deepEqual(takeThenDiscard.state.players.bot.drop.map(item => item.uid), [selectedUid]);
});

test("stale top-five cards, non-Grade-3 targets, bad discards, wrong source and host proxy reject atomically", () => {
  for (const invalid of [
    { effectUid: "not-in-top-five" },
    { effectUid: "deck-bot-1", effectDiscardUid: "old-hand-bot" },
    { effectUid: "deck-bot-4", effectDiscardUid: "foreign-hand" }
  ]) {
    const fixture = setup();
    fixture.state.players.human.hand.push(card("cfa-31", "foreign-hand", "host-player"));
    const before = structuredClone(fixture.state);
    const rejected = resolve(fixture, invalid);
    assert.equal(rejected.ok, false);
    assert.deepEqual(fixture.state, before);
  }

  const guest = setup("bot");
  const beforeGuest = structuredClone(guest.state);
  assert.equal(resolve(guest, { effectUid: guest.state.players.bot.deck.at(-1).uid, effectDiscardUid: guest.oldHandCard.uid }, "auth-host").ok, false);
  assert.deepEqual(guest.state, beforeGuest);

  const wrongOrigin = setup("bot");
  wrongOrigin.state.pendingAbility.eventContext.gameEvent = Object.freeze({ ...wrongOrigin.event, previousLocation: "drop" });
  assert.equal(resolve(wrongOrigin, { effectUid: wrongOrigin.state.players.bot.deck.at(-1).uid, effectDiscardUid: wrongOrigin.oldHandCard.uid }).ok, false);
});
