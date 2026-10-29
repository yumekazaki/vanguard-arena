"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-ridden-source-top-seven-two-name-search-v1";
const FAMILY = Object.freeze({
  "cfa-1267": { rider: "Fresh Star, Coral", names: ["Shiny Star, Coral", "Aurora Star, Coral"] },
  "cfa-1787": { rider: "Sanctuary of Light, Little Storm", names: ["Sanctuary of Light, Determinator", "Sanctuary of Light, Planetal Dragon"] },
  "cfa-561": { rider: "Mermaid Idol, Riviere", names: ["Top Idol, Riviere", "Super Idol, Riviere"] },
  "cfa-704": { rider: "Heavenly Injector", names: ["Cosmo Healer, Ergodiel", "Fate Healer, Ergodiel"] },
  "cfa-901": { rider: "Stealth Dragon, Magatsu Breath", names: ["Covert Demonic Dragon, Magatsu Storm", "Stealth Dragon, Magatsu Gale"] }
});
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const CATALOG = loadCatalog();

function abilityFor(cardId) {
  const card = CATALOG.find(value => String(value.id) === cardId);
  assert.ok(card, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(value => value.id === `${cardId}:0`);
  assert.ok(ability, `first ability for ${cardId}`);
  return { card, ability };
}

function fixture({ cardId = "cfa-1267", side = "bot", riderName = null, wrongSource = false } = {}) {
  const { card, ability } = abilityFor(cardId), entry = FAMILY[cardId];
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${cardId}-${side}`, cardId, cardName: card.name, type: card.type, grade: Number(card.grade), ownerPlayerId: playerId, controllerPlayerId: playerId };
  const rider = { uid: `rider-${side}`, cardId: `rider-card-${cardId}`, cardName: riderName || entry.rider, type: "Unit", unitCard: true, grade: 2, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const targets = entry.names.map((name, index) => ({ uid: `target-${index}-${side}`, cardId: `target-card-${index}-${cardId}`, cardName: name, type: "Unit", unitCard: true, grade: 2, ownerPlayerId: playerId, controllerPlayerId: playerId }));
  const wrong = { uid: `wrong-${side}`, cardId: `wrong-card-${cardId}`, cardName: "Unrelated Card", type: "Unit", unitCard: true, grade: 2, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const outside = { uid: `outside-${side}`, cardId: `outside-card-${cardId}`, cardName: entry.names[0], type: "Unit", unitCard: true, grade: 2, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const make = (id, vg, soul, deck) => ({ playerId: id, vanguard: vg, rear: Array(5).fill(null), soul, deck, hand: [], drop: [], damage: [], bind: [], guardCircle: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  // Put one target inside the top seven and the other at position eight.
  const own = make(playerId, rider, [source], [outside, wrong, wrong, wrong, wrong, wrong, targets[1], targets[0]]);
  const other = make(opponentId, null, [], []);
  const state = { matchId: `ridden-top-seven-${cardId}-${side}`, stateVersion: 4, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 2, players: { [side]: own, [opponentSide]: other }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingTurnEnd: null };
  const event = Engine.createGameEvent(state, {
    eventId: `ride-${cardId}-${side}`, type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceCardName: rider.cardName, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [wrongSource ? "different-previous-vanguard" : source.uid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard", phase: "ride", timingWindow: "normal-ride"
  });
  return { state, event, ability, card, entry, side, playerId, opponentSide, source, rider, targets, wrong, outside, own, other };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, actor = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, effectUid = f.targets[0].uid) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId: `resolve-${f.side}-${f.card.id}-${effectUid || "none"}`, expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, effectUid } } }, SEATS, Engine);
}

test("five catalog abilities compile as exact named-rider top-seven searches", () => {
  for (const [cardId, entry] of Object.entries(FAMILY)) {
    const { ability } = abilityFor(cardId);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.trigger.eventType, "card.ridden");
    assert.equal(ability.trigger.subject, "ridden-unit");
    assert.deepEqual(ability.trigger.circles, ["vanguard"]);
    assert.equal(ability.trigger.riderCardNameEquals, entry.rider);
    assert.deepEqual(ability.effects, [{ op: "search-top-up-to-one-filtered-to-hand", target: "controller", lookCount: 7, maximum: 1, filter: { cardNamesAny: entry.names } }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("host and joining player resolve only the eligible target among the top seven", () => {
  for (const cardId of Object.keys(FAMILY)) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side }), queued = discover(f);
    assert.equal(queued.queued.length, 1, `${cardId}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f, undefined, f.targets[1].uid);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.ok(f.own.hand.some(card => card.uid === f.targets[1].uid));
    assert.ok(f.own.deck.some(card => card.uid === f.targets[0].uid));
    assert.ok(f.own.deck.some(card => card.uid === f.outside.uid), "the matching card below the top seven stays in deck");
    assert.equal(f.other.deck.length, 0);
  }
});

test("wrong rider, wrong prior Vanguard, and out-of-top-seven targets are rejected", () => {
  for (const changes of [{ riderName: "Different Unit" }, { wrongSource: true }]) {
    const f = fixture(changes);
    assert.equal(discover(f).queued.length, 0);
    assert.equal(f.state.pendingAbility, null);
  }
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  const before = JSON.stringify({ own: f.own, other: f.other });
  assert.equal(resolve(f, undefined, f.outside.uid).ok, false);
  assert.equal(JSON.stringify({ own: f.own, other: f.other }), before);
  assert.equal(discover(f).queued.length, 0, "the source event cannot be queued twice");
});

test("up-to-one permits choosing no card while preserving the Deck", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  const result = resolve(f, undefined, null);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.own.hand.length, 0);
  assert.equal(f.own.deck.length, 8);
  assert.ok(f.own.soul.some(card => card.uid === f.source.uid));
});
