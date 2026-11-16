import {driveOpenUrl, drivePreviewUrl, normalizeMix, mixDetailUrl} from './drive-mixes-model.mjs';

const status = document.getElementById('hot-status');
const grid = document.getElementById('hot-mixes');
const nativePlayers = [];
let activePlayer = null;

function mediaSession() {
  return 'mediaSession' in navigator ? navigator.mediaSession : null;
}

function announceNowPlaying(audio, mix) {
  const session = mediaSession();
  if (!session) return;
  activePlayer = audio;
  if ('MediaMetadata' in window) {
    const artwork = mix.artwork ? new URL(mix.artwork, document.baseURI).href : undefined;
    session.metadata = new window.MediaMetadata({
      title: mix.title,
      artist: 'DJ OGVHS',
      album: 'Too Hot for Mixcloud',
      artwork: artwork ? [{src: artwork, sizes: '512x512', type: 'image/jpeg'}] : []
    });
  }
  session.playbackState = audio.paused ? 'paused' : 'playing';

  const play = () => { audio.play().catch(() => {}); };
  const pause = () => audio.pause();
  const seek = (seconds) => {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, seconds));
  };
  const other = (direction) => {
    const current = nativePlayers.findIndex(item => item.audio === audio);
    const next = nativePlayers[current + direction];
    if (next) {
      audio.pause();
      next.audio.play().catch(() => {});
    }
  };
  const actions = {
    play,
    pause,
    stop: () => {audio.pause(); audio.currentTime = 0;},
    seekbackward: details => seek(audio.currentTime - (details.seekOffset || 10)),
    seekforward: details => seek(audio.currentTime + (details.seekOffset || 10)),
    seekto: details => {
      if (Number.isFinite(details.seekTime)) seek(details.seekTime);
    },
    previoustrack: () => other(-1),
    nexttrack: () => other(1)
  };
  for (const [name, action] of Object.entries(actions)) {
    try { session.setActionHandler(name, action); } catch { /* Not supported by this browser. */ }
  }
  updatePosition(audio);
}

function updatePosition(audio) {
  const session = mediaSession();
  if (activePlayer !== audio || !session?.setPositionState ||
      !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    session.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate,
      position: Math.min(audio.duration, Math.max(0, audio.currentTime))
    });
  } catch { /* Browser does not support position updates for this media. */ }
}

function createNativePlayer(mix) {
  const audio = document.createElement('audio');
  audio.className = 'exclusive-audio';
  audio.controls = true;
  audio.preload = 'metadata';
  audio.playsInline = true;
  audio.src = mix.audioUrl;
  audio.setAttribute('aria-label', 'Play ' + mix.title);
  nativePlayers.push({audio, mix});
  audio.addEventListener('play', () => {
    for (const other of nativePlayers) {
      if (other.audio !== audio && !other.audio.paused) other.audio.pause();
    }
    announceNowPlaying(audio, mix);
  });
  audio.addEventListener('pause', () => {
    if (activePlayer === audio && mediaSession()) mediaSession().playbackState = 'paused';
  });
  audio.addEventListener('ended', () => {
    if (activePlayer === audio && mediaSession()) mediaSession().playbackState = 'none';
  });
  audio.addEventListener('durationchange', () => updatePosition(audio));
  audio.addEventListener('timeupdate', () => updatePosition(audio));
  audio.addEventListener('ratechange', () => updatePosition(audio));
  return audio;
}

function coverPlaceholder() {
  const wrap = document.createElement('div');
  wrap.className = 'exclusive-cover-placeholder';
  const record = document.createElement('span');
  record.className = 'exclusive-cover-record';
  record.setAttribute('aria-hidden','true');
  wrap.append(record);
  return wrap;
}

function mixCover(mix, href) {
  if (!href) return null;
  const anchor = document.createElement('a');
  anchor.className = 'exclusive-cover-link';
  anchor.href = href;
  anchor.setAttribute('aria-label', 'View ' + mix.title + ' details');
  if (mix.artwork) {
    const image = document.createElement('img');
    image.className = 'exclusive-cover';
    image.src = new URL(mix.artwork, document.baseURI).href;
    image.alt = mix.title + ' cover art';
    image.loading = 'lazy';
    image.addEventListener('error', () => anchor.replaceChildren(coverPlaceholder()), {once: true});
    anchor.append(image);
  } else {
    anchor.append(coverPlaceholder());
  }
  return anchor;
}

function renderMix(mix) {
  const card = document.createElement('article');
  card.className = 'mix-card drive-mix-card';
  const href = mix.slug ? mixDetailUrl(mix.slug) : null;
  const cover = mixCover(mix, href);
  if (cover) card.append(cover);
  const heading = document.createElement('h3');
  if (href) {
    const link = document.createElement('a');
    link.href = href;
    link.className = 'exclusive-title-link';
    link.textContent = mix.title;
    heading.append(link);
  } else {
    heading.textContent = mix.title;
  }
  card.append(heading);
  if (mix.description) {
    const description = document.createElement('p');
    description.className = 'mix-byline';
    description.textContent = mix.description;
    card.append(description);
  }
  if (mix.audioUrl) {
    card.append(createNativePlayer(mix));
  } else if (mix.id) {
    // Drive preview remains as fallback for catalogued, unmigrated tracks.
    const player = document.createElement('iframe');
    player.src = drivePreviewUrl(mix.id);
    player.title = 'Play ' + mix.title;
    player.loading = 'lazy';
    player.allow = 'autoplay; encrypted-media';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    card.append(player);
    const link = document.createElement('a');
    link.className = 'mixcloud-link';
    link.href = driveOpenUrl(mix.id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open player in Google Drive';
    card.append(link);
  }
  return card;
}
async function loadPublishedMixes() {
  const response = await fetch(new URL('../public/app-config.json', import.meta.url), {cache:'no-store'});
  if (!response.ok) throw new Error('No site config');
  const {supabaseUrl,supabaseAnonKey} = await response.json();
  const base = new URL(supabaseUrl);
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') || !supabaseAnonKey) {
    throw new Error('No published mix catalog');
  }
  const url = new URL('/rest/v1/dj_mixes', base);
  url.search = new URLSearchParams({
    select:'title,description,drive_file_id',
    is_published:'eq.true',
    order:'created_at.desc',
    limit:'30'
  }).toString();
  const feed = await fetch(url, {
    headers:{apikey:supabaseAnonKey},
    cache:'no-store',
    signal:AbortSignal.timeout(15000)
  });
  if (!feed.ok) throw new Error('Mix catalog not yet configured');
  const rows = await feed.json();
  if (!Array.isArray(rows)) throw new Error('Invalid mix catalog');
  return rows.map(normalizeMix).filter(Boolean);
}

async function loadLegacyMixes() {
  const response = await fetch(new URL('../public/drive-mixes.json', import.meta.url), {
    cache:'no-store',
    signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Unreachable mix list');
  const payload = await response.json();
  if (!Array.isArray(payload.mixes)) throw new Error('Invalid list');
  return payload.mixes.map(normalizeMix).filter(Boolean);
}

async function loadHostedMixes() {
  // This manifest is deliberately OGVHS-owned; no ACS suite data or app dependency.
  const response = await fetch(new URL('../public/hosted-mixes.json', import.meta.url), {
    cache:'no-store',
    signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) return [];
  const payload = await response.json();
  if (!Array.isArray(payload.mixes)) return [];
  return payload.mixes.filter(item => item.published !== false)
    .map(normalizeMix).filter(mix => Boolean(mix?.audioUrl));
}

async function load() {
  status.textContent = 'Loading exclusive mixes…';
  for (const item of nativePlayers) item.audio.pause();
  nativePlayers.length = 0;
  activePlayer = null;
  grid.replaceChildren();
  document.getElementById('hot-retry')?.remove();
  try {
    // Always load explicitly published AWS tracks even when an older database is active.
    const hosted = await loadHostedMixes().catch(() => []);
    const [database, curated] = await Promise.all([
      loadPublishedMixes().catch(() => []),
      loadLegacyMixes().catch(() => [])
    ]);
    const mixes = [];
    const titles = new Set();
    for (const mix of [...hosted, ...database, ...curated]) {
      const key = mix.title.toLowerCase();
      if (!titles.has(key)) {
        titles.add(key);
        mixes.push(mix);
      }
    }
    // Brian Wilson Forever is the featured exclusive mix regardless of source order.
    const brianIndex = mixes.findIndex(mix => mix.title.toLowerCase() === 'brian wilson forever');
    if (brianIndex > 0) mixes.unshift(...mixes.splice(brianIndex, 1));
    grid.replaceChildren(...mixes.map(renderMix));
    status.textContent = mixes.length ? '' : 'Exclusive mixes are coming soon.';
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
