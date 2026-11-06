"use strict";

// Isolated batch review. Definitions here are proposals for primary integration;
// the authoritative server does not accept them until its exact-card gates and
// regression tests are updated.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const batchId = "ABILITY-320008F1-0026";
const workerOwner = "agent-batch-0026";
const abilityIds = Object.freeze([
  "cfa-10690:0", "cfa-10690:1", "cfa-10691:0", "cfa-10693:0", "cfa-10694:0",
  "cfa-10694:1", "cfa-10695:0", "cfa-10696:0", "cfa-10697:0", "cfa-10699:0",
  "cfa-1069:0", "cfa-1069:1", "cfa-1069:2", "cfa-10700:0", "cfa-10701:0",
  "cfa-10702:0", "cfa-10703:0", "cfa-10704:0", "cfa-10705:0", "cfa-10707:0",
  "cfa-10708:0", "cfa-10709:0", "cfa-1070:0", "cfa-1070:1", "cfa-1070:2",
  "cfa-10710:0", "cfa-10710:1", "cfa-10711:0", "cfa-10712:0", "cfa-10712:1",
  "cfa-10713:0", "cfa-10713:1", "cfa-10714:0", "cfa-10714:1", "cfa-1071:0"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-1070:2", "cfa-1071:0"]);

// These candidates reuse existing event/effect vocabulary. They are deliberately
// not presented as live support: reducer whitelists currently reject them.
const proposedDefinitions = Object.freeze([
  Object.freeze({
    id: "cfa-10709:0",
    cardId: "cfa-10709",
    kind: "AUTO",
    printedText: "AUTO [RC]: When this unit boosts \"Blaze Maiden, Addison\", you may Soul Charge 2.",
    requiredLocation: ["rear-guard"],
    optional: true,
    trigger: Object.freeze({
      status: "recognized-trigger",
      eventType: "unit.boosted",
      subject: "source",
      turnRelation: "controller",
      boostedUnitName: "Blaze Maiden, Addison"
    }),
    conditions: Object.freeze([]),
    conditionsReviewed: true,
    costs: Object.freeze([]),
    costsReviewed: true,
    choicesReviewed: true,
    source: Object.freeze({
      dataset: "Bushiroad official card list",
      snapshotDate: "2026-11-04",
      officialCardNumber: "D-BT09/064EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F064EN",
      patternId: "auto-own-boost-named-unit-soul-charge-v1",
      review: "Official D-BT09/064EN wording confirmed. This exact Rear-Guard must be the booster, and the boosted card name must equal Blaze Maiden, Addison. The AUTO is optional and Soul Charges two cards. Proposed only: the server's trusted own-boost Soul Charge whitelist currently supports other exact cards/counts, not this card or count 2."
    }),
    effects: Object.freeze([{ op: "soul-charge", target: "controller", count: 2 }])
  }),
  Object.freeze({
    id: "cfa-10713:1",
    cardId: "cfa-10713",
    kind: "AUTO",
    printedText: "AUTO [Hand]: At the beginning of your ride phase, if you vanguard is a grade 1 or lower unit, COST [Discard this card], look at five cards from the top of your deck, choose a grade 2 or less card from among them, reveal it, put it to hand, and shuffle your deck.",
    requiredLocation: ["hand"],
    trigger: Object.freeze({
      status: "recognized-trigger",
      eventType: "phase.changed",
      subject: "controller",
      requiredPhase: "ride",
      turnRelation: "controller"
    }),
    conditions: Object.freeze([{ type: "controller-vanguard-grade-at-most", count: 1 }]),
    conditionsReviewed: true,
    costs: Object.freeze([{ type: "source-discard", count: 1 }]),
    costsReviewed: true,
    choicesReviewed: true,
    source: Object.freeze({
      dataset: "Bushiroad official card list",
      snapshotDate: "2026-11-04",
      officialCardNumber: "V-PR/0263EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=V-PR%2F0263EN",
      patternId: "auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1",
      review: "Official V-PR/0263EN wording confirmed: only during the controller's Ride Phase, with a grade 1-or-less Vanguard, discard this exact card from hand, then inspect the top five and choose up to one grade 2-or-less card for hand. The local snapshot omits 'up to one' and has a grammar error; this definition preserves the local string for catalog matching but follows the official optional-choice wording. Proposed only: the exact card is not in the authoritative server whitelist yet."
    }),
    effects: Object.freeze([{ op: "search-top-up-to-one-grade-to-hand", target: "controller", lookCount: 5, maximumGrade: 2 }])
  })
]);

const officialReferences = Object.freeze({
  "cfa-10690": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F025EN",
  "cfa-10691": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F053EN",
  "cfa-10693": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F018EN",
  "cfa-10694": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2FFFR02EN",
  "cfa-10700": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F075EN",
  "cfa-10701": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F007EN",
  "cfa-10708": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F061EN",
  "cfa-10709": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F064EN",
  "cfa-10710": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2FDSR01EN",
  "cfa-10713": "https://en.cf-vanguard.com/cardlist/?cardno=V-PR%2F0263EN"
});

const verifiedOfficialAbilities = Object.freeze([
  Object.freeze({
    abilityId: "cfa-10709:0",
    officialPrintedText: "[AUTO](RC):When this unit boosts \"Blaze Maiden, Addison\", you may [Soul-Charge 2].",
    officialReference: officialReferences["cfa-10709"]
  }),
  Object.freeze({
    abilityId: "cfa-10713:0",
    officialPrintedText: "[AUTO](VC/RC)[1/turn]:When this unit attacks while boosted, [COST][Counter-Blast 1], search your deck for up to one grade 2 card with a different card name from this unit, call it to (RC), and shuffle your deck.",
    officialReference: officialReferences["cfa-10713"]
  }),
  Object.freeze({
    abilityId: "cfa-10713:1",
    officialPrintedText: "[AUTO](Hand):At the beginning of your ride phase, if your vanguard is grade 1 or less, [COST][discard this card], look at the top five cards of your deck, choose up to one grade 2 or less card from among them, reveal it and put it into your hand, and shuffle your deck.",
    officialReference: officialReferences["cfa-10713"]
  }),
  Object.freeze({
    abilityId: "cfa-10710:0",
    officialPrintedText: "[AUTO](VC):At the beginning of your battle phase, if all of your units have \"Diabolos\" in their card names, until the end of your opponent's next turn, you \"Final Rush\", and if your opponent's vanguard is grade 3 or greater, you \"Final Burst\".",
    officialReference: officialReferences["cfa-10710"]
  }),
  Object.freeze({
    abilityId: "cfa-10710:1",
    officialPrintedText: "[AUTO](VC):When this unit attacks, if you are in \"Final Burst\", [COST][Counter-Blast 1], choose a column, [Stand] all of your rear-guards with \"Diabolos\" in their card names in that column, and they get [Power] +5000 until end of turn.",
    officialReference: officialReferences["cfa-10710"]
  })
]);

const blockerById = Object.freeze({
  "cfa-10690:0": "This RC placement AUTO searches either deck or Drop for a grade 3 Set Order after paying Counter Blast 1 and Soul Blast 1. The trusted search handlers do not atomically search both zones with this exact type/grade filter, reveal, and conditional shuffle.",
  "cfa-10690:1": "This once-per-turn AUTO needs an exact event for a Set Order entering the controller's Order Zone, then grants this source +5000 until turn end. The current trusted Order Zone entry handler covers different effects and does not validate this power pattern.",
  "cfa-10691:0": "This ACT pays Soul Blast 1 and calls one or two Plant tokens depending on Vanguard grade, using exact token stats and open-circle legality. The current trusted token handler does not authorize this token name and conditional count for this card.",
  "cfa-10693:0": "This hand-to-RC AUTO pays Counter Blast and returns a Vairina from Drop to the bottom of Deck, then looks at five, optionally adds a Vairina, shuffles, and Counter Charges only if none was revealed. No trusted ordered branch supports all steps.",
  "cfa-10694:0": "This placement AUTO requires a Nirvana Vanguard, a hand discard, and a deck search for either an overDress card or Trickstar. The exact card-trait filter and multi-category search are not authorized by a trusted handler.",
  "cfa-10694:1": "The trigger is this exact card becoming an originalDress; it then pays Counter Blast and calls a Trickstar from Drop. The event stream and server allowlist do not validate this originalDress transformation/cost/filtered call sequence.",
  "cfa-10695:0": "This source must boost, then grant the exact boosted attacker a temporary AUTO to move up to two Drop cards into Soul when that attack hits. The existing granted-AUTO machinery does not model this exact optional multi-card effect and owner-side choice.",
  "cfa-10696:0": "This AUTO must match this exact card being discarded from hand during its controller's turn, require a Nirvana Vanguard, pay Counter Blast and Soul Blast, and return a Vairina from Drop to hand. No trusted discard-provenance resolver validates the full filtered sequence.",
  "cfa-10697:0": "This CONT applies +5000 only during the exact battle this unit boosted a unit that is currently an originalDress. The continuous evaluator does not yet model this battle-scoped originalDress relation.",
  "cfa-10699:0": "The ride trigger requires the exact named grade 2 rider and a named card already in Soul, then searches a grade 1 Strategy; if none is found, it optionally calls this source. The ride-search handler lacks this conditional fallback and card-specific rider/Soul checks.",
  "cfa-1069:0": "This deck-to-RC placement AUTO may pay Counter Blast 1, then retires an opponent front-row grade 2-or-less Rear-Guard. The trusted target chooser does not authorize this exact placement origin and opponent grade/front-row filter.",
  "cfa-1069:1": "This source retires itself at the end of the battle in which it was attacked. The event pipeline does not yet provide an authorized source-instance battle-close AUTO for this trigger and location.",
  "cfa-1069:2": "This CONT changes the card's clan identity to Gold Paladin. The game state and continuous keyword evaluator do not safely alter clan identity for rules checks.",
  "cfa-10700:0": "This ride trigger requires an Avantgarda grade 3 rider plus a named Soul card, then searches a grade 2 Strategy and optionally calls this source if no card was found. The trusted ride-search pattern does not support this conditional fallback.",
  "cfa-10701:0": "This once-per-turn ACT pays by moving a Strategy from Order Zone to Soul, draws and grants power, then gives the Vanguard a nested re-stand AUTO with attack-hit/Persona Ride branches and Counter Blast plus discard. The resolver lacks the validated nested temporary ability and ordered cost branch.",
  "cfa-10702:0": "This order-to-Soul trigger retires an opponent Rear-Guard and then grants power to a chosen friendly Vanguard. No trusted event/operation combination validates this exact order instance moving from Order Zone to Soul and both ordered effects.",
  "cfa-10703:0": "This order-to-Soul trigger grants +10000 to a chosen Vanguard and creates an opponent-action restriction lasting until turn end. The game engine does not enforce this restriction across intercept and Blitz Order actions.",
  "cfa-10704:0": "This order-to-Soul AUTO grants a temporary Vanguard attack ability that powers the front row. The resolver does not yet authorize this dynamic granted AUTO with grade condition and correct duration.",
  "cfa-10705:0": "When this unit intercepts, it moves a chosen back-row Rear-Guard to Guardian Circle. Current guardian movement does not authorize this exact source-triggered, player-chosen multi-zone move during guard timing.",
  "cfa-10707:0": "This once-per-turn ACT pays Soul Blast 1 and discards a hand card, then selects a grade 1 Strategy in Drop and adds it to hand. No trusted handler supports the combined costs and filtered Drop-to-hand selection.",
  "cfa-10708:0": "This attack AUTO requires opponent Rear-Guard thresholds, Soul Blast 2, and a battle power amount that changes at one-or-fewer opposing Rear-Guards. The current trusted attack-power family cannot express that conditional amount safely.",
  "cfa-10709:0": "The proposed event/effect definition is ready for review, but the authoritative server whitelist does not include this exact card or Soul Charge 2; do not treat the contribution-only candidate as active server support.",
  "cfa-1070:0": "This Limit Break ride AUTO requires a Narukami ride event, then retires a chosen opponent front-row Rear-Guard and grants +10000 to a chosen Vanguard. No authorized handler applies the two ordered effects after exact ride matching.",
  "cfa-1070:1": "This own-Vanguard-attack AUTO checks the opponent's damage count (not the controller's) before granting +2000 for the battle. The current condition evaluator does not model opponent damage count for this server ability.",
  "cfa-10710:0": "This battle-phase-start AUTO checks all friendly card names, sets Final Rush and possibly Final Burst through the opponent's next turn. The game state has no trusted duration-aware Final Rush/Burst status operation.",
  "cfa-10710:1": "This Vanguard attack AUTO requires Final Burst, Counter Blast 1, a column choice, standing all matching Diabolos Rear-Guards in that column, and granting each +5000. The server lacks the exact status and filtered multi-target resolution.",
  "cfa-10711:0": "This CONT adds power and shield while Final Rush is active, including the opponent's turn. No trusted continuous effect reads a duration-aware Final Rush status for both characteristics.",
  "cfa-10712:0": "This CONT adds power and shield while Final Burst is active on either turn. No trusted continuous effect reads the Final Burst status and applies both modifiers.",
  "cfa-10712:1": "This placement AUTO checks the exact Viamance Bruce Vanguard, pays Counter Blast, Soul Charges, and calls a grade 3-or-less Diabolos from Soul to an open RC. The server lacks this combined ordered resource/effect handler.",
  "cfa-10713:0": "This once-per-turn boosted attack AUTO pays Counter Blast and searches/calls a grade 2 card with a different name from this source. The trusted deck-call handler cannot validate this attack/boost identity and exclusion filter.",
  "cfa-10713:1": "A contribution-only candidate uses the existing top-five grade-2 search effect, but the local text omits the official 'up to one' choice and the authoritative ride-phase server whitelist does not include this card. Reconcile catalog text and add exact server authorization before activation.",
  "cfa-10714:0": "This once-per-turn boosted attack AUTO pays Counter Blast and searches/calls a card sharing a name with a friendly unit while differing from this source. The trusted deck-call filter does not implement this dynamic same-name relation; official English wording was not independently located.",
  "cfa-10714:1": "This hand Ride Phase AUTO resembles the verified Cadafael top-five search, but no official English text was independently found for this card and it is not in the exact server allowlist. Do not infer support from similar local wording.",
  "cfa-1071:0": "This card already has an exact trusted own-attack Counter Blast power definition and is handled as production support."
});

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const abilityById = new Map();
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))];
for (const cardId of cardIds) {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Batch card missing from catalog: ${cardId}`);
  for (const ability of Engine.parseCardAbilitiesCached(card)) abilityById.set(ability.id, ability);
}
for (const definition of proposedDefinitions) {
  const ability = abilityById.get(definition.id);
  if (!ability || ability.cardId !== definition.cardId || ability.kind !== definition.kind || ability.printedText !== definition.printedText) {
    throw new Error(`Proposed definition does not exactly match catalog ability ${definition.id}`);
  }
}

const proposedById = new Map(proposedDefinitions.map(definition => [definition.id, definition]));
const supportedDefinitions = Object.freeze([
  ...alreadySupportedAbilityIds.map(abilityId => {
    const ability = abilityById.get(abilityId);
    if (!ability?.definition || (["AUTO", "ACT"].includes(ability.kind) && !Reducer.supportsServerAbilityEffects(ability))) throw new Error(`Expected trusted production definition missing: ${abilityId}`);
    return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, patternId: ability.definition.source?.patternId || null, implementationStatus: "already-supported-in-production", definition: ability.definition });
  }),
  ...proposedDefinitions.map(definition => Object.freeze({ abilityId: definition.id, kind: definition.kind, catalogPrintedText: definition.printedText, patternId: definition.source.patternId, implementationStatus: "proposed-not-server-authorized", definition }))
]);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedAbilityIds.includes(id) && !proposedById.has(id)).map(abilityId => {
  const ability = abilityById.get(abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) throw new Error(`Expected exact unsupported ability and blocker: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, officialReference: officialReferences[abilityId.slice(0, abilityId.lastIndexOf(":"))] || null, blocker: blockerById[abilityId] });
}));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = cardsById.get(cardId);
  return Object.freeze({ cardId, name: card.name, grade: Number(card.grade), type: card.type || null, nation: card.nation || null, catalogSource: card.source || "Cardfight Area catalog" });
}));

const audit = Object.freeze({
  batchId,
  workerOwner,
  status: "reviewed-contribution-not-integrated",
  dataset: "Cardfight Area local catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  officialTextChecked: false,
  officialTextVerificationNote: "Official Bushiroad entries were checked for the listed card IDs only. Any card without a verified source remains tied to the local Cardfight Area snapshot; source links do not by themselves establish implementation or whole-card support.",
  officialTextReferences: officialReferences,
  officialTextVerifiedAbilityIds: Object.freeze(verifiedOfficialAbilities.map(item => item.abilityId)),
  abilityIds,
  implementedAbilityIds: Object.freeze([]),
  alreadySupportedAbilityIds,
  supportedDefinitions,
  cards,
  unsupportedSiblings,
  proposedDefinitions,
  verifiedOfficialAbilities,
  provenanceNote: "Two abilities were already server-authorized. Two definitions are review candidates that reuse existing operations but remain server-rejected; the remaining 31 are unsupported/unreviewed with specific blockers. No card is promoted to fully verified.",
  fullCardVerification: "none"
});

const contribution = [...proposedDefinitions];
Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });
module.exports = contribution;
