"use strict";

// Batch 0087 review. One AUTO uses the existing event, condition, and battle
// power handlers; all other uncompiled abilities remain explicitly blocked.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const batchId = "ABILITY-320008F1-0087";
const workerOwner = "worker-batch-0087";
const abilityIds = Object.freeze([
  "cfa-12693:0", "cfa-12695:0", "cfa-12697:0", "cfa-12697:1", "cfa-12698:0", "cfa-12698:1",
  "cfa-12699:0", "cfa-12699:1", "cfa-12700:0", "cfa-12701:0", "cfa-12701:1", "cfa-12702:0",
  "cfa-12702:1", "cfa-12703:0", "cfa-12704:0", "cfa-12704:1", "cfa-12706:0", "cfa-12706:1",
  "cfa-12707:0", "cfa-12708:0", "cfa-12708:1", "cfa-1270:0", "cfa-1270:1", "cfa-12710:0",
  "cfa-12710:1", "cfa-12711:0", "cfa-12712:0", "cfa-12715:0", "cfa-12715:1", "cfa-12716:0",
  "cfa-12716:1", "cfa-12717:0", "cfa-12717:1", "cfa-12718:0", "cfa-1271:0", "cfa-12720:0",
  "cfa-1272:0", "cfa-1272:1", "cfa-127:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-12698:1", "cfa-1270:1", "cfa-1272:0", "cfa-1272:1"
]);
const implementedAbilityIds = Object.freeze(["cfa-12708:1"]);

const definitionText = "AUTO [RC]: When this unit attacks, if your opponent’s vanguard is grade 3 or greater, and your opponent has no rear-guards, this unit gets power +10000 until end of that battle.";
const proposedDefinitions = [Object.freeze({
  id: "cfa-12708:1",
  cardId: "cfa-12708",
  kind: "AUTO",
  printedText: definitionText,
  requiredLocation: ["rear-guard"],
  trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", circles: ["rear-guard"] },
  conditions: [
    { type: "opponent-vanguard-grade-at-least", count: 3 },
    { type: "opponent-has-no-rear-guards" }
  ],
  costs: [],
  optional: false,
  conditionsReviewed: true,
  costsReviewed: true,
  choicesReviewed: true,
  source: {
    dataset: "Bushiroad official card list",
    snapshotDate: "2025-05-09",
    officialCardNumber: "DZ-BT02/020EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT02%2F020EN",
    officialReferences: ["https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT02%2F020EN"],
    patternId: "auto-rc-own-attack-opponent-grade-no-rearguards-power-battle-v1",
    review: "Exact DZ-BT02/020EN AUTO. This exact Rear-Guard must attack; at trigger time the opposing Vanguard must be grade 3 or greater and the opponent must have no Rear-Guards. Only this source gets +10000 until that battle ends. The other printed AUTO on this card remains unsupported, so the card is not whole-card verified."
  },
  effects: [{ op: "modify-power", target: "source", amount: 10000, duration: "battle" }]
})];

const blockerById = Object.freeze({
  "cfa-12693:0": "This ACT requires an Order Zone Prison check, Soul Blast, opponent Rear-Guard selection and imprisonment, then a conditional +10000 fallback only when no card was imprisoned. The shared resolver lacks the Prison-specific target move and success-dependent branch as one validated cost/effect sequence.",
  "cfa-12695:0": "This RC CONT grants +5000 to all friendly Grade 0 Rear-Guards only during the controller's turn and only when no other Rear-Guard shares this card's name. The continuous evaluator does not combine this exact source-name exclusion with a grade-filtered multi-unit modifier.",
  "cfa-12697:0": "This ride AUTO searches the Deck for an Arena, reveals it, adds it to hand, and shuffles. No existing trusted ride-trigger definition covers the Arena card filter and exact ride-source timing.",
  "cfa-12697:1": "This AUTO requires another same-column Rear-Guard to stand specifically by a card ability, then grants that exact stood unit +5000 for the turn. The event model does not preserve the same-column relation and stand-cause identity together for a trusted target-power effect.",
  "cfa-12698:0": "This ride AUTO searches the top seven cards for either a grade-and-name-qualified unit or an Arena, reveals and adds one, shuffles, and optionally calls this source only if no card was revealed. The private OR-filtered search and conditional fallback are not a single trusted effect program.",
  "cfa-12699:0": "This Vanguard CONT grants +5000 to every front-row unit only during the controller's turn with at least three Arenas in the Order Zone. No trusted continuous handler combines Arena counting, row-wide scope, and turn timing for this source.",
  "cfa-12699:1": "This once-per-turn Vanguard AUTO pays Counter Blast 2 after its attack, draws, then stands a player-selected number of Rear-Guards equal to Arena count and grants +5000 only if at least three were chosen. The count-bound choice, stand, conditional modifier, and usage restriction are unsupported together.",
  "cfa-12700:0": "This Order Zone AUTO reacts to any friendly unit attack, checks the exact named Vanguard and whether a different Arena was not rested this battle, rests this source, and grants a nested hit AUTO with a choice of Counter Charge or Energy Charge. The order-zone source, battle rest history, and temporary nested hit ability are not represented by a trusted handler.",
  "cfa-12701:0": "This RC CONT grants the source +5000 when at least two Arenas are present. The current continuous evaluator does not provide an exact Arena-count condition for this modifier.",
  "cfa-12701:1": "At the end of this source's own attack, this AUTO checks the Vanguard grade and Arena rest history, pays Energy Blast 3, draws, and chooses another unit for +5000. The resolver lacks the exact battle-end event plus Arena-history condition and multi-step target sequence.",
  "cfa-12702:0": "This AUTO pays a name-filtered Drop-to-Soul cost when this source attacks a qualifying grade 3+ unit, scales power by the paid card's grade, then binds this source at battle end. The current program cannot validate the opponent target grade, selected cost card, variable modifier, and delayed bind as one sequence.",
  "cfa-12702:1": "This hit AUTO requires this source's attack to hit a grade 3+ Vanguard, then selects and retires an opponent Rear-Guard. The resolver does not have a trusted hit-trigger definition combining authoritative target grade and the opponent-owned retirement choice for this card.",
  "cfa-12703:0": "This end-of-battle AUTO requires this exact unit to have boosted, a grade 3+ Vanguard with a name condition, then binds the source and Energy Charges. The delayed boost-battle event, name fragment condition, source movement, and resource gain are not implemented together.",
  "cfa-12704:0": "This placement AUTO requires placement from hand and a token on a friendly RC, then pays Counter Blast 1 and draws. Existing handlers do not match this exact token-presence placement condition and cost.",
  "cfa-12704:1": "This CONT modifies both power on RC and shield on GC whenever a friendly token occupies an RC, including during the opponent's turn. The engine lacks a trusted two-zone continuous modifier with that board-wide token condition.",
  "cfa-12706:0": "This hand-to-RC placement AUTO performs Energy Charge 2. The generic parser does not compile the printed placement-source restriction into a reviewed definition, and there is no exact registered definition for this ability.",
  "cfa-12706:1": "At battle-phase start this AUTO checks the Vanguard grade and clan, pays Soul Blast 1, chooses a unit, and grants it a temporary nested own-attack AUTO. The temporary granted ability lifecycle and its exact later attack are not supported by an existing handler.",
  "cfa-12707:0": "This CONT grants Boost on RC under a named Vanguard condition and also grants a nested end-of-battle ability that moves this unit to Soul and gives another unit power. The conditional keyword grant plus temporary delayed ability is not modeled as a trusted program.",
  "cfa-12708:0": "This placement AUTO pays Energy Blast 3 and retires a number of opposing Rear-Guards equal to the opponent's Set Orders. The resolver lacks this variable-count, opponent-zone-derived target selection and retirement sequence.",
  "cfa-12710:0": "This placement AUTO asks the opponent to choose a Drop card to imprison, then only if they choose one pays Energy Blast 3 and draws. Opponent-private choice, Prison movement, and success-dependent cost/effect ordering are not supported together.",
  "cfa-1270:0": "This Limit Break attack AUTO optionally pays Counter Blast 2, Soul Charges, selects a Bermuda Triangle Rear-Guard to return to hand, and grants power through battle. No exact reviewed definition combines Limit Break, optional payment, clan target, and sequence.",
  "cfa-12710:1": "This attack AUTO checks a named grade 3+ Vanguard and at least five imprisoned opponent cards before paying Counter Blast and standing this source; at three imprisoned cards it separately grants turn power. Prison state and the thresholded two-branch attack effect are not represented by a trusted handler.",
  "cfa-12711:0": "This ACT pays Soul Blast and a hand discard, selects an Arena from Drop or face-up damage, and if taken from damage replaces it with the top Deck card. The resolver lacks the zone-choice target, damage replacement, and ordered resource costs in one atomic effect.",
  "cfa-12712:0": "This Vanguard-attack AUTO pays Energy Blast 4, has the opponent choose and retire a Rear-Guard, grants turn power, and Soul Charges 2 only if no card was retired. Opponent choice and outcome-dependent follow-up are not supported as a complete trusted sequence.",
  "cfa-12715:0": "This ride AUTO calls a named Bleucrea from Soul together with this source, then returns both exact instances to Soul at turn end. The two-source ride condition, paired calls, and delayed instance-specific return are unsupported together.",
  "cfa-12715:1": "This end-of-battle AUTO checks a named Vanguard after this source attacked, retires this source, and Counter Charges. The exact named-Vanguard battle-end source retirement and resulting resource event are not covered by a trusted definition.",
  "cfa-12716:0": "This rode-upon AUTO checks the grade/name of the riding unit and a named card in Soul, then draws two and bottoms a selected hand card. The exact rider identity, Soul condition, and sequential hand choice are not compiled by a trusted definition.",
  "cfa-12716:1": "This end-of-battle AUTO checks the named Vanguard, pays Soul Blast and retires this source, then chooses an opponent Rear-Guard to retire. The resolver lacks this exact combined cost and opponent target sequence.",
  "cfa-12717:0": "This ACT searches Deck or Soul for a low-grade name-fragment match, calls it, and shuffles only after a Deck search. Zone-dependent private search and conditional shuffle are not supported by a trusted handler.",
  "cfa-12717:1": "This Vanguard attack AUTO checks three chosen units have pairwise different names, pays Counter Blast, rides a named Soul card as stand while removing its AUTO abilities and scaling power by both players' damage, then schedules a rested ride-back. The rider-choice validation and multi-step temporary ride program are unsupported.",
  "cfa-12718:0": "This Guardian Circle AUTO pays a named-card Drop-to-deck-bottom cost and grants +10000 shield for the battle. The existing Guardian handlers do not cover this specific name-filtered cost with the shield effect.",
  "cfa-1271:0": "This placement AUTO is optional and requires a Bermuda Triangle Vanguard before paying Soul Blast 1; it then searches the top seven cards for another copy of Mirror Diva, Biscayne, reveals it, adds it to hand, and shuffles. No existing trusted definition covers this exact optional payment and filtered top-seven search.",
  "cfa-12720:0": "This Vanguard attack AUTO pays Counter Blast and puts a named card from Drop on Deck bottom, draws, then grants the team +5000. The ordered named cost, draw, and team-wide modifier are not available as a trusted complete effect.",
  "cfa-127:0": "This AUTO triggers only when the source itself becomes stand during its controller's battle phase, then grants +3000 until turn end. Although stand events exist, no reviewed handler in the current registry binds this exact source's own stand event and duration for this card."
});

const cardsById = new Map(loadCatalog().map(card => [String(card.id), card]));
const newlyImplementedSet = new Set(implementedAbilityIds);
const alreadySupportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !newlyImplementedSet.has(id) && !alreadySupportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) throw new Error(`Expected uncompiled exact ability and blocker: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, catalogPrintedText: ability.printedText,
    officialPrintedText: null, officialReference: null, blocker: blockerById[abilityId] });
}));

const supportedDefinitions = Object.freeze([...alreadySupportedAbilityIds, ...implementedAbilityIds].map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const isNewContribution = newlyImplementedSet.has(abilityId);
  const parsed = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  const definition = isNewContribution ? proposedDefinitions.find(item => item.id === abilityId) : parsed?.definition;
  const ability = isNewContribution && parsed && definition ? {
    ...parsed,
    requiredLocation: definition.requiredLocation,
    trigger: definition.trigger,
    conditions: definition.conditions,
    costs: definition.costs,
    canDecline: definition.optional === true,
    definition,
    effects: definition.effects
  } : parsed;
  if (!ability || !ability.definition ||
      (isNewContribution ? !Reducer.supportsServerAbilityEffects(ability) : !Reducer.hasTrustedServerAbilityDefinition(ability, Engine)) ||
      (ability.kind === "AUTO" && !Reducer.supportsServerAbilityEffects(ability))) throw new Error(`Expected exact supported ability and handler: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled definition", serverHandlerSupported: true,
    handlerSurface: ability.kind === "CONT" ? "authoritative continuous evaluator" : "authoritative ability resolver",
    officialPrintedText: isNewContribution ? ability.printedText : null,
    officialReference: isNewContribution ? ability.definition.source?.officialReference || null : null });
}));

const verifiedOfficialAbilities = Object.freeze(["cfa-12708:1"]);
Object.defineProperties(proposedDefinitions, {
  batchId: { value: batchId }, workerOwner: { value: workerOwner }, abilityIds: { value: abilityIds },
  alreadySupportedAbilityIds: { value: alreadySupportedAbilityIds }, implementedAbilityIds: { value: implementedAbilityIds },
  proposedDefinitions: { value: proposedDefinitions }, supportedDefinitions: { value: supportedDefinitions },
  unsupportedSiblings: { value: unsupportedSiblings }, verifiedOfficialAbilities: { value: verifiedOfficialAbilities }
});
module.exports = Object.freeze(proposedDefinitions);
