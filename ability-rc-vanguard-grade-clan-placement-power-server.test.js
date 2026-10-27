"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = [
  ["cfa-866", "Narukami"], ["cfa-1091", "Narukami"], ["cfa-1122", "Gold Paladin"],
  ["cfa-1158", "Royal Paladin"], ["cfa-1184", "Spike Brothers"], ["cfa-1217", "Genesis"], ["cfa-1702", "Gold Paladin"]
];
const catalog = loadCatalog(), seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const definitionFor = id => catalog.find(card => String(card.id) === id);
function unit(uid, cardId, playerId, name, clan, grade, extra = {}) {
  return { uid, cardId, cardName: name, name, type: "Unit", unitCard: true, grade, clan, clans: [clan], ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture(cardId, clan, ownerSide = "bot", grade = 3, vanguardClan = clan) {
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest", otherSide = ownerSide === "human" ? "bot" : "human", otherId = ownerSide === "human" ? "player-guest" : "player-host";
  const card = definitionFor(cardId), ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === cardId + ":0");
  assert.ok(ability?.definition, cardId + ":0 compiles"); Engine.registerAbilityDefinitions([ability.definition]);
  const source = unit("source-" + ownerSide, cardId, ownerId, card.name, clan, 3, { zone: "rear-guard", circle: "rear-left", rested: false, turnPowerBoost: 0 });
  const vanguard = unit("vg-" + ownerSide, "vg-" + cardId, ownerId, "Placed Vanguard", vanguardClan, grade, { zone: "vanguard", circle: "vanguard" });
  const otherVanguard = unit("vg-" + otherSide, "opponent-vg", otherId, "Opponent Vanguard", "Kagero", 3, { zone: "vanguard", circle: "vanguard" });
  const players = {
    human: { playerId: "player-host", vanguard: ownerSide === "human" ? vanguard : otherVanguard, rear: ownerSide === "human" ? [source] : [], hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], removed: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: ownerSide === "bot" ? vanguard : otherVanguard, rear: ownerSide === "bot" ? [source] : [], hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], removed: [], triggerZone: [] }
  };
  const state = { matchId: "rc-vanguard-grade-clan-placement", stateVersion: 2, turn: 4, side: otherSide, phase: 2, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: vanguard.uid,
    sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: vanguard.uid, subjectCardInstanceId: vanguard.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, previousLocation: "hand", currentLocation: "vanguard",
    circle: "vanguard", phase: "ride", timingWindow: "normal-ride" });
  return { state, source, vanguard, ability, event, ownerSide, clan, cardId };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, authUid = f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: "resolve-" + f.cardId + "-" + f.ownerSide, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("seven exact RC AUTO abilities preserve their printed grade, clan, source, circle, and turn power", () => {
  for (const [cardId, clan] of FAMILY) {
    const f = fixture(cardId, clan), ability = f.ability;
    assert.equal(ability.definition.source.patternId, "auto-rc-own-vanguard-grade-clan-placement-power-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "card.placed", subject: "vanguard", circles: ["vanguard"] });
    assert.deepEqual(ability.conditions, [{ type: "event-subject-grade-equals", count: 3 }, { type: "event-subject-has-clan", value: clan }]);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 10000, duration: "turn" }]);
    assert.equal(ability.canDecline, false);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    assert.equal(f.event.subjectCardGrade, 3);
    assert.deepEqual(f.event.subjectCardClans, [clan]);
  }
});

test("the exact Rear-Guard source gains power when its controller's qualifying Vanguard is placed, on both seats", () => {
  for (const [cardId, clan] of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, clan, side);
    assert.equal(discover(f).queued.length, 1, cardId + "/" + side);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f);
    assert.equal(result.ok, true, cardId + ": " + result.reason);
    assert.equal(f.source.turnPowerBoost, 10000);
    assert.equal(f.source.turnPowerExpiry, side);
    assert.equal(f.vanguard.turnPowerBoost || 0, 0);
  }
});

test("wrong grade, clan, circle, source controller, or host proxy cannot trigger or resolve the AUTO", () => {
  const grade = fixture("cfa-866", "Narukami", "bot", 2);
  assert.equal(discover(grade).queued.length, 0);
  const clan = fixture("cfa-866", "Narukami", "bot", 3, "Kagero");
  assert.equal(discover(clan).queued.length, 0);
  const circle = fixture("cfa-866", "Narukami");
  assert.equal(discover(circle, { ...circle.event, currentLocation: "rear-left", circle: "rear-guard" }).queued.length, 0);
  const opponent = fixture("cfa-866", "Narukami");
  assert.equal(discover(opponent, { ...opponent.event, actingPlayerId: "player-host", turnPlayerId: "player-host", subjectControllerPlayerId: "player-host" }).queued.length, 0);
  const proxy = fixture("cfa-866", "Narukami", "bot");
  assert.equal(discover(proxy).queued.length, 1);
  const before = JSON.stringify(proxy.state);
  assert.equal(resolve(proxy, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(proxy.state), before);
});

test("an authoritative ride emits one matching Vanguard placement AUTO for the source controller", () => {
  for (const [cardId, clan] of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, clan, side, 2);
    const rider = unit("rider-" + side, "rider-" + cardId, f.state.players[side].playerId,
      "Grade 3 " + clan + " rider", clan, 3, { zone: "hand" });
    f.state.players[side].hand.push(rider);
    f.state.side = side;
    f.state.phase = 2;
    f.state.ridePerformed = false;
    const authUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const result = Reducer.applyGameAction(f.state, {
      actorAuthUid: authUid, actionId: "ride-" + cardId + "-" + side,
      expectedStateVersion: f.state.stateVersion,
      payload: { action: "ride", cardInstanceId: rider.uid }
    }, seats, Engine);
    assert.equal(result.ok, true, cardId + "/" + side + ": " + result.reason);
    assert.equal(result.events.filter(event => event.type === "card.placed" && event.circle === "vanguard").length, 1,
      cardId + "/" + side + " has one Vanguard placement event");
    assert.equal(result.state.pendingAbility?.side, side, cardId + "/" + side + " owns the prompt");
    assert.equal(result.state.pendingAbility?.instance?.uid, f.source.uid, cardId + "/" + side + " exact source owns prompt");
    assert.equal(result.state.pendingAbilities?.length || 0, 0, cardId + "/" + side + " no duplicate pending trigger");
  }
});

test("ride placement AUTO rejects a rider whose printed clan does not match", () => {
  const f = fixture("cfa-866", "Narukami", "bot", 2);
  const rider = unit("wrong-clan-rider", "wrong-clan-rider", "player-guest", "Wrong clan rider", "Kagero", 3, { zone: "hand" });
  f.state.players.bot.hand.push(rider);
  f.state.side = "bot";
  f.state.phase = 2;
  f.state.ridePerformed = false;
  const result = Reducer.applyGameAction(f.state, {
    actorAuthUid: seats.guestAuthUid, actionId: "wrong-clan-ride",
    expectedStateVersion: f.state.stateVersion,
    payload: { action: "ride", cardInstanceId: rider.uid }
  }, seats, Engine);
  assert.equal(result.ok, true);
  assert.equal(result.state.pendingAbility, null);
  assert.equal(result.state.pendingAbilities?.length || 0, 0);
});
