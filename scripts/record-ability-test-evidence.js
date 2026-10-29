"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function atomicWrite(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents, { flag: "wx" });
  try { fs.renameSync(temporary, file); }
  catch (error) { fs.rmSync(temporary, { force: true }); throw error; }
}

function recordPassingEvidence(root, abilityIds, testFiles) {
  if (!Array.isArray(abilityIds) || !abilityIds.length || new Set(abilityIds).size !== abilityIds.length) throw new TypeError("Supply unique ability IDs.");
  if (!Array.isArray(testFiles) || !testFiles.length) throw new TypeError("Supply at least one test file.");
  const absoluteFiles = testFiles.map(file => path.resolve(root, file));
  for (const file of absoluteFiles) if (!fs.existsSync(file)) throw new Error(`Missing test file: ${path.relative(root, file)}`);
  const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...absoluteFiles], { cwd: root, encoding: "utf8", windowsHide: true });
  if (run.status !== 0) throw new Error(`Evidence tests failed (exit ${run.status}).\n${run.stdout || ""}\n${run.stderr || ""}`);
  const testCases = [...`${run.stdout || ""}\n${run.stderr || ""}`.matchAll(/^ok \d+ - (.+)$/gm)].map(match => match[1].trim());
  if (!testCases.length) throw new Error("Test command passed but did not report any passing TAP cases.");

  const definitions = require(path.join(root, "ability-definitions.js"));
  const definitionById = new Map(definitions.map(definition => [definition.id, definition]));
  const manifestPath = path.join(root, "card-verification-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.records)) throw new Error("Verification manifest has no record array.");
  const now = new Date().toISOString();
  for (const abilityId of abilityIds) {
    const definition = definitionById.get(abilityId);
    if (!definition) throw new Error(`Ability ${abilityId} is not in the trusted production registry.`);
    const cardId = String(definition.cardId);
    const testSource = absoluteFiles.map(file => fs.readFileSync(file, "utf8")).join("\n");
    if (!testSource.includes(cardId)) throw new Error(`No test reference found for ${abilityId}.`);
    const record = {
      cardId,
      abilityId,
      status: "tests-passing",
      testFiles: testFiles.map(file => file.replace(/\\/g, "/")),
      testCases,
      fullyVerified: false,
      remaining: "Ability-level regression evidence only; whole-card verification requires every other printed ability and relevant rules interactions to pass."
    };
    const index = manifest.records.findIndex(existing => existing.abilityId === abilityId);
    if (index < 0) manifest.records.push(record);
    else manifest.records[index] = { ...manifest.records[index], ...record };
  }
  manifest.evidenceUpdatedAt = now;
  atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { abilityIds, testFiles, testCases: testCases.length, tests: testCases };
}

if (require.main === module) {
  const args = process.argv.slice(2), optionValues = name => {
    const values = [];
    for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) values.push(args[++i]);
    return values;
  };
  try {
    const result = recordPassingEvidence(path.resolve(__dirname, ".."), optionValues("--ability"), optionValues("--test"));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { recordPassingEvidence };
