"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-generation-break-rearguard-own-attack-power-battle-v1";
const FAMILY = new Map([["cfa-11724", [1, 3000]], ["cfa-11743", [1, 3000]], ["cfa-11751", [1, 3000]], ["cfa-13611", [3, 10000]]]);
const cards = loadCatalog();

function battle({ side = "bot", sourceAttacks = true, sourceZone = "rear", gb = 1, cardId = "cfa-11724" } = {}) {
  const owner = side === "human" ? "player-host" : "player-guest";
  const opponent = side === "human" ? "player-guest" : "player-host";
  const otherSide = side === "human" ? "bot" : "human";
  const source = { uid: `gb-source-${side}`, cardId, cardName: "Generation Break Attacker", unitCard: true, grade: 2, power: 9000, critical: 1, ownerPlayerId: owner, controllerPlayerId: owner, position: "stand" };
  const otherAttacker = { uid: `other-attacker-${side}`, cardId: "other-card", cardName: "Other Attacker", unitCard: true, grade: 2, power: 9000, critical: 1, ownerPlayerId: owner, controllerPlayerId: owner, position: "stand" };
  const friendlyVanguard = { uid: `friendly-vg-${side}`, cardId: "friendly-vg", cardName: "Friendly Vanguard", unitCard: true, grade: 3, power: 11000, critical: 1, ownerPlayerId: owner, controllerPlayerId: owner };
  const opposingVanguard = { uid: `opposing-vg-${side}`, cardId: "opposing-vg", cardName: "Opposing Vanguard", unitCard: true, grade: 3, power: 11000, critical: 1, ownerPlayerId: opponent, controllerPlayerId: opponent };
  const unit = (playerId, vanguard, rear = [], gZone = []) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone, removed: [], triggerZone: [] });
  const gUnits = Array.from({ length: gb }, (_, index) => ({ uid: `gb-${side}-${index}`, cardId: `gb-card-${index}`, gDeckCard: true, faceUp: true, ownerPlayerId: owner, controllerPlayerId: owner }));
  const ownRear = sourceZone === "rear" ? [source, otherAttacker] : [otherAttacker];
  const state = { matchId: `gb-attack-${side}-${sourceAttacks}-${sourceZone}-${gb}`, stateVersion: 0, processedActionIds: [], turn: 3, side, phase: 5, firstTurnComplete: true, pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
  state.players[side] = unit(owner, sourceZone === "vanguard" ? source : friendlyVanguard, ownRear, gUnits);
  state.players[otherSide] = unit(opponent, opposingVanguard);
  const attacker = sourceAttacks ? source : otherAttacker;
  const result = Reducer.applyGameAction(state, { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `attack-${state.matchId}`, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: attacker.uid, targetCardInstanceId: opposingVanguard.uid } }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  return { state: result.state || state, result, side, owner, source, sourceAttacks, sourceZone, gb };
}

function resolve(f) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? "auth-host" : "auth-guest", actionId: `resolve-${pending?.ability?.id}`, expectedStateVersion: f.state.stateVersion, payload: { type: "ability-response", accept: true, selection: { instanceUid: pending?.instance?.uid, abilityId: pending?.ability?.id } } }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
}

test("three exact GB1 Rear-Guard attack abilities preserve source, restriction, and battle power", () => {
  const audit = auditCatalog(cards), found = new Map();
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
  assert.equal(audit.patterns[PATTERN], FAMILY.size);
  assert.deepEqual([...found.keys()].sort(), [...FAMILY.keys()].map(id => `${id}:${id === "cfa-13611" ? 1 : 0}`).sort());
  assert.deepEqual(audit.invalidCompiled, []);
  for (const [cardId, [gb, amount]] of FAMILY) {
    const id = `${cardId}:${cardId === "cfa-13611" ? 1 : 0}`;
    const ability = found.get(id);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.trigger.eventType, "unit.attacked");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.conditions, [{ type: "generation-break", count: gb }]);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount, duration: "battle" }]);
  }
});

test("each seat's exact Rear-Guard attack privately queues and resolves its own GB1 power", () => {
  for (const side of ["human", "bot"]) for (const [cardId, [gb, amount]] of FAMILY) {
    const f = battle({ side, cardId, gb });
    assert.equal(f.result.ok, true, f.result.reason);
    assert.equal(f.state.pendingAbility?.side, side);
    assert.equal(f.state.pendingAbility?.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility?.triggerControllerPlayerId, f.owner);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.state.pendingAttack.power, 9000 + amount);
  }
});

test("another attacker, Vanguard source, and missing Generation Break do not queue the Rear-Guard AUTO", () => {
  for (const options of [{ sourceAttacks: false }, { sourceZone: "vanguard" }, { gb: 0 }, { cardId: "cfa-13611", gb: 2 }]) {
    const f = battle(options);
    assert.equal(f.result.ok, true, f.result.reason);
    assert.equal(f.state.pendingAbility, null, JSON.stringify(options));
    assert.equal(f.state.pendingAbilities.length, 0, JSON.stringify(options));
  }
});
