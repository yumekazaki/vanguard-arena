"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-gc-named-vanguard-power-shield-v1";
const EXPECTED = [
  { id: "cfa-10656:0", name: "Flagburg", vanguardId: "cfa-9100", power: 2000, shield: 5000,
    text: "CONT [RC/GC]: If you have a vanguard with \"Flagburg\" in its card name, this unit gets power +2000 / shield +5000. (Active on opponent’s turn too)" },
  { id: "cfa-11839:1", name: "Bastion", vanguardId: "cfa-8227", power: 10000, shield: 10000,
    text: "CONT [RC/GC]: If you have a vanguard with \"Bastion\" in its card name, this unit gets power +10000 / shield +10000. (Active on opponent’s turn too)" }
];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));

function instance(cardId, uid, playerId, overrides = {}) {
  const definition = cards.get(String(cardId)) || {};
  return { uid, cardId: String(cardId), cardName: definition.name || cardId, type: definition.type || "Unit",
    trigger: definition.trigger || "", unitCard: true, grade: Number(definition.grade ?? 0),
    power: Number(definition.power || 0), shield: Number(definition.shield || 0), critical: 1, drive: 1,
    rested: false, locked: false, ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function fixture(cardId, defenderSide, namedVanguard) {
  const ability = EXPECTED.find(item => item.id.startsWith(`${cardId}:`));
  const printed = cards.get(cardId), ownerId = defenderSide === "human" ? "host-player" : "guest-player";
  const opponentSide = defenderSide === "human" ? "bot" : "human", opponentId = defenderSide === "human" ? "guest-player" : "host-player";
  const guardian = instance(cardId, `guardian-${cardId}-${defenderSide}`, ownerId);
  const ownVanguard = instance(namedVanguard ? ability.vanguardId : "cfa-3", `own-vg-${cardId}-${defenderSide}`, ownerId);
  const opponentVanguard = instance("cfa-3", `opponent-vg-${cardId}-${defenderSide}`, opponentId, { grade: 3 });
  const makePlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], damage: [],
    drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  const defender = makePlayer(ownerId), attacker = makePlayer(opponentId);
  defender.vanguard = ownVanguard;
  defender.hand.push(guardian);
  attacker.vanguard = opponentVanguard;
  const players = defenderSide === "human" ? { human: defender, bot: attacker } : { human: attacker, bot: defender };
  const state = { matchId: `named-vanguard-power-shield-${cardId}-${defenderSide}-${namedVanguard}`, stateVersion: 1,
    eventSequence: 0, side: opponentSide, turn: 3, phase: 5, firstTurnComplete: true, processedEventIds: [],
    processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: { battleId: `battle-${cardId}-${defenderSide}`, attackerSide: opponentSide, attackerPlayerId: opponentId,
      attackerUid: opponentVanguard.uid, attackerZone: "vanguard", defenderSide, defenderPlayerId: ownerId,
      targetUid: ownVanguard.uid, targetZone: "vanguard", power: 30000, targetPower: 10000, critical: 1,
      guardCards: [], defenderDone: false, maxDriveChecks: 1, driveCountChosen: false }, players };
  return { state, guardian, defenderSide, baseShield: Number(printed.shield || 0),
    expectedShield: Number(printed.shield || 0) + (namedVanguard ? ability.shield : 0) };
}

function guard(fixture) {
  return Reducer.applyGameAction(fixture.state, { actorAuthUid: fixture.defenderSide === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `guard-${fixture.state.matchId}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "game-action", action: "guard", cardInstanceId: fixture.guardian.uid } }, seats, Engine);
}

test("the exact catalog family is passive, dual-circle, and not manually activatable", () => {
  const parsed = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) parsed.push(ability);
  }
  assert.deepEqual(parsed.map(ability => ability.id).sort(), EXPECTED.map(item => item.id).sort());
  for (const expected of EXPECTED) {
    const ability = parsed.find(item => item.id === expected.id);
    assert.equal(ability.printedText, expected.text);
    assert.deepEqual(ability.requiredLocation, ["rear-guard", "guardian"]);
    assert.equal(Engine.isManuallyActivatable(ability), false);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    const context = { controllerVanguardCardNames: [expected.name] };
    assert.equal(Engine.evaluateContinuousEffects([ability], { ...context, location: "rear-guard" }).power, expected.power);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { ...context, location: "guardian" }).shield, expected.shield);
    assert.equal(Engine.evaluateContinuousEffects([ability], { controllerVanguardCardNames: ["Unrelated Vanguard"], location: "rear-guard" }).power, 0);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { controllerVanguardCardNames: ["Unrelated Vanguard"], location: "guardian" }).shield, 0);
    assert.equal(Engine.evaluateContinuousEffects([ability], { ...context, location: "vanguard" }).power, 0);
    assert.equal(Engine.evaluateContinuousShieldEffects([ability], { ...context, location: "rear-guard" }).shield, 0);
  }
});

test("server applies the matching Vanguard-name shield only to its owner's guard, for host or guest", () => {
  for (const expected of EXPECTED) for (const defenderSide of ["human", "bot"]) {
    const matching = fixture(expected.id.split(":")[0], defenderSide, true);
    const matched = guard(matching);
    assert.equal(matched.ok, true, `${expected.id}/${defenderSide}: ${matched.reason || ""}`);
    assert.equal(matched.state.pendingAttack.targetPower, 10000 + matching.expectedShield);
    assert.equal(matched.state.pendingAbility, null);
    assert.equal(matched.state.pendingAbilities.length, 0);

    const unrelated = fixture(expected.id.split(":")[0], defenderSide, false);
    const unmatched = guard(unrelated);
    if (unrelated.baseShield > 0) {
      assert.equal(unmatched.ok, true, `${expected.id}/${defenderSide}/wrong-name: ${unmatched.reason || ""}`);
      assert.equal(unmatched.state.pendingAttack.targetPower, 10000 + unrelated.baseShield);
      assert.equal(unmatched.state.pendingAbility, null);
    } else {
      assert.equal(unmatched.ok, false, `${expected.id}/${defenderSide}/wrong-name must not gain conditional shield`);
      assert.equal(unmatched.reason, "zero-shield-card-cannot-guard");
      assert.equal(unrelated.state.pendingAttack.targetPower, 10000);
      assert.equal(unrelated.state.stateVersion, 1, "rejected guard must not partially mutate state");
    }
  }
});
