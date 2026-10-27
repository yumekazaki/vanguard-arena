"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = [["cfa-10549", 1, "Luquier", 1], ["cfa-1417", 0, "Amon", 2], ["cfa-1419", 0, "Amon", 2]];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const printedCard = id => catalog.find(card => String(card.id) === id);

function unit(uid, cardId, playerId, cardName, extra = {}) {
  return { uid, cardId, cardName, type: "Unit", grade: 1, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(cardId, abilityIndex, requiredName, chargeCount, ownerSide = "bot", vanguardName = `${requiredName} Vanguard`) {
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest";
  const opponentSide = ownerSide === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const definition = printedCard(cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:${abilityIndex}`);
  assert.ok(ability?.definition, `${cardId}:${abilityIndex} compiles`);
  Engine.registerAbilityDefinitions([ability.definition]);
  const source = unit(`source-${ownerSide}`, cardId, ownerId, definition.name, { zone: "rear-guard", circle: "rear-left" });
  const vanguard = unit(`vg-${ownerSide}`, "cfa-3", ownerId, vanguardName, { grade: 3, zone: "vanguard", circle: "vanguard" });
  const otherVanguard = unit(`vg-${opponentSide}`, "cfa-3", opponentId, "Opponent Vanguard", { grade: 3, zone: "vanguard", circle: "vanguard" });
  const deck = Array.from({ length: chargeCount + 1 }, (_, index) => unit(`deck-${ownerSide}-${index}`, "cfa-2", ownerId, `Deck ${index}`, { zone: "deck" }));
  const players = {
    human: { playerId: "player-host", vanguard: ownerSide === "human" ? vanguard : otherVanguard, rear: ownerSide === "human" ? [source] : [], hand: [], soul: [], drop: [], deck: ownerSide === "human" ? deck : [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: ownerSide === "bot" ? vanguard : otherVanguard, rear: ownerSide === "bot" ? [source] : [], hand: [], soul: [], drop: [], deck: ownerSide === "bot" ? deck : [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: "rc-named-vanguard-soul-charge", stateVersion: 1, turn: 3, side: opponentSide, phase: 3, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: opponentId,
    sourceCardInstanceId: source.uid, sourceCardId: cardId, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-guard", timingWindow: "main" });
  return { state, source, ability, event, ownerSide, deck, requiredName, chargeCount };
}

function discover(f, override = {}) { return Reducer.discoverAutoTriggers(f.state, [{ ...f.event, ...override }], Engine); }
function resolve(f, accept = true, authUid = f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `resolve-${f.ownerSide}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
}

test("the three exact name-gated Rear-Guard Soul Charge abilities preserve their phrase and count", () => {
  for (const [cardId, abilityIndex, name, count] of FAMILY) {
    const f = fixture(cardId, abilityIndex, name, count);
    assert.equal(f.ability.definition.source.patternId, "auto-rc-placement-named-vanguard-soul-charge-v1");
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
    assert.equal(f.ability.trigger.eventType, "card.placed");
    assert.equal(f.ability.trigger.subject, "source");
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-name-contains", value: name }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "soul-charge", count }]);
    assert.equal(f.ability.canDecline, true);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player alone choose whether to Soul Charge from their own exact placement", () => {
  for (const [cardId, abilityIndex, name, count] of FAMILY) for (const ownerSide of ["human", "bot"]) {
    const f = fixture(cardId, abilityIndex, name, count, ownerSide);
    const expectedSoulUids = f.deck.slice(-count).reverse().map(item => item.uid);
    assert.equal(discover(f).queued.length, 1, cardId);
    assert.equal(f.state.pendingAbility.side, ownerSide);
    const result = resolve(f);
    assert.equal(result.ok, true, `${cardId}: ${result.reason}`);
    const own = f.state.players[ownerSide], opponent = f.state.players[ownerSide === "human" ? "bot" : "human"];
    assert.equal(own.soul.length, count);
    assert.deepEqual(own.soul.map(item => item.uid), expectedSoulUids);
    assert.equal(opponent.soul.length, 0);
  }
});

test("the wrong Vanguard phrase, wrong source, wrong circle, and host proxy cannot trigger or resolve", () => {
  const wrongName = fixture("cfa-1417", 0, "Amon", 2, "bot", "Different Vanguard");
  assert.equal(discover(wrongName).queued.length, 0);
  const wrongSource = fixture("cfa-1417", 0, "Amon", 2);
  assert.equal(discover(wrongSource, { sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other" }).queued.length, 0);
  assert.equal(discover(wrongSource, { currentLocation: "vanguard", circle: "vanguard" }).queued.length, 0);
  const proxy = fixture("cfa-1419", 0, "Amon", 2, "bot");
  assert.equal(discover(proxy).queued.length, 1);
  const before = JSON.stringify(proxy.state);
  assert.equal(resolve(proxy, true, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(proxy.state), before);
});

test("declining the optional AUTO leaves deck and Soul unchanged", () => {
  const f = fixture("cfa-10549", 1, "Luquier", 1, "human");
  const beforeDeck = f.state.players.human.deck.map(item => item.uid);
  assert.equal(discover(f).queued.length, 1);
  const result = resolve(f, false);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(f.state.players.human.deck.map(item => item.uid), beforeDeck);
  assert.deepEqual(f.state.players.human.soul, []);
});
