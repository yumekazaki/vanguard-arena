"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { RULE_KEYWORD_CUES, classifyAutoEvent, extractKeywordMechanics, indexAbility, buildAbilityKeywordIndex } = require("./build-ability-keyword-index.js");

test("keyword triage covers the named mechanics in Comprehensive Rules section 14", () => {
  assert.equal(RULE_KEYWORD_CUES.length, 61);
  assert.equal(new Set(RULE_KEYWORD_CUES.map(([tag]) => tag)).size, RULE_KEYWORD_CUES.length);
  for (const [tag, pattern] of RULE_KEYWORD_CUES) {
    const example = ({ wave: "Wave-1st", success: "Success 3" })[tag] || tag.replace(/-/g, " ");
    assert.equal(pattern.test(example), true, `${tag} should match its literal keyword cue`);
  }
  assert.ok(extractKeywordMechanics("[OverDress] [White Wings] Twin Drive!!!").includes("overdress"));
  assert.ok(extractKeywordMechanics("[OverDress] [White Wings] Twin Drive!!!").includes("white-wings"));
  assert.ok(extractKeywordMechanics("[OverDress] [White Wings] Twin Drive!!!").includes("twin-drive"));
  assert.ok(extractKeywordMechanics("Persona Ride and Over Soul").includes("persona-ride"));
  assert.ok(extractKeywordMechanics("Persona Ride and Over Soul").includes("over-soul"));
});

test("literal trigger cues preserve exact source and circle for own-source events", () => {
  assert.deepEqual(classifyAutoEvent("AUTO [RC]: When this unit is placed on (RC) from hand, draw a card."), {
    status: "literal-cue", cue: "source-placement", event: "card.placed", subject: "source",
    matchedText: "When this unit is placed on (RC) from hand", circle: "rc", origin: "hand", candidates: []
  });
  assert.equal(classifyAutoEvent("AUTO [RC]: When this unit boosts a vanguard, draw a card.").subject, "source");
  assert.equal(classifyAutoEvent("AUTO [RC]: When this unit attacks a vanguard, draw a card.").event, "unit.attacked");
});

test("drive checks, rides, and boosted battle hits receive distinct cues", () => {
  assert.equal(classifyAutoEvent("AUTO [RC]: When your drive check reveals a trigger unit, this unit gets power +5000.").event, "drive.checked");
  assert.equal(classifyAutoEvent("AUTO: When this unit is rode upon, draw a card.").event, "card.ridden");
  const hit = classifyAutoEvent("AUTO [RC]: When the attack this unit boosted hits, draw a card.");
  assert.equal(hit.event, "attack.hit");
  assert.equal(hit.subject, "booster");
});

test("short placement, being ridden, boost-target, and related events retain their exact subject", () => {
  const placed = classifyAutoEvent("AUTO [RC]: When placed, draw a card.");
  assert.equal(placed.cue, "source-placement-shortform");
  assert.equal(placed.subject, "source");

  const ridden = classifyAutoEvent("AUTO: When another unit from the same clan rides this unit, you may call it to RC.");
  assert.equal(ridden.cue, "source-ridden-by-another");
  assert.equal(ridden.event, "card.ridden");
  assert.equal(ridden.subject, "ridden-source");

  assert.equal(classifyAutoEvent("AUTO [VC]: When this unit’s drive check reveals a trigger, draw a card.").subject, "source-check");
  assert.equal(classifyAutoEvent("AUTO [VC]: When this unit is boosted by a «Royal Paladin», draw a card.").subject, "boosted-source");
  assert.equal(classifyAutoEvent("AUTO [VC]: When your rear-guard’s attack hits a vanguard, draw a card.").subject, "controller-attacker");
  assert.equal(classifyAutoEvent("AUTO [RC]: When this unit becomes stand, draw a card.").event, "unit.stood");
});

test("intercept is indexed as the source moving from Rear-Guard to Guardian Circle", () => {
  const intercept = classifyAutoEvent("AUTO [RC]: When this unit intercepts, this unit gets shield +5000 until end of that battle.");
  assert.equal(intercept.status, "literal-cue");
  assert.equal(intercept.cue, "source-intercepts");
  assert.equal(intercept.event, "card.placed");
  assert.equal(intercept.subject, "source");
  assert.equal(intercept.circle, "guardian");
  assert.equal(intercept.origin, "rear-guard");
  const other = classifyAutoEvent("AUTO [RC]: When another unit intercepts, draw a card.");
  assert.equal(other.status, "unclassified");
  assert.equal(other.event, null);
});

test("multiple literal events are flagged for review instead of collapsed", () => {
  const result = classifyAutoEvent("AUTO [RC]: When this unit attacks, and when the attack hits, draw a card.");
  assert.equal(result.status, "ambiguous-multiple-cues");
  assert.equal(result.event, null);
  assert.equal(result.candidates.length, 2);
});

test("keyword index reports cues and review state without promoting definitions", () => {
  const cards = [{ id: "cfa-1" }, { id: "cfa-2" }];
  const abilities = new Map([
    ["cfa-1", [{ id: "cfa-1:0", kind: "AUTO", raw: "[RC]: When this unit boosts, COST [discard a card from hand], choose a vanguard, and this unit gets power +2000 until end of that battle.", definition: null }]],
    ["cfa-2", [{ id: "cfa-2:0", kind: "ACT", raw: "[RC] 1/Turn: COST [Counter Blast 1], draw a card.", definition: { source: { patternId: "act-example" } } }]]
  ]);
  const report = buildAbilityKeywordIndex(cards, { records: [{ abilityId: "cfa-1:0", status: "none" }] }, card => abilities.get(card.id));
  assert.equal(report.abilityBlocks, 2);
  assert.equal(report.byKind.AUTO.unsupportedOrUnreviewed, 1);
  assert.equal(report.byKind.ACT.withCosts, 1);
  assert.equal(report.autoTriggerCueStatus.literalSingleCue, 1);
  assert.equal(report.ruleKeywordCueCount, 61);
  assert.ok(Array.isArray(report.keywordMechanicCoverage));
  assert.equal(report.triggerGroups[0].unsupportedOrUnreviewed, 1);
  assert.equal(report.records.find(record => record.abilityId === "cfa-1:0").reviewState, "unsupported-or-unreviewed");
});

test("keyword index groups exact printed text without treating a group as verification", () => {
  const text = "[RC]: When this unit boosts, draw a card.";
  const cards = [{ id: "cfa-a" }, { id: "cfa-b" }, { id: "cfa-c" }];
  const abilities = new Map([
    ["cfa-a", [{ id: "cfa-a:0", kind: "AUTO", raw: text, definition: null }]],
    ["cfa-b", [{ id: "cfa-b:0", kind: "AUTO", raw: text.replace(/ /g, "  "), definition: null }]],
    ["cfa-c", [{ id: "cfa-c:0", kind: "ACT", raw: text, definition: null }]]
  ]);
  const report = buildAbilityKeywordIndex(cards, { records: [] }, card => abilities.get(card.id));
  assert.equal(report.identicalPrintedTextGroups.length, 1);
  assert.deepEqual(report.identicalPrintedTextGroups[0].abilityIds, ["cfa-a:0", "cfa-b:0"]);
  assert.equal(report.identicalPrintedTextGroups[0].unsupportedOrUnreviewed, 2);
  assert.equal(report.records.find(record => record.abilityId === "cfa-a:0").reviewState, "unsupported-or-unreviewed");
  assert.ok(report.records.find(record => record.abilityId === "cfa-a:0").exactTextFamilyId.startsWith("exact-"));
});

test("recognized keyword names are recorded as triage tags only", () => {
  const cards = [{ id: "cfa-k" }];
  const abilities = new Map([["cfa-k", [{ id: "cfa-k:0", kind: "AUTO", raw: "Forerunner (When another unit from the same clan rides this unit, you may call this card to RC.)", definition: null }]]]);
  const report = buildAbilityKeywordIndex(cards, { records: [] }, card => abilities.get(card.id));
  const record = report.records[0];
  assert.ok(record.keywordMechanics.includes("forerunner"));
  assert.equal(record.reviewState, "unsupported-or-unreviewed");
  assert.equal(report.keywordMechanicCoverage.find(item => item.keyword === "forerunner").abilityCount, 1);
});
