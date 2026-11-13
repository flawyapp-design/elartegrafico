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
  if(!window.klinechartspro||!window.klinecharts)return gate("No se pudo cargar","Revisa tu conexión y recarga la página.",`<button class="btn gold" onclick="location.reload()">Recargar</button>`);
  start();
})();

function start(){
  const KP=window.klinechartspro,KC=window.klinecharts;
  try{KP.loadLocales("es-ES",ES)}catch(e){}
  try{KC.registerLocale&&KC.registerLocale("es-ES",ES_CORE)}catch(e){}
  const prof=API.profile()||{};
  const LAYS=[["l1",1,'<rect x="1" y="1" width="16" height="12" rx="1.5"/>'],["l2",2,'<rect x="1" y="1" width="7" height="12" rx="1.5"/><rect x="10" y="1" width="7" height="12" rx="1.5"/>'],
    ["l2v",2,'<rect x="1" y="1" width="16" height="5" rx="1.5"/><rect x="1" y="8" width="16" height="5" rx="1.5"/>'],["l3",3,'<rect x="1" y="1" width="7" height="12" rx="1.5"/><rect x="10" y="1" width="7" height="5" rx="1.5"/><rect x="10" y="8" width="7" height="5" rx="1.5"/>'],
    ["l4",4,'<rect x="1" y="1" width="7" height="5" rx="1.5"/><rect x="10" y="1" width="7" height="5" rx="1.5"/><rect x="1" y="8" width="7" height="5" rx="1.5"/><rect x="10" y="8" width="7" height="5" rx="1.5"/>'],
    ["l6",6,'<rect x="1" y="1" width="4.3" height="5" rx="1"/><rect x="6.85" y="1" width="4.3" height="5" rx="1"/><rect x="12.7" y="1" width="4.3" height="5" rx="1"/><rect x="1" y="8" width="4.3" height="5" rx="1"/><rect x="6.85" y="8" width="4.3" height="5" rx="1"/><rect x="12.7" y="8" width="4.3" height="5" rx="1"/>']];
  const mobile=()=>innerWidth<=900;
  app.innerHTML=`<div class="app">
    <header class="top">
      <a class="brand" href="${ACAD}" title="Volver a la academia"><img src="assets/logo_circle.webp" alt=""><b>EAG <span>Charts</span></b></a>
      <div class="lay" role="group" aria-label="Distribución">${LAYS.map(([k,n,svg])=>`<button data-l="${k}" class="${n>2||k==="l2"?"dk":""}" title="${n} gráfico${n>1?"s":""}"><svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.4">${svg}</svg></button>`).join("")}</div>
      <span class="st" id="st"><i></i><span>Conectando…</span></span>
      <span class="grow"></span>
      <span class="who">${esc(prof.username||"")}</span>
      <button class="btn" id="wlb" title="Lista de mercados">☰ Mercados</button>
    </header>
    <div class="main" id="main">
      <div class="grid" id="grid"></div>
      <aside class="wl" id="wl">
        <div><h3>Mercados</h3><input id="q" type="search" placeholder="Buscar: Boom, Crash, EUR/USD…" autocomplete="off"></div>
        <div class="tabs" id="tabs">${TABS.map(([k,t])=>`<button data-t="${k}">${t}</button>`).join("")}</div>
        <div class="list" id="list"><p style="color:var(--dim);padding:8px">Cargando mercados…</p></div>
        <div class="foot">Datos en vivo de Deriv, solo para análisis educativo. No es asesoría financiera. Compara siempre con tu plataforma antes de operar.</div>
      </aside>
    </div></div>`;

  const stEl=$("#st"),main=$("#main"),list=$("#list"),q=$("#q");
  const feed=Feed(s=>{stEl.className="st "+(s==="live"?"live":s==="off"?"err":"");stEl.lastChild.textContent=s==="live"?"En vivo":s==="off"?"Reconectando…":"Conectando…"});

  /* ---------- lista de mercados ---------- */
  let SYMS=FALLBACK.slice(),bySym={};
  const idx=()=>{bySym={};SYMS.forEach(s=>bySym[s.symbol]=s)};idx();
  const ready=feed.ask({active_symbols:"brief"}).then(m=>{const a=(m.active_symbols||[]).map(norm).filter(s=>s.symbol&&!s.is_trading_suspended);if(a.length){SYMS=a;idx()}}).catch(()=>{});
  const findInfo=t=>bySym[t]?info(bySym[t]):{ticker:t,name:t,shortName:t,exchange:"Deriv",pricePrecision:3,volumePrecision:0};

  /* Deriv no deja suscribirse dos veces al mismo flujo: un solo flujo por mercado+temporalidad, repartido a los gráficos */
  const hub=new Map();
  function hubOn(k,who,sym,g,cb){let h=hub.get(k);
    if(!h){h=new Map();hub.set(k,h);feed.sub("c:"+k,{ticks_history:sym,style:"candles",granularity:g,end:"latest",count:1},m=>{
      const o=m.ohlc;if(!o)return;const d={timestamp:(+o.open_time)*1000,open:+o.open,high:+o.high,low:+o.low,close:+o.close,volume:0};hub.get(k)&&hub.get(k).forEach(f=>{try{f(d)}catch(e){}})},()=>{})}
    h.set(who,cb)}
  function hubOff(k,who){const h=hub.get(k);if(!h)return;h.delete(who);if(!h.size){hub.delete(k);feed.unsub("c:"+k)}}
  /* ---------- datafeed para KLineChart Pro (uno por gráfico) ---------- */
  let paneSeq=0;
  function Datafeed(){
    const me="p"+(++paneSeq)+":";
    return{
      async searchSymbols(q){await ready;q=String(q||"").trim().toLowerCase();
        return SYMS.filter(s=>!q||s.symbol.toLowerCase().includes(q)||String(s.display_name).toLowerCase().includes(q)).sort((a,b)=>tabOf(a).localeCompare(tabOf(b))||bcOrder(a)-bcOrder(b)).slice(0,200).map(info)},
      async getHistoryKLineData(sym,period,from,to){
        const g=gran(period),end=Math.floor(Math.min(to,Date.now())/1000),start=Math.max(1,Math.floor(from/1000));
        if(end<=start)return[];
        try{const m=await feed.ask({ticks_history:sym.ticker,style:"candles",granularity:g,start,end,count:5000,adjust_start_time:1});
          return(m.candles||[]).map(c=>({timestamp:c.epoch*1000,open:+c.open,high:+c.high,low:+c.low,close:+c.close,volume:0}))}
        catch(e){console.warn("[EAG] historial",sym.ticker,e.message);return[]}},
      subscribe(sym,period,cb){const k=sym.ticker+":"+gran(period);hubOn(k,me,sym.ticker,gran(period),cb)},
      unsubscribe(sym,period){hubOff(sym.ticker+":"+gran(period),me)}
    }
  }

  /* ---------- gráficos ---------- */
  const DEF=["BOOM1000","CRASH1000","BOOM500","CRASH500","BOOM300N","CRASH300N"];
  SAVE.panes=Array.isArray(SAVE.panes)?SAVE.panes:[];
  const grid=$("#grid"),panes=[];let active=0;
  const STY={grid:{horizontal:{color:"rgba(31,50,102,.55)"},vertical:{color:"rgba(31,50,102,.55)"}},
    candle:{bar:{upColor:"#35c4a2",downColor:"#ec5b52",noChangeColor:"#93a1c4",upBorderColor:"#35c4a2",downBorderColor:"#ec5b52",noChangeBorderColor:"#93a1c4",upWickColor:"#35c4a2",downWickColor:"#ec5b52",noChangeWickColor:"#93a1c4"},
      priceMark:{last:{upColor:"#35c4a2",downColor:"#ec5b52"}}}};
  function makePane(i){
    const el=document.createElement("div");el.className="pane";el.innerHTML='<div class="kc"></div>';grid.appendChild(el);
    const sv=SAVE.panes[i]||{},sym=sv.s||DEF[i%DEF.length],per=perOf(sv.p||(i===0?"5m":"1m"));
    const kc=new KP.KLineChartPro({container:el.firstChild,symbol:findInfo(sym),period:per,periods:PERIODS,datafeed:Datafeed(),
      theme:"dark",locale:"es-ES",timezone:TZ,drawingBarVisible:!mobile()&&i===0,mainIndicators:[],subIndicators:[],
      watermark:'<span style="font:700 18px/1 sans-serif;letter-spacing:.2em;white-space:nowrap;color:rgba(216,176,98,.07)">EL ARTE GRÁFICO</span>'});
    setTimeout(()=>{try{kc.setStyles(STY)}catch(e){}},0);
    el.addEventListener("pointerdown",()=>setActive(i),true);
    return{el,kc};
  }
  function setActive(i){active=i;panes.forEach((p,j)=>p.el.classList.toggle("act",j===i&&visible()>1));paintList()}
  const visible=()=>(LAYS.find(l=>l[0]===lay)||LAYS[0])[1];
  let lay=SAVE.layout&&LAYS.some(l=>l[0]===SAVE.layout)?SAVE.layout:"l1";
  function setLayout(k){
    if(mobile()&&!["l1","l2v"].includes(k))k="l1";
    lay=k;SAVE.layout=k;save();const n=visible();
    grid.className="grid "+k;
    while(panes.length<n)panes.push(makePane(panes.length));
    panes.forEach((p,j)=>p.el.style.display=j<n?"":"none");
    document.querySelectorAll(".lay button").forEach(b=>b.classList.toggle("on",b.dataset.l===k));
    if(active>=n)active=0;setActive(active);
    requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
  }
  document.querySelectorAll(".lay button").forEach(b=>b.onclick=()=>setLayout(b.dataset.l));
  /* recordar mercado y temporalidad de cada gráfico */
  setInterval(()=>{let ch=false;panes.forEach((p,j)=>{try{const s=p.kc.getSymbol().ticker,t=p.kc.getPeriod().text,o=SAVE.panes[j]||{};if(o.s!==s||o.p!==t){SAVE.panes[j]={s,p:t};ch=true}}catch(e){}});if(ch){save();paintList()}},1500);
  setLayout(lay);

  /* ---------- panel de mercados ---------- */
  SAVE.fav=Array.isArray(SAVE.fav)?SAVE.fav:["BOOM1000","CRASH1000","BOOM500","CRASH500"];
  let tab=SAVE.tab||"bc",shown=[];const last={},dayOpen={};
  $("#wlb").onclick=()=>{if(mobile())main.classList.toggle("wlopen");else{main.classList.toggle("nowl");SAVE.nowl=main.classList.contains("nowl");save();requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")))}};
  if(SAVE.nowl&&!mobile())main.classList.add("nowl");
  function setTab(t){tab=t;SAVE.tab=t;save();document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.t===t));renderList()}
  document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{q.value="";setTab(b.dataset.t)});
  q.oninput=()=>renderList();
  const fmt=(v,s)=>v==null?"—":(+v).toFixed(prec(s.pip));
  function renderList(){
    const k=q.value.trim().toLowerCase();
    let a=k?SYMS.filter(s=>s.symbol.toLowerCase().includes(k)||String(s.display_name).toLowerCase().includes(k)):tab==="fav"?SAVE.fav.map(x=>bySym[x]).filter(Boolean):SYMS.filter(s=>tabOf(s)===tab);
    a=a.slice().sort((x,y)=>tab==="fav"&&!k?0:(bcOrder(x)-bcOrder(y))||String(x.display_name).localeCompare(y.display_name)).slice(0,60);
    shown=a.map(s=>s.symbol);
    list.innerHTML=a.length?a.map(s=>`<div class="sy" data-s="${esc(s.symbol)}"><b>${SAVE.fav.includes(s.symbol)?'<span class="fv on" title="Quitar de favoritos">★</span>':'<span class="fv" title="Agregar a favoritos">☆</span>'} ${esc(s.display_name)}</b><span class="p" data-p></span><small>${esc(s.symbol)}${s.exchange_is_open===0?" · cerrado":""}</small><span class="c" data-c></span></div>`).join("")
      :`<p style="color:var(--dim);padding:8px">${tab==="fav"?"Toca ☆ en cualquier mercado para agregarlo aquí.":"No hay mercados con ese nombre."}</p>`;
    list.querySelectorAll(".sy").forEach(r=>{r.onclick=e=>{const s=r.dataset.s;
      if(e.target.classList.contains("fv")){SAVE.fav=SAVE.fav.includes(s)?SAVE.fav.filter(x=>x!==s):SAVE.fav.concat(s);save();renderList();return}
      const p=panes[active];if(p){p.kc.setSymbol(findInfo(s));SAVE.panes[active]=Object.assign({},SAVE.panes[active],{s});save()}
      if(mobile())main.classList.remove("wlopen");paintList()}});
    paintList();watch();
  }
  function paintList(){
    const cur=new Set();try{panes.slice(0,visible()).forEach(p=>cur.add(p.kc.getSymbol().ticker))}catch(e){}
    let act=null;try{act=panes[active].kc.getSymbol().ticker}catch(e){}
    list.querySelectorAll(".sy").forEach(r=>{const s=r.dataset.s;r.classList.toggle("on",s===act);r.style.boxShadow=cur.has(s)&&s!==act?"inset 3px 0 0 rgba(216,176,98,.5)":"";paintRow(r)})}
  function paintRow(r){const s=r.dataset.s,i=bySym[s]||{},v=last[s],o=dayOpen[s],pe=r.querySelector("[data-p]"),ce=r.querySelector("[data-c]");
    pe.textContent=fmt(v,i);if(v!=null&&o){const ch=(v-o)/o*100;ce.textContent=(ch>=0?"+":"")+ch.toFixed(2)+"%";ce.className="c "+(ch>=0?"up":"dn")}else ce.textContent=""}
  /* precios en vivo solo de los mercados visibles en la lista */
  let watching=new Set(),wt=null;
  function watch(){clearTimeout(wt);wt=setTimeout(()=>{
    const want=new Set(shown.slice(0,40));
    watching.forEach(s=>{if(!want.has(s)){feed.unsub("tick:"+s);watching.delete(s)}});
    want.forEach(s=>{if(watching.has(s))return;watching.add(s);
      feed.sub("tick:"+s,{ticks:s},m=>{if(m.tick){const r=list.querySelector(`.sy[data-s="${CSS.escape(s)}"]`);const prev=last[s];last[s]=+m.tick.quote;
        if(r){paintRow(r);const pe=r.querySelector("[data-p]");if(prev!=null&&pe){pe.className="p "+(last[s]>prev?"up":last[s]<prev?"dn":"")}}}},()=>{});
      if(dayOpen[s]==null)feed.ask({ticks_history:s,style:"candles",granularity:86400,end:"latest",count:1}).then(m=>{const c=(m.candles||[])[0];if(c){dayOpen[s]=+c.open;if(last[s]==null)last[s]=+c.close;const r=list.querySelector(`.sy[data-s="${CSS.escape(s)}"]`);r&&paintRow(r)}}).catch(()=>{});
    })},250)}
  ready.then(()=>{setTab(tab);panes.forEach((p,j)=>{try{const t=p.kc.getSymbol().ticker;if(bySym[t]&&info(bySym[t]).pricePrecision!==p.kc.getSymbol().pricePrecision)p.kc.setSymbol(info(bySym[t]))}catch(e){}})});
  setTab(tab);
  addEventListener("resize",()=>{if(mobile()&&!["l1","l2v"].includes(lay))setLayout("l1")});
}
})();
