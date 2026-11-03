# Request backend setup (not yet deployed)

DJ OGVHS's static GitHub Pages site uses a separate Supabase project for durable requests and authenticated DJ administration. The public source repository contains no credentials, listener records, audio files, or raw paths.

## One-time configuration

1. Create a Supabase project under the owner's account. Save the project URL and its **publishable/anon** key. Keep all secret/service-role keys in Supabase only.
2. Apply `supabase/migrations/202611030001_requests.sql` to the project using the SQL editor or a reviewed migration. This creates an admin allowlist, private request table, and a rate-limited submission function.
3. In Supabase Authentication, configure the site's `admin.html` URL as an allowed redirect. Invite the DJ admin email via Auth Users (public signup is not required), then find that user's UUID.
4. From the Supabase SQL editor as project administrator, grant that user access:
   ```sql
   insert into public.dj_admins (user_id) values ('UUID-OF-INVITED-USER');
   ```
   Never publish the invited address or UUID in the repository.
5. Set Supabase Edge Function secret `DJ_RATE_LIMIT_SECRET` to a strong random value. Set `DJ_ALLOWED_ORIGINS` to the deployed web **origin**, e.g. `https://tuckerbrennan.github.io` (comma-separated if also using localhost). Supabase provisions `SUPABASE_URL` and its server-side secret keys; verify they're available to the function.
6. Deploy the Edge Function with the Supabase CLI: `supabase functions deploy submit-request`. Its `verify_jwt = false` setting deliberately permits listener submissions; rate control and payload validation execute server-side.
7. Enter the **public** project URL and publishable/anon key in `public/app-config.json`. Nothing else belongs in that file. The interface stays in safe preview mode while either value is blank.
8. Run `npm test` and `npm run dev`. Test a real manual song and mashup request, then open `admin.html` and check the private queue and status/BPM controls. Publish only after testing auth and permissions.
9. Review Supabase logs and rate limits during the first gig. Per-IP HMAC-based throttling (5 submissions per 10 minutes) is a basic control, **not** strong bot protection: forwarded-IP headers may be spoofable depending on your infrastructure. Add a verified CAPTCHA/Turnstile challenge or managed WAF and monitor abuse before wider promotion.

## API contract

`POST /functions/v1/submit-request` with JSON:

```json
{
  "type": "mashup",
  "songs": [
    {"title":"Example A","artist":"Example Artist","source":"manual"},
    {"title":"Example B","artist":"Second Artist","source":"manual"}
  ],
  "listenerName": "Optional"
}
```

A song request contains exactly one selection; a mashup contains two. Source can be `catalog`, `external`, or `manual`. A catalog selection includes `catalogId`. On success the function returns HTTP 201 and `{"id":"...","accepted":true}`. Both request types receive the same default status and queue treatment. The edge function accepts only configured browser origins; that is a CORS safeguard, not authentication or bot prevention.

The private admin screen uses Supabase Auth email links. RLS restricts selecting/updating request records to UUIDs in `dj_admins`, and no anonymous direct-table access is granted. Never put an elevated secret key in JavaScript, HTML, `app-config.json`, or GitHub Actions output.

## Not included in this phase

External music autocomplete, actual music catalog approval/import, automatic BPM lookup, optional tipping links, production deployment, notification delivery, and rate-control load testing.
