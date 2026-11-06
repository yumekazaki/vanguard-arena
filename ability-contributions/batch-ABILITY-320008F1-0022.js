"use strict";

// Batch 0022 review. Exact Jakumetsu Arcs AUTOs and one Set Order-count AUTO
// use strict source events and validated instance movement. Other unsupported siblings remain explicit.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const batchId = "ABILITY-320008F1-0022";
const workerOwner = "agent-batch-0022";
const abilityIds = Object.freeze([
  "cfa-10577:0", "cfa-10578:0", "cfa-10580:0", "cfa-10580:1", "cfa-10581:0", "cfa-10581:1",
  "cfa-10582:0", "cfa-10582:1", "cfa-10583:0", "cfa-10584:0", "cfa-10584:1", "cfa-10585:0",
  "cfa-10585:1", "cfa-10586:0", "cfa-10587:0", "cfa-10589:0", "cfa-1058:0", "cfa-1058:1",
  "cfa-10590:0", "cfa-10590:1", "cfa-10591:0", "cfa-10591:1", "cfa-10592:0", "cfa-10593:0",
  "cfa-10594:0", "cfa-10595:0", "cfa-10597:0", "cfa-10599:0", "cfa-10599:1", "cfa-1059:0",
  "cfa-1059:1", "cfa-10600:0", "cfa-10600:1", "cfa-10601:0", "cfa-10601:1", "cfa-10601:2",
  "cfa-1060:0", "cfa-1060:1", "cfa-1060:2", "cfa-106:0"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-1058:1", "cfa-1059:0", "cfa-106:0"]);
const implementedAbilityIds = Object.freeze(["cfa-10584:0", "cfa-10584:1", "cfa-10586:0", "cfa-10593:0"]);
const definitionText = "AUTO: When this unit is placed on RC from bind zone, this unit gets power +5000 until end of turn.";
const cardsById = new Map(loadCatalog().map(card => [String(card.id), card]));
const dubthachCard = cardsById.get("cfa-10593");
const dubthachDefinition = dubthachCard && Engine.parseCardAbilitiesCached(dubthachCard).find(ability => ability.id === "cfa-10593:0")?.definition;
if (!dubthachDefinition || dubthachDefinition.source?.patternId !== "auto-rc-deck-placement-by-vanguard-ability-boost-power-turn-v1") {
  throw new Error("Dubthach's exact deck-placement AUTO did not compile through the reviewed Vanguard ability pattern.");
}
const proposedDefinitions = Object.freeze([Object.freeze({
  id: "cfa-10584:0",
  cardId: "cfa-10584",
  kind: "AUTO",
  printedText: definitionText,
  requiredLocation: ["rear-guard"],
  trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"], sourceLocation: "bind" },
  conditions: [],
  costs: [],
  optional: false,
  conditionsReviewed: true,
  costsReviewed: true,
  choicesReviewed: true,
  source: {
      dataset: "Bushiroad official card list",
      snapshotDate: "2026-11-03",
      officialCardNumber: "D-BT08/017EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT08%2F017EN",
    patternId: "auto-bind-zone-placement-source-power-turn-v1",
      review: "Official card-list text confirmed. Only this exact card instance placed from the Bind Zone onto a Rear-Guard Circle triggers; its controller gives it +5000 until end of turn. The second, attack-triggered AUTO on the card is outside this definition and remains separately audited."
  },
  effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }]
}), Object.freeze({
  id: "cfa-10584:1",
  cardId: "cfa-10584",
  kind: "AUTO",
  printedText: "AUTO [RC]: When this unit attacks, COST [Soul Blast 1], choose a card from your opponent’s bind zone, and put it on the bottom of their deck.",
  requiredLocation: ["rear-guard"],
  trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", circles: [] },
  conditions: [],
  costs: [{ type: "soul-blast", count: 1 }],
  optional: true,
  conditionsReviewed: true,
  costsReviewed: true,
  choicesReviewed: true,
  source: {
    dataset: "Bushiroad official card list",
    snapshotDate: "2026-11-04",
    officialCardNumber: "D-BT08/017EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT08%2F017EN",
    patternId: "auto-rc-own-attack-opponent-bind-zone-to-own-deck-bottom-v1",
    review: "Official card-list text confirmed. This exact Rear-Guard's own unit.attacked event creates the AUTO. Its controller may pay Soul Blast 1; on payment, they choose a card physically in the opponent's Bind Zone and put that exact instance on the bottom of that zone controller's Deck. No prompt is offered if the cost or a legal Bind Zone target is unavailable."
  },
  effects: [{ op: "put-target-to-zone-controller-deck-bottom", target: "chosen", destination: "target-zone-controller-deck-bottom", targetFilter: { controller: "opponent", zone: "bind" } }]
}), Object.freeze({
  id: "cfa-10586:0",
  cardId: "cfa-10586",
  kind: "AUTO",
  printedText: "AUTO: When this unit is placed on RC, if your order zone has two or more set orders, you may Soul Charge 1.",
  requiredLocation: ["rear-guard"],
  trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] },
  conditions: [{ type: "controller-set-order-count-at-least", count: 2 }],
  costs: [],
  optional: true,
  canDecline: true,
  conditionsReviewed: true,
  costsReviewed: true,
  choicesReviewed: true,
  source: {
    dataset: "Bushiroad official card list",
    snapshotDate: "2026-11-04",
    officialCardNumber: "D-BT08/042EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT08%2F042EN",
    rulesReference: "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
    patternId: "auto-rc-placement-set-order-count-optional-soul-charge-v1",
    review: "Official card-list wording confirmed. The AUTO is eligible only when this exact instance is placed from a non-circle zone onto an RC and its controller's own Order Zone currently contains at least two Set Order cards. The controller may decline; accepting resolves Soul Charge 1. Ordinary orders and the opponent's Set Orders do not count."
  },
  effects: [{ op: "soul-charge", count: 1 }]
}), Object.freeze(dubthachDefinition)]);

const blockerById = Object.freeze({
  "cfa-10577:0": "This AUTO requires this source to move from RC into Soul, at least four face-down damage cards, then binds that same Soul instance and Counter Charges. The event pipeline does not expose a trusted bind-from-Soul action with the source's prior RC location and face-down damage count as one exact trigger resolution.",
  "cfa-10578:0": "This hand-to-RC AUTO pays Counter Blast 1 and searches a variable top-five set for a card whose name differs from every Soul card, then moves that card to Soul and shuffles. The shared search handler does not support the Soul-name exclusion plus Deck-to-Soul destination as this exact sequence.",
  "cfa-10580:0": "This Vanguard placement AUTO looks at five cards, filters Normal Units with Stealth in their names, reveals up to two, puts one chosen card into Soul, binds the other revealed card, and shuffles. The resolver lacks this ordered multi-zone selection and split destination program.",
  "cfa-10580:1": "This Bind Zone ACT requires a grade 1+ Stealth Vanguard, Soul Blast 1, then calls this exact Bind Zone instance to a legal RC. The available manual activation flow does not provide a trusted Bind Zone source activation and call for this ability.",
  "cfa-10581:0": "This Vanguard placement AUTO looks at five cards, filters Normal Units with Stealth in their names, reveals up to two, puts one chosen card into Soul, calls the remaining revealed cards to RC, and shuffles. The resolver does not support the exact split between one Soul card and the remaining calls.",
  "cfa-10581:1": "This Bind Zone ACT requires a grade 2+ Stealth Vanguard, Soul Blast 1, then calls this exact Bind Zone instance to a legal RC. The current manual ability source-zone and call validation do not cover it.",
  "cfa-10582:0": "This once-per-turn Vanguard ACT binds two named Soul cards as cost, selects two opponent circles and binds every card there, then returns those exact cards to the opponent's hand at turn end. It needs circle selection, multiple-card binding, and delayed opponent-owned returns not implemented as one trusted effect.",
  "cfa-10582:1": "This Vanguard attack AUTO requires an attack on Vanguard, Counter Blast 1, and moving two friendly Rear-Guards into Soul as cost, then calls a named card from Bind and conditionally grants it power. The source-cost move, Bind search/call, and exact Vanguard target condition are unsupported together.",
  "cfa-10583:0": "This hand-placement AUTO pays Counter Blast 1 and lets the opponent choose a card in their Bind Zone to put on Deck bottom; if that does not happen, it calls a grade/name-filtered friendly Bind card. Opponent-owned target selection and the conditional fallback call are not supported together.",
  "cfa-10585:0": "This placement AUTO only triggers when another card ability placed this source on RC, checks for a Tamayura or Shojodoji Vanguard, pays Soul Blast 1, and draws. The structured placement event does not retain a trusted causal ability-source identity for this exact restriction.",
  "cfa-10585:1": "This RC CONT depends on a turn-history count of cards moved from RC to Soul being at least two, then grants this source +10000. The authoritative state does not track and continuously evaluate that exact movement history.",
  "cfa-10587:0": "This attack AUTO pays Soul Blast 1, has the opponent choose up to three Drop cards to bind, and grants +10000 only if fewer than three were bound. The opponent-owned multi-card choice and count-dependent branch are not represented in a trusted effect program.",
  "cfa-10589:0": "This RC placement AUTO discards a card, looks at a number of cards equal to distinct Research cards in the Order Zone, selects one into hand, and shuffles. Dynamic look count, distinct-name counting, and the discard/search sequence are not supported together.",
  "cfa-1058:0": "This Limit Break AUTO activates at the guard step when this Vanguard is attacked, optionally pays Counter Blast 1 and discards a same-name hand card, then selects an attacker for -20000 through battle. The exact guard-step timing, named discard cost, and opposing attacker modifier are not supported by a trusted handler.",
  "cfa-10590:0": "This RC/GC CONT grants both +5000 power and +5000 shield, including on the opponent's turn, when the Order Zone has at least three Set Orders. The continuous evaluator does not support this exact set-order threshold and paired power/shield scope.",
  "cfa-10590:1": "This CONT changes attack legality so the unit battles every opposing front-row unit, but only if it was placed by an ability this turn and three Research cards are in the Order Zone. The battle target-selection rules do not implement this continuous multi-target attack condition.",
  "cfa-10591:0": "This RC placement AUTO pays Soul Blast 1 and privately searches the top seven for up to one Set Order to reveal and add to hand, then shuffles. The top-search operation is guarded to exact reviewed ability families and this card's filter is not admitted.",
  "cfa-10591:1": "This once-per-turn AUTO reacts when another unit is placed on RC by a card ability and grants this source Boost until turn end. The event lacks validated ability-causation data for the placement condition and no reviewed temporary keyword grant matches this ability.",
  "cfa-10592:0": "This end-of-battle AUTO requires this source to attack while boosted and at least three face-down damage cards, then moves the source to Soul and Counter Charges. The delayed exact boosted battle, damage-state condition, source cost movement, and resource effect are unsupported together.",
  "cfa-10594:0": "This RC own-attack AUTO grants +5000 for every two Research cards in the Order Zone until battle end. The source-power-per-count operation is restricted to reviewed count families and has no validated distinct Research-card threshold for this ability.",
  "cfa-10595:0": "This AUTO triggers when a Research card enters the Order Zone, retires this source as cost, and Counter Charges. The event pipeline does not identify Research card type on Order Zone entry in a trusted trigger, and no exact source-retire cost definition exists.",
  "cfa-10597:0": "This RC placement AUTO checks the Vanguard has exactly one clan, pays Soul Blast 1 and discards a card, then returns a Drop card with only that clan to hand. The effect resolver cannot validate this combined clan-identity filter and Drop-to-hand target.",
  "cfa-10599:0": "This ride AUTO requires the riding unit to have only Genesis as its clan, then privately looks at five cards and places up to two chosen cards into Soul before shuffling. The rider's exact clan identity and up-to-two top-five Soul selection are not supported together.",
  "cfa-10599:1": "This AUTO triggers when the source moves from Soul to Drop, checks a Minerva Vanguard, calls this exact source to back-row RC, and optionally Soul Charges if called. The moved-card event and conditional call outcome are not supported as a trusted sequence.",
  "cfa-1059:1": "This Vanguard ACT pays Counter Blast 1, chooses a grade 2+ Murakumo Rear-Guard, searches and calls a same-name copy, shuffles, and schedules that exact called card to Deck bottom at turn end. The same-name search/call and instance-specific delayed return are not supported together.",
  "cfa-10600:0": "This ride AUTO requires the rider to have only Genesis as its clan, then privately looks at five cards and places up to two chosen cards into Soul before shuffling. The exact rider clan filter and multi-card selection are not covered by an existing trusted definition.",
  "cfa-10600:1": "This AUTO triggers when a card moves from Soul to Drop during the controller's turn, checks for Minerva, pays Counter Blast 1, and calls the exact source to RC. Current movement events do not retain enough trusted source-zone and turn timing data for this costed call.",
  "cfa-10601:0": "This Vanguard CONT grants +5000 to every front-row unit on the controller's turn if Soul contains a Grade 3 Regalia card. The continuous evaluator lacks a matching grade-and-name Soul predicate paired with the row-wide modifier.",
  "cfa-10601:1": "This once-per-turn Vanguard ACT pays Soul Blast 1, privately looks at the top card, and lets the player choose whether to return it to the top or put it into Soul. The resolver does not expose a private inspect-and-choose-top-or-Soul effect.",
  "cfa-10601:2": "This once-per-turn Vanguard AUTO resolves after its attack against a Grade 3+ Vanguard, pays Counter Blast 1, Soul Blast 3, and a Genesis-only discard, then stands this Vanguard and reduces its Drive through turn end. Exact close-step timing, clan-filtered discard, and drive modifier are not handled together.",
  "cfa-1060:0": "This Deck-placement AUTO optionally pays Counter Blast 1, then retires an opponent front-row Rear-Guard of grade 2 or greater. The current trusted placement-retirement definition does not match this card's Deck origin, optional cost, and exact target filter.",
  "cfa-1060:1": "This AUTO triggers at the end of a battle in which this exact Rear-Guard was attacked, then retires it. The event system does not expose a trusted end-of-battle event for the attacked Rear-Guard source instance.",
  "cfa-1060:2": "This CONT treats the card as also belonging to Gold Paladin. The game does not model a reviewed continuous clan-identity alias for this card instance."
});

const newIds = new Set(implementedAbilityIds);
const supportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !newIds.has(id) && !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) throw new Error(`Expected exact unsupported ability and blocker: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, catalogPrintedText: ability.printedText,
    officialPrintedText: null, officialReference: null, blocker: blockerById[abilityId] });
}));

const supportedDefinitions = Object.freeze([...alreadySupportedAbilityIds, ...implementedAbilityIds].map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const isNew = newIds.has(abilityId);
  const base = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  const definition = isNew ? proposedDefinitions.find(item => item.id === abilityId) : null;
  const ability = isNew ? { ...base, definition, trigger: definition.trigger, conditions: definition.conditions, costs: definition.costs,
    requiredLocation: definition.requiredLocation, canDecline: definition.optional === true, conditionStatus: "modeled",
    costStatus: definition.costs?.length ? "supported-cost" : "no-cost", choiceStatus: "modeled", effects: definition.effects } : base;
  if (!ability?.definition || (isNew ? !Reducer.supportsServerAbilityEffects(ability) : !Reducer.hasTrustedServerAbilityDefinition(ability, Engine)) ||
      (ability.kind === "AUTO" && !Reducer.supportsServerAbilityEffects(ability))) throw new Error(`Expected server-supported exact ability: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled definition", serverHandlerSupported: true,
    handlerSurface: ability.kind === "CONT" ? "authoritative continuous restriction evaluator" : "authoritative ability resolver",
    officialPrintedText: null, officialReference: null });
}));

module.exports = Object.freeze({ batchId, workerOwner, abilityIds, alreadySupportedAbilityIds, implementedAbilityIds,
  proposedDefinitions, supportedDefinitions, unsupportedSiblings, verifiedOfficialAbilities: Object.freeze([]) });
