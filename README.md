# Vanguard Arena — early online prototype

A browser project with local practice and two-player online rooms. Saved decks stay in each player's browser. Use **Export JSON** to keep or move a copy.

## Included now

- Play, Decks, and Card Library sections.
- Local practice match with simplified demonstration rules.
- Two-player peer-to-peer rooms: host creates an invite link, friend opens it, and game actions synchronize while both pages stay open.
- Deck builder with local save, open, duplicate, delete, and JSON import/export.
- Card catalog with search by name or database number and filters for grade and clan.
- 10,476 catalog records matched to the supplied card art by numeric image ID.

## Card data and art

The card art came from the folders supplied by the user. Card names and available card details were read from the public Cardfight Area database repository. The repository is community-maintained, not an official Bushiroad API. See [`assets/cards/README.md`](assets/cards/README.md) for provenance, coverage, and local update instructions.

Some source records have no grade or clan field, and some supplied images have no matching text record. Those are labeled as unknown or remain in the image gallery. The online connection uses PeerJS Cloud signaling and a direct browser connection; some restricted networks may not connect. Online matches are not stored on a server. The deck builder does not enforce every Premium rule, handle the G Zone separately, or automate card-specific effects. This is an early online prototype, not a complete or rules-accurate Premium simulator.
