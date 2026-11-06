import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generatePublicCatalog, parseCSV } from '../scripts/build-catalog.mjs';
import { searchCatalog } from '../src/catalog.mjs';

test('SQLite staging is read-only, deduplicates tags, and preserves edited generations', () => {
  execFileSync('python3', ['-c', `
import importlib.util, sqlite3, tempfile, json
from pathlib import Path
spec=importlib.util.spec_from_file_location('stage','scripts/stage-sqlite.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 p=Path(d); db=p/'test.db'; c=sqlite3.connect(db)
 c.execute('create table media_files(id,source,path,filename,format)')
 c.execute('create table local_scan_state(media_id,path,indexed_size,status,error,metadata_json)')
 for i, status in enumerate(['present','present','pending','present']):
  path='private/'+str(i)+'.mp3'
  c.execute('insert into media_files values(?,?,?,?,?)',(i,'local',path,str(i)+'.mp3','.mp3'))
  tags={'artist':['Example'], 'title':['Song'], 'album':['Album'], 'bpm':['120']}
  if i==3: tags={}
  c.execute('insert into local_scan_state values(?,?,?,?,?,?)',(i,path,100,status,None,json.dumps({'tags':tags})))
 c.commit(); c.close(); before=db.read_bytes()
 out=p/'private'; stats=m.stage(db,out,True)
 assert stats['candidates']==1 and stats['duplicate_files']==1
 assert stats['excluded_files']==1 and stats['missing_artist_title']==1
 assert stats['with_bpm']==1 and stats['approved']==0
 generation=json.loads((out/'latest.json').read_text())['generation']
 review=out/generation/'review.csv'; review.write_text(review.read_text().replace('Needs review','Verified'))
 edited=review.read_bytes(); m.stage(db,out,True)
 assert review.read_bytes()==edited and db.read_bytes()==before
 try: m.stage(db,p/'public')
 except ValueError: pass
 else: raise AssertionError('public output allowed')
`]);
});

test('staged rows require both gates and public BPM contains no private inventory fields', () => {
 const row={source:'local',path:'PRIVATE/a.mp3',filename:'a.mp3',format:'.mp3',size_bytes:200,
 artist:'Example',title:'Song',album:'Album',bpm:'120',review_status:'Needs review',publish:'No'};
 assert.equal(generatePublicCatalog([row]).tracks.length,0);
 assert.equal(generatePublicCatalog([{...row,publish:'Yes'}]).tracks.length,0);
 const {tracks}=generatePublicCatalog([{...row,publish:'Yes',review_status:'Verified'}]);
 assert.equal(tracks[0].bpm,120);
 assert.deepEqual(Object.keys(tracks[0]).sort(),['album','artist','bpm','id','title']);
 assert.equal(searchCatalog(tracks,'example album')[0].title,'Song');
 assert.equal(generatePublicCatalog([{...row,publish:'Yes',review_status:'Verified',bpm:'Infinity'}]).tracks[0].bpm,undefined);
});
