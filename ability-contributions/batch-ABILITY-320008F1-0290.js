"use strict";

module.exports = [{
  id: "cfa-5763:1",
  cardId: "cfa-5763",
  kind: "AUTO",
  printedText: "AUTO [VC/RC]: When it attacks a vanguard, if you have three or more rear-guards, this unit gets power +5000 until end of that battle.",
  requiredLocation: ["vanguard", "rear-guard"],
  trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", targetLocation: "vanguard", circles: ["vanguard", "rear-guard"] },
  conditions: [{ type: "controller-rear-guards-at-least", count: 3 }],
  conditionsReviewed: true,
  costs: [],
  costsReviewed: true,
  choicesReviewed: true,
  optional: false,
  source: {
    dataset: "Bushiroad official card list",
    officialCardNumber: "V-BT01/037EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=V-BT01%2F037EN",
    officialReferences: ["https://en.cf-vanguard.com/cardlist/?cardno=V-BT01%2F037EN"],
    patternId: "auto-own-attack-rear-guard-count-power-battle-v1",
    review: "The exact source on VC or RC must itself attack the opposing Vanguard while its controller has at least three Rear-Guards. Only that attacker gets +5000 for that battle. The card also has a separate ACT ability; this AUTO's test evidence does not mark the whole card verified."
  },
  effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]
}];
