"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-1391", ["Royal Paladin", "cfa-1391:1"]],
  ["cfa-1793", ["Kagero", "cfa-1793:1"]],
  ["cfa-1797", ["Genesis", "cfa-1797:1"]],
  ["cfa-1806", ["Narukami", "cfa-1806:1"]],
  ["cfa-1901", ["Gold Paladin", "cfa-1901:1"]]
]);
const cards = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function setup({ side = "bot", cardId = "cfa-1391", clan, sourceZone = "rear-left", hand = true } = {}) {
  const [requiredClan] = FAMILY.get(cardId), ownId = side === "bot" ? "guest-player" : "host-player", otherSide = side === "bot" ? "human" : "bot", otherId = side === "bot" ? "host-player" : "guest-player";
  const source = { uid: `source-${side}`, cardId, cardName: cards.find(card => card.id === cardId)?.name, type: "Normal Unit", unitCard: true, grade: 1, ownerPlayerId: ownId, controllerPlayerId: ownId, zone: sourceZone, circle: sourceZone, rested: false, locked: false };
  const vanguard = { uid: `vg-${side}`, cardId: "vanguard", cardName: "Test Vanguard", type: "Normal Unit", unitCard: true, grade: 3, clan: clan || requiredClan, ownerPlayerId: ownId, controllerPlayerId: ownId, zone: "vanguard", circle: "vanguard" };
  const discarded = { uid: `discard-${side}`, cardId: "discard-card", cardName: "Discard Card", type: "Normal Unit", unitCard: true, grade: 1, ownerPlayerId: ownId, controllerPlayerId: ownId, zone: "hand" };
  const drawn = { uid: `draw-${side}`, cardId: "draw-card", cardName: "Draw Card", type: "Normal Unit", unitCard: true, grade: 0, ownerPlayerId: ownId, controllerPlayerId: ownId, zone: "deck" };
  const player = { playerId: ownId, vanguard, rear: sourceZone === "rear-left" ? [source, null, null, null, null] : Array(5).fill(null), soul: [], drop: [], hand: hand ? [discarded] : [], deck: [drawn], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  const opponent = { playerId: otherId, vanguard: { uid: `vg-${otherSide}`, cardId: "opp-vanguard", grade: 3, ownerPlayerId: otherId, controllerPlayerId: otherId }, rear: Array(5).fill(null), soul: [], drop: [], hand: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] };
  return { state: { matchId: `act-soul-discard-${side}`, stateVersion: 1, processedActionIds: [], side, turn: 2, phase: 4, players: side === "bot" ? { human: opponent, bot: player } : { human: player, bot: opponent }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null }, source, discarded, drawn };
}

function activate(fixture, { actorAuthUid = fixture.state.side === "bot" ? seats.guestAuthUid : seats.hostAuthUid, selection = {} } = {}) {
  const side = fixture.state.side;
  return Reducer.applyManualAbilityActivation(fixture.state, { actorAuthUid, actionId: `activate-${side}-${fixture.state.stateVersion}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: fixture.source.uid, abilityId: `${fixture.source.cardId}:1`, selection: { costSelections: { cb: [], sb: [], discard: selection.discard || [`discard-${side}`], reveal: [] } } } }, seats, Engine);
}

test("five exact clan-filtered ACT abilities retain RC location, both costs, clan condition, and draw effect", () => {
  const audit = auditCatalog(cards);
  for (const [cardId, [clan, abilityId]] of FAMILY) {
    const card = cards.find(item => item.id === cardId), ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId), definition = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.id === abilityId);
    assert.ok(definition, `${abilityId} is trusted`);
    assert.equal(ability.definition.source.patternId, "act-rc-source-to-soul-discard-draw-clan-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "discard", count: 1 }, { type: "source-to-soul", count: 1 }]);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: clan }]);
    assert.deepEqual(ability.definition.effects, [{ op: "draw", count: 1 }]);
    assert.equal(ability.conditionStatus, "modeled");
    assert.equal(ability.costStatus, "supported-cost");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
  assert.equal(audit.patterns["act-rc-source-to-soul-discard-draw-clan-v1"], FAMILY.size);
  assert.deepEqual(audit.invalidCompiled, []);
});

test("host and joining player each pay their own discard and source-to-Soul costs before drawing", () => {
  for (const side of ["human", "bot"]) {
    const fixture = setup({ side });
    const result = activate(fixture);
    assert.equal(result.ok, true, result.reason);
    const own = fixture.state.players[side], other = fixture.state.players[side === "bot" ? "human" : "bot"];
    assert.equal(own.soul.at(-1).uid, fixture.source.uid);
    assert.equal(own.drop.at(-1).uid, fixture.discarded.uid);
    assert.equal(own.hand.at(-1).uid, fixture.drawn.uid);
    assert.equal(own.deck.length, 0);
    assert.equal(other.soul.length, 0);
    assert.equal(other.drop.length, 0);
  }
});

test("wrong clan, wrong circle, unavailable discard, and forged opponent activation are rejected without partial payment", () => {
  for (const setupArgs of [{ clan: "Kagero" }, { sourceZone: "vanguard" }, { hand: false }]) {
    const fixture = setup(setupArgs), before = JSON.stringify(fixture.state);
    assert.equal(activate(fixture).ok, false);
    assert.equal(JSON.stringify(fixture.state), before);
  }
  const fixture = setup({ side: "bot" }), before = JSON.stringify(fixture.state);
  assert.equal(activate(fixture, { actorAuthUid: seats.hostAuthUid }).ok, false);
  assert.equal(JSON.stringify(fixture.state), before);
});
