"use strict";

const fs = require("node:fs");
const path = require("node:path");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const serverReducer = require("../ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./audit-ability-catalog.js");
const { candidatePatternKey } = require("./unsupported-ability-patterns.js");
const { sourceValidationDigest } = require("./source-validation-digest.js");
const CONTINUOUS_EFFECT_OPS = new Set([
  "continuous-power", "continuous-critical", "continuous-shield", "continuous-grade",
  "continuous-power-per-soul-card", "continuous-power-adjustment", "continuous-power-per-clan-rearguard", "continuous-power-per-dragontree-marker", "continuous-power-per-controller-rearguard", "continuous-power-per-named-face-up-damage-card"
]);

function dependenciesForAbility({ ability, definition, missingRequirements, missingHandlers, missingServerHandlers, missingTrustedDefinition, hasTests, suiteFresh, mechanicGroup }) {
  const dependencies = [];
  const add = (id, type, label, shared = false, resolutionScope = "per-ability-review") => dependencies.push({ id, type, label, shared, resolutionScope });
  if (!definition) add(`candidate-review:${mechanicGroup}`, "candidate-review", mechanicGroup);
  for (const requirement of missingRequirements) add(`requirement-review:${requirement}`, "requirement-review", requirement);
  for (const operation of missingHandlers) add(`client-effect-handler:${operation}`, "client-effect-handler", operation, true, "shared-handler");
  for (const operation of missingServerHandlers) add(`server-effect-handler:${operation}`, "server-effect-handler", operation, true, "shared-handler");
  if (missingTrustedDefinition) add(`trusted-server-definition:${ability.id}`, "trusted-server-definition", ability.id);
  if (!hasTests) add(`regression-evidence:${ability.id}`, "regression-evidence", ability.id);
  else if (!suiteFresh) add("fresh-full-suite", "fresh-full-suite", "passing full-suite evidence for current source", true, "shared-validation");
  add(`whole-card-evidence:${ability.cardId}`, "whole-card-evidence", ability.cardId, false, "per-card-verification");
  return dependencies.sort((a, b) => a.id.localeCompare(b.id));
}

function buildAbilityWorkQueue(cards, manifest, root = path.resolve(__dirname, "..")) {
  if (!Array.isArray(cards) || !manifest || !Array.isArray(manifest.records)) throw new TypeError("A card catalog and verification manifest are required.");
  const audit = auditCatalog(cards);
  const invalid = new Map(audit.invalidCompiled.map(item => [item.abilityId, item.reasons]));
  const evidence = new Map(manifest.records.map(record => [record.abilityId, record]));
  const suite = manifest.latestFullSuite || null;
  const suiteFresh = Boolean(suite?.status === "passed" && suite.passed === suite.tests && suite.validationInputDigest === sourceValidationDigest(root));
  const parsedByCard = new Map(cards.map(card => [String(card.id || ""), engine.parseCardAbilitiesCached(card)]));
  const trustedByCard = new Map(cards.map(card => [String(card.id || ""), new Set((engine.getReviewedAbilityDefinitionsForCard?.(String(card.id || "")) || []).map(entry => entry.id))]));
  const fullyVerifiedCards = new Set();
  for (const [cardId, abilities] of parsedByCard) {
    if (abilities.length && abilities.every(ability => {
      const record = evidence.get(ability.id);
      return record?.status === "fully-verified" && record.fullyVerified === true && !invalid.has(ability.id);
    })) fullyVerifiedCards.add(cardId);
  }

  const groups = new Map();
  const dependencies = new Map();
  const dependencyEdges = [];
  const remainingCardAbilities = new Map();
  const items = [];
  const counts = { unsupported: 0, failingValidation: 0, missingEffectHandlers: 0, missingServerEffectHandlers: 0, missingTrustedServerDefinitions: 0, missingRequirements: 0, missingTests: 0, staleSuiteEvidence: 0, abilityEvidencePassing: 0, implementedAbilities: 0, fullyVerifiedAbilities: 0, partiallyImplementedAbilities: 0, fullyVerifiedCards: fullyVerifiedCards.size };
  for (const card of cards) {
    const cardId = String(card.id || "");
    for (const ability of parsedByCard.get(cardId) || []) {
      if (fullyVerifiedCards.has(cardId)) continue;
      const definition = ability.definition || null;
      const record = evidence.get(ability.id) || null;
      const missingTrustedDefinition = Boolean(definition && ["AUTO", "ACT"].includes(ability.kind) && !trustedByCard.get(cardId)?.has(ability.id));
      const badDefinitionReasons = invalid.get(ability.id) || [];
      const missingHandlers = [...new Set((definition?.effects || []).map(step => step?.op).filter(op => !op || !(engine.EFFECT_HANDLERS?.[op]) && !(ability.kind === "CONT" && CONTINUOUS_EFFECT_OPS.has(op))))];
      const serverAbilitySupported = ability.kind === "CONT" || Boolean(serverReducer.supportsServerAbilityEffects?.(ability));
      const missingServerHandlers = serverAbilitySupported ? [] : [...new Set((definition?.effects || []).map(step => step?.op).filter(op => !op || !serverReducer.supportsServerEffectOperation?.(op)))];
      const missingRequirements = [];
      if (!definition) counts.unsupported++;
      if (badDefinitionReasons.length) counts.failingValidation++;
      if (missingHandlers.length) counts.missingEffectHandlers++;
      if (missingServerHandlers.length) counts.missingServerEffectHandlers++;
      if (missingTrustedDefinition) counts.missingTrustedServerDefinitions++;
      if (ability.kind === "AUTO" && ability.trigger?.status !== "recognized-trigger") missingRequirements.push("trigger");
      const requirementsToCheck = [["conditions", ability.conditionStatus], ["costs", ability.costStatus]];
      if (["AUTO", "ACT"].includes(ability.kind)) requirementsToCheck.push(["choices", ability.choiceStatus]);
      for (const [field, value] of requirementsToCheck) {
        if (value === "needs-review") missingRequirements.push(field);
      }
      if (missingRequirements.length) counts.missingRequirements++;
      const implementationComplete = Boolean(definition && !badDefinitionReasons.length && !missingHandlers.length && !missingServerHandlers.length && !missingTrustedDefinition && !missingRequirements.length);
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
      if (missingTrustedDefinition) flags.push("missing-trusted-server-definition");
      if (missingRequirements.length) flags.push("unmodeled-requirement");
      if (!hasTests) flags.push("missing-regression-evidence");
      if (hasTests && !suiteFresh) flags.push("full-suite-evidence-stale");
      if (hasTests) flags.push("card-level-verification-incomplete");
      const reviewedPattern = definition?.source?.patternId || null;
      const candidateKey = reviewedPattern ? `reviewed:${reviewedPattern}` : `candidate:${candidatePatternKey(ability.kind, ability.raw || ability.printedText || "")}`;
      const dependenciesForItem = dependenciesForAbility({ ability, definition, missingRequirements, missingHandlers, missingServerHandlers, missingTrustedDefinition, hasTests, suiteFresh, mechanicGroup: candidateKey });
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
        missingTrustedDefinition,
        missingRequirements,
        dependencies: dependenciesForItem,
        workFlags: flags
      };
      items.push(item);
      let cardAbilityIds = remainingCardAbilities.get(cardId);
      if (!cardAbilityIds) remainingCardAbilities.set(cardId, cardAbilityIds = []);
      cardAbilityIds.push(ability.id);
      for (const dependency of dependenciesForItem) {
        let entry = dependencies.get(dependency.id);
        if (!entry) {
          entry = { id: dependency.id, type: dependency.type, label: dependency.label, shared: dependency.shared, resolutionScope: dependency.resolutionScope, abilityIds: new Set(), cardIds: new Set() };
          dependencies.set(dependency.id, entry);
        }
        entry.abilityIds.add(ability.id);
        entry.cardIds.add(cardId);
        dependencyEdges.push({ from: `ability:${ability.id}`, to: dependency.id });
      }
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
  const dependencyNodes = [...dependencies.values()].map(entry => ({
    id: entry.id,
    type: entry.type,
    label: entry.label,
    shared: entry.shared,
    resolutionScope: entry.resolutionScope,
    blockedAbilityCount: entry.abilityIds.size,
    blockedCardCount: entry.cardIds.size,
    abilityIds: [...entry.abilityIds].sort()
  })).sort((a, b) => b.blockedAbilityCount - a.blockedAbilityCount || a.id.localeCompare(b.id));
  const cardDependencyNodes = [...remainingCardAbilities.entries()].map(([cardId, abilityIds]) => ({
    id: `whole-card-evidence:${cardId}`,
    dependsOn: abilityIds.map(abilityId => `ability:${abilityId}`).sort()
  }));
  for (const cardNode of cardDependencyNodes) for (const abilityNode of cardNode.dependsOn) dependencyEdges.push({ from: cardNode.id, to: abilityNode });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "current catalog, structured ability registry, and card-verification-manifest.json",
    rulesNote: "Reviewed pattern IDs identify implemented reusable mechanics. Candidate similarity groups are triage only and do not assert semantic equivalence. Dependency nodes distinguish shared handlers/validation from per-ability semantic review and card-level gates; a high count never proves that candidate abilities share rules semantics.",
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
    dependencySummary: dependencyNodes,
    cardVerificationDependencies: cardDependencyNodes,
    dependencyEdges: dependencyEdges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
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
module.exports = { buildAbilityWorkQueue, validationSourceDigest: sourceValidationDigest, dependenciesForAbility };
