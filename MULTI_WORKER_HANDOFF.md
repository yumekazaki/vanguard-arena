# Vanguard Arena ability work handoff

## Repository and current checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local checkout: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Active branch: `codex/standard-ride-deck`
- Current local checkpoint: `865aa63cb2738f7205bd8e1afd19823e00c6e32d` (`Enable modern ability contribution batches`). New work is in progress locally on top of this checkpoint.
- Ability queue and registry baseline: `865aa63cb2738f7205bd8e1afd19823e00c6e32d`.
- The branch is local and has not been confirmed pushed to GitHub. Do not start external workers until it is published and the registry is visible there. The Pages publishing branch is not the collaboration branch.
- Card catalog: `assets/cards/catalog-data.js` when available; `scripts/audit-ability-catalog.js` also supports the committed catalog snapshot.

## Queue and verified progress

- Per-ability registry: `ability-work-registry.jsonl`
- Batch/dependency registry: `ability-work-batches.json`
- Registry counts and baseline: `ability-work-registry-manifest.json`
- Active assignments: `ability-work-assignments.json`
- Queue generator: `scripts/build-ability-work-queue.js`
- Registry generator: `scripts/build-ability-work-registry.js`
- Atomic remote batch claim: `scripts/claim-ability-batch.js`
- Whole-card promotion gate: `scripts/promote-fully-verified-cards.js` (dry-run by default; `--apply` writes evidence only when the complete source-validation suite is fresh).
- Contribution contract: `ABILITY_CONTRIBUTION_GUIDE.md`

Current catalog snapshot: **17,240 abilities; 4,326 compiled (25.09%); 12,914 unsupported or unreviewed; 645 fully verified cards**. The queue contains 16,595 abilities on cards that are not yet fully verified. The registry reserves 117 ability entries across 55 cards, with 446 available batches. The queue reports no missing registered client/server effect handlers, but this does not mean the live website is using the server authority path: online matches still relay ability decisions through the host browser. The latest full suite passed **1,565/1,565**, but its evidence is stale against current source. The latest focused queue, registry, contribution-integrator, and whole-card-gate checks passed **10/10**; rerun the full suite before claiming fresh full-suite validation.

The repository's measured bottleneck is card-specific interpretation and requirement/effect validation, not missing generic client/server handlers. Similarity groups are candidates for review only; they are not proof that different cards have equivalent rules.

## Current primary-session assignments

- `PRIMARY-ACT-DECKTOP-DRAW-POWER` — implemented eight exact ACT abilities; six focused tests pass and per-ability evidence is recorded. It remains reserved until full-card verification and a fresh full suite.
- `PRIMARY-ORDER-SEARCH-NAME-AUTO` — six abilities: `cfa-12653:0` through `cfa-12658:0`. Reserved because live online matches still use host-relayed browser state; do not integrate a separate server-only Order action until the authoritative match path is connected.
- `PRIMARY-GC-INTERCEPT-ABILITY-NEGATION-CONT` — six abilities: `cfa-13119:0` through `cfa-13124:0`. Reserved until the authoritative online path supports Intercept and exact temporary ability suppression.
- `PRIMARY-AUTO-GLITTER-PLACEMENT-TOP-FIVE` — five abilities: `cfa-13520:0`, `cfa-13542:0`, `cfa-13584:0`, `cfa-13608:0`, and `cfa-13621:0`. Integrated locally with authoritative reducer checks for Glitter Vanguard eligibility, exact hand-to-RC source, top-five filtering, both player seats, and source-to-Soul only after a revealed card. Focused suite: 13/13 passed. The browser multiplayer app still uses its host-relay path, so live online verification remains outstanding and these cards are not fully verified.
- `PRIMARY-PERSONA-SHIELD-TICKET-AUTO` — thirteen abilities across six Persona Shield units and the ticket card, including the ride-deck trigger, grade-three attack bonus, and ticket protection restriction; already integrated.
- `PRIMARY-GZONE-STRIDE` — 112 abilities remain reserved for the primary session.

The assignment file reserves the exact card IDs so workers cannot overlap them. Do not reassign an in-progress or reserved item.

## External-worker readiness

**Not ready to start external Work chats yet.** The baseline and assignments are checkpointed locally, but the feature branch has not been confirmed on GitHub. Publish the feature branch first, then refresh the registry baseline and verify that its files are present on GitHub. A claim is real only after GitHub accepts the atomic claim-ref push; a failed push means no claim was made. Do not use a GitHub Desktop window pointed at another worktree.

When the published registry is available, list the unassigned batches with:

```powershell
node -e "const r=require('./ability-work-batches.json'); console.log(r.batches.filter(b=>b.status==='available').slice(0,20).map(b=>b.batchId).join('\n'))"
```

After publishing, list current available IDs from `ability-work-batches.json`; the batch prefix changes with the registry baseline. Confirm a batch is still `available` before claiming it.

## Safe worker setup

After the feature branch and current registry have been pushed:

```powershell
git clone --branch codex/standard-ride-deck https://github.com/yumekazaki/vanguard-arena.git vanguard-arena-worker
Set-Location vanguard-arena-worker
node scripts/claim-ability-batch.js --batch <AVAILABLE-BATCH-ID> --worker work-chat-1
git worktree add ..\vanguard-arena-<AVAILABLE-BATCH-ID> -b work/<AVAILABLE-BATCH-ID> origin/codex/standard-ride-deck
Set-Location ..\vanguard-arena-<AVAILABLE-BATCH-ID>
```

Replace the example batch ID with an available ID from the published registry. If the atomic claim says the ref already exists or authentication/network access fails, stop and do not edit that batch. Work only in the isolated worktree, preserve exact card text and IDs, add focused rejection and success tests, and open a branch/PR for integration. Never push to `main` or the Pages publishing branch directly.

## Integration and verification

Review contributions serially in the primary worktree. Confirm the code matches the card text, validates both player identities and all trigger/cost/zone/timing conditions, and passes focused and adjacent tests. Record ability-level evidence as `tests-passing`; do not mark a card fully verified until all of its printed abilities and relevant rules interactions are covered. After an integration milestone, run the complete regression suite and regenerate the card manifest, queue, registry, and progress report from the resulting source revision.
