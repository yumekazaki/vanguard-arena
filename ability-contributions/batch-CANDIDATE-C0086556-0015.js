"use strict";

const NAMED_VANGUARD_PAIRS = Object.freeze({
  "cfa-24": Object.freeze(["Phantom Blaster Dragon", "Blaster Dark"]),
  "cfa-251": Object.freeze(["Enigman Storm", "Enigman Wave"]),
  "cfa-536": Object.freeze(["Amber Dragon, Eclipse", "Amber Dragon, Dusk"]),
  "cfa-63": Object.freeze(["Evil Armor General, Giraffa", "Elite Mutant, Giraffa"])
});

const SOURCE = Object.freeze({
  dataset: "Cardfight Area snapshot",
  snapshotDate: "2025-05-09",
  patternId: "cont-vc-rc-power-penalty-unless-vanguard-name-one-of-v1",
  review: "Exact VC/RC CONT wording on four catalog records. This source gets the printed power penalty on VC or RC unless its controller's current Vanguard Circle has either exact printed unit name. Rear-Guards, the opponent's Vanguard, and substring-only matches do not satisfy the exception. The condition is continuous and is recomputed as the source's location or its controller's Vanguard changes."
});

function missingNamedVanguardPenalty(cardId, names) {
  const [firstName, secondName] = names;
  const printedText = `CONT [VC/RC]: If you do not have a unit named "${firstName}" or a unit named "${secondName}" on your VC, this unit gets power -5000.`;
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
      amount: -5000,
      duration: "continuous",
      condition: {
        op: "not",
        condition: {
          op: "any",
          conditions: names.map(name => ({ op: "controller-vanguard-card-name-equals", name }))
        }
      }
    }]
  };
}

module.exports = Object.entries(NAMED_VANGUARD_PAIRS).map(([cardId, names]) => missingNamedVanguardPenalty(cardId, names));
