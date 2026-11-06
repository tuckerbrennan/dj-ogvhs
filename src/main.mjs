import { searchCatalog, filterByGenre, genreOptions } from "./catalog.mjs?v=genre-filter-20261106";
import { demoQuota, useDemoRequest } from "./request-quota.mjs";

const $ = id => document.getElementById(id);
const search = $("search");
const genreFilter = $("genre-filter");
const clearFilters = $("clear-filters");
const results = $("tracks");
const count = $("catalog-count");
const message = $("catalog-message");
const selectedList = $("selected");
const selectedHelp = $("selection-help");
const selectionHeading = $("selection-heading");
const mashupSubhead = $("mashup-subhead");
const songBtn = $("request-song");
const mashupBtn = $("request-mashup");
const submitButton = $("submit-request");
const requestLimit = $("request-limit");
const demoMode = new URLSearchParams(location.search).has("demo");

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
  render();
}

function select(track) {
  if (selected.some(item => item.id === track.id)) {
    selected = selected.filter(item => item.id !== track.id);
    render();
    return;
  }
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
    ? (demoMode ? "Ready to preview submission. Demo requests are not sent." : "Request submission is not yet live.")
    : "Choose " + (slots - selected.length) + " more " + ((slots - selected.length) === 1 ? "song" : "songs") + " from the catalog.";
}

function renderGenres() {
  const current = genreFilter.value;
  genreFilter.replaceChildren(...genreOptions(tracks).map(({value, label, count}) => {
    const option = el("option", "", label + " (" + count + ")");
    option.value = value;
    return option;
  }));
  genreFilter.value = genreOptions(tracks).some(option => option.value === current) ? current : "";
}

function renderTracks() {
  results.replaceChildren();
  const query = search.value.trim();
  const matching = searchCatalog(filterByGenre(tracks, genreFilter.value), query, Infinity);
  const matches = matching.slice(0, 60);
  const filtered = Boolean(query || genreFilter.value);
  clearFilters.hidden = !filtered;
  count.textContent = tracks.length + " catalog " + (tracks.length === 1 ? "track" : "tracks");
  if (!tracks.length) {
    message.textContent = "No songs have been approved for public requests yet. The DJ is preparing the catalog.";
    results.appendChild(el("div", "empty-state", "Check back soon for the searchable library."));
    return;
  }
  message.textContent = "Showing " + matches.length + " of " + matching.length + (filtered ? " matching tracks." : " tracks. Search or filter to narrow the list.");
  if (!matches.length) {
    results.appendChild(el("div", "empty-state", "No tracks match your search and genre. Try another genre or clear the filters."));
    return;
  }
  for (const track of matches) {
    const row = el("div", "track-row");
    const info = el("div", "track-info");
    info.appendChild(el("strong", "", track.title));
    info.appendChild(el("span", "", track.artist + (track.album ? " · " + track.album : "")));
    const already = selected.some(item => item.id === track.id);
    const btn = el("button", "add-track" + (already ? " chosen" : ""), already ? "Remove −" : "Choose +");
    btn.type = "button";
    btn.setAttribute("aria-pressed", String(already));
    btn.setAttribute("aria-label", (already ? "Remove " : "Choose ") + track.title + " by " + track.artist);
    btn.addEventListener("click", () => select(track));
    row.append(info, btn);
    results.appendChild(row);
  }
}

function renderQuota() {
  if (!demoMode) {
    requestLimit.textContent = "Maximum 3 requests per rolling hour. Real submissions are not enabled yet.";
    requestLimit.classList.remove("exhausted");
    return;
  }
  const quota = demoQuota();
  requestLimit.textContent = "Demo only: " + quota.remaining + " of 3 requests left this hour." +
    (quota.remaining === 0 && quota.nextAvailableAt
      ? " Your next request becomes available at " + new Date(quota.nextAvailableAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "."
      : "") + " No real requests are sent.";
  requestLimit.classList.toggle("exhausted", quota.remaining === 0);
}

function render() {
  renderSelected();
  renderTracks();
  const remaining = demoMode ? demoQuota().remaining : 0;
  submitButton.disabled = !demoMode || remaining === 0 || selected.length !== (mode === "song" ? 1 : 2);
  renderQuota();
}
songBtn.addEventListener("click", () => setMode("song"));
mashupBtn.addEventListener("click", () => setMode("mashup"));
search.addEventListener("input", renderTracks);
genreFilter.addEventListener("change", renderTracks);
clearFilters.addEventListener("click", () => {
  search.value = "";
  genreFilter.value = "";
  renderTracks();
  search.focus();
});
submitButton.addEventListener("click", () => {
  if (!demoMode || selected.length !== (mode === "song" ? 1 : 2)) return;
  const quota = useDemoRequest();
  if (!quota.accepted) { render(); return; }
  sessionStorage.setItem("dj-ogvhs-confirmation", JSON.stringify({ status: "demo" }));
  location.assign("./thanks.html");
});

async function load() {
  if (new URLSearchParams(location.search).has("demo")) {
    tracks = demoTracks;
    renderGenres();
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
    renderGenres();
    render();
  } catch {
    tracks = [];
    render();
    message.textContent = "The catalog could not be loaded. Please try again later.";
  }
}
renderGenres();
render();
load();
window.setInterval(() => { if (demoMode) render(); }, 30000);
