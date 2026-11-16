# OGVHS.com — exclusive mixes on AWS (not ACS product suite)

Scope: only DJ OGVHS mixes unavailable on Mixcloud. Existing Mixcloud embeds are unchanged.

## Verified recordings (2026-11-14)
- **Brian Wilson Forever** (source file: \`Brian Wilson Memorial.wav\`, Drive ID \`19IxkfAPx9mSj19ZPeRjM9eGtgVUQxiUq\`, 641,736,132 bytes). Drive access: owner-only.
- **Amy 2 Electric Boogaloo** (source file: \`Amy 2 Electric Boogaloo .wav\`, Drive ID \`1zHJAkr-o9yN6OpIhkU6DY8PQZZi3Lzq6\`, 586,568,368 bytes). Drive access: anyone-with-link reader.
- **Tom Waits Forever** (source file: \`Tom Waits Forever.wav\`, Drive ID \`1_NbFzFx9fDxqzKfgnZGWk-r0mpc2H1oc\`, 914,167,126 bytes). Already in the legacy player; do not remove until the new stream is confirmed.

- **Cleandrick Lamar** (verified source `Cleandrick Lamar.m4a`, Drive ID `1s5qWi4BOkJQHPALsROjks3fcWIBJV9OX`, 804,383,885 bytes, `audio/x-m4a`, uploaded 2026-11-15). Drive access: owner-only; preserve private Drive access and do not publish until transferred to OGVHS-owned S3 and independently verified through CloudFront.

The names above are source identifiers, **not publication permission**. Keep the original Google Drive objects unchanged. This site must never serve private Google Drive bytes directly to anonymous visitors.

## Confirmed source audio specifications (2026-11-16)

All four recordings were streamed directly from Google Drive to the separate private S3 bucket `ogvhs-exclusive-audio-242088067567-us-east-2` under `sources/`, with original byte counts matched to Drive. None has been linked in the public player yet. AWS media distribution: `E1AYIOARF6DSHE`, configured for `media.ogvhs.com` with an issued ACM certificate.

| Mix | S3 source key | Actual codec | Rate | Channels | Depth |
| --- | --- | --- | --- | --- | --- |
| Brian Wilson Forever | `sources/brian-wilson-forever.wav` | Uncompressed PCM WAV | 44,100 Hz | 2 | 16-bit |
| Amy 2 Electric Boogaloo | `sources/amy-2-electric-boogaloo.wav` | Uncompressed PCM WAV | 44,100 Hz | 2 | 16-bit |
| Tom Waits Forever | `sources/tom-waits-forever.wav` | Uncompressed PCM WAV | 44,100 Hz | 2 | 24-bit |
| Cleandrick Lamar | `sources/cleandrick-lamar.m4a` | ALAC (Apple Lossless) | 48,000 Hz | 2 | Not confirmed by inspection |

**Delivery policy:** Produce `audio/flac` playback objects without resampling, audio filtering, normalization, channel changes, or lossy encoding, maintaining each source's native precision. Retain original sources indefinitely unless separately directed; preserve original ALAC bitstream. Validate each output's rate/channels/bit depth and compare decoded PCM, then test HTTPS 200/206 and seeks in desktop/mobile browsers. FLAC is widely supported, including current Chrome, Firefox and Safari, but acceptance tests still matter. The website's AWS native player is deliberately not switched on until playback is verified. Do not silently fall back to lossy AAC or MP3. A lossless WAV/ALAC compatibility fallback is acceptable where supported. **Do not copy sources to CloudFront-readable `mixes/` until their public accessibility is intentional.**

## Lossless outputs verified — 2026-11-16

All four staged FLAC files were compared to their S3 source recordings by decoding both to 32-bit PCM (same FFmpeg path), hashing the entire decoded output with SHA-256, and confirming **exact hash equality**. Source files are preserved, and all FLAC copies are private under `staging/`. This is a completed verification of PCM equivalence, not yet proof of public/browser playback.

| Mix | Staged FLAC key | File size | PCM SHA-256 (both original and FLAC) |
| --- | --- | ---: | --- |
| Brian Wilson Forever | `staging/brian-wilson-forever.flac` | 345,482,269 | `5ee651be3439ee68a24fffbb099e4dccd9a113ebbb211547fbaba036176b8bde` |
| Amy 2 Electric Boogaloo | `staging/amy-2-electric-boogaloo.flac` | 339,902,242 | `f417d69d6f3ea3adffc774307fccee241a32dd135a3946d5f47eb46418488f36` |
| Tom Waits Forever | `staging/tom-waits-forever.flac` | 543,991,628 | `27d958785901013129f15c8f7f83bc653aac9cb0f51439fdf652391b46f88107` |
| Cleandrick Lamar | `staging/cleandrick-lamar.flac` | 730,611,121 | `1249d04a0ed2b4bb61e47a49ac53f4a8a390efa03ac5fa805fe173f0e08e0ebe` |

FLAC output sample precisions: Brian 16-bit/44.1 kHz stereo, Amy 16-bit/44.1 kHz stereo, Tom 24-bit/44.1 kHz stereo, Cleandrick 24-bit/48 kHz stereo. Cleandrick source is ALAC and the successful PCM comparison confirms no sample alterations in the FLAC conversion. Recheck that CloudFront correctly provides `audio/flac` and HTTP range 206 before publicizing; `mixes/` is publicly retrievable via CloudFront once copied there. Do not switch site manifest to published until valid HTTPS audio URLs and UX testing. Document rights/permissions for publicly streaming DJ mixes.

## Architecture
- A dedicated **private S3 bucket for OGVHS-exclusive-mixes**, separate from SampleHoarder, MassiveCue, and the ACS suite.
- **CloudFront** in front of the bucket using Origin Access Control (OAC), no public S3 ACLs. Preferred origin name: \`media.ogvhs.com\`.
- S3 keys: \`mixes/brian-wilson-forever.m4a\`, \`mixes/amy-2-electric-boogaloo.m4a\`, \`mixes/tom-waits-forever.m4a\`.
- **Maximum fidelity policy (approved 2026-11-16):** Keep each original in private `sources/` untouched. For Brian Wilson, Amy and Tom Waits, serve the original WAV/PCM losslessly (`audio/wav`, subject to confirmed codec and browser compatibility) or create FLAC as a bit-perfect lossless size optimization; do **not** down-convert to 192k AAC or otherwise apply lossy compression. For Cleandrick Lamar preserve its original M4A bitstream unchanged; inspect whether the codec is AAC or ALAC before choosing the public media path. Do not claim an M4A is lossless from its file extension. Preserve original bit depth/sample rate/channel count; do not normalize, resample or modify audio for delivery. All publication needs real seek/range and browser-device acceptance tests. Any optional compatibility fallback must be clearly secondary to the highest-quality available source, never a silent replacement.
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
