import {loadRequestConfig} from "./request-api.mjs";
const $=id=>document.getElementById(id);
const status=$("admin-status"),login=$("collab-admin-login"),content=$("collab-admin-content"),rooms=$("admin-rooms");
let client=null,config=null,session=null;
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;}
function endpoint(){return config.supabaseUrl+"/functions/v1/collab-room?admin=1";}
function headers(){return {"Content-Type":"application/json","apikey":config.supabaseAnonKey,
  "authorization":"Bearer "+session.access_token};}
async function response(request){
  const res=await fetch(endpoint(),{...request,headers:headers(),cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||"Request failed.");
  return data;
}
function inviteURL(token) {
  const url=new URL("./collab.html",location.href);
  url.hash="invite="+encodeURIComponent(token);
  return url.href;
}
async function renderRooms(){
  if(!session)return;
  try{
    const {rooms:items}=await response({method:"GET"});
    rooms.replaceChildren();
    if(!items.length){rooms.appendChild(el("p","helper","No collaboration rooms yet."));return;}
    for(const room of items){
      const row=el("div","collab-admin-room"),left=el("div");
      left.appendChild(el("strong","",room.title));
      left.appendChild(el("small","",room.is_open?"Open until "+new Date(room.expires_at).toLocaleDateString():"Closed"));
      const toggle=el("button","add-track",room.is_open?"Close room":"Reopen room");
      toggle.type="button";
      toggle.addEventListener("click",async()=>{
        toggle.disabled=true;
        try{
          await response({method:"PATCH",body:JSON.stringify({roomId:room.id,isOpen:!room.is_open})});
          status.textContent="Room updated.";
          await renderRooms();
        }catch(e){status.textContent=e.message;toggle.disabled=false;}
      });
      row.append(left,toggle);rooms.appendChild(row);
    }
  }catch(e){status.textContent=e.message;}
}
async function showSession(s){
  session=s;
  login.hidden=Boolean(s);
  content.hidden=!s;
  if(!s){status.textContent="Sign in with an authorized DJ administrator account.";rooms.replaceChildren();return;}
  status.textContent="Checking DJ administrator access…";
  try{await renderRooms();status.textContent="Signed in. You can create invitation-only playlists.";}
  catch(e){content.hidden=true;status.textContent=e.message;}
}
$("collab-admin-login").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("collab-admin-email").value.trim();
  if(!client||!email)return;
  const redirect=new URL("./collab-admin.html",location.href).href;
  const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirect}});
  status.textContent=error?error.message:"Check your email for a sign-in link.";
});
$("collab-create").addEventListener("click",async()=>{
  const button=$("collab-create");
  const title=$("room-name").value.trim(),description=$("room-description").value.trim(),expiresInDays=Number($("room-days").value);
  if(!title||title.length>120||description.length>500||!Number.isInteger(expiresInDays)||expiresInDays<1||expiresInDays>180){
    status.textContent="Give the room a title and an expiry between 1 and 180 days.";return;
  }
  button.disabled=true;status.textContent="Creating invitation…";
  try{
    const data=await response({method:"POST",body:JSON.stringify({title,description,expiresInDays})});
    $("created-link").value=inviteURL(data.invite);
    $("created-link-panel").hidden=false;
    status.textContent="Private invitation created. Copy and save this link now.";
    await renderRooms();
  }catch(e){status.textContent=e.message;}
  finally{button.disabled=false;}
});
$("copy-invite").addEventListener("click",async()=>{
  const input=$("created-link");
  try{await navigator.clipboard.writeText(input.value);status.textContent="Invitation copied.";}
  catch{input.focus();input.select();status.textContent="Select and copy the private link above.";}
});
$("collab-admin-refresh").addEventListener("click",renderRooms);
$("collab-admin-signout").addEventListener("click",async()=>{
  await client?.auth.signOut();
  $("created-link-panel").hidden=true;$("created-link").value="";
});
(async()=>{
  try{
    config=await loadRequestConfig();
    if(!config)throw Error("Collaboration backend is not configured.");
    const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2");
    client=createClient(config.supabaseUrl,config.supabaseAnonKey);
    client.auth.onAuthStateChange((_event,s)=>{setTimeout(()=>showSession(s),0);});
    const {data}=await client.auth.getSession();
    await showSession(data.session);
  }catch(e){status.textContent=e.message;}
})();
