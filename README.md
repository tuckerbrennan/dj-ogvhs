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

AWS Amplify hosts the listener site. An AWS HTTP API and Lambda store requests in DynamoDB and enforce the rolling request quota. The private DJ queue uses a separate Amplify deployment and dedicated Cognito owner authentication. The Amplify build uses `OGVHS_API_URL` to write the public AWS endpoint into its artifact configuration; the source Supabase configuration remains only for the preserved GitHub Pages rollback origin. Never commit runtime credentials or listener records.

The admin frontend and backend deployment source are maintained privately. Request reads and edits require a valid JWT from the dedicated OGVHS Cognito pool and membership in its owner group.

Catalog import guidance lives in `docs/CATALOG_IMPORT.md`. Actual audio files are not served by this repository. Venmo and Cash App profile links are connected. PayPal uses the supplied email and Zelle uses the supplied phone number; listeners complete tips with the provider. External song autocomplete remains future work.

## Architecture and AWS deployment

The public website and private admin have completed their AWS cutover, verified by live DNS, HTTPS, artifact configuration and request/admin API tests. See [Current architecture and AWS cutover](docs/CURRENT_ARCHITECTURE_AND_AWS_CUTOVER.md) for the updated live snapshot and historical plan. Existing Google Drive and Mixcloud embeds remain; S3/native audio is a separate follow-up. Supabase records and the old origins remain preserved for rollback, with old request/admin writes paused.
