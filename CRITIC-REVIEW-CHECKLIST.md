# Vanguard Arena Critic Review Checklist

Branch: codex/critic-review-ux-20261113
Base: origin/main at 07afa62b647ee36c9f43742a5e97661e7ec4ac1e
Scope: focused gameplay usability fixes in the isolated review worktree. This checklist records actual code and test status; it does not claim the full review is complete.

## Implemented in this pass

| Criticism | Change | Verification |
|---|---|---|
| Hand closes or is hidden during ordinary play | A hand tray appears during a live match, stays present after normal game actions, can collapse/expand, remembers the player’s preference, and can be resized. Guarding still opens the existing focused guard hand. | arena-hand.test.js: persistent state, preference, guard hand, and drag request tests pass. |
| Top-card searches do not show all examined cards | Search prompts now show the entire privately examined top group, mark which cards are selectable, and identify the information as private. A zero-card look produces an empty selection instead of exposing the entire deck. | arena-ability-choice.test.js: top-N, filtered choices, and zero-card regression tests pass. |
| Ordinary calls/rides require several menus | Desktop players can drag a hand card onto a Vanguard or Rear-Guard circle. The request uses the existing place action; the existing ride/call checks remain in place. Tap/select-and-place and card menus remain available. | arena-hand.test.js verifies the drag sends the intended card and circle. No real browser or online-match walkthrough yet. |
| Declaring attacks and choosing a booster takes several steps | Desktop players can drag an attacker toward an opponent Vanguard/front-row target. If a boost prompt is required, they can drag the eligible booster onto the attacker. The gesture maps only to a target already offered by the normal attack prompt; boost, trigger, and attack decisions remain in the existing action flow. | arena-attack-gesture.test.js checks exact legal-target mapping and rejects wrong attackers, unresolved boost windows, and illegal targets. No live browser or online walkthrough yet. |
| Guardian Circle does not explain the calculation | The guard summary now shows the committed shield and card count, each guardian’s shield, the defending unit’s power, attack power, total defense, and remaining shield needed. | arena-battle-display.test.js checks the rendered comparison; existing token-guarding tests pass. |
| Drive and damage checks are too fast | Check reveals remain sequential and the player can choose Normal, Fast, or Reduced motion in About this build. Fast shortens reveal and card-movement animations; Reduced motion removes moving effects while keeping the revealed card readable. | arena-animation-settings.test.js checks saved modes and timing; the existing reveal queue remains in app.js. No browser pacing review yet. |
| Phase changes are easy to miss | Stand, Draw, Ride, Stride, Main, Battle, and End changes now show a brief non-blocking phase banner. | arena-battle-display.test.js checks the banner, phase label, and reduced-motion behavior. |
| Players cannot tell the next expected action or whether an ability needs a decision | The phase rail now gives a short phase-specific next-step hint. Ability prompts identify optional ACT actions, optional AUTO triggers, mandatory AUTO resolutions, and simultaneous-trigger ordering decisions. | JavaScript syntax check passes; real prompt walkthrough remains outstanding. |
| Empty phases require unnecessary manual clicks | Players can opt into Assisted progression. It automatically moves through Stand and Draw only when the local player has no pending effect, legal ACT ability, or G Assist decision. Manual remains the default; Ride, Stride, Main, Battle, and End always wait for the player. | arena-phase-assist.test.js checks opt-in preference, pending/skill/G Assist gates, and that choice phases never auto-advance. Multiplayer walkthrough remains outstanding. |
| Damage cards are difficult to read or inspect | Damage-card thumbnails are larger on desktop and phone layouts, and an expanded damage-zone view distinguishes face-up cards from hidden face-down cards. It offers Counter-Blast/Counter-Charge only when those actions are available to the local player. | arena-battle-display.test.js checks the damage view's privacy and available actions, plus CSS size rules. No visual browser review yet. |
| New players cannot discover the faster controls | The optional About this build help text now explains the hand tray, drag-to-circle, and touch tap flow. | Help copy is present in index.html; it remains optional. |
| New players need a short optional interface tour | Added a four-step tour covering the hand, phase rail, battle interactions, and zone visibility; it has next/back, step navigation, close, and keyboard focus restoration. | arena-quick-guide.test.js checks the tour content and bounded navigation. |

## Already present on the base site, not changed here

| Feature | Current state |
|---|---|
| Mulligan | Selected cards are shown before confirmation and the resulting hand is rendered. |
| Attack target selection | Highlighted targets can be tapped/clicked; existing target buttons remain available. |
| Desktop quick actions | The optional right-click shortcut and ordinary visible card menu both remain available. |
| Phase controls | Manual remains the default with explicit Next Phase control. Assisted mode is opt-in and conservative, currently limited to empty Stand and Draw phases. |
| Check presentation | Drive/damage check reveal UI and trigger prompts already exist in the base site. |
| Other zones and action history | Existing zone dialogs and match log remain in place. |

## Still outstanding before the full review can be accepted

- **Broader phase automation:** safe Assisted progression now handles empty Stand and Draw phases. Automatic Ride/Stride availability, all automatic event-order windows, and full multiplayer verification still need to be completed before the review's phase-system requirement is satisfied. Ride, Stride, Main, Battle, and End remain manual.
- **Consistent zone presentation:** the expanded damage view is implemented; Soul, Drop, Bind, Deck, and G Zone presentation still needs a unified responsive review and additional controls where the review calls for them.
- **Reusable search/reveal presentation:** top-card private searches now show all examined cards and mark legal choices. Other ability search/reveal flows still need a full audit for counts, visibility, ordering, and confirmation controls.
- **Consistent feedback/tutorial:** phase, ride, call, attack, power, and retire feedback have visual effects; the optional four-step interface tour and ability decision labels are implemented. Audio feedback and broader cost/guard/skill feedback coverage remain outstanding.
- **Measured speed:** no before/after interaction-latency or click-count benchmark was run.
- **End-to-end acceptance:** no desktop bot match, phone browser match, or two-player online match was run for this pass. The focused tests below are not a substitute for those scenarios.

## Test result

Passed focused checks: **42/42 tests** across search/hand/display/animation/attack-gesture/phase-assist/quick-tour tests plus existing mobile interface, battle shortcuts, token guarding, and zone-pile tests. `node --check` passed for the edited JavaScript files, and `git diff --check` found no whitespace errors. A repository-wide `node --test` run was started earlier, but was interrupted before it produced a final summary; its result is unknown.
