import {normalizeMix, parseMixSlug} from './drive-mixes-model.mjs';

const status = document.getElementById('mix-detail-status');
const article = document.getElementById('mix-detail');
const player = document.getElementById('mix-detail-audio');
const shareStatus = document.getElementById('mix-detail-share-status');
const requestedSlug = parseMixSlug(new URL(window.location.href).searchParams.get('mix'));

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const total = Math.floor(seconds);
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return parts[0] ? parts.map((part, i) => i ? String(part).padStart(2, '0') : String(part)).join(':')
    : parts.slice(1).map((part, i) => i ? String(part).padStart(2,'0') : String(part)).join(':');
}

function createPlaceholder() {
  const wrap = element('div', 'mix-detail-placeholder');
  const record = element('span', 'mix-detail-record');
  record.setAttribute('aria-hidden', 'true');
  wrap.append(record, element('span', 'mix-detail-placeholder-note', 'DJ OGVHS'));
  return wrap;
}

function showArtwork(mix) {
  const holder = document.getElementById('mix-detail-artwork');
  holder.replaceChildren();
  if (!mix.artwork) {
    holder.append(createPlaceholder());
    return;
  }
  const image = document.createElement('img');
  image.alt = mix.title + ' cover artwork';
  image.src = new URL(mix.artwork, document.baseURI).href;
  image.addEventListener('error', () => holder.replaceChildren(createPlaceholder()), {once:true});
  holder.append(image);
}

function addMeta(label, value) {
  const el = element('span');
  el.append(element('strong', null, value), document.createTextNode(' ' + label));
  document.getElementById('mix-detail-meta').append(el);
}

function updatePosition() {
  const session = navigator.mediaSession;
  if (!session?.setPositionState || !Number.isFinite(player.duration)) return;
  try {
    session.setPositionState({
      duration: player.duration,
      position: Math.max(0, Math.min(player.duration, player.currentTime)),
      playbackRate: player.playbackRate
    });
  } catch { /* Unsupported on this browser. */ }
}

function bindMediaSession(mix) {
  const session = navigator.mediaSession;
  if (!session) return;
  if (window.MediaMetadata) {
    const artwork = mix.artwork ? new URL(mix.artwork, document.baseURI).href : null;
    session.metadata = new MediaMetadata({
      title: mix.title,
      artist: 'DJ OGVHS',
      album: 'Too Hot for Mixcloud',
      artwork: artwork ? [{src:artwork}] : []
    });
  }
  const seek = (time) => {
    if (!Number.isFinite(player.duration)) return;
    player.currentTime = Math.max(0, Math.min(player.duration, time));
  };
  const handlers = {
    play: () => player.play().catch(() => {}),
    pause: () => player.pause(),
    stop: () => {player.pause(); player.currentTime = 0;},
    seekbackward: (details) => seek(player.currentTime - (details.seekOffset || 10)),
    seekforward: (details) => seek(player.currentTime + (details.seekOffset || 10)),
    seekto: (details) => {if (Number.isFinite(details.seekTime)) seek(details.seekTime);}
  };
  for (const [name, handler] of Object.entries(handlers)) {
    try {session.setActionHandler(name,handler);} catch { /* Not supported. */ }
  }
  player.addEventListener('play', () => {session.playbackState='playing';updatePosition();});
  player.addEventListener('pause', () => {session.playbackState='paused';});
  player.addEventListener('ended', () => {session.playbackState='none';});
  for (const event of ['timeupdate','durationchange','ratechange']) player.addEventListener(event,updatePosition);
}

function renderTracklist(mix) {
  const container = document.getElementById('mix-detail-tracklist');
  container.replaceChildren();
  if (!mix.tracklist?.length) {
    container.append(element('p','helper','Tracklist and timestamps have not been added yet.'));
    return;
  }
  for (const track of mix.tracklist) {
    const clickable = Number.isFinite(track.startSeconds);
    const row = element(clickable ? 'button' : 'div','mix-detail-track-row');
    if (clickable) {
      row.type = 'button';
      row.title = 'Seek to ' + formatDuration(track.startSeconds);
      row.addEventListener('click',()=>{
        if (player.readyState) player.currentTime = track.startSeconds;
        else player.addEventListener('loadedmetadata',()=>{player.currentTime=track.startSeconds;},{once:true});
        player.play().catch(()=>{});
      });
    }
    row.append(
      element('span','mix-detail-track-time',clickable ? formatDuration(track.startSeconds) : '—'),
      element('span','mix-detail-track-name',track.chapter || (track.artist ? track.artist + ' — ' : '') + track.song)
    );
    container.append(row);
  }
}

async function shareMix(mix) {
  const url = new URL('./mix.html?mix=' + encodeURIComponent(mix.slug),document.baseURI).href;
  try {
    if (navigator.share) {
      await navigator.share({title:mix.title + ' | DJ OGVHS',url});
      shareStatus.textContent = '';
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = 'Link copied to clipboard.';
    } else {
      shareStatus.textContent = 'Share this link: ' + url;
    }
  } catch (error) {
    if (error?.name !== 'AbortError') shareStatus.textContent = 'Share this link: ' + url;
  }
}

function render(mix) {
  document.title = mix.title + ' | DJ OGVHS';
  const description = mix.description || 'Listen to this exclusive mix from DJ OGVHS.';
  document.querySelector('meta[name="description"]').content = description;
  document.querySelector('meta[property="og:title"]').content = document.title;
  document.querySelector('meta[property="og:description"]').content = description;
  showArtwork(mix);
  document.getElementById('mix-detail-title').textContent = mix.title;
  const metadata = document.getElementById('mix-detail-meta');
  metadata.replaceChildren();
  if (mix.durationSeconds) addMeta('duration', formatDuration(mix.durationSeconds));
  if (mix.publishedAt) {
    const date = new Date(mix.publishedAt);
    if (Number.isFinite(date.getTime())) addMeta('published',date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}));
  }
  if (mix.stats) {
    for (const field of ['plays','favorites','reposts','comments']) {
      if (Number.isInteger(mix.stats[field])) addMeta(field,mix.stats[field].toLocaleString());
    }
  }
  const tags = document.getElementById('mix-detail-tags');
  tags.replaceChildren(...(mix.tags || []).map(tag => element('span','mix-detail-tag',tag)));
  document.getElementById('mix-detail-description').textContent = description;
  renderTracklist(mix);
  player.src = mix.audioUrl;
  player.setAttribute('aria-label','Play ' + mix.title + ' in lossless quality');
  bindMediaSession(mix);
  document.getElementById('mix-detail-share').addEventListener('click',()=>shareMix(mix));
  article.hidden = false;
  status.textContent = '';
}

async function load() {
  if (!requestedSlug) {
    status.textContent = 'Mix not found. Choose a mix from the Mixes page.';
    return;
  }
  try {
    const response = await fetch(new URL('../public/hosted-mixes.json',import.meta.url),{
      cache:'no-store',signal:AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('The mix list could not be loaded.');
    const payload = await response.json();
    if (!Array.isArray(payload.mixes)) throw new Error('Invalid mix list');
    const raw = payload.mixes.find(item => item.slug === requestedSlug && item.published === true);
    const mix = normalizeMix(raw);
    if (!mix?.audioUrl || !mix.slug) {
      status.textContent = 'Mix not found. Choose a mix from the Mixes page.';
      return;
    }
    render(mix);
  } catch {
    status.textContent = 'This mix could not load right now. Return to the Mixes page and try again.';
  }
}

load();
