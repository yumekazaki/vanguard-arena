"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PATTERN = "auto-order-zone-placement-draw-v1";
const IDS = ["cfa-10288", "cfa-10411", "cfa-10456", "cfa-10459", "cfa-12167", "cfa-13038", "cfa-8315", "cfa-9115"];

function card(cardId, uid, playerId, extra = {}) {
  const def = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: def?.name, type: def?.type, grade: def?.grade, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture(cardId = IDS[0], side = "human", { emptyDeck = false } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = otherSide === "human" ? "host-player" : "guest-player";
  const definition = catalog.find(item => String(item.id) === cardId);
  assert.ok(definition, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:${cardId === "cfa-13038" ? 1 : 0}`);
  assert.ok(ability, `${cardId} has the audited Order Zone AUTO`);
  const source = card(cardId, `source-${cardId}-${side}`, ownerId, { zone: "order", circle: "order" });
  const drawn = card("cfa-2", `draw-${cardId}-${side}`, ownerId);
  const empty = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: empty("host-player"), bot: empty("guest-player") };
  players[side].orders = [source];
  players[side].deck = emptyDeck ? [] : [drawn];
  players[otherSide].vanguard = card("cfa-3", `opponent-vanguard-${side}`, otherId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: "order-zone-placement-draw", stateVersion: 1, turn: 4, phase: "main", side, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "order", circle: "order", phase: "main", timingWindow: "order-zone-placement"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, ability, source, drawn, side, ownerId, discovered, event, definition };
}
function respond(f, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: auth, actionId: `order-draw-${f.side}-${f.source.cardId}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

test("all eight exact Order Zone draw definitions are trusted without absorbing other printed abilities", () => {
  for (const id of IDS) {
    const def = catalog.find(item => String(item.id) === id);
    const abilities = Engine.parseCardAbilitiesCached(def);
    const drawAbilities = abilities.filter(item => item.definition?.source?.patternId === PATTERN);
    assert.equal(drawAbilities.length, 1, id);
    assert.equal(drawAbilities[0].id, `${id}:${id === "cfa-13038" ? 1 : 0}`, id);
    assert.equal(Reducer.supportsServerAbilityEffects(drawAbilities[0]), true, id);
    assert.deepEqual(drawAbilities[0].trigger.circles, ["order"], id);
    assert.equal(drawAbilities[0].definition.effects.length, 1, id);
    assert.equal(drawAbilities[0].definition.effects[0].op, "draw", id);
    assert.equal(Reducer.supportsServerAbilityEffects({ ...drawAbilities[0], definition: { ...drawAbilities[0].definition, effects: [{ op: "draw", count: 2 }] } }), false, `${id} rejects changed effect`);
    assert.equal(Reducer.supportsServerAbilityEffects({ ...drawAbilities[0], definition: { ...drawAbilities[0].definition, printedText: "AUTO: When another card is put into the Order Zone, draw a card." } }), false, `${id} rejects changed text`);
    assert.ok(abilities.length > 1, `${id} retains its other separately parsed ability blocks`);
  }
});

test("host and joining player receive and resolve only their own exact Order Zone draw", () => {
  for (const cardId of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side);
    assert.equal(f.discovered.queued.length, 1, `${cardId}/${side}: ${JSON.stringify(f.discovered)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = respond(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.deepEqual(f.state.players[side].hand.map(item => item.uid), [f.drawn.uid]);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.drawn"]);
  }
});

test("Order Zone draw rejects unrelated zones, another instance, a stale source and duplicate events", () => {
  const baseline = fixture();
  for (const change of [
    { currentLocation: "rear-left", circle: "rear-left" },
    { sourceCardInstanceId: "other-copy", subjectCardInstanceId: "other-copy", cardInstanceId: "other-copy" },
    { previousLocation: "order" }
  ]) {
    const f = fixture();
    const invalidEvent = Object.freeze({ ...f.event, ...change, eventId: `${f.event.eventId}-${Object.keys(change)[0]}` });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [invalidEvent], Engine).queued.length, 0, JSON.stringify(change));
  }
  const duplicate = fixture();
  duplicate.state.pendingAbility = null;
  duplicate.state.pendingAbilities = [];
  duplicate.state.processedAbilityTriggers = [];
  const twice = Reducer.discoverAutoTriggers(duplicate.state, [duplicate.event, duplicate.event], Engine);
  assert.equal(twice.queued.length, 1);
  assert.equal(twice.queued[0].eventContext.eventId, duplicate.event.eventId);
  assert.equal(respond(baseline, seats.guestAuthUid).ok, false, "host cannot resolve the joining player's AUTO");
});

test("a mandatory Order Zone draw that cannot be completed causes that controller to lose", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-9115", side, { emptyDeck: true });
    assert.equal(f.discovered.queued.length, 1);
    const result = respond(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.ended, true);
    assert.equal(f.state.loserSide, side);
    assert.equal(f.state.winnerSide, side === "human" ? "bot" : "human");
    assert.equal(f.state.endReason, "deck-empty");
    assert.equal(result.events.at(-1).type, "game.ended");
  }
});
