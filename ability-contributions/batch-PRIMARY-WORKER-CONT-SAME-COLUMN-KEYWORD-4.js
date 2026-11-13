"use strict";

// Eight supported siblings only. The four :1 CONT grants require a shared handler.
// See batch-PRIMARY-WORKER-CONT-SAME-COLUMN-KEYWORD-4.review.md.
module.exports = [
  {
    "id": "cfa-4023:0",
    "cardId": "cfa-4023",
    "kind": "AUTO",
    "printedText": "AUTO: Forerunner.",
    "optional": true,
    "trigger": {
      "eventType": "card.ridden",
      "subject": "ridden-unit",
      "circles": [
        "vanguard"
      ]
    },
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "auto-forerunner-same-clan-ride-call-source-v1",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "review": "Comprehensive Rules 4.52 §14.8 defines Forerunner as an optional AUTO when a unit of the same clan rides this exact unit. Rider clan and source instance are checked before queuing; accepting calls this source from Soul to an open Rear-Guard circle standing."
    },
    "effects": [
      {
        "op": "call-source-from-soul",
        "target": "source",
        "position": "stand"
      }
    ]
  },
  {
    "id": "cfa-4023:2",
    "cardId": "cfa-4023",
    "kind": "ACT",
    "printedText": "ACT [RC in the middle column] Generation Break 1: [Counter Blast 1 & Put this unit into your soul] Draw a card.",
    "requiredLocation": [
      "rear-guard"
    ],
    "requiredCircle": [
      "rear-back-center"
    ],
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "act-middle-column-gb-counter-blast-source-soul-draw-v1",
      "review": "Exact four-card legacy ACT family. Only the controller's Rear-Guard on the center back-row circle may use it; Generation Break 1 and Counter Blast 1 are checked before the exact source moves to Soul and its controller draws one card."
    },
    "effects": [
      {
        "op": "draw",
        "count": 1
      }
    ]
  },
  {
    "id": "cfa-4101:0",
    "cardId": "cfa-4101",
    "kind": "AUTO",
    "printedText": "AUTO: Forerunner.",
    "optional": true,
    "trigger": {
      "eventType": "card.ridden",
      "subject": "ridden-unit",
      "circles": [
        "vanguard"
      ]
    },
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "auto-forerunner-same-clan-ride-call-source-v1",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "review": "Comprehensive Rules 4.52 §14.8 defines Forerunner as an optional AUTO when a unit of the same clan rides this exact unit. Rider clan and source instance are checked before queuing; accepting calls this source from Soul to an open Rear-Guard circle standing."
    },
    "effects": [
      {
        "op": "call-source-from-soul",
        "target": "source",
        "position": "stand"
      }
    ]
  },
  {
    "id": "cfa-4101:2",
    "cardId": "cfa-4101",
    "kind": "ACT",
    "printedText": "ACT [RC in the middle column] Generation Break 1: [Counter Blast 1 & Put this unit into your soul] Draw a card.",
    "requiredLocation": [
      "rear-guard"
    ],
    "requiredCircle": [
      "rear-back-center"
    ],
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "act-middle-column-gb-counter-blast-source-soul-draw-v1",
      "review": "Exact four-card legacy ACT family. Only the controller's Rear-Guard on the center back-row circle may use it; Generation Break 1 and Counter Blast 1 are checked before the exact source moves to Soul and its controller draws one card."
    },
    "effects": [
      {
        "op": "draw",
        "count": 1
      }
    ]
  },
  {
    "id": "cfa-4614:0",
    "cardId": "cfa-4614",
    "kind": "AUTO",
    "printedText": "AUTO: Forerunner.",
    "optional": true,
    "trigger": {
      "eventType": "card.ridden",
      "subject": "ridden-unit",
      "circles": [
        "vanguard"
      ]
    },
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "auto-forerunner-same-clan-ride-call-source-v1",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "review": "Comprehensive Rules 4.52 §14.8 defines Forerunner as an optional AUTO when a unit of the same clan rides this exact unit. Rider clan and source instance are checked before queuing; accepting calls this source from Soul to an open Rear-Guard circle standing."
    },
    "effects": [
      {
        "op": "call-source-from-soul",
        "target": "source",
        "position": "stand"
      }
    ]
  },
  {
    "id": "cfa-4614:2",
    "cardId": "cfa-4614",
    "kind": "ACT",
    "printedText": "ACT [RC in the middle column] Generation Break 1: [Counter Blast 1 & Put this unit into your soul] Draw a card.",
    "requiredLocation": [
      "rear-guard"
    ],
    "requiredCircle": [
      "rear-back-center"
    ],
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "act-middle-column-gb-counter-blast-source-soul-draw-v1",
      "review": "Exact four-card legacy ACT family. Only the controller's Rear-Guard on the center back-row circle may use it; Generation Break 1 and Counter Blast 1 are checked before the exact source moves to Soul and its controller draws one card."
    },
    "effects": [
      {
        "op": "draw",
        "count": 1
      }
    ]
  },
  {
    "id": "cfa-5080:0",
    "cardId": "cfa-5080",
    "kind": "AUTO",
    "printedText": "AUTO: Forerunner.",
    "optional": true,
    "trigger": {
      "eventType": "card.ridden",
      "subject": "ridden-unit",
      "circles": [
        "vanguard"
      ]
    },
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "patternId": "auto-forerunner-same-clan-ride-call-source-v1",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "review": "Comprehensive Rules 4.52 §14.8 defines Forerunner as an optional AUTO when a unit of the same clan rides this exact unit. Rider clan and source instance are checked before queuing; accepting calls this source from Soul to an open Rear-Guard circle standing."
    },
    "effects": [
      {
        "op": "call-source-from-soul",
        "target": "source",
        "position": "stand"
      }
    ]
  },
  {
    "id": "cfa-5080:2",
    "cardId": "cfa-5080",
    "kind": "ACT",
    "printedText": "ACT [RC in the middle column] Generation Break 1: [Counter Blast 1 & Put this unit into your soul] Draw a card.",
    "requiredLocation": [
      "rear-guard"
    ],
    "requiredCircle": [
      "rear-back-center"
    ],
    "source": {
      "dataset": "Cardfight Area snapshot",
      "snapshotDate": "2025-05-09",
      "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "act-middle-column-gb-counter-blast-source-soul-draw-v1",
      "review": "Exact four-card legacy ACT family. Only the controller's Rear-Guard on the center back-row circle may use it; Generation Break 1 and Counter Blast 1 are checked before the exact source moves to Soul and its controller draws one card."
    },
    "effects": [
      {
        "op": "draw",
        "count": 1
      }
    ]
  }
];
