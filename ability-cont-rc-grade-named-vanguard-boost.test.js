"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
require("./ability-definitions.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-grade-named-vanguard-grants-keyword-v1";
const CASES = [
  { abilityId: "cfa-12547:1", name: "Varga", vanguardCardId: "cfa-12546" },
  { abilityId: "cfa-12862:1", name: "Vyrgilla", vanguardCardId: "cfa-12677" },
  { abilityId: "cfa-13727:1", name: "Cristianos", vanguardCardId: "cfa-12361" },
  { abilityId: "cfa-13759:1", name: "Veissrugr", vanguardCardId: "cfa-13760" }
];
const cards = loadCatalog();

function abilityFor(id) {
  const card = cards.find(item => item.id === id.split(":")[0]);
  assert.ok(card, `catalog card exists for ${id}`);
  return Engine.parseCardAbilitiesCached(card).find(ability => ability.id === id);
}

test("the exact four catalog CONT abilities compile as grade-gated named-Vanguard Boost grants", () => {
  const found = new Map();
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
  }
  assert.deepEqual([...found.keys()].sort(), CASES.map(item => item.abilityId).sort());
  assert.equal(auditCatalog(cards).patterns[PATTERN], CASES.length);
  for (const item of CASES) {
    const ability = found.get(item.abilityId);
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.definition.continuousEffects, [{
      type: "grant-keyword", target: "source", keyword: "boost", duration: "continuous",
      condition: { op: "all", conditions: [
        { op: "controller-vanguard-grade-at-least", grade: 3 },
        { op: "controller-vanguard-card-name-contains", name: item.name }
      ] }
    }]);
    assert.equal(Engine.isManuallyActivatable(ability), false);
  }
  assert.deepEqual(auditCatalog(cards).invalidCompiled, []);
});

test("the live continuous condition requires this face-up RC instance and a matching grade-three-or-greater Vanguard", () => {
  for (const side of ["host", "joiner"]) for (const item of CASES) {
    const ability = abilityFor(item.abilityId);
    const context = (overrides = {}) => ({
      sourceInstanceId: `source-${side}-${item.abilityId}`,
      sourceCardId: item.abilityId.split(":")[0],
      sourceLocation: "rear-left",
      sourceFaceUp: true,
      controllerVanguardGrade: 3,
      controllerVanguardCardNames: [item.name],
      ...overrides
    });
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context()), ["boost"], `${side}/${item.abilityId}`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context({ controllerVanguardGrade: 4 })), ["boost"], `${side}/${item.abilityId} accepts grade 4`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context({ controllerVanguardGrade: 2 })), [], `${side}/${item.abilityId} rejects grade 2`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context({ controllerVanguardCardNames: ["Unrelated Vanguard"] })), [], `${side}/${item.abilityId} rejects wrong name`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context({ controllerVanguardCardNames: [], controllerVanguardGrade: 4 })), [], `${side}/${item.abilityId} rejects absent Vanguard`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context({ sourceLocation: "vanguard" })), [], `${side}/${item.abilityId} is RC-only`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context({ sourceFaceUp: false })), [], `${side}/${item.abilityId} is inactive face down`);
    assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([ability], context({ sourceInstanceId: "" })), [], `${side}/${item.abilityId} requires source identity`);
  }
});

test("the authoritative attack reducer accepts the conditional booster for either seat only with its grade and Vanguard name", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const player = (playerId, vanguard, rear) => ({
    playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [],
    crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: []
  });
  for (const side of ["human", "bot"]) for (const item of CASES) {
    const owner = side === "human" ? "host" : "guest", enemy = side === "human" ? "guest" : "host";
    const otherSide = side === "human" ? "bot" : "human";
    const makeState = (vanguardCardId, vanguardGrade, actionId, vanguardExtra = {}) => {
      const attacker = { uid: `attacker-${side}-${actionId}`, cardId: "test-attacker", cardName: "Attacker", type: "Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
      const booster = { uid: `booster-${side}-${actionId}`, cardId: item.abilityId.split(":")[0], cardName: "Conditional Booster", type: "Unit", unitCard: true, grade: 2, power: 10000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
      const friendlyVanguard = { uid: `friendly-vg-${side}-${actionId}`, cardId: vanguardCardId, cardName: vanguardCardId === "test-g-unit" ? "Test G Unit" : undefined, grade: vanguardGrade, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner, ...vanguardExtra };
      const enemyVanguard = { uid: `enemy-vg-${side}-${actionId}`, cardId: "test-enemy-vg", cardName: "Opponent Vanguard", type: "Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: enemy, controllerPlayerId: enemy };
      const state = { matchId: `grade-boost-${side}-${actionId}`, stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
      state.players[side] = player(owner, friendlyVanguard, [attacker, null, booster, null, null]);
      state.players[otherSide] = player(enemy, enemyVanguard, [null, null, null, null, null]);
      return { state, attacker, booster, enemyVanguard };
    };
    const act = (vanguardCardId, vanguardGrade, actionId, vanguardExtra) => {
      const f = makeState(vanguardCardId, vanguardGrade, actionId, vanguardExtra);
      return Reducer.applyGameAction(f.state, {
        actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId, expectedStateVersion: 0,
        payload: { type: "game-action", action: "attack", attackerCardInstanceId: f.attacker.uid, targetCardInstanceId: f.enemyVanguard.uid, boosterCardInstanceId: f.booster.uid }
      }, seats, Engine);
    };
    const legal = act(item.vanguardCardId, 3, `valid-${side}-${item.abilityId}`);
    assert.equal(legal.ok, true, `${side}/${item.abilityId}: ${legal.reason}`);
    assert.equal(legal.state.pendingAttack.boostUid, `booster-${side}-valid-${side}-${item.abilityId}`);
    const lowGrade = act(item.vanguardCardId, 2, `low-${side}-${item.abilityId}`);
    assert.equal(lowGrade.ok, false, `${side}/${item.abilityId} rejects a grade 2 Vanguard`);
    assert.equal(lowGrade.reason, "invalid-booster");
    const wrongName = act("cfa-12547", 3, `wrong-name-${side}-${item.abilityId}`);
    assert.equal(wrongName.ok, false, `${side}/${item.abilityId} rejects the wrong Vanguard name`);
    assert.equal(wrongName.reason, "invalid-booster");
    const matchingHeart = act("test-g-unit", 4, `heart-name-${side}-${item.abilityId}`, { strideHeart: { cardId: item.vanguardCardId } });
    assert.equal(matchingHeart.ok, true, `${side}/${item.abilityId} recognizes the matching grade 3+ stride heart name`);
    const unrelatedHeart = act("test-g-unit", 4, `wrong-heart-${side}-${item.abilityId}`, { strideHeart: { cardId: "cfa-12547" } });
    assert.equal(unrelatedHeart.ok, false, `${side}/${item.abilityId} rejects a stride heart with an unrelated name`);
  }
});
