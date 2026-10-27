"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-vanguard-named-vanguard-power-battle-v1";

test("all six named-Vanguard own-attack power abilities preserve source circle, target, name, amount, and duration", () => {
  const matches = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    matches.push(ability);
    assert.equal(ability.trigger.eventType, "unit.attacked");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetLocation, "vanguard");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.conditions.length, 1);
    assert.equal(ability.conditions[0].type, "controller-vanguard-name-contains");
    assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 2000, duration: "battle" }]);
  }
  assert.equal(matches.length, 6);
});

test("only the matching attacking instance with its named Vanguard gets the battle power", () => {
  const card = loadCatalog().find(item => item.id === "cfa-3973");
  const ability = Engine.parseCardAbilities(card).find(item => item.definition?.source?.patternId === PATTERN);
  const makeState = (vanguardName, attackerUid = "guest-attacker", targetZone = "vanguard") => {
    const attacker = { uid: "guest-attacker", cardId: card.id, cardName: card.name, ownerPlayerId: "guest", controllerPlayerId: "guest", power: 10000, unitCard: true };
    const vanguard = { uid: "guest-vg", cardId: "guest-vg", name: vanguardName, cardName: vanguardName, ownerPlayerId: "guest", controllerPlayerId: "guest" };
    const state = { matchId: "named-vanguard-attack", stateVersion: 0, turn: 2, side: "bot", players: {
      human: { playerId: "host", vanguard: { uid: "host-vg", cardId: "host-vg", name: "Host Vanguard", ownerPlayerId: "host", controllerPlayerId: "host" }, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] },
      bot: { playerId: "guest", vanguard, rear: [attacker, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] }
    }, pendingAttack: { battleId: "named-vanguard-battle", attackerSide: "bot", attackerUid, attackerZone: "rear-left", targetUid: targetZone === "vanguard" ? "host-vg" : "host-rear", targetZone, power: 10000, critical: 1 } };
    const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: attackerUid, sourceControllerPlayerId: "guest", subjectCardInstanceId: attackerUid, subjectControllerPlayerId: "guest", attackingCardInstanceIds: [attackerUid], targetCardInstanceIds: [state.pendingAttack.targetUid], targetLocation: targetZone, currentLocation: "rear-left", battleId: "named-vanguard-battle" });
    return { state, event, attacker };
  };

  const legal = makeState("Dueling Dragon, Nouvelle Vague");
  const legalDiscovery = Reducer.discoverAutoTriggers(legal.state, [legal.event], Engine);
  assert.equal(legalDiscovery.queued.length, 1, JSON.stringify(legalDiscovery));
  assert.equal(legal.state.pendingAbility.triggerControllerPlayerId, "guest");
  const resolved = Reducer.applyAbilityDecision(legal.state, {
    actorAuthUid: "auth-guest", actionId: "named-vanguard-power", expectedStateVersion: 0,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: legal.attacker.uid, abilityId: ability.id } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(legal.state.pendingAttack.power, 12000);

  for (const invalid of [
    makeState("Unrelated Vanguard Name"),
    makeState("Dueling Dragon, Nouvelle Vague", "another-unit"),
    makeState("Dueling Dragon, Nouvelle Vague", "guest-attacker", "rear-guard")
  ]) assert.equal(Reducer.discoverAutoTriggers(invalid.state, [invalid.event], Engine).queued.length, 0);
});
