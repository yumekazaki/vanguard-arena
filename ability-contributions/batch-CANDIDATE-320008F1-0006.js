"use strict";

// This batch is deliberately not emitting ability definitions. The local
// catalog has text for all ten abilities, but the shared game state and
// authoritative reducer cannot represent or resolve the required Protect
// marker rules yet. Returning a fabricated definition would make the UI look
// as if an ability were supported while it could not legally resolve.
const contribution = [];

Object.defineProperty(contribution, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "CANDIDATE-320008F1-0006",
    status: "blocked-on-shared-engine",
    dataset: "Cardfight Area card database snapshot",
    snapshotDate: "2025-05-09",
    provenanceNote: "The task owner flagged this card-text family as Thai-only provenance. The catalog contains English-rendered text, but no authoritative English card-text source was verified for this audit.",
    abilityIds: Object.freeze([
      "cfa-11499:0", "cfa-11499:1",
      "cfa-11500:0", "cfa-11500:1", "cfa-11500:2",
      "cfa-11503:0", "cfa-11503:1",
      "cfa-12727:0", "cfa-12727:1", "cfa-12727:2"
    ]),
    implementedAbilityIds: Object.freeze([]),
    blockers: Object.freeze([
      "Player state tracks Protect tokens in hand/count only; it does not authoritatively record which circles carry Protect markers.",
      "The CONT engine has no controller marker-count condition or source-circle Protect-marker condition, and no conditional grant of Boost/Intercept or back-row intercept from those conditions.",
      "The existing protection handlers prevent an attack from hitting a unit; they do not prevent an opponent's card effect from choosing it.",
      "The Soul ACT needs the marker-count condition and an ordered source-from-Soul call followed by an optional Soul Charge; the reducer has no validated implementation for this exact sequence.",
      "The turn-end AUTO needs a count of normal-unit cards in Drop, a source Bind cost, and an atomic return-all-Drop-to-deck/shuffle/draw effect. Those checks and effect operation are absent."
    ])
  })
});

module.exports = contribution;
