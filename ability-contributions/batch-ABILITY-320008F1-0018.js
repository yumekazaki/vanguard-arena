"use strict";

// Audit-only contribution. Four of the 39 assigned abilities already have
// reviewed production definitions. The remaining 35 require game mechanics
// that are not currently represented by trusted handlers, so this batch makes
// no speculative definitions.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10460:0", "cfa-10460:1", "cfa-10461:0", "cfa-10462:0", "cfa-10463:0", "cfa-10464:0", "cfa-10465:0", "cfa-10465:1", "cfa-10466:0", "cfa-10466:1", "cfa-10467:0", "cfa-10468:0", "cfa-10469:0", "cfa-10469:1", "cfa-1046:0", "cfa-10470:0", "cfa-10471:0", "cfa-10472:0", "cfa-10472:1", "cfa-10472:2", "cfa-10473:0", "cfa-10473:1", "cfa-10477:0", "cfa-10478:0", "cfa-10479:0", "cfa-10479:1", "cfa-1047:0", "cfa-10480:0", "cfa-10481:0", "cfa-10481:1", "cfa-10482:0", "cfa-10482:1", "cfa-10483:0", "cfa-10483:1", "cfa-10484:0", "cfa-10484:1", "cfa-1048:0", "cfa-1048:1", "cfa-1048:2"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-10472:0", "cfa-10472:2", "cfa-1048:1", "cfa-1048:2"]);

const blockerById = Object.freeze({
  "cfa-10460:0": "CONT grants Intercept and +5000 shield to every unit card named Gouzetsu -Twisted Emotions-. The engine has no trusted dynamic named-unit keyword and shield grant.",
  "cfa-10460:1": "ACT pays Counter Blast and moves a Rear-Guard to Soul, then grants different power and a battle-close stand/Drive reduction at two Soul-count thresholds. Threshold evaluation, granted abilities, nested timing, and Drive modification are not supported as one validated program.",
  "cfa-10461:0": "CONT scales this source's power and grants Boost at two Gouzetsu Soul-count thresholds. Dynamic named Soul counting and keyword grants are not supported for this definition.",
  "cfa-10462:0": "Placement AUTO pays Counter Blast and performs ordered Soul-count branches; the first branch changes Soul before the second and has an explicit no-draw exception. Snapshot versus post-effect count semantics need a sequenced conditional resolver.",
  "cfa-10463:0": "Attack AUTO pays Counter Blast, scales this source's battle power by the Gouzetsu Soul count, and changes how many cards the opponent must call to GC. Scaled battle power and a temporary minimum simultaneous guard-call rule are unsupported.",
  "cfa-10464:0": "ACT from Drop uses two Gouzetsu Soul-count thresholds to call this source and then a differently named Gouzetsu card from Monster BOX. Drop activation and Monster BOX selection/calling are unsupported.",
  "cfa-10465:0": "Placement AUTO pays Counter Blast and privately selects a card from Monster BOX to hand. Monster BOX is not a supported selectable source zone for this effect.",
  "cfa-10465:1": "Attack AUTO checks the exact attacked unit's grade and whether a card entered Monster BOX this turn, then grants battle power. This destination event history and combined attack condition are not represented by a trusted definition.",
  "cfa-10466:0": "Placement AUTO moves the top three Deck cards to Monster BOX. A bulk Deck-to-Monster-BOX operation is not supported.",
  "cfa-10466:1": "ACT pays Counter Blast and a named Soul card-to-Deck-bottom cost, chooses a column, then retires all opposing Rear-Guards in it. The named cost and opponent-column mass-retire sequence are unsupported.",
  "cfa-10467:0": "This AUTO requires the exact boosted attack to hit the Vanguard, then counts Gouzetsu cards in Soul for Soul Charge and Counter Charge branches. Exact boost/battle/hit matching plus the threshold and resource sequence are unsupported.",
  "cfa-10468:0": "CONT grants Intercept and +10000 shield on RC/GC if Soul contains a card sharing a name with the current Vanguard. The current-Vanguard name comparison and dual-zone continuous shield grant lack a trusted definition.",
  "cfa-10469:0": "Hand CONT changes which grades may be exchanged with Monster BOX cards. Monster BOX exchange eligibility and replacement rules are not implemented.",
  "cfa-10469:1": "ACT from Monster BOX calls this source to RC, pays Counter Blast, and conditionally gives it power based on Vanguard grade. Monster BOX activation and calling are unsupported.",
  "cfa-1046:0": "AUTO is source-specific to its own attack, requires an Aqua Force Vanguard and the third-or-later battle, then modifies the Vanguard. Turn battle-count history and its exact conditional target effect are not compiled.",
  "cfa-10470:0": "Attack AUTO checks for a specific stand Order in Order Zone and moves a selected Drop card to Monster BOX face up. The combined Order predicate and Drop-to-Monster-BOX choice are unsupported.",
  "cfa-10471:0": "This AUTO requires this exact boosted attack to hit the Vanguard, then chooses a friendly Rear-Guard for power. No trusted definition for this catalog ability was found; official wording could not be confirmed from the source lookup, so it remains blocked pending source verification.",
  "cfa-10472:1": "AUTO triggers when the opponent attacks this player's Vanguard, pays Soul Blast, and moves this exact source from RC to GC. The opponent-attack event, cost, and source-specific zone move are not a supported effect program.",
  "cfa-10473:0": "GC AUTO pays Counter Blast and Soul Blast, selects an opponent front-row unit, and moves every opposing Force marker to that circle. Marker ownership and mass repositioning are unsupported.",
  "cfa-10473:1": "Once-per-turn AUTO requires a Force marker to be placed on this exact circle, Soul Charges, and checks whether this player Counter Charged during the turn. Marker-placement events and resource-history condition are unsupported.",
  "cfa-10477:0": "Ride AUTO requires being ridden by a grade 3+ Vanguard with Chronojet in its name, pays Soul Blast, and searches Deck for a grade 3 Unit. The exact rider composite and typed Deck search are not validated handlers.",
  "cfa-10478:0": "Order Zone CONT grants custom Pull Targets identities to named cards and grants a named Order an ACT Deck search into Monster BOX. Dynamic identity/ability grants and Monster BOX search are unsupported.",
  "cfa-10479:0": "Battle-close AUTO requires this source to have boosted and moves the same instance from RC to Monster BOX face up. The exact boost-battle-close destination effect is unsupported.",
  "cfa-10479:1": "CONT on RC/GC checks whether the Vanguard has the custom Pull Targets identity, then grants power and shield. That identity predicate and dual-zone continuous effects are unsupported.",
  "cfa-1047:0": "Battle-close AUTO requires this exact source to have attacked the Vanguard, an Aqua Force Vanguard, and an optional Counter Blast; it swaps positions with another same-column Aqua Force while preserving each unit's state. No trusted position-exchange effect exists.",
  "cfa-10480:0": "Boost AUTO has a custom Vanguard predicate and optional power; accepting also schedules this source's move to Monster BOX and Counter Charge at battle end. Optional branch sequencing, destination move, and conditional resource payment are unsupported.",
  "cfa-10481:0": "Placement AUTO requires a custom Pull Targets Vanguard, pays Soul Blast, and sets an opponent unit's power to exactly 8000. The custom identity predicate and absolute-power-setting effect are unsupported.",
  "cfa-10481:1": "Battle-close AUTO retires this exact attacking source, then chooses one of the controller's units for power. This atomic source retirement plus post-retirement choice is not a trusted effect program.",
  "cfa-10482:0": "Vanguard-attack AUTO selects two differently named Monster BOX cards not matching Rear-Guards, calls them to one column, then retires an opponent Rear-Guard whose grade matches either. The private multi-card selection and dependent target rule are unsupported.",
  "cfa-10482:1": "Once-per-turn AUTO when this Vanguard is attacked discards a hand card, then calls any number of differently named Monster BOX Units to GC. The exact opponent-attack window and private multi-call are unsupported.",
  "cfa-10483:0": "Once-per-turn attack AUTO requires a custom Pull Targets Vanguard, puts another Rear-Guard into Monster BOX, and grants this source power. The custom identity and other-source cost movement are unsupported.",
  "cfa-10483:1": "Once-per-turn AUTO at battle end requires a grade 3+ named Vanguard attack, then Counter Blasts and stands this source. Exact other-source battle-close matching and stand timing are not represented.",
  "cfa-10484:0": "Placement AUTO on VC/RC checks a custom Vanguard, pays Soul Blast, then searches Deck for up to one card with the printed shared name but a different card name, reveals it, adds to hand, and shuffles. The exact full-Deck filtered search is unsupported.",
  "cfa-10484:1": "Battle-close AUTO requires this exact source's attack while boosted, pays another named Rear-Guard to Deck bottom, then chooses and retires an opposing Rear-Guard. The source battle identity and filtered cost/target sequence are unsupported.",
  "cfa-1048:0": "Limit Break attack AUTO pays Counter Blast, increases this source's power, and prohibits opponent normal grade 1+ calls to GC for the battle. The Limit Break condition and temporary guard-call restriction are unsupported."
});

const assignment = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "ability-work-batches.json"), "utf8")).batches.find(batch => batch.batchId === "ABILITY-320008F1-0018");
if (!assignment) throw new Error("Assignment ABILITY-320008F1-0018 is missing from the registry.");
if (JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...abilityIds].sort())) throw new Error("Contribution ability IDs differ from the reserved assignment.");

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const alreadySupportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing exact catalog ability or blocker: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, officialReference: null, blocker: blockerById[abilityId] });
}));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, printedText: ability.printedText, definitionSource: ability.definition.source?.patternId || "compiled keyword definition" });
}));

const result = [];
Object.defineProperty(result, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0018",
    status: "four-existing-definitions-thirty-five-blocked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: false,
    officialReferences: Object.freeze({}),
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    fullyTestedWholeCardIds: Object.freeze([]),
    unsupportedSiblings,
    provenanceNote: "All 39 reserved ability IDs were compared with the local catalog text and loaded production definitions. Four have existing compiled definitions; the other 35 have explicit mechanic blockers. No proposal was made from unverified or unsupported zone and timing semantics. Official cardlist text was not confirmed for the unsupported entries in this batch."
  })
});
Object.defineProperty(result, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = result;
