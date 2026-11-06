"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const batch = require("./ability-contributions/batch-ABILITY-76D8A0B8-0017.js");
Engine.registerAbilityDefinitions(batch);
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const EXPECTED_IDS = [
  "cfa-11308:0", "cfa-11314:0", "cfa-11314:1", "cfa-11315:0", "cfa-11316:0", "cfa-11316:1",
  "cfa-11317:0", "cfa-11317:1", "cfa-11318:0", "cfa-11319:0", "cfa-11319:1", "cfa-1131:0",
  "cfa-1131:1", "cfa-11320:0", "cfa-11320:1", "cfa-11321:0", "cfa-11321:1", "cfa-11322:0",
  "cfa-11322:1", "cfa-11323:0", "cfa-11324:0", "cfa-11330:0", "cfa-11330:1", "cfa-11331:0",
  "cfa-11331:1", "cfa-11332:0", "cfa-11332:1", "cfa-11332:2", "cfa-11333:0", "cfa-11333:1",
  "cfa-11334:0", "cfa-11334:1", "cfa-11335:0", "cfa-11336:0", "cfa-11337:0", "cfa-11338:0",
  "cfa-11338:1", "cfa-11338:2", "cfa-11339:0", "cfa-11339:1", "cfa-11340:0", "cfa-1134:0"
];
const PROPOSED = ["cfa-11321:0", "cfa-11321:1"];
const card = cards.get("cfa-11321");
const parsed = Engine.parseCardAbilities(card);
const abilityById = new Map(parsed.map(ability => [ability.id, ability]));

function instance(cardId, uid, playerId, zone, circle = zone) {
  const definition = cards.get(cardId);
  assert.ok(definition, `catalog contains ${cardId}`);
  return {
    uid, cardId, cardName: definition.name, name: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade || 0), clan: definition.clan, clans: definition.clans || [],
    race: definition.race, power: Number(definition.power || 0), powerBoost: 0, turnPowerBoost: 0,
    shield: Number(definition.shield || 0), trigger: definition.trigger || "", unitCard: true,
    ownerPlayerId: playerId, controllerPlayerId: playerId, zone, circle
  };
}

function fixture(abilityId, ownerSide) {
  const ownerId = ownerSide === "human" ? "player-host" : "player-guest";
  const opponentId = ownerSide === "human" ? "player-guest" : "player-host";
  const source = instance("cfa-11321", `source-${abilityId}-${ownerSide}`, ownerId, "rear-guard", "rear-left");
  const frontTarget = instance("cfa-1", `rear-target-${abilityId}-${ownerSide}`, ownerId, "rear-guard", "rear-right");
  const ownVanguard = instance("cfa-1", `vg-${abilityId}-${ownerSide}`, ownerId, "vanguard", "vanguard");
  const enemyVanguard = instance("cfa-1", `opp-vg-${abilityId}-${ownerSide}`, opponentId, "vanguard", "vanguard");
  const makePlayer = playerId => ({
    playerId, vanguard: null, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [],
    orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  });
  const players = { human: makePlayer("player-host"), bot: makePlayer("player-guest") };
  players[ownerSide].vanguard = ownVanguard;
  players[ownerSide].rear = [source, frontTarget, null, null, null];
  players[ownerSide === "human" ? "bot" : "human"].vanguard = enemyVanguard;
  const state = {
    matchId: `batch17-${abilityId}-${ownerSide}`, stateVersion: 1, eventSequence: 0, turn: 2, phase: 4,
    side: ownerSide, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], players
  };
  return { state, ownerSide, ownerId, opponentId, source, frontTarget, ownVanguard, enemyVanguard };
}

function placementEvent(f, placed, circle, actingPlayerId = f.ownerId, previousLocation = "hand") {
  return Engine.createGameEvent(f.state, {
    type: "card.placed", actingPlayerId, turnPlayerId: actingPlayerId,
    sourceCardInstanceId: placed.uid, sourceOwnerPlayerId: placed.ownerPlayerId,
    sourceControllerPlayerId: placed.controllerPlayerId, cardInstanceId: placed.uid,
    subjectCardInstanceId: placed.uid, subjectOwnerPlayerId: placed.ownerPlayerId,
    subjectControllerPlayerId: placed.controllerPlayerId, previousLocation,
    currentLocation: circle, circle, targetLocation: circle, phase: "main", timingWindow: "card-placed"
  });
}

function queue(f, abilityId, event) {
  const result = Reducer.discoverAutoTriggers(f.state, [event], Engine);
  const matches = result.queued.filter(item => item?.ability?.id === abilityId && item?.instance?.uid === f.source.uid);
  assert.equal(matches.length, 1, `${abilityId} queues exactly once for its source`);
  assert.equal(matches[0].side, f.ownerSide);
  assert.equal(matches[0].triggerControllerPlayerId, f.ownerId);
  return matches[0];
}

function resolve(f, abilityId, selection) {
  const authUid = f.ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid,
    actionId: `resolve-${abilityId}-${f.ownerSide}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId, ...selection } }
  }, seats, Engine);
}

test("batch 0017 accounts for all 42 exact IDs and keeps every unresolved ability blocked", () => {
  assert.equal(batch.audit.batchId, "ABILITY-76D8A0B8-0017");
  assert.equal(batch.audit.auditedAbilityIds.length, 42);
  assert.deepEqual(batch.audit.auditedAbilityIds, EXPECTED_IDS);
  assert.equal(new Set(batch.audit.auditedAbilityIds).size, 42);
  assert.deepEqual(batch.audit.proposedDefinitionIds, PROPOSED);
  assert.deepEqual(batch.audit.alreadySupportedAbilityIds, [
    "cfa-11314:0", "cfa-11314:1", "cfa-1131:0", "cfa-1131:1", "cfa-11322:0", "cfa-11322:1",
    "cfa-11330:0", "cfa-11330:1", "cfa-11338:0", "cfa-11338:1", "cfa-11338:2", "cfa-11339:1"
  ]);
  assert.equal(batch.audit.blocked.length, 28);
  assert.deepEqual([...batch.audit.alreadySupportedAbilityIds, ...PROPOSED, ...batch.audit.blocked.map(item => item.abilityId)].sort(), [...EXPECTED_IDS].sort());
  assert.equal(batch.audit.provenanceWarnings.length, 1);
});

test("the two catalog abilities keep separate triggers, locations, and target rules", () => {
  assert.equal(parsed.length, 2, "the complete card has exactly two printed abilities");
  assert.equal(card.name, 'Female Acolyte "Blessing"');
  assert.equal(Engine.getReviewedAbilityDefinitionsForCard(card.id).length >= 2, true);
  const placed = abilityById.get("cfa-11321:0"), vanguardPlaced = abilityById.get("cfa-11321:1");
  assert.ok(placed?.definition && vanguardPlaced?.definition);
  assert.equal(placed.definition.source.patternId, "auto-rc-placement-optional-friendly-power-turn-v1");
  assert.deepEqual(placed.trigger, { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] });
  assert.equal(placed.definition.effects[0].optionalTarget, true);
  assert.equal(placed.definition.effects[0].targetFilter.excludeSource, true);
  assert.deepEqual(vanguardPlaced.trigger, {
    status: "recognized-trigger", eventType: "card.placed", subject: "any", circles: ["vanguard"],
    subjectControllerRelation: "source-controller"
  });
  assert.deepEqual(vanguardPlaced.definition.effects[0].targetFilter, {
    controller: "source-controller", cardType: "unit", zone: "vanguard"
  });
  assert.equal(Reducer.supportsServerAbilityEffects(placed), true);
  assert.equal(Reducer.supportsServerAbilityEffects(vanguardPlaced), true);
});

test("optional RC placement power resolves for either controller and permits choosing no target", () => {
  const abilityId = "cfa-11321:0";
  for (const side of ["human", "bot"]) {
    const f = fixture(abilityId, side), event = placementEvent(f, f.source, "rear-left");
    queue(f, abilityId, event);
    const result = resolve(f, abilityId, { optionalNoTarget: true });
    assert.equal(result.ok, true, `${side} can resolve the mandatory trigger while choosing zero targets`);
    assert.equal(f.frontTarget.turnPowerBoost, 0);
    assert.equal(f.ownVanguard.turnPowerBoost, 0);
  }
});

test("RC placement power affects only the selected friendly unit and exact source placement triggers it", () => {
  const abilityId = "cfa-11321:0";
  for (const side of ["human", "bot"]) {
    const f = fixture(abilityId, side), event = placementEvent(f, f.source, "rear-left");
    queue(f, abilityId, event);
    const result = resolve(f, abilityId, { targetUid: f.frontTarget.uid });
    assert.equal(result.ok, true, side);
    assert.equal(f.frontTarget.turnPowerBoost, 2000);
    assert.equal(f.source.turnPowerBoost, 0);
    assert.equal(f.enemyVanguard.turnPowerBoost, 0);
  }
  const f = fixture(abilityId, "human");
  const unrelated = instance("cfa-1", "unrelated-placement", f.ownerId, "rear-guard", "rear-right");
  f.state.players.human.rear[2] = unrelated;
  const unrelatedResult = Reducer.discoverAutoTriggers(f.state, [placementEvent(f, unrelated, "rear-right")], Engine);
  assert.equal(unrelatedResult.queued.some(item => item?.ability?.id === abilityId && item?.instance?.uid === f.source.uid), false);
});

test("Vanguard placement power responds only to its controller's VC placement and resolves for the joined player", () => {
  const abilityId = "cfa-11321:1";
  for (const side of ["human", "bot"]) {
    const f = fixture(abilityId, side), event = placementEvent(f, f.ownVanguard, "vanguard");
    queue(f, abilityId, event);
    const result = resolve(f, abilityId, { targetUid: f.ownVanguard.uid });
    assert.equal(result.ok, true, side);
    assert.equal(f.ownVanguard.turnPowerBoost, 5000);
    assert.equal(f.enemyVanguard.turnPowerBoost, 0);
  }
});

test("wrong circle, unrelated Vanguard, and opponent Vanguard placement do not offer the source skill", () => {
  const abilityId = "cfa-11321:0", f = fixture(abilityId, "human");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [placementEvent(f, f.source, "vanguard")], Engine).queued.length, 0);
  const unrelated = instance("cfa-1", "unrelated-vanguard", f.ownerId, "vanguard", "vanguard");
  f.state.players.human.vanguard = unrelated;
  const unrelatedResult = Reducer.discoverAutoTriggers(f.state, [placementEvent(f, unrelated, "vanguard")], Engine);
  assert.equal(unrelatedResult.queued.some(item => item?.ability?.id === abilityId && item?.instance?.uid === f.source.uid), false);

  const vanguardAbilityId = "cfa-11321:1", other = fixture(vanguardAbilityId, "human");
  const opponentEvent = placementEvent(other, other.enemyVanguard, "vanguard", other.opponentId);
  const opponentResult = Reducer.discoverAutoTriggers(other.state, [opponentEvent], Engine);
  assert.equal(opponentResult.queued.some(item => item?.ability?.id === vanguardAbilityId && item?.instance?.uid === other.source.uid), false);
});

test("both abilities reject foreign targets atomically and duplicate events do not duplicate prompts", () => {
  for (const [abilityId, eventCircle, invalidTargetKey] of [
    ["cfa-11321:0", "rear-left", "enemyVanguard"],
    ["cfa-11321:1", "vanguard", "frontTarget"]
  ]) {
    for (const side of ["human", "bot"]) {
      const f = fixture(abilityId, side);
      const eventSource = abilityId === "cfa-11321:0" ? f.source : f.ownVanguard;
      const event = placementEvent(f, eventSource, eventCircle);
      const first = Reducer.discoverAutoTriggers(f.state, [event], Engine);
      assert.equal(first.queued.filter(item => item?.ability?.id === abilityId && item?.instance?.uid === f.source.uid).length, 1);
      const duplicate = Reducer.discoverAutoTriggers(f.state, [event], Engine);
      assert.equal(duplicate.queued.some(item => item?.ability?.id === abilityId && item?.instance?.uid === f.source.uid), false);
      const before = JSON.stringify(f.state);
      const rejected = resolve(f, abilityId, { targetUid: f[invalidTargetKey].uid });
      assert.equal(rejected.ok, false, `${abilityId} rejects the wrong side or circle`);
      assert.equal(JSON.stringify(f.state), before, `${abilityId} does not partially apply an invalid choice`);
    }
  }
});

test("an off-circle source cannot use its Vanguard-placement ability", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-11321:1", side), owner = f.state.players[side];
    owner.rear[0] = null;
    owner.drop.push({ ...f.source, zone: "drop", circle: "drop" });
    const event = placementEvent(f, f.ownVanguard, "vanguard");
    const result = Reducer.discoverAutoTriggers(f.state, [event], Engine);
    assert.equal(result.queued.some(item => item?.ability?.id === "cfa-11321:1" && item?.instance?.uid === f.source.uid), false);
  }
});

