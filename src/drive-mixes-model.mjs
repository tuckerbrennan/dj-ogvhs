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
const AUDIO_SUFFIX = /\.(?:mp3|m4a|mp4|aac|ogg|wav)$/i;
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
export function normalizeMix(item) {
  if (!item || typeof item !== 'object' || typeof item.title !== 'string') return null;
  const title = item.title.trim();
  const id = parseDriveId(item.drive_file_id || item.driveFileId || item.url);
  const audioUrl = parseHostedAudioUrl(item.audio_url || item.audioUrl);
  if (!title || title.length > 160 || (!id && !audioUrl)) return null;
  const description = typeof item.description === 'string' ? item.description.trim().slice(0,600) : '';
  const artwork = parseArtworkPath(item.artwork);
  const mix = {title,description};
  if (id) mix.id = id;
  if (audioUrl) mix.audioUrl = audioUrl;
  if (artwork) mix.artwork = artwork;
  return mix;
}

/**
 * Keep curated embeds visible now, promote verified AWS streams when published,
 * and preserve a Google Drive fallback for a failed hosted stream.
 * Supabase may add extra records but does not reorder the curated playlist.
 */
export function mergeExclusiveMixes({hosted = [], curated = [], database = []} = {}) {
  const byTitle = new Map();
  for (const mix of [...curated, ...database]) {
    if (!mix?.title) continue;
    const key = mix.title.toLocaleLowerCase('en-US');
    if (!byTitle.has(key)) byTitle.set(key, mix);
  }
  for (const mix of hosted) {
    if (!mix?.title || !mix.audioUrl) continue;
    const key = mix.title.toLocaleLowerCase('en-US');
    const fallback = byTitle.get(key);
    byTitle.set(key, {
      ...fallback,
      ...mix,
      ...(fallback?.id && !mix.id ? {id: fallback.id} : {})
    });
  }
  const ordered = [...byTitle.values()];
  const brian = ordered.findIndex(mix => mix.title.toLocaleLowerCase('en-US') === 'brian wilson forever');
  if (brian > 0) ordered.unshift(...ordered.splice(brian, 1));
  return ordered;
}
