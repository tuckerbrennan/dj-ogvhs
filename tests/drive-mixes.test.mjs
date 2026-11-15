import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDriveId,drivePreviewUrl,normalizeMix,parseHostedAudioUrl,parseArtworkPath,mergeExclusiveMixes} from '../src/drive-mixes-model.mjs';
const id = '1AbcDEFghIJKlmnOP012345';
test('accepts only Google Drive file IDs and safe share links',()=>{
  assert.equal(parseDriveId(id),id);
  assert.equal(parseDriveId('https://drive.google.com/file/d/'+id+'/view?usp=sharing'),id);
  assert.equal(parseDriveId('https://drive.google.com/open?id='+id),id);
  for (const value of ['https://drive.google.com.evil.test/file/d/'+id+'/view','javascript:alert(1)','https://drive.google.com/drive/folders/'+id,'bad','https://example.com/file/d/'+id]) {
    assert.equal(parseDriveId(value),null);
  }
});
test('normalizes published mix metadata without interpreting HTML',()=>{
  assert.deepEqual(normalizeMix({title:'  My mix  ',description:'  The set  ',url:'https://drive.google.com/file/d/'+id+'/view'}),{title:'My mix',description:'The set',id});
  assert.equal(normalizeMix({title:'',drive_file_id:id}),null);
  assert.equal(normalizeMix({title:'My mix',drive_file_id:'javascript:alert(1)'}),null);
  assert.equal(drivePreviewUrl(id),'https://drive.google.com/file/d/'+id+'/preview');
});

test('allows only OGVHS-hosted HTTPS audio paths, not arbitrary remote audio', () => {
  assert.equal(parseHostedAudioUrl('https://media.ogvhs.com/mixes/brian-wilson-forever.m4a'),
    'https://media.ogvhs.com/mixes/brian-wilson-forever.m4a');
  assert.equal(parseHostedAudioUrl('https://ogvhs.com/media/mixes/brian-wilson-forever.m4a'),
    'https://ogvhs.com/media/mixes/brian-wilson-forever.m4a');
  for (const invalid of [
    'http://media.ogvhs.com/mixes/brian.m4a',
    'https://media.ogvhs.com.evil.test/mixes/brian.m4a',
    'https://evil.test/mixes/brian.m4a',
    'javascript:alert(1)',
    'https://media.ogvhs.com/other/brian.m4a',
    'https://media.ogvhs.com/mixes/brian.exe'
  ]) assert.equal(parseHostedAudioUrl(invalid),null);
});
test('normalizes a hosted mix and its local art',()=>{
  const input = {title:'Brian Wilson Forever', audio_url:'https://media.ogvhs.com/mixes/brian-wilson-forever.m4a',
    artwork:'./public/mix-art/brian-wilson-forever.jpg'};
  assert.deepEqual(normalizeMix(input),{
    title:'Brian Wilson Forever',description:'',
    audioUrl:'https://media.ogvhs.com/mixes/brian-wilson-forever.m4a',
    artwork:'./public/mix-art/brian-wilson-forever.jpg'
  });
  assert.equal(parseArtworkPath('https://attacker.example/x.jpg'),null);
});

test('featured Brian is first and published AWS streams preserve Drive fallback', () => {
  const curated = [
    {title: 'Cleandrick Lamar', id: 'drive-cleandrick'},
    {title: 'Brian Wilson Forever', id: 'drive-brian'},
    {title: 'Amy 2 Electric Boogaloo', id: 'drive-amy'}
  ];
  const hosted = [
    {title: 'Cleandrick Lamar', audioUrl: 'https://media.ogvhs.com/mixes/cleandrick-lamar.m4a'},
    {title: 'Brian Wilson Forever', audioUrl: 'https://media.ogvhs.com/mixes/brian-wilson-forever.m4a'}
  ];
  const database = [{title: 'An extra mix', id: 'drive-extra'}];
  const mixes = mergeExclusiveMixes({curated, hosted, database});
  assert.deepEqual(mixes.map(m => m.title), [
    'Brian Wilson Forever','Cleandrick Lamar','Amy 2 Electric Boogaloo','An extra mix'
  ]);
  assert.equal(mixes[0].audioUrl, hosted[1].audioUrl);
  assert.equal(mixes[0].id, 'drive-brian');
  assert.equal(mixes[1].id, 'drive-cleandrick');
  assert.equal(mergeExclusiveMixes({curated})[0].id, 'drive-brian');
});
