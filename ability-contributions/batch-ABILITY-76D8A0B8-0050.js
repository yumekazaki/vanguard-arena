"use strict";

// Exact shared Order Zone AUTO text for three Iron Armor Little Treasure cards.
// Trigger matching and the authoritative Order Zone -> hand handler are covered
// by ability-auto-order-zone-grade-one-return-to-hand-server.test.js.
const CARD_IDS = Object.freeze(["cfa-12298", "cfa-12299", "cfa-12312"]);
const PRINTED_TEXT = "AUTO [Order Zone]: When your grade 1 card is put into your order zone, put this card into your hand. (This effect is mandatory)";
const PATTERN_ID = "auto-order-zone-grade-one-placement-return-source-hand-v1";

const proposedDefinitions = CARD_IDS.map(cardId => {
  const abilityIndex = cardId === "cfa-12298" ? 3 : 1;
  return {
    id: `${cardId}:${abilityIndex}`,
    cardId,
    kind: "AUTO",
    printedText: PRINTED_TEXT,
    requiredLocation: ["order"],
    trigger: {
      status: "recognized-trigger",
      eventType: "card.placed",
      subject: "any",
      circles: ["order"],
      destinationLocation: "order",
      subjectControllerRelation: "source-controller"
    },
    conditions: [{ type: "event-subject-grade-equals", count: 1 }],
    costs: [],
    optional: false,
    canDecline: false,
    conditionsReviewed: true,
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: PATTERN_ID,
      review: "Exact shared AUTO text from the Cardfight Area catalog snapshot. The exact ability source must remain in its controller's Order Zone. It triggers when any grade 1 card controlled by that same player is newly placed in that Order Zone, including this source itself, and mandatorily moves only that source instance to its controller's hand. No acting-player, turn, phase, or different-card restriction is printed. The authoritative reducer revalidates the event subject, grade, controller, source zone, and exact card instances before moving the source; host and joining seats are covered by server regression tests."
    },
    effects: [{ op: "move-source-order-to-hand", target: "source", from: "order" }]
  };
});

module.exports = { proposedDefinitions };
