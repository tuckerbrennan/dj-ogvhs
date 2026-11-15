import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('GitHub Pages displays Cleandrick teaser and uses only the legacy Drive player', async () => {
  const html = await readFile(join(root, 'mixes.html'), 'utf8');
  const hosted = JSON.parse(await readFile(join(root, 'public/hosted-mixes.json'), 'utf8'));
  const cleandrick = hosted.mixes.find(mix => mix.title === 'Cleandrick Lamar');

  assert.ok(cleandrick, 'Exclusive mix must remain listed in migration manifest');
  assert.equal(cleandrick.published, false, 'Private Drive recording must not be published before AWS streaming works');
  assert.equal(cleandrick.audio_url, undefined);
  assert.match(html, /id="cleandrick-title">Cleandrick Lamar<\/h3>/);
  assert.match(html, /COMING WITH OUR AWS LAUNCH/);
  assert.match(html, /src="\.\/src\/drive-mixes-github\.mjs\?v=github-legacy-20261115"/);
  assert.doesNotMatch(html, /src="\.\/src\/drive-mixes\.mjs\?/);
  assert.doesNotMatch(html, /1s5qWi4BOkJQHPALsROjks3fcWIBJV9OX/, 'Do not leak private source file links into the page');
});

test('Amplify build enables native player but strips GitHub-only upcoming card', async () => {
  execFileSync(process.execPath, ['scripts/build-hosting.mjs'], {
    cwd:root, encoding:'utf8', timeout:20000
  });
  const mixes = await readFile(join(root, 'dist/mixes.html'), 'utf8');
  const index = await readFile(join(root, 'dist/index.html'), 'utf8');
  assert.match(index, /OGVHS_AWS_AMPLIFY_BUILD/);
  assert.match(mixes, /src="\.\/src\/drive-mixes\.mjs\?v=aws-native-20261115"/);
  assert.doesNotMatch(mixes, /src="\.\/src\/drive-mixes-github\.mjs/);
  assert.doesNotMatch(mixes, /id="cleandrick-title"/);
  assert.doesNotMatch(mixes, /OGVHS_GITHUB_ONLY_UPCOMING_(?:START|END)/);
});
