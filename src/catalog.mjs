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

export function trackGenres(track) {
  return [...new Set(String(track.genre ?? "").split(";").map(value => value.trim()).filter(Boolean))];
}

export function filterByGenre(tracks, genre = "") {
  if (!genre) return tracks;
  return tracks.filter(track => genre === "__unclassified__"
    ? trackGenres(track).length === 0
    : trackGenres(track).some(value => normalize(value) === normalize(genre)));
}

export function genreOptions(tracks) {
  const counts = new Map();
  let unclassified = 0;
  for (const track of tracks) {
    const genres = trackGenres(track);
    if (!genres.length) unclassified++;
    for (const genre of genres) counts.set(genre, (counts.get(genre) || 0) + 1);
  }
  const options = [{ value: "", label: "All genres", count: tracks.length },
    ...[...counts].sort(([a], [b]) => a.localeCompare(b)).map(([genre, count]) => ({ value: genre, label: genre, count }))];
  if (unclassified) options.push({ value: "__unclassified__", label: "Unclassified", count: unclassified });
  return options;
}
