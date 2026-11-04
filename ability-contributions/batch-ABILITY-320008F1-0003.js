"use strict";

// Audit-only contribution. Existing trusted definitions are recorded below;
// this batch adds no executable definitions.
const contribution = [];
const sourceByCard = Object.freeze({
  "cfa-10051": {
    "name": "Youthberk \"RevolForm: Zest\"",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10054": {
    "name": "Witch of Revocation, Fectil",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact ability text verified against the Bushiroad official card list, D-TD03/011EN."
  },
  "cfa-10055": {
    "name": "Internalize Mage",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10056": {
    "name": "Guardian of the Verdant, Patriya",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10058": {
    "name": "Knight of Partings, Lloygre",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10059": {
    "name": "Knight of Piercing, Cadwalla",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-1006": {
    "name": "Supple Bamboo Princess, Kaguya",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10060": {
    "name": "Stardiness Dragon",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10064": {
    "name": "Steel Equip Dragon, Bargon",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10065": {
    "name": "Spree Wasper",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10068": {
    "name": "Jewel Core Dragon",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10069": {
    "name": "Demonic Stone Dragon, Jewelneel",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10070": {
    "name": "Jewel-embracing Dragon Fang, Drajeweled",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10071": {
    "name": "Mystic Accordionist",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10072": {
    "name": "Direful Doll, Kjerstin",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10075": {
    "name": "Changing Magic, Memeruru",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10076": {
    "name": "Dianadigon Sorceress",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10077": {
    "name": "Friend of the Netherworld, Ling",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10078": {
    "name": "Ultrasound Sirie",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10079": {
    "name": "One Who Calls Upon Raging Thunder, Furgres",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-1008": {
    "name": "Machine-gun Talk Ryan",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10080": {
    "name": "Truculence Raider",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10081": {
    "name": "Avid Heaper",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10084": {
    "name": "Cardinal Noid, Corofie",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  },
  "cfa-10085": {
    "name": "Desire Devil, Phamaan",
    "catalogSnapshotDate": "2025-05-09",
    "textProvenance": "Exact local catalog text; official text was not independently checked in this batch audit."
  }
});
const supportedDefinitions = Object.freeze([
  {
    "abilityId": "cfa-10051:1",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [VC]: At the end of your turn, choose a card with the RevolDress ability from your soul, and ride it as rest.",
    "patternId": "auto-vc-end-turn-revoldress-ride-from-soul-rest-v1",
    "implementationStatus": "already-supported-in-production"
  },
  {
    "abilityId": "cfa-10055:0",
    "kind": "ACT",
    "catalogPrintedText": "ACT [RC] 1/Turn: If you have a vanguard with \"Youthberk\" in its card name, COST [Counter Blast 2], and this unit gets power +10000 until end of turn.",
    "patternId": "act-rc-youthberk-counter-blast-power-turn-v1",
    "implementationStatus": "already-supported-in-production"
  },
  {
    "abilityId": "cfa-10064:0",
    "kind": "ACT",
    "catalogPrintedText": "ACT [RC] 1/Turn: COST [Counter Blast 1], choose one of your vanguards, and it gets power +5000 until end of turn.",
    "patternId": "act-rc-counter-blast-choose-vanguard-power-turn-v1",
    "implementationStatus": "already-supported-in-production"
  },
  {
    "abilityId": "cfa-10068:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this unit is rode upon by \"Demonic Stone Dragon, Jewelneel\", call this card to RC.",
    "patternId": "auto-rode-upon-named-grade-source-call-v1",
    "implementationStatus": "already-supported-in-production"
  },
  {
    "abilityId": "cfa-1006:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: Forerunner (When another unit from the same clan rides this unit, you may call it to RC.)",
    "patternId": "auto-forerunner-same-clan-ride-call-source-v1",
    "implementationStatus": "already-supported-in-production"
  },
  {
    "abilityId": "cfa-1006:1",
    "kind": "ACT",
    "catalogPrintedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Oracle Think Tank», and that unit gets power +3000 until end of turn.",
    "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
    "implementationStatus": "already-supported-in-production"
  },
  {
    "abilityId": "cfa-10072:0",
    "kind": "ACT",
    "catalogPrintedText": "ACT [RC] 1/Turn: If your vanguard is grade 3 or greater, COST [Counter Blast 2], and draw a card.",
    "patternId": "act-rc-grade-three-counter-blast-draw-v1",
    "implementationStatus": "already-supported-in-production"
  },
  {
    "abilityId": "cfa-10076:0",
    "kind": "CONT",
    "catalogPrintedText": "CONT [GC]: If you have a vanguard with \"Sorceress\" in its card name, this unit gets shield +10000.",
    "patternId": "cont-gc-named-vanguard-shield-v1",
    "implementationStatus": "already-supported-in-production"
  },
  {
    "abilityId": "cfa-10081:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [RC]: When this unit boosts a grade 2 or greater unit, you may Soul Charge 1.",
    "patternId": "auto-own-boost-soul-charge-v1",
    "implementationStatus": "added-to-production-by-primary-session"
  },
  {
    "abilityId": "cfa-10054:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this card is discarded from hand during your ride phase, you may call this card to RC.",
    "officialPrintedText": "AUTO: When this card is discarded from hand during your ride phase, you may call this card to RC.",
    "officialCardNumber": "D-TD03/011EN",
    "patternId": "auto-ride-phase-discard-source-call-standing-v1",
    "implementationStatus": "added-to-production-by-primary-session"
  },
  {
    "abilityId": "cfa-10069:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, Soul Charge 1.",
    "officialPrintedText": "AUTO [VC/RC]: When this unit's attack hits a vanguard, Soul Charge 1.",
    "patternId": "auto-own-attack-hit-soul-charge-one-v1",
    "implementationStatus": "added-to-production-by-primary-session"
  },
  {
    "abilityId": "cfa-10069:1",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this unit is rode upon by a unit with \"Drajeweled\" in its card name, Soul Charge 1, and if your soul has three or more cards with different grades, draw a card.",
    "officialPrintedText": "AUTO: When this unit is rode upon by a unit with \"Drajeweled\" in its card name, Soul Charge 1, and if your soul has three or more cards with different grades, draw a card.",
    "patternId": "auto-jewelneel-rode-upon-drajeweled-soul-charge-distinct-grade-draw-v1",
    "implementationStatus": "added-to-production-by-primary-session"
  },
  {
    "abilityId": "cfa-10071:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this card is discarded from hand during your ride phase, you may put this card into your soul.",
    "officialPrintedText": "AUTO: When this card is discarded from hand during your ride phase, you may put this card into your soul.",
    "officialCardNumber": "D-TD02/007EN",
    "patternId": "auto-ride-phase-discard-source-to-soul-v1",
    "implementationStatus": "added-to-production-by-primary-session"
  }
].map(Object.freeze));
const unsupportedSiblings = Object.freeze([
  {
    "abilityId": "cfa-10051:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this unit is placed on VC by the RevolDress ability, until end of turn, this unit gets power +15000, and if you persona rode this turn, it gets critical +1.",
    "officialPrintedText": null,
    "blocker": "The recognized placement trigger does not retain proof that this exact Vanguard instance was placed by a RevolDress ability. The effect also depends on the controller persona-riding this turn before granting critical +1. Both provenance and the persona-ride condition/effect need trusted event state."
  },
  {
    "abilityId": "cfa-10056:0",
    "kind": "CONT",
    "catalogPrintedText": "CONT [GC]: If you have five or more units, this unit gets shield +5000.",
    "officialPrintedText": null,
    "blocker": "This Guardian Circle CONT needs a live count of the controller’s units (five or more) and +5000 shield on this exact guardian. The current catalog has no trusted unit-count continuous-shield definition for this text."
  },
  {
    "abilityId": "cfa-10058:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [RC]: When your vanguard is placed by the RevolDress ability, COST [Counter Blast 1], and this unit gets power +10000 until end of turn.",
    "officialPrintedText": null,
    "blocker": "The trigger requires a Vanguard-placement event specifically caused by a RevolDress ability. The parser leaves the event unrecognized, and the reducer has no trusted ability-source provenance check for RevolDress placement; Counter Blast 1 and +10000 turn power are therefore not executable."
  },
  {
    "abilityId": "cfa-10059:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [RC]: At the end of the battle that this unit attacked a vanguard, if you have four or more units, COST [Soul Blast 1 & retire this unit], look at the top three cards of your deck, choose up to one grade 2 or greater unit card from among them, reveal it and put it into your hand, and shuffle your deck. If you did not reveal a card, draw a card.",
    "officialPrintedText": null,
    "blocker": "This is a battle-close AUTO for the exact source after it attacked the Vanguard, additionally requiring four or more units. Resolution must atomically pay Soul Blast 1 and retire that source, then privately inspect three cards, optionally reveal/add a grade-2-or-greater unit, shuffle, and draw if none was revealed. Trigger timing, unit count, cost sequencing, private choice, and fallback are not covered by a trusted definition."
  },
  {
    "abilityId": "cfa-10060:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this unit intercepts, if your soul has a card with \"RevolForm\" in its card name, this unit gets shield +10000 until end of that battle.",
    "officialPrintedText": null,
    "blocker": "The event must be this exact unit intercepting from RC into GC, with a Soul card whose name contains RevolForm at the required check, and +10000 shield only until that battle ends. The parsed placement candidate does not encode the Soul condition or battle-scoped shield effect, and has no trusted resolver."
  },
  {
    "abilityId": "cfa-10065:0",
    "kind": "CONT",
    "catalogPrintedText": "CONT [RC]: During the battle this unit attacked a grade 2 or greater vanguard, this unit gets power +5000.",
    "officialPrintedText": null,
    "blocker": "This CONT must add +5000 only during the battle where this exact RC source attacked an opponent Vanguard of grade 2 or greater. Although existing continuous-power primitives exist, this card has no registered trusted definition binding both conditions to this source and battle context, so it remains unavailable."
  },
  {
    "abilityId": "cfa-10068:1",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [RC]: When this unit attacks or boosts, this unit gets power +5000 until end of that battle. At the end of that battle, put this unit into your soul. (This effect is mandatory)",
    "officialPrintedText": null,
    "blocker": "The text has two distinct events (this exact RC unit attacks or boosts), grants +5000 for that battle, then mandatorily moves this same source into Soul at battle end. The parsed trigger only covers attack; it does not safely model the boost alternative, delayed mandatory movement, or end-of-battle sequence."
  },
  {
    "abilityId": "cfa-10070:0",
    "kind": "CONT",
    "catalogPrintedText": "CONT: When this card would be rode upon, it is also regarded as \"Demonic Jewel Dragon, Drajeweled\".",
    "officialPrintedText": null,
    "blocker": "This ride-time CONT changes the source card’s recognized name only while a ride is being evaluated. There is no trusted alias effect scoped to the exact would-be-ridden card and ride check; the generic static card-name lookup cannot safely satisfy this timing-specific rule."
  },
  {
    "abilityId": "cfa-10070:1",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [VC]: When this unit attacks a vanguard, COST [Soul Blast 4 cards with different grades], choose one of your opponent’s vanguards, until end of turn, increase or decrease its power to 1, and if your opponent’s vanguard is grade 3 or greater, this unit gets critical +1. (power at that time becomes 1, and can increase or decrease afterwards)",
    "officialPrintedText": null,
    "blocker": "The attack AUTO requires this exact VC source attacking a Vanguard, paying Soul Blast 4 cards with distinct grades, setting the opponent Vanguard’s power to 1 until turn end, and conditionally adding critical if that Vanguard is grade 3 or greater. Distinct-grade cost validation and set-power-with-later-modification semantics are not supported end to end."
  },
  {
    "abilityId": "cfa-10070:2",
    "kind": "CONT",
    "catalogPrintedText": "CONT [RC]: If you Soul Blast 4 or more cards at the same time for the cost of your card’s ability this turn, this unit gets power +5000.",
    "officialPrintedText": null,
    "blocker": "This CONT depends on a same-time Soul Blast of at least four specifically paid for a card ability during this turn. The engine does not retain trusted cost-payment provenance and quantity for continuous reevaluation, so the condition cannot be verified without guessing."
  },
  {
    "abilityId": "cfa-10075:0",
    "kind": "ACT",
    "catalogPrintedText": "ACT [RC]: If you have a grade 3 or greater vanguard with \"Sorceress\" in its card name, COST [retire this unit], choose a critical trigger or front trigger from your drop, and put it into your hand.",
    "officialPrintedText": null,
    "blocker": "This ACT’s grade-3 Sorceress Vanguard conditions and source-retire cost are recognized, but its resolver does not implement selecting a Critical or Front trigger from Drop and moving that exact card to hand. Without legal target filtering and atomic cost/effect execution, the ACT remains unavailable."
  },
  {
    "abilityId": "cfa-10077:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this unit is placed on RC, look at the top two cards of your deck, choose one card from among them and put it into your soul and put the rest on the bottom of your deck.",
    "officialPrintedText": null,
    "blocker": "After this exact unit is placed on RC, the effect must privately inspect the top two deck cards, choose exactly one for Soul, and put the other on the bottom. No trusted ordered private-choice/partial-deck movement handler matches this exact effect."
  },
  {
    "abilityId": "cfa-10078:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this unit is placed on RC from hand, COST [Counter Blast 1], look at the top three cards of your deck, choose a card from among them and put it into your soul, shuffle your deck, and if there are four or more cards with different grades in your soul, draw a card.",
    "officialPrintedText": null,
    "blocker": "This hand-to-RC placement AUTO requires Counter Blast 1, private top-three selection into Soul, shuffle, and then a post-move check for four distinct grades in Soul before drawing. The current resolver lacks the full ordered selection and distinct-grade condition; partial draw/search handlers are not equivalent."
  },
  {
    "abilityId": "cfa-10079:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO: When this unit is placed on RC, if you have a vanguard with \"Drajeweled\" in its card name, COST [Soul Blast 1], choose a card from your drop and put it into your soul, and this unit gets power +2000 until end of turn.",
    "officialPrintedText": null,
    "blocker": "The source-placement and Drajeweled-Vanguard condition are parsed, but resolution must pay Soul Blast 1, choose an exact card from Drop to move into Soul, and then give this source +2000 until turn end. There is no registered trusted resolver enforcing that target and ordered movement."
  },
  {
    "abilityId": "cfa-10080:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [RC]: When this unit attacks, if you have a vanguard with \"Drajeweled\" in its card name, COST [Counter Blast 1], and this unit gets power +10000 until end of that battle. At the end of that battle, put this unit into your soul.",
    "officialPrintedText": null,
    "blocker": "This own-RC-attack AUTO requires a Drajeweled Vanguard condition, Counter Blast 1, +10000 until battle end, and a delayed mandatory move of the exact source to Soul when that battle ends. The parsed attack trigger does not provide the delayed movement sequence or safe battle cleanup."
  },
  {
    "abilityId": "cfa-10084:0",
    "kind": "ACT",
    "catalogPrintedText": "ACT [RC]: If your World is Dark Night or Abyssal Dark Night, COST [Soul Blast 1], and increase or decrease this unit’s power to 15000 until end of turn.",
    "officialPrintedText": null,
    "blocker": "This ACT requires World state exactly Dark Night or Abyssal Dark Night, Soul Blast 1, then setting this exact source’s power to 15000 through turn end while preserving later modifiers. World-state values and set-power semantics are not validated by a trusted definition."
  },
  {
    "abilityId": "cfa-10085:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [RC]: When this unit boosts, if you have no other rear-guards, COST [Counter Blast 1], choose one \"Avaricious Demonic Dragon, Greedon\" on your VC, and it gets critical +1 until end of that battle.",
    "officialPrintedText": null,
    "blocker": "This AUTO requires this exact RC source to boost, no other Rear-Guards, Counter Blast 1, and the controller’s Greedon Vanguard to gain +1 critical for that battle. The parser does not model the no-other-Rear-Guards condition or target/critical effect in a trusted resolver."
  },
  {
    "abilityId": "cfa-1008:0",
    "kind": "AUTO",
    "catalogPrintedText": "AUTO [VC/RC]: [Soul Blast 1 & Choose a card from your hand, and discard it] When this unit attacks a vanguard, you may pay the cost. If you do, choose one of your other «Oracle Think Tank», it gets power +3000 until end of turn.",
    "officialPrintedText": null,
    "blocker": "The catalog recognizes an own-unit attack-on-Vanguard trigger and parses Soul Blast 1 plus discard 1, but no trusted resolver for the sequential cost and selection of a different friendly Oracle Think Tank unit with +3000. It must be checked only when this exact VC/RC source attacks the opposing Vanguard; a generic attack event is insufficient."
  }
].map(Object.freeze));
const cards = Object.freeze(Object.entries(sourceByCard).map(([cardId, info]) => Object.freeze({ cardId, ...info })));
const abilityIds = Object.freeze([
  "cfa-10051:0",
  "cfa-10051:1",
  "cfa-10054:0",
  "cfa-10055:0",
  "cfa-10056:0",
  "cfa-10058:0",
  "cfa-10059:0",
  "cfa-10060:0",
  "cfa-10064:0",
  "cfa-10065:0",
  "cfa-10068:0",
  "cfa-10068:1",
  "cfa-10069:0",
  "cfa-10069:1",
  "cfa-1006:0",
  "cfa-1006:1",
  "cfa-10070:0",
  "cfa-10070:1",
  "cfa-10070:2",
  "cfa-10071:0",
  "cfa-10072:0",
  "cfa-10075:0",
  "cfa-10076:0",
  "cfa-10077:0",
  "cfa-10078:0",
  "cfa-10079:0",
  "cfa-10080:0",
  "cfa-10081:0",
  "cfa-10084:0",
  "cfa-10085:0",
  "cfa-1008:0"
]);

Object.defineProperty(contribution, "audit", { enumerable: false, value: Object.freeze({
  batchId: "ABILITY-320008F1-0003",
  status: "audit-only-18-unsupported-13-already-supported",
  dataset: "Cardfight Area local catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  abilityIds,
  implementedAbilityIds: Object.freeze([]),
  alreadySupportedAbilityIds: Object.freeze(supportedDefinitions.map(item => item.abilityId)),
  supportedDefinitions,
  cards,
  unsupportedSiblings,
  provenanceNote: "Printed text is preserved from the local catalog snapshot. The Fectil and Mystic Accordionist definitions are verified against their linked Bushiroad official card-list entries; other entries were not independently checked in this batch.",
  limitation: "The 22 uncompiled abilities remain unsupported and must stay unavailable. A recognized trigger shape alone does not make an ability resolvable."
}) });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });
module.exports = contribution;
