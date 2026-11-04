"use strict";

const SOURCE = Object.freeze({
  dataset: "Cardfight Area snapshot",
  snapshotDate: "2025-05-09",
  patternId: "cont-vc-rc-no-other-clan-field-power-penalty-v1",
  review: "Exact VC/RC CONT wording across four catalog records. Checks only the source controller's Vanguard and Rear-Guards, excludes the source instance by stable UID, and tests exact structured clan identity. Opposing units are ignored. Missing controller or clan identity fails closed, and the continuous condition is reevaluated as the field changes."
});

const CARD_CLANS = Object.freeze({
  "cfa-155": "Nova Grappler",
  "cfa-547": "Kagero",
  "cfa-624": "Spike Brothers",
  "cfa-625": "Spike Brothers"
});

function definition(cardId, clan) {
  const printedText = `CONT [VC/RC]: If you do not have another «${clan}» vanguard or rear-guard, this unit gets power -2000.`;
  return {
    id: `${cardId}:0`,
    cardId,
    kind: "CONT",
    printedText,
    requiredLocation: ["vanguard", "rear-guard"],
    conditionsReviewed: true,
    source: SOURCE,
    effects: [{
      op: "continuous-power-adjustment",
      target: "source",
      amount: -2000,
      duration: "continuous",
      condition: { op: "controller-field-lacks-other-card-of-clan", clan }
    }]
  };
}

module.exports = Object.entries(CARD_CLANS).map(([cardId, clan]) => definition(cardId, clan));
