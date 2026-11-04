"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const SOURCE_DIR = "assets/cards/source-text";
const OUTPUT_FILE = "card-persona-ride-metadata.js";
const decoder = new TextDecoder("windows-1251");

function buildPersonaRideCardIds(sourceDirectory = path.join(root, SOURCE_DIR)) {
  const ids = new Set();
  for (const file of fs.readdirSync(sourceDirectory).filter(name => name.toLowerCase().endsWith(".txt")).sort()) {
    const contents = decoder.decode(fs.readFileSync(path.join(sourceDirectory, file)));
    const starts = [...contents.matchAll(/CardStat\s*=\s*(\d+)/g)];
    for (let index = 0; index < starts.length; index++) {
      const block = contents.slice(starts[index].index, starts[index + 1]?.index ?? contents.length);
      if (/global\.PersonaRide\[CardStat\]\s*=\s*1\b/.test(block)) ids.add(`cfa-${Number(starts[index][1])}`);
    }
  }
  return [...ids].sort((left, right) => Number(left.slice(4)) - Number(right.slice(4)));
}

function renderArtifact(ids) {
  if (!Array.isArray(ids) || ids.some(id => !/^cfa-\d+$/.test(id)) || new Set(ids).size !== ids.length) {
    throw new TypeError("Persona Ride metadata must contain unique Cardfight Area IDs.");
  }
  const sorted = [...ids].sort((left, right) => Number(left.slice(4)) - Number(right.slice(4)));
  return `(function registerPersonaRideMetadata(root) {\n` +
    `  const ids = Object.freeze(${JSON.stringify(sorted)});\n` +
    `  const idSet = new Set(ids);\n` +
    `  const api = Object.freeze({ ids, has: cardId => idSet.has(String(cardId || "")) });\n` +
    `  if (root) root.VanguardPersonaRideMetadata = api;\n` +
    `  if (typeof module === "object" && module.exports) module.exports = api;\n` +
    `})(typeof globalThis === "undefined" ? this : globalThis);\n`;
}

function writeArtifact(ids = buildPersonaRideCardIds(), destination = path.join(root, OUTPUT_FILE)) {
  const output = renderArtifact(ids);
  fs.writeFileSync(destination, output, "utf8");
  return { count: ids.length, bytes: Buffer.byteLength(output), destination };
}

if (require.main === module) {
  const result = writeArtifact();
  process.stdout.write(`Wrote ${result.count} Persona Ride card IDs to ${path.basename(result.destination)}.\n`);
}

module.exports = { OUTPUT_FILE, buildPersonaRideCardIds, renderArtifact, writeArtifact };
