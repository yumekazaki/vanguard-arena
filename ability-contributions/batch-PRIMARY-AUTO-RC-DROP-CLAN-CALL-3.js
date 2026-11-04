"use strict";

// Exact BT08 Tachikaze chain: each card in this family searches for the next
// named card after that exact instance moves from an RC to the Drop Zone.
// The effect op is already implemented by the shared engine.
const TARGETS = Object.freeze({
  "cfa-752": Object.freeze({ cardNumber: "BT08/080EN", targetName: "Carrier Dragon, Brachiocarrier" }),
  "cfa-755": Object.freeze({ cardNumber: "BT08/076EN", targetName: "Citadel Dragon, Brachiocastle" }),
  "cfa-765": Object.freeze({ cardNumber: "BT08/074EN", targetName: "Transport Dragon, Brachioporter" })
});

const OFFICIAL_QA = "https://en.cf-vanguard.com/howto/question/?id=basic";
const definitions = Object.entries(TARGETS).map(([cardId, spec]) => {
  const printedText = `AUTO: [Counter Blast 1] When this unit is put into the drop zone from RC, if you have a «Tachikaze» vanguard, you may pay the cost. If you do, search your deck for up to one card named "${spec.targetName}", call it to RC, and shuffle your deck.`;
  return Object.freeze({
    id: `${cardId}:0`, cardId, kind: "AUTO", printedText,
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger", eventType: "card.retired", subject: "event-subject",
      sourceLocation: "rear-guard", destinationLocation: "drop", subjectControllerRelation: "source-controller",
      circles: [],
      // “Put into the Drop Zone” is a destination condition. Handle both the
      // normal retirement event and an effect that moves the unit there.
      anyOf: [
        { eventType: "card.retired" },
        { eventType: "card.moved" },
        { eventType: "card.discarded" }
      ]
    },
    conditions: [{ type: "controller-vanguard-has-clan", value: "Tachikaze" }],
    conditionsReviewed: true,
    costs: [{ type: "counter-blast", count: 1 }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    source: {
      dataset: "Bushiroad official card list and official Q&A",
      officialCardNumber: spec.cardNumber,
      officialCardReference: `https://en.cf-vanguard.com/cardlist/?cardno=${encodeURIComponent(spec.cardNumber)}`,
      officialReference: OFFICIAL_QA,
      officialQAndA: ["Q272", "Q273"],
      patternId: "auto-rc-drop-tachikaze-counter-blast-search-named-call-v1",
      review: "Exact BT08 Tachikaze chain wording, checked against the catalog and Bushiroad Q272–Q273. The exact source instance must leave its own RC for the Drop Zone; its current controller must have a Tachikaze Vanguard. The controller may decline or pay Counter Blast 1, then may search their own deck for up to one Unit with the exact next-card name, call it standing to a legal open RC, and shuffle. A missing search target is legal and still shuffles (Q273); the same AUTO cannot pay its cost twice for one triggering event (Q272)."
    },
    effects: [{
      op: "search-deck-named-call-to-rearguard", target: "controller", cardName: spec.targetName,
      maximum: 1, destination: "rear-guard", position: "stand", opensSourceCircle: true
    }]
  });
});

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "PRIMARY-AUTO-RC-DROP-CLAN-CALL-3",
    abilityIds: Object.freeze(Object.keys(TARGETS).map(cardId => `${cardId}:0`)),
    status: "implemented-in-isolated-contribution-awaiting-core-integration",
    officialQAndA: OFFICIAL_QA,
    note: "The shared engine already implements the named deck search/call/shuffle handler, and the generic reducer correctly routes and resolves these registered definitions for either player. The optional AUTO may still be offered when its Counter Blast is unavailable; an attempted payment is rejected without partial changes, and the player can decline."
  })
});

module.exports = definitions;
