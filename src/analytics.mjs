// AWS audience measurement. Existing decline choices and GPC remain authoritative.
import { CHOICE_KEY, analyticsBlocked, pageId, sourceDomain, linkMeasurement } from './analytics-model.mjs';
const CONFIG_URL = new URL('../public/analytics-config.json', import.meta.url);
let rum;
const blocked = () => {
  try { return analyticsBlocked(localStorage, navigator); }
  catch { return true; } // Fail closed when browser privacy settings block storage access.
};
function record(type, data = {}) {
  if (blocked() || !rum) return;
  try { rum.recordEvent('ogvhs.' + type, data); } catch { /* Analytics never interrupts the site. */ }
}
function clearLegacyCookies() {
  for (const name of document.cookie.split(';').map(c => c.split('=')[0].trim())) {
    if (!/^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name)) continue;
    for (const domain of ['', location.hostname, '.' + location.hostname, '.ogvhs.com']) {
      document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' + (domain ? '; domain=' + domain : '');
    }
  }
}
function addControl() {
  const footer = document.querySelector('footer');
  if (!footer || document.getElementById('djogvhs-analytics-settings')) return;
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'djogvhs-analytics-settings'; button.className = 'analytics-preferences';
  button.textContent = blocked() ? 'Enable analytics' : 'Disable analytics';
  button.setAttribute('aria-label', blocked() ? 'Enable optional AWS analytics' : 'Disable AWS analytics');
  if (navigator.globalPrivacyControl === true) {
    button.textContent = 'Analytics blocked by browser'; button.disabled = true;
    button.title = 'Your browser has sent a Global Privacy Control signal.';
  }
  button.addEventListener('click', () => {
    const disable = !blocked();
    if (disable) { rum?.disable(); clearLegacyCookies(); }
    try { localStorage.setItem(CHOICE_KEY, disable ? 'declined' : 'accepted'); } catch { /* Storage may be blocked. */ }
    location.reload();
  });
  footer.appendChild(button);
}
function measure() {
  const view = () => {
    if (blocked()) return;
    rum.recordPageView({pageId: pageId(location.pathname), pageAttributes: {title: 'DJ OGVHS'}});
    record('traffic_source', {domain: sourceDomain(document.referrer) || 'direct'});
  };
  view();
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) { const result = original.apply(this, args); view(); return result; };
  }
  window.addEventListener('popstate', view);
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const measurement = linkMeasurement(link.href, location.origin, link.hasAttribute('download'));
    if (measurement) record(measurement.type, measurement.data);
  });
  let scrolled = false;
  window.addEventListener('scroll', () => {
    const height = document.documentElement.scrollHeight;
    if (!scrolled && height > innerHeight && (scrollY + innerHeight) / height >= 0.9) {
      scrolled = true; record('scroll', {percent: 90});
    }
  }, {passive: true});
  const started = new WeakSet();
  document.addEventListener('focusin', event => {
    const form = event.target.closest?.('form');
    if (form && !started.has(form)) { started.add(form); record('form_start'); }
  });
  document.addEventListener('submit', () => record('form_submit'), true);
  let searchTimer;
  document.addEventListener('input', event => {
    if (event.target.id !== 'search') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (event.target.value.trim()) record('view_search_results'); }, 800);
  });
  const progress = new WeakMap();
  for (const kind of ['audio', 'video']) {
    for (const [domEvent, measurement] of [['play','media_start'], ['ended','media_complete']]) {
      document.addEventListener(domEvent, event => {
        if (event.target.localName === kind) record(measurement, {kind});
      }, true);
    }
  }
  document.addEventListener('timeupdate', event => {
    const media = event.target;
    if (!['audio', 'video'].includes(media.localName) || !Number.isFinite(media.duration) || media.duration <= 0) return;
    const reached = progress.get(media) || new Set();
    for (const percent of [25,50,75]) if (!reached.has(percent) && media.currentTime / media.duration >= percent / 100) {
      reached.add(percent); record('media_progress', {kind: media.localName, percent});
    }
    progress.set(media, reached);
  }, true);
}
async function init() {
  addControl();
  clearLegacyCookies();
  if (blocked()) return;
  try {
    const response = await fetch(CONFIG_URL, {cache:'no-store'});
    if (!response.ok) return;
    const config = await response.json();
    if (config.provider !== 'aws-rum' || config.region !== 'us-east-2' ||
        !/^[0-9a-f-]{36}$/.test(config.monitorId) || !/^us-east-2:[0-9a-f-]{36}$/.test(config.identityPoolId)) return;
    const {createRum} = await import('./analytics-rum.bundle.mjs');
    if (blocked()) return;
    rum = await createRum(config);
    if (blocked()) { rum.disable(); return; }
    measure();
  } catch { /* Measurement is optional; site functionality remains available. */ }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
else init();
