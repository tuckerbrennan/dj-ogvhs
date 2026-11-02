#!/usr/bin/env node
/**
 * Build public/catalog.json from a local CSV/JSON inventory.
 * PRIVACY: rows must be individually opted in with Publish? (Yes/No)=Yes
 * or via a separate curation CSV; unreviewed recordings are not published.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { normalize } from "../src/catalog.mjs";

const audioExtensions = new Set(["mp3","wav","flac","aac","m4a","aiff","aif","ogg","opus","wma","alac"]);
const YES = new Set(["yes","y","true","1","publish","public"]);
const field = (row, names) => {
  for (const name of names) {
    const found = Object.keys(row).find(k => normalize(k) === normalize(name));
    if (found && row[found] !== undefined && row[found] !== null) return String(row[found]).trim();
  }
  return "";
};

export function parseCSV(input) {
  const text = String(input).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new Error("Malformed CSV: unterminated quoted field");
  row.push(cell);
  if (row.some(v => v !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

function sourcePath(row) {
  const source = field(row, ["source", "cloud"]) || "local";
  const path = field(row, ["Full Source Path", "path", "Folder / original path", "dropbox_path"]) || field(row, ["Filename", "filename", "File name"]);
  return normalize(source) + "|" + path.replace(/\\/g, "/");
}

export function generatePublicCatalog(rows, curationRows = []) {
  const curated = new Map(curationRows.map(r => [sourcePath(r), r]));
  const tracks = [];
  const seen = new Set();
  const stats = { total: rows.length, published: 0, excludedUnapproved: 0, excludedIncomplete: 0, excludedMissingMetadata: 0, excludedDuplicate: 0 };

  for (const raw of rows) {
    const edits = curated.get(sourcePath(raw)) || {};
    const publish = field(edits, ["publish", "requestable", "Publish? (Yes/No)"]) || field(raw, ["Publish? (Yes/No)", "publish", "requestable"]);
    if (!YES.has(normalize(publish))) { stats.excludedUnapproved++; continue; }

    const filename = field(raw, ["Filename", "filename", "File name"]);
    const format = field(raw, ["Format", "format", "Extension"]) || extname(filename).slice(1);
    const status = field(raw, ["File Status", "availability_status", "Completeness"]);
    const sizeText = field(raw, ["Size (bytes)", "size_bytes", "Size (bytes)"]);
    const size = Number(sizeText);
    const incomplete = /\.part$|\.tmp$|\.crdownload$/i.test(filename) ||
      !audioExtensions.has(format.toLowerCase().replace(/^\./, "")) ||
      (sizeText !== "" && (!Number.isFinite(size) || size <= 0)) ||
      /incomplete|folder only|missing|unavailable/i.test(status);
    if (incomplete) { stats.excludedIncomplete++; continue; }

    const artist = field(edits, ["artist", "Artist (edit)"]) || field(raw, ["Artist (edit)", "artist"]);
    const title = field(edits, ["title", "Title (edit)"]) || field(raw, ["Title (edit)", "title"]);
    if (!artist || !title) { stats.excludedMissingMetadata++; continue; }
    const album = field(edits, ["album", "Album (edit)"]) || field(raw, ["Album (edit)", "album"]);
    const genre = field(edits, ["genre", "Genre (edit)"]) || field(raw, ["Genre (edit)", "genre"]);
    const key = normalize(artist) + "|" + normalize(title);
    if (seen.has(key)) { stats.excludedDuplicate++; continue; }
    seen.add(key);

    const id = createHash("sha256").update(key).digest("hex").slice(0, 20);
    const track = { id, artist, title };
    if (album) track.album = album;
    if (genre) track.genre = genre;
    // No filesystem paths, cloud IDs, Dropbox IDs, file metadata, or audio URLs in public output.
    tracks.push(track);
    stats.published++;
  }
  tracks.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  return { tracks, stats };
}

function usage() {
  console.log("Usage: node scripts/build-catalog.mjs --input inventory.csv [--curation reviewed.csv] [--output public/catalog.json]");
  console.log("Public output includes ONLY explicitly opted-in complete audio with artist and title.");
}
async function readRecords(file) {
  const content = await readFile(file, "utf8");
  if (extname(file).toLowerCase() === ".json") {
    const value = JSON.parse(content);
    const rows = Array.isArray(value) ? value : (value.media_files || value.records || value.rows);
    if (!Array.isArray(rows)) throw new Error("JSON must be an array or contain media_files/records/rows");
    return rows;
  }
  return parseCSV(content);
}
export async function main(args) {
  if (args.includes("--help") || !args.includes("--input")) { usage(); return; }
  const arg = (flag, fallback) => {
    const i = args.indexOf(flag);
    if (i === -1) return fallback;
    if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Missing value for " + flag);
    return args[i + 1];
  };
  const input = arg("--input");
  const curation = arg("--curation", null);
  const output = arg("--output", "public/catalog.json");
  const rows = await readRecords(input);
  const curatedRows = curation ? await readRecords(curation) : [];
  const result = generatePublicCatalog(rows, curatedRows);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result.tracks, null, 2) + "\n", "utf8");
  console.log("Catalog:", JSON.stringify(result.stats));
  console.log("Wrote " + output + " (" + result.tracks.length + " reviewed tracks)");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
