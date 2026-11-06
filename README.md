# DJ OGVHS

A mobile-friendly song and mashup request web app for DJ OGVHS.

**Status:** Catalog browser and safe import tooling are in early development. Request submission, music API fallback, admin authentication, tipping and public hosting are **not built yet**.

## Run the catalog preview

Requires Node 20+ on your computer.

```sh
npm test
npm run dev
```

Open http://127.0.0.1:4173/ in your browser. To try the interface with **clearly fictional demonstration songs**, open http://127.0.0.1:4173/?demo=1 .

### Currently implemented
- Two prominent modes: **Request a Song** or **Request a Mashup**, with one or two catalog selections.
- Mobile-responsive, case-insensitive title/artist/album search.
- Safe CSV/JSON importer for reviewed tracks from the Google Sheet snapshot or the iMac SQLite export.
- Default-deny publishing: only rows explicitly marked Yes, with artist and title, are output.
- No private file paths, cloud file IDs, local source addresses, or raw inventories published.

### Not yet implemented
- Persisting/submitting requests; the preview does not send anything.
- External song autocomplete and manual fallback.
- Private admin dashboard, spam controls and public deployment.
- Actual Venmo/PayPal links.

## Catalog data

The default `public/catalog.json` is intentionally an empty array until reviewed songs have been approved. See [Catalog import and privacy guidance](docs/CATALOG_IMPORT.md) for the export and curation commands.

## Project planning

- [Product requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Feature backlog](https://github.com/tuckerbrennan/dj-ogvhs/issues)
- [Catalog import procedure](docs/CATALOG_IMPORT.md)
- [Local library indexing](docs/LOCAL_LIBRARY_UPDATER.md)

The actual music files are **not** served or stored in this repository.
