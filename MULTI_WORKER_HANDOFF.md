# Vanguard Arena ability work handoff

## Checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local project: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Collaboration branch: `codex/standard-ride-deck` (not the GitHub Pages publishing branch)
- PR #72 merged into `main` at `23d896d3aeed5b0f43cc97601e42c3edbf23071a`. Current local collaboration HEAD is `9af100ea24942028e77d06392d38e68b6b6ca168`, eight commits ahead of `origin/codex/standard-ride-deck` (`76d8a0b86451f6de05d4477b2ca08772925ce9cf`). The worktree contains additional uncommitted source and verification changes. Nothing in this refreshed registry or worktree has been pushed or published to GitHub Pages; workers must wait for an approved, committed baseline.
- Current registry baseline: `9af100ea24942028e77d06392d38e68b6b6ca168` (the checked-out HEAD; local uncommitted source changes are not included in that commit).
- Exact queue: `ability-work-registry.jsonl`; batch status and dependencies: `ability-work-batches.json`; ownership: `ability-work-assignments.json`; counts and baseline: `ability-work-registry-manifest.json`.
- The collaboration branch is separate from GitHub Pages. Check the remote branch before creating worker checkouts; do not overwrite the active local worktree.

## Actual measured status

- Catalog snapshot: 14,022 cards, 17,254 printed ability blocks.
- Current local worktree: 4,765 compiled abilities (27.62%); 12,489 remain unsupported or unreviewed. This is not a card-completion percentage.
- Current verification manifest: 885 cards / 899 abilities meet the strict whole-card gate. Do not infer card completion from parsed or compiled abilities.
- PR #72's merged snapshot reported 4,576 compiled abilities, 809 cards / 818 abilities whole-card verified, and a 2,094/2,094 full suite. Later local work is not part of that push.
- Latest complete local source suite: 3,099/3,099 passing on 2026-11-07 in 488.13 seconds (validation digest `e25c5cd3aa46ca459231d6d8a8c7fd8fd4a8511467dfed069d231176468c2b5d`). Log: `.card-pipeline/full-suite-keyword-family-2026-11-07.tap.log`. Evidence is fresh for the current JavaScript, TypeScript, HTML, and SQL source.
- Current queue/registry snapshot: 16,355 abilities awaiting full verification; 3,100 reserved; 13,255 available; 360 available batches; 122 active assignment records. Queue validation reports 0 failing validation, 0 stale suite evidence, 9,830 missing requirements, and 12,520 missing tests. These are remaining work, not ignored warnings.
- The Order Zone attacked-Rear-Guard-bind family for `cfa-12754:0`, `cfa-12756:0`, and `cfa-12758:0` is integrated locally, with all three cards promoted after focused and full-suite evidence. The rest of batch `ABILITY-76D8A0B8-0057` remains assigned for primary review; the completed slice is recorded separately.
- The latest strict promotion pass verified Enigman Storm (`cfa-260:0` and `cfa-260:1`) against Bushiroad's official BT04/004EN listing and moved those two IDs to the verified assignment list. `cfa-2007:0` remains unsupported; its sibling AUTO still has ability-level evidence only.
- The rules/keyword triage covers all 17,254 parsed ability blocks as AUTO (11,589), ACT (2,255), or CONT (3,410); it separately identifies 473 Order cards and 1,951 Trigger cards, with five trigger labels requiring source review. The literal AUTO cue index has 7,631 single-event matches, 146 ambiguous multi-event texts, and 3,812 unclassified texts. Exact printed-text grouping finds 741 duplicate families across 4,075 ability rows. The latest keyword pass adds 61 literal terms mapped from section 14 and finds at least one such term in 5,538 ability blocks. Counts are review-prioritization only; broad words may match non-keyword text and do not create runtime definitions or verification evidence.
- The latest strict whole-card gate promoted Steam Maiden, Merianna (`cfa-3294:0`) after official-text confirmation and fresh full-suite evidence. Night Sky Eagle (`cfa-2950:0`) remains reserved for official English text confirmation; keyword matching does not complete exact per-card definitions, source checks, tests, or sibling-ability evidence.
- Main-Phase G-Zone ACT timing is honored by the trusted reducer and remote request pre-check; the G-deck inspect menu can expose eligible reviewed ACTs in Main Phase. The normal Stride Step default remains intact. `PRIMARY-GZONE-STRIDE` owns 84 ability rows across 30 affected cards; 18 exact named-Vanguard Imaginary Gift Stride ACTs now have definitions and focused tests, while the batch still has unfinished rows and no new whole-card verification claim. The batch is not a claim that all 84 are Stride abilities or that any of those cards are fully verified.
- The registry builder was corrected so `PRIMARY-GZONE-STRIDE` no longer duplicates the other reserved assignments. The refreshed registry contains 16,355 queued abilities and records fresh full-suite evidence; Night Sky Eagle remains assigned to the primary session for source review.
- Sentinel keyword parsing now treats the printed four-copy reminder as a deck-construction restriction, not an activation choice. All 410 Sentinel CONT records still remain passive, and the catalog regression now confirms none is left with an unreviewed choice classification. Focused Sentinel/catalog checks passed 118/118; the full suite above passed after the fix.
- A hot regression that repeatedly searched the full card catalog for legal/illegal targets now caches the two examples each filter needs. Its expensive assertion fell from 53.20 seconds in the prior full-suite log to 0.45 seconds in the latest full-suite log; all assertions remain and the full suite passes.
- A catalog audit found 140 gauge-related ability IDs on 96 cards. The exact once-per-turn drive-check Equip Gauge AUTO is now implemented for five matching Ancient Dragon cards; four abilities have official text confirmation and passing ability-level evidence, while Babyrex remains pending exact card-text confirmation. Six sibling abilities on those cards remain unsupported, as do the other gauge-related abilities. Do not infer shared behavior from the keyword alone.
- A deterministic text scan found 168 ability blocks mentioning an action "due to" or "because of" an effect; 143 have no structured definition. This is only a triage signal, not one shared mechanic. Within it, 35 AUTO abilities refer to an opponent Rear-Guard moving because of one of your cards: 3 bottom-deck candidates are reserved for provenance work and 32 distinct cards are reserved for per-text/effect audit. Similar phrases do not establish equivalent resolutions.
- PR #72 is merged to `main`; deployment must be checked in the GitHub Pages workflow. The additional local work described here is not pushed. Live browser validation of authoritative online multiplayer remains outstanding; reducer tests do not prove live multiplayer authority.

## Current assignment status

The current registry has **122 active assignment records** and **360 available batches**. The authoritative owners, ability IDs, and dependencies are in `ability-work-assignments.json` and `ability-work-batches.json`; the JSONL registry is the per-ability source. Do not rely on an older static worker table or treat any reserved batch as claimable. `PRIMARY-AUTO-RC-PLACEMENT-OPTIONAL-SOUL-CHARGE-TWO` is a local unpublished primary-session reservation for `cfa-11778:0` and `cfa-11780:0`; their imported text is not officially confirmed. `PRIMARY-BOOST-BATTLE-END-SOUL-DRAW-SUZUME` reserves `cfa-13400:1` locally; its structure is modeled, but its official English text is unconfirmed and it remains blocked from the trusted server path. The Wastelander Dragon attack ability `cfa-12058:2` now has a trusted definition and passing host/joining-seat regression; official English text confirmation remains pending. The full regression suite passed **3,099/3,099** on 2026-11-07 with fresh validation evidence. The current catalog reports **4,765/17,254 compiled abilities**, **12,489 unsupported or unreviewed**, and **885 fully verified cards**.

Only choose a batch currently marked `available` in `ability-work-batches.json`; claim it atomically before implementation. Queue rebuilds keep the existing ID when the exact ability membership and grouping key are unchanged. New or materially regrouped work gets a new ID, so check the current registry before each claim.

## Open worker pull requests (checked 2026-11-04)

- PRs #52 and #53 are draft dependency reviews with unsupported abilities and failing TODO specifications; PR #54 adds review/test material but records 8 unresolved TODO regressions and 4 unsupported abilities. They are not complete card implementations and must not be counted as supported effects.
- PR #1 is a draft audit of event-context identity and stale-battle blockers; PR #2 adds regression evidence for existing passive abilities without compiler coverage or whole-card verification. None is a website deployment. Side-worker branches must be reviewed and integrated on the collaboration branch before live publication.

## Worker setup

For a preassigned batch, use the current registry ID and owner, then create an isolated worktree. Never edit the primary checkout. The current local HEAD and refreshed registry have not been pushed, so external workers must not clone the remote branch until that baseline is published.

```powershell
git clone --branch codex/standard-ride-deck https://github.com/yumekazaki/vanguard-arena.git vanguard-arena-worker
Set-Location vanguard-arena-worker
git worktree add ..\vanguard-arena-<BATCH> -b work/<BATCH> origin/codex/standard-ride-deck
Set-Location ..\vanguard-arena-<BATCH>
```

For any newly selected available batch, first create an atomic GitHub claim from the published collaboration baseline:

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
