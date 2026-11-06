import {loadRequestConfig} from "./request-api.mjs";
import {inviteFromHash,normalizeCollabEmail,validateCollabUpload} from "./collab-model.mjs";

const $=id=>document.getElementById(id);
const invite=inviteFromHash(location.hash);
const toggle=$("collab-access-toggle");
const form=$("collab-access-form");
const accessStatus=$("collab-access-feedback");
const fileInput=$("collab-upload-file");
const fileButton=$("collab-upload-send");
const fileStatus=$("collab-upload-feedback");
let config=null,uploadsEnabled=false,uploading=false;

function browserId(){
  const key="ogvhs-collab-browser-v1";
  try{
    let id=localStorage.getItem(key);
    if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
      id=crypto.randomUUID();
      localStorage.setItem(key,id);
    }
    return id;
  }catch{return crypto.randomUUID();}
}
const clientId=browserId();
toggle.addEventListener("click",()=>{
  form.hidden=!form.hidden;
  toggle.setAttribute("aria-expanded",String(!form.hidden));
  if(!form.hidden)$("collab-access-email").focus();
});

form.addEventListener("submit",async event=>{
  event.preventDefault();
  const input=$("collab-access-email");
  const email=normalizeCollabEmail(input.value);
  if(!input.validity.valid||!email){
    accessStatus.textContent="Enter a valid email address.";return;
  }
  if(!config){
    accessStatus.textContent="Collab requests aren't connected yet. Please try again later.";return;
  }
  const button=$("collab-access-submit");
  button.disabled=true;
  accessStatus.textContent="Sending your request…";
  try{
    const response=await fetch(config.supabaseUrl+"/functions/v1/collab-access",{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":config.supabaseAnonKey,"x-dj-collab-client":clientId},
      body:JSON.stringify({email,website:$("collab-access-website").value}),
      signal:AbortSignal.timeout(20000)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.accepted!==true)throw Error(data.error||"Unable to save your request.");
    input.value="";
    accessStatus.textContent="Request received! I'll email you if a collaboration spot opens up.";
  }catch(error){
    accessStatus.textContent=error.message||"Couldn't save your request. Try again.";
  }finally{
    button.disabled=false;
  }
});

function updateUploadControls(){
  fileInput.disabled=!config||!uploadsEnabled||uploading;
  fileButton.disabled=!config||!uploadsEnabled||uploading||!fileInput.files?.length;
}
fileInput.addEventListener("change",updateUploadControls);
fileButton.addEventListener("click",async()=>{
  if(!config||!invite||!uploadsEnabled||uploading)return;
  const file=fileInput.files?.[0];
  if(!file){fileStatus.textContent="Choose a file first.";return;}
  const error=validateCollabUpload(file.name,file.size);
  if(error){fileStatus.textContent=error;return;}
  uploading=true;updateUploadControls();
  fileStatus.textContent="Uploading to this Collab's private Google Drive folder…";
  try{
    const body=new FormData();
    body.append("file",file,file.name);
    const response=await fetch(config.supabaseUrl+"/functions/v1/collab-upload",{
      method:"POST",
      headers:{"apikey":config.supabaseAnonKey,
        "x-dj-collab-invite":invite,
        "x-dj-collab-client":clientId},
      body
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.uploaded!==true)
      throw Error(result.error||"Upload couldn't be saved.");
    fileInput.value="";
    fileStatus.textContent="Uploaded! "+result.name+" is in this Collab's private Google Drive folder.";
  }catch(error){
    fileStatus.textContent=error.message||"Upload failed. Please try again.";
  }finally{uploading=false;updateUploadControls();}
});

(async()=>{
  try{config=await loadRequestConfig();}catch{config=null;}
  if(!invite){
    fileStatus.textContent="A private invitation is required before uploading.";
    return;
  }
  if(!config){
    fileStatus.textContent="Uploads aren't connected to the backend yet.";
    return;
  }
  try{
    const res=await fetch(config.supabaseUrl+"/functions/v1/collab-room",{
      headers:{"apikey":config.supabaseAnonKey,"x-dj-collab-invite":invite,
        "x-dj-collab-client":clientId},
      cache:"no-store"
    });
    const data=await res.json().catch(()=>({}));
    if(res.ok&&data.room?.isOpen&&data.room?.uploadsEnabled){
      uploadsEnabled=true;
      fileStatus.textContent="Uploads are enabled for this room. Files are private and available to the DJ.";
    }else{
      fileStatus.textContent=data.room?.isOpen?
        "The DJ hasn't connected a Google Drive folder for this room yet.":
        "This collaboration isn't open for uploads.";
    }
  }catch{
    fileStatus.textContent="Couldn't check upload availability.";
  }
  updateUploadControls();
})();
