"use strict";

const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

// Batch audit only: the six existing definitions stay in the production
// registry, while all unimplemented entries remain unavailable.
const contribution = [];
const abilityIds = Object.freeze([
  "cfa-10201:0", "cfa-10201:1", "cfa-10206:0", "cfa-10206:1", "cfa-1020:0",
  "cfa-10214:0", "cfa-10215:0", "cfa-10216:0", "cfa-10218:0", "cfa-1021:0",
  "cfa-1021:1", "cfa-10220:0", "cfa-10221:0", "cfa-10222:0", "cfa-10223:0",
  "cfa-10224:0", "cfa-10224:1", "cfa-10226:0", "cfa-10227:0", "cfa-10228:0",
  "cfa-10228:1", "cfa-1022:0", "cfa-10230:0", "cfa-10230:1", "cfa-10231:0",
  "cfa-10232:0", "cfa-10234:0", "cfa-10235:0", "cfa-10236:0", "cfa-1023:0",
  "cfa-102:0"
]);

const blockerById = Object.freeze({
  "cfa-102:0": "This attack AUTO requires the exact first battle of the turn, Aqua Force Vanguard, a battle power increase, then an optional same-column Aqua Force Rear-Guard position swap at close step. The reducer does not retain and validate the required turn battle count and delayed column exchange together.",
  "cfa-1021:1": "This optional End Phase AUTO must trigger when a different friendly Great Nature Rear-Guard is retired from RC, pay Counter Blast 1 and move this source to Soul, then return that exact retired card to hand. The exact source, retired target, End Phase event, and ordered cost are not supported as one trusted effect.",
  "cfa-1022:0": "This optional Guardian Circle AUTO requires the exact source to be placed on GC, a Great Nature Vanguard, Counter Blast 1, and +5000 shield for that battle. The existing shield handlers do not validate this card's printed clan condition and payment as a trusted exact ability.",
  "cfa-1023:0": "This End Phase AUTO requires this exact source to move from RC to Drop, a Great Nature Vanguard, Counter Blast 1, then an optional named Vocal Chicken deck search, call to open RC, and shuffle. The source-retirement and filtered search-call sequence is not covered by a trusted definition.",
  "cfa-10214:0": "This CONT needs a live Friend marker on another unit in this source's column, where Friend state is established by a separate CONT, then +5000 only during the controller's turn. The game state does not model Friend associations or their continuous power evaluation.",
  "cfa-10215:0": "This boost AUTO pays Soul Blast 1 and scales this exact booster by +2000 for each other Friend through that battle. The source-boost event is recognized, but Friend association identity and counted battle power are not implemented together.",
  "cfa-10216:0": "This once-per-turn ACT pays Soul Blast 1 and gives a chosen friendly Vanguard +5000, but the card also has a separate Powerful AUTO with empty-Soul, named Grade 3 Vanguard, Counter Blast, +10000, and drive-check conditions. Its two abilities require independent structured definitions and separate resolution handlers.",
  "cfa-10218:0": "This ACT pays Soul Blast 1 to privately inspect the top card of the deck and restore it to its original position after confirmation. The current effect system does not provide a private, non-moving look operation with the required confirmation flow.",
  "cfa-10220:0": "This attack AUTO depends on the Vanguard's exact Soul Blast 4 cost having occurred earlier this turn, then pays a hand-to-Soul cost, draws, and retires an opponent Rear-Guard. The engine lacks the shared-resource history gate and complete ordered hand-cost/draw/retire program.",
  "cfa-10221:0": "This both-turn CONT grants Boost and +5000 only if the controller's Soul contains a card of Grade 3 or greater. The trusted continuous condition evaluator has no exact any-grade-in-Soul predicate paired with a temporary keyword grant.",
  "cfa-10222:0": "This boost AUTO depends on a prior Vanguard ability Soul Blasting at least four simultaneously this turn, pays Counter Blast 1, and privately partitions the top two cards between hand and Soul. The shared-cost event history and ordered up-to-one selection are not supported together.",
  "cfa-10223:0": "This own-attack AUTO requires a Magnolia Vanguard and scales +5000 battle power for each pair of friendly Grade 2+ units. If this effect grants at least +10000, it creates a battle-end bind-self cost followed by Counter Charge and Soul Charge; the thresholded delayed sequence is unsupported.",
  "cfa-10224:0": "This placement AUTO can trigger from Deck or hand but not other zones, checks for a Sylvan Horned Beast Vanguard, pays Soul Blast 1, and performs a private top-five Magnolia search with reveal and shuffle. The multi-origin exact placement and filtered search are not modeled by a trusted handler.",
  "cfa-10224:1": "This Vanguard-name CONT changes how Persona Ride applies power to back-row units. The game does not represent this source's continuous replacement of Persona Ride's target scope or validate the named Grade 3 Vanguard condition.",
  "cfa-10226:0": "This ride AUTO requires the exact source to be ridden by a Grade 2 Kyouka, then prompts a Grade 1-3 declaration and searches the top five for either that Grade's Unit or a Magazine card. The exact rider filter and private branched selection are unsupported.",
  "cfa-10227:0": "This ride AUTO first offers a Magazine from Drop; only if none is selected or available does it pay Counter Blast 1 and search the deck. The conditional fallback, Magazine filter, and ride-event source identity are not represented by a trusted sequential effect.",
  "cfa-10228:0": "This once-per-turn Vanguard ACT pays Soul Blast 1, declares a Grade, and privately searches the top five for either a Unit of that Grade to call or a Magazine to reveal and add. The branched target search and call/hand resolution are unsupported.",
  "cfa-10228:1": "This Vanguard CONT grants +5000 to every front-row unit during the controller's turn only if a Magazine Order was played this turn. The engine does not track Magazine-specific order history or this multi-unit continuous modifier.",
  "cfa-10230:0": "This CONT grants the source +5000 during its controller's turn if a Magazine Order was played that turn. The required Magazine-specific play history is not represented by a trusted continuous condition.",
  "cfa-10230:1": "This once-per-turn AUTO triggers at the close of a battle where the controller's Grade 3+ Vanguard attacked, checks that a Magazine Order was played, pays Counter Blast 1 and Soul Blast 1, and stands this source. Exact Vanguard-battle identity, order history, delayed timing, and cost are not modeled together.",
  "cfa-10231:0": "This ACT retires the exact source as cost, selects a Lyrical ShootingStarS card from Drop, and returns it to hand. The name-filtered clanless Drop-to-hand operation is not registered as a trusted server effect.",
  "cfa-10232:0": "This ACT checks a Grade 3+ Kyouka Vanguard, moves this source to Soul as cost, then puts a Grade 2+ Unit with a different name from that Vanguard from Drop on deck top. The combined name/grade filter and ordered source movement are unsupported.",
  "cfa-10234:0": "This ride AUTO offers a Grade 2-or-less Normal Unit from hand, calls it, grants +2000 and a nested end-of-battle draw-and-deck-bottom AUTO through turn end. Temporary nested ability creation, its later exact attack, and expiry are not supported.",
  "cfa-10235:0": "This ride AUTO pays Soul Blast 1, optionally calls a Grade 3-or-less card from hand, then draws only if a card was called. The ride-specific source, broad card filter, legal RC choice, and dependent draw condition need a trusted sequential definition.",
  "cfa-10236:0": "This once-per-turn Vanguard ACT pays Counter Blast 1 and grants up to five normal Rear-Guards a temporary +2000 and nested end-of-battle draw/deck-bottom AUTO; choosing three or more also grants this Vanguard +10000. Multi-target, nested temporary abilities and the count-gated Vanguard effect are unsupported."
});

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Batch card missing from local catalog: ${cardId}`);
  return Object.freeze({ cardId, name: card.name, grade: Number(card.grade), type: card.type || null, clan: card.clan || (card.clans || []).join(" / "), catalogSource: card.source || "Cardfight Area snapshot 2025-05-09" });
}));
const parsedById = new Map();
for (const cardId of cardIds) for (const ability of Engine.parseCardAbilitiesCached(cardsById.get(cardId))) parsedById.set(ability.id, ability);
const supportedDefinitions = Object.freeze(abilityIds.filter(id => parsedById.get(id)?.definition).map(abilityId => {
  const ability = parsedById.get(abilityId);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, patternId: ability.definition.source?.patternId || null, implementationStatus: "already-supported-in-production", definition: ability.definition });
}));
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !parsedById.get(id)?.definition).map(abilityId => {
  const ability = parsedById.get(abilityId);
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed text or concrete blocker for ${abilityId}`);
  return Object.freeze({ abilityId, kind: ability.kind, catalogPrintedText: ability.printedText, officialPrintedText: null, blocker: blockerById[abilityId] });
}));
const audit = Object.freeze({
  batchId: "ABILITY-320008F1-0008",
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
  provenanceNote: "Ability text is copied exactly from the local Cardfight Area catalog snapshot dated 2025-05-09. This audit adds no runtime definitions and does not claim official-text verification. Six pre-existing production definitions are retained; every unsupported ability has a specific implementation blocker, and no whole card is marked complete."
});

Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });
module.exports = contribution;
