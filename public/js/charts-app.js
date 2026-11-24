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
/* instalar como app independiente */
const INST={evt:null};
const standalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const inApp=()=>/FBAN|FBAV|Instagram|TikTok|musical_ly|Bytedance|Telegram|WhatsApp|Line\//i.test(navigator.userAgent);
addEventListener("beforeinstallprompt",e=>{e.preventDefault();INST.evt=e;document.querySelectorAll("[data-inst]").forEach(b=>b.hidden=standalone())});
addEventListener("appinstalled",()=>{INST.evt=null;document.querySelectorAll("[data-inst]").forEach(b=>b.hidden=true)});
if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).catch(()=>{});
const LS="eag_charts_v1";
const load=()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}")||{}}catch(e){return{}}};
const SAVE=load();
/* la vista se guarda aparte en celular y en PC: lo que acomodas en uno no le cambia el otro
   (barras visibles, diseño, tamaños, posiciones, tamaño de letra de la regla). Lo demás (dibujos, favoritos, colores) sí se comparte. */
/* celular o PC según el APARATO (pantalla táctil sin mouse, o navegador de celular), no por el ancho de la ventana:
   un PC con la ventana pequeña (para el live) sigue siendo PC y puede agrandar la regla de precios y todo lo demás */
const DEV=((window.matchMedia&&matchMedia("(hover:none) and (pointer:coarse)").matches)||/Android|iPhone|iPod|Mobile/i.test(navigator.userAgent))?"cel":"pc";
window.__eagDev=DEV;
const VIEWK=["hide","layout","split","wlw","mtfh","mtfTop","wlLeft","fabPos","ftPos","tfavVert","dbRight","pmh","link"],VIEWC=["font","wmSize"],VIEWS=["hp","pp","hs"];
const dvKey=()=>DEV+"|"+((SAVE.prof&&SAVE.prof.cur)||"p1");   /* cada perfil (Operativa/Análisis) tiene su vista en celular y en PC */
function devSnap(){if(window.__noSnap)return;const d={};VIEWK.forEach(k=>{if(SAVE[k]!==undefined)d[k]=JSON.parse(JSON.stringify(SAVE[k]))});d.cfg={};VIEWC.forEach(k=>{if(SAVE.cfg&&SAVE.cfg[k]!==undefined)d.cfg[k]=SAVE.cfg[k]});
  d.soc={};VIEWS.forEach(k=>{if(SAVE.soc&&SAVE.soc[k]!==undefined)d.soc[k]=JSON.parse(JSON.stringify(SAVE.soc[k]))});
  SAVE.dv=Object.assign({},SAVE.dv||{});SAVE.dv[dvKey()]=d}
function devApply(){const d=SAVE.dv&&SAVE.dv[dvKey()];
  if(d){VIEWK.forEach(k=>{if(d[k]!==undefined)SAVE[k]=JSON.parse(JSON.stringify(d[k]));else delete SAVE[k]});if(SAVE.cfg)VIEWC.forEach(k=>{if(d.cfg&&d.cfg[k]!==undefined)SAVE.cfg[k]=d.cfg[k];else delete SAVE.cfg[k]});
    if(SAVE.soc)VIEWS.forEach(k=>{if(d.soc&&d.soc[k]!==undefined)SAVE.soc[k]=d.soc[k];else delete SAVE.soc[k]})}
  else if(DEV==="cel"){/* primera vez en el celular: arranca con la vista del celular, no con la del PC */VIEWK.forEach(k=>delete SAVE[k]);if(SAVE.cfg)VIEWC.forEach(k=>delete SAVE.cfg[k]);if(SAVE.soc)VIEWS.forEach(k=>delete SAVE.soc[k])}
  devSnap();try{localStorage.setItem(LS,JSON.stringify(SAVE))}catch(e){}}
devApply();
const save=()=>{try{devSnap();localStorage.setItem(LS,JSON.stringify(SAVE))}catch(e){}window.__eagSync&&window.__eagSync()};

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
/* gráfico de ticks: cada movimiento del precio (como el gráfico de ticks de MT5) */
const TICK={multiplier:1,timespan:"tick",text:"Ticks"};
/* temporalidades personalizadas ("7m", "3H", "2D"): Deriv no las da, se arman juntando velas más pequeñas */
const STDG=[60,120,180,300,600,900,1800,3600,7200,14400,28800,86400];
const ctfParse=t=>{const m=String(t||"").match(/^(\d+)(m|H|D)$/);if(!m)return null;const n=+m[1],u=m[2];if(!(n>0))return null;
  const g=n*(u==="m"?60:u==="H"?3600:86400);if(g<60||g>7*86400)return null;return{multiplier:n,timespan:u==="m"?"minute":u==="H"?"hour":"day",text:t,custom:true}};
const perFind=t=>t==="Ticks"?TICK:PERIODS.find(p=>p.text===t)||ctfParse(t);
const perOf=t=>perFind(t)||PERIODS[0];

/* ===================== Datos de Deriv (WebSocket) ===================== */
const APPID=CFG.DERIV_APP_ID||1089;
const ENDPOINTS=["wss://api.derivws.com/trading/v1/options/ws/public",`wss://ws.derivws.com/websockets/v3?app_id=${APPID}&l=ES`];
function Feed(onStatus){
  let ws=null,ep=0,opened=false,backoff=1000,rid=1,ping=null,paused=false,rt=null;
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
    ws.onclose=()=>{clearInterval(ping);if(paused)return;
      if(!opened)ep=(ep+1)%ENDPOINTS.length;st("off");retry()};
    ws.onerror=()=>{};
  }
  function retry(){clearTimeout(rt);if(paused)return;rt=setTimeout(connect,backoff);backoff=Math.min(backoff*2,15000)}
  function raw(o){const t=JSON.stringify(o);if(ws&&ws.readyState===1)ws.send(t)}
  function ask(o,ms=25000){const id=rid++;return new Promise((res,rej)=>{const t=JSON.stringify(Object.assign({},o,{req_id:id}));pend.set(id,{res,rej,t});if(ws&&ws.readyState===1)ws.send(t);
    setTimeout(()=>{if(pend.has(id)){pend.delete(id);rej(new Error("Tiempo de espera agotado"))}},ms)})}
  function sendSub(s){if(s.rid)byRid.delete(s.rid);s.rid=rid++;s.id=null;byRid.set(s.rid,s);raw(Object.assign({},s.req,{req_id:s.rid,subscribe:1}))}
  function sub(key,req,on,err){unsub(key);const s={key,req,on,err};subs.set(key,s);sendSub(s)}
  function unsub(key){const s=subs.get(key);if(!s)return;subs.delete(key);byRid.delete(s.rid);if(s.id)raw({forget:s.id})}
  /* app en segundo plano: se cierra la conexión (cero datos) y al volver se reabre con todo lo suscrito */
  function pause(){if(paused)return;paused=true;clearTimeout(rt);clearInterval(ping);st("pause");try{ws&&ws.close()}catch(e){}ws=null}
  function resume(){if(!paused)return;paused=false;backoff=1000;connect()}
  connect();
  return{ask,sub,unsub,has:k=>subs.has(k),pause,resume,paused:()=>paused};
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
  window.chartsPlan=()=>{try{if(API.isAdmin())return true;if(!API.isPremium())return false;const p=(API.profile&&API.profile())||{};return["plata","oro","diamond"].includes(String(p.plan||"").toLowerCase())}catch(e){return false}};
  if(!API.user())return gate("EAG Charts","Gráficos en vivo de Boom y Crash, sintéticos, forex y más, con herramientas de análisis. Ingresa con tu cuenta de El Arte Gráfico.",`<a class="btn gold" href="${MAIN}#entrar">Ingresar</a><a class="btn" href="${MAIN}#registro">Crear cuenta</a>`);
  /* la conexión con Deriv arranca ya, mientras se revisa la cuenta (antes esperaba a que todo lo demás terminara) */
  try{window.__feedSt=null;window.__feedPre=Feed(s=>{window.__feedSt=s;if(window.__feedStCb)window.__feedStCb(s)});
    window.__symsPre=window.__feedPre.ask({active_symbols:"brief"}).catch(()=>null)}catch(e){}

  /* prueba gratis de 3 días para todos los registrados (empieza la primera vez que abren EAG Charts) */
  /* EAG Charts viene con los planes Plata, Oro y Diamond (por el mismo tiempo del plan). Cobre y cuentas gratis: prueba de 3 días */
  /* VERSIÓN GRATIS: los registrados sin plan Plata/Oro/Diamond (y sin prueba activa) usan EAG Charts básico.
     Se puede apagar en Admin → EAG Charts ("Charts gratis para registrados"). */
  const fastBoot=(()=>{try{const f=sessionStorage.getItem("eag_fast_boot");sessionStorage.removeItem("eag_fast_boot");return f==="1"}catch(e){return false}})();
  const pSite=API.site?API.site().catch(()=>({})):Promise.resolve({}),pTrial=Promise.resolve(null),/* la prueba de 3 días se quitó: EAG Charts ya es público (versión gratis + planes) */
    pState=(!fastBoot&&API.chartState)?API.chartState().catch(()=>null):Promise.resolve(null);
  let SITE0={};try{SITE0=(await pSite)||{}}catch(e){SITE0={}}
  window.__site0=SITE0;const freeOn=SITE0.chartFree!==false;
  /* afiliados de Deriv verificados: desbloquean gratis las funciones que elija el admin (Admin → EAG Charts) */
  try{const me=(API.profile&&API.profile())||{};const on=SITE0.chartAffOn!==false;window.__affKeys=new Set(me.affiliate&&on?(Array.isArray(SITE0.chartAff)?SITE0.chartAff:["tools","ind","alerts","az"]):[]);window.__aff=!!me.affiliate}catch(e){window.__affKeys=new Set();window.__aff=false}
  if(!chartsPlan()){
    if(freeOn)window.__free=true;
    else{
    return gate("Incluido en Plata, Oro y Diamond","EAG Charts viene con los planes Plata, Oro y Diamond, por el mismo tiempo de tu plan (Diamond, de por vida). Activa uno de esos planes y vuelve a esta página.",`<a class="btn gold" href="${MAIN}#premium">Ver planes</a><a class="btn" href="${ACAD}">Ir a la academia</a>`)}}
  /* traer lo guardado en la cuenta si es más nuevo que lo de este navegador */
  try{if(API.chartState){const r=await pState;const lt=+(localStorage.getItem("eag_sync_ts")||0);
    if(r&&r.data&&new Date(r.updated_at).getTime()>lt+1000){const d=r.data;if(d.prefs){Object.keys(SAVE).forEach(k=>delete SAVE[k]);Object.assign(SAVE,d.prefs);devApply();localStorage.setItem(LS,JSON.stringify(SAVE))}
      if(d.draw)localStorage.setItem("eag_draw_v1",JSON.stringify(d.draw));localStorage.setItem("eag_sync_ts",String(new Date(r.updated_at).getTime()))}}}catch(e){}
  if(!window.klinecharts||!window.EAGWidget)return gate("No se pudo cargar","Revisa tu conexión y recarga la página.",`<button class="btn gold" onclick="location.reload()">Recargar</button>`);
  start();
})();

/* ---------- fin de la prueba: pedir calificación y recomendaciones ---------- */
function fbForm(done){return`<div class="fbf"><div class="fbstars" role="radiogroup" aria-label="Calificación">${[1,2,3,4,5].map(n=>`<button type="button" data-st="${n}" aria-label="${n} estrellas">★</button>`).join("")}</div>
  <textarea maxlength="2000" placeholder="¿Qué te gustó? ¿Qué mejorarías? ¿Qué herramienta te faltó? Todo nos sirve."></textarea>
  <button class="btn gold" data-send>Enviar recomendaciones</button><p class="fbmsg"></p></div>`}
function wireFb(root,after){let r=0;const st=[...root.querySelectorAll("[data-st]")];const paint=()=>st.forEach(b=>b.classList.toggle("on",+b.dataset.st<=r));
  st.forEach(b=>b.onclick=()=>{r=+b.dataset.st;paint()});
  root.querySelector("[data-send]").onclick=async e=>{const msg=root.querySelector(".fbmsg");if(!r){msg.textContent="Elige de 1 a 5 estrellas.";return}e.target.disabled=true;
    try{await API.chartFeedback(r,root.querySelector("textarea").value.trim());after&&after()}catch(err){e.target.disabled=false;msg.textContent="No se pudo enviar. Intenta de nuevo."}}}
function trialEnded(t){
  const plans=`<a class="btn gold" href="${MAIN}#premium">Ver planes</a><a class="btn" href="${ACAD}">Ir a la academia</a>`;
  if(t.has_feedback)return gate("Tu prueba de EAG Charts terminó","¡Gracias por tus recomendaciones! Con ellas estamos mejorando la plataforma. Para seguir usándola, activa un plan Plata, Oro o Diamond.",plans);
  app.innerHTML=`<div class="gate fbgate"><img src="assets/logo_circle.webp" alt=""><h1>Terminó tu prueba de 3 días</h1><p>Antes de seguir, ayúdanos a mejorar: ¿cómo te pareció EAG Charts?</p>${fbForm()}<div class="row">${plans}</div></div>`;
  wireFb(app,()=>gate("¡Gracias!","Tus recomendaciones nos llegan directo. Estamos mejorando EAG Charts con lo que nos dicen. Para seguir usándolo, activa un plan Plata, Oro o Diamond.",plans))}

function trialEndedFree(t){
  app.innerHTML=`<div class="gate fbgate"><img src="assets/logo_circle.webp" alt=""><h1>Terminó tu prueba completa</h1><p>Puedes seguir usando <b>EAG Charts gratis</b> (con multitemporalidad y varios mercados) o activar Plata, Oro o Diamond para tenerlo todo. Antes, ¿cómo te pareció?</p>${fbForm()}
    <div class="row"><button class="btn" data-free>Seguir con la versión gratis</button><a class="btn gold" href="${MAIN}#premium">Ver planes</a></div></div>`;
  const go=()=>{try{localStorage.setItem("eag_fb_skip","1")}catch(e){}window.__free=true;start()};
  app.querySelector("[data-free]").onclick=go;wireFb(app,go)}
function start(){
  const KP=window.klinechartspro,KC=window.klinecharts;
  /* ---------- versión gratis ---------- */
  const FREE=!!window.__free,S0=window.__site0||{};
  const AFFK=window.__affKeys||new Set(),AFF_DEF=["tools","ind","alerts","az"];
  const LOCK={tools:FREE&&!AFFK.has("tools"),ind:FREE&&!AFFK.has("ind"),alerts:FREE&&!AFFK.has("alerts"),az:FREE&&!AFFK.has("az")};
  const AFF_NAMES={tools:"herramientas avanzadas de dibujo",ind:"indicadores sin límite",alerts:"alertas al celular",az:"zonas automáticas de soporte y resistencia",replay:"Replay del mercado",prac:"Práctica guiada"};
  const affOffer=()=>{if(S0.chartAffOn===false)return"";const k=(Array.isArray(S0.chartAff)?S0.chartAff:AFF_DEF).filter(x=>AFF_NAMES[x]);if(!k.length)return"";const L=k.map(x=>AFF_NAMES[x]);return L.length>1?L.slice(0,-1).join(", ")+" y "+L[L.length-1]:L[0]};
  const FREE_IND=S0.chartFreeInd!=null&&S0.chartFreeInd!==""?Math.max(0,+S0.chartFreeInd||0):2;
  const FREE_TOOLS=new Set(["segment","rayLine","straightLine","horizontalStraightLine","horizontalRayLine","horizontalSegment","verticalStraightLine","priceLine","eagZone","eagRect","eagText","eagNote","eagMeasure","crossLine","dateRange","priceRange","arrowMarkUp","arrowMarkDown","flagMark","eagEmoji","priceLabel","eagHighlighter"]);
  const PLAN_URL=MAIN+"#premium";
  function upsell(what){if(!FREE)return;const off=window.__aff?"":affOffer();let m=document.querySelector(".upsell");if(m)m.remove();m=document.createElement("div");m.className="upsell";
    m.innerHTML=`<div class="ups-card" role="dialog" aria-modal="true"><div class="ups-ic">🔒</div><h3>${esc(what)}</h3><p class="ups-sub">Disponible en EAG Charts completo: planes Plata, Oro y Diamond</p>
      <p>Estás usando la <b>versión gratis</b>: multitemporalidad, varios gráficos y mercados, líneas y zonas, y ${FREE_IND} indicador${FREE_IND===1?"":"es"}. Con <b>Plata, Oro o Diamond</b> tienes todas las herramientas (Fibonacci, zonas de compra/venta, posiciones, patrones y ondas), indicadores sin límite, alertas al celular, y el Replay y la Práctica.</p>
      ${off?`<div class="ups-aff"><b>Hazte miembro verificado de la comunidad</b> Es gratis: vinculas tu cuenta de Deriv a El Arte Gráfico, así Deriv sabe que eres de la comunidad y tienes nuestro respaldo (depósitos, retiros y soporte). Además desbloqueas <b>gratis</b>: ${esc(off)}.</div>`:""}
      <div class="row"><button class="btn" data-x>Seguir gratis</button>${off?`<a class="btn" href="${MAIN}#miembro">Hacerme miembro</a>`:""}<a class="btn gold" href="${PLAN_URL}">Ver planes</a></div></div>`;
    document.body.appendChild(m);const cl=()=>m.remove();m.onclick=e=>{if(e.target===m)cl()};m.querySelector("[data-x]").onclick=cl}
  window.__upsell=upsell;
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
      <button class="btn pfb" id="pfb" title="Perfil de trabajo: cada perfil guarda sus propios gráficos, mercados y dibujos. Toca para cambiar entre Operativa, Análisis o crear otro"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/></svg><span class="pfk">Perfil:</span><span class="pfn" id="pfn"></span>${ICON.caret}</button>
      <span class="st" id="st"><i></i><span>Conectando…</span></span>
      <span class="grow"></span>
      <span class="who">${esc(prof.username||"")}</span>
      ${window.__free?`<a class="btn ic freeb" href="${MAIN}#premium" title="${window.__affKeys&&window.__affKeys.size?"Miembro verificado: tienes funciones extra desbloqueadas. Mejora a Plata, Oro o Diamond para tenerlo todo":"Estás en la versión gratis. Mejora a Plata, Oro o Diamond para tenerlo todo"}"><span class="pi">⭐</span><span class="t">${window.__affKeys&&window.__affKeys.size?"Miembro · Mejorar":"Gratis · Mejorar"}</span></a>`:""}
      <button class="btn ic lzb" id="lzb" title="Puntero láser (para explicar). En Modo Clase tus alumnos lo ven. Esc para apagarlo." aria-pressed="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg></button>
      <button class="btn ic pipb" id="pipb" hidden aria-pressed="false" title="Gráfico flotante"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor"/></svg></button>
      <button class="btn ic clb" id="clb" title="Modo Clase y Zonas del profe"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="m7 12 3-3 2 2 4-4"/><path d="M9 20l3-4 3 4"/></svg><span class="t">Clase</span><i class="cdot"></i></button>
      <button class="btn ic chb" id="chb" title="Comunidad: chat privado y grupal, quién está conectado, compartir gráfico y llamadas de voz"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg><span class="t">Chat</span><b class="scnt"></b><em class="badge" hidden></em></button>
      <button class="btn ic prob" id="prob" title="Estudio: Replay del mercado y Práctica guiada (Premium)"><span class="pi">🎓</span><span class="t">Estudio</span><em>PRO</em></button>
      <button class="btn ic inst" id="instb" data-inst title="Instalar EAG Charts como app" hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg><span class="t">Instalar app</span></button>
      <button class="btn ic" id="alb" title="Alertas de precio"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg><span class="t">Alertas</span><em class="badge" id="alc" hidden></em></button>
      <button class="btn ic" id="cfgb" title="Configuración: apariencia, barras, marca de agua, alertas y atajos"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span class="t">Configuración</span></button>
      <button class="btn ic trb" id="trb" title="Operar con tu cuenta de Deriv (multiplicadores)" hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5-5 5 5"/><path d="M4 20h16"/></svg><span class="t">Operar</span></button>
      <button class="btn ic" id="wlb" title="Lista de mercados">${ICON.list}<span class="t">Mercados</span></button>
      <button class="btn ic fsb" id="fsb" title="Pantalla completa (toda la plataforma)" hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
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
  const feedSt=s=>{stEl.className="st "+(s==="live"?"live":s==="off"?"err":"");stEl.lastChild.textContent=s==="live"?"En vivo":s==="off"?"Reconectando…":s==="pause"?"En pausa":"Conectando…"};
  const feed=window.__feedPre||Feed(feedSt);if(window.__feedPre){window.__feedStCb=feedSt;if(window.__feedSt)feedSt(window.__feedSt)}
  const relayout=()=>requestAnimationFrame(()=>{window.dispatchEvent(new Event("resize"));mtfResize()});

  /* ---------- mercados ---------- */
  let SYMS=FALLBACK.slice(),bySym={};
  const idx=()=>{bySym={};SYMS.forEach(s=>bySym[s.symbol]=s)};idx();
  /* lista de mercados: primero la guardada (al instante) y luego la de Deriv */
  try{const c=JSON.parse(localStorage.getItem("eag_syms_v1")||"null");if(c&&Array.isArray(c.a)&&c.a.length&&Date.now()-c.t<3*864e5){SYMS=c.a;idx()}}catch(e){}
  const ready=(window.__symsPre||feed.ask({active_symbols:"brief"})).then(m=>{if(!m)return feed.ask({active_symbols:"brief"});return m}).then(m=>{const a=((m&&m.active_symbols)||[]).map(norm).filter(s=>s.symbol&&!s.is_trading_suspended);
    if(a.length){SYMS=a;idx();try{localStorage.setItem("eag_syms_v1",JSON.stringify({t:Date.now(),a}))}catch(e){}}}).catch(()=>{});
  const findInfo=t=>bySym[t]?info(bySym[t]):{ticker:t,name:t,shortName:t,exchange:"Deriv",pricePrecision:3,volumePrecision:0};
  const short=s=>String((bySym[s]||{}).display_name||s).replace(/ Index$/,"");

  const hub=new Map();
  const AGG=new Map();
  function hubOn(k,who,sym,g,cb){
    if(!STDG.includes(g)){let A=AGG.get(k);
      if(!A){const b=baseOf(g),ms=g*1000;A={subs:new Map(),parts:new Map(),bk:0,who:"agg:"+k};AGG.set(k,A);
        const emit=()=>{const L=[...A.parts.values()].sort((x,y)=>x.timestamp-y.timestamp);if(!L.length)return;const d=aggr(L,g)[0];A.subs.forEach(f=>{try{f(d)}catch(e){}})};
        const add=c=>{const bk=Math.floor(c.timestamp/ms)*ms;if(bk!==A.bk){if(bk<A.bk)return;A.bk=bk;A.parts.clear()}A.parts.set(c.timestamp,c)};
        /* se cargan las velas pequeñas que ya van en la vela grande actual, para que el máximo y el mínimo salgan bien */
        feed.ask({ticks_history:sym,style:"candles",granularity:b,end:"latest",count:g/b+1}).then(m=>{(m.candles||[]).map(toK).forEach(add);emit()}).catch(()=>{});
        hubOn(sym+":"+b,A.who,sym,b,c=>{add(c);emit()})}
      A.subs.set(who,cb);return}
    let h=hub.get(k);
    if(!h){h=new Map();hub.set(k,h);feed.sub("c:"+k,{ticks_history:sym,style:"candles",granularity:g,end:"latest",count:1},m=>{
      const o=m.ohlc;if(!o)return;const d={timestamp:(+o.open_time)*1000,open:+o.open,high:+o.high,low:+o.low,close:+o.close,volume:0};hub.get(k)&&hub.get(k).forEach(f=>{try{f(d)}catch(e){}})},()=>{})}
    h.set(who,cb)}
  function hubOff(k,who){const A=AGG.get(k);if(A){A.subs.delete(who);if(!A.subs.size){AGG.delete(k);const sym=k.split(":")[0],g=+k.split(":")[1];hubOff(sym+":"+baseOf(g),A.who)}return}
    const h=hub.get(k);if(!h)return;h.delete(who);if(!h.size){hub.delete(k);feed.unsub("c:"+k)}}
  const toK=c=>({timestamp:c.epoch*1000,open:+c.open,high:+c.high,low:+c.low,close:+c.close,volume:0});
  /* ---------- velas de cualquier temporalidad (las personalizadas se arman con la estándar más grande que la divida) ---------- */
  const baseOf=g=>{if(STDG.includes(g))return g;let b=60;STDG.forEach(s=>{if(s<g&&g%s===0)b=s});return b};
  const aggr=(L,g)=>{const ms=g*1000,out=[];let cur=null;L.forEach(c=>{const b=Math.floor(c.timestamp/ms)*ms;
    if(!cur||cur.timestamp!==b){cur={timestamp:b,open:c.open,high:c.high,low:c.low,close:c.close,volume:0};out.push(cur)}else{cur.high=Math.max(cur.high,c.high);cur.low=Math.min(cur.low,c.low);cur.close=c.close}});return out};
  /* count velas de g que terminan en end ("latest" o segundos) */
  async function getCandles(sym,g,end,count){
    if(STDG.includes(g)){const m=await feed.ask({ticks_history:sym,style:"candles",granularity:g,end,count:Math.min(count,1000)});return(m.candles||[]).map(toK)}
    const b=baseOf(g),k=g/b,need=Math.min(count*k+k,8000);let out=[],e=end,guard=0;
    while(out.length<need&&guard++<10){const m=await feed.ask({ticks_history:sym,style:"candles",granularity:b,end:e,count:Math.min(1000,need-out.length)});
      const L=(m.candles||[]).map(toK);if(!L.length)break;out=L.concat(out);e=Math.floor(L[0].timestamp/1000)-1;if(L.length<Math.min(1000,need))break}
    const A=aggr(out,g);return A.slice(-count)}
  /* ticks en vivo compartidos: una sola suscripción por mercado para la lista de mercados y los gráficos de ticks
     (Deriv no deja suscribirse dos veces al mismo mercado en la misma conexión) */
  const TKL=new Map(),TKW=new Set();
  const tickHandler=s=>m=>{if(!m.tick)return;if(TKW.has(s)){const prev=last[s];last[s]=+m.tick.quote;if(prev!=null)dir[s]=last[s]>prev?"up":last[s]<prev?"dn":dir[s];onPrice(s)}
    const L=TKL.get(s);L&&L.forEach(f=>{try{f(m.tick)}catch(e){}})};
  const tickEnsure=s=>{if(!feed.has("tick:"+s))feed.sub("tick:"+s,{ticks:s},tickHandler(s),()=>{})};
  const tickDrop=s=>{if(!TKW.has(s)&&!(TKL.get(s)&&TKL.get(s).size))feed.unsub("tick:"+s)};
  function tickOn(s,who,cb){let L=TKL.get(s);if(!L){L=new Map();TKL.set(s,L)}L.set(who,cb);tickEnsure(s)}
  function tickOff(s,who){const L=TKL.get(s);if(L){L.delete(who);if(!L.size)TKL.delete(s)}tickDrop(s)}
  /* los ticks llegan con la hora en segundos: si hay varios en el mismo segundo se separan 1 ms para que no se pisen */
  const tickList=(P,T,prev)=>{const out=[];let pv=prev||0;for(let i=0;i<P.length;i++){let t=(+T[i])*1000;if(t<=pv)t=pv+1;pv=t;const v=+P[i];out.push({timestamp:t,open:v,high:v,low:v,close:v,volume:0})}return out};
  let paneSeq=0;
  function Datafeed(){
    const me="p"+(++paneSeq)+":";let tkLast=0;
    return{
      async searchSymbols(q){await ready;q=String(q||"").trim().toLowerCase();
        return SYMS.filter(s=>!q||s.symbol.toLowerCase().includes(q)||String(s.display_name).toLowerCase().includes(q)).sort((a,b)=>tabOf(a).localeCompare(tabOf(b))||bcOrder(a)-bcOrder(b)).slice(0,200).map(info)},
      async getHistoryKLineData(sym,period,from,to){
        if(period&&period.timespan==="tick"){const live=to>=Date.now()-3000;
          try{const m=await feed.ask(Object.assign({ticks_history:sym.ticker,style:"ticks",count:1000},live?{end:"latest"}:{end:Math.floor(to/1000)}));const h=m.history||{};
            const L=tickList(h.prices||[],h.times||[]);if(live&&L.length)tkLast=L[L.length-1].timestamp;return L}
          catch(e){console.warn("[EAG] ticks",sym.ticker,e.message);return[]}}
        const g=gran(period),end=Math.floor(Math.min(to,Date.now())/1000),start=Math.max(1,Math.floor(from/1000));
        if(end<=start)return[];
        if(!STDG.includes(g)){try{return await getCandles(sym.ticker,g,to>=Date.now()-1000?"latest":end,Math.min(990,Math.ceil((end-start)/g)))}catch(e){console.warn("[EAG] historial",sym.ticker,e.message);return[]}}
        try{const m=await feed.ask({ticks_history:sym.ticker,style:"candles",granularity:g,start,end,count:5000,adjust_start_time:1});return(m.candles||[]).map(toK)}
        catch(e){console.warn("[EAG] historial",sym.ticker,e.message);return[]}},
      subscribe(sym,period,cb){if(period&&period.timespan==="tick"){tickOn(sym.ticker,me,t=>{let ts=(+t.epoch)*1000;if(ts<=tkLast)ts=tkLast+1;tkLast=ts;const v=+t.quote;cb({timestamp:ts,open:v,high:v,low:v,close:v,volume:0})});return}
        hubOn(sym.ticker+":"+gran(period),me,sym.ticker,gran(period),cb)},
      unsubscribe(sym,period){if(period&&period.timespan==="tick"){tickOff(sym.ticker,me);return}hubOff(sym.ticker+":"+gran(period),me)}
    }
  }

  /* ---------- qué se ve y qué no ---------- */
  const PARTS=[["top","Barra superior"],["pb","Barra de temporalidades y herramientas"],["bb","Barra inferior (rangos, reloj y escala)"],["db","Barra de dibujo"],["tf","Barra flotante de dibujos favoritos"],["ft","Pestañas de mercados favoritos"],["wl","Lista de mercados"]];
  SAVE.hide=SAVE.hide&&typeof SAVE.hide==="object"?SAVE.hide:{};
  /* en celular la barra flotante de favoritos arranca oculta (se activa en Configuración → Barras) */
  if(DEV==="cel"&&SAVE.hide.tf===undefined)SAVE.hide.tf=true;
  function applyHide(){PARTS.forEach(([k])=>appw.classList.toggle("h-"+k,!!SAVE.hide[k]));if(window.__tfavR)window.__tfavR();relayout();setTimeout(()=>{try{placeFab()}catch(e){}},60)}
  const allHidden=()=>PARTS.every(([k])=>SAVE.hide[k]);
  function openVista(anchor){
    pop.innerHTML=`<div class="ph">Vista</div>${PARTS.map(([k,t])=>`<label class="sw"><input type="checkbox" data-k="${k}" ${SAVE.hide[k]?"":"checked"}><i></i><span>${t}</span></label>`).join("")}
      <div class="ph">Posición</div><label class="sw"><input type="checkbox" data-o="wlLeft" ${SAVE.wlLeft?"checked":""}><i></i><span>Lista de mercados a la izquierda</span></label>
      <label class="sw"><input type="checkbox" data-o="mtfTop" ${SAVE.mtfTop?"checked":""}><i></i><span>Multitemporalidad arriba</span></label>
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
  function placeFab(){const sf=safe();if(SAVE.fabPos){fab.style.left=clamp(SAVE.fabPos.x,sf.l+4,innerWidth-sf.r-40)+"px";fab.style.top=clamp(SAVE.fabPos.y,sf.t+4,innerHeight-sf.b-40)+"px";return}
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
  /* ---------- perfiles de trabajo (Operativa, Análisis…): cada uno guarda sus gráficos, mercados, temporalidades, indicadores y dibujos ---------- */
  const PKEYS=["layout","panes","split","mtfh","pmh","symTF","link","hide"];
  const DRAWK="eag_draw_v1";
  const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
  const liveSnap=()=>{const ws={};PKEYS.forEach(k=>{if(SAVE[k]!==undefined)ws[k]=clone(SAVE[k])});let draw={};try{draw=JSON.parse(localStorage.getItem(DRAWK)||"{}")||{}}catch(e){}return{ws,draw}};
  function profInit(){if(SAVE.prof&&SAVE.prof.list&&SAVE.prof.list.length)return;
    SAVE.prof={cur:"p1",list:[{id:"p1",n:"Operativa"},{id:"p2",n:"Análisis"}],data:{p2:liveSnap()}};save()}
  profInit();
  const profCur=()=>SAVE.prof.list.find(x=>x.id===SAVE.prof.cur)||SAVE.prof.list[0];
  const paintProf=()=>{const n=$("#pfn");if(n)n.textContent=profCur().n};
  async function profGo(id,fresh){const P=SAVE.prof;if(id===P.cur&&!fresh)return closePop();
    devSnap();window.__noSnap=true;   /* la vista de este dispositivo para el perfil nuevo se arma al abrirlo */
    P.data=P.data||{};P.data[P.cur]=liveSnap();
    const t=fresh||P.data[id]||{ws:{},draw:{}};PKEYS.forEach(k=>{delete SAVE[k]});Object.keys(t.ws||{}).forEach(k=>{if(PKEYS.includes(k))SAVE[k]=clone(t.ws[k])});
    try{localStorage.setItem(DRAWK,JSON.stringify(t.draw||{}))}catch(e){}
    delete P.data[id];P.cur=id;save();closePop();try{sessionStorage.setItem("eag_prof_msg","1")}catch(e){}
    toast(`Cambiando a <b>${esc((P.list.find(x=>x.id===id)||{}).n||"")}</b>…`);
    /* recarga al instante: lo guardado en este navegador ya es lo más nuevo, y se sube a la cuenta apenas abre */
    try{clearTimeout(syncT);sessionStorage.setItem("eag_fast_boot","1");sessionStorage.setItem("eag_push_after","1")}catch(e){}
    location.reload()}
  function openProf(anchor,mode){const P=SAVE.prof,cur=P.cur;pop.dataset.for="prof";
    const nameIn=(v,ph)=>`<input class="pfin" maxlength="24" value="${esc(v||"")}" placeholder="${ph}">`;
    pop.innerHTML=`<div class="ph">Perfiles de trabajo</div>
      <div class="pnote">Cada perfil guarda sus propios gráficos, mercados, temporalidades, indicadores y dibujos. Cambiar de perfil no toca nada del otro.</div>
      <div class="pfl">${P.list.map(x=>`<div class="pfi${x.id===cur?" on":""}"><button class="pfgo" data-go="${x.id}">${x.id===cur?"✓ ":""}${esc(x.n)}${x.id===cur?' <em>en uso</em>':""}</button>
        ${mode==="ren"+x.id?"":`<button class="pfx" data-ren="${x.id}" title="Cambiar nombre">✎</button>`}${x.id!==cur&&P.list.length>1?`<button class="pfx${mode==="del"+x.id?" sure":""}" data-del="${x.id}" title="Eliminar perfil">${mode==="del"+x.id?"¿Seguro?":"🗑"}</button>`:""}</div>
        ${mode==="ren"+x.id?`<div class="pfrow">${nameIn(x.n,"Nombre")}<button class="btn sm gold" data-okren="${x.id}">Guardar</button></div>`:""}`).join("")}</div>
      ${mode==="new"?`<div class="pfnew"><div class="pfrow">${nameIn("","Ej.: Scalping, Lives, Swing")}</div>
        <div class="pfrow"><button class="btn sm gold" data-mk="copy">Crear como copia de «${esc(profCur().n)}»</button><button class="btn sm" data-mk="blank">Crear en blanco</button></div></div>`
      :P.list.length<8?`<div class="pbtns"><button class="btn sm" data-a="new">+ Nuevo perfil</button></div>`:""}`;
    pop.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>profGo(b.dataset.go));
    pop.querySelectorAll("[data-ren]").forEach(b=>b.onclick=()=>openProf(anchor,"ren"+b.dataset.ren));
    pop.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const id=b.dataset.del;if(mode!=="del"+id)return openProf(anchor,"del"+id);
      const x=P.list.find(q=>q.id===id);P.list=P.list.filter(q=>q.id!==id);delete P.data[id];save();toast(`Perfil «${esc(x?x.n:"")}» eliminado`);openProf(anchor)});
    pop.querySelectorAll("[data-okren]").forEach(b=>b.onclick=()=>{const v=pop.querySelector(".pfin").value.trim();if(!v)return;const x=P.list.find(q=>q.id===b.dataset.okren);if(x)x.n=v.slice(0,24);save();paintProf();openProf(anchor)});
    const na=pop.querySelector('[data-a="new"]');na&&(na.onclick=()=>openProf(anchor,"new"));
    pop.querySelectorAll("[data-mk]").forEach(b=>b.onclick=()=>{const v=(pop.querySelector(".pfin").value||"").trim()||("Perfil "+(P.list.length+1));
      const id="p"+Date.now().toString(36);P.list.push({id,n:v.slice(0,24)});save();
      profGo(id,b.dataset.mk==="copy"?liveSnap():{ws:{},draw:{}})});
    const fi=pop.querySelector(".pfin");if(fi){fi.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter"){const k=pop.querySelector("[data-okren],[data-mk]");k&&k.click()}};setTimeout(()=>fi.focus(),30)}
    showPop(anchor,"left")}
  $("#pfb").onclick=e=>{e.stopPropagation();if(!pop.hidden&&pop.dataset.for==="prof")return closePop();openProf($("#pfb"))};
  paintProf();
  /* ---------- en vivo: avisa al panel de admin que esta persona está usando los charts (cada 45 s, y al cambiar de mercado) ---------- */
  {const dev=()=>{const ua=navigator.userAgent,m=/iPad|Tablet/i.test(ua)?"Tablet":/Mobi|Android|iPhone/i.test(ua)?"Celular":"PC";return m+(standalone()?" · app":"")};
    let lastK="",lastT=0;
    const info=()=>{let sy=null,nm=null,tf=null;try{const k=panes[active]&&panes[active].kc;const S0=k&&k.getSymbol();sy=S0&&S0.ticker;nm=S0&&(S0.name||S0.ticker);tf=k&&k.getPeriod().text}catch(e){}
      return{symbol:sy,name:nm,tf,layout:SAVE.layout||"",device:dev(),profile:(profCur()||{}).n||"",panes:visible?visible():panes.length}};
    const ping=force=>{if(document.hidden||!API.chartPing)return;const o=info(),k=[o.symbol,o.tf,o.layout,o.profile].join("|"),now=Date.now();
      if(!force&&k===lastK&&now-lastT<45000)return;if(!force&&k!==lastK&&now-lastT<8000)return;lastK=k;lastT=now;API.chartPing(o).catch(()=>{})};
    setTimeout(()=>ping(true),1200);setInterval(()=>ping(false),10000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)ping(true)});
    addEventListener("pagehide",()=>{try{API.chartBye&&API.chartBye()}catch(e){}})}
  /* admin: tocar «En vivo» muestra quién está ahora mismo en los charts (se actualiza solo) */
  if(API.isAdmin&&API.isAdmin()&&API.adminChartOnline){const st=$("#st");st.classList.add("stadm");st.title="Ver quién está usando los charts ahora";
    let tm=null,tk=null,rows=[];const LN={l1:"1 gráfico",l2:"2 gráficos",l3:"3 gráficos",l4:"4 gráficos",l6:"6 gráficos",mtf:"Multi-TF"};
    const dur=ms=>{const s2=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s2/3600),m=Math.floor(s2%3600/60),x=s2%60;return h?`${h}h ${m}m`:m?`${m}m ${String(x).padStart(2,"0")}s`:`${x}s`};
    const paint=()=>{if(pop.hidden||pop.dataset.for!=="online")return stop();const on=rows.filter(r=>r.online),now=Date.now();
      pop.innerHTML=`<div class="ph">En los charts ahora · ${on.length}</div>`+(on.length?`<div class="onl">${on.map(r=>`<div class="onr"><i></i><div><b>${esc(r.username||"alumno")}</b><span>${esc(r.symbol_name||r.symbol||"")}${r.tf?" · "+esc(r.tf):""}${r.layout?" · "+esc(LN[r.layout]||r.layout):""} · ${esc((r.device||"").split(" ·")[0])}</span></div><em>${dur(now-new Date(r.started_at).getTime())}</em></div>`).join("")}</div>`
        :`<div class="pnote" style="border:0">Nadie más está en los charts ahora.</div>`)+`<div class="pnote">Se actualiza solo. Más detalle en Administración → Charts en vivo.</div>`};
    const load=async()=>{try{rows=(await API.adminChartOnline())||[]}catch(e){rows=[]}paint()};
    const stop=()=>{clearInterval(tm);clearInterval(tk);tm=tk=null};
    st.onclick=e=>{e.stopPropagation();if(!pop.hidden&&pop.dataset.for==="online"){closePop();return stop()}pop.dataset.for="online";pop.innerHTML=`<div class="ph">En los charts ahora</div><div class="pnote" style="border:0">Cargando…</div>`;showPop(st,"left");
      stop();load();tm=setInterval(load,3000);tk=setInterval(paint,1000)}}
  try{if(sessionStorage.getItem("eag_push_after")){sessionStorage.removeItem("eag_push_after");setTimeout(()=>{try{lastPush=null;pushSync()}catch(e){}},1500)}}catch(e){}
  try{if(sessionStorage.getItem("eag_prof_msg")){sessionStorage.removeItem("eag_prof_msg");setTimeout(()=>toast(`Perfil <b>${esc(profCur().n)}</b>`),900)}}catch(e){}
  function closePop(){pop.hidden=true;pop.dataset.for="";pop.classList.remove("wide");if(shownPick&&shownPick.length){shownPick=[];watch()}}
  document.addEventListener("pointerdown",e=>{if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest("#vb,#fab,#fteye,#cfgb,#pfb,#st,.tfdd,.wsym,.wtf,.dmini"))closePop()});
  let laserOn=false;window.__eagPanes=()=>panes;
  /* láser también en los gráficos pequeños (multi-temporalidad): punto rojo propio y el del profe para los alumnos */
  const miniAll=()=>{const A=[];Object.values(MTFS).forEach(M=>M&&(M.minis||[]).forEach(m=>A.push([M,m])));return A};
  const mlzDot=m=>{if(!m.lz||!m.lz.isConnected){m.lz=document.createElement("i");m.lz.className="mlz";m.lz.hidden=true;m.mc.appendChild(m.lz)}return m.lz};
  const mlzAt=(m,x,y)=>{const d=mlzDot(m);d.style.left=x+"px";d.style.top=y+"px";d.hidden=false};
  const mlzOff=m=>{if(m.lz)m.lz.hidden=true};
  function miniLaserWire(M,m,sym){let em=0;
    m.mc.addEventListener("pointermove",e=>{if(!laserOn)return;const r=m.mc.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;mlzAt(m,x,y);
      const now=performance.now();if(now-em<150)return;em=now;
      try{const c=m.c.convertFromPixel([{x,y}],{paneId:"candle_pane"})[0],L=m.c.getDataList();if(!c||!isFinite(c.value)||!L.length)return;
        const i=Math.max(0,Math.min(L.length-1,c.dataIndex)),ts=L[i].timestamp;window.EAGClase&&window.EAGClase.laser&&window.EAGClase.laser({ts,v:+c.value,f:0,sym});window.EAGSocial&&window.EAGSocial.laser({ts,v:+c.value,f:0,sym})}catch(x){}},{passive:true});
    m.mc.addEventListener("pointerleave",()=>{if(!laserOn)return;mlzOff(m);try{window.EAGClase&&window.EAGClase.laser&&window.EAGClase.laser({off:1,sym});window.EAGSocial&&window.EAGSocial.laser({off:1,sym})}catch(x){}})}
  window.__eagMiniLaser=q=>{if(!q||!q.sym)return;miniAll().forEach(([M,m])=>{if(M.sym!==q.sym)return;clearTimeout(m.lzT);
    if(q.off){mlzOff(m);return}try{const a=m.c.convertToPixel({timestamp:q.ts,value:q.v},{paneId:"candle_pane"});if(a&&isFinite(a.x)&&isFinite(a.y)){mlzAt(m,a.x,a.y);m.lzT=setTimeout(()=>mlzOff(m),2800)}}catch(x){}})};
  function setLaserAll(on){laserOn=!!on;panes.forEach(p=>{try{p.kc.laser(laserOn)}catch(x){}});document.body.classList.toggle("lzall",laserOn);
    miniAll().forEach(([M,m])=>{try{m.c.setStyles({crosshair:{show:!laserOn}})}catch(x){}if(!laserOn)mlzOff(m)});const b=$("#lzb");if(b){b.classList.toggle("on",laserOn);b.setAttribute("aria-pressed",String(laserOn))}}
  addEventListener("keydown",e=>{if(e.key!=="Escape")return;panes.forEach(p=>{try{p.kc.stopBrush()}catch(x){}});if(laserOn){setLaserAll(false)}if(!pop.hidden){closePop();return}
    if(/input|textarea/i.test((document.activeElement||{}).tagName||""))return;
    if(SAVE.hide.top&&SAVE.hide.ft){PARTS.forEach(([k])=>SAVE.hide[k]=false);save();applyHide()}});
  let tt=null;function toast(h){const t=$("#toast");t.innerHTML=h;t.hidden=false;t.classList.remove("out");clearTimeout(tt);tt=setTimeout(()=>{t.classList.add("out");setTimeout(()=>t.hidden=true,400)},4200)}

  /* ---------- tamaños y posiciones que el usuario acomoda ---------- */
  SAVE.split=SAVE.split&&typeof SAVE.split==="object"?SAVE.split:{c:.5,r:.5};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  /* zonas seguras del celular (barra de estado/notch cuando está instalada como app): la barra flotante nunca queda debajo */
  const safeProbe=document.createElement("div");safeProbe.style.cssText="position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";document.body.appendChild(safeProbe);
  const safe=()=>{const c=getComputedStyle(safeProbe);return{t:parseFloat(c.paddingTop)||0,r:parseFloat(c.paddingRight)||0,b:parseFloat(c.paddingBottom)||0,l:parseFloat(c.paddingLeft)||0}};
  function applyLayoutPrefs(){
    appw.classList.toggle("wl-left",!!SAVE.wlLeft);appw.classList.toggle("mtf-top",!!SAVE.mtfTop);appw.classList.toggle("db-right",!!SAVE.dbRight);
    appw.style.setProperty("--wlw",(SAVE.wlw||300)+"px");appw.style.setProperty("--mtfh",(SAVE.mtfh||168)+"px");appw.style.setProperty("--pmh",(SAVE.pmh||140)+"px");
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
  const tfOrder=t=>{const p=perFind(t);return p?gran(p):9e9};
  function openTF(pane,anchor){
    const cur=(()=>{try{return pane.kc.getPeriod().text}catch(e){return""}})();
    const grp=[["Minutos","minute"],["Horas","hour"],["Días","day"]];
    pop.innerHTML=(CF().ticks!==false?`<div class="ph">Ticks</div><div class="tfr${cur==="Ticks"?" on":""}" data-t="Ticks"><span>Gráfico de ticks</span></div>`:"")+grp.map(([g,ts])=>`<div class="ph">${g}</div>`+PERIODS.filter(p=>p.timespan===ts).map(p=>`<div class="tfr${p.text===cur?" on":""}" data-t="${p.text}"><span>${tfName(p)}</span><button class="st2${SAVE.tfFav.includes(p.text)?" on":""}" data-f="${p.text}" title="${SAVE.tfFav.includes(p.text)?"Quitar de favoritas":"Agregar a favoritas"}">${SAVE.tfFav.includes(p.text)?"★":"☆"}</button></div>`).join("")).join("")
      +`<div class="ph">Personalizadas</div>`+(SAVE.ctf||[]).map(ctfParse).filter(Boolean).map(p=>`<div class="tfr${p.text===cur?" on":""}" data-t="${p.text}"><span>${tfName(p)}</span><button class="st2${SAVE.tfFav.includes(p.text)?" on":""}" data-f="${p.text}" title="${SAVE.tfFav.includes(p.text)?"Quitar de favoritas":"Agregar a favoritas"}">${SAVE.tfFav.includes(p.text)?"★":"☆"}</button><button class="st2 ctfx" data-cx="${p.text}" title="Borrar">×</button></div>`).join("")
      +`<div class="ctfnew"><input type="number" min="1" step="1" data-cn placeholder="Ej: 7"><select data-cu><option value="m">minutos</option><option value="H">horas</option><option value="D">días</option></select><button data-cadd>Crear</button></div>`
      +`<div class="pnote">Las ★ favoritas salen en la barra y en Multitemporalidad. Las personalizadas se arman juntando velas más pequeñas.</div>`;
    pop.querySelectorAll("[data-cx]").forEach(b=>b.onclick=e=>{e.stopPropagation();const t=b.dataset.cx;SAVE.ctf=(SAVE.ctf||[]).filter(x=>x!==t);SAVE.tfFav=SAVE.tfFav.filter(x=>x!==t);
      panes.forEach((p,i)=>{try{if(p.kc.getPeriod().text===t){p.kc.setPeriod(perOf("5m"));SAVE.panes[i]=Object.assign({},SAVE.panes[i],{p:"5m"})}}catch(x){}});save();decorateAll();Object.values(MTFS).forEach(M=>buildMTF(M.pi));openTF(pane,anchor)});
    const cadd=pop.querySelector("[data-cadd]");cadd&&(cadd.onclick=e=>{e.stopPropagation();const n=parseInt(pop.querySelector("[data-cn]").value,10),u=pop.querySelector("[data-cu]").value;
      if(!(n>0))return toast("Escribe un número");const t=n+u,pp=ctfParse(t);if(!pp)return toast("Debe estar entre 1 minuto y 7 días");
      if(PERIODS.some(x=>gran(x)===gran(pp)))return toast(`Esa ya existe: ${PERIODS.find(x=>gran(x)===gran(pp)).text}`);
      SAVE.ctf=Array.from(new Set((SAVE.ctf||[]).concat(t))).sort((a,b)=>tfOrder(a)-tfOrder(b));save();try{pane.kc.setPeriod(pp)}catch(x){}closePop();afterTF();toast(`Temporalidad <b>${t}</b> creada. Tócale ☆ para tenerla en la barra.`)});
    pop.querySelectorAll(".ctfnew input,.ctfnew select").forEach(x=>{x.onclick=e=>e.stopPropagation();x.onkeydown=e=>{if(e.key==="Enter")cadd.click()}});
    pop.querySelectorAll(".tfr").forEach(r=>r.onclick=e=>{
      const f=e.target.closest("[data-f]");
      if(f){const t=f.dataset.f;SAVE.tfFav=SAVE.tfFav.includes(t)?SAVE.tfFav.filter(x=>x!==t):SAVE.tfFav.concat(t).sort((a,b)=>tfOrder(a)-tfOrder(b));save();decorateAll();Object.values(MTFS).forEach(M=>buildMTF(M.pi));openTF(pane,anchor);return}
      try{pane.kc.setPeriod(perOf(r.dataset.t))}catch(x){}closePop();afterTF()});
    pop.dataset.for="tf";showPop(anchor,"left")}
  const decorateAll=()=>panes.forEach(p=>{try{p.kc.refreshBar()}catch(e){}});
  const afterTF=()=>setTimeout(()=>{decorateAll();mtfMark()},30);

  /* ---------- gráficos ---------- */
  const DEF=["BOOM1000","CRASH1000","BOOM500","CRASH500","BOOM300N","CRASH300N"];
  SAVE.panes=Array.isArray(SAVE.panes)?SAVE.panes:[];
  const grid=$("#grid"),panes=[];window.__eagPanes=panes;let active=0;
  /* pestañas de mercados arriba o abajo (como MT5); en Multi-TF van justo encima de la multitemporalidad */
  function placeFt(){const ftw=$(".ftw"),center=$(".center");if(!ftw||!center)return;const bot=SAVE.ftPos==="bottom";appw.classList.toggle("ftbot",bot);
    const mr=grid.classList.contains("mtf")?grid.querySelector(":scope>.mtfrow"):null;
    if(bot&&mr){if(ftw.parentNode!==grid||ftw.nextElementSibling!==mr)grid.insertBefore(ftw,mr)}
    else if(bot){if(ftw.parentNode!==center||center.lastElementChild!==ftw)center.appendChild(ftw)}
    else if(ftw.parentNode!==center||center.firstElementChild!==ftw)center.insertBefore(ftw,center.firstElementChild)}
  new MutationObserver(()=>placeFt()).observe(grid,{childList:true});setTimeout(placeFt,0);
  const UP="#089981",DN="#f23645",NC="#9da1aa";
  /* ---------- ajustes del gráfico (tema, fondo, cuadrícula, velas…) ---------- */
  const CDEF={theme:"light",bg:"",grid:true,dec:"auto",font:11,wmMode:"both",wmOp:10,wmSize:100,wmColor:"auto",up:UP,dn:DN,type:"candle_solid",last:true,hl:true,cross:true,wm:true,axis:true,cd:"mtf",ticks:true,spk:true};
  SAVE.cfg=Object.assign({},CDEF,SAVE.cfg||{});
  /* el reloj de cierre de vela ahora va por defecto en la multitemporalidad (cada temporalidad con su tiempo) */
  if(SAVE.cfg.cdV!==2){SAVE.cfg.cd="mtf";SAVE.cfg.cdV=2}
  /* velas: pasar a los colores nuevos si tenía los de antes por defecto */
  if(["#35c4a2","#22ab94","#0ecb81"].includes(SAVE.cfg.up))SAVE.cfg.up=UP;if(["#ec5b52","#f6465d"].includes(SAVE.cfg.dn))SAVE.cfg.dn=DN;
  const CF=()=>SAVE.cfg,light=()=>CF().theme==="light",eagT=()=>CF().theme==="eag",defBg=()=>light()?"#ffffff":eagT()?"#060b1a":"#0b0c0e";
  const barOf=()=>{const c=CF();return{upColor:c.up,downColor:c.dn,noChangeColor:NC,upBorderColor:c.up,downBorderColor:c.dn,noChangeBorderColor:NC,upWickColor:c.up,downWickColor:c.dn,noChangeWickColor:NC}};
  const CTYPES=[["candle_solid","Velas"],["candle_stroke","Huecas"],["ohlc","Barras"],["area","Área"],["ha","Heikin Ashi"],["renko","Renko"]];
  const kType=t=>t==="ha"||t==="renko"?"candle_solid":t;
  const styFor=()=>{const c=CF(),gc=light()?"rgba(16,18,24,.06)":eagT()?"rgba(43,66,130,.35)":"rgba(255,255,255,.045)";
    return{grid:{show:!!c.grid,horizontal:{show:!!c.grid,color:gc},vertical:{show:!!c.grid,color:gc}},
      candle:{type:kType(c.type),bar:barOf(),area:{lineColor:c.up},priceMark:{last:{show:!!c.last,upColor:c.up,downColor:c.dn},high:{show:!!c.hl},low:{show:!!c.hl}}},
      crosshair:{show:!!c.cross},xAxis:{show:!!c.axis},yAxis:{show:!!c.axis}}};
  const BGS=["#060b1a","#0b0c0e","#000000","#131722","#0d1512","#15121b","#ffffff","#faf8f3","#f3f5f8"];
  let lastXk=null;
  function applyCfg(){const c=CF();
    document.documentElement.classList.toggle("light",light());document.documentElement.classList.toggle("eag",eagT());appw.classList.toggle("h-wm",!c.wm);
    const de=document.documentElement;de.dataset.wm=(c.wmMode==="brand"||!c.wm)?"brand":"both";de.style.setProperty("--wmo",Math.max(FREE?16:6,+c.wmOp||10)/100);de.style.setProperty("--wms",(+c.wmSize||100)/100);
    de.style.setProperty("--wmc",c.wmColor==="auto"?(light()?"#15171c":"#ffffff"):c.wmColor);
    document.documentElement.style.setProperty("--chartbg",c.bg||defBg());
    const tc=document.querySelector('meta[name="theme-color"]');tc&&tc.setAttribute("content",defBg());
    panes.forEach(p=>{try{if(p.kc.getTheme()!==c.theme)p.kc.setTheme(c.theme)}catch(e){}setTimeout(()=>{try{p.kc.setStyles(styFor());p.kc.setDecimals()}catch(e){}},40)});
    Object.values(MTFS).forEach(M=>M.minis.forEach(m=>{try{m.c.setStyles({candle:{bar:barOf()}})}catch(e){}}));
    if(c.ticks===false)panes.forEach((p,i)=>{try{if(p.kc.getPeriod().timespan==="tick"){p.kc.setPeriod(perOf("1m"));SAVE.panes[i]=Object.assign({},SAVE.panes[i],{p:"1m"})}}catch(e){}});
    try{decorateAll()}catch(e){}window.__spkPaint&&window.__spkPaint();panes.forEach(p=>{try{p.kc.refreshAuto()}catch(e){}});
    const xk=c.type+"|"+(c.type==="renko"?(+c.rbox||0):"");if(xk!==lastXk){const first=lastXk==null;lastXk=xk;if(!first)panes.forEach(p=>{try{p.kc.reloadData()}catch(e){}})}}
  function openCfg(anchor){const c=CF();
    const tg=(k,t)=>`<label class="sw"><input type="checkbox" data-k="${k}" ${c[k]?"checked":""}><i></i><span>${t}</span></label>`;
    const TYPES=CTYPES;
    pop.innerHTML=`<div class="ph">Tema</div><div class="seg">${[["dark","Oscuro"],["light","Claro"]].map(([v,t])=>`<button data-th="${v}" class="${c.theme===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="ph">Fondo del gráfico</div><div class="sws">${BGS.map(b=>`<button class="swc${(c.bg||"")===b?" on":""}" data-bg="${b}" style="background:${b}" title="${b}"></button>`).join("")}<label class="swc pick" title="Otro color"><input type="color" data-bgp value="${c.bg||defBg()}">+</label><button class="swc auto${c.bg?"":" on"}" data-bg="" title="Según el tema">A</button></div>
      <div class="ph">Velas</div><div class="seg">${TYPES.map(([v,t])=>`<button data-ty="${v}" class="${c.type===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="cols"><label>Alcista <input type="color" data-col="up" value="${c.up}"></label><label>Bajista <input type="color" data-col="dn" value="${c.dn}"></label></div>
      <div class="ph">Mostrar</div>${tg("grid","Cuadrícula")}${tg("axis","Ejes de precio y hora")}${tg("last","Línea del último precio")}${tg("hl","Máximo y mínimo visibles")}${tg("cross","Cruz del cursor")}${tg("wm","Mercado en la marca de agua")}
      ${1?`<div class="ph">Marca de agua</div><div class="seg">${[["both","Marca y mercado"],["brand","Solo marca"]].map(([v,t])=>`<button data-wm="${v}" class="${c.wmMode===v?"on":""}">${t}</button>`).join("")}</div>
      <label class="rg"><span>Visibilidad</span><input type="range" min="6" max="60" step="1" data-r="wmOp" value="${c.wmOp}"><em>${c.wmOp}%</em></label>
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
  /* versión gratis: si traía más indicadores de la prueba, se quedan los primeros */
  function trimInd(d){if(!d)return d;const main=(d.main||[]).slice(0,FREE_IND),left=Math.max(0,FREE_IND-main.length),sub=(d.sub||[]).slice(0,left);return Object.assign({},d,{main,sub})}
  function makePane(i){
    const el=document.createElement("div");el.className="pane";el.innerHTML='<div class="kc"></div>';grid.appendChild(el);
    const sv=SAVE.panes[i]||{},sym=sv.s||DEF[i%DEF.length],per=perOf(sv.p||(i===0?"5m":"1m"));
    const p={el,kc:null};
    const kc=window.EAGWidget({container:el.firstChild,symbol:findInfo(sym),period:per,datafeed:Datafeed(),theme:CF().theme,timezone:TZ,
      onLaser:pt=>{try{window.EAGClase&&window.EAGClase.laser&&window.EAGClase.laser(pt);window.EAGSocial&&window.EAGSocial.laser(pt)}catch(e){}},
      indicators:LOCK.ind?trimInd(sv.ind):sv.ind,magnet:SAVE.magnet,lastTools:SAVE.lastTools,
      toolAllowed:LOCK.tools?(n=>FREE_TOOLS.has(n)):null,maxIndicators:LOCK.ind?FREE_IND:null,alertsAllowed:LOCK.alerts?(()=>false):null,onLocked:(k,what)=>upsell(what),
      getFavTF:()=>SAVE.tfFav,getXform:()=>CF().type==="ha"||CF().type==="renko"?CF().type:"",getRenkoBox:()=>+CF().rbox||0,autoZones:()=>!!CF().az&&!LOCK.az,ticksOn:()=>CF().ticks!==false,
      onPickTF:t=>{kc.setPeriod(perOf(t));afterTF()},onTracker:()=>TRK.toggle(),
      onTFClick:a=>{setActive(i);pop.hidden||pop.dataset.for!=="tf"?openTF(p,a):closePop()},
      onSymbolClick:anc=>{setActive(i);const a=anc&&anc.nodeType?anc:el.querySelector(".wsym");pop.hidden||pop.dataset.for!=="sym"?openSymPicker(p,a):closePop()},
      onSettings:()=>openSettings("apariencia"),getDecimals:()=>CF().dec,getFont:()=>DEV==="cel"?Math.min(+CF().font||11,13):CF().font,getCdMode:()=>{const m=CF().cd||"mtf";if(m!=="mtf")return m;
        /* "En Multi-TF": si este gráfico no tiene la multitemporalidad a la vista, el reloj va en la regla del precio */
        const M=MTFS[i];const on=!!(M&&M.el&&M.el.isConnected&&M.el.offsetParent!==null&&M.minis&&M.minis.length);return on?"mtf":"regla"},
      onFullReload:()=>fullReload(),getTradeHistory:tk=>window.EAGTrade&&window.EAGTrade.history?window.EAGTrade.history(tk):Promise.reject(new Error("El panel Operar no está disponible")),getToolStyle:n=>(SAVE.toolStyles||{})[n],drawTfOnly:()=>!!SAVE.cfg.drawTf,onToolStyle:(n,st)=>{SAVE.toolStyles=Object.assign({},SAVE.toolStyles,{[n]:st});save()},onReload:()=>{if(MTFS[i])buildMTF(i)},onToggleMtf:()=>{SAVE.panes[i]=Object.assign({},SAVE.panes[i],{mtf:!(SAVE.panes[i]||{}).mtf});save();syncStrips()},onToast:t=>toast(t),getAlerts:tk=>ALERTS.filter(a=>a.active&&a.symbol===tk&&a.price!=null&&["nivel","zona","cierre"].includes(a.kind)).map(a=>a.kind==="cierre"?Object.assign({},a,{kind:"nivel",note:`cierre ${a.cond==="abajo"?"↓":"↑"} ${tfTxt(a.tf)}${a.note?" · "+a.note:""}`}):a),onCreateAlert:a=>alertDialog(a),
      onIndicators:d=>{SAVE.panes[i]=Object.assign({},SAVE.panes[i],{ind:d});save()},
      onMagnet:m=>{SAVE.magnet=m;save()},getTfav:()=>!SAVE.hide.tf&&SAVE.toolFav.length>0,onTfav:()=>{if(!SAVE.toolFav.length){SAVE.hide.tf=false;save();applyHide();toast("Aún no tienes favoritas: abre una lista de herramientas (doble toque) y marca la ☆. Aparecen en la barra rápida.");return}SAVE.hide.tf=!SAVE.hide.tf;save();applyHide();panes.forEach(p=>{try{p.kc.refreshBar()}catch(e){}})},axisType:sv.ax,onAxisType:t=>{SAVE.panes[i]=Object.assign({},SAVE.panes[i],{ax:t});save()},getToolFav:()=>SAVE.toolFav,onToolFav:k=>{SAVE.toolFav=SAVE.toolFav.includes(k)?SAVE.toolFav.filter(x=>x!==k):SAVE.toolFav.concat(k);save();renderToolFav()},onLastTools:t=>{SAVE.lastTools=t;save()},
      onDrawingsChange:tk=>(window.__eagSync&&window.__eagSync(),window.EAGClase&&window.EAGClase.drawingsChanged(),window.EAGSocial&&window.EAGSocial.drawingsChanged(),panes).forEach(q2=>{if(q2!==p&&q2.kc&&q2.kc.getSymbol().ticker===tk)q2.kc.reloadDrawings()})});
    p.kc=kc;
    setTimeout(()=>{try{kc.setStyles(styFor())}catch(e){}},0);
    el.addEventListener("pointerdown",()=>{if(active!==i)setActive(i)},true);
    if(laserOn)setTimeout(()=>{try{p.kc&&p.kc.laser(true)}catch(x){}},0);
    return p;
  }
  const curSym=i=>{try{return panes[i].kc.getSymbol().ticker}catch(e){return null}};
  function setActive(i){active=i;panes.forEach((p,j)=>p.el.classList.toggle("act",j===i&&visible()>1));paintList();paintTabs();tradeKick()}
  const tradeKick=()=>{try{window.EAGTrade&&setTimeout(()=>window.EAGTrade.onChange(),350)}catch(e){}};
  const visible=()=>(LAYS.find(l=>l[0]===lay)||LAYS[0])[1];
  let lay=SAVE.layout&&LAYS.some(l=>l[0]===SAVE.layout)?SAVE.layout:"mtf";   /* por defecto abre en Multitemporalidad (la novedad) */
  function setLayout(k){
    if(DEV==="cel"&&!["l1","l2v","mtf"].includes(k))k="l1";
    lay=k;SAVE.layout=k;save();const n=visible();
    grid.className="grid "+k;appw.classList.toggle("multi",n>1);
    while(panes.length<n)panes.push(makePane(panes.length));
    panes.forEach((p,j)=>p.el.style.display=j<n?"":"none");
    document.querySelectorAll(".lay button").forEach(b=>b.classList.toggle("on",b.dataset.l===k));
    if(active>=n)active=0;
    if(k==="mtf"&&MTFS[0]&&MTFS[0].el.classList.contains("pstrip"))destroyMTF(0);syncStrips();
    setActive(active);placeSplits();relayout();
  }
  document.querySelectorAll(".lay button").forEach(b=>b.onclick=()=>setLayout(b.dataset.l));
  function setSym(s){const p=panes[active];if(!p)return;tradeKick();
    const targets=[active];
    /* cada mercado recuerda su propia temporalidad: al volver a él se abre en la última que usaste */
    const tf=(SAVE.symTF||{})[s],pp=tf?perFind(tf):null;
    targets.forEach(j=>{panes[j].kc.setSymbol(findInfo(s),pp);SAVE.panes[j]=Object.assign({},SAVE.panes[j],{s},pp?{p:pp.text}:{})});save();if(pp)setTimeout(()=>{try{afterTF()}catch(e){}},80);
    setTimeout(()=>{if(MTFS[active])buildMTF(active);paintList();paintTabs()},60)}

  /* ---------- multitemporalidad ---------- */
  /* multitemporalidad por gráfico: MTFS[i] = tira de mini gráficos del gráfico i (en la vista Multi-TF, la del gráfico 0 va abajo en grande) */
  const MTFS={};let mtf=null;
  const MINI=()=>({grid:{show:false},candle:{bar:barOf(),tooltip:{showRule:"none"},priceMark:{high:{show:false},low:{show:false},last:{show:true,line:{show:true,style:"dashed",size:1},text:{show:false}}}},
    xAxis:{show:false},yAxis:{show:false},crosshair:{show:false},separator:{size:0}});
  function destroyMTF(pi){pi=pi||0;const m0=MTFS[pi];if(!m0)return;m0.minis.forEach(m=>{hubOff(m.key,m.who);try{KC.dispose(m.mc)}catch(e){}});m0.el.remove();m0.dots&&m0.dots.remove();delete MTFS[pi];if(panes[pi])panes[pi].el.classList.remove("withmtf");if(pi===0)mtf=null}
  function destroyAllMTF(){Object.keys(MTFS).forEach(k=>destroyMTF(+k))}
  function buildMTF(pi){pi=pi||0;const P=panes[pi];if(!P)return;
    destroyMTF(pi);const sym=(()=>{try{return P.kc.getSymbol()}catch(e){return findInfo(DEF[0])}})();
    const inPane=!(lay==="mtf"&&pi===0);
    const el=document.createElement("div");el.className="mtfrow"+(inPane?" pstrip":"");el.style.setProperty("--n",SAVE.tfFav.length);(inPane?P.el:grid).appendChild(el);if(inPane)P.el.classList.add("withmtf");
    const sp=document.createElement("span");sp.className="mtfsp";sp.title="Arrastra para cambiar el alto · doble clic: alto normal";sp.innerHTML="<i></i>";el.appendChild(sp);
    if(inPane){dragger(sp,e=>{const r=P.el.getBoundingClientRect();SAVE.pmh=Math.round(clamp(SAVE.mtfTop?e.clientY-r.top:r.bottom-e.clientY,90,r.height*.6));appw.style.setProperty("--pmh",SAVE.pmh+"px")})}
    else dragger(sp,e=>{const r=grid.getBoundingClientRect();SAVE.mtfh=Math.round(clamp(SAVE.mtfTop?e.clientY-r.top:r.bottom-e.clientY,110,r.height*.65));appw.style.setProperty("--mtfh",SAVE.mtfh+"px")});
    sp.ondblclick=()=>{delete SAVE.mtfh;save();applyLayoutPrefs()};
    const M={el,sym:sym.ticker,minis:[],pi};MTFS[pi]=M;if(pi===0)mtf=M;
    /* celular: bolitas de página debajo (2 minis por página) */
    if(!inPane){const dots=document.createElement("div");dots.className="mtfdots";grid.appendChild(dots);M.dots=dots;
      const pages=()=>Math.max(1,Math.ceil(SAVE.tfFav.length/2));
      const paint=()=>{const n=pages(),w=el.clientWidth||1,max=Math.max(1,el.scrollWidth-el.clientWidth),cur=n<2?0:Math.round(el.scrollLeft/max*(n-1));
        dots.hidden=n<2||!mobile();dots.innerHTML=Array.from({length:n},(_,k)=>`<i class="${k===cur?"on":""}" data-pg="${k}"></i>`).join("")};
      el.addEventListener("scroll",()=>requestAnimationFrame(paint),{passive:true});
      dots.addEventListener("click",e=>{const d=e.target.closest("[data-pg]");if(!d)return;const n=pages(),max=el.scrollWidth-el.clientWidth;el.scrollTo({left:n<2?0:max*(+d.dataset.pg)/(n-1),behavior:"smooth"})});
      setTimeout(paint,300);addEventListener("resize",()=>setTimeout(paint,300))}
    SAVE.tfFav.forEach((t,i)=>{const per=perOf(t),g=gran(per);
      const box=document.createElement("div");box.className="mini";box.innerHTML=`<button class="mh" title="Ver ${tfName(per)} en el gráfico grande"><b>${t}</b><span class="mcd" title="Tiempo para que cierre la vela de ${tfName(per)}" hidden></span><span class="mp"></span><em></em><i class="mz">⤢</i></button><span class="mc" title="Toca o desliza hacia arriba: ver en grande · rueda o pellizco: acercar · arrastra a los lados: mover"></span>`;el.appendChild(box);
      const mc=box.querySelector(".mc"),c=KC.init(mc,{locale:"es-ES",timezone:TZ,styles:MINI()});
      try{c.setPriceVolumePrecision(sym.pricePrecision||3,0);c.setScrollEnabled(true);c.setZoomEnabled(true);c.setOffsetRightDistance(6)}catch(e){}
      const m={t,g,cd:box.querySelector(".mcd"),box,mc,c,key:sym.ticker+":"+g,who:"mtf"+pi+"-"+i+":"+Date.now()};M.minis.push(m);miniLaserWire(M,m,sym.ticker);if(laserOn)try{c.setStyles({crosshair:{show:false}})}catch(x){}
      /* más pasado: 300 velas, y si arrastras a la izquierda carga más */
      let miniNoMore=false;
      try{c.setLoadDataCallback(async({type,data,callback})=>{if(type!=="forward"||!data||miniNoMore){callback([],false);return}
        try{const L2=(await getCandles(sym.ticker,g,Math.floor((data.timestamp-1)/1000),300)).filter(k=>k.timestamp<data.timestamp);if(!L2.length)miniNoMore=true;callback(L2,L2.length>0)}catch(e){callback([],false)}})}catch(e){}
      getCandles(sym.ticker,g,"latest",300).then(L=>{if(MTFS[pi]!==M)return;c.applyNewData(L,true);fit(m);m.live(L[L.length-1])}).catch(()=>{});
      const mp=box.querySelector(".mp");
      const live=d=>{if(!d)return;const ch=(d.close-d.open)/d.open*100;mp.innerHTML=`${(+d.close).toFixed(sym.pricePrecision||3)} <i class="${ch>=0?"up":"dn"}">${ch>=0?"▲":"▼"}${Math.abs(ch).toFixed(2)}%</i>`;
};
      m.live=live;
      hubOn(m.key,m.who,sym.ticker,g,d=>{try{c.updateData(d);live(d)}catch(e){}});
      const big=()=>{try{P.kc.setPeriod(per)}catch(e){}afterTF();box.classList.add("flyup");setTimeout(()=>box.classList.remove("flyup"),450)};box.querySelector(".mh").onclick=big;
      /* gesto: deslizar hacia arriba (o un toque simple) pasa esta temporalidad al gráfico grande */
      box.addEventListener("pointerdown",e=>{if(e.target.closest(".mh"))return;mtfG={box,big,x:e.clientX,y:e.clientY,t:Date.now()}},true)});
    /* pantalla angosta (PC pequeño, celular): flechas ‹ › con cuántas temporalidades quedan escondidas a cada lado, como en las pestañas de mercados */
    if(!inPane){const mk=(d,cls)=>{const h=document.createElement("span");h.className="mtfah "+cls;h.innerHTML=`<button type="button" class="mtfa" data-d="${d}" title="${d<0?"Temporalidades anteriores":"Más temporalidades"}"></button>`;return h};
      const hl=mk(-1,"l"),hr=mk(1,"r");el.insertBefore(hl,el.querySelector(".mini"));el.appendChild(hr);
      const arr=()=>{const over=el.scrollWidth>el.clientWidth+4;el.classList.toggle("over",over);if(!over)return;const R=el.getBoundingClientRect();let L=0,Rt=0;
        M.minis.forEach(m=>{const r=m.box.getBoundingClientRect();if(r.right<=R.left+r.width*.5)L++;else if(r.left>=R.right-r.width*.5)Rt++});
        const bl=hl.firstChild,br=hr.firstChild;bl.innerHTML=`‹${L?`<em>${L}</em>`:""}`;br.innerHTML=`›${Rt?`<em>${Rt}</em>`:""}`;bl.disabled=!L;br.disabled=!Rt};
      [hl,hr].forEach(h=>h.firstChild.onclick=e=>{e.stopPropagation();el.scrollBy({left:+h.firstChild.dataset.d*el.clientWidth,behavior:"smooth"})});
      [hl,hr].forEach(h=>h.firstChild.addEventListener("pointerdown",e=>e.stopPropagation()));
      el.addEventListener("scroll",()=>requestAnimationFrame(arr),{passive:true});addEventListener("resize",()=>setTimeout(arr,200));setTimeout(arr,300);setTimeout(arr,1200);
      /* ruedita del mouse: cuando no caben todas, pasa a las siguientes / anteriores (Ctrl o ⌘ + rueda sigue haciendo zoom en el mini) */
      let wT=0,wAcc=0;el.addEventListener("wheel",e=>{if(!el.classList.contains("over")||e.ctrlKey||e.metaKey)return;
        const d=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;if(!d)return;e.preventDefault();e.stopPropagation();
        const n=performance.now();if(n-wT<380){return}wAcc+=d;if(Math.abs(wAcc)<(e.deltaMode?1:25))return;wT=n;
        el.scrollBy({left:Math.sign(wAcc)*el.clientWidth,behavior:"smooth"});wAcc=0},{capture:true,passive:false})}
    mtfMark();relayout()}
  /* gesto de la multitemporalidad: un solo juego de escuchadores para todos los mini gráficos */
  let mtfG=null;
  addEventListener("pointermove",e=>{const g=mtfG;if(!g)return;const dy=e.clientY-g.y,dx=e.clientX-g.x;g.box.classList.toggle("lift",dy<-14&&Math.abs(dy)>Math.abs(dx));g.box.style.setProperty("--lift",Math.max(-40,Math.min(0,dy))+"px")});
  addEventListener("pointerup",e=>{const g=mtfG;if(!g)return;mtfG=null;const dy=e.clientY-g.y,dx=e.clientX-g.x,quick=Date.now()-g.t<350;g.box.classList.remove("lift");g.box.style.removeProperty("--lift");
    if(g.box.isConnected&&((dy<-30&&Math.abs(dy)>Math.abs(dx)*1.2)||(quick&&Math.abs(dx)<5&&Math.abs(dy)<5)))g.big()});
  addEventListener("pointercancel",()=>{if(mtfG){mtfG.box.classList.remove("lift");mtfG=null}});
  function fit(m){try{const w=m.mc.clientWidth||200;m.c.resize();m.c.setBarSpace(Math.max(1.2,(w-14)/90))}catch(e){}}
  /* reloj de cierre de vela en cada mini (una sola cuenta para todos) */
  const two=n=>String(n).padStart(2,"0");
  setInterval(()=>{if(document.hidden)return;const on=CF().cd==="mtf",now=Date.now();
    Object.values(MTFS).forEach(M=>M.minis.forEach(m=>{const el=m.cd;if(!el)return;if(!on){el.hidden=true;return}
      let L;try{L=m.c.getDataList()}catch(e){L=null}const k=L&&L[L.length-1];if(!k){el.hidden=true;return}
      const left=Math.max(0,k.timestamp+m.g*1000-now),s=Math.floor(left/1000),h=Math.floor(s/3600),mi=Math.floor(s%3600/60);
      const tx=h?`${h}:${two(mi)}:${two(s%60)}`:`${two(mi)}:${two(s%60)}`;if(el.textContent!==tx)el.textContent=tx;
      el.classList.toggle("soon",left<10000);el.classList.toggle("dn",k.close<k.open);el.hidden=false}))},1000);
  function mtfResize(){Object.values(MTFS).forEach(M=>M.minis.forEach(m=>{try{m.c.resize()}catch(e){}}))}
  function mtfMark(){Object.values(MTFS).forEach(M=>{let cur="";try{cur=panes[M.pi].kc.getPeriod().text}catch(e){}
    M.minis.forEach(m=>{const on=m.t===cur;m.box.classList.toggle("on",on);m.box.querySelector("em").textContent=on?"●":""})})}
  /* qué gráficos llevan su propia tira: en Multi-TF el 0; en 2 gráficos los que el usuario active */
  /* Multi-TF dentro de cada gráfico: solo con 2 gráficos y solo en pantallas grandes (en celular no cabe y se ve feo) */
  const stripAllowed=()=>(lay==="l2"||lay==="l2v")&&DEV!=="cel";
  {let rsT=null,wasM=mobile();addEventListener("resize",()=>{clearTimeout(rsT);rsT=setTimeout(()=>{const m=mobile();if(m!==wasM){wasM=m;try{syncStrips()}catch(e){}}},250)})}
  function syncStrips(){Object.keys(MTFS).forEach(k=>{k=+k;const want=lay==="mtf"?k===0:(stripAllowed()&&k<visible()&&!!(SAVE.panes[k]||{}).mtf);if(!want)destroyMTF(k)});
    if(lay==="mtf"){if(!MTFS[0]||MTFS[0].el.classList.contains("pstrip"))buildMTF(0)}
    else if(stripAllowed())for(let k=0;k<visible();k++){if((SAVE.panes[k]||{}).mtf&&!MTFS[k])buildMTF(k)}
    panes.forEach((p,k)=>{try{p.kc.setMtfButton&&p.kc.setMtfButton(stripAllowed()&&k<visible(),!!MTFS[k])}catch(e){}})}

  /* recordar mercado y temporalidad de cada gráfico; mantener la barra decorada */
  setInterval(()=>{let ch=false;panes.forEach((p,j)=>{try{const s=p.kc.getSymbol().ticker,t=p.kc.getPeriod().text,o=SAVE.panes[j]||{};SAVE.symTF=SAVE.symTF||{};if(SAVE.symTF[s]!==t){SAVE.symTF[s]=t;ch=true}if(o.s!==s||o.p!==t){SAVE.panes[j]=Object.assign({},o,{s,p:t});ch=true}}catch(e){}});
    if(ch){decorateAll();save();paintList();paintTabs();Object.values(MTFS).forEach(M=>{if(curSym(M.pi)!==M.sym)buildMTF(M.pi)});mtfMark()}},700);

  /* ---------- panel de mercados y pestañas de favoritos ---------- */
  SAVE.fav=Array.isArray(SAVE.fav)?SAVE.fav:["BOOM1000","CRASH1000","BOOM500","CRASH500"];
  let tab=SAVE.tab||"bc",shown=[];const last={},dayOpen={},dir={};
  const toggleFav=s=>{SAVE.fav=SAVE.fav.includes(s)?SAVE.fav.filter(x=>x!==s):SAVE.fav.concat(s);save();renderList();renderTabs()};
  /* lista de mercados en celular: fondo oscuro detrás; tocar afuera o Esc la cierra */
  const wlbk=document.createElement("div");wlbk.className="wlbk";appw.appendChild(wlbk);
  function setWl(on){main.classList.toggle("wlopen",!!on);wlbk.classList.toggle("on",!!on);if(!on){const a=document.activeElement;a&&a.blur&&a.closest&&a.closest(".wl")&&a.blur()}}
  wlbk.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();setWl(false)});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&main.classList.contains("wlopen"))setWl(false)});
  /* pantalla completa de TODA la plataforma (antes estaba en la barra de cada gráfico y se iba al ocultar las temporalidades) */
  {const fb=$("#fsb"),d=document,de=d.documentElement,can=!!(de.requestFullscreen||de.webkitRequestFullscreen);
    const isFs=()=>!!(d.fullscreenElement||d.webkitFullscreenElement);
    const ic=on=>`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${on?'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>':'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'}</svg>`;
    const sync=()=>{const on=isFs();fb.classList.toggle("on",on);fb.title=on?"Salir de pantalla completa (Esc)":"Pantalla completa (toda la plataforma)";fb.innerHTML=ic(on)};
    /* en iPhone no existe pantalla completa en el navegador: el botón se oculta (instalada como app ya ocupa toda la pantalla) */
    fb.hidden=!can;
    fb.onclick=()=>{try{if(isFs())(d.exitFullscreen||d.webkitExitFullscreen).call(d);else{const r=(de.requestFullscreen||de.webkitRequestFullscreen).call(de);r&&r.catch&&r.catch(()=>{})}}catch(e){}};
    d.addEventListener("fullscreenchange",sync);d.addEventListener("webkitfullscreenchange",sync);sync()}
  $("#wlb").onclick=()=>{if(mobile())setWl(!main.classList.contains("wlopen"));else{SAVE.hide.wl=!SAVE.hide.wl;save();applyHide()}};
  $("#wlx").onclick=()=>{if(mobile())setWl(false);else{SAVE.hide.wl=true;save();applyHide()}};
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
      setSym(s);if(mobile())setWl(false)}});
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
    $("#ftadd").onclick=()=>{q.value="";if(mobile())setWl(true);else if(SAVE.hide.wl){SAVE.hide.wl=false;save();applyHide()}setTab(tab==="fav"?"bc":tab);q.focus()};
    paintTabs();watch();ftArrows()}
  const ftw=$(".ftw");
  function ftArrows(){const over=ftabs.scrollWidth>ftabs.clientWidth+2;ftw.classList.toggle("over",over);
    ftw.querySelector('[data-d="-1"]').disabled=ftabs.scrollLeft<=2;ftw.querySelector('[data-d="1"]').disabled=ftabs.scrollLeft+ftabs.clientWidth>=ftabs.scrollWidth-2;
    /* cuántos mercados quedan escondidos a cada lado (número en las flechas) */
    const R=ftabs.getBoundingClientRect();let L=0,Rt=0;ftabs.querySelectorAll(".ft[data-s]").forEach(t=>{const r=t.getBoundingClientRect();if(r.right<=R.left+r.width*.5)L++;else if(r.left>=R.right-r.width*.5)Rt++});
    ftw.querySelector('[data-d="-1"]').innerHTML=`‹${L?`<em>${L}</em>`:""}`;ftw.querySelector('[data-d="1"]').innerHTML=`›${Rt?`<em>${Rt}</em>`:""}`}
  ftw.querySelectorAll(".fta").forEach(b=>b.onclick=()=>ftabs.scrollBy({left:+b.dataset.d*(mobile()?ftabs.clientWidth:Math.max(160,ftabs.clientWidth*.7)),behavior:"smooth"}));
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
    const want=new Set(SAVE.fav.concat(shown.slice(0,20),shownPick||[]));
    watching.forEach(s=>{if(!want.has(s)){watching.delete(s);TKW.delete(s);tickDrop(s)}});
    want.forEach(s=>{if(watching.has(s))return;watching.add(s);
      TKW.add(s);tickEnsure(s);
      if(dayOpen[s]==null)feed.ask({ticks_history:s,style:"candles",granularity:86400,end:"latest",count:1}).then(m=>{const c=(m.candles||[])[0];if(c){dayOpen[s]=+c.open;if(last[s]==null)last[s]=+c.close;onPrice(s)}}).catch(()=>{});
    })},250)}

  /* ---------- gráficos vinculados: cruz sincronizada por fecha y mercado común ---------- */
  const paintLink=()=>{};delete SAVE.link;

  /* ---------- atajos de teclado (como TradingView) ---------- */
  const KEYS={KeyB:"__brush",KeyT:"segment",KeyH:"horizontalStraightLine",KeyJ:"horizontalRayLine",KeyV:"verticalStraightLine",KeyF:"fibonacciLine",KeyR:"rect",KeyZ:"eagZone",KeyL:"eagLong",KeyS:"eagShort",KeyM:"eagMeasure",KeyX:"eagText",KeyC:"parallelStraightLine"};
  const tfBox=document.createElement("div");tfBox.className="tfbox";tfBox.hidden=true;appw.appendChild(tfBox);let tfBuf="",tfT=null;
  function tfParse(b){const m=b.trim().toLowerCase().match(/^(\d+)\s*([mhd])?$/);if(!m)return null;let n=+m[1],u=m[2]||"m";
    if(u==="m"&&n>=60&&n%60===0){n/=60;u="h"}if(u==="h"&&n===24){n=1;u="d"}const t=u==="m"?n+"m":u==="h"?n+"H":n+"D";return perFind(t)}
  function tfShow(){tfBox.innerHTML=`<span>Temporalidad</span><b>${esc(tfBuf)}</b><em>${tfParse(tfBuf)?"Enter para aplicar":"1–30 (min), 1h, 2h, 4h, 8h, 1d"}</em>`;tfBox.hidden=false;clearTimeout(tfT);tfT=setTimeout(()=>{tfBox.hidden=true;tfBuf=""},4000)}
  addEventListener("keydown",e=>{const t=e.target;if(t&&t.closest&&t.closest("input,textarea,select,[contenteditable]"))return;const p=panes[active];if(!p||!p.kc)return;
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&!e.altKey&&(e.code==="KeyZ"||e.code==="KeyY")){e.preventDefault();const ok=(e.code==="KeyY"||e.shiftKey)?p.kc.redo():p.kc.undo();if(!ok)toast(e.code==="KeyY"||e.shiftKey?"Nada para rehacer":"Nada para deshacer");return}
    if(e.altKey&&!mod&&KEYS[e.code]){e.preventDefault();KEYS[e.code]==="__brush"?p.kc.startBrush():p.kc.startTool(KEYS[e.code]);return}
    if(mod||e.altKey)return;
    if(!tfBox.hidden&&e.key==="Enter"){const per=tfParse(tfBuf);tfBox.hidden=true;tfBuf="";if(per){p.kc.setPeriod(per);afterTF()}else toast("Esa temporalidad no está disponible");return}
    if(!tfBox.hidden&&e.key==="Backspace"){tfBuf=tfBuf.slice(0,-1);tfBuf?tfShow():(tfBox.hidden=true);return}
    if(/^[0-9]$/.test(e.key)||(!tfBox.hidden&&/^[mhdMHD]$/.test(e.key))){tfBuf+=e.key;tfShow()}});

  /* ---------- todo guardado en la cuenta (dibujos y diseño), para verlo en cualquier dispositivo ---------- */
  let syncT=null;
  window.__eagSync=()=>{clearTimeout(syncT);syncT=setTimeout(pushSync,2500)};
  let lastPush=null;
  function pushSync(){if(!API.saveChartState)return;let draw={};try{draw=JSON.parse(localStorage.getItem("eag_draw_v1")||"{}")}catch(e){}
    const body={prefs:SAVE,draw,v:1},js=JSON.stringify(body);
    if(js===lastPush)return; /* nada cambió desde el último guardado: no se envía */
    lastPush=js;
    API.saveChartState(body).catch(()=>{lastPush=null}).then(()=>{try{localStorage.setItem("eag_sync_ts",String(Date.now()))}catch(e){}}).catch(()=>{})}
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&syncT){clearTimeout(syncT);pushSync()}});
  /* celular: el sistema (sobre todo iPhone) borra los gráficos cuando la app pasa mucho rato en segundo plano y quedan en blanco.
     Ahí lo único 100% seguro es recargar la página completa: el botón ↻ del gráfico lo hace en celular, y si la app estuvo
     oculta 3 minutos o más, al volver se recarga sola (se guarda todo antes). */
  const touchDev=()=>mobile()||(window.matchMedia&&matchMedia("(hover:none)").matches);
  let reloading=false;
  function fullReload(){if(!touchDev())return false;if(reloading)return true;reloading=true;
    try{save()}catch(e){}try{clearTimeout(syncT);pushSync()}catch(e){}
    const m=document.createElement("div");m.className="reloadov";m.innerHTML='<i></i><span>Actualizando gráficos…</span>';document.body.appendChild(m);
    setTimeout(()=>location.reload(),250);return true}
  addEventListener("pageshow",e=>{if(e.persisted&&touchDev())fullReload()});
  /* pestaña/app oculta más de 1 minuto: se pausan los precios en vivo; al volver se reconecta y se recargan los gráficos */
  let hideT=null,hiddenAt=0;
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"){hiddenAt=Date.now();clearTimeout(hideT);hideT=setTimeout(()=>feed.pause(),60000);return}
    clearTimeout(hideT);
    if(touchDev()&&hiddenAt&&Date.now()-hiddenAt>=180000){fullReload();return}
    if(!feed.paused())return;
    feed.resume();
    setTimeout(()=>{try{panes.forEach(p=>p&&p.kc&&p.kc.reloadData&&p.kc.reloadData())}catch(e){}
      try{Object.keys(MTFS).forEach(k=>buildMTF(+k))}catch(e){}
      try{loadAlerts()}catch(e){}},300)});

  $("#cfgb").onclick=e=>{e.stopPropagation();openSettings()};
  $("#alb").onclick=e=>{e.stopPropagation();if(LOCK.alerts)return upsell("Las alertas de precio");openSettings("alertas")};
  /* ---------- Estudio (Replay + Práctica): Premium; el admin puede incluirlo en la prueba de 3 días ---------- */
  let SITE={};try{API.site&&API.site().then(d=>{SITE=d||{}}).catch(()=>{})}catch(e){}
  /* Replay: desde Oro. Práctica guiada: solo Diamond. El admin puede abrir ambos en la prueba. */
  const planRank=()=>{try{if(API.isAdmin())return 9;if(!API.isPremium())return 0;return({cobre:1,plata:2,oro:3,diamond:4})[String(((API.profile&&API.profile())||{}).plan||"").toLowerCase()]||0}catch(e){return 0}};
  const proAccess=mode=>{const need=mode==="replay"?3:4,r=planRank();if(r>=need)return{ok:true};
    if(AFFK.has(mode==="replay"?"replay":"prac"))return{ok:true};
    if(window.__trial&&SITE.chartProTrial)return{ok:true};
    return{ok:false,need,why:mode==="replay"?"El Replay del mercado es exclusivo del plan Oro: mira el mercado vela por vela, en varias temporalidades a la vez y con operaciones simuladas.":"La Práctica guiada es exclusiva del plan Diamond: estudia con mercado real proyección, zonas, rompimientos e impulsos, con corrección al instante."}};
  if(window.EAGPro){window.EAGPro.init({feed,syms:()=>SYMS,SAVE,save,toast,MAIN,access:proAccess,
      get up(){return CF().up||"#089981"},get dn(){return CF().dn||"#f23645"},
      cur:()=>{try{const p=panes[active];return{sym:p.kc.getSymbol().ticker,tf:p.kc.getPeriod().text}}catch(e){return{}}}});
    $("#prob").onclick=e=>{e.stopPropagation();window.EAGPro.open(proAccess("prac").ok||!proAccess("replay").ok?"prac":"replay")}}else $("#prob").hidden=true;
  /* contador de spikes en el gráfico de ticks (Boom y Crash) */
  window.EAGSpikes&&window.EAGSpikes.init({panes:()=>panes.slice(0,visible()),toast,on:()=>CF().ticks!==false&&CF().spk!==false,setOff:()=>{SAVE.cfg.spk=false;save()}});
  /* Modo Clase (en vivo) y Zonas del profe */
  if(window.EAGClase&&API.liveGet){
    window.EAGClase.init({API,toast,SAVE,save,btn:$("#clb"),host:main,planUrl:PLAN_URL,
      isAdmin:()=>API.isAdmin(),rank:planRank,trialPro:()=>!!(window.__trial&&SITE.chartProTrial),
      panes:()=>panes.slice(0,visible()),active:()=>active,
      follow:(s,tf)=>{if(!s)return;if(!bySym[s]&&SYMS.length>20){toast("Ese mercado no está disponible ahora.");return}const p=panes[active];if(!p)return;
        const pp=tf?perFind(tf):null;try{p.kc.setSymbol(findInfo(s),pp||undefined);if(pp&&p.kc.getPeriod().text!==pp.text)p.kc.setPeriod(pp)}catch(e){}
        SAVE.panes[active]=Object.assign({},SAVE.panes[active],{s},pp?{p:pp.text}:{});save();setTimeout(()=>{try{if(MTFS[active])buildMTF(active);paintList();paintTabs();afterTF()}catch(e){}},80)}})}
  else{const cb=$("#clb");cb&&(cb.hidden=true)}
  /* Comunidad: chat privado y grupal, conectados, compartir gráfico y voz */
  if(window.EAGSocial&&API.chatSend){
    if(window.EAGJournal)window.EAGJournal.init({SAVE,save,toast,onChange:()=>{try{TRK.paint()}catch(e){}}});
    if(window.EAGPip)window.EAGPip.init({btn:$("#pipb"),toast,panes:()=>panes.slice(0,visible()),active:()=>active});
    window.EAGSocial.init({API,toast,SAVE,save,btn:$("#chb"),host:main,isAdmin:()=>API.isAdmin(),
      panes:()=>panes.slice(0,visible()),active:()=>active,
      follow:(s,tf)=>{if(!s)return;if(!bySym[s]&&SYMS.length>20){toast("Ese mercado no está disponible ahora.");return}const p=panes[active];if(!p)return;
        const pp=tf?perFind(tf):null;try{p.kc.setSymbol(findInfo(s),pp||undefined);if(pp&&p.kc.getPeriod().text!==pp.text)p.kc.setPeriod(pp)}catch(e){}
        SAVE.panes[active]=Object.assign({},SAVE.panes[active],{s},pp?{p:pp.text}:{});save();setTimeout(()=>{try{if(MTFS[active])buildMTF(active);paintList();paintTabs();afterTF();window.EAGSocial.panesChanged()}catch(e){}},80)}})}
  else{const cb=$("#chb");cb&&(cb.hidden=true)}
  /* puntero láser: en todos los gráficos visibles; Esc o el mismo botón lo apagan */
  {const lb=$("#lzb");if(lb)lb.onclick=()=>{setLaserAll(!laserOn);if(laserOn)toast(window.EAGClase&&window.EAGClase.isTx&&window.EAGClase.isTx()?"🔴 Láser activo: tus alumnos en Modo Clase lo ven. Esc para apagarlo.":"Láser activo: mueve el mouse sobre el gráfico. Esc para apagarlo.")}}
  /* Operar con Deriv (multiplicadores) para todos; cTrader solo el admin */
  if(window.EAGTrade){const tb=$("#trb");tb.hidden=false;tb.title="Operar con tu cuenta de Deriv (multiplicadores) desde el gráfico";
    window.EAGTrade.init({admin:API.isAdmin(),toast,syms:()=>SYMS,cur:()=>{try{const p=panes[active],s=p.kc.getSymbol();return{sym:s.ticker,name:s.name||s.shortName,tf:p.kc.getPeriod().text}}catch(e){return{}}},chart:()=>{try{return panes[active].kc.chart}catch(e){return null}},autoConnect:true});
    tb.onclick=e=>{e.stopPropagation();window.EAGTrade.open()}}
  /* botón Instalar app: visible si no está instalada y el navegador lo permite (o en iPhone, con instrucciones) */
  const ib=$("#instb");
  function installHelp(){const ov=document.createElement("div");ov.className="wmodal";const ios=isIOS(),ia=inApp();
    ov.innerHTML=`<div class="wmbox inst-box"><div class="mh"><b>Instalar EAG Charts</b><button class="x" data-a="close">×</button></div>
      <p class="inst-p">Queda como una app independiente: pantalla completa, con su ícono y sin barras del navegador.</p>
      ${ia?`<ol class="inst-s"><li>Estás dentro de otra app (TikTok, Instagram, WhatsApp…). Toca <b>⋯</b> y elige <b>Abrir en el navegador</b>${ios?" (Safari)":" (Chrome)"}.</li><li>Ahí vuelve a tocar <b>Instalar app</b>.</li></ol>`
      :ios?`<ol class="inst-s"><li>Abre esta página en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> <span class="inst-i">⎋</span> (el cuadrito con la flecha hacia arriba).</li><li>Baja y toca <b>Agregar a inicio</b>.</li><li>Toca <b>Agregar</b>. Listo: ábrela desde el ícono <b>EAG Charts</b>.</li></ol>`
      :`<ol class="inst-s"><li>Toca el menú <b>⋮</b> del navegador (arriba a la derecha).</li><li>Elige <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.</li><li>Confirma. Ábrela desde el ícono <b>EAG Charts</b>.</li></ol>`}
      <div class="inst-f"><button class="btn gold" data-a="close">Entendido</button></div></div>`;
    ov.onclick=e=>{if(e.target===ov||e.target.closest('[data-a="close"]'))ov.remove()};document.body.appendChild(ov)}
  async function doInstall(){if(INST.evt){const ev=INST.evt;INST.evt=null;ev.prompt();try{const r=await ev.userChoice;if(r&&r.outcome==="accepted"){ib.hidden=true;toast("¡Listo! Abre EAG Charts desde su ícono")}}catch(e){}return}installHelp()}
  const showInst=()=>{ib.hidden=standalone()||!(INST.evt||isIOS()||matchMedia("(hover:none)").matches)};showInst();
  ib.onclick=e=>{e.stopPropagation();doInstall()};
  /* aviso una sola vez en celular: instalarla como app */
  if(!standalone()&&matchMedia("(hover:none)").matches&&!SAVE.instAsked)setTimeout(()=>{if(standalone()||SAVE.instAsked)return;SAVE.instAsked=1;save();
    const bn=document.createElement("div");bn.className="inst-bn";bn.innerHTML=`<img src="/assets/charts-icon-192.png" alt=""><span><b>Instala EAG Charts</b><small>Pantalla completa, como una app</small></span><button class="btn sm gold">Instalar</button><button class="x" title="Cerrar">×</button>`;
    bn.querySelector(".gold").onclick=()=>{bn.remove();doInstall()};bn.querySelector(".x").onclick=()=>bn.remove();document.body.appendChild(bn);setTimeout(()=>bn.remove(),20000)},25000);

  /* ======================= CONFIGURACIÓN (un solo menú por categorías) ======================= */
  const SI=(d)=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const CATS=[
    ["apariencia","Apariencia","Tema, fondo y velas",SI('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>')],
    ["grafico","Gráfico","Cuadrícula, ejes y precio",SI('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>')],
    ["marca","Marca de agua","Mercado y logo de fondo",SI('<path d="M4 7h16M4 12h10M4 17h7"/>')],
    ["barras","Barras y paneles","Qué se ve y dónde",SI('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>')],
    ["riesgo","Calculadora de lote","Lote según tu riesgo",SI('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h8"/>')],
    ["alertas","Alertas","Precio, RSI, medias, spikes",SI('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>')],
    ["atajos","Ayuda y atajos","Tutorial y teclado",SI('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>')]];
  const PDESC={top:"Logo, distribución de gráficos, estado de conexión y botones principales.",pb:"Mercado, temporalidades favoritas, indicadores y captura de cada gráfico.",
    bb:"Rangos rápidos (1D, 5D, 1M…), reloj, cuenta regresiva y escala % / log.",db:"Herramientas de dibujo a la izquierda de cada gráfico.",tf:"Tus herramientas de dibujo favoritas en una barra que puedes mover.",
    ft:"Tus mercados favoritos como pestañas, con precio y % del día.",wl:"Todos los mercados por categoría, con buscador y precios en vivo."};
  let setCat="apariencia";
  const row=(t,d,ctl)=>`<div class="srow"><div><b>${t}</b>${d?`<p>${d}</p>`:""}</div><div class="sctl">${ctl}</div></div>`;
  const tog=(attr,on)=>`<label class="sw2"><input type="checkbox" ${attr} ${on?"checked":""}><i></i></label>`;
  /* ---------- calculadora de lote ---------- */
  const RISK=()=>Object.assign({on:false,bal:0,mode:"pct",pct:1,usd:0},SAVE.risk||{});
  const riskUsd=r=>r.mode==="usd"?(+r.usd||0):(+r.bal||0)*(+r.pct||0)/100;
  /* tamaño del contrato en MT5: sintéticos y cripto 1, forex 100.000, oro y platino 100, plata 5.000 */
  const contractOf=tk=>{const i=bySym[tk]||{},m=i.market||"";if(/XAU|XPT|XPD/.test(tk))return[100,true];if(/XAG/.test(tk))return[5000,true];
    if(m==="forex"||/^frx/.test(tk))return[100000,/USD$/.test(tk)];return[1,true]};
  window.__eagLot=(tk,entry,sl)=>{const r=RISK();if(!r.on||!tk)return"";const d=Math.abs(+entry-+sl),usd=riskUsd(r);if(!(d>0)||!(usd>0))return"";
    const [cs,exact]=contractOf(tk),lot=Math.floor(usd/(d*cs)*100+1e-9)/100;
    return lot>=0.01?`${exact?"":"≈ "}Lote ${lot.toFixed(2)} · $${usd%1?usd.toFixed(2):usd}`:`Lote < 0.01 · SL muy lejos`};
  /* ---------- marcador de operaciones (para los lives): −1 / 0 / +1 en "R" (lo que arriesgas por operación) ---------- */
  const TRK=(()=>{const st=()=>{SAVE.trk=Object.assign({open:false,ops:[],risk:null,x:null,y:null,big:false},SAVE.trk||{});return SAVE.trk};
    let el=null,sure=false,sureT=0;
    const rk=()=>{const t=st();if(t.risk>0)return+t.risk;const u=riskUsd(RISK());return u>0?u:0};
    const money=v=>(v<0?"−":v>0?"+":"")+"US$ "+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:Math.abs(v)%1?2:0,maximumFractionDigits:2});
    const rTxt=v=>(v>0?"+":v<0?"−":"")+Math.abs(v)+"R";
    const val=q=>q.v!=null?+q.v:q.r*q.u; /* antes se guardaba en R (r × u); ahora el monto en US$ */
    function place(){const t=st();if(!el)return;const W=innerWidth,H=innerHeight,w=el.offsetWidth||240,h=el.offsetHeight||200;
      let x=t.x==null?W-w-18:t.x,y=t.y==null?Math.max(70,H-h-90):t.y;x=Math.min(Math.max(6,x),W-w-6);y=Math.min(Math.max(6,y),H-h-6);el.style.left=x+"px";el.style.top=y+"px"}
    function paint(){const t=st();if(!el)return;const O=t.ops,w=O.filter(q=>val(q)>0).length,l=O.filter(q=>val(q)<0).length,z=O.filter(q=>val(q)===0).length;
      const tot=O.reduce((a,q)=>a+val(q),0),wr=w+l?Math.round(w/(w+l)*100):null,r=rk();
      el.classList.toggle("big",!!t.big);
      el.querySelector("[data-tot]").textContent=O.length?money(tot):"US$ 0";
      el.querySelector("[data-tot]").className="trk-tot"+(tot>0?" tw":tot<0?" tl":"");
      el.querySelector("[data-sub]").textContent=O.length?`${O.length} ${O.length===1?"operación":"operaciones"}${wr!=null?` · ${wr}% acierto`:""}`:"Sin operaciones todavía";
      el.querySelector("[data-w]").textContent=w;el.querySelector("[data-l]").textContent=l;el.querySelector("[data-z]").textContent=z;
      el.querySelector("[data-seq]").innerHTML=O.slice(-14).map(q=>`<i class="${val(q)>0?"tw":val(q)<0?"tl":"tz"}" title="${money(val(q))}"></i>`).join("");
      const ri=el.querySelector("[data-risk]");if(document.activeElement!==ri)ri.value=r?String(+r.toFixed(2)):"";
      el.querySelector("[data-rhint]").textContent=t.risk>0?"lo que sumas o restas":riskUsd(RISK())>0?"de tu calculadora":"escribe el monto";
      el.querySelectorAll("[data-a]").forEach(b=>b.disabled=!r&&b.dataset.a!=="0");
      {const ja=el.querySelector("[data-jadd]"),J=window.EAGJournal,ss=J&&t.sid&&J.sessionIn(t.sid),cur=+tot.toFixed(2),same=ss&&ss.v===cur&&ss.n===O.length;
        ja.disabled=!O.length||!!same;ja.classList.toggle("done",!!same);
        ja.innerHTML=!O.length?"📅 Agregar al journal":same?`✓ En el journal: ${money(cur)}`:ss?`📅 Actualizar journal (${money(cur)})`:`📅 Agregar al journal: ${money(cur)}`}
      const jt=window.EAGJournal&&window.EAGJournal.today(),jd=el.querySelector("[data-jtoday]");if(jd)jd.innerHTML=jt&&jt.pnl!=null?`Hoy en el journal: <b class="${jt.pnl>0?"tw":jt.pnl<0?"tl":""}">${money(jt.pnl)}</b>`:"Abre el journal: calendario de tus días";
      el.querySelector("[data-undo]").disabled=!O.length;const rs=el.querySelector("[data-reset]");rs.disabled=!O.length;rs.textContent=sure?"¿Seguro?":"Reiniciar";rs.classList.toggle("sure",sure)}
    function build(){el=document.createElement("div");el.className="trk";el.innerHTML=`
      <div class="trk-h" data-drag><span class="trk-t">${'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 4v16"/></svg>'} Marcador</span>
        <button data-jr title="Journal: calendario de PnL por día, semana, mes y año">📅</button><button data-size title="Tamaño grande / normal (para que se lea en el live)">A</button><button data-x title="Ocultar (vuelve con el botón del marcador, abajo a la izquierda del gráfico)">×</button></div>
      <div class="trk-tot" data-tot></div><div class="trk-sub" data-sub></div>
      <div class="trk-cnt"><span class="tw"><b data-w>0</b>Ganadas</span><span class="tz"><b data-z>0</b>En cero</span><span class="tl"><b data-l>0</b>Perdidas</span></div>
      <div class="trk-seq" data-seq></div>
      <div class="trk-f"><label>Monto US$ <input data-risk type="text" inputmode="decimal" placeholder="0"></label><small data-rhint></small></div>
      <div class="trk-btn"><button data-a="-1" class="tl" title="Pérdida: resta el monto">− Perdí</button><button data-a="0" class="tz" title="En cero (break even)">0</button><button data-a="1" class="tw" title="Ganancia: suma el monto">+ Gané</button></div>
      <button class="trk-add" data-jadd></button><button class="trk-jr" data-jopen data-jtoday></button>
      <div class="trk-act"><button data-undo>↶ Deshacer</button><button data-reset>Reiniciar</button></div>`;
      document.body.appendChild(el);
      el.addEventListener("pointerdown",e=>e.stopPropagation());
      el.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{const a=+b.dataset.a,u=rk();if(a&&!u)return;const v=+(a*u).toFixed(2),t=Date.now(),T=st();if(!T.ops.length||!T.sid)T.sid=String(t);T.ops.push({v,t});sure=false;save();paint()});
      el.querySelector("[data-undo]").onclick=()=>{st().ops.pop();sure=false;save();paint()};
      el.querySelector("[data-jadd]").onclick=()=>{const T=st(),J=window.EAGJournal;if(!J||!T.ops.length)return;if(!T.sid)T.sid=String(T.ops[0].t);
        const tot=+T.ops.reduce((a,q)=>a+val(q),0).toFixed(2),r=J.setSession(T.sid,tot,T.ops.length);save();paint();
        toast(`📅 Agregado al journal de hoy: ${money(tot)} (${T.ops.length} op).${r.man?" Ojo: ese día tiene un monto escrito a mano, que es el que se usa.":""}`)};
      el.querySelector("[data-jr]").onclick=el.querySelector("[data-jopen]").onclick=()=>window.EAGJournal&&window.EAGJournal.toggle();
      el.querySelector("[data-reset]").onclick=()=>{if(!sure){sure=true;clearTimeout(sureT);sureT=setTimeout(()=>{sure=false;paint()},3000);paint();return}sure=false;st().ops=[];st().sid=null;save();paint();toast("Marcador en cero. Lo que agregaste al journal se queda.")};
      el.querySelector("[data-x]").onclick=()=>toggle(false);
      el.querySelector("[data-size]").onclick=()=>{const t=st();t.big=!t.big;save();paint();place()};
      const ri=el.querySelector("[data-risk]");ri.oninput=()=>{const v=Math.abs(parseFloat(ri.value.replace(",",".")));st().risk=v>0?v:null;save();paint()};ri.onblur=()=>paint();
      /* arrastrar desde la cabecera */
      const hd=el.querySelector("[data-drag]");let d=null;
      hd.addEventListener("pointerdown",e=>{if(e.target.closest("button"))return;d={x:e.clientX-el.offsetLeft,y:e.clientY-el.offsetTop};hd.setPointerCapture(e.pointerId);e.preventDefault()});
      hd.addEventListener("pointermove",e=>{if(!d)return;const t=st();t.x=e.clientX-d.x;t.y=e.clientY-d.y;place()});
      hd.addEventListener("pointerup",()=>{if(d){d=null;save()}});
      addEventListener("resize",place)}
    function toggle(on){const t=st();t.open=on==null?!t.open:!!on;save();if(t.open){if(!el)build();el.hidden=false;paint();place()}else if(el)el.hidden=true;
      document.querySelectorAll(".wtrk").forEach(b=>b.classList.toggle("on",t.open))}
    setTimeout(()=>{if(st().open)toggle(true)},600);
    return{toggle,paint:()=>{if(el&&!el.hidden)paint()}}})();
  let lotT=0;const lotRepaint=()=>{clearTimeout(lotT);lotT=setTimeout(()=>panes.forEach(p=>{try{p.kc.repaint()}catch(e){}}),60)};
  function settingsBody(cat){const c=CF();
    if(cat==="apariencia")return`<h3>Apariencia</h3>
      <div class="sgrp"><div class="slabel">Tema</div><div class="thm">${[["dark","Oscuro","#0b0c0e","#131418"],["light","Claro","#ffffff","#f3f4f6"],["eag","Arte Gráfico","#060b1a","#0a1330"]].map(([v,t,a,b])=>`<button class="thc${c.theme===v?" on":""}" data-th="${v}"><span class="thp" style="background:${a}"><i style="background:${b}"></i><em style="background:${c.up}"></em><em style="background:${c.dn};height:40%"></em><em style="background:${c.up};height:55%"></em></span><b>${t}</b></button>`).join("")}</div></div>
      <div class="sgrp"><div class="slabel">Fondo del gráfico</div><p class="shelp">"A" usa el fondo del tema. Puedes elegir cualquier color con +.</p><div class="sws">${BGS.map(b=>`<button class="swc${(c.bg||"")===b?" on":""}" data-bg="${b}" style="background:${b}" title="${b}"></button>`).join("")}<label class="swc pick" title="Otro color"><input type="color" data-bgp value="${c.bg||defBg()}">+</label><button class="swc auto${c.bg?"":" on"}" data-bg="" title="Según el tema">A</button></div></div>
      <div class="sgrp"><div class="slabel">Velas</div><div class="seg seg-wrap">${CTYPES.map(([v,t])=>`<button data-ty="${v}" class="${c.type===v?"on":""}">${t}</button>`).join("")}</div>
        ${c.type==="ha"?`<p class="shelp"><b>Heikin Ashi</b>: velas "promediadas" que suavizan el ruido y muestran mejor la tendencia. Ojo: sus precios no son los reales del mercado; para entrar y poner el SL mira el precio real.</p>`:""}
        ${c.type==="renko"?`<p class="shelp"><b>Renko</b>: ladrillos del mismo tamaño que solo se dibujan cuando el precio se mueve esa distancia; el tiempo no cuenta. Para cambiar de color hace falta un movimiento de 2 ladrillos.</p>
          ${row("Tamaño del ladrillo","En puntos. Vacío = automático (según el movimiento normal del mercado).",`<input type="number" min="0" step="any" data-rbox value="${c.rbox>0?c.rbox:""}" placeholder="Auto" style="width:90px">`)}`:""}
        ${row("Color alcista","Velas que cierran por encima de su apertura.",`<input type="color" data-col="up" value="${c.up}">`)}${row("Color bajista","Velas que cierran por debajo de su apertura.",`<input type="color" data-col="dn" value="${c.dn}">`)}</div>`;
    if(cat==="grafico")return`<h3>Gráfico</h3>
      <div class="slabel">Decimales del precio</div><p class="shelp">Cuántos decimales se ven en el precio, la escala y la leyenda. "Auto" usa los del mercado.</p>
      <div class="seg">${[["auto","Auto"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"]].map(([v,t])=>`<button data-dec="${v}" class="${String(c.dec)===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="slabel">Tamaño de letra del gráfico</div><p class="shelp">Agranda la regla de precios (precios y etiquetas de tus dibujos en la regla). El resto del gráfico queda igual. Usa "Grande" o "Muy grande" para transmitir en vivo.</p>
      <div class="seg">${[[11,"Normal"],[13,"Mediana"],[15,"Grande"],[18,"Muy grande"]].map(([v,t])=>`<button data-fz="${v}" class="${+c.font===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="slabel">Contador de cierre de vela</div><p class="shelp">"En Multi-TF": cada temporalidad de la multitemporalidad muestra lo que le falta a su vela. "Junto a la vela" es como en MT5: al lado de la última vela del gráfico grande, con el nombre del mercado.</p>
      <div class="seg">${[["mtf","En Multi-TF"],["vela","Junto a la vela"],["regla","En la regla"],["off","Oculto"]].map(([v,t])=>`<button data-cd="${v}" class="${(c.cd||"mtf")===v?"on":""}">${t}</button>`).join("")}</div>
      <div class="slabel">Mostrar</div>`+[["grid","Cuadrícula","Líneas de fondo para ubicar precios y horas."],["axis","Ejes de precio y hora","La escala de precios a la derecha y las horas abajo."],["last","Línea del último precio","Línea punteada y etiqueta con el precio actual."],["hl","Máximo y mínimo visibles","Marca el precio más alto y más bajo de lo que estás viendo."],["cross","Cruz del cursor","Líneas que siguen al mouse con precio y hora exactos."]].map(([k,t,d])=>row(t,d,tog(`data-k="${k}"`,c[k]))).join("")
      +`<div class="slabel">Dibujos</div>`+row("Dibujos nuevos solo en su temporalidad","Lo que dibujes se verá solo en la temporalidad donde lo hiciste (por ejemplo, tus zonas de H1 no aparecen en M1). Cada dibujo se puede cambiar después en su pestaña «Visibilidad».",tog('data-k="drawTf"',c.drawTf))
      +`<div class="slabel">Zonas automáticas</div>`+row("Soportes y resistencias automáticos"+(LOCK.az?" 🔒":""),"Marca solas las zonas donde el precio rebotó 2 o más veces (hasta 3 arriba y 3 abajo). Se actualizan cada 15 segundos. Son una ayuda: confírmalas con tu análisis.",tog('data-k="az"',!!c.az&&!FREE))
      +`<div class="slabel">Gráfico de ticks</div>`+[["ticks","Botón «Ticks»","Gráfico donde cada punto es un movimiento del precio, como el gráfico de ticks de MT5."],["spk","Contador de spikes (Boom y Crash)","En el gráfico de ticks: cuántos ticks van desde el último spike y la estadística. Es estadística, no predicción."]].map(([k,t,d])=>row(t,d,tog(`data-k="${k}"`,c[k]!==false))).join("");
    if(cat==="marca")return`<h3>Marca de agua</h3><p class="shelp">Ideal para tus lives: se ve el mercado, la temporalidad y tu marca de fondo.</p>
      ${row("Mostrar mercado y temporalidad","La marca EL ARTE GRÁFICO siempre se ve; esto quita o pone el nombre del mercado.",tog('data-k="wm"',c.wm))}
      <div class="sgrp"><div class="slabel">Qué mostrar</div><div class="seg">${[["both","Marca y mercado"],["brand","Solo marca"]].map(([v,t])=>`<button data-wm="${v}" class="${c.wmMode===v?"on":""}">${t}</button>`).join("")}</div>
      <label class="rg"><span>Visibilidad</span><input type="range" min="6" max="60" step="1" data-r="wmOp" value="${c.wmOp}"><em>${c.wmOp}%</em></label>
      <label class="rg"><span>Tamaño</span><input type="range" min="50" max="200" step="5" data-r="wmSize" value="${c.wmSize}"><em>${c.wmSize}%</em></label>
      <div class="slabel">Color</div><div class="sws">${[["auto","Automático"],["#e2b55c","Dorado"],["#ffffff","Blanco"],["#000000","Negro"],["#2962ff","Azul"]].map(([v,t])=>`<button class="swc${c.wmColor===v?" on":""}" data-wc="${v}" title="${t}" style="background:${v==="auto"?"linear-gradient(135deg,#fff 50%,#15171c 50%)":v}"></button>`).join("")}</div></div>`;
    if(cat==="barras")return`<h3>Barras y paneles</h3><p class="shelp">Activa solo lo que usas. Todo se guarda en tu cuenta.</p>
      ${PARTS.map(([k,t])=>row(t,PDESC[k]||"",tog(`data-h="${k}"`,!SAVE.hide[k]))).join("")}
      <div class="slabel">Posición</div>${row("Lista de mercados a la izquierda","",tog('data-o="wlLeft"',SAVE.wlLeft))}${row("Multitemporalidad arriba","Los mini gráficos de las temporalidades van arriba del gráfico grande en vez de abajo.",tog('data-o="mtfTop"',SAVE.mtfTop))}${row("Barra de dibujo a la derecha","",tog('data-o="dbRight"',SAVE.dbRight))}
      ${row("Pestañas de mercados","Arriba (como ahora) o abajo, como en MT5: en la vista Multi-TF quedan justo encima de la multitemporalidad.",`<div class="seg mini2"><button data-ftp="top" class="${SAVE.ftPos!=="bottom"?"on":""}">Arriba</button><button data-ftp="bottom" class="${SAVE.ftPos==="bottom"?"on":""}">Abajo</button></div>`)}
      <p class="shelp">Arrastra los bordes para cambiar tamaños (lista, multitemporalidad y división entre gráficos) y arrastra pestañas y favoritos para ordenarlos.</p>
      <div class="sbtns"><button class="btn sm" data-a="clean">${allHidden()?"Mostrar todo":"Modo limpio (solo gráfico)"}</button><button class="btn sm" data-a="rs">Restablecer tamaños</button></div>`;
    if(cat==="alertas"){const act=ALERTS.filter(a=>a.active),old=ALERTS.filter(a=>!a.active).slice(0,10),pp=a=>(bySym[a.symbol]?prec(bySym[a.symbol].pip):3);
      const li=a=>`<div class="arow${a.active?"":" done"}"><span class="adot"></span><div><b>${esc(a.symbol_name||a.symbol)}</b><p>${alertDesc(a,pp(a))}${a.repeat?" · cada vez":""}${a.note?" · "+esc(a.note):""}${a.active?(a.repeat&&a.triggered_at?` · último aviso ${new Date(a.triggered_at).toLocaleString("es-CO",{timeZone:"America/Bogota",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}`:""):` · se activó ${a.triggered_at?new Date(a.triggered_at).toLocaleString("es-CO",{timeZone:"America/Bogota",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}):""}`}</p></div>${a.active?"":`<button class="btn sm" data-re="${a.id}">Reactivar</button>`}<button class="x" data-del="${a.id}" title="Borrar">×</button></div>`;
      return`<h3>Alertas</h3><p class="shelp">De <b>precio</b> (toca un nivel o entra a una zona) y <b>técnicas</b>: cierre de vela, RSI, cruce de medias y spikes en Boom y Crash. Te avisamos al celular, aunque tengas la página cerrada. También puedes dibujar una línea o zona y hacer <b>clic derecho → 🔔 Crear alerta</b>.</p>
        <div class="sbtns"><button class="btn sm gold" data-a="newal">+ Nueva alerta</button></div>
        ${sndBlock()}
        <div class="slabel">Activas (${act.length}/30)</div>${act.length?act.map(li).join(""):`<p class="shelp">No tienes alertas activas.</p>`}
        ${old.length?`<div class="slabel">Ya avisadas</div>${old.map(li).join("")}`:""}
        <p class="shelp">Las notificaciones llegan a los dispositivos donde las activaste en la academia (en iPhone, con la app agregada a la pantalla de inicio). Se revisan cada minuto.</p>`}
    if(cat==="riesgo"){const r=RISK();const usd=riskUsd(r);
      return`<h3>Calculadora de lote</h3><p class="shelp">Dibuja una <b>zona de compra o venta</b> (Entrada y SL) o una <b>posición larga/corta</b>: en su etiqueta te sale el <b>lote</b> exacto para arriesgar lo que elijas aquí. Si mueves el SL, el lote se recalcula solo.</p>
        ${row("Mostrar el lote en mis zonas y posiciones","",tog('data-rk="on"',r.on))}
        <div class="sgrp${r.on?"":" off"}">
        <label class="af"><span>Saldo de tu cuenta (USD)</span><input type="number" min="0" step="any" data-rv="bal" value="${r.bal||""}" placeholder="Ej: 100"></label>
        <div class="slabel">¿Cuánto arriesgas por operación?</div>
        <div class="seg"><button data-rm="pct" class="${r.mode!=="usd"?"on":""}">Un % de la cuenta</button><button data-rm="usd" class="${r.mode==="usd"?"on":""}">Un monto fijo</button></div>
        ${r.mode==="usd"?`<label class="af"><span>Monto fijo por operación (USD)</span><input type="number" min="0" step="any" data-rv="usd" value="${r.usd||""}" placeholder="Ej: 5"></label>`
          :`<label class="af"><span>Porcentaje de la cuenta (%)</span><input type="number" min="0" max="100" step="any" data-rv="pct" value="${r.pct||""}" placeholder="Ej: 2"></label>`}
        <p class="shelp" data-rinfo>${usd>0?`Arriesgas <b>US$ ${usd.toFixed(2)}</b> por operación.`:"Escribe tu saldo y tu riesgo."}</p></div>
        <div class="slabel">Cómo se calcula</div>
        <p class="shelp"><b>Lote = riesgo en US$ ÷ (puntos hasta el SL × tamaño del contrato)</b>. En Boom, Crash y los sintéticos de Deriv el contrato es de 1: con 1 lote, cada punto vale US$ 1. Ejemplo: arriesgas US$ 10 y el SL está a 25 puntos → lote 0,40. En forex se usa el contrato de 100.000 (exacto en pares que terminan en USD; en los demás es aproximado, por eso sale con ≈).</p>
        <p class="shelp">Antes de entrar revisa en tu MT5 el <b>lote mínimo</b> del mercado (en Boom y Crash suele ser 0,20 y en Boom/Crash 300 es 1). Es una herramienta educativa, no una asesoría financiera.</p>`}
    if(cat==="atajos"){const K=(k,t)=>`<div class="krow"><span>${t}</span><kbd>${k}</kbd></div>`;const mac=/Mac|iP/.test(navigator.platform),A=mac?"⌥":"Alt",C=mac?"⌘":"Ctrl";
      return`<h3>Ayuda y atajos</h3><div class="sbtns"><button class="btn sm gold" data-a="tour">▶ Ver el tutorial otra vez</button><button class="btn sm" data-a="fb">💬 Dar mi opinión</button></div><div class="slabel">Dibujo</div>${K(A+" + B","Pincel (dibujo libre)")}${K(A+" + T","Línea de tendencia")}${K(A+" + H","Línea horizontal")}${K(A+" + J","Rayo horizontal")}${K(A+" + V","Línea vertical")}${K(A+" + F","Retroceso de Fibonacci")}${K(A+" + C","Canal paralelo")}${K(A+" + Z","Zona")}${K(A+" + R","Rectángulo")}${K(A+" + L","Posición larga (compra)")}${K(A+" + S","Posición corta (venta)")}${K(A+" + M","Regla (o Shift + clic)")}${K(A+" + X","Texto")}
        <div class="slabel">Edición</div>${K(C+" + Z","Deshacer")}${K(C+" + Shift + Z","Rehacer")}${K("Supr","Borrar el dibujo seleccionado")}${K("Esc","Cancelar dibujo / salir de modo limpio")}
        <div class="slabel">Temporalidad</div>${K("15 ↵","Escribe el número y Enter: 15 minutos")}${K("1h ↵ · 4h ↵","Horas")}${K("1d ↵","Diario")}`}
    return""}
  function openSettings(cat){const same=!cat||cat===setCat,old=$(".smodal .sbody"),keepY=same&&old?old.scrollTop:0,oldN=$(".smodal .snav"),keepN=oldN?oldN.scrollTop:0;
    if(cat)setCat=cat;closePop();let ov=$(".smodal");if(!ov){ov=document.createElement("div");ov.className="smodal";appw.appendChild(ov);ov.onclick=e=>{if(e.target===ov)ov.remove()}}
    ov.innerHTML=`<div class="sbox" role="dialog" aria-label="Configuración"><aside class="snav"><div class="stitle">Configuración</div>${CATS.map(([k,t,d,ic])=>`<button data-cat="${k}" class="${k===setCat?"on":""}">${ic}<span><b>${t}</b><small>${d}</small></span>${k==="alertas"&&ALERTS.some(a=>a.active)?`<em class="badge">${ALERTS.filter(a=>a.active).length}</em>`:""}</button>`).join("")}</aside>
      <section class="sbody">${settingsBody(setCat)}</section><button class="sclose" title="Cerrar (Esc)">×</button>
      <footer class="sfoot"><button class="btn sm" data-a="restore">Restaurar apariencia</button><span class="grow"></span><button class="btn sm gold" data-a="ok">Listo</button></footer></div>`;
    /* al tocar un switch se vuelve a pintar: se queda en el mismo punto (antes saltaba arriba) */
    {const sb=ov.querySelector(".sbody"),sn=ov.querySelector(".snav");if(sb&&keepY)sb.scrollTop=keepY;if(sn&&keepN)sn.scrollTop=keepN}
    const re=()=>openSettings();
    ov.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>openSettings(b.dataset.cat));
    ov.querySelector(".sclose").onclick=ov.querySelector('[data-a="ok"]').onclick=()=>ov.remove();
    ov.querySelector('[data-a="restore"]').onclick=()=>{SAVE.cfg=Object.assign({},CDEF);save();applyCfg();re()};
    const set=(k,v)=>{SAVE.cfg[k]=v;save();applyCfg();re()};
    ov.querySelectorAll("[data-th]").forEach(b=>b.onclick=()=>{SAVE.cfg.bg="";set("theme",b.dataset.th)});
    ov.querySelectorAll("[data-bg]").forEach(b=>b.onclick=()=>set("bg",b.dataset.bg));
    const bp=ov.querySelector("[data-bgp]");bp&&(bp.onchange=e=>set("bg",e.target.value));
    ov.querySelectorAll("[data-ty]").forEach(b=>b.onclick=()=>set("type",b.dataset.ty));
    const rb=ov.querySelector("[data-rbox]");rb&&(rb.onchange=()=>{const v=parseFloat(String(rb.value).replace(",","."));set("rbox",isFinite(v)&&v>0?v:0)});
    ov.querySelectorAll("[data-col]").forEach(i=>i.onchange=()=>set(i.dataset.col,i.value));
    ov.querySelectorAll("input[data-k]").forEach(i=>i.onchange=()=>{if(i.dataset.k==="az"&&LOCK.az&&i.checked){i.checked=false;upsell("Zonas automáticas de soporte y resistencia");return}set(i.dataset.k,i.checked)});
    ov.querySelectorAll("[data-wm]").forEach(b=>b.onclick=()=>set("wmMode",b.dataset.wm));
    ov.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>set("dec",b.dataset.dec==="auto"?"auto":+b.dataset.dec));
    ov.querySelectorAll("[data-cd]").forEach(b=>b.onclick=()=>set("cd",b.dataset.cd));
    ov.querySelectorAll("[data-fz]").forEach(b=>b.onclick=()=>set("font",+b.dataset.fz));
    ov.querySelectorAll("[data-wc]").forEach(b=>b.onclick=()=>set("wmColor",b.dataset.wc));
    ov.querySelectorAll("[data-r]").forEach(i=>{i.oninput=()=>{SAVE.cfg[i.dataset.r]=+i.value;i.nextElementSibling.textContent=i.value+"%";applyCfg()};i.onchange=()=>save()});
    ov.querySelectorAll("input[data-h]").forEach(i=>i.onchange=()=>{SAVE.hide[i.dataset.h]=!i.checked;save();applyHide();re()});
    ov.querySelectorAll("[data-ftp]").forEach(b=>b.onclick=()=>{SAVE.ftPos=b.dataset.ftp;save();placeFt();relayout();re()});
    ov.querySelectorAll("input[data-o]").forEach(i=>i.onchange=()=>{SAVE[i.dataset.o]=i.checked;save();applyLayoutPrefs();re()});
    const cl=ov.querySelector('[data-a="clean"]');cl&&(cl.onclick=()=>{const all=!allHidden();PARTS.forEach(([k])=>SAVE.hide[k]=all);save();applyHide();ov.remove();if(all)toast("Modo limpio · toca <b>Mostrar barras</b> o presiona <b>Esc</b> para volver")});
    const rs=ov.querySelector('[data-a="rs"]');rs&&(rs.onclick=()=>{delete SAVE.wlw;delete SAVE.mtfh;SAVE.split={c:.5,r:.5};save();applyLayoutPrefs();toast("Tamaños restablecidos")});
    const tb=ov.querySelector('[data-a="tour"]');tb&&(tb.onclick=()=>{ov.remove();showTour(0)});
    const fbb=ov.querySelector('[data-a="fb"]');fbb&&(fbb.onclick=()=>{ov.remove();window.__openFb()});
    const na=ov.querySelector('[data-a="newal"]');na&&(na.onclick=()=>{const t=curSym(active),i=bySym[t]||{},v=last[t];ov.remove();alertDialog({symbol:t,symbol_name:i.display_name||t,kind:"nivel",price:v!=null?+(+v).toFixed(prec(i.pip)):null,price2:null})});
    ov.querySelectorAll('input[data-rk="on"]').forEach(i=>i.onchange=()=>{SAVE.risk=Object.assign(RISK(),{on:i.checked});save();lotRepaint();re()});
    ov.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{SAVE.risk=Object.assign(RISK(),{mode:b.dataset.rm});save();lotRepaint();re()});
    ov.querySelectorAll("[data-rv]").forEach(i=>i.oninput=()=>{const v=parseFloat(String(i.value).replace(",","."));SAVE.risk=Object.assign(RISK(),{[i.dataset.rv]:isFinite(v)&&v>=0?v:0});save();lotRepaint();
      try{TRK.paint()}catch(e){}const u=riskUsd(RISK()),inf=ov.querySelector("[data-rinfo]");if(inf)inf.innerHTML=u>0?`Arriesgas <b>US$ ${u.toFixed(2)}</b> por operación.`:"Escribe tu saldo y tu riesgo."});
    try{sndWire(ov,re)}catch(e){}
    ov.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{try{await API.deleteChartAlert(b.dataset.del)}catch(e){}ALERTS=ALERTS.filter(a=>a.id!==b.dataset.del);paintAlerts();re()});
    ov.querySelectorAll("[data-re]").forEach(b=>b.onclick=async()=>{const a=ALERTS.find(x=>x.id===b.dataset.re);if(!a)return;try{const r=await API.saveChartAlert(Object.assign({id:a.id,symbol:a.symbol,symbol_name:a.symbol_name,kind:a.kind,price:a.price,price2:a.price2,note:a.note,active:true},a.kind==="nivel"||a.kind==="zona"?{}:{tf:a.tf,cond:a.cond,params:a.params,repeat:a.repeat}));Object.assign(a,r||{},{active:true})}catch(e){toast(esc(e.message||"No se pudo reactivar"))}paintAlerts();re()})}
  addEventListener("keydown",e=>{if(e.key==="Escape"){const m=$(".smodal");if(m){m.remove();e.stopImmediatePropagation();return}const pn=document.querySelector(".wmenu.panel");if(pn){pn.remove();e.stopImmediatePropagation()}}},true);

  /* ======================= ALERTAS ======================= */
  /* ---------- sonidos (generados en el navegador, sin archivos) ---------- */
  const SND=(()=>{let ac=null;const ctx=()=>{if(!ac){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;ac=new A()}if(ac.state==="suspended")ac.resume().catch(()=>{});return ac};
    const unlock=()=>{const c=ctx();if(c&&c.state!=="running")c.resume().catch(()=>{})};["pointerdown","keydown","touchstart"].forEach(ev=>addEventListener(ev,unlock,{passive:true,capture:true}));
    const tone=(c,out,f,t0,dur,type,g0,f2)=>{const o=c.createOscillator(),g=c.createGain();o.type=type||"sine";o.frequency.setValueAtTime(f,t0);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t0+dur);
      g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(g0||.6,t0+.012);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g);g.connect(out);o.start(t0);o.stop(t0+dur+.05)};
    const LIB={
      campana:(c,o,t)=>{[[880,1.6,.55],[1760,1,.18],[2640,.6,.08]].forEach(([f,d,g])=>tone(c,o,f,t,d,"sine",g));[[880,1.6,.45],[1760,1,.14]].forEach(([f,d,g])=>tone(c,o,f,t+.45,d,"sine",g))},
      ding:(c,o,t)=>{tone(c,o,988,t,.35,"triangle",.6);tone(c,o,1319,t+.14,.6,"triangle",.6)},
      moneda:(c,o,t)=>{tone(c,o,988,t,.09,"square",.25);tone(c,o,1319,t+.08,.45,"square",.25)},
      alarma:(c,o,t)=>{for(let k=0;k<6;k++)tone(c,o,k%2?660:880,t+k*.16,.15,"square",.28)},
      sirena:(c,o,t)=>{tone(c,o,600,t,.45,"sawtooth",.28,1400);tone(c,o,600,t+.5,.45,"sawtooth",.28,1400)},
      spike:(c,o,t)=>{tone(c,o,140,t,.25,"sine",.9,60);tone(c,o,1568,t+.05,.5,"triangle",.5);tone(c,o,2093,t+.18,.6,"triangle",.45)}};
    const NAMES=[["campana","Campana"],["ding","Ding"],["moneda","Moneda"],["alarma","Alarma"],["sirena","Sirena"],["spike","Golpe + ping"],["no","Sin sonido"]];
    function play(k,vol){if(!k||k==="no"||!LIB[k])return;const c=ctx();if(!c)return;const v=Math.max(0,Math.min(1,(vol==null?80:vol)/100));if(!v)return;
      const g=c.createGain();g.gain.value=v;g.connect(c.destination);try{LIB[k](c,g,c.currentTime+.02)}catch(e){}}
    return{play,NAMES}})();
  const SCFG=()=>{SAVE.snd=Object.assign({al:"campana",vol:80},SAVE.snd||{});SAVE.snd.sp=Object.assign({on:false,syms:[],snd:"spike",min:0},SAVE.snd.sp||{});return SAVE.snd};
  /* avisos con la página de fondo: notificación del sistema (si ya diste permiso) */
  const sysNote=(title,body,tag)=>{try{if(!document.hidden||!("Notification" in window)||Notification.permission!=="granted")return;navigator.serviceWorker&&navigator.serviceWorker.ready.then(r=>r.showNotification(title,{body,tag,icon:"/assets/icon-192.png",badge:"/assets/badge-72.png",renotify:true,data:{url:location.href}})).catch(()=>{})}catch(e){}};
  /* sonido cuando llega una alerta (el service worker avisa a la página abierta) */
  const heard=new Set();
  function alertRing(key,title){if(key&&heard.has(key))return;if(key)heard.add(key);const c=SCFG();SND.play(c.al,c.vol);if(title)toast(esc(title))}
  try{navigator.serviceWorker&&navigator.serviceWorker.addEventListener("message",e=>{const d=e.data||{};if(d.type==="push"&&/^alerta-/.test(d.tag||""))alertRing(d.tag+"|"+Math.floor(Date.now()/20000),d.title)})}catch(e){}
  /* ---------- vigilante de spikes: suena apenas sale un spike (Boom/Crash) en los mercados que elijas ---------- */
  const WATCH=(()=>{const S=new Map();let cool={};
    const bc=t=>{const m=String(t||"").match(/^(BOOM|CRASH)/);return m?m[1]==="BOOM":null};
    const nm=t=>(bySym[t]&&bySym[t].display_name)||t;
    function med(a){if(!a.length)return 0;const b=a.slice().sort((x,y)=>x-y);return b[b.length>>1]}
    function startOne(t){if(S.has(t))return;const up=bc(t);if(up==null)return;const st={d:[],prev:null,ok:false};S.set(t,st);
      feed.ask({ticks_history:t,style:"ticks",count:400,end:"latest"}).then(m=>{const P=(m.history&&m.history.prices)||[];for(let i=1;i<P.length;i++){const d=Math.abs(P[i]-P[i-1]);if(d>0)st.d.push(d)}st.d=st.d.slice(-400);if(P.length)st.prev=+P[P.length-1];st.ok=st.d.length>=30}).catch(()=>{});
      tickOn(t,"watch",tk=>{const q=+tk.quote;if(!isFinite(q))return;const pv=st.prev;st.prev=q;if(pv==null)return;const d=q-pv,ad=Math.abs(d);
        const c=SCFG().sp,thr=Math.max(st.ok?med(st.d)*12:Infinity,+c.min||0),big=(up?d:-d)>thr&&(st.ok||(+c.min>0));
        if(ad>0&&!big){st.d.push(ad);if(st.d.length>400)st.d.shift();if(!st.ok&&st.d.length>=30)st.ok=true}
        if(big&&Date.now()-(cool[t]||0)>3000){cool[t]=Date.now();fire(t,up,ad,tk.epoch)}})}
    function stopOne(t){if(!S.has(t))return;S.delete(t);tickOff(t,"watch")}
    function fire(t,up,sz,ep){const c=SCFG(),pr=bySym[t]?prec(bySym[t].pip):2;const d=new Date((ep||Date.now()/1000)*1000),m5=new Date(Math.floor(d.getTime()/300000)*300000);
      const hh=x=>String(x.getHours()).padStart(2,"0")+":"+String(x.getMinutes()).padStart(2,"0");
      SND.play(c.sp.snd,c.vol);toast(`⚡ <b>Spike en ${esc(nm(t))}</b>: ${up?"+":"−"}${sz.toFixed(pr)} pts · vela M5 de las ${hh(m5)}`);
      sysNote(`⚡ Spike en ${nm(t)}`,`${up?"+":"−"}${sz.toFixed(pr)} pts · vela M5 de las ${hh(m5)}`,"spk-"+t);
      const b=$("#alb");if(b){b.classList.remove("spkfl");void b.offsetWidth;b.classList.add("spkfl")}
      if(c.sp.show!==false)showChart(t)}
    /* te muestra ese gráfico: si ya está en uno de tus gráficos lo enfoca; si no, lo abre en el gráfico activo */
    function showChart(t){try{const n=visible();let j=-1;for(let k=0;k<n;k++)if(curSym(k)===t){j=k;break}
      /* ya lo estás viendo: no te muevo nada (ni el gráfico ni el zoom), solo lo resalto */
      const moved=j<0;if(moved){setSym(t);j=active}
      const P=panes[j];if(!P)return;if(moved)setTimeout(()=>{try{P.kc.chart.scrollToRealTime()}catch(e){}},400);
      P.el.classList.remove("spkfl");void P.el.offsetWidth;P.el.classList.add("spkfl");setTimeout(()=>P.el.classList.remove("spkfl"),2600)}catch(e){}}
    function sync(){const c=SCFG().sp,want=new Set(c.on?c.syms.filter(t=>bc(t)!=null):[]);[...S.keys()].forEach(t=>{if(!want.has(t))stopOne(t)});want.forEach(startOne);
      const b=$("#alb");if(b){b.classList.toggle("watching",want.size>0);b.title=want.size?`Alertas · vigilando spikes en ${[...want].map(nm).join(", ")}`:"Alertas de precio"}}
    return{sync,bc,nm,fire}})();
  setTimeout(()=>{try{WATCH.sync()}catch(e){}},1500);
  function sndBlock(){const c=SCFG(),sp=c.sp,cur=curSym(active),opts=v=>SND.NAMES.map(([k,n])=>`<option value="${k}"${k===v?" selected":""}>${n}</option>`).join("");
    const bcs=Object.keys(bySym).filter(t=>WATCH.bc(t)!=null).sort((a,b)=>bcOrder({symbol:a})-bcOrder({symbol:b}));
    return`<div class="snd">
      <div class="slabel">🔊 Sonidos</div>
      <div class="sndr"><label class="af"><span>Sonido de las alertas</span><select data-snd="al">${opts(c.al)}</select></label><button class="btn sm" data-sndt="al">▶ Probar</button></div>
      <label class="af"><span>Volumen: <b data-volv>${c.vol}%</b></span><input type="range" min="0" max="100" step="5" value="${c.vol}" data-vol></label>
      <p class="shelp">Suena en esta página cuando se dispara una alerta (además de la notificación al celular). En el celular, la notificación usa el sonido del teléfono.</p>
      <div class="slabel">⚡ Vigilante de spikes (en vivo)</div>
      <p class="shelp">Elige en qué mercado estás y te suena <b>apenas sale un spike</b> (la vela de M5 que lo marca), con la página abierta, aunque estés en otra pestaña.</p>
      ${row("Vigilar spikes","Activa el sonido de spikes en los mercados marcados abajo.",tog("data-spon",sp.on))}
      <div class="sndr"><label class="af"><span>Sonido del spike</span><select data-snd="sp">${opts(sp.snd)}</select></label><button class="btn sm" data-sndt="sp">▶ Probar</button></div>
      ${cur&&WATCH.bc(cur)!=null&&!sp.syms.includes(cur)?`<div class="sbtns"><button class="btn sm gold" data-spcur>+ Vigilar ${esc(WATCH.nm(cur))} (el que tienes abierto)</button></div>`:""}
      <div class="spchips">${bcs.map(t=>`<button class="spc${sp.syms.includes(t)?" on":""}" data-spt="${esc(t)}">${esc(WATCH.nm(t).replace(" Index",""))}</button>`).join("")||`<p class="shelp">Cargando mercados…</p>`}</div>
      ${row("Mostrarme el gráfico","Cuando salga el spike en otro mercado, te lo pone en pantalla. Si ya lo estás viendo, no te mueve nada: solo lo resalta.",tog("data-spshow",sp.show!==false))}
      <label class="af"><span>Tamaño mínimo del spike (puntos, opcional)</span><input type="number" min="0" step="any" data-spmin value="${+sp.min>0?sp.min:""}" placeholder="Automático"></label>
    </div>`}
  function sndWire(ov,re){const c=()=>SCFG();
    ov.querySelectorAll("select[data-snd]").forEach(sl=>sl.onchange=()=>{if(sl.dataset.snd==="al")c().al=sl.value;else c().sp.snd=sl.value;save();SND.play(sl.value,c().vol)});
    ov.querySelectorAll("[data-sndt]").forEach(b=>b.onclick=()=>SND.play(b.dataset.sndt==="al"?c().al:c().sp.snd,c().vol));
    const vr=ov.querySelector("[data-vol]");vr&&(vr.oninput=()=>{c().vol=+vr.value;ov.querySelector("[data-volv]").textContent=vr.value+"%";save()},vr.onchange=()=>SND.play(c().al,c().vol));
    const on=ov.querySelector("[data-spon]");on&&(on.onchange=()=>{const sp=c().sp;sp.on=on.checked;if(sp.on&&!sp.syms.length){const cur=curSym(active);if(WATCH.bc(cur)!=null)sp.syms.push(cur)}save();WATCH.sync();
      if(sp.on)toast(sp.syms.length?`⚡ Vigilando spikes en <b>${sp.syms.map(t=>esc(WATCH.nm(t))).join(", ")}</b>`:"Marca abajo los mercados que quieres vigilar");re()});
    const cu=ov.querySelector("[data-spcur]");cu&&(cu.onclick=()=>{const sp=c().sp,t=curSym(active);if(!sp.syms.includes(t))sp.syms.push(t);sp.on=true;save();WATCH.sync();toast(`⚡ Vigilando spikes en <b>${esc(WATCH.nm(t))}</b>`);re()});
    ov.querySelectorAll("[data-spt]").forEach(b=>b.onclick=()=>{const sp=c().sp,t=b.dataset.spt;sp.syms=sp.syms.includes(t)?sp.syms.filter(x=>x!==t):sp.syms.concat(t);if(sp.syms.includes(t))sp.on=true;save();WATCH.sync();re()});
    const sh=ov.querySelector("[data-spshow]");sh&&(sh.onchange=()=>{c().sp.show=sh.checked;save()});
    const mn=ov.querySelector("[data-spmin]");mn&&(mn.onchange=()=>{const v=parseFloat(String(mn.value).replace(",","."));c().sp.min=isFinite(v)&&v>0?v:0;save()})}
  let ALERTS=[];
  function paintAlerts(){const n=ALERTS.filter(a=>a.active).length,b=$("#alc");b.hidden=!n;b.textContent=n;panes.forEach(p=>{try{p.kc.renderAlerts()}catch(e){}})}
  let alSeen=null;
  async function loadAlerts(){try{ALERTS=(await API.chartAlerts())||[]}catch(e){ALERTS=[]}
    const now={};ALERTS.forEach(a=>{if(a.triggered_at)now[a.id]=a.triggered_at});
    if(alSeen){const nw=ALERTS.find(a=>a.triggered_at&&alSeen[a.id]!==a.triggered_at&&Date.now()-new Date(a.triggered_at).getTime()<10*60000);if(nw)alertRing("alerta-"+nw.id+"|"+nw.triggered_at,`🔔 Alerta: ${nw.symbol_name||nw.symbol}`)}
    alSeen=now;paintAlerts()}
  /* temporalidades que acepta el revisor de alertas (las de Deriv) */
  const ATF=[[60,"1m"],[300,"5m"],[900,"15m"],[1800,"30m"],[3600,"1H"],[14400,"4H"],[86400,"1D"]];
  const tfTxt=g=>(ATF.find(x=>x[0]===+g)||[0,(+g/60)+"m"])[1];
  const isBC=t=>/^(BOOM|CRASH)/.test(t||"");
  /* descripción de una alerta (lista y notificaciones) */
  function alertDesc(a,pp){const f=v=>v==null?"—":(+v).toFixed(pp),P=a.params||{};
    if(a.kind==="zona")return`Zona ${f(a.price2)} – ${f(a.price)}`;
    if(a.kind==="cierre")return`Vela de ${tfTxt(a.tf)} cierra ${a.cond==="abajo"?"debajo":"encima"} de ${f(a.price)}`;
    if(a.kind==="rsi")return`RSI(${P.n||14}) en ${tfTxt(a.tf)} ${a.cond==="arriba"?"sube de":"baja de"} ${P.lv||30}`;
    if(a.kind==="cruce")return`EMA ${P.f||9} cruza ${a.cond==="bajista"?"hacia abajo":"hacia arriba"} la EMA ${P.s||21} (${tfTxt(a.tf)})`;
    if(a.kind==="spike")return`Spike${P.min>0?` de ${P.min} pts o más`:""}`;
    return`Nivel ${f(a.price)}`}
  function alertDialog(a){let ov=document.createElement("div");ov.className="smodal";appw.appendChild(ov);ov.onclick=e=>{if(e.target===ov)ov.remove()};
    const pp=bySym[a.symbol]?prec(bySym[a.symbol].pip):3,bc=isBC(a.symbol);
    let pTf=60;try{const pr=panes[active].kc.getPeriod();const g=gran(pr);if(pr.timespan!=="tick"&&ATF.some(x=>x[0]===g))pTf=g}catch(e){}
    let kind=a.kind||"nivel";if(kind==="spike"&&!bc)kind="nivel";
    const TABS=[["precio","Precio"],["cierre","Cierre de vela"],["rsi","RSI"],["cruce","Cruce de medias"]].concat(bc?[["spike","Spike"]]:[]);
    const tabOfK=k=>k==="nivel"||k==="zona"?"precio":k;
    const tfSel=`<label class="af"><span>Temporalidad</span><select data-tf>${ATF.map(([g,t])=>`<option value="${g}"${g===pTf?" selected":""}>${t}</option>`).join("")}</select></label>`;
    function body(t){
      if(t==="precio")return`<div class="seg"><button data-k="nivel" class="${kind!=="zona"?"on":""}">Toca un nivel</button><button data-k="zona" class="${kind==="zona"?"on":""}">Entra a una zona</button></div>
        <label class="af"><span class="lv">${kind==="zona"?"Precio de arriba":"Precio"}</span><input type="number" step="any" data-p1 value="${a.price!=null?a.price:""}"></label>
        <label class="af z"${kind==="zona"?"":" hidden"}><span>Precio de abajo</span><input type="number" step="any" data-p2 value="${a.price2!=null?a.price2:""}"></label>`;
      if(t==="cierre")return`<div class="seg"><button data-c="arriba" class="on">Cierra por encima</button><button data-c="abajo">Cierra por debajo</button></div>
        <label class="af"><span>Precio</span><input type="number" step="any" data-p1 value="${a.price!=null?a.price:""}"></label>${tfSel}
        <p class="shelp">Avisa cuando una vela de esa temporalidad <b>cierre</b> del otro lado del precio (no solo cuando lo toque con la mecha).</p>`;
      if(t==="rsi")return`<div class="seg"><button data-c="abajo" class="on">Baja de</button><button data-c="arriba">Sube de</button></div>
        <div class="af2"><label class="af"><span>Nivel</span><input type="number" step="1" min="1" max="99" data-lv value="30"></label><label class="af"><span>Periodo</span><input type="number" step="1" min="2" max="50" data-n value="14"></label></div>${tfSel}
        <p class="shelp">Ej.: "baja de 30" = sobreventa, "sube de 70" = sobrecompra. Se mira al cierre de cada vela.</p>`;
      if(t==="cruce")return`<div class="seg"><button data-c="alcista" class="on">Cruce alcista</button><button data-c="bajista">Cruce bajista</button></div>
        <div class="af2"><label class="af"><span>Media rápida (EMA)</span><input type="number" step="1" min="2" max="200" data-f value="9"></label><label class="af"><span>Media lenta (EMA)</span><input type="number" step="1" min="3" max="400" data-s value="21"></label></div>${tfSel}
        <p class="shelp">Alcista: la media rápida cruza hacia arriba a la lenta. Bajista: al revés. Se mira al cierre de cada vela.</p>`;
      if(t==="spike")return`<label class="af"><span>Tamaño mínimo del spike (puntos)</span><input type="number" step="any" min="0" data-min placeholder="Automático"></label>
        <p class="shelp">Te avisa cuando ${/^BOOM/.test(a.symbol)?"Boom suba":"Crash baje"} de golpe en una vela de 1 minuto. Vacío = automático (según el movimiento normal del mercado). Es un aviso de que ya pasó, no una predicción.</p>`;
      return""}
    const tab0=tabOfK(kind);
    ov.innerHTML=`<div class="abox" role="dialog"><div class="ah">🔔 Nueva alerta</div><p class="shelp">${esc(a.symbol_name||a.symbol)}</p>
      <div class="atabs">${TABS.map(([k,t])=>`<button data-t="${k}" class="${k===tab0?"on":""}">${t}</button>`).join("")}</div>
      <div data-body>${body(tab0)}</div>
      <label class="af"><span>Nota (opcional)</span><input type="text" maxlength="120" data-n2 placeholder="Ej: zona de compra, esperar spike…"></label>
      <label class="ack"${tab0==="precio"?" hidden":""}><input type="checkbox" data-rep ${tab0==="spike"?"checked":""}> Avisarme cada vez que pase (no solo la primera)</label>
      <p class="shelp">Te llegará una notificación al celular. Se revisa cada minuto, aunque tengas la página cerrada.</p>
      <div class="sbtns"><button class="btn sm" data-a="x">Cancelar</button><button class="btn sm gold" data-a="ok">Crear alerta</button></div></div>`;
    let tab=tab0,cond=null;
    const wire=()=>{const B=ov.querySelector("[data-body]");
      B.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{kind=b.dataset.k;B.querySelectorAll("[data-k]").forEach(x=>x.classList.toggle("on",x===b));B.querySelector(".af.z").hidden=kind!=="zona";B.querySelector(".lv").textContent=kind==="zona"?"Precio de arriba":"Precio"});
      const cs=B.querySelectorAll("[data-c]");cond=cs.length?cs[0].dataset.c:null;cs.forEach(b=>b.onclick=()=>{cond=b.dataset.c;cs.forEach(x=>x.classList.toggle("on",x===b))})};
    wire();
    ov.querySelectorAll(".atabs [data-t]").forEach(b=>b.onclick=()=>{tab=b.dataset.t;if(tab==="precio")kind=kind==="zona"?"zona":"nivel";
      ov.querySelectorAll(".atabs [data-t]").forEach(x=>x.classList.toggle("on",x===b));ov.querySelector("[data-body]").innerHTML=body(tab);wire();
      const rp=ov.querySelector(".ack");rp.hidden=tab==="precio";rp.querySelector("input").checked=tab==="spike"});
    ov.querySelector('[data-a="x"]').onclick=()=>ov.remove();
    const num=s=>{const e=ov.querySelector(s);return e?parseFloat(String(e.value).replace(",",".")):NaN};
    ov.querySelector('[data-a="ok"]').onclick=async e=>{
      const note=ov.querySelector("[data-n2]").value.trim(),rep=!!ov.querySelector("[data-rep]").checked,tfv=+((ov.querySelector("[data-tf]")||{}).value||60);
      let row={symbol:a.symbol,symbol_name:a.symbol_name||a.symbol,note,active:true};
      if(tab==="precio"){const p1=num("[data-p1]"),p2=num("[data-p2]");if(!isFinite(p1)||(kind==="zona"&&!isFinite(p2)))return toast("Escribe el precio");
        Object.assign(row,{kind,price:kind==="zona"?Math.max(p1,p2):p1,price2:kind==="zona"?Math.min(p1,p2):null})}
      else if(tab==="cierre"){const p1=num("[data-p1]");if(!isFinite(p1))return toast("Escribe el precio");Object.assign(row,{kind:"cierre",price:p1,tf:tfv,cond,repeat:rep})}
      else if(tab==="rsi"){const lv=num("[data-lv]"),n=num("[data-n]");if(!(lv>0&&lv<100))return toast("El nivel del RSI va de 1 a 99");Object.assign(row,{kind:"rsi",price:null,tf:tfv,cond,repeat:rep,params:{lv,n:n>=2?Math.round(n):14}})}
      else if(tab==="cruce"){const f=Math.round(num("[data-f]")),sl=Math.round(num("[data-s]"));if(!(f>=2&&sl>f))return toast("La media lenta debe ser mayor que la rápida");Object.assign(row,{kind:"cruce",price:null,tf:tfv,cond,repeat:rep,params:{f,s:sl}})}
      else if(tab==="spike"){const mn=num("[data-min]");Object.assign(row,{kind:"spike",price:null,tf:60,repeat:rep,params:mn>0?{min:mn}:{}})}
      e.target.disabled=true;
      try{const r=await API.saveChartAlert(row);ALERTS.unshift(r||row);paintAlerts();ov.remove();toast("🔔 Alerta creada. Te avisaremos al celular.")}
      catch(err){e.target.disabled=false;toast(esc(/Máximo/.test(err.message)?err.message:/kind_check|column|tf|params/.test(err.message||"")?"Las alertas técnicas aún no están activadas (falta correr charts_alertas_tecnicas.sql).":"No se pudo crear la alerta. Intenta de nuevo."))}};
    setTimeout(()=>{const f=ov.querySelector("[data-p1]");f&&f.focus()},30)}
  loadAlerts();setInterval(()=>{if(!document.hidden)loadAlerts()},60000);
  /* chip de la prueba y opinión */
  function openFeedback(){let ov=document.createElement("div");ov.className="smodal";appw.appendChild(ov);ov.onclick=e=>{if(e.target===ov)ov.remove()};
    ov.innerHTML=`<div class="abox"><div class="ah">💬 Tu opinión sobre EAG Charts</div><p class="shelp">Califica y cuéntanos qué mejorarías. Lo leemos todo.</p>${fbForm()}</div>`;
    wireFb(ov,()=>{ov.remove();toast("¡Gracias! Recibimos tus recomendaciones.")})}
  window.__openFb=openFeedback;
  if(window.__trial){const t=window.__trial,chip=document.createElement("button");chip.className="trialchip";chip.title="Tu prueba gratis · toca para dejar tu opinión";
    const paint=()=>{const ms=new Date(t.ends_at).getTime()-Date.now();if(ms<=0){location.reload();return}const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
      chip.innerHTML=`<i>Prueba gratis</i><b>${d?d+"d "+h+"h":h?h+"h "+m+"m":m+"m"}</b>`};paint();setInterval(paint,60000);
    chip.onclick=openFeedback;const g=$(".top .grow");g&&g.after(chip)}

  /* ======================= TUTORIAL (primera vez) ======================= */
  /* tutorial: uno para computador y otro para celular (gestos táctiles) */
  const isTouchUI=()=>matchMedia("(hover:none)").matches||innerWidth<760;
  const TOUR_PC=[
    ["👋","Bienvenido a EAG Charts","Gráficos en vivo de Deriv con herramientas profesionales, hechos para tu forma de operar. Te mostramos lo principal en 1 minuto.",null],
    ["📑","Tus mercados favoritos","Arriba tienes tus mercados en pestañas, con precio y % del día. Agrégalos con ☆ en la lista o tocando el nombre del mercado en el gráfico. Arrástralos para ordenarlos.",".ftw"],
    ["⏱️","Temporalidades","El botón dorado abre todas las temporalidades; marca con ★ las que más usas para tenerlas a un clic. También puedes escribir 15 y Enter.",".wtf"],
    ["🪟","Varios gráficos y Multi-TF","Elige cuántos gráficos ver a la vez. Cada uno es independiente: su mercado, temporalidad e indicadores. Multi-TF muestra un mercado en todas tus temporalidades: arrastra un mini hacia arriba para verlo en grande. El borde de arriba de los minis cambia su alto.",".lay"],
    ["✏️","Herramientas de dibujo","Un clic usa la herramienta. Doble clic (o mantener presionado) abre la lista del grupo. Con ☆ las mandas a tu barra rápida flotante; la ★ de esta barra la muestra u oculta. El pincel ✏️ te deja escribir a mano.",".dbar"],
    ["🎨","Personaliza cada dibujo","Selecciónalo: arriba sale su barrita con color, grosor, línea, alerta, candado, duplicar, ⚙ configurar y 🗑 borrar (o tecla Supr). Doble clic abre su ventana y clic derecho su menú. Se recuerda tu estilo para los próximos. Si te equivocas dibujando, clic derecho cancela.",null],
    ["🧭","Moverte por el gráfico","Rueda del mouse: zoom. Arrastra para moverte, también hacia arriba y abajo. Los botones ‹ › ⟲ ↻ de abajo mueven, vuelven al precio actual o recargan si algo se traba; el 👁 de la esquina los oculta.",null],
    ["📏","Regla y posiciones","Shift + clic mide puntos, %, velas y tiempo. Posición larga o corta: un clic pone la entrada y salen stop y objetivo 1:2 que puedes arrastrar.",null],
    ["🔔","Alertas al celular","Selecciona una línea o zona y toca 🔔 en su barrita (o clic derecho → Crear alerta). Cuando el precio llegue te avisamos al celular, aunque tengas la página cerrada.","#alb"],
    ["🔴","Modo Clase","Cuando el profe esté en vivo, actívalo aquí y verás en tu gráfico lo mismo que él dibuja. Con Oro y Diamond también ves sus Zonas publicadas.","#clb"],
    ["⚙️","Hazlo tuyo","En Configuración eliges tema (Oscuro, Claro o Arte Gráfico), decimales, tamaño de letra para transmitir, marca de agua y qué barras ver. Todo se guarda en tu cuenta. Atajos: Alt+T línea, Alt+H horizontal, Ctrl+Z deshacer.","#cfgb"],
    ["✅","¡Listo para analizar!","Puedes volver a ver este tutorial en Configuración → Ayuda y atajos. Datos de Deriv solo para análisis educativo; compara siempre con tu plataforma.",null]];
  const TOUR_M=[
    ["👋","Bienvenido a EAG Charts","Gráficos en vivo de Deriv en tu celular. Te mostramos los gestos en 1 minuto.",null],
    ["📑","Tus mercados","Arriba están tus favoritos en pestañas: desliza para ver más. El botón ☰ abre la lista de todos los mercados; marca ☆ para tenerlos arriba. Toca afuera de la lista para cerrarla.",".ftw"],
    ["⏱️","Temporalidad","El botón dorado de arriba en la barra lateral abre todas las temporalidades. Marca con ★ las que más usas.",".dbar .dtf"],
    ["🪟","Multi-TF","Abajo ves el mismo mercado en varias temporalidades: desliza de lado para ver más y toca un mini (o deslízalo hacia arriba) para verlo en grande.",".lay"],
    ["✏️","Herramientas","Un toque usa la herramienta. Doble toque (o mantener oprimido) abre la lista del grupo; con ☆ la mandas a tu barra rápida. La ★ de abajo en esta barra muestra u oculta la barra rápida.",".dbar"],
    ["👆","Dibuja arrastrando","Como en MT5: elige rectángulo, zona, línea o regla, pon el dedo donde empieza, arrastra y suelta. Un toque sin arrastrar la pone de tamaño normal para estirarla después. Mientras dibujas el gráfico no se mueve.",null],
    ["🎨","Editar y borrar","Toca un dibujo (no hace falta atinarle exacto): arriba sale su barrita con 🗑 borrar, ⚙ configurar, color y grosor. Doble toque también abre su configuración. Toca un espacio vacío para soltarlo.",null],
    ["🔒","Bloquear dibujos","Mantén oprimido un dibujo medio segundo: queda 🔒 bloqueado y ya no se selecciona al tocar, ideal cuando tienes muchos. Mantén oprimido otra vez para desbloquearlo.",null],
    ["🧭","Mover el gráfico","Arrastra con un dedo para moverte, también hacia arriba y abajo. Pellizca para acercar. Arrastra la escala de precios para estirarla. Los botones ‹ › ⟲ ↻ mueven, vuelven al precio actual o recargan; el 👁 de la esquina los oculta.",".wnavt"],
    ["🔔","Alertas al celular","Toca una línea o zona y luego 🔔 en su barrita. Cuando el precio llegue te llega una notificación, aunque tengas la app cerrada.","#alb"],
    ["🔴","Modo Clase","Cuando el profe esté en vivo, actívalo aquí y verás en tu gráfico lo mismo que él dibuja.","#clb"],
    ["📲","Instálala como app","Con el botón de descarga de arriba queda en tu pantalla de inicio: pantalla completa, como una app. En iPhone: Safari → Compartir → Agregar a inicio.","#instb"],
    ["✅","¡Listo para analizar!","Puedes volver a ver este tutorial en Configuración → Ayuda y atajos. Datos de Deriv solo para análisis educativo; compara siempre con tu plataforma.",null]];
  let TOUR=TOUR_PC;
  function showTour(i){i=i||0;TOUR=isTouchUI()?TOUR_M:TOUR_PC;let ov=$(".tour");if(!ov){ov=document.createElement("div");ov.className="tour";appw.appendChild(ov)}
    const [ic,t,d,sel]=TOUR[i],el=sel&&$(sel),r=el&&el.offsetParent!==null?el.getBoundingClientRect():null;
    ov.innerHTML=`${r?`<div class="tring" style="left:${r.left-6}px;top:${r.top-6}px;width:${r.width+12}px;height:${r.height+12}px"></div>`:`<div class="tdim"></div>`}
      <div class="tcard" role="dialog" aria-label="Tutorial"><div class="tic">${ic}</div><b>${t}</b><p>${d}</p>
        <div class="tdots">${TOUR.map((x,j)=>`<i class="${j===i?"on":""}"></i>`).join("")}</div>
        <div class="tbtns"><button class="btn sm" data-t="skip">${i<TOUR.length-1?"Saltar":"Cerrar"}</button><span class="grow"></span>${i?`<button class="btn sm" data-t="prev">Atrás</button>`:""}<button class="btn sm gold" data-t="next">${i<TOUR.length-1?"Siguiente":"Empezar"}</button></div></div>`;
    const card=ov.querySelector(".tcard");
    if(r){card.classList.add("anch");const cw=card.offsetWidth,chh=card.offsetHeight;let x,y;
      if(r.height>innerHeight*.45&&r.right+cw+28<innerWidth){x=r.right+16;y=Math.min(innerHeight-chh-12,r.top+30)}
      else if(r.width>innerWidth*.45&&r.height>innerHeight*.3){x=r.left+r.width/2-cw/2;y=r.top+r.height/2-chh/2}
      else{const below=r.bottom+14+chh<innerHeight;y=below?r.bottom+14:Math.max(12,r.top-chh-14);x=r.left+r.width/2-cw/2}
      card.style.left=Math.max(12,Math.min(innerWidth-cw-12,x))+"px";card.style.top=Math.max(12,y)+"px"}
    const end=()=>{ov.remove();if(TOUR===TOUR_M)SAVE.tourDoneM=1;else SAVE.tourDone=2;save()};
    ov.querySelector('[data-t="skip"]').onclick=end;
    ov.querySelector('[data-t="next"]').onclick=()=>i<TOUR.length-1?showTour(i+1):end();
    const pv=ov.querySelector('[data-t="prev"]');pv&&(pv.onclick=()=>showTour(i-1))}
  if(isTouchUI()?!SAVE.tourDoneM:(SAVE.tourDone||0)<2)setTimeout(()=>showTour(0),1200);
  /* sin zoom de página en celular (pellizcar es para el gráfico, no para la página) */
  ["gesturestart","gesturechange"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
  /* evitar selección accidental (doble clic, arrastres) y el menú del navegador, menos en los campos de texto */
  const editable=t=>t&&t.closest&&t.closest("input,textarea,[contenteditable]");
  document.addEventListener("selectstart",e=>{if(!editable(e.target))e.preventDefault()});
  document.addEventListener("dragstart",e=>{if(!editable(e.target))e.preventDefault()});
  document.addEventListener("contextmenu",e=>{if(!editable(e.target))e.preventDefault()});
  /* ---------- barra flotante de dibujos favoritos (se arrastra adonde quieras) ---------- */
  SAVE.toolFav=Array.isArray(SAVE.toolFav)?SAVE.toolFav.flatMap(k=>k==="eagPosition"?["eagLong","eagShort"]:[k]):["segment","horizontalStraightLine","eagZone","fibonacciLine","eagLong","eagShort","eagMeasure"];
  const tfav=document.createElement("div");tfav.className="tfav";appw.appendChild(tfav);
  /* la posición se guarda aparte para celular y para computador (si no, la del PC deja la barra fuera de la pantalla del celular) */
  const tfKey=()=>(innerWidth<760||matchMedia("(hover:none)").matches)?"tfavPosM":"tfavPos";
  const posKey=()=>tfKey()+(SAVE.tfavMin?"Eye":"");
  function placeTfav(){const r=grid.getBoundingClientRect(),w=tfav.offsetWidth||200,h=tfav.offsetHeight||36,sf=safe();
    const P=SAVE[posKey()]||(SAVE.tfavMin?SAVE[tfKey()]:null);let x,y;if(P){x=P.x;y=P.y}else{x=r.left+r.width/2-w/2;y=r.top+(SAVE.hide.pb?36:76)}
    const minY=Math.max(4,sf.t+4);
    tfav.style.left=clamp(x,sf.l+4,Math.max(sf.l+4,innerWidth-w-sf.r-4))+"px";tfav.style.top=clamp(y,minY,Math.max(minY,innerHeight-h-sf.b-4))+"px"}
  addEventListener("resize",()=>requestAnimationFrame(placeTfav));addEventListener("orientationchange",()=>setTimeout(placeTfav,300));
  const EYE='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function renderToolFav(){const T=window.EAGTools;
    /* minimizada: queda solo un ojito que se arrastra adonde quieras; al tocarlo vuelve la barra */
    if(SAVE.tfavMin){tfav.classList.add("mini");tfav.classList.remove("vert");tfav.innerHTML=`<button class="teye" title="Mostrar la barra de dibujos favoritos · arrástralo para moverlo">${EYE}</button>`;
      tfav.style.display=SAVE.toolFav.length&&!SAVE.hide.tf?"":"none";appw.classList.toggle("has-tfav",SAVE.toolFav.length>0);
      const b=tfav.querySelector(".teye");let st=null;
      b.addEventListener("pointerdown",e=>{if(e.button!==0)return;e.preventDefault();const r=tfav.getBoundingClientRect();st={x:e.clientX,y:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,mv:false};try{b.setPointerCapture(e.pointerId)}catch(x){}});
      b.addEventListener("pointermove",e=>{if(!st)return;if(!st.mv&&Math.hypot(e.clientX-st.x,e.clientY-st.y)<5)return;st.mv=true;tfav.classList.add("moving");SAVE[posKey()]={x:Math.round(e.clientX-st.dx),y:Math.round(e.clientY-st.dy)};placeTfav()});
      b.addEventListener("pointerup",()=>{if(!st)return;const mv=st.mv;st=null;tfav.classList.remove("moving");if(mv){save();return}SAVE.tfavMin=false;save();renderToolFav()});
      requestAnimationFrame(placeTfav);return}
    tfav.classList.remove("mini");
    tfav.classList.toggle("vert",!!SAVE.tfavVert);
    tfav.innerHTML=`<span class="tg" title="Arrastra para mover · doble clic: girar">⋮⋮</span>`+SAVE.toolFav.map(k=>`<button data-t="${k}" title="${esc(T.name(k))}">${T.icon(k,18)}</button>`).join("")+
      `<button class="tmin" title="Minimizar en un ojito (lo puedes mover adonde quieras)">${EYE}</button><button class="tx" title="Ocultar barra (vuelve en Vista)">×</button>`;
    tfav.style.display=SAVE.toolFav.length&&!SAVE.hide.tf?"":"none";appw.classList.toggle("has-tfav",SAVE.toolFav.length>0);
    tfav.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{const p=panes[active];if(p&&p.kc.startTool){tfav.querySelectorAll("[data-t]").forEach(x=>x.classList.toggle("on",x===b));p.kc.startTool(b.dataset.t);setTimeout(()=>b.classList.remove("on"),4000)}});
    tfav.querySelector(".tmin").onclick=()=>{const r=tfav.getBoundingClientRect();if(!SAVE[tfKey()+"Eye"])SAVE[tfKey()+"Eye"]={x:Math.round(r.left),y:Math.round(r.top)};SAVE.tfavMin=true;save();renderToolFav()};
    tfav.querySelector(".tx").onclick=()=>{SAVE.hide.tf=true;save();applyHide();panes.forEach(p=>{try{p.kc.refreshBar()}catch(e){}});toast("Barra rápida oculta. Vuelve a mostrarla con la ★ de la barra de dibujo.")};
    const g=tfav.querySelector(".tg");
    g.addEventListener("pointerdown",e=>{if(e.button!==0)return;e.preventDefault();const r=tfav.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;try{g.setPointerCapture(e.pointerId)}catch(x){}tfav.classList.add("moving");
      const mv=ev=>{SAVE[tfKey()]={x:Math.round(ev.clientX-dx),y:Math.round(ev.clientY-dy)};placeTfav()};
      const up=()=>{g.removeEventListener("pointermove",mv);g.removeEventListener("pointerup",up);tfav.classList.remove("moving");save()};
      g.addEventListener("pointermove",mv);g.addEventListener("pointerup",up)});
    g.ondblclick=()=>{SAVE.tfavVert=!SAVE.tfavVert;save();renderToolFav()};
    requestAnimationFrame(placeTfav)}
  addEventListener("resize",()=>placeTfav());
  sortable(tfav,"[data-t]",SAVE.tfavVert?"y":"x",ord=>{SAVE.toolFav=ord;save();renderToolFav()});
  window.__tfavR=()=>{appw.classList.toggle("has-tfav",SAVE.toolFav.length>0);tfav.style.display=SAVE.toolFav.length&&!SAVE.hide.tf?"":"none";requestAnimationFrame(placeTfav)};
  applyHide();applyCfg();applyLayoutPrefs();setLayout(lay);renderToolFav();setTab(tab);renderTabs();
  ready.then(()=>{setTab(tab);renderTabs();panes.forEach(p=>{try{const t=p.kc.getSymbol().ticker;if(bySym[t]&&info(bySym[t]).pricePrecision!==p.kc.getSymbol().pricePrecision)p.kc.setSymbol(info(bySym[t]))}catch(e){}})});
  addEventListener("resize",()=>{if(DEV==="cel"&&!["l1","l2v","mtf"].includes(lay))setLayout("l1")});
}
})();
