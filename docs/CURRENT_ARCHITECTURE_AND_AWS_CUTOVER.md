# DJ OGVHS — Current architecture and AWS cutover

## Live AWS cutover completed

The production domains `ogvhs.com`, `www.ogvhs.com` and `admin.ogvhs.com` now resolve through AWS CloudFront/Amplify under Route 53 DNS. Live HTTPS and the AWS website build marker were verified after the coordinated switch. The website uses the AWS request API, Lambda and on-demand DynamoDB; admin routes require dedicated OGVHS Cognito JWTs and the owner group. Real API smoke checks passed for submissions, rolling three-per-hour quota, idempotent retries, protected queue access, status/BPM updates and atomic reorder. Synthetic test records/identity were removed.

The public deployment builds GitHub `main` on Amplify with `OGVHS_API_URL` configured. Browser request modules were versioned for the cutover. Private backend/IaC, exact resource IDs, encrypted backup location, DNS rollback and SQL to restore Supabase writes are in `tuckerbrennan/dj-ogvhs-admin/aws/`. Backend resources retain their original staging names but now serve the production domains.

The original Supabase records are preserved, with old submission/admin write privileges paused to prevent split writes. GitHub Pages and the prior Sites admin remain rollback origins. Rollback must reconcile new AWS activity before restoring traffic. Mail, contact, collaboration, archive, social/tip links and Mixcloud were preserved. Four Google Drive mixes remain visible, Brian first; the S3/native audio work is deferred.

**The remainder of this document is the historical pre-cutover plan. Its statements about current GitHub hosting, inaccessible Supabase, or unprovisioned AWS resources are superseded by this live snapshot.**


**Snapshot:** November 15, 2026 (America/New_York)  
**Scope:** DJ OGVHS listener website, AWS static hosting, and exclusive audio streaming. Not an ACS-suite migration.  
**Status:** GitHub configuration reviewed; production DNS/origin and AWS resources **not independently verified**. This is a proposed cutover, not a completed deployment.
**Notion documentation copy:** [DJ OGVHS architecture and AWS cutover](https://app.notion.com/p/419d600b5cc98132aed5eabeb97dae48). The GitHub runbook is the authoritative source for deployment instructions.

## Status conventions

- **Verified in source:** observed in GitHub repositories or linked provider response on November 15, 2026.
- **Documented:** historical repository notes; still needs live verification.
- **Proposed:** desired architecture, not provisioned.
- **Unverified:** no reliable live inventory or end-to-end test.

## 1. Executive architecture summary

The public **dj-ogvhs** GitHub repository is public, default branch **main**, and contains a static responsive listener site. README.md documents **GitHub Pages** hosting; CNAME contains ogvhs.com. This identifies the repository's intended/current configuration, **not proof of the actual current DNS or origin**. GitHub Pages settings, public DNS answers, live site response and certificate must be inspected before touching DNS.

A second, **private** repository, tuckerbrennan/dj-ogvhs-admin, holds the owner-only DJ queue interface and backend worker. Its code describes an authenticated ChatGPT Sites/Worker-style runtime, plus a server-side Supabase credential. Do not publish its environment variables, replicate private server code to the public site, or assume the admin runtime is part of the static listener site's build.

Supabase is the request data/backend provider. The browser uses a public Supabase URL and publishable key; src/request-api.mjs makes GET and POST calls to /functions/v1/submit-request for server-side quota and durable request submission. The backend contains a private dj_requests queue and, for exclusive mix metadata, the site optionally reads a published dj_mixes view/table. Three accepted requests per browser per rolling hour is the intended rule; live server enforcement needs verification.

**Outstanding Supabase access concern:** On November 15, the connected Supabase organization DJ OGVHS was visible on Free tier, but it listed zero accessible projects and a lookup of the frontend's configured project returned permission denied. This does not prove deletion or pause. Confirm the correct account/org, database health, backups and Edge Function before proceeding.

Vercel is connected to a **separate collaboration beta project** named dj-ogvhs-collab-beta. Its successful GitHub commit checks do not certify AWS deployment or the production ogvhs.com site. Preserve collab.ogvhs.com and all other auxiliary DNS records during the cutover.

## 2. Logical dependency map

~~~text
Listener: ogvhs.com (historically documented as GitHub Pages)
  GitHub tuckerbrennan/dj-ogvhs / main
  |-- HTML/CSS/ES modules: home, mixes, about, privacy, thanks
  |-- public/catalog.json: local searchable DJ music catalog
  |-- public/app-config.json: Supabase URL + publishable browser key
  |     |-- Edge Function: GET/POST submit-request
  |     |-- database: dj_requests (private listener submissions)
  |     |-- database: dj_mixes (published Drive mix metadata, optional)
  |-- public/featured-mixes.json + Mixcloud public API -> Mixcloud embeds
  |-- public/drive-mixes.json -> legacy Google Drive embedded audio
  |-- public/hosted-mixes.json -> OGVHS native audio player (unpublished)
  |-- public/analytics-config.json -> GTM, opt-out/GPC
  +-- public/tip-config.json -> external tips (no internal payment capture)

Private admin: admin.ogvhs.com (separate deployment)
  GitHub tuckerbrennan/dj-ogvhs-admin (private)
  Authenticated Worker/API -> Supabase secret -> private DJ queue
  Owner-only identity check, status/BPM changes, manual reordering

Collaboration beta: separate Vercel dj-ogvhs-collab-beta project

Proposed:
  GitHub main -> AWS Amplify static site (us-east-2) -> ogvhs.com/www
  Private OGVHS S3 (us-east-2) -> CloudFront OAC -> media.ogvhs.com
  Supabase / admin / Mixcloud / collab remain unchanged in phase 1
~~~

## Pre-cutover release decision — 2026-11-15

- **On GitHub Pages (before AWS cutover):** Show **Cleandrick Lamar** as a visible, non-playable **Coming with our AWS launch** card in the public Mixes page. Its source Drive file is private and must not be exposed as a public iframe or direct URL.
- **Keep the old experience working:** `mixes.html` loads `src/drive-mixes-github.mjs` on GitHub Pages, which uses the previously shipped Google Drive embeds for already-shareable recordings; existing Mixcloud embeds remain unchanged.
- **Native player is AWS-only:** `scripts/build-hosting.mjs` switches the built `dist/mixes.html` to `src/drive-mixes.mjs` (native HTML5 audio and Media Session) and removes the temporary GitHub-only teaser. Native audio is still gated by `public/hosted-mixes.json` and valid AWS media URLs; all exclusive hosted entries remain unpublished until their playback passes acceptance tests.
- **Cutover priority:** Do not enable native audio on GitHub Pages, expose the private source Drive file, or publish broken AWS media links ahead of cutover.

## 3. Repository component inventory

| Item | Files / provider | Current role and state |
| --- | --- | --- |
| Public pages | index.html, about.html, mixes.html, privacy.html, thanks.html | Frontend source exists; live deployed revision not verified |
| Catalog | public/catalog.json, scripts/build-catalog.mjs | Searchable static catalog, not audio delivery |
| Requests and quota | src/request-api.mjs, src/request-quota.mjs | Supabase Edge Function, browser UUID, rolling hourly quota |
| Admin | Private dj-ogvhs-admin repo: worker/server.mjs and assets | Authenticated queue and management API; leave in place |
| Mixcloud | src/mixes.mjs, public/featured-mixes.json | Curated and newest show embeds; preserve |
| Google Drive | public/drive-mixes.json | Tom Waits Forever and Amy 2 Electric Boogaloo fallback links; preserve until streaming works |
| Native player | src/drive-mixes.mjs, src/drive-mixes-model.mjs, src/mixes.css | Native audio, metadata, seek, transport/Media Session controls; merged in PR #17 |
| Hosted mix manifest | public/hosted-mixes.json | Brian Wilson Forever, Amy 2 Electric Boogaloo, Cleandrick Lamar; all unpublished and without active audio_url |
| Analytics | src/analytics.mjs, public/analytics-config.json | GTM, opt-out and Global Privacy Control |
| Tips | public/tip-config.json | External provider links; no embedded processor |
| AWS web build | amplify.yml, scripts/build-hosting.mjs | Prepared to publish dist; does not prove AWS deployment |
| Validation | package.json, tests/, .github/workflows/catalog-checks.yml | Node tests and CI; GitHub/Vercel checks do not prove AWS deployment |
| Legacy custom domain | CNAME | ogvhs.com mapping for GitHub Pages; do not retire early |

**Build contract:** Node >=20; npm test; npm run build:hosting. The Amplify spec calls node scripts/build-hosting.mjs and publishes dist. Only the five public root HTML files plus src/ and public/ are copied; tests, docs, source media and admin files are excluded. The build inserts the hidden OGVHS_AWS_AMPLIFY_BUILD marker in index.html for cutover verification. Public configuration must never include Supabase service-role/secret keys.

**Audio publication contract:** src/drive-mixes-model.mjs validates HTTPS audio on media.ogvhs.com, ogvhs.com or www.ogvhs.com under /mixes/ or /media/, with supported file suffixes. New hosted entries take priority over duplicate Drive entries. The native player is code-complete enough for browser testing but no verified AWS audio URLs are published. Background/lock-screen/Bluetooth behavior varies by platform and requires real-device tests. This is not a persistent player across page navigation.

## 4. Exclusive mix source inventory

| Title | Verified source | AWS publication |
| --- | --- | --- |
| Brian Wilson Forever | Brian Wilson Memorial.wav, 641,736,132 bytes, Google Drive owner-only | Not published |
| Amy 2 Electric Boogaloo | Amy 2 Electric Boogaloo .wav, 586,568,368 bytes, Drive link-viewable | Temporary Drive fallback; AWS not published |
| Tom Waits Forever | Tom Waits Forever.wav, 914,167,126 bytes, Drive link-viewable | Temporary Drive fallback; AWS not published |
| Cleandrick Lamar | Cleandrick Lamar.m4a, 804,383,885 bytes, Google Drive owner-only; confirmed November 15 | In manifest but not published |

Original Drive IDs and previous planning notes: docs/OGVHS_EXCLUSIVE_AUDIO_AWS.md. Do not change sharing permissions of private originals or publish their original links. User-supplied artwork has not yet been committed to public/mix-art; remove invalid artwork references or install valid files before publication. Confirm public distribution rights before publishing any mix.

## 5. Proposed AWS target topology

1. **Website:** Create a dedicated AWS Amplify Hosting application named dj-ogvhs-web in us-east-2. Attach GitHub tuckerbrennan/dj-ogvhs main and use the committed amplify.yml with dist artifacts. Deploy a generated Amplify test hostname before touching production DNS.
2. **Audio:** Create a separate OGVHS-only private S3 bucket in us-east-2, with block-all-public-access, encryption, versioning, scoped upload roles, cost monitoring and a backup/retention policy. Bucket name to be determined from real AWS inventory; do not reuse any ACS or SampleHoarder bucket.
3. **Distribution:** Configure CloudFront with S3 Origin Access Control, scoped bucket policy, and HTTPS-only media. Use media.ogvhs.com as the preferred audio host; no public-read S3 ACL/policy. Request/validate CloudFront ACM certificate in us-east-1. Use the actually authoritative DNS provider; do not assume Route 53.
4. **Audio objects:** Keep original masters private. Inspect codec and duration with ffprobe; encode or repackage suitable AAC/M4A output as needed with correct audio/mp4 content type and faststart for efficient playback. Confirm HTTP 200 and byte-range HTTP 206 responses, including seek to the middle/end.
5. **Publication:** Upload, verify and preview each mix; then add the validated CloudFront audio_url and set published:true for **only** that mix. Ensure referenced cover art exists. Do not remove Drive fallback until the new stream is demonstrably better.
6. **Unchanged:** Supabase database/functions, private DJ admin, Vercel collaboration beta, contact subdomain, Mixcloud embeds, social/tip links. Database migration is a separate scoped project, not part of the first AWS website cutover.

## 6. Cutover runbook with go/no-go gates

### Phase 0 — Read-only discovery and baseline

- [ ] Verify AWS identity, account and region; earlier guarded scripts expect account 242088067567, but actual caller identity is authoritative.
- [ ] Inventory Amplify applications, S3 buckets, CloudFront distributions/aliases, ACM certificates and Route 53 zones in us-east-1/us-east-2 as applicable.
- [ ] Discover registrar and authoritative nameservers; export existing DNS values, including apex, www, admin, collab, contact, MX, TXT, SPF/DKIM/DMARC and CAA.
- [ ] Verify actual ogvhs.com hosting via DNS and HTTP headers, plus GitHub Pages settings and TLS. Preserve old origin and capture exact rollback records.
- [ ] Resolve Supabase access anomaly; verify backend state, approved origin/CORS, one allowed real request and protected queue read. Stop if not healthy.
- [ ] Run npm test and npm run build:hosting; verify dist output and marker; record source commit SHA.
- [ ] Baseline test home, catalog, song/mashup request, confirmation, quota, admin permissions, mixes, links, analytics, mobile and accessibility.

**Gate 0:** DNS/provider, old origin, Supabase health and rollback targets known; no production changes otherwise.

### Phase 1 — Parallel website staging

- [ ] Create dedicated Amplify app in us-east-2; connect GitHub main and committed build spec.
- [ ] Record AWS app ID, successful deployment ID, branch, commit SHA, staging hostname and service ownership.
- [ ] Test every page/asset on the generated hostname; check browser console, security headers, redirects and no private files.
- [ ] Whitelist temporary hostname in Supabase server-side CORS only if required; never enable wildcards for private endpoints.
- [ ] Test a real permitted request end-to-end. Do not treat ?demo=1 as production-backend verification.

**Gate 1:** AWS staging is functionally equivalent, and the admin and request service work unchanged.

### Phase 2 — Private audio CDN and publishing

- [ ] Create private S3 OGVHS bucket and CloudFront OAC distribution; issue ACM certificate in us-east-1 and bind media.ogvhs.com through confirmed DNS authority.
- [ ] Validate S3 public-access block and that CloudFront alone can fetch private objects.
- [ ] Download originals using authenticated Google Drive access. Verify filenames, sizes, codecs, available workspace/disk and streaming output.
- [ ] Use scripts/upload-exclusive-mixes-aws.sh only after the dedicated bucket exists; it guards AWS account/region and blocks public buckets. Upload all four tracks and verify HEAD Content-Type audio/mp4 and Range Content-Range/206 behavior.
- [ ] Stage and verify actual cover images; edit public/hosted-mixes.json entries one by one, only after live media URLs play.
- [ ] Test iPhone Safari, Android Chrome, desktop, headphones/lock screen/Bluetooth where supported; prevent multiple tracks playing simultaneously.

**Gate 2:** No published broken links, media stays private in S3, every enabled track streams and seeks correctly.

### Phase 3 — Domain switch (listener site only)

- [ ] Add ogvhs.com and optional www to new Amplify app and validate HTTPS/cert; use only actual AWS-provided DNS targets.
- [ ] Change only apex/www DNS during a controlled window. Do not change admin.ogvhs.com, collab.ogvhs.com, contact.ogvhs.com or mail records.
- [ ] Verify multi-resolver DNS and HTTPS; confirm public home contains the AWS build marker and the expected GitHub commit is deployed.
- [ ] Repeat smoke tests: catalog, real request/receipt in protected queue, quota, admin identity, status edits, Mixcloud embeds, Google Drive fallbacks, native streaming, analytics opt-out and external links.
- [ ] Watch AWS logs, CloudFront 4xx/5xx, S3 errors, Supabase function errors and unexpected costs. Leave the old origin intact during acceptance.

**Gate 3:** New site works with production backend, private admin unaffected, media passes devices. Only then retire stale GitHub Pages CNAME/domain binding as appropriate.

### Phase 4 — Operate and document

- [ ] Save actual AWS IDs, DNS snapshot, provider, owner, change window, resource tags, rollback targets and secrets locations in **private** operational documentation; no secrets in the public repo.
- [ ] Configure AWS Budgets/CloudWatch and CDN logging. Monitor egress costs, errors and cache hit ratio.
- [ ] Document repeatable GitHub main -> Amplify deployment, commit verification, exclusive mix upload/publish/unpublish and media cache invalidation.
- [ ] Update README and older docs with the observed post-cutover state. Decide separately whether/when Supabase is migrated.

## 7. Verification commands (read-only examples)

~~~bash
npm test
npm run build:hosting
grep -q OGVHS_AWS_AMPLIFY_BUILD dist/index.html

aws sts get-caller-identity
aws amplify list-apps --region us-east-2
aws cloudfront list-distributions
aws s3api list-buckets

# Only after the CDN is configured:
curl -sSI https://media.ogvhs.com/mixes/cleandrick-lamar.m4a
curl -sS -D - -o /dev/null -H 'Range: bytes=0-1023'   https://media.ogvhs.com/mixes/cleandrick-lamar.m4a
~~~

Expected media: valid HTTPS, audio/mp4, HTTP 206 and Content-Range for a valid range, play/pause/seek on real devices. A 200/206 alone is not enough to confirm a user can listen.

## 8. Rollback and safety

- **Website/DNS/TLS:** Restore exact saved old apex/www DNS records only; verify old HTTPS frontend and keep all other subdomains untouched.
- **Request outage:** Stop cutover; changing the static frontend does not fix an inaccessible Supabase project. Restore Supabase connectivity and CORS while preserving private RLS/credentials.
- **Audio issue:** Unpublish only the failing entry or revert the manifest commit. Preserve original Google Drive bytes and legacy published fallbacks. Diagnose CloudFront OAC, S3 key, MIME, range/cache.
- **High AWS transfer costs:** Disable new media publication and inspect CloudFront/S3 metrics before scaling. Keep budget alarms and legal permissions current.
- **Admin failure:** Keep the owner-only authenticated admin deployment and secrets separate; never place admin code or keys on an anonymous static site.

Rollback is complete when the public site opens, a permitted real request persists (when the backend is healthy), and the owner can read/update it in the private queue.

## 9. Unresolved evidence and source references

**Before any DNS change, confirm:** authoritative DNS/old host; actual AWS inventory; Supabase access; admin live access; rights/permissions for mixes and cover art; audio transfer mechanism; AWS budget thresholds; planned cutover window.

Sources reviewed:
- Public repo: https://github.com/tuckerbrennan/dj-ogvhs
- Private admin repo (access controlled): https://github.com/tuckerbrennan/dj-ogvhs-admin
- Prior AWS site guide: docs/AWS_AMPLIFY_MIGRATION.md
- Audio details: docs/OGVHS_EXCLUSIVE_AUDIO_AWS.md
- Public request and mixes code: src/request-api.mjs, src/drive-mixes.mjs, src/mixes.mjs
- Build spec: amplify.yml and scripts/build-hosting.mjs
- Vercel connected project inventory and Supabase connected organization inquiry on November 15, 2026.

**Change log — November 15, 2026:** Architecture snapshot and staged AWS plan only. No AWS resources, DNS records or public audio were created or changed by this documentation.
