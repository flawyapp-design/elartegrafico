/* EAG Charts · Operar con cTrader (Deriv cTrader) por lotes — solo administradores.
   - Autorizas en la pantalla oficial de cTrader (OAuth). El canje del código y la clave secreta de la app viven en /api/ctrader
     (servidor), que además comprueba que seas admin.
   - Conexión: WebSocket JSON de cTrader Open API (demo.ctraderapi.com:5036 / live.ctraderapi.com:5036).
   - Órdenes a mercado por LOTES, cerrar, y SL/TP en precio (también arrastrando las líneas en el gráfico). */
(function(){
"use strict";
const CLIENT_ID=(window.AG_CONFIG||{}).CTRADER_CLIENT_ID||"";
const BRIDGE="/api/ctrader";
const LS_TOK="eag_ct_tok",LS_ACC="eag_ct_acc",SS_FLAG="eag_ct_pending";
const OK_HOSTS=["charts.elartegrafico.com","elartegrafico.com","www.elartegrafico.com"];
const PT={HEARTBEAT:51,APP_AUTH:2100,ACC_AUTH:2102,NEW_ORDER:2106,AMEND_SLTP:2110,CLOSE:2111,SYMBOLS:2114,SYMBOL_BY_ID:2116,
  TRADER:2121,TRADER_UPD:2123,RECONCILE:2124,EXEC:2126,SPOTS:2127,ORDER_ERR:2132,ERROR:2142,TOKEN_INVALID:2147,DISCONNECT:2148,ACCOUNTS:2149,UPNL:2187};
const ls={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const norm=s=>String(s||"").toLowerCase().replace(/index|indice|índice/g,"").replace(/[^a-z0-9]/g,"");

let S=null;   /* utilidades compartidas del panel (eag-trade.js) */
let ws=null,host="",msgN=1,pending={},hbT=null,pnlT=null,retryT=null,app=null;
let accounts=[],acc=null,authed=false,bal=null,mDigits=2,cur="USD",lastErr="",state="";
let symList=[],symByName={},symInfo={},positions={},pnl={},busy=false,confirmAsk=null;
const ui={lot:null,slPts:"",tpPts:""};

const redirectUri=()=>location.origin+"/charts";
const tok=()=>ls.get(LS_TOK,null);
const toast=t=>S&&S.toast(t);
const money=(v)=>S?S.money(v,cur):String(v);
async function sbToken(){try{return window.AGAPI&&AGAPI.accessToken?await AGAPI.accessToken():null}catch(e){return null}}
async function bridge(body){const sb=await sbToken();if(!sb)throw new Error("Inicia sesión como admin en la web.");
  const r=await fetch(BRIDGE,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.assign({sb},body))});
  let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j.error||("Error "+r.status));return j}

/* ---------- autorización ---------- */
function login(){if(!OK_HOSTS.includes(location.hostname)||!CLIENT_ID){toast("Conectar cTrader funciona en charts.elartegrafico.com");return}
  try{sessionStorage.setItem(SS_FLAG,String(Date.now()))}catch(e){}
  const u=new URL("https://id.ctrader.com/my/settings/openapi/grantingaccess/");
  u.search=new URLSearchParams({client_id:CLIENT_ID,redirect_uri:redirectUri(),scope:"trading",product:"web"}).toString();location.href=u.toString()}
async function handleCallback(){let flag=null;try{flag=sessionStorage.getItem(SS_FLAG)}catch(e){}
  const q=new URLSearchParams(location.search);const code=q.get("code"),err=q.get("error");
  if(!flag||(!code&&!err))return false;
  try{sessionStorage.removeItem(SS_FLAG)}catch(e){}
  try{history.replaceState(null,"",location.pathname+location.hash)}catch(e){}
  if(err){lastErr="cTrader canceló la autorización ("+err+").";return true}
  try{const j=await bridge({action:"token",code,redirect_uri:redirectUri()});saveTok(j);lastErr="";toast("cTrader conectado");connect()}
  catch(e){lastErr=e.message}
  return true}
function saveTok(j){ls.set(LS_TOK,{a:j.accessToken,r:j.refreshToken,exp:j.expiresIn?Date.now()+j.expiresIn*1000:0})}
async function freshTok(){const t=tok();if(!t)return null;if(t.exp&&Date.now()>t.exp-3600e3&&t.r){try{const j=await bridge({action:"refresh",refresh_token:t.r});saveTok(j);return j.accessToken}catch(e){lastErr=e.message;return t.a}}return t.a}
function logout(){closeWs();ls.del(LS_TOK);ls.del(LS_ACC);accounts=[];acc=null;authed=false;positions={};pnl={};bal=null;S&&S.syncLinesSoon();rerender()}

/* ---------- WebSocket JSON ---------- */
function closeWs(){clearInterval(hbT);clearInterval(pnlT);clearTimeout(retryT);if(ws){ws.onclose=null;try{ws.close()}catch(e){}}ws=null;authed=false;
  Object.values(pending).forEach(p=>p.rej(new Error("Conexión cerrada")));pending={}}
function open(h){return new Promise((res,rej)=>{closeWs();host=h;const s=new WebSocket(`wss://${h}:5036`);ws=s;
  s.onopen=()=>{hbT=setInterval(()=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({payloadType:PT.HEARTBEAT,payload:{}}))},10000);res()};
  s.onerror=()=>rej(new Error("No se pudo conectar con cTrader"));
  s.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}onMsg(m)};
  s.onclose=()=>{ws=null;authed=false;clearInterval(hbT);clearInterval(pnlT);if(tok()&&acc){state="Reconectando…";rerender();retryT=setTimeout(connect,3000)}}})}
function req(type,payload){return new Promise((res,rej)=>{if(!ws||ws.readyState!==1)return rej(new Error("Sin conexión con cTrader"));const id="m"+(msgN++);
  pending[id]={res,rej,type};ws.send(JSON.stringify({clientMsgId:id,payloadType:type,payload:payload||{}}));
  setTimeout(()=>{if(pending[id]){delete pending[id];rej(new Error("cTrader no respondió a tiempo"))}},20000)})}
const errText=p=>(p&&(p.description||p.errorCode))||"Error de cTrader";
function onMsg(m){const p=m.payload||{},t=m.payloadType;
  if(m.clientMsgId&&pending[m.clientMsgId]){const q=pending[m.clientMsgId];
    if(t===PT.ERROR||t===PT.ORDER_ERR){delete pending[m.clientMsgId];q.rej(new Error(errText(p)))}
    else if(!(q.type===PT.NEW_ORDER||q.type===PT.CLOSE||q.type===PT.AMEND_SLTP)||t===PT.EXEC){delete pending[m.clientMsgId];q.res(p)}}
  if(t===PT.EXEC)onExec(p);
  else if(t===PT.ORDER_ERR&&!m.clientMsgId)toast(errText(p));
  else if(t===PT.TRADER_UPD&&p.trader){setTrader(p.trader)}
  else if(t===PT.TOKEN_INVALID){toast("cTrader pidió volver a autorizar");logout()}
  else if(t===PT.DISCONNECT){state="cTrader cerró la conexión";rerender()}}
function setTrader(tr){mDigits=tr.moneyDigits!=null?+tr.moneyDigits:mDigits;bal=+tr.balance/Math.pow(10,mDigits);paintBal()}

async function connect(){const at=await freshTok();if(!at){rerender();return}
  state="Conectando con cTrader…";lastErr="";rerender();
  try{
    if(!app)app=await bridge({action:"app"});
    const want=ls.get(LS_ACC,null);const h0=want&&want.live?"live.ctraderapi.com":"demo.ctraderapi.com";
    await open(h0);await req(PT.APP_AUTH,{clientId:app.clientId,clientSecret:app.clientSecret});
    const r=await req(PT.ACCOUNTS,{accessToken:at});
    accounts=(r.ctidTraderAccount||[]).map(a=>({id:+a.ctidTraderAccountId,live:!!a.isLive,login:a.traderLogin||a.ctidTraderAccountId,broker:a.brokerTitleShort||a.brokerName||""}));
    if(!accounts.length)throw new Error("Tu cTrader ID no tiene cuentas autorizadas para esta app.");
    acc=accounts.find(a=>want&&a.id===want.id)||accounts.find(a=>!a.live)||accounts[0];ls.set(LS_ACC,{id:acc.id,live:acc.live});
    const h=acc.live?"live.ctraderapi.com":"demo.ctraderapi.com";
    if(h!==host){await open(h);await req(PT.APP_AUTH,{clientId:app.clientId,clientSecret:app.clientSecret})}
    await req(PT.ACC_AUTH,{ctidTraderAccountId:acc.id,accessToken:at});authed=true;
    const tr=await req(PT.TRADER,{ctidTraderAccountId:acc.id});if(tr.trader)setTrader(tr.trader);
    const sl=await req(PT.SYMBOLS,{ctidTraderAccountId:acc.id});symList=sl.symbol||[];symByName={};symList.forEach(x=>{symByName[norm(x.symbolName)]=x});
    const rc=await req(PT.RECONCILE,{ctidTraderAccountId:acc.id});positions={};(rc.position||[]).forEach(setPos);
    await ensureSym(S.symNow());await loadSymInfos(Object.values(positions).map(x=>x.tradeData.symbolId));
    pnlT=setInterval(pollPnl,1000);state="";rerender();S&&S.syncLinesSoon()}
  catch(e){lastErr=e.message;state="";rerender()}}

/* ---------- símbolos ---------- */
function chartSymName(){try{const o=S.O.cur()||{};return o.name||o.sym||""}catch(e){return""}}
function ctSymFor(ticker,name){return symByName[norm(name)]||symByName[norm(ticker)]||null}
function tickerFor(symbolId){const L=symList.find(x=>+x.symbolId===+symbolId);if(!L)return"";const n=norm(L.symbolName);
  try{const all=(S.O.syms&&S.O.syms())||[];const hit=all.find(s=>norm(s.name||s.shortName)===n||norm(s.ticker)===n);if(hit)return hit.ticker}catch(e){}return L.symbolName}
async function loadSymInfos(ids){ids=[...new Set(ids.map(Number))].filter(id=>id&&!symInfo[id]);if(!ids.length||!authed)return;
  try{const r=await req(PT.SYMBOL_BY_ID,{ctidTraderAccountId:acc.id,symbolId:ids});(r.symbol||[]).forEach(x=>{symInfo[+x.symbolId]=x})}catch(e){}}
async function ensureSym(ticker){const s=ctSymFor(ticker,chartSymName());if(s)await loadSymInfos([s.symbolId]);return s}
const lotsOfVol=(vol,symId)=>{const i=symInfo[+symId];const ls_=i&&+i.lotSize;return ls_?vol/ls_:vol/100};
function volFor(lots,info){const L=+info.lotSize||100,st=+info.stepVolume||1,mn=+info.minVolume||st,mx=+info.maxVolume||1e15;
  let v=Math.round(lots*L/st)*st;return Math.max(mn,Math.min(mx,v))}

/* ---------- posiciones ---------- */
function setPos(p){if(!p||!p.positionId)return;const id=String(p.positionId);
  if(+p.positionStatus===2){delete positions[id];delete pnl[id];return}
  positions[id]=Object.assign(positions[id]||{},p)}
function onExec(p){const pos=p.position;if(pos){const id=String(pos.positionId);const was=!!positions[id];setPos(pos);
    if(+pos.positionStatus===2&&was){const d=p.deal&&p.deal.closePositionDetail;const md=d&&d.moneyDigits!=null?+d.moneyDigits:mDigits;
      if(d&&d.grossProfit!=null){const g=(+d.grossProfit+(+d.swap||0)+(+d.commission||0))/Math.pow(10,md);toast(`${g>=0?"Ganaste":"Perdiste"} ${money(Math.abs(g))}`);if(d.balance!=null){bal=+d.balance/Math.pow(10,md);paintBal()}}
      else toast("Posición cerrada")}
    else if(!was&&+pos.positionStatus===1)toast("Orden ejecutada");
    loadSymInfos([pos.tradeData&&pos.tradeData.symbolId]).then(()=>{paintPos();S.syncLinesSoon()})}
  paintPos();S&&S.syncLinesSoon()}
async function pollPnl(){if(!authed||!Object.keys(positions).length||document.hidden)return;
  try{const r=await req(PT.UPNL,{ctidTraderAccountId:acc.id});const md=r.moneyDigits!=null?+r.moneyDigits:mDigits;
    (r.positionUnrealizedPnL||[]).forEach(x=>{pnl[String(x.positionId)]=+x.netUnrealizedPnL/Math.pow(10,md)});paintPos();S.syncLinesSoon()}catch(e){}}
const isUpPos=p=>+p.tradeData.tradeSide===1;
function norPos(){return Object.values(positions).filter(p=>p.tradeData&&p.price!=null).map(p=>{const id=String(p.positionId),info=symInfo[+p.tradeData.symbolId]||{},dec=+info.digits||2;
  const lots=lotsOfVol(+p.tradeData.volume,p.tradeData.symbolId),pr=pnl[id]!=null?pnl[id]:0,up=isUpPos(p);
  return{key:"ct:"+id,id,sym:tickerFor(p.tradeData.symbolId),up,entry:+p.price,tp:p.takeProfit!=null&&+p.takeProfit>0?+p.takeProfit:null,sl:p.stopLoss!=null&&+p.stopLoss>0?+p.stopLoss:null,
    tpTxt:"TP "+(p.takeProfit?(+p.takeProfit).toFixed(dec):""),slTxt:"SL "+(p.stopLoss?(+p.stopLoss).toFixed(dec):""),pnl:pr,lots,dec,t:+p.tradeData.openTimestamp||Date.now(),raw:p,
    label:`${up?"▲ Compra":"▼ Venta"} ${S.fmtLot(lots)} lotes · ${pr>=0?"+":""}${money(pr)}`}})}
function amend(p,sl,tp){const pl={ctidTraderAccountId:acc.id,positionId:+p.id};if(sl!=null)pl.stopLoss=+(+sl).toFixed(p.dec);if(tp!=null)pl.takeProfit=+(+tp).toFixed(p.dec);
  const P=positions[p.id];if(P){P.stopLoss=sl;P.takeProfit=tp}S.syncLinesSoon();paintPos();
  return req(PT.AMEND_SLTP,pl).then(()=>toast(`SL ${sl!=null?(+sl).toFixed(p.dec):"—"} · TP ${tp!=null?(+tp).toFixed(p.dec):"—"}`)).catch(e=>{toast(e.message);reconcile()})}
async function reconcile(){try{const rc=await req(PT.RECONCILE,{ctidTraderAccountId:acc.id});positions={};(rc.position||[]).forEach(setPos);paintPos();S.syncLinesSoon()}catch(e){}}
const BROKER={positions:()=>authed?norPos():[],
  preview:(p,kind,P)=>{const units=+p.raw.tradeData.volume/100;const g=(p.up?1:-1)*(P-p.entry)*units;return`${kind.toUpperCase()} ${P.toFixed(p.dec)} · ≈${g>=0?"+":"-"}${money(Math.abs(g))}`},
  setLevel:(p,kind,P,from)=>{let sl=p.sl,tp=p.tp;if(kind==="tp")tp=P;else sl=P;if(from&&from!=="e"&&from!==kind){if(from==="tp")tp=null;else sl=null}amend(p,sl,tp)}};

/* ---------- operar ---------- */
async function order(side,ok){if(busy||!authed)return;const ticker=S.symNow();const s=await ensureSym(ticker);
  if(!s){toast("Este mercado no está en tu cuenta cTrader");return}const info=symInfo[+s.symbolId];if(!info){toast("Cargando el mercado… intenta de nuevo");return}
  const lots=+(ui.lot!=null?ui.lot:S.cfg.lot)||0;if(!(lots>0)){toast("Escribe el lote");return}
  if(acc.live&&S.cfg.confirmReal&&!S.cfg.oneClick&&!ok){confirmAsk=side;rerender();return}
  confirmAsk=null;busy=true;rerender();
  const pl={ctidTraderAccountId:acc.id,symbolId:+s.symbolId,orderType:1,tradeSide:side==="buy"?1:2,volume:volFor(lots,info),label:"EAG Charts"};
  const k=Math.pow(10,5);if(+ui.slPts>0)pl.relativeStopLoss=Math.round(+ui.slPts*k);if(+ui.tpPts>0)pl.relativeTakeProfit=Math.round(+ui.tpPts*k);
  try{await req(PT.NEW_ORDER,pl)}catch(e){toast(e.message)}busy=false;rerender()}
function closePos(id){const P=positions[id];if(!P)return;P._closing=true;paintPos();
  req(PT.CLOSE,{ctidTraderAccountId:acc.id,positionId:+id,volume:+P.tradeData.volume}).catch(e=>{P._closing=false;toast(e.message);paintPos()})}

/* ---------- panel (pestaña cTrader) ---------- */
let host_=null;
const esc=s=>S.esc(s);
function rerender(){if(S&&S.isOpen()&&S.cfg.broker==="ct")S.render()}
function paintBal(){if(!host_)return;const b=host_.querySelector("[data-cbal]");if(b)b.textContent=S.cfg.hide?"••••••":(bal==null?"—":money(bal))}
function paintPos(){if(!host_||!host_.isConnected)return;const box=host_.querySelector(".trd-pos");if(!box)return;const L=norPos().sort((a,b)=>b.t-a.t);
  const tot=L.reduce((s,p)=>s+(+p.pnl||0),0);
  box.innerHTML=L.length?`<div class="trd-ph"><b>Abiertas (${L.length})</b><span class="${tot>=0?"t-up":"t-dn"}">${tot>=0?"+":""}${money(tot)}</span>${L.length>1?`<button class="trd-x" data-ccloseall>Cerrar todas</button>`:""}</div>`+
    L.map(p=>`<div class="trd-row"><span class="trd-d ${p.up?"t-up":"t-dn"}">${p.up?"▲":"▼"}</span><span class="trd-s"><b>${esc(p.sym)}</b><small>${S.fmtLot(p.lots)} lotes · ${p.entry.toFixed(p.dec)}${p.sl?` · SL ${p.sl.toFixed(p.dec)}`:""}${p.tp?` · TP ${p.tp.toFixed(p.dec)}`:""}</small></span>
      <span class="trd-p ${p.pnl>=0?"t-up":"t-dn"}">${p.pnl>=0?"+":""}${money(p.pnl)}</span><button class="trd-x" data-cclose="${esc(p.id)}" ${p.raw._closing?"disabled":""}>${p.raw._closing?"…":"Cerrar"}</button></div>`).join("")
    :`<div class="trd-empty">Sin posiciones abiertas</div>`;
  box.querySelectorAll("[data-cclose]").forEach(b=>b.onclick=()=>closePos(b.dataset.cclose));
  const ca=box.querySelector("[data-ccloseall]");ca&&(ca.onclick=()=>Object.keys(positions).forEach(closePos))}
function render(el){host_=el;const cfg=S.cfg;
  if(!CLIENT_ID){el.innerHTML=`<div class="trd-err">Falta el Client ID de cTrader en la configuración.</div>`;return}
  if(!tok()){el.innerHTML=`<p class="trd-help">Conecta tu cuenta <b>Deriv cTrader</b> para operar por <b>lotes</b>, igual que en MT5. Autorizas en la página oficial de cTrader; aquí nunca se escribe tu contraseña.</p>
    ${lastErr?`<div class="trd-err">${esc(lastErr)}</div>`:""}<button class="trd-go" data-clogin>Conectar cTrader</button>
    <p class="trd-fine">Prueba primero con la cuenta <b>demo</b>. Operar tiene riesgo: puedes perder lo que inviertes.</p>`;
    el.querySelector("[data-clogin]").onclick=login;return}
  const ticker=S.symNow(),s=ctSymFor(ticker,chartSymName()),info=s&&symInfo[+s.symbolId];
  if(s&&!info&&authed)loadSymInfos([s.symbolId]).then(()=>rerender());
  const lot=ui.lot!=null?ui.lot:cfg.lot;const real=acc&&acc.live;
  const minLot=info?(+info.minVolume||0)/(+info.lotSize||100):null;
  el.innerHTML=`
    <div class="trd-acc ${real?"real":"demo"}">${accounts.length?`<select data-cacc>${accounts.map(a=>`<option value="${a.id}"${acc&&a.id===acc.id?" selected":""}>${a.live?"Real":"Demo"} · ${esc(a.login)}</option>`).join("")}</select>`:`<span class="trd-state">${esc(state||"…")}</span>`}
      <span class="trd-bal"><small>Saldo</small><b data-cbal>${cfg.hide?"••••••":(bal==null?"—":money(bal))}</b></span></div>
    ${real?`<div class="trd-warn">Cuenta REAL: es dinero de verdad.</div>`:""}
    ${state&&accounts.length?`<div class="trd-state">${esc(state)}</div>`:""}${lastErr?`<div class="trd-err">${esc(lastErr)}</div>`:""}
    <div class="trd-sym"><b>${esc(ticker||"—")}</b><button class="trd-1c${cfg.oneClick?" on":""}" data-coneclick title="Un clic: la orden sale al instante, sin confirmación. Atajos: Shift+B compra · Shift+S vende">⚡ Un clic ${cfg.oneClick?"ON":"OFF"}</button></div>
    ${authed&&!s?`<div class="trd-err">${esc(ticker)} no está en tu cuenta cTrader.</div>`:""}
    <label class="trd-f"><span>Lote${minLot?` <small>(mínimo ${S.fmtLot(minLot)})</small>`:""}</span><input data-clot type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(lot)}"></label>
    <div class="trd-chips">${[0.2,0.5,1,2,5].map(v=>`<button data-clt="${v}" class="${+lot===v?"on":""}">${v}</button>`).join("")}</div>
    <div class="trd-two"><label class="trd-f"><span>Stop loss <small>(puntos, opcional)</small></span><input data-csl type="number" min="0" step="0.1" inputmode="decimal" value="${esc(ui.slPts)}" placeholder="—"></label>
      <label class="trd-f"><span>Take profit <small>(puntos, opcional)</small></span><input data-ctp type="number" min="0" step="0.1" inputmode="decimal" value="${esc(ui.tpPts)}" placeholder="—"></label></div>
    <p class="trd-fine">También puedes poner o mover el SL/TP arrastrando la línea de la operación en el gráfico.</p>
    ${confirmAsk?`<div class="trd-conf"><p>¿Abrir <b>${confirmAsk==="buy"?"▲ Compra":"▼ Venta"}</b> de <b>${esc(S.fmtLot(lot))} lotes</b> en cuenta REAL?</p><div><button class="trd-x" data-ccno>Cancelar</button><button class="trd-go t-${confirmAsk==="buy"?"up":"dn"}" data-ccyes>Sí, abrir</button></div></div>`:
    `<div class="trd-bt"><button class="trd-buy t-up" data-cbuy ${busy||!authed||!s?"disabled":""}>▲ Comprar ${esc(S.fmtLot(lot))}</button><button class="trd-buy t-dn" data-csell ${busy||!authed||!s?"disabled":""}>▼ Vender ${esc(S.fmtLot(lot))}</button></div>`}
    <div class="trd-pos"></div>
    <div class="trd-ft">${real?`<label class="trd-ck"><input type="checkbox" data-cconfirm ${cfg.confirmReal?"checked":""}> Confirmar cada operación en real</label>`:""}<button class="trd-lnk" data-clogout>Desconectar cTrader</button></div>`;
  const q=x=>el.querySelector(x),qa=x=>el.querySelectorAll(x);
  const ac=q("[data-cacc]");ac&&(ac.onchange=()=>{const a=accounts.find(x=>String(x.id)===ac.value);if(!a)return;acc=a;ls.set(LS_ACC,{id:a.id,live:a.live});positions={};pnl={};confirmAsk=null;S.syncLinesSoon();connect()});
  const li=q("[data-clot]");li.oninput=()=>{ui.lot=li.value;cfg.lot=+li.value||cfg.lot;S.saveCfg();qa("[data-clt]").forEach(b=>b.classList.toggle("on",+b.dataset.clt===+li.value));
    const l=S.fmtLot(+li.value||0),bu=q("[data-cbuy]"),se=q("[data-csell]");bu&&(bu.textContent="▲ Comprar "+l);se&&(se.textContent="▼ Vender "+l)};
  qa("[data-clt]").forEach(b=>b.onclick=()=>{ui.lot=+b.dataset.clt;cfg.lot=ui.lot;S.saveCfg();rerender()});
  q("[data-csl]").oninput=e=>{ui.slPts=e.target.value};q("[data-ctp]").oninput=e=>{ui.tpPts=e.target.value};
  const bu=q("[data-cbuy]");bu&&(bu.onclick=()=>order("buy"));const se=q("[data-csell]");se&&(se.onclick=()=>order("sell"));
  const cy=q("[data-ccyes]");cy&&(cy.onclick=()=>{const d=confirmAsk;confirmAsk=null;order(d,true)});const cn=q("[data-ccno]");cn&&(cn.onclick=()=>{confirmAsk=null;rerender()});
  const oc=q("[data-coneclick]");oc.onclick=()=>{cfg.oneClick=!cfg.oneClick;S.saveCfg();confirmAsk=null;rerender();toast(cfg.oneClick?"Un clic activado":"Un clic desactivado")};
  const cc=q("[data-cconfirm]");cc&&(cc.onchange=()=>{cfg.confirmReal=cc.checked;S.saveCfg()});
  q("[data-clogout]").onclick=logout;paintPos()}

/* atajos de un clic (pestaña cTrader abierta) */
addEventListener("keydown",e=>{if(!S||!S.isOpen()||S.cfg.broker!=="ct"||!S.cfg.oneClick||!e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&t.closest&&t.closest("input,textarea,select,[contenteditable]"))return;
  const k=e.key.toLowerCase();if(k==="b"){e.preventDefault();order("buy",true)}else if(k==="s"){e.preventDefault();order("sell",true)}},true);

window.EAGCT={init(shared){S=shared;S.addBroker("ct",BROKER)},handleCallback,render,
  autoConnect(){if(tok()&&ls.get(LS_ACC,null))connect()},
  onOpen(){if(tok()&&!ws)connect()},
  onChange(){if(authed)ensureSym(S.symNow()).then(()=>rerender())},
  _test:{positions:()=>positions,norPos,volFor,state:()=>({authed,acc,bal,host})}};
})();
