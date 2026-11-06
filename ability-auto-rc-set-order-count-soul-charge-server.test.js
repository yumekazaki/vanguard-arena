"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0022.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
Engine.registerAbilityDefinitions(contribution.proposedDefinitions);

function instance(cardId, uid, playerId, overrides = {}) {
  const card = catalogById.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name, type: card?.type || "Unit", grade: Number(card?.grade),
    power: Number(card?.power || 0), unitCard: card?.type === "Unit", ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function fixture({ side = "human", ownSetOrders = 2, opponentSetOrders = 0, ownNormalOrders = 0, sourceCircle = "rear-left", previousLocation = "hand" } = {}) {
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const source = instance("cfa-10586", `proto-galaxy-${side}`, ownerId, { zone: "rear-guard", circle: sourceCircle });
  const own = { playerId: ownerId, vanguard: instance("cfa-3", `own-vg-${side}`, ownerId), rear: Array(5).fill(null),
    soul: [], deck: [instance("cfa-4", `deck-bottom-${side}`, ownerId), instance("cfa-3", `charged-top-${side}`, ownerId)], hand: [], drop: [], bind: [], damage: [],
    orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: instance("cfa-4", `opponent-vg-${side}`, opponentId), rear: Array(5).fill(null),
    soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  own.rear[0] = source;
  for (let index = 0; index < ownSetOrders; index++) own.orders.push(instance(index % 2 ? "cfa-8315" : "cfa-8253", `own-set-${side}-${index}`, ownerId));
  for (let index = 0; index < ownNormalOrders; index++) own.orders.push(instance("cfa-7351", `own-normal-${side}-${index}`, ownerId));
  for (let index = 0; index < opponentSetOrders; index++) opponent.orders.push(instance("cfa-8253", `opponent-set-${side}-${index}`, opponentId));
  const state = { matchId: `set-order-${side}-${ownSetOrders}-${opponentSetOrders}`, stateVersion: 1, turn: 2, side, phase: 4, ended: false,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation, currentLocation: sourceCircle, circle: sourceCircle, phase: "main", timingWindow: "normal-call" });
  return { state, source, event, side, ownerId, opponentId };
}

function decide(f, accept, actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, engine = Engine) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid, actionId: `resolve-${f.state.matchId}-${accept}-${actorAuthUid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: "cfa-10586:0" } } }, seats, engine);
}

function placed(f, eventOverrides = {}) {
  return Engine.createGameEvent(f.state, { ...f.event, ...eventOverrides, eventId: undefined, sequence: undefined });
}

test("One Who Peruses the Proto Galaxy is an optional RC-placement AUTO with the exact Set Order threshold", () => {
  const card = catalogById.get("cfa-10586");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === "cfa-10586:0");
  assert.equal(card.name, "One Who Peruses the Proto Galaxy");
  assert.equal(ability.kind, "AUTO");
  assert.equal(ability.printedText, contribution.proposedDefinitions[2].printedText);
  assert.equal(ability.trigger.eventType, "card.placed");
  assert.equal(ability.trigger.subject, "source");
  assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.conditions, [{ type: "controller-set-order-count-at-least", count: 2 }]);
  assert.equal(ability.canDecline, true);
  assert.equal(ability.once, false);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Engine.evaluateAbilityConditions(ability, { controllerSetOrderCount: 2 }), true);
  assert.equal(Engine.evaluateAbilityConditions(ability, { controllerSetOrderCount: 1 }), false);
});

test("Set Order threshold counts only the controller's Set Orders, not normal or opponent orders", () => {
  for (const options of [
    { ownSetOrders: 1, opponentSetOrders: 1 },
    { ownSetOrders: 0, opponentSetOrders: 2 },
    { ownSetOrders: 1, ownNormalOrders: 1 },
    { ownSetOrders: 0, ownNormalOrders: 2 }
  ]) {
    const f = fixture(options);
    const located = Engine.locateCardInstance(f.state, f.source.uid);
    const context = Reducer.buildConditionContext(f.state, f.event, located, Engine);
    assert.equal(context.controllerSetOrderCount, options.ownSetOrders || 0);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, JSON.stringify(options));
  }
});

test("placement AUTO is tied to this instance entering an RC, not another source or circle-to-circle movement", () => {
  const wrongCircle = fixture({ sourceCircle: "vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);

  const movedFromCircle = fixture({ previousLocation: "rear-right" });
  assert.equal(Reducer.discoverAutoTriggers(movedFromCircle.state, [movedFromCircle.event], Engine).queued.length, 0);

  const wrongSource = fixture();
  const other = instance("cfa-4", "other-placed-instance", wrongSource.ownerId);
  wrongSource.state.players[wrongSource.side].rear[1] = other;
  const event = placed(wrongSource, { sourceCardInstanceId: other.uid, sourceOwnerPlayerId: other.ownerPlayerId,
    sourceControllerPlayerId: other.controllerPlayerId, cardInstanceId: other.uid, subjectCardInstanceId: other.uid,
    subjectOwnerPlayerId: other.ownerPlayerId, subjectControllerPlayerId: other.controllerPlayerId, circle: "rear-right", currentLocation: "rear-right" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [event], Engine).queued.length, 0);
});

test("host and joining player receive and resolve their own Set Order placement AUTO", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ side });
    const queued = Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued;
    assert.equal(queued.length, 1, `${side}: ${JSON.stringify(queued)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);

    if (side === "bot") {
      const hostAttempt = decide(f, true, seats.hostAuthUid);
      assert.equal(hostAttempt.ok, false);
      assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    }

    const resolved = decide(f, true);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason}`);
    const controller = f.state.players[side];
    const opponent = f.state.players[side === "human" ? "bot" : "human"];
    assert.deepEqual(controller.soul.map(card => card.uid), [`charged-top-${side}`]);
    assert.equal(controller.soul[0].zone, "soul");
    assert.equal(controller.soul[0].faceUp, true);
    assert.equal(controller.deck.length, 1);
    assert.equal(opponent.soul.length, 0);
    assert.equal(f.state.ended, false);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, "same event is not reprocessed");
  }
});

test("declining optional Soul Charge consumes the event without repeating the prompt", () => {
  const f = fixture();
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = decide(f, false);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.players.human.soul.length, 0);
  assert.equal(f.state.players.human.deck.length, 2);
  assert.equal(f.state.pendingAbility, null);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
});

test("Soul Charge from the last deck card resolves before the check-timing deck-out rule", () => {
  const f = fixture();
  f.state.players.human.deck = [instance("cfa-3", "last-card", f.ownerId)];
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = decide(f, true);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(f.state.players.human.soul.map(card => card.uid), ["last-card"]);
  assert.equal(f.state.ended, true);
  assert.equal(f.state.endReason, "deck-empty");
  assert.equal(f.state.loserSide, "human");
  const ended = result.events.find(event => event.type === "game.ended");
  assert.equal(ended.timingWindow, "effect-resolution");
  assert.equal(Object.hasOwn(ended, "attemptedDraw"), false);
});

test("deck-out is checked against the final deck state after the effect program", () => {
  const f = fixture();
  f.state.players.human.deck = [instance("cfa-3", "last-card", f.ownerId)];
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);

  const engine = Object.create(Engine);
  Object.defineProperty(engine, "resolveEffectProgram", { value: (...args) => {
    const result = Engine.resolveEffectProgram(...args);
    if (result.ok && result.deckOut) {
      const match = args[2]?.match;
      const affectedPlayer = Object.values(match?.players || {}).find(player => player?.playerId === result.deckOut.playerId);
      if (affectedPlayer) affectedPlayer.deck.push(instance("cfa-4", "returned-during-effect", affectedPlayer.playerId, { zone: "deck" }));
    }
    return result;
  } });

  const result = decide(f, true, seats.hostAuthUid, engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.players.human.deck.length, 1);
  assert.equal(f.state.ended, false);
  assert.equal(f.state.endReason, undefined);
  assert.equal(result.events.some(event => event.type === "game.ended"), false);
});
