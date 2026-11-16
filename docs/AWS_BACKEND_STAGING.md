# Coordinated AWS backend migration

The latest deployment scope is issues #24 and #25: replace website hosting **and** request/admin backend together, with a single final cutover. The older hosting-only runbook is superseded where it conflicts.

The migration branch adds `apiUrl` support to the existing request client. Without that setting, the live Supabase behavior stays intact. The AWS API uses GET/POST `/v1/requests`, `x-dj-listener-id`, and a per-submission `x-idempotency-key`. Retries reuse the key until confirmation; a subsequent deliberate submission gets a new key. Supabase keys are not sent to AWS. AWS previews use the reviewed four-mix static catalog, keeping Brian first.

AWS backend source, reproducible infrastructure, Cognito admin, import tool and tests are in the **private** `tuckerbrennan/dj-ogvhs-admin` repository under `aws/`. Do not copy runtime credentials or request exports to this public repository.

Production configuration and DNS must only switch after the private source-data backup, data import/final delta, owner authentication and end-to-end parity checks. Existing GitHub Pages/Supabase/admin remain rollback targets. The S3/native player work in #23 follows afterward.
