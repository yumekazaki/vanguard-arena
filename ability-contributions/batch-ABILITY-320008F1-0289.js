"use strict";

module.exports = [{
  id: "cfa-5711:0",
  cardId: "cfa-5711",
  kind: "AUTO",
  printedText: "AUTO [RC]: When it attacks a vanguard, if you have three or more rear-guards, this unit gets power +5000 until end of that battle.",
  requiredLocation: ["rear-guard"],
  trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", targetLocation: "vanguard", circles: ["rear-guard"] },
  conditions: [{ type: "controller-rear-guards-at-least", count: 3 }],
  conditionsReviewed: true,
  costs: [],
  costsReviewed: true,
  choicesReviewed: true,
  optional: false,
  source: {
    dataset: "Bushiroad official card list",
    officialCardNumber: "V-TD01/006EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=V-TD01%2F006EN",
    officialReferences: ["https://en.cf-vanguard.com/cardlist/?cardno=V-TD01%2F006EN", "https://en.cf-vanguard.com/cardlist/?cardno=V-MB01%2F015EN"],
    patternId: "auto-own-attack-rear-guard-count-power-battle-v1",
    review: "The exact source Rear-Guard must itself attack the opposing Vanguard while its controller has at least three Rear-Guards. Only that attacker gets +5000 for that battle. The card catalog does not identify the print, and another same-name printing has different text, so whole-card verification remains pending print mapping."
  },
  effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]
}];
