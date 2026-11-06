"use strict";

// One exact CONT ability from the assigned batch is ready for primary-session
// integration. The rest stay blocked with concrete engine gaps below.
const definitions = [
  {
    id: "cfa-11260:0",
    cardId: "cfa-11260",
    kind: "CONT",
    printedText: "CONT [RC] Shinken Hissatsu(This ability is active if you have three or more damage): This unit gets power +5000. (Active on opponent’s turn too.)",
    requiredLocation: ["rear-guard"],
    conditionsReviewed: true,
    source: {
      dataset: "Bushiroad official card list",
      cardNumber: "D-TB04/062EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F062EN",
      patternId: "cont-rc-shinken-hissatsu-power-v1",
      review: "Bushiroad's Ningenmukotsu card entry confirms Shinken Hissatsu is active at three or more damage, gives this unit +5000 power, and remains active on the opponent's turn. The existing continuous-power evaluator supports the exact controller-damage threshold, Rear-Guard scope, and source-versus-target instance guard."
    },
    effects: [
      {
        op: "continuous-power",
        target: "source",
        amount: 5000,
        duration: "continuous",
        condition: { op: "controller-damage-at-least", count: 3 }
      }
    ]
  }
];

const auditedAbilityIds = Object.freeze([
  "cfa-11239:0", "cfa-11240:0", "cfa-11240:1", "cfa-11241:0", "cfa-11241:1",
  "cfa-11242:0", "cfa-11242:1", "cfa-11243:0", "cfa-11243:1", "cfa-11244:0",
  "cfa-11244:1", "cfa-11245:0", "cfa-11246:0", "cfa-11246:1", "cfa-11247:0",
  "cfa-11247:1", "cfa-11247:2", "cfa-11248:0", "cfa-11249:0", "cfa-11249:1",
  "cfa-1124:0", "cfa-11250:0", "cfa-11250:1", "cfa-11251:0", "cfa-11252:0",
  "cfa-11253:0", "cfa-11254:0", "cfa-11254:1", "cfa-11255:0", "cfa-11255:1",
  "cfa-11256:0", "cfa-11256:1", "cfa-11257:0", "cfa-11258:0", "cfa-11258:1",
  "cfa-11259:0", "cfa-1125:0", "cfa-11260:0", "cfa-11260:1", "cfa-1126:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-11241:0", "cfa-11244:0", "cfa-11247:0", "cfa-11253:0",
  "cfa-11254:0", "cfa-11258:1", "cfa-11260:1", "cfa-1126:0"
]);

const blockers = Object.freeze([
  { abilityId: "cfa-11239:0", blocker: "Requires this exact Rear-Guard's own Vanguard-attack event plus Shinken Hissatsu damage eligibility, Counter-Blast payment, an opponent Rear-Guard choice, and retirement. The current trusted definitions do not validate this full event/condition/cost/target sequence." },
  { abilityId: "cfa-11240:0", blocker: "Requires the exact source to have boosted in a battle, a specific Wakizashi crest check, Soul-Blast 1, draw, and then move that same source to deck top. The event provenance and ordered source-zone movement are not jointly supported." },
  { abilityId: "cfa-11240:1", blocker: "This GC-only shield bonus requires a live damage-zone count and a shield evaluator that binds the effect to the exact guardian instance. The current continuous-shield path does not enforce source/target instance identity." },
  { abilityId: "cfa-11241:1", blocker: "This is a composite crest ability that changes same-name units' grade/power/keywords and replaces their abilities, then grants a battle-phase reveal/retire AUTO and an end-of-battle Counter-Blast restand AUTO. Dynamic ability replacement and nested timing are not implemented." },
  { abilityId: "cfa-11242:0", blocker: "Requires the exact card to be discarded from deck during its controller's turn, a Tachi crest check, and a private choice between calling that card or adding it to hand. The deck-discard event and choice flow are not implemented for this template." },
  { abilityId: "cfa-11242:1", blocker: "The dual RC/GC power and shield effect depends on a named other rear-guard. The engine does not yet provide the exact cross-zone condition plus instance-safe power and shield evaluation for this card." },
  { abilityId: "cfa-11243:0", blocker: "Requires the exact card to be discarded from deck during its controller's turn, a Tachi crest check, and a private choice between calling that card or adding it to hand. The deck-discard event and choice flow are not implemented for this template." },
  { abilityId: "cfa-11243:1", blocker: "Requires a once-per-turn battle-end event from this source, attack target grade 3+, a fact that the Vanguard did not attack this turn, hand discard, name-filtered Rear-Guard selection, and standing that target. These gates and the ordered cost/effect are not supported together." },
  { abilityId: "cfa-11244:1", blocker: "This crest changes same-name units' identity and abilities, grants attacks against every opponent unit in a column, and adds a once-per-turn reveal-trigger-or-discard attack effect. The dynamic continuous attack rule and nested AUTO are unsupported." },
  { abilityId: "cfa-11245:0", blocker: "Requires this source's Vanguard attack, a Yari crest, moving an opponent's selected Rear-Guard to an open back-row center circle, then Counter-Blast, draw, and battle-only power. Opponent-zone movement and dependent ordered resolution are not supported by an exact handler." },
  { abilityId: "cfa-11246:0", blocker: "Requires the exact card's controller-turn deck-discard event and a Naginata crest, then a choice to call the source or put it in hand. The structured deck-discard event and private choice flow are missing." },
  { abilityId: "cfa-11246:1", blocker: "Requires the source's own Vanguard attack and an opponent front-row same-column vacancy check before Counter-Blast, draw, and battle-only power. Same-column eligibility is not authoritatively represented for this handler." },
  { abilityId: "cfa-11247:1", blocker: "The ACT needs once-per-turn VC timing, Counter-Blast 1, selection of exactly three controlled Rear-Guards, and a turn-long grant of both Boost and power to each selected instance. No existing trusted effect program models that exact multi-target grant." },
  { abilityId: "cfa-11247:2", blocker: "The attack-end AUTO has a conditional alternative Counter-Blast cost after Persona Ride, an exact-name card movement from RC/hand to Soul, and a one-versus-two target count based on grade-3 named Soul cards. Alternative cost and post-cost target selection are unsupported together." },
  { abilityId: "cfa-11248:0", blocker: "Needs an event for a different Rear-Guard standing outside Stand Phase, once-per-turn use, Soul-Blast 1, and standing this exact back-row source. Stand cause, phase, and source/subject identity are not represented together." },
  { abilityId: "cfa-11249:0", blocker: "Although the Vanguard-name condition and Soul-Blast are recognized, the top-five filtered reveal, optional legal unit choice, grade comparison, call, and shuffle need one exact authoritative search/call handler; choice review is still incomplete." },
  { abilityId: "cfa-11249:1", blocker: "One AUTO responds to either this source attacking or this source boosting, has a Shinken Hissatsu threshold, and lasts through end of turn. The current trigger schema does not safely encode both event alternatives for this ability." },
  { abilityId: "cfa-1124:0", blocker: "Requires a hit by this exact VC/RC source, a Gold Paladin Vanguard condition, an optional named Counter-Blast cost, deck reveal/search, call to an open circle, and bottom-decking the remaining cards. The complete hit/search/cost sequence is not supported." },
  { abilityId: "cfa-11250:0", blocker: "Requires main-phase RC placement, Counter-Blast, an optional hand selection filtered by two name fragments, call, and draw only if a card was called. The conditional call-and-draw sequence is not validated by an exact server handler." },
  { abilityId: "cfa-11250:1", blocker: "Needs distinct-name counting across both RC and Drop for two thresholds, then battle-only power and a conditional hand-discard cost for critical. Cross-zone distinct-name state and ordered threshold resolution are unsupported." },
  { abilityId: "cfa-11251:0", blocker: "Must trigger on another unit's attack (not this source attacking), Soul-Blast 1, and grant battle power to that exact attacking unit, with a source-specific once-per-turn restriction. The other-attacker relation and cost/target binding are not supported together." },
  { abilityId: "cfa-11252:0", blocker: "Placement AUTO is optional: draw only if accepted, then choose and discard a hand card only if a card was drawn. Optional resolution and dependent private choice handling are not represented by a validated program." },
  { abilityId: "cfa-11254:1", blocker: "This crest combines same-name unit transformation, a beginning-of-battle-phase reveal, grade-filtered opponent unit lockdown until next turn, normal-unit discard, and a continuous all-front-row attack rule. Dynamic grants and persistent movement/stand restrictions are missing." },
  { abilityId: "cfa-11255:0", blocker: "Requires exact deck-discard event during the controller's turn, a Naginata crest, opponent Rear-Guard selection, and a restriction lasting through the opponent's next turn that blocks movement and Stand Phase standing. The duration and rule restriction handler are missing." },
  { abilityId: "cfa-11255:1", blocker: "Requires this source's attack against a grade-3+ Vanguard, an empty opponent front row, and selection of a different front-row ally; both units receive turn-long power. The attack/target-column gates and two-instance temporary modifier are not covered by an exact handler." },
  { abilityId: "cfa-11256:0", blocker: "Requires exact controller-turn deck-discard event and a Naginata crest, then an opponent Rear-Guard target and a next-turn movement/standing restriction. Neither event provenance nor persistent restriction application is implemented." },
  { abilityId: "cfa-11256:1", blocker: "Requires this source's own attack against a grade-3+ Vanguard and an empty opponent front row before Counter-Blast and battle-only power. The exact combined attack predicate is not currently trusted." },
  { abilityId: "cfa-11257:0", blocker: "Requires this exact booster, a fact that the Vanguard has not attacked this turn, revealing the top card, choosing top or bottom, and granting battle power only for the bottom choice. Choice-dependent deck movement is not covered by an exact resolution handler." },
  { abilityId: "cfa-11258:0", blocker: "This CONT forbids attacking only while an opponent front-row unit occupies the same column as this exact Rear-Guard. Source-column geometry and this conditional attack-legality restriction are not enforced by the authoritative action path." },
  { abilityId: "cfa-11259:0", blocker: "Requires an end-of-battle event from this exact source, confirmation that it is the turn's first battle, Counter-Blast, draw, then moving the source to deck top. The first-battle fact and ordered movement are not supported together." },
  { abilityId: "cfa-1125:0", blocker: "Requires exact placement of this source from the deck, a Gold Paladin Vanguard, a selected face-down damage card to Counter-Charge, then Soul Charge 1. The placement provenance and atomic damage-selection/resource/effect sequence need a dedicated authoritative handler." }
]);

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0014",
    auditedAbilityIds,
    alreadySupportedAbilityIds,
    proposedDefinitionIds: Object.freeze(definitions.map(definition => definition.id)),
    blocked: blockers,
    officialReferences: Object.freeze([
      {
        abilityId: "cfa-11260:0",
        cardNumber: "D-TB04/062EN",
        url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F062EN",
        note: "Bushiroad's official Ningenmukotsu listing confirms Shinken Hissatsu at three or more damage, +5000 power, and activity during the opponent's turn."
      }
    ])
  })
});

module.exports = definitions;
