(function registerCuratedAbilityBatch(root) {
  const definitions =   [
    {
      "id": "cfa-2:0",
      "cardId": "cfa-2",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have an <Oracle Think Tank> vanguard, look at the top card of your deck, and put that card on the top or the bottom of your deck.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-2",
        "review": "printed text; placement circles, Vanguard clan requirement, and chosen deck position modeled"
      },
      "effects": [
        {
          "op": "reorder-deck-card",
          "target": "chosen",
          "destination": "player-choice"
        }
      ]
    },
    {
      "id": "cfa-103:0",
      "cardId": "cfa-103",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +3000 until the end of this turn.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "review": "text and simple source-power effect manually mapped"
      },
      "effects": [
        {
          "op": "modify-power",
          "target": "source",
          "amount": 3000,
          "duration": "turn"
        }
      ]
    },
    {
      "id": "cfa-14:0",
      "cardId": "cfa-14",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When this unit is placed on RC, choose another of your «Shadow Paladin», and that unit gets power +2000 until end of turn.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-14",
        "review": "printed text and same-controller clan target manually mapped"
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 2000,
          "duration": "turn",
          "targetFilter": {
            "controller": "source-controller",
            "excludeSource": true,
            "cardType": "unit",
            "clan": "Shadow Paladin"
          }
        }
      ]
    },
    {
      "id": "cfa-16:0",
      "cardId": "cfa-16",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When this unit boosts a unit named \"Blaster Dark\", the boosted unit gets power +4000 until end of that battle.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-16",
        "patternId": "auto-boosts-named-unit-power-battle-v1",
        "review": "boosted target is tied to the exact battle booster event"
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 4000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "cardNameContains": "Blaster Dark"
          }
        }
      ]
    },
    {
      "id": "cfa-17:0",
      "cardId": "cfa-17",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When this unit attacks a vanguard, if you have a «Shadow Paladin» vanguard, this unit gets power +2000 until end of that battle.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-17",
        "review": "exact source attack, Vanguard target, clan condition, and battle-only power"
      },
      "effects": [
        {
          "op": "modify-power",
          "target": "source",
          "amount": 2000,
          "duration": "battle"
        }
      ]
    },
    {
      "id": "cfa-24:1",
      "cardId": "cfa-24",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit attacks, this unit gets power +2000 until end of that battle.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-24",
        "review": "exact source attack, VC/RC circle restriction, and battle-limited power boost"
      },
      "effects": [
        {
          "op": "modify-power",
          "target": "source",
          "amount": 2000,
          "duration": "battle"
        }
      ]
    },
    {
      "id": "cfa-12:0",
      "cardId": "cfa-12",
      "kind": "CONT",
      "printedText": "CONT [VC]: If you have a card named \"Fullbau\" in your soul, this unit gets power +2000.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-12",
        "patternId": "cont-named-soul-card-power-v1",
        "review": "condition is evaluated continuously from current Soul contents"
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "soul-has-card-name",
            "name": "Fullbau",
            "controllerTurn": false
          }
        }
      ]
    },
    {
      "id": "cfa-20:0",
      "cardId": "cfa-20",
      "kind": "AUTO",
      "printedText": "AUTO: [Counter Blast 2] When this unit is placed on VC, you may pay the cost. If you do, choose one of your opponent’s rear-guards, and retire it.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-20",
        "review": "exact placement circle, CB2 affordability, opponent Rear-Guard target, and retirement event modeled"
      },
      "effects": [
        {
          "op": "retire-target",
          "target": "chosen",
          "targetFilter": {
            "controller": "opponent",
            "zone": "rear-guard"
          }
        }
      ]
    },
    {
      "id": "cfa-453:0",
      "cardId": "cfa-453",
      "kind": "AUTO",
      "printedText": "AUTO: [Counter Blast 2] When this unit is placed on VC or RC, if you have a «Dark Irregulars» vanguard, you may pay the cost. If you do, choose one of your opponent’s grade 1 or less rear-guard, and retire it.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-453",
        "review": "printed trigger, both circles, Dark Irregulars Vanguard condition, CB2, opponent target grade limit, and retirement modeled"
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "retire-target",
          "target": "chosen",
          "targetFilter": {
            "controller": "opponent",
            "zone": "rear-guard",
            "maxGrade": 1
          }
        }
      ]
    },
    {
      "id": "cfa-474:0",
      "cardId": "cfa-474",
      "kind": "AUTO",
      "printedText": "AUTO: [Counter Blast 2] When this unit is placed on VC or RC, if you have a «Dark Irregulars» vanguard, you may pay the cost. If you do, choose one of your opponent’s grade 2 or less rear-guards, and retire it.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-474",
        "patternId": "auto-placed-vc-rc-counter-blast-two-retire-opponent-grade-two-v1",
        "review": "printed trigger, both circles, Dark Irregulars Vanguard condition, CB2, opponent target grade limit, and retirement modeled"
      },
      "effects": [
        {
          "op": "retire-target",
          "target": "chosen",
          "targetFilter": {
            "controller": "opponent",
            "zone": "rear-guard",
            "maxGrade": 2
          }
        }
      ]
    },
    {
      "id": "cfa-41:0",
      "cardId": "cfa-41",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on RC, choose one of your «Megacolony» rear-guards with \"Machining\" in its card name, and stand it.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-41",
        "review": "exact Rear-Guard placement, Megacolony target clan, Machining name requirement, rested-state legality, and stand event modeled"
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "stand-target",
          "target": "chosen",
          "noOpIfNoLegalTargets": true,
          "targetFilter": {
            "controller": "source-controller",
            "zone": "rear-guard",
            "cardType": "unit",
            "clan": "Megacolony",
            "cardNameContains": "Machining"
          }
        }
      ]
    },
    {
      "id": "cfa-9421:0",
      "cardId": "cfa-9421",
      "kind": "AUTO",
      "printedText": "AUTO [VC]: When your drive check reveals a normal unit, COST [Counter Blast 1], and put that card on your RC as a locked card. If you put a card, this unit gets power +10000 / drive +1 until end of that battle.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-9421",
        "officialReference": "https://en.cf-vanguard.com/cardlist/?cardno=D-VS03%2F022EN&expansion=180&view=text",
        "patternId": "auto-vanguard-drive-check-normal-unit-lock-reveal-and-battle-bonus-v1",
        "review": "Only the first printed AUTO is implemented. The drive-check event must identify a normal card instance; the selected RC cannot be a lock circle. A card already occupying the chosen circle is retired by the placement. The +10000 power and +1 drive steps depend on successful placement. The second AUTO on this card remains unsupported."
      },
      "effects": [
        {
          "op": "call-checked-card-locked",
          "target": "checked-card",
          "position": "locked"
        },
        {
          "op": "modify-power",
          "target": "source",
          "amount": 10000,
          "duration": "battle",
          "ifPreviousEffectSucceeded": 0
        },
        {
          "op": "modify-drive",
          "target": "source",
          "amount": 1,
          "duration": "battle",
          "ifPreviousEffectSucceeded": 0
        }
      ]
    },
    {
      "id": "cfa-19:0",
      "cardId": "cfa-19",
      "kind": "ACT",
      "printedText": "ACT [VC/RC]: [Rest this unit & Choose a card from your hand, and discard it] Draw a card.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-19",
        "patternId": "act-rest-discard-draw-v1",
        "review": "Exact Main-phase ACT circle, rest and discard costs, and one-card draw effect modeled."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-165:0",
      "cardId": "cfa-165",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you do not have another card with \"Raizer\" in its card name on your VC or RC, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-165",
        "patternId": "cont-no-other-field-card-name-power-v1",
        "review": "Exact Perfect Raizer field-name restriction; checks the controller's VC and RC cards and excludes this card instance by UID."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-lacks-other-card-name",
            "name": "Raizer"
          }
        }
      ]
    },
    {
      "id": "cfa-264:0",
      "cardId": "cfa-264",
      "kind": "CONT",
      "printedText": "CONT [VC] Limit Break 4 (This ability is active if you have four or more damage): During your turn, if the number of cards named \"Dimensional Robo\" in your soul is three or more, this unit gets power +2000 / critical +1.",
      "requiredLocation": [
        "vanguard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-264",
        "patternId": "cont-great-daiyusha-limit-break-critical-v1",
        "review": "Exact Great Daiyusha Limit Break 4 ability; evaluated continuously from turn, damage, Soul, and VC state."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-damage-at-least",
                "count": 4
              },
              {
                "op": "soul-card-name-contains-count-at-least",
                "name": "Dimensional Robo",
                "count": 3
              }
            ]
          }
        },
        {
          "op": "continuous-critical",
          "target": "source",
          "amount": 1,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-damage-at-least",
                "count": 4
              },
              {
                "op": "soul-card-name-contains-count-at-least",
                "name": "Dimensional Robo",
                "count": 3
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-165:2",
      "cardId": "cfa-165",
      "kind": "CONT",
      "printedText": "CONT [VC]: During your turn, if the number of cards in your soul with \"Raizer\" in its card name is four or more, this unit gets critical +1.",
      "requiredLocation": [
        "vanguard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-165",
        "patternId": "cont-vanguard-soul-name-threshold-critical-v1",
        "review": "Exact VC continuous critical template; requires four Raizer-named Soul cards during the controller's turn."
      },
      "effects": [
        {
          "op": "continuous-critical",
          "target": "source",
          "amount": 1,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "soul-card-name-contains-count-at-least",
                "name": "Raizer",
                "count": 4
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-2471:1",
      "cardId": "cfa-2471",
      "kind": "CONT",
      "printedText": "CONT [Hand]: While you are paying the cost for Stride, this card gets grade +2.",
      "requiredLocation": [
        "hand"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-2471",
        "patternId": "cont-hand-stride-cost-grade-boost-v1",
        "review": "Exact Hand CONT Stride-payment grade modifier; evaluated only while checking this exact card's controller's cost."
      },
      "effects": [
        {
          "op": "continuous-grade",
          "target": "source",
          "amount": 2,
          "duration": "stride-payment",
          "condition": {
            "op": "paying-stride-cost"
          }
        }
      ]
    },
    {
      "id": "cfa-165:1",
      "cardId": "cfa-165",
      "kind": "CONT",
      "printedText": "CONT [VC]: During your turn, this unit gets power +3000 for each card in your soul with \"Raizer\" in its card name.",
      "requiredLocation": [
        "vanguard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-165",
        "patternId": "cont-soul-card-count-power-v1",
        "review": "Exact CONT power-per-Soul-card template; location, optional card-name substring, and own-turn restriction are preserved."
      },
      "effects": [
        {
          "op": "continuous-power-per-soul-card",
          "target": "source",
          "amount": 3000,
          "duration": "continuous",
          "cardNameContains": "Raizer",
          "condition": {
            "op": "controller-turn"
          }
        }
      ]
    },
    {
      "id": "cfa-6042:0",
      "cardId": "cfa-6042",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: During your turn, this unit gets power +3000 for each card in your soul.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-6042",
        "patternId": "cont-soul-card-count-power-v1",
        "review": "Exact CONT power-per-Soul-card template; location, optional card-name substring, and own-turn restriction are preserved."
      },
      "effects": [
        {
          "op": "continuous-power-per-soul-card",
          "target": "source",
          "amount": 3000,
          "duration": "continuous",
          "condition": {
            "op": "controller-turn"
          }
        }
      ]
    },
    {
      "id": "cfa-6820:0",
      "cardId": "cfa-6820",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: This unit gets power +1000 for each card in your soul.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-6820",
        "patternId": "cont-soul-card-count-power-v1",
        "review": "Exact CONT power-per-Soul-card template; location, optional card-name substring, and own-turn restriction are preserved."
      },
      "effects": [
        {
          "op": "continuous-power-per-soul-card",
          "target": "source",
          "amount": 1000,
          "duration": "continuous",
          "condition": {
            "op": "always"
          }
        }
      ]
    },
    {
      "id": "cfa-13064:0",
      "cardId": "cfa-13064",
      "kind": "CONT",
      "printedText": "CONT [VC]: During your turn, this unit gets power +5000 for each card in your soul with \"Baromagnes\" in its card name.",
      "requiredLocation": [
        "vanguard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "cardNumber": "cfa-13064",
        "patternId": "cont-soul-card-count-power-v1",
        "review": "Exact CONT power-per-Soul-card template; location, optional card-name substring, and own-turn restriction are preserved."
      },
      "effects": [
        {
          "op": "continuous-power-per-soul-card",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "cardNameContains": "Baromagnes",
          "condition": {
            "op": "controller-turn"
          }
        }
      ]
    },
    {
      "id": "cfa-28:0",
      "cardId": "cfa-28",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Shadow Paladin» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-53:0",
      "cardId": "cfa-53",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have a «Megacolony» vanguard, you may Soul Charge 1.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.placed",
        "subject": "source",
        "circles": [
          "vanguard",
          "rear-guard"
        ]
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1",
        "review": "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect."
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "soul-charge",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-70:0",
      "cardId": "cfa-70",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Megacolony» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-149:0",
      "cardId": "cfa-149",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Nova Grappler» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-298:0",
      "cardId": "cfa-298",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Great Nature» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-371:0",
      "cardId": "cfa-371",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Neo Nectar» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-452:0",
      "cardId": "cfa-452",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have a «Dark Irregulars» vanguard, you may Soul Charge 1.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.placed",
        "subject": "source",
        "circles": [
          "vanguard",
          "rear-guard"
        ]
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1",
        "review": "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect."
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "soul-charge",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-472:0",
      "cardId": "cfa-472",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have a «Dark Irregulars» vanguard, you may Soul Charge 1.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.placed",
        "subject": "source",
        "circles": [
          "vanguard",
          "rear-guard"
        ]
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1",
        "review": "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect."
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "soul-charge",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-573:0",
      "cardId": "cfa-573",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have a «Bermuda Triangle» vanguard, you may Soul Charge 1.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.placed",
        "subject": "source",
        "circles": [
          "vanguard",
          "rear-guard"
        ]
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1",
        "review": "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect."
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "soul-charge",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-609:0",
      "cardId": "cfa-609",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have a «Spike Brothers» vanguard, you may Soul Charge 1.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.placed",
        "subject": "source",
        "circles": [
          "vanguard",
          "rear-guard"
        ]
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1",
        "review": "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect."
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "soul-charge",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-799:0",
      "cardId": "cfa-799",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have a «Pale Moon» vanguard, you may Soul Charge 1.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.placed",
        "subject": "source",
        "circles": [
          "vanguard",
          "rear-guard"
        ]
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1",
        "review": "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect."
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "soul-charge",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-810:0",
      "cardId": "cfa-810",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Pale Moon» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-814:0",
      "cardId": "cfa-814",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have a «Pale Moon» vanguard, you may Soul Charge 1.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.placed",
        "subject": "source",
        "circles": [
          "vanguard",
          "rear-guard"
        ]
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1",
        "review": "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect."
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "soul-charge",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-963:0",
      "cardId": "cfa-963",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Neo Nectar» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-982:0",
      "cardId": "cfa-982",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Dimension Police» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-1141:0",
      "cardId": "cfa-1141",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Geneses» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-1146:0",
      "cardId": "cfa-1146",
      "kind": "AUTO",
      "printedText": "AUTO: When this unit is placed on VC or RC, if you have a «Genesis» vanguard, you may Soul Charge 1.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.placed",
        "subject": "source",
        "circles": [
          "vanguard",
          "rear-guard"
        ]
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1",
        "review": "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect."
      },
      "choicesReviewed": true,
      "effects": [
        {
          "op": "soul-charge",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-1358:0",
      "cardId": "cfa-1358",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Dark Irregulars» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-1491:0",
      "cardId": "cfa-1491",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Narukami» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-1627:0",
      "cardId": "cfa-1627",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Link Joker» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-1703:0",
      "cardId": "cfa-1703",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Gold Paladin» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-1728:0",
      "cardId": "cfa-1728",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Kagero» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-1962:0",
      "cardId": "cfa-1962",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: [Counter Blast 2] When this unit’s attack hits, if you have a «Bermuda Triangle» vanguard, you may pay the cost. If you do, draw a card.",
      "optional": true,
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "attack.hit",
        "subject": "source"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-attack-hit-counter-blast-draw-v1",
        "review": "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-174:0",
      "cardId": "cfa-174",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Gold Paladin», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Gold Paladin"
          }
        }
      ]
    },
    {
      "id": "cfa-442:0",
      "cardId": "cfa-442",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Dark Irregulars», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Dark Irregulars"
          }
        }
      ]
    },
    {
      "id": "cfa-636:0",
      "cardId": "cfa-636",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Royal Paladin», and it gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Royal Paladin"
          }
        }
      ]
    },
    {
      "id": "cfa-638:0",
      "cardId": "cfa-638",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Royal Paladin», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Royal Paladin"
          }
        }
      ]
    },
    {
      "id": "cfa-701:0",
      "cardId": "cfa-701",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Angel Feather», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Angel Feather"
          }
        }
      ]
    },
    {
      "id": "cfa-735:0",
      "cardId": "cfa-735",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Tachikaze», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Tachikaze"
          }
        }
      ]
    },
    {
      "id": "cfa-783:0",
      "cardId": "cfa-783",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Pale Moon», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Pale Moon"
          }
        }
      ]
    },
    {
      "id": "cfa-831:0",
      "cardId": "cfa-831",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Narukami», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Narukami"
          }
        }
      ]
    },
    {
      "id": "cfa-900:0",
      "cardId": "cfa-900",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Murakumo», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Murakumo"
          }
        }
      ]
    },
    {
      "id": "cfa-990:1",
      "cardId": "cfa-990",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Nova Grappler», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Nova Grappler"
          }
        }
      ]
    },
    {
      "id": "cfa-1006:1",
      "cardId": "cfa-1006",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Oracle Think Tank», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Oracle Think Tank"
          }
        }
      ]
    },
    {
      "id": "cfa-1020:0",
      "cardId": "cfa-1020",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Great Nature», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Great Nature"
          }
        }
      ]
    },
    {
      "id": "cfa-1062:1",
      "cardId": "cfa-1062",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Gold Paladin», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Gold Paladin"
          }
        }
      ]
    },
    {
      "id": "cfa-1120:1",
      "cardId": "cfa-1120",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Royal Paladin», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Royal Paladin"
          }
        }
      ]
    },
    {
      "id": "cfa-1211:0",
      "cardId": "cfa-1211",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Genesis», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Genesis"
          }
        }
      ]
    },
    {
      "id": "cfa-1288:0",
      "cardId": "cfa-1288",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Kagero», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Kagero"
          }
        }
      ]
    },
    {
      "id": "cfa-1337:0",
      "cardId": "cfa-1337",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Bermuda Triangle», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Bermuda Triangle"
          }
        }
      ]
    },
    {
      "id": "cfa-1385:1",
      "cardId": "cfa-1385",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Narukami», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Narukami"
          }
        }
      ]
    },
    {
      "id": "cfa-1549:0",
      "cardId": "cfa-1549",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Nubatama», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Nubatama"
          }
        }
      ]
    },
    {
      "id": "cfa-1656:0",
      "cardId": "cfa-1656",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Aqua Force», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Aqua Force"
          }
        }
      ]
    },
    {
      "id": "cfa-1893:1",
      "cardId": "cfa-1893",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Link Joker», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Link Joker"
          }
        }
      ]
    },
    {
      "id": "cfa-1905:1",
      "cardId": "cfa-1905",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Shadow Paladin», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Shadow Paladin"
          }
        }
      ]
    },
    {
      "id": "cfa-1916:1",
      "cardId": "cfa-1916",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Aqua Force», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Aqua Force"
          }
        }
      ]
    },
    {
      "id": "cfa-1973:1",
      "cardId": "cfa-1973",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Bermuda Triangle», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Bermuda Triangle"
          }
        }
      ]
    },
    {
      "id": "cfa-2476:0",
      "cardId": "cfa-2476",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Gear Chronicle», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Gear Chronicle"
          }
        }
      ]
    },
    {
      "id": "cfa-2827:0",
      "cardId": "cfa-2827",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your units, and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true
          }
        }
      ]
    },
    {
      "id": "cfa-3659:0",
      "cardId": "cfa-3659",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your units, and it gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true
          }
        }
      ]
    },
    {
      "id": "cfa-4002:0",
      "cardId": "cfa-4002",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «Megacolony» units, and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "Megacolony"
          }
        }
      ]
    },
    {
      "id": "cfa-5387:0",
      "cardId": "cfa-5387",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your units, and it gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true
          }
        }
      ]
    },
    {
      "id": "cfa-5534:0",
      "cardId": "cfa-5534",
      "kind": "ACT",
      "printedText": "ACT [RC]: [Put this unit into your soul] Choose up to one of your «The Mask Collection», and that unit gets power +3000 until end of turn.",
      "requiredLocation": [
        "rear-guard"
      ],
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "act-source-to-soul-optional-up-to-one-friendly-power-v1",
        "review": "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 3000,
          "duration": "turn",
          "optionalTarget": true,
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "excludeSource": true,
            "clan": "The Mask Collection"
          }
        }
      ]
    },
    {
      "id": "cfa-9806:0",
      "cardId": "cfa-9806",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Hao\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Hao"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12122:0",
      "cardId": "cfa-12122",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Kairi\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Kairi"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12248:1",
      "cardId": "cfa-12248",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Triumph Dragon\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Triumph Dragon"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12269:1",
      "cardId": "cfa-12269",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Oselargest\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Oselargest"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12271:1",
      "cardId": "cfa-12271",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Asturm\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Asturm"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12348:1",
      "cardId": "cfa-12348",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Sarevsael\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Sarevsael"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12359:1",
      "cardId": "cfa-12359",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Cristianos\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Cristianos"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12369:1",
      "cardId": "cfa-12369",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Marlean\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Marlean"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12535:1",
      "cardId": "cfa-12535",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Rezael\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Rezael"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12544:1",
      "cardId": "cfa-12544",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Varga\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Varga"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12557:1",
      "cardId": "cfa-12557",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Magnolia\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Magnolia"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12827:0",
      "cardId": "cfa-12827",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Kotihblaze\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Kotihblaze"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13023:0",
      "cardId": "cfa-13023",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Siana\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Siana"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13035:1",
      "cardId": "cfa-13035",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Vert\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Vert"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13648:0",
      "cardId": "cfa-13648",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Oselargest\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Oselargest"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13920:0",
      "cardId": "cfa-13920",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a grade 3 or greater vanguard with \"Hexaorb Sorceress\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn, the printed Vanguard grade threshold, and the printed Vanguard name substring; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Hexaorb Sorceress"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-8210:0",
      "cardId": "cfa-8210",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Blue Wave\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Blue Wave"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-8607:1",
      "cardId": "cfa-8607",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Blaster\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Blaster"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-9648:0",
      "cardId": "cfa-9648",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Blaster\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Blaster"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-10360:0",
      "cardId": "cfa-10360",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Youthberk\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Youthberk"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-10568:1",
      "cardId": "cfa-10568",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Maelstrom\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Maelstrom"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-11197:1",
      "cardId": "cfa-11197",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Ezel\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Ezel"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-11283:2",
      "cardId": "cfa-11283",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Relation Weaver, Petralka\" in its card name, this unit gets power +5000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Relation Weaver, Petralka"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12169:0",
      "cardId": "cfa-12169",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Alden\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Alden"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12514:1",
      "cardId": "cfa-12514",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Lascaria\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Lascaria"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13978:1",
      "cardId": "cfa-13978",
      "kind": "CONT",
      "printedText": "CONT [RC]: During your turn, if you have a vanguard with \"Astesice\" in its card name, this unit gets power +2000.",
      "requiredLocation": [
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-own-turn-named-grade-vanguard-power-v1",
        "review": "Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 2000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-turn"
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Astesice"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-10532:0",
      "cardId": "cfa-10532",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Afternoon Dance Lesson, Michu\".",
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
          "value": "Afternoon Dance Lesson, Michu"
        }
      ]
    },
    {
      "id": "cfa-10533:0",
      "cardId": "cfa-10533",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Happy Shopping! Michu\".",
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
          "value": "Happy Shopping! Michu"
        }
      ]
    },
    {
      "id": "cfa-10534:0",
      "cardId": "cfa-10534",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Sparkling Summer! Michu\".",
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
          "value": "Sparkling Summer! Michu"
        }
      ]
    },
    {
      "id": "cfa-10535:0",
      "cardId": "cfa-10535",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Shy Vocal, Noqno\".",
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
          "value": "Shy Vocal, Noqno"
        }
      ]
    },
    {
      "id": "cfa-10536:0",
      "cardId": "cfa-10536",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"First to Head Towards a Dream! Michu\".",
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
          "value": "First to Head Towards a Dream! Michu"
        }
      ]
    },
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
      "id": "cfa-11091:0",
      "cardId": "cfa-11091",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Serene Maiden Lena\".",
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
          "value": "Serene Maiden Lena"
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
      "id": "cfa-11186:0",
      "cardId": "cfa-11186",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Knight of Rendering Flash, Cairbre\".",
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
          "value": "Knight of Rendering Flash, Cairbre"
        }
      ]
    },
    {
      "id": "cfa-11187:0",
      "cardId": "cfa-11187",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Performing Petal, Diantha\".",
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
          "value": "Performing Petal, Diantha"
        }
      ]
    },
    {
      "id": "cfa-11831:0",
      "cardId": "cfa-11831",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Meteor Flare Dragon\".",
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
          "value": "Meteor Flare Dragon"
        }
      ]
    },
    {
      "id": "cfa-11832:0",
      "cardId": "cfa-11832",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Clean-sweep Dragon\".",
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
          "value": "Clean-sweep Dragon"
        }
      ]
    },
    {
      "id": "cfa-11833:0",
      "cardId": "cfa-11833",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Detonation Monster, Bobalmine\".",
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
          "value": "Detonation Monster, Bobalmine"
        }
      ]
    },
    {
      "id": "cfa-11834:0",
      "cardId": "cfa-11834",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Wayward Therapy Angel\".",
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
          "value": "Wayward Therapy Angel"
        }
      ]
    },
    {
      "id": "cfa-11835:0",
      "cardId": "cfa-11835",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Roaming Prison Dragon\".",
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
          "value": "Roaming Prison Dragon"
        }
      ]
    },
    {
      "id": "cfa-12026:0",
      "cardId": "cfa-12026",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Great Flame Axe of Ambitious Scales, Colgaflan\".",
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
          "value": "Great Flame Axe of Ambitious Scales, Colgaflan"
        }
      ]
    },
    {
      "id": "cfa-12027:0",
      "cardId": "cfa-12027",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Black Sky Thunder Quaking Queen, Leimina\".",
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
          "value": "Black Sky Thunder Quaking Queen, Leimina"
        }
      ]
    },
    {
      "id": "cfa-12028:0",
      "cardId": "cfa-12028",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Sickle Blade of Inquest, Habitable Zone\".",
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
          "value": "Sickle Blade of Inquest, Habitable Zone"
        }
      ]
    },
    {
      "id": "cfa-12029:0",
      "cardId": "cfa-12029",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Spiral Cutie Angel\".",
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
          "value": "Spiral Cutie Angel"
        }
      ]
    },
    {
      "id": "cfa-12030:0",
      "cardId": "cfa-12030",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Love-binding Maiden, Margaret\".",
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
          "value": "Love-binding Maiden, Margaret"
        }
      ]
    },
    {
      "id": "cfa-12532:0",
      "cardId": "cfa-12532",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Elementaria Sanctitude\".",
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
          "value": "Elementaria Sanctitude"
        }
      ]
    },
    {
      "id": "cfa-12552:0",
      "cardId": "cfa-12552",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Detonation Monster, Bobalmine\".",
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
          "value": "Detonation Monster, Bobalmine"
        }
      ]
    },
    {
      "id": "cfa-12553:0",
      "cardId": "cfa-12553",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Steam Battler, Gungnram\".",
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
          "value": "Steam Battler, Gungnram"
        }
      ]
    },
    {
      "id": "cfa-12554:0",
      "cardId": "cfa-12554",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Twin Buckler Dragon\".",
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
          "value": "Twin Buckler Dragon"
        }
      ]
    },
    {
      "id": "cfa-12555:0",
      "cardId": "cfa-12555",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Grand Heavenly Sword, Alden\".",
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
          "value": "Grand Heavenly Sword, Alden"
        }
      ]
    },
    {
      "id": "cfa-12751:0",
      "cardId": "cfa-12751",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Spurring Maiden, Ellenia\".",
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
          "value": "Spurring Maiden, Ellenia"
        }
      ]
    },
    {
      "id": "cfa-12752:0",
      "cardId": "cfa-12752",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Planar Prevent Dragon\".",
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
          "value": "Planar Prevent Dragon"
        }
      ]
    },
    {
      "id": "cfa-13039:0",
      "cardId": "cfa-13039",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Shadowcloak\".",
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
          "value": "Shadowcloak"
        }
      ]
    },
    {
      "id": "cfa-13376:0",
      "cardId": "cfa-13376",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Blaze Maiden, Shahdia\".",
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
          "value": "Blaze Maiden, Shahdia"
        }
      ]
    },
    {
      "id": "cfa-13385:0",
      "cardId": "cfa-13385",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Dragritter, Lateefa\".",
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
          "value": "Dragritter, Lateefa"
        }
      ]
    },
    {
      "id": "cfa-13386:0",
      "cardId": "cfa-13386",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Dragritter, Lateefa\".",
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
          "value": "Dragritter, Lateefa"
        }
      ]
    },
    {
      "id": "cfa-13387:0",
      "cardId": "cfa-13387",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Famed Blazing Demonic Lady, Oriens\".",
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
          "value": "Famed Blazing Demonic Lady, Oriens"
        }
      ]
    },
    {
      "id": "cfa-13388:0",
      "cardId": "cfa-13388",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Famed Blazing Demonic Lady, Oriens\".",
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
          "value": "Famed Blazing Demonic Lady, Oriens"
        }
      ]
    },
    {
      "id": "cfa-13389:0",
      "cardId": "cfa-13389",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Lady Fencer of Bipolar Nebula\".",
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
          "value": "Lady Fencer of Bipolar Nebula"
        }
      ]
    },
    {
      "id": "cfa-13390:0",
      "cardId": "cfa-13390",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Lady Fencer of Bipolar Nebula\".",
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
          "value": "Lady Fencer of Bipolar Nebula"
        }
      ]
    },
    {
      "id": "cfa-13391:0",
      "cardId": "cfa-13391",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Forefront Knight, Teithfallt\".",
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
          "value": "Forefront Knight, Teithfallt"
        }
      ]
    },
    {
      "id": "cfa-13392:0",
      "cardId": "cfa-13392",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Forefront Knight, Teithfallt\".",
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
          "value": "Forefront Knight, Teithfallt"
        }
      ]
    },
    {
      "id": "cfa-13393:0",
      "cardId": "cfa-13393",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Hallucinatory Morpho\".",
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
          "value": "Hallucinatory Morpho"
        }
      ]
    },
    {
      "id": "cfa-13394:0",
      "cardId": "cfa-13394",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Hallucinatory Morpho\".",
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
          "value": "Hallucinatory Morpho"
        }
      ]
    },
    {
      "id": "cfa-13395:0",
      "cardId": "cfa-13395",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"One Night Witch, Strega\".",
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
          "value": "One Night Witch, Strega"
        }
      ]
    },
    {
      "id": "cfa-13396:0",
      "cardId": "cfa-13396",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"One Night Witch, Strega\".",
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
          "value": "One Night Witch, Strega"
        }
      ]
    },
    {
      "id": "cfa-13400:0",
      "cardId": "cfa-13400",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Stealth Fiend, Shenryi\".",
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
          "value": "Stealth Fiend, Shenryi"
        }
      ]
    },
    {
      "id": "cfa-13453:0",
      "cardId": "cfa-13453",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Detonation Monster, Bobalmine\".",
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
          "value": "Detonation Monster, Bobalmine"
        }
      ]
    },
    {
      "id": "cfa-13454:0",
      "cardId": "cfa-13454",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Conceited Noble, Philander\".",
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
          "value": "Conceited Noble, Philander"
        }
      ]
    },
    {
      "id": "cfa-13481:0",
      "cardId": "cfa-13481",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Great Flame Axe of Ambitious Scales, Colgaflan\".",
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
          "value": "Great Flame Axe of Ambitious Scales, Colgaflan"
        }
      ]
    },
    {
      "id": "cfa-13482:0",
      "cardId": "cfa-13482",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Black Sky Thunder Quaking Queen, Leimina\".",
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
          "value": "Black Sky Thunder Quaking Queen, Leimina"
        }
      ]
    },
    {
      "id": "cfa-13483:0",
      "cardId": "cfa-13483",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Sickle Blade of Inquest, Habitable Zone\".",
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
          "value": "Sickle Blade of Inquest, Habitable Zone"
        }
      ]
    },
    {
      "id": "cfa-13484:0",
      "cardId": "cfa-13484",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Spiral Cutie Angel\".",
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
          "value": "Spiral Cutie Angel"
        }
      ]
    },
    {
      "id": "cfa-13485:0",
      "cardId": "cfa-13485",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Love-binding Maiden, Margaret\".",
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
          "value": "Love-binding Maiden, Margaret"
        }
      ]
    },
    {
      "id": "cfa-13486:0",
      "cardId": "cfa-13486",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"What Color is Your Wish, Valsheblan\".",
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
          "value": "What Color is Your Wish, Valsheblan"
        }
      ]
    },
    {
      "id": "cfa-13513:0",
      "cardId": "cfa-13513",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Brainwash Swirler\".",
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
          "value": "Brainwash Swirler"
        }
      ]
    },
    {
      "id": "cfa-13514:0",
      "cardId": "cfa-13514",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Cooling Heart, Yuika\".",
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
          "value": "Cooling Heart, Yuika"
        }
      ]
    },
    {
      "id": "cfa-13515:0",
      "cardId": "cfa-13515",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Elementaria Sanctitude\".",
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
          "value": "Elementaria Sanctitude"
        }
      ]
    },
    {
      "id": "cfa-13590:0",
      "cardId": "cfa-13590",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Cerrgaon\".",
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
          "value": "Cerrgaon"
        }
      ]
    },
    {
      "id": "cfa-13771:0",
      "cardId": "cfa-13771",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Blue Artillery Dragon, Inlet Pulse Dragon\".",
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
          "value": "Blue Artillery Dragon, Inlet Pulse Dragon"
        }
      ]
    },
    {
      "id": "cfa-13985:0",
      "cardId": "cfa-13985",
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
      "id": "cfa-13986:0",
      "cardId": "cfa-13986",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Serene Maiden, Lena\".",
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
          "value": "Serene Maiden, Lena"
        }
      ]
    },
    {
      "id": "cfa-13987:0",
      "cardId": "cfa-13987",
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
      "id": "cfa-13988:0",
      "cardId": "cfa-13988",
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
      "id": "cfa-14003:0",
      "cardId": "cfa-14003",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Soul Saver Dragon\".",
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
          "value": "Soul Saver Dragon"
        }
      ]
    },
    {
      "id": "cfa-14004:0",
      "cardId": "cfa-14004",
      "kind": "CONT",
      "printedText": "CONT: This card is regarded as \"Knight of Silence, Gallatin\".",
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
          "value": "Knight of Silence, Gallatin"
        }
      ]
    },
    {
      "id": "cfa-14048:0",
      "cardId": "cfa-14048",
      "kind": "CONT",
      "printedText": "CONT: This card is also regarded as \"Knight of Blackness, Obscudeid\".",
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
          "value": "Knight of Blackness, Obscudeid"
        }
      ]
    },
    {
      "id": "cfa-14050:0",
      "cardId": "cfa-14050",
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
      "id": "cfa-12249:1",
      "cardId": "cfa-12249",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Triumph Dragon\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Triumph Dragon"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12266:1",
      "cardId": "cfa-12266",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Oselargest\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Oselargest"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12272:1",
      "cardId": "cfa-12272",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Asturm\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Asturm"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12349:1",
      "cardId": "cfa-12349",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Sarevsael\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Sarevsael"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12360:1",
      "cardId": "cfa-12360",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Cristianos\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Cristianos"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12370:1",
      "cardId": "cfa-12370",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Marlean\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Marlean"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12404:1",
      "cardId": "cfa-12404",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Eugene\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Eugene"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13116:0",
      "cardId": "cfa-13116",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Drajeweled\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Drajeweled"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13366:1",
      "cardId": "cfa-13366",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Alden\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Alden"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13613:1",
      "cardId": "cfa-13613",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Mythiarq\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Mythiarq"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13726:1",
      "cardId": "cfa-13726",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Krysrain\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Krysrain"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13876:2",
      "cardId": "cfa-13876",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a grade 3 or greater vanguard with \"Vyrgilla\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-gc-named-grade-vanguard-shield-v1",
        "review": "Exact GC CONT wording. Shield applies only while this card is in Guardian Circle, and requires the controller's Vanguard to meet both the printed grade threshold and printed name substring."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Vyrgilla"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-10076:0",
      "cardId": "cfa-10076",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Sorceress\" in its card name, this unit gets shield +10000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Sorceress"
          }
        }
      ]
    },
    {
      "id": "cfa-10096:0",
      "cardId": "cfa-10096",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Youth\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Youth"
          }
        }
      ]
    },
    {
      "id": "cfa-10776:0",
      "cardId": "cfa-10776",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Messiah\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Messiah"
          }
        }
      ]
    },
    {
      "id": "cfa-12241:1",
      "cardId": "cfa-12241",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Rorowa\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Rorowa"
          }
        }
      ]
    },
    {
      "id": "cfa-12504:1",
      "cardId": "cfa-12504",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Direful Doll\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Direful Doll"
          }
        }
      ]
    },
    {
      "id": "cfa-12965:1",
      "cardId": "cfa-12965",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Blitz\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Blitz"
          }
        }
      ]
    },
    {
      "id": "cfa-13020:1",
      "cardId": "cfa-13020",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Absolute Zero\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Absolute Zero"
          }
        }
      ]
    },
    {
      "id": "cfa-13250:1",
      "cardId": "cfa-13250",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Dust Storm\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Dust Storm"
          }
        }
      ]
    },
    {
      "id": "cfa-13429:1",
      "cardId": "cfa-13429",
      "kind": "CONT",
      "printedText": "CONT [GC]: If you have a vanguard with \"Vyrgilla\" in its card name, this unit gets shield +5000.",
      "requiredLocation": [
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "officialReference": "https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",
        "patternId": "cont-gc-named-vanguard-shield-v1",
        "review": "Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."
      },
      "effects": [
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "condition": {
            "op": "controller-vanguard-card-name-contains",
            "name": "Vyrgilla"
          }
        }
      ]
    },
    {
      "id": "cfa-36:0",
      "cardId": "cfa-36",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Shadow Paladin» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Shadow Paladin"
          }
        }
      ]
    },
    {
      "id": "cfa-76:1",
      "cardId": "cfa-76",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Megacolony» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Megacolony"
          }
        }
      ]
    },
    {
      "id": "cfa-156:0",
      "cardId": "cfa-156",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Nova Grappler» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Nova Grappler"
          }
        }
      ]
    },
    {
      "id": "cfa-264:1",
      "cardId": "cfa-264",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Dimension Police» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Dimension Police"
          }
        }
      ]
    },
    {
      "id": "cfa-349:0",
      "cardId": "cfa-349",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Granblue» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Granblue"
          }
        }
      ]
    },
    {
      "id": "cfa-380:0",
      "cardId": "cfa-380",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Neo Nectar» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Neo Nectar"
          }
        }
      ]
    },
    {
      "id": "cfa-482:1",
      "cardId": "cfa-482",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Dark Irregulars» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Dark Irregulars"
          }
        }
      ]
    },
    {
      "id": "cfa-548:0",
      "cardId": "cfa-548",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Kagero» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Kagero"
          }
        }
      ]
    },
    {
      "id": "cfa-869:1",
      "cardId": "cfa-869",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Narukami» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Narukami"
          }
        }
      ]
    },
    {
      "id": "cfa-894:0",
      "cardId": "cfa-894",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Murakumo» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Murakumo"
          }
        }
      ]
    },
    {
      "id": "cfa-895:0",
      "cardId": "cfa-895",
      "kind": "CONT",
      "printedText": "CONT [VC/RC]: If you have a non-«Murakumo» vanguard or rear-guard, this unit gets power -2000.",
      "requiredLocation": [
        "vanguard",
        "rear-guard"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-vc-rc-non-clan-field-power-penalty-v1",
        "review": "Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."
      },
      "effects": [
        {
          "op": "continuous-power-adjustment",
          "target": "source",
          "amount": -2000,
          "duration": "continuous",
          "condition": {
            "op": "controller-field-has-non-clan",
            "clan": "Murakumo"
          }
        }
      ]
    },
    {
      "id": "cfa-12534:0",
      "cardId": "cfa-12534",
      "kind": "CONT",
      "printedText": "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Rezael\" in its card name, this unit gets power +5000 / shield +5000. (Active on opponent’s turn too)",
      "requiredLocation": [
        "rear-guard",
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-gc-named-grade-vanguard-power-shield-v1",
        "review": "Exact dual-circle CONT family. Preserves the printed grade threshold, Vanguard name substring, distinct RC power and GC shield values, and opponent-turn activity."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "location": "rear-guard",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Rezael"
              }
            ]
          }
        },
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "location": "guardian",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Rezael"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12566:0",
      "cardId": "cfa-12566",
      "kind": "CONT",
      "printedText": "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Krysrain\" in its card name, this unit gets power +5000 / shield +5000. (Active on opponent’s turn too)",
      "requiredLocation": [
        "rear-guard",
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-gc-named-grade-vanguard-power-shield-v1",
        "review": "Exact dual-circle CONT family. Preserves the printed grade threshold, Vanguard name substring, distinct RC power and GC shield values, and opponent-turn activity."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "location": "rear-guard",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Krysrain"
              }
            ]
          }
        },
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "location": "guardian",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Krysrain"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12713:0",
      "cardId": "cfa-12713",
      "kind": "CONT",
      "printedText": "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Blangdmire\" in its card name, this unit gets power +5000 / shield +5000. (Active on opponent’s turn too)",
      "requiredLocation": [
        "rear-guard",
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-gc-named-grade-vanguard-power-shield-v1",
        "review": "Exact dual-circle CONT family. Preserves the printed grade threshold, Vanguard name substring, distinct RC power and GC shield values, and opponent-turn activity."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "location": "rear-guard",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Blangdmire"
              }
            ]
          }
        },
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "location": "guardian",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Blangdmire"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-12951:0",
      "cardId": "cfa-12951",
      "kind": "CONT",
      "printedText": "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Lilfa\" in its card name, this unit gets power +10000 / shield + 10000. (Active on opponent’s turn too)",
      "requiredLocation": [
        "rear-guard",
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-gc-named-grade-vanguard-power-shield-v1",
        "review": "Exact dual-circle CONT family. Preserves the printed grade threshold, Vanguard name substring, distinct RC power and GC shield values, and opponent-turn activity."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "location": "rear-guard",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Lilfa"
              }
            ]
          }
        },
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "location": "guardian",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Lilfa"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13168:0",
      "cardId": "cfa-13168",
      "kind": "CONT",
      "printedText": "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Lisciafael\" in its card name, this unit gets power +5000 / shield +5000. (Active on opponent’s turn too)",
      "requiredLocation": [
        "rear-guard",
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-gc-named-grade-vanguard-power-shield-v1",
        "review": "Exact dual-circle CONT family. Preserves the printed grade threshold, Vanguard name substring, distinct RC power and GC shield values, and opponent-turn activity."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "location": "rear-guard",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Lisciafael"
              }
            ]
          }
        },
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 5000,
          "duration": "continuous",
          "location": "guardian",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Lisciafael"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-13829:0",
      "cardId": "cfa-13829",
      "kind": "CONT",
      "printedText": "CONT [RC/GC]: If you have a grade 3 or greater vanguard with \"Varga\" in its card name, this unit gets power +10000 / shield +10000. (Active on opponent’s turn too)",
      "requiredLocation": [
        "rear-guard",
        "guardian"
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "cont-rc-gc-named-grade-vanguard-power-shield-v1",
        "review": "Exact dual-circle CONT family. Preserves the printed grade threshold, Vanguard name substring, distinct RC power and GC shield values, and opponent-turn activity."
      },
      "effects": [
        {
          "op": "continuous-power",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "location": "rear-guard",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Varga"
              }
            ]
          }
        },
        {
          "op": "continuous-shield",
          "target": "source",
          "amount": 10000,
          "duration": "continuous",
          "location": "guardian",
          "condition": {
            "op": "all",
            "conditions": [
              {
                "op": "controller-vanguard-grade-at-least",
                "grade": 3
              },
              {
                "op": "controller-vanguard-card-name-contains",
                "name": "Varga"
              }
            ]
          }
        }
      ]
    },
    {
      "id": "cfa-104:0",
      "cardId": "cfa-104",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Nova Grappler» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Nova Grappler"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-105:0",
      "cardId": "cfa-105",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Nova Grappler» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Nova Grappler"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-119:0",
      "cardId": "cfa-119",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Nova Grappler» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Nova Grappler"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-267:0",
      "cardId": "cfa-267",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Great Nature» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Great Nature"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-323:0",
      "cardId": "cfa-323",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Granblue» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Granblue"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-362:0",
      "cardId": "cfa-362",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Neo Nectar» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Neo Nectar"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-601:0",
      "cardId": "cfa-601",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Spike Brothers» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Spike Brothers"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-703:0",
      "cardId": "cfa-703",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Angel Feather» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Angel Feather"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-706:0",
      "cardId": "cfa-706",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Angel Feather» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Angel Feather"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-707:0",
      "cardId": "cfa-707",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Angel Feather» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Angel Feather"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-834:0",
      "cardId": "cfa-834",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Narukami» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Narukami"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-835:0",
      "cardId": "cfa-835",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Narukami» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Narukami"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-953:0",
      "cardId": "cfa-953",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Neo Nectar» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Neo Nectar"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-988:0",
      "cardId": "cfa-988",
      "kind": "AUTO",
      "printedText": "AUTO: When another «Nova Grappler» rides this unit, you may call this card to RC.",
      "optional": true,
      "choicesReviewed": true,
      "trigger": {
        "status": "recognized-trigger",
        "eventType": "card.ridden",
        "subject": "ridden-unit",
        "riderClan": "Nova Grappler"
      },
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-ridden-unit-clan-optional-source-call-v1",
        "review": "Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."
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
      "id": "cfa-2705:0",
      "cardId": "cfa-2705",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Chronojet\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Chronojet"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-2720:0",
      "cardId": "cfa-2720",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Altmile\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Altmile"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-2784:0",
      "cardId": "cfa-2784",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Gallop\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Gallop"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3024:0",
      "cardId": "cfa-3024",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Lauris\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Lauris"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3149:0",
      "cardId": "cfa-3149",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Ranunculus\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Ranunculus"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3150:0",
      "cardId": "cfa-3150",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Claret Sword Dragon\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Claret Sword Dragon"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3271:0",
      "cardId": "cfa-3271",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Thavas\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Thavas"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3310:0",
      "cardId": "cfa-3310",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Vanquisher\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Vanquisher"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3330:0",
      "cardId": "cfa-3330",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Harri\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Harri"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3362:0",
      "cardId": "cfa-3362",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Susanoo\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Susanoo"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3376:0",
      "cardId": "cfa-3376",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Messiah\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Messiah"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3497:0",
      "cardId": "cfa-3497",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Rising\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Rising"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3511:0",
      "cardId": "cfa-3511",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Shiranui\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Shiranui"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3526:0",
      "cardId": "cfa-3526",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Gaia\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Gaia"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-3726:0",
      "cardId": "cfa-3726",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Gurguit\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Gurguit"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-4030:0",
      "cardId": "cfa-4030",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Nightrose\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Nightrose"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-4038:0",
      "cardId": "cfa-4038",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Put this unit into your soul] When your vanguard attacks, if you have a grade 3 or greater vanguard with \"Fenrir\" in its card name, you may pay the cost. If you do, draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Fenrir"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",
        "review": "Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-1127:0",
      "cardId": "cfa-1127",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Gold Paladin» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1162:0",
      "cardId": "cfa-1162",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Royal Paladin» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1172:0",
      "cardId": "cfa-1172",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Narukami» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1188:0",
      "cardId": "cfa-1188",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Spike Brothers» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1213:0",
      "cardId": "cfa-1213",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Genesis» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1226:0",
      "cardId": "cfa-1226",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Nova Grappler» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1254:0",
      "cardId": "cfa-1254",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Kagero» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1274:0",
      "cardId": "cfa-1274",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Bermuda Triangle» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1371:0",
      "cardId": "cfa-1371",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Tachikaze» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1431:0",
      "cardId": "cfa-1431",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Pale Moon» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1438:0",
      "cardId": "cfa-1438",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Shadow Paladin» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1489:0",
      "cardId": "cfa-1489",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Link Joker» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1524:0",
      "cardId": "cfa-1524",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Dark Irregulars» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1630:0",
      "cardId": "cfa-1630",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Nubatama» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-1633:0",
      "cardId": "cfa-1633",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: [Counter Blast 1] When this unit boosts a «Dimension Police» with Limit Break 4, you may pay the cost. If you do, the boosted unit gets power +3000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-boosts-clan-limit-break-counter-blast-power-v1",
        "review": "Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."
      },
      "effects": [
        {
          "op": "modify-power-target",
          "target": "boosted-unit",
          "amount": 3000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit"
          }
        }
      ]
    },
    {
      "id": "cfa-150:0",
      "cardId": "cfa-150",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Nova Grappler» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Nova Grappler"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-293:0",
      "cardId": "cfa-293",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Great Nature» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Great Nature"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-343:0",
      "cardId": "cfa-343",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Granblue» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Granblue"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-420:0",
      "cardId": "cfa-420",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Oracle Think Tank» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Oracle Think Tank"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-468:0",
      "cardId": "cfa-468",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Dark Irregulars» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Dark Irregulars"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-807:0",
      "cardId": "cfa-807",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Pale Moon» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Pale Moon"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-857:0",
      "cardId": "cfa-857",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Narukami» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Narukami"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-944:0",
      "cardId": "cfa-944",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Aqua Force» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Aqua Force"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-964:0",
      "cardId": "cfa-964",
      "kind": "AUTO",
      "printedText": "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if you have four or more other «Neo Nectar» rear-guards, draw a card.",
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-other-rear-guards-of-clan-at-least",
          "count": 4,
          "clan": "Neo Nectar"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-own-vanguard-hit-clan-rear-guards-draw-v1",
        "review": "Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        }
      ]
    },
    {
      "id": "cfa-5289:0",
      "cardId": "cfa-5289",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5293:0",
      "cardId": "cfa-5293",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5299:0",
      "cardId": "cfa-5299",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5303:0",
      "cardId": "cfa-5303",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5306:0",
      "cardId": "cfa-5306",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5307:0",
      "cardId": "cfa-5307",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5310:0",
      "cardId": "cfa-5310",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5344:0",
      "cardId": "cfa-5344",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5350:0",
      "cardId": "cfa-5350",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5352:0",
      "cardId": "cfa-5352",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded from hand for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5449:0",
      "cardId": "cfa-5449",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5463:0",
      "cardId": "cfa-5463",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5476:0",
      "cardId": "cfa-5476",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5556:0",
      "cardId": "cfa-5556",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5573:0",
      "cardId": "cfa-5573",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5589:0",
      "cardId": "cfa-5589",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5594:0",
      "cardId": "cfa-5594",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5609:0",
      "cardId": "cfa-5609",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5613:0",
      "cardId": "cfa-5613",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5640:0",
      "cardId": "cfa-5640",
      "kind": "AUTO",
      "printedText": "AUTO: [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up] When this card is discarded for the cost of calling a G guardian, you may pay the cost. If you do, Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5785:0",
      "cardId": "cfa-5785",
      "kind": "AUTO",
      "printedText": "AUTO: When discarded for the cost of calling a G guardian, COST [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up], Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5786:0",
      "cardId": "cfa-5786",
      "kind": "AUTO",
      "printedText": "AUTO: When discarded for the cost of calling a G guardian, COST [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up], Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5787:0",
      "cardId": "cfa-5787",
      "kind": "AUTO",
      "printedText": "AUTO: When discarded for the cost of calling a G guardian, COST [Bind this card face up & Choose another card with \"Heal\" from your drop zone, and bind it face up], Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-5789:0",
      "cardId": "cfa-5789",
      "kind": "AUTO",
      "printedText": "AUTO: When discarded for the cost of calling a G guardian, COST [Bind this card face up & Choose another \"Heal\" trigger from your drop zone, and bind it face up], Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11019:0",
      "cardId": "cfa-11019",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11151:0",
      "cardId": "cfa-11151",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11152:0",
      "cardId": "cfa-11152",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11153:0",
      "cardId": "cfa-11153",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11154:0",
      "cardId": "cfa-11154",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11155:0",
      "cardId": "cfa-11155",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11156:0",
      "cardId": "cfa-11156",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11157:0",
      "cardId": "cfa-11157",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11158:0",
      "cardId": "cfa-11158",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11159:0",
      "cardId": "cfa-11159",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11160:0",
      "cardId": "cfa-11160",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11161:0",
      "cardId": "cfa-11161",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11162:0",
      "cardId": "cfa-11162",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11163:0",
      "cardId": "cfa-11163",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11164:0",
      "cardId": "cfa-11164",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11165:0",
      "cardId": "cfa-11165",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11166:0",
      "cardId": "cfa-11166",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11167:0",
      "cardId": "cfa-11167",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11168:0",
      "cardId": "cfa-11168",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11169:0",
      "cardId": "cfa-11169",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11170:0",
      "cardId": "cfa-11170",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11171:0",
      "cardId": "cfa-11171",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11172:0",
      "cardId": "cfa-11172",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-11173:0",
      "cardId": "cfa-11173",
      "kind": "AUTO",
      "printedText": "AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1.",
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-g-guardian-discard-bind-heal-charge-choice-v1",
        "review": "Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."
      },
      "costs": [
        {
          "type": "source-bind",
          "count": 1
        },
        {
          "type": "bind-heal-from-drop",
          "count": 1,
          "filter": {
            "trigger": "Heal"
          }
        }
      ],
      "effects": [
        {
          "op": "g-guardian-discard-charge-choice",
          "target": "controller"
        }
      ]
    },
    {
      "id": "cfa-10781:0",
      "cardId": "cfa-10781",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Chronojet\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Chronojet"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11103:0",
      "cardId": "cfa-11103",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Susanoo\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Susanoo"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11105:0",
      "cardId": "cfa-11105",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Gavrail\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Gavrail"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11107:0",
      "cardId": "cfa-11107",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Claret Sword Dragon\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Claret Sword Dragon"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11109:0",
      "cardId": "cfa-11109",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Gurguit\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Gurguit"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11111:0",
      "cardId": "cfa-11111",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Fenrir\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Fenrir"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11113:0",
      "cardId": "cfa-11113",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Dragonic Blademaster\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Dragonic Blademaster"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11115:0",
      "cardId": "cfa-11115",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Shiranui\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Shiranui"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11117:0",
      "cardId": "cfa-11117",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Gaia\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Gaia"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11119:0",
      "cardId": "cfa-11119",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Yasuie\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Yasuie"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11121:0",
      "cardId": "cfa-11121",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Vanquisher\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Vanquisher"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11123:0",
      "cardId": "cfa-11123",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Victor\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Victor"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11125:0",
      "cardId": "cfa-11125",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Gallop\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Gallop"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11127:0",
      "cardId": "cfa-11127",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Messiah\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Messiah"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11129:0",
      "cardId": "cfa-11129",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Rising\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Rising"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11131:0",
      "cardId": "cfa-11131",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Scharhrot\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Scharhrot"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11133:0",
      "cardId": "cfa-11133",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Harri\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Harri"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11135:0",
      "cardId": "cfa-11135",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Nightrose\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Nightrose"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11137:0",
      "cardId": "cfa-11137",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Lauris\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Lauris"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11139:0",
      "cardId": "cfa-11139",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Thavas\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Thavas"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11141:0",
      "cardId": "cfa-11141",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Darkface\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Darkface"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11143:0",
      "cardId": "cfa-11143",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Bigbelly\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Bigbelly"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11145:0",
      "cardId": "cfa-11145",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Ranunculus\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Ranunculus"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    },
    {
      "id": "cfa-11147:0",
      "cardId": "cfa-11147",
      "kind": "AUTO",
      "printedText": "AUTO [RC]: When your grade 3 or greater vanguard with \"Altmile\" in its card name attacks, COST [put this unit into soul], draw a card, choose one of your vanguards, and it gets power +5000 until end of that battle.",
      "optional": true,
      "choicesReviewed": true,
      "conditions": [
        {
          "type": "controller-vanguard-grade-at-least",
          "count": 3
        },
        {
          "type": "controller-vanguard-name-contains",
          "value": "Altmile"
        }
      ],
      "source": {
        "dataset": "Cardfight Area snapshot",
        "snapshotDate": "2025-05-09",
        "patternId": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
        "review": "Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."
      },
      "effects": [
        {
          "op": "draw",
          "count": 1
        },
        {
          "op": "modify-power-target",
          "target": "chosen",
          "amount": 5000,
          "duration": "battle",
          "targetFilter": {
            "controller": "source-controller",
            "cardType": "unit",
            "zone": "vanguard"
          }
        }
      ]
    }
  ];
  if (root?.VanguardAbilityEngine) root.VanguardAbilityEngine.registerAbilityDefinitions(definitions);
  if (typeof module === "object" && module.exports) module.exports = definitions;
})(typeof globalThis === "undefined" ? this : globalThis);
