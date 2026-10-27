"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1";

test("17 named-grade Vanguard attack AUTO abilities preserve their exact predicates, cost, and effects", () => {
  const matches = [];
  for (const card of loadCatalog()) {
    for (const ability of Engine.parseCardAbilitiesCached(card)) {
      if (ability.definition?.source?.patternId !== PATTERN) continue;
      matches.push({ card, ability });
      assert.equal(ability.requiredLocation.includes("rear-guard"), true);
      assert.equal(ability.trigger.eventType, "unit.attacked");
      assert.equal(ability.trigger.subject, "vanguard");
      assert.deepEqual(ability.conditions, [
        { type: "controller-vanguard-grade-at-least", count: 3 },
        { type: "controller-vanguard-name-contains", value: card.text.match(/vanguard with ["“]([^"”]+)["”]/i)[1] }
      ]);
      assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
      assert.equal(ability.canDecline, true);
      assert.deepEqual(ability.effects.map(effect => effect.op), ["draw", "modify-power-target"]);
      assert.equal(ability.effects[1].duration, "battle");
      assert.deepEqual(ability.effects[1].targetFilter, { controller: "source-controller", cardType: "unit", zone: "vanguard" });
    }
  }
  assert.equal(matches.length, 17);
});

test("the joining player's qualifying Vanguard attack privately queues only their exact Rear-Guard ability", () => {
  const source = { uid: "guest-source", cardId: "cfa-2705", ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const vanguard = { uid: "guest-vanguard", cardId: "chronojet-fixture", cardName: "Chronojet Dragon", grade: 3, unitCard: true, ownerPlayerId: "guest", controllerPlayerId: "guest" };
  const state = {
    matchId: "named-attack-room", stateVersion: 3, eventSequence: 0, turn: 2, side: "bot", phase: 5,
    pendingAttack: { attackerUid: "guest-vanguard", power: 18000, battleId: "guest-battle" }, processedAbilityTriggers: [], players: {
      human: { playerId: "host", vanguard: { uid: "host-vanguard", grade: 3, cardName: "Other Dragon", controllerPlayerId: "host" }, rear: [], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [] },
      bot: { playerId: "guest", vanguard, rear: [source], guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [{ uid: "guest-draw", cardId: "draw-card" }] }
    }
  };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: vanguard.uid,
    sourceOwnerPlayerId: "guest", sourceControllerPlayerId: "guest", subjectCardInstanceId: vanguard.uid,
    subjectOwnerPlayerId: "guest", subjectControllerPlayerId: "guest", currentLocation: "vanguard",
    battleId: "guest-battle", timingWindow: "attack-declared"
  });
  const discovered = Reducer.discoverAutoTriggers(state, [event], Engine);
  assert.equal(discovered.queued.length, 1);
  assert.equal(state.pendingAbility.side, "bot");
  assert.equal(state.pendingAbility.triggerControllerPlayerId, "guest");
  assert.equal(state.pendingAbility.instance.uid, source.uid);
  assert.equal(state.pendingAbility.ability.definition.source.patternId, PATTERN);

  const resolved = Reducer.applyAbilityDecision(state, {
    actorAuthUid: "auth-guest", actionId: "guest-resolves-named-attack-ability", expectedStateVersion: 3,
    payload: { type: "ability-response", accept: true, selection: {
      instanceUid: source.uid, abilityId: "cfa-2705:0", targetUid: vanguard.uid,
      costSelections: { cb: [], sb: [], discard: [], reveal: [] }
    } }
  }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(state.players.bot.rear[0], null);
  assert.equal(state.players.bot.soul[0].uid, source.uid);
  assert.equal(state.players.bot.hand[0].uid, "guest-draw");
  assert.equal(state.pendingAttack.power, 23000);

  state.pendingAbility = null;
  state.pendingAbilities = [];
  state.processedAbilityTriggers = [];
  vanguard.cardName = "Different Vanguard";
  const ineligibleEvent = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: vanguard.uid,
    sourceControllerPlayerId: "guest", subjectCardInstanceId: vanguard.uid, subjectControllerPlayerId: "guest",
    currentLocation: "vanguard", battleId: "guest-battle-2", timingWindow: "attack-declared"
  });
  assert.equal(Reducer.discoverAutoTriggers(state, [ineligibleEvent], Engine).queued.length, 0);
  assert.equal(state.pendingAbility, null);

  vanguard.cardName = "Chronojet Dragon";
  vanguard.grade = 2;
  const underGradeEvent = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: "guest", turnPlayerId: "guest", sourceCardInstanceId: vanguard.uid,
    sourceControllerPlayerId: "guest", subjectCardInstanceId: vanguard.uid, subjectControllerPlayerId: "guest",
    currentLocation: "vanguard", battleId: "guest-battle-3", timingWindow: "attack-declared"
  });
  assert.equal(Reducer.discoverAutoTriggers(state, [underGradeEvent], Engine).queued.length, 0);
  assert.equal(state.pendingAbility, null);
});
