# Collab beta deployment — Vercel

## Purpose
This branch serves DJ OGVHS Collab at a separate beta origin such as https://collab.ogvhs.com.
It does not merge into the main site, link from the live site, or use the production song-requests database.

## Existing source
- Source branch: `feature/invite-playlist-collab`, draft PR #13.
- Deployment branch: `deploy/collab-beta` (this branch).
- Isolated backend: Supabase **DJ OGVHS Collab Staging**, project ref `pgufhgmkqgpjoddxvzoa`.
- Live Requests backend must remain untouched.
- Google Drive refresh-token secret was renewed by the owner on Nov 8, 2026; a fresh end-to-end upload test is still needed.

## Vercel project
1. Create a **separate Vercel project**, connected to `tuckerbrennan/dj-ogvhs`.
2. In project Settings → Environments → Production → Branch Tracking, set **`deploy/collab-beta`** as the production branch (not `main`). Production-branch settings may need to be changed after the first import.
3. Configure the following Vercel Environment Variables for Production and Preview:
   - `OGVHS_COLLAB_SUPABASE_URL`: Copy exact Project URL from **DJ OGVHS Collab Staging** → Project Settings → API.
   - `OGVHS_COLLAB_PUBLISHABLE_KEY`: Copy **publishable** key from the same staging project's API Keys. Never use a secret or service-role key.
4. Redeploy this deployment branch. The built output consists of Collab listener/admin pages, browser assets, reviewed public music catalog, and staging-only browser config. Build fails closed if either variable is missing or if the URL targets the production Requests project.
5. Add `collab.ogvhs.com` under Vercel project Domains, and create the **exact** DNS record suggested by Vercel at the domain's DNS provider. Keep the main `ogvhs.com` DNS records unchanged.
6. In staging Supabase Edge Function secrets, add the beta domain to the comma-separated `DJ_ALLOWED_ORIGINS`, preserving existing origins. Never overwrite the rate secret or Google OAuth secrets.
7. In staging Supabase Auth → URL Configuration, add `https://collab.ogvhs.com/collab-admin.html` to the permitted redirect URLs; do not permit unapproved admin registration.
8. Check HTTPS, owner magic-link sign-in, creating a room, sharing invite by fragment, Apple autocomplete, adding a suggestion, request-to-collab inbox, private Drive folder creation and one TXT upload. Verify the Drive folder is *not* public.
9. Do **not** link the beta from the production homepage yet. Keep PR #13 in Draft until beta review.

## Privacy and access warning
The Collab rooms require secret invitations for contributions. However, the landing page and request-to-collab email form are visible to anyone who visits the host. An unlinked URL and `noindex` are **not** a password or access control. Vercel deployment authentication that protects preview deployments may not protect production custom domains on free plans. If complete privacy is required, add real access control before attaching a production domain.

## Deployment source build
`vercel.json` uses Node to run `scripts/build-collab-beta.mjs` and serves only `dist`.
The generated config has **only** the staging Supabase public browser key, never a service role token or Google credential.
The beta root loads Collab, not the regular Requests homepage.

## Current blocker
The ChatGPT Supabase connector can see the DJ OGVHS organization but returns zero accessible projects. The staging backend works according to PR #13 verification, but the assistant cannot directly change project secrets or independently confirm the freshly renewed Google OAuth credential without project permissions. The Vercel connector is installed; deployment actions need to be available to complete the hosting and custom-domain setup.
