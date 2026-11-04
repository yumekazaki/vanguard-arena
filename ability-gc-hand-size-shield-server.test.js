"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-3745", "cfa-4913"];
const TEXT = "AUTO: When this unit is placed on GC, if the number of cards in your hand is three or more, this unit gets shield +5000 until end of that battle.";
const PATTERN = "auto-gc-hand-size-shield-battle-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function row(id) {
  const result = catalog.find(item => item.id === id);
  assert.ok(result, `catalog card ${id}`);
  return result;
}
function card(id, uid, playerId, extra = {}) {
  const definition = row(id);
  return { uid, cardId: id, cardName: definition.name, type: definition.type, grade: Number(definition.grade), shield: Number(definition.shield || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function fixture(cardId = IDS[0], defenderSide = "bot", handCount = 3) {
  const sourceDefinition = row(cardId);
  const ability = Engine.parseCardAbilitiesCached(sourceDefinition).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled ${cardId}:0`);
  const attackerSide = defenderSide === "human" ? "bot" : "human";
  const ownerId = defenderSide === "human" ? "player-host" : "player-guest";
  const attackerId = defenderSide === "human" ? "player-guest" : "player-host";
  const source = card(cardId, `guard-${cardId}-${defenderSide}`, ownerId);
  const ownVanguard = card("cfa-3", `own-vg-${defenderSide}`, ownerId, { grade: 2 });
  const attackingVanguard = card("cfa-3", `opponent-vg-${defenderSide}`, attackerId, { grade: 3 });
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const owner = player(ownerId), opponent = player(attackerId);
  owner.vanguard = ownVanguard;
  owner.hand = Array.from({ length: handCount }, (_, index) => ({ uid: `hand-${defenderSide}-${index}`, cardId: "cfa-3", ownerPlayerId: ownerId, controllerPlayerId: ownerId }));
  owner.guardCircle.push(source);
  opponent.vanguard = attackingVanguard;
  const players = defenderSide === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const battleId = `gc-hand-shield-${cardId}-${defenderSide}`;
  const state = { matchId: "gc-hand-size-shield", stateVersion: 1, eventSequence: 0, turn: 3, side: attackerSide, phase: 5,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: { battleId, attackerSide, attackerUid: attackingVanguard.uid, attackerZone: "vanguard", attackerPlayerId: attackerId,
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
    actionId: `resolve-gc-hand-shield-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
}

test("exact GC hand-size shield definitions are trusted and supported by the server", () => {
  for (const id of IDS) {
    const ability = Engine.parseCardAbilitiesCached(row(id)).find(item => item.id === `${id}:0`);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(ability.requiredLocation, ["guardian"], id);
    assert.deepEqual(ability.conditions, [{ type: "controller-hand-size-at-least", count: 3 }], id);
    assert.deepEqual(ability.effects, [{ op: "modify-shield-source", target: "source", amount: 5000, duration: "battle" }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
    const trusted = Engine.getReviewedAbilityDefinitionsForCard(id).filter(item => item.source?.patternId === PATTERN);
    assert.equal(trusted.length, 1, id);
    assert.equal(trusted[0].printedText, TEXT, id);
  }
});

test("both the host and joining defender resolve only their own qualifying Guardian", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, `${id}/${side}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    const result = resolve(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.source.battleShieldBoost, 5000);
    assert.equal(f.source.battleShieldExpiryBattleId, f.state.pendingAttack.battleId);
  }
});

test("insufficient hand, wrong source or circle, and stale battle cannot queue the shield AUTO", () => {
  const shortHand = fixture(IDS[0], "bot", 2);
  assert.equal(Reducer.discoverAutoTriggers(shortHand.state, [shortHand.event], Engine).queued.length, 0);

  const wrongSource = fixture();
  const forgedSourceEvent = Engine.createGameEvent(wrongSource.state, { ...wrongSource.event, eventId: undefined,
    sourceCardInstanceId: "another-card", cardInstanceId: "another-card", subjectCardInstanceId: "another-card" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [forgedSourceEvent], Engine).queued.length, 0);

  const wrongCircle = fixture();
  const nonGuardianEvent = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: undefined,
    currentLocation: "rear-guard", circle: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [nonGuardianEvent], Engine).queued.length, 0);

  const staleBattle = fixture();
  const staleEvent = Engine.createGameEvent(staleBattle.state, { ...staleBattle.event, eventId: undefined, battleId: "old-battle" });
  assert.equal(Reducer.discoverAutoTriggers(staleBattle.state, [staleEvent], Engine).queued.length, 0);
});

test("the joining defender's AUTO cannot be resolved by the host and rejects forged ability effects", () => {
  const f = fixture(IDS[0], "bot");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const before = JSON.stringify(f.state);
  const proxy = Reducer.applyAbilityDecision(f.state, { actorAuthUid: seats.hostAuthUid, actionId: "host-proxy-gc-shield",
    expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
  assert.equal(proxy.ok, false);
  assert.equal(JSON.stringify(f.state), before);

  for (const mutate of [
    ability => { ability.definition.printedText = ability.definition.printedText.replace("three or more", "two or more"); },
    ability => { ability.conditions[0].count = 2; },
    ability => { ability.requiredLocation = ["rear-guard"]; },
    ability => { ability.definition.effects[0].duration = "turn"; },
    ability => { ability.definition.effects[0].amount = 10000; }
  ]) {
    const forged = structuredClone(f.ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
