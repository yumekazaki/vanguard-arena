"use strict";

// These three legacy Sentinel AUTO abilities share the exact same ordered
// mechanic: after this exact card is placed on GC, its controller may discard
// a matching-clan card from hand, then protects one matching-clan unit that is
// the target of the current attack for that battle. The official rules Q&A
// confirms a Sentinel's GC-placement AUTO works regardless of how it was
// called, so the trigger intentionally has no hand-only source restriction.
module.exports = [
  {
    id: "cfa-1304:1",
    cardId: "cfa-1304",
    kind: "AUTO",
    printedText: "AUTO: [Choose an «Angel Feather» from your hand, and discard it] When this unit is placed on GC, you may pay the cost. If you do, choose one of your «Angel Feather» that is being attacked, and that unit cannot be hit until end of that battle.",
    requiredLocation: ["guardian"],
    trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["guardian"] },
    conditionsReviewed: true,
    costs: [{ type: "discard", count: 1, filter: { clan: "Angel Feather" } }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    source: {
      dataset: "Bushiroad official card list",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT11%2F009EN",
      officialCardNumber: "BT11/009EN",
      patternId: "auto-gc-discard-protect-attacked-unit-v1",
      review: "Exact AUTO on Adamantine Celestial, Aniel. Its controller may discard one Angel Feather from hand, then must choose one of their Angel Feather units currently being attacked; that exact target cannot be hit through the end of that battle. The AUTO is caused by this exact source being placed on GC by any legal method, as confirmed by Bushiroad's Sentinel Q&A (Q734/Q735)."
    },
    effects: [{
      op: "protect-target",
      target: "chosen",
      duration: "battle",
      requiresAttackedTarget: true,
      targetFilter: { controller: "source-controller", cardType: "unit", clan: "Angel Feather", mustBeAttacked: true }
    }]
  },
  {
    id: "cfa-1573:1",
    cardId: "cfa-1573",
    kind: "AUTO",
    printedText: "AUTO: [Choose an «Oracle Think Tank» from your hand, and discard it] When this unit is placed on GC, you may pay the cost. If you do, choose one of your «Oracle Think Tank» that is being attacked, and that unit cannot be hit until end of that battle.",
    requiredLocation: ["guardian"],
    trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["guardian"] },
    conditionsReviewed: true,
    costs: [{ type: "discard", count: 1, filter: { clan: "Oracle Think Tank" } }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    source: {
      dataset: "Bushiroad official card list",
      officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=35&view=text",
      officialCardNumber: "EB07/007EN",
      patternId: "auto-gc-discard-protect-attacked-unit-v1",
      review: "Exact AUTO on Tetra Magus. Its controller may discard one Oracle Think Tank from hand, then must choose one of their Oracle Think Tank units currently being attacked; that exact target cannot be hit through the end of that battle. The AUTO is caused by this exact source being placed on GC by any legal method, as confirmed by Bushiroad's Sentinel Q&A (Q734/Q735)."
    },
    effects: [{
      op: "protect-target",
      target: "chosen",
      duration: "battle",
      requiresAttackedTarget: true,
      targetFilter: { controller: "source-controller", cardType: "unit", clan: "Oracle Think Tank", mustBeAttacked: true }
    }]
  },
  {
    id: "cfa-716:1",
    cardId: "cfa-716",
    kind: "AUTO",
    printedText: "AUTO: [Choose an «Angel Feather» from your hand, and discard it] When this unit is placed on GC, you may pay the cost. If you do, choose one of your «Angel Feather» that is being attacked, and that unit cannot be hit until end of that battle.",
    requiredLocation: ["guardian"],
    trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["guardian"] },
    conditionsReviewed: true,
    costs: [{ type: "discard", count: 1, filter: { clan: "Angel Feather" } }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    source: {
      dataset: "Bushiroad official card list",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT06%2F012EN",
      officialCardNumber: "BT06/012EN",
      patternId: "auto-gc-discard-protect-attacked-unit-v1",
      review: "Exact AUTO on Pure Keeper, Requiel. Its controller may discard one Angel Feather from hand, then must choose one of their Angel Feather units currently being attacked; that exact target cannot be hit through the end of that battle. The AUTO is caused by this exact source being placed on GC by any legal method, as confirmed by Bushiroad's Sentinel Q&A (Q734/Q735)."
    },
    effects: [{
      op: "protect-target",
      target: "chosen",
      duration: "battle",
      requiresAttackedTarget: true,
      targetFilter: { controller: "source-controller", cardType: "unit", clan: "Angel Feather", mustBeAttacked: true }
    }]
  }
];
