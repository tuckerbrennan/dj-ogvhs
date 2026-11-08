// Private DJ admin additions: Collab access requests and room-specific Drive files.
import {loadRequestConfig} from "./request-api.mjs";
const $=id=>document.getElementById(id);
const panel=$("collab-admin-drive"),requests=$("collab-access-requests");
const select=$("collab-drive-room"),connect=$("collab-drive-connect"),folderLink=$("collab-drive-folder-link");
const driveStatus=$("collab-admin-drive-feedback"),files=$("collab-admin-files");
let config=null,client=null,session=null,rooms=[];
function element(tag,text,cls=""){
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!==undefined)e.textContent=String(text);
  return e;
}
async function api(route,opts={}){
  if(!session||!config)throw Error("Administrator sign-in required.");
  const response=await fetch(config.supabaseUrl+"/functions/v1/"+route,{
    ...opts,
    headers:{"apikey":config.supabaseAnonKey,"Authorization":"Bearer "+session.access_token,
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
      "This Collab has a private Google Drive folder. Only authorized admins can open its files.":
      "This Collab doesn't have a Drive folder yet. Enable one before guests can upload.";
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
      const link=element("a","Open in Drive","add-track");
      if(/^[A-Za-z0-9_-]{10,200}$/.test(entry.drive_file_id||"")){
        link.href="https://drive.google.com/file/d/"+encodeURIComponent(entry.drive_file_id)+"/view";
        link.target="_blank";link.rel="noopener noreferrer";
      }else link.removeAttribute("href");
      row.append(info,link);files.appendChild(row);
    }
  }catch(e){driveStatus.textContent=e.message;connect.disabled=true;}
}
connect.addEventListener("click",async()=>{
  if(!select.value||!session)return;
  connect.disabled=true;
  driveStatus.textContent="Creating the Collab's private folder in Google Drive…";
  try{
    const data=await api("collab-upload?admin=1",{
      method:"POST",body:JSON.stringify({roomId:select.value})
    });
    driveStatus.textContent=data.configured?"Private Google Drive folder connected.":"Unable to connect Drive.";
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
    const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2");
    client=createClient(config.supabaseUrl,config.supabaseAnonKey);
    client.auth.onAuthStateChange((_event,s)=>{setTimeout(()=>showSession(s),0);});
    const {data}=await client.auth.getSession();
    await showSession(data.session);
  }catch(e){driveStatus.textContent=e.message;}
})();
