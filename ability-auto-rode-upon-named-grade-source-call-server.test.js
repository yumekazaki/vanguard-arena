"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-rode-upon-named-grade-source-call-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const FAMILY = Object.freeze({
  "cfa-11178": { grade: 2, name: "Mythiarq" },
  "cfa-11179": { grade: 3, name: "Mythiarq" },
  "cfa-12502": { grade: 3, name: "Direful Doll" },
  "cfa-12545": { grade: 3, name: "Varga" },
  "cfa-12812": { grade: 3, name: "Daiyusha" },
  "cfa-10068": { rider: "Demonic Stone Dragon, Jewelneel", riderId: "cfa-10069", grade: 2 },
  "cfa-9098": { rider: "Ascendance Assault", riderId: "cfa-9099", grade: 2 },
  "cfa-9559": { rider: "MiMish, Rikashenna", riderId: "cfa-9560", grade: 2 },
  "cfa-9863": { rider: "Tyrant of the Oceans, Poseidon", riderId: "cfa-9864", grade: 3 },
});
const CATALOG = loadCatalog();

function sourceAbility(cardId) {
  const card = CATALOG.find(item => String(item.id) === cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 parses as the printed first AUTO`);
  return { card, ability };
}

function fixture({ cardId = "cfa-11178", side = "bot", riderGrade, riderName, unrelatedRide = false, fillRear = false } = {}) {
  const { card, ability } = sourceAbility(cardId);
  const requirement = FAMILY[cardId];
  const playerId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const source = {
    uid: `source-${cardId}-${side}`, cardId, cardName: card.name, type: card.type,
    grade: Number(card.grade), ownerPlayerId: playerId, controllerPlayerId: playerId,
  };
  const rider = {
    uid: `rider-${side}`, cardId: requirement.riderId || "test-rider", cardName: riderName ?? (requirement.rider || `Test ${requirement.name} Vanguard`),
    type: "Unit", unitCard: true, grade: riderGrade ?? requirement.grade ?? 3,
    ownerPlayerId: playerId, controllerPlayerId: playerId,
  };
  const rear = Array(5).fill(null);
  if (fillRear) for (let index = 0; index < rear.length; index++) rear[index] = {
    uid: `occupied-${side}-${index}`, cardId: "test-unit", cardName: "Occupied Rear-Guard", type: "Unit", grade: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId,
  };
  const makePlayer = (id, vanguard, ownRear, soul) => ({
    playerId: id, vanguard, rear: ownRear, soul, drop: [], hand: [], damage: [], deck: [], bind: [],
    guardCircle: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [],
  });
  const players = {
    [side]: makePlayer(playerId, rider, rear, [source]),
    [otherSide]: makePlayer(side === "human" ? "player-guest" : "player-host", null, Array(5).fill(null), []),
  };
  const state = {
    matchId: "named-grade-ride-call", stateVersion: 3, eventSequence: 0,
    processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 2,
    players, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingTurnEnd: null,
  };
  const event = Engine.createGameEvent(state, {
    eventId: `ride-${side}-${cardId}`, type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceCardName: rider.cardName, sourceCardGrade: rider.grade, sourceOwnerPlayerId: rider.ownerPlayerId,
    sourceControllerPlayerId: rider.controllerPlayerId, cardInstanceId: rider.uid,
    subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: rider.ownerPlayerId,
    subjectControllerPlayerId: rider.controllerPlayerId, previousLocation: "hand", currentLocation: "vanguard",
    targetCardInstanceIds: [unrelatedRide ? "another-old-vanguard" : source.uid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow: "normal-ride",
  });
  return { card, ability, requirement, state, side, playerId, player: players[side], source, rider, event };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }

function resolve(f, actionId = `resolve-${f.side}`) {
  const pending = f.state.pendingAbility;
  assert.ok(pending, "the server should own a pending AUTO resolution");
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, callZone: "rear-left" } },
  }, SEATS, Engine);
}

test("nine real catalog AUTO records compile with exact rider identity conditions", () => {
  const matches = [];
  for (const [cardId, requirement] of Object.entries(FAMILY)) {
    const { card, ability } = sourceAbility(cardId);
    if (requirement.rider) assert.ok(ability.printedText.includes(`rode upon by \"${requirement.rider}\", call this card to RC.`));
    else assert.match(ability.printedText, new RegExp(`When this unit is rode upon by a grade ${requirement.grade} card with [\"“]${requirement.name}[\"”] in its card name, call this card to RC\\.?$`, "i"));
    assert.equal(ability.definition?.source?.patternId, PATTERN, `${cardId}:0 should use the reviewed compiler`);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.definition?.trigger?.eventType, "card.ridden");
    assert.equal(ability.definition?.trigger?.subject, "ridden-unit");
    assert.deepEqual(ability.definition?.effects, [{ op: "call-source-from-soul", target: "source", position: "stand" }]);
    assert.equal(card.id, cardId);
    matches.push(ability.id);
  }
  assert.deepEqual(matches.sort(), Object.keys(FAMILY).map(id => `${id}:0`).sort());
});

test("host and joining player resolve only their exact ridden source to their own Rear-Guard", () => {
  for (const [cardId, requirement] of Object.entries(FAMILY)) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side });
    const queued = discover(f);
    assert.equal(queued.queued.length, 1, `${cardId} ${side}: ${JSON.stringify(queued)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    assert.equal(f.state.pendingAbility.ability.canDecline, false, "printed call is mandatory");
    const result = resolve(f, `resolve-${cardId}-${side}`);
    assert.equal(result.ok, true, `${cardId} ${side}: ${result.reason}`);
    assert.equal(f.player.rear[0]?.uid, f.source.uid);
    assert.equal(f.player.rear[0]?.rested, false);
    assert.ok(!f.player.soul.some(item => item.uid === f.source.uid));
    assert.ok(f.state.players[side === "human" ? "bot" : "human"].rear.every(item => item === null));
    assert.equal(f.rider.grade, requirement.grade);
  }
});

test("wrong rider identity or ridden source cannot trigger this exact AUTO", () => {
  for (const [cardId, requirement] of Object.entries(FAMILY)) {
    for (const changes of [
      ...(requirement.rider ? [{ riderName: "Unrelated Vanguard" }] : [{ riderGrade: requirement.grade + 1 }, { riderName: "Unrelated Vanguard" }]),
      { unrelatedRide: true },
    ]) {
      const f = fixture({ cardId, ...changes });
      assert.equal(discover(f).queued.length, 0, `${cardId} ${JSON.stringify(changes)}`);
      assert.equal(f.state.pendingAbility, null);
      assert.deepEqual(f.player.soul.map(item => item.uid), [f.source.uid]);
      assert.ok(f.player.rear.every(item => item === null));
    }
  }
});

test("mandatory ride-call with no legal Rear-Guard circle rejects atomically", () => {
  const f = fixture({ cardId: "cfa-11179", side: "bot", fillRear: true });
  assert.equal(discover(f).queued.length, 1);
  const before = JSON.stringify({ soul: f.player.soul, rear: f.player.rear });
  const result = Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: SEATS.guestAuthUid, actionId: "no-legal-circle", expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, callZone: "rear-left" } },
  }, SEATS, Engine);
  assert.equal(result.ok, false);
  assert.match(result.reason, /circle|zone|source|target/i);
  assert.equal(JSON.stringify({ soul: f.player.soul, rear: f.player.rear }), before);
});
