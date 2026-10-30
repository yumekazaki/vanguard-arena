# Vanguard ability work handoff

## Repository and checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local checkout: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Active branch: `codex/standard-ride-deck`
- Local branch checkpoint: `98a536329d32263eb76b7dc54018aee806a674d8`
- Ability engine baseline used by the registry: `98a536329d32263eb76b7dc54018aee806a674d8`
- The active branch is local and has not been pushed. External Work chats cannot use this checkpoint until the branch is pushed.
- Card source: `assets/cards/catalog-data.js` when present; the catalog loader also supports the committed Git snapshot.

## Central queue and assignment

- Ability evidence registry: `ability-work-registry.jsonl`
- Whole-card batches and dependency links: `ability-work-batches.json`
- Registry summary: `ability-work-registry-manifest.json`
- Queue generator: `scripts/build-ability-work-queue.js`
- Registry generator: `scripts/build-ability-work-registry.js`
- Atomic remote claim: `scripts/claim-ability-batch.js`
- Contribution contract: `ABILITY_CONTRIBUTION_GUIDE.md`

Current catalog snapshot: 17,240 ability blocks; 4,290 compiled (24.88%); 12,950 unsupported or unreviewed; 645 fully verified cards. The latest full regression suite passed 1,481/1,481 in 289.14 seconds, with fresh source evidence. The queue contains 16,595 ability records whose cards are not yet fully verified. It has 84 abilities reserved across 30 primary-session cards and 447 available batches. The batch file is a snapshot: a GitHub claim ref is the live ownership record.

The latest audit reports zero invalid compiled abilities and zero missing client or server effect handlers. Similarity groups are triage candidates only; they do not establish that card effects are equivalent. The deterministic eight-worker catalog pass classified all 14,022 cards in 2.59 seconds; it does not count as semantic verification.

## Safe worker setup

Do not begin from the original checkout. After `codex/standard-ride-deck` has been pushed, clone that branch into a new directory and claim a currently unclaimed batch:

```powershell
git clone --branch codex/standard-ride-deck https://github.com/yumekazaki/vanguard-arena.git vanguard-arena-worker
Set-Location vanguard-arena-worker
node scripts/claim-ability-batch.js --batch ABILITY-0001 --worker work-chat-1
git worktree add ..\vanguard-arena-ABILITY-0001 -b work/ABILITY-0001 origin/codex/standard-ride-deck
Set-Location ..\vanguard-arena-ABILITY-0001
```

Use any available `ABILITY-NNNN` batch, but first run the atomic claim command. If it says the claim already exists, choose another batch. Never edit the primary checkout. Do not edit a card outside the claimed batch. Do not change shared runtime files without primary-session coordination.

## Integration and verification

Workers add unique contribution and test files, preserve exact text and IDs, and follow `ABILITY_CONTRIBUTION_GUIDE.md`. Run focused tests and catalog validation before proposing integration. Use `tests-passing` only for ability-level evidence; a whole card stays unverified until every printed ability and relevant rule interaction is covered. Integrate accepted changes serially, run the full regression suite, then refresh the manifest, queue, and registry. Do not push directly to `main` or mark unsupported text as implemented.
