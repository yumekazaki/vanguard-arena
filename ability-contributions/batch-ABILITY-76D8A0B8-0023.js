"use strict";

// This batch adds no runtime definitions. Three abilities already have
// compiled production support; every remaining ability is listed with its
// exact catalog text and a card-specific implementation blocker.
const definitions = [];
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const fs = require("node:fs");
const path = require("node:path");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

const batchId = "ABILITY-76D8A0B8-0023";
const auditedAbilityIds = Object.freeze([
  "cfa-11502:0", "cfa-11504:0", "cfa-11504:1", "cfa-11505:0", "cfa-11505:1",
  "cfa-11511:0", "cfa-11511:1", "cfa-11513:0", "cfa-11514:0", "cfa-11515:0",
  "cfa-11515:1", "cfa-11516:0", "cfa-11516:1", "cfa-11517:0", "cfa-11518:0",
  "cfa-11518:1", "cfa-11519:0", "cfa-11520:0", "cfa-11521:0", "cfa-11523:0",
  "cfa-11523:1", "cfa-11527:0", "cfa-11528:0", "cfa-11529:0", "cfa-11530:0",
  "cfa-11531:0", "cfa-11531:1", "cfa-11531:2", "cfa-11533:0", "cfa-11534:0",
  "cfa-11534:1", "cfa-11535:0", "cfa-11536:0", "cfa-11536:1", "cfa-11537:0",
  "cfa-11539:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-11511:0", "cfa-11511:1", "cfa-11518:0"
]);

const blockerById = Object.freeze({
  "cfa-11502:0": "The source must be placed on a circle that currently has a Protect marker; then its controller pays Soul Blast 1, Counter-Charges 1, and grants the source +5000 for the turn. No reviewed handler binds the marker condition, cost, charge, and source modifier to this placement event.",
  "cfa-11504:0": "This Hand ACT discards its own source as cost, searches either Deck or Drop for a grade-3 Zenkaiser-name card, reveals/adds it, and shuffles only after a Deck search. The current server has no reviewed combined hand-source cost and two-zone filtered search transaction for this card.",
  "cfa-11504:1": "This Hand CONT changes how this exact card may be counted when discarded as a grade-3 cost. No authoritative hand-discard legality path applies a source-specific temporary grade override.",
  "cfa-11505:0": "This RC placement AUTO checks for at least two Protect markers, pays Counter Blast 1, chooses up to five Normal Units in Soul, gains power per chosen card, then returns those exact cards to Deck and shuffles. The multi-card Soul selection and count-dependent ordered effect are unsupported.",
  "cfa-11505:1": "This Soul ACT requires at least three Protect markers, discards a hand card, calls this source from Soul to RC, and optionally Soul-Charges 1. The source-zone ACT, discard cost, call, and optional follow-up are not an authorized atomic program.",
  "cfa-11513:0": "This CONT powers every friendly OriginalDress unit in the source's same column, including during the opponent's turn. Continuous effects do not currently evaluate that dynamic column scope and OriginalDress state together.",
  "cfa-11514:0": "The source's own RC attack gains power per friendly grade-1-or-less Rear-Guard. The existing source-power-per-count handler supports other fixed count classes, not a grade-filtered Rear-Guard count.",
  "cfa-11515:0": "The prior Vanguard must be this source and the incoming rider must be exactly Cataclysmic Bullet of Dust Storm, Randor; draw only if the opponent has no Rear-Guards. The ride handler does not validate this exact incoming-card name and opponent-board condition together.",
  "cfa-11515:1": "This ACT activates from Soul, retires a Rest Rear-Guard as cost, calls this source from Soul to RC, and grants turn power. No trusted Soul-source ACT handler accepts that retirement cost and subsequent source call.",
  "cfa-11516:0": "The trigger can be this unit's own attack or boost, and requires an opposing Rear-Guard retired by the Vanguard's ability earlier this turn; its power depends on the opponent's current open RC count. The event provenance and dynamic battle count are not jointly represented by an authorized effect.",
  "cfa-11516:1": "At the end of this source's boosted battle, the controller may retire it, choose up to three Soul cards to return and shuffle, then Counter-Charge only if no Counter-Charge happened this turn. The optional source cost, variable Soul return, and turn-history condition are unsupported as one sequence.",
  "cfa-11517:0": "This once-per-turn watcher reacts to another unit placed by a card ability, pays Counter Blast 1 and draws; if the Vanguard's Solrairon ability caused that placement, the exact placed unit also gets power. The placement event does not yet authorize the causing ability and target identity for this combined sequence.",
  "cfa-11518:1": "After a Solrairon-conditioned RC placement, this ability chooses top or bottom for the current top card, then pays Counter Blast 1, reveals the next top card, optionally calls it if it is a Unit and an RC is open, and puts it into Soul if not called. This multi-stage private choice, cost timing, and conditional fallback are not supported together.",
  "cfa-11519:0": "This CONT depends on a friendly Rear-Guard having moved to Soul by a Vanguard ability during the current turn, then continuously grants +10000. The evaluator lacks this controller-side effect-provenance history condition.",
  "cfa-11520:0": "The trigger is another unit in this source's same column attacking; that exact attacker, rather than the source, receives +5000 for the battle. No reviewed event matcher and target handler preserve the column relationship and attacker instance together.",
  "cfa-11521:0": "This ride AUTO requires an actual ride over this source by a grade-1 Quintuplet and also requires that its controller went second. The existing second-player ride-draw program does not enforce the incoming grade and Quintuplet filter.",
  "cfa-11523:0": "The source must be placed by riding from a grade-1 Quintuplet, then look at seven cards and put up to one Quintuplet into Memory before shuffling. The ride-origin filter and top-seven filtered Memory search are not an existing authorized effect.",
  "cfa-11523:1": "The CONT needs both opponent Rear-Guard retirement history this turn and a five-distinct-Quintuplet-names Memory threshold to select between +5000 and +10000. Neither the distinct-name threshold nor this conditional continuous amount is implemented for this scope.",
  "cfa-11527:0": "This placement requires an exact Vanguard name, Counter Blast 1, and moving a Quintuplet from Drop to Deck bottom as cost before retiring an opposing Rear-Guard; it then optionally draws at a five-distinct-name Memory threshold. The filtered cost, post-cost target, and conditional draw are not an authorized sequence.",
  "cfa-11528:0": "The source must be the exact booster in a battle where its controller's Vanguard has Critical 2 or greater, then pay Counter Blast 1 and draw. The current ability condition model does not validate this Vanguard Critical threshold with the boost-source event.",
  "cfa-11529:0": "This exact card is discarded from hand during Battle Phase, moves from Drop to Soul, then retires an opponent's back-row Rear-Guard. The discard-phase event and ordered source movement/filtered retirement do not have a reviewed combined handler.",
  "cfa-11530:0": "The AUTO triggers from this source entering either RC or GC and pays by returning two cards originally in the Ride Deck from Soul or Drop to the Ride Deck face up; the resolution then branches by circle into draw or shield. Ride Deck provenance and the two destination-specific branches are unsupported.",
  "cfa-11531:0": "This CONT both restricts rides to Quintuplet cards and treats the Order Zone as Memory. The authoritative ride legality and card-zone interpretation paths do not support these two continuous rule changes.",
  "cfa-11531:1": "This CONT replaces a would-be move of any non-Quintuplet card into Memory with a move to Drop. The state engine has no reviewed replacement effect that intercepts arbitrary Memory-bound moves by card identity.",
  "cfa-11531:2": "This once-per-turn ACT reveals a number of cards equal to Vanguard grade, selects a Quintuplet for Memory, orders the remainder on Deck bottom, and can instead call a same-name Unit if Memory already contains that name. Variable reveal count and the conditional alternate destination are unsupported.",
  "cfa-11533:0": "This hand-placement AUTO pays Soul Blast 1, reveals seven cards, checks that every revealed non-EC19 Normal Unit name is unique, then optionally searches an EC19 other than the exact source name and adds it. The all-revealed distinct-name test and filtered search are not trusted handlers.",
  "cfa-11534:0": "This once-per-turn AUTO reacts only when an EC19 unit's ability reveals the top card during this controller's turn, then offers this source +6000. The event system does not carry the required revealing ability identity and reveal provenance for a safe prompt.",
  "cfa-11534:1": "The prior Vanguard must ride this exact source; then reveal seven cards, check unique names among non-EC19 Normal Units, call this source to RC, and shuffle. The combined ride trigger and distinct-name-gated top-seven source call are unsupported.",
  "cfa-11535:0": "After hand placement, the ability checks seven revealed cards for distinct non-EC19 Normal Unit names, grants this source a temporary once-per-turn Vanguard-attack restand AUTO shared by same-name copies, and shuffles. Nested temporary abilities and shared usage limits are not implemented.",
  "cfa-11536:0": "This once-per-turn ACT checks four distinct-name units, pays Counter Blast 1 plus a hand discard, reveals seven cards, checks another distinct-name condition, and grants a chosen Force, Accel, or Protect gift. The distinct-name checks and three-way gift choice are not supported as one legal action.",
  "cfa-11536:1": "This Vanguard's own attack gains +10000 only if four or more of its controller's field units have different card names. The continuous/attack context has no reviewed distinct-name field count condition.",
  "cfa-11537:0": "The placement AUTO discards the top two Deck cards as cost before granting this source +2000 for the turn. The cost system does not expose an authorized top-two Deck discard payment with atomic failure behavior.",
  "cfa-11539:0": "The official text confirms the ride trigger and draw-then-discard order, but the existing draw/discard operation is authorized only for other exact trigger families. There is no server-reviewed ride-trigger definition for this card."
});

const officialReferences = Object.freeze([
  Object.freeze({ cardId: "cfa-11516", cardNumber: "D-BT12/019EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT12%2F019EN" }),
  Object.freeze({ cardId: "cfa-11517", cardNumber: "D-BT12/031EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT12%2F031EN" }),
  Object.freeze({ cardId: "cfa-11518", cardNumber: "D-BT12/011EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT12%2F011EN" }),
  Object.freeze({ cardId: "cfa-11529", cardNumber: "D-BT12/017EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT12%2F017EN" }),
  Object.freeze({ cardId: "cfa-11530", cardNumber: "D-BT12/003EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT12%2F003EN" }),
  Object.freeze({ cardId: "cfa-11539", cardNumber: "D-SS07/003EN", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-SS07%2F003EN" })
]);

const verifiedOfficialAbilities = Object.freeze([
  "cfa-11516:0", "cfa-11516:1", "cfa-11517:0", "cfa-11518:0", "cfa-11518:1",
  "cfa-11529:0", "cfa-11530:0", "cfa-11539:0"
].map(abilityId => Object.freeze({
  abilityId,
  officialReference: officialReferences.find(reference => reference.cardId === abilityId.slice(0, abilityId.lastIndexOf(":")))?.url,
  status: "Catalog ability text checked against the linked Bushiroad card-list entry."
})));

const catalog = loadCatalog();
const byCard = new Map(catalog.map(card => [String(card.id), card]));
const assignment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "ability-work-batches.json"), "utf8"))
  .batches.find(batch => batch.batchId === batchId);
if (!assignment) throw new Error(`Assignment ${batchId} is missing from the registry.`);
if (JSON.stringify([...assignment.abilityIds].sort()) !== JSON.stringify([...auditedAbilityIds].sort())) {
  throw new Error(`Contribution ability IDs differ from the reserved ${batchId} assignment.`);
}

const supportedSet = new Set(alreadySupportedAbilityIds);
const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition) throw new Error(`Expected existing production definition missing: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    catalogSource: card.source || "unknown"
  });
}));

const unsupportedAbilities = Object.freeze(auditedAbilityIds.filter(abilityId => !supportedSet.has(abilityId)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = byCard.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing exact catalog ability or blocker: ${abilityId}`);
  const official = verifiedOfficialAbilities.find(item => item.abilityId === abilityId);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    catalogSource: card.source || "unknown",
    officialReference: official?.officialReference || null,
    blocker: blockerById[abilityId]
  });
}));

Object.defineProperty(definitions, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId,
    auditedAbilityIds,
    alreadySupportedAbilityIds,
    supportedDefinitions,
    proposedDefinitions: Object.freeze([]),
    unsupportedAbilities,
    verifiedOfficialAbilities,
    officialReferences
  })
});

module.exports = definitions;
