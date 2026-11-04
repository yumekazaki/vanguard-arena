"use strict";

// Audit-only contribution. None of the eight abilities has an exact reviewed
// handler for its complete conditions, costs, choices, timing, and resolution.
// Keeping this list outside the engine registry prevents unsupported skills
// from appearing as activatable or silently receiving partial effects.
const contribution = [];

const officialReference = "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=159&sort=&view=text";

const cards = Object.freeze([
  {
    cardId: "cfa-7515",
    name: "Sparkly Stage, Kasumi Toyama",
    cardNumber: "V-TB01/001EN",
    officialReference,
    catalogTextDifferences: "The local catalog shortens the four-name requirement ('units with ... in their card names each') versus the official 'one unit each with ...'; it also says trigger effects 'gets by the drive check' rather than 'gets from drive checks'. Its ACT paraphrases 'If no orders have been played this turn' as 'If an order was not played this turn' and omits the apostrophe in Poppin'Party and the word 'card'."
  },
  {
    cardId: "cfa-7593",
    name: "Growth of Feelings, Aya Maruyama",
    cardNumber: "V-TB01/003EN",
    officialReference,
    catalogTextDifferences: "The local catalog omits the official ＊ in Pastel＊Palettes, omits 'cards' in the soul threshold, and simplifies the VC/RC target wording. Its ACT paraphrases 'If no orders have been played this turn' and omits 'card' after music."
  },
  {
    cardId: "cfa-7648",
    name: "Important Friends, Ran Mitake",
    cardNumber: "V-TB01/002EN",
    officialReference,
    catalogTextDifferences: "The local catalog normalizes the Rest icon and paraphrases the equal-number target instruction. Its ACT paraphrases 'If no orders have been played this turn' and omits 'card' after music."
  },
  {
    cardId: "cfa-7759",
    name: "Blue Rose Diva, Yukina Minato",
    cardNumber: "V-TB01/004EN",
    officialReference,
    catalogTextDifferences: "The local catalog says a Roselia music 'was played' rather than the official 'has been played', and simplifies 'for each of your opponent's vanguard's grades'. Its ACT paraphrases 'If no orders have been played this turn' and omits 'card' after music."
  }
]);

const unsupportedSiblings = Object.freeze([
  {
    abilityId: "cfa-7515:0",
    kind: "CONT",
    catalogPrintedText: "CONT [VC]: If you have units with \"Tae Hanazono\", \"Rimi Ushigome\", \"Saya Yamabuki\", \"Arisa Ichigaya\" in their card names each, all of your front row rear-guards get the trigger effects that this unit gets by the drive check.",
    officialPrintedText: "CONT [VC]: If you have one unit each with \"Tae Hanazono\", \"Rimi Ushigome\", \"Saya Yamabuki\", \"Arisa Ichigaya\" in their card names, all of your front row rear-guards get the trigger effects this unit gets from drive checks.",
    blocker: "Requires all four named units under the controller and grants the exact trigger effects received by this Vanguard from drive checks to every front-row Rear-Guard. No reviewed continuous effect validates that four-name state or copies the Vanguard's checked trigger effects to the affected units."
  },
  {
    abilityId: "cfa-7515:1",
    kind: "ACT",
    catalogPrintedText: "ACT [VC]: If an order was not played this turn, COST [Counter Blast 1], search your deck or drop zone for up to one <PoppinParty> music and play it, and if you searched your deck, shuffle your deck.",
    officialPrintedText: "ACT [VC]: If no orders have been played this turn, [COST][Counter-Blast 1], search your deck or drop zone for up to one <Poppin'Party> music card and play it, and if you searched your deck, shuffle your deck.",
    blocker: "The exact zero-orders-this-turn restriction, Counter-Blast 1, optional search from either Deck or Drop for a Poppin'Party music card, playing that selected card through the music/Order rules, and Deck-only shuffle are not implemented as one validated effect sequence. Existing search-to-hand handlers do not play the card and cannot substitute."
  },
  {
    abilityId: "cfa-7593:0",
    kind: "CONT",
    catalogPrintedText: "CONT [VC]: During your turn, if your soul has five or more <Pastel Palettes> with different names, all <Pastel Palettes> on your VC and RC get power +5000. If it has eight or more, they get +10000 instead of +5000.",
    officialPrintedText: "CONT [VC]: During your turn, if your soul has <Pastel＊Palettes> cards with five or more different card names, all of your <Pastel＊Palettes> on (VC) and (RC) get [Power] +5000. If it has eight or more, they get [Power] +10000 instead of +5000.",
    blocker: "Requires a distinct-name count among Pastel＊Palettes cards in Soul (thresholds five and eight), controller-turn timing, and a continuous modifier applied to every matching unit on VC and RC, with +10000 replacing +5000 at the higher threshold. No reviewed handler models this exact clan-filtered distinct-name count and cross-circle continuous application."
  },
  {
    abilityId: "cfa-7593:1",
    kind: "ACT",
    catalogPrintedText: "ACT [VC]: If an order was not played this turn, COST [Counter Blast 1], search your deck or drop zone for up to one <Pastel Palettes> music and play it, and if you searched your deck, shuffle your deck.",
    officialPrintedText: "ACT [VC]: If no orders have been played this turn, [COST][Counter-Blast 1], search your deck or drop zone for up to one <Pastel＊Palettes> music card and play it, and if you searched your deck, shuffle your deck.",
    blocker: "The exact zero-orders-this-turn restriction, Counter-Blast 1, optional search from either Deck or Drop for a Pastel＊Palettes music card, playing that selected card through the music/Order rules, and Deck-only shuffle are not implemented as one validated effect sequence. Existing search-to-hand handlers do not play the card and cannot substitute."
  },
  {
    abilityId: "cfa-7648:0",
    kind: "ACT",
    catalogPrintedText: "ACT [VC] 1/Turn: COST [Rest up to two rear-guards], choose the same number of your units as the number rest for this cost, and they get power +10000 until end of turn.",
    officialPrintedText: "ACT [VC][1/turn]:[COST][[Rest] up to two rear-guards], choose a number of your units equal to the number [Rest] for this cost, and they get [Power] +10000 until end of turn.",
    blocker: "Requires an optional variable cost that rests zero, one, or two Rear-Guards, then an equal-size choice of friendly units, and +10000 to each chosen unit until turn end, with a per-ability once-per-turn restriction. Available rest-source effects only rest the source; independent target-power effects do not bind the number of targets to the paid rest count."
  },
  {
    abilityId: "cfa-7648:1",
    kind: "ACT",
    catalogPrintedText: "ACT [VC]: If an order was not played this turn, COST [Counter Blast 1], search your deck or drop zone for up to one <Afterglow> music and play it, and if you searched your deck, shuffle your deck.",
    officialPrintedText: "ACT [VC]: If no orders have been played this turn, [COST][Counter-Blast 1], search your deck or drop zone for up to one <Afterglow> music card and play it, and if you searched your deck, shuffle your deck.",
    blocker: "The exact zero-orders-this-turn restriction, Counter-Blast 1, optional search from either Deck or Drop for an Afterglow music card, playing that selected card through the music/Order rules, and Deck-only shuffle are not implemented as one validated effect sequence. Existing search-to-hand handlers do not play the card and cannot substitute."
  },
  {
    abilityId: "cfa-7759:0",
    kind: "AUTO",
    catalogPrintedText: "AUTO [VC]: When it attacks, if a <Roselia> music was played this turn, this unit gets power +5000 until end of that battle for each grade of your opponent’s vanguard.",
    officialPrintedText: "AUTO [VC]: When it attacks, if a <Roselia> music has been played this turn, this unit gets [Power] +5000 until end of that battle for each of your opponent's vanguard's grades.",
    blocker: "Requires this exact Vanguard instance's attack, a Roselia music-played-this-turn condition, and a battle-scoped power amount computed from the opponent Vanguard's grade. No reviewed AUTO can combine the exact attack event, order-play history, and grade-scaled modifier for that battle."
  },
  {
    abilityId: "cfa-7759:1",
    kind: "ACT",
    catalogPrintedText: "ACT [VC]: If an order was not played this turn, COST [Counter Blast 1], search your deck or drop zone for up to one <Roselia> music and play it, and if you searched your deck, shuffle your deck.",
    officialPrintedText: "ACT [VC]: If no orders have been played this turn, [COST][Counter-Blast 1], search your deck or drop zone for up to one <Roselia> music card and play it, and if you searched your deck, shuffle your deck.",
    blocker: "The exact zero-orders-this-turn restriction, Counter-Blast 1, optional search from either Deck or Drop for a Roselia music card, playing that selected card through the music/Order rules, and Deck-only shuffle are not implemented as one validated effect sequence. Existing search-to-hand handlers do not play the card and cannot substitute."
  }
]);

Object.defineProperty(contribution, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "CANDIDATE-320008F1-0001",
    status: "audit-only-unsupported-no-exact-reviewed-handler",
    dataset: "Cardfight Area card database snapshot plus Bushiroad official card list",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: true,
    abilityIds: Object.freeze(unsupportedSiblings.map(item => item.abilityId)),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds: Object.freeze([]),
    cards,
    unsupportedSiblings,
    textProvenanceNote: "Official English card text is from Bushiroad's V-TB01 BanG Dream! FILM LIVE card list. The local catalog has paraphrase/normalization differences recorded per card; no engine definition was emitted, so its mismatched text cannot activate partial effects.",
    officialReference
  })
});

Object.defineProperty(contribution, "unsupportedSiblings", {
  enumerable: false,
  value: unsupportedSiblings
});

module.exports = contribution;
