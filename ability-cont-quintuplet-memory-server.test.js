"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const PLAYER_IDS = { human: "host-player", bot: "guest-player" };
const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const MEMORY_IDS = ["cfa-11526", "cfa-11545", "cfa-11558"];
const MEMORY_CONT_PATTERN = "cont-memory-distinct-race-power-or-shield-v1";

function makeCard(cardId, uid, ownerPlayerId, controllerPlayerId = ownerPlayerId, extra = {}) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog card ${cardId} exists`);
  return Engine.createCardInstance(String(cardId), ownerPlayerId, uid, {
    cardName: definition.name,
    type: definition.type,
    grade: definition.grade,
    power: definition.power,
    shield: definition.shield,
    unitCard: definition.type === "Unit",
    critical: 1,
    controllerPlayerId,
    ...extra
  });
}

function emptyPlayer(side) {
  const playerId = PLAYER_IDS[side];
  return {
    playerId,
    vanguard: null,
    rear: Array(5).fill(null),
    hand: [],
    deck: [],
    damage: [],
    drop: [],
    soul: [],
    bind: [],
    orders: [],
    crests: [],
    guardCircle: [],
    triggerZone: [],
    gZone: [],
    gDeck: [],
    removed: [],
    giftZones: []
  };
}

function memorySet(controllerSide, mode = "three-distinct") {
  const owner = PLAYER_IDS[controllerSide];
  const opponent = PLAYER_IDS[controllerSide === "human" ? "bot" : "human"];
  const ids = mode === "two-distinct" ? MEMORY_IDS.slice(0, 2)
    : mode === "same-name-copies" ? [MEMORY_IDS[0], MEMORY_IDS[0], MEMORY_IDS[0]]
      : MEMORY_IDS;
  const cards = ids.map((cardId, index) => makeCard(cardId, `memory-${controllerSide}-${mode}-${index}`, index === 2 && mode === "three-distinct" ? opponent : owner, owner, { zone: "order" }));
  if (mode === "wrong-race") {
    cards[2] = makeCard("cfa-3", `memory-${controllerSide}-wrong-race`, owner, owner, {
      zone: "order", race: "Quintuplet", races: ["Quintuplet"], cardName: "Fabricated Quintuplet Alias"
    });
  }
  if (mode === "missing-uid") delete cards[2].uid;
  if (mode === "duplicate-uid") cards[2].uid = cards[1].uid;
  if (mode === "wrong-controller") cards[2].controllerPlayerId = opponent;
  if (mode === "face-down") cards[2].faceDown = true;
  return cards;
}

function makeMatch({ activeSide, memorySide, memoryMode = "three-distinct", memoryOwnerSide = memorySide } = {}) {
  const players = { human: emptyPlayer("human"), bot: emptyPlayer("bot") };
  for (const side of ["human", "bot"]) {
    players[side].vanguard = makeCard("cfa-14047", `${side}-vanguard`, PLAYER_IDS[side], PLAYER_IDS[side], {
      zone: "vanguard", circle: "vanguard", power: 13000, grade: 3
    });
  }
  if (memoryMode === "opponent-only") {
    const memoryController = memorySide === "human" ? "bot" : "human";
    players[memoryController].orders = memorySet(memoryController, "three-distinct");
  } else if (memoryMode === "three-distinct" && memoryOwnerSide !== memorySide) {
    players[memoryOwnerSide].orders = memorySet(memoryOwnerSide, "three-distinct");
  } else {
    players[memorySide].orders = memorySet(memorySide, memoryMode);
  }
  return {
    matchId: `quint-memory-${activeSide}-${memorySide}-${memoryMode}`,
    stateVersion: 1,
    turn: 3,
    phase: 5,
    side: activeSide,
    processedActionIds: [],
    processedEventIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    players
  };
}

function authFor(side) {
  return side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid;
}

function runAttack(state, side, attacker, target, actionId) {
  return Reducer.applyGameAction(state, {
    actorAuthUid: authFor(side),
    actionId,
    expectedStateVersion: state.stateVersion,
    payload: { action: "attack", attackerCardInstanceId: attacker.uid, targetCardInstanceId: target.uid }
  }, SEATS, Engine);
}

function runGuard(state, defenderSide, guardCard, actionId) {
  return Reducer.applyGameAction(state, {
    actorAuthUid: authFor(defenderSide),
    actionId,
    expectedStateVersion: state.stateVersion,
    payload: { action: "guard", cardInstanceId: guardCard.uid }
  }, SEATS, Engine);
}

function assertReviewed(cardId, expectedZone, expectedAmount) {
  const card = CATALOG.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(candidate => candidate.id === `${cardId}:1`);
  assert.ok(ability?.definition, `${cardId}:1 has a reviewed CONT definition`);
  assert.equal(ability.definition.source?.patternId, MEMORY_CONT_PATTERN);
  assert.deepEqual(ability.requiredLocation, [expectedZone]);
  assert.equal(ability.definition.effects[0].amount, expectedAmount);
  return ability;
}

function shieldFixture(defenderSide, memoryMode = "three-distinct") {
  const attackerSide = defenderSide === "human" ? "bot" : "human";
  const state = makeMatch({ activeSide: attackerSide, memorySide: defenderSide, memoryMode });
  const guard = makeCard("cfa-11522", `guardian-${defenderSide}-${memoryMode}`, PLAYER_IDS[defenderSide], PLAYER_IDS[defenderSide], { zone: "hand" });
  state.players[defenderSide].hand.push(guard);
  const attacker = state.players[attackerSide].vanguard;
  const target = state.players[defenderSide].vanguard;
  state.pendingAttack = {
    battleId: `quint-shield-battle-${defenderSide}-${memoryMode}`,
    attackerSide,
    attackerPlayerId: PLAYER_IDS[attackerSide],
    attackerUid: attacker.uid,
    attackerZone: "vanguard",
    defenderSide,
    defenderPlayerId: PLAYER_IDS[defenderSide],
    targetUid: target.uid,
    targetZone: "vanguard",
    power: 23000,
    targetPower: 13000,
    critical: 1,
    guardCards: [],
    defenderDone: false
  };
  return { state, guard, defenderSide };
}

function rearPowerFixture(controllerSide, memoryMode = "three-distinct", opponentTurn = false) {
  const activeSide = opponentTurn ? (controllerSide === "human" ? "bot" : "human") : controllerSide;
  const state = makeMatch({ activeSide, memorySide: controllerSide, memoryMode });
  const source = makeCard("cfa-11526", `rearguard-${controllerSide}-${memoryMode}-${opponentTurn}`, PLAYER_IDS[controllerSide], PLAYER_IDS[controllerSide], {
    zone: "rear-guard", circle: "rear-left", power: 8000, grade: 1
  });
  state.players[controllerSide].rear[0] = source;
  const attackerSide = opponentTurn ? activeSide : controllerSide;
  const targetSide = opponentTurn ? controllerSide : (controllerSide === "human" ? "bot" : "human");
  const attacker = opponentTurn ? state.players[attackerSide].vanguard : source;
  const target = opponentTurn ? source : state.players[targetSide].vanguard;
  return { state, source, attacker, target, attackerSide, controllerSide };
}

test("real catalog Quintuplet CONT definitions distinguish GC shield from RC power", () => {
  assertReviewed("cfa-11522", "guardian", 5000);
  assertReviewed("cfa-11526", "rear-guard", 2000);
});

test("host and joining player each receive the Quintuplet memory GC shield on their own guard", () => {
  for (const defenderSide of ["human", "bot"]) {
    const { state, guard } = shieldFixture(defenderSide);
    assert.equal(state.players[defenderSide].orders.length, 3);
    const result = runGuard(state, defenderSide, guard, `quint-guard-positive-${defenderSide}`);
    assert.equal(result.ok, true, `${defenderSide}: ${result.reason}`);
    assert.equal(state.pendingAttack.targetPower, 23000, `${defenderSide}: base 5000 shield + Quintuplet 5000 shield`);
    assert.equal(state.players[defenderSide].guardCircle[0].uid, guard.uid);
  }
});

test("host and joining player each gain Quintuplet memory RC power through an authoritative attack", () => {
  for (const controllerSide of ["human", "bot"]) {
    const f = rearPowerFixture(controllerSide);
    const basePower = Number(f.source.power || 0);
    const result = runAttack(f.state, f.attackerSide, f.attacker, f.target, `quint-rc-positive-${controllerSide}`);
    assert.equal(result.ok, true, `${controllerSide}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, basePower + 2000, `${controllerSide}: CONT power adds to the battle total`);
  }
});

test("RC memory power is included while the controller is defending on the opponent's turn", () => {
  for (const controllerSide of ["human", "bot"]) {
    const f = rearPowerFixture(controllerSide, "three-distinct", true);
    assert.notEqual(f.state.side, controllerSide, "the active player is the source controller's opponent");
    const result = runAttack(f.state, f.attackerSide, f.attacker, f.target, `quint-rc-opponent-turn-${controllerSide}`);
    assert.equal(result.ok, true, `${controllerSide}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.targetPower, Number(f.source.power || 0) + 2000,
      `${controllerSide}: the rear-guard's defense power includes the opponent-turn CONT`);
  }
});

test("GC shield and RC power reject insufficient, repeated, wrong-race, opponent, and malformed Memory identities", () => {
  const negativeModes = ["absent", "two-distinct", "same-name-copies", "wrong-race", "opponent-only", "missing-uid", "duplicate-uid", "wrong-controller", "face-down"];
  for (const mode of negativeModes) {
    for (const controllerSide of ["human", "bot"]) {
      const shieldMode = mode === "absent" ? "two-distinct" : mode;
      const shield = shieldFixture(controllerSide, shieldMode);
      if (mode === "absent") shield.state.players[controllerSide].orders = [];
      const shieldResult = runGuard(shield.state, controllerSide, shield.guard, `quint-guard-negative-${mode}-${controllerSide}`);
      assert.equal(shieldResult.ok, true, `GC ${mode}/${controllerSide}: ${shieldResult.reason}`);
      assert.equal(shield.state.pendingAttack.targetPower, 18000, `GC must add only the printed 5000 shield for ${mode}/${controllerSide}`);

      const powerMode = mode === "absent" ? "two-distinct" : mode;
      const power = rearPowerFixture(controllerSide, powerMode);
      if (mode === "absent") power.state.players[controllerSide].orders = [];
      const powerResult = runAttack(power.state, controllerSide, power.attacker, power.target, `quint-rc-negative-${mode}-${controllerSide}`);
      assert.equal(powerResult.ok, true, `RC ${mode}/${controllerSide}: ${powerResult.reason}`);
      assert.equal(power.state.pendingAttack.power, Number(power.source.power || 0), `RC must not add power for ${mode}/${controllerSide}`);
    }
  }
});
