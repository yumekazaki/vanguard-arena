"use strict";

module.exports = [
  {
    id: "cfa-5264:0",
    cardId: "cfa-5264",
    kind: "CONT",
    printedText: "CONT [RC]: If you have a vanguard with \"Thavas\" in its card name, this unit gets \"CONT [RC]: Resist\".",
    requiredLocation: ["rear-guard"],
    conditions: [{ type: "controller-vanguard-name-contains", value: "Thavas" }],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Bushiroad official card list",
      snapshotDate: "2026-11-04",
      officialCardNumber: "G-BT13/106EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=G-BT13%2F106EN",
      patternId: "cont-rc-named-vanguard-grants-resist-v1",
      review: "Official G-BT13/106EN text confirmed. This exact face-up source gains Resist only while its controller's current Vanguard name contains Thavas. The continuous effect is recalculated from the source instance's current controller, circle, face-up state, and that controller's Vanguard; the separate AUTO on this card is not included."
    },
    continuousEffects: [{
      type: "grant-keyword",
      target: "source",
      keyword: "resist",
      duration: "continuous",
      condition: { op: "controller-vanguard-card-name-contains", name: "Thavas" }
    }]
  }
];
