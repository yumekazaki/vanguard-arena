"use strict";

module.exports = [{
  id: "cfa-1818:0",
  cardId: "cfa-1818",
  kind: "CONT",
  printedText: "CONT [VC/RC]: During your turn, if the number of «Murakumo» rear-guards you have is four or more, this unit gets power +3000.",
  requiredLocation: ["vanguard", "rear-guard"],
  conditionsReviewed: true,
  costs: [],
  costsReviewed: true,
  choicesReviewed: true,
  source: {
    dataset: "Cardfight Area snapshot",
    snapshotDate: "2025-05-09",
    patternId: "cont-vc-rc-own-turn-clan-rearguard-count-power-v1",
    review: "Exact catalog wording for Stealth Beast, Chain Geek. The continuous effect applies only to this source instance on VC or RC, only during its controller's turn, and only while at least four distinct controlled Murakumo Rear-Guards are present. The source counts toward four when it is itself on RC; a Vanguard does not count as a Rear-Guard."
  },
  effects: [{
    op: "continuous-power",
    target: "source",
    amount: 3000,
    duration: "continuous",
    condition: {
      op: "all",
      conditions: [
        { op: "controller-turn" },
        { op: "controller-rearguard-clan-count-at-least", clan: "Murakumo", count: 4 }
      ]
    }
  }]
}];
