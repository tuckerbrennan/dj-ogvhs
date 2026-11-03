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

export async function sendRequest(config, payload) {
  if (!config) throw new Error("Requests are not enabled yet.");
  const response = await fetch(config.supabaseUrl + "/functions/v1/submit-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": config.supabaseAnonKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.accepted !== true) throw new Error(result.error || "Unable to save request.");
  return result.id;
}
