"use strict";

// Audit-only contribution: every assigned ability depends on equip-gauge
// state or an effect sequence not represented by the current engine. Do not
// emit partial definitions or expose these as executable skills.
const contribution = [];
const sourceByCard = Object.freeze({
  "cfa-10017": {
    name: "Ancient Dragon, Babyrex",
    cardNumber: "D-VS06/030EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-VS06%2F030EN",
    officialGuideReference: "https://en.cf-vanguard.com/deckrecipe/detail/d-vs06-tachikaze",
    officialTextStatus: "Official deck recipe confirms its equip-gauge retirement and grade-3 call mechanics; the official card-detail route is linked from Tyrannolegend but was not available in the source cache for exact transcription."
  },
  "cfa-10018": {
    name: "Ancient Dragon, Tyrannolegend",
    cardNumber: "D-VS06/029EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-VS06%2F029EN",
    officialTextStatus: "Exact official card-list text checked; the official errata page confirms the corrected Ancient Dragon card-name requirement and end-of-turn duration for ability :0."
  },
  "cfa-8981": {
    name: "Ancient Dragon, Dinocrowd",
    cardNumber: "D-VS02/030EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-VS02%2F030EN",
    officialTextStatus: "Exact official card-list text checked."
  },
  "cfa-8982": {
    name: "Ancient Dragon, Iguanogorg",
    cardNumber: "D-VS02/031EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-VS02%2F031EN&expansion=174&s_param=Tachikaze&view=text",
    officialTextStatus: "Official card-list search result text checked; the individual card-detail route was not available in the source cache."
  }
});

const unsupportedSiblings = Object.freeze([
  {
    abilityId: "cfa-10017:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO: When this unit with equip gauge is retired from RC by the ability of a card with \"Ancient Dragon\" in its card name, COST [Soul Blast 1 & bind this card], search your deck for up to one grade 3 card, call it to RC, and shuffle your deck.",
    officialPrintedText: null,
    officialSummary: "Official deck recipe: when Babyrex with an equip gauge is retired by an Ancient Dragon ability, Soul-Blast 1 and bind it to call up to one grade 3 from the deck.",
    blocker: "Requires the exact source instance to have an equip gauge when retired from RC by an ability whose source card name contains Ancient Dragon; then Soul-Blast 1, bind this exact retired card from Drop, privately search up to one grade 3, call it to a legal RC, and shuffle. Equip gauges, effect-source provenance for the retiring ability, bind-from-drop payment, and this ordered search/call sequence are not modeled together."
  },
  {
    abilityId: "cfa-10017:1",
    kind: "AUTO",
    catalogPrintedText: "AUTO [RC] 1/Turn: When your drive check reveals a trigger unit, put the top card of your deck face down as an equip gauge for this unit.",
    officialPrintedText: null,
    officialSummary: "Official deck recipe confirms Babyrex gains a face-down equip gauge when a trigger unit is revealed during its controller's drive check.",
    blocker: "The drive-check event must belong to this unit's controller, reveal a trigger unit, and match this exact source instance on RC; the per-instance once-per-turn restriction then moves the next top-deck card face down under it. The engine has no equip-gauge card state/zone or effect handler, and this ability's trigger is not compiled."
  },
  {
    abilityId: "cfa-10018:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO: When this unit is placed on VC or placed by the ability of your \"Ancient Dragon\" on RC, this unit gets power +10000 / drive +1. Then, COST [Discard a card from hand], choose a front trigger from your drop, and put it on the top of your deck.",
    officialPrintedText: "AUTO: When this unit is placed on (VC) or placed by the ability of your card with \"Ancient Dragon\" in its card name on (RC), this unit gets [Power]+10000/drive +1 until end of turn. Then [COST][discard a card from hand], choose a [Front] trigger from your drop, and put it on the top of your deck.",
    blocker: "The RC route must prove that this exact unit was placed by an ability of the controller's card with Ancient Dragon in its name; the separate VC route is any legal placement on VC. Resolution then grants +10000 and drive +1 through turn end, followed by an optional AUTO cost of discarding one card and selecting a Front trigger from Drop for the deck top. Current catalog text omits the errata-corrected name condition and duration; no handler validates both routes and the sequential discard/filter/move."
  },
  {
    abilityId: "cfa-10018:1",
    kind: "AUTO",
    catalogPrintedText: "AUTO [VC/RC]: At the end of the battle this unit attacked, COST [Counter Blast 1 & retire one of your rear-guards], and draw a card.",
    officialPrintedText: "[AUTO](VC/RC):At the end of the battle this unit attacked, [COST][Counter-Blast 1 & retire one of your rear-guards], and draw a card.",
    blocker: "Requires the exact VC/RC source instance to be the attacker in the battle that just closed, then the controller pays Counter-Blast 1 and retires one of their Rear-Guards before drawing. There is no exact compiler for this battle-close trigger plus combined resource and retire cost; generic draw/retire operations do not validate the ordered cost or exact battle/source."
  },
  {
    abilityId: "cfa-10018:2",
    kind: "AUTO",
    catalogPrintedText: "AUTO [RC] 1/Turn: When your drive check reveals a trigger unit, put the top card of your deck face down as an equip gauge for this unit.",
    officialPrintedText: "[AUTO](RC)[1/turn]:When your drive check reveals a trigger unit, put the top card of your deck face down as an equip gauge for this unit.",
    blocker: "The drive-check event must belong to this unit's controller, reveal a trigger unit, and match this exact source instance on RC; the per-instance once-per-turn restriction then moves the next top-deck card face down under it. The engine has no equip-gauge card state/zone or effect handler, and this ability's trigger is not compiled."
  },
  {
    abilityId: "cfa-8981:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO [VC/RC]: When this unit attacks, COST [Soul Blast 1 & retire a rear-guard], until end of that battle, this unit gets power +10000, and power +5000 for each of this unit’s equip gauges.",
    officialPrintedText: "[AUTO](VC/RC):When this unit attacks, [COST][Soul-Blast 1 & retire a rear-guard], and until end of that battle, this unit gets [Power] +10000, and gets [Power] +5000 for each of this unit's equip gauge.",
    blocker: "The exact VC/RC source instance must attack; the controller pays Soul-Blast 1 and retires one Rear-Guard, then the source gets +10000 plus +5000 per equip gauge until that battle ends. The engine recognizes an own-attack trigger candidate but has no equip-gauge count and the combined cost is marked needs-review; the computed power and cost cannot be resolved safely."
  },
  {
    abilityId: "cfa-8981:1",
    kind: "AUTO",
    catalogPrintedText: "AUTO [RC] 1/Turn: When your drive check reveals a trigger unit, put the top card of your deck face down as an equip gauge for this unit.",
    officialPrintedText: "[AUTO](RC)[1/turn]:When your drive check reveals a trigger unit, put the top card of your deck face down as an equip gauge for this unit.",
    blocker: "The drive-check event must belong to this unit's controller, reveal a trigger unit, and match this exact source instance on RC; the per-instance once-per-turn restriction then moves the next top-deck card face down under it. The engine has no equip-gauge card state/zone or effect handler, and this ability's trigger is not compiled."
  },
  {
    abilityId: "cfa-8982:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO: If this card has an equip gauge, this cost is reduced by Counter Blast 1. When this unit is retired from RC by a card’s ability, COST [Counter Blast 1], and call this card to an open RC as rest. (The equip gauge it had is put into your drop when retired and called.)",
    officialPrintedText: "[AUTO]:If this unit has an equip gauge, this cost is reduced by [Counter-Blast 1]. When this unit is retired from (RC) by a card's ability, [COST][Counter-Blast 1], and call this unit to an open (RC) as [Rest]. (The equip gauge it had is put into the drop when retired even if you call it.)",
    blocker: "Must record whether the exact Iguanogorg source had an equip gauge at retirement, match a card-ability retirement from RC (not an ordinary move/retire), reduce the Counter-Blast cost from one to zero if gauged, move the gauge(s) to Drop, and call this exact card to an open RC rested. The engine has neither gauge state nor a validated conditional cost plus retire-event provenance/call sequence."
  },
  {
    abilityId: "cfa-8982:1",
    kind: "AUTO",
    catalogPrintedText: "AUTO [RC] 1/Turn: When your drive check reveals a trigger unit, put the top card of your deck face down as an equip gauge for this unit.",
    officialPrintedText: "[AUTO](RC)[1/turn]:When your drive check reveals a trigger unit, put the top card of your deck face down as an equip gauge for this unit.",
    blocker: "The drive-check event must belong to this unit's controller, reveal a trigger unit, and match this exact source instance on RC; the per-instance once-per-turn restriction then moves the next top-deck card face down under it. The engine has no equip-gauge card state/zone or effect handler, and this ability's trigger is not compiled."
  }
]);

const cards = Object.freeze(Object.entries(sourceByCard).map(([cardId, info]) => Object.freeze({ cardId, ...info })));

Object.defineProperty(contribution, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "CANDIDATE-320008F1-0002",
    status: "audit-only-blocked-on-equip-gauge-state-and-effects",
    dataset: "Cardfight Area card database snapshot plus Bushiroad official card-list references",
    catalogSnapshotDate: "2025-05-09",
    abilityIds: Object.freeze(unsupportedSiblings.map(item => item.abilityId)),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds: Object.freeze([]),
    cards,
    unsupportedSiblings,
    sharedMechanic: "equip-gauge-drive-check-v1",
    sharedMechanicBlocker: "No equip-gauge property, card location, mutation operation, event identity, or cleanup behavior is present in the current ability engine/reducer. All four drive-check gauge abilities and the dependent gauge-count abilities therefore remain unsupported.",
    provenanceNote: "Exact official card-list text was checked for D-VS06/029EN and D-VS02/030EN; D-VS02/031EN was checked in the official card-list search result; the official D-VS06/030EN detail route is linked from the verified Tyrannolegend page but was not fetchable in the available source cache, so Babyrex uses catalog text plus the official Tachikaze deck-recipe summary and is not marked text-verified.",
    officialReferences: Object.freeze([
      "https://en.cf-vanguard.com/cardlist/?cardno=D-VS06%2F029EN",
      "https://en.cf-vanguard.com/cardlist/?cardno=D-VS06%2F030EN",
      "https://en.cf-vanguard.com/cardlist/?cardno=D-VS02%2F030EN",
      "https://en.cf-vanguard.com/cardlist/?cardno=D-VS02%2F031EN&expansion=174&s_param=Tachikaze&view=text",
      "https://en.cf-vanguard.com/deckrecipe/detail/d-vs06-tachikaze",
      "https://en.cf-vanguard.com/dvs0506-errata-list/"
    ]),
    errataNote: "The official D-VS06 Tyrannolegend text and errata correct ability :0 to refer to your card with 'Ancient Dragon' in its card name on RC and explicitly make the power/drive gain last until end of turn; the local catalog text is missing those corrections."
  })
});

Object.defineProperty(contribution, "unsupportedSiblings", {
  enumerable: false,
  value: unsupportedSiblings
});

module.exports = contribution;
