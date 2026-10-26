# Vanguard Arena — early online prototype

A browser project with local practice and two-player online rooms. Without account setup, saved decks stay in the current browser. The optional account feature stores decks under player accounts with Supabase; see [`supabase/SETUP.md`](supabase/SETUP.md).

## Included now

- Play, Decks, and Card Library sections.
- Local practice match with simplified demonstration rules.
- Two-player online rooms: new rooms relay actions through Supabase Realtime, so both players can use match controls even when their browser lacks WebRTC; older rooms continue to use PeerJS.
- Spectator links provide a live, read-only view of a hosted match.
- Match turn tracker covers Stand, Draw, Ride, Main, Battle, and End; entering Draw draws once for the turn.
- Play Order cards to a visible Order zone; G Units are separated into a visible G deck and can be strode into the Vanguard circle.
- Match controls include a deck viewer, both Drop viewers, binding, hand-to-damage, moving Drop cards to hand/field/deck, and selected-card Counter-Blast, Counter-Charge, or healing.
- Top-card reveals can show a chosen number to both players; revealed cards can move to hand, Soul, or Drop, with a Done looking action. Stride and G-guard open the G deck to choose an eligible card.
- Mouse controls cover card placement, damage and drive/trigger checks, Soul Charge, locking, power boosts, Imaginary Gift markers, G-zone moves, and deck shuffling.
- Deck builder with local save, open, duplicate, delete, and JSON import/export.
- Tap the expand icon on cards in the builder, saved deck previews, deck list, or match field/hand to open a large card image and its details.
- Optional email accounts and per-account deck sync after a free Supabase project is configured; existing local decks can be explicitly imported.
- Card catalog with search by name or database number and filters for grade, clan, and nation.
- 10,476 catalog records matched to the supplied card art by numeric image ID.

## Card data and art

The card art came from the folders supplied by the user. Card names and available card details were read from the public Cardfight Area database repository. The repository is community-maintained, not an official Bushiroad API. See [`assets/cards/README.md`](assets/cards/README.md) for provenance, coverage, and local update instructions.

Some source records have no grade or clan field, and some supplied images have no matching text record. Those are labeled as unknown or remain in the image gallery. New online rooms use Supabase Realtime broadcasts so they work in browsers without WebRTC support, including console browsers that block peer-to-peer connections. Existing rooms created by older builds still use PeerJS and require WebRTC. Match state is relayed live and is not stored in a match history. Turn controls and zones track manual actions but do not enforce every Premium rule or automate card-specific effects. This remains an early online prototype, not a complete or rules-accurate Premium simulator.


See [ABILITY_ENGINE_STATUS.md](ABILITY_ENGINE_STATUS.md) for the current rules-engine scope, supported trigger shapes, test command, and remaining architecture work.
