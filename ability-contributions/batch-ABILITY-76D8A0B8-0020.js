"use strict";

// This batch adds no executable definitions: its one high-priority ride ability
// uses near-matching text that the existing strict server validator rejects.
const definitions = [];

const auditedAbilityIds = Object.freeze([
  "cfa-11405:0", "cfa-11405:1", "cfa-11410:0", "cfa-11410:1", "cfa-11411:0",
  "cfa-11413:0", "cfa-11413:1", "cfa-11414:0", "cfa-11414:1", "cfa-11416:0",
  "cfa-11417:0", "cfa-11418:0", "cfa-11419:0", "cfa-1141:0", "cfa-11421:0",
  "cfa-11421:1", "cfa-11426:0", "cfa-11426:1", "cfa-11427:0", "cfa-11428:0",
  "cfa-11428:1", "cfa-11429:0", "cfa-11429:1", "cfa-11430:0", "cfa-11430:1",
  "cfa-11431:0", "cfa-11432:0", "cfa-11433:0", "cfa-11433:1", "cfa-11434:0",
  "cfa-11435:0", "cfa-11435:1", "cfa-11436:0", "cfa-11436:1", "cfa-11437:0",
  "cfa-11438:0", "cfa-1143:0", "cfa-1143:1"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-11405:0", "cfa-11405:1", "cfa-11410:0", "cfa-11410:1", "cfa-1141:0",
  "cfa-11421:0", "cfa-11421:1", "cfa-1143:0"
]);

const blockers = Object.freeze([
  { abilityId: "cfa-11411:0", blocker: "The source is in Hand; the trigger is this player's attack not hitting, followed by Counter-Blast 1 and Soul-Blast 1, calling the exact source, applying +10000, and a shared same-name once-per-turn restriction. That combined trigger, cost, call, modifier, and shared restriction has no reviewed authoritative program." },
  { abilityId: "cfa-11413:0", blocker: "This VC CONT scales +3000 for each opposing open Rear-Guard Circle during its controller's turn. The continuous evaluator has no verified opponent-open-circle count condition for this source." },
  { abilityId: "cfa-11413:1", blocker: "Only this Vanguard's own attack may trigger; Soul-Blast 2 and choose/retire an opponent Rear-Guard in order. There is no trusted definition for this attack-source-bound cost and target sequence." },
  { abilityId: "cfa-11414:0", blocker: "This Hand ACT costs moving this exact hand instance into Soul and then chooses a friendly unit for +5000 until turn end. No reviewed server definition supports this exact hand-zone cost plus chosen target." },
  { abilityId: "cfa-11414:1", blocker: "The trigger is this exact card moving from Soul to Drop, after which Counter-Blast 1 returns it to hand. The current ability event family does not verify this source-zone transition and return cost together." },
  { abilityId: "cfa-11416:0", blocker: "Only this source's successful RC placement triggers; pay Counter-Blast 1, choose and retire an opponent front-row Rear-Guard, then give this source +5000. No trusted placement definition contains this target and ordered effect sequence." },
  { abilityId: "cfa-11417:0", blocker: "This source must itself attack a Vanguard; at trigger time the opponent must have at most three Rear-Guards, then this source gets battle-only +5000. The exact attack and opponent-count condition is not a reviewed runtime pattern." },
  { abilityId: "cfa-11418:0", blocker: "Only this Vanguard's placement draws, then the controller chooses a hand card and puts it on the bottom of the Deck. Existing draw/discard handlers do not model this bottom-deck choice." },
  { abilityId: "cfa-11419:0", blocker: "This exact RC placement costs Counter-Blast 1 plus Soul-Blast 1 and gives this source +10000 through turn end. No reviewed definition validates both resources and the source modifier atomically." },
  { abilityId: "cfa-11426:0", blocker: "When an opponent Rear-Guard is retired, this exact RC source gains +3000 through turn end. The event's retired-card controller/zone and source ownership need a reviewed event-bound definition." },
  { abilityId: "cfa-11426:1", blocker: "Once per turn, when a Black Organization attack hits a Vanguard, this source moves from RC to Soul and its controller Counter-Charges 1. There is no reviewed source-to-Soul trigger definition for this clan-wide attack event and shared usage rule." },
  { abilityId: "cfa-11427:0", blocker: "This exact unit must boost a grade 3 Black Organization; pay Counter-Blast 1, choose an opponent back-row Rear-Guard, and retire it. The current trusted programs do not bind this source's boost event to this filtered target." },
  { abilityId: "cfa-11428:0", blocker: "During its controller's turn, each card put into Soul should trigger this Vanguard's +5000 turn modifier. The engine lacks a verified card-to-Soul event program with this controller-turn condition." },
  { abilityId: "cfa-11428:1", blocker: "Once per turn after this Vanguard's own attack, Soul-Blast a grade 3 and discard two cards, stand this source, and reduce its Drive by 1 through turn end. This multi-cost restand program is not defined." },
  { abilityId: "cfa-11429:0", blocker: "At the end of the battle this exact RC unit boosted a grade 3+ Vanguard, move it to Soul and grant Force. The server has no reviewed boost-battle-end source move plus gift operation for this trigger." },
  { abilityId: "cfa-11429:1", blocker: "This Soul ACT discards two hand cards and returns this exact Soul instance to hand. The existing move-to-hand cost path does not validate this two-card discard and Soul source atomically; the catalog's Shift note is not rules text." },
  { abilityId: "cfa-11430:0", blocker: "Only this unit's own RC attack hitting a Vanguard while its controller has a grade 3+ Vanguard should Counter-Charge 1 and Soul-Charge 1. No reviewed exact-hit definition combines this condition and both effects." },
  { abilityId: "cfa-11430:1", blocker: "Only this source's own RC attack not hitting qualifies; Counter-Blast 1 and move this source into Soul, then draw two. That miss-trigger, paid source movement, and draw sequence has no trusted definition." },
  { abilityId: "cfa-11431:0", blocker: "This RC ACT pays Counter-Blast 1 and moves itself to Soul, then grants a selected grade 3+ Spirit a battle-scoped guard-call restriction. The granted ability requires a new validated battle-rule effect and cannot be approximated by power or prompt logic." },
  { abilityId: "cfa-11432:0", blocker: "This RC ACT retires its exact source as cost, then selects two friendly units for +5000 until turn end. No reviewed definition validates the source retirement and two distinct legal targets as one atomic activation." },
  { abilityId: "cfa-11433:0", blocker: "This VC/RC ACT pays Counter-Blast 3, retires all opposing front-row Rear-Guards, then Counter-Charges 2 only if at least three were retired. The all-target retirement count and dependent post-effect condition are unsupported." },
  { abilityId: "cfa-11433:1", blocker: "During this player's turn, an opponent Rear-Guard retirement grants this source +3000 until turn end. No reviewed retirement event handler binds the opponent's retired source and turn player to this effect." },
  { abilityId: "cfa-11434:0", blocker: "This once-per-name-per-turn RC ACT rests this source, searches for the exact Golden Baby card, calls it to an open RC, and shuffles. There is no trusted definition for this exact card-name search plus shared once-per-name restriction." },
  { abilityId: "cfa-11435:0", blocker: "On this source's VC/RC placement, pay Counter-Blast 1 and Soul-Blast 1; search for a grade 1 Spirit or Guardian Spirit, reveal/add it, and shuffle. The two-clan filtered search is not represented by an exact reviewed handler." },
  { abilityId: "cfa-11435:1", blocker: "At the end of the Vanguard's attack that did not hit, discard two cards and ride this exact Soul card standing, once per same-name card per turn. Trigger battle, source-zone, cost, ride replacement, and usage semantics need a combined reviewed program." },
  { abilityId: "cfa-11436:0", blocker: "This source gains +5000 for each Force marker when it attacks or boosts. No existing handler calculates the controller's marker count for both exact source events and battle-duration power." },
  { abilityId: "cfa-11436:1", blocker: "At the end of the battle this exact source attacked or boosted, move it from RC to Soul and draw. The boost/attack identity and battle-end source movement are not covered by a trusted handler." },
  { abilityId: "cfa-11437:0", blocker: "The local exact text is 'When this unit is rode upon', while the existing strict Quick Shield ride validator accepts only 'When rode upon'. The parser has no definition for this ID and Reducer.supportsServerAbilityEffects rejects a candidate with the catalog's exact text. The official Devil in Shadow record verifies the equivalent mechanic, but not this Cardfight Area card identity; a shared parser/validator extension plus card provenance review is required before adding a definition." },
  { abilityId: "cfa-11438:0", blocker: "On exact Vanguard placement, pay Counter-Blast 1 and Soul-Blast 1, search/call an Ultraman-named card, and only if this unit rode from grade 3 grant +10000 and +1 critical. The search, ride-history condition, and two modifiers are an unsupported ordered program." },
  { abilityId: "cfa-1143:1", blocker: "When a Genesis card other than the named Twilight Hunter rides this source, inspect seven cards and ride up to one exact-name card. The existing ride-trigger search pattern adds a card to hand; it cannot be reused for superior riding or the excluded-rider condition." }
]);

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0020",
    auditedAbilityIds,
    alreadySupportedAbilityIds,
    proposedDefinitionIds: Object.freeze([]),
    blocked: blockers,
    provenanceWarnings: Object.freeze([
      { abilityIds: Object.freeze(auditedAbilityIds.filter(id => !alreadySupportedAbilityIds.includes(id))),
        note: "The catalog records are from the Cardfight Area snapshot dated 2025-05-09, not individually verified Bushiroad card entries. Their exact local text is preserved; unsupported effects remain blocked." },
      { abilityIds: Object.freeze(["cfa-11437:0"]),
        note: "Official card text for Devil in Shadow has the same Quick Shield mechanic, but that source does not verify the local Animation-clan card name or identity." }
    ]),
    officialReferences: Object.freeze([
      { abilityId: "cfa-11437:0", cardNumber: "D-PV01/305EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-PV01%2F305EN",
        note: "Bushiroad's Devil in Shadow entry confirms the rode-upon draw and conditional Quick Shield effect wording. It is a mechanics reference only, not provenance for cfa-11437." },
      { abilityId: "cfa-11437:0", url: "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        note: "Official Comprehensive Rules reference for ride and AUTO timing; no specific card identity is asserted." }
    ])
  })
});

module.exports = definitions;
