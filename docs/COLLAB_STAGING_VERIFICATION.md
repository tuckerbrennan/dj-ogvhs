# Collab staging verification — November 7, 2026

PR #13 remains draft. Production main and the existing Requests backend have not been changed.

## Staging backend

Separate Supabase project: `pgufhgmkqgpjoddxvzoa` (DJ OGVHS Collab Staging).

- Both Collab migration files applied and recorded in migration history.
- Minimal admin prerequisite created separately: dj_admins UUID foreign key to auth.users, RLS, service_role SELECT only. No production users or records copied.
- Explicit least-privilege service_role table grants added, so automatic table exposure can stay disabled.
- collab-room, collab-access, and collab-upload deployed and ACTIVE with gateway verify_jwt=false. Their own Auth JWT and admin allowlist checks remain enforced.
- Server client dependency pinned to @supabase/supabase-js 2.119.0.
- Dedicated Google OAuth client authorized for drive.file only. Credentials live in encrypted staging function secrets. No Google credential or invitation token belongs in this repository.

## Completed validation

- Local node suite: 45/45 passed.
- Deployed nonmutating smoke suite: 6/6 passed using explicit staging URL, publishable key, and permitted origin.
- Rollback-only SQL integration: RLS and private grants; server-only RPC execution; unknown, valid, duplicate, and closed invitations; 12 contributions/hour; 3 new access requests/day; upload-folder prerequisite; 5 uploads/hour; 15 MiB limit. Sample SQL records rolled back.
- Authenticated user without admin membership denied on all three private endpoint groups.
- Approved synthetic admin created and closed rooms, reviewed the private access-request inbox, and marked a request approved. No outbound email was sent.
- Invited guest read a room and submitted a contribution. Closed-room contribution rejected.
- Anonymous direct REST reads denied on all five application tables.
- Browser guest access-request form submitted and displayed confirmation against staging.
- Google integration: two rooms received distinct private folders; generated WAV and TXT uploads completed in their matching folders. Downloaded bytes matched exactly. Files/folders were not shared publicly or with other users. Guest responses omitted Drive file/folder IDs.
- Invalid upload extensions, invalid invitations, and closed-room uploads rejected.
- OAuth refresh-token exchange succeeded independently of the original grant.

Synthetic test records and harmless test files remain in staging for review. They contain no production guest data.

## Remaining production gates

- Google consent application is still in Testing. Drive-scoped refresh tokens may expire after seven days; complete the appropriate publishing process and reauthorize before relying on uploads at events. Do not change the existing archive integration without review.
- Actual owner admin onboarding, browser admin flow, and phone review must be completed on the trusted staging host.
- Production migrations, secrets, CORS, Auth redirects, function deployment, and collab.ogvhs.com DNS/HTTPS are separate work. Do not deploy this staging configuration to production.
- Define retention/privacy contact and add appropriate abuse protection before broad promotion.
- Merge/public launch requires owner authorization after review. Keep PR in draft until the remaining gates pass.

The production public/app-config.json is intentionally unchanged. Staging UI uses a separate review copy with its own public configuration. Override SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and COLLAB_TEST_ORIGIN when running collab:smoke against staging.
