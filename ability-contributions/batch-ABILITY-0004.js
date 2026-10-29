"use strict";

module.exports = [
  {
    id: "cfa-10097:0",
    cardId: "cfa-10097",
    kind: "AUTO",
    printedText: 'AUTO [RC]: When this unit attacks, if you have a vanguard with "Youth" in its card name, COST [Soul Blast 1], and this units gets power +5000 until end of that battle.',
    requiredLocation: ["rear-guard"],
    trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", targetLocation: "vanguard" },
    conditions: [{ type: "controller-vanguard-name-contains", value: "Youth" }],
    conditionsReviewed: true,
    costs: [{ type: "soul-blast", count: 1 }],
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "auto-own-attack-youth-soul-blast-power-battle-v1",
      review: "Exact AUTO on cfa-10097. Only this Rear-Guard's own attack against a Vanguard with a controller Vanguard containing Youth can trigger it. Soul Blast 1 is mandatory; this source gains 5000 only for that battle. Eligibility requires the controller to have the cost before the prompt is created."
    },
    effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]
  }
];
