// Package only the collaboration UI. No Supabase browser config is shipped.
import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const config={apiUrl:process.env.OGVHS_COLLAB_API_URL,clientId:process.env.OGVHS_COLLAB_CLIENT_ID,loginDomain:process.env.OGVHS_COLLAB_LOGIN_DOMAIN};
for(const [key,value] of Object.entries(config))if(!value)throw Error('Missing '+key);
const api=new URL(config.apiUrl),login=new URL(config.loginDomain);
if(api.protocol!=='https:'||!api.hostname.endsWith('.execute-api.us-east-2.amazonaws.com')||login.protocol!=='https:'||!login.hostname.endsWith('.auth.us-east-2.amazoncognito.com'))throw Error('Expected Ohio AWS endpoints');
const dest=resolve('dist');await rm(dest,{recursive:true,force:true});await mkdir(dest+'/src',{recursive:true});await mkdir(dest+'/public',{recursive:true});
for(const name of ['collab.mjs','collab-extras.mjs','collab-admin.mjs','collab-admin-extras.mjs','collab-model.mjs','collab-api.mjs','collab-auth.mjs','catalog.mjs','collab.css','styles.css','about.css'])await cp('src/'+name,dest+'/src/'+name);
await cp('public/catalog.json',dest+'/public/catalog.json');await cp('public/branding',dest+'/public/branding',{recursive:true});
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
for(const [source,target] of [['collab.html','index.html'],['collab.html','collab.html'],['collab-admin.html','collab-admin.html']]){
 const html=(await readFile(source,'utf8')).replaceAll('href="./">Requests</a>','href="https://ogvhs.com/">Requests</a>').replaceAll('href="./about.html"','href="https://ogvhs.com/about.html"').replaceAll('?v=1','?v=aws-'+commit.slice(0,12)).replace('</body>',`<!-- OGVHS_AWS_COLLAB_BUILD ${commit} -->\n</body>`);
 await writeFile(dest+'/'+target,html);
}
await writeFile(dest+'/public/collab-config.json',JSON.stringify(config)+'\n');
await writeFile(dest+'/robots.txt','User-agent: *\nDisallow: /\n');
console.log('Built AWS Collab from '+commit);
