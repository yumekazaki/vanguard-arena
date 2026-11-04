"use strict";

// These definitions were integrated into the production registry after their
// exact catalog text and both-seat reducer behavior passed focused tests.
const Engine = require("../ability-engine.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10115:0", "cfa-10117:0", "cfa-10118:0", "cfa-10118:1", "cfa-10120:0",
  "cfa-10120:1", "cfa-10120:2", "cfa-10121:0", "cfa-10121:1", "cfa-10122:0",
  "cfa-10122:1", "cfa-10123:0", "cfa-10123:1", "cfa-10124:0", "cfa-10125:0",
  "cfa-10125:1", "cfa-10126:0", "cfa-10126:1", "cfa-10127:0", "cfa-10127:1",
  "cfa-10128:0", "cfa-10129:0", "cfa-1012:0", "cfa-1012:1", "cfa-10130:0",
  "cfa-10131:0", "cfa-10131:1", "cfa-10132:0", "cfa-10133:0", "cfa-10133:1",
  "cfa-10134:0", "cfa-10134:1", "cfa-10135:0", "cfa-10136:0", "cfa-10137:0",
  "cfa-10138:0", "cfa-10139:0", "cfa-10139:1", "cfa-1013:0"
]);

const definitions = [
  {
    id: "cfa-10115:0",
    cardId: "cfa-10115",
    kind: "AUTO",
    printedText: "AUTO [RC]: When your vanguard attacks, if your opponent has two or less rear-guards, COST [put this unit into your soul], choose one of your vanguards, and it gets power +10000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger", eventType: "unit.attacked", subject: "vanguard", circles: [],
      subjectControllerRelation: "source-controller", requiredTimingWindow: "attack-declared"
    },
    conditions: [{ type: "opponent-rear-guards-at-most", count: 2 }],
    conditionsReviewed: true,
    costs: [{ type: "source-to-soul", count: 1 }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "auto-rc-own-vanguard-attack-opponent-rear-guards-at-most-two-source-soul-choose-vanguard-power-turn-v1",
      review: "The controller's exact Vanguard attack triggers this Rear-Guard AUTO. It checks the opponent's live Rear-Guard count, moves only this source from RC to Soul as its cost, and selects one Vanguard controlled by this source's controller for +10000 until turn end."
    },
    effects: [{
      op: "modify-power-target", target: "chosen", amount: 10000, duration: "turn",
      targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" }
    }]
  },
  {
    id: "cfa-10118:1",
    cardId: "cfa-10118",
    kind: "AUTO",
    printedText: "AUTO: When this unit is placed on RC, COST [Soul Blast 1], choose one of your vanguards, and it gets power +5000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] },
    conditions: [],
    conditionsReviewed: true,
    costs: [{ type: "soul-blast", count: 1 }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "auto-rc-placement-soul-blast-choose-friendly-vanguard-power-turn-v1",
      review: "The exact source must be placed on RC. Its controller pays Soul Blast 1 and chooses a Vanguard that they control; only that Vanguard receives +5000 until turn end."
    },
    effects: [{
      op: "modify-power-target", target: "chosen", amount: 5000, duration: "turn",
      targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" }
    }]
  },
  {
    id: "cfa-10133:1",
    cardId: "cfa-10133",
    kind: "AUTO",
    printedText: "AUTO: When this unit is rode upon by a unit with \"Blaster\" in its card name, call this card to RC.",
    requiredLocation: ["vanguard"],
    trigger: {
      status: "recognized-trigger", eventType: "card.ridden", subject: "ridden-unit", circles: ["vanguard"],
      riderCardNameContains: "Blaster"
    },
    conditions: [],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "auto-ridden-by-blaster-source-call-v1",
      review: "The exact prior Vanguard instance must be the ridden unit, and the rider's actual card name must contain Blaster. The same source is called standing from Soul to a legal RC."
    },
    effects: [{ op: "call-source-from-soul", target: "source", position: "stand" }]
  },
];

const alreadySupportedAbilityIds = Object.freeze(["cfa-1012:0"]);
const integratedAbilityIds = Object.freeze(["cfa-10115:0", "cfa-10118:1", "cfa-10129:0", "cfa-10133:1"]);
const officiallyCheckedAbilityIds = Object.freeze(["cfa-10129:0"]);
const blockerById = Object.freeze({
  "cfa-10118:0": "The call-from-Drop operation exists, but the authoritative reducer only trusts its ride-phase and Grade-2-gated exact templates. This ability instead needs a controller-turn discard trigger plus Counter Blast 1, so a new reviewed server gate is required before it can be exposed.",
  "cfa-10117:0": "This placement AUTO requires Counter Blast 1, revealing the exact top deck card, adding it only if it is a Normal Unit, and otherwise restoring it to its original deck position. No reviewed handler provides that conditional reveal and exact return sequence.",
  "cfa-10118:1": null,
  "cfa-10120:0": "This Set Order's Order Zone AUTO inspects seven cards, filters B-Heroes, reveals up to three, adds up to one, scouts up to two into Base, and shuffles. The engine has no complete trusted top-seven selection and Base scouting sequence.",
  "cfa-10120:1": "This Order Zone ACT rests the Set Order, discards from hand, filters scouted Base cards by Vanguard grade, and calls the selected card to RC. Order Zone activation, Scout state, and the filtered call are not represented by one trusted handler.",
  "cfa-10120:2": "This Order Zone AUTO requires an attacked-unit event, Soul Blast 1, resting this Order, choosing a scouted Base card, and calling it to GC. The Scout-to-GC choice and attack timing are unsupported.",
  "cfa-10121:0": "This Vanguard placement AUTO searches the deck for a Base card, reveals it, adds it, and shuffles. A trusted exact Base-type deck search handler is unavailable.",
  "cfa-10121:1": "This CONT grants power only while this source boosts a unit whose card name contains B-Hero. The continuous evaluator cannot bind the boosted unit's exact name to this source's current battle.",
  "cfa-10122:0": "This once-per-turn Vanguard ACT scouts a B-Hero from hand into Base and draws. Scout/Base state, hand filtering, and usage tracking are not all supported by a trusted effect sequence.",
  "cfa-10122:1": "This once-per-turn AUTO triggers when the source moves to another RC during the Battle Phase. Exact source movement history, Battle Phase timing, and the usage lock are not modeled together.",
  "cfa-10123:0": "This Vanguard CONT buffs all front-row Rear-Guards with B-Hero in their names on both players' turns. There is no trusted continuous effect for this multi-unit, front-row, name-filtered scope.",
  "cfa-10123:1": "This Vanguard attack AUTO checks Base presence and a three-Base threshold, pays Counter Blast 1, and applies both battle power and conditional critical. Base counts and the complete ordered battle modifiers are unsupported.",
  "cfa-10124:0": "This back-center AUTO triggers at the end of the exact Grade 3 B-Hero Vanguard's attack, pays Soul Blast 1 and rests this source, then swaps two friendly Rear-Guards that share a column. Pair filtering and position swapping are not trusted effects.",
  "cfa-10125:0": "This placement AUTO pays Counter Blast 1 and retires an opponent's front-row Rear-Guard in the same column as the source. The target filter cannot validate that column relationship.",
  "cfa-10125:1": "This CONT depends on a Base card in the controller's Order Zone during their turn. The engine does not expose the live Base-zone predicate needed for this continuous power modifier.",
  "cfa-10126:0": "This mandatory Soul Charge triggers specifically when the card is scouted. The current trusted event model does not identify the Scout action and exact scouted card as a trigger event.",
  "cfa-10126:1": "This GC CONT requires both a Base in the Order Zone and a B-Hero Vanguard before adding shield. The live Base predicate and combined shield conditions are not represented by a trusted definition.",
  "cfa-10127:0": "This Order Zone CONT prevents opposing card effects from retiring friendly Rear-Guards named Obscudeid. The engine lacks a source-aware, name-filtered retirement restriction from an Order Zone card.",
  "cfa-10127:1": "This Order Zone ACT checks four Research cards, sends this Order to Soul as cost, Counter Charges, then retrieves a named Obscudeid from Drop. Research counting and filtered Drop-to-hand resolution are unsupported.",
  "cfa-10128:0": "This back-row CONT prevents opposing Rear-Guards from attacking other friendly units in its column. Cross-controller attack legality and same-column protection are not modeled by a trusted restriction.",
  "cfa-1012:1": "This Vanguard placement AUTO pays Counter Blast 2, draws two cards, then chooses and discards one. No trusted definition covers this exact paid placement trigger and ordered draw-then-discard sequence.",
  "cfa-10130:0": "This once-per-turn ACT discards a card, inspects three cards, then makes an exclusive RevolForm-to-hand or grade-2-or-less call choice and orders the remainder on the deck bottom. The complete branching private selection is unsupported.",
  "cfa-10131:0": "This attack AUTO checks both target grade and at least two Set Orders before granting battle power. The Order Zone Set Order count is not available to the trusted condition evaluator.",
  "cfa-10131:1": "This Drop AUTO depends on a Set Order played from hand being placed in the Order Zone, pays Counter Blast 1, and calls this source. The causal play-from-hand event and standing Drop call are not represented together.",
  "cfa-10132:0": "This placement AUTO pays Soul Blast 1, chooses a B-Hero from Drop, and scouts it into Base. The filtered Drop selection and Scout movement sequence are unsupported.",
  "cfa-10133:0": "This once-per-turn AUTO requires a Grade 3+ Vanguard attack, Counter Blast 1, filtering Soul for a Grade 2+ Blaster, and calling that target to an open RC. Filtered Soul-to-RC calls and usage tracking are unsupported.",
  "cfa-10134:0": "This Drop AUTO covers either a Kaiser Vanguard attack or being attacked by a Grade 3 Vanguard, pays Counter Blast 1, then branches between a front-row call and battle power for all Vanguards. The paired triggers and exclusive resolution are unsupported.",
  "cfa-10134:1": "This RC AUTO tracks a card entering the Trigger Zone during the controller's End Phase, checks the Kaiser Vanguard, pays Soul Blast 1 and retires this source, then moves that exact trigger card to Drop. Trigger-zone event provenance and the ordered movement are unsupported.",
  "cfa-10135:0": "This Soul AUTO binds another named Heekou from Soul face up when the Greedon Vanguard attacks, then calls this exact source to back-row RC. Selecting and binding a different copy before the source call is not covered by one trusted effect program.",
  "cfa-10136:0": "This once-per-turn AUTO triggers when selected by a qualifying Vanguard ability, pays Soul Blast 2, Counter Charges, then checks whether this source received trigger power before drawing. Targeted-by-ability provenance and trigger-power history are unsupported.",
  "cfa-10137:0": "This End Phase AUTO retires its source and calls up to two Plant tokens with specific grade, power, critical, and Boost characteristics. Plant token identity, creation, and circle placement are unsupported.",
  "cfa-10138:0": "This AUTO depends on a Vanguard being placed by riding from Grade 3, pays Soul Blast 1 and retires this source, Counter Charges, then buffs a chosen Vanguard. Ride-origin history and the combined retire/counter-charge/target sequence are not covered by a trusted handler.",
  "cfa-10139:0": "This placement AUTO pays Counter Blast 1, searches the top five for a Grade 3 Youthberk, reveals and adds it, shuffles, and buffs the source. No exact trusted handler combines that name-and-grade filter with the source modifier.",
  "cfa-10139:1": "This attack AUTO checks whether the controller's Vanguard was ridden from Grade 3 this turn, then buffs a chosen Vanguard. That exact ride-origin turn history is not exposed to the trusted condition evaluator.",
  "cfa-1013:0": "This VC/RC attack AUTO combines Soul Blast 1 and a hand discard, then chooses a different Oracle Think Tank and grants +3000. The combined cost, distinct-unit selection, and clan filter are not represented by one trusted handler."
});

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = catalogById.get(cardId);
  if (!card) throw new Error(`Batch card missing from local catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name, cardNumber: card.cardNumber || null });
}));
const proposedIds = new Set(definitions.map(definition => definition.id));
const supportedIds = new Set([...alreadySupportedAbilityIds, ...integratedAbilityIds]);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !proposedIds.has(id) && !supportedIds.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed text or concrete blocker for ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, blocker: blockerById[abilityId] });
}));
const proposedDefinitions = Object.freeze(definitions.map(definition => Object.freeze({
  abilityId: definition.id,
  kind: definition.kind,
  printedText: definition.printedText,
  patternId: definition.source.patternId
})));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing for ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText, definitionSource: ability.definition.source?.patternId || "compiled production definition" });
}));
const integratedProductionDefinitions = Object.freeze(officiallyCheckedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  const definition = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.id === abilityId);
  if (!ability?.definition || !definition?.source?.officialReference) throw new Error(`Expected official production definition missing for ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText, definitionSource: definition.source.patternId, officialReference: definition.source.officialReference, officialCardNumber: definition.source.officialCardNumber });
}));

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0005",
    status: "four-definitions-integrated-one-official-text-checked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: false,
    officiallyCheckedAbilityIds,
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    originallyProposedDefinitionIds: Object.freeze([...proposedIds]),
    implementedAbilityIds: integratedAbilityIds,
    alreadySupportedAbilityIds,
    proposedDefinitions,
    supportedProductionDefinitions,
    integratedProductionDefinitions,
    cards,
    unsupportedSiblings,
    provenanceNote: "Catalog text is preserved exactly from the local snapshot. Four definitions are integrated and have focused reducer coverage for both seats. Flutter Dragon's text was checked against the official D-BT06/098EN card list; the other three use the catalog text and are not labeled official-text checked. Unsupported sibling abilities remain unavailable and no whole card is marked complete."
  })
});
Object.defineProperty(definitions, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = definitions;
