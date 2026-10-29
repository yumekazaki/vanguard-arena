"use strict";

// Exact baseline definitions with dedicated batch regression coverage.
// cfa-11091:0 is deferred because its literal alias differs from the catalog name.
module.exports = [
  {
    "id": "cfa-11078:0",
    "cardId": "cfa-11078",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Burning Flail Dragon\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Burning Flail Dragon"
      }
    ]
  },
  {
    "id": "cfa-11079:0",
    "cardId": "cfa-11079",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Flare Veil Dragon\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Flare Veil Dragon"
      }
    ]
  },
  {
    "id": "cfa-11079:1",
    "cardId": "cfa-11079",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11080:0",
    "cardId": "cfa-11080",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Blaze Maiden, Parama\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Blaze Maiden, Parama"
      }
    ]
  },
  {
    "id": "cfa-11080:1",
    "cardId": "cfa-11080",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11081:0",
    "cardId": "cfa-11081",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Stem Deviate Dragon\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Stem Deviate Dragon"
      }
    ]
  },
  {
    "id": "cfa-11082:0",
    "cardId": "cfa-11082",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Rouse Wildmaster, Riley\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Rouse Wildmaster, Riley"
      }
    ]
  },
  {
    "id": "cfa-11082:1",
    "cardId": "cfa-11082",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11083:0",
    "cardId": "cfa-11083",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Diabolos Girls, Natalia\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Diabolos Girls, Natalia"
      }
    ]
  },
  {
    "id": "cfa-11083:1",
    "cardId": "cfa-11083",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11084:0",
    "cardId": "cfa-11084",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Patrol Robo, Dekarcop\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Patrol Robo, Dekarcop"
      }
    ]
  },
  {
    "id": "cfa-11085:0",
    "cardId": "cfa-11085",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Ameliorate Connector\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Ameliorate Connector"
      }
    ]
  },
  {
    "id": "cfa-11085:1",
    "cardId": "cfa-11085",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11086:0",
    "cardId": "cfa-11086",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Cardinal Draco, Enpyro\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Cardinal Draco, Enpyro"
      }
    ]
  },
  {
    "id": "cfa-11086:1",
    "cardId": "cfa-11086",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11087:0",
    "cardId": "cfa-11087",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Blade Feather Dragon\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Blade Feather Dragon"
      }
    ]
  },
  {
    "id": "cfa-11088:0",
    "cardId": "cfa-11088",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Protection Magic, Prorobi\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Protection Magic, Prorobi"
      }
    ]
  },
  {
    "id": "cfa-11088:1",
    "cardId": "cfa-11088",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11089:0",
    "cardId": "cfa-11089",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Bard of Heavenly Song, Alpacc\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Bard of Heavenly Song, Alpacc"
      }
    ]
  },
  {
    "id": "cfa-11089:1",
    "cardId": "cfa-11089",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11090:0",
    "cardId": "cfa-11090",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Aspiring Maiden, Alana\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Aspiring Maiden, Alana"
      }
    ]
  },
  {
    "id": "cfa-11091:1",
    "cardId": "cfa-11091",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  },
  {
    "id": "cfa-11092:0",
    "cardId": "cfa-11092",
    "kind": "CONT",
    "printedText": "CONT: This card is also regarded as \"Frenzied Heiress\".",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "cont-card-name-alias-v1",
      "review": "Exact zone-unspecified name-alias wording. Comprehensive Rules 4.52 section 2.1.2 identifies the continuous ability as active in all zones; the compiled keyword supplies the printed alias to card-name comparisons."
    },
    "keywords": [
      {
        "name": "card-name-alias",
        "value": "Frenzied Heiress"
      }
    ]
  },
  {
    "id": "cfa-11092:1",
    "cardId": "cfa-11092",
    "kind": "CONT",
    "printedText": "CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000.",
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "cont-gc-opponent-grade-shield-v1",
      "review": "Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."
    },
    "effects": [
      {
        "op": "continuous-shield",
        "target": "source",
        "amount": 5000,
        "duration": "continuous",
        "condition": {
          "op": "opponent-vanguard-grade-at-least",
          "grade": 3
        }
      }
    ]
  }
];
