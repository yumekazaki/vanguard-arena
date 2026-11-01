# Divine Skill attack-lock batch review

Batch: `PRIMARY-WORKER-CONT-DIVINE-SKILL-ATTACK-LOCK-6`

Worker: `worker-divine-skill-attack-lock`

Base: `codex/standard-ride-deck` at `826779006f4b183ac8e5190c512f26df884c9394`

Reviewed all twelve printed blocks on the six reserved cards. **Implemented: 0/12. Fully verified cards: 0/6.** The contribution exports an empty array intentionally. Exact printed text and stable IDs are pinned in the batch test; catalog text, including curly apostrophes, is unchanged. No shared source or coordination files are changed.

## Per-ability disposition

| Card | CONT ID | AUTO ID | Own-attack power calculation | Disposition |
| --- | --- | --- | --- | --- |
| Divine Sister, Granite | cfa-13049:0 | cfa-13049:1 | 2000 × controller's Rear-Guards, including this source | Both unsupported |
| Roaring Tides Dragon, Hadal Crash Dragon | cfa-13057:0 | cfa-13057:1 | 2000 × floor(controller's Drop cards / 5) | Both unsupported |
| Great Axe Severing Slash Colossus | cfa-13060:0 | cfa-13060:1 | 2000 × floor(controller's Soul cards / 3) | Both unsupported |
| Accident Squall, Annasia | cfa-13071:0 | cfa-13071:1 | 2000 × opponent's Rear-Guards | Both unsupported |
| Gould Segment Dragon | cfa-13083:0 | cfa-13083:1 | 2000 × controller's Set Orders in Order Zone | Both unsupported |
| Dissect Gale Dragon | cfa-13113:0 | cfa-13113:1 | 2000 × opponent's open RC | Both unsupported; locked/extra-circle counting needs rules review |

Every CONT is the compound printed restriction: never ride this unit; it cannot attack unless its controller used Divine Skill this fight. It has no printed circle limit and must never be offered as manual activation. Registering only a cannot-be-ridden keyword would incorrectly imply the entire printed block is implemented.

Every separate AUTO is mandatory, free, not once per turn, and triggers only when that exact source attacks from RC. It grants only that source a battle-duration modifier; it does not choose another target. The count is needed at effect resolution and must not become a continuously recalculated modifier. No invented cost, choice, fixed +2000 replacement, or CONT power substitution is registered.

## Shared dependencies requested for primary-session integration

1. **Trusted Divine Skill history and full compound restriction.** The current engine/reducer have no Divine Skill history hook. Define a server-owned per-player fight fact, updated only by an actual authorized Divine Skill use, surviving turns and zone changes and resetting for a new fight. Review when a use counts if its costs or resolution fail. Never trust a client assertion, opponent's use, card-name substring, or ordinary ability use. Extend client and authoritative ride/attack checks together; keep the unconditional ride ban after Divine Skill use. Cover normal/effect/ride-deck paths where applicable and document prohibited/impossible paths.
2. **Count-based AUTO source power in both engine and reducer.** Existing `modify-power` uses a numeric amount. Existing `continuous-power-per-*` operations continuously evaluate power and cannot implement these battle snapshots. Add a separately reviewed typed handler, or a reviewed extension of the current handler, without silently accepting extra parameters. Validate exact source/controller/location, pending battle identity, count ownership, integer grouping and zero results. Recompute the legal count from authoritative state at resolution; snapshot the resulting bonus for that battle. Preserve multiple battles and existing additive power modifiers. Do not provide the amount through player selections.
3. **Count rules review.** Define which instances are Rear-Guards (including source, tokens, locked cards, additional RC and stale/duplicate UIDs), Set Order identity independently of other Order Zone cards, and open RC versus locked circles. Confirm zero/extra-circle counts against rules before adding support. No external rules claims were used to override catalog wording in this review.

Required focused follow-up cases for both seats: legal attack after own Divine Skill use, wrong/opponent/forged history, history across turn and fight boundaries; unconditional ride ban; exact own attacker versus another same-card instance; VC/hand/drop/back-row restrictions; wrong event/controller/target, stale state/battle and duplicate requests with unchanged state. Exercise own/opponent counts separately; Soul 0/2/3/5/6 and Drop 0/4/5/9/10; Set Orders mixed with normal/blitz orders; source included in own RC count; all occupied/empty/locked/extra RC. Change counts between trigger and resolution, then after resolution; verify battle expiry and a second independent attack. No costs or chosen targets are printed on these twelve blocks, so unavailable-cost/choice tests are inapplicable.

## Evidence interpretation

The batch test separates ordinary parsing/safety assertions from `TODO` specifications. Ordinary passing tests establish reservation scope, exact text and trigger parsing, unsupported-effect rejection, and no promotion to card completion. They are **not** ability implementation evidence. TODO ride/attack/count tests execute against the real reducer to expose missing behavior; TODO checklists without callbacks are unexecuted acceptance requirements. A zero exit code with TODO failures does not mean those effects work. Do not mark these abilities `tests-passing` or these cards `fully-verified` from this PR.

The test file and PR report the actual run counts, including pending TODO cases. The catalog audit must continue to report twelve unsupported batch blocks and no newly completed batch card. Shared implementation and whole-card verification remain with the primary session.
