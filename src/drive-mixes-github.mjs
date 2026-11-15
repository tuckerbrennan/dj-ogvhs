// GitHub Pages compatibility player. Curated Google Drive embeds require link-viewable source files.
import {driveOpenUrl,drivePreviewUrl,normalizeMix} from './drive-mixes-model.mjs';

const status = document.getElementById('hot-status');
const grid = document.getElementById('hot-mixes');

function renderMix(mix) {
  const card = document.createElement('article');
  card.className = 'mix-card drive-mix-card';
  const heading = document.createElement('h3');
  heading.textContent = mix.title;
  const player = document.createElement('iframe');
  player.src = drivePreviewUrl(mix.id);
  player.title = 'Play ' + mix.title;
  player.loading = 'lazy';
  player.allow = 'autoplay; encrypted-media';
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  const link = document.createElement('a');
  link.className = 'mixcloud-link';
  link.href = driveOpenUrl(mix.id);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open player in Google Drive ↗';
  card.append(heading);
  if (mix.description) {
    const description = document.createElement('p');
    description.className = 'mix-byline';
    description.textContent = mix.description;
    card.append(description);
  }
  card.append(player,link);
  return card;
}

async function loadPublishedMixes() {
  const response = await fetch(new URL('../public/app-config.json', import.meta.url), {cache:'no-store'});
  if (!response.ok) throw new Error('No site config');
  const {supabaseUrl,supabaseAnonKey} = await response.json();
  const base = new URL(supabaseUrl);
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') || !supabaseAnonKey) throw new Error('No published mix catalog');
  const url = new URL('/rest/v1/dj_mixes', base);
  url.search = new URLSearchParams({
    select:'title,description,drive_file_id',
    is_published:'eq.true',
    order:'created_at.desc',
    limit:'30'
  }).toString();
  const feed = await fetch(url, {headers:{apikey:supabaseAnonKey},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if (!feed.ok) throw new Error('Mix catalog not yet configured');
  const rows = await feed.json();
  if (!Array.isArray(rows)) throw new Error('Invalid mix catalog');
  return rows.map(normalizeMix).filter(Boolean);
}
async function loadLegacyMixes() {
  const response = await fetch(new URL('../public/drive-mixes.json', import.meta.url), {cache:'no-store',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Unreachable mix list');
  const payload = await response.json();
  if (!Array.isArray(payload.mixes)) throw new Error('Invalid list');
  return payload.mixes.map(normalizeMix).filter(Boolean);
}

async function load() {
  status.textContent = 'Loading exclusive mixes…';
  grid.replaceChildren();
  document.getElementById('hot-retry')?.remove();
  try {
    // Show curated exclusive mixes first, even when a Supabase catalog exists.
    // Keep any additional published database mixes after the featured selection.
    const [curated, published] = await Promise.all([
      loadLegacyMixes().catch(() => []),
      loadPublishedMixes().catch(() => [])
    ]);
    const mixes = [];
    const seen = new Set();
    for (const mix of [...curated, ...published]) {
      if (!mix.id) continue; // Drive iframe player needs a Drive ID.
      const key = mix.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      mixes.push(mix);
    }
    const brianIndex = mixes.findIndex(mix => mix.title.toLowerCase() === 'brian wilson forever');
    if (brianIndex > 0) mixes.unshift(...mixes.splice(brianIndex, 1));
    grid.replaceChildren(...mixes.map(renderMix));
    status.textContent = mixes.length ? '' : 'No exclusive mixes are available right now.';
  } catch {
    status.textContent = 'The exclusive mixes could not load right now.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.id = 'hot-retry';
    retry.className = 'mix-retry';
    retry.textContent = 'Try again';
    retry.addEventListener('click',load);
    grid.after(retry);
  }
}
load();
