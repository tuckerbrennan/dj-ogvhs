// Public listener submission + quota endpoint. Secret keys remain on Supabase only.
import { createClient } from "npm:@supabase/supabase-js@2";

type Song = { title: string; artist: string; source: "catalog" | "external" | "manual"; catalogId?: string; externalId?: string; externalProvider?: string };
const encoder = new TextEncoder();
const LISTENER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") throw new Error("Invalid text field");
  const result = value.trim().replace(/\s+/g, " ");
  if (result.length > max) throw new Error("Text too long");
  return result;
}

function parsePayload(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid body");
  const data = value as Record<string, unknown>;
  if (data.honey) throw new Error("Invalid request");
  if (data.type !== "song" && data.type !== "mashup") throw new Error("Invalid request type");
  if (!Array.isArray(data.songs) || data.songs.length !== (data.type === "song" ? 1 : 2)) {
    throw new Error("Incorrect number of songs");
  }
  const songs: Song[] = data.songs.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid selection");
    const song = entry as Record<string, unknown>;
    if (song.source !== "catalog" && song.source !== "external" && song.source !== "manual") throw new Error("Invalid source");
    const title = clean(song.title, 150);
    const artist = clean(song.artist ?? "", 120);
    if (!title) throw new Error("Song title required");
    const result: Song = { title, artist, source: song.source };
    if (song.source === "catalog") {
      const catalogId = clean(song.catalogId, 120);
      if (!catalogId) throw new Error("Missing catalog ID");
      result.catalogId = catalogId;
    }
    if (song.source === "external" && song.externalId !== undefined) {
      result.externalId = clean(song.externalId, 120);
      result.externalProvider = clean(song.externalProvider ?? "", 50);
    }
    return result;
  });
  const listenerName = data.listenerName == null ? "" : clean(data.listenerName, 80);
  return { type: data.type, songs, listenerName };
}

async function clientHash(listenerId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(listenerId));
  return Array.from(new Uint8Array(signed), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  const origin = request.headers.get("origin");
  const origins = (Deno.env.get("DJ_ALLOWED_ORIGINS") ??
    "https://tuckerbrennan.github.io,http://127.0.0.1:4173,http://localhost:4173").split(",").map(s => s.trim());
  const permitted = origin !== null && origins.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": permitted ? origin! : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, apikey, x-dj-listener-id",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: cors });
  if (request.method === "OPTIONS") return new Response(null, { status: permitted ? 204 : 403, headers: cors });
  if (!permitted) return reply(403, { error: "Origin not permitted" });
  if (request.method !== "GET" && request.method !== "POST") return reply(405, { error: "Method not allowed" });

  const listenerId = request.headers.get("x-dj-listener-id");
  if (!listenerId || !LISTENER_ID.test(listenerId)) {
    return reply(400, { error: "Could not identify this browser for the hourly request limit." });
  }

  const secret = Deno.env.get("DJ_RATE_LIMIT_SECRET");
  const projectUrl = Deno.env.get("SUPABASE_URL");
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    try {
      const allKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      serviceKey = typeof allKeys.default === "string" ? allKeys.default : undefined;
    } catch {
      console.error("Supabase secret-key configuration is invalid.");
    }
  }
  if (!secret || !projectUrl || !serviceKey) return reply(503, { error: "Request service is not configured." });

  const clientKey = await clientHash(listenerId, secret);
  const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (request.method === "GET") {
    const { data, error } = await db.rpc("get_dj_request_quota", { p_client_key: clientKey });
    if (error) {
      console.error("Quota lookup failed", error.code);
      return reply(503, { error: "Hourly quota is unavailable." });
    }
    return reply(200, data);
  }

  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return reply(413, { error: "Request too large." });
  }
  let payload: ReturnType<typeof parsePayload>;
  try {
    const rawBody = await request.text();
    if (encoder.encode(rawBody).byteLength > 8192) return reply(413, { error: "Request too large." });
    payload = parsePayload(JSON.parse(rawBody));
  } catch {
    return reply(400, { error: "Check your song selection and try again." });
  }

  const { data, error } = await db.rpc("submit_dj_request_v2", {
    p_type: payload.type,
    p_songs: payload.songs,
    p_listener_name: payload.listenerName,
    p_client_key: clientKey
  });
  if (error) {
    console.error("Request submission failed", error.code);
    return reply(500, { error: "Your request couldn't be saved. Please try again." });
  }
  if (!data?.accepted) {
    return reply(429, {
      error: "You've used all 3 requests for now. Try again when a request becomes available.",
      limit: 3,
      remaining: 0,
      nextAvailableAt: data?.nextAvailableAt ?? null,
      retryAfterSeconds: data?.retryAfterSeconds ?? 0
    });
  }
  return reply(201, { id: data.id, accepted: true, limit: 3, remaining: data.remaining, nextAvailableAt: data.nextAvailableAt });
});
