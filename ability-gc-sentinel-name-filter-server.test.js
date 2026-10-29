"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-gc-sentinel-protect-friendly-unit-name-filter-v1";
const FAMILY = new Map([
  ["cfa-5115", "Deletor"], ["cfa-5274", "Blue Wave"], ["cfa-5348", "Machining"],
  ["cfa-5354", "Honorary Professor"], ["cfa-5357", "Musketeer"], ["cfa-5370", "Darkface"],
  ["cfa-5600", "Regalia"], ["cfa-5656", "PR<3ISM"]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const card = id => { const found = catalog.find(item => String(item.id) === String(id)); assert.ok(found, `catalog card ${id}`); return found; };
const findNamedUnit = name => catalog.find(item => /unit/i.test(String(item.type || "")) && String(item.name || "").includes(name));
function instance(definition, uid, playerId, extra = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit", grade: Number(definition.grade),
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...extra };
}
function abilityFor(cardId) {
  return Engine.parseCardAbilitiesCached(card(cardId)).find(item => item.definition?.source?.patternId === PATTERN);
}
function fixture(cardId, side = "bot", options = {}) {
  const ability = abilityFor(cardId), targetName = FAMILY.get(cardId);
  assert.ok(ability, `${cardId} compiles the name-filtered Sentinel ability`);
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const source = instance(card(cardId), `source-${cardId}-${side}`, ownerId, { zone: "guardian", circle: "guardian" });
  const payment = instance(card("cfa-3"), `payment-${cardId}-${side}`, ownerId);
  const matching = options.mismatchedTarget ? card("cfa-3") : findNamedUnit(targetName);
  assert.ok(matching, `catalog has a matching friendly ${targetName} unit`);
  const target = instance(matching, `target-${cardId}-${side}`, ownerId, { zone: "rear-guard", circle: "rear-left" });
  const ownerVanguard = instance(card("cfa-3"), `owner-vg-${cardId}-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  const opponentVanguard = instance(card("cfa-3"), `opponent-vg-${cardId}-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const owner = { playerId: ownerId, vanguard: ownerVanguard, rear: [target, null, null, null, null], hand: options.noCost ? [] : [payment],
    soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [source], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: opponentVanguard, rear: [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: `sentinel-name-${cardId}-${side}`, stateVersion: 1, turn: 2, side: opponentSide, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [],
    players: side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner },
    pendingAttack: { battleId: `battle-${cardId}-${side}`, attackerSide: opponentSide, attackerUid: opponentVanguard.uid,
      attackerZone: "vanguard", defenderSide: side, targetUid: target.uid, targetZone: "rear-left", guardCards: [source], power: 18000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: opponentId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", phase: "battle", timingWindow: "guard",
    battleId: state.pendingAttack.battleId });
  return { state, event, ability, source, payment, target, owner, opponent, side, ownerId, targetName };
}
function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function decide(f, { accept = true, actorAuthUid, targetUid = f.target.uid, costUid = f.payment.uid } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actorAuthUid || (f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId: `name-filter-${f.source.uid}-${accept}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, targetUid,
      costSelections: { cb: [], sb: [], discard: costUid ? [costUid] : [], reveal: [] } } } }, seats, Engine);
}

test("all eight name-filtered GC Sentinel abilities are exact trusted definitions", () => {
  const found = [];
  for (const source of catalog) for (const ability of Engine.parseCardAbilitiesCached(source)) if (ability.definition?.source?.patternId === PATTERN) found.push(ability);
  assert.equal(found.length, FAMILY.size);
  assert.deepEqual(found.map(item => item.cardId).sort(), [...FAMILY.keys()].sort());
  for (const ability of found) {
    const name = FAMILY.get(ability.cardId);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(item => item.id === ability.id), ability.id);
    assert.equal(ability.id, `${ability.cardId}:1`);
    assert.equal(ability.definition.printedText, ability.printedText);
    assert.deepEqual(ability.costs, [{ type: "discard", count: 1 }]);
    assert.equal(ability.definition.effects[0].targetFilter.cardNameContains, name);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, ability.id);
    const tampered = structuredClone(ability); tampered.definition.effects[0].targetFilter.cardNameContains = "wrong name";
    assert.equal(Reducer.supportsServerAbilityEffects(tampered), false, ability.id);
    const wrongText = structuredClone(ability); wrongText.definition.printedText += " Extra effect.";
    assert.equal(Reducer.supportsServerAbilityEffects(wrongText), false, ability.id);
    const wrongCost = structuredClone(ability); wrongCost.costs[0].count = 2;
    assert.equal(Reducer.supportsServerAbilityEffects(wrongCost), false, ability.id);
    const wrongTrigger = structuredClone(ability); wrongTrigger.trigger.sourceLocation = "drop";
    assert.equal(Reducer.supportsServerAbilityEffects(wrongTrigger), false, ability.id);
    const wrongSource = structuredClone(ability); wrongSource.cardId = "cfa-3";
    assert.equal(Reducer.supportsServerAbilityEffects(wrongSource), false, ability.id);
  }
});

test("host and joining player independently pay and protect only their printed name-filtered unit", () => {
  for (const cardId of FAMILY.keys()) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side);
    assert.equal(discover(f).queued.length, 1, `${cardId}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = decide(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.perfectGuard, true);
    assert.deepEqual(f.owner.drop.map(item => item.uid), [f.payment.uid]);
    assert.equal(f.owner.hand.length, 0);
    assert.deepEqual(f.opponent.drop, []);
    assert.deepEqual(f.opponent.hand, []);
  }
});

test("a friendly unit with a mismatched printed name cannot be selected or paid for", () => {
  for (const cardId of FAMILY.keys()) {
    const f = fixture(cardId, "bot");
    f.owner.rear[0] = instance(card("cfa-3"), `wrong-target-${cardId}`, f.ownerId, { zone: "rear-guard", circle: "rear-left" });
    f.target = f.owner.rear[0]; f.state.pendingAttack.targetUid = f.target.uid;
    assert.equal(discover(f).queued.length, 1);
    const before = JSON.stringify(f.state), result = decide(f);
    assert.equal(result.ok, false, cardId);
    assert.equal(JSON.stringify(f.state), before, cardId);
  }
});

test("wrong source, non-hand placement, wrong circle, and unavailable discard never resolve", () => {
  const ability = abilityFor("cfa-5115");
  for (const change of [
    { type: "card.moved" },
    { previousLocation: "drop" },
    { currentLocation: "rear-left", circle: "rear-left" },
    { sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other" }
  ]) {
    const f = fixture("cfa-5115", "human");
    assert.equal(discover(f, { ...f.event, ...change }).queued.length, 0, JSON.stringify(change));
  }
  const noCost = fixture("cfa-5115", "bot", { noCost: true });
  assert.equal(discover(noCost).queued.length, 1);
  const before = JSON.stringify(noCost.state), rejected = decide(noCost, { costUid: "missing-payment" });
  assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(noCost.state), before);
  assert.ok(ability);
});

test("declining pays no discard and a host cannot proxy the joining player's prompt", () => {
  const declined = fixture("cfa-5115", "bot");
  assert.equal(discover(declined).queued.length, 1);
  assert.equal(decide(declined, { accept: false }).ok, true);
  assert.deepEqual(declined.owner.hand.map(item => item.uid), [declined.payment.uid]);
  assert.deepEqual(declined.owner.drop, []);
  assert.equal(declined.state.pendingAttack.perfectGuard, undefined);

  const joined = fixture("cfa-5274", "bot");
  assert.equal(discover(joined).queued.length, 1);
  const before = JSON.stringify(joined.state), proxy = decide(joined, { actorAuthUid: seats.hostAuthUid });
  assert.equal(proxy.ok, false);
  assert.equal(JSON.stringify(joined.state), before);
});
