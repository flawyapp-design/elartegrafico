/* © El Arte Gráfico. Todos los derechos reservados. */
/* EAG Charts · Modo Clase (en vivo) y Zonas del profe.
   - El profe (admin) transmite: lo que dibuja en sus gráficos aparece al instante en los gráficos de los alumnos que activen el Modo Clase.
   - El profe publica su análisis por mercado ("Zonas del profe"): los alumnos Oro/Diamond lo ven sobre su gráfico y lo pueden copiar.
   Los dibujos del profe son una capa aparte: no se mezclan con los del alumno, no se pueden mover y no se guardan (salvo que los copie). */
(function(){
"use strict";
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const STALE=15*60*1000; /* si el profe cierra la página sin apagar, la clase se da por terminada a los 15 min */
let viewers={},vT=0,lastV="";
let rtSend=null,X=null,live=null,zones={},rt=null,joined=false,txOn=false,txT=0,lastTx="",lastFollow="",polT=0,hb=0,tokT=0,keepT=0,tick=0,shown={};

const cfg=()=>{X.SAVE.clase=Object.assign({on:false,follow:true,zones:true},X.SAVE.clase||{});return X.SAVE.clase};
const onAir=()=>!!(live&&live.on_air&&live.updated_at&&Date.now()-new Date(live.updated_at).getTime()<STALE);
const canZones=()=>X.isAdmin()||X.rank()>=3||!!X.trialPro();
const ago=t=>{const m=Math.round((Date.now()-new Date(t).getTime())/60000);if(m<1)return"hace un momento";if(m<60)return`hace ${m} min`;const h=Math.round(m/60);if(h<24)return`hace ${h} h`;const d=Math.round(h/24);return`hace ${d} día${d>1?"s":""}`};

/* ============ tiempo real (Supabase Realtime, sin librerías) ============ */
function connect(){if(!X.API.rt||rt)return;let ref=0;const topic="realtime:eag-clase";
  let ws;try{ws=new WebSocket(X.API.rt.url)}catch(e){return}rt=ws;joined=false;
  const send=(event,payload,t)=>{try{ws.readyState===1&&ws.send(JSON.stringify({topic:t||topic,event,payload,ref:String(++ref)}))}catch(e){}};
  rtSend=send;
  ws.onopen=async()=>{const tok=await X.API.accessToken().catch(()=>null);
    send("phx_join",{config:{broadcast:{ack:false,self:false},presence:{key:""},private:false,
      postgres_changes:[{event:"*",schema:"public",table:"live_class"},{event:"*",schema:"public",table:"teacher_zones"}]},access_token:tok||undefined});
    clearInterval(hb);hb=setInterval(()=>send("heartbeat",{},"phoenix"),25000);
    clearInterval(tokT);tokT=setInterval(async()=>{const t=await X.API.accessToken().catch(()=>null);if(t)send("access_token",{access_token:t})},10*60000)};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}if(m.topic!==topic)return;
    if(m.event==="phx_reply"&&m.payload&&m.payload.status==="ok"&&m.payload.response&&m.payload.response.postgres_changes){joined=true;refresh()}
    else if(m.event==="system"&&m.payload&&m.payload.status==="error")joined=false;
    /* láser del profe: solo se muestra si de verdad está en vivo y tienes el Modo Clase activo */
    else if(m.event==="broadcast"&&m.payload&&m.payload.event==="laser"){const q=m.payload.payload||{};
      if(!X.isAdmin()&&cfg().on&&onAir()&&q.sym){X.panes().forEach(p=>{try{if(p.kc.getSymbol().ticker===q.sym)p.kc.laserRemote(q)}catch(e){}});try{window.__eagMiniLaser&&window.__eagMiniLaser(q)}catch(e){}}}
    else if(m.event==="broadcast"&&m.payload&&(m.payload.event==="viewer"||m.payload.event==="viewer-bye")){const q=m.payload.payload||{};
      if(X.isAdmin()&&q.id){if(m.payload.event==="viewer-bye")delete viewers[q.id];else viewers[q.id]=Object.assign(q,{at:Date.now()});paintViewers()}}
    else if(m.event==="postgres_changes"){const d=(m.payload&&m.payload.data)||{},tb=d.table,ty=d.eventType||d.type,rec=d.new||d.record,old=d.old||d.old_record;
      if(tb==="live_class"&&rec){const was=onAir();live=rec;liveChanged(was)}
      else if(tb==="teacher_zones"){if(ty==="DELETE"){if(old&&old.sym)delete zones[old.sym]}else if(rec&&rec.sym){const nw=!zones[rec.sym]||zones[rec.sym].updated_at!==rec.updated_at;zones[rec.sym]=rec;
          if(nw&&!X.isAdmin()&&cfg().zones&&canZones())X.toast(`📌 El profe actualizó sus zonas en <b>${esc(rec.sym_name||rec.sym)}</b>`)}apply();paintPanel()}}};
  ws.onclose=()=>{rtSend=null;clearInterval(hb);clearInterval(tokT);joined=false;rt=null;setTimeout(()=>{if(needRt())connect()},4000+Math.random()*4000)};
  ws.onerror=()=>{try{ws.close()}catch(e){}}}
/* conexión en tiempo real solo para quien la usa (Modo Clase activo, zonas con plan, o el profe) */
const needRt=()=>cfg().on||txOn||X.isAdmin()||(cfg().zones&&canZones());

/* si el tiempo real no está disponible, se revisa cada pocos segundos (solo con el Modo Clase activo) */
async function refresh(){try{const was=onAir();const r=await X.API.liveGet();if(r){live=r;liveChanged(was,true)}}catch(e){}
  if(canZones())try{const L=await X.API.zonesList();zones={};(L||[]).forEach(z=>zones[z.sym]=z)}catch(e){}
  apply();paintPanel()}
function poll(){clearTimeout(polT);polT=setTimeout(async()=>{tick++;if(!joined&&!document.hidden){if(!X.isAdmin()&&(cfg().on||tick%12===0)){try{const was=onAir(),r=await X.API.liveGet();if(r){live=r;liveChanged(was)}}catch(e){}}
      if(tick%12===0&&canZones())try{const L=await X.API.zonesList();zones={};(L||[]).forEach(z=>zones[z.sym]=z);apply()}catch(e){}}poll()},5000)}

/* ============ alumno: mostrar lo del profe ============ */
function liveChanged(was,quiet){const now=onAir();paintBtn();if(now!==was)setTimeout(viewerBeat,1500);
  if(!X.isAdmin()){if(now&&!was&&!quiet)X.toast(cfg().on?"🔴 <b>El profe empezó la clase en vivo.</b> Sus dibujos aparecen en tu gráfico.":"🔴 <b>El profe está en vivo.</b> Activa el <b>Modo Clase</b> para ver sus dibujos en tu gráfico.");
    if(now&&cfg().on&&cfg().follow)followProfe()}
  apply();paintBanner();paintPanel()}
function followProfe(force){if(!live||!live.sym)return;const k=live.sym+"|"+(live.tf||"");if(!force&&k===lastFollow)return;lastFollow=k;X.follow(live.sym,live.tf)}
function apply(){const c=cfg(),air=onAir();X.panes().forEach(p=>{let tk;try{tk=p.kc.getSymbol().ticker}catch(e){return}const L={};
    if(air&&c.on&&!X.isAdmin()&&live.boards&&Array.isArray(live.boards[tk]))L.live=live.boards[tk];
    if(c.zones&&zones[tk]&&canZones()&&!(X.isAdmin()&&!c.adminZones)){const seen=new Set((L.live||[]).map(d=>JSON.stringify(d)));L.zones=(zones[tk].drawings||[]).filter(d=>!seen.has(JSON.stringify(d)))}
    const key=tk+":"+JSON.stringify(L);if(p.__gk===key)return;p.__gk=key;try{p.kc.setGuest(L)}catch(e){}});
  paintBanner()}
function setOn(v){const c=cfg();c.on=!!v;X.save();setTimeout(viewerBeat,800);if(v){connect();if(!joined)refresh();if(onAir()&&c.follow)followProfe(true)}apply();paintBtn();paintBanner();paintPanel()}

function paintBtn(){const b=X.btn;if(!b)return;const air=onAir();b.classList.toggle("air",air&&!X.isAdmin());b.classList.toggle("tx",txOn);b.classList.toggle("on",cfg().on&&!X.isAdmin());
  b.title=X.isAdmin()?(txOn?"Estás transmitiendo la clase":"Modo Clase: transmitir en vivo y publicar zonas"):air?"El profe está en vivo: toca para ver sus dibujos":"Modo Clase y Zonas del profe"}
let ban=null;
function paintBanner(){const c=cfg(),show=!X.isAdmin()&&c.on&&onAir();
  if(!show){if(ban){ban.remove();ban=null}return}
  if(!ban){ban=document.createElement("div");ban.className="clban";X.host.appendChild(ban)}
  const tk=live.sym,mine=X.panes().some(p=>{try{return p.kc.getSymbol().ticker===tk}catch(e){return false}});
  const h=`<span class="cl-dot"></span><b>EN VIVO</b><span class="cl-t">${esc(live.title||"Clase con el profe")} · ${esc(live.sym_name||tk||"")}${live.tf?" · "+esc(live.tf):""}</span>
    ${mine?"":`<button data-cb="go">Ir a ${esc(live.sym_name||tk)}</button>`}
    <label class="cl-f"><input type="checkbox" data-cb="fol" ${c.follow?"checked":""}> Seguir al profe</label>
    <button data-cb="copy" title="Copiar los dibujos del profe a los tuyos (en este mercado)">Copiar</button>${window.EAGReplay?`<button data-cb="rp" title="Estudiar en replay con los dibujos del profe">⏪ Replay</button>`:""}<button data-cb="x" class="cl-x" title="Salir del Modo Clase">×</button>`;
  if(ban.__h!==h){ban.__h=h;ban.innerHTML=h;
    ban.querySelector('[data-cb="fol"]').onchange=e=>{c.follow=e.target.checked;X.save();if(c.follow)followProfe(true)};
    const g=ban.querySelector('[data-cb="go"]');g&&(g.onclick=()=>followProfe(true));
    ban.querySelector('[data-cb="copy"]').onclick=()=>copyFrom((live.boards||{})[tk]||[],tk);
    const rb=ban.querySelector('[data-cb="rp"]');rb&&(rb.onclick=()=>{c.follow=false;X.save();window.EAGReplay.quick({})});
    ban.querySelector('[data-cb="x"]').onclick=()=>{setOn(false);X.toast("Saliste del Modo Clase. Actívalo cuando quieras con el botón <b>Clase</b>.")}}}
function copyFrom(arr,tk){const p=X.panes().find(q=>{try{return q.kc.getSymbol().ticker===tk}catch(e){return false}});
  if(!p){X.follow(tk);setTimeout(()=>copyFrom(arr,tk),900);return}
  const n=p.kc.importDrawings(arr);X.toast(n?`Se copiaron <b>${n}</b> dibujo${n>1?"s":""} del profe a los tuyos. Puedes deshacerlo con ↶ o Ctrl + Z.`:"No hay dibujos del profe para copiar en este mercado.")}

/* ============ alumno: avisarle al profe que lo está siguiendo (cada 8 s mientras el Modo Clase está activo y el profe en vivo) ============ */
function me(){const u=X.API.user&&X.API.user(),p=(X.API.profile&&X.API.profile())||{};return u?{id:u.id,name:p.username||"Alumno",av:p.avatar_url||null}:null}
/* sin tiempo real (modo local de pruebas): se usa un canal entre pestañas */
let vbc=null;try{vbc=new BroadcastChannel("eag-clase-local")}catch(e){}
const vSend=(ev,pl)=>{if(rtSend)rtSend("broadcast",{type:"broadcast",event:ev,payload:pl});else if(vbc&&!(X.API&&X.API.rt))vbc.postMessage({ev,pl})};
if(vbc)vbc.onmessage=e=>{const d=e.data||{};if(!X||!X.isAdmin()||!d.pl||!d.pl.id)return;if(d.ev==="viewer-bye")delete viewers[d.pl.id];else viewers[d.pl.id]=Object.assign(d.pl,{at:Date.now()});paintViewers()};
function viewerBeat(){if(X.isAdmin()||(!rtSend&&!vbc))return;const m=me();if(!m)return;const on=cfg().on&&onAir();
  if(!on){if(lastV){vSend("viewer-bye",{id:m.id});lastV=""}return}
  let sym=null,sn=null,tf=null;try{const p=X.panes()[X.active()],s2=p.kc.getSymbol();sym=s2.ticker;sn=s2.name||s2.shortName||s2.ticker;tf=p.kc.getPeriod().text}catch(e){}
  const pl={id:m.id,name:m.name,av:m.av,sym,sym_name:sn,tf,follow:!!cfg().follow,hidden:document.hidden};lastV=JSON.stringify(pl);
  vSend("viewer",pl)}
/* ============ profe: quién lo está siguiendo ============ */
const vList=()=>Object.values(viewers).filter(v=>Date.now()-v.at<25000).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
function vHtml(){const L=vList(),tk=live&&live.sym;
  if(!L.length)return`<p class="cl-help">${txOn?"Todavía nadie tiene el Modo Clase activo. Cuando un alumno lo active, aparece aquí.":"Cuando estés en vivo, aquí ves quién te está siguiendo."}</p>`;
  return`<div class="cl-vl">${L.map(v=>`<div class="cl-v"><span class="cl-va">${v.av?`<img src="${esc(v.av)}" alt="">`:esc(String(v.name||"?").charAt(0).toUpperCase())}</span>
    <div class="cl-vt"><b>${esc(v.name)}</b><small>${v.hidden?"Pestaña en segundo plano · ":""}${v.sym===tk?"Viendo lo mismo que tú":"En "+esc(v.sym_name||v.sym||"otro mercado")}${v.tf?" · "+esc(v.tf):""}</small></div>
    <button data-vdm="${esc(v.id)}" data-vn="${esc(v.name)}" title="Escribirle por el chat">💬</button></div>`).join("")}</div>`}
function paintViewers(){const n=vList().length;const b=X.btn;if(b){let e=b.querySelector(".cl-vc");if(X.isAdmin()&&n){if(!e){e=document.createElement("span");e.className="cl-vc";b.appendChild(e)}e.textContent=n}else if(e)e.remove()}
  if(!panel)return;const box=panel.querySelector("[data-viewers]");if(!box)return;const h=vHtml();if(box.__h===h)return;box.__h=h;box.innerHTML=h;
  const c=panel.querySelector("[data-vcount]");c&&(c.textContent=n?"("+n+")":"");
  box.querySelectorAll("[data-vdm]").forEach(b2=>b2.onclick=()=>{if(window.EAGSocial)window.EAGSocial.dm(b2.dataset.vdm,b2.dataset.vn);else X.toast("El chat no está disponible.")})}

/* ============ profe: transmitir ============ */
function txPayload(){const boards={};let a=null;X.panes().forEach((p,i)=>{try{const s=p.kc.getSymbol();boards[s.ticker]=p.kc.drawings();if(i===X.active())a={sym:s.ticker,name:s.name||s.shortName||s.ticker,tf:p.kc.getPeriod().text}}catch(e){}});
  a=a||{};return{on_air:true,sym:a.sym||null,sym_name:a.name||null,tf:a.tf||null,boards}}
function txKick(now){if(!txOn)return;clearTimeout(txT);txT=setTimeout(txSend,now?0:300)}
async function txSend(force){if(!txOn)return;const pl=txPayload(),j=JSON.stringify(pl);if(!force&&j===lastTx)return;
  if(j.length>400000){X.toast("Tienes demasiados dibujos para transmitir: borra algunos (el pincel ocupa mucho).");return}
  lastTx=j;try{await X.API.liveSet(pl)}catch(e){lastTx="";X.toast("No se pudo transmitir: "+esc(e.message||""))}}
async function startTx(o){txOn=true;lastTx="";const pl=txPayload();pl.title=o.title||null;pl.started_at=new Date().toISOString();
  try{await X.API.liveSet(pl);lastTx=JSON.stringify(Object.assign({},pl,{title:undefined,started_at:undefined}))}catch(e){txOn=false;X.toast("No se pudo iniciar la clase: "+esc(e.message||"")+(/live_class|relation|schema/i.test(e.message||"")?" (falta correr charts_clase.sql en Supabase)":""));paintBtn();paintPanel();return}
  live=Object.assign({},live,pl,{updated_at:new Date().toISOString()});
  clearInterval(keepT);keepT=setInterval(()=>txSend(true),60000);
  if(o.push)X.API.sendPush({title:"🔴 Clase en vivo en EAG Charts",body:`${o.title?o.title+" · ":""}Estoy analizando ${pl.sym_name||"el mercado"} en vivo. Activa el Modo Clase y mira mis dibujos en tu gráfico.`,url:"https://charts.elartegrafico.com/?clase=1",audience:"todos",tag:"clase"})
    .then(r=>X.toast(`Aviso enviado a ${r&&r.sent!=null?r.sent:"los"} celulares.`)).catch(e=>X.toast("La clase empezó, pero el aviso no se pudo enviar: "+esc(e.message||"")));
  X.toast("🔴 <b>Estás en vivo.</b> Todo lo que dibujes se ve en los gráficos de tus alumnos con el Modo Clase.");paintBtn();paintPanel()}
async function stopTx(){txOn=false;clearInterval(keepT);clearTimeout(txT);try{await X.API.liveSet({on_air:false})}catch(e){}if(live)live.on_air=false;X.toast("Terminaste la clase en vivo.");paintBtn();paintPanel()}

/* ============ profe: zonas ============ */
async function publish(note,push){const p=X.panes()[X.active()];if(!p)return;const s=p.kc.getSymbol(),d=p.kc.drawings();
  if(!d.length){X.toast("No tienes dibujos en este mercado para publicar.");return}
  try{const r=await X.API.zoneSet({sym:s.ticker,sym_name:s.name||s.shortName||s.ticker,tf:p.kc.getPeriod().text,drawings:d,note:note||null});zones[s.ticker]=r||{sym:s.ticker,sym_name:s.name,drawings:d,note,updated_at:new Date().toISOString()};
    X.toast(`📌 Zonas de <b>${esc(s.name||s.ticker)}</b> publicadas (${d.length} dibujo${d.length>1?"s":""}).`);
    if(push)X.API.sendPush({title:"📌 Nuevas zonas del profe",body:`${s.name||s.ticker}: ${note||"mira mi análisis directo en tu gráfico."}`,url:"https://charts.elartegrafico.com/?zonas="+encodeURIComponent(s.ticker),audience:"oro",tag:"zonas-"+s.ticker}).catch(e=>X.toast("Se publicó, pero el aviso no salió: "+esc(e.message||"")))}
  catch(e){X.toast("No se pudo publicar: "+esc(e.message||"")+(/teacher_zones|relation|schema/i.test(e.message||"")?" (falta correr charts_clase.sql en Supabase)":""))}
  apply();paintPanel()}
async function unpublish(tk){try{await X.API.zoneDel(tk);delete zones[tk];X.toast("Zonas quitadas.")}catch(e){X.toast("No se pudo quitar: "+esc(e.message||""))}apply();paintPanel()}

/* ============ panel ============ */
let panel=null;
function open(anchor){if(panel){close();return}panel=document.createElement("div");panel.className="clpan";document.body.appendChild(panel);
  const r=anchor.getBoundingClientRect();panel.style.top=Math.round(r.bottom+6)+"px";panel.style.right=Math.max(8,Math.round(innerWidth-r.right))+"px";
  setTimeout(()=>addEventListener("pointerdown",outside,true),0);paintPanel();if(!joined)refresh()}
function outside(e){if(panel&&!panel.contains(e.target)&&!(X.btn&&X.btn.contains(e.target)))close()}
function close(){if(panel){panel.remove();panel=null}removeEventListener("pointerdown",outside,true)}
function zoneList(admin){const L=Object.values(zones).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  if(!L.length)return`<p class="cl-help">${admin?"Aún no has publicado zonas.":"El profe aún no ha publicado zonas."}</p>`;
  return`<div class="cl-zl">${L.map(z=>`<div class="cl-z"><div><b>${esc(z.sym_name||z.sym)}</b>${z.tf?` <i>${esc(z.tf)}</i>`:""}<p>${z.note?esc(z.note)+" · ":""}${ago(z.updated_at)} · ${(z.drawings||[]).length} dibujo${(z.drawings||[]).length===1?"":"s"}</p></div>
    <button data-zv="${esc(z.sym)}">Ver</button>${admin?`<button data-zd="${esc(z.sym)}" class="cl-del" title="Quitar">×</button>`:`<button data-zc="${esc(z.sym)}" title="Copiar a mis dibujos">Copiar</button>`}</div>`).join("")}</div>`}
function paintPanel(){if(!panel)return;const c=cfg(),air=onAir(),adm=X.isAdmin();let h;
  if(adm){const p=X.panes()[X.active()];let nm="",nd=0;try{const s=p.kc.getSymbol();nm=s.name||s.shortName||s.ticker;nd=p.kc.drawings().length}catch(e){}
    h=`<div class="cl-h">🎓 Modo Clase <small>solo tú lo ves así</small></div>
      <div class="cl-sec"><div class="cl-st ${txOn?"air":""}"><span class="cl-dot"></span>${txOn?"<b>Estás en vivo</b> · tus dibujos se ven en los gráficos de los alumnos":"No estás transmitiendo"}</div>
      ${txOn?`<button class="btn sm cl-stop" data-a="stop">Terminar la clase</button>`:`<input class="cl-in" data-a="title" maxlength="60" placeholder="Título (opcional): Ej. Live de TikTok · Boom 1000">
        <label class="cl-ck"><input type="checkbox" data-a="push" checked> Avisar al celular a todos los alumnos</label>
        <label class="cl-ck"><input type="checkbox" data-a="voz" ${X.SAVE.claseVoz===false?"":"checked"}> 🎙 Abrir la voz: los alumnos te escuchan y pueden levantar la mano</label>
        <button class="btn sm gold" data-a="start">🔴 Empezar clase en vivo</button>`}
      <p class="cl-help">Se transmiten los dibujos de todos los gráficos que tienes abiertos, el mercado y la temporalidad del gráfico activo. Los alumnos con el Modo Clase los ven al instante (sin poder moverlos) y pueden seguirte o copiarlos.</p></div>
      <div class="cl-sec"><div class="cl-sub">👥 Te están siguiendo <span data-vcount></span></div><div data-viewers></div></div>
      <div class="cl-sec"><div class="cl-sub">📌 Zonas del profe <small>Oro y Diamond</small></div>
      <p class="cl-help">Publica tu análisis de <b>${esc(nm)}</b> (${nd} dibujo${nd===1?"":"s"}). Si ya lo habías publicado, se reemplaza.</p>
      <input class="cl-in" data-a="note" maxlength="120" placeholder="Nota (opcional): Ej. Compras en la zona de abajo">
      <label class="cl-ck"><input type="checkbox" data-a="zpush"> Avisar al celular a Oro y Diamond</label>
      <button class="btn sm gold" data-a="pub">Publicar zonas de ${esc(nm)}</button>
      <label class="cl-ck"><input type="checkbox" data-a="adz" ${c.adminZones?"checked":""}> Ver mis zonas publicadas como capa</label>
      ${zoneList(true)}</div>`}
  else{h=`<div class="cl-h">🎓 Modo Clase</div>
      <div class="cl-sec"><div class="cl-st ${air?"air":""}"><span class="cl-dot"></span>${air?`<b>El profe está en vivo</b> · ${esc(live.sym_name||live.sym||"")}${live.tf?" · "+esc(live.tf):""}`:"El profe no está en vivo ahora"}</div>
      <label class="cl-sw"><input type="checkbox" data-a="on" ${c.on?"checked":""}><i></i><span><b>Modo Clase</b><small>Cuando el profe esté en vivo, ves lo mismo que él dibuja, en tu gráfico.</small></span></label>
      <label class="cl-sw"><input type="checkbox" data-a="fol" ${c.follow?"checked":""}><i></i><span><b>Seguir al profe</b><small>Cambia tu gráfico al mercado y temporalidad que él esté mirando.</small></span></label>
      ${air&&c.on?`<button class="btn sm" data-a="copylive">Copiar sus dibujos a los míos</button>`:""}</div>
      <div class="cl-sec"><div class="cl-sub">📌 Zonas del profe <small>Oro y Diamond</small></div>
      ${canZones()?`<label class="cl-sw"><input type="checkbox" data-a="zon" ${c.zones?"checked":""}><i></i><span><b>Mostrar en mis gráficos</b><small>Las zonas aparecen solas cuando abres ese mercado.</small></span></label>${zoneList(false)}`
        :`<div class="cl-lock">🔒 <b>Exclusivo de Oro y Diamond.</b> El análisis del profe (zonas de compra y venta) directo en tu gráfico, con aviso al celular cuando lo actualice.<a class="btn sm gold" href="${X.planUrl}">Ver planes</a></div>`}</div>`}
  panel.innerHTML=h;
  const q=s=>panel.querySelector(`[data-a="${s}"]`),on=(s,ev,f)=>{const e=q(s);e&&(e[ev]=f)};
  on("start","onclick",async()=>{const vz=q("voz")?q("voz").checked:false;X.SAVE.claseVoz=vz;X.save();await startTx({title:(q("title").value||"").trim(),push:q("push").checked});if(vz&&txOn&&window.EAGAula)setTimeout(()=>window.EAGAula.voice(true),300);setTimeout(()=>window.EAGAula&&window.EAGAula.refresh(),400)});
  on("stop","onclick",stopTx);
  on("pub","onclick",()=>publish((q("note").value||"").trim(),q("zpush").checked));
  on("adz","onchange",e=>{c.adminZones=e.target.checked;X.save();apply()});
  on("on","onchange",e=>setOn(e.target.checked));
  on("fol","onchange",e=>{c.follow=e.target.checked;X.save();if(c.follow&&onAir()&&c.on)followProfe(true);paintBanner()});
  on("zon","onchange",e=>{c.zones=e.target.checked;X.save();apply()});
  on("copylive","onclick",()=>{const tk=live&&live.sym;if(tk)copyFrom((live.boards||{})[tk]||[],tk)});
  panel.querySelectorAll("[data-zv]").forEach(b=>b.onclick=()=>{const tk=b.dataset.zv;if(!cfg().zones){cfg().zones=true;X.save()}X.follow(tk,(zones[tk]||{}).tf);setTimeout(apply,400);close()});
  panel.querySelectorAll("[data-zc]").forEach(b=>b.onclick=()=>copyFrom((zones[b.dataset.zc]||{}).drawings||[],b.dataset.zc));
  panel.querySelectorAll("[data-zd]").forEach(b=>b.onclick=()=>unpublish(b.dataset.zd));
  paintViewers()}

/* ============ API ============ */
window.EAGClase={
  init(ctx){X=ctx;const c=cfg();
    const u=new URLSearchParams(location.search);
    if(u.has("clase")&&!X.isAdmin()){c.on=true;c.follow=true;X.save()}
    if(u.has("zonas")){c.zones=true;X.save();const tk=u.get("zonas");if(tk)setTimeout(()=>X.follow(tk),1200)}
    if(u.has("clase")||u.has("zonas"))try{history.replaceState(null,"",location.pathname)}catch(e){}
    X.btn&&(X.btn.onclick=e=>{e.stopPropagation();open(X.btn)});
    refresh().then(()=>{if(X.isAdmin()&&live&&onAir()){txOn=true;clearInterval(keepT);keepT=setInterval(()=>txSend(true),60000);paintBtn();X.toast("🔴 Sigues <b>en vivo</b> en Modo Clase. Termínala desde el botón <b>Clase</b>.")}
      if(onAir()&&c.on&&c.follow&&!X.isAdmin())followProfe(true);
      if(onAir()&&!c.on&&!X.isAdmin())X.toast("🔴 <b>El profe está en vivo.</b> Toca <b>Clase</b> arriba y activa el Modo Clase para ver sus dibujos en tu gráfico.")});
    if(needRt())connect();poll();
    /* cambios de mercado/temporalidad o de dibujos: el profe transmite, el alumno actualiza su capa */
    setInterval(()=>{apply();if(txOn)txKick()},1000);
    clearInterval(vT);vT=setInterval(()=>{viewerBeat();if(X.isAdmin())paintViewers()},8000);
    addEventListener("beforeunload",()=>{try{const m=me();if(m&&lastV)vSend("viewer-bye",{id:m.id})}catch(e){}});
    addEventListener("visibilitychange",()=>{if(!document.hidden){if(!rt&&needRt())connect();if(!joined)refresh()}});
    window.addEventListener("ag-local-live",()=>refresh());
    paintBtn()},
  drawingsChanged(){txKick()},
  /* el profe mueve el láser: se manda a los alumnos (máximo ~7 veces por segundo, solo mientras transmite) */
  laser(pt){if(!txOn||!rtSend||!pt||!pt.sym)return;rtSend("broadcast",{type:"broadcast",event:"laser",payload:pt})},
  isTx:()=>txOn,
  inClass:()=>!!(X&&!X.isAdmin()&&cfg().on&&onAir()),title:()=>live&&live.title||"",
  isLive:onAir};
})();
