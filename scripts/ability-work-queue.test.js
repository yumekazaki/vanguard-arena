"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadCatalog } = require("./audit-ability-catalog.js");
const { buildAbilityWorkQueue, scanContributionAbilityReservations, writeQueueFile } = require("./build-ability-work-queue.js");
const { readQueueFile } = require("./build-ability-work-registry.js");

test("work queue can be atomically stored compressed and read by the registry builder", () => {
  const directory = fs.mkdtempSync(path.join(__dirname, ".ability-queue-test-"));
  const destination = path.join(directory, "ability-work-queue.json.gz");
  const queue = {
    schemaVersion: 1,
    validationEvidenceFresh: true,
    counts: { remainingAbilities: 200 },
    items: Array.from({ length: 200 }, (_, index) => ({ abilityId: `cfa-${index}:0`, printedText: "AUTO: When this unit is placed on RC, choose one of your units, and it gets power +5000 until end of turn." }))
  };
  try {
    writeQueueFile(queue, destination);
    assert.deepEqual(readQueueFile(destination), queue);
    assert.ok(fs.statSync(destination).size < Buffer.byteLength(JSON.stringify(queue)), "gzip output should reduce generated queue storage");
    assert.ok(fs.existsSync(destination));
    assert.equal(fs.readdirSync(directory).filter(name => name.endsWith(".tmp")).length, 0, "atomic writer should leave no temporary file");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("contribution reservation scan reads exact IDs as text without executing worker files", () => {
  const root = fs.mkdtempSync(path.join(__dirname, ".ability-contribution-scan-test-"));
  try {
    const directory = path.join(root, "ability-contributions");
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "batch-TEST-0001.js"), `throw new Error("contribution files must not execute");\nmodule.exports = ["cfa-7000:0", "cfa-7000:1"];\n`);
    fs.writeFileSync(path.join(directory, "notes.txt"), `"cfa-7000:2"`);
    const reservations = scanContributionAbilityReservations(root);
    assert.deepEqual(reservations.get("cfa-7000:0"), ["ability-contributions/batch-TEST-0001.js"]);
    assert.deepEqual(reservations.get("cfa-7000:1"), ["ability-contributions/batch-TEST-0001.js"]);
    assert.equal(reservations.has("cfa-7000:2"), false, "only contribution JavaScript files are scanned");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("central work queue covers unverified abilities and separates reviewed mechanics from similarity candidates", () => {
  const cards = loadCatalog();
  const result = buildAbilityWorkQueue(cards, {
    records: [{ abilityId: "cfa-5289:0", status: "tests-passing", testFiles: ["example.test.js"], testCases: ["example"] }],
    latestFullSuite: { status: "passed", tests: 1, passed: 1, validationInputDigest: "stale" }
  }, path.resolve(__dirname, ".."));

  assert.equal(result.counts.catalogAbilities, 17254);
  assert.equal(result.counts.remainingAbilities, 17254);
  assert.equal(result.counts.fullyVerifiedCards, 0);
  assert.equal(result.counts.fullyVerifiedAbilities, 0);
  assert.equal(result.validationEvidenceFresh, false);
  assert.ok(result.counts.unsupported > 0);
  const reviewed = result.items.find(item => item.abilityId === "cfa-5289:0");
  assert.ok(reviewed);
  assert.equal(reviewed.mechanicGroupType, "reviewed-mechanic");
  const contributed = result.items.find(item => item.abilityId === "cfa-10680:0");
  assert.ok(contributed?.primaryReviewContributionFiles.includes("ability-contributions/batch-ABILITY-320008F1-0025.js"));
  assert.ok(contributed.workFlags.includes("missing-regression-evidence"), "a contribution file alone must not supply passing evidence");
  assert.equal(contributed.evidence, null);
  assert.equal(result.counts.fullyVerifiedAbilities, 0, "contribution files do not count as verified abilities");
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
  assert.deepEqual(result.items.filter(item => item.missingTrustedDefinition).map(item => item.abilityId), [],
    "every compiled AUTO/ACT in this fixture must pass the exact trusted-server definition gate");
  const unconfirmedNamedVanguard = result.items.find(item => item.abilityId === "cfa-10769:0");
  assert.ok(unconfirmedNamedVanguard);
  assert.equal(unconfirmedNamedVanguard.missingTrustedDefinition, false,
    "Ala Dargente has an exact card-number source and an exact server-validated definition");
  for (const abilityId of ["cfa-2637:0", "cfa-3079:0", "cfa-4210:0", "cfa-4216:1", "cfa-4456:0", "cfa-4752:0"]) {
    const dynamicallyTrusted = result.items.find(item => item.abilityId === abilityId);
    assert.ok(dynamicallyTrusted, `expected the catalog-compiled paid Vanguard-attack ability ${abilityId}`);
    assert.equal(dynamicallyTrusted.missingTrustedDefinition, false, `${abilityId} must use the same exact catalog-backed server trust path as live resolution`);
  }
  for (const abilityId of ["cfa-2000:1", "cfa-2173:1", "cfa-2239:2", "cfa-2271:2"]) {
    const dynamicallyTrusted = result.items.find(item => item.abilityId === abilityId);
    assert.ok(dynamicallyTrusted, `expected the catalog-compiled Rear-Guard retirement attack ability ${abilityId}`);
    assert.equal(dynamicallyTrusted.missingTrustedDefinition, false, `${abilityId} must use the same exact catalog-backed server trust path as live resolution`);
  }
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
  for (const abilityId of ["cfa-10476:2", "cfa-10668:2", "cfa-12183:2", "cfa-13177:2", "cfa-13186:2"]) {
    const crestPower = result.items.find(item => item.abilityId === abilityId);
    assert.ok(crestPower, `expected the exact face-up G-zone CONT ${abilityId}`);
    assert.deepEqual(crestPower.missingEffectHandlers, [], `continuous evaluator handles ${abilityId}`);
    assert.deepEqual(crestPower.missingServerEffectHandlers, [], `trusted server handles ${abilityId}`);
  }
});
