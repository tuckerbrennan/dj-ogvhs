# DJ OGVHS — AWS Amplify Hosting migration

Status: **GitHub source prepared; AWS app and DNS cutover require confirmation.**

## Scope
Migrate **listener frontend only** (`ogvhs.com` and optionally `www.ogvhs.com`) from GitHub Pages to AWS Amplify Hosting. Do not migrate or alter Supabase, `admin.ogvhs.com`, `contact.ogvhs.com`, `collab.ogvhs.com`, or any other DNS record.

## GitHub build
- Repository: `tuckerbrennan/dj-ogvhs`
- Production branch: `main`
- Build spec: `amplify.yml`
- Build command: `node scripts/build-hosting.mjs` (`npm run build:hosting` is equivalent)
- Output directory: `dist`
- Only root website HTML, `src/`, and `public/` are copied. `CNAME`, tests, docs, scripts, and repository metadata stay out of the published site.
- No additional npm dependencies or private deployment tokens required.

## AWS deployment / cutover
1. Open AWS Amplify in the chosen region (prefer **us-east-2**, alongside the ACS app).
2. **Create new app → GitHub**; connect repository `tuckerbrennan/dj-ogvhs` branch `main`.
3. Name the app `dj-ogvhs-web`. Use the repository's `amplify.yml` (publishes `dist`). Save and deploy.
4. **Do not change DNS yet.** Test the generated `https://main.<new-app-id>.amplifyapp.com/` for navigation, asset loading, catalog search, page links, demo mode (`?demo=1`), social/tip links, and browser console errors.
5. The listener makes cross-origin requests to a Supabase Edge Function `submit-request` for quota and submissions. Confirm that the new Amplify hostname is included in any server-side CORS/allow-origin settings before testing a real request. Never enable an unsafe wildcard for authenticated/private endpoints. The preview hostname can use demo mode until configured.
6. In the NEW Amplify app, add custom domain `ogvhs.com` after all checks pass. Map apex to `main` and `www` as a redirect/alias as desired. Use Amplify-managed SSL. Record the DNS values AWS shows; configure only the `@`/`www` records with the actual DNS provider. Keep all existing `admin`, `contact`, `collab`, TXT, MX and other DNS records.
7. Once the domain reports available and HTTPS loads in a clean browser, test production catalog search and **one real request** through the Supabase backend, verifying receipt in the private queue. Test the 3-request quota without exceeding the limit.
8. Once verified, remove the stale GitHub Pages custom-domain configuration from GitHub settings as appropriate and, in a follow-on commit, retire the repository-root `CNAME` file. **Do not remove either before the AWS certificate and domain are ready** if it would cause downtime or confusion.

## Important risks
- The **same** production host `https://ogvhs.com` should preserve allowed origins for the live backend, but the temporary Amplify host and optional `www` host may require CORS allowlisting.
- Public `app-config.json` contains only a publishable Supabase key; never add a secret or service-role key.
- Catalog JSON is roughly 346 KB; verify it and branded images appear intact.
- Amplify can fail certificate issuance when stale DNS records remain or the hostname is associated with another CloudFront distribution. Check ownership before editing/removing any unrelated distribution.

## Rollback
Until the original GitHub Pages site is disabled, preserve its existing configuration. If a cutover causes problems, restore the previous **exact** apex/`www` records from the DNS provider's record history or a saved pre-cutover snapshot, allow them to propagate, and verify the old site works before retrying. Do not overwrite unrelated DNS records.
