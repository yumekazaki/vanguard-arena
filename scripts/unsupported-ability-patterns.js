"use strict";

const fs = require("node:fs");
const path = require("node:path");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));

// Candidate grouping is for reviewer triage only. It never creates a definition
// or claims that different printed texts have equivalent rules behavior.
function candidatePatternKey(kind, printedText) {
  const normalized = String(printedText || "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[«<]([^»>]+)[»>]/g, "<clan>")
    .replace(/"([^"]+)"/g, '"<card-name>"')
    .replace(/\b(Counter Blast|Soul Blast|Energy Blast|Counter Charge|Soul Charge)\s+\d+/gi, "$1 N")
    .replace(/\b(power|shield|critical)\s*([+−-])\s*\d+/gi, "$1 $2 N")
    .replace(/\b\d+\b/g, "N")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
  return `${String(kind || "unknown").toUpperCase()}\u0000${normalized}`;
}

function buildUnsupportedPatternQueue(cards) {
  const patterns = new Map();
  let cardsScanned = 0, abilityBlocksScanned = 0, compiled = 0;
  for (const card of cards || []) {
    cardsScanned++;
    for (const ability of engine.parseCardAbilitiesCached(card)) {
      abilityBlocksScanned++;
      if (ability.definition) { compiled++; continue; }
      const printedText = String(ability.raw || ability.printedText || "");
      const key = candidatePatternKey(ability.kind, printedText);
      let group = patterns.get(key);
      if (!group) {
        group = { abilityKind: ability.kind || "unknown", candidatePattern: key.slice(key.indexOf("\u0000") + 1), occurrenceCount: 0, variants: new Map() };
        patterns.set(key, group);
      }
      group.occurrenceCount++;
      let variant = group.variants.get(printedText);
      if (!variant) {
        variant = { printedText, occurrences: [] };
        group.variants.set(printedText, variant);
      }
      variant.occurrences.push({ cardId: String(card.id || ""), abilityId: String(ability.id || "") });
    }
  }
  const groups = [...patterns.values()].map(group => ({
    abilityKind: group.abilityKind,
    candidatePattern: group.candidatePattern,
    occurrenceCount: group.occurrenceCount,
    distinctTextVariants: group.variants.size,
    variants: [...group.variants.values()].map(variant => ({
      printedText: variant.printedText,
      occurrences: variant.occurrences
    }))
  })).sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.candidatePattern.localeCompare(b.candidatePattern));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    disclaimer: "Similarity groups are review candidates only. Do not compile a group until every text variant's event, conditions, costs, choices, and effect sequence are independently validated.",
    metrics: {
      cardsScanned,
      abilityBlocksScanned,
      compiledAbilityBlocks: compiled,
      unsupportedAbilityBlocks: abilityBlocksScanned - compiled,
      unsupportedExactTextCount: groups.reduce((sum, group) => sum + group.distinctTextVariants, 0),
      normalizedCandidatePatternCount: groups.length
    },
    groups
  };
}

function main(argv = process.argv.slice(2)) {
  const { loadCatalog } = require("./audit-ability-catalog.js");
  const queue = buildUnsupportedPatternQueue(loadCatalog());
  const topPatterns = queue.groups.slice(0, 20).map(group => ({
    abilityKind: group.abilityKind,
    candidatePattern: group.candidatePattern,
    occurrenceCount: group.occurrenceCount,
    distinctTextVariants: group.distinctTextVariants,
    examples: group.variants.slice(0, 2).map(variant => ({
      printedText: variant.printedText.slice(0, 240),
      cardIds: variant.occurrences.slice(0, 3).map(occurrence => occurrence.cardId)
    }))
  }));
  const outputFlag = argv.indexOf("--output");
  if (outputFlag >= 0) {
    const destination = path.resolve(argv[outputFlag + 1] || "unsupported-ability-patterns.json");
    fs.writeFileSync(destination, JSON.stringify(queue, null, 2) + "\n");
    console.log(JSON.stringify({ output: destination, metrics: queue.metrics, topPatterns }, null, 2));
  } else {
    console.log(JSON.stringify({ metrics: queue.metrics, topPatterns }, null, 2));
  }
}

if (require.main === module) main();

module.exports = { candidatePatternKey, buildUnsupportedPatternQueue };
