# Ability Engine Implementation Status

## Existing architecture

The website is a static GitHub Pages frontend. `app.js` owns the browser-side match state, UI, card parsing, and effect resolution. Online rooms relay actions through Supabase Realtime (with PeerJS for older rooms); the host browser applies both players’ actions and sends snapshots. There is no authoritative match server in this repository. The Supabase SQL currently handles room discovery and deck/account data, not validating game actions.

The tracked card catalog contains 14,022 records from a community Cardfight Area snapshot dated 2025-05-09. It is not an official Bushiroad API. The current checkout uses sparse checkout, so the `assets/` and `supabase/` directories are tracked but not materialized locally.

## Implemented foundation

- `ability-engine.js` separates card ability parsing and event helpers from the UI script. It preserves printed ability text and card-definition IDs, and parses AUTO, ACT, and CONT labels, basic circle headers, once-per-turn text, and GB thresholds.
- Each match receives a match ID and event sequence. Player setup generates its player ID before constructing the deck, and every deck instance is created with a distinct UID plus explicit owner and initial controller IDs. A regression test covers both the instance identity and startup ordering.
- Structured conditions now cover clan Vanguard requirements, empty Rear-Guard fields, exact source-boosted status, and Vanguard attack targets; they are evaluated against current player and event state. Unknown conditions remain blocked.
- The existing trigger queue now emits a serializable event envelope with event type, acting/turn player IDs, source and subject instance IDs, owner/controller IDs, booster/boosted IDs, targets, locations, battle/timing fields, and before/after fields where supplied.
- Processed event IDs are recorded on the match. Guest game actions and ability responses carry request IDs and expected state versions; the host client rejects duplicate and stale requests before applying them. Snapshot revisions are based on published match-state changes. This is a client-side replay guard only, not server authority. Exact instance comparisons are used for the compiled attack, boost, ride, placement, and hit triggers.
- The ACT menu now considers only printed ACT abilities. A once-per-turn AUTO or CONT is not a manually activatable skill. The app-level AUTO matcher now delegates to the shared exact-instance matcher; a later duplicate legacy regex declaration had been overriding that delegation and was removed.
- Pending Stride cost ownership now follows the joining player across the host temporary side mapping, keeping cost prompts and hand selection with the player who chose to Stride.
- Trigger compilation is deliberately conservative. Unknown trigger text, unmodeled `if`/`unless`/`while` conditions, and unparsed costs are marked for review and do not enter the automatic prompt queue.

## Current coverage snapshot

A scan of the tracked catalog found 17,240 AUTO/ACT/CONT ability blocks across 14,022 records: 11,581 AUTO, 2,249 ACT, and 3,410 CONT. The current trigger compiler recognizes 4,631 AUTO trigger patterns across five event types. Currently 1,479 have a recognized trigger and no flagged condition or cost, so they pass the trigger-queue eligibility gate; their effects are still not certified as supported. This is a **parser and queue eligibility count, not a supported-card count**; effect behavior and full rules validation are not yet certified by those numbers.

Covered trigger shapes are limited to source-unit attacks, source-unit boosts, explicit VC/RC placement, ride-over/Forerunner phrasing, and attacks hitting during the battle that the source unit boosted. For example, Battle Sister, Cocoa’s Oracle Think Tank Vanguard condition is now structured, but its top-card choice and effect still lack validated resolution. Megacolony Battler C’s Forerunner trigger is recognized; its costed boost-hit ability remains withheld pending structured handling of its put-this-unit-into-soul cost.

## Tests

Run the focused regression suite with:

```sh
node --test ability-engine.test.js
```

Current suite: 23 tests pass. It covers ability-type parsing, printed-text preservation, event IDs and de-duplication, remote request replay/version checks, the app-to-engine matcher integration, exact copy identity, circle restrictions, unmodeled conditions and costs, structured common-cost affordability and condition evaluation, ACT-only manual activation, and real-card fixtures for Battle Sister, Cocoa, Megacolony Battler C and Blaster Dark. `node --check app.js`, `node --check ability-engine.js`, and `git diff --check` also pass. There are not yet browser-driven, end-to-end, or two-client multiplayer tests.

## Remaining work and limits

1. Expand structured conditions and timing windows beyond the modeled clan, board-empty, boosted-source, and attack-target cases; common explicit Counter-Blast, Soul-Blast, discard, and rest-source costs now have structured affordability checks and drive the existing cost prompt/resolution counts.
2. Move remote action validation off the host browser into a trusted server, and add atomic effect transactions. The current request ID/version checks prevent duplicates and stale requests only while the host client remains connected and authoritative.
3. Replace the generic text-based resolver with ordered typed effect handlers and usage records; add tests for costs, targets, rollback, turn expiry, nested events, and duplicate requests.
4. Add a continuous-effect layer and keep CONT abilities out of activation prompts.
5. Move online match authority and private decision delivery to a server component. With the current host-browser authority, neither client can enforce the requested server-side identity and anti-forgery guarantees.
6. Expand card batches using source/version metadata and rules-reviewed ability definitions. Unknown text must remain unsupported until validated.

No claim is made that the full Premium ruleset or the 14,022-card pool is supported.