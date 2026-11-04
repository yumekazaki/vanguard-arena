"use strict";

// Audit-only contribution. Ten assigned abilities already have production
// definitions. The other 32 remain unsupported because their conditions,
// event identity, costs, choices, zones, or effect sequences need handlers or
// validation that the current engine does not provide.
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-10526:0", "cfa-10526:1", "cfa-10527:0", "cfa-10527:1", "cfa-10528:0", "cfa-10528:1", "cfa-10529:0", "cfa-10530:0", "cfa-10531:0", "cfa-10531:1", "cfa-10532:0", "cfa-10532:1", "cfa-10533:0", "cfa-10533:1", "cfa-10534:0", "cfa-10534:1", "cfa-10535:0", "cfa-10535:1", "cfa-10535:2", "cfa-10536:0", "cfa-10536:1", "cfa-10537:0", "cfa-10538:0", "cfa-10539:0", "cfa-10540:0", "cfa-10540:1", "cfa-10541:0", "cfa-10541:1", "cfa-10542:0", "cfa-10543:0", "cfa-10543:1", "cfa-10544:0", "cfa-10545:0", "cfa-10546:0", "cfa-10546:1", "cfa-10547:0", "cfa-10547:1", "cfa-10549:0", "cfa-10549:1", "cfa-10550:0", "cfa-10550:1", "cfa-1055:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10532:0", "cfa-10532:1", "cfa-10533:0", "cfa-10534:0", "cfa-10535:0", "cfa-10536:0",
  "cfa-10543:0", "cfa-10543:1", "cfa-10549:1", "cfa-1055:0"
]);

const blockerById = Object.freeze({
  "cfa-10526:0": "The placed Order reveals five cards, filters by Monster name, and then splits selected cards between hand and drop. The choice cardinality and multi-zone resolution are not modeled by a trusted sequence.",
  "cfa-10526:1": "This Order-zone ACT must rest its exact source, select a Monster-named unit from Drop, and move that instance to Order Zone. The filtered Drop-to-Order move and its server authorization are not supported together.",
  "cfa-10527:0": "The placement AUTO pays Counter Blast, counts Research cards in Order Zone, and retires an opposing unit at or below that dynamic grade threshold. The count condition and target legality are not represented by a trusted definition.",
  "cfa-10527:1": "This source's own attack grants battle-long power only with three or more Research Orders. Exact attacker matching plus a typed Order-zone threshold has no reviewed handler.",
  "cfa-10528:0": "The placement AUTO has an OR condition for an Eva Glitter or Arkhite Vanguard, then pays Soul Blast 2 and draws. Neither name predicate is modeled as this exact condition, so the draw must remain blocked.",
  "cfa-10528:1": "The continuous power effect depends on three or more Research Orders during the controller's turn. A typed Order-zone threshold is not evaluated by the current continuous-condition handler.",
  "cfa-10529:0": "The trigger is another unit's placement in this source's same column during the controller's turn, and the effect targets that newly placed instance. The current trigger model lacks this exact placement-column subject and target binding.",
  "cfa-10530:0": "At turn end this source must move to Soul and create up to two Plant tokens on RC. Token identity, token choice, and atomic source-cost/call resolution are not supported as a trusted effect sequence.",
  "cfa-10531:0": "This placement AUTO optionally moves a selected Monster-named unit from Drop into Order Zone. The filtered target selection and zone move are not implemented as an authorized effect.",
  "cfa-10531:1": "The GC continuous shield bonus depends on two or more Research Orders. The shared zone-count predicate is absent from the trusted continuous evaluator.",
  "cfa-10533:1": "This ride AUTO requires the exact placed unit to have been ridden from a grade 0 Michu, then searches Deck for a named Order and places it in Order Zone. Ride-source history and filtered Order search are unsupported.",
  "cfa-10534:1": "This ride AUTO requires a grade 1 Michu as the exact ride source, then reveals up to one of two alternative card categories from the top five and adds the choice to hand. The source-grade/name predicate and filtered reveal choice are unsupported.",
  "cfa-10535:1": "This Drop ability reacts to any card entering Order Zone, checks for a Noqno unit, pays Soul Blast, and calls this exact source to back-row center with a duplicate-copy limit. The source-zone event, column call, and shared copy limit are not supported together.",
  "cfa-10535:2": "At the end of the Vanguard's attack this back-center source pays Counter Blast and discard, stands, swaps positions with the Vanguard, then reverses the swap at turn end. Battle-end identity and delayed position restoration are not modeled.",
  "cfa-10536:1": "The ACT combines an All Set Up predicate, Counter Blast, draw, and a hand choice to call or discard; the embedded Cannonball AUTO is a second ability with Soul Blast, opponent retirement, and battle power. The parser does not safely split and resolve these distinct abilities.",
  "cfa-10537:0": "The GB2 AUTO requires this exact Vanguard's attack to finish, pays Counter Blast and two discards, moves the source face up to G zone, selects a Chronojet Vanguard, and stands it. The full cost, G-zone move, and target sequence is unsupported.",
  "cfa-10538:0": "The ACT pays by moving this exact Rear-Guard into Soul, then privately chooses whether to call or discard the revealed top card. The ordered source cost and mutually exclusive top-card outcomes are not covered by one trusted handler.",
  "cfa-10539:0": "The AUTO can trigger from RC placement or GC placement and checks the controller's Rear-Guard count against the opponent's before granting both power and shield. Dual-zone timing and the comparative board condition are not validated together.",
  "cfa-10540:0": "This AUTO requires the exact source to move from Soul to Drop during its controller's turn, pays Counter Blast, then calls it to a back-row circle determined by a front-row Rarami. The source-move event and name-linked column target are unsupported.",
  "cfa-10540:1": "At the end of the exact boost battle, all units in this column must move to Soul; a Rarami movement result, prior Counter Charge history, Soul Blast, and Counter Charge form a dependent sequence. The movement and event-history conditions are unsupported.",
  "cfa-10541:0": "This AUTO requires the exact source to move from Soul to Drop during its controller's turn, pays Counter Blast, and calls it behind a front-row Ririmi. The source-move trigger and name-linked open-circle call are unsupported.",
  "cfa-10541:1": "At boost battle end this source must move every unit in its column to Soul, detect whether a Ririmi moved, then choose a unit for power. Mandatory mass movement followed by a dependent target choice is not modeled.",
  "cfa-10542:0": "Placement from Soul grants temporary power and a nested boosted-attack-hit AUTO that later moves this source to Soul and draws. The granted ability's lifetime and exact boost/hit/source sequence are unsupported.",
  "cfa-10544:0": "The source's own boost grants battle power only when Order Zone contains three differently named Set Orders. Exact booster matching and the unique-name Order predicate lack a trusted handler.",
  "cfa-10545:0": "This source's own boost may Soul Charge only when its controller's Vanguard is grade 3 or greater. The source-specific boost event, grade condition, and optional resolution are not compiled as this ability.",
  "cfa-10546:0": "The continuous power/shield bonus depends on having called at least two units this turn and applies differently in RC and GC. Turn-scoped call history and dual-zone modifiers are not supported together.",
  "cfa-10546:1": "The AUTO can trigger on RC placement or GC placement, discards a card, reveals three, selects a grade 2-or-less card, calls to the matching destination, and bottoms the remainder in order. Destination-dependent call and ordered Deck return are unsupported.",
  "cfa-10547:0": "This continuous replacement changes the grade of this exact Soul card only while it is being paid as a Vanguard ability's Soul Blast cost. The cost-payment context and grade substitution are not implemented.",
  "cfa-10547:1": "Once per turn during Battle Phase, this AUTO reacts to a card moving from Soul to Drop, pays Counter Blast, draws, and scales this source's power by the moved card's grade. Exact event subject, grade capture, and usage tracking are unsupported.",
  "cfa-10549:0": "The ride AUTO requires the ridden-over source plus a rider with Pale Moon as its only clan, then privately chooses up to one of the top seven cards for Soul. Ride-source clan filtering and the top-card Soul choice are unsupported.",
  "cfa-10550:0": "The ride AUTO requires a Pale Moon-only rider, Soul Charges, then chooses a Soul card to return to hand. Exact ride-clan eligibility and the follow-up Soul target choice are not represented by a trusted sequence.",
  "cfa-10550:1": "The effect triggers when this exact unit is placed on RC or GC, checks for a Luquier Vanguard, and grants both power and shield. The dual-zone placement scope and condition are not validated together."
});

const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "ability-work-batches.json"), "utf8")).batches.find(batch => batch.batchId === "ABILITY-320008F1-0020");
if (!assignment || JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...abilityIds].sort())) throw new Error("Batch ID list differs from the reserved assignment.");

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "card-verification-manifest.json"), "utf8"));
const recordsByAbility = new Map((manifest.records || []).map(record => [String(record.abilityId), record]));
const supportedSet = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) throw new Error(`Missing exact blocked ability or blocker: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, officialReference: null, blocker: blockerById[abilityId] });
}));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  const record = recordsByAbility.get(abilityId);
  if (!ability?.definition || ability.definition.printedText !== ability.printedText || record?.status !== "tests-passing" || !record.testFiles?.length || !record.testCases?.length) throw new Error(`Expected tested, exact production definition missing: ${abilityId}`);
  return Object.freeze({ abilityId, cardName: card.name, kind: ability.kind, printedText: ability.printedText, definitionSource: ability.definition.source?.patternId || "compiled keyword definition", testFiles: record.testFiles, testCases: record.testCases });
}));

const result = [];
Object.defineProperty(result, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0020",
    status: "ten-existing-definitions-thirty-two-blocked",
    dataset: "Cardfight Area local catalog snapshot",
    catalogSnapshotDate: "2025-05-09",
    officialTextChecked: false,
    officialReferences: Object.freeze({}),
    abilityIds,
    proposedDefinitionIds: Object.freeze([]),
    implementedAbilityIds: Object.freeze([]),
    alreadySupportedAbilityIds,
    supportedProductionDefinitions,
    fullyTestedWholeCardIds: Object.freeze([]),
    unsupportedSiblings,
    provenanceNote: "All 42 assigned IDs were compared with exact local catalog text, production definitions, and ability-level evidence. Ten have exact existing production definitions with passing pattern-level tests; 32 have concrete gaps involving unmodeled triggers, conditions, costs, choices, zones, or effect sequences. No new definition was proposed because this audit did not establish both authoritative text and a complete trusted client/server path for another assigned ability. Unsupported catalog text was not represented as official-text verified."
  })
});
Object.defineProperty(result, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = result;
