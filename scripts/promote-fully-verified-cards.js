"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const serverReducer = require("../ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./audit-ability-catalog.js");
const { sourceValidationDigest } = require("./source-validation-digest.js");

function suiteIsFresh(root, manifest) {
  const suite = manifest?.latestFullSuite;
  return Boolean(suite?.status === "passed" && suite.failed === 0 && suite.passed === suite.tests &&
    suite.validationInputDigest === sourceValidationDigest(root));
}

function assessCardPromotion({ card, abilities, recordsByAbility, invalidAbilityIds = new Set(), validationEvidenceFresh, root = process.cwd(), readTestFile, isTrustedServerAbility } = {}) {
  const reasons = [];
  const cardId = String(card?.id || "");
  if (!cardId) reasons.push("missing-card-id");
  if (!Array.isArray(abilities) || !abilities.length) reasons.push("card-has-no-parsed-abilities");
  if (validationEvidenceFresh !== true) reasons.push("full-suite-evidence-stale");
  if (!Array.isArray(abilities) || !abilities.length) return { eligible: false, cardId, abilityIds: [], reasons };

  const readFile = readTestFile || (file => fs.readFileSync(path.resolve(root, file), "utf8"));
  for (const ability of abilities) {
    const abilityId = String(ability?.id || "");
    const record = recordsByAbility?.get?.(abilityId);
    if (!abilityId || String(ability.cardId) !== cardId || !ability.definition ||
        String(ability.definition.cardId) !== cardId || ability.definition.id !== abilityId ||
        ability.definition.printedText !== ability.printedText) reasons.push(`${abilityId || "unknown"}:missing-exact-structured-definition`);
    if (invalidAbilityIds.has(abilityId)) reasons.push(`${abilityId}:catalog-audit-failed`);
    if (ability.conditionStatus === "needs-review" || ability.costStatus === "needs-review" || ability.choiceStatus === "needs-review") reasons.push(`${abilityId}:unmodeled-requirement`);
    if (ability.kind === "AUTO" && ability.trigger?.status !== "recognized-trigger") reasons.push(`${abilityId}:unrecognized-trigger`);
    if (!record || !["tests-passing", "fully-verified"].includes(record.status) ||
        !Array.isArray(record.testFiles) || !record.testFiles.length ||
        !Array.isArray(record.testCases) || !record.testCases.length) reasons.push(`${abilityId}:missing-passing-ability-evidence`);
    const remainingWork = String(record?.remaining || "").trim();
    if (remainingWork) {
      reasons.push(`${abilityId}:unresolved-remaining-work`);
      if (/live browser|live match|manual online gameplay|real match still/i.test(remainingWork)) {
        reasons.push(`${abilityId}:explicit-live-gameplay-gap`);
      }
    }

    let sources = "", exactAbilityReferenced = false;
    for (const file of record?.testFiles || []) {
      try {
        const source = readFile(file);
        sources += `\n${source}`;
        if (source.includes(abilityId)) exactAbilityReferenced = true;
      } catch {
        reasons.push(`${abilityId}:missing-test-file:${String(file)}`);
      }
    }
    if (!exactAbilityReferenced) reasons.push(`${abilityId}:tests-do-not-reference-exact-ability-id`);

    if (["AUTO", "ACT"].includes(ability.kind)) {
      const trusted = isTrustedServerAbility ? isTrustedServerAbility(ability) :
        serverReducer.hasTrustedServerAbilityDefinition?.(ability, engine) && serverReducer.supportsServerAbilityEffects?.(ability);
      if (trusted !== true) reasons.push(`${abilityId}:missing-authoritative-server-definition`);
      const testsHost = /\bhost\b/i.test(sources);
      const testsJoiner = /\bguest\b|\bjoin(?:ed|ing) player\b/i.test(sources) || /both\s+(?:players|seats)\b/i.test(sources);
      if (!testsHost || !testsJoiner) reasons.push(`${abilityId}:missing-two-player-seat-coverage`);
    }
  }
  const uniqueReasons = [...new Set(reasons)];
  return {
    eligible: uniqueReasons.length === 0,
    cardId,
    abilityIds: abilities.map(ability => String(ability.id)),
    testFiles: [...new Set(abilities.flatMap(ability => recordsByAbility.get(String(ability.id))?.testFiles || []))].sort(),
    reasons: uniqueReasons
  };
}

function atomicWrite(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents, { flag: "wx" });
  try { fs.renameSync(temporary, file); }
  catch (error) { fs.rmSync(temporary, { force: true }); throw error; }
}

function promoteCards(root, { cardIds = null, apply = false } = {}) {
  const manifestPath = path.join(root, "card-verification-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const catalog = loadCatalog(root);
  const requested = cardIds == null ? null : new Set(cardIds.map(String));
  const report = auditCatalog(catalog);
  const invalidAbilityIds = new Set(report.invalidCompiled.map(item => item.abilityId));
  const recordsByAbility = new Map((manifest.records || []).map(record => [String(record.abilityId), record]));
  const fresh = suiteIsFresh(root, manifest);
  const outcomes = [];
  const now = new Date().toISOString();

  for (const card of catalog) {
    const cardId = String(card.id || "");
    if (requested && !requested.has(cardId)) continue;
    const abilities = engine.parseCardAbilitiesCached(card);
    if (abilities.every(ability => recordsByAbility.get(ability.id)?.status === "fully-verified" && recordsByAbility.get(ability.id)?.fullyVerified === true)) continue;
    const assessment = assessCardPromotion({ card, abilities, recordsByAbility, invalidAbilityIds, validationEvidenceFresh: fresh, root });
    outcomes.push(assessment);
    if (apply && assessment.eligible) {
      for (const abilityId of assessment.abilityIds) {
        const previous = recordsByAbility.get(abilityId);
        const updated = {
          ...previous,
          status: "fully-verified",
          fullyVerified: true,
          remaining: null,
          fullCardVerification: {
            method: "automatic-complete-card-gate-v1",
            verifiedAt: now,
            validationInputDigest: manifest.latestFullSuite.validationInputDigest,
            printedAbilityIds: assessment.abilityIds,
            testFiles: assessment.testFiles
          }
        };
        const index = manifest.records.findIndex(record => String(record.abilityId) === abilityId);
        manifest.records[index] = updated;
        recordsByAbility.set(abilityId, updated);
      }
    }
  }
  if (requested) for (const cardId of requested) if (!catalog.some(card => String(card.id || "") === cardId)) outcomes.push({ eligible: false, cardId, abilityIds: [], reasons: ["card-not-in-catalog"] });
  const eligible = outcomes.filter(outcome => outcome.eligible);
  const result = {
    applied: apply,
    validationEvidenceFresh: fresh,
    eligibleCards: eligible.length,
    promotedCards: apply ? eligible.length : 0,
    promotedAbilities: apply ? eligible.reduce((count, outcome) => count + outcome.abilityIds.length, 0) : 0,
    rejectedCards: outcomes.length - eligible.length,
    rejectionReasons: outcomes.flatMap(outcome => outcome.reasons).reduce((counts, reason) => { counts[reason] = (counts[reason] || 0) + 1; return counts; }, {}),
    eligibleSample: eligible.slice(0, 30).map(({ cardId, abilityIds }) => ({ cardId, abilityIds })),
    rejectedSample: outcomes.filter(outcome => !outcome.eligible).slice(0, 20).map(({ cardId, reasons }) => ({ cardId, reasons }))
  };
  if (apply) {
    manifest.evidenceUpdatedAt = now;
    atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const progress = spawnSync(process.execPath, [path.join(__dirname, "update-card-progress.js")], { cwd: root, encoding: "utf8", windowsHide: true });
    if (progress.status !== 0) throw new Error(`Card progress refresh failed after evidence promotion.\n${progress.stderr || progress.stdout || ""}`);
    result.progressRefreshed = true;
  }
  return result;
}

if (require.main === module) {
  const args = process.argv.slice(2), cardIds = [];
  let apply = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--apply") apply = true;
    else if (args[index] === "--card" && args[index + 1]) cardIds.push(args[++index]);
    else throw new Error(`Unknown option: ${args[index]}`);
  }
  try { process.stdout.write(`${JSON.stringify(promoteCards(path.resolve(__dirname, ".."), { cardIds: cardIds.length ? cardIds : null, apply }), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { assessCardPromotion, promoteCards, suiteIsFresh };
