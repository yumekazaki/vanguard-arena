"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0028.js");

const root = __dirname;
const batchId = "ABILITY-76D8A0B8-0004";
const batches = require("./ability-work-batches.json").batches;
const verification = require("./card-verification-manifest.json");
const fullyVerifiedIds = new Set(verification.records
  .filter(record => record.status === "fully-verified" && record.fullyVerified === true)
  .map(record => record.abilityId));
const outstandingIds = audit.abilityIds.filter(id => !fullyVerifiedIds.has(id));
const verifiedIds = audit.abilityIds.filter(id => fullyVerifiedIds.has(id));
const batch = batches.find(item => item.batchId === batchId);
const catalog = loadCatalog(root);
const cards = new Map(catalog.map(card => [String(card.id), card]));
const parsed = new Map(catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).map(ability => [ability.id, ability])));
const expectedSupportedIds = ["cfa-10746:0", "cfa-10756:0", "cfa-10758:1", "cfa-10760:1", "cfa-1076:0"];
const expectedOfficialReviewIds = [
  "cfa-10742:0", "cfa-10742:1", "cfa-10743:0", "cfa-10744:0", "cfa-10744:1",
  "cfa-10745:0", "cfa-10745:1", "cfa-10746:0", "cfa-10752:0", "cfa-10753:0",
  "cfa-10754:0", "cfa-10755:0", "cfa-10757:0", "cfa-10761:0", "cfa-10761:1",
  "cfa-10765:0", "cfa-10765:1", "cfa-10766:0", "cfa-1076:0"
];

test("batch 0028 preserves all 33 audited IDs while the active queue excludes verified abilities", () => {
  assert.ok(batch, "assigned batch exists in ability-work-batches.json");
  assert.equal(audit.batchId, batchId);
  assert.equal(audit.abilityIds.length, 33);
  assert.equal(new Set(audit.abilityIds).size, 33);
  assert.deepEqual(verifiedIds.sort(), ["cfa-10746:0", "cfa-10756:0"]);
  assert.deepEqual([...outstandingIds].sort(), [...batch.abilityIds].sort());
  const assignment = require("./ability-work-assignments.json").assignments.find(item => item.batchId === batchId);
  assert.ok(assignment);
  assert.ok(outstandingIds.every(id => assignment.abilityIds.includes(id)));
  for (const id of verifiedIds) {
    const record = verification.records.find(item => item.abilityId === id);
    assert.equal(record?.status, "fully-verified", `${id} was removed only after whole-card verification`);
    assert.equal(record?.fullyVerified, true, `${id} retains whole-card verification evidence`);
  }
  assert.deepEqual([...audit.alreadySupportedAbilityIds].sort(), expectedSupportedIds);
  assert.equal(audit.supportedDefinitions.length, 5);
  assert.equal(audit.unsupportedSiblings.length, 28);
  assert.deepEqual(audit.proposedDefinitions, []);
});

test("each supported ability has its exact catalog text and an authoritative runtime handler", () => {
  for (const item of audit.supportedDefinitions) {
    const ability = parsed.get(item.abilityId);
    assert.ok(ability, item.abilityId);
    assert.equal(ability.cardId, item.abilityId.slice(0, item.abilityId.lastIndexOf(":")));
    assert.equal(item.printedText, ability.printedText);
    assert.equal(ability.definition?.id, item.abilityId);
    const runtimeHandlerSupported = ability.kind === "CONT"
      ? Engine.evaluateContinuousEffects([ability], { location: "rear-guard", isControllerTurn: true, dragontreeMarkerCount: 1, sourceInstanceId: "source", targetInstanceId: "source" }).power > 0
      : Reducer.supportsServerAbilityEffects(ability);
    assert.equal(runtimeHandlerSupported, true, item.abilityId);
    assert.equal(item.serverHandlerSupported, true);
  }
  assert.deepEqual([...audit.supportedDefinitions.map(item => item.abilityId)].sort(), expectedSupportedIds);

  const rideSearchTest = fs.readFileSync(path.join(root, "ability-hand-ride-phase-search-server.test.js"), "utf8");
  const interceptTest = fs.readFileSync(path.join(root, "ability-clan-intercept-shield-server.test.js"), "utf8");
  assert.match(rideSearchTest, /cfa-10758/);
  assert.match(rideSearchTest, /cfa-10760/);
  assert.match(interceptTest, /cfa-1076/);
});

test("all other batch abilities remain explicitly unsupported with exact catalog wording and a blocker", () => {
  const supported = new Set(expectedSupportedIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(blocked.size, 28);
  for (const abilityId of audit.abilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, abilityId + " is still present in the card catalog");
    assert.equal(ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    const card = cards.get(ability.cardId);
    assert.ok(card, abilityId + " has a source card");
    if (supported.has(abilityId)) continue;

    const item = blocked.get(abilityId);
    assert.ok(item, abilityId + " has a review record");
    assert.equal(item.catalogPrintedText, ability.printedText, abilityId + " preserves exact catalog text");
    assert.equal(ability.definition, null, abilityId + " is not silently compiled");
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, abilityId + " is not authoritative");
    assert.ok(item.blocker.length > 50, abilityId + " documents the missing rule/handler behavior");
  }
  assert.deepEqual([...blocked.keys()].sort(), audit.abilityIds.filter(id => !supported.has(id)).sort());
});

test("official-source review is attached only to batch skills whose card text was checked", () => {
  assert.deepEqual([...audit.officialTextReviewedAbilityIds].sort(), [...expectedOfficialReviewIds].sort());
  for (const abilityId of audit.officialTextReviewedAbilityIds) {
    assert.ok(audit.abilityIds.includes(abilityId), abilityId);
    const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
    const url = audit.officialReferences[cardId];
    assert.match(url, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//, abilityId);
    assert.ok(parsed.has(abilityId), abilityId + " was compared against the local ability text");
  }
  for (const item of audit.supportedDefinitions) {
    assert.equal(item.officialTextReviewed, expectedOfficialReviewIds.includes(item.abilityId));
    if (item.officialTextReviewed) assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
  }
  for (const item of audit.unsupportedSiblings) {
    assert.equal(item.officialTextReviewed, expectedOfficialReviewIds.includes(item.abilityId));
  }
  const volheimer = audit.supportedDefinitions.find(item => item.abilityId === "cfa-10756:0");
  assert.ok(volheimer, "Volheimer has a tested ability-level definition in its current primary batch");
  assert.equal(volheimer.officialTextReviewed, false,
    "ability-level handler support does not imply official-text or whole-card verification");
});
