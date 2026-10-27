"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname);
const pipeline = path.join(root, "scripts", "card-processing-pipeline.js");

test("bounded card workers stage validated catalog shards and resume only matching inputs", { timeout: 60000 }, () => {
  const runId = `pipeline-test-${process.pid}-${Date.now()}`;
  const stageRoot = path.resolve(root, ".card-pipeline", "staging");
  const stageDirectory = path.resolve(stageRoot, runId);
  assert.equal(path.dirname(stageDirectory), stageRoot);
  try {
    const execute = () => JSON.parse(execFileSync(process.execPath, [pipeline, "--workers", "2", "--batch-size", "2000", "--run-id", runId], { cwd: root, encoding: "utf8" }));
    const first = execute();
    assert.equal(first.metrics.cards, 14022);
    assert.equal(first.metrics.abilityBlocks, 17240);
    assert.equal(first.metrics.invalidDefinitions, 0);
    assert.equal(first.metrics.failedAbilities, 0);
    assert.equal(first.metrics.workersUsed, 2);
    assert.equal(first.metrics.fullyVerifiedCards, 0);
    assert.equal(first.metrics.verifiedCardsPerMinute, 0);
    assert.ok(first.metrics.parsedCardsPerMinute > 0);
    assert.equal(first.resumedShards, 0);
    const second = execute();
    assert.equal(second.metrics.cards, first.metrics.cards);
    assert.equal(second.metrics.compiledAbilities, first.metrics.compiledAbilities);
    assert.equal(second.resumedShards, first.metrics.stagedShards);
  } finally {
    const stagingPrefix = `${stageRoot}${path.sep}`;
    if (!stageDirectory.startsWith(stagingPrefix)) throw new Error("Refusing to clean a pipeline directory outside its staging root.");
    fs.rmSync(stageDirectory, { recursive: true, force: true });
  }
});
