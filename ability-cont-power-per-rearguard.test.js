"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const PATTERN = "cont-vc-rc-during-turn-power-per-rearguard-v1";
const FAMILY = new Map([["cfa-5985", "vanguard"], ["cfa-11951", "rear-guard"], ["cfa-12675", "vanguard"]]);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

test("all exact own-turn per-Rear-Guard CONT text preserves source circle and amount", () => {
  const found = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) found.push(ability);
  assert.deepEqual(found.map(ability => ability.cardId).sort(), [...FAMILY.keys()].sort());
  for (const ability of found) {
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, [FAMILY.get(ability.cardId)]);
    assert.equal(ability.definition.effects[0].op, "continuous-power-per-controller-rearguard");
    assert.equal(ability.definition.effects[0].amount, 2000);
    assert.deepEqual(ability.definition.effects[0].condition, { op: "controller-turn" });
  }
});

test("continuous scaling counts distinct friendly Rear-Guard instances and respects turn and circle", () => {
  const ability = Engine.parseCardAbilitiesCached(catalog.find(card => card.id === "cfa-5985")).find(value => value.definition?.source?.patternId === PATTERN);
  const field = [{ uid: "rg1", zone: "rear-guard" }, { uid: "rg2", zone: "rear-guard" }, { uid: "rg1", zone: "rear-guard" }, { uid: "vg", zone: "vanguard" }, { uid: "opponent-rg", zone: "opponent-rear-guard" }];
  const evaluate = (location, isControllerTurn) => Engine.evaluateContinuousEffects([ability], { location, sourceInstanceId: "vg", targetInstanceId: "vg", controllerFieldCards: field, isControllerTurn }).power;
  assert.equal(evaluate("vanguard", true), 4000);
  assert.equal(evaluate("vanguard", false), 0);
  assert.equal(evaluate("rear-guard", true), 0);
  assert.equal(evaluate("vanguard", true), 4000, "duplicate source identities are counted once");
});

function fixture(side, cardId) {
  const card = catalog.find(value => value.id === cardId), location = FAMILY.get(cardId);
  const ownerId = side === "human" ? "host-player" : "guest-player", otherSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "guest-player" : "host-player";
  const unit = (uid, id, name, power, playerId, grade = 1) => ({ uid, cardId: id, cardName: name, type: "Normal Unit", unitCard: true, grade, power, critical: 1, ownerPlayerId: playerId, controllerPlayerId: playerId });
  const source = unit(`source-${side}-${cardId}`, cardId, card.name, Number(card.power), ownerId, Number(card.grade));
  const ally1 = unit(`ally1-${side}-${cardId}`, "ally-one", "Ally One", 8000, ownerId), ally2 = unit(`ally2-${side}-${cardId}`, "ally-two", "Ally Two", 8000, ownerId);
  const friendlyVanguard = location === "vanguard" ? source : unit(`friendly-vg-${side}`, "friendly-vg", "Friendly Vanguard", 13000, ownerId, 3);
  const opposingVanguard = unit(`opposing-vg-${side}`, "opposing-vg", "Opposing Vanguard", 13000, opponentId, 3);
  const rear = location === "rear-guard" ? [source, ally1, ally2, null, null] : [ally1, ally2, null, null, null];
  const player = (playerId, vanguard, rear = []) => ({ playerId, vanguard, rear, hand: [], deck: [], drop: [], soul: [], damage: [], bind: [], orders: [], crests: [], giftZones: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  const state = { matchId: `rearguard-scale-${side}-${cardId}`, stateVersion: 0, turn: 4, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, players: { [side]: player(ownerId, friendlyVanguard, rear), [otherSide]: player(opponentId, opposingVanguard) } };
  const command = { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `attack-${state.matchId}`, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opposingVanguard.uid } };
  return { card, source, state, command, location };
}

test("host and joining player receive their own authoritative per-Rear-Guard power", () => {
  for (const side of ["human", "bot"]) for (const cardId of FAMILY.keys()) {
    const f = fixture(side, cardId), result = Reducer.applyGameAction(f.state, f.command, seats, Engine);
    assert.equal(result.ok, true, `${side}/${cardId}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, Number(f.card.power) + (f.location === "rear-guard" ? 6000 : 4000));
  }
});

test("client and authority supply exact owned field instances for the continuous count", () => {
  assert.match(fs.readFileSync("app.js", "utf8"), /controllerFieldCards=\[\.\.\.\(player\.vanguard/);
  assert.match(fs.readFileSync("ability-server-reducer.js", "utf8"), /controllerFieldCards: \[\.\.\.\(player\.vanguard/);
});
