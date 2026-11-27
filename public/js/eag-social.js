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
/* grupos: el general + los que crea el admin (cada uno con quién lo ve) */
let GROUPS=new Map();
const isGrp=r=>!!r&&r.startsWith("g:");
const myGrp=r=>r===GEN||GROUPS.has(r);
const gInfo=r=>r===GEN?{id:GEN,name:"Grupo general",emoji:"👥",descr:"Habla con todos los que usan EAG Charts"}:(GROUPS.get(r)||{id:r,name:"Grupo",emoji:"👥",descr:""});
async function loadGroups(){if(!X.API.chatGroups)return;try{const L=await X.API.chatGroups()||[];GROUPS=new Map(L.map(g=>[g.id,g]))}catch(e){}}
/* @todos: solo el profe; suena y vibra largo para que respondan */
const ALLRX=/(^|\s)@(todos|todas|everyone)(?=\s|$|[.,!?;:])/i;
const isAll=m=>!!(m&&m.is_admin&&isGrp(m.room)&&ALLRX.test(String(m.body||"")));
const VMAX=6; /* máximo de personas en una llamada (malla entre navegadores) */
const COLORS=["#4fc3f7","#ff8a65","#ba68c8","#81c784","#f06292","#ffd54f","#4dd0e1","#a1887f"];
let X=null,ME=null,panel=null,view={tab:"chats",room:null},threads=[],people=[],msgs={},unread=0,peopleT=0,thrT=0;
let rt=null,rtJoined=false,rtRef=0,rtHb=0,rtTok=0,bc=null;const topics={};   /* topic → handler */
const drafts={},replyTo={};let findQ="";   /* replyTo[room] = {id,n,t} mensaje que estás respondiendo */   /* lo que vas escribiendo no se pierde cuando llega algo y el chat se vuelve a dibujar */
let share=null;   /* {room,with,peers:{id:{name,color,sym,tf,boards,laser,at}},last,hbT,loopT} */
let call=null;    /* {room,kind:'dm'|'group',with,peers:{id:{pc,name,audio,an}},stream,muted,t0} */
let ringing=null; /* llamada entrante */

const cfg=()=>{X.SAVE.soc=Object.assign({snd:true,psnd:true,grpRing:true,vol:60,hidden:false,bub:true,head:true,hp:null,hs:56},X.SAVE.soc||{});return X.SAVE.soc};
const RX=["👍","🔥","😂","😮","🙏","💰","📈","📉","❤️"];
const dmRoom=id=>{const a=[ME.id,id].sort();return"dm:"+a[0]+":"+a[1]};
const otherOf=room=>room&&room.startsWith("dm:")?room.split(":").slice(1).find(x=>x!==ME.id):null;
const ini=n=>esc(String(n||"?").trim().charAt(0).toUpperCase()||"?");
const av=(u,cls)=>u&&u.avatar_url?`<img class="sav ${cls||""}" src="${esc(u.avatar_url)}" alt="" loading="lazy">`:`<span class="sav ${cls||""}" style="background:${colorOf(u&&(u.id||u.other||u.sender)||"")}">${ini(u&&u.username)}</span>`;
/* solo el admin: si es Miembro verificado y su plan (sutil, para saber a quién invitar) */
const PLN={cobre:"Cobre",plata:"Plata",oro:"Oro",diamond:"Diamond"};
function vb(u){if(!u||u.verified==null||u.is_admin||!X||!X.isAdmin())return"";
  return(u.verified?`<span class="sp-vb ok" title="Miembro verificado">✓</span>`:`<span class="sp-vb no" title="No es Miembro verificado: puedes invitarlo (⋯ → Invitar)">○</span>`)+(u.plan?`<span class="sp-vb pl" title="Plan activo">${esc(PLN[u.plan]||u.plan)}</span>`:"")}
const vInfo=id=>{const p=people.find(x=>x.id===id)||threads.find(x=>x.other===id);return p?{verified:p.verified,plan:p.plan,is_admin:p.is_admin}:null};
function colorOf(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return COLORS[h%COLORS.length]}
const hhmm=t=>{try{const d=new Date(t),n=new Date();const s=d.toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit"});return d.toDateString()===n.toDateString()?s:d.toLocaleDateString("es-CO",{day:"numeric",month:"short"})+" "+s}catch(e){return""}};
const nameOf=id=>{if(id===ME.id)return ME.name;const p=people.find(x=>x.id===id);if(p)return p.username;const t=threads.find(x=>x.other===id);return t?t.username:"Alguien"};
const uuid=()=>crypto.randomUUID?crypto.randomUUID():"r"+Date.now().toString(36)+Math.random().toString(36).slice(2);
function linkify(s){return esc(s).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|\s)@([\wÀ-ÿ.\-]{2,40})/g,(a,sp,n)=>`${sp}<b class="sp-at${/^(todos|todas|everyone)$/i.test(n)?" all":ME&&String(ME.name).toLowerCase()===n.toLowerCase()?" me":""}">@${n}</b>`).replace(/\n/g,"<br>")}
/* @menciones: lista de personas al escribir @ (conectados primero) */
function atPeople(){const M=new Map();const add=(id,n,a,on)=>{if(!id||!n||id===ME.id)return;const o=M.get(id);if(o){o.on=o.on||on;return}M.set(id,{id,n,a,on})};
  people.forEach(p=>add(p.id,p.username,p.avatar_url,true));(msgs[GEN]||[]).slice(-300).forEach(m=>add(m.sender,m.username,m.avatar_url,false));grpR.forEach(r=>add(r.user_id,r.username,r.avatar_url,false));
  threads.forEach(t=>t.other&&add(t.other,t.username,t.avatar_url,false));return[...M.values()]}
function atWire(ta,fm){let list=null,sel=0,items=[],q=null;
  const close=()=>{if(list){list.remove();list=null}q=null};
  const at=()=>{const pos=ta.selectionStart,before=ta.value.slice(0,pos),m=before.match(/(^|\s)@([\wÀ-ÿ.\-]{0,30})$/);return m?{start:pos-m[2].length-1,q:m[2].toLowerCase(),pos}:null};
  const pick=i=>{const it=items[i];if(!it||!q)return;const v=ta.value,ins="@"+it.n+" ";ta.value=v.slice(0,q.start)+ins+v.slice(q.pos);const c=q.start+ins.length;ta.setSelectionRange(c,c);ta.dispatchEvent(new Event("input"));close();ta.focus()};
  const paint=()=>{q=at();if(!q){close();return}const ALL=ME.admin&&isGrp(view.room)&&"todos".startsWith(q.q)?[{id:"__all",n:"todos",all:true}]:[];const L=ALL.concat(atPeople().map(p=>{const k=p.n.toLowerCase().indexOf(q.q);return{p,k}}).filter(x=>!q.q||x.k>=0)
      .sort((a,b)=>(b.p.on-a.p.on)||(a.k-b.k)||a.p.n.localeCompare(b.p.n)).slice(0,8).map(x=>x.p));items=L;if(!L.length){close();return}sel=Math.min(sel,L.length-1);
    if(!list){list=document.createElement("div");list.className="sp-atl";list.setAttribute("role","listbox");fm.appendChild(list)}
    list.innerHTML=`<small>Mencionar · se le avisa</small>`+L.map((p,i)=>p.all?`<button type="button" role="option" class="all${i===sel?" on":""}" data-i="${i}"><span class="sav sm grp">📣</span><span><b>@todos</b> <small>avisa fuerte a todo el grupo</small></span></button>`:`<button type="button" role="option" class="${i===sel?"on":""}" data-i="${i}">${av({id:p.id,username:p.n,avatar_url:p.a},"sm")}<span>${esc(p.n)}</span>${p.on?'<i class="ond"></i>':""}</button>`).join("");
    list.querySelectorAll("[data-i]").forEach(b=>{b.onpointerdown=e=>{e.preventDefault();pick(+b.dataset.i)}})};
  ta.addEventListener("input",()=>{sel=0;paint()});ta.addEventListener("click",paint);ta.addEventListener("blur",()=>setTimeout(close,150));
  return e=>{if(!list)return false;if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();sel=(sel+(e.key==="ArrowDown"?1:-1)+items.length)%items.length;paint();return true}
    if(e.key==="Enter"||e.key==="Tab"){e.preventDefault();pick(sel);return true}if(e.key==="Escape"){e.preventDefault();close();return true}return false}}

/* ===================== transporte en tiempo real ===================== */
function rtConnect(){if(!X.API.rt||rt)return;let ws;try{ws=new WebSocket(X.API.rt.url)}catch(e){return}rt=ws;rtJoined=false;
  ws.onopen=async()=>{const tok=await X.API.accessToken().catch(()=>null);
    rtSendRaw("realtime:eag-social","phx_join",{config:{broadcast:{ack:false,self:false},presence:{key:""},private:false,
      postgres_changes:[{event:"INSERT",schema:"public",table:"chart_msgs"},{event:"DELETE",schema:"public",table:"chart_msgs"},
        {event:"*",schema:"public",table:"chart_reacts"},{event:"*",schema:"public",table:"chart_reads",filter:"room=neq.g:general"}]},access_token:tok||undefined});
    Object.keys(topics).forEach(t=>joinTopic(t,tok));
    clearInterval(rtHb);rtHb=setInterval(()=>rtSendRaw("phoenix","heartbeat",{}),25000);
    clearInterval(rtTok);rtTok=setInterval(async()=>{const t=await X.API.accessToken().catch(()=>null);if(t){rtSendRaw("realtime:eag-social","access_token",{access_token:t});Object.keys(topics).forEach(k=>rtSendRaw(k,"access_token",{access_token:t}))}},10*60000)};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}
    if(m.topic==="realtime:eag-social"){
      if(m.event==="phx_reply"&&m.payload&&m.payload.status==="ok"&&m.payload.response&&m.payload.response.postgres_changes){rtJoined=true;loadThreads()}
      else if(m.event==="postgres_changes"){const d=(m.payload&&m.payload.data)||{},ty=d.eventType||d.type,rec=d.record||d.new,old=d.old_record||d.old,tb=d.table;
        if(tb==="chart_reacts"){if(ty==="DELETE"&&old)onReact(old,false);else if(rec)onReact(rec,true)}
        else if(tb==="chart_reads"){if(rec)onRead(rec)}
        else if(ty==="INSERT"&&rec)onMsg(rec);else if(ty==="DELETE"&&old&&old.id)onDel(old.id)}}
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
  bc.onmessage=e=>{const d=e.data||{};if(d.k==="msg"&&d.m)onMsg(d.m);else if(d.k==="del")onDel(d.id);else if(d.k==="rx")onReact(d.r,d.on);else if(d.k==="read")onRead(d.r);
    else if(d.k==="r"&&d.payload&&d.payload.from!==ME.id){const fn=topics["realtime:eag-r-"+d.room];fn&&fn(d.event,d.payload)}}}

/* ===================== datos ===================== */
async function loadThreads(){try{threads=(await X.API.chatThreads())||[]}catch(e){threads=threads||[]}
  unread=threads.reduce((a,t)=>a+(isGrp(t.room)?0:(+t.unread||0)),0);paintBtn();if(panel&&!view.room)paintPanel()}
/* menciones que te hicieron mientras no estabas: se avisan al entrar */
async function missedMentions(){if(!X.API.chatMyMentions)return;let L=[];try{L=await X.API.chatMyMentions()||[]}catch(e){return}
  L=L.filter(x=>x.sender!==ME.id);if(!L.length)return;const N=window.EAGN;
  const all=L.filter(x=>x.everyone);if(all.length){const x=all[0];loudAll({room:x.room||GEN,username:x.username,body:x.body,id:x.msg_id},true);L=L.filter(y=>!y.everyone);if(!L.length){try{await X.API.chatMentionsSeen()}catch(e){}return}}
  const go={label:"Ver en el grupo",fn:()=>{try{open(L[0].room||GEN)}catch(e){}}};
  if(N){if(L.length===1){const x=L[0];N.notify({cat:"msg",icon:"@",title:`${x.username||"Alguien"} te mencionó en el grupo`,body:String(x.body||"").slice(0,140),important:true,sound:"pop",act:go,key:"mm-"+x.msg_id})}
    else N.notify({cat:"msg",icon:"@",title:`Te mencionaron ${L.length} veces en el grupo`,body:[...new Set(L.map(x=>x.username||"Alguien"))].slice(0,4).join(", ")+" · mientras no estabas",important:true,sound:"pop",act:go,key:"mm-n"})}
  else X.toast(`@ Te mencionaron ${L.length} ${L.length===1?"vez":"veces"} en el grupo`);
  try{await X.API.chatMentionsSeen()}catch(e){}}
/* aviso fuerte de @todos: sonido largo, vibración larga, tarjeta fija y notificación del sistema */
function loudAll(m,missed){const who=m.username||nameOf(m.sender),g=gInfo(m.room),N=window.EAGN;
  const txt=String(m.body||"").replace(ALLRX,"$1").trim().slice(0,160)||"Llamado a todos";
  if(N)N.notify({cat:"msg",icon:"📣",title:`${who} llamó a todos${m.room===GEN?"":" en "+g.name}${missed?" (mientras no estabas)":""}`,body:txt,important:true,sticky:true,sound:"llamado",vibrate:[600,180,600,180,1100],
    act:{label:"Responder",fn:()=>{try{open(m.room)}catch(e){}}},key:"all-"+(m.id||txt),dedupe:600000,sys:true});
  else{X.toast("📣 "+who+": "+txt)}}
async function loadPeople(){try{people=(await X.API.chatPeople())||[]}catch(e){}paintBtn();if(panel&&!view.room)paintPanel()}
async function loadRoom(room,more){const L=msgs[room]||(msgs[room]=[]);const before=more&&L.length?L[0].id:null;
  try{const r=((await X.API.chatHistory(room,before))||[]).slice().reverse();
    const end=r.length<50,was=!!L.__end;msgs[room]=more?r.concat(L):mergeMsgs(L,r);msgs[room].__end=more?end:(was||end)}catch(e){X.toast("No se pudo cargar el chat.")}
  if(view.room===room)paintRoom(!more)}
function mergeMsgs(a,b){const m=new Map();a.concat(b).forEach(x=>m.set(x.id,Object.assign({},m.get(x.id)||{},x)));return[...m.values()].sort((x,y)=>x.id-y.id)}
const readAt={};
function markRead(room){const L=msgs[room];if(!L||!L.length)return;const last=L[L.length-1].id;const t=threads.find(x=>x.room===room);if(t){t.unread=0}
  unread=threads.reduce((a,t)=>a+(isGrp(t.room)?0:(+t.unread||0)),0);paintBtn();if(readAt[room]===last)return;readAt[room]=last;X.API.chatRead(room,last).catch(()=>{});if(isGrp(room)&&X.API.chatMentionsSeen)X.API.chatMentionsSeen().catch(()=>{});if(bc)bc.postMessage({k:"read",r:{user_id:ME.id,room,last_id:last}})}
/* Grupo: quién leyó cada mensaje (se pregunta cada ~15 s mientras el grupo está abierto) */
let grpR=[],grpRT=0,grpRBusy=false;
let grpRRoom=null;
function loadGrpReads(force){const room=view.room;if(!isGrp(room)||!X.API.chatGroupReads||grpRBusy)return;const L=msgs[room];if(!L||!L.length)return;if(!force&&grpRRoom===room&&Date.now()-grpRT<12000)return;
  if(grpRRoom!==room){grpR=[];grpRRoom=room}grpRT=Date.now();grpRBusy=true;X.API.chatGroupReads(L[0].id,room).then(r=>{const old=JSON.stringify(grpR);grpR=(r||[]).filter(x=>x.user_id!==ME.id);if(view.room===room&&JSON.stringify(grpR)!==old)paintRoom()}).catch(()=>{}).finally(()=>{grpRBusy=false})}
const readersOf=m=>grpR.filter(r=>(+r.last_id||0)>=m.id&&r.user_id!==m.sender);
function eyePop(id,anchor){const old=document.querySelector(".sp-eyes");if(old){old.remove();if(old.dataset.id===String(id))return}const m=(msgs[view.room]||[]).find(x=>x.id===id);if(!m)return;const R=readersOf(m);
  const el=document.createElement("div");el.className="sp-eyes";el.dataset.id=id;el.innerHTML=`<b>👁 Visto por ${R.length}</b><div>${R.map(r=>`<span>${av({id:r.user_id,username:r.username,avatar_url:r.avatar_url},"sm")}<i>${esc(r.username||"Usuario")}</i></span>`).join("")||"<small>Nadie todavía</small>"}</div>`;
  document.body.appendChild(el);const a=anchor.getBoundingClientRect();el.style.left=Math.max(8,Math.min(innerWidth-el.offsetWidth-8,a.right-el.offsetWidth))+"px";el.style.top=(a.top-el.offsetHeight-6>8?a.top-el.offsetHeight-6:a.bottom+6)+"px";
  setTimeout(()=>addEventListener("pointerdown",function f(e){if(!el.contains(e.target)){el.remove();removeEventListener("pointerdown",f,true)}},true),0)}
setInterval(()=>{if(panel&&isGrp(view.room)&&!document.hidden)loadGrpReads(true)},15000);
/* "Visto": hasta dónde leyó la otra persona */
function onRead(r){if(!r||!r.room||r.user_id===ME.id||isGrp(r.room))return;const t=threads.find(x=>x.room===r.room);if(!t)return;
  if((+r.last_id||0)>(+t.other_read||0)){t.other_read=+r.last_id;if(view.room===r.room)paintRoom()}}
/* reacciones */
function onReact(r,on){if(!r||!r.msg_id)return;const L=msgs[r.room]||Object.values(msgs).find(a=>a.some(x=>x.id===r.msg_id));if(!L)return;const m=L.find(x=>x.id===r.msg_id);if(!m)return;
  const rx=m.reacts=Object.assign({},m.reacts||{});const a=(rx[r.emoji]||[]).filter(u=>u!==r.user_id);if(on)a.push(r.user_id);if(a.length)rx[r.emoji]=a;else delete rx[r.emoji];
  if(on&&r.user_id!==ME.id&&m.sender===ME.id)SND.play("react");if(view.room===m.room)paintRoom()}
async function react(id,emoji,room){try{const on=await X.API.chatReact(id,emoji);const r={msg_id:id,user_id:ME.id,emoji,room};onReact(r,on);if(bc)bc.postMessage({k:"rx",r,on});if(on)SND.play("react")}catch(e){X.toast(esc(e.message||"No se pudo reaccionar."))}}

/* mensaje nuevo (de Realtime o de otra pestaña en modo local) */
function onMsg(m){if(!m||!m.room)return;if(isGrp(m.room)&&!myGrp(m.room)){if(!onMsg.__l||Date.now()-onMsg.__l>5000){onMsg.__l=Date.now();loadGroups().then(()=>{if(myGrp(m.room))onMsg(m)})}return}if(!(myGrp(m.room)||(m.room.startsWith("dm:")&&m.room.includes(ME.id))))return;
  if(!m.username)m.username=nameOf(m.sender);
  const L=msgs[m.room];if(L&&!L.some(x=>x.id===m.id)){L.push(m)}
  let t=threads.find(x=>x.room===m.room);
  if(!t){t={room:m.room,other:otherOf(m.room),username:m.sender===ME.id?nameOf(otherOf(m.room)):m.username,unread:0};threads.unshift(t)}
  Object.assign(t,{last_id:m.id,last_body:m.body,last_kind:m.kind,last_sender:m.sender,last_at:m.created_at});
  threads.sort((a,b)=>(b.last_id||0)-(a.last_id||0));
  const mine=m.sender===ME.id,open=panel&&view.room===m.room&&!document.hidden;
  const inOther=panel&&view.room&&view.room!==m.room&&!document.hidden;
  if(!mine&&isAll(m)){loudAll(m);if(window.EAGN&&X.API.chatMentionsSeen&&open)X.API.chatMentionsSeen().catch(()=>{})}
  if(!mine&&!open){t.unread=(+t.unread||0)+1;if(!isGrp(m.room)||mentioned(m)||m.is_admin){if(inOther)peek(m);else headNotify(m);if(!isAll(m))SND.play(!isGrp(m.room)?"in":mentioned(m)?"mention":"in");
    /* queda en el centro de avisos y, con la pestaña de fondo, llega como notificación del sistema (sin repetir sonido ni tarjeta) */
    try{if(window.EAGN&&m.kind!=="call"){const who=m.username||nameOf(m.sender),txt=m.kind==="img"?"📷 Imagen":m.kind==="audio"?"🎤 Nota de voz":m.kind==="share"?"📡 Compartió su gráfico":String(m.body||"").slice(0,120);
      if(!isAll(m))window.EAGN.notify({cat:"msg",icon:isGrp(m.room)?(mentioned(m)?"@":gInfo(m.room).emoji):"💬",title:isGrp(m.room)?(mentioned(m)?`${who} te mencionó${m.room===GEN?"":" en "+gInfo(m.room).name}`:`${who} en ${m.room===GEN?"el grupo":gInfo(m.room).name}`):`Mensaje de ${who}`,body:txt,card:false,sound:false,tag:"msg-"+m.room,key:"msg-"+m.id})}}catch(e){}}}
  else if(!mine&&open)SND.play("inSoft");
  if(!mine&&typers[m.room]){delete typers[m.room][m.sender];paintTyping()}
  if(!mine&&m.kind==="call"&&m.payload&&m.payload.act==="start")m.room===GEN?incomingGroup(m):incoming(m);
  if(!mine&&m.kind==="call"&&m.payload&&m.payload.act==="end"){if(ringing&&ringing.room===m.payload.room)stopRing("La llamada terminó.");if(call&&call.room===m.payload.room){X.toast("La otra persona colgó.");hangup(true)}}
  unread=threads.reduce((a,x)=>a+(isGrp(x.room)?0:(+x.unread||0)),0);paintBtn();
  if(open){paintRoom(true);markRead(m.room)}else if(panel&&!view.room)paintPanel();else if(inOther)backBadge()}
/* dentro de un chat: número en la flecha de volver con lo que te escribieron en otros chats */
function backBadge(){if(!panel||!view.room)return;const b=panel.querySelector("[data-back]");if(!b)return;
  const n=threads.reduce((a,t)=>a+(t.room!==view.room&&t.room!==GEN?(+t.unread||0):0),0),g=view.room!==GEN&&threads.some(t=>t.room===GEN&&+t.unread>0);
  const e=b.querySelector("em"),d=b.querySelector("i");if(e){e.hidden=!n;e.textContent=n>9?"9+":String(n)}if(d)d.hidden=!!n||!g;
  b.title=n?`Tienes ${n} mensaje${n>1?"s":""} sin leer en otros chats`:g?"Hay mensajes nuevos en el grupo":"Volver a tus chats"}
/* aviso dentro del panel cuando te escriben en otro chat */
function peek(m){if(!panel)return;const old=panel.querySelector(".sp-peek");if(old)old.remove();const who=m.username||nameOf(m.sender);
  const el=document.createElement("button");el.className="sp-peek";el.innerHTML=`${m.room===GEN?`<span class="sav sm grp">👥</span>`:av({id:m.sender,username:who,avatar_url:m.avatar_url},"sm")}<span><b>${esc(m.room===GEN?"Grupo · "+who:who)}</b><small>${esc(snip(m))}</small></span><em>Ver</em>`;
  const h=panel.querySelector(".sp-h");h?h.after(el):panel.prepend(el);el.onclick=()=>{el.remove();open(m.room)};setTimeout(()=>{if(el.isConnected){el.classList.add("out");setTimeout(()=>el.remove(),300)}},5000)}
function onDel(id){Object.keys(msgs).forEach(r=>{const L=msgs[r];const i=L.findIndex(x=>x.id===id);if(i>=0){L.splice(i,1);if(view.room===r)paintRoom()}})}
const mentioned=m=>new RegExp("@"+String(ME.name).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(m.body||"");

async function send(room,body,kind,payload){try{const m=await X.API.chatSend(room,body,kind,payload);if(m){m.username=ME.name;m.is_admin=X.isAdmin();SND.play("out");
      if(bc)bc.postMessage({k:"msg",m});onMsg(m)}return m}
  catch(e){X.toast(esc((e&&e.message)||"No se pudo enviar."));return null}}

/* ===================== botón y panel ===================== */
function paintBtn(){const b=X.btn;if(!b)return;const n=unread;const e=b.querySelector(".badge");if(e){e.hidden=!n;e.textContent=n>9?"9+":String(n)}
  const on=b.querySelector(".scnt");if(on)on.textContent=people.length?String(people.length):"";b.classList.toggle("live",!!(share||call));headPaint()}
let lastRoom=null;
const mobile=()=>matchMedia("(max-width:640px)").matches;
/* panel movible y de tamaño ajustable (PC): se arrastra desde la barra de arriba y se estira desde las esquinas; se guarda */
function geo(){if(!panel)return;if(mobile()){panel.style.cssText="";document.body.classList.remove("socfree");return}const g=cfg().pp;
  if(!g){panel.style.cssText="";document.body.classList.remove("socfree");return}document.body.classList.add("socfree");
  const W=innerWidth,H=innerHeight,w=Math.max(300,Math.min(W-16,g.w)),h=Math.max(320,Math.min(H-16,g.h));
  const x=Math.max(8,Math.min(W-w-8,g.x)),y=Math.max(8,Math.min(H-h-8,g.y));
  Object.assign(panel.style,{left:x+"px",top:y+"px",width:w+"px",height:h+"px",right:"auto",bottom:"auto",maxWidth:"none"})}
function handles(){if(!panel||mobile())return;["se","sw","ne","nw"].forEach(k=>{if(panel.querySelector(".sp-rs."+k))return;const d=document.createElement("i");d.className="sp-rs "+k;d.title="Arrastra para cambiar el tamaño";panel.appendChild(d)})}
function panelDrag(){panel.addEventListener("pointerdown",e=>{if(mobile()||e.button!==0)return;const rs=e.target.closest(".sp-rs"),hd=e.target.closest(".sp-h");
    if(!rs&&(!hd||e.target.closest("button,input,a,textarea,select")))return;e.preventDefault();
    const r=panel.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,k=rs?rs.className.split(" ")[1]:null;panel.classList.add("moving");
    const mv=ev=>{const dx=ev.clientX-sx,dy=ev.clientY-sy;let g={x:r.left,y:r.top,w:r.width,h:r.height};
      if(!k){g.x+=dx;g.y+=dy}else{if(k.includes("e"))g.w+=dx;if(k.includes("s"))g.h+=dy;if(k.includes("w")){g.w-=dx;g.x+=dx}if(k.includes("n")){g.h-=dy;g.y+=dy}
        if(g.w<300){if(k.includes("w"))g.x-=300-g.w;g.w=300}if(g.h<320){if(k.includes("n"))g.y-=320-g.h;g.h=320}}
      cfg().pp=g;geo()};
    const up=()=>{removeEventListener("pointermove",mv);removeEventListener("pointerup",up);panel&&panel.classList.remove("moving");X.save()};
    addEventListener("pointermove",mv);addEventListener("pointerup",up)});
  panel.addEventListener("dblclick",e=>{if(e.target.closest(".sp-h")&&!e.target.closest("button,input")){cfg().pp=null;X.save();geo();X.toast("Panel del chat en su lugar original.")}})}
function minimize(){lastRoom=view.room;close();if(!cfg().head){cfg().head=true;X.save();headPaint()}}
function open(room){if(!panel){panel=document.createElement("aside");panel.className="socp";document.body.appendChild(panel);document.body.classList.add("socopen");
    panel.addEventListener("keydown",e=>e.stopPropagation());panelDrag();geo();clearInterval(peopleT);peopleT=setInterval(()=>{if(!document.hidden&&panel&&!view.room)loadPeople()},15000)}
  headPaint();if(room){view.room=room;typingSub(room);loadRoom(room);paintRoom(true);loadPeople().then(()=>{if(view.room===room)paintRoom()})}else{view.room=null;paintPanel();loadThreads();loadPeople()}}
function close(){findQ="";if(panel){panel.remove();panel=null}document.body.classList.remove("socopen");typingSub(null);setTimeout(headPaint,0);view.room=null;clearInterval(peopleT)}
let findFoc=false;
function paintPanel(){if(!panel)return;{const of=panel.querySelector("[data-find]");findFoc=!!(of&&document.activeElement===of);if(of)findQ=of.value}const tab=view.tab;
  const grs=[GEN].concat([...GROUPS.keys()]).map(id=>Object.assign({room:id},threads.find(t=>t.room===id)||{}));
  const dms=threads.filter(t=>!isGrp(t.room));
  panel.innerHTML=`<div class="sp-h"><b>Comunidad</b><span class="sp-on"><i></i>${people.length} en los charts</span><button class="sx" data-min title="Minimizar (queda en la burbuja)">—</button><button class="sx" data-x title="Cerrar">✕</button></div>
  <div class="sp-tabs"><button data-tab="chats" class="${tab==="chats"?"on":""}">Chats${unread?` <em>${unread>9?"9+":unread}</em>`:""}</button><button data-tab="people" class="${tab==="people"?"on":""}">Conectados <small>${people.length}</small></button><button data-tab="cfg" class="${tab==="cfg"?"on":""}" title="Opciones">⚙</button></div>
  <div class="sp-body">${tab==="chats"?`
    <div class="sp-find"><input type="search" placeholder="Buscar a alguien para escribirle…" data-find autocomplete="off"><div class="sp-res" data-res></div></div>
    <div class="sp-gh"><small>Grupos</small>${ME.admin?`<button class="btn sm" data-gnew title="Crear un grupo y elegir quién lo ve">＋ Grupo</button>`:""}</div>
    ${grs.map(g=>thRow(g)).join("")}<div class="sp-gh"><small>Privados</small></div>
    ${dms.length?dms.map(t=>thRow(t)).join(""):`<p class="sp-empty">Aún no tienes chats privados. Ve a <b>Conectados</b> y escríbele a alguien, o búscalo arriba.</p>`}`
  :tab==="people"?(people.length?people.map(p=>`<div class="sp-row" data-dm="${esc(p.id)}" data-n="${esc(p.username)}">${av(p)}<div class="sp-t"><b>${esc(p.username||"Usuario")}${p.is_admin?' <span class="sp-tag">Profe</span>':""}${p.id===ME.id?' <span class="sp-tag me">Tú</span>':vb(p)}</b><small>${p.symbol_name||p.symbol?`📈 ${esc(p.symbol_name||p.symbol)}${p.tf?" · "+esc(p.tf):""}`:"En EAG Charts"}</small></div>${p.id===ME.id?"":`<button class="btn sm" data-dm="${esc(p.id)}" data-n="${esc(p.username)}">💬</button>`}</div>`).join(""):`<p class="sp-empty">Nadie más conectado ahora.</p>`)
  :`<div class="sp-cfg">
     <label class="sp-ck"><input type="checkbox" data-c="head"${cfg().head?" checked":""}><span><b>Burbuja flotante de chat</b><small>Como Messenger: la mueves por toda la pantalla, muestra tus mensajes nuevos y al tocarla abre el chat. Arrástrala a la ✕ de abajo para esconderla.</small></span></label>
     <div class="sp-vol">🪟 Panel del chat <small class="sp-hsv" style="flex:1;text-align:left;white-space:normal">Arrástralo desde arriba y estíralo desde las esquinas</small><button class="btn sm" data-pprst>Restablecer</button></div>
     <label class="sp-vol">🫧 Tamaño de la burbuja <input type="range" min="40" max="88" step="2" value="${hsz()}" data-hs><span class="sp-hsv">${hsz()} px</span></label>
     <div class="sp-hsbox"><span class="shead sp-hsprev" style="--hs:${hsz()}px"><span class="sh-ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg></span><em>2</em></span><small>Así se verá</small></div>
     <label class="sp-ck"><input type="checkbox" data-c="bub"${cfg().bub?" checked":""}><span><b>Avance del mensaje</b><small>Junto a la burbuja sale unos segundos quién te escribió y qué dijo.</small></span></label>
     <label class="sp-ck"><input type="checkbox" data-c="snd"${cfg().snd?" checked":""}><span><b>Sonidos del chat</b><small>Al recibir y enviar mensajes, menciones, reacciones y llamadas.</small></span></label>
     <label class="sp-ck"><input type="checkbox" data-c="grpRing"${cfg().grpRing?" checked":""}><span><b>Avisos de llamadas grupales</b><small>Timbre y aviso grande cuando alguien abre la llamada del grupo. Apagado: solo sale un aviso pequeño, sin sonido.</small></span></label>
     <label class="sp-ck"><input type="checkbox" data-c="psnd"${cfg().psnd?" checked":""}><span><b>Sonidos de la plataforma</b><small>Toquecitos suaves al terminar un dibujo y al entrar o salir de un gráfico compartido.</small></span></label>
     <div class="sp-vol">🎤 Micrófono <span class="sp-lvl"><i></i></span><button class="btn sm" data-mic>Probar micrófono</button></div>
     <label class="sp-vol">🔊 Volumen <input type="range" min="10" max="100" step="5" value="${cfg().vol}" data-vol><button class="btn sm" data-tst>Probar</button></label>
     <label class="sp-ck"><input type="checkbox" data-c="hidden"${cfg().hidden?" checked":""}><span><b>Aparecer invisible</b><small>No sales en Conectados. Igual puedes escribir y recibir mensajes.</small></span></label>
     <p class="sp-note">🕒 El chat guarda solo los mensajes y fotos de los <b>últimos 10 días</b>; lo más viejo se borra solo.<br>🔒 Los chats privados solo los ven las 2 personas. En el grupo general escribe con respeto: el profe puede borrar mensajes y silenciar a quien haga spam.</p></div>`}</div>`;
  panel.querySelector("[data-x]").onclick=close;panel.querySelector("[data-min]").onclick=minimize;handles();
  panel.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{view.tab=b.dataset.tab;paintPanel();if(view.tab==="people")loadPeople()});
  panel.querySelectorAll("[data-room]").forEach(b=>b.onclick=()=>open(b.dataset.room));
  const gn=panel.querySelector("[data-gnew]");if(gn)gn.onclick=()=>groupEditor(null);
  panel.querySelectorAll("[data-hide]").forEach(b=>b.onclick=e=>{e.stopPropagation();if(!confirmSoft(b,"¿Eliminar?"))return;hideChat(b.dataset.hide)});
  panel.querySelectorAll("[data-dm]").forEach(b=>b.onclick=e=>{e.stopPropagation();startDM(b.dataset.dm,b.dataset.n)});
  const pr=panel.querySelector("[data-pprst]");if(pr)pr.onclick=()=>{cfg().pp=null;X.save();geo();X.toast("Panel en su lugar original.")};
  const hs=panel.querySelector("[data-hs]");if(hs)hs.oninput=()=>{cfg().hs=+hs.value;X.save();panel.querySelector(".sp-hsv").textContent=hs.value+" px";
    const pv=panel.querySelector(".sp-hsprev");if(pv)pv.style.setProperty("--hs",hs.value+"px");headPaint()};
  const mb=panel.querySelector("[data-mic]");if(mb)mb.onclick=async()=>{mb.disabled=true;const ok=await micTest(panel.querySelector(".sp-lvl i"));mb.disabled=false;if(ok)X.toast("🎤 Habla: la barra se mueve si tu micrófono funciona.")};
  const vl=panel.querySelector("[data-vol]");if(vl){vl.oninput=()=>{cfg().vol=+vl.value;X.save()};vl.onchange=()=>SND.play("in",true);panel.querySelector("[data-tst]").onclick=()=>SND.play("in",true)}
  panel.querySelectorAll("[data-c]").forEach(i=>i.onchange=()=>{cfg()[i.dataset.c]=i.checked;X.save();if(i.dataset.c==="head")headPaint();if(i.dataset.c==="hidden")X.API.chatHidden(i.checked).then(loadPeople).catch(()=>X.toast("No se pudo cambiar."))});
  const f=panel.querySelector("[data-find]");if(f&&findQ){f.value=findQ;if(findFoc){f.focus();try{f.setSelectionRange(findQ.length,findQ.length)}catch(e){}}setTimeout(()=>f.oninput&&f.oninput(),0)}
  if(f){let ft=0;f.oninput=()=>{findQ=f.value;clearTimeout(ft);ft=setTimeout(async()=>{const q=f.value.trim(),box=panel.querySelector("[data-res]");if(!box)return;if(q.length<2){box.innerHTML="";return}
      let r=[];try{r=(await X.API.chatFind(q))||[]}catch(e){}box.innerHTML=r.filter(u=>u.id!==ME.id).map(u=>`<button class="sp-row" data-dm="${esc(u.id)}" data-n="${esc(u.username)}">${av(u)}<div class="sp-t"><b>${esc(u.username)}${vb(u)}</b><small>Escribirle</small></div></button>`).join("")||`<p class="sp-empty">No encontramos a nadie con ese nombre.</p>`;
      box.querySelectorAll("[data-dm]").forEach(b=>b.onclick=()=>startDM(b.dataset.dm,b.dataset.n))},250)}}}
function thRow(t){const isG=isGrp(t.room),GI=isG?gInfo(t.room):null,on=!isG&&(people.some(p=>p.id===t.other)||t.online);
  const last=t.last_body!=null||t.last_kind?`${t.last_sender===ME.id?"Tú: ":isG&&t.last_sender?esc(nameOf(t.last_sender))+": ":""}${t.last_kind==="share"?"📡 Compartió su gráfico":t.last_kind==="call"?"📞 Llamada":t.last_kind==="img"?"📷 Foto":t.last_kind==="audio"?"🎤 Nota de voz":t.last_kind==="idea"?"📈 Idea":esc(String(t.last_body||"").slice(0,60))}`:(isG?esc(GI.descr||"Grupo"):"");
  return`<button class="sp-row th${t.unread?" un":""}" data-room="${esc(t.room)}">${isG?`<span class="sav grp">${esc(GI.emoji||"👥")}</span>`:av({id:t.other,username:t.username,avatar_url:t.avatar_url})}${on?'<i class="sp-dot"></i>':""}
    <div class="sp-t"><b>${esc(isG?GI.name:t.username||"Usuario")}${isG&&ME.admin&&GI.n_members!=null?` <span class="sp-tag me" title="Personas que pueden ver este grupo">${GI.n_members} 👁</span>`:""}${t.is_admin?' <span class="sp-tag">Profe</span>':isG?"":vb(t)}</b><small>${last}</small></div>
    <div class="sp-m">${t.last_at?`<small>${hhmm(t.last_at)}</small>`:""}${t.unread?`<em>${t.unread>9?"9+":t.unread}</em>`:""}</div>${isG?"":`<span class="sp-thx" data-hide="${esc(t.room)}" title="Eliminar este chat (solo para ti)">🗑</span>`}</button>`}
function startDM(id,name){if(!id||id===ME.id)return;const room=dmRoom(id);if(!threads.find(t=>t.room===room))threads.unshift({room,other:id,username:name||nameOf(id),unread:0});view.tab="chats";open(room)}

function paintRoom(toBottom){if(!panel||!view.room)return;const room=view.room,isG=isGrp(room),GI=gInfo(room),oid=otherOf(room),t=threads.find(x=>x.room===room)||{};
  const name=isG?GI.name:(t.username||nameOf(oid)),online=isG||people.some(p=>p.id===oid);const L=msgs[room]||[];
  const body=panel.querySelector(".sp-msgs");const atBot=!body||body.scrollHeight-body.scrollTop-body.clientHeight<90;
  if(atBot)toBottom=true;const keep=body&&!toBottom?body.scrollHeight-body.scrollTop:null;
  const ota=panel.querySelector(".sp-in textarea");let foc=null;
  if(ota&&ota.dataset.room===room){drafts[room]=ota.value;if(document.activeElement===ota)foc={a:ota.selectionStart,b:ota.selectionEnd}}
  const inShare=share&&share.room&&share.with===room,inCall=call&&call.chat===room;
  panel.innerHTML=`<div class="sp-h"><button class="sx sp-back" data-back title="Volver a tus chats">‹<em hidden></em><i hidden></i></button>${isG?`<span class="sav grp">${esc(GI.emoji||"👥")}</span>`:av({id:oid,username:name,avatar_url:t.avatar_url})}
    <div class="sp-ht"><b>${esc(name)}${isG?"":vb(Object.assign({},t,vInfo(oid)||{},{plan:null}))}</b><small class="sp-sub">${isG?(room===GEN?`${people.length} conectado${people.length===1?"":"s"} ahora`:esc(GI.descr||(GI.only_admin?"Canal de avisos del profe":"Grupo"))):online?"🟢 En los charts":"No está conectado"}</small></div>
    <div class="sp-act">${isG&&room!==GEN&&ME.admin?`<button class="btn sm" data-gedit="${esc(room)}" title="Editar grupo y quién lo ve">⚙</button>`:""}${room===GEN?`<button class="btn sm${call&&call.kind==="group"?" on":""}" data-vg title="Sala de voz del grupo (hasta ${VMAX})">🎙</button>`:isG?"":`<button class="btn sm${inShare?" on":""}" data-sh title="Compartir tu gráfico: tus dibujos salen en el suyo con tu nombre y los suyos en el tuyo">📡</button><button class="btn sm${inCall?" on":""}" data-call title="Llamada de voz">📞</button>`}<button class="sx" data-menu title="Más opciones">⋯</button><button class="sx" data-min title="Minimizar (queda en la burbuja)">—</button><button class="sx" data-x title="Cerrar">✕</button></div></div>
  <div class="sp-msgs">${seenMark(L,t,isG),""}${L.__end||!L.length?"":`<button class="sp-more" data-more>Ver mensajes anteriores</button>`}${L.length?L.map((m,i)=>msgRow(m,L[i-1],isG)).join(""):`<p class="sp-empty">${isG?"Saluda al grupo 👋":"Escríbele el primer mensaje 👋"}</p>`}</div>
  <div class="sp-typ" data-typ></div>${replyTo[room]?`<div class="sp-rep"><span><b>↩ Respondiendo a ${esc(replyTo[room].n)}</b><small>${esc(replyTo[room].t)}</small></span><button class="sx" data-unrep title="Cancelar respuesta">✕</button></div>`:""}
  ${isG&&GI.only_admin&&!ME.admin?`<div class="sp-ro">📣 En este grupo solo escribe el profe. Puedes reaccionar a los mensajes.</div>`:""}<form class="sp-in${isG&&GI.only_admin&&!ME.admin?" ro":""}" data-room="${esc(room)}"><button type="button" class="sp-idea" data-pic title="Enviar una foto o captura (también puedes pegarla con Ctrl+V o arrastrarla aquí)">📷</button><input type="file" accept="image/*" data-file hidden><button type="button" class="sp-idea" data-idea title="Compartir una idea: tu mercado, temporalidad y precio actual (escribe tu análisis y toca aquí)">📈</button><button type="button" class="sp-idea sp-vnote" data-mic title="Nota de voz: toca para grabar">🎤</button><textarea rows="1" maxlength="1000" placeholder="${isG?(ME.admin?"Escribe al grupo… (@nombre menciona · @todos avisa a todos)":"Escribe al grupo… (usa @nombre para mencionar)"):"Escribe un mensaje…"}"></textarea><button class="btn gold sm" type="submit" title="Enviar">➤</button></form>`;
  const box=panel.querySelector(".sp-msgs");box.__pin=keep==null;const pin=()=>{if(box.__pin)box.scrollTop=box.scrollHeight};
  if(keep!=null)box.scrollTop=box.scrollHeight-keep;else pin();
  /* el último mensaje siempre a la vista: al cargar fotos, al crecer la caja de texto o al cambiar el tamaño del panel */
  box.addEventListener("scroll",()=>{box.__pin=box.scrollHeight-box.scrollTop-box.clientHeight<90},{passive:true});
  box.querySelectorAll("img").forEach(im=>{if(!im.complete)im.addEventListener("load",pin,{once:true})});
  try{const ro=new ResizeObserver(pin);ro.observe(box);box.__ro=ro}catch(e){}
  panel.querySelector("[data-back]").onclick=()=>{view.room=null;typingSub(null);paintPanel();loadThreads()};backBadge();
  panel.querySelector("[data-x]").onclick=close;panel.querySelector("[data-min]").onclick=minimize;handles();
  const mb=panel.querySelector("[data-more]");if(mb)mb.onclick=()=>loadRoom(room,true);
  const ta=panel.querySelector("textarea"),fm=panel.querySelector(".sp-in");ta.dataset.room=room;
  if(drafts[room]){ta.value=drafts[room];ta.style.height="auto";ta.style.height=Math.min(120,ta.scrollHeight)+"px"}
  ta.oninput=()=>{drafts[room]=ta.value;ta.style.height="auto";ta.style.height=Math.min(120,ta.scrollHeight)+"px";typingPing(room)};
  panel.querySelector("[data-idea]").onclick=async()=>{const i=ideaNow();if(!i)return X.toast("Abre un gráfico primero.");
    /* foto del gráfico con todos los dibujos y zonas */
    try{X.toast("📸 Tomando la foto del gráfico…");const b=await chartPic();if(b){const url=await X.API.chartChatUpload(b.blob);i.img={url,w:b.w,h:b.h}}}catch(e){}const v=ta.value.trim();ta.value="";drafts[room]="";ta.style.height="auto";const rp=takeReply(room);if(rp)i.reply=rp;await send(room,v,"idea",i)};
  paintTyping();
  panel.querySelector("[data-mic]").onclick=()=>recStart(room,fm);
  if(rec&&rec.room===room&&rec.bar){fm.appendChild(rec.bar);fm.classList.add("recording");rec.fm=fm}
  box.querySelectorAll(".vn-aud").forEach(audWire);
  const fi=panel.querySelector("[data-file]");panel.querySelector("[data-pic]").onclick=()=>fi.click();fi.onchange=()=>{const f=fi.files&&fi.files[0];fi.value="";if(f)sendImg(room,f,ta)};
  ta.onpaste=e=>{const it=[...(e.clipboardData&&e.clipboardData.items||[])].find(x=>x.type.startsWith("image/"));if(it){e.preventDefault();sendImg(room,it.getAsFile(),ta)}};
  const drop=panel.querySelector(".sp-msgs");drop.ondragover=e=>{if([...(e.dataTransfer.items||[])].some(x=>x.type.startsWith("image/"))){e.preventDefault();drop.classList.add("over")}};
  drop.ondragleave=()=>drop.classList.remove("over");drop.ondrop=e=>{drop.classList.remove("over");const f=[...(e.dataTransfer.files||[])].find(x=>x.type.startsWith("image/"));if(f){e.preventDefault();sendImg(room,f,ta)}};
  panel.querySelector("[data-menu]").onclick=e=>{e.stopPropagation();roomMenu(e.currentTarget,room)};
  box.querySelectorAll(".sp-img").forEach(im=>im.onclick=()=>lightbox(im.dataset.full||im.src));
  const atKey=atWire(ta,fm);
  ta.onkeydown=e=>{e.stopPropagation();if(atKey(e))return;if(e.key==="Escape"&&replyTo[room]){e.preventDefault();delete replyTo[room];paintRoom();return}if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();fm.requestSubmit()}};
  fm.onsubmit=async e=>{e.preventDefault();const v=ta.value.trim();if(!v)return;ta.value="";drafts[room]="";ta.style.height="auto";const rp=takeReply(room);const ok=await send(room,v,"text",rp?{reply:rp}:null);
    if(!ok){const t2=panel&&panel.querySelector(".sp-in textarea");if(t2&&!t2.value){t2.value=v;drafts[room]=v}}};
  requestAnimationFrame(pin);
  if(foc){ta.focus();try{ta.setSelectionRange(foc.a,foc.b)}catch(e){}}
  else if(toBottom&&matchMedia("(hover:hover)").matches&&!document.activeElement.closest(".sp-in"))setTimeout(()=>{if(document.activeElement===document.body||!document.activeElement)ta.focus()},20);
  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirmSoft(b,"¿Borrar?"))return;const id=+b.dataset.del;const m=(msgs[room]||[]).find(x=>x.id===id);
    try{await X.API.chatDelete(id);if(m&&(m.kind==="img"||m.kind==="audio")&&m.sender===ME.id&&m.payload)X.API.chartChatImgDel(m.payload.url);if(m&&m.kind==="idea"&&m.sender===ME.id&&m.payload&&m.payload.img)X.API.chartChatImgDel(m.payload.img.url);onDel(id);if(bc)bc.postMessage({k:"del",id})}catch(e){X.toast("No se pudo borrar.")}});
  box.querySelectorAll("[data-mute]").forEach(b=>b.onclick=async()=>{if(!confirmSoft(b,"¿Silenciar?"))return;try{await X.API.chatBlock(b.dataset.mute,true);X.toast("Listo: esa persona ya no puede escribir en el chat.")}catch(e){X.toast("No se pudo.")}});
  box.querySelectorAll("[data-join]").forEach(b=>b.onclick=()=>joinShare(b.dataset.join,room));
  box.querySelectorAll("[data-rx]").forEach(b=>b.onclick=e=>{e.stopPropagation();const[id,em]=b.dataset.rx.split("|");react(+id,em,room)});
  box.querySelectorAll("[data-rxp]").forEach(b=>b.onclick=e=>{e.stopPropagation();const id=+b.dataset.rxp;const old=box.querySelector(".sp-rxp");if(old){const same=old.dataset.id===String(id);old.remove();if(same)return}
    const pk=document.createElement("div");pk.className="sp-rxp";pk.dataset.id=id;pk.innerHTML=RX.map(x=>`<button data-rx="${id}|${x}">${x}</button>`).join("");b.closest(".sp-msg").appendChild(pk);
    pk.querySelectorAll("[data-rx]").forEach(q=>q.onclick=ev=>{ev.stopPropagation();const[i2,em]=q.dataset.rx.split("|");pk.remove();react(+i2,em,room)})});
  box.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{const[sy,tf]=b.dataset.go.split("|");X.follow(sy,tf||null);if(matchMedia("(max-width:640px)").matches)close()});
  box.ondblclick=e=>{const mm=e.target.closest("[data-mid]");if(mm)react(+mm.dataset.mid,"👍",room)};
  box.querySelectorAll("[data-acc]").forEach(b=>b.onclick=()=>acceptCall(b.dataset.acc,room));
  box.querySelectorAll("[data-jg]").forEach(b=>b.onclick=()=>joinVoiceGroup());
  box.querySelectorAll("[data-eye]").forEach(b=>b.onclick=e=>{e.stopPropagation();eyePop(+b.dataset.eye,b)});
  if(isG)loadGrpReads(false);
  box.querySelectorAll("[data-rep]").forEach(b=>b.onclick=e=>{e.stopPropagation();const m=(msgs[room]||[]).find(x=>x.id===+b.dataset.rep);if(!m)return;
    replyTo[room]={id:m.id,n:m.sender===ME.id?"ti":(m.username||nameOf(m.sender)),t:snip(m)};paintRoom();const t2=panel.querySelector(".sp-in textarea");t2&&t2.focus()});
  const ur=panel.querySelector("[data-unrep]");if(ur)ur.onclick=()=>{delete replyTo[room];paintRoom()};
  box.querySelectorAll("[data-goto]").forEach(q=>q.onclick=e=>{e.stopPropagation();const el=box.querySelector(`.sp-msg[data-mid="${q.dataset.goto}"]`);
    if(el){box.__pin=false;el.scrollIntoView({block:"center",behavior:"smooth"});el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash")}else X.toast("Ese mensaje ya no está (puede que sea viejo o lo borraron).")});
  box.querySelectorAll("[data-pm]").forEach(b=>b.onclick=()=>startDM(b.dataset.pm,b.dataset.n));
  const sh=panel.querySelector("[data-sh]");if(sh)sh.onclick=()=>inShare?leaveShare():startShare(room);
  const cb=panel.querySelector("[data-call]");if(cb)cb.onclick=()=>inCall?hangup():startCall(room);
  const ge=panel.querySelector("[data-gedit]");if(ge)ge.onclick=()=>groupEditor(room);
  const vg=panel.querySelector("[data-vg]");if(vg)vg.onclick=()=>call&&call.kind==="group"?hangup():joinVoiceGroup();
  markRead(room)}
function confirmSoft(b,txt){if(b.dataset.ok)return true;b.dataset.ok=1;b.textContent=txt;setTimeout(()=>{delete b.dataset.ok},3000);return false}
function msgRow(m,prev,isG){const mine=m.sender===ME.id,adm=X.isAdmin();const grp=prev&&prev.sender===m.sender&&new Date(m.created_at)-new Date(prev.created_at)<5*60000;
  let inner;
  if(m.kind==="share"){const p=m.payload||{};const act=share&&share.room===p.room;
    inner=`<div class="sp-card"><b>📡 ${mine?"Compartiste tu gráfico":esc(m.username||nameOf(m.sender))+" compartió su gráfico"}</b><small>${esc(p.symName||p.sym||"")}${p.tf?" · "+esc(p.tf):""} — los dibujos de los dos salen en el mismo gráfico, cada uno con su nombre.</small>
      ${p.room?(act?`<span class="sp-ok">● Conectado</span>`:`<button class="btn sm gold" data-join="${esc(p.room)}">${mine?"Volver a compartir":"Ver en mi gráfico"}</button>`):""}</div>`}
  else if(m.kind==="call"){const p=m.payload||{};
    inner=p.act==="end"?`<div class="sp-card"><small>📞 Llamada terminada</small></div>`:p.group?`<div class="sp-card"><b>🎙 ${mine?"Abriste la llamada grupal":esc(m.username||nameOf(m.sender))+" abrió la llamada grupal"}</b>${!(call&&call.room==="voz-general")&&(grpCount()||Date.now()-new Date(m.created_at)<10*60000)?`<button class="btn sm gold" data-jg>Unirme</button>`:""}</div>`:`<div class="sp-card"><b>📞 ${mine?"Llamaste":esc(m.username||nameOf(m.sender))+" te está llamando"}</b>${!mine&&p.room&&!(call&&call.room===p.room)&&Date.now()-new Date(m.created_at)<10*60000?`<button class="btn sm gold" data-acc="${esc(p.room)}">Contestar</button>`:""}</div>`}
  else if(m.kind==="img"){const p=m.payload||{};inner=`<img class="sp-img" src="${esc(p.url)}" alt="Imagen" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('small'),{textContent:'📷 Imagen vencida',className:'sp-exp'}))"${p.w&&p.h?` style="aspect-ratio:${+p.w}/${+p.h}"`:""}>${m.body?`<div class="sp-txt">${linkify(m.body)}</div>`:""}`}
  else if(m.kind==="audio"){const p=m.payload||{},wv=Array.isArray(p.wv)&&p.wv.length?p.wv.slice(0,40):Array.from({length:32},(_,i)=>3+((i*7)%5));
    inner=`<div class="vn-aud" data-au="${esc(p.url)}" data-dur="${+p.dur||0}"><button type="button" class="vn-play" title="Escuchar">${PLAY}</button><span class="vn-wv">${wv.map(h=>`<i style="height:${Math.max(3,Math.min(22,(+h||0)*2.4))}px"></i>`).join("")}</span><small class="vn-time">${fmtDur(p.dur)}</small><button type="button" class="vn-spd" title="Velocidad">1×</button></div>`}
  else if(m.kind==="idea"){const p=m.payload||{};
    inner=`<div class="sp-card idea"><b>📈 Idea · ${esc(p.symName||p.sym||"")}${p.tf?" · "+esc(p.tf):""}</b>${p.img&&p.img.url?`<img class="sp-img" src="${esc(p.img.url)}" alt="Gráfico de la idea" loading="lazy"${p.img.w&&p.img.h?` style="aspect-ratio:${+p.img.w}/${+p.img.h}"`:""} onerror="this.remove()">`:""}${p.price!=null?`<small>Precio cuando la compartió: <b>${esc(p.price)}</b></small>`:""}${m.body?`<div class="sp-txt">${linkify(m.body)}</div>`:""}${p.sym?`<button class="btn sm" data-go="${esc(p.sym)}|${esc(p.tf||"")}">Ver en mi gráfico</button>`:""}</div>`}
  else inner=`<div class="sp-txt">${linkify(m.body)}</div>`;
  const tools=(mine||adm)&&m.id&&!(m.kind==="call")?`<button class="sp-del" data-del="${m.id}" title="${mine?"Borrar para todos":"Borrar (admin)"}">🗑</button>`:"";
  const mute=adm&&isG&&!mine?`<button class="sp-del" data-mute="${esc(m.sender)}" title="Silenciar a esta persona en el chat">🔇</button>`:"";
  const pm=isG&&!mine?`<button class="sp-del" data-pm="${esc(m.sender)}" data-n="${esc(m.username||"")}" title="Escribirle por privado">💬</button>`:"";
  const rx=m.reacts&&Object.keys(m.reacts).length?`<div class="sp-rx">${Object.keys(m.reacts).map(e=>{const u=m.reacts[e]||[];return`<button class="${u.includes(ME.id)?"on":""}" data-rx="${m.id}|${e}" title="${esc(u.map(nameOf).join(", "))}">${e}${u.length>1?` <small>${u.length}</small>`:""}</button>`}).join("")}</div>`:"";
  const rp=m.payload&&m.payload.reply;const quote=rp&&rp.id?`<button class="sp-q" data-goto="${+rp.id}" title="Ver el mensaje original"><b>${esc(rp.n===ME.name?"Tú":rp.n||"")}</b><small>${esc(rp.t||"")}</small></button>`:"";
  const repb=m.id&&["text","idea","share","img","audio"].includes(m.kind)?`<button class="sp-del" data-rep="${m.id}" title="Responder este mensaje">↩</button>`:"";
  const rxb=m.id&&["text","idea","share","img","audio"].includes(m.kind)?`<button class="sp-del" data-rxp="${m.id}" title="Reaccionar (o doble clic = 👍)">😊</button>`:"";
  return`<div class="sp-msg${mine?" me":""}${grp?" grp":""}" data-mid="${m.id}">${!mine&&isG&&!grp?av({id:m.sender,username:m.username,avatar_url:m.avatar_url},"sm"):!mine&&isG?'<span class="sav sm ghost"></span>':""}
    <div class="sp-bx">${!mine&&isG&&!grp?`<span class="sp-who" style="color:${colorOf(m.sender)}">${esc(m.username||"Usuario")}${m.is_admin?' <span class="sp-tag">Profe</span>':vb(m)}</span>`:""}${quote}${inner}<span class="sp-time">${hhmm(m.created_at)}${m.__seen?` · <span class="sp-seen">${m.__seen}</span>`:""}${isG&&m.id&&m.kind!=="call"?(()=>{const n=readersOf(m).length;return n?` · <button class="sp-eye" data-eye="${m.id}" title="Ver quién lo leyó">👁 ${n}</button>`:""})():""}</span>${rx}</div><span class="sp-tools">${repb}${rxb}${pm}${tools}${mute}</span></div>`}

/* ===================== burbuja flotante (estilo Messenger) ===================== */
let head=null,headPrev=null,headDrop=null,lastFrom=null;
function seenMark(L,t,isG){L.forEach(x=>{delete x.__seen});if(isG||!L.length)return;const mine=L.filter(x=>x.sender===ME.id);const last=mine[mine.length-1];if(!last)return;
  if(L[L.length-1]!==last)return;last.__seen=(+t.other_read||0)>=last.id?"✓✓ Visto":"✓ Enviado"}
function headPaint(){if(!X)return;const show=cfg().head&&!panel;if(!show){if(head){head.remove();head=null}if(headPrev){headPrev.remove();headPrev=null}return}
  if(!head){head=document.createElement("button");head.className="shead";head.setAttribute("aria-label","Chat");document.body.appendChild(head);headDrag(head)}
  const t=lastFrom?threads.find(x=>x.room===lastFrom.room):null;const who=lastFrom&&unread?lastFrom:null;
  head.innerHTML=`${who?(who.room===GEN?`<span class="sav grp">👥</span>`:av({id:who.sender,username:who.username,avatar_url:who.avatar_url})):`<span class="sh-ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg></span>`}
    ${unread?`<em>${unread>9?"9+":unread}</em>`:people.length>1?`<i class="sh-on">${people.length}</i>`:""}${share||call?`<b class="sh-live">${call?"📞":"📡"}</b>`:""}`;
  const S=hsz();head.style.setProperty("--hs",S+"px");
  const p=cfg().hp;const W=innerWidth,H=innerHeight;let x=p?(p.side==="l"?10:W-S-10):W-S-10,y=p?Math.round(p.y*H):H-190;y=Math.max(70,Math.min(H-S-64,y));head.style.left=x+"px";head.style.top=y+"px";head.dataset.side=p&&p.side==="l"?"l":"r"}
const hsz=()=>Math.max(40,Math.min(88,+cfg().hs||56));
function headNotify(m){lastFrom=m;headPaint();if(!head||!cfg().bub)return;if(headPrev)headPrev.remove();
  const who=m.username||nameOf(m.sender);headPrev=document.createElement("button");headPrev.className="shprev "+(head.dataset.side==="l"?"l":"r");
  headPrev.innerHTML=`<b>${esc(m.room===GEN?"Grupo · "+who:who)}</b><small>${m.kind==="share"?"📡 Compartió su gráfico":m.kind==="call"?(m.room===GEN?"🎙 Llamada grupal":"📞 Te está llamando"):m.kind==="idea"?"📈 Compartió una idea":m.kind==="img"?"📷 Foto":m.kind==="audio"?"🎤 Nota de voz":esc(String(m.body||"").slice(0,90))}</small>`;
  document.body.appendChild(headPrev);const r=head.getBoundingClientRect();headPrev.style.top=(r.top+6)+"px";
  if(head.dataset.side==="l")headPrev.style.left=(r.right+8)+"px";else headPrev.style.right=(innerWidth-r.left+8)+"px";
  headPrev.onclick=()=>{headPrev&&headPrev.remove();headPrev=null;open(m.room)};
  head.classList.remove("bump");void head.offsetWidth;head.classList.add("bump");
  const el=headPrev;setTimeout(()=>{if(el.isConnected){el.classList.add("out");setTimeout(()=>el.remove(),300)}},4500)}
function headDrag(el){let sx=0,sy=0,ox=0,oy=0,moved=false,id=null;
  el.addEventListener("pointerdown",e=>{if(e.button!==0)return;id=e.pointerId;el.setPointerCapture(id);sx=e.clientX;sy=e.clientY;const r=el.getBoundingClientRect();ox=r.left;oy=r.top;moved=false;el.classList.add("drag")});
  el.addEventListener("pointermove",e=>{if(e.pointerId!==id)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(!moved&&Math.hypot(dx,dy)<6)return;
    if(!moved){moved=true;if(headPrev){headPrev.remove();headPrev=null}headDrop=document.createElement("div");headDrop.className="shdrop";headDrop.textContent="✕";document.body.appendChild(headDrop)}
    const S=hsz();el.style.left=Math.max(0,Math.min(innerWidth-S,ox+dx))+"px";el.style.top=Math.max(0,Math.min(innerHeight-S,oy+dy))+"px";
    const dr=headDrop.getBoundingClientRect(),hr=el.getBoundingClientRect();headDrop.classList.toggle("hot",Math.hypot(dr.left+dr.width/2-(hr.left+hr.width/2),dr.top+dr.height/2-(hr.top+hr.height/2))<60)});
  const up=e=>{if(e.pointerId!==id)return;id=null;el.classList.remove("drag");try{el.releasePointerCapture(e.pointerId)}catch(x){}
    if(!moved){panel?minimize():open(unread&&lastFrom?lastFrom.room:lastRoom);return}
    const hot=headDrop&&headDrop.classList.contains("hot");if(headDrop){headDrop.remove();headDrop=null}
    if(hot){cfg().head=false;X.save();headPaint();X.toast("Burbuja escondida. La vuelves a activar en 💬 Chat → ⚙.");return}
    const r=el.getBoundingClientRect();cfg().hp={side:r.left+r.width/2<innerWidth/2?"l":"r",y:Math.max(0,Math.min(1,r.top/innerHeight))};X.save();SND.play("tick");headPaint()};
  el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up);
  addEventListener("resize",()=>headPaint())}

/* ===================== sonidos (sintetizados, sin archivos) ===================== */
let actx=null;
const SND={ctx(){try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();if(actx.state==="suspended")actx.resume().catch(()=>{});return actx}catch(e){return null}},
  tone(f1,f2,t0,dur,vol,type){const c=this.ctx();if(!c)return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+t0;o.type=type||"sine";o.frequency.setValueAtTime(f1,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur*.7);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+.02)},
  noise(t0,dur,vol,f1,f2){const c=this.ctx();if(!c)return;const n=Math.floor(c.sampleRate*dur),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),t=c.currentTime+t0;s.buffer=b;f.type="bandpass";f.Q.value=1.2;f.frequency.setValueAtTime(f1,t);f.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.value=vol;s.connect(f);f.connect(g);g.connect(c.destination);s.start(t)},
  play(k,force){const plat=["tick","tool","join","leave"].includes(k);if(!force&&!(plat?cfg().psnd:cfg().snd))return;const v=(cfg().vol||60)/100*.11;
    if(k==="in"){this.tone(784,null,0,.09,v);this.tone(1175,null,.085,.16,v)}                     /* "tin-tin" de mensaje */
    else if(k==="inSoft")this.tone(1046,null,0,.08,v*.45);
    else if(k==="out")this.noise(0,.16,v*1.3,600,3200);                                               /* "fiu" al enviar */
    else if(k==="mention"){this.tone(659,null,0,.08,v);this.tone(880,null,.08,.08,v);this.tone(1319,null,.16,.18,v)}
    else if(k==="react")this.tone(520,1040,0,.13,v*.8,"triangle");                                   /* "bloop" */
    else if(k==="tick")this.tone(1400,null,0,.035,v*.5,"triangle");
    else if(k==="tool"){this.tone(1568,null,0,.04,v*.45,"triangle");this.tone(2093,null,.035,.05,v*.35,"triangle")}
    else if(k==="join"){this.tone(523,null,0,.1,v*.8);this.tone(659,null,.09,.1,v*.8);this.tone(784,null,.18,.18,v*.8)}
    else if(k==="leave"){this.tone(784,null,0,.1,v*.7);this.tone(523,null,.1,.18,v*.7)}}};
window.EAGSnd=SND;

/* ===================== escribiendo… ===================== */
const typers={};let typT=0,typSubRoom=null,lastPing=0;
const tkey=r=>"t-"+r.replace(/[^a-z0-9-]/gi,"-");
function typingSub(room){if(typSubRoom&&typSubRoom!==room){unsub(tkey(typSubRoom));typSubRoom=null}
  if(room&&typSubRoom!==room){typSubRoom=room;sub(tkey(room),(ev,p)=>{if(ev!=="typing"||!p.from||p.from===ME.id)return;(typers[room]=typers[room]||{})[p.from]={n:p.fname,at:Date.now()};paintTyping()})}}
function typingPing(room){const now=Date.now();if(now-lastPing<2500)return;lastPing=now;cast(tkey(room),"typing",{})}
function paintTyping(){if(!panel||!view.room)return;const T=typers[view.room]||{},now=Date.now();Object.keys(T).forEach(k=>{if(now-T[k].at>5000)delete T[k]});
  const ns=Object.values(T).map(x=>x.n||"Alguien");const el=panel.querySelector("[data-typ]");if(el)el.innerHTML=ns.length?`<span class="dots"><i></i><i></i><i></i></span> ${esc(ns.slice(0,2).join(" y "))}${ns.length>2?" y otros":""} ${ns.length>1?"están":"está"} escribiendo…`:"";
  clearTimeout(typT);if(ns.length)typT=setTimeout(paintTyping,1500)}
function snip(m){return m.kind==="audio"?"🎤 Nota de voz"+(m.payload&&m.payload.dur?" · "+fmtDur(m.payload.dur):""):m.kind==="img"?"📷 Foto"+(m.body?" · "+String(m.body).slice(0,60):""):m.kind==="idea"?"📈 Idea"+(m.payload&&m.payload.symName?" · "+m.payload.symName:""):m.kind==="share"?"📡 Gráfico compartido":String(m.body||"").replace(/\s+/g," ").slice(0,90)}
function takeReply(room){const r=replyTo[room];delete replyTo[room];if(!r)return null;return{id:r.id,n:r.n==="ti"?ME.name:r.n,t:r.t}}
/* fotos: se comprimen en el navegador (máx. 1280 px, WebP) y se suben al almacenamiento, no a la base de datos */
async function shrink(file){if(!file||!/^image\//.test(file.type))throw new Error("Eso no es una imagen.");if(file.size>15e6)throw new Error("La imagen es muy pesada (máx. 15 MB).");
  const url=URL.createObjectURL(file);try{const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("No se pudo leer la imagen."));i.src=url});
    const k=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.round(img.naturalWidth*k),h=Math.round(img.naturalHeight*k);
    const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);
    let q=.82,b=await new Promise(ok=>c.toBlob(ok,"image/webp",q));while(b&&b.size>900e3&&q>.4){q-=.15;b=await new Promise(ok=>c.toBlob(ok,"image/webp",q))}
    if(!b)throw new Error("No se pudo preparar la imagen.");return{blob:b,w,h}}finally{URL.revokeObjectURL(url)}}
let upBusy=false;
/* ---------- notas de voz ---------- */
const PLAY='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',PAUSE='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
const fmtDur=d=>{d=Math.max(0,Math.round(+d||0));return Math.floor(d/60)+":"+String(d%60).padStart(2,"0")};
let rec=null,aud=null,audEl=null;
function recMime(){if(!window.MediaRecorder)return null;const L=["audio/webm;codecs=opus","audio/mp4","audio/webm","audio/aac","audio/ogg;codecs=opus"];for(const t of L){try{if(MediaRecorder.isTypeSupported(t))return t}catch(e){}}return""}
async function recStart(room,fm){if(rec)return;const mt=recMime();if(mt===null||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return X.toast("Tu navegador no permite grabar audio aquí.");
  let st;try{st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}catch(e){return X.toast("Necesito permiso del micrófono para grabar la nota de voz.")}
  let mr;try{mr=mt?new MediaRecorder(st,{mimeType:mt,audioBitsPerSecond:32000}):new MediaRecorder(st)}catch(e){st.getTracks().forEach(t=>t.stop());return X.toast("No se pudo empezar a grabar.")}
  const chunks=[],peaks=[];let ac=null,an=null,buf=null,raf=0;try{ac=new (window.AudioContext||window.webkitAudioContext)();const src=ac.createMediaStreamSource(st);an=ac.createAnalyser();an.fftSize=512;src.connect(an);buf=new Uint8Array(an.fftSize)}catch(e){}
  const t0=Date.now();rec={room,mr,st,chunks,peaks,t0,cancel:false};
  const bar=document.createElement("div");bar.className="vn-rec";bar.innerHTML=`<button type="button" class="vn-x" title="Cancelar">✕</button><i class="vn-dot"></i><b class="vn-t">0:00</b><span class="vn-w"></span><button type="button" class="vn-send" title="Enviar nota de voz">➤</button>`;
  fm.appendChild(bar);fm.classList.add("recording");rec.bar=bar;rec.fm=fm;const rt=bar.querySelector(".vn-t"),rw=bar.querySelector(".vn-w");
  let lastPk=0,acc=0;const tick=()=>{if(!rec)return;const s=(Date.now()-t0)/1000;rt.textContent=fmtDur(s);if(an){an.getByteTimeDomainData(buf);let m=0;for(let i=0;i<buf.length;i++){const v=Math.abs(buf[i]-128);if(v>m)m=v}acc=Math.max(acc,m);
      if(Date.now()-lastPk>150){lastPk=Date.now();const h=Math.min(9,Math.round(acc/7));peaks.push(h);acc=0;const i=document.createElement("i");i.style.height=Math.max(3,h*2.4)+"px";rw.appendChild(i);while(rw.children.length>60)rw.firstChild.remove()}}
    if(s>=120){stop(true);return}raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);
  mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  const stop=send=>{if(!rec||rec.stopping)return;rec.stopping=true;rec.cancel=!send;cancelAnimationFrame(raf);try{mr.stop()}catch(e){fin()}};
  const fin=async()=>{const r=rec;rec=null;st.getTracks().forEach(t=>t.stop());try{ac&&ac.close()}catch(e){}bar.remove();(r&&r.fm||fm).classList.remove("recording");if(!r||r.cancel)return;
    const dur=(Date.now()-t0)/1000;if(dur<0.8)return X.toast("Muy corta. Mantén la grabación al menos un segundo.");
    const blob=new Blob(chunks,{type:(mr.mimeType||mt||"audio/webm").split(";")[0]});if(blob.size>3e6)return X.toast("La nota es muy pesada. Grábala más corta.");
    sendAudio(room,blob,dur,compress(peaks))};
  mr.onstop=fin;mr.start(250);
  bar.querySelector(".vn-x").onclick=()=>stop(false);bar.querySelector(".vn-send").onclick=()=>stop(true)}
function compress(P){if(!P.length)return[];const n=Math.min(40,P.length),o=[];for(let i=0;i<n;i++){const a=Math.floor(i*P.length/n),b=Math.max(a+1,Math.floor((i+1)*P.length/n));o.push(Math.max(1,Math.max(...P.slice(a,b))))}return o}
async function sendAudio(room,blob,dur,wv){if(upBusy)return;upBusy=true;X.toast("Enviando nota de voz…");
  try{const url=await X.API.chartChatUpload(blob);const rp=takeReply(room);const pl={url,dur:Math.round(dur*10)/10,wv};if(rp)pl.reply=rp;await send(room,"","audio",pl)}
  catch(e){X.toast(esc(e.message||"No se pudo enviar la nota de voz."))}finally{upBusy=false}}
function audWire(el){const b=el.querySelector(".vn-play"),sp=el.querySelector(".vn-spd"),bars=[...el.querySelectorAll(".vn-wv i")],tm=el.querySelector(".vn-time"),D=+el.dataset.dur||0,url=el.dataset.au;
  const ui={b,tm,D,paint:f=>{const k=Math.round(f*bars.length);bars.forEach((x,i)=>x.classList.toggle("on",i<k))}};
  if(aud&&aud.url===url&&audEl){aud.ui=ui;b.innerHTML=audEl.paused?PLAY:PAUSE;sp.textContent=(audEl.playbackRate||1)+"×";el.dataset.rate=audEl.playbackRate||1;audEl.ontimeupdate&&audEl.ontimeupdate()}
  b.onclick=()=>{if(aud&&aud.url===url&&audEl){if(audEl.paused)audEl.play().catch(()=>{});else audEl.pause();return}
    if(audEl){audEl.pause();aud&&aud.reset()}audEl=new Audio(url);audEl.playbackRate=+(el.dataset.rate||1);const A=audEl;
    const reset=()=>{const u=aud&&aud.ui||ui;u.b.innerHTML=PLAY;u.paint(0);u.tm.textContent=fmtDur(u.D)};aud={url,ui,reset};
    A.onplay=()=>{aud&&aud.ui&&(aud.ui.b.innerHTML=PAUSE)};A.onpause=()=>{aud&&aud.ui&&(aud.ui.b.innerHTML=PLAY)};
    A.ontimeupdate=()=>{if(!aud||audEl!==A)return;const u=aud.ui,d=isFinite(A.duration)&&A.duration>0?A.duration:u.D;u.paint(d?A.currentTime/d:0);u.tm.textContent=fmtDur(A.currentTime)};
    A.onended=()=>{if(audEl!==A)return;reset();aud=null;audEl=null};A.onerror=()=>{if(audEl!==A)return;X.toast("Esta nota de voz ya no está disponible.");reset();aud=null;audEl=null};
    A.play().catch(()=>X.toast("No se pudo reproducir."))};
  el.querySelector(".vn-wv").onclick=e=>{if(!(aud&&aud.url===url)||!audEl)return;const r=e.currentTarget.getBoundingClientRect(),f=(e.clientX-r.left)/r.width,d=isFinite(audEl.duration)&&audEl.duration>0?audEl.duration:D;if(d)audEl.currentTime=Math.max(0,Math.min(d-.05,f*d))};
  sp.onclick=()=>{const R=[1,1.5,2],c=+(el.dataset.rate||1),n=R[(R.indexOf(c)+1)%R.length];el.dataset.rate=n;sp.textContent=n+"×";if(aud&&aud.url===url&&audEl)audEl.playbackRate=n}}
async function sendImg(room,file,ta){if(upBusy)return;upBusy=true;const btn=panel&&panel.querySelector("[data-pic]");btn&&btn.classList.add("busy");X.toast("Subiendo imagen…");
  try{const r=await shrink(file);const u=await X.API.chartChatUpload(r.blob);const cap=ta?ta.value.trim():"";if(ta){ta.value="";ta.style.height="auto";drafts[room]=""}const rp=takeReply(room);await send(room,cap,"img",Object.assign({url:u,w:r.w,h:r.h},rp?{reply:rp}:{}))}
  catch(e){X.toast(esc(e.message||"No se pudo enviar la imagen."))}finally{upBusy=false;btn&&btn.classList.remove("busy")}}
function lightbox(src){const o=document.createElement("div");o.className="sp-lb";o.innerHTML=`<img src="${esc(src)}" alt=""><button class="sx" title="Cerrar">✕</button>`;document.body.appendChild(o);
  const cl=()=>{o.remove();removeEventListener("keydown",k,true)},k=e=>{if(e.key==="Escape"){e.stopPropagation();cl()}};o.onclick=cl;addEventListener("keydown",k,true)}
/* borrar un chat (solo para ti) */
async function hideChat(room){try{await X.API.chatHide(room);threads=threads.filter(t=>t.room!==room);delete msgs[room];unread=threads.reduce((a,t)=>a+(isGrp(t.room)?0:(+t.unread||0)),0);paintBtn();
    if(view.room===room){view.room=null;typingSub(null)}paintPanel();X.toast("Chat eliminado (solo para ti).")}catch(e){X.toast("No se pudo eliminar el chat.")}}
/* ---------- admin: crear / editar un grupo y elegir quién lo ve ---------- */
const PLANS=[["cobre","Cobre"],["plata","Plata"],["oro","Oro"],["diamond","Diamond"]];
const WHO=[["all","Todos los alumnos"],["plan","Por plan"],["verified","Miembros verificados"],["list","Solo los que yo elija"],["admins","Solo admins"]];
async function groupEditor(id){if(!ME.admin||!X.API.chatGroupSave)return;const g0=id?Object.assign({},GROUPS.get(id)||{}):{name:"",emoji:"👥",descr:"",who:"all",plans:[],members:[],only_admin:false};
  const st={g:Object.assign({plans:[],members:[]},g0),names:{},people:null};
  const ov=document.createElement("div");ov.className="sp-gbk";ov.innerHTML=`<div class="sp-ged" role="dialog" aria-label="Grupo"></div>`;document.body.appendChild(ov);const box=ov.firstChild;
  const close=()=>ov.remove();ov.addEventListener("pointerdown",e=>{if(e.target===ov)close()});ov.addEventListener("keydown",e=>{e.stopPropagation();if(e.key==="Escape")close()});
  const loadPeople=async()=>{if(!id||!X.API.chatGroupPeople)return;try{st.people=await X.API.chatGroupPeople(id)||[]}catch(e){st.people=[]}paint()};
  const paint=()=>{const g=st.g;const ok=st.people?st.people.filter(p=>p.ok):null,no=st.people?st.people.filter(p=>!p.ok):null;
    box.innerHTML=`<div class="sp-geh"><b>${id?"Editar grupo":"Nuevo grupo"}</b><button class="sx" data-x>✕</button></div>
      <div class="sp-geb"><div class="sp-ger"><input class="sp-gemo" maxlength="4" value="${esc(g.emoji||"👥")}" data-f="emoji" title="Emoji"><input maxlength="40" placeholder="Nombre del grupo (ej. Señales Oro)" value="${esc(g.name||"")}" data-f="name"></div>
      <input maxlength="200" placeholder="Descripción corta (opcional)" value="${esc(g.descr||"")}" data-f="descr">
      <div class="sp-gel">¿Quién lo ve?</div><div class="sp-gew">${WHO.map(([k,t])=>`<button class="${g.who===k?"on":""}" data-who="${k}">${t}</button>`).join("")}</div>
      ${g.who==="plan"?`<div class="sp-gel">Planes que lo ven</div><div class="sp-gew">${PLANS.map(([k,t])=>`<button class="${(g.plans||[]).includes(k)?"on":""}" data-plan="${k}">${t}</button>`).join("")}</div>`:""}
      <div class="sp-gel">${g.who==="list"?"Personas que lo ven":"Además, estas personas (opcional)"}</div>
      <div class="sp-gem">${(g.members||[]).map(u=>`<span>${esc(st.names[u]||nameOf(u)||"Usuario")}<button data-rm="${esc(u)}" title="Quitar">✕</button></span>`).join("")||"<small>Nadie agregado</small>"}</div>
      <div class="sp-find"><input type="search" placeholder="Buscar alumno para agregar…" data-gfind autocomplete="off"><div class="sp-res" data-gres></div></div>
      <label class="sp-ck"><input type="checkbox" data-oa${g.only_admin?" checked":""}><span><b>Solo el profe escribe</b><small>Canal de avisos: los demás leen y reaccionan.</small></span></label>
      ${id?`<details class="sp-gwho"${st.people?" open":""}><summary data-wsee>👁 Quién lo ve y quién no${ok?` · ${ok.length} lo ven, ${no.length} no`:""}</summary>${st.people?`<div class="sp-gcols"><div><b>Lo ven (${ok.length})</b>${ok.slice(0,300).map(p=>`<span>${esc(p.username||"Usuario")}${p.plan?` <i>${esc(p.plan)}</i>`:""}</span>`).join("")||"<small>Nadie</small>"}</div><div><b>No lo ven (${no.length})</b>${no.slice(0,300).map(p=>`<span>${esc(p.username||"Usuario")}${p.plan?` <i>${esc(p.plan)}</i>`:""}</span>`).join("")||"<small>Nadie</small>"}</div></div><small>Guarda los cambios para actualizar esta lista.</small>`:"<small>Cargando…</small>"}</details>`:""}
      </div><div class="sp-gef">${id?`<button class="btn sm danger" data-del>Borrar grupo</button>`:""}<i style="flex:1"></i><button class="btn sm" data-x>Cancelar</button><button class="btn gold sm" data-save>${id?"Guardar":"Crear grupo"}</button></div>`;
    box.querySelectorAll("[data-x]").forEach(b=>b.onclick=close);
    box.querySelectorAll("[data-f]").forEach(i=>i.oninput=()=>{st.g[i.dataset.f]=i.value});
    box.querySelectorAll("[data-who]").forEach(b=>b.onclick=()=>{st.g.who=b.dataset.who;paint()});
    box.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{const k=b.dataset.plan,a=new Set(st.g.plans||[]);a.has(k)?a.delete(k):a.add(k);st.g.plans=[...a];paint()});
    box.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{st.g.members=(st.g.members||[]).filter(u=>u!==b.dataset.rm);paint()});
    box.querySelector("[data-oa]").onchange=e=>{st.g.only_admin=e.target.checked};
    const ws=box.querySelector("[data-wsee]");if(ws)ws.onclick=()=>{if(!st.people)loadPeople()};
    const f=box.querySelector("[data-gfind]");let ft=0;f.oninput=()=>{clearTimeout(ft);ft=setTimeout(async()=>{const q=f.value.trim(),r=box.querySelector("[data-gres]");if(q.length<2){r.innerHTML="";return}
      let L=[];try{L=await X.API.chatFind(q)||[]}catch(e){}r.innerHTML=L.map(u=>`<button class="sp-row" data-add="${esc(u.id)}" data-n="${esc(u.username)}">${av(u)}<div class="sp-t"><b>${esc(u.username)}</b><small>Agregar</small></div></button>`).join("")||`<p class="sp-empty">Nadie con ese nombre.</p>`;
      r.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{const u=b.dataset.add;st.names[u]=b.dataset.n;if(!(st.g.members||[]).includes(u))st.g.members=(st.g.members||[]).concat(u);paint()})},250)};
    box.querySelector("[data-save]").onclick=async()=>{const g=st.g;if(!String(g.name||"").trim()){X.toast("Ponle un nombre al grupo");return}if(g.who==="plan"&&!(g.plans||[]).length){X.toast("Elige al menos un plan");return}
      if(g.who==="list"&&!(g.members||[]).length){X.toast("Agrega al menos una persona");return}
      try{const nid=await X.API.chatGroupSave({id:id||"",name:g.name.trim(),emoji:g.emoji||"👥",descr:g.descr||"",who:g.who,plans:g.plans||[],members:g.members||[],only_admin:!!g.only_admin});
        await loadGroups();await loadThreads();close();X.toast(id?"Grupo guardado":"Grupo creado");if(!id&&nid)open(nid);else if(panel&&view.room)paintRoom();else if(panel)paintPanel()}catch(e){X.toast(esc(e.message||"No se pudo guardar."))}};
    const dl=box.querySelector("[data-del]");if(dl)dl.onclick=async()=>{if(!confirmSoft(dl,"Toca otra vez: se borran el grupo y sus mensajes"))return;try{await X.API.chatGroupDelete(id);GROUPS.delete(id);threads=threads.filter(t=>t.room!==id);close();if(view.room===id){view.room=null}if(panel)paintPanel();X.toast("Grupo borrado")}catch(e){X.toast("No se pudo borrar.")}};
    setTimeout(()=>{const n=box.querySelector('[data-f="name"]');if(n&&!id&&!n.value)n.focus()},30)};
  paint()}
async function clearGeneral(room){room=room||GEN;try{await X.API.chatHide(room);msgs[room]=[];msgs[room].__end=true;paintRoom();X.toast("Vaciaste el grupo (solo para ti).")}catch(e){X.toast("No se pudo.")}}
function roomMenu(anchor,room){const old=document.querySelector(".sp-menu");if(old){old.remove();return}const isG=isGrp(room),oid=otherOf(room);
  const m=document.createElement("div");m.className="sp-menu";m.innerHTML=(isG?`<button data-m="clear">🧹 Vaciar el grupo (solo para ti)</button>${ME.admin&&room!==GEN?`<button data-m="gedit">⚙ Editar grupo y quién lo ve</button>`:""}`:`<button data-m="hide">🗑 Eliminar este chat (solo para ti)</button>`)+
    (X.isAdmin()&&!isG?`<button data-m="inv">⭐ Invitar a hacerse Miembro verificado</button><button data-m="mute">🔇 Silenciar a esta persona en el chat</button><button data-m="unmute">🔈 Quitarle el silencio</button>`:"");
  panel.appendChild(m);const r=anchor.getBoundingClientRect(),pr=panel.getBoundingClientRect();m.style.top=(r.bottom-pr.top+4)+"px";m.style.right=(pr.right-r.right)+"px";
  const off=e=>{if(!m.contains(e.target)){m.remove();removeEventListener("pointerdown",off,true)}};setTimeout(()=>addEventListener("pointerdown",off,true),0);
  m.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{const k=b.dataset.m;if((k==="hide"||k==="clear")&&!confirmSoft(b,k==="hide"?"Toca otra vez para eliminar":"Toca otra vez para vaciar"))return;m.remove();
    if(k==="hide")hideChat(room);else if(k==="clear")clearGeneral(room);else if(k==="gedit")groupEditor(room);
    else if(k==="inv"){const nm=(threads.find(x=>x.room===room)||{}).username||"";send(room,`¡Hola${nm?" "+nm:""}! 👋 ¿Ya eres Miembro verificado de El Arte Gráfico? Es gratis: te desbloquea funciones de EAG Charts y entras a los retos express con premios. Mira cómo hacerlo aquí 👉 https://elartegrafico.com/#miembro-solicitud`,"text")}
    else{try{await X.API.chatBlock(oid,k==="mute");X.toast(k==="mute"?"Silenciado: ya no puede escribir en el chat.":"Listo: ya puede escribir de nuevo.")}catch(e){X.toast("No se pudo.")}}})}
/* el chat guarda solo 10 días: el admin, al entrar, borra las fotos viejas del almacenamiento y los mensajes viejos (respaldo del cron), cada 6 h */
function imgClean(){try{if(!X.isAdmin()||!X.API.chartChatImgClean)return;const k="eag_cc_clean",t=+(localStorage.getItem(k)||0);if(Date.now()-t<6*36e5)return;localStorage.setItem(k,String(Date.now()));
  setTimeout(()=>{X.API.chatCleanup&&X.API.chatCleanup().catch(()=>{});X.API.chartChatImgClean(10).catch(()=>{})},20000)}catch(e){}}
/* idea de trading: mercado, temporalidad y precio actual del gráfico activo */
async function chartPic(){const p=X.panes()[X.active()];if(!p||!p.kc.chart)return null;const ch=p.kc.chart;
  const bg=getComputedStyle(p.kc.el||document.body).getPropertyValue("--chartbg").trim()||(document.documentElement.classList.contains("light")?"#ffffff":"#0b0c0e");
  const src=ch.getConvertPictureUrl(true,"png",bg);const img=await new Promise((ok,no)=>{const m=new Image();m.onload=()=>ok(m);m.onerror=no;m.src=src});
  const sc=Math.min(1,1400/img.width),w=Math.round(img.width*sc),h=Math.round(img.height*sc),c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);
  let q=.85,blob=await new Promise(ok=>c.toBlob(ok,"image/webp",q));while(blob&&blob.size>900e3&&q>.4){q-=.15;blob=await new Promise(ok=>c.toBlob(ok,"image/webp",q))}return blob?{blob,w,h}:null}
function ideaNow(){try{const p=X.panes()[X.active()];const s=p.kc.getSymbol(),L=p.kc.chart.getDataList(),c=L[L.length-1];const pr=c?+c.close:null;
  return{sym:s.ticker,symName:s.name||s.shortName||s.ticker,tf:p.kc.getPeriod().text,price:pr!=null?pr.toLocaleString("en-US",{maximumFractionDigits:s.pricePrecision!=null?s.pricePrecision:3}):null}}catch(e){return null}}

/* ===================== compartir gráfico ===================== */
function myBoards(){const boards={};let a=null;X.panes().forEach((p,i)=>{try{const s=p.kc.getSymbol();boards[s.ticker]=p.kc.drawings();if(i===X.active())a={sym:s.ticker,symName:s.name||s.shortName||s.ticker,tf:p.kc.getPeriod().text}}catch(e){}});
  return Object.assign({boards},a||{})}
async function startShare(chatRoom){const room=uuid(),b=myBoards();
  const m=await send(chatRoom,"","share",{room,sym:b.sym,symName:b.symName,tf:b.tf});if(!m)return;joinShare(room,chatRoom,true)}
function joinShare(room,chatRoom,host){if(share&&share.room===room)return;if(share)leaveShare(true);
  share={room,with:chatRoom,peers:{},last:"",host:!!host};
  sub(room,(ev,p)=>{if(!share||!p.from||p.from===ME.id)return;
    if(ev==="bye"){delete share.peers[p.from];SND.play("leave");applyShare();paintShareBar();X.toast(`${esc(p.fname||"La otra persona")} dejó de compartir.`);return}
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
  SND.play("join");paintShareBar();paintBtn();if(view.room)paintRoom();X.toast("📡 Compartiendo: tus dibujos salen en su gráfico con tu nombre, y los suyos en el tuyo.")}
function shareSend(force){if(!share)return;const b=myBoards(),j=JSON.stringify(b);if(!force&&j===share.last)return;share.last=j;cast(share.room,"draw",b)}
function leaveShare(quiet){if(!share)return;cast(share.room,"bye",{});unsub(share.room);clearInterval(share.loopT);clearInterval(share.hbT);share=null;
  try{sessionStorage.removeItem("eag_share")}catch(e){}applyShare();paintShareBar();paintBtn();if(view.room)paintRoom();if(!quiet)X.toast("Dejaste de compartir el gráfico.")}
function tagged(arr,name,color){return(arr||[]).filter(d=>d&&!d.hid).map(d=>{const c=JSON.parse(JSON.stringify(d));delete c.tfv;const ex=c.extendData=Object.assign({},c.extendData||{});
  const lb=Object.assign({},ex.lbl||{});const t=lb.t||ex.text||"";lb.t=t?`${name}: ${t}`:name;lb.c=lb.c||color;lb.s=lb.s||11;lb.b=true;ex.lbl=lb;if(ex.text&&/rect|zone|box/i.test(c.name))delete ex.text;return c})}
function applyShare(){X.panes().forEach(p=>{let tk;try{tk=p.kc.getSymbol().ticker}catch(e){return}const L={};
  if(share)Object.keys(share.peers).forEach(id=>{const pr=share.peers[id];if(pr.boards&&Array.isArray(pr.boards[tk]))L["u"+id]=tagged(pr.boards[tk],pr.name||"Invitado",pr.color)});
  const key=tk+":"+JSON.stringify(L);if(p.__sk===key)return;p.__sk=key;try{p.kc.setGuest(L,"social")}catch(e){}})}
let shBar=null;
function paintShareBar(){if(!share&&!call){if(shBar){shBar.remove();shBar=null}return}
  if(!shBar){shBar=document.createElement("div");shBar.className="sbar";document.body.appendChild(shBar)}
  const ps=share?Object.keys(share.peers).map(id=>Object.assign({id},share.peers[id])):[];
  const cps=call?Object.keys(call.peers).map(id=>({id,name:call.peers[id].name,off:!!call.peers[id].off,rm:!!call.peers[id].rm,vol:vols()[id]})):[];
  const tsec=call?Math.floor((Date.now()-call.t0)/1000):0;
  shBar.innerHTML=`${share?`<div class="sb-r"><span class="sb-ic">📡</span><span class="sb-t">${ps.length?ps.map(p=>`<b style="color:${p.color}">${esc(p.name||"Invitado")}</b>${p.symName?` <small>en ${esc(p.symName)}${p.tf?" · "+esc(p.tf):""}</small> <button class="sb-go" data-go="${esc(p.id)}" title="Ir a su mercado y temporalidad">Ir</button>`:""}`).join(" · "):"<small>Esperando a que se conecte…</small>"}</span>${window.EAGReplay?`<button class="sb-go" data-rplay title="Estudiar este gráfico en replay (con sus dibujos)">⏪ Replay</button>`:""}<button class="sb-x" data-lsh title="Dejar de compartir">Salir</button></div>`:""}
  ${call?`<div class="sb-r"><span class="sb-ic">${call.kind==="group"?"🎙":"📞"}</span><span class="sb-t">${call.kind==="group"&&cps.length?`<button class="vlbtn" data-vlist aria-haspopup="true" title="Ver quién está en la llamada">👥 ${cps.length+1}${cps.some(p=>p.rm)?` · 🔇${cps.filter(p=>p.rm).length}`:""} <span class="vl-who"></span> ▾</button>`:cps.length?cps.map(p=>`<button class="vpeer${p.off?" off":""}${p.rm?" rm":""}" data-vp="${esc(p.id)}" title="Volumen y silencio de ${esc(p.name||"esta persona")}">${p.rm?"🔇 ":p.off?"🔈 ":""}${esc(p.name||"…")}${p.vol!=null&&p.vol<100&&!p.off?` <small>${p.vol}%</small>`:""}</button>`).join(" · "):"<small>Llamando…</small>"} <small>${Math.floor(tsec/60)}:${String(tsec%60).padStart(2,"0")}</small></span>
    <button class="sb-go${call.muted?" on":""}" data-mute ${call.lock?"disabled":""} title="${call.lock?"El profe te silenció":call.muted?"Activar mi micrófono":"Silenciar mi micrófono"}">${call.lock?"🔇 Silenciado por el profe":call.muted?"🔇 Silenciado":"🎤"}</button>${call.kind==="group"&&X.isAdmin()&&cps.length?`<button class="sb-go" data-muteall title="Silencia el micrófono de todos; cada uno puede volver a activarlo">🔇 Todos</button>`:""}<button class="sb-x bad" data-hang title="Colgar">Colgar</button></div>`:""}`;
  shBar.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{const pr=share&&share.peers[b.dataset.go];if(pr&&pr.sym)X.follow(pr.sym,pr.tf)});
  const l=shBar.querySelector("[data-lsh]");l&&(l.onclick=()=>leaveShare());
  const rpb=shBar.querySelector("[data-rplay]");rpb&&(rpb.onclick=()=>window.EAGReplay&&window.EAGReplay.quick({}));
  const mu=shBar.querySelector("[data-mute]");mu&&(mu.onclick=()=>{if(call.lock){X.toast("El profe te silenció. Él te puede dejar hablar.");return}call.muted=!call.muted;setTimeout(()=>call&&cast(call.room,"v-hb",{m:!!call.muted}),50);call.stream&&call.stream.getAudioTracks().forEach(t=>t.enabled=!call.muted);paintShareBar()});
  const hg=shBar.querySelector("[data-hang]");hg&&(hg.onclick=()=>hangup());
  shBar.querySelectorAll("[data-vp]").forEach(b=>(b.onclick=b.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();vpop(b.dataset.vp,b)}));
  const vlb=shBar.querySelector("[data-vlist]");vlb&&(vlb.onclick=e=>{e.stopPropagation();vlist(vlb)});if(document.querySelector(".vlist"))vlist(vlb,true);
  const ma=shBar.querySelector("[data-muteall]");ma&&(ma.onclick=()=>{cast(call.room,"v-muteall",{});Object.values(call.peers).forEach(pr=>{pr.rm=true});paintShareBar();X.toast("Silenciaste a todos. Cada uno puede volver a activar su micrófono.")})}

/* volumen de cada persona (se recuerda) y silencio: solo para mí, o para todos si soy el profe */
const vols=()=>{const c=cfg();c.vols=c.vols||{};return c.vols};
const volOf=id=>{const v=vols()[id],g=call&&call.gvol&&call.gvol[id];return Math.max(0,Math.min(1,(v==null?1:v/100)*(g==null?1:g/100)))};
function applyVol(id){const pr=call&&call.peers[id];if(!pr||!pr.audio)return;pr.audio.volume=volOf(id);pr.audio.muted=!!pr.off}
function vpop(id,anchor){const old=document.querySelector(".vpop");if(old){old.remove();if(old.dataset.id===id)return}const pr=call&&call.peers[id];if(!pr)return;
  const adm=X.isAdmin()&&call.kind==="group",v=vols()[id]==null?100:vols()[id];
  const el=document.createElement("div");el.className="vpop";el.dataset.id=id;el.setAttribute("role","dialog");el.setAttribute("aria-label","Audio de "+(pr.name||""));
  el.innerHTML=`<b>${esc(pr.name||"Participante")}</b>${pr.rm?`<small>🔇 Tiene el micrófono apagado</small>`:""}
    <label class="vp-vol"><span>Volumen para ti</span><input type="range" min="0" max="100" step="5" value="${v}" data-vv aria-label="Volumen"><i data-vvt>${v}%</i></label>
    ${adm?`<label class="vp-vol"><span>Volumen para todos (lo baja en la llamada de cada uno)</span><input type="range" min="0" max="100" step="5" value="${call.gvol&&call.gvol[id]!=null?call.gvol[id]:100}" data-vg2 aria-label="Volumen para todos"><i data-vg2t>${call.gvol&&call.gvol[id]!=null?call.gvol[id]:100}%</i></label>`:""}
    <button data-vme>${pr.off?"🔈 Volver a escucharlo":"🔇 Silenciar solo para mí"}</button>
    ${adm?(pr.lock?`<button class="pri" data-vun>🎤 Dejarlo hablar</button>`:`<button class="pri" data-vall>🔇 Silenciarlo para todos</button>`):""}`;
  document.body.appendChild(el);const r=anchor.getBoundingClientRect();el.style.left=Math.max(8,Math.min(innerWidth-el.offsetWidth-8,r.left))+"px";el.style.top=(r.top-el.offsetHeight-8>=8?r.top-el.offsetHeight-8:Math.min(innerHeight-el.offsetHeight-8,r.bottom+8))+"px";
  const vv=el.querySelector("[data-vv]");vv.oninput=()=>{vols()[id]=+vv.value;el.querySelector("[data-vvt]").textContent=vv.value+"%";applyVol(id)};vv.onchange=()=>{X.save();paintShareBar()};
  const vg2=el.querySelector("[data-vg2]");vg2&&(vg2.oninput=()=>{call.gvol=call.gvol||{};call.gvol[id]=+vg2.value;el.querySelector("[data-vg2t]").textContent=vg2.value+"%";applyVol(id)},
    vg2.onchange=()=>{cast(call.room,"v-gvol",{who:id,v:+vg2.value});paintShareBar()});
  el.querySelector("[data-vme]").onclick=()=>{pr.off=!pr.off;applyVol(id);el.remove();paintShareBar()};
  const va=el.querySelector("[data-vall]");va&&(va.onclick=()=>{cast(call.room,"v-mute",{to:id});pr.lock=true;pr.rm=true;el.remove();paintShareBar();X.toast(`Silenciaste a ${esc(pr.name||"esa persona")} para todos.`)});
  const vu=el.querySelector("[data-vun]");vu&&(vu.onclick=()=>{cast(call.room,"v-unmute",{to:id});pr.lock=false;el.remove();paintShareBar();X.toast(`${esc(pr.name||"Esa persona")} ya puede hablar.`)});
  setTimeout(()=>addEventListener("pointerdown",function f(e){if(!el.contains(e.target)){el.remove();removeEventListener("pointerdown",f,true)}},true),0)}

/* lista compacta de la llamada grupal: se abre desde el botón 👥 */
function vlist(anchor,refresh){const old=document.querySelector(".vlist");if(old&&!refresh){old.remove();return}if(!call){old&&old.remove();return}if(refresh&&!old)return;
  const el=old||document.createElement("div");el.className="vlist";el.setAttribute("role","menu");
  const rows=Object.keys(call.peers).map(id=>{const p=call.peers[id],v=vols()[id];return `<button class="vpeer vl-row${p.off?" off":""}${p.rm?" rm":""}" data-vp="${esc(id)}" role="menuitem"><span>${esc(p.name||"…")}</span><small>${p.rm?"🔇 mic apagado":p.off?"🔈 silenciado para ti":v!=null&&v<100?v+"%":""}</small></button>`}).join("");
  el.innerHTML=`<div class="vl-h">En la llamada <small>toca o clic derecho en un nombre: volumen y silencio</small></div><div class="vl-me">Tú${call.muted?" · 🔇":""}</div>${rows}`;
  if(refresh){el.querySelectorAll("[data-vp]").forEach(b=>(b.onclick=b.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();vpop(b.dataset.vp,b)}));return}
  document.body.appendChild(el);const r=anchor.getBoundingClientRect();el.style.left=Math.max(8,Math.min(innerWidth-el.offsetWidth-8,r.left))+"px";el.style.top=(r.bottom+6+el.offsetHeight<innerHeight?r.bottom+6:Math.max(8,r.top-el.offsetHeight-6))+"px";
  el.querySelectorAll("[data-vp]").forEach(b=>(b.onclick=b.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();vpop(b.dataset.vp,b)}));
  setTimeout(()=>addEventListener("pointerdown",function f(e){if(!el.isConnected){removeEventListener("pointerdown",f,true);return}if(!el.contains(e.target)&&!e.target.closest(".vpop,[data-vlist]")){el.remove();removeEventListener("pointerdown",f,true)}},true),0)}

/* ===================== voz (WebRTC) ===================== */
function ice(){const s=(window.__site0||{});const L=[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}];
  if(Array.isArray(s.iceServers))L.push(...s.iceServers);else if(s.turnUrl)L.push({urls:s.turnUrl,username:s.turnUser||"",credential:s.turnPass||""});return L}
/* micrófono: se pide solo al llamar; si está bloqueado se explica cómo activarlo según el navegador */
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const isSafari=/^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
async function micState(){try{const r=await navigator.permissions.query({name:"microphone"});return r.state}catch(e){return"prompt"}}
async function getMic(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){micHelp(location.protocol!=="https:"&&location.hostname!=="localhost"?"https":"nosup");return null}
  const st=await micState();if(st==="denied"){micHelp("denied");return null}
  if(st!=="granted")X.toast("🎤 Tu navegador te va a pedir permiso para el micrófono: toca <b>Permitir</b>.");
  try{return await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
  catch(e){const n=e&&e.name;micHelp(n==="NotAllowedError"||n==="SecurityError"?"denied":n==="NotFoundError"||n==="OverconstrainedError"?"nomic":n==="NotReadableError"||n==="AbortError"?"busy":"other",e);return null}}
function micHelp(kind,err){const old=document.querySelector(".sp-mic");if(old)old.remove();
  const how=isIOS?`<li>En iPhone: toca <b>aA</b> (o el candado) en la barra de dirección → <b>Ajustes del sitio web</b> → <b>Micrófono</b> → <b>Permitir</b>.</li><li>Si usas la app instalada: Ajustes del iPhone → Safari → Micrófono → Permitir.</li>`
    :isSafari?`<li>En Safari: menú <b>Safari → Ajustes → Sitios web → Micrófono</b> → elartegrafico.com → <b>Permitir</b>.</li>`
    :`<li>Toca el <b>candado 🔒</b> (o el ícono de ajustes) a la izquierda de la dirección <b>${esc(location.host)}</b>.</li><li>Busca <b>Micrófono</b> y cámbialo a <b>Permitir</b>.</li><li>Recarga la página y vuelve a llamar.</li>`;
  const T={denied:["El micrófono está bloqueado","Tu navegador no deja que EAG Charts use el micrófono. Actívalo así:",`<ol>${how}</ol><p class="sp-note">En Android también revisa: Ajustes del celular → Apps → Chrome → Permisos → Micrófono → Permitir.</p>`],
    nomic:["No encontramos micrófono","Conecta unos audífonos con micrófono o revisa que el micrófono del computador esté activado.",""],
    busy:["El micrófono está ocupado","Otra app (Zoom, WhatsApp, OBS, Discord…) lo está usando. Ciérrala o suelta el micrófono allá y vuelve a intentar.",""],
    https:["Se necesita conexión segura","Las llamadas solo funcionan entrando por https://charts.elartegrafico.com",""],
    nosup:["Tu navegador no permite llamadas","Usa Chrome, Edge, Firefox o Safari actualizados.",""],
    other:["No se pudo usar el micrófono",esc((err&&err.message)||"Intenta de nuevo."),""]}[kind]||[];
  const o=document.createElement("div");o.className="sp-mic";o.innerHTML=`<div class="sp-micb"><b>🎤 ${T[0]}</b><p>${T[1]}</p>${T[2]||""}<div class="sp-mica"><button class="btn sm gold" data-try>Intentar de nuevo</button><button class="btn sm" data-cl>Cerrar</button></div></div>`;
  document.body.appendChild(o);o.onclick=e=>{if(e.target===o)o.remove()};o.querySelector("[data-cl]").onclick=()=>o.remove();
  o.querySelector("[data-try]").onclick=async()=>{o.remove();const st=await micTest();if(st)X.toast("✅ Micrófono listo. Ya puedes llamar.")}}
/* probar el micrófono (Chat → ⚙): pide permiso y muestra el nivel 4 segundos */
async function micTest(bar){const stream=await getMic();if(!stream)return false;
  if(bar){try{const c=SND.ctx(),src=c.createMediaStreamSource(stream),an=c.createAnalyser();an.fftSize=256;src.connect(an);const d=new Uint8Array(an.frequencyBinCount),t0=Date.now();
    const f=()=>{an.getByteFrequencyData(d);const v=Math.min(100,d.reduce((a,b)=>a+b,0)/d.length*2.2);bar.style.width=v+"%";if(Date.now()-t0<4000)requestAnimationFrame(f);else{bar.style.width="0";stream.getTracks().forEach(t=>t.stop())}};f()}catch(e){stream.getTracks().forEach(t=>t.stop())}}
  else stream.getTracks().forEach(t=>t.stop());return true}
async function startCall(chatRoom){if(call)return X.toast("Ya estás en una llamada.");const room=uuid();
  if(!await enterVoice(room,"dm",chatRoom))return;await send(chatRoom,"","call",{room,act:"start"});ringOut()}
async function acceptCall(room,chatRoom){stopRing();if(call&&call.room===room)return;if(call)hangup(true);await enterVoice(room,"dm",chatRoom)}
async function joinVoiceGroup(){if(call)hangup(true);stopRing();const empty=!grpCount();if(!await enterVoice("voz-general","group",GEN))return;
  /* si la sala estaba vacía, avisa a todo el grupo para que entren */
  if(empty)send(GEN,"","call",{room:"voz-general",act:"start",group:true})}
/* quién está en la sala de voz del grupo, aunque yo no esté adentro (escucha sus latidos) */
const grp={};let grpHide=0;
const grpCount=()=>Object.keys(grp).filter(id=>Date.now()-grp[id].at<6000).length;
function vozHandler(ev,p){if(call&&call.room==="voz-general")onSignal(ev,p);if(!p||!p.from||p.from===ME.id)return;
  if(ev==="v-hb"||ev==="v-join"||ev==="v-offer")grp[p.from]={name:p.fname||(grp[p.from]&&grp[p.from].name)||"",at:Date.now()};if(ev==="v-leave")delete grp[p.from];paintGrp()}
function paintGrp(){const n=grpCount(),inside=call&&call.room==="voz-general";let el=document.querySelector(".sgl");
  if(!n||inside||Date.now()<grpHide){if(el)el.remove();return}
  const names=Object.keys(grp).filter(id=>Date.now()-grp[id].at<6000).map(id=>grp[id].name).filter(Boolean);
  if(!el){el=document.createElement("div");el.className="sgl";el.setAttribute("role","status");document.body.appendChild(el)}
  el.innerHTML=`<span class="sgl-ic" aria-hidden="true">🎙</span><span class="sgl-t"><b>Llamada grupal en curso</b><small>${esc(names.slice(0,3).join(", "))}${names.length>3?" y "+(names.length-3)+" más":""} · ${n} ${n===1?"persona":"personas"}</small></span><button class="btn sm gold" data-gj>Unirme</button><button class="sgl-x" data-gx aria-label="Ocultar">×</button>`;
  el.querySelector("[data-gj]").onclick=()=>joinVoiceGroup();el.querySelector("[data-gx]").onclick=()=>{grpHide=Date.now()+10*60000;el.remove()}}
setInterval(()=>{try{paintGrp()}catch(e){}},3000);
async function enterVoice(room,kind,chatRoom){const stream=await getMic();if(!stream)return false;
  call={room,kind,chat:chatRoom,peers:{},stream,muted:false,t0:Date.now()};
  sub(room,room==="voz-general"?vozHandler:(ev,p)=>onSignal(ev,p));
  [350,1500,4000].forEach(ms=>setTimeout(()=>{if(call&&call.room===room&&!Object.keys(call.peers).length)cast(room,"v-join",{})},ms));
  clearInterval(call.tick);call.tick=setInterval(()=>{if(!call)return;paintShareBar();cast(call.room,"v-hb",{m:!!call.muted});
    const now=Date.now();Object.keys(call.peers).forEach(id=>{const pr=call.peers[id];if(now-(pr.at||now)>45000)dropPeer(id)});speakTick();
    if(call&&call.kind==="dm"&&!Object.keys(call.peers).length&&now-call.t0>45000){X.toast("No contestó.");hangup()}},1000);
  paintShareBar();paintBtn();if(view.room)paintRoom();
  X.toast(kind==="group"?"🎙 Entraste a la sala de voz del grupo.":"📞 Llamando…");return true}
function newPC(id,name){const pc=new RTCPeerConnection({iceServers:ice()});const pr=call.peers[id]=Object.assign(call.peers[id]||{},{pc,name,at:Date.now()});
  call.stream.getTracks().forEach(t=>pc.addTrack(t,call.stream));
  pc.onicecandidate=e=>{if(e.candidate&&call)cast(call.room,"v-ice",{to:id,c:e.candidate.toJSON?e.candidate.toJSON():e.candidate})};
  pc.ontrack=e=>{let a=pr.audio;if(!a){a=pr.audio=new Audio();a.autoplay=true;a.playsInline=true}a.srcObject=e.streams[0];a.muted=!!pr.off;a.volume=volOf(id);a.play().catch(()=>{});
    try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();const src=actx.createMediaStreamSource(e.streams[0]);const an=actx.createAnalyser();an.fftSize=256;src.connect(an);pr.an=an}catch(x){}};
  pc.onconnectionstatechange=()=>{if(!call)return;if(pc.connectionState==="connected"){stopRingOut();SND.play("join",true);paintShareBar()}
    if(pc.connectionState==="failed"){X.toast(`No se pudo conectar el audio con ${esc(name||"esa persona")} (su red lo bloquea).`);dropPeer(id)}};
  return pr}
async function onSignal(ev,p){if(!call||!p.from||p.from===ME.id)return;const id=p.from;
  if(ev==="v-hb"){const pr=call.peers[id];if(pr){pr.at=Date.now();if(pr.rm!==!!p.m){pr.rm=!!p.m;paintShareBar()}}return}
  if(ev==="v-gvol"){if(p.who===ME.id){X.toast(+p.v<100?`🔉 ${p.fname||"El profe"} bajó tu volumen en la llamada al ${p.v}%.`:"🔊 Tu volumen en la llamada volvió a 100%.");return}
    call.gvol=call.gvol||{};call.gvol[p.who]=Math.max(0,Math.min(100,+p.v||0));applyVol(p.who);paintShareBar();return}
  if(ev==="v-mute"||ev==="v-unmute"){if(p.to!==ME.id)return;
    if(ev==="v-mute"){call.lock=true;call.muted=true;call.stream&&call.stream.getAudioTracks().forEach(t=>t.enabled=false);X.toast("🔇 "+(p.fname||"El profe")+" te silenció en la llamada.")}
    else{call.lock=false;X.toast("🎤 "+(p.fname||"El profe")+" te dejó hablar. Toca el micrófono para activarlo.")}
    cast(call.room,"v-hb",{m:!!call.muted});paintShareBar();return}
  if(ev==="v-leave"){dropPeer(id);return}
  if(ev==="v-muteall"){if(!call.muted){call.muted=true;call.stream&&call.stream.getAudioTracks().forEach(t=>t.enabled=false);paintShareBar()}cast(call.room,"v-hb",{m:true});X.toast("🔇 "+(p.fname||"El profe")+" silenció los micrófonos. Toca 🔇 para volver a hablar.");return}
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
  c.stream&&c.stream.getTracks().forEach(t=>t.stop());clearInterval(c.tick);if(c.room!=="voz-general")unsub(c.room);stopRingOut();setTimeout(paintGrp,300);
  if(c.kind==="dm"&&!quiet)send(c.chat,"","call",{room:c.room,act:"end"});
  SND.play("leave",true);document.querySelectorAll(".vlist,.vpop").forEach(e=>e.remove());paintShareBar();paintBtn();if(view.room)paintRoom();if(!quiet)X.toast("Colgaste.")}
function speakTick(){if(!call||!shBar)return;Object.keys(call.peers).forEach(id=>{const pr=call.peers[id];if(!pr.an)return;const d=new Uint8Array(pr.an.frequencyBinCount);pr.an.getByteFrequencyData(d);
  const v=d.reduce((a,b)=>a+b,0)/d.length;document.querySelectorAll(`.sbar [data-vp="${CSS.escape(id)}"],.vlist [data-vp="${CSS.escape(id)}"]`).forEach(el=>el.classList.toggle("talk",v>18));pr.tk=v>18});
  const w=shBar.querySelector(".vl-who");if(w){const t=Object.values(call.peers).filter(p=>p.tk&&!p.off).map(p=>p.name).slice(0,2).join(", ");w.textContent=t?"🗣 "+t:"";w.classList.toggle("on",!!t)}}
/* timbre: suave, se repite unos segundos */
let ringT=0,ringOutT=0;
function tone(f,dur,vol){try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=f;g.gain.setValueAtTime(.0001,actx.currentTime);g.gain.exponentialRampToValueAtTime(vol||.05,actx.currentTime+.03);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+dur);o.connect(g);g.connect(actx.destination);o.start();o.stop(actx.currentTime+dur+.02)}catch(e){}}
function ringBox(m,o){stopRing();ringing={room:o.room,chat:m.room,name:m.username||nameOf(m.sender),from:m.sender,group:!!o.group};
  const el=document.createElement("div");el.className="sring"+(o.group?" grp":"");el.setAttribute("role","alertdialog");el.setAttribute("aria-label",o.title);
  el.innerHTML=`<div class="sr-av">${av({id:m.sender,username:ringing.name,avatar_url:m.avatar_url})}</div><div class="sr-t"><small>${esc(o.title)}</small><b>${esc(ringing.name)}</b><span>${esc(o.sub)}</span></div>
    <div class="sr-b"><button class="sr-no" data-r>${o.group?"Ahora no":"Rechazar"}</button><button class="sr-yes" data-a>${o.group?"Unirme":"Contestar"}</button></div>
    ${o.group?`<button class="sr-mute" data-gm>🔕 Silenciar avisos de llamadas grupales</button>`:""}`;
  document.body.appendChild(el);ringing.el=el;
  el.querySelector("[data-a]").onclick=()=>{const r=ringing;r.group?joinVoiceGroup():acceptCall(r.room,r.chat)};
  el.querySelector("[data-r]").onclick=()=>stopRing();
  const gm=el.querySelector("[data-gm]");gm&&(gm.onclick=()=>{cfg().grpRing=false;X.save();stopRing("Listo: las llamadas grupales ya no suenan. Lo cambias en Chat → ⚙.");setTimeout(paintGrp,300)});
  /* el título de la pestaña parpadea y el celular vibra, para que se note aunque esté en otra pestaña */
  const t0=document.title;let n=0;ringing.t0=t0;
  const ring=()=>{if(!ringing||n++>o.times){stopRing();return}if(cfg().snd!==false){tone(660,.2,.08);setTimeout(()=>tone(880,.24,.08),230);setTimeout(()=>tone(990,.2,.06),470)}
    document.title=n%2?(o.group?"🎙 Llamada grupal":"📞 "+ringing.name+" te llama"):t0;try{navigator.vibrate&&navigator.vibrate([250,120,250])}catch(e){}ringT=setTimeout(ring,2000)};ring()}
function incoming(m){const p=m.payload||{};if(!p.room||call)return;if(Date.now()-new Date(m.created_at)>60000)return;
  ringBox(m,{room:p.room,title:"Llamada de voz",sub:"Te está llamando",times:14})}
function incomingGroup(m){const p=m.payload||{};if(call&&call.room==="voz-general")return;if(Date.now()-new Date(m.created_at)>60000)return;if(cfg().hidden||cfg().grpRing===false){setTimeout(paintGrp,500);return}
  ringBox(m,{room:"voz-general",group:true,title:"Llamada grupal",sub:"Abrió la sala de voz del grupo",times:4});setTimeout(paintGrp,500)}
function stopRing(msg){clearTimeout(ringT);if(ringing){if(ringing.el)ringing.el.remove();if(ringing.t0)document.title=ringing.t0}ringing=null;if(msg)X.toast(msg)}
function ringOut(){let n=0;const r=()=>{if(!call||Object.keys(call.peers).some(id=>call.peers[id].pc&&call.peers[id].pc.connectionState==="connected")||n++>15){if(call&&!Object.keys(call.peers).length&&n>15){X.toast("No contestó.");hangup()}return}tone(440,.4,.03);ringOutT=setTimeout(r,2500)};ringOutT=setTimeout(r,800)}
function stopRingOut(){clearTimeout(ringOutT)}

/* ===================== API pública ===================== */
window.EAGSocial={
  unread:()=>unread||0,isOpen:()=>!!panel,close:()=>close(),
  init(o){X=o;const pr=(X.API.profile&&X.API.profile())||{};const u=X.API.user&&X.API.user();if(!u)return;ME={id:u.id,name:pr.username||"Yo",admin:!!(X.API.isAdmin&&X.API.isAdmin())};
    imgClean();paintBtn();headPaint();if(X.btn)X.btn.onclick=e=>{e.stopPropagation();panel?close():open()};
    localBus();rtConnect();sub("voz-general",vozHandler);loadGroups().then(loadThreads);setInterval(()=>{if(!document.hidden)loadGroups().then(()=>{if(panel&&!view.room)paintPanel()})},120000);setTimeout(loadPeople,2500);setTimeout(missedMentions,4000);setInterval(()=>{if(!document.hidden&&!(panel&&!view.room))loadPeople()},60000);
    clearInterval(thrT);thrT=setInterval(()=>{if(document.hidden)return;if(!rtJoined)loadThreads();if(panel&&view.room&&!rtJoined)loadRoom(view.room)},rtJoined?60000:15000);
    if(cfg().hidden)X.API.chatHidden(true).catch(()=>{});
    /* si recargó la página mientras compartía, vuelve a entrar */
    try{const s=JSON.parse(sessionStorage.getItem("eag_share")||"null");if(s&&s.room)setTimeout(()=>joinShare(s.room,s.with),1500)}catch(e){}
    addEventListener("beforeunload",()=>{if(share)cast(share.room,"bye",{});if(call)cast(call.room,"v-leave",{})});
    addEventListener("keydown",e=>{if(e.key==="Escape"&&panel&&!view.room)close()});addEventListener("resize",()=>geo())},
  drawingsChanged(){if(share){clearTimeout(share.dt);share.dt=setTimeout(()=>shareSend(),250)}
    clearTimeout(this.__dc);this.__dc=setTimeout(()=>{let n=0;try{X.panes().forEach(p=>{n+=(p.kc.drawings()||[]).length})}catch(e){return}if(this.__dn!=null&&n>this.__dn)SND.play("tool");this.__dn=n},120)},
  panesChanged(){applyShare()},
  laser(pt){if(share&&pt&&(pt.sym||pt.off))cast(share.room,"laser",{pt})},
  open:r=>open(r),dm:(id,n)=>startDM(id,n),
  bus:{cast:(r,e,p)=>cast(r,e,p),sub:(r,f)=>sub(r,f),unsub:r=>unsub(r),ice:()=>ice(),getMic:()=>getMic(),me:()=>ME},
  state:()=>({share:!!share,call:!!call,voz:call?Object.keys(call.peers).map(id=>call.peers[id].pc&&call.peers[id].pc.connectionState):[],unread,people:people.length,threads:threads.length})};
})();
