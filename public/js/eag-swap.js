/* =====================================================================
   EAG Charts · Aviso de swap
   Te avisa unos minutos antes de la hora del swap para que cierres a tiempo.
   - Modo "ny": 5:00 p. m. de Nueva York (estándar de forex; el horario de
     verano lo ajusta solo).
   - Modo "manual": la hora y la zona horaria de tu broker.
   Ajustes en SAVE.swap. Movible, minimizable y personalizable.
   ===================================================================== */
(function(){
"use strict";
let X=null,T=0,pop=null,chip=null;
const TZS=[["America/New_York","Nueva York"],["America/Bogota","Bogotá (Colombia)"],["UTC","UTC / GMT"],["Etc/GMT-2","Servidor GMT+2"],["Etc/GMT-3","Servidor GMT+3"],["Europe/London","Londres"],["Europe/Madrid","Madrid"],["America/Mexico_City","Ciudad de México"],["America/Argentina/Buenos_Aires","Buenos Aires"],["America/Lima","Lima"],["America/Caracas","Caracas"],["America/Santiago","Santiago"]];
const DN=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DEF={on:false,mode:"ny",time:"00:00",tz:"Etc/GMT-2",lead:5,days:[1,2,3,4,5],chip:true,snd:true};
/* se completa en el mismo objeto (no se reemplaza) para que los cambios del panel no se pierdan */
const cfg=()=>{const S=X.SAVE;if(!S.swap||typeof S.swap!=="object")S.swap={};for(const k in DEF)if(S.swap[k]===undefined)S.swap[k]=Array.isArray(DEF[k])?DEF[k].slice():DEF[k];return S.swap};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const myTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){return"America/Bogota"}};

/* hora local de una zona: partes y diferencia con UTC */
function parts(d,tz){const f=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",weekday:"short"});
  const o={};f.formatToParts(d).forEach(p=>o[p.type]=p.value);const wd={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[o.weekday];
  return{y:+o.year,m:+o.month,d:+o.day,h:(+o.hour)%24,mi:+o.minute,s:+o.second,wd}}
function offMin(d,tz){const p=parts(d,tz);return(Date.UTC(p.y,p.m-1,p.d,p.h,p.mi,p.s)-Math.floor(d.getTime()/1000)*1000)/60000}
/* el instante UTC en que, en la zona tz, son y-m-d hh:mm */
function zoned(y,m,d,hh,mm,tz){let t=Date.UTC(y,m-1,d,hh,mm);for(let i=0;i<2;i++)t=Date.UTC(y,m-1,d,hh,mm)-offMin(new Date(t),tz)*60000;return t}
const swapTz=()=>cfg().mode==="ny"?"America/New_York":cfg().tz;
const swapTime=()=>cfg().mode==="ny"?"17:00":cfg().time;
/* próximo swap (en ms) a partir de ahora */
function nextSwap(from){const c=cfg(),tz=swapTz(),[hh,mm]=swapTime().split(":").map(Number),now=from||Date.now();const p0=parts(new Date(now),tz);
  for(let k=0;k<9;k++){const base=new Date(Date.UTC(p0.y,p0.m-1,p0.d+k,12));const y=base.getUTCFullYear(),m=base.getUTCMonth()+1,d=base.getUTCDate();
    const t=zoned(y,m,d,hh||0,mm||0,tz),wd=parts(new Date(t),myTz()).wd;if(t>now&&(c.days||[]).includes(wd))return t}
  return null}
const fmtLocal=t=>new Date(t).toLocaleString("es-CO",{weekday:"short",hour:"numeric",minute:"2-digit"});
const left=ms=>{const m=Math.max(0,Math.round(ms/60000));if(m<60)return m+" min";const h=Math.floor(m/60),r=m%60;return h<24?`${h} h ${r?r+" min":""}`.trim():`${Math.floor(h/24)} d ${h%24} h`};

/* posiciones abiertas en MT5 (si está conectado) */
function mt5Open(){try{const s=window.EAGMT5B&&window.EAGMT5B._test&&window.EAGMT5B._test.state();return s&&Array.isArray(s.positions)?s.positions.length:null}catch(e){return null}}

/* el aviso */
let fired={};
function check(){const c=cfg();paintChip();if(!c.on)return;const t=nextSwap();if(!t)return;const ms=t-Date.now(),lead=(+c.lead||5)*60000;
  if(ms<=lead&&ms>0&&!fired[t]){fired[t]=1;alertSwap(t)}}
function alertSwap(t){const c=cfg(),n=mt5Open(),mins=Math.max(1,Math.round((t-Date.now())/60000));
  const body=`El swap se cobra a las ${new Date(t).toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit"})} (tu hora)${n?` · tienes ${n} posición${n===1?"":"es"} abierta${n===1?"":"s"} en MT5`:""}.`;
  try{window.EAGN&&window.EAGN.notify({cat:"sistema",icon:"⏰",title:`Swap en ${mins} min`,body,important:true,sticky:true,sound:c.snd?"llamado":false,vibrate:[500,150,500,150,900],key:"swap-"+t,sys:true,card:false})}catch(e){}
  try{if(window.EAGSocial&&window.EAGSocial.invite)window.EAGSocial.invite({kind:"todos",kicker:"⏰ Aviso de swap",title:`El swap se cobra en ${mins} minuto${mins===1?"":"s"}`,sub:body,key:"swap-"+t,times:4,sound:false,no:false,yes:"Entendido",
      hint:n?"Si no quieres pagar el swap, cierra tus operaciones antes de esa hora.":"Si tienes operaciones abiertas y no quieres pagar el swap, ciérralas antes de esa hora."});else X.toast("⏰ "+body)}catch(e){}}

/* contador pequeño (opcional) */
function paintChip(){const c=cfg();if(!c.on||!c.chip){if(chip){chip.remove();chip=null}return}const t=nextSwap();if(!t)return;
  if(!chip){chip=document.createElement("button");chip.className="swp-chip";chip.type="button";chip.title="Aviso de swap: toca para cambiarlo";chip.onclick=()=>openPop(chip);document.body.appendChild(chip)}
  const ms=t-Date.now(),soon=ms<=(+c.lead||5)*60000;chip.classList.toggle("soon",soon);chip.innerHTML=`<span aria-hidden="true">⏰</span> Swap en <b>${left(ms)}</b>`}

/* panel de ajustes */
function openPop(anchor){if(pop){pop.remove();pop=null;return}const c=cfg();pop=document.createElement("div");pop.className="swp-pop";pop.setAttribute("role","dialog");pop.setAttribute("aria-label","Aviso de swap");
  const draw=()=>{const t=nextSwap(),my=myTz();
    pop.innerHTML=`<div class="swp-h"><b>⏰ Aviso de swap</b><button class="sx" data-x aria-label="Cerrar">✕</button></div>
      <label class="swp-sw"><input type="checkbox" data-on ${c.on?"checked":""}><span>Avisarme antes del swap</span></label>
      <div class="swp-l">Hora del swap</div>
      <div class="swp-m"><button class="${c.mode==="ny"?"on":""}" data-mode="ny"><b>Nueva York 5:00 p. m.</b><small>Estándar de forex</small></button><button class="${c.mode==="manual"?"on":""}" data-mode="manual"><b>Hora manual</b><small>Para otro broker</small></button></div>
      ${c.mode==="manual"?`<div class="swp-row"><label>Hora<input type="time" data-time value="${esc(c.time)}"></label><label>Zona horaria<select data-tz>${TZS.map(([z,n])=>`<option value="${z}"${c.tz===z?" selected":""}>${esc(n)}</option>`).join("")}${TZS.some(x=>x[0]===c.tz)?"":`<option value="${esc(c.tz)}" selected>${esc(c.tz)}</option>`}</select></label></div>
        <small class="swp-n">Mira en tu broker a qué hora cobra el swap y en qué zona horaria está su servidor (muchos usan GMT+2 o GMT+3).</small>`:""}
      <div class="swp-row"><label>Avisarme<select data-lead>${[1,2,3,5,10,15,30].map(n=>`<option value="${n}"${+c.lead===n?" selected":""}>${n} min antes</option>`).join("")}</select></label></div>
      <div class="swp-l">Días (en tu hora)</div><div class="swp-d">${[1,2,3,4,5,6,0].map(d=>`<button class="${(c.days||[]).includes(d)?"on":""}" data-day="${d}" aria-pressed="${(c.days||[]).includes(d)}">${DN[d]}</button>`).join("")}</div>
      <label class="swp-ck"><input type="checkbox" data-chip ${c.chip?"checked":""}> Mostrar el contador en pantalla</label>
      <label class="swp-ck"><input type="checkbox" data-snd ${c.snd?"checked":""}> Con sonido</label>
      <div class="swp-res">${t?`Próximo swap: <b>${esc(fmtLocal(t))}</b> en tu hora (${esc(my)}) · faltan ${left(t-Date.now())}`:"Elige al menos un día"}</div>
      <div class="swp-b"><button class="btn sm" data-test>Probar el aviso</button></div>`;
    const sv=()=>{X.save();paintChip();draw()};
    pop.querySelector("[data-x]").onclick=()=>{pop.remove();pop=null};
    pop.querySelector("[data-on]").onchange=e=>{c.on=e.target.checked;if(c.on&&window.Notification&&Notification.permission==="default")try{Notification.requestPermission()}catch(x){}sv()};
    pop.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{c.mode=b.dataset.mode;sv()});
    const tm=pop.querySelector("[data-time]");tm&&(tm.onchange=()=>{if(/^\d\d:\d\d$/.test(tm.value)){c.time=tm.value;sv()}});
    const tz=pop.querySelector("[data-tz]");tz&&(tz.onchange=()=>{c.tz=tz.value;sv()});
    pop.querySelector("[data-lead]").onchange=e=>{c.lead=+e.target.value;fired={};sv()};
    pop.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{const d=+b.dataset.day,s=new Set(c.days||[]);s.has(d)?s.delete(d):s.add(d);c.days=[...s].sort();sv()});
    pop.querySelector("[data-chip]").onchange=e=>{c.chip=e.target.checked;sv()};
    pop.querySelector("[data-snd]").onchange=e=>{c.snd=e.target.checked;sv()};
    pop.querySelector("[data-test]").onclick=()=>{pop.remove();pop=null;alertSwap(Date.now()+(+c.lead||5)*60000)};
    place()};
  const place=()=>{if(!pop)return;const r=anchor&&anchor.getBoundingClientRect?anchor.getBoundingClientRect():{left:innerWidth/2,right:innerWidth/2,bottom:80,top:80};const w=pop.offsetWidth,h=pop.offsetHeight;
    pop.style.left=Math.max(6,Math.min(innerWidth-w-6,r.right-w))+"px";pop.style.top=Math.max(6,Math.min(innerHeight-h-6,r.bottom+6))+"px"};
  document.body.appendChild(pop);draw();
  setTimeout(()=>addEventListener("pointerdown",function f(e){if(!pop){removeEventListener("pointerdown",f,true);return}if(!pop.contains(e.target)&&e.target!==anchor&&!(chip&&chip.contains(e.target))){pop.remove();pop=null;removeEventListener("pointerdown",f,true)}},true),0)}

window.EAGSwap={init(o){X=o;cfg();clearInterval(T);T=setInterval(check,15000);setTimeout(check,1500)},open:openPop,next:nextSwap,_alert:alertSwap,_zoned:zoned};
})();
