"use strict";

// Audit result for the claimed 37-ID batch. No new definition was added:
// every candidate either lacks primary card-text provenance or needs behavior
// that the current exact server validators do not accept.
const definitions = [];

const auditedAbilityIds = Object.freeze([
  "cfa-11439:0", "cfa-11439:1", "cfa-11440:0", "cfa-11441:0", "cfa-11446:0",
  "cfa-11447:0", "cfa-11448:0", "cfa-11449:0", "cfa-1144:0", "cfa-11450:0",
  "cfa-11452:0", "cfa-11452:1", "cfa-11453:0", "cfa-11453:1", "cfa-11454:0",
  "cfa-11455:0", "cfa-11455:1", "cfa-11457:0", "cfa-11457:1", "cfa-11458:0",
  "cfa-11458:1", "cfa-1145:0", "cfa-1145:1", "cfa-11461:0", "cfa-11464:0",
  "cfa-11464:1", "cfa-11465:0", "cfa-11466:0", "cfa-11466:1", "cfa-11467:0",
  "cfa-11467:1", "cfa-11468:0", "cfa-11468:1", "cfa-11469:0", "cfa-1146:0",
  "cfa-11470:0", "cfa-11470:1"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-11452:0", "cfa-11452:1", "cfa-11453:0", "cfa-11453:1",
  "cfa-1145:0", "cfa-1145:1", "cfa-1146:0"
]);

const blockers = Object.freeze([
  { abilityId: "cfa-11439:0", blocker: "This VC CONT gives +15000 power and +1 critical during your turn only if three exact Pose-named units are on your Rear-Guard Circles. The local Cardfight Area text has no located Bushiroad card-list entry, and this exact card-name condition has not been validated against an official printing; do not promote it from the local snapshot alone." },
  { abilityId: "cfa-11439:1", blocker: "This VC ACT is once per turn and pays both Counter-Blast 1 and Soul-Blast 1 before searching for an Ultraman-named card, calling it to an open Rear-Guard Circle, and shuffling. No exact trusted definition validates the dual cost, filtered search, open-circle call, and ordered resolution for this card." },
  { abilityId: "cfa-11440:0", blocker: "Only this source's own VC/RC attack qualifies, and only if its controller's Soul contains a card name with the exact Ultraman Taiga phrase; it then gets +4000 for that battle. No trusted definition binds that source attack, Soul-name condition, and battle-duration modifier for this text." },
  { abilityId: "cfa-11441:0", blocker: "Only this exact source's VC/RC placement triggers; Counter-Blast 2 is followed by an Ultraman-name deck search, an open-RC call, and a shuffle. The required source-bound placement, cost, filtered search, and call sequence has no exact trusted handler." },
  { abilityId: "cfa-11446:0", blocker: "This ability requires the exact source to intercept and both named Pose units to be on its controller's RC before gaining +15000 shield for that battle. The current trusted effects do not model this intercept event plus both exact field-name conditions." },
  { abilityId: "cfa-11447:0", blocker: "This RC CONT gives the exact source +10000 only during its controller's turn and only while the other two exact Pose names are on that controller's Rear-Guard Circles. No exact validated definition is available for the three-card condition." },
  { abilityId: "cfa-11448:0", blocker: "This RC CONT gives the exact source +6000 only during its controller's turn and only while the other two exact Pose names are on that controller's Rear-Guard Circles. No exact validated definition is available for the three-card condition." },
  { abilityId: "cfa-11449:0", blocker: "This VC placement pays Counter-Blast 1 and Soul-Blast 1, searches for a card name containing Ultraman Taiga Tri-Strium, adds it to hand, shuffles, then gives the source +10000 until turn end. No exact trusted handler covers that ordered search and modifier." },
  { abilityId: "cfa-1144:0", blocker: "The Bushiroad Battle Maiden, Tatsutahime entry verifies a boosted Genesis Vanguard hit, but this card pays Counter-Blast 2 and Soul-Charges 3. The existing strict boosted-hit family is specifically an optional, cost-free Soul-Charge 1 ability and its server validator rejects this different cost/effect; a dedicated reviewed definition is required." },
  { abilityId: "cfa-11450:0", blocker: "Only this exact source's RC placement triggers; pay Soul-Blast 2, Counter-Charge 1, then give it +5000 through turn end. The combined cost, resource gain, and source modifier is not an exact reviewed placement handler." },
  { abilityId: "cfa-11454:0", blocker: "This RC source can trigger when its controller's Ultraman-named Vanguard attacks or is attacked, then Soul-Blast 2 and choose a Vanguard for +10000 until battle end. The broad two-event trigger and selected Vanguard effect are not represented by a trusted program." },
  { abilityId: "cfa-11455:0", blocker: "Only this exact VC/RC source's attack on a Vanguard qualifies, and the opponent Vanguard's current power must be 8000 or less; the source then gains +5000 until turn end. The server lacks this exact target-power condition and duration combination." },
  { abilityId: "cfa-11455:1", blocker: "This VC/RC CONT restricts the opponent from calling normal units from hand to GC only during battles where this exact source attacks a Vanguard. No authoritative continuous guard-action restriction is registered for this wording." },
  { abilityId: "cfa-11457:0", blocker: "This exact source gains +3000 through turn end only when placed on VC or RC. There is no trusted source-placement power definition for this text, and the local card record has no located Bushiroad entry." },
  { abilityId: "cfa-11457:1", blocker: "This exact Vanguard must be ridden upon; its controller then pays Soul-Blast 1 and draws. Existing rode-upon draw handlers cover different exact texts and conditions, and none accepts this paid effect." },
  { abilityId: "cfa-11458:0", blocker: "This RC ACT sends three specifically named units from RC to Soul, searches for and stands an Ultraman Gruebe by riding it, then conditionally reduces that rider's Drive. The cost, superior ride, and conditional modifier need unsupported ordered handlers." },
  { abilityId: "cfa-11458:1", blocker: "This ability draws when the exact source is ridden upon. The current trusted ride-draw definitions have additional, different text and do not compile this plain draw ability; no validated exact card provenance was located." },
  { abilityId: "cfa-11461:0", blocker: "On this exact VC placement, pay Counter-Blast 1, draw, give the front row +10000 through turn end, and grant the source +1 critical if it rode from grade 3. This multi-step ride-history effect has no trusted definition." },
  { abilityId: "cfa-11464:0", blocker: "This VC/RC ACT is once per turn and moves a specifically name-filtered Ultraman rear-guard into Soul, gives the source +1 critical through turn end, and optionally draws if the moved card matched Ultraman X. No exact source-cost and conditional-draw handler is available." },
  { abilityId: "cfa-11464:1", blocker: "This VC/RC CONT grants +3000 during your turn if Soul contains a unit whose name contains Ultraman X. The local card identity/text lacks a located Bushiroad entry, so this name-based condition cannot be accepted from the Cardfight Area snapshot as production-verified." },
  { abilityId: "cfa-11465:0", blocker: "This source must itself move into Soul as a cost or effect of an Ultraman X/Exceed X card; then the opponent Vanguard loses 3000 and the controller may Counter-Charge only if the same-name effect has not done so this turn. The source-zone event and name-scoped usage restriction are unsupported." },
  { abilityId: "cfa-11466:0", blocker: "Only this exact VC/RC source's attack on a Vanguard should give it +3000 until battle end. No trusted definition matches this source-bound attack bonus and the exact local card has no located Bushiroad source." },
  { abilityId: "cfa-11466:1", blocker: "Counter-Charge 1 occurs only when this exact card is put into Soul by a cost or effect of an Ultraman X/Exceed X card. The current event handlers do not validate both the exact moved card and the source card-name condition." },
  { abilityId: "cfa-11467:0", blocker: "On source placement, this ability pays a filtered Rear-Guard-to-Soul cost, reduces the opponent Vanguard's power, optionally draws based on the moved card's name, and shares a same-name once-per-turn restriction. That event, cost, choice, modifier, and shared usage rule have no trusted exact program." },
  { abilityId: "cfa-11467:1", blocker: "This VC/RC CONT grants +3000 during your turn only while Soul contains a unit named Ultraman X or Ultraman Exceed X. No official entry was located for the local card text, so it remains blocked despite the general continuous-power primitives." },
  { abilityId: "cfa-11468:0", blocker: "This VC ACT is once per turn, pays Counter-Blast 1 and sends a filtered Rear-Guard to Soul, draws, gives +15000 through turn end, and grants Drive +1 only for a second name condition. The required validated target/cost/effect sequence is not registered." },
  { abilityId: "cfa-11468:1", blocker: "This VC/RC CONT grants +1 critical only when both named-Soul and opponent-grade-3 conditions are true. The exact identity and text lack official provenance; neither condition may be inferred from the local snapshot alone." },
  { abilityId: "cfa-11469:0", blocker: "This placement ability conditionally performs several distinct Soul-name-dependent effects, including resource changes, a power modifier, and a shield modifier. Each branch needs exact names, timing, and independent effect validation; no trusted sequence represents it." },
  { abilityId: "cfa-11470:0", blocker: "Only this exact VC/RC placement may search the deck for an Ultraman-named card and put it into Soul, shuffling if found. No trusted definition accepts this exact zone movement and source-bound placement trigger." },
  { abilityId: "cfa-11470:1", blocker: "This exact source's Vanguard attack with four qualifying Soul cards pays Counter-Blast 2, gains +20000, restricts opponent Sentinel calls, and moves to Soul at battle end if still on RC. The combined trigger, cost, attack restriction, and delayed source movement are unsupported." }
]);

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0021",
    auditedAbilityIds,
    alreadySupportedAbilityIds,
    proposedDefinitionIds: Object.freeze([]),
    blocked: blockers,
    provenanceWarnings: Object.freeze([
      { abilityIds: Object.freeze(auditedAbilityIds.filter(id => /^cfa-114(?:3\d|4\d|5\d|6\d|70):/.test(id) && !["cfa-1144:0", "cfa-1145:0", "cfa-1145:1", "cfa-1146:0"].includes(id))),
        note: "These local Ultraman records come from the Cardfight Area snapshot dated 2025-05-09. No matching Bushiroad Card List entry was located in this audit; preserve their exact catalog wording but keep them blocked until an authoritative card source is supplied." },
      { abilityIds: Object.freeze(["cfa-1144:0"]),
        note: "The official Tatsutahime mechanic is verified, but its official CB2/Soul-Charge 3 text differs materially from the existing free Soul-Charge 1 server family. It is blocked pending a dedicated implementation and tests." },
      { abilityIds: Object.freeze(["cfa-11452:0", "cfa-11452:1", "cfa-11453:0", "cfa-11453:1"]),
        note: "These exact local Sentinel and Guardian texts compile through existing generic runtime handlers, but the Ultraman card identity and printing were not verified from a Bushiroad card-list record." }
    ]),
    officialReferences: Object.freeze([
      { abilityId: "cfa-1144:0", cardNumber: "BT10/031EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F031EN",
        note: "Bushiroad's official Battle Maiden, Tatsutahime entry confirms the boosted Genesis Vanguard-hit timing and Counter-Blast 2/Soul-Charge 3 effect. It does not match the existing Soul-Charge 1 family." },
      { abilityIds: Object.freeze(["cfa-1145:0", "cfa-1145:1"]), cardNumber: "BT10/015EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F015EN",
        note: "Bushiroad's official Goddess of Self-sacrifice, Kushinada entry confirms Sentinel and the Genesis-filtered Guardian Circle discard/protection ability." },
      { abilityId: "cfa-1146:0", cardNumber: "TD13/011EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=TD13%2F011EN",
        note: "Bushiroad's official Witch of Cats, Cumin entry confirms the optional VC/RC placement Soul-Charge 1 ability when the controller has a Genesis Vanguard." }
    ])
  })
});

module.exports = definitions;
