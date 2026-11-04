"use strict";

// Retain the official-text audit and integrated definitions as contribution
// evidence. Runtime definitions live in ability-definitions.js.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10086:0", "cfa-10087:0", "cfa-10087:1", "cfa-10089:0", "cfa-10089:1",
  "cfa-10090:0", "cfa-10090:1", "cfa-10091:0", "cfa-10091:1", "cfa-10091:2",
  "cfa-10092:0", "cfa-10093:0", "cfa-10096:0", "cfa-10097:0", "cfa-10098:0",
  "cfa-1009:0", "cfa-10100:0", "cfa-10101:0", "cfa-10102:0", "cfa-10106:0",
  "cfa-10107:0", "cfa-10108:0", "cfa-10109:0", "cfa-10110:0", "cfa-10110:1",
  "cfa-10111:0", "cfa-10112:0", "cfa-10113:0", "cfa-10114:0", "cfa-10114:1",
  "cfa-1011:0", "cfa-101:0", "cfa-101:1"
]);

const integratedDefinitions = [
  Object.freeze({
    id: "cfa-10089:0",
    cardId: "cfa-10089",
    kind: "AUTO",
    printedText: "AUTO: When this unit is rode upon by \"Brilliant Tune, Rektina\", you may call this card to RC.",
    trigger: {
      status: "recognized-trigger",
      eventType: "card.ridden",
      subject: "ridden-unit",
      circles: ["vanguard"],
      riderCardNameEquals: "Brilliant Tune, Rektina"
    },
    conditionsReviewed: true,
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    source: {
      dataset: "Bushiroad official card list",
      snapshotDate: "2025-05-09",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS06%2F003EN",
      patternId: "auto-rode-upon-named-rider-optional-source-call-v1",
      review: "Exact optional AUTO on the previously ridden Vanguard. The ride event must target this exact source, identify Brilliant Tune, Rektina as the rider, and move the source from Vanguard to its controller's Soul; accepting calls that source standing to an open RC."
    },
    effects: [{ op: "call-source-from-soul", target: "source", position: "stand" }]
  }),
  Object.freeze({
    id: "cfa-10102:0",
    cardId: "cfa-10102",
    kind: "ACT",
    printedText: "ACT [RC] 1/Turn: If your vanguard is grade 3 or greater, COST [Counter Blast 2], and draw a card.",
    activationWindow: "main",
    requiredLocation: ["rear-guard"],
    conditions: [{ type: "controller-vanguard-grade-at-least", count: 3 }],
    conditionsReviewed: true,
    costs: [{ type: "counter-blast", count: 2 }],
    costsReviewed: true,
    choicesReviewed: true,
    once: true,
    usageRestriction: { type: "once-per-turn", scope: "ability-instance", reset: "turn" },
    source: {
      dataset: "Bushiroad official card list",
      snapshotDate: "2025-05-09",
      officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=193&view=text",
      patternId: "act-rc-grade-three-counter-blast-draw-v1",
      review: "Exact RC ACT template. It is available to its controller during Main Phase only with a grade 3 or greater Vanguard, costs Counter Blast 2, draws one card, and is once per turn for this ability instance."
    },
    effects: [{ op: "draw", count: 1 }]
  })
];

const blockerById = Object.freeze({
  "cfa-10086:0": "The effect needs an exact unboosted RC attack by this source, a Greedon Vanguard name check, a private choice of up to four matching normal units from Drop, deck return and shuffle, and +10000 only when four are returned. The current reviewed handlers do not combine those source, filter, count, and conditional battle-power steps.",
  "cfa-10087:1": "This CONT Sentinel text combines the one-copy deck restriction, an opponent Triple Drive alternate-cost condition, a grade-limited discard cost, a cannot-be-hit protection choice, and removing this card. No registered handler executes this complete Guardian action or its restrictions.",
  "cfa-10089:1": "The source gains power only during a battle where it boosted a Vanguard. The existing continuous handler tracks that this source boosted, but does not retain the required Vanguard target identity for this wording.",
  "cfa-10090:0": "This ride AUTO needs the exact Lianorn rider, Soul Blast 1, and a choice of a grade 1 or less card from Drop to call to RC. The available ride-call effect calls the ridden source itself from Soul, not a filtered Drop target.",
  "cfa-10090:1": "The CONT grants Boost only while the controller has at least three back-row Rear-Guards. The continuous keyword evaluator has no supported back-row count condition for this grant.",
  "cfa-10091:0": "This ride-time CONT changes the card's recognized name only while evaluating a ride. The production name and ride legality checks do not apply this alias to the exact source instance at that timing.",
  "cfa-10091:1": "The Vanguard attack AUTO must pay Soul Blast 1 and a discard, boost with all eligible standing back-row units, count how many actually boosted it, conditionally add drive, and then stand two back-row units at battle end. No existing handler validates this complete ordered battle sequence.",
  "cfa-10091:2": "This CONT grants power while the source itself is being boosted. The available source-boosted continuous condition describes the source as a booster, which is the opposite event relationship.",
  "cfa-10092:0": "The attack, Counter Blast 1, and battle power use existing primitives, but the required three-or-more back-row Rear-Guard condition has no supported positive count evaluator in the ability engine.",
  "cfa-10098:0": "The attack-this-booster-hit trigger is not recognized as an authoritative event. The resolution also needs to pay by moving a grade 2 or less hand card into Soul before drawing; no reviewed definition validates the hit identity and filtered hand cost together.",
  "cfa-10100:0": "The AUTO requires front-row hand placement, three back-row Rear-Guards, Counter Blast 1, a draw, and a separate opposing-Vanguard-grade condition for turn power. The back-row positive count is unsupported and the parsed grade condition is not safe for this ordered effect.",
  "cfa-10106:0": "This ability creates a battle-long restriction on how many cards the opponent may call through Prison's ability. The reducer has no trusted Prison-specific call restriction that expires at the end of this battle.",
  "cfa-10107:0": "The boosted-hit ability depends on Final Rush, pays Counter Blast 1, returns the exact boosted Rear-Guard to deck bottom, draws, and powers another friendly unit. The exact Final Rush state, boosted-source identity, and ordered effect sequence are not all covered by existing handlers.",
  "cfa-10108:0": "The hand placement AUTO pays by moving another Rear-Guard into Soul, then privately looks at the deck top and chooses between calling it or putting it into Soul. No reviewed effect handler supports that branch choice after the exact payment.",
  "cfa-10109:0": "This battle-close AUTO requires a Seraph Vanguard attack, Counter Blast 2, standing this source, then an opponent choice between calling an imprisoned grade 1+ card or returning it to hand. Prison ownership, opponent choice, and the combined timing are unsupported.",
  "cfa-10110:0": "This attack ability prevents calls specifically through Prison's ability until the opponent's next turn ends. The reducer has no trusted Prison-call restriction with that duration and scope.",
  "cfa-10110:1": "On retirement from RC or GC, the opponent must choose two of their Prison cards and separately call each to RC or return each to hand. The reducer does not model this Prison-zone state or the two mandatory opponent choices.",
  "cfa-10111:0": "The effect depends on same-time Soul Blast payment provenance for another card ability, then branches at three cards into Counter Blast, a Drop-to-Soul choice, and grade-matched opponent Rear-Guard retirement. Payment provenance and the conditional sequence are unsupported.",
  "cfa-10112:0": "The Soul-to-RC placement AUTO requires a Bruce Vanguard and power equal to 10000 for every two cards in the controller's Damage Zone. No existing effect calculates this placement-time, damage-count-scaled modifier.",
  "cfa-10113:0": "The once-per-turn attack ability grants power based on Damage count, then conditionally Soul Charges by that count and calls up to the same number of those exact cards. Count-derived quantity and identity tracking across the ordered Soul Charge/call are unsupported.",
  "cfa-10114:0": "The ACT requires Soul Charge 2 and then checks the grades of precisely those two charged cards before an optional draw. The engine does not expose a trusted result condition for the cards produced by Soul Charge.",
  "cfa-10114:1": "The attack AUTO requires Soul Blast 4 with distinct grades, setting the opposing Vanguard's power to 1 while preserving later modifiers, and conditionally adding critical. Distinct-grade cost validation and set-power layering are unsupported.",
  "cfa-1011:0": "The attack may be from VC or RC with empty Soul, then draws and puts a selected hand card on deck bottom. The engine lacks the required chosen-hand-to-deck-bottom operation for this exact sequence.",
  "cfa-101:0": "The Limit Break ACT grants a temporary nested Vanguard AUTO that checks third-or-later battle hits and stands up to two Aqua Force Rear-Guards. The reducer cannot register and expire this granted trigger with its printed timing and target limits.",
  "cfa-101:1": "The AUTO requires the Vanguard to attack in the third or later battle of the turn. Attack counts are tracked for some actions, but the ability condition and its authoritative battle-history check are not represented by a trusted handler."
});

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))];
const parsedById = new Map();
for (const cardId of cardIds) {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Assigned batch card missing from local catalog: ${cardId}`);
  for (const ability of Engine.parseCardAbilities(card)) parsedById.set(ability.id, ability);
}

const integratedAbilityIds = Object.freeze(integratedDefinitions.map(definition => definition.id));
const alreadySupportedAbilityIds = Object.freeze([
  ...integratedAbilityIds, "cfa-10087:0", "cfa-10093:0", "cfa-10096:0", "cfa-10097:0", "cfa-1009:0", "cfa-10101:0"
].sort());
const alreadySupportedIds = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedIds.has(id)).map(abilityId => {
  const ability = parsedById.get(abilityId);
  const blocker = blockerById[abilityId];
  if (!ability || !blocker) throw new Error(`Missing exact catalog ability or concrete blocker: ${abilityId}`);
  if (ability.definition) throw new Error(`Unexpected production definition for blocked ability: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, blocker });
}));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const ability = parsedById.get(abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing for ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled production definition" });
}));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = cardsById.get(cardId);
  return Object.freeze({ cardId, name: card.name, grade: Number(card.grade), type: card.type || null,
    clan: card.clan || (card.clans || []).join(" / "), nation: card.nation || null,
    catalogSource: card.source || "Cardfight Area snapshot 2025-05-09" });
}));

const audit = Object.freeze({
  batchId: "ABILITY-320008F1-0004",
  status: "2-integrated-6-already-supported-25-unsupported",
  dataset: "Cardfight Area local card catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  officialTextChecked: true,
  officialTextVerifiedAbilityIds: Object.freeze(["cfa-10089:0", "cfa-10093:0", "cfa-10102:0"]),
  abilityIds,
  implementedAbilityIds: integratedAbilityIds,
  integratedDefinitionAbilityIds: integratedAbilityIds,
  proposedDefinitionAbilityIds: Object.freeze([]),
  alreadySupportedAbilityIds,
  supportedProductionDefinitions,
  cards,
  unsupportedSiblings,
  integratedDefinitions: Object.freeze(integratedDefinitions),
  provenanceNote: "The two integrated ability texts were checked against their linked Bushiroad official card-list entries and added to the shared production registry. Remaining text is preserved from the local Cardfight Area catalog snapshot dated 2025-05-09 and was not independently verified. No whole card is claimed complete."
});

const contribution = [];
Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });
module.exports = contribution;
