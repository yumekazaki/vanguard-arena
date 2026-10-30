"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const PATTERN = "cont-rc-during-turn-power-per-dragontree-marker-v1";
const CARDS = ["cfa-11916", "cfa-11951", "cfa-11956", "cfa-12032", "cfa-12058"];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

test("five real Dragontree-marker CONT abilities compile with their exact Rear-Guard scope", () => {
  const found = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) found.push(ability);
  }
  assert.deepEqual(found.map(ability => ability.cardId).sort(), [...CARDS].sort());
  for (const ability of found) {
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.definition.effects, [{ op: "continuous-power-per-dragontree-marker", target: "source", amount: 2000, duration: "continuous", condition: { op: "controller-turn" } }]);
    assert.equal(ability.conditionStatus, "modeled");
  }
});

test("power scales by the controller's Rear-Guard Dragontree markers only", () => {
  const ability = Engine.parseCardAbilitiesCached(catalog.find(card => card.id === CARDS[0])).find(value => value.definition?.source?.patternId === PATTERN);
  const evaluate = context => Engine.evaluateContinuousEffects([ability], { location: "rear-guard", sourceInstanceId: "source", targetInstanceId: "source", ...context }).power;
  assert.equal(evaluate({ isControllerTurn: true, dragontreeMarkerCount: 3 }), 6000);
  assert.equal(evaluate({ isControllerTurn: false, dragontreeMarkerCount: 3 }), 0);
  assert.equal(evaluate({ isControllerTurn: true, dragontreeMarkerCount: 0 }), 0);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "vanguard", isControllerTurn: true, dragontreeMarkerCount: 3 }).power, 0);
  assert.equal(evaluate({ isControllerTurn: true }), 0, "missing marker state fails closed");
});

test("authoritative attack power uses only the acting player's Rear-Guard markers for all five cards", () => {
  for (const side of ["human", "bot"]) for (const cardId of CARDS) {
    const card = catalog.find(value => value.id === cardId);
    const source = { uid: `source-${side}-${cardId}`, cardId, cardName: card.name, type: "Normal Unit", unitCard: true, grade: Number(card.grade), power: Number(card.power), critical: 1, ownerPlayerId: side === "human" ? "host" : "guest", controllerPlayerId: side === "human" ? "host" : "guest" };
    const ownVanguard = { uid: `vg-${side}`, cardId: "test-vg", cardName: "Test Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, ownerPlayerId: source.ownerPlayerId, controllerPlayerId: source.controllerPlayerId };
    const otherSide = side === "human" ? "bot" : "human", otherId = side === "human" ? "guest" : "host";
    const opposingVanguard = { uid: `opposing-vg-${side}`, cardId: "test-opponent-vg", cardName: "Opponent Vanguard", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, ownerPlayerId: otherId, controllerPlayerId: otherId };
    const makePlayer = (playerId, vanguard, rear, giftZones = []) => ({ playerId, vanguard, rear, giftZones, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
    const owner = makePlayer(source.ownerPlayerId, ownVanguard, [source], [
      { type: "Dragontree", zone: "rear-left" }, { type: "Dragontree", zone: "accel-1" },
      { type: "Dragontree", zone: "vanguard" }, { type: "Force", zone: "rear-right" }
    ]);
    const opponent = makePlayer(otherId, opposingVanguard, [], [{ type: "Dragontree", zone: "rear-left" }, { type: "Dragontree", zone: "rear-right" }]);
    const state = { matchId: `dragontree-scale-${side}-${cardId}`, stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, players: { [side]: owner, [otherSide]: opponent } };
    const result = Reducer.applyGameAction(state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `attack-${state.matchId}`, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opposingVanguard.uid } }, seats, Engine);
    assert.equal(result.ok, true, `${side}/${cardId}: ${result.reason}`);
    const separateOwnRearGuardBonus = cardId === "cfa-11951" ? 2000 : 0;
    assert.equal(state.pendingAttack.power, Number(card.power) + 4000 + separateOwnRearGuardBonus, `${side}/${cardId} counts two own RC markers, not Vanguard or opposing markers; other continuous abilities on the same source also apply`);
  }
});

test("browser and authoritative continuous-power contexts both include marker counts", () => {
  assert.match(fs.readFileSync("app.js", "utf8"), /dragontreeMarkerCount:\(player\.giftZones\|\|\[\]\)\.filter\(marker=>marker\?\.type==="Dragontree"/);
  assert.match(fs.readFileSync("ability-server-reducer.js", "utf8"), /dragontreeMarkerCount: \(player\.giftZones \|\| \[\]\)\.filter\(marker => marker\?\.type === "Dragontree"/);
});
