import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRequest } from "../src/request-model.mjs";

const track = { title: "  Track  One ", artist: " Artist ", source: "catalog", catalogId: "abc123", path: "/private/file.mp3" };

test("a song request keeps only safe catalog fields", () => {
  assert.deepEqual(makeRequest({ type: "song", songs: [track] }), {
    type: "song",
    songs: [{ title: "Track One", artist: "Artist", source: "catalog", catalogId: "abc123" }],
    listenerName: null
  });
});

test("mashup requires exactly two selections", () => {
  assert.throws(() => makeRequest({ type: "mashup", songs: [track] }), /two songs/);
  assert.equal(makeRequest({ type: "mashup", songs: [track, { title: "Another", source: "manual" }] }).songs.length, 2);
});

test("manual entry works without a catalog", () => {
  assert.equal(makeRequest({ type: "song", songs: [{ title: "Unknown", artist: "", source: "manual" }], listenerName: "  Fan " }).listenerName, "Fan");
});

test("invalid sources and oversized titles are rejected", () => {
  assert.throws(() => makeRequest({ type: "song", songs: [{ title: "A", source: "streaming" }] }), /source/);
  assert.throws(() => makeRequest({ type: "song", songs: [{ title: "x".repeat(151), source: "manual" }] }), /valid/);
});
