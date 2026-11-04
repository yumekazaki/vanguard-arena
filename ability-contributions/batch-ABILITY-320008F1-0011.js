"use strict";

// Batch audit only. Existing trusted definitions are documented below; the
// remaining catalog abilities fail closed because their exact resolution
// programs or timing/cost gates are not available in the production engine.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10288:0", "cfa-10288:1", "cfa-10289:0", "cfa-10289:1", "cfa-10290:0",
  "cfa-10291:0", "cfa-10291:1", "cfa-10292:0", "cfa-10293:0", "cfa-10294:0",
  "cfa-10295:0", "cfa-10296:0", "cfa-10296:1", "cfa-10297:0", "cfa-10298:0",
  "cfa-10299:0", "cfa-1029:0", "cfa-1029:1", "cfa-1029:2", "cfa-10300:0",
  "cfa-10302:0", "cfa-10303:0", "cfa-10304:0", "cfa-10304:1", "cfa-10305:0",
  "cfa-10305:1", "cfa-10308:0", "cfa-10309:0", "cfa-10310:0", "cfa-10311:0",
  "cfa-10312:0", "cfa-1031:0", "cfa-103:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-1029:0", "cfa-1029:1", "cfa-10288:0", "cfa-10308:0", "cfa-103:0"
]);

// Text copied verbatim from Bushiroad's official card list. The local catalog
// text is kept separately and is never replaced by this reference text.
const officialTextChecks = Object.freeze({
  "cfa-10289:0": {
    cardNumber: "D-LBT03/015EN",
    officialPrintedText: "[AUTO]Drop:When a card is put into your Order Zone, if you do not have a unit with \"Noqno\" in its card name, [COST][Soul-Blast 1], and call this card to your back row center (RC). (You can only call one of this card if there are two in your drop)",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2F015EN"
  },
  "cfa-10289:1": {
    cardNumber: "D-LBT03/015EN",
    officialPrintedText: "[AUTO]Back Row Center (RC):At the end of the battle your vanguard attacked, if your opponent's vanguard is grade 3 or greater, [COST][Counter-Blast 1 & discard a card from hand], [Stand] this unit, and swap the position of your vanguard with this unit. At the end of that turn, swap the position of that swapped unit with this unit. (The soul does not move)",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2F015EN"
  },
  "cfa-10304:0": {
    cardNumber: "D-LBT03/FFR02EN",
    officialPrintedText: "[AUTO](VC):When you play a normal order, this unit gets [Power] +5000 until end of turn.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2FFFR02EN"
  },
  "cfa-10304:1": {
    cardNumber: "D-LBT03/FFR02EN",
    officialPrintedText: "[AUTO](VC)[1/turn]:When this unit attacks a vanguard, [COST][Counter-Blast 1], and perform all of the following according to the number of Cursed Play cards in your soul. ・Two or more－Draw a card, and this unit gets [Power] +5000 until end of turn. ・Four or more－At the end of that battle, [COST][discard a card from hand], [Stand] this unit, and it gets drive -1 until end of turn.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2FFFR02EN"
  }
});

const blockerById = Object.freeze({
  "cfa-10288:1": "ACT requires the Order Zone source, a grade 3+ Michu Vanguard, moving this exact order to Drop as cost, and temporarily replacing every applicable Vanguard Cannonball ability with a distinct Soul-Blast 2 effect that selects three units. The dynamic ability replacement and multi-target resolution are not represented by a trusted effect program.",
  "cfa-10289:0": "The Drop AUTO depends on a card entering the Order Zone, absence of any Noqno-named unit, Soul-Blast 1, calling this exact source to back-row center, and a one-copy-from-Drop restriction. The source-location, name predicate, and duplicate-copy rule are not implemented together.",
  "cfa-10289:1": "Requires the exact Vanguard battle to end, an opponent grade 3+ Vanguard, Counter-Blast 1 plus discard, standing this exact back-row-center source, swapping its position with the Vanguard, and a scheduled reverse swap at turn end. The battle identity and delayed position restoration are not supported as one authoritative sequence.",
  "cfa-10290:0": "Requires this exact unit to have boosted the attack that hit the Vanguard, an All Set Up! Order Zone condition, top-five deck inspection, a Glitter or Set Order selection/reveal, shuffling, and bottom-decking this source only if a card was revealed. The battle-linked target and conditional search sequence are unsupported.",
  "cfa-10291:0": "Requires this exact Rear-Guard's attack against a grade 3+ unit, an All Set Up! Order Zone condition, and battle-duration +5000 power. No trusted source-specific attack-power AUTO definition covers the full predicate.",
  "cfa-10291:1": "Requires this exact source's attack to hit, Soul-Blast 1, selecting a Cannonball card from Drop, and moving that selected card to Order Zone. The attack-hit target movement into Order Zone has no trusted resolver.",
  "cfa-10292:0": "Requires this exact Rear-Guard to attack a Vanguard while All Set Up! is in Order Zone, grants +5000 for that battle, then pays by bottom-decking a Set Order from Drop and grants a second +5000. This ordered two-stage attack modifier and order target are unsupported.",
  "cfa-10293:0": "CONT gives this exact unit both +5000 power and +5000 shield while All Set Up! is in Order Zone, with the statistic depending on its current RC or GC location. The dual-zone continuous evaluator is not compiled for this condition.",
  "cfa-10294:0": "Requires this Rear-Guard attack, six or more grade 3+ units, Counter-Blast 1, and a battle-hit rule that compares the total grade of the opponent's Guardians. The authoritative attack-hit override and guardian-grade calculation are unsupported.",
  "cfa-10295:0": "When the Bastion Vanguard is attacked, this exact back-row-center source pays Soul-Blast 1, moves to Guardian Circle, and gains +15000 shield for that battle. The response-window movement and shield resolution require a guardian AUTO path that is not available.",
  "cfa-10296:0": "On this unit's RC placement with a Bastion Vanguard, Counter-Blast 1 to call up to one grade 3 card from hand; draw only if a card was called and the player then has five or more units. The optional call and dependent draw need an ordered choice program.",
  "cfa-10296:1": "CONT grants Boost to this exact Rear-Guard only during its controller's turn and only while that controller has six or more units. The dynamic keyword-grant evaluator does not support the unit-count condition.",
  "cfa-10297:0": "During the opponent's turn, when another Rear-Guard is retired, this source binds itself and returns that exact retired card to hand. The causal retired-instance identity and paired bind/return operations are not handled by a trusted effect program.",
  "cfa-10298:0": "When this exact Rear-Guard's attack hits a Vanguard with at least two Order Zone cards, the optional draw is followed by putting a hand card into Soul only if a card was drawn. The optional draw and dependent hand choice are unsupported.",
  "cfa-10299:0": "Requires the attack this exact unit boosted to hit a Vanguard, retiring this source, searching the deck for an Order, revealing it, adding it to hand, and shuffling. Battle boost identity and the ordered search/retire effect lack a trusted handler.",
  "cfa-1029:2": "This Rear-Guard cannot boost another Rear-Guard. The catalog wording is not recognized by the current passive restriction compiler, so the UI and authoritative action validator cannot reliably reject an illegal boost for this source.",
  "cfa-10300:0": "Requires this exact source to be placed on RC specifically by the ability of its grade 3+ Vanguard, then grants +10000 power until end of turn. The placement event must preserve ability-caused provenance and the Vanguard grade.",
  "cfa-10302:0": "Requires this exact grade 1 to be ridden upon by a grade 2 Luticia-named card, bottom-decking a hand card as cost, searching for a Cursed Play card, revealing it, adding it to hand, and shuffling. Ride provenance plus the ordered search cost/effect are unsupported.",
  "cfa-10303:0": "CONT changes the cost of riding a grade 3 Luticia from the Ride Deck only while this Vanguard's Soul has a Cursed Play card: Soul-Blast a Luticia instead of discarding a hand card. The live Ride Deck cost-substitution legality path is unavailable.",
  "cfa-10304:0": "Triggers when a Normal Order is played and grants this exact Vanguard +5000 until end of turn. The Order-played event is not currently compiled to this source-specific AUTO effect.",
  "cfa-10304:1": "Once per turn, this exact Vanguard's attack against a Vanguard pays Counter-Blast 1 and evaluates two Cursed Play Soul thresholds: draw/+5000 at two, then at four schedule a battle-end discard, stand, and drive reduction. Threshold-dependent delayed resolution and the usage restriction need a verified ordered program.",
  "cfa-10305:0": "On RC placement with a Luticia Vanguard, inspect the top three cards, choose one into Soul, and bottom-deck the remaining cards in a player-chosen order. Search/reveal ordering and multi-card ordering are unsupported.",
  "cfa-10305:1": "This exact Rear-Guard's attack gets +5000 for two Cursed Play cards in Soul, or +15000 instead at four or more, for that battle. Its attack timing and mutually exclusive threshold replacement are not represented by a trusted definition.",
  "cfa-10309:0": "When this exact card is called from hand to RC, Counter-Blast 1 and choose an Order Zone card to return to hand. The origin-specific placement trigger and Order Zone target movement are unsupported.",
  "cfa-10310:0": "On RC placement with a grade 3+ Luticia Vanguard, Counter-Blast 1 and choose a Cursed Play card from Drop to hand. The exact named-Vanguard and Drop-filtered target-selection effect is unsupported.",
  "cfa-10311:0": "ACT is once per turn on this Rear-Guard with a Mediell Vanguard: Counter-Blast 1, inspect the deck top, choose to leave it on top or put it into Soul, then grant this source +5000 until end of turn. The top-card choice and ordered optional zone movement are not implemented.",
  "cfa-10312:0": "When this exact unit is placed on RC from Drop, choose a Mediell Vanguard; both that Vanguard and this source gain +5000 until end of turn. The Drop-origin event and two explicit instance targets need a verified resolver.",
  "cfa-1031:0": "On VC or RC placement, choose a CONT ability on a Narukami Vanguard or Rear-Guard and make that ability lost until end of turn. Dynamic ability suppression with a legal target filter and expiry is not represented by the effect engine."
});

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = catalogById.get(cardId);
  if (!card) throw new Error(`Assigned card missing from catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name });
}));

const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedAbilityIds.includes(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = catalogById.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed ability or specific blocker: ${abilityId}`);
  const official = officialTextChecks[abilityId];
  return Object.freeze({
    abilityId,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null,
    officialCardNumber: official?.cardNumber || null,
    blocker: blockerById[abilityId]
  });
}));

const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected production definition missing: ${abilityId}`);
  return Object.freeze({
    abilityId,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled production definition",
    supportMode: ability.kind === "CONT" ? "continuous-restriction-engine" : "trusted-server-effect"
  });
}));

module.exports = Object.assign([], {
  audit: Object.freeze({
    batchId: "ABILITY-320008F1-0011",
    status: "five-existing-definitions-28-blocked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: false,
    officiallyCheckedAbilityIds: Object.freeze(Object.keys(officialTextChecks)),
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    cards,
    unsupportedSiblings,
    provenanceNote: "The exact local catalog text is retained for all 33 abilities. Five already compiled definitions were verified against their actual engine paths; 28 abilities remain explicitly blocked by missing trusted timing, legality, choice, cost, or effect handling. Bushiroad's official card list was checked for the two Shy Vocal, Noqno abilities and the two Grimoire Etoile, Luticia abilities. No ability is marked newly implemented and no card is marked complete."
  }),
  unsupportedSiblings
});
