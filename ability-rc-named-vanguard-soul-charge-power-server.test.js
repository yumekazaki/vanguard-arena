"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = [["cfa-10308", "Lilfa", 2000], ["cfa-10923", "Gramgrace", 5000], ["cfa-12066", "Griphogila", 5000], ["cfa-12091", "Griphogila", 5000]];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const printedCard = id => catalog.find(card => String(card.id) === id);

function card(uid, cardId, playerId, cardName, extra = {}) {
  return { uid, cardId, cardName, type: "Unit", grade: 1, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(cardId, name, amount, ownerSide = "bot", vanguardName = `${name} Vanguard`) {
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest", opponentSide = ownerSide === "human" ? "bot" : "human", opponentId = ownerSide === "human" ? "player-guest" : "player-host";
  const definition = printedCard(cardId), ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:0`);
  assert.ok(ability?.definition, `${cardId}:0 compiles`); Engine.registerAbilityDefinitions([ability.definition]);
  const source = card(`source-${ownerSide}`, cardId, ownerId, definition.name, { zone: "rear-guard", circle: "rear-left", turnPowerBoost: 0 });
  const vanguard = card(`vg-${ownerSide}`, "cfa-3", ownerId, vanguardName, { grade: 3, zone: "vanguard", circle: "vanguard" });
  const enemyVanguard = card(`vg-${opponentSide}`, "cfa-3", opponentId, "Opponent Vanguard", { grade: 3, zone: "vanguard", circle: "vanguard" });
  const deck = [card(`top-${ownerSide}`, "cfa-2", ownerId, "Deck top", { zone: "deck" })];
  const players = {
    human: { playerId: "player-host", vanguard: ownerSide === "human" ? vanguard : enemyVanguard, rear: ownerSide === "human" ? [source] : [], hand: [], soul: [], drop: [], deck: ownerSide === "human" ? deck : [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: ownerSide === "bot" ? vanguard : enemyVanguard, rear: ownerSide === "bot" ? [source] : [], hand: [], soul: [], drop: [], deck: ownerSide === "bot" ? deck : [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: "rc-named-vanguard-soul-charge-power", stateVersion: 1, turn: 3, side: opponentSide, phase: 3, eventSequence: 0, processedEventIds: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: opponentId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-guard", timingWindow: "main" });
  return { state, source, ability, event, ownerSide, amount, deck };
}

function discover(f, changes = {}) { return Reducer.discoverAutoTriggers(f.state, [{ ...f.event, ...changes }], Engine); }
function resolve(f, accept = true, authUid = f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `resolve-${f.ownerSide}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
}

test("four exact abilities retain printed Vanguard name, Soul Charge, source power and effect order", () => {
  for (const [cardId, name, amount] of FAMILY) {
    const f = fixture(cardId, name, amount);
    assert.equal(f.ability.definition.source.patternId, "auto-rc-placement-named-vanguard-soul-charge-power-v1");
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-name-contains", value: name }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "soul-charge", count: 1 }, { op: "modify-power", target: "source", amount, duration: "turn" }]);
    assert.equal(f.ability.canDecline, false);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("each exact source resolves Soul Charge then its power for its own controller on both seats", () => {
  for (const [cardId, name, amount] of FAMILY) for (const ownerSide of ["human", "bot"]) {
    const f = fixture(cardId, name, amount, ownerSide), topUid = f.deck[0].uid;
    assert.equal(discover(f).queued.length, 1, cardId);
    assert.equal(f.state.pendingAbility.side, ownerSide);
    const result = resolve(f);
    assert.equal(result.ok, true, `${cardId}: ${result.reason}`);
    const owner = f.state.players[ownerSide], opponent = f.state.players[ownerSide === "human" ? "bot" : "human"];
    assert.equal(owner.soul[0].uid, topUid);
    assert.equal(f.source.turnPowerBoost, amount);
    assert.equal(f.source.turnPowerExpiry, ownerSide);
    assert.deepEqual(result.events.map(item => item.type), ["card.moved", "characteristic.changed"]);
    assert.deepEqual(opponent.soul, []);
  }
});

test("wrong Vanguard, source instance, circle, or player cannot receive this ability", () => {
  const wrongName = fixture("cfa-10308", "Lilfa", 2000, "bot", "Different Vanguard");
  assert.equal(discover(wrongName).queued.length, 0);
  const wrongSource = fixture("cfa-10923", "Gramgrace", 5000);
  assert.equal(discover(wrongSource, { sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other" }).queued.length, 0);
  assert.equal(discover(wrongSource, { currentLocation: "vanguard", circle: "vanguard" }).queued.length, 0);
  const proxy = fixture("cfa-12066", "Griphogila", 5000);
  assert.equal(discover(proxy).queued.length, 1);
  const before = JSON.stringify(proxy.state);
  assert.equal(resolve(proxy, true, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(proxy.state), before);
});

test("a mandatory AUTO ability cannot be declined", () => {
  const f = fixture("cfa-12091", "Griphogila", 5000, "human");
  assert.equal(discover(f).queued.length, 1);
  const before = JSON.stringify(f.state);
  assert.equal(resolve(f, false).ok, false);
  assert.equal(JSON.stringify(f.state), before);
});
