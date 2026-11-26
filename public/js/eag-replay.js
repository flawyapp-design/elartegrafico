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
async function fetchRange(t,a,b){/* a,b en ms; Deriv da hasta 5000 velas por pedido */
  const out=[];let s=Math.floor(a/1000);const e=Math.floor(Math.min(b,Date.now())/1000);let guard=0;
  while(s<e&&guard++<60){const end=Math.min(e,s+990*60);let m;try{m=await X.feed.ask({ticks_history:t,style:"candles",granularity:60,start:s,end,count:1000,adjust_start_time:1})}catch(x){break}
    const L=(m.candles||[]).map(c=>({timestamp:c.epoch*1000,open:+c.open,high:+c.high,low:+c.low,close:+c.close,volume:0})).filter(k=>k.timestamp>=s*1000&&k.timestamp<=end*1000);
    L.forEach(k=>out.push(k));s=end+1}
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
function reloadAll(){panes().forEach(p=>{try{p.kc.reloadData()}catch(e){}});setTimeout(applyHide,400)}
function loadedTo(){let m=Infinity;subs.forEach(s=>{const c=base.get(s.t);m=Math.min(m,c?c.to:S.cur)});const t=mainT(),c=t&&base.get(t);if(c)m=Math.min(m,c.to);return m===Infinity?S.cur:m}
function frame(ts){raf=0;if(!S||!S.play)return;const dt=lastT?Math.min(0.25,(ts-lastT)/1000):0;lastT=ts;
  const lim=loadedTo(),now=Date.now()-MIN;let nx=S.cur+dt*S.spd*mainG()*1000;
  if(nx>=now){S.cur=now;push();setPlay(false);paint();X.toast("Llegaste al presente. Sal del replay para volver al vivo.");return}
  if(nx>lim){nx=lim;S.wait=true}else S.wait=false;
  if(nx>S.cur){S.cur=nx;push()}
  subs.forEach(s=>prefetch(s.t));paint();raf=requestAnimationFrame(frame)}
function setPlay(on){if(!S)return;S.play=on;if(on){lastT=0;if(!raf)raf=requestAnimationFrame(frame)}else if(raf){cancelAnimationFrame(raf);raf=0}paint()}
async function step(d){if(!S)return;setPlay(false);const g=mainG()*1000;
  if(d>0){const t=mainT();const nx=Math.min(Date.now()-MIN,bucket(S.cur,g/1000)+g);if(t)await ensureBase(t,base.get(t)?base.get(t).from:bucket(S.cur,g/1000),nx+600*MIN);S.cur=nx;push()}
  else{let nx=bucket(S.cur,g/1000);if(nx>=S.cur-1)nx-=g;S.cur=nx;reloadAll()}
  paint()}
async function jump(ts){if(!S)return;setPlay(false);S.cur=Math.max(0,Math.min(Date.now()-MIN,ts));const t=mainT();
  if(t){X.toast("Cargando esa fecha…");await ensureBase(t,S.cur-120*MIN,S.cur+600*MIN)}reloadAll();paint()}

/* ---------- operaciones simuladas ---------- */
function curPx(){const t=mainT();return t?priceAt(t,S.cur):null}
function openTr(d){if(!S||S.open)return;const p=curPx();if(p==null)return;S.open={d,p,t:S.cur,sym:mainT()};paint()}
function closeTr(){if(!S||!S.open)return;const p=priceAt(S.open.sym,S.cur);if(p==null)return;const o=S.open,pts=(p-o.p)*o.d;S.trades.push({d:o.d,p0:o.p,p1:p,t0:o.t,t1:S.cur,pts,sym:o.sym});S.open=null;paint()}

/* ---------- ocultar la fecha (para no saber qué pasó ese día) ---------- */
function applyHide(){const h=!!(S&&S.hide);(window.__eagCharts||[]).forEach(c=>{try{c.setStyles({xAxis:{tickText:{show:!h}},crosshair:{vertical:{text:{show:!h}}}})}catch(e){}})}

/* ---------- barra de control ---------- */
const prec=()=>{try{return actKc().getSymbol().pricePrecision||3}catch(e){return 3}};
const fp=v=>v==null?"—":(+v).toLocaleString("en-US",{minimumFractionDigits:prec(),maximumFractionDigits:prec()});
const SPD=[[0.25,"¼×"],[0.5,"½×"],[1,"1×"],[2,"2×"],[3,"3×"],[5,"5×"],[10,"10×"]];
function build(){ui=document.createElement("div");ui.className="rpb"+(X.isPhone&&X.isPhone()?" mob":"");ui.setAttribute("role","toolbar");ui.setAttribute("aria-label","Replay");
  ui.innerHTML=`<span class="rph" title="Mover">⋮⋮</span>
    <div class="rpm"><b class="rpt"><i class="rpdot"></i>Replay</b><span class="rpd" data-when></span></div>
    <div class="rpg"><button data-rp="pick" title="Elegir en el gráfico desde qué vela empezar">🎯<span>Elegir vela</span></button><button data-rp="date" title="Ir a una fecha">📅<span>Fecha</span></button></div>
    <div class="rpg ctl"><button data-rp="back" title="Vela anterior (Shift + ←)">⏮</button><button data-rp="play" class="play" title="Reproducir / pausar (Shift + espacio)">▶</button><button data-rp="fwd" title="Siguiente vela (Shift + →)">⏭</button>
      <select data-rp="spd" title="Velocidad: velas por segundo de la temporalidad que estás viendo">${SPD.map(([v,t])=>`<option value="${v}"${v===S.spd?" selected":""}>${t}</option>`).join("")}</select></div>
    <div class="rpg tr"><button data-rp="buy" class="buy">Comprar</button><button data-rp="sell" class="sell">Vender</button><button data-rp="close" class="cls" hidden>Cerrar <b data-pl></b></button><span class="rpst" data-st title="Operaciones · ganadas · puntos"></span></div>
    <div class="rpg end"><button data-rp="hide" title="Ocultar la fecha">👁</button><button data-rp="min" title="Minimizar">–</button><button data-rp="exit" class="exit" title="Salir del replay y volver al vivo">Salir</button></div>
    <div class="rpmini"><button data-rp="play2" class="play">▶</button><span data-when2></span><button data-rp="max" title="Abrir la barra">▴</button></div>
    <div class="rpdate" hidden><label>Ir a<input type="datetime-local" data-dt></label><button data-rp="go" class="gold">Ir</button><button data-rp="rnd">Fecha al azar</button></div>`;
  (X.host()||document.body).appendChild(ui);
  const pos=S.pos||(X.SAVE.rpPos||null);if(pos&&!(X.isPhone&&X.isPhone()))place(pos.x,pos.y);
  ui.addEventListener("click",onClick);ui.querySelector("[data-rp=spd]").onchange=e=>{S.spd=+e.target.value;X.SAVE.rpSpd=S.spd;X.save()};
  ui.addEventListener("pointerdown",e=>e.stopPropagation());ui.addEventListener("wheel",e=>e.stopPropagation());
  drag(ui.querySelector(".rph"))}
function place(x,y){const r=ui.getBoundingClientRect(),W=innerWidth,H=innerHeight;x=Math.max(4,Math.min(W-r.width-4,x));y=Math.max(4,Math.min(H-r.height-4,y));ui.style.left=x+"px";ui.style.top=y+"px";ui.style.bottom="auto";ui.style.transform="none";S.pos={x,y}}
function drag(h){h.onpointerdown=e=>{e.preventDefault();const r=ui.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;h.setPointerCapture(e.pointerId);
  h.onpointermove=ev=>place(ev.clientX-ox,ev.clientY-oy);h.onpointerup=()=>{h.onpointermove=null;X.SAVE.rpPos=S.pos;X.save()}}}
function onClick(e){const b=e.target.closest("[data-rp]");if(!b)return;const a=b.dataset.rp;
  if(a==="play"||a==="play2")setPlay(!S.play);else if(a==="fwd")step(1);else if(a==="back")step(-1);
  else if(a==="buy")openTr(1);else if(a==="sell")openTr(-1);else if(a==="close")closeTr();
  else if(a==="hide"){S.hide=!S.hide;applyHide();paint()}
  else if(a==="min"){ui.classList.add("min")}else if(a==="max"){ui.classList.remove("min")}
  else if(a==="exit")stop();
  else if(a==="pick")pickMode();
  else if(a==="date"){const d=ui.querySelector(".rpdate");d.hidden=!d.hidden;if(!d.hidden){const p=tparts(S.cur);ui.querySelector("[data-dt]").value=`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`}}
  else if(a==="go"){const v=ui.querySelector("[data-dt]").value;const ts=Date.parse(v+":00-05:00");if(!isFinite(ts))return;if(ts>Date.now()-3600e3){X.toast("Elige una fecha de al menos 1 hora atrás");return}ui.querySelector(".rpdate").hidden=true;jump(ts)}
  else if(a==="rnd"){ui.querySelector(".rpdate").hidden=true;jump(randomTs())}}
function paint(){if(!ui||!S)return;const w=S.hide?"Fecha oculta":fdate(S.cur);ui.querySelector("[data-when]").textContent=w+(S.wait&&S.play?" · cargando…":"");ui.querySelector("[data-when2]").textContent=S.hide?"Replay":fdate(S.cur).slice(-5);
  ui.querySelectorAll("[data-rp=play],[data-rp=play2]").forEach(b=>{b.textContent=S.play?"⏸":"▶";b.classList.toggle("on",S.play)});
  ui.querySelector("[data-rp=hide]").classList.toggle("on",!!S.hide);
  const op=S.open,cb=ui.querySelector("[data-rp=close]");cb.hidden=!op;ui.querySelector("[data-rp=buy]").hidden=ui.querySelector("[data-rp=sell]").hidden=!!op;
  if(op){const p=priceAt(op.sym,S.cur),v=p==null?0:(p-op.p)*op.d,pl=cb.querySelector("[data-pl]");pl.textContent=(v>=0?"+":"")+fp(v);pl.className=v>=0?"up":"dn";cb.title=`${op.d>0?"Compra":"Venta"} en ${fp(op.p)}`}
  const n=S.trades.length,wn=S.trades.filter(t=>t.pts>0).length,pts=S.trades.reduce((a,t)=>a+t.pts,0),st=ui.querySelector("[data-st]");
  st.innerHTML=n?`${n} op · ${Math.round(wn/n*100)}% · <b class="${pts>=0?"up":"dn"}">${pts>=0?"+":""}${fp(pts)}</b>`:"";}
/* elegir la vela de inicio tocando el gráfico */
function pickMode(){setPlay(false);const host=X.grid();if(!host)return;X.toast("Toca la vela desde donde quieres empezar el replay");
  const ly=document.createElement("div");ly.className="rppick";ly.innerHTML=`<span>Toca la vela de inicio · Esc para cancelar</span><i></i>`;host.appendChild(ly);const ln=ly.querySelector("i");
  const at=e=>{for(const ch of (window.__eagCharts||[])){try{const dom=ch.getDom(),r=dom.getBoundingClientRect();if(!r.width||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)continue;
      const q=ch.convertFromPixel([{x:e.clientX-r.left,y:e.clientY-r.top}],{paneId:"candle_pane"})[0],L=ch.getDataList();if(!q||!L.length)return null;const i=Math.max(0,Math.min(L.length-1,Math.round(q.dataIndex)));
      const p=panes().find(pp=>pp.el&&pp.el.contains(dom));return{ts:L[i].timestamp,g:p?gOf(p.kc.getPeriod()):mainG()}}catch(x){}}return null};
  ly.onpointermove=e=>{const r=host.getBoundingClientRect();ln.style.left=(e.clientX-r.left)+"px"};
  const end=()=>{ly.remove();removeEventListener("keydown",kd,true)};const kd=e=>{if(e.key==="Escape"){e.stopPropagation();end()}};addEventListener("keydown",kd,true);
  ly.onclick=e=>{const v=at(e);end();if(!v){X.toast("Toca dentro del gráfico");return}jump(v.ts+v.g*1000)}}
function randomTs(){const g=mainG(),days={60:20,120:30,180:40,300:90,600:120,900:200,1800:300,3600:500,7200:600,14400:800,28800:900,86400:1500}[g]||200;return Date.now()-(2+Math.random()*days)*86400e3}

/* ---------- empezar / salir ---------- */
async function start(o){o=o||{};if(S){if(o.at)jump(o.at);return}
  S={on:true,cur:Math.min(Date.now()-3600e3,o.at||randomTs()),play:false,spd:X.SAVE.rpSpd||1,hide:!!o.hide,open:null,trades:[],wait:false,pos:null};
  document.documentElement.classList.add("rp-on");
  try{window.EAGTrade&&window.EAGTrade.isOpen&&window.EAGTrade.isOpen()&&window.EAGTrade.close()}catch(e){}
  build();paint();
  if(o.sym)try{X.setSym(o.sym)}catch(e){}
  if(o.tf)try{const k=actKc(),p=X.perFind(o.tf);p&&k&&k.setPeriod(p)}catch(e){}
  const t=o.sym||mainT();if(t){X.toast("Preparando el replay…");await ensureBase(t,S.cur-120*MIN,S.cur+600*MIN)}
  reloadAll();
  keyH=e=>{if(!S)return;const t=e.target;if(t&&/INPUT|TEXTAREA|SELECT/.test(t.tagName))return;if(!e.shiftKey)return;
    if(e.code==="Space"){e.preventDefault();e.stopPropagation();setPlay(!S.play)}else if(e.key==="ArrowRight"){e.preventDefault();e.stopPropagation();step(1)}else if(e.key==="ArrowLeft"){e.preventDefault();e.stopPropagation();step(-1)}};
  addEventListener("keydown",keyH,true);
  if(o.pick)setTimeout(pickMode,900)}
function stop(){if(!S)return;setPlay(false);const n=S.trades.length;S=null;subs.clear();ui&&ui.remove();ui=null;document.documentElement.classList.remove("rp-on");
  if(keyH)removeEventListener("keydown",keyH,true);keyH=null;applyHide();reloadAll();X.toast(n?`Saliste del replay (${n} operación${n===1?"":"es"} simulada${n===1?"":"s"}). Volviste al vivo.`:"Volviste al vivo.")}

window.EAGReplay={init(ctx){X=ctx},on:()=>!!S,history,sub,unsub,start,stop,jump,step,play:on=>setPlay(on!==false),
  _state:()=>S&&{cur:S.cur,play:S.play,spd:S.spd,trades:S.trades.length,open:!!S.open,subs:subs.size}};
})();
