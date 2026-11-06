"use strict";

module.exports = [
  {
    id: "cfa-10656:0",
    cardId: "cfa-10656",
    kind: "CONT",
    printedText: "CONT [RC/GC]: If you have a vanguard with \"Flagburg\" in its card name, this unit gets power +2000 / shield +5000. (Active on opponent’s turn too)",
    requiredLocation: ["rear-guard", "guardian"],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "cont-rc-gc-named-vanguard-power-shield-v1",
      review: "Exact dual-circle CONT record. While this card is on RC, the controller's Vanguard name must contain Flagburg for +2000 power; while on GC, the same name condition gives +5000 shield. The printed text explicitly applies during the opponent's turn too."
    },
    effects: [
      { op: "continuous-power", target: "source", amount: 2000, duration: "continuous", location: "rear-guard", condition: { op: "controller-vanguard-card-name-contains", name: "Flagburg" } },
      { op: "continuous-shield", target: "source", amount: 5000, duration: "continuous", location: "guardian", condition: { op: "controller-vanguard-card-name-contains", name: "Flagburg" } }
    ]
  },
  {
    id: "cfa-10630:0",
    cardId: "cfa-10630",
    kind: "AUTO",
    printedText: "AUTO: When this unit is placed on RC by a card’s ability, you may Soul Charge 1.",
    requiredLocation: ["rear-guard"],
    conditions: [],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    trigger: {
      status: "recognized-trigger",
      eventType: "card.placed",
      subject: "source",
      circles: ["rear-guard"],
      effectPlacementOnly: true
    },
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "auto-rc-effect-placement-optional-soul-charge-one-v1",
      review: "Exact effect-placement AUTO. This exact unit instance must enter a Rear-Guard Circle during an effect-placement timing window; an ordinary call from hand, placement on another circle, or another unit entering RC does not qualify. The controller may decline or Soul Charge exactly one."
    },
    effects: [{ op: "soul-charge", count: 1 }]
  }
];
