"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const forerunnerCard = loadCatalog().find(card => card.id === "cfa-45");
const forerunner = Engine.parseCardAbilities(forerunnerCard).find(ability => ability.definition?.source?.patternId === "auto-forerunner-same-clan-ride-call-source-v1");
assert.ok(forerunner, "real Forerunner definition should compile");

function fixture(options = {}) {
  const { side = "bot", riderClan = "Megacolony", sourceUid = "forerunner-source", riderUid = "ride-unit", removeSourceClan = false, removeRiderClan = false, unrelatedTarget = false } = options;
  const sourceDefinition = options.sourceDefinition || forerunnerCard;
  const sourceClan = options.sourceClan ?? sourceDefinition.clan ?? sourceDefinition.clans?.[0] ?? "Megacolony";
  const playerId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const source = {
    uid: sourceUid, cardId: sourceDefinition.id, type: sourceDefinition.type, grade: 0,
    ownerPlayerId: playerId, controllerPlayerId: playerId,
    ...(!removeSourceClan ? { clan: sourceClan, clans: [sourceClan] } : {})
  };
  const rider = {
    uid: riderUid, cardId: "test-rider", type: "Unit", grade: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId,
    ...(!removeRiderClan ? { clan: riderClan, clans: [riderClan] } : {})
  };
  const player = {
    playerId, vanguard: rider, rear: Array(5).fill(null), soul: [source], drop: [], hand: [], damage: [], deck: [], bind: [],
    guardCircle: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: []
  };
  const opponent = {
    playerId: side === "human" ? "player-guest" : "player-host", vanguard: null,
    rear: Array(5).fill(null), soul: [], drop: [], hand: [], damage: [], deck: [], bind: [],
    guardCircle: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: []
  };
  const state = {
    matchId: "forerunner-authority", stateVersion: 4, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [],
    turn: 2, side, phase: 2, players: { [side]: player, [otherSide]: opponent }
  };
  const targetUid = unrelatedTarget ? "unrelated-source" : source.uid;
  const event = Engine.createGameEvent(state, {
    type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: rider.ownerPlayerId,
    sourceControllerPlayerId: rider.controllerPlayerId, sourceCardClan: rider.clan || null,
    sourceCardClans: rider.clans || [], cardInstanceId: rider.uid,
    subjectCardInstanceId: rider.uid, subjectOwnerPlayerId: rider.ownerPlayerId,
    subjectControllerPlayerId: rider.controllerPlayerId, previousLocation: "hand", currentLocation: "vanguard",
    targetCardInstanceIds: [targetUid], targetPreviousLocation: "vanguard", targetCurrentLocation: "soul",
    targetLocation: "vanguard", phase: "ride", timingWindow: "normal-ride"
  });
  return { state, player, source, rider, event, side, playerId };
}

function discover(f) {
  return Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
}

function decision(f, accept, actionId = "resolve-forerunner") {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.side === "human" ? "auth-host" : "auth-guest",
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: pending.ability.id, ...(accept ? { callZone: "rear-left" } : {}) } }
  }, seats, Engine);
}

test("Forerunner AUTO queues only for the exact ridden source when clans match; both seats resolve their own source", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ side });
    const queued = discover(f);
    assert.equal(queued.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    const result = decision(f, true, `forerunner-${side}`);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.player.soul.some(card => card.uid === f.source.uid), false);
    assert.equal(f.player.rear[0].uid, f.source.uid);
    assert.equal(f.player.rear[0].rested, false);
  }
});

test("Forerunner rejects mismatched or missing source/rider clan metadata and unrelated ride targets", () => {
  for (const options of [
    { riderClan: "Kagero" },
    { removeSourceClan: true },
    { removeRiderClan: true },
    { unrelatedTarget: true }
  ]) {
    const f = fixture(options);
    assert.equal(discover(f).queued.length, 0, JSON.stringify(options));
    assert.equal(f.state.pendingAbility ?? null, null);
    assert.equal(f.player.soul[0].uid, f.source.uid);
  }
});

test("Forerunner decline leaves its exact source in Soul; duplicate ride events cannot queue it again", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  assert.equal(discover(f).queued.length, 0);
  const result = decision(f, false);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(f.player.soul.map(card => card.uid), [f.source.uid]);
  assert.ok(f.player.rear.every(card => card == null));
  assert.equal(f.state.pendingAbility, null);
  assert.deepEqual(f.state.pendingAbilities, []);
});

test("Forerunner resolution rechecks clan and exact source after it was queued", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  f.rider.clan = "Kagero";
  f.rider.clans = ["Kagero"];
  f.event = Object.freeze({ ...f.event, sourceCardClan: "Kagero", sourceCardClans: ["Kagero"] });
  f.state.pendingAbility.eventContext.gameEvent = f.event;
  const before = JSON.stringify({ soul: f.player.soul, rear: f.player.rear });
  const result = decision(f, true, "forerunner-stale-clan");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "forerunner-ride-context-invalid");
  assert.equal(JSON.stringify({ soul: f.player.soul, rear: f.player.rear }), before);
});

test("all 362 real Forerunner records resolve with known clans or fail closed when catalog clan data is missing", () => {
  const definitions = loadCatalog().filter(card => Engine.parseCardAbilitiesCached(card).some(ability => ability.definition?.source?.patternId === forerunner.definition.source.patternId));
  assert.equal(definitions.length, 362);
  let validatedWithClan = 0, missingClan = 0;
  for (const [index, sourceDefinition] of definitions.entries()) {
    const clan = sourceDefinition.clan || sourceDefinition.clans?.[0];
    const side = index % 2 ? "human" : "bot";
    if (!clan) {
      missingClan++;
      const f = fixture({ side, sourceDefinition, sourceClan: "", riderClan: "Megacolony", sourceUid: `forerunner-${sourceDefinition.id}` });
      assert.equal(discover(f).queued.length, 0, `${sourceDefinition.id} must fail closed without source-clan metadata`);
      continue;
    }
    validatedWithClan++;
    const f = fixture({ side, sourceDefinition, sourceClan: clan, riderClan: clan, sourceUid: `forerunner-${sourceDefinition.id}` });
    assert.equal(discover(f).queued.length, 1, sourceDefinition.id);
    assert.equal(f.state.pendingAbility.side, side, sourceDefinition.id);
    const result = decision(f, true, `resolve-${sourceDefinition.id}`);
    assert.equal(result.ok, true, `${sourceDefinition.id}: ${result.reason}`);
    assert.equal(f.player.rear[0]?.uid, f.source.uid, sourceDefinition.id);
    assert.equal(f.player.soul.some(card => card.uid === f.source.uid), false, sourceDefinition.id);
  }
  assert.equal(validatedWithClan, 353);
  assert.equal(missingClan, 9);
});
