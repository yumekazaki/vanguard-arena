"use strict";

module.exports = [
  {
    id: "cfa-11839:1",
    cardId: "cfa-11839",
    kind: "CONT",
    printedText: "CONT [RC/GC]: If you have a vanguard with \"Bastion\" in its card name, this unit gets power +10000 / shield +10000. (Active on opponent’s turn too)",
    requiredLocation: ["rear-guard", "guardian"],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "cont-rc-gc-named-vanguard-power-shield-v1",
      review: "Exact dual-circle CONT record. While this card is on RC, the controller's Vanguard name must contain Bastion for +10000 power; while on GC, the same name condition gives +10000 shield. The printed text explicitly applies during the opponent's turn too."
    },
    effects: [
      { op: "continuous-power", target: "source", amount: 10000, duration: "continuous", location: "rear-guard", condition: { op: "controller-vanguard-card-name-contains", name: "Bastion" } },
      { op: "continuous-shield", target: "source", amount: 10000, duration: "continuous", location: "guardian", condition: { op: "controller-vanguard-card-name-contains", name: "Bastion" } }
    ]
  }
];
