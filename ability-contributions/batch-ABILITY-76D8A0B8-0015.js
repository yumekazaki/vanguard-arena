"use strict";

const Engine = require("../ability-engine.js");
Engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("../scripts/audit-ability-catalog.js");

// One exact GC CONT uses existing continuous-shield semantics. The other
// assigned abilities remain blocked until their exact timing/choice/effect
// requirements are supported by the authoritative resolver.
const contribution = [
  {
    id: "cfa-11261:1",
    cardId: "cfa-11261",
    kind: "CONT",
    printedText: 'CONT [GC]: If you have a grade 4 vanguard with "Bruce" in its card name, this unit gets shield +10000.',
    requiredLocation: ["guardian"],
    conditionsReviewed: true,
    source: {
      dataset: "Bushiroad official card list",
      cardNumber: "DZ-SS01/Re10EN",
      officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe10EN",
      patternId: "cont-gc-grade-named-vanguard-shield-v1",
      review: "Exact Guardian Circle CONT from Impediment Slicer. It gives only this guarding card +10000 shield while its controller has a grade 4 Vanguard whose card name contains Bruce. The condition does not apply on RC or VC."
    },
    effects: [
      {
        op: "continuous-shield",
        target: "source",
        amount: 10000,
        duration: "continuous",
        condition: {
          op: "all",
          conditions: [
            { op: "controller-vanguard-grade-at-least", grade: 4 },
            { op: "controller-vanguard-card-name-contains", name: "Bruce" }
          ]
        }
      }
    ]
  }
];

const abilityIds = Object.freeze([
  "cfa-11261:0", "cfa-11261:1", "cfa-11262:0", "cfa-11263:0", "cfa-11264:0", "cfa-11264:1",
  "cfa-11265:0", "cfa-11265:1", "cfa-11266:0", "cfa-11267:0", "cfa-11268:0", "cfa-11269:0",
  "cfa-11270:0", "cfa-11271:0", "cfa-11272:0", "cfa-11273:0", "cfa-11273:1", "cfa-11274:0",
  "cfa-11274:1", "cfa-11275:0", "cfa-11275:1", "cfa-11275:2", "cfa-11276:0", "cfa-11276:1",
  "cfa-11277:0", "cfa-11277:1", "cfa-11278:0", "cfa-11278:1", "cfa-11279:0", "cfa-1127:0",
  "cfa-11280:0", "cfa-11281:0", "cfa-11282:0", "cfa-11282:1", "cfa-11283:0", "cfa-11283:1",
  "cfa-11283:2", "cfa-1128:0"
]);

const alreadySupportedAbilityIds = Object.freeze([
  "cfa-11264:1", "cfa-11275:0", "cfa-11278:0", "cfa-1127:0"
]);

const officialCardRefs = Object.freeze({
  "cfa-11261": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe10EN",
  "cfa-11262": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe15EN",
  "cfa-11263": "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F275EN",
  "cfa-11264": "https://en.cf-vanguard.com/cardlist/?cardno=V-PR%2F0278EN",
  "cfa-11265": "https://en.cf-vanguard.com/cardlist/?cardno=V-PR%2F0279EN",
  "cfa-11266": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11267": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11268": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11269": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11270": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11271": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11272": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11273": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11274": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11275": "https://en.cf-vanguard.com/cardlist/?cardno=D-TB04%2F004EN",
  "cfa-11276": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11277": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11278": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-11279": "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=221&sort=no&view=text",
  "cfa-1127": "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F056EN",
  "cfa-11280": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe03EN",
  "cfa-11281": "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F418EN",
  "cfa-11282": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe41EN",
  "cfa-11283": "https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS01%2FRe30EN",
  "cfa-1128": "https://en.cf-vanguard.com/cardlist/?cardno=D-VS02%2F017EN&expansion=174"
});

const officialTextCheckedIds = Object.freeze([
  "cfa-11261:1", "cfa-11264:1", "cfa-11275:0", "cfa-11278:0", "cfa-1127:0",
  "cfa-11283:2", "cfa-1128:0"
]);

const blockerById = Object.freeze({
  "cfa-11261:0": "The RC ACT requires a Bruce Vanguard, an opponent grade threshold, Counter Blast, a grade-4 named search across deck/soul/drop, a ride, and returning this exact source to deck. The current trusted resolver has no complete multi-zone named ride plus source-return operation.",
  "cfa-11262:0": "The RC ACT combines a Seraph grade/name gate, no-ride-this-turn restriction, source retirement, deck/hand/drop grade-4 search and ride, opponent-selected Drop imprisonment, and a temporary alteration to the ridden card's AUTO cost. Search/ride plus the opponent choice and granted cost change are unsupported as one validated program.",
  "cfa-11263:0": "The ACT pays Counter Blast and moves this exact source to Soul, then chooses a matching grade-4 Bastion from hand and rides it. The authoritative effect program does not implement this source-to-Soul cost followed by a hand-target ride choice.",
  "cfa-11264:0": "The once-per-turn boosted own-attack AUTO needs a top-three choice, adding one card to hand, then independently ordering any remaining cards onto top or bottom. The resolver has no matching two-pile ordered-deck choice for this effect.",
  "cfa-11265:0": "The boosted attack AUTO pays Counter Blast and calls a differently named Drop card. No current trusted handler enforces this exact different-name target filter and call.",
  "cfa-11265:1": "A reusable compiled ride-phase search definition exists, but the official V-PR/0279EN entry could not be retrieved or independently confirmed. Keep it unverified until its exact printed text is checked against a primary Bushiroad listing.",
  "cfa-11266:0": "The source gains +5000 only through the opponent's next turn after its own RC attack and a Vanguard grade gate. Current power expiry values do not model this exact opponent-next-turn duration safely.",
  "cfa-11267:0": "This exact hand-to-RC placement trigger must require a different discard from hand and then Counter Charge. The current trusted server ability path does not match this exact placement-plus-discard cost sequence.",
  "cfa-11268:0": "The continuous power counts each other Rear-Guard whose name contains any one of three printed fragments. No existing continuous evaluator supports this three-fragment, unique-instance count.",
  "cfa-11269:0": "The GC AUTO compares both current Vanguard grades, Counter Charges, and grants battle-scoped shield to its exact guardian. The current shield modifier is CONT-only and does not implement this comparison-trigger sequence.",
  "cfa-11270:0": "This Front Row RC AUTO runs at the beginning of the controller's Main Phase and requires a particular Crest before turn power. The existing timing and condition schema does not safely encode this exact front-row-plus-crest gate.",
  "cfa-11271:0": "The own-attack power trigger has an OR condition: the exact source was boosted by a specified race, or its controller has the named Crest. The engine does not model both branches with exact booster-instance identity for this definition.",
  "cfa-11272:0": "The exact boost trigger pays Soul Blast, offers a top-card top/bottom choice, then conditionally boosts the source only when it boosted the specified race. The resolver cannot safely branch the second effect on the exact boost subject after that choice.",
  "cfa-11273:0": "This ACT is manually usable from Drop, checks opponent Vanguard grade, pays Counter Blast, and calls its own source to RC. The current manual activation flow does not support this exact Drop-zone source action.",
  "cfa-11273:1": "The trigger requires this exact card to enter RC specifically from deck or Drop, then grants turn power. Current placement trigger matching does not provide this verified pair of allowed source zones for the exact card.",
  "cfa-11274:0": "The placement AUTO needs the exact source placed on RC from hand, then a mandatory choice to put the exact deck-top card on top or bottom. The reorder handler exists, but the authoritative server allowlist currently rejects this ability pattern.",
  "cfa-11274:1": "This own-attack AUTO has an opponent-grade gate and Soul Blast cost, grants battle power, then at the same battle's close draws and retires the exact source. The delayed battle-close continuation is not supported for this exact sequence.",
  "cfa-11275:1": "The once-per-turn VC ACT pays Counter Blast, retires a chosen opposing Rear-Guard, and scales power by the opponent's open back-row circles. Dynamic circle-count power after a selected retirement is unsupported.",
  "cfa-11275:2": "The Vanguard attack has an alternative Persona Ride cost, a same-name card-to-Soul move from RC or hand, top-seven up-to-two calling based on Soul, and shuffle. The exact alternate-cost and dependent multi-select sequence is unsupported.",
  "cfa-11276:0": "This Back Row RC CONT grants power only to front-row units in the same column during its controller's turn. The continuous evaluator has no exact same-column recipient operation.",
  "cfa-11276:1": "This placement AUTO gates on Vanguard grade, pays Counter Blast plus a hand discard, then searches for a card matching the current Vanguard's exact name. No current trusted handler validates this exact combined cost and dynamic same-name search.",
  "cfa-11277:0": "The trigger requires the exact source to be discarded from the deck during its controller's turn, checks a named Crest, then offers call-or-hand placement. Current discard events and effect choices do not represent this source-zone-specific origin and destination choice safely.",
  "cfa-11277:1": "The trigger is correctly tied to this source's own attack, but when no friendly Jiroutachi-name target exists the reducer still queues it and resolution rejects the missing target, leaving a stuck pending prompt. Shared target-preflight/no-target handling is required before this can be enabled.",
  "cfa-11278:1": "The placement AUTO pays Soul Blast plus a hand discard, then searches the deck for a name-fragment match and reveals/adds it. Existing search handlers do not support this exact fragment filter with both costs.",
  "cfa-11279:0": "The source's own Vanguard attack checks all of its controller's units are rested, grants battle power, and conditionally retires an opposing front-row Rear-Guard if a Crest is present. The combined field-state condition and optional target effect are unsupported.",
  "cfa-11280:0": "The own-attack AUTO has a named Vanguard gate, battle power, then a separate end-of-battle cost and opponent retirement; only if no card was retired does it draw and bind from Drop. This conditional nested resolution is not supported.",
  "cfa-11281:0": "At the end of this source's attack, the effect must retrieve a card previously scouted to Base, then move a Base from hand or Drop to Order rested. Scouted-card identity and this multi-zone sequential choice are not represented by trusted handlers.",
  "cfa-11282:0": "This CONT combines Order-zone count, opponent-effect targeting resistance, and power on either player's turn. The continuous evaluator does not implement conditional resist plus power from the same exact source.",
  "cfa-11282:1": "The trigger watches a placement by any player from this controller's Order Zone during either player's Main Phase, then pays Soul Blast and draws once per turn. Event ownership/controller attribution for this cross-player Order-zone case is not supported.",
  "cfa-11283:0": "This CONT changes the card's name while it is in the Deck. The existing card-name alias evaluator only applies in supported field locations, not Deck search/ride semantics.",
  "cfa-11283:1": "At end of turn this Vanguard selects a Petralka-name card from Soul and rides it as Rest. The resolver lacks a trusted end-phase choice and ride-from-Soul operation.",
  "cfa-11283:2": "The existing compiled definition is textually wrong: Bushiroad says the Vanguard name fragment is \"Petralka\", while the compiled definition requires \"Relation Weaver, Petralka\". It must not be treated as supported until corrected and cross-tested.",
  "cfa-1128:0": "The local catalog text does not match Bushiroad's D-VS02/017EN entry. The official card has a rode-upon top-card effect plus two effects for placement from Deck (Soul Blast/Counter Charge, then optional Soul Blast/draw); the local text instead gives an on-Deck-placement Liberator-gated draw. This is a catalog mismatch, not a safe handler match."
});

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

const existingSupportedDefinitions = Object.freeze(alreadySupportedAbilityIds.map(abilityId => {
  const record = recordsById.get(abilityId);
  if (!record?.ability.definition) throw new Error(`Expected existing supported definition is missing: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: record.card.name,
    kind: record.ability.kind,
    catalogPrintedText: record.ability.printedText,
    officialReference: officialCardRefs[record.card.id],
    implementationStatus: "already-supported-and-official-text-checked",
    definition: record.ability.definition
  });
}));

const unsupportedAbilityIds = Object.freeze(abilityIds.filter(id => !alreadySupportedAbilityIds.includes(id) && id !== "cfa-11261:1"));
const unsupportedAbilities = Object.freeze(unsupportedAbilityIds.map(abilityId => {
  const record = recordsById.get(abilityId);
  if (!record || !blockerById[abilityId]) throw new Error(`Missing exact ability record or concrete blocker: ${abilityId}`);
  return Object.freeze({
    abilityId,
    cardName: record.card.name,
    kind: record.ability.kind,
    catalogPrintedText: record.ability.printedText,
    officialReference: officialCardRefs[record.card.id] || null,
    officialTextIndependentlyChecked: officialTextCheckedIds.includes(abilityId),
    currentCompiledDefinition: Boolean(record.ability.definition),
    blocker: blockerById[abilityId]
  });
}));

const audit = Object.freeze({
  batchId: "ABILITY-76D8A0B8-0015",
  status: "one-new-exact-definition-plus-four-existing-supported",
  dataset: "Cardfight Area local catalog snapshot",
  catalogSnapshotDate: "2025-05-09",
  assignedAbilityCount: abilityIds.length,
  abilityIds,
  uniqueCardInstanceCount: cardIds.length,
  newlyImplementedCount: 1,
  newlyImplementedAbilityIds: Object.freeze(["cfa-11261:1"]),
  alreadySupportedAbilityIds,
  alreadySupportedDefinitions: existingSupportedDefinitions,
  unsupportedAbilityIds,
  unsupportedAbilities,
  officialTextCheckedIds,
  officialRulesReferences: Object.freeze([
    "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf"
  ]),
  provenanceNote: "Every catalogPrintedText value is parsed from the exact assigned card/ability ID. Bushiroad's official card listing directly confirms the newly proposed Impediment Slicer CONT and the four already-supported definitions. Official text was also checked for the noted Josephus mismatch and Lysette mismatch; other blockers carry source links where available but are not claimed as independently card-text-verified. No unsupported ability is exported as a runtime definition."
});

Object.defineProperty(contribution, "audit", { enumerable: false, value: audit });
Object.defineProperty(contribution, "unsupportedAbilities", { enumerable: false, value: unsupportedAbilities });

module.exports = contribution;
