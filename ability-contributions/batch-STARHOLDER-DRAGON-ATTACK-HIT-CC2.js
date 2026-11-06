"use strict";

// Official G-BT05/071EN text, independently structured over the shared
// attack.hit, Generation Break, and Counter-Charge effect handlers.
module.exports = [{
  id: "cfa-3370:0",
  cardId: "cfa-3370",
  kind: "AUTO",
  printedText: "AUTO [RC] Generation Break 1: When this unit’s attack hits a vanguard, Counter Charge 2.",
  requiredLocation: ["rear-guard"],
  trigger: {
    status: "recognized-trigger",
    eventType: "attack.hit",
    subject: "source",
    targetLocation: "vanguard",
    circles: [],
    requiredTimingWindow: "attack-hit",
    turnRelation: "controller"
  },
  conditions: [{ type: "generation-break", count: 1 }],
  conditionsReviewed: true,
  costs: [],
  costsReviewed: true,
  choicesReviewed: true,
  optional: false,
  canDecline: false,
  source: {
    dataset: "Bushiroad official card list",
    officialCardNumber: "G-BT05/071EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=G-BT05%2F071EN",
    patternId: "auto-rc-gb-own-attack-hit-counter-charge-two-v1",
    review: "Official text is AUTO [RC] Generation Break 1: only this Rear-Guard instance’s own attack hitting a vanguard qualifies; the controller then Counter-Charges 2. The generic authoritative attack.hit matcher binds the source instance to the battle attacker and the vanguard target. Generation Break is rechecked from the controller’s current face-up G units, and the existing Counter-Charge handler flips up to two selected face-down damage cards for the source controller."
  },
  effects: [{ op: "counter-charge", count: 2 }]
}];
