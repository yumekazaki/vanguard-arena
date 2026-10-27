"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const PATTERN = "auto-vanguard-placement-draw-discard-v1";

function makeCard(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(card => String(card.id) === String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name || "Normal Unit", type: definition?.type || "Unit", grade: Number(definition?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function setup(cardId = "cfa-6743", side = "bot") {
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = otherSide === "human" ? "host-player" : "guest-player";
  const cardDefinition = catalog.find(card => String(card.id) === cardId);
  assert.ok(cardDefinition, `catalog definition ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(cardDefinition).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${cardId} has this exact reviewed mechanic`);
  const circle = ability.trigger.circles[0] === "rear-guard" && ability.trigger.circles.length === 1 ? "rear-left" : "vanguard";
  const source = makeCard(cardId, `source-${side}`, ownerId, { zone: circle === "vanguard" ? "vanguard" : "rear-guard", circle });
  const ownHand = [makeCard("cfa-2", `hand-${side}`, ownerId)];
  const drawn = makeCard("cfa-2", `draw-${side}`, ownerId);
  const player = id => ({ playerId: id, vanguard: null, rear: [], soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  if (circle === "vanguard") players[side].vanguard = source;
  else players[side].rear.push(source);
  players[side].hand = ownHand;
  players[side].deck = [drawn];
  players[otherSide].vanguard = makeCard("cfa-3", `opponent-vanguard-${side}`, otherId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: "placement-draw-discard", stateVersion: 1, side, phase: 2, turn: 4, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: circle, circle, timingWindow: "call"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  return { state, ability, source, ownHand, drawn, side, ownerId, discovered };
}

function respond(fixture, selection, accept = true, actorAuthUid = fixture.side === "human" ? "auth-host" : "auth-guest") {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId: `decision-${fixture.side}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { accept, selection: { instanceUid: fixture.source.uid, abilityId: fixture.ability.id, ...selection } }
  }, seats, Engine);
}

test("all 28 exact Vanguard placement draw-discard definitions pass the trusted ability gate", () => {
  let count = 0;
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    count++;
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
    assert.equal(ability.trigger.eventType, "card.placed");
    assert.equal(ability.trigger.subject, "source");
  }
  assert.equal(count, 28);
  assert.equal(Reducer.supportsServerEffectOperation("draw-then-discard"), false, "the effect is not generally enabled for unreviewed abilities");
});

test("host and joining player each resolve only their own placed unit and choose their own discard", () => {
  for (const side of ["human", "bot"]) {
    const fixture = setup("cfa-6743", side);
    assert.equal(fixture.discovered.queued.length, 1, JSON.stringify(fixture.discovered));
    assert.equal(fixture.state.pendingAbility.side, side);
    const result = respond(fixture, { effectDiscardUid: fixture.drawn.uid });
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(fixture.state.players[side].hand, [fixture.ownHand[0]]);
    assert.deepEqual(fixture.state.players[side].drop, [fixture.drawn]);
    assert.equal(fixture.state.players[side === "human" ? "bot" : "human"].drop.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.drawn", "card.discarded"]);
  }
});

test("discard choice may select an existing card after draw and rejects foreign or stale choices atomically", () => {
  const existing = setup();
  const existingCardUid = existing.ownHand[0].uid;
  const paid = respond(existing, { effectDiscardUid: existingCardUid });
  assert.equal(paid.ok, true, paid.reason);
  assert.deepEqual(paid.state.players.bot.hand.map(card => card.uid), [existing.drawn.uid]);
  assert.deepEqual(paid.state.players.bot.drop.map(card => card.uid), [existingCardUid]);

  for (const invalidUid of ["foreign-card", "missing-card"]) {
    const fixture = setup();
    fixture.state.players.human.hand.push(makeCard("cfa-2", "foreign-card", "host-player"));
    const snapshot = structuredClone(fixture.state);
    const rejected = respond(fixture, { effectDiscardUid: invalidUid });
    assert.equal(rejected.ok, false);
    assert.deepEqual(fixture.state, snapshot);
  }
});

test("unrelated placement, wrong circle, host proxy, and duplicate decisions cannot resolve the ability", () => {
  const fixture = setup("cfa-6743", "bot");
  assert.equal(respond(fixture, { effectDiscardUid: fixture.drawn.uid }, true, "auth-host").ok, false);
  const accepted = respond(fixture, { effectDiscardUid: fixture.drawn.uid });
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(respond(fixture, { effectDiscardUid: fixture.drawn.uid }).ok, false);

  const wrongSourceEvent = setup("cfa-6743");
  wrongSourceEvent.state.pendingAbility.eventContext.gameEvent = Object.freeze({
    ...wrongSourceEvent.state.pendingAbility.eventContext.gameEvent,
    cardInstanceId: "different-copy", subjectCardInstanceId: "different-copy"
  });
  assert.equal(respond(wrongSourceEvent, { effectDiscardUid: wrongSourceEvent.drawn.uid }).ok, false);

  const wrongCircle = setup("cfa-6743");
  const wrongCircleEvent = Engine.createGameEvent(wrongCircle.state, {
    type: "card.placed", actingPlayerId: wrongCircle.ownerId, turnPlayerId: wrongCircle.ownerId,
    cardInstanceId: wrongCircle.source.uid, subjectCardInstanceId: wrongCircle.source.uid,
    sourceCardInstanceId: wrongCircle.source.uid, previousLocation: "hand", currentLocation: "rear-guard", circle: "rear-left"
  });
  wrongCircle.state.pendingAbility = null;
  wrongCircle.state.pendingAbilities = [];
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircleEvent], Engine).queued.length, 0);
});
