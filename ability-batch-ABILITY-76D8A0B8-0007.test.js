"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0007.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_ID = "ABILITY-76D8A0B8-0007";
const EXPECTED_IDS = [
  "cfa-10985:0", "cfa-10986:0", "cfa-10987:0", "cfa-10988:0", "cfa-10989:0", "cfa-10989:1",
  "cfa-10990:0", "cfa-10990:1", "cfa-10991:0", "cfa-10992:0", "cfa-10992:1", "cfa-10992:2",
  "cfa-10992:3", "cfa-1099:0", "cfa-1099:1", "cfa-1099:2", "cfa-1100:0", "cfa-1100:1",
  "cfa-11011:0", "cfa-11012:0", "cfa-11012:1", "cfa-11014:0", "cfa-11015:0", "cfa-11015:1",
  "cfa-11016:0", "cfa-11016:1", "cfa-11016:2", "cfa-11016:3", "cfa-11017:0", "cfa-11017:1",
  "cfa-11017:2", "cfa-11017:3", "cfa-1101:0", "cfa-11021:0", "cfa-11021:1", "cfa-11022:0",
  "cfa-11022:1", "cfa-11023:0", "cfa-11023:1", "cfa-11024:0", "cfa-11024:1", "cfa-11026:0",
  "cfa-11026:1", "cfa-11028:0", "cfa-110:0", "cfa-11:0"
];
const EXISTING_SUPPORT_IDS = contribution.audit.existingProductionSupport;
const BLOCKER_IDS = Object.keys(contribution.audit.blockers);
const catalog = loadCatalog();

function readRegistryRows() {
  return fs.readFileSync(path.join(__dirname, "ability-work-registry.jsonl"), "utf8")
    .trim().split(/\r?\n/).map(JSON.parse).filter(row => row.batchId === BATCH_ID);
}

function getAbility(row) {
  const card = catalog.find(item => String(item.id) === row.cardId);
  assert.ok(card, "catalog card " + row.cardId + " must exist");
  const parsed = Engine.parseCardAbilitiesCached(card).find(item => item.id === row.abilityId);
  assert.ok(parsed, row.abilityId + " must parse from the exact catalog card");
  assert.equal(parsed.kind, row.kind);
  assert.equal(parsed.printedText, row.printedText, row.abilityId + " must preserve exact catalog text");
  return parsed;
}

test("batch inventory and classifications exactly cover the claimed registry IDs", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "ability-work-batches.json"), "utf8"));
  const batch = manifest.batches.find(item => item.batchId === BATCH_ID);
  assert.ok(batch, "the claimed batch must be present");
  assert.equal(batch.workerOwner, "codex-root-ability-76d8a0b8-0007");
  assert.deepEqual([...batch.abilityIds].sort(), [...EXPECTED_IDS].sort());

  const rows = readRegistryRows();
  assert.equal(rows.length, 46);
  assert.deepEqual(rows.map(row => row.abilityId).sort(), [...EXPECTED_IDS].sort());
  assert.equal(rows.filter(row => row.implementationStatus === "unreviewed").length, 37);
  assert.equal(rows.filter(row => row.implementationStatus === "tests-passing").length, 9);
  const expectedBlockers = rows.filter(row => row.implementationStatus === "unreviewed").map(row => row.abilityId);
  assert.deepEqual(BLOCKER_IDS.sort(), expectedBlockers.sort());
  assert.deepEqual([...EXISTING_SUPPORT_IDS].sort(), [
    "cfa-1099:1", "cfa-1099:2", "cfa-1100:0", "cfa-1100:1",
    "cfa-1101:0", "cfa-11016:0", "cfa-11021:1", "cfa-11:0"
  ].sort());
  assert.equal(BLOCKER_IDS.length, 37);
  assert.equal(contribution.audit.counts.assigned, 46);
  assert.equal(contribution.audit.counts.existingProductionSupport, 8);
  assert.deepEqual([...contribution.audit.passiveTargetingSupport], ["cfa-10989:0"]);
  assert.equal(contribution.audit.counts.passiveTargetingSupport, 1);
  assert.equal(contribution.audit.counts.concreteBlockers, 37);
  assert.equal(contribution.audit.counts.testOnlyProposals, 0);
  assert.deepEqual(contribution, [], "audit must not register unsupported runtime definitions");
});

test("the eight existing production abilities retain trusted server definitions", () => {
  const rows = readRegistryRows();
  for (const abilityId of EXISTING_SUPPORT_IDS) {
    const row = rows.find(item => item.abilityId === abilityId);
    assert.ok(row, abilityId + " must be in the batch");
    assert.equal(row.implementationStatus, "tests-passing");
    const ability = getAbility(row);
    assert.ok(ability.definition, abilityId + " must have an existing compiled definition");
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, abilityId + " must be trusted by the server");
  }
});

test("unreviewed abilities stay unsupported until every required mechanic is authoritative", () => {
  const rows = readRegistryRows().filter(row => row.implementationStatus === "unreviewed");
  assert.equal(rows.length, 37);
  for (const row of rows) {
    assert.ok(contribution.audit.blockers[row.abilityId], row.abilityId + " needs a concrete blocker");
    const ability = getAbility(row);
    assert.equal(ability.definition, null, row.abilityId + " must not be compiled as production support");
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(row.cardId).some(item => item.id === row.abilityId), false);
  }
});

test("passive Resist blocks opponent targeting without being offered as a manual ability", () => {
  const row = readRegistryRows().find(item => item.abilityId === "cfa-10989:0");
  assert.ok(row);
  assert.equal(row.implementationStatus, "tests-passing");
  const ability = getAbility(row);
  assert.ok(ability.definition, "the catalog parser currently compiles Resist");
  assert.equal(ability.definition.source.patternId, "cont-rc-cannot-be-chosen-by-opponent-v1");
  const card = catalog.find(item => String(item.id) === row.cardId);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), false);
  assert.equal(Engine.matchesTargetFilter({}, {
    targetCard: card, targetZone: "rear-left", sourceControllerPlayerId: "host", targetControllerPlayerId: "joiner"
  }), false, "the opponent cannot choose this unit on RC");
  assert.equal(Engine.matchesTargetFilter({}, {
    targetCard: card, targetZone: "rear-left", sourceControllerPlayerId: "joiner", targetControllerPlayerId: "joiner"
  }), true, "its controller may still choose it");
  assert.equal(Engine.matchesTargetFilter({}, {
    targetCard: card, targetZone: "hand", sourceControllerPlayerId: "host", targetControllerPlayerId: "joiner"
  }), true, "the RC-only protection ends when it leaves RC");
});

test("unsupported AUTO abilities do not prompt either match seat", () => {
  const cardId = "cfa-11017";
  for (const side of ["host", "joiner"]) {
    const otherSide = side === "host" ? "joiner" : "host";
    const playerId = "player-" + side;
    const otherPlayerId = "player-" + otherSide;
    const vanguard = Engine.createCardInstance(cardId, playerId, "harmonics-" + side, { zone: "vanguard", circle: "vanguard" });
    const otherVanguard = Engine.createCardInstance(cardId, otherPlayerId, "harmonics-" + otherSide, { zone: "vanguard", circle: "vanguard" });
    const state = {
      turn: 1,
      side,
      players: {
        [side]: { playerId, vanguard, rear: [], hand: [], soul: [], damage: [], drop: [], orders: [] },
        [otherSide]: { playerId: otherPlayerId, vanguard: otherVanguard, rear: [], hand: [], soul: [], damage: [], drop: [], orders: [] }
      },
      pendingAbilities: []
    };
    const result = Reducer.discoverAutoTriggers(state, [{
      eventId: "turn-start-" + side,
      type: "turn.started",
      turnPlayerId: playerId,
      actingPlayerId: playerId
    }], Engine);
    assert.deepEqual(result.queued, [], side + " must not receive an unsupported Harmonics Messiah prompt");
    assert.deepEqual(state.pendingAbilities, []);
  }
});

test("official source links are Bushiroad primary sources and cover only this batch", () => {
  const sourceRows = contribution.audit.officialSourceCoverage;
  assert.ok(sourceRows.length >= 10);
  const ids = new Set(EXPECTED_IDS);
  for (const source of sourceRows) {
    assert.match(source.reference, /^https:\/\/en\.cf-vanguard\.com\//);
    assert.ok(source.coverage);
    assert.ok(source.abilityIds.length > 0);
    for (const abilityId of source.abilityIds) assert.ok(ids.has(abilityId), abilityId + " must belong to this batch");
  }
  assert.ok(contribution.audit.catalogDiscrepancies.some(item => item.abilityId === "cfa-1099:2"));
  assert.ok(contribution.audit.catalogDiscrepancies.some(item => item.abilityId === "cfa-11017:0"));
  assert.ok(contribution.audit.noDirectOfficialTextLocated.includes("cfa-11011:0"));
});
