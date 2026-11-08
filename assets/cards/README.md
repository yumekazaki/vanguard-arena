# Card catalog and card art

The site includes a searchable card catalog and card images for the available Vanguard cards.

- `catalog-data.js` contains the card records used by the library and deck builder.
- `source-text/` contains the source data used to rebuild the catalog.
- `source-art-overrides.json` lists cards whose matching images come from the pinned upstream database snapshot.
- `full/` and `mini/` contain the images already bundled with this site. Cards in the override list use their matching images from the pinned upstream image archive to keep the GitHub Pages package within a practical size.
- `cards.js` contains manually added alternate-art entries from the supplied CardSprite folder.
- `art-index.js` lists image numbers for the image gallery.

## Catalog coverage

The catalog contains 14,022 records from the Cardfight Area community database snapshot at commit `c2a5aad1f1e348500f1942a890c7e39a95953719` (May 9, 2025). It adds 3,546 records beyond the previous website catalog. The matching remote images are pinned to that same commit, so each card's artwork stays aligned with its data.

The official card-list website was showing a maintenance page during this update. This is the latest complete public database snapshot I could verify, but it does not confirm releases published after May 9, 2025.

The snapshot omitted grades for some older records. grade-corrections.json restores the printed grades for 477 units by reading their matching card images from the pinned image archive. Oracle Guardian, Hermes remains unknown because it is an unreleased anime-only entry with no printed card grade; Energy Generator is a Ride Deck Crest rather than a unit.

## Rebuilding the catalog

From the repository root, run:

```sh
node assets/cards/import-cards.js
```

The source data is community-maintained and is not a Bushiroad API. Keep the attribution and source date with this project. Card text and images belong to their respective rights holders; publish them only as permitted.



## Official English release additions through November 8, 2026

`official-catalog-data.js` adds 2,524 card definitions missing from the site catalog after comparing it with Bushiroad’s official English card list and released products. The checked release window is May 10, 2025 through November 8, 2026; the latest released booster included is DZ-BT16, Parallactic Dawn (October 30, 2026). Announced products after November 8 are excluded. Six October–November 2026 promo cards absent from the searchable card list were transcribed from their official Bushiroad card images and retain links to that artwork.

The supplement keeps official card numbers, text, card properties, product/release metadata, and official artwork URLs. It is loaded after the existing catalog instead of rebuilding or replacing `catalog-data.js`. Ninety-two official entries have no rules-text string in the source listing; they remain blank rather than receiving invented text.

Adding card data does not mean every new card ability has an implemented or verified effect handler. Ability support remains tracked separately in the rules engine. Official artwork is linked from Bushiroad’s site rather than copied into this repository; retain the existing rights and attribution notes above.
