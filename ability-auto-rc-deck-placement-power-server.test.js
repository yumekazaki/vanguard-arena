"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-rc-deck-placement-power-turn-v1";
const FAMILY = [
  ["cfa-10666", 10000], ["cfa-10774", 10000],
  ["cfa-11518", 5000], ["cfa-12579", 15000]
];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardFor = id => catalog.find(card => String(card.id) === id);
const abilityFor = id => Engine.parseCardAbilitiesCached(cardFor(id)).find(ability => ability.id === `${id}:0`);
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), deck: [], drop: [], hand: [], soul: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });

function fixture({ cardId = FAMILY[0][0], side = "human", eventSourceUid, previousLocation = "deck", circle = "rear-guard", placeSource = true } = {}) {
  const card = cardFor(cardId), ability = abilityFor(cardId);
  assert.ok(card, `catalog card ${cardId}`); assert.ok(ability, `compiled ability ${cardId}:0`);
  const playerId = side === "human" ? "player-host" : "player-guest", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${side}-${cardId}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 8000 };
  const own = player(playerId), other = player(opponentId);
  if (placeSource) own.rear[0] = source;
  const players = side === "human" ? { human: own, bot: other } : { human: other, bot: own };
  const state = { matchId: `rc-deck-power-${cardId}-${side}`, stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, { eventId: `placed-${cardId}-${side}`, type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: eventSourceUid || source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    subjectCardInstanceId: eventSourceUid || source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation, currentLocation: circle === "rear-guard" ? "rear-left" : circle, circle, phase: "main", timingWindow: "call-from-deck" });
  return { state, event, ability, source, own, other, side, playerId };
}

function resolve(f, actor = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId: `resolve-${f.side}-${f.ability.id}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("four catalog AUTO definitions preserve Deck-to-RC trigger and printed turn power", () => {
  const definitions = require("./ability-definitions.js").filter(item => item.source?.patternId === PATTERN);
  assert.equal(definitions.length, FAMILY.length);
  for (const [cardId, amount] of FAMILY) {
    const ability = abilityFor(cardId);
    assert.equal(ability.kind, "AUTO"); assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.trigger.eventType, "card.placed"); assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.trigger.circles, ["rear-guard"]); assert.equal(ability.trigger.sourceLocation, "deck");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount, duration: "turn" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("host and joining player receive private prompts and resolve only their own power effect", () => {
  for (const side of ["human", "bot"]) for (const [cardId, amount] of FAMILY) {
    const f = fixture({ cardId, side });
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 1, `${side}/${cardId}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    const wrongActor = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const snapshot = JSON.stringify(f.state);
    assert.equal(resolve(f, wrongActor).ok, false);
    assert.equal(JSON.stringify(f.state), snapshot);
    const applied = resolve(f);
    assert.equal(applied.ok, true, applied.reason);
    assert.equal(f.source.turnPowerBoost, amount);
    assert.equal(f.source.turnPowerExpiry, f.source.controllerPlayerId);
    assert.equal(f.other.rear.every(card => card === null), true);
  }
});

test("wrong source, non-Deck origin, non-RC placement, or absent source on RC cannot trigger", () => {
  for (const invalid of [
    { eventSourceUid: "different-card-instance" },
    { previousLocation: "hand" },
    { circle: "vanguard" },
    { placeSource: false }
  ]) {
    const f = fixture(invalid);
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 0, JSON.stringify(invalid));
    assert.equal(f.state.pendingAbility, null);
    assert.equal(f.source.turnPowerBoost, undefined);
  }
});

test("duplicate placement event is not offered or resolved twice", () => {
  const f = fixture({ side: "bot", cardId: FAMILY[0][0] });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  assert.equal(resolve(f).ok, true);
  const snapshot = JSON.stringify(f.state);
  assert.equal(resolve(f).ok, false);
  assert.equal(JSON.stringify(f.state), snapshot);
});
