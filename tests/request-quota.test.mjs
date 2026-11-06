import test from "node:test";
import assert from "node:assert/strict";
import { HOURLY_REQUEST_LIMIT, summarizeQuota, demoQuota, useDemoRequest, getListenerId } from "../src/request-quota.mjs";

const storage = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

test("3 accepted requests exhaust the rolling 60-minute demo quota", () => {
  const s = storage();
  const now = Date.UTC(2026, 10, 6, 17, 0, 0);
  assert.equal(HOURLY_REQUEST_LIMIT, 3);
  for (let n = 2; n >= 0; n--) {
    const a = useDemoRequest(s, now + (2 - n) * 1000);
    assert.equal(a.accepted, true);
    assert.equal(a.remaining, n);
  }
  assert.equal(useDemoRequest(s, now + 3000).accepted, false);
  assert.equal(demoQuota(s, now + 3000).remaining, 0);
});

test("quota is truly rolling, not a simple hour bucket", () => {
  const s = storage();
  const now = Date.UTC(2026, 10, 6, 17, 0, 0);
  useDemoRequest(s, now);
  useDemoRequest(s, now + 55*60*1000);
  useDemoRequest(s, now + 56*60*1000);
  assert.equal(demoQuota(s, now + 59*60*1000).remaining, 0);
  assert.equal(demoQuota(s, now + 61*60*1000).remaining, 1);
  assert.equal(demoQuota(s, now + 115*60*1000).remaining, 2);
});

test("quota on separate browsers does not interfere", () => {
  const a=storage(), b=storage();
  useDemoRequest(a);
  assert.equal(demoQuota(a).remaining, 2);
  assert.equal(demoQuota(b).remaining, 3);
});

test("listener ID is stable across visits with the same storage", () => {
  const s = storage();
  const id = getListenerId(s);
  assert.match(id, /^[0-9a-f-]{36}$/i);
  assert.equal(getListenerId(s), id);
});
