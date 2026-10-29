"use strict";

const fs = require("node:fs");
const path = require("node:path");

const RESERVED_ABILITIES = new Set([
  "cfa-10780:0", "cfa-11102:0", "cfa-11104:0", "cfa-11106:0", "cfa-11108:0",
  "cfa-11110:0", "cfa-11112:0", "cfa-11114:0", "cfa-11116:0", "cfa-11118:0",
  "cfa-11120:0", "cfa-11122:0", "cfa-11124:0", "cfa-11126:0", "cfa-11128:0",
  "cfa-11130:0", "cfa-11132:0", "cfa-11134:0", "cfa-11136:0", "cfa-11138:0",
  "cfa-11140:0", "cfa-11142:0", "cfa-11144:0", "cfa-11146:0", "cfa-12576:0",
  "cfa-12581:0", "cfa-12592:0", "cfa-3766:0", "cfa-6666:0", "cfa-7484:0"
]);

function atomicWrite(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents, { flag: "wx" });
  fs.renameSync(temporary, file);
}

function buildRegistry(queue, { baselineCommit, cardsPerBatch = 25 } = {}) {
  if (!queue || !Array.isArray(queue.items) || !baselineCommit || !/^[0-9a-f]{40}$/i.test(baselineCommit)) throw new TypeError("A work queue and full baseline commit SHA are required.");
  if (!Number.isInteger(cardsPerBatch) || cardsPerBatch < 1 || cardsPerBatch > 100) throw new RangeError("cardsPerBatch must be between 1 and 100.");

  const byCard = new Map(), seen = new Set();
  for (const item of queue.items) {
    if (!item || typeof item.abilityId !== "string" || !item.abilityId || seen.has(item.abilityId)) throw new Error(`Invalid or duplicate ability ID: ${item?.abilityId || "<missing>"}`);
    seen.add(item.abilityId);
    const cardId = String(item.cardId || "");
    if (!cardId) throw new Error(`Ability ${item.abilityId} has no card ID.`);
    if (!byCard.has(cardId)) byCard.set(cardId, []);
    byCard.get(cardId).push(item);
  }

  const reservedCards = new Set([...RESERVED_ABILITIES].map(id => queue.items.find(item => item.abilityId === id)?.cardId).filter(Boolean).map(String));
  const reservedRows = queue.items.filter(item => reservedCards.has(String(item.cardId)));
  const normalCards = [...byCard.keys()].filter(cardId => !reservedCards.has(cardId)).sort((a, b) => a.localeCompare(b));
  const batches = [];
  if (reservedCards.size) batches.push({
    batchId: "PRIMARY-GZONE-STRIDE",
    status: "reserved",
    workerOwner: "primary-session",
    reason: "Current primary-session G-zone ACT/Stride implementation scope; includes every outstanding ability on each affected card.",
    cardIds: [...reservedCards].sort((a, b) => a.localeCompare(b)),
    abilityIds: reservedRows.map(item => item.abilityId).sort(),
    dependencies: [...new Set(reservedRows.flatMap(item => (item.dependencies || []).map(dep => dep.id)))].sort()
  });
  for (let index = 0; index < normalCards.length; index += cardsPerBatch) {
    const cardIds = normalCards.slice(index, index + cardsPerBatch);
    const rows = cardIds.flatMap(cardId => byCard.get(cardId));
    batches.push({
      batchId: `ABILITY-${String(Math.floor(index / cardsPerBatch) + 1).padStart(4, "0")}`,
      status: "available",
      workerOwner: null,
      cardIds,
      abilityIds: rows.map(item => item.abilityId).sort(),
      dependencies: [...new Set(rows.flatMap(item => (item.dependencies || []).map(dep => dep.id)))].sort()
    });
  }

  const batchForCard = new Map(batches.flatMap(batch => batch.cardIds.map(cardId => [cardId, batch.batchId])));
  const records = queue.items.map(item => {
    const verification = item.evidence || null;
    const implementationStatus = item.workFlags?.includes("failing-validation") ? "validation-failed"
      : item.workFlags?.includes("unsupported-or-unreviewed") ? "unreviewed"
      : verification?.status === "fully-verified" ? "fully-verified"
      : verification?.status === "tests-passing" ? "tests-passing"
      : item.effects?.length ? "compiled-unverified" : "unreviewed";
    const reserved = batchForCard.get(String(item.cardId)) === "PRIMARY-GZONE-STRIDE";
    return {
      abilityId: item.abilityId,
      cardId: String(item.cardId),
      kind: item.kind,
      printedText: item.printedText,
      mechanicGroup: item.mechanicGroup,
      implementationStatus,
      assignmentStatus: reserved ? "reserved" : "available",
      workerOwner: reserved ? "primary-session" : null,
      batchId: batchForCard.get(String(item.cardId)),
      dependencies: [...new Set((item.dependencies || []).map(dep => dep.id))].sort(),
      verification: {
        evidenceStatus: verification?.status || "none",
        testFiles: verification?.testFiles || [],
        testCaseCount: (verification?.testCases || []).length,
        suiteFresh: queue.validationEvidenceFresh === true,
        validationErrors: item.validationErrors || [],
        missingRequirements: item.missingRequirements || []
      }
    };
  });

  return {
    registry: {
      schemaVersion: 1,
      baselineCommit,
      generatedAt: new Date().toISOString(),
      sourceQueue: "current catalog + trusted ability definitions + verification manifest",
      concurrencyProtocol: "GitHub atomic branch creation at refs/heads/claims/<batchId>; the first successful non-forced create owns the batch.",
      counts: {
        queuedAbilities: records.length,
        uniqueAbilityIds: seen.size,
        reservedAbilities: reservedRows.length,
        availableAbilities: records.length - reservedRows.length,
        reservedCards: reservedCards.size,
        availableBatches: batches.filter(batch => batch.status === "available").length,
        validationEvidenceFresh: queue.validationEvidenceFresh === true
      },
      abilitiesFile: "ability-work-registry.jsonl",
      batchesFile: "ability-work-batches.json"
    },
    records,
    batches
  };
}

function writeRegistry(root, { baselineCommit, cardsPerBatch = 25, queuePath } = {}) {
  const queueFile = queuePath || path.join(root, ".card-pipeline", "ability-work-queue.json");
  const built = buildRegistry(JSON.parse(fs.readFileSync(queueFile, "utf8")), { baselineCommit, cardsPerBatch });
  const manifest = { ...built.registry, generatedAt: new Date().toISOString() };
  atomicWrite(path.join(root, "ability-work-registry.jsonl"), built.records.map(record => JSON.stringify(record)).join("\n") + "\n");
  atomicWrite(path.join(root, "ability-work-batches.json"), JSON.stringify({ ...manifest, batches: built.batches }, null, 2) + "\n");
  atomicWrite(path.join(root, "ability-work-registry-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
  const root = path.resolve(option("--root") || path.join(__dirname, ".."));
  const baselineCommit = option("--baseline") || require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const cardsPerBatch = Number(option("--cards-per-batch") || 25);
  process.stdout.write(JSON.stringify(writeRegistry(root, { baselineCommit, cardsPerBatch, queuePath: option("--queue") || undefined }), null, 2) + "\n");
}

module.exports = { RESERVED_ABILITIES, buildRegistry, writeRegistry };
