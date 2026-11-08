"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const IDS = ["cfa-11524", "cfa-11544", "cfa-11556", "cfa-11605", "cfa-11669"];
const PATTERN = "auto-vanguard-placement-top-seven-two-quintuplets-to-hand-memory-v1";
const TEXT = "AUTO: When this unit is placed on VC, look at the top seven cards of your deck, choose up to two <Quintuplet> from among them, reveal them, choose a card from among the revealed cards, put it into hand, put the rest of the revealed cards into memory, and shuffle the deck.";

function definition(cardId) { return catalog.find(card => String(card.id) === String(cardId)); }
function card(cardId, uid, playerId, extra = {}) {
  const printed = definition(cardId);
  return { uid, cardId: String(cardId), cardName: printed?.name, type: printed?.type, grade: printed?.grade,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture({ cardId = IDS[0], side = "human", matching = true } = {}) {
  const otherSide = side === "human" ? "bot" : "human";
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = otherSide === "human" ? "host-player" : "guest-player";
  const source = card(cardId, `source-${cardId}-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
  const first = card("cfa-11544", `match-a-${side}`, playerId);
  const second = card("cfa-11556", `match-b-${side}`, playerId);
  const ineligible = card("cfa-3", `ineligible-${side}`, playerId);
  const lowerDeck = card("cfa-3", `lower-${side}`, playerId);
  const emptyPlayer = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [],
    deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: emptyPlayer("host-player"), bot: emptyPlayer("guest-player") };
  players[side].vanguard = source;
  players[side].deck = matching ? [lowerDeck, first, ineligible, second] : [lowerDeck, ineligible];
  players[otherSide].vanguard = card("cfa-3", `opponent-vanguard-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: `quintuplet-hand-memory-${side}`, stateVersion: 1, turn: 3, phase: 2, side, eventSequence: 0,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "soul", currentLocation: "vanguard", circle: "vanguard", phase: "ride", timingWindow: "normal-ride"
  });
  const ability = Engine.parseCardAbilitiesCached(definition(cardId)).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `AUTO ability for ${cardId}`);
  return { state, event, ability, source, first, second, ineligible, lowerDeck, side, otherSide, playerId,
    authUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function respond(f, selection = {}, authUid = f.authUid, actionId = `resolve-${f.state.matchId}`) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, ...selection } }
  }, seats, Engine);
}

test("each of the five matching VC AUTOs shares one exact structured definition and its other abilities stay independent", () => {
  for (const cardId of IDS) {
    const parsed = Engine.parseCardAbilitiesCached(definition(cardId));
    const auto = parsed.find(item => item.id === `${cardId}:0`);
    assert.equal(auto.printedText, TEXT, cardId);
    assert.equal(auto.definition.source.patternId, PATTERN, cardId);
    assert.deepEqual(auto.requiredLocation, ["vanguard"], cardId);
    assert.equal(auto.canDecline, false, cardId);
    assert.equal(auto.definition.effects[0].op, "search-top-up-to-two-filtered-one-to-hand-rest-to-memory", cardId);
    assert.equal(auto.definition.source.officialTextVerified, cardId !== IDS[0], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(auto), cardId !== IDS[0], cardId);
    assert.ok(parsed.length > 1, `${cardId} keeps its other printed abilities independently parsed`);
  }
  const future = Engine.parseCardAbilities({ id: "unlisted-future-card", text: TEXT })[0];
  assert.equal(future.definition, null, "similar text on an unreviewed card cannot inherit a trusted definition");
});

test("Ichika stays compiled but cannot trigger online until her official text is confirmed", () => {
  const f = fixture({ cardId: IDS[0] });
  assert.equal(f.ability.definition.source.officialTextVerified, false);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), false);
  assert.equal(discover(f).queued.length, 0);
});

test("each officially verified card lets both seats privately resolve its own placement trigger", () => {
  for (const cardId of IDS.slice(1)) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side });
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side).pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, f.otherSide).pendingAbility, null);
    const result = respond(f, { effectUids: [f.first.uid, f.second.uid], handChoiceUid: f.second.uid });
    assert.equal(result.ok, true, `${side}: ${result.reason || "resolved"}`);
    assert.ok(f.state.players[side].hand.some(item => item.uid === f.second.uid));
    assert.ok(f.state.players[side].orders.some(item => item.uid === f.first.uid && item.zone === "order" && item.faceUp === true));
    assert.deepEqual(new Set(f.state.players[side].deck.map(item => item.uid)), new Set([f.ineligible.uid, f.lowerDeck.uid]));
    assert.equal(f.state.players[f.otherSide].hand.length, 0);
    assert.equal(f.state.players[f.otherSide].orders.length, 0);
  }
});

test("only the exact source's placement on VC triggers this AUTO", () => {
  for (const change of [
    { currentLocation: "rear-left", circle: "rear-left" },
    { cardInstanceId: "another-copy", subjectCardInstanceId: "another-copy" },
    { sourceCardInstanceId: "another-copy", sourceControllerPlayerId: "other-player" }
  ]) {
    const f = fixture({ cardId: IDS[1] });
    assert.equal(discover(f, Object.freeze({ ...f.event, ...change, eventId: `${f.event.eventId}-${Object.keys(change)[0]}` })).queued.length, 0, JSON.stringify(change));
  }
});

test("no eligible Quintuplets resolves with no card movement and still shuffles the inspected cards back", () => {
  const f = fixture({ cardId: IDS[1], matching: false });
  assert.equal(discover(f).queued.length, 1);
  const result = respond(f, { effectUids: [], handChoiceUid: null });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.players[f.side].orders.length, 0);
  assert.equal(f.state.players[f.side].hand.length, 0);
  assert.deepEqual(new Set(f.state.players[f.side].deck.map(item => item.uid)), new Set([f.ineligible.uid, f.lowerDeck.uid]));
});

test("choosing zero is legal even when Quintuplets are available and skips the impossible hand choice", () => {
  const f = fixture({ cardId: IDS[1], matching: true });
  assert.equal(discover(f).queued.length, 1);
  const before = new Set(f.state.players[f.side].deck.map(item => item.uid));
  const result = respond(f, { effectUids: [], handChoiceUid: null });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.players[f.side].orders.length, 0);
  assert.equal(f.state.players[f.side].hand.length, 0);
  assert.deepEqual(new Set(f.state.players[f.side].deck.map(item => item.uid)), before);
});

test("an invalid selected card or hand choice is rejected without partially moving cards", () => {
  for (const selection of [
    { effectUids: ["not-in-the-top-seven"], handChoiceUid: "not-in-the-top-seven" },
    { effectUids: ["not-a-matching-race"], handChoiceUid: "not-a-matching-race" },
    { effectUids: ["match-a-human", "match-a-human"], handChoiceUid: "match-a-human" },
    { effectUids: ["match-a-human", "match-b-human"], handChoiceUid: "not-selected" }
  ]) {
    const f = fixture({ cardId: IDS[1] });
    assert.equal(discover(f).queued.length, 1);
    const before = f.state.players[f.side].deck.map(item => item.uid);
    const result = respond(f, selection);
    assert.equal(result.ok, false, JSON.stringify(selection));
    assert.deepEqual(f.state.players[f.side].deck.map(item => item.uid), before);
    assert.equal(f.state.players[f.side].hand.length, 0);
    assert.equal(f.state.players[f.side].orders.length, 0);
  }
});

test("the host cannot resolve the joining player's private choice and duplicate replies do not move cards twice", () => {
  const f = fixture({ cardId: IDS[1], side: "bot" });
  assert.equal(discover(f).queued.length, 1);
  const selection = { effectUids: [f.first.uid], handChoiceUid: f.first.uid };
  assert.equal(respond(f, selection, seats.hostAuthUid).ok, false);
  assert.equal(respond(f, selection).ok, true);
  assert.equal(respond(f, selection, seats.guestAuthUid).reason, "duplicate-action");
  assert.equal(f.state.players.bot.hand.filter(item => item.uid === f.first.uid).length, 1);
  assert.equal(f.state.players.bot.orders.filter(item => item.uid === f.first.uid).length, 0);
});
