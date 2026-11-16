import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const read = path => readFile(join(dist, path), 'utf8');

test('Amplify artifact contains all five public HTML pages', async () => {
  for (const page of ['index.html','about.html','mixes.html','thanks.html','privacy.html']) {
    assert.ok((await stat(join(dist, page))).size > 100, page);
  }
  assert.match(await read('index.html'), /OGVHS_AWS_AMPLIFY_BUILD/);
});

test('Amplify deploys lossless HTML5 mix players and retains Drive fallback data', async () => {
  const html = await read('mixes.html');
  assert.ok(html.includes('src/drive-mixes.mjs?v=lossless-native-'));
  assert.ok(!html.includes('src/drive-mixes-github.mjs'));
  assert.ok(html.includes('id="hot-mixes"'));
  assert.doesNotMatch(html, /COMING WITH OUR AWS LAUNCH|OGVHS_GITHUB_ONLY_UPCOMING_START/);

  const hosted = JSON.parse(await read('public/hosted-mixes.json'));
  assert.deepEqual(hosted.mixes.map(item => item.title), [
    'Brian Wilson Forever',
    'Cleandrick Lamar',
    'Amy 2 Electric Boogaloo',
    'Tom Waits Forever'
  ]);
  assert.ok(hosted.mixes.every(item =>
    item.published === true &&
    item.audio_url.startsWith('https://media.ogvhs.com/mixes/') &&
    item.audio_url.endsWith('.flac')
  ));

  // Retain curated Drive source references as emergency fallback metadata.
  const drive = JSON.parse(await read('public/drive-mixes.json'));
  assert.deepEqual(drive.mixes.map(item => item.title),
    hosted.mixes.map(item => item.title));
  assert.equal(await read('src/drive-mixes-github.mjs'),
    await readFile(join(root,'src/drive-mixes-github.mjs'),'utf8'));
});

test('Amplify artifact excludes source-only and private content', async () => {
  for (const path of ['docs','tests','scripts','.git','CNAME','amplify.yml']) {
    await assert.rejects(stat(join(dist,path)), {code:'ENOENT'});
  }
});
