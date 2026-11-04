# Mobile interface review

Branch: `ui/mobile-interface`. Base: `origin/mobile-interface-base`.
Do not merge or deploy: user requested an overlap review first.

## Ownership and scope

The shared registry found in this repository is `ability-work-registry.jsonl` with
`ability-work-registry-manifest.json`. It coordinates card-ability batches, not UI
file ownership. The user confirmed there is no separate file-ownership registry
and authorized isolated mobile-specific work. Neither registry was changed.

New files: `arena-mobile-interface.css`, `arena-mobile-interface.js`,
`arena-mobile-interface.test.js`, and this review note.
The only shared file edited is `index.html`: one stylesheet link and one deferred
presentation-script tag. This is the sole overlap point for another UI worker.
No existing stylesheet, app script, ability engine, game state, network code,
deck validation, dependency, or schema was edited.

## Stage 1: layout and orientation

- Existing `setMobileMode` toggles `body.mobile-mode`, saves the preference under
  `vanguardArenaMobileMode`, and updates the toggle. It does not reload the app.
- Every new CSS selector requires `body.mobile-mode`. Width/orientation queries
  only refine that explicitly enabled mode. No orientation locking is used.
- Menu and workshop stack or use columns according to available width. The deck
  grid scrolls instead of compressing its cards into tiny targets. The game board
  retains readable height and allows page scrolling; fullscreen is optional.
- `visualViewport` resize/scroll measurements constrain mobile dialogs and hand
  overlays when browser chrome or the keyboard reduces visible space. Rotation
  updates CSS variables only. It does not reconstruct the page or touch state.
- Insets respect safe areas. No viewport-meta restrictions were added.

## Stage 2: touch

- Existing zoom, quantity, and removal buttons become visible with larger targets.
  Existing action handlers are reused. The mobile hand uses a non-overlapping
  horizontal strip so a card does not intercept a neighboring card's tap.
- A mobile-only Card info dialog copies the current inspector's read-only text
  and image. Copied IDs are removed. Gameplay nodes and handlers are not cloned.
- Search/filter UI folds into a native details panel using the original nodes.
  Values, IDs, and handlers remain attached. Disabling Mobile Mode unwraps it.
- All mobile listeners, tools, and viewport styles are removed on toggle-off.
  Repeated toggles do not accumulate handlers. Original components are retained.
- Pointer-down/move/up listeners are passive. A capture click guard suppresses
  only a click after a moved touch on that same card. Ordinary taps, keyboard
  activation, mouse events, and multi-touch remain available. Pinch is not blocked.

## Automated evidence

`node --test arena-mobile-interface.test.js` covers inactive desktop lifecycle,
toggle cleanup, preserved original form nodes/values, resize-only presentation,
keyboard viewport measurements, read-only inspection, scroll/tap/mouse/key/pinch
handling, and mandatory Mobile Mode scoping of every stylesheet selector.

The existing targeted gameplay/privacy/G-deck/Standard/token/chat/relay/bot checks
are also run. These are regression checks, not proof of real-browser layout.

## Browser/device verification — pending, not claimed

The browser runtime currently fails before page access with:
`failed to write kernel assets: The system cannot find the path specified. (os error 3)`.
The previous desktop-control fallback failed with the same startup error.
No new rendered screenshots or computed-style comparisons are available.

Required visual matrix once the tool works:

| Class | Portrait | Landscape | ON | OFF baseline vs branch |
| --- | --- | --- | --- | --- |
| iPhone SE-size | 375×667 | 667×375 | Pending | Pending |
| iPhone standard-size | 390×844 | 844×390 | Pending | Pending |
| iPhone large-size | 430×932 | 932×430 | Pending | Pending |
| Android compact | 360×800 | 800×360 | Pending | Pending |
| Android large | 412×915 | 915×412 | Pending | Pending |
| PC | 1280×720, 1440×900, 1920×1080 | — | Opt-in only | Pending |

For each phone size, verify menu/navigation, a 54-card Standard deck with Ride Deck
choices, filters/search/save/quantity buttons, long inspection text, hand selection,
guard/drive/end-attack controls, optional fullscreen, online chat, and rotation with
an unsaved deck and active game/selection. Check real Safari/Chrome toolbar changes,
keyboard open/close, pinch zoom, scrolling starting on a card, and display cutouts.
At the same sizes with mode OFF, compare against the base branch before/after:
geometry, styles, navigation, card actions, and keyboard/mouse behavior. Repeat OFF
comparisons at the PC resolutions. These comparisons have not yet been performed.
