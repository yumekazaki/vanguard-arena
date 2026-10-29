"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_IDS = [
  "cfa-11867", "cfa-12137", "cfa-12725", "cfa-7450", "cfa-7452", "cfa-7454", "cfa-7616", "cfa-7618", "cfa-7619",
  "cfa-7630", "cfa-7776", "cfa-7778", "cfa-7782", "cfa-7784", "cfa-7852", "cfa-7859", "cfa-7863", "cfa-7866",
  "cfa-7919", "cfa-7928", "cfa-7933", "cfa-7934", "cfa-8034", "cfa-8035", "cfa-8042", "cfa-8044", "cfa-8116"
];
const SENTINEL_PATTERN = "cont-sentinel-keyword-v1";

test("27 single-skill Sentinel Critical Triggers have complete card and passive-keyword definitions", () => {
  const catalog = loadCatalog();
  assert.equal(new Set(CARD_IDS).size, CARD_IDS.length);
  const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
  assert.match(app, /if\s*\(\s*!isG\s*&&\s*isSentinel\(c\)\s*\)\s*sentinels\s*\+=\s*qty/);
  assert.match(app, /if\s*\(sentinels\s*>\s*4\)\s*errors\.push\(`\$\{sentinels\}\/4 Sentinels`\)/);

  for (const cardId of CARD_IDS) {
    const card = catalog.find(row => row.id === cardId);
    assert.ok(card, `${cardId} exists in the imported catalog`);
    assert.equal(card.type, "Trigger", cardId);
    assert.equal(Number(card.grade), 0, cardId);
    assert.equal(String(card.trigger).toLowerCase(), "critical", cardId);
    assert.equal(Number(card.shield), 30000, cardId);
    const abilities = Engine.parseCardAbilitiesCached(card);
    assert.equal(abilities.length, 1, `${cardId} has no unmodeled second skill`);
    const [ability] = abilities;
    assert.equal(ability.printedText, "CONT: Sentinel.", cardId);
    assert.equal(ability.kind, "CONT", cardId);
    assert.equal(ability.definition?.source?.patternId, SENTINEL_PATTERN, cardId);
    assert.deepEqual(ability.definition?.keywords, ["sentinel"], cardId);
    assert.equal(ability.definition?.effects, undefined, cardId);
    assert.equal(ability.trigger, null, cardId);
    assert.equal(Engine.hasAbilityKeyword([ability], "sentinel"), true, cardId);
    assert.equal(Engine.isManuallyActivatable(ability), false, cardId);
    assert.equal(Engine.autoAbilityReadiness(ability).reason, "not-automatic", cardId);
  }
});
