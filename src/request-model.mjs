const sources = new Set(["catalog", "external", "manual"]);
const clean = (value, max) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max + 1);

export function makeRequest({ type, songs, listenerName = "" }) {
  if (type !== "song" && type !== "mashup") throw new Error("Choose a request type.");
  const expected = type === "song" ? 1 : 2;
  if (!Array.isArray(songs) || songs.length !== expected) {
    throw new Error(type === "song" ? "Choose one song." : "Choose two songs for a mashup.");
  }
  const selections = songs.map(song => {
    if (!song || !sources.has(song.source)) throw new Error("Choose a valid song source.");
    const title = clean(song.title, 150);
    const artist = clean(song.artist, 120);
    if (!title || title.length > 150 || artist.length > 120) throw new Error("Enter a valid song and artist.");
    if (song.source === "catalog" && (!song.catalogId || typeof song.catalogId !== "string")) {
      throw new Error("Catalog selection is missing its ID.");
    }
    const result = { title, artist, source: song.source };
    if (song.source === "catalog") result.catalogId = clean(song.catalogId, 120);
    if (song.source === "external" && song.externalId) {
      result.externalId = clean(song.externalId, 120);
      result.externalProvider = clean(song.externalProvider, 50);
    }
    return result;
  });
  const name = clean(listenerName, 80);
  if (name.length > 80) throw new Error("Name is too long.");
  return { type, songs: selections, listenerName: name || null };
}
