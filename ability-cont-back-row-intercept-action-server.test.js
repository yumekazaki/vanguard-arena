"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-gc-named-vanguard-back-row-intercept-shield-v1";
const CARD_IDS = ["cfa-13243", "cfa-13253", "cfa-13264", "cfa-13309"];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardDefinition = id => {
  const card = catalog.find(value => String(value.id) === String(id));
  assert.ok(card, `catalog card ${id} exists`);
  return card;
};
const abilityFor = id => {
  const ability = Engine.parseCardAbilitiesCached(cardDefinition(id)).find(value => value.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `${id} uses the reviewed back-row Intercept pattern`);
  return ability;
};
const abilityCondition = ability => {
  const effect = ability.definition.continuousEffects?.find(value => value.keyword === "back-row-intercept");
  assert.ok(effect, `${ability.id} grants conditional back-row Intercept`);
  const conditions = effect.condition?.op === "all" ? effect.condition.conditions : [effect.condition];
  const grade = conditions.find(value => value?.op === "controller-vanguard-grade-at-least");
  const name = conditions.find(value => value?.op === "controller-vanguard-card-name-contains");
  assert.ok(grade && name?.name, `${ability.id} has grade and Vanguard-name conditions`);
  return { grade: Number(grade.grade), name: String(name.name) };
};
const instance = (card, uid, playerId, extra = {}) => ({
  uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit", grade: Number(card.grade),
  power: Number(card.power || 0), shield: Number(card.shield || 0), ownerPlayerId: playerId, controllerPlayerId: playerId,
  unitCard: true, ...extra
});

function fixture({ cardId = CARD_IDS[0], ownerSide = "bot", row = "back", grade, sourceGrade, matchingName = true, attacked = false } = {}) {
  const card = cardDefinition(cardId), ability = abilityFor(cardId), required = abilityCondition(ability);
  const ownerId = ownerSide === "human" ? "host-player" : "guest-player";
  const attackerSide = ownerSide === "human" ? "bot" : "human";
  const attackerId = attackerSide === "human" ? "host-player" : "guest-player";
  const authUid = ownerSide === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const rowIndex = row === "front" ? 0 : row === "accel" ? 5 : 2;
  const circle = row === "front" ? "rear-left" : row === "accel" ? "accel-1" : "rear-back-left";
  const source = instance(card, `${ownerSide}-intercept-source`, ownerId, { circle, position: row === "back" ? "back-left" : "front-left", ...(sourceGrade == null ? {} : { grade: sourceGrade }) });
  const vanguard = instance({ id: `${ownerSide}-test-vanguard`, name: matchingName ? `Test ${required.name} unit` : "Unrelated Vanguard", type: "Unit", grade: 3 }, `${ownerSide}-vg`, ownerId, { grade: grade ?? required.grade, cardName: matchingName ? `Test ${required.name} unit` : "Unrelated Vanguard" });
  const attackingVanguard = instance({ id: `${attackerSide}-test-vanguard`, name: "Attacking Vanguard", type: "Unit", grade: 3 }, `${attackerSide}-vg`, attackerId, { grade: 3 });
  const owner = { playerId: ownerId, vanguard, rear: [null, null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  owner.rear[rowIndex] = source;
  const attacker = { playerId: attackerId, vanguard: attackingVanguard, rear: [null, null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = ownerSide === "human" ? { human: owner, bot: attacker } : { human: attacker, bot: owner };
  const target = attacked ? source : vanguard;
  const attack = {
    battleId: `intercept-${ownerSide}-${cardId}`, attackerSide, attackerPlayerId: attackerId, attackerUid: attackingVanguard.uid,
    attackerZone: "vanguard", defenderSide: ownerSide, defenderPlayerId: ownerId, targetUid: target.uid,
    targetZone: attacked ? circle : "vanguard", guardCards: [], power: 20000, targetPower: 10000, critical: 1, defenderDone: false
  };
  const state = {
    matchId: "back-row-intercept-match", stateVersion: 9, turn: 3, side: attackerSide, phase: 5,
    eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [],
    players, pendingAttack: attack
  };
  return { state, owner, attacker, source, ability, card, rowIndex, circle, ownerSide, authUid, attack };
}

function act(f, { authUid = f.authUid, id = `intercept-${f.ownerSide}-${f.card.id}`, cardInstanceId = f.source.uid, expectedStateVersion = f.state.stateVersion } = {}) {
  return Reducer.applyGameAction(f.state, {
    actorAuthUid: authUid, actionId: id, expectedStateVersion,
    payload: { type: "game-action", action: "intercept", cardInstanceId }
  }, seats, Engine);
}

test("only the four exact named-Vanguard back-row Intercept abilities compile for this batch", () => {
  const family = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) family.push(ability);
  }
  assert.equal(family.length, CARD_IDS.length);
  assert.deepEqual(family.map(value => value.cardId).sort(), CARD_IDS.slice().sort());
});

test("both seats can use the exact matching back-row Intercept and shield is applied once", () => {
  for (const cardId of CARD_IDS) for (const ownerSide of ["human", "bot"]) {
    const f = fixture({ cardId, ownerSide });
    const shieldEffect = f.ability.definition.effects.find(value => value.op === "continuous-shield");
    const expectedShield = Number(f.card.shield || 0) + Number(shieldEffect.amount);
    const result = act(f);
    assert.equal(result.ok, true, `${cardId}/${ownerSide}: ${result.reason}`);
    assert.equal(f.owner.rear[f.rowIndex], null);
    assert.equal(f.owner.guardCircle.find(value => value.uid === f.source.uid), f.source);
    assert.equal(f.source.circle, "guardian");
    assert.equal(f.attack.targetPower, 10000 + expectedShield);
    assert.equal(f.attack.defenderDone, false, "intercept leaves the guard window open");
    const event = result.events.find(value => value.type === "card.placed" && value.subjectCardInstanceId === f.source.uid);
    assert.ok(event, "intercept emits a placement event for the exact card instance");
    assert.equal(event.previousLocation, f.circle);
    assert.equal(event.currentLocation, "guardian");
    assert.equal(event.actingPlayerId, f.owner.playerId);
    assert.equal(event.subjectControllerPlayerId, f.owner.playerId);
    assert.equal(event.targetCardInstanceIds[0], f.attack.targetUid);
    assert.equal(event.battleId, f.attack.battleId);
    assert.equal(event.timingWindow, "intercept");
  }
});

test("a back-row unit cannot intercept unless its controller meets both Vanguard conditions", () => {
  for (const options of [{ grade: 2, matchingName: true }, { grade: 3, matchingName: false }]) {
    const f = fixture(options), before = JSON.stringify(f.state);
    const result = act(f);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "back-row-intercept-not-permitted");
    assert.equal(JSON.stringify(f.state), before, "rejected action makes no partial state change");
  }
});

test("the unit being attacked cannot intercept itself", () => {
  const f = fixture({ attacked: true }), before = JSON.stringify(f.state);
  const result = act(f);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "attacked-unit-cannot-intercept");
  assert.equal(JSON.stringify(f.state), before);
});

test("a Grade 2 front-row unit can intercept without the conditional Vanguard requirement", () => {
  const f = fixture({ row: "front", sourceGrade: 2, grade: 2, matchingName: false });
  const result = act(f);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.owner.guardCircle[0].uid, f.source.uid);
});

test("wrong player, missing source, stale version, and duplicate request are rejected safely", () => {
  const f = fixture({ ownerSide: "bot" }), before = JSON.stringify(f.state);
  assert.equal(act(f, { authUid: seats.hostAuthUid }).reason, "not-defender-response-window");
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(act(f, { id: "missing-intercept-source", cardInstanceId: "not-on-field" }).reason, "intercept-source-not-controlled-rear-guard");
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(act(f, { id: "stale-intercept", expectedStateVersion: f.state.stateVersion - 1 }).reason, "stale-state-version");
  assert.equal(JSON.stringify(f.state), before);
  const commandId = "single-intercept-action";
  assert.equal(act(f, { id: commandId }).ok, true);
  const after = JSON.stringify(f.state);
  assert.equal(act(f, { id: commandId }).reason, "duplicate-action");
  assert.equal(JSON.stringify(f.state), after);
});
