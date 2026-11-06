"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0009.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

Engine.registerAbilityDefinitions(require("./ability-definitions.js"));

const BATCH_ID = "ABILITY-76D8A0B8-0009";
const EXPECTED_IDS = [
  "cfa-11056:0", "cfa-11056:1", "cfa-11057:0", "cfa-11057:1", "cfa-11058:0", "cfa-11059:0",
  "cfa-11062:0", "cfa-11062:1", "cfa-11063:0", "cfa-11064:0", "cfa-11064:1", "cfa-11065:0",
  "cfa-11066:0", "cfa-11078:0", "cfa-11078:1", "cfa-11079:0", "cfa-11079:1", "cfa-11080:0",
  "cfa-11080:1", "cfa-11081:0", "cfa-11081:1", "cfa-11082:0", "cfa-11082:1", "cfa-11083:0",
  "cfa-11083:1", "cfa-11084:0", "cfa-11084:1", "cfa-11085:0", "cfa-11085:1", "cfa-11086:0",
  "cfa-11086:1", "cfa-11087:0", "cfa-11087:1", "cfa-11088:0", "cfa-11088:1", "cfa-11089:0",
  "cfa-11089:1", "cfa-1108:0", "cfa-11090:0", "cfa-11090:1", "cfa-11091:0", "cfa-11091:1",
  "cfa-11092:0", "cfa-11092:1"
];
const SUPPORTED_IDS = contribution.audit.existingProductionSupport;
const BLOCKER_IDS = Object.keys(contribution.audit.blockers);
const catalog = loadCatalog();
const registryRows = () => fs.readFileSync(path.join(__dirname, "ability-work-registry.jsonl"), "utf8")
  .trim().split(/\r?\n/).map(JSON.parse).filter(row => row.batchId === BATCH_ID);

function getAbility(row) {
  const card = catalog.find(item => String(item.id) === row.cardId);
  assert.ok(card, "catalog card " + row.cardId + " must exist");
  const parsed = Engine.parseCardAbilitiesCached(card).find(item => item.id === row.abilityId);
  assert.ok(parsed, row.abilityId + " must parse from the exact catalog card");
  assert.equal(parsed.kind, row.kind, row.abilityId);
  assert.equal(parsed.printedText, row.printedText, row.abilityId + " retains exact catalog text");
  return parsed;
}

test("batch inventory and per-ability classifications cover only the claimed IDs", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "ability-work-batches.json"), "utf8"));
  const batch = manifest.batches.find(item => item.batchId === BATCH_ID);
  assert.ok(batch, "claimed batch exists");
  assert.equal(batch.workerOwner, "codex-root-ability-76d8a0b8-0009");
  assert.deepEqual(batch.abilityIds.slice().sort(), EXPECTED_IDS.slice().sort());

  const rows = registryRows();
  assert.equal(rows.length, 44);
  assert.deepEqual(rows.map(row => row.abilityId).sort(), EXPECTED_IDS.slice().sort());
  assert.equal(SUPPORTED_IDS.length, 29);
  assert.equal(BLOCKER_IDS.length, 15);
  assert.deepEqual([...SUPPORTED_IDS, ...BLOCKER_IDS].sort(), EXPECTED_IDS.slice().sort());
  assert.deepEqual(contribution, [], "audit-only batch must not register definitions");
  assert.deepEqual(contribution.audit.counts, {
    assigned: 44, existingProductionSupport: 29, concreteBlockers: 15, testOnlyProposals: 0, wholeCardsVerified: 0
  });
});

test("catalog text and compiled production support are exact for 29 non-blocked abilities", () => {
  const rows = registryRows();
  for (const abilityId of SUPPORTED_IDS) {
    const row = rows.find(item => item.abilityId === abilityId);
    assert.ok(row, abilityId);
    assert.equal(row.implementationStatus, "tests-passing", abilityId);
    const ability = getAbility(row);
    assert.ok(ability.definition, abilityId + " has a compiled definition");
    assert.equal(ability.definition.source.patternId, contribution.audit.productionPatterns[abilityId], abilityId);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, abilityId);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(row.cardId).some(item => item.id === abilityId), abilityId);
    if (ability.kind === "AUTO") {
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
    } else if (ability.definition.source.patternId === "cont-card-name-alias-v1") {
      assert.ok(ability.definition.keywords.some(item => item.name === "card-name-alias"), abilityId);
    } else {
      assert.equal(ability.definition.source.patternId, "cont-gc-opponent-grade-shield-v1", abilityId);
      assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "guardian", opponentVanguardGrade: 3 }).shield, 5000, abilityId);
      assert.equal(Engine.evaluateContinuousShieldEffects([ability], { location: "rear-guard", opponentVanguardGrade: 3 }).shield, 0, abilityId);
    }
  }

  for (const abilityId of ["cfa-11078:1", "cfa-11081:1", "cfa-11084:1", "cfa-11087:1", "cfa-11090:1"]) {
    const ability = getAbility(rows.find(item => item.abilityId === abilityId));
    assert.equal(ability.trigger.eventType, "battle.close-step", abilityId);
    assert.equal(ability.trigger.subject, "booster", abilityId + " requires this exact source to boost");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], abilityId);
  }
  for (const abilityId of ["cfa-11079:1", "cfa-11080:1", "cfa-11082:1", "cfa-11083:1", "cfa-11085:1", "cfa-11086:1", "cfa-11088:1", "cfa-11089:1", "cfa-11091:1", "cfa-11092:1"]) {
    const ability = getAbility(rows.find(item => item.abilityId === abilityId));
    assert.equal(ability.kind, "CONT", abilityId);
    assert.equal(ability.trigger, null, abilityId + " is not an automatic prompt");
    assert.deepEqual(ability.requiredLocation, ["guardian"], abilityId);
    assert.equal(Engine.isManuallyActivatable(ability), false, abilityId + " is not an ACT");
  }
});

test("unsupported unique abilities remain absent from the client and authoritative server", () => {
  const rows = registryRows();
  for (const abilityId of EXPECTED_IDS.filter(id => !SUPPORTED_IDS.includes(id) && id !== "cfa-11091:0")) {
    const row = rows.find(item => item.abilityId === abilityId);
    assert.ok(row, abilityId);
    assert.equal(row.implementationStatus, "unreviewed", abilityId);
    assert.ok(contribution.audit.blockers[abilityId]?.length > 40, abilityId + " needs a concrete mechanics blocker");
    const ability = getAbility(row);
    assert.equal(ability.definition, null, abilityId + " is not production support");
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, abilityId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, abilityId);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(row.cardId).some(item => item.id === abilityId), false, abilityId);
  }
  assert.equal(contribution.audit.testOnlyProposals?.length || 0, 0);
});

test("host and joining player cannot activate the unsupported Kheios ACT or partially pay its cost", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const emptyPlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [] });
  for (const side of ["human", "bot"]) {
    const ownerId = side === "human" ? "host-player" : "guest-player";
    const opponentId = side === "human" ? "guest-player" : "host-player";
    const owner = emptyPlayer(ownerId), opponent = emptyPlayer(opponentId);
    const source = { uid: "kheios-" + side, cardId: "cfa-11056", ownerPlayerId: ownerId, controllerPlayerId: ownerId, zone: "vanguard", circle: "vanguard" };
    owner.vanguard = source;
    owner.soul.push({ uid: "named-soul-" + side, cardId: "cfa-11055", ownerPlayerId: ownerId, controllerPlayerId: ownerId });
    const state = {
      matchId: "kheios-unreviewed-act-" + side, stateVersion: 3, turn: 2, phase: 4, side,
      processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
      players: side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner }
    };
    const before = JSON.stringify(state);
    const result = Reducer.applyManualAbilityActivation(state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: "kheios-act-" + side,
      expectedStateVersion: state.stateVersion,
      payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: "cfa-11056:1", selection: {} }
    }, seats, Engine);
    assert.equal(result.ok, false, side + " must reject unreviewed ACT");
    assert.equal(result.reason, "unreviewed-or-wrong-ability", side);
    assert.equal(JSON.stringify(state), before, side + " must not pay costs or partially apply effects");
  }
});

test("official text discrepancy blocks the wrong compiled alias despite its registry status", () => {
  const row = registryRows().find(item => item.abilityId === "cfa-11091:0");
  assert.ok(row);
  assert.equal(row.implementationStatus, "tests-passing", "audit records the existing registry status");
  assert.ok(contribution.audit.blockers[row.abilityId]);
  const ability = getAbility(row);
  assert.equal(ability.definition.source.patternId, "cont-card-name-alias-v1");
  const alias = ability.definition.keywords.find(item => item.name === "card-name-alias")?.value;
  assert.equal(alias, "Serene Maiden Lena");
  assert.equal(contribution.audit.catalogDiscrepancies[0].officialText.includes("Serene Maiden, Lena"), true);
  assert.notEqual(alias, "Serene Maiden, Lena", "do not certify a name alias that differs from official print");
});

test("official-source evidence is primary-source linked and scoped to this batch", () => {
  const idSet = new Set(EXPECTED_IDS);
  assert.ok(contribution.audit.officialSourceCoverage.length >= 10);
  for (const source of contribution.audit.officialSourceCoverage) {
    assert.match(source.reference, /^https:\/\/en\.cf-vanguard\.com\//);
    assert.ok(source.coverage);
    assert.ok(source.abilityIds.length > 0);
    for (const id of source.abilityIds) assert.ok(idSet.has(id), id + " is in this batch");
  }
  for (const gap of contribution.audit.officialTextNotLocated) {
    assert.ok(gap.detail);
    for (const id of gap.abilityIds) assert.ok(idSet.has(id), id + " is in this batch");
  }
  assert.equal(contribution.audit.officialTextNotLocated.length, 4);
});
