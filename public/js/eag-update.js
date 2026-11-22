/* © El Arte Gráfico. Todos los derechos reservados. */
/* "Actualizar la plataforma para todos": el admin cambia site_settings.reloadAt (Admin → EAG Charts).
   Cada página abierta (web y EAG Charts) revisa ese valor cada 2 minutos y al volver a la pestaña.
   Si cambió desde que la abriste, avisa y recarga sola a los 10 s (no depende del reloj de cada computador). */
(function(){
"use strict";
const API=window.AGAPI;if(!API||!API.site)return;
let seen=null,busy=false,bar=null,last=0;
const busyNow=()=>{try{const s=window.EAGSocial&&window.EAGSocial.state();return!!(s&&s.call)}catch(e){return false}};
async function check(force){if(busy||(!force&&(document.hidden||Date.now()-last<20000)))return;last=Date.now();
  let s;try{s=await API.site()}catch(e){return}const v=(s&&s.reloadAt)||"";
  if(seen===null){seen=v;return}
  if(v&&v!==seen){seen=v;prompt(s.reloadMsg)}}
function prompt(msg){if(bar)return;bar=document.createElement("div");
  bar.setAttribute("role","status");
  bar.style.cssText="position:fixed;z-index:2147483000;left:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 20px);"+
    "background:#14161c;color:#ececee;border:1px solid #e2b55c;border-radius:14px;padding:10px 12px 10px 16px;box-shadow:0 16px 44px rgba(0,0,0,.55);font:600 13.5px/1.4 Inter,system-ui,sans-serif";
  const call=busyNow();let n=call?0:10;
  const txt=()=>`🔄 <span>${msg?String(msg).replace(/[<>&]/g,""):"Hay una versión nueva de la plataforma."} ${call?"Actualiza cuando termines tu llamada.":`Actualizando en <b>${n}</b> s…`}</span>`;
  const paint=()=>{bar.innerHTML=txt()+`<button data-go style="background:#e2b55c;color:#0b0c0e;border:0;border-radius:9px;padding:6px 12px;font-weight:700;cursor:pointer">Actualizar ya</button><button data-later style="background:none;border:1px solid #34373f;color:#c9ccd3;border-radius:9px;padding:6px 10px;cursor:pointer">En 2 min</button>`;
    bar.querySelector("[data-go]").onclick=go;bar.querySelector("[data-later]").onclick=()=>{clearInterval(t);bar.remove();bar=null;setTimeout(()=>prompt(msg),120000)}};
  document.body.appendChild(bar);paint();
  const t=setInterval(()=>{if(call)return;n--;if(n<=0){clearInterval(t);go()}else{const b=bar&&bar.querySelector("b");if(b)b.textContent=n}},1000)}
async function go(){busy=true;try{const r=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();r&&await r.update()}catch(e){}
  try{if(window.caches){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}}catch(e){}
  location.reload()}
check();setInterval(check,120000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)check()});
window.EAGUpdate={check,now:go,mark:v=>{seen=v||""}};
})();
