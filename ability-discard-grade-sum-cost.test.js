"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");

const printedCost = "COST [choose one or more cards from your hand with the sum of their grades being 3 or greater, and discard them]";
const definitions = new Map([
  ["g0", { id: "g0", grade: 0 }],
  ["g1", { id: "g1", grade: 1 }],
  ["g2", { id: "g2", grade: 2 }],
  ["g3", { id: "g3", grade: 3 }]
]);
const definitionFor = card => definitions.get(card?.cardId) || null;
const parsedCost = engine.parseAbilityCosts(printedCost);
const ability = { id: "test-grade-sum:0", kind: "ACT", costs: parsedCost.costs, costStatus: parsedCost.status };

function makePlayer() {
  return {
    playerId: "joiner",
    vanguard: { uid: "source", cardId: "source", ownerPlayerId: "joiner", controllerPlayerId: "joiner" },
    damage: [], soul: [], rear: [], drop: [],
    hand: [
      { uid: "hand-g1", cardId: "g1", ownerPlayerId: "joiner", controllerPlayerId: "joiner" },
      { uid: "hand-g2", cardId: "g2", ownerPlayerId: "joiner", controllerPlayerId: "joiner" },
      { uid: "hand-g3", cardId: "g3", ownerPlayerId: "joiner", controllerPlayerId: "joiner" }
    ]
  };
}

test("grade-sum cost parser preserves threshold wording instead of splitting false alternatives", () => {
  assert.equal(parsedCost.status, "supported-cost");
  assert.deepEqual(parsedCost.costs, [{ type: "discard-grade-sum", minimumGrade: 3 }]);
  assert.equal(engine.parseAbilityCosts("[Counter Blast 1 or Energy Blast 3]").status, "supported-cost-alternatives");
});

test("aggregate hand grade cost is available only when distinct discardable cards meet the threshold", () => {
  const cards = makePlayer().hand;
  const resources = { discardableHand: cards.length, discardableHandCards: cards, cardDefinitionForInstance: definitionFor, sourceInstanceId: "source" };
  assert.equal(engine.canPayAbilityCosts(ability, resources), true);
  assert.equal(engine.canPayAbilityCosts(ability, { ...resources, discardableHandCards: cards.slice(0, 1) }), false);
  assert.equal(engine.canPayAbilityCosts(ability, { ...resources, cardDefinitionForInstance: undefined }), false);
  assert.equal(engine.canPayAbilityCosts({ ...ability, costs: [{ type: "discard-grade-sum", minimumGrade: 0 }] }, resources), false);
});

test("payer discards exactly the selected cards after verifying their authoritative grade sum", () => {
  const player = makePlayer(), events = [];
  const paid = engine.payAbilityCosts(ability, {
    player, source: player.vanguard, sourceZone: "vanguard", actorPlayerId: "joiner", side: "guest", turnId: 1,
    cardDefinitionForInstance: definitionFor, emitEvent: event => events.push(event)
  }, { cb: [], sb: [], discard: [], gradeSumDiscard: ["hand-g1", "hand-g2"] });
  assert.equal(paid.ok, true);
  assert.deepEqual(player.hand.map(card => card.uid), ["hand-g3"]);
  assert.deepEqual(player.drop.map(card => card.uid), ["hand-g1", "hand-g2"]);
  assert.deepEqual(events.map(event => event.cardInstanceId), ["hand-g1", "hand-g2"]);
  assert.ok(events.every(event => event.type === "card.discarded" && event.previousLocation === "hand" && event.currentLocation === "drop"));
});

test("payer rejects insufficient grade, duplicates, missing cards, and the source without partial payment", () => {
  for (const gradeSumDiscard of [["hand-g1"], ["hand-g1", "hand-g1"], ["missing-card"], ["source"]]) {
    const player = makePlayer(), initialHand = player.hand.map(card => card.uid);
    const paid = engine.payAbilityCosts(ability, { player, source: player.vanguard, actorPlayerId: "joiner", turnId: 1, cardDefinitionForInstance: definitionFor }, { gradeSumDiscard });
    assert.equal(paid.ok, false, JSON.stringify(gradeSumDiscard));
    assert.deepEqual(player.hand.map(card => card.uid), initialHand);
    assert.deepEqual(player.drop, []);
  }
});

test("authoritative remote decision checks the joining player's selected cards and their actual grade sum", () => {
  const player = makePlayer();
  const state = { matchId: "grade-sum-room", stateVersion: 5, processedActionIds: [], players: { guest: player } };
  const pending = { side: "guest", triggerControllerPlayerId: "joiner", instance: player.vanguard, ability };
  const request = ids => ({
    actionId: "grade-sum-decision-" + ids.join("-"), matchId: state.matchId, expectedStateVersion: 5, actorPlayerId: "joiner", accept: true,
    selection: { instanceUid: "source", abilityId: ability.id, costSelections: { gradeSumDiscard: ids } }
  });
  const validate = ids => engine.validateAbilityDecision(state, request(ids), "joiner", pending, { cardDefinitionForInstance: definitionFor });
  assert.deepEqual(validate(["hand-g1", "hand-g2"]), { ok: true });
  assert.equal(validate(["hand-g1"]).reason, "discard-grade-sum-not-met");
  assert.equal(validate(["hand-g1", "hand-g1"]).reason, "invalid-cost-selection");
  assert.equal(validate(["host-card"]).reason, "cost-card-unavailable");
  assert.equal(validate(["source"]).reason, "cannot-discard-source");
});
