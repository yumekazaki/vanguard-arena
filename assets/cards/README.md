# Card catalog and card art

The local prototype includes the card pictures you supplied:

- `full/n<number>.jpg` contains the larger pictures.
- `mini/n<number>.jpg` contains the smaller gallery pictures.
- `catalog-data.js` contains card names and available card details joined to the picture with the same database number.
- `art-index.js` lists the picture filenames for the image gallery.
- `import-cards.js` rebuilds the catalog from the included `source-text/` files.

The Card Library and deck builder can search card names/numbers and filter by grade and clan. The card data was taken from the public Cardfight Area database repository: <https://github.com/justkidding047356/cardfight-area>. This is a community-maintained data export, not a Bushiroad API. The official card-list link is included in the site for reference.

The supplied art contains 10,482 mini images and 10,481 full-size files. The generated catalog contains 10,476 records with matching images. The source text provides a grade for 9,583 records and clan data for 8,693; records without a source value are labeled as unknown and can be found with the corresponding filter option. Several image-only files have no matching record in the text data.

The app matches images to card records by the shared numeric database ID in `n<number>.jpg`. Example: database entry 1, Flogal, uses `full/n1.jpg`.

To add or correct a card manually, add a record to `cards.js`:

```js
window.USER_CARDS = [
  {
    id: "my-unique-card-id",
    name: "Verified card name",
    grade: 1,
    clan: "Royal Paladin",
    power: 8000,
    shield: 5000,
    type: "Unit",
    text: "Card text you are authorized to use.",
    image: "assets/cards/full/n123.jpg"
  }
];
```

Decks are saved in this browser and can be exported as JSON. The current deck builder does not validate every Premium rule or manage the G Zone separately.

Before publishing the site, make sure you have permission to publish card images and text. Keep the included attribution and source notes with this local project.
