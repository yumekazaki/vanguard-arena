"use strict";

const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

// This batch audit contributes no new runtime definitions. Eight of its exact
// blocks already have trusted production definitions; the remaining blocks
// stay unavailable until their listed mechanics have supported handlers.
const contribution = [];

const abilityIds = Object.freeze([
  "cfa-11212:0", "cfa-11212:1", "cfa-11213:0", "cfa-11213:1", "cfa-11214:0", "cfa-11214:1",
  "cfa-11215:0", "cfa-11215:1", "cfa-11216:0", "cfa-11216:1", "cfa-11218:0", "cfa-11219:0",
  "cfa-11220:0", "cfa-11221:0", "cfa-11222:0", "cfa-11223:0", "cfa-11224:0", "cfa-11225:0",
  "cfa-11225:1", "cfa-11226:0", "cfa-11226:1", "cfa-11226:2", "cfa-11227:0", "cfa-11227:1",
  "cfa-1122:0", "cfa-11230:0", "cfa-11232:0", "cfa-11232:1", "cfa-11233:0", "cfa-11233:1",
  "cfa-11234:0", "cfa-11234:1", "cfa-11235:0", "cfa-11236:0", "cfa-11236:1", "cfa-11237:0",
  "cfa-11238:0", "cfa-1123:0"
]);

const blockerById = Object.freeze({
  "cfa-11212:0": "The placement AUTO requires an exact RC placement, a grade-3-or-greater Vanguard condition, Counter Blast 1, a deck search using a card-name substring, a call, and a shuffle. The trusted named-search call handler only accepts its supported exact filters; it does not validate this substring search as printed.",
  "cfa-11212:1": "The Shinken Hissatsu AUTO needs the three-damage activation condition, another Rear-Guard entering the same column from a non-hand zone, a Vanguard name matching either of two alternatives, and power on that exact entering unit. The current trigger schema does not encode the placement origin plus same-column subject and the condition's name alternatives together.",
  "cfa-11213:1": "The Crest transforms every same-name unit into a Grade 3, 13000-power unit, removes original characteristics and abilities, grants Twin Drive and Persona Ride, and adds two distinct AUTO abilities. The engine has no continuous transformation or granted-ability replacement mechanism for this exact package.",
  "cfa-11214:1": "The Crest transformation is not implemented. Its added VC attack ability also forbids grade-1-or-greater calls from hand to GC for a battle, while its opponent-turn CONT grants resist to all friendly Rear-Guards; neither effect is available through a trusted transformation/grant or guardian-restriction handler.",
  "cfa-11215:1": "The Crest transformation is not implemented. Its transformed VC attack adds a Counter-Blast stand/power AUTO, and its once-per-turn Rear-Guard defense ability pays Soul Blast to prevent hit Rear-Guards from retiring. The current engine cannot grant those abilities or model the shared battle-scoped no-retire protection and usage record.",
  "cfa-11216:1": "The Crest transformation is not implemented. The gained effects require a battle-phase-start power change for all Rear-Guards and a once-per-turn attacked-Vanguard ability that reveals the deck top, adds it to hand, and applies that card's original shield value. The current transformation and dynamic shield-value resolution paths are missing.",
  "cfa-11218:0": "The source must be boosted by a unit with the specific Wakizashi race, may gain battle power, and then cannot stand in its next stand phase. Although the trigger can represent the booster race, the trusted effect system has no delayed next-stand-phase prohibition/status with correct expiry.",
  "cfa-11219:0": "The source must boost a unit of the specific Uchigatana race, pay Soul Blast 2, choose a Drop card to move into Damage, and then heal a Damage card if that movement occurred. The boost event does not expose a trusted boosted-unit race gate for this ability, and no exact supported sequence validates both zone moves and the conditional heal.",
  "cfa-11220:0": "The source gets battle power only when it boosts a unit with the specific Uchigatana race. Current boost trigger compilation cannot enforce the boosted unit's race for this printed pattern, so a generic boost trigger would activate illegally on unrelated units.",
  "cfa-11221:0": "The once-per-turn RC ACT pays Soul Blast 2 and selects from Drop by a name substring while excluding one exact name, then calls and powers the source. Existing Drop-call handlers do not support this paired substring/exclusion filter with the required target validation.",
  "cfa-11222:0": "This AUTO triggers only when a drive check reveals a trigger unit, then pays Soul Blast 1 and retires a chosen opposing front-row Rear-Guard. The current trigger compiler does not model the revealed-card trigger-unit predicate for this drive-check event together with the front-row opponent target restriction.",
  "cfa-11223:0": "The placement AUTO pays Counter Blast 2, looks at seven cards, selects up to two by a name substring, reveals and adds them, shuffles, and Counter Charges only when one or fewer were revealed. The trusted effect program lacks this filtered multi-select search with a result-count-dependent resource effect.",
  "cfa-11224:0": "The hand-to-RC placement AUTO checks Vanguard grade, pays Counter Blast 1, and lets the player order selected top cards and the remaining bottom cards independently. The engine lacks the ordered two-pile deck rearrangement choice and resolution.",
  "cfa-11225:0": "The source boost AUTO pays Soul Blast 1, chooses a Vanguard and powers it, then conditionally powers this booster for the battle only if the chosen Vanguard name contains Iwatooshi. The effect schema cannot branch on the name of the selected target while keeping the two effects on their distinct targets and durations.",
  "cfa-11225:1": "This Shinken Hissatsu trigger is the exact end of the battle this source boosted, then retires this source as cost and Counter Charges. The existing battle-close source-to-Soul handler does not model this source-retire cost or Shinken Hissatsu gate for this trigger.",
  "cfa-11226:1": "The Vanguard attack AUTO has a conditional alternative cost after Persona Ride: Counter Blast 1 may replace moving a same-name card from RC or hand to Soul. The current cost engine does not support this zone-spanning alternative cost with Persona Ride history and same-name validation before the power/drive increase.",
  "cfa-11226:2": "This VC CONT restricts the opponent's guard declaration during this unit's battle, but only with two qualifying Grade 3 Kasen-name cards in Soul. The authoritative guard flow cannot enforce a minimum of three simultaneous hand calls from a state-dependent continuous condition.",
  "cfa-11227:0": "The AUTO is on this Rear-Guard but checks the controller's Vanguard's current power is at least 23000 before modifying the source. The available source-power threshold condition evaluates the ability source, not a different card's live power.",
  "cfa-11227:1": "The trigger is another exact Vanguard attacking with a specified name, grade, and live power threshold, then this source pays Soul Blast 1 and stands. Current attack matching does not validate the attacking subject's live power and named Vanguard conditions for this source-owned ability.",
  "cfa-11232:0": "This Rear-Guard watches a Grade 3-or-greater unit in the center column attack, checks the controller's Vanguard name, and powers that exact attacking unit. The trigger model does not expose a center-column attack subject with its own identity and grade for this cross-source effect.",
  "cfa-11232:1": "This Front Row source's own attack requires a Gramgrace Vanguard and at least two center-column attacks earlier this turn before Counter Blast 1 and battle power. Existing attack-count state does not track the printed center-column subset.",
  "cfa-11233:0": "The exact source's battle-close trigger is limited to an attack against a Vanguard and a Favrneel Vanguard; it then moves this source to Soul and retires a chosen opposing Rear-Guard. No trusted handler combines the source's own attack-close event, exact target zone, source-to-Soul cost, and opponent retirement choice.",
  "cfa-11233:1": "This Soul AUTO triggers at the controller's Ride Phase, checks Favrneel, binds the source and discards a hand card, activates Persona Ride, and prohibits other effect Persona Rides and riding for the turn. The engine lacks this Soul-zone phase trigger plus the combined costs and turn-scoped restrictions.",
  "cfa-11234:0": "On RC placement with an Orfist Vanguard, this AUTO pays Soul Blast 1 and chooses a World in Drop whose name is not already represented in Order, then moves it to Order. The current handlers lack both the not-already-in-zone filter and this filtered Drop-to-Order movement.",
  "cfa-11234:1": "The AUTO must see this card move from RC or hand to Drop during Battle Phase and check the current World state is either Dark Night or Abyssal Dark Night before offering a draw. The movement event does not have this reviewed pair of source-zone alternatives and World-state condition in a supported optional effect.",
  "cfa-11235:0": "Shinken Hissatsu enables this only at three or more damage; the exact source must attack unboosted, then receives +10000 or +15000 depending on whether any Damage card is face up. The engine lacks the unboosted-source event and the face-up-damage conditional amount branch as one validated ability.",
  "cfa-11236:0": "This boost AUTO requires a named ally on the field, chooses a Grade 2-or-less Drop card, moves it to Soul, and grants this exact booster battle power. The effect system lacks the complete name-presence condition and grade-filtered Drop-to-Soul target/move operation.",
  "cfa-11236:1": "The Back Row source reacts to another named Ookurikara unit attacking unboosted and grants power to that exact attacker. The current event and trigger schema cannot reliably enforce both the other-instance name match and the no-booster condition while targeting the attacker.",
  "cfa-11237:0": "This placement AUTO discards a hand card, searches the top five for a unit whose name contains Shokudaikiri Mitsutada, calls it, shuffles, and draws only if no card was called. The existing top-five effects do not support this exact substring-filtered call plus the conditional fallback draw.",
  "cfa-11238:0": "This placement AUTO pays Counter Blast 1, selects exactly two Trigger units from Drop, puts both into Soul, then powers the source. The trusted target/effect handlers do not support a two-card trigger-type-filtered Drop selection with a multi-card Soul move."
});

const officialCardRefs = Object.freeze({
  "cfa-11212": "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F014EN",
  "cfa-11213": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.51.pdf",
  "cfa-11214": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.51.pdf",
  "cfa-11215": "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F092EN",
  "cfa-11216": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.51.pdf",
  "cfa-11218": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11219": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11220": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11221": "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F023EN",
  "cfa-11222": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11223": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11224": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11225": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11226": "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F003EN",
  "cfa-11227": "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F009EN",
  "cfa-11230": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11232": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS06%2F007EN",
  "cfa-11233": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=210&sort=no&view=text",
  "cfa-11234": "https://en.cf-vanguard.com/cardlist/?cardno=D-SS08%2F008EN",
  "cfa-11235": "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F029EN",
  "cfa-11236": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11237": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11238": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-1122": null,
  "cfa-1123": "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F055EN"
});

const officialTextCheckedIds = Object.freeze([
  "cfa-11212:0", "cfa-11212:1", "cfa-11221:0", "cfa-11226:0", "cfa-11226:1", "cfa-11226:2",
  "cfa-11227:0", "cfa-11227:1", "cfa-11232:0", "cfa-11232:1", "cfa-11233:0", "cfa-11233:1",
  "cfa-11234:0", "cfa-11234:1", "cfa-11235:0"
]);

const catalog = loadCatalog();
const cardsById = new Map(catalog.map(card => [String(card.id), card]));
const cardIds = Object.freeze([...new Set(abilityIds.map(id => id.slice(0, id.lastIndexOf(":"))))]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
const recordsById = new Map();
for (const cardId of cardIds) {
  const card = cardsById.get(cardId);
  if (!card) throw new Error(`Assigned catalog card is missing: ${cardId}`);
  for (const ability of Engine.parseCardAbilitiesCached(card)) recordsById.set(ability.id, { card, ability });
}

const supportedDefinitions = Object.freeze(abilityIds.filter(id => recordsById.get(id)?.ability.definition).map(abilityId => {
  const { card, ability } = recordsById.get(abilityId);
  return Object.freeze({
    abilityId,
    cardName: card.name,
    kind: ability.kind,
    catalogPrintedText: ability.printedText,
    patternId: ability.definition.source?.patternId || null,
    implementationStatus: "already-supported-in-production",
    definition: ability.definition
  });
}));

const unsupportedAbilities = Object.freeze(abilityIds.filter(id => !recordsById.get(id)?.ability.definition).map(abilityId => {
  const record = recordsById.get(abilityId);
  if (!record || !blockerById[abilityId]) throw new Error(`Missing ability record or concrete blocker: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: record.card.name,
    kind: record.ability.kind,
    catalogPrintedText: record.ability.printedText,
    officialReference: officialCardRefs[record.card.id] || null,
    officialTextIndependentlyChecked: officialTextCheckedIds.includes(abilityId),
    blocker: blockerById[abilityId]
  });
}));

const audit = Object.freeze({
  batchId: "ABILITY-76D8A0B8-0013",
  status: "audit-only-no-new-definitions",
  dataset: "Cardfight Area local catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  assignedAbilityCount: abilityIds.length,
  abilityIds,
  uniqueCardInstanceCount: cardIds.length,
  newlyImplementedCount: 0,
  alreadySupportedAbilityIds: Object.freeze(supportedDefinitions.map(record => record.abilityId)),
  alreadySupportedDefinitions: supportedDefinitions,
  unsupportedAbilityIds: Object.freeze(unsupportedAbilities.map(record => record.abilityId)),
  unsupportedAbilities,
  officialTextCheckedIds,
  officialRulesReferences: Object.freeze([
    "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.51.pdf"
  ]),
  provenanceNote: "Every printedText field is taken verbatim from the local catalog and retains its stable card/ability ID. Official Bushiroad card listings and the official comprehensive-rules PDF were consulted for the listed cross-checked abilities; the audit does not claim official cross-check for IDs outside officialTextCheckedIds. No unsupported ability is emitted as a runtime definition."
});

Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedAbilities", { enumerable: false, value: unsupportedAbilities });

module.exports = contribution;
