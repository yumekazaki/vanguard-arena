"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerCardAbilityKeywordIndex(require("./card-ability-keywords.js"));
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const definitions = require("./ability-definitions.js").filter(item => item.source?.patternId === "auto-vanguard-placement-top-five-filtered-search-hand-v1");
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function card(cardId, uid, playerId, extra = {}) {
  const def = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(def, `catalog card ${cardId}`);
  return { uid, cardId: String(cardId), cardName: def.name, type: def.type || "Unit", grade: Number(def.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function setup(side = "bot", { sourceId = "cfa-6135", circle = "vanguard", deckIds = ["cfa-5495", "cfa-31", "cfa-32", "cfa-33", "cfa-34"] } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const sourceDef = definitions.find(item => item.cardId === sourceId);
  assert.ok(sourceDef, `definition ${sourceId}`);
  const source = card(sourceId, `source-${side}`, ownerId, { zone: circle === "vanguard" ? "vanguard" : "rear-guard", circle });
  const player = playerId => ({ playerId, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = circle === "vanguard" ? source : card("cfa-31", `vg-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  if (circle !== "vanguard") players[side].rear.push(source);
  players[side].damage = [{ ...card("cfa-31", `damage-${side}`, ownerId), faceUp: true }];
  players[side].soul = [card("cfa-31", `soul-${side}`, ownerId, { zone: "soul" })];
  players[side].deck = deckIds.map((id, index) => card(id, `deck-${side}-${index}`, ownerId, { zone: "deck" }));
  players[opponentSide].vanguard = card("cfa-31", `opp-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: "filtered-search", stateVersion: 1, side: "human", phase: 2, turn: 4, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "hand", currentLocation: circle, circle, phase: "call", timingWindow: "call" });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  const catalogCard = catalog.find(item => String(item.id) === sourceId);
  const ability = Engine.parseCardAbilities(catalogCard).find(item => item.definition?.source?.patternId === "auto-vanguard-placement-top-five-filtered-search-hand-v1");
  return { state, side, ownerId, source, event, discovery, ability };
}
function resolve(f, effectUid, { auth = f.side === "human" ? "auth-host" : "auth-guest", costUid = f.state.players[f.side].damage[0]?.uid, actionId = `resolve-${f.side}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, effectUid, costSelections: { cb: costUid ? [costUid] : [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
}

test("all 21 exact definitions pass the server gate and compile to the same filter and cost", () => {
  assert.equal(definitions.length, 21);
  for (const definition of definitions) {
    const ability = Engine.parseCardAbilities(catalog.find(item => String(item.id) === String(definition.cardId))).find(item => item.definition?.id === definition.id);
    assert.ok(ability, definition.cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, definition.cardId);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.trigger.eventType, "card.placed");
    assert.equal(ability.trigger.subject, "source");
  }
});

test("host and joining seat each resolve their own filtered search, pay their own cost, and receive their own card", () => {
  for (const side of ["human", "bot"]) {
    const f = setup(side);
    assert.equal(f.discovery.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const selected = f.state.players[side].deck[0];
    const result = resolve(f, selected.uid);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.players[side].hand.some(item => item.uid === selected.uid), true);
    assert.equal(f.state.players[side].damage[0].faceDown, true);
    const other = side === "human" ? "bot" : "human";
    assert.equal(f.state.players[other].hand.length, 0);
    assert.equal(f.state.players[other].damage.length, 0);
  }
});

test("exact source, circle, event, and timing guards prevent unrelated placement prompts", () => {
  const wrongSource = setup("bot");
  const other = card("cfa-31", "other-card", "guest-player");
  wrongSource.state.players.bot.rear.push(other);
  const unrelated = Engine.createGameEvent(wrongSource.state, { type: "card.placed", actingPlayerId: "guest-player", turnPlayerId: "guest-player", sourceCardInstanceId: other.uid, cardInstanceId: other.uid, subjectCardInstanceId: other.uid, subjectOwnerPlayerId: "guest-player", subjectControllerPlayerId: "guest-player", previousLocation: "hand", currentLocation: "rear-guard", circle: "rear-guard", phase: "call", timingWindow: "call" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [unrelated], Engine).queued.length, 0);

  const vcOnly = setup("bot", { sourceId: "cfa-3544", circle: "rear-left" });
  assert.equal(vcOnly.discovery.queued.length, 0, "VC-only printed text cannot trigger from RC");
  const wrongCircle = setup("bot", { circle: "rear-left" });
  const forgedVanguardEvent = { ...wrongCircle.event, eventId: `${wrongCircle.event.eventId}-wrong-circle`, currentLocation: "vanguard", circle: "vanguard" };
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [forgedVanguardEvent], Engine).queued.length, 0, "event's claimed circle must match the source's actual zone");

  const wrongTiming = setup("bot");
  const attackEvent = Engine.createGameEvent(wrongTiming.state, { type: "unit.attacked", actingPlayerId: "guest-player", turnPlayerId: "guest-player", sourceCardInstanceId: wrongTiming.source.uid, subjectCardInstanceId: wrongTiming.source.uid, subjectOwnerPlayerId: "guest-player", subjectControllerPlayerId: "guest-player", currentLocation: "vanguard", circle: "vanguard", phase: "battle", timingWindow: "attack-declared" });
  assert.equal(Reducer.discoverAutoTriggers(wrongTiming.state, [attackEvent], Engine).queued.length, 0, "placement AUTO must not enter from an unrelated battle event");
});

test("unavailable costs, mismatched filters, and invalid selections reject without partial state changes", () => {
  const noCost = setup("bot");
  noCost.state.players.bot.damage = [];
  const beforeNoCost = structuredClone(noCost.state);
  assert.equal(resolve(noCost, noCost.state.players.bot.deck[0].uid, { costUid: null }).ok, false);
  assert.deepEqual(noCost.state, beforeNoCost);

  const wrongFilter = setup("bot", { deckIds: ["cfa-31", "cfa-32", "cfa-33", "cfa-34", "cfa-35"] });
  const beforeWrongFilter = structuredClone(wrongFilter.state);
  assert.equal(resolve(wrongFilter, wrongFilter.state.players.bot.deck[0].uid).ok, false);
  assert.deepEqual(wrongFilter.state, beforeWrongFilter);

  const outsideTopFive = setup("bot");
  outsideTopFive.state.players.bot.deck.unshift(card("cfa-5495", "deep-contest", "guest-player", { zone: "deck" }));
  const beforeDeep = structuredClone(outsideTopFive.state);
  assert.equal(resolve(outsideTopFive, "deep-contest").ok, false);
  assert.deepEqual(outsideTopFive.state, beforeDeep);
});
