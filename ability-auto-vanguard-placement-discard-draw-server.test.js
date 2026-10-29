"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const PATTERN = "auto-vanguard-placement-discard-draw-v1";
const IDS = ["cfa-7839", "cfa-7843", "cfa-7927", "cfa-7957", "cfa-8048", "cfa-8063", "cfa-8188"];
const TEXT = "AUTO [VC]: When placed, COST [discard a card from your hand], and draw a card.";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function makeCard(uid, cardId, playerId) {
  const card = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId, cardName: card?.name || "Test Card", type: card?.type || "Unit", grade: Number(card?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId };
}

function fixture(cardId = IDS[0], side = "human", { hand = true } = {}) {
  const ability = Engine.parseCardAbilitiesCached(catalog.find(card => card.id === cardId)).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled ability ${cardId}:0`);
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = makeCard(`source-${side}-${++sequence}`, cardId, ownerId);
  const discard = makeCard(`discard-${side}-${sequence}`, "cfa-3", ownerId);
  const drawn = makeCard(`draw-${side}-${sequence}`, "cfa-2", ownerId);
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = source;
  players[side].hand = hand ? [discard] : [];
  players[side].deck = [drawn];
  const other = side === "human" ? "bot" : "human";
  players[other].vanguard = makeCard(`opponent-vg-${side}-${sequence}`, "cfa-3", opponentId);
  const state = { matchId: "vanguard-placement-discard-draw", stateVersion: 1, eventSequence: 0, turn: 3, phase: "main", side, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "main", timingWindow: "ride-resolution"
  });
  return { state, ability, event, source, discard, drawn, side, ownerId };
}

function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function respond(f, selection = {}, { actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, accept = true } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid, actionId: `resolve-vanguard-draw-${f.side}-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { discard: selection.discard || [] } } }
  }, seats, Engine);
}

test("the seven exact Vanguard placement draw abilities preserve their catalog text, source circle, cost, and effect", () => {
  for (const id of IDS) {
    const card = catalog.find(item => item.id === id);
    assert.ok(card, id);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${id}:0`);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(ability.requiredLocation, ["vanguard"], id);
    assert.deepEqual(ability.costs, [{ type: "discard", count: 1 }], id);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }], id);
    assert.equal(ability.canDecline, false, id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
});

test("the exact Vanguard controller on either seat pays one discard before drawing", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(IDS[0], side);
    const found = discover(f);
    assert.equal(found.queued.length, 1, JSON.stringify(found));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = respond(f, { discard: [f.discard.uid] });
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.state.players[side].hand, [f.drawn]);
    assert.deepEqual(f.state.players[side].drop, [f.discard]);
    assert.deepEqual(result.events.map(event => event.type), ["card.discarded", "card.drawn"]);
  }
});

test("unpayable, wrong-circle, wrong-instance, stale-source, and host-proxy cases do not resolve", () => {
  const unpaid = fixture(IDS[0], "bot", { hand: false });
  assert.equal(discover(unpaid).queued.length, 0);
  assert.equal(unpaid.state.pendingAbility, null);

  const proxy = fixture(IDS[0], "bot");
  assert.equal(discover(proxy).queued.length, 1);
  const proxyResult = respond(proxy, { discard: [proxy.discard.uid] }, { actorAuthUid: seats.hostAuthUid });
  assert.equal(proxyResult.ok, false);
  assert.equal(proxy.state.players.bot.hand.length, 1);

  const wrongCircle = fixture(IDS[0], "human");
  const wrong = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: undefined, currentLocation: "rear-left", circle: "rear-left" });
  assert.equal(discover(wrongCircle, wrong).queued.length, 0);

  const unrelated = fixture(IDS[0], "human");
  const other = Engine.createGameEvent(unrelated.state, { ...unrelated.event, eventId: undefined, sourceCardInstanceId: "other", subjectCardInstanceId: "other", cardInstanceId: "other" });
  assert.equal(discover(unrelated, other).queued.length, 0);

  const stale = fixture(IDS[0], "human");
  stale.state.players.human.vanguard = null;
  stale.state.players.human.hand.push(stale.source);
  assert.equal(discover(stale).queued.length, 0);
});

test("mandatory trigger cannot be declined and forged text, cost, or effect definitions fail closed", () => {
  const declined = fixture(IDS[0], "human");
  assert.equal(discover(declined).queued.length, 1);
  assert.equal(respond(declined, {}, { accept: false }).ok, false);

  const f = fixture(IDS[0]);
  for (const mutate of [
    ability => { ability.definition.printedText = ability.definition.printedText.replace("discard a card", "discard two cards"); },
    ability => { ability.costs[0].count = 2; },
    ability => { ability.definition.effects[0].count = 2; },
    ability => { ability.definition.id = "cfa-7843:0"; }
  ]) {
    const forged = structuredClone(f.ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
