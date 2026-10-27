"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCatalog } = require("./audit-ability-catalog.js");
const { buildAbilityWorkQueue } = require("./build-ability-work-queue.js");

test("central work queue covers unverified abilities and separates reviewed mechanics from similarity candidates", () => {
  const cards = loadCatalog();
  const result = buildAbilityWorkQueue(cards, {
    records: [{ abilityId: "cfa-5289:0", status: "tests-passing", testFiles: ["example.test.js"], testCases: ["example"] }],
    latestFullSuite: { status: "passed", tests: 1, passed: 1, validationInputDigest: "stale" }
  }, path.resolve(__dirname, ".."));

  assert.equal(result.counts.catalogAbilities, 17240);
  assert.equal(result.counts.remainingAbilities, 17240);
  assert.equal(result.counts.fullyVerifiedCards, 0);
  assert.equal(result.counts.fullyVerifiedAbilities, 0);
  assert.equal(result.validationEvidenceFresh, false);
  assert.ok(result.counts.unsupported > 0);
  const reviewed = result.items.find(item => item.abilityId === "cfa-5289:0");
  assert.ok(reviewed);
  assert.equal(reviewed.mechanicGroupType, "reviewed-mechanic");
  assert.deepEqual(reviewed.missingServerEffectHandlers, []);
  assert.ok(reviewed.workFlags.includes("full-suite-evidence-stale"));
  assert.ok(reviewed.workFlags.includes("card-level-verification-incomplete"));
  const candidate = result.items.find(item => item.mechanicGroupType === "unreviewed-similarity-candidate");
  assert.ok(candidate);
  assert.ok(candidate.workFlags.includes("unsupported-or-unreviewed"));
  assert.ok(result.groups.some(group => group.mechanicGroup === reviewed.mechanicGroup));
  for (const cardId of ["cfa-2549", "cfa-8254", "cfa-5673", "cfa-3002"]) {
    const specialServerFamily = result.items.find(item => item.cardId === cardId && item.kind === "AUTO");
    assert.ok(specialServerFamily, `expected reviewed server-family ability for ${cardId}`);
    assert.deepEqual(specialServerFamily.missingServerEffectHandlers, [], `exact family is supported for ${cardId}`);
  }
});
