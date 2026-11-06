"use strict";

// Audit-only contribution. The five listed abilities already compile in the
// production engine, so this module deliberately registers no duplicate data.
// The remaining entries retain explicit blockers pending trusted handlers and
// official text verification.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");
const fs = require("node:fs");
const path = require("node:path");

const batchId = "ABILITY-76D8A0B8-0022";
const abilityIds = Object.freeze([
  "cfa-11472:0", "cfa-11472:1", "cfa-11474:0", "cfa-11475:0", "cfa-11478:0", "cfa-11478:1", "cfa-11478:2",
  "cfa-11479:0", "cfa-11480:0", "cfa-11480:1", "cfa-11481:0", "cfa-11482:0", "cfa-11483:0", "cfa-11483:1",
  "cfa-11484:0", "cfa-11484:1", "cfa-11485:0", "cfa-11485:1", "cfa-11486:0", "cfa-11487:0", "cfa-11488:0",
  "cfa-11489:0", "cfa-11489:1", "cfa-11489:2", "cfa-1148:0", "cfa-1148:1", "cfa-11490:0", "cfa-11493:0",
  "cfa-11493:1", "cfa-11494:0", "cfa-11494:1", "cfa-11494:2", "cfa-11495:0", "cfa-11495:1", "cfa-11495:2",
  "cfa-11496:0", "cfa-11496:1", "cfa-11497:0", "cfa-11498:0", "cfa-11498:1", "cfa-1149:0", "cfa-1149:1",
  "cfa-11501:0", "cfa-11501:1"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-11489:0", "cfa-11489:1", "cfa-11489:2", "cfa-1148:1", "cfa-1149:0"
]);
const serverResolvedAbilityIds = Object.freeze([
  "cfa-11489:1", "cfa-11489:2", "cfa-1148:1", "cfa-1149:0"
]);
const keywordAbilityIds = Object.freeze(["cfa-11489:0"]);
const proposedDefinitions = Object.freeze([]);

const officialChecks = Object.freeze([
  Object.freeze({
    cardId: "cfa-1148",
    cardNumber: "BT10/033EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F033EN",
    abilityIds: Object.freeze(["cfa-1148:0", "cfa-1148:1"]),
    status: "mechanics-confirmed-local-wording-variant",
    note: "The official Bushiroad card entry confirms both ride abilities. The local record is not a verbatim match: it changes card/unit wording, rearranges the two searchable names, and paraphrases the second ride condition. The top-seven search ability remains blocked because the local wording does not match the trusted compiler template."
  }),
  Object.freeze({
    cardId: "cfa-1149",
    cardNumber: "BT10/032EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F032EN",
    abilityIds: Object.freeze(["cfa-1149:0", "cfa-1149:1"]),
    status: "mechanics-confirmed-local-wording-variant",
    note: "The official Bushiroad entry confirms Forerunner and the Genesis-boost hit ability. The local wording is normalized rather than verbatim. The Forerunner mechanic is already handled; the hit ability's Counter-Blast 2 and Soul-Charge 3 are not supported by the existing exact server whitelist."
  })
]);

const blockerById = Object.freeze({
  "cfa-11472:0": "This CONT requires both named cards in Soul and applies +10000 continuously to every front-row unit. There is no trusted two-name Soul predicate combined with a multi-unit continuous power effect for this text.",
  "cfa-11472:1": "This once-per-turn ACT pays by moving another Ultraman-named rear-guard into Soul, then grants this source critical. The card-name-filtered movement cost and once-per-turn activation are not compiled as this exact manual ability.",
  "cfa-11474:0": "This RC placement AUTO pays Soul Blast 2, draws, and gives the source +6000 until turn end. The exact paid placement sequence and ordered draw/modifier do not have a trusted compiled definition.",
  "cfa-11475:0": "This RC CONT checks Soul for the exact Ultra Galaxy Fight order name and grants Intercept. The name predicate and continuous keyword grant are not a trusted definition for this entry.",
  "cfa-11478:0": "This VC placement AUTO searches the full Deck for one exact-name card, calls it to RC, then shuffles. A generic same-name call operation exists, but this card has no official source mapping or exact compiled definition authorizing it.",
  "cfa-11478:1": "This Vanguard's own attack requires an exact rear-guard name, Counter Blast 1 and Soul Blast 1, then grants both power and Drive through turn end. The condition, combined cost, and two modifiers are not supported together.",
  "cfa-11478:2": "This once-per-turn VC ACT pays Soul Blast 1 and chooses any unit for +6000 until turn end. The exact manual timing, cost, target choice, and usage record are not compiled for this ability.",
  "cfa-11479:0": "This RC placement AUTO pays Soul Blast 1, grants source power, and conditionally changes a separately named Vanguard's original critical. The characteristic change and its grade gate are not supported as this effect sequence.",
  "cfa-11480:0": "This Soul ACT moves its source to Drop as cost, Soul Charges 2, then chooses a unit for +3000. The source-zone activation, move cost, sequential charge, and target modifier have no trusted combined resolver.",
  "cfa-11480:1": "This RC CONT checks for the exact order name in Soul and grants Intercept. The dynamic Soul-name condition plus keyword grant is not compiled for this text.",
  "cfa-11481:0": "After RC placement it Soul Charges 1 and then selects a grade 2-or-less card from Drop to Soul. The ordered second selection and grade-filtered zone move are not available in a trusted definition.",
  "cfa-11482:0": "This hand-to-RC placement AUTO pays Counter Blast 1 and searches the top five for a grade 3 Ultraman card to reveal and add to hand. This filtered top-five search and cost combination is not compiled for this card.",
  "cfa-11483:0": "This GC placement AUTO pays Soul Blast 1 and adds +10000 shield for that battle. The server does not have a trusted exact paid Guardian Circle shield modifier for this wording.",
  "cfa-11483:1": "The phrase 'four or more cards' does not identify which public or private zones count. Since the continuous condition is materially ambiguous in the local snapshot, it remains blocked for card-text review.",
  "cfa-11484:0": "This VC placement AUTO combines Counter Blast and Soul Blast, a Drive increase, an opposing Vanguard power reduction, and a grade-gated critical increase. The ordered costs, target, and conditional characteristic effects are not compiled together.",
  "cfa-11484:1": "This Vanguard attack AUTO checks the opposing Vanguard's current power, then chooses and retires an opposing rear-guard. The live power condition and opponent-target retirement have no exact definition for this card.",
  "cfa-11485:0": "This placement AUTO pays Counter Blast 1 and Soul Blast 1, draws, reduces an opposing Vanguard's power, and conditionally changes this source's critical. The cost, opponent choice, and conditional critical effect are not supported as a sequence.",
  "cfa-11485:1": "This VC/RC own-attack AUTO has a live opposing-Vanguard power threshold and an optional Soul Charge. No reviewed definition for this exact trigger/condition combination exists.",
  "cfa-11486:0": "This VC/RC attack AUTO checks opponent Vanguard power, retires an opposing rear-guard, and adds a draw only when the source is on VC. The conditional split result is not covered by a trusted effect program.",
  "cfa-11487:0": "This RC ACT pays by moving the source into Soul and debuffs an opponent Vanguard; copies share one once-per-turn restriction by card name. The shared usage key and opponent target resolution are not implemented together for this card.",
  "cfa-11488:0": "This RC ACT moves its source to Soul and Counter Charges. Although both operations exist independently, the local card has no official text reference or exact reviewed manual-ability definition, so the cost cannot be safely compiled.",
  "cfa-1148:0": "Bushiroad confirms the exact named-rider top-seven search mechanic, but the local record says 'unit named' instead of 'card named' and reverses the two searched names. The trusted compiler does not match this local wording, and no new definition is proposed from a wording variant.",
  "cfa-11490:0": "This boost AUTO checks opposing Vanguard power, pays Soul Blast 1, then restricts the opponent to calling at least two hand cards to GC for the battle. The exact booster/battle identity and temporary guarding restriction are unsupported.",
  "cfa-11493:0": "This once-per-turn ACT discards a grade-sum cost, searches and rides a grade 4 as stand, then schedules a grade 3 ride from Soul as rest at end turn. The cost selection, ride sequence, and delayed ride are not supported together.",
  "cfa-11493:1": "This rode-upon AUTO returns one Normal Unit from Soul and Drop to the Deck bottom, reveals two Deck cards, puts one into hand, and the rest into Soul. Its two-zone cost and ordered reveal resolution are unsupported.",
  "cfa-11494:0": "This own-attack AUTO checks whether the Vanguard was placed this turn, pays Counter Blast, then applies four different effects at Soul-count thresholds 6, 8, 10, and 15. The threshold branching and final multi-card Soul call are not implemented as one program.",
  "cfa-11494:1": "This once-per-turn ACT puts two specifically named rear-guards into Soul, draws, creates a Protect marker, and places it on RC. The two-card filtered cost and marker placement choice are not a trusted sequence.",
  "cfa-11494:2": "This CONT changes the card's name identity to include Juran. Dynamic card-name aliasing affects searches and conditions and is not handled by the current continuous-effect system.",
  "cfa-11495:0": "This own-attack AUTO pays Counter Blast, searches for a Hero, calls and powers it, shuffles, and optionally Soul Charges 3. The Hero filter, call target, modifier, and optional final operation are not verified together.",
  "cfa-11495:1": "This once-per-turn ACT moves two specifically named rear-guards into Soul, draws, and creates and places a Protect marker. The two-source filtered cost and marker placement are unsupported as a complete action.",
  "cfa-11495:2": "This CONT changes the card's name identity to include Vroon. The game does not have a trusted dynamic card-name alias effect for subsequent name matching.",
  "cfa-11496:0": "This RC/GC CONT checks for three Protect markers and grants power, shield, and Intercept. Marker counting across circles and the location-specific stat/keyword effects are not compiled together.",
  "cfa-11496:1": "This Soul ACT checks for three Protect markers, discards a hand card, calls this source, grants power and critical, and may Soul Charge. The marker predicate, paid self-call, modifiers, and optional effect are unsupported as one resolution.",
  "cfa-11497:0": "This AUTO depends on the source being placed on a circle containing a Protect marker; it pays Counter Blast, grants power, inspects two Deck cards, and splits them between hand and Soul. Circle-marker identity and the sequential choice are unsupported.",
  "cfa-11498:0": "This placement AUTO requires a Protect marker on the entered circle, moves a hand card to Soul as cost, Soul Charges, and draws. The exact marker-circle placement event and hand-to-Soul payment are not a trusted combined definition.",
  "cfa-11498:1": "This Soul ACT checks for three Protect markers, discards a hand card, calls this source to RC, and optionally Soul Charges. The marker count, discard cost, self-call, and optional charge are not implemented together.",
  "cfa-1149:1": "Bushiroad confirms the Genesis-boost attack-hit condition, but the effect pays Counter Blast 2 before Soul Charging 3. The trusted similar handler is hard-coded to different cards and a free Soul Charge 1; it does not authorize this paid effect or controller cost.",
  "cfa-11501:0": "This ride AUTO pays Counter Blast, Soul Charges 2, and creates/places a Protect marker. The ride event, paid cost, multi-card movement, and marker selection are unsupported together.",
  "cfa-11501:1": "This RC CONT grants +10000 only during its controller's turn when there are at least three Protect markers. The current continuous evaluator has no reviewed Protect-marker count condition for this card."
});

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "ability-work-batches.json"), "utf8"))
  .batches.find(batch => batch.batchId === batchId);
if (!assignment) throw new Error(`Assignment ${batchId} is missing from the registry.`);
if (JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...abilityIds].sort())) {
  throw new Error(`Contribution IDs differ from reserved batch ${batchId}.`);
}

const supportedSet = new Set(alreadySupportedAbilityIds);
const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing: ${abilityId}`);
  const serverResolved = Reducer.supportsServerAbilityEffects(ability);
  if (serverResolved !== serverResolvedAbilityIds.includes(abilityId)) throw new Error(`Unexpected server support status: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    printedText: ability.printedText,
    localSource: card.source || null,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    serverResolved
  });
}));

const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing catalog ability or specific blocker: ${abilityId}`);
  if (ability.definition) throw new Error(`Unexpected compiled ability omitted from support list: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    localSource: card.source || null,
    blocker: blockerById[abilityId]
  });
}));

module.exports = Object.freeze({
  batchId,
  abilityIds,
  alreadySupportedAbilityIds,
  serverResolvedAbilityIds,
  keywordAbilityIds,
  supportedDefinitions,
  unsupportedSiblings,
  officialChecks,
  proposedDefinitions
});
