"use strict";

const fs = require("node:fs");
const path = require("node:path");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog, auditCatalog } = require("./audit-ability-catalog.js");

const CATEGORY_BY_KIND = Object.freeze({ AUTO: "automatic", ACT: "activated", CONT: "continuous" });
const TRIGGER_TYPES = Object.freeze(["Draw", "Critical", "Stand", "Heal", "Front", "Over"]);

function cardTypeText(card) {
  return String(card?.type || "");
}

function extractTriggerType(card) {
  const declared = String(card?.trigger || "").trim().match(/^(Draw|Critical|Stand|Heal|Front|Over)(?:\s+Trigger)?$/i);
  if (declared) return declared[1].toLowerCase();
  const printed = `${cardTypeText(card)}\n${String(card?.text || "")}`;
  const match = printed.match(new RegExp(`\\b(${TRIGGER_TYPES.join("|")})\\s+Triggers?\\b`, "i"));
  return match ? match[1].toLowerCase() : null;
}

function classifyCardCategories(card, parsedAbilities = engine.parseCardAbilitiesCached(card)) {
  const type = cardTypeText(card);
  const categories = [];
  if (/\border\b/i.test(type)) categories.push("order");
  if (/\btrigger\b/i.test(type)) categories.push("trigger");
  for (const ability of parsedAbilities) {
    const category = CATEGORY_BY_KIND[ability.kind];
    if (category && !categories.includes(category)) categories.push(category);
  }
  return {
    categories,
    triggerType: categories.includes("trigger") ? extractTriggerType(card) : null,
    explicitAbilityKinds: parsedAbilities.map(ability => ability.kind)
  };
}

function addCount(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

function buildAbilityCategoryInventory(cards, manifest = { records: [] }, audit = auditCatalog(cards), parseAbilities = engine.parseCardAbilitiesCached) {
  if (!Array.isArray(cards)) throw new TypeError("A catalog card array is required.");
  const records = Array.isArray(manifest?.records) ? manifest.records : [];
  const evidenceByAbility = new Map(records.map(record => [record.abilityId, record]));
  const invalid = new Map((audit?.invalidCompiled || []).map(item => [item.abilityId, item.reasons || []]));
  const report = {
    schemaVersion: 1,
    purpose: "Rules-aligned category triage. Counts are not evidence that an ability is implemented or verified.",
    cards: cards.length,
    abilityCategories: {
      automatic: { blocks: 0, compiled: 0, validDefinitions: 0, passingAbilityEvidence: 0, fullyVerifiedAbilities: 0 },
      activated: { blocks: 0, compiled: 0, validDefinitions: 0, passingAbilityEvidence: 0, fullyVerifiedAbilities: 0 },
      continuous: { blocks: 0, compiled: 0, validDefinitions: 0, passingAbilityEvidence: 0, fullyVerifiedAbilities: 0 },
      order: { cards: 0, cardsWithoutExplicitKeywordBlocks: 0, requiresOrderResolutionAudit: 0 },
      trigger: { cards: 0, byType: {}, missingRecognizedType: 0, unclassifiedCards: [], triggerCardsForCardLevelAudit: 0 }
    },
    autoTriggerEvents: {},
    unsupportedOrUnreviewed: { automatic: 0, activated: 0, continuous: 0 },
    topRecurringCompiledPatterns: []
  };
  const patterns = new Map();
  for (const card of cards) {
    const parsed = parseAbilities(card);
    const category = classifyCardCategories(card, parsed);
    if (category.categories.includes("order")) {
      report.abilityCategories.order.cards++;
      report.abilityCategories.order.requiresOrderResolutionAudit++;
      if (!parsed.length) report.abilityCategories.order.cardsWithoutExplicitKeywordBlocks++;
    }
    if (category.categories.includes("trigger")) {
      report.abilityCategories.trigger.cards++;
      report.abilityCategories.trigger.triggerCardsForCardLevelAudit++;
      if (category.triggerType) addCount(report.abilityCategories.trigger.byType, category.triggerType);
      else {
        report.abilityCategories.trigger.missingRecognizedType++;
        report.abilityCategories.trigger.unclassifiedCards.push({
          id: String(card.id || ""),
          name: String(card.name || ""),
          grade: card.grade !== "" && card.grade != null && Number.isFinite(Number(card.grade)) ? Number(card.grade) : null,
          declaredTriggerType: String(card.trigger || "")
        });
      }
    }
    for (const ability of parsed) {
      const ruleCategory = CATEGORY_BY_KIND[ability.kind];
      if (!ruleCategory) continue;
      const tally = report.abilityCategories[ruleCategory];
      tally.blocks++;
      const definition = ability.definition;
      if (!definition) {
        report.unsupportedOrUnreviewed[ruleCategory]++;
        continue;
      }
      tally.compiled++;
      if (!invalid.has(ability.id)) tally.validDefinitions++;
      const evidence = evidenceByAbility.get(ability.id);
      if (evidence && ["tests-passing", "fully-verified"].includes(evidence.status) && (evidence.testCases || []).length && (evidence.testFiles || []).length) tally.passingAbilityEvidence++;
      if (evidence?.status === "fully-verified" && evidence.fullyVerified === true && !invalid.has(ability.id)) tally.fullyVerifiedAbilities++;
      if (ability.kind === "AUTO" && ability.trigger?.eventType) addCount(report.autoTriggerEvents, ability.trigger.eventType);
      const pattern = definition.source?.patternId || "curated-definition";
      const current = patterns.get(pattern) || { patternId: pattern, kind: ability.kind, abilities: 0, cards: new Set() };
      current.abilities++;
      current.cards.add(String(card.id || ""));
      patterns.set(pattern, current);
    }
  }
  report.topRecurringCompiledPatterns = [...patterns.values()]
    .map(item => ({ patternId: item.patternId, kind: item.kind, abilities: item.abilities, cards: item.cards.size }))
    .sort((left, right) => right.abilities - left.abilities || left.patternId.localeCompare(right.patternId))
    .slice(0, 30);
  report.abilityCategories.trigger.byType = Object.fromEntries(Object.entries(report.abilityCategories.trigger.byType).sort(([a], [b]) => a.localeCompare(b)));
  return report;
}

function main(argv = process.argv.slice(2)) {
  const root = path.resolve(__dirname, "..");
  const manifestPath = path.join(root, "card-verification-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const report = buildAbilityCategoryInventory(loadCatalog(root), manifest);
  const outputIndex = argv.indexOf("--output");
  if (outputIndex >= 0) {
    const destination = path.resolve(root, argv[outputIndex + 1] || ".card-pipeline/ability-category-inventory.json");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    fs.renameSync(temporary, destination);
    process.stdout.write(`${JSON.stringify({ output: path.relative(root, destination), ...report }, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}

if (require.main === module) main();
module.exports = { CATEGORY_BY_KIND, TRIGGER_TYPES, classifyCardCategories, extractTriggerType, buildAbilityCategoryInventory };
