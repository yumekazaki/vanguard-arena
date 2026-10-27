"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN_ID = "auto-own-attack-vanguard-power-battle-v1";

test("Crimson Impact, Metatron power AUTO matches its exact Vanguard attack and cannot claim it twice", () => {
  const cards = loadCatalog();
  const card = cards.find(candidate => candidate.id === "cfa-918");
  assert.ok(card, "catalog entry cfa-918 exists");
  assert.equal(card.name, "Crimson Impact, Metatron");

  const ability = Engine.parseCardAbilitiesCached(card).find(candidate => candidate.definition?.source?.patternId === PATTERN_ID);
  assert.ok(ability);
  assert.equal(ability.id, "cfa-918:1");
  assert.equal(ability.kind, "AUTO");
  assert.equal(ability.trigger.eventType, "unit.attacked");
  assert.equal(ability.trigger.subject, "source");
  assert.equal(ability.trigger.targetLocation, "vanguard");
  assert.deepEqual(ability.requiredLocation, ["vanguard"]);
  assert.match(ability.printedText, /When this unit attacks a vanguard, this unit gets power \+3000 until the end of that battle\./i);
  assert.equal(auditCatalog(cards).patterns[PATTERN_ID], 69);

  const state = { matchId: "metatron-own-attack", eventSequence: 0, processedEvents: [], processedAbilityTriggers: [] };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: "player-a", turnPlayerId: "player-a",
    sourceCardInstanceId: "metatron-instance-a", sourceControllerPlayerId: "player-a",
    subjectCardInstanceId: "metatron-instance-a", subjectControllerPlayerId: "player-a",
    targetLocation: "vanguard", battleId: "battle-a", phase: "battle", timingWindow: "attack-declared"
  });
  const matchesOwnAttack = (candidate, sourceUid = "metatron-instance-a", sourceZone = "vanguard") =>
    Engine.eventMatchesAbilityTrigger(ability, "attack", candidate, sourceUid, sourceZone, sourceZone, "player-a");

  assert.equal(matchesOwnAttack(event), true);
  assert.equal(matchesOwnAttack({ ...event, sourceCardInstanceId: "other-unit-instance", subjectCardInstanceId: "other-unit-instance" }), false);
  assert.equal(matchesOwnAttack(event, "another-metatron-copy"), false);
  assert.equal(matchesOwnAttack({ ...event, targetLocation: "rear-left" }), false);
  assert.equal(matchesOwnAttack(event, "metatron-instance-a", "rear-left"), false);

  assert.equal(Engine.claimGameEvent(state, event.eventId), true);
  assert.equal(Engine.claimAbilityTrigger(state, event.eventId, "metatron-instance-a", ability.id), true);
  assert.equal(Engine.claimGameEvent(state, event.eventId), false);
  assert.equal(Engine.claimAbilityTrigger(state, event.eventId, "metatron-instance-a", ability.id), false);
  assert.equal(Engine.claimAbilityTrigger(state, event.eventId, "other-unit-instance", ability.id), true);
});
