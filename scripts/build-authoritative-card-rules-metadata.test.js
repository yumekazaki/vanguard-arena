"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadCatalog } = require("./audit-ability-catalog.js");
const { buildAuthoritativeCardRulesMetadata, renderArtifact } = require("./build-authoritative-card-rules-metadata.js");

const root = path.resolve(__dirname, "..");

test("metadata builder rejects duplicate card IDs instead of silently overwriting records", () => {
  assert.throws(() => buildAuthoritativeCardRulesMetadata([
    { id: "same", name: "First" },
    { id: "same", name: "Second" }
  ]), /duplicate card ID: same/);
});

test("generated metadata is deterministic and matches representative local catalog records", () => {
  const cards = loadCatalog(root);
  const generated = buildAuthoritativeCardRulesMetadata(cards);
  const destination = path.join(root, "card-authoritative-rules-metadata.js");
  const artifact = require(destination);
  assert.deepEqual(Object.keys(generated).sort(), Object.keys(artifact.byId).sort());
  assert.equal(renderArtifact(generated), fs.readFileSync(destination, "utf8").replace(/\r\n?/g, "\n"));
  assert.equal(Object.keys(generated).length, cards.length);
  assert.deepEqual(artifact.get("cfa-664"), {
    grade: 2,
    clan: "Royal Paladin",
    clans: ["Royal Paladin"],
    nation: "",
    nations: [],
    type: "Unit",
    name: "Blaster Blade",
    race: "",
    races: ["Human"],
    shield: 5000,
    power: 9000,
    trigger: "",
    hasAutoActCont: true
  });
  assert.deepEqual(artifact.get("cfa-3"), {
    grade: 0,
    clan: "Shadow Paladin",
    clans: ["Shadow Paladin"],
    nation: "",
    nations: [],
    type: "Trigger",
    name: "Abyss Freezer",
    race: "",
    races: ["Angel"],
    shield: 5000,
    power: 5000,
    trigger: "Draw",
    hasAutoActCont: false
  });
  assert.equal(artifact.get("missing-card-id"), null);
  assert.deepEqual(artifact.get("cfa-4187").races, ["Gearoid", "Zodiac Time Beast"]);
  assert.deepEqual(artifact.fields, ["grade", "clan", "clans", "nation", "nations", "type", "name", "race", "races", "shield", "power", "trigger", "hasAutoActCont"]);
});

test("the authoritative match worker loads card rules metadata before constructing the reducer", () => {
  const entrypoint = fs.readFileSync(path.join(root, "supabase/functions/match-worker/index.ts"), "utf8");
  assert.ok(entrypoint.indexOf('import "../../../card-authoritative-rules-metadata.js";') < entrypoint.indexOf('import "../../../ability-server-reducer.js";'));
});
