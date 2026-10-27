"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const catalogCache = new Map();
const auditCache = new WeakMap();

function loadCatalog(root = path.resolve(__dirname, "..")) {
  const resolvedRoot = path.resolve(root);
  if (catalogCache.has(resolvedRoot)) return catalogCache.get(resolvedRoot);
  const catalogPath = path.join(root, "assets", "cards", "catalog-data.js");
  let source;
  if (fs.existsSync(catalogPath)) source = fs.readFileSync(catalogPath, "utf8");
  else source = execFileSync("git", ["show", "HEAD:assets/cards/catalog-data.js"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { timeout: 15_000, filename: "catalog-data.js" });
  const cards = sandbox.window.CARD_CATALOG;
  if (!Array.isArray(cards)) throw new Error("Card catalog did not expose window.CARD_CATALOG.");
  catalogCache.set(resolvedRoot, cards);
  return cards;
}

function auditCatalog(cards, parseAbilities = engine.parseCardAbilitiesCached) {
  if (!Array.isArray(cards)) throw new TypeError("Catalog audit requires a card array.");
  const digest = createHash("sha256").update(JSON.stringify(cards)).digest("hex");
  const cached = auditCache.get(cards);
  if (cached?.parseAbilities === parseAbilities && cached.digest === digest) return structuredClone(cached.report);
  const report = {
    cardRecords: cards.length,
    cardsParsed: 0,
    cardsWithAbilities: 0,
    cardsWithAtLeastOneCompiledAbility: 0,
    cardsWithAllAbilityBlocksCompiledAndAuditValid: 0,
    cardsWithUnsupportedAbilityBlocks: 0,
    cardsWithUnmodeledRequirements: 0,
    abilityBlocks: 0,
    byKind: { AUTO: 0, ACT: 0, CONT: 0, OTHER: 0 },
    compiled: 0,
    compiledByKind: { AUTO: 0, ACT: 0, CONT: 0, OTHER: 0 },
    unsupported: 0,
    patterns: {},
    invalidCompiled: []
  };
  for (const card of cards) {
    const abilities = parseAbilities(card);
    report.cardsParsed++;
    if (abilities.length) report.cardsWithAbilities++;
    let hasCompiledAbility = false, allBlocksValid = abilities.length > 0, hasUnsupportedBlock = false, hasUnmodeledRequirement = false;
    for (const ability of abilities) {
      report.abilityBlocks++;
      const kind = Object.hasOwn(report.byKind, ability.kind) ? ability.kind : "OTHER";
      report.byKind[kind]++;
      if (!ability.definition) { report.unsupported++; allBlocksValid = false; hasUnsupportedBlock = true; hasUnmodeledRequirement = true; continue; }
      hasCompiledAbility = true;
      report.compiled++;
      report.compiledByKind[kind]++;
      const pattern = ability.definition.source?.patternId || "curated-definition";
      report.patterns[pattern] = (report.patterns[pattern] || 0) + 1;
      const reasons = [];
      if (ability.definition.cardId !== String(card.id || "")) reasons.push("card-definition-mismatch");
      if (ability.definition.kind !== ability.kind) reasons.push("ability-kind-mismatch");
      const hasStructuredKeyword = ability.kind === "CONT" && Array.isArray(ability.definition.keywords) && ability.definition.keywords.length > 0;
      const hasStructuredRestriction = ability.kind === "CONT" && Array.isArray(ability.definition.continuousRestrictions) && ability.definition.continuousRestrictions.length > 0;
      if ((!Array.isArray(ability.definition.effects) || !ability.definition.effects.length) && !hasStructuredKeyword && !hasStructuredRestriction) reasons.push("missing-effect-program");
      if (ability.kind === "AUTO" && ability.trigger?.status !== "recognized-trigger") reasons.push("unrecognized-auto-trigger");
      if (ability.conditionStatus === "needs-review") reasons.push("unmodeled-condition");
      if (ability.costStatus === "needs-review") reasons.push("unmodeled-cost");
      if (["AUTO", "ACT"].includes(ability.kind) && ability.choiceStatus === "needs-review") reasons.push("unmodeled-choice");
      if (ability.conditionStatus === "needs-review" || ability.costStatus === "needs-review" || ["AUTO", "ACT"].includes(ability.kind) && ability.choiceStatus === "needs-review" || ability.kind === "AUTO" && ability.trigger?.status !== "recognized-trigger") hasUnmodeledRequirement = true;
      if (reasons.length) { report.invalidCompiled.push({ cardId: String(card.id || ""), abilityId: ability.id, reasons }); allBlocksValid = false; }
    }
    if (hasCompiledAbility) report.cardsWithAtLeastOneCompiledAbility++;
    if (allBlocksValid) report.cardsWithAllAbilityBlocksCompiledAndAuditValid++;
    if (hasUnsupportedBlock) report.cardsWithUnsupportedAbilityBlocks++;
    if (hasUnmodeledRequirement) report.cardsWithUnmodeledRequirements++;
  }
  report.patternCount = Object.keys(report.patterns).length;
  report.coveragePercent = report.abilityBlocks ? Number((report.compiled * 100 / report.abilityBlocks).toFixed(2)) : 0;
  if (parseAbilities === engine.parseCardAbilitiesCached) auditCache.set(cards, { digest, parseAbilities, report });
  return report;
}

if (require.main === module) {
  try {
    const report = auditCatalog(loadCatalog());
    console.log(JSON.stringify(report, null, 2));
    if (report.invalidCompiled.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Ability catalog audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { loadCatalog, auditCatalog };
