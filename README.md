# DJ OGVHS

A mobile-friendly song and mashup request web app for DJ OGVHS.

**Status:** Catalog preview is live in the repository. The request submission endpoint and private DJ dashboard have been implemented on a development branch, but **are not connected to a Supabase project or deployed for real requests**. External autocomplete and tipping are not built.

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

### In development (not yet enabled on the public preview)
- Listener manual song entry and validated song/mashup submission.
- Supabase-backed request storage, rate-limited submission endpoint, and authenticated private DJ queue.
- Admin request status, BPM, and manual ordering controls.

### Still to do
- Provision Supabase and enable real submissions after testing.
- Import approved tracks from the iMac catalog.
- External song autocomplete, stronger bot protection, public backend deployment, and actual Venmo/PayPal links.

## Catalog data

The default `public/catalog.json` is intentionally an empty array until reviewed songs have been approved. See [Catalog import and privacy guidance](docs/CATALOG_IMPORT.md) for the export and curation commands.

## Project planning

- [Product requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Feature backlog](https://github.com/tuckerbrennan/dj-ogvhs/issues)
- [Catalog import procedure](docs/CATALOG_IMPORT.md)
- [Private request backend setup](docs/BACKEND_SETUP.md)

The actual music files are **not** served or stored in this repository.
