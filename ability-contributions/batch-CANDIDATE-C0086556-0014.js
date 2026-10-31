"use strict";

const common = {
  kind: "CONT",
  source: {
    dataset: "Cardfight Area snapshot",
    snapshotDate: "2025-05-09",
    patternId: "cont-named-soul-card-power-v1",
    review: "Exact CONT wording: only this source on its printed Vanguard Circle receives the listed bonus, and only while its controller's Soul contains the exact quoted card name. This is a continuous modifier with no activation prompt; the opponent's Soul does not satisfy the condition."
  }
};

function namedSoulVanguardPower(cardId, abilityId, printedText, name, amount) {
  return {
    ...common,
    id: abilityId,
    cardId,
    printedText,
    requiredLocation: ["vanguard"],
    effects: [{
      op: "continuous-power",
      target: "source",
      amount,
      duration: "continuous",
      condition: { op: "soul-has-card-name", name, controllerTurn: false }
    }]
  };
}

module.exports = [
  namedSoulVanguardPower(
    "cfa-11767", "cfa-11767:1",
    'CONT [VC]: If you have "Proud Sweat16! [2]" in your soul, this unit gets power +2000.',
    "Proud Sweat16! [2]", 2000
  ),
  namedSoulVanguardPower(
    "cfa-11769", "cfa-11769:0",
    'CONT [VC]: If you have "Eh Sweat16! [2]" in your soul, this unit gets power +1000.',
    "Eh Sweat16! [2]", 1000
  ),
  namedSoulVanguardPower(
    "cfa-242", "cfa-242:0",
    'CONT [VC]: If you have "Enigman Flow" in your soul, this unit gets power +2000.',
    "Enigman Flow", 2000
  ),
  namedSoulVanguardPower(
    "cfa-4411", "cfa-4411:0",
    'CONT [VC]: If you have "Chic Folk Dracokid" in your soul, this unit gets power +3000.',
    "Chic Folk Dracokid", 3000
  )
];
