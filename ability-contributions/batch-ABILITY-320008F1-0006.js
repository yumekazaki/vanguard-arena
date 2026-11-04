"use strict";

const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

// This file records the assigned-card audit without adding runtime definitions.
const contribution = [];
const abilityIds = Object.freeze([
  "cfa-10140:0", "cfa-10140:1", "cfa-10141:0", "cfa-10143:0", "cfa-10144:0",
  "cfa-10145:0", "cfa-10146:0", "cfa-10147:0", "cfa-10147:1", "cfa-10148:0",
  "cfa-10148:1", "cfa-1014:0", "cfa-1014:1", "cfa-10150:0", "cfa-10150:1",
  "cfa-10151:0", "cfa-10152:0", "cfa-10153:0", "cfa-10154:0", "cfa-10155:0",
  "cfa-10156:0", "cfa-10157:0", "cfa-10157:1", "cfa-10159:0", "cfa-10159:1",
  "cfa-1015:0", "cfa-10160:0", "cfa-10160:1", "cfa-10161:0", "cfa-10161:1",
  "cfa-10162:0", "cfa-10163:0", "cfa-10164:0", "cfa-1016:0"
]);

const blockerById = Object.freeze({
  "cfa-10140:0": "This AUTO must correlate the exact Vanguard placement to the RevolDress ability, check the opponent Vanguard's live grade is at least 3, pay a hand discard, and grant this source +10000 power and +1 drive through turn end. No trusted handler validates that complete cause, opponent-side condition, cost, and paired power/drive modifier.",
  "cfa-10141:0": "This CONT applies only during the battle this exact Rear-Guard attacked, only if its controller's Vanguard was ridden by a card effect this turn, and forbids the opponent from calling normal units from hand to GC. The reducer has no trusted attack-scoped call restriction for this condition.",
  "cfa-10143:0": "This AUTO requires this exact Rear-Guard to attack while boosted, then gives that source +5000 until turn end. Existing attack and boost handlers do not combine the same-battle boosted-source check with a turn-duration source modifier.",
  "cfa-10144:0": "This AUTO requires this exact unit to enter RC from Soul while the controller is in Final Rush, then Soul Charges two for each two cards currently in that controller's Damage Zone. There is no trusted event handler for this Soul-origin placement and damage-scaled Soul Charge amount.",
  "cfa-10145:0": "This AUTO requires placement on RC from hand and at least two normal units whose names contain Blaze Maiden, then pays Soul Blast 1, searches for Trickstar or Trickmoon, discards the selected result, and shuffles. No trusted handler validates this whole filtered-cost/search/discard sequence.",
  "cfa-10146:0": "This AUTO requires RC placement while the controller has a Sorceress Vanguard, then looks at exactly the top two cards, reorders them, and Soul Charges one. The engine does not have this top-two ordering followed by Soul Charge as one trusted effect program.",
  "cfa-10147:0": "This AUTO requires RC placement and a Grade 3+ Sorceress Vanguard, pays Counter Blast 1, privately chooses zero to two of the top two cards for hand, orders the remainder on deck, and if both were taken puts a hand card on deck bottom. That conditional multi-step choice sequence is not supported by a trusted definition.",
  "cfa-10147:1": "This AUTO requires this exact Rear-Guard's attack and the controller having persona ridden this turn, then gives the source +5000 until turn end. The trusted attack handlers do not validate the persona-ride history condition with a turn-duration modifier.",
  "cfa-10148:0": "This CONT requires the controller's turn and at least ten cards in that controller's Soul before granting this RC source +10000. Existing Soul-count checks do not provide a trusted continuous power definition for this exact threshold condition.",
  "cfa-10148:1": "This once-per-turn RC ACT pays Counter Blast 1 to increase each later Soul Charge by the controller's card ability by one through turn end. The effect engine has no turn-scoped replacement that changes future Soul Charge amounts.",
  "cfa-1014:1": "This RC ACT pays Counter Blast 1 and moves this exact source into Soul, then looks at up to ten cards from deck for up to one Pale Moon card to put into Soul and shuffles. No trusted ACT handler combines this source cost with filtered look-ten-to-Soul resolution.",
  "cfa-10150:0": "This AUTO triggers when this specific Order enters the Order Zone, searches for a card whose name contains Radylina, reveals and adds it, then shuffles. Existing Order-zone handlers do not implement this named deck search.",
  "cfa-10150:1": "This Order-zone CONT requires the controller's turn and a Rorowa Vanguard, then grants +5000 to every controlled back-row token unit. The authoritative token and Order continuous-effect path does not support this filtered multi-unit power modifier.",
  "cfa-10151:0": "This AUTO must recognize the exact boost, another friendly Grade 1-or-less Rear-Guard, and a Grade 3+ Vanguard target; it grants +2000 to the booster for that battle, then conditionally pays Counter Blast 1 and Soul Blast 1 to draw. The combined boost conditions and sequential optional cost/effect are not represented by one trusted handler.",
  "cfa-10152:0": "This CONT requires the controller's turn and at least three friendly Grade 1-or-less Rear-Guards before granting this RC source +5000. No trusted continuous handler counts this grade-filtered field condition.",
  "cfa-10153:0": "This AUTO triggers only when this RC source boosts while its controller has a Lianorn Vanguard, then prevents the opponent from intercepting for that battle. The reducer has no trusted temporary intercept prohibition tied to a validated boost event.",
  "cfa-10154:0": "This AUTO requires this exact source to attack and scales its battle power by the number of other friendly Rear-Guards with different grades. The engine has no trusted effect that counts and compares the other Rear-Guard grades for this attack.",
  "cfa-10155:0": "This once-per-turn RC ACT requires a persona ride this turn, pays Counter Blast 1, then grants this source +10000 until turn end. The existing ACT source-power handler has no validated persona-ride condition or matching exact template.",
  "cfa-10156:0": "This AUTO triggers only when this exact source's attack hits the opponent Vanguard, offers a draw, and only if the draw occurs requires choosing a hand card to move into Soul. Existing hit-and-draw handlers do not implement the conditional draw-then-move-to-Soul sequence.",
  "cfa-10157:0": "This AUTO requires this exact card to move from RC to Soul by the ability of the named Greedon and requires that no Counter Charge occurred earlier this turn. Event provenance and the once-this-turn Counter Charge history are not jointly validated by a trusted handler.",
  "cfa-10157:1": "This Soul AUTO reacts to a friendly Rear-Guard placement by an ability, then checks the exact Greedon Vanguard and at least four damage before giving that newly called unit +5000 until turn end. No trusted handler binds the placement event subject to all of these current controller conditions.",
  "cfa-10159:0": "This AUTO requires being ridden by the exact Reiyu card, then searches the controller's deck for Trickstar, calls it to RC, and shuffles. Existing ride-trigger handlers do not implement this exact rider-identity plus deck-search-and-call sequence.",
  "cfa-10159:1": "This CONT requires a Prayer Dragon in the same column as this Rear-Guard during its controller's turn before granting +5000. No trusted continuous handler checks another friendly unit's race and column together.",
  "cfa-1015:0": "The existing Soul-Blast named-boost handler covers the cost, named boosted unit, and battle modifier family, but the compiled/server-validated template requires 'until end of that battle' and its exact card-ID allowlist omits cfa-1015. This printed 'until end of battle' record therefore remains untrusted until the template and allowlist explicitly accept it.",
  "cfa-10160:0": "This AUTO requires being ridden by the exact Nirvana Jheva card, then looks at the top seven cards, chooses up to one Prayer Dragon, reveals/adds it, and shuffles. No trusted ride-trigger handler performs this exact rider check and filtered top-seven search.",
  "cfa-10160:1": "This CONT requires a Prayer Dragon in the same column as this Rear-Guard during its controller's turn before granting +5000. No trusted continuous handler checks another friendly unit's race and column together.",
  "cfa-10161:0": "This once-per-turn VC ACT discards a hand card, then chooses up to one Trickstar and one Prayer Dragon from Drop and calls them to RC. The engine does not validate the two independently filtered Drop targets and call sequence in one trusted ACT.",
  "cfa-10161:1": "This AUTO requires this exact Vanguard to attack, pays Counter Blast 1, and stands a chosen friendly Rear-Guard in X-overDress state. The stand handler does not recognize and validate X-overDress state for the target.",
  "cfa-10162:0": "This AUTO requires an originalDress event and a target linked as this card's outerDress, then grants +5000 and grants an additional +5000 only for Garou Vairina. The game state and trusted effects do not preserve originalDress/outerDress identity for this conditional modifier.",
  "cfa-10163:0": "This CONT requires this unit's X-overDress state for +10000 power and imposes a battle-scoped minimum-two simultaneous hand-call rule on the opponent, active on either turn. The state model and guardian legality path do not support this X-overDress condition and call-count restriction.",
  "cfa-10164:0": "This AUTO triggers when the card becomes an originalDress, pays Counter Blast 1, draws two, then discards a hand card. Although draw-then-discard exists for other triggers, no trusted handler recognizes originalDress as this exact source event.",
  "cfa-1016:0": "This AUTO requires the boosted Vanguard's drive check to reveal a Grade 3 Pale Moon, then grants this source a temporary nested AUTO. At the end of that boost battle the source may move itself to Soul and call a different-named Pale Moon from Soul. Nested temporary abilities, exact drive-check provenance, and the delayed choice are unsupported together."
});

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = [...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cards = Object.freeze(cardIds.map(cardId => {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Batch card missing from local catalog: ${cardId}`);
  return Object.freeze({
    cardId,
    name: card.name,
    grade: Number(card.grade),
    type: card.type || null,
    clan: card.clan || (card.clans || []).join(" / "),
    catalogSource: card.source || "Cardfight Area snapshot 2025-05-09"
  });
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
  if (!ability || !blockerById[abilityId]) throw new Error(`Missing parsed text or blocker for ${abilityId}`);
  return Object.freeze({
    abilityId,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    officialPrintedText: null,
    blocker: blockerById[abilityId]
  });
}));

const audit = Object.freeze({
  batchId: "ABILITY-320008F1-0006",
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
  provenanceNote: "Ability text is copied exactly from the local Cardfight Area catalog snapshot dated 2025-05-09. Official text was not independently verified. Full structured records for the two already-compiled production definitions are included above; no new runtime definitions are emitted. Unsupported sibling abilities each retain a concrete blocker and remain unavailable."
});

Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedSiblings", { enumerable: false, value: unsupportedSiblings });

module.exports = contribution;
