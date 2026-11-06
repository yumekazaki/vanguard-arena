"use strict";

module.exports = [{
  id: "cfa-1830:0",
  cardId: "cfa-1830",
  kind: "AUTO",
  printedText: "AUTO: [Soul Blast 1] When this unit is placed on RC from your deck, if you have a «Shadow Paladin» vanguard, you may pay the cost. If you do, draw a card.",
  requiredLocation: ["rear-guard"],
  trigger: {
    status: "recognized-trigger",
    eventType: "card.placed",
    subject: "source",
    circles: ["rear-guard"],
    sourceLocation: "deck",
    destinationLocation: "rear-guard"
  },
  conditions: [{ type: "controller-vanguard-has-clan", value: "Shadow Paladin" }],
  conditionsReviewed: true,
  costs: [{ type: "soul-blast", count: 1 }],
  costsReviewed: true,
  choicesReviewed: true,
  optional: true,
  canDecline: true,
  source: {
    dataset: "Cardfight Area snapshot",
    snapshotDate: "2025-05-09",
    officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=86&view=text",
    officialCardNumber: "G-RC01/015EN",
    patternId: "auto-place-rc-from-deck-soul-blast-clan-draw-v1",
    review: "Exact AUTO for Black-winged Swordbreaker (G-RC01/015EN). Only this source instance being placed from the deck onto an RC qualifies; the controller must have a Shadow Paladin vanguard. Its controller may Soul Blast 1, then draws one card."
  },
  effects: [{ op: "draw", count: 1 }]
}];
