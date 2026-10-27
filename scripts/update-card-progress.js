"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { auditCatalog, loadCatalog } = require("./audit-ability-catalog.js");

const root = path.resolve(__dirname, "..");
const startedAt = performance.now();
const cards = loadCatalog(root);
const loadedAt = performance.now();
const audit = auditCatalog(cards);
const auditedAt = performance.now();
const manifestPath = path.join(root, "card-verification-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const catalogIds = new Set(cards.map(card => String(card.id || "")));
const evidence = manifest.records.filter(record => catalogIds.has(String(record.cardId)));
const cardIdsPassingTests = new Set(evidence.filter(record => record.status === "tests-passing").map(record => String(record.cardId)));
const cardIdsFullyVerified = new Set(evidence.filter(record => record.status === "fully-verified" && record.fullyVerified === true).map(record => String(record.cardId)));
const report = {
  generatedAt: new Date().toISOString(),
  catalogSnapshot: manifest.catalogSnapshot,
  catalogSource: "scripts/audit-ability-catalog.js (local catalog file or committed HEAD snapshot)",
  cards: {
    imported: audit.cardRecords,
    parsed: audit.cardsParsed,
    withAbilities: audit.cardsWithAbilities,
    withAtLeastOneCompiledAbility: audit.cardsWithAtLeastOneCompiledAbility,
    withAllAbilityBlocksCompiledAndAuditValid: audit.cardsWithAllAbilityBlocksCompiledAndAuditValid,
    withUnsupportedAbilityBlocks: audit.cardsWithUnsupportedAbilityBlocks,
    withUnmodeledRequirements: audit.cardsWithUnmodeledRequirements,
    withExplicitPassingRegressionEvidence: cardIdsPassingTests.size,
    fullyVerified: cardIdsFullyVerified.size
  },
  abilities: {
    parsed: audit.abilityBlocks,
    compiled: audit.compiled,
    unsupportedOrUnreviewed: audit.unsupported,
    invalidCompiled: audit.invalidCompiled.length,
    patterns: audit.patternCount,
    compiledPercent: audit.coveragePercent
  },
  verification: {
    manifest: path.basename(manifestPath),
    manifestRecords: evidence.length,
    passingTestCases: evidence.filter(record => record.status === "tests-passing").reduce((count, record) => count + (record.testCases || []).length, 0),
    latestFullSuite: manifest.latestFullSuite || null,
    fullyVerifiedRequiresAllPrintedAbilitiesAndRulesEvidence: true,
    note: "Aggregate parsing or a passing pattern test does not make a whole card fully verified. Only explicit manifest records count as regression evidence; zero fully verified cards is reported when no complete card-level evidence exists."
  },
  workflow: {
    catalogLoadMilliseconds: Number((loadedAt - startedAt).toFixed(1)),
    fullCatalogParseAndAuditMilliseconds: Number((auditedAt - loadedAt).toFixed(1)),
    repeatedAuditsOfTheSameCatalogUseTheExistingDigestCache: true,
    parseCacheExperiment: "Rejected JSON-clone-per-call caching after three full catalog parse passes measured about 9.5 seconds uncached versus 12.1 seconds with cloning. Adopted immutable per-card snapshots with definition-revision invalidation: the same three passes measured about 9.5 seconds uncached versus 3.82 seconds cached; cache-hit passes were about 2.5 milliseconds each.",
    measuredBottlenecks: [
      { area: "Repeated catalog parsing in regression tests", evidence: "84 parseCardAbilities references in the 95-test catalog suite; a full catalog parse is about 3.4-3.8 seconds.", optimization: "Immutable per-card parse snapshots, shared by audit and catalog regressions.", result: "Catalog test file 16.61 seconds on its first cached run and 13.04 seconds after audit/cache integration; the 494-test optimization milestone took 37.96 seconds versus 245.62 seconds before the cache." },
      { area: "Unbounded all-in-one verification feedback", evidence: "Full Node suite measured 245.62 seconds before the cache and 37.96 seconds after it.", optimization: "Run focused rule/worker checks per ability batch and reserve the full suite for milestones.", result: manifest.latestFullSuite ? `Latest full suite: ${manifest.latestFullSuite.passed}/${manifest.latestFullSuite.tests} passed in ${(manifest.latestFullSuite.durationMilliseconds / 1000).toFixed(2)} seconds.` : "No full-suite result recorded." },
      { area: "Manual card semantics and validation backlog", evidence: `${audit.unsupported} ability blocks remain unsupported or unreviewed; ${audit.cardsWithUnsupportedAbilityBlocks} cards contain at least one such block. Repository history has no per-stage time logs to substantiate the reported 22 hours.`, optimization: "Process exact recurring templates in reusable batches; preserve per-card evidence and leave ambiguous text unreviewed.", result: "Reusable Soul-count power and critical patterns plus signed continuous power adjustments cover the current verified examples; per-card evidence stays partial until the other printed abilities are implemented." }
    ]
  },
  invalidCompiledDefinitions: audit.invalidCompiled
};

const destination = path.join(root, "catalog-progress.json");
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
