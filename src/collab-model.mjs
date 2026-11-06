// Pure validation/normalization shared by the browser and tests.
export function spotifyPlaylistUrl(raw) {
  if (typeof raw !== "string" || raw.length > 500) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
    const match = /^\/playlist\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);
    return match ? "https://open.spotify.com/playlist/" + match[1] : null;
  } catch { return null; }
}

export function inviteFromHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const value = new URLSearchParams(raw).get("invite") || "";
  return /^[A-Za-z0-9_-]{40,100}$/.test(value) ? value : null;
}

export function validateContribution(value) {
  if (!value || typeof value !== "object") throw Error("Select a song or enter a Spotify playlist.");
  const kind = value.kind;
  if (!["catalog", "manual", "spotify_playlist"].includes(kind)) throw Error("Unknown contribution type.");
  const name = String(value.name || "").trim().slice(0, 80);
  if (kind === "spotify_playlist") {
    const url = spotifyPlaylistUrl(value.spotifyUrl);
    if (!url) throw Error("Paste a valid Spotify playlist link from open.spotify.com.");
    return {kind, name, spotifyUrl: url};
  }
  const title = String(value.title || "").trim().replace(/\s+/g, " ");
  const artist = String(value.artist || "").trim().replace(/\s+/g, " ");
  if (!title || title.length > 150 || artist.length > 120) throw Error("Enter a song title (150 characters maximum) and optional artist.");
  if (kind === "catalog" && !/^[A-Za-z0-9_-]{4,128}$/.test(String(value.catalogId||""))) {
    throw Error("Choose a song from the catalog.");
  }
  return {kind, name, title, artist, ...(kind==="catalog" ? {catalogId:value.catalogId} : {})};
}
