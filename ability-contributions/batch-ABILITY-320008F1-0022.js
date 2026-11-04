"use strict";

// Audit-only contribution for batch 0022. No new ability is compiled here:
// the catalog is a local Cardfight Area snapshot and this batch has no official
// Bushiroad card references attached to its entries. Existing compiled
// definitions are reported separately from text that still needs review.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");
const fs = require("node:fs");
const path = require("node:path");

const abilityIds = Object.freeze([
  "cfa-10577:0", "cfa-10578:0", "cfa-10580:0", "cfa-10580:1", "cfa-10581:0",
  "cfa-10581:1", "cfa-10582:0", "cfa-10582:1", "cfa-10583:0", "cfa-10584:0",
  "cfa-10584:1", "cfa-10585:0", "cfa-10585:1", "cfa-10586:0", "cfa-10587:0",
  "cfa-10589:0", "cfa-1058:0", "cfa-1058:1", "cfa-10590:0", "cfa-10590:1",
  "cfa-10591:0", "cfa-10591:1", "cfa-10592:0", "cfa-10593:0", "cfa-10594:0",
  "cfa-10595:0", "cfa-10597:0", "cfa-10599:0", "cfa-10599:1", "cfa-1059:0",
  "cfa-1059:1", "cfa-10600:0", "cfa-10600:1", "cfa-10601:0", "cfa-10601:1",
  "cfa-10601:2", "cfa-1060:0", "cfa-1060:1", "cfa-1060:2", "cfa-106:0"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-1058:1", "cfa-1059:0", "cfa-106:0"]);
const proposedDefinitions = Object.freeze([]);
const officialReferences = Object.freeze({});
const verifiedOfficialAbilities = Object.freeze([]);

const blockerById = Object.freeze({
  "cfa-10577:0": "The trigger requires this exact card to move from RC into Soul, checks four face-down damage cards, then binds that same card as a cost before Counter Charging. The current handlers do not validate the source movement, damage condition, and bind cost as one atomic resolution.",
  "cfa-10578:0": "This hand-to-RC placement AUTO pays Counter Blast, searches the top five, filters out names already in Soul, and moves the selected card into Soul. The filtered search-to-Soul transaction and cost validation are not available as a trusted combined handler.",
  "cfa-10580:0": "The VC placement AUTO searches the top five for up to two Stealth normal units, reveals the chosen cards, puts one into Soul, binds the remainder, and shuffles. The engine does not yet validate this multi-card choice and split-zone resolution in order.",
  "cfa-10580:1": "This manual ACT is usable from Bind Zone only, checks the current Vanguard's grade and Stealth name, pays Soul Blast 1, and calls this exact bound instance. Bind Zone action timing and atomic source-zone/cost/call validation are not supported together.",
  "cfa-10581:0": "The VC placement AUTO shares the top-five Stealth selection, but puts one chosen card into Soul and calls the rest to RC. The ordered multi-target selection, reveal, Soul movement, filtered calls, and shuffle have no trusted combined effect program.",
  "cfa-10581:1": "This manual ACT is usable from Bind Zone, requires a grade 2 or greater Stealth Vanguard, pays Soul Blast 1, and calls this exact instance. Bind Zone activation timing and source/cost/call validation are not implemented together.",
  "cfa-10582:0": "The once-per-turn ACT binds two Stealth cards from Soul, selects two opposing RCs, binds every card there, and schedules those cards to return to the opponent's hand at end of turn. Multi-source costs, two-target selection, mass movement, and delayed return are unsupported as a single legal sequence.",
  "cfa-10582:1": "This VC attack AUTO pays Counter Blast and moves two of its controller's rear-guards to Soul, calls a Stealth card from Bind Zone, then conditionally powers the called instance. The exact attack event, multi-card cost, filtered call, and conditional target effect are not validated together.",
  "cfa-10583:0": "After hand-to-RC placement it pays Counter Blast and gives the opponent a choice to bottom-deck a card from their Bind Zone; only if they decline does it permit a filtered Stealth call from the controller's Bind Zone. Opponent-private choice and dependent follow-up resolution are not supported as this exact effect.",
  "cfa-10584:0": "This AUTO requires this exact card to enter RC from Bind Zone, then grants it +5000 until turn end. Existing placement triggers do not authorize this exact Bind-to-RC origin and matching source instance for the modifier.",
  "cfa-10584:1": "This source-specific RC attack AUTO pays Soul Blast 1, chooses an opponent's bound card, and puts that card on the bottom of their deck. Opponent Bind Zone target selection and bottom-deck movement are not a trusted combined handler.",
  "cfa-10585:0": "The placement AUTO must be caused by a card ability, checks whether the Vanguard is Tamayura or Shojodoji, pays Soul Blast 1, and draws. The engine does not preserve and validate the exact placement cause alongside the archetype condition and cost.",
  "cfa-10585:1": "This CONT checks whether at least two cards moved from RC into Soul during the current turn, then grants this unit +10000. The engine does not currently maintain this exact turn-scoped movement count for continuous evaluation.",
  "cfa-10586:0": "The placement AUTO checks for at least two Set Orders in Order Zone and optionally Soul Charges 1. The dynamic Order Zone count and optional Soul Charge prompt are not represented by a reviewed definition for this text.",
  "cfa-10587:0": "On its own RC attack it pays Soul Blast 1 and asks the opponent to bind three cards from Drop; if fewer than three are bound, this source gains power for the battle. The opponent's private multi-card choice and dependent count result are not resolved by a trusted handler.",
  "cfa-10589:0": "This RC placement AUTO discards a hand card, counts distinct Research names in Order Zone to determine a variable top-deck look, selects a card, and shuffles. Dynamic look count, discard cost, and search resolution are not modeled as this exact sequence.",
  "cfa-1058:0": "The legacy Limit Break ability opens at the beginning of the guard step when this Vanguard is attacked, may pay Counter Blast and discard a same-name card, then selects that attacking unit for -20000 this battle. The guard-step response window and chosen attacker modifier are not a trusted effect path.",
  "cfa-10590:0": "This CONT combines an Order Zone threshold, the Eva Glitter condition, power while on RC, and shield while on GC (including the opponent's turn). The required conjunction and location-specific power/shield evaluation are not compiled for this exact text.",
  "cfa-10590:1": "This CONT changes the attack's target set only if this unit was called by an ability this turn and three Research cards are in Order Zone. The game does not model this continuous multi-unit attack rule or preserve the required call-cause history.",
  "cfa-10591:0": "The RC placement AUTO pays Soul Blast 1, searches the top seven for a Set Order, reveals and adds it to hand, then shuffles. This exact cost plus typed top-deck search transaction is not supported by a trusted definition.",
  "cfa-10591:1": "Once per turn, this rear-guard responds only when another unit is placed on RC by a card ability, then gains Boost until turn end. Ability-caused placement identity and a temporary keyword grant are not handled together for this trigger.",
  "cfa-10592:0": "At battle close, this exact unit must have attacked while boosted and the controller must have three or more face-down damage cards; it then moves itself to Soul and Counter Charges. The per-battle boost association, damage condition, and self-movement cost are not validated together.",
  "cfa-10593:0": "This AUTO requires this exact unit to be placed on RC from Deck by a Vanguard ability, then grants Boost and +5000 until end of turn. The engine does not preserve the placement origin and causing ability identity for both effects.",
  "cfa-10594:0": "This source's attack power is based on the number of pairs of Research cards in Order Zone at battle timing. The exact dynamic scaling formula and battle-duration modifier are not compiled for this ability.",
  "cfa-10595:0": "This AUTO triggers only when a Research is put into Order Zone, then retires this exact source as a cost and Counter Charges. Research identity, self-retirement cost authorization, and the resulting resource effect lack a reviewed combined handler.",
  "cfa-10597:0": "The RC placement AUTO requires a single-clan Vanguard, pays Soul Blast 1 and a hand discard, then selects a Drop card whose only clan matches the Vanguard and returns it to hand. The clan predicate and two-part cost/filtered target transaction are unsupported together.",
  "cfa-10599:0": "The ride-upon AUTO requires a Genesis-only rider, looks at the top five, chooses up to two cards into Soul, and shuffles. Rider-clan validation and filtered multi-card ride-trigger resolution are not a trusted combined effect.",
  "cfa-10599:1": "This card must move from Soul to Drop, check for a Minerva Vanguard, call itself to a back-row RC, and optionally Soul Charge after the call. The movement-cause condition, self-call, and dependent optional effect are not supported together.",
  "cfa-1059:1": "The VC ACT pays Counter Blast, chooses a grade 2+ Murakumo rear-guard, searches and calls its same-name copy, then schedules that exact called copy to bottom-deck at turn end. Filtered copy selection and delayed instance-specific movement are not implemented together.",
  "cfa-10600:0": "The ride-upon AUTO requires a Genesis-only rider, looks at the top five, selects up to two cards into Soul, and shuffles. The engine lacks a trusted definition covering the rider-clan condition and multi-card resolution.",
  "cfa-10600:1": "This AUTO requires this card to move from Soul to Drop during its controller's turn, checks for a Minerva Vanguard, pays Counter Blast 1, and calls this instance to RC. The zone-transition cause, timing, and paid self-call are not validated together.",
  "cfa-10601:0": "This VC CONT checks controller-turn timing and for a grade 3 Regalia in Soul, then grants +5000 to every front-row unit. The Soul filter and multi-target continuous power application are not supported as this exact definition.",
  "cfa-10601:1": "This once-per-turn VC ACT pays Soul Blast 1, privately inspects the top card, then chooses to leave it on top or move it into Soul. The private reveal/choice and mutually exclusive destination are not represented by a trusted effect handler.",
  "cfa-10601:2": "After this source's attack ends, once per turn and only against a grade 3+ Vanguard, it pays Counter Blast 1, Soul Blasts 3, and discards a Genesis-only card before standing and losing one Drive until turn end. Battle-close timing, filtered discard cost, and atomic restand/Drive change are not supported together.",
  "cfa-1060:0": "This AUTO triggers only when this exact card enters RC from Deck, then may pay Counter Blast 1 to retire an opposing grade 2+ front-row rear-guard. The Deck-origin event, optional payment prompt, and validated opposing target are not compiled together.",
  "cfa-1060:1": "This AUTO retires this exact rear-guard at the end of the battle in which it was attacked. The engine does not yet resolve this source-specific attacked-battle close timing as a supported effect.",
  "cfa-1060:2": "This CONT changes the card's clan identity to include Gold Paladin. Dynamic clan identity affects other rules and card filters; no reviewed identity-modifier definition supports it."
});

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "ability-work-assignments.json"), "utf8"))
  .completedAssignments.find(batch => batch.batchId === "ABILITY-320008F1-0022" && batch.auditOnly === true);
if (!assignment) throw new Error("Completed audit ABILITY-320008F1-0022 is missing from the assignment history.");
if (JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...abilityIds].sort())) {
  throw new Error("Contribution ability IDs differ from the reserved assignment.");
}

const supportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing exact catalog ability or blocker: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: null,
    officialReference: null,
    blocker: blockerById[abilityId]
  });
}));

const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    officialPrintedText: null,
    officialReference: null
  });
}));

module.exports = Object.freeze({
  batchId: "ABILITY-320008F1-0022",
  abilityIds,
  alreadySupportedAbilityIds,
  supportedDefinitions,
  proposedDefinitions,
  unsupportedSiblings,
  verifiedOfficialAbilities
});
