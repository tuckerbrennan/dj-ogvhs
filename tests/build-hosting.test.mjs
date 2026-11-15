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

test('Amplify preserves same live Google Drive embeds and ordering', async () => {
  const html = await read('mixes.html');
  assert.match(html, /src\/drive-mixes-github\.mjs/);
  assert.match(html, /id="hot-mixes"/);
  assert.doesNotMatch(html, /COMING WITH OUR AWS LAUNCH|OGVHS_GITHUB_ONLY_UPCOMING_START/);
  const data = JSON.parse(await read('public/drive-mixes.json'));
  assert.deepEqual(data.mixes.map(item => item.title), [
    'Brian Wilson Forever',
    'Cleandrick Lamar',
    'Amy 2 Electric Boogaloo',
    'Tom Waits Forever'
  ]);
  assert.equal(await read('src/drive-mixes-github.mjs'),
    await readFile(join(root,'src/drive-mixes-github.mjs'),'utf8'));
});

test('Amplify artifact excludes source-only and private content', async () => {
  for (const path of ['docs','tests','scripts','.git','CNAME','amplify.yml']) {
    await assert.rejects(stat(join(dist,path)), {code:'ENOENT'});
  }
});
