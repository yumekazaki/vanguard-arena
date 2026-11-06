# Vanguard Arena ability work handoff

## Checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local project: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Collaboration branch: `codex/standard-ride-deck` (not the GitHub Pages publishing branch)
- PR #72 merged into `main` at `23d896d3aeed5b0f43cc97601e42c3edbf23071a`; the merged source head is `76d8a0b86451f6de05d4477b2ca08772925ce9cf`. The current local worktree is based on that source head and has additional uncommitted ability-engine, database, verification, and registry work. Do not treat local changes as published.
- Current registry baseline: `76d8a0b86451f6de05d4477b2ca08772925ce9cf`.
- Exact queue: `ability-work-registry.jsonl`; batch status and dependencies: `ability-work-batches.json`; ownership: `ability-work-assignments.json`; counts and baseline: `ability-work-registry-manifest.json`.
- The collaboration branch is separate from GitHub Pages. Check the remote branch before creating worker checkouts; do not overwrite the active local worktree.

## Actual measured status

- Catalog snapshot: 14,022 cards, 17,254 printed ability blocks.
- Current local worktree: 4,589 compiled abilities (26.6%); 12,665 remain unsupported or unreviewed. This is not a card-completion percentage.
- Current local verification manifest: 818 cards / 830 abilities meet the strict whole-card gate. Do not infer card completion from parsed or compiled abilities.
- PR #72's merged snapshot reported 4,576 compiled abilities, 809 cards / 818 abilities whole-card verified, and a 2,094/2,094 full suite. Later local work is not part of that push.
- Latest complete local source suite: `node --test --test-concurrency=4 --test-reporter=tap`, 2,158/2,158 passing in 490.52 seconds on 2026-11-04 10:37 UTC. Validation digest: `0559b2e0e2e429d33462122ba95092d15df224aa7dd9da4c449748bdb8fffb69`. Log: `.card-pipeline/full-suite-card-promotion.tap`.
- Current queue/registry snapshot: 16,424 remaining abilities; 1,360 reserved; 15,064 available; 407 available batches; 66 active assignment records (55 reserved, 11 in progress). Queue validation reports 0 invalid definitions, 9,936 missing requirements, 12,709 missing tests, and 0 stale-suite records. These are remaining work, not ignored warnings.
- A strict promotion pass after the latest suite promoted 9 additional cards / 12 abilities in the local worktree. Their sibling batch assignments were reconciled so completed IDs are not offered again.
- Main-Phase G-Zone ACT timing is honored by the trusted reducer and remote request pre-check; the G-deck inspect menu can expose eligible reviewed ACTs in Main Phase. The normal Stride Step default remains intact. `PRIMARY-GZONE-STRIDE` owns 84 ability rows across 30 affected cards; 18 exact named-Vanguard Imaginary Gift Stride ACTs now have definitions and focused tests, while the batch still has unfinished rows and no new whole-card verification claim. The batch is not a claim that all 84 are Stride abilities or that any of those cards are fully verified.
- The registry builder was corrected so `PRIMARY-GZONE-STRIDE` no longer duplicates the other reserved assignments. A direct consistency check confirmed all 16,424 currently queued abilities appear in exactly one batch.
- Sentinel keyword parsing now treats the printed four-copy reminder as a deck-construction restriction, not an activation choice. All 410 Sentinel CONT records still remain passive, and the catalog regression now confirms none is left with an unreviewed choice classification. Focused Sentinel/catalog checks passed 118/118; the full suite above passed after the fix.
- A hot regression that repeatedly searched the full card catalog for legal/illegal targets now caches the two examples each filter needs. Its expensive assertion fell from 53.20 seconds in the prior full-suite log to 0.45 seconds in the latest full-suite log; all assertions remain and the full suite passes.
- A read-only catalog audit found 140 gauge-related ability IDs on 96 cards. All 140 remain unreviewed; 10 are already reserved. The equip-gauge family lacks an authoritative attached-card model and must not be reported as implemented based on the catalog classification.
- A deterministic text scan found 168 ability blocks mentioning an action "due to" or "because of" an effect; 143 have no structured definition. This is only a triage signal, not one shared mechanic. Within it, 35 AUTO abilities refer to an opponent Rear-Guard moving because of one of your cards: 3 bottom-deck candidates are reserved for provenance work and 32 distinct cards are reserved for per-text/effect audit. Similar phrases do not establish equivalent resolutions.
- PR #72 is merged to `main`; deployment must be checked in the GitHub Pages workflow. The additional local work described here is not pushed. Live browser validation of authoritative online multiplayer remains outstanding; reducer tests do not prove live multiplayer authority.

## Current assignment status

The current registry has 66 active assignment records: 55 reserved and 11 in progress. The authoritative owners and IDs are in `ability-work-assignments.json`; generated status and expanded whole-card scope are in `ability-work-batches.json`. Do not rely on the older static worker table or treat any reserved batch as claimable.

These eleven batches are in progress and must not be assigned again:

| Batch | Owner | Current scope |
|---|---|---|
| `PRIMARY-ACT-HAND-CREST-GRADE-3-NAME-SEARCH-5` | `primary-session` | Five ACTs have definitions and ability-level tests; whole-card evidence remains incomplete. |
| `PRIMARY-AUTO-GC-CLAN-PROTECT-3` | `worker-gc-protect` | Three exact Guardian Circle abilities; contribution and focused tests are present, pending primary review and whole-card evidence. |
| `PRIMARY-AUTO-RC-GRADE3-DISCARD-SEARCH-3` | `worker-rc-search` | Three assigned abilities remain unreviewed; no trusted instance definitions recorded. |
| `ABILITY-320008F1-0022` | `primary-session/review-and-integration` | 40 IDs remain assigned; the exact `cfa-10584:0` contribution is integrated and the rest need review. |
| `ABILITY-320008F1-0023` | `primary-session/review-and-integration` | 38 IDs remain assigned; the exact `cfa-10602:0` contribution is integrated and the rest need review. |
| `ABILITY-320008F1-0025` | `agent-batch-0025` | 29 IDs remain; `cfa-10680:0` and `cfa-10681:0` were promoted and removed from the open batch. |
| `ABILITY-320008F1-0031` | `codex-batch-0031` | 33 IDs remain; `cfa-10867:0` was promoted and removed from the open batch. |
| `ABILITY-320008F1-0032` | `codex-batch-0032` | 34 IDs remain; three integrated ability-level candidates still need whole-card verification. Opponent-bottom movement candidates remain unsupported until the event matcher checks bottom-placement and effect-reason provenance. |
| `PRIMARY-AUTO-REARGUARD-BOTTOM-PROVENANCE-3` | `codex-batch-0032` | Three exact candidates reserved for event-provenance work; definitions remain unsupported pending exact official text confirmation. |
| `PRIMARY-AUTO-OPPONENT-REARGUARD-EFFECT-MOVE-32` | `codex-review-0026` | 32 exact uncompiled AUTO abilities in the opponent Rear-Guard movement-by-effect family; audit effects separately and coordinate around the shared provenance work. |
| `PRIMARY-AUTO-DISCARD-STRIDE-DRAW-3` | `codex-batch-0031` | Three exact abilities depend on a reducer-owned G-Guard transition that correlates the exact discard cost to the named G-card call. |

Only choose a batch currently marked `available` in `ability-work-batches.json`; claim it atomically before implementation. Queue rebuilds keep the existing ID when the exact ability membership and grouping key are unchanged. New or materially regrouped work gets a new ID, so check the current registry before each claim.

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

The first successful non-forced push to `refs/heads/claims/<batchId>` owns the batch. If claiming fails, stop; do not edit it. The eleven in-progress batches above are already owned in the registry and must not be re-claimed. The Music-order batch is reserved to the primary session pending the shared Order play handler.

## Contribution rules

- Follow `ABILITY_CONTRIBUTION_GUIDE.md`; preserve exact source text and stable IDs (`<cardId>:<printed-ability-index>`).
- Submit definitions only for assigned IDs in a uniquely named `ability-contributions/batch-<BATCH>.js` file, plus uniquely named focused tests. Do not edit shared engine, app, server, queue, or manifest files without primary-session coordination.
- Test positive and negative cases for exact event/source, location, timing, costs, target legality, controller/owner, duplicate requests, both seats where applicable, and effect expiry/order.
- Unknown or ambiguous text stays unsupported and is reported for review. Never claim a card fully verified from a pattern test.
- Push a feature branch and open a PR targeting `codex/standard-ride-deck`; do not push directly to `main` or the Pages branch. Primary integration is serial after review.

## Primary-session reserved work

Check `ability-work-assignments.json` before proposing or changing any batch. It is the authority for reserved, in-progress, and completed ownership. Shared integration and whole-card verification remain with the primary session. The strict promotion dry run after the latest suite found zero newly eligible cards; unresolved siblings and live-gameplay evidence remain blockers.
