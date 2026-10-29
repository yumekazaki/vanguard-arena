# ABILITY-0040 contribution and evidence

Worker: codex-01a1851a
Claim: claims/ABILITY-0040
Claim commit: 48681a0c101835801641300e5ad412931d50b189
Handoff baseline: 72e1aa36faea734545aef8a669bce6bb88d4292f

## Scope

24 exact baseline definitions are exported: 14 all-zone alternate-name CONT abilities and 10 Guardian Circle opponent-grade shield CONT abilities. This adds per-ability regression evidence, not new compiler coverage. The module has no registration side effects and its definitions are identical to their baseline definitions, so existing registration remains compatible. No shared engine, runtime, registry or verification-manifest file is changed.

The other 22 assigned abilities are deferred below. In particular, cfa-11091:0 is not exported: its exact printed alias lacks a comma present in the catalog counterpart. The source is preserved and the discrepancy is covered by a passing diagnostic test. No correction is guessed.

## Validation

- node --test ability-batch-ABILITY-0040.test.js: 47 passing, 0 failures, 0 skipped, 0 TODO.
- Alias cases check exact canonical counterpart names and symmetric name matching, all 11 relevant zone contexts, exact-vs-substring boundaries, instance and printed-name immutability, unrelated cards, and target-name filters.
- Shield cases check exact circle, grade 2/3 boundary and higher grades, unknown/missing grade, own-versus-opponent grade, condition reevaluation without persistent state, and no manual activation or trigger.
- Authoritative guard tests cover all 10 cards from both authenticated seats at opponent grades 2, 3 and 4 (60 successful transitions). Each chooses the exact instance and checks untouched duplicate/opponent copies, request replay, and attempting to reuse the moved source.
- Invalid action cases cover wrong/unseated player, stale state version, unavailable UID, wrong zone, wrong owner/controller, closed defense and absent attack, asserting complete state equality on rejection. Caller-supplied shield/amount fields cannot increase the modifier.
- Standalone catalog audit is run; counts remain 17,240 blocks, 4,174 compiled, 13,066 unsupported and zero invalid compiled definitions.
- node --test --test-concurrency=4: 1,341 passing, zero failures, skipped tests or TODOs. The initial run had 1,340 passes and one metadata determinism failure caused solely by checkout CRLF conversion. The committed LF bytes were restored locally without any Git content change, the metadata test passed 3/3, and the complete suite then passed 1,341/1,341. Tested source commit: fe03471; the subsequent documentation commit records these results only.
- Per-card full verification and live online publication are not claimed. The primary worker must integrate accepted evidence and refresh official manifests serially.

These passive abilities have no costs, active target selection, usage limit, AUTO event timing or duration timer; those activation-only checks are inapplicable. Authoritative guard action permissions, source identity, timing and deduplication are tested where the shield modifier is used.

## Assigned ability disposition

| Ability ID | Contribution | Reason / evidence |
| --- | --- | --- |
| cfa-11078:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11078:1 | Deferred; no status upgrade | Existing compiled AUTO excluded from this passive CONT review; trigger identity, costs, choices, permissions and timing still need separate batch evidence. |
| cfa-11079:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11079:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-1108:0 | Deferred; no status upgrade | Other named rear-guard count and clan-qualified boosted Vanguard require separate exact trigger review. |
| cfa-11080:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11080:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11081:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11081:1 | Deferred; no status upgrade | Existing compiled AUTO excluded from this passive CONT review; trigger identity, costs, choices, permissions and timing still need separate batch evidence. |
| cfa-11082:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11082:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11083:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11083:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11084:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11084:1 | Deferred; no status upgrade | Existing compiled AUTO excluded from this passive CONT review; trigger identity, costs, choices, permissions and timing still need separate batch evidence. |
| cfa-11085:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11085:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11086:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11086:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11087:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11087:1 | Deferred; no status upgrade | Existing compiled AUTO excluded from this passive CONT review; trigger identity, costs, choices, permissions and timing still need separate batch evidence. |
| cfa-11088:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11088:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11089:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11089:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11090:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11090:1 | Deferred; no status upgrade | Existing compiled AUTO excluded from this passive CONT review; trigger identity, costs, choices, permissions and timing still need separate batch evidence. |
| cfa-11091:0 | Deferred; no status upgrade | Literal alias Serene Maiden Lena differs from catalog cfa-9375 name Serene Maiden, Lena; preserve exact text and request source-data review. |
| cfa-11091:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11092:0 | Included; focused tests passing | Exact alias and target-name tests across all zones. |
| cfa-11092:1 | Included; focused tests passing | Exact grade/circle boundary and both-seat authoritative guard tests. |
| cfa-11093:0 | Deferred; no status upgrade | Multi-zone grade and power changes require separate authoritative characteristic review. |
| cfa-11093:1 | Deferred; no status upgrade | Filtered drop-to-soul payment, chosen Vanguard modifier and once-per-turn conditional counter charge need exact handling. |
| cfa-11094:0 | Deferred; no status upgrade | Exclusive clan, composite search provenance and named-set deck/drop search require shared handling. |
| cfa-11095:0 | Deferred; no status upgrade | Fifth-battle threshold, named Vanguard, delayed retirement and draw need exact shared lifecycle support. |
| cfa-11096:0 | Deferred; no status upgrade | Guardian retirement provenance, Soul Blast and open-back-row rested call need exact shared resolution. |
| cfa-11096:1 | Deferred; no status upgrade | Grade-4 Vanguard condition and battle-end source-to-soul power choice need separate exact authoritative review. |
| cfa-11097:0 | Deferred; no status upgrade | Blitz-order count and power-independent hit override with guardian-shield threshold require shared combat handling. |
| cfa-11099:0 | Deferred; no status upgrade | Placement provenance, order history, filtered top-five choices and type-dependent destination require shared resolution. |
| cfa-11099:1 | Deferred; no status upgrade | Opponent open circles in the same column and target-grade threshold require unsupported authoritative counting. |
| cfa-11100:0 | Deferred; no status upgrade | Compiled but unverified normal-order-played condition; not part of the reviewed alias/shield subset. |
| cfa-11100:1 | Deferred; no status upgrade | Existing compiled AUTO excluded from this passive CONT review; trigger identity, costs, choices, permissions and timing still need separate batch evidence. |
| cfa-11101:0 | Deferred; no status upgrade | Named riding provenance, deck/drop non-Regalis order choice and persona ride require shared support. |
| cfa-11101:1 | Deferred; no status upgrade | Named soul binding, paired calls, modifiers and delayed ride-rest require shared ordered handlers. |
| cfa-11103:0 | Deferred; no status upgrade | Existing compiled AUTO excluded from this passive CONT review; trigger identity, costs, choices, permissions and timing still need separate batch evidence. |
| cfa-11103:1 | Deferred; no status upgrade | Existing compiled AUTO excluded from this passive CONT review; trigger identity, costs, choices, permissions and timing still need separate batch evidence. |
