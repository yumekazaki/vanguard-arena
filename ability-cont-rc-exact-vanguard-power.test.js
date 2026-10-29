"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-exact-vanguard-name-power-v1";
const EXPECTED = new Map([
  ["cfa-6238:0", ["Pencil Hero, Hammsuke", 3000]],
  ["cfa-6239:0", ["Pencil Hero, Hammsuke", 4000]],
  ["cfa-6456:0", ["Cuticle Killer, Mirche", 10000]],
  ["cfa-8659:0", ["Master of Gravity, Baromagnes", 5000]]
]);
const cards = loadCatalog();

test("the exact-name RC CONT compiler covers only the four exact catalog abilities", () => {
  const found = new Map();
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
  }
  assert.deepEqual([...found.keys()].sort(), [...EXPECTED.keys()].sort());
  assert.equal(auditCatalog(cards).patterns[PATTERN], EXPECTED.size);
  for (const [id, [name, amount]] of EXPECTED) {
    const ability = found.get(id);
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.definition.effects, [{ op: "continuous-power", target: "source", amount, duration: "continuous", condition: { op: "controller-vanguard-card-name-equals", name } }]);
  }
  assert.deepEqual(auditCatalog(cards).invalidCompiled, []);
});

test("exact Vanguard-name power rejects substring matches and applies only on RC for either seat", () => {
  for (const side of ["human", "bot"]) for (const [id, [name, amount]] of EXPECTED) {
    const ability = Engine.parseCardAbilitiesCached(cards.find(card => card.id === id.split(":")[0])).find(item => item.id === id);
    const power = (location, controllerVanguardCardNames) => Engine.evaluateContinuousEffects([ability], { location, controllerVanguardCardNames, sourceInstanceId: "source", targetInstanceId: "source" }).power;
    assert.equal(power("rear-guard", [name]), amount, `${side}/${id} exact name`);
    assert.equal(power("rear-guard", [`${name} Vanguard`]), 0, `${side}/${id} rejects a substring`);
    assert.equal(power("vanguard", [name]), 0, `${side}/${id} rejects VC source`);
    assert.equal(power("guardian", [name]), 0, `${side}/${id} rejects GC source`);
  }
});

test("trusted battle power applies exact-name CONT only when the controller's Vanguard matches", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const player = (playerId, vanguard, rear = []) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  for (const side of ["human", "bot"]) for (const [id, [name, amount]] of EXPECTED) {
    const owner = side === "human" ? "host" : "guest", other = side === "human" ? "guest" : "host", opposingSide = side === "human" ? "bot" : "human";
    const source = { uid: `source-${id}-${side}`, cardId: id.split(":")[0], cardName: id.split(":")[0], type: "Normal Unit", unitCard: true, grade: 2, power: 10000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
    const enemyVanguard = { uid: `enemy-${side}`, cardId: "enemy-vg", cardName: "Opponent Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: other, controllerPlayerId: other };
    const playAttack = (vanguardName, actionId) => {
      const friendlyVanguard = { uid: `friendly-${side}-${id}-${actionId}`, cardId: "friendly-vg", cardName: vanguardName, type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
      const state = { matchId: `exact-name-${side}-${id}-${actionId}`, stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
      state.players[side] = player(owner, friendlyVanguard, [{ ...source }, null, null, null, null]);
      state.players[opposingSide] = player(other, { ...enemyVanguard });
      return Reducer.applyGameAction(state, { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: enemyVanguard.uid } }, seats, Engine);
    };
    const legal = playAttack(name, `exact-match-${side}-${id}`);
    assert.equal(legal.ok, true, legal.reason);
    assert.equal(legal.state.pendingAttack.power, 10000 + amount, `${side}/${id} trusted modifier`);
    const wrong = playAttack(`${name} Vanguard`, `wrong-name-${side}-${id}`);
    assert.equal(wrong.ok, true, wrong.reason);
    assert.equal(wrong.state.pendingAttack.power, 10000, `${side}/${id} rejects substring in authority`);
  }
});
