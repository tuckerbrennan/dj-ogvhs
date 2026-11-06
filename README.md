# DJ OGVHS

Music requests at https://ogvhs.com/ and the owner-only DJ view at https://admin.ogvhs.com/.

## Listener experience

- Search the reviewed catalog by title, artist, album, or genre.
- Request a song or a two-song mashup, using catalog selections or manual entry.
- Submit without a listener account. The server limits each browser to three accepted requests per rolling hour.
- Confirmation appears after the server acknowledges storage. Demo mode (`?demo=1`) uses fictional songs and never sends real requests.
- About page, social profiles, vinyl favicon, and social preview.

## Run locally

Requires Node 20 or later. Run `npm test`, then `npm run dev` and open the printed local address. Local live submissions require an explicitly allowed development origin; demo mode works without a backend connection.

## Hosting and data

GitHub Pages hosts the listener site. Supabase stores requests and enforces private queue access. `public/app-config.json` contains only the project URL and public browser key. Never commit secret/service-role keys or listener records.

The admin frontend and backend deployment source are maintained privately. Visiting the admin address requires owner access; request reads and edits additionally require the approved DJ identity.

Catalog import guidance lives in `docs/CATALOG_IMPORT.md`. Actual audio files are not served by this repository. Venmo and Cash App profile links are connected. PayPal uses the supplied email and Zelle uses the supplied phone number; listeners complete tips with the provider. External song autocomplete remains future work.
