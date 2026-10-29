"use strict";

const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options }).trim();
}

function claimBatch({ root = process.cwd(), batchId, workerId, remote = "origin" } = {}) {
  if (!/^[A-Z0-9][A-Z0-9-]{1,80}$/.test(String(batchId || ""))) throw new Error("Invalid batch ID.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(String(workerId || ""))) throw new Error("Worker ID must use letters, digits, dot, underscore, or hyphen.");
  const registryPath = path.join(root, "ability-work-batches.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const batch = registry.batches?.find(item => item.batchId === batchId);
  if (!batch) throw new Error(`Batch ${batchId} is not in the registry.`);
  if (batch.status !== "available") throw new Error(`Batch ${batchId} is not available (${batch.status}).`);
  if (!registry.baselineCommit || !/^[0-9a-f]{40}$/i.test(registry.baselineCommit)) throw new Error("Registry baseline commit is invalid.");
  git(["cat-file", "-e", `${registry.baselineCommit}^{commit}`], { cwd: root });

  const claim = {
    schemaVersion: 1,
    batchId,
    workerId,
    baselineCommit: registry.baselineCommit,
    abilityIds: batch.abilityIds,
    claimedAt: new Date().toISOString()
  };
  const blob = git(["hash-object", "-w", "--stdin"], { cwd: root, input: `${JSON.stringify(claim, null, 2)}\n` });
  const tree = git(["mktree"], { cwd: root, input: `100644 blob ${blob}\tclaim.json\n` });
  const env = { ...process.env, GIT_AUTHOR_NAME: "Vanguard Ability Worker", GIT_AUTHOR_EMAIL: "noreply@users.noreply.github.com", GIT_COMMITTER_NAME: "Vanguard Ability Worker", GIT_COMMITTER_EMAIL: "noreply@users.noreply.github.com" };
  const commit = git(["commit-tree", tree, "-p", registry.baselineCommit, "-m", `Claim ${batchId} by ${workerId}`], { cwd: root, env });
  const ref = `refs/heads/claims/${batchId}`;
  const pushed = spawnSync("git", ["push", remote, `${commit}:${ref}`], { cwd: root, encoding: "utf8", windowsHide: true });
  if (pushed.status !== 0) {
    const detail = `${pushed.stderr || ""}${pushed.stdout || ""}`.trim();
    throw new Error(detail.includes(batchId) ? `Batch ${batchId} was claimed concurrently or already exists. Inspect origin/${ref.replace("refs/heads/", "")}.` : `Atomic claim push failed: ${detail || "unknown Git error"}`);
  }
  return { batchId, workerId, claimRef: ref, claimCommit: commit, baselineCommit: registry.baselineCommit };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
  try { process.stdout.write(`${JSON.stringify(claimBatch({ root: path.resolve(option("--root") || process.cwd()), batchId: option("--batch"), workerId: option("--worker"), remote: option("--remote") || "origin" }), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { claimBatch };
