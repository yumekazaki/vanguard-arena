"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeAbilityEvidence } = require("./record-ability-test-evidence.js");

test("ability evidence updates append regression coverage without deleting prior tests", () => {
  const merged = mergeAbilityEvidence({
    status: "tests-passing",
    testFiles: ["older.test.js"],
    testCases: ["older case"]
  }, {
    status: "tests-passing",
    testFiles: ["newer.test.js", "older.test.js"],
    testCases: ["newer case", "older case"],
    fullyVerified: false,
    remaining: "Ability-level evidence only."
  });

  assert.deepEqual(merged.testFiles, ["older.test.js", "newer.test.js"]);
  assert.deepEqual(merged.testCases, ["older case", "newer case"]);
  assert.equal(merged.status, "tests-passing");
  assert.equal(merged.fullyVerified, false);
});

test("ability-level evidence refresh cannot downgrade a fully verified card record", () => {
  const merged = mergeAbilityEvidence({
    status: "fully-verified",
    testFiles: ["whole-card.test.js"],
    testCases: ["all abilities pass"],
    fullyVerified: true,
    remaining: null
  }, {
    status: "tests-passing",
    testFiles: ["focused.test.js"],
    testCases: ["focused ability passes"],
    fullyVerified: false,
    remaining: "Ability-level evidence only."
  });

  assert.deepEqual(merged.testFiles, ["whole-card.test.js", "focused.test.js"]);
  assert.deepEqual(merged.testCases, ["all abilities pass", "focused ability passes"]);
  assert.equal(merged.status, "fully-verified");
  assert.equal(merged.fullyVerified, true);
  assert.equal(merged.remaining, null);
});
