"use strict";

// Batch audit only: this batch contains four abilities already supported by
// reviewed production definitions. The other 34 need mechanics that are not
// currently implemented or trusted; no placeholder definitions are proposed.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10385:0", "cfa-10386:0", "cfa-10387:0", "cfa-10388:0", "cfa-10389:0", "cfa-10390:0", "cfa-10391:0", "cfa-10392:0", "cfa-10394:0", "cfa-10396:0", "cfa-10397:0", "cfa-10398:0", "cfa-10399:0",
  "cfa-10400:0", "cfa-10400:1", "cfa-10400:2", "cfa-10401:0", "cfa-10401:1", "cfa-10401:2", "cfa-10401:3", "cfa-10402:0", "cfa-10402:1", "cfa-10403:0", "cfa-10404:0", "cfa-10404:1", "cfa-10405:0", "cfa-10405:1", "cfa-10406:0", "cfa-10406:1", "cfa-10407:0", "cfa-10407:1", "cfa-10408:0", "cfa-10408:1", "cfa-10409:0", "cfa-1041:0", "cfa-1041:1", "cfa-104:0", "cfa-104:1"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-10401:0", "cfa-1041:0", "cfa-104:0", "cfa-104:1"]);
const blockerById = Object.freeze({
  "cfa-10385:0": "The ACT searches for either of two distinct named Orders from Deck or Drop after retiring this source; the existing named-search operation accepts one exact card name and cannot represent the union.",
  "cfa-10386:0": "Guardian AUTO requires an Order Zone Product predicate; no trusted live Order Zone Product condition exists for a shield effect at GC timing.",
  "cfa-10387:0": "Placement AUTO combines a main-phase/source condition, counter blast, exact soul grade selection, same-name-to-hand versus call branching, and conditional power. The required atomic branch and target legality are not supported.",
  "cfa-10388:0": "End-of-battle AUTO selects ten soul cards to retain, returns every other soul card to the deck, and shuffles; there is no private exact-ten selection plus bulk-zone move operation.",
  "cfa-10389:0": "Placement AUTO pays two ordered costs, then privately selects a grade 1 Soul card to hand; current effect handlers do not support this exact cost-and-zone selection sequence.",
  "cfa-10390:0": "The trigger requires the exact boosted attack to hit and a stand Vanguard with a named condition, then stands the booster under a once-per-turn restriction; this composite hit/battle state is not a trusted ability program.",
  "cfa-10391:0": "CONT modifies the costs of the Vanguard's original AUTO abilities beginning with battle five; ongoing cost replacement and battle-count timing are not represented.",
  "cfa-10392:0": "AUTO checks an exact battle number and named stand Vanguard at the end of a Rear-Guard's Vanguard attack, then pays Soul Blast and stands itself with power; the battle-count condition is unsupported.",
  "cfa-10394:0": "Boosted-battle-close AUTO needs a Nirvana-name predicate, source-to-Soul cost, and an originalDress target marker/modifier; the named target/status and ordered resolution are not available.",
  "cfa-10396:0": "AUTO triggers on a custom originalDress state and conditionally Soul Charges two only when Soul is empty; originalDress event and empty-Soul condition are unsupported.",
  "cfa-10397:0": "Placement AUTO requires a grade condition, Counter Blast, private look at top three, and arbitrary ordering of all three cards. The existing reorder handler only covers one top card, not a multi-card reorder.",
  "cfa-10398:0": "Guardian AUTO scales shield by the count of the controller's Vanguard and Rear-Guards; no exact per-count shield effect exists.",
  "cfa-10399:0": "On-hit AUTO requires choosing an opposing Rear-Guard and putting it on the bottom of its owner's deck; no trusted opponent-target-to-deck-bottom effect is available.",
  "cfa-10400:0": "CONT depends on persona ride history and modifies all back-row unit power from the Vanguard; persona-ride continuous modifier provenance is unsupported.",
  "cfa-10400:1": "ACT draws, then chooses a hand card to call to back-row center with temporary permission to attack plus power; the new attack legality/status is unsupported.",
  "cfa-10400:2": "AUTO triggers at battle close when the exact back-row-center unit attacks, moves that instance to Soul, then draws; the required attack window and multi-step source movement are not a trusted operation.",
  "cfa-10401:1": "Main-phase AUTO gives the opponent a mandatory Rear-Guard choice and retirement, then conditionally modifies the Vanguard if no ride occurred; opponent-private choice and ride-history branch are not modeled together.",
  "cfa-10401:2": "AUTO reacts to opponent Rear-Guard retirement during the controller's turn, costs a hand card to Soul, and draws; the cause/controller-aware retirement predicate and atomic cost sequence are unsupported.",
  "cfa-10401:3": "Once-per-turn battle-close AUTO sums grades of Dark States cards in Soul, Counter Blasts two, stands the Vanguard, and reduces Drive; typed Soul-grade sum and drive change are not supported as this exact sequence.",
  "cfa-10402:0": "Ride placement searches Deck or Hand for two custom external-game ability tags and puts the result into Order Zone, with a hand-source draw branch; these card metadata filters and ordered branch are absent.",
  "cfa-10402:1": "Placement AUTO selects and stands an Order Zone card by exact name; the supported stand target scope does not cover a private selected Order Zone card.",
  "cfa-10403:0": "Order Zone CONT grants a named ability and custom Pull Targets status to multiple cards and another Order; no dynamic granted ability or shared custom-name status is implemented.",
  "cfa-10404:0": "Placement-from-Drop AUTO privately chooses top versus bottom and gives power only on the bottom branch; the required movement-cause condition and conditional deck-choice sequence are unsupported.",
  "cfa-10404:1": "Boost-close AUTO retires this source, chooses a custom Pull Targets unit, and grants power; the source-scoped custom-name status and target legality are unsupported.",
  "cfa-10405:0": "Guardian CONT checks a custom Pull Targets Vanguard name and grants shield; dynamic custom card-name identity is not represented by a trusted condition.",
  "cfa-10405:1": "Ability-placement AUTO grants a temporary trigger-unit classification and power; temporary trigger-type mutation is not an available effect.",
  "cfa-10406:0": "ACT from Monster BOX checks a custom Vanguard condition, places a hand card into Monster BOX, calls this source, and conditionally modifies power; Monster BOX zones and this multi-step effect are unsupported.",
  "cfa-10406:1": "Attack-close AUTO conditionally retires the source and Counter Charges; exact named Vanguard condition and atomic retirement/resource sequence are not supported.",
  "cfa-10407:0": "ACT pays Counter Blast, selects up to two matching cards in Drop, calls them, and modifies both; custom Pull Targets filtering and multiple private target resolution are unsupported.",
  "cfa-10407:1": "AUTO triggers when the opponent first places a Guardian in the battle, pays Soul Blast, then selects and retires one of those exact Guardians; the first-Guardian timing and opponent zone selection are unsupported.",
  "cfa-10408:0": "Placement AUTO pays Soul Blast and chooses a grade 0 from Drop to call; current call-from-Drop handlers require the source card itself or a narrower typed trigger target.",
  "cfa-10408:1": "Attack-close AUTO costs Counter Blast and this source to Monster BOX, selects another named unit there to call, and changes its ability costs for the turn; Monster BOX movement and temporary cost modification are absent.",
  "cfa-10409:0": "Placement AUTO pays two resources, privately chooses from top three, then calls a grade 2-or-less Unit or adds a non-unit to Hand; conditional type/grade destination and shuffle sequencing are unsupported.",
  "cfa-1041:1": "AUTO needs an attack hit during the exact battle this source boosted an Aqua Force, then pays Counter Blast and source-to-Soul before standing an Aqua Force Rear-Guard; no trusted combined boost-battle/hit target effect covers it."
});

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const supported = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(abilityId => !supported.has(abilityId)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing catalog ability or concrete blocker for ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, officialReference: null, blocker: blockerById[abilityId] });
}));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(byCard.get(cardId)).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing definition missing: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText, definitionSource: ability.definition.source?.patternId || "compiled production definition" });
}));

const result = [];
Object.defineProperty(result, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0015",
    status: "four-existing-definitions-one-card-gate-34-blocked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: true,
    officialReferences: Object.freeze({ "cfa-104": "https://en.cf-vanguard.com/cardlist/?cardno=BT01%2FS12EN" }),
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    fullyTestedWholeCardIds: Object.freeze(["cfa-104"]),
    unsupportedSiblings,
    provenanceNote: "The 38 assigned records were inspected independently. The exact Battleraizer official text confirms its two parsed abilities; this batch adds direct two-seat resolution coverage for that one whole card. The remaining 34 abilities retain explicit blockers and no placeholder effects were added."
  })
});
Object.defineProperty(result, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = result;
