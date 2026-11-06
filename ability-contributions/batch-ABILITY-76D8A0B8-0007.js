"use strict";

// This batch adds no runtime ability definitions. Its 37 unreviewed abilities
// require mechanics that the authoritative server path does not yet support.
// The audit records exact blockers, passive target protection, and official sources.
const contribution = [];

Object.defineProperty(contribution, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0007",
    counts: Object.freeze({ assigned: 46, existingProductionSupport: 8, passiveTargetingSupport: 1, concreteBlockers: 37, testOnlyProposals: 0 }),
    existingProductionSupport: Object.freeze([
      "cfa-1099:1", "cfa-1099:2", "cfa-1100:0", "cfa-1100:1",
      "cfa-1101:0", "cfa-11016:0", "cfa-11021:1", "cfa-11:0"
    ]),
    // This CONT is passive. It is intentionally not a manually activatable
    // trusted ability; authoritative target filters read its card text and zone.
    passiveTargetingSupport: Object.freeze(["cfa-10989:0"]),
    blockers: Object.freeze({
      "cfa-10985:0": "The source attack, Normal Order history, Counter-Blast, two legal Normal Units from Drop, ordered move to Soul, and battle-only power need one trusted sequential handler; none matches this complete text.",
      "cfa-10986:0": "A normal-order-play event must privately offer this exact Soul instance, then call it and require a second Soul choice to Drop; the order trigger and continuation path are missing.",
      "cfa-10987:0": "The ACT binds its exact source, then requires the opponent to choose and order up to two face-up Bind cards; conditional Vanguard power follows that choice. No cross-player choice continuation supports this sequence.",
      "cfa-10988:0": "The placement effect suppresses opposing Rear-Guard abilities in the same column through turn end; the authoritative reducer lacks a trusted timed suppression handler for this source and column effect.",
      "cfa-10989:1": "The source must be on RC with Generation Break 1 when its controller's Vanguard is attacked; the power threshold and chosen Vanguard must be checked at that event, with power lasting through turn end. No exact trusted attacked-Vanguard handler matches.",
      "cfa-10990:0": "This CONT changes the legality of each opposing Rear-Guard Vanguard attack from battle five onward and adds Counter-Blast payment at attack declaration; no trusted continuous attack restriction/payment rule exists.",
      "cfa-10990:1": "ACT removes this source and grants a restriction through the opponent's next turn; no trusted duration-tracked attack restriction supports it.",
      "cfa-10991:0": "The exact ride from Grade 0 by a Grade 1 Mushi must create the named crest and emit its ability event; no trusted handler couples rider predicate, ride event, and crest creation.",
      "cfa-10992:0": "This crest restricts riding, playing Set Orders, and Order Zone placement globally; no trusted continuous crest-rule handler enforces this combination.",
      "cfa-10992:1": "Search Deck or Hand for three named Attack cards of distinct grades and move them to Order Zone, shuffling only if Deck was searched; no trusted handler enforces distinct grades and both source zones together.",
      "cfa-10992:2": "This once-per-turn ACT needs Soul-Blast 1 and a top-five search filtered to Mushi or Attack; no trusted handler implements that exact union filter.",
      "cfa-10992:3": "A Mushi attack must select and rest a qualifying Attack Order, then execute that card's own Attack effect and timing; nested Order attacks lack a trusted resolver.",
      "cfa-1099:0": "The Limit Break ride trigger must match the exact ridden instance, then choose up to three Gold Paladin Rear-Guards and apply two amounts/durations; no trusted multi-target ride-trigger handler matches.",
      "cfa-11011:0": "Manual activation from Drop must check the Shieldfisher Vanguard, pay Counter-Blast 1, call this exact source, then grant turn power; no trusted Drop-to-RC manual handler covers all requirements.",
      "cfa-11012:0": "The CONT changes grade in RC, GC, or Soul based on Vanguard grade; the existing grade evaluator does not support these source locations.",
      "cfa-11012:1": "The placement AUTO conditionally Soul Charges, checks the exact charged card's grade, then selects a Grade 3 from Drop for Soul; no matching trusted identity-preserving sequence exists.",
      "cfa-11014:0": "On placement with a Greedon Vanguard, pay Soul-Blast 1, choose a Desire Devil in Drop, move it to Soul, then power this source; no exact trusted named Drop-to-Soul sequence matches.",
      "cfa-11015:0": "Deck-only identity aliasing depends on the current Greedon Vanguard and names in Soul; no trusted continuous rule models card-name identity in Deck.",
      "cfa-11015:1": "The client evaluator can read the Soul-count condition, but the definition fails supportsServerAbilityEffects; online power in RC and shield in GC on either turn is not trusted.",
      "cfa-11016:1": "This CONT changes the loss threshold to seven damage; no trusted ability-driven match-outcome override exists.",
      "cfa-11016:2": "The once-per-turn ACT removes a differently named Greedon from Hand, Soul, or Drop as cost, then searches the top seven for Desire Devil; no trusted cross-zone cost and filtered search matches.",
      "cfa-11016:3": "At this Vanguard's attack end, check Soul names, move three standing Rear-Guards as cost, stand this source, and grant turn power once per turn; no trusted full sequence matches.",
      "cfa-11017:0": "The singleton G-Deck construction restriction and Stride keyword are not ordinary effects; the trusted ability path does not enforce the one-copy deck rule.",
      "cfa-11017:1": "On VC placement, unlock any number of locked cards and discard the exact same number from Hand; no trusted variable-count paired-choice continuation exists.",
      "cfa-11017:2": "VC placement or turn-start timing checks face-up status, damage count, and whether damage changed during the previous opponent turn, then moves Deck top to Damage and draws; history/timing support is missing.",
      "cfa-11017:3": "The G-Zone trigger depends on going second and a Grade 1 ridden from Grade 0, then reveals this G Unit and creates a Guardian Shield ticket; no trusted first-ride, turn-order, reveal handler matches.",
      "cfa-11021:0": "This CONT grants own-turn power based on Blitz Order count in Drop; no trusted server continuous condition supports that order-type count.",
      "cfa-11022:0": "The own-attack trigger requires a Blitz Order in Drop, Soul-Blast 1, then battle-duration power; no trusted handler matches this condition/cost/effect combination.",
      "cfa-11022:1": "At attack end, bind this unit and pay Counter-Blast, then search a grade-filtered Blitz Order excluding Regalis Piece, with a conditional normal-order branch; no trusted multi-branch search handles these filters.",
      "cfa-11023:0": "Placement from Hand plus a grade/name Vanguard condition leads to Soul-Blast, retiring two other Rear-Guards, and calling a grade-filtered Drop target; no exact trusted multi-cost Drop-call sequence exists.",
      "cfa-11023:1": "Battle Phase start checks for Rorowa and Radylina, then may create/call a Plant token; the battle-start trigger and authoritative token definition are not supported together.",
      "cfa-11024:0": "The named ride trigger creates up to two Plant tokens, grants each a temporary retire-to-draw ability, and activates Persona Ride; no trusted ride-source token/granted-ability sequence matches.",
      "cfa-11024:1": "This attack binds a named Soul card, powers the source and a chosen Glitter Rear-Guard, adds Critical, then schedules the bound instance to be ridden rested at turn end; no trusted linked sequence exists.",
      "cfa-11026:0": "Placement by a Vanguard ability must be identified, then Counter-Blast paid, a card drawn, and this source powered through turn end; no trusted handler matches the placement provenance and sequence.",
      "cfa-11026:1": "Only this source's attack hitting a Vanguard of Grade 4+ should Counter-Charge; existing trusted attack-hit Counter-Charge wording has no grade condition.",
      "cfa-11028:0": "The exact Silhouette Man ride trigger searches for the named Order Machineries Factory; the trusted named-rider search requires different exact text/behavior and does not compile this source.",
      "cfa-110:0": "The attack-hit trigger must match the battle where this exact source boosted a Nova Grappler; optionally Counter-Charge, then return this booster to Deck at turn end. No trusted linked-battle/delayed-return handler matches."
    }),
    catalogDiscrepancies: Object.freeze([
      Object.freeze({
        abilityId: "cfa-1099:2",
        officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=TD08%2F001EN",
        detail: "The catalog labels Lord CONT; Bushiroad's TD08/001EN page prints [ACT](VC/RC):Lord. Trusted keyword behavior exists, but exact ability-type transcription needs primary-session review."
      }),
      Object.freeze({
        abilityId: "cfa-11017:0",
        officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?keyword=D-PV01&keyword_type=&sort=no&view=text",
        detail: "Catalog groups the singleton CONT and Stride reminder together and omits the printed Stride Step cost; this is not exact full-card text validation."
      })
    ]),
    officialSourceCoverage: Object.freeze([
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&s_param=d-Dark+States&sort=no&view=text",
        coverage: "Official D-BT11 card text",
        abilityIds: Object.freeze(["cfa-10985:0", "cfa-11012:0", "cfa-11012:1", "cfa-11014:0", "cfa-11015:0", "cfa-11015:1", "cfa-11016:0", "cfa-11016:1", "cfa-11016:2", "cfa-11016:3"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&sort=no&view=text",
        coverage: "Official D-BT11 card text",
        abilityIds: Object.freeze(["cfa-11022:0", "cfa-11022:1", "cfa-11024:0", "cfa-11024:1", "cfa-11026:0", "cfa-11026:1", "cfa-11028:0"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/information/pv01-card-ability-update/",
        coverage: "Official card ability updates/errata",
        abilityIds: Object.freeze(["cfa-10988:0", "cfa-10989:0", "cfa-10989:1", "cfa-10990:0", "cfa-10990:1"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F073EN",
        coverage: "Official individual card text: Dancing Princess, Shelcia",
        abilityIds: Object.freeze(["cfa-10986:0"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F059EN",
        coverage: "Official individual card text: Dragritter, Kassim",
        abilityIds: Object.freeze(["cfa-10987:0"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT13%2FEX10EN",
        coverage: "Official individual card text: Mushiking: King of the Beetles",
        abilityIds: Object.freeze(["cfa-10991:0"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT13%2FEX20EN",
        coverage: "Official individual card text: Machine Crest",
        abilityIds: Object.freeze(["cfa-10992:0", "cfa-10992:1", "cfa-10992:2", "cfa-10992:3"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/errata/mushiking-king-of-the-beetles-machine/",
        coverage: "Official Machine Crest erratum: distinct grades and corrected top-five wording",
        abilityIds: Object.freeze(["cfa-10992:1", "cfa-10992:2"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/?cardno=TD08%2F001EN",
        coverage: "Official individual card text: Solitary Liberator, Gancelot",
        abilityIds: Object.freeze(["cfa-1099:0", "cfa-1099:1", "cfa-1099:2"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/?cardno=TD08%2F002EN",
        coverage: "Official individual card text: Dignified Gold Dragon",
        abilityIds: Object.freeze(["cfa-1100:0", "cfa-1100:1"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=26&sort=no&view=text",
        coverage: "Official TD08 product card list text: Onslaught Liberator, Maelzion",
        abilityIds: Object.freeze(["cfa-1101:0"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/?cardno=BT04%2F080EN",
        coverage: "Official individual card text: Grapple Mania",
        abilityIds: Object.freeze(["cfa-110:0"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?keyword=D-PV01&keyword_type=&sort=no&view=text",
        coverage: "Official card list text: Harmonics Messiah",
        abilityIds: Object.freeze(["cfa-11017:0", "cfa-11017:1", "cfa-11017:2", "cfa-11017:3"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/deckrecipe/detail/d-bt11-rorowa",
        coverage: "Official deck-recipe summaries for Mathias and Rorowa; not treated as verbatim card-text evidence",
        abilityIds: Object.freeze(["cfa-11023:0", "cfa-11023:1", "cfa-11024:0", "cfa-11024:1"])
      })
    ]),
    noDirectOfficialTextLocated: Object.freeze(["cfa-11011:0", "cfa-11021:0", "cfa-11021:1", "cfa-11:0"])
  })
});

module.exports = contribution;
