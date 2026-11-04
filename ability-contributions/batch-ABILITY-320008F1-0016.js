"use strict";

// Audit only: no new definitions are proposed for batch 0016. Four abilities
// already have reviewed production definitions; the other 38 are blocked on
// mechanics/legality that cannot safely be represented by existing handlers.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10410:0", "cfa-10410:1", "cfa-10411:0", "cfa-10411:1", "cfa-10411:2",
  "cfa-10411:3", "cfa-10412:0", "cfa-10412:1", "cfa-10413:0", "cfa-10413:1",
  "cfa-10414:0", "cfa-10414:1", "cfa-10415:0", "cfa-10415:1", "cfa-10416:0",
  "cfa-10416:1", "cfa-10417:0", "cfa-10417:1", "cfa-10418:0", "cfa-10419:0",
  "cfa-10420:0", "cfa-10421:0", "cfa-10422:0", "cfa-10423:0", "cfa-10423:1",
  "cfa-10424:0", "cfa-10425:0", "cfa-10425:1", "cfa-10425:2", "cfa-10426:0",
  "cfa-10426:1", "cfa-10427:0", "cfa-10428:0", "cfa-10429:0", "cfa-1042:0",
  "cfa-10430:0", "cfa-10430:1", "cfa-10431:0", "cfa-10432:0", "cfa-10432:1",
  "cfa-1043:0", "cfa-1043:1"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10411:0", "cfa-10425:0", "cfa-10432:0", "cfa-1043:0"
]);

const officialTextChecks = Object.freeze({
  "cfa-10410:0": {
    officialCardName: "Meteor Flare Dragon", officialCardNumber: "D-BT07/002EN",
    officialPrintedText: "[AUTO]:When this unit is placed on (RC), until end of turn, all of your opponent's rear-guards lose all of their [CONT] abilities, and cannot gain them. Then, [COST][Counter-Blast 1], choose one of your opponent's rear-guards in the same column as this unit, and retire it.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT07%2F002EN"
  },
  "cfa-10410:1": {
    officialCardName: "Meteor Flare Dragon", officialCardNumber: "D-BT07/002EN",
    officialPrintedText: "[CONT](RC):During your turn, if your opponent's vanguard is grade 3 or greater and they have no rear-guards, this unit gets [Power] +10000.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT07%2F002EN"
  },
  "cfa-1043:0": {
    officialCardName: "Tri-holl Dracokid", officialCardNumber: "BT09/028EN",
    officialPrintedText: "[AUTO]:Forerunner (When a unit of the same clan rides this unit, you may call this unit to (RC))",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F028EN",
    note: "The local snapshot says 'another unit from the same clan'; the official wording is 'a unit of the same clan'. Both identify the riding unit's clan and make the forerunner call optional."
  },
  "cfa-1043:1": {
    officialCardName: "Tri-holl Dracokid", officialCardNumber: "BT09/028EN",
    officialPrintedText: "[AUTO](RC):When this unit attacks, if you have an <Aqua Force> vanguard, and if it is the third battle of that turn or more, this unit gets [Power] +3000 until end of that battle.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F028EN"
  }
});

const blockerById = Object.freeze({
  "cfa-10410:0": "The placement AUTO must remove CONT abilities from every opponent Rear-Guard until turn end, then pay Counter-Blast 1 and retire an opponent Rear-Guard in this exact source's column. Current handlers do not encode a temporary opponent-wide ability loss followed by a column-scoped target and cost.",
  "cfa-10410:1": "This continuous bonus requires both the opponent Vanguard to be grade 3+ and the opponent to have zero Rear-Guards; the current condition model does not represent the opponent-board emptiness check together with this exact source's RC power.",
  "cfa-10411:1": "The Order Zone CONT creates a multi-name alias across all owned cards and separately forbids resting Gacha Redora. Name aliases affect card identity used by other abilities, while the action restriction needs enforcement; no current handler models both as continuous rules.",
  "cfa-10411:2": "The Order Zone CONT grants shield to every card matching an alias created by another ability on this same order. The current continuous evaluator does not resolve the cross-ability name alias and apply shield to all matching card instances.",
  "cfa-10411:3": "This AUTO requires the named Vanguard's attack, three matching-name cards across Soul/Monster BOX, a rest cost on this Order, and a player-selected Vanguard receiving battle-duration Drive. The combined cross-zone count, Order source cost, and choice are not supported.",
  "cfa-10412:0": "On this exact card's VC placement, the Event Order condition gates revealing a hand card, searching for that revealed name, putting it face-up in Monster BOX, and shuffling. The private reveal/search and Monster BOX destination are not a trusted ordered resolution.",
  "cfa-10412:1": "This ACT is restricted to RC and an Event in Order Zone; it pays Counter-Blast 1, moves a chosen damage card into Soul, then moves this source face-up into Damage. That ordered exchange and its selected damage target have no existing handler.",
  "cfa-10413:0": "This Vanguard CONT scales this source's power by two thousand for every opponent Bind card. The registered continuous evaluators do not support per-card bind-zone scaling for this source.",
  "cfa-10413:1": "At the end of this exact Vanguard's attack, this ability pays Counter-Blast and discard, rides a named Soul card as stand, grants it Critical and bind-count-based Power, then schedules a named ride from Soul/Drop as rest at turn end. The two rides and delayed return depend on tracked source battle, counts, targets, and timing not covered by current handlers.",
  "cfa-10414:0": "This 1/Turn RC ACT pays Counter-Blast 1 to bind an opponent front-row Rear-Guard, with a fallback that binds the opponent deck top if there is no legal target. Opponent-zone targeting, bind movement, fallback, and authoritative use tracking are not represented by one trusted effect.",
  "cfa-10414:1": "This AUTO only triggers when this source attacks and the opponent Bind Zone has at least three cards, then Soul-Charges. Source-matched attack timing plus the opponent bind threshold is not registered as a reviewed ability.",
  "cfa-10415:0": "On this exact source's RC placement, the opponent chooses a card in their Drop to bind, or binds their deck top if Drop is empty. The opponent-owned private choice and empty-zone fallback are unsupported.",
  "cfa-10415:1": "This RC CONT grants the Boost keyword only while the opponent Bind Zone contains at least three cards. Dynamic keyword grants based on opponent-owned zone counts are not supported.",
  "cfa-10416:0": "This RC CONT grants Intercept when the opponent Bind Zone reaches three cards. The current rules state does not dynamically enable the guardian action keyword from this opponent-zone condition.",
  "cfa-10416:1": "The AUTO can trigger from this exact card retiring from either RC or GC, including effect-specific timing, and asks the opponent to bind from their Drop with a deck-top fallback. The two-origin event and opponent-controlled choice/fallback are unimplemented.",
  "cfa-10417:0": "This front-row CONT requires the opponent Bind Zone threshold and grants +5000 to all of the controller's front-row units. The evaluator lacks this opponent-zone condition and all-front-row target scope.",
  "cfa-10417:1": "At the end of this source's RC attack, Soul-Blast 1 then the opponent chooses a Drop card to bind, falling back to the deck top if impossible. Source battle-close timing and opponent decision flow are absent.",
  "cfa-10418:0": "The Order Zone CONT changes the normal Persona Ride draw and power values for a Thegrea Vanguard. This is a replacement of a core Persona Ride procedure, not an ordinary continuous power modifier; no validated replacement hook exists.",
  "cfa-10419:0": "When this exact unit boosts, the controller reveals up to one hand unit and swaps it with a same-grade Monster BOX unit. The handler needs a private reveal, matching-grade selection, two-way zone swap, and boost-source identity.",
  "cfa-10420:0": "This RC CONT grants +10000 only at a Monster BOX count of ten or more. Monster BOX is not an authoritative modeled zone in the current continuous evaluator.",
  "cfa-10421:0": "This Drop AUTO triggers on Persona Ride, checks for any existing Bougainvillea name, and optionally calls this exact copy, with a shared restriction permitting only one copy from Drop. Drop-source prompts, duplicate-copy exclusion, and call resolution are not implemented together.",
  "cfa-10422:0": "This RC CONT grants Boost only when this exact instance was placed on RC from a non-hand origin during the current turn. The current evaluator does not retain a validated per-instance placement-origin/turn condition for keyword legality.",
  "cfa-10423:0": "The Order Zone CONT aliases eleven named cards to Guardians of the Heavens. This changes name-based eligibility across abilities and card instances; the engine has no persistent alias layer for a whole name family.",
  "cfa-10423:1": "The 1/Turn Order Zone ACT moves a Guardians Rear-Guard into Monster BOX as cost, then selects a different-name Monster BOX unit no higher than the Vanguard's grade to call. Monster BOX search, distinct-name validation, cost movement, and call are not covered by an existing trusted sequence.",
  "cfa-10424:0": "When this exact RC unit attacks under a named grade 3+ Vanguard, the optional +10000 branch schedules this source to enter Soul at that battle's end. Current handlers do not tie an optional attack-power choice to a delayed source movement.",
  "cfa-10425:1": "On this unit's VC placement, pay Counter-Blast 1, retire all opponent Rear-Guards, then grant this source turn power. Bulk opponent retirement plus the triggering placement and cost are not implemented as a reviewed ability.",
  "cfa-10425:2": "At this Vanguard's battle end, put two of the controller's Rear-Guards into Soul, ride a specific Uriel from Soul as stand, then apply Power and Drive modifiers through turn end. The cost, named Soul ride, and resulting battle stats need a dedicated validated sequence.",
  "cfa-10426:0": "On VC placement, privately inspect the top seven, select an Order card for hand, and shuffle. Existing top-card search handlers do not support this exact Order card-type filter and ordering.",
  "cfa-10426:1": "This RC AUTO fires on this source's attack or boost only while Order Zone contains a Pickup Gacha or Event ability, then grants +2000 for that battle. The combined event identity and Order-property condition are not a reviewed definition.",
  "cfa-10427:0": "This source must be attacking a Vanguard while actually boosted; it pays Counter-Blast and Soul-Blast, retires one opponent Rear-Guard or up to two after Persona Ride. The exact battle/booster identity, use-turn Persona Ride state, target choice, and variable retirement are unsupported.",
  "cfa-10428:0": "On this exact source's RC placement, choose and order up to three Normal units from Monster BOX to deck bottom, then only if exactly three were moved choose a Trigger unit from Monster BOX, return it to deck, and shuffle. The multi-zone choices and conditional shuffle sequence lack a safe handler.",
  "cfa-10429:0": "This GC CONT grants +10000 shield at Monster BOX count ten or more. The authoritative continuous check cannot read the separate Monster BOX zone.",
  "cfa-1042:0": "This RC ACT costs moving this exact unit into Soul, then if the Vanguard is Aqua Force chooses Damage and turns it face up. The payment move, conditional damage selection, and Counter-Charge operation are not supported as one atomic action.",
  "cfa-10430:0": "This VC CONT grants +5000 to every named Guardians of the Heavens Rear-Guard during the controller's turn if the opponent Vanguard is grade 3+. The family-name selector and opposing grade condition are not registered together.",
  "cfa-10430:1": "The 1/Turn ACT pays Soul-Blast 2, inspects top seven, chooses/reveals up to two matching units, calls one and sends the remaining selection to Monster BOX, then shuffles. Existing search handlers do not implement these ordered destinations or Monster BOX operations.",
  "cfa-10431:0": "At the end of this source's RC attack with a named Vanguard, pay Counter-Blast 1, choose and stand a back-row unit other than this card, then swap the two units' positions. Exact battle provenance and a stand-plus-position-swap sequence are unhandled.",
  "cfa-10432:1": "This 1/Turn ACT is usable on VC or RC, pays Counter-Blast 1 and rests this source, calls a chosen Monster BOX unit, then conditionally stands this source based on Vanguard identity/name/grade. Zone legality, Monster BOX selection, and post-call conditional stand are unsupported.",
  "cfa-1043:1": "This source's RC attack power applies only at its third-or-later battle and with an Aqua Force Vanguard. It has no reviewed production definition for the attack count and clan condition, though the separate Forerunner ability is supported."
});

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = catalogById.get(cardId);
  if (!card) throw new Error(`Assigned card missing from catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name, catalogText: card.text });
}));

const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = catalogById.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  const official = officialTextChecks[abilityId] || null;
  if (!ability?.definition || !Engine.getReviewedAbilityDefinitionsForCard(cardId).some(item => item.id === abilityId) ||
      !Reducer.hasTrustedServerAbilityDefinition(ability, Engine)) {
    throw new Error(`Expected trusted production definition missing: ${abilityId}`);
  }
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "reviewed production definition",
    officialCardName: official?.officialCardName || null,
    officialCardNumber: official?.officialCardNumber || null,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null,
    officialNote: official?.note || null });
}));

const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedAbilityIds.includes(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = catalogById.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  const official = officialTextChecks[abilityId] || null;
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed ability or blocker: ${abilityId}`);
  return Object.freeze({
    abilityId, cardId, cardName: card.name, kind: ability.kind,
    catalogPrintedText: ability.printedText,
    parsedCandidatePatternId: ability.definition?.source?.patternId || null,
    officialCardName: official?.officialCardName || null,
    officialCardNumber: official?.officialCardNumber || null,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null,
    blocker: blockerById[abilityId]
  });
}));

module.exports = Object.assign([], {
  audit: Object.freeze({
    batchId: "ABILITY-320008F1-0016",
    status: "four-existing-production-definitions-38-blocked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: true,
    officiallyCheckedAbilityIds: Object.freeze(Object.keys(officialTextChecks)),
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    cards,
    unsupportedSiblings,
    provenanceNote: "Every assigned ability is retained with exact local catalog wording. The official Bushiroad card lists were checked for Meteor Flare Dragon and Tri-holl Dracokid; their official English text and card numbers are recorded. The Twisted Severences, Highway to Hell, Uriel, and Metatron definitions are existing reviewed production definitions, but their printed text was not independently checked against an official listing in this audit. No new definitions are proposed; each remaining ability is explicitly blocked on the missing rule/handler described above."
  }),
  unsupportedSiblings
});
