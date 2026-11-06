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
