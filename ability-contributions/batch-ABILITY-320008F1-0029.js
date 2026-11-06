"use strict";

// Exact review of batch 0029. It records existing runtime support and the
// specific missing mechanics; it adds no production definitions.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");
const fs = require("node:fs");
const path = require("node:path");

const batchId = "ABILITY-320008F1-0029";
const workerOwner = "worker-0029-review";
const abilityIds = Object.freeze([
  "cfa-10767:0", "cfa-10768:0", "cfa-10770:0", "cfa-10770:1", "cfa-10771:0",
  "cfa-10772:0", "cfa-10772:1", "cfa-10773:0", "cfa-10774:0", "cfa-10775:0",
  "cfa-10775:1", "cfa-10776:0", "cfa-10776:1", "cfa-10777:0", "cfa-10777:1",
  "cfa-10779:0", "cfa-1077:0", "cfa-10781:0", "cfa-10781:1", "cfa-1080:0",
  "cfa-10817:0", "cfa-10819:0", "cfa-10819:1", "cfa-10820:0", "cfa-10821:0",
  "cfa-10821:1", "cfa-10821:2", "cfa-10822:0", "cfa-10823:0", "cfa-10824:0",
  "cfa-10824:1", "cfa-10825:0", "cfa-10825:1", "cfa-10825:2", "cfa-10825:3",
  "cfa-10826:0", "cfa-10828:0", "cfa-108:0"
]);

// These are already enforced through tested server handlers or dedicated
// continuous/ride-rule paths. CONT abilities are intentionally not fed to
// the AUTO/ACT effect dispatcher.
const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10774:0", "cfa-10775:0", "cfa-10775:1", "cfa-10776:0", "cfa-10777:0",
  "cfa-1077:0", "cfa-10781:0", "cfa-10781:1", "cfa-10825:0"
]);
const supportModes = Object.freeze({
  "cfa-10774:0": "authoritative-auto-resolution",
  "cfa-10775:0": "authoritative-continuous-power",
  "cfa-10775:1": "authoritative-auto-resolution",
  "cfa-10776:0": "authoritative-continuous-guardian-shield",
  "cfa-10777:0": "authoritative-continuous-power",
  "cfa-1077:0": "authoritative-auto-resolution",
  "cfa-10781:0": "authoritative-auto-resolution",
  "cfa-10781:1": "authoritative-auto-resolution",
  "cfa-10825:0": "authoritative-ride-legality-restriction"
});

const officialReferences = Object.freeze({
  "cfa-10767": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F066EN",
  "cfa-10768": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F086EN",
  "cfa-10770": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F009EN",
  "cfa-10774": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F084EN",
  "cfa-10775": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS04%2F005EN",
  "cfa-10776": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS04%2F011EN",
  "cfa-10777": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=204&sort=no&view=text",
  "cfa-10779": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS04%2F010EN-R",
  "cfa-1077": "https://en.cf-vanguard.com/cardlist/?cardno=TD09%2F008EN",
  "cfa-1080": "https://en.cf-vanguard.com/cardlist/?cardno=TD09%2F012EN",
  "cfa-10819": "https://en.cf-vanguard.com/information/d_booster_set_10_dragon_masquerade_official_guide/",
  "cfa-10820": "https://en.cf-vanguard.com/information/d_booster_set_10_dragon_masquerade_official_guide/",
  "cfa-10821": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203&sort=no&view=text",
  "cfa-10822": "https://en.cf-vanguard.com/information/d_booster_set_10_dragon_masquerade_official_guide/",
  "cfa-10823": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=203&sort=no&view=text",
  "cfa-10824": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2F054EN",
  "cfa-10825": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT10%2FFFR13EN",
  "cfa-10828": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS04%2F017EN-R"
});

// Exact printed texts checked against Bushiroad's official card-list pages.
// This is text provenance only; it does not make an unsupported effect live.
const officialTextReviews = Object.freeze([
  { abilityId: "cfa-10767:0", officialPrintedText: "[AUTO]:When this unit is placed on (RC), choose one of your vanguards, and this unit gets [Power] +2000 until end of turn for every two grades of that unit.", officialReference: officialReferences["cfa-10767"], matchesCatalogText: true },
  { abilityId: "cfa-10768:0", officialPrintedText: "[AUTO]Back Row (RC):When your other unit [Stand] by your card's ability, [COST][put this unit into soul], choose one of the units [Stand], and it gets [Power] +5000 until end of turn.", officialReference: officialReferences["cfa-10768"], matchesCatalogText: true },
  { abilityId: "cfa-10770:0", officialPrintedText: "[AUTO]:When this unit is placed on (RC), if you have a vanguard with \"Blue Deathster\" in its card name, [COST][Counter-Blast 1], and draw a card.", officialReference: officialReferences["cfa-10770"], matchesCatalogText: true },
  { abilityId: "cfa-10770:1", officialPrintedText: "[AUTO](RC):When this unit boosts, if your Strategy card was put into the order zone this turn, until end of that battle, this unit gets [Power] +2000, and if this unit is in the back row center column, [Counter-Charge 1].", officialReference: officialReferences["cfa-10770"], matchesCatalogText: true },
  { abilityId: "cfa-10774:0", officialPrintedText: "[AUTO]:When this unit is placed on (RC) from deck, this unit gets [Power] +10000 until end of turn.", officialReference: officialReferences["cfa-10774"], matchesCatalogText: true },
  { abilityId: "cfa-10775:0", officialPrintedText: "[CONT](RC)[Generation Break 2](Active if you have two or more face up G units in total on your (VC) or G zone):During your turn, if any player has a locked card, this unit gets [Power] +10000.", officialReference: officialReferences["cfa-10775"], matchesCatalogText: true },
  { abilityId: "cfa-10775:1", officialPrintedText: "[AUTO]:When this card is discarded from hand for the cost of [Stride], draw a card.", officialReference: officialReferences["cfa-10775"], matchesCatalogText: true },
  { abilityId: "cfa-10776:0", officialPrintedText: "[CONT](GC):If you have a vanguard with \"Messiah\" in its card name, this unit gets [Shield] +5000.", officialReference: officialReferences["cfa-10776"], matchesCatalogText: true },
  { abilityId: "cfa-10776:1", officialPrintedText: "[AUTO](RC):When your other unit is unlocked, you may put this unit into your soul.", officialReference: officialReferences["cfa-10776"], matchesCatalogText: true },
  { abilityId: "cfa-10779:0", officialPrintedText: "[AUTO](RC)[Generation Break 1](Active if you have one or more face up G units in total on your (VC) or G zone):At the end of the battle this unit boosted, if you have a vanguard with \"Messiah\" in its card name, [COST][lock this unit], choose one of your vanguards, and it gets [Power] +5000 until end of turn. Then, if you have no face up cards in your damage zone, [Counter-Charge 1].", officialReference: officialReferences["cfa-10779"], matchesCatalogText: true },
  { abilityId: "cfa-1077:0", officialPrintedText: "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards your opponent has is two or less, this unit gets [Power] +3000 until end of that battle.", officialReference: officialReferences["cfa-1077"], matchesCatalogText: true },
  { abilityId: "cfa-1080:0", officialPrintedText: "[AUTO](RC):When this unit boosts ([Boost]) a <Narukami> vanguard, if the number of cards in your opponent's damage zone is three or more, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.", officialReference: officialReferences["cfa-1080"], matchesCatalogText: true },
  { abilityId: "cfa-10821:0", officialPrintedText: "[AUTO](VC):When your opponent's rear-guard is retired during your turn, choose a card from your drop, and you may bind it face down.", officialReference: officialReferences["cfa-10821"], matchesCatalogText: true },
  { abilityId: "cfa-10821:1", officialPrintedText: "[CONT](VC):During your turn, all of your front row units get [Power] +2000 for each face down card in your bind zone. If your bind zone has five or more face down cards, this unit gets [Critical] +1.", officialReference: officialReferences["cfa-10821"], matchesCatalogText: true },
  { abilityId: "cfa-10821:2", officialPrintedText: "[ACT](VC)[1/turn]:[COST][Counter-Blast 1], and choose five of your opponent's rear-guards with different grades from each other. Reveal the top five cards of your deck, retire all of the chosen units with the same grades as the cards revealed, shuffle your deck, and if you retired one or less cards, draw a card, choose a card from your drop, and bind it face down.", officialReference: officialReferences["cfa-10821"], matchesCatalogText: true },
  { abilityId: "cfa-10823:0", officialPrintedText: "[AUTO](RC):When your vanguard with \"Gandeeva\" in its card name attacks a grade 3 or greater vanguard, [COST][Counter-Blast 1 & bind this unit face down], look at the top five cards of your deck, choose up to one grade 3 or less unit card from among them, call it to (RC), and shuffle your deck.", officialReference: officialReferences["cfa-10823"], matchesCatalogText: true },
  { abilityId: "cfa-10824:0", officialPrintedText: "[CONT]:This card cannot be ridden.", officialReference: officialReferences["cfa-10824"], matchesCatalogText: true },
  { abilityId: "cfa-10824:1", officialPrintedText: "[AUTO]:When this unit is placed on (RC) from hand, retire this unit.", officialReference: officialReferences["cfa-10824"], matchesCatalogText: true },
  { abilityId: "cfa-10825:0", officialPrintedText: "[CONT]:This card can only be ridden from a grade 3 with \"Zorga\" in its card name.", officialReference: officialReferences["cfa-10825"], matchesCatalogText: true },
  { abilityId: "cfa-10825:1", officialPrintedText: "[CONT](VC):When you would play a normal order, you can bind a normal order from your drop, and Alchemagic.", officialReference: officialReferences["cfa-10825"], matchesCatalogText: true },
  { abilityId: "cfa-10825:2", officialPrintedText: "[CONT](VC):If you did Alchemagic this turn, all of your front row units get [Power] +10000.", officialReference: officialReferences["cfa-10825"], matchesCatalogText: true },
  { abilityId: "cfa-10825:3", officialPrintedText: "[ACT](VC)[1/turn]:[COST][Remove a card with \"Zorga\" in its different card name from this unit from your hand, soul, or drop], choose a card from your drop, and call it to (RC) if it is a unit card, or put it into your hand if it is a normal order.", officialReference: officialReferences["cfa-10825"], matchesCatalogText: true },
  { abilityId: "cfa-10828:0", officialPrintedText: "[AUTO](VC)[Generation Break 2]:When this unit attacks, [COST][Counter-Blast 1], choose any number of any player's locked cards, and unlock them. If you unlocked a card, choose the same number of your rear-guards as the number of cards unlocked by this ability, [Stand] them, and until the end of turn, all of your front row units get [Power] +10000, and this unit gets [Critical] +1.", officialReference: officialReferences["cfa-10828"], matchesCatalogText: true }
]);

const blockerById = Object.freeze({
  "cfa-10767:0": "The placement trigger has a grade-derived amount and requires choosing a Vanguard before applying power. No trusted handler resolves this exact source event, target choice, and calculated turn modifier.",
  "cfa-10768:0": "This listens for another unit stood by this card's ability, then pays by moving this source to Soul and chooses one of the units stood by that event. The engine lacks trusted stand-event provenance plus this ordered cost and target resolution.",
  "cfa-10770:0": "The placement AUTO requires a Blue Deathster Vanguard and Counter-Blast 1 before drawing. This exact named-Vanguard condition and cost are not in an authoritative definition for the card.",
  "cfa-10770:1": "This requires the exact source to boost after a Strategy entered Order Zone this turn, grants battle power, and conditionally Counter-Charges only from the back-row center. No trusted resolver binds all three conditions to that boost event.",
  "cfa-10771:0": "The continuous power depends on both the current Avantgarda Vanguard and a Strategy moved from Order Zone to Soul this turn. The exact move history and two-condition continuous modifier are not implemented for this card.",
  "cfa-10772:0": "The parser recognizes this cannot-be-ridden wording, but the resulting keyword definition is not in the server's reviewed-definition registry. Server ride validation therefore receives only the card ID and currently accepts this card; register and test the restriction authoritatively before marking it supported.",
  "cfa-10772:1": "On this exact RC placement, the effect checks whether an opponent rear-guard was retired earlier this turn and retires its own source only if none was. The turn-history condition and conditional retirement lack a trusted definition.",
  "cfa-10773:0": "The exact unit must boost from a circle with a Dragontree marker; resolution then Soul Charges and gives that booster battle power. There is no trusted source-bound boost/marker handler for this card.",
  "cfa-10776:1": "The AUTO reacts to another unit being unlocked and optionally moves this source from RC to Soul. Unlock identity, exact other-unit filtering, and the optional decision are not modeled in a trusted effect program.",
  "cfa-10777:1": "This attack-end ability requires the Alter Ego Messiah crest, retires this exact source, privately inspects three cards, calls a qualifying unit locked, and orders the rest on deck bottom. The nested choices and locked call are unsupported.",
  "cfa-10779:0": "At the close of this exact boost battle it checks GB1 and a Messiah Vanguard, locks this source, grants a chosen Vanguard power, then conditionally Counter-Charges if all damage is face down. No trusted delayed cost and modifier sequence exists.",
  "cfa-1080:0": "The source must be the actual booster of a Narukami Vanguard and the opponent must have three or more damage before the boosted unit gets battle power. No exact trusted boost handler and opponent-damage condition are registered.",
  "cfa-10817:0": "This continuous modifier requires this exact Rear-Guard on a marked circle during its controller's turn. The current continuous set does not include this exact Dragontree-marker power definition.",
  "cfa-10819:0": "This CONT changes the normal ride-deck discard cost only when the opponent has at most one rear-guard and the specific named Dipaanel is ridden. The server ride-cost path does not implement that source-specific waiver.",
  "cfa-10819:1": "This may call the newly ridden source only when the opponent has at least two rear-guards. The rode-upon event must retain the exact source identity and current opposing rear-guard count; no matching trusted definition exists.",
  "cfa-10820:0": "The ride AUTO must match being ridden by Gandeeva and then reduce the chosen Vanguard's original ACT cost by Counter-Blast 1 for the rest of the turn. Temporary ability-cost replacement is not implemented.",
  "cfa-10821:0": "This is an optional AUTO on the exact Vanguard when an opponent rear-guard is retired during its controller's turn; it selects a Drop card and binds it face down. The trigger and choice sequence has no trusted definition for Gandeeva.",
  "cfa-10821:1": "This continuously scales all front-row power from face-down Bind cards and adds critical at five, with the source restriction on Vanguard Circle. The printed continuous effect is not registered for this card.",
  "cfa-10821:2": "The ACT requires five opposing rear-guards of distinct grades, top-five reveal, grade matching retirements, shuffle, then a conditional draw and Drop-to-Bind choice. This multi-target ordered effect and 1/turn record are unsupported.",
  "cfa-10822:0": "On placement with Gandeeva, it pays Soul Blast and binds another friendly Rear-Guard, retires an opponent Rear-Guard, then branches to draw and Drop-to-Bind only if retirement failed. The atomic cross-player targeting and conditional branch are not trusted.",
  "cfa-10823:0": "The triggering Vanguard must be Gandeeva attacking a grade-3-or-higher Vanguard; this source then pays Counter-Blast and binds itself before a filtered top-five call and shuffle. No trusted exact-event search/cost program covers it.",
  "cfa-10824:0": "The parser recognizes this cannot-be-ridden wording, but the resulting keyword definition is not in the server's reviewed-definition registry. Server ride validation therefore receives only the card ID and currently accepts this card; register and test the restriction authoritatively before marking it supported.",
  "cfa-10824:1": "The source retires itself only when it is placed on RC from hand. The reducer has no trusted card-specific hand-origin placement AUTO for this effect.",
  "cfa-10825:1": "This changes normal-order play into optional Alchemagic by binding a Normal Order from Drop. The engine does not implement this replacement window, type-filtered selection, and order-play continuation for this Vanguard.",
  "cfa-10825:2": "This grants +10000 to all of the controller's front row only after Alchemagic this turn. The ability has no trusted turn-history condition and board-wide continuous modifier.",
  "cfa-10825:3": "The ACT removes a differently named Zorga card from one of three zones and then chooses a Drop card with unit-versus-Normal-Order destination branching. The filtered multi-zone cost, target validation, and sequential resolution are unsupported.",
  "cfa-10826:0": "This CONT checks for a grade-3-or-higher Set Order in the controller's Order Zone while on RC during their turn. The engine does not yet evaluate this exact order-zone-grade power condition.",
  "cfa-10828:0": "The attack pays Counter-Blast, unlocks any chosen locked cards from both players, then stands an equal number of friendly Rear-Guards and grants turn-long front-row power plus Vanguard critical. Cross-player target choices and dependent counts are not implemented atomically.",
  "cfa-108:0": "At the close of a Vanguard attack that missed, this source may retire itself and stand a grade-2-or-less Nova Grappler Vanguard. The battle-close miss event, optional cost, clan/grade filter, and stand effect are not supported as one trusted ability."
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
  if (!ability || !blockerById[abilityId]) {
    throw new Error("Expected exact unsupported ability and concrete blocker: " + abilityId);
  }
  const official = officialById.get(abilityId);
  return Object.freeze({
    abilityId, cardName: card.name, kind: ability.kind,
    catalogPrintedText: ability.printedText,
    parserDefinitionPresent: Boolean(ability.definition),
    trustedServerDefinition: Reducer.hasTrustedServerAbilityDefinition(ability, Engine),
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || officialReferences[cardId] || null,
    officialTextMatchesCatalog: official?.matchesCatalogText ?? null,
    blocker: blockerById[abilityId]
  });
}));

const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error("Expected existing reviewed definition missing: " + abilityId);
  const supportMode = supportModes[abilityId];
  const serverHandlerSupported = Reducer.supportsServerAbilityEffects(ability);
  if (supportMode === "authoritative-auto-resolution" && !serverHandlerSupported) {
    throw new Error("Expected authoritative server AUTO handler missing: " + abilityId);
  }
  if (supportMode !== "authoritative-auto-resolution" && serverHandlerSupported) {
    throw new Error("Special continuous/ride rule was incorrectly counted as an AUTO/ACT effect: " + abilityId);
  }
  const official = officialById.get(abilityId);
  return Object.freeze({
    abilityId, cardName: card.name, kind: ability.kind, printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    supportMode, serverHandlerSupported,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || officialReferences[cardId] || null,
    officialTextMatchesCatalog: official?.matchesCatalogText ?? null
  });
}));

module.exports = Object.freeze({
  batchId, workerOwner, abilityIds, alreadySupportedAbilityIds, supportModes,
  supportedDefinitions, proposedDefinitions: Object.freeze([]), unsupportedSiblings,
  blockerById, officialReferences, officialTextReviews,
  officialTextReviewedAbilityIds: Object.freeze(officialTextReviews.map(item => item.abilityId))
});
