"use strict";

const fs = require("node:fs");
const engine = require("../ability-engine.js");
const definitions = require("../ability-definitions.js");
const { loadCatalog } = require("./audit-ability-catalog.js");

const [patternId, expectedCountText] = process.argv.slice(2);
const expectedCount = Number(expectedCountText);
if (!patternId || !Number.isInteger(expectedCount) || expectedCount < 1) {
  throw new Error("Usage: node scripts/append-compiled-pattern-definitions.js <pattern-id> <expected-count>");
}
engine.registerAbilityDefinitions(definitions);
const matches = loadCatalog().flatMap(card => engine.parseCardAbilities(card)
  .filter(ability => ability.definition?.source?.patternId === patternId)
  .map(ability => ability.definition));
if (matches.length !== expectedCount) throw new Error(`Expected ${expectedCount} catalog matches for ${patternId}, found ${matches.length}.`);

const byId = new Map(definitions.map(definition => [definition.id, definition]));
const additions = [];
for (const definition of matches) {
  const existing = byId.get(definition.id);
  if (existing) {
    if (existing.printedText !== definition.printedText || existing.cardId !== definition.cardId) {
      throw new Error(`Conflicting reviewed definition ${definition.id}.`);
    }
    continue;
  }
  byId.set(definition.id, definition);
  additions.push(definition);
}
if (!additions.length) throw new Error(`No new definitions to add for ${patternId}.`);
engine.registerAbilityDefinitions(additions);

const all = [...definitions, ...additions];
const nl = String.fromCharCode(10);
const body = JSON.stringify(all, null, 2).split(nl).map(line => `  ${line}`).join(nl);
const output = `(function registerCuratedAbilityBatch(root) {${nl}  const definitions = ${body};${nl}  if (root?.VanguardAbilityEngine) root.VanguardAbilityEngine.registerAbilityDefinitions(definitions);${nl}  if (typeof module === "object" && module.exports) module.exports = definitions;${nl}})(typeof globalThis === "undefined" ? this : globalThis);${nl}`;
const destination = require("node:path").resolve(__dirname, "../ability-definitions.js");
const temporary = `${destination}.tmp`;
fs.writeFileSync(temporary, output);
const arrayStart = output.indexOf("[");
JSON.parse(output.slice(arrayStart, output.lastIndexOf("];") + 1));
fs.renameSync(temporary, destination);
process.stdout.write(`Added ${additions.length} of ${matches.length} exact matches for ${patternId}; ${all.length} reviewed definitions total.\n`);
