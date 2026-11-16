// Validate media links: Drive previews or OGVHS-owned HTTPS audio only.
const DRIVE_ID = /^[a-zA-Z0-9_-]{10,128}$/;
export function parseDriveId(value) {
  if (typeof value !== 'string') return null;
  if (DRIVE_ID.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password) return null;
    const match = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]{10,128})(?:\/.*)?$/);
    const id = match?.[1] || (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : null);
    return DRIVE_ID.test(id || '') ? id : null;
  } catch { return null; }
}
export function drivePreviewUrl(id) {
  if (!DRIVE_ID.test(id || '')) throw new Error('Invalid Drive file ID');
  return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview';
}
export function driveOpenUrl(id) {
  if (!DRIVE_ID.test(id || '')) throw new Error('Invalid Drive file ID');
  return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view';
}

const MEDIA_HOSTS = new Set(['media.ogvhs.com', 'ogvhs.com', 'www.ogvhs.com']);
const AUDIO_SUFFIX = /\.(?:mp3|m4a|mp4|aac|ogg|wav|flac)$/i;
export function parseHostedAudioUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, 'https://ogvhs.com');
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (!MEDIA_HOSTS.has(url.hostname)) return null;
    if (!(/^\/mixes\/[a-z0-9/_-]+(?:\.[a-z0-9]+)$/i.test(url.pathname) ||
           /^\/media\/[a-z0-9/_-]+(?:\.[a-z0-9]+)$/i.test(url.pathname))) return null;
    if (!AUDIO_SUFFIX.test(url.pathname)) return null;
    if (url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}
export function parseArtworkPath(value) {
  return typeof value === 'string' &&
    /^\.\/public\/mix-art\/[a-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(value)
    ? value : null;
}
// Stable canonical detail links only for catalogued OGVHS mixes.
export function parseMixSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    value.length <= 100 ? value : null;
}
export function mixDetailUrl(slug) {
  const safe = parseMixSlug(slug);
  return safe ? './mix.html?mix=' + encodeURIComponent(safe) : null;
}
function textField(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function normalizeTracklist(value) {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 300).map((item) => {
    if (!item || typeof item !== 'object') return null;
    const start = Number.isFinite(item.start_seconds) && item.start_seconds >= 0 &&
      item.start_seconds <= 86400 ? item.start_seconds : null;
    const chapter = textField(item.chapter, 180);
    if (chapter) return {startSeconds:start,chapter};
    const artist = textField(item.artist, 180);
    const song = textField(item.song || item.title, 180);
    return song ? {startSeconds:start, artist, song} : null;
  }).filter(Boolean);
}
export function normalizeMix(item) {
  if (!item || typeof item !== 'object' || typeof item.title !== 'string') return null;
  const title = item.title.trim();
  const id = parseDriveId(item.drive_file_id || item.driveFileId || item.url);
  const audioUrl = parseHostedAudioUrl(item.audio_url || item.audioUrl);
  if (!title || title.length > 160 || (!id && !audioUrl)) return null;
  const description = typeof item.description === 'string' ? item.description.trim().slice(0,1000) : '';
  const artwork = parseArtworkPath(item.artwork);
  const mix = {title,description};
  if (id) mix.id = id;
  if (audioUrl) mix.audioUrl = audioUrl;
  if (artwork) mix.artwork = artwork;
  const slug = parseMixSlug(item.slug);
  if (slug) mix.slug = slug;
  if (Number.isFinite(item.duration_seconds) &&
      item.duration_seconds > 0 && item.duration_seconds <= 86400) {
    mix.durationSeconds = item.duration_seconds;
  }
  if (Array.isArray(item.tags)) {
    mix.tags = item.tags.slice(0, 5).map(tag => textField(tag, 60)).filter(Boolean);
  }
  const tracklist = normalizeTracklist(item.tracklist);
  if (tracklist) mix.tracklist = tracklist;
  if (typeof item.published_at === 'string' &&
      /^\d{4}-\d{2}-\d{2}/.test(item.published_at) &&
      Number.isFinite(Date.parse(item.published_at))) {
    mix.publishedAt = item.published_at;
  }
  const stats = {};
  for (const field of ['plays', 'favorites', 'reposts', 'comments']) {
    const count = safeCount(item[field]);
    if (count !== null) stats[field] = count;
  }
  if (Object.keys(stats).length) mix.stats = stats;
  return mix;
}
