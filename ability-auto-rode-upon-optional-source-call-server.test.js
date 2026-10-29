"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-6976", "cfa-7899", "cfa-7959", "cfa-8117", "cfa-8180", "cfa-8204", "cfa-9037"];
const INDEX = Object.fromEntries(IDS.map(id => [id, id === "cfa-9037" ? 0 : 1]));
const TEXT = "AUTO: When rode upon, you may call this card to RC.";
const PATTERN = "auto-rode-upon-optional-source-call-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function card(cardId, uid, playerId) {
  const row = catalog.find(item => String(item.id) === String(cardId)) || {};
  return { uid, cardId, cardName: row.name || String(cardId), type: row.type || "Unit", grade: Number(row.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(cardId = IDS[0], side = "human") {
  const row = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:${INDEX[cardId]}`);
  assert.ok(ability, `compiled exact ability ${cardId}:${INDEX[cardId]}`);
  const n = ++sequence, actor = side === "human" ? "host-player" : "guest-player", opponent = side === "human" ? "guest-player" : "host-player";
  const source = card(cardId, `rode-upon-${n}`, actor), rider = card("cfa-3", `rider-${n}`, actor), drawn = card("cfa-4", `other-${n}`, actor);
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].soul.push(source);
  players[side].vanguard = rider;
  players[side].rear[0] = null;
  players[side === "human" ? "bot" : "human"].vanguard = card("cfa-3", `opp-vg-${n}`, opponent);
  const state = { matchId: "rode-upon-optional-source-call", stateVersion: 2, eventSequence: 0, turn: 4, side, phase: 2,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, { type: "card.ridden", actingPlayerId: actor, turnPlayerId: actor,
    sourceCardInstanceId: rider.uid, sourceCardName: rider.cardName, sourceOwnerPlayerId: actor, sourceControllerPlayerId: actor,
    cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: actor, subjectControllerPlayerId: actor,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [source.uid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow: "normal-ride" });
  return { row, ability, source, rider, drawn, state, event, side, actor };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, { auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, accept = true, callZone = "rear-left" } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-rode-call-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, callZone } } }, seats, Engine);
}

test("seven exact rode-upon call abilities have production definitions at only their printed indexes", () => {
  for (const id of IDS) {
    const row = catalog.find(item => item.id === id);
    assert.ok(row, id);
    const abilities = Engine.parseCardAbilitiesCached(row), ability = abilities.find(item => item.id === `${id}:${INDEX[id]}`);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.equal(ability.id, `${id}:${INDEX[id]}`, id);
    assert.equal(ability.trigger.eventType, "card.ridden", id);
    assert.equal(ability.trigger.subject, "event-target", id);
    assert.deepEqual(ability.trigger.circles, ["vanguard"], id);
    assert.equal(ability.canDecline, true, id);
    assert.deepEqual(ability.effects, [{ op: "call-source-from-soul", target: "source", position: "stand" }], id);
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(id).filter(item => item.source?.patternId === PATTERN);
    assert.equal(trusted.length, 1, id);
    assert.equal(trusted[0].id, ability.id, id);
    assert.equal(trusted[0].printedText, TEXT, id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    if (id === "cfa-9037") {
      assert.ok(abilities.some(item => item.id === "cfa-9037:1" && item.printedText.includes("your opponent’s locked card is unlocked")));
      assert.equal(Engine.getReviewedAbilityDefinitionsForCard(id).some(item => item.id === "cfa-9037:1" && item.source?.patternId === PATTERN), false);
    }
  }
});

test("either player's exact former Vanguard can be called standing into an open RC", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    const found = discover(f);
    assert.equal(found.queued.length, 1, `${id}/${side}: ${JSON.stringify(found)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(discover(f).queued.length, 0, "same ride event must not queue twice");
    const result = resolve(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.state.players[side].soul.some(item => item.uid === f.source.uid), false);
    const called = f.state.players[side].rear[0];
    assert.equal(called.uid, f.source.uid);
    assert.equal(called.rested, false);
    assert.equal(called.circle, "rear-left");
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].rear.some(item => item?.uid === f.source.uid), false);
    assert.deepEqual(result.events.map(event => event.type), ["card.placed"]);
    assert.equal(result.events[0].previousLocation, "soul");
    assert.equal(result.events[0].currentLocation, "rear-left");
  }
});

test("decline, wrong ride source/destination, host proxy, unavailable circle, and tampered definitions are rejected", () => {
  const decline = fixture();
  assert.equal(discover(decline).queued.length, 1);
  const declined = resolve(decline, { accept: false });
  assert.equal(declined.ok, true, declined.reason);
  assert.equal(decline.state.players.human.soul.some(item => item.uid === decline.source.uid), true);

  for (const change of [
    { targetCardInstanceIds: ["different-source"] },
    { targetPreviousLocation: "hand" },
    { targetCurrentLocation: "rear-left" },
    { currentLocation: "rear-left" },
    { sourceControllerPlayerId: "guest-player" }
  ]) {
    const f = fixture();
    const bad = Engine.createGameEvent(f.state, { ...f.event, ...change, eventId: undefined });
    assert.equal(discover(f, bad).queued.length, 0, JSON.stringify(change));
  }

  const proxy = fixture(IDS[0], "bot");
  assert.equal(discover(proxy).queued.length, 1);
  assert.equal(resolve(proxy, { auth: seats.hostAuthUid }).ok, false);
  assert.equal(proxy.state.players.bot.soul.some(item => item.uid === proxy.source.uid), true);

  const occupied = fixture();
  occupied.state.players.human.rear = Array(5).fill(null).map((_, i) => card("cfa-4", `occupied-${i}`, occupied.actor));
  assert.equal(discover(occupied).queued.length, 1);
  const noCircle = resolve(occupied, { callZone: "rear-left" });
  assert.equal(noCircle.ok, false);
  assert.equal(occupied.state.players.human.soul.some(item => item.uid === occupied.source.uid), true);

  const badZone = fixture();
  assert.equal(discover(badZone).queued.length, 1);
  assert.equal(resolve(badZone, { callZone: "guardian" }).ok, false);
  assert.equal(badZone.state.players.human.soul.some(item => item.uid === badZone.source.uid), true);

  const ability = fixture().ability;
  for (const mutate of [
    item => { item.definition.printedText = item.definition.printedText.replace("rode upon", "placed"); },
    item => { item.trigger.subject = "event-subject"; },
    item => { item.definition.effects[0].position = "rest"; },
    item => { item.requiredLocation = ["vanguard"]; },
    item => { item.definition.id = "cfa-9037:0"; }
  ]) {
    const forged = structuredClone(ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
