"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = require("./ability-engine.js");
engine.registerAbilityDefinitions(require("./ability-definitions.js"));

const CARD_IDS = ["cfa-10980", "cfa-11052", "cfa-11100", "cfa-11610", "cfa-12065", "cfa-12112"];

test("all six exact Normal Order CONT cards apply +5000 only on Rear-Guard after their controller plays a Normal Order", () => {
  const cards = require("./scripts/audit-ability-catalog.js").loadCatalog();
  for (const cardId of CARD_IDS) {
    const card = cards.find(item => String(item.id) === cardId);
    assert.ok(card, `catalog contains ${cardId}`);
    const ability = engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:0`);
    assert.ok(ability, `parsed ${cardId}:0`);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.definition?.source?.patternId, "cont-rc-normal-order-power-v1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(engine.isManuallyActivatable(ability), false);
    assert.deepEqual(engine.evaluateContinuousEffects([ability], { location: "rear-guard", normalOrderPlayedThisTurn: false }), { power: 0, critical: 0, drive: 0 });
    assert.deepEqual(engine.evaluateContinuousEffects([ability], { location: "rear-guard", normalOrderPlayedThisTurn: true }), { power: 5000, critical: 0, drive: 0 });
    assert.deepEqual(engine.evaluateContinuousEffects([ability], { location: "vanguard", normalOrderPlayedThisTurn: true }), { power: 0, critical: 0, drive: 0 });
  }
});

test("Normal Order count is scoped to the active controller on both client and authoritative reducer", () => {
  const client = fs.readFileSync("app.js", "utf8");
  const reducer = fs.readFileSync("ability-server-reducer.js", "utf8");
  assert.ok(client.includes("normalOrderPlayedThisTurn:match.side===side&&orderCount>0"));
  assert.ok(reducer.includes("normalOrderPlayedThisTurn: state.side === side && Number(state.ordersPlayedThisTurn || 0) > 0"));
});
