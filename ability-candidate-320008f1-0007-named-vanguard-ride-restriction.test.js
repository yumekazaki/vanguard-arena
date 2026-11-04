"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const REVIEWED_DEFINITIONS = require("./ability-definitions.js");

const BATCH_ID = "CANDIDATE-320008F1-0007";
const PATTERN = "cont-ride-from-grade-and-named-vanguard-v1";
const DEFINITIONS = require("./ability-contributions/batch-CANDIDATE-320008F1-0007.js");
const SEATS = {
  hostAuthUid: "auth-host",
  guestAuthUid: "auth-guest",
  hostSide: "human",
  guestSide: "bot"
};
const CASES = [
  { riderId: "cfa-9718", name: "Tao Ren" },
  { riderId: "cfa-10425", name: "Uriel" },
  { riderId: "cfa-10825", name: "Zorga" },
  { riderId: "cfa-10847", name: "Astroea" },
  { riderId: "cfa-10860", name: "Lianorn" },
  { riderId: "cfa-10892", name: "Drajeweled" },
  { riderId: "cfa-11016", name: "Greedon" },
  { riderId: "cfa-11611", name: "Orfist" },
  { riderId: "cfa-11679", name: "Ominagruzio" },
  { riderId: "cfa-11825", name: "Magnolia", vanguardId: "cfa-8223" },
  { riderId: "cfa-11851", name: "Nordlinger" },
  { riderId: "cfa-13003", name: "Luticia" },
  { riderId: "cfa-13490", name: "Solrairon", vanguardId: "cfa-10744" },
  { riderId: "cfa-13625", name: "Gandeeva", vanguardId: "cfa-10821" }
];
const BATCH_CASES = [
  { riderId: "cfa-9718", name: "Tao Ren", vanguardId: "cfa-9227" },
  { riderId: "cfa-11825", name: "Magnolia", vanguardId: "cfa-8223" },
  { riderId: "cfa-13490", name: "Solrairon", vanguardId: "cfa-10744" },
  { riderId: "cfa-13625", name: "Gandeeva", vanguardId: "cfa-10821" }
];
const catalog = loadCatalog();
const byId = new Map(catalog.map(card => [String(card.id), card]));

Engine.registerAbilityDefinitions(REVIEWED_DEFINITIONS);

function cardDefinition(id) {
  const card = byId.get(String(id));
  assert.ok(card, `expected real catalog card ${id}`);
  return card;
}

function instance(definition, uid, playerId, overrides = {}) {
  return {
    uid,
    cardId: String(definition.id),
    cardName: definition.name,
    type: definition.type,
    unitCard: /unit/i.test(String(definition.type || "")),
    grade: Number(definition.grade),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...overrides
  };
}

function makeVanguard(testCase, { grade = 3, matchingName = true, playerId } = {}) {
  if (matchingName && grade === 3 && testCase.vanguardId) return instance(cardDefinition(testCase.vanguardId), `vg-${playerId}`, playerId);
  if (matchingName) {
    return {
      uid: `vg-${playerId}`,
      cardId: `fixture-grade-${grade}-${testCase.name.toLowerCase().replace(/\s+/g, "-")}`,
      cardName: `Test ${testCase.name} Vanguard`,
      type: "Unit",
      unitCard: true,
      grade,
      ownerPlayerId: playerId,
      controllerPlayerId: playerId
    };
  }
  const unrelated = catalog.find(card => Number(card.grade) === 3 && !String(card.name).toLowerCase().includes(testCase.name.toLowerCase()));
  assert.ok(unrelated, `real nonmatching grade 3 Vanguard available for ${testCase.name}`);
  return instance(unrelated, `vg-${playerId}`, playerId);
}

function makeState({ side, testCase, path = "hand", vanguardGrade = 3, matchingName = true }) {
  const actorId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = otherSide === "human" ? "player-host" : "player-guest";
  const riderDefinition = cardDefinition(testCase.riderId);
  const rider = instance(riderDefinition, `rider-${side}-${testCase.riderId}-${path}`, actorId);
  const vanguard = makeVanguard(testCase, { grade: vanguardGrade, matchingName, playerId: actorId });
  const otherVanguard = instance(cardDefinition("cfa-3"), `enemy-vg-${side}`, otherId, { grade: 0 });
  const discard = instance(cardDefinition("cfa-3"), `ride-cost-${side}-${testCase.riderId}`, actorId, { grade: 0 });
  const player = {
    playerId: actorId,
    format: "standard",
    vanguard,
    hand: path === "hand" ? [rider] : [discard],
    rideDeck: path === "ride-deck" ? [rider] : [],
    deck: [],
    damage: [],
    drop: [],
    soul: [],
    bind: [],
    rear: Array(5).fill(null),
    guardCircle: [],
    orders: [],
    gDeck: [],
    gZone: [],
    extra: [],
    crests: [],
    energy: 0
  };
  const opponent = {
    playerId: otherId,
    vanguard: otherVanguard,
    hand: [],
    rideDeck: [],
    deck: [],
    damage: [],
    drop: [],
    soul: [],
    bind: [],
    rear: Array(5).fill(null),
    guardCircle: [],
    orders: [],
    gDeck: [],
    gZone: [],
    extra: [],
    crests: [],
    energy: 0
  };
  const state = {
    matchId: `${BATCH_ID}-${side}-${testCase.riderId}-${path}-${vanguardGrade}-${matchingName}`,
    stateVersion: 0,
    processedActionIds: [],
    processedEventIds: [],
    processedAbilityTriggers: [],
    eventSequence: 0,
    turn: 2,
    side,
    phase: 2,
    firstTurnComplete: true,
    ridePerformed: false,
    pendingAbilities: [],
    players: side === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player }
  };
  return { state, player, rider, discard, actorId };
}

function applyRide(fixture, { actionId, path }) {
  const actorAuthUid = fixture.state.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid;
  const payload = path === "hand"
    ? { action: "ride", cardInstanceId: fixture.rider.uid }
    : { action: "rideDeck", rideDeckCardInstanceId: fixture.rider.uid, discardCardInstanceId: fixture.discard.uid };
  return Reducer.applyGameAction(fixture.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload
  }, SEATS, Engine);
}

test("the batch contribution precisely registers the four official ride-restriction CONTs", () => {
  assert.equal(DEFINITIONS.length, 4);
  assert.equal(DEFINITIONS.batchId, BATCH_ID);
  assert.deepEqual(DEFINITIONS.map(item => item.id).sort(), BATCH_CASES.map(item => `${item.riderId}:0`).sort());
  for (const item of BATCH_CASES) {
    const card = cardDefinition(item.riderId);
    const ability = Engine.parseCardAbilities(card).find(candidate => candidate.id === `${item.riderId}:0`);
    const definition = DEFINITIONS.find(candidate => candidate.id === `${item.riderId}:0`);
    assert.ok(ability, `${item.riderId} parsed from the catalog`);
    assert.equal(ability.kind, "CONT");
    assert.equal(definition.kind, "CONT");
    assert.equal(definition.printedText, ability.printedText);
    assert.equal(definition.source.patternId, PATTERN);
    assert.ok(definition.source.officialCardNumber);
    assert.equal(definition.source.officialReference.startsWith("https://en.cf-vanguard.com/cardlist/"), true);
    assert.deepEqual(definition.continuousRestrictions, [{ type: "ride-from-grade-and-name", grade: 3, name: item.name }]);
    assert.equal(Engine.isManuallyActivatable({ ...ability, definition }), false);
  }
  assert.equal(DEFINITIONS.unsupportedSiblings.length, 10);
  const allCatalogAbilityIds = BATCH_CASES.flatMap(item => Engine.parseCardAbilities(cardDefinition(item.riderId)).map(ability => ability.id));
  assert.equal(new Set(allCatalogAbilityIds).size, 14);
  assert.deepEqual(
    [...new Set([...DEFINITIONS.map(item => item.id), ...DEFINITIONS.unsupportedSiblings.map(item => item.abilityId)])].sort(),
    [...new Set(allCatalogAbilityIds)].sort()
  );
});

test("all catalog abilities in the named-Vanguard ride restriction pattern have production definitions", () => {
  const expectedIds = [
    "cfa-9718:0", "cfa-10425:0", "cfa-10825:0", "cfa-10847:0", "cfa-10860:0", "cfa-10892:0", "cfa-11016:0",
    "cfa-11611:0", "cfa-11679:0", "cfa-11825:0", "cfa-11851:0", "cfa-13003:0", "cfa-13490:0", "cfa-13625:0"
  ];
  const production = REVIEWED_DEFINITIONS.filter(item => item.source?.patternId === PATTERN);
  assert.deepEqual(production.map(item => item.id).sort(), expectedIds.sort());
  for (const definition of production) {
    const card = cardDefinition(definition.cardId);
    const parsed = Engine.parseCardAbilities(card).find(item => item.id === definition.id);
    assert.ok(parsed, `${definition.id} parses from its catalog card`);
    assert.equal(definition.printedText, parsed.printedText, `${definition.id} preserves exact source text`);
    assert.equal(definition.kind, "CONT", `${definition.id} remains continuous`);
    assert.equal(definition.continuousRestrictions?.[0]?.type, "ride-from-grade-and-name");
    assert.equal(definition.continuousRestrictions?.[0]?.grade, 3);
    assert.ok(definition.continuousRestrictions?.[0]?.name);
  }
});

test("normal rides enforce each real rider's exact Grade 3 named-Vanguard restriction for host and joining player", () => {
  for (const side of ["human", "bot"]) for (const item of CASES) {
    const suffix = `${side}-${item.riderId}`;
    const legal = makeState({ side, testCase: item });
    const allowed = applyRide(legal, { actionId: `legal-hand-${suffix}`, path: "hand" });
    assert.equal(allowed.ok, true, `${suffix}: ${allowed.reason}`);
    assert.equal(legal.player.vanguard.uid, legal.rider.uid);
    assert.ok(legal.player.soul.some(card => card.uid === "vg-" + legal.actorId));
    assert.equal(legal.state.ridePerformed, true);

    for (const invalid of [
      { vanguardGrade: 3, matchingName: false, label: "wrong-name" },
      { vanguardGrade: 2, matchingName: true, label: "wrong-grade" }
    ]) {
      const fixture = makeState({ side, testCase: item, vanguardGrade: invalid.vanguardGrade, matchingName: invalid.matchingName });
      const before = structuredClone(fixture.state);
      const rejected = applyRide(fixture, { actionId: `reject-hand-${invalid.label}-${suffix}`, path: "hand" });
      assert.equal(rejected.ok, false, `${suffix}/${invalid.label}`);
      assert.equal(rejected.reason, "ride-restriction", `${suffix}/${invalid.label}`);
      assert.deepEqual(fixture.state, before, `${suffix}/${invalid.label} must not partially mutate state`);
    }
  }
});

test("Ride Deck rides enforce the same restriction atomically for host and joining player", () => {
  for (const side of ["human", "bot"]) for (const item of CASES) {
    const suffix = `${side}-${item.riderId}`;
    const legal = makeState({ side, testCase: item, path: "ride-deck" });
    const allowed = applyRide(legal, { actionId: `legal-ride-deck-${suffix}`, path: "ride-deck" });
    assert.equal(allowed.ok, true, `${suffix}: ${allowed.reason}`);
    assert.equal(legal.player.vanguard.uid, legal.rider.uid);
    assert.equal(legal.player.rideDeck.length, 0);
    assert.ok(legal.player.drop.some(card => card.uid === legal.discard.uid));
    assert.equal(legal.state.ridePerformed, true);

    for (const invalid of [
      { vanguardGrade: 3, matchingName: false, label: "wrong-name" },
      { vanguardGrade: 2, matchingName: true, label: "wrong-grade" }
    ]) {
      const fixture = makeState({ side, testCase: item, path: "ride-deck", vanguardGrade: invalid.vanguardGrade, matchingName: invalid.matchingName });
      const before = structuredClone(fixture.state);
      const rejected = applyRide(fixture, { actionId: `reject-ride-deck-${invalid.label}-${suffix}`, path: "ride-deck" });
      assert.equal(rejected.ok, false, `${suffix}/${invalid.label}`);
      assert.equal(rejected.reason, "ride-restriction", `${suffix}/${invalid.label}`);
      assert.deepEqual(fixture.state, before, `${suffix}/${invalid.label} must not discard the ride cost or mutate state`);
    }
  }
});

test("Ride Deck restriction checks happen before the discard cost is paid", () => {
  for (const side of ["human", "bot"]) for (const item of CASES) {
    const fixture = makeState({ side, testCase: item, path: "ride-deck" });
    fixture.player.hand = [];
    const before = structuredClone(fixture.state);
    const rejected = applyRide(fixture, { actionId: `reject-missing-cost-${side}-${item.riderId}`, path: "ride-deck" });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, "ride-cost-not-in-hand");
    assert.deepEqual(fixture.state, before, "missing discard payment must leave the ride deck, Vanguard, and match state unchanged");
  }
});
