import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = path => readFile(join(root, path), 'utf8');
const artifact = path => readFile(join(root, 'dist', path), 'utf8');

const expectedTitles = [
  'Brian Wilson Forever',
  'Cleandrick Lamar',
  'Amy 2 Electric Boogaloo',
  'Tom Waits Forever'
];

test('public Mixes page includes curated Google Drive embeds, not outdated teasers', async () => {
  const html = await source('mixes.html');
  const curated = JSON.parse(await source('public/drive-mixes.json'));
  const hosted = JSON.parse(await source('public/hosted-mixes.json'));

  assert.match(html, /src="\.\/src\/drive-mixes-github\.mjs\?v=published-drive-20261115"/);
  assert.match(html, /id="hot-mixes"/);
  assert.doesNotMatch(html, /COMING WITH OUR AWS LAUNCH|OGVHS_GITHUB_ONLY_UPCOMING_START|id="cleandrick-title"/);
  assert.doesNotMatch(html, /src="\.\/src\/drive-mixes\.mjs\?/);

  assert.deepEqual(curated.mixes.map(mix => mix.title), expectedTitles);
  for (const mix of curated.mixes) {
    assert.match(mix.url, /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]{10,128}\/view$/);
  }
  // The existing Drive embeds are published; native AWS audio stays gated.
  for (const mix of hosted.mixes) {
    assert.equal(mix.published, false, mix.title + ' must not enable unverified AWS audio');
    assert.equal(mix.audio_url, undefined);
  }
});

test('Amplify artifact preserves existing embeds and marks the AWS deployment', async () => {
  const mixes = await artifact('mixes.html');
  const index = await artifact('index.html');
  assert.match(index, /OGVHS_AWS_AMPLIFY_BUILD/);
  assert.equal(mixes, await source('mixes.html'));
  assert.match(mixes, /src="\.\/src\/drive-mixes-github\.mjs\?v=published-drive-20261115"/);
  assert.doesNotMatch(mixes, /OGVHS_GITHUB_ONLY_UPCOMING_(?:START|END)/);
  assert.deepEqual(JSON.parse(await artifact('public/drive-mixes.json')).mixes.map(mix => mix.title),
    expectedTitles);
});
