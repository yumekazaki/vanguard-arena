# Ability contribution contract

This contract applies to worker contributions against the registry baseline. A batch owns all outstanding abilities on its listed card IDs. Never edit another batch's IDs or mark a card fully verified based only on a pattern-level test.

## Ability definition schema

Definitions are records registered through `VanguardAbilityEngine.registerAbilityDefinitions(...)` and are keyed to the stable catalog `cardId` plus exact `abilityId` (`<cardId>:<printed-ability-index>`). Preserve `printedText` exactly from the catalog. Use the current compiled definitions as the source of schema truth.

Required reviewed fields depend on ability type:

- `id`, `cardId`, `kind`, `printedText`, `source`, and `effects` (or an explicit structured `keywords` / `continuousRestrictions` representation for keyword CONT abilities).
- AUTO: exact `trigger` event, subject/source identity, required source location, optionality, reviewed conditions and costs. Event matching must bind the exact source instance that performed the action.
- ACT: permitted activation window, source location, controller, conditions, reviewed costs, target/choice rules, and usage restriction.
- CONT: passive conditions, scope, locations, and continuous modifiers/restrictions. Never expose a CONT ability as a manual activation.
- Unknown text, timing, costs, choices, or rules must remain explicitly unsupported and be reported for review.

## Effect-handler interface

Use existing operation records and `EFFECT_HANDLERS` in `ability-engine.js`; the authoritative reducer independently gates operations in `ability-server-reducer.js`. Do not invent an operation name or call an unreviewed client-only effect authoritative. A new shared handler is a separate dependency and must include: typed parameters, validation, legality checks, deterministic apply behavior, correct controller/owner handling, duration/expiry, and focused tests in both the client engine and server reducer. Shared core changes require primary-session review and serial integration.

## Batch contribution layout

For independent work, add a unique file under `ability-contributions/`, named `batch-<BATCH-ID>.js`, exporting only an array of definitions for that claimed batch. Add tests in uniquely named files. Do not edit the active checkout. If the existing architecture needs a core handler, submit the handler request and its tests in the PR; do not weaken validation or route resolution through the host browser as a shortcut. The primary session integrates accepted definitions into the runtime registry.

## Minimum validation per ability

1. Confirm exact card text and all ability blocks on the card; preserve card/ability IDs.
2. Verify trigger/source identity, location, condition boundaries, timing, controller, costs, optionality, usage restriction, target legality, and effect order.
3. Add positive and negative regression cases, including wrong source instance, wrong location, wrong event, wrong player, unavailable cost/target, duplicate/stale request, and both multiplayer seats where applicable.
4. Test sequential and nested effects and duration expiry where relevant. Invalid actions must leave state unchanged.
5. Run the focused test file and catalog audit. Full-suite freshness is required before evidence is treated as current.
6. Use `tests-passing` only for ability-level evidence. `fully-verified` is reserved for a complete card whose every printed ability and relevant rules interaction has been checked.

## Merge rules

Workers may add only their claimed IDs and unique contribution/test files. Do not edit `app.js`, `ability-engine.js`, `ability-definitions.js`, `ability-server-reducer.js`, `supabase/functions/match-worker/**`, the manifest, or the queue builder without explicit primary-session coordination. PRs are reviewed and integrated sequentially; a branch claim is released only after its PR is integrated or explicitly abandoned.
