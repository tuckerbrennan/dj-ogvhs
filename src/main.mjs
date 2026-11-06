import { searchCatalog } from "./catalog.mjs";
import { makeRequest } from "./request-model.mjs";
import { loadRequestConfig, sendRequest, getRequestQuota } from "./request-api.mjs";
import { demoQuota, useDemoRequest } from "./request-quota.mjs";

const $ = id => document.getElementById(id);
const search = $("search");
const results = $("tracks");
const count = $("catalog-count");
const message = $("catalog-message");
const selectedList = $("selected");
const selectedHelp = $("selection-help");
const selectionHeading = $("selection-heading");
const mashupSubhead = $("mashup-subhead");
const songBtn = $("request-song");
const mashupBtn = $("request-mashup");
const manualTitle = $("manual-title");
const manualArtist = $("manual-artist");
const manualButton = $("add-manual");
const listenerName = $("listener-name");
const submitButton = $("submit-request");
const requestLimit = $("request-limit");
const feedback = $("request-feedback");
const demoMode = new URLSearchParams(location.search).has("demo");
let requestConfig = null;
let sending = false;
let quotaState = null;
let quotaRefreshPending = false;

function renderQuota() {
  const remaining = demoMode ? demoQuota().remaining : quotaState?.remaining;
  const nextAvailableAt = demoMode ? demoQuota().nextAvailableAt : quotaState?.nextAvailableAt;
  requestLimit.classList.toggle("exhausted", remaining === 0);
  if (remaining === undefined) {
    requestLimit.textContent = !requestConfig && !demoMode
      ? "Maximum 3 requests per rolling hour. The request service is not connected."
      : "Checking how many requests you have left this hour…";
    return;
  }
  requestLimit.textContent = (demoMode ? "Demo only: " : "") +
    remaining + " of 3 requests left this hour." +
    (remaining === 0 && nextAvailableAt
      ? " Another request becomes available at " + new Date(nextAvailableAt).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }) + "."
      : "") +
    (demoMode ? " No real requests are sent." : "");
}

async function refreshQuota() {
  if (demoMode || !requestConfig || quotaRefreshPending) return;
  quotaRefreshPending = true;
  try {
    quotaState = await getRequestQuota(requestConfig);
    render();
  } catch {
    quotaState = null;
    render();
  } finally {
    quotaRefreshPending = false;
  }
}

const demoTracks = [
  { id: "demo1", title: "Electric Evening", artist: "The Example Band", album: "Demo Records" },
  { id: "demo2", title: "Borrowed Time", artist: "A Fictional Artist", album: "Demo Records" },
  { id: "demo3", title: "Starlight Express", artist: "The Example Band", album: "Demo Records" },
  { id: "demo4", title: "Midnight on Main Street", artist: "Sample Orchestra", album: "Demo Records" }
];
let tracks = [];
let mode = "song";
let selected = [];

function el(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function setMode(next) {
  mode = next;
  selected = selected.slice(0, next === "song" ? 1 : 2);
  songBtn.classList.toggle("active", next === "song");
  mashupBtn.classList.toggle("active", next === "mashup");
  songBtn.setAttribute("aria-pressed", String(next === "song"));
  mashupBtn.setAttribute("aria-pressed", String(next === "mashup"));
  selectionHeading.textContent = next === "song" ? "Song selection" : "Mashup selections";
  mashupSubhead.hidden = next !== "mashup";
  feedback.textContent = "";
  render();
}

function select(track) {
  if (selected.some(item => item.id === track.id)) return;
  const slots = mode === "song" ? 1 : 2;
  if (selected.length >= slots) selected = [...selected.slice(1), track];
  else selected = [...selected, track];
  render();
}

function renderSelected() {
  selectedList.replaceChildren();
  const slots = mode === "song" ? 1 : 2;
  for (let i = 0; i < slots; i++) {
    const item = selected[i];
    const li = el("li", "selected-slot");
    const label = el("span", "slot-number", String(i + 1).padStart(2, "0"));
    li.appendChild(label);
    const detail = el("div", "slot-detail");
    if (item) {
      detail.appendChild(el("strong", "", item.title));
      detail.appendChild(el("span", "", item.artist));
      const remove = el("button", "remove-selection", "Remove");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + item.title);
      remove.addEventListener("click", () => { selected = selected.filter(t => t.id !== item.id); render(); });
      li.append(detail, remove);
    } else {
      detail.appendChild(el("span", "placeholder", mode === "mashup" ? "Choose song " + (i + 1) : "Choose a track"));
      li.appendChild(detail);
    }
    selectedList.appendChild(li);
  }
  selectedHelp.textContent = selected.length === slots
    ? (demoMode ? "Ready to preview submission. No demo request will be sent." : requestConfig ? "Selection ready to send." : "Request service is not connected yet.")
    : "Choose " + (slots - selected.length) + " more " + ((slots - selected.length) === 1 ? "song" : "songs") + " from the catalog or enter one manually.";
}

function renderTracks() {
  results.replaceChildren();
  const query = search.value.trim();
  const matches = searchCatalog(tracks, query);
  count.textContent = tracks.length + " reviewed " + (tracks.length === 1 ? "track" : "tracks");
  if (!tracks.length) {
    message.textContent = "No songs have been approved for public requests yet. The DJ is preparing the catalog.";
    results.appendChild(el("div", "empty-state", "Check back soon for the searchable library."));
    return;
  }
  message.textContent = query ? matches.length + (matches.length === 60 ? "+" : "") + " matching tracks shown" : "Showing up to 60 tracks. Search to narrow the list.";
  if (!matches.length) {
    results.appendChild(el("div", "empty-state", "Not in this catalog yet. External song lookup and manual requests are coming next."));
    return;
  }
  for (const track of matches) {
    const row = el("div", "track-row");
    const info = el("div", "track-info");
    info.appendChild(el("strong", "", track.title));
    info.appendChild(el("span", "", track.artist + (track.album ? " · " + track.album : "")));
    const already = selected.some(item => item.id === track.id);
    const btn = el("button", "add-track" + (already ? " chosen" : ""), already ? "Selected" : "Choose +");
    btn.type = "button";
    btn.disabled = already;
    btn.setAttribute("aria-label", (already ? "Selected " : "Choose ") + track.title + " by " + track.artist);
    btn.addEventListener("click", () => select({ ...track, source: "catalog", catalogId: track.id }));
    row.append(info, btn);
    results.appendChild(row);
  }
}

function render() {
  renderSelected();
  renderTracks();
  const quota = demoMode ? demoQuota() : quotaState;
  submitButton.disabled = sending || !quota || quota.remaining === 0 ||
    (!demoMode && !requestConfig) || selected.length !== (mode === "song" ? 1 : 2);
  submitButton.textContent = sending ? "Submitting…" : "Submit request";
  renderQuota();
}
songBtn.addEventListener("click", () => setMode("song"));
mashupBtn.addEventListener("click", () => setMode("mashup"));
search.addEventListener("input", renderTracks);

manualButton.addEventListener("click", () => {
  const title = manualTitle.value.trim();
  const artist = manualArtist.value.trim();
  if (!title) { feedback.textContent = "Enter a song title first."; manualTitle.focus(); return; }
  if (title.length > 150 || artist.length > 120) { feedback.textContent = "Song or artist is too long."; return; }
  const id = "manual-" + crypto.randomUUID();
  select({ id, title, artist, source: "manual" });
  manualTitle.value = "";
  manualArtist.value = "";
  feedback.textContent = "Added to your request.";
});

submitButton.addEventListener("click", async () => {
  if (sending) return;
  if (demoMode) {
    if (selected.length !== (mode === "song" ? 1 : 2)) return;
    if (!useDemoRequest().accepted) { render(); return; }
    sessionStorage.setItem("dj-ogvhs-confirmation", JSON.stringify({ status: "demo" }));
    location.assign("./thanks.html");
    return;
  }
  if (!requestConfig || !quotaState || quotaState.remaining === 0) return;
  let payload;
  try {
    payload = makeRequest({ type: mode, songs: selected, listenerName: listenerName.value });
  } catch (error) {
    feedback.textContent = error.message;
    return;
  }
  sending = true;
  feedback.textContent = "";
  render();
  try {
    await sendRequest(requestConfig, payload);
    // Only navigate after the server confirms the request was stored.
    sessionStorage.setItem("dj-ogvhs-confirmation", JSON.stringify({ status: "submitted" }));
    location.assign("./thanks.html");
    return;
  } catch (error) {
    feedback.textContent = error.name === "TimeoutError"
      ? "Request timed out. Please check before trying again."
      : error.message || "Couldn't send the request.";
    if (error.status === 429) {
      quotaState = { limit:3, remaining:0, nextAvailableAt:error.nextAvailableAt };
    } else {
      refreshQuota();
    }
  } finally {
    sending = false;
    render();
  }
});

async function load() {
  if (demoMode) {
    tracks = demoTracks;
    render();
    count.textContent = tracks.length + " fictional demo tracks";
    message.textContent = "DEMO ONLY: These songs are fictional. No request will be sent.";
    return;
  }
  try {
    const response = await fetch("./public/catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected catalog format");
    tracks = data.filter(t => t && typeof t.id === "string" && typeof t.title === "string" && typeof t.artist === "string");
    render();
  } catch {
    tracks = [];
    render();
    message.textContent = "The catalog could not be loaded. Please try again later.";
  }
}
render();
load();
loadRequestConfig().then(config => {
  requestConfig = config;
  render();
  refreshQuota();
}).catch(() => { requestConfig = null; render(); });
window.addEventListener("focus", refreshQuota);
window.setInterval(() => { if (demoMode) render(); else refreshQuota(); }, 30000);
