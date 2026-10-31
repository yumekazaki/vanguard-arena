# Vanguard Arena ability work handoff

## Repository and current checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local checkout: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Active branch: `codex/standard-ride-deck`
- Implementation checkpoint before this handoff-document update: `fa7648c44053ebd6068abe0fbf1a57e066353178` (`Reserve Persona Shield ability batch`); the latest branch commit also contains this coordination document.
- Ability queue and registry source baseline: `a334c44bdc196655303d21d0ec521990ec369c2d`
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
- Contribution contract: `ABILITY_CONTRIBUTION_GUIDE.md`

Current catalog snapshot: **17,240 abilities; 4,314 compiled (25.02%); 12,926 unsupported or unreviewed; 645 fully verified cards**. The queue contains 16,595 abilities on cards that are not yet fully verified. The registry reserves 124 abilities across 56 cards, with 446 unassigned batches. There are no invalid compiled definitions or missing client/server effect handlers. The latest targeted integrated run passed **431/431** engine, catalog-audit, queue, and ACT-family tests. The last full-suite result was **1,495/1,495**, but its evidence is stale against current source and must be rerun before claiming fresh full-suite validation.

The repository's measured bottleneck is card-specific interpretation and requirement/effect validation, not missing generic client/server handlers. Similarity groups are candidates for review only; they are not proof that different cards have equivalent rules.

## Current primary-session assignments

- `PRIMARY-ACT-DECKTOP-DRAW-POWER` — implemented eight exact ACT abilities; six focused tests pass and per-ability evidence is recorded. It remains reserved until full-card verification and a fresh full suite.
- `PRIMARY-ORDER-SEARCH-NAME-AUTO` — six abilities: `cfa-12653:0` through `cfa-12658:0`. The blocker is the authoritative play-from-Drop Order lifecycle and post-play replacement; partial definitions must not be treated as supported.
- `PRIMARY-DRAGONTREE-GC-SHIELD-AUTO` — five abilities: `cfa-13498:0`, `cfa-13566:0`, `cfa-13607:0`, `cfa-13609:0`, `cfa-13638:0`. Requires exact temporary per-guard grant and battle-scoped resolution.
- `PRIMARY-PERSONA-SHIELD-TICKET-AUTO` — thirteen abilities across six Persona Shield units and the ticket card, including the ride-deck trigger, grade-three attack bonus, and ticket protection restriction.

These assignments are reserved in the registry. Do not reassign them or edit the primary checkout.

## External-worker readiness

**Not ready to start external Work chats yet.** The baseline and assignments are safely checkpointed locally, but the feature branch has not been confirmed on GitHub. Publish the feature branch first, then refresh the registry baseline and verify that its files are present on GitHub. A claim is real only after GitHub accepts the atomic claim-ref push; a failed push means no claim was made.

When the published registry is available, list the unassigned batches with:

```powershell
node -e "const r=require('./ability-work-batches.json'); console.log(r.batches.filter(b=>b.status==='available').slice(0,20).map(b=>b.batchId).join('\n'))"
```

The current local registry begins with `ABILITY-A334C44B-0001` through `ABILITY-A334C44B-0010`; confirm the published registry still uses these IDs before claiming one.

## Safe worker setup

After the feature branch and current registry have been pushed:

```powershell
git clone --branch codex/standard-ride-deck https://github.com/yumekazaki/vanguard-arena.git vanguard-arena-worker
Set-Location vanguard-arena-worker
node scripts/claim-ability-batch.js --batch ABILITY-A334C44B-0001 --worker work-chat-1
git worktree add ..\vanguard-arena-ABILITY-A334C44B-0001 -b work/ABILITY-A334C44B-0001 origin/codex/standard-ride-deck
Set-Location ..\vanguard-arena-ABILITY-A334C44B-0001
```

Replace the example batch ID with an available ID from the published registry. If the atomic claim says the ref already exists or authentication/network access fails, stop and do not edit that batch. Work only in the isolated worktree, preserve exact card text and IDs, add focused rejection and success tests, and open a branch/PR for integration. Never push to `main` or the Pages publishing branch directly.

## Integration and verification

Review contributions serially in the primary worktree. Confirm the code matches the card text, validates both player identities and all trigger/cost/zone/timing conditions, and passes focused and adjacent tests. Record ability-level evidence as `tests-passing`; do not mark a card fully verified until all of its printed abilities and relevant rules interactions are covered. After an integration milestone, run the complete regression suite and regenerate the card manifest, queue, registry, and progress report from the resulting source revision.
