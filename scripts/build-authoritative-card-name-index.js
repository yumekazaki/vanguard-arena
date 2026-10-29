"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadCatalog } = require("./audit-ability-catalog.js");

const root = path.resolve(__dirname, "..");
const entries = loadCatalog(root)
  .map(card => [String(card.id || ""), String(card.name || "")])
  .filter(([id, name]) => id && name)
  .sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }));
if (new Set(entries.map(([id]) => id)).size !== entries.length) throw new Error("Card catalog contains duplicate card IDs.");
const body = JSON.stringify(Object.fromEntries(entries));
const output = `(function registerAuthoritativeCardNameIndex(root) {\n  const byId = Object.freeze(${body});\n  const api = Object.freeze({ byId, get: cardId => byId[String(cardId || "")] || null });\n  if (root) root.VanguardCardNameIndex = api;\n  if (typeof module === "object" && module.exports) module.exports = api;\n})(typeof globalThis === "undefined" ? this : globalThis);\n`;
const destination = path.join(root, "card-authoritative-names.js");
const temporary = `${destination}.${process.pid}.tmp`;
fs.writeFileSync(temporary, output, { flag: "wx" });
fs.renameSync(temporary, destination);
process.stdout.write(`Wrote ${entries.length} authoritative card names (${Buffer.byteLength(output)} bytes).\n`);
