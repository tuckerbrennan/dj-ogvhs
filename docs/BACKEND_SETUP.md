# Request backend setup (not yet deployed)

DJ OGVHS's static GitHub Pages site uses a separate Supabase project for durable requests and authenticated DJ administration. The public source repository contains no credentials, listener records, audio files, or raw paths.

## One-time configuration

1. Create a Supabase project under the owner's account. Save the project URL and its **publishable/anon** key. Keep all secret/service-role keys in Supabase only.
2. Apply `supabase/migrations/202611030001_requests.sql` **then** `supabase/migrations/202611060001_rolling_request_quota.sql` through reviewed migrations. Together they create the private requests table, admin allowlist, and atomic rolling-hour quota.
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
9. Review Supabase logs and quota activity during the first gig. Each browser receives a random ID stored in localStorage. A keyed HMAC of that ID is stored on the server; listeners on the same venue Wi-Fi do not share their 3-request allowance. **The limit is per browser, not guaranteed per person:** clearing browser data or using another browser/device can reset the anonymous identity. To enforce a strict per-person quota, introduce authenticated or verified visitor identity. Add CAPTCHA/Turnstile or a managed WAF and aggregate abuse monitoring before wider promotion.

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

A song request contains exactly one selection; a mashup contains two. Source can be `catalog`, `external`, or `manual`. A catalog selection includes `catalogId`. On success the function returns HTTP 201 with `{"id":"...","accepted":true,"limit":3,"remaining":2}` (remaining changes with usage). All successful submissions, song or mashup, count as **one** request toward the **3 requests per rolling 60 minutes per browser** limit. On exhaustion the endpoint returns HTTP 429 with `remaining:0` and `nextAvailableAt`. The quota check and insertion are protected by a PostgreSQL row lock. Both request types receive the same default status and queue treatment. The edge function accepts only configured browser origins; that is a CORS safeguard, not authentication or bot prevention.

Clients can request the current allowance with `GET /functions/v1/submit-request`. The browser sends the same `x-dj-listener-id` header on GET and POST; the server stores only its HMAC digest. The interface shows `N of 3 requests left this hour`, plus the next available time when exhausted. Demo mode stores a separate local counter and never submits a real request.

The private admin screen uses Supabase Auth email links. RLS restricts selecting/updating request records to UUIDs in `dj_admins`, and no anonymous direct-table access is granted. Never put an elevated secret key in JavaScript, HTML, `app-config.json`, or GitHub Actions output.

## Not included in this phase

External music autocomplete, actual music catalog approval/import, automatic BPM lookup, optional tipping links, production deployment, notification delivery, and rate-control load testing.
