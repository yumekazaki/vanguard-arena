"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assessCardPromotion } = require("./promote-fully-verified-cards.js");

function fixture(kind = "CONT", source = "test cfa-1:0") {
  const ability = {
    id: "cfa-1:0",
    cardId: "cfa-1",
    kind,
    printedText: `${kind} exact test text`,
    definition: { id: "cfa-1:0", cardId: "cfa-1", printedText: `${kind} exact test text` },
    conditionStatus: "modeled",
    costStatus: "no-cost",
    choiceStatus: "no-explicit-choice-detected",
    trigger: kind === "AUTO" ? { status: "recognized-trigger" } : null
  };
  const recordsByAbility = new Map([[ability.id, {
    cardId: ability.cardId,
    abilityId: ability.id,
    status: "tests-passing",
    testFiles: ["focused.test.js"],
    testCases: ["exact source and boundary behavior"],
    remaining: null
  }]]);
  return {
    card: { id: "cfa-1" },
    abilities: [ability],
    recordsByAbility,
    validationEvidenceFresh: true,
    readTestFile: () => source,
    isTrustedServerAbility: () => true
  };
}

test("whole-card gate accepts a fully modeled single-ability CONT card with exact passing evidence", () => {
  const result = assessCardPromotion(fixture());
  assert.equal(result.eligible, true);
  assert.deepEqual(result.abilityIds, ["cfa-1:0"]);
  assert.deepEqual(result.reasons, []);
});

test("AUTO and ACT promotion requires trusted server support and host/joiner coverage", () => {
  const auto = fixture("AUTO", "test cfa-1:0 with host and joining player");
  assert.equal(assessCardPromotion(auto).eligible, true);
  assert.equal(assessCardPromotion({ ...auto, isTrustedServerAbility: () => false }).reasons.includes("cfa-1:0:missing-authoritative-server-definition"), true);
  assert.equal(assessCardPromotion({ ...auto, readTestFile: () => "test cfa-1:0 only on host" }).reasons.includes("cfa-1:0:missing-two-player-seat-coverage"), true);
});

test("whole-card gate rejects stale suite evidence, missing exact IDs, and explicit live-play gaps", () => {
  assert.equal(assessCardPromotion({ ...fixture(), validationEvidenceFresh: false }).reasons.includes("full-suite-evidence-stale"), true);
  assert.equal(assessCardPromotion({ ...fixture(), readTestFile: () => "generic pattern test" }).reasons.includes("cfa-1:0:tests-do-not-reference-exact-ability-id"), true);
  const liveGap = fixture();
  liveGap.recordsByAbility.get("cfa-1:0").remaining = "Live browser multiplayer remains untested.";
  assert.equal(assessCardPromotion(liveGap).reasons.includes("cfa-1:0:explicit-live-gameplay-gap"), true);
  assert.equal(assessCardPromotion(liveGap).reasons.includes("cfa-1:0:unresolved-remaining-work"), true);
});

test("any nonempty remaining-work note blocks whole-card promotion", () => {
  const unresolved = fixture();
  unresolved.recordsByAbility.get("cfa-1:0").remaining = "Another printed ability is not yet validated.";
  const result = assessCardPromotion(unresolved);
  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, ["cfa-1:0:unresolved-remaining-work"]);
});

test("one unsupported printed ability blocks promotion of the entire card", () => {
  const record = fixture();
  const second = { ...record.abilities[0], id: "cfa-1:1", definition: null };
  record.abilities.push(second);
  assert.equal(assessCardPromotion(record).eligible, false);
  assert.equal(assessCardPromotion(record).reasons.includes("cfa-1:1:missing-exact-structured-definition"), true);
});
