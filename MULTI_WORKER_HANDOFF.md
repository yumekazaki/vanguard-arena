# Vanguard Arena ability work handoff

## Checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local project: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Collaboration branch: `codex/standard-ride-deck` (not the GitHub Pages publishing branch)
- Current integration checkpoint: `b8f8c4d9f` on `codex/standard-ride-deck`, pushed to the shared remote branch. It contains the integrated ability-engine checkpoint `27f9aa5e8` and merges live `main` through `0c382fb3d`, preserving its newer player-portrait, menu, mobile, G-zone, and joined-player fixes. The checkout is clean. This is not a Pages deployment; the main-branch review and CI check are still pending.
- Registry baseline: `320008f138b9fccfc1dea30b2ebc2b542aef927f`
- Exact queue: `ability-work-registry.jsonl`; batch status and dependencies: `ability-work-batches.json`; ownership: `ability-work-assignments.json`; counts and baseline: `ability-work-registry-manifest.json`.
- `codex/standard-ride-deck` is the shared collaboration branch; it is separate from the GitHub Pages publishing branch. Check its latest commit before creating worker checkouts.

## Actual measured status

- Catalog snapshot: 14,022 cards, 17,254 printed ability blocks.
- 4,576 abilities have compiled definitions (26.52%); 12,678 remain unsupported or unreviewed. This is not a card-completion percentage.
- 803 cards and 812 abilities meet the strict whole-card verification gate. Do not infer card completion from parsed or compiled abilities.
- Latest recorded passing complete suite: 2,054/2,054 on 2026-11-04 00:14 UTC; its evidence is stale for current source changes. A full pre-publish run on 2026-11-04 completed 2,062/2,063 tests; the sole failure was an outdated work-queue expectation for `cfa-10769:0`, which the exact trusted reducer definition now accepts. The expectation was corrected and the related focused suite passed 6/6. The full suite has not yet been rerun after that correction, so current evidence is not marked fresh.
- Current queue/registry snapshot (generated 2026-11-04): 16,442 queued abilities; 1,130 reserved; 15,312 available; 414 available batches; 58 active assignment records (54 reserved, 4 in progress). Queue validation reports 0 invalid definitions, 9,961 missing requirements, 12,722 missing tests, and 3,720 stale suite records. These are remaining work, not ignored warnings.
- A strict whole-card promotion pass verified one additional single-ability card (`cfa-9042`), bringing the totals above to 803 cards and 812 abilities. The incomplete sibling assignment on `cfa-9115` remains reserved.
- Main-Phase G-Zone ACT timing is honored by the trusted reducer and remote request pre-check; the G-deck inspect menu can expose eligible reviewed ACTs in Main Phase. The normal Stride Step default remains intact. `PRIMARY-GZONE-STRIDE` owns 84 ability rows across 30 affected cards; 18 exact named-Vanguard Imaginary Gift Stride ACTs now have definitions and focused tests, while the batch still has unfinished rows and no new whole-card verification claim. The batch is not a claim that all 84 are Stride abilities or that any of those cards are fully verified.
- The registry builder was corrected so `PRIMARY-GZONE-STRIDE` no longer duplicates the other reserved assignments. A direct consistency check confirmed all 16,442 queued abilities appear in exactly one batch.
- Sentinel keyword parsing now treats the printed four-copy reminder as a deck-construction restriction, not an activation choice. All 410 Sentinel CONT records still remain passive, and the catalog regression now confirms none is left with an unreviewed choice classification. Focused Sentinel/catalog checks passed 118/118; the full suite above passed after the fix.
- A hot regression that repeatedly searched the full card catalog for legal/illegal targets now caches the two examples each filter needs. Its expensive assertion fell from 53.20 seconds in the prior full-suite log to 0.45 seconds in the latest full-suite log; all assertions remain and the full suite passes.
- A read-only catalog audit found 140 gauge-related ability IDs on 96 cards. All 140 remain unreviewed; 10 are already reserved. The equip-gauge family lacks an authoritative attached-card model and must not be reported as implemented based on the catalog classification.
- The integration checkpoint is pushed to the collaboration branch but not deployed. Live authoritative online multiplayer validation remains outstanding. Browser matches still use a host-relay path for some actions; reducer tests do not prove live multiplayer authority.

## Current assignment status

The current registry has 58 active assignment records: 54 reserved and 4 in progress. The authoritative owners and IDs are in `ability-work-assignments.json`; generated status and expanded whole-card scope are in `ability-work-batches.json`. Do not rely on the older static worker table or treat any reserved batch as claimable.

These four batches are in progress and must not be assigned again:

| Batch | Owner | Current scope |
|---|---|---|
| `PRIMARY-ACT-HAND-CREST-GRADE-3-NAME-SEARCH-5` | `primary-session` | Five ACTs have definitions and ability-level tests; whole-card evidence remains incomplete. |
| `PRIMARY-AUTO-GC-CLAN-PROTECT-3` | `worker-gc-protect` | Three exact Guardian Circle abilities; contribution and focused tests are present, pending primary review and whole-card evidence. |
| `PRIMARY-AUTO-RC-GRADE3-DISCARD-SEARCH-3` | `worker-rc-search` | Three assigned abilities remain unreviewed; no trusted instance definitions recorded. |
| `PRIMARY-AUTO-VC-STRIDE-POWER-3` | `primary-session/stride-power-audit` | Three abilities have tests-passing evidence; three sibling abilities remain unsupported. |

Only choose a newly generated batch currently marked `available` in `ability-work-batches.json`; IDs change when the queue is rebuilt. Claim it atomically before implementation.

## Open worker pull requests (checked 2026-11-04)

- PRs #52 and #53 are draft dependency reviews with unsupported abilities and failing TODO specifications; PR #54 adds review/test material but records 8 unresolved TODO regressions and 4 unsupported abilities. They are not complete card implementations and must not be counted as supported effects.
- PR #1 is a draft audit of event-context identity and stale-battle blockers; PR #2 adds regression evidence for existing passive abilities without compiler coverage or whole-card verification. None is a website deployment. Side-worker branches must be reviewed and integrated on the collaboration branch before live publication.

## Worker setup

For a preassigned batch, replace `<BATCH>` and `<WORKER>` with the exact table values. Clone the collaboration branch, then create an isolated worktree. Never edit the primary checkout.

```powershell
git clone --branch codex/standard-ride-deck https://github.com/yumekazaki/vanguard-arena.git vanguard-arena-worker
Set-Location vanguard-arena-worker
git worktree add ..\vanguard-arena-<BATCH> -b work/<BATCH> origin/codex/standard-ride-deck
Set-Location ..\vanguard-arena-<BATCH>
```

For any newly selected available batch, first create an atomic GitHub claim:

```powershell
node scripts/claim-ability-batch.js --batch <AVAILABLE-BATCH-ID> --worker <unique-worker-id>
```

The first successful non-forced push to `refs/heads/claims/<batchId>` owns the batch. If claiming fails, stop; do not edit it. The three preassigned batches above are already owned in the registry and must not be re-claimed.

## Contribution rules

- Follow `ABILITY_CONTRIBUTION_GUIDE.md`; preserve exact source text and stable IDs (`<cardId>:<printed-ability-index>`).
- Submit definitions only for assigned IDs in a uniquely named `ability-contributions/batch-<BATCH>.js` file, plus uniquely named focused tests. Do not edit shared engine, app, server, queue, or manifest files without primary-session coordination.
- Test positive and negative cases for exact event/source, location, timing, costs, target legality, controller/owner, duplicate requests, both seats where applicable, and effect expiry/order.
- Unknown or ambiguous text stays unsupported and is reported for review. Never claim a card fully verified from a pattern test.
- Push a feature branch and open a PR targeting `codex/standard-ride-deck`; do not push directly to `main` or the Pages branch. Primary integration is serial after review.

## Primary-session reserved work

Check `ability-work-assignments.json` before proposing or changing any batch. It is the authority for reserved, in-progress, and completed ownership. Shared integration and whole-card verification remain with the primary session. The strict promotion dry run after the latest suite found zero newly eligible cards; unresolved siblings and live-gameplay evidence remain blockers.
