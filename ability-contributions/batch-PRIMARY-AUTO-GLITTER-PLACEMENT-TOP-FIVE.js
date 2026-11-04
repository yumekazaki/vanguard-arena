"use strict";

const IDS = ["cfa-13520", "cfa-13542", "cfa-13584", "cfa-13608", "cfa-13621"];
const PRINTED_TEXT = new Map([
  ["cfa-13520", "AUTO: When this unit is placed on RC from hand, if your vanguard is a Glitter, look at the top five cards of your deck, choose up to one Glitter from among them, reveal it and put it into hand, and shuffle the deck. If you revealed a card, put this unit into soul."],
  ["cfa-13542", "AUTO: When this unit is placed on RC from hand, if your vanguard is a Glitter, look at the top five cards of your deck, choose up to one Glitter from among them, reveal it and put it into hand, and shuffle the deck. If you revealed a card, put this unit into soul."],
  ["cfa-13584", "AUTO: When this unit is placed on RC from hand, if your vanguard is a Glitter, look at the top five cards of your deck, choose up to one Glitter from among them, reveal it and put it into hand, and shuffle the deck. If you revealed a card, put this unit into soul."],
  ["cfa-13608", "AUTO: When this unit is placed on RC from hand, if your vanguard is a Glitter, look at the top five cards of your deck, choose up to one Glitter from among them, reveal it and put it into hand, and shuffle the deck. If you revealed a card, put this unit into soul."],
  ["cfa-13621", "AUTO: When this unit is placed on RC from hand, if your vanguard is a Glitter, look at the top five cards of your deck, chooose up to one Glitter from among them, reveal it and put it into hand, and shuffle the deck. If you revealed a card, put this unit into soul."]
]);

module.exports = IDS.map(cardId => ({
  id: `${cardId}:0`,
  cardId,
  kind: "AUTO",
  printedText: PRINTED_TEXT.get(cardId),
  requiredLocation: ["rear-guard"],
  trigger: {
    status: "recognized-trigger",
    eventType: "card.placed",
    subject: "source",
    circles: ["rear-guard"],
    sourceLocation: "hand",
    destinationLocation: "rear-guard",
    subjectControllerRelation: "source-controller"
  },
  conditions: [{ type: "controller-vanguard-has-ability-keyword", value: "Glitter" }],
  conditionsReviewed: true,
  costs: [],
  costsReviewed: true,
  choicesReviewed: true,
  optional: false,
  source: {
    dataset: "Cardfight Area snapshot",
    snapshotDate: "2025-05-09",
    cardNumber: cardId,
    patternId: "auto-rc-hand-placement-glitter-top-five-to-hand-return-source-to-soul-v1",
    review: "Exact five-card AUTO family. This exact Rear-Guard source must be placed on RC from hand while its controller's Vanguard has the printed Glitter trait. The controller looks at up to the top five, may reveal and add up to one printed Glitter card to hand, and shuffles; only a nonempty revealedCardUid result moves this exact source from RC to Soul."
  },
  effects: [
    {
      op: "search-top-up-to-one-filtered-to-hand",
      target: "controller",
      lookCount: 5,
      maximum: 1,
      filter: { abilityKeyword: "Glitter" }
    },
    {
      op: "move-source-to-soul",
      target: "source",
      from: "rear-guard",
      ifPreviousEffectResult: {
        effectIndex: 0,
        property: "revealedCardUid",
        predicate: "nonempty-string"
      }
    }
  ]
}));
