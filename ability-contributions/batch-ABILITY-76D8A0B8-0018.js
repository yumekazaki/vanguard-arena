"use strict";

// Audit-only contribution: this batch contains no new definition that can be
// added safely using only existing trusted effect programs. Six abilities
// already have matching runtime behavior; the remaining 38 are fail-closed.
const definitions = [];

const auditedAbilityIds = Object.freeze([
  "cfa-11346:0", "cfa-11346:1", "cfa-11347:0", "cfa-11350:0", "cfa-11350:1",
  "cfa-11351:0", "cfa-11351:1", "cfa-11352:0", "cfa-11353:0", "cfa-11353:1",
  "cfa-11354:0", "cfa-11355:0", "cfa-11356:0", "cfa-11356:1", "cfa-11356:2",
  "cfa-11357:0", "cfa-11358:0", "cfa-11364:0", "cfa-11364:1", "cfa-11365:0",
  "cfa-11365:1", "cfa-11366:0", "cfa-11366:1", "cfa-11366:2", "cfa-11367:0",
  "cfa-11367:1", "cfa-11368:0", "cfa-11368:1", "cfa-11369:0", "cfa-11369:1",
  "cfa-11369:2", "cfa-1136:0", "cfa-1136:1", "cfa-11370:0", "cfa-11371:0",
  "cfa-11371:1", "cfa-11372:0", "cfa-11372:1", "cfa-11373:0", "cfa-11374:0",
  "cfa-11375:0", "cfa-11375:1", "cfa-1137:0", "cfa-1137:1"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-11356:0", "cfa-11356:1", "cfa-11356:2", "cfa-1136:1", "cfa-1137:0", "cfa-1137:1"
]);

const blockers = Object.freeze([
  { abilityId: "cfa-11346:0", blocker: "The placed-unit AUTO pays Soul-Blast 1 and creates a Homonculus token with its own grade, power, critical, and Boost identity. The production token handler currently constructs only Quick Shield tickets, so substituting that token would be incorrect." },
  { abilityId: "cfa-11346:1", blocker: "The power bonus must apply to the exact Homonculus token created by this controller's card ability. Homonculus token creation and token-instance event provenance are not implemented." },
  { abilityId: "cfa-11347:0", blocker: "The attack must originate from this source on an additional Rear-Guard Circle, then pay Counter-Blast 1 and retire a different Rear-Guard before drawing two and granting power. Additional-circle state and atomic cost provenance are not enforced by a trusted handler." },
  { abilityId: "cfa-11350:0", blocker: "This battle-close Vanguard AUTO requires an opposing grade threshold, Counter-Blast 1, retiring exactly three Rear-Guards, preventing Accel acquisition, then same-name stand riding from hand with power. The gift restriction, multi-retire cost, and ride sequence are unsupported together." },
  { abilityId: "cfa-11350:1", blocker: "The local snapshot text resembles the existing own-attack Soul-Blast power pattern, but omits that pattern's explicit optional-payment wording and has no matching Bushiroad listing. The activation choice and authoritative wording need source review before reuse." },
  { abilityId: "cfa-11351:0", blocker: "This placement AUTO needs an opposing grade condition, Counter-Blast 1, a variable number of hand discards, power per discarded card, and a thresholded Critical/drive increase. Dynamic costs and the dependent characteristic changes are not represented by a trusted program." },
  { abilityId: "cfa-11351:1", blocker: "After this exact source attacks, Soul-Blast 5 establishes a battle restriction requiring the opponent to call at least three cards simultaneously from hand to GC. The authoritative guard validator does not enforce minimum simultaneous guard count." },
  { abilityId: "cfa-11352:0", blocker: "The placement AUTO gives the opponent the choice of which Rear-Guard to retire. The effect resolver does not provide this opponent-private choice and ownership-scoped decision flow." },
  { abilityId: "cfa-11353:0", blocker: "This trigger originates from the exact card in Soul when a named unit is placed on VC, then offers a call and temporary power. Soul-source event discovery and the name-bound nested placement are not supported together." },
  { abilityId: "cfa-11353:1", blocker: "At this source's own battle end it must move itself to Soul, retire another friendly Rear-Guard as cost, then choose and retire an opposing Rear-Guard. Battle linkage, ordered cost payment, and opponent-board target selection are not handled atomically." },
  { abilityId: "cfa-11354:0", blocker: "This once-per-turn ACT rests itself and pays Counter-Blast 1, then draws; only afterward a same-column named-unit condition stands the source and grants power. The sequential same-column branch is not an existing trusted ACT program." },
  { abilityId: "cfa-11355:0", blocker: "This once-per-turn ACT rests itself, chooses a card from Damage or Drop and moves it to Soul, replaces a moved damage card with a face-down deck-top card, then checks a same-column unit to stand and grant power. The mixed-zone choice and conditional replacement sequence are unsupported." },
  { abilityId: "cfa-11357:0", blocker: "This CONT substitutes one exact source for two Rear-Guards when paying a retirement cost. The authoritative cost validator has no retirement-count substitution rule." },
  { abilityId: "cfa-11358:0", blocker: "The once-per-turn ACT Soul-Blasts and rests this source, then prevents a chosen opposing Rear-Guard from standing during the opponent's next Stand Phase. Delayed stand restrictions are not tracked by the turn-phase state." },
  { abilityId: "cfa-11364:0", blocker: "This CONT continuously reduces the power of opposing Rear-Guards sharing this source's column. Cross-player column membership and the live opposing-unit power modifier are not evaluated by a trusted continuous handler." },
  { abilityId: "cfa-11364:1", blocker: "After placement and Counter-Blast 1, this ability reveals the deck's top card and calls that exact card. The resolver has no matching reveal-top-then-call program that preserves identity and handles an empty deck atomically." },
  { abilityId: "cfa-11365:0", blocker: "This placement effect searches the top five for a specifically named card, reveals and adds it, shuffles, and conditionally discards after a successful add. The conditional hand choice is not available in the existing search handlers." },
  { abilityId: "cfa-11365:1", blocker: "Counter-Charge is triggered only when this exact Rear-Guard is retired as a cost of its controller's card. Retirement events do not carry trusted cost-caused provenance for this source-specific trigger." },
  { abilityId: "cfa-11366:0", blocker: "On Vanguard placement, choose a Set Order from hand or Drop and move it to the Order Zone; drawing is required only when it came from hand. Drop-to-order movement and branch-specific draw are not supported by an existing effect program." },
  { abilityId: "cfa-11366:1", blocker: "This own-Vanguard-attack effect checks Set Order thresholds twice, granting battle power at two and additional drive at four. The exact source-bound dual threshold drive modifier is not present as a trusted definition." },
  { abilityId: "cfa-11366:2", blocker: "This once-per-turn ACT requires two Set Orders, discards one from hand, draws one, and grants turn-long power. Although the basic operations exist, there is no trusted definition validating the Order Zone gate and exact cost/effect order for this text." },
  { abilityId: "cfa-11367:0", blocker: "This Vanguard attack pays both Counter-Blast and Soul-Blast, searches hand or deck for a same-name copy, calls it, and grants two separate power modifiers. Multi-zone name search and sequential source/target modifiers are not covered by a trusted handler." },
  { abilityId: "cfa-11367:1", blocker: "After placement and Soul-Blast 1, choose up to four Normal Units from Drop, return them to the deck, shuffle, then grant power only if at least two returned. Multi-card typed return with a count-dependent branch is unsupported." },
  { abilityId: "cfa-11368:0", blocker: "Once-per-turn, this attack returns up to two Set Orders from Drop to deck, shuffles, and draws/grants power only when at least two return. Set-Order filtering plus the count-dependent branch is not an existing trusted effect program." },
  { abilityId: "cfa-11368:1", blocker: "The trigger is playing a Set Order, with an optional Soul Charge and a second optional draw conditioned on four Set Orders. Set-Order play events and the nested optional threshold choice are not represented in the current trigger pipeline." },
  { abilityId: "cfa-11369:0", blocker: "At ride-phase start, a named Soul condition gates a named deck search, reveal/add/shuffle, then discard only after a successful add. The ride-phase timing and dependent named search sequence lack a trusted definition." },
  { abilityId: "cfa-11369:1", blocker: "This placement AUTO pays Counter-Blast 1 and searches specifically for a Set Order to add and shuffle. The general search handler does not enforce Set Order card type for this ability." },
  { abilityId: "cfa-11369:2", blocker: "This once-per-turn own-attack AUTO requires two Set Orders, hand discard, draw, and turn-long power. The Order Zone condition and exact discard/draw ordering have no trusted definition for this source." },
  { abilityId: "cfa-1136:0", blocker: "Bushiroad confirms the Limit-Break attack, Soul-Blast 3, draw two, choose any hand card into Soul, and battle power sequence. Existing effects cannot move an unrestricted chosen hand card into Soul, so the full official ability cannot resolve correctly." },
  { abilityId: "cfa-11370:0", blocker: "The CONT requires additional-circle occupancy for power and grants Resist. Additional Rear-Guard Circle type and effect-target protection are not both evaluated by trusted continuous and target-validation paths." },
  { abilityId: "cfa-11371:0", blocker: "After placement and Counter-Blast 1, search for the exact named Owl Baron, call it, and shuffle. The current named Drop-to-call compiler is not a general deck-search definition and does not validate this specific card text." },
  { abilityId: "cfa-11371:1", blocker: "The once-per-turn attack AUTO gates a hand discard and draw on two Set Orders. There is no trusted definition binding this Order Zone count, usage key, and cost sequence to this ability." },
  { abilityId: "cfa-11372:0", blocker: "At ride-phase start, a named Soul condition gates searching for a named Female Summoner, adding/shuffling, then discarding only after a successful add. That exact phase-triggered chain is not implemented by a trusted handler." },
  { abilityId: "cfa-11372:1", blocker: "At the end of the battle this exact source boosted, a named Vanguard condition gates moving it to Soul, returning a Set Order from Drop to hand, choosing a unit, and granting power. Booster-battle provenance and this ordered multi-zone effect are unsupported." },
  { abilityId: "cfa-11373:0", blocker: "This placement cost moves a card from Damage to deck bottom, then deals damage and performs a damage check; same-name once-per-turn limits also apply. Atomic damage replacement and the check event are not supported in an ability program." },
  { abilityId: "cfa-11374:0", blocker: "This placement AUTO pays Counter-Blast 1 and calls a Grade 0 from Drop, with a Set Order threshold changing the target restriction to any card. The conditional target filter and call-from-Drop sequence are not an existing trusted program." },
  { abilityId: "cfa-11375:0", blocker: "At the end of this source's own boost battle, move it to deck bottom, search for a named card, reveal/add, and shuffle. The exact booster linkage plus ordered source movement and search are not handled together." },
  { abilityId: "cfa-11375:1", blocker: "This CONT grants power only during the battle in which this exact source boosted a unit named Owl Duke. The continuous evaluator does not bind the source to the current battle's booster-target record." }
]);

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0018",
    baselineCommit: "76d8a0b86451f6de05d4477b2ca08772925ce9cf",
    auditedAbilityIds,
    alreadySupportedAbilityIds,
    proposedDefinitionIds: Object.freeze([]),
    blocked: blockers,
    provenanceWarnings: Object.freeze([
      {
        cardIds: Object.freeze([
          "cfa-11346", "cfa-11347", "cfa-11350", "cfa-11351", "cfa-11352", "cfa-11353",
          "cfa-11354", "cfa-11355", "cfa-11356", "cfa-11357", "cfa-11358", "cfa-11364",
          "cfa-11365", "cfa-11366", "cfa-11367", "cfa-11368", "cfa-11369", "cfa-11370",
          "cfa-11371", "cfa-11372", "cfa-11373", "cfa-11374", "cfa-11375"
        ]),
        note: "These catalog entries are marked clan Game and come from the Cardfight Area snapshot. An official Bushiroad English card-list match was not found for them during this audit; their text and identity need authoritative source review before the batch can be certified."
      }
    ]),
    officialReferences: Object.freeze([
      { abilityId: "cfa-1136:0", cardNumber: "BT10/013EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F013EN&faq=", note: "Official entry confirms Battle Deity of the Night, Artemis's Limit-Break AUTO, cost, effect order, and battle duration." },
      { abilityId: "cfa-1136:1", cardNumber: "BT10/013EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F013EN&faq=", note: "Official entry confirms the exact-name Soul condition and Vanguard-only continuous power." },
      { abilityId: "cfa-1137:0", cardNumber: "TD13/003EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=TD13%2F003EN", note: "Official entry confirms Saffron's Vanguard Limit-Break attack power ability." },
      { abilityId: "cfa-1137:1", cardNumber: "TD13/003EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=TD13%2F003EN", note: "Official entry confirms Saffron's Rear-Guard attack ability and Genesis Vanguard condition." }
    ])
  })
});

module.exports = definitions;
