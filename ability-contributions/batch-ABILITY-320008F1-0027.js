"use strict";

// Batch review only. Existing definitions are documented; no unreviewed card
// text is converted into a production ability by this file.
const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const Reducer = require("../ability-server-reducer.js");
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");
const fs = require("node:fs");
const path = require("node:path");

const batchId = "ABILITY-320008F1-0027";
const workerOwner = "worker-0027-review";
const abilityIds = Object.freeze([
  "cfa-10715:0", "cfa-10716:0", "cfa-10717:0", "cfa-10717:1", "cfa-10718:0",
  "cfa-10719:0", "cfa-10720:0", "cfa-10721:0", "cfa-10721:1", "cfa-10723:0",
  "cfa-10723:1", "cfa-10724:0", "cfa-10724:1", "cfa-10725:0", "cfa-10725:1",
  "cfa-10726:0", "cfa-10727:0", "cfa-10728:0", "cfa-10729:0", "cfa-1072:0",
  "cfa-1072:1", "cfa-10730:0", "cfa-10730:1", "cfa-10731:0", "cfa-10732:0",
  "cfa-10733:0", "cfa-10733:1", "cfa-10734:0", "cfa-10735:0", "cfa-10736:0",
  "cfa-10736:1", "cfa-10737:0", "cfa-10737:1", "cfa-10738:0", "cfa-10739:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-10717:0", "cfa-1072:0", "cfa-1072:1", "cfa-10730:0"
]);
const proposedDefinitions = Object.freeze([]);

const officialReviews = Object.freeze([
  Object.freeze({
    abilityId: "cfa-1072:0",
    officialPrintedText: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.",
    officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=27&sort=no&view=text"
  }),
  Object.freeze({
    abilityId: "cfa-1072:1",
    officialPrintedText: "[AUTO](RC):When this unit attacks a vanguard, if you have a <Narukami> vanguard, this unit gets [Power] +2000 until end of that battle.",
    officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=27&sort=no&view=text"
  }),
  Object.freeze({
    abilityId: "cfa-10717:0",
    officialPrintedText: "[AUTO]:When this unit is placed on (RC), [COST][Counter-Blast 1], choose one of your (RC) without any Dragontree markers, and put a Dragontree marker.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2FFFR09EN"
  }),
  Object.freeze({
    abilityId: "cfa-10717:1",
    officialPrintedText: "[AUTO](RC)[1/turn]:When a set order you played from hand is put into the order zone, [COST][Counter-Blast 1], look at the top five cards of your deck, choose up to one unit card with a grade less than or equal to your vanguard from among them, call it to a (RC) in the same column as this unit, and shuffle your deck.",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT09%2FFFR09EN"
  }),
  Object.freeze({
    abilityId: "cfa-10730:0",
    officialPrintedText: "[AUTO]:When this unit is placed on (RC), [COST][Counter-Blast 1], choose one of your (RC) without any Dragontree markers, and put a Dragontree marker.",
    officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=201&sort=no&view=text"
  }),
  Object.freeze({
    abilityId: "cfa-10730:1",
    officialPrintedText: "[ACT](RC)[1/turn]:If your vanguard is grade 3 or greater, [COST][Soul-Blast 2], choose a grade 1 or less card from your soul, and call it to a (RC) in the same column as this unit.",
    officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=201&sort=no&view=text"
  })
]);

const blockerById = Object.freeze({
  "cfa-10715:0": "This AUTO depends on the live Final Burst state, a Soul Blast 2 cost, Counter Charge, and a temporary power gain. The authoritative event stream does not yet expose a reviewed Final Burst transition tied to this source ability, so the resource and power sequence cannot be safely authorized.",
  "cfa-10716:0": "This effect triggers from this exact card being revealed during a drive check, then may move it from the trigger zone to an open Rear-Guard Circle and grant Boost. The resolver lacks a reviewed reveal-origin check combined with optional calling and temporary keyword grants.",
  "cfa-10717:1": "This once-per-turn AUTO requires a Set Order played from hand to enter the Order Zone, then Counter-Blast 1, inspect five cards, select a unit no higher than the Vanguard's grade, call it to the source's column, and shuffle. The exact originating order event and filtered same-column sequence are not yet authoritative.",
  "cfa-10718:0": "This ACT requires Persona Ride history, Soul Blast 1 and a hand discard, then grants power and retrieves two Set Orders from Drop whose names must differ. The engine does not yet validate Persona Ride state and resolve that two-target distinct-name sequence atomically.",
  "cfa-10719:0": "This AUTO listens for a single Soul Blast of four or more by a Vanguard ability and checks whether any unit stood by an ability this turn. If it stands this source, an end-of-turn delayed cost retires it and retrieves a grade-2-or-higher unit from Soul. Cost-event provenance, stand history, and the delayed effect are missing.",
  "cfa-10720:0": "This once-per-turn own-attack AUTO pays Counter-Blast 1 and retires a Plant token before granting power. The server does not yet validate a Plant-token instance as the cost target together with this attacker's usage record.",
  "cfa-10721:0": "This Vanguard AUTO must react only when a Critical Trigger is Soul-Blasted for this Vanguard's own ability, then choose a unit for power. Current cost events do not securely connect the exact trigger card and paying ability to this later AUTO.",
  "cfa-10721:1": "This Vanguard attack pays Soul Blast 3, binds only Critical Triggers among the cards paid, then conditionally retires, adds critical, and adds drive at separate count thresholds. The engine lacks the typed-cost subset and ordered threshold program needed to resolve it.",
  "cfa-10723:0": "This AUTO requires this exact card to be ridden by Almajestar, Turan=Dyna, then Soul Charges two cards and draws only if a Critical Trigger was among those cards. The ride event and exact identity/type of the resulting Soul Charge cards are not modeled together.",
  "cfa-10723:1": "This once-per-turn ACT requires the opponent's Vanguard to be grade 3 or greater, binds a Trigger Unit from Soul, and grants this source power. The exact Soul target filter and bind-cost payment are not currently an approved server effect program for this card.",
  "cfa-10724:0": "This ride AUTO must match a unit with Astroea in its name, select the named Almajestar from Soul, and call both the selected Soul card and this just-ridden card. The current ride resolution does not support this paired source-and-target call sequence.",
  "cfa-10724:1": "This once-per-turn ACT requires an Almajestar Vanguard, Counter-Blast 1, and exactly two Trigger Units from Drop to Soul before granting power. The ordered cost, two-card type-filtered selection, and follow-up movement are not yet validated as one transaction.",
  "cfa-10725:0": "This placement AUTO is conditional on an Almajestar Vanguard and moves two Trigger Units selected from Drop to Soul. No reviewed handler currently enforces the named-Vanguard condition with the exact two-card Drop filter and source placement event.",
  "cfa-10725:1": "This continuous ability changes both power and shield in RC and GC based on a Critical Trigger in Bind, including on the opponent's turn. The continuous evaluator does not yet apply both zone-specific modifiers from the same dynamic bind-zone predicate.",
  "cfa-10726:0": "This continuous effect prevents all Rear-Guards from being hit when the controller's Vanguard was not attacked that turn. The engine does not yet track that full-turn attack history and apply the resulting hit-prevention rule during guard resolution.",
  "cfa-10727:0": "This placement AUTO pays Soul Blast 2 and retrieves a grade-2 Strategy card from Drop. The reviewed server effects do not yet support the exact Strategy card-type and grade filter for this source event.",
  "cfa-10728:0": "This source must actually boost, pay Soul Blast 1, and grant the boosted unit a temporary attack-hit AUTO that retires an opposing Rear-Guard. Nested granted abilities linked to that exact boosted battle are not modeled by a trusted program.",
  "cfa-10729:0": "This once-per-turn ACT mirrors a trigger-recovery sequence: require an Almajestar Vanguard, Counter-Blast 1, move two Trigger Units from Drop to Soul, then gain power. The exact two-target filter and atomic zone/cost resolution are not yet supported.",
  "cfa-10730:1": "This once-per-turn ACT requires a grade-3-or-higher Vanguard, Soul Blast 2, and a grade-1-or-lower Soul card called to an open Rear-Guard Circle in this source's column. The exact grade filter and same-column target legality are not covered by an approved definition.",
  "cfa-10731:0": "This ACT depends on Persona Ride history, then lets both players move a combined total of up to three Rear-Guards to their owners' Souls and scales this source's power by the number selected. Opponent decisions, owner-based movement, and count-dependent power require a missing simultaneous-choice resolver.",
  "cfa-10732:0": "This AUTO requires this exact unit to be placed on RC by another card's ability, then Soul Blast 2, Counter Charge, and gain power. Placement events do not yet carry trusted causative-effect identity sufficient to distinguish an ability call from other placement.",
  "cfa-10733:0": "This Vanguard continuous ability scales power by the number of Dragontree markers on Rear-Guard Circles and adds critical at three or more. Current continuous evaluation does not provide a reviewed marker-count calculation plus a critical modifier for this Vanguard.",
  "cfa-10733:1": "This once-per-turn attack effect may remove a face-up Calamity from the Ride Deck or reveal and fully activate an Over Trigger from that zone, remove it, and stand only rear-guards on marked circles. Ride-Deck origin, Over Trigger additional-effect execution, and filtered simultaneous stands are unsupported.",
  "cfa-10734:0": "This AUTO requires the exact booster to boost with an Almajestar Vanguard, may move one Trigger Unit from hand or Drop to Soul, and draws only for the hand branch. The resolver lacks this private hand/drop choice and branch-dependent draw tied to the exact boost event.",
  "cfa-10735:0": "This Rear-Guard continuous effect grants power during its controller's turn if Bind contains at least two Trigger Units. The continuous evaluator does not yet count typed cards in Bind as this effect's condition.",
  "cfa-10736:0": "This Vanguard gains power for each differently named Calamity in Soul. The current state evaluator does not track the Ride-Deck-origin Calamity subtype and count distinct names for a dynamic Vanguard modifier.",
  "cfa-10736:1": "This main-phase AUTO moves a Calamity from Ride Deck to Soul, pays by returning three Ride-Deck-origin Calamities face-up, searches hand or deck for Griphogila and rides it, then conditionally shuffles and places two Dragontree markers. Origin metadata, sequential ride choices, deck shuffle, and marker placements are not supported as one authoritative effect.",
  "cfa-10737:0": "This AUTO requires this exact Rear-Guard to be moved to Soul by a Greedon Vanguard ability, then optionally retires an opponent Rear-Guard. The move event does not yet preserve the causative ability instance needed to distinguish this Soul movement from other effects.",
  "cfa-10737:1": "This Soul AUTO triggers on the Greedon Vanguard's attack, binds this exact Soul card, and imposes a two-or-more simultaneous hand-call restriction for the rest of that battle. Cost provenance and enforcement of the guard-call minimum are not implemented together.",
  "cfa-10738:0": "This AUTO requires this exact Rear-Guard to enter Soul through a Greedon ability, then optionally grants a Vanguard power while reducing its drive. The causal move event, optional target choice, and temporary drive modifier need a reviewed transactional handler.",
  "cfa-10739:0": "This Rear-Guard gains battle power only on its own attack while a unit is in X-overDress state. The engine does not yet expose a rules-backed X-overDress status predicate tied to the exact attacking source."
});

const root = path.resolve(__dirname, "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "ability-work-batches.json"), "utf8"));
const queuedAbilityCounts = new Map();
for (const batch of registry.batches) for (const id of batch.abilityIds) queuedAbilityCounts.set(id, (queuedAbilityCounts.get(id) || 0) + 1);
const untrackedAbilityIds = abilityIds.filter(id => queuedAbilityCounts.get(id) !== 1);
if (untrackedAbilityIds.length) throw new Error("Audit abilities are absent or duplicated in the current queue: " + untrackedAbilityIds.join(", "));

const catalog = loadCatalog(root);
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const supportedSet = new Set(alreadySupportedAbilityIds);
const officialById = new Map(officialReviews.map(item => [item.abilityId, item]));
const unsupportedSiblings = Object.freeze(abilityIds.filter(id => !supportedSet.has(id)).map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability || ability.definition || !blockerById[abilityId]) {
    throw new Error("Expected exact unsupported catalog ability and concrete blocker: " + abilityId);
  }
  const official = officialById.get(abilityId);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null,
    blocker: blockerById[abilityId]
  });
}));

const supportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const card = cardsById.get(cardId);
  const ability = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  if (!ability?.definition || !Reducer.supportsServerAbilityEffects(ability)) {
    throw new Error("Expected production definition and authoritative server support: " + abilityId);
  }
  const official = officialById.get(abilityId);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    printedText: ability.printedText,
    definitionSource: ability.definition.source?.patternId || "compiled keyword definition",
    serverHandlerSupported: true,
    officialPrintedText: official?.officialPrintedText || null,
    officialReference: official?.officialReference || null
  });
}));

module.exports = Object.freeze({
  batchId,
  workerOwner,
  abilityIds,
  alreadySupportedAbilityIds,
  supportedDefinitions,
  proposedDefinitions,
  unsupportedSiblings,
  verifiedOfficialAbilities: officialReviews
});
