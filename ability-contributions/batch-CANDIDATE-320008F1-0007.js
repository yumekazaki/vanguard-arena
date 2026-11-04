"use strict";

const CARDS = Object.freeze([
  {
    cardId: "cfa-11825",
    name: "Sylvan Horned Beast King of Calamity, Magnolia Masques",
    setCode: "D-BT12",
    cardNumber: "D-BT12/013EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=212&sort=no&view=text",
    requiredName: "Magnolia"
  },
  {
    cardId: "cfa-13490",
    name: "Great Sage of Scheol, Solrairon Masques",
    setCode: "DZ-BT06",
    cardNumber: "DZ-BT06/014EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2F014EN&expansion=234&view=image",
    requiredName: "Solrairon"
  },
  {
    cardId: "cfa-13625",
    name: "Scarlet Flame Ash Dragon, Gandeeva Masques",
    setCode: "DZ-BT06",
    cardNumber: "DZ-BT06/002EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT06%2F002EN&expansion=234&view=image",
    requiredName: "Gandeeva"
  },
  {
    cardId: "cfa-9718",
    name: "Super Bushin, Tao Ren",
    setCode: "D-TB03",
    cardNumber: "D-TB03/005EN",
    officialReference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=192&sort=no&view=text",
    requiredName: "Tao Ren"
  }
]);

const SOURCE_PATTERN = "cont-ride-from-grade-and-named-vanguard-v1";
const definitions = CARDS.map(card => ({
  id: `${card.cardId}:0`,
  cardId: card.cardId,
  kind: "CONT",
  printedText: `CONT: This card can only be ridden from a grade 3 card with \"${card.requiredName}\" in its card name.`,
  conditionsReviewed: true,
  choicesReviewed: true,
  continuousRestrictions: [{
    type: "ride-from-grade-and-name",
    grade: 3,
    name: card.requiredName
  }],
  source: {
    dataset: "Bushiroad official card list",
    snapshotDate: "2026-11-01",
    setCode: card.setCode,
    officialCardNumber: card.cardNumber,
    officialReference: card.officialReference,
    patternId: SOURCE_PATTERN,
    review: `Exact CONT wording on ${card.cardNumber}. This card is a legal ride candidate only when its controller's current Vanguard is exactly grade 3 and its card name contains the printed fragment \"${card.requiredName}\". Rechecked for every normal or Ride Deck ride; this is a continuous ride restriction and does not create a prompt.`
  }
}));

const UNSUPPORTED_SIBLINGS = Object.freeze([
  { abilityId: "cfa-11825:1", blocker: "CONT grants all matching Dragontree-marked Rear-Guards back-row attack permission plus power; per-target attack legality and continuous target modifiers are not represented by a reviewed shared handler." },
  { abilityId: "cfa-11825:2", blocker: "ACT removes a differently named Magnolia from Hand, Soul, or Drop, then grants a nested temporary AUTO that triggers on any own back-row Rear-Guard attack and retires an opponent Rear-Guard; dynamic granted-ability identity and resolution are unsupported." },
  { abilityId: "cfa-13490:1", blocker: "ACT combines Energy Blast 3, revealing a Normal Unit from hand, draw, and putting that exact revealed card on top of the deck; the combined reveal-cost and exact-card sequence has no reviewed handler." },
  { abilityId: "cfa-13490:2", blocker: "ACT removes a differently named Solrairon from Hand, Soul, or Drop, declares Normal or Trigger, reveals the deck top, then conditionally grants a temporary AUTO that changes drive for units placed by this Vanguard; choice, reveal, provenance, and nested drive resolution are unsupported." },
  { abilityId: "cfa-13490:3", blocker: "AUTO on this Vanguard's attack uses Counter Blast, top-three selection capped by Dragontree-marker count, multiple calls, and ordering remaining cards on top or bottom; no reviewed sequential selection/order handler covers this exact program." },
  { abilityId: "cfa-13625:1", blocker: "AUTO refers to an opponent Rear-Guard retired during the controller's turn, then optionally binds a chosen card from the controller's Drop face down; exact opponent-retirement event matching and Drop-to-Bind choice resolution are not validated for this text." },
  { abilityId: "cfa-13625:2", blocker: "CONT grants power to all front-row units for each face-down card in the controller's Bind Zone; a reviewed all-front-row continuous modifier counting face-down Bind cards is missing." },
  { abilityId: "cfa-13625:3", blocker: "ACT removes a differently named Gandeeva from Hand, Soul, or Drop, selects one of its original ACT abilities for free activation, and adds Critical; selecting and resolving another card's original ability is unsupported." },
  { abilityId: "cfa-13625:4", blocker: "ACT pays Soul Blast 1 and chooses an opponent Rear-Guard to retire, drawing only if no card was retired; the conditional no-retirement branch needs exact target and effect-result handling not established for this card." },
  { abilityId: "cfa-9718:1", blocker: "Catalog parser yields one combined ability block for a VC-placement search AUTO and an OverSoul ACT with a named Rear-Guard-to-Soul cost, three opponent Rear-Guard retirements, and power per five Drop cards; splitting and resolving the two printed abilities requires parser and handler work outside this isolated contribution." }
]);

Object.defineProperties(definitions, {
  batchId: { value: "CANDIDATE-320008F1-0007", enumerable: false },
  unsupportedSiblings: { value: UNSUPPORTED_SIBLINGS, enumerable: false }
});

module.exports = definitions;
