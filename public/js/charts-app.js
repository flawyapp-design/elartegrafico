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
const SAVE=load();const save=()=>{try{localStorage.setItem(LS,JSON.stringify(SAVE))}catch(e){}window.__eagSync&&window.__eagSync()};

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
  /* traer lo guardado en la cuenta si es más nuevo que lo de este navegador */
  try{if(API.chartState){const r=await API.chartState();const lt=+(localStorage.getItem("eag_sync_ts")||0);
    if(r&&r.data&&new Date(r.updated_at).getTime()>lt+1000){const d=r.data;if(d.prefs){Object.keys(SAVE).forEach(k=>delete SAVE[k]);Object.assign(SAVE,d.prefs);localStorage.setItem(LS,JSON.stringify(SAVE))}
      if(d.draw)localStorage.setItem("eag_draw_v1",JSON.stringify(d.draw));localStorage.setItem("eag_sync_ts",String(new Date(r.updated_at).getTime()))}}}catch(e){}
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
      <button class="btn ic" id="linkb" title="Vincular gráficos: la cruz y el mercado se mueven en todos a la vez"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg><span class="t">Vincular</span></button>
      <button class="btn ic" id="alb" title="Alertas de precio"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg><span class="t">Alertas</span><em class="badge" id="alc" hidden></em></button>
      <button class="btn ic" id="cfgb" title="Configuración: apariencia, barras, marca de agua, alertas y atajos"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span class="t">Configuración</span></button>
      <button class="btn ic" id="wlb" title="Lista de mercados">${ICON.list}<span class="t">Mercados</span></button>
    </header>
    <div class="main" id="main">
      <div class="center"><div class="ftw"><button class="fta" data-d="-1" title="Anteriores">‹</button><nav class="ftabs" id="ftabs" aria-label="Mercados favoritos"></nav><button class="fta" data-d="1" title="Siguientes">›</button><button class="fteye" id="fteye" title="Mostrar barras">${ICON.eye}</button></div><div class="grid" id="grid"></div></div>
      <aside class="wl" id="wl"><span class="wlsp" title="Arrastra para cambiar el ancho"></span>
        <div class="wlh"><h3>Mercados</h3><button class="x" id="wlx" title="Ocultar lista">×</button></div>
        <input id="q" type="search" placeholder="Buscar: Boom, Crash, EUR/USD…" autocomplete="off">
        <div class="tabs" id="tabs">${TABS.map(([k,t])=>`<button data-t="${k}">${t}</button>`).join("")}</div>
        <div class="list" id="list"><p style="color:var(--dim);padding:8px">Cargando mercados…</p></div>
        <div class="foot">Datos en vivo de Deriv, solo para análisis educativo. No es asesoría financiera. Compara siempre con tu plataforma antes de operar.</div>
      </aside>
    </div>
    <button class="fab" id="fab" title="Mostrar barras (Esc) · arrástralo para moverlo">${ICON.eye}<span>Mostrar barras</span></button><div class="toast" id="toast" hidden></div>
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
  const PARTS=[["top","Barra superior"],["pb","Barra de temporalidades y herramientas"],["bb","Barra inferior (rangos, reloj y escala)"],["db","Barra de dibujo"],["tf","Barra flotante de dibujos favoritos"],["ft","Pestañas de mercados favoritos"],["wl","Lista de mercados"]];
  SAVE.hide=SAVE.hide&&typeof SAVE.hide==="object"?SAVE.hide:{};
  /* en celular la barra flotante de favoritos arranca oculta (se activa en Configuración → Barras) */
  if(innerWidth<=900&&SAVE.hide.tf===undefined)SAVE.hide.tf=true;
  function applyHide(){PARTS.forEach(([k])=>appw.classList.toggle("h-"+k,!!SAVE.hide[k]));if(window.__tfavR)window.__tfavR();relayout();setTimeout(()=>{try{placeFab()}catch(e){}},60)}
  const allHidden=()=>PARTS.every(([k])=>SAVE.hide[k]);
  function openVista(anchor){
    pop.innerHTML=`<div class="ph">Vista</div>${PARTS.map(([k,t])=>`<label class="sw"><input type="checkbox" data-k="${k}" ${SAVE.hide[k]?"":"checked"}><i></i><span>${t}</span></label>`).join("")}
      <div class="ph">Posición</div><label class="sw"><input type="checkbox" data-o="wlLeft" ${SAVE.wlLeft?"checked":""}><i></i><span>Lista de mercados a la izquierda</span></label>
      <label class="sw"><input type="checkbox" data-o="dbRight" ${SAVE.dbRight?"checked":""}><i></i><span>Barra de dibujo a la derecha</span></label>
      <div class="pnote">Arrastra los bordes para cambiar tamaños: la lista, la multitemporalidad y la división entre gráficos. Arrastra las pestañas y tus favoritos para ordenarlos.</div>
      <div class="pbtns"><button class="btn sm" data-a="clean">${allHidden()?"Mostrar todo":"Modo limpio"}</button> <button class="btn sm" data-a="cfg">Ajustes del gráfico</button> <button class="btn sm" data-a="rs">Restablecer tamaños</button></div>`;
    pop.querySelectorAll("[data-o]").forEach(i=>i.onchange=()=>{SAVE[i.dataset.o]=i.checked;save();applyLayoutPrefs();openVista(anchor)});
    pop.querySelector('[data-a="rs"]').onclick=()=>{delete SAVE.wlw;delete SAVE.mtfh;SAVE.split={c:.5,r:.5};save();applyLayoutPrefs();closePop()};
    pop.querySelector('[data-a="cfg"]').onclick=()=>openCfg(anchor);
    pop.querySelectorAll("input[data-k]").forEach(i=>i.onchange=()=>{SAVE.hide[i.dataset.k]=!i.checked;save();applyHide();openVista(anchor)});
    pop.querySelector('[data-a="clean"]').onclick=()=>{const all=!allHidden();PARTS.forEach(([k])=>SAVE.hide[k]=all);save();applyHide();closePop();
      if(all)toast("Modo limpio · toca <b>Mostrar barras</b> o presiona <b>Esc</b> para volver")};
    showPop(anchor,"right")}

  $("#fteye").onclick=e=>{e.stopPropagation();openSettings("barras")};
  /* ojito flotante (solo con todas las barras ocultas): en la esquina vacía del gráfico y se puede arrastrar */
  const fab=$("#fab");let fabMoved=false;
  function placeFab(){if(SAVE.fabPos){fab.style.left=clamp(SAVE.fabPos.x,4,innerWidth-40)+"px";fab.style.top=clamp(SAVE.fabPos.y,4,innerHeight-40)+"px";return}
    const r=grid.getBoundingClientRect();fab.style.left=(r.right-fab.offsetWidth-10)+"px";fab.style.top=(r.top+10)+"px"}
  fab.addEventListener("pointerdown",e=>{if(e.button!==0)return;const r=fab.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top,st={x:e.clientX,y:e.clientY};fabMoved=false;try{fab.setPointerCapture(e.pointerId)}catch(x){}
    const mv=ev=>{if(!fabMoved&&Math.hypot(ev.clientX-st.x,ev.clientY-st.y)<5)return;fabMoved=true;SAVE.fabPos={x:Math.round(ev.clientX-dx),y:Math.round(ev.clientY-dy)};placeFab()};
    const up=()=>{fab.removeEventListener("pointermove",mv);fab.removeEventListener("pointerup",up);if(fabMoved)save()};
    fab.addEventListener("pointermove",mv);fab.addEventListener("pointerup",up)});
  fab.ondblclick=()=>{delete SAVE.fabPos;save();placeFab()};
  addEventListener("resize",()=>placeFab());
  fab.onclick=e=>{e.stopPropagation();if(fabMoved){fabMoved=false;return}PARTS.forEach(([k])=>SAVE.hide[k]=false);save();applyHide()};
  function showPop(anchor,align){pop.hidden=false;const r=anchor.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
    let x=align==="right"?r.right-w:r.left;x=Math.max(8,Math.min(x,innerWidth-w-8));let y=r.bottom+6;if(y+h>innerHeight-8)y=Math.max(8,r.top-h-6);
    pop.style.left=x+"px";pop.style.top=y+"px"}
  function closePop(){pop.hidden=true;pop.dataset.for="";pop.classList.remove("wide");if(shownPick&&shownPick.length){shownPick=[];watch()}}
  document.addEventListener("pointerdown",e=>{if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest("#vb,#fab,#fteye,#cfgb,.tfdd,.wsym,.wtf,.dmini"))closePop()});
  addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!pop.hidden){closePop();return}
    if(/input|textarea/i.test((document.activeElement||{}).tagName||""))return;
    if(SAVE.hide.top&&SAVE.hide.ft){PARTS.forEach(([k])=>SAVE.hide[k]=false);save();applyHide()}});
  let tt=null;function toast(h){const t=$("#toast");t.innerHTML=h;t.hidden=false;t.classList.remove("out");clearTimeout(tt);tt=setTimeout(()=>{t.classList.add("out");setTimeout(()=>t.hidden=true,400)},4200)}

  /* ---------- tamaños y posiciones que el usuario acomoda ---------- */
  SAVE.split=SAVE.split&&typeof SAVE.split==="object"?SAVE.split:{c:.5,r:.5};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function applyLayoutPrefs(){
    appw.classList.toggle("wl-left",!!SAVE.wlLeft);appw.classList.toggle("db-right",!!SAVE.dbRight);
    appw.style.setProperty("--wlw",(SAVE.wlw||300)+"px");appw.style.setProperty("--mtfh",(SAVE.mtfh||168)+"px");
    const c=SAVE.split.c,r=SAVE.split.r;grid.style.setProperty("--cf",c+"fr");grid.style.setProperty("--cf2",(1-c)+"fr");grid.style.setProperty("--rf",r+"fr");grid.style.setProperty("--rf2",(1-r)+"fr");
    placeSplits();relayout()}
  function dragger(el,onMove,onEnd){el.addEventListener("pointerdown",e=>{if(e.button!==0)return;e.preventDefault();el.classList.add("on");appw.classList.add("resizing");try{el.setPointerCapture(e.pointerId)}catch(x){}
    const mv=ev=>onMove(ev),up=()=>{el.classList.remove("on");appw.classList.remove("resizing");el.removeEventListener("pointermove",mv);el.removeEventListener("pointerup",up);save();onEnd&&onEnd();relayout()};
    el.addEventListener("pointermove",mv);el.addEventListener("pointerup",up)})}
  /* ancho de la lista de mercados */
  dragger($(".wlsp"),e=>{const r=main.getBoundingClientRect();SAVE.wlw=Math.round(clamp(SAVE.wlLeft?e.clientX-r.left:r.right-e.clientX,220,560));appw.style.setProperty("--wlw",SAVE.wlw+"px")});
  $(".wlsp").ondblclick=()=>{delete SAVE.wlw;save();applyLayoutPrefs()};
  /* división entre gráficos */
  const gv=document.createElement("span"),gh=document.createElement("span");gv.className="gsp v";gh.className="gsp h";gv.title=gh.title="Arrastra para cambiar el tamaño · doble clic: mitad y mitad";
  function placeSplits(){if(!gv.isConnected)grid.append(gv,gh);const L=grid.className;
    const hasV=/\b(l2|l3|l4)\b/.test(L),hasH=/\b(l2v|l3|l4)\b/.test(L);gv.style.display=hasV?"":"none";gh.style.display=hasH?"":"none";
    gv.style.left=`calc(${SAVE.split.c*100}% - 4px)`;gh.style.top=`calc(${SAVE.split.r*100}% - 4px)`;gh.style.left=/\bl3\b/.test(L)?`${SAVE.split.c*100}%`:"0"}
  dragger(gv,e=>{const r=grid.getBoundingClientRect();SAVE.split.c=+clamp((e.clientX-r.left)/r.width,.15,.85).toFixed(3);applyLayoutPrefs()});
  dragger(gh,e=>{const r=grid.getBoundingClientRect();SAVE.split.r=+clamp((e.clientY-r.top)/r.height,.15,.85).toFixed(3);applyLayoutPrefs()});
  gv.ondblclick=()=>{SAVE.split.c=.5;save();applyLayoutPrefs()};gh.ondblclick=()=>{SAVE.split.r=.5;save();applyLayoutPrefs()};
  /* ordenar arrastrando (pestañas, favoritos) — con el dedo: mantener presionado y arrastrar */
  function sortable(box,sel,axis,onDone,enabled){let act=false;
    box.addEventListener("touchmove",e=>{if(act)e.preventDefault()},{passive:false});
    box.addEventListener("pointerdown",e=>{const it=e.target.closest(sel);if(!it||e.button!==0||e.target.closest(".x,.fv")||(enabled&&!enabled()))return;
      const st={x:e.clientX,y:e.clientY},touch=e.pointerType==="touch";let drag=false,armed=!touch,tm=touch?setTimeout(()=>{armed=true;it.classList.add("armed")},280):null;
      const pos=ev=>axis==="x"?ev.clientX:ev.clientY;
      const mv=ev=>{const d=pos(ev)-(axis==="x"?st.x:st.y),o=axis==="x"?ev.clientY-st.y:ev.clientX-st.x;
        if(!drag){if(!armed){if(Math.hypot(d,o)>8){clearTimeout(tm);cleanup()}return}if(Math.abs(d)<6&&Math.abs(o)<6)return;drag=act=true;it.classList.add("dragging");box.classList.add("sorting")}
        const sibs=[...box.querySelectorAll(sel)].filter(x=>x!==it);let before=null;
        for(const sb of sibs){const r=sb.getBoundingClientRect();if(pos(ev)<(axis==="x"?r.left+r.width/2:r.top+r.height/2)){before=sb;break}}
        if(before){if(it.nextElementSibling!==before)box.insertBefore(it,before)}else{const ls=sibs[sibs.length-1];if(ls&&ls.nextElementSibling!==it)ls.after(it)}
        const r=box.getBoundingClientRect();if(axis==="x"){if(ev.clientX<r.left+36)box.scrollLeft-=14;if(ev.clientX>r.right-36)box.scrollLeft+=14}else{if(ev.clientY<r.top+30)box.scrollTop-=12;if(ev.clientY>r.bottom-30)box.scrollTop+=12}};
      const cleanup=()=>{clearTimeout(tm);removeEventListener("pointermove",mv);removeEventListener("pointerup",up);removeEventListener("pointercancel",up);it.classList.remove("armed")};
      const up=()=>{cleanup();if(drag){act=false;it.classList.remove("dragging");box.classList.remove("sorting");onDone([...box.querySelectorAll(sel)].map(x=>x.dataset.s||x.dataset.t));
        const kill=ev=>{ev.stopPropagation();ev.preventDefault()};it.addEventListener("click",kill,{capture:true,once:true});setTimeout(()=>it.removeEventListener("click",kill,true),60)}};
      addEventListener("pointermove",mv);addEventListener("pointerup",up);addEventListener("pointercancel",up)})}

  /* ---------- elegir mercado desde el mismo gráfico ---------- */
  let spTab=null;
  function openSymPicker(pane,anchor){
    const cur=(()=>{try{return pane.kc.getSymbol().ticker}catch(e){return""}})();
    spTab=spTab||(SAVE.fav.length?"fav":"bc");
    pop.innerHTML=`<div class="spk"><input class="spq" type="search" placeholder="Buscar mercado…" autocomplete="off"><div class="tabs spt">${TABS.map(([k,t])=>`<button data-t="${k}" class="${k===spTab?"on":""}">${t}</button>`).join("")}</div><div class="spl"></div></div>`;
    const inp=pop.querySelector(".spq"),box=pop.querySelector(".spl");
    const draw=()=>{const k=inp.value.trim().toLowerCase();
      let a=k?SYMS.filter(x=>x.symbol.toLowerCase().includes(k)||String(x.display_name).toLowerCase().includes(k)):spTab==="fav"?SAVE.fav.map(x=>bySym[x]).filter(Boolean):SYMS.filter(x=>tabOf(x)===spTab);
      if(!(spTab==="fav"&&!k))a=a.slice().sort((x,y)=>(bcOrder(x)-bcOrder(y))||String(x.display_name).localeCompare(y.display_name));
      a=a.slice(0,80);
      box.innerHTML=a.length?a.map(x=>{const c=chg(x.symbol);return`<div class="spr${x.symbol===cur?" on":""}" data-s="${esc(x.symbol)}"><span class="fv${SAVE.fav.includes(x.symbol)?" on":""}" title="Favorito">${SAVE.fav.includes(x.symbol)?"★":"☆"}</span><b>${esc(x.display_name)}</b><span class="p">${fmt(last[x.symbol],x)}</span><span class="c ${c==null?"":c>=0?"up":"dn"}">${c==null?"":(c>=0?"+":"")+c.toFixed(2)+"%"}</span></div>`}).join("")
        :`<p class="pnote">${spTab==="fav"&&!k?"Aún no tienes favoritos: toca ☆ en cualquier mercado.":"No hay mercados con ese nombre."}</p>`;
      box.querySelectorAll(".spr").forEach(r=>r.onclick=e=>{const sy=r.dataset.s;if(e.target.closest(".fv")){toggleFav(sy);draw();return}
        const i=panes.indexOf(pane);if(i>=0)active=i;setSym(sy);closePop()});
      /* precios en vivo de lo que se ve en la lista */
      shownPick=a.slice(0,30).map(x=>x.symbol);watch()};
    pop.querySelectorAll(".spt button").forEach(b=>b.onclick=()=>{spTab=b.dataset.t;inp.value="";pop.querySelectorAll(".spt button").forEach(x=>x.classList.toggle("on",x===b));draw()});
    inp.oninput=draw;inp.onkeydown=e=>{if(e.key==="Enter"){const f=box.querySelector(".spr");f&&f.click()}};
    draw();pop.dataset.for="sym";pop.classList.add("wide");showPop(anchor,"left");setTimeout(()=>inp.focus(),20)}
  let shownPick=[];

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
  const UP="#089981",DN="#f23645",NC="#9da1aa";
  /* ---------- ajustes del gráfico (tema, fondo, cuadrícula, velas…) ---------- */
  const CDEF={theme:"dark",bg:"",grid:true,wmMode:"both",wmOp:10,wmSize:100,wmColor:"auto",up:UP,dn:DN,type:"candle_solid",last:true,hl:true,cross:true,wm:true,axis:true};
  SAVE.cfg=Object.assign({},CDEF,SAVE.cfg||{});
  /* velas: pasar a los colores nuevos si tenía los de antes por defecto */
  if(["#35c4a2","#22ab94","#0ecb81"].includes(SAVE.cfg.up))SAVE.cfg.up=UP;if(["#ec5b52","#f6465d"].includes(SAVE.cfg.dn))SAVE.cfg.dn=DN;
  const CF=()=>SAVE.cfg,light=()=>CF().theme==="light";
  const barOf=()=>{const c=CF();return{upColor:c.up,downColor:c.dn,noChangeColor:NC,upBorderColor:c.up,downBorderColor:c.dn,noChangeBorderColor:NC,upWickColor:c.up,downWickColor:c.dn,noChangeWickColor:NC}};
  const styFor=()=>{const c=CF(),gc=light()?"rgba(16,18,24,.06)":"rgba(255,255,255,.045)";
    return{grid:{show:!!c.grid,horizontal:{show:!!c.grid,color:gc},vertical:{show:!!c.grid,color:gc}},
      candle:{type:c.type,bar:barOf(),area:{lineColor:c.up},priceMark:{last:{show:!!c.last,upColor:c.up,downColor:c.dn},high:{show:!!c.hl},low:{show:!!c.hl}}},
      crosshair:{show:!!c.cross},xAxis:{show:!!c.axis},yAxis:{show:!!c.axis}}};
  const BGS=["#0b0c0e","#000000","#131722","#0d1512","#15121b","#ffffff","#faf8f3","#f3f5f8"];
  function applyCfg(){const c=CF();
    document.documentElement.classList.toggle("light",light());appw.classList.toggle("h-wm",!c.wm);
    const de=document.documentElement;de.dataset.wm=c.wmMode;de.style.setProperty("--wmo",(+c.wmOp||0)/100);de.style.setProperty("--wms",(+c.wmSize||100)/100);
    de.style.setProperty("--wmc",c.wmColor==="auto"?(light()?"#15171c":"#ffffff"):c.wmColor);
    document.documentElement.style.setProperty("--chartbg",c.bg||(light()?"#ffffff":"#0b0c0e"));
    const tc=document.querySelector('meta[name="theme-color"]');tc&&tc.setAttribute("content",light()?"#ffffff":"#0b0c0e");
    panes.forEach(p=>{try{if(p.kc.getTheme()!==c.theme)p.kc.setTheme(c.theme)}catch(e){}setTimeout(()=>{try{p.kc.setStyles(styFor())}catch(e){}},40)});
    if(mtf)mtf.minis.forEach(m=>{try{m.c.setStyles({candle:{bar:barOf()}})}catch(e){}})}
  function openCfg(anchor){const c=CF();
    const tg=(k,t)=>`<label class="sw"><input type="checkbox" data-k="${k}" ${c[k]?"checked":""}><i></i><span>${t}</span></label>`;
    const TYPES=[["candle_solid","Velas"],["candle_stroke","Huecas"],["ohlc","Barras"],["area","Área"]];
    pop.innerHTML=`<div class="ph">Tema</div><div class="seg">${[["dark","Oscuro"],["light","Claro"]].map(([v,t])=>`<button data-th="${v}" class="${c.theme===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="ph">Fondo del gráfico</div><div class="sws">${BGS.map(b=>`<button class="swc${(c.bg||"")===b?" on":""}" data-bg="${b}" style="background:${b}" title="${b}"></button>`).join("")}<label class="swc pick" title="Otro color"><input type="color" data-bgp value="${c.bg||(light()?"#ffffff":"#0b0c0e")}">+</label><button class="swc auto${c.bg?"":" on"}" data-bg="" title="Según el tema">A</button></div>
      <div class="ph">Velas</div><div class="seg">${TYPES.map(([v,t])=>`<button data-ty="${v}" class="${c.type===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="cols"><label>Alcista <input type="color" data-col="up" value="${c.up}"></label><label>Bajista <input type="color" data-col="dn" value="${c.dn}"></label></div>
      <div class="ph">Mostrar</div>${tg("grid","Cuadrícula")}${tg("axis","Ejes de precio y hora")}${tg("last","Línea del último precio")}${tg("hl","Máximo y mínimo visibles")}${tg("cross","Cruz del cursor")}${tg("wm","Marca de agua")}
      ${c.wm?`<div class="ph">Marca de agua</div><div class="seg">${[["both","Marca y mercado"],["sym","Solo mercado"],["brand","Solo marca"]].map(([v,t])=>`<button data-wm="${v}" class="${c.wmMode===v?"on":""}">${t}</button>`).join("")}</div>
      <label class="rg"><span>Visibilidad</span><input type="range" min="2" max="60" step="1" data-r="wmOp" value="${c.wmOp}"><em>${c.wmOp}%</em></label>
      <label class="rg"><span>Tamaño</span><input type="range" min="50" max="200" step="5" data-r="wmSize" value="${c.wmSize}"><em>${c.wmSize}%</em></label>
      <div class="sws wmc">${[["auto","Automático"],["#e2b55c","Dorado"],["#ffffff","Blanco"],["#000000","Negro"],["#2962ff","Azul"]].map(([v,t])=>`<button class="swc${c.wmColor===v?" on":""}" data-wc="${v}" title="${t}" style="background:${v==="auto"?"linear-gradient(135deg,#fff 50%,#15171c 50%)":v}"></button>`).join("")}</div>`:""}
      <div class="pbtns"><button class="btn sm" data-a="reset">Restaurar valores</button></div>
      <div class="pnote">Indicadores, zona horaria, escala logarítmica y más ajustes: íconos de la barra del gráfico.</div>`;
    const set=(k,v)=>{SAVE.cfg[k]=v;save();applyCfg();openCfg(anchor)};
    pop.querySelectorAll("[data-th]").forEach(b=>b.onclick=()=>{SAVE.cfg.bg="";set("theme",b.dataset.th)});
    pop.querySelectorAll("[data-bg]").forEach(b=>b.onclick=()=>set("bg",b.dataset.bg));
    pop.querySelector("[data-bgp]").onchange=e=>set("bg",e.target.value);
    pop.querySelectorAll("[data-ty]").forEach(b=>b.onclick=()=>set("type",b.dataset.ty));
    pop.querySelectorAll("[data-col]").forEach(i=>i.onchange=()=>set(i.dataset.col,i.value));
    pop.querySelectorAll(".sw input").forEach(i=>i.onchange=()=>set(i.dataset.k,i.checked));
    pop.querySelectorAll("[data-wm]").forEach(b=>b.onclick=()=>set("wmMode",b.dataset.wm));
    pop.querySelectorAll("[data-wc]").forEach(b=>b.onclick=()=>set("wmColor",b.dataset.wc));
    pop.querySelectorAll("[data-r]").forEach(i=>{i.oninput=()=>{SAVE.cfg[i.dataset.r]=+i.value;i.nextElementSibling.textContent=i.value+"%";applyCfg()};i.onchange=()=>save()});
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
      onSymbolClick:anc=>{setActive(i);const a=anc&&anc.nodeType?anc:el.querySelector(".wsym");pop.hidden||pop.dataset.for!=="sym"?openSymPicker(p,a):closePop()},
      onSettings:()=>openSettings("apariencia"),onToast:t=>toast(t),getAlerts:tk=>ALERTS.filter(a=>a.active&&a.symbol===tk),onCreateAlert:a=>alertDialog(a),
      onIndicators:d=>{SAVE.panes[i]=Object.assign({},SAVE.panes[i],{ind:d});save()},
      onMagnet:m=>{SAVE.magnet=m;save()},axisType:sv.ax,onAxisType:t=>{SAVE.panes[i]=Object.assign({},SAVE.panes[i],{ax:t});save()},getToolFav:()=>SAVE.toolFav,onToolFav:k=>{SAVE.toolFav=SAVE.toolFav.includes(k)?SAVE.toolFav.filter(x=>x!==k):SAVE.toolFav.concat(k);save();renderToolFav()},onLastTools:t=>{SAVE.lastTools=t;save()},
      onDrawingsChange:tk=>(window.__eagSync&&window.__eagSync(),panes).forEach(q2=>{if(q2!==p&&q2.kc&&q2.kc.getSymbol().ticker===tk)q2.kc.reloadDrawings()})});
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
    setActive(active);placeSplits();relayout();
  }
  document.querySelectorAll(".lay button").forEach(b=>b.onclick=()=>setLayout(b.dataset.l));
  function setSym(s){const p=panes[active];if(!p)return;
    const targets=SAVE.link&&lay!=="mtf"?panes.slice(0,visible()).map((q,j)=>j):[active];
    targets.forEach(j=>{panes[j].kc.setSymbol(findInfo(s));SAVE.panes[j]=Object.assign({},SAVE.panes[j],{s})});save();
    setTimeout(()=>{if(lay==="mtf"&&active===0)buildMTF();paintList();paintTabs()},60)}

  /* ---------- multitemporalidad ---------- */
  let mtf=null;
  const MINI=()=>({grid:{show:false},candle:{bar:barOf(),tooltip:{showRule:"none"},priceMark:{high:{show:false},low:{show:false},last:{show:true,line:{show:true,style:"dashed",size:1},text:{show:false}}}},
    xAxis:{show:false},yAxis:{show:false},crosshair:{show:false},separator:{size:0}});
  function destroyMTF(){if(!mtf)return;mtf.minis.forEach(m=>{hubOff(m.key,m.who);try{KC.dispose(m.mc)}catch(e){}});mtf.el.remove();mtf=null}
  function buildMTF(){
    destroyMTF();const sym=(()=>{try{return panes[0].kc.getSymbol()}catch(e){return findInfo(DEF[0])}})();
    const el=document.createElement("div");el.className="mtfrow";el.style.setProperty("--n",SAVE.tfFav.length);grid.appendChild(el);
    const sp=document.createElement("span");sp.className="mtfsp";sp.title="Arrastra para cambiar el alto · doble clic: alto normal";el.appendChild(sp);
    dragger(sp,e=>{const r=grid.getBoundingClientRect();SAVE.mtfh=Math.round(clamp(r.bottom-e.clientY,110,r.height*.65));appw.style.setProperty("--mtfh",SAVE.mtfh+"px")});
    sp.ondblclick=()=>{delete SAVE.mtfh;save();applyLayoutPrefs()};
    mtf={el,sym:sym.ticker,minis:[]};
    SAVE.tfFav.forEach((t,i)=>{const per=perOf(t),g=gran(per);
      const box=document.createElement("div");box.className="mini";box.innerHTML=`<button class="mh" title="Ver ${tfName(per)} en el gráfico grande"><b>${t}</b><span class="mp"></span><em></em><i class="mz">⤢</i></button><span class="mc" title="Toca o desliza hacia arriba: ver en grande · rueda o pellizco: acercar · arrastra a los lados: mover"></span>`;el.appendChild(box);
      const mc=box.querySelector(".mc"),c=KC.init(mc,{locale:"es-ES",timezone:TZ,styles:MINI()});
      try{c.setPriceVolumePrecision(sym.pricePrecision||3,0);c.setScrollEnabled(true);c.setZoomEnabled(true);c.setOffsetRightDistance(6)}catch(e){}
      const m={t,box,mc,c,key:sym.ticker+":"+g,who:"mtf"+i+":"+Date.now()};mtf.minis.push(m);
      feed.ask({ticks_history:sym.ticker,style:"candles",granularity:g,end:"latest",count:60}).then(r=>{if(!mtf||!mtf.minis.includes(m))return;const L=(r.candles||[]).map(toK);c.applyNewData(L);fit(m);m.live(L[L.length-1])}).catch(()=>{});
      const mp=box.querySelector(".mp");
      const live=d=>{if(!d)return;const ch=(d.close-d.open)/d.open*100;mp.innerHTML=`${(+d.close).toFixed(sym.pricePrecision||3)} <i class="${ch>=0?"up":"dn"}">${ch>=0?"▲":"▼"}${Math.abs(ch).toFixed(2)}%</i>`;
};
      m.live=live;
      hubOn(m.key,m.who,sym.ticker,g,d=>{try{c.updateData(d);live(d)}catch(e){}});
      const big=()=>{try{panes[0].kc.setPeriod(per)}catch(e){}afterTF();box.classList.add("flyup");setTimeout(()=>box.classList.remove("flyup"),450)};box.querySelector(".mh").onclick=big;
      /* gesto: deslizar hacia arriba (o un toque simple) pasa esta temporalidad al gráfico grande */
      mc.addEventListener("pointerdown",e=>{mtfG={box,big,x:e.clientX,y:e.clientY,t:Date.now()}},true)});
    mtfMark();relayout()}
  /* gesto de la multitemporalidad: un solo juego de escuchadores para todos los mini gráficos */
  let mtfG=null;
  addEventListener("pointermove",e=>{const g=mtfG;if(!g)return;const dy=e.clientY-g.y,dx=e.clientX-g.x;g.box.classList.toggle("lift",dy<-14&&Math.abs(dy)>Math.abs(dx));g.box.style.setProperty("--lift",Math.max(-40,Math.min(0,dy))+"px")});
  addEventListener("pointerup",e=>{const g=mtfG;if(!g)return;mtfG=null;const dy=e.clientY-g.y,dx=e.clientX-g.x,quick=Date.now()-g.t<350;g.box.classList.remove("lift");g.box.style.removeProperty("--lift");
    if(g.box.isConnected&&((dy<-30&&Math.abs(dy)>Math.abs(dx)*1.2)||(quick&&Math.abs(dx)<5&&Math.abs(dy)<5)))g.big()});
  addEventListener("pointercancel",()=>{if(mtfG){mtfG.box.classList.remove("lift");mtfG=null}});
  function fit(m){try{const w=m.mc.clientWidth||200;m.c.resize();m.c.setBarSpace(Math.max(1.5,(w-14)/60))}catch(e){}}
  function mtfResize(){if(mtf)mtf.minis.forEach(m=>{try{m.c.resize()}catch(e){}})}
  function mtfMark(){if(!mtf)return;let cur="";try{cur=panes[0].kc.getPeriod().text}catch(e){}
    mtf.minis.forEach(m=>{const on=m.t===cur;m.box.classList.toggle("on",on);m.box.querySelector("em").textContent=on?"●":""})}

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
    list.classList.toggle("sortable",tab==="fav"&&!k);
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
    list.querySelectorAll(".sy").forEach(r=>{const s=r.dataset.s;r.classList.toggle("on",s===act);r.style.boxShadow=cur.has(s)&&s!==act?"inset 3px 0 0 var(--gold)":"";paintRow(r)})}
  function paintRow(r){const s=r.dataset.s,i=bySym[s]||{},c=chg(s),pe=r.querySelector("[data-p]"),ce=r.querySelector("[data-c]");
    pe.textContent=fmt(last[s],i);pe.className="p "+(dir[s]||"");if(c!=null){ce.textContent=(c>=0?"+":"")+c.toFixed(2)+"%";ce.className="c "+(c>=0?"up":"dn")}else ce.textContent=""}
  function renderTabs(){
    ftabs.innerHTML=SAVE.fav.map(s=>`<div class="ft" data-s="${esc(s)}" role="button" tabindex="0" title="${esc((bySym[s]||{}).display_name||s)}"><span class="dot"></span><b>${esc(short(s))}</b><span class="p" data-p></span><span class="c" data-c></span><button class="x" title="Quitar de favoritos">×</button></div>`).join("")
      +`<button class="ft add" id="ftadd" title="Agregar mercado a favoritos">${ICON.plus}<span>${SAVE.fav.length?"":"Agrega tus mercados favoritos"}</span></button>`;
    ftabs.querySelectorAll(".ft[data-s]").forEach(t=>t.onclick=e=>{const s=t.dataset.s;if(e.target.closest(".x"))return toggleFav(s);setSym(s)});
    $("#ftadd").onclick=()=>{q.value="";if(mobile())main.classList.add("wlopen");else if(SAVE.hide.wl){SAVE.hide.wl=false;save();applyHide()}setTab(tab==="fav"?"bc":tab);q.focus()};
    paintTabs();watch();ftArrows()}
  const ftw=$(".ftw");
  function ftArrows(){const over=ftabs.scrollWidth>ftabs.clientWidth+2;ftw.classList.toggle("over",over);
    ftw.querySelector('[data-d="-1"]').disabled=ftabs.scrollLeft<=2;ftw.querySelector('[data-d="1"]').disabled=ftabs.scrollLeft+ftabs.clientWidth>=ftabs.scrollWidth-2}
  ftw.querySelectorAll(".fta").forEach(b=>b.onclick=()=>ftabs.scrollBy({left:+b.dataset.d*Math.max(160,ftabs.clientWidth*.7),behavior:"smooth"}));
  ftabs.addEventListener("scroll",ftArrows,{passive:true});addEventListener("resize",ftArrows);
  ftabs.addEventListener("wheel",e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){ftabs.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
  sortable(ftabs,".ft[data-s]","x",ord=>{SAVE.fav=ord;save();renderList();renderTabs()});
  sortable(list,".sy","y",ord=>{SAVE.fav=ord;save();renderList();renderTabs()},()=>tab==="fav"&&!q.value.trim());
  function paintTabs(){const act=curSym(active);
    ftabs.querySelectorAll(".ft[data-s]").forEach(t=>{const s=t.dataset.s,c=chg(s);if(s===act&&!t.classList.contains("on"))setTimeout(()=>t.scrollIntoView({inline:"nearest",block:"nearest",behavior:"smooth"}),30);t.classList.toggle("on",s===act);
      t.querySelector("[data-p]").textContent=fmt(last[s],bySym[s]||{});t.querySelector("[data-p]").className="p "+(dir[s]||"");
      const ce=t.querySelector("[data-c]");if(c!=null){ce.textContent=(c>=0?"▲ ":"▼ ")+Math.abs(c).toFixed(2)+"%";ce.className="c "+(c>=0?"up":"dn")}else ce.textContent="";
      t.querySelector(".dot").className="dot "+(c==null?"":c>=0?"up":"dn")})}
  /* precios en vivo: favoritos + mercados visibles en la lista */
  let watching=new Set(),wt=null;
  const rowOf=s=>list.querySelector(`.sy[data-s="${CSS.escape(s)}"]`);
  function onPrice(s){const r=rowOf(s);r&&paintRow(r);if(SAVE.fav.includes(s))paintTabs();
    if(!pop.hidden&&pop.dataset.for==="sym"){const pr=pop.querySelector(`.spr[data-s="${CSS.escape(s)}"]`);if(pr){const x=bySym[s]||{},c=chg(s);pr.querySelector(".p").textContent=fmt(last[s],x);const ce=pr.querySelector(".c");ce.className="c "+(c==null?"":c>=0?"up":"dn");ce.textContent=c==null?"":(c>=0?"+":"")+c.toFixed(2)+"%"}}}
  function watch(){clearTimeout(wt);wt=setTimeout(()=>{
    const want=new Set(SAVE.fav.concat(shown.slice(0,40),shownPick||[]));
    watching.forEach(s=>{if(!want.has(s)){feed.unsub("tick:"+s);watching.delete(s)}});
    want.forEach(s=>{if(watching.has(s))return;watching.add(s);
      feed.sub("tick:"+s,{ticks:s},m=>{if(m.tick){const prev=last[s];last[s]=+m.tick.quote;if(prev!=null)dir[s]=last[s]>prev?"up":last[s]<prev?"dn":dir[s];onPrice(s)}},()=>{});
      if(dayOpen[s]==null)feed.ask({ticks_history:s,style:"candles",granularity:86400,end:"latest",count:1}).then(m=>{const c=(m.candles||[])[0];if(c){dayOpen[s]=+c.open;if(last[s]==null)last[s]=+c.close;onPrice(s)}}).catch(()=>{});
    })},250)}

  /* ---------- gráficos vinculados: cruz sincronizada por fecha y mercado común ---------- */
  const paintLink=()=>{$("#linkb").classList.toggle("on",!!SAVE.link)};paintLink();
  $("#linkb").onclick=()=>{SAVE.link=!SAVE.link;save();paintLink();toast(SAVE.link?"Gráficos vinculados: la cruz y el mercado se mueven en todos":"Gráficos independientes")};
  let syncing=false;const hooked=new WeakSet();
  function hookCross(){panes.forEach(p=>{const c=p.kc&&p.kc.chart;if(!c||hooked.has(c))return;hooked.add(c);
    try{c.subscribeAction("onCrosshairChange",d=>{if(syncing||!SAVE.link||!d)return;const kd=d.kLineData;syncing=true;
      try{panes.slice(0,visible()).forEach(q=>{const c2=q.kc.chart;if(c2===c)return;
        if(kd&&d.x!=null){const px=c2.convertToPixel({timestamp:kd.timestamp},{paneId:"candle_pane"});if(px&&px.x!=null)c2.executeAction("onCrosshairChange",{x:px.x,y:undefined,paneId:"candle_pane"})}
        else c2.executeAction("onCrosshairChange",{x:undefined,y:undefined})})}catch(e){}syncing=false})}catch(e){}})}
  setInterval(hookCross,1500);

  /* ---------- atajos de teclado (como TradingView) ---------- */
  const KEYS={KeyT:"segment",KeyH:"horizontalStraightLine",KeyJ:"horizontalRayLine",KeyV:"verticalStraightLine",KeyF:"fibonacciLine",KeyR:"rect",KeyZ:"eagZone",KeyL:"eagLong",KeyS:"eagShort",KeyM:"eagMeasure",KeyX:"eagText",KeyC:"parallelStraightLine"};
  const tfBox=document.createElement("div");tfBox.className="tfbox";tfBox.hidden=true;appw.appendChild(tfBox);let tfBuf="",tfT=null;
  function tfParse(b){const m=b.trim().toLowerCase().match(/^(\d+)\s*([mhd])?$/);if(!m)return null;let n=+m[1],u=m[2]||"m";
    if(u==="m"&&n>=60&&n%60===0){n/=60;u="h"}if(u==="h"&&n===24){n=1;u="d"}const t=u==="m"?n+"m":u==="h"?n+"H":n+"D";return PERIODS.find(p=>p.text===t)||null}
  function tfShow(){tfBox.innerHTML=`<span>Temporalidad</span><b>${esc(tfBuf)}</b><em>${tfParse(tfBuf)?"Enter para aplicar":"1–30 (min), 1h, 2h, 4h, 8h, 1d"}</em>`;tfBox.hidden=false;clearTimeout(tfT);tfT=setTimeout(()=>{tfBox.hidden=true;tfBuf=""},4000)}
  addEventListener("keydown",e=>{const t=e.target;if(t&&t.closest&&t.closest("input,textarea,select,[contenteditable]"))return;const p=panes[active];if(!p||!p.kc)return;
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&!e.altKey&&(e.code==="KeyZ"||e.code==="KeyY")){e.preventDefault();const ok=(e.code==="KeyY"||e.shiftKey)?p.kc.redo():p.kc.undo();if(!ok)toast(e.code==="KeyY"||e.shiftKey?"Nada para rehacer":"Nada para deshacer");return}
    if(e.altKey&&!mod&&KEYS[e.code]){e.preventDefault();p.kc.startTool(KEYS[e.code]);return}
    if(mod||e.altKey)return;
    if(!tfBox.hidden&&e.key==="Enter"){const per=tfParse(tfBuf);tfBox.hidden=true;tfBuf="";if(per){p.kc.setPeriod(per);afterTF()}else toast("Esa temporalidad no está disponible");return}
    if(!tfBox.hidden&&e.key==="Backspace"){tfBuf=tfBuf.slice(0,-1);tfBuf?tfShow():(tfBox.hidden=true);return}
    if(/^[0-9]$/.test(e.key)||(!tfBox.hidden&&/^[mhdMHD]$/.test(e.key))){tfBuf+=e.key;tfShow()}});

  /* ---------- todo guardado en la cuenta (dibujos y diseño), para verlo en cualquier dispositivo ---------- */
  let syncT=null;
  window.__eagSync=()=>{clearTimeout(syncT);syncT=setTimeout(pushSync,2500)};
  function pushSync(){if(!API.saveChartState)return;let draw={};try{draw=JSON.parse(localStorage.getItem("eag_draw_v1")||"{}")}catch(e){}
    API.saveChartState({prefs:SAVE,draw,v:1}).then(()=>{try{localStorage.setItem("eag_sync_ts",String(Date.now()))}catch(e){}}).catch(()=>{})}
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&syncT){clearTimeout(syncT);pushSync()}});

  $("#cfgb").onclick=e=>{e.stopPropagation();openSettings()};
  $("#alb").onclick=e=>{e.stopPropagation();openSettings("alertas")};

  /* ======================= CONFIGURACIÓN (un solo menú por categorías) ======================= */
  const SI=(d)=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const CATS=[
    ["apariencia","Apariencia","Tema, fondo y velas",SI('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>')],
    ["grafico","Gráfico","Cuadrícula, ejes y precio",SI('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>')],
    ["marca","Marca de agua","Mercado y logo de fondo",SI('<path d="M4 7h16M4 12h10M4 17h7"/>')],
    ["barras","Barras y paneles","Qué se ve y dónde",SI('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>')],
    ["vincular","Gráficos vinculados","Mover varios a la vez",SI('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>')],
    ["alertas","Alertas de precio","Aviso al celular",SI('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>')],
    ["atajos","Atajos de teclado","Trabaja más rápido",SI('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>')]];
  const PDESC={top:"Logo, distribución de gráficos, estado de conexión y botones principales.",pb:"Mercado, temporalidades favoritas, indicadores, captura y pantalla completa de cada gráfico.",
    bb:"Rangos rápidos (1D, 5D, 1M…), reloj, cuenta regresiva y escala % / log.",db:"Herramientas de dibujo a la izquierda de cada gráfico.",tf:"Tus herramientas de dibujo favoritas en una barra que puedes mover.",
    ft:"Tus mercados favoritos como pestañas, con precio y % del día.",wl:"Todos los mercados por categoría, con buscador y precios en vivo."};
  let setCat="apariencia";
  const row=(t,d,ctl)=>`<div class="srow"><div><b>${t}</b>${d?`<p>${d}</p>`:""}</div><div class="sctl">${ctl}</div></div>`;
  const tog=(attr,on)=>`<label class="sw2"><input type="checkbox" ${attr} ${on?"checked":""}><i></i></label>`;
  function settingsBody(cat){const c=CF();
    if(cat==="apariencia")return`<h3>Apariencia</h3>
      <div class="sgrp"><div class="slabel">Tema</div><div class="thm">${[["dark","Oscuro","#0b0c0e","#131418"],["light","Claro","#ffffff","#f3f4f6"]].map(([v,t,a,b])=>`<button class="thc${c.theme===v?" on":""}" data-th="${v}"><span class="thp" style="background:${a}"><i style="background:${b}"></i><em style="background:${c.up}"></em><em style="background:${c.dn};height:40%"></em><em style="background:${c.up};height:55%"></em></span><b>${t}</b></button>`).join("")}</div></div>
      <div class="sgrp"><div class="slabel">Fondo del gráfico</div><p class="shelp">"A" usa el fondo del tema. Puedes elegir cualquier color con +.</p><div class="sws">${BGS.map(b=>`<button class="swc${(c.bg||"")===b?" on":""}" data-bg="${b}" style="background:${b}" title="${b}"></button>`).join("")}<label class="swc pick" title="Otro color"><input type="color" data-bgp value="${c.bg||(light()?"#ffffff":"#0b0c0e")}">+</label><button class="swc auto${c.bg?"":" on"}" data-bg="" title="Según el tema">A</button></div></div>
      <div class="sgrp"><div class="slabel">Velas</div><div class="seg">${[["candle_solid","Velas"],["candle_stroke","Huecas"],["ohlc","Barras"],["area","Área"]].map(([v,t])=>`<button data-ty="${v}" class="${c.type===v?"on":""}">${t}</button>`).join("")}</div>
        ${row("Color alcista","Velas que cierran por encima de su apertura.",`<input type="color" data-col="up" value="${c.up}">`)}${row("Color bajista","Velas que cierran por debajo de su apertura.",`<input type="color" data-col="dn" value="${c.dn}">`)}</div>`;
    if(cat==="grafico")return`<h3>Gráfico</h3>`+[["grid","Cuadrícula","Líneas de fondo para ubicar precios y horas."],["axis","Ejes de precio y hora","La escala de precios a la derecha y las horas abajo."],["last","Línea del último precio","Línea punteada y etiqueta con el precio actual."],["hl","Máximo y mínimo visibles","Marca el precio más alto y más bajo de lo que estás viendo."],["cross","Cruz del cursor","Líneas que siguen al mouse con precio y hora exactos."]].map(([k,t,d])=>row(t,d,tog(`data-k="${k}"`,c[k]))).join("");
    if(cat==="marca")return`<h3>Marca de agua</h3><p class="shelp">Ideal para tus lives: se ve el mercado, la temporalidad y tu marca de fondo.</p>
      ${row("Mostrar marca de agua","",tog('data-k="wm"',c.wm))}
      <div class="sgrp${c.wm?"":" off"}"><div class="slabel">Qué mostrar</div><div class="seg">${[["both","Marca y mercado"],["sym","Solo mercado"],["brand","Solo marca"]].map(([v,t])=>`<button data-wm="${v}" class="${c.wmMode===v?"on":""}">${t}</button>`).join("")}</div>
      <label class="rg"><span>Visibilidad</span><input type="range" min="2" max="60" step="1" data-r="wmOp" value="${c.wmOp}"><em>${c.wmOp}%</em></label>
      <label class="rg"><span>Tamaño</span><input type="range" min="50" max="200" step="5" data-r="wmSize" value="${c.wmSize}"><em>${c.wmSize}%</em></label>
      <div class="slabel">Color</div><div class="sws">${[["auto","Automático"],["#e2b55c","Dorado"],["#ffffff","Blanco"],["#000000","Negro"],["#2962ff","Azul"]].map(([v,t])=>`<button class="swc${c.wmColor===v?" on":""}" data-wc="${v}" title="${t}" style="background:${v==="auto"?"linear-gradient(135deg,#fff 50%,#15171c 50%)":v}"></button>`).join("")}</div></div>`;
    if(cat==="barras")return`<h3>Barras y paneles</h3><p class="shelp">Activa solo lo que usas. Todo se guarda en tu cuenta.</p>
      ${PARTS.map(([k,t])=>row(t,PDESC[k]||"",tog(`data-h="${k}"`,!SAVE.hide[k]))).join("")}
      <div class="slabel">Posición</div>${row("Lista de mercados a la izquierda","",tog('data-o="wlLeft"',SAVE.wlLeft))}${row("Barra de dibujo a la derecha","",tog('data-o="dbRight"',SAVE.dbRight))}
      <p class="shelp">Arrastra los bordes para cambiar tamaños (lista, multitemporalidad y división entre gráficos) y arrastra pestañas y favoritos para ordenarlos.</p>
      <div class="sbtns"><button class="btn sm" data-a="clean">${allHidden()?"Mostrar todo":"Modo limpio (solo gráfico)"}</button><button class="btn sm" data-a="rs">Restablecer tamaños</button></div>`;
    if(cat==="vincular")return`<h3>Gráficos vinculados</h3><p class="shelp">Cuando tienes 2, 3, 4 o 6 gráficos abiertos.</p>
      ${row("Vincular gráficos","La cruz del cursor se mueve en todos a la misma fecha y al elegir un mercado cambia en todos (cada uno conserva su temporalidad).",tog('data-link=""',SAVE.link))}`;
    if(cat==="alertas"){const act=ALERTS.filter(a=>a.active),old=ALERTS.filter(a=>!a.active).slice(0,10),pp=a=>(bySym[a.symbol]?prec(bySym[a.symbol].pip):3);
      const li=a=>`<div class="arow${a.active?"":" done"}"><span class="adot"></span><div><b>${esc(a.symbol_name||a.symbol)}</b><p>${a.kind==="zona"?`Zona ${(+a.price2).toFixed(pp(a))} – ${(+a.price).toFixed(pp(a))}`:`Nivel ${(+a.price).toFixed(pp(a))}`}${a.note?" · "+esc(a.note):""}${a.active?"":` · se activó ${a.triggered_at?new Date(a.triggered_at).toLocaleString("es-CO",{timeZone:"America/Bogota",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}):""}`}</p></div>${a.active?"":`<button class="btn sm" data-re="${a.id}">Reactivar</button>`}<button class="x" data-del="${a.id}" title="Borrar">×</button></div>`;
      return`<h3>Alertas de precio</h3><p class="shelp">Dibuja una línea horizontal, una zona o un rectángulo, haz <b>clic derecho → 🔔 Crear alerta</b> (o toca 🔔 en la barra del dibujo). Cuando el precio llegue te avisamos al celular, aunque tengas la página cerrada.</p>
        <div class="sbtns"><button class="btn sm gold" data-a="newal">+ Alerta al precio actual</button></div>
        <div class="slabel">Activas (${act.length}/30)</div>${act.length?act.map(li).join(""):`<p class="shelp">No tienes alertas activas.</p>`}
        ${old.length?`<div class="slabel">Ya avisadas</div>${old.map(li).join("")}`:""}
        <p class="shelp">Las notificaciones llegan a los dispositivos donde las activaste en la academia (en iPhone, con la app agregada a la pantalla de inicio). Se revisan cada minuto.</p>`}
    if(cat==="atajos"){const K=(k,t)=>`<div class="krow"><span>${t}</span><kbd>${k}</kbd></div>`;const mac=/Mac|iP/.test(navigator.platform),A=mac?"⌥":"Alt",C=mac?"⌘":"Ctrl";
      return`<h3>Atajos de teclado</h3><div class="slabel">Dibujo</div>${K(A+" + T","Línea de tendencia")}${K(A+" + H","Línea horizontal")}${K(A+" + J","Rayo horizontal")}${K(A+" + V","Línea vertical")}${K(A+" + F","Retroceso de Fibonacci")}${K(A+" + C","Canal paralelo")}${K(A+" + Z","Zona")}${K(A+" + R","Rectángulo")}${K(A+" + L","Posición larga (compra)")}${K(A+" + S","Posición corta (venta)")}${K(A+" + M","Regla (o Shift + clic)")}${K(A+" + X","Texto")}
        <div class="slabel">Edición</div>${K(C+" + Z","Deshacer")}${K(C+" + Shift + Z","Rehacer")}${K("Supr","Borrar el dibujo seleccionado")}${K("Esc","Cancelar dibujo / salir de modo limpio")}
        <div class="slabel">Temporalidad</div>${K("15 ↵","Escribe el número y Enter: 15 minutos")}${K("1h ↵ · 4h ↵","Horas")}${K("1d ↵","Diario")}`}
    return""}
  function openSettings(cat){if(cat)setCat=cat;closePop();let ov=$(".smodal");if(!ov){ov=document.createElement("div");ov.className="smodal";appw.appendChild(ov);ov.onclick=e=>{if(e.target===ov)ov.remove()}}
    ov.innerHTML=`<div class="sbox" role="dialog" aria-label="Configuración"><aside class="snav"><div class="stitle">Configuración</div>${CATS.map(([k,t,d,ic])=>`<button data-cat="${k}" class="${k===setCat?"on":""}">${ic}<span><b>${t}</b><small>${d}</small></span>${k==="alertas"&&ALERTS.some(a=>a.active)?`<em class="badge">${ALERTS.filter(a=>a.active).length}</em>`:""}</button>`).join("")}</aside>
      <section class="sbody">${settingsBody(setCat)}</section><button class="sclose" title="Cerrar (Esc)">×</button>
      <footer class="sfoot"><button class="btn sm" data-a="restore">Restaurar apariencia</button><span class="grow"></span><button class="btn sm gold" data-a="ok">Listo</button></footer></div>`;
    const re=()=>openSettings();
    ov.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>openSettings(b.dataset.cat));
    ov.querySelector(".sclose").onclick=ov.querySelector('[data-a="ok"]').onclick=()=>ov.remove();
    ov.querySelector('[data-a="restore"]').onclick=()=>{SAVE.cfg=Object.assign({},CDEF);save();applyCfg();re()};
    const set=(k,v)=>{SAVE.cfg[k]=v;save();applyCfg();re()};
    ov.querySelectorAll("[data-th]").forEach(b=>b.onclick=()=>{SAVE.cfg.bg="";set("theme",b.dataset.th)});
    ov.querySelectorAll("[data-bg]").forEach(b=>b.onclick=()=>set("bg",b.dataset.bg));
    const bp=ov.querySelector("[data-bgp]");bp&&(bp.onchange=e=>set("bg",e.target.value));
    ov.querySelectorAll("[data-ty]").forEach(b=>b.onclick=()=>set("type",b.dataset.ty));
    ov.querySelectorAll("[data-col]").forEach(i=>i.onchange=()=>set(i.dataset.col,i.value));
    ov.querySelectorAll("input[data-k]").forEach(i=>i.onchange=()=>set(i.dataset.k,i.checked));
    ov.querySelectorAll("[data-wm]").forEach(b=>b.onclick=()=>set("wmMode",b.dataset.wm));
    ov.querySelectorAll("[data-wc]").forEach(b=>b.onclick=()=>set("wmColor",b.dataset.wc));
    ov.querySelectorAll("[data-r]").forEach(i=>{i.oninput=()=>{SAVE.cfg[i.dataset.r]=+i.value;i.nextElementSibling.textContent=i.value+"%";applyCfg()};i.onchange=()=>save()});
    ov.querySelectorAll("input[data-h]").forEach(i=>i.onchange=()=>{SAVE.hide[i.dataset.h]=!i.checked;save();applyHide();re()});
    ov.querySelectorAll("input[data-o]").forEach(i=>i.onchange=()=>{SAVE[i.dataset.o]=i.checked;save();applyLayoutPrefs();re()});
    const lk=ov.querySelector("input[data-link]");lk&&(lk.onchange=()=>{SAVE.link=lk.checked;save();paintLink()});
    const cl=ov.querySelector('[data-a="clean"]');cl&&(cl.onclick=()=>{const all=!allHidden();PARTS.forEach(([k])=>SAVE.hide[k]=all);save();applyHide();ov.remove();if(all)toast("Modo limpio · toca <b>Mostrar barras</b> o presiona <b>Esc</b> para volver")});
    const rs=ov.querySelector('[data-a="rs"]');rs&&(rs.onclick=()=>{delete SAVE.wlw;delete SAVE.mtfh;SAVE.split={c:.5,r:.5};save();applyLayoutPrefs();toast("Tamaños restablecidos")});
    const na=ov.querySelector('[data-a="newal"]');na&&(na.onclick=()=>{const t=curSym(active),i=bySym[t]||{},v=last[t];ov.remove();alertDialog({symbol:t,symbol_name:i.display_name||t,kind:"nivel",price:v!=null?+(+v).toFixed(prec(i.pip)):null,price2:null})});
    ov.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{try{await API.deleteChartAlert(b.dataset.del)}catch(e){}ALERTS=ALERTS.filter(a=>a.id!==b.dataset.del);paintAlerts();re()});
    ov.querySelectorAll("[data-re]").forEach(b=>b.onclick=async()=>{const a=ALERTS.find(x=>x.id===b.dataset.re);if(!a)return;try{const r=await API.saveChartAlert({id:a.id,symbol:a.symbol,symbol_name:a.symbol_name,kind:a.kind,price:a.price,price2:a.price2,note:a.note,active:true});Object.assign(a,r||{},{active:true})}catch(e){toast(esc(e.message||"No se pudo reactivar"))}paintAlerts();re()})}
  addEventListener("keydown",e=>{if(e.key==="Escape"){const m=$(".smodal");if(m){m.remove();e.stopImmediatePropagation();return}const pn=document.querySelector(".wmenu.panel");if(pn){pn.remove();e.stopImmediatePropagation()}}},true);

  /* ======================= ALERTAS ======================= */
  let ALERTS=[];
  function paintAlerts(){const n=ALERTS.filter(a=>a.active).length,b=$("#alc");b.hidden=!n;b.textContent=n;panes.forEach(p=>{try{p.kc.renderAlerts()}catch(e){}})}
  async function loadAlerts(){try{ALERTS=(await API.chartAlerts())||[]}catch(e){ALERTS=[]}paintAlerts()}
  function alertDialog(a){let ov=document.createElement("div");ov.className="smodal";appw.appendChild(ov);ov.onclick=e=>{if(e.target===ov)ov.remove()};
    const pp=bySym[a.symbol]?prec(bySym[a.symbol].pip):3;
    ov.innerHTML=`<div class="abox" role="dialog"><div class="ah">🔔 Nueva alerta</div><p class="shelp">${esc(a.symbol_name||a.symbol)}</p>
      <div class="seg"><button data-k="nivel" class="${a.kind!=="zona"?"on":""}">Cuando toque un nivel</button><button data-k="zona" class="${a.kind==="zona"?"on":""}">Cuando entre a una zona</button></div>
      <label class="af"><span class="lv">${a.kind==="zona"?"Precio de arriba":"Precio"}</span><input type="number" step="any" data-p1 value="${a.price!=null?a.price:""}"></label>
      <label class="af z"${a.kind==="zona"?"":" hidden"}><span>Precio de abajo</span><input type="number" step="any" data-p2 value="${a.price2!=null?a.price2:""}"></label>
      <label class="af"><span>Nota (opcional)</span><input type="text" maxlength="120" data-n placeholder="Ej: zona de compra, esperar spike…"></label>
      <p class="shelp">Te llegará una notificación al celular cuando el precio llegue. Se revisa cada minuto.</p>
      <div class="sbtns"><button class="btn sm" data-a="x">Cancelar</button><button class="btn sm gold" data-a="ok">Crear alerta</button></div></div>`;
    let kind=a.kind==="zona"?"zona":"nivel";
    ov.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{kind=b.dataset.k;ov.querySelectorAll(".seg button").forEach(x=>x.classList.toggle("on",x===b));ov.querySelector(".af.z").hidden=kind!=="zona";ov.querySelector(".lv").textContent=kind==="zona"?"Precio de arriba":"Precio"});
    ov.querySelector('[data-a="x"]').onclick=()=>ov.remove();
    ov.querySelector('[data-a="ok"]').onclick=async e=>{const p1=parseFloat(ov.querySelector("[data-p1]").value),p2=parseFloat(ov.querySelector("[data-p2]").value);
      if(!isFinite(p1)||(kind==="zona"&&!isFinite(p2)))return toast("Escribe el precio");e.target.disabled=true;
      try{const r=await API.saveChartAlert({symbol:a.symbol,symbol_name:a.symbol_name||a.symbol,kind,price:kind==="zona"?Math.max(p1,p2):p1,price2:kind==="zona"?Math.min(p1,p2):null,note:ov.querySelector("[data-n]").value.trim(),active:true});
        ALERTS.unshift(r||{});paintAlerts();ov.remove();toast("🔔 Alerta creada. Te avisaremos al celular cuando el precio llegue.")}
      catch(err){e.target.disabled=false;toast(esc(/Máximo/.test(err.message)?err.message:"No se pudo crear la alerta. Intenta de nuevo."))}};
    setTimeout(()=>ov.querySelector("[data-p1]").focus(),30)}
  loadAlerts();setInterval(loadAlerts,60000);
  /* evitar selección accidental (doble clic, arrastres) y el menú del navegador, menos en los campos de texto */
  const editable=t=>t&&t.closest&&t.closest("input,textarea,[contenteditable]");
  document.addEventListener("selectstart",e=>{if(!editable(e.target))e.preventDefault()});
  document.addEventListener("dragstart",e=>{if(!editable(e.target))e.preventDefault()});
  document.addEventListener("contextmenu",e=>{if(!editable(e.target))e.preventDefault()});
  /* ---------- barra flotante de dibujos favoritos (se arrastra adonde quieras) ---------- */
  SAVE.toolFav=Array.isArray(SAVE.toolFav)?SAVE.toolFav.flatMap(k=>k==="eagPosition"?["eagLong","eagShort"]:[k]):["segment","horizontalStraightLine","eagZone","fibonacciLine","eagLong","eagShort","eagMeasure"];
  const tfav=document.createElement("div");tfav.className="tfav";appw.appendChild(tfav);
  function placeTfav(){const r=grid.getBoundingClientRect(),w=tfav.offsetWidth||200,h=tfav.offsetHeight||36;
    let x,y;if(SAVE.tfavPos){x=SAVE.tfavPos.x;y=SAVE.tfavPos.y}else{x=r.left+r.width/2-w/2;y=r.top+(SAVE.hide.pb?36:76)}
    tfav.style.left=clamp(x,4,innerWidth-w-4)+"px";tfav.style.top=clamp(y,4,innerHeight-h-4)+"px"}
  function renderToolFav(){const T=window.EAGTools;
    tfav.classList.toggle("vert",!!SAVE.tfavVert);
    tfav.innerHTML=`<span class="tg" title="Arrastra para mover · doble clic: girar">⋮⋮</span>`+SAVE.toolFav.map(k=>`<button data-t="${k}" title="${esc(T.name(k))}">${T.icon(k,18)}</button>`).join("")+
      `<button class="tx" title="Ocultar barra (vuelve en Vista)">×</button>`;
    tfav.style.display=SAVE.toolFav.length&&!SAVE.hide.tf?"":"none";
    tfav.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{const p=panes[active];if(p&&p.kc.startTool){tfav.querySelectorAll("[data-t]").forEach(x=>x.classList.toggle("on",x===b));p.kc.startTool(b.dataset.t);setTimeout(()=>b.classList.remove("on"),4000)}});
    tfav.querySelector(".tx").onclick=()=>{SAVE.hide.tf=true;save();applyHide()};
    const g=tfav.querySelector(".tg");
    g.addEventListener("pointerdown",e=>{if(e.button!==0)return;e.preventDefault();const r=tfav.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;try{g.setPointerCapture(e.pointerId)}catch(x){}tfav.classList.add("moving");
      const mv=ev=>{SAVE.tfavPos={x:Math.round(ev.clientX-dx),y:Math.round(ev.clientY-dy)};placeTfav()};
      const up=()=>{g.removeEventListener("pointermove",mv);g.removeEventListener("pointerup",up);tfav.classList.remove("moving");save()};
      g.addEventListener("pointermove",mv);g.addEventListener("pointerup",up)});
    g.ondblclick=()=>{SAVE.tfavVert=!SAVE.tfavVert;save();renderToolFav()};
    requestAnimationFrame(placeTfav)}
  addEventListener("resize",()=>placeTfav());
  sortable(tfav,"[data-t]",SAVE.tfavVert?"y":"x",ord=>{SAVE.toolFav=ord;save();renderToolFav()});
  window.__tfavR=()=>{tfav.style.display=SAVE.toolFav.length&&!SAVE.hide.tf?"":"none";requestAnimationFrame(placeTfav)};
  applyHide();applyCfg();applyLayoutPrefs();setLayout(lay);renderToolFav();setTab(tab);renderTabs();
  ready.then(()=>{setTab(tab);renderTabs();panes.forEach(p=>{try{const t=p.kc.getSymbol().ticker;if(bySym[t]&&info(bySym[t]).pricePrecision!==p.kc.getSymbol().pricePrecision)p.kc.setSymbol(info(bySym[t]))}catch(e){}})});
  addEventListener("resize",()=>{if(mobile()&&!["l1","l2v","mtf"].includes(lay))setLayout("l1")});
}
})();
