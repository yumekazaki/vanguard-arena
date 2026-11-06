"use strict";

// One exact, official AUTO reuses the existing attack-hit, Counter-Blast, and
// Soul-Charge handlers. Five entries already compile through existing code;
// the other 37 remain explicit blockers.
const definitions = [
  {
    id: "cfa-1139:0",
    cardId: "cfa-1139",
    kind: "AUTO",
    printedText: "AUTO [VC/RC]: [Counter Blast 1] When this unit’s attack hits a vanguard, if you have a «Genesis» vanguard, you may pay the cost. If you do, Soul Charge 3.",
    requiredLocation: ["vanguard", "rear-guard"],
    trigger: {
      status: "recognized-trigger",
      eventType: "attack.hit",
      subject: "source",
      circles: [],
      targetLocation: "vanguard"
    },
    conditions: [{ type: "controller-vanguard-has-clan", value: "Genesis" }],
    conditionsReviewed: true,
    costs: [{ type: "counter-blast", count: 1 }],
    costsReviewed: true,
    choicesReviewed: true,
    optional: true,
    canDecline: true,
    source: {
      dataset: "Bushiroad official card list",
      officialCardNumber: "BT10/029EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F029EN",
      patternId: "auto-sahohime-own-attack-hit-optional-cb1-genesis-soul-charge-three-v1",
      review: "Exact BT10/029EN Battle Maiden, Sahohime AUTO. Only this source's VC or RC attack hitting a Vanguard qualifies; the controller must currently have a Genesis Vanguard. The ability is optional, Counter-Blast 1 is paid before Soul-Charging 3, and the shared resolver revalidates the battle, source, clan, and cost for the deciding player.",
      rulesReference: "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf"
    },
    effects: [{ op: "soul-charge", count: 3 }]
  }
];

const auditedAbilityIds = Object.freeze([
  "cfa-11380:0", "cfa-11380:1", "cfa-11382:0", "cfa-11382:1", "cfa-11383:0",
  "cfa-11383:1", "cfa-11384:0", "cfa-11384:1", "cfa-11385:0", "cfa-11385:1",
  "cfa-11386:0", "cfa-11387:0", "cfa-11387:1", "cfa-11388:0", "cfa-11389:0",
  "cfa-11389:1", "cfa-1138:0", "cfa-1138:1", "cfa-11390:0", "cfa-11390:1",
  "cfa-11391:0", "cfa-11391:1", "cfa-11392:0", "cfa-11392:1", "cfa-11393:0",
  "cfa-11393:1", "cfa-11393:2", "cfa-11394:0", "cfa-11394:1", "cfa-11395:0",
  "cfa-11395:1", "cfa-11397:0", "cfa-11397:1", "cfa-11398:0", "cfa-11398:1",
  "cfa-11399:0", "cfa-1139:0", "cfa-11400:0", "cfa-11400:1", "cfa-11402:0",
  "cfa-11403:0", "cfa-11404:0", "cfa-114:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-11380:0", "cfa-11380:1", "cfa-1138:0", "cfa-11397:0", "cfa-11400:1"
]);

const blockers = Object.freeze([
  { abilityId: "cfa-11382:0", blocker: "This CONT grants four threshold-dependent power, Critical, Drive, stand, and guard-restriction effects from named Soul counts. Its added AUTO abilities, thresholds, costs, and opponent guard rule need dynamic continuous-grant and guard-validation handlers." },
  { abilityId: "cfa-11382:1", blocker: "This Hand ACT checks either of two Vanguard name fragments, then moves this exact hand instance into Soul and draws. The existing source-to-Soul cost handlers do not validate this combined hand-zone/name-condition sequence." },
  { abilityId: "cfa-11383:0", blocker: "This placement AUTO creates a turn-long opponent intercept restriction and gives its source +5000 on VC or RC. The authoritative intercept legality path has no effect-generated turn restriction for this ability." },
  { abilityId: "cfa-11383:1", blocker: "At this exact RC unit's battle close, it must pay Soul-Blast 1 and return itself to hand before choosing a normal unit on either player's RC to return. The cross-controller target and ordered source movement are unsupported." },
  { abilityId: "cfa-11384:0", blocker: "On exact VC/RC placement, pay Counter-Blast 1 and Soul-Blast 1, choose a column, then retire every opposing Rear-Guard in it. The column choice and atomic multi-retirement handler are missing." },
  { abilityId: "cfa-11384:1", blocker: "This CONT counts every other unit in the same column, including the opponent's units, and grants +5000 only when none remain. No existing continuous evaluator performs this two-controller column count." },
  { abilityId: "cfa-11385:0", blocker: "After this Vanguard's own attack, if the controller has five Set Orders, pay Counter-Blast 1 and retire three friendly Rear-Guards, then choose a different named card in Soul to ride standing and grant it +10000. The ordered multi-cost ride sequence is unsupported." },
  { abilityId: "cfa-11385:1", blocker: "This once-per-turn Vanguard ACT costs Counter-Blast 1, optionally chooses a Set Order from hand or Drop to place in the Order Zone, and draws only if it came from hand. The location-dependent optional choice is not modeled." },
  { abilityId: "cfa-11386:0", blocker: "This placement AUTO pays by moving another Rear-Guard to Soul, then checks six different name fragments and conditionally performs distinct power, return/discard, charge, multi-target power, draw, and granted-ability effects. The dependent multi-branch sequence has no trusted handler." },
  { abilityId: "cfa-11387:0", blocker: "The CONT requires the exact source to occupy the back-row center additional RC, then grants attack permission from that circle against the opposing Vanguard and +5000. Additional-circle attack legality is not enforced by the battle validator." },
  { abilityId: "cfa-11387:1", blocker: "This once-per-turn ability depends on the exact unit's own attack missing at an additional RC, pays Soul-Blast 1, and stands that source. The additional-circle restriction and miss-trigger sequencing are not represented together." },
  { abilityId: "cfa-11388:0", blocker: "This Order Zone AUTO has attack, opposing-grade, and order-count conditions, moves its own source to Drop as cost, then stands and powers a number of Rear-Guards tied to the resulting order count. Same-name usage restriction and the post-cost count/target choices are unresolved." },
  { abilityId: "cfa-11389:0", blocker: "When this exact Set Order enters the Order Zone, it pays Soul-Blast 1 and draws. A generic placement draw pattern exists but does not encode this Soul-Blast cost or verify the source Order Zone move." },
  { abilityId: "cfa-11389:1", blocker: "This Order Zone CONT depends on the controller's turn and a Summoner-named Vanguard, then powers all friendly front-row units. The continuous evaluator does not support this source zone and multi-target power condition." },
  { abilityId: "cfa-1138:1", blocker: "The attack-hit AUTO always Soul-Charges 2, then conditionally Soul-Charges 2 if the named Artemis is in Soul after the first charge. The required post-first-effect state check and ordered conditional charge are unsupported." },
  { abilityId: "cfa-11390:0", blocker: "This Order Zone placement AUTO pays by discarding a chosen hand card and then draws. Existing Order Zone placement draw support does not include or validate this cost." },
  { abilityId: "cfa-11390:1", blocker: "This Order Zone ACT checks the Summoner Vanguard, moves the exact Order source to Drop, and performs both Counter-Charge 1 and Soul-Charge 1. The Order-source cost and two-resource effect sequence are not an existing trusted program." },
  { abilityId: "cfa-11391:0", blocker: "On GC placement, discard a grade 3 card whose name contains Priest, then choose one of the controller's Vanguards for battle-duration cannot-be-hit protection. The filtered discard and Vanguard-only target are not represented by the generic GC protector." },
  { abilityId: "cfa-11391:1", blocker: "This from-hand placement AUTO requires Counter-Blast 1 and a hand discard, then searches Deck or Drop for one of three name fragments, reveals/adds/shuffles, and conditionally grants Accel based on additional RC count. The multi-zone search and gift condition are unsupported." },
  { abilityId: "cfa-11392:0", blocker: "This once-per-turn ACT has Counter-Blast, grade-filtered Soul-Blast, source power, multi-target attack permission, and a conditional Counter-Charge when a Knight-named card is paid. The conditional alternate cost and attack rule cannot be expressed by existing handlers." },
  { abilityId: "cfa-11392:1", blocker: "Only this Vanguard's own attack hitting should prompt; pay Counter-Blast 1, retire an opposing Rear-Guard in the attacked unit's column, and draw if none was retired. Hit provenance and conditional opponent target/effect ordering are unsupported." },
  { abilityId: "cfa-11393:0", blocker: "This CONT changes the source's name to an exact quoted alias, which affects name matching in other cards. No validated alias definition for this name/card is registered, and no official Bushiroad source was verified." },
  { abilityId: "cfa-11393:1", blocker: "During the controller's turn, this Vanguard continuously powers all front-row units by the number of exact alias-name cards in Soul. The all-target continuous evaluator does not support this name alias count." },
  { abilityId: "cfa-11393:2", blocker: "This once-per-turn ACT pays Counter-Blast 1, puts one hand card and one Rear-Guard into Soul, then rides a specific alias-name card from Soul standing. Multi-zone costs and name-alias ride selection are unsupported." },
  { abilityId: "cfa-11394:0", blocker: "This own-attack AUTO pays Counter-Blast 1 and branches at four different sums of Soul grades into front-row power, opponent units to Soul, opponent hand bind, and GC call restriction. The grade-sum branches and opponent choices are not implemented." },
  { abilityId: "cfa-11394:1", blocker: "This once-per-turn ACT Soul-Blasts a grade 0, Soul-Charges 2, then draws only if one or more of the newly Soul-Charged cards are triggers. The cost filter and checked-card-dependent post-effect condition are unsupported." },
  { abilityId: "cfa-11395:0", blocker: "This Vanguard attack AUTO pays by Soul-Blasting all Soul cards, scales battle power by the number actually paid, and conditionally restricts sentinels at five damage. Variable all-card costs and battle guard restrictions are not supported together." },
  { abilityId: "cfa-11395:1", blocker: "This once-per-turn ACT moves two chosen hand cards to Soul, draws one, then conditionally grants Critical if Soul count is at least ten after payment. Multi-card cost and post-cost threshold sequencing are missing." },
  { abilityId: "cfa-11397:1", blocker: "On this Vanguard's placement, Counter-Blast 1, inspect three deck cards, and choose distinct destinations for a hand card, a Soul card, and a remaining top card. The exact multi-destination deck selection is unsupported." },
  { abilityId: "cfa-11398:0", blocker: "This source's own attack pays Counter-Blast 1 to move an existing Force marker to its exact circle. Marker relocation with source-circle identity is not an authoritative effect operation." },
  { abilityId: "cfa-11398:1", blocker: "This Rear-Guard's own attack must miss, then it pays Soul-Blast 1 and moves the exact source to hand. Although generic cost/effect operations exist separately, the card has no reviewed combined definition or official source." },
  { abilityId: "cfa-11399:0", blocker: "On exact Vanguard placement, pay both Counter-Blast 1 and Soul-Blast 1, then search the Deck for a Shinichi-name card, reveal/add it, and shuffle. No exact trusted compound search definition is registered." },
  { abilityId: "cfa-11400:0", blocker: "This RC placement looks at exactly two top cards and lets its controller order both on top. No existing reviewed effect handler supplies this exact two-card order choice." },
  { abilityId: "cfa-11402:0", blocker: "Only this source's own Vanguard attack qualifies when its controller Vanguard contains either of two name fragments; the source then gets +5000 for the battle. The two-name condition and exact own-attack binding lack a reviewed definition." },
  { abilityId: "cfa-11403:0", blocker: "Only this exact unit's own boost of a Heiji-named unit should give the boosted unit +5000 for the battle. The catalog ability has no reviewed booster identity and target-bound server definition." },
  { abilityId: "cfa-11404:0", blocker: "This RC ACT pays Counter-Blast 1 and moves its exact source to Soul, then chooses a friendly unit for +10000 until turn end. The current parsed text has no trusted source-to-Soul cost plus chosen-unit power definition or official card reference." },
  { abilityId: "cfa-114:0", blocker: "Bushiroad confirms Red Lightning's ACT, but the catalog says 'choose up to one' damage card while the existing source-to-Soul Counter-Charge handler requires selecting one whenever a face-down card exists. That handler cannot preserve the printed optional 0-or-1 choice, so this ability stays blocked pending an optional counter-charge choice path." }
]);

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0019",
    auditedAbilityIds,
    alreadySupportedAbilityIds,
    proposedDefinitionIds: Object.freeze(definitions.map(definition => definition.id)),
    blocked: blockers,
    provenanceWarnings: Object.freeze([
      {
        abilityIds: Object.freeze(["cfa-11380:0", "cfa-11380:1"]),
        note: "The existing parser supports these exact local pattern templates, but the catalog labels this card clan 'Game' and this audit has no verified Bushiroad card number/list entry. They are code-pattern support only, not confirmation of official-card behavior."
      },
      {
        abilityIds: Object.freeze(["cfa-11397:0", "cfa-11400:1"]),
        note: "The existing drive-check power compiler supports these exact local text templates, but the catalog labels these cards clan 'Animation' and this audit has no verified Bushiroad card number/list entry. They are code-pattern support only, not confirmation of official-card behavior."
      }
    ]),
    officialReferences: Object.freeze([
      { abilityId: "cfa-1138:0", cardNumber: "BT10/030EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F030EN", note: "Official Twilight Hunter, Artemis entry confirms the exact named-Artemis Soul condition and +1000 VC CONT; the existing named-Soul handler is tested." },
      { abilityId: "cfa-1139:0", cardNumber: "BT10/029EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F029EN", note: "Official Battle Maiden, Sahohime entry confirms the optional CB1 own-attack-hit-on-Vanguard ability with a Genesis Vanguard condition and Soul-Charge 3." },
      { abilityId: "cfa-114:0", cardNumber: "BT02/074EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT02%2F074EN", note: "Official Red Lightning entry confirms the source-to-Soul ACT and up-to-one damage unflip; existing non-optional counter-charge selection is insufficient, so the ability remains blocked." }
    ])
  })
});

module.exports = definitions;
