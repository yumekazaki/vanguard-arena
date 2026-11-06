"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
require("./ability-definitions.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-named-vanguard-grants-keyword-v1";
const EXPECTED = new Map([
  ["cfa-12062:1", "Drajeweled"],
  ["cfa-12719:1", "FLДMMe-Glam"],
  ["cfa-13689:1", "Argo Siren"],
  ["cfa-7528:1", "Blaster"]
]);
const cards = loadCatalog();
const definitions = [];
for (const card of cards) {
  for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (EXPECTED.has(ability.id) && ability.definition?.source?.patternId === PATTERN) definitions.push(ability.definition);
  }
}
Engine.registerAbilityDefinitions(definitions);

test("the exact catalog batch compiles only four named-Vanguard Boost CONT abilities", () => {
  const found = new Map();
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
  }
  assert.deepEqual([...found.keys()].sort(), [...EXPECTED.keys()].sort());
  assert.equal(auditCatalog(cards).patterns[PATTERN], EXPECTED.size);
  for (const [id, vanguardName] of EXPECTED) {
    const ability = found.get(id);
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.definition.continuousEffects, [{
      type: "grant-keyword", target: "source", keyword: "boost", duration: "continuous",
      condition: { op: "controller-vanguard-card-name-contains", name: vanguardName }
    }]);
    assert.equal(Engine.isManuallyActivatable(ability), false);
  }
  assert.deepEqual(auditCatalog(cards).invalidCompiled, []);
});

test("conditional Boost is source-bound, seat-independent, RC-only, and expires as soon as its condition ends", () => {
  for (const side of ["host", "joiner"]) for (const [id, vanguardName] of EXPECTED) {
    const ability = Engine.parseCardAbilitiesCached(cards.find(card => card.id === id.split(":")[0])).find(item => item.id === id);
    const sourceInstanceId = `source-${side}-${id}`;
    const grant = (overrides = {}) => Engine.evaluateContinuousAbilityKeywords([ability], {
      sourceInstanceId, sourceCardId: id.split(":")[0], sourceLocation: "rear-left", sourceFaceUp: true,
      controllerVanguardCardNames: [vanguardName], ...overrides
    });
    assert.deepEqual(grant(), ["boost"], `${side}/${id} exact source gets Boost`);
    assert.deepEqual(grant({ controllerVanguardCardNames: [`${vanguardName} Vanguard`] }), ["boost"], `${side}/${id} printed phrase is a substring condition`);
    assert.deepEqual(grant({ controllerVanguardCardNames: ["Unrelated Vanguard"] }), [], `${side}/${id} wrong Vanguard name`);
    assert.deepEqual(grant({ controllerVanguardCardNames: [] }), [], `${side}/${id} absent Vanguard`);
    assert.deepEqual(grant({ sourceCardId: "different-card" }), [], `${side}/${id} wrong source card definition`);
    assert.deepEqual(grant({ sourceInstanceId: "" }), [], `${side}/${id} missing source instance`);
    assert.deepEqual(grant({ sourceLocation: "vanguard" }), [], `${side}/${id} wrong circle`);
    assert.deepEqual(grant({ sourceLocation: "hand" }), [], `${side}/${id} outside the field`);
    assert.deepEqual(grant({ sourceFaceUp: false }), [], `${side}/${id} face-down source`);
    assert.deepEqual(grant({ controllerVanguardCardNames: ["Unrelated Vanguard"], sourceLocation: "rear-right" }), [], `${side}/${id} grant expires after Vanguard changes`);
  }
});

test("server permits a conditional grade-two booster only for the correct controller Vanguard, for either seat", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const player = (playerId, vanguard, rear) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  for (const side of ["human", "bot"]) {
    const owner = side === "human" ? "host" : "guest", enemy = side === "human" ? "guest" : "host", otherSide = side === "human" ? "bot" : "human";
    const makeState = (vanguardName, actionId) => {
      const attacker = { uid: `attacker-${side}-${actionId}`, cardId: "test-attacker", cardName: "Attacker", type: "Unit", unitCard: true, grade: 1, power: 5000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
      const booster = { uid: `booster-${side}-${actionId}`, cardId: "cfa-12062", cardName: "Soul Severing Demonic Spear Knight, Zagan", type: "Unit", unitCard: true, grade: 2, power: 10000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
      const friendlyVanguard = { uid: `friendly-vg-${side}-${actionId}`, cardId: "test-vg", cardName: vanguardName, type: "Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
      const enemyVanguard = { uid: `enemy-vg-${side}-${actionId}`, cardId: "enemy-vg", cardName: "Opponent Vanguard", type: "Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: enemy, controllerPlayerId: enemy };
      const state = { matchId: `named-boost-${side}-${actionId}`, stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
      state.players[side] = player(owner, friendlyVanguard, [attacker, null, booster, null, null]);
      state.players[otherSide] = player(enemy, enemyVanguard, [null, null, null, null, null]);
      return { state, attacker, booster, enemyVanguard };
    };
    const act = (name, actionId) => {
      const f = makeState(name, actionId);
      return Reducer.applyGameAction(f.state, {
        actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId, expectedStateVersion: 0,
        payload: { type: "game-action", action: "attack", attackerCardInstanceId: f.attacker.uid, targetCardInstanceId: f.enemyVanguard.uid, boosterCardInstanceId: f.booster.uid }
      }, seats, Engine);
    };
    const legal = act("Drajeweled", `valid-${side}`);
    assert.equal(legal.ok, true, `${side}: ${legal.reason}`);
    assert.equal(legal.state.pendingAttack.boostUid, `booster-${side}-valid-${side}`);
    const wrong = act("Unrelated Vanguard", `invalid-${side}`);
    assert.equal(wrong.ok, false, `${side} cannot use the granted Boost when the condition is absent`);
    assert.equal(wrong.reason, "invalid-booster");
  }
});

test("different conditional grants keep their own semantics instead of being treated as Boost", () => {
  const resistCard = cards.find(item => item.id === "cfa-5264");
  const resist = Engine.parseCardAbilitiesCached(resistCard).find(item => item.id === "cfa-5264:0");
  assert.ok(resist.printedText.includes('this unit gets "CONT [RC]: Resist"'));
  assert.equal(resist.kind, "CONT");
  assert.deepEqual(resist.definition?.continuousEffects, [{
    type: "grant-keyword", target: "source", keyword: "resist", duration: "continuous",
    condition: { op: "controller-vanguard-card-name-contains", name: "Thavas" }
  }]);
  assert.equal(Engine.isManuallyActivatable(resist), false);

  const bagwormCard = cards.find(item => item.id === "cfa-5349");
  const bagworm = Engine.parseCardAbilitiesCached(bagwormCard).find(item => item.id === "cfa-5349:1");
  assert.ok(bagworm.printedText.includes('this unit gets "ACT [RC] 1/Turn:'));
  assert.equal(bagworm.definition, null, "the granted Soul Charge/rest ability is still unsupported by the Boost compiler");
});
