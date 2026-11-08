"use strict";

// Audit-only manifest of the remaining unsupported items in this source batch.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const abilityIds = Object.freeze([
  "cfa-1596:0", "cfa-1597:0", "cfa-1598:0", "cfa-1599:0", "cfa-1599:1",
  "cfa-1600:0", "cfa-1601:0", "cfa-1602:0", "cfa-1603:0", "cfa-1604:0",
  "cfa-1605:0", "cfa-1605:1", "cfa-1606:0", "cfa-1607:0", "cfa-1608:0",
  "cfa-1608:1", "cfa-1609:0", "cfa-160:0", "cfa-160:1", "cfa-1610:0",
  "cfa-1611:0", "cfa-1612:0", "cfa-1612:1", "cfa-1613:0", "cfa-1614:0",
  "cfa-1615:0", "cfa-1616:0", "cfa-1617:0", "cfa-1617:1", "cfa-161:0",
  "cfa-16:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-1599:0", "cfa-1599:1", "cfa-1600:0", "cfa-1602:0", "cfa-1604:0",
  "cfa-1605:1", "cfa-1607:0", "cfa-1608:0", "cfa-1608:1", "cfa-160:0", "cfa-1612:0",
  "cfa-1612:1",
  "cfa-1617:0", "cfa-16:0"
]);

const blockerById = Object.freeze({
  "cfa-1596:0": "No trusted program combines an exact RC placement trigger, Link Joker Vanguard and opponent-locked-card conditions, Counter Blast 1, a grade-1-or-less Star-vader Deck filter, a call to RC, and conditional shuffle.",
  "cfa-1597:0": "No trusted attack handler includes the opponent-locked-card condition while binding the power effect to this exact attacking RC source for this battle.",
  "cfa-1598:0": "The named-booster handler does not model the additional opponent-locked-card condition; broadening it would allow an illegal prompt when that condition is false.",
  "cfa-1601:0": "No trusted event/effect program handles an opponent-owned card entering its bind zone during the controller's turn and grants this exact RC source power until turn end.",
  "cfa-1603:0": "The ability combines a VC-or-RC own-attack hit, a Nova Grappler Vanguard condition, Counter Blast filtered by Beast Deity name, and standing another Nova Grappler Rear-Guard. Existing on-hit stand handlers do not support this complete source/cost combination.",
  "cfa-1605:0": "Sentinel is a deck-construction restriction, but this keyword record is not accepted by the authoritative server trust check. It cannot be counted as a supported server-enforced ability from this batch.",
  "cfa-1606:0": "No trusted handler models this exact source becoming stand during the battle phase, the optional Counter Blast filtered by Beast Deity name, and standing another friendly Nova Grappler Rear-Guard.",
  "cfa-1609:0": "The effect requires a grade-3 Great Nature drive-check event, selection of two Great Nature Rear-Guards, an optional temporary power grant, and delayed retirement of those exact selected units at turn end; no trusted ordered/deferred effect program covers it.",
  "cfa-160:1": "Although a related RC attack-hit stand handler exists, the authoritative handler is an exact-text/card allowlist for different IDs and 'grade 1 or less' wording. Lion Heat says 'grade 1 or lower'; the existing allowlisted handler cannot safely be reused for this unlisted definition.",
  "cfa-1610:0": "The ability needs an end-phase RC-to-Drop movement event, Counter Blast plus selection of three grade-1-or-greater Great Nature cards with a name exclusion from Drop to Deck top, then same-name Deck search/reveal/hand and shuffle. No trusted handler implements this atomic multi-cost sequence.",
  "cfa-1611:0": "No trusted handler combines placement on RC specifically from Drop, a Great Nature Vanguard condition, and a +3000 turn-duration modifier for the exact source.",
  "cfa-1613:0": "The VC/RC source's attack modifier requires an Aqua Force Vanguard and exactly the second battle; the existing power handlers do not verify that battle ordinal.",
  "cfa-1614:0": "This on-hit effect requires a fourth-or-later battle, Counter Blast 1, then standing another Aqua Force Rear-Guard and granting that target +5000 until turn end. Existing on-hit stand handlers do not validate the battle count or full two-step target effect.",
  "cfa-1615:0": "The battle-close AUTO must stand its attacking source, apply a -5000 modifier, and consume its once-per-turn restriction when the ability is used. No trusted handler represents this complete self-stand/negative-power/use-limit sequence.",
  "cfa-1616:0": "No trusted authoritative effect swaps two Rear-Guard positions while preserving each card's state, after this exact unit boosted and its controller pays Counter Blast 1.",
  "cfa-1617:1": "The ACT moves its source into Soul and grants a different Aqua Force unit a temporary AUTO that checks fourth-or-later attacks and draws. Dynamic, temporary ability granting is not supported by the trusted effect handlers.",
  "cfa-161:0": "No trusted AUTO handler applies an opponent-wide no-intercept restriction only for the exact battle initiated by this VC/RC source's attack."
});

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const supported = new Set(alreadySupportedAbilityIds);
const unsupportedSiblings = Object.freeze(abilityIds.filter(abilityId => !supported.has(abilityId)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing catalog ability or concrete blocker for ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: null,
    officialReference: null,
    blocker: blockerById[abilityId]
  });
}));
const supportedProductionDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const ability = Engine.parseCardAbilitiesCached(byCard.get(cardId)).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing definition missing: ${abilityId}`);
  return Object.freeze({
    abilityId,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled production definition"
  });
}));

const result = [];
Object.defineProperty(result, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-320008F1-0140",
    status: "12-existing-trusted-definitions-19-unresolved",
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
    provenanceNote: "All 31 assigned ability records were checked against exact local catalog text, the compiler output, the current engine definitions, and authoritative server trust/effect gates. Twelve now have matching trusted production definitions, including cfa-1608:1 from the exact shared stand-trigger family contribution. The other 19 retain explicit blockers and are not represented by placeholders or marked verified. Official card-list text confirmation and whole-card verification were not performed for the remaining audit records."
  })
});
Object.defineProperty(result, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = result;
