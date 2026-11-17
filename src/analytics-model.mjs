export const CHOICE_KEY = 'djogvhs_analytics_consent_v1';
const PAGES = new Set(['/', '/index.html', '/about.html', '/mixes.html', '/mix.html', '/thanks.html', '/privacy.html']);
export function pageId(pathname) { return PAGES.has(pathname) ? pathname : '/other'; }
export function analyticsBlocked(storage, navigator) {
  if (navigator.globalPrivacyControl === true) return true;
  try { return storage.getItem(CHOICE_KEY) === 'declined'; } catch { return false; }
}
export function sourceDomain(value) {
  try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.hostname : ''; } catch { return ''; }
}
export function linkMeasurement(href, origin, download = false) {
  try {
    const u = new URL(href, origin);
    if (!/^https?:$/.test(u.protocol)) return null;
    const extension = u.pathname.match(/\.(flac|mp3|wav|aiff|m4a|zip|pdf)$/i)?.[1]?.toLowerCase();
    if (download || extension) return {type: 'file_download', data: {extension: extension || 'other'}};
    if (u.origin !== origin) return {type: 'outbound_click', data: {domain: u.hostname}};
  } catch { /* Ignore invalid or non-web links. */ }
  return null;
}
