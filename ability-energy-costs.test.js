"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");

test("Energy Blast costs parse their exact amount and fail closed without Energy Generator", () => {
  for (const text of ["ACT: COST [Energy-Blast 3], draw a card.", "ACT: COST [E Blast 7], draw a card."]) {
    const parsed = Engine.parseAbilityCosts(text);
    assert.equal(parsed.status, "supported-cost", text);
    assert.deepEqual(parsed.costs, [{ type: "energy-blast", count: text.includes("7") ? 7 : 3 }]);
    assert.equal(Engine.canPayAbilityCosts({ costStatus: parsed.status, costs: parsed.costs }, { energy: 10, hasEnergyGenerator: true }), true);
    assert.equal(Engine.canPayAbilityCosts({ costStatus: parsed.status, costs: parsed.costs }, { energy: 10 }), false);
    assert.equal(Engine.canPayAbilityCosts({ costStatus: parsed.status, costs: parsed.costs }, { energy: 2, hasEnergyGenerator: true }), false);
  }
});

test("alternative resource costs are not misread as costs that must all be paid", () => {
  const parsed = Engine.parseAbilityCosts("ACT: COST [Counter-Blast 1 or Energy-Blast 3], draw a card.");
  assert.equal(parsed.status, "needs-review");
  assert.deepEqual(parsed.costs, []);
});

test("Energy Blast payment is atomic, consumes the right amount, and tracks this-turn spending", () => {
  const source = { uid: "energy-source", cardId: "energy-source", rested: false };
  const player = { playerId: "p1", energy: 8, energySpentThisTurn: 1, damage: [], soul: [], hand: [], drop: [], rear: [source] };
  const ability = { id: "energy-act", kind: "ACT", costStatus: "supported-cost", costs: [{ type: "energy-blast", count: 5 }] };
  const context = { player, source, sourceZone: "rear-left", side: "human", turnId: 2, hasEnergyGenerator: true };
  const result = Engine.payAbilityCosts(ability, context, {});
  assert.equal(result.ok, true, result.reason);
  assert.equal(player.energy, 3);
  assert.equal(player.energySpentThisTurn, 6);

  const snapshot = structuredClone(player);
  assert.deepEqual(Engine.payAbilityCosts(ability, { ...context, player: { ...player, energy: 4 } }, {}), { ok: false, reason: "insufficient-energy" });
  assert.deepEqual(player, snapshot);
  assert.deepEqual(Engine.payAbilityCosts(ability, { ...context, hasEnergyGenerator: false }, {}), { ok: false, reason: "insufficient-energy" });
  assert.deepEqual(player, snapshot);
});
