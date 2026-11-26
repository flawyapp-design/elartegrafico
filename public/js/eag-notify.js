/* EAG Charts · Centro de avisos.
   Todo lo importante (alertas de precio, spikes, operaciones abiertas/cerradas, mensajes, conexión) pasa por aquí:
   - suena (sonidos generados en el navegador, uno por tipo), vibra en el celular,
   - muestra una tarjeta arriba a la derecha (con su ícono, título, detalle y acción),
   - si la pestaña está de fondo: notificación del sistema + el título de la pestaña parpadea,
   - queda en el historial (campana con número de no leídos).
   El usuario elige qué tipos avisan, con qué sonido y volumen, y puede poner "No molestar". */
(function(){
"use strict";
const LS="eag_notify_v1",LH="eag_notify_hist_v1";
const CATS=[["precio","🔔","Alertas de precio","campana",true],["spike","⚡","Spikes (Boom/Crash)","spike",true],["trade","💹","Mis operaciones (abrir, cerrar, SL, TP)","moneda",true],
  ["msg","💬","Mensajes y menciones","pop",true],["sistema","📡","Conexión y sistema","aviso",true]];
const CAT=Object.fromEntries(CATS.map(c=>[c[0],c]));
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cfg=()=>{let c={};try{c=JSON.parse(localStorage.getItem(LS)||"{}")||{}}catch(e){}c=Object.assign({on:true,vol:80,dnd:false,sys:true,cats:{}},c);
  CATS.forEach(([k,,,snd,on])=>{c.cats[k]=Object.assign({on,snd},c.cats[k]||{})});return c};
const saveCfg=c=>{try{localStorage.setItem(LS,JSON.stringify(c))}catch(e){}};
let HIST=[];try{HIST=JSON.parse(localStorage.getItem(LH)||"[]")||[]}catch(e){}
const saveH=()=>{try{localStorage.setItem(LH,JSON.stringify(HIST.slice(0,60)))}catch(e){}};

/* ---------- sonidos ---------- */
let ac=null;const actx=()=>{try{if(!ac){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;ac=new A()}if(ac.state==="suspended")ac.resume().catch(()=>{});return ac}catch(e){return null}};
["pointerdown","keydown","touchstart"].forEach(ev=>addEventListener(ev,()=>{const c=actx();c&&c.state!=="running"&&c.resume().catch(()=>{})},{passive:true,capture:true}));
const tone=(c,out,f,t0,dur,type,g0,f2)=>{const o=c.createOscillator(),g=c.createGain();o.type=type||"sine";o.frequency.setValueAtTime(f,t0);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t0+dur);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(g0||.6,t0+.012);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g);g.connect(out);o.start(t0);o.stop(t0+dur+.05)};
const LIB={
  campana:(c,o,t)=>{[[880,1.6,.55],[1760,1,.18],[2640,.6,.08]].forEach(([f,d,g])=>tone(c,o,f,t,d,"sine",g));[[880,1.6,.45],[1760,1,.14]].forEach(([f,d,g])=>tone(c,o,f,t+.45,d,"sine",g))},
  ding:(c,o,t)=>{tone(c,o,988,t,.35,"triangle",.6);tone(c,o,1319,t+.14,.6,"triangle",.6)},
  moneda:(c,o,t)=>{tone(c,o,988,t,.09,"square",.22);tone(c,o,1319,t+.08,.45,"square",.22)},
  exito:(c,o,t)=>{[523,659,784,1047].forEach((f,i)=>tone(c,o,f,t+i*.09,.35,"triangle",.45))},
  error:(c,o,t)=>{tone(c,o,330,t,.22,"sawtooth",.3);tone(c,o,247,t+.2,.4,"sawtooth",.3)},
  pop:(c,o,t)=>{tone(c,o,660,t,.12,"sine",.6,990);tone(c,o,1320,t+.07,.18,"sine",.35)},
  aviso:(c,o,t)=>{tone(c,o,740,t,.18,"triangle",.5);tone(c,o,554,t+.16,.3,"triangle",.5)},
  alarma:(c,o,t)=>{for(let k=0;k<6;k++)tone(c,o,k%2?660:880,t+k*.16,.15,"square",.26)},
  sirena:(c,o,t)=>{tone(c,o,600,t,.45,"sawtooth",.26,1400);tone(c,o,600,t+.5,.45,"sawtooth",.26,1400)},
  llamado:(c,o,t)=>{for(let k=0;k<3;k++){const b=t+k*.85;tone(c,o,523,b,.22,"square",.22);tone(c,o,659,b+.18,.22,"square",.22);tone(c,o,784,b+.36,.42,"square",.24);tone(c,o,1568,b+.36,.42,"sine",.18)}},
  spike:(c,o,t)=>{tone(c,o,140,t,.25,"sine",.9,60);tone(c,o,1568,t+.05,.5,"triangle",.5);tone(c,o,2093,t+.18,.6,"triangle",.45)}};
const SNDS=[["campana","Campana"],["ding","Ding"],["moneda","Moneda"],["exito","Éxito"],["error","Error"],["pop","Pop"],["aviso","Aviso"],["alarma","Alarma"],["sirena","Sirena"],["spike","Golpe + ping"],["llamado","Llamado (largo)"],["no","Sin sonido"]];
function play(k,vol){if(!k||k==="no"||!LIB[k])return;const c=actx();if(!c)return;const v=Math.max(0,Math.min(1,(vol==null?cfg().vol:vol)/100));if(!v)return;
  const g=c.createGain();g.gain.value=v;g.connect(c.destination);try{LIB[k](c,g,c.currentTime+.02)}catch(e){}}

/* ---------- tarjetas ---------- */
let stack=null;const STK=()=>{if(!stack||!stack.isConnected){stack=document.createElement("div");stack.className="ntf-stack";stack.setAttribute("aria-live","polite");document.body.appendChild(stack)}
  /* las tarjetas salen sobre el gráfico, sin tapar las barras de arriba */
  if(innerWidth>640){const g=document.querySelector("#grid");const t=g?g.getBoundingClientRect().top:56;stack.style.top=Math.max(8,t+8)+"px"}else stack.style.top="";return stack};
function card(n){const s=STK(),el=document.createElement("div");el.className="ntf ntf-"+n.cat+(n.tone?" t-"+n.tone:"");el.setAttribute("role",n.important?"alert":"status");
  el.innerHTML=`<span class="ntf-i">${n.icon||CAT[n.cat][1]}</span><div class="ntf-b"><b>${esc(n.title)}</b>${n.body?`<small>${esc(n.body)}</small>`:""}${n.act?`<button class="ntf-a">${esc(n.act.label)}</button>`:""}</div><button class="ntf-x" aria-label="Cerrar">✕</button>${n.sticky?"":`<i class="ntf-p" style="animation-duration:${n.ms}ms"></i>`}`;
  s.prepend(el);while(s.children.length>4)s.lastChild.remove();
  const close=()=>{if(!el.isConnected)return;el.classList.add("out");setTimeout(()=>el.remove(),260)};
  el.querySelector(".ntf-x").onclick=e=>{e.stopPropagation();close()};
  if(n.act){el.querySelector(".ntf-a").onclick=e=>{e.stopPropagation();try{n.act.fn()}catch(x){}close()}}
  el.onclick=()=>{if(n.act){try{n.act.fn()}catch(x){}}close()};
  let tm=n.sticky?null:setTimeout(close,n.ms);el.onmouseenter=()=>{clearTimeout(tm);el.classList.add("hold")};el.onmouseleave=()=>{el.classList.remove("hold");if(!n.sticky)tm=setTimeout(close,2500)}}

/* ---------- pestaña de fondo: título que parpadea + notificación del sistema ---------- */
let t0=document.title,flashT=null,pend=0;
function flash(txt){pend++;if(flashT)return;let k=0;t0=document.title.replace(/^\(\d+\)\s.*?·\s/,"");flashT=setInterval(()=>{k++;document.title=k%2?`(${pend}) ${txt} · ${t0}`:t0},1100)}
function unflash(){clearInterval(flashT);flashT=null;pend=0;document.title=t0}
addEventListener("focus",unflash);document.addEventListener("visibilitychange",()=>{if(!document.hidden)unflash()});
function sys(n){try{if(!("Notification" in window)||Notification.permission!=="granted")return;const o={body:n.body||"",tag:n.tag||("eag-"+n.cat),icon:"/assets/icon-192.png",badge:"/assets/badge-72.png",renotify:true,data:{url:location.href}};
  if(navigator.serviceWorker&&navigator.serviceWorker.controller)navigator.serviceWorker.ready.then(r=>r.showNotification(n.title,o)).catch(()=>{try{new Notification(n.title,o)}catch(e){}});else new Notification(n.title,o)}catch(e){}}

/* ---------- aviso ---------- */
const seen=new Map();
function notify(n){n=Object.assign({cat:"sistema",title:"",body:"",ms:6500},n||{});if(!CAT[n.cat])n.cat="sistema";
  if(n.key){const t=seen.get(n.key);if(t&&Date.now()-t<(n.dedupe||15000))return;seen.set(n.key,Date.now())}
  const c=cfg(),cc=c.cats[n.cat];
  const h={id:Date.now()+Math.random(),cat:n.cat,icon:n.icon||CAT[n.cat][1],title:n.title,body:n.body||"",t:Date.now(),read:false,tone:n.tone||""};HIST.unshift(h);HIST=HIST.slice(0,60);saveH();paintBell();
  if(!c.on||!cc.on)return;
  const quiet=c.dnd&&!n.important;
  if(!quiet&&n.sound!==false)play(n.sound||cc.snd,c.vol);
  if(n.card!==false)card(Object.assign({},n,{icon:h.icon}));
  if(!quiet&&n.important)try{navigator.vibrate&&navigator.vibrate(n.vibrate||[120,60,120])}catch(e){}
  if(document.hidden){flash((n.icon||CAT[n.cat][1])+" "+n.title);if(c.sys&&n.sys!==false)sys(n)}}

/* ---------- campana: historial y ajustes ---------- */
let bell=null,panel=null,ptab="hist";
const unread=()=>HIST.filter(h=>!h.read).length;
function paintBell(){if(!bell)return;const n=unread();const b=bell.querySelector(".ntb-n");b.textContent=n>99?"99+":n||"";b.hidden=!n;bell.classList.toggle("dnd",cfg().dnd)}
const ago=t=>{const s=Math.round((Date.now()-t)/1000);return s<60?"ahora":s<3600?`hace ${Math.floor(s/60)} min`:s<86400?`hace ${Math.floor(s/3600)} h`:new Date(t).toLocaleDateString("es-CO",{day:"numeric",month:"short"})};
function openPanel(){if(panel){panel.remove();panel=null;return}if(stack)stack.innerHTML="";panel=document.createElement("div");panel.className="ntp";panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Avisos");document.body.appendChild(panel);
  const r=bell.getBoundingClientRect();panel.style.top=Math.min(innerHeight-120,r.bottom+8)+"px";panel.style.right=Math.max(8,innerWidth-r.right-8)+"px";paintPanel();
  setTimeout(()=>addEventListener("pointerdown",function f(e){if(!panel){removeEventListener("pointerdown",f,true);return}if(!panel.contains(e.target)&&!bell.contains(e.target)){panel.remove();panel=null;removeEventListener("pointerdown",f,true)}},true),0)}
function paintPanel(){if(!panel)return;const c=cfg();
  const perm=("Notification" in window)?Notification.permission:"no";
  panel.innerHTML=`<div class="ntp-h"><b>Avisos</b><div class="ntp-tabs"><button data-t="hist" class="${ptab==="hist"?"on":""}">Recientes</button><button data-t="cfg" class="${ptab==="cfg"?"on":""}">Ajustes</button></div><button class="ntp-x" aria-label="Cerrar">✕</button></div>`+
  (ptab==="hist"?`<div class="ntp-list">${HIST.length?HIST.map(h=>`<div class="ntp-it${h.read?"":" new"}${h.tone?" t-"+h.tone:""}"><span>${h.icon}</span><div><b>${esc(h.title)}</b>${h.body?`<small>${esc(h.body)}</small>`:""}<i>${ago(h.t)}</i></div></div>`).join(""):`<p class="ntp-empty">Aquí verás todo lo importante: alertas, spikes, tus operaciones, mensajes y la conexión.</p>`}</div>
    <div class="ntp-f"><button data-read>Marcar todo como leído</button><button data-clear>Borrar historial</button></div>`
  :`<div class="ntp-cfg">
    <label class="ntp-row"><span><b>Avisos activados</b><small>Sonido y tarjeta cuando pasa algo importante</small></span><input type="checkbox" class="ntsw" data-k="on" ${c.on?"checked":""}></label>
    <label class="ntp-row"><span><b>🌙 No molestar</b><small>Sin sonido; solo suenan las alertas de precio y tus operaciones</small></span><input type="checkbox" class="ntsw" data-k="dnd" ${c.dnd?"checked":""}></label>
    <label class="ntp-vol"><span>Volumen</span><input type="range" min="0" max="100" step="5" value="${c.vol}" data-vol><i>${c.vol}%</i></label>
    ${CATS.map(([k,ic,name])=>`<div class="ntp-cat"><label class="ntp-row"><span><b>${ic} ${name}</b></span><input type="checkbox" class="ntsw" data-cat="${k}" ${c.cats[k].on?"checked":""}></label>
      <div class="ntp-snd"><select data-snd="${k}" aria-label="Sonido de ${name}">${SNDS.map(([v,t])=>`<option value="${v}" ${c.cats[k].snd===v?"selected":""}>${t}</option>`).join("")}</select><button data-try="${k}" title="Probar">▶</button></div></div>`).join("")}
    <div class="ntp-row ntp-sys"><span><b>Avisos con la pestaña cerrada o de fondo</b><small>${perm==="granted"?"Activados en este navegador":perm==="denied"?"Bloqueados: actívalos en el candado de la barra de direcciones":perm==="no"?"Tu navegador no los permite":"Te llegan aunque estés en otra pestaña o app"}</small></span>${perm==="default"?`<button data-perm>Activar</button>`:`<input type="checkbox" class="ntsw" data-k="sys" ${c.sys?"checked":""} ${perm!=="granted"?"disabled":""}>`}</div>
    <button class="ntp-test" data-test>Probar un aviso</button></div>`);
  const q=s=>panel.querySelector(s),qa=s=>panel.querySelectorAll(s);
  q(".ntp-x").onclick=()=>{panel.remove();panel=null};
  qa("[data-t]").forEach(b=>b.onclick=()=>{ptab=b.dataset.t;paintPanel()});
  if(ptab==="hist"){HIST.forEach(h=>h.read=true);saveH();setTimeout(paintBell,600);
    q("[data-read]").onclick=()=>{HIST.forEach(h=>h.read=true);saveH();paintBell();paintPanel()};
    q("[data-clear]").onclick=()=>{HIST=[];saveH();paintBell();paintPanel()};return}
  qa("[data-k]").forEach(i=>i.onchange=()=>{const c2=cfg();c2[i.dataset.k]=i.checked;saveCfg(c2);paintBell()});
  qa("[data-cat]").forEach(i=>i.onchange=()=>{const c2=cfg();c2.cats[i.dataset.cat].on=i.checked;saveCfg(c2)});
  qa("[data-snd]").forEach(s=>s.onchange=()=>{const c2=cfg();c2.cats[s.dataset.snd].snd=s.value;saveCfg(c2);play(s.value)});
  qa("[data-try]").forEach(b=>b.onclick=()=>play(cfg().cats[b.dataset.try].snd));
  const v=q("[data-vol]");v.oninput=()=>{const c2=cfg();c2.vol=+v.value;saveCfg(c2);v.nextElementSibling.textContent=v.value+"%"};v.onchange=()=>play("ding");
  const pb=q("[data-perm]");pb&&(pb.onclick=async()=>{try{await Notification.requestPermission()}catch(e){}paintPanel()});
  q("[data-test]").onclick=()=>notify({cat:"precio",title:"Así se ve un aviso",body:"Boom 1000 Index llegó a tu nivel 10,250.000",important:true})}

window.EAGN={notify,play,SNDS,cfg,
  /* el botón de la campana en la barra superior */
  mount(btn){bell=btn;if(!btn)return;btn.innerHTML=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/></svg><b class="ntb-n" hidden></b>`;
    btn.onclick=e=>{e.stopPropagation();openPanel()};paintBell()},
  /* para la tecla de "No molestar" o pruebas */
  setDnd(v){const c=cfg();c.dnd=!!v;saveCfg(c);paintBell()},history:()=>HIST.slice()};
})();
