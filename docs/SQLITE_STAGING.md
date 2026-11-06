# Private website review staging

The scanner's SQLite database is the source for current local tags. Python 3 is required for staging; Node 20+ is required for catalog building and tests.

Run `python3 scripts/stage-sqlite.py --database /path/to/catalog.db --output private/website-review --refresh` locally. Never commit its output.

Only present, successfully parsed files enter the staging inventory. Artist, title, album, genre and valid BPM values come from tags, with Unicode and whitespace cleanup. Filenames are not used to invent metadata. Artist/title duplicates collapse to the tagged copy with the most album/BPM fields. Different versions should be distinguished in the title before publishing.

The private output contains `inventory.csv`, a deduplicated `review.csv`, `needs-metadata.csv`, and a summary. Every new row starts with `review_status=Needs review` and `publish=No`. No audio is copied by staging.

With `--refresh`, unchanged inventory reuses the existing generation. Changes produce a new immutable generation; `latest.json` identifies it. Previously edited review files remain intact. Review decisions are not automatically carried to a new generation: retain a reviewed CSV as the private curation overlay and review new or changed recordings separately. Old generations are not pruned automatically.

After checking metadata and playback, set both `review_status=Verified` and `publish=Yes` for individual songs. Build using current inventory and the reviewed overlay:

```sh
node scripts/build-catalog.mjs --input private/website-review/GENERATION/inventory.csv --curation private/reviewed.csv --output private/approved-catalog.json
npm test
```

Inspect the approved output before copying it to `public/catalog.json`. Public output allows only stable ID, artist, title, album, genre and optional numeric BPM. Inventory paths, scan metadata and cloud identifiers remain private.

The Mac's existing 15-minute local indexing job also runs private staging after a successful scan. It does not publish to GitHub or deploy the website. Its machine-specific installation, destinations and pause/resume commands belong in the local operating guide.
