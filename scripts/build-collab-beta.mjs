#!/usr/bin/env node
// Builds the isolated, unlinked DJ OGVHS Collab beta for Vercel.
// It deliberately never uses the main DJ OGVHS production Supabase project.
import { cp, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const stagingProjectRef = "pgufhgmkqgpjoddxvzoa";
const api = process.env.OGVHS_COLLAB_SUPABASE_URL?.trim();
const key = process.env.OGVHS_COLLAB_PUBLISHABLE_KEY?.trim();

if (!api || !key) {
  throw new Error("Set OGVHS_COLLAB_SUPABASE_URL and OGVHS_COLLAB_PUBLISHABLE_KEY in the Vercel project's environment variables.");
}
const parsed = new URL(api);
if (parsed.protocol !== "https:" || parsed.hostname !== stagingProjectRef + ".supabase.co") {
  throw new Error("This beta build must use the dedicated Collab staging Supabase project, not the production Requests project.");
}
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !/^eyJ[A-Za-z0-9_.-]+$/.test(key)) {
  throw new Error("Expected a Supabase publishable (or legacy anon) key. Never use a secret or service_role key.");
}
const dest = resolve("dist");
await rm(dest, { recursive:true, force:true });
await mkdir(dest, { recursive:true });
await cp("src", resolve(dest, "src"), { recursive:true });
await cp("public", resolve(dest, "public"), { recursive:true });
await copyFile("collab.html", resolve(dest, "index.html"));
await copyFile("collab.html", resolve(dest, "collab.html"));
await copyFile("collab-admin.html", resolve(dest, "collab-admin.html"));
await writeFile(resolve(dest, "public/app-config.json"),
  JSON.stringify({ supabaseUrl: parsed.origin, supabaseAnonKey: key }) + "\n",
  { mode: 0o644 });
await writeFile(resolve(dest, "robots.txt"), "User-agent: *\nDisallow: /\n");
console.log("Built DJ OGVHS Collab beta for the separate staging backend. No production Requests backend changed.");
