"use strict";

module.exports = [{
  id: "cfa-191:0",
  cardId: "cfa-191",
  kind: "AUTO",
  printedText: "AUTO: [Soul Blast 1] When this unit is placed on RC from your deck, if you have a «Gold Paladin» vanguard, you may pay the cost. If you do, draw a card.",
  requiredLocation: ["rear-guard"],
  trigger: {
    status: "recognized-trigger",
    eventType: "card.placed",
    subject: "source",
    circles: ["rear-guard"],
    sourceLocation: "deck",
    destinationLocation: "rear-guard"
  },
  conditions: [{ type: "controller-vanguard-has-clan", value: "Gold Paladin" }],
  conditionsReviewed: true,
  costs: [{ type: "soul-blast", count: 1 }],
  costsReviewed: true,
  choicesReviewed: true,
  optional: true,
  canDecline: true,
  source: {
    dataset: "Cardfight Area snapshot",
    snapshotDate: "2025-05-09",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT07%2F020EN",
    officialCardNumber: "BT07/020EN",
    patternId: "auto-place-rc-from-deck-soul-blast-clan-draw-v1",
    review: "Exact AUTO for Listener of Truth, Dindrane (BT07/020EN). Only this source instance being placed from the deck onto an RC qualifies; the controller must have a Gold Paladin vanguard. Its controller may Soul Blast 1, then draws one card."
  },
  effects: [{ op: "draw", count: 1 }]
}];
