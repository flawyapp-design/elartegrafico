/* El Arte Gráfico Academy — aplicación (vanilla JS, sin compilación). */
(function(){
"use strict";
const API=window.AGAPI, CFG=window.AG_CONFIG||{}, Chart=window.AGChart;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TZ=-5*3600;
const fmtT=t=>new Date((t+TZ)*1000).toISOString().slice(0,16).replace("T"," ");
const fmtDate=s=>{if(!s)return"—";const d=new Date(s);return d.toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"})};
const fmtDT=s=>{if(!s)return"—";const d=new Date(s);return d.toLocaleString("es-CO",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})};
const todayKey=()=>new Date(Date.now()+TZ*1000).toISOString().slice(0,10);
const MARKETS=["B1000","B900","B600","B500","B300","C1000","C900","C600","C500","C300"];
const MNAME={B1000:"Boom 1000",B900:"Boom 900",B600:"Boom 600",B500:"Boom 500",B300:"Boom 300",C1000:"Crash 1000",C900:"Crash 900",C600:"Crash 600",C500:"Crash 500",C300:"Crash 300"};
const LEVELS=[[0,"Nivel 1 · Fundamentos"],[150,"Nivel 2 · Analista"],[400,"Nivel 3 · Operador"],[900,"Nivel 4 · Estratega"],[1800,"Nivel 5 · Maestro"]];
const levelOf=xp=>{let i=0;LEVELS.forEach((l,k)=>{if(xp>=l[0])i=k});const n=LEVELS[i+1];return{i,name:LEVELS[i][1],from:LEVELS[i][0],to:n?n[0]:null}};
const ACH=[{id:"primera",t:"Primera operación correcta"},{id:"diez",t:"10 aciertos"},{id:"racha5",t:"5 aciertos seguidos"},{id:"constancia",t:"3 días seguidos practicando"},{id:"leccion",t:"Primera lección aprobada"},{id:"modulo",t:"Primer módulo completo"},{id:"paciencia",t:"Supo no operar"},{id:"cien",t:"100 ejercicios"}];

const S={site:{},user:null,prof:null,modules:[],lindex:[],prog:null,loaded:false,fb:new Set(),fbOff:false};
const blankProg=()=>({xp:0,done:{},streak:0,lastDay:"",practice:{n:0,ok:0,row:0,best:0},ach:[],px:[]});
/* cada ejercicio da puntos solo la primera vez (repetirlo no suma más) */
function exXP(ex,pts){if(!pts||!ex)return;S.prog.px=S.prog.px||[];const k=ex.id||"";if(k&&S.prog.px.includes(k))return;if(k){S.prog.px.push(k);if(S.prog.px.length>3000)S.prog.px=S.prog.px.slice(-3000)}addXP(pts)}
const premium=()=>API.isPremium(), admin=()=>API.isAdmin(), logged=()=>!!API.user();
/* ---------- dos sitios con el mismo código: elartegrafico.com (principal) y academia.elartegrafico.com ---------- */
const HOST=location.hostname,PROD=/(^|\.)elartegrafico\.com$/.test(HOST);
const SITE=PROD?(/^academia\./.test(HOST)?"academia":"main"):(new URLSearchParams(location.search).get("sitio")==="academia"?"academia":"main");
const ACAD=SITE==="academia";
function link(site,hash){hash=hash||"inicio";if(site===SITE)return"#"+hash;
  if(PROD){const base=HOST.replace(/^(www\.|academia\.)/,"");return"https://"+(site==="academia"?"academia.":"")+base+"/#"+hash}
  return location.pathname+(site==="academia"?"?sitio=academia":"")+"#"+hash}
const ACAD_R=new Set(["academia","modulo","leccion","practica","prueba","ranking"]);
const MAIN_R=new Set(["entrar","registro","recuperar","noticias","comunidad","nota","opiniones","mercados","legal","terminos","privacidad"]);
const toAcad=h=>link("academia",h),toMain=h=>link("main",h);

/* ---------- utilidades UI ---------- */
let toastT;function toast(m){let t=$(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");document.body.appendChild(t)}t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2800)}
function md(txt){const lines=String(txt||"").split(/\r?\n/);let out="",list=false;
  const inl=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  for(const l of lines){if(/^\s*[-•]\s+/.test(l)){if(!list){out+="<ul>";list=true}out+="<li>"+inl(l.replace(/^\s*[-•]\s+/,""))+"</li>";continue}
    if(list){out+="</ul>";list=false}if(/^\s*\{DERIV\}\s*$/.test(l)){out+=derivBlock();continue}if(/^###\s+/.test(l))out+="<h3>"+inl(l.slice(4))+"</h3>";else if(l.trim())out+="<p>"+inl(l)+"</p>"}
  if(list)out+="</ul>";return out}
/* botón de registro en Deriv con el enlace de socio (se pone en una lección escribiendo {DERIV} en una línea) */
function derivBlock(){const s=S.site||{};const u=(s.derivRefUrl||"").trim();if(!/^https:\/\//.test(u))return"";
  return `<div class="deriv-ref"><a class="btn gold" href="${esc(u)}" target="_blank" rel="noopener sponsored">${esc(s.derivRefText||"Abrir mi cuenta en Deriv")}</a>
  <p class="dim">${esc(s.derivRefNote||"Enlace de socio: si abres tu cuenta con este enlace, Deriv le paga una comisión a El Arte Gráfico. A ti no te cuesta nada extra. Puedes abrir tu cuenta sin el enlace si prefieres.")}</p></div>`}
/* foto de perfil: imagen o inicial */
const avatar=(o,sz=32,cls="")=>{o=o||{};const n=(o.username||"?")[0].toUpperCase();
  return o.avatar_url?`<img class="avi ${cls}" src="${esc(o.avatar_url)}" alt="" width="${sz}" height="${sz}" style="width:${sz}px;height:${sz}px" loading="lazy">`
    :`<span class="avi ini ${cls}" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz*.42)}px" aria-hidden="true">${esc(n)}</span>`};
const ISO={"Colombia":"co","México":"mx","Argentina":"ar","Chile":"cl","Perú":"pe","Ecuador":"ec","Venezuela":"ve","Bolivia":"bo","Uruguay":"uy","Paraguay":"py","Panamá":"pa","Costa Rica":"cr","Guatemala":"gt","Honduras":"hn","El Salvador":"sv","Nicaragua":"ni","República Dominicana":"do","Puerto Rico":"pr","Cuba":"cu","España":"es","Estados Unidos":"us"};
const flag=c=>{const k=ISO[c];return k?`<img class="flag" src="https://flagcdn.com/w40/${k}.png" srcset="https://flagcdn.com/w80/${k}.png 2x" width="22" height="16" alt="" title="${esc(c)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;flag-t&quot; title=&quot;${esc(c)}&quot;>${k.toUpperCase()}</span>'">`:""};
const premTag=()=>'<span class="prem-tag" title="Alumno premium"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>Premium</span>';
const COUNTRIES=["Colombia","México","Argentina","Chile","Perú","Ecuador","Venezuela","Bolivia","Uruguay","Paraguay","Panamá","Costa Rica","Guatemala","Honduras","El Salvador","Nicaragua","República Dominicana","Puerto Rico","Cuba","España","Estados Unidos","Otro"];
/* ---------- completar perfil: foto y país (paso a paso) ---------- */
function onboard(){
  const p=API.profile();if(!p||!logged()||admin()||$("#onb"))return;
  let skipFoto=false;try{skipFoto=sessionStorage.getItem("ag_onb_foto")==="1"}catch(e){}
  const needC=!p.country,needF=!p.avatar_url&&!skipFoto;if(!needC&&!needF)return;
  const steps=[...(needF?["foto"]:[]),...(needC?["pais"]:[]),"listo"];let k=0,av=p.avatar_url||"",pais=p.country||"";
  const el=document.createElement("div");el.id="onb";el.className="onb";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-labelledby","onbT");
  document.body.appendChild(el);document.body.classList.add("noscroll");
  const fin=()=>{el.remove();document.body.classList.remove("noscroll");renderNav()};
  const save=async()=>{await API.updateMyProfile({avatar_url:av,bio:p.bio||"",country:pais})};
  const draw=()=>{const st=steps[k],tot=steps.length-1;
    const dots=`<div class="onb-dots">${steps.slice(0,-1).map((_,i)=>`<i class="${i<k?"ok":i===k?"on":""}"></i>`).join("")}</div>`;
    if(st==="foto")el.innerHTML=`<div class="onb-card">${dots}<span class="eyebrow">Paso ${k+1} de ${tot} · Completa tu perfil</span><h2 id="onbT">Pon tu foto</h2>
      <p class="muted">Así te reconocen en el ranking, en los comentarios y en las opiniones.</p>
      <label class="onb-av" for="onbF" title="Subir foto">${avatar({username:p.username,avatar_url:av},128)}<span class="onb-cam" aria-hidden="true">+</span></label><input id="onbF" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      <div class="onb-act"><label class="btn gold" for="onbF" style="cursor:pointer">Subir mi foto</label><button type="button" class="btn ghost" id="onbS">Ahora no</button></div></div>`;
    else if(st==="pais")el.innerHTML=`<div class="onb-card">${dots}<span class="eyebrow">Paso ${k+1} de ${tot} · Completa tu perfil</span><h2 id="onbT">¿Desde qué país operas?</h2>
      <p class="muted">Tu bandera sale junto a tu nombre en el ranking.</p>
      <div class="onb-cs">${COUNTRIES.filter(c=>c!=="Otro").map(c=>`<button type="button" class="${pais===c?"on":""}" data-c="${esc(c)}">${flag(c)}<span>${esc(c)}</span></button>`).join("")}<button type="button" data-c="Otro" class="${pais==="Otro"?"on":""}"><span class="flag-t">🌎</span><span>Otro</span></button></div>
      <div class="onb-act"><button type="button" class="btn gold" id="onbN" ${pais?"":"disabled"}>Continuar</button></div></div>`;
    else el.innerHTML=`<div class="onb-card">${dots}<span class="eyebrow">¡Listo!</span><h2 id="onbT">Así te ven los demás</h2>
      <div class="onb-prev">${avatar({username:p.username,avatar_url:av},44)}<b>${esc(p.username)}</b>${flag(pais)}${premium()?premTag():""}<span class="mono dim">${(S.prog&&S.prog.xp)||0} pts</span></div>
      <p class="muted">Puedes cambiar tu foto y tu país cuando quieras en Configuración.</p>
      <div class="onb-act"><button type="button" class="btn gold" id="onbX">Empezar</button></div></div>`;
    const f=$("#onbF",el);if(f)f.onchange=async e=>{const fl=e.target.files[0];if(!fl)return;try{toast("Subiendo foto…");av=await API.uploadAvatar(await squareImage(fl));await save();toast("Foto lista");k++;draw()}catch(x){toast(x.message)}};
    if($("#onbS",el))$("#onbS",el).onclick=()=>{try{sessionStorage.setItem("ag_onb_foto","1")}catch(e){}if(!needC){fin();return}k++;draw()};
    $$("[data-c]",el).forEach(b=>b.onclick=()=>{pais=b.dataset.c;$$("[data-c]",el).forEach(x=>x.classList.toggle("on",x===b));$("#onbN",el).disabled=false});
    if($("#onbN",el))$("#onbN",el).onclick=async()=>{if(!pais)return;try{busy($("#onbN",el),true);await save();k++;draw()}catch(x){toast(x.message)}finally{const b=$("#onbN",el);if(b)busy(b,false)}};
    if($("#onbX",el))$("#onbX",el).onclick=()=>{fin();route(true)};
    const first=$("button:not([disabled]),label.btn",el);if(first)first.focus()};
  draw();
}
async function squareImage(file,size=320){const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("No se pudo leer la imagen"));i.src=URL.createObjectURL(file)});
  const m=Math.min(img.naturalWidth,img.naturalHeight),c=document.createElement("canvas");c.width=c.height=size;const x=c.getContext("2d");
  x.drawImage(img,(img.naturalWidth-m)/2,(img.naturalHeight-m)/2,m,m,0,0,size,size);URL.revokeObjectURL(img.src);
  return await new Promise(ok=>c.toBlob(b=>ok(b),"image/webp",.86))}
const stars=n=>"★★★★★".slice(0,Math.round(n||0))+"☆☆☆☆☆".slice(0,5-Math.round(n||0));
const busy=(btn,on,txt)=>{if(!btn)return;if(on){btn.dataset.t=btn.textContent;btn.textContent=txt||"Procesando…";btn.disabled=true}else{btn.textContent=btn.dataset.t||btn.textContent;btn.disabled=false}};
function confirmInline(host,msg,onYes){const prev=host.innerHTML;host.innerHTML=`<span class="confirm"><span>${esc(msg)}</span><button class="btn sm bad" type="button" data-y>Sí</button><button class="btn sm" type="button" data-n>Cancelar</button></span>`;
  $("[data-n]",host).onclick=()=>{host.innerHTML=prev;bindLater&&bindLater()};$("[data-y]",host).onclick=onYes}
let bindLater=null;

/* ---------- progreso ---------- */
let saveT=null;
function saveProg(){try{localStorage.setItem("ag_prog_"+(API.user()||{id:"anon"}).id,JSON.stringify(S.prog))}catch(e){}renderNav();clearTimeout(saveT);saveT=setTimeout(()=>{if(logged())API.progressSave(S.prog.xp,S.prog).catch(()=>{})},800)}
async function loadProg(){S.prog=blankProg();S.fb=new Set();if(!logged())return;
  API.myFeedback().then(r=>{S.fb=new Set((r||[]).map(x=>x.module_id));S.fbOff=false}).catch(()=>{S.fbOff=true});try{const r=await API.progressGet();if(r&&r.data)S.prog=Object.assign(blankProg(),r.data,{xp:r.xp||r.data.xp||0})}catch(e){}}
function ach(id){if(!S.prog.ach.includes(id)){S.prog.ach.push(id);const a=ACH.find(x=>x.id===id);if(a)setTimeout(()=>toast("Logro: "+a.t),700)}}
function addXP(n){S.prog.xp=(S.prog.xp||0)+n;const d=todayKey();if(S.prog.lastDay!==d){const y=new Date(Date.now()+TZ*1000-864e5).toISOString().slice(0,10);S.prog.streak=S.prog.lastDay===y?(S.prog.streak||0)+1:1;S.prog.lastDay=d;if(S.prog.streak>=3)ach("constancia")}saveProg()}
function registerAnswer(kind,res){const p=S.prog.practice;p.n++;if(res==="ok"){p.ok++;p.row++;ach("primera");if(kind==="no-operar")ach("paciencia")}else p.row=0;p.best=Math.max(p.best,p.row);if(p.ok>=10)ach("diez");if(p.row>=5)ach("racha5");if(p.n>=100)ach("cien");saveProg()}

/* ---------- navegación ---------- */
const app=$("#app");let cleanup=[];
function clear(){cleanup.forEach(f=>{try{f()}catch(e){}});cleanup=[];const n=document.getElementById("admNote");if(n)n.remove()}
const closedAcad=()=>!!(S.site&&S.site.academyClosed);
/* módulo disponible: a mano (available) o por fecha (open_at). Sin la columna (SQL viejo) se considera abierto. */
function modOpen(m,ignoreAdmin){if(!m)return false;if(!ignoreAdmin&&admin())return true;if(m.available!==false)return true;return !!(m.open_at&&new Date(m.open_at)<=new Date())}
/* orden obligatorio: con «Exige terminar el módulo anterior», el módulo se abre al aprobar todo el anterior
   y dentro del módulo cada lección se abre al aprobar la anterior (puntaje mínimo de la lección). El admin no tiene bloqueos. */
function passedL(id){return !!(S.prog&&S.prog.done[id]&&S.prog.done[id].passed)}
/* módulo anterior que cuenta para el orden: los módulos opcionales no bloquean a los siguientes */
function prevReq(m){const i=S.modules.indexOf(m);for(let k=i-1;k>=0;k--){if(!S.modules[k].optional)return S.modules[k]}return null}
/* reseña obligatoria: al terminar un módulo hay que dejar la reseña para abrir el siguiente */
function needFb(m){return !!(m&&!admin()&&!S.fbOff&&logged()&&m.ask_feedback!==false&&modProgress(m.id)>=1&&!S.fb.has(m.id))}
function modLocked(m){if(admin())return false;const prev=prevReq(m);if(!prev)return false;if(needFb(prev))return true;return !!(m.locked&&modProgress(prev.id)<1)}
const fbCard=m=>`<div class="fb-card"><div><span class="eyebrow">¡Terminaste “${esc(m.title)}”!</span><b>Cuéntanos cómo te pareció</b><span class="muted">Tu reseña nos ayuda a mejorar la academia. Es obligatoria para abrir el siguiente módulo y te toma un minuto.</span></div><a class="btn gold" href="#resena-${esc(m.id)}">Dejar mi reseña</a></div>`;
function lessonOpen(l){if(admin())return true;const m=S.modules.find(x=>x.id===l.module_id);if(!m||!modOpen(m)||modLocked(m))return false;if(!m.locked||m.optional)return true;
  const ls=S.lindex.filter(x=>x.module_id===l.module_id);const k=ls.findIndex(x=>x.id===l.id);return ls.slice(0,Math.max(0,k)).every(x=>passedL(x.id))}
function modState(m){if(modOpen(m,true))return"Disponible";return m.open_at?"Abre el "+new Date(m.open_at).toLocaleDateString("es-CO",{day:"2-digit",month:"short"}):"Próximamente"}
function closedView(){const s=S.site,p=API.profile()||{};
  app.innerHTML=`<section class="soon"><img src="${esc(s.logoFullUrl||"assets/logo_circle.png")}" alt=""><span class="eyebrow">Academia</span>
    <h1>${esc(s.closedTitle||"La academia abre muy pronto")}</h1>
    <p class="muted">${esc(s.closedText||"Estamos terminando de montar las lecciones y los ejercicios. Tu cuenta ya quedó creada: cuando abramos, entras con el mismo usuario y tendrás tus 5 gráficas de prueba.")}</p>
    ${p.username?`<span class="pill ok">Registrado como ${esc(p.username)}</span>`:""}
    <div class="row" style="justify-content:center"><a class="btn gold" href="${toMain("inicio")}">Volver a El Arte Gráfico</a>${s.discordUrl?`<a class="btn ghost" href="${esc(s.discordUrl)}" target="_blank" rel="noopener">Unirme al Discord</a>`:`<a class="btn ghost" href="${toMain("comunidad")}">Ver la comunidad</a>`}</div></section>`}
/* ---------- modo claro / oscuro ---------- */
function getTheme(){return document.documentElement.getAttribute("data-theme")==="light"?"light":"dark"}
function setTheme(t){const r=document.documentElement;if(t==="light")r.setAttribute("data-theme","light");else r.removeAttribute("data-theme");
  try{localStorage.setItem("ag_theme",t)}catch(e){}const m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute("content",t==="light"?"#f4f6fb":"#060b1a");
  const b=$("#themeBtn");if(b){b.setAttribute("aria-label",t==="light"?"Cambiar a modo oscuro":"Cambiar a modo claro")}
  window.dispatchEvent(new Event("ag-theme"))}
document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("#themeBtn"))setTheme(getTheme()==="light"?"dark":"light")});
function renderNav(){document.body.classList.toggle("is-acad",!!ACAD);
  let r=(location.hash||"#inicio").slice(1).split("-")[0];if(r==="noticias"||r==="nota")r="comunidad";
  const L=ACAD?[["inicio","Mi panel"],["academia","Temario"],["practica","Práctica"],["ranking","Ranking"]].concat(premium()?[]:[["prueba","Prueba gratis"]])
             :[["inicio","Inicio"],["comunidad","Comunidad"],["opiniones","Opiniones"],["mercados","Mercados"],["premium","Premium"]];
  if(ACAD&&closedAcad()&&!admin())L.length=0;
  const u=API.user(),p=API.profile();const lv=levelOf((S.prog&&S.prog.xp)||0);
  const other=ACAD?`<a class="navx" href="${toMain("inicio")}">El Arte Gráfico ↗</a>`:(u&&p?`<a class="btn sm gold navacad" href="${toAcad("inicio")}">Ir a la academia</a>`:"");
  const NI={inicio:"home",comunidad:"chat",opiniones:"star",mercados:"chart",premium:"crown",academia:"acad",practica:"chart",ranking:"trophy",prueba:"play"};
  const msw=`<div class="mnav-sw" role="group" aria-label="Elige sección"><a class="${ACAD?"":"on"}" href="${ACAD?toMain("inicio"):"#inicio"}"${ACAD?"":' aria-current="true"'}>${ico("home",20)}<span><b>El Arte Gráfico</b><small>Comunidad y noticias</small></span></a><a class="${ACAD?"on":""}" href="${ACAD?"#inicio":toAcad("inicio")}"${ACAD?' aria-current="true"':""}>${ico("acad",20)}<span><b>Academia</b><small>Lecciones y práctica</small></span></a></div>
    <div class="mnav-here"><i></i>Estás en ${ACAD?"<b>la Academia</b>":"<b>El Arte Gráfico</b>"}</div>`;
  const mus=u&&p?`<div class="mnav-user"><a class="mnu-me" href="#perfil">${avatar(p,40)}<span><b>${esc(p.username)}</b><small>${esc(lv.name)} · ${S.prog?S.prog.xp:0} pts</small></span>${premium()?premTag():""}</a>
      <div class="mnu-links"><a href="#perfil">${ico("gear",18)}Configuración</a>${premium()?"":`<a href="${toMain("premium")}">${ico("crown",18)}Hazte premium</a>`}${admin()?`<a href="${toMain("admin")}">${ico("news",18)}Administración</a>`:""}<button type="button" id="logout2">Cerrar sesión</button></div></div>`
    :`<div class="mnav-user"><div class="mnu-links two"><a class="btn ghost" href="${toMain("entrar")}">Ingresar</a><a class="btn gold" href="${toMain("registro")}">Crear cuenta</a></div></div>`;
  $("#nav").innerHTML=msw+L.map(([k,t])=>`<a href="#${k}" class="${r===k?"on":""}"><span class="mi">${ico(NI[k]||"news",20)}</span>${t}</a>`).join("")+other+mus+
    (u&&p?`<div class="dd" id="dd"><button aria-haspopup="true" aria-expanded="false" id="ddb">${avatar(p,28)}<span>${esc(p.username)}</span>${premium()?'<span class="prem-badge">Premium</span>':""}</button>
      <div class="menu" hidden>
        <a class="dm-head" href="#perfil">${avatar(p,46)}<span class="dm-id"><b>${esc(p.username)} ${flag(p.country||"")}</b><small>${esc(p.email||"")}</small></span></a>
        <div class="dm-lv"><div class="dm-lvr"><span>${premium()?premTag():'<span class="tag">Cuenta gratis</span>'}<span class="dim">${esc(lv.name)}</span></span><b class="mono">${S.prog?S.prog.xp:0} pts</b></div>
          <div class="bar"><i style="width:${lv.to?Math.round(100*(((S.prog&&S.prog.xp)||0)-lv.from)/(lv.to-lv.from)):100}%"></i></div></div>
        <div class="dm-items">
          <a href="${ACAD?"#perfil":"#perfil"}">${ico("gear",18)}<span>Configuración</span></a>
          <a href="${ACAD?"#perfil-progreso":"#perfil-progreso"}">${ico("chart",18)}<span>Mi progreso</span></a>
          <a href="${ACAD?"#ranking":toAcad("ranking")}">${ico("trophy",18)}<span>Ranking</span></a>
          ${premium()?"":`<a href="${toMain("premium")}" class="dm-gold">${ico("crown",18)}<span>Hazte premium</span></a>`}
          ${isStandalone()?"":`<button type="button" id="ddInst">${ico("play",18)}<span>Instalar la app</span></button>`}
          ${admin()?`<a href="${toMain("admin")}">${ico("news",18)}<span>Administración</span></a>`:""}
        </div>
        <button id="logout" class="dm-out">Cerrar sesión</button></div></div>`
     :`<div class="userbox"><a class="btn sm ghost" href="${toMain("entrar")}">Ingresar</a><a class="btn sm gold" href="${toMain("registro")}">Crear cuenta</a></div>`);
  const dd=$("#dd");if(dd){const b=$("#ddb"),m=$(".menu",dd);b.onclick=e=>{e.stopPropagation();m.hidden=!m.hidden;b.setAttribute("aria-expanded",String(!m.hidden))};document.addEventListener("click",()=>{m.hidden=true},{once:true});
    const di=$("#ddInst");if(di)di.onclick=e=>{e.stopPropagation();m.hidden=true;installApp()};
    const lo2=$("#logout2");if(lo2)lo2.onclick=()=>$("#logout").click();
    $("#logout").onclick=async()=>{await API.signOut();S.prog=blankProg();toast("Sesión cerrada");if(ACAD){location.href=toMain("inicio");return}location.hash="#inicio";renderNav();route()}}
}
$("#menuBtn").onclick=()=>{const o=$("#nav").classList.toggle("open");$("#menuBtn").setAttribute("aria-expanded",String(o))};
function renderFoot(){const s=S.site;
  $("#foot").innerHTML=`${s.discordUrl?`<div class="fjoin"><div><b>Únete a la comunidad</b><span class="muted">Análisis, dudas y avisos del método, junto a otros traders que operan con reglas.</span></div><a class="btn gold btn-ic" href="${esc(s.discordUrl)}" target="_blank" rel="noopener">${ICON_CHAT}<span>Entrar al Discord</span></a></div>`:""}
    <div class="fcols"><div class="fbrand"><img src="${esc(s.logoUrl||"assets/logo_mark.png")}" alt=""><div><b>${esc(s.name||"El Arte Gráfico")}</b><span>${esc(s.tagline||"")}</span></div></div>
    <div><h4>El Arte Gráfico</h4><a href="${toMain("inicio")}">Inicio</a><a href="${toMain("comunidad")}">Comunidad</a><a href="${toMain("opiniones")}">Opiniones</a>${s.discordUrl?`<a href="${esc(s.discordUrl)}" target="_blank" rel="noopener">Discord</a>`:""}</div>
    <div><h4>Academia</h4><a href="${toAcad("inicio")}">Mi panel</a><a href="${toAcad("academia")}">Temario</a><a href="${toAcad("practica")}">Práctica</a><a href="#premium">Premium</a></div>
    <div><h4>Mercados</h4><a href="${toMain("mercados")}">Sintéticos</a><a href="${toMain("mercados")}">Forex</a><a href="${toMain("mercados")}">Metales</a></div>
    <div><h4>Contacto</h4>${s.contact?`<span class="sel">${esc(s.contact)}</span>`:'<span class="dim">Pronto</span>'}${(s.social||"").split(/\n/).filter(Boolean).map(l=>{const [t,u]=l.split("|").map(x=>x.trim());return u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`:""}).join("")}</div></div>
    <nav class="legal-links" aria-label="Legal">${(window.AG_LEGAL||[]).map(d=>`<a href="${toMain("legal-"+d.key)}">${esc(d.title)}</a>`).join("")}</nav>
    <p class="legal">${esc(s.legal||"Contenido educativo. Operar instrumentos financieros implica alto riesgo. No es asesoría financiera.")}</p>
    <p class="dim">© ${new Date().getFullYear()} ${esc(s.name||"El Arte Gráfico")}. Todos los derechos reservados.</p>`}

let sid;try{sid=sessionStorage.getItem("ag_sid")||Math.random().toString(36).slice(2,12);sessionStorage.setItem("ag_sid",sid)}catch(e){sid=Math.random().toString(36).slice(2,12)}
const ROUTES={};
function route(keep){
  clear();$("#nav").classList.remove("open");const h=(location.hash||"#inicio").slice(1)||"inicio";if(keep!==true)window.scrollTo(0,0);
  const [k,...rest]=h.split("-");const arg=rest.join("-");
  if(!ACAD&&ACAD_R.has(k)){location.href=toAcad(h);return}
  if(ACAD&&MAIN_R.has(k)){location.href=toMain(h);return}
  if(ACAD&&!logged()&&k!=="nueva"&&k!=="ranking"){location.replace(toMain("entrar-academia"));return}
  renderNav();
  if(ACAD&&closedAcad()&&k!=="nueva"&&k!=="perfil"){if(!admin()){API.logView(sid,"academia/cerrada");closedView();return}
    $("#app").insertAdjacentHTML("beforebegin",'<div class="note admin-note" id="admNote">La academia está <b>cerrada para alumnos</b>: solo tú la ves. Ábrela desde Administración cuando el contenido esté listo.</div>')}
  API.logView(sid,((ACAD?"academia/":"")+h).slice(0,60));
  (ROUTES[k]||ROUTES.inicio)(arg);
  if(!["perfil","nueva","legal","entrar","registro"].includes(k))setTimeout(onboard,700);
}
window.addEventListener("hashchange",()=>route());

/* ---------- datos de mercado ---------- */
const cache={};
async function getJSON(u){if(cache[u])return cache[u];const r=await fetch(u);if(!r.ok)throw new Error("No se pudieron cargar las velas");cache[u]=await r.json();return cache[u]}
async function h1Bars(code){const j=await getJSON(`data/h1/${code}.json`);if(!j._bars){j._bars=j.dt.map((d,i)=>({t:j.t0+d*3600,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i]}))}return{bars:j._bars,dec:j.dec}}
async function m5Bars(code,from,to){const out=[];let dec=2;const d=new Date(from*1000);d.setUTCDate(1);d.setUTCHours(0,0,0,0);
  while(d.getTime()/1000<=to){const per=d.toISOString().slice(0,7);try{const j=await getJSON(`data/m5/${code}/${per}.json`);dec=j.dec;for(let i=0;i<j.dt.length;i++){const t=j.t0+j.dt[i]*300;if(t>=from&&t<=to)out.push({t,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i]})}}catch(e){}d.setUTCMonth(d.getUTCMonth()+1)}
  return{bars:out,dec}}
const idxAt=(bars,t)=>{let lo=0,hi=bars.length-1,a=-1;while(lo<=hi){const m=(lo+hi)>>1;if(bars[m].t<=t){a=m;lo=m+1}else hi=m-1}return a};
const avgRange=(bars,i,n=20)=>{let s=0,k=0;for(let j=Math.max(0,i-n+1);j<=i;j++){s+=bars[j].h-bars[j].l;k++}return k?s/k:1};
const toC=bars=>bars.map(x=>({time:x.t+TZ,open:x.o,high:x.h,low:x.l,close:x.c}));

/* ---------- captcha (Turnstile si hay clave; si no, captcha propio) ---------- */
function captcha(host){
  if(CFG.TURNSTILE_SITE_KEY){let token="";host.innerHTML='<div class="ts"></div>';
    const go=()=>{try{window.turnstile.render($(".ts",host),{sitekey:CFG.TURNSTILE_SITE_KEY,theme:"dark",language:"es",callback:t=>token=t,"expired-callback":()=>token=""})}catch(e){}};
    if(window.turnstile)go();else{const s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";s.onload=go;document.head.appendChild(s)}
    return{ok:()=>!!token,token:()=>token,reset:()=>{try{window.turnstile.reset()}catch(e){}token=""}}}
  let code="";const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  host.innerHTML=`<div class="captcha"><canvas width="150" height="46" aria-label="Código de verificación"></canvas><input id="capIn" maxlength="5" autocomplete="off" placeholder="Escribe el código" aria-label="Escribe el código de la imagen" style="text-transform:uppercase"><button type="button" class="btn sm ghost" title="Otro código">↻</button></div>`;
  const cv=$("canvas",host),cx=cv.getContext("2d");
  const draw=()=>{code=Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join("");cx.fillStyle="#0b1636";cx.fillRect(0,0,150,46);
    for(let i=0;i<6;i++){cx.strokeStyle=`rgba(${120+Math.random()*120},${140+Math.random()*80},255,.35)`;cx.beginPath();cx.moveTo(Math.random()*150,Math.random()*46);cx.bezierCurveTo(Math.random()*150,Math.random()*46,Math.random()*150,Math.random()*46,Math.random()*150,Math.random()*46);cx.stroke()}
    [...code].forEach((c,i)=>{cx.save();cx.translate(18+i*26,30+Math.random()*6-3);cx.rotate((Math.random()-.5)*.6);cx.font=`700 ${22+Math.random()*6}px monospace`;cx.fillStyle=i%2?"#f3d88f":"#c8d0de";cx.fillText(c,0,0);cx.restore()});
    for(let i=0;i<40;i++){cx.fillStyle="rgba(255,255,255,.25)";cx.fillRect(Math.random()*150,Math.random()*46,1.5,1.5)}$("#capIn",host).value=""};
  $("button",host).onclick=draw;draw();
  return{ok:()=>$("#capIn",host).value.trim().toUpperCase()===code,token:()=>null,reset:draw};
}

/* ---------- slider ---------- */
function ctaOf(s){if(!s.cta_text)return'<div class="cta"></div>';let t=s.cta_text,h=s.cta_link||"#registro";
  if(logged()&&/^#(registro|entrar)/.test(h)){t="Ir a la academia";h=toAcad("inicio")}
  return `<div class="cta"><a class="btn gold" href="${esc(h)}">${esc(t)}</a></div>`}
function slider(host,slides,{emblem=true}={}){
  if(!slides.length)slides=[{title:S.site.heroTitle||"El Arte Gráfico Academy",body:S.site.heroText||"",cta_text:"",cta_link:""}];
  host.innerHTML=`<div class="slider" role="region" aria-roledescription="carrusel" aria-label="Destacados">${slides.map((s,i)=>`<div class="slide ${i?"":"on"}" aria-hidden="${i?"true":"false"}">
      ${s.image_url?`<div class="bgimg" style="background-image:url('${esc(s.image_url)}')"></div>`:emblem?`<img class="emblem" src="${esc(S.site.logoFullUrl||"assets/logo_circle.png")}" alt="">`:""}
      <span class="eyebrow">${esc(S.site.name||"El Arte Gráfico")}${ACAD?" · Academy":""}</span><h2>${esc(s.title)}</h2>${s.body?`<p>${esc(s.body)}</p>`:""}
      ${ctaOf(s)}</div>`).join("")}
    ${slides.length>1?`<div class="dots2">${slides.map((_,i)=>`<button aria-label="Ir al destacado ${i+1}" class="${i?"":"on"}" data-i="${i}"></button>`).join("")}</div><div class="sl-arrows"><button aria-label="Anterior" data-d="-1">‹</button><button aria-label="Siguiente" data-d="1">›</button></div>`:""}</div>`;
  if(slides.length<2)return;let k=0;const els=$$(".slide",host),ds=$$(".dots2 button",host);
  const show=i=>{k=(i+els.length)%els.length;els.forEach((e,j)=>{e.classList.toggle("on",j===k);e.setAttribute("aria-hidden",String(j!==k))});ds.forEach((d,j)=>d.classList.toggle("on",j===k))};
  ds.forEach(d=>d.onclick=()=>{show(+d.dataset.i);restart()});$$(".sl-arrows button",host).forEach(b=>b.onclick=()=>{show(k+ +b.dataset.d);restart()});
  let t;const restart=()=>{clearInterval(t);if(!matchMedia("(prefers-reduced-motion: reduce)").matches)t=setInterval(()=>show(k+1),6500)};restart();cleanup.push(()=>clearInterval(t));
}

/* =====================================================================
   VISTAS PÚBLICAS
   ===================================================================== */
ROUTES.inicio=()=>ACAD?academyHome():mainHome();
const ICON_CHAT='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
function discordCode(u){const m=String(u||"").match(/(?:discord\.gg|discord(?:app)?\.com\/invite)\/([\w-]+)/i);return m?m[1]:null}
let discCache=null;async function discordCounts(u){const c=discordCode(u);if(!c)return null;if(discCache)return discCache;
  try{const r=await fetch(`https://discord.com/api/v10/invites/${c}?with_counts=true`);if(!r.ok)return null;const j=await r.json();discCache={members:j.approximate_member_count,online:j.approximate_presence_count,name:j.guild&&j.guild.name};return discCache}catch(e){return null}}
const fmtN=n=>n>=1e6?(n/1e6).toFixed(1).replace(".0","")+"M":n>=1e4?Math.round(n/1e3)+"K":n>=1e3?(n/1e3).toFixed(1).replace(".0","")+"K":String(n);
const statsBand=()=>API.publicStats().then(st=>{if(!$("#stats"))return;$("#stats").innerHTML=[[st.students,"alumnos registrados"],[TEMARIO.length,"módulos en el temario"],[st.exercises,"ejercicios en gráficas reales"],[st.rating?st.rating.toFixed(1)+" / 5":"—",st.reviews?`calificación · ${st.reviews} opiniones`:"calificación"]].map(([v,t])=>`<div><b class="mono">${esc(v??0)}</b><span>${t}</span></div>`).join("")}).catch(()=>{});
const DISC={title:"La comunidad de El Arte Gráfico",text:"Un espacio para traders que operan con reglas: análisis del día, dudas resueltas, avisos del método y acompañamiento entre alumnos.",items:["Análisis y zonas compartidas a diario","Avisos de actualizaciones y nuevas lecciones","Resolución de dudas con el equipo","Comunidad de alumnos que practican el mismo método"]};

/* ---------- bloques del inicio ---------- */
const TEMARIO=[["Bienvenida e introducción",5,"Introducción"],["La plataforma: Deriv y MT5",6,"Básico"],["Velas japonesas",5,"Básico"],["Estructura del mercado",6,"Básico"],
  ["Fractales y zonas",6,"Intermedio"],["Las entradas: Inicio, Punta y Aislada",7,"Intermedio"],["Stop loss en M5 y manejo de la operación",6,"Intermedio"],
  ["Gestión del riesgo",6,"Gestión"],["Psicología y rachas",5,"Gestión"],["Boom y Crash a fondo",6,"Avanzado"],["Tu plan de trading y tu diario",5,"Avanzado"],
  ["Medir tu estrategia con datos",5,"Avanzado"],["Examen final",3,"Evaluación"]];
const ICON_TT='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 4.9 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z"/></svg>';

/* gráfico animado: zona en H1 → stop en M5 → repetición (ilustrativo) */
function demoChart(host){if(!host)return;
  const st=["Marca la zona en H1","Baja a M5 y pon tu stop loss","Mira la repetición vela por vela"];
  host.innerHTML=`<div class="dm-top"><span class="dm-mk">Boom 1000</span><span class="dm-tf"><b data-tf="H1">H1</b><b data-tf="M5">M5</b></span></div><canvas aria-hidden="true"></canvas>
    <ol class="dm-steps">${st.map((t,i)=>`<li data-s="${i}"><i>${i+1}</i>${esc(t)}</li>`).join("")}</ol><span class="dm-note">Ilustración de un ejercicio de la academia</span>`;
  const cv=$("canvas",host),cx=cv.getContext("2d");
  let sd=11;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const pre=[],post=[];let p=100;
  for(let i=0;i<34;i++){const o=p;let c;if(i===8)c=o+3.4+rnd();else if(i===20)c=o+2.6+rnd()*.6;else{c=o-((i>20?.1:.17)+rnd()*.16);if(rnd()<.14)c=o+rnd()*.12}
    pre.push({o,h:Math.max(o,c)+rnd()*.1,l:Math.min(o,c)-rnd()*.1,c});p=c}
  const z=pre[19],zLo=z.l,zHi=z.l+.42,sl=zLo-.38;
  for(let i=0;i<12;i++){const o=p;let c;if(i===7)c=o+2.7;else if(i<7)c=Math.max(zLo+.05,o-(.14+rnd()*.14));else c=o-(.08+rnd()*.1);
    post.push({o,h:Math.max(o,c)+rnd()*.1,l:Math.min(o,c)-rnd()*.08,c});p=c}
  const all=pre.concat(post),lo=Math.min(sl,...all.map(b=>b.l))-.3,hi=Math.max(...all.map(b=>b.h))+.3;
  const ent=post.findIndex(b=>b.l<=zHi),top=Math.max(...post.slice(ent).map(b=>b.h)),R=(top-zHi)/(zHi-sl);
  const T=12,red=matchMedia("(prefers-reduced-motion: reduce)").matches;let raf,t0=performance.now(),W=0,H=0;
  const fit=()=>{const w=cv.clientWidth,h=cv.clientHeight,d=window.devicePixelRatio||1;if(w!==W||h!==H){W=w;H=h;cv.width=w*d;cv.height=h*d;cx.setTransform(d,0,0,d,0,0)}};
  const ease=x=>x<=0?0:x>=1?1:1-Math.pow(1-x,3);
  const frame=now=>{if(!host.isConnected){cancelAnimationFrame(raf);return}fit();const t=red?10:((now-t0)/1000)%T;
    const n=all.length+2,dx=(W-58)/n,Y=v=>58+(hi-v)/(hi-lo)*(H-72),X=i=>8+dx*(i+.5);
    cx.clearRect(0,0,W,H);cx.strokeStyle="rgba(120,140,190,.10)";cx.lineWidth=1;for(let k=1;k<5;k++){const y=k*H/5;cx.beginPath();cx.moveTo(0,y);cx.lineTo(W,y);cx.stroke()}
    const fade=t>11.4?1-(t-11.4)/.6:1;cx.globalAlpha=fade;
    const nPre=Math.ceil(pre.length*ease(t/2)),nPost=t<5.2?0:Math.min(post.length,Math.floor((t-5.2)/3.6*post.length)+1);
    const za=ease((t-2.1)/.8),sa=ease((t-3.7)/.8);
    if(za>0){cx.fillStyle=`rgba(216,176,98,${.16*za})`;cx.fillRect(X(19)-dx/2,Y(zHi),(W-50)-(X(19)-dx/2),Y(zLo)-Y(zHi));cx.strokeStyle=`rgba(216,176,98,${.85*za})`;cx.lineWidth=1.5;cx.strokeRect(X(19)-dx/2,Y(zHi),(W-50)-(X(19)-dx/2),Y(zLo)-Y(zHi))}
    const candle=(b,i)=>{const up=b.c>=b.o,col=up?"#2ec486":"#e84c5c";cx.strokeStyle=col;cx.fillStyle=col;cx.lineWidth=1.2;const x=X(i);cx.beginPath();cx.moveTo(x,Y(b.h));cx.lineTo(x,Y(b.l));cx.stroke();
      const a=Y(Math.max(b.o,b.c)),c=Y(Math.min(b.o,b.c));cx.fillRect(x-dx*.32,a,dx*.64,Math.max(1.5,c-a))};
    pre.slice(0,nPre).forEach(candle);post.slice(0,nPost).forEach((b,i)=>candle(b,pre.length+i));
    if(sa>0){cx.strokeStyle=`rgba(232,76,92,${sa})`;cx.setLineDash([5,4]);cx.lineWidth=1.5;cx.beginPath();cx.moveTo(X(19)-dx/2,Y(sl));cx.lineTo(X(19)-dx/2+((W-50)-(X(19)-dx/2))*sa,Y(sl));cx.stroke();cx.setLineDash([])}
    const tag=(y,txt,bg,fg,a)=>{if(a<=0)return;cx.globalAlpha=fade*a;cx.font="600 11px Inter,system-ui,sans-serif";const w=cx.measureText(txt).width+12;cx.fillStyle=bg;cx.beginPath();cx.roundRect?cx.roundRect(W-w-2,y-9,w,18,5):cx.rect(W-w-2,y-9,w,18);cx.fill();cx.fillStyle=fg;cx.fillText(txt,W-w+4,y+4);cx.globalAlpha=fade};
    tag(Y(zHi)-2,"Zona H1","#d8b062","#1c1404",za);tag(Y(sl)+2,"SL M5","#e84c5c","#fff",sa);
    if(nPost>ent&&ent>=0){const x=X(pre.length+ent),y=Y(zHi);cx.fillStyle="#d8b062";cx.beginPath();cx.arc(x,y,4.5,0,7);cx.fill()}
    const ra=ease((t-9)/.6);if(ra>0){cx.globalAlpha=fade*ra;const txt=`+${R.toFixed(1)} R`;cx.font="800 22px Inter,system-ui,sans-serif";const w=cx.measureText(txt).width+26,x=W/2-w/2,y=16;
      cx.fillStyle="rgba(46,196,134,.16)";cx.strokeStyle="#2ec486";cx.lineWidth=1.5;cx.beginPath();cx.roundRect?cx.roundRect(x,y,w,38,10):cx.rect(x,y,w,38);cx.fill();cx.stroke();cx.fillStyle="#7df0bd";cx.fillText(txt,x+13,y+27);cx.globalAlpha=1}
    cx.globalAlpha=1;
    const step=t<2.1?-1:t<3.7?0:t<5.2?1:2;$$(".dm-steps li",host).forEach(li=>li.classList.toggle("on",+li.dataset.s===step));
    $$(".dm-tf b",host).forEach(b=>b.classList.toggle("on",b.dataset.tf===(t>=3.7&&t<5.2?"M5":"H1")));
    if(!red)raf=requestAnimationFrame(frame)};
  raf=requestAnimationFrame(frame);cleanup.push(()=>cancelAnimationFrame(raf));
}
function aboutBlock(host){if(!host)return;const s=S.site;if(s.aboutHide){host.remove();return}
  const name=s.aboutName||s.name||"El Arte Gráfico";
  const items=s.aboutItems&&s.aboutItems.length?s.aboutItems:["Método propio para Boom y Crash, con reglas claras","Zona en H1 y stop loss en M5: lo mismo que ves en mis videos","Práctica en gráficas reales, no solo teoría"];
  const tk=s.aboutTiktok||"https://www.tiktok.com/@el_arte_grafico";
  host.innerHTML=`<div class="about"><div class="about-ph${s.aboutPhoto?" foto":""}"><img src="${esc(s.aboutPhoto||s.logoFullUrl||"assets/logo_circle.png")}" alt="${esc(name)}" loading="lazy"></div>
    <div class="about-t"><span class="eyebrow">${esc(s.aboutTitle||"Quién te enseña")}</span><h2>${esc(name)}</h2>
      <p class="muted">${esc(s.aboutText||"Soy el creador de El Arte Gráfico. En TikTok comparto mis análisis de Boom y Crash; aquí enseño el método completo, paso a paso: cómo encuentro mis zonas en H1, dónde pongo el stop loss en M5 y cómo gestiono el riesgo. Sin promesas de dinero fácil: reglas claras y mucha práctica.")}</p>
      <ul class="checks">${items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
      ${(s.aboutStats||[]).length?`<div class="cstats">${s.aboutStats.map(c=>`<div><b class="mono">${esc(c.v)}</b><span>${esc(c.t)}</span></div>`).join("")}</div>`:""}
      <div class="row"><a class="btn ghost btn-ic" href="${esc(tk)}" target="_blank" rel="noopener">${ICON_TT}<span>Verme en TikTok</span></a></div></div></div>`}
function temarioBlock(host){if(!host)return;const pub=new Set((S.modules||[]).filter(m=>m.status==="publicado"&&modOpen(m)).map(m=>m.title.trim().toLowerCase()));
  const tot=TEMARIO.reduce((a,x)=>a+x[1],0);
  host.innerHTML=TEMARIO.map(([t,n,lv],i)=>{const on=pub.has(t.toLowerCase());return `<div class="tm${on?" on":""}"><span class="tm-n mono">${String(i).padStart(2,"0")}</span><div><b>${esc(t)}</b><span class="dim">${n} lecciones · ${esc(lv)}</span></div>${on?'<span class="tag pub">Disponible</span>':'<span class="tag">Próximamente</span>'}</div>`}).join("")
    +`<p class="dim tm-foot">${TEMARIO.length} módulos · ${tot} lecciones con ejercicios en gráficas reales. Los módulos se van abriendo a medida que avanzas.</p>`}
function pricingBlock(host,o={}){if(!host)return;const s=S.site;const pl=(s.plans||[]).filter(x=>x&&x.name&&x.price);if(!pl.length||(premium()&&!o.page)){host.remove();return}const off=o.off??!!s.paymentsOff;
  const num=x=>{const m=String(x).replace(",",".").match(/\d+(\.\d+)?/);return m?parseFloat(m[0]):NaN};const cur=x=>String(x).replace(/[\d.,\s]+/g," ").trim()||"USD";
  const base=pl.find(x=>x.days<=31),bm=base?num(base.price)/(base.days/30):NaN;const fav=pl.length===3?1:pl.length>3?Math.floor(pl.length/2):-1;
  const items=(s.premiumItems||[]).slice(0,4);
  host.innerHTML=`${o.page?"":`<div class="sec-h"><div><span class="eyebrow">Precios</span><h2>Elige tu plan</h2></div><a href="#premium">Cómo pagar</a></div>`}
    <div class="prices">${pl.map((x,i)=>{const v=num(x.price),pm=v/(x.days/30),ah=isFinite(bm)&&x.days>31&&pm<bm?Math.round(100*(1-pm/bm)):0;
      return `<div class="price${i===fav?" fav":""}">${i===fav?'<span class="price-tag">Más elegido</span>':""}<h3>${esc(x.name)}</h3><div class="price-v"><b>${esc(String(x.price).replace(/\s*[A-Za-z]+$/,""))}</b><span>${esc(cur(x.price))}</span></div>
        <span class="dim">${x.days>31&&isFinite(pm)?`≈ ${pm.toFixed(pm<10?1:0).replace(".0","")} ${esc(cur(x.price))} al mes`:"pago único por 30 días"}</span>${ah?`<span class="pill ok">Ahorras ${ah}%</span>`:""}
        <ul class="checks">${items.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>${off?'<span class="btn disabled" aria-disabled="true">Disponible pronto</span>':o.page?`<button type="button" class="btn ${i===fav?"gold":""}" data-pick="${i}">Elegir ${esc(x.name)}</button>`:`<a class="btn ${i===fav?"gold":""}" href="${toMain("premium")}">Elegir ${esc(x.name)}</a>`}</div>`}).join("")}</div>
    <p class="dim price-foot">${off?"Los pagos están pausados por ahora: te avisaremos cuando abran.":"Pagas con Binance Pay en USDT y activamos tu premium al confirmar el pago."}${o.page?"":" ¿Quieres probar antes? Con tu cuenta gratis tienes 5 gráficas de prueba."}</p>`;
  $$("[data-pick]",host).forEach(b=>b.onclick=()=>{const sel=$("#pP");const k=pl[+b.dataset.pick];if(sel){const j=(S.site.plans||[]).findIndex(x=>x.name===k.name);if(j>=0)sel.value=String(j)}const t=$("#pay");if(t)t.scrollIntoView({behavior:"smooth",block:"start"})})}
const FAQ_DEF=[["¿Necesito experiencia?","No. El temario empieza desde cero: qué es un bróker, cómo leer las velas y la estructura del mercado, hasta el método completo."],
  ["¿Con cuánto dinero empiezo?","Puedes aprender y practicar en una cuenta demo sin poner dinero. Cuando pases a real, el módulo de gestión del riesgo te enseña a calcular el lote según el tamaño de tu cuenta."],
  ["¿Funciona desde el celular?","Sí. La academia y los ejercicios funcionan en el navegador del celular y la puedes instalar como app."],
  ["¿Cómo pago?","Con Binance Pay en USDT. Registras el pago en la página Premium y activamos tu acceso cuando lo confirmamos."],
  ["¿Puedo probar antes de pagar?","Sí. Con tu cuenta gratis tienes 5 gráficas de prueba para ver cómo funcionan los ejercicios."],
  ["¿Me garantizan ganancias?","No. Esto es formación. Operar índices sintéticos tiene un riesgo alto y nadie puede garantizarte resultados; por eso practicamos en demo y con gestión del riesgo."]];
function faqBlock(host){if(!host)return;const f=(S.site.faq||[]).length?S.site.faq.map(x=>[x.q,x.a]):FAQ_DEF;
  host.innerHTML=f.map(([q,a])=>`<details class="fq"><summary>${esc(q)}</summary><p class="muted">${esc(a)}</p></details>`).join("")}

/* ---------- inicio para quien ya ingresó (panel personal) ---------- */
const IC={
  acad:'<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5"/>',
  chart:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/>',
  trophy:'<path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 12v4M9 20h6M10 16h4"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/>',
  news:'<path d="M5 5h11v14H6a1 1 0 0 1-1-1V5z"/><path d="M16 9h3v9a1 1 0 0 1-1 1h-2"/><path d="M8 9h5M8 12h5M8 15h3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
  crown:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  play:'<path d="M8 5v14l11-7z"/>',
  home:'<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  star:'<path d="M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6L12 16.9 7.1 19.5l.9-5.6-4-3.9 5.5-.8z"/>'};
const ico=(k,s=22)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
function saludo(){const h=new Date(Date.now()+TZ*1000).getUTCHours();return h<5?"Buenas noches":h<12?"Buenos días":h<19?"Buenas tardes":"Buenas noches"}
async function memberHome(){
  const s=S.site,p=API.profile()||{},g=S.prog||blankProg(),lv=levelOf(g.xp||0),cerr=closedAcad()&&!admin(),prem=premium();
  const lpct=lv.to?Math.round(100*((g.xp||0)-lv.from)/(lv.to-lv.from)):100;
  const total=S.lindex.length,pas=S.lindex.filter(l=>passedL(l.id)).length,apct=total?Math.round(100*pas/total):0;
  const nx=prem&&!cerr?nextLesson():null;const demo=Math.max(0,5-(p.demo_used||0));
  const dias=prem&&p.premium_until?Math.ceil((new Date(p.premium_until)-Date.now())/864e5):null;
  const cta=cerr?`<span class="pill">La academia abre muy pronto</span>`
    :prem?(nx?`<a class="btn gold btn-ic" href="${toAcad("leccion-"+nx.id)}">${ico("play",18)}<span>Continuar: ${esc(nx.title)}</span></a>`:`<a class="btn gold" href="${toAcad("practica")}">Ir a práctica</a>`)
    :`<a class="btn gold" href="${toAcad("prueba")}">Probar gráficas gratis (${demo} de 5)</a><a class="btn ghost" href="#premium">Hazte premium</a>`;
  const tiles=[
    ["acad","Academia",cerr?"Abre muy pronto":prem?`${pas} de ${total} lecciones`:"Temario y prueba gratis",toAcad("inicio")],
    ["chart","Práctica",prem?"Gráficas reales ilimitadas":`${demo} gráficas de prueba`,toAcad(prem?"practica":"prueba")],
    ["trophy","Ranking",`<span id="mhPos">Ver mi puesto</span>`,toAcad("ranking")],
    ["chat","Comunidad",s.discordUrl?"Entrar al Discord":"Noticias y avisos",s.discordUrl||"#comunidad",!!s.discordUrl],
    ["news","Novedades","Publicaciones y avisos","#comunidad"],
    ["gear","Configuración","Perfil, app y notificaciones","#perfil"]];
  app.innerHTML=`<div id="appCard"></div>
  <section class="mh">
    <div class="mh-bg" aria-hidden="true"></div>
    <div class="mh-id"><a class="mh-av" href="#perfil" title="Configuración">${avatar(p,84)}<span class="lvchip" title="${esc(lv.name)}">${lv.i+1}</span></a>
      <div class="mh-t"><span class="eyebrow">${saludo()}</span><h1>${esc(p.username||"trader")} ${flag(p.country||"")}</h1>
        <div class="mh-chips">${prem?premTag():'<span class="tag">Cuenta gratis</span>'}<span class="tag">${esc(lv.name)}</span><span class="tag mono">${g.xp||0} pts</span>${admin()?'<span class="tag pub">Admin</span>':""}</div></div></div>
    <div class="mh-cta">${cta}</div>
    <div class="mh-bars">
      <div><div class="mh-bl"><span>Avance en la academia</span><b class="mono">${apct}%</b></div><div class="bar"><i style="width:${apct}%"></i></div></div>
      <div><div class="mh-bl"><span>${lv.to?`Nivel ${lv.i+2} en ${lv.to-(g.xp||0)} pts`:"Nivel máximo"}</span><b class="mono">${lpct}%</b></div><div class="bar"><i style="width:${lpct}%"></i></div></div>
    </div>
  </section>
  <section class="mh-tiles">${tiles.map(([k,t,d,h,ext])=>`<a class="mt" href="${esc(h)}"${ext?' target="_blank" rel="noopener"':""}><span class="mt-i">${ico(k)}</span><b>${t}</b><span class="dim">${d}</span></a>`).join("")}</section>
  <section class="mh-grid">
    <div class="panel"><div class="sec-h"><h3>Novedades</h3><a href="#comunidad">Ver todo</a></div><div id="mhNews" class="mh-news"><div class="muted">Cargando…</div></div></div>
    <div class="mh-side">
      <div class="panel mh-plan">${prem?`<span class="mt-i gold">${ico("crown")}</span><div><b>Tu plan Premium</b><span class="muted">${dias!=null&&dias<3650?`Te quedan <b>${dias}</b> día${dias===1?"":"s"} · hasta ${fmtDate(p.premium_until)}`:"Acceso completo a la academia"}</span></div>${dias!=null&&dias<=7?'<a class="btn sm gold" href="#premium">Renovar</a>':""}`
        :`<span class="mt-i gold">${ico("crown")}</span><div><b>Desbloquea toda la academia</b><span class="muted">Todos los módulos, práctica ilimitada y tu placa dorada en el ranking.</span></div><a class="btn sm gold" href="#precios-mh">Ver planes</a>`}</div>
      <div class="panel"><div class="sec-h"><h3>Ranking</h3><a href="${toAcad("ranking")}">Completo</a></div><div id="mhRk" class="muted">Cargando…</div></div>
    </div>
  </section>
  ${prem?"":'<section class="sec" id="precios-mh"></section>'}`;
  appCard($("#appCard"));if(!prem)pricingBlock($("#precios-mh"));
  API.posts().then(ps=>{const h=$("#mhNews");if(!h)return;h.innerHTML=ps.slice(0,4).map(x=>`<a class="mn" href="#nota-${esc(x.id)}">${x.image_url?`<span class="mn-img" style="background-image:url('${esc(x.image_url)}')"></span>`:`<span class="mn-img none">${ico("news",20)}</span>`}<span class="mn-t"><span class="dim">${fmtDate(x.created_at)} · ${esc(x.category||"Noticia")}</span><b>${esc(x.title)}</b></span></a>`).join("")||'<div class="muted">Pronto publicaremos novedades.</div>'}).catch(()=>{const h=$("#mhNews");if(h)h.innerHTML='<div class="muted">No se pudieron cargar las novedades.</div>'});
  API.leaderboard().then(r=>{const h=$("#mhRk");if(!h)return;const k=r.findIndex(x=>x.is_me);if($("#mhPos"))$("#mhPos").textContent=k>=0?`Vas en el puesto #${k+1}`:"Suma puntos para aparecer";
    h.innerHTML=r.length?`<table class="tbl rk">${r.slice(0,5).map((x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,24)}<span>${esc(x.username)}</span>${flag(x.country)}</span></td><td class="n">${x.xp}</td></tr>`).join("")}</table>${k>=5?`<div class="mh-me">Tú: puesto #${k+1} · ${r[k].xp} pts</div>`:""}`:'<div class="muted">Aún no hay alumnos en el ranking.</div>'}).catch(()=>{const h=$("#mhRk");if(h)h.textContent="No se pudo cargar."});
}

/* ---------- inicio del sitio principal ---------- */
async function mainHome(){
  if(logged()&&API.profile())return memberHome();
  const s=S.site,p=API.profile();
  const dItems=(s.discordItems&&s.discordItems.length?s.discordItems:DISC.items);
  app.innerHTML=`${logged()&&p?`<section class="welcome"><a class="welcome-av" href="#perfil" title="Configuración">${avatar(p,56)}</a><div style="flex:1;min-width:200px"><span class="eyebrow">Tu cuenta</span><h2>Hola, ${esc(p.username)}</h2><p class="muted">${closedAcad()&&!admin()?"Tu cuenta ya quedó creada. La academia abre muy pronto: te avisaremos por aquí y en la comunidad.":premium()?"Tienes acceso premium a toda la academia.":`Cuenta gratis · tienes ${Math.max(0,5-(p.demo_used||0))} de 5 gráficas de prueba en la academia.`}</p></div>${closedAcad()&&!admin()?'<span class="pill">Academia: próximamente</span>':`<a class="btn gold" href="${toAcad("inicio")}">Ir a la academia</a>`}</section>`:""}
  <div id="appCard"></div>
  <section class="hero2"><div id="hero"></div><div class="demo-card" id="demo" aria-label="Así se practica en la academia"></div></section>
  <section class="statband" id="stats"></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">La academia</span><h2>Qué vas a aprender</h2></div><a href="${toAcad("inicio")}">Ir a la academia</a></div><div class="cards" id="cards"></div></section>
  <section class="sec" id="about"></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Temario</span><h2>De cero al método completo</h2></div><a href="${toAcad("academia")}">Ver temario</a></div><div class="tmp" id="tmp"></div></section>
  <section class="sec" id="precios"></section>
  <section class="sec"><div class="disc">
    <div class="disc-main"><span class="eyebrow">Comunidad</span><h2>${esc(s.discordTitle||DISC.title)}</h2><p class="muted">${esc(s.discordText||DISC.text)}</p>
      <ul class="checks">${dItems.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
      <div class="cstats" id="cstats">${(s.communityStats||[]).map(c=>`<div><b class="mono">${esc(c.v)}</b><span>${esc(c.t)}</span></div>`).join("")}</div>
      <div class="row">${s.discordUrl?`<a class="btn gold btn-ic" href="${esc(s.discordUrl)}" target="_blank" rel="noopener">${ICON_CHAT}<span>Unirme al Discord</span></a>`:'<span class="pill">El enlace al Discord se publicará pronto</span>'}<a class="btn ghost" href="#comunidad">Ver publicaciones</a></div></div>
    <div class="disc-news"><div class="sec-h"><h3>Últimas publicaciones</h3><a href="#comunidad">Ver todo</a></div><div id="newsMini" class="minis"><div class="muted">Cargando…</div></div></div>
  </div></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Mercados</span><h2>Empezamos por sintéticos. Vamos por todo el mercado.</h2></div><a href="#mercados">Ver mercados</a></div><div class="mkts" id="mkts"></div></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Opiniones</span><h2>Lo que dicen los alumnos</h2></div><a href="#opiniones">Ver todas</a></div><div id="revs"></div></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Preguntas frecuentes</span><h2>Antes de empezar</h2></div></div><div class="faq" id="faq"></div></section>
  <section class="cta-band" id="premiumBand"></section>`;
  API.slides("home").then(sl=>slider($("#hero"),sl,{emblem:false})).catch(()=>slider($("#hero"),[],{emblem:false}));statsBand();demoChart($("#demo"));aboutBlock($("#about"));temarioBlock($("#tmp"));pricingBlock($("#precios"));faqBlock($("#faq"));appCard($("#appCard"));
  if(s.discordUrl)discordCounts(s.discordUrl).then(d=>{const h=$("#cstats");if(!h||!d||!d.members)return;
    h.insertAdjacentHTML("afterbegin",`<div><b class="mono">${fmtN(d.members)}</b><span>miembros en Discord</span></div>${d.online?`<div><b class="mono"><i class="live"></i>${fmtN(d.online)}</b><span>conectados ahora</span></div>`:""}`)});
  $("#cards").innerHTML=(s.cards||[]).map((c,i)=>`<div class="card"><span class="k">${String(i+1).padStart(2,"0")}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join("");
  $("#mkts").innerHTML=marketsHTML(s.markets||[],true);
  {const pb=$("#premiumBand");if(premium())pb.remove();else if(logged())pb.innerHTML=premiumBand();
    else pb.innerHTML=`<div class="pb final"><div><span class="eyebrow">Empieza hoy</span><h2>Crea tu cuenta gratis y prueba el método</h2><p class="muted" style="max-width:60ch;margin-top:8px">Tienes 5 gráficas de prueba para marcar tu zona, poner tu stop loss y ver la repetición. Sin tarjeta y sin compromiso.</p></div><div class="row"><a class="btn gold" href="#registro">Crear cuenta gratis</a><a class="btn ghost" href="#entrar">Ya tengo cuenta</a></div></div>`}
  API.publicReviews().then(r=>{if($("#revs"))$("#revs").innerHTML=reviewsHTML(r.slice(0,3),true)}).catch(()=>{});
  API.posts().then(p=>{if($("#newsMini"))$("#newsMini").innerHTML=p.slice(0,4).map(x=>`<a class="mini" href="#nota-${esc(x.id)}"><span class="dim">${fmtDate(x.created_at)} · ${esc(x.category||"Noticia")}</span><b>${esc(x.title)}</b></a>`).join("")||'<div class="muted">Pronto publicaremos noticias y actualizaciones.</div>'}).catch(()=>{if($("#newsMini"))$("#newsMini").innerHTML='<div class="muted">Sin publicaciones por ahora.</div>'});
}

/* ---------- panel de la academia ---------- */
function nextLesson(){for(const m of S.modules){if(!modOpen(m)||m.optional)continue;const ls=S.lindex.filter(l=>l.module_id===m.id).sort((a,b)=>(a.sort||0)-(b.sort||0));for(const l of ls){if(!(S.prog.done[l.id]&&S.prog.done[l.id].passed))return l}}return null}
async function academyHome(){
  const p=API.profile()||{},g=S.prog,lv=levelOf(g.xp);const pct=lv.to?Math.round(100*(g.xp-lv.from)/(lv.to-lv.from)):100;const nx=premium()?nextLesson():null;
  const passed=Object.values(g.done).filter(d=>d.passed).length,total=S.lindex.length;
  const prem=premium(),apct=total?Math.round(100*passed/total):0,acc=g.practice.n?Math.round(100*g.practice.ok/g.practice.n):0,demo=Math.max(0,5-(p.demo_used||0));
  const tiles=[["acad","Temario",`${passed} de ${total} lecciones`,"#academia"],["chart","Práctica",prem?"Gráficas ilimitadas":`${demo} gráficas de prueba`,prem?"#practica":"#prueba"],
    ["trophy","Ranking",'<span id="mhPos">Ver mi puesto</span>',"#ranking"],["news","Comunidad","Novedades y avisos",toMain("comunidad")],["gear","Configuración","Perfil, app y notificaciones","#perfil"]];
  app.innerHTML=`<section class="mh">
    <div class="mh-bg" aria-hidden="true"></div>
    <div class="mh-id"><a class="mh-av" href="#perfil" title="Configuración">${avatar(p,84)}<span class="lvchip" title="${esc(lv.name)}">${lv.i+1}</span></a>
      <div class="mh-t"><span class="eyebrow">${saludo()} · Academia</span><h1>${esc(p.username||"")} ${flag(p.country||"")}</h1>
        <div class="mh-chips">${prem?premTag():'<span class="tag">Cuenta gratis</span>'}<span class="tag">${esc(lv.name)}</span><span class="tag mono">${g.xp} pts</span></div></div></div>
    <div class="mh-cta">${prem?(nx?`<a class="btn gold btn-ic" href="#leccion-${esc(nx.id)}">${ico("play",18)}<span>Continuar: ${esc(nx.title)}</span></a>`:'<a class="btn gold" href="#practica">Ir a práctica</a>'):`<a class="btn gold" href="#prueba">Probar gratis (${demo} de 5)</a><a class="btn ghost" href="${toMain("premium")}">Hazte premium</a>`}</div>
    <div class="mh-bars">
      <div><div class="mh-bl"><span>Lecciones aprobadas: ${passed}${total?` de ${total}`:""}</span><b class="mono">${apct}%</b></div><div class="bar"><i style="width:${apct}%"></i></div></div>
      <div><div class="mh-bl"><span>${lv.to?`Nivel ${lv.i+2} en ${lv.to-g.xp} pts`:"Nivel máximo"}</span><b class="mono">${pct}%</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>
    </div>
    <div class="mh-mini"><span><b class="mono">${g.practice.n}</b> ejercicios</span><span><b class="mono">${acc}%</b> aciertos</span><span><b class="mono">${g.streak||0}</b> días seguidos</span></div>
  </section>
  <section class="mh-tiles">${tiles.map(([k,t,d,h])=>`<a class="mt" href="${esc(h)}"><span class="mt-i">${ico(k)}</span><b>${t}</b><span class="dim">${d}</span></a>`).join("")}</section>
  ${premium()?(m=>m?fbCard(m):"")(S.modules.find(needFb)):""}
  <div id="appCard"></div>
  ${premium()?"":`<section class="sec" id="prueba"><div class="sec-h"><div><span class="eyebrow">Prueba gratis</span><h2>Tus gráficas de prueba</h2></div><span class="muted" id="demoLeft"></span></div><div id="demoBox"></div></section>`}
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Temario</span><h2>Ruta de aprendizaje</h2></div><a href="#academia">Ver temario completo</a></div><div id="syl"></div></section>
  ${premium()?`<section class="sec"><div class="two"><div class="panel"><h3>Práctica libre</h3><p class="muted">Ejercicios sueltos para entrenar el ojo. Suman puntos para el ranking.</p><div class="row"><a class="btn" href="#practica">Practicar ahora</a></div></div><div class="panel"><div class="sec-h"><h3>Ranking</h3><a href="#ranking">Ver completo</a></div><div id="rkMini" class="muted">Cargando…</div></div></div></section>`:`<section class="sec"><div class="panel"><div class="sec-h"><h3>Ranking de alumnos</h3><a href="#ranking">Ver completo</a></div><div id="rkMini" class="muted">Cargando…</div></div></section><section class="cta-band">${premiumBand()}</section>`}`;
  syllabus($("#syl"),premium()?0:6);if(!premium())demoSection();appCard($("#appCard"));
  API.leaderboard().then(r=>{const k=r.findIndex(x=>x.is_me);if($("#mhPos"))$("#mhPos").textContent=k>=0?`Vas en el puesto #${k+1}`:"Suma puntos para aparecer";if(!$("#rkMini"))return;$("#rkMini").innerHTML=r.length?`<table class="tbl rk">${r.slice(0,5).map((x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,24)}<span>${esc(x.username)}</span>${flag(x.country)}${x.premium?premTag():""}</span></td><td class="n">${x.xp}</td></tr>`).join("")}</table>`:'<div class="muted">Aún no hay alumnos en el ranking.</div>'}).catch(()=>{});
}
function marketsHTML(list,compact){const g={};list.forEach(m=>{(g[m.cat]=g[m.cat]||[]).push(m)});
  return Object.entries(g).map(([cat,ms])=>`<div class="mkcat"><h3>${esc(cat)}</h3><div class="mklist">${ms.map(m=>`<div class="mk ${m.status==="Disponible"?"on":""}"><div><b>${esc(m.name)}</b>${compact?"":`<p class="muted">${esc(m.text||"")}</p>`}</div><span class="tag ${m.status==="Disponible"?"pub":""}">${esc(m.status)}</span></div>`).join("")}</div></div>`).join("")||'<div class="empty">Sin mercados configurados.</div>'}
function premiumBand(){const s=S.site;return `<div class="pb"><div><span class="eyebrow">Premium</span><h2>${esc(s.premiumTitle||"Hazte premium")}</h2><p class="muted" style="max-width:60ch;margin-top:8px">${esc(s.premiumText||"")}</p></div>
  <ul class="checks">${(s.premiumItems||[]).map(i=>`<li>${esc(i)}</li>`).join("")}</ul><div class="row">${premium()?'<span class="pill ok">Ya eres premium</span><a class="btn" href="${toAcad("inicio")}">Ir a la academia</a>':`<a class="btn gold" href="#premium">Ver cómo acceder</a>${logged()?"":'<a class="btn ghost" href="#registro">Crear cuenta gratis</a>'}`}</div></div>`}
async function syllabus(host,limit){
  const [mods,idx]=[S.modules,S.lindex];if(!host)return;
  if(!mods.length){host.innerHTML='<div class="empty">El temario se publicará pronto.</div>';return}
  const groups={};mods.forEach(m=>{(groups[m.category||"Fundamentos"]=groups[m.category||"Fundamentos"]||[]).push(m)});
  let n=0;host.innerHTML=Object.entries(groups).map(([cat,ms])=>{if(limit&&n>=limit)return"";return `<div class="syl-cat"><h3 class="cat">${esc(cat)}</h3><div class="grid">${ms.map(m=>{if(limit&&n>=limit)return"";n++;const ls=idx.filter(l=>l.module_id===m.id);const pr=modProgress(m.id,ls);
    const op=modOpen(m,true);
    return `<a class="mod ${op?"":"soon-mod"}" href="#modulo-${esc(m.id)}"><span class="num">${esc(m.level||cat)}</span><h3>${esc(m.title)}</h3><p>${esc(m.descr||"")}</p>
      <div class="meta"><span>${ls.length} ${ls.length===1?"lección":"lecciones"}</span>${m.optional?'<span class="tag pub">Opcional</span>':""}${op?"":`<span class="tag lock">${esc(modState(m))}</span>`}${premium()||!op?"":'<span class="tag">Premium</span>'}${m.status!=="publicado"?'<span class="tag">Borrador</span>':""}</div>${premium()?`<div class="bar"><i style="width:${Math.round(pr*100)}%"></i></div>`:""}</a>`}).join("")}</div></div>`}).join("")}
function modProgress(mid,ls){ls=ls||S.lindex.filter(l=>l.module_id===mid);if(!ls.length||!S.prog)return 0;return ls.filter(l=>S.prog.done[l.id]&&S.prog.done[l.id].passed).length/ls.length}
const postCard=p=>`<a class="post${p.image_url?"":" noimg"}" href="#nota-${esc(p.id)}">${p.image_url?`<div class="thumb" style="background-image:url('${esc(p.image_url)}')"></div>`:""}<div style="display:grid;gap:6px;align-content:start;min-width:0"><div class="row"><span class="tag">${esc(p.category||"Noticia")}</span>${p.pinned?'<span class="tag pub">Fijado</span>':""}${p.premium_only?'<span class="tag">Premium</span>':""}<span class="dim" style="font-size:13px">${fmtDate(p.created_at)}</span></div><h3>${esc(p.title)}</h3><p class="muted clamp">${esc(String(p.body||"").slice(0,220))}</p></div></a>`;
function reviewsHTML(list,compact){if(!list.length)return `<div class="empty">Todavía no hay opiniones publicadas.${logged()?'<a class="btn sm" href="#opiniones">Escribir la primera</a>':""}</div>`;
  return `<div class="revs ${compact?"compact":""}">${list.map(r=>`<figure class="rev"><div class="stars" aria-label="${r.rating} de 5">${stars(r.rating)}</div><blockquote>${esc(r.body||"")}</blockquote><figcaption>${avatar(r,30)}<b>${esc(r.username)}</b>${r.premium?'<span class="tag pub">Premium</span>':""}<span class="dim">${fmtDate(r.created_at)}</span></figcaption></figure>`).join("")}</div>`}

/* ---------- prueba gratis ---------- */
async function demoSection(){
  const box=$("#demoBox");if(!box)return;
  if(!logged()){box.innerHTML=`<div class="panel demo-cta"><div><h3>5 gráficas de prueba gratis</h3><p class="muted">Crea tu cuenta y practica con gráficas reales: marca la zona, baja a M5 para el stop loss y mira la repetición.</p></div><div class="row"><a class="btn gold" href="#registro">Crear cuenta gratis</a><a class="btn ghost" href="#entrar">Ya tengo cuenta</a></div></div>`;return}
  const p=API.profile()||{};const left=premium()?null:Math.max(0,5-(p.demo_used||0));
  $("#demoLeft").textContent=premium()?"Eres premium: práctica ilimitada":`Te quedan ${left} de 5 gráficas`;
  if(left===0){box.innerHTML=`<div class="panel demo-cta"><div><h3>Ya usaste tus 5 gráficas de prueba</h3><p class="muted">Con el acceso premium tienes todas las lecciones y práctica ilimitada.</p></div><a class="btn gold" href="#premium">Ver cómo acceder</a></div>`;return}
  let ex=[];try{ex=await API.exercises({demo:true})}catch(e){}
  if(!ex.length){box.innerHTML='<div class="empty">Las gráficas de prueba se publicarán pronto.</div>';return}
  const pick=ex[(p.demo_used||0)%ex.length];
  const h=await Player.mount(box,pick,{onDone:({res,pts})=>{registerAnswer(pick.kind,res);exXP(pick,pts);const l=premium()?null:Math.max(0,5-((API.profile()||{}).demo_used||0));if(l!=null)$("#demoLeft").textContent=`Te quedan ${l} de 5 gráficas`},
    next:()=>demoSection()});
  if(h)cleanup.push(h.destroy);
}

/* ---------- auth ---------- */
ROUTES.entrar=a=>authView("in",a);ROUTES.registro=a=>authView("up",a);ROUTES.recuperar=()=>authView("rec");
async function authView(mode,arg){
  const back=arg==="academia";
  const done=()=>{if(!back){location.hash="#inicio";return}API.shareSession&&API.shareSession();
    try{localStorage.setItem("ag_go_acad",String(Date.now()))}catch(e){}location.href=toAcad("inicio")};
  let loop=false;try{loop=Date.now()-(+localStorage.getItem("ag_go_acad")||0)<15000}catch(e){}
  if(logged()&&mode!=="rec"){if(back&&loop){try{localStorage.removeItem("ag_go_acad")}catch(e){}await API.signOut();renderNav();toast("Vuelve a ingresar para entrar a la academia")}else{done();return}}
  app.innerHTML=`<div class="auth"><div id="aslide"></div><div class="authbox" id="abox"></div></div>`;
  API.slides("login").then(sl=>slider($("#aslide"),sl)).catch(()=>slider($("#aslide"),[]));
  const box=$("#abox");
  const head=`<div style="display:grid;gap:6px"><img src="assets/logo_mark.png" alt="" style="width:56px;height:56px"><h2>${mode==="up"?"Crea tu cuenta":mode==="in"?(back?"Ingresa para entrar a la academia":"Ingresa a tu cuenta"):"Recupera tu contraseña"}</h2><p class="muted">${mode==="up"?"Gratis. Una sola cuenta para la comunidad y la academia, con 5 gráficas de prueba.":mode==="in"?"Una sola cuenta para El Arte Gráfico y la academia.":"Te enviaremos un enlace a tu correo."}</p></div>`;
  const seg=mode==="rec"?"":`<div class="seg"><button class="${mode==="in"?"on":""}" data-m="entrar${back?"-academia":""}">Ingresar</button><button class="${mode==="up"?"on":""}" data-m="registro${back?"-academia":""}">Crear cuenta</button></div>`;
  if(mode==="up")box.innerHTML=head+seg+`<form class="form" id="f" novalidate>
      <label for="uU">Nombre de usuario<input id="uU" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_.]{3,24}" placeholder="ej. trader_juan"><span class="dim" style="font-weight:400">Letras, números, punto o guion bajo. Se verá en el ranking y la comunidad.</span></label>
      <label for="uE">Correo electrónico<input id="uE" type="email" autocomplete="email" required placeholder="tucorreo@ejemplo.com"></label>
      <label for="uP">Contraseña<div class="pw"><input id="uP" type="password" autocomplete="new-password" required minlength="8"><button type="button" data-show="uP">Mostrar</button></div><div class="meter"><i id="pm"></i></div><span class="dim" id="pmt" style="font-weight:400">Mínimo 8 caracteres, con letras y números.</span></label>
      <label for="uP2">Repite la contraseña<div class="pw"><input id="uP2" type="password" autocomplete="new-password" required><button type="button" data-show="uP2">Mostrar</button></div></label>
      <label>Verificación<div id="cap"></div></label>
      <label class="accept"><input type="checkbox" id="uT"> <span>Soy mayor de 18 años, acepto los <a href="${toMain("legal-terminos")}" target="_blank" rel="noopener">Términos y condiciones</a> y el <a href="${toMain("legal-riesgo")}" target="_blank" rel="noopener">Aviso de riesgo</a>, y autorizo el tratamiento de mis datos según la <a href="${toMain("legal-privacidad")}" target="_blank" rel="noopener">Política de datos personales</a>.</span></label>
      <div class="err" id="err" role="alert"></div><button class="btn gold" type="submit" id="go">Crear cuenta</button></form>`;
  else if(mode==="in")box.innerHTML=head+seg+`<form class="form" id="f" novalidate>
      <label for="uE">Correo o nombre de usuario<input id="uE" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label for="uP">Contraseña<div class="pw"><input id="uP" type="password" autocomplete="current-password" required><button type="button" data-show="uP">Mostrar</button></div></label>
      ${CFG.TURNSTILE_SITE_KEY?'<label>Verificación<div id="cap"></div></label>':""}
      <div class="err" id="err" role="alert"></div><button class="btn gold" type="submit" id="go">Ingresar</button><a href="#recuperar" style="font-size:14px">Olvidé mi contraseña</a></form>`;
  else box.innerHTML=head+`<form class="form" id="f" novalidate><label for="uE">Correo electrónico<input id="uE" type="email" required></label><label>Verificación<div id="cap"></div></label>
      <div class="err" id="err" role="alert"></div><button class="btn gold" type="submit" id="go">Enviar enlace</button><a href="#entrar" style="font-size:14px">Volver a ingresar</a></form>`;
  $$("[data-m]",box).forEach(b=>b.onclick=()=>location.hash="#"+b.dataset.m);
  $$("[data-show]",box).forEach(b=>b.onclick=()=>{const i=$("#"+b.dataset.show);i.type=i.type==="password"?"text":"password";b.textContent=i.type==="password"?"Mostrar":"Ocultar"});
  const cap=$("#cap")?captcha($("#cap")):null;
  if($("#uP")&&mode==="up")$("#uP").oninput=()=>{const v=$("#uP").value;let sc=0;if(v.length>=8)sc++;if(/[0-9]/.test(v)&&/[a-zA-Z]/.test(v))sc++;if(v.length>=12)sc++;if(/[^A-Za-z0-9]/.test(v))sc++;
    $("#pm").style.width=(sc*25)+"%";$("#pm").style.background=["var(--bad)","var(--bad)","var(--warn)","var(--ok)","var(--ok)"][sc];$("#pmt").textContent=["Muy débil","Débil","Aceptable","Fuerte","Muy fuerte"][sc]};
  $("#f").onsubmit=async e=>{e.preventDefault();const err=$("#err");err.textContent="";const go=$("#go");
    const email=$("#uE").value.trim();
    if(mode==="in"){if(!email)return err.textContent="Escribe tu correo o tu nombre de usuario.";if(email.includes("@")&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err.textContent="Escribe un correo válido.";if(!$("#uP").value)return err.textContent="Escribe tu contraseña."}
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err.textContent="Escribe un correo válido.";
    if(cap&&!cap.ok())return err.textContent=CFG.TURNSTILE_SITE_KEY?"Completa la verificación anti-bots.":"El código de verificación no coincide. Inténtalo de nuevo.";
    try{busy(go,true);
      if(mode==="up"){const u=$("#uU").value.trim(),p=$("#uP").value,p2=$("#uP2").value;
        if(!/^[A-Za-z0-9_.]{3,24}$/.test(u))throw new Error("El nombre de usuario debe tener de 3 a 24 caracteres: letras, números, punto o guion bajo.");
        if(p.length<8||!/[0-9]/.test(p)||!/[a-zA-Z]/.test(p))throw new Error("La contraseña debe tener mínimo 8 caracteres, con letras y números.");
        if(p!==p2)throw new Error("Las contraseñas no coinciden.");
        if(!$("#uT").checked)throw new Error("Para crear tu cuenta debes aceptar los términos, el aviso de riesgo y la política de datos.");
        const r=await API.signUp({username:u,email,password:p,captcha:cap&&cap.token()});
        if(r.confirm){box.innerHTML=head+`<div class="okmsg">Te enviamos un correo a <b>${esc(email)}</b> para confirmar tu cuenta. Ábrelo y luego ingresa.</div><a class="btn" href="#entrar">Ir a ingresar</a>`;return}
        await afterLogin();toast("Cuenta creada. Bienvenido.");done();
      }else if(mode==="in"){await API.signIn({email,password:$("#uP").value,captcha:cap&&cap.token()});await afterLogin();toast("Bienvenido");done();}
      else{await API.recover(email,cap&&cap.token());box.innerHTML=head+`<div class="okmsg">Si existe una cuenta con ese correo, te llegará un enlace para crear una contraseña nueva.</div><a class="btn" href="#entrar">Volver</a>`}
    }catch(x){err.textContent=x.message||"No se pudo completar.";cap&&cap.reset()}finally{busy(go,false)}};
}
ROUTES.nueva=()=>{app.innerHTML=`<div class="authbox" style="max-width:480px;margin:0 auto"><h2>Crea tu contraseña nueva</h2><form class="form" id="f"><label for="nP">Contraseña nueva<input id="nP" type="password" minlength="8" required autocomplete="new-password"></label><label for="nP2">Repítela<input id="nP2" type="password" required autocomplete="new-password"></label><div class="err" id="err"></div><button class="btn gold" id="go">Guardar</button></form></div>`;
  $("#f").onsubmit=async e=>{e.preventDefault();const a=$("#nP").value,b=$("#nP2").value;if(a.length<8||!/[0-9]/.test(a)||!/[a-zA-Z]/.test(a))return $("#err").textContent="Mínimo 8 caracteres, con letras y números.";if(a!==b)return $("#err").textContent="No coinciden.";
    try{await API.updatePassword(a);toast("Contraseña actualizada");location.hash="#inicio"}catch(x){$("#err").textContent=x.message}}};
async function afterLogin(){await API.loadProfile();await loadProg();await loadContent();renderNav()}

/* ---------- mercados / premium ---------- */
ROUTES.mercados=()=>{app.innerHTML=`<div class="pagehead"><span class="eyebrow">Mercados</span><h1>Un método, varios mercados</h1><p class="muted">Empezamos con los índices sintéticos Boom y Crash, con práctica en gráficas reales. Después llegan Step Index, Volatility, Forex y metales.</p></div><div class="mkts big">${marketsHTML(S.site.markets||[],false)}</div>`};
ROUTES.premium=()=>{const s=S.site;const plans=(s.plans||[]).filter(x=>x&&x.name);const off=!!s.paymentsOff;const bin=!off&&!!(s.binancePayId&&plans.length);const pf=API.profile()||{};
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Premium</span><h1>${esc(s.premiumTitle||"Hazte premium")}</h1><p class="muted">${esc(s.premiumText||"")}</p></div>
  ${premium()?`<div class="note ok-note">Ya eres premium${pf.premium_until&&new Date(pf.premium_until).getFullYear()<2090?` hasta el <b>${fmtDate(pf.premium_until)}</b>`:""}. Si pagas otro plan, los días se suman a los que te quedan.</div>`:""}
  ${off?`<div class="panel pay-off"><span class="mt-i">${ico("crown")}</span><div><h3>Los pagos están pausados por ahora</h3><p class="muted">Estamos preparando la apertura. Te avisaremos por la comunidad${s.discordUrl?" y el Discord":""} cuando puedas activar tu plan.${s.contact?` Si tienes dudas escríbenos: <b class="sel">${esc(s.contact)}</b>`:""}</p></div></div>`:""}
  <section class="sec" id="pmPlans"></section>
  ${off?""
  :bin?`<div class="panel" id="pay"><h3>Paga con Binance Pay</h3>
    <ol class="prose" style="padding-left:20px">
      <li>${logged()?"Ya tienes tu cuenta creada.":'<a href="#registro">Crea tu cuenta gratis</a> o <a href="#entrar">ingresa</a>.'}</li>
      <li>En la app de Binance entra a <b>Pay → Enviar</b> y envía el monto de tu plan al <b>Binance Pay ID</b>: <b class="mono sel" id="bpid">${esc(s.binancePayId)}</b> <button type="button" class="btn sm ghost" id="cpid">Copiar</button>${s.binanceName?` <span class="dim">(${esc(s.binanceName)})</span>`:""}</li>
      <li>Cuando termine, abre el pago en tu historial y copia el <b>ID de orden</b>.</li>
      <li>Regístralo aquí abajo. Revisamos el pago y activamos tu acceso premium.</li></ol>
    ${s.payNote?`<div class="note">${esc(s.payNote)}</div>`:""}
    <div id="payf"></div></div>`:
  `<div class="panel"><h3>Cómo activar tu acceso</h3><ol class="prose" style="padding-left:20px"><li>${logged()?"Ya tienes tu cuenta creada.":'<a href="#registro">Crea tu cuenta gratis</a>.'}</li><li>Escríbenos para realizar el pago${s.contact?`: <b class="sel">${esc(s.contact)}</b>`:"."}</li><li>Activamos tu acceso premium y entras a todo el contenido.</li></ol>${logged()?`<p class="muted">Tu usuario: <b>${esc((API.profile()||{}).username||"")}</b> · ${esc((API.profile()||{}).email||"")}</p>`:""}</div>`}`;
  pricingBlock($("#pmPlans"),{page:true,off});
  if(!bin)return;
  $("#cpid").onclick=async()=>{try{await navigator.clipboard.writeText(s.binancePayId);toast("Binance Pay ID copiado")}catch(e){toast("No se pudo copiar")}};
  const host=$("#payf");
  if(!logged()){host.innerHTML='<div class="note">Para registrar tu pago primero <a href="#entrar">ingresa a tu cuenta</a>.</div>';return}
  const estado={pendiente:'<span class="pill gold">Por confirmar</span>',aprobado:'<span class="pill ok">Aprobado</span>',rechazado:'<span class="pill">Rechazado</span>'};
  const draw=async()=>{let mine=[];try{mine=await API.myPayments()}catch(e){}
    host.innerHTML=`<form class="form" id="pf" novalidate><h3 style="margin-top:6px">Registrar mi pago</h3>
      <div class="two"><label for="pP">Plan que pagaste<select id="pP">${plans.map((x,i)=>`<option value="${i}">${esc(x.name)} · ${esc(x.price)}</option>`).join("")}</select></label>
      <label for="pO">ID de orden de Binance<input id="pO" inputmode="numeric" autocomplete="off" placeholder="Ej.: 382947561029384756" maxlength="80"></label></div>
      <label for="pN">Nota (opcional)<input id="pN" maxlength="300" placeholder="Ej.: pagué desde la cuenta de mi hermano"></label>
      <div class="err" id="pE" role="alert"></div><div class="row"><button class="btn gold" id="pB">Registrar pago</button></div></form>
      ${mine.length?`<h3>Mis pagos</h3><div class="list">${mine.map(r=>`<div class="item"><span class="txt"><b>${esc(r.plan)} · ${esc(r.amount)}</b><span>ID ${esc(r.order_id)} · ${fmtDT(r.created_at)}${r.status==="rechazado"&&r.admin_note?` · ${esc(r.admin_note)}`:""}</span></span>${estado[r.status]||""}</div>`).join("")}</div>`:""}`;
    $("#pf").onsubmit=async e=>{e.preventDefault();const pl=plans[+$("#pP").value]||plans[0];const oid=$("#pO").value.replace(/\s+/g,"");
      if(!/^[A-Za-z0-9-]{4,80}$/.test(oid)){$("#pE").textContent="Escribe el ID de orden tal como sale en Binance (solo números y letras).";return}
      try{busy($("#pB"),true);await API.payRequest({plan:pl.name,days:pl.days,amount:pl.price,order_id:oid,note:$("#pN").value.trim()});toast("Pago registrado. Te avisamos al activarlo.");draw()}
      catch(x){$("#pE").textContent=/duplicate|unique|ya fue registrado/i.test(x.message)?"Ese ID de orden ya fue registrado.":x.message}finally{const b=$("#pB");if(b)busy(b,false)}}};
  draw()};

/* ---------- academia ---------- */
ROUTES.academia=()=>{app.innerHTML=`<div class="pagehead"><span class="eyebrow">Academia</span><h1>Temario</h1><p class="muted">Avanza en orden: cada lección se aprueba con sus ejercicios y cada módulo se desbloquea al terminar el anterior.</p>${premium()?"":`<div class="note">Puedes ver el temario completo. Las lecciones y los ejercicios son para alumnos premium. <a href="#premium">Ver cómo acceder</a></div>`}</div><div id="syl"></div>`;syllabus($("#syl"))};
ROUTES.modulo=id=>{const m=S.modules.find(x=>x.id===id);if(!m){app.innerHTML=`<div class="empty">Ese módulo no existe.<a class="btn sm" href="#academia">Ver temario</a></div>`;return}
  const ls=S.lindex.filter(l=>l.module_id===id);const prev=prevReq(m);const closedM=!modOpen(m);const locked=closedM||(premium()&&modLocked(m));
  app.innerHTML=`<div class="crumbs"><a href="#academia">Temario</a><span>/</span><span>${esc(m.category||"")}</span></div><div class="pagehead"><span class="eyebrow">${esc(m.level||m.category||"Módulo")}</span><h1>${esc(m.title)}</h1><p class="muted">${esc(m.descr||"")}</p>${premium()?`<div class="bar" style="max-width:420px"><i style="width:${Math.round(modProgress(id)*100)}%"></i></div>`:""}</div>
  ${closedM?`<div class="note">${m.open_at?`Este módulo se habilita el <b>${esc(new Date(m.open_at).toLocaleString("es-CO",{day:"2-digit",month:"long",hour:"2-digit",minute:"2-digit"}))}</b>.`:"Este módulo se habilitará pronto. Te avisaremos en la comunidad."}</div>`:locked?(prev&&needFb(prev)?`<div class="note">Para abrir este módulo, deja tu reseña de “${esc(prev.title)}”. <a href="#resena-${esc(prev.id)}">Dejar mi reseña</a></div>`:`<div class="note">Este módulo se desbloquea al aprobar todas las lecciones de “${esc(prev.title)}”.</div>`):""}
  ${premium()&&needFb(m)?fbCard(m):""}
  ${admin()&&m.ask_feedback!==false?`<div class="note admin-note">Vista de admin: a ti no te pide reseña. Los alumnos, al terminar este módulo, deben dejarla para abrir el siguiente. <a href="#resena-${esc(m.id)}">Ver el formulario como alumno</a></div>`:""}
  ${m.optional&&!closedM?`<div class="note">Módulo opcional: ${esc(m.optional_note||"si ya lo dominas, puedes saltarlo. No es necesario para abrir los módulos siguientes.")}</div>`:""}
  ${admin()&&!modOpen(m,true)?'<div class="note admin-note">Bloqueado para alumnos: solo tú lo ves abierto.</div>':""}
  <div class="list">${ls.map((l,k)=>{const d=S.prog&&S.prog.done[l.id];const cerrada=premium()&&!locked&&!closedM&&!lessonOpen(l);return `<a class="item${cerrada?" lock":""}" href="${premium()&&!locked&&!cerrada?"#leccion-"+esc(l.id):closedM||cerrada||locked&&premium()?"#modulo-"+esc(m.id):"#premium"}"><span class="ico ${d&&d.passed?"done":""}">${d&&d.passed?"✓":cerrada?"🔒":k+1}</span><span class="txt"><b>${esc(l.title)}</b><span>${cerrada?`Aprueba la lección anterior con ${(ls[k-1]&&ls[k-1].min_score)||80}% para abrirla`:`${l.has_video?"Video · ":""}${d?`Mejor resultado ${d.best}%`:"Pendiente"}`}</span></span>${premium()?"":'<span class="tag">Premium</span>'}</a>`}).join("")||'<div class="empty">Este módulo todavía no tiene lecciones.</div>'}</div>`};
ROUTES.leccion=async id=>{
  if(!logged()){location.hash="#entrar";return}
  if(!premium()){app.innerHTML=paywall();return}
  {const li=S.lindex.find(x=>x.id===id);const mm=li&&S.modules.find(x=>x.id===li.module_id);if(mm&&!modOpen(mm)){location.hash="#modulo-"+mm.id;return}
   if(li&&!lessonOpen(li)){toast(mm&&modLocked(mm)?(needFb(prevReq(mm))?"Primero deja tu reseña del módulo anterior.":"Primero aprueba todas las lecciones del módulo anterior."):"Primero aprueba la lección anterior.");location.hash="#modulo-"+li.module_id;return}}
  app.innerHTML='<div class="muted">Cargando lección…</div>';
  let l=null;try{l=await API.lesson(id)}catch(e){}
  if(!l){app.innerHTML=`<div class="empty">No encontramos esta lección.<a class="btn sm" href="#academia">Volver al temario</a></div>`;return}
  const m=S.modules.find(x=>x.id===l.module_id)||{title:"Módulo"};const ls=S.lindex.filter(x=>x.module_id===l.module_id);const k=ls.findIndex(x=>x.id===id);const next=ls[k+1];
  app.innerHTML=`<div class="crumbs"><a href="#academia">Temario</a><span>/</span><a href="#modulo-${esc(m.id||"")}">${esc(m.title)}</a><span>/</span><span>${esc(l.title)}</span></div>
   <div class="pagehead"><span class="eyebrow">Lección ${k+1}${l.status!=="publicado"?" · borrador":""}</span><h1>${esc(l.title)}</h1></div>
   <div id="vid"></div><div class="prose">${md(l.body)||'<p class="muted">El texto de esta lección se publicará pronto.</p>'}</div>
   <section class="sec" id="exsec"></section>
   <div class="row" style="justify-content:space-between"><a class="btn ghost" href="#modulo-${esc(l.module_id)}">Volver al módulo</a>${next&&(admin()||!m.locked||passedL(l.id))?`<a class="btn" href="#leccion-${esc(next.id)}">Siguiente lección</a>`:""}</div>`;
  videoBlock($("#vid"),l);
  let exs=[];try{exs=await API.exercises({lessonId:id})}catch(e){}
  const sec=$("#exsec");if(!sec)return;
  if(!exs.length){sec.innerHTML=`<div class="note">Esta lección no tiene ejercicios.</div><div><button class="btn gold" id="seen">Marcar como completada</button></div>`;$("#seen").onclick=()=>{passLesson(l,100);toast("Lección completada");if(needFb(m))sec.insertAdjacentHTML("beforeend",fbCard(m))};return}
  let i=0,res=[];const min=l.min_score||80;
  const draw=async()=>{if(!$("#exsec"))return;
    sec.innerHTML=`<div class="sec-h"><h2>Ejercicios</h2><span class="mono muted">${Math.min(i+1,exs.length)} / ${exs.length}</span></div><div class="dots">${exs.map((_,j)=>`<i class="${res[j]||""} ${j===i?"cur":""}"></i>`).join("")}</div><div id="exh"></div>`;
    if(i>=exs.length){const sc=Math.round(100*res.reduce((s,r)=>s+(r==="ok"?1:r==="mid"?.5:0),0)/exs.length);const ok=sc>=min;
      $("#exh").innerHTML=`<div class="result ${ok?"ok":"bad"}"><b class="big">${ok?"Lección aprobada":"Aún no apruebas"} · ${sc}%</b><div>${ok?"Puedes seguir con la próxima lección.":`Necesitas ${min}% para aprobar.`}</div><div class="row"><button class="btn" id="rt">Repetir ejercicios</button>${ok&&next?`<a class="btn gold" href="#leccion-${esc(next.id)}">Siguiente lección</a>`:""}</div></div>`;
      $("#rt").onclick=()=>{i=0;res=[];draw()};passLesson(l,sc);
      if(ok&&needFb(m)&&$("#exh"))$("#exh").insertAdjacentHTML("beforeend",fbCard(m));return}
    const h=await Player.mount($("#exh"),exs[i],{onDone:({res:r,pts})=>{res[i]=r;registerAnswer(exs[i].kind,r);exXP(exs[i],pts)},next:()=>{h&&h.destroy();i++;draw()},nextLabel:i+1<exs.length?"Siguiente ejercicio":"Ver resultado"});
    if(h)cleanup.push(h.destroy)};
  draw();
};
function passLesson(l,sc){const prev=S.prog.done[l.id]||{best:0,passed:false};const passed=prev.passed||sc>=(l.min_score||80);S.prog.done[l.id]={best:Math.max(prev.best||0,sc),passed,at:Date.now()};
  if(passed&&!prev.passed){ach("leccion");addXP(30);if(modProgress(l.module_id)>=1){ach("modulo");addXP(60)}}else saveProg()}
ROUTES.resena=id=>{if(!logged()){location.hash="#entrar";return}
  const m=S.modules.find(x=>x.id===id);if(!m){location.hash="#academia";return}
  if(S.fb.has(id)){app.innerHTML=`<div class="empty">Ya dejaste tu reseña de “${esc(m.title)}”. ¡Gracias!<a class="btn sm" href="#academia">Ver temario</a></div>`;return}
  if(modProgress(id)<1&&!admin()){app.innerHTML=`<div class="empty">Podrás dejar tu reseña cuando termines todas las lecciones de “${esc(m.title)}”.<a class="btn sm" href="#modulo-${esc(id)}">Ir al módulo</a></div>`;return}
  const i=S.modules.indexOf(m);const sig=S.modules.slice(i+1).find(x=>!x.optional&&modOpen(x));let r=0;
  app.innerHTML=`<div class="crumbs"><a href="#academia">Temario</a><span>/</span><a href="#modulo-${esc(id)}">${esc(m.title)}</a><span>/</span><span>Reseña</span></div>
  <div class="pagehead"><span class="eyebrow">Reseña del módulo</span><h1>¿Cómo te pareció “${esc(m.title)}”?</h1><p class="muted">Tu opinión es privada: solo la ve El Arte Gráfico y la usamos para mejorar las lecciones.</p></div>
  <form class="panel fb-form" id="fbf"><fieldset class="fb-stars" aria-label="Calificación"><legend>Calificación</legend>${[1,2,3,4,5].map(n=>`<button type="button" data-r="${n}" aria-label="${n} de 5">★</button>`).join("")}<span class="muted" id="fbRt">Toca las estrellas</span></fieldset>
   <label for="fbL">¿Qué te gustó? ¿Cómo te pareció el módulo?<textarea id="fbL" rows="4" maxlength="1500" required minlength="10" placeholder="Lo que más te sirvió, lo que entendiste mejor…"></textarea></label>
   <label for="fbI">¿Qué se puede mejorar?<textarea id="fbI" rows="4" maxlength="1500" required minlength="10" placeholder="Algo que no quedó claro, un tema que faltó, el audio, los ejercicios…"></textarea></label>
   <div class="row"><button class="btn gold" id="fbS">Enviar reseña${sig?" y seguir":""}</button></div></form>`;
  const txt=["","Muy malo","Malo","Regular","Bueno","Excelente"];
  const pint=n=>{$$("#fbf [data-r]").forEach(b=>b.classList.toggle("on",+b.dataset.r<=n));$("#fbRt").textContent=n?txt[n]:"Toca las estrellas"};
  $$("#fbf [data-r]").forEach(b=>{b.onclick=()=>{r=+b.dataset.r;pint(r)};b.onmouseenter=()=>pint(+b.dataset.r);b.onmouseleave=()=>pint(r)});
  $("#fbf").onsubmit=async e=>{e.preventDefault();if(!r){toast("Elige de 1 a 5 estrellas");return}
    const liked=$("#fbL").value.trim(),improve=$("#fbI").value.trim();if(liked.length<10||improve.length<10){toast("Escribe al menos una frase en cada pregunta");return}
    try{busy($("#fbS"),true);await API.sendFeedback({module_id:id,rating:r,liked,improve});S.fb.add(id);toast("¡Gracias por tu reseña!");location.hash=sig?"#modulo-"+sig.id:"#academia"}
    catch(x){if(/duplicate|unique|Ya dejaste/i.test(x.message)){S.fb.add(id);location.hash=sig?"#modulo-"+sig.id:"#academia";return}toast(x.message)}finally{busy($("#fbS"),false)}};
};
const paywall=()=>`<div class="cta-band">${premiumBand()}</div>`;
function videoBlock(host,l){
  const u=(l.video_url||"").trim();if(!u){host.innerHTML="";return}
  let last=0;const tick=s=>{if(s>0)API.addWatch(l.id,Math.min(120,Math.round(s)))};
  const yt=u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  const vm=u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  const bn=u.match(/(?:iframe|player)\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([\w-]+)/);
  const p=API.profile()||{};const wmText=`${p.username||""} · ${p.email||""}`;
  const shell=inner=>`<div class="vwrap"><div class="video">${inner}<div class="wm" aria-hidden="true">${esc(wmText)}</div></div>
    <div class="vbar"><span class="dim">Contenido exclusivo para ${esc(p.username||"alumnos")}. Prohibido grabar o compartir.</span><button type="button" class="btn sm ghost" data-fs>Pantalla completa</button></div></div>`;
  const mountExtras=()=>{const box=$(".video",host),wm=$(".wm",host);
    const move=()=>{wm.style.left=(8+Math.random()*58)+"%";wm.style.top=(8+Math.random()*74)+"%"};move();const mv=setInterval(move,15000);cleanup.push(()=>clearInterval(mv));
    $("[data-fs]",host).onclick=()=>{const fs=document.fullscreenElement;if(fs){document.exitFullscreen&&document.exitFullscreen()}else{(box.requestFullscreen||box.webkitRequestFullscreen||(()=>{})).call(box)}}};
  if(bn){const src=`https://iframe.mediadelivery.net/embed/${bn[1]}/${bn[2]}?autoplay=false&preload=true&responsive=true`;
    host.innerHTML=shell(`<iframe src="${src}" title="${esc(l.title)}" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" style="width:100%;height:100%;border:0"></iframe>`);mountExtras();
    // tiempo exacto con la API del reproductor de Bunny (player.js)
    const fr=$("iframe",host);let prevT=null,acc=0;
    const post=m=>{try{fr.contentWindow.postMessage(JSON.stringify(Object.assign({context:"player.js",version:"0.0.11"},m)),"*")}catch(e){}};
    const onMsg=e=>{if(!/mediadelivery\.net$/.test(new URL(e.origin).hostname))return;let d=e.data;try{if(typeof d==="string")d=JSON.parse(d)}catch(x){return}
      if(!d||d.context!=="player.js")return;if(d.event==="ready"){post({method:"addEventListener",value:"timeupdate",listener:"ag"})}
      if(d.event==="timeupdate"&&d.value){const t=+d.value.seconds||0;if(prevT!=null){const dt=t-prevT;if(dt>0&&dt<2)acc+=dt}prevT=t;if(acc>=30){tick(acc);acc=0}}};
    window.addEventListener("message",onMsg);cleanup.push(()=>{window.removeEventListener("message",onMsg);tick(acc)});return}
  if(yt||vm){const src=yt?`https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`:`https://player.vimeo.com/video/${vm[1]}?dnt=1`;
    host.innerHTML=shell(`<iframe src="${src}" title="${esc(l.title)}" allow="autoplay; picture-in-picture; encrypted-media" style="width:100%;height:100%;border:0"></iframe>`);mountExtras();
    // tiempo de video aproximado: mientras la lección está visible y la ventana enfocada después de interactuar con el video
    let active=false;const onBlur=()=>{if(document.activeElement&&document.activeElement.tagName==="IFRAME")active=true};window.addEventListener("blur",onBlur);
    const iv=setInterval(()=>{if(active&&document.visibilityState==="visible"){last+=30;if(last>=60){tick(last);last=0}}},30000);cleanup.push(()=>{clearInterval(iv);window.removeEventListener("blur",onBlur);tick(last)});return}
  if(/\.(mp4|webm|m3u8)(\?|$)/i.test(u)||u.includes("/storage/v1/object/")){host.innerHTML=shell(`<video controls preload="metadata" src="${esc(u)}" controlslist="nodownload noplaybackrate nofullscreen" disablepictureinpicture oncontextmenu="return false"></video>`);mountExtras();
    const v=$("video",host);let acc=0,prev=0;v.addEventListener("timeupdate",()=>{const d=v.currentTime-prev;prev=v.currentTime;if(d>0&&d<2)acc+=d;if(acc>=30){tick(acc);acc=0}});cleanup.push(()=>tick(acc));return}
  host.innerHTML=`<div class="video" style="aspect-ratio:auto;min-height:160px"><div class="ph"><b>Video de la lección</b><a class="btn gold" href="${esc(u)}" target="_blank" rel="noopener">Ver el video</a></div></div>`;
}

/* ---------- práctica ---------- */
ROUTES.practica=async()=>{
  if(!logged()){app.innerHTML=`<div class="pagehead"><span class="eyebrow">Práctica</span><h1>Practica con gráficas reales</h1></div><div class="panel demo-cta"><div><h3>Crea tu cuenta para practicar</h3><p class="muted">Con la cuenta gratis tienes 5 gráficas de prueba.</p></div><a class="btn gold" href="#registro">Crear cuenta gratis</a></div>`;return}
  if(!premium()){location.hash="#prueba";return}
  const pr=S.prog.practice;
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Práctica libre</span><h1>Práctica</h1><p class="muted">Ejercicios sueltos para entrenar el ojo. No cuentan para aprobar lecciones, pero cada gráfica nueva que resuelves suma puntos.</p></div>
    <div class="kv"><div><b>${pr.n}</b><span>resueltos</span></div><div><b>${pr.n?Math.round(100*pr.ok/pr.n):0}%</b><span>aciertos</span></div><div><b>${pr.row}</b><span>racha actual</span></div><div><b>${pr.best}</b><span>mejor racha</span></div></div><div id="ph"></div>`;
  let list=[];try{list=await API.exercises({practice:true})}catch(e){}
  if(!list.length){$("#ph").innerHTML='<div class="empty">Pronto habrá ejercicios de práctica libre.</div>';return}
  let h=null;const go=async()=>{h&&h.destroy();const ex=list[Math.floor(Math.random()*list.length)];
    h=await Player.mount($("#ph"),ex,{onDone:({res,pts})=>{registerAnswer(ex.kind,res);exXP(ex,pts)},next:go,nextLabel:"Otro ejercicio"});if(h)cleanup.push(()=>h&&h.destroy())};go();
};

/* ---------- comunidad ---------- */
ROUTES.comunidad=()=>ROUTES.noticias();
ROUTES.noticias=async()=>{app.innerHTML=`<div class="pagehead"><span class="eyebrow">Comunidad</span><h1>Noticias y actualizaciones</h1><p class="muted">Anuncios, cambios del método y conversación de la comunidad.${premium()?"":" Comentar es exclusivo para alumnos premium."}</p></div><div class="posts" id="pl"><div class="muted">Cargando…</div></div>`;
  try{const p=await API.posts();$("#pl").innerHTML=p.map(postCard).join("")||'<div class="empty">Todavía no hay publicaciones.</div>'}catch(e){$("#pl").innerHTML='<div class="empty">No se pudieron cargar las noticias.</div>'}};
ROUTES.nota=async id=>{app.innerHTML='<div class="muted">Cargando…</div>';let p=null;try{p=await API.post(id)}catch(e){}
  if(!p){app.innerHTML=`<div class="empty">Esta publicación no existe o es solo para premium.<a class="btn sm" href="#comunidad">Ver publicaciones</a></div>`;return}
  app.innerHTML=`<div class="crumbs"><a href="#comunidad">Comunidad</a><span>/</span><span>${esc(p.category||"Noticia")}</span></div>
   <article class="article"><div class="pagehead"><span class="eyebrow">${esc(p.category||"Noticia")} · ${fmtDate(p.created_at)}</span><h1>${esc(p.title)}</h1></div>${p.image_url?`<div class="cover" style="background-image:url('${esc(p.image_url)}')"></div>`:""}<div class="prose">${md(p.body)}</div></article>
   <section class="sec"><h2>Comentarios</h2><div id="cl" class="list"></div><div id="cf"></div></section>`;
  const load=async()=>{if(!logged()){$("#cl").innerHTML=`<div class="note"><a href="#entrar">Ingresa</a> para ver y escribir comentarios.</div>`;return}
    let cs=[];try{cs=await API.comments(id)}catch(e){}
    $("#cl").innerHTML=cs.map(c=>`<div class="comment"><div class="who">${avatar(c,30)}<b>${esc(c.username)}</b>${c.is_admin?'<span class="tag pub">El Arte Gráfico</span>':""}<span class="dim">${fmtDT(c.created_at)}</span>${c.mine||admin()?`<button class="btn sm ghost" data-del="${esc(c.id)}" style="margin-left:auto">Borrar</button>`:""}</div><div>${md(c.body)}</div></div>`).join("")||'<div class="muted">Sé el primero en comentar.</div>';
    $$("[data-del]").forEach(b=>b.onclick=async()=>{await API.delComment(b.dataset.del);load()})};
  load();
  if(logged()&&premium()&&p.allow_comments){$("#cf").innerHTML=`<form class="form" id="cfm"><label for="cb">Tu comentario<textarea id="cb" maxlength="2000" required style="min-height:100px"></textarea></label><div class="row"><button class="btn gold" id="cbg">Publicar comentario</button></div></form>`;
    $("#cfm").onsubmit=async e=>{e.preventDefault();const v=$("#cb").value.trim();if(!v)return;try{busy($("#cbg"),true);await API.addComment(id,v);$("#cb").value="";load()}catch(x){toast(x.message)}finally{busy($("#cbg"),false)}}}
  else if(logged()&&!premium())$("#cf").innerHTML=`<div class="note">Comentar es exclusivo para alumnos premium. <a href="#premium">Ver cómo acceder</a></div>`;
  else if(!p.allow_comments)$("#cf").innerHTML='<div class="dim">Los comentarios están cerrados en esta publicación.</div>';
};
ROUTES.opiniones=async()=>{
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Opiniones</span><h1>Opiniones de los alumnos</h1><div id="avg" class="muted"></div></div><div id="mine"></div><div id="rl"></div>`;
  try{const st=await API.publicStats();$("#avg").innerHTML=st.reviews?`<span class="stars big">${stars(st.rating)}</span> <b class="mono">${st.rating.toFixed(1)}</b> de 5 · ${st.reviews} opiniones`:"Aún no hay opiniones publicadas."}catch(e){}
  try{$("#rl").innerHTML=reviewsHTML(await API.publicReviews(),false)}catch(e){}
  if(!logged()){$("#mine").innerHTML=`<div class="note"><a href="#entrar">Ingresa</a> para dejar tu opinión.</div>`;return}
  let m=null;try{m=await API.myReview()}catch(e){}let rating=m?m.rating:0;
  $("#mine").innerHTML=`<div class="panel"><h3>${m?"Tu opinión":"Califica la academia"}</h3>${m&&!m.approved?'<span class="pill">En revisión: se publicará cuando sea aprobada</span>':m?'<span class="pill ok">Publicada</span>':""}
    <form class="form" id="rf"><div class="rate" role="radiogroup" aria-label="Calificación">${[1,2,3,4,5].map(n=>`<button type="button" role="radio" aria-checked="${n===rating}" data-r="${n}" aria-label="${n} estrellas">★</button>`).join("")}</div>
    <label for="rb">Comentario<textarea id="rb" maxlength="1500" placeholder="¿Qué te ha parecido la academia?">${esc(m?m.body:"")}</textarea></label><div class="row"><button class="btn gold" id="rg">${m?"Actualizar opinión":"Enviar opinión"}</button></div></form></div>`;
  const paint=()=>$$("[data-r]").forEach(b=>{b.classList.toggle("on",+b.dataset.r<=rating);b.setAttribute("aria-checked",String(+b.dataset.r===rating))});paint();
  $$("[data-r]").forEach(b=>b.onclick=()=>{rating=+b.dataset.r;paint()});
  $("#rf").onsubmit=async e=>{e.preventDefault();if(!rating)return toast("Elige de 1 a 5 estrellas");try{busy($("#rg"),true);await API.saveReview(rating,$("#rb").value.trim());toast("Gracias. Tu opinión quedó en revisión.");ROUTES.opiniones()}catch(x){toast(x.message)}finally{busy($("#rg"),false)}};
};
ROUTES.ranking=async()=>{app.innerHTML=`<div class="pagehead"><span class="eyebrow">Comunidad</span><h1>Ranking</h1><p class="muted">Puntos por ejercicios correctos y lecciones aprobadas. Los alumnos con la placa dorada son premium.</p></div><div id="rk" class="muted">Cargando…</div>`;
  try{const r=await API.leaderboard();const yo=r.find(x=>x.is_me);
    const cta=!logged()?`<div class="rk-cta"><div><b>¿Quieres aparecer aquí?</b><span class="muted">Crea tu cuenta gratis, haz tus primeros ejercicios y empieza a sumar puntos.</span></div><a class="btn gold" href="#registro">Crear cuenta</a></div>`
      :!premium()?`<div class="rk-cta"><div><b>${yo?`Vas en el puesto #${r.indexOf(yo)+1}`:"Aún no apareces en el ranking"}</b><span class="muted">Con premium tienes todas las lecciones y la práctica libre para sumar puntos sin límite, y tu placa dorada en el ranking.</span></div><a class="btn gold" href="#premium">Hazte premium</a></div>`:"";
    $("#rk").innerHTML=cta+(r.length?`${podio(r)}<div class="scroll"><table class="tbl rk"><thead><tr><th>#</th><th>Alumno</th><th class="c-hide">Nivel</th><th class="c-hide" style="text-align:right">Lecciones</th><th style="text-align:right">Puntos</th></tr></thead><tbody>${r.map((x,i)=>rkRow(x,i)).join("")}</tbody></table></div>`:'<div class="empty">Aún no hay alumnos en el ranking.</div>')}
  catch(e){$("#rk").textContent="No se pudo cargar el ranking."}};
const rkRow=(x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,28)}<span>${esc(x.username)}</span>${flag(x.country)}${x.premium?premTag():""}</span></td><td class="c-hide">${esc(levelOf(x.xp).name)}</td><td class="n c-hide">${x.lessons}</td><td class="n">${x.xp}</td></tr>`;
const podio=r=>r.length<3?"":`<div class="podio">${[1,0,2].map(i=>{const x=r[i];return `<div class="pod p${i+1}${x.premium?" prem":""}"><div class="pav">${avatar(x,i?64:84)}</div><b>${esc(x.username)} ${flag(x.country)}</b>${x.premium?premTag():'<span class="dim" style="font-size:13px">Gratis</span>'}<span class="mono">${x.xp} pts</span><div class="step">${i+1}</div></div>`}).join("")}</div>`;
ROUTES.perfil=arg=>{if(!logged()){location.hash="#entrar";return}setTimeout(()=>{const t={progreso:"cfgProg",app:"cfgApp",seguridad:"cfgSeg"}[arg];if(t&&$("#"+t))$("#"+t).scrollIntoView({behavior:"smooth",block:"start"})},150);const p=API.profile()||{},g=S.prog,lv=levelOf(g.xp);const pct=lv.to?Math.round(100*(g.xp-lv.from)/(lv.to-lv.from)):100;
  app.innerHTML=`<div class="phead"><div class="phead-av">${avatar(p,96)}</div><div style="display:grid;gap:6px;min-width:0"><span class="eyebrow">Configuración</span><h1>${esc(p.username||"")}</h1>
      <p class="muted">${esc(p.email||"")} · ${premium()?`Premium${p.premium_until&&new Date(p.premium_until).getFullYear()<2090?` hasta ${fmtDate(p.premium_until)}`:""}`:"Cuenta gratis"}${p.country?` · ${flag(p.country)} ${esc(p.country)}`:""}</p>${p.bio?`<p>${esc(p.bio)}</p>`:""}</div></div>
    <nav class="cfgnav" aria-label="Secciones">${[["cfgPerfil","Perfil"],["cfgApp","App y notificaciones"],["cfgProg","Mi progreso"],["cfgSeg","Seguridad"]].map(([i,t])=>`<button type="button" data-cfg="${i}">${t}</button>`).join("")}</nav>
    <section class="sec" id="cfgPerfil"><h2>Perfil</h2><form class="panel form" id="af">
      <div class="avedit"><div id="avPrev">${avatar(p,112)}</div><div style="display:grid;gap:8px"><b>Foto de perfil</b><span class="muted" style="font-size:14px">JPG, PNG o WebP. Se recorta en cuadrado y se ve en el ranking, los comentarios y las opiniones.</span>
        <div class="row"><label class="btn sm" for="avF" style="cursor:pointer">Cambiar foto</label><input id="avF" type="file" accept="image/jpeg,image/png,image/webp" hidden>${p.avatar_url?'<button type="button" class="btn sm ghost" id="avX">Quitar foto</button>':""}</div></div></div>
      <div class="two"><label for="aB">Sobre ti (opcional)<textarea id="aB" maxlength="160" style="min-height:76px" placeholder="Ej.: Opero Boom 1000 desde 2025. Aprendiendo a esperar mi zona.">${esc(p.bio||"")}</textarea><span class="dim" id="aBn" style="font-weight:400"></span></label>
        <label for="aC">País<select id="aC"><option value="">Prefiero no decirlo</option>${COUNTRIES.map(c=>`<option ${p.country===c?"selected":""}>${esc(c)}</option>`).join("")}</select></label></div>
      <div class="row"><button class="btn gold" id="aS">Guardar cambios</button></div></form></section>
    <section class="sec" id="cfgApp"><h2>App y notificaciones</h2><div id="appSet"></div></section>
    <section class="sec" id="cfgProg"><h2>Mi progreso</h2>
    <div class="lvl"><div class="medal">${lv.i+1}</div><div style="display:grid;gap:8px;min-width:0"><h2>${esc(lv.name)}</h2><div class="bar"><i style="width:${pct}%"></i></div><div class="muted mono">${g.xp} pts${lv.to?` · faltan ${lv.to-g.xp} para el siguiente nivel`:""}</div></div></div>
    <div class="kv" style="margin-top:14px"><div><b>${Object.values(g.done).filter(d=>d.passed).length}</b><span>lecciones aprobadas</span></div><div><b>${g.practice.n}</b><span>ejercicios resueltos</span></div><div><b>${g.practice.n?Math.round(100*g.practice.ok/g.practice.n):0}%</b><span>aciertos</span></div><div><b>${g.streak||0}</b><span>días seguidos</span></div></div></section>
    <section class="sec"><h2>Logros</h2><div class="badges">${ACH.map(a=>`<div class="badge ${g.ach.includes(a.id)?"on":""}"><b>${esc(a.t)}</b><span>${g.ach.includes(a.id)?"Conseguido":"Pendiente"}</span></div>`).join("")}</div></section>
    <section class="sec" id="cfgSeg"><h2>Seguridad</h2><div class="panel"><form class="form" id="pf" style="max-width:420px"><label for="np">Cambiar contraseña<input id="np" type="password" minlength="8" autocomplete="new-password"></label><button class="btn" id="npg">Guardar contraseña</button></form></div></section>`;
  appSettings($("#appSet"));
  $$("[data-cfg]").forEach(b=>b.onclick=()=>{const t=$("#"+b.dataset.cfg);if(t)t.scrollIntoView({behavior:"smooth",block:"start"})});
  let av=p.avatar_url||"";const bn=()=>$("#aBn").textContent=`${$("#aB").value.length}/160`;bn();$("#aB").oninput=bn;
  $("#avF").onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!/^image\/(jpeg|png|webp)$/.test(f.type))return toast("Usa una imagen JPG, PNG o WebP");if(f.size>12*1024*1024)return toast("La imagen es muy pesada (máx. 12 MB)");
    try{toast("Subiendo foto…");const b=await squareImage(f);av=await API.uploadAvatar(b);$("#avPrev").innerHTML=avatar({username:p.username,avatar_url:av},112);await API.updateMyProfile({avatar_url:av,bio:$("#aB").value.trim(),country:$("#aC").value});renderNav();toast("Foto actualizada")}catch(x){toast(x.message||"No se pudo subir la foto")}};
  if($("#avX"))$("#avX").onclick=async()=>{try{av="";await API.updateMyProfile({avatar_url:"",bio:$("#aB").value.trim(),country:$("#aC").value});renderNav();ROUTES.perfil();toast("Foto quitada")}catch(x){toast(x.message)}};
  $("#af").onsubmit=async e=>{e.preventDefault();try{busy($("#aS"),true);await API.updateMyProfile({avatar_url:av,bio:$("#aB").value.trim(),country:$("#aC").value});renderNav();toast("Cambios guardados");ROUTES.perfil()}catch(x){toast(x.message)}finally{busy($("#aS"),false)}};
  $("#pf").onsubmit=async e=>{e.preventDefault();const v=$("#np").value;if(v.length<8||!/[0-9]/.test(v)||!/[a-zA-Z]/.test(v))return toast("Mínimo 8 caracteres, con letras y números");try{await API.updatePassword(v);toast("Contraseña actualizada");$("#np").value=""}catch(x){toast(x.message)}}};
/* ---------- legal ---------- */
function legalText(key){const s=S.site||{},I=s.legalInfo||{},docs=window.AG_LEGAL||[];const d=docs.find(x=>x.key===key);if(!d)return null;
  const P=t=>`[pendiente: ${t}]`;
  const map={RESPONSABLE:I.owner||P("nombre del responsable"),DOCUMENTO:I.doc||P("cédula o NIT"),DOMICILIO:I.address||P("dirección"),CIUDAD:I.city||P("ciudad"),
    CORREO:I.email||P("correo de contacto"),TELEFONO:I.phone?" o al "+I.phone:"",TELEFONO_LINEA:I.phone?"\n- **Teléfono:** "+I.phone:"",SITIO:I.site||"elartegrafico.com",FECHA:I.date||"9 de noviembre de 2026"};
  const txt=((s.legalDocs||{})[key]||d.text).replace(/\{([A-Z_]+)\}/g,(m,k)=>k in map?map[k]:m);
  return{title:d.title,text:txt}}
ROUTES.terminos=()=>{location.hash="#legal-terminos"};ROUTES.privacidad=()=>{location.hash="#legal-privacidad"};
ROUTES.legal=key=>{const docs=window.AG_LEGAL||[];key=key||"terminos";const d=legalText(key)||legalText("terminos");
  app.innerHTML=`<div class="legal-page"><aside class="legal-nav"><span class="eyebrow">Legal</span>${docs.map(x=>`<a href="#legal-${x.key}" class="${x.key===key?"on":""}">${esc(x.title)}</a>`).join("")}</aside>
    <article class="article"><div class="pagehead"><span class="eyebrow">${esc(S.site.name||"El Arte Gráfico")}</span><h1>${esc(d.title)}</h1></div><div class="prose legal-doc">${md(d.text).replace(/\[pendiente: ([^\]]+)\]/g,'<mark>[pendiente: $1]</mark>')}</div></article></div>`};
ROUTES.prueba=()=>{location.hash="#inicio";setTimeout(()=>{const p=$("#prueba");p&&p.scrollIntoView({behavior:"smooth"})},350)};

/* exportar para los otros archivos */
window.AGAPP={absUrl,enablePush,flag,premTag,legalText,modOpen,modState,SITE,ACAD,link,toAcad,toMain,S,API,$,$$,esc,md,toast,busy,fmtT,fmtDate,fmtDT,TZ,MARKETS,MNAME,h1Bars,m5Bars,idxAt,avgRange,toC,Chart,cleanupPush:f=>cleanup.push(f),route,ROUTES,app,premium,admin,logged,confirmInline,loadContent:()=>loadContent(),renderFoot:()=>renderFoot(),applySite:()=>applySite()};

/* ---------- arranque ---------- */
async function loadContent(){try{S.modules=await API.modules()}catch(e){S.modules=[]}try{S.lindex=await API.lessonIndex()}catch(e){S.lindex=[]}}
function applySite(){const s=S.site,n=s.name||"El Arte Gráfico";$("#brandName").textContent=n.toUpperCase();if(s.logoUrl)$("#logoMark").src=s.logoUrl;
  $("#brandSub").textContent=ACAD?"ACADEMY":"TRADING · COMUNIDAD";document.body.dataset.site=SITE;
  document.title=ACAD?n+" Academy":n+" · Trading, educación y comunidad";renderFoot()}
/* ---------- app instalable + notificaciones ---------- */
const PWA={evt:null,reg:null};
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const pushSupported=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();PWA.evt=e;document.querySelectorAll("[data-install]").forEach(b=>b.hidden=false)});
window.addEventListener("appinstalled",()=>{PWA.evt=null;toast("App instalada. Búscala en tu pantalla de inicio.")});
function absUrl(site,hash){const l=link(site,hash);return /^https?:/.test(l)?l:location.origin+location.pathname+location.search+l}
async function pushState(){if(!pushSupported())return isIOS()&&!isStandalone()?"ios-install":"unsupported";
  if(Notification.permission==="denied")return"denied";
  try{const reg=await Promise.race([swReg(),new Promise((_,no)=>setTimeout(()=>no(new Error("t")),4000))]);const sub=await reg.pushManager.getSubscription();return sub&&Notification.permission==="granted"?"on":"off"}catch(e){return"off"}}
/* registro del service worker sin quedarse esperando para siempre (iPhone a veces tarda) */
async function swReg(){if(PWA.reg&&PWA.reg.active)return PWA.reg;
  let reg=await navigator.serviceWorker.getRegistration("/").catch(()=>null);if(!reg)reg=await navigator.serviceWorker.register("/sw.js").catch(()=>null);
  if(!reg)throw new Error("No se pudo preparar la app. Recarga la página.");
  for(let i=0;i<50&&!reg.active;i++)await new Promise(r=>setTimeout(r,100));PWA.reg=reg;return reg}
const b64u=s=>{const p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)))};
async function enablePush(){
  if(!logged()){toast("Inicia sesión para activar las notificaciones");return false}
  if(!pushSupported()){if(isIOS()&&!isStandalone())installHelp();else toast("Este navegador no permite notificaciones");return false}
  const perm=await Notification.requestPermission();if(perm!=="granted"){toast(perm==="denied"?"Bloqueaste las notificaciones. Actívalas en los ajustes del navegador.":"No se activaron las notificaciones");return false}
  try{const reg=await swReg();const key=await API.pushKey();
    let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});
    await API.savePushSub(sub,navigator.userAgent);toast("Notificaciones activadas");return true}catch(e){toast(e.message||"No se pudieron activar");return false}}
async function disablePush(){try{const reg=await swReg();const sub=await reg.pushManager.getSubscription();if(sub){await API.delPushSub(sub.endpoint);await sub.unsubscribe()}toast("Notificaciones desactivadas")}catch(e){toast(e.message)}}
function installHelp(){const ios=isIOS();
  const m=document.createElement("div");m.className="modal";m.innerHTML=`<div class="modal-box" role="dialog" aria-modal="true" aria-label="Instalar la app"><img src="assets/icon-192.png" alt="" width="64" height="64" style="border-radius:16px">
    <h3>Instala El Arte Gráfico</h3>${ios?`<ol class="steps-ol"><li>Toca el botón <b>Compartir</b> <span class="kbd">⬆︎</span> abajo en Safari.</li><li>Elige <b>“Agregar a inicio”</b>.</li><li>Abre la app desde tu pantalla de inicio y activa las notificaciones en <b>Mi cuenta</b>.</li></ol><p class="dim">En iPhone hay que usar Safari. Las notificaciones solo funcionan con la app agregada al inicio.</p>`
    :`<ol class="steps-ol"><li>Abre el menú del navegador <span class="kbd">⋮</span>.</li><li>Elige <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.</li></ol>`}<button class="btn gold" data-close>Entendido</button></div>`;
  document.body.appendChild(m);const close=()=>m.remove();m.onclick=e=>{if(e.target===m||e.target.hasAttribute("data-close"))close()}}
async function installApp(){if(PWA.evt){PWA.evt.prompt();try{await PWA.evt.userChoice}catch(e){}PWA.evt=null;return}installHelp()}
/* tarjeta "instala la app / activa notificaciones" (se puede cerrar) */
/* se muestra hasta que el alumno tenga las notificaciones activas; la X lo oculta solo hasta la próxima visita */
async function appCard(host){if(!host||!logged())return;let hid=false;try{hid=sessionStorage.getItem("ag_appcard_x")==="1"}catch(e){}if(hid)return;
  const ps=await pushState();const inst=isStandalone();if(ps==="on"||(inst&&ps==="unsupported"))return;
  host.innerHTML=`<div class="appcard"><img src="assets/icon-192.png" alt="" width="52" height="52"><div class="t"><b>${inst?"Activa las notificaciones":"Lleva El Arte Gráfico en tu celular"}</b><span class="muted">${ps==="denied"?"Las notificaciones están bloqueadas: permite las notificaciones de este sitio en los ajustes del navegador (el candado junto a la dirección) y recarga la página.":inst?"Te avisamos cuando salga un módulo nuevo, una clase en vivo o una publicación importante.":"Instala la app y activa las notificaciones para enterarte de módulos nuevos, clases en vivo y avisos."}</span></div>
    <div class="row">${inst?"":`<button class="btn sm gold" data-ac="inst">Instalar app</button>`}${ps==="off"||ps==="ios-install"?`<button class="btn sm${inst?" gold":""}" data-ac="push">Activar notificaciones</button>`:""}<button class="btn sm ghost" data-ac="x" aria-label="Cerrar por ahora" title="Cerrar por ahora">✕</button></div></div>`;
  $("[data-ac=x]",host).onclick=()=>{try{sessionStorage.setItem("ag_appcard_x","1")}catch(e){}host.innerHTML=""};
  const i=$("[data-ac=inst]",host);if(i)i.onclick=installApp;const pb=$("[data-ac=push]",host);if(pb)pb.onclick=async()=>{if(await enablePush())appCard(host)}}
/* sección en Mi cuenta */
async function appSettings(host){if(!host)return;const ps=await pushState();const inst=isStandalone();
  const st={on:'<span class="pill ok">Activadas en este dispositivo</span>',off:'<span class="pill">Desactivadas</span>',denied:'<span class="pill">Bloqueadas en el navegador</span>',"ios-install":'<span class="pill">Primero agrega la app a tu inicio</span>',unsupported:'<span class="pill">Este navegador no las permite</span>'}[ps];
  host.innerHTML=`<div class="panel" style="display:grid;gap:12px"><div class="row" style="justify-content:space-between"><div style="display:grid;gap:4px"><b>Notificaciones</b><span class="muted" style="font-size:14px">Módulos nuevos, clases en vivo y avisos importantes. Se activan por dispositivo (celular y computador por separado).</span></div>${st}</div>
    <div class="row">${ps==="on"?'<button class="btn sm ghost" data-ps="off">Desactivar en este dispositivo</button>':ps==="off"?'<button class="btn sm gold" data-ps="on">Activar notificaciones</button>':ps==="denied"?'<span class="dim" style="font-size:13.5px">Para activarlas, permite las notificaciones de elartegrafico.com en los ajustes del navegador y recarga.</span>':""}
      ${inst?'<span class="pill ok">Estás usando la app</span>':`<button class="btn sm" data-ps="inst">Instalar la app</button>`}</div></div>`;
  const on=$("[data-ps=on]",host),off=$("[data-ps=off]",host),ins=$("[data-ps=inst]",host);
  if(on)on.onclick=async()=>{await enablePush();appSettings(host)};if(off)off.onclick=async()=>{await disablePush();appSettings(host)};if(ins)ins.onclick=installApp}

async function boot(){
  if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("/sw.js").then(r=>{PWA.reg=r}).catch(()=>{});
  if(API.mode==="local")$("#localbar").innerHTML=`<div class="localbar"><div class="wrap"><b>Modo de prueba</b><span>Los datos se guardan solo en este navegador. Administrador de prueba: admin@elartegrafico.com · admin1234</span><button id="rstLocal">Reiniciar datos de prueba</button></div></div>`;
  const r=$("#rstLocal");if(r)r.onclick=()=>API.resetLocal();
  let rec=false;try{rec=(await API.init()).recovery}catch(e){}
  try{S.site=await API.site()}catch(e){S.site={}}applySite();
  await loadProg();await loadContent();S.loaded=true;
  if(rec)location.hash="#nueva-clave";
  route();
}
window.AGBOOT=boot;
})();
