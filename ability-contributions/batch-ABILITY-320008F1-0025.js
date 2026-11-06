"use strict";

const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const batchId = "ABILITY-320008F1-0025";
const workerOwner = "agent-batch-0025";
const abilityIds = Object.freeze([
  "cfa-10665:0", "cfa-10665:1", "cfa-10666:0", "cfa-10667:0", "cfa-10669:0",
  "cfa-10670:0", "cfa-10671:0", "cfa-10672:0", "cfa-10673:0", "cfa-10674:0",
  "cfa-10675:0", "cfa-10676:0", "cfa-10677:0", "cfa-10678:0", "cfa-10679:0",
  "cfa-10679:1", "cfa-1067:0", "cfa-1067:1", "cfa-10680:0", "cfa-10681:0",
  "cfa-10682:0", "cfa-10684:0", "cfa-10685:0", "cfa-10686:0", "cfa-10686:1",
  "cfa-10687:0", "cfa-10688:0", "cfa-10689:0", "cfa-10689:1", "cfa-1068:0",
  "cfa-1068:1"
]);

const implementedAbilityIds = Object.freeze(["cfa-10680:0", "cfa-10681:0"]);
const proposedDefinitions = Object.freeze([
  {
    id: "cfa-10680:0",
    cardId: "cfa-10680",
    kind: "CONT",
    printedText: "CONT [RC]: During your turn, if you have \"Bulky Saw Stag\" on your RC, this unit gets power +10000.",
    requiredLocation: ["rear-guard"],
    conditionsReviewed: true,
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "cont-rc-controlled-rearguard-named-unit-power-v1",
      review: "Exact RC CONT. During the controller's turn, this source gains 10000 power only while a controller-owned rear-guard with the exact card name Bulky Saw Stag is on an RC."
    },
    effects: [{
      op: "continuous-power",
      target: "source",
      amount: 10000,
      duration: "continuous",
      condition: {
        op: "all",
        conditions: [
          { op: "controller-turn" },
          { op: "controller-rearguard-has-card-name", name: "Bulky Saw Stag" }
        ]
      }
    }]
  },
  {
    id: "cfa-10681:0",
    cardId: "cfa-10681",
    kind: "CONT",
    printedText: "CONT [RC]: During your turn, if you have \"Burly Axe Beetle\" on your RC, this unit gets power +10000.",
    requiredLocation: ["rear-guard"],
    conditionsReviewed: true,
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Cardfight Area snapshot",
      snapshotDate: "2025-05-09",
      patternId: "cont-rc-controlled-rearguard-named-unit-power-v1",
      review: "Exact RC CONT. During the controller's turn, this source gains 10000 power only while a controller-owned rear-guard with the exact card name Burly Axe Beetle is on an RC."
    },
    effects: [{
      op: "continuous-power",
      target: "source",
      amount: 10000,
      duration: "continuous",
      condition: {
        op: "all",
        conditions: [
          { op: "controller-turn" },
          { op: "controller-rearguard-has-card-name", name: "Burly Axe Beetle" }
        ]
      }
    }]
  }
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10666:0", "cfa-10672:0", "cfa-10673:0", "cfa-10674:0", "cfa-10675:0",
  "cfa-10676:0", "cfa-1068:0", "cfa-1068:1"
]);

const blockerById = Object.freeze({
  "cfa-10665:0": "The RC placement AUTO needs an Eugene Vanguard, Counter Blast 1 plus a hand discard, and a deck search filtered to grade-3 Normal Orders without Regalis Piece, followed by reveal, add, and shuffle. No existing trusted resolver validates that complete filter and ordered effect.",
  "cfa-10665:1": "This once-per-turn main-phase AUTO must identify an opponent Rear-Guard retired by this player's card ability, then pay Soul Blast 1 and stand/grant Boost to this exact source. Current trusted events do not carry the exact retirement cause and source linkage required.",
  "cfa-10669:0": "This CONT grants +5000 to every friendly Cassatella and Spumone on RC during the controller's turn. The current named-unit continuous handler modifies its own source only; it does not apply this effect to all matching friendly units.",
  "cfa-10670:0": "The placement must be specifically from hand, pay Soul Blast 2, inspect seven cards, select only Spumone, call to the same column, then shuffle. No existing trusted handler combines this origin, exact name filter, column constraint, and ordered search/call.",
  "cfa-10671:0": "The exact source must boost Divine Sister, Cassatella; then draw, select a hand card and put it on deck bottom, and grant the source +2000 until end of turn. There is no trusted handler for the full boost relation and ordered hand/deck choices.",
  "cfa-10667:0": "The attack AUTO pays Counter Blast 1 and flips a G-zone card, unlocks any number of locked cards owned by either player, and grants a friendly Rear-Guard power for each card unlocked. Existing unlock handling does not implement this cross-player choice and count-based effect atomically.",
  "cfa-10677:0": "This hand-discard AUTO requires the exact discarded source during its controller's turn, a Youthberk Vanguard, Counter Blast 1, and an opponent Rear-Guard selected and put on the bottom of that opponent's deck. No trusted definition covers this discard provenance and ordered target movement.",
  "cfa-10678:0": "This AUTO requires the exact source to be in back-row center RC when a Vanguard is placed on VC by RevolDress; it then stands that source and grants +10000 through turn end. Placement events do not preserve trusted RevolDress causation plus the source's center-circle identity.",
  "cfa-10679:0": "This front-row RC AUTO triggers only on a Vanguard placement caused by RevolDress, then chooses a Vanguard and grants +5000 until turn end. The event model does not validate RevolDress causation for this placement.",
  "cfa-10679:1": "This own-attack AUTO requires the attack target to be grade 3 or greater, pays Soul Blast 1 filtered to a RevolForm card, and grants +10000 for the battle. No trusted handler combines target-grade and filtered Soul cost for this exact attacking source.",
  "cfa-1067:0": "The Limit Break ACT requires Vanguard location, four or more damage, Counter Blast 2, and retiring exactly two friendly Gold Paladin Rear-Guards before applying +10000 power and +1 critical through turn end. No existing trusted ACT handler enforces this full cost and clan filter.",
  "cfa-1067:1": "This Vanguard ACT pays Counter Blast 1 and discards a same-name card from hand, then reveals up to four deck cards, selects up to two Gold Paladin to separate open circles, and orders the rest on the bottom. The complete reveal, two calls, and bottom-order choice are unsupported.",
  "cfa-10682:0": "This Drop-zone CONT conditionally changes this exact card's grade while its controller has a Bavsargra Vanguard. Current continuous grade handling does not implement this source-zone-specific, named-Vanguard grade modification.",
  "cfa-10684:0": "The rode-upon AUTO requires this exact Grade 1 source to be ridden by Genius Wise Wolf, Granfia and optionally call a Plant token. The token creation path is not an existing trusted operation for Plant tokens.",
  "cfa-10685:0": "This VC CONT replaces the normal ride-deck discard only when both a Plant token is on RC and Future Suzerain, Granfia is in Soul, for a Grade 3+ Granfia ride. The current ride-cost validator does not model this conditional replacement.",
  "cfa-10686:0": "This once-per-turn ACT pays Soul Blast 1, converts all Plant tokens to attached plant gauges, calls a Noblesserose token to back-row center, then attaches every gauge to it. Token conversion, gauge ownership, and ordered transfer are not represented by trusted handlers.",
  "cfa-10686:1": "At the end of this Vanguard's own attack, this AUTO may put a total of up to five Noblesserose tokens/gauges into Drop, then gives one Rear-Guard +5000 per card and stands it at three or more. The game does not represent these token/gauge costs and thresholded sequential effects.",
  "cfa-10687:0": "This CONT combines movement prevention, mandatory replacement of Plant-token calls with gauges on this unit, power per attached gauge, and optional gauge-discard substitution for eligible retire costs. These are separate continuous restriction, replacement, attachment, and cost-payment systems that are not implemented together.",
  "cfa-10688:0": "This ACT puts the exact source into Soul, calls up to two Plant tokens, and conditionally grants a chosen Rear-Guard +5000 under a Grade 3+ Granfia Vanguard. Plant token creation and the conditional target sequence are not supported by current trusted handlers.",
  "cfa-10689:0": "This placement AUTO may call a Plant token. The engine's token creation support is restricted to other reviewed token types and has no trusted Plant-token operation.",
  "cfa-10689:1": "This front-row AUTO triggers at battle-phase start only with a Granfia Vanguard and may call a Plant token. Both the exact phase-start source event and trusted Plant-token creation are missing."
});

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const abilityById = new Map();
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))];
for (const cardId of cardIds) {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Batch card missing from catalog: ${cardId}`);
  for (const ability of Engine.parseCardAbilitiesCached(card)) abilityById.set(ability.id, ability);
}
for (const definition of proposedDefinitions) {
  const ability = abilityById.get(definition.id);
  if (!ability || ability.cardId !== definition.cardId || ability.kind !== definition.kind || ability.printedText !== definition.printedText) {
    throw new Error(`Proposed definition does not exactly match catalog ability ${definition.id}`);
  }
}

const contribution = [...proposedDefinitions];
const proposedById = new Map(proposedDefinitions.map(definition => [definition.id, definition]));
const supportedDefinitions = Object.freeze([...alreadySupportedAbilityIds.map(abilityId => {
  const ability = abilityById.get(abilityId);
  if (!ability?.definition) throw new Error(`Expected pre-existing definition missing: ${abilityId}`);
  if (["AUTO", "ACT"].includes(ability.kind) && !Reducer.supportsServerAbilityEffects(ability)) throw new Error(`Expected trusted server handler missing: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, patternId: ability.definition.source?.patternId || null, implementationStatus: "already-supported-in-production", definition: ability.definition });
}), ...proposedDefinitions.map(definition => Object.freeze({ abilityId: definition.id, kind: definition.kind, catalogPrintedText: definition.printedText, patternId: definition.source.patternId, implementationStatus: "implemented-in-contribution", definition }))]);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedAbilityIds.includes(id) && !proposedById.has(id)).map(abilityId => {
  const ability = abilityById.get(abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) throw new Error(`Expected exact unsupported ability and blocker: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, officialReference: null, blocker: blockerById[abilityId] });
}));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = cardsById.get(cardId);
  return Object.freeze({ cardId, name: card.name, grade: Number(card.grade), type: card.type || null, nation: card.nation || null, catalogSource: card.source || "Cardfight Area catalog" });
}));

const officialTextReferences = Object.freeze({
  "cfa-10665:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2FFR01EN",
  "cfa-10665:1": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2FFR01EN",
  "cfa-10666:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F060EN",
  "cfa-10667:0": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2FFFR18EN",
  "cfa-10669:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F081EN",
  "cfa-10670:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F084EN",
  "cfa-10671:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F088EN",
  "cfa-10672:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F039EN",
  "cfa-10673:0": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe12EN",
  "cfa-10674:0": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe19EN",
  "cfa-10675:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F051EN",
  "cfa-10676:0": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe29EN",
  "cfa-10677:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F082EN",
  "cfa-10678:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F032EN",
  "cfa-10679:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F011EN",
  "cfa-10679:1": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F011EN",
  "cfa-1067:0": "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F007EN",
  "cfa-1067:1": "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F007EN",
  "cfa-10682:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F059EN",
  "cfa-10684:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F094EN",
  "cfa-10685:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F092EN",
  "cfa-10686:0": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F013EN",
  "cfa-10686:1": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F013EN",
  "cfa-1068:0": "https://en.cf-vanguard.com/cardlist/?cardno=PR%2F0069EN",
  "cfa-1068:1": "https://en.cf-vanguard.com/cardlist/?cardno=PR%2F0069EN"
});

const audit = Object.freeze({
  batchId,
  workerOwner,
  status: "reviewed-contribution-not-integrated",
  dataset: "Cardfight Area local card catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  officialTextChecked: true,
  officialTextVerificationNote: "Official Bushiroad card-list entries confirming the wording are recorded per ID below. No official card-list entry was located for Burly Axe Beetle or Bulky Saw Stag; their definitions preserve the local snapshot text without an official-text claim. Granfia token abilities are outside the exact official card-list confirmations and are not marked text-verified here.",
  officialTextReferences,
  officialTextVerifiedAbilityIds: Object.freeze(Object.keys(officialTextReferences)),
  officialTextUnlocatedAbilityIds: Object.freeze(["cfa-10680:0", "cfa-10681:0", "cfa-10687:0", "cfa-10688:0", "cfa-10689:0", "cfa-10689:1"]),
  abilityIds,
  implementedAbilityIds,
  alreadySupportedAbilityIds,
  supportedDefinitions,
  cards,
  unsupportedSiblings,
  proposedDefinitions,
  verifiedOfficialAbilities: Object.freeze([]),
  provenanceNote: "Definition printedText values exactly match the local catalog. Two definitions reuse the existing named-ally Rear-Guard continuous-power evaluator. Twenty-one unsupported abilities have concrete blockers. Official text references confirm wording only; no ability or card is thereby marked fully verified. This batch does not mark any card fully verified."
});

Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });
module.exports = contribution;
