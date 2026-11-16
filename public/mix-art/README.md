# Mix artwork

The exclusive mixes use a 1:1 square artwork image in this folder. The UI is already linked to the filenames below, and shows a branded vinyl placeholder if an image has not yet been uploaded.

| Mix | Expected filename |
| --- | --- |
| Brian Wilson Forever | brian-wilson-forever.jpg |
| Cleandrick Lamar | cleandrick-lamar.jpg |
| Amy 2 Electric Boogaloo | amy-2-electric-boogaloo.jpg |
| Tom Waits Forever | tom-waits-forever.jpg |

Upload the owner's supplied images **without recreating or inventing cover art**. Encode each as a high-quality, square JPEG (ideally 1400×1400 or better, preserving the source crop) if the originals are other image types. Keep images under a few MB for mobile performance.

The mix manifest is in \`public/hosted-mixes.json\`; the \`slug\` is the stable detail-page identifier. After uploading, artwork appears automatically in each main-page mix card and dedicated \`mix.html?mix=<slug>\` page. The native HTML5 FLAC audio source is unchanged. Never add private source-audio files or secrets here.

Optional details that can be added per mix in the manifest once genuine values are supplied:

- \`description\` — free text.
- \`tags\` — an array of genre/mood tags.
- \`published_at\` — verified ISO-8601 publication date.
- \`tracklist\` — timestamped tracks or spoken-word chapters, e.g. \`{"start_seconds": 90, "artist": "Example", "song": "Example Title"}\` or \`{"start_seconds": 45, "chapter": "Intro"}\`.
- \`plays\`, \`favorites\`, \`reposts\`, \`comments\` — verified counts; omit fields when unavailable.

Never fabricate listening counts, comments, tracklists, genres, or published dates.
