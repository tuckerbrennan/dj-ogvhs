# Collab request email notifications

Enabled November 8, 2026 for staging project pgufhgmkqgpjoddxvzoa only.

- User changed destination from the proposed +collab alias to **ogvhstape@gmail.com**.
- Dedicated existing-account Formspree form: OGVHS Collab Requests, mqppovwy. Workflow recipient visibly confirmed; contact form mjyyzdze unchanged.
- Server-only setting DJ_COLLAB_NOTIFICATION_FORM_ID=mqppovwy selects the notification form. This is a form identifier, not a privileged API key.
- The collab-access function first saves the request through the existing rate-limited RPC, then claims the private request row before posting only email, subject and message to Formspree. The message links to the private admin page; no invitations are automatically issued.
- Two nullable timestamps track claim and delivery. Existing RLS and service-role-only table permissions remain unchanged. Repeat requests after successful notification do not send more mail. An in-progress claim expires after five minutes.
- Provider acceptance is recorded in notification_sent_at. On delivery failure the request remains saved, the claim is released, and a later submission can retry. There is no scheduled retry worker. Network timeouts or receipt-write failures can result in a repeated notification; this is not exactly-once delivery.
- Recipient routing lives in Formspree Workflow, not a public client or caller-supplied recipient parameter.
- Existing Formspree account allowance displayed 50 submissions/month, shared with the contact form. No subscription was purchased.

## Deployment and validation

- Applied 20261108145944_collab_request_notifications.sql through authenticated staging SQL Editor; recorded the exact migration in supabase_migrations.schema_migrations after inspecting its schema.
- Deployed collab-access with dashboard Code / Deploy updates. Guest endpoint gateway setting unchanged; existing explicit admin validation retained.
- Four new handler tests passed: one notification after persistence and no repeat; failed provider preserves record and permits retry; invalid/honeypot/admin-unauthorized requests never email; rate-limited/failed saves never email.
- Existing 45-test suite passed; six deployed nonmutating smoke checks passed.
- Submitted setup-test request using a Gmail alias with collab-setup-test in the address, and repeated it to exercise deduplication.
- Formspree submission 169176530 showed ogvhstape@gmail.com: processed. No real guest addresses were used for the test.
- No production Requests backend, main branch, Google billing, or existing contact form configuration changed.

To disable new notifications, remove/unset DJ_COLLAB_NOTIFICATION_FORM_ID in the staging function settings. Request persistence remains active.
