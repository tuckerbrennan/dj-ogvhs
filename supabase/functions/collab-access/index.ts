// DJ OGVHS Collab invite-interest inbox. Guest POST, admin GET/PATCH.
// NEVER store the email list in a public repo, browser bundle, or analytics.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const encoder=new TextEncoder();
const browserPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origins=(Deno.env.get("DJ_ALLOWED_ORIGINS")||
  "https://ogvhs.com,https://www.ogvhs.com,https://collab.ogvhs.com,http://127.0.0.1:4173,http://localhost:4173")
  .split(",").map(x=>x.trim()).filter(Boolean);

function normalizedEmail(raw:unknown):string|null {
  if(typeof raw!=="string"||raw.length>254)return null;
  const value=raw.trim().toLowerCase();
  if(value.length<3||value.length>254||!/^[^\s@]{1,64}@[^\s@]{1,189}$/.test(value))return null;
  const domain=value.split("@")[1];
  if(!domain.includes(".")||domain.startsWith(".")||domain.endsWith("."))return null;
  return value;
}
async function hashed(value:string,secret:string){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await crypto.subtle.sign("HMAC",key,encoder.encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async request=>{
  const origin=request.headers.get("origin");
  const allowed=Boolean(origin&&origins.includes(origin));
  const cors={
    "Access-Control-Allow-Origin":allowed?origin!:"null",
    "Access-Control-Allow-Methods":"POST,GET,PATCH,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type,apikey,authorization,x-dj-collab-client",
    "Cache-Control":"no-store",
    "Content-Type":"application/json; charset=utf-8",
    "Vary":"Origin"
  };
  const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:cors});
  if(request.method==="OPTIONS")return new Response(null,{status:allowed?204:403,headers:cors});
  if(!allowed)return reply(403,{error:"Origin not permitted."});
  if(!["POST","GET","PATCH"].includes(request.method))return reply(405,{error:"Method not allowed."});
  const url=Deno.env.get("SUPABASE_URL");
  let service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!service){try{const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");service=keys.default;}catch{ /* ignore */ }}
  const secret=Deno.env.get("DJ_COLLAB_RATE_SECRET");
  if(!url||typeof service!=="string"||!secret)return reply(503,{error:"Collab request service is not configured."});
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

  async function input(){
    const size=Number(request.headers.get("content-length")||0);
    if(size>2048)return null;
    const s=await request.text();
    if(encoder.encode(s).byteLength>2048)return null;
    try{const data:unknown=JSON.parse(s);return data&&typeof data==="object"&&!Array.isArray(data)?data as Record<string,unknown>:null;}
    catch{return null;}
  }

  if(request.method==="GET"||request.method==="PATCH"){
    // This list contains personal email addresses: admin verification is mandatory.
    const jwt=(request.headers.get("authorization")||"").match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1];
    if(!jwt)return reply(401,{error:"DJ sign-in required."});
    const {data:auth,error:authError}=await db.auth.getUser(jwt);
    if(authError||!auth.user)return reply(401,{error:"Invalid sign-in session."});
    const {data:membership,error:memberError}=await db.from("dj_admins")
      .select("user_id").eq("user_id",auth.user.id).maybeSingle();
    if(memberError||!membership)return reply(403,{error:"DJ administrator access required."});
    if(request.method==="GET"){
      const {data,error}=await db.from("dj_collab_access_requests")
        .select("id,email,status,created_at,last_requested_at")
        .order("created_at",{ascending:false}).limit(100);
      return error?reply(503,{error:"Unable to load Collab requests."}):reply(200,{requests:data});
    }
    const body=await input();
    if(!body||!uuidPattern.test(String(body.id||""))||!["pending","approved","declined"].includes(String(body.status))){
      return reply(400,{error:"Invalid review action."});
    }
    const {data,error}=await db.from("dj_collab_access_requests")
      .update({status:body.status,reviewed_at:new Date().toISOString()})
      .eq("id",String(body.id)).select("id,status").maybeSingle();
    return error||!data?reply(404,{error:"Request not found."}):reply(200,{request:data});
  }

  const browserId=request.headers.get("x-dj-collab-client")||"";
  if(!browserPattern.test(browserId))return reply(400,{error:"Could not identify this browser."});
  const body=await input();
  if(!body)return reply(400,{error:"Invalid request."});
  // Honeypot: accept without inserting to discourage unattended form bots.
  if(body.website)return reply(200,{accepted:true});
  const email=normalizedEmail(body.email);
  if(!email)return reply(400,{error:"Enter a valid email address."});
  const clientKey=await hashed(browserId,secret);
  const emailKey=await hashed("email:"+email,secret);
  const {data,error}=await db.rpc("dj_request_collab_access",{
    p_email:email,p_email_key:emailKey,p_client_key:clientKey
  });
  if(error){console.error("Collab access failure",error.code);return reply(503,{error:"Couldn't save your email. Please try again."});}
  if(data?.status==="limit")return reply(429,{error:"Too many requests today. Please try again tomorrow."});
  if(data?.status!=="accepted")return reply(400,{error:"Unable to save request."});
  // Notify only after persistence. A database claim prevents duplicate/concurrent
  // submissions from emailing repeatedly; stale claims can retry after five minutes.
  const formId=Deno.env.get("DJ_COLLAB_NOTIFICATION_FORM_ID")?.trim();
  if(formId&&/^[a-z]{8}$/.test(formId)){
    const now=new Date();
    const stale=new Date(now.getTime()-5*60*1000).toISOString();
    const {data:claim,error:claimError}=await db.from("dj_collab_access_requests")
      .update({notification_claimed_at:now.toISOString()})
      .eq("email_key",emailKey).is("notification_sent_at",null)
      .or(`notification_claimed_at.is.null,notification_claimed_at.lt.${stale}`)
      .select("id").maybeSingle();
    if(claimError)console.error("Collab notification claim failed",claimError.code);
    if(claim){
      let sent=false;
      try{
        const delivery=await fetch(`https://formspree.io/f/${formId}`,{
          method:"POST",
          headers:{"Content-Type":"application/json","Accept":"application/json"},
          body:JSON.stringify({
            email,
            subject:"[DJ OGVHS][Collab] New collaboration request",
            message:`A visitor requested a Collab invitation.\n\nEmail: ${email}\n\nReview the request: https://collab.ogvhs.com/collab-admin.html\n\nThis notification does not approve or send an invitation.`,
          }),
          signal:AbortSignal.timeout(10000)
        });
        const result=await delivery.json().catch(()=>null);
        sent=delivery.ok&&result?.ok===true;
        if(!sent)console.error("Collab notification delivery failed",delivery.status);
      }catch{
        // Never log visitor email addresses, payloads, or provider response bodies.
        console.error("Collab notification delivery unavailable");
      }
      const {error:saveError}=await db.from("dj_collab_access_requests")
        .update(sent?{notification_sent_at:new Date().toISOString(),notification_claimed_at:null}
          :{notification_claimed_at:null})
        .eq("id",claim.id).eq("notification_claimed_at",now.toISOString());
      if(saveError)console.error("Collab notification receipt failed",saveError.code);
    }
  }
  return reply(201,{accepted:true});
});

