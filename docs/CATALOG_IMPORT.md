# Building the listener catalog

## Why this is opt-in

The original DJ archive includes music, spoken word, audio from personal devices, samples and incomplete downloads. Filename-derived titles and folder names are **not proof of available songs**. This repository is currently **public**. Do not commit original inventory CSV/JSON, cloud paths, file IDs, recordings or private listener data.

The public app gets **only** a sanitised array of requestable songs (artist, title, optional album and genre, stable ID).

## Using the editable Google Sheet

1. Export the **Audio Catalog** tab from the private working Google Sheet to CSV on your computer.
2. Fill in **Artist (edit)** and **Title (edit)** with verified metadata for any requestable song.
3. Only for appropriate songs, set **Publish? (Yes/No)** to **Yes**. Blank or No will not publish the row.
4. Store the raw CSV outside this GitHub repository, or in a local directory named private/ (which is gitignored).
5. From the repository directory run:

   node scripts/build-catalog.mjs --input private/dj-ogvhs-export.csv

6. Review public/catalog.json before committing it. The script omits raw paths, entry IDs, and file-level metadata.
7. Run npm test, then npm run dev and open http://127.0.0.1:4173/.

## New private Website Review Queue

A new **Website Review Queue** tab in the existing private DJ OGVHS editable Google Sheet contains **89 proposed audio records** from the October 28 deep Drive/Dropbox scan: 26 Bob Marley tracks, 50 vintage TV themes, 10 Garfield novelty/music selections and 3 Marx/Engels spoken-word files.

**None is approved for the website yet.** Suggested names and albums came from filenames and parent folders, and playback has not been checked. No raw file paths from this tab should ever be copied to the public repository.

For each track the DJ wishes to offer:

1. Verify the audio file is present and playable on the DJ computer, not just a cloud placeholder.
2. Correct the editable artist, title, album and type fields from audio tags or listening.
3. Change **Review Status** to **Verified**.
4. Change **Publish? (Yes/No)** to **Yes**. Both gates are required for this tab; either alone is insufficient.
5. Export just that tab to a CSV kept in local `private/`, then run `node scripts/build-catalog.mjs --input private/website-review.csv`.
6. Inspect the generated `public/catalog.json` before committing. The output contains only stable ID, artist, title and optional album/genre — never raw paths or cloud IDs.

Keep importing more scans into review queues as the current iMac SQLite inventory and newer cloud audio collections are indexed. **Do not bulk-mark rows Yes.**

## Using the iMac's master SQLite inventory

The master local database contains a media_files table with source, path, filename, format, size_bytes and modified. Its rows do **not** inherently have verified song artist/title metadata or approval for public requests.

Export locally on the iMac (keep the output PRIVATE):

    sqlite3 -header -csv "$HOME/Music/DJ Workspace/Metadata/music_catalog.db" "SELECT source, path, filename, format, size_bytes, modified FROM media_files;" > private/master-inventory.csv

Prepare a separate **private/curation.csv** with this exact header:

    source,path,artist,title,album,publish

Add only reviewed tracks as rows. For example, the source and path must exactly match the exported inventory, and publish must be Yes. Never copy the example placeholders into real catalog data.

Build from this approved overlay:

    node scripts/build-catalog.mjs --input private/master-inventory.csv --curation private/curation.csv

The importer matches by source + path, excludes incomplete/zero-byte files, requires artist/title, removes same artist/title duplicates, and writes only public-safe fields. No original audio is uploaded or played.

## Demo mode

Once the local server is running, visit http://127.0.0.1:4173/?demo=1 to see four clearly fictional example songs. Demo songs are never written into the production catalog.

## Next phases

- Public external-song autocomplete and manual fallback when a requested track is not in the catalog.
- Durable request submissions, anti-spam protections and private admin login.
- Configurable tip links on a successful request screen.
- An automated import/update path from the complete, curated SQLite library after the ongoing cloud/local inventories have finished.

## What isn't wired up yet

The song/mashup toggle and local catalog selection work in preview mode, but no requests are sent and no tipping links are active. This is not a deployed public app.
