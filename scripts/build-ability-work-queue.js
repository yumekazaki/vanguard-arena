"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const serverReducer = require("../ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./audit-ability-catalog.js");
const { candidatePatternKey } = require("./unsupported-ability-patterns.js");
const CONTINUOUS_EFFECT_OPS = new Set([
  "continuous-power", "continuous-critical", "continuous-shield", "continuous-grade",
  "continuous-power-per-soul-card", "continuous-power-adjustment"
]);

function validationSourceDigest(root) {
  const files = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && [".git", ".card-pipeline", "node_modules"].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:js|cjs|mjs|ts|html|sql)$/i.test(entry.name)) files.push(file);
    }
  };
  walk(root);
  const hash = createHash("sha256");
  for (const file of files.sort()) hash.update(path.relative(root, file)).update("\0").update(fs.readFileSync(file)).update("\0");
  return hash.digest("hex");
}

function buildAbilityWorkQueue(cards, manifest, root = path.resolve(__dirname, "..")) {
  if (!Array.isArray(cards) || !manifest || !Array.isArray(manifest.records)) throw new TypeError("A card catalog and verification manifest are required.");
  const audit = auditCatalog(cards);
  const invalid = new Map(audit.invalidCompiled.map(item => [item.abilityId, item.reasons]));
  const evidence = new Map(manifest.records.map(record => [record.abilityId, record]));
  const suite = manifest.latestFullSuite || null;
  const suiteFresh = Boolean(suite?.status === "passed" && suite.passed === suite.tests && suite.validationInputDigest === validationSourceDigest(root));
  const parsedByCard = new Map(cards.map(card => [String(card.id || ""), engine.parseCardAbilitiesCached(card)]));
  const fullyVerifiedCards = new Set();
  for (const [cardId, abilities] of parsedByCard) {
    if (abilities.length && abilities.every(ability => {
      const record = evidence.get(ability.id);
      return record?.status === "fully-verified" && record.fullyVerified === true && !invalid.has(ability.id);
    })) fullyVerifiedCards.add(cardId);
  }

  const groups = new Map();
  const items = [];
  const counts = { unsupported: 0, failingValidation: 0, missingEffectHandlers: 0, missingServerEffectHandlers: 0, missingRequirements: 0, missingTests: 0, staleSuiteEvidence: 0, abilityEvidencePassing: 0, implementedAbilities: 0, fullyVerifiedAbilities: 0, partiallyImplementedAbilities: 0, fullyVerifiedCards: fullyVerifiedCards.size };
  for (const card of cards) {
    const cardId = String(card.id || "");
    for (const ability of parsedByCard.get(cardId) || []) {
      if (fullyVerifiedCards.has(cardId)) continue;
      const definition = ability.definition || null;
      const record = evidence.get(ability.id) || null;
      const badDefinitionReasons = invalid.get(ability.id) || [];
      const missingHandlers = [...new Set((definition?.effects || []).map(step => step?.op).filter(op => !op || !(engine.EFFECT_HANDLERS?.[op]) && !(ability.kind === "CONT" && CONTINUOUS_EFFECT_OPS.has(op))))];
      const serverAbilitySupported = ability.kind === "CONT" || Boolean(serverReducer.supportsServerAbilityEffects?.(ability));
      const missingServerHandlers = serverAbilitySupported ? [] : [...new Set((definition?.effects || []).map(step => step?.op).filter(op => !op || !serverReducer.supportsServerEffectOperation?.(op)))];
      const missingRequirements = [];
      if (!definition) counts.unsupported++;
      if (badDefinitionReasons.length) counts.failingValidation++;
      if (missingHandlers.length) counts.missingEffectHandlers++;
      if (missingServerHandlers.length) counts.missingServerEffectHandlers++;
      if (ability.kind === "AUTO" && ability.trigger?.status !== "recognized-trigger") missingRequirements.push("trigger");
      for (const [field, value] of [["conditions", ability.conditionStatus], ["costs", ability.costStatus], ["choices", ability.choiceStatus]]) {
        if (value === "needs-review") missingRequirements.push(field);
      }
      if (missingRequirements.length) counts.missingRequirements++;
      const implementationComplete = Boolean(definition && !badDefinitionReasons.length && !missingHandlers.length && !missingServerHandlers.length && !missingRequirements.length);
      if (implementationComplete) counts.implementedAbilities++;
      else if (definition) counts.partiallyImplementedAbilities++;
      const hasTests = Boolean(record && (record.testCases || []).length && (record.testFiles || []).length && ["tests-passing", "fully-verified"].includes(record.status));
      if (hasTests) counts.abilityEvidencePassing++;
      else counts.missingTests++;
      if (hasTests && !suiteFresh) counts.staleSuiteEvidence++;

      const flags = [];
      if (!definition) flags.push("unsupported-or-unreviewed");
      if (badDefinitionReasons.length) flags.push("failing-validation");
      if (missingHandlers.length) flags.push("missing-effect-handler");
      if (missingServerHandlers.length) flags.push("missing-authoritative-effect-handler");
      if (missingRequirements.length) flags.push("unmodeled-requirement");
      if (!hasTests) flags.push("missing-regression-evidence");
      if (hasTests && !suiteFresh) flags.push("full-suite-evidence-stale");
      if (hasTests) flags.push("card-level-verification-incomplete");
      const reviewedPattern = definition?.source?.patternId || null;
      const candidateKey = reviewedPattern ? `reviewed:${reviewedPattern}` : `candidate:${candidatePatternKey(ability.kind, ability.raw || ability.printedText || "")}`;
      const item = {
        cardId,
        abilityId: ability.id,
        kind: ability.kind,
        printedText: ability.printedText,
        location: ability.requiredLocation || [],
        trigger: ability.trigger || null,
        costs: ability.costs || [],
        conditions: ability.conditions || [],
        effects: definition?.effects || [],
        usageRestriction: ability.usageRestriction || null,
        mechanicGroup: candidateKey,
        mechanicGroupType: reviewedPattern ? "reviewed-mechanic" : "unreviewed-similarity-candidate",
        evidence: record ? { status: record.status, testFiles: record.testFiles || [], testCases: record.testCases || [] } : null,
        validationErrors: badDefinitionReasons,
        missingEffectHandlers: missingHandlers,
        missingServerEffectHandlers: missingServerHandlers,
        missingRequirements,
        workFlags: flags
      };
      items.push(item);
      let group = groups.get(candidateKey);
      if (!group) {
        group = { mechanicGroup: candidateKey, type: item.mechanicGroupType, abilityCount: 0, cardIds: new Set(), abilityIds: [], printedTextVariants: new Set(), missingHandlerOps: new Set(), missingServerHandlerOps: new Set(), workFlagCounts: new Map() };
        groups.set(candidateKey, group);
      }
      group.abilityCount++;
      group.cardIds.add(cardId);
      group.abilityIds.push(ability.id);
      group.printedTextVariants.add(ability.printedText);
      missingHandlers.forEach(op => group.missingHandlerOps.add(op));
      missingServerHandlers.forEach(op => group.missingServerHandlerOps.add(op));
      flags.forEach(flag => group.workFlagCounts.set(flag, (group.workFlagCounts.get(flag) || 0) + 1));
    }
  }
  for (const [cardId, abilities] of parsedByCard) if (fullyVerifiedCards.has(cardId)) counts.fullyVerifiedAbilities += abilities.length;
  items.sort((a, b) => a.mechanicGroup.localeCompare(b.mechanicGroup) || a.cardId.localeCompare(b.cardId) || a.abilityId.localeCompare(b.abilityId));
  const grouped = [...groups.values()].map(group => ({
    mechanicGroup: group.mechanicGroup,
    type: group.type,
    abilityCount: group.abilityCount,
    cardCount: group.cardIds.size,
    abilityIds: group.abilityIds.sort(),
    printedTextVariantCount: group.printedTextVariants.size,
    missingEffectHandlers: [...group.missingHandlerOps].sort(),
    missingServerEffectHandlers: [...group.missingServerHandlerOps].sort(),
    workFlagCounts: Object.fromEntries([...group.workFlagCounts].sort(([a], [b]) => a.localeCompare(b)))
  })).sort((a, b) => b.abilityCount - a.abilityCount || a.mechanicGroup.localeCompare(b.mechanicGroup));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "current catalog, structured ability registry, and card-verification-manifest.json",
    rulesNote: "Reviewed pattern IDs identify implemented reusable mechanics. Candidate similarity groups are triage only and do not assert semantic equivalence.",
    validationEvidenceFresh: suiteFresh,
    counts: {
      catalogAbilities: audit.abilityBlocks,
      compiledAbilities: audit.compiled,
      remainingAbilities: items.length,
      fullyVerifiedCards: fullyVerifiedCards.size,
      mechanicGroups: grouped.length,
      ...counts
    },
    groups: grouped,
    items
  };
}

function main(argv = process.argv.slice(2)) {
  const root = path.resolve(__dirname, "..");
  const manifestPath = path.join(root, "card-verification-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const queue = buildAbilityWorkQueue(loadCatalog(root), manifest, root);
  const outputIndex = argv.indexOf("--output");
  const destination = outputIndex >= 0 ? path.resolve(argv[outputIndex + 1] || ".card-pipeline/ability-work-queue.json") : path.join(root, ".card-pipeline", "ability-work-queue.json");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(queue, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, destination);
  process.stdout.write(`${JSON.stringify({ output: path.relative(root, destination), counts: queue.counts, validationEvidenceFresh: queue.validationEvidenceFresh }, null, 2)}\n`);
}

if (require.main === module) main();
module.exports = { buildAbilityWorkQueue, validationSourceDigest };
