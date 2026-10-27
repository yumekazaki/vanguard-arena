"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");
engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const addedIds = ["cfa-5289", "cfa-5299", "cfa-5303", "cfa-5306", "cfa-5307", "cfa-5310", "cfa-5344", "cfa-5350", "cfa-5352"];
const patternId = "auto-g-guardian-discard-bind-heal-charge-choice-v1";
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));

test("the exact from-hand G-Guardian Heal wording joins the existing validated 48-card handler", () => {
  for (const cardId of addedIds) {
    const card = cards.get(cardId);
    assert.ok(card, `missing catalog record ${cardId}`);
    const ability = engine.parseCardAbilitiesCached(card)[0];
    assert.equal(ability.id, `${cardId}:0`);
    assert.equal(ability.definition?.source?.patternId, patternId);
    assert.equal(ability.trigger?.eventType, "card.discarded");
    assert.equal(ability.trigger?.sourceLocation, "hand");
    assert.equal(ability.trigger?.discardReason, "g-guardian-cost");
    assert.deepEqual(ability.definition?.effects, [{ op: "g-guardian-discard-charge-choice", target: "controller" }]);
    assert.equal(ability.definition?.costs?.[0]?.type, "source-bind");
    assert.equal(ability.definition?.costs?.[1]?.type, "bind-heal-from-drop");
  }
});

test("from-hand wording still requires the exact source instance and G-Guardian discard cause", () => {
  const card = cards.get("cfa-5289");
  const ability = engine.parseCardAbilitiesCached(card)[0];
  const state = { matchId: "strict-g-guard-source", eventSequence: 0 };
  const makeEvent = (uid, reason = "g-guardian-cost", location = "hand") => engine.createGameEvent(state, {
    type: "card.discarded", actingPlayerId: "defender", turnPlayerId: "attacker",
    sourceCardInstanceId: uid, sourceOwnerPlayerId: "defender", sourceControllerPlayerId: "defender",
    subjectCardInstanceId: uid, subjectOwnerPlayerId: "defender", subjectControllerPlayerId: "defender",
    previousLocation: location, currentLocation: "drop", discardReason: reason,
    timingWindow: "g-guardian-cost"
  });
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "discard", makeEvent("heal-source"), "heal-source", "hand", "hand", "defender"), true);
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "discard", makeEvent("different-heal"), "heal-source", "hand", "hand", "defender"), false);
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "discard", makeEvent("heal-source", "stride-cost"), "heal-source", "hand", "hand", "defender"), false);
  assert.equal(engine.eventMatchesAbilityTrigger(ability, "discard", makeEvent("heal-source", "g-guardian-cost", "drop"), "heal-source", "drop", "drop", "defender"), false);
});

test("the expanded compiler remains limited to the reviewed 48 exact abilities", () => {
  let count = 0;
  for (const card of cards.values()) for (const ability of engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId !== patternId) continue;
    count++;
    assert.match(ability.raw, /discarded(?: from hand)? for the cost of calling a G guardian/i);
    assert.equal(ability.trigger?.discardReason, "g-guardian-cost");
    assert.equal(ability.trigger?.sourceLocation, "hand");
  }
  assert.equal(count, 48);
});
