<<<<<<< HEAD
# Card Pipeline Optimization

## Checkpoint

The working files were checkpointed to `C:\Users\yumek\Documents\Codex\vanguard-arena-checkpoint-2026-10-26-sprint.zip` after recovering the truncated `ability-engine.js`. The verified archive omits `.git` and includes the full working source, generated definitions, progress manifest, and regressions.

## Current catalog evidence

The Cardfight Area snapshot contains 14,022 card records and 17,240 parsed ability blocks. Latest progress is in `catalog-progress.json`: 3,500 structured definitions (20.30%), 13,740 unsupported or unreviewed blocks across 144 patterns, zero invalid definitions, and zero fully verified cards. Pattern coverage is not whole-card rules verification.

The earlier estimate of 22 hours cannot be attributed to processing stages from repository evidence: no per-stage time log or persisted history existed. The new progress command records the current stage times and reports unsupported work separately from verified card coverage.

## Bottlenecks and measured work

1. **Repeated full-catalog parsing in catalog regressions.** The 95-test catalog file contained 84 parser call sites. One uncached pass through all 14,022 cards takes about 3.4 seconds. Returning a JSON clone from a parse cache was slower: three passes took about 12.1 seconds versus 9.5 seconds without caching, so that candidate was rejected.
2. **Long regression feedback.** The full suite took 245.62 seconds before safe immutable snapshots. The catalog regression file initially took 16.61 seconds after its calls were switched to snapshots.
3. **Manual interpretation of unsupported abilities.** 13,782 ability blocks remain unsupported or unreviewed. This is the largest completion backlog, but historical time spent cannot be measured from this repository. The optimization is to add reusable exact wording patterns and validate each matching card in batches; ambiguous wording remains unsupported until reviewed.

## Adopted optimizations

- Added `parseCardAbilitiesCached`, a WeakMap cache keyed by the exact card object. It checks card ID, current printed text, and a reviewed-definition revision. Results are deep-frozen snapshots so callers cannot corrupt future results. Adding a reviewed definition invalidates prior snapshots by revision.
- Used the immutable snapshots in catalog-wide regressions and audits. Three complete parser passes measured 9.5 seconds without reuse versus 3.82 seconds with snapshots; the second and third cache-hit passes took about 2.5 milliseconds each.
- The catalog regression file passed 102 tests in 12.79 seconds after audit and regression callers shared snapshots. The latest full suite passed 533/533 in 54.04 seconds. The pre-cache suite passed 492/492 in 245.62 seconds. No validation gates were removed.
- Added `scripts/update-card-progress.js`, `card-verification-manifest.json`, and generated `catalog-progress.json`. These separately track imported/parsed cards, cards with any or all compiled abilities, unsupported blocks, explicit card regression evidence, fully verified cards, audit failures, and measured stage durations. Whole-card verification is never inferred from parser coverage.
- Continued exact-card support with a shared Soul-count CONT power handler. It supports four exact real catalog records, including filtered Raizer/Baromagnes counts, unfiltered Soul counts, exact circle limits, and own-turn restrictions. Perfect Raizer's critical and power are tested together in authoritative attack calculation. Fixed authority lookup for nonzero ability indices; the joining player's Steam Breath Dragon can now contribute its reviewed grade modifier to Stride. Targeted tests prove these paths.
- Added three exact legacy-format attack abilities whose text omits the `AUTO` label. The compiler preserves the parsed source-attack event, exact VC/RC restriction, live Rear-Guard comparison, and battle-only power bonus. Card-level tests cover each catalog card's exact ability ID and confirm another copy cannot satisfy the source-event match.
- Added three exact legacy Vanguard own-attack power abilities with an omitted `AUTO` label and the printed “until the end of the battle” phrasing. They use the existing exact source-attacker event path and VC requirement, with no fabricated condition or resolution choice.
- Extended exact Order Zone placement AUTO support to five additional real cards using the printed “your Order Zone” wording. The trigger parser accepts the phrase only as a card-placement event into the Order Zone, and the effect compiler remains limited to the exact draw-one wording.
- Normalized movement event causes from both `reason` and `discardReason` at the shared event boundary, and preserved both fields when the browser emits movement events. A regression verifies that a Stride-cost discard cannot satisfy an ability requiring the G-Guardian discard cause, while the exact G-Guardian cause matches. The full suite passes 500/500 in 32.01 seconds.
- Added 30 exact ACT definitions for optional source-to-Soul power abilities and 26 exact Rear-Guard CONT definitions requiring the controller turn and Vanguard name, plus the Vanguard grade where printed. The shared CONT predicate reads the current Vanguard name in both browser and trusted worker calculations. These batches add structured exact-text coverage only; they do not imply complete card support.
- Added reviewer-only similarity grouping of unsupported text. It keeps each original text variant and card/ability ID distinct; its groups are candidate queues only and never compile abilities. The largest repeated families still include Legion or Success mechanics absent from the current live-state model, so they remain unreviewed.
- Added exact batches for nine named-Vanguard GC shield abilities, eleven non-clan field power penalties, six named-grade dual-circle power/shield abilities, and fourteen optional clan-rider call abilities. The ride batch adds the rider's clan to structured events, matches the exact ridden source instance on both browser and authority paths, and resolves the call to an open Rear-Guard circle for the entitled player. Focused host/joining-seat tests and the complete 519-test suite pass.

## Ongoing batch plan

1. Run focused engine and worker regressions for each new common mechanic or source/timing rule.
2. Add exact-template compiler coverage for real catalog matches, and report unmatched variants for review. Keep per-card ability IDs and test evidence in the manifest.
3. Run catalog batch tests after a family of abilities is added; run `node --test *.test.js` at milestone boundaries and before reporting completion.
4. Refresh `catalog-progress.json` with `node scripts/update-card-progress.js` after verified batches.
5. Continue the original implementation work: authority transport and private prompts still need app integration; most of the card pool still has unsupported abilities; broader rules timing, card data licensing, multiplayer runtime, and deployment have not been completed or proven.

Two independent read-only pattern audits were run in parallel with implementation; source edits remained serialized to avoid races in shared engine and manifest files.

- Added and verified the exact 24-card RC Generation Break 1 family that triggers on its controller's Vanguard attack, pays by moving the source Rear-Guard to Soul, draws, then grants the Vanguard battle-only power. The full 519-test suite passes.

- Added an exact 24-card named-and-grade-qualified Vanguard attack family. The source unit's optional Soul cost, draw, and battle-only Vanguard power are verified, and the controller's live Vanguard must meet the printed grade and name conditions. Focused joining-player tests cover rejected conditions and the entitled player's private decision. The full 533-test suite passes; this batch contributes 24 exact definitions, not full-card verification.


- Added an exact 17-card named-grade Vanguard-attack AUTO family with source Rear-Guard-to-Soul cost, optional resolution, draw, and Vanguard battle power. The trusted worker checks the owner's live Vanguard grade/name and queues/resolves the prompt for the joining player's seat; grade/name failure is covered by regression tests. The full suite passes 521/521.


- Added the exact 15-card clan-gated Limit Break boost AUTO family. Match setup stamps actual Limit Break 4 metadata from printed ability text; both local and trusted boost events carry the boosted instance's clan and Limit Break marker; the trusted worker prompts and resolves the joining player's Counter-Blast and battle power. Focused checks and the full 524-test suite pass.

## Bounded parallel staging benchmark

`scripts/card-processing-pipeline.js` assigns deterministic catalog shards to a bounded `worker_threads` pool. Workers use the existing parser and reviewed definitions, write isolated shard files under ignored `.card-pipeline/staging/<run-id>/`, and never edit shared engine or card-definition files. The parent checks shard/card identities, ability counts, and output hashes, then atomically updates the run manifest. Resume is refused if the catalog, evidence manifest, engine/definitions, or batch size changed; a valid shard left by an interrupted run is recovered after identity and hash checks. Maximum workers are capped at eight and batch sizes at 2,000.

On this machine (8 logical CPUs, 15.9 GiB RAM, 2.9 GiB free when measured), fresh 14,022-card runs with batch size 1,000 took 5.11 s at one worker, 3.55 s at two, 2.80 s at four, and 2.63 s at eight in the latest measured run. Eight workers processed about 319,600 parsed catalog records per minute; this measures parsing and audit only, **not** verified-card throughput. The pool stops at eight because that is the available logical CPU count; this short benchmark did not establish a better setting above eight. The staged audit reports 1,517 cards with all abilities structurally implemented, 179 evidence-backed ability blocks, zero fully verified cards, zero invalid definitions, and 10,324 cards still awaiting review. The current full suite is recorded separately, and 179 ability blocks have passing regression evidence.
=======
>>>>>>> 814e86112918b4b8a026d461f1cdbbce73c4f944
