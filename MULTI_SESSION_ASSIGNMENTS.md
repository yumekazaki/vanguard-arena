# Multi-session work registry

Updated: 2026-10-29

## Repository checkpoint

- Repository: `https://github.com/yumekazaki/vanguard-arena.git`
- Local checkout: `C:\Users\yumek\Documents\Codex\2026-10-22\i-n-2\work\vanguard-arena`
- Handoff branch: `handoff/engine-baseline-20261029`, created from the prior `main`/`origin/main` tracking point `c7b303cd` (`pb`).
- The original uncommitted project changes are preserved on that branch; the zero-byte stray `x.id` is left untouched and excluded from the checkpoint.
- The branch has not yet been pushed, so none of these local changes are available through GitHub yet.
- Card catalog source: `assets/cards/catalog-data.js`; the file is absent from this checkout, so the audit loader currently reads the committed `HEAD` copy.

## Ownership and collision boundary

The primary session owns the end-to-end ability-engine objective and all current uncommitted work. Keep these shared files locked to that session until its checkpoint is committed and pushed:

- `app.js`, `ability-engine.js`, `ability-definitions.js`, `ability-server-reducer.js`
- `supabase/functions/match-worker/**`
- `card-verification-manifest.json`, `catalog-progress.json`
- `scripts/build-ability-work-queue.js`, `scripts/unsupported-ability-patterns.js`

No individual ability ID batch is currently running in a separate process. Catalog snapshot: 17,240 ability blocks; 4,174 compiled; 13,066 unsupported/unreviewed; 1 fully verified card. The main session is continuing the broad database/engine objective, with G-zone ACT/Stride and player-specific authoritative resolution reserved from duplicate implementation.

## Batch assignments

The post-baseline generated files `ability-work-registry.jsonl`, `ability-work-batches.json`, and `ability-work-registry-manifest.json` are the authoritative assignment snapshot. They cover every ability still outstanding after the single fully verified card. Each ability on a card is assigned to the same batch. `PRIMARY-GZONE-STRIDE` and all abilities on those 30 cards are reserved to the primary session; all other batches are available by atomic remote claim.

The claim lock is the GitHub ref `claims/<batchId>`. `scripts/claim-ability-batch.js` creates a distinct claim commit and pushes the ref without force. GitHub's atomic ref creation permits one worker to win; competing creation attempts are rejected. The test uses concurrent compare-and-create refs against a local bare Git repo.

## Integration policy

1. Do not start implementation branches from the current GitHub `main`: it lacks the local changes in the handoff branch.
2. After the handoff branch is pushed, create one branch/worktree per claimed batch from that exact branch tip.
3. Keep each worker's file scope disjoint. Workers submit a branch/PR; no direct writes to `main` and no cherry-picking unreviewed changes.
4. Before merge, the primary session checks changed-file overlap, reviews the diff, runs focused tests, then updates the work queue and full-suite evidence as appropriate.
5. An audit report or passing pattern test alone never marks an ability or whole card fully verified.
