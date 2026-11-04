"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const { buildRegistry } = require("./build-ability-work-registry.js");
const { claimBatch } = require("./claim-ability-batch.js");

const BASELINE = "0123456789abcdef0123456789abcdef01234567";

test("registry assigns every ability once, preserves dependencies/evidence, and reserves whole primary cards", () => {
  const queue = {
    validationEvidenceFresh: true,
    items: [
      { abilityId: "cfa-11110:0", cardId: "cfa-11110", kind: "ACT", printedText: "ACT [G zone] Stride this card on your VC from face down.", effects: [], dependencies: [{ id: "stride-handler" }], workFlags: ["unsupported-or-unreviewed"] },
      { abilityId: "cfa-11110:1", cardId: "cfa-11110", kind: "CONT", printedText: "CONT [VC] Example.", effects: [{ op: "continuous-power" }], dependencies: [{ id: "continuous-test" }], workFlags: ["card-level-verification-incomplete"], evidence: { status: "tests-passing", testFiles: ["x.test.js"], testCases: ["case"] } },
      { abilityId: "cfa-2000:0", cardId: "cfa-2000", kind: "AUTO", printedText: "AUTO [RC] Example.", effects: [{ op: "draw" }], dependencies: [], workFlags: ["missing-regression-evidence"] }
    ]
  };
  const result = buildRegistry(queue, { baselineCommit: BASELINE, cardsPerBatch: 1 });
  assert.equal(result.registry.counts.queuedAbilities, 3);
  assert.equal(result.registry.counts.uniqueAbilityIds, 3);
  assert.equal(result.registry.counts.reservedAbilities, 2);
  assert.equal(new Set(result.records.map(record => record.abilityId)).size, 3);
  assert.ok(result.records.filter(record => record.cardId === "cfa-11110").every(record => record.assignmentStatus === "reserved" && record.workerOwner === "primary-session"));
  assert.equal(result.records.find(record => record.abilityId === "cfa-2000:0").batchId, `ABILITY-${BASELINE.slice(0, 8).toUpperCase()}-0001`);
  assert.notEqual(result.records.find(record => record.abilityId === "cfa-2000:0").batchId, "ABILITY-0001", "new registry generations do not collide with legacy claim refs");
  assert.deepEqual(result.records.find(record => record.abilityId === "cfa-11110:1").dependencies, ["continuous-test"]);
  assert.equal(result.records.find(record => record.abilityId === "cfa-11110:1").verification.evidenceStatus, "tests-passing");
  const batchMembership = new Map();
  for (const batch of result.batches) for (const abilityId of batch.abilityIds) {
    batchMembership.set(abilityId, (batchMembership.get(abilityId) || 0) + 1);
  }
  assert.deepEqual([...batchMembership.keys()].sort(), queue.items.map(item => item.abilityId).sort(), "every queued ability belongs to a batch");
  assert.ok([...batchMembership.values()].every(count => count === 1), "batch ownership never overlaps");
  const primaryBatch = result.batches.find(batch => batch.batchId === "PRIMARY-GZONE-STRIDE");
  assert.deepEqual(primaryBatch.abilityIds, ["cfa-11110:0", "cfa-11110:1"]);
  assert.equal(primaryBatch.abilityIds.includes("cfa-2000:0"), false, "worker assignment is not duplicated into primary G-Zone scope");
  assert.throws(() => buildRegistry({ ...queue, items: [...queue.items, queue.items[0]] }, { baselineCommit: BASELINE }), /duplicate ability ID/);
});

test("active worker assignments reserve every ability on each assigned card and reject overlaps", () => {
  const queue = {
    validationEvidenceFresh: false,
    items: [
      { abilityId: "cfa-2000:0", cardId: "cfa-2000", kind: "CONT", printedText: "CONT example", effects: [{ op: "continuous-power" }], dependencies: [{ id: "continuous-power" }], workFlags: ["card-level-verification-incomplete"] },
      { abilityId: "cfa-2000:1", cardId: "cfa-2000", kind: "AUTO", printedText: "AUTO example", effects: [], dependencies: [{ id: "attack-event" }], workFlags: ["unsupported-or-unreviewed"] },
      { abilityId: "cfa-2001:0", cardId: "cfa-2001", kind: "ACT", printedText: "ACT example", effects: [], dependencies: [], workFlags: ["unsupported-or-unreviewed"] }
    ]
  };
  const assignments = [{
    batchId: "PRIMARY-ACTIVE-ATTACK",
    status: "in-progress",
    workerOwner: "primary-session/third_exact_family",
    reason: "Exact attack AUTO implementation and focused tests are in progress.",
    abilityIds: ["cfa-2000:1"]
  }];
  const result = buildRegistry(queue, { baselineCommit: BASELINE, cardsPerBatch: 1, assignments });
  assert.equal(result.registry.counts.activeAssignments, 1);
  assert.equal(result.registry.counts.reservedAbilities, 2);
  assert.ok(result.records.filter(record => record.cardId === "cfa-2000").every(record =>
    record.assignmentStatus === "in-progress" && record.workerOwner === "primary-session/third_exact_family" && record.batchId === "PRIMARY-ACTIVE-ATTACK"));
  assert.ok(!result.batches.find(batch => batch.status === "available")?.cardIds.includes("cfa-2000"));
  assert.throws(() => buildRegistry(queue, { baselineCommit: BASELINE, assignments: [
    ...assignments,
    { ...assignments[0], batchId: "PRIMARY-SECOND", workerOwner: "another-worker" }
  ] }), /assigned more than once|assigned to multiple active batches/);
  assert.throws(() => buildRegistry(queue, { baselineCommit: BASELINE, assignments: [
    { ...assignments[0], abilityIds: ["cfa-9999:0"] }
  ] }), /unknown ability/);
});

test("candidate mechanic families group intact cards for triage without treating similarity as verified equivalence", () => {
  const queue = { validationEvidenceFresh: false, items: [
    ...["cfa-3000", "cfa-3001", "cfa-3002"].flatMap((cardId, index) => [
      { abilityId: `${cardId}:0`, cardId, kind: "AUTO", printedText: `AUTO candidate ${index}`, effects: [], dependencies: [], workFlags: ["unsupported-or-unreviewed"], mechanicGroup: "candidate-call-from-drop", mechanicGroupType: "unreviewed-similarity-candidate" },
      ...(index === 0 ? [{ abilityId: `${cardId}:1`, cardId, kind: "CONT", printedText: "Different ability on same card", effects: [], dependencies: [], workFlags: ["unsupported-or-unreviewed"], mechanicGroup: "other-candidate", mechanicGroupType: "unreviewed-similarity-candidate" }] : [])
    ]),
    { abilityId: "cfa-3999:0", cardId: "cfa-3999", kind: "ACT", printedText: "Unrelated", effects: [], dependencies: [], workFlags: ["unsupported-or-unreviewed"] }
  ] };
  const result = buildRegistry(queue, { baselineCommit: BASELINE, cardsPerBatch: 2, minMechanicGroupCards: 3 });
  const familyBatches = result.batches.filter(batch => batch.candidateMechanicGroup === "candidate-call-from-drop");
  assert.equal(familyBatches.length, 2);
  assert.equal(familyBatches.reduce((count, batch) => count + batch.focusedAbilityIds.length, 0), 3);
  assert.ok(familyBatches.every(batch => batch.groupingNote.includes("does not establish rule equivalence")));
  assert.ok(familyBatches.flatMap(batch => batch.abilityIds).includes("cfa-3000:1"), "all abilities on a family-assigned card stay in the same batch");
  assert.equal(result.records.find(record => record.abilityId === "cfa-3000:1").batchId, result.records.find(record => record.abilityId === "cfa-3000:0").batchId);
  assert.equal(result.records.find(record => record.abilityId === "cfa-3999:0").batchId, `ABILITY-${BASELINE.slice(0, 8).toUpperCase()}-0001`);
  const assignedCards = result.batches.flatMap(batch => batch.cardIds);
  assert.equal(new Set(assignedCards).size, assignedCards.length, "a card must not be placed into more than one work batch");
});

test("generated candidate and normal batch IDs skip IDs already reserved by atomic claims", () => {
  const queue = { validationEvidenceFresh: false, items: [
    ...["cfa-3000", "cfa-3001", "cfa-3002"].map(cardId => ({
      abilityId: `${cardId}:0`, cardId, kind: "AUTO", printedText: "AUTO candidate", effects: [], dependencies: [],
      workFlags: ["unsupported-or-unreviewed"], mechanicGroup: "candidate-call-from-drop", mechanicGroupType: "unreviewed-similarity-candidate"
    }))
  ] };
  const claimed = buildRegistry(queue, {
    baselineCommit: BASELINE, cardsPerBatch: 1, minMechanicGroupCards: 2,
    assignments: [{ batchId: "CANDIDATE-01234567-0001", status: "in-progress", workerOwner: "worker-a", abilityIds: ["cfa-3000:0"] }]
  });
  assert.equal(claimed.batches.filter(batch => batch.batchId === "CANDIDATE-01234567-0001").length, 1);
  assert.ok(claimed.batches.some(batch => batch.batchId === "CANDIDATE-01234567-0002" && batch.status === "available"));

  const normal = buildRegistry({ validationEvidenceFresh: false, items: [
    { abilityId: "cfa-4000:0", cardId: "cfa-4000", kind: "AUTO", printedText: "AUTO", effects: [], dependencies: [], workFlags: ["unsupported-or-unreviewed"] },
    { abilityId: "cfa-4001:0", cardId: "cfa-4001", kind: "AUTO", printedText: "AUTO", effects: [], dependencies: [], workFlags: ["unsupported-or-unreviewed"] }
  ] }, {
    baselineCommit: BASELINE, cardsPerBatch: 1,
    assignments: [{ batchId: "ABILITY-01234567-0001", status: "in-progress", workerOwner: "worker-b", abilityIds: ["cfa-4000:0"] }]
  });
  assert.equal(normal.batches.filter(batch => batch.batchId === "ABILITY-01234567-0001").length, 1);
  assert.ok(normal.batches.some(batch => batch.batchId === "ABILITY-01234567-0002" && batch.status === "available"));
});

test("candidate-family IDs cannot collide with active worker assignments or create ambiguous claims", () => {
  const mechanicGroup = "candidate-auto-test-family";
  const queue = { validationEvidenceFresh: false, items: [
    ...["cfa-5000", "cfa-5001", "cfa-5002", "cfa-5003"].map((cardId, index) => ({
      abilityId: `${cardId}:0`, cardId, kind: "AUTO", printedText: `AUTO candidate ${index}`, effects: [], dependencies: [],
      workFlags: ["unsupported-or-unreviewed"], mechanicGroup, mechanicGroupType: "unreviewed-similarity-candidate"
    })),
    { abilityId: "cfa-6000:0", cardId: "cfa-6000", kind: "ACT", printedText: "ACT active", effects: [], dependencies: [], workFlags: ["unsupported-or-unreviewed"] }
  ] };
  const activeBatchId = `FAMILY-${BASELINE.slice(0, 8).toUpperCase()}-0001`;
  const result = buildRegistry(queue, { baselineCommit: BASELINE, assignments: [{
    batchId: activeBatchId, status: "in-progress", workerOwner: "worker-active", reason: "Active assignment.", abilityIds: ["cfa-6000:0"]
  }] });
  const candidate = result.batches.find(batch => batch.candidateMechanicGroup === mechanicGroup);
  assert.ok(candidate);
  assert.notEqual(candidate.batchId, activeBatchId);
  assert.equal(new Set(result.batches.map(batch => batch.batchId)).size, result.batches.length);
  assert.equal(result.records.find(record => record.abilityId === "cfa-5000:0").batchId, candidate.batchId);
  assert.throws(() => buildRegistry(queue, { baselineCommit: BASELINE, assignments: [
    { batchId: activeBatchId, status: "in-progress", workerOwner: "worker-a", abilityIds: ["cfa-6000:0"] },
    { batchId: activeBatchId, status: "reserved", workerOwner: "worker-b", abilityIds: ["cfa-5000:0"] }
  ] }), /Batch ID .* assigned more than once/);
});

test("claim refuses an ambiguous duplicate batch ID before creating a remote claim", () => {
  const root = fs.mkdtempSync(path.join(path.resolve(__dirname, "..", ".card-pipeline"), "duplicate-claim-test-"));
  try {
    fs.writeFileSync(path.join(root, "ability-work-batches.json"), JSON.stringify({ baselineCommit: BASELINE, batches: [
      { batchId: "BTEST", status: "available", abilityIds: ["cfa-1:0"] },
      { batchId: "BTEST", status: "in-progress", abilityIds: ["cfa-2:0"] }
    ] }));
    assert.throws(() => claimBatch({ root, batchId: "BTEST", workerId: "worker-a" }), /appears 2 times.*cannot be claimed safely/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function git(cwd, args, input, env = process.env) {
  return execFileSync("git", args, { cwd, encoding: "utf8", input, env, stdio: input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"] }).trim();
}
function waitFor(child) {
  return new Promise(resolve => { let stderr = ""; child.stderr.on("data", data => stderr += data); child.on("close", code => resolve({ code, stderr })); });
}

test("Git's compare-and-create ref allows only one concurrent batch claim", { timeout: 30000 }, async () => {
  const staging = path.resolve(__dirname, "..", ".card-pipeline");
  fs.mkdirSync(staging, { recursive: true });
  const temp = fs.mkdtempSync(path.join(staging, "claim-test-"));
  try {
    const remote = path.join(temp, "remote.git");
    git(temp, ["init", "--bare", remote]);
    const env = { ...process.env, GIT_AUTHOR_NAME: "Registry test", GIT_AUTHOR_EMAIL: "registry-test@example.invalid", GIT_COMMITTER_NAME: "Registry test", GIT_COMMITTER_EMAIL: "registry-test@example.invalid" };
    const baselineTree = git(temp, ["--git-dir", remote, "mktree"], "", env);
    const baselineCommit = git(temp, ["--git-dir", remote, "commit-tree", baselineTree, "-m", "baseline"], undefined, env);
    git(temp, ["--git-dir", remote, "update-ref", "refs/heads/main", baselineCommit]);
    const claimCommit = workerId => {
      const blob = git(temp, ["--git-dir", remote, "hash-object", "-w", "--stdin"], JSON.stringify({ workerId, batchId: "BTEST", baselineCommit }), env);
      const tree = git(temp, ["--git-dir", remote, "mktree"], `100644 blob ${blob}\tclaim.json\n`, env);
      return git(temp, ["--git-dir", remote, "commit-tree", tree, "-p", baselineCommit, "-m", `Claim by ${workerId}`], undefined, env);
    };
    const commits = [claimCommit("worker-a"), claimCommit("worker-b")];
    const zero = "0".repeat(40), ref = "refs/heads/claims/BTEST";
    const outcomes = await Promise.all(commits.map(commit => waitFor(spawn("git", ["--git-dir", remote, "update-ref", ref, commit, zero], { windowsHide: true }))));
    assert.equal(outcomes.filter(outcome => outcome.code === 0).length, 1, JSON.stringify(outcomes));
    assert.equal(outcomes.filter(outcome => outcome.code !== 0).length, 1, JSON.stringify(outcomes));
    const winner = git(temp, ["--git-dir", remote, "rev-parse", ref]);
    const claim = JSON.parse(git(temp, ["--git-dir", remote, "show", `${winner}:claim.json`]));
    assert.ok(["worker-a", "worker-b"].includes(claim.workerId));
    assert.equal(claim.baselineCommit, baselineCommit);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
