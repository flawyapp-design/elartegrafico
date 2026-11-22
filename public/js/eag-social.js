/* © El Arte Gráfico. Todos los derechos reservados. */
/* EAG Charts · Comunidad dentro del gráfico
   - Chat privado (1 a 1) y grupo general. Mensajes guardados en Supabase (chart_msgs), llegan al instante por Realtime.
   - Conectados: quién está usando EAG Charts ahora (chart_presence).
   - Burbuja discreta cuando te escriben (no tapa el gráfico, se recoge sola).
   - Compartir gráfico: los dibujos de cada uno aparecen en el gráfico del otro con su nombre (capa aparte, no se mezcla).
   - Llamada de voz: directo entre navegadores (WebRTC). 1 a 1 por privado y "Sala de voz" en el grupo (hasta 6).
   Sin librerías: Realtime por WebSocket (protocolo Phoenix), como el Modo Clase. En modo local usa BroadcastChannel (pruebas). */
(function(){
"use strict";
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const GEN="g:general";
const VMAX=6; /* máximo de personas en una llamada (malla entre navegadores) */
const COLORS=["#4fc3f7","#ff8a65","#ba68c8","#81c784","#f06292","#ffd54f","#4dd0e1","#a1887f"];
let X=null,ME=null,panel=null,view={tab:"chats",room:null},threads=[],people=[],msgs={},unread=0,peopleT=0,thrT=0;
let rt=null,rtJoined=false,rtRef=0,rtHb=0,rtTok=0,bc=null;const topics={};   /* topic → handler */
let share=null;   /* {room,with,peers:{id:{name,color,sym,tf,boards,laser,at}},last,hbT,loopT} */
let call=null;    /* {room,kind:'dm'|'group',with,peers:{id:{pc,name,audio,an}},stream,muted,t0} */
let ringing=null; /* llamada entrante */

const cfg=()=>{X.SAVE.soc=Object.assign({snd:true,hidden:false,bub:true},X.SAVE.soc||{});return X.SAVE.soc};
const dmRoom=id=>{const a=[ME.id,id].sort();return"dm:"+a[0]+":"+a[1]};
const otherOf=room=>room&&room.startsWith("dm:")?room.split(":").slice(1).find(x=>x!==ME.id):null;
const ini=n=>esc(String(n||"?").trim().charAt(0).toUpperCase()||"?");
const av=(u,cls)=>u&&u.avatar_url?`<img class="sav ${cls||""}" src="${esc(u.avatar_url)}" alt="" loading="lazy">`:`<span class="sav ${cls||""}" style="background:${colorOf(u&&(u.id||u.other||u.sender)||"")}">${ini(u&&u.username)}</span>`;
function colorOf(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return COLORS[h%COLORS.length]}
const hhmm=t=>{try{const d=new Date(t),n=new Date();const s=d.toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit"});return d.toDateString()===n.toDateString()?s:d.toLocaleDateString("es-CO",{day:"numeric",month:"short"})+" "+s}catch(e){return""}};
const nameOf=id=>{if(id===ME.id)return ME.name;const p=people.find(x=>x.id===id);if(p)return p.username;const t=threads.find(x=>x.other===id);return t?t.username:"Alguien"};
const uuid=()=>crypto.randomUUID?crypto.randomUUID():"r"+Date.now().toString(36)+Math.random().toString(36).slice(2);
function linkify(s){return esc(s).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,"<br>")}

/* ===================== transporte en tiempo real ===================== */
function rtConnect(){if(!X.API.rt||rt)return;let ws;try{ws=new WebSocket(X.API.rt.url)}catch(e){return}rt=ws;rtJoined=false;
  ws.onopen=async()=>{const tok=await X.API.accessToken().catch(()=>null);
    rtSendRaw("realtime:eag-social","phx_join",{config:{broadcast:{ack:false,self:false},presence:{key:""},private:false,
      postgres_changes:[{event:"INSERT",schema:"public",table:"chart_msgs"},{event:"DELETE",schema:"public",table:"chart_msgs"}]},access_token:tok||undefined});
    Object.keys(topics).forEach(t=>joinTopic(t,tok));
    clearInterval(rtHb);rtHb=setInterval(()=>rtSendRaw("phoenix","heartbeat",{}),25000);
    clearInterval(rtTok);rtTok=setInterval(async()=>{const t=await X.API.accessToken().catch(()=>null);if(t){rtSendRaw("realtime:eag-social","access_token",{access_token:t});Object.keys(topics).forEach(k=>rtSendRaw(k,"access_token",{access_token:t}))}},10*60000)};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}
    if(m.topic==="realtime:eag-social"){
      if(m.event==="phx_reply"&&m.payload&&m.payload.status==="ok"&&m.payload.response&&m.payload.response.postgres_changes){rtJoined=true;loadThreads()}
      else if(m.event==="postgres_changes"){const d=(m.payload&&m.payload.data)||{},ty=d.eventType||d.type,rec=d.record||d.new,old=d.old_record||d.old;
        if(ty==="INSERT"&&rec)onMsg(rec);else if(ty==="DELETE"&&old&&old.id)onDel(old.id)}}
    else if(topics[m.topic]&&m.event==="broadcast"&&m.payload)topics[m.topic](m.payload.event,m.payload.payload||{})};
  ws.onclose=()=>{rt=null;rtJoined=false;clearInterval(rtHb);clearInterval(rtTok);setTimeout(rtConnect,3000+Math.random()*4000)};
  ws.onerror=()=>{try{ws.close()}catch(e){}}}
function rtSendRaw(topic,event,payload){try{if(rt&&rt.readyState===1)rt.send(JSON.stringify({topic,event,payload,ref:String(++rtRef)}))}catch(e){}}
async function joinTopic(t,tok){tok=tok||await X.API.accessToken().catch(()=>null);rtSendRaw(t,"phx_join",{config:{broadcast:{ack:false,self:false},presence:{key:""},private:false},access_token:tok||undefined})}
/* salas temporales (compartir / llamada): nombre imposible de adivinar, se pasa por un mensaje privado */
function sub(room,fn){const t="realtime:eag-r-"+room;topics[t]=fn;if(rt&&rt.readyState===1)joinTopic(t)}
function unsub(room){const t="realtime:eag-r-"+room;if(!topics[t])return;delete topics[t];rtSendRaw(t,"phx_leave",{})}
function cast(room,event,payload){payload=Object.assign({from:ME.id,fname:ME.name},payload);
  if(X.API.rt)rtSendRaw("realtime:eag-r-"+room,"broadcast",{type:"broadcast",event,payload});
  else if(bc)bc.postMessage({k:"r",room,event,payload})}
function localBus(){if(X.API.rt||!window.BroadcastChannel)return;bc=new BroadcastChannel("eag-social");
  bc.onmessage=e=>{const d=e.data||{};if(d.k==="msg"&&d.m)onMsg(d.m);else if(d.k==="del")onDel(d.id);
    else if(d.k==="r"&&d.payload&&d.payload.from!==ME.id){const fn=topics["realtime:eag-r-"+d.room];fn&&fn(d.event,d.payload)}}}

/* ===================== datos ===================== */
async function loadThreads(){try{threads=(await X.API.chatThreads())||[]}catch(e){threads=threads||[]}
  unread=threads.reduce((a,t)=>a+(t.room===GEN?0:(+t.unread||0)),0);paintBtn();if(panel&&!view.room)paintPanel()}
async function loadPeople(){try{people=(await X.API.chatPeople())||[]}catch(e){}paintBtn();if(panel&&!view.room)paintPanel()}
async function loadRoom(room,more){const L=msgs[room]||(msgs[room]=[]);const before=more&&L.length?L[0].id:null;
  try{const r=((await X.API.chatHistory(room,before))||[]).slice().reverse();
    const end=r.length<50,was=!!L.__end;msgs[room]=more?r.concat(L):mergeMsgs(L,r);msgs[room].__end=more?end:(was||end)}catch(e){X.toast("No se pudo cargar el chat.")}
  if(view.room===room)paintRoom(!more)}
function mergeMsgs(a,b){const m=new Map();a.concat(b).forEach(x=>m.set(x.id,Object.assign({},m.get(x.id)||{},x)));return[...m.values()].sort((x,y)=>x.id-y.id)}
const readAt={};
function markRead(room){const L=msgs[room];if(!L||!L.length)return;const last=L[L.length-1].id;const t=threads.find(x=>x.room===room);if(t){t.unread=0}
  unread=threads.reduce((a,t)=>a+(t.room===GEN?0:(+t.unread||0)),0);paintBtn();if(readAt[room]===last)return;readAt[room]=last;X.API.chatRead(room,last).catch(()=>{})}

/* mensaje nuevo (de Realtime o de otra pestaña en modo local) */
function onMsg(m){if(!m||!m.room)return;if(!(m.room===GEN||(m.room.startsWith("dm:")&&m.room.includes(ME.id))))return;
  if(!m.username)m.username=nameOf(m.sender);
  const L=msgs[m.room];if(L&&!L.some(x=>x.id===m.id)){L.push(m)}
  let t=threads.find(x=>x.room===m.room);
  if(!t){t={room:m.room,other:otherOf(m.room),username:m.sender===ME.id?nameOf(otherOf(m.room)):m.username,unread:0};threads.unshift(t)}
  Object.assign(t,{last_id:m.id,last_body:m.body,last_kind:m.kind,last_sender:m.sender,last_at:m.created_at});
  threads.sort((a,b)=>(b.last_id||0)-(a.last_id||0));
  const mine=m.sender===ME.id,open=panel&&view.room===m.room&&!document.hidden;
  if(!mine&&!open){t.unread=(+t.unread||0)+1;if(m.room!==GEN||mentioned(m)||m.is_admin){bubble(m);ding()}}
  if(!mine&&m.kind==="call"&&m.payload&&m.payload.act==="start"&&m.room!==GEN)incoming(m);
  if(!mine&&m.kind==="call"&&m.payload&&m.payload.act==="end"){if(ringing&&ringing.room===m.payload.room)stopRing("La llamada terminó.");if(call&&call.room===m.payload.room){X.toast("La otra persona colgó.");hangup(true)}}
  unread=threads.reduce((a,x)=>a+(x.room===GEN?0:(+x.unread||0)),0);paintBtn();
  if(open){paintRoom(true);markRead(m.room)}else if(panel&&!view.room)paintPanel()}
function onDel(id){Object.keys(msgs).forEach(r=>{const L=msgs[r];const i=L.findIndex(x=>x.id===id);if(i>=0){L.splice(i,1);if(view.room===r)paintRoom()}})}
const mentioned=m=>new RegExp("@"+String(ME.name).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(m.body||"");

async function send(room,body,kind,payload){try{const m=await X.API.chatSend(room,body,kind,payload);if(m){m.username=ME.name;m.is_admin=X.isAdmin();
      if(bc)bc.postMessage({k:"msg",m});onMsg(m)}return m}
  catch(e){X.toast(esc((e&&e.message)||"No se pudo enviar."));return null}}

/* ===================== botón y panel ===================== */
function paintBtn(){const b=X.btn;if(!b)return;const n=unread;const e=b.querySelector(".badge");if(e){e.hidden=!n;e.textContent=n>9?"9+":String(n)}
  const on=b.querySelector(".scnt");if(on)on.textContent=people.length?String(people.length):"";b.classList.toggle("live",!!(share||call))}
function open(room){if(!panel){panel=document.createElement("aside");panel.className="socp";document.body.appendChild(panel);document.body.classList.add("socopen");
    panel.addEventListener("keydown",e=>e.stopPropagation());clearInterval(peopleT);peopleT=setInterval(()=>{if(!document.hidden&&panel&&!view.room)loadPeople()},15000)}
  hideBubbles();if(room){view.room=room;loadRoom(room);paintRoom(true);loadPeople().then(()=>{if(view.room===room)paintRoom()})}else{view.room=null;paintPanel();loadThreads();loadPeople()}}
function close(){if(panel){panel.remove();panel=null}document.body.classList.remove("socopen");view.room=null;clearInterval(peopleT)}
function paintPanel(){if(!panel)return;const tab=view.tab;const g=threads.find(t=>t.room===GEN)||{room:GEN};
  const dms=threads.filter(t=>t.room!==GEN);
  panel.innerHTML=`<div class="sp-h"><b>Comunidad</b><span class="sp-on"><i></i>${people.length} en los charts</span><button class="sx" data-x title="Cerrar">✕</button></div>
  <div class="sp-tabs"><button data-tab="chats" class="${tab==="chats"?"on":""}">Chats${unread?` <em>${unread>9?"9+":unread}</em>`:""}</button><button data-tab="people" class="${tab==="people"?"on":""}">Conectados <small>${people.length}</small></button><button data-tab="cfg" class="${tab==="cfg"?"on":""}" title="Opciones">⚙</button></div>
  <div class="sp-body">${tab==="chats"?`
    <div class="sp-find"><input type="search" placeholder="Buscar a alguien para escribirle…" data-find autocomplete="off"><div class="sp-res" data-res></div></div>
    ${thRow(Object.assign({username:"Grupo general",grp:true},g))}
    ${dms.length?dms.map(t=>thRow(t)).join(""):`<p class="sp-empty">Aún no tienes chats privados. Ve a <b>Conectados</b> y escríbele a alguien, o búscalo arriba.</p>`}`
  :tab==="people"?(people.length?people.map(p=>`<div class="sp-row" data-dm="${esc(p.id)}" data-n="${esc(p.username)}">${av(p)}<div class="sp-t"><b>${esc(p.username||"Usuario")}${p.is_admin?' <span class="sp-tag">Profe</span>':""}${p.id===ME.id?' <span class="sp-tag me">Tú</span>':""}</b><small>${p.symbol_name||p.symbol?`📈 ${esc(p.symbol_name||p.symbol)}${p.tf?" · "+esc(p.tf):""}`:"En EAG Charts"}</small></div>${p.id===ME.id?"":`<button class="btn sm" data-dm="${esc(p.id)}" data-n="${esc(p.username)}">💬</button>`}</div>`).join(""):`<p class="sp-empty">Nadie más conectado ahora.</p>`)
  :`<div class="sp-cfg">
     <label class="sp-ck"><input type="checkbox" data-c="bub"${cfg().bub?" checked":""}><span><b>Burbuja de mensajes</b><small>Aparece abajo cuando alguien te escribe por privado.</small></span></label>
     <label class="sp-ck"><input type="checkbox" data-c="snd"${cfg().snd?" checked":""}><span><b>Sonido suave</b><small>Un "tin" bajito con cada mensaje privado.</small></span></label>
     <label class="sp-ck"><input type="checkbox" data-c="hidden"${cfg().hidden?" checked":""}><span><b>Aparecer invisible</b><small>No sales en Conectados. Igual puedes escribir y recibir mensajes.</small></span></label>
     <p class="sp-note">🔒 Los chats privados solo los ven las 2 personas. En el grupo general escribe con respeto: el profe puede borrar mensajes y silenciar a quien haga spam.</p></div>`}</div>`;
  panel.querySelector("[data-x]").onclick=close;
  panel.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{view.tab=b.dataset.tab;paintPanel();if(view.tab==="people")loadPeople()});
  panel.querySelectorAll("[data-room]").forEach(b=>b.onclick=()=>open(b.dataset.room));
  panel.querySelectorAll("[data-dm]").forEach(b=>b.onclick=e=>{e.stopPropagation();startDM(b.dataset.dm,b.dataset.n)});
  panel.querySelectorAll("[data-c]").forEach(i=>i.onchange=()=>{cfg()[i.dataset.c]=i.checked;X.save();if(i.dataset.c==="hidden")X.API.chatHidden(i.checked).then(loadPeople).catch(()=>X.toast("No se pudo cambiar."))});
  const f=panel.querySelector("[data-find]");if(f){let ft=0;f.oninput=()=>{clearTimeout(ft);ft=setTimeout(async()=>{const q=f.value.trim(),box=panel.querySelector("[data-res]");if(!box)return;if(q.length<2){box.innerHTML="";return}
      let r=[];try{r=(await X.API.chatFind(q))||[]}catch(e){}box.innerHTML=r.filter(u=>u.id!==ME.id).map(u=>`<button class="sp-row" data-dm="${esc(u.id)}" data-n="${esc(u.username)}">${av(u)}<div class="sp-t"><b>${esc(u.username)}</b><small>Escribirle</small></div></button>`).join("")||`<p class="sp-empty">No encontramos a nadie con ese nombre.</p>`;
      box.querySelectorAll("[data-dm]").forEach(b=>b.onclick=()=>startDM(b.dataset.dm,b.dataset.n))},250)}}}
function thRow(t){const isG=t.room===GEN,on=!isG&&(people.some(p=>p.id===t.other)||t.online);
  const last=t.last_body!=null||t.last_kind?`${t.last_sender===ME.id?"Tú: ":isG&&t.last_sender?esc(nameOf(t.last_sender))+": ":""}${t.last_kind==="share"?"📡 Compartió su gráfico":t.last_kind==="call"?"📞 Llamada":esc(String(t.last_body||"").slice(0,60))}`:(isG?"Habla con todos los que usan EAG Charts":"");
  return`<button class="sp-row th${t.unread?" un":""}" data-room="${esc(t.room)}">${isG?`<span class="sav grp">👥</span>`:av({id:t.other,username:t.username,avatar_url:t.avatar_url})}${on?'<i class="sp-dot"></i>':""}
    <div class="sp-t"><b>${esc(isG?"Grupo general":t.username||"Usuario")}${t.is_admin?' <span class="sp-tag">Profe</span>':""}</b><small>${last}</small></div>
    <div class="sp-m">${t.last_at?`<small>${hhmm(t.last_at)}</small>`:""}${t.unread?`<em>${t.unread>9?"9+":t.unread}</em>`:""}</div></button>`}
function startDM(id,name){if(!id||id===ME.id)return;const room=dmRoom(id);if(!threads.find(t=>t.room===room))threads.unshift({room,other:id,username:name||nameOf(id),unread:0});view.tab="chats";open(room)}

function paintRoom(toBottom){if(!panel||!view.room)return;const room=view.room,isG=room===GEN,oid=otherOf(room),t=threads.find(x=>x.room===room)||{};
  const name=isG?"Grupo general":(t.username||nameOf(oid)),online=isG||people.some(p=>p.id===oid);const L=msgs[room]||[];
  const body=panel.querySelector(".sp-msgs");const keep=body&&!toBottom?body.scrollHeight-body.scrollTop:null;
  const inShare=share&&share.room&&share.with===room,inCall=call&&call.chat===room;
  panel.innerHTML=`<div class="sp-h"><button class="sx" data-back title="Volver">‹</button>${isG?`<span class="sav grp">👥</span>`:av({id:oid,username:name,avatar_url:t.avatar_url})}
    <div class="sp-ht"><b>${esc(name)}</b><small>${isG?`${people.length} conectado${people.length===1?"":"s"} ahora`:online?"🟢 En los charts":"No está conectado"}</small></div>
    <div class="sp-act">${isG?`<button class="btn sm${call&&call.kind==="group"?" on":""}" data-vg title="Sala de voz del grupo (hasta ${VMAX})">🎙</button>`:`<button class="btn sm${inShare?" on":""}" data-sh title="Compartir tu gráfico: tus dibujos salen en el suyo con tu nombre y los suyos en el tuyo">📡</button><button class="btn sm${inCall?" on":""}" data-call title="Llamada de voz">📞</button>`}<button class="sx" data-x title="Cerrar">✕</button></div></div>
  <div class="sp-msgs">${L.__end||!L.length?"":`<button class="sp-more" data-more>Ver mensajes anteriores</button>`}${L.length?L.map((m,i)=>msgRow(m,L[i-1],isG)).join(""):`<p class="sp-empty">${isG?"Saluda al grupo 👋":"Escríbele el primer mensaje 👋"}</p>`}</div>
  <form class="sp-in"><textarea rows="1" maxlength="1000" placeholder="${isG?"Escribe al grupo… (usa @nombre para mencionar)":"Escribe un mensaje…"}"></textarea><button class="btn gold sm" type="submit" title="Enviar">➤</button></form>`;
  const box=panel.querySelector(".sp-msgs");if(keep!=null)box.scrollTop=box.scrollHeight-keep;else box.scrollTop=box.scrollHeight;
  panel.querySelector("[data-back]").onclick=()=>{view.room=null;paintPanel();loadThreads()};
  panel.querySelector("[data-x]").onclick=close;
  const mb=panel.querySelector("[data-more]");if(mb)mb.onclick=()=>loadRoom(room,true);
  const ta=panel.querySelector("textarea"),fm=panel.querySelector(".sp-in");
  ta.oninput=()=>{ta.style.height="auto";ta.style.height=Math.min(120,ta.scrollHeight)+"px"};
  ta.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();fm.requestSubmit()}};
  fm.onsubmit=async e=>{e.preventDefault();const v=ta.value.trim();if(!v)return;ta.value="";ta.style.height="auto";await send(room,v,"text")};
  if(matchMedia("(hover:hover)").matches)setTimeout(()=>ta.focus(),20);
  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{const id=+b.dataset.del;try{await X.API.chatDelete(id);onDel(id);if(bc)bc.postMessage({k:"del",id})}catch(e){X.toast("No se pudo borrar.")}});
  box.querySelectorAll("[data-mute]").forEach(b=>b.onclick=async()=>{if(!confirmSoft(b,"¿Silenciar?"))return;try{await X.API.chatBlock(b.dataset.mute,true);X.toast("Listo: esa persona ya no puede escribir en el chat.")}catch(e){X.toast("No se pudo.")}});
  box.querySelectorAll("[data-join]").forEach(b=>b.onclick=()=>joinShare(b.dataset.join,room));
  box.querySelectorAll("[data-acc]").forEach(b=>b.onclick=()=>acceptCall(b.dataset.acc,room));
  box.querySelectorAll("[data-pm]").forEach(b=>b.onclick=()=>startDM(b.dataset.pm,b.dataset.n));
  const sh=panel.querySelector("[data-sh]");if(sh)sh.onclick=()=>inShare?leaveShare():startShare(room);
  const cb=panel.querySelector("[data-call]");if(cb)cb.onclick=()=>inCall?hangup():startCall(room);
  const vg=panel.querySelector("[data-vg]");if(vg)vg.onclick=()=>call&&call.kind==="group"?hangup():joinVoiceGroup();
  markRead(room)}
function confirmSoft(b,txt){if(b.dataset.ok)return true;b.dataset.ok=1;b.textContent=txt;setTimeout(()=>{delete b.dataset.ok},3000);return false}
function msgRow(m,prev,isG){const mine=m.sender===ME.id,adm=X.isAdmin();const grp=prev&&prev.sender===m.sender&&new Date(m.created_at)-new Date(prev.created_at)<5*60000;
  let inner;
  if(m.kind==="share"){const p=m.payload||{};const act=share&&share.room===p.room;
    inner=`<div class="sp-card"><b>📡 ${mine?"Compartiste tu gráfico":esc(m.username||nameOf(m.sender))+" compartió su gráfico"}</b><small>${esc(p.symName||p.sym||"")}${p.tf?" · "+esc(p.tf):""} — los dibujos de los dos salen en el mismo gráfico, cada uno con su nombre.</small>
      ${p.room?(act?`<span class="sp-ok">● Conectado</span>`:`<button class="btn sm gold" data-join="${esc(p.room)}">${mine?"Volver a compartir":"Ver en mi gráfico"}</button>`):""}</div>`}
  else if(m.kind==="call"){const p=m.payload||{};
    inner=p.act==="end"?`<div class="sp-card"><small>📞 Llamada terminada</small></div>`:`<div class="sp-card"><b>📞 ${mine?"Llamaste":esc(m.username||nameOf(m.sender))+" te está llamando"}</b>${!mine&&p.room&&!(call&&call.room===p.room)&&Date.now()-new Date(m.created_at)<10*60000?`<button class="btn sm gold" data-acc="${esc(p.room)}">Contestar</button>`:""}</div>`}
  else inner=`<div class="sp-txt">${linkify(m.body)}</div>`;
  const tools=(mine||adm)&&m.kind==="text"?`<button class="sp-del" data-del="${m.id}" title="Borrar">✕</button>`:"";
  const mute=adm&&isG&&!mine?`<button class="sp-del" data-mute="${esc(m.sender)}" title="Silenciar a esta persona en el chat">🔇</button>`:"";
  const pm=isG&&!mine?`<button class="sp-del" data-pm="${esc(m.sender)}" data-n="${esc(m.username||"")}" title="Escribirle por privado">💬</button>`:"";
  return`<div class="sp-msg${mine?" me":""}${grp?" grp":""}">${!mine&&isG&&!grp?av({id:m.sender,username:m.username,avatar_url:m.avatar_url},"sm"):!mine&&isG?'<span class="sav sm ghost"></span>':""}
    <div class="sp-bx">${!mine&&isG&&!grp?`<span class="sp-who" style="color:${colorOf(m.sender)}">${esc(m.username||"Usuario")}${m.is_admin?' <span class="sp-tag">Profe</span>':""}</span>`:""}${inner}<span class="sp-time">${hhmm(m.created_at)}</span></div><span class="sp-tools">${pm}${tools}${mute}</span></div>`}

/* ===================== burbuja discreta ===================== */
let bubWrap=null;const bubs={};
function bubble(m){if(!cfg().bub)return;if(!bubWrap){bubWrap=document.createElement("div");bubWrap.className="sbubs";document.body.appendChild(bubWrap)}
  const k=m.room;let b=bubs[k];const isG=m.room===GEN;
  if(!b){b=document.createElement("button");b.className="sbub";bubWrap.prepend(b);bubs[k]=b;b.onclick=()=>{open(k)};b.n=0;
    const xb=document.createElement("span");xb.className="sbx";xb.textContent="✕";xb.title="Ocultar";xb.onclick=e=>{e.stopPropagation();b.remove();delete bubs[k]};b.__x=xb}
  b.n++;const who=m.username||nameOf(m.sender);
  b.innerHTML=`${isG?`<span class="sav grp">👥</span>`:av({id:m.sender,username:who,avatar_url:m.avatar_url})}<em>${b.n>9?"9+":b.n}</em><span class="sbt"><b>${esc(isG?"Grupo · "+who:who)}</b><small>${m.kind==="share"?"📡 Compartió su gráfico":m.kind==="call"?"📞 Te está llamando":esc(String(m.body||"").slice(0,70))}</small></span>`;
  b.appendChild(b.__x);b.classList.add("open");clearTimeout(b.__t);b.__t=setTimeout(()=>b.classList.remove("open"),5000);
  const keys=Object.keys(bubs);if(keys.length>3){const old=bubs[keys[0]];old&&old.remove();delete bubs[keys[0]]}}
function hideBubbles(){Object.keys(bubs).forEach(k=>{bubs[k].remove();delete bubs[k]})}
let actx=null;function ding(){if(!cfg().snd)return;try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();const o=actx.createOscillator(),g=actx.createGain();o.type="sine";
    o.frequency.setValueAtTime(880,actx.currentTime);o.frequency.exponentialRampToValueAtTime(1320,actx.currentTime+.09);g.gain.setValueAtTime(.0001,actx.currentTime);g.gain.exponentialRampToValueAtTime(.06,actx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.32);
    o.connect(g);g.connect(actx.destination);o.start();o.stop(actx.currentTime+.35)}catch(e){}}

/* ===================== compartir gráfico ===================== */
function myBoards(){const boards={};let a=null;X.panes().forEach((p,i)=>{try{const s=p.kc.getSymbol();boards[s.ticker]=p.kc.drawings();if(i===X.active())a={sym:s.ticker,symName:s.name||s.shortName||s.ticker,tf:p.kc.getPeriod().text}}catch(e){}});
  return Object.assign({boards},a||{})}
async function startShare(chatRoom){const room=uuid(),b=myBoards();
  const m=await send(chatRoom,"","share",{room,sym:b.sym,symName:b.symName,tf:b.tf});if(!m)return;joinShare(room,chatRoom,true)}
function joinShare(room,chatRoom,host){if(share&&share.room===room)return;if(share)leaveShare(true);
  share={room,with:chatRoom,peers:{},last:"",host:!!host};
  sub(room,(ev,p)=>{if(!share||!p.from||p.from===ME.id)return;
    if(ev==="bye"){delete share.peers[p.from];applyShare();paintShareBar();X.toast(`${esc(p.fname||"La otra persona")} dejó de compartir.`);return}
    const pr=share.peers[p.from]||(share.peers[p.from]={name:p.fname,color:colorOf(p.from)});pr.name=p.fname||pr.name;pr.at=Date.now();
    if(ev==="hello"){shareSend(true)}
    if(ev==="draw"||ev==="hello"){if(p.boards)pr.boards=p.boards;pr.sym=p.sym;pr.symName=p.symName;pr.tf=p.tf;applyShare();paintShareBar()}
    if(ev==="hb"){pr.sym=p.sym||pr.sym;pr.symName=p.symName||pr.symName;pr.tf=p.tf||pr.tf;paintShareBar()}
    if(ev==="laser"&&p.pt){X.panes().forEach(q=>{try{if(p.pt.off||q.kc.getSymbol().ticker===p.pt.sym)q.kc.laserRemote(p.pt)}catch(e){}})}});
  setTimeout(()=>{cast(room,"hello",myBoards())},400);
  clearInterval(share.loopT);share.loopT=setInterval(()=>{if(!share)return;shareSend();applyShare();
    const now=Date.now();Object.keys(share.peers).forEach(id=>{if(now-(share.peers[id].at||0)>60000){delete share.peers[id];applyShare()}});paintShareBar()},2500);
  clearInterval(share.hbT);share.hbT=setInterval(()=>{if(share){const b=myBoards();cast(share.room,"hb",{sym:b.sym,symName:b.symName,tf:b.tf})}},15000);
  try{sessionStorage.setItem("eag_share",JSON.stringify({room,with:chatRoom}))}catch(e){}
  paintShareBar();paintBtn();if(view.room)paintRoom();X.toast("📡 Compartiendo: tus dibujos salen en su gráfico con tu nombre, y los suyos en el tuyo.")}
function shareSend(force){if(!share)return;const b=myBoards(),j=JSON.stringify(b);if(!force&&j===share.last)return;share.last=j;cast(share.room,"draw",b)}
function leaveShare(quiet){if(!share)return;cast(share.room,"bye",{});unsub(share.room);clearInterval(share.loopT);clearInterval(share.hbT);share=null;
  try{sessionStorage.removeItem("eag_share")}catch(e){}applyShare();paintShareBar();paintBtn();if(view.room)paintRoom();if(!quiet)X.toast("Dejaste de compartir el gráfico.")}
function tagged(arr,name,color){return(arr||[]).map(d=>{const c=JSON.parse(JSON.stringify(d));const ex=c.extendData=Object.assign({},c.extendData||{});
  const lb=Object.assign({},ex.lbl||{});const t=lb.t||ex.text||"";lb.t=t?`${name}: ${t}`:name;lb.c=lb.c||color;lb.s=lb.s||11;lb.b=true;ex.lbl=lb;if(ex.text&&/rect|zone|box/i.test(c.name))delete ex.text;return c})}
function applyShare(){X.panes().forEach(p=>{let tk;try{tk=p.kc.getSymbol().ticker}catch(e){return}const L={};
  if(share)Object.keys(share.peers).forEach(id=>{const pr=share.peers[id];if(pr.boards&&Array.isArray(pr.boards[tk]))L["u"+id]=tagged(pr.boards[tk],pr.name||"Invitado",pr.color)});
  const key=tk+":"+JSON.stringify(L);if(p.__sk===key)return;p.__sk=key;try{p.kc.setGuest(L,"social")}catch(e){}})}
let shBar=null;
function paintShareBar(){if(!share&&!call){if(shBar){shBar.remove();shBar=null}return}
  if(!shBar){shBar=document.createElement("div");shBar.className="sbar";document.body.appendChild(shBar)}
  const ps=share?Object.keys(share.peers).map(id=>Object.assign({id},share.peers[id])):[];
  const cps=call?Object.keys(call.peers).map(id=>({id,name:call.peers[id].name})):[];
  const tsec=call?Math.floor((Date.now()-call.t0)/1000):0;
  shBar.innerHTML=`${share?`<div class="sb-r"><span class="sb-ic">📡</span><span class="sb-t">${ps.length?ps.map(p=>`<b style="color:${p.color}">${esc(p.name||"Invitado")}</b>${p.symName?` <small>en ${esc(p.symName)}${p.tf?" · "+esc(p.tf):""}</small> <button class="sb-go" data-go="${esc(p.id)}" title="Ir a su mercado y temporalidad">Ir</button>`:""}`).join(" · "):"<small>Esperando a que se conecte…</small>"}</span><button class="sb-x" data-lsh title="Dejar de compartir">Salir</button></div>`:""}
  ${call?`<div class="sb-r"><span class="sb-ic">${call.kind==="group"?"🎙":"📞"}</span><span class="sb-t">${cps.length?cps.map(p=>`<b class="vpeer" data-vp="${esc(p.id)}">${esc(p.name||"…")}</b>`).join(" · "):"<small>Llamando…</small>"} <small>${Math.floor(tsec/60)}:${String(tsec%60).padStart(2,"0")}</small></span>
    <button class="sb-go${call.muted?" on":""}" data-mute title="${call.muted?"Activar micrófono":"Silenciar micrófono"}">${call.muted?"🔇":"🎤"}</button><button class="sb-x bad" data-hang title="Colgar">Colgar</button></div>`:""}`;
  shBar.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{const pr=share&&share.peers[b.dataset.go];if(pr&&pr.sym)X.follow(pr.sym,pr.tf)});
  const l=shBar.querySelector("[data-lsh]");l&&(l.onclick=()=>leaveShare());
  const mu=shBar.querySelector("[data-mute]");mu&&(mu.onclick=()=>{call.muted=!call.muted;call.stream&&call.stream.getAudioTracks().forEach(t=>t.enabled=!call.muted);paintShareBar()});
  const hg=shBar.querySelector("[data-hang]");hg&&(hg.onclick=()=>hangup())}

/* ===================== voz (WebRTC) ===================== */
function ice(){const s=(window.__site0||{});const L=[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}];
  if(Array.isArray(s.iceServers))L.push(...s.iceServers);else if(s.turnUrl)L.push({urls:s.turnUrl,username:s.turnUser||"",credential:s.turnPass||""});return L}
async function getMic(){try{return await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
  catch(e){X.toast("No pudimos usar tu micrófono. Revisa el permiso del navegador (el candado junto a la dirección).");return null}}
async function startCall(chatRoom){if(call)return X.toast("Ya estás en una llamada.");const room=uuid();
  if(!await enterVoice(room,"dm",chatRoom))return;await send(chatRoom,"","call",{room,act:"start"});ringOut()}
async function acceptCall(room,chatRoom){stopRing();if(call&&call.room===room)return;if(call)hangup(true);await enterVoice(room,"dm",chatRoom)}
async function joinVoiceGroup(){if(call)hangup(true);await enterVoice("voz-general","group",GEN)}
async function enterVoice(room,kind,chatRoom){const stream=await getMic();if(!stream)return false;
  call={room,kind,chat:chatRoom,peers:{},stream,muted:false,t0:Date.now()};
  sub(room,(ev,p)=>onSignal(ev,p));
  [350,1500,4000].forEach(ms=>setTimeout(()=>{if(call&&call.room===room&&!Object.keys(call.peers).length)cast(room,"v-join",{})},ms));
  clearInterval(call.tick);call.tick=setInterval(()=>{if(!call)return;paintShareBar();cast(call.room,"v-hb",{});
    const now=Date.now();Object.keys(call.peers).forEach(id=>{const pr=call.peers[id];if(now-(pr.at||now)>45000)dropPeer(id)});speakTick();
    if(call&&call.kind==="dm"&&!Object.keys(call.peers).length&&now-call.t0>45000){X.toast("No contestó.");hangup()}},1000);
  paintShareBar();paintBtn();if(view.room)paintRoom();
  X.toast(kind==="group"?"🎙 Entraste a la sala de voz del grupo.":"📞 Llamando…");return true}
function newPC(id,name){const pc=new RTCPeerConnection({iceServers:ice()});const pr=call.peers[id]=Object.assign(call.peers[id]||{},{pc,name,at:Date.now()});
  call.stream.getTracks().forEach(t=>pc.addTrack(t,call.stream));
  pc.onicecandidate=e=>{if(e.candidate&&call)cast(call.room,"v-ice",{to:id,c:e.candidate.toJSON?e.candidate.toJSON():e.candidate})};
  pc.ontrack=e=>{let a=pr.audio;if(!a){a=pr.audio=new Audio();a.autoplay=true;a.playsInline=true}a.srcObject=e.streams[0];a.play().catch(()=>{});
    try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();const src=actx.createMediaStreamSource(e.streams[0]);const an=actx.createAnalyser();an.fftSize=256;src.connect(an);pr.an=an}catch(x){}};
  pc.onconnectionstatechange=()=>{if(!call)return;if(pc.connectionState==="connected"){stopRingOut();paintShareBar()}
    if(pc.connectionState==="failed"){X.toast(`No se pudo conectar el audio con ${esc(name||"esa persona")} (su red lo bloquea).`);dropPeer(id)}};
  return pr}
async function onSignal(ev,p){if(!call||!p.from||p.from===ME.id)return;const id=p.from;
  if(ev==="v-hb"){if(call.peers[id])call.peers[id].at=Date.now();return}
  if(ev==="v-leave"){dropPeer(id);return}
  if(p.to&&p.to!==ME.id)return;
  if(ev==="v-join"){const ex=call.peers[id];if(ex&&ex.pc&&!["failed","closed"].includes(ex.pc.connectionState))return;if(ex)dropPeer(id,true);
    if(Object.keys(call.peers).length>=VMAX-1){cast(call.room,"v-full",{to:id});return}
    const pr=newPC(id,p.fname);try{const o=await pr.pc.createOffer();await pr.pc.setLocalDescription(o);cast(call.room,"v-offer",{to:id,sdp:sd(pr.pc.localDescription)})}catch(e){}paintShareBar()}
  else if(ev==="v-offer"){const pr=call.peers[id]&&call.peers[id].pc?call.peers[id]:newPC(id,p.fname);
    /* si los dos ofrecieron a la vez: cede el de id menor */
    if(pr.pc.signalingState==="have-local-offer"){if(ME.id>id)return;try{await pr.pc.setLocalDescription({type:"rollback"})}catch(e){}}
    try{await pr.pc.setRemoteDescription(p.sdp);const a=await pr.pc.createAnswer();await pr.pc.setLocalDescription(a);cast(call.room,"v-answer",{to:id,sdp:sd(pr.pc.localDescription)});flushIce(pr)}catch(e){}paintShareBar()}
  else if(ev==="v-answer"){const pr=call.peers[id];if(pr&&pr.pc){try{await pr.pc.setRemoteDescription(p.sdp);flushIce(pr)}catch(e){}}}
  else if(ev==="v-ice"){const pr=call.peers[id];if(!pr||!pr.pc)return;if(!pr.pc.remoteDescription){(pr.qi=pr.qi||[]).push(p.c);return}try{await pr.pc.addIceCandidate(p.c)}catch(e){}}
  else if(ev==="v-full"){X.toast("La sala de voz está llena.");hangup(true)}}
const sd=d=>d?{type:d.type,sdp:d.sdp}:null;
async function flushIce(pr){const q=pr.qi||[];pr.qi=[];for(const c of q){try{await pr.pc.addIceCandidate(c)}catch(e){}}}
function dropPeer(id,silent){if(!call)return;const pr=call.peers[id];if(!pr)return;try{pr.pc&&pr.pc.close()}catch(e){}if(pr.audio){pr.audio.srcObject=null}delete call.peers[id];paintShareBar();
  if(!silent&&call.kind==="dm"&&!Object.keys(call.peers).length&&Date.now()-call.t0>3000){X.toast("La llamada terminó.");hangup(true)}}
function hangup(quiet){if(!call)return;const c=call;call=null;cast(c.room,"v-leave",{});Object.keys(c.peers).forEach(id=>{const pr=c.peers[id];try{pr.pc&&pr.pc.close()}catch(e){}if(pr.audio)pr.audio.srcObject=null});
  c.stream&&c.stream.getTracks().forEach(t=>t.stop());clearInterval(c.tick);unsub(c.room);stopRingOut();
  if(c.kind==="dm"&&!quiet)send(c.chat,"","call",{room:c.room,act:"end"});
  paintShareBar();paintBtn();if(view.room)paintRoom();if(!quiet)X.toast("Colgaste.")}
function speakTick(){if(!call||!shBar)return;Object.keys(call.peers).forEach(id=>{const pr=call.peers[id];if(!pr.an)return;const d=new Uint8Array(pr.an.frequencyBinCount);pr.an.getByteFrequencyData(d);
  const v=d.reduce((a,b)=>a+b,0)/d.length;const el=shBar.querySelector(`[data-vp="${CSS.escape(id)}"]`);el&&el.classList.toggle("talk",v>18)})}
/* timbre: suave, se repite unos segundos */
let ringT=0,ringOutT=0;
function tone(f,dur,vol){try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=f;g.gain.setValueAtTime(.0001,actx.currentTime);g.gain.exponentialRampToValueAtTime(vol||.05,actx.currentTime+.03);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+dur);o.connect(g);g.connect(actx.destination);o.start();o.stop(actx.currentTime+dur+.02)}catch(e){}}
function incoming(m){const p=m.payload||{};if(!p.room||call)return;if(Date.now()-new Date(m.created_at)>60000)return;stopRing();
  ringing={room:p.room,chat:m.room,name:m.username||nameOf(m.sender),from:m.sender};
  const el=document.createElement("div");el.className="sring";el.innerHTML=`${av({id:m.sender,username:ringing.name,avatar_url:m.avatar_url})}<div class="sr-t"><b>${esc(ringing.name)}</b><small>📞 Te está llamando</small></div><button class="btn sm gold" data-a>Contestar</button><button class="btn sm" data-r>Ahora no</button>`;
  document.body.appendChild(el);ringing.el=el;
  el.querySelector("[data-a]").onclick=()=>{const r=ringing;acceptCall(r.room,r.chat)};
  el.querySelector("[data-r]").onclick=()=>stopRing();
  let n=0;const ring=()=>{if(!ringing||n++>12){stopRing();return}if(cfg().snd!==false){tone(660,.18,.05);setTimeout(()=>tone(880,.22,.05),220)}ringT=setTimeout(ring,2200)};ring()}
function stopRing(msg){clearTimeout(ringT);if(ringing&&ringing.el)ringing.el.remove();ringing=null;if(msg)X.toast(msg)}
function ringOut(){let n=0;const r=()=>{if(!call||Object.keys(call.peers).some(id=>call.peers[id].pc&&call.peers[id].pc.connectionState==="connected")||n++>15){if(call&&!Object.keys(call.peers).length&&n>15){X.toast("No contestó.");hangup()}return}tone(440,.4,.03);ringOutT=setTimeout(r,2500)};ringOutT=setTimeout(r,800)}
function stopRingOut(){clearTimeout(ringOutT)}

/* ===================== API pública ===================== */
window.EAGSocial={
  init(o){X=o;const pr=(X.API.profile&&X.API.profile())||{};const u=X.API.user&&X.API.user();if(!u)return;ME={id:u.id,name:pr.username||"Yo"};
    paintBtn();if(X.btn)X.btn.onclick=e=>{e.stopPropagation();panel?close():open()};
    localBus();rtConnect();loadThreads();setTimeout(loadPeople,2500);setInterval(()=>{if(!document.hidden&&!(panel&&!view.room))loadPeople()},60000);
    clearInterval(thrT);thrT=setInterval(()=>{if(document.hidden)return;if(!rtJoined)loadThreads();if(panel&&view.room&&!rtJoined)loadRoom(view.room)},rtJoined?60000:15000);
    if(cfg().hidden)X.API.chatHidden(true).catch(()=>{});
    /* si recargó la página mientras compartía, vuelve a entrar */
    try{const s=JSON.parse(sessionStorage.getItem("eag_share")||"null");if(s&&s.room)setTimeout(()=>joinShare(s.room,s.with),1500)}catch(e){}
    addEventListener("beforeunload",()=>{if(share)cast(share.room,"bye",{});if(call)cast(call.room,"v-leave",{})});
    addEventListener("keydown",e=>{if(e.key==="Escape"&&panel&&!view.room)close()})},
  drawingsChanged(){if(share){clearTimeout(share.dt);share.dt=setTimeout(()=>shareSend(),250)}},
  panesChanged(){applyShare()},
  laser(pt){if(share&&pt&&(pt.sym||pt.off))cast(share.room,"laser",{pt})},
  open:r=>open(r),dm:(id,n)=>startDM(id,n),
  state:()=>({share:!!share,call:!!call,voz:call?Object.keys(call.peers).map(id=>call.peers[id].pc&&call.peers[id].pc.connectionState):[],unread,people:people.length,threads:threads.length})};
})();
