"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-hit-clan-vanguard-counter-charge-v1";

test("all eight clan-specific attack-hit Counter Charge abilities preserve source, Vanguard target, clan, and damage choice", () => {
  const matches = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    matches.push({ card, ability });
    assert.equal(ability.trigger.eventType, "attack.hit");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetLocation, "vanguard");
    assert.ok(ability.requiredLocation.length);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: ability.conditions[0].value }]);
    assert.deepEqual(ability.effects, [{ op: "counter-charge", count: 1 }]);
    assert.equal(ability.choiceStatus, "modeled");
    assert.equal(ability.canDecline, false);
  }
  assert.equal(matches.length, 8);
});

test("the trusted hit trigger queues for the joining attacker, requires its clan Vanguard, and pays the selected Counter Charge", () => {
  const card = loadCatalog().find(item => item.id === "cfa-153");
  const ability = Engine.parseCardAbilities(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability);
  const source = { uid: "guest-attacker", cardId: card.id, ownerPlayerId: "guest", controllerPlayerId: "guest", unitCard: true, power: 10000 };
  const damage = { uid: "guest-face-down-damage", cardId: "damage", faceDown: true, ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const makeState = clan => ({ matchId: "hit-counter-charge", stateVersion: 0, turn: 2, side: "bot", players: {
    human: { playerId: "host", vanguard: { uid: "host-vg", cardId: "host-vg", ownerPlayerId: "host", controllerPlayerId: "host" }, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] },
    bot: { playerId: "guest", vanguard: { uid: "guest-vg", cardId: "guest-vg", clan, clans: [clan], ownerPlayerId: "guest", controllerPlayerId: "guest" }, rear: [source, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [{ ...damage }], bind: [], orders: [], guardCircle: [] }
  }, pendingAttack: { battleId: "hit-counter-charge:battle", attackerSide: "bot", attackerUid: source.uid, attackerZone: "rear-left", targetUid: "host-vg", targetZone: "vanguard", power: 15000, targetPower: 10000 } });
  const state = makeState("Nova Grappler");
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: source.uid, sourceControllerPlayerId: "guest", subjectCardInstanceId: "host-vg", subjectControllerPlayerId: "host", targetCardInstanceIds: ["host-vg"], targetLocation: "vanguard", battleId: "hit-counter-charge:battle" });
  const result = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(result.queued.length, 1);
  assert.equal(state.pendingAbility?.side, "bot");
  assert.equal(state.pendingAbility?.instance?.uid, source.uid);
  const resolved = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "guest-counter-charge", expectedStateVersion: 0,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: ability.id, damageUids: [damage.uid] } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(state.players.bot.damage[0].faceDown, false);
  assert.equal(state.players.human.damage.length, 0);
  for (const [clan, targetLocation] of [["Shadow Paladin", "vanguard"], ["Nova Grappler", "rear-guard"]]) {
    const invalidState = makeState(clan);
    const invalidEvent = Engine.createGameEvent(invalidState, { type: "attack.hit", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: source.uid, sourceControllerPlayerId: "guest", subjectCardInstanceId: "host-vg", subjectControllerPlayerId: "host", targetCardInstanceIds: ["host-vg"], targetLocation, battleId: "hit-counter-charge:battle" });
    assert.equal(Reducer.discoverAutoTriggers(invalidState, [invalidEvent], Engine).queued.length, 0);
  }
});
