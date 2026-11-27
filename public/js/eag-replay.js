/* EAG Charts · Replay en el gráfico (como TradingView).
   El replay corre sobre los gráficos normales: todas las herramientas de dibujo, indicadores,
   cambiar de temporalidad o de mercado mientras avanza, y todo el pasado hacia atrás.
   Cómo funciona: hay un "cursor" de tiempo. Los gráficos solo reciben velas hasta ese momento
   (la vela actual se arma con velas de 1 minuto) y al avanzar el cursor se les manda la vela que se va formando. */
(function(){
"use strict";
let X=null,S=null,ui=null,raf=0,lastT=0,keyH=null;
const MIN=60000;
const subs=new Map();          /* gráfico → {t,g,cb,lastB} */
const base=new Map();          /* mercado → {L:[velas 1m], from, to, loading} */
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const TZ="America/Bogota";
const two=n=>String(n).padStart(2,"0");
function tparts(ts){const p=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",weekday:"short"}).formatToParts(new Date(ts)).reduce((a,x)=>(a[x.type]=x.value,a),{});if(p.hour==="24")p.hour="00";return p}
const fdate=ts=>{const p=tparts(ts);return`${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`};
const bucket=(ts,g)=>Math.floor(ts/(g*1000))*g*1000;
const gOf=per=>{try{return X.gran(per)}catch(e){return 60}};

/* ---------- velas de 1 minuto (la "base" con la que se arma todo) ---------- */
async function fetchRange(t,a,b){/* a,b en ms; se pide hacia atrás desde "b" con end+count (lo que mejor responde Deriv para fechas viejas) */
  const out=[];let e=Math.floor(Math.min(b,Date.now())/1000);const s0=Math.floor(a/1000);let guard=0;
  while(e>s0&&guard++<60){const cnt=Math.max(2,Math.min(1000,Math.ceil((e-s0)/60)+1));let m;try{m=await X.feed.ask({ticks_history:t,style:"candles",granularity:60,end:e,count:cnt})}catch(x){break}
    const L=(m.candles||[]).map(c=>({timestamp:c.epoch*1000,open:+c.open,high:+c.high,low:+c.low,close:+c.close,volume:0})).filter(k=>k.timestamp<=e*1000);
    if(!L.length)break;L.forEach(k=>{if(k.timestamp>=s0*1000)out.push(k)});const first=L[0].timestamp/1000;if(first>=e)break;e=first-1;if(L.length<cnt&&first>s0+120)break}
  const seen=new Set();return out.filter(k=>!seen.has(k.timestamp)&&seen.add(k.timestamp)).sort((x,y)=>x.timestamp-y.timestamp)}
async function ensureBase(t,from,to){/* deja cargado [from,to] (ms) */
  let c=base.get(t);to=Math.min(to,Date.now());
  if(c&&c.loading){await c.loading;c=base.get(t)}
  if(c&&from>=c.from&&to<=c.to)return c;
  const job=(async()=>{if(!c||to<c.from||from>c.to+MIN){const L=await fetchRange(t,from,to);c={L,from,to};base.set(t,c);return}
    if(from<c.from){const first=c.L.length?c.L[0].timestamp:Infinity,add=(await fetchRange(t,from,c.from-1)).filter(k=>k.timestamp<first);c.L=add.concat(c.L);c.from=from}
    if(to>c.to){const last=c.L.length?c.L[c.L.length-1].timestamp:c.to;const add=(await fetchRange(t,last+MIN,to)).filter(k=>k.timestamp>last);c.L=c.L.concat(add);c.to=to}})();
  if(c)c.loading=job;else base.set(t,{L:[],from:to,to:to-1,loading:job});
  try{await job}finally{const cc=base.get(t);if(cc)cc.loading=null}
  return base.get(t)}
function prefetch(t){const c=base.get(t);if(!c||c.loading||!S)return;if(c.to-S.cur<300*MIN&&c.to<Date.now()-MIN)ensureBase(t,c.from,c.to+1800*MIN)}
const firstIdx=(L,ts)=>{let lo=0,hi=L.length;while(lo<hi){const m=(lo+hi)>>1;if(L[m].timestamp<ts)lo=m+1;else hi=m}return lo};
/* dentro de 1 minuto el precio recorre apertura → extremo → otro extremo → cierre */
function partialOf(k,f){if(f<=0)return null;if(f>=1)return k;const o=k.open,c=k.close,path=c>=o?[o,k.low,k.high,c]:[o,k.high,k.low,c];
  let L=0;for(let i=1;i<4;i++)L+=Math.abs(path[i]-path[i-1]);let d=f*L,x=o,hi=o,lo=o;
  for(let i=1;i<4;i++){const a=path[i-1],b=path[i],seg=Math.abs(b-a);if(d>=seg){x=b;d-=seg}else{x=a+(b-a)*(seg?d/seg:0);d=0}hi=Math.max(hi,x);lo=Math.min(lo,x);if(d<=0)break}
  return{timestamp:k.timestamp,open:o,high:hi,low:lo,close:x,volume:0}}
/* vela que empieza en bs, armada con lo que pasó hasta "end" */
function aggregate(t,bs,end){const c=base.get(t);if(!c||!c.L.length)return null;const L=c.L;let i=firstIdx(L,bs),out=null;const mEnd=Math.floor(end/MIN)*MIN;
  const add=k=>{if(!out)out={timestamp:bs,open:k.open,high:k.high,low:k.low,close:k.close,volume:0};else{out.high=Math.max(out.high,k.high);out.low=Math.min(out.low,k.low);out.close=k.close}};
  for(;i<L.length&&L[i].timestamp<mEnd;i++)add(L[i]);
  if(i<L.length&&L[i].timestamp===mEnd&&end>mEnd){const p=partialOf(L[i],(end-mEnd)/MIN);p&&add(p)}
  return out}
function priceAt(t,ts){const c=base.get(t);if(!c||!c.L.length)return null;const L=c.L,m=Math.floor(ts/MIN)*MIN;let i=firstIdx(L,m);
  if(i<L.length&&L[i].timestamp===m){const p=partialOf(L[i],(ts-m)/MIN);if(p)return p.close}return i>0?L[i-1].close:L[0].open}

/* ---------- lo que piden los gráficos (lo llama el datafeed de charts-app) ---------- */
let tickNote=0;
async function history(sym,period,from,to,real){
  if(period&&period.timespan==="tick"){if(Date.now()-tickNote>4000){tickNote=Date.now();X.toast("El replay funciona desde 1 minuto. Elige 1m o más.")}return[]}
  const g=gOf(period),cur=S.cur,bs=bucket(cur,g);
  if(to<bs)return real(sym,period,from,to); /* pidiendo más pasado al correr hacia atrás */
  const span=Math.max(g*1000*200,to-from),T=bs-1,F=T-span;
  const [L]=await Promise.all([real(sym,period,F,T),ensureBase(sym.ticker,Math.min(bs,cur-120*MIN),cur+600*MIN)]);
  const out=(L||[]).filter(k=>k.timestamp+g*1000<=bs);
  const pc=aggregate(sym.ticker,bs,cur);if(pc)out.push(pc);
  if(!out.length&&!S.fixing){S.fixN=(S.fixN||0)+1;if(S.fixN<=3){S.fixing=1;const back=(S.fixN===1?20:S.fixN===2?6:2)*86400e3*Math.random()+86400e3;
      X.toast("De esa fecha no llegaron velas: te llevo a una fecha más reciente…");setTimeout(()=>{if(S){S.fixing=0;jump(Date.now()-back)}},300)}
    else if(Date.now()-tickNote>5000){tickNote=Date.now();X.toast("No llegaron velas de Deriv para el replay. Revisa tu conexión y vuelve a intentar.")}}
  else if(out.length)S.fixN=0;
  return out}
function sub(me,sym,period,cb){if(period&&period.timespan==="tick")return;const g=gOf(period);subs.set(me,{t:sym.ticker,g,cb,lastB:bucket(S.cur,g)});ensureBase(sym.ticker,bucket(S.cur,g),S.cur+600*MIN).catch(()=>{})}
function unsub(me){subs.delete(me)}

/* ---------- avanzar el cursor y mandar las velas ---------- */
function push(){let reload=false;
  subs.forEach(s=>{const b=bucket(S.cur,s.g);
    if(b<s.lastB){reload=true;return}
    if(b>s.lastB){const n=(b-s.lastB)/(s.g*1000);if(n>400){reload=true;return}
      for(let x=s.lastB;x<b;x+=s.g*1000){const c=aggregate(s.t,x,x+s.g*1000);if(c)try{s.cb(c)}catch(e){}}s.lastB=b}
    const c=aggregate(s.t,b,S.cur);if(c)try{s.cb(c)}catch(e){}});
  if(reload)reloadAll()}
const panes=()=>{try{return X.panes()||[]}catch(e){return[]}};
const actKc=()=>{const P=panes(),a=X.active?X.active():0;return(P[a]||P[0]||{}).kc};
const mainG=()=>{try{const k=actKc();return Math.max(60,gOf(k.getPeriod()))}catch(e){return 60}};
const mainT=()=>{try{return actKc().getSymbol().ticker}catch(e){return null}};
function reloadAll(){panes().forEach(p=>{try{p.kc.reloadData()}catch(e){}});setTimeout(()=>{applyHide();lines()},700)}
function loadedTo(){let m=Infinity;subs.forEach(s=>{const c=base.get(s.t);m=Math.min(m,c?c.to:S.cur)});const t=mainT(),c=t&&base.get(t);if(c)m=Math.min(m,c.to);return m===Infinity?S.cur:m}
function frame(ts){raf=0;if(!S||!S.play)return;const dt=lastT?Math.min(0.25,(ts-lastT)/1000):0;lastT=ts;
  const lim=loadedTo(),now=Date.now()-MIN;let nx=S.cur+dt*S.spd*mainG()*1000;
  if(nx>=now){S.cur=now;push();setPlay(false);paint();X.toast("Llegaste al presente. Sal del replay para volver al vivo.");return}
  if(nx>lim){nx=lim;S.wait=true}else S.wait=false;
  if(nx>S.cur){S.cur=nx;push();checkSLTP()}
  subs.forEach(s=>prefetch(s.t));paint();raf=requestAnimationFrame(frame)}
function setPlay(on){if(!S)return;S.play=on;if(on){lastT=0;if(!raf)raf=requestAnimationFrame(frame)}else if(raf){cancelAnimationFrame(raf);raf=0}paint()}
async function step(d){if(!S)return;setPlay(false);const g=mainG()*1000;
  if(d>0){const t=mainT();const nx=Math.min(Date.now()-MIN,bucket(S.cur,g/1000)+g);if(t)await ensureBase(t,base.get(t)?base.get(t).from:bucket(S.cur,g/1000),nx+600*MIN);S.cur=nx;push();checkSLTP()}
  else{let nx=bucket(S.cur,g/1000);if(nx>=S.cur-1)nx-=g;S.cur=nx;reloadAll()}
  paint()}
async function jump(ts){if(!S)return;setPlay(false);const t=mainT();let cur=Math.max(0,Math.min(Date.now()-MIN,ts));
  const e=await earliest(t);if(e&&cur<e+120*MIN){cur=e+120*MIN;X.toast("De ese mercado solo hay velas de 1 minuto desde el "+fdate(e).slice(0,10)+". Te llevé a la fecha más vieja disponible.")}
  S.cur=cur;if(t){X.toast("Cargando esa fecha…");const c=await ensureBase(t,S.cur-120*MIN,S.cur+600*MIN);if(!c||!c.L.length)X.toast("No llegaron velas de esa fecha. Prueba otra o revisa tu conexión.")}reloadAll();paint()}

/* ---------- operaciones simuladas con lotaje (dinero, SL/TP, historial que se guarda) ---------- */
/* US$ que mueve 1 lote por cada 1.0 de precio: la mayoría de sintéticos es 1; Step Index 10 */
const csOf=t=>{const m=X.SAVE.rpCS||{};if(m[t]!=null)return+m[t];return/^stpRNG/.test(t||"")?10:1};
const SIM=()=>{X.SAVE.rpSim=Object.assign({lot:0.2,bal0:1000,sl:0,tp:0},X.SAVE.rpSim||{});return X.SAVE.rpSim};
const hist=()=>{X.SAVE.rpHist=Array.isArray(X.SAVE.rpHist)?X.SAVE.rpHist:[];return X.SAVE.rpHist};
const usd=(o,p)=>(p-o.p)*o.d*o.lot*csOf(o.sym);
const balance=()=>SIM().bal0+hist().reduce((a,t)=>a+(+t.usd||0),0);
function curPx(){const t=mainT();return t?priceAt(t,S.cur):null}
const tfNow=()=>{try{return actKc().getPeriod().text}catch(e){return""}};
let seq=0;
/* abrir: a mercado (precio actual) o desde una orden pendiente (precio de la orden) */
function openTr(d,px,o2){if(!S)return;const p=px!=null?px:curPx();if(p==null)return;const sim=SIM(),lot=Math.max(0.01,+((o2&&o2.lot)||sim.lot)||0.01),sl=o2?o2.sl:(+sim.sl>0?sim.sl:0),tp=o2?o2.tp:(+sim.tp>0?sim.tp:0);
  S.pos.push({id:++seq,d,p,t:S.cur,sym:(o2&&o2.sym)||mainT(),lot,sl:sl>0?p-d*sl:null,tp:tp>0?p+d*tp:null,tf:tfNow()});lines();paint()}
function closeTr(id,px,why){if(!S)return;const L=id==null?S.pos.slice():S.pos.filter(o=>o.id===id);let tot=0,tp=0;
  L.forEach(o=>{const p=px!=null?px:priceAt(o.sym,S.cur);if(p==null)return;const pts=(p-o.p)*o.d,v=usd(o,p);tot+=v;tp+=pts;
    const t={d:o.d,lot:o.lot,p0:o.p,p1:p,t0:o.t,t1:S.cur,pts,usd:Math.round(v*100)/100,sym:o.sym,tf:o.tf,why:why||"manual",at:Date.now()};S.trades.push(t);hist().unshift(t);S.pos=S.pos.filter(x=>x!==o)});
  if(!L.length)return;if(hist().length>500)hist().length=500;X.save();lines();paint();
  X.toast(`${why==="tp"?"🎯 Take profit":why==="sl"?"🛑 Stop loss":L.length>1?`Cerraste ${L.length} operaciones`:"Operación cerrada"}: ${tot>=0?"+":""}${money(tot)} (${tp>=0?"+":""}${fp(tp)} pts)`)}
const kNow=t=>aggregate(t,Math.floor(S.cur/MIN)*MIN,S.cur);
function checkSLTP(){if(!S)return;
  /* órdenes pendientes: se activan cuando el precio llega */
  S.pend.slice().forEach(o=>{const k=kNow(o.sym);if(!k)return;const hit=o.up?k.high>=o.p:k.low<=o.p;if(hit){S.pend=S.pend.filter(x=>x!==o);openTr(o.d,o.p,o);X.toast(`✅ Se activó tu ${o.d>0?"compra":"venta"} en ${fp(o.p)}`);try{window.EAGN&&window.EAGN.notify({cat:"trade",icon:"✅",title:`Orden activada · ${o.d>0?"Compra":"Venta"}`,body:`${o.lot} lote en ${fp(o.p)}`,card:false})}catch(e){}}});
  S.pos.slice().forEach(o=>{if(o.sl==null&&o.tp==null)return;const k=kNow(o.sym);if(!k)return;
    if(o.sl!=null&&(o.d>0?k.low<=o.sl:k.high>=o.sl)){closeTr(o.id,o.sl,"sl");return}if(o.tp!=null&&(o.d>0?k.high>=o.tp:k.low<=o.tp))closeTr(o.id,o.tp,"tp")})}
const money=v=>(v<0?"-":"")+"$"+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
/* órdenes marcadas (pendientes) */
function addPend(d,p){if(!S)return;const cur=curPx();if(cur==null||!isFinite(p))return;const sim=SIM();
  S.pend.push({id:++seq,d,p,up:p>cur,lot:Math.max(0.01,+sim.lot||0.01),sl:+sim.sl>0?+sim.sl:0,tp:+sim.tp>0?+sim.tp:0,sym:mainT()});lines();paint();
  X.toast(`📌 ${d>0?"Compra":"Venta"} marcada en ${fp(p)}: se activa sola si el precio llega`)}
function orderPop(anchor){let pp=document.querySelector(".rpo");if(pp){pp.remove();return}const cur=curPx();
  pp=document.createElement("div");pp.className="rpo";pp.innerHTML=`<b>Orden marcada</b><small>Se activa sola cuando el precio llegue (sirve para el cambio de hora o una zona).</small>
    <div class="rpo-r"><button data-od="1" class="on buy">Compra</button><button data-od="-1" class="sell">Venta</button></div>
    <label>Precio<input type="number" step="any" data-op value="${cur!=null?(+cur).toFixed(prec()):""}"></label>
    <button data-opick>🎯 Marcar el precio tocando el gráfico</button>
    <small>Usa el lote ${SIM().lot} y tu SL/TP de la barra.</small>
    <button data-ogo class="gold">Poner orden</button>
    <div class="rpo-l">${S.pend.map(o=>`<div><span class="${o.d>0?"up":"dn"}">${o.d>0?"Compra":"Venta"}</span> ${fp(o.p)} · ${o.lot} lote<button data-ox="${o.id}" title="Cancelar">✕</button></div>`).join("")||""}</div>`;
  document.body.appendChild(pp);const r=anchor.getBoundingClientRect();pp.style.left=Math.max(6,Math.min(innerWidth-pp.offsetWidth-6,r.left-40))+"px";pp.style.top=Math.max(6,r.top-pp.offsetHeight-10)+"px";
  pp.addEventListener("keydown",e=>e.stopPropagation());pp.addEventListener("pointerdown",e=>e.stopPropagation());let d=1;
  pp.querySelectorAll("[data-od]").forEach(b=>b.onclick=()=>{d=+b.dataset.od;pp.querySelectorAll("[data-od]").forEach(x=>x.classList.toggle("on",x===b))});
  pp.querySelector("[data-ogo]").onclick=()=>{const v=parseFloat(pp.querySelector("[data-op]").value);if(!isFinite(v)){X.toast("Escribe el precio de la orden");return}addPend(d,v);pp.remove()};
  pp.querySelectorAll("[data-ox]").forEach(b=>b.onclick=()=>{S.pend=S.pend.filter(o=>o.id!==+b.dataset.ox);lines();paint();pp.remove();orderPop(anchor)});
  pp.querySelector("[data-opick]").onclick=()=>{pp.style.display="none";pricePick(v=>{pp.style.display="";if(v!=null)pp.querySelector("[data-op]").value=(+v).toFixed(prec())})}}
function pricePick(cb){const host=X.grid();if(!host){cb(null);return}const ly=document.createElement("div");ly.className="rppick";ly.innerHTML=`<span>Toca el precio de la orden · Esc para cancelar</span><i class="h"></i>`;host.appendChild(ly);const ln=ly.querySelector("i");
  const val=e=>{for(const ch of (window.__eagCharts||[])){try{const dom=ch.getDom(),r=dom.getBoundingClientRect();if(!r.width||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)continue;const q=ch.convertFromPixel([{x:e.clientX-r.left,y:e.clientY-r.top}],{paneId:"candle_pane"})[0];return q&&q.value}catch(x){}}return null};
  ly.onpointermove=e=>{const r=host.getBoundingClientRect();ln.style.top=(e.clientY-r.top)+"px"};
  const end=v=>{ly.remove();removeEventListener("keydown",kd,true);cb(v)};const kd=e=>{if(e.key==="Escape"){e.stopPropagation();end(null)}};addEventListener("keydown",kd,true);
  ly.onclick=e=>end(val(e))}
/* líneas de entrada, SL, TP y órdenes marcadas en el gráfico */
let lineIds=[];
function lines(){(window.__eagCharts||[]).forEach(c=>{lineIds.forEach(id=>{try{c.removeOverlay(id)}catch(e){}})});lineIds=[];if(!S)return;
  const L=[];S.pos.forEach(o=>{L.push([o.sym,o.p,o.d>0?"#2962ff":"#f23645",[6,4]]);if(o.sl!=null)L.push([o.sym,o.sl,"#f23645",[2,3]]);if(o.tp!=null)L.push([o.sym,o.tp,"#089981",[2,3]])});
  S.pend.forEach(o=>L.push([o.sym,o.p,o.d>0?"#2962ff":"#f23645",[10,4,2,4]]));if(!L.length)return;
  (window.__eagCharts||[]).forEach(c=>{let tk=null;try{const pn=panes().find(p=>p.el&&p.el.contains(c.getDom()));tk=pn&&pn.kc.getSymbol().ticker}catch(e){}
    L.forEach(([sym,v,col,dash])=>{if(tk&&tk!==sym)return;try{const id=c.createOverlay({name:"horizontalStraightLine",points:[{value:v}],lock:true,mode:"normal",styles:{line:{color:col,size:1,style:"dashed",dashedValue:dash}}});if(id)lineIds.push(id)}catch(e){}})})}
function histPanel(){let p=document.querySelector(".rph-pan");if(p){p.remove();return}const H=hist(),n=H.length,w=H.filter(t=>t.usd>0).length,tot=H.reduce((a,t)=>a+t.usd,0),sim=SIM();
  const best=H.reduce((a,t)=>Math.max(a,t.usd),0),worst=H.reduce((a,t)=>Math.min(a,t.usd),0);
  p=document.createElement("div");p.className="rph-pan";p.innerHTML=`<div class="rph-h"><b>Historial de operaciones (replay)</b><button data-hx aria-label="Cerrar">✕</button></div>
    <div class="rph-k"><div><small>Balance</small><b>${money(balance())}</b></div><div><small>Resultado</small><b class="${tot>=0?"up":"dn"}">${tot>=0?"+":""}${money(tot)}</b></div><div><small>Operaciones</small><b>${n}</b></div><div><small>Acierto</small><b>${n?Math.round(w/n*100):0}%</b></div><div><small>Mejor</small><b class="up">${money(best)}</b></div><div><small>Peor</small><b class="dn">${money(worst)}</b></div></div>
    <div class="rph-cfg"><label>Balance inicial <input type="number" min="1" step="1" value="${sim.bal0}" data-b0></label><label>Valor de 1 lote por punto en ${esc(mainT()||"")} <input type="number" min="0.0001" step="any" value="${csOf(mainT())}" data-cs></label></div>
    <div class="rph-t"><table><thead><tr><th>Fecha</th><th>Mercado</th><th>Tipo</th><th>Lote</th><th>Entrada</th><th>Salida</th><th>Puntos</th><th>US$</th></tr></thead><tbody>${H.slice(0,200).map(t=>`<tr><td>${fdate(t.t0)}</td><td>${esc(t.sym)}${t.tf?` <small>${esc(t.tf)}</small>`:""}</td><td>${t.d>0?"Compra":"Venta"}${t.why==="tp"?" 🎯":t.why==="sl"?" 🛑":""}</td><td>${t.lot}</td><td>${fp(t.p0)}</td><td>${fp(t.p1)}</td><td class="${t.pts>=0?"up":"dn"}">${t.pts>=0?"+":""}${fp(t.pts)}</td><td class="${t.usd>=0?"up":"dn"}">${t.usd>=0?"+":""}${money(t.usd)}</td></tr>`).join("")||`<tr><td colspan="8" class="rph-e">Todavía no hay operaciones. Usa Comprar o Vender en la barra del replay.</td></tr>`}</tbody></table></div>
    <div class="rph-f"><button data-hcsv>Descargar CSV</button><button data-hclr>Borrar historial</button></div>`;
  document.body.appendChild(p);p.addEventListener("keydown",e=>e.stopPropagation());
  p.querySelector("[data-hx]").onclick=()=>p.remove();
  p.querySelector("[data-b0]").onchange=e=>{SIM().bal0=Math.max(1,+e.target.value||1000);X.save();p.remove();histPanel();paint()};
  p.querySelector("[data-cs]").onchange=e=>{const t=mainT();if(!t)return;X.SAVE.rpCS=Object.assign({},X.SAVE.rpCS||{},{[t]:Math.max(0.0001,+e.target.value||1)});X.save();paint()};
  p.querySelector("[data-hclr]").onclick=e=>{const b=e.currentTarget;if(!b.dataset.ok){b.dataset.ok=1;b.textContent="Toca otra vez para borrar todo";return}X.SAVE.rpHist=[];X.save();p.remove();histPanel();paint()};
  p.querySelector("[data-hcsv]").onclick=()=>{const rows=[["fecha_entrada","fecha_salida","mercado","temporalidad","tipo","lote","entrada","salida","puntos","usd","cierre"]].concat(H.map(t=>[fdate(t.t0),fdate(t.t1),t.sym,t.tf||"",t.d>0?"compra":"venta",t.lot,t.p0,t.p1,t.pts,t.usd,t.why]));
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}));a.download="replay-operaciones.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}}

/* ---------- ocultar la fecha (para no saber qué pasó ese día) ---------- */
function applyHide(){const h=!!(S&&S.hide);(window.__eagCharts||[]).forEach(c=>{try{c.setStyles({xAxis:{tickText:{show:!h}},crosshair:{vertical:{text:{show:!h}}}})}catch(e){}})}

/* ---------- barra de control ---------- */
const prec=()=>{try{return actKc().getSymbol().pricePrecision||3}catch(e){return 3}};
const fp=v=>v==null?"—":(+v).toLocaleString("en-US",{minimumFractionDigits:prec(),maximumFractionDigits:prec()});
const SPD=[[0.25,"¼×"],[0.5,"½×"],[1,"1×"],[2,"2×"],[3,"3×"],[5,"5×"],[10,"10×"]];
function rpbH(){const h=document.documentElement;if(ui&&ui.isConnected&&!ui.classList.contains("min2"))h.style.setProperty("--rpbh",(ui.offsetHeight+8)+"px");else h.style.removeProperty("--rpbh")}
function build(){ui=document.createElement("div");ui.className="rpb"+(X.isPhone&&X.isPhone()?" mob":"");ui.setAttribute("role","toolbar");ui.setAttribute("aria-label","Replay");
  ui.innerHTML=`<span class="rph" title="Mover">⋮⋮</span>
    <div class="rpm"><b class="rpt"><i class="rpdot"></i>Replay</b><span class="rpd" data-when></span></div>
    <div class="rpg"><button data-rp="pick" title="Elegir en el gráfico desde qué vela empezar">🎯<span>Elegir vela</span></button><button data-rp="date" title="Ir a una fecha">📅<span>Fecha</span></button></div>
    <div class="rpg ctl"><button data-rp="back" title="Vela anterior (Shift + ←)">⏮</button><button data-rp="play" class="play" title="Reproducir / pausar (Shift + espacio)">▶</button><button data-rp="fwd" title="Siguiente vela (Shift + →)">⏭</button>
      <select data-rp="spd" title="Velocidad: velas por segundo de la temporalidad que estás viendo">${SPD.map(([v,t])=>`<option value="${v}"${v===S.spd?" selected":""}>${t}</option>`).join("")}</select></div>
    <div class="rpg tr"><label class="rplot" title="Lotaje de la operación simulada">Lote<input type="number" min="0.01" step="0.01" data-lot value="${SIM().lot}"></label>
      <button data-rp="buy" class="buy">Comprar</button><button data-rp="sell" class="sell">Vender</button><button data-rp="close" class="cls" hidden>Cerrar <b data-pl></b></button>
      <button data-rp="ord" title="Orden marcada: compra o venta que se activa sola si el precio llega">📌<span>Orden</span><em data-npend hidden></em></button><button data-rp="sltp" title="Stop loss y take profit en puntos">SL/TP</button><button data-rp="hist" class="rpbal" title="Historial, balance y ajustes de la simulación"><span data-bal></span></button><span class="rpst" data-st></span></div>
    <div class="rpsl" hidden><label>SL (puntos)<input type="number" min="0" step="any" data-sl value="${SIM().sl||""}" placeholder="sin SL"></label><label>TP (puntos)<input type="number" min="0" step="any" data-tp value="${SIM().tp||""}" placeholder="sin TP"></label><small>Se cierran solos al tocar el precio.</small></div>
    <div class="rpg end"><button data-rp="hide" title="Ocultar la fecha">👁</button><button data-rp="min" title="Minimizar">–</button><button data-rp="exit" class="exit" title="Salir del replay y volver al vivo">Salir</button></div>
    <div class="rpmini"><button data-rp="play2" class="play">▶</button><span data-when2></span><button data-rp="max" title="Abrir la barra">▴</button></div>
    <div class="rpdate" hidden><label>Ir a<input type="datetime-local" data-dt></label><button data-rp="go" class="gold">Ir</button><button data-rp="rnd">Fecha al azar</button></div>`;
  (X.host()||document.body).appendChild(ui);
  const pos=S.xy||(X.SAVE.rpPos||null);if(pos&&!(X.isPhone&&X.isPhone()))place(pos.x,pos.y);
  ui.addEventListener("click",onClick);ui.addEventListener("keydown",e=>e.stopPropagation());
  ui.querySelector("[data-lot]").onchange=e=>{SIM().lot=Math.max(0.01,Math.round((+e.target.value||0.01)*100)/100);e.target.value=SIM().lot;X.save()};
  ui.querySelector("[data-sl]").onchange=e=>{SIM().sl=Math.max(0,+e.target.value||0);X.save()};ui.querySelector("[data-tp]").onchange=e=>{SIM().tp=Math.max(0,+e.target.value||0);X.save()};ui.querySelector("[data-rp=spd]").onchange=e=>{S.spd=+e.target.value;X.SAVE.rpSpd=S.spd;X.save()};
  ui.addEventListener("pointerdown",e=>e.stopPropagation());ui.addEventListener("wheel",e=>e.stopPropagation());
  drag(ui.querySelector(".rph"))}
function place(x,y){const r=ui.getBoundingClientRect(),W=innerWidth,H=innerHeight;x=Math.max(4,Math.min(W-r.width-4,x));y=Math.max(4,Math.min(H-r.height-4,y));ui.style.left=x+"px";ui.style.top=y+"px";ui.style.bottom="auto";ui.style.transform="none";S.xy={x,y}}
function drag(h){h.onpointerdown=e=>{e.preventDefault();const r=ui.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;h.setPointerCapture(e.pointerId);
  h.onpointermove=ev=>place(ev.clientX-ox,ev.clientY-oy);h.onpointerup=()=>{h.onpointermove=null;X.SAVE.rpPos=S.xy;X.save()}}}
function onClick(e){const b=e.target.closest("[data-rp]");if(!b)return;const a=b.dataset.rp;
  if(a==="play"||a==="play2")setPlay(!S.play);else if(a==="fwd")step(1);else if(a==="back")step(-1);
  else if(a==="ord")orderPop(b);
  else if(a==="sltp"){const q=ui.querySelector(".rpsl");q.hidden=!q.hidden}else if(a==="hist")histPanel();
  else if(a==="buy")openTr(1);else if(a==="sell")openTr(-1);else if(a==="close")closeTr(null);
  else if(a==="hide"){S.hide=!S.hide;applyHide();paint()}
  else if(a==="min"){ui.classList.add("min")}else if(a==="max"){ui.classList.remove("min")}
  else if(a==="exit")stop();
  else if(a==="pick")pickMode();
  else if(a==="date"){const d=ui.querySelector(".rpdate");d.hidden=!d.hidden;if(!d.hidden){const p=tparts(S.cur);ui.querySelector("[data-dt]").value=`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`}}
  else if(a==="go"){const v=ui.querySelector("[data-dt]").value;const ts=Date.parse(v+":00-05:00");if(!isFinite(ts))return;if(ts>Date.now()-3600e3){X.toast("Elige una fecha de al menos 1 hora atrás");return}ui.querySelector(".rpdate").hidden=true;jump(ts)}
  else if(a==="rnd"){ui.querySelector(".rpdate").hidden=true;randomTs().then(jump)}}
function paint(){setTimeout(rpbH,0);if(!ui||!S)return;const w=S.hide?"Fecha oculta":fdate(S.cur);ui.querySelector("[data-when]").textContent=w+(S.wait&&S.play?" · cargando…":"");ui.querySelector("[data-when2]").textContent=S.hide?"Replay":fdate(S.cur).slice(-5);
  ui.querySelectorAll("[data-rp=play],[data-rp=play2]").forEach(b=>{b.textContent=S.play?"⏸":"▶";b.classList.toggle("on",S.play)});
  ui.querySelector("[data-rp=hide]").classList.toggle("on",!!S.hide);
  const P=S.pos,cb=ui.querySelector("[data-rp=close]");cb.hidden=!P.length;
  const plOf=o=>{const p=priceAt(o.sym,S.cur);return p==null?0:usd(o,p)},open=P.reduce((a,o)=>a+plOf(o),0);
  if(P.length){const pl=cb.querySelector("[data-pl]");pl.textContent=(P.length>1?P.length+" · ":"")+(open>=0?"+":"")+money(open);pl.className=open>=0?"up":"dn";cb.title=P.map(o=>`${o.d>0?"Compra":"Venta"} ${o.lot} lote en ${fp(o.p)}`).join(" · ")+" — toca para cerrar todo"}
  const np=ui.querySelector("[data-npend]");np.hidden=!S.pend.length;np.textContent=S.pend.length;
  const n=S.trades.length,wn=S.trades.filter(t=>t.usd>0).length,tot=S.trades.reduce((a,t)=>a+t.usd,0),st=ui.querySelector("[data-st]");
  st.innerHTML=n?`${n} op · ${Math.round(wn/n*100)}% · <b class="${tot>=0?"up":"dn"}">${tot>=0?"+":""}${money(tot)}</b>`:"";
  ui.querySelector("[data-bal]").textContent=money(balance()+open);}
/* elegir la vela de inicio tocando el gráfico */
function pickMode(){setPlay(false);const host=X.grid();if(!host)return;X.toast("Toca la vela desde donde quieres empezar el replay");
  const ly=document.createElement("div");ly.className="rppick";ly.innerHTML=`<span>Toca la vela de inicio · Esc para cancelar</span><i></i>`;host.appendChild(ly);const ln=ly.querySelector("i");
  const at=e=>{for(const ch of (window.__eagCharts||[])){try{const dom=ch.getDom(),r=dom.getBoundingClientRect();if(!r.width||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)continue;
      const q=ch.convertFromPixel([{x:e.clientX-r.left,y:e.clientY-r.top}],{paneId:"candle_pane"})[0],L=ch.getDataList();if(!q||!L.length)return null;const i=Math.max(0,Math.min(L.length-1,Math.round(q.dataIndex)));
      const p=panes().find(pp=>pp.el&&pp.el.contains(dom));return{ts:L[i].timestamp,g:p?gOf(p.kc.getPeriod()):mainG()}}catch(x){}}return null};
  ly.onpointermove=e=>{const r=host.getBoundingClientRect();ln.style.left=(e.clientX-r.left)+"px"};
  const end=()=>{ly.remove();removeEventListener("keydown",kd,true)};const kd=e=>{if(e.key==="Escape"){e.stopPropagation();end()}};addEventListener("keydown",kd,true);
  ly.onclick=e=>{const v=at(e);end();if(!v){X.toast("Toca dentro del gráfico");return}jump(v.ts+v.g*1000)}}
/* hasta dónde hay velas de 1 minuto de este mercado (Deriv no guarda todo el pasado en 1 minuto) */
const early=new Map();
async function earliest(t){if(!t)return null;if(early.has(t))return early.get(t);let e=null;
  try{const m=await X.feed.ask({ticks_history:t,style:"candles",granularity:60,start:1,end:"latest",count:1});const c=(m.candles||[])[0];if(c&&c.epoch)e=c.epoch*1000}catch(x){}
  if(e&&e>Date.now()-3*86400e3)e=null; /* respuesta rara: no se usa */
  early.set(t,e);return e}
async function randomTs(t){t=t||mainT();const g=mainG(),days={60:20,120:30,180:40,300:90,600:120,900:200,1800:300,3600:500,7200:600,14400:800,28800:900,86400:1500}[g]||200;
  const now=Date.now(),e=await earliest(t),lo=Math.max(now-days*86400e3,e?e+86400e3:0),hi=now-6*3600e3;
  /* nunca la misma: se evita repetir un día ya visto hace poco */
  const seen=(X.SAVE.rpSeen=X.SAVE.rpSeen||[]);let ts=0;for(let k=0;k<8;k++){ts=lo+Math.random()*Math.max(3600e3,hi-lo);if(!seen.some(d=>Math.abs(d-ts)<86400e3))break}
  seen.unshift(ts);seen.length=Math.min(seen.length,20);X.save();return Math.floor(ts/MIN)*MIN}

/* ---------- empezar / salir ---------- */
async function start(o){o=o||{};if(S){if(o.at)jump(o.at);return}
  const t0=o.sym||mainT();const at0=o.at||await randomTs(t0);
  S={on:true,cur:Math.min(Date.now()-3600e3,at0),play:false,spd:X.SAVE.rpSpd||1,hide:!!o.hide,pos:[],pend:[],trades:[],wait:false,xy:null};
  document.documentElement.classList.add("rp-on");
  try{window.EAGTrade&&window.EAGTrade.isOpen&&window.EAGTrade.isOpen()&&window.EAGTrade.close()}catch(e){}
  build();paint();
  if(o.sym)try{X.setSym(o.sym)}catch(e){}
  if(o.tf)try{const k=actKc(),p=X.perFind(o.tf);p&&k&&k.setPeriod(p)}catch(e){}
  const t=o.sym||mainT();if(t){X.toast("Preparando el replay…");const e=await earliest(t);if(e&&S.cur<e+120*MIN)S.cur=e+120*MIN;const c=await ensureBase(t,S.cur-120*MIN,S.cur+600*MIN);if(!c||!c.L.length)X.toast("No llegaron velas de esa fecha. Usa 📅 para elegir otra.")}
  reloadAll();
  keyH=e=>{if(!S||S.lock)return;const t=e.target;if(t&&/INPUT|TEXTAREA|SELECT/.test(t.tagName))return;if(!e.shiftKey)return;
    if(e.code==="Space"){e.preventDefault();e.stopPropagation();setPlay(!S.play)}else if(e.key==="ArrowRight"){e.preventDefault();e.stopPropagation();step(1)}else if(e.key==="ArrowLeft"){e.preventDefault();e.stopPropagation();step(-1)}};
  addEventListener("keydown",keyH,true);
  if(o.pick)setTimeout(pickMode,900)}
function stop(){if(!S)return;setPlay(false);document.querySelectorAll(".rppick").forEach(e=>e.remove());if(S.pos.length)closeTr(null,null,"salida");S.pend=[];lines();document.querySelector(".rpo")&&document.querySelector(".rpo").remove();const n=S.trades.length;S=null;subs.clear();ui&&ui.remove();ui=null;document.documentElement.classList.remove("rp-on");document.documentElement.style.removeProperty("--rpbh");
  if(keyH)removeEventListener("keydown",keyH,true);keyH=null;applyHide();reloadAll();setTimeout(()=>{try{X.onExit&&X.onExit()}catch(e){}dispatchEvent(new Event("resize"))},80);X.toast(n?`Saliste del replay (${n} operación${n===1?"":"es"} simulada${n===1?"":"s"}). Volviste al vivo.`:"Volviste al vivo.")}

/* entrar al replay desde cualquier lado (gráfico compartido, clase, menú): mismo mercado y temporalidad, y eliges la vela */
function quick(o){o=o||{};const a=X.access?X.access():{ok:true};if(!a.ok){X.openPro&&X.openPro();return}
  if(S){if(o.at)jump(o.at);else pickMode();return}
  let tf=null;try{tf=actKc().getPeriod().text}catch(e){}start({sym:o.sym||mainT(),tf:o.tf||tf,at:o.at||Date.now()-86400e3,pick:!o.at})}
/* ---------- clase en vivo: el alumno sigue el replay del profe (misma fecha, mercado, temporalidad, play y velocidad) ---------- */
let fBusy=false;
async function follow(o){if(!o||fBusy)return;fBusy=true;try{
  if(!S){await start({at:o.cur,sym:o.sym,tf:o.tf});if(!S)return;S.lock=true;lockUI();setPlay(!!o.play);return}
  S.lock=true;lockUI();
  if(o.sym&&o.sym!==mainT()){try{X.setSym(o.sym)}catch(e){}await new Promise(r=>setTimeout(r,700));await jump(o.cur);setPlay(!!o.play);return}
  if(o.tf){try{const k=actKc();if(k&&k.getPeriod().text!==o.tf){const p=X.perFind(o.tf);if(p){k.setPeriod(p);await new Promise(r=>setTimeout(r,500))}}}catch(e){}}
  if(o.spd&&S.spd!==o.spd){S.spd=o.spd;const sel=ui&&ui.querySelector("[data-rp=spd]");if(sel)sel.value=String(o.spd)}
  const G=mainG()*1000,lag=o.play?Math.min(4000,Math.max(0,Date.now()-(o.t||Date.now())))/1000*S.spd*G:0,target=o.cur+lag,dr=Math.abs(S.cur-target);
  if(dr>G*40)await jump(target);else if(dr>G*.6){S.cur=target;push();paint()}
  if(!!o.play!==S.play)setPlay(!!o.play)}finally{fBusy=false}}
function lockUI(){if(!ui)return;ui.classList.toggle("lock",!!(S&&S.lock));const t=ui.querySelector(".rpt");if(t&&S&&S.lock&&!t.dataset.l){t.dataset.l=1;t.innerHTML='<i class="rpdot"></i>Replay del profe'}}
window.EAGReplay={follow,locked:()=>!!(S&&S.lock),info:()=>{if(!S)return null;let tf="";try{tf=actKc().getPeriod().text}catch(e){}return{cur:S.cur,play:S.play,spd:S.spd,sym:mainT(),tf,t:Date.now()}},
  init(ctx){X=ctx},on:()=>!!S,quick,history,sub,unsub,start,stop,jump,step,play:on=>setPlay(on!==false),
  _state:()=>S&&{cur:S.cur,play:S.play,spd:S.spd,trades:S.trades.length,open:S.pos.length,pend:S.pend.length,subs:subs.size,last:S.trades[S.trades.length-1]||null}};
})();
