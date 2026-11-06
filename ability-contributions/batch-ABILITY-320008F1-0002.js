"use strict";

const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const standAbilityDefinitions = Object.freeze([
  {
    id: "cfa-10025:1", cardId: "cfa-10025", kind: "AUTO",
    printedText: "AUTO [RC] 1/Turn: When this unit stand by your card’s ability, this unit gets power +5000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: { status: "recognized-trigger", eventType: "unit.stood", subject: "event-subject", circles: ["rear-guard"], subjectControllerRelation: "source-controller", effectCause: "card-ability", effectSourceControllerRelation: "source-controller" },
    conditions: [], conditionsReviewed: true, costs: [], costsReviewed: true, choicesReviewed: true,
    optional: false, once: true,
    usageRestriction: { type: "once-per-turn", scope: "ability-instance", reset: "turn" },
    consumeUsageOnTrigger: true,
    source: { dataset: "Bushiroad official card information", snapshotDate: "2026-11-04", officialCardNumber: "D-VS05/072EN", officialReference: "https://en.cf-vanguard.com/deckrecipe/detail/d-vs05-aqua-force", patternId: "auto-rc-stand-by-card-ability-power-turn-v1", review: "Official Ripple deck recipe confirms Rising Ripple, Pavroth gains +5000 when stood by a card ability. Eligibility requires this exact Rear-Guard instance to be the unit stood by an ability controlled by the same player; a rule-based stand or an opponent's effect does not qualify. The once-per-turn restriction is per card instance and ability, and power expires at turn end." },
    effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }]
  },
  {
    id: "cfa-10026:1", cardId: "cfa-10026", kind: "AUTO",
    printedText: "AUTO [RC] 1/Turn: When this unit stand by your card’s ability, this unit gets power +5000 until end of turn.",
    requiredLocation: ["rear-guard"],
    trigger: { status: "recognized-trigger", eventType: "unit.stood", subject: "event-subject", circles: ["rear-guard"], subjectControllerRelation: "source-controller", effectCause: "card-ability", effectSourceControllerRelation: "source-controller" },
    conditions: [], conditionsReviewed: true, costs: [], costsReviewed: true, choicesReviewed: true,
    optional: false, once: true,
    usageRestriction: { type: "once-per-turn", scope: "ability-instance", reset: "turn" },
    consumeUsageOnTrigger: true,
    source: { dataset: "Bushiroad official card text and errata", snapshotDate: "2026-11-04", officialCardNumber: "D-VS05/073EN", officialReference: "https://en.cf-vanguard.com/dvs0506-errata-list/", patternId: "auto-rc-stand-by-card-ability-power-turn-v1", review: "Official errata confirms Silent Ripple, Sotirio's wording is stood by your card's abilities, and the official Ripple deck recipe confirms +5000 until end of turn. Eligibility requires this exact Rear-Guard instance to be the unit stood by an ability controlled by the same player; a rule-based stand or an opponent's effect does not qualify. The once-per-turn restriction is per card instance." },
    effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }]
  }
]);
const contribution = [...standAbilityDefinitions];
const abilityIds = Object.freeze([
  "cfa-10023:0", "cfa-10023:1", "cfa-10024:0", "cfa-10024:1", "cfa-10025:0", "cfa-10025:1",
  "cfa-10026:0", "cfa-10026:1", "cfa-10030:0", "cfa-10032:0", "cfa-10032:1", "cfa-10033:0",
  "cfa-10034:0", "cfa-10035:0", "cfa-10036:0", "cfa-10037:0", "cfa-10037:1", "cfa-10038:0",
  "cfa-10038:1", "cfa-10039:0", "cfa-10039:1", "cfa-10039:2", "cfa-10039:3", "cfa-1003:0",
  "cfa-1003:1", "cfa-10040:0", "cfa-10040:1", "cfa-10042:0", "cfa-10042:1", "cfa-10043:0",
  "cfa-10044:0", "cfa-10045:0", "cfa-10046:0", "cfa-10048:0", "cfa-10048:1", "cfa-10049:0",
  "cfa-10049:1", "cfa-1004:0", "cfa-1004:1", "cfa-1004:2", "cfa-10050:0", "cfa-10050:1", "cfa-1005:0"
]);

const supportedIds = Object.freeze([
  "cfa-1004:1", "cfa-1004:2", "cfa-10030:0", "cfa-10032:0", "cfa-10032:1",
  "cfa-10033:0", "cfa-10040:0", "cfa-10040:1", "cfa-10048:0"
]);
const implementedIds = Object.freeze(standAbilityDefinitions.map(definition => definition.id));
const completedIds = new Set([...supportedIds, ...implementedIds]);

const blockerById = Object.freeze({
  "cfa-10023:0": "The controller-turn CONT must count all locked cards and apply +5000 per locked card to every controlled Battle Sister unit. No reviewed continuous handler evaluates this locked-card count together with the name-filtered cross-unit modifier.",
  "cfa-10023:1": "Requires Counter-Blast 1 and discard, a top-deck look count based on distinct Battle Sister names, arbitrary top/bottom ordering, then locking one or more distinct-name Battle Sister rear-guards and drawing once per card locked. The engine does not validate this complete sequential choice/cost/effect program or lock/draw scaling.",
  "cfa-10024:0": "Requires a once-per-turn VC ACT, Soul-Blast 1, looking at exactly five deck cards, choosing up to one and calling it to a legal RC, then shuffling. No reviewed handler supports this exact look-five/call/shuffle sequence and usage restriction.",
  "cfa-10024:1": "The exact Vanguard must attack while the controller has no standing front-row units; then Counter-Blast 1, stand a chosen rear-guard, conditionally stand all rear-guards at four or more damage, and grant +5000 until turn end to each unit stood if the specified Rising Ripple is in soul. The event, combined cost, stood-unit set, damage branch, and soul condition are not supported together.",
  "cfa-10025:0": "Requires this exact VC/RC source to attack, Soul-Blast 1, search the top seven for the exact Genovious name, reveal/add it and shuffle; when the source is on RC it must also move itself into soul at that battle's end. No reviewed handler combines exact source-attack matching, filtered top-seven search, and delayed self-movement.",
  "cfa-10026:0": "Requires this exact card instance to be placed on VC, then a top-seven search for up to one exact Genovious or Pavroth, reveal/add, and shuffle. No reviewed handler supports this VC-only placement trigger and two-name filtered search.",
  "cfa-10034:0": "Requires exact RC placement while the controller's Vanguard is Chronotiger Rebellion, Counter-Blast 1, bind the entire hand, return those exact cards at turn end, and if at least three were bound grant a temporary opponent-guardian shield reduction. The engine lacks this bound-card snapshot/delayed-return and conditional shield-effect sequence.",
  "cfa-10035:0": "Requires Soul-Blast 1, both players drawing, and at grade 3+ both players privately selecting a hand card to call; opponent call-trigger AUTO abilities must be suppressed for that call. Independent private choices, sequential resolution, and exact event suppression are not supported by one trusted effect program.",
  "cfa-10036:0": "Requires Soul-Blast 1 plus discarding a Я-named card, then looking at seven cards, choosing up to two differently named Star-vader cards, revealing/adding them and shuffling. The exact Я name filter, distinct-name choice, and combined paid-search sequence are not supported.",
  "cfa-10037:0": "Requires exact VC placement followed by a top-seven search for up to one Я-named card, reveal/add, and shuffle. No reviewed handler supports the Я name filter with this VC-only trigger.",
  "cfa-10037:1": "Requires the exact Omega Glendios Vanguard condition and grants Intercept plus a replacement original shield value of 10000 to all Я-named rear-guards. The engine has no trusted CONT handler for this name-filtered keyword and original-shield replacement.",
  "cfa-10038:0": "Requires VC/RC placement while the controller has a Star-vader Vanguard, Counter-Blast 1, then deck-search up to one Я-named card, reveal/add, and shuffle. This exact conditional name-filtered AUTO and cost/search sequence is not trusted.",
  "cfa-10038:1": "Requires a turn-long +5000 modifier for each differently named Я card in the controller's bind zone. No reviewed continuous modifier counts distinct names in bind and recalculates the exact RC source's power.",
  "cfa-10039:0": "Requires the original power of every controlled Я-named rear-guard to become 18000, preserving original power and applying the replacement at the correct continuous layer. No reviewed handler models this multi-unit original-power replacement.",
  "cfa-10039:1": "Requires a win check at the beginning of main phase for both five or more own damage and five or more opponent locked cards, followed by authoritative game-end handling. Locked-card state and exact win-condition integration are not implemented by a trusted ability definition.",
  "cfa-10039:2": "Requires a once-per-turn VC ACT with Soul-Blast 1 and binding a Я-named card from drop whose name differs from face-up bind cards, then preventing the opponent from turning cards face up during their next end phase. The filtered bind cost and scoped unlock/release/delete/counter-charge restriction are unsupported.",
  "cfa-10039:3": "Requires a once-per-turn trigger from placement of the controller's exact Я-named unit, then choosing and locking an opponent rear-guard that is not on an additional circle. No trusted handler validates the source placement and target-circle restriction together.",
  "cfa-1003:0": "Requires Limit Break 4, Counter-Blast 2, standing all Nova Grappler rear-guards, checking how many actually stood, granting critical +1 if at least four did, and preventing reuse for the rest of that turn. No reviewed handler represents the exact stand-count result and same-turn usage lock.",
  "cfa-1003:1": "Requires an ACT in VC to rest two distinct Death Army rear-guards as cost and grant the source +5000 until turn end. The exact named two-unit rest cost and validated source modifier are not supported together.",
  "cfa-10042:0": "This CONT replaces the discard-count interpretation for costs of the controller's Overlord Vanguard ability: this exact card may count as two discarded cards. The engine has no trusted cost-replacement operation or cost-payment identity for this rule.",
  "cfa-10042:1": "Requires this exact card to be discarded from hand specifically for the controller's Overlord Vanguard ability cost; its controller may then call it to back-row RC and, if called, grant it +5000 until turn end. Discard reason/ability provenance and this conditional call sequence are unavailable.",
  "cfa-10043:0": "Requires the exact RC source to attack a Vanguard, then grants battle-only power equal to +2000 times the opponent's currently open RC count. No reviewed handler computes this opponent-zone-dependent battle modifier from the matching attack event.",
  "cfa-10044:0": "Requires an originalDress rear-guard to exist and grants this source +2000 power and +5000 shield while on RC/GC. The trusted state model does not preserve or evaluate originalDress status for this continuous power-and-shield effect.",
  "cfa-10045:0": "Requires exact RC placement and at least five cards in soul, then selecting a different friendly unit and granting it +5000 until turn end. No reviewed handler validates this soul-count condition and chosen-target placement effect as one AUTO.",
  "cfa-10046:0": "Requires exact RC-source attack, Counter-Blast 1, choosing a soul card, moving that card to drop, and granting the source battle power equal to that card's original shield. Original shield metadata and atomic cost/target/movement-derived power are not handled by a trusted definition.",
  "cfa-10048:1": "Requires being ridden by the exact Youthberk rider, Soul-Blast 1, looking at three cards, choosing either a Youthberk card for hand or a grade-2-or-less unit to call, then ordering the remainder on deck bottom. Ride identity, exclusive branch choice, target validation, and ordered deck return are not supported together.",
  "cfa-10049:0": "Requires the exact ride event to identify a rider with the RevolDress ability, Counter-Blast 1, then choosing a grade-2-or-greater card from drop and returning it to hand. Rider-keyword event matching and filtered target/cost handling are not trusted.",
  "cfa-10049:1": "Requires this exact VC/RC source to be the unit boosted in the current battle, Soul-Blast 1, and gain +5000 for that battle. Strict boosted-source identity is not recognized for this ability and the cost/modifier sequence has no reviewed definition.",
  "cfa-1004:0": "Requires Limit Break 4 and this exact Vanguard's attack against a Vanguard; the controller may pay Counter-Blast 3 to stand up to two Beast Deity rear-guards. Recognized own-attack machinery does not supply this optional named-target stand effect and limit-break/cost validation together.",
  "cfa-10050:0": "The parsed catalog block combines a CONT ride-name alias with a separate embedded 'RevolDress - AUTO [VC]' battle-end stand-ride ability. Neither part has a reviewed executable definition, and the AUTO is not emitted as a separate parsed ability ID, so it cannot be safely implemented or claimed supported under this ID.",
  "cfa-10050:1": "Requires an RC source to gain +5000 only if a grade-3-or-greater Vanguard was placed this turn. The trusted state/event model does not expose and validate this exact current-turn Vanguard-placement condition for a continuous modifier.",
  "cfa-1005:0": "Requires Counter-Blast 1 and retiring two Oracle Think Tank rear-guards, then searching for the exact Goddess of the Sun, Amaterasu, revealing it and adding it to hand. No reviewed ACT handler validates this named two-unit retirement cost followed by the exact deck search."
});

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Batch card missing from local catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name, grade: Number(card.grade), type: card.type || null, clan: card.clan || (card.clans || []).join(" / "), catalogSource: card.source || "Cardfight Area snapshot 2025-05-09" });
}));
const parsedById = new Map();
for (const cardId of cardIds) for (const ability of Engine.parseCardAbilitiesCached(cardsById.get(cardId))) parsedById.set(ability.id, ability);
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !completedIds.has(id)).map(abilityId => {
  const ability = parsedById.get(abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed text or blocker for ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, blocker: blockerById[abilityId] });
}));
const supportedProductionDefinitions = Object.freeze(supportedIds.map(abilityId => {
  const ability = parsedById.get(abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing for ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, printedText: ability.printedText, definitionSource: ability.definition.source?.patternId || "compiled production definition" });
}));
const hiddenRevolDressText = "RevolDress - AUTO [VC]: At the end of the battle this unit attacked, choose up to one card with \"RevolForm\" in its card name from your hand, ride it as stand, and it gets drive -2 until end of turn.";
if (!parsedById.get("cfa-10050:0")?.printedText.includes(hiddenRevolDressText)) throw new Error("The cfa-10050 embedded RevolDress AUTO text is missing from the catalog parse.");

const audit = Object.freeze({
  batchId: "ABILITY-320008F1-0002",
  status: "two-reviewed-stand-trigger-definitions",
  dataset: "Cardfight Area local card catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  officialTextChecked: false,
  abilityIds,
  implementedAbilityIds: implementedIds,
  alreadySupportedAbilityIds: supportedIds,
  supportedProductionDefinitions,
  cards,
  unsupportedSiblings,
  parserLimitations: Object.freeze([Object.freeze({
    cardId: "cfa-10050",
    parsedAbilityId: "cfa-10050:0",
    note: "The local parser includes the separate RevolDress AUTO text inside the CONT block's printedText and does not emit a separate ability record/ID. It remains unsupported; do not treat the embedded AUTO as part of the ride-name alias effect."
  })]),
  provenanceNote: "Ability text is copied exactly from the local Cardfight Area catalog snapshot dated 2025-05-09. The two compiled stand-trigger abilities were checked against Bushiroad's official Ripple deck recipe and, for Silent Ripple, Sotirio, the D-VS05 errata list. Other unsupported records remain unverified against official text; their officialPrintedText is null. Existing production definitions are identified separately and are not reimplemented here."
});

Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = contribution;
