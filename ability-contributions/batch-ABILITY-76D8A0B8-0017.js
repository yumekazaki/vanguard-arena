"use strict";

const definitions = [
  {
    id: "cfa-11321:0",
    cardId: "cfa-11321",
    kind: "AUTO",
    printedText: "AUTO [RC]: When placed, choose up to one of your other units, and that unit gets power +2000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.placed",
      subject: "source",
      circles: ["rear-guard"]
    },
    conditionsReviewed: true,
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "auto-rc-placement-optional-friendly-power-turn-v1",
      review: "The catalog text is exact. Only this source instance entering an RC triggers it. The controller may choose zero or one other friendly unit; the chosen unit receives the printed +2000 until turn end. The card is listed as the nonstandard Game clan in this snapshot, so this is not a claim of official Bushiroad card provenance."
    },
    effects: [{
      op: "modify-power-target",
      target: "chosen",
      amount: 2000,
      duration: "turn",
      optionalTarget: true,
      targetFilter: { controller: "source-controller", cardType: "unit", excludeSource: true }
    }]
  },
  {
    id: "cfa-11321:1",
    cardId: "cfa-11321",
    kind: "AUTO",
    printedText: "AUTO [RC]: When your vanguard is placed, choose one of your vanguards, and it gets power +5000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.placed",
      subject: "any",
      circles: ["vanguard"],
      subjectControllerRelation: "source-controller"
    },
    conditionsReviewed: true,
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "auto-rc-own-vanguard-placement-vanguard-power-turn-v1",
      review: "The catalog text is exact. This Rear-Guard ability triggers when its controller's Vanguard is placed on VC, not when the opponent's Vanguard or this source is placed. Its controller chooses their Vanguard for the printed +5000 until turn end. The card is listed as the nonstandard Game clan in this snapshot, so this is not a claim of official Bushiroad card provenance."
    },
    effects: [{
      op: "modify-power-target",
      target: "chosen",
      amount: 5000,
      duration: "turn",
      targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" }
    }]
  }
];

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0017",
    auditedAbilityIds: Object.freeze([
      "cfa-11308:0", "cfa-11314:0", "cfa-11314:1", "cfa-11315:0", "cfa-11316:0", "cfa-11316:1",
      "cfa-11317:0", "cfa-11317:1", "cfa-11318:0", "cfa-11319:0", "cfa-11319:1", "cfa-1131:0",
      "cfa-1131:1", "cfa-11320:0", "cfa-11320:1", "cfa-11321:0", "cfa-11321:1", "cfa-11322:0",
      "cfa-11322:1", "cfa-11323:0", "cfa-11324:0", "cfa-11330:0", "cfa-11330:1", "cfa-11331:0",
      "cfa-11331:1", "cfa-11332:0", "cfa-11332:1", "cfa-11332:2", "cfa-11333:0", "cfa-11333:1",
      "cfa-11334:0", "cfa-11334:1", "cfa-11335:0", "cfa-11336:0", "cfa-11337:0", "cfa-11338:0",
      "cfa-11338:1", "cfa-11338:2", "cfa-11339:0", "cfa-11339:1", "cfa-11340:0", "cfa-1134:0"
    ]),
    alreadySupportedAbilityIds: Object.freeze([
      "cfa-11314:0", "cfa-11314:1", "cfa-1131:0", "cfa-1131:1", "cfa-11322:0", "cfa-11322:1",
      "cfa-11330:0", "cfa-11330:1", "cfa-11338:0", "cfa-11338:1", "cfa-11338:2", "cfa-11339:1"
    ]),
    proposedDefinitionIds: Object.freeze(definitions.map(definition => definition.id)),
    blocked: Object.freeze([
      "cfa-11308:0", "cfa-11315:0", "cfa-11316:0", "cfa-11316:1", "cfa-11317:0", "cfa-11317:1",
      "cfa-11318:0", "cfa-11319:0", "cfa-11319:1", "cfa-11320:0", "cfa-11320:1", "cfa-11323:0",
      "cfa-11324:0", "cfa-11331:0", "cfa-11331:1", "cfa-11332:0", "cfa-11332:1", "cfa-11332:2",
      "cfa-11333:0", "cfa-11333:1", "cfa-11334:0", "cfa-11334:1", "cfa-11335:0", "cfa-11336:0",
      "cfa-11337:0", "cfa-11339:0", "cfa-11340:0", "cfa-1134:0"
    ].map(abilityId => Object.freeze({
      abilityId,
      blocker: "No trusted definition and complete regression evidence cover this exact ability text yet; preserve it as unsupported until its trigger, conditions, costs, choices, and effect sequence are reviewed."
    }))),
    provenanceWarnings: Object.freeze([{
      abilityIds: Object.freeze(["cfa-11321:0", "cfa-11321:1"]),
      note: "The source is the local Cardfight Area snapshot. The Game clan card has no official Bushiroad English listing located; its printed catalog text was retained and its straightforward behavior was tested, but official-card provenance is not asserted."
    }])
  })
});

module.exports = definitions;
