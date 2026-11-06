"use strict";

// One exact CONT variant reuses the existing continuous-shield evaluator and
// reducer path. Six other abilities already compile; 34 remain blocked.
const definitions = [
  {
    id: "cfa-11294:1",
    cardId: "cfa-11294",
    kind: "CONT",
    printedText: "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    requiredLocation: ["guardian"],
    source: {
      dataset: "Bushiroad official card list",
      cardNumber: "D-TB04/020EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
      patternId: "cont-gc-opponent-grade-shield-v1",
      review: "Bushiroad's D-TB04 card list confirms the GC-only +5000 shield condition. This exact text reuses the already registered opponent-grade continuous-shield evaluator; its location and live opposing Vanguard grade are rechecked at guard resolution."
    },
    effects: [
      {
        op: "continuous-shield",
        target: "source",
        amount: 5000,
        duration: "continuous",
        condition: { op: "opponent-vanguard-grade-at-least", grade: 3 }
      }
    ]
  }
];

const auditedAbilityIds = Object.freeze([
  "cfa-11284:0", "cfa-11285:0", "cfa-11286:0", "cfa-11286:1", "cfa-11287:0",
  "cfa-11288:0", "cfa-11289:0", "cfa-11290:0", "cfa-11290:1", "cfa-11291:0",
  "cfa-11291:1", "cfa-11292:0", "cfa-11292:1", "cfa-11293:0", "cfa-11293:1",
  "cfa-11293:2", "cfa-11294:0", "cfa-11294:1", "cfa-11295:0", "cfa-11295:1",
  "cfa-11296:0", "cfa-11297:0", "cfa-11299:0", "cfa-11299:1", "cfa-1129:0",
  "cfa-1129:1", "cfa-11300:0", "cfa-11300:1", "cfa-11301:0", "cfa-11301:1",
  "cfa-11302:0", "cfa-11303:0", "cfa-11303:1", "cfa-11304:0", "cfa-11304:1",
  "cfa-11305:0", "cfa-11306:0", "cfa-11306:1", "cfa-11307:0", "cfa-1130:0",
  "cfa-1130:1"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-1129:0", "cfa-1129:1", "cfa-1130:0", "cfa-11293:0",
  "cfa-11306:0", "cfa-11306:1"
]);

const blockers = Object.freeze([
  { abilityId: "cfa-11284:0", blocker: "This RC placement AUTO requires the opposing Vanguard grade check, a separate Persona Ride condition, Counter-Blast 1, then a Set Order deck search/reveal/add/shuffle. No existing trusted server definition handles this exact conditional sequence." },
  { abilityId: "cfa-11285:0", blocker: "The exact source must be discarded from hand during its controller's turn, then pay both Counter-Blast 1 and Soul-Blast 1 before drawing. The source-aware discard event and atomic dual-cost draw are not covered by a trusted definition." },
  { abilityId: "cfa-11286:0", blocker: "This CONT restriction depends on this exact source boosting a Rear-Guard during the current battle and a specific Touken Ranbu crest, then forbids the opponent from calling grade 1 or greater from hand to GC. The battle-scoped restriction is not enforced by the authoritative guard path." },
  { abilityId: "cfa-11286:1", blocker: "The attack that hits must be the attack of the exact unit this source boosted. It then pays Counter-Blast 1 and Soul-Blast 1 before drawing; the booster-to-battle provenance and dual-cost effect are not represented together." },
  { abilityId: "cfa-11287:0", blocker: "After this exact source is placed on RC, it must rest as cost, select exactly two Drop cards matching either of two name filters, and move both to Soul. The filtered multi-target cost/effect sequence has no trusted handler." },
  { abilityId: "cfa-11288:0", blocker: "This 1/Turn trigger is limited to the left-column RC and a stand outside the Stand Phase, then Soul-Blasts 1, draws, and grants turn-long power. The stand-cause, circle, usage reset, and exact-source checks are not all modeled." },
  { abilityId: "cfa-11289:0", blocker: "Only this source's own boost of a grade-2-or-greater unit should trigger the battle-only +5000. No current trusted ability definition binds that exact source, boosted target grade, and battle duration." },
  { abilityId: "cfa-11290:0", blocker: "This RC ACT is once per turn, costs Counter-Blast 1, and grants +5000 until turn end to all controlled Rear-Guards whose names match either of two printed fragments. The multi-target OR-name filter is not an existing trusted ACT program." },
  { abilityId: "cfa-11290:1", blocker: "This attack-only CONT scales by the count of controlled Rear-Guards matching either of two name fragments. The evaluator does not currently provide that multi-name count bound to this attacking source." },
  { abilityId: "cfa-11291:0", blocker: "The exact source's column must continuously prevent opposing Rear-Guards in that column from intercepting. Authoritative intercept legality does not currently evaluate this source-column restriction." },
  { abilityId: "cfa-11291:1", blocker: "During this exact source's attack, if its Critical is at least 2, the opponent's hand-to-GC action must contain at least two cards in one call. The defender action validator has no matching minimum-card rule." },
  { abilityId: "cfa-11292:0", blocker: "This own-attack AUTO requires Shinken Hissatsu (three or more damage), battle-only +5000, and a separate condition that no Counter-Charge occurred this turn before Soul-Blast 1 and Counter Charge 1. That turn-history-dependent sequence is not trusted." },
  { abilityId: "cfa-11292:1", blocker: "When this unit is placed on GC, Counter-Blast 1 must be paid before drawing. The catalog text has no source-aware GC draw definition for this exact cost/effect, and the existing server path rejects it." },
  { abilityId: "cfa-11293:1", blocker: "This VC CONT requires the controller's turn and two or more grade-3 Soul cards whose names contain Yamanbagiri Kunihiro, then grants all front-row units +5000 and this source +1 Critical. The multi-target continuous Soul filter is not evaluated." },
  { abilityId: "cfa-11293:2", blocker: "This VC battle-close AUTO has Persona Ride-dependent alternate payment, a same-name card moved from RC or hand to Soul, then draw and optional hand-to-RC call with +10000/+1 Critical. Alternate costs, post-cost choices, and ordered resolution are unsupported together." },
  { abilityId: "cfa-11294:0", blocker: "Only this source's own attack qualifies; power is +5000 with a named ally and becomes +10000 when Drop also has at least two Ookanehira cards. The two-zone conditional replacement is not a trusted attack handler." },
  { abilityId: "cfa-11295:0", blocker: "The placement AUTO costs Counter-Blast 1, looks at exactly seven top cards, and optionally reveals/adds a card whose name contains Ookanehira before shuffling. No exact trusted seven-card name-search definition exists for this ability." },
  { abilityId: "cfa-11295:1", blocker: "This source's own attack requires choosing a controlled unit with Ookanehira in its name, then granting both exact instances +5000 until turn end. The name-filtered two-instance target and modifiers are not an authorized effect sequence." },
  { abilityId: "cfa-11296:0", blocker: "On this exact RC placement, pay Counter-Blast 1 and Soul-Blast 2, then retire every opposing Rear-Guard in the same column. Opponent-column selection and atomic multi-retirement are not supported." },
  { abilityId: "cfa-11297:0", blocker: "This 1/Turn AUTO depends on at least three of the controller's Plant Gauges being discarded simultaneously as an ability cost. Gauge identity/count and the cost-caused discard event are not represented." },
  { abilityId: "cfa-11299:0", blocker: "This placement AUTO retires one other friendly Rear-Guard, then calls up to two Plant tokens with printed grade, power, critical, and Boost. Token identity and the dependent 0-to-2 call choice are not supported together." },
  { abilityId: "cfa-11299:1", blocker: "This own-attack AUTO needs both a named Vanguard condition and opposing grade threshold, then selects a different back-row Rear-Guard and copies its current power to the attacking source through battle end. The exact target and dynamic power-copy effect are missing." },
  { abilityId: "cfa-11300:0", blocker: "This VC ACT is once per turn, costs Soul-Blast 3, grants the front row +3000 until turn end, and changes the source's attack to battle all opposing front-row units. Multi-target attack declarations and their defense flow are not supported." },
  { abilityId: "cfa-11300:1", blocker: "This VC CONT grants +3000 for every card in the controller's Damage Zone during their turn. The current continuous evaluator has no general per-damage-card power handler." },
  { abilityId: "cfa-11301:0", blocker: "This VC/RC 1/Turn ACT costs Counter-Blast 1 and asks the opponent to move each back-row Rear-Guard to an open front-row circle, choosing the order and destinations. Opponent-private multi-card choices are not an existing resolution flow." },
  { abilityId: "cfa-11301:1", blocker: "This GC AUTO checks whether the controller has more Rear-Guards than the opponent, grants battle shield, and offers Soul Charge 1. The conditional shield plus optional choice is not covered by a trusted guardian handler." },
  { abilityId: "cfa-11302:0", blocker: "The VC/RC placement AUTO grants this source permission to attack opposing back-row units until turn end and conditionally Soul Charges when Soul has two or fewer cards. Attack permission and the thresholded effect are unsupported." },
  { abilityId: "cfa-11303:0", blocker: "This source must be on an additional RC when placed before Soul-Blast 1 and Counter Charge 1 are available. The engine does not encode this exact extra-circle placement requirement in a trusted AUTO." },
  { abilityId: "cfa-11303:1", blocker: "This source's own Vanguard attack costs Counter-Blast 1, prevents normal hand calls to GC for that battle, then moves this source to Soul and draws at battle end. The battle restriction and ordered close-step effect are not handled together." },
  { abilityId: "cfa-11304:0", blocker: "While this source is on RC and its Vanguard is grade 3 or greater, card effects cannot retire it. This continuous protection is not enforced by the authoritative retirement action validator." },
  { abilityId: "cfa-11304:1", blocker: "This source's own boosted attack costs Soul-Blast 1, moves any chosen number of damage cards to Soul, then replaces each with a face-down top-deck card. The exact battle linkage, multi-card selection, and replacement sequence are unsupported." },
  { abilityId: "cfa-11305:0", blocker: "The CONT grants Intercept only while this source occupies an additional RC. Circle subtype state and conditional intercept legality are not supported by a trusted definition." },
  { abilityId: "cfa-11307:0", blocker: "This own-attack AUTO pays Counter-Blast 1, gives +6000, conditionally reveals the top card and gains Critical, then moves the source to Soul at turn end. Reveal state, temporary Critical, delayed source movement, and ordering are not one trusted handler." },
  { abilityId: "cfa-1130:1", blocker: "The hit must occur in the battle where this exact source boosted a Liberator-name unit; then this source moves to Soul, chooses a named Blaster Blade Liberator from Soul, and calls it to an open RC. Booster/battle provenance and the ordered source move plus named call are unsupported." }
]);

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0016",
    auditedAbilityIds,
    alreadySupportedAbilityIds,
    proposedDefinitionIds: Object.freeze(definitions.map(definition => definition.id)),
    blocked: blockers,
    provenanceWarnings: Object.freeze([
      {
        abilityIds: Object.freeze(["cfa-11306:0", "cfa-11306:1"]),
        note: "These two catalog abilities have existing engine patterns, but their catalog clan is 'Game' and no corresponding Bushiroad card-list entry was found. They are classified as existing code only; this batch does not certify them as official-card behavior."
      }
    ]),
    officialReferences: Object.freeze([
      { abilityId: "cfa-1129:0", cardNumber: "BT10/011EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F011EN&expansion=30&view=image", note: "Official entry confirms Halo Liberator, Mark's Sentinel keyword and deck limit." },
      { abilityId: "cfa-1129:1", cardNumber: "BT10/011EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F011EN&expansion=30&view=image", note: "Official entry confirms Gold Paladin discard and protection of an attacked Gold Paladin through that battle." },
      { abilityId: "cfa-1130:0", cardNumber: "PR/0068EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=PR%2F0068EN", note: "Official entry confirms Wingal Liberator's same-clan Forerunner text." },
      { abilityId: "cfa-11293:0", cardNumber: "D-TB04/005EN", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text", note: "Official D-TB04 card list confirms Yamanbagiri Kunihiro Kiwame Sentou is also regarded as Yamanbagiri Kunihiro Kiwame while on VC/RC." },
      { abilityId: "cfa-11294:1", cardNumber: "D-TB04/020EN", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text", note: "Official D-TB04 card list confirms Ookanehira Kiwame's GC-only +5000 shield at opposing grade 3+." },
      { abilityId: "cfa-11291:0", cardNumber: "D-TB04/066EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F066EN", note: "Official entry confirms Azuki Nagamitsu Kiwame's same-column opponent intercept restriction; this ability remains blocked pending a runtime handler." },
      { abilityId: "cfa-11291:1", cardNumber: "D-TB04/066EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F066EN", note: "Official entry confirms the two-or-more simultaneous hand-to-GC requirement; this ability remains blocked pending guard validation support." },
      { abilityId: "cfa-11292:0", cardNumber: "D-TB04/012EN", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text", note: "Official D-TB04 card list confirms Tsurumaru Kuninaga Kiwame's Shinken Hissatsu attack ability." },
      { abilityId: "cfa-11292:1", cardNumber: "D-TB04/012EN", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text", note: "Official D-TB04 card list confirms Tsurumaru Kuninaga Kiwame's GC Counter-Blast draw ability; this ability remains blocked pending a trusted resolver." },
      { abilityId: "cfa-11295:0", cardNumber: "D-TB04/021EN", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text", note: "Official D-TB04 card list confirms Uguisumaru Kiwame's top-seven Ookanehira search text; this ability remains blocked pending exact server support." },
      { abilityId: "cfa-11295:1", cardNumber: "D-TB04/021EN", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text", note: "Official D-TB04 card list confirms Uguisumaru Kiwame's attack power effect; this ability remains blocked pending target-selection support." }
    ])
  })
});

module.exports = definitions;
