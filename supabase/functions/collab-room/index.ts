// Invite-only DJ OGVHS playlist room endpoint.
// The public function uses no JWT for guests; admin actions explicitly verify it.
import { createClient } from "npm:@supabase/supabase-js@2";
const encoder = new TextEncoder();
const tokenPattern = /^[A-Za-z0-9_-]{40,100}$/;
const browserPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidPattern = /^[0-9a-f-]{36}$/i;
const allowedOrigins = (Deno.env.get("DJ_ALLOWED_ORIGINS") ||
  "https://ogvhs.com,https://www.ogvhs.com,https://collab.ogvhs.com,http://127.0.0.1:4173,http://localhost:4173")
  .split(",").map(x=>x.trim()).filter(Boolean);
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,"0")).join("");
async function sha(value: string) { return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value))); }
async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw",encoder.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",key,encoder.encode(value)));
}
function clean(value: unknown, max: number, required=false): string | null {
  if (typeof value !== "string") return required ? null : "";
  const s=value.trim().replace(/\s+/g," ");
  return (s.length>max || (required&&!s))?null:s;
}
function canonicalSpotify(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const u=new URL(value.trim());
    if (u.protocol!=="https:" || u.hostname!=="open.spotify.com") return null;
    const m=/^\/playlist\/([A-Za-z0-9]{22})\/?$/.exec(u.pathname);
    return m ? "https://open.spotify.com/playlist/"+m[1]:null;
  } catch {return null;}
}
function generateInvite() {
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
Deno.serve(async request=>{
  const origin=request.headers.get("origin");
  const allowed=Boolean(origin&&allowedOrigins.includes(origin));
  const cors={
    "Access-Control-Allow-Origin":allowed?origin!:"null",
    "Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type,authorization,apikey,x-dj-collab-invite,x-dj-collab-client",
    "Cache-Control":"no-store",
    "Vary":"Origin",
    "Content-Type":"application/json; charset=utf-8"
  };
  const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:cors});
  if(request.method==="OPTIONS")return new Response(null,{status:allowed?204:403,headers:cors});
  if(!allowed)return reply(403,{error:"Origin not permitted."});
  if(!["GET","POST","PATCH"].includes(request.method))return reply(405,{error:"Method not allowed."});

  const project=Deno.env.get("SUPABASE_URL");
  let serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!serviceKey){try {
    const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    serviceKey=typeof keys.default==="string"?keys.default:undefined;
  } catch { /* no key */ }}
  if(!project||!serviceKey)return reply(503,{error:"Collaboration backend is not configured."});
  const db=createClient(project,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const url=new URL(request.url);
  const admin=url.searchParams.get("admin")==="1";
  async function body(){
    if(Number(request.headers.get("content-length")||0)>8192)return null;
    const s=await request.text();
    if(encoder.encode(s).byteLength>8192)return null;
    try{const parsed:unknown=JSON.parse(s);return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:null;}
    catch{return null;}
  }

  if(admin){
    const jwt=(request.headers.get("authorization")||"").match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1];
    if(!jwt)return reply(401,{error:"Sign in as an approved DJ administrator."});
    const {data:profile,error:authError}=await db.auth.getUser(jwt);
    if(authError||!profile.user)return reply(401,{error:"Session expired."});
    const {data:membership,error:memberError}=await db.from("dj_admins").select("user_id").eq("user_id",profile.user.id).maybeSingle();
    if(memberError||!membership)return reply(403,{error:"Administrator access required."});
    if(request.method==="GET"){
      const {data,error}=await db.from("dj_collab_rooms")
        .select("id,title,description,is_open,expires_at,created_at")
        .order("created_at",{ascending:false}).limit(50);
      return error?reply(503,{error:"Unable to list rooms."}):reply(200,{rooms:data});
    }
    const input=await body();
    if(!input)return reply(400,{error:"Invalid request."});
    if(request.method==="POST"){
      const title=clean(input.title,120,true),description=clean(input.description??"",500);
      const days=Number(input.expiresInDays??30);
      if(!title||description===null||!Number.isInteger(days)||days<1||days>180)
        return reply(400,{error:"Enter a title and an expiry between 1 and 180 days."});
      const invite=generateInvite();
      const expiresAt=new Date(Date.now()+days*86400000).toISOString();
      const {data,error}=await db.from("dj_collab_rooms").insert({
        title,description,expires_at:expiresAt,invite_hash:await sha(invite),
        created_by:profile.user.id
      }).select("id,title,expires_at").single();
      if(error)return reply(503,{error:"Unable to create room."});
      return reply(201,{room:data,invite});
    }
    if(request.method==="PATCH"){
      const roomId=String(input.roomId||"");
      if(!uuidPattern.test(roomId)||typeof input.isOpen!=="boolean")
        return reply(400,{error:"Invalid room change."});
      const {data,error}=await db.from("dj_collab_rooms")
        .update({is_open:input.isOpen}).eq("id",roomId)
        .select("id,title,is_open").maybeSingle();
      if(error||!data)return reply(404,{error:"Room unavailable."});
      return reply(200,{room:data});
    }
  }

  const invite=request.headers.get("x-dj-collab-invite")||"";
  if(!tokenPattern.test(invite))return reply(404,{error:"A valid invitation is required."});
  const inviteHash=await sha(invite);
  const {data:room,error:roomError}=await db.from("dj_collab_rooms")
    .select("id,title,description,is_open,expires_at")
    .eq("invite_hash",inviteHash).maybeSingle();
  if(roomError)return reply(503,{error:"Unable to check invitation."});
  if(!room)return reply(404,{error:"Invitation not found."});
  const open=room.is_open&&Date.parse(room.expires_at)>Date.now();
  if(request.method==="GET"){
    const {data,error}=await db.from("dj_collab_entries")
      .select("id,kind,title,artist,catalog_id,spotify_url,external_provider,contributor_name,created_at")
      .eq("room_id",room.id).order("created_at",{ascending:false}).limit(200);
    return error?reply(503,{error:"Unable to load playlist."}):reply(200,{
      room:{title:room.title,description:room.description,isOpen:open,expiresAt:room.expires_at},
      entries:data
    });
  }
  if(request.method!=="POST")return reply(405,{error:"Method not allowed."});
  if(!open)return reply(403,{error:"This collaboration is closed."});
  const clientId=request.headers.get("x-dj-collab-client")||"";
  const limiter=Deno.env.get("DJ_COLLAB_RATE_SECRET");
  if(!browserPattern.test(clientId)||!limiter)return reply(503,{error:"Collaboration submission is not configured."});
  const input=await body();
  if(!input)return reply(400,{error:"Invalid submission."});
  const kind=input.kind;
  if(!["catalog","external","manual","spotify_playlist"].includes(String(kind)))
    return reply(400,{error:"Unknown suggestion type."});
  const name=clean(input.name??"",80),title=clean(input.title??"",150),
        artist=clean(input.artist??"",120),catalogId=clean(input.catalogId??"",128),
        spotifyUrl=kind==="spotify_playlist"?canonicalSpotify(input.spotifyUrl):"";
  const externalProvider=kind==="external"?input.externalProvider:null;
  const externalId=kind==="external"?String(input.externalId||""):null;
  if(name===null||title===null||artist===null||catalogId===null||
      (kind!=="spotify_playlist"&&!title)||
      (kind==="catalog"&&!catalogId)||
      (kind==="external"&&(externalProvider!=="itunes"||!/^\d{1,20}$/.test(externalId||"")))||
      (kind==="spotify_playlist"&&!spotifyUrl))
    return reply(400,{error:"Check the song or Spotify playlist link."});
  const key=await hmac(clientId,limiter);
  const {data:result,error:submitError}=await db.rpc("dj_submit_collab_entry",{
    p_invite_hash:inviteHash,p_client_key:key,p_kind:kind,
    p_title:title||"",p_artist:artist||"",p_catalog_id:kind==="catalog"?catalogId:null,
    p_external_provider:kind==="external"?externalProvider:null,
    p_external_id:kind==="external"?externalId:null,
    p_spotify_url:kind==="spotify_playlist"?spotifyUrl:null,
    p_contributor_name:name||""
  });
  if(submitError){console.error("DJ collab submission error",submitError.code);return reply(503,{error:"Unable to save contribution."});}
  const status=result?.status;
  if(status==="accepted")return reply(201,{id:result.id,accepted:true});
  if(status==="duplicate")return reply(409,{error:"Already suggested in this playlist."});
  if(status==="limit")return reply(429,{error:"You've reached 12 suggestions this hour."});
  if(status==="full")return reply(409,{error:"This playlist has reached its 500-entry limit."});
  if(status==="closed")return reply(403,{error:"This collaboration is closed."});
  return reply(400,{error:"This contribution couldn't be accepted."});
});
