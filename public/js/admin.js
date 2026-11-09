/* El Arte Gráfico Academy — panel de administración. */
(function(){
"use strict";
const A=window.AGAPP;const {$,$$,esc,API,S,toast,busy,fmtT,fmtDate,fmtDT,TZ,MARKETS,MNAME,h1Bars,m5Bars,idxAt,avgRange,toC,Chart,app}=A;
let tab="resumen";
const TABS=[["resumen","Estadísticas"],["sitio","Sitio y textos"],["banners","Banners"],["contenido","Módulos y lecciones"],["ejercicios","Ejercicios"],["noticias","Noticias"],["opiniones","Opiniones"],["alumnos","Alumnos"],["archivos","Archivos"]];
A.ROUTES.admin=sub=>{
  if(!A.admin()){app.innerHTML=`<div class="empty">Esta sección es solo para administradores.<a class="btn sm" href="#inicio">Volver</a></div>`;return}
  if(sub&&TABS.some(t=>t[0]===sub))tab=sub;
  app.innerHTML=`<div class="pagehead"><span class="eyebrow">Administración</span><h1>Panel de control</h1></div>
    <div class="tabs" role="tablist">${TABS.map(([k,t])=>`<button role="tab" aria-selected="${tab===k}" class="${tab===k?"on":""}" data-t="${k}">${t}</button>`).join("")}</div><div id="adm"></div>`;
  $$("[data-t]").forEach(b=>b.onclick=()=>{location.hash="#admin-"+b.dataset.t});
  ({resumen,sitio,banners,contenido,ejercicios,noticias,opiniones,alumnos,archivos})[tab]();
};
const H=()=>$("#adm");
const fileBtn=(id,label="Subir imagen")=>`<label class="btn sm" for="${id}" style="cursor:pointer">${label}</label><input id="${id}" type="file" hidden accept="image/*">`;
function bindUpload(id,onUrl){const i=$("#"+id);if(!i)return;i.onchange=async e=>{const f=e.target.files[0];if(!f)return;toast("Subiendo…");try{const u=await API.upload(f);onUrl(u);toast("Archivo subido")}catch(x){toast(x.message)}}}

/* ---------- estadísticas ---------- */
async function resumen(){
  H().innerHTML='<div class="muted">Cargando estadísticas…</div>';
  let s;try{s=await API.adminStats()}catch(e){H().innerHTML=`<div class="empty">No se pudieron cargar las estadísticas: ${esc(e.message)}</div>`;return}
  const k=[[s.users,"Usuarios registrados"],[s.premium,"Premium activos"],[s.new7,"Nuevos (7 días)"],[s.new30,"Nuevos (30 días)"],[s.visitors30,"Visitantes únicos (30 días)"],[s.views30,"Páginas vistas (30 días)"],[s.watch_hours,"Horas de video vistas"],[s.exercises_done,"Ejercicios resueltos"],[s.demo_done,"Gráficas de prueba usadas"],[s.rating!=null?(+s.rating).toFixed(2)+" / 5":"—","Calificación promedio"],[s.reviews,"Opiniones recibidas"],[s.comments,"Comentarios en comunidad"]];
  const daily=s.daily||[];const mx=Math.max(1,...daily.map(d=>d.views));const W=760,Hh=180,bw=W/Math.max(daily.length,1);
  H().innerHTML=`<div class="kv statk">${k.map(([v,t])=>`<div><b>${esc(v??0)}</b><span>${t}</span></div>`).join("")}</div>
    ${s.reviews_pending?`<div class="note">Tienes ${s.reviews_pending} ${s.reviews_pending===1?"opinión":"opiniones"} esperando aprobación. <a href="#admin-opiniones">Revisar</a></div>`:""}
    <div class="panel"><div class="sec-h"><h3>Visitas por día (últimos 30 días)</h3><span class="muted" style="font-size:13px"><span class="lg v"></span> páginas vistas <span class="lg u"></span> visitantes <span class="lg s"></span> registros</span></div>
      <div class="scroll" style="border:0;background:none"><svg viewBox="0 0 ${W} ${Hh+26}" style="width:100%;min-width:520px;height:auto" role="img" aria-label="Visitas por día">
      ${[0,.5,1].map(f=>`<line x1="0" x2="${W}" y1="${Hh-f*Hh+.5}" y2="${Hh-f*Hh+.5}" stroke="#1f3266"/><text x="2" y="${Hh-f*Hh-3}" fill="#64739a" font-size="10">${Math.round(mx*f)}</text>`).join("")}
      ${daily.map((d,i)=>{const h=d.views/mx*Hh,hu=d.visitors/mx*Hh;return `<rect x="${i*bw+2}" y="${Hh-h}" width="${bw-4}" height="${h}" fill="#2b4282"><title>${d.d}: ${d.views} vistas, ${d.visitors} visitantes, ${d.signups} registros</title></rect><rect x="${i*bw+bw*.3}" y="${Hh-hu}" width="${bw*.4}" height="${hu}" fill="#d8b062"/>${d.signups?`<circle cx="${i*bw+bw/2}" cy="${Hh-h-7}" r="3.5" fill="#35c4a2"/>`:""}${i%5===0?`<text x="${i*bw+bw/2}" y="${Hh+16}" fill="#64739a" font-size="10" text-anchor="middle">${String(d.d).slice(5)}</text>`:""}`}).join("")}</svg></div></div>
    <div class="two"><div class="panel"><h3>Páginas más visitadas (30 días)</h3>${(s.pages||[]).length?`<table class="tbl">${s.pages.map(p=>`<tr><td>${esc(p.path)}</td><td class="n">${p.n}</td></tr>`).join("")}</table>`:'<div class="muted">Sin datos todavía.</div>'}</div>
      <div class="panel"><h3>Lecciones con más horas vistas</h3>${(s.top_lessons||[]).length?`<table class="tbl">${s.top_lessons.map(p=>`<tr><td>${esc(p.title)}</td><td class="n">${p.hours} h</td></tr>`).join("")}</table>`:'<div class="muted">Sin datos todavía.</div>'}</div></div>`;
}

/* ---------- sitio ---------- */
function sitio(){
  const s=JSON.parse(JSON.stringify(S.site||{}));const lines=(a,f)=>(a||[]).map(f).join("\n");
  H().innerHTML=`<form class="panel form" id="fs">
    <h3>Marca</h3><div class="two"><label for="sN">Nombre<input id="sN" value="${esc(s.name||"")}"></label><label for="sG">Lema<input id="sG" value="${esc(s.tagline||"")}"></label></div>
    <div class="two"><div class="row">${fileBtn("upLogo","Subir logo (icono)")}<span class="muted" id="lgN" style="font-size:13px">${s.logoUrl?"Logo personalizado":"Logo por defecto"}</span></div><div class="row">${fileBtn("upLogoF","Subir logo grande")}<span class="muted" id="lgF" style="font-size:13px">${s.logoFullUrl?"Logo grande personalizado":"Logo grande por defecto"}</span></div></div>
    <h3>Portada</h3><label for="sH">Título<input id="sH" value="${esc(s.heroTitle||"")}"></label><label for="sT">Texto<textarea id="sT" style="min-height:70px">${esc(s.heroText||"")}</textarea></label>
    <label for="sC">Tarjetas “Qué vas a aprender” (una por línea: Título | texto)<textarea id="sC">${esc(lines(s.cards,c=>c.title+" | "+c.text))}</textarea></label>
    <label for="sS">Pasos “Cómo se aprende” (una por línea: Título | texto)<textarea id="sS" style="min-height:90px">${esc(lines(s.steps,c=>c.title+" | "+c.text))}</textarea></label>
    <label for="sM">Mercados (una por línea: Categoría | Nombre | Estado | descripción). Estado: Disponible o Próximamente<textarea id="sM">${esc(lines(s.markets,m=>[m.cat,m.name,m.status,m.text||""].join(" | ")))}</textarea></label>
    <h3>Premium</h3><div class="two"><label for="sPT">Título<input id="sPT" value="${esc(s.premiumTitle||"")}"></label><label for="sPX">Texto<input id="sPX" value="${esc(s.premiumText||"")}"></label></div>
    <label for="sPI">Beneficios (uno por línea)<textarea id="sPI" style="min-height:90px">${esc((s.premiumItems||[]).join("\n"))}</textarea></label>
    <h3>Contacto y pie de página</h3><label for="sCo">Contacto (WhatsApp, correo…)<input id="sCo" value="${esc(s.contact||"")}"></label>
    <label for="sSo">Redes (una por línea: Nombre | enlace)<textarea id="sSo" style="min-height:80px" placeholder="Instagram | https://instagram.com/...">${esc(s.social||"")}</textarea></label>
    <label for="sL">Aviso legal<textarea id="sL" style="min-height:80px">${esc(s.legal||"")}</textarea></label>
    <div class="row"><button class="btn gold" id="sv">Guardar cambios</button></div></form>`;
  bindUpload("upLogo",u=>{s.logoUrl=u;$("#lgN").textContent="Logo subido: guarda los cambios"});
  bindUpload("upLogoF",u=>{s.logoFullUrl=u;$("#lgF").textContent="Logo subido: guarda los cambios"});
  const pairs=v=>v.split("\n").map(l=>l.split("|").map(x=>x.trim())).filter(p=>p[0]);
  $("#fs").onsubmit=async e=>{e.preventDefault();
    Object.assign(s,{name:$("#sN").value.trim(),tagline:$("#sG").value.trim(),heroTitle:$("#sH").value.trim(),heroText:$("#sT").value.trim(),
      cards:pairs($("#sC").value).map(p=>({title:p[0],text:p[1]||""})),steps:pairs($("#sS").value).map(p=>({title:p[0],text:p[1]||""})),
      markets:pairs($("#sM").value).map(p=>({cat:p[0],name:p[1]||"",status:p[2]||"Próximamente",text:p[3]||""})),
      premiumTitle:$("#sPT").value.trim(),premiumText:$("#sPX").value.trim(),premiumItems:$("#sPI").value.split("\n").map(x=>x.trim()).filter(Boolean),
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
async function contenido(){
  let mods=[],les=[];try{mods=await API.modules();les=await API.lessons()}catch(e){}
  H().innerHTML=`<div class="split"><div class="panel"><div class="sec-h"><h3>Temario</h3><button class="btn sm gold" id="nm">Nuevo módulo</button></div>
    <div class="tree">${mods.map(m=>`<div class="m"><button data-s="m:${esc(m.id)}" class="${sel.id===m.id?"on":""}"><b>${esc(m.title)}</b><span class="tag ${m.status==="publicado"?"pub":""}">${m.status==="publicado"?"Publicado":"Borrador"}</span></button>
      <div class="dim" style="padding:0 12px 6px;font-size:12px">${esc(m.category||"")}</div>
      ${les.filter(l=>l.module_id===m.id).sort((a,b)=>a.sort-b.sort).map(l=>`<button class="l ${sel.id===l.id?"on":""}" data-s="l:${esc(l.id)}"><span>${esc(l.title)}</span><span class="tag ${l.status==="publicado"?"pub":""}">${l.status==="publicado"?"Pub.":"Borr."}</span></button>`).join("")}
      <button class="l" data-nl="${esc(m.id)}" style="color:var(--gold)">+ Nueva lección</button></div>`).join("")||'<div class="muted">Aún no hay módulos.</div>'}</div></div><div class="panel" id="ed"><div class="muted">Elige un módulo o una lección para editarla.</div></div></div>`;
  const cats=[...new Set(mods.map(m=>m.category).concat(["Fundamentos","Método El Arte Gráfico","Gestión y psicología","Sintéticos","Forex","Metales","Evaluación"]))].filter(Boolean);
  const reload=async()=>{await A.loadContent();contenido()};
  $("#nm").onclick=async()=>{try{const m=await API.saveModule({title:"Nuevo módulo",descr:"",level:"",category:"Fundamentos",sort:(mods.length?Math.max(...mods.map(x=>x.sort||0)):0)+1,status:"borrador",locked:true});sel={t:"m",id:m.id};reload()}catch(x){toast(x.message)}};
  $$("[data-nl]").forEach(b=>b.onclick=async()=>{const mid=b.dataset.nl;const ls=les.filter(l=>l.module_id===mid);try{const l=await API.saveLesson({module_id:mid,title:"Nueva lección",sort:(ls.length?Math.max(...ls.map(x=>x.sort||0)):0)+1,status:"borrador",video_url:"",body:"",min_score:80});sel={t:"l",id:l.id};reload()}catch(x){toast(x.message)}});
  $$("[data-s]").forEach(b=>b.onclick=()=>{const [t,id]=b.dataset.s.split(":");sel={t,id};contenido()});
  const ed=$("#ed");
  if(sel.t==="m"){const m=mods.find(x=>x.id===sel.id);if(!m)return;
    ed.innerHTML=`<form class="form" id="fm"><div class="sec-h"><h3>Módulo</h3><a class="btn sm ghost" href="#modulo-${esc(m.id)}">Ver como alumno</a></div>
      <label for="mT">Título<input id="mT" value="${esc(m.title)}"></label><label for="mD">Descripción<textarea id="mD" style="min-height:80px">${esc(m.descr||"")}</textarea></label>
      <div class="three"><label for="mC">Categoría<input id="mC" list="cats" value="${esc(m.category||"")}"><datalist id="cats">${cats.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></label><label for="mL">Nivel (opcional)<input id="mL" value="${esc(m.level||"")}" placeholder="Básico, Intermedio…"></label><label for="mO">Orden<input id="mO" type="number" value="${m.sort||1}"></label></div>
      <div class="two"><label for="mS">Estado<select id="mS"><option value="borrador">Borrador (no lo ven los alumnos)</option><option value="publicado">Publicado</option></select></label><label for="mK">Bloqueo<select id="mK"><option value="1">Se abre al terminar el módulo anterior</option><option value="0">Siempre abierto</option></select></label></div>
      <div class="row"><button class="btn gold" id="ms">Guardar módulo</button><span id="md"><button type="button" class="btn sm bad" id="mdb">Eliminar módulo</button></span></div></form>`;
    $("#mS").value=m.status;$("#mK").value=m.locked?"1":"0";
    $("#fm").onsubmit=async e=>{e.preventDefault();try{busy($("#ms"),true);await API.saveModule({id:m.id,title:$("#mT").value.trim()||"Sin título",descr:$("#mD").value.trim(),category:$("#mC").value.trim()||"Fundamentos",level:$("#mL").value.trim(),sort:+$("#mO").value||1,status:$("#mS").value,locked:$("#mK").value==="1"});toast("Módulo guardado");reload()}catch(x){toast(x.message)}finally{busy($("#ms"),false)}};
    $("#mdb").onclick=()=>A.confirmInline($("#md"),"¿Eliminar el módulo con todas sus lecciones y ejercicios?",async()=>{await API.delModule(m.id);sel={};toast("Módulo eliminado");reload()})}
  if(sel.t==="l"){const l=les.find(x=>x.id===sel.id);if(!l)return;
    ed.innerHTML=`<form class="form" id="fl"><div class="sec-h"><h3>Lección</h3><a class="btn sm ghost" href="#leccion-${esc(l.id)}">Ver como alumno</a></div>
      <label for="lT">Título<input id="lT" value="${esc(l.title)}"></label>
      <div class="three"><label for="lM">Módulo<select id="lM">${mods.map(m=>`<option value="${esc(m.id)}">${esc(m.title)}</option>`).join("")}</select></label><label for="lO">Orden<input id="lO" type="number" value="${l.sort||1}"></label><label for="lS">Estado<select id="lS"><option value="borrador">Borrador</option><option value="publicado">Publicado</option></select></label></div>
      <label for="lV">Video (enlace de YouTube, Vimeo o archivo MP4)<input id="lV" value="${esc(l.video_url||"")}" placeholder="https://youtu.be/…"></label>
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
let exFilter="",exSel=null;
async function ejercicios(){
  let list=[],les=[];try{list=await API.allExercises();les=await API.lessons()}catch(e){}
  const lname=id=>id==null?"Práctica libre":(les.find(l=>l.id===id)||{}).title||"—";
  const where=e=>e.is_demo?"demo":e.lesson_id||"practica";
  const flt=e=>!exFilter||(exFilter==="demo"?e.is_demo:exFilter==="practica"?(!e.lesson_id&&!e.is_demo):e.lesson_id===exFilter);
  H().innerHTML=`<div class="split"><div class="panel"><div class="sec-h"><h3>Ejercicios</h3><button class="btn sm gold" id="nx">Nuevo</button></div>
    <label class="form" for="xf"><select id="xf"><option value="">Todos</option><option value="demo">Prueba gratis (portada)</option><option value="practica">Práctica libre</option>${les.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join("")}</select></label>
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
      <label for="xD">Dónde aparece<select id="xD"><option value="demo">Prueba gratis (portada)</option><option value="practica">Práctica libre</option>${les.map(l=>`<option value="${esc(l.id)}">Lección: ${esc(l.title)}</option>`).join("")}</select></label>
      <label for="xO">Orden<input id="xO" type="number" value="${e.sort||1}"></label></div>
    <label for="xP">Enunciado / pregunta (opcional en gráficas)<input id="xP" value="${esc(e.prompt||"")}"></label>
    <div id="xbody"></div>
    <label for="xE">Explicación que verá el alumno al responder<textarea id="xE" style="min-height:100px">${esc(a.explain||"")}</textarea></label>
    <div class="row"><button class="btn gold" id="xs">Guardar ejercicio</button>${e.id?'<span id="xd"><button type="button" class="btn sm bad" id="xdb">Eliminar</button></span>':""}</div></form><div id="xprev" style="margin-top:16px"></div>`;
  $("#xK").value=e.kind;$("#xD").value=dest;
  let C=null,ln=[],state={tf:"H1",mode:"zone"};
  const body=async()=>{const b=$("#xbody");if(C){C.destroy();C=null}
    if(chartK()){b.innerHTML=`<div class="three"><label for="xM">Mercado<select id="xM">${MARKETS.map(m=>`<option value="${m}">${MNAME[m]}</option>`).join("")}</select></label><label for="xS">Dirección<select id="xS"><option value="buy">Compra</option><option value="sell">Venta</option></select></label><label for="xT">Última vela visible (hora Colombia)<input id="xT" type="datetime-local"></label></div>
      <div class="row"><button type="button" class="btn sm" data-mv="-24">−1 día</button><button type="button" class="btn sm" data-mv="-1">−1 h</button><button type="button" class="btn sm" data-mv="1">+1 h</button><button type="button" class="btn sm" data-mv="24">+1 día</button></div>
      <div class="three"><label for="xTZ">Zona se marca en<select id="xTZ"><option>H1</option><option>M5</option></select></label><label for="xTS">Stop loss se marca en<select id="xTS"><option>M5</option><option>H1</option><option value="none">Sin stop loss</option></select></label><label for="xRH">Horas de repetición<input id="xRH" type="number" min="2" max="96" value="${e.reveal_hours||24}"></label></div>
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
  const collect=()=>{const k=$("#xK").value;const d=$("#xD").value;const o=Object.assign({},e,{kind:k,sort:+$("#xO").value||1,prompt:$("#xP").value.trim(),is_demo:d==="demo",lesson_id:d==="demo"||d==="practica"?null:d});
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
    <label for="pT">Título<input id="pT" value="${esc(p.title||"")}"></label><div class="two"><label for="pC">Categoría<input id="pC" list="pcats" value="${esc(p.category||"Noticia")}"><datalist id="pcats"><option value="Noticia"><option value="Anuncio"><option value="Actualización"><option value="Análisis"><option value="Comunidad"></datalist></label>
    <div class="row">${fileBtn("pI","Imagen de portada")}<input id="pU" value="${esc(p.image_url||"")}" placeholder="o URL de imagen" style="flex:1;min-width:180px"></div></div>
    <label for="pB">Contenido<textarea id="pB" style="min-height:220px">${esc(p.body||"")}</textarea></label>
    <div class="three"><label style="display:flex;gap:8px;align-items:center;color:var(--fg)"><input type="checkbox" id="pPin" style="width:auto" ${p.pinned?"checked":""}> Fijar arriba</label><label style="display:flex;gap:8px;align-items:center;color:var(--fg)"><input type="checkbox" id="pPr" style="width:auto" ${p.premium_only?"checked":""}> Solo premium</label><label style="display:flex;gap:8px;align-items:center;color:var(--fg)"><input type="checkbox" id="pCo" style="width:auto" ${p.allow_comments!==false?"checked":""}> Permitir comentarios</label></div>
    <div class="row"><button class="btn gold" id="ps">Publicar</button>${p.id?`<a class="btn ghost" href="#nota-${esc(p.id)}">Ver</a><span id="pd"><button type="button" class="btn sm bad" id="pdb">Eliminar</button></span>`:""}</div></form>`;
    bindUpload("pI",u=>$("#pU").value=u);
    $("#pf").onsubmit=async e=>{e.preventDefault();const o={title:$("#pT").value.trim()||"Sin título",category:$("#pC").value.trim()||"Noticia",image_url:$("#pU").value.trim(),body:$("#pB").value,pinned:$("#pPin").checked,premium_only:$("#pPr").checked,allow_comments:$("#pCo").checked};if(p.id)o.id=p.id;
      try{busy($("#ps"),true);await API.savePost(o);toast("Publicación guardada");noticias()}catch(x){toast(x.message)}finally{busy($("#ps"),false)}};
    const d=$("#pdb");if(d)d.onclick=()=>A.confirmInline($("#pd"),"¿Eliminar la publicación y sus comentarios?",async()=>{await API.delPost(p.id);toast("Publicación eliminada");noticias()})};
  $("#np").onclick=()=>edit({});$$("[data-p]").forEach(b=>b.onclick=()=>edit(list.find(p=>p.id===b.dataset.p)));
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

/* ---------- alumnos ---------- */
async function alumnos(){
  H().innerHTML='<div class="muted">Cargando…</div>';let list=[];try{list=await API.users()}catch(e){H().innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  const isP=u=>u.premium_until&&new Date(u.premium_until)>new Date();
  let q="";const draw=()=>{const f=list.filter(u=>!q||(u.username+" "+u.email).toLowerCase().includes(q));
    $("#ut").innerHTML=f.map(u=>`<tr><td><b>${esc(u.username)}</b>${u.role==="admin"?' <span class="tag pub">Admin</span>':""}${u.banned?' <span class="tag">Suspendido</span>':""}<br><span class="dim">${esc(u.email||"")}</span></td>
      <td>${isP(u)?`<span class="tag pub">Premium</span><br><span class="dim">hasta ${fmtDate(u.premium_until)}</span>`:'<span class="tag">Gratis</span>'}</td><td class="n">${u.xp||0}</td><td class="n">${u.demo_used||0}/5</td><td class="dim">${fmtDate(u.created_at)}</td>
      <td><div class="row"><button class="btn sm ok" data-add="${esc(u.id)}:30">+30 días</button><button class="btn sm" data-add="${esc(u.id)}:90">+90 días</button><input type="date" data-date="${esc(u.id)}" aria-label="Premium hasta" style="background:var(--bg2);border:1px solid var(--line2);border-radius:8px;padding:5px;color:var(--fg)">${isP(u)?`<button class="btn sm" data-rm="${esc(u.id)}">Quitar premium</button>`:""}
        <button class="btn sm ghost" data-ban="${esc(u.id)}">${u.banned?"Reactivar":"Suspender"}</button><button class="btn sm ghost" data-demo="${esc(u.id)}">Reiniciar prueba</button>${u.id!==(API.user()||{}).id?`<button class="btn sm ghost" data-role="${esc(u.id)}">${u.role==="admin"?"Quitar admin":"Hacer admin"}</button>`:""}</div></td></tr>`).join("")||'<tr><td colspan="6" class="muted">Sin resultados.</td></tr>';
    const set=async(id,patch,msg)=>{try{await API.setUser(id,patch);Object.assign(list.find(u=>u.id===id),patch);toast(msg);draw()}catch(x){toast(x.message)}};
    $$("[data-add]").forEach(b=>b.onclick=()=>{const [id,d]=b.dataset.add.split(":");const u=list.find(x=>x.id===id);const base=isP(u)?new Date(u.premium_until):new Date();base.setDate(base.getDate()+(+d));set(id,{premium_until:base.toISOString()},`Premium hasta ${fmtDate(base)}`)});
    $$("[data-date]").forEach(i=>i.onchange=()=>{if(i.value)set(i.dataset.date,{premium_until:new Date(i.value+"T23:59:00-05:00").toISOString()},"Fecha de premium actualizada")});
    $$("[data-rm]").forEach(b=>b.onclick=()=>set(b.dataset.rm,{premium_until:null},"Premium retirado"));
    $$("[data-ban]").forEach(b=>b.onclick=()=>{const u=list.find(x=>x.id===b.dataset.ban);set(u.id,{banned:!u.banned},u.banned?"Cuenta reactivada":"Cuenta suspendida")});
    $$("[data-demo]").forEach(b=>b.onclick=()=>set(b.dataset.demo,{demo_used:0},"Prueba gratis reiniciada"));
    $$("[data-role]").forEach(b=>b.onclick=()=>{const u=list.find(x=>x.id===b.dataset.role);set(u.id,{role:u.role==="admin"?"user":"admin"},"Rol actualizado")})};
  H().innerHTML=`<div class="panel"><div class="sec-h"><h3>Alumnos (${list.length})</h3><span class="muted">${list.filter(isP).length} premium activos</span></div>
    <input id="uq" placeholder="Buscar por usuario o correo" style="background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:10px 12px;color:var(--fg)">
    <div class="scroll"><table class="tbl"><thead><tr><th>Alumno</th><th>Acceso</th><th style="text-align:right">Puntos</th><th style="text-align:right">Prueba</th><th>Registro</th><th>Acciones</th></tr></thead><tbody id="ut"></tbody></table></div></div>`;
  $("#uq").oninput=()=>{q=$("#uq").value.toLowerCase();draw()};draw();
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
