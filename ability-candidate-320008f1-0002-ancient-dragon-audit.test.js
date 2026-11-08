"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const contribution = require("./ability-contributions/batch-CANDIDATE-320008F1-0002.js");
const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const expected = [
  "cfa-8980:0", "cfa-10017:0",
  "cfa-10018:0", "cfa-10018:1",
  "cfa-8981:0", "cfa-8982:0"
];

test("the audit keeps all six unresolved Ancient Dragon sibling abilities explicit", () => {
  assert.equal(contribution.length, 0, "no unsupported definition may enter the executable registry");
  assert.equal(contribution.audit.batchId, "CANDIDATE-320008F1-0002");
  assert.equal(contribution.audit.status, "partial-equip-gauge-family-implemented-with-sibling-effects-unresolved");
  assert.deepEqual(contribution.audit.abilityIds.slice().sort(), expected.slice().sort());
  assert.deepEqual(contribution.audit.unsupportedSiblings.map(item => item.abilityId).sort(), expected.slice().sort());
  assert.equal(contribution.audit.assignedAbilityIds.length, 11);
  assert.deepEqual(contribution.audit.implementedAbilityIds.slice().sort(), ["cfa-10017:1", "cfa-10018:2", "cfa-8980:1", "cfa-8981:1", "cfa-8982:1"].sort());
  assert.deepEqual(contribution.audit.abilityEvidenceIds.slice().sort(), ["cfa-10018:2", "cfa-8980:1", "cfa-8981:1", "cfa-8982:1"].sort());
  assert.deepEqual(contribution.audit.exactTextReviewPendingAbilityIds, ["cfa-10017:1"]);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, []);
  assert.equal(contribution.audit.cards.length, 5);
  for (const record of contribution.audit.cards) {
    assert.equal(cardsById.get(record.cardId)?.name, record.name);
    assert.match(record.officialReference, /^https:\/\/en\.cf-vanguard\.com\//);
    assert.ok(record.cardNumber);
  }
});

test("all catalog source identities and texts are preserved, with unsupported triggers blocked from readiness", () => {
  for (const item of contribution.unsupportedSiblings) {
    const cardId = item.abilityId.split(":")[0];
    const card = cardsById.get(cardId);
    assert.ok(card, `assigned source card ${cardId} exists`);
    const parsed = Engine.parseCardAbilities(card).find(ability => ability.id === item.abilityId);
    assert.ok(parsed, `${item.abilityId} is a catalog ability`);
    assert.equal(parsed.kind, item.kind);
    assert.equal(parsed.printedText, item.catalogPrintedText, `exact local text retained for ${item.abilityId}`);
    assert.equal(parsed.definition, null, `${item.abilityId} has no exact supported definition`);
    assert.ok(item.blocker.length > 80, `specific blocker recorded for ${item.abilityId}`);
    for (const side of ["human", "bot"]) {
      const readiness = Engine.autoAbilityReadiness(parsed);
      assert.equal(readiness.ok, false, `${item.abilityId} must not prompt ${side}: ${JSON.stringify(readiness)}`);
    }
  }
});

test("the shared engine compiles the exact drive-check Equip Gauge family and leaves its siblings unsupported", () => {
  assert.equal(Object.keys(Engine.EFFECT_HANDLERS).includes("attach-top-card-as-equip-gauge"), true);
  const gaugeIds = contribution.audit.implementedAbilityIds;
  for (const id of gaugeIds) {
    const card = cardsById.get(id.split(":")[0]);
    const parsed = Engine.parseCardAbilities(card).find(ability => ability.id === id);
    assert.equal(parsed.definition?.source?.patternId, "auto-rc-drive-trigger-equip-gauge-v1");
    assert.equal(Reducer.supportsServerAbilityEffects(parsed), true, `${id} has an authoritative effect handler`);
    assert.ok(parsed.once, `${id} has its per-turn usage restriction in catalog text`);
    assert.equal(parsed.usageRestriction?.type, "once-per-turn");
  }
  assert.equal(Engine.parseCardAbilities(cardsById.get("cfa-10017")).find(ability => ability.id === "cfa-10017:1").definition.source.officialTextVerified, false);
});

test("a Dinocrowd attack event identifies only that exact source instance for both seats", () => {
  const ability = Engine.parseCardAbilities(cardsById.get("cfa-8981")).find(item => item.id === "cfa-8981:0");
  for (const side of ["human", "bot"]) {
    const controller = `player-${side}`;
    const sourceUid = `dinocrowd-${side}`;
    const event = Engine.createGameEvent({ matchId: `dinocrowd-${side}`, eventSequence: 0 }, {
      type: "unit.attacked",
      actingPlayerId: controller,
      turnPlayerId: controller,
      sourceCardInstanceId: sourceUid,
      sourceOwnerPlayerId: controller,
      sourceControllerPlayerId: controller,
      cardInstanceId: sourceUid,
      subjectCardInstanceId: sourceUid,
      subjectOwnerPlayerId: controller,
      subjectControllerPlayerId: controller,
      attackingCardInstanceIds: [sourceUid],
      previousLocation: side === "human" ? "rear-left" : "rear-right",
      currentLocation: side === "human" ? "rear-left" : "rear-right",
      battleId: `battle-${side}`,
      phase: "battle",
      timingWindow: "attack-declared"
    });
    assert.equal(Engine.eventSubjectMatches(event, sourceUid, "source"), true, `${side}'s own attacker`);
    assert.equal(Engine.eventSubjectMatches(event, `${sourceUid}-copy`, "source"), false, `${side}'s same-name other copy`);
    assert.equal(Engine.autoAbilityReadiness(ability).ok, false, "identity match does not make the unsupported effect resolvable");
  }
});

test("official references and Tyrannolegend errata disclose the catalog text limitations", () => {
  const tyrannolegend = contribution.unsupportedSiblings.find(item => item.abilityId === "cfa-10018:0");
  assert.match(tyrannolegend.officialPrintedText, /your card with "Ancient Dragon" in its card name/);
  assert.match(tyrannolegend.officialPrintedText, /until end of turn/);
  assert.doesNotMatch(tyrannolegend.catalogPrintedText, /until end of turn/);
  assert.match(contribution.audit.errataNote, /official D-VS06 Tyrannolegend text and errata/);
  const babyrex = contribution.unsupportedSiblings.find(item => item.abilityId === "cfa-10017:0");
  assert.equal(babyrex.officialPrintedText, null, "do not claim direct card-text verification when the source page was unavailable");
  assert.match(contribution.audit.provenanceNote, /not marked exact-text verified/);
});
