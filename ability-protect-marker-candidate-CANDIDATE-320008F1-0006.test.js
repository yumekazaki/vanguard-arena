"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));

const contribution = require("./ability-contributions/batch-CANDIDATE-320008F1-0006.js");
const expected = [
  ["cfa-11499", 0, "CONT [RC/GC]: If you have three or more protect markers on your circles, this unit gets power +3000 / shield +5000 and \"Boost\", and this unit can intercept from the back row."],
  ["cfa-11499", 1, "CONT [RC]: If the circle this unit is on has a protect marker, this unit cannot be chosen by your opponent’s card effect."],
  ["cfa-11500", 0, "CONT [RC/GC]: If you have three or more protect markers on your circles, this unit gets power +5000 / shield +5000 and \"Intercept\"."],
  ["cfa-11500", 1, "CONT [RC]: If the circle this unit is on has a protect marker, this unit cannot be chosen by your opponent’s card effect."],
  ["cfa-11500", 2, "ACT [Soul]: If you have three or more protect markers on your circles, COST [Discard a card from your hand], call this card to RC, and you may Soul Charge 1."],
  ["cfa-11503", 0, "CONT [RC/GC]: If you have three or more protect markers on your circles, this unit gets power +2000 / shield +5000 and \"Intercept\", and this unit can intercept from the back row."],
  ["cfa-11503", 1, "CONT [RC]: If the circle this unit is on has a protect marker, this unit cannot be chosen by your opponent’s card effect."],
  ["cfa-12727", 0, "CONT [RC/GC]: If you have three or more protect markers on your circles, this unit gets power +5000 / shield +10000 and \"Intercept\"."],
  ["cfa-12727", 1, "CONT [RC]: If the circle this unit is on has a protect marker, this unit cannot be chosen by your opponent’s card effect."],
  ["cfa-12727", 2, "AUTO [RC]: At the end of your turn, if your drop has ten or more normal units, COST [Bind this unit], return all cards from your drop zone to your deck, and shuffle your deck. Then, draw a card."]
];

function abilitiesFor(cardId) {
  const card = loadCatalog().find(item => String(item.id) === cardId);
  assert.ok(card, `catalog card ${cardId} exists`);
  return { card, abilities: Engine.parseCardAbilities(card) };
}

test("the batch preserves and accounts for all ten exact catalog ability blocks", () => {
  assert.equal(expected.length, 10);
  assert.equal(contribution.length, 0, "no ability may be marked supported while its required state/effect is missing");
  assert.deepEqual(contribution.audit.abilityIds, expected.map(([cardId, index]) => `${cardId}:${index}`));

  const seen = new Set();
  for (const [cardId, index, printedText] of expected) {
    const { card, abilities } = abilitiesFor(cardId);
    const ability = abilities[index];
    assert.ok(ability, `${cardId}:${index} parses`);
    assert.equal(ability.id, `${cardId}:${index}`);
    assert.equal(ability.printedText, printedText);
    assert.ok(card.text.includes(printedText), `${cardId}:${index} text matches the source catalog verbatim`);
    if (index === 1) {
      assert.equal(ability.definition?.source?.patternId, "cont-rc-protect-marker-grants-resist-v1", `${cardId}:${index} uses the shared conditional Resist definition`);
    } else {
      assert.equal(ability.definition, null, `${cardId}:${index} remains unreviewed until its own requirements are modeled`);
    }
    seen.add(ability.id);
  }
  assert.equal(seen.size, 10);
  assert.equal(contribution.audit.status, "blocked-on-shared-engine");
  assert.match(contribution.audit.provenanceNote, /Thai-only provenance/i);
});

test("Protect marker continuous abilities fail closed for host and joining-player contexts", () => {
  for (const [cardId, index] of [["cfa-11499", 0], ["cfa-11499", 1], ["cfa-11500", 0], ["cfa-11500", 1], ["cfa-11503", 0], ["cfa-11503", 1], ["cfa-12727", 0], ["cfa-12727", 1]]) {
    const ability = abilitiesFor(cardId).abilities[index];
    assert.equal(ability.kind, "CONT");
    if (index === 1) {
      assert.equal(ability.conditionStatus, "modeled");
      assert.equal(ability.definition?.source?.patternId, "cont-rc-protect-marker-grants-resist-v1");
    } else {
      assert.equal(ability.conditionStatus, "needs-review");
      assert.equal(ability.definition, null);
    }
    if (index === 0) assert.deepEqual(ability.requiredLocation, [], "RC/GC scope is not parsed without a reviewed definition");
    if (index === 1) assert.deepEqual(ability.requiredLocation, ["rear-guard"]);

    const unsupportedConditionDefinition = {
      id: ability.id, cardId, kind: "CONT",
      effects: [{ op: "continuous-power", target: "source", amount: 5000, duration: "continuous", condition: { op: "controller-protect-marker-count-at-least", count: 3 } }],
      continuousEffects: [{ type: "grant-keyword", target: "source", keyword: "intercept", duration: "continuous", condition: { op: "controller-protect-marker-count-at-least", count: 3 } }]
    };
    const hypothetical = { ...ability, definition: unsupportedConditionDefinition };
    for (const playerId of ["host", "joining-player"]) {
      const context = {
        playerId, sourceCardId: cardId, sourceFaceUp: true, sourceLocation: "rear-guard", location: "rear-guard",
        sourceInstanceId: `${playerId}-${cardId}-copy`, targetInstanceId: `${playerId}-${cardId}-copy`,
        controllerProtectMarkerCount: 3, sourceCircleHasProtectMarker: true
      };
      assert.equal(Engine.evaluateContinuousEffects([hypothetical], context).power, 0, `${playerId}: marker count does not pass an unsupported predicate`);
      assert.deepEqual(Engine.evaluateContinuousAbilityKeywords([hypothetical], context), [], `${playerId}: no conditional keyword is granted`);
    }
  }
});

test("the Soul ACT preserves source zone and discard-cost parsing but stays unavailable to either seat", () => {
  const ability = abilitiesFor("cfa-11500").abilities[2];
  assert.equal(ability.kind, "ACT");
  assert.deepEqual(ability.requiredLocation, ["soul"]);
  assert.equal(ability.conditionStatus, "needs-review");
  assert.equal(ability.choiceStatus, "needs-review");
  assert.deepEqual(ability.costs, [{ type: "discard", count: 1 }]);
  assert.equal(Engine.canPayAbilityCosts(ability, { discardableHand: 1 }), true);
  assert.equal(Engine.canPayAbilityCosts(ability, { discardableHand: 0 }), false);

  for (const playerId of ["host", "joining-player"]) {
    const result = Engine.canActivateManualAbility(ability, {
      cardInstanceId: `${playerId}-juran`, controllerPlayerId: playerId,
      actorPlayerId: playerId, turnPlayerId: playerId, phase: "main", inPermittedZone: true,
      alreadyUsed: false, resources: { discardableHand: 1 },
      conditions: { controllerProtectMarkerCount: 3 }
    });
    assert.deepEqual(result, { ok: false, reason: "unsupported-effect" });
  }
});

test("the turn-end AUTO parses the correct window but cannot become pending until condition and cost rules are modeled", () => {
  const ability = abilitiesFor("cfa-12727").abilities[2];
  assert.equal(ability.kind, "AUTO");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.trigger, {
    status: "recognized-trigger", eventType: "turn.ended", subject: "controller",
    circles: [], turnRelation: "controller"
  });
  assert.equal(ability.conditionStatus, "needs-review", "normal-unit Drop counting is not modeled");
  assert.equal(ability.costStatus, "needs-review", "source Bind is not modeled for this AUTO");
  assert.deepEqual(Engine.autoAbilityReadiness(ability), { ok: false, reason: "unsupported-effect" });
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "end", {
    eventId: "host-turn-end", type: "turn.ended", turnPlayerId: "host", phase: "end", timingWindow: "turn-end"
  }, "host-juran-copy", "rear-guard", "rear-guard", "host"), false);
  assert.equal(Engine.eventMatchesAbilityTrigger(ability, "end", {
    eventId: "joiner-turn-end", type: "turn.ended", turnPlayerId: "joining-player", phase: "end", timingWindow: "turn-end"
  }, "host-juran-copy", "rear-guard", "rear-guard", "host"), false);
});

test("Protect marker immunity and all-Drop return cannot be represented by current effect handlers", () => {
  assert.equal(Object.hasOwn(Engine.EFFECT_HANDLERS, "protect-marker-immunity"), false);
  assert.equal(Object.hasOwn(Engine.EFFECT_HANDLERS, "return-all-drop-to-deck-and-shuffle"), false);
  const markerEffect = Engine.validateEffectProgram([
    { op: "protect-marker-immunity", target: "source", controllerOnly: true }
  ], Engine.EFFECT_HANDLERS);
  const returnEffect = Engine.validateEffectProgram([
    { op: "return-all-drop-to-deck-and-shuffle", target: "controller" }
  ], Engine.EFFECT_HANDLERS);
  assert.equal(markerEffect.ok, false);
  assert.equal(returnEffect.ok, false);
});
