"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0022.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
Engine.registerAbilityDefinitions(contribution.proposedDefinitions);

function instance(cardId, uid, playerId, overrides = {}) {
  const card = catalogById.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name, type: card?.type || "Unit", grade: Number(card?.grade),
    power: Number(card?.power || 0), unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function fixture(side = "human", sourceOrigin = "bind") {
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const source = instance("cfa-10584", `jakumetsu-${side}`, ownerId);
  const own = { playerId: ownerId, vanguard: instance("cfa-3", `own-vg-${side}`, ownerId), rear: Array(5).fill(null),
    soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: instance("cfa-4", `opponent-vg-${side}`, opponentId), rear: Array(5).fill(null),
    soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  own.rear[0] = source;
  const state = { matchId: `jakumetsu-${side}-${sourceOrigin}`, stateVersion: 1, turn: 2, side, phase: 4,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: sourceOrigin, currentLocation: "rear-left", circle: "rear-left", phase: "main", timingWindow: "effect-card-placement" });
  return { state, source, side, ownerId, opponentId, event, sourceOrigin };
}

function resolve(f) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `resolve-jakumetsu-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-10584:0" } } }, seats, Engine);
}

function findAbility() {
  const card = catalogById.get("cfa-10584");
  return Engine.parseCardAbilitiesCached(card).find(item => item.id === "cfa-10584:0");
}

test("batch 0022 preserves all 40 audit IDs while excluding fully verified abilities from the active queue", () => {
  const batch = require("./ability-work-batches.json").batches.find(item => item.batchId === contribution.batchId);
  const verification = require("./card-verification-manifest.json");
  const fullyVerifiedIds = new Set(verification.records
    .filter(record => record.status === "fully-verified" && record.fullyVerified === true)
    .map(record => record.abilityId));
  const outstandingIds = contribution.abilityIds.filter(id => !fullyVerifiedIds.has(id));
  const verifiedIds = contribution.abilityIds.filter(id => fullyVerifiedIds.has(id));
  assert.ok(batch);
  assert.deepEqual([...outstandingIds].sort(), [...batch.abilityIds].sort());
  assert.deepEqual(verifiedIds.sort(), ["cfa-10586:0", "cfa-10593:0"]);
  assert.equal(contribution.abilityIds.length, 40);
  assert.equal(new Set(contribution.abilityIds).size, 40);
  assert.deepEqual(contribution.alreadySupportedAbilityIds, ["cfa-1058:1", "cfa-1059:0", "cfa-106:0"]);
  assert.deepEqual(contribution.implementedAbilityIds, ["cfa-10584:0", "cfa-10584:1", "cfa-10586:0", "cfa-10593:0"]);
  assert.equal(contribution.unsupportedSiblings.length, 33);
  assert.deepEqual(contribution.verifiedOfficialAbilities, []);
  for (const item of contribution.unsupportedSiblings) {
    assert.equal(item.officialPrintedText, null, item.abilityId);
    assert.equal(item.officialReference, null, item.abilityId);
    assert.ok(item.blocker.length > 75, item.abilityId);
  }
});

test("Jakumetsu Arcs definition preserves its exact bind-to-RC trigger and end-of-turn power effect", () => {
  const card = catalogById.get("cfa-10584");
  const parsed = findAbility();
  const definition = contribution.proposedDefinitions[0];
  assert.equal(card.name, "Stealth Dragon, Jakumetsu Arcs");
  assert.equal(parsed.printedText, definition.printedText);
  assert.equal(parsed.id, "cfa-10584:0");
  assert.deepEqual(parsed.requiredLocation, ["rear-guard"]);
  assert.equal(parsed.trigger.eventType, "card.placed");
  assert.equal(parsed.trigger.subject, "source");
  assert.deepEqual(parsed.trigger.circles, ["rear-guard"]);
  assert.equal(parsed.trigger.sourceLocation, "bind");
  assert.deepEqual(parsed.costs, []);
  assert.equal(parsed.canDecline, false);
  assert.deepEqual(parsed.definition.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }]);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(parsed, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(parsed), true);
});

test("either online player can resolve the exact source's Bind Zone call AUTO", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.ability.id, "cfa-10584:0");
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.source.turnPowerBoost, 5000);
    assert.equal(f.source.battlePowerBoost || 0, 0);
  }
});

test("wrong prior zone, circle, unrelated source, and wrong controller cannot trigger it", () => {
  for (const origin of ["hand", "deck", "drop", "soul"]) {
    const f = fixture("human", origin);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, origin);
  }
  const wrongController = fixture("human");
  wrongController.source.controllerPlayerId = wrongController.opponentId;
  assert.equal(Reducer.discoverAutoTriggers(wrongController.state, [wrongController.event], Engine).queued.length, 0);
  const unrelated = fixture("human");
  const wrongSourceEvent = Engine.createGameEvent(unrelated.state, { ...unrelated.event, sourceCardInstanceId: "unrelated",
    cardInstanceId: "unrelated", subjectCardInstanceId: "unrelated", eventId: undefined, sequence: undefined });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [wrongSourceEvent], Engine).queued.length, 0);
  const wrongCircle = fixture("human");
  const wrongCircleEvent = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, currentLocation: "vanguard",
    circle: "vanguard", eventId: undefined, sequence: undefined });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircleEvent], Engine).queued.length, 0);
});
