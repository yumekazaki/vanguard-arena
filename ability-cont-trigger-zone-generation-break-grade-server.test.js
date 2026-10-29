"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const cardIds = ["cfa-11592", "cfa-11593", "cfa-11594", "cfa-5501", "cfa-5513", "cfa-5567"];
const patternId = "cont-trigger-zone-generation-break-grade-plus-one-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function abilityFor(cardId) {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 should parse`);
  return { card, ability };
}

function fixture(side, generationBreak = 0, cardId = "cfa-11592") {
  const ownPlayerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentPlayerId = side === "human" ? "guest-player" : "host-player";
  const { card } = abilityFor(cardId);
  const attacker = { uid: `attacker-${side}-${++sequence}`, cardId: "test-vanguard", ownerPlayerId: ownPlayerId, controllerPlayerId: ownPlayerId, unitCard: true, grade: 3 };
  const target = { uid: `target-${side}-${sequence}`, cardId: "test-opponent-vanguard", ownerPlayerId: opponentPlayerId, controllerPlayerId: opponentPlayerId, unitCard: true, grade: 3 };
  const checked = { uid: `checked-${side}-${sequence}`, cardId, cardName: card.name, ownerPlayerId: ownPlayerId, controllerPlayerId: ownPlayerId, unitCard: true, grade: Number(card.grade), triggerType: "heal" };
  const players = {
    human: { playerId: "host-player", vanguard: side === "human" ? attacker : target, rear: Array(5).fill(null), triggerZone: [], deck: [], hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], usedAbilities: [] },
    bot: { playerId: "guest-player", vanguard: side === "bot" ? attacker : target, rear: Array(5).fill(null), triggerZone: [], deck: [], hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], usedAbilities: [] }
  };
  if (generationBreak > 0) players[side].gZone.push({ uid: `g-unit-${side}-${sequence}`, cardId: "test-face-up-g-unit", ownerPlayerId: ownPlayerId, controllerPlayerId: ownPlayerId, faceUp: true, gDeckCard: true });
  players[side].deck.push(checked);
  const battleId = `battle-${side}-${sequence}`;
  const state = { matchId: `trigger-zone-grade-${side}-${sequence}`, stateVersion: 1, turn: 3, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: { battleId, attackerSide: side, attackerUid: attacker.uid, attackerZone: "vanguard", attackerPlayerId: ownPlayerId, defenderSide: opponentSide, targetUid: target.uid, targetZone: "vanguard", awaitingDrive: true, driveChecksRemaining: 1, maxDriveChecks: 1 }, pendingCheckCard: null };
  return { state, side, ownPlayerId, checked, cardId };
}

function reveal(f) {
  return Reducer.applyGameAction(f.state, {
    actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `drive-check-${f.side}-${f.checked.uid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "driveCheck" }
  }, seats, Engine);
}

test("the six exact abilities compile as passive Trigger Zone CONT and no other card ID inherits them", () => {
  for (const cardId of cardIds) {
    const { card, ability } = abilityFor(cardId);
    assert.equal(ability.kind, "CONT", cardId);
    assert.equal(ability.definition.source.patternId, patternId, cardId);
    assert.deepEqual(ability.requiredLocation, ["trigger"], cardId);
    assert.deepEqual(ability.definition.effects, [{ op: "continuous-grade", target: "source", amount: 1, duration: "continuous", location: "trigger", condition: { op: "generation-break", count: 1 } }], cardId);
    assert.equal(ability.trigger, null, cardId);
    assert.equal(Engine.isManuallyActivatable(ability), false, cardId);
    const clone = Engine.parseCardAbilities({ ...card, id: `${cardId}-unreviewed` }).find(item => item.kind === "CONT" && item.printedText === ability.printedText);
    assert.equal(clone?.definition, null, `${cardId} wording must not bless a different card ID`);
  }
});

test("Generation Break 1 grade is derived only for the exact source instance in Trigger Zone", () => {
  const { ability } = abilityFor("cfa-11592");
  const exact = { location: "trigger", sourceLocation: "trigger", sourceInstanceId: "checked-uid", targetInstanceId: "checked-uid", generationBreakCount: 1 };
  assert.equal(Engine.evaluateContinuousGrade([ability], { ...exact, generationBreakCount: 0 }), 0);
  assert.equal(Engine.evaluateContinuousGrade([ability], exact), 1);
  assert.equal(Engine.evaluateContinuousGrade([ability], { ...exact, location: "hand", sourceLocation: "hand" }), 0);
  assert.equal(Engine.evaluateContinuousGrade([ability], { ...exact, targetInstanceId: "another-copy" }), 0);
});

test("authoritative drive checks apply the GB boundary for both host and joining player", () => {
  for (const side of ["human", "bot"]) {
    const below = fixture(side, 0);
    const belowResult = reveal(below);
    assert.equal(belowResult.ok, true, belowResult.reason);
    const belowEvent = belowResult.events.find(event => event.type === "drive.checked" && event.checkedCardInstanceId === below.checked.uid);
    assert.equal(belowEvent.checkedCardGrade, 0, `${side} below GB1`);
    assert.equal(below.checked.grade, 0, "printed grade must not be mutated");

    const atBoundary = fixture(side, 1);
    const atBoundaryResult = reveal(atBoundary);
    assert.equal(atBoundaryResult.ok, true, atBoundaryResult.reason);
    const boundaryEvent = atBoundaryResult.events.find(event => event.type === "drive.checked" && event.checkedCardInstanceId === atBoundary.checked.uid);
    assert.equal(boundaryEvent.checkedCardGrade, 1, `${side} exactly at GB1`);
    assert.equal(atBoundary.checked.grade, 0, "derived grade must not persist on the card instance");
  }
});

test("grade reverts immediately when the exact revealed card leaves Trigger Zone", () => {
  const { ability } = abilityFor("cfa-11592");
  const checked = { uid: "temporary-trigger", cardId: "cfa-11592", grade: 0 };
  const player = { playerId: "owner", triggerZone: [checked], hand: [], gZone: [{ uid: "g1", faceUp: true, gDeckCard: true }], vanguard: null };
  const state = { players: { human: player } };
  const context = { location: "trigger", sourceLocation: "trigger", sourceInstanceId: checked.uid, targetInstanceId: checked.uid,
    generationBreakCount: Engine.countGenerationBreakUnits(player, card => card?.gDeckCard === true) };
  assert.equal(Engine.evaluateContinuousGrade([ability], context), 1);
  player.hand.push(player.triggerZone.pop());
  assert.equal(Engine.evaluateContinuousGrade([ability], { ...context, location: "hand", sourceLocation: "hand" }), 0);
  assert.equal(checked.grade, 0);
  assert.equal(state.players.human.hand[0], checked);
});
