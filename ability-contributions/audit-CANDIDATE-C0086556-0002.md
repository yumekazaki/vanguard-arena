# Audit only: `CANDIDATE-C0086556-0002`

Baseline: `826779006f4b183ac8e5190c512f26df884c9394`

Branch: `work/candidate-c0086556-0002`

No ability definitions or shared code were added. At this baseline, each assigned record has exactly one printed ability, parsed as `needs-review`, with no registered definition; `supportsServerAbilityEffects` rejects all five. The batch remains unimplemented and unverified pending shared engine work.

## Assigned abilities and exact name filters

Each ability is `AUTO: When this unit is placed on RC`. The Drop choice is a grade 3 or greater card whose name contains the first quoted fragment; if selected, inspect the top five and choose up to one card whose name contains the second quoted fragment. Reveal and add it to hand, then shuffle. If a card was added, choose and discard a card from hand and give the exact source instance +2000 power until end of turn.

| Ability ID | Card | Drop filter | Top-five filter |
|---|---|---|---|
| `cfa-13068:0` | Dragritter, Amena | Grade 3+, name contains `Triumph Dragon` | Name contains `Strafe Command` |
| `cfa-13087:0` | Dangerous Thrower | Grade 3+, name contains `Oselargest` | Name contains `Tilligan` |
| `cfa-13096:0` | Knight of Light Bow, Mumiah | Grade 3+, name contains `Sarevsael` | Name contains `Virile Core` |
| `cfa-13111:0` | Memorial Stem, Alpinum | Grade 3+, name contains `Cristianos` | Name contains `Severin` |
| `cfa-13145:0` | Organic Umbrella, Khcek | Grade 3+, name contains `Marlean` | Name contains `Respino` |

## Missing shared support

- The engine's existing `put-chosen-normal-drop-to-deck-bottom` handler only validates a normal unit without Sentinel. It cannot enforce the printed Grade 3+ and per-card name filter, and its current optional-target flow combines selecting and moving the card. This batch needs separate selection and optional bottom-deck decisions.
- The server reducer only authorizes that operation for five different card IDs and one exact printed text (`cfa-13823`, `cfa-13830`, `cfa-13844`, `cfa-13891`, `cfa-13921`). The top-five search/discard path is also limited to its own fixed ID/text whitelist. A contribution-only definition therefore cannot resolve authoritatively.
- The current choice payload/UI carries one generic `effectUid`; this sequence needs distinct, controller-private selections for the Drop card, optional bottom-deck choice, top-five card, and hand discard. The reducer must revalidate all selections against the same source instance and current zones before applying anything, then perform the ordered search, reveal/add, shuffle, conditional discard, and +2000 turn modifier atomically.
- Required work is a reusable shared effect/resolution path with exact card filters, staged choices and server validation/allowlisting, plus focused engine/reducer/UI multiplayer tests. Do not mark these five abilities tested or verified until that dependency is implemented and those tests pass.

## Validation evidence

- Catalog audit at the baseline: 14,022 cards; 17,240 ability blocks; 4,377 compiled; 12,863 unsupported; zero invalid compiled definitions.
- Passed: `node --test ability-placement-top-five-search-discard-authority.test.js` — 4/4 tests.
- Could not load: `node --test ability-auto-rc-placement-normal-drop-bottom-power-server.test.js` — sparse worktree is missing `card-ability-keywords.js`. Sparse patterns were left unchanged.
