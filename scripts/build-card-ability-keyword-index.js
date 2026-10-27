"use strict";

const fs = require("node:fs");
const path = require("node:path");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("./audit-ability-catalog.js");

const index = {};
for (const card of loadCatalog()) {
  const keywords = engine.getCardAbilityKeywords(card);
  if (keywords.length) index[String(card.id)] = keywords;
}
const entries = Object.entries(index).sort(([left], [right]) => left.localeCompare(right));
const destination = path.resolve(__dirname, "../card-ability-keywords.js");
const nl = String.fromCharCode(10), body = JSON.stringify(Object.fromEntries(entries), null, 2).split(nl).map(line => `  ${line}`).join(nl);
const output = `(function registerCardAbilityKeywordIndex(root) {${nl}  const index = ${body};${nl}  if (root?.VanguardAbilityEngine) root.VanguardAbilityEngine.registerCardAbilityKeywordIndex(index);${nl}  if (typeof module === "object" && module.exports) module.exports = index;${nl}})(typeof globalThis === "undefined" ? this : globalThis);${nl}`;
const temporary = `${destination}.tmp`;
fs.writeFileSync(temporary, output, { flag: "w" });
JSON.parse(JSON.stringify(index));
fs.renameSync(temporary, destination);
process.stdout.write(`${JSON.stringify({ output: path.basename(destination), cards: entries.length, keywordTags: entries.reduce((count, [, keywords]) => count + keywords.length, 0), vocabulary: [...new Set(entries.flatMap(([, keywords]) => keywords))].sort() }, null, 2)}\n`);
