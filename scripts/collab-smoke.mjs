#!/usr/bin/env node
// Read-only/invalid-input smoke checks for a deployed Collab backend.
// Does not create rooms, records, emails or uploads; no privileged key required.
import {readFile} from "node:fs/promises";

const conf=JSON.parse(await readFile(new URL("../public/app-config.json",import.meta.url),"utf8"));
const base=(process.env.SUPABASE_URL||conf.supabaseUrl||"").replace(/\/$/,"");
const key=process.env.SUPABASE_PUBLISHABLE_KEY||conf.supabaseAnonKey||"";
const origin=process.env.COLLAB_TEST_ORIGIN||"https://ogvhs.com";
if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key){
  console.error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to the staging project.");
  process.exit(2);
}
const tests=[
  {name:"collab-room refuses guests with no invite",method:"GET",route:"collab-room",want:404,headers:{}},
  {name:"collab-room admin needs a login",method:"GET",route:"collab-room?admin=1",want:401,headers:{}},
  {name:"collab-access inbox requires admin login",method:"GET",route:"collab-access",want:401,headers:{}},
  {name:"collab-upload admin requires login",method:"GET",route:"collab-upload?admin=1",want:401,headers:{}},
  {name:"collab-upload refuses non-invited guests",method:"POST",route:"collab-upload",want:403,headers:{}},
  {name:"collab-access rejects invalid emails",method:"POST",route:"collab-access",want:400,
    headers:{"Content-Type":"application/json",
      "x-dj-collab-client":"59bca307-bfd7-4d2d-a079-eaa0a3154495"},
    body:JSON.stringify({email:"not-an-email"})}
];
let failures=0;
for(const check of tests){
  try{
    const response=await fetch(base+"/functions/v1/"+check.route,{
      method:check.method,
      headers:{"apikey":key,"Origin":origin,...check.headers},
      ...(check.body?{body:check.body}:{}),
      signal:AbortSignal.timeout(10000)
    });
    const ok=response.status===check.want;
    console.log((ok?"PASS":"FAIL")+" "+check.name+" — HTTP "+response.status+" (expected "+check.want+")");
    if(!ok)failures++;
  }catch(e){
    console.error("FAIL "+check.name+": "+e.message);failures++;
  }
}
if(failures){
  console.error(failures+" Collab smoke check(s) failed. Do not activate guest features.");
  process.exit(1);
}
console.log("Nonmutating Collab checks passed. Run authenticated end-to-end room/Drive tests separately.");
