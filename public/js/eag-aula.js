/* EAG Charts · Clase en vivo, funciones tipo Zoom.
   - Voz de la clase: el profe habla y todos los alumnos con el Modo Clase lo escuchan.
     Cada alumno se conecta solo con el profe (estrella), así aguanta muchos alumnos.
     Los alumnos entran solo escuchando (no se les pide micrófono). Si el profe le da la palabra a alguien,
     a ese alumno se le pide el micrófono y su voz le llega al profe y, mezclada por el profe, a todos los demás.
   - Levantar la mano, reacciones que flotan, pedir atención, encuestas rápidas con resultados en vivo,
     silenciar a todos y bajar todas las manos. */
(function(){
"use strict";
const ROOM="clase-live";
let X=null,B=null,ME=null,ADMIN=false,ui=null,hbT=0,tick=0;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const T={voice:false,mic:null,muted:false,ctx:null,mSrc:null,peers:{},hands:new Map(),floor:new Set(),listen:new Map(),poll:null,votes:new Map(),pop:null};
const A={hb:0,voice:false,pc:null,tr:null,audio:null,mic:null,listen:false,hand:false,floor:false,poll:null,voted:null,res:null,teacher:null};
const REACT=["👍","👏","🔥","❤️","😂","😮","🙏","❓"];
const isT=()=>ADMIN&&X.clase&&X.clase.isTx&&X.clase.isTx();
const inC=()=>!ADMIN&&X.clase&&X.clase.inClass&&X.clase.inClass();
const cast=(ev,p)=>{try{B.cast(ROOM,ev,Object.assign({},p||{},{from:ME.id,fname:ME.name}))}catch(e){}};
const toast=t=>X.toast(t);

/* ======================== PROFE ======================== */
async function tVoice(on){if(on===T.voice)return;
  if(on){const m=await B.getMic();if(!m)return;T.mic=m;T.muted=false;try{T.ctx=new(window.AudioContext||window.webkitAudioContext)();T.mSrc=T.ctx.createMediaStreamSource(m)}catch(e){toast("Tu navegador no deja mezclar audio.");m.getTracks().forEach(t=>t.stop());return}
    T.voice=true;cast("c-hb",hbPl());toast("🎙 Abriste la voz de la clase. Los alumnos con el Modo Clase te escuchan al tocar «Escuchar».");}
  else{T.voice=false;Object.keys(T.peers).forEach(dropT);T.floor.clear();cast("c-voff",{});if(T.mic)T.mic.getTracks().forEach(t=>t.stop());T.mic=null;try{T.ctx&&T.ctx.close()}catch(e){}T.ctx=null;T.mSrc=null;toast("Cerraste la voz de la clase.")}
  paint()}
function tMute(){if(!T.mic)return;T.muted=!T.muted;T.mic.getAudioTracks().forEach(t=>t.enabled=!T.muted);paint()}
/* mezcla para un alumno: la voz del profe + la de los que tienen la palabra (menos la suya) */
function remix(){Object.keys(T.peers).forEach(id=>{const pr=T.peers[id];if(!pr.dest)return;
  Object.keys(T.peers).forEach(o=>{const q=T.peers[o];if(!q.src||o===id)return;const want=T.floor.has(o),has=pr.mix.has(o);
    if(want&&!has){try{q.src.connect(pr.dest);pr.mix.add(o)}catch(e){}}else if(!want&&has){try{q.src.disconnect(pr.dest)}catch(e){}pr.mix.delete(o)}})})}
async function tJoin(id,name){if(!T.voice||!T.ctx)return;dropT(id);
  const pc=new RTCPeerConnection({iceServers:B.ice()}),dest=T.ctx.createMediaStreamDestination();T.mSrc.connect(dest);
  const pr=T.peers[id]={pc,dest,name,mix:new Set(),ice:[],src:null,audio:null,at:Date.now()};
  pc.addTrack(dest.stream.getAudioTracks()[0],dest.stream);
  pc.onicecandidate=e=>{if(e.candidate)cast("c-ice",{to:id,c:e.candidate.toJSON?e.candidate.toJSON():e.candidate})};
  pc.ontrack=e=>{const st=e.streams[0]||new MediaStream([e.track]);let a=pr.audio;if(!a){a=pr.audio=new Audio();a.autoplay=true;a.playsInline=true}a.srcObject=st;a.play().catch(()=>{});
    try{pr.src=T.ctx.createMediaStreamSource(st)}catch(x){}remix()};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==="failed"||pc.connectionState==="closed"){dropT(id);paint()}};
  try{const o=await pc.createOffer();await pc.setLocalDescription(o);cast("c-offer",{to:id,sdp:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}})}catch(e){}
  T.listen.set(id,{name,at:Date.now()});paint()}
function dropT(id){const pr=T.peers[id];if(!pr)return;try{pr.pc.close()}catch(e){}try{pr.audio&&(pr.audio.srcObject=null)}catch(e){}try{pr.src&&pr.src.disconnect()}catch(e){}try{T.mSrc&&T.mSrc.disconnect(pr.dest)}catch(e){}
  delete T.peers[id];T.floor.delete(id);remix()}
function giveFloor(id,on){if(on){T.floor.add(id);T.hands.delete(id)}else T.floor.delete(id);cast("c-floor",{to:id,on:!!on});remix();paint()}
function allQuiet(){[...T.floor].forEach(id=>cast("c-floor",{to:id,on:false}));T.floor.clear();remix();paint();toast("🔇 Nadie tiene la palabra.")}
function handsDown(){T.hands.clear();cast("c-hdown",{all:true});paint()}
function attention(){cast("c-attn",{});toast("🔔 Les pediste atención a todos.")}
function pollStart(q,opts){T.poll={id:Date.now().toString(36),q,opts,open:true};T.votes=new Map();cast("c-poll",{poll:T.poll});paint()}
function pollShow(){if(!T.poll)return;cast("c-pres",{id:T.poll.id,counts:counts(),q:T.poll.q,opts:T.poll.opts});toast("📊 Les mostraste los resultados.")}
function pollEnd(){if(!T.poll)return;cast("c-pend",{id:T.poll.id});T.poll=null;paint()}
const counts=()=>{const c=T.poll?T.poll.opts.map(()=>0):[];T.votes.forEach(i=>{if(c[i]!=null)c[i]++});return c};
const hbPl=()=>({voice:T.voice,poll:T.poll&&T.poll.open?T.poll:null});

/* ======================== ALUMNO ======================== */
async function aListen(on){if(on===A.listen)return;
  if(on){if(!A.voice){toast("El profe todavía no abrió la voz.");return}A.listen=true;A.audio=A.audio||new Audio();A.audio.autoplay=true;A.audio.playsInline=true;try{A.audio.play().catch(()=>{})}catch(e){}cast("c-join",{});toast("🎧 Conectando con el profe…");setTimeout(()=>{if(A.listen&&!A.pc)cast("c-join",{})},4000)}
  else{A.listen=false;aDrop();cast("c-leave",{})}
  paint()}
function aDrop(){try{A.pc&&A.pc.close()}catch(e){}A.pc=null;A.tr=null;if(A.audio)A.audio.srcObject=null;if(A.mic){A.mic.getTracks().forEach(t=>t.stop());A.mic=null}A.floor=false}
async function aOffer(p){if(!A.listen)return;aDrop();const pc=A.pc=new RTCPeerConnection({iceServers:B.ice()});A.ice=[];
  pc.onicecandidate=e=>{if(e.candidate)cast("c-ice",{to:p.from,c:e.candidate.toJSON?e.candidate.toJSON():e.candidate})};
  pc.ontrack=e=>{const st=e.streams[0]||new MediaStream([e.track]);A.audio.srcObject=st;A.audio.play().catch(()=>toast("Toca la pantalla para escuchar al profe."));};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==="connected"){toast("🎧 Estás escuchando al profe.");paint()}if(pc.connectionState==="failed"){toast("No se pudo conectar el audio (tu red lo bloquea).");}};
  try{await pc.setRemoteDescription(p.sdp);A.tr=pc.getTransceivers()[0];if(A.tr)A.tr.direction="sendrecv";const a=await pc.createAnswer();await pc.setLocalDescription(a);
    cast("c-answer",{to:p.from,sdp:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});(A.ice||[]).forEach(c=>pc.addIceCandidate(c).catch(()=>{}));A.ice=null}catch(e){}}
async function aFloor(on){if(on){if(!A.pc||!A.tr){toast("El profe te dio la palabra: toca «Escuchar» primero.");return}const m=await B.getMic();if(!m){cast("c-floor-no",{});return}
    A.mic=m;try{await A.tr.sender.replaceTrack(m.getAudioTracks()[0])}catch(e){}A.floor=true;A.hand=false;A.micOn=true;toast("🎤 Tienes la palabra: todos te escuchan.");try{window.EAGN&&window.EAGN.notify({cat:"sistema",icon:"🎤",title:"Tienes la palabra",body:"El profe te dio la palabra. Habla cuando quieras.",important:true,sound:"exito"})}catch(e){}}
  else{A.floor=false;if(A.tr)try{await A.tr.sender.replaceTrack(null)}catch(e){}if(A.mic){A.mic.getTracks().forEach(t=>t.stop());A.mic=null}toast("El profe te quitó la palabra.")}
  paint()}
function aMic(){if(!A.mic)return;A.micOn=!A.micOn;A.mic.getAudioTracks().forEach(t=>t.enabled=A.micOn);paint()}
function aHand(){A.hand=!A.hand;cast("c-hand",{up:A.hand});if(A.hand)toast("✋ Levantaste la mano. El profe la ve.");paint()}
function react(e){cast("c-react",{e});floatR(e,ME.name)}
function attnShow(name){const el=document.createElement("div");el.className="au-attn";el.innerHTML=`<div><span>🔔</span><b>${esc(name||"El profe")} pide tu atención</b><small>Mira la clase</small><button>Entendido</button></div>`;
  document.body.appendChild(el);el.querySelector("button").onclick=()=>el.remove();setTimeout(()=>el.remove(),9000);
  try{window.EAGN&&window.EAGN.notify({cat:"sistema",icon:"🔔",title:`${name||"El profe"} pide tu atención`,body:"Clase en vivo",important:true,sound:"llamado",vibrate:[500,150,500],card:false,sys:true})}catch(e){}}

/* ======================== mensajes ======================== */
function onEv(ev,p){if(!p||!p.from||p.from===ME.id)return;tick++;
  if(ADMIN){/* lo que mandan los alumnos */
    if(ev==="c-join"){if(isT())tJoin(p.from,p.fname)}
    else if(ev==="c-leave"){dropT(p.from);T.listen.delete(p.from);paint()}
    else if(ev==="c-answer"){const pr=T.peers[p.from];if(pr&&p.to===ME.id){pr.pc.setRemoteDescription(p.sdp).then(()=>{pr.ice.forEach(c=>pr.pc.addIceCandidate(c).catch(()=>{}));pr.ice=null}).catch(()=>{})}}
    else if(ev==="c-ice"){const pr=T.peers[p.from];if(pr&&p.to===ME.id){if(pr.ice)pr.ice.push(p.c);else pr.pc.addIceCandidate(p.c).catch(()=>{})}}
    else if(ev==="c-hand"){if(p.up)T.hands.set(p.from,{name:p.fname,at:Date.now()});else T.hands.delete(p.from);paint();if(p.up&&isT()){try{window.EAGN&&window.EAGN.notify({cat:"sistema",icon:"✋",title:`${p.fname||"Un alumno"} levantó la mano`,body:"Toca ✋ en la barra de la clase para darle la palabra",sound:"pop"})}catch(e){}}}
    else if(ev==="c-vote"){if(T.poll&&p.id===T.poll.id){T.votes.set(p.from,+p.i);paint()}}
    else if(ev==="c-react"){floatR(p.e,p.fname)}
    else if(ev==="c-shb"){T.listen.set(p.from,{name:p.fname,at:Date.now(),on:!!p.l});if(p.hand&&!T.hands.has(p.from))T.hands.set(p.from,{name:p.fname,at:Date.now()})}
    else if(ev==="c-floor-no"){T.floor.delete(p.from);paint();toast(`${esc(p.fname||"El alumno")} no dio permiso al micrófono.`)}
    return}
  /* lo que manda el profe */
  if(ev==="c-hb"){A.hb=Date.now();A.teacher=p.fname;const was=A.voice;A.voice=!!p.voice;if(p.poll&&(!A.poll||A.poll.id!==p.poll.id)){A.poll=p.poll;A.voted=null;A.res=null}if(!p.poll&&A.poll&&!A.res)A.poll=null;
    if(A.voice&&!was&&inC()&&!A.listen)toast("🎙 El profe abrió la voz de la clase: toca «Escuchar».");if(!A.voice&&A.listen){aDrop();A.listen=false}paint()}
  else if(ev==="c-voff"){A.voice=false;if(A.listen){aDrop();A.listen=false;toast("El profe cerró la voz de la clase.")}paint()}
  else if(ev==="c-offer"){if(p.to===ME.id)aOffer(p)}
  else if(ev==="c-ice"){if(p.to===ME.id){if(A.pc&&!A.ice)A.pc.addIceCandidate(p.c).catch(()=>{});else(A.ice=A.ice||[]).push(p.c)}}
  else if(ev==="c-floor"){if(p.to===ME.id)aFloor(!!p.on)}
  else if(ev==="c-hdown"){if(A.hand){A.hand=false;paint()}}
  else if(ev==="c-attn"){if(inC())attnShow(p.fname)}
  else if(ev==="c-poll"){if(inC()){A.poll=p.poll;A.voted=null;A.res=null;paint();try{window.EAGN&&window.EAGN.notify({cat:"sistema",icon:"📊",title:"Encuesta del profe",body:p.poll.q,sound:"aviso"})}catch(e){}}}
  else if(ev==="c-pres"){if(inC()){A.res=p;A.poll=A.poll||{id:p.id,q:p.q,opts:p.opts};paint()}}
  else if(ev==="c-pend"){if(A.poll&&A.poll.id===p.id){A.poll=null;A.res=null;paint()}}
  else if(ev==="c-react"){if(inC())floatR(p.e,p.fname)}}

/* ======================== reacciones flotando ======================== */
function floatR(e,name){if(!REACT.includes(e))return;let lay=document.querySelector(".au-fly");if(!lay){lay=document.createElement("div");lay.className="au-fly";document.body.appendChild(lay)}
  const it=document.createElement("div");it.className="au-r";it.style.left=(8+Math.random()*60)+"px";it.innerHTML=`<span>${e}</span><small>${esc(String(name||"").slice(0,14))}</small>`;lay.appendChild(it);setTimeout(()=>it.remove(),3600);
  while(lay.children.length>24)lay.firstChild.remove()}

/* ======================== barra de la clase ======================== */
function pos(){const p=(X.SAVE.aulaPos)||null;if(p&&ui&&!(X.isPhone&&X.isPhone())){ui.style.left=Math.max(4,Math.min(innerWidth-ui.offsetWidth-4,p.x))+"px";ui.style.top=Math.max(4,Math.min(innerHeight-ui.offsetHeight-4,p.y))+"px";ui.style.bottom="auto"}}
function ensure(){if(ui)return ui;ui=document.createElement("div");ui.className="au-bar";ui.setAttribute("role","toolbar");ui.setAttribute("aria-label","Clase en vivo");document.body.appendChild(ui);
  ui.addEventListener("click",onClick);ui.addEventListener("pointerdown",e=>{const h=e.target.closest(".au-h");if(!h)return;e.preventDefault();const r=ui.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;h.setPointerCapture(e.pointerId);
    h.onpointermove=ev=>{ui.style.left=Math.max(4,Math.min(innerWidth-r.width-4,ev.clientX-ox))+"px";ui.style.top=Math.max(4,Math.min(innerHeight-r.height-4,ev.clientY-oy))+"px";ui.style.bottom="auto"};
    h.onpointerup=()=>{h.onpointermove=null;const q=ui.getBoundingClientRect();X.SAVE.aulaPos={x:q.left,y:q.top};X.save()}});
  return ui}
function paint(){const show=isT()||(inC());if(!show){if(ui){ui.remove();ui=null}document.querySelector(".au-pop")&&document.querySelector(".au-pop").remove();return}
  const el=ensure(),min=!!X.SAVE.aulaMin;el.classList.toggle("min",min);
  if(isT()){const nL=[...T.listen.values()].filter(v=>Date.now()-v.at<25000).length,nH=T.hands.size,nP=Object.keys(T.peers).length;
    el.innerHTML=`<span class="au-h" title="Mover">⋮⋮</span><b class="au-t"><i class="au-dot"></i>Clase</b>
      ${min?`<button data-a="max" title="Abrir">▴${nH?` ✋${nH}`:""}</button>`:`
      <button data-a="voice" class="${T.voice?"on":""}" title="${T.voice?"Cerrar la voz de la clase":"Abrir la voz: los alumnos te escuchan"}">🎙<span>${T.voice?"Voz abierta":"Abrir voz"}</span></button>
      ${T.voice?`<button data-a="mute" class="${T.muted?"warn":""}" title="${T.muted?"Activar mi micrófono":"Silenciar mi micrófono"}">${T.muted?"🔇":"🎤"}</button>`:""}
      <span class="au-n" title="Escuchando la voz / en la clase">🎧 ${nP}<small>/${nL}</small></span>
      <button data-a="hands" class="${nH?"hot":""}" title="Manos levantadas y quién tiene la palabra">✋<span>Manos</span>${nH?`<em>${nH}</em>`:""}</button>
      <button data-a="poll" class="${T.poll?"on":""}" title="Encuesta rápida">📊<span>Encuesta</span></button>
      <button data-a="attn" title="Pedir atención a todos (suena y vibra)">🔔</button>
      ${T.floor.size?`<button data-a="quiet" title="Quitarles la palabra a todos">🔇<span>Silenciar todos</span></button>`:""}
      <button data-a="min" title="Minimizar">–</button>`}`}
  else{const voiceTxt=A.listen?(A.pc&&A.pc.connectionState==="connected"?"Escuchando":"Conectando…"):"Escuchar";
    el.innerHTML=`<span class="au-h" title="Mover">⋮⋮</span><b class="au-t"><i class="au-dot"></i>Clase</b>
      ${min?`<button data-a="max" title="Abrir">▴</button>`:`
      ${A.voice?`<button data-a="listen" class="${A.listen?"on":"gold"}" title="${A.listen?"Dejar de escuchar":"Escuchar al profe"}">🎧<span>${voiceTxt}</span></button>`:`<span class="au-n" title="El profe todavía no abrió la voz">🔈 Sin voz</span>`}
      ${A.floor?`<button data-a="amic" class="${A.micOn?"on":"warn"}" title="Tu micrófono">${A.micOn?"🎤 Tienes la palabra":"🔇 Micrófono apagado"}</button>`:`<button data-a="hand" class="${A.hand?"hot":""}" title="${A.hand?"Bajar la mano":"Levantar la mano para hablar o preguntar"}">✋<span>${A.hand?"Bajar mano":"Levantar mano"}</span></button>`}
      <span class="au-rx">${REACT.map(e=>`<button data-r="${e}" title="Reaccionar">${e}</button>`).join("")}</span>
      <button data-a="min" title="Minimizar">–</button>`}`}
  pos();paintPoll()}
function onClick(e){const r=e.target.closest("[data-r]");if(r){react(r.dataset.r);return}const b=e.target.closest("[data-a]");if(!b)return;const a=b.dataset.a;
  if(a==="min"){X.SAVE.aulaMin=true;X.save();paint()}else if(a==="max"){X.SAVE.aulaMin=false;X.save();paint()}
  else if(a==="voice")tVoice(!T.voice);else if(a==="mute")tMute();else if(a==="attn")attention();else if(a==="quiet")allQuiet();
  else if(a==="hands")handsPop(b);else if(a==="poll")pollPop(b);
  else if(a==="listen")aListen(!A.listen);else if(a==="hand")aHand();else if(a==="amic")aMic()}
function popAt(anchor,html){let p=document.querySelector(".au-pop");if(p&&p.dataset.k===anchor.dataset.a){p.remove();return null}if(p)p.remove();p=document.createElement("div");p.className="au-pop";p.dataset.k=anchor.dataset.a;p.innerHTML=html;document.body.appendChild(p);
  const r=anchor.getBoundingClientRect();p.style.left=Math.max(6,Math.min(innerWidth-p.offsetWidth-6,r.left))+"px";p.style.top=(r.top-p.offsetHeight-8>6?r.top-p.offsetHeight-8:r.bottom+8)+"px";
  setTimeout(()=>addEventListener("pointerdown",function f(ev){if(!p.contains(ev.target)&&!anchor.contains(ev.target)){p.remove();removeEventListener("pointerdown",f,true)}},true),0);return p}
function handsPop(anchor){const H=[...T.hands.entries()],F=[...T.floor];const nm=id=>(T.hands.get(id)||T.listen.get(id)||(T.peers[id]||{})||{}).name||"Alumno";
  const p=popAt(anchor,`<b>✋ Manos levantadas (${H.length})</b>${H.map(([id,v])=>`<div class="au-li"><span>${esc(v.name||"Alumno")}</span>${T.peers[id]?`<button data-fl="${esc(id)}" class="gold">Dar la palabra</button>`:`<small>no está escuchando</small>`}<button data-hd="${esc(id)}" title="Bajarle la mano">✕</button></div>`).join("")||"<small>Nadie tiene la mano levantada.</small>"}
    <b>🎤 Con la palabra (${F.length})</b>${F.map(id=>`<div class="au-li"><span>${esc(nm(id))}</span><button data-nf="${esc(id)}">Quitar la palabra</button></div>`).join("")||"<small>Solo tú hablas.</small>"}
    ${H.length?`<button class="au-wide" data-hall>Bajar todas las manos</button>`:""}${T.voice?"":`<small class="au-note">Abre la voz (🎙) para poder darles la palabra.</small>`}`);if(!p)return;
  p.querySelectorAll("[data-fl]").forEach(b=>b.onclick=()=>{giveFloor(b.dataset.fl,true);p.remove()});p.querySelectorAll("[data-nf]").forEach(b=>b.onclick=()=>{giveFloor(b.dataset.nf,false);p.remove()});
  p.querySelectorAll("[data-hd]").forEach(b=>b.onclick=()=>{T.hands.delete(b.dataset.hd);cast("c-hdown",{to:b.dataset.hd});p.remove();paint()});const ha=p.querySelector("[data-hall]");ha&&(ha.onclick=()=>{handsDown();p.remove()})}
function pollPop(anchor){if(T.poll){const c=counts(),n=c.reduce((a,b)=>a+b,0);const p=popAt(anchor,`<b>📊 ${esc(T.poll.q)}</b>${T.poll.opts.map((o,i)=>`<div class="au-bar2"><span>${esc(o)}</span><i style="width:${n?Math.round(c[i]/n*100):0}%"></i><em>${c[i]} · ${n?Math.round(c[i]/n*100):0}%</em></div>`).join("")}<small>${n} voto${n===1?"":"s"}</small>
      <div class="au-row"><button data-ps class="gold">Mostrar resultados a todos</button><button data-pe>Terminar</button></div>`);if(!p)return;p.querySelector("[data-ps]").onclick=()=>pollShow();p.querySelector("[data-pe]").onclick=()=>{pollEnd();p.remove()};return}
  const p=popAt(anchor,`<b>📊 Encuesta rápida</b><input data-q maxlength="100" placeholder="Pregunta: ¿Compra o venta en esta zona?"><div class="au-row">${[["Sí / No","Sí|No"],["Compra / Venta / Espero","Compra|Venta|Espero"],["A / B / C","A|B|C"]].map(([t,v])=>`<button data-tpl="${v}">${t}</button>`).join("")}</div>
    <input data-o maxlength="120" placeholder="Opciones separadas por | (ej. Sí|No)" value="Sí|No"><button class="gold au-wide" data-go>Lanzar encuesta</button>`);if(!p)return;
  p.addEventListener("keydown",e=>e.stopPropagation());p.querySelectorAll("[data-tpl]").forEach(b=>b.onclick=()=>{p.querySelector("[data-o]").value=b.dataset.tpl});
  p.querySelector("[data-go]").onclick=()=>{const q=p.querySelector("[data-q]").value.trim()||"¿Qué harías aquí?",o=p.querySelector("[data-o]").value.split("|").map(s=>s.trim()).filter(Boolean).slice(0,6);if(o.length<2){toast("Pon al menos 2 opciones");return}pollStart(q,o);p.remove();toast("📊 Encuesta enviada.")};
  setTimeout(()=>{const q=p.querySelector("[data-q]");q&&q.focus()},30)}
/* tarjeta de la encuesta para el alumno */
function paintPoll(){let c=document.querySelector(".au-poll");if(ADMIN||!A.poll||!inC()){c&&c.remove();return}
  if(!c){c=document.createElement("div");c.className="au-poll";document.body.appendChild(c)}const R=A.res&&A.res.id===A.poll.id?A.res:null,n=R?R.counts.reduce((a,b)=>a+b,0):0;
  c.innerHTML=`<b>📊 ${esc(A.poll.q)}</b>${A.poll.opts.map((o,i)=>R?`<div class="au-bar2${A.voted===i?" me":""}"><span>${esc(o)}</span><i style="width:${n?Math.round(R.counts[i]/n*100):0}%"></i><em>${n?Math.round(R.counts[i]/n*100):0}%</em></div>`:`<button data-v="${i}" class="${A.voted===i?"on":""}">${esc(o)}</button>`).join("")}
    <small>${R?`Resultados · ${n} voto${n===1?"":"s"}`:A.voted!=null?"Tu voto quedó. Puedes cambiarlo.":"Toca tu respuesta"}</small><button class="au-x" data-px aria-label="Cerrar">✕</button>`;
  c.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{A.voted=+b.dataset.v;cast("c-vote",{id:A.poll.id,i:A.voted,to:"t"});paintPoll()});c.querySelector("[data-px]").onclick=()=>{A.poll=null;c.remove()}}

/* ======================== latidos ======================== */
function beat(){if(!B)return;
  if(isT()){cast("c-hb",hbPl());const now=Date.now();T.listen.forEach((v,k)=>{if(now-v.at>40000&&!T.peers[k])T.listen.delete(k)})}
  else if(ADMIN&&T.voice&&!isT()){tVoice(false)} /* terminó la clase: se cierra la voz */
  else if(inC()){cast("c-shb",{l:A.listen,hand:A.hand});if(A.voice&&Date.now()-A.hb>20000){A.voice=false;if(A.listen){aDrop();A.listen=false}}}
  else if(A.listen){aDrop();A.listen=false}
  paint()}

window.EAGAula={init(o){X=o;const S=window.EAGSocial;B=o.bus||(S&&S.bus);if(!B){return}ME=B.me&&B.me();if(!ME)return;ADMIN=!!(o.isAdmin&&o.isAdmin());
    B.sub(ROOM,onEv);clearInterval(hbT);hbT=setInterval(beat,3000);setTimeout(beat,1500);
    addEventListener("beforeunload",()=>{if(A.listen)cast("c-leave",{});if(T.voice)cast("c-voff",{})})},
  refresh:()=>paint(),voice:on=>tVoice(on!==false),
  _test(o){Object.assign(X,o.x||{});if(o.bus){B=o.bus;B.sub(ROOM,onEv)}if(o.me)ME=o.me;if(o.admin!=null)ADMIN=o.admin;paint()},
  _state:()=>({T:{voice:T.voice,peers:Object.keys(T.peers).length,hands:T.hands.size,floor:T.floor.size,poll:!!T.poll,votes:T.votes.size},A:{voice:A.voice,listen:A.listen,pc:A.pc&&A.pc.connectionState,hand:A.hand,floor:A.floor,poll:!!A.poll,voted:A.voted,res:!!A.res,audio:!!(A.audio&&A.audio.srcObject)}})};
})();
