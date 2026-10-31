"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { integrateContribution, isValidWorkUnitId } = require("./integrate-ability-contribution.js");

test("work-unit IDs accept legacy, generated, and named primary assignments without allowing paths", () => {
  for (const id of ["ABILITY-0001", "ABILITY-6E4A0DC1-0001", "PRIMARY-AUTO-GLITTER-PLACEMENT-TOP-FIVE"]) {
    assert.equal(isValidWorkUnitId(id), true, id);
  }
  for (const id of ["", "../escape", "ABILITY_0001", "a", "A".repeat(82)]) {
    assert.equal(isValidWorkUnitId(id), false, id);
  }
});

test("integrator accepts a generated registry work-unit ID and preserves exact catalog text", () => {
  const scratch = path.join(path.resolve(__dirname, ".."), ".card-pipeline");
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, "ability-contribution-integration-"));
  const workUnitId = "ABILITY-6E4A0DC1-0001";
  const definition = {
    id: "cfa-10003:0",
    cardId: "cfa-10003",
    kind: "ACT",
    printedText: "ACT [RC]: [Put this unit into your soul], draw a card.",
    requiredLocation: ["rear-guard"],
    choicesReviewed: true,
    costsReviewed: true,
    source: { patternId: "test-exact-contribution-v1" },
    effects: [{ op: "draw", count: 1 }]
  };
  try {
    fs.mkdirSync(path.join(root, "ability-contributions"), { recursive: true });
    fs.mkdirSync(path.join(root, "assets", "cards"), { recursive: true });
    fs.writeFileSync(path.join(root, "ability-contributions", `batch-${workUnitId}.js`), `module.exports = ${JSON.stringify([definition], null, 2)};\n`);
    fs.writeFileSync(path.join(root, "ability-work-registry.jsonl"), `${JSON.stringify({ abilityId: definition.id, cardId: definition.cardId, batchId: workUnitId })}\n`);
    fs.writeFileSync(path.join(root, "assets", "cards", "catalog-data.js"), `window.CARD_CATALOG = ${JSON.stringify([{ id: definition.cardId, text: definition.printedText }])};\n`);
    fs.writeFileSync(path.join(root, "ability-definitions.js"), [
      "(function registerCuratedAbilityBatch(root) {",
      "  const definitions = [",
      `    ${JSON.stringify({ id: "existing:0", cardId: "existing", kind: "CONT", printedText: "CONT: existing.", keywords: [{ name: "test-keyword" }] })},`,
      "  ];",
      "  const otherTrustedArray = [",
      `    ${JSON.stringify({ id: "other:0", cardId: "other", kind: "CONT", printedText: "CONT: other.", keywords: [{ name: "test-keyword" }] })},`,
      "  ];",
      `  definitions.push(${JSON.stringify({ id: "dynamic:0", cardId: "dynamic", kind: "CONT", printedText: "CONT: dynamic.", keywords: [{ name: "test-keyword" }] })});`,
      "  if (root?.VanguardAbilityEngine) root.VanguardAbilityEngine.registerAbilityDefinitions(definitions);",
      "  if (typeof module === \"object\" && module.exports) module.exports = definitions;",
      "})(globalThis);",
      ""
    ].join("\n"));

    const result = integrateContribution(root, workUnitId);
    assert.deepEqual(result.integratedAbilityIds, [definition.id]);
    delete require.cache[require.resolve(path.join(root, "ability-definitions.js"))];
    const integrated = require(path.join(root, "ability-definitions.js"));
    assert.equal(integrated.length, 3, "static, dynamically appended, and contributed definitions all remain present");
    assert.deepEqual(integrated.map(item => item.id), ["existing:0", "cfa-10003:0", "dynamic:0"]);
    assert.match(fs.readFileSync(path.join(root, "ability-definitions.js"), "utf8"), /test-exact-contribution-v1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
