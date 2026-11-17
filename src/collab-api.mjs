export async function loadRequestConfig(){
  const response=await fetch(new URL('../public/collab-config.json',import.meta.url),{cache:'no-store'});
  if(!response.ok)return null;
  const config=await response.json();
  const api=new URL(config.apiUrl),login=new URL(config.loginDomain);
  if(api.protocol!=='https:'||!api.hostname.endsWith('.execute-api.us-east-2.amazonaws.com')||login.protocol!=='https:'||!login.hostname.endsWith('.auth.us-east-2.amazoncognito.com')||!config.clientId)throw Error('Invalid Collab configuration.');
  return {...config,apiUrl:api.origin,loginDomain:login.origin};
}
