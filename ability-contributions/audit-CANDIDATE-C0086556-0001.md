# Audit-only report: CANDIDATE-C0086556-0001

**Claimed worker:** `codex-ot-additional-effect`

**Audited baseline:** `826779006f4b183ac8e5190c512f26df884c9394`

**Status:** Blocked on shared engine, reducer, and UI support. This report contains no ability definitions and does not claim behavioral verification or full-card verification.

## Assigned cards and ability IDs

Each of these six cards parses to exactly one catalog ability block, at the assigned `:0` ID. The six parsed ability texts are identical. All six are currently uncompiled.

| Card ID | Card name | Assigned ability ID |
| --- | --- | --- |
| `cfa-12625` | Great Dragon Emperor of Distant Blaze, Gidoradevalt | `cfa-12625:0` |
| `cfa-12626` | Ancestral Dragon King of Zenith Colors, Founaherdio | `cfa-12626:0` |
| `cfa-13110` | Sword Emperor Dragon of Supremacy, Mordigarrah | `cfa-13110:0` |
| `cfa-13142` | Beauteous Eternity, Lururatye | `cfa-13142:0` |
| `cfa-13537` | "Fiery Rugby Girl Dodge Danko", Single Strike Danko | `cfa-13537:0` |
| `cfa-13639` | Wise Dragon Emperor of Valliant Valor, Colledegras | `cfa-13639:0` |

## Exact shared printed text

The catalog text for the assigned ability IDs is:

> CONT: This card is regarded as "Spiritual King of Ignition, Valnout".
>
> Additional Effect - Choose one of your stand rear-guards, and it gets "AUTO [RC] 1/Turn: At the end of the battle this unit attacked, stand this unit." until end of turn. If you did not choose a card, draw a card, choose up to one unit card from hand, and call it to RC.

The parser currently classifies this entire combined block as `CONT`; it does not split the CONT name alias from the separately timed Over Trigger Additional Effect.

## Why a contribution definition would be unsafe today

- `ability-engine.js:94` defines the validated effect-operation set. It has immediate operations such as `stand-target` and specialized call operations, but no general temporary AUTO grant and no generic call-a-unit-from-hand-to-RC operation. The exported `EFFECT_HANDLERS` inventory confirms the same gap.
- `ability-engine.js:3407` implements a granted ability only for the exact Break Ride family. It validates its fixed parent/rider context and is not a reusable generic grant mechanism.
- `ability-server-reducer.js:1494-1508` independently restricts effect operations. The only granted-AUTO operation in this allowlist is `grant-vanguard-break-ride-ability`, which is handled by Break Ride-specific validation.
- `ability-server-reducer.js:5281-5310` handles an Over Trigger damage check as removal, draw, and the 100,000,000-power target. Its comment explicitly excludes drive-check-only extra text from damage checks.
- `ability-server-reducer.js:5355-5380` handles an Over Trigger drive check by removing the card, drawing, and opening the existing `over-target` 100,000,000-power choice. It does not schedule this card's Additional Effect.
- `ability-server-reducer.js:5445-5456` resolves only existing trigger stages such as stand, critical, heal, power, and Over Trigger power. There is no Additional Effect branch.
- `app.js:1242-1245` renders the existing Over Trigger prompt as the 100,000,000-power target selection. `app.js:1510-1531` creates/resolves the same Over Trigger target stage in the practice flow; neither implements the Additional Effect's choice or follow-up call.

Mapping the first branch to `stand-target` would stand the unit immediately, which contradicts granting an AUTO for a later attack. Mapping the alternative branch to `draw` alone would omit the optional unit selection and call. Both would silently change the printed effect, so no such approximations were added.

## Shared implementation dependencies

Before these six definitions can be safely contributed, shared code needs to provide:

1. A distinct, authoritative Additional Effect timing window for the exact Over Trigger card revealed by a **drive check**, sequenced with the base Over Trigger resolution. The effect must not run on damage checks.
2. A controller-only choice between selecting one of their currently standing Rear-Guards and choosing no card.
3. For the selected instance, a temporary `AUTO [RC] 1/Turn` whose trigger is that exact unit's own battle ending after it attacked, which stands that unit, consumes a per-instance/per-turn usage restriction, and expires at the end of the turn.
4. For the no-card branch, draw one card, then allow choosing zero or one unit card from hand and call the selected card to a legal Rear-Guard Circle with standard replacement/zone rules.
5. Authoritative server validation for exact source/check identity, controlling player, current target location and stand status, optional branch legality, stale/duplicate requests, usage records, and all-or-nothing resolution.
6. A player-specific UI for both online seats and practice that exposes the no-card choice and subsequent optional call. The host must not make the joining player's private choices.

Official rules/card-sequencing review and online/practice behavior tests are still required after those dependencies are implemented.

## Audit evidence

- A direct catalog/parser check covered all six assigned IDs: each is `:0`, parses as one CONT block, has the same exact parsed text, and currently has no compiled definition.
- Catalog audit on the audited baseline: **14,022 card records**, **17,240 ability blocks**, **4,377 compiled abilities**, **0 invalid compiled definitions**, **1,996 cards with all ability blocks compiled and audit-valid**.
- No behavioral tests were run for this batch because no implementation was made. Do not mark these abilities as `tests-passing` or the cards as `fully-verified`.
