"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

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

function readQueueFile(queueFile) {
  const contents = fs.readFileSync(queueFile);
  const text = queueFile.toLowerCase().endsWith(".gz") ? zlib.gunzipSync(contents).toString("utf8") : contents.toString("utf8");
  return JSON.parse(text);
}

function abilityBatchIdentity(batch) {
  if (!batch || !Array.isArray(batch.abilityIds) || !batch.abilityIds.length) return null;
  return JSON.stringify([
    String(batch.candidateMechanicGroup || ""),
    [...new Set(batch.abilityIds.map(String))].sort()
  ]);
}

function buildRegistry(queue, { baselineCommit, cardsPerBatch = 25, minMechanicGroupCards = 4, assignments = [], previousBatches = [], completedAbilityIds = [] } = {}) {
  if (!queue || !Array.isArray(queue.items) || !baselineCommit || !/^[0-9a-f]{40}$/i.test(baselineCommit)) throw new TypeError("A work queue and full baseline commit SHA are required.");
  if (!Number.isInteger(cardsPerBatch) || cardsPerBatch < 1 || cardsPerBatch > 100) throw new RangeError("cardsPerBatch must be between 1 and 100.");
  if (!Number.isInteger(minMechanicGroupCards) || minMechanicGroupCards < 2 || minMechanicGroupCards > 100) throw new RangeError("minMechanicGroupCards must be between 2 and 100.");
  if (!Array.isArray(assignments)) throw new TypeError("Assignments must be an array.");
  if (!Array.isArray(previousBatches)) throw new TypeError("Previous batches must be an array.");
  const completed = new Set(completedAbilityIds instanceof Set ? [...completedAbilityIds].map(String) : Array.isArray(completedAbilityIds) ? completedAbilityIds.map(String) : []);
  if (!(completedAbilityIds instanceof Set) && !Array.isArray(completedAbilityIds)) throw new TypeError("Completed ability IDs must be an array or Set.");

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
  const assignedAbilityIds = new Set(), assignedCards = new Map(), assignedBatchIds = new Set(), assignmentBatches = [];
  for (const assignment of assignments) {
    if (!assignment || !/^[A-Z0-9][A-Z0-9-]{1,80}$/.test(String(assignment.batchId || "")) ||
        !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(String(assignment.workerOwner || "")) ||
        !["reserved", "in-progress"].includes(assignment.status) || !Array.isArray(assignment.abilityIds) || !assignment.abilityIds.length) {
      throw new Error("Each active assignment needs a valid batch ID, status, worker owner, and ability ID list.");
    }
    if (assignedBatchIds.has(assignment.batchId)) throw new Error(`Batch ID ${assignment.batchId} is assigned more than once.`);
    assignedBatchIds.add(assignment.batchId);
    const originalAbilityIds = [...new Set(assignment.abilityIds.map(String))];
    if (originalAbilityIds.length !== assignment.abilityIds.length) throw new Error(`Assignment ${assignment.batchId} contains duplicate ability IDs.`);
    const focusAbilityIds = originalAbilityIds.filter(id => {
      if (queueByAbility.has(id)) return true;
      if (completed.has(id)) return false;
      throw new Error(`Assignment ${assignment.batchId} references unknown ability ${id}.`);
    });
    if (!focusAbilityIds.length) continue;
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

  const primaryReservedCards = new Set([...RESERVED_ABILITIES].map(id => queueByAbility.get(id)?.cardId).filter(Boolean).map(String));
  const reservedCards = new Set(primaryReservedCards);
  for (const cardId of assignedCards.keys()) reservedCards.add(cardId);
  const primaryReservedRows = queue.items.filter(item => primaryReservedCards.has(String(item.cardId)));
  const contributionFilesByAbility = new Map();
  for (const item of queue.items) {
    if (!Array.isArray(item.primaryReviewContributionFiles) || !item.primaryReviewContributionFiles.length) continue;
    const cardId = String(item.cardId);
    if (reservedCards.has(cardId) || assignedCards.has(cardId) || completed.has(item.abilityId)) continue;
    contributionFilesByAbility.set(item.abilityId, [...new Set(item.primaryReviewContributionFiles.map(String))].sort());
  }
  const contributionReservedIds = new Set(contributionFilesByAbility.keys());
  const contributionReservedRows = queue.items.filter(item => contributionReservedIds.has(item.abilityId));
  const allReservedRows = queue.items.filter(item => reservedCards.has(String(item.cardId)) || contributionReservedIds.has(item.abilityId));
  const batches = [...assignmentBatches];
  if (primaryReservedCards.size) batches.push({
    batchId: "PRIMARY-GZONE-STRIDE",
    status: "reserved",
    workerOwner: "primary-session",
    reason: "Current primary-session G-zone ACT/Stride implementation scope; includes every outstanding ability on each affected card.",
    cardIds: [...primaryReservedCards].sort((a, b) => a.localeCompare(b)),
    abilityIds: primaryReservedRows.map(item => item.abilityId).sort(),
    dependencies: [...new Set(primaryReservedRows.flatMap(item => (item.dependencies || []).map(dep => dep.id)))].sort()
  });
  if (contributionReservedRows.length) {
    let batchId = "PRIMARY-CONTRIBUTION-REVIEW";
    let suffix = 1;
    while (assignedBatchIds.has(batchId)) batchId = `PRIMARY-CONTRIBUTION-REVIEW-${String(suffix++).padStart(3, "0")}`;
    batches.push({
      batchId,
      status: "reserved",
      workerOwner: "primary-session",
      reason: "Exact ability IDs already present in unintegrated contribution files; reserved for primary review. Contribution presence does not imply compilation, passing tests, or verification.",
      cardIds: [...new Set(contributionReservedRows.map(item => String(item.cardId)))].sort((a, b) => a.localeCompare(b)),
      abilityIds: contributionReservedRows.map(item => item.abilityId).sort(),
      focusAbilityIds: contributionReservedRows.map(item => item.abilityId).sort(),
      contributionFiles: [...new Set(contributionReservedRows.flatMap(item => contributionFilesByAbility.get(item.abilityId) || []))].sort(),
      dependencies: [...new Set(contributionReservedRows.flatMap(item => (item.dependencies || []).map(dep => dep.id)))].sort()
    });
  }
  const candidateCardsByGroup = new Map();
  for (const [cardId, cardItems] of byCard) {
    if (reservedCards.has(cardId)) continue;
    const groups = new Set(cardItems.filter(item => !contributionReservedIds.has(item.abilityId) && item.workFlags?.includes("unsupported-or-unreviewed") &&
      item.mechanicGroupType === "unreviewed-similarity-candidate" && typeof item.mechanicGroup === "string")
      .map(item => item.mechanicGroup));
    for (const mechanicGroup of groups) {
      let cardSet = candidateCardsByGroup.get(mechanicGroup);
      if (!cardSet) candidateCardsByGroup.set(mechanicGroup, cardSet = new Set());
      cardSet.add(cardId);
    }
  }
  const rankedCandidateGroups = [...candidateCardsByGroup.entries()]
    .filter(([, cardSet]) => cardSet.size >= minMechanicGroupCards)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
  const familyAssignedCards = new Set();
  const usedBatchIds = new Set(batches.map(batch => batch.batchId));
  let familyBatchSequence = 1;
  const nextFamilyBatchId = () => {
    let batchId;
    do { batchId = `CANDIDATE-${baselineCommit.slice(0, 8).toUpperCase()}-${String(familyBatchSequence++).padStart(4, "0")}`; }
    while (usedBatchIds.has(batchId));
    usedBatchIds.add(batchId);
    return batchId;
  };
  for (const [mechanicGroup, cardSet] of rankedCandidateGroups) {
    const eligibleCards = [...cardSet].filter(cardId => !familyAssignedCards.has(cardId)).sort((a, b) => a.localeCompare(b));
    for (let offset = 0; offset < eligibleCards.length; offset += cardsPerBatch) {
      const cardIds = eligibleCards.slice(offset, offset + cardsPerBatch);
      if (!cardIds.length) continue;
      cardIds.forEach(cardId => familyAssignedCards.add(cardId));
      const rows = cardIds.flatMap(cardId => byCard.get(cardId).filter(item => !contributionReservedIds.has(item.abilityId)));
      const focusedAbilityIds = rows.filter(item => item.mechanicGroup === mechanicGroup).map(item => item.abilityId).sort();
      batches.push({
        batchId: nextFamilyBatchId(),
        status: "available",
        workerOwner: null,
        cardIds,
        abilityIds: rows.map(item => item.abilityId).sort(),
        focusedAbilityIds,
        candidateMechanicGroup: mechanicGroup,
        groupingNote: "Similarity triage only: review each printed ability independently; matching this group does not establish rule equivalence.",
        dependencies: [...new Set(rows.flatMap(item => (item.dependencies || []).map(dep => dep.id)))].sort()
      });
    }
  }

  const normalCards = [...byCard.keys()].filter(cardId => !reservedCards.has(cardId) && !familyAssignedCards.has(cardId) &&
    byCard.get(cardId).some(item => !contributionReservedIds.has(item.abilityId))).sort((a, b) => a.localeCompare(b));
  let normalBatchSequence = 1;
  for (let index = 0; index < normalCards.length; index += cardsPerBatch) {
    const cardIds = normalCards.slice(index, index + cardsPerBatch);
    const rows = cardIds.flatMap(cardId => byCard.get(cardId).filter(item => !contributionReservedIds.has(item.abilityId)));
    let batchId;
    do { batchId = `ABILITY-${baselineCommit.slice(0, 8).toUpperCase()}-${String(normalBatchSequence++).padStart(4, "0")}`; }
    while (usedBatchIds.has(batchId));
    usedBatchIds.add(batchId);
    batches.push({
      batchId,
      status: "available",
      workerOwner: null,
      cardIds,
      abilityIds: rows.map(item => item.abilityId).sort(),
      dependencies: [...new Set(rows.flatMap(item => (item.dependencies || []).map(dep => dep.id)))].sort()
    });
  }

  // Keep an unclaimed task's identity when the next build produces the same exact
  // work item. Baseline SHAs change on every merge; using them as the sole identity
  // used to invalidate open task links and local contribution manifests on refresh.
  const previousAvailableByIdentity = new Map();
  for (const previous of previousBatches) {
    if (previous?.status !== "available" || previous.workerOwner != null || typeof previous.batchId !== "string") continue;
    const identity = abilityBatchIdentity(previous);
    if (!identity) continue;
    const matches = previousAvailableByIdentity.get(identity) || [];
    matches.push(previous.batchId);
    previousAvailableByIdentity.set(identity, matches);
  }
  const generatedBatchIds = new Set(batches.map(batch => batch.batchId));
  const reusedPreviousIds = new Set();
  for (const batch of batches) {
    if (batch.status !== "available" || batch.workerOwner != null) continue;
    const matches = previousAvailableByIdentity.get(abilityBatchIdentity(batch));
    const previousId = matches?.shift();
    // A prior ID may now be the deterministic ID of a different newly generated
    // batch. Reusing it would create an ambiguous registry even though the prior
    // identity matched this batch. Keep the new ID in that case.
    if (!previousId || reusedPreviousIds.has(previousId) ||
        previousId !== batch.batchId && generatedBatchIds.has(previousId) || assignedBatchIds.has(previousId)) continue;
    batch.batchId = previousId;
    reusedPreviousIds.add(previousId);
  }

  const uniqueBatchIds = new Set();
  for (const batch of batches) {
    if (uniqueBatchIds.has(batch.batchId)) throw new Error(`Duplicate batch ID ${batch.batchId}; batch claims would be ambiguous.`);
    uniqueBatchIds.add(batch.batchId);
  }

  const batchForAbility = new Map(batches.flatMap(batch => batch.abilityIds.map(abilityId => [abilityId, batch.batchId])));
  const records = queue.items.map(item => {
    const verification = item.evidence || null;
    const implementationStatus = item.workFlags?.includes("failing-validation") ? "validation-failed"
      : item.workFlags?.includes("unsupported-or-unreviewed") ? "unreviewed"
      : verification?.status === "fully-verified" ? "fully-verified"
      : verification?.status === "tests-passing" ? "tests-passing"
      : item.effects?.length ? "compiled-unverified" : "unreviewed";
    const assignment = assignedCards.get(String(item.cardId));
    const contributionReserved = contributionReservedIds.has(item.abilityId) && !assignment;
    const primaryReserved = (reservedCards.has(String(item.cardId)) || contributionReserved) && !assignment;
    return {
      abilityId: item.abilityId,
      cardId: String(item.cardId),
      kind: item.kind,
      printedText: item.printedText,
      mechanicGroup: item.mechanicGroup,
      implementationStatus,
      assignmentStatus: assignment?.status || (primaryReserved ? "reserved" : "available"),
      workerOwner: assignment?.workerOwner || (primaryReserved ? "primary-session" : null),
      batchId: assignment?.batchId || batchForAbility.get(item.abilityId),
      contributionFiles: contributionFilesByAbility.get(item.abilityId) || [],
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
        reservedAbilities: allReservedRows.length,
        availableAbilities: records.length - allReservedRows.length,
        reservedCards: new Set([...reservedCards, ...contributionReservedRows.map(item => String(item.cardId))]).size,
        contributionReviewReservations: contributionReservedRows.length,
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
  const batchesPath = path.join(root, "ability-work-batches.json");
  const assignments = fs.existsSync(assignmentsPath) ? JSON.parse(fs.readFileSync(assignmentsPath, "utf8")).assignments : [];
  const previousBatches = fs.existsSync(batchesPath) ? JSON.parse(fs.readFileSync(batchesPath, "utf8")).batches : [];
  const verificationManifestPath = path.join(root, "card-verification-manifest.json");
  const verificationManifest = fs.existsSync(verificationManifestPath) ? JSON.parse(fs.readFileSync(verificationManifestPath, "utf8")) : null;
  const completedAbilityIds = Array.isArray(verificationManifest?.records)
    ? verificationManifest.records.filter(record => record?.status === "fully-verified" && record?.fullyVerified === true).map(record => String(record.abilityId))
    : [];
  const queue = readQueueFile(queueFile);
  // Re-scan on registry generation too, so a previously generated queue cannot
  // accidentally reopen work already present in a contribution file.
  const contributionReservations = require("./build-ability-work-queue.js").scanContributionAbilityReservations(root);
  const currentQueue = {
    ...queue,
    items: queue.items.map(item => ({
      ...item,
      primaryReviewContributionFiles: [...new Set([
        ...(Array.isArray(item.primaryReviewContributionFiles) ? item.primaryReviewContributionFiles : []),
        ...(contributionReservations.get(item.abilityId) || [])
      ])].sort()
    }))
  };
  const built = buildRegistry(currentQueue, { baselineCommit, cardsPerBatch, assignments, previousBatches, completedAbilityIds });
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

module.exports = { RESERVED_ABILITIES, buildRegistry, writeRegistry, readQueueFile };
