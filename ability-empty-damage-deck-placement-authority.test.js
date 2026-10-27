"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PATTERN = "auto-rc-from-hand-empty-damage-deck-to-damage-v1";

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name || "Unit", type: definition?.type || "Unit", grade: Number(definition?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function setup(side = "bot", { damageCount = 0, previousLocation = "hand", deckCount = 1 } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player", opponentSide = side === "human" ? "bot" : "human", opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const definition = catalog.find(item => String(item.id) === "cfa-8698");
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability);
  const source = card(definition.id, `empty-damage-source-${side}`, ownerId, { zone: "rear-guard", circle: "rear-left" });
  const player = playerId => ({ playerId, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = card("cfa-3", `own-vanguard-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  players[side].rear.push(source);
  players[side].damage = Array.from({ length: damageCount }, (_, index) => card("cfa-2", `damage-${side}-${index}`, ownerId, { zone: "damage", faceDown: false }));
  players[side].deck = Array.from({ length: deckCount }, (_, index) => card("cfa-2", `deck-${side}-${index}`, ownerId, { zone: "deck" }));
  players[opponentSide].vanguard = card("cfa-3", `opponent-vanguard-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: "empty-damage-deck-to-damage", stateVersion: 1, side, phase: 2, turn: 5, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation, currentLocation: "rear-left", circle: "rear-left", phase: "call", timingWindow: "call"
  });
  const discovery = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, side, ownerId, opponentId, source, ability, event, discovery, deck: players[side].deck };
}

function resolve(fixture, actorAuthUid = fixture.side === "human" ? "auth-host" : "auth-guest") {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId: `resolve-${fixture.side}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id } }
  }, seats, Engine);
}

test("all 27 exact RC placement-from-hand abilities use the trusted deck-to-damage gate", () => {
  let count = 0;
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    count++;
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
    assert.equal(ability.trigger.eventType, "card.placed");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
    assert.equal(ability.trigger.sourceLocation, "hand");
    assert.deepEqual(ability.conditions, [{ type: "damage-zone-empty" }, { type: "source-placed-from-hand" }]);
  }
  assert.equal(count, 27);
  assert.equal(Reducer.supportsServerEffectOperation("deck-to-damage"), false);
});

test("host and joining player each move only their own deck's top card face up into damage", () => {
  for (const side of ["human", "bot"]) {
    const fixture = setup(side);
    assert.equal(fixture.discovery.queued.length, 1);
    assert.equal(fixture.state.pendingAbility.side, side);
    const drawnUid = fixture.deck.at(-1).uid;
    const result = resolve(fixture);
    assert.equal(result.ok, true, result.reason);
    const own = fixture.state.players[side], opponent = fixture.state.players[side === "human" ? "bot" : "human"];
    assert.equal(own.deck.length, 0);
    assert.deepEqual(own.damage.map(item => item.uid), [drawnUid]);
    assert.equal(own.damage[0].faceDown, false);
    assert.equal(opponent.damage.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.damage_moved"]);
    assert.equal(result.events[0].cardInstanceId, drawnUid);
    assert.equal(result.events[0].previousLocation, "deck");
    assert.equal(result.events[0].currentLocation, "damage");
  }
});

test("nonempty damage, non-hand placement, and wrong-circle events never create a prompt", () => {
  const nonempty = setup("bot", { damageCount: 1 });
  assert.equal(nonempty.discovery.queued.length, 0);

  const fromDrop = setup("bot", { previousLocation: "drop" });
  assert.equal(fromDrop.discovery.queued.length, 0);

  const wrongCircle = setup();
  wrongCircle.state.pendingAbility = null;
  wrongCircle.state.pendingAbilities = [];
  const rearEvent = Engine.createGameEvent(wrongCircle.state, {
    type: "card.placed", actingPlayerId: wrongCircle.ownerId, turnPlayerId: wrongCircle.ownerId,
    sourceCardInstanceId: wrongCircle.source.uid, sourceOwnerPlayerId: wrongCircle.ownerId, sourceControllerPlayerId: wrongCircle.ownerId,
    cardInstanceId: wrongCircle.source.uid, subjectCardInstanceId: wrongCircle.source.uid, subjectOwnerPlayerId: wrongCircle.ownerId, subjectControllerPlayerId: wrongCircle.ownerId,
    previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "call", timingWindow: "call"
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [rearEvent], Engine).queued.length, 0);
});

test("the joining player resolves the owner's prompt; the host cannot proxy and actions cannot replay", () => {
  const fixture = setup("bot");
  const snapshot = structuredClone(fixture.state);
  assert.equal(resolve(fixture, "auth-host").ok, false);
  assert.deepEqual(fixture.state, snapshot);
  const accepted = resolve(fixture);
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(resolve(fixture).ok, false);
  assert.equal(fixture.state.players.bot.damage.length, 1);
});
