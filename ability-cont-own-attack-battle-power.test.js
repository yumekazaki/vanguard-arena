"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const IDS = ["cfa-8233", "cfa-8237", "cfa-10048"];
const PATTERN = "cont-vc-rc-own-attack-battle-power-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

test("all three exact own-attack CONT abilities preserve source circles and battle power", () => {
  const found = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) found.push(ability);
  assert.deepEqual(found.map(ability => ability.cardId).sort(), IDS.slice().sort());
  for (const ability of found) {
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.definition.effects, [{ op: "continuous-power", target: "source", amount: 2000, duration: "continuous", condition: { op: "source-attacked-this-battle" } }]);
  }
});

test("the bonus requires this exact source to be the attacker in the current battle", () => {
  const ability = Engine.parseCardAbilitiesCached(catalog.find(card => card.id === IDS[0])).find(value => value.definition?.source?.patternId === PATTERN);
  const evaluate = (location, sourceAttackedThisBattle) => Engine.evaluateContinuousEffects([ability], { location, sourceInstanceId: "source", targetInstanceId: "source", sourceAttackedThisBattle }).power;
  assert.equal(evaluate("vanguard", true), 2000);
  assert.equal(evaluate("rear-guard", true), 2000);
  assert.equal(evaluate("rear-guard", false), 0);
  assert.equal(evaluate("guardian", true), 0);
});

test("host and joining player get the bonus only for their own attacking source", () => {
  for (const side of ["human", "bot"]) for (const cardId of IDS) {
    const definition = catalog.find(card => card.id === cardId), ownerId = side === "human" ? "host" : "guest", opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "guest" : "host";
    const unit = (uid, id, name, power, playerId, grade = 1) => ({ uid, cardId: id, cardName: name, type: "Normal Unit", unitCard: true, grade, power, critical: 1, ownerPlayerId: playerId, controllerPlayerId: playerId });
    const source = unit(`source-${side}-${cardId}`, cardId, definition.name, Number(definition.power), ownerId, Number(definition.grade));
    const defender = unit(`defender-${side}`, "test-defender", "Test Defender", 13000, opponentId, 3);
    const player = (playerId, vanguard, rear) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], giftZones: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
    const state = { matchId: `own-attack-cont-${side}-${cardId}`, stateVersion: 0, turn: 4, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
      players: { [side]: player(ownerId, source, []), [opponentSide]: player(opponentId, defender, []) } };
    const action = { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `attack-${state.matchId}`, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: defender.uid } };
    const result = Reducer.applyGameAction(state, action, seats, Engine);
    assert.equal(result.ok, true, `${side}/${cardId}: ${result.reason}`);
    assert.equal(state.pendingAttack.power, Number(definition.power) + 2000, `${side}/${cardId}`);
  }
});

test("browser and authoritative continuous contexts identify the exact attacking instance", () => {
  assert.match(fs.readFileSync("app.js", "utf8"), /sourceAttackedThisBattle:attack\?\.attackerUid===instance\.uid/);
  assert.match(fs.readFileSync("ability-server-reducer.js", "utf8"), /sourceAttackedThisBattle: attackContext\?\.attackerUid === instance\.uid/);
});
