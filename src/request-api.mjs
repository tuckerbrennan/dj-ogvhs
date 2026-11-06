import { getListenerId } from "./request-quota.mjs";

// Public key and Supabase URL are safe for the browser. Never put a secret key here.
export async function loadRequestConfig() {
  const url = new URL("../public/app-config.json", import.meta.url);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const config = await response.json();
  if (typeof config.supabaseUrl !== "string" || typeof config.supabaseAnonKey !== "string") return null;
  try {
    const endpoint = new URL(config.supabaseUrl);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "127.0.0.1" && endpoint.hostname !== "localhost") return null;
    if (!config.supabaseAnonKey.trim()) return null;
    return { supabaseUrl: endpoint.origin, supabaseAnonKey: config.supabaseAnonKey.trim() };
  } catch {
    return null;
  }
}

function requestHeaders(config) {
  return {
    "Content-Type": "application/json",
    "apikey": config.supabaseAnonKey,
    "x-dj-listener-id": getListenerId()
  };
}

export async function getRequestQuota(config) {
  if (!config) throw new Error("Requests are not enabled yet.");
  const response = await fetch(config.supabaseUrl + "/functions/v1/submit-request", {
    method: "GET",
    headers: requestHeaders(config),
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to check request limit.");
  if (!Number.isInteger(result.remaining) || result.remaining < 0 || result.remaining > 3) {
    throw new Error("Request limit information is unavailable.");
  }
  return {
    limit: 3,
    remaining: result.remaining,
    nextAvailableAt: result.nextAvailableAt || null
  };
}

export async function sendRequest(config, payload) {
  if (!config) throw new Error("Requests are not enabled yet.");
  const response = await fetch(config.supabaseUrl + "/functions/v1/submit-request", {
    method: "POST",
    headers: requestHeaders(config),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.accepted !== true || typeof result.id !== "string" || !result.id.trim()) {
    const error = new Error(result.error || "Unable to save request.");
    if (response.status === 429) {
      error.status = 429;
      error.remaining = 0;
      error.nextAvailableAt = result.nextAvailableAt || null;
    }
    throw error;
  }
  return result.id;
}
