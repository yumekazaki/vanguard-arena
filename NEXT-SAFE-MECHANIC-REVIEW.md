# Next Ability-Engine Work Queue

The generated queue reports zero compiled abilities missing a registered local or authoritative effect handler. This is a narrower metric than card support: many remaining abilities still have unmodeled requirements, and no whole card is fully verified.

## Latest checkpoint — 2026-10-27

The full Node suite passes 784/784 in 128.03 seconds with fresh validation evidence. The catalog has 17,240 ability blocks: 3,797 compiled (22.02%), 13,443 unsupported or unreviewed, 3,665 implementation-complete, 132 partial, and zero fully verified cards. There are 10,766 abilities with unmodeled requirements and 15,033 without per-ability test records. The latest batch adds exact Success threshold AUTO behavior for 24 keyword/reminder entries and tests both match seats. Previous batches cover four legacy Generation Break ACTs with exact circle, cost, and draw handling and three Rear-Guard ACTs paying Soul Blast 2 for +5000 power.

## Bottleneck and optimization

The bottleneck is semantic review and regression evidence, not parser throughput. The bounded processing benchmark reached about 309,615 parsed records per minute at eight workers, versus 162,992 per minute at one worker. It produced zero fully verified cards per minute because parsing alone cannot prove rules behavior. The work queue now reuses catalog parse results and preserves validation freshness. Increasing worker count further is unlikely to help; use bounded workers to stage exact text groups for review.

## Remaining work

Priority work is to compile reviewed repeated text families with exact card IDs and regression evidence, model missing shared requirements and costs, validate more event-generation paths, expand continuous effects and card legality, and connect ordinary online play to the authoritative worker. The 24 Success keyword entries do not include the separate AUTO abilities that trigger when a unit becomes successful. Online rooms still use the host browser relay. Catalog and worker tests do not prove that the published website uses server authority. Do not claim full catalog coverage or production deployment.

## Latest checkpoint — 2026-10-27, clan-filtered Counter-Blast attack batch

The latest full suite passes 789/789 in 131.69 seconds. The catalog contains 3,808 compiled abilities (22.09%), 13,432 unsupported/unreviewed abilities, 2,218 records with passing tests, and zero fully verified cards. The 13,432 outstanding abilities form 12,772 exact-text groups; this is a deduplication index only. A fresh scan benchmark peaked at 320,912 parsed cards/minute with eight workers and produced zero fully verified cards/minute. The semantic backlog remains the limiting factor.

The latest batch adds 11 clan-filtered own-attack AUTO abilities and strict server-side cost validation. Both player seats resolve their own prompt; wrong source, clan, or payment cannot pass. These are ability-level regression records; no whole card qualifies as verified. No production push or deployment was performed.

## Current verified status — 2026-10-27

Added five exact records for the boosted battle close-step source-to-Soul effect, preserving their printed “batle” wording. Tests cover the exact booster, owner-only decisions, payment, friendly target, and rejection of another booster or foreign target. Full suite: 792/792 passed. Current catalog: 3,813 compiled (22.12%), 13,427 unsupported/unreviewed, 2,223 ability-level regression records, zero whole cards verified. Parsing/indexing remains much faster than semantic validation; the remaining workload is not completed.

## Current verified status — 2026-10-27, drive-trigger batch

A three-ability exact AUTO family is covered by trusted reducer and host/joiner regression tests. A trigger unit in the controller's actual drive check must be proven from the check card in the pending battle; the exact controlled, unlocked Rear-Guard gets +5000. Full suite: 795/795 passed in 131.75 seconds. Fresh queue: 3,816 compiled (22.13%), 13,424 unsupported/unreviewed, 2,226 evidence-backed ability records, no invalid definitions, and zero fully verified cards. Eight parser workers remain the best measured indexing throughput; semantics and validation are the bottleneck. No deployment or push occurred.

## Current verified status — 2026-10-27, mandatory RC Soul Charge batch

Added trusted support for three exact mandatory Rear-Guard placement Soul Charge abilities. Tests cover the source instance, RC-only timing, the correct controller for either online seat, and rejection of a different source, Vanguard placement, and host proxying. Full suite: 798/798 passed in 129.70 seconds. Fresh catalog: 3,819/17,240 compiled (22.15%), 13,421 unsupported/unreviewed, 2,229 ability evidence records, zero invalid definitions, and zero fully verified cards. No production push/deployment.

## Current verified status — 2026-10-27, optional discard-to-Soul batch

Added trusted support for three exact optional hand-discard AUTO abilities. The trigger follows the discarded instance, not necessarily the card whose effect caused the discard; it only triggers during that card controller's turn, and only that controller can accept or decline. Acceptance moves the exact instance from Drop to Soul. Full suite: 801/801 passed in 130.70 seconds. Fresh catalog: 3,822/17,240 compiled (22.17%), 13,418 unsupported/unreviewed, 2,232 evidence-backed ability records, zero invalid definitions, and zero fully verified cards. No push/deployment.

## Current verified status — 2026-10-27, Vanguard attack Soul Charge batch

Added trusted support for three exact Vanguard own-attack AUTO abilities. The exact source Vanguard must attack the opposing Vanguard; the authority resolves Soul Charge before adding +1000 to that battle, and prompts the correct controller. Full suite: 804/804 passed in 138.29 seconds. Fresh catalog: 3,825/17,240 compiled (22.19%), 13,415 unsupported/unreviewed, 2,235 evidence-backed abilities, zero invalid definitions, zero fully verified cards. The website's normal peer-relay path is still not switched to canonical worker authority.

## Refreshed sprint checkpoint — 2026-10-27

The current worktree is preserved at `.card-pipeline/checkpoints/vanguard-arena-checkpoint-20261027-1732.zip`. Fresh catalog: 3,835/17,240 abilities structured (22.24%), 13,405 unsupported/unreviewed, 2,245 ability regression records, and zero fully verified whole cards. The full suite evidence is fresh at 824/824. The unsupported dataset and queue were regenerated from this state. The main remaining bottleneck is exact semantic support and complete card-level proof, not bulk catalog scanning. This is not a completion or deployment claim.

## Validated family — named-unit Guardian Circle Sentinel AUTO (2026-10-27)

The fresh queue now recognizes eight exact named-unit protection skills as structured abilities. They match only on the exact source instance entering Guardian Circle from hand; the source controller makes the optional decision and pays the discard; the protected friendly unit must match the card-name phrase printed on that ability. Tests pass for all eight definitions and resolution from both player seats, plus invalid target/cost/source cases and declining. Overall 3,843 of 17,240 ability blocks are structured (22.29%), 13,397 remain unsupported, and zero full cards are verified. Full suite 829/829 passed. The site remains undeployed.

## Validated family — named-Vanguard Soul Charge AUTO (2026-10-27)

Three exact Rear-Guard placement abilities now check the controller's current Vanguard name, offer the printed optional Soul Charge, and resolve for the right player. Focused tests cover all three cards on both seats, exact source and circle, false Vanguard names, host proxy rejection, and decline. Full suite passes 833/833. Overall 3,846 of 17,240 abilities are structured (22.31%), 13,394 remain unsupported, and no card is fully verified. The generic Soul Charge handler requires the full requested number of deck cards, so low-deck behavior remains a disclosed engine limitation.


### 2026-10-27 — exact RC placement / named Vanguard / Soul Charge / power family
Added a reusable compiler and definitions for four reviewed AUTO abilities (`cfa-10308:0`, `cfa-10923:0`, `cfa-12066:0`, `cfa-12091:0`). They require the exact source instance to enter RC, the controller’s Vanguard to contain the printed name phrase, then resolve Soul Charge 1 before the source gains the printed power until turn end. Focused server regression: 4/4 passed, including both player seats, strict source/circle/name checks, mandatory handling, and host-proxy rejection. The existing general Soul Charge handler requires the full printed count available; low-deck handling remains an engine limitation. Full suite and fresh coverage counts are pending. No push/deploy.


## Latest verified checkpoint — 2026-10-27

Focused server regression: 4/4 passed, including both player seats, strict source/circle/name checks, mandatory handling, and host-proxy rejection. The existing general Soul Charge handler requires the full printed count available; low-deck handling remains an engine limitation. Full suite: 837/837 passed in 134.39 seconds. Fresh catalog: 3,850/17,240 structured (22.33%), 13,390 unsupported/unreviewed, 2,260 ability evidence records, zero invalid definitions, zero fully verified cards. No push/deploy.


### 2026-10-27 — continuous named deck-copy limit
Added a reusable parser and authoritative deck-list rule for the exact CONT wording “You may have up to N [name] in a deck.” All ten matching catalog abilities are represented, including the nine-copy “Ryu’s Buddies” exception and three eight-copy card names across their reprints. Deck validation applies the printed limit across same-name prints, retains the ordinary four-copy rule otherwise, and does not offer these CONT restrictions as activated skills. Focused coverage: 11/11 tests passed across exact catalog definitions, an eight-copy legal list, nine-copy legal list, and over-limit rejection. Whole-card verification remains incomplete.


### 2026-10-27 — verified named deck-copy-limit checkpoint
Full Node suite passes 840/840 in 148.56 seconds with fresh source-digest evidence. Catalog: 3,860/17,240 abilities structured (22.39%), 13,380 unsupported or unreviewed, 2,270 ability-level regression records, zero invalid definitions, and zero whole cards fully verified. All ten exact eight-/nine-copy named CONT restrictions are included. No push or deploy.


### 2026-10-27 — G-zone free Stride CONT
Implemented the exact six-card G-zone CONT family. The trusted server now lets either seat Stride with its own eligible face-up G-zone source without paying, preserves normal grade/timing/heart/ownership checks, and rejects unrelated face-up G-zone sources or submitted costs. Ability-originated face-up restriction is modeled as a continuous restriction; there is no current ability effect route that changes G-zone orientation to apply it to. Manual G-zone flips remain distinct. Focused tests and full suite passed; full suite is 846/846. Catalog coverage is 3,873/17,240 compiled (22.47%), 13,367 unsupported or unreviewed, 2,283 evidence records, zero invalid definitions, zero fully verified cards. The queue and unsupported dataset were regenerated with fresh full-suite evidence. No push/deploy.


### 2026-10-27 — deck builder honors printed named-copy limits
The browser deck builder now reads structured named deck-limit CONT abilities. It displays copy-limit violations against each printed maximum, permits adding same-name reprints up to the collective limit, preserves these counts when importing or submitting decks, and retains the default four-copy cap for cards without a deck-limit ability. The authoritative server validator remains the final gate. Focused deck-limit/bootstrap checks passed 11/11; full suite passes 840/840 in 146.72 seconds after the UI change. Local changes only; no push/deploy.


### 2026-10-27 — cross-unit Vanguard placement AUTO family
Added seven exact Rear-Guard AUTO definitions: when the controller’s Vanguard is placed on VC, the placed Vanguard must match the printed exact grade and clan, then only the source Rear-Guard gets +10000 until end of turn. Added subject-instance grade/clan snapshots to structured game events and condition handlers that use that exact event subject. Regression coverage checks the full family, both player seats, effect target, wrong grade/clan/circle/controller, and rejection of host proxying. Focused suite: 3/3 passed. Full suite pending.


## Latest verified checkpoint — 2026-10-27

Full Node suite: 843/843 passed in 137.35 seconds with fresh source-digest evidence. Catalog: 3,867/17,240 ability blocks structured (22.43%), 13,373 unsupported/unreviewed, 2,277 ability-level regression records, zero invalid compiled definitions, and zero whole cards fully verified.


### 2026-10-27 — exact discard-for-Stride AUTO draw family
Six exact card abilities now have structured `card.discarded` triggers with source identity, hand-to-drop movement, controller turn, and allowed cost reasons. The authoritative Stride payment event now carries `discardReason: stride-cost`; each exact card draws for its own controller on host and joiner seats. Tests reject wrong-card, wrong-reason, and wrong-actor events. The separate printed Ride Deck Grade 3 cost clause remains unexercised because there is no authoritative Ride Deck cost action in the current game. Full suite 848/848; 3,879 structured abilities, 13,361 unsupported or unreviewed, 2,289 evidence records, zero invalid definitions, and no fully verified whole cards. Queue evidence is fresh; no push/deploy.

## Processing status refresh — 2026-10-27 19:10

The 854-test evidence is fresh. Current indexed work: 13,353 unsupported abilities across 10,149 cards, 12,728 exact-text groups; structured coverage 3,887/17,240 (22.55%); 1 fully verified whole card. A new 4-vs-8 worker benchmark measured 156,260 vs 183,663 catalog records/minute, respectively, while verified-card count stayed at one. Increasing parser workers does not materially address remaining rules-semantic review. Checkpoint: `.card-pipeline/checkpoints/vanguard-arena-checkpoint-20261027-1910.zip`.

## Latest mechanic batch — exact discarded-source call family (2026-10-27)

The six-record Soul-Blast call-to-RC family is now represented by one reusable compiler and a trusted effect handler path. Its trigger uses the exact discarded instance, current controller turn and Vanguard grade, and resolves only for the owner. On battle-phase resolution, it stamps a turn-key attack restriction. Focused tests 5/5 and full suite 859/859 pass. Coverage is 3,893/17,240 structured; 13,347 remain unsupported/unreviewed. The 6 abilities have regression records but their cards are not fully verified. Ordinary online play still needs the canonical worker integrated as its source of truth; no push/deploy was made.
