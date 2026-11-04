"use strict";

module.exports = [
  {
    id: "cfa-750:0",
    cardId: "cfa-750",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: During your turn, when another of your «Tachikaze» rear-guards is put into the drop zone, this unit gets power +1000 until end of turn.",
    requiredLocation: ["vanguard", "rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.moved",
      subject: "different-card",
      circles: [],
      sourceLocation: "rear-guard",
      destinationLocation: "drop",
      excludeSourceAsSubject: true,
      subjectControllerRelation: "source-controller",
      turnRelation: "controller",
      anyOf: [
        { eventType: "card.moved" },
        { eventType: "card.retired" }
      ]
    },
    conditions: [
      { type: "controller-turn" },
      { type: "event-subject-has-clan", value: "Tachikaze" }
    ],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Bushiroad official card list",
      officialCardNumber: "BT03/035EN",
      officialReferences: ["https://en.cf-vanguard.com/cardlist/?cardno=BT03%2F035EN"],
      rulesReference: "https://en.cf-vanguard.com/howto/",
      patternId: "auto-vc-rc-during-turn-friendly-tachikaze-rearguard-drop-power-v1",
      review: "The official BT03/035EN AUTO [VC/RC] text matches the catalog text (the official page prints <Tachikaze>, rendered as «Tachikaze» in this catalog). During this controller's turn, only a distinct card instance controlled by this unit's controller that was on a Rear-Guard Circle and has Tachikaze clan metadata when it enters Drop qualifies. Either a move or retirement event represents the printed zone change. The exact source on VC or RC receives +1000 until turn end. This is mandatory and has no cost, target choice, or usage restriction. Rules reference: Comprehensive Rules ver. 4.59, §§11.9.1–11.9.4.1 and 11.8.5.3."
    },
    effects: [{ op: "modify-power", target: "source", amount: 1000, duration: "turn" }]
  }
];
