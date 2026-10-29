"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
Engine.registerCardAbilityKeywordIndex(require("./card-ability-keywords.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const PATTERN = "cont-vanguard-own-turn-power-per-clan-rearguard-v1";
const FAMILY = new Map([
  ["cfa-1739", { clan: "Gold Paladin", amount: 1000, index: 1 }],
  ["cfa-1864", { clan: "Gold Paladin", amount: 1000, index: 2 }],
  ["cfa-220", { clan: "Gold Paladin", amount: 1000, index: 1 }],
  ["cfa-38", { clan: "Shadow Paladin", amount: 2000, index: 1 }],
  ["cfa-686", { clan: "Royal Paladin", amount: 2000, index: 1 }],
]);
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };

function fixture({ cardId = "cfa-1739", side = "human", ownMatching = 3, opponentMatching = 2, defendingOwnerTurn = false } = {}) {
  const card = catalog.find(value => value.id === cardId), entry = FAMILY.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(value => value.id === `${cardId}:${entry.index}`);
  const ownerId = side === "human" ? "player-host" : "player-guest", opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${cardId}-${side}`, cardId, cardName: card.name, type: "Unit", unitCard: true, grade: Number(card.grade), power: Number(card.power), critical: 1, clan: entry.clan, clans: [entry.clan], ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  const rear = (controllerId, prefix, count, clan) => Array.from({ length: 5 }, (_, i) => i < count ? { uid: `${prefix}-${i}`, cardId: `${prefix}-card-${i}`, cardName: `${clan} unit ${i}`, type: "Unit", grade: 1, power: 8000, clan, clans: [clan], ownerPlayerId: controllerId, controllerPlayerId: controllerId } : null);
  const own = rear(ownerId, `own-${cardId}-${side}`, ownMatching, entry.clan), otherClan = rear(ownerId, `other-${cardId}-${side}`, 1, "Kagero"), opposing = rear(opponentId, `opp-${cardId}-${side}`, opponentMatching, entry.clan);
  const otherVanguard = { uid: `other-vg-${cardId}-${side}`, cardId: "other-vg", cardName: "Other Vanguard", type: "Unit", unitCard: true, grade: 3, power: 13000, critical: 1, clan: "Kagero", clans: ["Kagero"], ownerPlayerId: opponentId, controllerPlayerId: opponentId };
  const player = (id, vanguard, field) => ({ playerId: id, vanguard, rear: field, hand: [], soul: [], drop: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [], removed: [], crests: [], extra: [] });
  const owner = player(ownerId, source, own), opponent = player(opponentId, otherVanguard, opposing);
  const activeSide = defendingOwnerTurn ? opponentSide : side, attackerSide = activeSide, attackerPlayer = activeSide === side ? owner : opponent, defender = activeSide === side ? opponent : owner;
  const state = { matchId: `cont-clan-scale-${cardId}-${side}`, stateVersion: 1, turn: 4, side: activeSide, phase: 5, firstTurnComplete: true, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, pendingAttack: null, players: { [side]: owner, [opponentSide]: opponent } };
  const command = { actorAuthUid: attackerSide === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId: `attack-${state.matchId}`, expectedStateVersion: state.stateVersion, payload: { type: "game-action", action: "attack", attackerCardInstanceId: attackerPlayer.vanguard.uid, targetCardInstanceId: defender.vanguard.uid } };
  return { card, ability, entry, state, command, source, owner, opponent, side, own, otherClan, opposing };
}

test("five real Vanguard CONT abilities compile the printed per-clan power and source location", () => {
  for (const [cardId, expected] of FAMILY) {
    const card = catalog.find(value => value.id === cardId), ability = Engine.parseCardAbilitiesCached(card).find(value => value.definition?.source?.patternId === PATTERN);
    assert.ok(ability, cardId); assert.equal(ability.id, `${cardId}:${expected.index}`); assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["vanguard"]); assert.equal(ability.definition.effects[0].amount, expected.amount);
    assert.equal(ability.definition.effects[0].clan, expected.clan); assert.deepEqual(ability.definition.effects[0].condition, { op: "controller-turn" });
    assert.equal(ability.conditionStatus, "modeled");
  }
});

test("host and joining player receive only their own matching Rear-Guard scaling", () => {
  for (const [cardId, expected] of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, side }), result = Reducer.applyGameAction(f.state, f.command, SEATS, Engine);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, Number(f.source.power) + expected.amount * 3, `${cardId}/${side}`);
  }
});

test("count ignores Vanguard and other clans and de-duplicates an instance ID", () => {
  const f = fixture({ cardId: "cfa-38", ownMatching: 1 });
  const fields = [{ uid: f.source.uid, zone: "vanguard", clans: ["Shadow Paladin"] }, ...f.own.filter(Boolean).map(card => ({ uid: card.uid, zone: "rear-guard", clans: card.clans })), { uid: f.own[0].uid, zone: "rear-guard", clans: f.own[0].clans }, { uid: "other-clan", zone: "rear-guard", clans: ["Kagero"] }];
  const result = Engine.evaluateContinuousEffects([f.ability], { sourceLocation: "vanguard", location: "vanguard", sourceInstanceId: f.source.uid, targetInstanceId: f.source.uid, isControllerTurn: true, controllerFieldCards: fields });
  assert.equal(result.power, 2000);
});

test("a Rear-Guard with the all-clans-and-nations keyword counts for the printed clan", () => {
  const f = fixture({ cardId: "cfa-38", ownMatching: 1 }), allClansCard = catalog.find(card => Engine.hasAbilityKeyword(card.id, "all-clans-and-nations"));
  assert.ok(allClansCard, "catalog has a real all-clans-and-nations unit");
  const unit = { uid: "all-clans-unit", cardId: allClansCard.id, cardName: allClansCard.name, type: "Unit", grade: Number(allClansCard.grade), power: Number(allClansCard.power), ownerPlayerId: f.owner.playerId, controllerPlayerId: f.owner.playerId };
  f.owner.rear[1] = unit;
  const result = Reducer.applyGameAction(f.state, f.command, SEATS, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.state.pendingAttack.power, Number(f.source.power) + 4000);
});

test("power is absent off turn or when the Vanguard is outside VC", () => {
  const f = fixture({ cardId: "cfa-686" }), context = { sourceInstanceId: f.source.uid, targetInstanceId: f.source.uid, controllerFieldCards: [{ uid: "rear", zone: "rear-guard", clan: "Royal Paladin" }] };
  assert.deepEqual(Engine.evaluateContinuousEffects([f.ability], { ...context, location: "vanguard", sourceLocation: "vanguard", isControllerTurn: false }), { power: 0, critical: 0, drive: 0 });
  assert.deepEqual(Engine.evaluateContinuousEffects([f.ability], { ...context, location: "rear-guard", sourceLocation: "rear-guard", isControllerTurn: true }), { power: 0, critical: 0, drive: 0 });
});

test("client continuous context labels Vanguard and Rear-Guard circles and supplies clan keywords", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /controllerFieldCards:[\s\S]{0,450}zone:instance\.uid===player\.vanguard\?\.uid\?"vanguard":"rear-guard"/);
  assert.match(app, /allClansAndNations:window\.VanguardAbilityEngine\.hasAbilityKeyword\(instance\.cardId,"all-clans-and-nations"\)/);
});
