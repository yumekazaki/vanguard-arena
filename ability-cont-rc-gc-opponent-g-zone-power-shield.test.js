"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const definitions = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(definitions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-gc-opponent-g-zone-power-shield-v1";
const IDS = ["cfa-13230:0", "cfa-13244:0", "cfa-13254:0", "cfa-13278:0", "cfa-13283:0"];
const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function parsedAbilities() {
  const found = new Map();
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, { card, ability });
  }
  return found;
}

test("the exact five catalog abilities compile to separate non-stacking RC power and GC shield effects", () => {
  const found = parsedAbilities(), audit = auditCatalog(catalog);
  assert.equal(found.size, IDS.length);
  assert.equal(audit.patterns[PATTERN], IDS.length);
  for (const id of IDS) {
    const ability = found.get(id)?.ability;
    assert.ok(ability, id);
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["rear-guard", "guardian"]);
    assert.equal(ability.definition.effects.length, 4);
    assert.equal(ability.definition.effects[0].condition.op, "opponent-g-zone-has-card-and-no-face-up-card");
    assert.equal(ability.definition.effects[1].condition.op, "opponent-g-zone-has-face-up-card");
    assert.equal(ability.definition.effects[2].condition.op, "opponent-g-zone-has-card-and-no-face-up-card");
    assert.equal(ability.definition.effects[3].condition.op, "opponent-g-zone-has-face-up-card");
  }
  assert.equal(audit.invalidCompiled.length, 0);
});

test("RC power and GC shield apply only in the correct opponent G-zone state and on both turns", () => {
  for (const id of IDS) {
    const ability = parsedAbilities().get(id).ability;
    const evaluate = (location, opponentGZoneCardCount, opponentFaceUpGZoneCardCount) => ({
      power: Engine.evaluateContinuousEffects([ability], { location, sourceInstanceId: id, targetInstanceId: id, isControllerTurn: false, opponentGZoneCardCount, opponentFaceUpGZoneCardCount }).power,
      shield: Engine.evaluateContinuousShieldEffects([ability], { location, opponentGZoneCardCount, opponentFaceUpGZoneCardCount }).shield
    });
    assert.deepEqual(evaluate("rear-guard", 0, 0), { power: 0, shield: 0 }, id);
    assert.deepEqual(evaluate("rear-guard", 2, 0), { power: 5000, shield: 0 }, id);
    assert.deepEqual(evaluate("rear-guard", 2, 1), { power: 10000, shield: 0 }, id);
    assert.deepEqual(evaluate("guardian", 2, 0), { power: 0, shield: 5000 }, id);
    assert.deepEqual(evaluate("guardian", 2, 1), { power: 0, shield: 10000 }, id);
    assert.deepEqual(evaluate("vanguard", 2, 1), { power: 0, shield: 0 }, id);
  }
});

test("authoritative attack power uses the opponent's G-zone state for host and joining player", () => {
  const found = parsedAbilities();
  const makePlayer = (playerId, vanguard, rear, gZone = []) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone, removed: [], triggerZone: [] });
  for (const side of ["human", "bot"]) for (const id of IDS) {
    const card = found.get(id).card, opponentSide = side === "human" ? "bot" : "human";
    const owner = side === "human" ? "host" : "guest", opponent = side === "human" ? "guest" : "host";
    const source = { uid: `source-${id}-${side}`, cardId: card.id, cardName: card.name, type: card.type, unitCard: true, grade: Number(card.grade), power: Number(card.power), critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
    const vgCard = catalog.find(item => Number(item.grade) >= 3 && item.type === "Unit" && item.id !== card.id);
    const vg = { uid: `vg-${id}-${side}`, cardId: vgCard.id, cardName: vgCard.name, type: vgCard.type, unitCard: true, grade: Number(vgCard.grade), power: Number(vgCard.power), critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
    const opponentVanguard = { ...vg, uid: `opp-${id}-${side}`, ownerPlayerId: opponent, controllerPlayerId: opponent };
    const state = { matchId: `g-zone-cont-${id}-${side}`, stateVersion: 0, turn: 5, side, phase: 5, firstTurnComplete: true, processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
    state.players[side] = makePlayer(owner, vg, [source, null, null, null, null]);
    state.players[opponentSide] = makePlayer(opponent, opponentVanguard, Array(5).fill(null), [{ uid: `opponent-g-${id}-${side}`, cardId: "g-zone-fixture", faceUp: true }]);
    const action = { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: `attack-${id}-${side}`, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: opponentVanguard.uid } };
    const result = Reducer.applyGameAction(state, action, seats, Engine);
    assert.equal(result.ok, true, `${side}/${id}: ${result.reason}`);
    assert.equal(result.state.pendingAttack.power, Number(card.power) + 10000, `${side}/${id} gets the face-up G-zone amount`);
    source.rested = false;
    state.players[opponentSide].gZone[0].faceUp = false;
    const faceDown = Reducer.applyGameAction({ ...state, pendingAttack: null, stateVersion: 0, processedActionIds: [] }, { ...action, actionId: `face-down-${id}-${side}` }, seats, Engine);
    assert.equal(faceDown.ok, true, `${side}/${id} with face-down G card: ${faceDown.reason}`);
    assert.equal(faceDown.state.pendingAttack.power, Number(card.power) + 5000, `${side}/${id} gets base G-zone amount`);
  }
});
