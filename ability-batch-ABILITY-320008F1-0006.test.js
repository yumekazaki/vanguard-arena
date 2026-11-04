"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0006.js");

const BATCH_ID = "ABILITY-320008F1-0006";
const expected = [
  "cfa-10140:0", "cfa-10140:1", "cfa-10141:0", "cfa-10143:0", "cfa-10144:0",
  "cfa-10145:0", "cfa-10146:0", "cfa-10147:0", "cfa-10147:1", "cfa-10148:0",
  "cfa-10148:1", "cfa-1014:0", "cfa-1014:1", "cfa-10150:0", "cfa-10150:1",
  "cfa-10151:0", "cfa-10152:0", "cfa-10153:0", "cfa-10154:0", "cfa-10155:0",
  "cfa-10156:0", "cfa-10157:0", "cfa-10157:1", "cfa-10159:0", "cfa-10159:1",
  "cfa-1015:0", "cfa-10160:0", "cfa-10160:1", "cfa-10161:0", "cfa-10161:1",
  "cfa-10162:0", "cfa-10163:0", "cfa-10164:0", "cfa-1016:0"
];
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const assignment = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8"))
  .assignments.find(item => item.batchId === BATCH_ID);
const batch = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8"))
  .batches.find(item => item.batchId === BATCH_ID);
const audit = contribution.audit;
const supportedById = new Map(audit.supportedDefinitions.map(item => [item.abilityId, item]));
const unsupportedById = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function parsedAbility(abilityId) {
  const separator = abilityId.lastIndexOf(":");
  const cardId = abilityId.slice(0, separator);
  const card = catalogById.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `parsed ability ${abilityId} exists`);
  return { card, ability };
}

function forerunnerFixture(side = "human", options = {}) {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const opponentId = otherSide === "human" ? "host-player" : "guest-player";
  const definition = catalogById.get("cfa-1014");
  const sourceClan = options.sourceClan || definition.clan || definition.clans[0];
  const riderClan = options.riderClan || sourceClan;
  const source = {
    uid: `forerunner-source-${side}`, cardId: "cfa-1014", type: "Unit", grade: 0,
    ownerPlayerId: playerId, controllerPlayerId: playerId, clan: sourceClan, clans: [sourceClan]
  };
  const rider = {
    uid: `rider-${side}`, cardId: "fixture-rider", type: "Unit", grade: 1,
    ownerPlayerId: playerId, controllerPlayerId: playerId, clan: riderClan, clans: [riderClan]
  };
  const emptyPlayer = id => ({
    playerId: id, vanguard: null, rear: Array(5).fill(null), soul: [], drop: [], hand: [], deck: [],
    damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  });
  const players = { human: emptyPlayer("host-player"), bot: emptyPlayer("guest-player") };
  players[side].vanguard = rider;
  players[side].soul = [source];
  const state = {
    matchId: `batch-0006-forerunner-${side}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 2, side,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    players
  };
  const targetUid = options.unrelatedTarget ? `other-source-${side}` : source.uid;
  const event = Engine.createGameEvent(state, {
    type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: rider.ownerPlayerId,
    sourceControllerPlayerId: rider.controllerPlayerId, sourceCardClan: rider.clan,
    sourceCardClans: rider.clans, cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid,
    subjectOwnerPlayerId: rider.ownerPlayerId, subjectControllerPlayerId: rider.controllerPlayerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [targetUid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
    phase: "ride", timingWindow: options.timingWindow || "normal-ride"
  });
  return { state, source, rider, playerId, side, event };
}

function resolveForerunner(fixture, { actorAuthUid, accept = true, actionId = `forerunner-${fixture.side}` } = {}) {
  const actor = actorAuthUid || (fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid);
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: actor,
    actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: {
      accept,
      selection: { instanceUid: fixture.source.uid, abilityId: "cfa-1014:0", ...(accept ? { callZone: "rear-left" } : {}) }
    }
  }, seats, Engine);
}

function revolDressFixture(side = "human") {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const opponentId = otherSide === "human" ? "host-player" : "guest-player";
  const source = {
    uid: `revol-source-${side}`, cardId: "cfa-10140", cardName: catalogById.get("cfa-10140").name,
    grade: 3, unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, zone: "vanguard", circle: "vanguard"
  };
  const rider = {
    uid: `revol-rider-${side}`, cardId: "cfa-10130", cardName: catalogById.get("cfa-10130").name,
    grade: 3, unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, zone: "soul"
  };
  const emptyPlayer = id => ({
    playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], damage: [], drop: [],
    bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  });
  const players = { human: emptyPlayer("host-player"), bot: emptyPlayer("guest-player") };
  players[side].vanguard = source;
  players[side].soul = [rider];
  players[otherSide].vanguard = {
    uid: `opponent-vanguard-${side}`, cardId: "cfa-3", cardName: catalogById.get("cfa-3").name,
    grade: 3, unitCard: true, ownerPlayerId: opponentId, controllerPlayerId: opponentId, zone: "vanguard", circle: "vanguard"
  };
  const state = {
    matchId: `batch-0006-revoldress-${side}`, stateVersion: 1, turn: 4, phase: 6, side,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null,
    pendingTurnEnd: { side, playerId, turn: 4, cleanupQueued: false }, players
  };
  return { state, source, rider, playerId, side };
}

function endTurnEvent(fixture, overrides = {}) {
  const event = Engine.createGameEvent(fixture.state, {
    type: "turn.ended", actingPlayerId: fixture.playerId, turnPlayerId: fixture.playerId,
    phase: "end", timingWindow: "turn-end", ...overrides
  });
  fixture.state.pendingTurnEnd.turnEndEvent = event;
  fixture.state.pendingTurnEnd.turnEndEventId = event.eventId;
  return event;
}

function resolveRevolDressRide(fixture, actorAuthUid) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: actorAuthUid || (fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId: `revol-ride-${fixture.side}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: fixture.source.uid, abilityId: "cfa-10140:1", effectUid: fixture.rider.uid } }
  }, seats, Engine);
}

test("ABILITY-320008F1-0006 accounts for exactly its reserved 34 ability IDs and 25 cards", () => {
  assert.ok(assignment, "assignment record exists");
  assert.ok(batch, "batch manifest record exists");
  assert.equal(assignment.status, "reserved");
  assert.equal(assignment.workerOwner, "primary-session");
  assert.equal(assignment.previousWorkerOwner, "worker-ability-batch-0006");
  assert.deepEqual(assignment.abilityIds, expected);
  assert.deepEqual(batch.abilityIds, expected);
  assert.equal(batch.workerOwner, assignment.workerOwner);
  assert.deepEqual(audit.abilityIds, expected);
  assert.equal(new Set(audit.abilityIds).size, 34);
  assert.equal(audit.cards.length, 25);
  assert.equal(contribution.length, 0, "no new runtime definitions are emitted");
  assert.deepEqual(audit.implementedAbilityIds, []);
  assert.deepEqual(audit.alreadySupportedAbilityIds.slice().sort(), ["cfa-10140:1", "cfa-1014:0"].sort());
  assert.deepEqual(new Set(audit.cards.map(card => card.cardId)), new Set(batch.cardIds));
});

test("every assigned ability is classified once with exact local card text and a concrete blocker where unsupported", () => {
  assert.equal(supportedById.size, 2);
  assert.equal(unsupportedById.size, 32);
  assert.equal(supportedById.size + unsupportedById.size, expected.length);
  for (const abilityId of expected) {
    const { card, ability } = parsedAbility(abilityId);
    const cardRecord = audit.cards.find(item => item.cardId === card.id);
    assert.ok(cardRecord, `${abilityId} has an assigned card record`);
    assert.equal(cardRecord.name, card.name);
    assert.equal(cardRecord.grade, Number(card.grade));
    const record = supportedById.get(abilityId) || unsupportedById.get(abilityId);
    assert.ok(record, `${abilityId} is classified`);
    assert.equal(record.kind, ability.kind, `${abilityId} category`);
    assert.equal(record.catalogPrintedText, ability.printedText, `${abilityId} exact local printed text`);
    assert.ok(card.text.includes(ability.printedText), `${abilityId} text is present on the exact card`);
    if (supportedById.has(abilityId)) {
      assert.deepEqual(record.definition, ability.definition, `${abilityId} structured production definition`);
      assert.equal(record.patternId, ability.definition.source.patternId);
      assert.equal(record.implementationStatus, "already-supported-in-production");
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, `${abilityId} remains trusted`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${abilityId} has server effects`);
    } else {
      assert.equal(ability.definition, null, `${abilityId} has no trusted production definition`);
      assert.equal(record.officialPrintedText, null, `${abilityId} was not falsely labeled official-text checked`);
      assert.ok(record.blocker.length > 70, `${abilityId} has a concrete blocker`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, `${abilityId} is not trusted`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId} is unavailable to server resolution`);
    }
  }
  assert.deepEqual([...supportedById.keys()].sort(), ["cfa-10140:1", "cfa-1014:0"].sort());
  assert.deepEqual(audit.proposedDefinitions, [], "both structured definitions are already present in production");
});

test("the 32 unsupported siblings remain unavailable to either player seat", () => {
  for (const abilityId of unsupportedById.keys()) {
    const { ability } = parsedAbility(abilityId);
    if (ability.kind === "AUTO") {
      assert.equal(Engine.autoAbilityReadiness(ability).ok, false, `${abilityId} AUTO stays unavailable`);
    } else if (ability.kind === "ACT") {
      for (const playerId of ["host-player", "guest-player"]) {
        const result = Engine.canActivateManualAbility(ability, {
          cardInstanceId: `${abilityId}-${playerId}`, controllerPlayerId: playerId,
          actorPlayerId: playerId, turnPlayerId: playerId, phase: "main", inPermittedZone: true,
          conditions: {}, resources: {}
        });
        assert.deepEqual(result, { ok: false, reason: "unsupported-effect" }, `${abilityId} ACT blocked for ${playerId}`);
      }
    } else if (ability.kind === "CONT") {
      assert.deepEqual(Engine.canActivateManualAbility(ability, {}), { ok: false, reason: "not-manual" }, `${abilityId} CONT is passive`);
      assert.equal(ability.effects, null, `${abilityId} CONT has no placeholder effect`);
    } else {
      assert.fail(`${abilityId} has unexpected ability kind ${ability.kind}`);
    }
  }
});

test("cfa-1014:0 Forerunner matches only the exact same-clan ride event and resolves for both seats", () => {
  const { ability } = parsedAbility("cfa-1014:0");
  const supported = supportedById.get("cfa-1014:0");
  assert.equal(supported.patternId, "auto-forerunner-same-clan-ride-call-source-v1");
  assert.equal(ability.trigger.eventType, "card.ridden");
  assert.equal(ability.trigger.subject, "ridden-unit");
  assert.deepEqual(ability.trigger.circles, ["vanguard"]);
  assert.deepEqual(ability.costs, []);
  assert.equal(ability.canDecline, true);
  assert.deepEqual(ability.definition.effects, [{ op: "call-source-from-soul", target: "source", position: "stand" }]);

  for (const side of ["human", "bot"]) {
    const f = forerunnerFixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}: exact ride event queues once`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.canPayAbilityCosts(f.state.pendingAbility.ability, {}), true, `${side}: no cost`);
    const wrongSeat = resolveForerunner(f, { actorAuthUid: side === "human" ? seats.guestAuthUid : seats.hostAuthUid, actionId: `forerunner-wrong-${side}` });
    assert.equal(wrongSeat.ok, false, `${side}: opponent cannot resolve the prompt`);
    const resolved = resolveForerunner(f);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || "resolved"}`);
    assert.equal(f.state.players[side].rear[0].uid, f.source.uid);
    assert.equal(f.state.players[side].rear[0].rested, false);
    assert.equal(f.state.players[side].soul.some(card => card.uid === f.source.uid), false);
  }

  for (const bad of [
    forerunnerFixture("human", { riderClan: "Kagero" }),
    forerunnerFixture("human", { unrelatedTarget: true })
  ]) {
    assert.equal(Reducer.discoverAutoTriggers(bad.state, [bad.event], Engine).queued.length, 0,
      "wrong clan or wrong ridden instance does not trigger");
  }
  const wrongEvent = forerunnerFixture("human");
  const nonRideEvent = { ...wrongEvent.event, type: "unit.attacked", eventId: "non-ride-event" };
  assert.equal(Reducer.discoverAutoTriggers(wrongEvent.state, [nonRideEvent], Engine).queued.length, 0,
    "a non-ride event does not satisfy the printed ride timing");
});

test("cfa-10140:1 end-turn RevolDress ride checks the controller, exact timing, source, cost, and both seats", () => {
  const { ability } = parsedAbility("cfa-10140:1");
  assert.equal(supportedById.get("cfa-10140:1").patternId, "auto-vc-end-turn-revoldress-ride-from-soul-rest-v1");
  assert.equal(ability.trigger.eventType, "turn.ended");
  assert.equal(ability.trigger.subject, "controller");
  assert.equal(ability.trigger.turnRelation, "controller");
  assert.deepEqual(ability.requiredLocation, ["vanguard"]);
  assert.deepEqual(ability.costs, []);
  assert.deepEqual(ability.definition.effects, [{ op: "ride-revoldress-source-from-soul-rested", target: "controller", rested: true }]);

  for (const side of ["human", "bot"]) {
    const f = revolDressFixture(side);
    const event = endTurnEvent(f);
    const discovered = Reducer.discoverAutoTriggers(f.state, [event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}: controller end-turn trigger queues`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.canPayAbilityCosts(f.state.pendingAbility.ability, {}), true, `${side}: no cost`);
    const wrongSeat = resolveRevolDressRide(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid);
    assert.equal(wrongSeat.ok, false, `${side}: opponent cannot resolve the prompt`);
    const result = resolveRevolDressRide(f);
    assert.equal(result.ok, true, `${side}: ${result.reason || "resolved"}`);
    assert.equal(f.state.players[side].vanguard.uid, f.rider.uid);
    assert.equal(f.state.players[side].vanguard.rested, true);
    assert.ok(f.state.players[side].soul.some(card => card.uid === f.source.uid));
    assert.ok(result.events.some(item => item.type === "card.ridden" && item.subjectCardInstanceId === f.rider.uid));
  }

  const wrongTiming = revolDressFixture("human");
  assert.equal(Reducer.discoverAutoTriggers(wrongTiming.state,
    [endTurnEvent(wrongTiming, { timingWindow: "phase-start" })], Engine).queued.length, 0);
  const opponentTurn = revolDressFixture("human");
  assert.equal(Reducer.discoverAutoTriggers(opponentTurn.state,
    [endTurnEvent(opponentTurn, { actingPlayerId: "guest-player", turnPlayerId: "guest-player" })], Engine).queued.length, 0);
  const movedSource = revolDressFixture("human");
  movedSource.state.players.human.vanguard = null;
  movedSource.state.players.human.rear[0] = movedSource.source;
  assert.equal(Reducer.discoverAutoTriggers(movedSource.state, [endTurnEvent(movedSource)], Engine).queued.length, 0);
  const noEligibleRider = revolDressFixture("human");
  noEligibleRider.state.players.human.soul = [];
  assert.equal(Reducer.discoverAutoTriggers(noEligibleRider.state, [endTurnEvent(noEligibleRider)], Engine).queued.length, 0);
});
