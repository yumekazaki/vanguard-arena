"use strict";

// Batch audit only. Four assigned abilities already have exact reusable
// definitions and ability-level regression evidence. The remaining records
// are intentionally not compiled until their concrete rule gaps are handled.
const abilityIds = Object.freeze([
  "cfa-10361:0", "cfa-10361:1", "cfa-10362:0", "cfa-10363:0", "cfa-10364:0",
  "cfa-10364:1", "cfa-10364:2", "cfa-10365:0", "cfa-10365:1", "cfa-10366:0",
  "cfa-10367:0", "cfa-10368:0", "cfa-10369:0", "cfa-10370:0", "cfa-10371:0",
  "cfa-10372:0", "cfa-10374:0", "cfa-10375:0", "cfa-10376:0", "cfa-10376:1",
  "cfa-10377:0", "cfa-10377:1", "cfa-10378:0", "cfa-10379:0", "cfa-1037:0",
  "cfa-10380:0", "cfa-10381:0", "cfa-10382:0", "cfa-10382:1", "cfa-10383:0",
  "cfa-10384:0", "cfa-1038:0", "cfa-1038:1", "cfa-1038:2"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10361:1", "cfa-10379:0", "cfa-1038:1", "cfa-1038:2"
]);

const blockers = Object.freeze({
  "cfa-10361:0": "The RevolDress-only placement trigger is recognized, but the ordered program (front-row power, Counter-Blast, reveal two, match a revealed grade to an opponent rear-guard, bottom-deck it, then add both revealed cards) has no exact trusted resolution handler.",
  "cfa-10362:0": "The trigger must be another Vanguard with Kairi in its name attacking; source return, optional same-name hand call, and conditional Vanguard power are not modeled as one atomic program.",
  "cfa-10363:0": "The once-per-turn trigger must identify a Meteorite entering the Order Zone from a non-Drop zone; the event provenance, Drop target selection, order movement, and power effect are not jointly validated.",
  "cfa-10364:0": "The CONT imposes both a ride prohibition and a rested-call replacement; the current authoritative ride and call legality paths do not implement these source-specific restrictions.",
  "cfa-10364:1": "This source may stand only by its own ability; the engine does not yet enforce an instance-specific stand prohibition while preserving the permitted own-ability stand.",
  "cfa-10364:2": "The beginning-of-battle-phase trigger requires three Equip Gauges, then a conditional stand and delayed end-of-turn retirement; gauge counting, stand-success tracking, and delayed retirement are not modeled together.",
  "cfa-10365:0": "The ability requires ability-caused placement during its controller's turn, discarding the top two cards, granting a temporary attack-or-boost battle-end AUTO, and choosing a unit for turn power; that dynamic ability and ordered cost/effects are unsupported.",
  "cfa-10365:1": "The Drop-zone AUTO needs the exact Vanguard-attack event, ten-card Drop threshold, Counter-Blast, and a legal open Rear-Guard call of this exact instance.",
  "cfa-10366:0": "Soul-Blast 2 and a +10000 choice restricted to another unit in the source's same column are not represented by an exact, server-trusted effect definition.",
  "cfa-10367:0": "The hit trigger needs the exact attacking source, a Flagburg Vanguard condition, and a once-per-turn stand of the source; that card-name and usage combination is not implemented.",
  "cfa-10368:0": "This CONT combines turn-specific Persona Ride history, attack-battle power, and a minimum simultaneous hand-to-Guardian call restriction; Persona Ride state and the guard-action rule are not modeled together.",
  "cfa-10369:0": "The battle-close trigger must match this exact booster and Bastion Vanguard, inspect that battle's drive-check grades, then pay Counter-Blast plus source retirement and stand a Rear-Guard.",
  "cfa-10370:0": "The battle-close effect needs exact booster/Vanguard identity, opponent grade and empty-Rear-Guard conditions, Counter-Blast plus discard, then stand a Vanguard and set both critical and drive to 1 for the turn.",
  "cfa-10371:0": "The ACT's Eugene Vanguard requirement, retirement of this exact source as cost, and opponent Rear-Guard target retirement are not assembled into one validated server action.",
  "cfa-10372:0": "The AUTO must react to a unit standing by an ability, retire this source as cost, and draw; the event type must preserve cause and the exact stood unit.",
  "cfa-10374:0": "The placement AUTO's Counter-Blast and cost of moving a grade-2-or-greater Set Order from Drop to deck bottom need typed Order validation and atomic resource/payment handling.",
  "cfa-10375:0": "The ACT requires turn-scoped Product-operation history, Counter-Blast and source rest, then selection and execution of a Product Order's Operate ability; that action history and nested Order effect are unsupported.",
  "cfa-10376:0": "The attack program must retire two selected grade-3 Rear-Guards into Soul, draw, then count grade-3 Soul cards after payment for battle-only power; typed cost selection and post-cost count timing are not implemented.",
  "cfa-10376:1": "The CONT has two grade-3 Soul thresholds, grants Shield and Boost at one threshold, and imposes a three-card simultaneous guard-call restriction only during this Vanguard's battle at the other.",
  "cfa-10377:0": "The ACT requires exact X-overDress state, Soul-Blast 2, and opponent Rear-Guard retirement; the X-overDress status predicate is not modeled for trusted activation.",
  "cfa-10377:1": "The AUTO requires the source to be X-overDress and attacking a Vanguard, scales battle power by opponent open circles, and conditionally pays Counter-Blast to reduce drive and perform a drive check; state and battle resolution are unsupported.",
  "cfa-10378:0": "This front-row source triggers from another same-column unit attacking and grants battle-only power to that exact attacker; the source/target column association and attack-scoped modifier are not implemented.",
  "cfa-1037:0": "The placement AUTO requires a Narukami Vanguard, a Counter-Blast payment, front-row opponent Rear-Guard targeting, and retirement; no exact trusted multi-zone placement handler covers it.",
  "cfa-10380:0": "The back-row-center source must see a friendly Rear-Guard's first battle of the turn and grant power to that exact attacker; attack-count timing and cross-card target identity are not modeled.",
  "cfa-10381:0": "On this exact unit's boost, the optional Drop choice is legal only when Soul lacks a card of the selected card's grade; that cross-zone grade predicate and movement are not implemented.",
  "cfa-10382:0": "The once-per-turn own-attack AUTO needs an opponent grade-3-or-greater target and four distinct Soul grades before granting turn power; target-grade and distinct-grade conditions are not reviewed handlers.",
  "cfa-10382:1": "This trigger must attribute a simultaneous Soul-Blast of at least four to the controller's Vanguard ability, check opponent grade, pay Counter-Blast, and stand the exact source; cost-cause provenance is not modeled.",
  "cfa-10383:0": "The originalDress state-change trigger, Counter-Blast, Soul Charge, and opponent Rear-Guard retirement require a typed state event and ordered resolution not present in the trusted server engine.",
  "cfa-10384:0": "The AUTO must match operation of this named Fortress and check that no Counter-Charge occurred this turn before Soul-Blast and Counter-Charge; operation attribution and turn history are missing.",
  "cfa-1038:0": "The ACT is not compiled: Limit Break 5, Counter-Blast 3, power/critical increase, and granting a front-row multi-target battle ability require a composable continuous attack modifier and turn-scoped dynamic ability.",
});

const officialReferences = Object.freeze([
  { abilityIds: Object.freeze(["cfa-10361:1"]), url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT07%2F011EN", checkedText: true },
  { abilityIds: Object.freeze(["cfa-1038:0", "cfa-1038:1", "cfa-1038:2"]), url: "https://en.cf-vanguard.com/cardlist/?cardno=BT09%2F008EN", checkedText: true }
]);

const unsupported = Object.freeze(abilityIds.filter(abilityId => !alreadySupportedAbilityIds.includes(abilityId)).map(abilityId => {
  const blocker = blockers[abilityId];
  if (!blocker) throw new Error(`Missing explicit blocker for ${abilityId}`);
  return Object.freeze({ abilityId, blocker });
}));

const audit = Object.freeze({
  batchId: "ABILITY-320008F1-0014",
  status: "four-existing-definitions-30-blocked",
  dataset: "Cardfight Area local card catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  abilityIds,
  supportedProductionAbilityIds: alreadySupportedAbilityIds,
  implementedAbilityIds: Object.freeze([]),
  proposedDefinitionIds: Object.freeze([]),
  unsupported,
  officialReferences,
  notes: "No production definition was added in this audit. The four compiled records retain the production definitions and focused evidence already present in the repository; none is promoted to whole-card verified status by this batch."
});

module.exports = Object.freeze({ audit, abilityIds, alreadySupportedAbilityIds, unsupported });
