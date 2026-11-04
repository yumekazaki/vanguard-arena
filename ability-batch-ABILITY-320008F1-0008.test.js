"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0008.js");

const BATCH_ID = "ABILITY-320008F1-0008";
const expected = [
  "cfa-10201:0", "cfa-10201:1", "cfa-10206:0", "cfa-10206:1", "cfa-1020:0",
  "cfa-10214:0", "cfa-10215:0", "cfa-10216:0", "cfa-10218:0", "cfa-1021:0",
  "cfa-1021:1", "cfa-10220:0", "cfa-10221:0", "cfa-10222:0", "cfa-10223:0",
  "cfa-10224:0", "cfa-10224:1", "cfa-10226:0", "cfa-10227:0", "cfa-10228:0",
  "cfa-10228:1", "cfa-1022:0", "cfa-10230:0", "cfa-10230:1", "cfa-10231:0",
  "cfa-10232:0", "cfa-10234:0", "cfa-10235:0", "cfa-10236:0", "cfa-1023:0",
  "cfa-102:0"
];
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const assignment = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8")).assignments.find(item => item.batchId === BATCH_ID);
const batch = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8")).batches.find(item => item.batchId === BATCH_ID);
const audit = contribution.audit;
const supportedById = new Map(audit.supportedDefinitions.map(item => [item.abilityId, item]));
const unsupportedById = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function parsedAbility(abilityId) {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = catalogById.get(cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `parsed ability ${abilityId} exists`);
  return { card, ability };
}

function emptyPlayer(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), soul: [], drop: [], hand: [], deck: [], damage: [], bind: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
}

function castanetFixture(side = "human", targetClan = "Great Nature") {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const source = { uid: `castanet-${side}`, cardId: "cfa-1020", cardName: "Castanet Donkey", unitCard: true, type: "Unit", grade: 0, clan: "Great Nature", ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-left", turnPowerBoost: 0 };
  const target = { uid: `castanet-target-${side}`, cardId: "fixture-great-nature", cardName: "Great Nature Unit", unitCard: true, type: "Unit", grade: 1, clan: targetClan, ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-right", turnPowerBoost: 0 };
  const players = { human: emptyPlayer("host-player"), bot: emptyPlayer("guest-player") };
  players[side].rear[0] = source;
  players[side].rear[1] = target;
  return {
    state: { matchId: `batch-0008-castanet-${side}`, stateVersion: 1, processedActionIds: [], side, phase: 4, turn: 1, players, pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null },
    source, target, playerId, side, otherSide
  };
}

function activateCastanet(fixture, { actorAuthUid, targetUid = fixture.target.uid, actionId = `castanet-action-${fixture.side}` } = {}) {
  return Reducer.applyManualAbilityActivation(fixture.state, {
    actorAuthUid: actorAuthUid || (fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: fixture.source.uid, abilityId: "cfa-1020:0", selection: targetUid ? { targetUid } : {} }
  }, seats, Engine);
}

function forerunnerFixture(side = "human", { riderClan = "Great Nature", targetUid } = {}) {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const source = { uid: `forerunner-source-${side}`, cardId: "cfa-1021", cardName: "Gardening Mole", type: "Unit", grade: 0, clan: "Great Nature", ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "soul" };
  const rider = { uid: `rider-${side}`, cardId: "fixture-rider", cardName: "Great Nature Rider", type: "Unit", grade: 1, clan: riderClan, ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "vanguard" };
  const players = { human: emptyPlayer("host-player"), bot: emptyPlayer("guest-player") };
  players[side].vanguard = rider;
  players[side].soul.push(source);
  const state = { matchId: `batch-0008-forerunner-${side}`, stateVersion: 1, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, side, phase: 2, turn: 1, players };
  const event = Engine.createGameEvent(state, {
    type: "card.ridden", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: rider.uid, sourceOwnerPlayerId: rider.ownerPlayerId, sourceControllerPlayerId: rider.controllerPlayerId,
    sourceCardClan: rider.clan, sourceCardClans: [rider.clan], cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid,
    subjectOwnerPlayerId: rider.ownerPlayerId, subjectControllerPlayerId: rider.controllerPlayerId,
    previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [targetUid || source.uid],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard", phase: "ride", timingWindow: "normal-ride"
  });
  return { state, source, rider, playerId, side, event };
}

function answerForerunner(fixture, actorAuthUid) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: actorAuthUid || (fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId: `forerunner-response-${fixture.side}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: fixture.source.uid, abilityId: "cfa-1021:0", callZone: "rear-left" } }
  }, seats, Engine);
}

test("batch assignment and audit classify the exact 31 abilities across 25 cards", () => {
  assert.ok(assignment && batch);
  assert.ok((assignment.status === "in-progress" && assignment.workerOwner === "worker-ability-batch-0008") || (assignment.status === "reserved" && assignment.workerOwner === "primary-session"));
  assert.deepEqual(assignment.abilityIds, expected);
  assert.deepEqual(batch.abilityIds, expected);
  assert.equal(batch.cardIds.length, 25);
  assert.equal(batch.workerOwner, assignment.workerOwner);
  assert.deepEqual(audit.abilityIds, expected);
  assert.equal(new Set(audit.abilityIds).size, 31);
  assert.equal(audit.cards.length, 25);
  assert.equal(contribution.length, 0, "audit emits no new production definitions");
  assert.deepEqual(audit.implementedAbilityIds, []);
  assert.equal(audit.officialTextChecked, false);
  assert.equal(supportedById.size, 6);
  assert.equal(unsupportedById.size, 25);
  assert.equal(supportedById.size + unsupportedById.size, expected.length);
});

test("every assigned ability preserves exact catalog text and is supported or has a concrete blocker", () => {
  for (const abilityId of expected) {
    const { card, ability } = parsedAbility(abilityId);
    assert.ok(card.text.includes(ability.printedText), `${abilityId}: complete card text contains the exact ability`);
    const cardRecord = audit.cards.find(item => item.cardId === String(card.id));
    assert.equal(cardRecord?.name, card.name, `${abilityId}: card identity`);
    const record = supportedById.get(abilityId) || unsupportedById.get(abilityId);
    assert.ok(record, `${abilityId}: classified exactly once`);
    assert.equal(record.kind, ability.kind, `${abilityId}: ability type`);
    assert.equal(record.catalogPrintedText, ability.printedText, `${abilityId}: exact printed text`);
    if (supportedById.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId}: has a production definition`);
      assert.equal(record.patternId, ability.definition.source.patternId);
      assert.deepEqual(record.definition, ability.definition);
      if (["AUTO", "ACT"].includes(ability.kind)) {
        assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, `${abilityId}: server-trusted`);
        assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${abilityId}: server effect handler`);
      } else {
        assert.equal(ability.kind, "CONT", `${abilityId}: passive ability`);
        assert.equal(Engine.isManuallyActivatable(ability), false, `${abilityId}: CONT is not manually activated`);
      }
    } else {
      assert.equal(ability.definition, null, `${abilityId}: no placeholder production definition`);
      assert.equal(record.officialPrintedText, null, `${abilityId}: official verification is not falsely claimed`);
      assert.ok(record.blocker.length > 70, `${abilityId}: specific blocker`);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, `${abilityId}: not server-trusted`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId}: unavailable to server resolution`);
    }
  }
  assert.deepEqual([...supportedById.keys()].sort(), ["cfa-10201:0", "cfa-10201:1", "cfa-10206:0", "cfa-10206:1", "cfa-1020:0", "cfa-1021:0"].sort());
  assert.deepEqual(audit.proposedDefinitions, []);
});

test("unsupported AUTO, ACT, and CONT abilities remain unavailable to both seats", () => {
  for (const abilityId of unsupportedById.keys()) {
    const { ability } = parsedAbility(abilityId);
    if (ability.kind === "AUTO") {
      assert.equal(Engine.autoAbilityReadiness(ability).ok, false, `${abilityId}: AUTO does not prompt`);
    } else if (ability.kind === "ACT") {
      for (const playerId of ["host-player", "guest-player"]) {
        const result = Engine.canActivateManualAbility(ability, {
          cardInstanceId: `${abilityId}-${playerId}`, controllerPlayerId: playerId, actorPlayerId: playerId,
          turnPlayerId: playerId, phase: "main", inPermittedZone: true, conditions: {}, resources: {}
        });
        assert.deepEqual(result, { ok: false, reason: "unsupported-effect" }, `${abilityId}: unavailable to ${playerId}`);
      }
    } else if (ability.kind === "CONT") {
      assert.equal(Engine.isManuallyActivatable(ability), false, `${abilityId}: CONT stays passive`);
      assert.deepEqual(Engine.canActivateManualAbility(ability, {}), { ok: false, reason: "not-manual" }, `${abilityId}: no manual action`);
      assert.equal(ability.effects, null, `${abilityId}: no fabricated continuous effect`);
    } else {
      assert.fail(`${abilityId}: unexpected ability kind ${ability.kind}`);
    }
  }
});

test("Castanet Donkey's existing ACT pays its own Soul cost and applies power for both seats", () => {
  const ability = parsedAbility("cfa-1020:0").ability;
  assert.equal(ability.definition.source.patternId, "act-source-to-soul-optional-up-to-one-friendly-power-v1");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
  assert.deepEqual(ability.effects[0].targetFilter, { controller: "source-controller", cardType: "unit", excludeSource: true, clan: "Great Nature" });
  for (const side of ["human", "bot"]) {
    const f = castanetFixture(side);
    const result = activateCastanet(f);
    assert.equal(result.ok, true, `${side}: ${result.reason || "ACT resolves"}`);
    assert.equal(f.state.players[side].rear[0], null, `${side}: exact source leaves RC`);
    assert.equal(f.state.players[side].soul.at(-1).uid, f.source.uid, `${side}: source pays its own cost`);
    assert.equal(f.target.turnPowerBoost, 3000, `${side}: chosen friendly Great Nature gains +3000`);
    assert.equal(f.state.players[f.otherSide].soul.length, 0, `${side}: opponent resources remain untouched`);
  }
  const invalidTarget = castanetFixture("bot", "Kagero");
  const before = JSON.stringify(invalidTarget.state);
  const rejected = activateCastanet(invalidTarget);
  assert.equal(rejected.ok, false, "a non-Great Nature target is illegal");
  assert.equal(JSON.stringify(invalidTarget.state), before, "illegal target cannot pay the source cost");
  const forged = castanetFixture("bot");
  const forgedBefore = JSON.stringify(forged.state);
  assert.equal(activateCastanet(forged, { actorAuthUid: seats.hostAuthUid }).ok, false, "host cannot activate the joining player's ACT");
  assert.equal(JSON.stringify(forged.state), forgedBefore, "forged actor has no partial effect");
});

test("Gardening Mole's existing Forerunner AUTO resolves only from its same-clan ride for either seat", () => {
  const ability = parsedAbility("cfa-1021:0").ability;
  assert.equal(ability.definition.source.patternId, "auto-forerunner-same-clan-ride-call-source-v1");
  assert.equal(ability.trigger.eventType, "card.ridden");
  assert.equal(ability.trigger.subject, "ridden-unit");
  for (const side of ["human", "bot"]) {
    const f = forerunnerFixture(side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, `${side}: matching ride queues exactly one trigger`);
    assert.equal(f.state.pendingAbility.side, side, `${side}: source controller receives the prompt`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${side}: exact Forerunner is the source`);
    const wrongSeat = answerForerunner(f, side === "human" ? seats.guestAuthUid : seats.hostAuthUid);
    assert.equal(wrongSeat.ok, false, `${side}: opponent cannot resolve`);
    const resolved = answerForerunner(f);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || "resolves"}`);
    assert.equal(f.state.players[side].soul.some(card => card.uid === f.source.uid), false);
    assert.equal(f.state.players[side].rear[0].uid, f.source.uid);
    assert.equal(f.state.players[side].rear[0].rested, false);
  }
  const wrongClan = forerunnerFixture("human", { riderClan: "Kagero" });
  assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0, "different-clan ride does not trigger");
  const otherSource = forerunnerFixture("human", { targetUid: "another-ridden-card" });
  assert.equal(Reducer.discoverAutoTriggers(otherSource.state, [otherSource.event], Engine).queued.length, 0, "another ridden instance does not trigger this source");
});
