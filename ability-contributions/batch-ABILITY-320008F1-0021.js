"use strict";

// Audit-only contribution for batch 0021. One ability already has an exact
// reviewed production definition. The remaining abilities are kept blocked
// because their effects require unimplemented timing, costs, choices, or state.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");
const fs = require("node:fs");
const path = require("node:path");

const abilityIds = Object.freeze([
  "cfa-10551:0", "cfa-10551:1", "cfa-10553:0", "cfa-10554:0", "cfa-10554:1",
  "cfa-10555:0", "cfa-10556:0", "cfa-10557:0", "cfa-10557:1", "cfa-10557:2",
  "cfa-10558:0", "cfa-10558:1", "cfa-10559:0", "cfa-10560:0", "cfa-10561:0",
  "cfa-10562:0", "cfa-10562:1", "cfa-10563:0", "cfa-10564:0", "cfa-10564:1",
  "cfa-10565:0", "cfa-10566:0", "cfa-10568:0", "cfa-10568:1", "cfa-10569:0",
  "cfa-10569:1", "cfa-1056:0", "cfa-10570:0", "cfa-10570:1", "cfa-10571:0",
  "cfa-10572:0", "cfa-10573:0", "cfa-10573:1", "cfa-10574:0", "cfa-10574:1",
  "cfa-10575:0", "cfa-10576:0"
]);

const alreadySupportedAbilityIds = Object.freeze(["cfa-10568:1"]);
const proposedDefinitions = Object.freeze([]);

const officialReferences = Object.freeze({
  "cfa-10557": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS12%2F026EN",
  "cfa-10568": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT08%2F091EN"
});

const verifiedOfficialAbilities = Object.freeze([
  Object.freeze({
    abilityId: "cfa-10557:0",
    officialPrintedText: "[AUTO]:When this unit is placed on (RC), you may [Soul-Charge 1].",
    officialReference: officialReferences["cfa-10557"]
  }),
  Object.freeze({
    abilityId: "cfa-10557:1",
    officialPrintedText: "[ACT](RC):If your vanguard is grade 3 or greater, [COST][put this unit into soul], choose up to one grade 3 card with \"Mikani\" in its card name from your soul, and call it to (RC).",
    officialReference: officialReferences["cfa-10557"]
  }),
  Object.freeze({
    abilityId: "cfa-10557:2",
    officialPrintedText: "[CONT](Soul):When you would count the number of different card names in your soul for your card's ability, all \"Go Ahead, Mikani\" in your soul each count as a different card name.",
    officialReference: officialReferences["cfa-10557"]
  }),
  Object.freeze({
    abilityId: "cfa-10568:0",
    officialPrintedText: "[AUTO]:When this unit is rode upon by a unit with only 《Aqua Force》 for its clan, search your deck for up to one Blue Storm Armada card, reveal it and put it into your hand, and shuffle your deck.",
    officialReference: officialReferences["cfa-10568"]
  }),
  Object.freeze({
    abilityId: "cfa-10568:1",
    officialPrintedText: "[CONT](RC):During your turn, if you have a vanguard with \"Maelstrom\" in its card name, this unit gets [Power] +5000.",
    officialReference: officialReferences["cfa-10568"]
  })
]);

const blockerById = Object.freeze({
  "cfa-10551:0": "ACT combines Counter Blast, a hand-to-Soul cost, selecting up to three Soul units with different grades, calling them, and conditionally powering the called cards. The current trusted program has no validated distinct-grade multi-call sequence.",
  "cfa-10551:1": "End-of-turn AUTO requires choosing and moving two Rear-Guards to Soul before drawing. There is no trusted two-source cost transaction for this ability.",
  "cfa-10553:0": "This exact source must enter a back-row RC from Soul, then pay Soul Blast and grant a nested CONT ability to a selected Vanguard. The source-origin event and temporary nested ability grant are unsupported.",
  "cfa-10554:0": "The placement AUTO pays by selecting a hand card and moving it to Soul before drawing. The parser does not model this hand-to-Soul cost, and no trusted server cost path validates it.",
  "cfa-10554:1": "The CONT checks turn-scoped counts of units placed from Soul, then adds two separate power thresholds. The engine does not maintain this placement history as a continuous condition.",
  "cfa-10555:0": "The AUTO requires placement from Soul by a Vanguard ability, then Soul Blasts and Counter Charges. The resolver does not retain the causing ability/source for this exact placement event.",
  "cfa-10556:0": "This ability must react to this unit retiring from either RC or GC, then optionally move that same card from Drop to Soul under a Glitter condition. GC retirement identity and the post-retirement source move are not implemented together.",
  "cfa-10557:0": "Bushiroad confirms optional Soul Charge 1 on exact RC placement, but the existing trusted server pattern only accepts a different printed VC/RC wording and fixed card IDs. The source, optional prompt, and server whitelist must be generalized before compilation.",
  "cfa-10557:1": "ACT requires the Glitter-Kheios predicate, source-to-Soul cost, and a filtered grade-3 Mikani selection from Soul. The combined archetype condition, filtered source-zone target, and atomic call are not trusted.",
  "cfa-10557:2": "CONT changes how duplicate Mikani copies count toward a distinct-card-name Soul condition. The engine has no reviewed custom distinct-name counting rule.",
  "cfa-10558:0": "This CONT requires at least eight distinct card names in Soul and grants both Boost and power. Distinct-name counting and continuous keyword grants are not supported as this exact program.",
  "cfa-10558:1": "This CONT grants back-row Intercept and shield in both RC and GC when Soul has eight distinct names. The distinct-name predicate, intercept permission, and GC shield modifier lack a trusted combined definition.",
  "cfa-10559:0": "The trigger parser needs review for the Back Row Center RC end-of-battle attack timing. It also requires grade checks, Soul Blast plus discard, a named Vanguard target, and temporary power/Drive changes.",
  "cfa-10560:0": "This placement AUTO depends on another grade-1-or-lower Rear-Guard being placed simultaneously with this exact source. Current placement events do not establish that same-action relation for a trusted trigger.",
  "cfa-10561:0": "This CONT applies in Deck or RC, including the opponent's turn, and modifies both power and grade under a Glitter condition. Dynamic grade changes and Deck-zone continuous evaluation are unsupported.",
  "cfa-10562:0": "The RC placement AUTO pays Soul Blast, selects a Vanguard by name, and modifies that chosen Vanguard. This exact cost/target sequence has no trusted server definition.",
  "cfa-10562:1": "The GC AUTO pays Soul Blast and adds temporary shield to the exact guardian only with a Luquier Vanguard. The engine lacks a trusted paid Guardian Circle shield-modifier sequence.",
  "cfa-10563:0": "This trigger responds to this exact card being discarded from hand during the controller's turn, checks a Glitter Vanguard, pays Counter Blast, and draws. Generic discard-cause matching and the combined condition/cost authorization are not trusted.",
  "cfa-10564:0": "Drop-zone AUTO needs the exact Ride Phase Vanguard-placement event, persona-ride history, a duplicate-name RC check, optional calling from Drop, then power. This timing and state combination is not implemented.",
  "cfa-10564:1": "This back-row unit reacts when another unit in its same column stands, may stand itself, then schedules its own retirement at turn end. Same-column stand events and the delayed retirement sequence are unsupported.",
  "cfa-10565:0": "The catalog text is a Persona Ride rules action embedded in an Over Trigger, not a normal freely activatable ACT. The engine does not model its reveal timing as a dedicated Over Trigger resolution, so exposing it as a manual ability would be incorrect.",
  "cfa-10566:0": "This placement AUTO cost filters Drop for a Normal Unit whose name matches a unit on the field, moves that chosen cost to deck bottom, and grants power. Filtered cost selection and bottom-deck movement are not a trusted atomic handler.",
  "cfa-10568:0": "The official AUTO triggers when this exact Vanguard is ridden by a unit with only Aqua Force for its clan, then searches/reveals a Blue Storm Armada card. Ride identity, incoming-clan condition, and filtered search are not a trusted combined definition.",
  "cfa-10569:0": "This ride-upon AUTO must look at the top seven, filter to a Tear Dragon or Aqua Force unit, call the selected card, and shuffle. The ride event plus this filtered top-deck call is not supported as one validated handler.",
  "cfa-10569:1": "The attack AUTO checks fourth-or-later battle and a Maelstrom Vanguard, then grants power and a nested attack-hit draw AUTO. Nested temporary trigger grants and battle-count matching are unsupported.",
  "cfa-1056:0": "The AUTO may pay Counter Blast on this source's VC/RC placement, select a different Murakumo Rear-Guard, search and call its exact-name copy, then schedule that called copy to return to deck bottom. The filtered copy search/call and delayed move are unsupported together.",
  "cfa-10570:0": "ACT calls a filtered unit from Soul, grants it a temporary first-battle restand ability with a Counter Blast cost, then returns that unit to Soul at turn end. Filtered Soul calls, nested temporary AUTO grants, and delayed source movement are not supported together.",
  "cfa-10570:1": "This Vanguard's own attack must be the fourth or later battle and target the opponent's Vanguard, then draw and choose/retire an opposing Rear-Guard. Battle-count evaluation and the complete opponent target sequence are not trusted for this definition.",
  "cfa-10571:0": "On placement in Order Zone, this AUTO resolves two sequential choices: call a filtered unit from Drop, then select a Rear-Guard for power based on other same-name orders. The ordered multi-effect and dynamic order-count calculation are unsupported.",
  "cfa-10572:0": "The ability is tied to this exact booster at battle close, pays Soul Blast, and swaps two Rear-Guard positions. The battle event is recognized, but a validated atomic position-swap effect is not available.",
  "cfa-10573:0": "This own-attack AUTO pays Soul Blast and chooses a Vanguard by name for temporary power. The source-specific attack trigger, cost payment, and selected Vanguard modifier have not been validated together on both seats.",
  "cfa-10573:1": "This battle-close AUTO requires the second battle, a standing named Vanguard, Counter Blast, and standing this exact source. The resolver does not validate the combined battle history/Vanguard-rest state and cost timing.",
  "cfa-10574:0": "The placement AUTO searches/reveals a Set Order and adds it only if its card name matches one already in Order Zone. The post-selection zone-name comparison and reveal/search transaction are unsupported.",
  "cfa-10574:1": "The own-attack AUTO requires choosing two Set Orders with matching card names from Order Zone before granting battle power. Multi-card same-name target validation is unsupported.",
  "cfa-10575:0": "This attack AUTO checks fourth-or-later battle and a Blue Storm Armada in Order Zone, gives battle power, then moves the exact source to Soul at battle end. The combined order predicate, battle count, and delayed source move are not supported.",
  "cfa-10576:0": "The CONT counts fourth-or-later battles and modifies every unit in the same column as this source. The evaluator has no continuous battle-count condition with column-wide target scope."
});

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "ability-work-batches.json"), "utf8"))
  .batches.find(batch => batch.batchId === "ABILITY-320008F1-0021");
if (!assignment) throw new Error("Assignment ABILITY-320008F1-0021 is missing from the registry.");
if (JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...abilityIds].sort())) {
  throw new Error("Contribution ability IDs differ from the reserved assignment.");
}

const alreadySupportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !alreadySupportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing exact catalog ability or blocker: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: verifiedOfficialAbilities.find(item => item.abilityId === abilityId)?.officialPrintedText || null,
    officialReference: officialReferences[cardId] || null,
    blocker: blockerById[abilityId]
  });
}));

const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    officialPrintedText: verifiedOfficialAbilities.find(item => item.abilityId === abilityId)?.officialPrintedText || null,
    officialReference: officialReferences[cardId] || null
  });
}));

module.exports = Object.freeze({
  batchId: "ABILITY-320008F1-0021",
  abilityIds,
  alreadySupportedAbilityIds,
  supportedDefinitions,
  proposedDefinitions,
  unsupportedSiblings,
  verifiedOfficialAbilities
});
