"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0087.js");
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

function fixture(side = "human", { opponentGrade = 3, addOpponentRear = false, sourceZone = "rear-guard" } = {}) {
  const ownId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const source = instance("cfa-12708", `enmou-${side}`, ownId);
  const ownVanguard = instance("cfa-3", `own-vg-${side}`, ownId);
  const opponentVanguardDefinition = catalog.find(card => Number(card.grade) === opponentGrade && /unit/i.test(String(card.type || "")));
  assert.ok(opponentVanguardDefinition, `catalog has a grade ${opponentGrade} Vanguard`);
  const opponentVanguard = instance(opponentVanguardDefinition.id, `opponent-vg-${side}`, opponentId);
  const own = { playerId: ownId, vanguard: ownVanguard, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: Array(5).fill(null), soul: [], deck: [], hand: [], drop: [], bind: [], damage: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  if (sourceZone === "rear-guard") own.rear[0] = source;
  else if (sourceZone === "vanguard") own.vanguard = source;
  if (addOpponentRear) opponent.rear[0] = instance("cfa-4", `opponent-rg-${side}`, opponentId);
  const state = { matchId: `enmou-${side}-${opponentGrade}-${addOpponentRear}`, stateVersion: 1, turn: 4, side, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: { battleId: `battle-${side}`, attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownId,
      attackerZone: sourceZone, defenderSide: opponentSide, targetUid: opponentVanguard.uid, targetZone: "vanguard",
      power: Number(source.power), targetPower: Number(opponentVanguard.power), targetGrade: opponentGrade, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: ownId, turnPlayerId: ownId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId, sourceControllerPlayerId: ownId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownId, subjectControllerPlayerId: ownId,
    attackingCardInstanceIds: [source.uid], previousLocation: sourceZone, currentLocation: sourceZone,
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId: state.pendingAttack.battleId,
    phase: "battle", timingWindow: "attack-declared" });
  return { state, source, opponentVanguard, ownId, opponentId, opponentSide, side, event, sourceZone };
}

function ability() {
  const card = catalogById.get("cfa-12708");
  return Engine.parseCardAbilitiesCached(card).find(item => item.id === "cfa-12708:1");
}

function resolve(f) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `resolve-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: "cfa-12708:1" } } }, seats, Engine);
}

test("batch 0087 accounts for every assigned ability and records only the official text that was verified", () => {
  const queuedAbilityCounts = new Map();
  for (const batch of require("./ability-work-batches.json").batches) {
    for (const id of batch.abilityIds) queuedAbilityCounts.set(id, (queuedAbilityCounts.get(id) || 0) + 1);
  }
  assert.ok(contribution.abilityIds.every(id => queuedAbilityCounts.get(id) === 1), "historical audit IDs stay tracked exactly once after queue regrouping");
  assert.equal(contribution.abilityIds.length, 39);
  assert.equal(new Set(contribution.abilityIds).size, 39);
  assert.equal(contribution.alreadySupportedAbilityIds.length, 4);
  assert.deepEqual(contribution.implementedAbilityIds, ["cfa-12708:1"]);
  assert.equal(contribution.unsupportedSiblings.length, 34);
  assert.deepEqual(contribution.verifiedOfficialAbilities, ["cfa-12708:1"]);
  for (const item of contribution.unsupportedSiblings) {
    assert.equal(item.officialPrintedText, null, item.abilityId);
    assert.equal(item.officialReference, null, item.abilityId);
    assert.ok(item.blocker.length > 80, item.abilityId);
  }
});

test("Enmou ability uses exact catalog text and only the existing trusted source-attack/battle-power handlers", () => {
  const card = catalogById.get("cfa-12708");
  const parsed = ability();
  const definition = contribution.proposedDefinitions[0];
  assert.equal(card.name, "Stealth Dragon, Enmou");
  assert.equal(parsed.printedText, definition.printedText);
  assert.equal(parsed.id, "cfa-12708:1");
  assert.deepEqual(parsed.requiredLocation, ["rear-guard"]);
  assert.equal(parsed.trigger.eventType, "unit.attacked");
  assert.equal(parsed.trigger.subject, "source");
  assert.deepEqual(parsed.trigger.circles, ["rear-guard"]);
  assert.deepEqual(parsed.conditions, [
    { type: "opponent-vanguard-grade-at-least", count: 3 },
    { type: "opponent-has-no-rear-guards" }
  ]);
  assert.deepEqual(parsed.costs, []);
  assert.equal(parsed.canDecline, false);
  assert.deepEqual(parsed.definition.effects, [{ op: "modify-power", target: "source", amount: 10000, duration: "battle" }]);
  assert.equal(parsed.definition.source.officialCardNumber, "DZ-BT02/020EN");
  assert.equal(parsed.definition.source.officialReference, "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT02%2F020EN");
  assert.deepEqual(contribution.proposedDefinitions, [parsed.definition]);
  assert.equal(contribution.supportedDefinitions.find(item => item.abilityId === parsed.id).officialPrintedText, parsed.printedText);
  assert.equal(contribution.supportedDefinitions.find(item => item.abilityId === parsed.id).officialReference, parsed.definition.source.officialReference);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(parsed, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(parsed), true);
});

test("host and joining player independently resolve Enmou only when both opponent conditions are met", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side);
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}: ${JSON.stringify(discovered.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.ability.id, "cfa-12708:1");
    assert.equal(resolve(f).ok, true);
    assert.equal(f.state.pendingAttack.power, 20000);
    assert.equal(f.state.pendingAttack.attackerUid, f.source.uid);
  }
});

test("grade below 3, any opponent Rear-Guard, a different attacker, and a non-RC source do not qualify", () => {
  for (const options of [{ opponentGrade: 2 }, { addOpponentRear: true }]) {
    const f = fixture("human", options);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  }
  const wrongAttacker = fixture("human");
  const unrelatedEvent = Engine.createGameEvent(wrongAttacker.state, { ...wrongAttacker.event,
    sourceCardInstanceId: "unrelated", cardInstanceId: "unrelated", subjectCardInstanceId: "unrelated",
    attackingCardInstanceIds: ["unrelated"], eventId: undefined, sequence: undefined });
  assert.equal(Reducer.discoverAutoTriggers(wrongAttacker.state, [unrelatedEvent], Engine).queued.length, 0);
  const wrongCircle = fixture("human", { sourceZone: "vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [wrongCircle.event], Engine).queued.length, 0);
});

test("Enmou battle power expires when that battle ends", () => {
  const f = fixture("human");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(resolve(f).ok, true);
  f.state.pendingAttack.defenderDone = true;
  const closed = Reducer.applyGameAction(f.state, { actorAuthUid: seats.hostAuthUid, actionId: "end-enmou-battle",
    expectedStateVersion: f.state.stateVersion, payload: { action: "resolveBattle" } }, seats, Engine);
  assert.equal(closed.ok, true, closed.reason);
  assert.equal(f.state.pendingAttack, null);
  assert.equal(f.source.battlePowerBoost || 0, 0);
  assert.equal(f.source.turnPowerBoost || 0, 0);
});
