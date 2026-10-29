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
  const sentinel = result.items.find(item => item.abilityId === "cfa-10087:0");
  assert.ok(sentinel, "real Elementaria Sanctitude Sentinel keyword should be queued");
  assert.equal(sentinel.kind, "CONT");
  assert.deepEqual(sentinel.missingRequirements, [], "a deck-limit reminder is not an activation choice for a continuous keyword");
  assert.ok(sentinel.workFlags.includes("missing-regression-evidence"), "keyword review evidence is still required in this isolated queue fixture");
  const candidate = result.items.find(item => item.mechanicGroupType === "unreviewed-similarity-candidate");
  assert.ok(candidate);
  assert.ok(candidate.workFlags.includes("unsupported-or-unreviewed"));
  assert.ok(result.groups.some(group => group.mechanicGroup === reviewed.mechanicGroup));
  assert.ok(reviewed.dependencies.some(dependency => dependency.id === "fresh-full-suite"));
  assert.ok(candidate.dependencies.some(dependency => dependency.type === "candidate-review" && dependency.shared === false));
  assert.ok(candidate.dependencies.some(dependency => dependency.id === `whole-card-evidence:${candidate.cardId}`));
  assert.equal(result.counts.missingTrustedServerDefinitions, 0, "every compiled definition in the current registry must be registered for trusted server resolution");
  assert.deepEqual(result.items.filter(item => item.missingTrustedDefinition), []);
  const highestImpactBlocker = result.dependencySummary[0];
  assert.ok(highestImpactBlocker.blockedAbilityCount >= 1);
  assert.ok(result.dependencyEdges.some(edge => edge.from === `ability:${candidate.abilityId}` && edge.to === `whole-card-evidence:${candidate.cardId}`));
  assert.ok(result.cardVerificationDependencies.some(node => node.id === `whole-card-evidence:${candidate.cardId}` && node.dependsOn.includes(`ability:${candidate.abilityId}`)));
  assert.match(result.rulesNote, /never proves that candidate abilities share rules semantics/);
  for (const cardId of ["cfa-2549", "cfa-8254", "cfa-5673", "cfa-3002"]) {
    const specialServerFamily = result.items.find(item => item.cardId === cardId && item.kind === "AUTO");
    assert.ok(specialServerFamily, `expected reviewed server-family ability for ${cardId}`);
    assert.deepEqual(specialServerFamily.missingServerEffectHandlers, [], `exact family is supported for ${cardId}`);
  }
  for (const abilityId of ["cfa-1739:1", "cfa-1864:2", "cfa-220:1", "cfa-38:1", "cfa-686:1"]) {
    const perClan = result.items.find(item => item.abilityId === abilityId);
    assert.ok(perClan, `expected the exact per-clan CONT ${abilityId}`);
    assert.deepEqual(perClan.missingEffectHandlers, [], `continuous evaluator handles ${abilityId}`);
    assert.deepEqual(perClan.missingServerEffectHandlers, [], `trusted server handles ${abilityId}`);
  }
});
