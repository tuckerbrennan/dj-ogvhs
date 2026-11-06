import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const file = async path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("listener page has a submit button and confirmation navigation", async () => {
  const html = await file("index.html");
  const code = await file("src/main.mjs");
  assert.match(html, /id="submit-request"/);
  assert.match(code, /location\.assign\("\.\/thanks\.html"\)/);
});

test("thanks page includes exact requested message and all four optional tip services", async () => {
  const html = await file("thanks.html");
  const js = await file("src/thanks.mjs");
  assert.match(html, /Thanks for submitting your request!/);
  assert.match(html, /Your song will be added to the queue\./);
  assert.match(html, /And if you like what you're hearing leave the DJ a tip!/);
  for (const provider of ["Venmo", "Zelle", "PayPal", "Cash App"]) {
    assert.ok(js.includes(provider), "Missing " + provider);
  }
});

test("unconfigured tips do not point to an invented recipient", async () => {
  const tips = JSON.parse(await file("public/tip-config.json"));
  for (const field of ["venmoUrl", "paypalUrl", "cashAppUrl", "zelleRecipient"]) {
    assert.equal(tips[field], "");
  }
});

test("the confirmation distinguishes demo preview from a successful submission", async () => {
  const js = await file("src/thanks.mjs");
  const html = await file("thanks.html");
  assert.match(js, /state\.status !== "demo"/);
  assert.match(html, /No request was sent or added to the real queue/);
  assert.match(html, /id="no-confirmation"/);
});
