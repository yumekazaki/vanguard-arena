"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerCardAbilityKeywordIndex(require("./card-ability-keywords.js"));
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-vanguard-placement-top-five-filtered-search-hand-v1";
const definitions = Engine.getReviewedAbilityDefinitionsForCard;
const records = require("./ability-definitions.js").filter(item => item.source?.patternId === PATTERN);
const catalog = loadCatalog();

test("every curated Vanguard-placement top-five AUTO definition is exact and server-supported", () => {
  assert.equal(records.length, 21);
  for (const definition of records) {
    const card = catalog.find(item => String(item.id) === String(definition.cardId));
    assert.ok(card, `catalog card ${definition.cardId}`);
    const ability = Engine.parseCardAbilities(card).find(item => item.definition?.id === definition.id);
    assert.ok(ability, `parsed ability ${definition.id}`);
    assert.equal(ability.kind, "AUTO");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, definition.cardId);
    assert.equal(ability.trigger.eventType, "card.placed");
    assert.equal(ability.trigger.subject, "source");
    assert.ok(ability.trigger.circles.includes("vanguard"));
  }
  assert.equal(definitions instanceof Function, true);
});

test("keyword-any top-five filter recognizes only indexed abilities", () => {
  const [vote, contest] = records.filter(item => item.cardId === "cfa-6135")[0].effects[0].filter.abilityKeywordsAny;
  assert.deepEqual([vote, contest], ["vote", "contest"]);
  assert.equal(Engine.hasAbilityKeyword("cfa-5495", "contest"), true);
  assert.equal(Engine.matchesTargetFilter({ abilityKeywordsAny: ["vote", "contest"] }, { targetCard: { cardId: "cfa-5495" } }), true);
  assert.equal(Engine.matchesTargetFilter({ abilityKeywordsAny: ["vote", "contest"] }, { targetCard: { id: "unindexed-card", name: "Normal Unit", text: "AUTO: When this unit attacks, draw a card." } }), false);
});

test("placement AUTO prompt belongs only to the controller of the exact placed card", () => {
  for (const side of ["human", "bot"]) {
    const ownerId = side === "human" ? "host-player" : "guest-player";
    const sourceCardId = "cfa-3544";
    const card = catalog.find(item => String(item.id) === sourceCardId);
    const source = { uid: `source-${side}`, cardId: sourceCardId, ownerPlayerId: ownerId, controllerPlayerId: ownerId, zone: "vanguard", circle: "vanguard" };
    const otherSide = side === "human" ? "bot" : "human";
    const player = playerId => ({ playerId, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
    const state = { side: "human", turn: 1, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players: { human: player("host-player"), bot: player("guest-player") } };
    state.players[side].vanguard = source;
    state.players[otherSide].vanguard = { uid: `opp-v-${side}`, cardId: "cfa-31", ownerPlayerId: otherSide === "human" ? "host-player" : "guest-player", controllerPlayerId: otherSide === "human" ? "host-player" : "guest-player", zone: "vanguard", circle: "vanguard" };
    const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "call", timingWindow: "call" });
    const result = Reducer.discoverAutoTriggers(state, [event], Engine);
    assert.equal(result.queued.length, 1);
    assert.equal(result.queued[0].side, side);
    assert.equal(result.queued[0].triggerControllerPlayerId, ownerId);
    assert.equal(state.pendingAbility?.side, side);
    assert.equal(Reducer.discoverAutoTriggers(state, [event], Engine).queued.length, 0, "duplicate event is not queued again");
    assert.ok(card);
  }
});

