# Local library indexing

DJ OGVHS uses a local macOS indexing job to keep its private music inventory current as downloads finish. This is separate from the listener-facing catalog.

## How updates work

The indexer checks configured music folders periodically for new and changed audio files. It waits for files to remain stable across scans before reading supported tags and technical metadata. Partial downloads and unreadable audio are skipped or logged for later review.

Repeated scans reuse existing entries. Existing inventory records and curated fields are preserved; scanner metadata and availability are tracked separately. Missing files retain their records. Content hashes help identify files that have moved or exist in more than one location.

Backups precede catalog changes. Progress and errors are logged, and a dry-run mode supports previewing changes. The local operating guide contains configuration, manual-run, pause/resume and recovery instructions.

## Relationship to the app

The indexer updates a private SQLite inventory and can export a private CSV. It does not refresh djay's own database, synchronise Google Sheets, or publish songs to the request app.

An indexed file is not automatically approved for public requests. Before publishing:

1. Confirm the audio is present and playable.
2. Verify the artist, title and other song metadata.
3. Apply the applicable review and explicit publishing gates in [Catalog import](CATALOG_IMPORT.md).
4. Generate and inspect the sanitised public catalog using the existing import procedure.

Keep raw inventories, audio, local configuration, operational logs and machine-specific instructions outside this public repository. Only approved public song fields belong in the listener catalog.
