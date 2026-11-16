import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseHostedAudioUrl} from '../src/drive-mixes-model.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = path => readFile(join(root, path), 'utf8');
const artifact = path => readFile(join(root, 'dist', path), 'utf8');

const expectedTitles = [
  'Brian Wilson Forever',
  'Cleandrick Lamar',
  'Amy 2 Electric Boogaloo',
  'Tom Waits Forever'
];
const expectedSlugs = [
  'brian-wilson-forever',
  'cleandrick-lamar',
  'amy-2-electric-boogaloo',
  'tom-waits-forever'
];

test('public Mixes page uses lossless player and preserves Mixcloud sections and Drive rollback data', async () => {
  const html = await source('mixes.html');
  const curated = JSON.parse(await source('public/drive-mixes.json'));
  const hosted = JSON.parse(await source('public/hosted-mixes.json'));

  assert.match(html, /src="\.\/src\/drive-mixes\.mjs\?v=lossless-native-[^"]+"/);
  assert.doesNotMatch(html, /src="\.\/src\/drive-mixes-github\.mjs/);
  assert.match(html, /id="hot-mixes"/);
  assert.match(html, /id="faves-mixes"/);
  assert.match(html, /id="latest-mixes"/);
  assert.match(html, /src="\.\/src\/mixes\.mjs/);
  assert.doesNotMatch(html, /COMING WITH OUR AWS LAUNCH|OGVHS_GITHUB_ONLY_UPCOMING_START|id="cleandrick-title"/);

  assert.deepEqual(curated.mixes.map(mix => mix.title), expectedTitles);
  for (const mix of curated.mixes) {
    assert.match(mix.url, /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]{10,128}\/view$/);
  }

  assert.deepEqual(hosted.mixes.map(mix => mix.title), expectedTitles);
  hosted.mixes.forEach((mix, index) => {
    assert.equal(mix.published, true, mix.title + ' must be published');
    const expected = 'https://media.ogvhs.com/mixes/' + expectedSlugs[index] + '.flac';
    assert.equal(mix.audio_url, expected);
    assert.equal(parseHostedAudioUrl(mix.audio_url), expected);
  });
});

test('Amplify artifact ships native FLAC players, hosted manifest and deployment marker', async () => {
  const mixes = await artifact('mixes.html');
  const index = await artifact('index.html');
  assert.match(index, /OGVHS_AWS_AMPLIFY_BUILD/);
  assert.equal(mixes, await source('mixes.html'));
  assert.match(mixes, /src="\.\/src\/drive-mixes\.mjs\?v=lossless-native-[^"]+"/);
  assert.doesNotMatch(mixes, /src="\.\/src\/drive-mixes-github\.mjs/);
  assert.doesNotMatch(mixes, /OGVHS_GITHUB_ONLY_UPCOMING_(?:START|END)/);

  assert.deepEqual(
    JSON.parse(await artifact('public/hosted-mixes.json')),
    JSON.parse(await source('public/hosted-mixes.json'))
  );
  assert.deepEqual(JSON.parse(await artifact('public/drive-mixes.json')).mixes.map(mix => mix.title),
    expectedTitles);
});
