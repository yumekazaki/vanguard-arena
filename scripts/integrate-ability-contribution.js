"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { loadCatalog } = require("./audit-ability-catalog.js");

function isValidWorkUnitId(value) {
  return /^[A-Z0-9][A-Z0-9-]{1,80}$/.test(String(value || ""));
}

function findMatchingArrayClose(source, openIndex) {
  if (source[openIndex] !== "[") return -1;
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let index = openIndex; index < source.length; index++) {
    const char = source[index], next = source[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) {
      if (char === "*" && next === "/") { blockComment = false; index++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") { lineComment = true; index++; continue; }
    if (char === "/" && next === "*") { blockComment = true; index++; continue; }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return index;
  }
  return -1;
}

function integrateContribution(root, batchId, { abilityIds = null } = {}) {
  if (!isValidWorkUnitId(batchId)) throw new TypeError("A registered ability work-unit ID is required.");
  const contributionPath = path.join(root, "ability-contributions", `batch-${batchId}.js`);
  if (!fs.existsSync(contributionPath)) throw new Error(`Missing contribution file for ${batchId}.`);
  delete require.cache[require.resolve(contributionPath)];
  const contributionRecord = require(contributionPath);
  const allDefinitions = Array.isArray(contributionRecord)
    ? contributionRecord
    : contributionRecord && Array.isArray(contributionRecord.proposedDefinitions)
      ? contributionRecord.proposedDefinitions
      : null;
  if (!allDefinitions?.length) throw new Error("The contribution must export a non-empty definition array or proposedDefinitions array.");
  if (new Set(allDefinitions.map(definition => definition?.id)).size !== allDefinitions.length) throw new Error("The contribution contains duplicate ability IDs.");
  if (abilityIds != null && !Array.isArray(abilityIds)) throw new TypeError("Selected ability IDs must be an array.");
  const requestedIds = abilityIds == null ? null : [...new Set(abilityIds.map(String))];
  if (requestedIds && requestedIds.length !== abilityIds.length) throw new TypeError("Selected ability IDs must be unique.");
  const definitionById = new Map(allDefinitions.map(definition => [definition?.id, definition]));
  if (requestedIds) for (const abilityId of requestedIds) if (!definitionById.has(abilityId)) throw new Error(`${abilityId} is not present in the contribution for ${batchId}.`);
  const contribution = requestedIds ? requestedIds.map(abilityId => definitionById.get(abilityId)) : allDefinitions;

  const registryPath = path.join(root, "ability-work-registry.jsonl");
  const registry = fs.readFileSync(registryPath, "utf8").trim().split(/\r?\n/).map(JSON.parse);
  const assigned = new Map(registry.filter(row => row.batchId === batchId).map(row => [row.abilityId, row]));
  const catalog = loadCatalog(root), cards = new Map(catalog.map(card => [String(card.id), card]));
  const existing = require(path.join(root, "ability-definitions.js"));
  const existingById = new Map(existing.map(definition => [definition.id, definition]));
  const seenIds = new Set(), newIds = new Set(), alreadyPresentIds = new Set();
  for (const definition of contribution) {
    if (!definition || typeof definition.id !== "string" || seenIds.has(definition.id)) throw new Error(`Missing or duplicate ability ID in contribution: ${definition?.id || "<missing>"}`);
    seenIds.add(definition.id);
    const row = assigned.get(definition.id), card = cards.get(String(definition.cardId));
    if (!row || String(row.cardId) !== String(definition.cardId)) throw new Error(`${definition.id} is outside ${batchId}.`);
    if (!card || !definition.printedText || !String(card.text || "").includes(definition.printedText)) throw new Error(`${definition.id} does not preserve exact catalog text.`);
    const hasStructuredProgram = Array.isArray(definition.effects) && definition.effects.length > 0 ||
      definition.kind === "CONT" && [definition.continuousEffects, definition.keywords, definition.continuousRestrictions, definition.clanIdentityEffects]
        .some(program => Array.isArray(program) && program.length > 0);
    if (!definition.source?.patternId || !hasStructuredProgram) throw new Error(`${definition.id} lacks reviewed source metadata or a structured effect program.`);
    if (definition.kind === "AUTO" && (!definition.trigger?.eventType || !definition.trigger?.subject || !definition.requiredLocation?.length)) throw new Error(`${definition.id} lacks a structured AUTO trigger or source location.`);
    if (definition.kind === "ACT" && (!definition.requiredLocation?.length || !definition.choicesReviewed || !definition.costsReviewed && definition.costs?.length)) throw new Error(`${definition.id} lacks ACT location, choice, or cost review.`);
    if (definition.kind === "CONT" && !definition.requiredLocation?.length && !definition.keywords?.length && !definition.continuousRestrictions?.length && !definition.continuousEffects?.length && !definition.clanIdentityEffects?.length) throw new Error(`${definition.id} lacks CONT scope metadata.`);
    if (existingById.has(definition.id)) {
      if (!isDeepStrictEqual(existingById.get(definition.id), definition)) throw new Error(`Conflicting definition already exists for ability ID: ${definition.id}`);
      alreadyPresentIds.add(definition.id);
      continue;
    }
    newIds.add(definition.id);
  }

  if (!newIds.size) return { batchId, integratedAbilityIds: [], alreadyPresentAbilityIds: [...alreadyPresentIds].sort(), count: 0 };

  const definitionsPath = path.join(root, "ability-definitions.js");
  const source = fs.readFileSync(definitionsPath, "utf8");
  const declaration = /\bconst\s+definitions\s*=\s*\[/g.exec(source);
  if (!declaration) throw new Error("Could not locate the curated definition array.");
  const arrayOpen = declaration.index + declaration[0].lastIndexOf("[");
  const arrayClose = findMatchingArrayClose(source, arrayOpen);
  if (arrayClose < 0) throw new Error("Could not find the trusted definition-array insertion point.");
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const definitionsToAppend = contribution.filter(definition => newIds.has(definition.id));
  const formatted = definitionsToAppend.map(definition => JSON.stringify(definition, null, 2).split("\n").map(line => `    ${line}`).join(newline)).join(`,${newline}`);
  const arrayBody = source.slice(arrayOpen + 1, arrayClose).trimEnd();
  const separator = arrayBody && !arrayBody.endsWith(",") ? `,${newline}` : newline;
  const updated = `${source.slice(0, arrayOpen + 1)}${arrayBody}${separator}${formatted}${newline}  ${source.slice(arrayClose)}`;
  const temporary = `${definitionsPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, updated, { flag: "wx" });
  try { fs.renameSync(temporary, definitionsPath); }
  catch (error) { fs.rmSync(temporary, { force: true }); throw error; }
  return { batchId, integratedAbilityIds: [...newIds].sort(), alreadyPresentAbilityIds: [...alreadyPresentIds].sort(), count: newIds.size };
}

if (require.main === module) {
  const args = process.argv.slice(2), batchId = args.shift(), abilityIds = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--ability" && args[index + 1]) abilityIds.push(args[++index]);
    else throw new Error(`Unknown option: ${args[index]}`);
  }
  try { process.stdout.write(`${JSON.stringify(integrateContribution(path.resolve(__dirname, ".."), batchId, { abilityIds: abilityIds.length ? abilityIds : null }), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { integrateContribution, isValidWorkUnitId, findMatchingArrayClose };
