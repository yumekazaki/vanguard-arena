# ABILITY-0001 review

Claim worker: codex-01a1851a
Claim ref: claims/ABILITY-0001
Claim commit: 82804b76dc0e0a79cd170a19ce0e815c3e4ee47e
Worktree baseline: 72e1aa36faea734545aef8a669bce6bb88d4292f
Registry source baseline: 272b4f405ee96af64a30abec3b49f286479e7549

## Result

53 assigned abilities on 25 cards were triaged. Zero newly verified abilities. The contribution module deliberately exports an empty array. No shared engine, runtime, registry or verification manifest is modified. The existing compiled cfa-1002:0 remains unchanged in the baseline; this report does not certify it.

Two simple new definitions and the existing Hollow Nomad definition were exercised in a test-only engine. Positive behavior, both authenticated seats, rejection of proxy/stale decisions, replay protection, source identity/circle, accumulation and duration cleanup passed. However eight negative event-context checks reproduce failures, so none of the candidates is exported. The test-only candidate engine is separate from the catalog audit engine.

## Shared dependency request

The primary worker should add exact authoritative event-context gates for cfa-100:1, cfa-1001:0 and cfa-1002:0 before considering integration. Check source/subject owner and controller against the located instance; for attacks verify the battle ID and exact live attacker/target and battle timing; for standing verify a real rest-to-stand transition during the controller's battle phase. Recheck context at resolution and preserve existing authenticated-seat checks and event/action deduplication. Do not bypass the server gate with a client-only operation.

The executable TODO cases in ability-batch-ABILITY-0001.test.js demonstrate all eight currently observed failures. A TODO failure is an unresolved blocker, not a passing test. Remove TODO only after the primary-owned implementation rejects those events without applying effects. The test-only definitions are proposals, not production definitions. No full-card verification is claimed.

## Per-ability disposition

Focused command: `node --test ability-batch-ABILITY-0001.test.js` — 10 passing tests, 8 executed failing TODO cases, zero ordinary failures. The TODO cases remain blockers. Standalone `node scripts/audit-ability-catalog.js` — 17,240 ability blocks, 4,174 compiled, 13,066 unsupported, zero invalid compiled definitions. Full-suite results are recorded in the PR; none of this evidence certifies the blocked abilities.

“Deferred” below means not implemented or certified by this contribution; initial engine/registry status is untouched. Rows beyond the three exercised candidates are dependency triage, not exhaustive executable behavior verification.

| Ability ID | Disposition | Dependency or finding |
| --- | --- | --- |
| cfa-10000:0 | Deferred: dependency review | Continuous named-card count over both drop and bind is not covered by the supported soul-count operation. |
| cfa-10000:1 | Deferred: dependency review | Treasures-marker removal cost and filtered multi-card drop calls require shared handlers. |
| cfa-10000:2 | Deferred: dependency review | Hit-triggered choice of a marker-free VC/RC and Treasures-marker placement require authoritative marker state. |
| cfa-10001:0 | Deferred: dependency review | Named top-five search must discard every unchosen card, rather than shuffle or bottom-deck them; current search operation is not interchangeable. |
| cfa-10001:1 | Deferred: dependency review | Hit-triggered choice of a marker-free VC/RC and Treasures-marker placement require authoritative marker state. |
| cfa-10002:0 | Deferred: dependency review | Other friendly named-unit standing by an ability plus exact named soul condition requires event-cause and subject checks. |
| cfa-10002:1 | Deferred: dependency review | Drive-check name/grade identity, optional composite payment and damage-dependent multi-unit standing require exact shared resolution. |
| cfa-10003:0 | Deferred: dependency review | Rest and normal-unit drop-to-bottom composite cost, soul charge, then named Vanguard choice need authoritative ordered payment and targeting. |
| cfa-10003:1 | Deferred: dependency review | Being replaced on the same circle needs prior-source identity at placement plus named top-two search and controller-chosen bottom order. |
| cfa-10004:0 | Deferred: dependency review | Unboosted attack must copy the chosen Vanguard current power, including decreasing source power; additive modifiers cannot implement it. |
| cfa-10004:1 | Deferred: dependency review | Same-circle replacement trigger and sequential soul charge / zero-face-up-damage counter charge need shared support. |
| cfa-10005:0 | Deferred: dependency review | Lock cost, front-row enemy retirement, named top-four call and ordered remainder need shared atomic choice resolution. |
| cfa-10005:1 | Deferred: dependency review | Locked-card thresholds/count, named multi-call, scaled power and conditional sentinel prohibition require shared mechanics. |
| cfa-10006:0 | Deferred: dependency review | Grade-filtered discard payment and drive increase are not covered by the exact server-gated drive handler for another card. |
| cfa-10006:1 | Deferred: dependency review | Battle-specific checked normal-unit grades and ordered multi-branch retire/stand/power choices need a shared resolver. |
| cfa-10007:0 | Deferred: dependency review | Lock payment and opponent-controlled hand/field/drop binding require authoritative hidden-zone permissions. |
| cfa-10007:1 | Deferred: dependency review | Opponent normal-unit binding provenance and opponent-controlled same-name search/bind, then conditional controller power require shared flow. |
| cfa-10007:2 | Deferred: dependency review | Named soul-or-RC condition, composite cost and damage-threshold all-rearguard stand require exact shared resolution. |
| cfa-10008:0 | Deferred: dependency review | After a paid rode-upon trigger, top-deck damage placement and choosing any damage card to call require an exact ordered handler. |
| cfa-10008:1 | Deferred: dependency review | Protect-circle conditional granted Intercept, granted shield AUTO and back-row intercept permission require shared continuous grant support. |
| cfa-10009:0 | Deferred: dependency review | Optional opponent-rearguard damage placement followed by opponent-controlled healing needs authoritative permissions and sequencing. |
| cfa-10009:1 | Deferred: dependency review | Protect marker on the exact source circle is not a supported continuous condition; generic own-turn power is incorrect. |
| cfa-1000:0 | Deferred: dependency review | Conditional reveal, filtered top-card call, and shuffle-only-on-failure need an exact sequential operation. |
| cfa-10010:0 | Deferred: dependency review | Protect-circle existence and Imaginary Gift choice/creation require exact marker/gift handling. |
| cfa-10010:1 | Deferred: dependency review | Continuous count of own Protect markers on circles requires an authoritative marker-count condition/scaler. |
| cfa-10010:2 | Deferred: dependency review | Damage-zone calls capped by marked circles, suppression of called-card AUTO and corresponding damage must resolve sequentially. |
| cfa-10011:0 | Deferred: dependency review | Plant-token stat/keyword replacement and back-row interception permission need a shared continuous token rule. |
| cfa-10011:1 | Deferred: dependency review | Normal-unit drop-to-bottom cost and optional two-token creation require reviewed token/card metadata and placement choices. |
| cfa-10011:2 | Deferred: dependency review | Draw followed by optional hand calls specifically onto Plant-token circles needs exact replacement-event handling. |
| cfa-10012:0 | Deferred: dependency review | Named top-seven search with conditional optional fully specified Plant token needs branch-aware shared resolution. |
| cfa-10012:1 | Deferred: dependency review | Placement from hand must inspect the replaced Plant token and its power before applying the source turn modifier. |
| cfa-10013:0 | Deferred: dependency review | Named top-seven search with conditional optional fully specified Plant token needs branch-aware shared resolution. |
| cfa-10013:1 | Deferred: dependency review | Placement from hand must inspect the replaced Plant token and its power before drawing and applying the turn modifier. |
| cfa-10014:0 | Deferred: dependency review | Named-unit lock cost and temporary replacement of discarded-card types require shared characteristic lifecycle handling. |
| cfa-10014:1 | Deferred: dependency review | Type-dependent effects in chosen order, temporary granted CONT and Gift creation need shared composite handling. |
| cfa-10015:0 | Deferred: dependency review | Opponent-controlled rested calls with AUTO suppression and conditional second lock payment/restand require shared choice permissions. |
| cfa-10015:1 | Deferred: dependency review | Opponent placement during own turn, lock payment and all-front-row power require exact shared support. |
| cfa-10016:0 | Deferred: dependency review | Nested named-soul and opponent-grade continuous power/critical conditions require reviewed combined-condition support. |
| cfa-10016:1 | Deferred: dependency review | Composite three-unit lock cost and source stand/drive reduction require shared authoritative handlers. |
| cfa-10016:2 | Deferred: dependency review | Hand-zone battle-end ride with three-unit lock cost and AUTO suppression requires shared timing and source replacement support. |
| cfa-10017:0 | Deferred: dependency review | Equip-gauge history, retiring ability source name/cause, bind-self cost and filtered deck call require shared handlers. |
| cfa-10017:1 | Deferred: dependency review | Once-per-turn drive-trigger equip-gauge placement needs authoritative face-down attachment state. |
| cfa-10018:0 | Deferred: dependency review | VC or named-ability RC placement, drive/power adjustment and optional discard-to-front-trigger-stack sequence need shared support. |
| cfa-10018:1 | Deferred: dependency review | Battle-end Counter Blast plus selectable rear-guard retirement cost needs an atomic authoritative composite-cost handler. |
| cfa-10018:2 | Deferred: dependency review | Once-per-turn drive-trigger equip-gauge placement needs authoritative face-down attachment state. |
| cfa-10019:0 | Deferred: dependency review | Soul-dependent repeated draw/call/optional-gauge sequence needs an exact ordered choice resolver. |
| cfa-10019:1 | Deferred: dependency review | Damage threshold, two gauge-bearing lock costs and granted front-check conditional CONT require shared state/lifecycle handling. |
| cfa-1001:0 | Blocked: reproduced | Reproduced acceptance of mismatched event owner/controller on stand. Exact stood-transition and current phase checks also need authoritative review. Test-only definition; not exported. |
| cfa-10020:0 | Deferred: dependency review | Dual attacked-VC/placed-GC trigger, two named-unit retirement payment and standing-enemy target require exact shared cost/target rules. |
| cfa-10020:1 | Deferred: dependency review | Named-Vanguard conditional Resist/Intercept/power bundle needs shared continuous keyword and targeting rules. |
| cfa-1002:0 | Blocked: reproduced | Existing baseline compiled definition; reproduced acceptance of mismatched event owner/controller and stale battle ID. Do not upgrade its prior evidence to newly verified. |
| cfa-100:0 | Deferred: dependency review | Temporary granted AUTO with fourth-battle threshold and mass retirement needs an authoritative granted-ability lifecycle. |
| cfa-100:1 | Blocked: reproduced | Reproduced acceptance of mismatched event owner/controller and stale battle ID. Test-only definition; not exported. |
