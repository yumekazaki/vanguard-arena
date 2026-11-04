"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeAbilityEvidence, resolveTrustedAbilities } = require("./record-ability-test-evidence.js");
const path = require("node:path");

test("ability evidence updates append regression coverage without deleting prior tests", () => {
  const merged = mergeAbilityEvidence({
    status: "tests-passing",
    testFiles: ["older.test.js"],
    testCases: ["older case"]
  }, {
    status: "tests-passing",
    testFiles: ["newer.test.js", "older.test.js"],
    testCases: ["newer case", "older case"],
    fullyVerified: false,
    remaining: "Ability-level evidence only."
  });

  assert.deepEqual(merged.testFiles, ["older.test.js", "newer.test.js"]);
  assert.deepEqual(merged.testCases, ["older case", "newer case"]);
  assert.equal(merged.status, "tests-passing");
  assert.equal(merged.fullyVerified, false);
});

test("ability-level evidence refresh cannot downgrade a fully verified card record", () => {
  const merged = mergeAbilityEvidence({
    status: "fully-verified",
    testFiles: ["whole-card.test.js"],
    testCases: ["all abilities pass"],
    fullyVerified: true,
    remaining: null
  }, {
    status: "tests-passing",
    testFiles: ["focused.test.js"],
    testCases: ["focused ability passes"],
    fullyVerified: false,
    remaining: "Ability-level evidence only."
  });

  assert.deepEqual(merged.testFiles, ["whole-card.test.js", "focused.test.js"]);
  assert.deepEqual(merged.testCases, ["all abilities pass", "focused ability passes"]);
  assert.equal(merged.status, "fully-verified");
  assert.equal(merged.fullyVerified, true);
  assert.equal(merged.remaining, null);
});

test("evidence recorder accepts only trusted catalog-backed definitions, including reusable attack grammars", () => {
  const root = path.resolve(__dirname, "..");
  const ids = ["cfa-2637:0", "cfa-3079:0", "cfa-4210:0", "cfa-4216:1", "cfa-4456:0", "cfa-4752:0", "cfa-2000:1", "cfa-2173:1", "cfa-2239:2", "cfa-2271:2"];
  const abilities = resolveTrustedAbilities(root, ids);
  assert.deepEqual([...abilities.keys()].sort(), [...ids].sort());
  for (const ability of abilities.values()) assert.ok([
    "auto-own-vanguard-attack-paid-power-battle-v1",
    "auto-vanguard-attack-retire-friendly-rearguard-cost-battle-modifier-v1"
  ].includes(ability.definition.source.patternId));
  for (const abilityId of ids.slice(0, 6)) assert.equal(abilities.get(abilityId).definition.source.patternId, "auto-own-vanguard-attack-paid-power-battle-v1");
  for (const abilityId of ids.slice(6)) assert.equal(abilities.get(abilityId).definition.source.patternId, "auto-vanguard-attack-retire-friendly-rearguard-cost-battle-modifier-v1");
  assert.throws(() => resolveTrustedAbilities(root, ["cfa-999999:0"]), /not found in the card catalog/);
});

test("evidence recorder accepts reviewed CONT definitions without requiring an AUTO/ACT activation trust entry", () => {
  const root = path.resolve(__dirname, "..");
  const abilities = resolveTrustedAbilities(root, ["cfa-10980:0"]);
  const ability = abilities.get("cfa-10980:0");
  assert.equal(ability.kind, "CONT");
  assert.equal(ability.definition.source.patternId, "cont-rc-normal-order-power-v1");
});
