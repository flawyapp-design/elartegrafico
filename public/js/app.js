/* El Arte Gráfico Academy — aplicación. © El Arte Gráfico. Todos los derechos reservados.
   Prohibida su copia, modificación o distribución sin autorización escrita. */
(function(){
"use strict";
/* sin zoom de página (pellizco en iPhone): se siente como una app */
["gesturestart","gesturechange"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
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
/* modo prueba del admin: ver la página como un alumno (gratis, en prueba gratis o premium) sin cambiar de usuario */
const VIEWS={gratis:"Alumno gratis",prueba:"Alumno en prueba gratis",curso:"Alumno con un curso",cobre:"Suscriptor Cobre",plata:"Suscriptor Plata",oro:"Suscriptor Oro",diamond:"Suscriptor Diamond"};
const viewAs=()=>{if(!API.isAdmin())return"";let v="";try{v=sessionStorage.getItem("ag_view_as")||""}catch(e){}return VIEWS[v]?v:""};
const setViewAs=v=>{try{v?sessionStorage.setItem("ag_view_as",v):sessionStorage.removeItem("ag_view_as")}catch(e){}};
const premium=()=>{const v=viewAs();return v?["cobre","plata","oro","diamond"].includes(v):API.isPremium()}, admin=()=>API.isAdmin()&&!viewAs(), logged=()=>!!API.user();
/* prueba gratis: módulos marcados como "free" durante los primeros días de la cuenta */
const trialDays=()=>{const d=(S.site||{}).trialDays;return d==null||d===""?7:Math.max(0,+d||0)};
const trialLeft=()=>{if(viewAs()==="prueba")return trialDays();if(viewAs()==="gratis")return 0;if(!logged()||premium())return 0;const p=API.profile()||{},u=API.user()||{};const c=Math.max(new Date(p.created_at||u.created_at||Date.now()).getTime(),(S.site||{}).trialFrom?new Date(S.site.trialFrom).getTime():0);return Math.max(0,Math.ceil((c+trialDays()*864e5-Date.now())/864e5))};
const inTrial=()=>!closedAcad()&&trialLeft()>0;
const canMod=m=>premium()||(!!m&&ownsCourse(m.course_id))||(!!m&&!!m.free&&inTrial());
/* ---------- dos sitios con el mismo código: elartegrafico.com (principal) y academia.elartegrafico.com ---------- */
const HOST=location.hostname,PROD=/(^|\.)elartegrafico\.com$/.test(HOST);
const SITE=PROD?(/^academia\./.test(HOST)?"academia":"main"):(new URLSearchParams(location.search).get("sitio")==="academia"?"academia":"main");
const ACAD=SITE==="academia";
function link(site,hash){hash=hash||"inicio";if(site===SITE)return"#"+hash;
  let vq="";try{const v=sessionStorage.getItem("ag_view_as");if(v&&!/^admin/.test(hash))vq="ver="+encodeURIComponent(v);else if(window.AGAPI&&AGAPI.isAdmin&&AGAPI.isAdmin())vq="ver=admin"}catch(e){}
  if(PROD){const base=HOST.replace(/^(www\.|academia\.)/,"");return"https://"+(site==="academia"?"academia.":"")+base+"/"+(vq?"?"+vq:"")+"#"+hash}
  return location.pathname+(site==="academia"?"?sitio=academia"+(vq?"&"+vq:""):(vq?"?"+vq:""))+"#"+hash}
try{const q=new URLSearchParams(location.search),v=q.get("ver");if(q.has("ver")){if(v&&v!=="admin")sessionStorage.setItem("ag_view_as",v);else sessionStorage.removeItem("ag_view_as");q.delete("ver");const qs=q.toString();history.replaceState(null,"",location.pathname+(qs?"?"+qs:"")+location.hash)}}catch(e){}
const ACAD_R=new Set(["academia","modulo","leccion","practica","prueba","progreso","logros"]);
const MAIN_R=new Set(["certificado","probar","mensajes","oro","entrar","registro","recuperar","noticias","comunidad","nota","opiniones","mercados","legal","terminos","privacidad","retos","reto","ranking","puntos"]);
const toAcad=h=>link("academia",h),toMain=h=>link("main",h);

/* ---------- utilidades UI ---------- */
let toastT;function toast(m,type){let t=$(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");document.body.appendChild(t)}
  type=type||(/^(no |error|primero|inicia|bloque|mínimo|máx|elige|escribe|usa una|ya respond|este reto|ese reto|la imagen|vuelve a|te faltan|los retos|tu cuenta)/i.test(String(m))?"warn":/subiendo|cargando|enviando/i.test(String(m))?"wait":"ok");
  t.className="toast t-"+type;t.innerHTML=`<i>${POPI[type==="warn"?"warn":type==="wait"?"dots":"check"]}</i><span>${esc(m)}</span>`;t.hidden=false;t.classList.remove("in");void t.offsetWidth;t.classList.add("in");clearTimeout(toastT);toastT=setTimeout(()=>{t.classList.remove("in");setTimeout(()=>{if(!t.classList.contains("in"))t.hidden=true},300)},3000)}
/* ventanas de celebración: mismo estilo que los logros (una a la vez) */
const POPI={check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 7v6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/><circle cx="12" cy="12" r="9.5"/></svg>',
  dots:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>',
  trophy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 11l6-6 6 6"/><path d="M5 20h14" opacity=".5"/></svg>',
  coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.1 0 1.1-1 2-2.6 2-1.2 0-2.1-.5-2.6-1.3M12 6.5v1.5M12 16v1.5"/></svg>',
  send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
  spark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 6.1 6.1 1.9-6.1 1.9L12 18.5l-1.9-6.1L4 10.5l6.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" opacity=".7"/></svg>'};
let popQ=Promise.resolve();
function popShow(build,ms,confetti){popQ=popQ.then(()=>new Promise(res=>{const el=document.createElement("div");el.className="ach-pop";el.setAttribute("role","status");el.innerHTML=build();
  if(confetti&&!matchMedia("(prefers-reduced-motion: reduce)").matches){const cf=document.createElement("div");cf.className="confeti";const C=["#f3d88f","#d8b062","#2ec486","#5b8cff","#ffffff","#e84c5c"];
    cf.innerHTML=Array.from({length:34},(_,i)=>`<i style="--x:${Math.round(Math.cos(i*2.4)*(120+Math.random()*160))}px;--y:${Math.round(-60-Math.random()*150)}px;--r:${Math.round(Math.random()*720-360)}deg;--d:${(.9+Math.random()*.7).toFixed(2)}s;--c:${C[i%C.length]};--w:${4+Math.round(Math.random()*5)}px"></i>`).join("");el.appendChild(cf)}
  const close=()=>{if(el.classList.contains("out"))return;el.classList.add("out");setTimeout(()=>{el.remove();res()},480)};el.onclick=close;
  document.body.appendChild(el);setTimeout(close,ms||4200)}))}
function pop(o){o=Object.assign({icon:"star",tone:"gold",kicker:"",title:"",text:"",confetti:false,ms:4200},o);
  popShow(()=>`<div class="ach-pop-c pop-${o.tone}"><span class="pop-ic">${POPI[o.icon]||POPI.star}</span><div><small>${esc(o.kicker)}</small><b>${esc(o.title)}</b>${o.text?`<span>${esc(o.text)}</span>`:""}</div></div>`,o.ms,o.confetti)}
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
const ISO={"Colombia":"co","México":"mx","Argentina":"ar","Chile":"cl","Perú":"pe","Ecuador":"ec","Venezuela":"ve","Bolivia":"bo","Uruguay":"uy","Paraguay":"py","Panamá":"pa","Costa Rica":"cr","Guatemala":"gt","Honduras":"hn","El Salvador":"sv","Nicaragua":"ni","República Dominicana":"do","Puerto Rico":"pr","Cuba":"cu","España":"es","Estados Unidos":"us","Brasil":"br","Canadá":"ca","Belice":"bz","Haití":"ht","Suiza":"ch","Francia":"fr","Italia":"it","Portugal":"pt","Alemania":"de","Reino Unido":"gb","Países Bajos":"nl","Bélgica":"be","Austria":"at","Irlanda":"ie","Suecia":"se","Noruega":"no","Dinamarca":"dk","Andorra":"ad","Luxemburgo":"lu","Polonia":"pl","Australia":"au","Emiratos Árabes Unidos":"ae","Japón":"jp"};
const flag=c=>{const k=ISO[c];return k?`<img class="flag" src="https://flagcdn.com/w40/${k}.png" srcset="https://flagcdn.com/w80/${k}.png 2x" width="22" height="16" alt="" title="${esc(c)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;flag-t&quot; title=&quot;${esc(c)}&quot;>${k.toUpperCase()}</span>'">`:""};
const TIERS={cobre:{n:"Cobre",i:"🟤",r:1},plata:{n:"Plata",i:"⚪",r:2},oro:{n:"Oro",i:"🟡",r:3},diamond:{n:"Diamond",i:"💎",r:4}};
const tierOfDays=d=>d>=300?"oro":d>=150?"plata":"cobre";
const tierOfPlan=x=>x&&TIERS[x.tier]?x.tier:tierOfDays(+(x&&x.days)||30);
const premTag=pl=>`<span class="prem-tag${TIERS[pl]?" t-"+pl:""}" title="${TIERS[pl]?"Suscriptor "+TIERS[pl].n:"Alumno premium"}"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>${TIERS[pl]?TIERS[pl].n:"Premium"}</span>`;
const myPlan=()=>{const v=viewAs();if(TIERS[v])return v;if(v)return"";if(!premium())return"";const p=API.profile()||{};return TIERS[p.plan]?p.plan:(API.isAdmin()?"diamond":"cobre")};
const planRank=()=>(TIERS[myPlan()]||{}).r||0;
const PLAN_NUM={cobre:1,plata:2,oro:3,diamond:4};
const canSeePost=p=>{if(admin())return true;if(!p.premium_only&&!p.min_plan)return true;return planRank()>=Math.max(1,PLAN_NUM[p.min_plan]||0)};
const postsVis=()=>API.posts().then(L=>(L||[]).filter(canSeePost));
/* cursos comprados (de por vida) */
const isBase=cid=>!!(S.courses||[]).find(c=>c.id===cid&&c.base);
const ownsCourse=cid=>{if(!cid)return false;if(viewAs()==="curso")return isBase(cid)||cid===((S.courses||[]).find(c=>!c.base)||{}).id;if(viewAs())return false;
  if(isBase(cid))return logged();return !!(S.myCourses&&S.myCourses.has(cid))};
const ownedCourses=()=>(S.courses||[]).filter(c=>ownsCourse(c.id));
const courseLessons=c=>{const ms=new Set((S.modules||[]).filter(m=>m.course_id===c.id).map(m=>m.id));return (S.lindex||[]).filter(l=>ms.has(l.module_id))};
const graduated=c=>{const ls=courseLessons(c);return ls.length>0&&ls.every(l=>S.prog&&S.prog.done[l.id]&&S.prog.done[l.id].passed)};
const courseTag=c=>`<span class="crs-tag${graduated(c)?" grad":""}" style="--cc:${esc(c.color||"#d8b062")}" title="Curso ${esc(c.title)}">${esc(c.icon||"🎓")} ${graduated(c)?"✓ Graduado · ":""}${esc(c.title)}</span>`;
const myCourseTags=()=>ownedCourses().filter(c=>!c.base||graduated(c)).map(courseTag).join("");
const COUNTRIES=["Colombia","México","Argentina","Chile","Perú","Ecuador","Venezuela","Bolivia","Uruguay","Paraguay","Panamá","Costa Rica","Guatemala","Honduras","El Salvador","Nicaragua","República Dominicana","Puerto Rico","Cuba","Brasil","Haití","Belice","Estados Unidos","Canadá","España","Italia","Francia","Suiza","Portugal","Alemania","Reino Unido","Países Bajos","Bélgica","Austria","Irlanda","Suecia","Noruega","Dinamarca","Luxemburgo","Andorra","Polonia","Australia","Emiratos Árabes Unidos","Japón","Otro"];
/* ---------- completar perfil: foto y país (paso a paso) ---------- */
function onboard(){
  const p=API.profile();if(!p||!logged()||API.isAdmin()||$("#onb"))return;
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
      <input type="search" class="onb-q" placeholder="Buscar tu país…" aria-label="Buscar país" autocomplete="off"><div class="onb-cs">${COUNTRIES.filter(c=>c!=="Otro").map(c=>`<button type="button" class="${pais===c?"on":""}" data-c="${esc(c)}">${flag(c)}<span>${esc(c)}</span></button>`).join("")}<button type="button" data-c="Otro" class="${pais==="Otro"?"on":""}"><span class="flag-t">🌎</span><span>Otro</span></button></div>
      <div class="onb-act"><button type="button" class="btn gold" id="onbN" ${pais?"":"disabled"}>Continuar</button></div></div>`;
    else el.innerHTML=`<div class="onb-card">${dots}<span class="eyebrow">¡Listo!</span><h2 id="onbT">Así te ven los demás</h2>
      <div class="onb-prev">${avatar({username:p.username,avatar_url:av},44)}<b>${esc(p.username)}</b>${flag(pais)}${premium()?premTag(myPlan()):""}<span class="mono dim">${(S.prog&&S.prog.xp)||0} pts</span></div>
      <p class="muted">Puedes cambiar tu foto y tu país cuando quieras en Configuración.</p>
      <div class="onb-act"><button type="button" class="btn gold" id="onbX">Empezar</button></div></div>`;
    const f=$("#onbF",el);if(f)f.onchange=async e=>{const fl=e.target.files[0];if(!fl)return;try{toast("Subiendo foto…");av=await API.uploadAvatar(await squareImage(fl));await save();toast("Foto lista");k++;draw()}catch(x){toast(x.message)}};
    if($("#onbS",el))$("#onbS",el).onclick=()=>{try{sessionStorage.setItem("ag_onb_foto","1")}catch(e){}if(!needC){fin();return}k++;draw()};
    {const q=$(".onb-q",el);if(q)q.oninput=()=>{const v=q.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");$$("[data-c]",el).forEach(x=>{x.hidden=!!v&&!x.dataset.c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(v)})}}
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
function saveProg(){if(logged()&&S.loaded)setTimeout(()=>{try{checkAch("acad",acadAch())}catch(e){}},300);try{localStorage.setItem("ag_prog_"+(API.user()||{id:"anon"}).id,JSON.stringify(S.prog))}catch(e){}renderNav();clearTimeout(saveT);saveT=setTimeout(()=>{if(logged())API.progressSave(S.prog.xp,S.prog).catch(()=>{})},800)}
async function loadProg(){S.prog=blankProg();S.fb=new Set();if(!logged())return;
  API.myFeedback().then(r=>{S.fb=new Set((r||[]).map(x=>x.module_id));S.fbOff=false}).catch(()=>{S.fbOff=true});try{const r=await API.progressGet();if(r&&r.data)S.prog=Object.assign(blankProg(),r.data,{xp:r.xp||r.data.xp||0})}catch(e){}}
function ach(id){if(!S.prog.ach.includes(id)){S.prog.ach.push(id);const a=ACH.find(x=>x.id===id);}}
function addXP(n){if(planRank()>=2)n*=2;const lv0=levelOf(S.prog.xp||0).i;S.prog.xp=(S.prog.xp||0)+n;{const L=levelOf(S.prog.xp);if(L.i>lv0&&logged())setTimeout(()=>pop({icon:"up",kicker:"¡Subiste de nivel!",title:`Nivel ${L.i+1} · ${L.name}`,text:`Ya llevas ${S.prog.xp} puntos. ${L.to?`El próximo nivel es a los ${L.to}.`:"Llegaste al nivel máximo."}`,confetti:true,ms:5000}),900)}const d=todayKey();if(S.prog.lastDay!==d){const y=new Date(Date.now()+TZ*1000-864e5).toISOString().slice(0,10);S.prog.streak=S.prog.lastDay===y?(S.prog.streak||0)+1:1;S.prog.bestStreak=Math.max(S.prog.bestStreak||0,S.prog.streak);S.prog.lastDay=d;if(S.prog.streak>=3)ach("constancia")}saveProg()}
function registerAnswer(kind,res){const p=S.prog.practice;p.n++;if(res==="ok"){p.ok++;p.row++;ach("primera");if(kind==="no-operar")ach("paciencia")}else p.row=0;p.best=Math.max(p.best,p.row);if(p.ok>=10)ach("diez");if(p.row>=5)ach("racha5");if(p.n>=100)ach("cien");saveProg()}

/* ---------- navegación ---------- */
const app=$("#app");let cleanup=[];
/* ---------- paginación automática de listas largas (alumnos, canjes, ranking, noticias…) ---------- */
const PAGE_RULES=[[".ulist",15],[".list",20],["table.tbl > tbody",25],[".posts",10],[".revs",9],["#rEn .tree",25],["#hist .tree",10]];
const pgState=new WeakMap();
function pageList(box,per){const items=[...box.children].filter(x=>!x.classList.contains("pager"));const n=items.length;let nav=box.nextElementSibling&&box.nextElementSibling.classList.contains("pager")&&box.nextElementSibling.__for===box?box.nextElementSibling:null;
  if(n<=per){items.forEach(x=>x.classList.remove("pg-hide"));if(nav)nav.remove();return}
  let st=pgState.get(box);if(!st||st.n!==n){st={n,p:0};pgState.set(box,st)}const pages=Math.ceil(n/per);st.p=Math.min(st.p,pages-1);
  items.forEach((x,i)=>x.classList.toggle("pg-hide",i<st.p*per||i>=(st.p+1)*per));
  if(!nav){nav=document.createElement("nav");nav.className="pager";nav.__for=box;nav.setAttribute("aria-label","Páginas");const host=box.tagName==="TBODY"?box.closest("table").parentElement.classList.contains("scroll")?box.closest("table").parentElement:box.closest("table"):box;host.after(nav);nav.__for=box}
  const btn=(k,t,lab,dis,cur)=>`<button type="button" data-pg="${k}"${dis?" disabled":""}${cur?' class="on" aria-current="page"':""}${lab?` aria-label="${lab}"`:""}>${t}</button>`;
  const nums=[];for(let i=0;i<pages;i++){if(i===0||i===pages-1||Math.abs(i-st.p)<=1)nums.push(i);else if(nums[nums.length-1]!=="…")nums.push("…")}
  nav.innerHTML=`<span class="pg-info">${st.p*per+1}–${Math.min(n,(st.p+1)*per)} de ${n}</span><div class="pg-btns">${btn(st.p-1,"‹","Anterior",st.p===0)}${nums.map(i=>i==="…"?'<span class="pg-gap">…</span>':btn(i,i+1,"Página "+(i+1),false,i===st.p)).join("")}${btn(st.p+1,"›","Siguiente",st.p>=pages-1)}</div>`;
  nav.onclick=e=>{const b=e.target.closest("[data-pg]");if(!b||b.disabled)return;st.p=+b.dataset.pg;pageList(box,per);const top=(box.tagName==="TBODY"?box.closest("table"):box).getBoundingClientRect().top;if(top<70)window.scrollBy({top:top-90,behavior:"smooth"})}}
function autoPage(root){root=root||app;if(!root)return;PAGE_RULES.forEach(([q,per])=>root.querySelectorAll(q).forEach(b=>{if(b.closest("[data-nopage]")||b.closest("form"))return;pageList(b,per)}))}
{let pgT=null;new MutationObserver(ms=>{if(ms.every(m=>(m.target.closest&&m.target.closest(".pager"))||[...m.addedNodes,...m.removedNodes].every(x=>x.nodeType===1&&x.classList.contains("pager"))))return;clearTimeout(pgT);pgT=setTimeout(()=>autoPage(app),60)}).observe(app,{childList:true,subtree:true})}
function clear(){cleanup.forEach(f=>{try{f()}catch(e){}});cleanup=[];const n=document.getElementById("admNote");if(n)n.remove()}
const launchAt=()=>{const t=S.site&&S.site.academyOpenAt;const d=t?new Date(t):null;return d&&!isNaN(d)?d:null};
const closedAcad=()=>!!(S.site&&S.site.academyClosed)&&!(launchAt()&&launchAt()<=new Date())&&!API.isAdmin();
/* contador de lanzamiento de la academia */
function launchBox(compact){const d=launchAt();if(!(S.site&&S.site.academyClosed)||!d||d<=new Date())return"";const note=(S.site.launchNote||"").trim();
  const when=d.toLocaleString("es-CO",{weekday:"long",day:"numeric",month:"long",hour:"numeric",minute:"2-digit",timeZone:"America/Bogota"});
  return `<section class="launch${compact?" sm":""}"><div class="launch-t"><span class="eyebrow">🚀 Lanzamiento</span><h2>La academia abre en</h2>
      <div class="lc" data-lc="${esc(d.toISOString())}">${["días","horas","min","seg"].map(u=>`<div><b>00</b><span>${u}</span></div>`).join("")}</div>
      <p class="muted">${esc(when)} (hora Colombia)${note?` · <b class="gold-t">${esc(note)}</b>`:""}</p></div>
    <div class="launch-a">${logged()?`<button type="button" class="btn gold" data-lpush>🔔 Avísame cuando abra</button><small class="dim">Te llega una notificación al celular</small>`:`<a class="btn gold" href="${toMain("registro")}">Crear cuenta gratis</a><small class="dim">Así entras apenas abra y te avisamos</small>`}</div></section>`}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-lpush]");if(!b)return;b.disabled=true;const ok=await enablePush();if(ok){b.textContent="✓ Te avisaremos";toast("Listo: te avisamos cuando abra")}else b.disabled=false});
/* módulo disponible: a mano (available) o por fecha (open_at). Sin la columna (SQL viejo) se considera abierto. */
function modOpen(m,ignoreAdmin){if(!m)return false;if(!ignoreAdmin&&admin())return true;if(m.available!==false)return true;return !!(m.open_at&&new Date(m.open_at)<=new Date())}
/* orden obligatorio: con «Exige terminar el módulo anterior», el módulo se abre al aprobar todo el anterior
   y dentro del módulo cada lección se abre al aprobar la anterior (puntaje mínimo de la lección). El admin no tiene bloqueos. */
function passedL(id){return !!(S.prog&&S.prog.done[id]&&S.prog.done[id].passed)}
/* módulo anterior que cuenta para el orden: los módulos opcionales no bloquean a los siguientes */
/* cada curso tiene su propio orden: un módulo solo depende de los anteriores de su mismo curso */
function prevReq(m){const i=S.modules.indexOf(m);for(let k=i-1;k>=0;k--){const x=S.modules[k];if(!x.optional&&(x.course_id||null)===(m.course_id||null))return x}return null}
/* reseña obligatoria: al terminar un módulo hay que dejar la reseña para abrir el siguiente */
function needFb(m){return !!(m&&!admin()&&!S.fbOff&&logged()&&m.ask_feedback!==false&&modProgress(m.id)>=1&&!S.fb.has(m.id))}
function modLocked(m){if(admin())return false;const prev=prevReq(m);if(!prev)return false;if(needFb(prev))return true;return !!(m.locked&&modProgress(prev.id)<1)}
const fbCard=m=>`<div class="fb-card"><div><span class="eyebrow">¡Terminaste “${esc(m.title)}”!</span><b>Cuéntanos cómo te pareció</b><span class="muted">Tu reseña nos ayuda a mejorar la academia. Es obligatoria para abrir el siguiente módulo y te toma un minuto.</span></div><a class="btn gold" href="#resena-${esc(m.id)}">Dejar mi reseña</a></div>`;
function lessonOpen(l){if(admin())return true;const m=S.modules.find(x=>x.id===l.module_id);if(!m||!modOpen(m)||modLocked(m))return false;if(!m.locked||m.optional)return true;
  const ls=S.lindex.filter(x=>x.module_id===l.module_id);const k=ls.findIndex(x=>x.id===l.id);return ls.slice(0,Math.max(0,k)).every(x=>passedL(x.id))}
function modState(m){if(modOpen(m,true))return"Disponible";return m.open_at?"Abre el "+new Date(m.open_at).toLocaleDateString("es-CO",{day:"2-digit",month:"short"}):"Próximamente"}
function closedView(){const s=S.site,p=API.profile()||{};
  app.innerHTML=`<section class="soon"><img src="${esc(s.logoFullUrl||"assets/logo_circle.webp")}" alt=""><span class="eyebrow">Academia</span>
    <h1>${esc(s.closedTitle||"La academia abre muy pronto")}</h1>
    <p class="muted">${esc(s.closedText||"Estamos terminando de montar las lecciones y los ejercicios. Tu cuenta ya quedó creada: cuando abramos, entras con el mismo usuario y tendrás tus 5 gráficas de prueba.")}</p>
    ${p.username?`<span class="pill ok">Registrado como ${esc(p.username)}</span>`:""}${launchBox(true)}
    <div class="row" style="justify-content:center"><a class="btn gold" href="${toMain("inicio")}">Volver a El Arte Gráfico</a>${s.discordUrl?`<a class="btn ghost" href="${esc(s.discordUrl)}" target="_blank" rel="noopener">Unirme al Discord</a>`:`<a class="btn ghost" href="${toMain("comunidad")}">Ver la comunidad</a>`}</div></section>`}
/* ---------- modo claro / oscuro ---------- */
function getTheme(){return document.documentElement.getAttribute("data-theme")==="light"?"light":"dark"}
function setTheme(t){const r=document.documentElement;if(t==="light")r.setAttribute("data-theme","light");else r.removeAttribute("data-theme");
  try{localStorage.setItem("ag_theme",t)}catch(e){}const m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute("content",t==="light"?"#f4f6fb":"#060b1a");
  const b=$("#themeBtn");if(b){b.setAttribute("aria-label",t==="light"?"Cambiar a modo oscuro":"Cambiar a modo claro")}
  window.dispatchEvent(new Event("ag-theme"))}
document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("#themeBtn"))setTheme(getTheme()==="light"?"dark":"light")});
/* ojito: esconder / mostrar el menú lateral en computador */
const EYE_ON='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function sideState(){let off=false;try{off=localStorage.getItem("ag_side_off")==="1"}catch(e){}document.body.classList.toggle("side-off",off);
  let f=$("#sideShow");if(!f){f=document.createElement("button");f.id="sideShow";f.type="button";f.className="side-show";f.title="Mostrar menú";f.setAttribute("aria-label","Mostrar menú");f.innerHTML=EYE_ON;document.body.appendChild(f);
    f.onclick=()=>{try{localStorage.setItem("ag_side_off","0")}catch(e){}sideState();window.dispatchEvent(new Event("resize"))}}}
document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("#sideHide")){try{localStorage.setItem("ag_side_off","1")}catch(x){}sideState();window.dispatchEvent(new Event("resize"))}});
function viewBar(){let b=$("#viewBar");const v=viewAs();if(!v){if(b)b.remove();document.body.classList.remove("viewing");return}
  if(!b){b=document.createElement("div");b.id="viewBar";b.className="view-bar";document.body.appendChild(b)}document.body.classList.add("viewing");
  b.innerHTML=`<span>👁 <b>Modo prueba:</b> así ve la página un</span><select aria-label="Ver como">${Object.entries(VIEWS).map(([k,t])=>`<option value="${k}"${k===v?" selected":""}>${t.replace("Alumno ","alumno ").replace("Suscriptor ","suscriptor ")}</option>`).join("")}</select><button type="button" class="btn sm gold" id="vbOut">Volver a admin</button>${S.site&&S.site.academyClosed?'<small class="vb-note">La academia sigue cerrada para los alumnos; aquí la ves abierta.</small>':""}`;
  $("select",b).onchange=e=>{setViewAs(e.target.value);renderNav();route()};
  $("#vbOut",b).onclick=()=>{setViewAs("");viewBar();renderNav();const u=link("main","admin");if(/^https?:/.test(u))location.href=u.replace("/#","/?ver=admin#");else{location.hash="#admin";route()}}}
window.AGVIEW=v=>{setViewAs(v);viewBar();renderNav();location.hash="#inicio";route()};
function renderNav(){sideState();viewBar();document.body.classList.toggle("is-acad",!!ACAD);
  let r=(location.hash||"#inicio").slice(1).split("-")[0];if(r==="noticias"||r==="nota")r="comunidad";
  const rw=rewardsOn()||admin();
  const L=ACAD?[["inicio","Mi panel"],["academia","Temario"],["practica","Práctica"],["logros","Logros"],["progreso","Progreso"]].concat(premium()?[]:[["prueba","Prueba gratis"]])
             :[["inicio","Inicio"]].concat(rw?[["retos","Retos"],["ranking","Ranking"]]:[]).concat(logged()?[["oro","Sala Oro"],["mensajes","Mensajes"]]:[]).concat([["comunidad","Comunidad"],["opiniones","Opiniones"],["mercados","Mercados"],["premium","Premium"]]);
  if(ACAD&&closedAcad()&&!admin())L.length=0;
  const u=API.user(),p=API.profile();const lv=levelOf((S.prog&&S.prog.xp)||0);
  const other=ACAD?`<a class="navx" href="${toMain("inicio")}">El Arte Gráfico ↗</a>`:(u&&p?`<a class="btn sm gold navacad" href="${toAcad("inicio")}">Ir a la academia</a>`:"");
  const NI={mensajes:"chat",oro:"crown",inicio:"home",comunidad:"chat",opiniones:"star",mercados:"chart",premium:"crown",academia:"acad",practica:"chart",ranking:"trophy",prueba:"play",retos:"bolt",progreso:"layers",puntos:"card",logros:"medal"};
  const msw=`<div class="mnav-sw" role="group" aria-label="Elige sección"><a class="${ACAD?"":"on"}" href="${ACAD?toMain("inicio"):"#inicio"}"${ACAD?"":' aria-current="true"'}>${ico("home",20)}<span><b>El Arte Gráfico</b><small>Comunidad y noticias</small></span></a><a class="${ACAD?"on":""}" href="${ACAD?"#inicio":toAcad("inicio")}"${ACAD?' aria-current="true"':""}>${ico("acad",20)}<span><b>Academia</b><small>Lecciones y práctica</small></span></a><a class="sw-charts" href="https://charts.elartegrafico.com" target="_blank" rel="noopener">${ico("chart",20)}<span><b>EAG Charts</b><small>Gráficos en vivo</small></span><em>Nuevo</em></a></div>
    <div class="mnav-here"><i></i>Estás en ${ACAD?"<b>la Academia</b>":"<b>El Arte Gráfico</b>"}</div>`;
  const mus=u&&p?`<div class="mnav-user"><a class="mnu-me" href="#perfil">${avatar(p,40)}<span><b>${esc(p.username)}</b><small>${esc(lv.name)} · ${S.prog?S.prog.xp:0} pts</small></span>${premium()?premTag(myPlan()):""}</a>
      <div class="mnu-links"><a href="#perfil">${ico("gear",18)}Configuración</a>${premium()?"":`<a href="${toMain("premium")}">${ico("crown",18)}Hazte premium</a>`}${admin()?`<a href="${toMain("admin")}">${ico("news",18)}Administración</a>`:""}<button type="button" id="logout2">Cerrar sesión</button></div></div>`
    :`<div class="mnav-user"><div class="mnu-links two"><a class="btn ghost" href="${toMain("entrar")}">Ingresar</a><a class="btn gold" href="${toMain("registro")}">Crear cuenta</a></div></div>`;
  /* selector fijo arriba (celular): siempre se ve si estás en El Arte Gráfico o en la Academia */
  let ts=$("#topSw");if(!ts){ts=document.createElement("div");ts.id="topSw";ts.className="top-sw";ts.setAttribute("role","group");ts.setAttribute("aria-label","Sección");const br=$(".top .brand");br.parentNode.insertBefore(ts,br.nextSibling)}
  ts.innerHTML=`<a class="${ACAD?"":"on"}" href="${ACAD?toMain("inicio"):"#inicio"}"${ACAD?"":' aria-current="true"'}>${ico("home",16)}<span>Arte Gráfico</span></a><a class="${ACAD?"on":""}" href="${ACAD?"#inicio":toAcad("inicio")}"${ACAD?' aria-current="true"':""}>${ico("acad",16)}<span>Academia</span></a><a class="sw-charts" href="https://charts.elartegrafico.com" target="_blank" rel="noopener" title="EAG Charts: gráficos en vivo">${ico("chart",16)}<span>Charts</span></a>`;
  /* barra inferior tipo app (celular) */
  const TB=ACAD?[["inicio","home","Panel"],["academia","acad","Temario"],["practica","chart","Práctica"],["progreso","layers","Progreso"]]
    :(rw?[["inicio","home","Inicio"],["retos","bolt","Retos"],["@acad","acad","Academia"],["ranking","trophy","Ranking"]]:[["inicio","home","Inicio"],["comunidad","chat","Comunidad"],["@acad","acad","Academia"],["premium","crown","Premium"]]);
  let tb=$("#tabbar");if(!tb){tb=document.createElement("nav");tb.id="tabbar";tb.className="tabbar";tb.setAttribute("aria-label","Accesos rápidos");document.body.appendChild(tb)}
  tb.innerHTML=TB.map(([k,ic,t])=>`<a href="${k==="@acad"?toAcad("inicio"):"#"+k}" class="${r===k?"on":""}${k==="@acad"?" tb-acad":""}">${ico(ic,22)}<span>${t}</span></a>`).join("")+`<button type="button" id="tbMore" aria-label="Más opciones">${u&&p?avatar(p,26):ico("gear",22)}<span>${u&&p?"Más":"Menú"}</span>${S.dm&&S.dm.unread?`<em class="nbadge tb-dot">${S.dm.unread}</em>`:""}</button>`;
  $("#tbMore").onclick=e=>{e.stopPropagation();const o=$("#nav").classList.toggle("open");document.body.classList.toggle("sheet-open",o);$("#menuBtn").setAttribute("aria-expanded",String(o))};
  if(!window.__sheetClose){window.__sheetClose=1;document.addEventListener("click",e=>{const n=$("#nav");if(!n||!n.classList.contains("open")||!document.body.classList.contains("sheet-open"))return;
    if(!n.contains(e.target)||e.target.closest("a")){n.classList.remove("open");document.body.classList.remove("sheet-open")}})}
  $("#nav").innerHTML=msw+L.map(([k,t])=>`<a href="#${k}" class="${r===k?"on":""}"><span class="mi">${ico(NI[k]||"news",20)}</span>${t}${k==="mensajes"&&S.dm&&S.dm.unread?`<em class="nbadge">${S.dm.unread}</em>`:""}</a>`).join("")+other+mus+
    (u&&p?`<div class="dd" id="dd"><button aria-haspopup="true" aria-expanded="false" id="ddb">${avatar(p,28)}<span>${esc(p.username)}</span>${premium()?`<span class="prem-badge t-${myPlan()}">${(TIERS[myPlan()]||{n:"Premium"}).n}</span>`:ownedCourses().length?`<span class="prem-badge crs" style="--cc:${esc(ownedCourses()[0].color)}">Curso</span>`:""}</button>
      <div class="menu" hidden>
        <a class="dm-head" href="#perfil">${avatar(p,46)}<span class="dm-id"><b>${esc(p.username)} ${flag(p.country||"")}</b><small>${esc(p.email||"")}</small></span></a>
        <div class="dm-lv"><div class="dm-lvr"><span>${premium()?premTag(myPlan()):myCourseTags()||'<span class="tag">Cuenta gratis</span>'}${p.affiliate?affTag():""}<span class="dim">${esc(lv.name)}</span></span><b class="mono">${S.prog?S.prog.xp:0} pts</b></div>
          <div class="bar"><i style="width:${lv.to?Math.round(100*(((S.prog&&S.prog.xp)||0)-lv.from)/(lv.to-lv.from)):100}%"></i></div></div>
        <div class="dm-items">
          <a href="${ACAD?"#perfil":"#perfil"}">${ico("gear",18)}<span>Configuración</span></a>
          <a href="${ACAD?"#perfil-progreso":"#perfil-progreso"}">${ico("chart",18)}<span>Mi progreso</span></a>
          ${rewardsOn()||admin()?`<a href="${toMain("puntos")}">${ico("card",18)}<span>Saldo y puntos</span></a><a href="${toMain("ranking")}">${ico("trophy",18)}<span>Ranking de retos</span></a>`:""}
          ${!admin()?`<a href="${toMain("mensajes")}">${ico("chat",18)}<span>Mensajes</span>${S.dm&&S.dm.unread?`<em class="nbadge">${S.dm.unread}</em>`:""}</a>`:""}
          <a href="${toAcad("progreso")}">${ico("layers",18)}<span>Tabla de progreso</span></a>
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
    <div class="fcols"><div class="fbrand"><img src="${esc(s.logoUrl||"assets/logo_mark.webp")}" alt=""><div><b>${esc(s.name||"El Arte Gráfico")}</b><span>${esc(s.tagline||"")}</span></div></div>
    <div><h4>El Arte Gráfico</h4><a href="${toMain("inicio")}">Inicio</a><a href="${toMain("comunidad")}">Comunidad</a><a href="${toMain("opiniones")}">Opiniones</a>${s.discordUrl?`<a href="${esc(s.discordUrl)}" target="_blank" rel="noopener">Discord</a>`:""}</div>
    <div><h4>Academia</h4><a href="${toAcad("inicio")}">Mi panel</a><a href="${toAcad("academia")}">Temario</a><a href="${toAcad("practica")}">Práctica</a><a href="#premium">Premium</a></div>
    <div><h4>Mercados</h4><a href="${toMain("mercados")}">Sintéticos</a><a href="${toMain("mercados")}">Forex</a><a href="${toMain("mercados")}">Metales</a></div>
    <div><h4>Contacto</h4>${s.contact?`<span class="sel">${esc(s.contact)}</span>`:'<span class="dim">Pronto</span>'}${(s.social||"").split(/\n/).filter(Boolean).map(l=>{const [t,u]=l.split("|").map(x=>x.trim());return u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`:""}).join("")}</div></div>
    <nav class="legal-links" aria-label="Legal">${(window.AG_LEGAL||[]).map(d=>`<a href="${toMain("legal-"+d.key)}">${esc(d.title)}</a>`).join("")}</nav>
    <p class="legal">${esc(s.legal||"Contenido educativo. Operar instrumentos financieros implica alto riesgo. No es asesoría financiera.")}</p>
    <p class="dim">© ${new Date().getFullYear()} ${esc(s.name||"El Arte Gráfico")}. Todos los derechos reservados.</p>`}

let sid;try{sid=sessionStorage.getItem("ag_sid")||Math.random().toString(36).slice(2,12);sessionStorage.setItem("ag_sid",sid)}catch(e){sid=Math.random().toString(36).slice(2,12)}
const ROUTES={};
function route(keep){if(/^#admin/.test(location.hash)&&API.isAdmin()){let v="";try{v=sessionStorage.getItem("ag_view_as")}catch(e){}if(v){setViewAs("");viewBar();renderNav()}}
  clear();$("#nav").classList.remove("open");document.body.classList.remove("sheet-open");const h=(location.hash||"#inicio").slice(1)||"inicio";if(keep!==true)window.scrollTo(0,0);
  const [k,...rest]=h.split("-");const arg=rest.join("-");
  if(!ACAD&&ACAD_R.has(k)){location.href=toAcad(h);return}
  if(ACAD&&MAIN_R.has(k)){location.href=toMain(h);return}
  if(ACAD&&!logged()&&k!=="nueva"&&k!=="ranking"){location.replace(toMain("entrar-academia"));return}
  renderNav();
  if(ACAD&&closedAcad()&&k!=="nueva"&&k!=="perfil"){if(!admin()){API.logView(sid,"academia/cerrada");closedView();return}
    $("#app").insertAdjacentHTML("beforebegin",'<div class="note admin-note" id="admNote">La academia está <b>cerrada para alumnos</b>: solo tú la ves. Ábrela desde Administración cuando el contenido esté listo.</div>')}
  API.logView(sid,((ACAD?"academia/":"")+h).slice(0,60));
  (ROUTES[k]||ROUTES.inicio)(arg);
  if(!["perfil","nueva","legal","entrar","registro","mensajes"].includes(k))setTimeout(onboard,700);
}
window.addEventListener("hashchange",()=>route());

/* ---------- certificados ---------- */
function certCta(){if(!logged()||!S.courses)return"";const g=(S.courses||[]).filter(c=>(premium()||ownsCourse(c.id))&&graduated(c));
  return g.map(c=>`<section class="cert-cta" style="--cc:${esc(c.color||"#d8b062")}"><span class="cert-ic">🎓</span><div><b>¡Te graduaste de ${esc(c.title)}!</b><span class="muted">Ya puedes descargar tu certificado con código verificable y compartirlo.</span></div><button type="button" class="btn gold" data-cert="${esc(c.id)}">Ver mi certificado</button></section>`).join("")}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-cert]");if(!b)return;busy(b,true);try{const c=await API.claimCertificate(b.dataset.cert);location.href=toMain("certificado-"+c.code)}catch(x){toast(x.message)}finally{busy(b,false)}});
ROUTES.certificado=async code=>{code=String(code||"").toUpperCase();
  app.innerHTML='<div class="muted" style="padding:40px;text-align:center">Verificando certificado…</div>';let c=null;try{c=code?await API.verifyCertificate(code):null}catch(e){}
  if(!c){app.innerHTML=`<div class="empty">No encontramos el certificado <b class="mono">${esc(code||"")}</b>. Revisa el código.<a class="btn sm" href="#inicio">Ir al inicio</a></div>`;return}
  const url=absUrl("main","certificado-"+c.code),d=new Date(c.issued_at).toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"}),mine=logged()&&(API.profile()||{}).username===c.username;
  app.innerHTML=`<div class="cert-page"><div class="cert-ok no-print">✓ Certificado verificado · emitido por El Arte Gráfico</div>
    <article class="cert" style="--cc:${esc(c.color||"#d8b062")}"><div class="cert-in">
      <div class="cert-top"><img src="${esc(S.site.logoFullUrl||"assets/logo_circle.webp")}" alt="El Arte Gráfico"><span>El Arte Gráfico · Academy</span></div>
      <span class="cert-k">Certificado de finalización</span><p class="cert-s">Se certifica que</p>
      <h1 class="cert-n">${esc(c.username)}</h1><p class="cert-s">completó y aprobó el curso</p>
      <h2 class="cert-c">${esc(c.icon||"🎓")} ${esc(c.course_title)}</h2>
      <p class="cert-d">${c.lessons} ${c.lessons===1?"lección aprobada":"lecciones aprobadas"} con ejercicios en gráficas reales · ${esc(d)}</p>
      <div class="cert-f"><div class="cert-sig"><b>El Arte Gráfico</b><span>Instructor</span></div>
        <div class="cert-seal" aria-hidden="true">🏅</div>
        <div class="cert-qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(url)}" alt="Código QR para verificar" width="96" height="96"><span class="mono">${esc(c.code)}</span></div></div>
      <small class="cert-v">Verifica este certificado en ${esc(url.replace(/^https?:\/\//,""))}</small></div></article>
    <div class="row no-print cert-a"><button class="btn gold" id="cPr">Descargar en PDF</button><button class="btn" id="cSh">Compartir</button>${mine?"":`<a class="btn ghost" href="${toMain("registro")}">Quiero el mío</a>`}</div>
    <p class="muted no-print" style="text-align:center;font-size:13px">Para guardarlo, en la ventana de impresión elige “Guardar como PDF”.</p></div>`;
  $("#cPr").onclick=()=>window.print();
  $("#cSh").onclick=async()=>{const t=`Me certifiqué en ${c.course_title} con El Arte Gráfico 🎓`;try{if(navigator.share){await navigator.share({title:"Mi certificado",text:t,url});return}await navigator.clipboard.writeText(url);toast("Enlace copiado")}catch(e){}}};

/* ---------- pruébalo sin registrarte ---------- */
ROUTES.probar=async()=>{
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Sin registro · gratis</span><h1>Pruébalo ahora</h1><p class="muted">Así se practica en la academia: mira la gráfica, <b>marca tu zona</b>, pon tu <b>stop loss</b> y confirma. Después la gráfica avanza vela por vela y ves qué habría pasado.</p></div>
    <div id="tryBox"><div class="muted">Cargando la gráfica…</div></div><div id="tryEnd"></div>`;
  let ex=null;try{ex=await API.tryExercise()}catch(e){}
  if(!ex){$("#tryBox").innerHTML=`<div class="empty">La gráfica de prueba se publicará pronto.<a class="btn sm gold" href="#registro">Crear cuenta gratis</a></div>`;return}
  const end=()=>{$("#tryEnd").innerHTML=`<section class="try-end"><div><span class="eyebrow">¿Qué tal te fue?</span><h2>${logged()?"Sigue practicando en la academia":"Esto es solo una de cientos"}</h2>
      <p class="muted">${logged()?"Tienes más gráficas de prueba, el reto del día y el temario completo esperándote.":"Crea tu cuenta gratis y sigue con 5 gráficas de prueba más, el reto diario con premios en USDT y el ranking. Sin tarjeta."}</p></div>
      <div class="row">${logged()?`<a class="btn gold" href="${toAcad("inicio")}">Ir a la academia</a><a class="btn ghost" href="#retos">Reto del día</a>`:`<a class="btn gold" href="#registro">Crear cuenta gratis</a><a class="btn ghost" href="#entrar">Ya tengo cuenta</a>`}</div></section>`;
    setTimeout(()=>{const e=$(".try-end");if(e)e.scrollIntoView({behavior:"smooth",block:"center"})},600)};
  const h=await Player.mount($("#tryBox"),ex,{grader:id=>API.tryGrade(id),onDone:()=>end(),next:()=>{location.hash=logged()?"#inicio":"#registro"}});
  if(h)cleanup.push(h.destroy)};

/* ---------- perfil público: tocar un nombre abre su tarjeta ---------- */
function uL(n){return n?`<span class="ulink" role="button" tabindex="0" data-u="${esc(n)}" title="Ver perfil de ${esc(n)}">${esc(n)}</span>`:""}
async function showProfile(name){
  let ov=$("#pfOv");if(ov)ov.remove();ov=document.createElement("div");ov.id="pfOv";ov.className="pf-ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");ov.setAttribute("aria-label","Perfil de "+name);
  ov.innerHTML=`<div class="pf-card"><button type="button" class="pf-x" aria-label="Cerrar">✕</button><div class="pf-load muted">Cargando perfil…</div></div>`;document.body.appendChild(ov);document.body.classList.add("pf-open");
  const close=()=>{ov.remove();document.body.classList.remove("pf-open");document.removeEventListener("keydown",esck)},esck=e=>{if(e.key==="Escape")close()};
  ov.addEventListener("click",e=>{if(e.target===ov||e.target.closest(".pf-x"))close()});document.addEventListener("keydown",esck);
  let d=null;try{d=await API.publicProfile(name)}catch(e){}
  const card=$(".pf-card",ov);if(!card)return;
  if(!d){card.innerHTML=`<button type="button" class="pf-x" aria-label="Cerrar">✕</button><div class="empty">Este perfil no está disponible.</div>`;return}
  const lv=levelOf(d.xp||0),lp=lv.to?Math.round(100*((d.xp||0)-lv.from)/(lv.to-lv.from)):100,ap=d.lessons_total?Math.round(100*d.lessons/d.lessons_total):0;
  const since=new Date(d.since).toLocaleDateString("es-CO",{month:"long",year:"numeric"});
  const crs=(d.courses||[]).map(c=>`<span class="crs-tag${c.graduated?" grad":""}" style="--cc:${esc(c.color||"#d8b062")}">${esc(c.icon||"🎓")} ${c.graduated?"✓ Graduado · ":""}${esc(c.title)}</span>`).join("");
  card.innerHTML=`<button type="button" class="pf-x" aria-label="Cerrar">✕</button>
    <div class="pf-head${d.premium?" prem t-"+esc(d.plan||"cobre"):""}"><div class="pf-av">${avatar(d,88)}<span class="lvchip">${lv.i+1}</span></div>
      <h2>${esc(d.username)} ${flag(d.country||"")}</h2>
      <div class="pf-chips">${d.is_admin?'<span class="tag pub">El Arte Gráfico</span>':""}${d.premium?premTag(d.plan||"cobre"):""}${crs}${d.affiliate?affTag():""}${!d.premium&&!crs&&!d.is_admin?'<span class="tag">Cuenta gratis</span>':""}</div>
      <small class="muted">Miembro desde ${esc(since)}</small></div>
    <div class="pf-sec"><div class="pf-row"><span>${esc(lv.name)}</span><b class="mono">${d.xp||0} pts</b></div><div class="bar"><i style="width:${lp}%"></i></div>
      <small class="dim">${lv.to?`Le faltan ${lv.to-(d.xp||0)} pts para el nivel ${lv.i+2}`:"Nivel máximo"}</small></div>
    <div class="pf-sec"><div class="pf-row"><span>Avance en la academia</span><b class="mono">${ap}%</b></div><div class="bar"><i style="width:${ap}%"></i></div>
      <small class="dim">${d.lessons} de ${d.lessons_total} lecciones aprobadas</small></div>
    <div class="pf-stats">
      <div><b>${d.month_pos?"#"+d.month_pos:"—"}</b><span>Ranking del mes</span></div>
      <div><b>${d.month_points||0}</b><span>Puntos este mes</span></div>
      <div><b>${d.wins||0}</b><span>Retos ganados</span></div>
      <div><b>${d.firsts||0}</b><span>Primer lugar 🥇</span></div>
      <div><b>${d.streak||0}🔥</b><span>Racha (mejor ${d.best_streak||0})</span></div>
      <div><b>${d.played||0}</b><span>Retos jugados</span></div></div>
    ${d.is_me?`<a class="btn ghost" href="#perfil">Editar mi perfil</a>`:""}`;
  const a=$("a",card);if(a)a.addEventListener("click",close)}
document.addEventListener("click",e=>{const u=e.target.closest(".ulink[data-u]");if(!u)return;e.preventDefault();e.stopPropagation();showProfile(u.dataset.u)},true);
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches(".ulink[data-u]")){e.preventDefault();showProfile(e.target.dataset.u)}});

/* ---------- chat privado con el admin ---------- */
let dmLast=-1;
async function dmPoll(){if(!logged()||!API.dmBadge)return;let b=null;try{b=await API.dmBadge()}catch(e){return}if(!b)return;
  const prev=S.dm;S.dm=b;const n=b.unread||0;
  if(!prev||prev.unread!==n||prev.exists!==b.exists)renderNav();
  {const c0=$(".mh-dm");if(c0&&c0.classList.contains("new")!==(n>0)&&/^(inicio)?$/.test(location.hash.slice(1)))route(true)}
  let c=$("#dmChip");const onChat=b.admin?/^#admin-chat/.test(location.hash):/^#mensajes/.test(location.hash);
  if(n>0&&!onChat){if(!c){c=document.createElement("a");c.id="dmChip";c.className="dm-chip";document.body.appendChild(c)}
    c.href=b.admin?toMain("admin-chat"):toMain("mensajes");c.innerHTML=`${ico("chat",18)}<span>${b.admin?`${n} mensaje${n>1?"s":""} de alumnos`:`Tienes ${n>1?n+" mensajes nuevos":"un mensaje"} de El Arte Gráfico`}</span>`;
    if(n>dmLast&&dmLast>=0&&!b.admin)toast("💬 Nuevo mensaje de El Arte Gráfico")}
  else if(c)c.remove();dmLast=n}
setInterval(()=>{if(!document.hidden)dmPoll()},45000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)dmPoll()});
window.addEventListener("hashchange",()=>setTimeout(dmPoll,400));setTimeout(dmPoll,1500);

/* caja de chat: la usan el alumno (#mensajes) y el admin */
function chatBox(host,{load,send,me="Tú",them="El Arte Gráfico",empty="",closedTxt="Esta conversación terminó."}){
  host.innerHTML=`<div class="chat"><div class="chat-log" aria-live="polite"></div><form class="chat-in"><textarea rows="1" maxlength="1500" placeholder="Escribe un mensaje…" aria-label="Mensaje"></textarea><button class="btn gold" type="submit">Enviar</button></form></div>`;
  const log=$(".chat-log",host),f=$(".chat-in",host),ta=$("textarea",f);let sig="",timer=null,st=null;
  const day=t=>new Date(t).toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short"}),hr=t=>new Date(t).toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit"});
  const draw=d=>{st=d;const L=(d&&d.messages)||[];const k=L.map(m=>m.id+(m.read?1:0)).join()+"|"+(d&&d.open);if(k===sig)return;sig=k;
    const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;let lastDay="";
    log.innerHTML=L.length?L.map(m=>{const dd=day(m.at),sep=dd!==lastDay?`<div class="chat-day">${esc(dd)}</div>`:"";lastDay=dd;
      return `${sep}<div class="msg ${m.mine?"me":"them"}"><div class="bub">${esc(m.body).replace(/\n/g,"<br>").replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')}</div><small>${m.mine?me:them} · ${hr(m.at)}${m.mine&&m.read?" · ✓✓ visto":""}</small></div>`}).join(""):`<div class="chat-empty">${empty}</div>`;
    const off=d&&d.exists===false&&!send.canStart?true:d&&d.open===false;f.hidden=!!off;
    let n=$(".chat-end",host);if(off&&d&&d.exists!==false){if(!n){n=document.createElement("div");n.className="chat-end";host.querySelector(".chat").appendChild(n)}n.textContent=closedTxt}else if(n)n.remove();
    if(atBottom||!log.dataset.init){log.scrollTop=log.scrollHeight;log.dataset.init=1}};
  const refresh=async()=>{if(!host.isConnected){clearInterval(timer);return}try{draw(await load())}catch(e){}};
  ta.addEventListener("input",()=>{ta.style.height="auto";ta.style.height=Math.min(140,ta.scrollHeight)+"px"});
  ta.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&matchMedia("(pointer:fine)").matches){e.preventDefault();f.requestSubmit()}});
  f.onsubmit=async e=>{e.preventDefault();const v=ta.value.trim();if(!v)return;const b=$("button",f);b.disabled=true;try{await send(v);ta.value="";ta.style.height="auto";sig="";await refresh();log.scrollTop=log.scrollHeight}catch(x){toast(x.message)}b.disabled=false;ta.focus()};
  refresh();timer=setInterval(()=>{if(!document.hidden)refresh()},7000);
  return{refresh,fill:t=>{ta.value=t;ta.dispatchEvent(new Event("input"));ta.focus()}}}

ROUTES.mensajes=async()=>{if(!logged()){location.hash="#entrar";return}
  app.innerHTML=`<section class="sec chat-page"><div class="sec-h"><div><span class="eyebrow">Privado</span><h1>Mensajes</h1><p class="muted">Conversación privada entre tú y El Arte Gráfico. Nadie más la ve. Los mensajes se borran solos a los pocos días.</p></div></div><div id="chatHost"></div></section>`;
  chatBox($("#chatHost"),{load:()=>API.dmMine(),send:v=>API.dmSend(v),empty:"Todavía no tienes mensajes. Si necesitamos algo de ti, te escribiremos por aquí y te llegará una notificación.",closedTxt:"Esta conversación terminó."});
  setTimeout(dmPoll,1200)};

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
      ${s.image_url?`<div class="bgimg" style="background-image:url('${esc(s.image_url)}')"></div>`:emblem?`<img class="emblem" src="${esc(S.site.logoFullUrl||"assets/logo_circle.webp")}" alt="">`:""}
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
const statsBand=()=>API.publicStats().then(st=>{if(!$("#stats"))return;$("#stats").innerHTML=[[st.students,"alumnos registrados"],((S.courses||[]).some(c=>c.base)?["Gratis","curso Fundamentos del trading"]:[TEMARIO.length,"módulos en el temario"]),[st.exercises,"ejercicios en gráficas reales"],[st.rating?st.rating.toFixed(1)+" / 5":"—",st.reviews?`calificación · ${st.reviews} opiniones`:"calificación"]].map(([v,t])=>`<div><b class="mono">${esc(v??0)}</b><span>${t}</span></div>`).join("")}).catch(()=>{});
const DISC={title:"La comunidad de El Arte Gráfico",text:"Un espacio para traders que operan con reglas: análisis del día, dudas resueltas, avisos del método y acompañamiento entre alumnos.",items:["Análisis y zonas compartidas a diario","Avisos de actualizaciones y nuevas lecciones","Sala Oro: chat privado, lives y operativas para Oro y Diamond","Mensajes privados con El Arte Gráfico para resolver tus dudas"]};

/* ---------- bloques del inicio ---------- */
const TEMARIO_F=3;/* los primeros 3 son del curso gratis Fundamentos del trading; desde "Estructura del mercado" es Boom y Crash */
const TEMARIO=[["Bienvenida e introducción",5,"Introducción"],["La plataforma: Deriv y MT5",6,"Básico"],["Velas japonesas",5,"Básico"],["Estructura del mercado",6,"Básico"],
  ["Fractales y zonas",6,"Intermedio"],["Las entradas: Inicio, Punta y Aislada",7,"Intermedio"],["Stop loss y manejo de la operación",6,"Intermedio"],
  ["Gestión del riesgo",6,"Gestión"],["Psicología y rachas",5,"Gestión"],["Boom y Crash a fondo",6,"Avanzado"],["Tu plan de trading y tu diario",5,"Avanzado"],
  ["Medir tu estrategia con datos",5,"Avanzado"],["Examen final",3,"Evaluación"]];
const ICON_TT='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 4.9 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z"/></svg>';

/* gráfico animado: zona → stop loss → repetición (ilustrativo) */
function demoChart(host){if(!host)return;
  const st=["Lee la estructura y marca tu zona","Define tu entrada y tu stop loss","Mira la repetición vela por vela"];
  host.innerHTML=`<div class="dm-top"><span class="dm-mk">Boom 1000</span></div><div class="dm-cv"><canvas aria-hidden="true"></canvas></div>
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
    tag(Y(zHi)-2,"Zona","#d8b062","#1c1404",za);tag(Y(sl)+2,"Stop loss","#e84c5c","#fff",sa);
    if(nPost>ent&&ent>=0){const x=X(pre.length+ent),y=Y(zHi);cx.fillStyle="#d8b062";cx.beginPath();cx.arc(x,y,4.5,0,7);cx.fill()}
    const ra=ease((t-9)/.6);if(ra>0){cx.globalAlpha=fade*ra;const txt=`+${R.toFixed(1)} R`;cx.font="800 22px Inter,system-ui,sans-serif";const w=cx.measureText(txt).width+26,x=W/2-w/2,y=16;
      cx.fillStyle="rgba(46,196,134,.16)";cx.strokeStyle="#2ec486";cx.lineWidth=1.5;cx.beginPath();cx.roundRect?cx.roundRect(x,y,w,38,10):cx.rect(x,y,w,38);cx.fill();cx.stroke();cx.fillStyle="#7df0bd";cx.fillText(txt,x+13,y+27);cx.globalAlpha=1}
    cx.globalAlpha=1;
    const step=t<2.1?-1:t<3.7?0:t<5.2?1:2;$$(".dm-steps li",host).forEach(li=>li.classList.toggle("on",+li.dataset.s===step));
    if(!red)raf=requestAnimationFrame(frame)};
  raf=requestAnimationFrame(frame);cleanup.push(()=>cancelAnimationFrame(raf));
}
function aboutBlock(host){if(!host)return;const s=S.site;if(s.aboutHide){host.remove();return}
  const name=s.aboutName||s.name||"El Arte Gráfico";
  const items=s.aboutItems&&s.aboutItems.length?s.aboutItems:["Método propio para Boom y Crash, con reglas claras","Estructura, zonas, entradas y gestión: lo mismo que ves en mis videos","Práctica en gráficas reales, no solo teoría"];
  const tk=s.aboutTiktok||"https://www.tiktok.com/@el_arte_grafico";
  host.innerHTML=`<div class="about"><div class="about-ph${s.aboutPhoto?" foto":""}"><img src="${esc(s.aboutPhoto||s.logoFullUrl||"assets/logo_circle.webp")}" alt="${esc(name)}" loading="lazy"></div>
    <div class="about-t"><span class="eyebrow">${esc(s.aboutTitle||"Quién te enseña")}</span><h2>${esc(name)}</h2>
      <p class="muted">${esc(s.aboutText||"Soy el creador de El Arte Gráfico. En TikTok comparto mis análisis de Boom y Crash; aquí enseño el método completo, paso a paso: cómo leo la estructura, cómo encuentro mis zonas, cómo y cuándo entro, dónde pongo el stop loss y cómo gestiono el riesgo. Sin promesas de dinero fácil: reglas claras y mucha práctica.")}</p>
      <ul class="checks">${items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
      ${(s.aboutStats||[]).length?`<div class="cstats">${s.aboutStats.map(c=>`<div><b class="mono">${esc(c.v)}</b><span>${esc(c.t)}</span></div>`).join("")}</div>`:""}
      <div class="row"><a class="btn ghost btn-ic" href="${esc(tk)}" target="_blank" rel="noopener">${ICON_TT}<span>Verme en TikTok</span></a></div></div></div>`}
function temarioBlock(host){if(!host)return;const pub=new Set((S.modules||[]).filter(m=>m.status==="publicado"&&modOpen(m)).map(m=>m.title.trim().toLowerCase()));
  const tot=TEMARIO.reduce((a,x)=>a+x[1],0),base=(S.courses||[]).find(c=>c.base&&c.status!=="borrador"),paid=(S.courses||[]).find(c=>!c.base&&c.status!=="borrador");
  const row=([t,n,lv],i)=>{const on=pub.has(t.toLowerCase());return `<div class="tm${on?" on":""}${i>=5?" tm-x":""}"><span class="tm-n mono">${String(i+1).padStart(2,"0")}</span><div><b>${esc(t)}</b><span class="dim">${n} lecciones · ${esc(lv)}</span></div>${on?'<span class="tag pub">Disponible</span>':'<span class="tag">Próximamente</span>'}</div>`};
  if(!base){host.innerHTML=TEMARIO.map(row).join("")+`<p class="dim tm-foot">Los módulos se van publicando a medida que se graban, cada uno con ejercicios en gráficas reales.</p>`;return}
  const head=(ic,t,tag)=>`<div class="tm-h"><b>${esc(ic)} ${esc(t)}</b>${tag}</div>`;
  host.innerHTML=head(base.icon||"📚",base.title,'<span class="tag free-t">Gratis con tu cuenta</span>')+TEMARIO.slice(0,TEMARIO_F).map(row).join("")
    +head(paid?paid.icon||"🎯":"🎯",paid?paid.title:"Boom y Crash",`<span class="tag sc-lock">Con plan${paid&&paid.price?` o ${esc(paid.price)}`:""}</span>`)+TEMARIO.slice(TEMARIO_F).map((x,i)=>row(x,i+TEMARIO_F)).join("")
    +`<a class="btn ghost sm tm-more" href="${toAcad("academia")}">Ver el temario completo</a><p class="dim tm-foot">Los módulos se van publicando a medida que se graban, cada uno con ejercicios en gráficas reales. Empiezas gratis con ${esc(base.title)} y sigues con la estrategia de tu mercado.</p>`}
/* mini tutorial: pasar una cuenta de Deriv existente al socio de El Arte Gráfico (retag) */
function retagGuide(){const s=S.site||{},link=(s.derivRefUrl||"").trim(),code=(s.derivPartnerCode||"").trim();
  const msg=`Hola, quiero hacer un retag de mi cuenta de Deriv (mi ID es CR…) para que quede con el socio El Arte Gráfico.${code?` Código de socio: ${code}.`:""}${link?` Este es su enlace: ${link}`:""}`;
  setTimeout(()=>{const b=$("#rtgCp");if(b)b.onclick=async()=>{try{await navigator.clipboard.writeText(msg);toast("Mensaje copiado")}catch(e){toast("Cópialo a mano")}}},0);
  return `<details class="retag"><summary><b>¿Ya tenías cuenta de Deriv con otro enlace?</b><span class="muted">Puedes pasarla a El Arte Gráfico (se llama "retag"). Así:</span></summary>
    <ol class="steps">
      <li><b>Abre el chat de soporte de Deriv.</b> En deriv.com o en la app, toca el chat de ayuda (Live chat) y pide hablar con un agente.</li>
      <li><b>Pide el retag.</b> Copia este mensaje, cambia CR… por tu ID y envíalo:<div class="rtg-msg">${esc(msg)}</div><button type="button" class="btn sm" id="rtgCp">Copiar mensaje</button></li>
      <li><b>Espera la confirmación de Deriv.</b> Ellos te avisan por el chat o por correo cuando quede hecho.</li>
      <li><b>Vuelve aquí y envía tu ID</b> en el formulario de arriba. Si ya está en nuestra lista de socios, quedas verificado al instante; si no, lo revisamos en pocos días.</li>
    </ol>
    ${link?`<a class="btn ghost sm" href="${esc(link)}" target="_blank" rel="noopener sponsored">Ver nuestro enlace de socio</a>`:""}</details>`}
function freeCard(o={}){const bc=(S.courses||[]).find(c=>c.base&&c.status!=="borrador");
  if(bc&&!premium()){const cta=!logged()?`<a class="btn" href="${toMain("registro")}">Crear cuenta gratis</a>`:closedAcad()?'<span class="btn disabled" aria-disabled="true">Empieza cuando abra la academia</span>':`<a class="btn" href="${toAcad("academia")}">Ir a ${esc(bc.title)}</a>`;
    return `<div class="price free"><span class="price-tag free-tag">Sin tarjeta</span><h3>${esc(bc.icon||"📚")} Gratis</h3><div class="price-v"><b>0</b><span>USD</span></div><span class="dim">para siempre, solo con tu cuenta</span>
      <ul class="checks"><li>Curso <b>${esc(bc.title)}</b> completo</li><li>5 gráficas de práctica</li><li>Retos diarios con premios y ranking</li><li>Noticias de la comunidad</li></ul>${cta}</div>`}
  const d=trialDays(),fm=(S.modules||[]).filter(m=>m.free&&m.status!=="borrador");if(!d||!fm.length||premium())return"";
  const cta=!logged()?`<a class="btn" href="${toMain("registro")}">Empezar gratis</a>`:closedAcad()?'<span class="btn disabled" aria-disabled="true">Empieza cuando abra la academia</span>':inTrial()?`<a class="btn" href="${toAcad("inicio")}">Ir a mi clase gratis</a>`:'<span class="btn disabled" aria-disabled="true">Tu prueba ya terminó</span>';
  return `<div class="price free"><span class="price-tag free-tag">Sin tarjeta</span><h3>Prueba gratis</h3><div class="price-v"><b>0</b><span>USD</span></div><span class="dim">por ${d} días${logged()&&inTrial()?` · te quedan ${trialLeft()}`:""}</span>
    <ul class="checks"><li>${fm.length>1?"Módulos":"Módulo"} ${fm.map(m=>`“${esc(m.title)}”`).join(" y ")} completo</li><li>5 gráficas de práctica</li><li>Retos diarios y ranking</li><li>Noticias de la comunidad</li></ul>${cta}</div>`}
const TIER_ITEMS={
  cobre:["📚 Acceso a todos los cursos disponibles, con sus módulos, ejercicios, encuestas, medallas y tu avance","🗓 Curso Boom y Crash: sale el 1 de diciembre y cada 5 días se abre un módulo nuevo","🎯 Todo lo de la cuenta gratis: retos diarios, retos express y ranking","💵 Gana dinero respondiendo retos: acumulas puntos y los cambias por USDT","💬 Soporte por mensajería"],
  plata:["✅ Todo lo de Cobre","📊 EAG Charts completo 24/7: gráficos en vivo de Boom, Crash, sintéticos y forex, multitemporalidad, alertas al celular, dibujos guardados en tu cuenta y app instalable","🎉 Eventos de la comunidad","🏆 Torneos gratis con premios reales en USDT","🚀 Acceso anticipado a cursos nuevos","🆕 Módulos nuevos y actualizaciones de los cursos apenas salen"],
  oro:["✅ Todo lo de Plata","🔴 Clase grupal en vivo con Nicolás Ardila, CEO de El Arte Gráfico y profesor: 2 horas, 1 día a la semana (y más cuando hay temas nuevos)","⏯ Replay en EAG Charts: backtesting con el mercado real desde la fecha que tú quieras"],
  diamond:["✅ Todo lo de Oro","🎓 Práctica guiada en EAG Charts: estudia con mercado real proyección, zonas, rompimientos e impulsos, con corrección al instante","🧩 Tus indicadores de MT5 en EAG Charts, en PC y en la app del celular (con código fuente y bajo políticas de aceptación)","📞 1 hora a la semana para hablar con Nicolás Ardila (la agendas tú)","⚡ Uso prioritario de las nuevas herramientas del ecosistema El Arte Gráfico","🤖 Cupo prioritario cuando salga el bot de El Arte Gráfico, con auditoría e historial en cuenta real (próximamente)"]};
/* El admin pone solo el precio de 1 mes de cada plan; 3, 6 y 12 meses se calculan con su descuento
   (precios que terminan en 9 cuando quedan cerca). Si el admin escribió a mano otra duración, se respeta la suya. */
function planPrice(p1,m,d){const t=p1*m*(1-d/100),c9=Math.floor((t+1)/10)*10-1;return c9>0&&c9<=t&&(t-c9)/t<=0.03?c9:Math.round(t)}
function expandPlans(pl,disc){pl=(Array.isArray(pl)?pl:[]).filter(x=>x&&!x.auto);const D=String(disc||"3:10, 6:20, 12:30").split(/[,;]/).map(z=>z.split(":").map(n=>parseFloat(n))).filter(z=>z[0]>1&&z[1]>=0&&z[1]<90);
  const out=pl.slice(),mo=x=>Math.max(1,Math.round((+x.days||30)/30));
  ["cobre","plata","oro","diamond"].forEach(t=>{const one=pl.find(x=>tierOfPlan(x)===t&&mo(x)===1);if(!one)return;const v=parseFloat((String(one.price).replace(",",".").match(/\d+(\.\d+)?/)||["x"])[0]);if(!isFinite(v))return;
    const curr=String(one.price).replace(/[\d.,\s]+/g," ").trim()||"USD",nm=String(one.name).replace(/\s*·.*$/,"");
    D.forEach(([m,d])=>{if(pl.some(x=>tierOfPlan(x)===t&&mo(x)===m))return;out.push({name:`${nm} · ${m} meses`,days:m===12?365:m*30,price:`${planPrice(v,m,d)} ${curr}`,tier:t,auto:true})})});
  return out}
let PRICE_SEL={}; /* meses elegidos en cada plan (tarjeta) */
function pricingBlock(host,o={}){if(!host)return;const s=S.site;const pl=(s.plans||[]).filter(x=>x&&x.name&&x.price);const cs=(S.courses||[]).filter(c=>c.status!=="borrador"&&!c.base),bases=(S.courses||[]).filter(c=>c.status!=="borrador"&&c.base);
  if((!pl.length&&!cs.length)||(premium()&&!o.page)){host.remove();return}const off=o.off??!!s.paymentsOff;
  const num=x=>{const m=String(x).replace(",",".").match(/\d+(\.\d+)?/);return m?parseFloat(m[0]):NaN};const cur=x=>String(x).replace(/[\d.,\s]+/g," ").trim()||"USD";
  const fm=v=>(Math.round(v*10)/10).toLocaleString("es-CO",{maximumFractionDigits:1});
  const btn=(lbl,attr,gold)=>off?'<span class="btn disabled" aria-disabled="true">Disponible pronto</span>':o.page?`<button type="button" class="btn ${gold?"gold":""}" ${attr}>${lbl}</button>`:`<a class="btn ${gold?"gold":""}" href="${toMain("premium")}">${lbl}</a>`;
  const ORD=["cobre","plata","oro","diamond"],mo=x=>Math.max(1,Math.round(x.days/30));
  /* una tarjeta por plan; adentro eliges 1, 3, 6 o 12 meses */
  const byT={};pl.forEach((x,i)=>{const t=tierOfPlan(x);(byT[t]=byT[t]||[]).push({x,i,m:mo(x)})});
  const tiers=ORD.filter(t=>byT[t]).concat(Object.keys(byT).filter(t=>!ORD.includes(t)));
  const card=t=>{const opts=byT[t].sort((a,b)=>a.m-b.m),T=TIERS[t]||{n:t,i:""},b1=opts.find(r=>r.m===1),base=b1?num(b1.x.price):NaN;
    const selM=opts.some(r=>r.m===PRICE_SEL[t])?PRICE_SEL[t]:(b1?1:opts[0].m),r=opts.find(z=>z.m===selM),x=r.x,v=num(x.price),m=r.m,full=isFinite(base)&&m>1?base*m:NaN,ah=isFinite(full)&&v<full?Math.round(100*(1-v/full)):0,pm=v/m;
    const dsc=z=>isFinite(base)&&z.m>1?Math.round(100*(1-num(z.x.price)/(base*z.m))):0;
    const chips=opts.length>1?`<div class="dur-c" role="radiogroup" aria-label="Meses del plan ${esc(T.n)}">${opts.map(z=>`<button type="button" role="radio" aria-checked="${z.m===m}" data-tdur="${t}:${z.m}" class="${z.m===m?"on":""}"><b>${z.m===1?"1 mes":z.m+" meses"}</b>${dsc(z)>0?`<em>−${dsc(z)}%</em>`:""}</button>`).join("")}</div>`:"";
    return `<div class="price tier-${t}${t==="plata"?" fav":""}">${t==="plata"?'<span class="price-tag">Más elegido</span>':t==="oro"?'<span class="price-tag oro-tag">Clases en vivo</span>':t==="diamond"?'<span class="price-tag dia-tag">Todo incluido</span>':""}<h3><span class="tier-i">${T.i}</span> ${T.n}</h3>
      ${chips}
      ${ah?`<span class="price-old">${fm(full)} ${esc(cur(x.price))}</span>`:""}<div class="price-v"><b>${esc(String(x.price).replace(/\s*[A-Za-z]+$/,""))}</b><span>${esc(cur(x.price))}</span></div>
      <span class="dim">${m>1?`<b class="pm">${fm(pm)} ${esc(cur(x.price))} al mes</b> · pago único por ${m} meses`:`por 1 mes · sin renovación automática`}</span>${ah?`<span class="pill ok">Ahorras ${ah}% · ${fm(full-v)} ${esc(cur(x.price))}</span>`:""}
      <ul class="checks">${(TIER_ITEMS[t]||[]).map(t2=>`<li>${esc(t2)}</li>`).join("")}</ul>${myPlan()===t&&premium()?'<span class="pill ok">Tu plan actual</span>':""}${btn(`Elegir ${T.n} · ${m===1?"1 mes":m+" meses"}`,`data-pick="${r.i}"`,t!=="cobre")}</div>`};
  const plans=tiers.map(card).join("");
  const launch=c=>{let at=null;(S.modules||[]).filter(m=>m.course_id===c.id&&m.open_at).forEach(m=>{const t=Date.parse(m.open_at);if(t>Date.now()&&(at==null||t<at))at=t});
    const opened=(S.modules||[]).some(m=>m.course_id===c.id&&m.status==="publicado"&&!m.open_at&&m.available!==false&&!/^demo/i.test(m.title||""));
    if(at&&!opened)return"Sale el "+new Date(at).toLocaleDateString("es-CO",{timeZone:"America/Bogota",day:"numeric",month:"long"});
    if(!at&&/boom/i.test(c.title||"")&&Date.now()<Date.parse("2026-12-01T05:00:00Z"))return"Sale el 1 de diciembre";return""};
  const courses=cs.map(c=>{const mine=ownsCourse(c.id),ln=launch(c);return `<div class="price crs-card" style="--cc:${esc(c.color||"#d8b062")}"><span class="price-tag crs-ptag">${ln?"🗓 "+esc(ln):"Pago único"}</span><h3><span class="tier-i">${esc(c.icon||"🎓")}</span> Curso ${esc(c.title)}</h3><span class="dim tier-d">${ln?esc(ln)+" · un módulo nuevo cada 5 días":"De por vida"}</span><div class="price-v"><b>${esc(String(c.price||"40 USD").replace(/\s*[A-Za-z]+$/,""))}</b><span>${esc(cur(c.price||"40 USD"))}</span></div><span class="dim">un solo pago, es tuyo para siempre</span>
      <ul class="checks"><li>Todo el curso ${esc(c.title)}: videos, ejercicios y encuestas</li><li>Sus módulos nuevos y actualizaciones incluidos</li><li>Medallas del curso, placa y ✓ Graduado al terminarlo</li><li>📊 7 días de EAG Charts para que lo pruebes</li><li class="no">Sin los demás cursos ni beneficios de los planes</li></ul>${mine?'<span class="pill ok">Ya es tuyo</span>':btn("Comprar curso",`data-pickc="${esc(c.id)}"`,false)}</div>`}).join("");
  host.innerHTML=`${o.page?"":`<div class="sec-h"><div><span class="eyebrow">Precios</span><h2>Elige tu plan</h2></div><a href="#premium">Cómo pagar</a></div>`}
    <p class="dur-note">Todos los planes los puedes tomar por <b>1, 3, 6 o 12 meses</b>: entre más tiempo, más ahorras.</p><div class="prices${freeCard(o)?" has-free":""}">${freeCard(o)}${plans}</div>
    ${courses?`<h3 class="crs-h">¿Solo quieres un curso?</h3><div class="prices crs-prices">${courses}</div>`:""}
    <p class="dim price-foot">${off?"Los pagos están pausados por ahora: te avisaremos cuando abran.":"Pagas con Binance Pay en USDT y activamos tu plan o tu curso al confirmar el pago. Sin cobros automáticos: cuando se acaba tu tiempo, renuevas si quieres."} Los planes incluyen <b>todos</b> los cursos; el curso suelto es solo ese curso, para siempre.${bases.length?` El curso <b>${esc(bases.map(b=>b.title).join(" y "))}</b> es gratis con tu cuenta.`:""}</p>`;
  $$("[data-tdur]",host).forEach(b=>b.onclick=()=>{const[t,m]=b.dataset.tdur.split(":");PRICE_SEL[t]=+m;pricingBlock(host,o)});
  $$("[data-pick]",host).forEach(b=>b.onclick=()=>{const sel=$("#pP");const k=pl[+b.dataset.pick];if(sel){const j=(S.site.plans||[]).findIndex(x=>x.name===k.name);if(j>=0)sel.value="p:"+j}const t=$("#pay");if(t)t.scrollIntoView({behavior:"smooth",block:"start"})});
  $$("[data-pickc]",host).forEach(b=>b.onclick=()=>{const sel=$("#pP");if(sel)sel.value="c:"+b.dataset.pickc;const t=$("#pay");if(t)t.scrollIntoView({behavior:"smooth",block:"start"})})}
const FAQ_DEF=[["¿Necesito experiencia?","No. Empiezas por el curso gratis Fundamentos del trading, desde cero: qué es un bróker, cómo usar MT5, qué son los índices sintéticos y cómo leer las velas. Después pasas a la estrategia del mercado que elijas."],
  ["¿Con cuánto dinero empiezo?","Puedes aprender y practicar en una cuenta demo sin poner dinero. Cuando pases a real, el módulo de gestión del riesgo te enseña a calcular el lote según el tamaño de tu cuenta."],
  ["¿Funciona desde el celular?","Sí. La academia y los ejercicios funcionan en el navegador del celular y la puedes instalar como app."],
  ["¿Qué planes hay?","Cuatro planes, y cada uno lo pagas por 1, 3, 6 o 12 meses (entre más tiempo, más descuento). Cobre: todos los cursos, retos y puntos que cambias por USDT, y soporte por mensajería. Plata: todo lo de Cobre más EAG Charts completo 24/7, eventos, torneos gratis con premios en USDT y acceso anticipado a cursos nuevos. Oro: todo lo de Plata más la clase grupal en vivo con Nicolás Ardila (2 horas, 1 día a la semana) y el Replay de EAG Charts para hacer backtesting con mercado real. Diamond: todo lo de Oro más la Práctica guiada de EAG Charts, tus indicadores de MT5 en los charts, 1 hora a la semana con Nicolás Ardila y prioridad en las nuevas herramientas y en el bot. Si solo quieres un curso, lo compras una vez y es tuyo, con 7 días de EAG Charts de regalo."],
  ["¿Cómo pago?","Con Binance Pay en USDT. Registras el número de orden en la página Premium y activamos tu plan o tu curso cuando confirmamos el pago. No hay cobros automáticos."],
  ["¿Qué es gratis y qué se paga?","El curso Fundamentos del trading es gratis y completo con tu cuenta: qué es un bróker, MT5, índices sintéticos y velas japonesas. Lo que tiene costo son los cursos de estrategia para cada mercado, como Boom y Crash: lo compras una vez o lo tienes con cualquier plan."],
  ["¿Puedo probar antes de pagar?","Sí. Con tu cuenta gratis haces el curso Fundamentos completo, tienes 5 gráficas de prueba y juegas el reto del día. Así conoces la academia antes de pagar una estrategia."],
  ["¿Cómo funcionan los retos?","Cada día sale un reto gratis. Tienes unas horas para responder y al cierre se revelan la respuesta y los primeros 5 en acertar, que ganan puntos canjeables por USDT. No necesitas pagar ni depositar para participar."],
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
  star:'<path d="M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6L12 16.9 7.1 19.5l.9-5.6-4-3.9 5.5-.8z"/>',
  image:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8 8"/>',
  folder:'<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  scale:'<path d="M12 4v16M7 20h10M5 8h14"/><path d="M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>',
  users:'<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="10" r="2.5"/><path d="M15.5 14.6A4.5 4.5 0 0 1 21 19"/>',
  card:'<rect x="3" y="6" width="18" height="12.5" rx="2"/><path d="M3 10h18M7 15h3"/>',
  msg:'<path d="M4 5h16v11H9l-5 4z"/>',
  layers:'<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
  bolt:'<path d="M13 3L5 13.5h6L10 21l9-11.5h-6z"/>',
  medal:'<circle cx="12" cy="14" r="5.5"/><path d="M8.5 9.5L6 3h4l2 4 2-4h4l-2.5 6.5"/>',
  site:'<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18M7 6.8h.01M10 6.8h.01"/>'};
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
    :`<a class="btn gold btn-ic" href="https://charts.elartegrafico.com" target="_blank" rel="noopener">${ico("chart",18)}<span>Probar EAG Charts gratis</span></a><a class="btn ghost" href="${toAcad("prueba")}">Práctica con gráficas (${demo} de 5)</a><a class="btn ghost" href="#premium">Hazte premium</a>`;
  const tiles=[
    ["acad","Academia",cerr?"Abre muy pronto":prem?`${pas} de ${total} lecciones`:"Temario y prueba gratis",toAcad("inicio")],
    ["chart","Práctica",prem?"Gráficas reales ilimitadas":`${demo} gráficas de prueba`,toAcad(prem?"practica":"prueba")],
    ...(rewardsOn()||admin()?[["bolt","Reto del día","Gana puntos hoy","#retos"],["trophy","Ranking",`<span id="mhPos">Ver mi puesto</span>`,"#ranking"]]:[["layers","Mi progreso","Tabla de la academia",toAcad("progreso")],["news","Novedades","Publicaciones y avisos","#comunidad"]]),
    ["chat","Comunidad",s.discordUrl?"Entrar al Discord":"Noticias y avisos",s.discordUrl||"#comunidad",!!s.discordUrl],
    ["gear","Configuración","Perfil, app y notificaciones","#perfil"]];
  app.innerHTML=`<div id="appCard"></div>${launchBox(true)}
  <section class="mh">
    <div class="mh-bg" aria-hidden="true"></div>
    <div class="mh-id"><a class="mh-av" href="#perfil" title="Configuración">${avatar(p,84)}<span class="lvchip" title="${esc(lv.name)}">${lv.i+1}</span></a>
      <div class="mh-t"><span class="eyebrow">${saludo()}</span><h1>${esc(p.username||"trader")} ${flag(p.country||"")}</h1>
        <div class="mh-chips">${prem?premTag(myPlan()):myCourseTags()||'<span class="tag">Cuenta gratis</span>'}${p.affiliate?affTag():""}<span class="tag">${esc(lv.name)}</span>${admin()?'<span class="tag pub">Admin</span>':""}</div></div></div>
    <div class="mh-cta">${cta}</div>
    <div class="mh-bars">
      <div><div class="mh-bl"><span>Avance en la academia</span><b class="mono">${apct}%</b></div><div class="bar"><i style="width:${apct}%"></i></div></div>
      <div><div class="mh-bl"><span>${lv.to?`Nivel ${lv.i+2} en ${lv.to-(g.xp||0)} pts`:"Nivel máximo"}</span><b class="mono">${lpct}%</b></div><div class="bar"><i style="width:${lpct}%"></i></div></div>
    </div>
  </section>
  ${admin()?"":`<a class="mh-dm${S.dm&&S.dm.unread?" new":""}" href="${toMain("mensajes")}"><span class="mh-dm-i">${ico("chat",24)}${S.dm&&S.dm.unread?`<em class="nbadge">${S.dm.unread}</em>`:""}</span>
    <span><b>${S.dm&&S.dm.unread?`Tienes ${S.dm.unread>1?S.dm.unread+" mensajes nuevos":"un mensaje nuevo"}`:"Tus mensajes"}</b><small>${S.dm&&S.dm.unread?"El Arte Gráfico te escribió. Toca para leer y responder.":"Aquí te escribimos si necesitamos algo de ti (tu ID de Deriv, un pago, una duda). Te llega notificación."}</small></span><i>${S.dm&&S.dm.unread?"Leer":"Abrir"} →</i></a>`}
  ${inTrial()?trialCard():""}
  <section class="mh-tiles">${tiles.map(([k,t,d,h,ext])=>`<a class="mt" href="${esc(h)}"${ext?' target="_blank" rel="noopener"':""}><span class="mt-i">${ico(k)}</span><b>${t}</b><span class="dim">${d}</span></a>`).join("")}</section>
  <section class="mh-grid">
    <div class="panel"><div class="sec-h"><h3>Novedades</h3><a href="#comunidad">Ver todo</a></div><div id="mhNews" class="mh-news"><div class="muted">Cargando…</div></div></div>
    <div class="mh-side">
      <div class="panel mh-plan">${prem?`<span class="mt-i gold">${ico("crown")}</span><div><b>Tu plan Premium</b><span class="muted">${dias!=null&&dias>=3650?"Acceso de por vida a todo":dias!=null&&dias<3650?`Te quedan <b>${dias}</b> día${dias===1?"":"s"} · hasta ${fmtDate(p.premium_until)}`:"Acceso completo a la academia"}</span></div>${dias!=null&&dias<=7?'<a class="btn sm gold" href="#premium">Renovar</a>':""}`
        :`<span class="mt-i gold">${ico("crown")}</span><div><b>Desbloquea toda la academia</b><span class="muted">Todos los módulos, práctica ilimitada y tu placa dorada en el ranking.</span></div><a class="btn sm gold" href="#precios-mh">Ver planes</a>`}</div>
      <div class="panel"><div class="sec-h"><h3>${rewardsOn()||admin()?"Ranking de retos":"Tabla de progreso"}</h3><a href="${rewardsOn()||admin()?"#ranking":toAcad("progreso")}">Completo</a></div><div id="mhRk" class="muted">Cargando…</div></div>
    </div>
  </section>
  ${promoBlock()}
  ${prem?"":'<section class="sec" id="precios-mh"></section>'}`;
  appCard($("#appCard"));if(!prem)pricingBlock($("#precios-mh"));
  postsVis().then(ps=>{const h=$("#mhNews");if(!h)return;h.innerHTML=ps.slice(0,4).map(x=>`<a class="mn" href="#nota-${esc(x.id)}">${x.image_url?`<span class="mn-img" style="background-image:url('${esc(x.image_url)}')"></span>`:`<span class="mn-img none">${ico("news",20)}</span>`}<span class="mn-t"><span class="dim">${fmtDate(x.created_at)} · ${esc(x.category||"Noticia")}</span><b>${esc(x.title)}</b></span></a>`).join("")||'<div class="muted">Pronto publicaremos novedades.</div>'}).catch(()=>{const h=$("#mhNews");if(h)h.innerHTML='<div class="muted">No se pudieron cargar las novedades.</div>'});
  (rewardsOn()||admin()?API.rewardsBoard("mes").then(r=>r.map(x=>Object.assign(x,{v:x.points+" pts"}))):API.progressBoard().then(r=>r.map(x=>Object.assign(x,{v:x.lessons+" lecc."})))).then(r=>{const h=$("#mhRk");if(!h)return;const k=r.findIndex(x=>x.is_me);if($("#mhPos"))$("#mhPos").textContent=k>=0?`Vas en el puesto #${k+1}`:"Juega para aparecer";
    h.innerHTML=r.length?`<table class="tbl rk">${r.slice(0,5).map((x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,24)}${uL(x.username)}${flag(x.country)}${x.affiliate?affTag():""}</span></td><td class="n">${esc(x.v)}</td></tr>`).join("")}</table>${k>=5?`<div class="mh-me">Tú: puesto #${k+1} · ${esc(r[k].v)}</div>`:""}`:'<div class="muted">Todavía no hay nadie aquí. ¡Sé el primero!</div>'}).catch(()=>{const h=$("#mhRk");if(h)h.textContent="No se pudo cargar."});
}

/* =====================================================================
   RETOS DIARIOS · PUNTOS · AFILIADOS · CANJES (sitio principal)
   ===================================================================== */
const RW=()=>(S.site&&S.site.rewards)||{};
const rewardsOn=()=>RW().enabled!==false;
const affTag=()=>'<span class="aff-tag" title="Afiliado verificado de Deriv"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>Afiliado</span>';
const usdF=v=>(+v||0).toLocaleString("es-CO",{style:"currency",currency:"USD",minimumFractionDigits:2});
const ptsUsd=p=>{const r=Math.max(1,+RW().ptsPerUsd||100);return (p/r).toLocaleString("es-CO",{style:"currency",currency:"USD",minimumFractionDigits:2})};
const KIND={opcion:"Cuestionario",tendencia:"¿Sube o baja?",zona:"Marca la zona"};
function leftTxt(t){const ms=new Date(t)-Date.now();if(ms<=0)return"cerrado";const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4);return h>=24?`cierra en ${Math.floor(h/24)} d ${h%24} h`:h?`cierra en ${h} h ${m} min`:`cierra en ${m} min`}
/* contador en vivo de los retos */
function cdFmt(ms){if(ms<=0)return"0:00:00";const s=Math.floor(ms/1e3),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h>=24?`${Math.floor(h/24)} d ${h%24}`:h)+":"+String(m).padStart(2,"0")+":"+String(x).padStart(2,"0")}
const cdHtml=t=>`<span class="cd mono" data-cd="${esc(new Date(t).toISOString())}">${cdFmt(new Date(t)-Date.now())}</span>`;
const hhmm=t=>{const d=new Date(t),sameDay=d.toDateString()===new Date().toDateString();return d.toLocaleString("es-CO",sameDay?{hour:"numeric",minute:"2-digit"}:{weekday:"short",hour:"numeric",minute:"2-digit"})};
setInterval(()=>{document.querySelectorAll("[data-lc]").forEach(el=>{const ms=new Date(el.dataset.lc)-Date.now(),s=Math.max(0,Math.floor(ms/1e3)),v=[Math.floor(s/86400),Math.floor(s%86400/3600),Math.floor(s%3600/60),s%60];
    el.querySelectorAll("b").forEach((b,i)=>{const t=String(v[i]).padStart(2,"0");if(b.textContent!==t)b.textContent=t});if(ms<=0&&!el.dataset.done){el.dataset.done="1";setTimeout(()=>{S.site.academyClosed=false;renderNav();route(true)},1500)}});
  document.querySelectorAll("[data-cd]").forEach(el=>{const ms=new Date(el.dataset.cd)-Date.now();el.textContent=cdFmt(ms);if(ms<=0&&!el.dataset.done){el.dataset.done="1";if(/^#retos?(-|$)/.test(location.hash))setTimeout(()=>route(true),2000)}})},1000);
/* al cerrar un reto que jugaste, te mostramos tu resultado una sola vez */
function revealPop(c){if(!c||!c.closed||!c.answered)return false;const k="ag_rv_"+c.id;try{if(localStorage.getItem(k))return false;localStorage.setItem(k,"1")}catch(e){return false}
  if(c.my_place)pop({icon:"trophy",kicker:`¡Ganaste! · Puesto #${c.my_place}`,title:c.express?`+${usdF(c.my_usd)} a tu saldo`:`+${c.my_points} puntos`,text:c.express?"Ya puedes retirarlo cuando quieras en Saldo y puntos.":`Quedaste entre los ${c.max_winners} primeros en “${c.title}”.`,confetti:true,ms:5500});
  else if(c.my_correct)pop({icon:"check",tone:"blue",kicker:"Acertaste",title:"Pero otros llegaron primero",text:"Los cupos se los llevaron los más rápidos. ¡En el próximo responde antes!"});
  else pop({icon:"x",tone:"red",kicker:"Resultado del reto",title:"Esta vez no era",text:"Mira la respuesta y la explicación, y vuelve por el próximo reto."});return true}
/* bloque publicitario: El Arte Gráfico te paga por participar */
/* camino: Fundamentos gratis -> estrategia por mercado (de pago) */
function pathBlock(){const base=(S.courses||[]).filter(c=>c.base&&c.status!=="borrador"),paid=(S.courses||[]).filter(c=>!c.base&&c.status!=="borrador");if(!base.length)return"";
  const b=base[0],mk=(S.site.markets||[]).filter(m=>!/disponible/i.test(m.status||"")).map(m=>m.name).slice(0,4),go=!logged()?toMain("registro"):closedAcad()&&!admin()?"":toAcad("academia");
  return `<section class="sec path"><div class="sec-h"><div><span class="eyebrow">Cómo funciona</span><h2>Primero aprende trading gratis. Después elige tu estrategia.</h2></div></div>
  <div class="path-g"><div class="path-s free"><span class="path-n">1</span><span class="pill ok">Gratis</span><h3>${esc(b.icon||"📚")} ${esc(b.title)}</h3><p class="muted">El curso completo, sin pagar nada: qué es un bróker, cómo usar MT5, qué son los índices sintéticos y cómo leer las velas japonesas. Solo necesitas tu cuenta.</p>
    ${go?`<a class="btn gold" href="${go}">${logged()?"Ir al curso":"Crear cuenta gratis"}</a>`:'<span class="pill">Disponible cuando abra la academia</span>'}</div>
  <div class="path-arrow" aria-hidden="true">→</div>
  <div class="path-s paid"><span class="path-n">2</span><span class="pill gold-p">Estrategia por mercado</span><h3>Aplica el método en un mercado concreto</h3><p class="muted">Cada mercado tiene su curso con la estrategia de El Arte Gráfico, ejercicios en gráficas reales y repetición. Esto es lo que tiene costo: lo compras una vez o lo tienes con cualquier plan.</p>
    <div class="path-m">${paid.map(c=>`<span class="path-c">${esc(c.icon||"🎯")} ${esc(c.title)} · <b>${esc(c.price||"")}</b></span>`).join("")}${mk.map(m=>`<span class="path-c soon">${esc(m)} · pronto</span>`).join("")}</div>
    <a class="btn ghost" href="${toMain("premium")}">Ver precios</a></div></div></section>`}
function promoBlock(){if(!rewardsOn()&&!RW().teaser)return"";const on=rewardsOn(),c=RW();
  return `<section class="promo"><div class="promo-t"><span class="eyebrow">${on?"Retos diarios · Gana USDT":"Muy pronto"}</span><h2>Acierta el reto y gana USDT.</h2>
    <p>Cada día sale un reto: un cuestionario, adivinar la tendencia o marcar la zona. Tienes <b>${RW().revealHours||3} horas</b> para responder y nadie sabe si ganó hasta el final: ahí se revelan <b>los primeros 5 en acertar</b>, que ganan puntos para cambiar por dinero cada mes${c.ptsPerUsd?` (${c.ptsPerUsd} puntos = 1 USD)`:""}.</p>
    <ul class="promo-l"><li>${ico("trophy",18)}Top 5 de cada reto gana puntos</li><li>${ico("bolt",18)}Resultados con suspenso al cierre</li><li>${ico("card",18)}Canjea cada mes por USDT</li><li>${ico("star",18)}Afiliados de Deriv ganan el doble</li></ul>
    <div class="row">${on?`<a class="btn gold" href="${toMain("retos")}">Ver el reto de hoy</a><a class="btn ghost" href="${toMain("ranking")}">Ranking</a>`:`<span class="pill gold">Te avisaremos cuando empiece</span>`}</div></div>
    <div class="promo-art" aria-hidden="true"><div class="pa-coin">$</div><div class="pa-card"><b>Reto del día</b><span>¿Sube o baja?</span><i></i><i></i><i></i></div><div class="pa-badge">+100 pts</div><div class="pa-cd mono">2:59:59</div></div></section>`}
/* lista de retos */
ROUTES.retos=async()=>{
  if(!rewardsOn()&&!admin()){app.innerHTML=`<div class="pagehead"><span class="eyebrow">Retos diarios</span><h1>Muy pronto</h1><p class="muted">Estamos preparando los retos diarios con premios. Te avisaremos por las notificaciones y la comunidad.</p></div>${promoBlock()}`;return}
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Retos diarios</span><h1>Juega, acierta y gana</h1><p class="muted">Cada reto dura <b>${RW().revealHours||3} horas</b>. Nadie sabe si ganó hasta el final: al cerrar se revelan la respuesta y los primeros ${5} que acertaron, que ganan puntos. Los afiliados verificados de Deriv reciben los puntos completos; el resto, la mitad. <a href="${toMain("legal-retos")}">Bases de los retos</a></p></div>
    ${admin()&&!rewardsOn()?'<div class="note admin-note">Los retos están apagados para los alumnos. Actívalos en Administración → Retos y puntos → Ajustes.</div>':""}
    <div id="myPts"></div><section class="sec"><div class="sec-h"><h2>Abiertos ahora</h2><a href="#ranking">Ver ranking</a></div><div id="rtOpen" class="rt-grid"><div class="muted">Cargando…</div></div></section>
    <section class="sec"><div class="sec-h"><h2>Retos anteriores</h2></div><div id="rtPast" class="rt-list"></div></section>`;
  ptsCard($("#myPts"));
  let L=[];try{L=await API.challengesFeed()}catch(e){$("#rtOpen").innerHTML=`<div class="empty">No se pudieron cargar los retos.</div>`;return}
  const card=c=>{return `<a class="rt-card${c.answered?" done":""}${c.closed?" closed":""}${c.weekly?" weekly":""}${c.express?" express":""}" href="#reto-${esc(c.id)}">
    ${c.express?`<span class="rt-wk rt-ex">⚡ Reto express · premio en dólares</span>`:c.weekly?`<span class="rt-wk">${ico2("crown",14)}Reto semanal</span>`:""}<div class="rt-top"><span class="rt-k">${ico(c.kind==="opcion"?"msg":c.kind==="tendencia"?"chart":"layers",16)}${KIND[c.kind]}</span><span class="rt-pts">${c.express?usdF(c.prize_usd):`+${c.points} pts`}</span></div>
    <b class="rt-t">${esc(c.title)}</b>
    ${c.closed?`<div class="rt-cupos">${Array.from({length:c.max_winners},(_,i)=>`<i class="${i<(c.winners||0)?"on":""}"></i>`).join("")}<span>Cerrado · ${c.winners||0} ganador${c.winners===1?"":"es"}</span></div>`
      :`<div class="rt-cdl"><span>⏳ Resultados en</span>${cdHtml(c.ends_at)}</div>`}
    <div class="rt-bot"><span class="dim">${c.closed?fmtDate(c.starts_at):`${c.players?`👥 ${c.players} ${c.players===1?"respondió":"respondieron"} · `:""}Top ${c.max_winners} gana${c.express?" dólares":""}`}</span>${c.answered&&!c.closed?'<span class="pill">✓ Enviada · en suspenso</span>':c.answered?(c.my_place?`<span class="pill ok">Ganaste · +${c.express?usdF(c.my_usd):c.my_points}</span>`:c.my_correct?'<span class="pill">Acertaste sin cupo</span>':'<span class="pill">Fallaste</span>'):c.closed?'<span class="pill">Ver respuesta</span>':'<span class="btn sm gold">Jugar</span>'}</div></a>`};
  const open=L.filter(c=>!c.closed),past=L.filter(c=>c.closed);
  {const nv=past.filter(c=>c.answered).sort((a,b)=>new Date(b.ends_at)-new Date(a.ends_at));for(const c of nv)if(revealPop(c))break}
  $("#rtOpen").innerHTML=open.map(card).join("")||'<div class="empty">No hay retos abiertos en este momento. El próximo sale pronto: activa las notificaciones para enterarte primero.</div>';
  {const ps=past.slice().sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));let n=5;const drawP=()=>{$("#rtPast").innerHTML=ps.slice(0,n).map(card).join("")||'<div class="muted">Aún no hay retos anteriores.</div>';
    if(ps.length>n)$("#rtPast").insertAdjacentHTML("beforeend",`<div class="rt-more-b"><button type="button" class="btn sm ghost" id="rtMore">Ver ${Math.min(5,ps.length-n)} más (${ps.length-n} restantes)</button></div>`);const mb=$("#rtMore");if(mb)mb.onclick=()=>{n+=5;drawP()}};drawP()}
};
/* tarjeta de mis puntos */
async function ptsCard(host,withStreak){if(!host)return;if(!logged()){host.innerHTML=`<div class="rk-cta"><div><b>Crea tu cuenta para participar</b><span class="muted">Necesitas una cuenta gratis para jugar los retos y acumular puntos.</span></div><a class="btn gold" href="#registro">Crear cuenta</a></div>`;return}
  let r=null,w=null;try{[r,w]=await Promise.all([API.myRewards(),API.myWallet().catch(()=>null)])}catch(e){}if(!r||!host.isConnected)return;const p=API.profile()||{};
  host.innerHTML=`<div class="pts-card${w?" wallet":""}">${w?`<div class="pts-bal"><a class="bal usd" href="#puntos-saldo"><span class="eyebrow">💵 Saldo</span><b class="mono">${usdF(w.usd)}</b><span class="dim">De retos express · retíralo cuando quieras</span></a>
      <a class="bal" href="#puntos"><span class="eyebrow">⭐ Puntos</span><b class="mono">${r.balance}</b><span class="dim">≈ ${ptsUsd(r.balance)} · este mes +${r.month} · canje mensual</span></a></div>`
    :`<div class="pts-main"><span class="eyebrow">Mis puntos</span><b class="mono">${r.balance}</b><span class="dim">≈ ${ptsUsd(r.balance)} · este mes +${r.month}</span></div>`}
    <div class="pts-st"><div><b class="mono">${r.wins}</b><span>retos ganados</span></div><div><b class="mono">${r.played}</b><span>jugados</span></div><div>${p.affiliate?affTag():`<span class="tag">${r.affiliate==="pendiente"?"Afiliado: en revisión":"No afiliado"}</span>`}<span>${p.affiliate?"puntos completos":"recibes la mitad"}</span></div></div>
    <div class="pts-act">${w&&+w.usd>=+(w.min_usd||1)?`<a class="btn gold" href="#puntos-saldo">Retirar ${usdF(w.usd)}</a>`:""}<a class="btn ${w&&+w.usd>=+(w.min_usd||1)?"ghost":"gold"}" href="#puntos">${RW().redeemOpen?"Canjear puntos":"Mis puntos"}</a>${p.affiliate?"":`<a class="btn ghost" href="#puntos-afiliado">Verificar afiliado</a>`}</div></div>${withStreak!==false?streakCard(r):""}`;
  const L=evalAch(RETO_ACH,r);checkAch("retos",L);const sh=$("#retoAch");if(sh)sh.innerHTML=achHero(L,"Retos · Logros",L.filter(a=>a.on).length?"Tus medallas de retos":"Gana tu primera medalla de retos")+achGroups(L)}
/* jugar un reto */
ROUTES.reto=async id=>{
  app.innerHTML='<div class="muted">Cargando reto…</div>';let L=[];try{L=await API.challengesFeed()}catch(e){}const c=L.find(x=>x.id===id);
  if(!c){app.innerHTML=`<div class="empty">Ese reto no existe o todavía no está publicado.<a class="btn sm" href="#retos">Ver retos</a></div>`;return}
  const opts=(c.options&&c.options.length?c.options:(c.kind==="tendencia"?["Sube","Baja"]:[]));const can=!c.closed&&!c.answered&&logged()&&rewardsOn();
  app.innerHTML=`<div class="crumbs"><a href="#retos">Retos</a><span>/</span><span>${esc(c.title)}</span></div>
    <div class="rt-head"><div><span class="eyebrow">${c.express?"⚡ Reto express · ":c.weekly?"Reto semanal · ":""}${KIND[c.kind]} · ${c.express?`${usdF(c.prize_usd)} por ganador${API.profile()&&!API.profile().affiliate&&RW().halfIfNotAffiliate!==false?` (tú: ${usdF(Math.round(c.prize_usd*50)/100)})`:""}`:`+${c.points} pts${API.profile()&&!API.profile().affiliate?` (tú: +${Math.ceil(c.points/2)})`:""}`}</span><h1>${esc(c.title)}</h1>${c.question?`<p class="muted">${esc(c.question)}</p>`:""}</div>
      ${c.closed?`<div class="rt-meta"><div class="rt-cupos big">${Array.from({length:c.max_winners},(_,i)=>`<i class="${i<(c.winners||0)?"on":""}"></i>`).join("")}</div><span>Reto cerrado · ${c.winners||0} ganador${c.winners===1?"":"es"}</span></div>`
        :`<div class="rt-meta rt-cdbox"><span>Resultados en</span><b>${cdHtml(c.ends_at)}</b><small>a las ${esc(hhmm(c.ends_at))} · top ${c.max_winners} gana${c.players?` · 👥 ${c.players}`:""}</small></div>`}</div>
    ${!logged()?`<div class="rk-cta"><div><b>Ingresa para jugar</b><span class="muted">Crea tu cuenta gratis y participa en los retos diarios.</span></div><a class="btn gold" href="#registro">Crear cuenta</a></div>`:!rewardsOn()?'<div class="note admin-note">Vista de admin: los retos están apagados para los alumnos.</div>':""}
    <div class="rt-play panel">${c.image_url?`<img class="rt-img" src="${esc(c.image_url)}" alt="">`:""}${c.kind!=="opcion"?`<div class="chartbox rt-chart"><div class="cv" style="position:absolute;inset:0"></div><div class="chint">${c.kind==="zona"?"Toca la gráfica donde está tu zona":"Así iba el precio · ¿qué pasa después?"}</div></div>`:""}
      ${c.kind==="zona"?`<div class="row rt-zbar"><span id="rzv" class="muted">${can?"Toca la gráfica para poner tu zona":""}</span><button class="btn gold" id="rzOk" disabled ${can?"":"hidden"}>Enviar mi zona</button></div>`
        :`<div class="rt-opts">${opts.map((o,i)=>`<button type="button" class="rt-opt${c.correct===i?" ok":""}${c.my_answer&&+c.my_answer.option===i?" pick":""}" data-o="${i}" ${can?"":"disabled"}><i>${String.fromCharCode(65+i)}</i><span>${esc(o)}</span></button>`).join("")}</div>`}
      <div id="rtRes"></div></div>
    <section class="sec"><div class="sec-h"><h2>Ganadores</h2></div><div id="rtWin" class="muted">Cargando…</div></section>`;
  const res=$("#rtRes");
  const wait=()=>{res.innerHTML=`<div class="result rt-susp"><b class="big">✓ Respuesta enviada</b><div>Nadie sabe todavía si ganó. A las <b>${esc(hhmm(c.ends_at))}</b> se revelan la respuesta correcta y los ${c.max_winners} primeros que acertaron.</div><div class="rt-cdl">⏳ ${cdHtml(c.ends_at)}</div></div>`};
  const show=(r,mine)=>{if(r.reason==="cuenta_nueva"){res.innerHTML=`<div class="result"><b class="big">Respuesta registrada</b><div>Tu cuenta se creó después de que salió este reto, así que este no suma puntos. Desde el próximo reto ya compites por los premios. <a href="${toMain("legal-retos")}">Ver bases</a></div></div>`;return}res.innerHTML=r.correct?(r.place?`<div class="result ok"><b class="big">¡Acertaste! Puesto #${r.place} · +${r.express?usdF(r.usd)+" a tu saldo":r.points+" puntos"}</b>${r.express?`<div><a href="#puntos-saldo">Retirar mi saldo</a></div>`:""}${!r.express&&!r.affiliate&&r.points<r.full_points?`<div>Como no eres afiliado verificado recibiste la mitad. <a href="#puntos-afiliado">Verifícate y gana los ${r.full_points} completos</a>.</div>`:""}</div>`
      :`<div class="result"><b class="big">Acertaste, pero ya se llenaron los ${c.max_winners} cupos</b><div>Sé de los primeros en el próximo reto. Activa las notificaciones para enterarte apenas salga.</div></div>`)
      :`<div class="result bad"><b class="big">No era esa</b><div>Mañana hay otro reto. ¡Sigue practicando en la academia!</div></div>`};
  if(c.answered&&!c.closed)wait();else if(c.answered)show({correct:c.my_correct,place:c.my_place,points:c.my_points,affiliate:(API.profile()||{}).affiliate,full_points:c.points,express:c.express,usd:c.my_usd});
  if(c.explain)res.insertAdjacentHTML("beforeend",`<div class="note" style="margin-top:12px"><b>Explicación:</b> ${esc(c.explain)}</div>`);
  if(c.closed)revealPop(c);
  const send=async ans=>{try{const r=await API.submitChallenge(c.id,ans);if(r.reason==="cuenta_nueva")show(r);else if(r.received)wait();else show(r);
    if(r.reason==="cuenta_nueva")pop({icon:"check",tone:"blue",kicker:"Respuesta registrada",title:"Desde el próximo reto ya sumas",text:"Las cuentas creadas después de publicado un reto juegan, pero no suman en ese reto."});
    else if(r.received)pop({icon:"check",tone:"blue",kicker:"Respuesta enviada",title:`Resultados a las ${hhmm(r.reveal_at||c.ends_at)}`,text:`Ahí sabrás si quedaste entre los ${c.max_winners} primeros. ¡Suerte!`,ms:4500});
    else if(r.correct&&r.place)pop({icon:"trophy",kicker:`¡Acertaste! · Puesto #${r.place}`,title:`+${r.points} puntos`,text:!r.affiliate&&r.points<r.full_points?`Verifícate como afiliado y gana los ${r.full_points} completos.`:"Quedaste entre los ganadores del reto.",confetti:true,ms:5000});
    else if(r.correct)pop({icon:"check",tone:"blue",kicker:"Acertaste",title:"Pero ya se llenaron los cupos",text:"Activa las notificaciones y sé de los primeros mañana."});
    else pop({icon:"x",tone:"red",kicker:"No era esa",title:"Mañana hay otro reto",text:"Mira la explicación cuando cierre y sigue practicando."});setTimeout(()=>ROUTES.reto(c.id),1800)}catch(x){toast(x.message)}};
  $$("[data-o]").forEach(b=>b.onclick=()=>{if(!can)return;$$("[data-o]").forEach(x=>{x.disabled=true;x.classList.toggle("pick",x===b)});send({option:+b.dataset.o})});
  if(c.kind!=="opcion"&&c.bars&&c.bars.length){try{const row=a=>({t:a[0],o:a[1],h:a[2],l:a[3],c:a[4]});const vis=c.bars.map(row),aft=(c.after_bars||[]).map(row),dec=c.decimals||2;const C=Chart.makeChart($(".rt-chart .cv"));
      const all=vis.concat(aft);C.setData(toC(all),dec);C.setRange(all.length-70,all.length+6);cleanup.push(()=>C.destroy&&C.destroy());
      if(aft.length){const h=$(".rt-chart .chint");if(h)h.textContent="Así siguió el precio después de la última vela del reto";C.addLine({price:vis[vis.length-1].c,color:"rgba(200,208,222,.55)",lineWidth:1,lineStyle:"dotted",title:"Precio al cierre del reto"})}
      if(c.zone!=null){C.addLine({price:c.zone,color:"#f3d88f",lineWidth:2,title:"Zona correcta",band:c.tol?c.zone+c.tol:null,bandColor:"rgba(216,176,98,.16)"});if(c.tol)C.addLine({price:c.zone-c.tol,color:"rgba(243,216,143,.5)",lineWidth:1,lineStyle:"dotted"})}
      if(c.my_answer&&c.my_answer.price!=null)C.addLine({price:+c.my_answer.price,color:"#c8d0de",lineWidth:2,lineStyle:"dashed",title:"Tu zona"});
      if(c.kind==="zona"&&can){let mine=null,ln=null;C.onClick(p=>{mine=p;if(ln)C.removeLine(ln);ln=C.addLine({price:p,color:"#c8d0de",lineWidth:2,lineStyle:"dashed",draggable:true,title:"Tu zona"});$("#rzv").textContent="Tu zona: "+p.toFixed(dec)+" · puedes arrastrarla";$("#rzOk").disabled=false});
        C.onLineDrag((l,p)=>{if(l===ln){mine=p;$("#rzv").textContent="Tu zona: "+p.toFixed(dec)}});$("#rzOk").onclick=()=>{if(mine==null)return;$("#rzOk").disabled=true;send({price:+mine.toFixed(dec)})}}
    }catch(e){const b=$(".rt-chart");if(b)b.innerHTML='<div class="empty">No se pudo cargar la gráfica.</div>'}}
  else if(c.kind!=="opcion"&&c.market&&c.chart_t){try{const H=await h1Bars(c.market);const end=idxAt(H.bars,c.chart_t||H.bars[H.bars.length-1].t);const C=Chart.makeChart($(".rt-chart .cv"));
      const rev=(c.correct!=null||c.zone!=null)?36:0;const bars=H.bars.slice(Math.max(0,end-90),end+1+rev);C.setData(toC(bars),H.dec);C.setRange(bars.length-70,bars.length+6);cleanup.push(()=>C.destroy&&C.destroy());
      if(rev){const h=$(".rt-chart .chint");if(h)h.textContent="Así siguió el precio después de la última vela del reto";if(C.addMarker)C.addMarker({time:H.bars[end].t+TZ,text:"Aquí cerraba el reto"});else C.addLine&&C.addLine({price:H.bars[end].c,color:"rgba(200,208,222,.55)",lineWidth:1,lineStyle:"dotted",title:"Precio al cierre del reto"})}
      if(c.zone!=null){C.addLine({price:c.zone,color:"#f3d88f",lineWidth:2,title:"Zona correcta",band:c.tol?c.zone+c.tol:null,bandColor:"rgba(216,176,98,.16)"});if(c.tol)C.addLine({price:c.zone-c.tol,color:"rgba(243,216,143,.5)",lineWidth:1,lineStyle:"dotted"})}
      if(c.kind==="zona"){const ma=c.answer||null;let mine=null,ln=null;
        if(can){C.onClick(p=>{mine=p;if(ln)C.removeLine(ln);ln=C.addLine({price:p,color:"#c8d0de",lineWidth:2,lineStyle:"dashed",draggable:true,title:"Tu zona"});$("#rzv").textContent="Tu zona: "+p.toFixed(H.dec)+" · puedes arrastrarla";$("#rzOk").disabled=false});
          C.onLineDrag((l,p)=>{if(l===ln){mine=p;$("#rzv").textContent="Tu zona: "+p.toFixed(H.dec)}});
          $("#rzOk").onclick=()=>{if(mine==null)return;$("#rzOk").disabled=true;send({price:+mine.toFixed(H.dec)})}}}
    }catch(e){const b=$(".rt-chart");if(b)b.innerHTML='<div class="empty">No se pudo cargar la gráfica.</div>'}}
  if(!c.closed){const h=$("#rtWin");if(h)h.innerHTML=`<div class="muted">Los ganadores se revelan a las <b>${esc(hhmm(c.ends_at))}</b>.</div>`}else API.challengeWinners(c.id).then(w=>{const h=$("#rtWin");if(!h)return;h.innerHTML=w.length?`<div class="win-list">${w.map(x=>`<div class="win"><span class="win-p">${x.place<=3?["🥇","🥈","🥉"][x.place-1]:"#"+x.place}</span>${avatar(x,34)}<b>${uL(x.username)}</b>${flag(x.country)}${x.affiliate?affTag():""}${x.premium?premTag():""}<span class="mono win-pt">+${x.points}</span></div>`).join("")}</div>`:'<div class="muted">Todavía nadie gana este reto. ¡Puedes ser el primero!</div>'}).catch(()=>{});
};
/* ---------- 👑 Sala Oro: lives privados, operativas y ruleta diaria ---------- */
const WHEEL=[["+50 XP","#2a3f7a"],["+100 XP","#1a2c66"],["Medalla","#7a5a12"],["+250 XP","#2a3f7a"],["+500 XP","#1a2c66"],["+1 día","#14935f"]];
const MEDALS={trebol:["☘️","Trébol de la suerte"],herradura:["🧲","Herradura"],estrella:["⭐","Estrella fugaz"],cometa:["☄️","Cometa"],diamante:["💎","Diamante"]};
const bogotaDay=()=>new Date(Date.now()-5*3600e3).toISOString().slice(0,10);
ROUTES.oro=async arg=>{if(!logged()){location.hash="#entrar";return}
  if(planRank()<3){app.innerHTML=`<section class="oro-hero locked"><div class="oro-crown">👑</div><span class="eyebrow">Exclusivo Oro y Diamond</span><h1>Sala Oro</h1><p class="muted">La parte privada de El Arte Gráfico para los suscriptores Oro y Diamond.</p>
      <div class="oro-perks"><div><b>💬 Chat privado</b><span>La sala de chat de los traders Oro y Diamond: comparte tus gráficas, pregunta y aprende con los demás.</span></div><div><b>🔴 En vivo privado</b><span>Lives solo para Oro: dudas, análisis y operativa en directo, con la grabación después.</span></div><div><b>📈 Operativas</b><span>Las operaciones que comparto: zona, entrada, stop y cómo terminó.</span></div><div><b>💎 ¿Quieres todo?</b><span>Con Diamond tienes la Sala Oro, todos los cursos y todas las publicaciones exclusivas.</span></div><div><b>🚀 Acceso anticipado</b><span>Los cursos y módulos nuevos, antes que nadie.</span></div></div>
      <div class="row" style="justify-content:center"><a class="btn gold" href="#premium">Ver planes Oro y Diamond</a></div></section>`;return}
  const tabs=`<div class="seg oro-seg"><a class="${arg==="chat"?"":"on"}" href="#oro">🔴 Lives y operativas</a><a class="${arg==="chat"?"on":""}" href="#oro-chat">💬 Chat</a></div>`;
  if(arg==="chat")return roomView(tabs);
  app.innerHTML=`<section class="oro-hero"><div class="oro-crown">👑</div><span class="eyebrow">Oro y Diamond</span><h1>Sala Oro</h1><p class="muted">Lives privados, operativas y el chat de la sala.</p></section>${tabs}
    <section class="sec oro-grid">${false?`<div class="panel wheel-box"><h2>🎡 Ruleta del día</h2><p class="muted" id="whTxt">Un giro gratis cada día. Siempre ganas algo.</p>
      <div class="wheel-wrap"><div class="wheel-ptr">▼</div><svg id="wheel" viewBox="-110 -110 220 220" aria-hidden="true">${WHEEL.map(([t,c],i)=>{const a0=(i*60-90)*Math.PI/180,a1=((i+1)*60-90)*Math.PI/180,am=((i+.5)*60-90)*Math.PI/180;
        return `<path d="M0 0 L${100*Math.cos(a0)} ${100*Math.sin(a0)} A100 100 0 0 1 ${100*Math.cos(a1)} ${100*Math.sin(a1)} Z" fill="${c}" stroke="#d8b062" stroke-width="1.5"/><text x="${62*Math.cos(am)}" y="${62*Math.sin(am)}" fill="#fff" font-size="11" font-weight="800" text-anchor="middle" dominant-baseline="middle" transform="rotate(${i*60+30} ${62*Math.cos(am)} ${62*Math.sin(am)})">${t}</text>`}).join("")}<circle r="16" fill="#d8b062"/><text y="1" font-size="14" text-anchor="middle" dominant-baseline="middle">👑</text></svg></div>
      <button class="btn gold" id="whGo">Girar</button><div id="whMed" class="wh-med"></div></div>`:""}
      <div class="panel"><h2>🔴 En vivo</h2><div id="oroLive" class="muted">Cargando…</div></div></section>
    <section class="sec"><div class="sec-h"><h2>📈 Operativas</h2></div><div id="oroOps" class="posts muted">Cargando…</div></section>
    <section class="sec"><div class="sec-h"><h2>Más de la Sala Oro</h2></div><div id="oroMore" class="posts muted">Cargando…</div></section>`;
  postsVis().then(L=>{const oro=L.filter(p=>p.min_plan==="oro"),cat=c=>p=>String(p.category||"").toLowerCase().includes(c);
    const live=oro.filter(cat("vivo")),ops=oro.filter(cat("operativ")),more=oro.filter(p=>!cat("vivo")(p)&&!cat("operativ")(p));
    $("#oroLive").innerHTML=live.length?live.slice(0,3).map(p=>`<a class="mini" href="#nota-${esc(p.id)}"><span class="dim">${fmtDate(p.created_at)}</span><b>${esc(p.title)}</b></a>`).join(""):'<div class="muted">Aún no hay lives programados. Te avisaremos con una notificación.</div>';
    $("#oroOps").innerHTML=ops.map(postCard).join("")||'<div class="empty">Pronto compartiré aquí mis operativas.</div>';
    $("#oroMore").innerHTML=more.map(postCard).join("")||'<div class="muted">Aún no hay más publicaciones.</div>'}).catch(()=>{});
  return;
  let spins=[];try{spins=API.mySpins?await API.mySpins():[]}catch(e){}
  const med=()=>{const ms=spins.filter(x=>x.prize==="medalla");$("#whMed").innerHTML=ms.length?`<b>Tus medallas de la suerte</b><div class="wh-mlist">${ms.map(x=>{const m=MEDALS[x.label]||["🏅",x.label];return `<span title="${esc(m[1])} · ${fmtDate(x.created_at)}">${m[0]}</span>`}).join("")}</div>`:""};med();
  const today=spins.find(x=>String(x.day).slice(0,10)===bogotaDay());const go=$("#whGo");
  if(today){go.disabled=true;go.textContent="Ya giraste hoy · vuelve mañana";$("#whTxt").textContent="Hoy ganaste: "+(today.prize==="medalla"?(MEDALS[today.label]||["",today.label])[1]:today.label)}
  go.onclick=async()=>{go.disabled=true;let r;try{r=await API.spinRoulette()}catch(x){toast(x.message);go.disabled=false;return}
    const idx=r.prize==="dia"?5:r.prize==="medalla"?2:({50:0,100:1,250:3,500:4})[r.amount]??0;const wh=$("#wheel");const rot=360*6+(360-(idx*60+30));
    wh.style.transition="transform 4.2s cubic-bezier(.12,.75,.1,1)";wh.style.transform=`rotate(${rot}deg)`;
    setTimeout(()=>{if(r.prize==="xp")addXP(Math.floor(r.amount/(planRank()>=2?2:1)));
      const m=MEDALS[r.label];pop({icon:r.prize==="dia"?"spark":r.prize==="medalla"?"star":"up",kicker:"Ruleta Oro",title:r.prize==="medalla"?`${m?m[0]:"🏅"} ${m?m[1]:r.label}`:r.label,text:r.prize==="dia"?"Sumamos un día más a tu suscripción.":r.prize==="medalla"?"Nueva medalla de la suerte para tu colección.":"Sumado a tu nivel.",confetti:true,ms:5000});
      spins.unshift(Object.assign({},r,{created_at:new Date().toISOString()}));med();go.textContent="Ya giraste hoy · vuelve mañana";$("#whTxt").textContent="Vuelve mañana por tu próximo giro."},4300)}};
/* ---------- chat de la Sala Oro ---------- */
async function fitImage(file,max=1600){const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("No se pudo leer la imagen"));i.src=URL.createObjectURL(file)});
  const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement("canvas");c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);return await new Promise(ok=>c.toBlob(b=>ok(b),"image/webp",.8))}
async function roomView(tabs){
  app.innerHTML=`<section class="oro-hero sm"><span class="eyebrow">Oro y Diamond</span><h1>Sala Oro</h1></section>${tabs}
  <section class="room"><details class="room-rules"><summary>📌 Reglas de la sala</summary><ul>
    <li>Respeto ante todo. Nada de insultos, política ni spam.</li><li>Los enlaces no están permitidos (solo El Arte Gráfico puede compartirlos).</li>
    <li><b>Nadie te va a pedir dinero ni manejar tu cuenta.</b> Si alguien lo hace, repórtalo con ⋯ → Reportar.</li>
    <li>Lo que se comparte aquí es educativo: <b>no es asesoría financiera</b> ni señales garantizadas. Cada quien opera bajo su propio riesgo.</li>
    <li>Los mensajes y fotos se borran solos a los 7 días.</li></ul></details>
    <div class="room-log" id="rmLog" aria-live="polite"><div class="muted" style="margin:auto">Cargando…</div></div>
    <div class="room-prev" id="rmPrev" hidden></div>
    <form class="room-in" id="rmF"><label class="room-cam" title="Adjuntar una foto de tu gráfica" aria-label="Adjuntar foto">${ico("image",20)}<input type="file" accept="image/*" id="rmImg" hidden></label>
      <textarea rows="1" maxlength="1000" placeholder="Escribe a la sala…" aria-label="Mensaje"></textarea><button class="btn gold" type="submit">Enviar</button></form></section>`;
  const log=$("#rmLog"),f=$("#rmF"),ta=$("textarea",f),seen=new Map();let last=null,file=null,first=true;
  const hr=t=>new Date(t).toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit"}),dd=t=>new Date(t).toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"});
  const lk=t=>esc(t).replace(/\n/g,"<br>").replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  const one=m=>`<div class="rm${m.mine?" me":""}${m.is_admin?" adm":""}" data-id="${esc(m.id)}" data-day="${esc(dd(m.created_at))}">${avatar(m,36)}<div class="rm-b">
      <div class="rm-h">${uL(m.username)}${flag(m.country||"")}${m.is_admin?'<span class="tag pub">El Arte Gráfico</span>':m.plan?premTag(m.plan):""}${m.affiliate?affTag():""}<span class="dim">${hr(m.created_at)}</span>${m.reports?`<span class="rm-rep" title="Reportes">⚠ ${m.reports}</span>`:""}${m.muted?'<span class="rm-rep">🔇</span>':""}
        <button type="button" class="rm-more" data-m="${esc(m.id)}" aria-label="Opciones del mensaje">⋯</button></div>
      ${m.body?`<div class="rm-t">${m.is_admin?lk(m.body):esc(m.body).replace(/\n/g,"<br>")}</div>`:""}${m.image_url?`<a class="rm-img" href="${esc(m.image_url)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(m.image_url)}" alt="Foto de ${esc(m.username||"")}"></a>`:""}</div></div>`;
  const days=()=>{$$(".rm-day",log).forEach(x=>x.remove());let p="";$$(".rm",log).forEach(el=>{if(el.dataset.day!==p){p=el.dataset.day;el.insertAdjacentHTML("beforebegin",`<div class="rm-day">${esc(p)}</div>`)}})};
  const load=async()=>{let L;try{L=await API.roomFeed(last)}catch(e){if(first)log.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
    const atB=log.scrollHeight-log.scrollTop-log.clientHeight<80;if(first){log.innerHTML=L.length?"":'<div class="room-empty">👋 Aún no hay mensajes. ¡Saluda a la sala!</div>'}
    let add=false;L.forEach(m=>{if(seen.has(m.id))return;seen.set(m.id,m);const e=$(".room-empty",log);if(e)e.remove();log.insertAdjacentHTML("beforeend",one(m));add=true;if(!last||m.created_at>last)last=m.created_at});
    if(add){days();if(atB||first)log.scrollTop=log.scrollHeight}first=false};
  const prune=async()=>{const ids=[...seen.keys()];if(!ids.length)return;try{const a=new Set(await API.roomAlive(ids));ids.forEach(i=>{if(!a.has(i)){seen.delete(i);const el=log.querySelector(`[data-id="${CSS.escape(i)}"]`);if(el)el.remove()}});days()}catch(e){}};
  await load();if(matchMedia("(max-width:860px)").matches){const r=$(".room");if(r)r.scrollIntoView({block:"start"})}
  log.addEventListener("load",e=>{if(e.target.tagName==="IMG"&&log.scrollHeight-log.scrollTop-log.clientHeight<400)log.scrollTop=log.scrollHeight},true);
  const t1=setInterval(()=>{if(!document.hidden)load()},5000),t2=setInterval(()=>{if(!document.hidden)prune()},30000);cleanup.push(()=>{clearInterval(t1);clearInterval(t2);const m=$("#rmMenu");if(m)m.remove()});
  ta.addEventListener("input",()=>{ta.style.height="auto";ta.style.height=Math.min(140,ta.scrollHeight)+"px"});
  ta.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&matchMedia("(pointer:fine)").matches){e.preventDefault();f.requestSubmit()}});
  const prev=()=>{const p=$("#rmPrev");if(!file){p.hidden=true;p.innerHTML="";return}p.hidden=false;p.innerHTML=`<img src="${URL.createObjectURL(file)}" alt=""><span>Foto lista para enviar</span><button type="button" class="btn sm ghost" id="rmX">Quitar</button>`;$("#rmX").onclick=()=>{file=null;prev()}};
  $("#rmImg").onchange=async e=>{const x=e.target.files[0];e.target.value="";if(!x)return;if(!/^image\//.test(x.type)){toast("Solo imágenes");return}try{file=await fitImage(x)}catch(er){toast(er.message);return}prev()};
  f.onsubmit=async e=>{e.preventDefault();const v=ta.value.trim();if(!v&&!file)return;const b=$("button[type=submit]",f);busy(b,true);
    try{let img=null;if(file)img=await API.uploadRoom(file);await API.roomSend(v,img);
      if(admin()&&API.sendPush)API.sendPush({title:"👑 Sala Oro · El Arte Gráfico",body:(v||"📷 Compartió una foto").slice(0,140),url:absUrl("main","oro-chat"),audience:"oro",tag:"sala"}).catch(()=>{});
      ta.value="";ta.style.height="auto";file=null;prev();await load();log.scrollTop=log.scrollHeight}catch(x){toast(x.message)}finally{busy(b,false);ta.focus()}};
  log.addEventListener("click",e=>{const b=e.target.closest(".rm-more");if(!b)return;const id=b.dataset.m,m=seen.get(id);if(!m)return;let mn=$("#rmMenu");if(mn)mn.remove();
    mn=document.createElement("div");mn.id="rmMenu";mn.className="rm-menu";const A=[];
    if(!m.mine)A.push(["rep","🚩 Reportar"]);if(m.mine||admin())A.push(["del","🗑 Borrar mensaje"]);
    if(admin()&&!m.mine&&!m.is_admin)A.push(["m24","🔇 Silenciar 24 horas"],["mall","⛔ Silenciar para siempre"],["m0","🔊 Quitar silencio"]);
    mn.innerHTML=A.map(([k,t])=>`<button type="button" data-a="${k}">${t}</button>`).join("");document.body.appendChild(mn);
    const r=b.getBoundingClientRect();mn.style.top=Math.min(innerHeight-mn.offsetHeight-10,r.bottom+6)+"px";mn.style.left=Math.max(10,Math.min(innerWidth-mn.offsetWidth-10,r.right-mn.offsetWidth))+"px";
    const off=ev=>{if(!mn.contains(ev.target)){mn.remove();document.removeEventListener("pointerdown",off,true)}};setTimeout(()=>document.addEventListener("pointerdown",off,true),0);
    mn.onclick=async ev=>{const a=ev.target.closest("[data-a]");if(!a)return;mn.remove();
      try{if(a.dataset.a==="rep"){await API.roomReport(id);toast("Gracias, lo revisaremos")}
        else if(a.dataset.a==="del"){await API.roomDelete(id);seen.delete(id);const el=log.querySelector(`[data-id="${CSS.escape(id)}"]`);if(el)el.remove();days();toast("Mensaje borrado")}
        else{const h={m24:24,mall:null,m0:0}[a.dataset.a];await API.roomMute(id,h);toast(h===0?"Ya puede escribir de nuevo":h?"Silenciado 24 horas":"Silenciado para siempre")}}catch(x){toast(x.message)}}});
}
/* ranking de puntos (El Arte Gráfico) */
ROUTES.ranking=async per=>{per=per==="total"?"total":"mes";
  const mes=new Date().toLocaleDateString("es-CO",{month:"long",year:"numeric"});
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Retos diarios</span><h1>Ranking</h1><p class="muted">Puntos ganados en los retos. Los primeros 5 de cada reto suman; los afiliados verificados suman el doble.</p></div>
    ${!rewardsOn()&&!admin()?promoBlock():""}
    <div class="seg rk-seg"><a class="${per==="mes"?"on":""}" href="#ranking">Este mes · ${esc(mes)}</a><a class="${per==="total"?"on":""}" href="#ranking-total">Histórico</a></div><div id="rk" class="muted">Cargando…</div>`;
  try{const r=await API.rewardsBoard(per);const yo=r.find(x=>x.is_me);
    const cta=!logged()?`<div class="rk-cta"><div><b>¿Quieres aparecer aquí?</b><span class="muted">Crea tu cuenta gratis y juega el reto del día.</span></div><a class="btn gold" href="#registro">Crear cuenta</a></div>`
      :`<div class="rk-cta"><div><b>${yo?`Vas en el puesto #${r.indexOf(yo)+1} con ${yo.points} puntos`:"Aún no tienes puntos este mes"}</b><span class="muted">Juega el reto de hoy: los primeros 5 en acertar ganan.</span></div><a class="btn gold" href="#retos">Ver retos</a></div>`;
    $("#rk").innerHTML=cta+(r.length?`${podio(r,x=>x.points+" pts"+(RW().ptsPerUsd?` (${ptsUsd(x.points)})`:""))}<div class="scroll"><table class="tbl rk"><thead><tr><th>#</th><th>Participante</th><th class="c-hide" style="text-align:right">Retos ganados</th><th style="text-align:right">Puntos${RW().ptsPerUsd?" (USD)":""}</th></tr></thead><tbody>${r.map((x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,28)}${uL(x.username)}${flag(x.country)}${x.affiliate?affTag():""}${x.premium?premTag():""}</span></td><td class="n c-hide">${x.wins}</td><td class="n">${x.points}${RW().ptsPerUsd?` <span class="rk-usd">(${ptsUsd(x.points)})</span>`:""}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">Todavía no hay puntos en este periodo.</div>')}
  catch(e){$("#rk").textContent="No se pudo cargar el ranking."}};
/* saldo en dólares (retos express): retiro cuando quiera */
async function saldoPanel(ir){const h=$("#sld");if(!h)return;let w=null;try{w=await API.myWallet()}catch(e){return}if(!w||!h.isConnected)return;h.hidden=false;
  const mn=+(w.min_usd||1),pend=(w.retiros||[]).find(x=>x.status==="pendiente"),ES={pendiente:'<span class="pill gold">En camino</span>',pagado:'<span class="pill ok">Pagado</span>',rechazado:'<span class="pill">Rechazado</span>'};
  h.innerHTML=`<div class="sec-h"><h3>💵 Retirar mi saldo</h3><b class="mono" style="font-size:22px;color:var(--ok)">${usdF(w.usd)}</b></div>
    <p class="muted">Lo que ganas en los retos express va directo a tu saldo en dólares. Puedes retirarlo cuando quieras desde ${usdF(mn)}, por Binance (USDT).</p>`+
    (pend?`<div class="note">Tienes un retiro en camino: <b>${usdF(pend.usd)}</b> a ${esc(pend.account)}. Te avisamos por Mensajes cuando lo enviemos.</div>`
    :+w.usd<mn?`<div class="note">${+w.usd>0?`Te faltan ${usdF(mn-w.usd)} para el retiro mínimo.`:"Aún no tienes saldo. Gana un reto express y aparece aquí."}</div>`
    :`<form class="form" id="wf"><div class="two"><label for="wU">Monto (USD)<input id="wU" type="number" min="${mn}" max="${w.usd}" step="0.01" value="${w.usd}"></label>
      <label for="wA">Tu Binance Pay ID o correo de Binance<input id="wA" maxlength="120" required placeholder="Ej.: 123456789"></label></div>
      <button class="btn gold" id="wS">Retirar ahora</button><p class="dim" style="font-size:13px;margin:0">La cuenta de Binance debe ser tuya. Te avisamos por Mensajes cuando te enviemos el pago. Al retirar aceptas las <a href="${toMain("legal-retos")}">bases de los retos</a>.</p></form>`)+
    ((w.retiros||[]).length?`<h4 style="margin:16px 0 8px">Mis retiros</h4><div class="tree">${w.retiros.map(x=>`<div class="item"><span class="txt"><b>${usdF(x.usd)} · ${esc(x.account)}</b><span>${fmtDate(x.created_at)}${x.admin_note?` · ${esc(x.admin_note)}`:""}</span></span>${ES[x.status]||""}</div>`).join("")}</div>`:"");
  const f=$("#wf");if(f)f.onsubmit=async e=>{e.preventDefault();try{busy($("#wS"),true);const v=+$("#wU").value;await API.requestUsdWithdrawal(v,$("#wA").value.trim());
    pop({icon:"coin",kicker:"Retiro enviado",title:`${usdF(v)} en camino`,text:"Te llegó la confirmación en Mensajes. Te avisamos ahí mismo cuando te enviemos el pago.",confetti:true,ms:5200});ROUTES.puntos("saldo")}catch(x){toast(x.message)}finally{const b=$("#wS");if(b)busy(b,false)}};
  if(ir)setTimeout(()=>h.scrollIntoView({behavior:"smooth",block:"start"}),200)}
/* mis puntos: canjes y afiliado */
ROUTES.puntos=async arg=>{if(!logged()){location.hash="#entrar";return}
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Retos</span><h1>Saldo y puntos</h1><p class="muted">Tu saldo en dólares de los retos express, tus puntos, tus canjes y tu verificación de afiliado.</p></div><div id="myPts"></div><section class="panel" id="sld" hidden></section>
    <div class="two pts-two"><section class="panel" id="cnj"><h3>Canjear por dinero</h3><div class="muted">Cargando…</div></section><section class="panel" id="afl"><h3>Afiliado de Deriv</h3><div class="muted">Cargando…</div></section></div>
    <section class="panel" id="hist"><h3>Mis canjes</h3><div class="muted">Cargando…</div></section><section class="sec" id="retoAch"></section>`;
  ptsCard($("#myPts"));let r=null;try{r=await API.myRewards()}catch(e){}if(!r)return;const c=RW(),p=API.profile()||{},rate=Math.max(1,+c.ptsPerUsd||100),mn=+(c.minRedeem??500);
  const pend=(r.redemptions||[]).find(x=>x.status==="pendiente");
  $("#cnj").innerHTML=`<h3>Canjear por dinero</h3><p class="muted">${rate} puntos = 1 USD · mínimo ${mn} puntos · pago por Binance (USDT).</p>`+(!c.redeemOpen?`<div class="note">Los canjes abren una vez al mes. Mientras tanto <b>tus puntos se acumulan</b>; te avisaremos cuando abra la ventana de canje.</div>`
    :pend?`<div class="note">Tienes un canje en revisión: <b>${pend.points} puntos (${ptsUsd(pend.points)})</b>. Te avisamos cuando lo paguemos.</div>`
    :r.balance<mn?`<div class="note">Te faltan <b>${mn-r.balance}</b> puntos para el mínimo de canje.</div>`
    :`<form class="form" id="cf"><div class="two"><label for="cP">Puntos a canjear<input id="cP" type="number" min="${mn}" max="${r.balance}" step="1" value="${r.balance}"></label><label>Recibes<b class="mono" id="cU" style="font-size:22px">${ptsUsd(r.balance)}</b></label></div>
       <label for="cA">Tu Binance Pay ID o correo de Binance<input id="cA" maxlength="120" required placeholder="Ej.: 123456789"></label><button class="btn gold" id="cS">Enviar solicitud de canje</button><p class="dim" style="font-size:13px;margin:0">Revisamos y pagamos los canjes en los días siguientes al cierre del mes. La cuenta de Binance debe ser tuya. Al canjear aceptas las <a href="${toMain("legal-retos")}">bases de los retos</a>.</p></form>`);
  const cf=$("#cf");if(cf){$("#cP").oninput=()=>$("#cU").textContent=ptsUsd(Math.max(0,+$("#cP").value||0));
    cf.onsubmit=async e=>{e.preventDefault();try{busy($("#cS"),true);const _p=+$("#cP").value;await API.requestRedemption(_p,"binance",$("#cA").value.trim());pop({icon:"coin",kicker:"Canje enviado",title:`${_p} puntos → ${ptsUsd(_p)}`,text:"Lo revisamos y te enviamos el pago por Binance. Te avisamos cuando esté pagado.",confetti:true,ms:5200});ROUTES.puntos()}catch(x){toast(x.message)}finally{const b=$("#cS");if(b)busy(b,false)}}}
  const st=r.affiliate;$("#afl").innerHTML=`<h3>Afiliado de Deriv ${p.affiliate?affTag():""}</h3><p class="muted">Si abriste tu cuenta de Deriv con el enlace de El Arte Gráfico, eres afiliado: <b>ganas los puntos completos</b> en cada reto (los demás reciben la mitad) y te sale la etiqueta de afiliado.</p>`+
    (st==="verificado"?`<div class="note ok-note">Verificado · ID de Deriv <b class="mono">${esc(r.deriv_id||"")}</b></div>`
    :st==="pendiente"?`<div class="note">Tu solicitud está en revisión · ID <b class="mono">${esc(r.deriv_id||"")}</b>. Revisamos que estés en nuestra red de socios de Deriv.</div>`
    :`${st==="rechazado"?`<div class="note">No pudimos verificar el ID <b class="mono">${esc(r.deriv_id||"")}</b>${r.affiliate_note?`: ${esc(r.affiliate_note)}`:""}. Revisa y vuelve a enviarlo.</div>`:""}
      <form class="form" id="af"><label for="aD">Tu ID de cliente de Deriv<input id="aD" maxlength="40" required placeholder="Ej.: d-k3skg7d, CR1234567 o 019c0ed8-61dc-…" autocomplete="off"></label><button class="btn gold" id="aS">Enviar para verificar</button>
      <p class="dim" style="font-size:13px;margin:0">Lo encuentras en Deriv, arriba a la derecha (empieza por CR). ¿Aún no tienes cuenta? ${S.site.derivRefUrl?`<a href="${esc(S.site.derivRefUrl)}" target="_blank" rel="noopener sponsored">Ábrela con nuestro enlace</a>.`:"Pide el enlace en la comunidad."}</p></form>${retagGuide()}`);
  const af=$("#af");if(af)af.onsubmit=async e=>{e.preventDefault();try{busy($("#aS"),true);const rr=await API.requestAffiliate($("#aD").value);if(rr&&rr.status==="verificado"){const pf=API.profile();if(pf)pf.affiliate=true;pop({icon:"check",tone:"green",kicker:"¡Verificado al instante!",title:"Ya eres afiliado de El Arte Gráfico",text:"Desde ahora ganas los puntos completos en cada reto y te sale la etiqueta de afiliado.",confetti:true,ms:5200})}else pop({icon:"send",tone:"green",kicker:"Verificación enviada",title:"Revisamos tu ID de Deriv",text:"Cuando te aprobemos ganas los puntos completos y te sale la etiqueta de afiliado."});ROUTES.puntos("afiliado")}catch(x){toast(x.message)}finally{const b=$("#aS");if(b)busy(b,false)}};
  const H=r.redemptions||[];const ES={pendiente:'<span class="pill gold">En revisión</span>',pagado:'<span class="pill ok">Pagado</span>',rechazado:'<span class="pill">Rechazado</span>'};
  $("#hist").innerHTML=`<h3>Mis canjes</h3>`+(H.length?`<div class="tree">${H.map(x=>`<div class="item"><span class="txt"><b>${x.points} puntos · ${ptsUsd(x.points)}</b><span>${fmtDate(x.created_at)}${x.admin_note?` · ${esc(x.admin_note)}`:""}</span></span>${ES[x.status]||""}</div>`).join("")}</div>`:'<div class="muted">Aún no has hecho canjes.</div>');
  saldoPanel(arg==="saldo");
  if(arg==="afiliado")setTimeout(()=>{const a=$("#afl");if(a)a.scrollIntoView({behavior:"smooth",block:"start"})},200);
};
/* =====================================================================
   LOGROS: academia (avance real) y retos (rachas, victorias, semanal)
   ===================================================================== */
const TIER={bronce:["#f0b27a","#a0612a"],plata:["#eef2f8","#8d97ab"],oro:["#f6dc8c","#b8862f"],diamante:["#b8fff0","#22b391"]};
const TIER_N={bronce:"Bronce",plata:"Plata",oro:"Oro",diamante:"Diamante"};
const IC2={flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  fire:'<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.8 1.3 2.8 2.5 3C11 9 11 6 12 3z"/>',shield:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  cap:'<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5"/>',book:'<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9"/>',
  medal:'<circle cx="12" cy="14" r="5.5"/><path d="M8.5 9.5L6 3h4l2 4 2-4h4l-2.5 6.5"/>',user:'<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  pause:'<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  crown:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',star:'<path d="M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6L12 16.9 7.1 19.5l.9-5.6-4-3.9 5.5-.8z"/>',
  bolt:'<path d="M13 3L5 13.5h6L10 21l9-11.5h-6z"/>',coin:'<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.7.8-2.7 2s1.1 1.7 2.7 2c1.7.3 2.9.8 2.9 2.1 0 1.2-1.2 2-2.9 2-1.2 0-2.2-.5-2.8-1.3M12 6.5V8M12 16v1.5"/>',
  grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'};
const ico2=(k,s=22)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC2[k]||IC[k]||""}</svg>`;
/* --- academia --- */
function acadStats(){const g=S.prog||blankProg(),p=API.profile()||{},pr=g.practice||{};
  const tot=S.lindex.length,pas=S.lindex.filter(l=>passedL(l.id)).length;
  const mods=S.modules.filter(m=>S.lindex.some(l=>l.module_id===m.id));const mDone=mods.filter(m=>modProgress(m.id)>=1).length;
  const exam=S.modules.find(m=>/examen/i.test(m.title||""));
  return{tot,pas,mDone,mTot:mods.length,ok:pr.ok||0,n:pr.n||0,best:pr.best||0,streak:Math.max(g.bestStreak||0,g.streak||0),perfil:(p.avatar_url?1:0)+(p.country?1:0),
    exam:exam&&modProgress(exam.id)>=1?1:0,paciencia:(g.ach||[]).includes("paciencia")?1:0}}
const ACAD_ACH=[
  ["Primeros pasos",[["perfil","Tu identidad","Pon tu foto y tu país","user","bronce",s=>s.perfil,2],
    ["leccion1","Primera lección","Aprueba tu primera lección","flag","bronce",s=>s.pas,1],
    ["acierto1","Primer acierto","Acierta tu primer ejercicio en gráfica","target","bronce",s=>s.ok,1]]],
  ["Avance en el temario",[["mod1","Módulo superado","Completa tu primer módulo","book","plata",s=>s.mDone,1],
    ["mod3","Base sólida","Completa 3 módulos","book","oro",s=>s.mDone,3],
    ["mitad","Medio camino","Aprueba la mitad de las lecciones","cap","oro",s=>s.pas,s=>Math.max(1,Math.ceil(s.tot/2))],
    ["todo","Temario completo","Aprueba todas las lecciones","cap","diamante",s=>s.pas,s=>Math.max(1,s.tot)],
    ["examen","Trader certificado","Aprueba el examen final","medal","diamante",s=>s.exam,1]]],
  ["Precisión en la gráfica",[["ok10","Buen ojo","10 ejercicios acertados","target","bronce",s=>s.ok,10],
    ["ok50","Francotirador","50 ejercicios acertados","target","plata",s=>s.ok,50],
    ["ok200","Lectura de maestro","200 ejercicios acertados","target","oro",s=>s.ok,200],
    ["row5","En racha","5 aciertos seguidos","bolt","plata",s=>s.best,5],
    ["row10","Imparable","10 aciertos seguidos","bolt","oro",s=>s.best,10]]],
  ["Constancia y disciplina",[["dias3","Hábito","Estudia 3 días seguidos","cal","bronce",s=>s.streak,3],
    ["dias7","Semana completa","Estudia 7 días seguidos","fire","plata",s=>s.streak,7],
    ["dias30","Disciplina de hierro","Estudia 30 días seguidos","fire","diamante",s=>s.streak,30],
    ["paciencia","Saber esperar","Reconoce una gráfica donde no se opera","pause","plata",s=>s.paciencia,1],
    ["cien","Cien gráficas","Resuelve 100 ejercicios","grid","oro",s=>s.n,100]]]];
/* --- retos --- */
const RETO_ACH=[
  ["Retos diarios",[["r1","A la cancha","Juega tu primer reto","bolt","bronce",r=>r.played,1],
    ["w1","Primera victoria","Gana puntos en un reto","star","bronce",r=>r.wins,1],
    ["pod","Podio","Queda entre los 3 primeros","medal","plata",r=>r.podiums,1],
    ["f1","El más rápido","Queda de primero en un reto","crown","oro",r=>r.firsts,1],
    ["w10","Cazador de puntos","Gana 10 retos","star","oro",r=>r.wins,10],
    ["kinds","Todo terreno","Acierta los 3 tipos de reto","grid","plata",r=>r.kinds,3]]],
  ["Rachas y especiales",[["s7","Racha de 7","Juega 7 días seguidos (+bono)","fire","plata",r=>r.best_streak,7],
    ["s30","Racha de 30","Juega 30 días seguidos","fire","diamante",r=>r.best_streak,30],
    ["wk","Campeón semanal","Gana puntos en un reto semanal","crown","oro",r=>r.weekly_wins,1],
    ["aff","Afiliado","Verifica tu cuenta de Deriv","shield","oro",r=>r.affiliate==="verificado"?1:0,1],
    ["pay","Primer pago","Recibe tu primer canje","coin","diamante",r=>r.paid,1]]]];
function evalAch(cat,src){const out=[];cat.forEach(([g,L])=>L.forEach(([id,t,d,ic,tier,cur,goal])=>{const G=typeof goal==="function"?goal(src):goal,c=Math.min(G,cur(src)||0);out.push({g,id,t,d,ic,tier,cur:c,goal:G,on:c>=G})}));return out}
const medal=(a,sz=64)=>{const [c1,c2]=TIER[a.tier];return `<span class="md${a.on?" on":""}" style="--c1:${c1};--c2:${c2};width:${sz}px;height:${sz}px">${a.on?ico2(a.ic,Math.round(sz*.42)):`<svg viewBox="0 0 24 24" width="${Math.round(sz*.36)}" height="${Math.round(sz*.36)}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>`}</span>`};
const achCard=a=>`<div class="ach${a.on?" on":""} t-${a.tier}">${medal(a)}<div class="ach-t"><b>${esc(a.t)}</b><span>${esc(a.d)}</span>
  ${a.on?`<span class="ach-tier">${TIER_N[a.tier]}</span>`:`<div class="ach-pr"><div class="bar"><i style="width:${Math.round(100*a.cur/a.goal)}%"></i></div><small class="mono">${a.cur}/${a.goal}</small></div>`}</div></div>`;
function achGroups(list){const G={};list.forEach(a=>(G[a.g]=G[a.g]||[]).push(a));return Object.entries(G).map(([g,L])=>`<section class="ach-g"><div class="sec-h"><h3>${esc(g)}</h3><span class="muted">${L.filter(a=>a.on).length} de ${L.length}</span></div><div class="ach-grid">${L.map(achCard).join("")}</div></section>`).join("")}
function achHero(list,title,sub){const on=list.filter(a=>a.on),pct=Math.round(100*on.length/list.length);
  const next=list.filter(a=>!a.on).sort((a,b)=>b.cur/b.goal-a.cur/a.goal)[0];const C=2*Math.PI*52;
  return `<div class="ach-hero"><div class="ach-ring"><svg viewBox="0 0 120 120" width="150" height="150"><circle cx="60" cy="60" r="52" class="rg-bg"/><circle cx="60" cy="60" r="52" class="rg-fg" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-pct/100)}"/></svg><div><b class="mono">${on.length}</b><span>de ${list.length}</span></div></div>
    <div class="ach-hi"><span class="eyebrow">${esc(title)}</span><h1>${esc(sub)}</h1>
      <div class="ach-show">${on.length?on.slice(-8).map(a=>`<span title="${esc(a.t)}">${medal(a,44)}</span>`).join(""):'<span class="muted">Aún no tienes medallas: la primera está muy cerca.</span>'}</div>
      ${next?`<div class="ach-next">${medal(next,40)}<div><small>Próximo logro</small><b>${esc(next.t)}</b><span class="muted">${esc(next.d)} · ${next.cur}/${next.goal}</span></div></div>`:'<div class="ach-next done"><b>¡Tienes todos los logros!</b></div>'}</div></div>`}
/* celebración al desbloquear */
function celebrate(a){popShow(()=>`<div class="ach-pop-c">${medal(Object.assign({},a,{on:true}),72)}<div><small>¡Logro desbloqueado! · ${TIER_N[a.tier]}</small><b>${esc(a.t)}</b><span>${esc(a.d)}</span></div></div>`,4200,a.tier==="oro"||a.tier==="diamante")}
function checkAch(kind,list){const key=`ag_ach_${kind}_${(API.user()||{}).id||"anon"}`;let seen=null;try{seen=JSON.parse(localStorage.getItem(key)||"null")}catch(e){}
  const on=list.filter(a=>a.on).map(a=>a.id);try{localStorage.setItem(key,JSON.stringify(on))}catch(e){}
  if(!seen)return;on.filter(id=>!seen.includes(id)).slice(0,3).forEach((id,i)=>setTimeout(()=>celebrate(list.find(a=>a.id===id)),600+i*50))}
function acadAch(){return evalAch(ACAD_ACH,acadStats())}
/* página de logros (academia) */
ROUTES.logros=()=>{if(!logged()){location.hash="#entrar";return}const L=acadAch();checkAch("acad",L);
  app.innerHTML=`${achHero(L,"Academia · Logros",L.filter(a=>a.on).length?"Tus medallas de trader":"Gana tu primera medalla")}${achGroups(L)}
    ${rewardsOn()?`<section class="ach-g"><div class="rk-cta"><div><b>¿Buscas los logros de los retos diarios?</b><span class="muted">Rachas, victorias y el reto semanal están en Mis puntos.</span></div><a class="btn gold" href="${toMain("puntos")}">Ver logros de retos</a></div></section>`:""}`};
/* tira de logros para el panel */
function achStrip(){const L=acadAch();checkAch("acad",L);const on=L.filter(a=>a.on);const next=L.filter(a=>!a.on).sort((a,b)=>b.cur/b.goal-a.cur/a.goal).slice(0,3);
  return `<section class="sec ach-strip"><div class="sec-h"><div><span class="eyebrow">Logros</span><h2>${on.length} de ${L.length} medallas</h2></div><a href="#logros">Ver todos</a></div>
    <div class="ach-strip-in"><div class="ach-show big">${on.length?on.slice(-6).map(a=>`<span title="${esc(a.t)}">${medal(a,52)}</span>`).join(""):'<span class="muted">Aprueba tu primera lección y gana tu primera medalla.</span>'}</div>
    <div class="ach-nexts">${next.map(a=>`<div class="ach-n">${medal(a,40)}<div><b>${esc(a.t)}</b><div class="ach-pr"><div class="bar"><i style="width:${Math.round(100*a.cur/a.goal)}%"></i></div><small class="mono">${a.cur}/${a.goal}</small></div></div></div>`).join("")}</div></div></section>`}
/* racha de retos */
function streakCard(r){const b=+(RW().streakBonus??50);const s=r.streak||0,left=7-(s%7||0);const days=Array.from({length:7},(_,i)=>i<(s%7||(s?7:0)));
  return `<div class="stk${r.played_today?" ok":""}"><div class="stk-f">${ico2("fire",34)}<b class="mono">${s}</b></div><div class="stk-t"><b>${s?`Racha de ${s} día${s===1?"":"s"}`:"Empieza tu racha hoy"}</b>
    <span class="muted">${r.played_today?"Ya jugaste hoy ✓ Vuelve mañana para no perderla.":"Juega el reto de hoy para "+(s?"mantener":"empezar")+" tu racha."}${b>0?` Cada 7 días seguidos ganas <b>+${b} pts</b> de bono${left<7&&s?` · te faltan ${left}`:""}.`:""}</span>
    <div class="stk-d">${days.map((on,i)=>`<i class="${on?"on":""}">${i+1}</i>`).join("")}</div></div></div>`}
/* ---------- inicio del sitio principal ---------- */
async function mainHome(){
  if(logged()&&API.profile())return memberHome();
  const s=S.site,p=API.profile();
  const dItems=(s.discordItems&&s.discordItems.length?s.discordItems:DISC.items);
  app.innerHTML=`${logged()&&p?`<section class="welcome"><a class="welcome-av" href="#perfil" title="Configuración">${avatar(p,56)}</a><div style="flex:1;min-width:200px"><span class="eyebrow">Tu cuenta</span><h2>Hola, ${esc(p.username)}</h2><p class="muted">${closedAcad()&&!admin()?"Tu cuenta ya quedó creada. La academia abre muy pronto: te avisaremos por aquí y en la comunidad.":premium()?"Tienes acceso premium a toda la academia.":`Cuenta gratis · ${(S.courses||[]).some(c=>c.base)?"tienes el curso Fundamentos del trading completo y ":"tienes "}${Math.max(0,5-(p.demo_used||0))} de 5 gráficas de prueba en la academia.`}</p></div>${closedAcad()&&!admin()?'<span class="pill">Academia: próximamente</span>':`<a class="btn gold" href="${toAcad("inicio")}">Ir a la academia</a>`}</section>`:""}
  <div id="appCard"></div>${launchBox()}
  <section class="hero2"><div id="hero"></div><div class="demo-wrap"><div class="demo-card" id="demo" aria-label="Así se practica en la academia"></div><a class="btn gold try-btn" href="#probar">▶ Pruébalo ahora, sin registrarte</a></div></section>
  <section class="statband" id="stats"></section>
  ${pathBlock()}
  ${promoBlock()}
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
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Opiniones</span><h2>Lo que dicen los alumnos</h2></div><a href="#opiniones">Ver todas</a></div><div id="revs"></div></section>
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Preguntas frecuentes</span><h2>Antes de empezar</h2></div></div><div class="faq" id="faq"></div></section>
  <section class="cta-band" id="premiumBand"></section>`;
  API.slides("home").then(sl=>slider($("#hero"),sl,{emblem:false})).catch(()=>slider($("#hero"),[],{emblem:false}));statsBand();demoChart($("#demo"));aboutBlock($("#about"));temarioBlock($("#tmp"));pricingBlock($("#precios"));faqBlock($("#faq"));appCard($("#appCard"));
  if(s.discordUrl)discordCounts(s.discordUrl).then(d=>{const h=$("#cstats");if(!h||!d||!d.members)return;
    h.querySelectorAll("[data-dc]").forEach(x=>x.remove());/* si el inicio se pinta dos veces, no se duplican */
    h.insertAdjacentHTML("afterbegin",`<div data-dc><b class="mono">${fmtN(d.members)}</b><span>miembros en Discord</span></div>${d.online?`<div data-dc><b class="mono"><i class="live"></i>${fmtN(d.online)}</b><span>conectados ahora</span></div>`:""}`)});
  $("#cards").innerHTML=(s.cards||[]).map((c,i)=>`<div class="card"><span class="k">${String(i+1).padStart(2,"0")}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join("");
  if($("#mkts"))$("#mkts").innerHTML=marketsHTML(s.markets||[],true);
  {const pb=$("#premiumBand");if(premium())pb.remove();else if(logged())pb.innerHTML=premiumBand();
    else pb.innerHTML=`<div class="pb final"><div><span class="eyebrow">Empieza hoy</span><h2>${(S.courses||[]).some(c=>c.base)?"Crea tu cuenta y aprende trading gratis":"Crea tu cuenta gratis y prueba el método"}</h2><p class="muted" style="max-width:60ch;margin-top:8px">${(S.courses||[]).some(c=>c.base)?`Con tu cuenta tienes el curso <b>${esc((S.courses||[]).filter(c=>c.base).map(c=>c.title).join(" y "))}</b> completo, 5 gráficas de prueba y el reto del día. Cuando quieras la estrategia para un mercado, como Boom y Crash, la compras o la tienes con un plan. Sin tarjeta y sin compromiso.`:"Tienes 5 gráficas de prueba para marcar tu zona, poner tu stop loss y ver la repetición, y puedes jugar el reto del día desde ya. Sin tarjeta y sin compromiso."}</p></div><div class="row"><a class="btn ghost" href="${toMain("probar")}">Probar una gráfica ahora</a><a class="btn gold" href="#registro">Crear cuenta gratis</a><a class="btn ghost" href="#entrar">Ya tengo cuenta</a></div></div>`}
  API.publicReviews().then(r=>{if($("#revs"))$("#revs").innerHTML=reviewsHTML(r.slice(0,3),true)}).catch(()=>{});
  postsVis().then(p=>{if($("#newsMini"))$("#newsMini").innerHTML=p.slice(0,4).map(x=>`<a class="mini" href="#nota-${esc(x.id)}"><span class="dim">${fmtDate(x.created_at)} · ${esc(x.category||"Noticia")}</span><b>${esc(x.title)}</b></a>`).join("")||'<div class="muted">Pronto publicaremos noticias y actualizaciones.</div>'}).catch(()=>{if($("#newsMini"))$("#newsMini").innerHTML='<div class="muted">Sin publicaciones por ahora.</div>'});
}

/* ---------- panel de la academia ---------- */
function trialNext(){for(const m of S.modules.filter(x=>x.free&&modOpen(x))){const ls=S.lindex.filter(l=>l.module_id===m.id).sort((a,b)=>(a.sort||0)-(b.sort||0));for(const l of ls){if(!(S.prog.done[l.id]&&S.prog.done[l.id].passed))return l}}return null}
function trialCard(){const d=trialLeft(),ms=S.modules.filter(x=>x.free&&modOpen(x));if(!ms.length)return"";const ls=S.lindex.filter(l=>ms.some(m=>m.id===l.module_id)),ok=ls.filter(l=>S.prog.done[l.id]&&S.prog.done[l.id].passed).length;
  return `<section class="trial-card"><div class="tc-ic">🎁</div><div class="tc-t"><span class="eyebrow">Prueba gratis · ${d===1?"último día":`te quedan ${d} días`}</span><h3>${ms.map(m=>esc(m.title)).join(" · ")}</h3><p class="muted">Tienes acceso completo a ${ms.length>1?"estos módulos":"este módulo"}: videos, ejercicios y medallas. Llevas ${ok} de ${ls.length} lecciones.</p>
    <div class="bar"><i style="width:${ls.length?Math.round(100*ok/ls.length):0}%"></i></div></div><div class="tc-a"><a class="btn gold" href="${(trialNext()?"#leccion-"+esc(trialNext().id):"#modulo-"+esc(ms[0].id))}">${ok?"Seguir":"Empezar"}</a><a class="btn ghost sm" href="${toMain("premium")}">Ver planes</a></div></section>`}
function nextLesson(){for(const m of S.modules){if(!modOpen(m)||m.optional||!canMod(m))continue;const ls=S.lindex.filter(l=>l.module_id===m.id).sort((a,b)=>(a.sort||0)-(b.sort||0));for(const l of ls){if(!(S.prog.done[l.id]&&S.prog.done[l.id].passed))return l}}return null}
async function academyHome(){
  const p=API.profile()||{},g=S.prog,lv=levelOf(g.xp);const pct=lv.to?Math.round(100*(g.xp-lv.from)/(lv.to-lv.from)):100;const own=premium()||ownedCourses().length>0,tri=inTrial(),nx=own?nextLesson():tri?trialNext():null;
  const passed=Object.values(g.done).filter(d=>d.passed).length,total=S.lindex.length;
  const prem=premium(),apct=total?Math.round(100*passed/total):0,acc=g.practice.n?Math.round(100*g.practice.ok/g.practice.n):0,demo=Math.max(0,5-(p.demo_used||0));
  const tiles=[["acad","Temario",`${passed} de ${total} lecciones`,"#academia"],["chart","Práctica",prem?"Gráficas ilimitadas":`${demo} gráficas de prueba`,prem?"#practica":"#prueba"],
    ["medal","Logros",`${acadAch().filter(a=>a.on).length} de ${acadAch().length} medallas`,"#logros"],["layers","Progreso",'<span id="mhPos">Ver mi puesto</span>',"#progreso"],["news","Comunidad","Novedades y avisos",toMain("comunidad")],["gear","Configuración","Perfil, app y notificaciones","#perfil"]];
  app.innerHTML=`${certCta()}<section class="mh">
    <div class="mh-bg" aria-hidden="true"></div>
    <div class="mh-id"><a class="mh-av" href="#perfil" title="Configuración">${avatar(p,84)}<span class="lvchip" title="${esc(lv.name)}">${lv.i+1}</span></a>
      <div class="mh-t"><span class="eyebrow">${saludo()} · Academia</span><h1>${esc(p.username||"")} ${flag(p.country||"")}</h1>
        <div class="mh-chips">${prem?premTag(myPlan()):myCourseTags()||'<span class="tag">Cuenta gratis</span>'}${p.affiliate?affTag():""}<span class="tag">${esc(lv.name)}</span></div></div></div>
    <div class="mh-cta">${own?(nx?`<a class="btn gold btn-ic" href="#leccion-${esc(nx.id)}">${ico("play",18)}<span>Continuar: ${esc(nx.title)}</span></a>`:'<a class="btn gold" href="#practica">Ir a práctica</a>'):`${tri&&nx?`<a class="btn gold btn-ic" href="#leccion-${esc(nx.id)}">${ico("play",18)}<span>Clase gratis: ${esc(nx.title)}</span></a>`:`<a class="btn gold" href="#prueba">Probar gratis (${demo} de 5)</a>`}<a class="btn ghost" href="${toMain("premium")}">Hazte premium</a>`}</div>
    <div class="mh-bars">
      <div><div class="mh-bl"><span>Lecciones aprobadas: ${passed}${total?` de ${total}`:""}</span><b class="mono">${apct}%</b></div><div class="bar"><i style="width:${apct}%"></i></div></div>
      <div><div class="mh-bl"><span>${lv.to?`Nivel ${lv.i+2} en ${lv.to-g.xp} pts`:"Nivel máximo"}</span><b class="mono">${pct}%</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>
    </div>
    <div class="mh-mini"><span><b class="mono">${g.practice.n}</b> ejercicios</span><span><b class="mono">${acc}%</b> aciertos</span><span><b class="mono">${g.streak||0}</b> días seguidos</span></div>
  </section>
  ${tri?trialCard():""}
  <section class="mh-tiles">${tiles.map(([k,t,d,h])=>`<a class="mt" href="${esc(h)}"><span class="mt-i">${ico2(k)}</span><b>${t}</b><span class="dim">${d}</span></a>`).join("")}</section>
  ${premium()?(m=>m?fbCard(m):"")(S.modules.find(needFb)):""}
  <div id="appCard"></div>
  ${achStrip()}
  ${premium()?"":`<section class="sec" id="prueba"><div class="sec-h"><div><span class="eyebrow">Prueba gratis</span><h2>Tus gráficas de prueba</h2></div><span class="muted" id="demoLeft"></span></div><div id="demoBox"></div></section>`}
  <section class="sec"><div class="sec-h"><div><span class="eyebrow">Temario</span><h2>Ruta de aprendizaje</h2></div><a href="#academia">Ver temario completo</a></div><div id="syl"></div></section>
  ${premium()?`<section class="sec"><div class="two"><div class="panel"><h3>Práctica libre</h3><p class="muted">Ejercicios sueltos para entrenar el ojo antes de cada lección.</p><div class="row"><a class="btn" href="#practica">Practicar ahora</a></div></div><div class="panel"><div class="sec-h"><h3>Tabla de progreso</h3><a href="#progreso">Ver completa</a></div><div id="rkMini" class="muted">Cargando…</div></div></div></section>`:`<section class="sec"><div class="panel"><div class="sec-h"><h3>Tabla de progreso</h3><a href="#progreso">Ver completa</a></div><div id="rkMini" class="muted">Cargando…</div></div></section><section class="cta-band">${premiumBand()}</section>`}`;
  syllabus($("#syl"),premium()?0:6);if(!premium())demoSection();appCard($("#appCard"));
  API.progressBoard().then(r=>{const k=r.findIndex(x=>x.is_me);if($("#mhPos"))$("#mhPos").textContent=k>=0?`Vas en el puesto #${k+1}`:"Aprueba una lección";if(!$("#rkMini"))return;$("#rkMini").innerHTML=r.length?`<table class="tbl rk">${r.slice(0,5).map((x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,24)}${uL(x.username)}${flag(x.country)}</span></td><td class="n">${x.lessons} lecc.</td></tr>`).join("")}</table>`:'<div class="muted">Aún no hay alumnos en la tabla.</div>'}).catch(()=>{});
}
function marketsHTML(list,compact){const g={};list.forEach(m=>{(g[m.cat]=g[m.cat]||[]).push(m)});
  return Object.entries(g).map(([cat,ms])=>`<div class="mkcat"><h3>${esc(cat)}</h3><div class="mklist">${ms.map(m=>`<div class="mk ${m.status==="Disponible"?"on":""}"><div><b>${esc(m.name)}</b>${compact?"":`<p class="muted">${esc(m.text||"")}</p>`}</div><span class="tag ${m.status==="Disponible"?"pub":""}">${esc(m.status)}</span></div>`).join("")}</div></div>`).join("")||'<div class="empty">Sin mercados configurados.</div>'}
function premiumBand(){const s=S.site;return `<div class="pb"><div><span class="eyebrow">Premium</span><h2>${esc(s.premiumTitle||"Hazte premium")}</h2><p class="muted" style="max-width:60ch;margin-top:8px">${esc(s.premiumText||"")}</p></div>
  <ul class="checks">${(s.premiumItems||[]).map(i=>`<li>${esc(i)}</li>`).join("")}</ul><div class="row">${premium()?'<span class="pill ok">Ya eres premium</span><a class="btn" href="${toAcad("inicio")}">Ir a la academia</a>':`<a class="btn gold" href="#premium">Ver cómo acceder</a>${logged()?"":'<a class="btn ghost" href="#registro">Crear cuenta gratis</a>'}`}</div></div>`}
async function syllabus(host,limit){
  const [mods,idx]=[S.modules,S.lindex];if(!host)return;
  if(!mods.length){host.innerHTML='<div class="empty">El temario se publicará pronto.</div>';return}
  let n=0;
  const modCard=(m,cat)=>{if(limit&&n>=limit)return"";n++;const ls=idx.filter(l=>l.module_id===m.id);const pr=modProgress(m.id,ls);
    const op=modOpen(m,true);
    return `<a class="mod ${op?"":"soon-mod"}" href="#modulo-${esc(m.id)}"><span class="num">${esc(m.level||cat)}</span><h3>${esc(m.title)}</h3><p>${esc(m.descr||"")}</p>
      <div class="meta"><span>${ls.length} ${ls.length===1?"lección":"lecciones"}</span>${m.optional?'<span class="tag pub">Opcional</span>':""}${m.free&&!premium()&&trialDays()&&!isBase(m.course_id)?'<span class="tag free-t">Prueba gratis</span>':""}${op?"":`<span class="tag lock">${esc(modState(m))}</span>`}${premium()||!op?"":isBase(m.course_id)?'<span class="tag free-t">Gratis</span>':canMod(m)?"":'<span class="tag">Premium</span>'}${m.status!=="publicado"?'<span class="tag">Borrador</span>':""}</div>${premium()||(logged()&&canMod(m))?`<div class="bar"><i style="width:${Math.round(pr*100)}%"></i></div>`:""}</a>`};
  const cats=ms=>{const g={};ms.forEach(m=>{const c=m.category||"Módulos";(g[c]=g[c]||[]).push(m)});
    return Object.entries(g).map(([cat,list])=>{if(limit&&n>=limit)return"";const h=list.map(m=>modCard(m,cat)).join("");return h?`<div class="syl-cat"><h3 class="cat">${esc(cat)}</h3><div class="grid">${h}</div></div>`:""}).join("")};
  const cs=(S.courses||[]).filter(c=>c.status!=="borrador"||admin()).slice().sort((a,b)=>(a.sort||0)-(b.sort||0));
  if(!cs.length){host.innerHTML=cats(mods);return}
  const access=c=>{if(c.base)return `<span class="tag free-t">Gratis${logged()?" · ya es tuyo":" · solo con tu cuenta"}</span>`;
    if(premium()||ownsCourse(c.id))return '<span class="tag pub">Tienes acceso</span>';
    return `<span class="tag sc-lock">🔒 Con plan Cobre, Plata, Oro o Diamond${c.price?` · o el curso por ${esc(c.price)}`:""}</span>`};
  const known=new Set(cs.map(c=>c.id));
  let k=0;const blocks=cs.map(c=>{const ms=mods.filter(m=>m.course_id===c.id);if(limit&&(n>=limit||!ms.length))return"";k++;
    const body=ms.length?cats(ms):`<div class="empty">Los módulos de este curso se están grabando y se publicarán pronto${c.base?"":". Con un plan o con el curso los tendrás apenas salgan"}.</div>`;
    const cta=c.base||premium()||ownsCourse(c.id)?"":`<a class="btn sm gold" href="${toMain("premium")}">Ver planes</a>`;
    return `<section class="syl-course${c.base?" base":""}" style="--cc:${esc(c.color||"#d8b062")}"><div class="sc-h"><span class="sc-i">${esc(c.icon||"🎓")}</span><div class="sc-t"><span class="eyebrow">Curso ${k}${c.base?" · empieza aquí":""}</span><h2>${esc(c.title)}</h2>${c.descr?`<p class="muted">${esc(c.descr)}</p>`:""}<div class="sc-a">${access(c)}${cta}</div></div></div>${body}</section>`}).join("");
  const orphans=mods.filter(m=>!m.course_id||!known.has(m.course_id));
  const titles=new Set(cs.map(c=>c.title.trim().toLowerCase()));
  const soon=limit?[]:(S.site.markets||[]).filter(m=>!/disponible/i.test(m.status||"")&&!titles.has(String(m.name||"").trim().toLowerCase()));
  host.innerHTML=blocks+(orphans.length?`<section class="syl-course"><div class="sc-h"><span class="sc-i">📦</span><div class="sc-t"><h2>Otros módulos</h2></div></div>${cats(orphans)}</section>`:"")
    +(soon.length?`<section class="syl-course upc"><div class="sc-h"><span class="sc-i">⏳</span><div class="sc-t"><span class="eyebrow">Próximos cursos</span><h2>Más mercados en camino</h2><p class="muted">Cada mercado tendrá su curso de estrategia. Con un plan los tendrás todos apenas salgan.</p></div></div><div class="sc-soon">${soon.map(m=>`<span class="path-c soon">${esc(m.name)}${m.cat?` · ${esc(m.cat)}`:""}</span>`).join("")}</div></section>`:"")}
function modProgress(mid,ls){ls=ls||S.lindex.filter(l=>l.module_id===mid);if(!ls.length||!S.prog)return 0;return ls.filter(l=>S.prog.done[l.id]&&S.prog.done[l.id].passed).length/ls.length}
/* reproducir enlaces .m3u8 (Bunny "playlist.m3u8") también en Chrome/Android con hls.js */
let hlsP=null;
function hlsAttach(v){const u=v.dataset.hls;if(!u||v.__hls)return;v.__hls=1;
  if(v.canPlayType("application/vnd.apple.mpegurl")){v.src=u;return}
  hlsP=hlsP||new Promise((ok,no)=>{if(window.Hls)return ok(window.Hls);const sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js";sc.onload=()=>ok(window.Hls);sc.onerror=no;document.head.appendChild(sc)});
  hlsP.then(H=>{if(!H||!H.isSupported()){v.src=u;return}const h=new H({capLevelToPlayerSize:true});h.loadSource(u);h.attachMedia(v);cleanup.push(()=>{try{h.destroy()}catch(e){}})}).catch(()=>{v.src=u})}
function hlsInit(root){(root||document).querySelectorAll("video[data-hls]").forEach(hlsAttach)}
/* video de una publicación: Bunny, YouTube, Vimeo o archivo .mp4/.webm/.mov */
function mediaVideo(u,poster){u=String(u||"").trim();if(!/^https:\/\//.test(u))return"";
  const yt=u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/),vm=u.match(/vimeo\.com\/(?:video\/)?(\d+)/),bn=u.match(/(?:iframe|player)\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([\w-]+)/);
  const fr=src=>`<div class="pvid"><iframe src="${esc(src)}" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Video"></iframe></div>`;
  if(bn)return fr(`https://iframe.mediadelivery.net/embed/${bn[1]}/${bn[2]}?autoplay=false&preload=false&responsive=true`);
  if(yt)return fr(`https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`);
  if(vm)return fr(`https://player.vimeo.com/video/${vm[1]}`);
  if(/\.m3u8(\?|$)/i.test(u)){const th=/b-cdn\.net\/[\w-]+\/playlist\.m3u8/.test(u)?u.replace(/playlist\.m3u8.*$/,"thumbnail.jpg"):"";return `<div class="pvid"><video controls playsinline preload="metadata" poster="${esc(poster||th)}" data-hls="${esc(u)}"></video></div>`}
  if(/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u))return `<div class="pvid"><video controls playsinline preload="metadata"${poster?` poster="${esc(poster)}"`:""} src="${esc(u)}"></video></div>`;
  return ""}

/* texto plano para resúmenes: sin #, *, guiones de lista ni enlaces en markdown */
const plainText=t=>String(t||"").replace(/!?\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm,"").replace(/[*_`>]{1,3}/g,"").replace(/\n{2,}/g,"\n").trim();
const postCard=p=>`<a class="post${p.image_url||p.video_url?"":" noimg"}" href="#nota-${esc(p.id)}">${p.image_url?`<div class="thumb" style="background-image:url('${esc(p.image_url)}')">${p.video_url?'<span class="vplay" aria-label="Video">▶</span>':""}</div>`:p.video_url?'<div class="thumb vthumb"><span class="vplay" aria-label="Video">▶</span></div>':""}<div style="display:grid;gap:6px;align-content:start;min-width:0"><div class="row"><span class="tag">${esc(p.category||"Noticia")}</span>${p.pinned?'<span class="tag pub">Fijado</span>':""}${p.min_plan==="oro"?'<span class="tag t-oro">👑 Sala Oro</span>':p.min_plan==="plata"?'<span class="tag t-plata">Plata y Oro</span>':p.premium_only?'<span class="tag">Suscriptores</span>':""}<span class="dim" style="font-size:13px">${fmtDate(p.created_at)}</span></div><h3>${esc(p.title)}</h3><p class="muted clamp">${esc(plainText(p.body).slice(0,220))}</p></div></a>`;
function reviewsHTML(list,compact){if(!list.length)return `<div class="empty">Todavía no hay opiniones publicadas.${logged()?'<a class="btn sm" href="#opiniones">Escribir la primera</a>':""}</div>`;
  return `<div class="revs ${compact?"compact":""}">${list.map(r=>`<figure class="rev"><div class="stars" aria-label="${r.rating} de 5">${stars(r.rating)}</div><blockquote>${esc(r.body||"")}</blockquote><figcaption>${avatar(r,30)}<b>${uL(r.username)}</b>${r.premium?'<span class="tag pub">Premium</span>':""}<span class="dim">${fmtDate(r.created_at)}</span></figcaption></figure>`).join("")}</div>`}

/* ---------- prueba gratis ---------- */
async function demoSection(){
  const box=$("#demoBox");if(!box)return;
  if(!logged()){box.innerHTML=`<div class="panel demo-cta"><div><h3>5 gráficas de prueba gratis</h3><p class="muted">Crea tu cuenta y practica con gráficas reales: marca la zona, pon tu stop loss y mira la repetición.</p></div><div class="row"><a class="btn gold" href="#registro">Crear cuenta gratis</a><a class="btn ghost" href="#entrar">Ya tengo cuenta</a></div></div>`;return}
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
  const head=`<div style="display:grid;gap:6px"><img src="assets/logo_mark.webp" alt="" style="width:56px;height:56px"><h2>${mode==="up"?"Crea tu cuenta":mode==="in"?(back?"Ingresa para entrar a la academia":"Ingresa a tu cuenta"):"Recupera tu contraseña"}</h2><p class="muted">${mode==="up"?"Gratis. Una sola cuenta para la comunidad y la academia, con 5 gráficas de prueba.":mode==="in"?"Una sola cuenta para El Arte Gráfico y la academia.":"Te enviaremos un enlace a tu correo."}</p></div>`;
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
        await afterLogin();pop({icon:"spark",kicker:"Cuenta creada",title:"¡Bienvenido a El Arte Gráfico!",text:"Tienes 5 gráficas de prueba gratis y el reto del día esperándote.",confetti:true,ms:5200});done();
      }else if(mode==="in"){await API.signIn({email,password:$("#uP").value,captcha:cap&&cap.token()});await afterLogin();toast("Bienvenido");done();}
      else{await API.recover(email,cap&&cap.token());box.innerHTML=head+`<div class="okmsg">Si existe una cuenta con ese correo, te llegará un enlace para crear una contraseña nueva.</div><a class="btn" href="#entrar">Volver</a>`}
    }catch(x){err.textContent=x.message||"No se pudo completar.";cap&&cap.reset()}finally{busy(go,false)}};
}
ROUTES.nueva=()=>{app.innerHTML=`<div class="authbox" style="max-width:480px;margin:0 auto"><h2>Crea tu contraseña nueva</h2><form class="form" id="f"><label for="nP">Contraseña nueva<input id="nP" type="password" minlength="8" required autocomplete="new-password"></label><label for="nP2">Repítela<input id="nP2" type="password" required autocomplete="new-password"></label><div class="err" id="err"></div><button class="btn gold" id="go">Guardar</button></form></div>`;
  $("#f").onsubmit=async e=>{e.preventDefault();const a=$("#nP").value,b=$("#nP2").value;if(a.length<8||!/[0-9]/.test(a)||!/[a-zA-Z]/.test(a))return $("#err").textContent="Mínimo 8 caracteres, con letras y números.";if(a!==b)return $("#err").textContent="No coinciden.";
    try{await API.updatePassword(a);toast("Contraseña actualizada");location.hash="#inicio"}catch(x){$("#err").textContent=x.message}}};
async function afterLogin(){await API.loadProfile();await loadProg();await loadContent();renderNav()}

/* ---------- mercados / premium ---------- */
ROUTES.mercados=()=>{app.innerHTML=`<div class="pagehead"><span class="eyebrow">Mercados</span><h1>Un método, varios mercados</h1><p class="muted">La base es la misma para todos: el curso <b>Fundamentos del trading</b>, gratis con tu cuenta. Encima va la estrategia de cada mercado: empezamos con Boom y Crash, y después llegan Step Index, Volatility, Forex y metales.</p></div><div class="mkts big">${marketsHTML(S.site.markets||[],false)}</div>`};
ROUTES.premium=()=>{const s=S.site;const plans=(s.plans||[]).filter(x=>x&&x.name);const off=!!s.paymentsOff;const bin=!off&&!!(s.binancePayId&&(plans.length||(S.courses||[]).length));const pf=API.profile()||{};
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Premium</span><h1>${esc(s.premiumTitle||"Hazte premium")}</h1><p class="muted">${esc(s.premiumText||"")}</p></div>
  ${premium()?`<div class="note ok-note">Eres suscriptor ${(TIERS[myPlan()]||{n:"premium"}).n}${pf.premium_until&&new Date(pf.premium_until).getFullYear()<2090?` hasta el <b>${fmtDate(pf.premium_until)}</b>`:""}. Si pagas otro plan, los días se suman a los que te quedan.</div>`:""}
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
      <div class="two"><label for="pP">Qué pagaste<select id="pP">${plans.map((x,i)=>`<option value="p:${i}">${(TIERS[tierOfPlan(x)]||{}).n||""} · ${esc(x.name)} · ${esc(x.price)}</option>`).join("")}${(S.courses||[]).filter(c=>c.status!=="borrador"&&!c.base&&!ownsCourse(c.id)).map(c=>`<option value="c:${esc(c.id)}">Curso ${esc(c.title)} · ${esc(c.price||"40 USD")} · de por vida</option>`).join("")}</select></label>
      <label for="pO">ID de orden de Binance<input id="pO" inputmode="numeric" autocomplete="off" placeholder="Ej.: 382947561029384756" maxlength="80"></label></div>
      <label for="pN">Nota (opcional)<input id="pN" maxlength="300" placeholder="Ej.: pagué desde la cuenta de mi hermano"></label>
      <div class="err" id="pE" role="alert"></div><div class="row"><button class="btn gold" id="pB">Registrar pago</button></div></form>
      ${mine.length?`<h3>Mis pagos</h3><div class="list">${mine.map(r=>`<div class="item"><span class="txt"><b>${esc(r.plan)} · ${esc(r.amount)}</b><span>ID ${esc(r.order_id)} · ${fmtDT(r.created_at)}${r.status==="rechazado"&&r.admin_note?` · ${esc(r.admin_note)}`:""}</span></span>${estado[r.status]||""}</div>`).join("")}</div>`:""}`;
    $("#pf").onsubmit=async e=>{e.preventDefault();const pv=$("#pP").value||"p:0";const crs=pv.startsWith("c:")?(S.courses||[]).find(c=>c.id===pv.slice(2)):null;const pl=crs?{name:"Curso "+crs.title,days:30,price:crs.price||"40 USD"}:(plans[+pv.slice(2)]||plans[0]);const oid=$("#pO").value.replace(/\s+/g,"");
      if(!/^[A-Za-z0-9-]{4,80}$/.test(oid)){$("#pE").textContent="Escribe el ID de orden tal como sale en Binance (solo números y letras).";return}
      try{busy($("#pB"),true);await API.payRequest({plan:pl.name,days:pl.days,amount:pl.price,order_id:oid,note:$("#pN").value.trim(),course_id:crs?crs.id:null});pop({icon:"coin",kicker:"Pago registrado",title:"Estamos confirmando tu pago",text:"Te avisamos apenas lo activemos. Tu pago quedó en Mensajes: si se demora, escríbenos por ahí."});draw()}
      catch(x){$("#pE").textContent=/duplicate|unique|ya fue registrado/i.test(x.message)?"Ese ID de orden ya fue registrado.":x.message}finally{const b=$("#pB");if(b)busy(b,false)}}};
  draw()};

/* ---------- academia ---------- */
ROUTES.academia=()=>{app.innerHTML=`<div class="pagehead"><span class="eyebrow">Academia</span><h1>Temario</h1><p class="muted">Avanza en orden: cada lección se aprueba con sus ejercicios y cada módulo se desbloquea al terminar el anterior.</p>${premium()?"":`<div class="note">${(S.courses||[]).some(c=>c.base)?`El curso <b>${esc((S.courses||[]).filter(c=>c.base).map(c=>c.title).join(" y "))}</b> es gratis y completo ${logged()?"con tu cuenta":`creando tu cuenta`}. El resto del temario es para alumnos con plan o con el curso.`:"Puedes ver el temario completo. Las lecciones y los ejercicios son para alumnos premium."} <a href="${logged()?"#premium":toMain("registro")}">${logged()?"Ver cómo acceder":"Crear cuenta gratis"}</a></div>`}</div><div id="syl"></div>`;syllabus($("#syl"))};
ROUTES.modulo=id=>{const m=S.modules.find(x=>x.id===id);if(!m){app.innerHTML=`<div class="empty">Ese módulo no existe.<a class="btn sm" href="#academia">Ver temario</a></div>`;return}
  const ok=canMod(m),trial=!premium()&&ok;const ls=S.lindex.filter(l=>l.module_id===id);const prev=prevReq(m);const closedM=!modOpen(m);const locked=closedM||(ok&&modLocked(m));
  app.innerHTML=`<div class="crumbs"><a href="#academia">Temario</a><span>/</span><span>${esc(m.category||"")}</span></div><div class="pagehead"><span class="eyebrow">${esc(m.level||m.category||"Módulo")}</span><h1>${esc(m.title)}</h1><p class="muted">${esc(m.descr||"")}</p>${ok?`<div class="bar" style="max-width:420px"><i style="width:${Math.round(modProgress(id)*100)}%"></i></div>`:""}</div>
  ${closedM?`<div class="note">${m.open_at?`Este módulo se habilita el <b>${esc(new Date(m.open_at).toLocaleString("es-CO",{day:"2-digit",month:"long",hour:"2-digit",minute:"2-digit"}))}</b>.`:"Este módulo se habilitará pronto. Te avisaremos en la comunidad."}</div>`:locked?(prev&&needFb(prev)?`<div class="note">Para abrir este módulo, deja tu reseña de “${esc(prev.title)}”. <a href="#resena-${esc(prev.id)}">Dejar mi reseña</a></div>`:`<div class="note">Este módulo se desbloquea al aprobar todas las lecciones de “${esc(prev.title)}”.</div>`):""}
  ${trial?`<div class="note trial-note">🎁 <b>Prueba gratis:</b> este módulo es tuyo durante ${trialLeft()===1?"el último día":`${trialLeft()} días más`}. Después, sigue con premium. <a href="#premium">Ver planes</a></div>`:!ok&&inTrial()?`<div class="note">Este módulo es para alumnos premium. Tu prueba gratis incluye ${S.modules.filter(x=>x.free).map(x=>`“${esc(x.title)}”`).join(", ")||"el módulo de introducción"}.</div>`:""}
  ${ok&&needFb(m)?fbCard(m):""}
  ${admin()&&m.ask_feedback!==false?`<div class="note admin-note">Vista de admin: a ti no te pide reseña. Los alumnos, al terminar este módulo, deben dejarla para abrir el siguiente. <a href="#resena-${esc(m.id)}">Ver el formulario como alumno</a></div>`:""}
  ${m.optional&&!closedM?`<div class="note">Módulo opcional: ${esc(m.optional_note||"si ya lo dominas, puedes saltarlo. No es necesario para abrir los módulos siguientes.")}</div>`:""}
  ${admin()&&!modOpen(m,true)?'<div class="note admin-note">Bloqueado para alumnos: solo tú lo ves abierto.</div>':""}
  <div class="list">${ls.map((l,k)=>{const d=S.prog&&S.prog.done[l.id];const cerrada=ok&&!locked&&!closedM&&!lessonOpen(l);return `<a class="item${cerrada?" lock":""}" href="${ok&&!locked&&!cerrada?"#leccion-"+esc(l.id):closedM||cerrada||locked&&ok?"#modulo-"+esc(m.id):"#premium"}"><span class="ico ${d&&d.passed?"done":""}">${d&&d.passed?"✓":cerrada?"🔒":k+1}</span><span class="txt"><b>${esc(l.title)}</b><span>${cerrada?`Aprueba la lección anterior con ${(ls[k-1]&&ls[k-1].min_score)||80}% para abrirla`:`${l.has_video?"Video · ":""}${d?`Mejor resultado ${d.best}%`:"Pendiente"}`}</span></span>${ok?"":'<span class="tag">Premium</span>'}</a>`}).join("")||'<div class="empty">Este módulo todavía no tiene lecciones.</div>'}</div>`};
ROUTES.leccion=async id=>{
  if(!logged()){location.hash="#entrar";return}
  {const li0=S.lindex.find(x=>x.id===id),m0=li0&&S.modules.find(x=>x.id===li0.module_id);if(!premium()&&!(m0&&canMod(m0))){app.innerHTML=paywall();return}}
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
  if(!exs.length){sec.innerHTML=`<div class="note">Esta lección no tiene ejercicios.</div><div><button class="btn gold" id="seen">Marcar como completada</button></div>`;$("#seen").onclick=()=>{passLesson(l,100);if(needFb(m))sec.insertAdjacentHTML("beforeend",fbCard(m))};return}
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
  if(passed&&!prev.passed){pop({icon:"check",tone:"green",kicker:"Lección aprobada · +30 pts",title:l.title||"Lección",text:sc>=100&&!(l.min_score)?"¡Vas muy bien! Sigue con la próxima.":`Sacaste ${sc}%. Ya puedes seguir con la próxima lección.`});ach("leccion");
    const mdone=modProgress(l.module_id)>=1;if(mdone){const mm=(S.modules||[]).find(x=>x.id===l.module_id);pop({icon:"trophy",kicker:"¡Módulo terminado! · +60 pts",title:(mm&&mm.title)||"Módulo completo",text:mm&&needFb(mm)?"Déjanos tu reseña para abrir el siguiente módulo.":"Ya tienes abierto el siguiente módulo.",confetti:true,ms:5200})}
    addXP(30);if(mdone){ach("modulo");addXP(60)}}else saveProg()}
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
    try{busy($("#fbS"),true);await API.sendFeedback({module_id:id,rating:r,liked,improve});S.fb.add(id);pop({icon:"star",kicker:"¡Gracias por tu reseña!",title:"Siguiente módulo desbloqueado",text:"Tu opinión nos ayuda a mejorar cada lección."});location.hash=sig?"#modulo-"+sig.id:"#academia"}
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
    const move=()=>{wm.style.left=(8+Math.random()*58)+"%";wm.style.top=(8+Math.random()*74)+"%"};move();const mv=setInterval(move,8000);cleanup.push(()=>clearInterval(mv));
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
  if(/\.(mp4|webm|m3u8)(\?|$)/i.test(u)||u.includes("/storage/v1/object/")){const isH=/\.m3u8(\?|$)/i.test(u);host.innerHTML=shell(`<video controls preload="metadata" playsinline ${isH?`data-hls="${esc(u)}"`:`src="${esc(u)}"`} controlslist="nodownload noplaybackrate nofullscreen" disablepictureinpicture oncontextmenu="return false"></video>`);mountExtras();hlsInit(host);
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
  try{const p=await postsVis();$("#pl").innerHTML=p.map(postCard).join("")||'<div class="empty">Todavía no hay publicaciones.</div>'}catch(e){$("#pl").innerHTML='<div class="empty">No se pudieron cargar las noticias.</div>'}};
ROUTES.nota=async id=>{app.innerHTML='<div class="muted">Cargando…</div>';let p=null;try{p=await API.post(id)}catch(e){}
  if(p&&!canSeePost(p))p=null;if(!p){app.innerHTML=`<div class="empty">Esta publicación no existe o es solo para suscriptores.<a class="btn sm" href="#comunidad">Ver publicaciones</a></div>`;return}
  app.innerHTML=`<div class="crumbs"><a href="#comunidad">Comunidad</a><span>/</span><span>${esc(p.category||"Noticia")}</span></div>
   <article class="article"><div class="pagehead"><span class="eyebrow">${esc(p.category||"Noticia")} · ${fmtDate(p.created_at)}</span><h1>${esc(p.title)}</h1></div>${p.video_url&&mediaVideo(p.video_url,p.image_url)?mediaVideo(p.video_url,p.image_url):p.image_url?`<div class="cover" style="background-image:url('${esc(p.image_url)}')"></div>`:""}<div class="prose">${md(p.body)}</div></article>
   <section class="sec"><h2>Comentarios</h2><div id="cl" class="list"></div><div id="cf"></div></section>`;hlsInit(app);
  const load=async()=>{if(!logged()){$("#cl").innerHTML=`<div class="note"><a href="#entrar">Ingresa</a> para ver y escribir comentarios.</div>`;return}
    let cs=[];try{cs=await API.comments(id)}catch(e){}
    $("#cl").innerHTML=cs.map(c=>`<div class="comment"><div class="who">${avatar(c,30)}<b>${uL(c.username)}</b>${c.is_admin?'<span class="tag pub">El Arte Gráfico</span>':""}<span class="dim">${fmtDT(c.created_at)}</span>${c.mine||admin()?`<button class="btn sm ghost" data-del="${esc(c.id)}" style="margin-left:auto">Borrar</button>`:""}</div><div>${md(c.body)}</div></div>`).join("")||'<div class="muted">Sé el primero en comentar.</div>';
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
  $("#rf").onsubmit=async e=>{e.preventDefault();if(!rating)return toast("Elige de 1 a 5 estrellas");try{busy($("#rg"),true);await API.saveReview(rating,$("#rb").value.trim());pop({icon:"star",kicker:"¡Gracias por tu opinión!",title:"Quedó en revisión",text:"La publicamos apenas la revisemos."});ROUTES.opiniones()}catch(x){toast(x.message)}finally{busy($("#rg"),false)}};
};
ROUTES.progreso=async()=>{app.innerHTML=`<div class="pagehead"><span class="eyebrow">Academia</span><h1>Tabla de progreso</h1><p class="muted">Quién va más adelante en el temario, por lecciones aprobadas. Aquí no hay puntos: solo avance.</p></div><div id="rk" class="muted">Cargando…</div>`;
  try{const r=await API.progressBoard();const yo=r.find(x=>x.is_me);const tot=S.lindex.length;
    const cta=yo?`<div class="rk-cta"><div><b>Vas en el puesto #${r.indexOf(yo)+1} con ${yo.lessons} lecciones aprobadas</b><span class="muted">Sigue con tu siguiente lección para subir en la tabla.</span></div><a class="btn gold" href="#inicio">Continuar</a></div>`:"";
    $("#rk").innerHTML=cta+(r.length?`${podio(r,x=>x.lessons+" lecciones")}<div class="scroll"><table class="tbl rk"><thead><tr><th>#</th><th>Alumno</th><th class="c-hide">Avance</th><th style="text-align:right">Lecciones</th></tr></thead><tbody>${r.map((x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,28)}${uL(x.username)}${flag(x.country)}${x.affiliate?affTag():""}${x.premium?premTag():""}</span></td><td class="c-hide"><div class="bar" style="min-width:120px"><i style="width:${tot?Math.round(100*x.lessons/tot):0}%"></i></div></td><td class="n">${x.lessons}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">Aún no hay alumnos en la tabla.</div>')}
  catch(e){$("#rk").textContent="No se pudo cargar la tabla."}};
const rkRow=(x,i)=>`<tr class="${x.is_me?"me ":""}${x.premium?"prem":""}"><td class="mono">${i<3?["🥇","🥈","🥉"][i]:i+1}</td><td><span class="who-cell">${avatar(x,28)}${uL(x.username)}${flag(x.country)}${x.premium?premTag():""}</span></td><td class="c-hide">${esc(levelOf(x.xp).name)}</td><td class="n c-hide">${x.lessons}</td><td class="n">${x.xp}</td></tr>`;
const podio=(r,val=x=>x.xp+" pts")=>r.length<3?"":`<div class="podio">${[1,0,2].map(i=>{const x=r[i];return `<div class="pod p${i+1}${x.premium?" prem":""}"><div class="pav">${avatar(x,i?64:84)}</div><b>${uL(x.username)} ${flag(x.country)}</b><span class="pod-tags">${x.affiliate?affTag():""}${x.premium?premTag():'<span class="dim" style="font-size:13px">Gratis</span>'}</span><span class="mono">${esc(val(x))}</span><div class="step">${i+1}</div></div>`}).join("")}</div>`;
ROUTES.perfil=arg=>{if(!logged()){location.hash="#entrar";return}setTimeout(async()=>{const h=$("#myCerts");if(!h||!API.myCertificates)return;let L=[];try{L=await API.myCertificates()}catch(e){}h.innerHTML=(L.length?`<div class="panel cert-list"><h3>🎓 Mis certificados</h3>${L.map(c=>`<a class="item" href="${toMain("certificado-"+c.code)}"><span class="txt"><b>${esc(c.course_title)}</b><span class="mono dim">${esc(c.code)} · ${fmtDate(c.issued_at)}</span></span><span class="pill gold">Ver</span></a>`).join("")}</div>`:"")+certCta()},400);setTimeout(()=>{const t={progreso:"cfgProg",app:"cfgApp",seguridad:"cfgSeg"}[arg];if(t&&$("#"+t))$("#"+t).scrollIntoView({behavior:"smooth",block:"start"})},150);const p=API.profile()||{},g=S.prog,lv=levelOf(g.xp);const pct=lv.to?Math.round(100*(g.xp-lv.from)/(lv.to-lv.from)):100;
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
    <section class="sec" id="cfgProg"><h2>Mi progreso</h2><div id="myCerts"></div>
    <div class="lvl"><div class="medal">${lv.i+1}</div><div style="display:grid;gap:8px;min-width:0"><h2>${esc(lv.name)}</h2><div class="bar"><i style="width:${pct}%"></i></div><div class="muted mono">${g.xp} pts${lv.to?` · faltan ${lv.to-g.xp} para el siguiente nivel`:""}</div></div></div>
    <div class="kv" style="margin-top:14px"><div><b>${Object.values(g.done).filter(d=>d.passed).length}</b><span>lecciones aprobadas</span></div><div><b>${g.practice.n}</b><span>ejercicios resueltos</span></div><div><b>${g.practice.n?Math.round(100*g.practice.ok/g.practice.n):0}%</b><span>aciertos</span></div><div><b>${g.streak||0}</b><span>días seguidos</span></div></div></section>
    <section class="sec"><div class="sec-h"><h2>Logros</h2><a href="${toAcad("logros")}">Ver todos</a></div>${(L=>`<div class="ach-show big">${L.filter(a=>a.on).map(a=>`<span title="${esc(a.t)}">${medal(a,48)}</span>`).join("")||'<span class="muted">Aún no tienes medallas.</span>'}</div><p class="muted">${L.filter(a=>a.on).length} de ${L.length} logros de la academia.</p>`)(acadAch())}</section>
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
/* el panel de administración se descarga solo cuando se abre */
let admLoad=null;
ROUTES.admin=async sub=>{if(viewAs()){setViewAs("");viewBar();renderNav()}if(!admin()){location.hash="#inicio";return}app.innerHTML='<div class="muted">Cargando administración…</div>';
  admLoad=admLoad||new Promise((ok,no)=>{const sc=document.createElement("script");sc.src="js/admin.js?v=1";sc.onload=ok;sc.onerror=no;document.body.appendChild(sc)});
  try{await admLoad}catch(e){app.innerHTML='<div class="empty">No se pudo cargar la administración. Revisa tu conexión y recarga.</div>';return}
  if(ROUTES.admin.__lazy){app.innerHTML='<div class="empty">No se pudo cargar la administración.</div>';return}ROUTES.admin(sub)};
ROUTES.admin.__lazy=true;
window.AGAPP={uL,showProfile,TIERS,chatBox,dmPoll,pop,mediaVideo,hlsInit,ico,avatar,affTag,absUrl,enablePush,flag,premTag,legalText,modOpen,modState,SITE,ACAD,link,toAcad,toMain,S,API,$,$$,esc,md,toast,busy,fmtT,fmtDate,fmtDT,TZ,MARKETS,MNAME,h1Bars,m5Bars,idxAt,avgRange,toC,Chart,cleanupPush:f=>cleanup.push(f),route,ROUTES,app,premium,admin,logged,confirmInline,loadContent:()=>loadContent(),renderFoot:()=>renderFoot(),applySite:()=>applySite()};

/* ---------- arranque ---------- */
async function loadContent(){const [m,l,c,mc]=await Promise.all([API.modules().catch(()=>[]),API.lessonIndex().catch(()=>[]),(API.courses?API.courses():Promise.resolve([])).catch(()=>[]),(API.myCourses&&logged()?API.myCourses():Promise.resolve([])).catch(()=>[])]);S.modules=m||[];S.lindex=l||[];S.courses=c||[];S.myCourses=new Set((mc||[]).map(x=>x.course_id||x))}
function applySite(){const s=S.site,n=s.name||"El Arte Gráfico";$("#brandName").textContent=n.toUpperCase();if(s.logoUrl)$("#logoMark").src=s.logoUrl;
  $("#brandSub").textContent=ACAD?"ACADEMY":"TRADING · COMUNIDAD";document.body.dataset.site=SITE;
  document.title=ACAD?n+" Academy":n+" · Trading, educación y comunidad";renderFoot();analytics()}
/* Google Analytics: solo si hay ID y la persona acepta las cookies de estadística */
let gaOn=false;
function gaLoad(id){if(gaOn)return;gaOn=true;window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("js",new Date());gtag("config",id,{anonymize_ip:true,page_path:location.pathname+location.hash.replace("#","/")});
  const sc=document.createElement("script");sc.async=true;sc.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(id);document.head.appendChild(sc);
  window.addEventListener("hashchange",()=>{try{gtag("event","page_view",{page_path:location.pathname+location.hash.replace("#","/"),page_title:document.title})}catch(e){}})}
function analytics(){const id=(S.site||{}).gaId;if(!id||!/^G-[A-Z0-9]+$/.test(id)||API.mode==="local")return;let c=null;try{c=localStorage.getItem("ag_cookies")}catch(e){}
  if(c==="si"){gaLoad(id);return}if(c==="no"||$("#ckBar"))return;
  const b=document.createElement("div");b.id="ckBar";b.className="ck-bar";b.setAttribute("role","dialog");b.setAttribute("aria-label","Cookies de estadística");
  b.innerHTML=`<div><b>¿Nos ayudas a mejorar?</b><span>Usamos Google Analytics para saber qué partes de la página se usan más. Solo se activa si aceptas. <a href="${toMain("legal-cookies")}">Más información</a></span></div><div class="row"><button class="btn sm ghost" data-ck="no">No, gracias</button><button class="btn sm gold" data-ck="si">Aceptar</button></div>`;
  document.body.appendChild(b);$$("[data-ck]",b).forEach(x=>x.onclick=()=>{try{localStorage.setItem("ag_cookies",x.dataset.ck)}catch(e){}b.remove();if(x.dataset.ck==="si")gaLoad(id)})}
/* ---------- app instalable + notificaciones ---------- */
const PWA={evt:null,reg:null};
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const pushSupported=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();PWA.evt=e;document.querySelectorAll("[data-install]").forEach(b=>b.hidden=false)});
window.addEventListener("appinstalled",()=>{PWA.evt=null;pop({icon:"spark",kicker:"App instalada",title:"Ya la tienes en tu pantalla de inicio",text:"Ábrela desde ahí como cualquier app."})});
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
    await API.savePushSub(sub,navigator.userAgent);pop({icon:"bell",tone:"green",kicker:"Notificaciones activadas",title:"Te avisamos primero",text:"Cada reto nuevo y cada módulo nuevo te llegan al celular."});return true}catch(e){toast(e.message||"No se pudieron activar");return false}}
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
  {const h=location.hostname,ok=h==="elartegrafico.com"||/\.elartegrafico\.com$/.test(h)||h==="localhost"||h==="127.0.0.1"||h===""||(/\.vercel\.app$/.test(h)&&/elartegrafico|flawyapp/.test(h));
   if(!ok){document.body.innerHTML=`<div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;font-family:system-ui;background:#060b1a;color:#fff"><div><h1 style="font-size:24px">Copia no autorizada</h1><p style="color:#a9b4d2">Esta página es una copia de El Arte Gráfico. La original está en <a style="color:#f3d88f" href="https://elartegrafico.com">elartegrafico.com</a>.</p></div></div>`;return}}
  if("serviceWorker" in navigator&&location.protocol!=="file:"){navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(r=>{PWA.reg=r;try{r.update()}catch(e){}}).catch(()=>{});
    /* app instalada: al volver a abrirla busca la versión nueva y, si llegó, recarga sola (una vez) para que nadie se quede con la vieja */
    const hadCtl=!!navigator.serviceWorker.controller;let reloaded=false;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!hadCtl||reloaded)return;const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return;reloaded=true;location.reload()});
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&PWA.reg)try{PWA.reg.update()}catch(e){}})}
  if(API.mode==="local")$("#localbar").innerHTML=`<div class="localbar"><div class="wrap"><b>Modo de prueba</b><span>Los datos se guardan solo en este navegador. Administrador de prueba: admin@elartegrafico.com · admin1234</span><button id="rstLocal">Reiniciar datos de prueba</button></div></div>`;
  const r=$("#rstLocal");if(r)r.onclick=()=>API.resetLocal();
  const pSite=API.site().catch(()=>({}));                     // los ajustes del sitio no dependen de la sesión
  let rec=false;try{rec=(await API.init()).recovery}catch(e){}
  S.site=await pSite||{};S.site.plans=expandPlans(S.site.plans,S.site.planDisc);
  /* Diamond siempre es de por vida, aunque en Admin hayan quedado otros días */
  applySite();
  await Promise.all([loadProg(),loadContent()]);S.loaded=true;
  if(rec)location.hash="#nueva-clave";
  route();
}
window.AGBOOT=boot;window.AGPOP=(o)=>pop(o);window.AGTOAST=(m,t)=>toast(m,t);
})();
