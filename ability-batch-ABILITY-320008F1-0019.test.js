"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0019.js").audit;
const assigned = require("./ability-work-batches.json").batches.find(batch => batch.batchId === audit.batchId);
const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));

test("all 33 reserved IDs have exact catalog text and a supported or concrete blocked result", () => {
  assert.ok(assigned);
  assert.deepEqual([...assigned.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.equal(new Set(audit.abilityIds).size, 33);
  assert.deepEqual(audit.proposedDefinitionIds, []);
  assert.deepEqual(audit.alreadySupportedAbilityIds, ["cfa-105:0"]);
  assert.equal(audit.unsupportedSiblings.length, 32);
  assert.equal(audit.officialTextChecked, false);

  const supported = new Set(audit.alreadySupportedAbilityIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  for (const id of audit.abilityIds) {
    const separator = id.lastIndexOf(":");
    const cardId = id.slice(0, separator);
    const card = byCard.get(cardId);
    const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
    assert.ok(ability, `catalog contains ${id}`);
    assert.equal(String(ability.cardId), cardId, id);
    if (supported.has(id)) {
      assert.equal(ability.definition?.id, id, id);
      assert.equal(ability.definition?.cardId, cardId, id);
      assert.equal(ability.definition?.source?.patternId, "auto-ridden-unit-clan-optional-source-call-v1", id);
      assert.equal(ability.definition?.printedText, ability.printedText, id);
    } else {
      assert.equal(ability.definition, null, id);
      const record = blocked.get(id);
      assert.ok(record, `specific blocker exists for ${id}`);
      assert.equal(record.catalogPrintedText, ability.printedText, id);
      assert.ok(record.blocker.length > 80, `concrete blocker exists for ${id}`);
    }
  }
});

test("the only already-supported ability is source-scoped to the ridden White Tiger", () => {
  const ability = Engine.parseCardAbilitiesCached(byCard.get("cfa-105")).find(item => item.id === "cfa-105:0");
  assert.deepEqual(ability.requiredLocation, []);
  assert.equal(ability.definition.trigger.eventType, "card.ridden");
  assert.equal(ability.definition.trigger.subject, "ridden-unit");
  assert.equal(ability.definition.trigger.riderClan, "Nova Grappler");
  assert.deepEqual(ability.definition.effects, [{ op: "call-source-from-soul", target: "source", position: "stand" }]);
  const sourceUid = "white-tiger-copy-1";
  const rideEvent = overrides => Engine.createGameEvent({ matchId: "white-tiger-audit", turn: 1, side: "human" }, {
    type: "card.ridden",
    eventId: "white-tiger-ride-1",
    actingPlayerId: "player-owner",
    turnPlayerId: "player-owner",
    sourceCardInstanceId: "nova-grappler-rider-1",
    sourceCardClan: "Nova Grappler",
    sourceCardClans: ["Nova Grappler"],
    targetCardInstanceIds: [sourceUid],
    targetPreviousLocation: "vanguard",
    targetCurrentLocation: "soul",
    targetLocation: "vanguard",
    previousLocation: "vanguard",
    currentLocation: "soul",
    ...overrides
  });
  const matches = (event, uid = sourceUid) => Engine.eventMatchesAbilityTrigger(ability, "ride", event, uid, "soul", "vanguard", "player-owner");
  assert.equal(matches(rideEvent({})), true, "the correct Nova Grappler rider rode this exact source");
  assert.equal(matches(rideEvent({ sourceCardClan: "Royal Paladin", sourceCardClans: ["Royal Paladin"] })), false, "a different clan does not satisfy the trigger");
  assert.equal(matches(rideEvent({ targetCardInstanceIds: ["other-copy"] })), false, "another copy of the same card does not satisfy the trigger");
  assert.equal(matches(rideEvent({}), "other-copy"), false, "the ability cannot move another source instance");
  assert.match(audit.provenanceNote, /officialTextChecked remains false/);
});
