"use strict";

// This batch adds no ability definitions. Its auditable result is attached as
// non-enumerable metadata so the shared contribution loader cannot mistake
// audit records for executable skills.
const contribution = [];

const assignedAbilityIds = Object.freeze([
  "cfa-11187:0", "cfa-11187:1", "cfa-11187:2", "cfa-11188:0", "cfa-11188:1", "cfa-11188:2",
  "cfa-11189:0", "cfa-11189:1", "cfa-11191:0", "cfa-11192:0", "cfa-11193:0", "cfa-11193:1",
  "cfa-11193:2", "cfa-11194:0", "cfa-11194:1", "cfa-11195:0", "cfa-11195:1", "cfa-11197:0",
  "cfa-11197:1", "cfa-11198:0", "cfa-11198:1", "cfa-11199:0", "cfa-11199:1", "cfa-11199:2",
  "cfa-1119:0", "cfa-1119:1", "cfa-1119:2", "cfa-11201:0", "cfa-11202:0", "cfa-11202:1",
  "cfa-11203:0", "cfa-11204:0", "cfa-11204:1", "cfa-11204:2", "cfa-11204:3", "cfa-11205:0",
  "cfa-11206:0", "cfa-11207:0", "cfa-11207:1", "cfa-11208:0", "cfa-11208:1", "cfa-11209:0",
  "cfa-11209:1", "cfa-1120:0", "cfa-1120:1", "cfa-11210:0", "cfa-11210:1", "cfa-11211:0",
  "cfa-11211:1", "cfa-1121:0", "cfa-1121:1", "cfa-1121:2"
]);

// These IDs already bind to code in the shared engine. A binding alone is not
// certification: each entry records the source or authoritative-runtime gap.
const existingDefinitions = Object.freeze({
  "cfa-11187:0": { patternId: "cont-card-name-alias-v1", serverSupported: false,
    blocker: "Bushiroad errata confirms the card identity but gives no text for this alias; the local card name is Liliaria while the official errata uses Lilialia. In addition, the server reducer does not support this CONT definition." },
  "cfa-11188:0": { patternId: "cont-card-name-alias-v1", serverSupported: false,
    blocker: "The official errata confirms Greed Dominator, Arvali's identity but does not provide the exact alias wording. The server reducer does not support this CONT definition." },
  "cfa-11197:1": { patternId: "cont-rc-own-turn-named-grade-vanguard-power-v1", serverSupported: false,
    blocker: "The exact Gareth text is on Bushiroad's D-BT11/090EN entry, but supportsServerAbilityEffects returns false; no authoritative continuous-power resolution path is wired for this ability." },
  "cfa-1119:0": { patternId: "cont-vanguard-cannot-be-boosted-v1", serverSupported: false,
    blocker: "No official Bushiroad text source for this local Blaster Blade Burst record was found, and the server reducer does not support this CONT definition." },
  "cfa-1119:2": { patternId: "auto-own-attack-vanguard-power-battle-v1", serverSupported: true,
    blocker: "The exact card identity/text was not matched to an official Bushiroad card-text entry. Existing authority tests pass, but provenance remains unresolved, so this is not verified production coverage." },
  "cfa-1120:0": { patternId: "auto-forerunner-same-clan-ride-call-source-v1", serverSupported: true,
    blocker: "The exact Claudia card-text entry was not located on Bushiroad's site. Existing Forerunner authority tests cover execution, but this card's provenance remains unresolved." },
  "cfa-1120:1": { patternId: "act-source-to-soul-optional-up-to-one-friendly-power-v1", serverSupported: true,
    blocker: "The exact Claudia card-text entry was not located on Bushiroad's site. Existing shared-handler tests cover costs and optional targets, but this card's provenance remains unresolved." },
  "cfa-11209:0": { patternId: "cont-vc-rc-card-name-alias-v1", serverSupported: false,
    blocker: "The exact Kashuu alias text is listed by Bushiroad for D-TB04/002EN, but the server reducer does not support this CONT definition." },
  "cfa-1121:2": { patternId: "cont-lord-attack-restriction-v1", serverSupported: false,
    blocker: "The official BT10/003EN entry confirms Lord, but supportsServerAbilityEffects returns false; the authoritative server path does not enforce this continuous attack restriction." }
});

// Every ID without an existing definition is fail-closed. These blockers name
// the unsupported event matching, cost, choice, state rule, or ordered effect.
const unsupported = Object.freeze({
  "cfa-11187:1": "Requires this exact unit to enter an RC from hand, a grade-3+ Vanguard check, Counter-Blast 1, a grade-limited Drop choice, and a call. No compiled placement-plus-private-target handler is linked.",
  "cfa-11187:2": "Requires an ongoing CONT evaluation of this unit's own RC, controller turn, and at least two back-row grade-1-or-less rear-guards before granting +5000. No matching continuous evaluator is linked.",
  "cfa-11188:1": "Changes the controller's loss threshold to seven only while a named Greedon is in Soul. No authoritative game-loss threshold modifier exists for this skill.",
  "cfa-11188:2": "Must wait for the end of this exact Vanguard's attack, Soul-Blast 2, move four standing rear-guards to Soul, stand that Vanguard, then conditionally grant +15000 based on post-cost Soul count. No ordered resolver supports the complete sequence.",
  "cfa-11189:0": "Requires an own RC placement outside battle, a Genesis-only Vanguard, Counter-Blast 1 plus Soul-Blast 1, draw, then reveal and branch between calling a legal hand unit and discarding it. No complete branch/choice handler is linked.",
  "cfa-11189:1": "Requires the exact source to have boosted in the closing battle, a Genesis-only Vanguard, moving two same-column rear-guards to Soul, then privately choosing a Genesis-only Drop card for hand. No complete ordered resolver is linked.",
  "cfa-11191:0": "Requires an exact ride onto this source by a grade-2 Mikazuki Munechika, then top-two inspection, a grade-limited call, and ordering remaining cards on top/bottom. The local card identity/text was not matched to a Bushiroad card-text entry; no ride-choice resolver is linked.",
  "cfa-11192:0": "A CONT modifier must waive the discard cost only for a grade-3 Mikazuki ride from Ride Deck when Soul has at least two named cards. The official G-TB02 Mikazuki Munechika Toku is a grade-4 G Unit, conflicting with this local grade-2 record; no matching official text or ride-cost rule handler is verified.",
  "cfa-11193:0": "Requires continuous tracking of the controller's turn and three or more standing rear-guards before changing this Vanguard's power and critical. No server continuous evaluator is linked.",
  "cfa-11193:1": "An ACT must pay Soul-Blast 1, inspect two cards, choose up to one to call, and order each remaining card on top/bottom. No compiled top-two choice/order effect is linked.",
  "cfa-11193:2": "Must match this Vanguard's attack against a grade-3+ unit, discard two cards, choose exactly two front-row rear-guards, and stand them. No complete attack/cost/target handler is linked.",
  "cfa-11194:0": "Combines front-row target protection with a hand-wide replacement rule for paying a Vanguard discard cost. The catalog misspells 'discarded' as 'discrded', so exact text provenance fails; no target-legality and cost-substitution handlers are linked.",
  "cfa-11194:1": "Requires Shinken Hissatsu (three or more damage) to grant +10000 while this unit is in RC, including during the opponent's turn. No matching continuous condition evaluator is linked.",
  "cfa-11195:0": "Imposes a shared once-per-turn limit across all Forge ACT abilities in the Order Zone. No shared-card-name usage-restriction handler is linked.",
  "cfa-11195:1": "Requires a once-per-turn ACT with a filtered Drop-to-bottom-deck cost, reveal-until-N normal units, select one to call rested, conditional stand and per-other-revealed-card power, then shuffle. The official text is available, but no single handler models this full sequence and its choices.",
  "cfa-11197:0": "Must match only this card being ridden by the exact named Beaumains, search Deck for a named order, reveal/add to hand, and shuffle. No ride-triggered filtered search handler is linked.",
  "cfa-11198:0": "Requires once-per-turn VC ACT, both named Soul conditions, discard cost, choosing Blond Ezel from Ride Deck, riding it standing, and applying drive -1. No ride-deck choice/cost resolver is linked.",
  "cfa-11198:1": "Must match this exact rear-guard's own attack under an Ezel Vanguard, offer optional +5000, and only if accepted schedule this source to bottom-deck at battle end. No linked handler models the conditional delayed branch.",
  "cfa-11199:0": "Continuous ride restriction must reject every ride whose card name lacks Ezel while this Vanguard is active. No ride legality rule handler is linked.",
  "cfa-11199:1": "Triggers at the start of this controller's ride phase only if total units are three or fewer, pays Soul-Blast 1, inspects top three, calls a grade-3-or-less unit to an open RC, and puts the rest on bottom in chosen order. No ride-phase top-three resolver is linked.",
  "cfa-11199:2": "Must match this Vanguard attacking a grade-3+ Vanguard, pay Counter-Blast 1, inspect seven, choose up to two grade-3-or-less units for open RCs, grant +10000 through turn end, and shuffle. No complete filtered multi-call resolver is linked.",
  "cfa-1119:1": "Requires this exact Vanguard's attack, optional Counter-Blast 2 restricted to Royal Paladin damage cards, and power equal to the original power sum of its front-row Royal Paladin rear-guards for only that battle. No optional clan-filtered cost/snapshot handler is linked.",
  "cfa-11201:0": "On this exact unit's RC placement, requires a grade-3+ Gold-Paladin-only Vanguard, applies +5000, then pays Counter-Blast 1 and draws. No exact clan-gated placement sequence is linked.",
  "cfa-11202:0": "On this exact RC placement, requires a Vanguard with exactly one clan, pays Soul-Blast 2, and Counter-Charges 1. No single-clan condition validator is linked.",
  "cfa-11202:1": "Must match the exact source having boosted and the end of that battle, require an Ezel Vanguard, bottom-deck another same-column rear-guard as cost, then stand this source. No same-column battle-close resolver is linked.",
  "cfa-11203:0": "Must match this exact booster boosting a grade-3+ card, check opponent Vanguard grade 3+, pay Soul-Blast 1, and grant this booster +10000 for that battle. No complete source-specific boost resolver is linked.",
  "cfa-11204:0": "Ride Deck 'Stand Up!!' moves Training Equipment into Order Zone and asks for a non-Kiwame Ride Deck unit to move face-up there with the training status. Official sources describe the gimmick but the exact printed card text was not found; no start-game Ride Deck choice handler is linked.",
  "cfa-11204:1": "Order-Zone CONT must suppress all AUTO and ACT abilities on the current Vanguard. No general continuous ability-negation rule handler is linked.",
  "cfa-11204:2": "Order-Zone CONT must prohibit normal rides from hand and waive the discard cost for Ride Deck rides. No authoritative ride-legality/cost modifier is linked.",
  "cfa-11204:3": "Requires an Order Zone ACT gated by empty Ride Deck and no ride this turn, moving the training card to Soul, finding the corresponding Kiwame from hand/deck, riding it, conditional shuffle, moving this order to Soul, and granting a race-based crest. Exact text plus multi-step ride/crest handling is not supported.",
  "cfa-11205:0": "Requires this exact rear-guard's attack to hit a Vanguard, Counter-Blast 1 and move the source to Soul, draw, then choose and retire an opponent rear-guard. No complete hit/cost/retire handler is linked; exact official card text was not found.",
  "cfa-11206:0": "Shinken Hissatsu grants Intercept, back-row intercept permission, and +5000 shield in both RC/GC when damage is 3+. No continuous guardian-rule/shield handler is linked, and exact official card text was not found.",
  "cfa-11207:0": "Unconditional +10000 on RC during either player's turn needs a continuous power modifier; no authoritative handler is linked and exact official card text was not found.",
  "cfa-11207:1": "Attack restriction depends on a turn-wide count of attacks already performed; no attack-legality check consumes this card's restriction, and exact official card text was not found.",
  "cfa-11208:0": "Once-per-turn trigger requires this exact rear-guard's attack to hit a grade-3+ Vanguard, Counter-Blast 1, rest a chosen rear-guard, then stand the source. No complete hit/once-per-turn cost choice handler is linked.",
  "cfa-11208:1": "Must match this exact unit standing during the battle phase and grant +5000, or +10000 when the named crest is present. No stand-event continuous/power modifier for this branch is linked.",
  "cfa-11209:1": "Combines an end-of-battle AUTO with persona-ride alternative cost, discard plus same-name card moved from RC/hand to Soul, stand and set critical/drive to 1, then conditionally grants a second temporary AUTO with its own once-per-turn Counter-Blast and drive reduction. No nested temporary ability/replacement-cost resolver is linked.",
  "cfa-11210:0": "On exact RC placement, pays Counter-Blast 1, searches top seven for grade-3+ Kashuu, reveals/adds and shuffles, or if none chooses a Kashuu unit from Drop. No conditional search/fallback private-choice handler is linked.",
  "cfa-11210:1": "Requires a Kashuu Vanguard to have stood due to an ability this turn before granting +10000 to this source on RC. No continuous evaluator tracks the exact stand cause.",
  "cfa-11211:0": "Requires own turn and a grade-1-or-less rear-guard in this exact unit's same column before +5000. No same-column continuous evaluator is linked.",
  "cfa-11211:1": "Must match a grade-3+ named Vanguard's attack while this source is in the front row, bottom-deck this source as cost, draw, choose a Vanguard, then grant battle-only +5000. No exact-source attack event and ordered target handler is linked.",
  "cfa-1121:0": "Requires Limit Break 4 and own turn, then continuous power equal to +2000 per Liberator-named rear-guard. No authoritative conditional-counting continuous evaluator is linked.",
  "cfa-1121:1": "ACT needs Counter-Blast 2 restricted to Liberator-named damage cards, top-card inspection, Gold Paladin selection/call to open RC, and bottom-deck remainder. The local text says 'up to one' for viewing while official BT10/003 says to look at the top card; exact catalog wording differs and no complete handler is linked."
});

const officialTextEvidence = Object.freeze({
  "cfa-11187": { status: "identity-only-name-mismatch", url: "https://en.cf-vanguard.com/errata/page/4/", exactAbilityIds: [], note: "Official errata identifies D-BT11/SECP05EN as Love Song Flower Maiden, Lilialia. It does not provide the skill text, and the local name is Liliaria." },
  "cfa-11188": { status: "identity-only", url: "https://en.cf-vanguard.com/errata/page/4/", exactAbilityIds: [], note: "Official errata identifies D-BT11/SECP02EN as Greed Dominator, Arvali, but does not provide its ability text." },
  "cfa-11189": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F029EN", exactAbilityIds: ["cfa-11189:0", "cfa-11189:1"], note: "Official D-BT11/029EN listing reproduces both AUTO abilities." },
  "cfa-11191": { status: "identity-only-text-unmatched", url: "https://en.cf-vanguard.com/information/d_title_trial_deck_01_touken_ranbu_-online-_2021/", exactAbilityIds: [], note: "Bushiroad's official guide names Mikazuki Munechika Sentou as a card/image, but does not publish the local ride-trigger wording. No exact card-list text was matched." },
  "cfa-11192": { status: "identity-conflict", url: "https://en.cf-vanguard.com/cardlist/?cardno=G-TB02%2F002EN&expansion=88&view=image", exactAbilityIds: [], note: "The official Mikazuki Munechika Toku card is a grade-4 G Unit; the local catalog record is a grade-2 unit with a Ride Deck cost modifier. Do not treat these as the same card." },
  "cfa-11193": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F001EN", exactAbilityIds: ["cfa-11193:0", "cfa-11193:1", "cfa-11193:2"], note: "Official D-TB04/001EN listing reproduces all three abilities." },
  "cfa-11194": { status: "partial-catalog-text-mismatch", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F007EN", exactAbilityIds: ["cfa-11194:1"], note: "D-TB04/007EN confirms Shinken Hissatsu. For :0 the local catalog spells 'discrded'; official text is 'discarded', so that ability is not an exact text match." },
  "cfa-11195": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F091EN", exactAbilityIds: ["cfa-11195:0", "cfa-11195:1"], note: "Official Forge page reproduces both Order Zone abilities." },
  "cfa-11197": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F090EN", exactAbilityIds: ["cfa-11197:0", "cfa-11197:1"], note: "Official D-BT11/090EN listing reproduces both abilities." },
  "cfa-11198": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F086EN", exactAbilityIds: ["cfa-11198:0", "cfa-11198:1"], note: "Official D-BT11/086EN listing reproduces both abilities." },
  "cfa-11199": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F011EN", exactAbilityIds: ["cfa-11199:0", "cfa-11199:1", "cfa-11199:2"], note: "Official D-BT11/011EN listing reproduces all three abilities." },
  "cfa-1119": { status: "not-found", url: null, exactAbilityIds: [], note: "No official Bushiroad card-text entry was found matching the local Blaster Blade Burst record." },
  "cfa-1120": { status: "not-found", url: null, exactAbilityIds: [], note: "No official Bushiroad card-text entry was found matching the local Claudia record." },
  "cfa-11201": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F089EN", exactAbilityIds: ["cfa-11201:0"], note: "Official D-BT11/089EN listing reproduces the placement AUTO." },
  "cfa-11202": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F030EN", exactAbilityIds: ["cfa-11202:0", "cfa-11202:1"], note: "Official D-BT11/030EN listing reproduces both abilities." },
  "cfa-11203": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F072EN", exactAbilityIds: ["cfa-11203:0"], note: "Official D-BT11/072EN listing reproduces the boost AUTO." },
  "cfa-11204": { status: "partial", url: "https://en.cf-vanguard.com/raise-your-touken-danshi-once-more-on-may-24th/", exactAbilityIds: [], note: "Official feature article describes Training Equipment's ride, Soul, Kiwame, and crest gameplay, and the official Fighter's Rules lists ride-deck construction; neither supplies the complete printed card text used locally." },
  "cfa-11205": { status: "not-found", url: null, exactAbilityIds: [], note: "No exact official Bushiroad card-text entry for Shinano Toushirou Kiwame was retrieved." },
  "cfa-11206": { status: "not-found", url: null, exactAbilityIds: [], note: "No exact official Bushiroad card-text entry for Monoyoshi Sadamune Kiwame was retrieved." },
  "cfa-11207": { status: "not-found", url: null, exactAbilityIds: [], note: "No exact official Bushiroad card-text entry for Nagasone Kotetsu Kiwame was retrieved." },
  "cfa-11208": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F017EN", exactAbilityIds: ["cfa-11208:0", "cfa-11208:1"], note: "Official D-TB04/017EN listing reproduces both abilities." },
  "cfa-11209": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F002EN", exactAbilityIds: ["cfa-11209:0", "cfa-11209:1"], note: "Official D-TB04/002EN listing reproduces the alias and Kashuu Kiyomitsu Kiwame Sentou AUTO text." },
  "cfa-11210": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F024EN", exactAbilityIds: ["cfa-11210:0", "cfa-11210:1"], note: "Official D-TB04/024EN listing reproduces both abilities." },
  "cfa-11211": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F011EN", exactAbilityIds: ["cfa-11211:0", "cfa-11211:1"], note: "Official D-TB04/011EN listing reproduces both abilities." },
  "cfa-1121": { status: "partial-catalog-text-mismatch", url: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F003EN&faq=", exactAbilityIds: ["cfa-1121:0", "cfa-1121:2"], note: "Official BT10/003EN confirms Limit Break and Lord. The local ACT says 'look at up to one card' while the official text says 'look at the top card'; :1 is therefore not an exact match." }
});

const wholeCardStatus = Object.freeze(Object.fromEntries(
  [...new Set(assignedAbilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))]
    .map(cardId => [cardId, { status: "unverified", reason: "This audit classifies individual abilities only and does not validate all card abilities together in gameplay." }])
));

Object.defineProperty(contribution, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0012",
    claimBranch: "claims/ABILITY-76D8A0B8-0012",
    assignedAbilityIds,
    existingDefinitions,
    unsupported,
    productionVerifiedIds: Object.freeze([]),
    testOnlyProposals: Object.freeze([]),
    officialTextEvidence,
    wholeCardStatus
  })
});

module.exports = contribution;
