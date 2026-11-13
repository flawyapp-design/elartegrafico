/* © El Arte Gráfico. Todos los derechos reservados. */
/* EAG Charts — plataforma de gráficos en vivo para miembros.
   Gráfico: KLineChart Pro (Apache-2.0) · Datos: API pública de Deriv por WebSocket. */
(function(){
"use strict";
const CFG=window.AG_CONFIG||{},API=window.AGAPI;
const $=(s,r=document)=>r.querySelector(s),esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const PROD=/(^|\.)elartegrafico\.com$/.test(location.hostname);
const MAIN=PROD?"https://elartegrafico.com/":"index.html",ACAD=PROD?"https://academia.elartegrafico.com/":"index.html";
const TZ="America/Bogota";
const LS="eag_charts_v1";
const load=()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}")||{}}catch(e){return{}}};
const SAVE=load();const save=()=>{try{localStorage.setItem(LS,JSON.stringify(SAVE))}catch(e){}};

/* ===================== Idioma ===================== */
const ES={
  indicator:"Indicadores",main_indicator:"Indicador principal",sub_indicator:"Indicador secundario",setting:"Ajustes",timezone:"Zona horaria",screenshot:"Captura",full_screen:"Pantalla completa",exit_full_screen:"Salir de pantalla completa",save:"Guardar",confirm:"Aceptar",cancel:"Cancelar",
  ma:"MA (media móvil)",ema:"EMA (media exponencial)",sma:"SMA",boll:"BOLL (Bandas de Bollinger)",bbi:"BBI",sar:"SAR parabólico",vol:"VOL (volumen)",macd:"MACD",kdj:"KDJ",rsi:"RSI",bias:"BIAS",brar:"BRAR",cci:"CCI",dmi:"DMI",cr:"CR",psy:"PSY",dma:"DMA",trix:"TRIX",obv:"OBV",vr:"VR",wr:"Williams %R",mtm:"Momentum",emv:"EMV",roc:"ROC",pvt:"PVT",ao:"Awesome Oscillator",
  utc:"UTC",honolulu:"Honolulu",juneau:"Juneau",los_angeles:"Los Ángeles",chicago:"Chicago",toronto:"Toronto",sao_paulo:"São Paulo",london:"Londres",berlin:"Berlín",bahrain:"Baréin",dubai:"Dubái",ashkhabad:"Asjabad",almaty:"Almaty",bangkok:"Bangkok",shanghai:"Shanghái",tokyo:"Tokio",sydney:"Sídney",norfolk:"Norfolk",
  horizontal_straight_line:"Línea horizontal",horizontal_ray_line:"Rayo horizontal",horizontal_segment:"Segmento horizontal",vertical_straight_line:"Línea vertical",vertical_ray_line:"Rayo vertical",vertical_segment:"Segmento vertical",straight_line:"Línea extendida",ray_line:"Rayo",segment:"Segmento (línea de tendencia)",arrow:"Flecha",price_line:"Línea de precio",price_channel_line:"Canal de precio",parallel_straight_line:"Canal paralelo",
  fibonacci_line:"Retroceso de Fibonacci",fibonacci_segment:"Segmento de Fibonacci",fibonacci_circle:"Círculo de Fibonacci",fibonacci_spiral:"Espiral de Fibonacci",fibonacci_speed_resistance_fan:"Abanico de Fibonacci",fibonacci_extension:"Extensión de Fibonacci",gann_box:"Caja de Gann",
  rect:"Rectángulo (zona)",parallelogram:"Paralelogramo",circle:"Círculo",triangle:"Triángulo",three_waves:"Tres ondas",five_waves:"Cinco ondas",eight_waves:"Ocho ondas",any_waves:"Ondas libres",abcd:"Patrón ABCD",xabcd:"Patrón XABCD",weak_magnet:"Imán débil",strong_magnet:"Imán fuerte",
  symbol_search:"Buscar mercado",symbol_code:"Código",
  candle_type:"Tipo de vela",candle_solid:"Velas rellenas",candle_stroke:"Velas huecas",candle_up_stroke:"Huecas al alza",candle_down_stroke:"Huecas a la baja",ohlc:"Barras OHLC",area:"Área",
  last_price_show:"Mostrar último precio",high_price_show:"Mostrar máximo",low_price_show:"Mostrar mínimo",indicator_last_value_show:"Mostrar último valor del indicador",
  price_axis_type:"Tipo de eje de precio",normal:"Normal",percentage:"Porcentaje",log:"Logarítmico",reverse_coordinate:"Invertir eje",grid_show:"Mostrar cuadrícula",restore_default:"Restaurar valores",
  period:"Periodo",standard_deviation:"Desviación estándar",params_1:"Parámetro 1",params_2:"Parámetro 2",params_3:"Parámetro 3",params_4:"Parámetro 4",params_5:"Parámetro 5"
};
["BIAS","EMA","MA","RSI","WR"].forEach(k=>{for(let i=1;i<=5;i++)ES[k+i]=k+i});
const ES_CORE={time:"Hora: ",open:"Apertura: ",high:"Máx: ",low:"Mín: ",close:"Cierre: ",volume:"Volumen: ",turnover:"Monto: ",change:"Cambio: "};

/* ===================== Temporalidades (las que entrega Deriv) ===================== */
const PERIODS=[
  {multiplier:1,timespan:"minute",text:"1m"},{multiplier:2,timespan:"minute",text:"2m"},{multiplier:3,timespan:"minute",text:"3m"},{multiplier:5,timespan:"minute",text:"5m"},
  {multiplier:10,timespan:"minute",text:"10m"},{multiplier:15,timespan:"minute",text:"15m"},{multiplier:30,timespan:"minute",text:"30m"},
  {multiplier:1,timespan:"hour",text:"1H"},{multiplier:2,timespan:"hour",text:"2H"},{multiplier:4,timespan:"hour",text:"4H"},{multiplier:8,timespan:"hour",text:"8H"},
  {multiplier:1,timespan:"day",text:"1D"}];
const gran=p=>p.multiplier*({minute:60,hour:3600,day:86400,week:604800}[p.timespan]||60);
const perOf=t=>PERIODS.find(p=>p.text===t)||PERIODS[0];

/* ===================== Datos de Deriv (WebSocket) ===================== */
const APPID=CFG.DERIV_APP_ID||1089;
const ENDPOINTS=["wss://api.derivws.com/trading/v1/options/ws/public",`wss://ws.derivws.com/websockets/v3?app_id=${APPID}&l=ES`];
function Feed(onStatus){
  let ws=null,ep=0,opened=false,backoff=1000,rid=1,ping=null;
  const pend=new Map(),subs=new Map(),byRid=new Map(),queue=[];
  const st=s=>{try{onStatus(s)}catch(e){}};
  function connect(){
    st("conn");opened=false;
    try{ws=new WebSocket(ENDPOINTS[ep])}catch(e){return retry()}
    ws.onopen=()=>{opened=true;window.EAG_EP=ENDPOINTS[ep];backoff=1000;st("live");
      queue.length=0;pend.forEach(p=>ws.send(p.t));
      subs.forEach(s=>sendSub(s));
      clearInterval(ping);ping=setInterval(()=>{if(ws&&ws.readyState===1)ws.send('{"ping":1}')},25000)};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}
      const r=m.req_id||(m.echo_req&&m.echo_req.req_id);
      if(r&&pend.has(r)){const p=pend.get(r);pend.delete(r);m.error?p.rej(new Error(m.error.message||m.error.code)):p.res(m);return}
      const s=r&&byRid.get(r);if(!s)return;
      if(m.error){s.err&&s.err(m.error);return}
      const sid=(m.subscription&&m.subscription.id)||(m.ohlc&&m.ohlc.id)||(m.tick&&m.tick.id);if(sid)s.id=sid;
      s.on(m)};
    ws.onclose=()=>{clearInterval(ping);
      if(!opened)ep=(ep+1)%ENDPOINTS.length;st("off");retry()};
    ws.onerror=()=>{};
  }
  function retry(){setTimeout(connect,backoff);backoff=Math.min(backoff*2,15000)}
  function raw(o){const t=JSON.stringify(o);if(ws&&ws.readyState===1)ws.send(t)}
  function ask(o,ms=25000){const id=rid++;return new Promise((res,rej)=>{const t=JSON.stringify(Object.assign({},o,{req_id:id}));pend.set(id,{res,rej,t});if(ws&&ws.readyState===1)ws.send(t);
    setTimeout(()=>{if(pend.has(id)){pend.delete(id);rej(new Error("Tiempo de espera agotado"))}},ms)})}
  function sendSub(s){if(s.rid)byRid.delete(s.rid);s.rid=rid++;s.id=null;byRid.set(s.rid,s);raw(Object.assign({},s.req,{req_id:s.rid,subscribe:1}))}
  function sub(key,req,on,err){unsub(key);const s={key,req,on,err};subs.set(key,s);sendSub(s)}
  function unsub(key){const s=subs.get(key);if(!s)return;subs.delete(key);byRid.delete(s.rid);if(s.id)raw({forget:s.id})}
  connect();
  return{ask,sub,unsub,has:k=>subs.has(k)};
}

/* ===================== Mercados ===================== */
const FALLBACK=["BOOM1000","BOOM900","BOOM600","BOOM500","BOOM300N","CRASH1000","CRASH900","CRASH600","CRASH500","CRASH300N"].map(s=>({symbol:s,display_name:s.replace(/(BOOM|CRASH)(\d+)N?/,(a,b,c)=>(b==="BOOM"?"Boom ":"Crash ")+c+" Index"),market:"synthetic_index",market_display_name:"Índices sintéticos",submarket:"crash_index",submarket_display_name:"Boom/Crash",pip:0.001,exchange_is_open:1}));
const SUBN={crash_index:"Boom/Crash",random_index:"Volatilidad",jump_index:"Jump",step_index:"Step",range_index:"Range Break",random_daily:"Daily Reset",forex_basket:"Canasta forex",commodity_basket:"Canasta materias primas",major_pairs:"Forex mayores",minor_pairs:"Forex menores",metals:"Metales",non_stable_coin:"Cripto",americas_OTC:"Índices América",asia_oceania_OTC:"Índices Asia/Oceanía",europe_OTC:"Índices Europa"};
const norm=s=>({symbol:s.symbol||s.underlying_symbol,display_name:s.display_name||s.underlying_symbol_name||s.symbol||s.underlying_symbol,market:s.market,submarket:s.submarket,submarket_display_name:SUBN[s.submarket]||s.submarket_display_name||s.submarket,pip:s.pip||s.pip_size,exchange_is_open:s.exchange_is_open,is_trading_suspended:s.is_trading_suspended});
const TABS=[["fav","★ Favoritos"],["bc","Boom/Crash"],["syn","Sintéticos"],["fx","Forex"],["cr","Cripto"],["cm","Materias primas"],["ix","Índices"]];
const tabOf=s=>s.submarket==="crash_index"?"bc":s.market==="synthetic_index"?"syn":s.market==="forex"?"fx":s.market==="cryptocurrency"?"cr":s.market==="commodities"?"cm":"ix";
const prec=pip=>{const s=String(pip||0.01);return s.includes("e-")?+s.split("e-")[1]:(s.split(".")[1]||"").length};
const info=s=>({ticker:s.symbol,name:s.display_name,shortName:s.display_name,exchange:s.submarket_display_name||s.market_display_name||"Deriv",market:s.market,pricePrecision:prec(s.pip),volumePrecision:0,type:s.submarket||""});
const bcOrder=s=>{const m=s.symbol.match(/^(BOOM|CRASH)(\d+)/);return m?(m[1]==="BOOM"?0:1)*1e5-(+m[2]):9e9};

/* ===================== Arranque ===================== */
const app=$("#app");
const gate=(h1,p,btns)=>{app.innerHTML=`<div class="gate"><img src="assets/logo_circle.webp" alt=""><h1>${h1}</h1><p>${p}</p><div class="row">${btns}</div></div>`};
(async function(){
  try{await API.init()}catch(e){}
  if(!API.user())return gate("EAG Charts","Gráficos en vivo de Boom y Crash, sintéticos, forex y más, con herramientas de análisis. Ingresa con tu cuenta de El Arte Gráfico.",`<a class="btn gold" href="${MAIN}#entrar">Ingresar</a><a class="btn" href="${MAIN}#registro">Crear cuenta</a>`);
  if(!(API.isPremium()||API.isAdmin()))return gate("Exclusivo para miembros","EAG Charts está incluido en los planes de El Arte Gráfico. Activa tu plan y vuelve a esta página.",`<a class="btn gold" href="${MAIN}#premium">Ver planes</a><a class="btn" href="${ACAD}">Ir a la academia</a>`);
  if(!window.klinecharts||!window.EAGWidget)return gate("No se pudo cargar","Revisa tu conexión y recarga la página.",`<button class="btn gold" onclick="location.reload()">Recargar</button>`);
  start();
})();

function start(){
  const KP=window.klinechartspro,KC=window.klinecharts;
  try{KP.loadLocales("es-ES",ES)}catch(e){}
  try{KC.registerLocale&&KC.registerLocale("es-ES",ES_CORE)}catch(e){}
  const prof=API.profile()||{};
  const R=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.3"/>`;
  const LAYS=[["l1",1,R(1,1,16,12),"1 gráfico"],["l2",2,R(1,1,7,12)+R(10,1,7,12),"2 gráficos lado a lado"],["l2v",2,R(1,1,16,5)+R(1,8,16,5),"2 gráficos uno sobre otro"],
    ["l3",3,R(1,1,7,12)+R(10,1,7,5)+R(10,8,7,5),"3 gráficos"],["l4",4,R(1,1,7,5)+R(10,1,7,5)+R(1,8,7,5)+R(10,8,7,5),"4 gráficos"],
    ["l6",6,R(1,1,4.3,5)+R(6.85,1,4.3,5)+R(12.7,1,4.3,5)+R(1,8,4.3,5)+R(6.85,8,4.3,5)+R(12.7,8,4.3,5),"6 gráficos"],
    ["mtf",1,R(1,1,16,7.5)+R(1,10,4.3,3)+R(6.85,10,4.3,3)+R(12.7,10,4.3,3),"Multitemporalidad: un mercado en todas tus temporalidades"]];
  const mobile=()=>innerWidth<=900;
  const ICON={eye:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    list:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    caret:'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    plus:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'};
  app.innerHTML=`<div class="app" id="appw">
    <header class="top" id="top">
      <a class="brand" href="${ACAD}" title="Volver a la academia"><img src="assets/logo_circle.webp" alt=""><b>EAG <span>Charts</span></b></a>
      <div class="lay" role="group" aria-label="Distribución">${LAYS.map(([k,n,svg,t])=>`<button data-l="${k}" class="${(n>2||k==="l2")&&k!=="mtf"?"dk":""}${k==="mtf"?" mtfb":""}" title="${t}"><svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.4">${svg}</svg>${k==="mtf"?'<span class="t">Multi-TF</span>':""}</button>`).join("")}</div>
      <span class="st" id="st"><i></i><span>Conectando…</span></span>
      <span class="grow"></span>
      <span class="who">${esc(prof.username||"")}</span>
      <button class="btn ic" id="cfgb" title="Ajustes del gráfico: tema, fondo, cuadrícula, velas"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span class="t">Ajustes</span></button>
      <button class="btn ic" id="vb" title="Mostrar u ocultar barras">${ICON.eye}<span class="t">Vista</span></button>
      <button class="btn ic" id="wlb" title="Lista de mercados">${ICON.list}<span class="t">Mercados</span></button>
    </header>
    <div class="main" id="main">
      <div class="center"><nav class="ftabs" id="ftabs" aria-label="Mercados favoritos"></nav><div class="grid" id="grid"></div></div>
      <aside class="wl" id="wl">
        <div class="wlh"><h3>Mercados</h3><button class="x" id="wlx" title="Ocultar lista">×</button></div>
        <input id="q" type="search" placeholder="Buscar: Boom, Crash, EUR/USD…" autocomplete="off">
        <div class="tabs" id="tabs">${TABS.map(([k,t])=>`<button data-t="${k}">${t}</button>`).join("")}</div>
        <div class="list" id="list"><p style="color:var(--dim);padding:8px">Cargando mercados…</p></div>
        <div class="foot">Datos en vivo de Deriv, solo para análisis educativo. No es asesoría financiera. Compara siempre con tu plataforma antes de operar.</div>
      </aside>
    </div>
    <button class="fab" id="fab" title="Mostrar barras">${ICON.eye}</button>
    <div class="pop" id="pop" hidden></div>
  </div>`;

  const appw=$("#appw"),stEl=$("#st"),main=$("#main"),list=$("#list"),q=$("#q"),ftabs=$("#ftabs"),pop=$("#pop");
  const feed=Feed(s=>{stEl.className="st "+(s==="live"?"live":s==="off"?"err":"");stEl.lastChild.textContent=s==="live"?"En vivo":s==="off"?"Reconectando…":"Conectando…"});
  const relayout=()=>requestAnimationFrame(()=>{window.dispatchEvent(new Event("resize"));mtfResize()});

  /* ---------- mercados ---------- */
  let SYMS=FALLBACK.slice(),bySym={};
  const idx=()=>{bySym={};SYMS.forEach(s=>bySym[s.symbol]=s)};idx();
  const ready=feed.ask({active_symbols:"brief"}).then(m=>{const a=(m.active_symbols||[]).map(norm).filter(s=>s.symbol&&!s.is_trading_suspended);if(a.length){SYMS=a;idx()}}).catch(()=>{});
  const findInfo=t=>bySym[t]?info(bySym[t]):{ticker:t,name:t,shortName:t,exchange:"Deriv",pricePrecision:3,volumePrecision:0};
  const short=s=>String((bySym[s]||{}).display_name||s).replace(/ Index$/,"");

  const hub=new Map();
  function hubOn(k,who,sym,g,cb){let h=hub.get(k);
    if(!h){h=new Map();hub.set(k,h);feed.sub("c:"+k,{ticks_history:sym,style:"candles",granularity:g,end:"latest",count:1},m=>{
      const o=m.ohlc;if(!o)return;const d={timestamp:(+o.open_time)*1000,open:+o.open,high:+o.high,low:+o.low,close:+o.close,volume:0};hub.get(k)&&hub.get(k).forEach(f=>{try{f(d)}catch(e){}})},()=>{})}
    h.set(who,cb)}
  function hubOff(k,who){const h=hub.get(k);if(!h)return;h.delete(who);if(!h.size){hub.delete(k);feed.unsub("c:"+k)}}
  const toK=c=>({timestamp:c.epoch*1000,open:+c.open,high:+c.high,low:+c.low,close:+c.close,volume:0});
  let paneSeq=0;
  function Datafeed(){
    const me="p"+(++paneSeq)+":";
    return{
      async searchSymbols(q){await ready;q=String(q||"").trim().toLowerCase();
        return SYMS.filter(s=>!q||s.symbol.toLowerCase().includes(q)||String(s.display_name).toLowerCase().includes(q)).sort((a,b)=>tabOf(a).localeCompare(tabOf(b))||bcOrder(a)-bcOrder(b)).slice(0,200).map(info)},
      async getHistoryKLineData(sym,period,from,to){
        const g=gran(period),end=Math.floor(Math.min(to,Date.now())/1000),start=Math.max(1,Math.floor(from/1000));
        if(end<=start)return[];
        try{const m=await feed.ask({ticks_history:sym.ticker,style:"candles",granularity:g,start,end,count:5000,adjust_start_time:1});return(m.candles||[]).map(toK)}
        catch(e){console.warn("[EAG] historial",sym.ticker,e.message);return[]}},
      subscribe(sym,period,cb){hubOn(sym.ticker+":"+gran(period),me,sym.ticker,gran(period),cb)},
      unsubscribe(sym,period){hubOff(sym.ticker+":"+gran(period),me)}
    }
  }

  /* ---------- qué se ve y qué no ---------- */
  const PARTS=[["top","Barra superior"],["pb","Barra de temporalidades y herramientas"],["db","Barra de dibujo"],["ft","Pestañas de mercados favoritos"],["wl","Lista de mercados"]];
  SAVE.hide=SAVE.hide&&typeof SAVE.hide==="object"?SAVE.hide:{};
  function applyHide(){PARTS.forEach(([k])=>appw.classList.toggle("h-"+k,!!SAVE.hide[k]));relayout()}
  const allHidden=()=>PARTS.every(([k])=>SAVE.hide[k]);
  function openVista(anchor){
    pop.innerHTML=`<div class="ph">Vista</div>${PARTS.map(([k,t])=>`<label class="sw"><input type="checkbox" data-k="${k}" ${SAVE.hide[k]?"":"checked"}><i></i><span>${t}</span></label>`).join("")}
      <div class="pbtns"><button class="btn sm" data-a="clean">${allHidden()?"Mostrar todo":"Modo limpio"}</button> <button class="btn sm" data-a="cfg">Ajustes del gráfico</button></div>`;
    pop.querySelector('[data-a="cfg"]').onclick=()=>openCfg(anchor);
    pop.querySelectorAll("input").forEach(i=>i.onchange=()=>{SAVE.hide[i.dataset.k]=!i.checked;save();applyHide();openVista(anchor)});
    pop.querySelector('[data-a="clean"]').onclick=()=>{const all=!allHidden();PARTS.forEach(([k])=>SAVE.hide[k]=all);save();applyHide();closePop()};
    showPop(anchor,"right")}
  $("#vb").onclick=e=>{e.stopPropagation();pop.hidden||pop.dataset.for!=="vista"?(openVista($("#vb")),pop.dataset.for="vista"):closePop()};
  $("#fab").onclick=e=>{e.stopPropagation();openVista($("#fab"));pop.dataset.for="vista"};
  function showPop(anchor,align){pop.hidden=false;const r=anchor.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
    let x=align==="right"?r.right-w:r.left;x=Math.max(8,Math.min(x,innerWidth-w-8));let y=r.bottom+6;if(y+h>innerHeight-8)y=Math.max(8,r.top-h-6);
    pop.style.left=x+"px";pop.style.top=y+"px"}
  function closePop(){pop.hidden=true;pop.dataset.for=""}
  document.addEventListener("pointerdown",e=>{if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest("#vb,#fab,#cfgb,.tfdd"))closePop()});
  addEventListener("keydown",e=>{if(e.key==="Escape")closePop()});

  /* ---------- temporalidades: lista desplegable + favoritas ---------- */
  SAVE.tfFav=Array.isArray(SAVE.tfFav)&&SAVE.tfFav.length?SAVE.tfFav:["1m","5m","15m","1H","4H","1D"];
  const TFN={minute:["minuto","minutos"],hour:["hora","horas"],day:["día","días"]};
  const tfName=p=>p.multiplier+" "+TFN[p.timespan][p.multiplier>1?1:0];
  const tfOrder=t=>PERIODS.findIndex(p=>p.text===t);
  function openTF(pane,anchor){
    const cur=(()=>{try{return pane.kc.getPeriod().text}catch(e){return""}})();
    const grp=[["Minutos","minute"],["Horas","hour"],["Días","day"]];
    pop.innerHTML=grp.map(([g,ts])=>`<div class="ph">${g}</div>`+PERIODS.filter(p=>p.timespan===ts).map(p=>`<div class="tfr${p.text===cur?" on":""}" data-t="${p.text}"><span>${tfName(p)}</span><button class="st2${SAVE.tfFav.includes(p.text)?" on":""}" data-f="${p.text}" title="${SAVE.tfFav.includes(p.text)?"Quitar de favoritas":"Agregar a favoritas"}">${SAVE.tfFav.includes(p.text)?"★":"☆"}</button></div>`).join("")).join("")
      +`<div class="pnote">Las ★ favoritas salen en la barra y en Multitemporalidad.</div>`;
    pop.querySelectorAll(".tfr").forEach(r=>r.onclick=e=>{
      const f=e.target.closest("[data-f]");
      if(f){const t=f.dataset.f;SAVE.tfFav=SAVE.tfFav.includes(t)?SAVE.tfFav.filter(x=>x!==t):SAVE.tfFav.concat(t).sort((a,b)=>tfOrder(a)-tfOrder(b));save();decorateAll();if(lay==="mtf")buildMTF();openTF(pane,anchor);return}
      try{pane.kc.setPeriod(perOf(r.dataset.t))}catch(x){}closePop();afterTF()});
    pop.dataset.for="tf";showPop(anchor,"left")}
  const decorateAll=()=>panes.forEach(p=>{try{p.kc.refreshBar()}catch(e){}});
  const afterTF=()=>setTimeout(()=>{decorateAll();mtfMark()},30);

  /* ---------- gráficos ---------- */
  const DEF=["BOOM1000","CRASH1000","BOOM500","CRASH500","BOOM300N","CRASH300N"];
  SAVE.panes=Array.isArray(SAVE.panes)?SAVE.panes:[];
  const grid=$("#grid"),panes=[];let active=0;
  const UP="#35c4a2",DN="#ec5b52",NC="#93a1c4";
  /* ---------- ajustes del gráfico (tema, fondo, cuadrícula, velas…) ---------- */
  const CDEF={theme:"dark",bg:"",grid:true,up:UP,dn:DN,type:"candle_solid",last:true,hl:true,cross:true,wm:true,axis:true};
  SAVE.cfg=Object.assign({},CDEF,SAVE.cfg||{});
  const CF=()=>SAVE.cfg,light=()=>CF().theme==="light";
  const barOf=()=>{const c=CF();return{upColor:c.up,downColor:c.dn,noChangeColor:NC,upBorderColor:c.up,downBorderColor:c.dn,noChangeBorderColor:NC,upWickColor:c.up,downWickColor:c.dn,noChangeWickColor:NC}};
  const styFor=()=>{const c=CF(),gc=light()?"rgba(15,26,51,.08)":"rgba(31,50,102,.55)";
    return{grid:{show:!!c.grid,horizontal:{show:!!c.grid,color:gc},vertical:{show:!!c.grid,color:gc}},
      candle:{type:c.type,bar:barOf(),area:{lineColor:c.up},priceMark:{last:{show:!!c.last,upColor:c.up,downColor:c.dn},high:{show:!!c.hl},low:{show:!!c.hl}}},
      crosshair:{show:!!c.cross},xAxis:{show:!!c.axis},yAxis:{show:!!c.axis}}};
  const BGS=["#060b1a","#000000","#131722","#0b1d17","#1a1033","#ffffff","#f5f1e6","#eef3fb"];
  function applyCfg(){const c=CF();
    appw.classList.toggle("light",light());appw.classList.toggle("h-wm",!c.wm);
    appw.style.setProperty("--chartbg",c.bg||(light()?"#ffffff":"#060b1a"));
    panes.forEach(p=>{try{if(p.kc.getTheme()!==c.theme)p.kc.setTheme(c.theme)}catch(e){}setTimeout(()=>{try{p.kc.setStyles(styFor())}catch(e){}},40)});
    if(mtf)mtf.minis.forEach(m=>{try{m.c.setStyles({candle:{bar:barOf()}})}catch(e){}})}
  function openCfg(anchor){const c=CF();
    const tg=(k,t)=>`<label class="sw"><input type="checkbox" data-k="${k}" ${c[k]?"checked":""}><i></i><span>${t}</span></label>`;
    const TYPES=[["candle_solid","Velas"],["candle_stroke","Huecas"],["ohlc","Barras"],["area","Área"]];
    pop.innerHTML=`<div class="ph">Tema</div><div class="seg">${[["dark","Oscuro"],["light","Claro"]].map(([v,t])=>`<button data-th="${v}" class="${c.theme===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="ph">Fondo del gráfico</div><div class="sws">${BGS.map(b=>`<button class="swc${(c.bg||"")===b?" on":""}" data-bg="${b}" style="background:${b}" title="${b}"></button>`).join("")}<label class="swc pick" title="Otro color"><input type="color" data-bgp value="${c.bg||(light()?"#ffffff":"#060b1a")}">+</label><button class="swc auto${c.bg?"":" on"}" data-bg="" title="Según el tema">A</button></div>
      <div class="ph">Velas</div><div class="seg">${TYPES.map(([v,t])=>`<button data-ty="${v}" class="${c.type===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="cols"><label>Alcista <input type="color" data-col="up" value="${c.up}"></label><label>Bajista <input type="color" data-col="dn" value="${c.dn}"></label></div>
      <div class="ph">Mostrar</div>${tg("grid","Cuadrícula")}${tg("axis","Ejes de precio y hora")}${tg("last","Línea del último precio")}${tg("hl","Máximo y mínimo visibles")}${tg("cross","Cruz del cursor")}${tg("wm","Marca de agua")}
      <div class="pbtns"><button class="btn sm" data-a="reset">Restaurar valores</button></div>
      <div class="pnote">Indicadores, zona horaria, escala logarítmica y más ajustes: íconos de la barra del gráfico.</div>`;
    const set=(k,v)=>{SAVE.cfg[k]=v;save();applyCfg();openCfg(anchor)};
    pop.querySelectorAll("[data-th]").forEach(b=>b.onclick=()=>{SAVE.cfg.bg="";set("theme",b.dataset.th)});
    pop.querySelectorAll("[data-bg]").forEach(b=>b.onclick=()=>set("bg",b.dataset.bg));
    pop.querySelector("[data-bgp]").onchange=e=>set("bg",e.target.value);
    pop.querySelectorAll("[data-ty]").forEach(b=>b.onclick=()=>set("type",b.dataset.ty));
    pop.querySelectorAll("[data-col]").forEach(i=>i.onchange=()=>set(i.dataset.col,i.value));
    pop.querySelectorAll(".sw input").forEach(i=>i.onchange=()=>set(i.dataset.k,i.checked));
    pop.querySelector('[data-a="reset"]').onclick=()=>{SAVE.cfg=Object.assign({},CDEF);save();applyCfg();openCfg(anchor)};
    pop.dataset.for="cfg";showPop(anchor,"right")}
  function makePane(i){
    const el=document.createElement("div");el.className="pane";el.innerHTML='<div class="kc"></div>';grid.appendChild(el);
    const sv=SAVE.panes[i]||{},sym=sv.s||DEF[i%DEF.length],per=perOf(sv.p||(i===0?"5m":"1m"));
    const p={el,kc:null};
    const kc=window.EAGWidget({container:el.firstChild,symbol:findInfo(sym),period:per,datafeed:Datafeed(),theme:CF().theme,timezone:TZ,
      indicators:sv.ind,magnet:SAVE.magnet,lastTools:SAVE.lastTools,
      getFavTF:()=>SAVE.tfFav,
      onPickTF:t=>{kc.setPeriod(perOf(t));afterTF()},
      onTFClick:a=>{setActive(i);pop.hidden||pop.dataset.for!=="tf"?openTF(p,a):closePop()},
      onSymbolClick:()=>{setActive(i);q.value="";if(mobile())main.classList.add("wlopen");else if(SAVE.hide.wl){SAVE.hide.wl=false;save();applyHide()}renderList();q.focus()},
      onSettings:a=>{pop.hidden||pop.dataset.for!=="cfg"?openCfg(a):closePop()},
      onIndicators:d=>{SAVE.panes[i]=Object.assign({},SAVE.panes[i],{ind:d});save()},
      onMagnet:m=>{SAVE.magnet=m;save()},onLastTools:t=>{SAVE.lastTools=t;save()},
      onDrawingsChange:tk=>panes.forEach(q2=>{if(q2!==p&&q2.kc&&q2.kc.getSymbol().ticker===tk)q2.kc.reloadDrawings()})});
    p.kc=kc;
    setTimeout(()=>{try{kc.setStyles(styFor())}catch(e){}},0);
    el.addEventListener("pointerdown",()=>{if(active!==i)setActive(i)},true);
    return p;
  }
  const curSym=i=>{try{return panes[i].kc.getSymbol().ticker}catch(e){return null}};
  function setActive(i){active=i;panes.forEach((p,j)=>p.el.classList.toggle("act",j===i&&visible()>1));paintList();paintTabs()}
  const visible=()=>(LAYS.find(l=>l[0]===lay)||LAYS[0])[1];
  let lay=SAVE.layout&&LAYS.some(l=>l[0]===SAVE.layout)?SAVE.layout:"l1";
  function setLayout(k){
    if(mobile()&&!["l1","l2v","mtf"].includes(k))k="l1";
    lay=k;SAVE.layout=k;save();const n=visible();
    grid.className="grid "+k;
    while(panes.length<n)panes.push(makePane(panes.length));
    panes.forEach((p,j)=>p.el.style.display=j<n?"":"none");
    document.querySelectorAll(".lay button").forEach(b=>b.classList.toggle("on",b.dataset.l===k));
    if(active>=n)active=0;
    k==="mtf"?buildMTF():destroyMTF();
    setActive(active);relayout();
  }
  document.querySelectorAll(".lay button").forEach(b=>b.onclick=()=>setLayout(b.dataset.l));
  function setSym(s){const p=panes[active];if(!p)return;p.kc.setSymbol(findInfo(s));SAVE.panes[active]=Object.assign({},SAVE.panes[active],{s});save();
    setTimeout(()=>{if(lay==="mtf"&&active===0)buildMTF();paintList();paintTabs()},60)}

  /* ---------- multitemporalidad ---------- */
  let mtf=null;
  const MINI=()=>({grid:{show:false},candle:{bar:barOf(),tooltip:{showRule:"none"},priceMark:{high:{show:false},low:{show:false},last:{show:true,line:{show:true,style:"dashed",size:1},text:{show:false}}}},
    xAxis:{show:false},yAxis:{show:false},crosshair:{show:false},separator:{size:0}});
  function destroyMTF(){if(!mtf)return;mtf.minis.forEach(m=>{hubOff(m.key,m.who);try{KC.dispose(m.mc)}catch(e){}});mtf.el.remove();mtf=null}
  function buildMTF(){
    destroyMTF();const sym=(()=>{try{return panes[0].kc.getSymbol()}catch(e){return findInfo(DEF[0])}})();
    const el=document.createElement("div");el.className="mtfrow";el.style.setProperty("--n",SAVE.tfFav.length);grid.appendChild(el);
    mtf={el,sym:sym.ticker,minis:[]};
    SAVE.tfFav.forEach((t,i)=>{const per=perOf(t),g=gran(per);
      const box=document.createElement("div");box.className="mini";box.innerHTML=`<button class="mh" title="Ver ${tfName(per)} en el gráfico grande"><b>${t}</b><span class="mp"></span><em></em><i class="mz">⤢</i></button><span class="mc" title="Toca o desliza hacia arriba: ver en grande · rueda o pellizco: acercar · arrastra a los lados: mover"></span>`;el.appendChild(box);
      const mc=box.querySelector(".mc"),c=KC.init(mc,{locale:"es-ES",timezone:TZ,styles:MINI()});
      try{c.setPriceVolumePrecision(sym.pricePrecision||3,0);c.setScrollEnabled(true);c.setZoomEnabled(true);c.setOffsetRightDistance(6)}catch(e){}
      const m={t,box,mc,c,key:sym.ticker+":"+g,who:"mtf"+i+":"+Date.now()};mtf.minis.push(m);
      feed.ask({ticks_history:sym.ticker,style:"candles",granularity:g,end:"latest",count:60}).then(r=>{if(!mtf||!mtf.minis.includes(m))return;const L=(r.candles||[]).map(toK);c.applyNewData(L);fit(m);m.live(L[L.length-1])}).catch(()=>{});
      const mp=box.querySelector(".mp");
      const live=d=>{if(!d)return;const ch=(d.close-d.open)/d.open*100;mp.innerHTML=`${(+d.close).toFixed(sym.pricePrecision||3)} <i class="${ch>=0?"up":"dn"}">${ch>=0?"▲":"▼"}${Math.abs(ch).toFixed(2)}%</i>`;
        box.classList.remove("tick");void box.offsetWidth;box.classList.add("tick")};
      m.live=live;
      hubOn(m.key,m.who,sym.ticker,g,d=>{try{c.updateData(d);live(d)}catch(e){}});
      const big=()=>{try{panes[0].kc.setPeriod(per)}catch(e){}afterTF();box.classList.add("flyup");setTimeout(()=>box.classList.remove("flyup"),450)};box.querySelector(".mh").onclick=big;
      /* gesto: deslizar hacia arriba (o un toque simple) pasa esta temporalidad al gráfico grande */
      let g0=null;
      mc.addEventListener("pointerdown",e=>{g0={x:e.clientX,y:e.clientY,t:Date.now()}},true);
      addEventListener("pointermove",e=>{if(!g0)return;const dy=e.clientY-g0.y,dx=e.clientX-g0.x;box.classList.toggle("lift",dy<-14&&Math.abs(dy)>Math.abs(dx));box.style.setProperty("--lift",Math.max(-40,Math.min(0,dy))+"px")});
      addEventListener("pointerup",e=>{if(!g0)return;const dy=e.clientY-g0.y,dx=e.clientX-g0.x,quick=Date.now()-g0.t<350;g0=null;box.classList.remove("lift");box.style.removeProperty("--lift");
        if((dy<-30&&Math.abs(dy)>Math.abs(dx)*1.2)||(quick&&Math.abs(dx)<5&&Math.abs(dy)<5))big()});
      addEventListener("pointercancel",()=>{g0=null;box.classList.remove("lift")})});
    mtfMark();relayout()}
  function fit(m){try{const w=m.mc.clientWidth||200;m.c.resize();m.c.setBarSpace(Math.max(1.5,(w-14)/60))}catch(e){}}
  function mtfResize(){if(mtf)mtf.minis.forEach(m=>{try{m.c.resize()}catch(e){}})}
  function mtfMark(){if(!mtf)return;let cur="";try{cur=panes[0].kc.getPeriod().text}catch(e){}
    mtf.minis.forEach(m=>{const on=m.t===cur;m.box.classList.toggle("on",on);m.box.querySelector("em").textContent=on?"Seleccionada":""})}

  /* recordar mercado y temporalidad de cada gráfico; mantener la barra decorada */
  setInterval(()=>{let ch=false;panes.forEach((p,j)=>{try{const s=p.kc.getSymbol().ticker,t=p.kc.getPeriod().text,o=SAVE.panes[j]||{};if(o.s!==s||o.p!==t){SAVE.panes[j]=Object.assign({},o,{s,p:t});ch=true}}catch(e){}});
    if(ch){decorateAll();save();paintList();paintTabs();if(mtf&&curSym(0)!==mtf.sym)buildMTF();else mtfMark()}},700);

  /* ---------- panel de mercados y pestañas de favoritos ---------- */
  SAVE.fav=Array.isArray(SAVE.fav)?SAVE.fav:["BOOM1000","CRASH1000","BOOM500","CRASH500"];
  let tab=SAVE.tab||"bc",shown=[];const last={},dayOpen={},dir={};
  const toggleFav=s=>{SAVE.fav=SAVE.fav.includes(s)?SAVE.fav.filter(x=>x!==s):SAVE.fav.concat(s);save();renderList();renderTabs()};
  $("#wlb").onclick=()=>{if(mobile())main.classList.toggle("wlopen");else{SAVE.hide.wl=!SAVE.hide.wl;save();applyHide()}};
  $("#wlx").onclick=()=>{if(mobile())main.classList.remove("wlopen");else{SAVE.hide.wl=true;save();applyHide()}};
  function setTab(t){tab=t;SAVE.tab=t;save();document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.t===t));renderList()}
  document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{q.value="";setTab(b.dataset.t)});
  q.oninput=()=>renderList();
  const fmt=(v,s)=>v==null?"—":(+v).toFixed(prec(s.pip));
  const chg=s=>{const v=last[s],o=dayOpen[s];return v!=null&&o?(v-o)/o*100:null};
  function renderList(){
    const k=q.value.trim().toLowerCase();
    let a=k?SYMS.filter(s=>s.symbol.toLowerCase().includes(k)||String(s.display_name).toLowerCase().includes(k)):tab==="fav"?SAVE.fav.map(x=>bySym[x]).filter(Boolean):SYMS.filter(s=>tabOf(s)===tab);
    a=a.slice().sort((x,y)=>tab==="fav"&&!k?0:(bcOrder(x)-bcOrder(y))||String(x.display_name).localeCompare(y.display_name)).slice(0,60);
    shown=a.map(s=>s.symbol);
    list.innerHTML=a.length?a.map(s=>`<div class="sy" data-s="${esc(s.symbol)}"><b>${SAVE.fav.includes(s.symbol)?'<span class="fv on" title="Quitar de favoritos">★</span>':'<span class="fv" title="Agregar a favoritos">☆</span>'} ${esc(s.display_name)}</b><span class="p" data-p></span><small>${esc(s.symbol)}${s.exchange_is_open===0?" · cerrado":""}</small><span class="c" data-c></span></div>`).join("")
      :`<p style="color:var(--dim);padding:8px">${tab==="fav"?"Toca ☆ en cualquier mercado para agregarlo aquí.":"No hay mercados con ese nombre."}</p>`;
    list.querySelectorAll(".sy").forEach(r=>{r.onclick=e=>{const s=r.dataset.s;
      if(e.target.classList.contains("fv"))return toggleFav(s);
      setSym(s);if(mobile())main.classList.remove("wlopen")}});
    paintList();watch();
  }
  function paintList(){
    const cur=new Set();for(let j=0;j<visible();j++){const s=curSym(j);s&&cur.add(s)}
    const act=curSym(active);
    list.querySelectorAll(".sy").forEach(r=>{const s=r.dataset.s;r.classList.toggle("on",s===act);r.style.boxShadow=cur.has(s)&&s!==act?"inset 3px 0 0 rgba(216,176,98,.5)":"";paintRow(r)})}
  function paintRow(r){const s=r.dataset.s,i=bySym[s]||{},c=chg(s),pe=r.querySelector("[data-p]"),ce=r.querySelector("[data-c]");
    pe.textContent=fmt(last[s],i);pe.className="p "+(dir[s]||"");if(c!=null){ce.textContent=(c>=0?"+":"")+c.toFixed(2)+"%";ce.className="c "+(c>=0?"up":"dn")}else ce.textContent=""}
  function renderTabs(){
    ftabs.innerHTML=SAVE.fav.map(s=>`<div class="ft" data-s="${esc(s)}" role="button" tabindex="0" title="${esc((bySym[s]||{}).display_name||s)}"><span class="dot"></span><b>${esc(short(s))}</b><span class="p" data-p></span><span class="c" data-c></span><button class="x" title="Quitar de favoritos">×</button></div>`).join("")
      +`<button class="ft add" id="ftadd" title="Agregar mercado a favoritos">${ICON.plus}<span>${SAVE.fav.length?"":"Agrega tus mercados favoritos"}</span></button>`;
    ftabs.querySelectorAll(".ft[data-s]").forEach(t=>t.onclick=e=>{const s=t.dataset.s;if(e.target.closest(".x"))return toggleFav(s);setSym(s)});
    $("#ftadd").onclick=()=>{q.value="";if(mobile())main.classList.add("wlopen");else if(SAVE.hide.wl){SAVE.hide.wl=false;save();applyHide()}setTab(tab==="fav"?"bc":tab);q.focus()};
    paintTabs();watch()}
  function paintTabs(){const act=curSym(active);
    ftabs.querySelectorAll(".ft[data-s]").forEach(t=>{const s=t.dataset.s,c=chg(s);t.classList.toggle("on",s===act);
      t.querySelector("[data-p]").textContent=fmt(last[s],bySym[s]||{});t.querySelector("[data-p]").className="p "+(dir[s]||"");
      const ce=t.querySelector("[data-c]");if(c!=null){ce.textContent=(c>=0?"▲ ":"▼ ")+Math.abs(c).toFixed(2)+"%";ce.className="c "+(c>=0?"up":"dn")}else ce.textContent="";
      t.querySelector(".dot").className="dot "+(c==null?"":c>=0?"up":"dn")})}
  /* precios en vivo: favoritos + mercados visibles en la lista */
  let watching=new Set(),wt=null;
  const rowOf=s=>list.querySelector(`.sy[data-s="${CSS.escape(s)}"]`);
  function onPrice(s){const r=rowOf(s);r&&paintRow(r);if(SAVE.fav.includes(s))paintTabs()}
  function watch(){clearTimeout(wt);wt=setTimeout(()=>{
    const want=new Set(SAVE.fav.concat(shown.slice(0,40)));
    watching.forEach(s=>{if(!want.has(s)){feed.unsub("tick:"+s);watching.delete(s)}});
    want.forEach(s=>{if(watching.has(s))return;watching.add(s);
      feed.sub("tick:"+s,{ticks:s},m=>{if(m.tick){const prev=last[s];last[s]=+m.tick.quote;if(prev!=null)dir[s]=last[s]>prev?"up":last[s]<prev?"dn":dir[s];onPrice(s)}},()=>{});
      if(dayOpen[s]==null)feed.ask({ticks_history:s,style:"candles",granularity:86400,end:"latest",count:1}).then(m=>{const c=(m.candles||[])[0];if(c){dayOpen[s]=+c.open;if(last[s]==null)last[s]=+c.close;onPrice(s)}}).catch(()=>{});
    })},250)}

  $("#cfgb").onclick=e=>{e.stopPropagation();pop.hidden||pop.dataset.for!=="cfg"?openCfg($("#cfgb")):closePop()};
  applyHide();applyCfg();setLayout(lay);setTab(tab);renderTabs();
  ready.then(()=>{setTab(tab);renderTabs();panes.forEach(p=>{try{const t=p.kc.getSymbol().ticker;if(bySym[t]&&info(bySym[t]).pricePrecision!==p.kc.getSymbol().pricePrecision)p.kc.setSymbol(info(bySym[t]))}catch(e){}})});
  addEventListener("resize",()=>{if(mobile()&&!["l1","l2v","mtf"].includes(lay))setLayout("l1")});
}
})();
