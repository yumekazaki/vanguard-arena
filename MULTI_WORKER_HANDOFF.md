# Vanguard multi-worker handoff

## Project and baseline

- Repository: `https://github.com/yumekazaki/vanguard-arena`
- Handoff branch: `handoff/engine-baseline-20261029`
- Source baseline commit: `272b4f405ee96af64a30abec3b49f286479e7549`
- Working checkout used for the checkpoint: `C:\Users\yumek\Documents\Codex\2026-10-22\i-n-2\work\vanguard-arena`
- Catalog: `assets/cards/catalog-data.js` in Git. It is absent from the local sparse checkout; the catalog loader reads it from the commit.
- The handoff branch preserves the existing 149-file project checkpoint. The zero-byte stray `x.id` remains in the original checkout and is not part of the commit.
- Do not base work on GitHub `main`; it is still the older `c7b303cd60718567ef0fdb1adea540316186b13d` revision. Work from the handoff branch.

## Registry and ownership

- Full per-ability registry: `ability-work-registry.jsonl`
- Batch assignments and dependencies: `ability-work-batches.json`
- Registry generation/evidence summary: `ability-work-registry-manifest.json`
- Schema and review contract: `ABILITY_CONTRIBUTION_GUIDE.md`
- Atomic claim command: `scripts/claim-ability-batch.js`
- Registry builder: `scripts/build-ability-work-registry.js`

The registry contains 17,239 unique outstanding ability IDs in 474 disjoint batches. Of these, 84 abilities on 30 cards are reserved to the primary session as `PRIMARY-GZONE-STRIDE`; 17,155 abilities in 473 batches are available. A batch keeps all outstanding abilities on each card together, includes dependency IDs, and records implementation and verification state. Never infer full-card verification from a passing family test.

Available batch IDs are `ABILITY-0001` through `ABILITY-0473`. The first ready batches are `ABILITY-0001` through `ABILITY-0005`; each contains 25 whole cards. See `ability-work-batches.json` for the exact card IDs, ability IDs, status, and dependencies before claiming.

The primary session owns all shared engine, runtime, multiplayer, manifest, and queue-builder files. It is currently reserved for the G-zone Stride ability family listed in the registry. The current catalog baseline is 17,240 ability blocks, 4,174 compiled, 13,066 unsupported or unreviewed, and 1 fully verified card.

## Atomic claim protocol

The worker creates `refs/heads/claims/<batchId>` on GitHub with a distinct claim commit. The first non-forced create wins; concurrent attempts to create the same ref fail. The test `scripts/ability-work-registry.test.js` races two compare-and-create operations against a local bare Git repository; the production claim command uses Git's non-forced remote ref creation. The registry's availability field is the initial snapshot; the claim ref is the live ownership record.

## Worker setup commands

Run these from a fresh directory or an isolated Git worktree. Never use the primary session's active checkout.

```powershell
git clone --branch handoff/engine-baseline-20261029 https://github.com/yumekazaki/vanguard-arena.git vanguard-arena-worker
Set-Location vanguard-arena-worker
node scripts/claim-ability-batch.js --batch ABILITY-0001 --worker work-chat-1
git worktree add ..\vanguard-arena-ABILITY-0001 -b work/ABILITY-0001 origin/handoff/engine-baseline-20261029
Set-Location ..\vanguard-arena-ABILITY-0001
```

Replace the batch ID and worker ID with the desired values. If the claim command reports that the ref already exists, do not work on that batch; choose another available ID. The claim record can be inspected with:

```powershell
git fetch origin claims/ABILITY-0001
git show FETCH_HEAD:claim.json
```

## Contribution and verification

For the claimed batch, add a unique `ability-contributions/batch-<BATCH-ID>.js` file exporting only that batch's reviewed definitions, plus uniquely named regression tests. Use the schema, existing effect-handler interfaces, and test requirements in `ABILITY_CONTRIBUTION_GUIDE.md`. Shared core changes require primary-session coordination. Unsupported or unclear text stays unsupported and is documented; do not invent behavior or edit the shared verification manifest.

Run the focused tests and catalog audit from the worker worktree. The handoff baseline full suite passed **1,294/1,294** on 2026-10-29. After source changes, that evidence is stale until a full suite passes again.

## Pull request integration

Commit and push only the worker worktree branch. Open a PR with base `handoff/engine-baseline-20261029` and head `work/<BATCH-ID>`. Include the claimed batch ID and ability IDs in the PR description. Do not push to `main` or merge directly.

The primary session reviews each PR, checks for IDs outside the claimed batch, validates exact card text and rules behavior, runs tests, integrates accepted definitions into the runtime registry, and refreshes the assignment/evidence manifests. Batches integrate serially. The claim ref is deleted only after integration or explicit abandonment.

## Current limitations

The full catalog is not complete: 13,066 abilities remain unsupported or unreviewed. The live room UI still uses the host relay; the canonical Supabase worker exists but is not wired into live match initialization/action synchronization. Worker contributions are reviewed modules until the primary session integrates them into the runtime. This handoff does not imply publication or deployment.

## Latest local checkpoint (2026-10-29)

- Active working branch: `work/primary-engine-vanguard-20261028-resume`, with local checkpoints `b7d73d86cf2e52b8638f76c86fdb1ccaf3175dbf` (engine, tests, manifests) and `797498019614d8d404a019057a33914568930d42` (contribution sources), based on `182a558b2170107b3849072406e48d75a3302d39`.
- The local checkout now includes the two exact ACT definitions from batch `ABILITY-0003`, the exact own-attack AUTO `cfa-10097:0` from batch `ABILITY-0004`, and a shared reducer gate that prevents mandatory AUTO abilities from entering the prompt queue when their structured costs cannot be paid. Ability-level evidence is recorded for these three IDs and the `cfa-10047:0` ride trigger; none of these records marks a whole card fully verified.
- Latest full suite: 1,304/1,304 passed after the mandatory-AUTO-cost reducer change; the source validation digest is in `card-verification-manifest.json` and `catalog-progress.json`.
- The local catalog currently reports 4,177/17,240 abilities compiled (24.23%) and 13,063 unsupported or unreviewed; one card is fully verified. See `catalog-progress.json` for the digest and current suite evidence.
- The current GitHub checkout has no Git credentials available to the atomic claim script. Claims for batches 0002 and 0003 therefore were not created remotely. Do not treat local batch assignments as cross-session reservations until the GitHub claim refs exist. At the last read, only `claims/ABILITY-0001` and `claims/ABILITY-0040` existed remotely.
- These local changes are uncommitted and unpublished. Continue only in the named resume worktree; do not assume they are present on GitHub or the live site.
