"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0004.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_ID = "ABILITY-320008F1-0004";
const expected = [
  "cfa-10086:0", "cfa-10087:0", "cfa-10087:1", "cfa-10089:0", "cfa-10089:1",
  "cfa-10090:0", "cfa-10090:1", "cfa-10091:0", "cfa-10091:1", "cfa-10091:2",
  "cfa-10092:0", "cfa-10093:0", "cfa-10096:0", "cfa-10097:0", "cfa-10098:0",
  "cfa-1009:0", "cfa-10100:0", "cfa-10101:0", "cfa-10102:0", "cfa-10106:0",
  "cfa-10107:0", "cfa-10108:0", "cfa-10109:0", "cfa-10110:0", "cfa-10110:1",
  "cfa-10111:0", "cfa-10112:0", "cfa-10113:0", "cfa-10114:0", "cfa-10114:1",
  "cfa-1011:0", "cfa-101:0", "cfa-101:1"
];
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const parsedById = new Map();
for (const id of expected) {
  const cardId = id.slice(0, id.lastIndexOf(":"));
  const card = cards.get(cardId);
  if (!card) throw new Error(`Assigned card is missing from catalog: ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  if (!ability) throw new Error(`Assigned ability is missing from catalog: ${id}`);
  parsedById.set(id, { card, ability });
}

const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function cardInstance(cardId, uid, playerId, overrides = {}) {
  const card = cards.get(String(cardId));
  return {
    uid,
    cardId: String(cardId),
    cardName: card?.name || String(cardId),
    grade: Number(card?.grade || 0),
    type: card?.type || "Unit",
    unitCard: true,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...overrides
  };
}

function player(playerId, vanguard = null) {
  return { playerId, vanguard, rear: Array(5).fill(null), soul: [], hand: [], deck: [], drop: [], bind: [],
    damage: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
}

function rideFixture({ side = "human", riderName, targetUid, eventType = "card.ridden", phase = 2 } = {}) {
  const n = ++sequence;
  const ownId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = cardInstance("cfa-10089", `old-vanguard-${n}`, ownId);
  const rider = cardInstance("cfa-10090", `new-rider-${n}`, ownId, { cardName: riderName || "Brilliant Tune, Rektina" });
  const opponentVanguard = cardInstance("cfa-3", `opponent-vanguard-${n}`, opponentId);
  const own = player(ownId, rider), opponent = player(opponentId, opponentVanguard);
  own.soul.push(source);
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = { matchId: `ability-320008f1-0004-ride-${n}`, stateVersion: 1, eventSequence: 0, processedEventIds: [],
    processedAbilityTriggers: [], processedActionIds: [], turn: 3, side, phase, pendingAbility: null, pendingAbilities: [],
    pendingTrigger: null, pendingAttack: null, players };
  const event = Engine.createGameEvent(state, {
    type: eventType,
    actingPlayerId: ownId,
    turnPlayerId: ownId,
    sourceCardInstanceId: rider.uid,
    sourceCardName: rider.cardName,
    sourceCardGrade: rider.grade,
    sourceOwnerPlayerId: ownId,
    sourceControllerPlayerId: ownId,
    subjectCardInstanceId: rider.uid,
    subjectOwnerPlayerId: ownId,
    subjectControllerPlayerId: ownId,
    targetCardInstanceIds: [targetUid || source.uid],
    targetPreviousLocation: "vanguard",
    targetCurrentLocation: "soul",
    targetLocation: "vanguard",
    previousLocation: "hand",
    currentLocation: "vanguard",
    phase: "ride",
    timingWindow: "normal-ride"
  });
  return { state, event, source, rider, own, opponent, side, ownId };
}

function answerRide(f, { actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, accept = true, actionId = `ride-answer-${f.source.uid}` } = {}) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: "cfa-10089:0",
      ...(accept ? { callZone: "rear-left" } : {}) } }
  }, seats, Engine);
}

function actFixture({ side = "human", vanguardGrade = 3, damageCount = 2, phase = 4, sourceZone = "rear-guard" } = {}) {
  const n = ++sequence;
  const ownId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = cardInstance("cfa-10102", `act-source-${n}`, ownId);
  const vanguard = cardInstance("cfa-3", `act-vanguard-${n}`, ownId, { grade: vanguardGrade });
  const opponentVanguard = cardInstance("cfa-3", `act-opponent-vanguard-${n}`, opponentId);
  const own = player(ownId, vanguard), opponent = player(opponentId, opponentVanguard);
  if (sourceZone === "rear-guard") {
    source.circle = "rear-left";
    own.rear[0] = source;
  } else if (sourceZone === "vanguard") own.vanguard = source;
  own.damage = Array.from({ length: damageCount }, (_, index) => cardInstance("cfa-3", `act-damage-${n}-${index}`, ownId, { faceDown: false }));
  const drawn = cardInstance("cfa-4", `act-draw-${n}`, ownId);
  own.deck = [drawn];
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = { matchId: `ability-320008f1-0004-act-${n}`, stateVersion: 1, eventSequence: 0, processedActionIds: [],
    processedAbilityTriggers: [], processedActionKeys: [], turn: 3, side, phase, pendingAbility: null, pendingAbilities: [],
    pendingTrigger: null, pendingAttack: null, players };
  return { state, source, own, opponent, drawn, side, ownId, ability: parsedById.get("cfa-10102:0").ability };
}

function activateAct(f, { actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
  sourceUid = f.source.uid, actionId = `activate-${f.source.uid}-${f.state.stateVersion}`, cbUids = f.own.damage.slice(0, 2).map(card => card.uid) } = {}) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: sourceUid, abilityId: "cfa-10102:0",
      selection: { costSelections: { cb: cbUids, sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("assignment, batch, and contribution contain exactly the reserved 33 IDs on 25 cards", () => {
  const assignments = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8")).assignments;
  const batches = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8")).batches;
  const assignment = assignments.find(item => item.batchId === BATCH_ID);
  const batch = batches.find(item => item.batchId === BATCH_ID);
  assert.ok(assignment && batch);
  assert.equal(assignment.workerOwner, "primary-session");
  assert.equal(assignment.previousWorkerOwner, "worker-ability-batch-0004");
  assert.equal(assignment.status, "reserved");
  assert.deepEqual([...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].sort(), expected.slice().sort());
  assert.deepEqual(batch.abilityIds, assignment.abilityIds);
  assert.deepEqual(contribution.audit.abilityIds, expected);
  assert.deepEqual(contribution, [], "integrated abilities are owned by the production registry");
  assert.equal(contribution.audit.cards.length, 25);
  assert.equal(new Set(contribution.audit.cards.map(card => card.cardId)).size, 25);
  assert.equal(contribution.audit.officialTextChecked, true, "verified abilities retain official card-list provenance");
  assert.deepEqual(contribution.audit.officialTextVerifiedAbilityIds, ["cfa-10089:0", "cfa-10093:0", "cfa-10102:0"]);
  assert.deepEqual(contribution.audit.integratedDefinitionAbilityIds, ["cfa-10089:0", "cfa-10102:0"]);
  assert.equal(parsedById.get("cfa-10089:0").ability.definition.source.officialReference,
    "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS06%2F003EN");
  assert.equal(parsedById.get("cfa-10102:0").ability.definition.source.officialReference,
    "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=193&view=text");
});

test("all exact catalog abilities are classified once with integrated, existing, or concrete blocker evidence", () => {
  const integrated = new Set(contribution.audit.integratedDefinitionAbilityIds);
  const existing = new Map(contribution.audit.supportedProductionDefinitions.map(record => [record.abilityId, record]));
  const blocked = new Map(contribution.audit.unsupportedSiblings.map(record => [record.abilityId, record]));
  assert.equal(integrated.size, 2);
  assert.equal(existing.size, 8);
  assert.equal(blocked.size, 25);
  assert.equal(existing.size + blocked.size, expected.length);
  for (const id of expected) {
    const { card, ability } = parsedById.get(id);
    assert.ok(card.text.includes(ability.printedText), `${id}: exact catalog text`);
    const record = existing.get(id) || blocked.get(id);
    assert.ok(record, `${id}: classified`);
    assert.equal(record.kind || ability.kind, ability.kind, `${id}: ability kind`);
    if (existing.has(id)) {
      assert.equal(existing.get(id).printedText, ability.printedText, `${id}: production text`);
      assert.equal(ability.definition?.source?.patternId, existing.get(id).definitionSource, `${id}: existing production pattern`);
      if (integrated.has(id)) {
        assert.ok(ability.definition.source.officialReference, `${id}: official source recorded`);
        assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, `${id}: trusted in production`);
        assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${id}: production effect handler`);
      }
    } else {
      assert.equal(blocked.get(id).catalogPrintedText, ability.printedText, `${id}: blocker text`);
      assert.equal(blocked.get(id).officialPrintedText, null, `${id}: official provenance not claimed`);
      assert.ok(blocked.get(id).blocker.length > 80, `${id}: specific blocker`);
      assert.equal(ability.definition, null, `${id}: no placeholder production definition`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${id}: unsupported effects stay unavailable`);
    }
  }
  assert.deepEqual(contribution.audit.implementedAbilityIds, ["cfa-10089:0", "cfa-10102:0"]);
});

test("eight production definitions remain registered with their exact categories and scope", () => {
  for (const id of contribution.audit.alreadySupportedAbilityIds) {
    const { ability } = parsedById.get(id);
    assert.ok(ability.definition, id);
    if (ability.kind === "AUTO") {
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, id);
      assert.equal(Engine.autoAbilityReadiness(ability).ok, true, id);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    } else if (ability.kind === "ACT") {
      assert.equal(Engine.isManuallyActivatable(ability), true, id);
      assert.equal(ability.requiredLocation.includes("rear-guard"), true, id);
    } else if (ability.id === "cfa-10087:0") {
      assert.equal(Engine.isManuallyActivatable(ability), false, id);
      assert.ok(ability.definition.keywords.includes("sentinel"), id);
    } else {
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, id);
      assert.equal(Engine.isManuallyActivatable(ability), false, id);
      assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
        location: "guardian", controllerVanguardCardNames: ["Youthful Vanguard"]
      }).shield, 5000, `${id}: correct Vanguard and GC`);
      assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
        location: "rear-guard", controllerVanguardCardNames: ["Youthful Vanguard"]
      }).shield, 0, `${id}: wrong circle`);
      assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
        location: "guardian", controllerVanguardCardNames: ["Unrelated Vanguard"]
      }).shield, 0, `${id}: wrong Vanguard name`);
    }
  }
});

test("integrated Rektina ride AUTO matches only its exact ridden source and rider, for either seat", () => {
  for (const side of ["human", "bot"]) {
    const f = rideFixture({ side });
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${side}: exact ride queues once`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownId);
    assert.equal(f.state.pendingAbility.ability.trigger.riderCardNameEquals, "Brilliant Tune, Rektina");
    assert.equal(f.state.pendingAbility.eventContext.gameEvent.type, "card.ridden");
    assert.deepEqual(f.state.pendingAbility.eventContext.gameEvent.targetCardInstanceIds, [f.source.uid]);
    assert.equal(f.state.pendingAbility.eventContext.gameEvent.targetPreviousLocation, "vanguard");
    assert.equal(f.state.pendingAbility.eventContext.gameEvent.targetCurrentLocation, "soul");
    assert.equal(f.state.pendingAbility.ability.canDecline, true);
    assert.deepEqual(f.state.pendingAbility.ability.costs, [], "ride call has no cost");
    assert.equal(Reducer.supportsServerAbilityEffects(f.state.pendingAbility.ability), true);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(f.state.pendingAbility.ability, Engine), true);
    if (side === "bot") {
      const before = JSON.stringify(f.state);
      const forged = answerRide(f, { actorAuthUid: seats.hostAuthUid });
      assert.equal(forged.ok, false, `${side}: opponent cannot resolve`);
      assert.equal(JSON.stringify(f.state), before, `${side}: forged response leaves state unchanged`);
    }
    const result = answerRide(f);
    assert.equal(result.ok, true, `${side}: ${result.reason || "resolved"}`);
    assert.equal(f.own.soul.includes(f.source), false, `${side}: exact source leaves Soul`);
    const called = f.own.rear.find(card => card?.uid === f.source.uid);
    assert.ok(called, `${side}: source is called to controller RC`);
    assert.equal(called.ownerPlayerId, f.ownId);
    assert.equal(called.controllerPlayerId, f.ownId);
    assert.equal(f.opponent.rear.some(card => card?.uid === f.source.uid), false);
  }
});

test("integrated ride AUTO rejects wrong rider, wrong ridden instance, wrong event, and decline", () => {
  for (const f of [
    rideFixture({ riderName: "Unrelated Rider" }),
    rideFixture({ targetUid: "different-old-vanguard" }),
    rideFixture({ eventType: "card.placed" })
  ]) {
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.some(item => item.ability?.id === "cfa-10089:0"), false);
    assert.equal(f.own.soul.includes(f.source), true);
  }
  const wrongController = rideFixture();
  wrongController.event = { ...wrongController.event, sourceControllerPlayerId: "player-guest", subjectControllerPlayerId: "player-guest" };
  assert.equal(Reducer.discoverAutoTriggers(wrongController.state, [wrongController.event], Engine).queued.length, 0,
    "a ride attributed to the other seat cannot trigger this controller's source");
  const declined = rideFixture();
  Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine);
  const result = answerRide(declined, { accept: false });
  assert.equal(result.ok, true);
  assert.equal(declined.own.soul.includes(declined.source), true, "declining preserves the source in Soul");
  assert.equal(declined.own.rear.includes(declined.source), false);
});

test("integrated RC ACT draws for either seat only after its grade, cost, timing, field, and usage checks pass", () => {
  const definition = parsedById.get("cfa-10102:0").ability.definition;
  assert.equal(definition.source.patternId, "act-rc-grade-three-counter-blast-draw-v1");
  assert.equal(definition.activationWindow, "main");
  assert.deepEqual(definition.costs, [{ type: "counter-blast", count: 2 }]);
  assert.deepEqual(definition.usageRestriction, { type: "once-per-turn", scope: "ability-instance", reset: "turn" });
  for (const side of ["human", "bot"]) {
    const f = actFixture({ side });
    const result = activateAct(f);
    assert.equal(result.ok, true, `${side}: ${result.reason || "resolved"}`);
    assert.deepEqual(f.own.damage.map(card => card.faceDown), [true, true], `${side}: pays exactly CB2`);
    assert.deepEqual(f.own.hand.map(card => card.uid), [f.drawn.uid], `${side}: controller draws`);
    assert.equal(f.own.deck.length, 0);
    assert.equal(f.opponent.hand.length, 0);
    assert.equal(f.drawn.ownerPlayerId, f.ownId);
    assert.equal(f.drawn.controllerPlayerId, f.ownId);
    assert.equal(f.source.ownerPlayerId, f.ownId);
    assert.equal(f.source.controllerPlayerId, f.ownId);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(f.ability, Engine), true);
    assert.equal(activateAct(f, { actionId: `second-use-${side}` }).ok, false, `${side}: once per turn`);
    assert.equal(f.own.hand.filter(card => card.uid === f.drawn.uid).length, 1, `${side}: second activation draws nothing`);
  }
});

test("integrated ACT rejects unavailable costs, low Vanguard grade, wrong zone, wrong timing, and opponent control atomically", () => {
  const cases = [
    actFixture({ vanguardGrade: 2 }),
    actFixture({ damageCount: 1 }),
    actFixture({ sourceZone: "vanguard" }),
    actFixture({ phase: 3 })
  ];
  for (const f of cases) {
    const before = JSON.stringify(f.state);
    assert.equal(activateAct(f).ok, false);
    assert.equal(JSON.stringify(f.state), before, "rejected request does not mutate costs or draw");
  }
  const forged = actFixture({ side: "bot" });
  const before = JSON.stringify(forged.state);
  assert.equal(activateAct(forged, { actorAuthUid: seats.hostAuthUid }).ok, false);
  assert.equal(JSON.stringify(forged.state), before, "opponent activation leaves state unchanged");
  const badCost = actFixture();
  const badCostBefore = JSON.stringify(badCost.state);
  assert.equal(activateAct(badCost, { cbUids: [badCost.own.damage[0].uid, "not-controlled-damage"] }).ok, false);
  assert.equal(JSON.stringify(badCost.state), badCostBefore, "invalid cost selection leaves state unchanged");
});
