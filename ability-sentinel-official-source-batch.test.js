"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_SOURCES = {
  "cfa-1222": {
    cardNumber: "BT10/010EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=BT10%2F010EN",
    abilities: {
      "cfa-1222:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-1222:1": { patternId: "auto-gc-discard-protect-attacked-unit-v1", officialText: "[AUTO]:[Choose a <Royal Paladin> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Royal Paladin> that is being attacked, and that unit cannot be hit until end of that battle." }
    }
  },
  "cfa-11933": {
    cardNumber: "DZ-BT01/EX10EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT01%2FEX10EN",
    abilities: {
      "cfa-11933:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck)" },
      "cfa-11933:1": { patternId: "auto-gc-protect-then-conditional-discard-v1", officialText: "[AUTO]:When this unit is put on (GC), choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from your hand, and discard it." }
    }
  },
  "cfa-12005": {
    cardNumber: "DZ-BT01/EX21EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT01%2FEX21EN",
    abilities: {
      "cfa-12005:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck)" },
      "cfa-12005:1": { patternId: "auto-gc-protect-then-conditional-discard-v1", officialText: "[AUTO]:When this unit is put on (GC), choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from your hand, and discard it." }
    }
  },
  "cfa-12188": {
    cardNumber: "D-PR/759EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F759EN",
    abilities: {
      "cfa-12188:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck)" },
      "cfa-12188:1": { patternId: "auto-gc-protect-then-conditional-discard-v1", officialText: "[AUTO]:When this unit is put on (GC), choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from hand, and discard it." }
    }
  },
  "cfa-8370": {
    cardNumber: "D-BT01/049EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT01%2F049EN",
    abilities: {
      "cfa-8370:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck)" },
      "cfa-8370:1": { patternId: "auto-gc-protect-then-conditional-discard-v1", officialText: "[AUTO]:When this unit is put on (GC), choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from your hand, and discard it." }
    }
  },
  "cfa-8342": {
    cardNumber: "D-TD03/010EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-TD03%2F010EN",
    abilities: {
      "cfa-8342:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-8342:1": { patternId: "auto-gc-sentinel-protect-friendly-unit-v1", officialText: "[AUTO]:When this unit is put on (GC), [COST][discard a card from hand], choose one of your units, and it cannot be hit until end of that battle." }
    }
  },
  "cfa-12413": {
    cardNumber: "DZ-BT07/070EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=DZ-BT07%2F070EN",
    abilities: {
      "cfa-12413:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck)" },
      "cfa-12413:1": { patternId: "auto-gc-protect-then-conditional-discard-v1", officialText: "[AUTO]:When this unit is put on (GC), choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from hand, and discard it." }
    }
  },
  "cfa-12830": {
    cardNumber: "D-PR/794EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-PR%2F794EN",
    abilities: {
      "cfa-12830:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck)" },
      "cfa-12830:1": { patternId: "auto-gc-protect-then-conditional-discard-v1", officialText: "[AUTO]:When this unit is put on (GC), choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from your hand, and discard it." }
    }
  },
  "cfa-5707": {
    name: "Wyvern Guard, Barri",
    cardNumber: "V-BT01/021EN",
    reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=111&sort=no&view=text",
    abilities: {
      "cfa-5707:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-5707:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-5708": {
    name: "Flash Shield, Iseult",
    cardNumber: "V-BT01/015EN",
    reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=111&sort=no&view=text",
    abilities: {
      "cfa-5708:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-5708:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-5724": {
    name: "Guard Griffin",
    cardNumber: "V-TD02/007EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-TD02%2F007EN",
    abilities: {
      "cfa-5724:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-5724:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-5895": {
    name: "Cheer Girl, Jamie",
    cardNumber: "V-EB01/028EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB01%2F028EN",
    abilities: {
      "cfa-5895:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-5895:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [Cost][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-5896": {
    name: "Stronghold Dragon, Robustops",
    cardNumber: "V-EB01/023EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB01%2F023EN",
    abilities: {
      "cfa-5896:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-5896:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [Cost][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-5904": {
    name: "Battle Siren, Imelda",
    cardNumber: "V-TD03/008EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-TD03%2F008EN",
    abilities: {
      "cfa-5904:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-5904:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-5918": {
    name: "Emerald Shield, Paschal",
    cardNumber: "V-SS03/021EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-SS03%2F021EN",
    abilities: {
      "cfa-5918:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-5918:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-5919": {
    name: "Gust Djinn",
    cardNumber: "V-SS03/019EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-SS03%2F019EN",
    abilities: {
      "cfa-5919:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-5919:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6043": {
    name: "Stealth Beast, Leaves Mirage",
    cardNumber: "V-BT02/018EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-BT02%2F018EN",
    abilities: {
      "cfa-6043:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6043:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6044": {
    name: "Stealth Fiend, Hamper Gapper",
    cardNumber: "V-BT02/031EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-BT02%2F031EN",
    abilities: {
      "cfa-6044:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6044:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6052": {
    name: "Hades Hypnotist",
    cardNumber: "V-BT02/024EN",
    reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=118&sort=no&view=text",
    abilities: {
      "cfa-6052:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6052:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6063": {
    name: "March Rabbit of Nightmareland",
    cardNumber: "V-BT02/021EN",
    reference: "https://en.cf-vanguard.com/cardlist/cardsearch/?clan=&grade%5B0%5D=all&keyword=nightmareland&keyword_type%5B0%5D=all&kind%5B0%5D=all&nation=&power_from=&power_to=&rare=&regulation=V&trigger%5B0%5D=all&view=text",
    abilities: {
      "cfa-6063:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6063:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6227": {
    name: "Steam Artist, Abi-ratta",
    cardNumber: "V-EB04/026EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB04%2F026EN",
    abilities: {
      "cfa-6227:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6227:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6230": {
    name: "Administrator of Hope, Pandora",
    cardNumber: "V-EB04/022EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB04%2F022EN",
    abilities: {
      "cfa-6230:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6230:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6244": {
    name: "Cable Sheep",
    cardNumber: "V-EB04/017EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB04%2F017EN",
    abilities: {
      "cfa-6244:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6244:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6245": {
    name: "Speculate Chipmunk",
    cardNumber: "V-EB04/030EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB04%2F030EN",
    abilities: {
      "cfa-6245:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6245:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6251": {
    name: "Steam Guard, Kastilia",
    cardNumber: "V-EB04/014EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB04%2F014EN",
    abilities: {
      "cfa-6251:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6251:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-6256": {
    name: "Goddess of Self-sacrifice, Kushinada",
    cardNumber: "V-EB04/012EN",
    reference: "https://en.cf-vanguard.com/cardlist/?cardno=V-EB04%2F012EN",
    abilities: {
      "cfa-6256:0": { patternId: "cont-sentinel-keyword-v1", officialText: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)" },
      "cfa-6256:1": { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle." }
    }
  },
  "cfa-11624": {
    name: "DokoVan! Neo 2023",
    type: "Unit",
    grade: 1,
    power: 6000,
    shield: 0,
    critical: 1,
    nation: "",
    trigger: "",
    cardNumber: "D-PR/538",
    officialPrintName: "どこヴァン！ねお2023",
    reference: "https://cf-vanguard.com/cardlist/?cardno=D-PR%2F538",
    officialLanguage: "Japanese",
    abilities: {
      "cfa-11624:0": {
        patternId: "cont-sentinel-keyword-v1",
        officialText: "〖永〗：守護者",
        validatedTranslation: "CONT: Sentinel."
      },
      "cfa-11624:1": {
        patternId: "auto-gc-protect-then-conditional-discard-v1",
        officialText: "〖自〗：このユニットが(G)に置かれた時、あなたのユニットを１枚選び、そのバトル中、ヒットされない。あなたの手札が２枚以上なら、手札から１枚選び、捨てる。",
        validatedTranslation: "AUTO: When this unit is put on GC, choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from your hand, and discard it."
      }
    }
  },
  "cfa-12227": {
    name: "Cardfight!! Vanguard will+Dress Final Episode Memorial",
    type: "Unit",
    grade: 1,
    power: 6000,
    shield: 0,
    critical: 1,
    nation: "",
    trigger: "",
    cardNumber: "D-PR/708",
    officialPrintName: "カードファイト!! ヴァンガード will+Dress 最終回記念",
    reference: "https://cf-vanguard.com/cardlist/?cardno=D-PR%2F708",
    officialLanguage: "Japanese",
    abilities: {
      "cfa-12227:0": {
        patternId: "cont-sentinel-keyword-v1",
        officialText: "〖永〗：守護者",
        validatedTranslation: "CONT: Sentinel."
      },
      "cfa-12227:1": {
        patternId: "auto-gc-protect-then-conditional-discard-v1",
        officialText: "〖自〗：このユニットが(G)に置かれた時、あなたのユニットを１枚選び、そのバトル中、ヒットされない。あなたの手札が２枚以上なら、手札から１枚選び、捨てる。",
        validatedTranslation: "AUTO: When this unit is put on GC, choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from your hand, and discard it."
      }
    }
  }
};

const VSS03_SENTINEL_TEXT = {
  sentinel: "[CONT]:Sentinel (You may only have up to four cards with \"[CONT]:Sentinel\" in a deck.)",
  guardian: "[AUTO](GC):When placed, [COST][discard a card from your hand], and one of your units cannot be hit until end of that battle."
};
const VSS03_SENTINEL_CARDS = [
  ["cfa-5739", "Weather Forecaster, Miss Mist", "V-SS03/002EN"],
  ["cfa-6125", "Battle Cupid, Nociel", "V-SS03/003EN"],
  ["cfa-6004", "Dark Shield, Mac Lir", "V-SS03/004EN"],
  ["cfa-6127", "Halo Shield, Mark", "V-SS03/005EN"],
  ["cfa-6340", "Stealth Beast, Mijingakure", "V-SS03/008EN"],
  ["cfa-5841", "Archbird", "V-SS03/009EN"],
  ["cfa-6373", "Wyvern Guard, Guld", "V-SS03/011EN"],
  ["cfa-5780", "Twin Blader", "V-SS03/012EN"],
  ["cfa-5920", "Diamond Ace", "V-SS03/013EN"],
  ["cfa-6481", "Flowers in Vacuum, Cosmo Wreath", "V-SS03/014EN"],
  ["cfa-5842", "Cheer Girl, Marilyn", "V-SS03/015EN"],
  ["cfa-6613", "Glittery Baby, Lene", "V-SS03/020EN"],
  ["cfa-5840", "Paralyze Madonna", "V-SS03/022EN"]
];
for (const [cardId, name, cardNumber] of VSS03_SENTINEL_CARDS) {
  CARD_SOURCES[cardId] = {
    name,
    cardNumber,
    trigger: "Draw",
    reference: `https://en.cf-vanguard.com/cardlist/?cardno=${encodeURIComponent(cardNumber)}`,
    abilities: {
      [`${cardId}:0`]: { patternId: "cont-sentinel-keyword-v1", officialText: VSS03_SENTINEL_TEXT.sentinel },
      [`${cardId}:1`]: { patternId: "auto-gc-when-placed-discard-protect-unit-v1", officialText: VSS03_SENTINEL_TEXT.guardian }
    }
  };
}

const CARD_IDS = Object.keys(CARD_SOURCES);

test("forty-one Sentinel cards retain official printing sources and exact compiled ability coverage", async t => {
  const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
  for (const cardId of CARD_IDS) {
    const card = cards.get(cardId);
    assert.ok(card, `${cardId} exists in the catalog`);
    const abilities = Engine.parseCardAbilitiesCached(card);
    const expected = CARD_SOURCES[cardId];
    if (expected.name) assert.equal(card.name, expected.name, `${cardId} matches the official card name`);
    if (Object.hasOwn(expected, "type")) assert.equal(card.type, expected.type, `${cardId} retains the official card type`);
    if (Object.hasOwn(expected, "nation")) assert.equal(card.nation, expected.nation, `${cardId} retains the official nation`);
    if (Object.hasOwn(expected, "trigger")) assert.equal(card.trigger, expected.trigger, `${cardId} retains the official trigger subtype`);
    if (expected.grade !== undefined) assert.equal(Number(card.grade), expected.grade, `${cardId} retains the official grade`);
    if (expected.power !== undefined) assert.equal(Number(card.power), expected.power, `${cardId} retains the official power`);
    if (expected.shield !== undefined) assert.equal(Number(card.shield), expected.shield, `${cardId} retains the official shield`);
    if (expected.critical !== undefined) assert.equal(Number(card.critical || 1), expected.critical, `${cardId} retains the official critical`);
    assert.equal(abilities.length, Object.keys(expected.abilities).length, `${cardId} has no unmodeled sibling ability`);

    for (const ability of abilities) {
      await t.test(ability.id, () => {
        const source = ability.definition?.source;
        const official = expected.abilities[ability.id];
        assert.ok(official, `${ability.id} is one of the printed abilities`);
        assert.equal(ability.cardId, cardId);
        assert.equal(ability.definition?.cardId, cardId);
        assert.equal(ability.definition?.printedText, ability.printedText);
        assert.equal(source?.dataset, "Bushiroad official card list");
        assert.equal(source?.officialCardNumber, expected.cardNumber);
        assert.equal(source?.officialReference, expected.reference);
        assert.equal(source?.officialTextVerified, true);
        assert.equal(source?.officialAbilityText, official.officialText);
        assert.equal(source?.patternId, official.patternId);
        if (expected.officialLanguage) {
          assert.equal(source?.officialLanguage, expected.officialLanguage);
          assert.equal(source?.officialPrintName, expected.officialPrintName);
          assert.equal(source?.officialOriginalText, official.officialText);
          assert.equal(source?.validatedTranslation, official.validatedTranslation);
        }
        if (ability.kind === "CONT") {
          assert.deepEqual(ability.definition.keywords, ["sentinel"]);
          assert.equal(ability.trigger, null);
          assert.equal(Engine.isManuallyActivatable(ability), false);
        } else {
          assert.equal(ability.kind, "AUTO");
          assert.equal(ability.trigger?.status, "recognized-trigger");
          assert.equal(ability.trigger?.eventType, "card.placed");
          assert.deepEqual(ability.trigger?.circles, ["guardian"]);
        }
      });
    }
  }
});
