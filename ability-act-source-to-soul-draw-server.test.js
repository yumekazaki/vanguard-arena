"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-11646", "cfa-11734", "cfa-11737", "cfa-6273"];
const PATTERN = "act-source-to-soul-draw-v1";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const texts = {
  "cfa-11646": "ACT [RC]: COST [Put this unit into your soul], draw a card.",
  "cfa-11734": "ACT [RC]: COST [Put this unit into your soul], draw a card.",
  "cfa-11737": "ACT [RC]: COST [Put this unit into your soul], draw a card.",
  "cfa-6273": "ACT [RC]: [Put this unit into your soul] Draw a card."
};
function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
}
function fixture(cardId = IDS[0], side = "human", { deck = true } = {}) {
  const definition = catalog.find(item => String(item.id) === cardId);
  assert.ok(definition, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `compiled ability ${cardId}`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${cardId}-${side}`, cardId, cardName: definition.name, type: "Unit", unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-left", grade: Number(definition.grade || 0) };
  const drawn = { uid: `draw-${cardId}-${side}`, cardId: "cfa-3", ownerPlayerId: playerId, controllerPlayerId: playerId };
  const own = player(playerId), other = player(opponentId);
  own.rear[0] = source;
  if (deck) own.deck.push(drawn);
  const state = { matchId: `act-source-soul-draw-${cardId}-${side}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 4, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: null, players: side === "human" ? { human: own, bot: other } : { human: other, bot: own } };
  return { card: definition, ability, source, drawn, own, other, side, state };
}
function activate(f, actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid, actionId: `activate-${f.card.id}-${f.side}-${f.state.stateVersion}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: f.ability.id }
  }, seats, Engine);
}

test("the four exact source-to-Soul draw ACT abilities have trusted definitions matching catalog text", () => {
  assert.equal(IDS.length, 4);
  for (const id of IDS) {
    const f = fixture(id);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(id).some(item => item.id === f.ability.id), id);
    assert.equal(f.ability.kind, "ACT", id);
    assert.equal(f.ability.printedText, texts[id], id);
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"], id);
    assert.deepEqual(f.ability.costs, [{ type: "source-to-soul", count: 1 }], id);
    assert.deepEqual(f.ability.effects, [{ op: "draw", count: 1 }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, id);
  }
});

test("host and joining player independently pay by moving their own source to Soul and draw", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    const result = activate(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.own.rear.includes(f.source), false, `${id}/${side} source leaves RC`);
    assert.equal(f.own.soul.some(item => item.uid === f.source.uid), true, `${id}/${side} exact source enters Soul`);
    assert.equal(f.own.hand.some(item => item.uid === f.drawn.uid), true, `${id}/${side} draws one card`);
    assert.equal(f.other.soul.length, 0);
    assert.equal(f.other.hand.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.moved", "card.drawn"]);
  }
});

test("an empty deck still commits the source cost, then ends the match for the activating player", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side, { deck: false });
    const result = activate(f);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.own.soul.some(item => item.uid === f.source.uid), true);
    assert.equal(f.state.ended, true);
    assert.equal(f.state.loserSide, side);
    assert.equal(f.state.winnerSide, side === "human" ? "bot" : "human");
    assert.equal(f.state.endReason, "deck-empty");
    assert.equal(result.events.at(-1).type, "game.ended");
    assert.equal(result.events.at(-1).loserPlayerId, f.own.playerId);
  }
});

test("wrong actor, source zone, phase, or missing source is rejected without partial payment", () => {
  const forged = fixture();
  assert.equal(activate(forged, seats.guestAuthUid).reason, "not-actor-turn");
  const wrongZone = fixture(); wrongZone.own.rear[0] = null; wrongZone.own.hand.push(wrongZone.source);
  const wrongZoneSnapshot = JSON.stringify(wrongZone.state);
  assert.equal(activate(wrongZone).ok, false);
  assert.equal(JSON.stringify(wrongZone.state), wrongZoneSnapshot);
  const wrongPhase = fixture(); wrongPhase.state.phase = 2;
  assert.equal(activate(wrongPhase).reason, "wrong-timing-window");
  const missing = fixture(); missing.own.rear[0] = null;
  assert.equal(activate(missing).reason, "skill-source-not-controlled-on-field");
});

test("untrusted altered text, cost, and effect variants fail closed", () => {
  const f = fixture();
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition: { ...f.ability.definition, printedText: "ACT [RC]: draw a card." } }), false);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, costs: [{ type: "counter-blast", count: 1 }] }), false);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition: { ...f.ability.definition, effects: [{ op: "counter-charge", count: 1 }] } }), false);
});
