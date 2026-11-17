import {getSession} from "./collab-auth.mjs";
// Private DJ admin additions: access requests and room-scoped uploads.
import {loadRequestConfig} from "./collab-api.mjs";
const $=id=>document.getElementById(id);
const panel=$("collab-admin-drive"),requests=$("collab-access-requests");
const select=$("collab-drive-room"),connect=$("collab-drive-connect"),folderLink=$("collab-drive-folder-link");
const driveStatus=$("collab-admin-drive-feedback"),files=$("collab-admin-files");
let config=null,session=null,rooms=[];
function element(tag,text,cls=""){
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!==undefined)e.textContent=String(text);
  return e;
}
async function api(route,opts={}){
  if(!session||!config)throw Error("Administrator sign-in required.");
  const routes={"collab-access":"/api/access","collab-room?admin=1":"/api/rooms"};
  const target=route.startsWith("collab-upload")?"/api/uploads"+((route.includes("roomId="))?"?roomId="+route.split("roomId=")[1]:""):routes[route];
  const response=await fetch(config.apiUrl+target,{
    ...opts,
    headers:{"Authorization":"Bearer "+session.access_token,
      "Content-Type":"application/json"},
    cache:"no-store"
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Unable to load admin information.");
  return data;
}
async function loadAccess(){
  if(!session)return;
  const {requests:items}=await api("collab-access",{method:"GET"});
  requests.replaceChildren();
  if(!items?.length){
    requests.appendChild(element("p","Nobody has requested a Collab invitation yet.","helper"));
    return;
  }
  for(const item of items){
    const row=element("div",undefined,"collab-admin-room");
    const details=element("div");
    details.appendChild(element("strong",item.email));
    details.appendChild(element("small","Requested "+new Date(item.created_at).toLocaleString()+" · "+item.status));
    const tools=element("div",undefined,"collab-request-controls");
    const status=element("select");
    status.setAttribute("aria-label","Status for "+item.email);
    for(const choice of ["pending","approved","declined"]){
      const opt=element("option",choice.charAt(0).toUpperCase()+choice.slice(1));
      opt.value=choice;opt.selected=item.status===choice;status.appendChild(opt);
    }
    status.addEventListener("change",async()=>{
      status.disabled=true;
      try{
        await api("collab-access",{method:"PATCH",body:JSON.stringify({id:item.id,status:status.value})});
        details.querySelector("small").textContent="Requested "+
          new Date(item.created_at).toLocaleString()+" · "+status.value;
      }catch(e){
        status.value=item.status;driveStatus.textContent=e.message;
      }finally{status.disabled=false;}
    });
    const emailCopy=element("button","Copy email","add-track");
    emailCopy.type="button";
    emailCopy.addEventListener("click",async()=>{
      try{await navigator.clipboard.writeText(item.email);driveStatus.textContent="Email copied.";}
      catch{driveStatus.textContent="Copy the email address from the request list.";}
    });
    tools.append(status,emailCopy);row.append(details,tools);requests.appendChild(row);
  }
}
async function loadRooms(){
  const data=await api("collab-room?admin=1",{method:"GET"});
  rooms=data.rooms||[];
  const previous=select.value;
  select.replaceChildren();
  const empty=element("option","Choose a Collab");empty.value="";select.appendChild(empty);
  for(const room of rooms){
    const opt=element("option",room.title);opt.value=room.id;select.appendChild(opt);
  }
  select.value=rooms.some(x=>x.id===previous)?previous:"";
  if(!select.value&&rooms.length)select.value=rooms[0].id;
  await loadDrive();
}
async function loadDrive(){
  const id=select.value;
  connect.disabled=!id;
  folderLink.hidden=true;folderLink.removeAttribute("href");
  files.replaceChildren();
  if(!id){driveStatus.textContent="Choose a Collab to see its uploads.";return;}
  try{
    const data=await api("collab-upload?admin=1&roomId="+encodeURIComponent(id),{method:"GET"});
    connect.disabled=data.configured;
    driveStatus.textContent=data.configured?
      "Uploads are private and available only to authorized admins.":
      "Enable private uploads before guests can upload files.";
    if(data.folderUrl){
      folderLink.href=data.folderUrl;folderLink.hidden=false;
    }
    const uploads=(data.uploads||[]).filter(x=>x.status==="complete");
    if(!uploads.length){
      files.appendChild(element("p","No uploaded files in this Collab yet.","helper"));
      return;
    }
    for(const entry of uploads){
      const row=element("div",undefined,"collab-admin-room");
      const info=element("div");
      info.appendChild(element("strong",entry.filename));
      info.appendChild(element("small",Math.round(entry.size_bytes/1024)+" KB · "+
        new Date(entry.created_at).toLocaleString()));
      const link=element("a","Download file","add-track");
      try{
        const url=new URL(entry.download_url);
        if(url.protocol!=="https:"||!url.hostname.endsWith(".amazonaws.com"))throw Error("Invalid download");
        link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
      }catch{link.removeAttribute("href");}
      row.append(info,link);files.appendChild(row);
    }
  }catch(e){driveStatus.textContent=e.message;connect.disabled=true;}
}
connect.addEventListener("click",async()=>{
  if(!select.value||!session)return;
  connect.disabled=true;
  driveStatus.textContent="Enabling private uploads…";
  try{
    const data=await api("collab-room?admin=1",{
      method:"PATCH",body:JSON.stringify({roomId:select.value,enableUploads:true})
    });
    driveStatus.textContent=data.room?.uploads_enabled?"Private uploads enabled.":"Unable to enable uploads.";
    await loadDrive();
  }catch(e){driveStatus.textContent=e.message;connect.disabled=false;}
});
$("collab-drive-refresh").addEventListener("click",loadDrive);
$("collab-access-refresh").addEventListener("click",()=>loadAccess().catch(e=>{
  driveStatus.textContent=e.message;
}));
select.addEventListener("change",loadDrive);
async function showSession(s){
  session=s;
  panel.hidden=!s;
  requests.replaceChildren();
  if(!s)return;
  try{await Promise.all([loadAccess(),loadRooms()]);}
  catch(e){driveStatus.textContent=e.message;panel.hidden=true;requests.replaceChildren();}
}
(async()=>{
  try{
    config=await loadRequestConfig();
    if(!config)throw Error("Collab backend isn't connected yet.");
    await showSession(getSession());
    document.addEventListener("ogvhs-rooms-changed",()=>{if(session)loadRooms().catch(e=>{driveStatus.textContent=e.message;});});
    document.addEventListener("ogvhs-auth-expired",()=>showSession(null));
  }catch(e){driveStatus.textContent=e.message;}
})();
