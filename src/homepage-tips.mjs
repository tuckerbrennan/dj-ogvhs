import { paymentOptions } from './tip-options.mjs';
const container=document.getElementById('homepage-tip-options');
const feedback=document.getElementById('homepage-tip-feedback');
function control(option){
  const node=document.createElement(option.url?'a':'button');
  if(option.url){node.href=option.url;node.target='_blank';node.rel='noopener noreferrer';}
  else{node.type='button';node.disabled=!option.recipient;}
  const label=document.createElement('span');label.textContent=option.label;node.append(label);
  if(option.detail){const detail=document.createElement('small');detail.textContent=option.detail;node.append(detail);}
  node.setAttribute('aria-label',option.label+' '+(option.detail||'')+(option.url?' — opens in a new tab':' — copy recipient'));
  if(option.recipient){
    node.title=option.label==='Zelle'?'Copy the number and use Zelle in your bank app.':'Copy the email and paste it into PayPal’s Send screen.';
    node.addEventListener('click',async()=>{
      let copied=false;try{await navigator.clipboard.writeText(option.recipient);copied=true;}catch{}
      feedback.textContent=(copied?'Recipient copied. ':'')+(option.label==='Zelle'?'Open Zelle in your banking app and send to '+option.recipient+'.':'In PayPal, paste '+option.recipient+' as the recipient and choose an amount.');
    });
  }
  return node;
}
try{
  const response=await fetch('./public/tip-config.json',{cache:'no-store'});
  if(!response.ok)throw new Error('unavailable');
  container.replaceChildren(...paymentOptions(await response.json()).map(control));
}catch{feedback.textContent='Tip options are temporarily unavailable. Please try again shortly.';}
