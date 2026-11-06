"use strict";

// Three official D-SS05 CONTs reuse the established, exact dual-circle
// drive/damage-check trigger handler. Their other card abilities are separate
// batch entries and are not represented here.
const printedText = "CONT [RC/GC]: If your opponent’s drive check or damage check revealed a trigger unit this turn, this unit gets power +10000 / shield +10000.";
const effects = [
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
];

function definition(id, cardId, name, officialCardNumber, officialReference) {
  return {
    id,
    cardId,
    kind: "CONT",
    printedText,
    requiredLocation: ["rear-guard", "guardian"],
    conditionsReviewed: true,
    costsReviewed: true,
    source: {
      dataset: "Bushiroad official card list",
      officialCardNumber,
      officialReference,
      patternId: "cont-rc-gc-opponent-check-trigger-power-shield-v1",
      review: `Exact dual-circle CONT for ${name}. The unit gains 10000 power on RC and 10000 shield on GC only while its controller's opponent revealed a trigger unit during a drive or damage check this turn. The checker's opponent owns the condition, and it expires at turn end. This is continuous, not manually activated.`
    },
    effects: JSON.parse(JSON.stringify(effects))
  };
}

module.exports = [
  definition(
    "cfa-10921:0",
    "cfa-10921",
    "Divine Knight of Deeply-laid Strategems, Sajess",
    "D-SS05/008EN",
    "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2F008EN&expansion=206&view=image"
  ),
  definition(
    "cfa-10924:0",
    "cfa-10924",
    "Elbard X-striker",
    "D-SS05/FFR03EN",
    "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2FFFR03EN&expansion=206&s_param=d-Brandt+Gate&view=image"
  ),
  definition(
    "cfa-10925:0",
    "cfa-10925",
    "Yearnful Flower Maiden, Florence",
    "D-SS05/009EN",
    "https://en.cf-vanguard.com/cardlist/?cardno=D-SS05%2F009EN&expansion=206&s_param=d-Stoicheia&view=image"
  )
];
