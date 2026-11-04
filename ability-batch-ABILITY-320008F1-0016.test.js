"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0016.js");

const expected = [
  "cfa-10410:0", "cfa-10410:1", "cfa-10411:0", "cfa-10411:1", "cfa-10411:2",
  "cfa-10411:3", "cfa-10412:0", "cfa-10412:1", "cfa-10413:0", "cfa-10413:1",
  "cfa-10414:0", "cfa-10414:1", "cfa-10415:0", "cfa-10415:1", "cfa-10416:0",
  "cfa-10416:1", "cfa-10417:0", "cfa-10417:1", "cfa-10418:0", "cfa-10419:0",
  "cfa-10420:0", "cfa-10421:0", "cfa-10422:0", "cfa-10423:0", "cfa-10423:1",
  "cfa-10424:0", "cfa-10425:0", "cfa-10425:1", "cfa-10425:2", "cfa-10426:0",
  "cfa-10426:1", "cfa-10427:0", "cfa-10428:0", "cfa-10429:0", "cfa-1042:0",
  "cfa-10430:0", "cfa-10430:1", "cfa-10431:0", "cfa-10432:0", "cfa-10432:1",
  "cfa-1043:0", "cfa-1043:1"
];
const supportedIds = ["cfa-10411:0", "cfa-10425:0", "cfa-10432:0", "cfa-1043:0"];
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const abilities = new Map();
for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
  abilities.set(ability.id, { card, ability });
}
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalogById.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: definition?.name, type: definition?.type,
    grade: definition?.grade, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function orderDrawFixture(side = "human") {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const otherPlayerId = otherSide === "human" ? "host-player" : "guest-player";
  const source = card("cfa-10411", `twisted-severences-${side}`, playerId, { zone: "order", circle: "order" });
  const drawn = card("cfa-2", `drawn-${side}`, playerId);
  const emptyPlayer = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [],
    drop: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: emptyPlayer("host-player"), bot: emptyPlayer("guest-player") };
  players[side].orders = [source];
  players[side].deck = [drawn];
  players[otherSide].vanguard = card("cfa-3", `opponent-vg-${side}`, otherPlayerId, { zone: "vanguard", circle: "vanguard" });
  const state = { matchId: `batch-0016-order-draw-${side}`, stateVersion: 1, turn: 2, phase: "main", side,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [],
    pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId,
    subjectControllerPlayerId: playerId, previousLocation: "hand", currentLocation: "order", circle: "order",
    phase: "main", timingWindow: "order-zone-placement"
  });
  return { state, source, drawn, side, playerId, event };
}

test("batch 0016 accounts for the exact 42 reserved abilities on 25 cards", () => {
  const assignment = JSON.parse(fs.readFileSync("ability-work-assignments.json", "utf8"))
    .assignments.find(item => item.batchId === "ABILITY-320008F1-0016");
  const batch = JSON.parse(fs.readFileSync("ability-work-batches.json", "utf8"))
    .batches.find(item => item.batchId === "ABILITY-320008F1-0016");
  assert.ok(assignment && batch);
  assert.ok(["in-progress", "reserved"].includes(assignment.status));
  assert.equal(assignment.status, batch.status);
  assert.equal(assignment.workerOwner, assignment.status === "in-progress" ? "worker-ability-0016" : "primary-review");
  assert.deepEqual(assignment.abilityIds, expected);
  assert.deepEqual(batch.abilityIds, expected);
  assert.equal(batch.cardIds.length, 25);
  assert.equal(contribution.audit.batchId, "ABILITY-320008F1-0016");
  assert.deepEqual(contribution.audit.abilityIds, expected);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, supportedIds);
  assert.deepEqual(contribution.audit.proposedDefinitionIds, []);
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.equal(contribution.audit.cards.length, 25);
  assert.equal(contribution.audit.unsupportedSiblings.length, 38);
  assert.equal(contribution.length, 0);
});

test("all 42 IDs retain their exact parsed catalog text and are either trusted or concretely blocked", () => {
  const supported = new Set(contribution.audit.alreadySupportedAbilityIds);
  const blockers = new Map(contribution.audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(supported.size + blockers.size, expected.length);
  for (const abilityId of expected) {
    const found = abilities.get(abilityId);
    assert.ok(found, `${abilityId} parses from its assigned card`);
    assert.ok(found.card.text.includes(found.ability.printedText), `${abilityId} printed text is preserved`);
    assert.equal(found.ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    if (supported.has(abilityId)) {
      assert.ok(found.ability.definition, `${abilityId} has a definition`);
      assert.equal(Engine.getReviewedAbilityDefinitionsForCard(found.ability.cardId).some(item => item.id === abilityId), true);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(found.ability, Engine), true, `${abilityId} is trusted`);
      if (found.ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(found.ability), false, `${abilityId} is continuous, not manually activated`);
      continue;
    }
    const blocked = blockers.get(abilityId);
    assert.ok(blocked, `${abilityId} has an explicit blocker`);
    assert.equal(blocked.kind, found.ability.kind);
    assert.equal(blocked.catalogPrintedText, found.ability.printedText);
    assert.ok(blocked.blocker.length >= 80, `${abilityId} names its unsupported mechanics`);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(found.ability, Engine), false, `${abilityId} is not trusted`);
    assert.equal(Reducer.supportsServerAbilityEffects(found.ability), false, `${abilityId} cannot resolve as a production effect`);
    if (found.ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(found.ability, {}).ok, false, `${abilityId} fails closed as ACT`);
    if (found.ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(found.ability), false, `${abilityId} is not treated as ACT`);
  }
});

test("the four existing production definitions are exact and official checks are traceable", () => {
  const expectedPatterns = {
    "cfa-10411:0": "auto-order-zone-placement-draw-v1",
    "cfa-10425:0": "cont-ride-from-grade-and-named-vanguard-v1",
    "cfa-10432:0": "cont-rc-controlled-rearguard-named-unit-power-v1",
    "cfa-1043:0": "auto-forerunner-same-clan-ride-call-source-v1"
  };
  for (const [abilityId, patternId] of Object.entries(expectedPatterns)) {
    const ability = abilities.get(abilityId).ability;
    assert.equal(ability.definition.source.patternId, patternId, abilityId);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, abilityId);
  }
  assert.equal(contribution.audit.officialTextChecked, true);
  assert.deepEqual([...contribution.audit.officiallyCheckedAbilityIds].sort(), [
    "cfa-10410:0", "cfa-10410:1", "cfa-1043:0", "cfa-1043:1"
  ]);
  for (const abilityId of contribution.audit.officiallyCheckedAbilityIds) {
    const row = contribution.audit.unsupportedSiblings.find(item => item.abilityId === abilityId) ||
      contribution.audit.supportedProductionDefinitions.find(item => item.abilityId === abilityId);
    assert.ok(row, abilityId);
    assert.match(row.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
    assert.ok(row.officialPrintedText);
    assert.ok(row.officialCardNumber);
  }
});

test("Twisted Severences draws for its owner from an exact Order Zone placement on both seats", () => {
  for (const side of ["human", "bot"]) {
    const f = orderDrawFixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side, `${side} owns the prompt`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${side} exact source instance`);
    const actorAuthUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid, actionId: `batch-0016-draw-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-10411:0" } }
    }, seats, Engine);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.deepEqual(f.state.players[side].hand.map(item => item.uid), [f.drawn.uid]);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.length, 0);
  }
});

test("Twisted Severences rejects a wrong source, wrong zone, wrong placement origin, or opponent resolution", () => {
  for (const change of [
    { sourceCardInstanceId: "other-copy", subjectCardInstanceId: "other-copy", cardInstanceId: "other-copy" },
    { previousLocation: "order" },
    { currentLocation: "rear-left", circle: "rear-left" }
  ]) {
    const f = orderDrawFixture("bot");
    const invalid = Object.freeze({ ...f.event, ...change, eventId: `${f.event.eventId}-${Object.keys(change)[0]}` });
    assert.equal(Reducer.discoverAutoTriggers(f.state, [invalid], Engine).queued.length, 0, JSON.stringify(change));
  }
  const f = orderDrawFixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const denied = Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "host-cannot-resolve-guest-order-draw",
    expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-10411:0" } }
  }, seats, Engine);
  assert.equal(denied.ok, false);
  assert.equal(f.state.players.bot.hand.length, 0);
});
