"use strict";

// Exact batch review. No unsupported effect is added to production.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");
const fs = require("node:fs");
const path = require("node:path");

const batchId = "ABILITY-320008F1-0030";
const workerOwner = "worker-0030-review";
const abilityIds = Object.freeze([
  "cfa-10829:0", "cfa-10831:0", "cfa-10832:0", "cfa-10832:1", "cfa-10838:0",
  "cfa-10839:0", "cfa-10840:0", "cfa-10841:0", "cfa-10841:1", "cfa-10842:0",
  "cfa-10843:0", "cfa-10843:1", "cfa-10844:0", "cfa-10844:1", "cfa-10846:0",
  "cfa-10847:0", "cfa-10847:1", "cfa-10847:2", "cfa-10848:0", "cfa-10851:0",
  "cfa-10852:0", "cfa-10852:1", "cfa-10853:0", "cfa-10854:0", "cfa-10855:0",
  "cfa-10856:0", "cfa-10856:1", "cfa-10857:0", "cfa-10857:1", "cfa-10858:0",
  "cfa-10858:1", "cfa-10858:2", "cfa-10859:0", "cfa-10860:0", "cfa-10860:1",
  "cfa-10860:2", "cfa-10861:0", "cfa-1086:0", "cfa-1086:1"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10841:0", "cfa-10844:0", "cfa-10844:1", "cfa-10847:0", "cfa-10852:0",
  "cfa-10857:1", "cfa-10858:0", "cfa-10860:0", "cfa-1086:0"
]);
const proposedDefinitions = Object.freeze([]);
const supportModes = Object.freeze({
  "cfa-10841:0": "authoritative-auto-resolution",
  "cfa-10844:0": "sentinel-keyword-and-deck-limit",
  "cfa-10844:1": "authoritative-auto-resolution",
  "cfa-10847:0": "ride-legality-restriction",
  "cfa-10852:0": "authoritative-auto-resolution",
  "cfa-10857:1": "authoritative-auto-resolution",
  "cfa-10858:0": "zone-aware-vanguard-name-alias",
  "cfa-10860:0": "ride-legality-restriction",
  "cfa-1086:0": "authoritative-auto-resolution"
});

const officialTextReviews = Object.freeze([
  { abilityId: "cfa-10841:0", officialPrintedText: "[AUTO]:When this card is discarded from hand during your ride phase, [COST][Soul-Blast 1 & put this card on the bottom of the deck], and draw a card.", officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203", matchesCatalogText: true },
  { abilityId: "cfa-10841:1", officialPrintedText: "[AUTO]:When this unit is placed on (RC), if you persona rode this turn, [COST][Counter-Blast 1], search your deck for up to one set order, reveal it and put it into your hand, and shuffle your deck. Until end of turn, you may play up to a total of two orders, and play the next set order without paying its cost.", officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203", matchesCatalogText: true },
  { abilityId: "cfa-10844:0", officialPrintedText: "[CONT]:Sentinel (You may only have up to four cards with [CONT]:Sentinel in a deck.)", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2FEX26EN", matchesCatalogText: true },
  { abilityId: "cfa-10844:1", officialPrintedText: "[AUTO]:When this unit is put on (GC), choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from your hand, and discard it.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2FEX26EN", matchesCatalogText: true },
  { abilityId: "cfa-10847:0", officialPrintedText: "[CONT]:This card can only be ridden from a grade 3 with Astroea in its card name.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F005EN", matchesCatalogText: true },
  { abilityId: "cfa-10847:1", officialPrintedText: "[ACT](VC)[1/turn]:[COST][Remove a card with Astroea in its different card name from this unit from your hand, soul, or drop], choose one of your opponent's rear-guards, retire it, and this unit gets drive +1 until end of turn.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F005EN", matchesCatalogText: true },
  { abilityId: "cfa-10847:2", officialPrintedText: "[AUTO](VC):When this unit attacks, [COST][Counter-Blast 1 & Soul-Blast 3], bind all Critical triggers Soul-Blasted for this cost, choose one of your rear-guards, stand it, and that unit and this unit get power +5000 until end of turn for every two Critical triggers in your bind zone.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F005EN", matchesCatalogText: true },
  { abilityId: "cfa-10852:0", officialPrintedText: "[AUTO]:When this card is discarded from hand during your ride phase, [COST][Soul-Blast 1 & put this unit on the bottom of the deck], and draw a card.", officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203", matchesCatalogText: true },
  { abilityId: "cfa-10852:1", officialPrintedText: "[AUTO]:When this unit is placed on (RC) from hand, if you persona rode this turn, [COST][Counter-Blast 1], choose a card from your soul, and call it to (RC). If you called a card, you may Soul-Charge 1.", officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203", matchesCatalogText: true },
  { abilityId: "cfa-10857:0", officialPrintedText: "[AUTO](RC):When this unit attacks, if you have a vanguard with Sorceress in its card name, look at the top card of your deck. If your vanguard is [Stand], you may put that looked card into your soul.", officialReference: "https://en.cf-vanguard.com/deckrecipe/detail/d-bt10-aquamarine", matchesCatalogText: true },
  { abilityId: "cfa-10857:1", officialPrintedText: "[AUTO](RC):When your drive check reveals a trigger unit, this unit gets power +5000 until end of turn.", officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203&s_param=d-Keter+Sanctuary&sort=no&view=text", matchesCatalogText: true },
  { abilityId: "cfa-10858:0", officialPrintedText: "[CONT](VC):This unit is also regarded as Hexaorb Sorceress.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2FFFR11EN", matchesCatalogText: true },
  { abilityId: "cfa-10858:1", officialPrintedText: "[CONT](VC):If you persona rode this turn, this unit gets drive +1, and the power increase of your trigger effects gets +10000.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2FFFR11EN", matchesCatalogText: true },
  { abilityId: "cfa-10858:2", officialPrintedText: "[AUTO](VC):When a trigger unit is revealed for the drive check of the battle this unit attacked, [COST][Soul-Blast 1], choose one of your rear-guards, and stand it.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2FFFR11EN", matchesCatalogText: true },
  { abilityId: "cfa-10860:0", officialPrintedText: "[CONT]:This card can only be ridden from a grade 3 with Lianorn in its card name.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2FSEC05EN", matchesCatalogText: true },
  { abilityId: "cfa-10860:1", officialPrintedText: "[ACT](VC)[1/turn]:[COST][Remove a card with Lianorn in its different card name from this unit from your hand, soul, or drop], choose a grade 1 or less card from your drop, call it to (RC), choose one of your opponent's rear-guards, and retire it.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2FSEC05EN", matchesCatalogText: true },
  { abilityId: "cfa-10860:2", officialPrintedText: "[AUTO](VC):When this unit attacks, choose up to three of your back row [Stand] units with Boost, and boost this unit. If you boosted with three or more units, at the end of that battle, [COST][Counter-Blast 1], choose two of your rear-guards, and stand them.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2FSEC05EN", matchesCatalogText: true },
  { abilityId: "cfa-1086:0", officialPrintedText: "[AUTO]:Forerunner (When a unit of the same clan rides this unit, you may call this unit to (RC)).", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F085EN", matchesCatalogText: true },
  { abilityId: "cfa-1086:1", officialPrintedText: "[ACT](RC):[Put this unit into your soul & choose a unit named Sword Dance Eradicator, Hisen on your (RC), and put it into your soul] If you have a unit named Supreme Army Eradicator, Zuitan on your (VC), search your deck for up to one card named Eradicator, Dragonic Descendant, ride it, and shuffle your deck.", officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F085EN", matchesCatalogText: false }
]);

const blockerById = Object.freeze({
  "cfa-10829:0": "This Drop ACT reveals a grade-3 Masques card from hand, rides that exact card, moves this source into Soul only after a successful ride, and can activate Persona Ride conditionally. Ride-from-Drop ordering, revealed-card provenance, and Persona Ride history are not implemented as one validated action.",
  "cfa-10831:0": "The trigger requires the exact named Vanguard attack, absence of Keel Severing on RC, Counter-Blast 1, and retiring a friendly Rear-Guard before calling this Drop source to a marked RC. The exact attack/name check and Dragontree-circle call sequence are not a trusted effect program.",
  "cfa-10832:0": "This Generation Break AUTO triggers when any locked card is unlocked, pays Soul Blast 1, and draws. The engine does not yet model all unlock actions with their exact card identities and then revalidate this Vanguard's GB2 condition.",
  "cfa-10832:1": "On this player's own Stride event, this effect pays Counter-Blast and locks a friendly Rear-Guard as cost, locks an opponent Rear-Guard, then buffs a Vanguard. Ordered cross-player lock choices and temporary lock-state enforcement are unsupported.",
  "cfa-10838:0": "This exact booster must discard a hand card, choose a Vanguard, and gain power calculated as 2000 for every two grades of that chosen Vanguard. No trusted handler combines the exact boost event, discard, target choice, and grade-derived battle modifier.",
  "cfa-10839:0": "At the end of this exact card's boost battle, it checks whether either player's Rear-Guard was retired during the turn, then binds itself face down and draws. The shared turn-history query and source-bound delayed cost sequence are not yet modeled.",
  "cfa-10840:0": "The Gandeeva placement effect retires an opponent Rear-Guard for Counter-Blast, then conditionally draws and binds a Drop card only if no card was retired. The branch and its choice/cost sequencing are not available as a reviewed atomic resolution.",
  "cfa-10841:1": "After a Persona Ride and this source's RC placement, the effect searches and reveals a Set Order, then changes the order-play limit and waives the next Set Order cost for the turn. Order history and temporary action/cost restrictions are not implemented.",
  "cfa-10842:0": "This hand-to-RC AUTO requires Abyssal Dark Night, Soul Blast 1, and creation of a Shadow Army token in this source's column. World-state validation and this exact token type/placement operation are not supported.",
  "cfa-10843:0": "The optional hand-to-RC effect requires Dark Night or Abyssal Dark Night, inspects seven hidden deck cards, discards up to two World cards, and shuffles. The exact World predicate and private multi-card selection/discard transaction are missing.",
  "cfa-10843:1": "This battle-close AUTO requires the exact source attack, Abyssal Dark Night, and retiring this source before selecting up to one World card from Drop for hand. The engine lacks a trusted combined end-of-battle source-cost and filtered retrieval sequence.",
  "cfa-10846:0": "The trigger is playing an order through Alchemagic; it then discards a card and calls a grade-1-or-less Drop card into the source's column. The Alchemagic event provenance, cost, target filter, and same-column placement are not modeled together.",
  "cfa-10847:1": "This ACT removes a differently named Astroea card from hand, Soul, or Drop, retires an opponent Rear-Guard, and grants drive. The engine does not yet validate the multi-zone exact-name cost and then resolve the target and drive change atomically.",
  "cfa-10847:2": "This Vanguard attack pays Counter-Blast and Soul-Blast 3, binds only Critical Triggers among cards paid, stands a Rear-Guard, and scales power by Critical count. Typed cost-card selection and ordered count-dependent attack effects are unsupported.",
  "cfa-10848:0": "This ACT requires an Almajestar Vanguard, retires this source, and may move up to two Critical Triggers from Bind to Soul. The trusted operation set does not yet resolve this typed multi-target Bind-to-Soul action.",
  "cfa-10851:0": "This once-per-turn AUTO must detect a single Vanguard ability Soul-Blasting at least three cards, look at the deck top, choose to leave it or Soul Charge it, and gain power. Cost-event provenance and the private top-card choice are missing.",
  "cfa-10852:1": "This hand placement AUTO requires Persona Ride, Counter-Blast 1, selection and call of a card from Soul, and only then may Soul Charge. The exact any-card Soul target, open-circle validation, and conditional follow-up sequence are not yet supported.",
  "cfa-10853:0": "This booster pays a hand discard and scales its battle power by half the chosen Vanguard's grade. The authoritative engine has no approved version of the exact boost/discard/grade-derived modifier sequence for this card.",
  "cfa-10854:0": "This AUTO requires the source itself to boost from a Dragontree-marked RC and gives +5000 to a chosen front-row Rear-Guard until turn end. The trusted boost event and marked-circle plus front-row target constraints are not combined in a reviewed handler.",
  "cfa-10855:0": "On placement, this effect checks for a grade-0 Rear-Guard, Soul Charges, then chooses one grade-0 Rear-Guard for power. It requires revalidation after the charge and a grade-filtered target selection, neither represented by an exact trusted program.",
  "cfa-10856:0": "The printed trigger says the source is discarded during Ride Phase but omits the hand-origin restriction required by the similar supported family. Reusing that family would incorrectly suppress valid discard origins, so a distinct source-zone rule must be reviewed before support.",
  "cfa-10856:1": "After Persona Ride and placement, this AUTO pays Counter-Blast, inspects two hidden cards, puts one into hand, and chooses top or bottom for the remainder. A private pick plus independent ordering choice is not a trusted effect sequence.",
  "cfa-10857:0": "This Rear-Guard attack checks a Sorceress Vanguard and inspects the deck top, then conditionally Soul Charges it based on the Vanguard's stand/rest state. Attack-source identity, private look, and conditional movement are not supported together.",
  "cfa-10858:1": "This continuous Vanguard ability depends on Persona Ride, grants drive, and modifies the power increase from all trigger effects. The engine does not yet apply a rules-aware global trigger-power replacement for the turn.",
  "cfa-10858:2": "This AUTO requires a trigger revealed in the drive checks of this exact Vanguard's attack, Soul Blast 1, and a chosen Rear-Guard stand. The trigger-check event must retain battle/source identity through the resolution window; that linkage is not trusted for this ability.",
  "cfa-10859:0": "This once-per-turn AUTO reacts only when a Set Order played from hand enters the Order Zone, gives power, and optionally searches the top five for a Set Order before shuffling. The exact order-origin event and optional filtered search are not approved together.",
  "cfa-10860:1": "This ACT removes a differently named Lianorn card from hand, Soul, or Drop, calls a grade-1-or-less Drop card, then retires an opponent Rear-Guard. Its multi-zone name-filtered cost and sequential targets are unsupported.",
  "cfa-10860:2": "The attack may be boosted simultaneously by up to three selected standing back-row Boost units; if at least three boosted it, battle close pays Counter-Blast and stands two Rear-Guards. Multi-unit boost registration and delayed conditional resolution are missing.",
  "cfa-10861:0": "This placement AUTO must distinguish a placement caused by this player's card ability from other placements, then grant power; deck-origin placement additionally costs Soul Blast, draws, and grants Boost. Causal effect and original-zone provenance are not authoritative for this sequence.",
  "cfa-1086:1": "The catalog text says Conquering Eradicator, Zuitan, while Bushiroad's official BT10 text says Supreme Army Eradicator, Zuitan. This name discrepancy changes the exact Vanguard requirement; the ACT also needs a two-card Soul cost, exact deck search, and ride, so it remains blocked pending text/data reconciliation and effect support."
});

const root = path.resolve(__dirname, "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "ability-work-batches.json"), "utf8"));
const queuedAbilityCounts = new Map();
for (const batch of registry.batches) for (const id of batch.abilityIds) queuedAbilityCounts.set(id, (queuedAbilityCounts.get(id) || 0) + 1);
const untrackedAbilityIds = abilityIds.filter(id => queuedAbilityCounts.get(id) !== 1);
if (untrackedAbilityIds.length) throw new Error("Audit abilities are absent or duplicated in the current queue: " + untrackedAbilityIds.join(", "));
const catalog = loadCatalog(root);
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const supportedSet = new Set(alreadySupportedAbilityIds);
const officialById = new Map(officialTextReviews.map(item => [item.abilityId, item]));

const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) {
    throw new Error("Expected exact unsupported ability and concrete blocker: " + abilityId);
  }
  const official = officialById.get(abilityId);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null,
    officialTextMatchesCatalog: official?.matchesCatalogText ?? null,
    blocker: blockerById[abilityId]
  });
}));

const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error("Expected reviewed definition missing: " + abilityId);
  const serverHandlerSupported = Reducer.supportsServerAbilityEffects(ability);
  const supportMode = supportModes[abilityId];
  if (supportMode === "authoritative-auto-resolution" && !serverHandlerSupported) {
    throw new Error("Expected authoritative server effect handler missing: " + abilityId);
  }
  const official = officialById.get(abilityId);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    supportMode,
    serverHandlerSupported,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null
  });
}));

module.exports = Object.freeze({
  batchId,
  workerOwner,
  abilityIds,
  alreadySupportedAbilityIds,
  supportModes,
  supportedDefinitions,
  proposedDefinitions,
  unsupportedSiblings,
  verifiedOfficialAbilities: officialTextReviews,
  officialTextReviews
});
