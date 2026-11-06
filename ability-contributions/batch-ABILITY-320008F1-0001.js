"use strict";

// This batch intentionally contributes only abilities whose complete effects
// can be represented by handlers already present in the production engine.
// The remaining records are retained as text-preserving audit entries below.
const Engine = require("../ability-engine.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10000:0", "cfa-10000:1", "cfa-10000:2", "cfa-10001:0", "cfa-10001:1",
  "cfa-10002:0", "cfa-10002:1", "cfa-10003:0", "cfa-10003:1", "cfa-10004:0",
  "cfa-10004:1", "cfa-10005:0", "cfa-10005:1", "cfa-10006:0", "cfa-10006:1",
  "cfa-10007:0", "cfa-10007:1", "cfa-10007:2", "cfa-10008:0", "cfa-10008:1",
  "cfa-10009:0", "cfa-10009:1", "cfa-1000:0", "cfa-10010:0", "cfa-10010:1",
  "cfa-10010:2", "cfa-10011:0", "cfa-10011:1", "cfa-10011:2", "cfa-10012:0",
  "cfa-10012:1", "cfa-10013:0", "cfa-10013:1", "cfa-10014:0", "cfa-10014:1",
  "cfa-10015:0", "cfa-10015:1", "cfa-10016:0", "cfa-10016:1", "cfa-10016:2",
  "cfa-10019:0", "cfa-10019:1", "cfa-1001:0", "cfa-10020:0", "cfa-10020:1",
  "cfa-10021:0", "cfa-10021:1", "cfa-10022:0", "cfa-10022:1", "cfa-1002:0",
  "cfa-100:0", "cfa-100:1"
]);

const definitions = [
  {
    id: "cfa-100:1",
    cardId: "cfa-100",
    kind: "AUTO",
    printedText: "AUTO [VC]: When this unit attacks a vanguard, this unit gets power +3000 until end of that battle.",
    requiredLocation: ["vanguard"],
    trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", targetLocation: "vanguard", circles: ["vanguard"] },
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Bushiroad official card list",
      officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=21&view=text",
      patternId: "auto-own-attack-vanguard-power-battle-v1",
      review: "The official BT08/006EN text is battle-duration, not turn-duration. Only this exact VC source attacking the opposing Vanguard receives +3000 for this battle; catalog UI attack-count hints are excluded from printed text."
    },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]
  },
  {
    id: "cfa-10016:0",
    cardId: "cfa-10016",
    kind: "CONT",
    printedText: "CONT [VC]: During your turn, if you have \"Spectral Duke Dragon\" in your soul, this unit gets power +10000, and if your opponent’s vanguard is grade 3 or greater, then it gets critical +1.",
    requiredLocation: ["vanguard"],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    source: {
      dataset: "Bushiroad official card list",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-VS06%2FSP03EN",
      patternId: "cont-vanguard-soul-name-power-critical-v1",
      review: "Exact D-VS06/SP03EN CONT text: the Vanguard gets +10000 only during its controller's turn with Spectral Duke Dragon in that controller's Soul; the additional +1 critical also requires the opposing Vanguard to be grade 3 or greater."
    },
    effects: [
      { op: "continuous-power", target: "source", amount: 10000, duration: "continuous", condition: { op: "all", conditions: [{ op: "controller-turn" }, { op: "soul-has-card-name", name: "Spectral Duke Dragon" }] } },
      { op: "continuous-critical", target: "source", amount: 1, duration: "continuous", condition: { op: "all", conditions: [{ op: "controller-turn" }, { op: "soul-has-card-name", name: "Spectral Duke Dragon" }, { op: "opponent-vanguard-grade-at-least", grade: 3 }] } }
    ]
  },
  {
    id: "cfa-1001:0",
    cardId: "cfa-1001",
    kind: "AUTO",
    printedText: "AUTO [RC]: During your battle phase, when this unit becomes stand, this unit gets power +3000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "unit.stood",
      subject: "event-subject",
      circles: ["rear-guard"],
      requiredPhase: "battle",
      turnRelation: "controller",
      subjectControllerRelation: "source-controller"
    },
    conditions: [],
    conditionsReviewed: true,
    costs: [],
    costsReviewed: true,
    choicesReviewed: true,
    optional: false,
    source: {
      dataset: "Bushiroad official card list",
      snapshotDate: "2026-11-04",
      officialCardNumber: "BT09/031EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F031EN",
      patternId: "auto-rc-battle-phase-stand-source-power-turn-v1",
      review: "Official BT09/031EN text confirmed. The source must be the exact Rear-Guard instance named as the subject of a unit.stood event, controlled by the turn player during that player's battle phase. Only that source receives +3000 until turn end; standing another unit, a Vanguard, or standing during another phase does not qualify."
    },
    effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]
  }
];

function blockerFor(ability) {
  const text = String(ability.printedText || "");
  if (/equip gauge/i.test(text)) return "The engine has no equip-gauge instance state, ownership/location model, or validated add/remove effect; this text's gauge-dependent condition or operation cannot resolve completely.";
  if (/plant token/i.test(text)) return "The required Plant token characteristics, marker-circle association, and token movement/cleanup are not represented by a matching complete trusted handler.";
  if (/treasures marker|protect marker|dragontree marker/i.test(text)) return "The ability depends on marker placement, marker-count or unmarked-circle legality, and/or marker-specific target rules not covered together by a trusted definition for this exact wording.";
  if (/drive check/i.test(text)) return "The effect needs the exact checked-card instance/type/grade or battle history plus ordered costs and choices; no complete trusted handler matches this ability's full sequence.";
  if (/bind|bound/i.test(text)) return "The effect needs exact bind-event provenance, controller/owner-specific zone movement, or a private opponent choice that the current trusted handlers do not model for this text.";
  if (/plant token|token/i.test(text)) return "The ability needs token creation or token-specific characteristics not represented by a complete trusted handler for this exact sequence.";
  if (/lock|locked/i.test(text)) return "The complete lock/unlock state, eligible cost/target instances, and the printed follow-up sequence are not covered by a trusted handler for this ability.";
  if (/rode upon|ridden upon|rides this unit/i.test(text)) return "The ride event must identify this exact previously ridden card and preserve its rider, destination, optionality, and any printed cost/selection; no matching trusted handler covers the full text.";
  if (/top \d+|top card|search your deck|look at the top/i.test(text)) return "The effect requires private deck inspection, exact card filtering, ordered reveal/move/remainder handling, and possibly shuffle; no complete trusted handler matches the printed sequence.";
  if (/^CONT\b/i.test(text)) return "This continuous ability combines a live location/condition with a keyword, restriction, stat, marker, or multi-zone rule that has no matching complete trusted continuous handler.";
  if (/^ACT\b/i.test(text)) return "The manual ability's exact timing, combined cost payment, target/choice validation, and ordered effect sequence are not all represented by a trusted handler; it must remain unavailable.";
  return "No trusted production definition matches the full trigger, source/circle condition, cost, choice, and ordered effect sequence; it must remain unavailable rather than resolve a partial effect.";
}

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const implementedIds = new Set(definitions.map(definition => definition.id));
const alreadySupportedAbilityIds = Object.freeze(["cfa-1002:0"]);
const alreadySupported = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !implementedIds.has(id) && !alreadySupported.has(id)).map(abilityId => {
  const [cardId] = abilityId.split(":");
  const card = catalogById.get(cardId);
  const parsed = card && Engine.parseCardAbilities(card).find(ability => ability.id === abilityId);
  return Object.freeze({
    abilityId,
    kind: parsed?.kind || null,
    catalogPrintedText: parsed?.printedText || null,
    officialPrintedText: null,
    blocker: parsed ? blockerFor(parsed) : "The assigned ability ID is absent from the local catalog snapshot; no definition is emitted until its exact text is available for review."
  });
}));

const cards = Object.freeze([...new Set(abilityIds.map(id => id.split(":")[0]))].map(cardId => {
  const card = catalogById.get(cardId);
  return Object.freeze({ cardId, name: card?.name || null, cardNumber: card?.cardNumber || null });
}));

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0001",
    status: "partially-integrated-remainder-explicitly-unsupported",
    dataset: "Cardfight Area card database snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextVerifiedAbilityIds: Object.freeze(["cfa-10016:0", "cfa-100:1", "cfa-1001:0"]),
    abilityIds,
    implementedAbilityIds: Object.freeze([...implementedIds]),
    alreadySupportedAbilityIds,
    cards,
    unsupportedSiblings,
    provenanceNote: "The three executable definitions were checked against the linked official Bushiroad card-list entries. Unsupported sibling text is preserved from the local catalog snapshot and is not marked as officially verified; no whole card is claimed complete."
  })
});
Object.defineProperty(definitions, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = definitions;
