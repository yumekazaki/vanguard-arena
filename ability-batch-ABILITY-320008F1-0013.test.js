"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0013.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_ID = "ABILITY-320008F1-0013";
const CARD_ID = "cfa-10343";
const ABILITY_ID = `${CARD_ID}:0`;
const cards = loadCatalog();
const card = cards.find(item => String(item.id) === CARD_ID);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function setup(side = "human") {
  const ownerId = side === "bot" ? "player-guest" : "player-host";
  const enemyId = side === "bot" ? "player-host" : "player-guest";
  const source = { uid: `attacker-${side}`, cardId: CARD_ID, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, type: "Normal Unit", zone: "rear-guard", circle: "rear-left", grade: 2, turnPowerBoost: 0 };
  const ally = { uid: `ally-${side}`, cardId: "test-ally", ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, type: "Normal Unit", zone: "rear-guard", circle: "rear-right", grade: 1, turnPowerBoost: 0 };
  const enemyRear = { uid: `enemy-rear-${side}`, cardId: "test-enemy", ownerPlayerId: enemyId, controllerPlayerId: enemyId, unitCard: true, type: "Normal Unit", zone: "rear-guard", circle: "rear-left", grade: 1, turnPowerBoost: 0 };
  const own = { playerId: ownerId, vanguard: { uid: `own-vg-${side}`, cardId: "test-own-vg", ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, type: "Normal Unit", grade: 3 }, rear: [source, ally], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], guardCircle: [], orders: [], gZone: [] };
  const opponent = { playerId: enemyId, vanguard: { uid: `opp-vg-${side}`, cardId: "test-opp-vg", ownerPlayerId: enemyId, controllerPlayerId: enemyId, unitCard: true, type: "Normal Unit", grade: 3 }, rear: [enemyRear], hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], guardCircle: [], orders: [], gZone: [] };
  const state = { matchId: `ferocious-hunter-${side}`, stateVersion: 3, eventSequence: 0, processedAbilityTriggers: [], processedEventIds: [], processedActionIds: [], side, turn: 4, phase: 5, players: side === "bot" ? { human: opponent, bot: own } : { human: own, bot: opponent }, pendingAbility: null, pendingAbilities: [], pendingTrigger: null };
  const battleId = `battle-${side}`;
  state.pendingAttack = { battleId, attackerSide: side, attackerPlayerId: ownerId, attackerUid: source.uid, attackerZone: "rear-left", defenderSide: side === "bot" ? "human" : "bot", defenderPlayerId: enemyId, targetUid: opponent.vanguard.uid, targetZone: "vanguard", power: 18000, targetPower: 13000, critical: 1 };
  const hit = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, subjectCardInstanceId: opponent.vanguard.uid, subjectOwnerPlayerId: enemyId, subjectControllerPlayerId: enemyId, attackingUnitInstanceId: source.uid, attackingCardInstanceIds: [source.uid], targetCardInstanceIds: [opponent.vanguard.uid], targetLocation: "vanguard", battleId, phase: "battle", timingWindow: "attack-hit" });
  return { state, source, ally, enemyRear, opponent, hit, side, ownerId };
}

test("integrated definition accounts for the batch without promoting blocked siblings", () => {
  const assignment = require("./ability-work-assignments.json").assignments.find(item => item.batchId === BATCH_ID);
  assert.ok(assignment, "the parent session must retain this batch reservation");
  assert.deepEqual(contribution.audit.abilityIds.slice().sort(), [...assignment.abilityIds, ...(assignment.verifiedAbilityIds || [])].sort());
  assert.deepEqual(contribution.audit.proposedDefinitionIds, []);
  assert.deepEqual(contribution.audit.originallyProposedDefinitionIds, [ABILITY_ID]);
  assert.deepEqual(contribution.audit.implementedAbilityIds, [ABILITY_ID]);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds.slice().sort(), ["cfa-10348:0", "cfa-1034:0", "cfa-10360:0"].sort());
  assert.equal(contribution.audit.blockedAbilityIds.length, 26);
  assert.equal(contribution.audit.officialTextChecked, false);
  assert.equal(contribution.length, 1);
  assert.deepEqual(contribution.unsupportedSiblings.map(item => item.abilityId).sort(), contribution.audit.blockedAbilityIds.slice().sort());
});

test("Ferocious Hunter is the exact source-owned Rear-Guard attack-hit AUTO", () => {
  assert.ok(card, "Ferocious Hunter must exist in the assigned catalog snapshot");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === ABILITY_ID);
  assert.ok(ability);
  assert.equal(ability.printedText, contribution[0].printedText);
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "attack.hit", subject: "source", targetLocation: "vanguard", circles: [] });
  assert.deepEqual(ability.definition.effects[0].targetFilter, { controller: "source-controller", cardType: "unit", zone: "rear-guard" });
  assert.equal(ability.choiceStatus, "modeled");
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("host and joining player each get and resolve only their own source's exact hit prompt", () => {
  for (const side of ["human", "bot"]) {
    const fixture = setup(side);
    const discovered = Reducer.discoverAutoTriggers(fixture.state, [fixture.hit], Engine);
    assert.equal(discovered.queued.length, 1, side);
    assert.equal(fixture.state.pendingAbility.side, side);
    assert.equal(fixture.state.pendingAbility.instance.uid, fixture.source.uid);
    assert.equal(fixture.state.pendingAbility.triggerControllerPlayerId, fixture.ownerId);
    const authUid = side === "bot" ? seats.guestAuthUid : seats.hostAuthUid;
    const result = Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: authUid, actionId: `resolve-${side}`, expectedStateVersion: fixture.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid, abilityId: ABILITY_ID, targetUid: fixture.ally.uid, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(fixture.ally.turnPowerBoost, 5000);
    assert.equal(fixture.ally.turnPowerExpiry, fixture.ownerId);
    assert.equal(fixture.source.turnPowerBoost || 0, 0);
    assert.equal(fixture.enemyRear.turnPowerBoost || 0, 0);
  }
});

test("another card's attack and a hit to a Rear-Guard cannot trigger Ferocious Hunter", () => {
  const fixture = setup("bot");
  const other = { uid: "other-attacker", cardId: "test-other", ownerPlayerId: fixture.ownerId, controllerPlayerId: fixture.ownerId, unitCard: true, type: "Normal Unit", zone: "rear-guard", circle: "rear-right", grade: 1 };
  fixture.state.players.bot.rear.push(other);
  fixture.state.pendingAttack = { ...fixture.state.pendingAttack, attackerUid: other.uid, attackerZone: "rear-right", battleId: "other-source-battle" };
  const otherHit = Engine.createGameEvent(fixture.state, { type: "attack.hit", actingPlayerId: fixture.ownerId, turnPlayerId: fixture.ownerId, sourceCardInstanceId: other.uid, sourceOwnerPlayerId: fixture.ownerId, sourceControllerPlayerId: fixture.ownerId, subjectCardInstanceId: fixture.opponent.vanguard.uid, attackingUnitInstanceId: other.uid, attackingCardInstanceIds: [other.uid], targetCardInstanceIds: [fixture.opponent.vanguard.uid], targetLocation: "vanguard", battleId: "other-source-battle", phase: "battle", timingWindow: "attack-hit" });
  assert.equal(Reducer.discoverAutoTriggers(fixture.state, [otherHit], Engine).queued.length, 0);

  const rearHit = Engine.createGameEvent(fixture.state, { type: "attack.hit", actingPlayerId: fixture.ownerId, turnPlayerId: fixture.ownerId, sourceCardInstanceId: fixture.source.uid, sourceOwnerPlayerId: fixture.ownerId, sourceControllerPlayerId: fixture.ownerId, subjectCardInstanceId: fixture.enemyRear.uid, attackingUnitInstanceId: fixture.source.uid, attackingCardInstanceIds: [fixture.source.uid], targetCardInstanceIds: [fixture.enemyRear.uid], targetLocation: "rear-guard", battleId: "rear-target-battle", phase: "battle", timingWindow: "attack-hit" });
  fixture.state.pendingAttack = { ...fixture.state.pendingAttack, attackerUid: fixture.source.uid, attackerZone: "rear-left", battleId: "rear-target-battle", targetUid: fixture.enemyRear.uid, targetZone: "rear-left", defenderSide: "human" };
  assert.equal(Reducer.discoverAutoTriggers(fixture.state, [rearHit], Engine).queued.length, 0);
});

test("an opponent Rear-Guard is rejected as an illegal target without applying power", () => {
  const fixture = setup("human");
  assert.equal(Reducer.discoverAutoTriggers(fixture.state, [fixture.hit], Engine).queued.length, 1);
  const result = Reducer.applyAbilityDecision(fixture.state, { actorAuthUid: seats.hostAuthUid, actionId: "illegal-enemy-target", expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: fixture.source.uid, abilityId: ABILITY_ID, targetUid: fixture.enemyRear.uid, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } } }, seats, Engine);
  assert.equal(result.ok, false);
  assert.equal(fixture.ally.turnPowerBoost || 0, 0);
  assert.equal(fixture.enemyRear.turnPowerBoost || 0, 0);
});
