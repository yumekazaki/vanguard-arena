"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH = [
  ["cfa-12961", "cfa-12371", "Marlean"],
  ["cfa-12962", "cfa-12250", "Triumph Dragon"],
  ["cfa-12963", "cfa-12350", "Sarevsael"],
  ["cfa-13183", "cfa-12263", "Oselargest"],
  ["cfa-13184", "cfa-12273", "Asturm"],
  ["cfa-13194", "cfa-12361", "Cristianos"]
];
const PATTERN_ID = "auto-ride-phase-drop-source-call-energy-charge-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
let sequence = 0;

function definition(cardId) { return catalog.find(card => String(card.id) === String(cardId)); }
function card(uid, cardId, playerId) {
  const data = definition(cardId);
  assert.ok(data, `catalog card ${cardId} exists`);
  return { uid, cardId: String(cardId), cardName: data.name, name: data.name, type: data.type, grade: data.grade,
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true };
}
function abilityFor(cardId) {
  return Engine.parseCardAbilitiesCached(definition(cardId)).find(ability => ability.id === `${cardId}:0`);
}
function fixture({ cardId = BATCH[0][0], riderCardId = BATCH.find(item => item[0] === cardId)?.[1], side = "human", phase = 2,
  soul = 1, energy = 0, energyGenerator = true, sameNameRear = false, lockedCircles = false } = {}) {
  const id = ++sequence, playerId = side === "human" ? "host-player" : "guest-player", otherSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player", source = card(`drop-source-${id}`, cardId, playerId);
  const rider = card(`rider-${id}`, riderCardId, playerId), previous = card(`previous-vanguard-${id}`, "cfa-31", playerId);
  const makePlayer = owner => ({ playerId: owner, energy: 0, accelZones: 0, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: makePlayer("host-player"), bot: makePlayer("guest-player") };
  players[side].vanguard = rider;
  players[side].drop = [source];
  players[side].soul = Array.from({ length: soul }, (_, index) => index === 0 ? previous : card(`soul-${id}-${index}`, "cfa-2", playerId));
  players[side].energy = energy;
  if (energyGenerator) players[side].crests.push({ uid: `energy-crest-${id}`, cardId: "energy-generator", crestName: "Energy Generator", ownerPlayerId: playerId, controllerPlayerId: playerId });
  if (sameNameRear) players[side].rear[0] = card(`duplicate-rear-${id}`, cardId, playerId);
  if (lockedCircles) players[side].rear.fill({ uid: `locked-${id}`, locked: true, isLocked: true });
  players[otherSide].vanguard = card(`opponent-vanguard-${id}`, "cfa-31", opponentId);
  const state = { matchId: `ride-phase-drop-match-${id}`, stateVersion: 1, eventSequence: 0, turn: 3, phase, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceCardName: rider.cardName, sourceCardGrade: rider.grade,
    sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [previous.uid], targetCardName: previous.cardName,
    targetOwnerPlayerId: playerId, targetControllerPlayerId: playerId, targetPreviousLocation: "vanguard", targetCurrentLocation: "soul",
    targetLocation: "vanguard", phase: "ride", timingWindow: "normal-ride"
  });
  return { state, event, source, rider, previous, side, playerId, otherSide };
}
function discover(game, event = game.event) { return Reducer.discoverAutoTriggers(game.state, [event], Engine); }
function resolve(game, accept, { authUid = game.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, callZone = "rear-left" } = {}) {
  const soulUid = game.state.players[game.side].soul?.[0]?.uid;
  return Reducer.applyAbilityDecision(game.state, { actorAuthUid: authUid, actionId: `ride-drop-${game.source.uid}-${accept}-${callZone}`,
    expectedStateVersion: game.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: game.source.uid, abilityId: `${game.source.cardId}:0`, costSelections: { cb: [], sb: accept && soulUid ? [soulUid] : [], discard: [], reveal: [] }, ...(accept ? { callZone } : {}) } } }, seats, Engine);
}

test("all six exact Ride Phase Drop AUTO definitions compile with their distinct Vanguard name gates", () => {
  for (const [cardId, , phrase] of BATCH) {
    const ability = abilityFor(cardId);
    assert.ok(ability, `${cardId} compiles`);
    assert.equal(ability.definition.source.patternId, PATTERN_ID, cardId);
    assert.ok(ability.conditions.some(condition => condition.type === "controller-vanguard-name-contains" && condition.value === phrase), cardId);
    assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 1 }], cardId);
    assert.equal(ability.canDecline, true, cardId);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, true, cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("host and joining player privately resolve only their own matching Drop copy", () => {
  for (const side of ["human", "bot"]) {
    const game = fixture({ cardId: BATCH[0][0], riderCardId: BATCH[0][1], side, energy: 9 });
    const result = discover(game);
    assert.equal(result.queued.length, 1, JSON.stringify(result));
    assert.equal(game.state.pendingAbility.side, side);
    assert.equal(game.state.pendingAbility.instance.uid, game.source.uid);
    assert.equal(discover(game).queued.length, 0, "duplicate ride event does not offer the same ability twice");
    const resolved = resolve(game, true, { callZone: "rear-right" });
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(game.state.players[side].drop.some(item => item.uid === game.source.uid), false);
    assert.equal(game.state.players[side].rear[1].uid, game.source.uid);
    assert.equal(game.state.players[side].rear[1].position, "stand");
    assert.equal(game.state.players[side].soul.length, 0, "Soul Blast 1 is paid by the ability controller");
    assert.equal(game.state.players[side].energy, 10, "Energy Charge is capped at 10");
    assert.deepEqual(game.state.players[game.otherSide].rear, Array(5).fill(null));
    assert.deepEqual(game.state.players[game.otherSide].soul, []);
  }
});

test("every name condition is exact and only an actual Grade 3+ Ride event in Ride Phase qualifies", () => {
  for (const [cardId, riderCardId] of BATCH) assert.equal(discover(fixture({ cardId, riderCardId })).queued.length, 1, cardId);
  assert.equal(discover(fixture({ phase: 3 })).queued.length, 0, "wrong phase does not trigger");
  assert.equal(discover(fixture({ phase: "battle" })).queued.length, 0, "string battle phase does not trigger");
  assert.equal(discover(fixture({ riderCardId: "cfa-31" })).queued.length, 0, "wrong Vanguard name and grade do not trigger");
  assert.equal(discover(fixture({ riderCardId: "cfa-12250", cardId: BATCH[0][0] })).queued.length, 0, "another archetype's Grade 3 Vanguard does not match");
  const lowGrade = fixture();
  lowGrade.state.players.human.vanguard.grade = 2;
  assert.equal(discover(lowGrade).queued.length, 0, "a Grade 2 Vanguard does not satisfy Grade 3 or greater");
  assert.equal(discover(fixture({ sameNameRear: true })).queued.length, 0, "same-name Rear-Guard condition blocks eligibility");
  assert.equal(discover(fixture({ soul: 0 })).queued.length, 0, "unpayable Soul Blast blocks eligibility");
  assert.equal(discover(fixture({ lockedCircles: true })).queued.length, 0, "no legal Rear-Guard circle blocks eligibility");
  const forged = fixture({ side: "bot" });
  assert.equal(discover(forged, { ...forged.event, actingPlayerId: "host-player", eventId: `${forged.event.eventId}-forged` }).queued.length, 0);
});

test("declining consumes this event once without paying Soul or reopening the prompt", () => {
  const game = fixture({ side: "bot" });
  assert.equal(discover(game).queued.length, 1);
  const resolved = resolve(game, false);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(game.state.players.bot.drop[0].uid, game.source.uid);
  assert.equal(game.state.players.bot.soul.length, 1);
  assert.equal(discover(game).queued.length, 0);
});

test("resolution rejects a host answering for the joining player and rejects a locked selected circle atomically", () => {
  const wrongPlayer = fixture({ side: "bot" });
  assert.equal(discover(wrongPlayer).queued.length, 1);
  const beforeWrongPlayer = JSON.stringify(wrongPlayer.state);
  assert.equal(resolve(wrongPlayer, true, { authUid: seats.hostAuthUid }).ok, false);
  assert.equal(JSON.stringify(wrongPlayer.state), beforeWrongPlayer);

  const lockedTarget = fixture();
  assert.equal(discover(lockedTarget).queued.length, 1);
  lockedTarget.state.players.human.rear[0] = { uid: "locked-selected-circle", locked: true, isLocked: true };
  const beforeLockedTarget = JSON.stringify(lockedTarget.state);
  const rejected = resolve(lockedTarget, true, { callZone: "rear-left" });
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(lockedTarget.state), beforeLockedTarget);
});

test("Energy Charge is a harmless no-op without an Energy Generator, while the call still resolves", () => {
  const game = fixture({ energyGenerator: false, energy: 0 });
  delete game.state.players.human.energy;
  assert.equal(discover(game).queued.length, 1);
  const resolved = resolve(game, true);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(game.state.players.human.rear[0].uid, game.source.uid);
  assert.equal(game.state.players.human.energy, undefined);
});

test("the call can choose an unlocked Accel circle and retires its current unit", () => {
  const game = fixture();
  const player = game.state.players.human;
  player.accelZones = 2;
  player.rear = [...player.rear, null, null];
  const displaced = card("occupied-accel-circle", "cfa-10069", game.playerId);
  player.rear[5] = displaced;
  assert.equal(discover(game).queued.length, 1);
  const resolved = resolve(game, true, { callZone: "accel-1" });
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(player.rear[5].uid, game.source.uid);
  assert.equal(player.rear[5].rested, false);
  assert.equal(player.drop.some(item => item.uid === displaced.uid), true);
  assert.equal(player.drop.find(item => item.uid === displaced.uid).circle, null);
});
