"use strict";

// Exact ACT abilities from ABILITY-0003 whose complete condition, cost,
// once-per-turn restriction, and effect are supported by the current reducer.
// Other records in this batch remain unsupported until their effect handlers
// and player-choice flows are reviewed and implemented.
module.exports = [
  {
    id: "cfa-10055:0",
    cardId: "cfa-10055",
    kind: "ACT",
    printedText: 'ACT [RC] 1/Turn: If you have a vanguard with "Youthberk" in its card name, COST [Counter Blast 2], and this unit gets power +10000 until end of turn.',
    requiredLocation: ["rear-guard"],
    conditions: [{ type: "controller-vanguard-name-contains", value: "Youthberk" }],
    conditionsReviewed: true,
    costs: [{ type: "counter-blast", count: 2 }],
    costsReviewed: true,
    choicesReviewed: true,
    once: true,
    usageRestriction: { type: "once-per-turn", scope: "ability-instance", reset: "turn" },
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "act-rc-youthberk-counter-blast-power-turn-v1",
      review: "Exact ACT on Internalize Mage. It is available only from its controller's RC during the main activation window, only while that controller has a Vanguard with Youthberk in its name, costs Counter Blast 2, and gives this exact source +10000 until end of turn once per turn."
    },
    effects: [{ op: "modify-power", target: "source", amount: 10000, duration: "turn" }]
  },
  {
    id: "cfa-10072:0",
    cardId: "cfa-10072",
    kind: "ACT",
    printedText: "ACT [RC] 1/Turn: If your vanguard is grade 3 or greater, COST [Counter Blast 2], and draw a card.",
    requiredLocation: ["rear-guard"],
    conditions: [{ type: "controller-vanguard-grade-at-least", count: 3 }],
    conditionsReviewed: true,
    costs: [{ type: "counter-blast", count: 2 }],
    costsReviewed: true,
    choicesReviewed: true,
    once: true,
    usageRestriction: { type: "once-per-turn", scope: "ability-instance", reset: "turn" },
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "act-rc-grade-three-counter-blast-draw-v1",
      review: "Exact ACT on Direful Doll, Kjerstin. It is available only from its controller's RC during the main activation window, only with a grade 3 or greater Vanguard, costs Counter Blast 2, draws one card, and is once per turn for this ability instance."
    },
    effects: [{ op: "draw", count: 1 }]
  }
];
