"use strict";

// Batch audit only: keep unimplemented abilities out of the production engine.
// Local catalog text is preserved verbatim below; official cross-checks are
// recorded separately and are not inferred from the catalog snapshot.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const fs = require("node:fs");
const path = require("node:path");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const batchId = "ABILITY-320008F1-0023";
const abilityIds = Object.freeze([
  "cfa-10602:0", "cfa-10602:1", "cfa-10603:0", "cfa-10604:0", "cfa-10605:0",
  "cfa-10606:0", "cfa-10607:0", "cfa-10608:0", "cfa-10609:0", "cfa-10613:0",
  "cfa-10614:0", "cfa-10614:1", "cfa-10615:0", "cfa-10616:0", "cfa-10617:0",
  "cfa-10618:0", "cfa-10619:0", "cfa-10619:1", "cfa-1061:0", "cfa-1061:1",
  "cfa-1061:2", "cfa-1061:3", "cfa-1061:4", "cfa-1061:5", "cfa-10620:0",
  "cfa-10622:0", "cfa-10622:1", "cfa-10623:0", "cfa-10624:0", "cfa-10624:1",
  "cfa-10624:2", "cfa-10625:0", "cfa-10625:1", "cfa-10627:0", "cfa-10628:0",
  "cfa-1062:0", "cfa-1062:1", "cfa-1063:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10622:0", "cfa-1062:0", "cfa-1062:1"
]);

// This is a composition of existing handlers only: exact booster identity at
// battle close, the existing Minerva name condition, and the source-to-hand
// effect. It adds no new engine operation or server behavior.
const proposedDefinitions = Object.freeze([
  Object.freeze({
    id: "cfa-10602:0",
    cardId: "cfa-10602",
    kind: "AUTO",
    printedText: "AUTO [RC]: At the end of the battle this unit boosted, if you have a vanguard with \"Minerva\" in its card name, you may return this unit to your hand.",
    requiredLocation: ["rear-guard"],
    optional: true,
    trigger: Object.freeze({
      status: "recognized-trigger",
      eventType: "battle.close-step",
      subject: "booster",
      requiredTimingWindow: "battle-close-step",
      turnRelation: "controller"
    }),
    conditions: Object.freeze([{ type: "controller-vanguard-name-contains", value: "Minerva" }]),
    conditionsReviewed: true,
    costs: Object.freeze([]),
    costsReviewed: true,
    choicesReviewed: true,
    source: Object.freeze({
      dataset: "Bushiroad official card list",
      snapshotDate: "2026-11-04",
      officialCardNumber: "D-BT08/084EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT08%2F084EN",
      patternId: "auto-boosted-close-minerva-return-source-hand-v1",
      review: "Official D-BT08/084EN text confirmed. At battle close, only the exact Rear-Guard that boosted in that battle is eligible, and only if its controller has a Vanguard with Minerva in its name; the optional effect returns that source card to its controller's hand."
    }),
    effects: Object.freeze([{ op: "move-source-to-hand", target: "source", from: "rear-guard" }])
  })
]);

const officialReferences = Object.freeze({
  "cfa-10603": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT08%2F008EN",
  "cfa-10620": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F073EN",
  "cfa-10622": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F003EN",
  "cfa-10628": "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2F045EN"
});

const verifiedOfficialAbilities = Object.freeze([
  Object.freeze({
    abilityId: "cfa-10603:0",
    officialPrintedText: "[AUTO](RC):At the end of the battle this unit attacked, if you have a vanguard with \"Minerva\" in its card name, [COST][Soul-Blast 1], choose one of your vanguards, and it gets [Power] +5000 until end of turn. Then, [COST][put this unit into soul], and [Counter-Charge 1].",
    officialReference: officialReferences["cfa-10603"]
  }),
  Object.freeze({
    abilityId: "cfa-10620:0",
    officialPrintedText: "[AUTO]:When this card is put into soul from deck, if you have a vanguard with \"Nordlinger\" in its card name, you may call this card to a back row (RC).",
    officialReference: officialReferences["cfa-10620"]
  }),
  Object.freeze({
    abilityId: "cfa-10622:0",
    officialPrintedText: "[AUTO]:When this unit is placed on (RC), [COST][Counter-Blast 1], choose one of your (RC) without any Dragontree markers, and put a Dragontree marker.",
    officialReference: officialReferences["cfa-10622"]
  }),
  Object.freeze({
    abilityId: "cfa-10622:1",
    officialPrintedText: "[AUTO](RC)[1/turn]:When your opponent's rear-guard is retired during your main phase, [COST][Soul-Blast 1], look at the top five cards of your deck, choose up to one grade 1 or less unit card from among them, call it to (RC), and shuffle your deck.",
    officialReference: officialReferences["cfa-10622"]
  }),
  Object.freeze({
    abilityId: "cfa-10628:0",
    officialPrintedText: "[CONT](RC):If your order zone has two or more cards, this unit gets [Power] +5000. (Active on opponent's turn too)",
    officialReference: officialReferences["cfa-10628"]
  })
]);

const blockerById = Object.freeze({
  "cfa-10602:1": "The ability checks this source being put on GC and a grade-3 Regalia in its controller's Soul, then changes this guardian's shield for that battle. The exact named-Soul shield condition is not an authorized server-side GC modifier for this card.",
  "cfa-10603:0": "This battle-close AUTO has two ordered costs: Soul Blast 1 before choosing a Vanguard for power, then moving this source to Soul before Counter Charge 1. No reviewed atomic resolver validates both steps and prevents partial application.",
  "cfa-10604:0": "The trigger is another one of the controller's rear-guards being retired by a card ability during the controller's turn, with a per-instance once-per-turn limit. The engine does not yet authorize this exact broad retirement-cause trigger and usage scope.",
  "cfa-10605:0": "The trigger is another unit standing specifically by a card ability; the source then pays Soul Blast 1 and gets power. No validated stand event carries the cause and exact other-unit identity needed by this definition.",
  "cfa-10606:0": "Exact RC placement must be combined with the Glitter Vanguard condition, Soul Charge 1, and source power +5000. The generic effect program prevalidates Soul Charge against deck size and rejects the whole sequence when the deck is empty, so it cannot safely preserve the following power instruction in that boundary state.",
  "cfa-10607:0": "The source itself must boost a Glitter unit, and its power increase lasts only for that battle. No reviewed boost trigger definition checks both the booster instance and the boosted unit's Glitter keyword.",
  "cfa-10608:0": "This exact card must move from deck into Soul due to a card ability during its controller's turn; then a Glitter condition and Vanguard target choice apply. The event pipeline does not authorize this exact origin, cause, turn, and target sequence.",
  "cfa-10609:0": "This has the same broad stand-by-ability event and Soul Blast cost as a similar card, but requires this exact source instance and its own once-per-turn record. No reviewed stand-cause trigger program currently enforces that combination.",
  "cfa-10613:0": "ACT requires a Flagburg Vanguard, Counter Blast 1 plus a hand discard, a grade-3-or-less Drop target, a call to RC, and a temporary power grant. No authorized handler atomically validates that filtered target and combined cost.",
  "cfa-10614:0": "The source must be discarded specifically to pay a Base ability cost, then pay Counter Blast, call itself, choose a B-Hero from Drop, and Scout it to the Base/order zone. The server does not retain this exact cost-cause identity or implement the Scout-to-Base effect.",
  "cfa-10614:1": "The condition counts Base cards specifically in Order Zone during the controller's turn, not arbitrary order cards. Current continuous-condition support does not count this order subtype.",
  "cfa-10615:0": "This exact Rear-Guard's attack must hit a grade-3-or-greater Vanguard, after which the opponent must choose exactly two legal Rear-Guards to retire. There is no trusted combined hit-grade check and mandatory two-target opponent choice for this ability.",
  "cfa-10616:0": "This source must move from RC into Soul, then pay Counter Blast and return that same instance from Soul to hand. The resolver has no reviewed atomic move-trigger/cost/source-return sequence for this case.",
  "cfa-10617:0": "After this source is put on GC with a Bastion Vanguard, the player may move any number of grade-3-or-greater Rear-Guards to GC and grant each moved card battle-duration shield. Multi-card movement into GC with per-target shield changes is not authorized.",
  "cfa-10618:0": "The hit may be by this source or by the exact unit it boosted; a top-seven Bastion search is followed by a conditional self-retire if a card was revealed and this source remains back row. The linked attack identity, private filtered search, and conditional second step are not implemented as one validated sequence.",
  "cfa-10619:0": "ACT moves this source from RC into Soul as cost, selects a Vanguard, and grants a nested temporary CONT that gives Boost to all grade-3 Rear-Guards. Nested continuous keyword grants with group scope and end-of-turn expiry are unsupported.",
  "cfa-10619:1": "ACT activates from Soul, moves this exact source to Drop as cost, selects a grade-3 Rear-Guard, and grants it Boost until end of turn. A trusted Soul-source ACT plus temporary keyword grant is not available.",
  "cfa-1061:0": "This Hand CONT imposes a normal-ride prohibition based on the controller's Vanguard grade and clan. The ride legality checker does not evaluate this printed continuous restriction from Hand.",
  "cfa-1061:1": "This VC CONT prohibits this Vanguard from attacking unless its controller has a card named Blaster Blade in Soul. The attack legality gate does not enforce this exact named-Soul restriction.",
  "cfa-1061:2": "The ability requires this exact card's RC placement followed by retiring the source. No reviewed server definition currently authors this short AUTO for this card ID, so a generic printed-text match is not sufficient authorization.",
  "cfa-1061:3": "The ACT grants this Vanguard one attack that battles every opposing unit. Combat currently resolves a single declared target and does not model this multi-target battle rule.",
  "cfa-1061:4": "On this source's own VC attack, move every Soul card except Blaster Blade to Drop, then calculate power from the number actually moved. The resolver lacks this filtered bulk-zone move with a dependent count-based modifier.",
  "cfa-1061:5": "At this source's battle end, choose Blaster Blade from Soul or Drop, ride it rested, then move all Soul to Drop. The combined legal ride target, rest state, source-zone choice, and ordered cleanup are not implemented.",
  "cfa-10620:0": "The exact source must enter Soul from Deck, under a Nordlinger Vanguard condition, with an optional call specifically to back-row RC. Current event authorization does not preserve this origin-plus-destination condition and back-row placement choice.",
  "cfa-10622:1": "This trigger belongs to the joining/controller side when an opponent Rear-Guard is retired during its Main Phase; it also requires a per-turn limit, Soul Blast, top-five filtered call, and shuffle. No authorized server definition validates this opponent-action trigger and full resolution sequence.",
  "cfa-10623:0": "This source's own attack must target a Vanguard after Persona Ride; resolve Soul Blast, retire an opposing Rear-Guard, add battle power, then let the opponent choose and bind three Normal Units from Drop. The opponent-private choice and multi-step bind transaction are not supported together.",
  "cfa-10624:0": "This once-per-turn ACT binds one or more Soul cards as cost and grants a temporary dynamic card-name alias based on qualifying face-up Stealth cards in Bind. Multi-card bind cost plus dynamic name grants are unsupported.",
  "cfa-10624:1": "This once-per-turn ACT pays Counter Blast and moves two Rear-Guards to Soul, then searches for up to two cards matching this source's name, calls them, modifies both, and shuffles. The source-name multi-search and atomic two-card cost/call sequence are not authorized.",
  "cfa-10624:2": "This VC CONT grants back-row attack permission to same-name Stealth Rear-Guards only while the opponent's Vanguard is grade 3 or greater. The continuous evaluator does not implement this dynamic attack-location permission.",
  "cfa-10625:0": "This GC CONT requires a card name containing Overlord in Soul and adds shield. Although the generic continuous evaluator supports this name predicate, the authoritative GC shield contexts do not pass Soul card names, so the server would calculate no bonus during guard resolution; that requires a shared reducer context change outside this batch.",
  "cfa-10625:1": "ACT requires an opponent grade-3 Vanguard, retiring this source as cost, selecting a grade-3 Overlord from Drop, and moving that target to Soul. The filtered Drop target and cost-retire-to-soul effect are not an authorized transaction.",
  "cfa-10627:0": "The continuous bonus starts on the sixth or later battle of the controller's turn. The live continuous evaluator does not expose a reviewed current-turn battle-count condition for a Rear-Guard source.",
  "cfa-10628:0": "Bushiroad confirms the two-card Order Zone condition and opponent-turn activity, but continuous conditions only authorize selected predicates; the generic order-zone count currently appears in a specific AUTO guard rule and is not implemented for continuous power.",
  "cfa-1063:0": "ACT pays Counter Blast and moves this source to Soul, privately looks at the deck top, calls a Gold Paladin if present, and bottoms the remainder in the player's chosen order. The top-card filtered call with remainder ordering and atomic cost is not authorized."
});

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "ability-work-assignments.json"), "utf8"))
  .completedAssignments.find(batch => batch.batchId === batchId && batch.auditOnly === true);
if (!assignment) throw new Error(`Completed audit ${batchId} is missing from the assignment history.`);
if (JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...abilityIds].sort())) {
  throw new Error(`Contribution ability IDs differ from the reserved ${batchId} assignment.`);
}

const supportedSet = new Set([...alreadySupportedAbilityIds, ...proposedDefinitions.map(definition => definition.id)]);
const officialById = new Map(verifiedOfficialAbilities.map(item => [item.abilityId, item]));
const unsupportedAbilities = Object.freeze(abilityIds.filter(abilityId => !supportedSet.has(abilityId)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing exact catalog ability or blocker: ${abilityId}`);
  const official = officialById.get(abilityId);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null,
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
    officialPrintedText: officialById.get(abilityId)?.officialPrintedText || null,
    officialReference: officialById.get(abilityId)?.officialReference || null
  });
}));

module.exports = Object.freeze({
  batchId,
  abilityIds,
  alreadySupportedAbilityIds,
  supportedDefinitions,
  proposedDefinitions,
  unsupportedAbilities,
  verifiedOfficialAbilities
});
