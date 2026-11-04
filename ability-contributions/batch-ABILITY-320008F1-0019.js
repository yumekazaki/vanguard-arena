"use strict";

// Audit-only contribution. One assigned ability already has a reviewed
// production definition. The other 32 remain blocked until their exact
// mechanics have trusted, tested support.
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const batchId = "ABILITY-320008F1-0019";
const abilityIds = Object.freeze([
  "cfa-10487:0", "cfa-10487:1", "cfa-10488:0", "cfa-10489:0", "cfa-1049:0",
  "cfa-10500:0", "cfa-10501:0", "cfa-10502:0", "cfa-10505:0", "cfa-10506:0",
  "cfa-10507:0", "cfa-10509:0", "cfa-10509:1", "cfa-1050:0", "cfa-1050:1",
  "cfa-10510:0", "cfa-10511:0", "cfa-10512:0", "cfa-10513:0", "cfa-10513:1",
  "cfa-10514:0", "cfa-10515:0", "cfa-10515:1", "cfa-10516:0", "cfa-10516:1",
  "cfa-1051:0", "cfa-10521:0", "cfa-10522:0", "cfa-10522:1", "cfa-10523:0",
  "cfa-10524:0", "cfa-105:0", "cfa-105:1"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-105:0"]);
const supportedPatternById = Object.freeze({ "cfa-105:0": "auto-ridden-unit-clan-optional-source-call-v1" });

const blockerById = Object.freeze({
  "cfa-10487:0": "Reveals five Deck cards, selects every Set Order among them for the Order Zone, then shuffles. The reveal-and-move-all-filtered-cards sequence has no trusted handler.",
  "cfa-10487:1": "At the end of this Vanguard's attack, returns any chosen Set Orders from Order Zone to Deck, checks distinct-name thresholds, then stands targets and modifies this source's power and Drive before shuffling. The ordered selections and dependent threshold effects are unsupported.",
  "cfa-10488:0": "Placement AUTO combines a Chronojet crest predicate, Soul Blast 2, a draw, and a +5000 branch only when this exact source was placed by an ability. The combined condition, cost, origin check, and sequence lack trusted support.",
  "cfa-10489:0": "After this source's Vanguard attack, applies +5000, then at battle end pays by moving this unit to Deck bottom and searches for a grade 1 card to call to back row. The variable timing, cost-source grade handling, search, call, and shuffle sequence are not implemented together.",
  "cfa-1049:0": "At the end of this exact source's attack, optionally pays Counter Blast 1 and swaps positions with another same-column Aqua Force Rear-Guard while preserving both cards' states. A state-preserving position exchange is unsupported.",
  "cfa-10500:0": "On placement, pays Counter Blast 2, chooses an opponent's Rear-Guard circle, and binds every card on that circle. Choosing a circle and atomically binding all its cards is unsupported.",
  "cfa-10501:0": "Continuous own-turn power requires another grade 2 or greater unit in the same column. The engine has no trusted source-relative same-column grade condition for this modifier.",
  "cfa-10502:0": "The Vanguard attack pays Counter Blast, turns a G-zone card face up, and puts a Rear-Guard on Deck bottom; it then searches by that cost card's grade, calls it, and grants another unit power per face-up G card. The selected-cost-dependent search and sequential target choices lack a trusted effect program.",
  "cfa-10505:0": "Requires this exact unit to boost while its controller has at least five Soul cards, then grants battle-limited power. The catalog has no trusted definition that jointly validates the source-specific boost event, Soul threshold, and battle expiry.",
  "cfa-10506:0": "This exact Rear-Guard's attack requires at least three differently named Set Orders and pays Soul Blast 1 for battle power. The distinct-name Order count condition and source-scoped cost/effect definition are not reviewed.",
  "cfa-10507:0": "Triggers only when this exact unit is retired from Rear-Guard by a card ability, then checks a Glitter Vanguard and chooses a grade 1 or lower Rear-Guard for power. Ability-caused retirement history and the filtered target are not jointly validated.",
  "cfa-10509:0": "At the controller's Main Phase start, conditionally creates/calls a Momokke token if none is on Rear-Guard. The token identity, token creation, and absence check are not implemented as a trusted sequence.",
  "cfa-10509:1": "This hand AUTO depends on another named Radylina's attack ending, the opponent's Vanguard grade, and retiring both a Radylina Rear-Guard and Momokke token; it then calls this source and copies the retired token's power. The external battle event, multi-card cost, token power capture, and call are unsupported.",
  "cfa-1050:0": "Limit Break plus the third-or-later battle condition turns up to two damage cards face up. Battle-count timing and a filtered face-up damage selection are not represented by a trusted definition.",
  "cfa-1050:1": "ACT on VC pays Counter Blast 2 and chooses an Aqua Force Rear-Guard for +3000. No trusted definition binds the cost, legal clan target, and controller-side manual activation for this card.",
  "cfa-10510:0": "On Rear-Guard placement specifically by a card ability, pays Counter Blast 1, draws, and grants +5000. The exact placement-origin restriction combined with cost and sequential draw/power effects is unsupported.",
  "cfa-10511:0": "Continuous own-turn power depends on whether any unit was placed on Rear-Guard from Soul this turn, including this source. Turn-scoped movement history is not evaluated by a trusted continuous condition.",
  "cfa-10512:0": "When discarded from hand during its controller's turn, conditionally pays Soul Blast 1 to call this source to back row and prevent it from attacking. Optional payment, call, and temporary attack restriction lack a trusted definition.",
  "cfa-10513:0": "Continuous own-turn power checks whether either player's Rear-Guard was put on Deck bottom this turn. The global turn-scoped movement event is not a trusted continuous condition.",
  "cfa-10513:1": "Generation Break 1 continuously grants Intercept and back-row intercept. Granting and enforcing both keyword permissions under the G-zone condition is not implemented for this ability.",
  "cfa-10514:0": "When placed on Guardian Circle, pays Soul Blast 1, then gives +5000 shield or +10000 when a face-up G-zone card exists. The conditional shield amount and battle-scoped expiry have no trusted definition.",
  "cfa-10515:0": "On Order Zone placement, looks at five Deck cards, calls up to one selected card to Rear-Guard, and shuffles. Private reveal/selection and the call destination are not compiled for this source.",
  "cfa-10515:1": "Once-per-turn Order Zone ACT pays Soul Blast 1 and rests three Research Orders, then selects a Glitter unit for power. The filtered multi-card rest cost, legal target, and turn restriction lack trusted support.",
  "cfa-10516:0": "Order Zone placement AUTO pays Counter Blast 1 and draws. Existing trusted Order Zone placement support explicitly covers no-cost draw abilities and rejects this cost-bearing variant.",
  "cfa-10516:1": "Order Zone ACT checks a Thegrea Vanguard, sends this Order to Drop as cost, then rides a different grade 3 or greater Thegrea from hand as Stand. The filtered hand ride and atomic Order cost are unsupported.",
  "cfa-1051:0": "On VC/RC placement, reveals the Deck's top card and conditionally calls only grade 1 or 2 Great Nature; otherwise it shuffles. The conditional clan/grade reveal and failure-only shuffle are not modeled by a trusted definition.",
  "cfa-10521:0": "Placement AUTO requires a grade 3 Soul card, puts a grade 3 hand card into Soul as cost, then draws and grants power. The grade-filtered hand-to-Soul payment and ordered effects lack trusted support.",
  "cfa-10522:0": "Triggers from another named Monster unit's Rear-Guard placement, sends a matching-name Order Zone card to Deck bottom as cost, then powers that exact placed unit. Cross-source event identity and filtered Order cost/target are unsupported.",
  "cfa-10522:1": "Vanguard attack pays Counter Blast and performs two ordered Research branches: possibly moves a named Monster Rear-Guard into Order Zone, then reveals seven Deck cards and calls a Monster Unit. The dependent multi-step choice and search/call sequence lack trusted support.",
  "cfa-10523:0": "Ride AUTO requires this exact card to be ridden from Monster Soul-searching, Arkhite before searching for a Research Order. The predecessor-specific ride event and search are not validated together.",
  "cfa-10524:0": "Ride AUTO requires this exact card to be ridden from Short Rest, Arkhite before searching for a Research Order. The predecessor-specific ride event and search are not validated together.",
  "cfa-105:1": "Requires this exact unit to have boosted the battle that hit the Vanguard, then optionally pays Counter Blast and moves this source to Soul before standing a filtered Beast Deity Rear-Guard. The attack/booster identity, clan checks, ordered source cost, and target selection are not compiled for this ability."
});

const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "ability-work-batches.json"), "utf8"))
  .batches.find(batch => batch.batchId === batchId);
if (!assignment) throw new Error(`Assignment ${batchId} is missing from the registry.`);
if (JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...abilityIds].sort())) throw new Error("Contribution ability IDs differ from the reserved assignment.");

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const supportedSet = new Set(alreadySupportedAbilityIds);
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const separator = abilityId.lastIndexOf(":");
  const cardId = abilityId.slice(0, separator);
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition || ability.definition.source?.patternId !== supportedPatternById[abilityId]) throw new Error(`Expected reviewed production definition missing for ${abilityId}.`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, printedText: ability.printedText, definitionSource: ability.definition.source.patternId });
}));

const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing exact catalog ability or blocker: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, officialReference: null, blocker: blockerById[abilityId] });
}));

const result = [];
Object.defineProperty(result, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId,
    status: "one-existing-definition-thirty-two-blocked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: false,
    officialReferences: Object.freeze({ "cfa-105:0": "https://en.cf-vanguard.com/howto/question/?id=basic" }),
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    fullyTestedWholeCardIds: Object.freeze([]),
    unsupportedSiblings,
    provenanceNote: "All 33 reserved IDs were matched to the local 2025-05-09 card catalog and current production definitions. One exact ability already uses the reviewed ride-trigger source-call handler. The other 32 remain blocked with ability-specific gaps; none is promoted or proposed from unverified catalog-only wording. The official Bushiroad Q&A references BT06/042EN, but its accessible entry did not expose the full card text, so officialTextChecked remains false."
  })
});
Object.defineProperty(result, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = result;
