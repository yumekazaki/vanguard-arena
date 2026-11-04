"use strict";

// Audit only. No candidate passed the trusted server gate and exact prompt
// legality checks, so nothing is registered or presented as supported.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10433:0", "cfa-10433:1", "cfa-10434:0", "cfa-10436:0", "cfa-10437:0", "cfa-10439:0",
  "cfa-10440:0", "cfa-10443:0", "cfa-10444:0", "cfa-10445:0", "cfa-10445:1", "cfa-10446:0",
  "cfa-10447:0", "cfa-10447:1", "cfa-10448:0", "cfa-10448:1", "cfa-10449:0", "cfa-1044:0",
  "cfa-10450:0", "cfa-10450:1", "cfa-10451:0", "cfa-10451:1", "cfa-10452:0", "cfa-10452:1",
  "cfa-10453:0", "cfa-10453:1", "cfa-10454:0", "cfa-10454:1", "cfa-10455:0", "cfa-10455:1",
  "cfa-10456:0", "cfa-10456:1", "cfa-10456:2", "cfa-10456:3", "cfa-10457:0", "cfa-10458:0",
  "cfa-10459:0", "cfa-10459:1", "cfa-10459:2", "cfa-10459:3", "cfa-1045:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10440:0", "cfa-10444:0", "cfa-10445:0", "cfa-10445:1",
  "cfa-1044:0", "cfa-10452:0", "cfa-10456:0", "cfa-10459:0"
]);

const officialReferences = Object.freeze({
  "cfa-1045": "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F059EN",
  "cfa-10453": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2FEX09EN"
});

const proposedDefinitions = Object.freeze([]);
const officialPrintedById = Object.freeze({
  "cfa-1045:0": "[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have an <Aqua Force> vanguard, you may pay the cost. If you do, draw a card.",
  "cfa-10453:1": "[AUTO]:When this card is discarded from hand for the cost of [Stride], draw a card."
});

const blockers = Object.freeze({
  "cfa-10433:0": "CONT prevents the opponent from choosing this exact unit by card effects while a named Metatron is on the controller's RC; the engine has no reviewed source-scoped cannot-be-chosen effect.",
  "cfa-10433:1": "This exact source attack combines Soul Blast 1 with a private choice of another friendly unit for +5000 until turn end; the full attack, cost, target-exclusion, and player-choice sequence has no reviewed definition.",
  "cfa-10434:0": "This begins at the controller's Main Phase while the source is in Drop and includes both a named Vanguard check and a same-name copy limit; the current event flow does not offer this Drop source at that timing or validate the duplicate-call restriction.",
  "cfa-10436:0": "The exact source must boost, check a named Vanguard, then choose a matching card from Drop and move that selected card to Soul; there is no reviewed Drop-target-to-Soul operation for this trigger.",
  "cfa-10437:0": "The catalog says the trigger is placement on GC, but the official Bushiroad card-list lookup could not confirm this card text. A third-party listing disagrees on GC versus RC, so the circle and +10000 shield cannot safely be encoded until the official text is verified.",
  "cfa-10439:0": "The printed alternative-cost sentence is unusual and needs official text confirmation; the effect also combines persona-ride history, a discard choice, and a draw. No definition is proposed from the local transcription alone.",
  "cfa-1045:0": "Bushiroad confirms the optional RC placement, Aqua Force Vanguard condition, Soul Blast 2, and draw. However, the current trigger-discovery path does not generally preflight single Soul Blast costs: a one-Soul fixture still queues the prompt for equivalent candidate definitions (only a few hard-coded card-ID patterns preflight). Do not add this as a supported ability until unpayable-cost trigger gating is generalized and tested; otherwise the player is offered an unusable AUTO.",
  "cfa-10443:0": "The shield increase depends on both current critical and how that critical was gained (non-trigger effect or original critical); no trusted attacker-critical provenance check matches this wording.",
  "cfa-10446:0": "CONT aliases several names and grants Gacha Redora a nested ACT that searches top five into Monster BOX; dynamic name aliases and granted activated abilities are not supported together.",
  "cfa-10447:0": "CONT grants back-row attack legality to named Rear-Guards and adds an on-hit Soul effect; neither the dynamic attack permission nor granted AUTO is represented.",
  "cfa-10447:1": "This attack has variable Soul Blast quantity with three thresholds (power, Drive, Sentinel restriction); the cost-selection count and ordered threshold effects are not a trusted program.",
  "cfa-10448:0": "Placement on either VC or RC conditionally pays Counter Blast, then selects a different-name, grade-bounded unit from Drop or Monster BOX to call. Monster BOX selection and this compound filter are not supported.",
  "cfa-10448:1": "The attack power scales by the live number of rested units; the current attack modifier handlers do not calculate this exact count per battle.",
  "cfa-10449:0": "The trigger applies after this exact unit attacked or boosted, checks a named Vanguard, moves the source to Soul, then Counter Charges; attack-or-boost battle-close provenance is not modeled as one reviewed trigger.",
  "cfa-10450:0": "ACT from Monster BOX needs a grade/name Vanguard gate, Soul Blast, and calling this exact Monster BOX source; manual activation and source movement from this zone are not supported by an existing handler.",
  "cfa-10450:1": "The attack costs Counter Blast and a selected Drop card to Soul, then grants power equal to that card's original power. Dynamic selected-card-value modifiers are unavailable.",
  "cfa-10451:0": "The continuous +5000 applies to every unit in the same column only during the controller's turn with a grade 3+ named Vanguard; no exact live same-column continuous modifier is registered.",
  "cfa-10451:1": "ACT from Drop depends on this exact card not having been called from Drop this turn, pays by moving a Rear-Guard to Soul, then calls the source; card-instance turn history and atomic cost/call sequencing are not supported together.",
  "cfa-10452:1": "ACT requires a Chronojet crest, discards this source, then searches Deck or Drop by name and conditionally shuffles; the crest predicate and discard-plus-search transaction are not reviewed together.",
  "cfa-10453:0": "CONT requires GB2 plus a turn-scoped event that any player's Rear-Guard was put on the bottom of deck; this movement history is not evaluated by a trusted continuous condition.",
  "cfa-10453:1": "Bushiroad verifies the exact Stride-cost discard/draw text and the draw operation exists, but this record has no trusted server definition and the server effect whitelist rejects an unregistered ID. The current compiler does not match the printed wording variant. Do not propose it until the existing source/reason/phase/controller trigger handler is promoted through the supported registration path and host/joiner resolution tests pass.",
  "cfa-10454:0": "The event is another named unit card being discarded from Deck, with an optional move of that exact event subject into Soul on either player's turn; the source/subject and discard-cause resolution is not covered by a trusted effect.",
  "cfa-10454:1": "ACT has two ordered costs: Counter Blast for +10000 to a selected Rear-Guard, then a separate Soul-to-bottom-deck cost to give that same target +1 critical. The second cost's conditional sequence is unsupported.",
  "cfa-10455:0": "ACT from Drop pays with a named hand Order moved to Soul, mills three cards, then calls this source; the cost zone filter and multi-step deck/call sequence have no reviewed handler.",
  "cfa-10455:1": "Once per turn, at the end of the Vanguard's attack, this ability Counter Blasts, moves a named Soul card to deck bottom, and stands the source; the exact named-cost and battle-close stand sequence is unsupported.",
  "cfa-10456:1": "CONT normalizes multiple card names into an archetype and restricts resting another named Order; dynamic identity aliases and action restriction are not modeled.",
  "cfa-10456:2": "ACT rests the Order, chooses any Drop card, returns it to deck, and shuffles; the chosen Drop-to-deck move and shuffle are not represented by one trusted operation.",
  "cfa-10456:3": "The Order triggers on a different Vanguard's attack, checks same-name count across Soul or Monster BOX, rests itself, then modifies a chosen Vanguard's Drive. The count scope and source-independent trigger are unsupported.",
  "cfa-10457:0": "GC AUTO mills three cards, pays by moving a specifically named Soul card to deck bottom, and modifies shield; the required ordered deck-mill, named Soul selection, and shield sequence is not available.",
  "cfa-10458:0": "This attack mills three, pays with a named Soul card, then imposes a battle-long minimum simultaneous hand call to GC; the GC restriction handler is not implemented.",
  "cfa-10459:1": "CONT aliases five card names into an archetype and restricts resting Gacha Redora; the required dynamic identity and action restriction are unsupported.",
  "cfa-10459:2": "ACT rests this Order and moves a chosen named unit from Drop to Soul; no reviewed handler moves a selected non-source Drop card into Soul.",
  "cfa-10459:3": "The Order triggers on a separate Vanguard attack, checks same-name count across Soul or Monster BOX, rests itself, and modifies Vanguard Drive; the full independent-source trigger and count condition are unsupported."
});

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const assignedBatch = require("../ability-work-batches.json").batches.find(batch => batch.batchId === "ABILITY-320008F1-0017");
if (!assignedBatch || JSON.stringify(assignedBatch.abilityIds) !== JSON.stringify(abilityIds)) throw new Error("Batch ID list differs from the reserved assignment.");

const existingDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition || !ReducerSafeDefinition(ability.definition)) throw new Error(`Existing trusted definition missing: ${abilityId}`);
  return Object.freeze({ abilityId, patternId: ability.definition.source?.patternId || null, printedText: ability.printedText });
}));

function ReducerSafeDefinition(definition) {
  // Definition validation is performed by the focused batch tests below.
  return Array.isArray(definition.effects) && definition.effects.length > 0
    || Array.isArray(definition.keywords) && definition.keywords.length > 0
    || Array.isArray(definition.continuousRestrictions) && definition.continuousRestrictions.length > 0;
}

const proposedIds = new Set(proposedDefinitions.map(definition => definition.id));
const supportedIds = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !proposedIds.has(id) && !supportedIds.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockers[abilityId]) throw new Error(`Missing assigned ability or blocker: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: officialPrintedById[abilityId] || null, officialReference: officialPrintedById[abilityId] ? officialReferences[cardId] : null, blocker: blockers[abilityId] });
}));

const result = [];
Object.defineProperty(result, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0017",
    status: "eight-supported-33-blocked-no-safe-new-proposals",
    dataset: "Cardfight Area local catalog snapshot (2025-05-09); official Bushiroad text checked for two blocked candidates",
    officialTextChecked: true,
    officialReferences,
    abilityIds,
    proposedDefinitionIds: Object.freeze([...proposedIds]),
    proposedDefinitions,
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions: existingDefinitions,
    fullyTestedWholeCardIds: Object.freeze([]),
    unsupportedSiblings,
    counts: Object.freeze({ assigned: abilityIds.length, alreadySupported: alreadySupportedAbilityIds.length, proposed: proposedDefinitions.length, blocked: unsupportedSiblings.length }),
    provenanceNote: "The two candidate draw effects have official text sources, but neither passed the existing trusted-server integration and legal-prompt gate: Penguin Soldier can be offered with insufficient Soul by the generic path, and Balih's current record is rejected by the trusted server effect gate. Both remain blocked until these central validations are safely generalized."
  })
});
Object.defineProperty(result, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });
module.exports = result;
