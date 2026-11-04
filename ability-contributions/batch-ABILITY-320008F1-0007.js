"use strict";

const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

// Audit-only contribution. No new runtime ability definitions are emitted.
const contribution = [];
const abilityIds = Object.freeze([
  "cfa-10165:0", "cfa-10165:1", "cfa-10166:0", "cfa-10166:1", "cfa-10167:0",
  "cfa-10168:0", "cfa-10170:0", "cfa-10171:0", "cfa-10172:0", "cfa-10172:1",
  "cfa-10173:0", "cfa-10173:1", "cfa-10174:0", "cfa-10175:0", "cfa-1017:0",
  "cfa-1017:1", "cfa-10181:0", "cfa-10181:1", "cfa-10182:0", "cfa-10183:0",
  "cfa-10184:0", "cfa-10185:0", "cfa-10186:0", "cfa-10186:1", "cfa-10187:0",
  "cfa-10188:0", "cfa-10189:0", "cfa-10189:1", "cfa-1018:0", "cfa-1018:1",
  "cfa-10190:0", "cfa-10191:0", "cfa-10191:1", "cfa-10196:0", "cfa-10196:1",
  "cfa-1019:0", "cfa-1019:1"
]);

const blockerById = Object.freeze({
  "cfa-10165:0": "This CONT depends on the source's X-overDress state, the controller's turn, and the opponent Vanguard's grade before applying two conditional power increases. X-overDress state and its nested condition tree are not represented by a trusted continuous effect.",
  "cfa-10165:1": "This once-per-turn on-hit AUTO requires the exact source to hit a Vanguard while in X-overDress state, then Soul Blasts 1 and retires every opposing Rear-Guard in a chosen column. The engine does not model X-overDress and column-filtered multi-target retirement together.",
  "cfa-10166:0": "This attack AUTO scales battle power by the current number of World cards in the controller's Order Zone. There is no trusted World-count battle modifier, and the World order identity/count must be checked at the correct timing.",
  "cfa-10166:1": "This AUTO triggers when the exact source is retired from RC, checks the controller's World state, and optionally creates a Shadow Army token on RC. The named World-state predicate and token-creation handler are not both trusted.",
  "cfa-10167:0": "This attack AUTO adds power for every other unit on the controller's field. The exact other-unit count must be evaluated at attack timing and bound to this source; no trusted scalable battle modifier covers this text.",
  "cfa-10168:0": "This CONT grants Boost only after the controller has played a Normal Order that turn. The engine does not retain and validate the required turn-history flag for a continuous keyword grant.",
  "cfa-10170:0": "This AUTO requires an originalDress event and a relationship to the exact outerDress unit, then pays Counter Blast 1 and grants that outerDress +10000. The game state does not currently link originalDress and outerDress instances for a trusted target choice.",
  "cfa-10171:0": "This AUTO triggers when this card's exact outerDress is retired from RC or GC, pays Soul Blast 2, and calls this source to an open RC. The linked-dress identity and retirement zone must be retained; a generic retire event is not sufficient.",
  "cfa-10172:0": "This AUTO requires the source to be placed on RC specifically by X-overDress, then retrieves a different X-overDress ability card from Drop to hand. Placement-cause provenance and the X-overDress ability filter are not represented by a trusted resolver.",
  "cfa-10172:1": "This CONT requires X-overDress state and grants both cannot-be-chosen protection and power/shield on RC and GC, including the opponent's turn. The source state, targeting restriction, and dual-circle modifiers are not a single supported continuous program.",
  "cfa-10173:0": "This hand-to-RC AUTO checks for a Grade 3 or greater Vanguard, pays Counter Blast 1, and chooses a Grade 3 or less card in Drop to call. Although each primitive exists elsewhere, this exact filtered Drop call has no trusted production definition or target revalidation.",
  "cfa-10173:1": "This CONT counts Grade 1 or less Rear-Guards specifically in the controller's back row during their turn before giving the source +5000. No trusted continuous evaluator handles that row-and-grade count.",
  "cfa-10175:0": "This AUTO triggers only when the exact source's attack hits a Vanguard, then chooses up to one Grade 2 or greater Unit from Drop and moves it to hand. A filtered up-to-one Drop-to-hand effect bound to this hit is not implemented by a trusted definition.",
  "cfa-10181:0": "This once-per-turn Vanguard ACT pays Counter Blast 1, draws, then requires a choice between calling a hand card to RC and discarding a hand card. The ordered draw followed by a server-validated call-or-discard branch is not supported for this source.",
  "cfa-10181:1": "This AUTO must perform the exact Vanguard's multi-unit boost with all eligible standing back-row units, count actual boosters, conditionally add drive, and stand two back-row Rear-Guards at battle end after Soul Blast 1 and a discard. This nested battle sequence has no trusted effect program.",
  "cfa-10184:0": "This boost AUTO pays Soul Blast 2 and grants a chosen Vanguard a temporary attack-hit AUTO that Counter Charges. The engine does not create, bind, and expire a nested ability on the exact chosen Vanguard.",
  "cfa-10185:0": "This attack AUTO counts other Friends at two thresholds, conditionally grants battle power, then may return a different-column Friend Rear-Guard to hand. Friend identity, count timing, and the optional column-filtered return are unsupported together.",
  "cfa-10189:0": "This CONT requires at least two Arms in the controller's VC before granting the source +5000 during their turn. The current trusted continuous conditions do not count Arms on the Vanguard Circle.",
  "cfa-10189:1": "This Drop AUTO requires another unit to be called from Drop to RC and the exact Bavsargra Vanguard, then pays Counter Blast 1 to call this source. The movement event, named Vanguard filter, and source-to-RC effect are not combined by a trusted definition.",
  "cfa-1018:1": "This Vanguard-placement AUTO optionally pays Counter Blast 2 and calls a Pale Moon from Soul. Production ride/placement handlers do not implement this exact optional CB2 and clan-filtered Soul call sequence.",
  "cfa-10190:0": "This boost AUTO pays Soul Blast 1, moves an opponent's Grade 2 or greater Rear-Guard that is not being attacked to GC, and only if that move is illegal gives the source +5000. The engine lacks the opponent-target, not-being-attacked validation and conditional fallback as one atomic resolution.",
  "cfa-1019:0": "This Limit Break ACT requires four damage, Counter Blast 1, and discarding another copy by exact name; it then Soul Charges 2 and may call a Pale Moon from Soul with +3000. The full cost and ordered, filtered ACT sequence is not trusted."
});

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":")) ))]
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Batch card missing from local catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name, cardNumber: card.cardNumber || null, grade: Number(card.grade), clan: card.clan || (card.clans || []).join(" / ") || null });
}));
const parsedById = new Map();
for (const cardId of cardIds) {
  for (const ability of Engine.parseCardAbilitiesCached(cardsById.get(cardId))) parsedById.set(ability.id, ability);
}

const supportedDefinitions = Object.freeze(abilityIds.filter(id => parsedById.get(id)?.definition).map(abilityId => {
  const ability = parsedById.get(abilityId);
  return Object.freeze({
    abilityId,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    patternId: ability.definition.source?.patternId || null,
    implementationStatus: "already-supported-in-production",
    definition: ability.definition
  });
}));
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !parsedById.get(id)?.definition).map(abilityId => {
  const ability = parsedById.get(abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed ability or concrete blocker: ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, blocker: blockerById[abilityId] });
}));

const audit = Object.freeze({
  batchId: "ABILITY-320008F1-0007",
  status: "audit-only-no-new-definitions",
  dataset: "Cardfight Area local card catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  officialTextChecked: false,
  abilityIds,
  implementedAbilityIds: Object.freeze([]),
  alreadySupportedAbilityIds: Object.freeze(supportedDefinitions.map(item => item.abilityId)),
  supportedDefinitions,
  cards,
  unsupportedSiblings,
  proposedDefinitions: Object.freeze([]),
  provenanceNote: "Catalog text is preserved exactly from the local snapshot. No new runtime definitions are emitted. Existing trusted definitions retain their production status; 22 uncompiled abilities each have a specific missing mechanic and remain unavailable. No whole card is marked complete."
});

Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });
module.exports = contribution;
