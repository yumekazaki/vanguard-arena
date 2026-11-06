"use strict";

// New data-only definition for the exact Screwbullet Dragon AUTO.
// Other assigned entries either already have trusted runtime definitions or
// need engine/reducer support that this contribution-only batch cannot add.
module.exports = [
  {
    id: "cfa-10746:0",
    cardId: "cfa-10746",
    kind: "AUTO",
    printedText: "AUTO [RC]: When this unit attacks a vanguard, if it is the fourth battle of this turn or more, this unit gets power +5000 until end of that battle.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "unit.attacked",
      subject: "source",
      circles: ["rear-guard"],
      targetLocation: "vanguard"
    },
    conditions: [{ type: "total-attack-count-this-turn-at-least", count: 4 }],
    costs: [],
    optional: false,
    canDecline: false,
    conditionsReviewed: true,
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Bushiroad official card list",
      cardNumber: "D-BT10/090EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203&s_param=d-Stoicheia&sort=no&view=text",
      patternId: "auto-rc-own-attack-fourth-battle-power-battle-v1",
      review: "Official card-list text confirms this Rear-Guard's own attack must target a Vanguard and be the fourth battle of the current turn or later. The shared current-turn attack-count condition is revalidated when resolving; only the exact source instance receives +5000 for that battle."
    },
    effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]
  },
  {
    id: "cfa-10756:0",
    cardId: "cfa-10756",
    kind: "CONT",
    printedText: "CONT [RC]: During your turn, this unit gets power +2000 for each of your Dragontree markers on RC.",
    requiredLocation: ["rear-guard"],
    source: {
      dataset: "Cardfight Area card database snapshot",
      snapshotDate: "2025-05-09",
      cardNumber: "D-BT10/073EN",
      patternId: "cont-rc-during-turn-power-per-dragontree-marker-v1",
      review: "The catalog's Volheimer wording differs slightly from the existing five-card compiler template (\"each of your Dragontree markers on RC\" versus \"each Dragontree marker on your RC\"). The shared continuous handler counts only this controller's Dragontree markers on Rear-Guard Circles and applies +2000 per marker only during the controller's turn. Public card listings identify D-BT10/073EN and corroborate this wording, but the official individual card page was not found; keep whole-card verification pending."
    },
    effects: [{
      op: "continuous-power-per-dragontree-marker",
      target: "source",
      amount: 2000,
      duration: "continuous",
      condition: { op: "controller-turn" }
    }]
  }
];
