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

## Rebuilding the catalog

From the repository root, run:

```sh
node assets/cards/import-cards.js
```

The source data is community-maintained and is not a Bushiroad API. Keep the attribution and source date with this project. Card text and images belong to their respective rights holders; publish them only as permitted.
