// Anonymous per-browser request quota helpers. The demo count is not an actual submission.
export const HOURLY_REQUEST_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;
const DEMO_KEY = "dj-ogvhs-demo-requests-v1";
const LISTENER_KEY = "dj-ogvhs-listener-id-v1";

let fallbackListenerId = null;
export function getListenerId(storage = globalThis.localStorage) {
  let id = null;
  try { id = storage?.getItem(LISTENER_KEY); } catch { /* Storage may be blocked. */ }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || "")) return id;
  id = fallbackListenerId || crypto.randomUUID();
  fallbackListenerId = id;
  try { storage?.setItem(LISTENER_KEY, id); } catch { /* Session-only fallback. */ }
  return id;
}

export function summarizeQuota(timestamps, now = Date.now()) {
  const valid = (Array.isArray(timestamps) ? timestamps : [])
    .filter(t => Number.isFinite(t) && t > now - WINDOW_MS && t <= now)
    .sort((a, b) => a - b);
  return {
    limit: HOURLY_REQUEST_LIMIT,
    remaining: Math.max(0, HOURLY_REQUEST_LIMIT - valid.length),
    nextAvailableAt: valid.length ? new Date(valid[0] + WINDOW_MS).toISOString() : null,
    history: valid
  };
}

export function demoQuota(storage = localStorage, now = Date.now()) {
  let history = [];
  try { history = JSON.parse(storage.getItem(DEMO_KEY) || "[]"); }
  catch { history = []; }
  return summarizeQuota(history, now);
}

export function useDemoRequest(storage = localStorage, now = Date.now()) {
  const current = demoQuota(storage, now);
  if (current.remaining === 0) return { ...current, accepted: false };
  const updated = summarizeQuota([...current.history, now], now);
  storage.setItem(DEMO_KEY, JSON.stringify(updated.history));
  return { ...updated, accepted: true };
}
