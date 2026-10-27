"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parentPort } = require("node:worker_threads");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));

parentPort.on("message", ({ shardId, cards, stageDirectory, evidence }) => {
  if (shardId === "__stop__") { parentPort.close(); return; }
  try {
    const evidenceByAbility = new Map((evidence || []).map(record => [String(record.abilityId), record]));
    const records = [];
    const counters = { cards: 0, parsed: 0, cardsWithAbilities: 0, cardsWithPassingEvidence: 0, implementedCards: 0, fullyVerifiedCards: 0, unsupportedCards: 0, failedCards: 0, awaitingReviewCards: 0, abilityBlocks: 0, implementedAbilities: 0, validatedAbilities: 0, fullyVerifiedAbilities: 0, unsupportedAbilities: 0, failedAbilities: 0, invalidDefinitions: 0 };
    for (const card of cards) {
      const cardId = String(card.id || "");
      const abilities = engine.parseCardAbilitiesCached(card);
      counters.cards++;
      counters.parsed++;
      if (abilities.length) counters.cardsWithAbilities++;
      let everyAbilityVerified = abilities.length > 0;
      let hasEvidence = false;
      let cardImplemented = abilities.length > 0, hasUnsupported = false, hasFailure = false, hasAwaitingReview = false;
      for (const ability of abilities) {
        counters.abilityBlocks++;
        const definition = ability.definition || null;
        const record = evidenceByAbility.get(String(ability.id));
        const errors = [];
        if (definition && definition.cardId !== cardId) errors.push("card-definition-mismatch");
        if (definition && definition.kind !== ability.kind) errors.push("ability-kind-mismatch");
        if (definition && ability.kind === "AUTO" && ability.trigger?.status !== "recognized-trigger") errors.push("unrecognized-auto-trigger");
        if (definition && ability.conditionStatus === "needs-review") errors.push("unmodeled-condition");
        if (definition && ability.costStatus === "needs-review") errors.push("unmodeled-cost");
        if (definition && ["AUTO", "ACT"].includes(ability.kind) && ability.choiceStatus === "needs-review") errors.push("unmodeled-choice");
        const structuredContinuous = ability.kind === "CONT" && (definition?.keywords?.length || definition?.continuousRestrictions?.length);
        if (definition && !definition.effects?.length && !structuredContinuous) errors.push("missing-effect-program");
        const compiled = Boolean(definition);
        const fullyVerified = record?.status === "fully-verified" && record.fullyVerified === true;
        const validated = compiled && errors.length === 0 && (record?.status === "tests-passing" || fullyVerified);
        if (compiled && errors.length === 0) counters.implementedAbilities++; else cardImplemented = false;
        if (validated) counters.validatedAbilities++;
        if (fullyVerified) counters.fullyVerifiedAbilities++;
        if (!compiled) { counters.unsupportedAbilities++; hasUnsupported = true; hasAwaitingReview = true; }
        if (errors.length) { counters.failedAbilities++; hasFailure = true; cardImplemented = false; }
        if (errors.length) counters.invalidDefinitions++;
      if (record?.status === "tests-passing" || fullyVerified) hasEvidence = true;
        if (!fullyVerified || errors.length || !compiled) everyAbilityVerified = false;
        records.push({ cardId, abilityId: String(ability.id), abilityKind: ability.kind, definitionId: definition?.id || null, patternId: definition?.source?.patternId || null, status: errors.length ? "failed-validation" : fullyVerified ? "fully-verified" : compiled ? "compiled-unverified" : "unsupported", errors, evidenceStatus: record?.status || "none", testFiles: record?.testFiles || [] });
      }
      if (hasEvidence) counters.cardsWithPassingEvidence++;
      if (cardImplemented && !hasFailure) counters.implementedCards++;
      if (everyAbilityVerified) counters.fullyVerifiedCards++;
      if (hasUnsupported) counters.unsupportedCards++;
      if (hasFailure) counters.failedCards++;
      if (hasAwaitingReview) counters.awaitingReviewCards++;
    }
    const file = path.join(stageDirectory, `${shardId}.json`);
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, shardId, cardIds: cards.map(card => String(card.id || "")), counters, records }), { flag: "wx" });
    fs.renameSync(temporary, file);
    parentPort.postMessage({ ok: true, shardId, counters, recordCount: records.length, cardIds: cards.map(card => String(card.id || "")) });
  } catch (error) {
    parentPort.postMessage({ ok: false, shardId, error: error.message });
  }
});
