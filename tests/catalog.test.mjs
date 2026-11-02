import test from "node:test";
import assert from "node:assert/strict";
import { parseCSV, generatePublicCatalog } from "../scripts/build-catalog.mjs";
import { searchCatalog } from "../src/catalog.mjs";

test("CSV parser handles quoted commas, escaped quotes, and multiline", () => {
  const rows = parseCSV('Filename,Artist (edit),Title (edit)\r\nsong.mp3,"B, C","Song ""Live""\nVersion"\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]["Artist (edit)"], "B, C");
  assert.equal(rows[0]["Title (edit)"], 'Song "Live"\nVersion');
});
test("publisher only exports explicitly approved complete audio with metadata, never paths", () => {
  const base = { "Source": "Dropbox", "File Status": "Available file" };
  const rows = [
    { ...base, "Filename":"a.mp3", "Full Source Path":"Secret/a.mp3", "Size (bytes)":"200", "Publish? (Yes/No)":"Yes", "Artist (edit)":"The Example Band", "Title (edit)":"Night Train" },
    { ...base, "Filename":"b.mp3", "Full Source Path":"Secret/b.mp3", "Size (bytes)":"200", "Artist (edit)":"B", "Title (edit)":"B" },
    { ...base, "Filename":"c.mp3.part", "Full Source Path":"Secret/c.mp3.part", "Size (bytes)":"22", "Publish? (Yes/No)":"Yes", "Artist (edit)":"C", "Title (edit)":"C" },
    { ...base, "Filename":"d.mp3", "Full Source Path":"Secret/d.mp3", "Size (bytes)":"0", "Publish? (Yes/No)":"Yes", "Artist (edit)":"D", "Title (edit)":"D" },
    { ...base, "Filename":"e.mp3", "Full Source Path":"Secret/e.mp3", "Size (bytes)":"200", "Publish? (Yes/No)":"Yes", "Title (edit)":"Unidentified" },
    { ...base, "Filename":"f.mp3", "Full Source Path":"Secret/f.mp3", "Size (bytes)":"200", "Publish? (Yes/No)":"Yes", "Artist (edit)":"The Example Band", "Title (edit)":"Night Train" }
  ];
  const {tracks, stats}=generatePublicCatalog(rows);
  assert.equal(tracks.length, 1);
  assert.equal(stats.excludedIncomplete, 2);
  assert.equal(stats.excludedUnapproved, 1);
  assert.equal(stats.excludedMissingMetadata, 1);
  assert.equal(stats.excludedDuplicate, 1);
  assert.equal(tracks[0].artist, "The Example Band");
  assert.ok(!JSON.stringify(tracks).includes("Secret"));
  const unknownSize = [{ ...base, "Filename":"unknown.mp3", "Full Source Path":"Secret/unknown.mp3", "Publish? (Yes/No)":"Yes", "Artist (edit)":"A", "Title (edit)":"B" }];
  assert.equal(generatePublicCatalog(unknownSize).tracks.length, 0, "unknown file size must not be published");
});
test("SQLite export may use separate curation CSV", () => {
  const rows=[{source:"icloud", path:"Music/01.mp3",filename:"01.mp3",format:"mp3",size_bytes:"8000"}];
  const curation=[{source:"icloud",path:"Music/01.mp3",title:"Sample Song",artist:"Example Artist",publish:"Yes"}];
  assert.equal(generatePublicCatalog(rows, curation).tracks.length, 1);
});
test("search matches partial title, artist, accents and multiple terms", () => {
  const tracks=[{artist:"Beyoncé",title:"Déjà Vu"},{artist:"Someone Else",title:"Another Track"}];
  assert.equal(searchCatalog(tracks,"bey deja")[0].title,"Déjà Vu");
  assert.equal(searchCatalog(tracks,"another").length,1);
  assert.equal(searchCatalog(tracks,"not found").length,0);
});
