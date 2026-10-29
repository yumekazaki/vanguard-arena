"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const PATTERN = "auto-own-attack-vanguard-clan-power-battle-v1";
const FAMILY = new Map(catalog.flatMap(card => Engine.parseCardAbilitiesCached(card)
  .filter(ability => ability.definition?.source?.patternId === PATTERN)
  .map(ability => [card.id, { abilityId: ability.id, clan: ability.conditions?.[0]?.value }])));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId, side = "human", vanguardClan = FAMILY.get(cardId).clan) {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === FAMILY.get(cardId).abilityId);
  assert.ok(ability, `${FAMILY.get(cardId).abilityId} is present`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${side}`, cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 8000 };
  const vanguard = { uid: `vg-${side}`, cardId: `test-vg-${side}`, cardName: "Test Vanguard", clan: vanguardClan, clans: [vanguardClan], ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 3 };
  const opponentVanguard = { uid: `opp-vg-${side}`, cardId: `opp-vg-${side}`, cardName: "Opponent Vanguard", clan: "Kagero", clans: ["Kagero"], ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3 };
  const opponentRear = { uid: `opp-rg-${side}`, cardId: `opp-rg-${side}`, cardName: "Opponent Rear-Guard", clan: "Kagero", clans: ["Kagero"], ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 1 };
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : opponentVanguard, rear: side === "human" ? [source, null, null, null, null] : [opponentRear, null, null, null, null], damage: [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : opponentVanguard, rear: side === "bot" ? [source, null, null, null, null] : [opponentRear, null, null, null, null], damage: [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const targetZone = ability.trigger.targetLocation || "rear-guard";
  const target = targetZone === "vanguard" ? opponentVanguard : opponentRear;
  const state = { matchId: "rc-clan-attack", stateVersion: 1, turn: 2, side, phase: 5, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: { battleId: `battle-${side}`, attackerSide: side, attackerUid: source.uid, attackerPlayerId: playerId, attackerZone: "rear-left", defenderSide: side === "human" ? "bot" : "human", targetUid: target.uid, targetZone, power: 8000, critical: 1 } };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    attackingCardInstanceIds: [source.uid], currentLocation: "rear-left", previousLocation: "rear-left",
    targetCardInstanceIds: [target.uid], targetLocation: targetZone, battleId: `battle-${side}`, phase: "battle", timingWindow: "attack-declared"
  });
  return { state, event, ability, source, side, playerId };
}

function resolve(f) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `rc-clan-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
  }, seats, Engine);
}

test("all 42 real legacy AUTO records compile with their exact source circle, clan, target, and battle power", () => {
  assert.equal(FAMILY.size, 42);
  for (const [cardId, family] of FAMILY) {
    const f = fixture(cardId);
    assert.equal(f.ability.definition?.source?.patternId, PATTERN, cardId);
    const printedCircle = f.ability.printedText.match(/\[(VC\/RC|VC|RC)\]/)?.[1];
    const expectedCircles = printedCircle === "VC" ? ["vanguard"] : printedCircle === "RC" ? ["rear-guard"] : ["vanguard", "rear-guard"];
    assert.deepEqual(f.ability.requiredLocation, expectedCircles, cardId);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-has-clan", value: family.clan }], cardId);
    assert.equal(f.ability.trigger.eventType, "unit.attacked", cardId);
    assert.equal(f.ability.trigger.subject, "source", cardId);
    assert.equal(f.ability.trigger.targetLocation, /attacks a vanguard/i.test(f.ability.printedText) ? "vanguard" : null, cardId);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power", target: "source", amount: Number(f.ability.printedText.match(/power \+(\d+)/i)?.[1]), duration: "battle" }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
  }
});

test("host and joining player each resolve only their own attacker and get the printed battle power", () => {
  for (const side of ["human", "bot"]) for (const cardId of FAMILY.keys()) {
    const f = fixture(cardId, side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, JSON.stringify({ side, skipped: discovery.skipped, pending: f.state.pendingAbilities, ability: f.ability }));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
    const result = resolve(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.pendingAttack.power, 8000 + f.ability.definition.effects[0].amount, cardId);
  }
});

test("another attacker, a wrong attack target, or a Vanguard without the required clan cannot trigger", () => {
  const unrelated = fixture("cfa-1347", "bot");
  unrelated.event = { ...unrelated.event, sourceCardInstanceId: "other-attacker", cardInstanceId: "other-attacker", subjectCardInstanceId: "other-attacker", attackingCardInstanceIds: ["other-attacker"] };
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [unrelated.event], Engine).queued.length, 0);

  const wrongTarget = fixture("cfa-1262");
  wrongTarget.event = { ...wrongTarget.event, targetLocation: "rear-guard" };
  assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state, [wrongTarget.event], Engine).queued.length, 0);

  const wrongClan = fixture("cfa-1341", "bot", "Aqua Force");
  assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0);
});
