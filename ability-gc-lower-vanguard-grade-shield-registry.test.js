"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-10672", "cfa-10673", "cfa-10674", "cfa-10675", "cfa-10676", "cfa-12346"];
const TEXT = "AUTO: When this unit is put on GC, if your vanguard’s grade is less than your opponent’s vanguard’s grade, this unit gets shield +10000 until end of that battle.";
const PATTERN = "auto-gc-controller-vanguard-lower-grade-shield-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(id, uid, playerId, grade = 0) {
  const row = catalog.find(item => item.id === id) || {};
  return { uid, cardId: id, cardName: row.name || id, type: row.type || "Unit", grade, ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(cardId = IDS[0], defenderSide = "bot", lower = true) {
  const definition = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled ${cardId}:0`);
  const attackerSide = defenderSide === "human" ? "bot" : "human";
  const ownerId = defenderSide === "human" ? "player-host" : "player-guest";
  const attackerId = defenderSide === "human" ? "player-guest" : "player-host";
  const source = card(cardId, `guard-${cardId}-${defenderSide}`, ownerId);
  const ownVanguard = card("cfa-3", `own-vg-${defenderSide}`, ownerId, lower ? 1 : 3);
  const opposingVanguard = card("cfa-3", `opponent-vg-${defenderSide}`, attackerId, lower ? 3 : 1);
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const owner = player(ownerId), opponent = player(attackerId);
  owner.vanguard = ownVanguard;
  owner.guardCircle.push(source);
  opponent.vanguard = opposingVanguard;
  const players = defenderSide === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const battleId = `lower-grade-${cardId}-${defenderSide}`;
  const state = { matchId: "lower-grade-gc-shield", stateVersion: 1, eventSequence: 0, turn: 3, side: attackerSide, phase: 5,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: { battleId, attackerSide, attackerUid: opposingVanguard.uid, attackerZone: "vanguard", attackerPlayerId: attackerId,
      defenderSide, targetUid: ownVanguard.uid, targetZone: "vanguard", guardCards: [source], targetPower: 10000 }, players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: attackerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", targetCardInstanceIds: [ownVanguard.uid],
    targetLocation: "vanguard", battleId, phase: "battle", timingWindow: "guard-placement" });
  return { ability, source, state, event, defenderSide, ownerId };
}
function resolve(f) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.defenderSide === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `resolve-lower-grade-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("six exact lower-grade shield abilities are present as production-trusted definitions", () => {
  for (const id of IDS) {
    const row = catalog.find(item => item.id === id);
    assert.ok(row, id);
    const parsed = Engine.parseCardAbilitiesCached(row);
    const ability = parsed.find(item => item.id === `${id}:0`);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(ability.requiredLocation, ["guardian"], id);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-grade-lower-than-opponent" }], id);
    assert.deepEqual(ability.effects, [{ op: "modify-shield-source", target: "source", amount: 10000, duration: "battle" }], id);
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(id).filter(item => item.source?.patternId === PATTERN);
    assert.equal(trusted.length, 1, id);
    assert.equal(trusted[0].id, `${id}:0`, id);
    assert.equal(trusted[0].printedText, TEXT, id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    assert.equal(parsed.filter(item => item.id !== ability.id).length, Math.max(0, parsed.length - 1), id);
  }
});

test("the legal Guardian for either defender gains battle shield only when its Vanguard is lower grade", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${id}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.source.battleShieldBoost, 10000);
    assert.equal(f.source.battleShieldExpiryBattleId, f.state.pendingAttack.battleId);
  }
});

test("equal/higher Vanguard grade, wrong guard instance, host proxy, and altered definitions are rejected", () => {
  const wrongGrade = fixture(IDS[0], "bot", false);
  assert.equal(Reducer.discoverAutoTriggers(wrongGrade.state, [wrongGrade.event], Engine).queued.length, 0);

  const wrongSource = fixture();
  const alteredEvent = Engine.createGameEvent(wrongSource.state, { ...wrongSource.event, eventId: undefined,
    sourceCardInstanceId: "other-card", cardInstanceId: "other-card", subjectCardInstanceId: "other-card" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [alteredEvent], Engine).queued.length, 0);

  const joined = fixture(IDS[0], "bot");
  assert.equal(Reducer.discoverAutoTriggers(joined.state, [joined.event], Engine).queued.length, 1);
  const before = JSON.stringify(joined.state);
  const proxy = Reducer.applyAbilityDecision(joined.state, { actorAuthUid: seats.hostAuthUid, actionId: "proxy-joiner-shield",
    expectedStateVersion: joined.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: joined.source.uid, abilityId: joined.ability.id } } }, seats, Engine);
  assert.equal(proxy.ok, false);
  assert.equal(JSON.stringify(joined.state), before);

  for (const mutate of [
    ability => { ability.definition.printedText = ability.definition.printedText.replace("+10000", "+5000"); },
    ability => { ability.conditions[0].type = "controller-vanguard-grade-at-least-opponent"; },
    ability => { ability.requiredLocation = ["rear-guard"]; },
    ability => { ability.definition.effects[0].duration = "turn"; },
    ability => { ability.definition.id = "cfa-10673:0"; }
  ]) {
    const forged = structuredClone(joined.ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
