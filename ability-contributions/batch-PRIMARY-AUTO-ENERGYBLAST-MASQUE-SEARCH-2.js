"use strict";

module.exports = {
  batchId: "PRIMARY-AUTO-ENERGYBLAST-MASQUE-SEARCH-2",
  proposedDefinitions: [
    {
      id: "cfa-13489:0",
      cardId: "cfa-13489",
      kind: "AUTO",
      printedText: "AUTO: When this unit is placed on RC, COST [Energy Blast 3], search your deck for up to one \"Masque of Hydragrum\", reveal it and put it into hand, and shuffle the deck.",
      requiredLocation: ["rear-guard"],
      trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] },
      costs: [{ type: "energy-blast", count: 3 }],
      conditionsReviewed: true,
      costsReviewed: true,
      choicesReviewed: true,
      optional: false,
      effects: [{ op: "search-deck-same-name-to-hand", target: "controller", maximum: 1, cardName: "Masque of Hydragrum" }],
      source: {
        dataset: "Bushiroad official card list",
        cardNumber: "DZ-BT06/036EN",
        officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2F036EN",
        officialTextVerified: true,
        patternId: "auto-rc-placement-energy-blast-masque-search-v1",
        review: "Exact official AUTO: only this unit's Rear-Guard placement triggers; its controller pays Energy Blast 3, searches their deck for up to one Masque of Hydragrum, reveals and adds it to hand, then shuffles."
      }
    },
    {
      id: "cfa-13624:0",
      cardId: "cfa-13624",
      kind: "AUTO",
      printedText: "AUTO: When this unit is placed on RC, COST [Energy Blast 3], search your deck for up to one \"Masque of Hydragrum\", reveal it and put it into hand, and shuffle the deck.",
      requiredLocation: ["rear-guard"],
      trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] },
      costs: [{ type: "energy-blast", count: 3 }],
      conditionsReviewed: true,
      costsReviewed: true,
      choicesReviewed: true,
      optional: false,
      effects: [{ op: "search-deck-same-name-to-hand", target: "controller", maximum: 1, cardName: "Masque of Hydragrum" }],
      source: {
        dataset: "Bushiroad official card list",
        cardNumber: "DZ-BT06/022EN",
        officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2F022EN",
        officialTextVerified: true,
        patternId: "auto-rc-placement-energy-blast-masque-search-v1",
        review: "Exact official AUTO: only this unit's Rear-Guard placement triggers; its controller pays Energy Blast 3, searches their deck for up to one Masque of Hydragrum, reveals and adds it to hand, then shuffles."
      }
    }
  ]
};
