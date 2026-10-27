"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-boosted-clan-vanguard-hit-return-source-hand-v1";

test("all nine clan-specific boosted-hit return abilities require the exact booster, attacker, clan, and Vanguard hit", () => {
  const matches = [];
  for (const card of loadCatalog()) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== PATTERN) continue;
    matches.push(ability);
    assert.equal(ability.trigger.eventType, "attack.hit");
    assert.equal(ability.trigger.subject, "booster");
    assert.equal(ability.trigger.targetLocation, "vanguard");
    assert.ok(ability.trigger.boostedUnitClan);
    assert.equal(ability.trigger.requiresBoostedBattle, true);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.costs, []);
    assert.deepEqual(ability.effects, [{ op: "move-source-to-hand", target: "source", from: "rear-guard" }]);
  }
  assert.equal(matches.length, 9);
  const ability = matches.find(item => item.trigger.boostedUnitClan === "Nova Grappler") || matches[0];
  const event = Engine.createGameEvent({ matchId: "boosted-clan-hit" }, {
    type: "attack.hit", actingPlayerId: "player-a", turnPlayerId: "player-a", sourceCardInstanceId: "attacker",
    subjectCardInstanceId: "defender", targetCardInstanceIds: ["defender"], targetLocation: "vanguard",
    attackingUnitInstanceId: "attacker", boosterCardInstanceId: "booster", boostedCardInstanceId: "attacker",
    boostedCardClan: ability.trigger.boostedUnitClan, boostedCardClans: [ability.trigger.boostedUnitClan], battleId: "boosted-clan-hit:battle"
  });
  const matchesEvent = candidate => Engine.eventMatchesAbilityTrigger(ability, "hit", candidate, "booster", "rear-left", "vanguard", "player-a");
  assert.equal(matchesEvent(event), true);
  assert.equal(matchesEvent({ ...event, boosterCardInstanceId: "other-booster" }), false);
  assert.equal(matchesEvent({ ...event, boostedCardInstanceId: "other-attacker" }), false);
  assert.equal(matchesEvent({ ...event, boostedCardClan: "wrong", boostedCardClans: ["wrong"] }), false);
  assert.equal(matchesEvent({ ...event, targetLocation: "rear-guard" }), false);
  assert.equal(matchesEvent({ ...event, battleId: null }), false);
});
