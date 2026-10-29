"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const SOURCE_EXTENSION = /\.(?:js|cjs|mjs|ts|html|sql)$/i;
const EXCLUDED_DIRECTORIES = new Set([".git", ".card-pipeline", "node_modules"]);

function sourceValidationDigest(directory) {
  const root = path.resolve(directory);
  const files = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && SOURCE_EXTENSION.test(entry.name)) {
        files.push({ file, relative: path.relative(root, file).split(path.sep).join("/") });
      }
    }
  };
  walk(root);
  files.sort((left, right) => left.relative < right.relative ? -1 : left.relative > right.relative ? 1 : 0);
  const hash = createHash("sha256");
  for (const entry of files) {
    const normalizedText = fs.readFileSync(entry.file, "utf8").replace(/\r\n?/g, "\n");
    hash.update(entry.relative).update("\0").update(normalizedText).update("\0");
  }
  return hash.digest("hex");
}

module.exports = { sourceValidationDigest };
