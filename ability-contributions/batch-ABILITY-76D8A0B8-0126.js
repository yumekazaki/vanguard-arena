"use strict";

// This batch deliberately contains only abilities whose complete behavior can
// be expressed by the current event and effect handlers. The remaining batch
// IDs and their precise blockers are recorded in the focused test file.
module.exports = [
  {
    id: "cfa-210:0",
    cardId: "cfa-210",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if the number of other «Gold Paladin» rear-guards you have is four or more, draw a card.",
    requiredLocation: ["vanguard", "rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "attack.hit",
      subject: "source",
      circles: [],
      targetLocation: "vanguard",
      requiredTimingWindow: "attack-hit",
      turnRelation: "controller"
    },
    conditions: [
      { type: "controller-other-rear-guards-of-clan-at-least", count: 4, clan: "Gold Paladin" }
    ],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    canDecline: false,
    source: {
      dataset: "Bushiroad official card list",
      snapshotDate: "2026-11-05",
      officialCardNumber: "BT06/082EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT06%2F082EN",
      patternId: "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
      review: "Official text for Providence Strategist (BT06/082EN) confirms its own attack must hit a Vanguard and its controller must have four other Gold Paladin Rear-Guards before drawing. The structured condition counts current friendly Rear-Guards by clan and excludes this exact source instance; the event trigger binds the attack to the source instance."
    },
    effects: [{ op: "draw", count: 1 }]
  },
  {
    id: "cfa-2117:0",
    cardId: "cfa-2117",
    kind: "AUTO",
    printedText: "AUTO: During your battle phase, when this unit is placed on RC, Soul Charge 1, choose a card from your damage zone, and turn it face up. (Counter Charge 1)",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.placed",
      subject: "source",
      circles: ["rear-guard"],
      requiredPhase: "battle",
      turnRelation: "controller"
    },
    conditions: [],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    canDecline: false,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      cardNumber: "BT16/089EN",
      secondaryReference: "https://cardfight.fandom.com/wiki/Jumbo_the_Stungun",
      patternId: "auto-rc-battle-phase-placement-soul-charge-counter-charge-v1",
      review: "The local catalog text for Jumbo the Stungun matches its original BT16/089 ability, and the secondary card entry corroborates the same sequence. An official individual Bushiroad card page was not located, so official-text confirmation remains outstanding. This uses only the existing source-bound Rear-Guard placement event, battle-phase gate, Soul Charge, and controller-selected Counter Charge handlers."
    },
    effects: [
      { op: "soul-charge", count: 1 },
      { op: "counter-charge", count: 1 }
    ]
  }
];
