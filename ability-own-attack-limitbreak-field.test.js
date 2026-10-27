"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-clan-limit-break-field-power-battle-v1";

test("the 13 own-attack clan Limit Break abilities preserve source circle, clan, amount, and battle duration", () => {
  const matches = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    matches.push({ card, ability });
    assert.equal(ability.trigger.eventType, "unit.attacked");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.requiredLocation.includes("rear-guard") || ability.requiredLocation.includes("vanguard"), true);
    assert.deepEqual(ability.conditions, [{ type: "controller-field-has-clan-limit-break", clan: ability.conditions[0].clan, count: 4 }]);
    assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]);
  }
  assert.equal(matches.length, 13);
});

test("the field Limit Break condition requires a matching clan instance and the exact attacking source", () => {
  const card = loadCatalog().find(item => item.id === "cfa-1160");
  assert.ok(card);
  const ability = Engine.parseCardAbilities(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability);
  const event = Engine.createGameEvent({ matchId: "field-lb-attack" }, {
    type: "unit.attacked", actingPlayerId: "player-a", turnPlayerId: "player-a", sourceCardInstanceId: "source-unit",
    subjectCardInstanceId: "source-unit", attackingCardInstanceIds: ["source-unit"], currentLocation: "rear-left"
  });
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", event, "source-unit", "rear-left", "rear-left", "player-a"), true);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "attack", event, "other-unit", "rear-left", "rear-left", "player-a"), false);
  const condition = (controllerFieldCards) => Engine.evaluateAbilityConditions(ability, { controllerFieldCards });
  assert.equal(condition([{ uid: "lb-source", clan: "Royal Paladin", hasLimitBreak4: true }]), true);
  assert.equal(condition([{ uid: "wrong-clan", clan: "Shadow Paladin", hasLimitBreak4: true }]), false);
  assert.equal(condition([{ uid: "no-limit-break", clan: "Royal Paladin", hasLimitBreak4: false }]), false);
  assert.equal(condition(undefined), false);
});

test("the trusted event queue grants the battle power only for the matching controller field and attacking instance", () => {
  const card = loadCatalog().find(item => item.id === "cfa-1160");
  const ability = Engine.parseCardAbilities(card).find(item => item.definition?.source?.patternId === PATTERN);
  const makeState = (clan, hasLimitBreak4, attackingUid = "source-unit") => {
    const source = { uid: "source-unit", cardId: "cfa-1160", ownerPlayerId: "guest", controllerPlayerId: "guest", power: 10000, unitCard: true };
    const fieldUnit = { uid: "field-lb", cardId: "lb-unit", ownerPlayerId: "guest", controllerPlayerId: "guest", clan, clans: [clan], hasLimitBreak4, grade: 3, unitCard: true };
    const state = { matchId: "field-lb-authority", stateVersion: 0, turn: 1, side: "bot", players: {
      human: { playerId: "host", vanguard: { uid: "host-vg", cardId: "host-vg", ownerPlayerId: "host", controllerPlayerId: "host" }, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] },
      bot: { playerId: "guest", vanguard: fieldUnit, rear: [source, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] }
    }, pendingAttack: { battleId: "field-lb-battle", attackerSide: "bot", attackerUid: attackingUid, attackerZone: "rear-left", power: 10000 } };
    const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: attackingUid, sourceControllerPlayerId: "guest", subjectCardInstanceId: attackingUid, currentLocation: "rear-left", battleId: "field-lb-battle" });
    return { state, event, source };
  };
  const legal = makeState("Royal Paladin", true);
  const discovered = Reducer.discoverAutoTriggers(legal.state, [legal.event], Engine);
  assert.equal(discovered.queued.length, 1);
  assert.equal(legal.state.pendingAbility.triggerControllerPlayerId, "guest");
  const resolved = Reducer.applyAbilityDecision(legal.state, {
    actorAuthUid: "auth-guest", actionId: "field-lb-power", expectedStateVersion: 0,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: legal.source.uid, abilityId: ability.id } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(legal.state.pendingAttack.power, 13000);
  for (const invalid of [makeState("Shadow Paladin", true), makeState("Royal Paladin", false), makeState("Royal Paladin", true, "other-attacker")]) {
    assert.equal(Reducer.discoverAutoTriggers(invalid.state, [invalid.event], Engine).queued.length, 0);
  }
});
