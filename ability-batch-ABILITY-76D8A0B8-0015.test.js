"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0015.js");
Engine.registerAbilityDefinitions(contribution);
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const EXPECTED_IDS = [
  "cfa-11261:0", "cfa-11261:1", "cfa-11262:0", "cfa-11263:0", "cfa-11264:0", "cfa-11264:1",
  "cfa-11265:0", "cfa-11265:1", "cfa-11266:0", "cfa-11267:0", "cfa-11268:0", "cfa-11269:0",
  "cfa-11270:0", "cfa-11271:0", "cfa-11272:0", "cfa-11273:0", "cfa-11273:1", "cfa-11274:0",
  "cfa-11274:1", "cfa-11275:0", "cfa-11275:1", "cfa-11275:2", "cfa-11276:0", "cfa-11276:1",
  "cfa-11277:0", "cfa-11277:1", "cfa-11278:0", "cfa-11278:1", "cfa-11279:0", "cfa-1127:0",
  "cfa-11280:0", "cfa-11281:0", "cfa-11282:0", "cfa-11282:1", "cfa-11283:0", "cfa-11283:1",
  "cfa-11283:2", "cfa-1128:0"
];
const ALREADY_SUPPORTED = ["cfa-11264:1", "cfa-11275:0", "cfa-11278:0", "cfa-1127:0"];
const PROPOSED = ["cfa-11261:1"];
const PRINTED_TEXT = 'CONT [GC]: If you have a grade 4 vanguard with "Bruce" in its card name, this unit gets shield +10000.';
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));

function instance(cardId, uid, playerId, overrides = {}) {
  const card = cards.get(String(cardId));
  assert.ok(card, `catalog card ${cardId} exists`);
  return {
    uid, cardId: String(cardId), cardName: card.name, name: card.name, type: card.type,
    trigger: card.trigger || "", unitCard: card.type === "Unit" || card.type === "Trigger",
    grade: Number(card.grade), power: Number(card.power || 0), shield: Number(card.shield || 0),
    critical: 1, drive: 1, rested: false, locked: false,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides
  };
}

function fixture(defenderSide, vanguardCardId = "cfa-9319") {
  const ownerId = defenderSide === "human" ? "player-host" : "player-guest";
  const attackerSide = defenderSide === "human" ? "bot" : "human";
  const attackerId = defenderSide === "human" ? "player-guest" : "player-host";
  const ownVanguard = instance(vanguardCardId, `own-vg-${defenderSide}-${vanguardCardId}`, ownerId);
  const opponentVanguard = instance("cfa-9319", `opponent-vg-${defenderSide}`, attackerId);
  const guardian = instance("cfa-11261", `guardian-${defenderSide}`, ownerId);
  const makePlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [],
    damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [],
    gDeck: [], gZone: [], removed: [], triggerZone: [] });
  const defender = makePlayer(ownerId), attacker = makePlayer(attackerId);
  defender.vanguard = ownVanguard;
  defender.hand.push(guardian);
  attacker.vanguard = opponentVanguard;
  const players = defenderSide === "human" ? { human: defender, bot: attacker } : { human: attacker, bot: defender };
  const state = {
    matchId: `impediment-slicer-shield-${defenderSide}-${vanguardCardId}`,
    stateVersion: 1, eventSequence: 0, side: attackerSide, turn: 3, phase: 5,
    firstTurnComplete: true, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: {
      battleId: `battle-${defenderSide}-${vanguardCardId}`,
      attackerSide, attackerPlayerId: attackerId, attackerUid: opponentVanguard.uid, attackerZone: "vanguard",
      defenderSide, defenderPlayerId: ownerId, targetUid: ownVanguard.uid, targetZone: "vanguard",
      power: 30000, targetPower: 10000, critical: 1, guardCards: [], defenderDone: false,
      maxDriveChecks: 1, driveCountChosen: false
    },
    players
  };
  return { state, guardian, defenderSide, ownerId };
}

function guard(f, guardian = f.guardian, actorAuthUid = f.defenderSide === "human" ? seats.hostAuthUid : seats.guestAuthUid) {
  return Reducer.applyGameAction(f.state, {
    actorAuthUid, actionId: `guard-${f.state.matchId}-${guardian.uid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "guard", cardInstanceId: guardian.uid }
  }, seats, Engine);
}

test("the batch audit accounts for all 38 exact abilities across 25 card instances", () => {
  assert.deepEqual(contribution.audit.abilityIds, EXPECTED_IDS);
  assert.equal(contribution.audit.assignedAbilityCount, 38);
  assert.equal(contribution.audit.uniqueCardInstanceCount, 25);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, ALREADY_SUPPORTED);
  assert.deepEqual(contribution.audit.newlyImplementedAbilityIds, PROPOSED);
  assert.equal(contribution.audit.newlyImplementedCount, 1);
  assert.equal(contribution.audit.unsupportedAbilityIds.length, 33);
  assert.equal(contribution.audit.unsupportedAbilities.length, 33);
  assert.equal(contribution.audit.unsupportedAbilities.every(record => record.blocker.length > 40), true);

  const observed = new Set();
  for (const abilityId of EXPECTED_IDS) {
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    const card = cards.get(cardId);
    assert.ok(card, `${abilityId}: uses an actual catalog card ID`);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(ability, `${abilityId}: parses from this card's printed catalog text`);
    assert.ok(card.text.includes(ability.printedText), `${abilityId}: exact ability text is present on its card`);
    assert.equal(observed.has(abilityId), false, `${abilityId} is not duplicated`);
    observed.add(abilityId);
    if (ALREADY_SUPPORTED.includes(abilityId) || PROPOSED.includes(abilityId)) {
      assert.ok(ability.definition, `${abilityId}: supported definition is present`);
    } else {
      assert.ok(contribution.audit.unsupportedAbilities.some(record => record.abilityId === abilityId), `${abilityId}: has a concrete blocker`);
    }
  }
  assert.equal(observed.size, 38);

  const lysette = Engine.parseCardAbilitiesCached(cards.get("cfa-11283")).find(item => item.id === "cfa-11283:2");
  assert.equal(lysette.definition.effects[0].condition.conditions.find(condition => condition.op === "controller-vanguard-card-name-contains").name, "Relation Weaver, Petralka");
  assert.match(contribution.audit.unsupportedAbilities.find(item => item.abilityId === "cfa-11283:2").blocker, /Bushiroad says.*Petralka/);
  assert.ok(contribution.audit.officialTextCheckedIds.includes("cfa-11283:2"));
  assert.match(contribution.audit.unsupportedAbilities.find(item => item.abilityId === "cfa-1128:0").blocker, /catalog text does not match Bushiroad/);
});

test("Impediment Slicer's GC CONT grants shield only to its exact guardian, for either defending player", () => {
  const card = cards.get("cfa-11261");
  assert.equal(card.name, "Impediment Slicer");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === "cfa-11261:1");
  assert.equal(ability.printedText, PRINTED_TEXT);
  assert.equal(ability.kind, "CONT");
  assert.deepEqual(ability.requiredLocation, ["guardian"]);
  assert.equal(ability.trigger, null);
  assert.equal(Engine.isManuallyActivatable(ability), false);
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
    location: "guardian", controllerVanguardGrade: 4, controllerVanguardCardNames: ['Diabolos, "Unrivaled" Bruce']
  }).shield, 10000);
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
    location: "rear-guard", controllerVanguardGrade: 4, controllerVanguardCardNames: ['Diabolos, "Unrivaled" Bruce']
  }).shield, 0, "the GC ability cannot grant shield while on a Rear-Guard Circle");
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
    location: "guardian", controllerVanguardGrade: 3, controllerVanguardCardNames: ['Diabolos, "Viamance" Bruce']
  }).shield, 0, "a grade-3 Bruce fails the grade requirement");
  assert.equal(Engine.evaluateContinuousShieldEffects([ability], {
    location: "guardian", controllerVanguardGrade: 4, controllerVanguardCardNames: ["Exculpate the Blaster"]
  }).shield, 0, "a grade-4 non-Bruce fails the name requirement");

  for (const defenderSide of ["human", "bot"]) {
    const f = fixture(defenderSide);
    const result = guard(f);
    assert.equal(result.ok, true, `${defenderSide}: ${result.reason || ""}`);
    assert.equal(result.state.pendingAttack.targetPower, 10000 + 5000 + 10000, `${defenderSide}: only this guardian's shield includes the CONT bonus`);
    assert.ok(result.state.players[defenderSide].guardCircle.some(item => item.uid === f.guardian.uid));
    assert.equal(result.state.pendingAbility, null, `${defenderSide}: continuous effects never create activation prompts`);
    assert.deepEqual(result.state.pendingAbilities, []);
  }
});

test("the server does not apply the bonus for a wrong Vanguard condition or a different card instance", () => {
  for (const defenderSide of ["human", "bot"]) {
    const wrongGrade = fixture(defenderSide, "cfa-8239");
    const noGradeBonus = guard(wrongGrade);
    assert.equal(noGradeBonus.ok, true, `${defenderSide}/grade 3 Bruce: ${noGradeBonus.reason || ""}`);
    assert.equal(noGradeBonus.state.pendingAttack.targetPower, 15000, `${defenderSide}: Grade 3 Bruce grants no +10000`);

    const wrongName = fixture(defenderSide, "cfa-1061");
    const noNameBonus = guard(wrongName);
    assert.equal(noNameBonus.ok, true, `${defenderSide}/grade 4 non-Bruce: ${noNameBonus.reason || ""}`);
    assert.equal(noNameBonus.state.pendingAttack.targetPower, 15000, `${defenderSide}: unrelated Grade 4 Vanguard grants no +10000`);

    const unrelatedCard = fixture(defenderSide);
    unrelatedCard.state.players[defenderSide].rear[0] = instance("cfa-11261", `not-guarding-${defenderSide}`, unrelatedCard.ownerId, {
      zone: "rear-guard", circle: "rear-left"
    });
    const otherGuardian = instance("cfa-3", `other-guardian-${defenderSide}`, unrelatedCard.ownerId);
    unrelatedCard.state.players[defenderSide].hand.push(otherGuardian);
    const onlyOtherCardGuards = guard(unrelatedCard, otherGuardian);
    assert.equal(onlyOtherCardGuards.ok, true, `${defenderSide}/different guarded instance: ${onlyOtherCardGuards.reason || ""}`);
    assert.equal(onlyOtherCardGuards.state.pendingAttack.targetPower, 15000, `${defenderSide}: a separate Rear-Guard copy cannot lend its CONT to another guardian`);

    const wrongSeat = fixture(defenderSide);
    const attackerAuthUid = defenderSide === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const rejected = guard(wrongSeat, wrongSeat.guardian, attackerAuthUid);
    assert.equal(rejected.ok, false, `${defenderSide}: the opposing seat cannot submit the guard action`);
    assert.equal(wrongSeat.state.stateVersion, 1, "a rejected action does not partially change the match");
    assert.equal(wrongSeat.state.pendingAttack.targetPower, 10000, "rejected action adds no shield");
  }
});
