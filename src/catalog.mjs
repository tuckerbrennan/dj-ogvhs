export function normalize(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function searchCatalog(tracks, query, limit = 60) {
  const terms = normalize(query).split(" ").filter(Boolean);
  const results = [];
  for (const track of tracks) {
    const title = normalize(track.title);
    const artist = normalize(track.artist);
    const album = normalize(track.album);
    const haystack = title + " " + artist + " " + album;
    if (!terms.every(term => haystack.includes(term))) continue;
    let score = 0;
    if (terms.length) {
      if (title.startsWith(terms.join(" "))) score += 5;
      if (artist.startsWith(terms.join(" "))) score += 3;
      if (title.includes(terms.join(" "))) score += 2;
    }
    results.push({ track, score });
  }
  results.sort((a, b) => b.score - a.score || a.track.artist.localeCompare(b.track.artist) || a.track.title.localeCompare(b.track.title));
  return results.slice(0, limit).map(item => item.track);
}
