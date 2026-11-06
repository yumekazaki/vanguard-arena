"use strict";

module.exports = [
  {
    id: "cfa-9939:0",
    cardId: "cfa-9939",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: When it attacks a vanguard, if you have three or more rear-guards, this unit gets power +3000 until end of that battle.",
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
      officialCardNumber: "V-SD01/001EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=V-SD01%2F001EN",
      officialReferences: ["https://en.cf-vanguard.com/cardlist/?cardno=V-SD01%2F001EN"],
      patternId: "auto-own-attack-rear-guard-count-power-battle-v1",
      review: "The exact source on VC or RC must itself attack the opposing Vanguard while its controller has at least three Rear-Guards. Only that attacker gets +3000 for that battle. A same-name print has different text and the catalog lacks print mapping, so whole-card verification remains pending."
    },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]
  },
  {
    id: "cfa-9945:0",
    cardId: "cfa-9945",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: When it attacks a vanguard, if you have three or more rear-guards, this unit gets power +3000 until end of that battle.",
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
      officialCardNumber: "V-SD02/001EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=V-SD02%2F001EN",
      officialReferences: ["https://en.cf-vanguard.com/cardlist/?cardno=V-SD02%2F001EN"],
      patternId: "auto-own-attack-rear-guard-count-power-battle-v1",
      review: "The exact source on VC or RC must itself attack the opposing Vanguard while its controller has at least three Rear-Guards. Only that attacker gets +3000 for that battle. A same-name print has different text and the catalog lacks print mapping, so whole-card verification remains pending."
    },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]
  }
];
