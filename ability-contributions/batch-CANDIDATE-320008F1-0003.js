"use strict";

// Audit-only batch: these cards have no exact end-to-end server handler yet.
// Keep the contribution empty so the runtime cannot offer partial effects.
const contribution = [];

const officialSetReferences = Object.freeze([
  "https://cf-vanguard.com/cardlist/cardsearch/?expansion=274",
  "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=235&sort=no&view=text",
  "https://cf-vanguard.com/cardlist/?cardno=DZ-BT07%2FEX06"
]);

const cards = Object.freeze([
  {
    cardId: "cfa-13668",
    name: "Phrasing Mirage",
    set: "DZ-BT07 BanG Dream! / Morfonica special card pool",
    playRequirement: "Play this if your vanguard is \"Butterfly Dream \"forte\", Rui Yashio\"!",
    catalogType: "Normal Order",
    catalogHeader: "BanG Dream!/Morfonica/Normal Order Music"
  },
  {
    cardId: "cfa-13669",
    name: "esora no clover",
    set: "DZ-BT07 BanG Dream! / Morfonica special card pool",
    playRequirement: "Play this if your vanguard is \"Bud That Doesn’t Bloom \"forte\", Tsukushi Futaba\"!",
    catalogType: "Normal Order",
    catalogHeader: "BanG Dream!/Morfonica/Normal Order Music"
  },
  {
    cardId: "cfa-13670",
    name: "Watashi Machigai Sagashi",
    set: "DZ-BT07 BanG Dream! / Morfonica special card pool",
    playRequirement: "Play this if your vanguard is \"Loneliness For Being Gifted \"forte\", Nanami Hiromachi\"!",
    catalogType: "Normal Order",
    catalogHeader: "BanG Dream!/Morfonica/Normal Order Music"
  },
  {
    cardId: "cfa-13671",
    name: "MUGEN Reverberate!",
    set: "DZ-BT07 BanG Dream! / Morfonica special card pool",
    playRequirement: "Play this if your vanguard is \"One’s Own Footprints \"forte\", Toko Kirigaya\"!",
    catalogType: "Normal Order",
    catalogHeader: "BanG Dream!/Morfonica/Normal Order Music"
  }
]);

const unsupportedSiblings = Object.freeze([
  {
    abilityId: "cfa-13668:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO: When this card is put on RC, search your deck or drop for up to one \"Dissonance of the Imaginary World \"forte\", Mashiro Kurata\", call it to RC, until end of turn, it gets \"Boost\", and power +5000. If you seached the deck, shuffle the deck. At the end of that turn, retire that unit.",
    blocker: "The parser leaves the placement trigger at needs-review. No existing trusted effect sequence searches Deck or Drop for an exact-name card, calls that selected instance to RC (including normal circle replacement rules), grants that called instance Boost and +5000, shuffles only after a Deck search, and schedules retirement of the same called instance at turn end. The event must also identify this exact Music Order entering RC; an unrelated call or another Music Order cannot satisfy it. The catalog target name differs from English secondary references (‘Dissonance of a Hollow World’), so name identity must be reconciled before any exact-name handler is trusted."
  },
  {
    abilityId: "cfa-13668:1",
    kind: "AUTO",
    catalogPrintedText: "AUTO [RC] 1/Turn: When your vanguard attacks, if your drop has one or more different musics, COST [Counter Blast 1], choose one of your vanguards, it gets power +5000 until end of turn, if your drop has three or more different musics, at the end of that battle, COST [discard a card with \"Rui Yashio\" in its card name from hand], stand that unit, until end of turn, it gets drive -1, and if your drop has five or more different musics, all of your <Morfonica> rear-guards get power +5000.",
    blocker: "This is an RC, once-per-turn Vanguard-attack AUTO with a distinct-Music-name count in Drop at thresholds 1, 3, and 5. It has an initial Counter-Blast, a chosen Vanguard receiving turn power, a later battle-end named discard and stand/drive reduction of that same chosen Vanguard, and a separate clan-wide Rear-Guard power effect. No reviewed handler captures the distinct-name counts, deferred target identity, staged cost/effect order, or simultaneous clan-wide modifier."
  },
  {
    abilityId: "cfa-13669:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO: When this card is put on RC, search your deck or drop for up to one \"Dissonance of the Imaginary World \"forte\", Mashiro Kurata\", call it to RC, until end of turn, it gets \"Boost\", and power +5000. If you seached the deck, shuffle the deck. At the end of that turn, retire that unit.",
    blocker: "Same unresolved Music-Order placement/search/call/temporary-grant/delayed-retirement sequence as cfa-13668:0. The source-specific Tsukushi play requirement must remain enforced when this Order is played; it is not part of the AUTO’s trigger and must not be mistaken for an attack or another card’s placement."
  },
  {
    abilityId: "cfa-13669:1",
    kind: "CONT",
    catalogPrintedText: "CONT [RC]: All of your <Morfonica> rear-guards get power +5000.",
    blocker: "Requires a continuous +5000 modifier to every controller-owned Morfonica Rear-Guard while this Order is on RC. Existing clan Rear-Guard continuous support scales the source’s power by a count; it does not apply a fixed bonus to each clan-matching target. CONT must not be exposed as a manual skill."
  },
  {
    abilityId: "cfa-13669:2",
    kind: "AUTO",
    catalogPrintedText: "AUTO [RC]: When your vanguard attacks, COST [Counter Blast 1 & discard a card with \"Tsukushi Futaba\" in its card name from hand], choose a card with \"Tsukushi Futaba\" in its card name from your drop, call it to RC, until end of turn, that unit can attack from the backrow.",
    blocker: "The attack event belongs to the controller’s Vanguard while this source remains on RC. The controller must pay both Counter Blast 1 and the exact named discard, select a matching card from their own Drop, call that instance to an RC, and grant it back-row attack permission through turn end. The generic call handlers do not implement this combined cost and temporary attack permission."
  },
  {
    abilityId: "cfa-13670:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO: When this card is put on RC, search your deck or drop for up to one \"Dissonance of the Imaginary World \"forte\", Mashiro Kurata\", call it to RC, until end of turn, it gets \"Boost\", and power +5000. If you seached the deck, shuffle the deck. At the end of that turn, retire that unit.",
    blocker: "Same unresolved Music-Order placement/search/call/temporary-grant/delayed-retirement sequence as cfa-13668:0. Its Nanami play requirement and the exact called-card identity must be checked independently."
  },
  {
    abilityId: "cfa-13670:1",
    kind: "AUTO",
    catalogPrintedText: "AUTO [RC]: When your vanguard attacks, COST [Counter Blast 1], all of your rear-guards without \"Nanami Hiromachi\" in their card names get \"CONT [RC]: Your vanguard gets the trigger effects this unit got.\" until end of turn. Then, COST [discard a card with \"Nanami Hiromachi\" in its card name from hand], look at the top four cards of your deck, choose two cards from among them, put them into hand, and put the rest on the top or bottom of the deck in any order.",
    blocker: "Requires Counter-Blast 1, granting a nested temporary CONT to all friendly Rear-Guards except those whose names contain Nanami Hiromachi, copying each unit’s received trigger effects to the Vanguard, then a separate named discard and exact top-four selection with arbitrary top/bottom ordering. The engine has no reviewed dynamic trigger-effect copy/grant or complete selection-and-reorder sequence for this text."
  },
  {
    abilityId: "cfa-13671:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO: When this card is put on RC, search your deck or drop for up to one \"Dissonance of the Imaginary World \"forte\", Mashiro Kurata\", call it to RC, until end of turn, it gets \"Boost\", and power +5000. If you seached the deck, shuffle the deck. At the end of that turn, retire that unit.",
    blocker: "Same unresolved Music-Order placement/search/call/temporary-grant/delayed-retirement sequence as cfa-13668:0. Its Toko play requirement and exact target-name discrepancy remain unresolved."
  },
  {
    abilityId: "cfa-13671:1",
    kind: "AUTO",
    catalogPrintedText: "AUTO [RC]: When your vanguard attacks, COST [Counter Blast 1], choose one of your <Morfonica> rear-guards, and stand it. If your opponent’s vanguard is grade 3 or greater, COST [discard a card with \"Toko Kirigaya\" in its card name from hand], choose one of your <Morfonica> rear-guards, stand it, choose one of your vanguards, and it gets power +10000 / critical +1 until end of turn.",
    blocker: "Requires an own-Vanguard-attack event, Counter-Blast 1, a first chosen Morfonica Rear-Guard, then an opponent-Vanguard-grade-at-least-3 branch with a Toko discard, a second independent Rear-Guard stand choice, and a Vanguard power/critical choice. The reducer has no exact reviewed handler for the complete ordered multi-target program and conditional cost; do not compress the separate choices into one target or infer optionality."
  }
]);

Object.defineProperties(contribution, {
  batchId: { value: "CANDIDATE-320008F1-0003", enumerable: false },
  unsupportedSiblings: { value: unsupportedSiblings, enumerable: false },
  audit: {
    enumerable: false,
    value: Object.freeze({
      batchId: "CANDIDATE-320008F1-0003",
      status: "audit-only-unsupported-no-exact-reviewed-handler",
      dataset: "Cardfight Area card database snapshot plus Bushiroad official card-list references",
      catalogSnapshotDate: "2025-05-09",
      officialTextChecked: false,
      officialSetReferences,
      abilityIds: Object.freeze(unsupportedSiblings.map(item => item.abilityId)),
      implementedAbilityIds: Object.freeze([]),
      alreadySupportedAbilityIds: Object.freeze([]),
      cards,
      unsupportedSiblings,
      provenanceNote: "All nine English ability blocks here are copied exactly from the local Cardfight Area 2025-05-09 catalog snapshot. Bushiroad's official card-list pages confirm the DZ-BT07 product and Japanese card-list/ruling context for Morfonica Music/Order cards, but an exact official English card entry for these four records was not retrieved. Secondary English references corroborate some effects but include translation/name and card-type inconsistencies; they were not used to silently overwrite the catalog. The printed target name 'Dissonance of the Imaginary World' needs reconciliation with secondary references that use 'Dissonance of a Hollow World' before name-sensitive handlers can be trusted."
    })
  }
});

module.exports = contribution;
