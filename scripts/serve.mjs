#!/usr/bin/env node
// Local development server only. Do not expose to the public internet.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve(process.cwd());
const mime = { ".svg":"image/svg+xml", ".png":"image/png", ".ico":"image/x-icon", ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".mjs":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8" };
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const raw = decodeURIComponent(url.pathname);
    const name = raw === "/" ? "/index.html" : raw;
    const allowed = new Set(["/about.html", "/src/about.css", "/public/branding/favicon.svg", "/public/branding/favicon-32.png", "/public/branding/favicon.ico", "/public/branding/apple-touch-icon.png", "/public/branding/social-preview-v1.png", "/index.html", "/thanks.html", "/collab.html", "/collab-admin.html", "/src/collab.mjs", "/src/collab-extras.mjs", "/src/collab-admin.mjs", "/src/collab-model.mjs", "/src/collab.css", "/src/thanks.mjs", "/src/tip-options.mjs", "/src/homepage-tips.mjs", "/public/tip-config.json", "/src/main.mjs", "/src/request-quota.mjs", "/src/catalog.mjs", "/src/request-model.mjs", "/src/request-api.mjs",  "/src/styles.css", "/public/catalog.json", "/public/app-config.json"]);
    if (!allowed.has(name)) { res.writeHead(404).end("Not found"); return; }
    const location = resolve(root, "." + name);
    if (location !== root && !location.startsWith(root + sep)) {
      res.writeHead(403).end("Forbidden"); return;
    }
    if (!(await stat(location)).isFile()) throw new Error("Not a file");
    const data = await readFile(location);
    res.writeHead(200, { "content-type": mime[extname(location)] || "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(data);
  } catch { res.writeHead(404).end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log("DJ OGVHS preview: http://127.0.0.1:" + port + "/ (demo: ?demo=1)"));
