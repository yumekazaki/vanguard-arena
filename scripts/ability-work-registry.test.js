"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const { buildRegistry } = require("./build-ability-work-registry.js");

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
  assert.equal(result.records.find(record => record.abilityId === "cfa-2000:0").batchId, "ABILITY-0001");
  assert.deepEqual(result.records.find(record => record.abilityId === "cfa-11110:1").dependencies, ["continuous-test"]);
  assert.equal(result.records.find(record => record.abilityId === "cfa-11110:1").verification.evidenceStatus, "tests-passing");
  assert.throws(() => buildRegistry({ ...queue, items: [...queue.items, queue.items[0]] }, { baselineCommit: BASELINE }), /duplicate ability ID/);
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
