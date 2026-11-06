"use strict";

// D-BT10/067EN, Steam Hunter, Zuqaqip.
// This is a passive CONT ability. It deliberately has no trigger, cost, or
// activation choice; the power and shield clauses are scoped to their own
// circles and use exact Vanguard-name equality.
module.exports = [
  {
    id: "cfa-10867:0",
    cardId: "cfa-10867",
    kind: "CONT",
    printedText: 'CONT [RC/GC]: If your vanguard is "Xeno Almajestar, Astroea=Bico Masques", this unit gets power +5000 / shield +5000. (Active on opponent’s turn too)',
    requiredLocation: ["rear-guard", "guardian"],
    conditionsReviewed: true,
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      officialCardNumber: "D-BT10/067EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F067EN&expansion=203",
      patternId: "cont-rc-gc-exact-vanguard-name-power-shield-v1",
      review: "Exact catalog text for D-BT10/067EN, cross-referenced to Bushiroad’s individual card listing. The source gets +5000 power only while on RC and +5000 shield only while on GC, while its controller’s Vanguard name exactly equals the printed name. The parenthetical makes the ability active during either player’s turn."
    },
    effects: [
      {
        op: "continuous-power",
        target: "source",
        amount: 5000,
        duration: "continuous",
        location: "rear-guard",
        condition: { op: "controller-vanguard-card-name-equals", name: "Xeno Almajestar, Astroea=Bico Masques" }
      },
      {
        op: "continuous-shield",
        target: "source",
        amount: 5000,
        duration: "continuous",
        location: "guardian",
        condition: { op: "controller-vanguard-card-name-equals", name: "Xeno Almajestar, Astroea=Bico Masques" }
      }
    ]
  }
];
