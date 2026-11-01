# PRIMARY-WORKER-CONT-SAME-COLUMN-KEYWORD-4 review

Worker: `worker-same-column-keyword`. Base: `826779006f4b183ac8e5190c512f26df884c9394`.

Only this reserved batch is changed. No claim script was run. No runtime, registry, manifest, app, server, or other batch file is changed. Definitions are an integration contribution, not runtime registration.

## All 12 ability blocks reviewed

| Card | :0 AUTO | :1 CONT | :2 ACT |
| --- | --- | --- | --- |
| cfa-4023 Saladada Familia | Existing Forerunner preserved | Unsupported dependency | Existing middle-column draw preserved; locked-source bug |
| cfa-4101 Riding Rookie | Existing Forerunner preserved | Unsupported dependency | Existing middle-column draw preserved; locked-source bug |
| cfa-4614 Robust Stealth Rogue, Terukage | Existing Forerunner preserved | Unsupported dependency | Existing middle-column draw preserved; locked-source bug |
| cfa-5080 Refined Prodigy, Asahiko | Existing Forerunner preserved | Unsupported dependency | Existing middle-column draw preserved; locked-source bug |

The contribution exports exactly the eight already supported sibling definitions, with their exact catalog text and stable IDs. It does not add new compiled coverage. No whole card is fully verified. ACT evidence remains conditional on fixing the shared locked-source rejection defect.

### :0 Forerunner

Optional AUTO when a same-clan unit rides this exact source. The exact source is in Soul at resolution, the controller chooses an open RC, and it is called standing. Batch tests cover each card on both seats, successful calls, different clan, unrelated ridden source, duplicate event, wrong event, source in Drop, wrong controller, wrong actor, stale decision, wrong selected source, illegal call circle, and decline retaining the source in Soul.

### :1 same-column Resist grant: unimplemented

Exact text on all four cards:

> CONT [RC]: All of your other rear-guards in the same column as this unit get "CONT [RC]: Resist".

This is passive and has no GB gate, cost, manual window, or chosen target. The following acceptance matrix is the shared-handler request, **not passing implementation evidence**:

- Success: a face-up source on rear-left grants Resist to its controller's rear-back-left; reverse direction also succeeds. Likewise rear-right and rear-back-right in both directions, for either seat.
- Reject granting to the source itself, a different column, an opponent's same-coordinate unit, or any Vanguard/Guardian/Soul/Hand/Drop unit. Center back-row RC shares a column with VC but there is no other standard center RC, so it cannot grant Resist to that Vanguard.
- Resolve source and recipient by live instance IDs and authoritative board positions, not card IDs or caller-supplied same-column booleans. Two copies must remain independent. A stale instance, missing unit, wrong controller, locked card, or absent circle must not grant a keyword.
- Recompute immediately after either unit moves, changes controller, locks, leaves the field, or is replaced; no turn-duration modifier and no stale inherited Resist on a replacement instance. Removing one grantor must preserve other valid grants.
- The recipient's Resist prevents opponent effect choices, while its controller can still choose it; non-targeting effects continue to apply. Apply these rules in the authoritative reducer as well as the client targeting path, including nested effects. Attack/guard legality is separate from effect targeting.
- Additional Accel circle column geometry is not defined by this contribution and must receive explicit rules review before support.

Why deferred: `registerAbilityDefinitions` accepts `continuousEffects` keyword grants only with `target: "source"` and `keyword: "boost"`. `evaluateContinuousAbilityKeywords` likewise evaluates source-only Boost and has no source/recipient board traversal for Resist. Standalone `keywords: ["resist"]` would wrongly protect the grantor. A new operation or client-only shortcut would violate the assigned scope. Contract tests preserve unsupported state and demonstrate that a cross-unit Resist schema probe is rejected, without registering it.

Primary integration must provide reviewed typed source/recipient parameters, legality validation and recomputation, connect live derived Resist to authoritative target legality, and add success/rejection tests for the matrix above. No speculative handler is shipped here.

### :2 middle-column ACT

Only the controller's center back-row RC, in its main phase, at GB1. Pay CB1 and move the exact source to Soul, then draw one card for that controller. No once-per-turn restriction is printed. The contribution preserves the existing definition and parser-derived circle, GB and cost requirements. Tests resolve every card for both seats; reject wrong circle, no GB, unavailable cost, wrong actor, wrong controller, wrong card, wrong phase/turn, face-down damage, opponent payment UID, stale version and replay, and verify rejected requests leave state unchanged.

**Shared defect:** a source with `locked: true` is accepted by `applyManualAbilityActivation`, pays CB1, enters Soul and draws. Locked cards must not activate this unit ability. Eight executable `test.todo` regression cases (four cards x two seats) assert the desired rejection and unchanged state; they currently fail as expected under TODO. They are not passing tests and must be enabled after primary-session repair. No shared reducer edit is included.

## Validation

Focused command: `node --test ability-batch-PRIMARY-WORKER-CONT-SAME-COLUMN-KEYWORD-4-{act,contract,forerunner}.test.js` (the three paths were passed explicitly). Result: 41 tests, 33 passed, 0 non-TODO failures, 8 failing TODO regressions, 0 skipped; 11.575 seconds. TODO cases are the confirmed locked-source bug, not successful rejection evidence.

Catalog command: `node scripts/audit-ability-catalog.js`: exit 0; 14,022 cards, 17,240 ability blocks, 4,377 compiled, 273 patterns, zero invalid compiled definitions. Batch-only audit: 12 blocks, 8 compiled, 4 unsupported, zero completely compiled cards.

A complete `node --test` run is also being collected; its final result is reported in the PR. Tests do not establish live multiplayer authority or whole-card verification.
