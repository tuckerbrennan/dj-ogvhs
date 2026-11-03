import test from "node:test";
import assert from "node:assert/strict";
import { sendRequest, loadRequestConfig } from "../src/request-api.mjs";

test("request client sends a complete request and accepts a confirmed ID", async t => {
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  let invoked = false;
  globalThis.fetch = async (url, options) => {
    invoked = true;
    assert.equal(url, "https://example.supabase.co/functions/v1/submit-request");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, "publishable-key");
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
