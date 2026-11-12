# Mixes

The Mixes navigation opens `mixes.html`. OGVHS Faves is a handpicked selection of DJ OGVHS's own mixes, configured in `public/featured-mixes.json`. It does not use Mixcloud's favorites feed. The selection is empty until the DJ provides picks.

To add a pick, add an object to the JSON `data` array with the show's `key` (for example `/djogvhs/show-slug/`), its verified `name`, and optionally `user: {"name": "DJ OGVHS"}`. Array order controls display order, up to twelve picks. Only `/djogvhs/` shows are accepted. Use actual public show details; do not invent selections.

Latest Mixes automatically displays the six newest uploads from djogvhs through Mixcloud's public API. Each section uses official embedded players. No credentials or audio files are stored here. Mixcloud controls availability, including subscriber-only shows.

Loading, empty, and failed states are handled separately, with retry buttons and direct Mixcloud links. Players do not autoplay. The layout uses two columns on desktop and one on smaller screens.

## Exclusive mixes (Too Hot for Mixcloud)

The public page loads published mixes from the Supabase `dj_mixes` table using the existing **publishable** key in `public/app-config.json`. These embed as Google Drive audio previews inside the browser; visitors can also open the file in Drive if an iframe is blocked on their device. No Supabase secret or Google OAuth token reaches the public page. If the database table is not set up yet, the site falls back to `public/drive-mixes.json`; a valid fallback entry is `{"mixes":[{"title":"Example set","description":"Optional","url":"https://drive.google.com/file/d/FILE_ID/view"}]}`. The Drive file must have **Anyone with the link → Viewer** access. Unsupported links are skipped.

The private upload manager is developed in `tuckerbrennan/dj-ogvhs-admin` at `/mixes.html` and supports uploading to Google Drive, publishing/unpublishing, adding existing Drive share links, and removing metadata (never deleting the original file). It uses the existing owner-only site identity and a server-only Supabase secret to manage the `dj_mixes` metadata. Refer to that repository's `docs/MIX_UPLOADS.md` for setup. Google Drive remains the audio host; OGVHS is the player. Drive sharing does not grant music distribution rights.
