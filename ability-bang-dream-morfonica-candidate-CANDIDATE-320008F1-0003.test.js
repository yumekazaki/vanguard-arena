"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-CANDIDATE-320008F1-0003.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_IDS = ["cfa-13668", "cfa-13669", "cfa-13670", "cfa-13671"];
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
const byAbilityId = new Map(contribution.unsupportedSiblings.map(item => [item.abilityId, item]));

test("catalog contains all four Morfonica Music Orders and all nine printed ability blocks", () => {
  assert.equal(contribution.batchId, "CANDIDATE-320008F1-0003");
  assert.deepEqual(contribution.map(item => item.id), []);
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, []);

  const actualIds = [];
  for (const cardId of CARD_IDS) {
    const card = catalog.get(cardId);
    assert.ok(card, `missing catalog card ${cardId}`);
    assert.equal(card.type, "Normal Order", cardId);
    assert.match(card.text, /^BanG Dream!\/Morfonica\/Normal Order Music/m, cardId);
    const abilities = Engine.parseCardAbilitiesCached(card);
    const expectedCount = cardId === "cfa-13669" ? 3 : 2;
    assert.equal(abilities.length, expectedCount, cardId);
    for (const ability of abilities) {
      actualIds.push(ability.id);
      assert.equal(byAbilityId.get(ability.id)?.catalogPrintedText, ability.printedText, ability.id);
    }
  }
  assert.equal(actualIds.length, 9);
  assert.deepEqual([...actualIds].sort(), [...contribution.audit.abilityIds].sort());
});

test("no partial ability from this batch is exposed as trusted or manually activatable", () => {
  for (const cardId of CARD_IDS) {
    const abilities = Engine.parseCardAbilitiesCached(catalog.get(cardId));
    for (const ability of abilities) {
      assert.equal(ability.definition, null, ability.id);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, ability.id);
      assert.equal(Engine.isManuallyActivatable(ability), false, ability.id);
      assert.equal(byAbilityId.has(ability.id), true, ability.id);
    }
  }
});

test("recognized attack triggers are Vanguard-controller and event-zone specific for both seats", () => {
  const host = { side: "human", playerId: "host-player", opponentId: "guest-player" };
  const guest = { side: "bot", playerId: "guest-player", opponentId: "host-player" };
  const seats = [host, guest];
  const attackAbilities = CARD_IDS.flatMap(cardId => Engine.parseCardAbilitiesCached(catalog.get(cardId)))
    .filter(ability => ability.trigger?.eventType === "unit.attacked");
  assert.equal(attackAbilities.length, 4);

  for (const seat of seats) {
    for (const ability of attackAbilities) {
      assert.deepEqual(ability.requiredLocation, ["rear-guard"], ability.id);
      assert.equal(ability.trigger.subject, "vanguard", ability.id);
      const sourceUid = `music-${ability.cardId}-${seat.side}`;
      const vanguardUid = `vanguard-${seat.side}`;
      const event = {
        type: "unit.attacked",
        eventId: `own-vanguard-attack-${ability.id}-${seat.side}`,
        sourceCardInstanceId: vanguardUid,
        sourceControllerPlayerId: seat.playerId,
        subjectCardInstanceId: vanguardUid,
        subjectControllerPlayerId: seat.playerId,
        targetLocation: "vanguard",
        currentLocation: "vanguard",
        turnPlayerId: seat.playerId,
        actingPlayerId: seat.playerId,
        attackingCardInstanceIds: [vanguardUid],
        targetCardInstanceIds: [`opposing-vanguard-${seat.side}`]
      };

      // This isolates the trigger matcher from the parser's unresolved cost/choice
      // gates. It verifies event identity only; it does not claim this ability is usable.
      const triggerProbe = {
        ...ability,
        conditionStatus: "no-explicit-condition-detected",
        costStatus: "supported-cost"
      };
      assert.equal(Engine.eventMatchesAbilityTrigger(
        triggerProbe, "attack", event, sourceUid, "rear-left", "vanguard", seat.playerId
      ), true, `${ability.id}/${seat.side}: own Vanguard attack`);
      assert.equal(Engine.eventMatchesAbilityTrigger(
        triggerProbe, "attack", { ...event, subjectCardInstanceId: `rear-guard-${seat.side}` },
        sourceUid, "rear-left", "rear-left", seat.playerId
      ), false, `${ability.id}/${seat.side}: another unit attacks`);
      assert.equal(Engine.eventMatchesAbilityTrigger(
        triggerProbe, "attack", { ...event, subjectControllerPlayerId: seat.opponentId },
        sourceUid, "rear-left", "vanguard", seat.playerId
      ), false, `${ability.id}/${seat.side}: opponent Vanguard attacks`);

      // Production readiness still rejects the real parsed definition, for either seat.
      assert.notEqual(ability.costStatus, "supported-cost", ability.id);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${ability.id}/${seat.side}`);
    }
  }
});

test("unreviewed Music-Order placement triggers fail closed on RC entry for either seat", () => {
  for (const seat of [{ side: "human", playerId: "host-player" }, { side: "bot", playerId: "guest-player" }]) {
    for (const cardId of CARD_IDS) {
      const ability = Engine.parseCardAbilitiesCached(catalog.get(cardId))[0];
      assert.equal(ability.trigger?.status, "needs-review", `${cardId}/${seat.side}`);
      assert.equal(ability.trigger?.eventType, null, `${cardId}/${seat.side}`);
      assert.equal(Engine.eventMatchesAbilityTrigger(
        ability, "place", {
          type: "card.placed",
          eventId: `music-placement-${cardId}-${seat.side}`,
          sourceCardInstanceId: `music-${cardId}-${seat.side}`,
          sourceControllerPlayerId: seat.playerId,
          subjectCardInstanceId: `music-${cardId}-${seat.side}`,
          subjectControllerPlayerId: seat.playerId,
          previousLocation: "order",
          currentLocation: "rear-left",
          turnPlayerId: seat.playerId,
          actingPlayerId: seat.playerId
        }, `music-${cardId}-${seat.side}`, "rear-left", "rear-left", seat.playerId
      ), false, `${cardId}/${seat.side}`);
    }
  }
});
