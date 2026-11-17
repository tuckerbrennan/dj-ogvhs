# AWS audience measurement

The listener uses CloudWatch RUM in us-east-2, replacing GTM-W7R6GVRK / GA4 G-5PPHF63XZ2. The existing local decline preference and GPC prevent configuration fetching, AWS client loading, guest authorization and event dispatch. The footer can disable analytics; no initial banner is introduced.

Only explicit page IDs, referring/outbound domains, download extensions, 90% scroll, form-start/submit counts, search-use counts and native audio/video start/progress/completion are recorded. Form values, search text, URL query/hash values, private paths, media titles and file URLs are excluded. Page IDs use a fixed list. No DOM, HTTP, errors, performance, resource or replay plugins are loaded. Cross-origin embedded players are not instrumented. Form-submit events count attempts, not confirmed backend success.

Cookies are disabled. Guest credentials and their authorization identity are cached in memory only and refresh before expiry; the standard SDK's persistent credential cache is not used. Guest permission is solely rum:PutRumEvents on this monitor. Analytics readers require ordinary AWS project access. RUM and its CloudWatch log export retain 30 days. Cookie-free sessions cannot report returning visitors across page loads. Historical Google reports remain with Google and are not imported into RUM.

The pinned AWS client is bundled locally during build; no Google scripts or external script CDN are loaded. UUID is overridden to patched 11.1.1 (the AWS client uses its compatible v4 API); npm audit reports zero findings. Run npm ci and npm test. For the AWS hosting artifact set OGVHS_API_URL=https://fjaw6n38q0.execute-api.us-east-2.amazonaws.com before npm run build:hosting, preserving the live request backend.

Infrastructure is tracked in the private dj-ogvhs-admin analytics migration branch under aws/analytics/template.json. Public monitor and identity-pool IDs in analytics-config.json authorize only event submission; they are not secrets.

Rollback: deploy the previous successful Amplify main artifact (job 46) if needed. Its local backup ZIP SHA-256 is 4296af5ab6e72281887feb97ad2a117bf20fab6fe7110023c360195e70765074. It restores the prior Google integration. Do not delete the AWS monitor or historical reports as part of a rollback.
