/* EAG Charts · Journal de trading (calendario de PnL).
   Cada día guarda lo que ganaste o perdiste (lo escribes tú o llega del Marcador / MT5), cuántas operaciones,
   cómo te sentiste, si seguiste el plan y notas. Vistas: mes (cuadritos verdes/rojos + total de la semana),
   semana, año y estadísticas (días de la semana, curva del saldo, rachas, drawdown).
   Todo queda en las preferencias de la cuenta (SAVE.jrn), así se ve igual en el celular y en el PC. */
(function(){
"use strict";
let X=null,el=null,view={tab:"mes",y:0,m:0,wk:0,scope:"mes"},edit=null;
const MES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIA=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"],DIAL=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const MOODS=[["bien","😀","Bien"],["normal","😐","Normal"],["mal","😣","Mal"]];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const key=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)};
const today=()=>key(new Date());
const dow=d=>(d.getDay()+6)%7; /* 0 = lunes */
const uid=()=>Math.random().toString(36).slice(2,10);

/* ---------- datos ---------- */
function J(){const S=X.SAVE;S.jrn=Object.assign({accts:[],cur:null,days:{},hide:false,x:null,y:null,w:null,h:null,min:false,open:false},S.jrn||{});
  const j=S.jrn;if(!j.accts.length){j.accts.push({id:"a1",name:"Mi cuenta",start:null});j.cur="a1"}if(!j.accts.some(a=>a.id===j.cur))j.cur=j.accts[0].id;
  return j}
const acct=()=>{const j=J();return j.accts.find(a=>a.id===j.cur)};
const daysOf=(id)=>{const j=J();return j.days[id||j.cur]=j.days[id||j.cur]||{}};
const dayGet=k=>daysOf()[k]||null;
/* lo que llega solo: operaciones de MT5 (ops) y sesiones del Marcador (trk: {sesión: {v,n}}) */
const autoList=d=>[...(d.ops||[]).map(o=>({v:+o.v||0,n:1})),...Object.values(d.trk||{})];
function dayPnl(d){if(!d)return null;if(d.pnl!=null&&d.pnl!=="")return+d.pnl;const A=autoList(d);return A.length?+A.reduce((a,o)=>a+(+o.v||0),0).toFixed(2):null}
function dayN(d){if(!d)return 0;if(d.n!=null&&d.n!=="")return+d.n;return autoList(d).reduce((a,o)=>a+(+o.n||0),0)}
const has=d=>d&&(dayPnl(d)!=null||d.note||d.mood);
function clean(k){const D=daysOf(),d=D[k];if(!d)return;if((d.pnl==null||d.pnl==="")&&!(d.ops&&d.ops.length)&&!(d.trk&&Object.keys(d.trk).length)&&!d.note&&!d.mood&&d.plan==null&&(d.n==null||d.n===""))delete D[k]}
function save(){X.save();paintAll()}

/* ---------- formato ---------- */
const money=(v,short)=>{if(v==null)return"";if(J().hide)return v>0?"+•••":v<0?"−•••":"•••";const a=Math.abs(v),s=v>0?"+":v<0?"−":"";
  if(short&&a>=10000)return s+"$"+(a/1000).toFixed(a>=100000?0:1)+"k";return s+"$"+a.toLocaleString("en-US",{minimumFractionDigits:a%1&&a<1000?2:0,maximumFractionDigits:2})};
const bal=v=>J().hide?"US$ •••":"US$ "+(+v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=v=>v==null||!isFinite(v)?"—":(Math.round(v*10)/10)+"%";
const cls=v=>v==null?"":v>0?"jw":v<0?"jl":"jz";

/* ---------- estadísticas de un rango de días ---------- */
function stats(from,to){/* claves "YYYY-MM-DD" inclusive; from=null → desde el inicio */
  const D=daysOf(),ks=Object.keys(D).filter(k=>(!from||k>=from)&&(!to||k<=to)&&dayPnl(D[k])!=null).sort();
  const P=ks.map(k=>dayPnl(D[k])),tot=P.reduce((a,b)=>a+b,0),W=P.filter(v=>v>0),L=P.filter(v=>v<0);
  const gw=W.reduce((a,b)=>a+b,0),gl=-L.reduce((a,b)=>a+b,0),n=ks.reduce((a,k)=>a+dayN(D[k]),0);
  let rw=0,rl=0,cw=0,cl=0;P.forEach(v=>{if(v>0){cw++;cl=0}else if(v<0){cl++;cw=0}else{cw=0;cl=0}rw=Math.max(rw,cw);rl=Math.max(rl,cl)});
  let peak=0,eq=0,dd=0;P.forEach(v=>{eq+=v;peak=Math.max(peak,eq);dd=Math.max(dd,peak-eq)});
  const byDow=[0,0,0,0,0,0,0].map(()=>({s:0,n:0,w:0}));ks.forEach((k,i)=>{const b=byDow[dow(parse(k))];b.s+=P[i];b.n++;if(P[i]>0)b.w++});
  let plan=0,planN=0;ks.forEach(k=>{const d=D[k];if(d.plan!=null){planN++;if(d.plan)plan++}});
  return{ks,P,tot,days:ks.length,win:W.length,loss:L.length,wr:W.length+L.length?W.length/(W.length+L.length)*100:null,n,
    pf:gl?gw/gl:gw?Infinity:null,avgW:W.length?gw/W.length:null,avgL:L.length?-gl/L.length:null,
    best:P.length?Math.max(...P):null,worst:P.length?Math.min(...P):null,bestK:ks[P.indexOf(Math.max(...P))],worstK:ks[P.indexOf(Math.min(...P))],
    rw,rl,dd,byDow,plan:planN?plan/planN*100:null,cur:streakNow()}}
function streakNow(){const D=daysOf(),ks=Object.keys(D).filter(k=>dayPnl(D[k])!=null).sort();let n=0,s=0;for(let i=ks.length-1;i>=0;i--){const v=dayPnl(D[ks[i]]);const t=v>0?1:v<0?-1:0;if(!t)break;if(!s)s=t;if(t!==s)break;n++}return{n,s}}
const totalAll=()=>stats(null,null).tot;

/* ---------- operaciones desde el Marcador / MT5 ---------- */
function addOp(v,t,extra){t=t||Date.now();const k=key(new Date(t)),D=daysOf();const d=D[k]=D[k]||{};d.ops=d.ops||[];d.ops.push(Object.assign({v:+v,t},extra||{}));X.save();paintAll();return k}
/* botón "Agregar al journal" del Marcador: guarda el total de esa sesión en el día de hoy (si lo vuelves a tocar, se actualiza, no se duplica) */
function setSession(sid,v,n){const k=today(),D=daysOf(),d=D[k]=D[k]||{};d.trk=d.trk||{};d.trk[sid]={v:+(+v).toFixed(2),n:+n||0,t:Date.now()};X.save();paintAll();return{k,man:d.pnl!=null&&d.pnl!==""}}
const sessionIn=sid=>{const d=dayGet(today());return d&&d.trk&&d.trk[sid]||null};
function removeOp(t){const D=daysOf();for(const k in D){const d=D[k];if(!d.ops)continue;const i=d.ops.findIndex(o=>o.t===t);if(i>=0){d.ops.splice(i,1);clean(k);X.save();paintAll();return true}}return false}
function importMT5(){const h=window.EAGMT5B&&window.EAGMT5B.history&&window.EAGMT5B.history();
  if(!h||!h.deals.length){X.toast("Conecta MT5 (pestaña MT5 del panel Operar) para traer el historial. El EA manda los últimos días.");return}
  const j=J();let a=j.accts.find(x=>x.mt5===String(h.login));
  if(!a){a={id:uid(),name:"MT5 "+h.login+(h.name?" · "+h.name:""),start:null,mt5:String(h.login)};j.accts.push(a)}j.cur=a.id;
  const D=daysOf(a.id);let add=0;
  h.deals.forEach(x=>{const id="mt5:"+(x.deal||x.ticket||x.position+"-"+x.time),t=(+x.time<1e12?+x.time*1000:+x.time),k=key(new Date(t));
    if(Object.values(D).some(d=>d.ops&&d.ops.some(o=>o.id===id)))return;const d=D[k]=D[k]||{};d.ops=d.ops||[];
    d.ops.push({v:+(((+x.profit||0)+(+x.commission||0)+(+x.swap||0)).toFixed(2)),t,id,sym:x.symbol,src:"mt5"});add++});
  X.save();paintAll();X.toast(add?`Se agregaron ${add} operaciones de MT5 a "${a.name}".`:"Ya estaba todo el historial de MT5 en el journal.")}

/* ---------- pintar ---------- */
function build(){el=document.createElement("div");el.className="jr";el.setAttribute("role","dialog");el.setAttribute("aria-label","Journal de trading");
  el.innerHTML=`<div class="jr-h" data-drag><b class="jr-t">📅 Journal</b><span class="jr-mt" data-mt></span>
    <select data-acct aria-label="Cuenta"></select>
    <button data-eye title="Ocultar montos (para mostrar en el live sin enseñar el dinero)">👁</button>
    <button data-share title="Descargar imagen del mes para compartir">⤓</button>
    <button data-min title="Minimizar">—</button><button data-x title="Cerrar">✕</button></div>
    <div class="jr-b"><nav class="jr-tabs" role="tablist">${[["mes","Mes"],["sem","Semana"],["ano","Año"],["est","Estadísticas"]].map(([k,t])=>`<button role="tab" data-tab="${k}">${t}</button>`).join("")}</nav>
    <div class="jr-c" data-c></div></div><div class="jr-rs" data-rs title="Cambiar tamaño"></div>`;
  document.body.appendChild(el);el.addEventListener("pointerdown",e=>e.stopPropagation());
  el.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{view.tab=b.dataset.tab;edit=null;paint()});
  el.querySelector("[data-x]").onclick=()=>toggle(false);
  el.querySelector("[data-min]").onclick=()=>{const j=J();j.min=!j.min;X.save();paint();place()};
  el.querySelector("[data-eye]").onclick=()=>{const j=J();j.hide=!j.hide;save();X.toast(j.hide?"Montos ocultos: se ven solo los colores.":"Montos visibles.")};
  el.querySelector("[data-share]").onclick=shareImg;
  el.querySelector("[data-acct]").onchange=e=>{const v=e.target.value;if(v==="+"){edit={acct:"new"};paint();return}if(v==="mt5"){importMT5();return}J().cur=v;edit=null;save()};
  const hd=el.querySelector("[data-drag]");let d=null;
  hd.addEventListener("pointerdown",e=>{if(e.target.closest("button,select,input")||innerWidth<=640)return;d={x:e.clientX-el.offsetLeft,y:e.clientY-el.offsetTop};hd.setPointerCapture(e.pointerId);e.preventDefault()});
  hd.addEventListener("pointermove",e=>{if(!d)return;const j=J();j.x=e.clientX-d.x;j.y=e.clientY-d.y;place()});
  hd.addEventListener("pointerup",()=>{if(d){d=null;X.save()}});
  hd.addEventListener("dblclick",e=>{if(e.target.closest("button,select"))return;const j=J();j.min=!j.min;X.save();paint();place()});
  const rs=el.querySelector("[data-rs]");let r=null;
  rs.addEventListener("pointerdown",e=>{r={x:e.clientX,y:e.clientY,w:el.offsetWidth,h:el.offsetHeight};rs.setPointerCapture(e.pointerId);e.preventDefault()});
  rs.addEventListener("pointermove",e=>{if(!r)return;const j=J();j.w=Math.max(360,r.w+e.clientX-r.x);j.h=Math.max(320,r.h+e.clientY-r.y);place()});
  rs.addEventListener("pointerup",()=>{if(r){r=null;X.save()}});
  addEventListener("resize",place);
  addEventListener("keydown",e=>{if(e.key==="Escape"&&el&&!el.hidden&&edit){edit=null;paint()}})}
function place(){if(!el)return;const j=J(),mob=innerWidth<=640;el.classList.toggle("mob",mob);el.classList.toggle("min",!!j.min);
  if(mob){el.style.cssText="";return}
  const w=Math.min(j.w||760,innerWidth-12),h=j.min?null:Math.min(j.h||780,innerHeight-12);el.style.width=w+"px";el.style.height=h?h+"px":"";
  const hh=el.offsetHeight;let x=j.x==null?(innerWidth-w)/2:j.x,y=j.y==null?Math.max(8,(innerHeight-hh)/2):j.y;
  x=Math.min(Math.max(6,x),innerWidth-w-6);y=Math.min(Math.max(6,y),innerHeight-Math.min(hh,innerHeight-12)-6);el.style.left=x+"px";el.style.top=y+"px"}
function paintAll(){if(el&&!el.hidden)paint();X.onChange&&X.onChange()}
function paint(){const j=J();
  el.querySelectorAll("[data-tab]").forEach(b=>{b.classList.toggle("on",b.dataset.tab===view.tab);b.setAttribute("aria-selected",String(b.dataset.tab===view.tab))});
  const sel=el.querySelector("[data-acct]");if(document.activeElement!==sel)sel.innerHTML=j.accts.map(a=>`<option value="${esc(a.id)}"${a.id===j.cur?" selected":""}>${esc(a.name)}</option>`).join("")+`<option value="+">＋ Nueva cuenta…</option>`+(window.EAGMT5B&&window.EAGMT5B.history?`<option value="mt5">⤓ Traer historial de MT5</option>`:"");
  el.querySelector("[data-eye]").classList.toggle("on",!!j.hide);
  const ms=stats(view.y+"-"+pad(view.m+1)+"-01",view.y+"-"+pad(view.m+1)+"-31");
  el.querySelector("[data-mt]").innerHTML=j.min?`${MES[view.m]} <b class="${cls(ms.tot||null)}">${ms.days?money(ms.tot):"—"}</b>`:"";
  if(j.min)return;
  const c=el.querySelector("[data-c]");
  c.innerHTML=edit&&edit.acct?acctForm():edit&&edit.day?dayForm(edit.day):view.tab==="mes"?monthView():view.tab==="sem"?weekView():view.tab==="ano"?yearView():statsView();
  bind(c)}

function head(){const a=acct(),tot=totalAll(),st=a.start!=null&&a.start!==""?+a.start:null;
  return `<div class="jr-acct"><div><small>${esc(a.name)}</small>${st!=null?`<b>${bal(st+tot)}</b><i class="${cls(tot||null)}">${money(tot)} desde ${bal(st)}${st>0?` · ${pct(tot/st*100)}`:""}</i>`:`<b class="${cls(tot||null)}">${money(tot)||"$0"}</b><i>Resultado total</i>`}</div>
    <button class="jr-lnk" data-eacct>Editar cuenta</button></div>`}
function sumStrip(s,label){return `<div class="jr-sum">
  <div><small>${label}</small><b class="${cls(s.days?s.tot:null)}">${s.days?money(s.tot):"—"}</b></div>
  <div><small>Días</small><b><span class="jw">${s.win}</span> / <span class="jl">${s.loss}</span></b></div>
  <div><small>Días ganados</small><b>${pct(s.wr)}</b></div>
  <div><small>Operaciones</small><b>${s.n||0}</b></div></div>`}

function monthView(){const y=view.y,m=view.m,first=new Date(y,m,1),nd=new Date(y,m+1,0).getDate(),off=dow(first),D=daysOf(),t=today();
  const s=stats(y+"-"+pad(m+1)+"-01",y+"-"+pad(m+1)+"-"+pad(nd));const mx=Math.max(1,...s.P.map(Math.abs));
  const cells=[];for(let i=0;i<off;i++)cells.push(null);for(let d=1;d<=nd;d++)cells.push(d);while(cells.length%7)cells.push(null);
  let rows="",wks=[];for(let r=0;r<cells.length;r+=7){const wk=cells.slice(r,r+7);let ws=0,wn=0,wd=0;
    rows+=wk.map(d=>{if(!d)return`<div class="jc jo"></div>`;const k=y+"-"+pad(m+1)+"-"+pad(d),o=D[k],v=dayPnl(o),n=dayN(o);if(v!=null){ws+=v;wd++}wn+=n;
      const a=v==null?0:.18+.62*Math.min(1,Math.abs(v)/mx);
      return`<button class="jc ${cls(v)}${k===t?" jt":""}${k>t?" jf":""}" data-day="${k}" style="--a:${a.toFixed(2)}" aria-label="${d} de ${MES[m]}${v!=null?", "+money(v):""}">
        <span class="jd">${d}${o&&o.note?`<i class="jnote" title="Tiene notas">✎</i>`:""}${o&&o.mood?`<i>${(MOODS.find(x=>x[0]===o.mood)||[])[1]||""}</i>`:""}</span>
        ${v!=null?`<b>${money(v,true)}</b>`:""}${n?`<small>${n} op</small>`:""}</button>`}).join("")+
      `<div class="jc jwk ${wd?cls(ws):""}"><span class="jd">Sem ${r/7+1}</span>${wd?`<b>${money(ws,true)}</b><small>${wd} ${wd===1?"día":"días"}</small>`:""}</div>`;wks.push({i:r/7+1,ws,wd})}
  return head()+`<div class="jr-nav"><button data-mv="-1" aria-label="Mes anterior">‹</button><b>${MES[m]} ${y}</b><button data-mv="1" aria-label="Mes siguiente">›</button><button class="jr-lnk" data-hoy>Hoy</button></div>
    ${sumStrip(s,"Este mes")}
    <div class="jr-cal">${DIA.map(d=>`<div class="jh">${d}</div>`).join("")}<div class="jh">Semana</div>${rows}</div>
    <div class="jr-wks">${wks.map(w=>`<span class="${w.wd?cls(w.ws):""}"><small>Sem ${w.i}</small><b>${w.wd?money(w.ws,true):"—"}</b></span>`).join("")}</div>
    <p class="jr-hint">Toca un día para escribir cuánto ganaste o perdiste, tus notas y cómo te fue. Lo que marques en el Marcador llega solo al día de hoy.</p>`}

function weekView(){const base=new Date();base.setHours(0,0,0,0);base.setDate(base.getDate()-dow(base)+view.wk*7);const D=daysOf(),t=today();
  const ks=[...Array(7)].map((_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);return key(d)});
  const s=stats(ks[0],ks[6]),mx=Math.max(1,...s.P.map(Math.abs));const f=parse(ks[0]),l=parse(ks[6]);
  return head()+`<div class="jr-nav"><button data-wv="-1" aria-label="Semana anterior">‹</button><b>${f.getDate()} ${MES[f.getMonth()].slice(0,3)} – ${l.getDate()} ${MES[l.getMonth()].slice(0,3)} ${l.getFullYear()}</b><button data-wv="1" aria-label="Semana siguiente">›</button><button class="jr-lnk" data-hoyw>Esta semana</button></div>
    ${sumStrip(s,"Esta semana")}
    <div class="jr-wk">${ks.map((k,i)=>{const o=D[k],v=dayPnl(o),n=dayN(o);return`<button class="jwr${k===t?" jt":""}" data-day="${k}">
      <span class="jwd"><b>${DIAL[i]}</b><small>${parse(k).getDate()} ${MES[parse(k).getMonth()].slice(0,3)}</small></span>
      <span class="jbar"><i class="${cls(v)}" style="width:${v==null?0:Math.max(3,Math.abs(v)/mx*100)}%"></i></span>
      <span class="jwv ${cls(v)}">${v==null?"—":money(v)}<small>${n?n+" op":""}${o&&o.note?" · ✎":""}</small></span></button>`}).join("")}</div>`}

function yearView(){const y=view.y,D=daysOf(),ys=stats(y+"-01-01",y+"-12-31");
  return head()+`<div class="jr-nav"><button data-yv="-1" aria-label="Año anterior">‹</button><b>${y}</b><button data-yv="1" aria-label="Año siguiente">›</button></div>
    ${sumStrip(ys,"Este año")}
    <div class="jr-yr">${MES.map((mn,m)=>{const nd=new Date(y,m+1,0).getDate(),off=dow(new Date(y,m,1)),s=stats(y+"-"+pad(m+1)+"-01",y+"-"+pad(m+1)+"-"+pad(nd)),mx=Math.max(1,...s.P.map(Math.abs));
      let g="";for(let i=0;i<off;i++)g+="<i></i>";for(let d=1;d<=nd;d++){const v=dayPnl(D[y+"-"+pad(m+1)+"-"+pad(d)]);g+=`<i class="${cls(v)}" style="--a:${v==null?0:(.25+.75*Math.min(1,Math.abs(v)/mx)).toFixed(2)}"></i>`}
      return`<button class="jym" data-gom="${m}"><span><b>${mn}</b><em class="${cls(s.days?s.tot:null)}">${s.days?money(s.tot,true):"—"}</em></span><div class="jyg">${g}</div><small>${s.days?`${s.win} verdes · ${s.loss} rojos`:"Sin datos"}</small></button>`}).join("")}</div>`}

function statsView(){const y=view.y,m=view.m,sc=view.scope,now=new Date();
  const [from,to,lab]=sc==="mes"?[y+"-"+pad(m+1)+"-01",y+"-"+pad(m+1)+"-31",MES[m]+" "+y]:sc==="ano"?[y+"-01-01",y+"-12-31","Año "+y]:[null,null,"Todo"];
  const s=stats(from,to),mx=Math.max(1,...s.byDow.map(b=>Math.abs(b.s)));
  const card=(t,v,c,sub)=>`<div class="jst"><small>${t}</small><b class="${c||""}">${v}</b>${sub?`<i>${sub}</i>`:""}</div>`;
  const dk=k=>k?parse(k).getDate()+" "+MES[parse(k).getMonth()].slice(0,3):"";
  return head()+`<div class="jr-nav"><div class="jr-seg">${[["mes","Mes"],["ano","Año"],["todo","Todo"]].map(([k,t])=>`<button data-sc="${k}" class="${sc===k?"on":""}">${t}</button>`).join("")}</div><b>${lab}</b></div>
    ${!s.days?`<p class="jr-empty">Todavía no hay días con resultado en este periodo. Toca un día en el calendario para empezar.</p>`:`
    <div class="jr-sts">
      ${card("Resultado",money(s.tot),cls(s.tot))}
      ${card("Días ganados",pct(s.wr),"",`${s.win} verdes · ${s.loss} rojos`)}
      ${card("Profit factor",s.pf==null?"—":s.pf===Infinity?"∞":s.pf.toFixed(2),s.pf>=1?"jw":s.pf!=null?"jl":"","ganado ÷ perdido")}
      ${card("Promedio día verde",money(s.avgW),"jw")}
      ${card("Promedio día rojo",money(s.avgL),"jl")}
      ${card("Mejor día",money(s.best),"jw",dk(s.bestK))}
      ${card("Peor día",money(s.worst),"jl",dk(s.worstK))}
      ${card("Racha verde más larga",s.rw+" días")}
      ${card("Racha roja más larga",s.rl+" días")}
      ${card("Caída máxima",s.dd?money(-s.dd):"$0","jl","del punto más alto")}
      ${card("Operaciones",s.n,"",s.days?`${(s.n/s.days).toFixed(1)} por día`:"")}
      ${card("Seguí mi plan",pct(s.plan),"",s.plan==null?"márcalo en cada día":"de los días marcados")}
    </div>
    <h4 class="jr-h4">Curva del saldo</h4><canvas class="jr-eq" data-eq height="180"></canvas>
    <h4 class="jr-h4">Por día de la semana</h4>
    <div class="jr-dow">${s.byDow.map((b,i)=>`<div class="jdw"><span>${DIA[i]}</span><span class="jbar c"><i class="${cls(b.n?b.s:null)}" style="width:${b.n?Math.max(3,Math.abs(b.s)/mx*100):0}%"></i></span><b class="${cls(b.n?b.s:null)}">${b.n?money(b.s,true):"—"}</b><small>${b.n?Math.round(b.w/b.n*100)+"% verdes":""}</small></div>`).join("")}</div>`}
    <p class="jr-hint">Racha actual: ${s.cur.n?`${s.cur.n} ${s.cur.n===1?"día":"días"} ${s.cur.s>0?"en verde 🔥":"en rojo"}`:"sin racha"}.</p>`}

function drawEq(cv){const s=view.scope,y=view.y,m=view.m;const [from,to]=s==="mes"?[y+"-"+pad(m+1)+"-01",y+"-"+pad(m+1)+"-31"]:s==="ano"?[y+"-01-01",y+"-12-31"]:[null,null];
  const st=stats(from,to);const a=acct(),base=a.start!=null&&a.start!==""?+a.start+(from?stats(null,prevKey(from)).tot:0):0;
  const pts=[base];st.P.forEach(v=>pts.push(pts[pts.length-1]+v));const dpr=devicePixelRatio||1,W=cv.clientWidth||600,H=180;cv.width=W*dpr;cv.height=H*dpr;
  const c=cv.getContext("2d");c.scale(dpr,dpr);const css=getComputedStyle(el),ok=css.getPropertyValue("--ok").trim()||"#089981",bad=css.getPropertyValue("--bad").trim()||"#f23645",mut=css.getPropertyValue("--mut").trim()||"#888",line=css.getPropertyValue("--line").trim()||"#333";
  const lo=Math.min(...pts),hi=Math.max(...pts),pd=(hi-lo)*.1||1,yy=v=>12+(hi+pd-v)/(hi-lo+2*pd)*(H-30),xx=i=>8+i/(Math.max(1,pts.length-1))*(W-70);
  c.strokeStyle=line;c.lineWidth=1;c.setLineDash([3,4]);c.beginPath();c.moveTo(8,yy(base));c.lineTo(W-62,yy(base));c.stroke();c.setLineDash([]);
  const col=pts[pts.length-1]>=base?ok:bad;const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,col+"55");g.addColorStop(1,col+"00");
  c.beginPath();pts.forEach((v,i)=>i?c.lineTo(xx(i),yy(v)):c.moveTo(xx(i),yy(v)));c.lineTo(xx(pts.length-1),H-18);c.lineTo(xx(0),H-18);c.closePath();c.fillStyle=g;c.fill();
  c.beginPath();pts.forEach((v,i)=>i?c.lineTo(xx(i),yy(v)):c.moveTo(xx(i),yy(v)));c.strokeStyle=col;c.lineWidth=2.2;c.stroke();
  c.fillStyle=mut;c.font="600 11px Inter,system-ui,sans-serif";c.textBaseline="middle";
  const lab=v=>J().hide?"•••":(a.start!=null&&a.start!==""?"$":"")+(+v).toLocaleString("en-US",{maximumFractionDigits:2});
  c.fillText(lab(hi),W-58,yy(hi));c.fillText(lab(lo),W-58,yy(lo));c.fillText(st.ks.length+" días",8,H-7)}
const prevKey=k=>{const d=parse(k);d.setDate(d.getDate()-1);return key(d)};

/* ---------- editar un día ---------- */
function dayForm(k){const d=dayGet(k)||{},ops=d.ops||[],trk=Object.entries(d.trk||{}),A=autoList(d),sum=A.reduce((a,o)=>a+(+o.v||0),0),dt=parse(k),man=d.pnl!=null&&d.pnl!=="";
  const v=man?+d.pnl:null,sign=v!=null?(v<0?-1:1):(edit.sign||1);
  return `<div class="jr-nav"><button data-back aria-label="Volver">‹</button><b>${DIAL[dow(dt)]} ${dt.getDate()} de ${MES[dt.getMonth()]} ${dt.getFullYear()}</b></div>
  <div class="jr-form">
    <label class="jf-l">Resultado del día (US$)</label>
    <div class="jf-pnl"><div class="jr-seg big"><button data-sg="1" class="${sign>0?"on jw":""}">＋ Ganancia</button><button data-sg="-1" class="${sign<0?"on jl":""}">− Pérdida</button></div>
      <input data-pnl type="text" inputmode="decimal" placeholder="${A.length?Math.abs(sum).toFixed(2):"0.00"}" value="${v!=null?Math.abs(v):""}" aria-label="Monto del día"></div>
    ${A.length?`<small class="jf-h">${trk.length?"Del Marcador":""}${trk.length&&ops.length?" y ":""}${ops.length?"de MT5":""}: <b class="${cls(sum)}">${money(sum)}</b> en ${A.reduce((a,o)=>a+(+o.n||0),0)} op. ${man?"Estás usando tu monto; bórralo para usar el del marcador.":"Si escribes un monto, se usa el tuyo."}</small>`:""}
    <div class="jf-row"><label class="jf-l">Operaciones<input data-n type="number" min="0" step="1" inputmode="numeric" placeholder="${A.reduce((x,o)=>x+(+o.n||0),0)}" value="${d.n!=null&&d.n!==""?d.n:""}"></label>
      <div><span class="jf-l">¿Cómo te sentiste?</span><div class="jr-seg">${MOODS.map(([k2,e,t])=>`<button data-mood="${k2}" class="${d.mood===k2?"on":""}" title="${t}">${e} ${t}</button>`).join("")}</div></div></div>
    <div><span class="jf-l">¿Seguiste tu plan?</span><div class="jr-seg">${[[true,"Sí"],[false,"No"]].map(([b,t])=>`<button data-plan="${b}" class="${d.plan===b?"on "+(b?"jw":"jl"):""}">${t}</button>`).join("")}</div></div>
    <label class="jf-l">Notas del día<textarea data-note rows="4" placeholder="Qué viste, por qué entraste, qué aprendiste, errores…">${esc(d.note||"")}</textarea></label>
    ${trk.length?`<details class="jf-ops" open><summary>Sesiones del Marcador (${trk.length})</summary>${trk.map(([sid,o])=>`<div><span>${new Date(o.t||+sid).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})} · ${o.n} op</span><b class="${cls(o.v)}">${money(o.v)}</b><button data-deltrk="${esc(sid)}" aria-label="Quitar sesión">✕</button></div>`).join("")}</details>`:""}
    ${ops.length?`<details class="jf-ops"><summary>Operaciones registradas (${ops.length})</summary>${ops.map(o=>`<div><span>${new Date(o.t).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}${o.sym?" · "+esc(o.sym):""}${o.src==="mt5"?" · MT5":""}</span><b class="${cls(o.v)}">${money(o.v)}</b><button data-delop="${o.t}" aria-label="Borrar operación">✕</button></div>`).join("")}</details>`:""}
    <div class="jf-act"><button class="jr-btn pri" data-savek>Guardar día</button>${has(d)||A.length?`<button class="jr-btn bad" data-delk>${edit.sure?"¿Borrar todo el día?":"Borrar día"}</button>`:""}</div>
  </div>`}
function acctForm(){const nu=edit.acct==="new",a=nu?{name:"",start:""}:acct();
  return `<div class="jr-nav"><button data-back aria-label="Volver">‹</button><b>${nu?"Nueva cuenta":"Editar cuenta"}</b></div>
  <div class="jr-form"><p class="jf-h">Ten una cuenta por cada reto o broker (por ejemplo "Reto $100 TikTok" y "Real"). Cada una tiene su propio calendario.</p>
    <label class="jf-l">Nombre<input data-an type="text" maxlength="40" value="${esc(a.name)}" placeholder="Reto $100 TikTok"></label>
    <label class="jf-l">Saldo inicial US$ (opcional)<input data-as type="text" inputmode="decimal" value="${a.start!=null?a.start:""}" placeholder="100"></label>
    <small class="jf-h">Con el saldo inicial se muestra el saldo actual, el % que llevas y la curva del saldo.</small>
    <div class="jf-act"><button class="jr-btn pri" data-asave>${nu?"Crear cuenta":"Guardar"}</button>${!nu&&J().accts.length>1?`<button class="jr-btn bad" data-adel>${edit.sure?"¿Borrar cuenta y sus días?":"Borrar cuenta"}</button>`:""}</div></div>`}

const num=s=>{const v=parseFloat(String(s).replace(/\s/g,"").replace(/,(?=\d{1,2}$)/,".").replace(/,/g,""));return isFinite(v)?v:null};
function bind(c){const q=s=>c.querySelector(s),qa=s=>c.querySelectorAll(s);
  qa("[data-day]").forEach(b=>b.onclick=()=>{edit={day:b.dataset.day};paint()});
  const go=(dm)=>{view.m+=dm;if(view.m<0){view.m=11;view.y--}if(view.m>11){view.m=0;view.y++}paint()};
  qa("[data-mv]").forEach(b=>b.onclick=()=>go(+b.dataset.mv));
  qa("[data-wv]").forEach(b=>b.onclick=()=>{view.wk+=+b.dataset.wv;paint()});
  qa("[data-yv]").forEach(b=>b.onclick=()=>{view.y+=+b.dataset.yv;paint()});
  q("[data-hoy]")&&(q("[data-hoy]").onclick=()=>{const n=new Date();view.y=n.getFullYear();view.m=n.getMonth();paint()});
  q("[data-hoyw]")&&(q("[data-hoyw]").onclick=()=>{view.wk=0;paint()});
  qa("[data-gom]").forEach(b=>b.onclick=()=>{view.m=+b.dataset.gom;view.tab="mes";paint()});
  qa("[data-sc]").forEach(b=>b.onclick=()=>{view.scope=b.dataset.sc;paint()});
  q("[data-eacct]")&&(q("[data-eacct]").onclick=()=>{edit={acct:J().cur};paint()});
  q("[data-back]")&&(q("[data-back]").onclick=()=>{edit=null;paint()});
  const eq=q("[data-eq]");eq&&requestAnimationFrame(()=>drawEq(eq));
  if(edit&&edit.day){const k=edit.day,D=daysOf();const cur=()=>D[k]=D[k]||{};
    qa("[data-sg]").forEach(b=>b.onclick=()=>{edit.sign=+b.dataset.sg;const i=q("[data-pnl]");const v=num(i.value);if(v!=null){cur().pnl=edit.sign*Math.abs(v)}
      qa("[data-sg]").forEach(x=>{const on=+x.dataset.sg===edit.sign;x.className=on?"on "+(edit.sign>0?"jw":"jl"):""});i.focus()});
    qa("[data-mood]").forEach(b=>b.onclick=()=>{const d=cur();d.mood=d.mood===b.dataset.mood?null:b.dataset.mood;qa("[data-mood]").forEach(x=>x.classList.toggle("on",x.dataset.mood===d.mood))});
    qa("[data-plan]").forEach(b=>b.onclick=()=>{const d=cur(),v=b.dataset.plan==="true";d.plan=d.plan===v?null:v;qa("[data-plan]").forEach(x=>{const on=d.plan===(x.dataset.plan==="true");x.className=on?"on "+(d.plan?"jw":"jl"):""})});
    qa("[data-deltrk]").forEach(b=>b.onclick=()=>{const d=cur();if(d.trk)delete d.trk[b.dataset.deltrk];X.save();paint()});
    qa("[data-delop]").forEach(b=>b.onclick=()=>{const d=cur();d.ops=(d.ops||[]).filter(o=>String(o.t)!==b.dataset.delop);X.save();paint()});
    q("[data-savek]").onclick=()=>{const d=cur(),i=q("[data-pnl]"),v=num(i.value);const sg=edit.sign||(d.pnl!=null&&+d.pnl<0?-1:1);
      d.pnl=v==null?null:+(sg*Math.abs(v)).toFixed(2);const n=q("[data-n]").value;d.n=n===""?null:Math.max(0,parseInt(n,10)||0);
      d.note=q("[data-note]").value.trim()||null;clean(k);edit=null;save();const dd=dayGet(k);X.toast(dd?`Día guardado: ${money(dayPnl(dd))||"sin monto"}.`:"Día vacío.")};
    const dl=q("[data-delk]");dl&&(dl.onclick=()=>{if(!edit.sure){edit.sure=true;dl.textContent="¿Borrar todo el día?";setTimeout(()=>{if(edit&&edit.sure){edit.sure=false;dl.isConnected&&(dl.textContent="Borrar día")}},3000);return}delete D[k];edit=null;save();X.toast("Día borrado.")})}
  if(edit&&edit.acct){q("[data-asave]").onclick=()=>{const j=J(),n=q("[data-an]").value.trim()||"Mi cuenta",s=num(q("[data-as]").value);
      if(edit.acct==="new"){const a={id:uid(),name:n,start:s};j.accts.push(a);j.cur=a.id}else{const a=acct();a.name=n;a.start=s}edit=null;save()};
    const ad=q("[data-adel]");ad&&(ad.onclick=()=>{if(!edit.sure){edit.sure=true;ad.textContent="¿Borrar cuenta y sus días?";return}const j=J();delete j.days[j.cur];j.accts=j.accts.filter(a=>a.id!==j.cur);j.cur=j.accts[0].id;edit=null;save()})}}

/* ---------- imagen para compartir (el mes, con la marca) ---------- */
function shareImg(){const y=view.y,m=view.m,nd=new Date(y,m+1,0).getDate(),off=dow(new Date(y,m,1)),D=daysOf(),s=stats(y+"-"+pad(m+1)+"-01",y+"-"+pad(m+1)+"-"+pad(nd)),mx=Math.max(1,...s.P.map(Math.abs));
  const W=1080,H=380+34+Math.ceil((off+nd)/7)*140+130,cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d");
  const bg="#060b1a",card="#0e1a3d",fg="#e9edf7",mut="#93a1c4",gold="#d8b062",ok="#089981",bad="#f23645";
  c.fillStyle=bg;c.fillRect(0,0,W,H);c.textBaseline="middle";
  c.fillStyle=gold;c.font="800 34px Inter,system-ui,sans-serif";c.fillText("EL ARTE GRÁFICO",72,92);
  c.fillStyle=mut;c.font="600 26px Inter,system-ui,sans-serif";c.fillText(acct().name+" · "+MES[m]+" "+y,72,140);
  c.font="900 96px Inter,system-ui,sans-serif";c.fillStyle=s.tot>0?ok:s.tot<0?bad:fg;c.fillText(s.days?money(s.tot):"$0",72,236);
  c.fillStyle=mut;c.font="600 28px Inter,system-ui,sans-serif";c.fillText(`${s.win} días verdes · ${s.loss} rojos · ${pct(s.wr)} ganados · ${s.n} operaciones`,72,314);
  const gx=72,gy=380,cw=(W-144-6*12)/7,ch=128;
  DIA.forEach((d,i)=>{c.fillStyle=mut;c.font="700 24px Inter,system-ui,sans-serif";c.textAlign="center";c.fillText(d,gx+i*(cw+12)+cw/2,gy)});c.textAlign="left";
  for(let d=1;d<=nd;d++){const i=off+d-1,col=i%7,row=Math.floor(i/7),x=gx+col*(cw+12),yy=gy+34+row*(ch+12),v=dayPnl(D[y+"-"+pad(m+1)+"-"+pad(d)]);
    c.fillStyle=card;round(c,x,yy,cw,ch,16);c.fill();
    if(v!=null){c.globalAlpha=.25+.65*Math.min(1,Math.abs(v)/mx);c.fillStyle=v>0?ok:v<0?bad:mut;round(c,x,yy,cw,ch,16);c.fill();c.globalAlpha=1}
    c.fillStyle=mut;c.font="700 24px Inter,system-ui,sans-serif";c.fillText(String(d),x+14,yy+26);
    if(v!=null){c.fillStyle="#fff";c.font="800 26px Inter,system-ui,sans-serif";c.textAlign="center";c.fillText(money(v,true),x+cw/2,yy+ch/2+16);c.textAlign="left"}}
  c.fillStyle=mut;c.font="600 24px Inter,system-ui,sans-serif";c.fillText("Journal · EAG Charts · elartegrafico.com",72,H-60);
  const name=`journal-${acct().name.replace(/[^\w]+/g,"-").toLowerCase()}-${y}-${pad(m+1)}.png`;
  cv.toBlob(b=>{if(!b)return;const f=new File([b],name,{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[f]})&&/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)){navigator.share({files:[f],title:"Mi journal"}).catch(()=>{});return}
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);X.toast("Imagen del mes descargada.")},"image/png")}
function round(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}

function toggle(on,dayK){const j=J();j.open=on==null?!j.open:!!on;X.save();
  if(j.open){if(!el)build();const n=new Date();if(!view.y){view.y=n.getFullYear();view.m=n.getMonth()}if(dayK){j.min=false;edit={day:dayK};const d=parse(dayK);view.y=d.getFullYear();view.m=d.getMonth()}
    el.hidden=false;paint();place()}else if(el){el.hidden=true;edit=null}
  document.querySelectorAll(".wjr").forEach(b=>b.classList.toggle("on",j.open))}

window.EAGJournal={init(o){X=o;const j=J();for(const a in j.days)for(const k in j.days[a]){const d=j.days[a][k];if(d.ops){d.ops=d.ops.filter(op=>op.src);if(!d.ops.length)delete d.ops}}if(J().open)setTimeout(()=>toggle(true),700)},toggle,open:k=>toggle(true,k),
  addOp,removeOp,setSession,sessionIn,today:()=>{const d=dayGet(today());return{pnl:dayPnl(d),n:dayN(d)}},importMT5,_stats:stats,_J:J};
})();
