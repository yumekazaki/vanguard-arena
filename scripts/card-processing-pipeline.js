"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { createHash } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { loadCatalog } = require("./audit-ability-catalog.js");

const root = path.resolve(__dirname, "..");
const stageRoot = path.join(root, ".card-pipeline", "staging");
const args = process.argv.slice(2);
function option(name, fallback) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; }
function atomicJson(file, data) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
  fs.renameSync(temporary, file);
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function sourceValidationDigest(directory) {
  const files = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && [".git", ".card-pipeline", "node_modules"].includes(entry.name)) continue;
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:js|cjs|mjs|ts|html|sql)$/i.test(entry.name)) files.push(file);
    }
  };
  walk(directory);
  const hash = createHash("sha256");
  for (const file of files.sort()) hash.update(path.relative(directory, file)).update("\0").update(fs.readFileSync(file)).update("\0");
  return hash.digest("hex");
}
function validateShard(result, shard, expectedCards) {
  return result?.ok === true && result.shardId === shard.id && result.recordCount === result.counters?.abilityBlocks && result.cardIds?.length === expectedCards && new Set(result.cardIds).size === expectedCards;
}

async function run() {
  const workersOption = option("--workers", "auto");
  const workersRequested = workersOption === "auto" ? "auto" : Number(workersOption);
  const workerTarget = workersOption === "auto" ? (os.availableParallelism?.() || os.cpus().length) : workersRequested;
  const batchSize = Number(option("--batch-size", "250"));
  const runId = option("--run-id", `catalog-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(runId)) throw new Error("Invalid run ID.");
  const maxWorkers = Math.max(1, Math.min(8, os.availableParallelism?.() || os.cpus().length, Number.isInteger(workerTarget) ? workerTarget : 2));
  if (!Number.isInteger(batchSize) || batchSize < 25 || batchSize > 2000) throw new Error("Batch size must be from 25 to 2000 cards.");
  const catalog = loadCatalog(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "card-verification-manifest.json"), "utf8"));
  const catalogDigest = sha(JSON.stringify(catalog));
  const evidenceDigest = sha(JSON.stringify(manifest.records));
  const validationInputDigest = sourceValidationDigest(root);
  const fullSuite = manifest.latestFullSuite || {};
  const validationEvidenceFresh = fullSuite.status === "passed" && fullSuite.passed === fullSuite.tests && fullSuite.validationInputDigest === validationInputDigest;
  const engineDigest = sha(["ability-engine.js", "ability-definitions.js", "scripts/card-pipeline-worker.js", "scripts/card-processing-pipeline.js"].map(file => fs.readFileSync(path.join(root, file))).join("\0"));
  const directory = path.join(stageRoot, runId);
  fs.mkdirSync(directory, { recursive: true });
  const manifestFile = path.join(directory, "manifest.json");
  let progress = null;
  if (fs.existsSync(manifestFile)) {
    progress = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    if (progress.catalogDigest !== catalogDigest || progress.evidenceDigest !== evidenceDigest || progress.engineDigest !== engineDigest || progress.validationInputDigest !== validationInputDigest || progress.batchSize !== batchSize) throw new Error("Resume refused: catalog, evidence, tested source, engine, or batch size changed. Use a new --run-id.");
  } else {
    progress = { schemaVersion: 1, runId, catalogDigest, evidenceDigest, engineDigest, validationInputDigest, batchSize, totalCards: catalog.length, createdAt: new Date().toISOString(), completedShards: {}, status: "running" };
  }
  const evidence = validationEvidenceFresh ? manifest.records.filter(record => record.status === "tests-passing" || record.status === "fully-verified").map(record => ({ abilityId: record.abilityId, status: record.status, fullyVerified: record.fullyVerified, testFiles: record.testFiles })) : [];
  const shards = [];
  for (let start = 0, index = 0; start < catalog.length; start += batchSize, index++) shards.push({ id: `shard-${String(index).padStart(5, "0")}`, cards: catalog.slice(start, start + batchSize) });
  const pending = [];
  for (const shard of shards) {
    const completed = progress.completedShards[shard.id];
    const file = path.join(directory, `${shard.id}.json`);
    if (fs.existsSync(file)) {
      try {
        const staged = JSON.parse(fs.readFileSync(file, "utf8"));
        const sourceMatches = staged.shardId === shard.id && staged.cardIds.length === shard.cards.length && staged.cardIds.every((id, i) => id === String(shard.cards[i].id || ""));
        const integrityMatches = !completed || completed.sha256 === sha(JSON.stringify(staged));
        if (sourceMatches && integrityMatches && staged.records?.length === staged.counters?.abilityBlocks) {
          progress.completedShards[shard.id] ||= { recordCount: staged.records.length, cardCount: staged.cardIds.length, counters: staged.counters, sha256: sha(JSON.stringify(staged)), recoveredAt: new Date().toISOString() };
          continue;
        }
      } catch { /* invalid/incomplete stage is safely recomputed */ }
      fs.rmSync(file, { force: true });
    }
    pending.push(shard);
  }
  atomicJson(manifestFile, progress);
  const started = performance.now();
  let next = 0, finished = 0;
  const workers = Array.from({ length: Math.min(maxWorkers, Math.max(1, pending.length)) }, () => new Worker(path.join(__dirname, "card-pipeline-worker.js")));
  await Promise.all(workers.map(worker => new Promise((resolve, reject) => {
    let activeShard = null;
    const sendNext = () => {
      if (next >= pending.length) { worker.postMessage({ shardId: "__stop__" }); resolve(); return; }
      activeShard = pending[next++];
      worker.postMessage({ shardId: activeShard.id, cards: activeShard.cards, stageDirectory: directory, evidence });
    };
    worker.on("message", message => {
      if (!activeShard || message.shardId !== activeShard.id) { worker.terminate(); reject(new Error("Worker returned an unexpected shard identity.")); return; }
      if (!message.ok) { worker.terminate(); reject(new Error(`Worker ${message.shardId} failed: ${message.error}`)); return; }
      if (!validateShard(message, activeShard, activeShard.cards.length)) { worker.terminate(); reject(new Error(`Shard ${message.shardId} failed its schema or identity validation.`)); return; }
      const staged = JSON.parse(fs.readFileSync(path.join(directory, `${activeShard.id}.json`), "utf8"));
      if (!staged.records.every(record => record.cardId === String(activeShard.cards.find(card => String(card.id || "") === record.cardId)?.id || ""))) { worker.terminate(); reject(new Error(`Shard ${message.shardId} contains a foreign card identity.`)); return; }
      progress.completedShards[message.shardId] = { recordCount: message.recordCount, cardCount: message.cardIds.length, counters: message.counters, sha256: sha(JSON.stringify(staged)), completedAt: new Date().toISOString() };
      finished++;
      atomicJson(manifestFile, progress);
      sendNext();
    });
    worker.on("error", reject);
    worker.on("exit", code => { if (code !== 0 && finished < pending.length) reject(new Error(`Pipeline worker exited with code ${code}.`)); });
    sendNext();
  })));
  const aggregate = { cards: 0, parsed: 0, cardsWithAbilities: 0, cardsWithPassingEvidence: 0, implementedCards: 0, fullyVerifiedCards: 0, unsupportedCards: 0, failedCards: 0, awaitingReviewCards: 0, abilityBlocks: 0, implementedAbilities: 0, validatedAbilities: 0, fullyVerifiedAbilities: 0, unsupportedAbilities: 0, failedAbilities: 0, invalidDefinitions: 0 };
  for (const shard of shards) {
    const staged = JSON.parse(fs.readFileSync(path.join(directory, `${shard.id}.json`), "utf8"));
    for (const [key, value] of Object.entries(staged.counters)) aggregate[key] += value;
  }
  progress.status = "complete";
  progress.completedAt = new Date().toISOString();
  const elapsedMilliseconds = Number((performance.now() - started).toFixed(1));
  // Staging only parses and classifies existing evidence. It does not verify cards.
  // Keep pre-existing fully verified cards separate from newly verified throughput.
  progress.metrics = { ...aggregate, existingFullyVerifiedCards: aggregate.fullyVerifiedCards, newlyVerifiedCards: 0, validationEvidenceFresh, workersRequested, workersUsed: maxWorkers, batchSize, elapsedMilliseconds, parsedCardsPerMinute: Number((aggregate.parsed * 60000 / elapsedMilliseconds).toFixed(1)), verifiedCardsPerMinute: 0, stagedShards: shards.length };
  atomicJson(manifestFile, progress);
  process.stdout.write(JSON.stringify({ runId, stageDirectory: path.relative(root, directory), metrics: progress.metrics, resumedShards: shards.length - pending.length }, null, 2) + "\n");
}

run().catch(error => { console.error(`Card pipeline failed: ${error.message}`); process.exitCode = 1; });
