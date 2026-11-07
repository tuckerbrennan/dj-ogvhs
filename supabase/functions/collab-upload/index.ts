// Secure Google Drive upload proxy for DJ OGVHS Collab.
// One private Drive folder per room; upload tokens remain server-side.
// Guest uploads require a valid invite and are capped at 15 MiB per file.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const encoder=new TextEncoder();
const maxBytes=15*1024*1024;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const browserPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invitePattern=/^[A-Za-z0-9_-]{40,100}$/;
const driveIdPattern=/^[A-Za-z0-9_-]{10,200}$/;
const origins=(Deno.env.get("DJ_ALLOWED_ORIGINS")||
  "https://ogvhs.com,https://www.ogvhs.com,https://collab.ogvhs.com,http://127.0.0.1:4173,http://localhost:4173")
  .split(",").map(x=>x.trim()).filter(Boolean);
const allowedTypes:Record<string,string>={
  mp3:"audio/mpeg",m4a:"audio/mp4",aac:"audio/aac",wav:"audio/wav",
  flac:"audio/flac",ogg:"audio/ogg",aif:"audio/aiff",aiff:"audio/aiff",
  mid:"audio/midi",midi:"audio/midi",m3u:"audio/x-mpegurl",
  m3u8:"application/vnd.apple.mpegurl",csv:"text/csv",txt:"text/plain",
  pdf:"application/pdf"
};
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,"0")).join("");
async function sha(value:string){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)));}
async function hmac(value:string,secret:string){
  const k=await crypto.subtle.importKey("raw",encoder.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",k,encoder.encode(value)));
}
function safeFilename(raw:string):{name:string,mime:string}|null {
  const name=raw.normalize("NFC").replace(/[\\/\x00-\x1F\x7F<>:"|?*]/g,"_")
    .replace(/^\.+/,"").trim().slice(0,160);
  const ext=name.split(".").at(-1)?.toLowerCase()||"";
  return name&&allowedTypes[ext]?{name,mime:allowedTypes[ext]}:null;
}
async function googleAccessToken():Promise<string>{
  const id=Deno.env.get("DJ_GOOGLE_CLIENT_ID");
  const secret=Deno.env.get("DJ_GOOGLE_CLIENT_SECRET");
  const refresh=Deno.env.get("DJ_GOOGLE_REFRESH_TOKEN");
  if(!id||!secret||!refresh)throw Error("Google Drive connection isn't configured.");
  const response=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:id,client_secret:secret,refresh_token:refresh,grant_type:"refresh_token"})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||typeof data.access_token!=="string"){
    console.error("Google OAuth refresh failed",response.status);
    throw Error("Couldn't connect to Google Drive.");
  }
  return data.access_token;
}
async function createFolder(token:string,title:string,roomId:string):Promise<string>{
  const parent=Deno.env.get("DJ_GOOGLE_COLLAB_PARENT_FOLDER_ID")||"root";
  if(parent!=="root"&&!driveIdPattern.test(parent))throw Error("Drive parent folder isn't configured.");
  const name="OGVHS Collab - "+title.replace(/[\\/\x00-\x1F<>:"|?*]/g," ").slice(0,85)+" - "+roomId.slice(0,8);
  const result=await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name",{
    method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:[parent]})
  });
  const body=await result.json().catch(()=>({}));
  if(!result.ok||!driveIdPattern.test(body.id||"")){
    console.error("Drive folder creation failed",result.status);
    throw Error("Could not create the private room folder.");
  }
  return body.id;
}
async function removeDriveFile(token:string,id:string){
  if(!driveIdPattern.test(id))return;
  await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(id),
    {method:"DELETE",headers:{Authorization:"Bearer "+token}}).catch(()=>{});
}
async function uploadToDrive(token:string,file:File,folderId:string,name:string,mime:string):Promise<string>{
  const session=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name",{
    method:"POST",headers:{
      Authorization:"Bearer "+token,
      "Content-Type":"application/json; charset=UTF-8",
      "X-Upload-Content-Length":String(file.size),
      "X-Upload-Content-Type":mime
    },
    body:JSON.stringify({name,mimeType:mime,parents:[folderId]})
  });
  const sessionUrl=session.headers.get("Location");
  if(!session.ok||!sessionUrl){
    console.error("Drive upload session failed",session.status);
    throw Error("Couldn't start the Google Drive upload.");
  }
  const dest=new URL(sessionUrl);
  if(dest.protocol!=="https:"||dest.hostname!=="www.googleapis.com"||
    !dest.pathname.startsWith("/upload/drive/v3/files"))
    throw Error("Unexpected Drive upload destination.");
  const complete=await fetch(dest.href,{
    method:"PUT",headers:{"Content-Type":mime},body:file
  });
  const body=await complete.json().catch(()=>({}));
  if(!complete.ok||!driveIdPattern.test(body.id||"")){
    console.error("Drive file upload failed",complete.status);
    throw Error("Google Drive couldn't save the file.");
  }
  return body.id;
}
Deno.serve(async request=>{
  const origin=request.headers.get("origin");
  const allowed=Boolean(origin&&origins.includes(origin));
  const cors={
    "Access-Control-Allow-Origin":allowed?origin!:"null",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type,authorization,apikey,x-dj-collab-invite,x-dj-collab-client",
    "Cache-Control":"no-store","Vary":"Origin",
    "Content-Type":"application/json; charset=utf-8"
  };
  const reply=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers:cors});
  if(request.method==="OPTIONS")return new Response(null,{status:allowed?204:403,headers:cors});
  if(!allowed)return reply(403,{error:"Origin not permitted."});
  if(!["GET","POST"].includes(request.method))return reply(405,{error:"Method not allowed."});
  const project=Deno.env.get("SUPABASE_URL");
  let service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!service){try{service=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;}catch{ /* ignore */ }}
  const rateSecret=Deno.env.get("DJ_COLLAB_RATE_SECRET");
  if(!project||typeof service!=="string"||!rateSecret)
    return reply(503,{error:"Upload service isn't configured."});
  const db=createClient(project,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const url=new URL(request.url);
  if(url.searchParams.get("admin")==="1"){
    const jwt=(request.headers.get("authorization")||"").match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1];
    if(!jwt)return reply(401,{error:"DJ sign-in required."});
    const {data:profile,error:authError}=await db.auth.getUser(jwt);
    if(authError||!profile.user)return reply(401,{error:"Invalid sign-in session."});
    const {data:member}=await db.from("dj_admins")
      .select("user_id").eq("user_id",profile.user.id).maybeSingle();
    if(!member)return reply(403,{error:"DJ administrator access required."});
    if(request.method==="GET"){
      const id=url.searchParams.get("roomId")||"";
      if(!uuidPattern.test(id))return reply(400,{error:"Invalid room."});
      const [{data:room},{data:files,error:filesError}]=await Promise.all([
        db.from("dj_collab_rooms").select("drive_folder_id").eq("id",id).maybeSingle(),
        db.from("dj_collab_uploads")
          .select("id,filename,mime_type,size_bytes,drive_file_id,status,created_at")
          .eq("room_id",id).order("created_at",{ascending:false}).limit(100)
      ]);
      return filesError?reply(503,{error:"Unable to load uploads."}):reply(200,{
        configured:Boolean(room?.drive_folder_id),
        folderUrl:room?.drive_folder_id?
          "https://drive.google.com/drive/folders/"+room.drive_folder_id:null,
        uploads:files||[]
      });
    }
    const data=await request.json().catch(()=>null);
    const roomId=String(data?.roomId||"");
    if(!uuidPattern.test(roomId))return reply(400,{error:"Invalid room."});
    const {data:room,error:roomError}=await db.from("dj_collab_rooms")
      .select("id,title,drive_folder_id").eq("id",roomId).maybeSingle();
    if(roomError||!room)return reply(404,{error:"Room not found."});
    if(room.drive_folder_id)return reply(200,{
      configured:true,folderUrl:"https://drive.google.com/drive/folders/"+room.drive_folder_id
    });
    let token:string;
    try{token=await googleAccessToken();}
    catch(e){return reply(503,{error:(e as Error).message});}
    let folder:string;
    try{folder=await createFolder(token,room.title,room.id);}
    catch(e){return reply(503,{error:(e as Error).message});}
    const {data:updated,error}=await db.from("dj_collab_rooms")
      .update({drive_folder_id:folder}).eq("id",room.id).is("drive_folder_id",null)
      .select("id,drive_folder_id").maybeSingle();
    if(error||!updated){
      await removeDriveFile(token,folder);
      return reply(409,{error:"Another upload folder may already have been connected. Refresh and retry."});
    }
    return reply(201,{configured:true,folderUrl:"https://drive.google.com/drive/folders/"+folder});
  }

  if(request.method!=="POST")return reply(405,{error:"Method not allowed."});
  const invite=request.headers.get("x-dj-collab-invite")||"";
  const clientId=request.headers.get("x-dj-collab-client")||"";
  if(!invitePattern.test(invite)||!browserPattern.test(clientId))
    return reply(403,{error:"A valid collaboration invitation is required."});
  const totalLimit=maxBytes+1024*1024; // include multipart framing overhead
  const declaredHeader=request.headers.get("content-length");
  if(declaredHeader!==null){
    const declared=Number(declaredHeader);
    if(!Number.isSafeInteger(declared)||declared<1)
      return reply(400,{error:"Invalid upload size."});
    if(declared>totalLimit)
      return reply(413,{error:"Files must be 15 MB or smaller."});
  }
  const type=request.headers.get("content-type")||"";
  if(!/^multipart\/form-data\s*;.*boundary=/i.test(type))
    return reply(415,{error:"Choose a file to upload."});
  let file:File;
  try{
    // Edge proxies may strip Content-Length. Limit actual streamed bytes too;
    // never trust a declared size before parsing attacker-controlled multipart.
    const reader=request.body?.getReader();
    if(!reader)return reply(400,{error:"No upload body."});
    const chunks:Uint8Array[]=[];
    let size=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>totalLimit){
        await reader.cancel().catch(()=>{});
        return reply(413,{error:"Files must be 15 MB or smaller."});
      }
      chunks.push(value);
    }
    const bounded=new Request("https://ogvhs.invalid/upload",{
      method:"POST",headers:{"Content-Type":type},
      body:new Blob(chunks)
    });
    const form=await bounded.formData();
    const part=form.get("file");
    if(!(part instanceof File))return reply(400,{error:"No file selected."});
    file=part;
  }catch{return reply(400,{error:"Could not read upload."});}
  const details=safeFilename(file.name);
  if(!details||file.size<1||file.size>maxBytes)
    return reply(400,{error:"Upload an audio file, playlist, text, CSV, or PDF up to 15 MB."});
  const inviteHash=await sha(invite);
  const clientKey=await hmac(clientId,rateSecret);
  const {data:reservation,error:reserveError}=await db.rpc("dj_reserve_collab_upload",{
    p_invite_hash:inviteHash,p_client_key:clientKey,
    p_filename:details.name,p_mime_type:details.mime,p_size_bytes:file.size
  });
  if(reserveError){
    console.error("Upload reservation failed",reserveError.code);
    return reply(503,{error:"Couldn't reserve an upload."});
  }
  const result=reservation?.status;
  if(result!=="reserved"){
    if(result==="not_configured")return reply(503,{error:"This room's Google Drive folder is not connected yet."});
    if(result==="limit")return reply(429,{error:"You have reached 5 uploads per hour."});
    if(result==="full")return reply(409,{error:"This room has reached its file limit."});
    if(result==="closed")return reply(403,{error:"This collaboration is closed."});
    return reply(403,{error:"Invitation or upload not available."});
  }
  const uploadId=reservation.id;
  try{
    const token=await googleAccessToken();
    const driveId=await uploadToDrive(token,file,reservation.folderId,details.name,details.mime);
    const {error:saveError}=await db.from("dj_collab_uploads")
      .update({status:"complete",drive_file_id:driveId}).eq("id",uploadId);
    if(saveError){
      await removeDriveFile(token,driveId);
      throw Error("Upload couldn't be finalized.");
    }
    return reply(201,{uploaded:true,name:details.name,size:file.size});
  }catch(e){
    await db.from("dj_collab_uploads").update({status:"failed"}).eq("id",uploadId);
    return reply(503,{error:e instanceof Error?e.message:"Upload failed."});
  }
});
