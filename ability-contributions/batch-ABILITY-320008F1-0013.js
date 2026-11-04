"use strict";

// One exact, reusable hit-trigger variant is integrated here. It uses the same
// tested attack-hit and chosen-unit power operations as existing variants,
// while preserving this card's unfiltered Rear-Guard target restriction.
const definitions = [{
  id: "cfa-10343:0",
  cardId: "cfa-10343",
  kind: "AUTO",
  printedText: "AUTO [RC]: When this unit’s attack hits a vanguard, choose one of your rear-guards, and it gets power +5000 until end of turn.",
  requiredLocation: ["rear-guard"],
  trigger: {
    status: "recognized-trigger",
    eventType: "attack.hit",
    subject: "source",
    targetLocation: "vanguard",
    circles: []
  },
  conditions: [],
  costs: [],
  effects: [{
    op: "modify-power-target",
    target: "chosen",
    amount: 5000,
    duration: "turn",
    noOpIfNoLegalTargets: true,
    targetFilter: {
      controller: "source-controller",
      cardType: "unit",
      zone: "rear-guard"
    }
  }],
  optional: false,
  conditionsReviewed: true,
  costsReviewed: true,
  choicesReviewed: true,
  source: {
    dataset: "Cardfight Area snapshot",
    snapshotDate: "2025-05-09",
    cardNumber: "cfa-10343",
    patternId: "auto-rc-own-attack-hit-rearguard-power-turn-v1",
    review: "Exact Rear-Guard AUTO from the local catalog snapshot. Only this source's attack hitting the opposing Vanguard qualifies. Its controller chooses a friendly Rear-Guard, including the source if desired, and gives it +5000 until end of turn. The target is intentionally not restricted by clan."
  }
}];

const abilityIds = Object.freeze([
  "cfa-10337:0", "cfa-10338:0", "cfa-10339:0", "cfa-10339:1", "cfa-10341:0",
  "cfa-10342:0", "cfa-10343:0", "cfa-10344:0", "cfa-10344:1", "cfa-10345:0",
  "cfa-10346:0", "cfa-10347:0", "cfa-10348:0", "cfa-10349:0", "cfa-1034:0",
  "cfa-10350:0", "cfa-10352:0", "cfa-10353:0", "cfa-10354:0", "cfa-10355:0",
  "cfa-10356:0", "cfa-10357:0", "cfa-10358:0", "cfa-10359:0", "cfa-10359:1",
  "cfa-10360:0", "cfa-10360:1", "cfa-1035:0", "cfa-1036:0", "cfa-1036:1"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-10348:0", "cfa-1034:0", "cfa-10360:0"]);
const proposedAbilityIds = Object.freeze(["cfa-10343:0"]);
const blockerById = Object.freeze({
  "cfa-10337:0": "ACT requires a three-grade-3-unit board condition, paying by retiring this exact source, then choosing and bottom-decking an opposing Rear-Guard; the condition and opponent-target action are not represented together.",
  "cfa-10338:0": "AUTO triggers on a different card, the controller's Vanguard, attacking only while it has critical 2 or greater; the cross-source attack trigger and critical check are unmodeled, followed by Soul Blast 1 and two power modifiers.",
  "cfa-10339:0": "CONT depends on a turn-wide count of the controller's boost events; this ability needs event history and a dynamic power condition.",
  "cfa-10339:1": "AUTO triggers at the close of this source's attack on a Vanguard, checks a Lianorn Vanguard and five boost events this turn, pays Counter Blast 1 and moves this source to Soul, then stands a chosen Rear-Guard; trigger history and ordered resolution are unsupported.",
  "cfa-10341:0": "From-hand placement AUTO pays Counter Blast 1, privately inspects three deck cards, chooses up to one grade-3-or-less card to call with a granted Boost ability, and discards the rest; ordered private choice and keyword-grant effects are not covered.",
  "cfa-10342:0": "From-hand placement AUTO has grade and Vanguard-name conditions, Counter Blast 1 plus Soul Blast 1, discards three deck cards, then selects from Drop with grade-dependent call and name-dependent hand destinations; the conditional sequence needs authoritative clarification and handlers.",
  "cfa-10344:0": "Guardian Circle CONT grants shield only while the Order Zone contains a Meteorite; continuous shield evaluation lacks the exact Meteorite-presence predicate.",
  "cfa-10344:1": "Placement AUTO reveals the deck top, conditionally moves a Meteorite to the Order Zone or puts a non-Meteorite on the bottom; the reveal and mutually exclusive destinations are not represented as one exact sequence.",
  "cfa-10345:0": "Source attack AUTO pays Soul Blast 1 and discards a hand card, retrieves a Meteorite from Drop, and grants battle power; typed cost, filtered target, and ordered effects need a trusted definition.",
  "cfa-10346:0": "Once-per-turn ACT requires Soul Blast 6 specifically from grade-0 Soul cards, Soul Charges 6, then chooses six distinct units for +10000 until end of turn; typed costs and multi-target resolution are missing.",
  "cfa-10347:0": "Once-per-turn ACT Soul Blasts a grade-1-or-greater card, then chooses two grade-0 Drop cards for Soul; typed cost, exact target count, and usage restriction need authoritative validation.",
  "cfa-10349:0": "Source attack AUTO requires a Baromagnes Vanguard and scales its own battle power by Soul count; the exact name predicate and dynamic per-Soul computation are not modeled for this card.",
  "cfa-10350:0": "Placement from Soul AUTO discards a card, then chooses a grade-2-or-less Soul card to call to the same column; source-move provenance, atomic cost, and same-column destination are unsupported.",
  "cfa-10352:0": "ACT pays Counter Blast 1 and moves this source to Soul, privately looks at the top two cards, chooses up to one to call, and Soul Charges the rest; exact private ordering and optional call are unsupported.",
  "cfa-10353:0": "Placement-from-Soul AUTO pays Soul Blast 1 and grants this source +10000 until turn end; source-zone provenance and cost timing have no exact trusted definition for this text.",
  "cfa-10354:0": "Back-row CONT conditionally grants Boost at six Soul and +10000 at twelve Soul; the live continuous keyword grant and threshold behavior need dedicated handlers.",
  "cfa-10355:0": "AUTO triggers when this card becomes an originalDress, pays Counter Blast 1, and calls a filtered grade-1-or-less Prayer Dragon from Drop; originalDress state-transition identity and filter are unmodeled.",
  "cfa-10356:0": "CONT combines own-turn +10000 with an attack restriction that depends on an opposing front-row Rear-Guard; dynamic power and opponent-board action restriction are not supported together.",
  "cfa-10357:0": "Source attack AUTO checks for a different Rear-Guard with at least two originalDress cards; source-specific attack identity and originalDress count condition are not modeled.",
  "cfa-10358:0": "ACT requires an Eugene Vanguard and binds this source, selects up to two eligible Normal Units from Drop, then chooses Soul or ordered deck-top placement based on opponent retirement history; event-cause history and branch resolution are missing.",
  "cfa-10359:0": "CONT prohibits riding this card and normal calling it from hand; both action restrictions must be enforced by the ride and call legality validators.",
  "cfa-10359:1": "Discard-from-hand AUTO checks turn and grade-3-or-greater Vanguard, pays Soul Blast 1, and calls this exact source to back-row RC; source-discard event provenance and legal destination need a trusted resolver path.",
  "cfa-10360:1": "AUTO is tied to a Vanguard placement specifically by RevolDress, pays by moving this source to Soul, then chooses a Vanguard and sets its drive to 1; the placement cause and drive-change choice are not modeled.",
  "cfa-1035:0": "Optional Vanguard attack AUTO pays Counter Blast 1 and scales power by the number of same-name Rear-Guards; exact name count, optional cost prompt, and battle-only modifier need a trusted handler.",
  "cfa-1036:0": "Limit Break 4 Vanguard hit AUTO may pay Counter Blast 1 to retire every opposing grade-3 Rear-Guard; the board threshold and mass filtered retirement are not combined in an exact authoritative effect.",
  "cfa-1036:1": "Vanguard CONT grants +3000 during the controller's turn if they have a grade-3 Narukami Rear-Guard; exact clan-and-grade board condition is not represented for this definition."
});

if (abilityIds.length !== 30 || alreadySupportedAbilityIds.length + proposedAbilityIds.length + Object.keys(blockerById).length !== abilityIds.length) {
  throw new Error("ABILITY-320008F1-0013 audit must account for each assigned ability exactly once.");
}
const contribution = definitions;
Object.defineProperty(contribution, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0013",
    status: "one-tested-definition-integrated-three-existing-twenty-six-blocked",
    dataset: "Cardfight Area local card catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: false,
    officialLookupNote: "Attempted an official-domain lookup for Ferocious Hunter; no official card-list result was returned. The proposal was compared against the exact catalog text and the existing reviewed own-attack-hit target-power family.",
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: proposedAbilityIds,
    originallyProposedDefinitionIds: proposedAbilityIds,
    proposedDefinitions: Object.freeze(definitions.slice()),
    alreadySupportedAbilityIds,
    blockedAbilityIds: Object.freeze(Object.keys(blockerById).sort()),
    blockers: blockerById,
    provenanceNote: "The integrated Rear-Guard hit trigger reuses existing attack-hit event matching and the existing chosen-unit power handler. Its behavior has focused host/joiner reducer tests. Its text is preserved from the local catalog snapshot and is not labeled official-text checked. Unsupported siblings are not compiled or treated as playable."
  })
});
Object.defineProperty(contribution, "unsupportedSiblings", {
  enumerable: false,
  value: Object.freeze(Object.entries(blockerById).map(([abilityId, blocker]) => Object.freeze({ abilityId, blocker })))
});

module.exports = contribution;
