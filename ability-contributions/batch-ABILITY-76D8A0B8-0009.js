"use strict";

// Ability-level audit only. It adds no production definitions and makes no
// whole-card verification claims. One currently compiled alias is listed as a
// blocker because the catalog alias differs from Bushiroad's printed text.
const contribution = [];

Object.defineProperty(contribution, "audit", {
  enumerable: false,
  value: Object.freeze({
    batchId: "ABILITY-76D8A0B8-0009",
    counts: Object.freeze({
      assigned: 44,
      existingProductionSupport: 29,
      concreteBlockers: 15,
      testOnlyProposals: 0,
      wholeCardsVerified: 0
    }),
    existingProductionSupport: Object.freeze([
      "cfa-11078:0", "cfa-11078:1", "cfa-11079:0", "cfa-11079:1", "cfa-11080:0", "cfa-11080:1",
      "cfa-11081:0", "cfa-11081:1", "cfa-11082:0", "cfa-11082:1", "cfa-11083:0", "cfa-11083:1",
      "cfa-11084:0", "cfa-11084:1", "cfa-11085:0", "cfa-11085:1", "cfa-11086:0", "cfa-11086:1",
      "cfa-11087:0", "cfa-11087:1", "cfa-11088:0", "cfa-11088:1", "cfa-11089:0", "cfa-11089:1",
      "cfa-11090:0", "cfa-11090:1", "cfa-11091:1", "cfa-11092:0", "cfa-11092:1"
    ]),
    productionPatterns: Object.freeze({
      "cfa-11078:0": "cont-card-name-alias-v1",
      "cfa-11078:1": "auto-boosted-battle-close-source-to-soul-power-v1",
      "cfa-11079:0": "cont-card-name-alias-v1",
      "cfa-11079:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11080:0": "cont-card-name-alias-v1",
      "cfa-11080:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11081:0": "cont-card-name-alias-v1",
      "cfa-11081:1": "auto-boosted-battle-close-source-to-soul-power-v1",
      "cfa-11082:0": "cont-card-name-alias-v1",
      "cfa-11082:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11083:0": "cont-card-name-alias-v1",
      "cfa-11083:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11084:0": "cont-card-name-alias-v1",
      "cfa-11084:1": "auto-boosted-battle-close-source-to-soul-power-v1",
      "cfa-11085:0": "cont-card-name-alias-v1",
      "cfa-11085:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11086:0": "cont-card-name-alias-v1",
      "cfa-11086:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11087:0": "cont-card-name-alias-v1",
      "cfa-11087:1": "auto-boosted-battle-close-source-to-soul-power-v1",
      "cfa-11088:0": "cont-card-name-alias-v1",
      "cfa-11088:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11089:0": "cont-card-name-alias-v1",
      "cfa-11089:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11090:0": "cont-card-name-alias-v1",
      "cfa-11090:1": "auto-boosted-battle-close-source-to-soul-power-v1",
      "cfa-11091:1": "cont-gc-opponent-grade-shield-v1",
      "cfa-11092:0": "cont-card-name-alias-v1",
      "cfa-11092:1": "cont-gc-opponent-grade-shield-v1"
    }),
    blockers: Object.freeze({
      "cfa-11056:0": "The ride event must prove this exact Kheios was ridden from Approaching Fangs, Kheios; then resolve optional Soul Charge 3, choose up to two Soul cards, put one into hand and call the rest, and activate Persona Ride. No trusted handler supports this ordered choice and ride provenance.",
      "cfa-11056:1": "This ACT requires thirteen distinct card names in Soul, binds the named Kheios as cost, grants all units +10000 and this Vanguard +1 critical through turn end, then rides that exact bound instance rested. The full condition, payment, global modifier, and delayed ride sequence is unsupported.",
      "cfa-11057:0": "The discard event must preserve whether this exact source left deck or hand during its controller's turn, check two Research orders, pay Counter-Blast 1, and call it only to an open Rear-Guard Circle. No trusted handler validates that complete source-zone and order-count condition.",
      "cfa-11057:1": "This optional AUTO can follow either this exact unit's attack or boost, grant +5000 for that battle, and retire this same instance only if the power choice was accepted. No trusted handler links the choice to the exact battle-close retirement.",
      "cfa-11058:0": "This own-turn Order Zone placement must select one of the controller's Vanguards with Arkhite in its name and grant it +5000 until turn end. No trusted order-placement handler supports the named Vanguard choice.",
      "cfa-11059:0": "The source starts in Drop; playing a Normal Order must prompt its controller, pay Counter-Blast 1, call this exact source to Rear-Guard Circle, and grant +5000 until turn end. The Drop-source activation path is not trusted.",
      "cfa-11062:0": "This exact Rear-Guard's own attack requires a Blitz Order in its controller's Drop, Soul-Blast 1, then +10000 only through that battle. The combined own-attack, order-type condition, and cost/effect path is unsupported.",
      "cfa-11062:1": "At the end of this exact unit's battle attacking a Vanguard, pay Counter-Blast 1 and bind this source, then search for a grade 2+ Blitz Order excluding Regalis Piece; if Drop has a Blitz Order, a Set Order may be chosen instead. The branch, filters, cost, and battle identity are not handled together.",
      "cfa-11063:0": "On this exact card entering Guardian Circle, require a Glitter Eva Vanguard, choose up to one named Obscudeid in Drop, and branch to Guardian Circle or Hand; the Hand branch then requires a discard. No trusted handler validates this target and sequential choice.",
      "cfa-11064:0": "The ride event must verify the exact Fountain of Knowledge, Eva rider, search and reveal a Research Order, add it to hand, shuffle, and activate Persona Ride. No trusted definition covers the named ride and ordered search.",
      "cfa-11064:1": "This Vanguard attack binds the named Eva from Soul, searches Deck/Hand/Drop for Obscudeid and calls it, grants each unit +5000 until turn end, shuffles only after a Deck search, then rides the bound instance rested at turn end. This multi-zone linked sequence is unsupported.",
      "cfa-11065:0": "This Rear-Guard AUTO is once per turn on a Normal Order play, pays Soul-Blast 2, selects two of the controller's units, and grants +5000 until turn end. The exact Normal Order event, per-ability usage lock, cost, and two-target effect lack a trusted handler.",
      "cfa-11066:0": "This exact Rear-Guard's attack checks whether its controller played a Normal Order this turn, bottoms a Normal Order from Drop as cost, and grants +10000 through that battle. No trusted handler covers the turn-history condition and ordered cost/effect.",
      "cfa-1108:0": "The source must actually boost a Gold Paladin Vanguard and have three other Liberator Rear-Guards; only that boosted unit gains +4000 for the battle. No trusted handler supports this clan/name-count condition bound to the exact booster event.",
      "cfa-11091:0": "The trusted alias definition currently uses the catalog name Serene Maiden Lena, but Bushiroad prints Serene Maiden, Lena. This would make name checks use the wrong alias; correct the catalog and revalidate before counting this ability as production support."
    }),
    catalogDiscrepancies: Object.freeze([
      Object.freeze({
        abilityId: "cfa-11091:0",
        officialReference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F514EN",
        catalogText: "CONT: This card is also regarded as \"Serene Maiden Lena\".",
        officialText: "[CONT]:This card is also regarded as \"Serene Maiden, Lena\".",
        detail: "The missing comma changes the card name used by the alias effect. The central catalog and alias definition need correction; this batch does not edit shared files."
      })
    ]),
    officialSourceCoverage: Object.freeze([
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&sort=no&view=text",
        coverage: "Official D-BT11 card-text search, including Soul Oratorio, Kheios; Emanating Monster, Raselec; Three-headed Monster, Trigent; Storm Feather Owl; Lady Fencer of Bipolar Nebula; Absage Adler; Poison in Paradise, Eva; Winged Dragon, Cannonadeptero; and Stoutheart Dragon.",
        abilityIds: Object.freeze(["cfa-11056:0", "cfa-11056:1", "cfa-11057:0", "cfa-11057:1", "cfa-11058:0", "cfa-11059:0", "cfa-11062:0", "cfa-11062:1", "cfa-11063:0", "cfa-11064:0", "cfa-11064:1", "cfa-11065:0", "cfa-11066:0"])
      }),
      Object.freeze({
        reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=26&sort=no&view=text",
        coverage: "Official TD08 card-text search: Future Liberator, Llew.",
        abilityIds: Object.freeze(["cfa-1108:0"])
      }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F502EN", coverage: "Official D-PR/502EN text: Mirei alias and Guardian shield ability.", abilityIds: Object.freeze(["cfa-11079:0", "cfa-11079:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F503EN", coverage: "Official D-PR/503EN text: Yu-yu alias and Guardian shield ability.", abilityIds: Object.freeze(["cfa-11080:0", "cfa-11080:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F504EN", coverage: "Official D-PR/504EN text: Sophie alias and boosted-battle AUTO.", abilityIds: Object.freeze(["cfa-11081:0", "cfa-11081:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F505EN", coverage: "Official D-PR/505EN text: Michiru alias and Guardian shield ability.", abilityIds: Object.freeze(["cfa-11082:0", "cfa-11082:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F507EN", coverage: "Official D-PR/507EN text: Samuel alias and boosted-battle AUTO.", abilityIds: Object.freeze(["cfa-11084:0", "cfa-11084:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F510EN", coverage: "Official D-PR/510EN text: Tohya will+Dress alias and boosted-battle AUTO.", abilityIds: Object.freeze(["cfa-11087:0", "cfa-11087:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F511EN", coverage: "Official D-PR/511EN text: Tohya overDress alias and Guardian shield ability.", abilityIds: Object.freeze(["cfa-11088:0", "cfa-11088:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?clan=&grade%5B0%5D=all&keyword=&keyword_type%5B0%5D=all&kind%5B0%5D=2&nation=Keter+Sanctuary&power_from=&power_to=&rare=&regulation=D&sort=no&trigger%5B0%5D=Front&view=text", coverage: "Official D-PR/512EN front-trigger listing: Raika alias and Guardian shield ability.", abilityIds: Object.freeze(["cfa-11089:0", "cfa-11089:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F513EN", coverage: "Official D-PR/513EN text: Urara alias and boosted-battle AUTO.", abilityIds: Object.freeze(["cfa-11090:0", "cfa-11090:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F514EN", coverage: "Official D-PR/514EN text: Megumi alias and Guardian shield ability; exposes the catalog punctuation discrepancy above.", abilityIds: Object.freeze(["cfa-11091:0", "cfa-11091:1"]) }),
      Object.freeze({ reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F515EN", coverage: "Official D-PR/515EN text: Masanori alias and Guardian shield ability.", abilityIds: Object.freeze(["cfa-11092:0", "cfa-11092:1"]) })
    ]),
    officialTextNotLocated: Object.freeze([
      Object.freeze({ cardId: "cfa-11078", cardNumber: "D-PR/501EN", abilityIds: Object.freeze(["cfa-11078:0", "cfa-11078:1"]), detail: "Bushiroad's adjacent-card link identifies D-PR/501EN, but the official page returned a cache miss during this audit; catalog text is not counted as independently source-verified." }),
      Object.freeze({ cardId: "cfa-11083", cardNumber: "D-PR/506EN", abilityIds: Object.freeze(["cfa-11083:0", "cfa-11083:1"]), detail: "Bushiroad's adjacent-card link identifies D-PR/506EN, but the official page returned a cache miss during this audit; catalog text is not counted as independently source-verified." }),
      Object.freeze({ cardId: "cfa-11085", cardNumber: "D-PR/508EN", abilityIds: Object.freeze(["cfa-11085:0", "cfa-11085:1"]), detail: "Bushiroad's adjacent-card link identifies D-PR/508EN, but the official page returned a cache miss during this audit; catalog text is not counted as independently source-verified." }),
      Object.freeze({ cardId: "cfa-11086", cardNumber: "D-PR/509EN", abilityIds: Object.freeze(["cfa-11086:0", "cfa-11086:1"]), detail: "Bushiroad's adjacent-card link identifies D-PR/509EN, but the official page returned a cache miss during this audit; catalog text is not counted as independently source-verified." })
    ]),
    existingRegressionEvidence: Object.freeze({
      "cont-card-name-alias-v1": Object.freeze(["ability-cont-vc-rc-name-alias.test.js", "ability-catalog-audit.test.js"]),
      "cont-gc-opponent-grade-shield-v1": Object.freeze(["ability-cont-gc-opponent-grade-shield.test.js", "ability-catalog-audit.test.js"]),
      "auto-boosted-battle-close-source-to-soul-power-v1": Object.freeze(["ability-boosted-close-typo-authority.test.js"])
    }),
    knownRegistryStatusMismatch: Object.freeze({
      "cfa-11091:0": "Registry currently says tests-passing, but source text does not match its compiled alias: catalog/definition omit the comma in Serene Maiden, Lena."
    })
  })
});

module.exports = contribution;
