"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-1194", "cfa-1195", "cfa-3690", "cfa-3691", "cfa-3692", "cfa-449", "cfa-599"];
const TEXT = "AUTO: When this unit is put into the drop zone from GC, put this card into your soul.";
const PATTERN = "auto-gc-drop-self-to-soul-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function card(uid, cardId, playerId) {
  const row = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId, cardName: row?.name || "Test Guardian", type: row?.type || "Unit", grade: Number(row?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(cardId = IDS[0], side = "human") {
  const row = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled exact ability ${cardId}:0`);
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const n = ++sequence, source = card(`guardian-${n}`, cardId, ownerId), drawnOther = card(`other-${n}`, "cfa-3", ownerId);
  const player = id => ({ playerId: id, vanguard: card(`vg-${id}-${n}`, "cfa-3", id), rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].drop.push(source);
  const state = { matchId: "gc-drop-self-to-soul", stateVersion: 1, eventSequence: 0, turn: 3, phase: 5, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, { type: "card.moved", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "guardian", currentLocation: "drop", circle: "guardian", phase: "battle", timingWindow: "battle-end" });
  return { state, ability, event, source, drawnOther, side, ownerId, opponentId };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, { auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, accept = true } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: auth, actionId: `resolve-gc-soul-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("seven exact GC-to-drop abilities preserve their source movement and self-to-Soul effect", () => {
  for (const id of IDS) {
    const row = catalog.find(item => item.id === id);
    assert.ok(row, id);
    const abilities = Engine.parseCardAbilitiesCached(row);
    const ability = abilities.find(item => item.id === `${id}:0`);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.equal(ability.kind, "AUTO", id);
    assert.equal(ability.trigger.eventType, "card.moved", id);
    assert.equal(ability.trigger.subject, "source", id);
    assert.equal(ability.trigger.sourceLocation, "guardian", id);
    assert.equal(ability.trigger.destinationLocation, "drop", id);
    assert.deepEqual(ability.costs, [], id);
    assert.deepEqual(ability.effects, [{ op: "move-source-to-soul", target: "source", from: "drop" }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    assert.equal(abilities.filter(item => item.id !== ability.id).length, Math.max(0, abilities.length - 1), id);
  }
});

test("the source instance moves from Drop to its controller's Soul for host and joining player", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    const found = discover(f);
    assert.equal(found.queued.length, 1, `${id}/${side}: ${JSON.stringify(found)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(discover(f).queued.length, 0, "replayed event is not queued twice");
    const result = resolve(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.state.players[side].drop.some(card => card.uid === f.source.uid), false);
    assert.equal(f.state.players[side].soul.filter(card => card.uid === f.source.uid).length, 1);
    const other = side === "human" ? "bot" : "human";
    assert.equal(f.state.players[other].soul.some(card => card.uid === f.source.uid), false);
    assert.deepEqual(result.events.map(event => event.type), ["card.moved"]);
    assert.equal(result.events[0].previousLocation, "drop");
    assert.equal(result.events[0].currentLocation, "soul");
  }
});

test("wrong movement, wrong card identity, stale zone, host proxy, decline, and tampered definitions fail closed", () => {
  for (const change of [
    { previousLocation: "hand" },
    { currentLocation: "soul" },
    { sourceCardInstanceId: "different" },
    { sourceControllerPlayerId: "guest-player" },
    { subjectOwnerPlayerId: "guest-player" }
  ]) {
    const f = fixture();
    const bad = Engine.createGameEvent(f.state, { ...f.event, ...change, eventId: undefined });
    assert.equal(discover(f, bad).queued.length, 0, JSON.stringify(change));
  }

  const stale = fixture();
  stale.state.players[stale.side].drop = [];
  stale.state.players[stale.side].hand.push(stale.source);
  assert.equal(discover(stale).queued.length, 0);

  const proxy = fixture(IDS[0], "bot");
  assert.equal(discover(proxy).queued.length, 1);
  assert.equal(resolve(proxy, { auth: seats.hostAuthUid }).ok, false);
  assert.equal(proxy.state.players.bot.drop.some(card => card.uid === proxy.source.uid), true);
  assert.equal(proxy.state.players.bot.soul.some(card => card.uid === proxy.source.uid), false);

  const declined = fixture();
  assert.equal(discover(declined).queued.length, 1);
  assert.equal(resolve(declined, { accept: false }).ok, false, "mandatory AUTO cannot be declined");

  const f = fixture();
  for (const mutate of [
    ability => { ability.definition.printedText = ability.definition.printedText.replace("from GC", "from hand"); },
    ability => { ability.trigger.sourceLocation = "hand"; },
    ability => { ability.requiredLocation = ["rear-guard"]; },
    ability => { ability.definition.effects[0].from = "hand"; },
    ability => { ability.definition.effects[0].target = "controller"; },
    ability => { ability.definition.id = "cfa-1195:0"; }
  ]) {
    const forged = structuredClone(f.ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
