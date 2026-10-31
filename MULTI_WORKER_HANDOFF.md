# Vanguard ability work handoff

## Repository and checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local checkout: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Active branch: `codex/standard-ride-deck`
- Local branch checkpoint: `b758f5ea` (`Record Squallmaker Vampir ability evidence`)
- Ability engine baseline recorded in the queue registry: `98a536329d32263eb76b7dc54018aee806a674d8` (stale; refresh before external workers start)
- The active branch is local and has not been pushed. It is 16 commits ahead of `origin/main`; do not push it to the Pages publishing branch as part of worker setup.
- Card source: `assets/cards/catalog-data.js` when present; the catalog loader also supports the committed Git snapshot.

## Central queue and assignment

- Ability evidence registry: `ability-work-registry.jsonl`
- Whole-card batches and dependency links: `ability-work-batches.json`
- Registry summary: `ability-work-registry-manifest.json`
- Queue generator: `scripts/build-ability-work-queue.js`
- Registry generator: `scripts/build-ability-work-registry.js`
- Atomic remote claim: `scripts/claim-ability-batch.js`
- Contribution contract: `ABILITY_CONTRIBUTION_GUIDE.md`

Current catalog snapshot (queue refreshed 2026-10-31): 17,240 ability blocks; 4,291 compiled (24.89%); 12,949 unsupported or unreviewed; 645 fully verified cards. The queue contains 16,595 ability records whose cards are not yet fully verified. It has 84 abilities reserved across 30 primary-session cards and 447 available batches. The batch file is a snapshot: a GitHub claim ref is the live ownership record.

The latest audit reports zero invalid compiled abilities and zero missing client or server effect handlers, but 10,145 abilities still need condition/cost/choice/trigger review and 13,013 lack passing ability-level test evidence. Since the latest code changes, the refreshed queue reports 3,582 stale full-suite evidence records (`validationEvidenceFresh: false`). The last historical full-suite result was 1,481/1,481 in 289.14 seconds at an earlier commit; rerun it after current integrations before claiming fresh suite evidence. Similarity groups are triage candidates only; they do not establish that card effects are equivalent. The deterministic eight-worker catalog pass classified all 14,022 cards in 2.59 seconds; it does not count as semantic verification.

## Current readiness gate (2026-10-31)

**Not ready for new external Work chats yet.** The current feature branch is not published and its queue registry still records the old `98a5363` baseline. The two internal workers attempted remote claims, but Git Credential Manager failed to read GitHub credentials; no claim refs were created. The current internal work is:

- Paid Vanguard-attack AUTO family: `cfa-2637:0`, `cfa-3079:0`, `cfa-4210:0`, `cfa-4216:1`, `cfa-4456:0`, `cfa-4752:0` (coarse batches `ABILITY-0182`, `ABILITY-0198`, `ABILITY-0241`, `ABILITY-0250`, `ABILITY-0261`).
- Quintuplet memory placement AUTO family: `cfa-11526:0`, `cfa-11545:0`, `cfa-11558:0`, `cfa-11607:0`, `cfa-11671:0` (coarse batches `ABILITY-0052`, `ABILITY-0053`, `ABILITY-0055`, `ABILITY-0057`).
- Squallmaker Vampir `cfa-2923:0` has passing focused evidence, but is not a fully verified card.

Tell external workers to start only after the primary session explicitly announces **SAFE TO START EXTERNAL WORKERS** with a published feature-branch SHA, refreshed queue/registry baseline, confirmed claims for the assignments above, and Pages publishing-source check. Local GitHub credentials currently need repair or an authenticated GitHub Desktop push path. A feature-branch push is for collaboration; it is not approval to merge or deploy the site.

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
