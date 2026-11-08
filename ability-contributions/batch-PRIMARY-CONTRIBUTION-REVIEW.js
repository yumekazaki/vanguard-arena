"use strict";

// Exact-text family contributions for two mechanics whose event/effect handlers
// are shared across every listed card instance.
module.exports = [
  {
    id: "cfa-996:0",
    cardId: "cfa-996",
    kind: "AUTO",
    printedText: "AUTO [RC]: During your battle phase, when this unit becomes stand, this unit gets power +3000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "unit.stood",
      subject: "event-subject",
      circles: ["rear-guard"],
      requiredPhase: "battle",
      turnRelation: "controller",
      subjectControllerRelation: "source-controller"
    },
    conditions: [],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Bushiroad official card list",
      snapshotDate: "2026-11-07",
      officialCardNumber: "BT09/033EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F033EN&expansion=22&s_param=Nova+Grappler&view=image",
      patternId: "auto-rc-battle-phase-stand-source-power-turn-v1",
      review: "Exact official BT09/033EN text; shares the Yamatano Drake stand event and power operation. Eligibility is bound to this exact Rear-Guard instance becoming stood during its controller's Battle Phase; the turn-duration +3000 applies once per distinct stand event, with no once-per-turn restriction."
    },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]
  },
  {
    id: "cfa-1608:1",
    cardId: "cfa-1608",
    kind: "AUTO",
    printedText: "AUTO [RC]: During your battle phase, when this unit becomes stand, this unit gets power +3000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "unit.stood",
      subject: "event-subject",
      circles: ["rear-guard"],
      requiredPhase: "battle",
      turnRelation: "controller",
      subjectControllerRelation: "source-controller"
    },
    conditions: [],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Bushiroad official card list (Japanese print; catalog English translation)",
      snapshotDate: "2026-11-07",
      officialCardNumber: "BT13/065",
      officialReference: "https://cf-vanguard.com/cardlist/cardsearch/?expansion=42&s_clan=%E3%83%8E%E3%83%B4%E3%82%A1%E3%82%B0%E3%83%A9%E3%83%83%E3%83%97%E3%83%A9%E3%83%BC&sort=new&view=text",
      patternId: "auto-rc-battle-phase-stand-source-power-turn-v1",
      review: "Official Japanese BT13/065 text matches the catalog English translation. Shares the Yamatano Drake stand event and power operation. Eligibility is bound to this exact Rear-Guard instance becoming stood during its controller's Battle Phase; the turn-duration +3000 applies once per distinct stand event, with no once-per-turn restriction."
    },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]
  },
  {
    id: "cfa-34:1",
    cardId: "cfa-34",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: [Soul Blast 8 & Counter Blast 5] When this unit’s attack hits, you may pay the cost. If you do, retire all of your opponent’s rear-guards.",
    requiredLocation: ["vanguard", "rear-guard"],
    trigger: { status: "recognized-trigger", eventType: "attack.hit", subject: "source", circles: [] },
    conditions: [],
    conditionsReviewed: true,
    costs: [{ type: "soul-blast", count: 8 }, { type: "counter-blast", count: 5 }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    source: {
      dataset: "Bushiroad official card list and official rules Q&A",
      snapshotDate: "2026-11-07",
      officialCardNumber: "BT05/036EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT05%2F036EN",
      rulesReference: "https://en.cf-vanguard.com/howto/question/?id=basic",
      patternId: "auto-own-attack-hit-soul-blast-counter-blast-retire-all-v1",
      review: "Exact official BT05/036EN text. The ability is optional, requires this exact VC/RC source's attack to hit, and both Soul Blast 8 and Counter Blast 5 must be paid together. On success, every opposing Rear-Guard still controlled on an unlocked RC is retired; costs are validated before any effect mutation."
    },
    effects: [{ op: "retire-all-opponent-rearguards", target: "opponent-rear-guards" }]
  },
  {
    id: "cfa-484:1",
    cardId: "cfa-484",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: [Soul Blast 8 & Counter Blast 5] When this unit’s attack hits, you may pay the cost. If you do, retire all of your opponent’s rear-guards.",
    requiredLocation: ["vanguard", "rear-guard"],
    trigger: { status: "recognized-trigger", eventType: "attack.hit", subject: "source", circles: [] },
    conditions: [],
    conditionsReviewed: true,
    costs: [{ type: "soul-blast", count: 8 }, { type: "counter-blast", count: 5 }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    source: {
      dataset: "Bushiroad official card list and official rules Q&A",
      snapshotDate: "2026-11-07",
      officialCardNumber: "BT01/036EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=bt01%2F036en",
      rulesReference: "https://en.cf-vanguard.com/howto/question/?id=basic",
      patternId: "auto-own-attack-hit-soul-blast-counter-blast-retire-all-v1",
      review: "Exact official BT01/036EN text. The ability is optional, requires this exact VC/RC source's attack to hit, and both Soul Blast 8 and Counter Blast 5 must be paid together. On success, every opposing Rear-Guard still controlled on an unlocked RC is retired; costs are validated before any effect mutation."
    },
    effects: [{ op: "retire-all-opponent-rearguards", target: "opponent-rear-guards" }]
  },
  {
    id: "cfa-682:1",
    cardId: "cfa-682",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: [Soul Blast 8 & Counter Blast 5] When this unit’s attack hits, you may pay the cost. If you do, retire all of your opponent’s rear-guards.",
    requiredLocation: ["vanguard", "rear-guard"],
    trigger: { status: "recognized-trigger", eventType: "attack.hit", subject: "source", circles: [] },
    conditions: [],
    conditionsReviewed: true,
    costs: [{ type: "soul-blast", count: 8 }, { type: "counter-blast", count: 5 }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    source: {
      dataset: "Bushiroad official card list and official rules Q&A",
      snapshotDate: "2026-11-07",
      officialCardNumber: "BT01/009EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT01%2F009EN&faq=",
      rulesReference: "https://en.cf-vanguard.com/howto/question/?id=basic",
      patternId: "auto-own-attack-hit-soul-blast-counter-blast-retire-all-v1",
      review: "Exact official BT01/009EN text. The ability is optional, requires this exact VC/RC source's attack to hit, and both Soul Blast 8 and Counter Blast 5 must be paid together. On success, every opposing Rear-Guard still controlled on an unlocked RC is retired; costs are validated before any effect mutation."
    },
    effects: [{ op: "retire-all-opponent-rearguards", target: "opponent-rear-guards" }]
  },
  {
    id: "cfa-3951:2", cardId: "cfa-3951", kind: "ACT",
    printedText: 'ACT [RC] Generation Break 1: [Counter Blast 1] This unit gets "Boost" until end of turn.',
    requiredLocation: ["rear-guard"], activationWindow: "main", conditions: [], conditionsReviewed: true,
    costs: [{ type: "counter-blast", count: 1 }], costsReviewed: true, choicesReviewed: true, optional: false,
    source: { dataset: "Cardfight Area catalog snapshot", snapshotDate: "2025-05-09", officialTextVerified: false,
      rulesReference: "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      patternId: "act-rc-generation-break-counter-blast-grant-boost-v1",
      review: "Exact local catalog text. The source unit must be on RC and controlled by the activating player; Main Phase, Generation Break 1, and Counter-Blast 1 are required. The source gains Boost until turn end. Official card-list text confirmation remains pending." },
    effects: [{ op: "grant-temporary-boost", target: "source", duration: "turn" }]
  },
  {
    id: "cfa-5092:1", cardId: "cfa-5092", kind: "ACT",
    printedText: 'ACT [RC] Generation Break 1: [Counter Blast 1] This unit gets "Boost" until end of turn.',
    requiredLocation: ["rear-guard"], activationWindow: "main", conditions: [], conditionsReviewed: true,
    costs: [{ type: "counter-blast", count: 1 }], costsReviewed: true, choicesReviewed: true, optional: false,
    source: { dataset: "Cardfight Area catalog snapshot", snapshotDate: "2025-05-09", officialTextVerified: false,
      rulesReference: "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      patternId: "act-rc-generation-break-counter-blast-grant-boost-v1",
      review: "Exact local catalog text. The source unit must be on RC and controlled by the activating player; Main Phase, Generation Break 1, and Counter-Blast 1 are required. The source gains Boost until turn end. Official card-list text confirmation remains pending." },
    effects: [{ op: "grant-temporary-boost", target: "source", duration: "turn" }]
  }
];
