/* © El Arte Gráfico. Todos los derechos reservados. Prohibida su copia o distribución sin autorización. */
/* El Arte Gráfico Academy — panel de administración. */
(function(){
"use strict";
const A=window.AGAPP;const {$,$$,esc,API,S,toast,busy,fmtT,fmtDate,fmtDT,TZ,MARKETS,MNAME,h1Bars,m5Bars,idxAt,avgRange,toC,Chart,app}=A;
let tab="resumen";
const GROUPS=[["General",["resumen","chat"]],["Academia",["cursos","contenido","ejercicios","banners","noticias","archivos"]],["Retos y puntos",["top","retos","afiliados","canjes","rpuntos"]],["Alumnos",["alumnos","pagos","resenas","opiniones","chartsop","notif"]],["Sitio",["sitio","legal"]]];
const TICO={top:"star",chat:"chat",cursos:"acad",retos:"bolt",afiliados:"users",canjes:"card",rpuntos:"gear",resumen:"chart",sitio:"site",banners:"image",contenido:"layers",ejercicios:"acad",noticias:"news",opiniones:"star",chartsop:"chart",resenas:"msg",pagos:"card",alumnos:"users",archivos:"folder",notif:"bell",legal:"scale"};
const TDESC={chat:"Conversaciones privadas con cada alumno. Se borran solas a los días que definas, o al instante con Finalizar.",cursos:"Cursos que se venden sueltos (de por vida) y cómo se ven los planes Cobre, Plata y Oro.",retos:"Crea el reto del día: cuestionario, ¿sube o baja? o marcar la zona. Los primeros en acertar ganan puntos.",afiliados:"Verifica quién abrió su cuenta de Deriv con tu enlace de socio: ganan los puntos completos.",
  top:"Los 10 primeros del ranking. Suma o quita puntos o saldo en dólares a cualquier alumno.",canjes:"Retiros de saldo de los retos express y canjes de puntos: paga y márcalos.",rpuntos:"Activa los retos, define cuánto vale cada punto y el mínimo para canjear.",resumen:"Cómo va la academia: alumnos, visitas y actividad.",sitio:"Textos, portada, precios, enlaces y datos de contacto de la web.",banners:"Imágenes y mensajes del carrusel de la portada y del ingreso.",
  contenido:"Módulos, lecciones, videos y el orden del temario.",ejercicios:"Gráficas, cálculos y preguntas de cada lección y de la práctica.",noticias:"Publicaciones de la comunidad y avisos.",
  opiniones:"Opiniones públicas de los alumnos: aprueba u oculta.",chartsop:"Quién está probando EAG Charts (3 días gratis) y qué recomiendan mejorar.",resenas:"Lo que dicen los alumnos al terminar cada módulo (privado).",pagos:"Pagos de Binance por confirmar y el historial.",
  alumnos:"Cuentas, premium, puntos y avance de cada alumno.",archivos:"Imágenes y archivos subidos.",notif:"Envía avisos al celular de los alumnos.",legal:"Términos, privacidad y avisos legales."};
const TABS=[["chat","Mensajes"],["cursos","Cursos y planes"],["top","Top, puntos y saldo"],["retos","Retos diarios"],["afiliados","Afiliados Deriv"],["canjes","Canjes"],["rpuntos","Ajustes de puntos"],["resumen","Estadísticas"],["sitio","Sitio y textos"],["banners","Banners"],["contenido","Módulos y lecciones"],["ejercicios","Ejercicios"],["noticias","Noticias"],["opiniones","Opiniones"],["chartsop","EAG Charts: prueba y opiniones"],["resenas","Reseñas de módulos"],["pagos","Pagos"],["alumnos","Alumnos"],["archivos","Archivos"],["notif","Notificaciones"],["legal","Legal"]];
A.ROUTES.admin=sub=>{
  if(!A.admin()){app.innerHTML=`<div class="empty">Esta sección es solo para administradores.<a class="btn sm" href="#inicio">Volver</a></div>`;return}
  let chatU=null;if(sub&&/^chat-/.test(sub)){tab="chat";chatU=sub.slice(5)}else if(sub&&TABS.some(t=>t[0]===sub))tab=sub;
  const closed=!!(S.site||{}).academyClosed;
  const cur=TABS.find(t=>t[0]===tab)||TABS[0];const ico=A.ico||(()=>"");
  app.innerHTML=`<div class="adm">
    <aside class="adm-side">
      <div class="adm-brand"><span class="eyebrow">Administración</span><b>Panel de control</b></div>
      <details class="adm-view"><summary class="btn sm">👁 Modo prueba: ver como alumno</summary><div class="adm-view-m">
        <button type="button" data-va="gratis"><b>Alumno gratis</b><small>Sin prueba, sin plan ni cursos</small></button>
        <button type="button" data-va="prueba"><b>En prueba gratis</b><small>Con el módulo de prueba abierto</small></button>
        <button type="button" data-va="curso"><b>Con un curso</b><small>Compró el curso suelto (de por vida)</small></button>
        <button type="button" data-va="cobre"><b>🟤 Cobre</b><small>Suscripción de 1 mes</small></button>
        <button type="button" data-va="plata"><b>⚪ Plata</b><small>Suscripción de 6 meses</small></button>
        <button type="button" data-va="oro"><b>🟡 Oro</b><small>12 meses, con Sala Oro</small></button>
        <button type="button" data-va="diamond"><b>💎 Diamond</b><small>Acceso a todo</small></button>
        <span class="dim">No cambia tu cuenta. Para salir toca "Volver a admin".</span></div></details>
      <div class="adm-st ${closed?"off":"on"}"><span class="dot"></span><div><b>Academia ${closed?"cerrada":"abierta"}</b><small>${closed?"Solo tú la ves":"Los alumnos pueden entrar"}</small></div><button class="btn sm ${closed?"gold":"bad"}" id="acSw">${closed?"Abrir":"Cerrar"}</button></div>
      ${closed?`<form class="adm-launch" id="acL"><label for="acAt">🚀 Abrir sola el (hora Colombia)<input id="acAt" type="datetime-local" value="${toLoc((S.site||{}).academyOpenAt)}"></label>
        <label for="acN">Mensaje del contador (opcional)<input id="acN" maxlength="120" value="${esc((S.site||{}).launchNote||"")}" placeholder="Ej.: precio de lanzamiento las primeras 48 h"></label>
        <div class="row"><button class="btn sm gold" type="submit">Guardar</button>${(S.site||{}).academyOpenAt?'<button class="btn sm ghost" type="button" id="acX">Quitar fecha</button>':""}</div>
        <small class="dim">Sale un contador en el inicio. A esa hora se abre sola, empieza la prueba gratis y se avisa a todos con una notificación.</small></form>`:""}
      <a class="adm-charts" href="https://charts.elartegrafico.com" target="_blank" rel="noopener"><span class="ac-i">📈</span><span><b>EAG Charts</b><small>Gráficos en vivo · ábrelo y agrégalo a tu pantalla de inicio</small></span><i>↗</i></a>
      <button type="button" class="adm-mbtn" id="admMb" aria-expanded="false">${ico(TICO[tab]||"news",20)}<span><small>Sección</small><b>${cur[1]}</b></span><i>▾</i></button>
      <nav class="adm-nav" aria-label="Secciones de administración">${GROUPS.map(([g,ks])=>`<div class="adm-g"><span class="adm-gt">${g}</span>${ks.map(k=>{const t=TABS.find(x=>x[0]===k);return `<button type="button" class="${tab===k?"on":""}" data-t="${k}"${tab===k?' aria-current="page"':""}>${ico(TICO[k]||"news",18)}<span>${t[1]}</span><i class="adm-b" data-badge="${k}"></i></button>`}).join("")}</div>`).join("")}</nav>
    </aside>
    <section class="adm-main"><header class="adm-h"><span class="adm-hi">${ico(TICO[tab]||"news",22)}</span><div><h1>${cur[1]}</h1><p class="muted">${TDESC[tab]||""}</p></div></header><div id="adm"></div></section>
  </div>`;
  $$("[data-va]").forEach(b=>b.onclick=()=>window.AGVIEW(b.dataset.va));
  $$("[data-t]").forEach(b=>b.onclick=()=>{location.hash="#admin-"+b.dataset.t});
  $("#admMb").onclick=()=>{const n=$(".adm-nav"),o=n.classList.toggle("open");$("#admMb").setAttribute("aria-expanded",String(o))};
  $("#acSw").onclick=()=>{const host=$("#acSw").parentElement;A.confirmInline(host,closed?"¿Abrir la academia a todos?":"¿Cerrar la academia?",async()=>{
    const ns=Object.assign({},S.site,{academyClosed:!closed},closed?{trialFrom:new Date().toISOString()}:{});try{await API.saveSite(ns);S.site=ns;A.applySite();toast(closed?(+(S.site.trialDays??7)>0?`Academia abierta · la prueba gratis de ${S.site.trialDays??7} días empieza hoy para todos`:"Academia abierta"):"Academia cerrada para alumnos");A.ROUTES.admin(tab)}catch(x){toast(x.message);A.ROUTES.admin(tab)}})};
  const acL=$("#acL");if(acL){const sv=async at=>{const ns=Object.assign({},S.site,{academyOpenAt:at,launchNote:$("#acN").value.trim()});if(!at)delete ns.academyOpenAt;
      try{await API.saveSite(ns);S.site=ns;A.applySite();toast(at?"Listo: la academia abre sola el "+fmtDT(at):"Fecha quitada");A.ROUTES.admin(tab)}catch(x){toast(x.message)}};
    acL.onsubmit=e=>{e.preventDefault();const v=fromLoc($("#acAt").value);if(!v){toast("Elige la fecha y la hora");return}if(new Date(v)<=new Date()){toast("Elige una fecha futura");return}sv(v)};
    const x=$("#acX");if(x)x.onclick=()=>sv(null)}
  if(tab==="chat")return chat(chatU);
  ({cursos,resumen,sitio,banners,contenido,ejercicios,noticias,opiniones,chartsop,resenas,pagos,alumnos,archivos,notif,legal,retos,afiliados,canjes,rpuntos,top})[tab]();
  const badge=(k,n)=>{const b=document.querySelector(`[data-badge="${k}"]`);if(b&&n){b.textContent=n;b.classList.add("on")}};
  if(API.dmBadge)API.dmBadge().then(b=>badge("chat",b&&b.unread)).catch(()=>{});
  if(API.adminAffiliates)API.adminAffiliates().then(l=>badge("afiliados",(l||[]).filter(x=>x.status==="pendiente").length)).catch(()=>{});
  if(API.adminRedemptions)API.adminRedemptions().then(l=>badge("canjes",(l||[]).filter(x=>x.status==="pendiente").length)).catch(()=>{});
  API.adminPayments().then(l=>{const n=(l||[]).filter(x=>x.status==="pendiente").length;const b=document.querySelector('[data-badge="pagos"]');if(b&&n){b.textContent=n;b.classList.add("on")}}).catch(()=>{});
};
const H=()=>$("#adm");
/* "Escribirle" desde cualquier tarjeta: abre el chat con un mensaje sugerido */
document.addEventListener("click",e=>{const b=e.target.closest("[data-dm]");if(!b)return;e.preventDefault();
  if(b.dataset.dmk!=null){const q=DM_QUICK()[+b.dataset.dmk];if(q)try{sessionStorage.setItem("ag_dm_pre",JSON.stringify({u:b.dataset.dm,t:q[1]}))}catch(x){}}
  location.hash="#admin-chat-"+b.dataset.dm});

/* ---------- mensajes privados ---------- */
const DM_QUICK=()=>{const pts=A.toMain?A.toMain("puntos"):"https://elartegrafico.com/#puntos";return[
  ["Saludo","Hola 👋 Te escribo desde El Arte Gráfico. ¿Cómo vas? Cualquier duda me la puedes escribir por aquí."],
  ["ID equivocado","Hola 👋 El ID que enviaste no es tu ID de cliente de Deriv. Entra a Deriv → tu perfil y copia tu ID de cliente (empieza por CR, o es un código largo como 019…). Luego lo vuelves a enviar en Mis puntos: "+pts],
  ["No está con mi enlace","Hola 👋 Tu cuenta de Deriv no aparece con mi enlace de socio. Si ya tenías cuenta, pide a soporte de Deriv un \"retag\" a El Arte Gráfico; el mensaje para copiar está en Mis puntos: "+pts],
  ["Verificado","¡Listo! ✅ Ya quedaste verificado como afiliado: desde ahora ganas los puntos completos en los retos."],
  ["Correo de Binance","Hola 👋 Para enviarte el pago, ¿me confirmas tu Binance Pay ID o tu correo de Binance?"],
  ["¿Resuelto?","¿Quedó resuelto? Si ya no necesitas nada más, cierro la conversación. 🙌"]]};
async function chat(sel){
  const ico=A.ico||(()=>"");
  H().innerHTML=`<div class="dm-adm"><aside class="dm-list"><div class="dm-new"><input id="dmQ" placeholder="Buscar alumno para escribirle…" autocomplete="off"><div id="dmRes" class="dm-res" hidden></div></div><div id="dmL"><div class="muted">Cargando…</div></div></aside><section class="dm-pane" id="dmP"></section></div>`;
  let users=null;const flagOf=c=>A.flag?A.flag(c||""):"";
  const loadList=async()=>{let L=[];try{L=await API.adminDmThreads()}catch(e){$("#dmL").innerHTML=`<div class="empty">¿Ya corriste <b>supabase/chat.sql</b>?<span class="dim">${esc(e.message)}</span></div>`;return}
    $("#dmL").innerHTML=L.length?L.map(t=>`<a class="dm-it${t.user_id===sel?" on":""}${t.unread?" new":""}" href="#admin-chat-${esc(t.user_id)}">${A.avatar?A.avatar({username:t.username,avatar_url:t.avatar_url},38):""}<span><b>${esc(t.username||"Alumno")} ${flagOf(t.country)}</b><small>${t.last_from_admin?"Tú: ":""}${esc((t.last_body||"").slice(0,70))}</small></span><i>${t.unread?`<em class="nbadge">${t.unread}</em>`:""}<small>${esc(fmtDate(t.last_at))}</small></i></a>`).join("")
      :`<div class="empty">Sin conversaciones abiertas. Busca un alumno arriba, o toca <b>Escribirle</b> en Afiliados o Alumnos.</div>`;
    const b=document.querySelector('[data-badge="chat"]');const n=L.reduce((a,t)=>a+t.unread,0);if(b){b.textContent=n||"";b.classList.toggle("on",!!n)}};
  $("#dmQ").oninput=async()=>{const q=$("#dmQ").value.trim().toLowerCase(),r=$("#dmRes");if(q.length<2){r.hidden=true;return}
    if(!users){try{users=await API.users()}catch(e){users=[]}}
    const m=users.filter(u=>(u.username||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q)).slice(0,8);
    r.hidden=false;r.innerHTML=m.length?m.map(u=>`<a href="#admin-chat-${esc(u.id)}">${esc(u.username)} <small class="dim">${esc(u.email||"")}</small></a>`).join(""):'<span class="dim">Nadie con ese nombre</span>'};
  await loadList();
  const P=$("#dmP");
  if(!sel){P.innerHTML=`<div class="dm-ph">${ico("chat",34)}<b>Elige una conversación</b><span class="muted">Los alumnos solo pueden responder cuando tú les escribes primero. Les llega una notificación al celular.</span></div>`;return}
  let d=null;try{d=await API.adminDmThread(sel)}catch(e){P.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  const u=d.user||{};
  P.innerHTML=`<header class="dm-ph-h"><a class="btn sm ghost dm-back" href="#admin-chat">←</a>${A.avatar?A.avatar(u,40):""}<div><b>${esc(u.username||"Alumno")} ${flagOf(u.country)}</b><small class="dim">${d.exists?"Conversación abierta":"Nueva conversación"}</small></div><span class="grow"></span>${d.exists?'<span id="dmEndH"><button class="btn sm bad" id="dmEnd">Finalizar y borrar</button></span>':""}</header>
    <div class="dm-quick">${DM_QUICK().map(([t],i)=>`<button type="button" class="chipb" data-q="${i}">${esc(t)}</button>`).join("")}</div><div id="dmBox"></div>`;
  const box=A.chatBox($("#dmBox"),{load:()=>API.adminDmThread(sel),send:Object.assign(async v=>{const m=await API.dmSend(v,sel);
      if(API.sendPush)API.sendPush({title:"💬 Mensaje de El Arte Gráfico",body:v.slice(0,140),url:(A.toMain?A.toMain("mensajes"):"https://elartegrafico.com/#mensajes"),user_id:sel,tag:"dm"}).catch(()=>{});
      if(!d.exists){d.exists=true;chat(sel)}else loadList();return m},{canStart:true}),me:"Tú",them:u.username||"Alumno",empty:"Escribe el primer mensaje. Le llegará una notificación."});
  $$("[data-q]").forEach(b=>b.onclick=()=>box.fill(DM_QUICK()[+b.dataset.q][1]));
  try{const pre=sessionStorage.getItem("ag_dm_pre");if(pre){sessionStorage.removeItem("ag_dm_pre");const o=JSON.parse(pre);if(o.u===sel)box.fill(o.t)}}catch(e){}
  const e=$("#dmEnd");if(e)e.onclick=()=>A.confirmInline($("#dmEndH"),"¿Borrar toda la conversación?",async()=>{try{await API.adminDmClose(sel);toast("Conversación finalizada y borrada");location.hash="#admin-chat"}catch(x){toast(x.message)}});
}
/* agrupa un formulario largo en tarjetas: cada <h3> abre una sección */
function groupForm(f){if(!f)return;const kids=[...f.children];let sec=null;const out=document.createDocumentFragment();
  kids.forEach(el=>{if(el.tagName==="H3"){sec=document.createElement("section");sec.className="fgroup";out.appendChild(sec)}
    else if(el.classList.contains("row")&&el.querySelector("#sv,button.gold:last-child")&&el===kids[kids.length-1]){el.classList.add("savebar");out.appendChild(el);return}
    (sec||out).appendChild(el)});
  f.innerHTML="";f.appendChild(out);f.classList.add("grouped")}
const fileBtn=(id,label="Subir imagen")=>`<label class="btn sm" for="${id}" style="cursor:pointer">${label}</label><input id="${id}" type="file" hidden accept="image/*">`;
function bindUpload(id,onUrl){const i=$("#"+id);if(!i)return;i.onchange=async e=>{const f=e.target.files[0];if(!f)return;toast("Subiendo…");try{const u=await API.upload(f);onUrl(u);toast("Archivo subido")}catch(x){toast(x.message)}}}

/* ---------- estadísticas ---------- */
/* ---------- qué necesita mi atención ---------- */
async function attention(host){if(!host||!API.adminAttention)return;let a;try{a=await API.adminAttention()}catch(e){host.innerHTML=`<div class="note">Corre <b>supabase/novedades.sql</b> para ver aquí lo pendiente.</div>`;return}
  const I=[];const add=(n,ic,t,sub,href,tone)=>{if(n)I.push(`<a class="attn-i ${tone||""}" href="${href}"><span class="attn-ic">${ic}</span><span><b>${n===true?"":n+" "}${t}</b>${sub?`<small>${sub}</small>`:""}</span><i>→</i></a>`)};
  add(a.payments,"💳",a.payments===1?"pago por confirmar":"pagos por confirmar","Revísalos en tu Binance y apruébalos","#admin-pagos","hot");
  add(a.dms,"💬",a.dms===1?"mensaje sin leer":"mensajes sin leer","De tus alumnos","#admin-chat","hot");
  add(a.reports,"🚩",a.reports===1?"mensaje reportado en la Sala Oro":"mensajes reportados en la Sala Oro","Bórralos o silencia a quien corresponda","#oro-chat","hot");
  add(a.redemptions,"💸",a.redemptions===1?"canje por pagar":"canjes por pagar","Pagos de puntos en USDT","#admin-canjes");
  add(a.affiliates,"🤝",a.affiliates===1?"afiliado por verificar":"afiliados por verificar",a.affiliates_old?`${a.affiliates_old} ${a.affiliates_old===1?"está":"están"} en tu lista antigua: apruébalos con un clic`:"No están en tus listas: escríbeles si el ID está mal","#admin-afiliados");
  add(a.reviews,"⭐",a.reviews===1?"opinión por aprobar":"opiniones por aprobar","","#admin-opiniones");
  if(a.retos_on&&!a.reto_live&&!a.reto_next)add(true,"🎯","No hay ningún reto en juego ni programado",a.reto_drafts?`Tienes ${a.reto_drafts} en borrador: publica uno`:"Crea el de hoy para no perder la racha de tus alumnos","#admin-retos","warn");
  add(a.expiring,"⏳",a.expiring===1?"plan vence esta semana":"planes vencen esta semana","Buen momento para escribirles y que renueven","#admin-alumnos");
  const nx=a.reto_next?`<span class="attn-ok">🎯 Próximo reto: <b>${esc(fmtDT(a.reto_next))}</b></span>`:a.reto_live?'<span class="attn-ok">🎯 Hay un reto en juego ahora</span>':"";
  host.innerHTML=`<div class="attn-h"><h2>Qué necesita tu atención</h2>${nx}</div>`+(I.length?`<div class="attn-l">${I.join("")}</div>`:`<div class="attn-zero">✅ Todo al día. No hay nada pendiente.</div>`)}
async function resumen(){
  H().innerHTML='<div id="attn" class="attn"></div><div id="rsm"><div class="muted">Cargando estadísticas…</div></div>';attention($("#attn"));const RS=()=>$("#rsm");
  let s;try{s=await API.adminStats()}catch(e){RS().innerHTML=`<div class="empty">No se pudieron cargar las estadísticas: ${esc(e.message)}</div>`;return}
  const k=[[s.users,"Usuarios registrados"],[s.premium,"Premium activos"],[s.new7,"Nuevos (7 días)"],[s.new30,"Nuevos (30 días)"],[s.visitors30,"Visitantes únicos (30 días)"],[s.views30,"Páginas vistas (30 días)"],[s.watch_hours,"Horas de video vistas"],[s.exercises_done,"Ejercicios resueltos"],[s.demo_done,"Gráficas de prueba usadas"],[s.rating!=null?(+s.rating).toFixed(2)+" / 5":"—","Calificación promedio"],[s.reviews,"Opiniones recibidas"],[s.comments,"Comentarios en comunidad"]];
  const daily=s.daily||[];const mx=Math.max(1,...daily.map(d=>d.views));const W=760,Hh=180,bw=W/Math.max(daily.length,1);
  RS().innerHTML=`<div class="kv statk">${k.map(([v,t])=>`<div><b>${esc(v??0)}</b><span>${t}</span></div>`).join("")}</div>
    ${s.reviews_pending?`<div class="note">Tienes ${s.reviews_pending} ${s.reviews_pending===1?"opinión":"opiniones"} esperando aprobación. <a href="#admin-opiniones">Revisar</a></div>`:""}
    <div class="panel"><div class="sec-h"><h3>Visitas por día (últimos 30 días)</h3><span class="muted" style="font-size:13px"><span class="lg v"></span> páginas vistas <span class="lg u"></span> visitantes <span class="lg s"></span> registros</span></div>
      <div class="scroll" style="border:0;background:none"><svg viewBox="0 0 ${W} ${Hh+26}" style="width:100%;min-width:520px;height:auto" role="img" aria-label="Visitas por día">
      ${[0,.5,1].map(f=>`<line x1="0" x2="${W}" y1="${Hh-f*Hh+.5}" y2="${Hh-f*Hh+.5}" stroke="#1f3266"/><text x="2" y="${Hh-f*Hh-3}" fill="#64739a" font-size="10">${Math.round(mx*f)}</text>`).join("")}
      ${daily.map((d,i)=>{const h=d.views/mx*Hh,hu=d.visitors/mx*Hh;return `<rect x="${i*bw+2}" y="${Hh-h}" width="${bw-4}" height="${h}" fill="#2b4282"><title>${d.d}: ${d.views} vistas, ${d.visitors} visitantes, ${d.signups} registros</title></rect><rect x="${i*bw+bw*.3}" y="${Hh-hu}" width="${bw*.4}" height="${hu}" fill="#d8b062"/>${d.signups?`<circle cx="${i*bw+bw/2}" cy="${Hh-h-7}" r="3.5" fill="#35c4a2"/>`:""}${i%5===0?`<text x="${i*bw+bw/2}" y="${Hh+16}" fill="#64739a" font-size="10" text-anchor="middle">${String(d.d).slice(5)}</text>`:""}`}).join("")}</svg></div></div>
    <div class="two"><div class="panel"><h3>Páginas más visitadas (30 días)</h3>${(s.pages||[]).length?`<table class="tbl">${s.pages.map(p=>`<tr><td>${esc(p.path)}</td><td class="n">${p.n}</td></tr>`).join("")}</table>`:'<div class="muted">Sin datos todavía.</div>'}</div>
      <div class="panel"><h3>Lecciones con más horas vistas</h3>${(s.top_lessons||[]).length?`<table class="tbl">${s.top_lessons.map(p=>`<tr><td>${esc(p.title)}</td><td class="n">${p.hours} h</td></tr>`).join("")}</table>`:'<div class="muted">Sin datos todavía.</div>'}</div></div>`;
}

/* ---------- notificaciones ---------- */
const DEST=()=>[["Inicio de El Arte Gráfico",A.absUrl("main","inicio")],["Comunidad",A.absUrl("main","comunidad")],["Panel de la academia",A.absUrl("academia","inicio")],["Temario",A.absUrl("academia","academia")],["Práctica",A.absUrl("academia","practica")],["Premium",A.absUrl("main","premium")]];
async function notif(){
  let st={total:0,premium:0,gratis:0};try{st=await API.adminPushStats()}catch(e){}
  H().innerHTML=`<div class="split"><form class="panel form" id="nf">
      <div class="kv"><div><b>${st.total}</b><span>alumnos con notificaciones</span></div><div><b>${st.premium}</b><span>premium</span></div><div><b>${st.gratis}</b><span>cuenta gratis</span></div></div>
      <label for="nT">Título<input id="nT" maxlength="80" placeholder="Nuevo módulo disponible"></label>
      <label for="nB">Mensaje<textarea id="nB" maxlength="200" style="min-height:80px" placeholder="Ya puedes ver “Gestión del riesgo” en la academia."></textarea></label>
      <div class="two"><label for="nD">Al tocarla abre<select id="nD">${DEST().map(([t,u])=>`<option value="${esc(u)}">${esc(t)}</option>`).join("")}<option value="">Otro enlace…</option></select></label>
        <label for="nA">Enviar a<select id="nA"><option value="todos">Todos</option><option value="premium">Solo premium</option><option value="gratis">Solo cuentas gratis</option></select></label></div>
      <label for="nU" id="nUl" hidden>Enlace<input id="nU" placeholder="https://academia.elartegrafico.com/#modulo-..."></label>
      <div class="row"><button class="btn gold" id="ns">Enviar notificación</button><span class="muted" id="nr"></span></div>
      <p class="dim" style="font-size:13px;margin:0">Solo la reciben quienes activaron las notificaciones (en Mi cuenta o en el aviso del inicio). No abuses: 1 a 3 por semana es lo ideal.</p></form>
    <div class="panel"><h3>Vista previa</h3><div class="npv"><img src="assets/icon-192.png" alt="" width="40" height="40"><div><b id="pvT">Nuevo módulo disponible</b><span id="pvB">Ya puedes ver “Gestión del riesgo” en la academia.</span><small>elartegrafico.com · ahora</small></div></div>
      <h3 style="margin-top:18px">Para que te lleguen a ti</h3><p class="muted" style="font-size:14px">Entra a <b>Configuración → App y notificaciones</b> en tu celular y actívalas. En iPhone primero agrega la app a la pantalla de inicio desde Safari.</p></div></div>`;
  const pv=()=>{$("#pvT").textContent=$("#nT").value||"Nuevo módulo disponible";$("#pvB").textContent=$("#nB").value||"Ya puedes ver “Gestión del riesgo” en la academia."};$("#nT").oninput=pv;$("#nB").oninput=pv;
  $("#nD").onchange=()=>{$("#nUl").hidden=$("#nD").value!==""};
  $("#nf").onsubmit=async e=>{e.preventDefault();const title=$("#nT").value.trim(),body=$("#nB").value.trim(),url=$("#nD").value||$("#nU").value.trim();
    if(!title)return toast("Escribe un título");if(!/^https:\/\//.test(url)&&!/^http:\/\/localhost/.test(url))return toast("El enlace debe empezar por https://");
    try{busy($("#ns"),true);const r=await API.sendPush({title,body,url,audience:$("#nA").value});$("#nr").textContent=`Enviadas: ${r.sent}${r.failed?` · fallidas: ${r.failed}`:""}${r.removed?` · ${r.removed} dispositivos ya no existían y se quitaron`:""}`;toast("Notificación enviada")}catch(x){toast(x.message)}finally{busy($("#ns"),false)}};
}

/* ---------- legal ---------- */
function legal(){
  const s=JSON.parse(JSON.stringify(S.site||{}));const I=s.legalInfo||{};const docs=window.AG_LEGAL||[];const cur=s.legalDocs||{};
  H().innerHTML=`<form class="panel form" id="fl">
    <div class="note">Estos textos son una base redactada para Colombia (Ley 1581 de 2012, Ley 1480 de 2011). Completa tus datos y, antes de empezar a cobrar, hazlos revisar por un abogado.</div>
    <h3>Datos del responsable</h3>
    <div class="two"><label for="lO">Nombre completo o razón social<input id="lO" value="${esc(I.owner||"")}" placeholder="Nombre y apellidos o empresa"></label><label for="lD">Cédula o NIT<input id="lD" value="${esc(I.doc||"")}" placeholder="C.C. 1.234.567.890 o NIT 900.000.000-0"></label></div>
    <div class="two"><label for="lA">Dirección<input id="lA" value="${esc(I.address||"")}"></label><label for="lC">Ciudad<input id="lC" value="${esc(I.city||"")}" placeholder="Bogotá D.C."></label></div>
    <div class="three"><label for="lE">Correo para PQR y datos personales<input id="lE" type="email" value="${esc(I.email||"")}"></label><label for="lP">Teléfono / WhatsApp (opcional)<input id="lP" value="${esc(I.phone||"")}"></label><label for="lF">Fecha de vigencia<input id="lF" value="${esc(I.date||"9 de noviembre de 2026")}"></label></div>
    <h3>Documentos</h3><p class="muted" style="margin:0">Puedes editar cada texto. Usa ### para títulos y guion para listas. Los datos entre llaves ({RESPONSABLE}, {CORREO}…) se llenan solos con lo de arriba.</p>
    ${docs.map(d=>`<details class="panel" style="padding:12px"><summary style="cursor:pointer;font-weight:700">${esc(d.title)} ${cur[d.key]?'<span class="tag">Editado</span>':'<span class="tag pub">Texto base</span>'}</summary>
      <textarea id="lt_${d.key}" style="min-height:360px;margin-top:10px;font-family:var(--f-mono);font-size:13px">${esc(cur[d.key]||d.text)}</textarea>
      <div class="row"><a class="btn sm ghost" href="${A.toMain("legal-"+d.key)}" target="_blank" rel="noopener">Ver publicado</a><button type="button" class="btn sm" data-rst="${d.key}">Restaurar texto base</button></div></details>`).join("")}
    <div class="row"><button class="btn gold" id="lsv">Guardar</button></div></form>`;
  $$("[data-rst]").forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.key===b.dataset.rst);$("#lt_"+d.key).value=d.text;toast("Texto base restaurado: guarda para aplicar")});
  $("#fl").onsubmit=async e=>{e.preventDefault();
    s.legalInfo={owner:$("#lO").value.trim(),doc:$("#lD").value.trim(),address:$("#lA").value.trim(),city:$("#lC").value.trim(),email:$("#lE").value.trim(),phone:$("#lP").value.trim(),date:$("#lF").value.trim()};
    const out={};docs.forEach(d=>{const v=$("#lt_"+d.key).value;if(v.trim()&&v.trim()!==d.text.trim())out[d.key]=v});s.legalDocs=out;
    try{busy($("#lsv"),true);await API.saveSite(s);S.site=s;A.applySite();toast("Textos legales guardados")}catch(x){toast(x.message)}finally{busy($("#lsv"),false)}};
}

/* ---------- sitio ---------- */
function sitio(){
  const s=JSON.parse(JSON.stringify(S.site||{}));const lines=(a,f)=>(a||[]).map(f).join("\n");
  H().innerHTML=`<form class="panel form" id="fs">
    <h3>Marca</h3><div class="two"><label for="sN">Nombre<input id="sN" value="${esc(s.name||"")}"></label><label for="sG">Lema<input id="sG" value="${esc(s.tagline||"")}"></label></div>
    <div class="two"><div class="row">${fileBtn("upLogo","Subir logo (icono)")}<span class="muted" id="lgN" style="font-size:13px">${s.logoUrl?"Logo personalizado":"Logo por defecto"}</span></div><div class="row">${fileBtn("upLogoF","Subir logo grande")}<span class="muted" id="lgF" style="font-size:13px">${s.logoFullUrl?"Logo grande personalizado":"Logo grande por defecto"}</span></div></div>
    <h3>Portada</h3><label for="sH">Título<input id="sH" value="${esc(s.heroTitle||"")}"></label><label for="sT">Texto<textarea id="sT" style="min-height:70px">${esc(s.heroText||"")}</textarea></label>
    <label for="sC">Tarjetas “Qué vas a aprender” (una por línea: Título | texto)<textarea id="sC">${esc(lines(s.cards,c=>c.title+" | "+c.text))}</textarea></label>
    <label for="sS">Pasos “Cómo se aprende” (una por línea: Título | texto) · ya no se muestran en el inicio<textarea id="sS" style="min-height:90px">${esc(lines(s.steps,c=>c.title+" | "+c.text))}</textarea></label>
    <label for="sM">Mercados (una por línea: Categoría | Nombre | Estado | descripción). Estado: Disponible o Próximamente<textarea id="sM">${esc(lines(s.markets,m=>[m.cat,m.name,m.status,m.text||""].join(" | ")))}</textarea></label>
    <h3>Quién te enseña (inicio)</h3>
    <div class="two"><label for="sAbT">Título pequeño<input id="sAbT" value="${esc(s.aboutTitle||"")}" placeholder="Quién te enseña"></label><label for="sAbN">Nombre<input id="sAbN" value="${esc(s.aboutName||"")}" placeholder="El Arte Gráfico"></label></div>
    <div class="row">${fileBtn("upAbout","Subir tu foto")}<span class="muted" id="abF" style="font-size:13px">${s.aboutPhoto?"Foto personalizada":"Sin foto: se muestra el logo"}</span>${s.aboutPhoto?'<button type="button" class="btn sm ghost" id="abX">Quitar foto</button>':""}</div>
    <label for="sAbX">Texto<textarea id="sAbX" style="min-height:90px" placeholder="Soy el creador de El Arte Gráfico…">${esc(s.aboutText||"")}</textarea></label>
    <div class="two"><label for="sAbI">Puntos (uno por línea)<textarea id="sAbI" style="min-height:80px">${esc((s.aboutItems||[]).join("\n"))}</textarea></label>
      <label for="sAbS">Cifras (una por línea: Valor | texto)<textarea id="sAbS" style="min-height:80px" placeholder="120K | seguidores en TikTok&#10;4 años | operando Boom y Crash">${esc((s.aboutStats||[]).map(c=>c.v+" | "+c.t).join("\n"))}</textarea></label></div>
    <div class="two"><label for="sAbK">Enlace de tu TikTok<input id="sAbK" value="${esc(s.aboutTiktok||"")}" placeholder="https://www.tiktok.com/@el_arte_grafico"></label><label for="sAbH">Mostrar la sección<select id="sAbH"><option value="0">Sí</option><option value="1" ${s.aboutHide?"selected":""}>No, ocultarla</option></select></label></div>
    <h3>Preguntas frecuentes (inicio)</h3>
    <label for="sFq">Una por línea: Pregunta | Respuesta. Si lo dejas vacío se muestran las preguntas por defecto.<textarea id="sFq" style="min-height:110px" placeholder="¿Necesito experiencia? | No, empezamos desde cero.">${esc((s.faq||[]).map(x=>x.q+" | "+x.a).join("\n"))}</textarea></label>
    <h3>Aviso de academia cerrada</h3><div class="two"><label for="sAT">Título<input id="sAT" value="${esc(s.closedTitle||"")}" placeholder="La academia abre muy pronto"></label><label for="sAX">Texto<input id="sAX" value="${esc(s.closedText||"")}" placeholder="Estamos terminando de montar el contenido…"></label></div>
    <h3>Prueba gratis</h3>
    <label for="sTD">Días de prueba gratis para cuentas nuevas (0 = sin prueba). Los módulos que ven se marcan en Contenido → Módulo → "Prueba gratis".<input id="sTD" type="number" min="0" max="60" value="${s.trialDays??7}"></label>
    <h3>Google Analytics</h3>
    <label for="sGA">ID de medición (empieza por G-). Se activa solo para quien acepte las cookies de estadística.<input id="sGA" value="${esc(s.gaId||"")}" placeholder="G-XXXXXXXXXX" autocomplete="off"></label>
    <h3>Comunidad y Discord (inicio de elartegrafico.com)</h3>
    <div class="two"><label for="sDU">Enlace de invitación al Discord<input id="sDU" value="${esc(s.discordUrl||"")}" placeholder="https://discord.gg/..."></label><label for="sDT">Título<input id="sDT" value="${esc(s.discordTitle||"")}" placeholder="La comunidad de El Arte Gráfico"></label></div>
    <label for="sDX">Texto<textarea id="sDX" style="min-height:70px">${esc(s.discordText||"")}</textarea></label>
    <label for="sCS">Cifras de la comunidad (una por línea: Valor | texto). Los miembros y conectados de Discord salen solos.<textarea id="sCS" style="min-height:70px" placeholder="25K | seguidores en TikTok">${esc((s.communityStats||[]).map(c=>c.v+" | "+c.t).join("\n"))}</textarea></label>
    <label for="sDI">Puntos destacados (uno por línea)<textarea id="sDI" style="min-height:90px">${esc((s.discordItems||[]).join("\n"))}</textarea></label>
    <h3>Premium</h3><div class="two"><label for="sPT">Título<input id="sPT" value="${esc(s.premiumTitle||"")}"></label><label for="sPX">Texto<input id="sPX" value="${esc(s.premiumText||"")}"></label></div>
    <label for="sPI">Beneficios (uno por línea)<textarea id="sPI" style="min-height:90px">${esc((s.premiumItems||[]).join("\n"))}</textarea></label>
    <h3>Deriv: enlace de socio</h3><p class="muted" style="margin:0">Escribe <b class="mono">{DERIV}</b> en una línea del contenido de una lección y ahí aparece el botón con tu enlace y el aviso de comisión.</p>
    <label for="sRU">Tu enlace de referido de Deriv<input id="sRU" value="${esc(s.derivRefUrl||"")}" placeholder="https://track.deriv.com/..."></label>
    <label for="sPC">Tu código o ID de socio (opcional: va en el mensaje de "retag" que copian los alumnos)<input id="sPC" value="${esc(s.derivPartnerCode||"")}" placeholder="Ej.: CU123456"></label>
    <div class="two"><label for="sRT">Texto del botón<input id="sRT" value="${esc(s.derivRefText||"")}" placeholder="Abrir mi cuenta en Deriv"></label><label for="sRN">Aviso debajo del botón (opcional)<input id="sRN" value="${esc(s.derivRefNote||"")}" placeholder="Enlace de socio: Deriv le paga una comisión a El Arte Gráfico…"></label></div>
    <h3>Pagos con Binance Pay</h3><p class="muted" style="margin:0">El alumno paga a tu Binance Pay ID y registra el ID de orden en la página Premium. Tú lo confirmas en Administración → Pagos.</p>
    <div class="two"><label for="sBP">Tu Binance Pay ID<input id="sBP" value="${esc(s.binancePayId||"")}" placeholder="Ej.: 123456789"></label><label for="sBN">Nombre que ven al pagar (opcional)<input id="sBN" value="${esc(s.binanceName||"")}" placeholder="El Arte Gráfico"></label></div>
    <label for="sPL">Planes (uno por línea: Nombre | días | precio | placa). En días escribe "vitalicio" para un plan de por vida. Placa: cobre, plata, oro o diamond; si la dejas vacía sale de los días.<textarea id="sPL" style="min-height:80px" placeholder="Cobre | 30 | 10 USDT | cobre&#10;Diamond | vitalicio | 100 USDT | diamond">${esc((s.plans||[]).map(x=>[x.name,x.days>=3650?"vitalicio":x.days,x.price].concat(x.tier?[x.tier]:[]).join(" | ")).join("\n"))}</textarea></label>
    <label for="sPN">Indicaciones extra para pagar (opcional)<input id="sPN" value="${esc(s.payNote||"")}" placeholder="Ej.: envía exactamente el monto en USDT"></label>
    <h3>Contacto y pie de página</h3><label for="sCo">Contacto (WhatsApp, correo…)<input id="sCo" value="${esc(s.contact||"")}"></label>
    <label for="sSo">Redes (una por línea: Nombre | enlace)<textarea id="sSo" style="min-height:80px" placeholder="Instagram | https://instagram.com/...">${esc(s.social||"")}</textarea></label>
    <label for="sL">Aviso legal<textarea id="sL" style="min-height:80px">${esc(s.legal||"")}</textarea></label>
    <div class="row"><button class="btn gold" id="sv">Guardar cambios</button></div></form>`;
  groupForm($("#fs"));
  bindUpload("upLogo",u=>{s.logoUrl=u;$("#lgN").textContent="Logo subido: guarda los cambios"});
  bindUpload("upLogoF",u=>{s.logoFullUrl=u;$("#lgF").textContent="Logo subido: guarda los cambios"});
  bindUpload("upAbout",u=>{s.aboutPhoto=u;$("#abF").textContent="Foto subida: guarda los cambios"});
  if($("#abX"))$("#abX").onclick=()=>{s.aboutPhoto="";$("#abF").textContent="Foto quitada: guarda los cambios"};
  const pairs=v=>v.split("\n").map(l=>l.split("|").map(x=>x.trim())).filter(p=>p[0]);
  $("#fs").onsubmit=async e=>{e.preventDefault();
    Object.assign(s,{name:$("#sN").value.trim(),tagline:$("#sG").value.trim(),heroTitle:$("#sH").value.trim(),heroText:$("#sT").value.trim(),
      cards:pairs($("#sC").value).map(p=>({title:p[0],text:p[1]||""})),steps:pairs($("#sS").value).map(p=>({title:p[0],text:p[1]||""})),
      markets:pairs($("#sM").value).map(p=>({cat:p[0],name:p[1]||"",status:p[2]||"Próximamente",text:p[3]||""})),
      premiumTitle:$("#sPT").value.trim(),premiumText:$("#sPX").value.trim(),premiumItems:$("#sPI").value.split("\n").map(x=>x.trim()).filter(Boolean),
      derivPartnerCode:$("#sPC").value.trim(),derivRefUrl:$("#sRU").value.trim(),derivRefText:$("#sRT").value.trim(),derivRefNote:$("#sRN").value.trim(),
      binancePayId:$("#sBP").value.trim(),binanceName:$("#sBN").value.trim(),payNote:$("#sPN").value.trim(),
      plans:pairs($("#sPL").value).map(p=>{const o={name:p[0],days:/vital|vida|ilimit|siempre/i.test(p[1]||"")?36500:Math.max(1,Math.min(36500,parseInt(p[1])||30)),price:p[2]||""},t=String(p[3]||"").trim().toLowerCase().replace("diamante","diamond");if(["cobre","plata","oro","diamond"].includes(t))o.tier=t;if(o.tier==="diamond")o.days=36500;return o}),
      closedTitle:$("#sAT").value.trim(),closedText:$("#sAX").value.trim(),trialDays:Math.max(0,Math.min(60,parseInt($("#sTD").value,10)||0)),gaId:(/^G-[A-Z0-9]{4,20}$/i.test($("#sGA").value.trim())?$("#sGA").value.trim().toUpperCase():""),discordUrl:$("#sDU").value.trim(),discordTitle:$("#sDT").value.trim(),discordText:$("#sDX").value.trim(),discordItems:$("#sDI").value.split("\n").map(x=>x.trim()).filter(Boolean),communityStats:pairs($("#sCS").value).map(p=>({v:p[0],t:p[1]||""})),
      aboutTitle:$("#sAbT").value.trim(),aboutName:$("#sAbN").value.trim(),aboutText:$("#sAbX").value.trim(),aboutItems:$("#sAbI").value.split("\n").map(x=>x.trim()).filter(Boolean),
      aboutStats:pairs($("#sAbS").value).map(p=>({v:p[0],t:p[1]||""})),aboutTiktok:$("#sAbK").value.trim(),aboutHide:$("#sAbH").value==="1",
      faq:$("#sFq").value.split("\n").map(l=>{const i=l.indexOf("|");return i<0?null:{q:l.slice(0,i).trim(),a:l.slice(i+1).trim()}}).filter(x=>x&&x.q&&x.a),
      contact:$("#sCo").value.trim(),social:$("#sSo").value.trim(),legal:$("#sL").value.trim()});
    try{busy($("#sv"),true);await API.saveSite(s);S.site=s;A.applySite();toast("Cambios guardados")}catch(x){toast(x.message)}finally{busy($("#sv"),false)}};
}

/* ---------- banners ---------- */
async function banners(){
  let list=[];try{list=await API.allSlides()}catch(e){}
  H().innerHTML=`<div class="split"><div class="panel"><div class="sec-h"><h3>Banners</h3><button class="btn sm gold" id="nb">Nuevo banner</button></div>
    ${["home","login"].map(pl=>`<h4 class="cat">${pl==="home"?"Portada":"Página de ingreso y registro"}</h4><div class="list">${list.filter(x=>x.place===pl).map(b=>`<button class="item" data-b="${esc(b.id)}" style="text-align:left;cursor:pointer"><span class="ico">${b.sort}</span><span class="txt"><b>${esc(b.title||"Sin título")}</b><span>${b.active?"Activo":"Oculto"}${b.image_url?" · con imagen":""}</span></span></button>`).join("")||'<div class="muted">Sin banners.</div>'}</div>`).join("")}</div><div class="panel" id="be"><div class="muted">Elige un banner o crea uno nuevo.</div></div></div>`;
  const edit=b=>{$("#be").innerHTML=`<form class="form" id="bf"><h3>${b.id?"Editar banner":"Nuevo banner"}</h3>
    <div class="three"><label for="bP">Ubicación<select id="bP"><option value="home">Portada</option><option value="login">Ingreso / registro</option></select></label><label for="bO">Orden<input id="bO" type="number" value="${b.sort||1}"></label><label for="bA">Estado<select id="bA"><option value="1">Activo</option><option value="0">Oculto</option></select></label></div>
    <label for="bT">Título<input id="bT" value="${esc(b.title||"")}"></label><label for="bB">Texto<textarea id="bB" style="min-height:80px">${esc(b.body||"")}</textarea></label>
    <div class="two"><label for="bC">Texto del botón (opcional)<input id="bC" value="${esc(b.cta_text||"")}"></label><label for="bL">Enlace del botón<input id="bL" placeholder="#registro o https://…" value="${esc(b.cta_link||"")}"></label></div>
    <div class="row">${fileBtn("bI","Imagen de fondo")}<input id="bU" placeholder="o pega la URL de una imagen" value="${esc(b.image_url||"")}" style="flex:1;min-width:200px"></div>
    <div id="bprev"></div>
    <div class="row"><button class="btn gold" id="bs">Guardar</button>${b.id?'<span id="bd"><button type="button" class="btn sm bad" id="bdb">Eliminar</button></span>':""}</div></form>`;
    $("#bP").value=b.place||"home";$("#bA").value=b.active===false?"0":"1";
    bindUpload("bI",u=>{$("#bU").value=u;prev()});const prev=()=>{const u=$("#bU").value.trim();$("#bprev").innerHTML=u?`<div class="cover" style="aspect-ratio:21/7;background-image:url('${esc(u)}')"></div>`:""};prev();$("#bU").oninput=prev;
    $("#bf").onsubmit=async e=>{e.preventDefault();const o={place:$("#bP").value,sort:+$("#bO").value||1,active:$("#bA").value==="1",title:$("#bT").value.trim(),body:$("#bB").value.trim(),cta_text:$("#bC").value.trim(),cta_link:$("#bL").value.trim(),image_url:$("#bU").value.trim()};if(b.id)o.id=b.id;
      try{busy($("#bs"),true);await API.saveSlide(o);toast("Banner guardado");banners()}catch(x){toast(x.message)}finally{busy($("#bs"),false)}};
    const d=$("#bdb");if(d)d.onclick=()=>A.confirmInline($("#bd"),"¿Eliminar este banner?",async()=>{await API.delSlide(b.id);toast("Banner eliminado");banners()})};
  $("#nb").onclick=()=>edit({place:"home",sort:list.length+1,active:true});
  $$("[data-b]").forEach(x=>x.onclick=()=>edit(list.find(b=>b.id===x.dataset.b)));
}

/* ---------- módulos y lecciones ---------- */
let sel={};
/* módulos agrupados por curso, en el orden de los alumnos (curso por su orden, módulo por su orden) */
function courseGroups(mods){const cs=(S.courses||[]).slice().sort((a,b)=>(a.sort||0)-(b.sort||0)),by=m=>(a,b)=>(a.sort||0)-(b.sort||0);
  const g=cs.map(c=>[c,mods.filter(m=>m.course_id===c.id).sort(by())]);const rest=mods.filter(m=>!m.course_id||!cs.some(c=>c.id===m.course_id)).sort(by());
  if(rest.length)g.push([null,rest]);return g}
function lessonOptions(mods,les){const used=new Set();const out=courseGroups(mods).map(([c,ms])=>ms.map((m,i)=>{const ls=les.filter(l=>l.module_id===m.id).sort((a,b)=>(a.sort||0)-(b.sort||0));ls.forEach(l=>used.add(l.id));
  return ls.length?`<optgroup label="${esc((c?c.title:"Sin curso")+" › "+(i+1)+". "+m.title)}">${ls.map((l,k)=>`<option value="${esc(l.id)}">${i+1}.${k+1} ${esc(l.title)}</option>`).join("")}</optgroup>`:""}).join("")).join("");
  const rest=les.filter(l=>!used.has(l.id));return out+(rest.length?`<optgroup label="Otras">${rest.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join("")}</optgroup>`:"")}
function modOptions(mods){return courseGroups(mods).map(([c,ms])=>ms.length?`<optgroup label="${esc(c?(c.icon||"")+" "+c.title:"Sin curso")}">${ms.map((m,i)=>`<option value="${esc(m.id)}">${i+1}. ${esc(m.title)}</option>`).join("")}</optgroup>`:"").join("")}
async function contenido(){
  let mods=[],les=[];try{mods=await API.modules();les=await API.lessons()}catch(e){}
  const CS=courseGroups(mods);
  const lesOf=mid=>les.filter(l=>l.module_id===mid).sort((a,b)=>(a.sort||0)-(b.sort||0));
  const selMod=sel.t==="m"?sel.id:sel.t==="l"?((les.find(l=>l.id===sel.id)||{}).module_id):null;
  const selCourse=selMod?((mods.find(m=>m.id===selMod)||{}).course_id||""):null;
  H().innerHTML=`<div class="split"><div class="panel"><div class="sec-h"><h3>Temario</h3></div>
    <p class="dim" style="font-size:13px;margin:0 0 10px">Organizado por curso y en el orden en que lo ven los alumnos. Toca un curso para abrirlo o cerrarlo.</p>
    <div class="tree">${CS.map(([c,ms],ci)=>`<details class="crs-g"${selCourse===null?(ci===0?" open":""):(selCourse===(c?c.id:"")?" open":"")}><summary><span class="crs-ic" style="background:${esc(c&&c.color||"#64739a")}">${esc(c?c.icon||"🎓":"📦")}</span><span class="crs-t"><b>${c?esc(c.title):"Sin curso"}</b><span class="dim">${c?(c.base?"Gratis con cuenta":esc(c.price||"")):"Solo suscriptores"} · ${ms.length} ${ms.length===1?"módulo":"módulos"} · ${(n=>n+(n===1?" lección":" lecciones"))(ms.reduce((a,m)=>a+lesOf(m.id).length,0))}${c&&c.status==="borrador"?" · borrador":""}</span></span></summary>
      ${ms.map((m,mi)=>`<div class="m"><button data-s="m:${esc(m.id)}" class="${sel.id===m.id?"on":""}"><b><span class="mono dim">${mi+1}.</span> ${esc(m.title)}</b><span class="tags"><span class="tag ${m.status==="publicado"?"pub":""}">${m.status==="publicado"?"Publicado":"Borrador"}</span>${m.status==="publicado"?`<span class="tag ${A.modOpen(m,true)?"pub":"lock"}">${A.modState(m)}</span>`:""}${m.free?'<span class="tag free-t">Prueba</span>':""}</span></button>
        <div class="dim" style="padding:0 12px 6px;font-size:12px">${esc(m.category||"")}</div>
        ${lesOf(m.id).map((l,li)=>`<button class="l ${sel.id===l.id?"on":""}" data-s="l:${esc(l.id)}"><span><span class="mono dim">${mi+1}.${li+1}</span> ${esc(l.title)}</span><span class="tag ${l.status==="publicado"?"pub":""}">${l.status==="publicado"?"Pub.":"Borr."}</span></button>`).join("")}
        <button class="l" data-nl="${esc(m.id)}" style="color:var(--gold)">+ Nueva lección</button></div>`).join("")||'<div class="muted" style="padding:8px 12px">Este curso aún no tiene módulos.</div>'}
      <button class="btn sm ghost crs-new" data-nm="${c?esc(c.id):""}">+ Nuevo módulo${c?` en ${esc(c.title)}`:""}</button></details>`).join("")||'<div class="muted">Aún no hay módulos.</div>'}</div></div><div class="panel" id="ed"><div class="muted">Elige un módulo o una lección para editarla.</div></div></div>`;
  const cats=[...new Set(mods.map(m=>m.category).concat(["Fundamentos","Método El Arte Gráfico","Gestión y psicología","Sintéticos","Forex","Metales","Evaluación"]))].filter(Boolean);
  const reload=async()=>{await A.loadContent();contenido()};
  $$("[data-nm]").forEach(b=>b.onclick=async()=>{const cid=b.dataset.nm||null;const same=mods.filter(x=>(x.course_id||null)===cid);try{const m=await API.saveModule({title:"Nuevo módulo",descr:"",level:"",category:cid&&(S.courses||[]).some(c=>c.id===cid&&c.base)?"Fundamentos":"Módulos",sort:(same.length?Math.max(...same.map(x=>x.sort||0)):(mods.length?Math.max(...mods.map(x=>x.sort||0)):0))+1,status:"borrador",locked:true,available:false,...(cid?{course_id:cid}:{})});sel={t:"m",id:m.id};reload()}catch(x){toast(x.message)}});
  $$("[data-nl]").forEach(b=>b.onclick=async()=>{const mid=b.dataset.nl;const ls=les.filter(l=>l.module_id===mid);try{const l=await API.saveLesson({module_id:mid,title:"Nueva lección",sort:(ls.length?Math.max(...ls.map(x=>x.sort||0)):0)+1,status:"borrador",video_url:"",body:"",min_score:80});sel={t:"l",id:l.id};reload()}catch(x){toast(x.message)}});
  $$("[data-s]").forEach(b=>b.onclick=()=>{const [t,id]=b.dataset.s.split(":");sel={t,id};contenido()});
  const ed=$("#ed");
  if(sel.t==="m"){const m=mods.find(x=>x.id===sel.id);if(!m)return;
    ed.innerHTML=`<form class="form" id="fm"><div class="sec-h"><h3>Módulo</h3><a class="btn sm ghost" href="#modulo-${esc(m.id)}">Ver como alumno</a></div>
      <label for="mT">Título<input id="mT" value="${esc(m.title)}"></label><label for="mD">Descripción<textarea id="mD" style="min-height:80px">${esc(m.descr||"")}</textarea></label>
      <div class="three"><label for="mC">Categoría<input id="mC" list="cats" value="${esc(m.category||"")}"><datalist id="cats">${cats.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></label><label for="mL">Nivel (opcional)<input id="mL" value="${esc(m.level||"")}" placeholder="Básico, Intermedio…"></label><label for="mO">Orden<input id="mO" type="number" value="${m.sort||1}"></label></div>
      <div class="two"><label for="mS">Estado<select id="mS"><option value="borrador">Borrador (no lo ven los alumnos)</option><option value="publicado">Publicado</option></select></label><label for="mK">Orden obligatorio<select id="mK"><option value="1">Exige terminar el módulo anterior</option><option value="0">Libre</option></select></label></div>
      <div class="two"><label for="mP">¿Se puede saltar?<select id="mP"><option value="0">No: hay que aprobarlo para seguir</option><option value="1">Opcional: no bloquea los módulos siguientes</option></select></label>
        <label for="mPN">Mensaje para el alumno (si es opcional)<input id="mPN" value="${esc(m.optional_note||"")}" placeholder="Si ya tienes cuenta en Deriv y MT5, puedes saltarlo."></label></div>
      ${(S.courses||[]).length?`<label for="mCu">Curso al que pertenece<select id="mCu"><option value="">Sin curso (solo suscriptores)</option>${S.courses.map(c=>`<option value="${esc(c.id)}">${esc(c.icon||"")} ${esc(c.title)}</option>`).join("")}</select></label>`:""}
      <label for="mFr">Prueba gratis<select id="mFr"><option value="0">Solo premium</option><option value="1">Incluido en la prueba gratis (las cuentas nuevas lo ven sus primeros días)</option></select></label>
      <label for="mF">Reseña al terminar<select id="mF"><option value="1">Obligatoria: al terminar el módulo deja su reseña para seguir</option><option value="0">No pedir reseña en este módulo</option></select></label>
      <div class="two"><label for="mA">Disponibilidad para alumnos<select id="mA"><option value="1">Disponible (desbloqueado)</option><option value="0">Bloqueado: se ve en el temario como “Próximamente”</option></select></label>
        <label for="mW">Desbloquear automáticamente el (opcional)<input id="mW" type="datetime-local" value="${m.open_at?new Date(new Date(m.open_at).getTime()-5*3600e3).toISOString().slice(0,16):""}"><span class="dim" style="font-weight:400">Hora Colombia. Si eliges fecha, el módulo se abre solo ese día aunque esté bloqueado.</span></label></div>
      <div class="row"><button class="btn gold" id="ms">Guardar módulo</button><span id="md"><button type="button" class="btn sm bad" id="mdb">Eliminar módulo</button></span></div></form>`;
    $("#mS").value=m.status;$("#mK").value=m.locked?"1":"0";$("#mP").value=m.optional?"1":"0";$("#mF").value=m.ask_feedback===false?"0":"1";$("#mA").value=m.available===false?"0":"1";$("#mFr").value=m.free?"1":"0";if($("#mCu"))$("#mCu").value=m.course_id||"";
    $("#fm").onsubmit=async e=>{e.preventDefault();try{busy($("#ms"),true);await API.saveModule({id:m.id,title:$("#mT").value.trim()||"Sin título",descr:$("#mD").value.trim(),category:$("#mC").value.trim()||"Fundamentos",level:$("#mL").value.trim(),sort:+$("#mO").value||1,status:$("#mS").value,locked:$("#mK").value==="1",...(("optional" in m)||$("#mP").value==="1"?{optional:$("#mP").value==="1",optional_note:$("#mPN").value.trim()}:{}),available:$("#mA").value==="1",...(("free" in m)||$("#mFr").value==="1"?{free:$("#mFr").value==="1"}:{}),...($("#mCu")?{course_id:$("#mCu").value||null}:{}),...(("ask_feedback" in m)||$("#mF").value==="0"?{ask_feedback:$("#mF").value==="1"}:{}),open_at:$("#mW").value?new Date($("#mW").value+":00-05:00").toISOString():null});toast("Módulo guardado");reload()}catch(x){toast(x.message)}finally{busy($("#ms"),false)}};
    $("#mdb").onclick=()=>A.confirmInline($("#md"),"¿Eliminar el módulo con todas sus lecciones y ejercicios?",async()=>{await API.delModule(m.id);sel={};toast("Módulo eliminado");reload()})}
  if(sel.t==="l"){const l=les.find(x=>x.id===sel.id);if(!l)return;
    ed.innerHTML=`<form class="form" id="fl"><div class="sec-h"><h3>Lección</h3><a class="btn sm ghost" href="#leccion-${esc(l.id)}">Ver como alumno</a></div>
      <label for="lT">Título<input id="lT" value="${esc(l.title)}"></label>
      <div class="three"><label for="lM">Módulo<select id="lM">${modOptions(mods)}</select></label><label for="lO">Orden<input id="lO" type="number" value="${l.sort||1}"></label><label for="lS">Estado<select id="lS"><option value="borrador">Borrador</option><option value="publicado">Publicado</option></select></label></div>
      <label for="lV">Video: enlace de Bunny Stream (recomendado), YouTube, Vimeo o MP4<input id="lV" value="${esc(l.video_url||"")}" placeholder="https://iframe.mediadelivery.net/embed/123456/abcd-…"><span class="dim" style="font-weight:400">En Bunny: Stream → tu librería → el video → botón “Embed” o “Copy video URL”. Pega aquí cualquiera de los dos.</span></label>
      <div class="row">${fileBtn("lVF","Subir video MP4")}<span class="dim" style="font-size:13px">Para videos largos usa YouTube oculto o Vimeo: cargan más rápido.</span></div>
      <label for="lB">Contenido (### subtítulo, - lista, **negrita**)<textarea id="lB" style="min-height:240px">${esc(l.body||"")}</textarea></label>
      <label for="lP">Porcentaje para aprobar<input id="lP" type="number" min="0" max="100" value="${l.min_score||80}" style="max-width:140px"></label>
      <div class="row"><button class="btn gold" id="ls">Guardar lección</button><a class="btn" href="#admin-ejercicios" id="lx">Ejercicios de esta lección</a><span id="ld"><button type="button" class="btn sm bad" id="ldb">Eliminar lección</button></span></div></form>`;
    $("#lM").value=l.module_id;$("#lS").value=l.status;
    const vi=$("#lVF");vi.accept="video/mp4,video/webm";bindUpload("lVF",u=>{$("#lV").value=u;toast("Video subido: guarda la lección")});
    $("#lx").onclick=()=>{exFilter=l.id};
    $("#fl").onsubmit=async e=>{e.preventDefault();try{busy($("#ls"),true);await API.saveLesson({id:l.id,module_id:$("#lM").value,title:$("#lT").value.trim()||"Sin título",sort:+$("#lO").value||1,status:$("#lS").value,video_url:$("#lV").value.trim(),body:$("#lB").value,min_score:Math.max(0,Math.min(100,+$("#lP").value||80))});toast("Lección guardada");reload()}catch(x){toast(x.message)}finally{busy($("#ls"),false)}};
    $("#ldb").onclick=()=>A.confirmInline($("#ld"),"¿Eliminar la lección y sus ejercicios?",async()=>{await API.delLesson(l.id);sel={};toast("Lección eliminada");reload()})}
}

/* ---------- ejercicios ---------- */
let exFilter="",exSel=null,exMods=[];
async function ejercicios(){
  let list=[],les=[],mods=[];try{list=await API.allExercises();les=await API.lessons();mods=await API.modules()}catch(e){}exMods=mods;
  const lname=id=>id==null?"Práctica libre":(les.find(l=>l.id===id)||{}).title||"—";
  const where=e=>e.is_demo?"demo":e.lesson_id||"practica";
  const flt=e=>!exFilter||(exFilter==="demo"?e.is_demo:exFilter==="practica"?(!e.lesson_id&&!e.is_demo):e.lesson_id===exFilter);
  H().innerHTML=`<div class="split"><div class="panel"><div class="sec-h"><h3>Ejercicios</h3><button class="btn sm gold" id="nx">Nuevo</button></div>
    <label class="form" for="xf"><select id="xf"><option value="">Todos</option><option value="demo">Prueba gratis (portada)</option><option value="practica">Práctica libre</option>${lessonOptions(mods,les)}</select></label>
    <div class="list">${list.filter(flt).map(e=>`<button class="item" data-x="${esc(e.id)}" style="text-align:left;cursor:pointer"><span class="ico">${e.sort}</span><span class="txt"><b>${esc({grafica:"Gráfica",calculo:"Cálculo",opcion:"Pregunta","no-operar":"No operar"}[e.kind])} · ${e.kind==="grafica"||e.kind==="no-operar"?esc(MNAME[e.market]||e.market):esc(String(e.prompt||((e.data||{}).template)||"").slice(0,40))}</b><span>${e.is_demo?"Prueba gratis":esc(lname(e.lesson_id))}</span></span></button>`).join("")||'<div class="muted">Sin ejercicios.</div>'}</div></div>
    <div class="panel" id="xe"><div class="muted">Elige un ejercicio o crea uno nuevo.</div></div></div>`;
  $("#xf").value=exFilter;$("#xf").onchange=()=>{exFilter=$("#xf").value;ejercicios()};
  $("#nx").onclick=()=>editEx({kind:"grafica",market:"B1000",side:"buy",tf_zone:"H1",tf_sl:"M5",reveal_hours:24,tol_pct:0.35,target_r:2,sort:1,data:{},is_demo:exFilter==="demo",lesson_id:exFilter&&exFilter!=="demo"&&exFilter!=="practica"?exFilter:null},{},les);
  $$("[data-x]").forEach(b=>b.onclick=async()=>{const e=list.find(x=>x.id===b.dataset.x);let a={};try{a=await API.exerciseAnswer(e.id)||{}}catch(x){}editEx(JSON.parse(JSON.stringify(e)),a,les)});
}
async function editEx(e,a,les){
  const box=$("#xe");const chartK=()=>e.kind==="grafica"||e.kind==="no-operar";
  const dest=e.is_demo?"demo":e.lesson_id||"practica";
  box.innerHTML=`<form class="form" id="xfm"><div class="sec-h"><h3>${e.id?"Editar ejercicio":"Nuevo ejercicio"}</h3><button type="button" class="btn sm" id="xpv">Probar como alumno</button></div>
    <div class="three"><label for="xK">Tipo<select id="xK"><option value="grafica">Gráfica: zona y SL</option><option value="no-operar">Gráfica: aquí no se opera</option><option value="calculo">Cálculo con fórmula</option><option value="opcion">Opción múltiple</option></select></label>
      <label for="xD">Dónde aparece<select id="xD"><option value="demo">Prueba gratis (portada)</option><option value="practica">Práctica libre</option>${lessonOptions(exMods,les)}</select></label>
      <label for="xO">Orden<input id="xO" type="number" value="${e.sort||1}"></label></div>
    <label class="chk"><input type="checkbox" id="xFT" ${e.free_try?"checked":""}> Usar en <b>“Pruébalo sin registrarte”</b> del inicio (cualquiera lo puede hacer sin cuenta; usa solo uno)</label>
    <label for="xP">Enunciado / pregunta (opcional en gráficas)<input id="xP" value="${esc(e.prompt||"")}"></label>
    <div id="xbody"></div>
    <label for="xE">Explicación que verá el alumno al responder<textarea id="xE" style="min-height:100px">${esc(a.explain||"")}</textarea></label>
    <div class="row"><button class="btn gold" id="xs">Guardar ejercicio</button>${e.id?'<span id="xd"><button type="button" class="btn sm bad" id="xdb">Eliminar</button></span>':""}</div></form><div id="xprev" style="margin-top:16px"></div>`;
  $("#xK").value=e.kind;$("#xD").value=dest;
  let C=null,ln=[],state={tf:"H1",mode:"zone"};
  const body=async()=>{const b=$("#xbody");if(C){C.destroy();C=null}
    if(chartK()){b.innerHTML=`<div class="three"><label for="xM">Mercado<select id="xM">${MARKETS.map(m=>`<option value="${m}">${MNAME[m]}</option>`).join("")}</select></label><label for="xS">Dirección<select id="xS"><option value="buy">Compra</option><option value="sell">Venta</option></select></label><label for="xT">Última vela visible (hora Colombia)<input id="xT" type="datetime-local"></label></div>
      <div class="row"><button type="button" class="btn sm" data-mv="-24">−1 día</button><button type="button" class="btn sm" data-mv="-1">−1 h</button><button type="button" class="btn sm" data-mv="1">+1 h</button><button type="button" class="btn sm" data-mv="24">+1 día</button></div>
      <div class="three"><label for="xTZ">Zona: temporalidad sugerida<select id="xTZ"><option>H1</option><option>M5</option></select></label><label for="xTS">Stop loss: temporalidad sugerida<select id="xTS"><option>M5</option><option>H1</option><option value="none">Sin stop loss</option></select></label><label for="xRH">Horas de repetición<input id="xRH" type="number" min="2" max="96" value="${e.reveal_hours||24}"></label></div>
      <div class="three"><label for="xZ">Zona correcta<input id="xZ" type="number" step="any" value="${a.zone??""}"></label><label for="xSL">Stop loss correcto<input id="xSL" type="number" step="any" value="${a.sl??""}"></label><label for="xR">Objetivo (R)<input id="xR" type="number" step="0.5" min="0.5" value="${e.target_r||2}"></label></div>
      <label for="xTol">Tolerancia (veces el rango medio de las últimas 20 velas)<input id="xTol" type="number" step="0.05" min="0.05" value="${e.tol_pct||0.35}" style="max-width:160px"></label>
      <div class="row" style="justify-content:space-between"><div class="tfseg"><button type="button" data-tf="H1">H1</button><button type="button" data-tf="M5">M5</button></div><div class="modes"><button type="button" data-cm="zone">Clic marca: zona</button><button type="button" data-cm="sl">Clic marca: stop loss</button></div></div>
      <div class="chartbox"><div class="cv" style="position:absolute;inset:0"></div></div><div class="mono muted" id="xinfo" style="font-size:13px"></div>`;
      $("#xM").value=e.market;$("#xS").value=e.side;$("#xTZ").value=e.tf_zone||"H1";$("#xTS").value=e.tf_sl||"M5";
      const Hd=await h1Bars(e.market);if(!e.t_end)e.t_end=Hd.bars[Hd.bars.length-48].t;
      const setT=()=>{$("#xT").value=new Date((e.t_end+TZ)*1000).toISOString().slice(0,16)};setT();
      C=Chart.makeChart($(".cv",b));A.cleanupPush(()=>C&&C.destroy());
      const lines=()=>{C.clearLines();if(a.zone!=null&&a.zone!=="")C.addLine({price:+a.zone,color:"#f3d88f",lineWidth:2,title:"Zona"});if(a.sl!=null&&a.sl!=="")C.addLine({price:+a.sl,color:"#ec5b52",lineWidth:1,lineStyle:"dotted",title:"SL"})};
      const draw=async()=>{const HH=await h1Bars(e.market);let i=idxAt(HH.bars,e.t_end);if(i<0)i=0;e.t_end=HH.bars[i].t;setT();let bars,dec=HH.dec;
        if(state.tf==="H1")bars=HH.bars.slice(Math.max(0,i-160),i+1);else{const M=await m5Bars(e.market,e.t_end-2*86400,e.t_end+3599);bars=M.bars}
        C.setData(toC(bars),dec);C.setRange(bars.length-C.span(),bars.length+6);lines();
        $$("[data-tf]",b).forEach(x=>x.classList.toggle("on",x.dataset.tf===state.tf));$$("[data-cm]",b).forEach(x=>x.classList.toggle("on",x.dataset.cm===state.mode));
        $("#xinfo").textContent=`${MNAME[e.market]} · última vela ${fmtT(e.t_end)} · ${state.tf} · rango medio ${avgRange(bars,bars.length-1).toFixed(dec)} · tolerancia ≈ ${((+$("#xTol").value||.35)*avgRange(bars,bars.length-1)).toFixed(dec)}`};
      C.onClick(p=>{const v=+p.toFixed(4);if(state.mode==="zone"){a.zone=v;$("#xZ").value=v}else{a.sl=v;$("#xSL").value=v}lines()});
      $$("[data-tf]",b).forEach(x=>x.onclick=()=>{state.tf=x.dataset.tf;draw()});$$("[data-cm]",b).forEach(x=>x.onclick=()=>{state.mode=x.dataset.cm;draw()});
      $$("[data-mv]",b).forEach(x=>x.onclick=()=>{e.t_end+=3600*(+x.dataset.mv);draw()});
      $("#xT").onchange=()=>{const v=$("#xT").value;if(v){e.t_end=Math.floor(Date.parse(v+":00Z")/1000)-TZ;draw()}};
      $("#xM").onchange=()=>{e.market=$("#xM").value;e.side=e.market.startsWith("C")?"sell":"buy";$("#xS").value=e.side;a.zone=null;a.sl=null;$("#xZ").value="";$("#xSL").value="";draw()};
      $("#xZ").oninput=()=>{a.zone=$("#xZ").value;lines()};$("#xSL").oninput=()=>{a.sl=$("#xSL").value;lines()};
      draw();}
    else if(e.kind==="calculo"){const d=e.data||{};const an=a.answer||{};
      b.innerHTML=`<label for="cT">Enunciado con variables entre llaves<textarea id="cT" style="min-height:90px" placeholder="Tienes {saldo} USD y arriesgas {riesgo}%…">${esc(d.template||"")}</textarea></label>
        <label for="cV">Variables (una por línea: nombre=mínimo..máximo:paso). Cada alumno recibe valores distintos.<textarea id="cV" style="min-height:80px" placeholder="saldo=200..2000:100">${esc(String(d.vars||"").replace(/;\s*/g,"\n"))}</textarea></label>
        <label for="cF">Fórmula de la respuesta (usa + − * / ^, paréntesis y round, min, max, abs, sqrt)<input id="cF" class="mono" value="${esc(an.formula||"")}" placeholder="saldo*riesgo/100/valor"></label>
        <div class="three"><label for="cU">Unidad<input id="cU" value="${esc(d.unit||"")}" placeholder="lotes"></label><label for="cD">Decimales<input id="cD" type="number" min="0" max="6" value="${d.decimals??2}"></label><label for="cTo">Tolerancia (%)<input id="cTo" type="number" step="0.5" min="0" value="${an.tol_pct??2}"></label></div>
        <div class="note" id="cTest">Prueba: escribe la fórmula para ver un ejemplo.</div>`;
      const test=()=>{try{const v=window.AGFormula.genVars($("#cV").value);const r=window.AGFormula.evalExpr($("#cF").value||"0",v);$("#cTest").textContent="Ejemplo con "+Object.entries(v).map(([k,x])=>k+"="+x).join(", ")+" → "+(+r).toFixed(+$("#cD").value||2)}catch(x){$("#cTest").textContent="Revisa la fórmula: "+x.message}};
      ["cV","cF","cD"].forEach(i=>$("#"+i).oninput=test);test()}
    else if(e.kind==="opcion"){const d=e.data||{};b.innerHTML=`<label for="oO">Opciones (una por línea)<textarea id="oO" style="min-height:120px">${esc((d.options||[]).join("\n"))}</textarea></label><label for="oC">Número de la opción correcta (1, 2, 3…)<input id="oC" type="number" min="1" value="${((a.answer||{}).correct??0)+1}" style="max-width:140px"></label>`}};
  const collect=()=>{const k=$("#xK").value;const d=$("#xD").value;const o=Object.assign({},e,{kind:k,sort:+$("#xO").value||1,prompt:$("#xP").value.trim(),is_demo:d==="demo",lesson_id:d==="demo"||d==="practica"?null:d});if($("#xFT").checked||e.free_try!=null)o.free_try=$("#xFT").checked;
    const ans={zone:null,sl:null,answer:{},explain:$("#xE").value};
    if(k==="grafica"||k==="no-operar"){Object.assign(o,{market:$("#xM").value,side:$("#xS").value,tf_zone:$("#xTZ").value,tf_sl:$("#xTS").value,reveal_hours:+$("#xRH").value||24,target_r:+$("#xR").value||2,tol_pct:+$("#xTol").value||.35,t_end:e.t_end,data:{}});
      ans.zone=$("#xZ").value!==""?+$("#xZ").value:null;ans.sl=$("#xSL").value!==""?+$("#xSL").value:null;
      if(k==="grafica"&&ans.zone==null)throw new Error("Marca la zona correcta en la gráfica");if(k==="grafica"&&o.tf_sl!=="none"&&ans.sl==null)throw new Error("Marca el stop loss correcto");
      if(k==="grafica"&&ans.sl!=null&&((o.side==="buy"&&ans.sl>=ans.zone)||(o.side==="sell"&&ans.sl<=ans.zone)))throw new Error("El stop loss está del lado equivocado de la zona")}
    else if(k==="calculo"){o.data={template:$("#cT").value,vars:$("#cV").value.split("\n").map(x=>x.trim()).filter(Boolean).join("; "),unit:$("#cU").value.trim(),decimals:+$("#cD").value||0};ans.answer={formula:$("#cF").value.trim(),tol_pct:+$("#cTo").value||0};
      window.AGFormula.evalExpr(ans.answer.formula||"x",window.AGFormula.genVars(o.data.vars))}
    else{const ops=$("#oO").value.split("\n").map(x=>x.trim()).filter(Boolean);if(ops.length<2)throw new Error("Escribe al menos 2 opciones");const c=(+$("#oC").value||1)-1;if(c<0||c>=ops.length)throw new Error("La opción correcta no existe");o.data={options:ops};ans.answer={correct:c};if(!o.prompt)throw new Error("Escribe la pregunta")}
    return{o,ans}};
  $("#xK").onchange=()=>{e.kind=$("#xK").value;body()};
  $("#xpv").onclick=async()=>{try{const {o,ans}=collect();o.id=o.id||"preview";const pv=$("#xprev");pv.innerHTML="";const h=await window.Player.mount(pv,o,{preview:ans});if(h)A.cleanupPush(h.destroy);pv.scrollIntoView({behavior:"smooth"})}catch(x){toast(x.message)}};
  $("#xfm").onsubmit=async ev=>{ev.preventDefault();try{const {o,ans}=collect();busy($("#xs"),true);const x=await API.saveExercise(o,ans);toast("Ejercicio guardado");e=Object.assign(e,x);ejercicios()}catch(x){toast(x.message)}finally{busy($("#xs"),false)}};
  const db=$("#xdb");if(db)db.onclick=()=>A.confirmInline($("#xd"),"¿Eliminar este ejercicio?",async()=>{await API.delExercise(e.id);toast("Ejercicio eliminado");ejercicios()});
  body();
}

/* ---------- noticias ---------- */
async function noticias(){
  let list=[];try{list=await API.posts()}catch(e){}
  H().innerHTML=`<div class="split"><div class="panel"><div class="sec-h"><h3>Publicaciones</h3><button class="btn sm gold" id="np">Nueva publicación</button></div><div class="list">${list.map(p=>`<button class="item" data-p="${esc(p.id)}" style="text-align:left;cursor:pointer"><span class="txt"><b>${esc(p.title)}</b><span>${esc(p.category)} · ${fmtDate(p.created_at)}${p.pinned?" · fijada":""}${p.premium_only?" · premium":""}</span></span></button>`).join("")||'<div class="muted">Sin publicaciones.</div>'}</div></div><div class="panel" id="pe"><div class="muted">Elige una publicación o crea una nueva.</div></div></div>`;
  const edit=p=>{$("#pe").innerHTML=`<form class="form" id="pf"><h3>${p.id?"Editar publicación":"Nueva publicación"}</h3>
    <label for="pT">Título<input id="pT" value="${esc(p.title||"")}"></label><div class="two"><label for="pC">Categoría<input id="pC" list="pcats" value="${esc(p.category||"Noticia")}"><datalist id="pcats"><option value="Noticia"><option value="Anuncio"><option value="Actualización"><option value="Análisis"><option value="Comunidad"><option value="En vivo"><option value="Operativa"></datalist></label>
    <div class="row">${fileBtn("pI","Imagen de portada")}<input id="pU" value="${esc(p.image_url||"")}" placeholder="o URL de imagen" style="flex:1;min-width:180px"></div></div>
    <label for="pV">Video (opcional)<span class="dim" style="font-weight:400"> · súbelo aquí (hasta 50 MB) o pega un enlace de Bunny (sirve el de "playlist.m3u8" o el de "embed"), YouTube o un .mp4</span></label>
    <div class="row"><label class="btn sm" for="pVf" style="cursor:pointer">Subir video</label><input id="pVf" type="file" hidden accept="video/mp4,video/webm,video/quicktime"><input id="pV" value="${esc(p.video_url||"")}" placeholder="https://iframe.mediadelivery.net/embed/… o https://youtu.be/…" style="flex:1;min-width:200px"></div>
    <div id="pVp"></div>
    <label for="pB">Contenido<textarea id="pB" style="min-height:220px">${esc(p.body||"")}</textarea></label>
    <div class="three"><label style="display:flex;gap:8px;align-items:center;color:var(--fg)"><input type="checkbox" id="pPin" style="width:auto" ${p.pinned?"checked":""}> Fijar arriba</label><label for="pAu">Quién la ve<select id="pAu"><option value="">Todos</option><option value="sus">Suscriptores (Cobre, Plata y Oro)</option><option value="plata">Solo Plata y Oro</option><option value="oro">👑 Solo Oro (Sala Oro)</option></select></label><label style="display:flex;gap:8px;align-items:center;color:var(--fg)"><input type="checkbox" id="pCo" style="width:auto" ${p.allow_comments!==false?"checked":""}> Permitir comentarios</label></div>
    <label style="display:flex;gap:8px;align-items:center;color:var(--fg)"><input type="checkbox" id="pNt" style="width:auto" ${p.id?"":"checked"}> Avisar a los alumnos con una notificación${p.id?" (es una edición: márcalo solo si el cambio es importante)":""}</label>
    <div class="row"><button class="btn gold" id="ps">Publicar</button>${p.id?`<a class="btn ghost" href="#nota-${esc(p.id)}">Ver</a><span id="pd"><button type="button" class="btn sm bad" id="pdb">Eliminar</button></span>`:""}</div></form>`;
    bindUpload("pI",u=>$("#pU").value=u);$("#pAu").value=p.min_plan==="oro"?"oro":p.min_plan==="plata"?"plata":p.premium_only?"sus":"";
    const vprev=()=>{const u=$("#pV").value.trim();$("#pVp").innerHTML=u?A.mediaVideo(u,$("#pU").value.trim()):"";A.hlsInit($("#pVp"))};$("#pV").oninput=vprev;vprev();
    $("#pVf").onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>50*1024*1024){toast("El video pesa más de 50 MB. Súbelo a Bunny o YouTube y pega el enlace.");return}
      toast("Subiendo video… no cierres esta página");try{const u=await API.upload(f);$("#pV").value=u;vprev();toast("Video subido")}catch(x){toast(x.message)}};
    $("#pf").onsubmit=async e=>{e.preventDefault();const o={title:$("#pT").value.trim()||"Sin título",category:$("#pC").value.trim()||"Noticia",image_url:$("#pU").value.trim(),body:$("#pB").value,pinned:$("#pPin").checked,premium_only:$("#pAu").value!=="",allow_comments:$("#pCo").checked};if(p.id)o.id=p.id;{const v=$("#pV").value.trim();if(v||p.video_url)o.video_url=v}{const au=$("#pAu").value;if(au==="plata"||au==="oro"||p.min_plan)o.min_plan=(au==="plata"||au==="oro")?au:""}
      try{busy($("#ps"),true);const saved=await API.savePost(o);toast("Publicación guardada");
        if($("#pNt").checked){const pid=(saved&&saved.id)||o.id;const plain=String(o.body||"").replace(/[#*_>`\[\]()!-]+/g," ").replace(/\s+/g," ").trim();
          try{const r=await API.sendPush({title:(p.id?"Actualización: ":(o.category==="Anuncio"?"📢 ":"Nueva publicación: "))+o.title.slice(0,64),body:plain.slice(0,140)||"Toca para leerla en la comunidad.",url:A.absUrl("main",pid?"nota-"+pid:"comunidad"),audience:o.min_plan==="oro"||o.min_plan==="diamond"?"oro":o.premium_only||o.min_plan?"premium":"todos",tag:"post-"+(pid||"")});
            toast(r.sent?`Publicado y notificado a ${r.sent} dispositivo${r.sent===1?"":"s"}`:"Publicado. Aún nadie tiene las notificaciones activadas.")}catch(x){toast("Publicado, pero la notificación falló: "+x.message)}}
        noticias()}catch(x){toast(x.message)}finally{busy($("#ps"),false)}};
    const d=$("#pdb");if(d)d.onclick=()=>A.confirmInline($("#pd"),"¿Eliminar la publicación y sus comentarios?",async()=>{await API.delPost(p.id);toast("Publicación eliminada");noticias()})};
  $("#np").onclick=()=>edit({});$$("[data-p]").forEach(b=>b.onclick=()=>edit(list.find(p=>p.id===b.dataset.p)));
}

/* ---------- EAG Charts: prueba y opiniones ---------- */
async function chartsop(){
  let list=[];try{list=await API.adminChartFeedback()||[]}catch(e){H().innerHTML=`<div class="panel"><p class="muted">Corre <b>charts_prueba.sql</b> en Supabase para activar la prueba de EAG Charts.</p></div>`;return}
  const fb=list.filter(r=>r.feedback_at),avg=fb.length?(fb.reduce((a,r)=>a+(+r.rating||0),0)/fb.length):0,now=Date.now(),act=list.filter(r=>new Date(r.started_at).getTime()+3*864e5>now).length;
  let f="todas";
  const draw=()=>{const L=list.filter(r=>f==="todas"||(f==="con"?r.feedback_at:!r.feedback_at));
    $("#cfL").innerHTML=L.length?L.map(r=>`<div class="item" style="align-items:flex-start"><span class="txt"><b>${esc(r.username||"alumno")}${r.country?" · "+esc(r.country):""}${r.premium?' <span class="tag pub">Con plan</span>':""}${r.feedback_at?` · <span class="stars">${"★".repeat(+r.rating||0)}${"☆".repeat(5-(+r.rating||0))}</span>`:""}</b>
      <span>${r.feedback_at?esc(r.feedback||"(sin comentario)"):'<span class="dim">Aún no deja recomendaciones</span>'}</span>
      <span class="dim">Empezó ${fmtDT(r.started_at)}${r.feedback_at?" · opinó "+fmtDT(r.feedback_at):""}</span></span></div>`).join(""):`<p class="muted">Nada por aquí todavía.</p>`};
  const pt=!!(S.site||{}).chartProTrial;
  H().innerHTML=`<div class="acad-switch ${pt?"on":"off"}" style="margin-bottom:14px"><div><b>Estudio (Replay y Práctica) en la prueba: ${pt?"incluido":"solo Premium"}</b><span class="muted">${pt?"Los que están en la prueba de 3 días también pueden usar Replay y Práctica. Úsalo como gancho para que se animen a Premium.":"Replay y Práctica solo los usan los que tienen plan. Los de la prueba ven el botón con el sello PRO y una invitación a Premium."}</span></div>
    <button class="btn ${pt?"bad":"gold"}" id="ptSw">${pt?"Quitar de la prueba":"Incluir en la prueba de 3 días"}</button></div>
    <div class="panel"><h3>EAG Charts</h3><p class="muted">Todos los registrados tienen 3 días gratis desde la primera vez que abren EAG Charts. Al terminar se les pide que califiquen y dejen recomendaciones.</p>
    <div class="row" style="flex-wrap:wrap;gap:10px;margin:10px 0"><span class="tag">${list.length} lo han probado</span><span class="tag">${act} en prueba ahora</span><span class="tag">${fb.length} opiniones</span><span class="tag">Promedio ${avg?avg.toFixed(1)+" ★":"—"}</span>
    <a class="btn sm gold" href="https://charts.elartegrafico.com" target="_blank" rel="noopener">Abrir EAG Charts ↗</a></div>
    <div class="row" style="gap:6px;margin-bottom:10px">${[["todas","Todos"],["con","Con opinión"],["sin","Sin opinión"]].map(([k,t])=>`<button class="btn sm${k===f?" gold":""}" data-cf="${k}">${t}</button>`).join("")}</div>
    <div class="list" id="cfL"></div></div>`;
  $$("[data-cf]").forEach(b=>b.onclick=()=>{f=b.dataset.cf;$$("[data-cf]").forEach(x=>x.classList.toggle("gold",x===b));draw()});draw();
  $("#ptSw").onclick=async()=>{const ns=Object.assign({},S.site,{chartProTrial:!pt});try{await API.saveSite(ns);S.site=ns;toast(pt?"Estudio ahora es solo Premium":"Estudio incluido en la prueba de 3 días")}catch(x){toast(x.message)}A.ROUTES.admin("chartsop")};
}
/* ---------- opiniones ---------- */
async function opiniones(){
  let list=[];try{list=await API.adminReviews()}catch(e){}
  H().innerHTML=`<div class="panel"><h3>Opiniones (${list.length})</h3><p class="muted">Las opiniones nuevas o editadas quedan en revisión hasta que las apruebes. Solo se publican las aprobadas.</p>
    <div class="list">${list.map(r=>`<div class="item" style="align-items:flex-start"><span class="txt"><b>${esc(r.username)} · <span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</span></b><span>${esc(r.body||"(sin comentario)")}</span><span class="dim">${fmtDT(r.created_at)}</span></span>
      <div class="row">${r.approved?'<span class="tag pub">Publicada</span><button class="btn sm" data-h="'+esc(r.id)+'">Ocultar</button>':'<button class="btn sm ok" data-ap="'+esc(r.id)+'">Aprobar</button>'}<span data-dw="${esc(r.id)}"><button class="btn sm bad" data-dl="${esc(r.id)}">Borrar</button></span></div></div>`).join("")||'<div class="muted">Sin opiniones todavía.</div>'}</div></div>`;
  $$("[data-ap]").forEach(b=>b.onclick=async()=>{await API.setReview(b.dataset.ap,{approved:true});toast("Opinión publicada");opiniones()});
  $$("[data-h]").forEach(b=>b.onclick=async()=>{await API.setReview(b.dataset.h,{approved:false});opiniones()});
  $$("[data-dl]").forEach(b=>b.onclick=()=>A.confirmInline($(`[data-dw="${b.dataset.dl}"]`),"¿Borrar?",async()=>{await API.delReview(b.dataset.dl);opiniones()}));
}

/* ---------- pagos ---------- */
function paySwitch(){const off=!!(S.site||{}).paymentsOff;
  return `<div class="acad-switch ${off?"off":"on"}" style="margin-bottom:14px"><div><b>Pagos ${off?"pausados":"activos"}</b><span class="muted">${off?"Nadie puede registrar pagos. En la web los planes dicen “Disponible pronto” y la página Premium avisa que los pagos están pausados.":"Los alumnos pueden pagar con Binance Pay y registrar su pago para que lo apruebes."}</span></div>
    <button class="btn ${off?"gold":"bad"}" id="pySw">${off?"Activar los pagos":"Pausar los pagos"}</button></div>`}
function bindPaySwitch(){const b=$("#pySw");if(!b)return;const off=!!(S.site||{}).paymentsOff;
  b.onclick=()=>A.confirmInline(b.parentElement,off?"¿Activar los pagos? Los alumnos podrán pagar y registrar su pago.":"¿Pausar los pagos? Nadie podrá registrar pagos hasta que los actives.",async()=>{
    const ns=Object.assign({},S.site,{paymentsOff:!off});try{await API.saveSite(ns);S.site=ns;toast(off?"Pagos activados":"Pagos pausados")}catch(x){toast(x.message)}A.ROUTES.admin("pagos")})}
async function pagos(){
  H().innerHTML='<div class="muted">Cargando pagos…</div>';let list=[];try{list=await API.adminPayments()}catch(e){H().innerHTML=paySwitch()+`<div class="empty">No se pudieron cargar los pagos. ¿Ya corriste supabase/pagos.sql en Supabase? (${esc(e.message)})</div>`;bindPaySwitch();return}
  const pend=list.filter(x=>x.status==="pendiente"),rest=list.filter(x=>x.status!=="pendiente");
  const isP=u=>u.premium_until&&new Date(u.premium_until)>new Date();
  const fila=r=>`<div class="item pay" style="align-items:flex-start;flex-wrap:wrap"><span class="txt" style="min-width:240px;flex:1">
      <b>${esc(r.username||"alumno")} · ${esc(r.plan||"Plan")} · ${esc(r.amount||"")}</b>
      <span>${esc(r.email||"")} · ${fmtDT(r.created_at)}${isP(r)?` · premium hasta ${fmtDate(r.premium_until)}`:""}</span>
      <span>ID de orden: <b class="mono sel">${esc(r.order_id)}</b> <button type="button" class="btn sm ghost" data-cp="${esc(r.order_id)}">Copiar</button></span>
      ${r.note?`<span>Nota: ${esc(r.note)}</span>`:""}${r.admin_note?`<span class="dim">Tu nota: ${esc(r.admin_note)}</span>`:""}</span>
    ${r.status==="pendiente"?`<span class="row" data-w="${esc(r.id)}"><label class="dim" style="display:flex;gap:6px;align-items:center">Días <input type="number" min="1" max="36500" value="${r.days}" data-d="${esc(r.id)}" style="width:80px;background:var(--bg2);border:1px solid var(--line2);border-radius:8px;padding:6px;color:var(--fg)"></label>
      <button class="btn sm ok" data-ok="${esc(r.id)}">Aprobar</button><button class="btn sm bad" data-no="${esc(r.id)}">Rechazar</button></span>`
      :`<span class="tag ${r.status==="aprobado"?"pub":""}">${r.status==="aprobado"?`Aprobado · ${r.days} días`:"Rechazado"}</span>`}</div>`;
  H().innerHTML=paySwitch()+`<div style="display:grid;gap:16px"><div class="panel"><div class="sec-h"><h3>Pagos por confirmar (${pend.length})</h3><span class="muted">Revisa en tu Binance (Pay → Historial) que el ID de orden y el monto coincidan antes de aprobar.</span></div>
    <div class="list">${pend.map(fila).join("")||'<div class="muted">No hay pagos pendientes.</div>'}</div></div>
    <div class="panel"><h3>Historial</h3><div class="list">${rest.map(fila).join("")||'<div class="muted">Sin pagos revisados todavía.</div>'}</div></div></div>`;
  bindPaySwitch();
  $$("[data-cp]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.cp);toast("ID copiado")}catch(e){toast("No se pudo copiar")}});
  $$("[data-ok]").forEach(b=>b.onclick=()=>{const id=b.dataset.ok;const r=list.find(x=>x.id===id);const d=Math.max(1,parseInt($(`[data-d="${id}"]`).value)||r.days);
    A.confirmInline($(`[data-w="${id}"]`),`¿Confirmaste el pago en tu Binance? Se le suman ${d} días a ${r.username}.`,async()=>{try{const x=await API.reviewPayment(id,true,d,"");toast(`Premium activado${x&&x.premium_until?" hasta "+fmtDate(x.premium_until):""}`)}catch(e){toast(e.message)}pagos()})});
  $$("[data-no]").forEach(b=>b.onclick=()=>{const id=b.dataset.no;A.confirmInline($(`[data-w="${id}"]`),"¿Rechazar este pago? (no encontraste el pago o el monto no coincide)",async()=>{try{await API.reviewPayment(id,false,null,"No encontramos el pago con ese ID de orden");toast("Pago rechazado")}catch(e){toast(e.message)}pagos()})});
}

/* ---------- RETOS Y PUNTOS ---------- */
const toLoc=d=>d?new Date(new Date(d).getTime()-5*3600e3).toISOString().slice(0,16):"";       // hora de Colombia
const fromLoc=v=>v?new Date(v+":00-05:00").toISOString():null;
const RWc=()=>Object.assign({revealHours:3,enabled:true,teaser:false,ptsPerUsd:100,minRedeem:500,redeemOpen:false,halfIfNotAffiliate:true},(S.site||{}).rewards||{});
const KNAME={opcion:"Cuestionario",tendencia:"¿Sube o baja?",zona:"Marca la zona"};
async function retos(){
  let list=[];try{list=await API.adminChallenges()}catch(e){H().innerHTML=`<div class="empty">No se pudieron cargar los retos. ¿Ya corriste <b>supabase/retos.sql</b> en Supabase?<span class="dim">${esc(e.message)}</span></div>`;return}
  const c=RWc(),t=Date.now();const RH=()=>Math.max(.25,+RWc().revealHours||3),closeOf=x=>x.weekly||x.express?new Date(x.ends_at):new Date(new Date(x.starts_at).getTime()+RH()*36e5);
  const est=x=>x.status!=="publicado"?'<span class="tag">Borrador</span>':new Date(x.starts_at)>t?'<span class="tag">Programado</span>':closeOf(x)<=t?'<span class="tag">Cerrado</span>':'<span class="tag pub">En juego</span>';
  H().innerHTML=`${c.enabled?"":`<div class="note admin-note">Los retos están <b>apagados</b> para los alumnos. Puedes crearlos y probarlos; actívalos en <a href="#admin-rpuntos">Ajustes de puntos</a>.</div>`}
    <div class="split"><div class="panel"><div class="sec-h"><h3>Retos</h3><button class="btn sm gold" id="nr">Nuevo reto</button></div>
      ${(()=>{const row=x=>`<button class="item" data-r="${esc(x.id)}" style="text-align:left;cursor:pointer"><span class="txt"><b>${esc(x.title)}</b><span>${x.express?`⚡ Express ${Number(x.prize_usd||0).toLocaleString("es-CO",{style:"currency",currency:"USD"})} · `:x.weekly?"⭐ Semanal · ":""}${KNAME[x.kind]} · ${fmtDT(x.starts_at)}</span></span>${est(x)}</button>`;
        const pub=list.filter(x=>x.status==="publicado"),live=pub.filter(x=>new Date(x.starts_at)<=t&&closeOf(x)>t),next=pub.filter(x=>new Date(x.starts_at)>t).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)),
          drafts=list.filter(x=>x.status!=="publicado").sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)),done=pub.filter(x=>closeOf(x)<=t).sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));
        const grp=(t2,L,n,id)=>L.length?`<h4 class="rt-gh">${t2} <span class="dim">(${L.length})</span></h4><div class="list" data-nopage>${L.slice(0,n).map(row).join("")}</div>${L.length>n?`<details class="rt-more" id="${id}"><summary class="btn sm ghost">Ver ${L.length-n} más</summary><div class="list" data-nopage>${L.slice(n).map(row).join("")}</div></details>`:""}`:"";
        return list.length?grp("🟢 En juego",live,10,"rmL")+grp("⏭️ Próximos",next,5,"rmN")+grp("📝 Borradores",drafts,5,"rmD")+grp("✔️ Cerrados",done,3,"rmC"):'<div class="muted">Aún no hay retos. Crea el primero.</div>'})()}</div>
      <div class="panel" id="re"><div class="muted">Elige un reto o crea uno nuevo.</div></div></div>`;
  $("#nr").onclick=()=>edit({kind:"opcion",points:100,max_winners:5,status:"borrador",starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+864e5).toISOString(),options:[]},{});
  $$("[data-r]").forEach(b=>b.onclick=async()=>{const x=list.find(y=>y.id===b.dataset.r);let k={};try{k=await API.challengeKey(x.id)||{}}catch(e){}edit(x,k)});
  async function edit(x,k){
    $("#re").innerHTML=`<form class="form" id="rf"><h3>${x.id?"Editar reto":"Nuevo reto"}</h3>
      <label for="rT">Título<input id="rT" maxlength="120" value="${esc(x.title||"")}" placeholder="Ej.: ¿Qué hace Boom 1000 después de esta zona?"></label>
      <div class="two"><label for="rK">Tipo de reto<select id="rK"><option value="opcion">Cuestionario (opciones)</option><option value="tendencia">¿Sube o baja? (gráfica)</option><option value="zona">Marca la zona (gráfica)</option></select></label>
        <label for="rS">Estado<select id="rS"><option value="borrador">Borrador (no se ve)</option><option value="publicado">Publicado</option></select></label></div>
      <label for="rQ">Pregunta o instrucción<textarea id="rQ" maxlength="600" style="min-height:70px" placeholder="Ej.: Mira la gráfica de H1. ¿El precio sube o baja en las próximas horas?">${esc(x.question||"")}</textarea></label>
      <div id="rBody"></div>
      <label for="rX">Explicación (se muestra cuando el reto cierra)<textarea id="rX" maxlength="600" style="min-height:60px" placeholder="Por qué esa era la respuesta correcta">${esc(k.explain||"")}</textarea></label>
      <div class="three"><label for="rP">Puntos (afiliados)<input id="rP" type="number" min="1" value="${x.points||100}"></label><label for="rW">Ganadores (cupos)<input id="rW" type="number" min="1" max="100" value="${x.max_winners||5}"></label><label>Sin afiliado<b class="mono" id="rHalf" style="font-size:20px"></b></label></div>
      <div class="two"><label for="rA">Se publica (hora Colombia)<input id="rA" type="datetime-local" value="${toLoc(x.starts_at)}"></label><label for="rZ" id="rZw">Cierra (solo retos semanales)<input id="rZ" type="datetime-local" value="${toLoc(x.ends_at)}"></label><div id="rZi" class="rt-autoclose"></div></div>
      <label class="chk"><input type="checkbox" id="rWk" ${x.weekly?"checked":""}> <b>Reto semanal</b>: sale destacado arriba con corona (sugerido: 300 puntos y 10 ganadores)</label>
      <label class="chk"><input type="checkbox" id="rEx" ${x.express?"checked":""}> <b>⚡ Reto express</b>: el premio es en <b>dólares</b> (no puntos) y el ganador lo puede retirar al instante</label>
      <div class="two" id="rExF" ${x.express?"":"hidden"}><label for="rUsd">Premio por ganador (USD, afiliados)<input id="rUsd" type="number" step="0.01" min="0.1" max="1000" value="${x.prize_usd||1}"></label>
        <label for="rMin">Dura (minutos)<input id="rMin" type="number" min="5" max="1440" step="5" value="${x.express?Math.max(5,Math.round((new Date(x.ends_at)-new Date(x.starts_at))/6e4)):30}"></label>
        <p class="dim" style="font-size:13px;margin:0;grid-column:1/-1" id="rExT"></p></div>
      <label class="chk"><input type="checkbox" id="rN" ${x.notify!==false&&!x.notified_at?"checked":""}> Enviar notificación a todos <b>cuando se publique</b> (a la hora programada)${x.notified_at?` <span class="dim">· ya se avisó el ${fmtDT(x.notified_at)}</span>`:""}</label>
      <div class="row"><button class="btn gold" id="rSv">Guardar reto</button>${x.id?`<span id="rDel"><button type="button" class="btn sm bad" id="rDb">Eliminar</button></span>`:""}</div></form>
      ${x.id?`<div class="sec-h" style="margin-top:18px"><h3>Respuestas</h3></div><div id="rEn" class="muted">Cargando…</div>`:""}`;
    $("#rK").value=x.kind||"opcion";
    const zi=()=>{const wk=$("#rWk").checked;$("#rZw").hidden=wk?false:true;const st=fromLoc($("#rA").value);$("#rZi").hidden=wk;
      $("#rZi").innerHTML=`<span class="dim">Cierra solo</span><b>${RH()} h después</b><span class="dim">${st?"a las "+fmtDT(new Date(new Date(st).getTime()+RH()*36e5).toISOString()):""} · ahí se revelan los ganadores</span>`};
    $("#rA").addEventListener("input",zi);zi();
    const exT=()=>{const on=$("#rEx").checked;$("#rExF").hidden=!on;$("#rP").closest(".three").hidden=on;if(on&&$("#rWk").checked){$("#rWk").checked=false}
      const u=+$("#rUsd").value||0,w=+$("#rW").value||5,m=+$("#rMin").value||30,h=RWc().halfIfNotAffiliate!==false;
      $("#rExT").textContent=on?`Hasta ${w} ganadores × ${u.toLocaleString("es-CO",{style:"currency",currency:"USD"})}${h?" (sin afiliado: la mitad)":""}: máximo ${(u*w).toLocaleString("es-CO",{style:"currency",currency:"USD"})} si todos son afiliados. Cierra ${m} min después de publicarse y ahí se revelan los ganadores.`:"";
      $("#rZi").hidden=on||$("#rWk").checked;if(!on)zi()};
    ["#rEx","#rUsd","#rMin","#rW"].forEach(k=>$(k).addEventListener("input",exT));$("#rEx").onchange=exT;setTimeout(exT,0);
    $("#rWk").onchange=()=>{if($("#rWk").checked&&$("#rEx").checked){$("#rEx").checked=false;exT()}zi();if($("#rWk").checked){if((+$("#rP").value||0)<=100)$("#rP").value=300;if((+$("#rW").value||0)<=5)$("#rW").value=10;$("#rP").oninput&&$("#rP").oninput()}};$("#rS").value=x.status||"borrador";
    const half=()=>$("#rHalf").textContent=(RWc().halfIfNotAffiliate?Math.ceil((+$("#rP").value||0)/2):(+$("#rP").value||0))+" pts";$("#rP").oninput=half;half();
    let OFF=x.bars?(+x.off||0):null,cur=null;let zone=k.zone!=null?+(k.zone+(x.bars?(+x.off||0):0)).toFixed(x.decimals||3):null,img=x.image_url||"";
    const SHf=t=>{const st=fromLoc($("#rA").value)||new Date().toISOString();return Math.floor(new Date(st).getTime()/36e5)*3600-3600-t};
    const body=async()=>{const kind=$("#rK").value;const ops=(x.options&&x.options.length?x.options:(kind==="tendencia"?["Sube","Baja"]:[]));
      const chartPart=kind!=="opcion"?`<div class="three"><label for="rM">Mercado<select id="rM">${MARKETS.map(m=>`<option value="${m}">${MNAME[m]}</option>`).join("")}</select></label>
          <label for="rC">Última vela que ven (hora Colombia)<input id="rC" type="datetime-local" value="${x.chart_t?toLoc(x.chart_t*1000):""}"></label><label for="rD">Operación<select id="rD"><option value="buy">Compra</option><option value="sell">Venta</option></select></label></div>
        <div class="chartbox" style="height:340px"><div class="cv" style="position:absolute;inset:0"></div><div class="chint">${kind==="zona"?"Toca la gráfica para poner la zona correcta":"Vista previa: así la verán (lo de la derecha de la flecha es lo que pasó después)"}</div></div>
        <p class="dim" style="font-size:13px;margin:6px 0 0">🔒 Anti-trampas: los precios y las fechas de esta gráfica ya están desplazados, así que nadie puede buscar este momento en el historial de Deriv. Si pones precios en la pregunta, usa los que ves aquí.</p>`:"";
      $("#rBody").innerHTML=chartPart+(kind==="zona"?`<div class="two"><label for="rZo">Zona correcta (precio)<input id="rZo" type="number" step="any" value="${zone??""}"></label><label for="rTo">Margen permitido (±)<input id="rTo" type="number" step="any" value="${k.tol??""}" placeholder="se sugiere solo"></label></div>`
        :`<label for="rO">Opciones (una por línea)<textarea id="rO" style="min-height:${kind==="tendencia"?60:110}px">${esc(ops.join("\n"))}</textarea></label><label for="rCo">Respuesta correcta<select id="rCo"></select></label>`)
        +(kind==="opcion"?`<div class="row">${fileBtn("rI","Imagen (opcional)")}<input id="rIu" value="${esc(img)}" placeholder="o URL de imagen" style="flex:1;min-width:180px"></div>`:"");
      const fillCo=()=>{const o=$("#rO").value.split("\n").map(s=>s.trim()).filter(Boolean);$("#rCo").innerHTML=o.map((t,i)=>`<option value="${i}">${String.fromCharCode(65+i)} · ${esc(t)}</option>`).join("");if(k.correct!=null&&k.correct<o.length)$("#rCo").value=String(k.correct)};
      if($("#rO")){$("#rO").oninput=fillCo;fillCo()}
      if($("#rI"))bindUpload("rI",u=>{img=u;$("#rIu").value=u});
      if(kind!=="opcion"){$("#rM").value=x.market||"B1000";$("#rD").value=x.side||"buy";
        const draw=async()=>{const box=$("#rBody .cv");if(!box)return;box.innerHTML="";try{const Hh=await h1Bars($("#rM").value);const tt=$("#rC").value?Math.floor(new Date($("#rC").value+":00-05:00")/1000):Hh.bars[Hh.bars.length-30].t;
          const e=idxAt(Hh.bars,tt);
          if(OFF==null){const p0=Hh.bars[e].c;OFF=+((Math.random()<.5?-1:1)*p0*(.05+Math.random()*.1)).toFixed(0)||7}
          const SH=SHf(Hh.bars[e].t),fx=v=>+(v+OFF).toFixed(Hh.dec);cur={Hh,e,SH};
          const bars=Hh.bars.slice(Math.max(0,e-90),Math.min(Hh.bars.length,e+25)).map(b=>({t:b.t+SH,o:fx(b.o),h:fx(b.h),l:fx(b.l),c:fx(b.c)}));const C=Chart.makeChart(box);C.setData(toC(bars),Hh.dec);C.setRange(bars.length-100,bars.length+4);
          C.setMarkers([{time:Hh.bars[e].t+SH+TZ,position:"aboveBar",color:"#f3d88f",shape:"arrowDown",text:"lo que ven"}]);
          if(!$("#rC").value)$("#rC").value=toLoc(Hh.bars[e].t*1000);
          if(kind==="zona"){const sug=+(0.35*avgRange(Hh.bars,e)).toFixed(Hh.dec);const ln=()=>{C.clearLines();if(zone!=null)C.addLine({price:zone,color:"#f3d88f",lineWidth:2,title:"Zona correcta",draggable:true})};ln();
            if(!$("#rTo").value)$("#rTo").placeholder=`sugerido: ${sug}`;C.onClick(p=>{zone=+p.toFixed(Hh.dec);$("#rZo").value=zone;if(!$("#rTo").value)$("#rTo").value=sug;ln()});C.onLineDrag((l,p)=>{zone=+p;$("#rZo").value=p})}}catch(err){box.innerHTML='<div class="empty">No hay velas para ese mercado o fecha.</div>'}};
        $("#rM").onchange=()=>{OFF=null;draw()};$("#rC").onchange=draw;$("#rA").onchange=draw;draw()}};
    $("#rK").onchange=body;await body();
    if(x.id)API.adminChallengeEntries(x.id).then(L=>{const h=$("#rEn");if(!h)return;h.innerHTML=L.length?`<div class="tree">${L.map(e=>`<div class="item"><span class="txt"><b>${esc(e.username)} ${A.flag(e.country||"")}${e.affiliate?" "+A.affTag():""}</b><span>${fmtDT(e.created_at)} · ${e.answer&&e.answer.price!=null?"zona "+e.answer.price:"opción "+String.fromCharCode(65+(+((e.answer||{}).option)||0))}</span></span>${e.same_ip?`<span class="pill warn" title="Respondió desde la misma conexión que otras cuentas">⚠ misma conexión ×${e.same_ip}</span>`:""}${e.place?`<span class="pill ok">#${e.place} · +${e.points}</span>`:e.correct?'<span class="pill">Acertó sin cupo</span>':'<span class="pill">Falló</span>'}</div>`).join("")}</div>`:'<div class="muted">Nadie ha respondido todavía.</div>'}).catch(e=>{const h=$("#rEn");if(h)h.textContent=e.message});
    if($("#rDb"))$("#rDb").onclick=()=>A.confirmInline($("#rDel"),"¿Eliminar el reto y sus respuestas? Los puntos ganados se pierden.",async()=>{await API.delChallenge(x.id);toast("Reto eliminado");retos()});
    $("#rf").onsubmit=async e=>{e.preventDefault();const kind=$("#rK").value;
      const o={title:$("#rT").value.trim()||"Reto del día",kind,question:$("#rQ").value.trim(),status:$("#rS").value,points:Math.max(1,+$("#rP").value||100),max_winners:Math.max(1,Math.min(100,+$("#rW").value||5)),
        starts_at:fromLoc($("#rA").value)||new Date().toISOString(),ends_at:fromLoc($("#rZ").value)||new Date(Date.now()+864e5).toISOString(),options:[],market:"",chart_t:null,side:"buy",image_url:""};if($("#rWk").checked||x.weekly)o.weekly=$("#rWk").checked;
      if(!$("#rWk").checked)o.ends_at=new Date(new Date(o.starts_at).getTime()+RH()*36e5).toISOString();
      if($("#rEx").checked){o.express=true;o.weekly=false;o.prize_usd=Math.max(.1,+(+$("#rUsd").value||1).toFixed(2));o.ends_at=new Date(new Date(o.starts_at).getTime()+Math.max(5,+$("#rMin").value||30)*6e4).toISOString()}
      else if(x.express){o.express=false;o.prize_usd=0}
      o.notify=$("#rN").checked;const nowPush=o.notify&&o.status==="publicado"&&!x.notified_at&&new Date(o.starts_at)<=new Date();if(nowPush)o.notified_at=new Date().toISOString();
      if(x.id)o.id=x.id;const key={correct:null,zone:null,tol:null,explain:$("#rX").value.trim()};
      if(new Date(o.ends_at)<=new Date(o.starts_at)){toast("La hora de cierre debe ser después de la de publicación");return}
      if(kind!=="zona"){o.options=$("#rO").value.split("\n").map(s=>s.trim()).filter(Boolean);if(o.options.length<2){toast("Pon al menos 2 opciones");return}key.correct=+$("#rCo").value}
      if(kind==="opcion")o.image_url=($("#rIu").value||"").trim();
      if(kind!=="opcion"){o.market=$("#rM").value;o.side=$("#rD").value;o.chart_t=$("#rC").value?Math.floor(new Date($("#rC").value+":00-05:00")/1000):null;if(!o.chart_t){toast("Elige la última vela que verán");return}}
      if(kind!=="opcion"){if(!cur){toast("Espera a que cargue la gráfica");return}const {Hh,e}=cur,SH=SHf(Hh.bars[e].t),fx=v=>+(v+OFF).toFixed(Hh.dec),row=b=>[b.t+SH,fx(b.o),fx(b.h),fx(b.l),fx(b.c)];
        o.bars=Hh.bars.slice(Math.max(0,e-89),e+1).map(row);o.after_bars=Hh.bars.slice(e+1,e+37).map(row);o.decimals=Hh.dec;o.off=OFF;
        if(o.after_bars.length<24){toast("Elige una vela más antigua: después de ella debe haber al menos un día de velas para saber la respuesta");return}}
      else{o.bars=null;o.after_bars=null;o.off=0}
      if(kind==="zona"){key.zone=$("#rZo").value===""?null:+(+$("#rZo").value-(OFF||0)).toFixed(cur?cur.Hh.dec:3);key.tol=$("#rTo").value===""?null:+$("#rTo").value;if(key.zone==null||!key.tol){toast("Marca la zona correcta y el margen");return}}
      try{busy($("#rSv"),true);const saved=await API.saveChallenge(o,key);toast("Reto guardado");
        if(nowPush&&API.sendPush){try{await API.sendPush({title:(o.express?"⚡ Reto express: ":"🎯 Nuevo reto: ")+o.title.slice(0,60),body:o.express?`Tienes ${Math.round((new Date(o.ends_at)-new Date(o.starts_at))/6e4)} minutos. Los primeros ${o.max_winners} en acertar ganan ${Number(o.prize_usd).toLocaleString("es-CO",{style:"currency",currency:"USD"})} cada uno, retirables al instante.`:`Tienes ${o.weekly?"hasta el cierre":RH()+" horas"} para responder. Los primeros ${o.max_winners} en acertar ganan ${o.points} puntos.`,url:A.absUrl("main","reto-"+saved.id),audience:"todos",tag:"reto-"+saved.id});toast("Notificación enviada")}catch(x){toast("Guardado, pero la notificación falló: "+x.message)}}
        else if(o.notify&&o.status==="publicado"&&!x.notified_at)toast("La notificación sale sola a la hora de publicación");
        retos()}catch(x){toast(x.message)}finally{const b=$("#rSv");if(b)busy(b,false)}};
  }
}
async function afiliados(){
  let list=[];try{list=await API.adminAffiliates()}catch(e){H().innerHTML=`<div class="empty">No se pudieron cargar. ¿Ya corriste <b>supabase/retos.sql</b>?<span class="dim">${esc(e.message)}</span></div>`;return}
  let pinfo={total:0};try{pinfo=await API.adminPartnerInfo()||pinfo}catch(e){}
  const grab=t=>{const T=String(t||"").replace(/-\s*\n\s*/g,"-").toUpperCase();return [...new Set([...(T.match(/\b[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/g)||[]),...(T.match(/\bD-[A-Z0-9]{7}\b/g)||[]),...(T.replace(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g," ").replace(/D-[A-Z0-9]{7}/g," ").match(/(?<![\w-])[A-Z]{1,5}\d{4,12}\b/g)||[]).filter(x=>!/^(USD|EUR|COP|USDT|MT)\d/.test(x))])]};
  let f="pendiente";const ES={pendiente:'<span class="pill gold">Por verificar</span>',verificado:'<span class="pill ok">Verificado</span>',rechazado:'<span class="pill">Rechazado</span>'};
  const draw=()=>{const L=list.filter(a=>f==="todos"||a.status===f);
    const nOld=list.filter(a=>a.status==="pendiente"&&a.in_list==="antiguo").length;
    H().innerHTML=`<details class="panel pl-box"${list.some(a=>a.status==="pendiente")||!pinfo.total?" open":""}><summary><b>⚡ Listas de clientes de Deriv Partners</b><span class="muted">${pinfo.total?`IDs activos: <b>${pinfo.active||0}</b> (se aprueban solos) · IDs antiguos: <b>${pinfo.old||0}</b> (te aviso y tú autorizas) · cada cliente suele tener 2 IDs (el largo y el d-…)${pinfo.updated?` · lista activa del ${fmtDate(pinfo.updated)}`:""}`:"Aún no has cargado tus listas."}</span></summary>
        <label for="plT">Pega aquí la tabla de clientes (Deriv Partners → Inicio → Desglose del comerciante activo). Sirve la tabla completa: tomo solo los IDs (largos tipo 019c0ed8-61dc-…, cortos tipo d-k3skg7d o tipo CR1234567).<textarea id="plT" style="min-height:120px" placeholder="019c0ed8-61dc-7fa0-9657-56f9ed8ee1e1 d-50rd293&#10;…"></textarea></label>
        <div class="pl-opts">
          <label class="pl-op"><input type="radio" name="plK" value="activo" checked><span><b>Lista activa</b> · clientes que operaron este mes. Se aprueban solos.</span></label>
          <label class="pl-op"><input type="radio" name="plK" value="antiguo"><span><b>Lista antigua</b> · meses anteriores. No se aprueban solos: te los marco y tú autorizas.</span></label>
          <label class="chk" id="plMw" style="margin:4px 0 0"><input type="checkbox" id="plM"> <b>Es la lista nueva del mes:</b> los activos que ya no aparezcan pasan a la lista antigua</label>
        </div>
        <div class="row" style="justify-content:flex-end"><span id="plN" class="dim"></span><button type="button" class="btn gold" id="plGo">Cargar lista</button></div></details>
      ${nOld?`<div class="note warn-note" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span>🕓 <b>${nOld} solicitud${nOld===1?"":"es"}</b> con ID de tu <b>lista antigua</b>: fueron clientes tuyos, pero no operaron este mes. Revísalos y autoriza.</span><button type="button" class="btn sm ok" id="plOld">Autorizar los ${nOld}</button></div>`:""}
      <div class="note">Los que no estén en ninguna lista quedan en "Por verificar": revísalos en <b>Deriv Partners</b> y usa <b>Verificar</b> o <b>Rechazar</b>. El alumno verificado gana los puntos completos y le sale la etiqueta ${A.affTag()}.</div>
      <div class="panel"><div class="sec-h"><h3>Solicitudes de afiliado</h3><div class="seg rk-seg" style="margin:0">${[["pendiente","Por verificar"],["verificado","Verificados"],["rechazado","Rechazados"],["todos","Todos"]].map(([k,t])=>`<a href="javascript:void 0" data-f="${k}" class="${f===k?"on":""}">${t} (${k==="todos"?list.length:list.filter(a=>a.status===k).length})</a>`).join("")}</div></div>
      <div class="ulist">${L.map(a=>`<article class="ucard"><div class="uc-who"><div><b>${esc(a.username)} ${A.flag(a.country||"")}</b><span class="dim">${esc(a.email||"")}</span></div></div>
        <div class="uc-st"><div><small>ID de Deriv</small><b class="mono sel">${esc(a.deriv_id)}</b></div><div><small>Estado</small>${ES[a.status]||""}${a.status!=="verificado"?(a.in_list==="activo"?'<span class="pill ok">✓ En tu lista activa</span>':a.in_list==="antiguo"?'<span class="pill warn">✓ En tu lista antigua</span>':'<span class="pill">No está en tus listas</span>'):""}</div><div><small>Enviado</small><span>${fmtDate(a.created_at)}</span></div><div><small>Nota</small><span class="dim">${esc(a.admin_note||"—")}</span></div></div>
        <div class="uc-act row" data-host="${esc(a.user_id)}"><button class="btn sm" data-cp="${esc(a.deriv_id)}">Copiar ID</button><button class="btn sm" data-dm="${esc(a.user_id)}" data-dmk="${a.status==="verificado"?3:a.in_list?0:/^[0-9A-F]{8}-[0-9A-F]{4}-|^D-[A-Z0-9]{5,}$|^[A-Z]{2,5}\d{4,}$/i.test(a.deriv_id||"")?2:1}">💬 Escribirle</button>${a.status!=="verificado"?`<button class="btn sm ok" data-ok="${esc(a.user_id)}">Verificar</button>`:""}${a.status!=="rechazado"?`<button class="btn sm bad" data-no="${esc(a.user_id)}">${a.status==="verificado"?"Quitar afiliado":"Rechazar"}</button>`:""}</div></article>`).join("")||'<div class="muted">No hay solicitudes aquí.</div>'}</div></div>`;
    const pt=$("#plT");if(pt){pt.oninput=()=>{const n=grab(pt.value).length;$("#plN").textContent=n?`${n} IDs encontrados`:""};
      const syncM=()=>{const act=(document.querySelector('input[name=plK]:checked')||{}).value!=="antiguo";$("#plMw").style.display=act?"":"none";if(!act)$("#plM").checked=false};$$("input[name=plK]").forEach(r=>r.onchange=syncM);syncM();
      $("#plGo").onclick=async()=>{const ids=grab(pt.value);if(!ids.length){toast("No encontré IDs de cliente en lo que pegaste");return}const tier=(document.querySelector('input[name=plK]:checked')||{}).value||"activo";
        try{busy($("#plGo"),true);const r=await API.adminPartnerImport(ids,$("#plM").checked,tier);
          A.pop({icon:"check",tone:"green",kicker:`Lista ${tier} cargada · ${r.received} IDs`,title:r.approved?`${r.approved} afiliado${r.approved===1?"":"s"} aprobado${r.approved===1?"":"s"} automáticamente`:tier==="antiguo"?"Lista antigua guardada":"Lista activa actualizada",text:`IDs activos: ${r.active} · IDs antiguos: ${r.old}${r.moved_old?` · ${r.moved_old} pasaron a la lista antigua`:""}.`,confetti:!!r.approved});
          pinfo=await API.adminPartnerInfo().catch(()=>pinfo);list=await API.adminAffiliates();draw()}catch(x){toast(x.message)}finally{const b=$("#plGo");if(b)busy(b,false)}}}
    const po=$("#plOld");if(po)po.onclick=async()=>{try{busy(po,true);const n=await API.adminPartnerApproveOld();A.pop({icon:"check",tone:"green",kicker:"Autorizados",title:`${n} afiliado${n===1?"":"s"} de tu lista antigua`,text:"Ya ganan los puntos completos.",confetti:!!n});list=await API.adminAffiliates();draw()}catch(x){toast(x.message)}};
    $$("[data-f]").forEach(b=>b.onclick=()=>{f=b.dataset.f;draw()});
    $$("[data-cp]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.cp);toast("ID copiado")}catch(e){}});
    $$("[data-ok]").forEach(b=>b.onclick=async()=>{try{await API.reviewAffiliate(b.dataset.ok,true,"");toast("Afiliado verificado");list=await API.adminAffiliates();draw()}catch(x){toast(x.message)}});
    $$("[data-no]").forEach(b=>b.onclick=()=>{const host=b.closest("[data-host]");host.innerHTML=`<input id="nN" placeholder="Motivo (lo verá el alumno)" maxlength="300" style="flex:1;min-width:180px;background:var(--bg2);border:1px solid var(--line2);border-radius:8px;padding:7px;color:var(--fg)"><button class="btn sm bad" id="nY">Confirmar</button><button class="btn sm ghost" id="nC">Cancelar</button>`;
      $("#nC").onclick=draw;$("#nY").onclick=async()=>{try{await API.reviewAffiliate(b.dataset.no,false,$("#nN").value.trim()||"No aparece en la red de socios");toast("Solicitud rechazada");list=await API.adminAffiliates();draw()}catch(x){toast(x.message)}}})};
  draw();
}
async function retirosUsd(host){if(!host)return;let L=[];try{L=await API.adminUsdWithdrawals()}catch(e){host.innerHTML=`<div class="muted">Los retiros de saldo aparecen cuando corras <b>retos_express.sql</b>.</div>`;return}
  const U=v=>Number(v||0).toLocaleString("es-CO",{style:"currency",currency:"USD"}),pend=L.filter(x=>x.status==="pendiente");
  const fila=x=>`<article class="ucard"><div class="uc-who"><div><b>${esc(x.username)}${x.affiliate?" "+A.affTag():""}</b><span class="dim">${fmtDT(x.created_at)}</span></div></div>
    <div class="uc-st"><div><small>Retira</small><b class="mono" style="color:var(--ok)">${U(x.usd)}</b></div><div><small>Pagar a (${esc(x.method)})</small><b class="mono sel">${esc(x.account)}</b></div><div><small>Saldo que le queda</small><span class="mono">${U(x.saldo)}</span></div></div>
    ${x.dup_account||x.dup_ip?`<div class="row" style="gap:6px">${x.dup_account?`<span class="pill warn">⚠ Esa cuenta de Binance la usan ${x.dup_account} cuenta(s) más</span>`:""}${x.dup_ip?`<span class="pill warn">⚠ Juega desde la misma conexión que ${x.dup_ip} cuenta(s)</span>`:""}</div>`:""}
    <div class="uc-act row">${x.status==="pendiente"?`<button class="btn sm" data-ucp="${esc(x.account)}">Copiar cuenta</button><button class="btn sm ok" data-upay="${esc(x.id)}">Marcar pagado</button><button class="btn sm bad" data-urej="${esc(x.id)}">Rechazar</button>`:x.status==="pagado"?'<span class="pill ok">Pagado</span>':`<span class="pill">Rechazado · el saldo volvió${x.admin_note?" · "+esc(x.admin_note):""}</span>`}</div></article>`;
  host.innerHTML=`<div class="sec-h"><h3>💵 Retiros de saldo (retos express)</h3><span class="muted">${pend.length?`${pend.length} por pagar · ${U(pend.reduce((s,x)=>s+(+x.usd||0),0))}`:"Nada por pagar"}</span></div>
    <p class="dim" style="font-size:13px">Se pueden pedir en cualquier momento. Cada retiro te llega también como mensaje en Mensajes. Al marcarlo pagado o rechazado, el alumno recibe tu respuesta ahí.</p>
    ${L.length?L.slice(0,60).map(fila).join(""):'<div class="muted">Aún no hay retiros.</div>'}`;
  host.querySelectorAll("[data-ucp]").forEach(b=>b.onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(b.dataset.ucp);toast("Cuenta copiada")});
  host.querySelectorAll("[data-upay]").forEach(b=>b.onclick=async()=>{try{busy(b,true);await API.adminReviewUsd(b.dataset.upay,"pagado","");toast("Marcado como pagado");retirosUsd(host)}catch(x){toast(x.message);busy(b,false)}});
  host.querySelectorAll("[data-urej]").forEach(b=>b.onclick=async()=>{const n=prompt("Motivo del rechazo (lo verá el alumno):","");if(n===null)return;try{await API.adminReviewUsd(b.dataset.urej,"rechazado",n);toast("Rechazado: el saldo volvió al alumno");retirosUsd(host)}catch(x){toast(x.message)}});
}
async function canjes(){
  let list=[];try{list=await API.adminRedemptions()}catch(e){H().innerHTML=`<div class="empty">No se pudieron cargar. ¿Ya corriste <b>supabase/retos.sql</b>?<span class="dim">${esc(e.message)}</span></div>`;return}
  const c=RWc(),pend=list.filter(r=>r.status==="pendiente"),done=list.filter(r=>r.status!=="pendiente");
  const tot=pend.reduce((s,r)=>s+(+r.usd||0),0);
  const card=r=>`<article class="ucard"><div class="uc-who"><div><b>${esc(r.username)}${r.affiliate?" "+A.affTag():""}</b><span class="dim">${esc(r.email||"")}</span></div></div>
    <div class="uc-st"><div><small>Canje</small><b class="mono">${r.points} pts</b><span class="dim">${Number(r.usd).toLocaleString("es-CO",{style:"currency",currency:"USD"})}</span></div><div><small>Pagar a (${esc(r.method)})</small><b class="mono sel">${esc(r.account)}</b></div><div><small>Saldo actual</small><span class="mono">${r.balance??"—"} pts</span></div><div><small>Fecha</small><span>${fmtDate(r.created_at)}</span>${r.admin_note?`<span class="dim">${esc(r.admin_note)}</span>`:""}</div></div>${(r.dup_account||r.dup_ip||(r.account_age_days!=null&&r.account_age_days<7))?`<div class="note warn-note">⚠ Revisa antes de pagar:${r.dup_account?` <b>esta cuenta de Binance la usaron ${r.dup_account} usuario(s) más</b>.`:""}${r.dup_ip?` Jugó retos desde la misma conexión que <b>${r.dup_ip} cuenta(s)</b> más (puede ser la misma casa o el mismo operador móvil).`:""}${r.account_age_days!=null&&r.account_age_days<7?` La cuenta tiene solo <b>${r.account_age_days} día(s)</b>.`:""}</div>`:""}
    <div class="uc-act row" data-host="${esc(r.id)}">${r.status==="pendiente"?`<button class="btn sm" data-cp="${esc(r.account)}">Copiar cuenta</button><button class="btn sm ok" data-pay="${esc(r.id)}">Marcar pagado</button><button class="btn sm bad" data-rej="${esc(r.id)}">Rechazar</button>`:r.status==="pagado"?'<span class="pill ok">Pagado</span>':'<span class="pill">Rechazado · puntos devueltos</span>'}</div></article>`;
  setTimeout(()=>retirosUsd($("#usdW")),0);
  H().innerHTML=`<section class="panel" id="usdW"><div class="muted">Cargando retiros…</div></section><div class="acad-switch ${c.redeemOpen?"on":"off"}"><div><b>Canjes ${c.redeemOpen?"abiertos":"cerrados"}</b><span class="muted">${c.redeemOpen?"Los alumnos pueden enviar solicitudes de canje ahora.":"Los puntos se acumulan. Abre los canjes una vez al mes (por ejemplo, los primeros días) y ciérralos cuando termines de pagar."}</span></div><button class="btn ${c.redeemOpen?"bad":"gold"}" id="cwSw">${c.redeemOpen?"Cerrar canjes":"Abrir canjes"}</button></div>
    <div class="panel"><div class="sec-h"><h3>Por pagar (${pend.length})</h3><span class="muted">Total: <b class="mono">${tot.toLocaleString("es-CO",{style:"currency",currency:"USD"})}</b></span></div><p class="muted" style="margin-top:0">Envía el pago por Binance Pay a la cuenta del alumno y luego márcalo como pagado. Si lo rechazas, los puntos vuelven a su saldo.</p><div class="ulist">${pend.map(card).join("")||'<div class="muted">No hay canjes por pagar.</div>'}</div></div>
    <div class="panel"><div class="sec-h"><h3>Historial</h3></div><div class="ulist">${done.slice(0,100).map(card).join("")||'<div class="muted">Sin canjes revisados.</div>'}</div></div>`;
  $("#cwSw").onclick=async()=>{const ns=Object.assign({},S.site,{rewards:Object.assign(RWc(),{redeemOpen:!c.redeemOpen})});try{await API.saveSite(ns);S.site=ns;toast(c.redeemOpen?"Canjes cerrados":"Canjes abiertos");canjes()}catch(x){toast(x.message)}};
  $$("[data-cp]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.cp);toast("Cuenta copiada")}catch(e){}});
  $$("[data-pay]").forEach(b=>b.onclick=()=>A.confirmInline(b.closest("[data-host]"),"¿Ya enviaste el pago?",async()=>{try{await API.reviewRedemption(b.dataset.pay,true,"");toast("Canje marcado como pagado");canjes()}catch(x){toast(x.message)}}));
  $$("[data-rej]").forEach(b=>b.onclick=()=>{const host=b.closest("[data-host]");host.innerHTML=`<input id="jN" placeholder="Motivo (lo verá el alumno)" maxlength="300" style="flex:1;min-width:180px;background:var(--bg2);border:1px solid var(--line2);border-radius:8px;padding:7px;color:var(--fg)"><button class="btn sm bad" id="jY">Rechazar</button><button class="btn sm ghost" id="jC">Cancelar</button>`;
    $("#jC").onclick=canjes;$("#jY").onclick=async()=>{try{await API.reviewRedemption(b.dataset.rej,false,$("#jN").value.trim());toast("Canje rechazado");canjes()}catch(x){toast(x.message)}}});
}
/* top 10 y ajuste manual de puntos */
let topPer="mes";
async function top(){
  const c=RWc(),usd=p=>c.ptsPerUsd?` <span class="rk-usd">(${(p/Math.max(1,+c.ptsPerUsd)).toLocaleString("es-CO",{style:"currency",currency:"USD",minimumFractionDigits:2})})</span>`:"";
  H().innerHTML='<div class="muted">Cargando…</div>';
  let L=[],G=[];try{[L,G]=await Promise.all([API.adminPointsTop(topPer,10),API.adminPointsLog()])}catch(e){H().innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  const fila=(x,i)=>`<tr><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><b>${esc(x.username)}</b>${x.affiliate?' <span class="tag pub">Afiliado</span>':""}</td>
    <td class="n">${x.points}${usd(x.points)}</td><td class="n c-hide">${x.wins}</td><td class="n c-hide">${x.saldo}</td>
    <td><div class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" step="1" placeholder="+50 / -50" data-pp="${esc(x.username)}" style="width:110px"><button class="btn sm" data-pq="${esc(x.username)}">Aplicar</button></div></td></tr>`;
  H().innerHTML=`<div class="panel"><div class="sec-h"><h3>Top 10</h3><div class="seg rk-seg" style="margin:0"><a href="javascript:void 0" data-tp="mes" class="${topPer==="mes"?"on":""}">Este mes</a><a href="javascript:void 0" data-tp="total" class="${topPer==="total"?"on":""}">Histórico</a></div></div>
    ${L.length?`<div class="scroll"><table class="tbl rk"><thead><tr><th>#</th><th>Alumno</th><th style="text-align:right">Puntos</th><th class="c-hide" style="text-align:right">Retos ganados</th><th class="c-hide" style="text-align:right">Saldo para canjear</th><th>Sumar o quitar</th></tr></thead><tbody>${L.map(fila).join("")}</tbody></table></div>`:'<div class="muted">Todavía nadie tiene puntos en este periodo.</div>'}
    <p class="dim" style="font-size:13px">«Puntos» es lo que cuenta para el ranking del periodo. «Saldo» es lo que puede canjear (ya descontados sus canjes).</p></div>
  <div class="two"><form class="panel form" id="pjF"><h3>Sumar o quitar puntos a cualquier alumno</h3>
      <label for="pjU">Usuario<input id="pjU" placeholder="nombre de usuario" autocomplete="off"></label>
      <div class="two"><label for="pjP">Puntos<input id="pjP" type="number" step="1" placeholder="50 para sumar · -50 para quitar"></label>
      <label for="pjM">Motivo (opcional)<input id="pjM" maxlength="120" placeholder="Ej.: premio del live, corrección"></label></div>
      <button class="btn gold" id="pjB">Aplicar</button>
      <p class="dim" style="font-size:13px">Los puntos sumados cuentan para el ranking de este mes y para canjear. No se puede dejar a nadie con saldo negativo.</p></form>
    <div class="panel"><h3>Últimos ajustes</h3>${G.length?`<div class="tree">${G.map(x=>`<div class="item"><span class="txt"><b>${esc(x.username)} · <span style="color:${x.points>0?"var(--ok)":"var(--bad)"}">${x.points>0?"+":""}${x.points} pts</span></b><span>${fmtDate(x.created_at)}${x.motivo?" · "+esc(x.motivo):""}</span></span></div>`).join("")}</div>`:'<div class="muted">Aún no has hecho ajustes.</div>'}</div></div>`;
  $$("[data-tp]").forEach(a=>a.onclick=()=>{topPer=a.dataset.tp;top()});
  const aplicar=async(u,pts,mot,btn)=>{pts=parseInt(pts,10);if(!u||!pts){toast("Escribe el usuario y los puntos (ej. 50 o -50)");return}
    try{btn&&busy(btn,true);const r=await API.adminAdjustPoints(u,pts,mot||"");toast(`${r.username}: ${pts>0?"+":""}${pts} pts · saldo ${r.saldo}`);top()}catch(x){toast(x.message)}finally{btn&&busy(btn,false)}};
  $$("[data-pq]").forEach(b=>b.onclick=()=>{const i=$(`[data-pp="${CSS.escape(b.dataset.pq)}"]`);aplicar(b.dataset.pq,i&&i.value,"",b)});
  $("#pjF").onsubmit=e=>{e.preventDefault();aplicar($("#pjU").value.trim(),$("#pjP").value,$("#pjM").value.trim(),$("#pjB"))};
  /* saldo en dólares (retos express) */
  const U=v=>Number(v||0).toLocaleString("es-CO",{style:"currency",currency:"USD"});
  const box=document.createElement("div");box.className="two";H().appendChild(box);
  let UL=null;try{UL=await API.adminUsdLog()}catch(e){}
  box.innerHTML=`<form class="panel form" id="sjF"><h3>💵 Sumar o quitar saldo (USD)</h3>
      <p class="dim" style="font-size:13px;margin:0">El saldo es lo que el alumno puede retirar al instante. Úsalo para premios de lives, sorteos o correcciones. Le llega un mensaje avisándole.</p>
      <label for="sjU">Usuario<input id="sjU" placeholder="nombre de usuario" autocomplete="off"></label>
      <div class="two"><label for="sjV">Monto (USD)<input id="sjV" type="number" step="0.01" placeholder="2 para sumar · -2 para quitar"></label>
      <label for="sjM">Motivo (opcional)<input id="sjM" maxlength="120" placeholder="Ej.: premio del live"></label></div>
      <button class="btn gold" id="sjB">Aplicar</button></form>
    <div class="panel"><h3>Últimos ajustes de saldo</h3>${UL===null?'<div class="muted">Aparece cuando corras <b>saldo_admin.sql</b>.</div>':UL.length?`<div class="tree">${UL.map(x=>`<div class="item"><span class="txt"><b>${esc(x.username)} · <span style="color:${x.usd>0?"var(--ok)":"var(--bad)"}">${x.usd>0?"+":"−"}${U(Math.abs(x.usd))}</span></b><span>${fmtDate(x.created_at)}${x.motivo?" · "+esc(x.motivo):""}</span></span></div>`).join("")}</div>`:'<div class="muted">Aún no has hecho ajustes de saldo.</div>'}</div>`;
  $("#sjF").onsubmit=async e=>{e.preventDefault();const u=$("#sjU").value.trim(),v=+$("#sjV").value;if(!u||!v){toast("Escribe el usuario y el monto (ej. 2 o -2)");return}
    try{busy($("#sjB"),true);const r=await API.adminAdjustUsd(u,v,$("#sjM").value.trim());toast(`${r.username}: ${v>0?"+":"−"}${U(Math.abs(v))} · saldo ${U(r.saldo)}`);top()}catch(x){toast(x.message)}finally{const b=$("#sjB");if(b)busy(b,false)}};
}
function rpuntos(){const c=RWc();
  H().innerHTML=`<form class="form" id="wf">
    <h3>Retos diarios</h3>
    <label class="chk"><input type="checkbox" id="wE" ${c.enabled?"checked":""}> <b>Activar retos y puntos</b> (los alumnos pueden jugar, ganar puntos y ver el ranking)</label>
    <label class="chk"><input type="checkbox" id="wTz" ${c.teaser?"checked":""}> Mostrar el anuncio “Muy pronto: El Arte Gráfico te paga por participar” aunque estén apagados</label>
    <label class="chk"><input type="checkbox" id="wH" ${c.halfIfNotAffiliate!==false?"checked":""}> Quien no es afiliado verificado gana la mitad de los puntos</label>
    <div class="two"><label for="wRh">Horas que dura cada reto diario<input id="wRh" type="number" min="0.25" max="48" step="0.25" value="${c.revealHours}"></label><div class="muted" style="align-self:end;font-size:13px">Todos pueden responder durante ese tiempo. Al cerrar se revelan la respuesta, los ganadores y los puntos.</div></div>
    <label class="chk"><input type="checkbox" id="wPr" ${c.pushResults!==false?"checked":""}> Enviar también una notificación cuando se revelen los ganadores de cada reto</label>
    <div class="two"><label for="wB">Bono por racha de 7 días jugando (puntos, 0 = sin bono)<input id="wB" type="number" min="0" value="${c.streakBonus??50}"></label><div class="muted" style="align-self:end;font-size:13px">Se entrega cada 7 días seguidos jugando (acierte o no). Quien no es afiliado recibe la mitad.</div></div>
    <h3>Dinero y canjes</h3>
    <div class="three"><label for="wR">Puntos por 1 USD<input id="wR" type="number" min="1" value="${c.ptsPerUsd}"></label><label for="wM">Mínimo para canjear (puntos)<input id="wM" type="number" min="1" value="${c.minRedeem}"></label><label>Equivale a<b class="mono" id="wU" style="font-size:20px"></b></label></div>
    <label class="chk"><input type="checkbox" id="wO" ${c.redeemOpen?"checked":""}> Canjes abiertos ahora (también lo cambias desde <a href="#admin-canjes">Canjes</a>)</label>
    <div class="note" id="wCalc"></div>
    <h3>Cómo funciona</h3>
    <ul class="checks"><li>Programas un reto en <a href="#admin-retos">Retos diarios</a> con su hora de publicación: a esa hora sale y se envía la notificación.</li><li>Dura ${c.revealHours} horas. Nadie sabe si ganó hasta el cierre; ahí se revelan los primeros que acertaron (5 por defecto), que ganan puntos: afiliados el 100 %, el resto la mitad.</li><li>Cada mes abres los canjes, los alumnos piden su pago y tú lo marcas pagado en <a href="#admin-canjes">Canjes</a>.</li><li>Las solicitudes de afiliado (ID de Deriv) las apruebas en <a href="#admin-afiliados">Afiliados</a>.</li></ul>
    <div class="row"><button class="btn gold" id="wS">Guardar ajustes</button></div></form>`;
  const calc=()=>{const r=Math.max(1,+$("#wR").value||100),m=+$("#wM").value||0;$("#wU").textContent=(m/r).toLocaleString("es-CO",{style:"currency",currency:"USD"});
    $("#wCalc").innerHTML=`Con retos de 100 puntos y 5 ganadores al día, si todos fueran afiliados repartirías hasta <b>${(500*30/r).toLocaleString("es-CO",{style:"currency",currency:"USD"})}</b> al mes (la mitad si nadie es afiliado). Ajusta los puntos por USD a tu presupuesto.`};
  $("#wR").oninput=calc;$("#wM").oninput=calc;calc();groupForm($("#wf"));
  $("#wf").onsubmit=async e=>{e.preventDefault();const ns=Object.assign({},S.site,{rewards:{pushResults:$("#wPr").checked,revealHours:Math.min(48,Math.max(.25,+$("#wRh").value||3)),enabled:$("#wE").checked,teaser:$("#wTz").checked,halfIfNotAffiliate:$("#wH").checked,ptsPerUsd:Math.max(1,+$("#wR").value||100),minRedeem:Math.max(1,+$("#wM").value||500),redeemOpen:$("#wO").checked,streakBonus:Math.max(0,+$("#wB").value||0)}});
    try{busy($("#wS"),true);await API.saveSite(ns);S.site=ns;A.applySite&&A.applySite();toast("Ajustes guardados")}catch(x){toast(x.message)}finally{busy($("#wS"),false)}};
}
/* ---------- reseñas de módulos ---------- */
async function resenas(){
  H().innerHTML='<div class="muted">Cargando…</div>';let list=[];
  try{list=await API.adminFeedback()}catch(e){H().innerHTML=`<div class="empty">No se pudieron cargar las reseñas. Si aún no lo hiciste, corre <b>supabase/resenas_modulos.sql</b> en Supabase.<span class="dim">${esc(e.message)}</span></div>`;return}
  if(!list.length){H().innerHTML='<div class="panel"><h3>Reseñas de módulos</h3><div class="empty">Aún no hay reseñas. Aparecerán aquí cuando los alumnos terminen un módulo.</div></div>';return}
  const est=n=>`<span class="fb-st" aria-label="${n} de 5">${"★".repeat(n)}<i>${"★".repeat(5-n)}</i></span>`;
  /* días en hora de Colombia */
  const dia=d=>new Date(new Date(d).getTime()-5*3600e3).toISOString().slice(0,10);
  const hoy=dia(Date.now()),ayer=dia(Date.now()-864e5);
  const diaTxt=k=>k===hoy?"Hoy":k===ayer?"Ayer":new Date(k+"T12:00:00Z").toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
  const mods=[...new Map(list.map(f=>[f.module_id,f.module_title])).entries()].sort((a,b)=>String(a[1]).localeCompare(b[1]));
  const prom=xs=>xs.length?xs.reduce((s,f)=>s+f.rating,0)/xs.length:0;
  let F={q:"",m:"",r:"",per:"todo",d:"",ord:"nuevas"};
  const pasa=x=>{
    if(F.m&&x.module_id!==F.m)return false;
    if(F.r==="baja"?x.rating>3:F.r&&x.rating!==+F.r)return false;
    const k=dia(x.created_at);
    if(F.per==="hoy"&&k!==hoy)return false;
    if(F.per==="7"&&Date.now()-new Date(x.created_at)>7*864e5)return false;
    if(F.per==="30"&&Date.now()-new Date(x.created_at)>30*864e5)return false;
    if(F.per==="dia"&&F.d&&k!==F.d)return false;
    if(F.q){const t=(x.username+" "+x.liked+" "+x.improve+" "+x.module_title).toLowerCase();if(!t.includes(F.q))return false}
    return true};
  const ordenar=a=>a.sort(F.ord==="viejas"?(x,y)=>String(x.created_at).localeCompare(y.created_at):F.ord==="peor"?(x,y)=>x.rating-y.rating||String(y.created_at).localeCompare(x.created_at)
    :F.ord==="mejor"?(x,y)=>y.rating-x.rating||String(y.created_at).localeCompare(x.created_at):(x,y)=>String(y.created_at).localeCompare(x.created_at));
  const tarjeta=x=>`<article class="fb-item${x.rating<=2?" bad":""}"><header>${est(x.rating)}<b>${esc(x.username)}</b> ${A.flag(x.country||"")}${x.premium?A.premTag():""}<span class="dim">${esc(x.module_title)} · ${new Date(x.created_at).toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit",timeZone:"America/Bogota"})}</span></header>
      <div class="two"><div><span class="eyebrow">Cómo le pareció</span><p>${esc(x.liked)||'<span class="dim">—</span>'}</p></div><div><span class="eyebrow">Qué mejorar</span><p>${esc(x.improve)||'<span class="dim">—</span>'}</p></div></div></article>`;
  const draw=()=>{
    const f=ordenar(list.filter(pasa));
    /* indicadores del filtro actual */
    const av=prom(f),buenas=f.filter(x=>x.rating>=4).length,sem=list.filter(x=>Date.now()-new Date(x.created_at)<=7*864e5).length;
    $("#rsK").innerHTML=[[f.length,"reseñas"+(f.length!==list.length?` de ${list.length}`:"")],[f.length?av.toFixed(1)+" "+est(Math.round(av)):"—","promedio"],[f.length?Math.round(100*buenas/f.length)+" %":"—","con 4 o 5 estrellas"],[sem,"en los últimos 7 días"]]
      .map(([v,t])=>`<div class="rs-k"><b>${v}</b><span>${t}</span></div>`).join("");
    /* reparto por estrellas (clic = filtrar) */
    const base=list.filter(x=>{const r=F.r;F.r="";const ok=pasa(x);F.r=r;return ok}),mx=Math.max(1,...[5,4,3,2,1].map(n=>base.filter(x=>x.rating===n).length));
    $("#rsD").innerHTML=[5,4,3,2,1].map(n=>{const c=base.filter(x=>x.rating===n).length;return `<button type="button" class="rs-bar${String(F.r)===String(n)?" on":""}" data-rs="${n}" aria-label="Filtrar ${n} estrellas"><span class="mono">${n} ★</span><i><s style="width:${100*c/mx}%"></s></i><span class="mono">${c}</span></button>`}).join("");
    $$("[data-rs]").forEach(b=>b.onclick=()=>{F.r=String(F.r)===b.dataset.rs?"":b.dataset.rs;$("#rsR").value=F.r;draw()});
    /* lista agrupada por día */
    let html="",prev="";
    if(F.ord==="nuevas"||F.ord==="viejas")f.forEach(x=>{const k=dia(x.created_at);if(k!==prev){html+=`<h4 class="rs-day">${diaTxt(k)} <span class="dim">· ${f.filter(y=>dia(y.created_at)===k).length}</span></h4>`;prev=k}html+=tarjeta(x)});
    else html=f.map(tarjeta).join("");
    $("#rsL").innerHTML=html||'<div class="muted">Sin reseñas con estos filtros.</div>';
    /* resumen por módulo */
    $("#rsT").innerHTML=mods.map(([id,t])=>{const xs=list.filter(x=>x.module_id===id),a=prom(xs),ult=xs.reduce((m,x)=>x.created_at>m?x.created_at:m,"");
      return `<tr class="${F.m===id?"on":""}" data-rm="${esc(id)}" style="cursor:pointer"><td>${esc(t)}</td><td class="n"><span class="mono">${a.toFixed(1)}</span> ${est(Math.round(a))}</td><td class="n">${xs.length}</td><td class="n">${xs.filter(x=>x.rating<=3).length}</td><td class="c-hide" style="white-space:nowrap">${new Date(ult).toLocaleDateString("es-CO",{day:"numeric",month:"short",timeZone:"America/Bogota"})}</td></tr>`}).join("");
    $$("[data-rm]").forEach(r=>r.onclick=()=>{F.m=F.m===r.dataset.rm?"":r.dataset.rm;$("#rsM").value=F.m;draw()});
  };
  H().innerHTML=`<div class="panel"><div class="sec-h"><h3>Reseñas de módulos</h3><div class="row" style="gap:8px"><span class="muted">Privadas: solo las ves tú</span><button class="btn sm ghost" id="rsCsv">Descargar CSV</button></div></div>
    <div class="rs-kpis" id="rsK"></div>
    <div class="rs-top"><div class="rs-dist" id="rsD"></div>
      <div class="scroll"><table class="tbl"><thead><tr><th>Módulo</th><th style="text-align:right">Promedio</th><th style="text-align:right">Reseñas</th><th style="text-align:right">3★ o menos</th><th class="c-hide">Última</th></tr></thead><tbody id="rsT"></tbody></table></div></div></div>
  <div class="panel"><div class="rs-fil">
      <input id="rsQ" type="search" placeholder="Buscar por alumno o comentario" aria-label="Buscar">
      <select id="rsM" aria-label="Módulo"><option value="">Todos los módulos</option>${mods.map(([id,t])=>`<option value="${esc(id)}">${esc(t)}</option>`).join("")}</select>
      <select id="rsR" aria-label="Estrellas"><option value="">Todas las estrellas</option><option value="5">5 estrellas</option><option value="4">4 estrellas</option><option value="3">3 estrellas</option><option value="2">2 estrellas</option><option value="1">1 estrella</option><option value="baja">3 o menos (para mejorar)</option></select>
      <select id="rsP" aria-label="Fecha"><option value="todo">Todas las fechas</option><option value="hoy">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="dia">Un día exacto…</option></select>
      <input id="rsDia" type="date" aria-label="Día" hidden max="${hoy}">
      <select id="rsO" aria-label="Orden"><option value="nuevas">Más recientes</option><option value="viejas">Más antiguas</option><option value="peor">Peor calificación primero</option><option value="mejor">Mejor calificación primero</option></select>
      <button class="btn sm ghost" id="rsX">Limpiar</button></div>
    <div id="rsL" class="fb-list"></div></div>`;
  let tq;$("#rsQ").oninput=()=>{clearTimeout(tq);tq=setTimeout(()=>{F.q=$("#rsQ").value.trim().toLowerCase();draw()},150)};
  $("#rsM").onchange=()=>{F.m=$("#rsM").value;draw()};
  $("#rsR").onchange=()=>{F.r=$("#rsR").value;draw()};
  $("#rsP").onchange=()=>{F.per=$("#rsP").value;$("#rsDia").hidden=F.per!=="dia";if(F.per==="dia"&&!F.d){F.d=hoy;$("#rsDia").value=hoy}draw()};
  $("#rsDia").onchange=()=>{F.d=$("#rsDia").value;draw()};
  $("#rsO").onchange=()=>{F.ord=$("#rsO").value;draw()};
  $("#rsX").onclick=()=>{F={q:"",m:"",r:"",per:"todo",d:"",ord:"nuevas"};["#rsQ","#rsM","#rsR"].forEach(k=>$(k).value="");$("#rsP").value="todo";$("#rsO").value="nuevas";$("#rsDia").hidden=true;draw()};
  $("#rsCsv").onclick=()=>{const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
    const rows=[["Fecha","Alumno","País","Módulo","Estrellas","Cómo le pareció","Qué mejorar"],...ordenar(list.filter(pasa)).map(x=>[new Date(x.created_at).toLocaleString("es-CO",{timeZone:"America/Bogota"}),x.username,x.country,x.module_title,x.rating,x.liked,x.improve])];
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"}));a.download=`resenas-modulos-${hoy}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1e3)};
  draw();
}

/* ---------- alumnos ---------- */
async function alumnos(){
  H().innerHTML='<div class="muted">Cargando…</div>';let list=[];try{list=await API.users()}catch(e){H().innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  const isP=u=>u.premium_until&&new Date(u.premium_until)>new Date();
  const GIVE=()=>{const pl=(S.site&&S.site.plans)||[],N={cobre:"Cobre",plata:"Plata",oro:"Oro",diamond:"Diamond"},D={cobre:30,plata:180,oro:365,diamond:36500};
    return Object.keys(N).map(t=>{const x=pl.find(p=>(p.tier||(p.days>=300?"oro":p.days>=150?"plata":"cobre"))===t);return{t,n:N[t],d:x?+x.days:D[t]}})};
  const venc=u=>u.premium_until&&new Date(u.premium_until)<=new Date();
  /* filtros: acceso, plan (placa), curso comprado y rol, cada uno con su conteo */
  const TIER=u=>isP(u)?(u.plan||"cobre"):"",paidC=(S.courses||[]).filter(c=>!c.base);
  const FIL=k=>k==="todos"?()=>true:k==="premium"?isP:k==="gratis"?u=>!isP(u)&&!(u.courses||[]).length:k==="sinplan"?u=>!isP(u):k==="vencido"?venc:k==="suspendido"?u=>u.banned:k==="admin"?u=>u.role==="admin"
    :k==="concurso"?u=>(u.courses||[]).length>0:k.startsWith("plan:")?u=>TIER(u)===k.slice(5):k.startsWith("curso:")?u=>(u.courses||[]).includes(k.slice(6)):()=>true;
  const cnt=k=>list.filter(FIL(k)).length,opt=(k,t)=>`<option value="${esc(k)}">${t} (${cnt(k)})</option>`;
  const TN={cobre:"🟤 Cobre",plata:"⚪ Plata",oro:"🟡 Oro",diamond:"💎 Diamond"};
  const filOpts=()=>`<option value="todos">Todos (${list.length})</option>
    <optgroup label="Acceso">${opt("premium","Con plan activo")}${opt("concurso","Con algún curso comprado")}${opt("gratis","Solo cuenta gratis (sin plan ni curso)")}${opt("sinplan","Sin plan activo")}${opt("vencido","Plan vencido")}</optgroup>
    <optgroup label="Plan">${Object.keys(TN).map(t=>opt("plan:"+t,TN[t])).join("")}</optgroup>
    ${paidC.length?`<optgroup label="Curso comprado">${paidC.map(c=>opt("curso:"+c.id,esc(`${c.icon||"🎓"} ${c.title}`))).join("")}</optgroup>`:""}
    <optgroup label="Otros">${opt("admin","Admins")}${opt("suspendido","Suspendidos")}</optgroup>`;
  const chips=()=>[["premium","Con plan"],...Object.keys(TN).map(t=>["plan:"+t,TN[t]]),...paidC.map(c=>["curso:"+c.id,esc(`${c.icon||"🎓"} ${c.title}`)]),["gratis","Solo gratis"]]
    .map(([k,t])=>`<button class="uchip${fil===k?" on":""}" data-uf="${esc(k)}">${t} <b>${cnt(k)}</b></button>`).join("");
  let q="",fil="todos",pais="";const draw=()=>{$("#uchips").innerHTML=chips();$$("[data-uf]").forEach(b=>b.onclick=()=>{fil=fil===b.dataset.uf?"todos":b.dataset.uf;$("#uf").value=fil;draw()});const f=list.filter(u=>(!q||(u.username+" "+u.email).toLowerCase().includes(q))
      &&FIL(fil)(u)
      &&(!pais||(pais==="-"?!u.country:u.country===pais)));
    $("#uN").textContent=f.length===list.length?"":`Mostrando ${f.length} de ${list.length}`;
    {const sel=$("#uf");if(sel){sel.innerHTML=filOpts();sel.value=fil}}
    $("#uPA").textContent=`${cnt("premium")} con plan · ${cnt("concurso")} con curso`;
    $("#ut").innerHTML=f.map(u=>`<article class="ucard${u.banned?" ban":""}">
      <div class="uc-who">${A.avatar?A.avatar(u,44):""}<div><b>${esc(u.username)} ${A.flag(u.country||"")}${u.role==="admin"?' <span class="tag pub">Admin</span>':""}${u.banned?' <span class="tag">Suspendido</span>':""}</b><span class="dim">${esc(u.email||"")}</span></div></div>
      <div class="uc-st">
        <div><small>Acceso</small>${isP(u)?A.premTag(u.plan)+`<span class="dim">${new Date(u.premium_until).getFullYear()>=2090?"de por vida":"hasta "+fmtDate(u.premium_until)}</span>`:venc(u)?`<span class="tag">Vencido</span><span class="dim">el ${fmtDate(u.premium_until)}</span>`:(u.courses||[]).length?"":'<span class="tag">Gratis</span>'}${(u.courses||[]).map(cid=>{const c=(S.courses||[]).find(x=>x.id===cid);return c?`<span class="crs-tag" style="--cc:${esc(c.color)}">${esc(c.icon||"")} ${esc(c.title)}</span>`:""}).join("")}</div>
        <div><small>Puntos</small><b class="mono">${u.xp||0}</b></div><div><small>Prueba</small><b class="mono">${u.demo_used||0}/5</b></div><div><small>Registro</small><span>${fmtDate(u.created_at)}</span></div></div>
      <div class="uc-act row">
        <label class="uc-plan uc-give"><span>Dar plan</span><select data-give="${esc(u.id)}"><option value="">Elegir…</option>${GIVE().map(g=>`<option value="${g.t}:${g.d}">${A.TIERS?A.TIERS[g.t].i:""} ${g.n} · ${g.d>=3650?"de por vida":g.d+" días"}</option>`).join("")}</select></label>
        <button class="btn sm ok" data-add="${esc(u.id)}:30">+30 días</button>
        <label class="uc-date"><span>Hasta</span><input type="date" data-date="${esc(u.id)}" aria-label="Premium hasta"></label>
        <button class="btn sm" data-dm="${esc(u.id)}">💬 Escribirle</button>
        <details class="uc-more"><summary class="btn sm ghost">Más ▾</summary><div class="uc-menu">
          ${isP(u)?`<button class="btn sm" data-rm="${esc(u.id)}">Quitar premium</button><label class="uc-plan">Cambiar placa (sin tocar días)<select data-plan="${esc(u.id)}"><option value="cobre">🟤 Cobre</option><option value="plata">⚪ Plata</option><option value="oro">🟡 Oro</option><option value="diamond">💎 Diamond</option></select></label>`:""}
          ${(S.courses||[]).map(c=>{const has=(u.courses||[]).includes(c.id);return `<button class="btn sm ${has?"ghost":""}" data-crs="${esc(u.id)}|${esc(c.id)}|${has?0:1}">${has?"Quitar":"Dar"} curso ${esc(c.title)}</button>`}).join("")}
          <button class="btn sm ghost" data-ban="${esc(u.id)}">${u.banned?"Reactivar cuenta":"Suspender cuenta"}</button><button class="btn sm ghost" data-demo="${esc(u.id)}">Reiniciar prueba gratis</button>
          <button class="btn sm ghost" data-rxp="${esc(u.id)}">Reiniciar puntos</button><button class="btn sm bad" data-rall="${esc(u.id)}">Reiniciar avance</button>
          ${u.id!==(API.user()||{}).id?`<button class="btn sm ghost" data-role="${esc(u.id)}">${u.role==="admin"?"Quitar admin":"Hacer admin"}</button>`:""}</div></details>
      </div></article>`).join("")||'<div class="muted">Sin resultados.</div>';
    const set=async(id,patch,msg)=>{try{await API.setUser(id,patch);Object.assign(list.find(u=>u.id===id),patch);toast(msg);draw()}catch(x){toast(x.message)}};
    $$("[data-add]").forEach(b=>b.onclick=()=>{const [id,d]=b.dataset.add.split(":");const u=list.find(x=>x.id===id);const base=isP(u)?new Date(u.premium_until):new Date();base.setDate(base.getDate()+(+d));set(id,{premium_until:base.toISOString()},`Premium hasta ${fmtDate(base)}`)});
    $$("[data-give]").forEach(sl=>sl.onchange=()=>{if(!sl.value)return;const [t,d]=sl.value.split(":");const u=list.find(x=>x.id===sl.dataset.give);const base=isP(u)?new Date(u.premium_until):new Date();base.setDate(base.getDate()+(+d));
      set(u.id,{premium_until:base.toISOString(),plan:t},`${u.username}: ${t[0].toUpperCase()+t.slice(1)} hasta ${fmtDate(base)}`)});
    $$("[data-date]").forEach(i=>i.onchange=()=>{if(i.value)set(i.dataset.date,{premium_until:new Date(i.value+"T23:59:00-05:00").toISOString()},"Fecha de premium actualizada")});
    $$("[data-rm]").forEach(b=>b.onclick=()=>set(b.dataset.rm,{premium_until:null},"Premium retirado"));
    $$("[data-plan]").forEach(sl=>{const u=list.find(x=>x.id===sl.dataset.plan);sl.value=u&&u.plan?u.plan:"cobre";sl.onchange=()=>set(sl.dataset.plan,{plan:sl.value},"Placa actualizada")});
    $$("[data-crs]").forEach(b=>b.onclick=async()=>{const [uid,cid,on]=b.dataset.crs.split("|");try{await API.adminGrantCourse(uid,cid,on==="1");const u=list.find(x=>x.id===uid);u.courses=(u.courses||[]).filter(x=>x!==cid);if(on==="1")u.courses.push(cid);toast(on==="1"?"Curso entregado (de por vida)":"Curso retirado");draw()}catch(x){toast(x.message)}});
    $$("[data-ban]").forEach(b=>b.onclick=()=>{const u=list.find(x=>x.id===b.dataset.ban);set(u.id,{banned:!u.banned},u.banned?"Cuenta reactivada":"Cuenta suspendida")});
    $$("[data-demo]").forEach(b=>b.onclick=()=>set(b.dataset.demo,{demo_used:0},"Prueba gratis reiniciada"));
    const reset=(id,what)=>{const u=list.find(x=>x.id===id);const host=$(`[data-rxp="${id}"]`).closest(".uc-menu");
      A.confirmInline(host,what==="puntos"?`¿Dejar en 0 los puntos de ${u.username}? Sus lecciones aprobadas se mantienen.`:`¿Borrar todo el avance de ${u.username}? Lecciones, módulos, puntos, logros y su reseña de módulos. Empieza desde cero.`,
        async()=>{try{await API.adminReset(id,what,what==="todo",false);u.xp=0;toast(what==="puntos"?"Puntos reiniciados":"Avance reiniciado");draw()}catch(x){toast(x.message);draw()}})};
    $$("[data-rxp]").forEach(b=>b.onclick=()=>reset(b.dataset.rxp,"puntos"));
    $$("[data-rall]").forEach(b=>b.onclick=()=>reset(b.dataset.rall,"todo"));
    $$("[data-role]").forEach(b=>b.onclick=()=>{const u=list.find(x=>x.id===b.dataset.role);set(u.id,{role:u.role==="admin"?"user":"admin"},"Rol actualizado")})};
  H().innerHTML=`<div class="panel"><div class="sec-h"><h3>Alumnos (${list.length})</h3><span class="muted" id="uPA"></span></div>
    <div class="ufil"><input id="uq" placeholder="Buscar por usuario o correo">
      <select id="uf" aria-label="Filtrar por acceso, plan o curso">${filOpts()}</select>
      <select id="up" aria-label="Filtrar por país"><option value="">Todos los países</option>${[...new Set(list.map(u=>u.country).filter(Boolean))].sort().map(c=>`<option>${esc(c)}</option>`).join("")}<option value="-">Sin país</option></select></div>
    <div id="uchips" class="uchips"></div>
    <div id="uN" class="dim" style="font-size:13px"></div>
    <div id="ut" class="ulist"></div></div>
    <details class="panel reset-all"><summary><b>Reinicio general para el lanzamiento</b><span class="muted">Deja a todos los alumnos en cero sin borrar sus cuentas ni su premium.</span></summary>
      <div class="two"><label for="rgW">Qué reiniciar<select id="rgW"><option value="todo">Todo el avance: lecciones, módulos, puntos, logros y práctica</option><option value="puntos">Solo los puntos (y el ranking); se mantienen las lecciones aprobadas</option></select></label>
        <div style="display:grid;gap:8px;align-content:start"><label class="chk"><input type="checkbox" id="rgF" checked> Borrar también las reseñas de módulos</label><label class="chk"><input type="checkbox" id="rgD"> Devolver las 5 gráficas de prueba gratis</label></div></div>
      <div class="row"><input id="rgC" placeholder="Escribe REINICIAR para confirmar" autocomplete="off" style="background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:10px 12px;color:var(--fg)"><button class="btn bad" id="rgGo">Reiniciar a todos</button></div>
      <p class="dim" style="font-size:13px">No se puede deshacer. Las cuentas, el premium, los pagos y las opiniones públicas no se tocan.</p></details>`;
  $("#rgGo").onclick=async()=>{const what=$("#rgW").value;
    if($("#rgC").value.trim().toUpperCase()!=="REINICIAR"){toast("Escribe REINICIAR para confirmar");$("#rgC").focus();return}
    try{busy($("#rgGo"),true);const n=await API.adminReset(null,what,$("#rgF").checked,$("#rgD").checked);toast(`Listo: ${n} alumno${n===1?"":"s"} reiniciado${n===1?"":"s"}`);A.ROUTES.admin("alumnos")}catch(x){toast(x.message)}finally{busy($("#rgGo"),false)}};
  $("#uq").oninput=()=>{q=$("#uq").value.toLowerCase();draw()};$("#uf").onchange=()=>{fil=$("#uf").value;draw()};$("#up").onchange=()=>{pais=$("#up").value;draw()};draw();
}

/* ---------- cursos y planes ---------- */
async function cursos(){let L=[];try{L=await API.courses()}catch(e){H().innerHTML=`<div class="empty">No se pudieron cargar los cursos. ¿Ya corriste <b>supabase/planes_cursos.sql</b>?<span class="dim">${esc(e.message)}</span></div>`;return}
  const mods=S.modules||[];
  H().innerHTML=`<div class="note">Los suscriptores <b>Cobre, Plata y Oro</b> ven <b>todos</b> los cursos. El curso suelto se compra una vez y es del alumno <b>de por vida</b>. Los precios y los días de Cobre (1 mes), Plata (6 meses) y Oro (12 meses) se editan en <a href="#admin-sitio">Sitio → Planes</a>: el nombre del plan sale de los días (hasta 149 = Cobre, 150-299 = Plata, 300 o más = Oro).</div>
    <div class="split"><div class="panel"><div class="sec-h"><h3>Cursos</h3><button class="btn sm gold" id="ncu">Nuevo curso</button></div>
      <div class="list">${L.map(c=>`<button class="item" data-cu="${esc(c.id)}" style="text-align:left;cursor:pointer"><span class="ico" style="background:${esc(c.color)};color:#fff">${esc(c.icon||"🎓")}</span><span class="txt"><b>${esc(c.title)}</b><span>${c.base?"Gratis con cuenta":esc(c.price||"")} · ${mods.filter(m=>m.course_id===c.id).length} módulos${c.status==="borrador"?" · borrador":""}</span></span></button>`).join("")||'<div class="muted">Aún no hay cursos.</div>'}</div></div>
    <div class="panel" id="cue"><div class="muted">Elige un curso o crea uno nuevo.</div></div></div>`;
  const edit=c=>{$("#cue").innerHTML=`<form class="form" id="cuf"><h3>${c.id?"Editar curso":"Nuevo curso"}</h3>
      <label for="cuT">Nombre<input id="cuT" maxlength="80" value="${esc(c.title||"")}" placeholder="Ej.: Step Index"></label>
      <div class="three"><label for="cuI">Icono<input id="cuI" maxlength="4" value="${esc(c.icon||"🎓")}"></label><label for="cuC">Color de la placa<input id="cuC" type="color" value="${esc(c.color||"#5b8cff")}"></label><label for="cuP">Precio<input id="cuP" maxlength="30" value="${esc(c.price||"40 USD")}"></label></div>
      <label for="cuD">Descripción<textarea id="cuD" maxlength="400" style="min-height:70px">${esc(c.descr||"")}</textarea></label>
      <div class="two"><label for="cuS">Estado<select id="cuS"><option value="publicado">Publicado (se vende)</option><option value="borrador">Borrador (no se ve)</option></select></label><label for="cuO">Orden<input id="cuO" type="number" value="${c.sort||1}"></label></div>
      <label class="chk"><input type="checkbox" id="cuB" ${c.base?"checked":""}> <b>Curso gratis</b>: completo para cualquier cuenta registrada y no se vende (como Fundamentos del trading)</label>
      <p class="dim" style="margin:0">Vista de la placa: <span class="crs-tag" id="cuPrev" style="--cc:${esc(c.color||"#5b8cff")}">${esc(c.icon||"🎓")} ${esc(c.title||"Curso")}</span> · Para meter módulos en este curso, ábrelos en <a href="#admin-contenido">Módulos y lecciones</a> y elige el curso.</p>
      <div class="row"><button class="btn gold" id="cuSv">Guardar curso</button>${c.id?`<span id="cuDl"><button type="button" class="btn sm bad" id="cuDb">Eliminar</button></span>`:""}</div></form>`;
    $("#cuS").value=c.status||"publicado";const pv=()=>{const b=$("#cuPrev");b.style.setProperty("--cc",$("#cuC").value);b.textContent=($("#cuI").value||"🎓")+" "+($("#cuT").value||"Curso")};["cuT","cuI","cuC"].forEach(k=>$("#"+k).oninput=pv);
    $("#cuf").onsubmit=async e=>{e.preventDefault();const o={title:$("#cuT").value.trim(),icon:$("#cuI").value.trim()||"🎓",color:$("#cuC").value,price:$("#cuP").value.trim()||"40 USD",descr:$("#cuD").value.trim(),status:$("#cuS").value,sort:+$("#cuO").value||1};if($("#cuB").checked||c.base!=null)o.base=$("#cuB").checked;if(c.id)o.id=c.id;
      if(o.title.length<2){toast("Ponle nombre al curso");return}try{busy($("#cuSv"),true);await API.saveCourse(o);toast("Curso guardado");await A.loadContent();cursos()}catch(x){toast(x.message)}finally{const b=$("#cuSv");if(b)busy(b,false)}};
    const d=$("#cuDb");if(d)d.onclick=()=>A.confirmInline($("#cuDl"),"¿Eliminar el curso? Sus módulos quedan sin curso y los alumnos que lo compraron lo pierden.",async()=>{await API.delCourse(c.id);toast("Curso eliminado");await A.loadContent();cursos()})};
  $("#ncu").onclick=()=>edit({});$$("[data-cu]").forEach(b=>b.onclick=()=>edit(L.find(c=>c.id===b.dataset.cu)));
}

/* ---------- archivos ---------- */
async function archivos(){
  H().innerHTML=`<div class="panel"><div class="sec-h"><h3>Archivos</h3><label class="btn sm gold" for="fa" style="cursor:pointer">Subir archivo</label><input id="fa" type="file" hidden></div><p class="muted">Sube imágenes o videos y copia su enlace para usarlos en banners, lecciones o noticias.</p><div id="fl" class="muted">Cargando…</div></div>`;
  const load=async()=>{let fs=[];try{fs=await API.files()}catch(e){}
    $("#fl").innerHTML=fs.length?`<div class="scroll"><table class="tbl"><thead><tr><th>Archivo</th><th style="text-align:right">Tamaño</th><th>Enlace</th></tr></thead><tbody>${fs.map(f=>`<tr><td>${esc(f.name)}</td><td class="n">${f.size?(f.size/1048576).toFixed(2)+" MB":"—"}</td><td><button class="btn sm" data-cp="${esc(f.url)}">Copiar enlace</button></td></tr>`).join("")}</tbody></table></div>`:"Aún no has subido archivos.";
    $$("[data-cp]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.cp);toast("Enlace copiado")}catch(e){toast("No se pudo copiar")}})};
  $("#fa").onchange=async e=>{const f=e.target.files[0];if(!f)return;toast("Subiendo…");try{await API.upload(f);toast("Archivo subido");load()}catch(x){toast(x.message)}};load();
}
})();
