import { loadRequestConfig } from "./request-api.mjs";

const $ = id => document.getElementById(id);
const message = $("admin-message");
const login = $("admin-login");
const dashboard = $("admin-dashboard");
const rows = $("admin-rows");
const filter = $("admin-filter");
const sort = $("admin-sort");
let client = null;
let items = [];
let loading = false;

function element(tag, content, className = "") {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = String(content);
  if (className) node.className = className;
  return node;
}

function filteredItems() {
  const selected = filter.value;
  const list = items.filter(item => selected === "all" || item.type === selected || item.status === selected);
  list.sort((a, b) => {
    if (sort.value === "recent") return Date.parse(b.created_at) - Date.parse(a.created_at);
    if (sort.value === "oldest") return Date.parse(a.created_at) - Date.parse(b.created_at);
    if (sort.value === "bpm") return (Number(a.bpm) || 999) - (Number(b.bpm) || 999);
    return Number(b.sort_order) - Number(a.sort_order) || Date.parse(b.created_at) - Date.parse(a.created_at);
  });
  return list;
}

async function edit(id, changes) {
  const { error } = await client.from("dj_requests").update(changes).eq("id", id);
  if (error) throw new Error("Unable to save: " + error.message);
}

async function swapPosition(id, neighborId) {
  const a = items.find(item => item.id === id);
  const b = items.find(item => item.id === neighborId);
  if (!a || !b) return;
  try {
    const { error } = await client.rpc("swap_dj_request_order", { p_first: a.id, p_second: b.id });
    if (error) throw new Error(error.message);
    message.textContent = "Queue order saved.";
  } catch (error) {
    message.textContent = error.message;
  }
  await refresh();
}

function render() {
  rows.replaceChildren();
  const visible = filteredItems();
  $("admin-count").textContent = visible.length + " shown · " + items.length + " total (latest 200)";
  if (!visible.length) { rows.appendChild(element("p", "No requests match this filter.", "helper")); return; }
  for (let i = 0; i < visible.length; i++) {
    const entry = visible[i];
    const row = element("article", undefined, "admin-row");
    const detail = element("div");
    detail.appendChild(element("strong", (entry.type === "mashup" ? "Mashup" : "Song") + " · " + (entry.listener_name || "Anonymous")));
    const date = new Date(entry.created_at).toLocaleString();
    detail.appendChild(element("div", date + " · " + entry.status, "admin-meta"));
    for (const song of entry.songs) {
      detail.appendChild(element("span", song.title + (song.artist ? " — " + song.artist : "") +
        " (" + (song.source === "catalog" ? "in catalog" : song.source) + ")", "admin-song"));
    }

    const controls = element("div", undefined, "admin-controls");
    const status = element("select");
    for (const name of ["pending", "later", "played", "skipped"]) {
      const option = element("option", name[0].toUpperCase() + name.slice(1));
      option.value = name; option.selected = name === entry.status; status.appendChild(option);
    }
    status.setAttribute("aria-label", "Request status");
    status.addEventListener("change", async () => {
      try { await edit(entry.id, { status: status.value }); entry.status = status.value; message.textContent = "Status saved."; }
      catch (error) { status.value = entry.status; message.textContent = error.message; }
    });
    controls.appendChild(status);
    const bpm = element("input");
    bpm.type = "number"; bpm.min = "1"; bpm.max = "349.99"; bpm.step = ".01";
    bpm.placeholder = "BPM"; bpm.value = entry.bpm ?? "";
    bpm.setAttribute("aria-label", "Tempo in BPM");
    const bpmSave = element("button", "Save BPM");
    bpmSave.addEventListener("click", async () => {
      const parsed = bpm.value.trim() ? Number(bpm.value) : null;
      if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 350)) {
        message.textContent = "BPM must be between 1 and 350."; return;
      }
      try { await edit(entry.id, { bpm: parsed }); entry.bpm = parsed; message.textContent = "BPM saved."; }
      catch (error) { message.textContent = error.message; }
    });
    controls.append(bpm, bpmSave);
    if (sort.value === "queue") {
      for (const delta of [-1, 1]) {
        const btn = element("button", delta < 0 ? "↑" : "↓");
        btn.disabled = i + delta < 0 || i + delta >= visible.length;
        btn.setAttribute("aria-label", delta < 0 ? "Move request up" : "Move request down");
        btn.addEventListener("click", () => swapPosition(entry.id, visible[i + delta].id));
        controls.appendChild(btn);
      }
    }
    row.append(detail, controls);
    rows.appendChild(row);
  }
}

async function refresh() {
  if (!client || loading) return;
  loading = true;
  try {
    const { data, error } = await client.from("dj_requests")
      .select("id,type,songs,listener_name,status,bpm,sort_order,created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    items = data;
    render();
  } catch (error) { message.textContent = "Unable to load queue: " + error.message; }
  finally { loading = false; }
}

async function showSession(session) {
  login.hidden = Boolean(session);
  dashboard.hidden = true;
  if (!session) { message.textContent = "Sign in to view your private queue."; return; }
  const { data, error } = await client.from("dj_admins").select("user_id").limit(1);
  if (error || !data?.length) {
    message.textContent = "This account has not been granted DJ admin access.";
    return;
  }
  dashboard.hidden = false;
  message.textContent = "Signed in. Song and mashup requests have equal priority.";
  await refresh();
}

login.addEventListener("submit", async event => {
  event.preventDefault();
  const email = $("admin-email").value.trim();
  if (!client || !email) return;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: new URL("./admin.html", location.href).href }
  });
  message.textContent = error ? error.message : "Check your email for the private sign-in link.";
});
$("admin-refresh").addEventListener("click", refresh);
$("admin-logout").addEventListener("click", async () => { await client?.auth.signOut(); items = []; });
filter.addEventListener("change", render);
sort.addEventListener("change", render);

(async () => {
  try {
    const config = await loadRequestConfig();
    if (!config) { message.textContent = "The private dashboard is not connected to a backend yet."; return; }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    client = createClient(config.supabaseUrl, config.supabaseAnonKey);
    client.auth.onAuthStateChange((_event, session) => { setTimeout(() => showSession(session), 0); });
    const { data } = await client.auth.getSession();
    await showSession(data.session);
  } catch (error) { message.textContent = "Unable to connect to the private dashboard."; }
})();
