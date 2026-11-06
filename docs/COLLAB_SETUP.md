# DJ OGVHS Collab — invited playlist rooms (development)

**Status:** Implemented on feature/invite-playlist-collab; not deployed to production. Do not expose or publish `collab.ogvhs.com` until the backend and staging domain are configured and tested.

## Listener experience

Invite-only page: `collab.html#invite=PRIVATE_TOKEN`.

- Guests can **type to search**. Local results from `public/catalog.json` are immediate and labeled **In library**.
- After three typed characters and a 400 ms debounce, **Apple's public iTunes Search API** supplies up to 10 additional track suggestions, labeled **Apple Music**. The Apple results are **suggestions only**, not confirmation that DJ OGVHS owns those tracks. We do not use previews or artwork.
- Search stays functional using the local library when Apple's API is unavailable. Guests can also enter an arbitrary song manually.
- A Spotify playlist URL may be submitted as a single contribution. We store the canonical link only; we **do not** fetch playlist contents, import tracks, modify a Spotify account, or claim Spotify login is connected.
- Guests can read recent shared contributions by anyone with the same secret invite. An optional name is visible to all invitees. Avoid sharing the link publicly.
- A room holds up to 500 entries; up to 12 submissions per hour per anonymous browser identity. These are anti-spam measures, not guaranteed one-user-one-identity controls.

Apple Search API documentation: https://performance-partners.apple.com/search-api
Spotify development-mode rules: https://developer.spotify.com/documentation/web-api/concepts/quota-modes

## Administrator experience

Private admin page: `collab-admin.html`, sign in through Supabase Auth with an existing approved account from `dj_admins`.

- Create a room with a title, optional description, expiry (1–180 days), and generated high-entropy invitation.
- Copy the invitation URL **immediately**: the database stores only its SHA-256 digest, not the reusable token. Invite URLs cannot be reconstructed from the database after creation.
- View rooms, close submissions, and reopen a room while its expiry is still valid.

## Request to Collab (no invitation required)

The landing page now includes a **Request to Collab** button revealing a single required email-address field. It works even without a room invitation.

- Visitor submissions are handled by the separate `collab-access` Supabase Edge Function (POST) and stored privately in `dj_collab_access_requests`; never put email addresses in this public GitHub repository, the music catalog, a public Spreadsheet or analytics.
- An email appears in the authenticated DJ-only admin view with Pending / Approved / Declined status and a Copy Email option. **Approval is a review marker only, not an automatic invitation or email**. The DJ can reach out and manually share an invite.
- The form explicitly says the address will be used only for collaboration invitations, not marketing. The endpoint normalizes and deduplicates email addresses, provides a honeypot, and restricts new requests to 3 per browser per 24 hours. This anonymous/browser protection can be bypassed; add managed CAPTCHA or equivalent before widely promoting it.
- Have an email retention/deletion policy and privacy contact method before launch. This feature is not a mailing list or an account-registration system.

## Google Drive folder for each Collab

The invited playlist page now offers file uploads to that room's **own private Google Drive folder**, provisioned from the DJ-only admin screen. A guest must have the private room link; the Google account OAuth credentials stay exclusively in Supabase secrets.

- Supported: MP3, M4A, AAC, WAV, FLAC, OGG, AIFF, MIDI, M3U/M3U8 playlists, CSV, TXT and PDF. Maximum **15 MiB per file**. Up to **5 uploads per browser/hour** and **100 files per room**, enforced by a server-only transactional reservation RPC. Do not treat filenames/MIME as virus scans; guest files may be malicious.
- The Edge Function `collab-upload` streams the accepted file through a **Google Drive resumable upload** in the room's own folder. No Drive credential, private folder ID or file URL is exposed to invited guests. Guest submissions are not automatically played, published or added to the DJ's SQLite catalog.
- Authorized admins can select a room, click **Enable private Drive folder**, inspect completed uploads and open the corresponding Drive folder. Only the admin-facing response contains Google file/folder identifiers. Each room gets a unique folder named with its playlist title and room-id suffix.
- A room can exist without uploads enabled. The guest UI disables uploads until the DJ connects a folder. If Google is not yet authorized, the admin interface reports a setup error instead of claiming an upload succeeded.

**One-time Google setup (must be completed separately):**

1. Enable Google Drive API in a Google Cloud project, configure an OAuth consent screen and OAuth client for the DJ's own Google account, and obtain a secure **offline refresh token** for the narrow scope `https://www.googleapis.com/auth/drive.file`. Follow Google's OAuth server authorization flow with `access_type=offline`; verification/publishing state and Google refresh-token expiry rules matter.
2. Store these only in the Supabase Edge Function secret manager:
   - `DJ_GOOGLE_CLIENT_ID`
   - `DJ_GOOGLE_CLIENT_SECRET`
   - `DJ_GOOGLE_REFRESH_TOKEN`
   - Optional `DJ_GOOGLE_COLLAB_PARENT_FOLDER_ID`. Omit it to create a distinct folder for each collaboration in the connected account's **My Drive root**. For a custom parent, ensure the OAuth app can access that parent.
3. Apply `supabase/migrations/202611060003_collab_access_uploads.sql` after the Collab migration. It adds the private access-request table, private upload log and Drive folder ID per room.
4. Deploy `supabase functions deploy collab-access --no-verify-jwt` and `supabase functions deploy collab-upload --no-verify-jwt`. Both implement admin JWT validation server-side for private routes; guests are accepted only on the documented limited routes. Configure `DJ_COLLAB_RATE_SECRET` and `DJ_ALLOWED_ORIGINS` for **every actual** staging and production domain, including `https://collab.ogvhs.com`.
5. Sign in as the approved DJ administrator at `collab-admin.html`, create a Collab room, click **Enable private Drive folder** on that room, and test uploading a small harmless file as an invited guest. Then confirm it appears in the private Drive folder. Test invalid invites, closed rooms, exhausted upload quota, invalid file extensions, an unavailable Drive account, and size limits.
6. Keep raw Google refresh tokens out of browser JavaScript, code, Issues, logs and screenshots. Connecting Google Drive to ChatGPT **does not** authorize the public website: the server needs its own explicit OAuth grant. Allow sufficient Google Drive storage, watch quotas, and configure abuse protection before production.

For larger WAV/FLAC files, the 15 MiB limit will be insufficient. A later version should use a reviewed large-file storage flow with chunked/resumable transfer, malware checks and tighter spam protection rather than raising the Edge Function limit blindly.

**No real Google Drive folders or Google OAuth credentials are created/configured by these source changes.** Production upload remains unavailable until the Google connection, migrations and function deployment have been completed and tested.

## Backend setup and security

**Prerequisites:** the production Supabase URL/anon publishable key already in `public/app-config.json`, and the `dj_admins` admin-allowlist created by the DJ request migration. The public key is safe in the browser; never ship a service-role key.

1. Review and apply `supabase/migrations/202611060002_collaborative_playlists.sql` after creating `dj_admins`. It creates private `dj_collab_rooms`, `dj_collab_entries`, and a server-only transactional insertion RPC.
2. In Supabase Edge Function secrets, set `DJ_COLLAB_RATE_SECRET` to a newly generated long random secret distinct from other rate-limit secrets.
3. Update `DJ_ALLOWED_ORIGINS` to include **every real site origin** that hosts the new UI (for example, `https://collab.ogvhs.com`, `https://ogvhs.com`, and staging origins). CORS is not a substitute for authorization.
4. Deploy with `supabase functions deploy collab-room --no-verify-jwt`. Guests use private invite tokens; the Edge Function separately validates administrator Bearer JWTs and checks the `dj_admins` allowlist for admin routes.
5. In Supabase Auth URL configuration, allow your trusted preview/admin URL for the magic-link redirect. **Do not enable public admin signup.**
6. For a local UI test, run `npm test && npm run dev` on this feature branch; open `http://127.0.0.1:4173/collab-admin.html`. After creating a room, the displayed URL points to `collab.html#invite=...` on that host. Test an in-library selection, an external Apple suggestion, a Spotify playlist link, a manual track, a duplicate, a closed room, expired invite, 12-per-hour limit, and that uninvited visitors cannot enumerate rooms.
7. Review the new function logs for abuse and unexpected errors. Consider Turnstile/CAPTCHA before broad use. A stolen/shared invite is intentionally equivalent to access; rotate by closing the room and creating another.

Do not insert invite tokens into a Git commit, query-string parameter, GitHub Issue, analytics URL, or email address. They are generated as browser URL **fragments**, which are normally not sent to the web host. The guest app sends the invite token only to the Edge Function in an HTTP header; the server hashes it to match the stored digest. All tables deny direct anonymous PostgREST reads and writes.

## Deployment / subdomain

The current GitHub Pages repository serves `ogvhs.com` from `main`. A separate `collab.ogvhs.com` hostname needs separate static-site hosting (for example a new Cloudflare Pages project) or a deliberate redirect to `https://ogvhs.com/collab.html`; a GitHub feature branch alone **does not** deploy the subdomain. First validate this branch locally and in staging, then configure DNS/HTTPS for the chosen approach. If you deploy the UI under a dedicated subdomain, ensure the relative `./public/catalog.json`, `./public/app-config.json`, CSS and module assets are served there and that the Auth redirect URL is allowed.

## Future additions

- Review, reorder, remove, and export contributions from the private admin (currently room creation and open/closed controls only).
- Optional Spotify OAuth only if its terms and authorized-user limits permit the intended guests.
- Matching external suggestions against your future full approved catalog, without publishing local paths or private metadata.
- Host custom-domain staging before production rollout.

The new collaboration data lives in Supabase, **not** in the local music SQLite database. The local importer and 967-track public catalog stay unchanged.
