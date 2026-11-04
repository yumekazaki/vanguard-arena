"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = loadCatalog();
const FAMILY = [
  { cardId: "cfa-2661", abilityId: "cfa-2661:1", reference: "https://en.cf-vanguard.com/cardlist/?cardno=G-SD01%2F002EN" },
  { cardId: "cfa-2668", abilityId: "cfa-2668:1", reference: "https://en.cf-vanguard.com/cardlist/?cardno=PR%2F0186EN" },
  { cardId: "cfa-3102", abilityId: "cfa-3102:1", reference: "https://en.cf-vanguard.com/cardlist/?cardno=G-BT04%2F029EN" }
];
const PATTERN = "auto-vanguard-own-g-unit-stride-choose-vanguard-power-turn-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardFor = id => CATALOG.find(card => String(card.id) === String(id));
const make = (cardId, uid, playerId, extra = {}) => {
  const card = cardFor(cardId);
  assert.ok(card, `catalog card ${cardId}`);
  return { uid, cardId: String(card.id), cardName: card.name, type: card.type, grade: Number(card.grade), power: Number(card.power || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
};

function fixture(side, entry) {
  const ownId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = side === "human" ? "player-guest" : "player-host";
  const source = make(entry.cardId, `heart-${side}-${entry.cardId}`, ownId, { zone: "vanguard", circle: "vanguard" });
  const vanguard = make("cfa-14047", `opposing-vg-${side}`, otherId, { zone: "vanguard", circle: "vanguard" });
  const stride = { uid: `g-unit-${side}-${entry.cardId}`, cardId: "test-g-unit", cardName: "Test Stride Unit", type: "G Unit", grade: 4, gDeckCard: true, faceUp: false, ownerPlayerId: ownId, controllerPlayerId: ownId };
  const cost = { uid: `stride-cost-${side}-${entry.cardId}`, cardId: "test-grade-three", cardName: "Stride Cost", type: "Unit", grade: 3, ownerPlayerId: ownId, controllerPlayerId: ownId };
  const player = (playerId, currentVanguard) => ({ playerId, vanguard: currentVanguard, rear: Array(5).fill(null), hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], triggerZone: [], guardCircle: [], usedAbilities: [] });
  const own = player(ownId, source), opponent = player(otherId, vanguard);
  own.gDeck.push(stride);
  own.hand.push(cost);
  const state = {
    matchId: `stride-${side}-${entry.cardId}`, stateVersion: 1, turn: 1, phase: 3, side, stridePerformed: false,
    turnStartGrades: { human: 3, bot: 3 }, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [],
    pendingAbilities: [], pendingAbility: null, pendingTrigger: null, pendingAttack: null, pendingTurnEnd: null,
    players: { human: side === "human" ? own : opponent, bot: side === "bot" ? own : opponent }
  };
  const ability = Engine.parseCardAbilitiesCached(cardFor(entry.cardId)).find(item => item.id === entry.abilityId);
  assert.ok(ability, `${entry.abilityId} parsed`);
  assert.equal(ability.definition?.source?.patternId, PATTERN);
  return { state, source, stride, cost, side, ownId, otherId, otherSide, entry, ability };
}

function stride(f) {
  return Reducer.applyGameAction(f.state, {
    actorAuthUid: f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId: `stride-${f.side}-${f.entry.cardId}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "stride", strideCardInstanceId: f.stride.uid, costCardInstanceIds: [f.cost.uid] }
  }, SEATS, Engine);
}

function resolve(f, selection, actorAuthUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId = `resolve-${f.side}-${f.entry.cardId}`) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.entry.abilityId, ...selection } }
  }, SEATS, Engine);
}

test("the three official AUTO abilities share the exact mandatory Stride event and Vanguard power handler", () => {
  for (const entry of FAMILY) {
    const ability = Engine.parseCardAbilitiesCached(cardFor(entry.cardId)).find(item => item.id === entry.abilityId);
    assert.equal(ability.kind, "AUTO");
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.deepEqual(ability.trigger, {
      status: "recognized-trigger", eventType: "card.stridden", subject: "stride-source", circles: ["vanguard"],
      destinationLocation: "vanguard", requiredPhase: "stride", requiredTimingWindow: "normal-stride", turnRelation: "controller"
    });
    assert.deepEqual(ability.conditions, []);
    assert.deepEqual(ability.costs, []);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power-target", target: "chosen", amount: 5000, duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" } }]);
    assert.deepEqual(ability.definition.source.officialReferences, [entry.reference]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player trigger from their own exact Vanguard Stride source and choose their own Vanguard", () => {
  for (const side of ["human", "bot"]) for (const entry of FAMILY) {
    const f = fixture(side, entry);
    const result = stride(f);
    assert.equal(result.ok, true, `${side}/${entry.cardId}: ${result.reason}`);
    const strideEvent = result.events.find(event => event.type === "card.stridden");
    assert.ok(strideEvent, "the server emits a distinct Stride event");
    assert.equal(strideEvent.cardInstanceId, f.stride.uid);
    assert.equal(strideEvent.strideSources[0].cardInstanceId, f.source.uid);
    assert.equal(strideEvent.strideSources[0].locationAtTrigger, "vanguard");
    assert.equal(f.state.pendingAbility?.side, side);
    assert.equal(f.state.pendingAbility?.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility?.ability.id, f.entry.abilityId);
    assert.equal(f.state.pendingAbility?.field, "vanguard");
    assert.equal(Engine.locateCardInstance(f.state, f.source.uid).zone, "vanguard-heart");

    const duplicate = Reducer.discoverAutoTriggers(f.state, [strideEvent], Engine);
    assert.equal(duplicate.queued.length, 0, "the same event cannot enqueue the source twice");

    const wrongTarget = resolve(f, { targetUid: f.state.players[f.otherSide].vanguard.uid }, undefined, `wrong-target-${side}-${entry.cardId}`);
    assert.equal(wrongTarget.ok, false, "the opponent's Vanguard is not a legal target");
    const accepted = resolve(f, { targetUid: f.stride.uid });
    assert.equal(accepted.ok, true, `${side}/${entry.cardId}: ${accepted.reason}`);
    assert.equal(f.state.players[side].vanguard.turnPowerBoost, 5000);
    assert.equal(f.state.players[side].vanguard.turnPowerExpiry, f.ownId);
    assert.equal(f.state.players[f.otherSide].vanguard.turnPowerBoost || 0, 0);
  }
});

test("a joining player's prompt cannot be resolved by the host", () => {
  const f = fixture("bot", FAMILY[0]);
  assert.equal(stride(f).ok, true);
  const rejected = resolve(f, { targetUid: f.stride.uid }, SEATS.hostAuthUid, "host-forged-guest-stride-resolution");
  assert.equal(rejected.ok, false);
  assert.equal(f.state.players.bot.vanguard.turnPowerBoost || 0, 0);
  assert.equal(f.state.pendingAbility?.side, "bot");
  const accepted = resolve(f, { targetUid: f.stride.uid }, SEATS.guestAuthUid, "guest-owned-stride-resolution");
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  assert.equal(f.state.players.bot.vanguard.turnPowerBoost, 5000);
});

test("a forged placement or malformed Stride event cannot substitute for the source-specific event", () => {
  const f = fixture("human", FAMILY[0]);
  assert.equal(stride(f).ok, true);
  const actual = f.state.pendingAbility.eventContext.gameEvent;
  f.state.pendingAbility = null;
  f.state.pendingAbilities = [];
  f.state.processedAbilityTriggers = [];
  const invalid = [
    { ...actual, eventId: actual.eventId + ":placement", type: "card.placed" },
    { ...actual, eventId: actual.eventId + ":wrong-turn", turnPlayerId: f.otherId },
    { ...actual, eventId: actual.eventId + ":wrong-phase", phase: "main" },
    { ...actual, eventId: actual.eventId + ":wrong-window", timingWindow: "normal-call" },
    { ...actual, eventId: actual.eventId + ":missing-source", strideSources: [] },
    { ...actual, eventId: actual.eventId + ":not-stride", isGUnitStride: false }
  ];
  for (const event of invalid) assert.equal(Reducer.discoverAutoTriggers(f.state, [event], Engine).queued.length, 0, event.eventId);
});
