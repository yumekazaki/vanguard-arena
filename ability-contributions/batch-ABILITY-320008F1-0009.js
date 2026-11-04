"use strict";

// Batch audit only: no new definitions are proposed because the remaining
// abilities need event/effect handlers or stronger server legality gates.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10237:0", "cfa-10238:0", "cfa-10239:0", "cfa-10239:1", "cfa-10240:0",
  "cfa-10242:0", "cfa-10243:0", "cfa-10243:1", "cfa-10244:0", "cfa-10244:1",
  "cfa-10246:0", "cfa-10247:0", "cfa-10248:0", "cfa-10249:0", "cfa-10249:1",
  "cfa-10250:0", "cfa-10251:0", "cfa-10251:1", "cfa-10252:0", "cfa-10252:1",
  "cfa-10253:0", "cfa-10254:0", "cfa-10255:0", "cfa-10255:1", "cfa-10256:0",
  "cfa-10256:1", "cfa-10257:0", "cfa-10258:0", "cfa-10259:0", "cfa-1025:0",
  "cfa-10261:0", "cfa-10262:0", "cfa-1026:0"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-1025:0"]);
const officialTextChecks = Object.freeze({
  "cfa-10251:0": {
    cardNumber: "D-LBT03/016EN",
    officialPrintedText: "[AUTO]:When this unit is placed on (RC) by your grade 3 or greater vanguard's ability, this unit gets [Power] +5000 until end of turn.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2F016EN"
  },
  "cfa-10251:1": {
    cardNumber: "D-LBT03/016EN",
    officialPrintedText: "[AUTO](RC):When your other rear-guard is returned to hand by your vanguard's ability, choose one of your vanguards, and it gets [Power] +5000 until end of turn.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2F016EN"
  },
  "cfa-10252:0": {
    cardNumber: "D-LBT03/014EN",
    officialPrintedText: "[AUTO](RC)[1/turn]:When your other unit in the same column as this unit is placed, if your opponent's vanguard is grade 3 or greater, this unit gets [Power] +5000 until end of turn.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2F014EN"
  },
  "cfa-10252:1": {
    cardNumber: "D-LBT03/014EN",
    officialPrintedText: "[AUTO](RC):At the end of the battle this unit boosted a rear-guard, [COST][Soul-Blast 1], choose one of the boosted rear-guards, and return it to hand.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2F014EN"
  },
  "cfa-10254:0": {
    cardNumber: "D-LBT03/061EN",
    officialPrintedText: "[AUTO](RC):When this unit attacks, choose one of your units in another column, and you may have it get [Power] +5000 until end of turn. If you do, put this unit on the bottom of your deck at the end of that battle.",
    officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?clan=&grade%5B0%5D=all&grade%5B1%5D=1&keyword=&keyword_type%5B0%5D=all&kind%5B0%5D=all&nation=&power_from=11000&power_to=11000&rare=&regulation=D&trigger%5B0%5D=all&view=text"
  }
});

const blockerById = Object.freeze({
  "cfa-10237:0": "Requires an exact from-hand RC placement, a Haseritt Vanguard check, a grade-limited hand-to-Soul cost, private top-seven selection with three grade/power filters, and a draw fallback only when no card is called. The combined selection and no-call branch lacks a trusted reducer program.",
  "cfa-10238:0": "Requires this exact source to boost a Rear-Guard, a Grade 3+ Haseritt Vanguard, battle-duration power, then a battle-close Soul Blast and moving the back-row center unit to an open front-row RC. The boost target identity and column move are not supported together.",
  "cfa-10239:0": "Needs a once-per-turn AUTO caused by another Rear-Guard's move to deck bottom specifically during the Battle Phase, then Soul Blast 1 and a turn power modifier. The exact move event and ability-scoped once restriction are not available as one trusted definition.",
  "cfa-10239:1": "Needs an exact source attack-hit battle-close event, paying by moving that source to the bottom of its owner's deck, then drawing and Counter Charging. The ordered source-cost and hit-context handler is unavailable.",
  "cfa-10240:0": "Needs another Rear-Guard moved to deck bottom during Battle Phase plus a live Haseritt Vanguard condition before granting turn power. No trusted event-and-condition path covers this wording.",
  "cfa-10242:0": "Ride AUTO searches Deck or hand for a Grade 1 Product, moves it to Order Zone, shuffles only after a Deck search, and draws only when it came from hand. Product identity, source-zone choice, and ordered resolution are unsupported.",
  "cfa-10243:0": "ACT operates a chosen Product Order after Soul Blast 1. The engine does not model Order Zone Product selection and the nested Operate ability as a validated effect.",
  "cfa-10243:1": "Ride AUTO pays by moving a Product Order to Drop, then searches Deck or hand for a Grade 2 Product into Order Zone, conditionally shuffles or draws. That ordered search and zone movement are unsupported.",
  "cfa-10244:0": "The Vanguard attack AUTO chooses and operates a Product in Order Zone. Operate is a nested rules action not represented by a trusted effect handler.",
  "cfa-10244:1": "Triggers from a Product being operated and grants turn power to this exact Vanguard. The operation event is not generated or validated by the current Product-zone model.",
  "cfa-10246:0": "Order Zone trigger depends on a Grade 3+ Vanguard being placed specifically by riding from Grade 3, pays by moving this Order to Drop, and searches Deck or hand for a named Product with a conditional shuffle or draw. Ride-origin history and Product search are unsupported.",
  "cfa-10247:0": "Combines an unplayable CONT restriction with Operate resolution: retire an opponent's Rear-Guard, reduce a Vanguard's power, pay Counter Blast and return a friendly Rear-Guard, create a 23000-power unit, then return it to Order Zone at turn end. Product representation, nested operations, temporary unit creation, and delayed movement all need implementation.",
  "cfa-10248:0": "ACT moves this source to Soul as part of a Counter Blast cost, then grants an attack-hit AUTO to a chosen Vanguard until turn end. The engine does not validate dynamically granted, source-scoped abilities or their expiry.",
  "cfa-10249:0": "Requires Generation Break 2 at Vanguard attack timing, battle power, and a grade-1-or-greater guard-call restriction through battle end. The guard restriction is not an available trusted effect.",
  "cfa-10249:1": "Triggers when a G unit Strides during this controller's turn, pays Counter Blast 1, and puts a chosen opponent Rear-Guard on the bottom of the opponent's deck. The exact stride event and opponent-zone deck movement need a trusted handler.",
  "cfa-10250:0": "ACT requires four or more units, discards a card, and grants a Drop Normal Order temporary permission to be played from Drop and bottom-deck itself after use. Temporary cross-card play permission is not modeled.",
  "cfa-10251:0": "Official text was checked, but the exact cause must be this source entering RC through a Grade 3+ Vanguard ability; generic placement events do not preserve the causal effect and Vanguard-grade provenance required to authorize it.",
  "cfa-10251:1": "Official text was checked, but eligibility depends on another Rear-Guard returning to hand specifically by a Vanguard ability, then choosing a friendly Vanguard for +5000. The event currently lacks authoritative cause/source attribution for the return.",
  "cfa-10252:0": "Official text was checked, but this is a once-per-turn same-column placement trigger gated by the opponent's Grade 3+ Vanguard. Exact column relation and ability-specific use tracking are not supported together.",
  "cfa-10252:1": "Official text was checked, but resolution needs the exact Rear-Guard this source boosted in a specific battle, Soul Blast 1, and return of that exact boosted target to hand. Battle history and target identity are not trusted through that sequence.",
  "cfa-10253:0": "CONT power is +2000 for each complete pair of all controlled units, counting this source. The continuous evaluator has no all-unit count with floor-by-two scaling.",
  "cfa-10254:0": "Official text was checked, but the effect is optional and sequential: choose another-column friendly unit for +5000, then only if power is granted schedule this source to bottom-deck at that battle's end. The conditional delayed source movement is unsupported.",
  "cfa-10255:0": "GC CONT shield has tiered, non-stacking Soul thresholds (six gives +5000; ten gives +10000 instead). The current shield condition model does not encode these mutually exclusive thresholds for this exact source.",
  "cfa-10255:1": "Requires this exact Rear-Guard attack, Soul count at least six, moving a different Rear-Guard to Soul, Counter Charge, then a second threshold at ten followed by draw two and put a hand card into Soul. Conditional sequential costs/effects and rechecking Soul count are unsupported.",
  "cfa-10256:0": "Ride AUTO places a Cradle marker on an opponent Rear-Guard only if that exact target lacks one. Cradle marker state and target selection/duplicate-marker rejection are not modeled by a trusted effect.",
  "cfa-10256:1": "Combines two triggers (put on GC or attack a Grade 2+ Vanguard from RC), Soul Blast 1, opponent choice to retire a standing Rear-Guard, then a conditional draw and front-row power if none is retired. The paired event timing and opponent-controlled choice sequence are unsupported.",
  "cfa-10257:0": "CONT grants Boost to this source's other same-column Rear-Guards only while the controller has a Lianorn Vanguard. The continuous evaluator has no same-column keyword-grant effect for this predicate.",
  "cfa-10258:0": "ACT requires face-up Order in Damage, Soul Blast 1, moving a Unit from hand to Damage face-up, then choosing a face-up Order from Damage to hand. The conditional zone-cost sequence and legal card selection are unsupported.",
  "cfa-10259:0": "CONT applies different stats on RC and GC while a Magazine is in Drop: +2000 power and +5000 shield. The current continuous definition cannot express the Drop Order predicate and distinct zone-specific outputs together.",
  "cfa-10261:0": "Ride AUTO by a Grade 2 Lilfa requires choosing a Grade 2+ card from hand, calling it specifically to back-row center, granting temporary Boost, and drawing only if a card was called. Named rider and ordered optional call/draw sequence are unsupported.",
  "cfa-10262:0": "Ride AUTO by a Grade 3 Lilfa offers an optional return of a chosen Grade 2+ Rear-Guard. The event must identify the exact rider and the target's live grade/controller; this conditional ride-choice effect has no trusted handler.",
  "cfa-1026:0": "End Phase retirement trigger requires this exact source to move from RC to Drop during its controller's End Phase and a Great Nature Vanguard, then Counter Blast 1, search Deck for Recorder Dog, call to RC, and shuffle. The end-phase retirement cause and exact search/call sequence are unsupported."
});

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = catalogById.get(cardId);
  if (!card) throw new Error(`Assigned card missing from catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name });
}));
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedAbilityIds.includes(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed ability or specific blocker: ${abilityId}`);
  return Object.freeze({
    abilityId,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: officialTextChecks[abilityId]?.officialPrintedText || null,
    officialReference: officialTextChecks[abilityId]?.officialReference || null,
    officialCardNumber: officialTextChecks[abilityId]?.cardNumber || null,
    blocker: blockerById[abilityId]
  });
}));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(catalogById.get(cardId)).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected production definition missing: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText, definitionSource: ability.definition.source?.patternId || "compiled production definition" });
}));

module.exports = Object.assign([], {
  audit: Object.freeze({
    batchId: "ABILITY-320008F1-0009",
    status: "one-existing-definition-32-blocked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: false,
    officiallyCheckedAbilityIds: Object.freeze(Object.keys(officialTextChecks)),
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    cards,
    unsupportedSiblings,
    provenanceNote: "Exact local catalog text is retained for every assigned ability. Five ability texts were cross-checked against Bushiroad's official card list, but they remain unavailable because their exact event or effect semantics are not covered by a trusted production handler. No new definitions are proposed and no whole card is marked complete."
  }),
  unsupportedSiblings
});
