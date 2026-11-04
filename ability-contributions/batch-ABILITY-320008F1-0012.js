"use strict";

// Audit only: these records document why the remaining skills are still
// unavailable. No new production definitions are proposed in this batch.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10313:0", "cfa-10314:0", "cfa-10315:0", "cfa-10317:0", "cfa-10318:0",
  "cfa-10319:0", "cfa-10320:0", "cfa-10321:0", "cfa-10322:0", "cfa-10323:0",
  "cfa-10324:0", "cfa-10325:0", "cfa-10326:0", "cfa-10327:0", "cfa-10328:0",
  "cfa-10329:0", "cfa-1032:0", "cfa-10330:0", "cfa-10331:0", "cfa-10332:0",
  "cfa-10332:1", "cfa-10333:0", "cfa-10333:1", "cfa-10334:0", "cfa-10335:0",
  "cfa-10336:0", "cfa-1033:0", "cfa-1033:1"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-10335:0"]);
const blockerById = Object.freeze({
  "cfa-10313:0": "This RC CONT grants shield while the controller has a Set Order in the Order Zone. The continuous shield evaluator does not check this live Order Zone predicate.",
  "cfa-10314:0": "This AUTO requires the exact source Vanguard attack, a two-Cursed-Play Soul threshold, Soul Blast 1, battle power, then moving the source to Soul at that battle's end. The ordered battle-close effect and typed Soul predicate are not a trusted program.",
  "cfa-10315:0": "This own-turn RC CONT checks that the controller's front row has no other Rear-Guards before granting +5000. The continuous evaluator has no exact empty-front-row predicate.",
  "cfa-10317:0": "This once-per-turn ACT needs two Cursed Play cards in Soul, Soul Blast 1, and +10000 through turn end. The Soul trait-count condition is not represented in the reviewed activation evaluator.",
  "cfa-10318:0": "This once-per-turn ACT checks whether a Magazine Order was played this turn, pays Counter Blast 1, then grants +10000 through turn end. The required type-specific played-Order history and turn usage are not validated together.",
  "cfa-10319:0": "This CONT conditionally grants a new Intercept AUTO while the source is a Friend. Friend state and granted ability behavior must be represented and expire with the continuous condition; neither is modeled here.",
  "cfa-10320:0": "This GC CONT grants +5000 shield only during a battle against a Mediell Vanguard. The continuous shield evaluator does not bind the current battle's exact opponent Vanguard name.",
  "cfa-10321:0": "This placement AUTO grants +5000 only while the controller has a Haseritt Vanguard. Placement-source identity and the exact Vanguard-name predicate are not covered by a reviewed server definition for this record.",
  "cfa-10322:0": "This AUTO requires the exact from-hand RC placement, Soul Blast 1, a top-five search filtered to Lyrical ShootingStarS, reveal and add, then shuffle. No trusted handler validates this complete source and search sequence.",
  "cfa-10323:0": "This boost AUTO checks that the controller has at least two Cursed Play cards in Soul before granting this source +5000 for the exact boost battle. The typed Soul-count condition is unsupported.",
  "cfa-10324:0": "This boost AUTO checks whether any Rear-Guard was moved to the bottom of the deck this turn before applying battle power. The required turn-scoped movement history is not tracked by a trusted condition.",
  "cfa-10325:0": "This RC CONT combines own-turn +5000 power with an attack and boost restriction whenever the controller has Soul. The continuous action-restriction handler does not model this Soul-dependent prohibition.",
  "cfa-10326:0": "This Guardian AUTO checks for two or more grade 2+ Rear-Guards in the back row, then grants +5000 shield for that battle. The exact back-row grade-count condition is not available to the Guardian resolver.",
  "cfa-10327:0": "This attack AUTO requires the exact source Rear-Guard attack and at least two grade 2+ Rear-Guards in the back row before granting battle power. The count condition is unsupported.",
  "cfa-10328:0": "This ACT pays two ordered costs (this source to Soul and a Blitz Order from hand to Soul), then chooses a friendly Vanguard for +5000 until turn end. The typed hand cost and atomic multi-zone payment are not implemented as a trusted sequence.",
  "cfa-10329:0": "This ACT checks for a Mediell Vanguard, moves this source to Soul, privately chooses whether the revealed top card stays on top or goes to bottom, and grants power only on the bottom choice. That branch and its conditional target effect are unsupported.",
  "cfa-1032:0": "This placement AUTO chooses a CONT ability owned by one of the controller's Narukami units and suppresses it until turn end. The engine cannot choose and temporarily disable a particular ability on another card instance.",
  "cfa-10330:0": "This Guardian AUTO requires two or more grade 1-or-less Rear-Guards in the back row before Soul Charging. The exact zone-and-grade count condition is not modeled for Guardian timing.",
  "cfa-10331:0": "This once-per-turn AUTO triggers at the end of the exact battle this source boosted, pays Soul Blast 2, and stands the source. The parser does not recognize this boosted-battle close trigger as a trusted event program.",
  "cfa-10332:0": "This AUTO grants +5000 when the exact source enters RC due to a card ability. The placement event does not preserve trusted effect-cause provenance for this restriction.",
  "cfa-10332:1": "This once-per-turn AUTO needs an opposing Rear-Guard in this source's column retired by the controller's card ability, then Counter Blast 1 and draw. Retirement cause, column identity, opponent card control, and usage lock are not validated together.",
  "cfa-10333:0": "This own-turn CONT grants power when the source Vanguard Circle has at least two Arms. The continuous evaluator does not model Arm cards attached to a Vanguard Circle.",
  "cfa-10333:1": "This ACT retires the source, selects and Arms a card from hand or Drop to a Vanguard, then restricts further Arm actions until turn end. The Arm zone operation and resulting action restriction are not implemented.",
  "cfa-10334:0": "This once-per-turn ACT checks for a Eugene Vanguard, pays Soul Blast 1, selects a grade 2-or-less non-Sentinel Normal Unit in Drop, and chooses top or bottom of deck. The filtered selection and destination choice are unsupported.",
  "cfa-10336:0": "This CONT grants +10000 even on the opponent's turn if another friendly Rear-Guard was retired by the controller's card ability this turn. The live turn history lacks exact retired-card controller and cause attribution.",
  "cfa-1033:0": "This RC CONT prohibits the source from boosting grade 2 or lower units. The attack legality evaluator does not check this source-specific grade restriction before allowing a boost.",
  "cfa-1033:1": "This AUTO requires the exact source to boost a Narukami unit and grants that exact boosted target +3000 for battle. The source's clan-filtered boost target identity is not a trusted effect program."
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
const supportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed ability or concrete blocker: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, officialReference: null, blocker: blockerById[abilityId] });
}));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing definition missing: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText, definitionSource: ability.definition.source?.patternId || "compiled production definition" });
}));

const auditOnly = [];
Object.defineProperty(auditOnly, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0012",
    status: "one-existing-definition-27-blocked",
    dataset: "Cardfight Area local card catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: false,
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    cards,
    unsupportedSiblings,
    provenanceNote: "Every assigned card and printed ability remains represented. Only the existing Dual Electrose Dragon CONT was recognized as compiled production support; the other 27 have explicit blockers and remain unavailable. No new definitions or whole-card verification claims are made."
  })
});
Object.defineProperty(auditOnly, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = auditOnly;
