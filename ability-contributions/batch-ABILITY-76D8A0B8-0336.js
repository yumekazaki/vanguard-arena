"use strict";

module.exports = [
  {
    id: "cfa-7952:0",
    cardId: "cfa-7952",
    kind: "AUTO",
    printedText: "AUTO [VC]: When placed, look at seven cards from the top of your deck, reveal up to one card with \"Shiranui\" in its card name from among them and put it into your hand, and shuffle your deck.",
    requiredLocation: ["vanguard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.placed",
      subject: "source",
      circles: ["vanguard"]
    },
    conditions: [],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Bushiroad official card text",
      snapshotDate: "2026-11-04",
      cardNumber: "V-BT11/031EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=V-BT11%2F031EN",
      patternId: "auto-vanguard-placement-top-seven-card-name-search-v1",
      review: "Official text says [VC] and a card with Shiranui in its card name. This exact Vanguard instance must be placed on VC. Its controller resolves the AUTO, may select zero or one matching card among the top seven, adds it to hand, and shuffles. The Rear-Guard placement ability on the same card is a separate printed ability and does not satisfy this trigger."
    },
    effects: [
      {
        op: "search-top-up-to-one-filtered-to-hand",
        target: "controller",
        lookCount: 7,
        maximum: 1,
        filter: { cardNameContains: "Shiranui" }
      }
    ]
  },
  {
    id: "cfa-7952:1",
    cardId: "cfa-7952",
    kind: "AUTO",
    printedText: "AUTO [RC]: When placed, COST [Soul Blast 1], your opponent chooses a card from his or her hand, discards it, and increase this unit’s power by the shield of that card until end of turn. Your opponent draws a card.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.placed",
      subject: "source",
      circles: ["rear-guard"]
    },
    conditions: [],
    conditionsReviewed: true,
    costs: [{ type: "soul-blast", count: 1 }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Bushiroad official card text",
      snapshotDate: "2026-11-04",
      cardNumber: "V-BT11/031EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=V-BT11%2F031EN",
      patternId: "auto-rc-opponent-discard-shield-power-draw-v1",
      rulesReferences: ["Comprehensive Rules 11.9.5.2"],
      review: "Official text distinguishes this RC placement ability from the separate VC search ability. The exact source must be placed on an RC. Its controller pays Soul Blast 1 or declines that AUTO cost; if paid, the opponent privately chooses and discards a card from their own hand, the exact source gains power equal to that card’s printed shield until end of turn, and that opponent draws one card."
    },
    effects: [{
      op: "opponent-discard-hand-shield-power-draw",
      target: "opponent",
      powerTarget: "source",
      powerValue: "discarded-card-shield",
      duration: "turn",
      drawCount: 1
    }]
  },
  {
    id: "cfa-7942:0",
    cardId: "cfa-7942",
    kind: "AUTO",
    printedText: "AUTO: When discarded from hand during your turn, Soul Charge 1.",
    requiredLocation: ["hand"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.discarded",
      subject: "source",
      sourceLocation: "hand",
      destinationLocation: "drop",
      turnRelation: "controller"
    },
    conditions: [],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Cardfight Area card database (snapshot)",
      snapshotDate: "2025-05-09",
      cardNumber: "V-BT11/054EN",
      rulesReferences: ["Cardfight!! Vanguard Comprehensive Rules 4.52, 11.9.6 and 11.9.9"],
      patternId: "auto-own-turn-self-discard-soul-charge-one-v1",
      review: "The exact Yamiyamaneko instance must be the card moved from its controller's hand to that controller's Drop zone, and the event must occur during that controller's turn. The existing soul-charge handler moves one card from the controller's deck to that controller's Soul. The optional boost effect on the card's separate CONT ability does not change this AUTO."
    },
    effects: [{
      op: "soul-charge",
      target: "controller",
      count: 1
    }]
  }
];
