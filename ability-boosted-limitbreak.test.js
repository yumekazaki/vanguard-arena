"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-rc-boosts-clan-limit-break-counter-blast-power-v1";
const HIT_SOUL_PATTERN = "auto-boosted-limit-break-vanguard-hit-source-soul-draw-v1";

test("all 14 clan variants of the boosted Limit Break Vanguard hit ability keep exact battle identity and optional Soul cost", () => {
  const matches = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== HIT_SOUL_PATTERN) continue;
    matches.push({ card, ability });
    assert.equal(ability.kind, "AUTO");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.trigger.status, "recognized-trigger");
    assert.equal(ability.trigger.eventType, "attack.hit");
    assert.equal(ability.trigger.subject, "booster");
    assert.equal(ability.trigger.targetLocation, "vanguard");
    assert.ok(ability.trigger.boostedUnitClan);
    assert.equal(ability.trigger.boostedUnitLimitBreak, 4);
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }]);
  }
  assert.equal(matches.length, 14);
  const { ability } = matches[0];
  const event = Engine.createGameEvent({ matchId: "lb-boost-hit" }, {
    type: "attack.hit", actingPlayerId: "player-a", turnPlayerId: "player-a", sourceCardInstanceId: "attacker",
    subjectCardInstanceId: "defender", targetCardInstanceIds: ["defender"], targetLocation: "vanguard",
    attackingUnitInstanceId: "attacker", boosterCardInstanceId: "booster", boostedCardInstanceId: "attacker",
    boostedCardClan: ability.trigger.boostedUnitClan, boostedCardClans: [ability.trigger.boostedUnitClan],
    boostedCardLimitBreaks: [4], battleId: "lb-boost-hit:battle"
  });
  const matchesEvent = candidate => Engine.eventMatchesAbilityTrigger(ability, "hit", candidate, "booster", "rear-left", "vanguard", "player-a");
  assert.equal(matchesEvent(event), true);
  assert.equal(matchesEvent({ ...event, boosterCardInstanceId: "other-booster" }), false);
  assert.equal(matchesEvent({ ...event, boostedCardInstanceId: "other-attacker" }), false);
  assert.equal(matchesEvent({ ...event, boostedCardClan: "Wrong Clan", boostedCardClans: ["Wrong Clan"] }), false);
  assert.equal(matchesEvent({ ...event, boostedCardLimitBreaks: [] }), false);
  assert.equal(matchesEvent({ ...event, targetLocation: "rear-guard" }), false);
  assert.equal(matchesEvent({ ...event, attackingUnitInstanceId: "other-attacker" }), false);
  assert.equal(matchesEvent({ ...event, battleId: null }), false);
});

test("all 15 clan-gated Limit Break boost AUTO abilities preserve the source, target, payment, and battle duration", () => {
  const matches = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    matches.push(ability);
    assert.equal(ability.requiredLocation.includes("rear-guard"), true);
    assert.equal(ability.trigger.eventType, "unit.boosted");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.boostedUnitLimitBreak, 4);
    assert.ok(ability.trigger.boostedUnitClan);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.effects, [{ op: "modify-power-target", target: "boosted-unit", amount: 3000, duration: "battle", targetFilter: { controller: "source-controller", cardType: "unit" } }]);
  }
  assert.equal(matches.length, 15);
});

test("boost AUTO checks the exact boosted card and lets the joining player pay and resolve", () => {
  const source = { uid: "guest-booster", cardId: "cfa-1127", ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const target = { uid: "guest-limit-break-vanguard", cardId: "cfa-218", cardName: "Great Silver Wolf, Garmore", grade: 3, clan: "Gold Paladin", hasLimitBreak4: true, unitCard: true, ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const damage = { uid: "guest-face-up-damage", faceDown: false, ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const state = {
    matchId: "boost-limit-break-room", stateVersion: 5, eventSequence: 0, turn: 4, side: "bot", phase: 5,
    pendingAttack: { attackerUid: target.uid, attackerSide: "bot", power: 18000, battleId: "guest-boost-battle" },
    processedAbilityTriggers: [], players: {
      human: { playerId: "host", vanguard: null, rear: [], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [] },
      bot: { playerId: "guest", vanguard: target, rear: [source], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [damage], deck: [] }
    }
  };
  const event = Engine.createGameEvent(state, {
    type: "unit.boosted", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: "guest", sourceControllerPlayerId: "guest", subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: "guest", subjectControllerPlayerId: "guest", boosterCardInstanceId: source.uid,
    boostedCardInstanceId: target.uid, boostedCardClan: "Gold Paladin", boostedCardClans: ["Gold Paladin"],
    boostedCardLimitBreaks: [4], currentLocation: "rear-left", circle: "rear-left", targetLocation: "vanguard",
    targetCardInstanceIds: [target.uid], battleId: "guest-boost-battle", timingWindow: "boost-step"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovered.queued.length, 1);
  assert.equal(state.pendingAbility.side, "bot");
  assert.equal(state.pendingAbility.instance.uid, source.uid);
  assert.equal(state.pendingAbility.triggerControllerPlayerId, "guest");

  const resolved = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "guest-pays-boost-cost", expectedStateVersion: 5,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: source.uid, abilityId: "cfa-1127:0", costSelections: { cb: [damage.uid], sb: [], discard: [], reveal: [] }
    } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(state.players.bot.damage.length, 1);
  assert.equal(state.players.bot.damage[0].faceDown, true);
  assert.equal(state.pendingAttack.power, 21000);

  for (const invalid of [
    { ...event, eventId: "wrong-clan", boostedCardClan: "Royal Paladin", boostedCardClans: ["Royal Paladin"] },
    { ...event, eventId: "no-limit-break", boostedCardLimitBreaks: [] },
    { ...event, eventId: "wrong-target", boostedCardInstanceId: "another-unit" },
    { ...event, eventId: "wrong-booster", sourceCardInstanceId: "another-booster", boosterCardInstanceId: "another-booster", subjectCardInstanceId: "another-booster" }
  ]) {
    assert.equal(Engine.eventMatchesAbilityTrigger(state.pendingAbility?.ability || Engine.parseCardAbilities({ id: "cfa-1127", text: Engine.getReviewedAbilityDefinitionsForCard("cfa-1127")[0].printedText })[0], "boost", invalid, source.uid, "rear-left", "rear-left", "guest"), false);
  }
});
