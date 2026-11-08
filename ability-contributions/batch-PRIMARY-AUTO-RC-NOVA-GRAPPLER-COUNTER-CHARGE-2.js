"use strict";

const cardIds = ["cfa-125", "cfa-146"];
const cardNumbers = { "cfa-125": "EB08/023EN", "cfa-146": "EB08/020EN" };
const printedText = "AUTO: When this unit is placed on RC, if you have a «Nova Grappler» vanguard, choose a card from your damage zone and turn it face up. (Counter Charge 1)";
const officialPrintedText = "[AUTO]:When this unit is placed on (RC), if you have a <Nova Grappler> vanguard, choose a card from your damage zone, and turn it face up.";

module.exports = {
  proposedDefinitions: cardIds.map(cardId => ({
    id: `${cardId}:0`,
    cardId,
    kind: "AUTO",
    printedText,
    optional: false,
    canDecline: false,
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.placed",
      subject: "source",
      circles: ["rear-guard"]
    },
    conditions: [{ type: "controller-vanguard-has-clan", value: "Nova Grappler" }],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Bushiroad official card list and Cardfight Area snapshot",
      snapshotDate: "2026-11-07",
      officialCardNumber: cardNumbers[cardId],
      officialReference: `https://en.cf-vanguard.com/cardlist/?cardno=${encodeURIComponent(cardNumbers[cardId])}`,
      officialPrintedText,
      officialTextVerified: true,
      rulesReference: "https://en.cf-vanguard.com/howto/question/?id=term",
      patternId: "auto-rc-placement-nova-grappler-counter-charge-one-v1",
      review: "Mandatory AUTO: only this exact card instance being placed on a Rear-Guard Circle is the trigger; the controller must have a Nova Grappler Vanguard when the ability resolves. Choose one card in that controller's Damage Zone and turn it face up. No activation cost is printed."
    },
    effects: [{ op: "counter-charge", target: "controller", count: 1 }]
  }))
};
