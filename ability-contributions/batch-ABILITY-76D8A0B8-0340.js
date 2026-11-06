"use strict";

module.exports = [{
  id: "cfa-8056:0",
  cardId: "cfa-8056",
  kind: "AUTO",
  printedText: "AUTO [VC]: When placed, look at seven cards from the top of your deck, reveal up to one card with \"Vanquisher\" in its card name from among them and put it into your hand, and shuffle your deck.",
  requiredLocation: ["vanguard"],
  trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["vanguard"] },
  conditions: [],
  conditionsReviewed: true,
  costs: [],
  costsReviewed: true,
  choicesReviewed: true,
  optional: false,
  source: {
    dataset: "Bushiroad official card text",
    snapshotDate: "2026-11-04",
    cardNumber: "D-PV01/327EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PV01%2F327EN",
    patternId: "auto-vanguard-placement-top-seven-card-name-search-v1",
    review: "The exact Chain-bolt Dragoon instance must be placed on VC. Its controller resolves this mandatory AUTO, may select zero or one card containing 'Vanquisher' in its name from the top seven, adds it to hand, and shuffles. The separate bound-from-hand ability is not included in this definition."
  },
  effects: [{ op: "search-top-up-to-one-filtered-to-hand", target: "controller", lookCount: 7, maximum: 1, filter: { cardNameContains: "Vanquisher" } }]
}];
