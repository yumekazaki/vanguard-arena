"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadCatalog } = require("./audit-ability-catalog.js");

function integrateContribution(root, batchId) {
  if (!/^ABILITY-\d{4}$/.test(String(batchId || ""))) throw new TypeError("A registered ABILITY batch ID is required.");
  const contributionPath = path.join(root, "ability-contributions", `batch-${batchId}.js`);
  if (!fs.existsSync(contributionPath)) throw new Error(`Missing contribution file for ${batchId}.`);
  delete require.cache[require.resolve(contributionPath)];
  const contribution = require(contributionPath);
  if (!Array.isArray(contribution) || !contribution.length) throw new Error("The contribution must export a non-empty definition array.");

  const registryPath = path.join(root, "ability-work-registry.jsonl");
  const registry = fs.readFileSync(registryPath, "utf8").trim().split(/\r?\n/).map(JSON.parse);
  const assigned = new Map(registry.filter(row => row.batchId === batchId).map(row => [row.abilityId, row]));
  const catalog = loadCatalog(root), cards = new Map(catalog.map(card => [String(card.id), card]));
  const existing = require(path.join(root, "ability-definitions.js"));
  const existingIds = new Set(existing.map(definition => definition.id));
  const newIds = new Set();
  for (const definition of contribution) {
    if (!definition || typeof definition.id !== "string" || newIds.has(definition.id) || existingIds.has(definition.id)) throw new Error(`Missing, duplicate, or already integrated ability ID: ${definition?.id || "<missing>"}`);
    newIds.add(definition.id);
    const row = assigned.get(definition.id), card = cards.get(String(definition.cardId));
    if (!row || String(row.cardId) !== String(definition.cardId)) throw new Error(`${definition.id} is outside ${batchId}.`);
    if (!card || !definition.printedText || !String(card.text || "").includes(definition.printedText)) throw new Error(`${definition.id} does not preserve exact catalog text.`);
    if (!definition.source?.patternId || !Array.isArray(definition.effects) || !definition.effects.length) throw new Error(`${definition.id} lacks reviewed source metadata or a structured effect program.`);
    if (definition.kind === "AUTO" && (!definition.trigger?.eventType || !definition.trigger?.subject || !definition.requiredLocation?.length)) throw new Error(`${definition.id} lacks a structured AUTO trigger or source location.`);
    if (definition.kind === "ACT" && (!definition.requiredLocation?.length || !definition.choicesReviewed || !definition.costsReviewed && definition.costs?.length)) throw new Error(`${definition.id} lacks ACT location, choice, or cost review.`);
    if (definition.kind === "CONT" && !definition.requiredLocation?.length && !definition.keywords?.length && !definition.continuousRestrictions?.length) throw new Error(`${definition.id} lacks CONT scope metadata.`);
  }

  const definitionsPath = path.join(root, "ability-definitions.js");
  const source = fs.readFileSync(definitionsPath, "utf8");
  const closing = /\r?\n  \];\r?\n  if \(root\?\.VanguardAbilityEngine\)/g;
  const match = closing.exec(source);
  if (!match || closing.exec(source)) throw new Error("Could not find exactly one trusted definition-array insertion point.");
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const formatted = contribution.map(definition => JSON.stringify(definition, null, 2).split("\n").map(line => `    ${line}`).join(newline)).join(`,${newline}`);
  const insertAt = match.index;
  const updated = `${source.slice(0, insertAt)},${newline}${formatted}${source.slice(insertAt)}`;
  const temporary = `${definitionsPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, updated, { flag: "wx" });
  try { fs.renameSync(temporary, definitionsPath); }
  catch (error) { fs.rmSync(temporary, { force: true }); throw error; }
  return { batchId, integratedAbilityIds: [...newIds].sort(), count: newIds.size };
}

if (require.main === module) {
  const batchId = process.argv[2];
  try { process.stdout.write(`${JSON.stringify(integrateContribution(path.resolve(__dirname, ".."), batchId), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { integrateContribution };
