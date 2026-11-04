"use strict";

// Audit-only batch. The only seemingly straightforward new AUTO in this set
// needs a legal zero-target no-op that the shared reducer cannot currently
// complete, so deliberately export no definitions rather than a soft-locking
// partial implementation.
const contribution = [];
const unsupportedSiblings = Object.freeze([
  { abilityId: "cfa-13994:0", blocker: "Requires selecting a grade 3+ Orfist specifically from Ride Deck, optional reveal, then draw if that reveal succeeds OR the live Vanguard meets the grade/name condition. There is no reviewed handler for that private Ride Deck choice and reveal-or-live-state sequence." },
  { abilityId: "cfa-13994:1", blocker: "World state is not represented as a continuous effect; this ability must verify that every Order Zone card is a World Set Order, then set Dark Night at one card or Abyssal Dark Night at two or more." },
  { abilityId: "cfa-13994:2", blocker: "Needs the live grade/name Vanguard condition, a same-turn Order Zone placement restriction, Soul Blast 1 and rest-source costs, Shadow Army token call to a chosen RC, and temporary source name change. The exact sequential token/name effect is not supported." },
  { abilityId: "cfa-8315:1", blocker: "World state and the condition that every Order Zone card is a World Set Order are not modeled. Its separate AUTO cfa-8315:0 is already supported." },
  { abilityId: "cfa-8316:0", blocker: "The generic placement trigger and retire-target handler work when a legal target exists, but the AUTO must also resolve when no opposing front-row Rear-Guard is available. Comprehensive Rules 4.52 sections 11.8.4.1.2-11.8.4.1.3 require choosing as many targets as possible (zero) and ignoring the target-dependent effect. The current reducer instead asks for a target and rejects with missing-ability-target, so contributing this definition would strand a legal game state." },
  { abilityId: "cfa-8316:1", blocker: "World state and the condition that every Order Zone card is a World Set Order are not modeled." },
  { abilityId: "cfa-9074:0", blocker: "World state and Order Zone World-card composition/count are not modeled for the conditional Dark Night/Abyssal Dark Night CONT." },
  { abilityId: "cfa-9074:1", blocker: "Requires the exact Shadow Army token placement event to be identified and to grant +5000 to that event's placed unit until turn end. There is no reviewed event-subject-target power handler for this token ability." }
]);

Object.defineProperties(contribution, {
  batchId: { value: "CANDIDATE-320008F1-0005", enumerable: false },
  audit: {
    enumerable: false,
    value: Object.freeze({
      status: "audit-only-blocked-on-shared-engine",
      dataset: "Cardfight Area card database snapshot",
      snapshotDate: "2025-05-09",
      abilityIds: Object.freeze([
        "cfa-13994:0", "cfa-13994:1", "cfa-13994:2",
        "cfa-8315:0", "cfa-8315:1",
        "cfa-8316:0", "cfa-8316:1",
        "cfa-9074:0", "cfa-9074:1"
      ]),
      implementedAbilityIds: Object.freeze([]),
      alreadySupportedAbilityIds: Object.freeze(["cfa-8315:0"]),
      unsupportedSiblings,
      rulesReference: "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      rulesNote: "Sections 11.8.4.1.2-11.8.4.1.3 specify resolving a fixed-number choice with as many targets as possible; if none can be chosen, none are chosen and target-dependent effects are ignored.",
      officialTextNote: "Official English text was checked for D-BT01/H30EN, D-SS08/017EN, and D-SS08/016EN. Twilight Frontier (D-PR/1222) has an official Japanese card listing; its English-rendered catalog text remains translation-provenance-limited.",
      officialReferences: Object.freeze([
        "https://en.cf-vanguard.com/cardlist/?cardno=D-BT01%2FH30EN&view=text",
        "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=211&sort=no&view=text",
        "https://en.cf-vanguard.com/cardlist/?cardno=D-SS08%2F016EN&view=text",
        "https://cf-vanguard.com/cardlist/?cardno=D-PR%2F1222"
      ]),
      catalogTextAnomalies: Object.freeze([
        { abilityId: "cfa-13994:2", note: "The catalog appends '(SHIFT + left click to call tokens.)' to the ACT text block. This is a simulator instruction, not printed ability text; the printed ability ends after the temporary name change." }
      ]),
      nonAbilityOrderCosts: Object.freeze([
        { cardId: "cfa-8315", printedText: "Play this with COST [Soul Blast 1]", note: "Order-play cost, outside the two parsed AUTO/CONT blocks." },
        { cardId: "cfa-8316", printedText: "Play this with COST [Soul Blast 1]", note: "Order-play cost, outside the two parsed AUTO/CONT blocks." },
        { cardId: "cfa-9074", printedText: "Play this with COST [Soul Blast 2]", note: "Order-play cost, outside the two parsed CONT/AUTO blocks." }
      ])
    })
  },
  unsupportedSiblings: { value: unsupportedSiblings, enumerable: false }
});

module.exports = contribution;
