# OGVHS.com — exclusive mixes on AWS (not ACS product suite)

Scope: only DJ OGVHS mixes unavailable on Mixcloud. Existing Mixcloud embeds are unchanged.

## Verified recordings (2026-11-14)
- **Brian Wilson Forever** (source file: \`Brian Wilson Memorial.wav\`, Drive ID \`19IxkfAPx9mSj19ZPeRjM9eGtgVUQxiUq\`, 641,736,132 bytes). Drive access: owner-only.
- **Amy 2 Electric Boogaloo** (source file: \`Amy 2 Electric Boogaloo .wav\`, Drive ID \`1zHJAkr-o9yN6OpIhkU6DY8PQZZi3Lzq6\`, 586,568,368 bytes). Drive access: anyone-with-link reader.
- **Tom Waits Forever** (source file: \`Tom Waits Forever.wav\`, Drive ID \`1_NbFzFx9fDxqzKfgnZGWk-r0mpc2H1oc\`, 914,167,126 bytes). Already in the legacy player; do not remove until the new stream is confirmed.

- **Cleandrick Lamar** (verified source `Cleandrick Lamar.m4a`, Drive ID `1s5qWi4BOkJQHPALsROjks3fcWIBJV9OX`, 804,383,885 bytes, `audio/x-m4a`, uploaded 2026-11-15). Drive access: owner-only; preserve private Drive access and do not publish until transferred to OGVHS-owned S3 and independently verified through CloudFront.

The names above are source identifiers, **not publication permission**. Keep the original Google Drive objects unchanged. This site must never serve private Google Drive bytes directly to anonymous visitors.

## Architecture
- A dedicated **private S3 bucket for OGVHS-exclusive-mixes**, separate from SampleHoarder, MassiveCue, and the ACS suite.
- **CloudFront** in front of the bucket using Origin Access Control (OAC), no public S3 ACLs. Preferred origin name: \`media.ogvhs.com\`.
- S3 keys: \`mixes/brian-wilson-forever.m4a\`, \`mixes/amy-2-electric-boogaloo.m4a\`, \`mixes/tom-waits-forever.m4a\`.
- Encode WAV masters to stereo AAC inside \`.m4a\` with \`ffmpeg -c:a aac -b:a 192k -movflags +faststart\`, retaining originals privately. Serve \`audio/mp4\`. Use CloudFront + S3 support for HTTP \`Range\` requests so scrub/seek works. Verify 206 Partial Content for byte-range requests.
- SSL certificate for media domain must be in **ACM us-east-1**, even if S3 and the site are in **us-east-2**. Route53 should alias \`media.ogvhs.com\` to the distribution after certificate issuance.
- Browser uses \`<audio controls preload="metadata">\` and Media Session API metadata/transport action handlers, allowing mobile lock-screen and Bluetooth controls where supported.
- Cover images belong in the OGVHS site at \`public/mix-art/\` (Brian's T-shirt image, Amy's newly provided image). They are never part of SampleHoarder or ACS assets.

## Publishing sequence
1. Identify actual OGVHS Amplify app, source branch, origin bucket, and Route53 zone. **Do not use an ACS product bucket or deploy to Vercel.**
2. Provision/verify private S3 bucket, CloudFront OAC, ACM, DNS and HTTPS. Do not issue public-read ACL.
3. Download exact original WAVs from the Drive IDs above using an authenticated Drive account. Verify metadata/file sizes. Source files must be explicitly supplied to the uploader on the machine with \`aws\` and \`ffmpeg\`.
4. Run \`scripts/upload-exclusive-mixes-aws.sh\`, with \`OGVHS_AUDIO_BUCKET\` configured to the dedicated bucket name. The script checks AWS account 242088067567 before touching S3, then encodes/uploads/verifies audio objects.
5. Verify \`https://media.ogvhs.com/mixes/...\` returns \`200\` and \`206\` for a Range request. Verify Content-Type \`audio/mp4\`.
6. Upload and verify each cover image in \`public/mix-art/\`. Brian's title on site is **Brian Wilson Forever** regardless of source filename.
7. Set \`public/hosted-mixes.json\` entries to \`published:true\` and add \`audio_url\` to the corresponding CloudFront URLs. Include artwork paths only after the actual image files are present. \`src/drive-mixes.mjs\` prefers AWS tracks over legacy Drive previews with the same title.
8. Build and deploy \`npm run build:hosting\` using the actual OGVHS AWS Amplify workflow. Verify the **live** \`https://ogvhs.com/mixes.html\` page on iOS Safari, Android Chrome, desktop Safari/Chrome; include locked-screen audio, Bluetooth play/pause, headset skip, seek, no simultaneous playback, and return from background.
9. Only after public playback is verified, remove redundant Google Drive entries for migrated recordings from \`public/drive-mixes.json\`.

## Safety
The \`public/hosted-mixes.json\` entries are deliberately **unpublished** until a verified AWS origin exists. Do not publish broken URLs or claim live playback before checking the actual domain. Google Drive embedded playback is a **temporary** fallback and cannot guarantee lock-screen or Bluetooth controls.
