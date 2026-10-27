"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-vanguard-hit-clan-rear-guards-draw-v1";

test("all nine clan-count attack-hit abilities keep the exact attacker, hit target, and other-unit threshold", () => {
  const matches = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    matches.push(ability);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(ability.trigger.eventType, "attack.hit");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetLocation, "vanguard");
    assert.deepEqual(ability.conditions, [{ type: "controller-other-rear-guards-of-clan-at-least", count: 4, clan: card.text.match(/other [«<]([^»>]+)[»>]/)[1] }]);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }]);
  }
  assert.equal(matches.length, 9);
});

test("trusted hit event uses its attacker source, excludes that source from clan count, and prompts the joining player", () => {
  const source = { uid: "guest-hitter", cardId: "cfa-150", ownerPlayerId: "guest", controllerPlayerId: "guest", clan: "Nova Grappler", clans: ["Nova Grappler"] };
  const allies = Array.from({ length: 4 }, (_, index) => ({ uid: `guest-nova-${index}`, cardId: `nova-${index}`, ownerPlayerId: "guest", controllerPlayerId: "guest", clan: "Nova Grappler", clans: ["Nova Grappler"] }));
  const target = { uid: "host-vanguard", cardId: "host-vg", ownerPlayerId: "host", controllerPlayerId: "host", grade: 3 };
  const state = {
    matchId: "hit-clan-room", stateVersion: 8, eventSequence: 0, turn: 6, side: "bot", phase: 5,
    processedAbilityTriggers: [], players: {
      human: { playerId: "host", vanguard: target, rear: [], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [] },
      bot: { playerId: "guest", vanguard: null, rear: [source, ...allies], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [{ uid: "guest-hit-draw", cardId: "drawn" }] }
    }
  };
  const makeHit = (attacker = source, targetInstance = target, suffix = "first") => Engine.createGameEvent(state, {
    type: "attack.hit", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: attacker.uid,
    sourceOwnerPlayerId: attacker.ownerPlayerId, sourceControllerPlayerId: attacker.controllerPlayerId,
    subjectCardInstanceId: targetInstance.uid, subjectOwnerPlayerId: targetInstance.ownerPlayerId,
    subjectControllerPlayerId: targetInstance.controllerPlayerId, targetCardInstanceIds: [targetInstance.uid],
    targetLocation: "vanguard", battleId: `guest-hit-${suffix}`, timingWindow: "attack-hit"
  });
  const event = makeHit();
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovered.queued.length, 1);
  assert.equal(state.pendingAbility.side, "bot");
  assert.equal(state.pendingAbility.instance.uid, source.uid);
  assert.equal(state.pendingAbility.triggerControllerPlayerId, "guest");

  const result = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "guest-attack-hit-draw", expectedStateVersion: 8,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: "cfa-150:0", costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.players.bot.hand[0].uid, "guest-hit-draw");

  const sourceAbility = Engine.parseCardAbilities({ id: "cfa-150", text: Engine.getReviewedAbilityDefinitionsForCard("cfa-150")[0].printedText })[0];
  assert.equal(Engine.eventMatchesAbilityTrigger(sourceAbility, "hit", makeHit({ ...source, uid: "other-attacker" }, target, "other"), source.uid, "rear-left", null, "guest"), false);
  const insufficient = { ...state, pendingAbility: null, pendingAbilities: [], processedAbilityTriggers: [], players: { ...state.players, bot: { ...state.players.bot, hand: [], deck: [{ uid: "draw-still-here" }], rear: [source, ...allies.slice(0, 3)] } } };
  assert.equal(Reducer.discoverAutoTriggers(insufficient, [makeHit(source, target, "three-allies")], Engine).queued.length, 0);
  const wrongClan = { ...state, pendingAbility: null, pendingAbilities: [], processedAbilityTriggers: [], players: { ...state.players, bot: { ...state.players.bot, hand: [], rear: [source, ...allies.slice(0, 3), { uid: "other-clan", clan: "Royal Paladin", clans: ["Royal Paladin"], ownerPlayerId: "guest", controllerPlayerId: "guest" }] } } };
  assert.equal(Reducer.discoverAutoTriggers(wrongClan, [makeHit(source, target, "wrong-clan")], Engine).queued.length, 0);
});
