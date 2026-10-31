# Vanguard Arena ability work handoff

## Checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local project: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Collaboration branch: `codex/standard-ride-deck` (not the GitHub Pages publishing branch)
- Local checkpoint: `3d1561cc` plus uncommitted event-identity and registry updates. These local changes have not been pushed; do not publish this checkout yet.
- The local branch currently tracks `origin/main` by mistake. Do not use GitHub Desktop's Push button until its upstream is corrected and the integration checkpoint is reviewed.
- Registry baseline: `c00865569ef43a5915401e313ef036c25dc963b2`
- Exact queue: `ability-work-registry.jsonl`; batch status and dependencies: `ability-work-batches.json`; ownership: `ability-work-assignments.json`; counts and baseline: `ability-work-registry-manifest.json`.
- `codex/standard-ride-deck` is the shared collaboration branch; it is separate from the GitHub Pages publishing branch. Check its latest commit before creating worker checkouts.

## Actual measured status

- Catalog snapshot: 14,022 cards, 17,240 printed ability blocks.
- 4,377 abilities compiled (25.39%); 12,863 remain unsupported or unreviewed.
- 647 cards meet the strict whole-card verification gate. Do not infer card completion from parsed or compiled abilities.
- Latest complete source suite: `node --test`, 1,642/1,642 passing in 350.39 seconds on 2026-10-31; evidence is fresh for the current source checkpoint. Queue/registry focused tests pass 9/9.
- Latest concurrent catalog pipeline: eight workers, 57 shards, 2,892.7 ms; it classified existing records and verified zero new cards. This is parsing throughput, not verification throughput.
- Current registry: 16,593 queued abilities; 275 reserved; 455 available batches; 21 active assignments (14 primary-session reservations and 7 claimed in-progress batches). Queue evidence is fresh. The strict card gate remains at 647 verified cards.
- Live authoritative online multiplayer validation remains outstanding. Browser matches still use a host-relay path for some actions; reducer tests do not prove live multiplayer authority.

## Preassigned independent batches

These exact batches are already reserved in the registry. Each worker must use the matching worker ID. Do not run the claim script for a reserved batch; it correctly accepts only `available` batches.

| Batch | Worker ID | Scope |
|---|---|---|
| `PRIMARY-WORKER-CONT-DIVINE-SKILL-ATTACK-LOCK-6` | `worker-divine-skill-attack-lock` | 6 cards, 12 abilities; preserve the separate own-attack AUTO on each card while reviewing the Divine Skill CONT. |
| `PRIMARY-WORKER-CONT-SOUL-CLAN-COUNT-6-4` | `worker-soul-clan-count` | 4 cards, 4 abilities; clan-specific soul-count CONT power. |
| `PRIMARY-WORKER-CONT-SAME-COLUMN-KEYWORD-4` | `worker-same-column-keyword` | 4 cards, 12 abilities; same-column keyword CONT plus every sibling ability on those cards. |

All three reserved batches own every ability on their listed cards, including sibling abilities. Keep the card unverified unless every printed ability passes the complete card gate.

Other batch IDs may be selected only from entries whose `status` is `available` in `ability-work-batches.json`. The first available candidate batch IDs at this checkpoint are `CANDIDATE-C0086556-0004` through `CANDIDATE-C0086556-0013`; batches 0001–0003 are already claimed. Always confirm availability on the collaboration branch before assigning a batch.

`CANDIDATE-C0086556-0014` is also claimed by `codex-soul-name-variants`; it owns all eight abilities on `cfa-11767`, `cfa-11769`, `cfa-242`, and `cfa-4411`, focusing on four Soul-name CONTs. The next available candidate ID skips to `CANDIDATE-C0086556-0015`.

## Open worker pull requests

- PR #1 is a draft audit of event-context identity and stale-battle blockers; it adds no production ability definitions and is not integrated.
- PR #2 adds focused regression evidence for 24 passive abilities, but has no compiler coverage or whole-card verification and is not integrated. Neither PR is a website deployment. Review and integrate contributions only after rebasing them onto the current collaboration branch and rerunning relevant tests.

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

The other 14 reserved assignments in `ability-work-assignments.json` belong to `primary-session`. Check that file before proposing or changing any batch. Shared integration and whole-card verification remain with the primary session.
