"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const batch = require("./ability-contributions/batch-ABILITY-76D8A0B8-0020.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const QUICK_SHIELD_PATTERN = "auto-rode-upon-draw-quick-shield-v1";
const QUICK_SHIELD_TEXT = "AUTO: When rode upon, draw a card. Then, if your opponent’s vanguard is grade 1 or greater, put a Quick Shield ticket into your hand.";
const EXPECTED_IDS = [
  "cfa-11405:0", "cfa-11405:1", "cfa-11410:0", "cfa-11410:1", "cfa-11411:0",
  "cfa-11413:0", "cfa-11413:1", "cfa-11414:0", "cfa-11414:1", "cfa-11416:0",
  "cfa-11417:0", "cfa-11418:0", "cfa-11419:0", "cfa-1141:0", "cfa-11421:0",
  "cfa-11421:1", "cfa-11426:0", "cfa-11426:1", "cfa-11427:0", "cfa-11428:0",
  "cfa-11428:1", "cfa-11429:0", "cfa-11429:1", "cfa-11430:0", "cfa-11430:1",
  "cfa-11431:0", "cfa-11432:0", "cfa-11433:0", "cfa-11433:1", "cfa-11434:0",
  "cfa-11435:0", "cfa-11435:1", "cfa-11436:0", "cfa-11436:1", "cfa-11437:0",
  "cfa-11438:0", "cfa-1143:0", "cfa-1143:1"
];
const SUPPORTED = [
  "cfa-11405:0", "cfa-11405:1", "cfa-11410:0", "cfa-11410:1", "cfa-1141:0",
  "cfa-11421:0", "cfa-11421:1", "cfa-1143:0"
];
const BLOCKED = EXPECTED_IDS.filter(id => !SUPPORTED.includes(id));

function abilityFor(id) {
  const cardId = id.slice(0, id.lastIndexOf(":"));
  const card = cards.get(cardId);
  assert.ok(card, `catalog contains card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `parser retains exact ability ID ${id}`);
  return { card, ability };
}

function cardInstance(cardId, uid, playerId, extra = {}) {
  const definition = cards.get(String(cardId));
  assert.ok(definition, `card ${cardId} exists`);
  return {
    uid,
    cardId: String(cardId),
    cardName: definition.name,
    type: definition.type || "Unit",
    grade: Number(definition.grade || 0),
    power: Number(definition.power || 0),
    shield: Number(definition.shield || 0),
    clan: definition.clan,
    clans: definition.clans || (definition.clan ? [definition.clan] : []),
    unitCard: true,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...extra
  };
}

function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], damage: [], drop: [], bind: [], orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], quickShields: 0 };
}

function rideFixture({ side = "human", sourceCardId = "cfa-5673", opponentGrade = 1, eventType = "card.ridden", targetUid } = {}) {
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const oldVanguard = cardInstance(sourceCardId, `old-vanguard-${side}`, ownerId, { zone: "soul", circle: "soul" });
  const rider = cardInstance("cfa-3", `new-rider-${side}`, ownerId, { zone: "vanguard", circle: "vanguard", grade: 1 });
  const opponentVanguard = cardInstance("cfa-3", `opponent-vanguard-${side}`, opponentId, { zone: "vanguard", circle: "vanguard", grade: opponentGrade });
  const own = player(ownerId), opponent = player(opponentId);
  own.vanguard = rider;
  own.soul = [oldVanguard];
  own.deck = [cardInstance("cfa-4", `deck-lower-${side}`, ownerId), cardInstance("cfa-3", `deck-draw-${side}`, ownerId)];
  opponent.vanguard = opponentVanguard;
  const state = {
    matchId: `batch20-ride-${side}-${sourceCardId}`,
    stateVersion: 1,
    eventSequence: 0,
    turn: 3,
    phase: 2,
    side,
    processedEventIds: [],
    processedAbilityTriggers: [],
    processedActionIds: [],
    pendingAbilities: [],
    pendingAbility: null,
    pendingAttack: null,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own }
  };
  const event = Engine.createGameEvent(state, {
    type: eventType,
    actingPlayerId: ownerId,
    turnPlayerId: ownerId,
    sourceCardInstanceId: rider.uid,
    sourceOwnerPlayerId: ownerId,
    sourceControllerPlayerId: ownerId,
    subjectCardInstanceId: rider.uid,
    subjectOwnerPlayerId: ownerId,
    subjectControllerPlayerId: ownerId,
    previousLocation: "hand",
    currentLocation: "vanguard",
    circle: "vanguard",
    targetCardInstanceIds: [targetUid || oldVanguard.uid],
    targetOwnerPlayerId: ownerId,
    targetControllerPlayerId: ownerId,
    targetPreviousLocation: "vanguard",
    targetCurrentLocation: "soul",
    targetLocation: "vanguard",
    phase: "ride",
    timingWindow: "normal-ride"
  });
  return { state, event, side, ownerId, opponentId, opponentSide, own, opponent, oldVanguard, rider };
}

function answerRide(fixture, abilityId, authUid) {
  const pending = fixture.state.pendingAbility;
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid: authUid || (fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId: `batch20-resolve-${fixture.side}-${abilityId}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true,
      selection: { instanceUid: pending.instance.uid, abilityId } }
  }, seats, Engine);
}

test("batch accounts for all 38 assigned IDs and preserves exact catalog ability text", () => {
  assert.equal(batch.audit.batchId, "ABILITY-76D8A0B8-0020");
  assert.deepEqual(batch.audit.auditedAbilityIds, EXPECTED_IDS);
  assert.equal(new Set(batch.audit.auditedAbilityIds).size, 38);
  assert.deepEqual(batch.audit.alreadySupportedAbilityIds, SUPPORTED);
  assert.equal(batch.audit.proposedDefinitionIds.length, 0);
  assert.equal(batch.audit.blocked.length, 30);
  assert.deepEqual(batch.audit.blocked.map(item => item.abilityId).sort(), [...BLOCKED].sort());
  for (const id of EXPECTED_IDS) {
    const { card, ability } = abilityFor(id);
    assert.ok(card.text.includes(ability.printedText), `${id}: original catalog text is unchanged`);
  }
});

test("eight existing abilities retain their reviewed type and exact reusable pattern", () => {
  for (const id of ["cfa-11405:0", "cfa-11410:0", "cfa-11421:0"]) {
    const { ability } = abilityFor(id);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.definition?.source?.patternId, "cont-sentinel-keyword-v1");
    assert.equal(Engine.isManuallyActivatable(ability), false, `${id}: Sentinel is passive, not an ACT`);
    assert.deepEqual(ability.definition.keywords, ["sentinel"]);
  }
  for (const id of ["cfa-11405:1", "cfa-11410:1", "cfa-11421:1"]) {
    const { ability } = abilityFor(id);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.definition?.source?.patternId, "auto-gc-when-placed-discard-protect-unit-v1");
    assert.deepEqual(ability.requiredLocation, ["guardian"]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
  const callaway = abilityFor("cfa-1141:0").ability;
  assert.equal(callaway.definition?.source?.patternId, "auto-own-attack-hit-counter-blast-draw-v1");
  assert.equal(callaway.trigger.eventType, "attack.hit");
  assert.equal(callaway.trigger.subject, "source");
  assert.deepEqual(callaway.requiredLocation, ["vanguard", "rear-guard"]);
  assert.deepEqual(callaway.costs, [{ type: "counter-blast", count: 2 }]);
  assert.equal(callaway.canDecline, true);
  assert.equal(Reducer.supportsServerAbilityEffects(callaway), true);
  const artemis = abilityFor("cfa-1143:0").ability;
  assert.equal(artemis.definition?.source?.patternId, "cont-named-soul-card-power-v1");
  assert.equal(artemis.kind, "CONT");
  assert.equal(Engine.isManuallyActivatable(artemis), false);
});

test("the Artemis CONT reads only its controller's Soul and only on the Vanguard Circle", () => {
  const ability = abilityFor("cfa-1143:0").ability;
  for (const side of ["host", "joining-player"]) {
    const power = (location, ownSoulNames) => Engine.evaluateContinuousEffects([ability], {
      location,
      sourceLocation: location,
      sourceInstanceId: `artemis-${side}`,
      targetInstanceId: `artemis-${side}`,
      soulCardNames: ownSoulNames
    }).power;
    assert.equal(power("vanguard", ["Star Shooting Bow, Artemis"]), 1000, `${side}: own named Soul qualifies`);
    assert.equal(power("vanguard", []), 0, `${side}: absent from own Soul does not qualify`);
    assert.equal(power("vanguard", ["Different Artemis"]), 0, `${side}: similar name does not qualify`);
    assert.equal(power("rear-guard", ["Star Shooting Bow, Artemis"]), 0, `${side}: wrong circle does not qualify`);
  }
});

test("the existing Quick Shield ride family matches the exact ridden Vanguard and resolves only for its controller", () => {
  const { ability } = abilityFor("cfa-5673:0");
  assert.equal(ability.definition?.source?.patternId, QUICK_SHIELD_PATTERN);
  assert.equal(ability.printedText, QUICK_SHIELD_TEXT);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  for (const side of ["human", "bot"]) {
    const fixture = rideFixture({ side, sourceCardId: "cfa-5673", opponentGrade: 1 });
    const discovery = Reducer.discoverAutoTriggers(fixture.state, [fixture.event], Engine);
    assert.equal(discovery.queued.length, 1, `${side}: exact card.ridden event queues the ability`);
    assert.equal(fixture.state.pendingAbility.side, side, `${side}: prompt is private to the source controller`);
    assert.equal(fixture.state.pendingAbility.instance.uid, fixture.oldVanguard.uid, `${side}: prior Vanguard owns the ability`);
    assert.equal(fixture.state.pendingAbility.eventContext.gameEvent.subjectCardInstanceId, fixture.rider.uid, `${side}: rider is event subject`);
    assert.deepEqual(fixture.state.pendingAbility.eventContext.gameEvent.targetCardInstanceIds, [fixture.oldVanguard.uid], `${side}: exact ridden instance is target`);
    const wrongAuth = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const before = JSON.stringify(fixture.state);
    assert.equal(answerRide(fixture, ability.id, wrongAuth).ok, false, `${side}: opponent cannot resolve`);
    assert.equal(JSON.stringify(fixture.state), before, `${side}: forged response makes no changes`);
    assert.equal(Reducer.discoverAutoTriggers(fixture.state, [fixture.event], Engine).queued.length, 0, `${side}: duplicate ride event is not queued twice`);
    const resolved = answerRide(fixture, ability.id);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || ""}`);
    assert.equal(fixture.own.deck.length, 1);
    assert.ok(fixture.own.hand.some(card => card.uid === `deck-draw-${side}`), `${side}: controller draws`);
    const ticket = fixture.own.hand.find(card => card.cardId === "token-quick-shield");
    assert.ok(ticket, `${side}: qualifying opponent Vanguard creates Quick Shield`);
    assert.equal(ticket.ownerPlayerId, fixture.ownerId);
    assert.equal(ticket.controllerPlayerId, fixture.ownerId);
    assert.equal(fixture.opponent.hand.length, 0, `${side}: opponent receives no private effect result`);
    assert.deepEqual(resolved.events.map(event => event.type), ["card.drawn", "card.created"]);
  }
});

test("the ride family rejects another target, a call/placement, and the catalog Quick Shield text mismatch", () => {
  const wrongTarget = rideFixture({ side: "human", sourceCardId: "cfa-5673", targetUid: "unrelated-instance" });
  assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine).queued.length, 0);
  const placement = rideFixture({ side: "bot", sourceCardId: "cfa-5673", eventType: "card.placed" });
  assert.equal(Reducer.discoverAutoTriggers(placement.state, [placement.event], Engine).queued.length, 0);

  const local = abilityFor("cfa-11437:0").ability;
  assert.equal(local.definition, null, "the exact local variant is not currently compiled");
  assert.match(local.printedText, /^AUTO: When this unit is rode upon,/);
  assert.notEqual(local.printedText, QUICK_SHIELD_TEXT, "preserve the actual catalog text");
  const candidate = {
    id: local.id,
    cardId: local.cardId,
    kind: "AUTO",
    printedText: local.printedText,
    source: { dataset: "Cardfight Area snapshot", patternId: QUICK_SHIELD_PATTERN },
    requiredLocation: ["vanguard"],
    trigger: { status: "recognized-trigger", eventType: "card.ridden", subject: "event-target", circles: ["vanguard"] },
    effects: [
      { op: "draw", count: 1 },
      { op: "create-token", target: "controller", tokenId: "token-quick-shield", count: 1,
        condition: { op: "opponent-vanguard-grade-at-least", grade: 1 } }
    ]
  };
  const candidateAbility = {
    ...local,
    kind: "AUTO",
    definition: candidate,
    requiredLocation: candidate.requiredLocation,
    trigger: candidate.trigger,
    effects: candidate.effects,
    costs: [],
    conditions: []
  };
  assert.equal(Reducer.supportsServerAbilityEffects(candidateAbility), false,
    "the exact server validator rejects the near-match rather than trusting guessed equivalence");

  for (const side of ["human", "bot"]) {
    const unsupportedRide = rideFixture({ side, sourceCardId: "cfa-11437", opponentGrade: 1 });
    assert.equal(Reducer.discoverAutoTriggers(unsupportedRide.state, [unsupportedRide.event], Engine).queued.length, 0,
      `${side}: unsupported exact text fails closed`);
    assert.equal(unsupportedRide.state.pendingAbility, null);
    assert.equal(unsupportedRide.own.hand.length, 0);
    assert.equal(unsupportedRide.own.deck.length, 2);
  }
});

test("all 30 unsupported abilities remain uncompiled and fail closed", () => {
  assert.equal(BLOCKED.length, 30);
  for (const id of BLOCKED) {
    const { ability } = abilityFor(id);
    assert.equal(ability.definition, null, `${id}: no unreviewed executable definition`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${id}: resolver refuses unsupported effect`);
    const blocker = batch.audit.blocked.find(row => row.abilityId === id);
    assert.ok(blocker && blocker.blocker.length >= 80, `${id}: concrete blocker recorded`);
  }
});
