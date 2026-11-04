"use strict";

// Audit contribution only. No new production or candidate definitions are
// proposed: only cfa-1027:1 has a trusted, server-supported definition in this
// assigned batch. All catalog wording is copied through from the source data.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10263:0", "cfa-10263:1", "cfa-10264:0", "cfa-10265:0", "cfa-10266:0",
  "cfa-10267:0", "cfa-10268:0", "cfa-10269:0", "cfa-10270:0", "cfa-10271:0",
  "cfa-10273:0", "cfa-10274:0", "cfa-10275:0", "cfa-10276:0", "cfa-10276:1",
  "cfa-10277:0", "cfa-10277:1", "cfa-10278:0", "cfa-10279:0", "cfa-10279:1",
  "cfa-1027:0", "cfa-1027:1", "cfa-10280:0", "cfa-10281:0", "cfa-10282:0",
  "cfa-10284:0", "cfa-10285:0", "cfa-10286:0", "cfa-10287:0", "cfa-1028:0"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-1027:1"]);
const officialTextChecks = Object.freeze({
  "cfa-1027:1": {
    officialCardName: "Battler of the Twin Brush, Polaris",
    officialCardNumber: "BT09/013EN",
    officialPrintedText: "[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F013EN",
    note: "The local catalog calls the card 'Battle of the Twin Brush, Polaris'; Bushiroad's official English listing says 'Battler'. The assigned ability wording and +3000 battle effect match."
  },
  "cfa-10269:0": {
    officialCardName: "Knight of Gale, Cyneblugar",
    officialCardNumber: "D-BT07/081EN",
    officialPrintedText: "[CONT]RC:During your turn, if your opponent's vanguard is grade 3 or greater, this unit gets [Power] +5000.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT07%2F081EN",
    note: "The engine can parse this generic CONT pattern, but this card ID has no reviewed definition registered for the authoritative server path; it is therefore blocked from production support."
  }
});

const blockerById = Object.freeze({
  "cfa-10263:0": "This ACT temporarily grants Boost to all of the controller's Grade 2+ Rear-Guards after Soul-Blast 1. No trusted handler grants an expiring keyword to every qualifying unit while preserving the exact Vanguard source and once-per-turn use.",
  "cfa-10263:1": "At the end of this exact Vanguard's attack, this AUTO checks three Grade 2+ back-row units, pays Counter-Blast 1, returns one front-row and one back-row Rear-Guard, then conditionally calls a Grade 3 from hand. The exact battle/source, grade-count, ordered return, and conditional call sequence are not server-supported.",
  "cfa-10264:0": "This AUTO requires a different Rear-Guard to be returned by a Grade 3+ Vanguard ability, then Counter-Blast 1 and move this source to Soul before drawing and optionally calling a Grade 3. The causal return event and ordered cost/draw/call sequence are unsupported.",
  "cfa-10265:0": "The placement trigger must be this card entering RC from hand, with a Grade 3+ Lilfa Vanguard; it grants power and only during the Main Phase adds Soul-Blast 2 followed by a draw. Origin-aware placement and the phase-gated optional cost/effect branch are not supported together.",
  "cfa-10266:0": "This Vanguard battle-close AUTO pays Counter-Blast 1, privately reveals seven cards, checks distinct names excluding Petralka, then either calls a selected card or rides Petralka as stand with Drive -1; it always shuffles. The private reveal, name-count exception, branch, ride, and ordered resolution lack a trusted server program.",
  "cfa-10267:0": "After this exact unit is placed on RC, the ability pays Counter-Blast 1, selects a card in Drop and moves it to Soul, then checks for four distinct Soul grades before granting turn power. The movement event, private target choice, distinct-grade check, and conditional modifier are not implemented as one trusted sequence.",
  "cfa-10268:0": "This trigger requires this exact source to be retired from RC by any player's card ability and the source controller's hand to contain three or fewer cards at the legal check time. The retirement cause and exact source identity are not retained by a trusted draw trigger.",
  "cfa-10269:0": "The text matches an existing generic CONT parser pattern and an engine-level condition test, but cfa-10269:0 is absent from Engine.getReviewedAbilityDefinitionsForCard and has no trusted authoritative-server definition. Generic parsing alone does not make the +5000 modifier live in online matches.",
  "cfa-10270:0": "This CONT combines a controller-turn +10000 RC power bonus with a restriction against attacking a Vanguard. Neither this exact source's conditional power nor the attack-target restriction is registered on the authoritative server.",
  "cfa-10271:0": "After this exact source is placed on RC, a Grade 3+ Lilfa Vanguard is required; the controller may put a Grade 2-or-lower Lilfa Normal Unit from Drop into Soul, and only if it does this source gains turn power. Named-card filtering and the optional move-dependent branch are unsupported.",
  "cfa-10273:0": "This AUTO requires the source to be ridden by a Grade 2 Mediell, chooses a Grade 2-or-lower Drop card to call, then reveals the deck top and rests that called card only if the reveal is a Trigger Unit. Ride identity, private reveal, and conditional target state are unsupported.",
  "cfa-10274:0": "This ride trigger requires a Grade 3 Mediell to ride this source, privately inspects the top three cards, keeps one on top, and discards the other two. Rider identity and the ordered private selection/discard sequence have no trusted server handler.",
  "cfa-10275:0": "This once-per-turn ACT pays Counter-Blast 2 and branches on a private top-card type: Normal Unit adds it to hand, calls from Drop and grants critical; Trigger Unit counter-charges, calls from Drop, and restores the revealed card to its original deck position. The private type branch and distinct card/deck operations are unsupported.",
  "cfa-10276:0": "This ACT Soul-Blasts 2, targets a Grade 3+ Mediell Vanguard, grants turn power, and changes the cost of that Vanguard's original ACT to Counter-Blast 1 until end of turn. Temporarily rewriting another ability's cost is not represented in the authoritative rules state.",
  "cfa-10276:1": "This AUTO triggers only when another unit is placed on RC from Drop and grants this exact source turn power. The zone-origin and other-instance relation are necessary; generic RC placement does not prove both.",
  "cfa-10277:0": "This CONT grants +5000 only during the battle this source attacked a Grade 3+ Vanguard from RC. The continuous evaluator has no source-battle and opposing-Vanguard-grade scoped power definition for this card.",
  "cfa-10277:1": "This AUTO requires placement from Drop by a Grade 3+ Mediell Vanguard ability, then dynamically grants this source a new end-of-Vanguard-attack AUTO which pays Soul-Blast 1 and stands this source. Effect-caused placement and temporary granted ability identity/expiry are unsupported.",
  "cfa-10278:0": "This ACT requires the opponent's Vanguard grade, Counter-Blast 1, moving the named Product from Order Zone to Drop, retiring this source, and moving a named hand card into Order Zone. Product operation/zone state and the multi-part cost/target transaction are not supported.",
  "cfa-10279:0": "This placement AUTO checks that no Product was operated this turn, pays Counter-Blast 1 and Soul-Blast 1, chooses a Product in Order Zone and starts its nested Operate ability. Product-operation events and nested resolution are not a trusted server action.",
  "cfa-10279:1": "This CONT gives the source +5000 on RC during its controller's turn if a Product was operated that turn. No authoritative reviewed definition currently tracks the Product-operated-this-turn condition for this card.",
  "cfa-1027:0": "This Limit Break 4 AUTO is the Vanguard's own attack against a Vanguard, optionally pays Counter-Blast 2, stands another Great Nature Rear-Guard, gives it turn power, and schedules that same target's End Phase retirement. The legacy limit-break gate and linked delayed target effect are not trusted together.",
  "cfa-10280:0": "After this exact unit is placed on RC, the ability checks for a Rear-Guard with at least two originalDress, pays Soul-Blast 1, and retires an opponent Rear-Guard. OriginalDress count and opponent-target selection are unsupported.",
  "cfa-10281:0": "After RC placement with a Mediell Vanguard, the controller privately looks at the top card and chooses top-of-deck or Soul; only the Soul branch causes a second look. Hidden information, branch choice, and deck-position preservation are not covered.",
  "cfa-10282:0": "This AUTO is usable from Drop and requires a different Rear-Guard placed by a Grade 3+ Mediell Vanguard ability; it then pays Counter-Blast 1 and calls this exact card to an open RC. Drop-zone source eligibility and causal placement attribution are unsupported.",
  "cfa-10284:0": "This ability triggers on a ride from a Grade 0 Michu, searches the deck for the named Set Order, puts it into Order Zone, and shuffles. Exact ride predecessor identity, named search, zone placement, and shuffle have no reviewed server definition.",
  "cfa-10285:0": "This ability triggers on a ride from a Grade 1 Michu, privately checks the top five, searches for Noqno or Cannonball, reveals and adds the selected card to hand, then shuffles. Ride identity and filtered private search are unsupported.",
  "cfa-10286:0": "This record contains a once-per-turn ACT gated by All Set Up! plus a separate Cannonball AUTO on Vanguard attack, with different costs and effects. Both abilities are unreviewed: the ACT needs draw then call-or-discard choice, while Cannonball needs Soul-Blast 2, opponent retirement, and battle power.",
  "cfa-10287:0": "This Order Zone ACT requires a Michu Vanguard, rests this Order, Soul-Charges 1, then optionally moves a Cannonball from hand to Order Zone. Order-specific activation/rest state and the combined cost/optional placement are unsupported.",
  "cfa-1028:0": "During the controller's End Phase, this trigger requires this exact source to have moved from RC to Drop, a Great Nature Vanguard, and optional Counter-Blast 1; it searches and reveals Melodica Cat, calls to an open RC, and shuffles. Retirement timing/cause, named search, and ordered resolution are unsupported."
});

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = catalogById.get(cardId);
  if (!card) throw new Error(`Assigned card missing from catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name, catalogText: card.text });
}));
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedAbilityIds.includes(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = catalogById.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed ability or blocker: ${abilityId}`);
  const official = officialTextChecks[abilityId] || null;
  return Object.freeze({
    abilityId,
    cardId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    parsedCandidatePatternId: ability.definition?.source?.patternId || null,
    officialCardName: official?.officialCardName || null,
    officialCardNumber: official?.officialCardNumber || null,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null,
    blocker: blockerById[abilityId]
  });
}));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  const official = officialTextChecks[abilityId] || null;
  if (!ability?.definition || !Engine.getReviewedAbilityDefinitionsForCard(cardId).some(item => item.id === abilityId)) {
    throw new Error(`Expected trusted production definition missing: ${abilityId}`);
  }
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "reviewed production definition",
    officialCardName: official?.officialCardName || null,
    officialCardNumber: official?.officialCardNumber || null,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null,
    officialNote: official?.note || null });
}));

module.exports = Object.assign([], {
  audit: Object.freeze({
    batchId: "ABILITY-320008F1-0010",
    status: "one-existing-production-definition-29-blocked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: true,
    officiallyCheckedAbilityIds: Object.freeze(Object.keys(officialTextChecks)),
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    cards,
    unsupportedSiblings,
    provenanceNote: "Exact catalog text is preserved for every assigned ability. The official Bushiroad card lists were checked for the existing Polaris AUTO and the Cyneblugar CONT candidate. Polaris has a trusted server-supported production definition. Cyneblugar's generic engine candidate is not registered as a reviewed definition for the authoritative server, so it is explicitly blocked. No new definitions are proposed and no whole card is marked complete."
  }),
  unsupportedSiblings
});
