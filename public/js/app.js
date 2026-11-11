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
const blankProg=()=>({xp:0,done:{},streak:0,lastDay:"",practice:{n:0,ok:0,row:0,best:0},ach:[]});
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
function renderNav(){
  let r=(location.hash||"#inicio").slice(1).split("-")[0];if(r==="noticias"||r==="nota")r="comunidad";
  const L=ACAD?[["inicio","Mi panel"],["academia","Temario"],["practica","Práctica"],["ranking","Ranking"]].concat(premium()?[]:[["prueba","Prueba gratis"]])
             :[["inicio","Inicio"],["comunidad","Comunidad"],["opiniones","Opiniones"],["mercados","Mercados"],["premium","Premium"]];
  if(ACAD&&closedAcad()&&!admin())L.length=0;
  const u=API.user(),p=API.profile();const lv=levelOf((S.prog&&S.prog.xp)||0);
  const other=ACAD?`<a class="navx" href="${toMain("inicio")}">El Arte Gráfico ↗</a>`:(u&&p?`<a class="btn sm gold navacad" href="${toAcad("inicio")}">Ir a la academia</a>`:"");
  $("#nav").innerHTML=L.map(([k,t])=>`<a href="#${k}" class="${r===k?"on":""}">${t}</a>`).join("")+other+
    (u&&p?`<div class="dd" id="dd"><button aria-haspopup="true" aria-expanded="false" id="ddb">${avatar(p,28)}<span>${esc(p.username)}</span>${premium()?'<span class="prem-badge">Premium</span>':""}</button>
      <div class="menu" hidden><div class="who">${esc(p.email||"")}<br>${esc(lv.name)} · ${S.prog?S.prog.xp:0} pts</div>
      ${ACAD?`<a href="#perfil">Mi progreso y cuenta</a><a href="#ranking">Ranking</a><a href="${toMain("inicio")}">Ir a El Arte Gráfico</a>`:`<a href="${toAcad("inicio")}">Ir a la academia</a><a href="#perfil">Mi cuenta y foto</a><a href="#comunidad">Comunidad</a>`}
      ${premium()?"":'<a href="#premium">Hazte premium</a>'}${admin()?'<a href="#admin">Administración</a>':""}<button id="logout">Cerrar sesión</button></div></div>`
     :`<div class="userbox"><a class="btn sm ghost" href="${toMain("entrar")}">Ingresar</a><a class="btn sm gold" href="${toMain("registro")}">Crear cuenta</a></div>`);
  const dd=$("#dd");if(dd){const b=$("#ddb"),m=$(".menu",dd);b.onclick=e=>{e.stopPropagation();m.hidden=!m.hidden;b.setAttribute("aria-expanded",String(!m.hidden))};document.addEventListener("click",()=>{m.hidden=true},{once:true});
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
const statsBand=()=>API.publicStats().then(st=>{if(!$("#stats"))return;$("#stats").innerHTML=[[st.students,"alumnos registrados"],[st.lessons,"lecciones publicadas"],[st.exercises,"ejercicios"],[st.rating?st.rating.toFixed(1)+" / 5":"—",st.reviews?`calificación · ${st.reviews} opiniones`:"calificación"]].map(([v,t])=>`<div><b class="mono">${esc(v??0)}</b><span>${t}</span></div>`).join("")}).catch(()=>{});
const DISC={title:"La comunidad de El Arte Gráfico",text:"Un espacio para traders que operan con reglas: análisis del día, dudas resueltas, avisos del método y acompañamiento entre alumnos.",items:["Análisis y zonas compartidas a diario","Avisos de actualizaciones y nuevas lecciones","Resolución de dudas con el equipo","Comunidad de alumnos que practican el mismo método"]};

/* ---------- inicio del sitio principal ---------- */
async function mainHome(){
  const s=S.site,p=API.profile();
  const dItems=(s.discordItems&&s.discordItems.length?s.discordItems:DISC.items);
  app.innerHTML=`${logged()&&p?`<section class="welcome"><a class="welcome-av" href="#perfil" title="Mi cuenta">${avatar(p,56)}</a><div style="flex:1;min-width:200px"><span class="eyebrow">Tu cuenta</span><h2>Hola, ${esc(p.username)}</h2><p class="muted">${closedAcad()&&!admin()?"Tu cuenta ya quedó creada. La academia abre muy pronto: te avisaremos por aquí y en la comunidad.":premium()?"Tienes acceso premium a toda la academia.":`Cuenta gratis · tienes ${Math.max(0,5-(p.demo_used||0))} de 5 gráficas de prueba en la academia.`}</p></div>${closedAcad()&&!admin()?'<span class="pill">Academia: próximamente</span>':`<a class="btn gold" href="${toAcad("inicio")}">Ir a la academia</a>`}</section>`:""}
  <section id="hero"></section><section class="statband" id="stats"></section>
  <section class="sec"><div class="disc">
    <div class="disc-main"><span class="eyebrow">Comunidad</span><h2>${esc(s.discordTitle||DISC.title)}</h2><p class="muted">${esc(s.discordText||DISC.text)}</p>
      <ul class="checks">${dItems.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
      <div class="cstats" id="cstats">${(s.communityStats||[]).map(c=>`<div><b class="mono">${esc(c.v)}</b><span>${esc(c.t)}</span></div>`).join("")}</div>
      <div class="row">${s.discordUrl?`<a class="btn gold btn-ic" href="${esc(s.discordUrl)}" target="_blank" rel="noopener">${ICON_CHAT}<span>Unirme al Discord</span></a>`:'<span class="pill">El enlace al Discord se publicará pronto</span>'}<a class="btn ghost" href="#comunidad">Ver publicaciones</a></div></div>
    <div class="disc-news"><div class="sec-h"><h3>Últimas publicaciones</h3><a href="#comunidad">Ver todo</a></div><div id="newsMini" class="minis"><div class="muted">Cargando…</div></div></div>
  </div></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">La academia</span><h2>Qué vas a aprender</h2></div><a href="${toAcad("inicio")}">Ir a la academia</a></div><div class="cards" id="cards"></div>
    <div class="panel acad-cta"><div><h3>Practica en gráficas reales</h3><p class="muted">Marca la zona en H1, baja a M5 para poner el stop loss y mira la repetición de lo que habría pasado. Con tu cuenta gratis tienes 5 gráficas de prueba.</p></div>
      <div class="row">${logged()?`<a class="btn gold" href="${toAcad(premium()?"inicio":"prueba")}">${premium()?"Ir a la academia":"Probar gratis"}</a>`:'<a class="btn gold" href="#registro">Crear cuenta gratis</a><a class="btn ghost" href="#entrar">Ya tengo cuenta</a>'}</div></div></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Metodología</span><h2>Cómo se aprende</h2></div></div><div class="steps" id="steps"></div></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Mercados</span><h2>Empezamos por sintéticos. Vamos por todo el mercado.</h2></div><a href="#mercados">Ver mercados</a></div><div class="mkts" id="mkts"></div></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Opiniones</span><h2>Lo que dicen los alumnos</h2></div><a href="#opiniones">Ver todas</a></div><div id="revs"></div></section>
  <section class="cta-band" id="premiumBand"></section>`;
  API.slides("home").then(sl=>slider($("#hero"),sl)).catch(()=>slider($("#hero"),[]));statsBand();
  if(s.discordUrl)discordCounts(s.discordUrl).then(d=>{const h=$("#cstats");if(!h||!d||!d.members)return;
    h.insertAdjacentHTML("afterbegin",`<div><b class="mono">${fmtN(d.members)}</b><span>miembros en Discord</span></div>${d.online?`<div><b class="mono"><i class="live"></i>${fmtN(d.online)}</b><span>conectados ahora</span></div>`:""}`)});
  $("#cards").innerHTML=(s.cards||[]).map((c,i)=>`<div class="card"><span class="k">${String(i+1).padStart(2,"0")}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join("");
  $("#mkts").innerHTML=marketsHTML(s.markets||[],true);
  $("#steps").innerHTML=(s.steps||[]).map((c,i)=>`<div class="step"><span class="n">Paso ${i+1}</span><h3>${esc(c.title)}</h3><p class="muted">${esc(c.text)}</p></div>`).join("");
  $("#premiumBand").innerHTML=premiumBand();
  API.publicReviews().then(r=>{if($("#revs"))$("#revs").innerHTML=reviewsHTML(r.slice(0,3),true)}).catch(()=>{});
  API.posts().then(p=>{if($("#newsMini"))$("#newsMini").innerHTML=p.slice(0,4).map(x=>`<a class="mini" href="#nota-${esc(x.id)}"><span class="dim">${fmtDate(x.created_at)} · ${esc(x.category||"Noticia")}</span><b>${esc(x.title)}</b></a>`).join("")||'<div class="muted">Pronto publicaremos noticias y actualizaciones.</div>'}).catch(()=>{if($("#newsMini"))$("#newsMini").innerHTML='<div class="muted">Sin publicaciones por ahora.</div>'});
}

/* ---------- panel de la academia ---------- */
function nextLesson(){for(const m of S.modules){if(!modOpen(m)||m.optional)continue;const ls=S.lindex.filter(l=>l.module_id===m.id).sort((a,b)=>(a.sort||0)-(b.sort||0));for(const l of ls){if(!(S.prog.done[l.id]&&S.prog.done[l.id].passed))return l}}return null}
async function academyHome(){
  const p=API.profile()||{},g=S.prog,lv=levelOf(g.xp);const pct=lv.to?Math.round(100*(g.xp-lv.from)/(lv.to-lv.from)):100;const nx=premium()?nextLesson():null;
  const passed=Object.values(g.done).filter(d=>d.passed).length,total=S.lindex.length;
  app.innerHTML=`<section class="dash"><a class="dash-av" href="#perfil" title="Cambiar foto">${avatar(p,86)}<span class="lvchip" title="${esc(lv.name)}">${lv.i+1}</span></a><div class="dash-t"><span class="eyebrow">Academia · ${premium()?"Premium":"Cuenta gratis"}</span><h1>Hola, ${esc(p.username||"")}</h1>
      <div class="muted">${esc(lv.name)} · <span class="mono">${g.xp} pts</span>${lv.to?` · faltan ${lv.to-g.xp} para el siguiente nivel`:""}</div><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="dash-a">${premium()?(nx?`<a class="btn gold" href="#leccion-${esc(nx.id)}">Continuar: ${esc(nx.title)}</a>`:'<a class="btn gold" href="#practica">Ir a práctica</a>'):'<a class="btn gold" href="#premium">Hazte premium</a>'}</div></section>
  ${premium()?(m=>m?fbCard(m):"")(S.modules.find(needFb)):""}
  <div class="kv"><div><b>${passed}${total?` / ${total}`:""}</b><span>lecciones aprobadas</span></div><div><b>${g.practice.n}</b><span>ejercicios resueltos</span></div><div><b>${g.practice.n?Math.round(100*g.practice.ok/g.practice.n):0}%</b><span>aciertos</span></div><div><b>${g.streak||0}</b><span>días seguidos</span></div></div>
  ${premium()?"":`<section class="sec" id="prueba"><div class="sec-h"><div><span class="eyebrow">Prueba gratis</span><h2>Tus gráficas de prueba</h2></div><span class="muted" id="demoLeft"></span></div><div id="demoBox"></div></section>`}
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Temario</span><h2>Ruta de aprendizaje</h2></div><a href="#academia">Ver temario completo</a></div><div id="syl"></div></section>
  ${premium()?`<section class="sec"><div class="two"><div class="panel"><h3>Práctica libre</h3><p class="muted">Ejercicios sueltos para entrenar el ojo. Suman puntos para el ranking.</p><div class="row"><a class="btn" href="#practica">Practicar ahora</a></div></div><div class="panel"><div class="sec-h"><h3>Ranking</h3><a href="#ranking">Ver completo</a></div><div id="rkMini" class="muted">Cargando…</div></div></div></section>`:`<section class="sec"><div class="panel"><div class="sec-h"><h3>Ranking de alumnos</h3><a href="#ranking">Ver completo</a></div><div id="rkMini" class="muted">Cargando…</div></div></section><section class="cta-band">${premiumBand()}</section>`}`;
  syllabus($("#syl"),premium()?0:6);if(!premium())demoSection();
  API.leaderboard().then(r=>{if(!$("#rkMini"))return;$("#rkMini").innerHTML=r.length?`<table class="tbl rk">${r.slice(0,5).map((x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,24)}<span>${esc(x.username)}</span>${flag(x.country)}${x.premium?premTag():""}</span></td><td class="n">${x.xp}</td></tr>`).join("")}</table>`:'<div class="muted">Aún no hay alumnos en el ranking.</div>'}).catch(()=>{});
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
const postCard=p=>`<a class="post" href="#nota-${esc(p.id)}">${p.image_url?`<div class="thumb" style="background-image:url('${esc(p.image_url)}')"></div>`:`<div class="thumb noimg">AG</div>`}<div style="display:grid;gap:6px;align-content:start;min-width:0"><div class="row"><span class="tag">${esc(p.category||"Noticia")}</span>${p.pinned?'<span class="tag pub">Fijado</span>':""}${p.premium_only?'<span class="tag">Premium</span>':""}<span class="dim" style="font-size:13px">${fmtDate(p.created_at)}</span></div><h3>${esc(p.title)}</h3><p class="muted clamp">${esc(String(p.body||"").slice(0,220))}</p></div></a>`;
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
  const h=await Player.mount(box,pick,{onDone:({res,pts})=>{registerAnswer(pick.kind,res);if(pts)addXP(pts);const l=premium()?null:Math.max(0,5-((API.profile()||{}).demo_used||0));if(l!=null)$("#demoLeft").textContent=`Te quedan ${l} de 5 gráficas`},
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
ROUTES.premium=()=>{const s=S.site;const plans=(s.plans||[]).filter(x=>x&&x.name);const bin=!!(s.binancePayId&&plans.length);
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Premium</span><h1>${esc(s.premiumTitle||"Hazte premium")}</h1><p class="muted">${esc(s.premiumText||"")}</p></div>
  <div class="cta-band">${premiumBand()}</div>
  ${bin?`<div class="panel" id="pay"><h3>Paga con Binance Pay</h3>
    <div class="plans">${plans.map(x=>`<div class="plan"><b>${esc(x.name)}</b><span class="price">${esc(x.price)}</span><span class="dim">${x.days} días de acceso</span></div>`).join("")}</div>
    <ol class="prose" style="padding-left:20px">
      <li>${logged()?"Ya tienes tu cuenta creada.":'<a href="#registro">Crea tu cuenta gratis</a> o <a href="#entrar">ingresa</a>.'}</li>
      <li>En la app de Binance entra a <b>Pay → Enviar</b> y envía el monto de tu plan al <b>Binance Pay ID</b>: <b class="mono sel" id="bpid">${esc(s.binancePayId)}</b> <button type="button" class="btn sm ghost" id="cpid">Copiar</button>${s.binanceName?` <span class="dim">(${esc(s.binanceName)})</span>`:""}</li>
      <li>Cuando termine, abre el pago en tu historial y copia el <b>ID de orden</b>.</li>
      <li>Regístralo aquí abajo. Revisamos el pago y activamos tu acceso premium.</li></ol>
    ${s.payNote?`<div class="note">${esc(s.payNote)}</div>`:""}
    <div id="payf"></div></div>`:
  `<div class="panel"><h3>Cómo activar tu acceso</h3><ol class="prose" style="padding-left:20px"><li>${logged()?"Ya tienes tu cuenta creada.":'<a href="#registro">Crea tu cuenta gratis</a>.'}</li><li>Escríbenos para realizar el pago${s.contact?`: <b class="sel">${esc(s.contact)}</b>`:"."}</li><li>Activamos tu acceso premium y entras a todo el contenido.</li></ol>${logged()?`<p class="muted">Tu usuario: <b>${esc((API.profile()||{}).username||"")}</b> · ${esc((API.profile()||{}).email||"")}</p>`:""}</div>`}`;
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
    const h=await Player.mount($("#exh"),exs[i],{onDone:({res:r,pts})=>{res[i]=r;registerAnswer(exs[i].kind,r);if(pts)addXP(pts)},next:()=>{h&&h.destroy();i++;draw()},nextLabel:i+1<exs.length?"Siguiente ejercicio":"Ver resultado"});
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
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Práctica libre</span><h1>Práctica</h1><p class="muted">Ejercicios sueltos para entrenar el ojo. No cuentan para aprobar lecciones, pero sí suman puntos.</p></div>
    <div class="kv"><div><b>${pr.n}</b><span>resueltos</span></div><div><b>${pr.n?Math.round(100*pr.ok/pr.n):0}%</b><span>aciertos</span></div><div><b>${pr.row}</b><span>racha actual</span></div><div><b>${pr.best}</b><span>mejor racha</span></div></div><div id="ph"></div>`;
  let list=[];try{list=await API.exercises({practice:true})}catch(e){}
  if(!list.length){$("#ph").innerHTML='<div class="empty">Pronto habrá ejercicios de práctica libre.</div>';return}
  let h=null;const go=async()=>{h&&h.destroy();const ex=list[Math.floor(Math.random()*list.length)];
    h=await Player.mount($("#ph"),ex,{onDone:({res,pts})=>{registerAnswer(ex.kind,res);if(pts)addXP(pts)},next:go,nextLabel:"Otro ejercicio"});if(h)cleanup.push(()=>h&&h.destroy())};go();
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
    $("#rk").innerHTML=cta+(r.length?`${podio(r)}<div class="scroll"><table class="tbl rk"><thead><tr><th>#</th><th>Alumno</th><th>Nivel</th><th style="text-align:right">Lecciones</th><th style="text-align:right">Puntos</th></tr></thead><tbody>${r.map((x,i)=>rkRow(x,i)).join("")}</tbody></table></div>`:'<div class="empty">Aún no hay alumnos en el ranking.</div>')}
  catch(e){$("#rk").textContent="No se pudo cargar el ranking."}};
const rkRow=(x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,28)}<span>${esc(x.username)}</span>${flag(x.country)}${x.premium?premTag():""}</span></td><td>${esc(levelOf(x.xp).name)}</td><td class="n">${x.lessons}</td><td class="n">${x.xp}</td></tr>`;
const podio=r=>r.length<3?"":`<div class="podio">${[1,0,2].map(i=>{const x=r[i];return `<div class="pod p${i+1}${x.premium?" prem":""}"><div class="pav">${avatar(x,i?64:84)}</div><b>${esc(x.username)} ${flag(x.country)}</b>${x.premium?premTag():'<span class="dim" style="font-size:13px">Gratis</span>'}<span class="mono">${x.xp} pts</span><div class="step">${i+1}</div></div>`}).join("")}</div>`;
ROUTES.perfil=()=>{if(!logged()){location.hash="#entrar";return}const p=API.profile()||{},g=S.prog,lv=levelOf(g.xp);const pct=lv.to?Math.round(100*(g.xp-lv.from)/(lv.to-lv.from)):100;
  app.innerHTML=`<div class="phead"><div class="phead-av">${avatar(p,96)}</div><div style="display:grid;gap:6px;min-width:0"><span class="eyebrow">Mi cuenta</span><h1>${esc(p.username||"")}</h1>
      <p class="muted">${esc(p.email||"")} · ${premium()?`Premium${p.premium_until&&new Date(p.premium_until).getFullYear()<2090?` hasta ${fmtDate(p.premium_until)}`:""}`:"Cuenta gratis"}${p.country?` · ${flag(p.country)} ${esc(p.country)}`:""}</p>${p.bio?`<p>${esc(p.bio)}</p>`:""}</div></div>
    <section class="sec"><h2>Ajustes de cuenta</h2><form class="panel form" id="af">
      <div class="avedit"><div id="avPrev">${avatar(p,112)}</div><div style="display:grid;gap:8px"><b>Foto de perfil</b><span class="muted" style="font-size:14px">JPG, PNG o WebP. Se recorta en cuadrado y se ve en el ranking, los comentarios y las opiniones.</span>
        <div class="row"><label class="btn sm" for="avF" style="cursor:pointer">Cambiar foto</label><input id="avF" type="file" accept="image/jpeg,image/png,image/webp" hidden>${p.avatar_url?'<button type="button" class="btn sm ghost" id="avX">Quitar foto</button>':""}</div></div></div>
      <div class="two"><label for="aB">Sobre ti (opcional)<textarea id="aB" maxlength="160" style="min-height:76px" placeholder="Ej.: Opero Boom 1000 desde 2025. Aprendiendo a esperar mi zona.">${esc(p.bio||"")}</textarea><span class="dim" id="aBn" style="font-weight:400"></span></label>
        <label for="aC">País<select id="aC"><option value="">Prefiero no decirlo</option>${COUNTRIES.map(c=>`<option ${p.country===c?"selected":""}>${esc(c)}</option>`).join("")}</select></label></div>
      <div class="row"><button class="btn gold" id="aS">Guardar cambios</button></div></form></section>
    <section class="sec"><h2>Mi progreso</h2>
    <div class="lvl"><div class="medal">${lv.i+1}</div><div style="display:grid;gap:8px;min-width:0"><h2>${esc(lv.name)}</h2><div class="bar"><i style="width:${pct}%"></i></div><div class="muted mono">${g.xp} pts${lv.to?` · faltan ${lv.to-g.xp} para el siguiente nivel`:""}</div></div></div>
    <div class="kv" style="margin-top:14px"><div><b>${Object.values(g.done).filter(d=>d.passed).length}</b><span>lecciones aprobadas</span></div><div><b>${g.practice.n}</b><span>ejercicios resueltos</span></div><div><b>${g.practice.n?Math.round(100*g.practice.ok/g.practice.n):0}%</b><span>aciertos</span></div><div><b>${g.streak||0}</b><span>días seguidos</span></div></div></section>
    <section class="sec"><h2>Logros</h2><div class="badges">${ACH.map(a=>`<div class="badge ${g.ach.includes(a.id)?"on":""}"><b>${esc(a.t)}</b><span>${g.ach.includes(a.id)?"Conseguido":"Pendiente"}</span></div>`).join("")}</div></section>
    <section class="sec"><h2>Seguridad</h2><div class="panel"><form class="form" id="pf" style="max-width:420px"><label for="np">Cambiar contraseña<input id="np" type="password" minlength="8" autocomplete="new-password"></label><button class="btn" id="npg">Guardar contraseña</button></form></div></section>`;
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
window.AGAPP={flag,premTag,legalText,modOpen,modState,SITE,ACAD,link,toAcad,toMain,S,API,$,$$,esc,md,toast,busy,fmtT,fmtDate,fmtDT,TZ,MARKETS,MNAME,h1Bars,m5Bars,idxAt,avgRange,toC,Chart,cleanupPush:f=>cleanup.push(f),route,ROUTES,app,premium,admin,logged,confirmInline,loadContent:()=>loadContent(),renderFoot:()=>renderFoot(),applySite:()=>applySite()};

/* ---------- arranque ---------- */
async function loadContent(){try{S.modules=await API.modules()}catch(e){S.modules=[]}try{S.lindex=await API.lessonIndex()}catch(e){S.lindex=[]}}
function applySite(){const s=S.site,n=s.name||"El Arte Gráfico";$("#brandName").textContent=n.toUpperCase();if(s.logoUrl)$("#logoMark").src=s.logoUrl;
  $("#brandSub").textContent=ACAD?"ACADEMY":"TRADING · COMUNIDAD";document.body.dataset.site=SITE;
  document.title=ACAD?n+" Academy":n+" · Trading, educación y comunidad";renderFoot()}
async function boot(){
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
