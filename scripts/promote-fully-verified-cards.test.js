"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assessCardPromotion } = require("./promote-fully-verified-cards.js");
const SINGLE_ABILITY_GENERIC_REMAINING = "Ability-level regression evidence only; whole-card verification requires every other printed ability and relevant rules interactions to pass.";

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

test("the exact generic sibling warning does not block a fully evidenced single-ability card", () => {
  const single = fixture();
  single.recordsByAbility.get("cfa-1:0").remaining = SINGLE_ABILITY_GENERIC_REMAINING;
  const result = assessCardPromotion(single);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
});

test("a sole printed ability may be linked by exact card ID when its cited test parses and asserts that card", () => {
  const source = 'const IDS = ["cfa-1"]; Engine.parseCardAbilitiesCached(card); test("cfa-1 exact ability", () => assert.equal(true, true));';
  const single = fixture("CONT", source);
  single.recordsByAbility.get("cfa-1:0").remaining = SINGLE_ABILITY_GENERIC_REMAINING;
  assert.equal(assessCardPromotion(single).eligible, true);

  const noParser = fixture("CONT", 'const IDS = ["cfa-1"]; test("generic card check", () => assert.equal(true, true));');
  noParser.recordsByAbility.get("cfa-1:0").remaining = SINGLE_ABILITY_GENERIC_REMAINING;
  assert.equal(assessCardPromotion(noParser).reasons.includes("cfa-1:0:tests-do-not-reference-exact-ability-id"), true);

  const sibling = fixture("CONT", source);
  const second = {
    ...sibling.abilities[0],
    id: "cfa-1:1",
    printedText: "CONT exact second ability",
    definition: { id: "cfa-1:1", cardId: "cfa-1", printedText: "CONT exact second ability" }
  };
  sibling.abilities.push(second);
  sibling.recordsByAbility.get("cfa-1:0").remaining = SINGLE_ABILITY_GENERIC_REMAINING;
  sibling.recordsByAbility.set(second.id, {
    cardId: "cfa-1",
    abilityId: second.id,
    status: "tests-passing",
    testFiles: ["focused.test.js"],
    testCases: ["card-specific behavior"],
    remaining: SINGLE_ABILITY_GENERIC_REMAINING
  });
  assert.equal(assessCardPromotion(sibling).reasons.includes("cfa-1:0:tests-do-not-reference-exact-ability-id"), true);
});

test("a data-driven family test may link evidence through an exact per-ability TAP case", () => {
  const source = [
    "for (const card of loadCatalog()) {",
    "  for (const ability of Engine.parseCardAbilitiesCached(card)) {",
    "    await t.test(ability.id, () => assert.equal(ability.definition.id, ability.id));",
    "  }",
    "}"
  ].join("\n");
  const single = fixture("CONT", source);
  single.recordsByAbility.get("cfa-1:0").testCases = ["cfa-1:0"];
  single.recordsByAbility.get("cfa-1:0").remaining = SINGLE_ABILITY_GENERIC_REMAINING;
  assert.equal(assessCardPromotion(single).eligible, true);

  const unrelatedCase = fixture("CONT", source);
  unrelatedCase.recordsByAbility.get("cfa-1:0").testCases = ["cfa-2:0"];
  unrelatedCase.recordsByAbility.get("cfa-1:0").remaining = SINGLE_ABILITY_GENERIC_REMAINING;
  assert.equal(assessCardPromotion(unrelatedCase).reasons.includes("cfa-1:0:tests-do-not-reference-exact-ability-id"), true);
});

test("the exact generic warning still blocks cards with any additional printed ability", () => {
  const multi = fixture();
  const second = {
    ...multi.abilities[0],
    id: "cfa-1:1",
    printedText: "CONT exact second ability",
    definition: { id: "cfa-1:1", cardId: "cfa-1", printedText: "CONT exact second ability" }
  };
  multi.abilities.push(second);
  multi.recordsByAbility.set(second.id, {
    cardId: "cfa-1",
    abilityId: second.id,
    status: "tests-passing",
    testFiles: ["focused.test.js"],
    testCases: ["exact second ability evidence"],
    remaining: SINGLE_ABILITY_GENERIC_REMAINING
  });
  multi.readTestFile = () => "test cfa-1:0 and cfa-1:1";
  const result = assessCardPromotion(multi);
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.includes("cfa-1:1:unresolved-remaining-work"), true);
});

test("one unsupported printed ability blocks promotion of the entire card", () => {
  const record = fixture();
  const second = { ...record.abilities[0], id: "cfa-1:1", definition: null };
  record.abilities.push(second);
  assert.equal(assessCardPromotion(record).eligible, false);
  assert.equal(assessCardPromotion(record).reasons.includes("cfa-1:1:missing-exact-structured-definition"), true);
});
