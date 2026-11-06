import test from "node:test";
import assert from "node:assert/strict";
import { sendRequest, loadRequestConfig, getRequestQuota } from "../src/request-api.mjs";

test("request client sends a complete request and accepts a confirmed ID", async t => {
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  let invoked = false;
  globalThis.fetch = async (url, options) => {
    invoked = true;
    assert.equal(url, "https://example.supabase.co/functions/v1/submit-request");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, "publishable-key");
    assert.match(options.headers["x-dj-listener-id"], /^[0-9a-f-]{36}$/i);
    assert.equal(JSON.parse(options.body).type, "song");
    return { ok: true, status: 201, json: async () => ({ id: "request-123", accepted: true }) };
  };
  const id = await sendRequest(
    { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "publishable-key" },
    { type: "song", songs: [{ title: "Example", source: "manual" }] }
  );
  assert.equal(id, "request-123");
  assert.equal(invoked, true);
});

test("request client refuses unconfigured backends", async () => {
  await assert.rejects(sendRequest(null, {}), /not enabled/i);
});

test("request client preserves server-side rate limit messages", async t => {
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: "Too many requests." }) });
  await assert.rejects(
    sendRequest({ supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public" }, {}),
    /Too many requests/
  );
});

test("missing public backend configuration disables submission", async t => {
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ supabaseUrl: "", supabaseAnonKey: "" }) });
  assert.equal(await loadRequestConfig(), null);
});

test("quota endpoint reports requests left in a rolling hour", async t => {
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  globalThis.fetch = async (url, options) => {
    assert.equal(options.method, "GET");
    assert.equal(url, "https://example.supabase.co/functions/v1/submit-request");
    assert.match(options.headers["x-dj-listener-id"], /^[0-9a-f-]{36}$/i);
    return { ok: true, json: async () => ({ limit: 3, remaining: 2, nextAvailableAt: null }) };
  };
  assert.deepEqual(
    await getRequestQuota({ supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public" }),
    { limit: 3, remaining: 2, nextAvailableAt: null }
  );
});

test("quota endpoint rejects untrusted counts", async t => {
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ limit: 3, remaining: 999 }) });
  await assert.rejects(
    getRequestQuota({ supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public" }),
    /unavailable/
  );
});

test("hourly cap returns a 429 and retry availability", async t => {
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  const reset = "2026-11-06T20:15:00.000Z";
  globalThis.fetch = async () => ({
    ok: false, status: 429, json: async () => ({
      error: "You've used all 3 requests for now.",
      remaining: 0, nextAvailableAt: reset
    })
  });
  try {
    await sendRequest({ supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public" }, {});
    assert.fail("Expected a rate-limit rejection");
  } catch (error) {
    assert.equal(error.status, 429);
    assert.equal(error.nextAvailableAt, reset);
    assert.match(error.message, /all 3 requests/);
  }
});
