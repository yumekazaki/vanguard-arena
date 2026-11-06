"use strict";
module.exports = [
  {
    "id": "cfa-3102:0",
    "cardId": "cfa-3102",
    "kind": "ACT",
    "printedText": "ACT [VC] 1/Turn Generation Break 1 (This ability is active if you have one or more face up G units in total on your VC or G zone): [Choose two of your rear-guards, and retire them] Until end of turn, this unit gets power +5000, and \"AUTO [VC]: When this unit’s attack hits a vanguard, choose up to two of your opponent’s rear-guards, and retire them.\".",
    "requiredLocation": [
      "vanguard"
    ],
    "activationWindow": "main",
    "conditions": [
      {
        "type": "generation-break",
        "count": 1
      }
    ],
    "conditionsReviewed": true,
    "costs": [
      {
        "type": "retire-rear-guard",
        "count": 2,
        "targetFilter": {
          "controller": "source-controller",
          "zone": "rear-guard",
          "excludeSource": true
        }
      }
    ],
    "costsReviewed": true,
    "choicesReviewed": true,
    "optional": false,
    "once": true,
    "usageRestriction": {
      "type": "once-per-turn",
      "scope": "ability-instance",
      "reset": "turn"
    },
    "source": {
      "dataset": "Bushiroad official card list",
      "snapshotDate": "2026-11-04",
      "officialCardNumber": "G-BT04/029EN",
      "officialReferences": [
        "https://en.cf-vanguard.com/cardlist/?cardno=G-BT04%2F029EN"
      ],
      "rulesReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
      "patternId": "act-vanguard-retire-two-power-grant-vanguard-hit-retire-two-v1",
      "review": "Exact ACT text for Overbearing Knight, Gilvaese. It is VC-only, Generation Break 1, and once per turn. The activating player must choose two units they control on Rear-Guard Circles and retire both before the ability resolves. The source receives +5000 through turn end and this exact Vanguard instance receives a temporary AUTO through turn end; only that instance’s attack hitting the opposing Vanguard qualifies, and the controller may choose zero, one, or two opposing Rear-Guards to retire."
    },
    "effects": [
      {
        "op": "modify-power",
        "target": "source",
        "amount": 5000,
        "duration": "turn"
      },
      {
        "op": "grant-temporary-ability",
        "target": "source",
        "duration": "turn",
        "parentAbilityId": "cfa-3102:0",
        "grantedAbility": {
          "kind": "AUTO",
          "printedText": "AUTO [VC]: When this unit’s attack hits a vanguard, choose up to two of your opponent’s rear-guards, and retire them.",
          "requiredLocation": [
            "vanguard"
          ],
          "trigger": {
            "status": "recognized-trigger",
            "eventType": "attack.hit",
            "subject": "source",
            "circles": [],
            "targetLocation": "vanguard",
            "requiredTimingWindow": "attack-hit",
            "turnRelation": "controller"
          },
          "conditions": [],
          "costs": [],
          "effects": [
            {
              "op": "retire-up-to-targets",
              "target": "chosen",
              "maximum": 2,
              "targetFilter": {
                "controller": "opponent",
                "zone": "rear-guard"
              }
            }
          ]
        }
      }
    ]
  }
];
