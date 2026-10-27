"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-named-vanguard-power-battle-v2";

test("six named-Vanguard AUTO definitions preserve 'until end of battle' wording and exact source/circle", () => {
  const found = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    found.push(ability);
    assert.equal(ability.trigger.eventType, "unit.attacked");
    assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.conditions[0].type, "controller-vanguard-name-contains");
    assert.equal(ability.effects[0].duration, "battle");
    assert.match(ability.printedText, /until end of battle\.$/i);
  }
  assert.equal(found.length, 6);
});

test("the joining player's matching own attack resolves +3000 only with the named Vanguard", () => {
  const card = loadCatalog().find(item => item.id === "cfa-1034");
  const ability = Engine.parseCardAbilities(card).find(item => item.definition?.source?.patternId === PATTERN);
  const build = name => {
    const attacker = { uid: "guest-attacker", cardId: card.id, cardName: card.name, ownerPlayerId: "guest", controllerPlayerId: "guest", power: 10000, unitCard: true };
    const state = { matchId: "named-vanguard-duration", stateVersion: 0, turn: 2, side: "bot", players: {
      human: { playerId: "host", vanguard: { uid: "host-vg", cardId: "host-vg", cardName: "Host Vanguard", ownerPlayerId: "host", controllerPlayerId: "host" }, rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] },
      bot: { playerId: "guest", vanguard: { uid: "guest-vg", cardId: "guest-vg", cardName: name, name, ownerPlayerId: "guest", controllerPlayerId: "guest" }, rear: [attacker, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [] }
    }, pendingAttack: { battleId: "named-vanguard-duration-battle", attackerSide: "bot", attackerUid: attacker.uid, attackerZone: "rear-left", targetUid: "host-vg", targetZone: "rear-guard", power: 10000 } };
    const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: attacker.uid, sourceControllerPlayerId: "guest", subjectCardInstanceId: attacker.uid, subjectControllerPlayerId: "guest", attackingCardInstanceIds: [attacker.uid], targetCardInstanceIds: ["host-vg"], targetLocation: "rear-guard", currentLocation: "rear-left", battleId: state.pendingAttack.battleId });
    return { state, event, attacker };
  };
  const legal = build("Dragonic Kaiser Vermillion");
  assert.equal(Reducer.discoverAutoTriggers(legal.state, [legal.event], Engine).queued.length, 1);
  const result = Reducer.applyAbilityDecision(legal.state, { actorAuthUid: "auth-guest", actionId: "named-duration", expectedStateVersion: 0,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: legal.attacker.uid, abilityId: ability.id } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(legal.state.pendingAttack.power, 13000);
  const wrongName = build("Unrelated Vanguard");
  assert.equal(Reducer.discoverAutoTriggers(wrongName.state, [wrongName.event], Engine).queued.length, 0);
});
