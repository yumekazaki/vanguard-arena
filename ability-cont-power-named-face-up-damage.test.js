"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const IDS = ["cfa-1619", "cfa-1622", "cfa-1623"];
const PATTERN = "cont-vc-rc-own-turn-named-face-up-damage-power-v1";
const CARD_NAME = "Operation Celestial, Armen";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

test("all three exact named-face-up Damage Zone CONT abilities preserve the printed card name", () => {
  const found = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) found.push(ability);
  assert.deepEqual(found.map(ability => ability.cardId).sort(), IDS.slice().sort());
  for (const ability of found) {
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.definition.effects, [{ op: "continuous-power-per-named-face-up-damage-card", target: "source", amount: 2000, cardName: CARD_NAME, duration: "continuous", condition: { op: "controller-turn" } }]);
  }
});

test("scaling counts distinct face-up matching instances in only the controller's Damage Zone", () => {
  const ability = Engine.parseCardAbilitiesCached(catalog.find(card => card.id === IDS[0])).find(value => value.definition?.source?.patternId === PATTERN);
  const damage = [{ uid: "match1", names: [CARD_NAME] }, { uid: "match1", names: [CARD_NAME] }, { uid: "face-down", names: [CARD_NAME], faceDown: true }, { uid: "wrong-name", names: ["Different Card"] }];
  const evaluate = (location, isControllerTurn, controllerDamageCards) => Engine.evaluateContinuousEffects([ability], { location, sourceInstanceId: "source", targetInstanceId: "source", isControllerTurn, controllerDamageCards }).power;
  assert.equal(evaluate("vanguard", true, damage), 2000);
  assert.equal(evaluate("rear-guard", true, [{ uid: "a", names: [CARD_NAME] }, { uid: "b", names: [CARD_NAME] }]), 4000);
  assert.equal(evaluate("vanguard", false, damage), 0);
  assert.equal(evaluate("guardian", true, damage), 0);
  assert.equal(evaluate("vanguard", true, undefined), 0, "missing private Damage Zone data fails closed");
});

test("both online seats use their own face-up named damage for authoritative attack power", () => {
  for (const side of ["human", "bot"]) for (const cardId of IDS) {
    const definition = catalog.find(card => card.id === cardId), ownerId = side === "human" ? "host" : "guest", opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "guest" : "host";
    const unit = (uid, id, name, power, playerId, grade = 1) => ({ uid, cardId: id, cardName: name, type: "Normal Unit", unitCard: true, grade, power, critical: 1, ownerPlayerId: playerId, controllerPlayerId: playerId });
    const source = unit(`source-${side}-${cardId}`, cardId, definition.name, Number(definition.power), ownerId, Number(definition.grade));
    const target = unit(`target-${side}`, "test-vg", "Test Vanguard", 13000, opponentId, 3);
    const matchingDamage = { uid: `damage-${side}`, cardId: "armen", cardName: CARD_NAME, ownerPlayerId: ownerId, controllerPlayerId: ownerId };
    const opponentMatchingDamage = { uid: `opponent-damage-${side}`, cardId: "armen", cardName: CARD_NAME, ownerPlayerId: opponentId, controllerPlayerId: opponentId };
    const player = (playerId, vanguard, damage) => ({ playerId, vanguard, rear: [], damage, deck: [], hand: [], drop: [], soul: [], bind: [], orders: [], crests: [], giftZones: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
    const state = { matchId: `named-face-up-damage-${side}-${cardId}`, stateVersion: 0, turn: 4, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
      players: { [side]: player(ownerId, source, [matchingDamage]), [opponentSide]: player(opponentId, target, [opponentMatchingDamage]) } };
    const command = { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `attack-${state.matchId}`, expectedStateVersion: 0, payload: { action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: target.uid } };
    const result = Reducer.applyGameAction(state, command, seats, Engine);
    assert.equal(result.ok, true, `${side}/${cardId}: ${result.reason}`);
    assert.equal(state.pendingAttack.power, Number(definition.power) + 2000, `${side}/${cardId} must count only their own matching face-up damage card`);
  }
});

test("browser and authoritative continuous contexts pass only the controller's damage instances", () => {
  assert.match(fs.readFileSync("app.js", "utf8"), /controllerDamageCards:\(player\.damage\|\|\[\]\)\.filter\(card=>card&&typeof card\.uid==="string"\)/);
  assert.match(fs.readFileSync("ability-server-reducer.js", "utf8"), /controllerDamageCards: \(player\.damage \|\| \[\]\)\.filter\(card => card && typeof card\.uid === "string"\)/);
});
