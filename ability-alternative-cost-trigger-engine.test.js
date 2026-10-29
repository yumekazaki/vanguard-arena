"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");

test("alternative cost parser preserves exclusive Counter Blast and Energy Blast branches", () => {
  const parsed = engine.parseAbilityCosts("[Counter Blast 1 or Energy Blast 3]");
  assert.equal(parsed.status, "supported-cost-alternatives");
  assert.deepEqual(parsed.costAlternatives, [
    [{ type: "counter-blast", count: 1 }],
    [{ type: "energy-blast", count: 3 }]
  ]);
  const ability = { costStatus: parsed.status, costAlternatives: parsed.costAlternatives };
  assert.equal(engine.canPayAbilityCosts(ability, { faceUpDamage: 1 }), true);
  assert.equal(engine.canPayAbilityCosts(ability, { energy: 3, hasEnergyGenerator: true }), true);
  assert.equal(engine.canPayAbilityCosts(ability, { faceUpDamage: 0, energy: 2, hasEnergyGenerator: true }), false);
  const player = { playerId: "p1", damage: [{ uid: "damage-1", faceDown: false }], soul: [], hand: [], drop: [], rear: [], energy: 3 };
  const source = { uid: "source-1" };
  const paid = engine.payAbilityCosts({ id: "alt-cost", costAlternatives: parsed.costAlternatives, costs: [], costStatus: "supported-cost" }, { player, source, sourceZone: "hand", side: "human", actorPlayerId: "p1", turnId: 1, hasEnergyGenerator: true }, { costAlternativeIndex: 1, cb: [], sb: [], discard: [], reveal: [] });
  assert.equal(paid.ok, true);
  assert.equal(player.energy, 0);
  assert.equal(player.damage[0].faceDown, false);
});

test("parsed AUTO retains its structured alternative cost options", () => {
  const ability = engine.parseCardAbilities({ id: "test-alt", text: "AUTO: When this unit is placed on GC from hand, COST [Counter Blast 1 or Energy Blast 3], and draw a card." })[0];
  assert.equal(ability.costStatus, "supported-cost-alternatives");
  assert.deepEqual(ability.costAlternatives, [[{ type: "counter-blast", count: 1 }], [{ type: "energy-blast", count: 3 }]]);
});

test("server decision validation requires one payable and explicitly selected cost branch", () => {
  const state = {
    matchId: "match-1", stateVersion: 4, processedActionIds: [],
    players: { host: { playerId: "p1", damage: [{ uid: "damage-1", faceDown: false }], energy: 3, crests: [], soul: [], hand: [], drop: [], rear: [] } }
  };
  const ability = { id: "alt-cost", kind: "AUTO", costs: [], costAlternatives: [[{ type: "counter-blast", count: 1 }], [{ type: "energy-blast", count: 3 }]], costStatus: "supported-cost", canDecline: false };
  const pending = { side: "host", triggerControllerPlayerId: "p1", instance: { uid: "source-1", controllerPlayerId: "p1" }, ability };
  const decide = (index, cb = [], hasEnergyGenerator = false) => engine.validateAbilityDecision(state, {
    actionId: `action-${index}-${hasEnergyGenerator}`, matchId: "match-1", expectedStateVersion: 4, actorPlayerId: "p1", accept: true,
    selection: { instanceUid: "source-1", abilityId: "alt-cost", costAlternativeIndex: index, costSelections: { cb, sb: [], discard: [], reveal: [] } }
  }, "p1", pending, { hasEnergyGenerator });
  assert.equal(decide(undefined).ok, false);
  assert.equal(decide(0, ["damage-1"]).ok, true);
  assert.equal(decide(0, []).ok, false);
  assert.equal(decide(1, [], false).ok, false);
  assert.equal(decide(1, [], true).ok, true);
  assert.equal(decide(1, ["damage-1"], true).ok, false);
});

test("alternative AUTO trigger routes match only the exact source event and route conditions", () => {
  const ability = {
    kind: "AUTO", conditionStatus: "modeled", costStatus: "supported-cost",
    requiredLocation: [],
    trigger: {
      status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: [],
      anyOf: [
        { eventType: "card.placed", subject: "event-subject", circles: ["guardian"], sourceLocation: "hand" },
        { eventType: "card.discarded", subject: "event-subject", circles: [], sourceLocation: "hand", discardReason: "ride-deck-cost" }
      ]
    }
  };
  const place = { type: "card.placed", subjectCardInstanceId: "source-1", previousLocation: "hand", currentLocation: "guardian" };
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "place", place, "source-1", "hand", "guardian", "p1"), true);
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "place", place, "other-copy", "hand", "guardian", "p1"), false);
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "place", { ...place, currentLocation: "rear-guard" }, "source-1", "hand", "rear-guard", "p1"), false);
  const discard = { type: "card.discarded", subjectCardInstanceId: "source-1", previousLocation: "hand", currentLocation: "drop", discardReason: "ride-deck-cost" };
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "discard", discard, "source-1", "hand", "drop", "p1"), true);
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "discard", { ...discard, discardReason: "ordinary-discard" }, "source-1", "hand", "drop", "p1"), false);
});
