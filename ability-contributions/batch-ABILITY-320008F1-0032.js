"use strict";

// Only the three official, text-confirmed dual-circle trigger-check CONTs are
// contributed here. Their mechanics share the existing continuous evaluator.
module.exports = [
  {
    id: "cfa-10888:0",
    cardId: "cfa-10888",
    kind: "CONT",
    printedText: "CONT [RC/GC]: If your opponent’s drive check or damage check revealed a trigger unit this turn, this unit gets power +10000 / shield +10000.",
    requiredLocation: ["rear-guard", "guardian"],
    conditionsReviewed: true,
    costsReviewed: true,
    source: {
      dataset: "Bushiroad official card list",
      officialCardNumber: "D-SS05/015EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2F015EN",
      patternId: "cont-rc-gc-opponent-check-trigger-power-shield-v1",
      review: "Exact CONT on Moon-nestling Fantasia, Adelheid. It grants this card +10000 power only on RC and +10000 shield only on GC, and only when the opponent revealed a trigger on a drive or damage check this turn. The fact belongs to the player who is the checker’s opponent and expires at turn end; this is not a manual ability."
    },
    effects: [
      {
        op: "continuous-power",
        target: "source",
        amount: 10000,
        duration: "continuous",
        location: "rear-guard",
        condition: { op: "opponent-trigger-revealed-this-turn" }
      },
      {
        op: "continuous-shield",
        target: "source",
        amount: 10000,
        duration: "continuous",
        location: "guardian",
        condition: { op: "opponent-trigger-revealed-this-turn" }
      }
    ]
  },
  {
    id: "cfa-10899:0",
    cardId: "cfa-10899",
    kind: "CONT",
    printedText: "CONT [RC/GC]: If your opponent’s drive check or damage check revealed a trigger unit this turn, this unit gets power +10000 / shield +10000.",
    requiredLocation: ["rear-guard", "guardian"],
    conditionsReviewed: true,
    costsReviewed: true,
    source: {
      dataset: "Bushiroad official card list",
      officialCardNumber: "D-SS05/006EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2F006EN",
      patternId: "cont-rc-gc-opponent-check-trigger-power-shield-v1",
      review: "Exact CONT on Causality Dragon, Crucial Dragon. It grants this card +10000 power only on RC and +10000 shield only on GC, and only when the opponent revealed a trigger on a drive or damage check this turn. The fact belongs to the player who is the checker’s opponent and expires at turn end; this is not a manual ability."
    },
    effects: [
      {
        op: "continuous-power",
        target: "source",
        amount: 10000,
        duration: "continuous",
        location: "rear-guard",
        condition: { op: "opponent-trigger-revealed-this-turn" }
      },
      {
        op: "continuous-shield",
        target: "source",
        amount: 10000,
        duration: "continuous",
        location: "guardian",
        condition: { op: "opponent-trigger-revealed-this-turn" }
      }
    ]
  },
  {
    id: "cfa-10904:0",
    cardId: "cfa-10904",
    kind: "CONT",
    printedText: "CONT [RC/GC]: If your opponent’s drive check or damage check revealed a trigger unit this turn, this unit gets power +10000 / shield +10000.",
    requiredLocation: ["rear-guard", "guardian"],
    conditionsReviewed: true,
    costsReviewed: true,
    source: {
      dataset: "Bushiroad official card list",
      officialCardNumber: "D-SS05/005EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2F005EN",
      patternId: "cont-rc-gc-opponent-check-trigger-power-shield-v1",
      review: "Exact CONT on Forcember Dragon, Red Exert Dragon. It grants this card +10000 power only on RC and +10000 shield only on GC, and only when the opponent revealed a trigger on a drive or damage check this turn. The fact belongs to the player who is the checker’s opponent and expires at turn end; this is not a manual ability."
    },
    effects: [
      {
        op: "continuous-power",
        target: "source",
        amount: 10000,
        duration: "continuous",
        location: "rear-guard",
        condition: { op: "opponent-trigger-revealed-this-turn" }
      },
      {
        op: "continuous-shield",
        target: "source",
        amount: 10000,
        duration: "continuous",
        location: "guardian",
        condition: { op: "opponent-trigger-revealed-this-turn" }
      }
    ]
  }
];
