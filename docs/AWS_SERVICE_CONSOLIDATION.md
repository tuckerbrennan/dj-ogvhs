# AWS service consolidation — November 17, 2026

Selected Region: Ohio (`us-east-2`). This inventory combines current repository configuration, live AWS APIs, public configuration endpoints, Route 53 records and the connected providers. Historical plans below the live snapshot in CURRENT_ARCHITECTURE_AND_AWS_CUTOVER.md do not describe the current production deployment.

## Already on AWS

- Public listener frontend: AWS Amplify, GitHub `main`.
- Request API: API Gateway HTTP API and Lambda.
- Request database: on-demand DynamoDB. Supabase Requests is retained for rollback, with old writes paused according to the production runbook.
- DJ authentication: dedicated Cognito pool and owner group.
- Exclusive audio: all four entries in `public/hosted-mixes.json` are published at `media.ogvhs.com` through CloudFront and private S3. S3 inventory confirms FLAC audio and artwork. The older claim that native audio is deferred is superseded.
- DNS: the OGVHS Route 53 hosted zone contains the production records.

The AWS project is on the active paid plan. Do not create a second request database or reimport historical records without reconciliation.

## Remaining dependencies

| Component | Verified dependency | Migration status |
| --- | --- | --- |
| Contact frontend | AWS Amplify (migrated November 17) | Existing `tuckerbrennan/dj-ogvhs-contact` repo, migration branch and PR #1. Preview and custom-host TLS verified before cutover; production build marker verified afterward. Route 53 change INSYNC, other records unchanged. GitHub Pages retained for rollback. |
| Contact form | Formspree | Preserve delivery until AWS replacement passes acceptance. Ohio SES is in sandbox mode; OGVHS sender identity is not configured. |
| Collaboration frontend | Vercel, branch `deploy/collab-beta` in this repo | Separate beta. Public config points at the separate Collab Supabase project, not the Requests project. |
| Collaboration data/auth/functions | Supabase Collab Staging | Provider reported paused/inactive. Restore requested to inspect data before migration; do not replace it with an empty database. |
| Collaboration file uploads | Google Drive integration in backend source | Inventory actual uploaded files and room mappings before moving to private S3. Preserve invitation access and upload quotas. |
| Archive | Sites | Existing reconstruction is documented as owner-only review. AWS replacement must preserve that restriction; a public static upload is not equivalent. |
| Analytics | Google Tag Manager | Inventory tags and required reports before replacing. Operational request metrics do not establish equivalent visitor analytics. |
| Featured shows | Mixcloud API/embeds | Still external. Four exclusive mixes already use AWS independently of featured shows. |
| Mailbox | Google MX and DKIM in DNS | Existing mailbox remains in place. SES contact-form delivery does not replace a mailbox. |
| Auth mail DNS | Resend-related records | DNS presence alone does not prove active use. Verify provider/runtime before deleting. |
| Tips and social links | External providers | No AWS replacement established; preserve functionality while assessing scope. |

## Repository ownership

- `tuckerbrennan/dj-ogvhs`: listener site and collaboration beta branch.
- `tuckerbrennan/dj-ogvhs-admin`: private request backend, deployment source and rollback artifacts.
- `tuckerbrennan/dj-ogvhs-contact`: contact page and AWS publishing scripts.

Use branches in these repositories. Do not create replacement repositories or commit private exports, invitation tokens, credentials or listener records to public source.

## Acceptance before each cutover

Preserve the prior DNS target and deployment. Verify the AWS preview, custom-domain TLS and assets before switching traffic. For data services, export and validate records, preserve private authorization and invitations, freeze/reconcile writes, then test the complete workflow before retiring the original provider. Retain existing working email and audio delivery until replacements pass.
