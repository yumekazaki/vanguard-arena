"use strict";

// Exact batch review. This file records support already present in the
// authoritative reducer and explicitly blocked abilities; it adds no
// production definitions.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const batchId = "ABILITY-76D8A0B8-0004";
const workerOwner = "primary-session-sprint-0004";
const abilityIds = Object.freeze([
  "cfa-10740:0", "cfa-10742:0", "cfa-10742:1", "cfa-10743:0", "cfa-10743:1",
  "cfa-10744:0", "cfa-10744:1", "cfa-10745:0", "cfa-10745:1", "cfa-10746:0",
  "cfa-10747:0", "cfa-10748:0", "cfa-10749:0", "cfa-10750:0", "cfa-10751:0",
  "cfa-10752:0", "cfa-10753:0", "cfa-10754:0", "cfa-10755:0", "cfa-10756:0",
  "cfa-10757:0", "cfa-10758:0", "cfa-10758:1", "cfa-10759:0", "cfa-10760:0",
  "cfa-10760:1", "cfa-10761:0", "cfa-10761:1", "cfa-10762:0", "cfa-10765:0",
  "cfa-10765:1", "cfa-10766:0", "cfa-1076:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10746:0", "cfa-10756:0", "cfa-10758:1", "cfa-10760:1", "cfa-1076:0"
]);

const blockerById = Object.freeze({
  "cfa-10740:0": "This AUTO is triggered by this exact card entering GC and checks for a grade-3-or-higher Set Order before changing this guardian's shield for that battle. The reducer has no reviewed order-grade GC shield definition for this card.",
  "cfa-10742:0": "The trigger is a ride by the exact named Stogron. It requires a normal-unit/trigger-unit declaration, a top-card reveal, and a choice to take a match or put a non-taken card into Soul or back on top. This ordered reveal and destination choice is not represented by a trusted effect program.",
  "cfa-10742:1": "This placement AUTO requires a Solrairon Vanguard, optionally reveals a Normal Unit from hand, then draws only if a card was revealed and places that exact card on top of Deck. The sequential reveal/draw/restore operation has no reviewed server definition.",
  "cfa-10743:0": "This exact ride event must call both the source from the ride and a specifically named card from Soul to RC. The resolver does not support this two-source call sequence with exact ride and Soul-instance checks.",
  "cfa-10743:1": "A Solrairon reveal grants a temporary, nested attack-end AUTO that retires this source as cost and Counter Charges. The engine lacks a reviewed grant for that nested ability and battle-end cost.",
  "cfa-10744:0": "At Battle Phase start this pays Soul Blast 1, asks the player to declare a card type, reveals the top card, and conditionally grants a global +5000 CONT through turn end. The reveal choice and temporary global modifier are not supported as this ordered ability.",
  "cfa-10744:1": "This own Vanguard attack pays Counter Blast 1, looks at two cards, chooses one to call or discard, and independently orders the remaining card on top or bottom. The multi-choice deck-reordering sequence is not implemented for this exact source.",
  "cfa-10745:0": "This repeats the Solrairon-gated reveal-from-hand, conditional draw, and exact revealed-card return-to-top sequence. No trusted definition currently covers these ordered choices.",
  "cfa-10745:1": "A Solrairon reveal grants a temporary once-per-turn attack AUTO with a +5000 choice and delayed source-to-Soul movement. The nested ability and its once-per-turn record are unsupported.",
  "cfa-10747:0": "The source must be the actual booster during Final Rush; it then gains +5000 until turn end. There is no reviewed Final Rush-state condition tied to the exact boosting event.",
  "cfa-10748:0": "This Order Zone CONT grants +2000 to all of its controller's front-row units only during that controller's turn. The continuous evaluator currently has no generic Order source-to-front-row power effect.",
  "cfa-10749:0": "This RC placement AUTO pays Counter Blast 1, reveals the top five, searches for one of two exact named cards, adds it, and shuffles. No reviewed definition authorizes this exact search filter and resolution.",
  "cfa-10750:0": "This RC placement AUTO pays Counter Blast 1, reveals the top five, searches for one of two different exact named cards, adds it, and shuffles. It is a separate filter from cfa-10749:0 and is not supported by its own trusted definition.",
  "cfa-10751:0": "This CONT has three order-count thresholds with different scopes: own-turn power, opponent-effect targeting protection, and a back-row-center condition that powers all back-row units on either turn. The engine cannot represent this complete multi-threshold program.",
  "cfa-10752:0": "This Set Order can move from hand/Order Zone to Order Zone or Soul during its controller's turn; its Operate AUTO then creates a 10000-power unit with Boost and returns that unit to Order Zone at turn end. Neither the source-choice movement nor the temporary operated unit lifecycle is supported.",
  "cfa-10753:0": "The source's own Vanguard attack requires Favrneel, moves a different friendly Rear-Guard to Soul as cost, retires an opponent Rear-Guard, then checks the updated Soul's Dark States grade sum before Counter Charge. The ordered multi-owner targets and post-cost condition are unsupported.",
  "cfa-10754:0": "This back-row AUTO begins at Battle Phase, requires Granfia, calls up to one Plant token, then conditionally offers a Counter Blast draw if a Noblesserose token is on RC. The token and dependent optional-cost sequence is not authorized for this card.",
  "cfa-10755:0": "This trigger depends on a Normal Unit being revealed by an ability of this controller's Solrairon Vanguard, then grants Boost and +5000 to this exact Rear-Guard for turn end. Reveal provenance and the paired temporary keyword/power grant are not implemented for this ability.",
  "cfa-10757:0": "This AUTO is triggered by playing a grade-3-or-higher Normal Order, requires this exact source on RC, pays Soul Blast 1, and grants +10000 through turn end. The order-play event, source location, cost, and temporary modifier lack a reviewed definition for this card.",
  "cfa-10758:0": "This once-per-turn own attack must actually be boosted. After Soul Blast 1 it reveals the top card, calls a qualifying grade-1-or-higher unit locked to an open RC, and otherwise restores the card to its original deck position. The exact boosted source and no-move-on-failure path are unsupported.",
  "cfa-10759:0": "This once-per-turn AUTO requires a different friendly unit to be placed on RC from Order Zone by this controller's card ability; only that unit and this source get +5000 until turn end. Placement provenance and the exact two-card target set are not covered by a reviewed resolver.",
  "cfa-10760:0": "This once-per-turn attack AUTO requires the source itself to attack while boosted, pays Counter Blast 1, creates a Plant token on RC, and grants that token +5000. No exact source-linked token effect is available for this card.",
  "cfa-10761:0": "This AUTO triggers only when this exact card moves from Deck or RC into Soul during its controller's turn, then binds that same Soul instance as cost before Soul Charging. The zone-transition provenance and bind-from-Soul transaction are unsupported.",
  "cfa-10761:1": "This Bind Zone AUTO requires two or more of its controller's Rear-Guards to enter Soul simultaneously during that turn, then pays Counter Blast 1 and calls this exact bound card to an open RC. The simultaneous multi-card event and source call are not supported together.",
  "cfa-10762:0": "At turn end, this back-row source checks for Gramgrace, retires itself as cost, and returns a grade-3 unit from its controller's Soul to hand. This exact end-phase cost and filtered Soul-to-hand choice are not implemented.",
  "cfa-10765:0": "This Soul AUTO reacts to a grade-4 Messiah being placed on VC, may call this exact source to RC, and Soul Charges only if the call succeeds. It needs an exact ride/place event and conditional follow-up not present in the resolver.",
  "cfa-10765:1": "This AUTO requires this exact card to be unlocked during its controller's turn and gives +10000 to a unit in the same column until turn end. Unlock provenance and validated same-column targeting are not supported for this source.",
  "cfa-10766:0": "The source's own RC attack requires GB1 and a Messiah Vanguard, grants +5000 only through that battle, then locks this exact source at battle end. The delayed lock after a source-scoped attack effect is not implemented for this ability."
});

const officialReferences = Object.freeze({
  "cfa-10742": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F087EN",
  "cfa-10743": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F082EN",
  "cfa-10744": "https://en.cf-vanguard.com/cardlist/cardsearch/?clan=&grade%5B0%5D=all&keyword=solrairon&keyword_type%5B0%5D=all&kind%5B0%5D=all&nation=Keter+Sanctuary&power_from=&power_to=&rare=&regulation=D&sort=no&trigger%5B0%5D=all&view=image&view=text",
  "cfa-10745": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203&s_param=d-Keter+Sanctuary&sort=no&view=text",
  "cfa-10746": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F090EN",
  "cfa-10752": "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F222EN",
  "cfa-10753": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS07%2F019EN",
  "cfa-10754": "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F224EN",
  "cfa-10755": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F049EN",
  "cfa-10757": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F091EN",
  "cfa-10761": "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F210EN",
  "cfa-10765": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS04%2F002EN",
  "cfa-10766": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS04%2F007EN",
  "cfa-1076": "https://en.cf-vanguard.com/cardlist/?cardno=TD09%2F007EN"
});

// These sources were opened and their English effect text matched the local
// catalog text semantically. They validate text provenance only; no ability
// is marked supported by this list.
const officialTextReviewedAbilityIds = Object.freeze([
  "cfa-10742:0", "cfa-10742:1", "cfa-10743:0", "cfa-10744:0", "cfa-10744:1",
  "cfa-10745:0", "cfa-10745:1", "cfa-10746:0", "cfa-10752:0", "cfa-10753:0",
  "cfa-10754:0", "cfa-10755:0", "cfa-10757:0", "cfa-10761:0", "cfa-10761:1",
  "cfa-10765:0", "cfa-10765:1", "cfa-10766:0", "cfa-1076:0"
]);

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const supportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(abilityId => !supportedSet.has(abilityId)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) throw new Error(`Expected exact unsupported catalog ability and blocker: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialReference: officialReferences[cardId] || null,
    officialTextReviewed: officialTextReviewedAbilityIds.includes(abilityId),
    blocker: blockerById[abilityId]
  });
}));

const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  const runtimeHandlerSupported = ability?.kind === "CONT"
    ? Engine.evaluateContinuousEffects([ability], { location: "rear-guard", isControllerTurn: true, dragontreeMarkerCount: 1, sourceInstanceId: "source", targetInstanceId: "source" }).power > 0
    : Reducer.supportsServerAbilityEffects(ability);
  if (!ability?.definition || !runtimeHandlerSupported) throw new Error(`Expected reviewed production handler: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    serverHandlerSupported: runtimeHandlerSupported,
    officialReference: officialReferences[cardId] || null,
    officialTextReviewed: officialTextReviewedAbilityIds.includes(abilityId)
  });
}));

module.exports = Object.freeze({
  batchId,
  workerOwner,
  abilityIds,
  alreadySupportedAbilityIds,
  supportedDefinitions,
  proposedDefinitions: Object.freeze([]),
  unsupportedSiblings,
  officialReferences,
  officialTextReviewedAbilityIds
});
