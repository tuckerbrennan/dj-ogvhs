import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("public Collab page contains the optional email request form", () => {
  const page=read("collab.html");
  for (const id of ["collab-access-toggle","collab-access-form","collab-access-email",
    "collab-access-submit","collab-access-feedback"]) {
    assert.match(page, new RegExp('id="'+id+'"'));
  }
  assert.match(page,/type="email"[^>]*required/);
  assert.match(page,/collab-extras[.]mjs/);
  assert.match(page,/not a mailing-list signup/);
});

test("guest upload UI is invite-scoped and disabled by default", () => {
  const page=read("collab.html");
  assert.match(page, /id="collab-upload-file"[^>]*disabled/);
  assert.match(page, /id="collab-upload-send"[^>]*disabled/);
  const handler=read("src/collab-extras.mjs");
  assert.match(handler,/inviteFromHash/);
  assert.match(handler,/x-dj-collab-invite/);
  assert.match(handler,/validateCollabUpload/);
});

test("private admin page includes access requests and Drive folders", () => {
  const page=read("collab-admin.html");
  for (const id of ["collab-access-requests","collab-drive-room",
    "collab-drive-connect","collab-admin-files"]) {
    assert.match(page, new RegExp('id="'+id+'"'));
  }
  assert.match(page,/collab-admin-extras[.]mjs/);
});

test("server migration keeps emails and Drive uploads behind RLS", () => {
  const sql=read("supabase/migrations/202611060003_collab_access_uploads.sql");
  for (const table of ["dj_collab_access_requests","dj_collab_uploads"]) {
    assert.match(sql,new RegExp('alter table public[.]'+table+' enable row level security'));
    assert.match(sql,new RegExp('revoke all on public[.]'+table+' from public, anon, authenticated'));
  }
  assert.match(sql,/grant execute on function public[.]dj_request_collab_access/);
  assert.match(sql,/grant execute on function public[.]dj_reserve_collab_upload/);
});

test("guest-facing Edge Functions explicitly disable gateway JWT, verify admins themselves", () => {
  const conf=read("supabase/config.toml");
  for (const func of ["collab-room","collab-access","collab-upload"]) {
    assert.match(conf,new RegExp('\\[functions\\.'+func+'\\]\\s*verify_jwt = false'));
    const server=read("supabase/functions/"+func+"/index.ts");
    assert.match(server,/\.auth\.getUser\(jwt\)/);
    assert.match(server,/from\("dj_admins"\)/);
  }
});

test("no sensitive Google Drive OAuth credentials are embedded in browser source",()=>{
  const client=read("src/collab-extras.mjs")+read("src/collab-admin-extras.mjs");
  assert.doesNotMatch(client,/DJ_GOOGLE_CLIENT_SECRET|DJ_GOOGLE_REFRESH_TOKEN|SUPABASE_SERVICE_ROLE_KEY/);
  const server=read("supabase/functions/collab-upload/index.ts");
  assert.match(server,/DJ_GOOGLE_CLIENT_SECRET/);
  assert.match(server,/DJ_GOOGLE_REFRESH_TOKEN/);
});
