"use strict";

// Audit-only batch contribution. It intentionally adds no runtime definitions.
const contribution = [];

const abilityIds = Object.freeze([
  "cfa-11029:0", "cfa-11030:0", "cfa-11031:0", "cfa-11031:1", "cfa-11032:0",
  "cfa-11033:0", "cfa-11033:1", "cfa-11034:0", "cfa-11034:1", "cfa-11035:0",
  "cfa-11036:0", "cfa-11038:0", "cfa-11038:1", "cfa-11039:0", "cfa-11039:1",
  "cfa-11040:0", "cfa-11040:1", "cfa-11042:0", "cfa-11042:1", "cfa-11043:0",
  "cfa-11043:1", "cfa-11044:0", "cfa-11045:0", "cfa-11046:0", "cfa-11046:1",
  "cfa-11047:0", "cfa-11048:0", "cfa-1104:0", "cfa-11050:0", "cfa-11050:1",
  "cfa-11051:0", "cfa-11051:1", "cfa-11052:0", "cfa-11052:1", "cfa-11054:0",
  "cfa-11054:1", "cfa-11055:0", "cfa-11055:1", "cfa-1105:0"
]);

const existingProductionSupportIds = Object.freeze([
  "cfa-1104:0", "cfa-11050:1", "cfa-11051:1", "cfa-11052:0", "cfa-11052:1"
]);

const brandtGateList = "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&s_param=d-Brandt+Gate&sort=no&view=text";
const dragonEmpireList = "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&s_param=d-Dragon+Empire&sort=no&view=image&view=text";
const darkStatesList = "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&s_param=d-Dark+States&sort=no&view=text";
const keterList = "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&s_param=d-Keter+Sanctuary&sort=no&view=text";
const td08List = "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=26&sort=no&view=text";
const rupertList = "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=0&s_param=Spike+Brothers&view=text";
const productPage = "https://en.cf-vanguard.com/products/dbt11/";

const officialTextCheckById = Object.create(null);
function recordOfficialText(ids, reference, status = "matched") {
  for (const abilityId of ids) officialTextCheckById[abilityId] = Object.freeze({ status, reference });
}

recordOfficialText([
  "cfa-11029:0", "cfa-11030:0", "cfa-11031:0", "cfa-11031:1", "cfa-11032:0",
  "cfa-11033:0", "cfa-11033:1", "cfa-11034:0", "cfa-11034:1", "cfa-11035:0", "cfa-11036:0"
], brandtGateList);
recordOfficialText([
  "cfa-11038:0", "cfa-11038:1", "cfa-11039:0", "cfa-11039:1", "cfa-11040:0",
  "cfa-11040:1", "cfa-11042:0", "cfa-11042:1", "cfa-11043:0", "cfa-11043:1"
], dragonEmpireList);
recordOfficialText(["cfa-11044:0", "cfa-11045:0"], keterList);
recordOfficialText([
  "cfa-11046:0", "cfa-11046:1", "cfa-11047:0", "cfa-11052:0", "cfa-11052:1",
  "cfa-11054:0", "cfa-11054:1", "cfa-11055:0", "cfa-11055:1"
], darkStatesList);
recordOfficialText(["cfa-1104:0", "cfa-1105:0"], td08List);
recordOfficialText(["cfa-11050:0", "cfa-11050:1"], rupertList);

const caezarErrata = "https://en.cf-vanguard.com/errata/caezar-silhouette/";
const savarinErrata = "https://cf-vanguard.com/errata/d-bt11_087/";
recordOfficialText(["cfa-11032:0"], caezarErrata, "catalog-text-corrected-by-official-errata");
recordOfficialText(["cfa-11045:0"], savarinErrata, "catalog-text-corrected-by-official-errata");

// The official D-BT11 product record confirms the set, but did not expose Spring
// Breeze Dragon's ability text in the official card search results used here.
officialTextCheckById["cfa-11048:0"] = Object.freeze({ status: "official-card-text-not-verified", reference: productPage });
for (const id of ["cfa-11051:0", "cfa-11051:1"]) {
  officialTextCheckById[id] = Object.freeze({ status: "official-card-text-not-found", reference: null });
}

const officialCardNumbers = Object.freeze({
  "cfa-11029": "D-BT11/076EN", "cfa-11030": "D-BT11/075EN", "cfa-11031": "D-BT11/047EN",
  "cfa-11032": "D-BT11/077EN", "cfa-11033": "D-BT11/007EN", "cfa-11034": "D-BT11/027EN",
  "cfa-11035": "D-BT11/073EN", "cfa-11036": "D-BT11/080EN", "cfa-11038": "D-BT11/063EN",
  "cfa-11039": "D-BT11/058EN", "cfa-11040": "D-BT11/002EN", "cfa-11042": "D-BT11/062EN",
  "cfa-11043": "D-BT11/016EN", "cfa-11044": "D-BT11/085EN", "cfa-11045": "D-BT11/087EN",
  "cfa-11046": "D-BT11/022EN", "cfa-11047": "D-BT11/067EN", "cfa-11048": "D-BT11/053EN",
  "cfa-11050": "V-PR/0276EN", "cfa-11052": "D-BT11/023EN", "cfa-11054": "D-BT11/006EN",
  "cfa-11055": "D-BT11/021EN", "cfa-1104": "TD08/007EN", "cfa-1105": "TD08/008EN"
});

const officialCorrections = Object.freeze({
  "cfa-11032:0": Object.freeze({
    reference: caezarErrata,
    catalogTextIssue: "The local catalog's exact rider name is stale.",
    currentRule: "Trigger when ridden upon by a grade 3 card with \"Silhouette\" in its card name; it is not restricted to Gigant Arms, Silhouette."
  }),
  "cfa-11045:0": Object.freeze({
    reference: savarinErrata,
    catalogTextIssue: "The local catalog omits the current non-sentinel restriction.",
    currentRule: "The Normal Unit target in Drop must be non-sentinel and have only Genesis for its clan."
  })
});

const blockers = Object.freeze({
  "cfa-11029:0": "The source must be this exact unit's attack against a grade 3+ Vanguard; the controller's Vanguard must contain Silhouette; then Counter-Blast 1 and draw. Although attack events, Counter-Blast, and draw exist separately, no trusted server definition validates this complete trigger/condition/cost sequence.",
  "cfa-11030:0": "The source's own Vanguard attack requires a grade 3+ Silhouette Vanguard, Counter-Blast 1, a legal opposing grade 2+ Rear-Guard target, retirement, and battle-only +5000. This exact filtered target and ordered cost/effect path is not trusted by the authoritative reducer.",
  "cfa-11031:0": "The Order Zone ACT must rest this exact Set Order, inspect only the top seven, reveal an Armed Arms card, compare its exact name against Drop, conditionally put it in hand or discard it, move this order to Soul only on the hand branch, then shuffle. No trusted effect program preserves these conditional branches and exact source identity.",
  "cfa-11031:1": "This Order Zone ACT requires a grade 3+ Silhouette Vanguard, moves the exact order to Soul as cost, then calls up to two different-name Armed Arms from Drop to open Rear-Guard Circles. The distinct-name target constraint and order-source cost are not supported together by a trusted handler.",
  "cfa-11032:0": "This must match the actual ridden-upon card instance and the corrected grade-3 Silhouette rider condition, then choose up to two different-name Armed Arms in Drop and call to open RC. Ride provenance, errata-corrected rider filtering, and distinct-name Drop choices are not one trusted resolver.",
  "cfa-11033:0": "At the start of the attack step, this exact Vanguard pays Soul-Blast 1 and attaches up to two different-name Armed Arms from RC as stand. Attachment changes location, prevents those units attacking, continuously grants their power/abilities, and returns them rested at turn end; attached-card state and legality are not modeled by a trusted effect handler.",
  "cfa-11033:1": "At the end of this exact Vanguard's attack battle, the controller chooses up to one attached unit and moves it to an open RC as stand. The engine has no authoritative attachment zone or attachment-specific end-of-battle choice.",
  "cfa-11034:0": "This CONT depends on whether any Vanguard was attached during the turn and grants +10000 on RC. The engine has no reliable per-turn attachment history; using ordinary placement or ride events as a substitute would change the condition.",
  "cfa-11034:1": "At the end of battle, the exact Silhouette Vanguard must have attacked a grade 3+ Vanguard while the controller's front row has no Rear-Guards; then Soul-Blast 1 and stand this back-row source. The linked battle, live front-row predicate, and back-row source timing lack a trusted handler.",
  "cfa-11035:0": "The ability requires the exact source to have boosted in the battle that hit a Vanguard, then retires itself, selects a grade-2 Blitz Order without Regalis Piece from Drop, adds it to hand, and discards a hand card. The exact battle link and filtered Drop-to-hand sequence are unsupported together.",
  "cfa-11036:0": "The source must have boosted the battle that hit a Vanguard; after retiring it, search the deck for a grade-2+ Blitz Order without Regalis Piece, reveal/add it, shuffle, and discard only if a card was found. No trusted handler represents the exact attack provenance, filter, and conditional follow-up.",
  "cfa-11038:0": "This ride AUTO needs the actual rider to be grade 2 with only Narukami as clan, then searches for the exact Eternal Thunderbolt and shuffles. The parsed ride trigger does not encode that rider filter, and no trusted definition binds the card-name search to this ridden-upon instance.",
  "cfa-11038:1": "The exact source must boost, check its controller's grade-3+ Narukami-only Vanguard, Counter-Blast 1, bind an opponent back-row Rear-Guard, and offer Soul-Charge 2 only if none was bound. Booster identity, back-row target legality, and the conditional optional branch are not trusted together.",
  "cfa-11039:0": "This ride AUTO requires a grade-3 Narukami-only rider, looks at exactly seven cards, then permits one card matching either the clan-only filter or the named Order, followed by reveal/add/shuffle. The union filter and rider validation do not have a trusted search resolver.",
  "cfa-11039:1": "Only the exact source's Rear-Guard placement with a Narukami-only Vanguard triggers Soul-Charge 1 and +5000 through turn end. The catalog parser recognizes placement broadly, but no trusted definition revalidates the source circle and clan condition before both effects.",
  "cfa-11040:0": "This once-per-turn Vanguard ACT pays Counter-Blast 1, powers two Narukami-only units, then changes this source's attack to battle two chosen opposing circles and the Vanguard. The game does not implement multi-circle simultaneous battle targeting and associated attack resolution.",
  "cfa-11040:1": "At the end of this exact Vanguard's attack battle, check Normal Order history and opponent damage <=4, discard a hand card, choose an opposing Vanguard, and deal damage. The authoritative damage-effect pipeline does not support this card-driven damage sequence.",
  "cfa-11042:0": "This source triggers while in Drop when any card is bound during its controller's turn by that player's card effect, with a Narukami-only Vanguard; Soul-Blast 1 and call this exact source. The broad effect-caused bind event, source-in-Drop identity, and optional target-free call are not a trusted complete ability.",
  "cfa-11042:1": "The ACT cost is retiring the exact RC source; its effect then chooses one of the controller's units and grants +5000 through turn end. No trusted definition for this source-to-Drop cost and validated friendly-unit target is registered.",
  "cfa-11043:0": "This CONT grants +5000 only on RC during its controller's turn while the opponent's front row contains no Rear-Guards. The continuous evaluator has no opponent-front-row-empty condition, so it cannot determine this effect from authoritative board state.",
  "cfa-11043:1": "The source's own attack on a Vanguard requires a grade-3+ Narukami-only Vanguard, Soul-Blast 2, and an opposing Rear-Guard choice to bind; draw only if no card was bound. The target-or-fallback branch is missing from a trusted server program.",
  "cfa-11044:0": "At the end of this source's Vanguard attack, retire it, inspect the top three, choose up to one Genesis-only card to reveal/add, bottom-deck the remaining cards in chosen order, and grant a Vanguard +5000 only if no card was revealed. The ordered top-card choice and conditional fallback lack a trusted resolver.",
  "cfa-11045:0": "The placement AUTO must allow only a non-sentinel Normal Unit with only Genesis in Drop to be put on top of deck. Official errata added the non-sentinel restriction; the catalog text is stale, and neither the corrected filter nor its optional deck movement is supported by a trusted definition.",
  "cfa-11046:0": "This Soul CONT changes this exact card's effective grade to 0 only while choosing Soul cards for its Vanguard's ability. The ability-resolution chooser does not expose a card-specific grade override for this context.",
  "cfa-11046:1": "Placement from Soul by the ACT ability of a Pale Moon-only Vanguard must be provenance-checked; pay by moving another Rear-Guard to Soul, call a chosen Soul unit, then return that exact called instance to Soul at turn end. Placement provenance and linked delayed movement are unsupported together.",
  "cfa-11047:0": "On placement from Soul, pay Counter-Blast 1 and discard from hand, grant +10000 this turn, and prevent sentinel calls from hand to GC for the battle this unit attacks. The engine lacks this source-specific, battle-scoped guardian restriction.",
  "cfa-11048:0": "The official card search did not expose this card's ability text, so its local catalog wording cannot yet be validated against the printed card. Even following that wording provisionally, the turn-history condition, Counter-Blast, grade-filtered Drop target, and call sequence have no matching trusted definition.",
  "cfa-11050:0": "The source's attack while boosted is once per turn and pays Counter-Blast 1 before searching for a grade-3 card and calling it. Search/call handlers exist in narrower patterns, but this exact once-per-turn own-attack sequence is not a trusted server definition.",
  "cfa-11051:0": "Official Bushiroad card text was not located, so the catalog text cannot be confirmed against the printed ability. The catalog version also requires this exact source's boosted attack, Soul-Blast 1, a top-card mill, and different follow-up choices for Normal versus Trigger Units; neither the text provenance nor the branch resolver is production-verified.",
  "cfa-11054:0": "The placement ability excludes placements by unit-card abilities, requires Normal Order history, Soul-Blast 1, inspects five cards, filters by Vanguard grade, then routes a chosen Unit to RC or Normal Order to hand. Cause provenance and split destinations are not a trusted sequence.",
  "cfa-11054:1": "The source's own attack on a grade-3+ unit pays Soul-Blast 3, draws one, and gives +5000 until end of turn. Its grade-qualified attack event and turn-long modifier are not registered as an exact trusted ability.",
  "cfa-11055:0": "On RC placement with a Kheios-named Vanguard, pay Counter-Blast 1, inspect the top two, optionally choose one for hand, and move the remainder to Soul. The conditional reveal/choice plus remainder routing has no matching trusted effect program.",
  "cfa-11055:1": "While in Soul, this source reacts to another exact Mikani-named unit being placed on RC with a Kheios Vanguard; discard a hand card, Soul-Charge 1, call this source, and grant Boost. The other-card identity, source Soul movement, and temporary keyword grant are unsupported together.",
  "cfa-1105:0": "This source's own attack needs three or more other Liberator-named Rear-Guards before granting +3000 for that battle. No trusted attack-time count of other named units is registered for this ability."
});

const { loadCatalog } = require("../scripts/audit-ability-catalog.js");
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))) )]
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Assigned card missing from local catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name, officialCardNumber: officialCardNumbers[cardId] || null });
}));

const parsedById = new Map();
for (const cardId of cardIds) {
  const card = cardsById.get(cardId);
  for (const ability of Engine.parseCardAbilitiesCached(card)) parsedById.set(ability.id, ability);
}

const supportedDefinitions = Object.freeze(existingProductionSupportIds.map(abilityId => {
  const ability = parsedById.get(abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing: ${abilityId}`);
  return Object.freeze({
    abilityId,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    patternId: ability.definition.source?.patternId || null,
    officialTextCheck: officialTextCheckById[abilityId],
    implementationStatus: "already-supported-in-production",
    note: ability.kind === "CONT"
      ? "Existing continuous evaluator definition; it is not a manually activatable skill."
      : "Existing registered effect definition; see existing family tests for authoritative behavior."
  });
}));

const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !existingProductionSupportIds.includes(id)).map(abilityId => {
  const ability = parsedById.get(abilityId);
  if (!ability || ability.definition || !blockers[abilityId]) throw new Error(`Missing exact unsupported classification: ${abilityId}`);
  return Object.freeze({
    abilityId,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialCardNumber: officialCardNumbers[ability.cardId] || null,
    officialTextCheck: officialTextCheckById[abilityId] || Object.freeze({ status: "official-card-text-not-found", reference: null }),
    ...(officialCorrections[abilityId] ? { officialCorrection: officialCorrections[abilityId] } : {}),
    blocker: blockers[abilityId]
  });
}));

const officialSourceCoverage = Object.freeze([
  Object.freeze({ reference: brandtGateList, description: "Official D-BT11 Brandt Gate card text", abilityIds: Object.freeze(["cfa-11029:0", "cfa-11030:0", "cfa-11031:0", "cfa-11031:1", "cfa-11032:0", "cfa-11033:0", "cfa-11033:1", "cfa-11034:0", "cfa-11034:1", "cfa-11035:0", "cfa-11036:0"]) }),
  Object.freeze({ reference: caezarErrata, description: "Official Caezar errata, effective 2026-03-16; replaces the old specific rider name with a grade-3 Silhouette name condition", abilityIds: Object.freeze(["cfa-11032:0"]) }),
  Object.freeze({ reference: dragonEmpireList, description: "Official D-BT11 Dragon Empire card text", abilityIds: Object.freeze(["cfa-11038:0", "cfa-11038:1", "cfa-11039:0", "cfa-11039:1", "cfa-11040:0", "cfa-11040:1", "cfa-11042:0", "cfa-11042:1", "cfa-11043:0", "cfa-11043:1"]) }),
  Object.freeze({ reference: keterList, description: "Official D-BT11 Keter Sanctuary card text", abilityIds: Object.freeze(["cfa-11044:0", "cfa-11045:0"]) }),
  Object.freeze({ reference: savarinErrata, description: "Official Japanese Savarin errata, effective 2026-05-02; adds the non-sentinel filter", abilityIds: Object.freeze(["cfa-11045:0"]) }),
  Object.freeze({ reference: darkStatesList, description: "Official D-BT11 Dark States card text", abilityIds: Object.freeze(["cfa-11046:0", "cfa-11046:1", "cfa-11047:0", "cfa-11052:0", "cfa-11052:1", "cfa-11054:0", "cfa-11054:1", "cfa-11055:0", "cfa-11055:1"]) }),
  Object.freeze({ reference: "https://en.cf-vanguard.com/errata/page/4/", description: "Official errata index includes D-BT11/080EN; the current official card listing supplies its corrected conditional discard text", abilityIds: Object.freeze(["cfa-11036:0"]) }),
  Object.freeze({ reference: td08List, description: "Official TD08 card list", abilityIds: Object.freeze(["cfa-1104:0", "cfa-1105:0"]) }),
  Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=TD08%2F008EN", description: "Official Zoigal Liberator individual card page", abilityIds: Object.freeze(["cfa-1105:0"]) }),
  Object.freeze({ reference: rupertList, description: "Official PR card list includes both Wild Shot Rupert abilities", abilityIds: Object.freeze(["cfa-11050:0", "cfa-11050:1"]) }),
  Object.freeze({ reference: productPage, description: "Official product/set record only; Spring Breeze Dragon's ability text was not retrieved", abilityIds: Object.freeze(["cfa-11048:0"]) })
]);

const audit = Object.freeze({
  batchId: "ABILITY-76D8A0B8-0008",
  status: "audit-only-no-new-definitions",
  dataset: "Cardfight Area local card catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  counts: Object.freeze({ assigned: abilityIds.length, existingProductionSupport: supportedDefinitions.length, testOnlyProposals: 0, concreteBlockers: unsupportedSiblings.length, officialTextConfirmedOrErrataCorrected: 36, officialTextNotVerified: 3 }),
  abilityIds,
  implementedAbilityIds: Object.freeze([]),
  existingProductionSupportIds,
  supportedDefinitions,
  officialSourceCoverage,
  cards,
  unsupportedSiblings,
  officialCorrections,
  proposedDefinitions: Object.freeze([]),
  wholeCardCompletionClaims: Object.freeze([]),
  provenanceNote: "Every assigned ability preserves the exact local catalog text. 36 entries were checked against current official text or official errata; 3 entries lack an official ability-text match (Spring Breeze Dragon: text lookup unresolved; Sleep Learn Jambuck: no official Bushiroad card/text result located). Five abilities have existing production definitions. The other 34 remain blocked by specific missing server-side mechanics. No whole card is called complete."
});

Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });
module.exports = contribution;
