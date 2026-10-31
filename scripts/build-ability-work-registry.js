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

function buildRegistry(queue, { baselineCommit, cardsPerBatch = 25, assignments = [] } = {}) {
  if (!queue || !Array.isArray(queue.items) || !baselineCommit || !/^[0-9a-f]{40}$/i.test(baselineCommit)) throw new TypeError("A work queue and full baseline commit SHA are required.");
  if (!Number.isInteger(cardsPerBatch) || cardsPerBatch < 1 || cardsPerBatch > 100) throw new RangeError("cardsPerBatch must be between 1 and 100.");
  if (!Array.isArray(assignments)) throw new TypeError("Assignments must be an array.");

  const byCard = new Map(), seen = new Set();
  for (const item of queue.items) {
    if (!item || typeof item.abilityId !== "string" || !item.abilityId || seen.has(item.abilityId)) throw new Error(`Invalid or duplicate ability ID: ${item?.abilityId || "<missing>"}`);
    seen.add(item.abilityId);
    const cardId = String(item.cardId || "");
    if (!cardId) throw new Error(`Ability ${item.abilityId} has no card ID.`);
    if (!byCard.has(cardId)) byCard.set(cardId, []);
    byCard.get(cardId).push(item);
  }

  const queueByAbility = new Map(queue.items.map(item => [item.abilityId, item]));
  const assignedAbilityIds = new Set(), assignedCards = new Map(), assignmentBatches = [];
  for (const assignment of assignments) {
    if (!assignment || !/^[A-Z0-9][A-Z0-9-]{1,80}$/.test(String(assignment.batchId || "")) ||
        !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(String(assignment.workerOwner || "")) ||
        !["reserved", "in-progress"].includes(assignment.status) || !Array.isArray(assignment.abilityIds) || !assignment.abilityIds.length) {
      throw new Error("Each active assignment needs a valid batch ID, status, worker owner, and ability ID list.");
    }
    const focusAbilityIds = [...new Set(assignment.abilityIds.map(String))];
    if (focusAbilityIds.length !== assignment.abilityIds.length) throw new Error(`Assignment ${assignment.batchId} contains duplicate ability IDs.`);
    const cardIds = [...new Set(focusAbilityIds.map(id => {
      const item = queueByAbility.get(id);
      if (!item) throw new Error(`Assignment ${assignment.batchId} references unknown ability ${id}.`);
      if (assignedAbilityIds.has(id)) throw new Error(`Ability ${id} is assigned more than once.`);
      assignedAbilityIds.add(id);
      return String(item.cardId);
    }))].sort((a, b) => a.localeCompare(b));
    for (const cardId of cardIds) {
      if (RESERVED_ABILITIES.has(queue.items.find(item => String(item.cardId) === cardId)?.abilityId)) throw new Error(`Assignment ${assignment.batchId} overlaps the primary reserved card ${cardId}.`);
      if (assignedCards.has(cardId)) throw new Error(`Card ${cardId} is assigned to multiple active batches.`);
      assignedCards.set(cardId, assignment);
    }
    const rows = queue.items.filter(item => cardIds.includes(String(item.cardId)));
    assignmentBatches.push({
      batchId: assignment.batchId,
      status: assignment.status,
      workerOwner: assignment.workerOwner,
      reason: String(assignment.reason || "Active primary-session assignment."),
      cardIds,
      abilityIds: rows.map(item => item.abilityId).sort(),
      focusAbilityIds: focusAbilityIds.sort(),
      dependencies: [...new Set(rows.flatMap(item => (item.dependencies || []).map(dep => dep.id)))].sort()
    });
  }

  const reservedCards = new Set([...RESERVED_ABILITIES].map(id => queueByAbility.get(id)?.cardId).filter(Boolean).map(String));
  for (const cardId of assignedCards.keys()) reservedCards.add(cardId);
  const reservedRows = queue.items.filter(item => reservedCards.has(String(item.cardId)));
  const normalCards = [...byCard.keys()].filter(cardId => !reservedCards.has(cardId)).sort((a, b) => a.localeCompare(b));
  const batches = [...assignmentBatches];
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
    const assignment = assignedCards.get(String(item.cardId));
    const primaryReserved = reservedCards.has(String(item.cardId)) && !assignment;
    const reserved = Boolean(assignment || primaryReserved);
    return {
      abilityId: item.abilityId,
      cardId: String(item.cardId),
      kind: item.kind,
      printedText: item.printedText,
      mechanicGroup: item.mechanicGroup,
      implementationStatus,
      assignmentStatus: assignment?.status || (primaryReserved ? "reserved" : "available"),
      workerOwner: assignment?.workerOwner || (primaryReserved ? "primary-session" : null),
      batchId: assignment?.batchId || batchForCard.get(String(item.cardId)),
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
        activeAssignments: assignmentBatches.length,
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
  const assignmentsPath = path.join(root, "ability-work-assignments.json");
  const assignments = fs.existsSync(assignmentsPath) ? JSON.parse(fs.readFileSync(assignmentsPath, "utf8")).assignments : [];
  const built = buildRegistry(JSON.parse(fs.readFileSync(queueFile, "utf8")), { baselineCommit, cardsPerBatch, assignments });
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
