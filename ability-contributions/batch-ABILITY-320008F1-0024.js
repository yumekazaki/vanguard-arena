"use strict";

// Audit-only contribution for batch 0024. This records exact existing support
// and the concrete gaps for unsupported siblings; it adds no production rules.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");
const fs = require("node:fs");
const path = require("node:path");

const batchId = "ABILITY-320008F1-0024";
const workerOwner = "worker-ability-0024";
const abilityIds = Object.freeze([
  "cfa-10630:0", "cfa-10630:1", "cfa-10631:0", "cfa-10631:1", "cfa-10632:0", "cfa-10632:1",
  "cfa-10633:0", "cfa-10634:0", "cfa-10634:1", "cfa-10635:0", "cfa-10635:1", "cfa-10636:0",
  "cfa-10636:1", "cfa-10637:0", "cfa-10638:0", "cfa-10639:0", "cfa-10639:1", "cfa-10640:0",
  "cfa-10641:0", "cfa-10642:0", "cfa-10643:0", "cfa-10643:1", "cfa-10655:0", "cfa-10656:0",
  "cfa-10657:0", "cfa-10657:1", "cfa-10658:0", "cfa-10658:1", "cfa-1065:0", "cfa-10660:0",
  "cfa-10661:0", "cfa-10662:0", "cfa-10662:1", "cfa-10663:0", "cfa-10664:0", "cfa-10664:1",
  "cfa-1066:0", "cfa-1066:1"
]);

// These six are already compiled and admitted by the server's exact ability
// guards. The batch does not broaden their definitions or server allowlists.
const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10635:1", "cfa-10636:1", "cfa-10639:0", "cfa-10662:0", "cfa-1066:0", "cfa-1066:1"
]);
const proposedDefinitions = Object.freeze([]);

// No new definition is proposed, so no card text is represented as newly
// verified against Bushiroad. Existing definition provenance is reported as-is.
const verifiedOfficialAbilities = Object.freeze([]);

const blockerById = Object.freeze({
  "cfa-10630:0": "The trigger is restricted to this exact unit being placed on RC by another card ability. Current placement events do not retain a trusted causal-effect identity for this distinction; optional Soul Charge 1 therefore cannot be authorized from the exact event.",
  "cfa-10630:1": "The source itself must boost, the controller must have a Lianorn vanguard, and only a unit in the source's column gets battle-independent power through turn end. No trusted resolver combines the exact boost source, column target, named-vanguard check, and temporary power.",
  "cfa-10631:0": "This Soul CONT changes this card's grade while the controller did not ride that turn. The continuous evaluator does not maintain ride-history state and apply a grade modifier to this exact Soul instance.",
  "cfa-10631:1": "This Soul AUTO is tied to the controller's grade-3-or-greater vanguard attack, the no-ride-this-turn condition, and binding this exact Soul card as cost before granting +5000 to the front row. The combined event, ride-history condition, source bind, and row-wide modifier are not supported.",
  "cfa-10632:0": "This RC CONT depends on the source having been placed this turn and a Haseritt or Mediell vanguard, then changes how trigger units in both RC and Deck are treated. The engine has no reviewed continuous card-type reinterpretation spanning field and deck zones.",
  "cfa-10632:1": "The power grant is limited to the controller's turn, named Haseritt/Mediell grade-3-or-greater vanguard, and other Rear-Guards in the source's current column. There is no exact continuous same-column target handler with this combined predicate.",
  "cfa-10633:0": "The catalog block contains two distinct Order Zone AUTOs: placement draws and Soul Charges under a Blitz condition; operating has separate main-phase top-five filtered calling and battle-phase draw branches. The parser/resolver does not model the operation event, its phase split, and the sequential top-five call as this exact program.",
  "cfa-10634:0": "The placement AUTO combines a Set Order condition, Counter Blast plus discard, a deck search whose filter is same-name-as-vanguard OR Product, then a Welstra-only optional Product placement from hand. The resolver lacks this exact OR-filtered search and conditional follow-up sequence.",
  "cfa-10634:1": "This source's attack on a vanguard with Welstra pays Soul Blast 2, selects a Product from Order Zone, and operates that chosen Product. Product selection and operation are not supported as an exact source-attack effect.",
  "cfa-10635:0": "The source must attack while it is actually boosted, be within its once-per-turn restriction, and pay Soul Blast 1 before the opponent privately chooses a discard only when their hand has at least four cards. The attack-boost relation, opponent-owned discard choice, and combined gate are not covered by a trusted definition.",
  "cfa-10636:0": "This boosted own-attack AUTO pays Counter Blast, stands the exact attacker, adds +10000 only from battle four onward, and additionally requires a hand discard when the source is on VC. The resolver does not authorize this ordered stand/battle-count/Vanguard-only discard sequence.",
  "cfa-10637:0": "The trigger requires placement from hand specifically, then Soul Blast 1 and selection of a grade-2-or-greater card from Drop to move to the top of Deck. No trusted handler combines source-from-hand matching, filtered Drop selection, and top-deck movement.",
  "cfa-10638:0": "The exact source's RC placement only qualifies if the opponent's bind zone is nonempty, then Soul Charges and gains temporary power. The current placement effect definitions do not validate this opponent-zone condition together with the source event and both effects.",
  "cfa-10639:1": "This once-per-turn back-row AUTO reacts to a different Rear-Guard in the same column being placed in the front row, then pays Counter Blast and draws. Placement events do not provide a validated same-column relation to this exact source for this handler.",
  "cfa-10640:0": "ACT legality depends on persona riding this turn, including the catalog's stated alternate way of activating Persona Ride. It then gives the opponent a deck-bottom ordering choice for their same-column rear-guards and grants power. Persona-Ride history, opponent-owned ordering, and this multi-target movement are not implemented together.",
  "cfa-10641:0": "The own-attack effect requires a Baromagnes vanguard, moving another friendly rear-guard to Soul as cost, selecting an opposing rear-guard to Soul, then applying +10000 only if that opposing card was not moved. The resolver lacks the exact paid multi-owner target sequence and outcome-dependent power branch.",
  "cfa-10642:0": "This back-row-center CONT under Majesty Lord Blaster grants two separate abilities: an end-of-battle-on-boost AUTO that pays Counter Blast and calls two differently named Soul cards into one column, and a CONT granting Boost to grade-2 rear-guards when the opponent has grade 3+. Granted nested abilities, the matching boosted battle, paired calls, and dynamic keyword grant are not modeled as this program.",
  "cfa-10643:0": "This is a cost-replacement rule: when a Blaster vanguard ability would retire this source, it may count as two rear-guards. The rules engine has no reviewed replacement-cost handler that changes the count of this exact source during payment validation.",
  "cfa-10643:1": "The trigger must identify this source being retired specifically as a Blaster-vanguard ability cost, check the opponent's grade, then grant a temporary once-per-turn attack AUTO to a chosen Blaster Dark. That granted ability adds a discard cost, repeated drive checks, and self-retirement; cost-cause identity and nested granted drive-check resolution are unsupported.",
  "cfa-10655:0": "The ACT pays Soul Blast 1, privately inspects the top card and returns it to its original position, then grants +2000 to this source for the turn. A reviewed peek-without-moving/restoring-order effect is not available.",
  "cfa-10656:0": "This continuous effect applies in either RC or GC, even on the opponent's turn, and simultaneously changes power and shield under a Flagburg-vanguard condition. No trusted definition implements this exact two-zone, cross-turn pair of modifiers.",
  "cfa-10657:0": "The Deck/Hand CONT condition compares this card's name with a different Sylvan Horned Beast under a grade-2-or-greater vanguard and reduces this card's grade. The evaluator does not apply continuous grade changes to a specific card in hidden Deck/Hand zones with this name comparison.",
  "cfa-10657:1": "This RC CONT grants +10000 only if the controller's Magnolia vanguard was placed this turn. The engine does not retain and revalidate this exact named-vanguard placement history for the source's continuous power.",
  "cfa-10658:0": "The Drop AUTO is limited to Magnolia vanguard placement during Ride Phase, absence of another Goildoat in Soul, and putting this exact Drop card into Soul as cost before choosing a vanguard for +5000. Ride-specific placement history and the source-zone cost/target sequence are not supported together.",
  "cfa-10658:1": "This back-row unit gains +10000 on its own attack, then at battle end checks that it is still in the center column, retires itself as cost, and draws. The exact attack identity, end-of-battle position recheck, retirement cost, and draw transaction lack a trusted combined handler.",
  "cfa-1065:0": "This Guardian Circle AUTO is optional: with a Gold Paladin vanguard, pay Counter Blast 1 and give this exact guardian +5000 shield through battle. The production server does not have a reviewed exact optional paid GC shield-modifier definition for this card.",
  "cfa-10660:0": "This AUTO requires this exact booster to boost a Nordlinger vanguard, then Counter Blasts and discards before granting a temporary drive ability to a chosen vanguard. The grant depends on trigger-zone history and must stop additional drive checks if a trigger appears before check two; this nested dynamic drive-check rule is unsupported.",
  "cfa-10661:0": "The ACT checks persona ride history, pays Soul Blast 1, chooses another unit, and grants +10000 to both that chosen unit and this source for the turn. Persona-Ride state and an atomic two-target modifier are not covered by an exact trusted definition.",
  "cfa-10662:1": "This once-per-turn ACT requires a grade-3-or-greater vanguard, Counter Blast 1 and Soul Blast 1, then moves a selected Normal Order from Drop to hand. The combined costs and validated Normal Order target/move are not defined for this ability.",
  "cfa-10663:0": "The ACT requires an Arms card on VC, puts this source into Soul as cost, selects one of two named Arms cards on VC, and reduces the Counter Blast cost of that card's original AUTO through turn end. The engine cannot link the equipped Arms instance to its original ability or apply a temporary cost reduction.",
  "cfa-10664:0": "The RC-from-hand AUTO requires a Bavsargra vanguard, Soul Blast 1 plus hand discard, and a search for an Arms card from either Deck or Drop; shuffle is required only if Deck was searched. The resolver lacks this exact multi-zone search, reveal/add, and conditional-shuffle sequence.",
  "cfa-10664:1": "This once-per-turn RC ACT pays Counter Blast and moves an Arms card from VC into Soul as cost, then draws and grants this source +5000. The authoritative state does not implement this exact attached-Arms cost selection and atomic draw/power resolution."
});

const root = path.resolve(__dirname, "..");
const assignment = JSON.parse(fs.readFileSync(path.join(root, "ability-work-assignments.json"), "utf8"))
  .completedAssignments.find(item => item.batchId === batchId && item.auditOnly === true);
if (!assignment || assignment.workerOwner !== workerOwner) throw new Error(`Completed audit ${batchId} is missing or has a different owner.`);
if (JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...abilityIds].sort())) throw new Error("Contribution IDs differ from the exact assigned batch.");

const catalog = loadCatalog(root);
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const supportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) throw new Error(`Expected exact blocked catalog ability and blocker: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: null,
    officialReference: null,
    blocker: blockerById[abilityId]
  });
}));

const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition || !Reducer.supportsServerAbilityEffects(ability)) throw new Error(`Expected supported production definition and server handler missing: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    serverHandlerSupported: true,
    officialPrintedText: null,
    officialReference: null
  });
}));

module.exports = Object.freeze({
  batchId,
  workerOwner,
  abilityIds,
  alreadySupportedAbilityIds,
  supportedDefinitions,
  proposedDefinitions,
  unsupportedSiblings,
  verifiedOfficialAbilities
});
