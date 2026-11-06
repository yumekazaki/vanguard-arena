"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0008.js");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const audit = contribution.audit;
const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const parsedById = new Map();
for (const cardId of new Set(audit.abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))) {
  const definition = cardsById.get(cardId);
  assert.ok(definition, `assigned card ${cardId} is in the local catalog`);
  for (const ability of Engine.parseCardAbilitiesCached(definition)) parsedById.set(ability.id, ability);
}

const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const RIDE_PHASE_FAMILY = "auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1";

function card(cardId) {
  const found = cardsById.get(String(cardId));
  assert.ok(found, `catalog card ${cardId} exists`);
  return found;
}

function instance(definition, uid, playerId, overrides = {}) {
  return {
    uid,
    cardId: String(definition.id),
    cardName: definition.name,
    type: definition.type || "Unit",
    grade: Number(definition.grade),
    clan: definition.clan,
    clans: definition.clans,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...overrides
  };
}

function rideFixture(ownerSide, deckOverride = null) {
  const ownerId = ownerSide === "human" ? "host" : "guest";
  const opponentSide = ownerSide === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "host" : "guest";
  const sourceDefinition = card("cfa-11050");
  const sourceAbility = parsedById.get("cfa-11050:1");
  assert.equal(sourceAbility.definition?.source?.patternId, RIDE_PHASE_FAMILY);
  const source = instance(sourceDefinition, `${ownerSide}-rupert`, ownerId);
  const candidate = instance(card("cfa-2"), `${ownerSide}-grade-two-choice`, ownerId, { grade: 2, type: "Unit" });
  const owner = {
    playerId: ownerId,
    vanguard: instance(card("cfa-3"), `${ownerSide}-vanguard`, ownerId, { grade: 1, unitCard: true }),
    rear: [null, null, null, null, null],
    hand: [source], soul: [], drop: [],
    deck: deckOverride || [instance(card("cfa-98"), `${ownerSide}-grade-three-top`, ownerId, { grade: 3 }), candidate],
    damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const opponent = {
    playerId: opponentId,
    vanguard: instance(card("cfa-3"), `${opponentSide}-vanguard`, opponentId, { grade: 3, unitCard: true }),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const state = {
    matchId: "ability-batch-76d8a0b8-0008",
    stateVersion: 5,
    processedActionIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    turn: 2,
    side: ownerSide,
    phase: 2,
    players: ownerSide === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner }
  };
  return { state, owner, opponent, ownerId, ownerSide, source, candidate, ability: sourceAbility };
}

function ridePhaseEvent(fixture) {
  return Engine.createGameEvent(fixture.state, {
    type: "phase.changed",
    actingPlayerId: fixture.ownerId,
    turnPlayerId: fixture.ownerId,
    phase: "ride",
    timingWindow: "phase-start",
    before: { phase: "draw" },
    after: { phase: "ride" }
  });
}

function discoverRide(fixture, event) {
  return Reducer.discoverAutoTriggers(fixture.state, [event || ridePhaseEvent(fixture)], Engine);
}

function resolveRide(fixture, selection = {}, { auth = fixture.ownerSide === "human" ? "auth-host" : "auth-guest", actionId = `resolve-${fixture.ownerSide}` } = {}) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: auth,
    actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: {
      type: "ability-response",
      accept: true,
      selection: {
        instanceUid: fixture.source.uid,
        abilityId: fixture.ability.id,
        costSelections: { cb: [], sb: [], discard: [], reveal: [] },
        ...selection
      }
    }
  }, seats, Engine);
}

test("batch audit exactly matches its registry claim and accounts for every assigned ability", () => {
  const assignment = require("./ability-work-assignments.json").assignments.find(item => item.batchId === audit.batchId);
  const batch = require("./ability-work-batches.json").batches.find(item => item.batchId === audit.batchId);
  assert.ok(assignment, "persistent assignment exists");
  assert.ok(batch, "persistent batch exists");
  assert.deepEqual(assignment.abilityIds, audit.abilityIds);
  assert.deepEqual(batch.abilityIds, audit.abilityIds);
  assert.equal(new Set(audit.abilityIds).size, 39);
  assert.equal(audit.cards.length, 25);
  assert.equal(audit.counts.assigned, 39);
  assert.equal(audit.counts.existingProductionSupport, 5);
  assert.equal(audit.counts.testOnlyProposals, 0);
  assert.equal(audit.counts.concreteBlockers, 34);
  assert.equal(audit.unsupportedSiblings.length, 34);
  assert.equal(audit.supportedDefinitions.length, 5);
  assert.equal(audit.counts.officialTextConfirmedOrErrataCorrected + audit.counts.officialTextNotVerified, 39);
  const allClassified = [...audit.supportedDefinitions, ...audit.unsupportedSiblings];
  const unverifiedOfficialTextIds = allClassified
    .filter(item => ["official-card-text-not-verified", "official-card-text-not-found"].includes(item.officialTextCheck?.status))
    .map(item => item.abilityId).sort();
  assert.deepEqual(unverifiedOfficialTextIds, ["cfa-11048:0", "cfa-11051:0", "cfa-11051:1"]);
  assert.deepEqual(audit.abilityIds.filter(id => !audit.existingProductionSupportIds.includes(id)).sort(),
    audit.unsupportedSiblings.map(item => item.abilityId).sort());
  assert.deepEqual(audit.proposedDefinitions, []);
  assert.deepEqual(audit.wholeCardCompletionClaims, []);
  for (const id of audit.abilityIds) assert.ok(parsedById.has(id), `catalog ability ${id} retains parsed original text`);
});

test("the attack trigger matches only the exact assigned Armed Arms instance", () => {
  const ability = parsedById.get("cfa-11029:0");
  assert.equal(ability.trigger.eventType, "unit.attacked");
  const exactAttack = {
    type: "unit.attacked",
    eventId: "batch-0008-exact-source-attack",
    sourceCardInstanceId: "assigned-armed-arms-instance",
    subjectCardInstanceId: "assigned-armed-arms-instance",
    cardInstanceId: "assigned-armed-arms-instance",
    attackingUnitInstanceId: "assigned-armed-arms-instance",
    actingPlayerId: "guest",
    sourceControllerPlayerId: "guest",
    turnPlayerId: "guest",
    targetCardInstanceIds: ["opponent-vanguard"],
    targetLocation: "vanguard"
  };
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", exactAttack,
    "assigned-armed-arms-instance", "rear-guard", "vanguard", "guest"), true);
  const otherUnitAttacks = { ...exactAttack, sourceCardInstanceId: "different-card", subjectCardInstanceId: "different-card",
    cardInstanceId: "different-card", attackingUnitInstanceId: "different-card" };
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", otherUnitAttacks,
    "assigned-armed-arms-instance", "rear-guard", "vanguard", "guest"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", exactAttack,
    "assigned-armed-arms-instance", "guardian", "vanguard", "guest"), false, "source zone must be legal");
  assert.equal(Engine.autoAbilityReadiness(ability).ok, false, "a matching event alone does not make an unreviewed ability resolvable");
  assert.equal(Reducer.supportsServerAbilityEffects(ability), false, "no authoritative effect program is registered for this ability");
});

test("unsupported assigned AUTO, ACT, and CONT abilities remain unavailable to either seat", () => {
  for (const { abilityId } of audit.unsupportedSiblings) {
    const ability = parsedById.get(abilityId);
    assert.equal(ability.definition, null, `${abilityId} has no production definition`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId} is not server-resolvable`);
    if (ability.kind === "ACT") {
      for (const playerId of ["host", "guest"]) {
        const result = Engine.canActivateManualAbility(ability, {
          cardInstanceId: `source-${abilityId}`,
          controllerPlayerId: playerId,
          actorPlayerId: playerId,
          turnPlayerId: playerId,
          phase: "main",
          inPermittedZone: true,
          conditions: {},
          resources: {}
        });
        assert.equal(result.ok, false, `${abilityId} cannot be manually activated by ${playerId}`);
      }
    }
    if (ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(ability), false, `${abilityId} is continuous, not a manual action`);
  }
});

test("unreviewed Rear-Guard ACT is rejected by the authoritative server without changing state", () => {
  const source = instance(card("cfa-11042"), "unreviewed-rear-guard-source", "host");
  const owner = { playerId: "host", vanguard: instance(card("cfa-98"), "host-grade-three", "host", { grade: 3 }),
    rear: [source, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: "guest", vanguard: instance(card("cfa-98"), "guest-vanguard", "guest", { grade: 3 }),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: "batch-0008-act-rejection", stateVersion: 1, processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [],
    turn: 1, side: "human", phase: 4, players: { human: owner, bot: opponent } };
  const before = JSON.stringify(state);
  const result = Reducer.applyManualAbilityActivation(state, {
    actorAuthUid: "auth-host",
    actionId: "reject-unreviewed-order-act",
    expectedStateVersion: state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: "cfa-11042:1", selection: {} }
  }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unreviewed-or-wrong-ability");
  assert.equal(JSON.stringify(state), before, "invalid activation is atomic");
});

test("trusted Ride Phase ability resolves for host and joiner with owner-only choice, exact discard, legal target, and duplicate rejection", () => {
  for (const ownerSide of ["human", "bot"]) {
    const fixture = rideFixture(ownerSide);
    const event = ridePhaseEvent(fixture);
    assert.equal(discoverRide(fixture, event).queued.length, 1, `${ownerSide} gets its own prompt`);
    assert.equal(fixture.state.pendingAbility.triggerControllerPlayerId, fixture.ownerId);
    assert.equal(discoverRide(fixture, event).queued.length, 0, "same event does not enqueue twice");

    const serialized = JSON.stringify(fixture.state);
    const wrongAuth = ownerSide === "human" ? "auth-guest" : "auth-host";
    assert.equal(resolveRide(fixture, { effectUid: fixture.candidate.uid }, { auth: wrongAuth, actionId: `wrong-seat-${ownerSide}` }).ok, false);
    assert.equal(JSON.stringify(fixture.state), serialized, "opponent cannot resolve the controller's choice");

    const invalidTarget = rideFixture(ownerSide, [instance(card("cfa-98"), `${ownerSide}-grade-three-target`, fixture.ownerId, { grade: 3 })]);
    discoverRide(invalidTarget);
    const invalidBefore = JSON.stringify(invalidTarget.state);
    assert.equal(resolveRide(invalidTarget, { effectUid: invalidTarget.owner.deck[0].uid }, { actionId: `invalid-target-${ownerSide}` }).ok, false);
    assert.equal(JSON.stringify(invalidTarget.state), invalidBefore, "illegal grade target does not partially pay the cost");

    const valid = resolveRide(fixture, { effectUid: fixture.candidate.uid }, { actionId: `valid-owner-choice-${ownerSide}` });
    assert.equal(valid.ok, true, valid.reason);
    assert.equal(fixture.owner.hand.some(item => item.uid === fixture.source.uid), false);
    assert.ok(fixture.owner.drop.some(item => item.uid === fixture.source.uid), "discard cost is paid by the controller");
    assert.ok(fixture.owner.hand.some(item => item.uid === fixture.candidate.uid), "selected legal grade-2 card enters controller hand");
    assert.equal(fixture.opponent.hand.some(item => item.uid === fixture.candidate.uid), false);
    const duplicate = resolveRide(fixture, { effectUid: fixture.candidate.uid }, { actionId: `valid-owner-choice-${ownerSide}` });
    assert.equal(duplicate.ok, false);
  }
});

