import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDriveId,drivePreviewUrl,normalizeMix,parseHostedAudioUrl,parseArtworkPath} from '../src/drive-mixes-model.mjs';
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


test('published lossless Mixes catalog contains all four OGVHS hosted FLACs', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/hosted-mixes.json', import.meta.url), 'utf8'));
  const slugs = [
    'brian-wilson-forever',
    'cleandrick-lamar',
    'amy-2-electric-boogaloo',
    'tom-waits-forever'
  ];
  assert.equal(catalog.mixes.length, slugs.length);
  catalog.mixes.forEach((mix, index) => {
    assert.equal(mix.published, true);
    assert.equal(
      mix.audio_url,
      'https://media.ogvhs.com/mixes/' + slugs[index] + '.flac'
    );
    assert.equal(parseHostedAudioUrl(mix.audio_url), mix.audio_url);
    assert.equal(normalizeMix(mix).audioUrl, mix.audio_url);
  });
});
