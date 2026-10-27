"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function stable(value) { return JSON.stringify(value ?? null); }
function push(map, key, value) { const bucket = map.get(key) || []; bucket.push(value); map.set(key, bucket); }

function complexityOf(item) {
  const text = String(item.printedText || "");
  const signals = {
    costKinds: new Set((item.costs || []).map(cost => cost.type)).size,
    explicitConditions: (item.conditions || []).length,
    sequentialClauses: (text.match(/\b(?:if you do|then|after|and|until|during)\b/gi) || []).length,
    choices: (text.match(/\b(?:choose|select|may)\b/gi) || []).length,
    targetKinds: (text.match(/\b(?:target|one of your|opponent's|opponent’s)\b/gi) || []).length,
    unresolvedRequirements: (item.missingRequirements || []).length
  };
  signals.score = signals.costKinds * 2 + signals.explicitConditions * 2 + signals.sequentialClauses + signals.choices + signals.targetKinds + signals.unresolvedRequirements * 2;
  signals.band = signals.score < 4 ? "lower" : signals.score < 9 ? "medium" : "higher";
  signals.isHeuristic = true;
  return signals;
}

function dependencyIds(item) {
  const ids = [];
  const requirements = new Set(item.missingRequirements || []);
  if (!item.trigger && item.kind === "AUTO") requirements.add("trigger");
  for (const requirement of requirements) ids.push(`review:${requirement}`);
  if (!item.location?.length) ids.push("review:source-location");
  if (item.mechanicGroupType === "unreviewed-similarity-candidate") ids.push(`review:text:${item.mechanicGroup}`);
  if (item.missingEffectHandlers?.length) for (const op of item.missingEffectHandlers) ids.push(`engine:effect:${op}`);
  if (item.missingServerEffectHandlers?.length) for (const op of item.missingServerEffectHandlers) ids.push(`server:effect:${op}`);
  if (item.trigger?.eventType) ids.push(`engine:event:${item.trigger.eventType}`);
  ids.push(`validation:mechanic:${item.mechanicGroup}`);
  ids.push(`verification:card:${item.cardId}`);
  return [...new Set(ids)];
}

function buildUnsupportedAbilityDataset(queue, generatedAt = new Date().toISOString()) {
  if (!queue || !Array.isArray(queue.items) || !queue.counts) throw new TypeError("A generated ability work queue is required.");
  const unsupported = queue.items.filter(item => item.workFlags?.includes("unsupported-or-unreviewed"));
  const exactText = new Map(), mechanics = new Map(), dimensions = { activationType: new Map(), triggerType: new Map(), costs: new Map(), usageRestrictions: new Map(), location: new Map(), effectType: new Map(), missingEngineHandler: new Map(), missingServerHandler: new Map() };
  const dependencyMap = new Map();
  const records = unsupported.map(item => {
    const printedText = String(item.printedText || "");
    const textKey = hash(`${String(item.kind || "unknown").toUpperCase()}\0${printedText.replace(/\r\n?/g, "\n")}`);
    push(exactText, textKey, item);
    push(mechanics, item.mechanicGroup, item);
    push(dimensions.activationType, item.kind || "unknown", item);
    push(dimensions.triggerType, item.trigger?.eventType || (item.kind === "AUTO" ? "unrecognized" : "not-applicable"), item);
    push(dimensions.costs, hash(stable(item.costs)), item);
    push(dimensions.usageRestrictions, hash(stable(item.usageRestriction)), item);
    push(dimensions.location, stable(item.location || []), item);
    const effects = item.effects?.length ? item.effects.map(effect => effect.op || "unknown") : ["unstructured"];
    for (const effect of effects) push(dimensions.effectType, effect, item);
    for (const handler of item.missingEffectHandlers || []) push(dimensions.missingEngineHandler, handler, item);
    for (const handler of item.missingServerEffectHandlers || []) push(dimensions.missingServerHandler, handler, item);
    const dependencies = dependencyIds(item);
    for (const id of dependencies) push(dependencyMap, id, item);
    return {
      cardId: item.cardId,
      abilityId: item.abilityId,
      abilityKind: item.kind,
      printedText,
      mechanicGroup: item.mechanicGroup,
      mechanicGroupType: item.mechanicGroupType,
      trigger: item.trigger,
      conditions: item.conditions,
      costs: item.costs,
      usageRestriction: item.usageRestriction,
      requiredLocations: item.location,
      effectProgram: item.effects,
      missingRequirements: item.missingRequirements,
      missingEffectHandlers: item.missingEffectHandlers,
      missingServerEffectHandlers: item.missingServerEffectHandlers,
      evidence: item.evidence,
      complexity: complexityOf(item),
      dependencies
    };
  });
  const toGroups = (map, keyName, includeText = false) => [...map].map(([key, items]) => ({
    [keyName]: key,
    abilityCount: items.length,
    cardCount: new Set(items.map(item => item.cardId)).size,
    abilityIds: items.map(item => item.abilityId).sort(),
    ...(includeText ? { printedText: items[0].printedText } : {})
  })).sort((a, b) => b.abilityCount - a.abilityCount || String(a[keyName]).localeCompare(String(b[keyName])));
  const dependencyGraph = {
    nodes: [...dependencyMap].map(([id, items]) => ({ id, dependentAbilities: items.length, dependentCards: new Set(items.map(item => item.cardId)).size, abilityIds: items.map(item => item.abilityId).sort() }))
      .sort((a, b) => b.dependentCards - a.dependentCards || b.dependentAbilities - a.dependentAbilities || a.id.localeCompare(b.id)),
    edges: records.flatMap(record => record.dependencies.map(dependency => ({ from: `ability:${record.abilityId}`, to: dependency })))
  };
  const dimensionGroups = Object.fromEntries(Object.entries(dimensions).map(([dimension, map]) => [dimension, [...map].map(([key, items]) => ({
    key,
    abilityCount: items.length,
    cardCount: new Set(items.map(item => item.cardId)).size,
    abilityIds: items.map(item => item.abilityId).sort()
  })).sort((a, b) => b.abilityCount - a.abilityCount || a.key.localeCompare(b.key))]));
  return {
    schemaVersion: 1,
    generatedAt,
    source: "ability-work-queue.json; only entries explicitly flagged unsupported-or-unreviewed",
    queueValidationEvidenceFresh: queue.validationEvidenceFresh === true,
    counts: {
      unsupportedAbilities: records.length,
      unsupportedCards: new Set(records.map(item => item.cardId)).size,
      exactTextGroups: exactText.size,
      mechanicGroups: mechanics.size,
      dependencyNodes: dependencyGraph.nodes.length,
      dependencyEdges: dependencyGraph.edges.length,
      complexityBands: Object.fromEntries(["lower", "medium", "higher"].map(band => [band, records.filter(item => item.complexity.band === band).length]))
    },
    records,
    exactTextGroups: toGroups(exactText, "textHash", true),
    mechanicGroups: toGroups(mechanics, "mechanicGroup"),
    dimensions: dimensionGroups,
    dependencyGraph,
    notes: [
      "Every record preserves its card ID, ability ID, and original printed text.",
      "Exact-text groups normalize only line endings and ability kind; they are safe duplicate-work keys, not effect validation.",
      "Unreviewed mechanic groups and complexity scores are triage hints, never permission to infer ability semantics.",
      "A compiled effect handler cannot be inferred when the ability has no structured definition; such records retain unstructured effect status until reviewed."
    ]
  };
}

function main(argv = process.argv.slice(2)) {
  const root = path.resolve(__dirname, "..");
  const queuePath = path.resolve(root, argv[0] || ".card-pipeline/ability-work-queue.json");
  const destination = path.resolve(root, argv[1] || ".card-pipeline/unsupported-ability-dataset.json");
  const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
  const dataset = buildUnsupportedAbilityDataset(queue);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(dataset, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, destination);
  process.stdout.write(`${JSON.stringify({ output: path.relative(root, destination), counts: dataset.counts, queueValidationEvidenceFresh: dataset.queueValidationEvidenceFresh }, null, 2)}\n`);
}

if (require.main === module) main();
module.exports = { buildUnsupportedAbilityDataset, complexityOf, dependencyIds };
