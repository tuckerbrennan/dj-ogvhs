#!/usr/bin/env python3
"""Read scanner SQLite metadata into PRIVATE review files. Never approves songs."""
import argparse
import csv
import json
import hashlib
import math
import sqlite3
import unicodedata
from pathlib import Path


def clean(value):
    if isinstance(value, list):
        value = next((v for v in value if str(v).strip()), '')
    return ' '.join(unicodedata.normalize('NFC', str(value or '')).split())


def key(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value).lower()
                   if not unicodedata.combining(c))


def stage(database, output, refresh=False):
    output = Path(output).resolve()
    if 'private' not in output.parts[2:] or 'public' in output.parts:
        raise ValueError('Output must be inside a directory named private')
    output.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(Path(database).resolve().as_uri() + '?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    rows = connection.execute('''SELECT m.source,m.path,m.filename,m.format,
        s.indexed_size AS size_bytes,s.status,s.error,s.metadata_json
        FROM local_scan_state s LEFT JOIN media_files m ON m.id=s.media_id
        ORDER BY s.path''').fetchall()
    connection.close()
    if refresh:
        # Immutable generations protect edited review CSVs from background jobs.
        fingerprint = hashlib.sha256(json.dumps([dict(r) for r in rows], sort_keys=True).encode()).hexdigest()[:24]
        root = output
        output = root / fingerprint
        if not output.exists():
            output.mkdir()
        elif (output / 'summary.json').exists():
            return json.loads((output / 'summary.json').read_text())
    if any((output / name).exists() for name in ['inventory.csv', 'review.csv', 'needs-metadata.csv', 'summary.json']):
        raise ValueError('Use a fresh output directory; existing review decisions must be preserved')
    inventory, missing, groups = [], [], {}
    stats = dict(scanner_rows=len(rows), eligible_files=0, excluded_files=0,
                 missing_artist_title=0, duplicate_files=0, candidates=0,
                 with_album=0, with_bpm=0, approved=0)
    for raw in rows:
        if raw['status'] != 'present' or raw['error'] or not raw['size_bytes'] or not raw['path']:
            stats['excluded_files'] += 1
            continue
        stats['eligible_files'] += 1
        metadata = json.loads(raw['metadata_json'] or '{}')
        tags = {k.lower(): v for k, v in metadata.get('tags', {}).items()}
        row = {k: raw[k] for k in ['source', 'path', 'filename', 'format', 'size_bytes']}
        row.update(artist=clean(tags.get('artist')), title=clean(tags.get('title')),
                   album=clean(tags.get('album')), genre=clean(tags.get('genre')),
                   bpm='', review_status='Needs review', publish='No',
                   availability_status='Present (playback untested)')
        try:
            bpm = float(clean(tags.get('bpm') or tags.get('tbpm')))
            if math.isfinite(bpm) and 0 < bpm <= 400:
                row['bpm'] = bpm
        except (ValueError, TypeError):
            pass
        inventory.append(row)
        if not row['artist'] or not row['title']:
            missing.append(row)
            stats['missing_artist_title'] += 1
            continue
        identity = key(row['artist']), key(row['title'])
        if identity in groups:
            stats['duplicate_files'] += 1
            # Pick the most complete tagged copy; never guess or combine conflicting tags.
            if sum(bool(row[k]) for k in ['album', 'bpm']) > sum(bool(groups[identity][k]) for k in ['album', 'bpm']):
                groups[identity] = row
        else:
            groups[identity] = row
    candidates = sorted(groups.values(), key=lambda r: (key(r['artist']), key(r['title'])))
    stats.update(candidates=len(candidates), with_album=sum(bool(r['album']) for r in candidates),
                 with_bpm=sum(bool(r['bpm']) for r in candidates))
    fields = ['source', 'path', 'filename', 'format', 'size_bytes', 'availability_status',
              'artist', 'title', 'album', 'genre', 'bpm', 'review_status', 'publish']
    for name, records in [('inventory.csv', inventory), ('review.csv', candidates), ('needs-metadata.csv', missing)]:
        with (output / name).open('w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerows(records)
    (output / 'summary.json').write_text(json.dumps(stats, indent=2) + '\n')
    if refresh:
        pointer = root / 'latest.tmp'
        pointer.write_text(json.dumps({'generation': output.name}) + '\n')
        pointer.replace(root / 'latest.json')
    return stats


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--refresh', action='store_true', help='Create immutable generations only when inventory changes')
    args = parser.parse_args()
    print(json.dumps(stage(args.database, args.output, args.refresh)))
