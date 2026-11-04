"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const PATTERN = "cont-rc-own-turn-any-player-locked-power-v1";
const FAMILY = new Map([
  ["cfa-10775", { power: 10000, generationBreak: 2, cardNumber: "D-SS04/005EN" }],
  ["cfa-10777", { power: 5000, generationBreak: 0, cardNumber: "D-SS04/006EN" }]
]);
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const PLAYER_IDS = { human: "host-player", bot: "guest-player" };

function makeCard(cardId, uid, ownerPlayerId, extra = {}) {
  const card = CATALOG.get(String(cardId));
  assert.ok(card, `catalog card ${cardId} exists`);
  return Engine.createCardInstance(String(cardId), ownerPlayerId, uid, {
    cardName: card.name, type: card.type, grade: Number(card.grade), power: Number(card.power),
    shield: Number(card.shield), unitCard: card.type === "Unit", critical: 1,
    controllerPlayerId: ownerPlayerId, ...extra
  });
}

function fixture({ cardId = "cfa-10775", side = "human", lockSide = side === "human" ? "bot" : "human", generationBreak = 2, activeSide = side } = {}) {
  const ownerPlayerId = PLAYER_IDS[side], opponentSide = side === "human" ? "bot" : "human";
  const opponentPlayerId = PLAYER_IDS[opponentSide];
  const source = makeCard(cardId, `source-${cardId}-${side}`, ownerPlayerId, { zone: "rear-guard", circle: "rear-left" });
  const makePlayer = (playerId, vanguard) => ({
    playerId, vanguard, rear: Array(5).fill(null), hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gZone: [], gDeck: [], removed: [], giftZones: [], accelZones: 0
  });
  const own = makePlayer(ownerPlayerId, makeCard("cfa-1", `own-vanguard-${side}`, ownerPlayerId, { zone: "vanguard", circle: "vanguard" }));
  const opponent = makePlayer(opponentPlayerId, makeCard("cfa-1", `opponent-vanguard-${side}`, opponentPlayerId, { zone: "vanguard", circle: "vanguard" }));
  own.rear[0] = source;
  for (let index = 0; index < generationBreak; index++) {
    own.gZone.push(makeCard("cfa-10776", `g-unit-${side}-${index}`, ownerPlayerId, { zone: "g-zone", faceUp: true, gDeckCard: true }));
  }
  const lockOwner = lockSide === side ? own : opponent;
  const lockedCard = makeCard("cfa-10776", `locked-card-${side}-${lockSide}`, lockOwner.playerId, { zone: "rear-guard", circle: "rear-right" });
  lockedCard.locked = true;
  lockOwner.rear[1] = lockedCard;
  const state = {
    matchId: `messiah-lock-${cardId}-${side}-${generationBreak}-${activeSide}`,
    stateVersion: 1, turn: 2, side: activeSide, phase: 5, firstTurnComplete: true,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, pendingAttack: null, players: { [side]: own, [opponentSide]: opponent }
  };
  const isSourceTurn = activeSide === side;
  const actor = state.players[activeSide], defender = state.players[activeSide === "human" ? "bot" : "human"];
  const attacker = isSourceTurn ? source : actor.vanguard;
  const target = isSourceTurn ? defender.vanguard : source;
  const command = {
    actorAuthUid: activeSide === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId: `attack-${state.matchId}`, expectedStateVersion: state.stateVersion,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: attacker.uid, targetCardInstanceId: target.uid }
  };
  return { source, own, opponent, state, command, side, opponentSide };
}

function abilityFor(cardId) {
  const ability = Engine.parseCardAbilitiesCached(CATALOG.get(cardId)).find(value => value.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 is present`);
  return ability;
}

function attack(f) {
  return Reducer.applyGameAction(f.state, f.command, SEATS, Engine);
}

test("the two official Messiah CONT abilities compile with exact RC, turn, lock, and GB requirements", () => {
  for (const [cardId, expected] of FAMILY) {
    const ability = abilityFor(cardId);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.source.officialCardNumber, expected.cardNumber);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.definition.conditionsReviewed, true);
    assert.equal(ability.conditionStatus, "modeled");
    assert.equal(Engine.isManuallyActivatable(ability), false);
    assert.deepEqual(ability.definition.effects, [{
      op: "continuous-power", target: "source", amount: expected.power, duration: "continuous", location: "rear-guard",
      condition: { op: "all", conditions: [
        { op: "controller-turn" }, { op: "any-field-card-is-locked" },
        ...(expected.generationBreak ? [{ op: "generation-break", count: expected.generationBreak }] : [])
      ] }
    }]);
  }
});

test("Astrolabe's GB2 power applies on either seat's turn when either player has a locked Rear-Guard", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ cardId: "cfa-10775", side, generationBreak: 2, lockSide: side === "human" ? "bot" : "human" });
    const result = attack(f);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, Number(CATALOG.get("cfa-10775").power) + 10000, side);
  }
});

test("Astrolabe does not gain power without any field lock or before GB2", () => {
  const noLock = fixture({ cardId: "cfa-10775", side: "human", generationBreak: 2 });
  noLock.opponent.rear[1] = null;
  assert.equal(attack(noLock).ok, true);
  assert.equal(noLock.state.pendingAttack.power, Number(CATALOG.get("cfa-10775").power));

  const oneGUnit = fixture({ cardId: "cfa-10775", side: "bot", generationBreak: 1, lockSide: "human" });
  assert.equal(attack(oneGUnit).ok, true);
  assert.equal(oneGUnit.state.pendingAttack.power, Number(CATALOG.get("cfa-10775").power));
});

test("Kaluzar Klein gains +5000 from either player's lock without requiring GB", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ cardId: "cfa-10777", side, generationBreak: 0, lockSide: side === "human" ? "bot" : "human" });
    assert.equal(attack(f).ok, true);
    assert.equal(f.state.pendingAttack.power, Number(CATALOG.get("cfa-10777").power) + 5000, side);
  }
});

test("the CONT power is inactive during the opponent's turn and outside RC", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ cardId: "cfa-10777", side, generationBreak: 0, lockSide: side, activeSide: side === "human" ? "bot" : "human" });
    assert.equal(attack(f).ok, true);
    assert.equal(f.state.pendingAttack.targetPower, Number(CATALOG.get("cfa-10777").power), side);
  }
  const ability = abilityFor("cfa-10777");
  assert.equal(Engine.evaluateContinuousEffects([ability], {
    location: "vanguard", isControllerTurn: true, anyFieldCardIsLocked: true, controllerPlayerId: "owner", sourceInstanceId: "source", targetInstanceId: "source"
  }).power, 0);
});

test("the browser continuous-power context uses live locks and the same Generation Break count", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /anyFieldCardIsLocked:\["human","bot"\]\.some\(fieldSide=>\(match\.players\[fieldSide\]\?\.rear\|\|\[\]\)\.some\(card=>card\?\.locked===true\|\|card\?\.isLocked===true\)\)/);
  assert.match(app, /generationBreakCount:generationBreakCount\(side\),isControllerTurn:match\.side===side/);
});
