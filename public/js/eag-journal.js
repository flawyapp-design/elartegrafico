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
    <div class="jr-b"><nav class="jr-tabs" role="tablist">${[["mes","Mes"],["sem","Semana"],["ano","Año"],["est","Estadísticas"],["plan","Plan"]].map(([k,t])=>`<button role="tab" data-tab="${k}">${t}</button>`).join("")}</nav>
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
function paintAll(){if(el&&!el.hidden)paint();X.onChange&&X.onChange();try{planCheck()}catch(e){}try{X.lotRepaint&&X.lotRepaint()}catch(e){}}

/* ================= Plan de trading + calculadora de lote (por cuenta) =================
   El saldo sale solo del journal (saldo inicial + todo lo ganado/perdido) y con él se calcula el riesgo y el lote. */
const PLAN0={mode:"pct",pct:1,usd:0,lossMode:"pct",loss:3,goal:0,maxT:0,minRR:0,rules:[]};
const planOf=a=>{a=a||acct();if(!a.plan)a.plan={};Object.keys(PLAN0).forEach(k=>{if(a.plan[k]===undefined)a.plan[k]=Array.isArray(PLAN0[k])?[]:PLAN0[k]});if(!Array.isArray(a.plan.rules))a.plan.rules=[];return a.plan};
/* depósitos y retiros: cambian el saldo pero NO cuentan como ganancia o pérdida del trading */
const flowsOf=a=>{a=a||acct();if(!Array.isArray(a.flows))a.flows=[];return a.flows};
const flowSum=(to,a)=>flowsOf(a).filter(f=>!to||f.k<=to).reduce((x,f)=>x+(+f.v||0),0);
const flowParts=a=>{let d=0,r=0;flowsOf(a).forEach(f=>{if(f.v>0)d+=+f.v;else r-=+f.v});return{d,r}};
const hasStart=a=>{a=a||acct();return a.start!=null&&a.start!==""};
const balNow=()=>{const a=acct();return hasStart(a)||flowsOf(a).length?(+a.start||0)+totalAll()+flowSum(null,a):null};
const balAtDay=k=>{const a=acct();if(!hasStart(a)&&!flowsOf(a).length)return null;return (+a.start||0)+stats(null,prevKey(k)).tot+flowSum(k,a)};
const riskUsdOf=(pl,bal)=>pl.mode==="usd"?(+pl.usd||0):(bal||0)*(+pl.pct||0)/100;
const lossUsdOf=(pl,bal)=>pl.lossMode==="usd"?(+pl.loss||0):(bal||0)*(+pl.loss||0)/100;
function todayState(){const k=today(),d=dayGet(k),pl=planOf(),b0=balAtDay(k),pnl=dayPnl(d)||0,n=dayN(d);
  return{k,pl,b0,pnl,n,loss:lossUsdOf(pl,b0),goal:+pl.goal||0,maxT:+pl.maxT||0}}
/* avisa una sola vez por día cuando llegas a la pérdida máxima, a la meta o al máximo de operaciones */
function planCheck(){const N=window.EAGN;if(!N)return;const t=todayState(),j=J();j.planN=j.planN||{};const key=j.cur+"|"+t.k,f=j.planN[key]=j.planN[key]||{};let ch=false;
  if(t.loss>0&&t.pnl<=-t.loss&&!f.loss){f.loss=1;ch=true;N.notify({cat:"trade",icon:"🛑",title:"Llegaste a tu pérdida máxima del día",body:`Vas ${money(t.pnl)} y tu límite es ${money(-t.loss)}. Tu plan dice: para por hoy.`,tone:"bad",sound:"alarma",important:true,sticky:true})}
  if(t.goal>0&&t.pnl>=t.goal&&!f.goal){f.goal=1;ch=true;N.notify({cat:"trade",icon:"🎯",title:"¡Meta del día cumplida!",body:`Vas ${money(t.pnl)} (meta ${money(t.goal)}). Cuida lo ganado.`,tone:"ok",sound:"exito",important:true})}
  if(t.maxT>0&&t.n>=t.maxT&&!f.maxT){f.maxT=1;ch=true;N.notify({cat:"trade",icon:"✋",title:"Llegaste al máximo de operaciones de hoy",body:`${t.n} de ${t.maxT} operaciones. Tu plan dice que no hagas más.`,tone:"bad",sound:"aviso",important:true})}
  if(ch){const ks=Object.keys(j.planN).sort();if(ks.length>60)ks.slice(0,ks.length-60).forEach(x=>delete j.planN[x]);X.save()}}
function planView(){const a=acct(),pl=planOf(a),balV=balNow(),t=todayState(),risk=riskUsdOf(pl,balV),on=!!(X.SAVE.risk&&X.SAVE.risk.on);
  const bar=(v,max,bad)=>`<span class="jbar"><i class="${bad?"jl":"jw"}" style="width:${max>0?Math.max(2,Math.min(100,Math.abs(v)/max*100)):0}%"></i></span>`;
  const pts=view.calc||"";const lot=risk>0&&+pts>0?Math.floor(risk/(+pts)*100+1e-9)/100:null;
  return head()+`<div class="jp">
   <section class="jps"><h4>Hoy según tu plan</h4>
    <div class="jpg"><div><small>Resultado de hoy</small><b class="${cls(t.pnl||null)}">${money(t.pnl)||"$0"}</b></div>
      <div><small>Pérdida máxima</small><b>${t.loss>0?money(-t.loss):"—"}</b>${t.loss>0?bar(Math.min(0,t.pnl),t.loss,true):""}</div>
      <div><small>Meta del día</small><b>${t.goal>0?money(t.goal):"—"}</b>${t.goal>0?bar(Math.max(0,t.pnl),t.goal):""}</div>
      <div><small>Operaciones</small><b>${t.n}${t.maxT?" / "+t.maxT:""}</b>${t.maxT?bar(t.n,t.maxT,t.n>=t.maxT):""}</div></div>
    ${t.loss>0&&t.pnl<=-t.loss?`<p class="jpw bad">🛑 Llegaste a tu pérdida máxima. Tu plan dice: para por hoy.</p>`:t.goal>0&&t.pnl>=t.goal?`<p class="jpw ok">🎯 Meta cumplida. Cuida lo ganado.</p>`:t.maxT&&t.n>=t.maxT?`<p class="jpw bad">✋ Ya hiciste tus ${t.maxT} operaciones de hoy.</p>`:""}
   </section>
   <section class="jps" id="jflows"><h4>Depósitos y retiros</h4>
    <p class="jf-h">Así el saldo queda igual al de tu broker. No cuentan como ganancia ni pérdida en tus estadísticas.</p>
    <div class="jf-add"><div class="jr-seg big"><button data-fk="1" class="${(view.fk||1)>0?"on jw":""}">＋ Depósito</button><button data-fk="-1" class="${(view.fk||1)<0?"on jl":""}">− Retiro</button></div>
      <input data-fv type="text" inputmode="decimal" placeholder="Monto US$"><input data-fd type="date" value="${today()}" max="${today()}" aria-label="Fecha"><input data-fn type="text" maxlength="60" placeholder="Nota (opcional)"><button class="jr-btn pri" data-fadd>Agregar</button></div>
    ${flowsOf().length?`<div class="jf-list">${flowsOf().slice().sort((x,y)=>y.k<x.k?-1:y.k>x.k?1:y.t-x.t).map(f=>`<div><span>${parse(f.k).getDate()} ${MES[parse(f.k).getMonth()].slice(0,3)} ${parse(f.k).getFullYear()} · ${f.v>0?"Depósito":"Retiro"}${f.note?" · "+esc(f.note):""}</span><b class="${f.v>0?"jw":"jl"}">${f.v>0?"+":"−"}${bal(Math.abs(f.v)).replace("US$ ","$")}</b><button data-fdel="${f.id}" aria-label="Borrar">✕</button></div>`).join("")}</div>`:""}
   </section>
   <section class="jps"><h4>Calculadora de lote</h4>
    <p class="jf-h">Usa el saldo de esta cuenta: ${balV!=null?`<b>${bal(balV)}</b>`:`<button class="jr-lnk" data-eacct>pon el saldo inicial</button> para que se calcule solo`}.</p>
    <div class="jr-seg"><button data-pm="pct" class="${pl.mode!=="usd"?"on":""}">% de la cuenta</button><button data-pm="usd" class="${pl.mode==="usd"?"on":""}">Monto fijo</button></div>
    <label class="jf-l">${pl.mode==="usd"?"Arriesgo por operación (US$)":"Arriesgo por operación (%)"}<input data-pv="${pl.mode==="usd"?"usd":"pct"}" type="text" inputmode="decimal" value="${pl.mode==="usd"?(pl.usd||""):(pl.pct||"")}" placeholder="${pl.mode==="usd"?"5":"1"}"></label>
    <p class="jpr">Arriesgas <b data-rusd>${risk>0?"US$ "+risk.toFixed(2):"—"}</b> por operación</p>
    <label class="jf-l">Puntos hasta tu SL (para calcular aquí)<input data-calc type="text" inputmode="decimal" value="${esc(pts)}" placeholder="Ej: 25"></label>
    <p class="jpr" data-lot>${lot!=null?(lot>=0.01?`Lote <b>${lot.toFixed(2)}</b> en Boom, Crash y sintéticos (1 punto = US$ 1 por lote)`:"El SL está muy lejos: lote menor a 0.01"):"Escribe los puntos para ver el lote"}</p>
    <label class="jpt"><input type="checkbox" class="ntsw" data-lon ${on?"checked":""}><span><b>Mostrar el lote en mis zonas y posiciones</b><small>Al dibujar una zona de compra/venta o una posición, su etiqueta dice el lote exacto.</small></span></label>
   </section>
   <section class="jps"><h4>Reglas del plan</h4>
    <div class="jr-seg"><button data-lm="pct" class="${pl.lossMode!=="usd"?"on":""}">Pérdida máx. en %</button><button data-lm="usd" class="${pl.lossMode==="usd"?"on":""}">en US$</button></div>
    <div class="jpf"><label class="jf-l">Pérdida máxima del día ${pl.lossMode==="usd"?"(US$)":"(% del saldo)"}<input data-pv="loss" type="text" inputmode="decimal" value="${pl.loss||""}" placeholder="${pl.lossMode==="usd"?"10":"3"}"></label>
      <label class="jf-l">Meta del día (US$)<input data-pv="goal" type="text" inputmode="decimal" value="${pl.goal||""}" placeholder="Opcional"></label>
      <label class="jf-l">Máximo de operaciones al día<input data-pv="maxT" type="text" inputmode="numeric" value="${pl.maxT||""}" placeholder="Opcional"></label>
      <label class="jf-l">Riesgo:beneficio mínimo (1:X)<input data-pv="minRR" type="text" inputmode="decimal" value="${pl.minRR||""}" placeholder="Ej: 2"></label></div>
    <p class="jf-h">Te avisamos (con sonido) cuando llegues a la pérdida máxima, a la meta o al máximo de operaciones.</p>
    <span class="jf-l">Mis reglas (lo que debes cumplir antes de entrar)</span>
    <div class="jrl">${pl.rules.map((r,i)=>`<div><span>✓ ${esc(r)}</span><button data-rdel="${i}" aria-label="Quitar regla">✕</button></div>`).join("")||`<small class="jf-h">Ej: "Solo opero en zonas marcadas en 1H", "Espero confirmación en 5m", "No opero después de 2 pérdidas".</small>`}</div>
    <div class="jf-add"><input data-rnew type="text" maxlength="120" placeholder="Escribe una regla y Enter"><button class="jr-btn" data-radd>Agregar</button></div>
   </section></div>`}
function bindPlan(c){const q=s=>c.querySelector(s),qa=s=>c.querySelectorAll(s),pl=planOf();
  qa("[data-fk]").forEach(b=>b.onclick=()=>{view.fk=+b.dataset.fk;qa("[data-fk]").forEach(x=>{const on=+x.dataset.fk===view.fk;x.className=on?"on "+(view.fk>0?"jw":"jl"):""});q("[data-fv]").focus()});
  const fadd=()=>{const v=num(q("[data-fv]").value);if(!v){q("[data-fv]").focus();X.toast("Escribe el monto");return}const k=q("[data-fd]").value||today(),sg=view.fk||1;
    flowsOf().push({id:uid(),k,t:Date.now(),v:+(sg*Math.abs(v)).toFixed(2),note:(q("[data-fn]").value||"").trim()||undefined});X.save();paintAll();
    X.toast(`${sg>0?"Depósito":"Retiro"} de ${bal(Math.abs(v))} agregado. Saldo: ${bal(balNow())}`);const s2=el.querySelector("#jflows");s2&&s2.scrollIntoView({block:"nearest"})};
  q("[data-fadd]").onclick=fadd;q("[data-fv]").onkeydown=e=>{e.stopPropagation();if(e.key==="Enter"){e.preventDefault();fadd()}};
  qa("[data-fdel]").forEach(b=>b.onclick=()=>{const a=acct();a.flows=flowsOf(a).filter(f=>f.id!==b.dataset.fdel);X.save();paintAll()});
  const upd=()=>{X.save();try{X.lotRepaint&&X.lotRepaint()}catch(e){}const bal=balNow(),r=riskUsdOf(pl,bal),ru=q("[data-rusd]");if(ru)ru.textContent=r>0?"US$ "+r.toFixed(2):"—";
    const pts=num((q("[data-calc]")||{}).value||""),lt=q("[data-lot]");if(lt){const lot=r>0&&pts>0?Math.floor(r/pts*100+1e-9)/100:null;lt.innerHTML=lot!=null?(lot>=0.01?`Lote <b>${lot.toFixed(2)}</b> en Boom, Crash y sintéticos (1 punto = US$ 1 por lote)`:"El SL está muy lejos: lote menor a 0.01"):"Escribe los puntos para ver el lote"}};
  qa("[data-pm]").forEach(b=>b.onclick=()=>{pl.mode=b.dataset.pm;X.save();paint()});
  qa("[data-lm]").forEach(b=>b.onclick=()=>{pl.lossMode=b.dataset.lm;X.save();paint()});
  qa("[data-pv]").forEach(i=>i.oninput=()=>{const v=num(i.value);pl[i.dataset.pv]=v!=null&&v>=0?v:0;upd()});
  /* al cambiar una regla solo se actualiza el resumen de hoy (sin redibujar los campos: no se pierde lo que escribes) */
  qa("[data-pv]").forEach(i=>i.onchange=()=>{const j=J();if(j.planN)delete j.planN[j.cur+"|"+today()];X.save();
    const t=document.createElement("div");t.innerHTML=planView();const nw=t.querySelector(".jp .jps"),old=c.querySelector(".jp .jps");if(nw&&old)old.replaceWith(nw);try{planCheck()}catch(e){}});
  const cc=q("[data-calc]");cc&&(cc.oninput=()=>{view.calc=cc.value;upd()});
  const lo=q("[data-lon]");lo&&(lo.onchange=()=>{X.SAVE.risk=Object.assign({},X.SAVE.risk||{},{on:lo.checked});upd();X.toast&&X.toast(lo.checked?"El lote sale en tus zonas y posiciones":"Lote oculto en los dibujos")});
  const add=()=>{const i=q("[data-rnew]"),t=i.value.trim();if(!t)return;pl.rules.push(t.slice(0,120));X.save();paint();const n=el.querySelector("[data-rnew]");n&&n.focus()};
  q("[data-radd]").onclick=add;q("[data-rnew]").onkeydown=e=>{e.stopPropagation();if(e.key==="Enter"){e.preventDefault();add()}};
  qa("[data-rdel]").forEach(b=>b.onclick=()=>{pl.rules.splice(+b.dataset.rdel,1);X.save();paint()})}
function paint(){const j=J();
  el.querySelectorAll("[data-tab]").forEach(b=>{b.classList.toggle("on",b.dataset.tab===view.tab);b.setAttribute("aria-selected",String(b.dataset.tab===view.tab))});
  const sel=el.querySelector("[data-acct]");if(document.activeElement!==sel)sel.innerHTML=j.accts.map(a=>`<option value="${esc(a.id)}"${a.id===j.cur?" selected":""}>${esc(a.name)}</option>`).join("")+`<option value="+">＋ Nueva cuenta…</option>`+(window.EAGMT5B&&window.EAGMT5B.history?`<option value="mt5">⤓ Traer historial de MT5</option>`:"");
  el.querySelector("[data-eye]").classList.toggle("on",!!j.hide);
  const ms=stats(view.y+"-"+pad(view.m+1)+"-01",view.y+"-"+pad(view.m+1)+"-31");
  el.querySelector("[data-mt]").innerHTML=j.min?`${MES[view.m]} <b class="${cls(ms.tot||null)}">${ms.days?money(ms.tot):"—"}</b>`:"";
  if(j.min)return;
  const c=el.querySelector("[data-c]");
  c.innerHTML=edit&&edit.acct?acctForm():edit&&edit.day?dayForm(edit.day):view.tab==="mes"?monthView():view.tab==="sem"?weekView():view.tab==="ano"?yearView():view.tab==="plan"?planView():statsView();
  bind(c)}

function head(){const a=acct(),tot=totalAll(),b=balNow(),st=hasStart(a)?+a.start:0,fp=flowParts(a),inv=st+fp.d;
  return `<div class="jr-acct"><div><small>${esc(a.name)}</small>${b!=null?`<b>${bal(b)}</b><i class="${cls(tot||null)}">Trading ${money(tot)||"$0"}${inv>0?` · ${pct(tot/inv*100)}`:""}</i>
      <i class="jfl">${hasStart(a)?`Inicial ${bal(st)}`:""}${fp.d?` · Depósitos <span class="jw">+${bal(fp.d).replace("US$ ","$")}</span>`:""}${fp.r?` · Retiros <span class="jl">−${bal(fp.r).replace("US$ ","$")}</span>`:""}</i>`
      :`<b class="${cls(tot||null)}">${money(tot)||"$0"}</b><i>Resultado total</i>`}</div>
    <div class="jr-ab"><button class="jr-lnk" data-goflow>± Depósito / retiro</button><button class="jr-lnk" data-eacct>Editar cuenta</button></div></div>`}
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
        <span class="jd">${d}${flowsOf().some(f=>f.k===k)?`<i title="Depósito o retiro">💵</i>`:""}${o&&o.note?`<i class="jnote" title="Tiene notas">✎</i>`:""}${o&&o.mood?`<i>${(MOODS.find(x=>x[0]===o.mood)||[])[1]||""}</i>`:""}</span>
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
  const st=stats(from,to);const a=acct(),base=hasStart(a)||flowsOf(a).length?(+a.start||0)+(from?stats(null,prevKey(from)).tot+flowSum(prevKey(from),a):0):0;
  const pts=[base];let lastK=from?prevKey(from):"";st.P.forEach((v,i)=>{const k=st.ks[i],fl=flowsOf(a).filter(f=>f.k>lastK&&f.k<=k).reduce((x,f)=>x+(+f.v||0),0);lastK=k;pts.push(pts[pts.length-1]+v+fl)});const dpr=devicePixelRatio||1,W=cv.clientWidth||600,H=180;cv.width=W*dpr;cv.height=H*dpr;
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
function dayForm(k){const d=dayGet(k)||{},ops=(d.ops||[]).slice().sort((a,b)=>a.t-b.t),trk=Object.entries(d.trk||{}),A=autoList(d),sum=A.reduce((a,o)=>a+(+o.v||0),0),dt=parse(k),man=d.pnl!=null&&d.pnl!=="";
  const v=man?+d.pnl:null,sign=v!=null?(v<0?-1:1):(edit.sign||1),asg=edit.asg||1,nOps=A.reduce((a,o)=>a+(+o.n||0),0),W=A.filter(o=>o.v>0).length,L=A.filter(o=>o.v<0).length;
  const hm=t=>new Date(t).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});
  return `<div class="jr-nav"><button data-back aria-label="Volver">‹</button><b>${DIAL[dow(dt)]} ${dt.getDate()} de ${MES[dt.getMonth()]} ${dt.getFullYear()}</b></div>
  <div class="jr-form">
    <span class="jf-l">Agrega cada operación (se va sumando y restando sola)</span>
    <div class="jf-add"><div class="jr-seg big"><button data-asg="1" class="${asg>0?"on jw":""}">＋ Ganancia</button><button data-asg="-1" class="${asg<0?"on jl":""}">− Pérdida</button></div>
      <input data-av type="text" inputmode="decimal" placeholder="Monto US$" aria-label="Monto de la operación">
      <input data-asym type="text" maxlength="30" placeholder="Mercado (opcional)" aria-label="Mercado" value="${esc(edit.asym||"")}">
      <button class="jr-btn pri" data-aadd>Agregar</button></div>
    ${A.length?(()=>{const rows=[...ops.map(o=>({t:o.t,v:+o.v||0,n:1,lab:`${o.sym?esc(o.sym):o.src==="mt5"?"":"Operación"}${o.src==="mt5"?(o.sym?" · ":"")+"MT5":""}`,del:`data-delop="${o.t}"`})),
        ...trk.map(([sid,o])=>({t:o.t||+sid,v:+o.v||0,n:o.n,lab:`Marcador · ${o.n} op`,del:`data-deltrk="${esc(sid)}"`}))].sort((a,b)=>a.t-b.t);let run=0;
      return`<div class="jf-list"><div class="jf-lh"><span>Hora · operación</span><span>Monto</span><span>Total del día</span><i></i></div>${rows.map(r=>{run=+(run+r.v).toFixed(2);return`<div><span>${hm(r.t)} · ${r.lab}</span><b class="${cls(r.v)}">${r.v>=0?"+ suma ":"− resta "}${money(Math.abs(r.v)).replace(/^\+/,"")}</b><em class="${cls(run)}">= ${money(run)||"$0"}</em><button ${r.del} aria-label="Borrar">✕</button></div>`}).join("")}
      <div class="jf-sum"><span>Total del día · ${nOps} op${W||L?` · <i class="jw">${W} ganadas</i> / <i class="jl">${L} perdidas</i>`:""}</span><b class="${cls(sum)}">${money(sum)||"$0"}</b></div></div>`})()
      :`<small class="jf-h">Escribe el monto, elige Ganancia o Pérdida y toca Agregar (o Enter). Cada una suma o resta al total del día. Si solo tienes el total del día, agrégalo como una sola operación.</small>`}
    <div class="jf-row"><label class="jf-l">Operaciones (si no las agregas una a una)<input data-n type="number" min="0" step="1" inputmode="numeric" placeholder="${nOps}" value="${d.n!=null&&d.n!==""?d.n:""}"></label>
      <div><span class="jf-l">¿Cómo te sentiste?</span><div class="jr-seg">${MOODS.map(([k2,e,t])=>`<button data-mood="${k2}" class="${d.mood===k2?"on":""}" title="${t}">${e} ${t}</button>`).join("")}</div></div></div>
    <div><span class="jf-l">¿Seguiste tu plan?</span>${(()=>{const R=planOf().rules;return R.length?`<div class="jrl" style="margin:4px 0 8px">${R.map(r=>`<div><span>✓ ${esc(r)}</span></div>`).join("")}</div>`:""})()}<div class="jr-seg">${[[true,"Sí"],[false,"No"]].map(([b,t])=>`<button data-plan="${b}" class="${d.plan===b?"on "+(b?"jw":"jl"):""}">${t}</button>`).join("")}</div></div>
    <label class="jf-l">Notas del día<textarea data-note rows="4" placeholder="Qué viste, por qué entraste, qué aprendiste, errores…">${esc(d.note||"")}</textarea></label>
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
  q("[data-goflow]")&&(q("[data-goflow]").onclick=()=>{view.tab="plan";edit=null;paint();const s2=el.querySelector("#jflows");if(s2){s2.scrollIntoView({block:"start"});const i=s2.querySelector("[data-fv]");i&&i.focus()}});
  q("[data-back]")&&(q("[data-back]").onclick=()=>{edit=null;paint()});
  const eq=q("[data-eq]");eq&&requestAnimationFrame(()=>drawEq(eq));
  if(!edit&&view.tab==="plan")bindPlan(c);
  if(edit&&edit.day){const k=edit.day,D=daysOf();const cur=()=>D[k]=D[k]||{};
    qa("[data-sg]").forEach(b=>b.onclick=()=>{edit.sign=+b.dataset.sg;const i=q("[data-pnl]");const v=num(i.value);if(v!=null){cur().pnl=edit.sign*Math.abs(v)}
      qa("[data-sg]").forEach(x=>{const on=+x.dataset.sg===edit.sign;x.className=on?"on "+(edit.sign>0?"jw":"jl"):""});i.focus()});
    qa("[data-mood]").forEach(b=>b.onclick=()=>{const d=cur();d.mood=d.mood===b.dataset.mood?null:b.dataset.mood;qa("[data-mood]").forEach(x=>x.classList.toggle("on",x.dataset.mood===d.mood))});
    qa("[data-plan]").forEach(b=>b.onclick=()=>{const d=cur(),v=b.dataset.plan==="true";d.plan=d.plan===v?null:v;qa("[data-plan]").forEach(x=>{const on=d.plan===(x.dataset.plan==="true");x.className=on?"on "+(d.plan?"jw":"jl"):""})});
    /* agregar operación: se guarda al instante; antes se guardan las notas y el número escrito para no perderlos */
    const keepForm=()=>{const d=cur(),nt=q("[data-note]"),nn=q("[data-n]");if(nt)d.note=nt.value.trim()||null;if(nn)d.n=nn.value===""?null:Math.max(0,parseInt(nn.value,10)||0)};
    qa("[data-asg]").forEach(b=>b.onclick=()=>{edit.asg=+b.dataset.asg;qa("[data-asg]").forEach(x=>{const on=+x.dataset.asg===edit.asg;x.className=on?"on "+(edit.asg>0?"jw":"jl"):""});q("[data-av]").focus()});
    const addOpNow=()=>{const i=q("[data-av]"),val=num(i.value);if(val==null||!val){i.focus();X.toast("Escribe el monto de la operación");return}
      const d=cur(),now=Date.now(),isT=k===today();let t=isT?now:parse(k).getTime()+12*36e5+((d.ops||[]).length)*6e4;while((d.ops||[]).some(o=>o.t===t))t++;
      const sym=(q("[data-asym]").value||"").trim();edit.asym=sym;keepForm();d.ops=d.ops||[];d.ops.push({v:+((edit.asg||1)*Math.abs(val)).toFixed(2),t,src:"manual",sym:sym||undefined});
      const before=dayPnl(Object.assign({},d,{ops:d.ops.slice(0,-1)}))||0;X.save();paintAll();
      X.toast(`${(edit.asg||1)>0?"Suma":"Resta"} ${money(Math.abs(val)).replace(/^[+−]/,"")}: total del día ${money(before)||"$0"} → ${money(dayPnl(d))}`);const ni=el.querySelector("[data-av]");ni&&ni.focus()};
    q("[data-aadd]").onclick=addOpNow;q("[data-av]").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addOpNow()}};
    qa("[data-deltrk]").forEach(b=>b.onclick=()=>{keepForm();const d=cur();if(d.trk)delete d.trk[b.dataset.deltrk];clean(k);X.save();paintAll()});
    qa("[data-delop]").forEach(b=>b.onclick=()=>{keepForm();const d=cur();d.ops=(d.ops||[]).filter(o=>String(o.t)!==b.dataset.delop);clean(k);X.save();paintAll()});
    q("[data-savek]").onclick=()=>{const d=cur(),i=q("[data-pnl]");if(i){const v=num(i.value),sg=edit.sign||(d.pnl!=null&&+d.pnl<0?-1:1);d.pnl=v==null?null:+(sg*Math.abs(v)).toFixed(2)}const n=q("[data-n]").value;d.n=n===""?null:Math.max(0,parseInt(n,10)||0);
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

window.EAGJournal={init(o){X=o;const j=J();
  /* la calculadora de lote vivía aparte: su saldo y riesgo pasan al plan de la cuenta (una sola vez) */
  if(!j.migRisk){const r=X.SAVE.risk||{},a=j.accts.find(x=>x.id===j.cur)||j.accts[0];if(a&&!a.plan){a.plan=Object.assign({},PLAN0,{mode:r.mode==="usd"?"usd":"pct",pct:+r.pct||1,usd:+r.usd||0})}
    if(a&&(a.start==null||a.start==="")&&+r.bal>0)a.start=+r.bal;j.migRisk=true;setTimeout(()=>X.save(),0)}
  /* el total escrito a mano pasa a ser una operación más ("Total anotado"), así lo que agregues después suma o resta encima */
  if(!j.mig2){for(const a in j.days)for(const k in j.days[a]){const d=j.days[a][k];if(d.pnl==null||d.pnl==="")continue;const au=autoList(d).reduce((x,o)=>x+(+o.v||0),0),base=+(+d.pnl-au).toFixed(2);
    if(Math.abs(base)>.004){d.ops=d.ops||[];let t=parse(k).getTime()+9*36e5;while(d.ops.some(o=>o.t===t))t++;d.ops.push({v:base,t,src:"manual",sym:"Total anotado"})}delete d.pnl}j.mig2=true;setTimeout(()=>X.save(),0)}for(const a in j.days)for(const k in j.days[a]){const d=j.days[a][k];if(d.ops){d.ops=d.ops.filter(op=>op.src);if(!d.ops.length)delete d.ops}}if(J().open)setTimeout(()=>toggle(true),700)},toggle,open:k=>toggle(true,k),
  addOp,removeOp,setSession,sessionIn,
  /* para la calculadora de lote del gráfico: saldo (del journal) y riesgo del plan de la cuenta activa */
  risk:()=>{if(!X)return null;const a=acct(),pl=planOf(a),b=balNow();return{bal:b!=null?b:0,mode:pl.mode,pct:pl.pct,usd:pl.usd,hasBal:b!=null}},
  balance:()=>X?balNow():null,openPlan:()=>{view.tab="plan";edit=null;toggle(true)},today:()=>{const d=dayGet(today());return{pnl:dayPnl(d),n:dayN(d)}},importMT5,_stats:stats,_J:J};
})();
