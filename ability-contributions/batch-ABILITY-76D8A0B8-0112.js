"use strict";

module.exports = [{
  id: "cfa-1571:0",
  cardId: "cfa-1571",
  kind: "AUTO",
  printedText: "AUTO [VC/RC]: [Counter Blast 1] When this unit’s attack hits a vanguard, you may pay the cost. If you do, look at up to five cards from the top of your deck, search for up to one grade 3 or greater «Oracle Think Tank» from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.",
  optional: true,
  requiredLocation: ["vanguard", "rear-guard"],
  trigger: { status: "recognized-trigger", eventType: "attack.hit", subject: "source", targetLocation: "vanguard", circles: [] },
  conditionsReviewed: true,
  costs: [{ type: "counter-blast", count: 1 }],
  costsReviewed: true,
  choicesReviewed: true,
  source: {
    dataset: "Cardfight Area snapshot",
    snapshotDate: "2025-05-09",
    patternId: "auto-own-attack-hit-counter-blast-top-five-clan-grade-search-v1",
    review: "Exact AUTO: only this source's own attack hitting the opposing Vanguard makes it eligible. Its controller may pay Counter Blast 1, then may add up to one Grade 3+ card of the printed clan from the top five, reveal it, and shuffle. The printed text does not add a card-type restriction."
  },
  effects: [{ op: "search-top-up-to-one-filtered-to-hand", target: "controller", lookCount: 5, maximum: 1, filter: { minGrade: 3, clan: "Oracle Think Tank" } }]
}];
