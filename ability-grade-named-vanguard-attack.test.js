"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");
engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const ids = ["cfa-10781", "cfa-11103", "cfa-11105", "cfa-11107", "cfa-11109", "cfa-11111", "cfa-11113", "cfa-11115", "cfa-11117", "cfa-11119", "cfa-11121", "cfa-11123", "cfa-11125", "cfa-11127", "cfa-11129", "cfa-11131", "cfa-11133", "cfa-11135", "cfa-11137", "cfa-11139", "cfa-11141", "cfa-11143", "cfa-11145", "cfa-11147"];
const pattern = "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1";
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));

function makeState({ grade = 3, name = "Chronojet Dragon", attackerSide = "bot" } = {}) {
  const attackerPlayerId = attackerSide === "bot" ? "guest" : "host";
  const defenderSide = attackerSide === "bot" ? "human" : "bot";
  const source = { uid: "guest-cost-unit", cardId: "cfa-10781", cardName: "Heart Thump Worker", grade: 1, ownerPlayerId: "guest", controllerPlayerId: "guest", power: 8000 };
  const attacker = { uid: `${attackerPlayerId}-chronojet-vanguard`, cardId: "chronojet-vanguard", type: "Unit", cardName: name, grade, clan: "Gear Chronicle", clans: ["Gear Chronicle"], ownerPlayerId: attackerPlayerId, controllerPlayerId: attackerPlayerId, power: 13000, critical: 1 };
  const target = { uid: `${defenderSide}-vanguard`, cardId: `${defenderSide}-vanguard-card`, type: "Unit", cardName: "Opponent Vanguard", grade: 3, ownerPlayerId: defenderSide === "human" ? "host" : "guest", controllerPlayerId: defenderSide === "human" ? "host" : "guest", power: 13000, critical: 1 };
  const player = (playerId, vanguard, rear = []) => ({ playerId, vanguard, rear, hand: [], soul: [], damage: [], drop: [], bind: [], orders: [], guardCircle: [], deck: [{ uid: "drawn-card", cardId: "drawn-card" }], gDeck: [], gZone: [] });
  const state = { matchId: "chronojet-attack", stateVersion: 3, eventSequence: 0, turn: 5, side: attackerSide, phase: 5, processedAbilityTriggers: [], players: { human: player("host", attackerSide === "human" ? attacker : target), bot: player("guest", attackerSide === "bot" ? attacker : target, [source]) } };
  state.pendingAttack = { battleId: "chronojet-battle", attackerUid: attacker.uid, attackerPlayerId, attackerSide, attackerZone: "vanguard", defenderSide, targetUid: target.uid, targetZone: "vanguard", power: 13000, targetPower: 13000, critical: 1, boostUid: null };
  if (attackerSide === "bot") state.pendingAttack.boostUid = null;
  return { state, source, attacker, target, attackerPlayerId };
}

test("all 24 grade-and-name Vanguard attack texts compile with optional Soul cost and ordered effects", () => {
  for (const cardId of ids) {
    const card = cards.get(cardId);
    assert.ok(card, `missing ${cardId}`);
    const ability = engine.parseCardAbilitiesCached(card)[0];
    assert.equal(ability.definition?.source?.patternId, pattern, cardId);
    assert.equal(ability.trigger?.eventType, "unit.attacked", cardId);
    assert.equal(ability.trigger?.subject, "vanguard", cardId);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], cardId);
    const vanguardName = card.text.match(/vanguard with ["“]([^"”]+)["”] in its card name/i)?.[1];
    assert.ok(vanguardName, cardId);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-grade-at-least", count: 3 }, { type: "controller-vanguard-name-contains", value: vanguardName }], cardId);
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }], cardId);
    assert.equal(ability.canDecline, true, cardId);
    assert.equal(ability.costStatus, "supported-cost", cardId);
    assert.equal(ability.choiceStatus, "modeled", cardId);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }, { op: "modify-power-target", target: "chosen", amount: 5000, duration: "battle", targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" } }], cardId);
  }
});

test("the trusted trigger queues only for its controller's exact qualifying Vanguard attack", () => {
  const { state, source, attacker } = makeState();
  const event = engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: "guest", sourceControllerPlayerId: "guest", subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: "guest", subjectControllerPlayerId: "guest", currentLocation: "vanguard", circle: "vanguard", battleId: state.pendingAttack.battleId, timingWindow: "attack-declared" });
  const queued = reducer.discoverAutoTriggers(state, [event], engine);
  assert.equal(queued.queued.length, 1);
  assert.equal(state.pendingAbility.side, "bot");
  assert.equal(state.pendingAbility.instance.uid, source.uid);
  assert.equal(state.pendingAbility.triggerControllerPlayerId, "guest");

  for (const options of [{ grade: 2 }, { name: "Other Dragon" }, { attackerSide: "human" }]) {
    const wrong = makeState(options);
    const wrongEvent = engine.createGameEvent(wrong.state, { type: "unit.attacked", actingPlayerId: wrong.attackerPlayerId, turnPlayerId: wrong.attackerPlayerId, sourceCardInstanceId: wrong.attacker.uid, sourceOwnerPlayerId: wrong.attackerPlayerId, sourceControllerPlayerId: wrong.attackerPlayerId, subjectCardInstanceId: wrong.attacker.uid, subjectOwnerPlayerId: wrong.attackerPlayerId, subjectControllerPlayerId: wrong.attackerPlayerId, currentLocation: "vanguard", circle: "vanguard", battleId: wrong.state.pendingAttack.battleId, timingWindow: "attack-declared" });
    assert.equal(reducer.discoverAutoTriggers(wrong.state, [wrongEvent], engine).queued.length, 0);
  }
});

test("the joining player may decline the printed COST, or pay it and resolve draw before Vanguard power", () => {
  const makeTriggeredState = () => {
    const setup = makeState();
    const event = engine.createGameEvent(setup.state, { type: "unit.attacked", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: setup.attacker.uid, sourceOwnerPlayerId: "guest", sourceControllerPlayerId: "guest", subjectCardInstanceId: setup.attacker.uid, subjectOwnerPlayerId: "guest", subjectControllerPlayerId: "guest", currentLocation: "vanguard", circle: "vanguard", battleId: setup.state.pendingAttack.battleId, timingWindow: "attack-declared" });
    reducer.discoverAutoTriggers(setup.state, [event], engine);
    assert.equal(setup.state.pendingAbility?.triggerControllerPlayerId, "guest");
    return setup;
  };
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const declined = makeTriggeredState();
  const declineResult = reducer.applyAbilityDecision(declined.state, { actorAuthUid: "auth-guest", actionId: "decline-chronojet-cost", expectedStateVersion: 3, payload: { type: "ability-response", accept: false, selection: { instanceUid: declined.source.uid, abilityId: "cfa-10781:0" } } }, seats, engine);
  assert.equal(declineResult.ok, true, declineResult.reason);
  assert.equal(declined.state.players.bot.rear[0].uid, declined.source.uid);
  assert.equal(declined.state.players.bot.soul.length, 0);
  assert.equal(declined.state.players.bot.hand.length, 0);

  const accepted = makeTriggeredState();
  const result = reducer.applyAbilityDecision(accepted.state, { actorAuthUid: "auth-guest", actionId: "pay-chronojet-cost", expectedStateVersion: 3, payload: { type: "ability-response", accept: true, selection: { instanceUid: accepted.source.uid, abilityId: "cfa-10781:0", targetUid: accepted.attacker.uid, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }, targetUid: accepted.attacker.uid }, seats, engine);
  assert.equal(result.ok, true, result.reason);
  assert.ok(accepted.state.players.bot.soul.some(card => card.uid === accepted.source.uid));
  assert.equal(accepted.state.players.bot.hand[0].uid, "drawn-card");
  assert.equal(accepted.state.pendingAttack.power, 18000);
});
