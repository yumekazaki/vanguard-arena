# Vanguard Arena ability work handoff

## Repository and current checkpoint

- Repository: https://github.com/yumekazaki/vanguard-arena
- Local checkout: `C:\Users\yumek\Documents\Codex\2026-10-24\ne\work\vanguard-arena`
- Active branch: `codex/standard-ride-deck`
- Current local code checkpoint: `48b551b666fc84cbdd24ceaa5394011982e6923d` (`Recognize structured continuous effects in catalog validation`). The full source suite and ability-level evidence are refreshed against this checkpoint.
- Ability queue and registry baseline: `48b551b666fc84cbdd24ceaa5394011982e6923d`.
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

Current catalog snapshot: **17,240 abilities; 4,343 compiled (25.19%); 12,897 unsupported or unreviewed; 645 fully verified cards**. The queue contains 16,595 abilities on cards that are not yet fully verified. The registry reserves 155 ability entries across 82 cards and exposes 467 available batches. Twenty-nine batches group 125 candidate cards by normalized ability text for triage; every ability on a card stays in the same batch, and similarity is not treated as rules equivalence. The latest complete suite passed **1,602/1,602 in 393.33 seconds**, and its digest matches source checkpoint `48b551b6`. The three integrated worker families have exact ability-level evidence; their cards remain unverified until every printed skill and live-game requirements are covered. Registry generation validated all ten active reservations. `catalog-progress.json` reports suite freshness explicitly. The queue reports no missing registered client/server effect handlers; online matches still relay ability decisions through the host browser, so reducer tests do not establish live authoritative multiplayer behavior.

Three worker batches are integrated into the local code checkpoint and reassigned to primary review so no other worker duplicates them. The clan Counter-Blast attack family covers four exact abilities; the conditional-name Boost family covers four supported abilities while two associated abilities remain unsupported; the same-name Drop call family covers four exact abilities. Focused tests and the full suite pass. Keep all associated cards unverified until every printed ability and live browser behavior are checked.

Three additional non-overlapping batches are reserved in the registry for isolated workers: `PRIMARY-WORKER-AUTO-RIDE-DRAW-CREST-5`, `PRIMARY-WORKER-AUTO-END-PHASE-NAMED-SEARCH-4`, and `PRIMARY-WORKER-AUTO-NAMED-RIDER-TOP-SEVEN-4`. Each reservation includes every ability on each affected card, not just the matching family ability.

The repository's measured bottleneck is card-specific interpretation and requirement/effect validation, not missing generic client/server handlers. Similarity groups are candidates for review only; they are not proof that different cards have equivalent rules.

## Current primary-session assignments

- `PRIMARY-ACT-DECKTOP-DRAW-POWER` — implemented eight exact ACT abilities; six focused tests pass and per-ability evidence is recorded. It remains reserved until full-card verification and a fresh full suite.
- `PRIMARY-ORDER-SEARCH-NAME-AUTO` — six abilities: `cfa-12653:0` through `cfa-12658:0`. Reserved because live online matches still use host-relayed browser state; do not integrate a separate server-only Order action until the authoritative match path is connected.
- `PRIMARY-GC-INTERCEPT-ABILITY-NEGATION-CONT` — six abilities: `cfa-13119:0` through `cfa-13124:0`. Reserved until the authoritative online path supports Intercept and exact temporary ability suppression.
- `PRIMARY-AUTO-GLITTER-PLACEMENT-TOP-FIVE` — five abilities: `cfa-13520:0`, `cfa-13542:0`, `cfa-13584:0`, `cfa-13608:0`, and `cfa-13621:0`. Integrated locally with authoritative reducer checks for Glitter Vanguard eligibility, exact hand-to-RC source, top-five filtering, both player seats, and source-to-Soul only after a revealed card. The five-card focused suite passes 13/13. The browser multiplayer app still uses its host-relay path, so live online verification remains outstanding and these cards are not fully verified.
- `PRIMARY-WORKER-CONT-CONDITIONAL-CARD-NAME-6` — `cfa-12062:1`, `cfa-12719:1`, `cfa-13689:1`, `cfa-5264:0`, `cfa-5349:1`, `cfa-7528:1`; four Boost CONT abilities are integrated, while `cfa-5264:0` and `cfa-5349:1` remain unsupported. Reserved to primary review.
- `PRIMARY-WORKER-AUTO-CLAN-CB-ATTACK-POWER-4` — `cfa-1140:0`, `cfa-1159:0`, `cfa-1170:0`, `cfa-1187:0`; integrated with ability-level evidence; reserved to primary review.
- `PRIMARY-WORKER-AUTO-SAME-NAME-DROP-CALL-4` — `cfa-8541:0`, `cfa-8571:0`, `cfa-8577:0`, `cfa-8585:0`; integrated with ability-level evidence; reserved to primary review.
- `PRIMARY-WORKER-AUTO-RIDE-DRAW-CREST-5` — exact ride event, prior Vanguard identity, draw, and named crest choice/state across five cards; worker must audit all card text and keep full-card verification pending.
- `PRIMARY-WORKER-AUTO-END-PHASE-NAMED-SEARCH-4` — exact RC-to-Drop End Phase event, Great Nature Vanguard, optional Counter Blast, and named search across four cards.
- `PRIMARY-WORKER-AUTO-NAMED-RIDER-TOP-SEVEN-4` — exact named ridden-card event and top-seven named search across four cards; also audit each card's sibling ride-call AUTO.
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
