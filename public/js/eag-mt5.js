/* EAG Charts · Operar en MetaTrader 5 con el EA "EAG Bridge" — solo administradores (en prueba).
   - El EA corre en tu MT5 y cada segundo manda a Supabase la cuenta, posiciones, órdenes y cotizaciones,
     y recoge las órdenes que mandes desde aquí (mt5_ea_sync). Este panel lee con mt5_panel_poll y ordena con mt5_panel_command.
   - Una orden que MT5 no recoge en 15 s se descarta: nunca se ejecuta una entrada vieja.
   - Mercado y pendientes (límite/stop según el precio), SL/TP en puntos o precio, break even, cierre parcial y total.
   - Las posiciones y órdenes salen como líneas en el gráfico; arrastra para poner o mover el SL/TP. */
(function(){
"use strict";
const LS_ACC="eag_mt5_acc",LS_MAP="eag_mt5_map",LS_UI="eag_mt5_ui";
const ls={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const FINAL={done:1,error:1,expired:1,unknown:1};

let S=null,host=null,pollT=null,st=null,accs=[],tokInfo=null,newTok="",lastErr="",busy=false,confirmAsk=null,polling=false,openedOnce=false;
let account=ls.get(LS_ACC,null);
const cmds={},waiters={},watched={},map=ls.get(LS_MAP,{});
const ui=Object.assign({type:"market",unit:"pts",lot:null,sl:"",tp:"",price:""},ls.get(LS_UI,{}),{sl:"",tp:"",price:""});
const saveUi=()=>ls.set(LS_UI,{type:ui.type,unit:ui.unit,lot:ui.lot});
const API=()=>window.AGAPI;
const esc=s=>S?S.esc(s):String(s);
const cur=()=>(st&&st.account&&st.account.currency)||"USD";
const money=v=>S?S.money(v,cur()):String(v);
const toast=t=>S&&S.toast(t);
const online=()=>!!(st&&st.online);

/* ---------- símbolos: el nombre del gráfico (ej. "Boom 1000 Index") es el mismo de MT5 en Deriv; se puede cambiar a mano ---------- */
function chartName(){try{const o=S.O.cur()||{};return o.name||o.sym||""}catch(e){return""}}
const mtSym=()=>{const t=S.symNow();return map[t]||chartName()||t};
const symInfo=n=>st&&(st.symbols||[]).find(x=>x.symbol===n||norm(x.symbol)===norm(n))||null;
/* posición de MT5 → ticker del gráfico (para dibujar sus líneas) */
function tickerOf(mt){const t=S.symNow();if(mtSym()===mt||norm(mtSym())===norm(mt))return t;
  for(const k in map)if(map[k]===mt)return k;
  try{const L=S.O.syms()||[];const f=L.find(x=>norm(x.name||x.display_name||x.shortName)===norm(mt)||norm(x.ticker||x.symbol)===norm(mt));if(f)return f.ticker||f.symbol}catch(e){}
  return mt}
const decOf=n=>{const i=symInfo(n);return i&&i.digits!=null?+i.digits:2};
const fmtP=(v,n)=>(+v).toFixed(decOf(n));
/* dinero por mover el precio: (Δprecio / tick_size) × tick_value × lotes */
function pnlFor(sym,diff,vol){const i=symInfo(sym);if(!i||!(+i.tick_size>0))return null;return diff/(+i.tick_size)*(+i.tick_value)*vol}

/* ---------- red ---------- */
async function poll(){if(polling)return;polling=true;
  try{const r=await API().mt5Poll(account);accs=r.accounts||[];tokInfo=r.token||null;
    if(r.state&&(!account||String(r.state.login)===String(account)))st=r.state;else if(!r.state)st=null;
    if(!account&&st){account=String(st.login)}
    (r.commands||[]).forEach(c=>{const prev=cmds[c.id];cmds[c.id]=c;if(FINAL[c.status]&&(!prev||!FINAL[prev.status])&&waiters[c.id]){const w=waiters[c.id];delete waiters[c.id];w(c)}});
    lastErr="";ensureWatch()}
  catch(e){lastErr=e.message||"Sin conexión"}
  finally{polling=false;paint();S.syncLinesSoon()}}
function schedule(){clearTimeout(pollT);const fast=S&&S.isOpen()&&S.cfg.broker==="mt5";
  pollT=setTimeout(async()=>{await poll();schedule()},fast?1000:(st&&((st.positions||[]).length||(st.orders||[]).length)?2500:8000))}
async function send(action,params,quiet){
  let r;try{r=await API().mt5Cmd(Object.assign({action,account},params||{}))}catch(e){toast(e.message);return{ok:false,msg:e.message}}
  if(!r||!r.ok){toast((r&&r.error)||"No se pudo enviar");return{ok:false,msg:r&&r.error}}
  const c=r.command;cmds[c.id]=c;paintLog();clearTimeout(pollT);setTimeout(()=>{poll().then(schedule)},300);
  const fin=await new Promise(res=>{waiters[c.id]=res;setTimeout(()=>{if(waiters[c.id]){delete waiters[c.id];res(Object.assign({},cmds[c.id]||c,{status:"unknown"}))}},20000)});
  const msg=(fin.result&&fin.result.msg)||({done:"Listo",expired:"Expiró: MT5 no la recogió",unknown:"Sin confirmación de MT5"})[fin.status]||fin.status;
  if(!quiet)toast((fin.status==="done"?"MT5: ":"MT5 ✗ ")+msg);paintLog();return{ok:fin.status==="done",msg}}
function ensureWatch(){if(!online()||!S)return;const n=mtSym();if(!n||symInfo(n)||watched[n])return;watched[n]=1;send("watch",{symbol:n},true).then(r=>{if(!r.ok)watched[n]="x";paintQuote()})}

/* ---------- órdenes ---------- */
function lotVal(){const i=symInfo(mtSym());let v=+(ui.lot!=null?ui.lot:S.cfg.lot)||0;if(i&&+i.vol_step>0)v=Math.round(v/(+i.vol_step))*(+i.vol_step);return Math.round(v*1e6)/1e6}
function levels(side,entry){const n=mtSym(),toP=(v,k)=>{if(!(+v>0))return undefined;if(ui.unit==="price")return+v;
    const sgn=(side==="buy")===(k==="tp")?1:-1;return+(entry+sgn*(+v)).toFixed(decOf(n))};
  return{sl:toP(ui.sl,"sl"),tp:toP(ui.tp,"tp")}}
async function order(side,ok){const n=mtSym(),i=symInfo(n),vol=lotVal();
  if(!online()){toast("MT5 no está conectado");return}if(!(vol>0)){toast("Pon un lote válido");return}
  const real=st.account&&st.account.trade_mode==="real";
  if(real&&S.cfg.confirmReal&&!ok&&!S.cfg.oneClick){confirmAsk=side;rerender();return}
  const px=i?(side==="buy"?+i.ask:+i.bid):0;let r;busy=true;rerender();
  try{if(ui.type==="market"){const L=levels(side,px||0);if(ui.unit==="pts"&&!(px>0)&&(L.sl||L.tp)){toast("Esperando cotización de MT5 para calcular SL/TP");return}
      r=await send("open_market",{symbol:n,side,volume:vol,sl:L.sl,tp:L.tp,comment:"EAG Charts"})}
    else{const P=+ui.price;if(!(P>0)){toast("Pon el precio de la orden pendiente");return}
      const ref=side==="buy"?+(i&&i.ask||P):+(i&&i.bid||P);const ot=side==="buy"?(P<ref?"buy_limit":"buy_stop"):(P>ref?"sell_limit":"sell_stop");
      const L=levels(side,P);r=await send("open_pending",{symbol:n,order_type:ot,volume:vol,price:P,sl:L.sl,tp:L.tp,comment:"EAG Charts"})}}
  finally{busy=false;rerender()}}
const closePos=(t,vol)=>send("close_position",{ticket:String(t),volume:vol});
const be=p=>send("modify_position",{ticket:String(p.ticket),sl:+p.open_price});

/* ---------- líneas en el gráfico (usa el motor de eag-trade.js) ---------- */
const BROKER={positions(){if(!st)return[];const out=[];
    (st.positions||[]).forEach(p=>{const up=p.type==="buy",pr=+p.profit+(+p.swap||0);
      out.push({key:"mt5:p"+p.ticket,sym:tickerOf(p.symbol),up,entry:+p.open_price,tp:+p.tp>0?+p.tp:null,sl:+p.sl>0?+p.sl:null,
        tpTxt:+p.tp>0?`TP ${moneyAt(p,+p.tp)}`:"",slTxt:+p.sl>0?`SL ${moneyAt(p,+p.sl)}`:"",pnl:pr,dec:+p.digits||decOf(p.symbol),t:(+p.time||0)*1000,
        label:`MT5 ${up?"▲ Compra":"▼ Venta"} ${S.fmtLot(p.volume)} · ${pr>=0?"+":""}${money(pr)}`,mt:p,kind:"p"})});
    (st.orders||[]).forEach(o=>{const up=o.type.startsWith("buy");
      out.push({key:"mt5:o"+o.ticket,sym:tickerOf(o.symbol),up,entry:+o.price,tp:+o.tp>0?+o.tp:null,sl:+o.sl>0?+o.sl:null,tpTxt:+o.tp>0?"TP":"",slTxt:+o.sl>0?"SL":"",
        pnl:0,dec:+o.digits||decOf(o.symbol),t:(+o.time||0)*1000,label:`MT5 ${ORDN[o.type]||o.type} ${S.fmtLot(o.volume)}`,mt:o,kind:"o"})});
    return out},
  preview:(p,kind,P)=>`${kind.toUpperCase()} ${p.kind==="p"?moneyAt(p.mt,P):(+P).toFixed(p.dec)}`,
  setLevel:(p,kind,P,from)=>{const v=P==null?0:+(+P).toFixed(p.dec);const o={ticket:String(p.mt.ticket)};o[kind]=v;
    if(from&&from!=="e"&&from!==kind)o[from]=0;
    if(p.kind==="p"){p.mt[kind]=v;send("modify_position",o)}else{p.mt[kind]=v;send("modify_order",o)}S.syncLinesSoon()}};
const ORDN={buy_limit:"Buy Limit",sell_limit:"Sell Limit",buy_stop:"Buy Stop",sell_stop:"Sell Stop",buy_stop_limit:"Buy Stop Limit",sell_stop_limit:"Sell Stop Limit"};
function moneyAt(p,P){const d=(P-(+p.open_price))*(p.type==="buy"?1:-1);const m=pnlFor(p.symbol,d,+p.volume);return m==null?(+P).toFixed(+p.digits||2):(m>=0?"+":"")+money(m)}

/* ---------- panel ---------- */
const rerender=()=>{if(host&&host.isConnected)render(host)};
let shownSetup=null;
function paint(){if(!host||!host.isConnected)return;const setup=!tokInfo||!tokInfo.has;if(!host.querySelector("[data-mbody]")||setup!==shownSetup){rerender();return}
  paintAcc();paintQuote();paintPos();paintLog();host.querySelectorAll("[data-mbuy],[data-msell]").forEach(b=>b.disabled=busy||!online())}
function paintAcc(){const el=host.querySelector("[data-macc]");if(!el)return;const a=st&&st.account||{},hide=S.cfg.hide,m=v=>hide?"••••":money(v);
  const real=a.trade_mode==="real";el.className="mt5-acc "+(real?"real":"demo");
  el.innerHTML=`<div class="mt5-ah"><span class="mt5-dot ${online()?"on":""}"></span><b>${online()?"Conectado":"Sin conexión"}</b>
      ${accs.length>1?`<select data-mpick>${accs.map(x=>`<option value="${esc(x.login)}"${String(x.login)===String(account)?" selected":""}>${esc(x.login)} · ${esc(x.trade_mode||"")}</option>`).join("")}</select>`:`<span class="mt5-lg">${esc(a.login||"")} · ${esc(a.trade_mode==="real"?"Real":a.trade_mode==="demo"?"Demo":(a.trade_mode||""))}</span>`}</div>
    <div class="mt5-grid"><span><small>Balance</small><b>${m(a.balance)}</b></span><span><small>Equidad</small><b>${m(a.equity)}</b></span>
      <span><small>Flotante</small><b class="${+a.profit>=0?"t-up":"t-dn"}">${hide?"••••":(+a.profit>=0?"+":"")+money(a.profit)}</b></span>
      <span><small>Margen libre</small><b>${m(a.free_margin)}</b></span><span><small>Nivel margen</small><b>${+a.margin>0?Math.round(+a.margin_level)+"%":"—"}</b></span>
      <span><small>Hoy</small><b class="${st&&st.today&&+st.today.pnl>=0?"t-up":"t-dn"}">${st&&st.today?(hide?"••••":(+st.today.pnl>=0?"+":"")+money(st.today.pnl))+` <i>(${st.today.trades})</i>`:"—"}</b></span></div>
    ${real?`<div class="trd-warn">Cuenta REAL de MT5: es dinero de verdad.</div>`:""}
    ${st&&a.algo_trading===false?`<div class="trd-err">En MT5 está apagado <b>Algo Trading</b>: el EA no puede operar.</div>`:""}
    ${st&&!online()?`<div class="trd-err">El EA no está enviando datos. Revisa que MT5 esté abierto con el EA en un gráfico.</div>`:""}`;
  const pk=el.querySelector("[data-mpick]");pk&&(pk.onchange=()=>{account=pk.value;ls.set(LS_ACC,account);st=null;poll()})}
function paintQuote(){const el=host&&host.querySelector("[data-mq]");if(!el)return;const n=mtSym(),i=symInfo(n);
  el.innerHTML=i?`<span class="t-dn">${fmtP(i.bid,n)}</span><span class="mt5-sp">${Math.round((+i.ask-+i.bid)/(+i.point||1))} pts</span><span class="t-up">${fmtP(i.ask,n)}</span>`
    :watched[n]==="x"?`<span class="trd-bad">“${esc(n)}” no existe en tu MT5. Escribe el nombre exacto abajo.</span>`:`<span class="mt5-mut">${online()?"Pidiendo cotización a MT5…":"—"}</span>`;
  paintRisk()}
function paintRisk(){const el=host&&host.querySelector("[data-mrisk]");if(!el)return;const n=mtSym(),i=symInfo(n),vol=lotVal();
  if(!i||!(vol>0)){el.textContent="";return}
  const ref=ui.type==="market"?(+i.ask+ +i.bid)/2:+ui.price;if(!(ref>0)){el.textContent="";return}
  const L=levels("buy",ref),dist=k=>L[k]?Math.abs(L[k]-ref):null,out=[];
  ["sl","tp"].forEach(k=>{const d=dist(k);if(d){const m=pnlFor(n,d,vol);if(m!=null)out.push(`${k==="sl"?"Riesgo":"Objetivo"} ${money(m)}`)}});
  if(out.length===2){const a=dist("sl"),b=dist("tp");out.push(`R:R 1:${(b/a).toFixed(2)}`)}
  el.textContent=out.join(" · ")}
function paintPos(){const box=host&&host.querySelector("[data-mpos]");if(!box)return;const P=(st&&st.positions)||[],O=(st&&st.orders)||[];
  const tot=P.reduce((s,p)=>s+(+p.profit)+(+p.swap||0),0);
  box.innerHTML=(P.length?`<div class="trd-ph"><b>Posiciones (${P.length})</b><span class="${tot>=0?"t-up":"t-dn"}">${tot>=0?"+":""}${money(tot)}</span></div>`+
    P.map(p=>{const pr=+p.profit+(+p.swap||0),up=p.type==="buy";return`<div class="trd-row mt5-row"><span class="trd-d ${up?"t-up":"t-dn"}">${up?"▲":"▼"}</span>
      <span class="trd-s"><b>${esc(p.symbol)}</b><small>${S.fmtLot(p.volume)} · ${esc(p.open_price)}${+p.sl>0?" · SL "+esc(p.sl):""}${+p.tp>0?" · TP "+esc(p.tp):""}</small></span>
      <span class="trd-p ${pr>=0?"t-up":"t-dn"}">${pr>=0?"+":""}${money(pr)}</span>
      <span class="mt5-acts"><button class="trd-x" data-mbe="${esc(p.ticket)}" title="Break even: SL a la entrada">BE</button><button class="trd-x" data-mhalf="${esc(p.ticket)}" title="Cerrar la mitad">½</button><button class="trd-x" data-mclose="${esc(p.ticket)}">Cerrar</button></span></div>`}).join("")+
    (P.length>1?`<div class="mt5-all"><button class="trd-x" data-mall="profit">Cerrar ganadoras</button><button class="trd-x" data-mall="loss">Cerrar perdedoras</button><button class="trd-x" data-mall="all">Cerrar todas</button></div>`:"")
    :`<div class="trd-empty">Sin posiciones abiertas</div>`)+
    (O.length?`<div class="trd-ph"><b>Órdenes pendientes (${O.length})</b>${O.length>1?`<button class="trd-x" data-mcanall>Cancelar todas</button>`:""}</div>`+
    O.map(o=>`<div class="trd-row mt5-row"><span class="trd-d ${o.type.startsWith("buy")?"t-up":"t-dn"}">${o.type.startsWith("buy")?"▲":"▼"}</span>
      <span class="trd-s"><b>${esc(ORDN[o.type]||o.type)} · ${esc(o.symbol)}</b><small>${S.fmtLot(o.volume)} @ ${esc(o.price)}${+o.sl>0?" · SL "+esc(o.sl):""}${+o.tp>0?" · TP "+esc(o.tp):""}</small></span>
      <span class="mt5-acts"><button class="trd-x" data-mcan="${esc(o.ticket)}">Cancelar</button></span></div>`).join(""):"");
  const q=s=>box.querySelectorAll(s);
  q("[data-mclose]").forEach(b=>b.onclick=()=>{b.disabled=true;b.textContent="…";closePos(b.dataset.mclose)});
  q("[data-mhalf]").forEach(b=>b.onclick=()=>{const p=P.find(x=>String(x.ticket)===b.dataset.mhalf);const i=symInfo(p.symbol),stp=i&&+i.vol_step>0?+i.vol_step:0.01;
    const v=Math.max(stp,Math.round(+p.volume/2/stp)*stp);b.disabled=true;closePos(p.ticket,+v.toFixed(6))});
  q("[data-mbe]").forEach(b=>b.onclick=()=>{const p=P.find(x=>String(x.ticket)===b.dataset.mbe);b.disabled=true;be(p)});
  q("[data-mall]").forEach(b=>b.onclick=()=>send("close_all",{filter:b.dataset.mall}));
  q("[data-mcan]").forEach(b=>b.onclick=()=>{b.disabled=true;send("cancel_order",{ticket:b.dataset.mcan})});
  q("[data-mcanall]").forEach(b=>b.onclick=()=>send("cancel_all",{}))}
const STN={queued:"en cola",sent:"enviada",done:"ok",error:"error",expired:"expiró",unknown:"sin confirmar"};
const ACTN={open_market:"Mercado",open_pending:"Pendiente",modify_position:"SL/TP",close_position:"Cerrar",modify_order:"Modificar orden",cancel_order:"Cancelar orden",close_all:"Cerrar todas",cancel_all:"Cancelar órdenes",watch:"Cotización"};
function paintLog(){const el=host&&host.querySelector("[data-mlog]");if(!el)return;
  const L=Object.values(cmds).filter(c=>c.action!=="watch").sort((a,b)=>b.createdAt-a.createdAt).slice(0,6);
  el.innerHTML=L.length?L.map(c=>`<div class="mt5-lg-r st-${esc(c.status)}"><span>${esc(ACTN[c.action]||c.action)}${c.params&&c.params.otype?" "+esc(c.params.otype):""}${c.params&&c.params.volume?" "+esc(c.params.volume):""}</span><b>${esc(STN[c.status]||c.status)}</b>${c.result&&c.result.msg&&c.status!=="done"?`<small>${esc(c.result.msg)}</small>`:""}</div>`).join(""):`<div class="mt5-mut">Aún no hay órdenes.</div>`}

function render(el){host=el;const cfg=S.cfg;
  if(!tokInfo&&!openedOnce){openedOnce=true;el.innerHTML=`<div class="trd-state">Conectando con MT5…</div>`;poll().then(schedule);return}
  const n=mtSym(),i=symInfo(n),lot=ui.lot!=null?ui.lot:cfg.lot;
  const setup=!tokInfo||!tokInfo.has;shownSetup=setup;
  el.innerHTML=`${lastErr?`<div class="trd-err">${esc(lastErr)}</div>`:""}
    ${setup?`<p class="trd-help">Conecta tu <b>MetaTrader 5</b> con el EA <b>EAG Bridge</b>: genera el token, pégalo en el EA y listo.</p>`:`<div data-macc></div>`}
    <div data-mbody>
    ${setup?"":`<div class="trd-sym"><b>${esc(n||"—")}</b><span class="mt5-q" data-mq></span></div>
    <div class="trd-mode"><button data-mtype="market" class="${ui.type==="market"?"on":""}">Mercado</button><button data-mtype="pending" class="${ui.type==="pending"?"on":""}">Pendiente</button></div>
    ${ui.type==="pending"?`<label class="trd-f"><span>Precio <small>(límite o stop según dónde quede respecto al precio)</small></span><input data-mprice type="number" step="any" inputmode="decimal" value="${esc(ui.price)}" placeholder="${i?fmtP((+i.bid+ +i.ask)/2,n):"—"}"></label>`:""}
    <label class="trd-f"><span>Lote${i?` <small>(mín. ${esc(i.vol_min)} · paso ${esc(i.vol_step)})</small>`:""}</span><input data-mlot type="number" min="0" step="0.01" inputmode="decimal" value="${esc(lot)}"></label>
    <div class="trd-chips">${[0.2,0.5,1,2,5].map(v=>`<button data-mlt="${v}" class="${+lot===v?"on":""}">${v}</button>`).join("")}</div>
    <div class="trd-mode mt5-unit"><button data-munit="pts" class="${ui.unit==="pts"?"on":""}">SL/TP en puntos</button><button data-munit="price" class="${ui.unit==="price"?"on":""}">en precio</button></div>
    <div class="trd-two"><label class="trd-f"><span>Stop loss <small>(opcional)</small></span><input data-msl type="number" min="0" step="any" inputmode="decimal" value="${esc(ui.sl)}" placeholder="—"></label>
      <label class="trd-f"><span>Take profit <small>(opcional)</small></span><input data-mtp type="number" min="0" step="any" inputmode="decimal" value="${esc(ui.tp)}" placeholder="—"></label></div>
    <div class="mt5-risk" data-mrisk></div>
    ${confirmAsk?`<div class="trd-conf"><p>¿${ui.type==="market"?"Abrir":"Poner"} <b>${confirmAsk==="buy"?"▲ Compra":"▼ Venta"}</b> de <b>${esc(S.fmtLot(lotVal()))} lotes</b> en ${esc(n)} en cuenta REAL?</p><div><button class="trd-x" data-mno>Cancelar</button><button class="trd-go t-${confirmAsk==="buy"?"up":"dn"}" data-myes>Sí</button></div></div>`:
    `<div class="trd-bt"><button class="trd-buy t-up" data-mbuy ${busy||!online()?"disabled":""}>▲ ${ui.type==="market"?"Comprar":"Buy"} ${esc(S.fmtLot(lotVal()))}</button><button class="trd-buy t-dn" data-msell ${busy||!online()?"disabled":""}>▼ ${ui.type==="market"?"Vender":"Sell"} ${esc(S.fmtLot(lotVal()))}</button></div>`}
    <p class="trd-fine">Arrastra la línea de la operación en el gráfico para poner o mover el SL/TP.</p>
    <div class="trd-pos" data-mpos></div>
    <details class="trd-adv"><summary>Últimas órdenes</summary><div data-mlog></div></details>`}
    <details class="trd-adv"${setup?" open":""}><summary>Conexión con MT5</summary>
      ${newTok?`<div class="mt5-tok"><p>Copia este token y pégalo en el EA (campo <b>InpEAToken</b>). <b>Solo se muestra esta vez.</b></p><code data-mtok>${esc(newTok)}</code><button class="trd-x" data-mcopy>Copiar</button></div>`:""}
      <p class="trd-fine">${tokInfo&&tokInfo.has?`Hay un token activo${tokInfo.at?" desde "+esc(new Date(tokInfo.at).toLocaleString("es-CO")):""}. Si generas otro, el anterior deja de servir.`:"Todavía no hay token."}</p>
      <button class="trd-go" data-mgen>${tokInfo&&tokInfo.has?"Generar token nuevo":"Generar token"}</button>
      ${setup?"":`<label class="trd-f"><span>Nombre del símbolo en MT5 <small>(si tu broker lo llama distinto)</small></span><input data-mmap value="${esc(map[S.symNow()]||"")}" placeholder="${esc(chartName()||S.symNow())}"></label>`}
    </details></div>
    <div class="trd-ft">${!setup&&st&&st.account&&st.account.trade_mode==="real"?`<label class="trd-ck"><input type="checkbox" data-mconfirm ${cfg.confirmReal?"checked":""}> Confirmar cada operación en real</label>`:""}</div>`;
  const q=x=>el.querySelector(x),qa=x=>el.querySelectorAll(x);
  qa("[data-mtype]").forEach(b=>b.onclick=()=>{ui.type=b.dataset.mtype;saveUi();confirmAsk=null;rerender()});
  qa("[data-munit]").forEach(b=>b.onclick=()=>{ui.unit=b.dataset.munit;ui.sl=ui.tp="";saveUi();rerender()});
  const li=q("[data-mlot]");li&&(li.oninput=()=>{ui.lot=li.value;saveUi();qa("[data-mlt]").forEach(b=>b.classList.toggle("on",+b.dataset.mlt===+li.value));
    const l=S.fmtLot(lotVal()),bu=q("[data-mbuy]"),se=q("[data-msell]");bu&&(bu.textContent=`▲ ${ui.type==="market"?"Comprar":"Buy"} ${l}`);se&&(se.textContent=`▼ ${ui.type==="market"?"Vender":"Sell"} ${l}`);paintRisk()});
  qa("[data-mlt]").forEach(b=>b.onclick=()=>{ui.lot=+b.dataset.mlt;saveUi();rerender()});
  const sl=q("[data-msl]");sl&&(sl.oninput=()=>{ui.sl=sl.value;paintRisk()});const tp=q("[data-mtp]");tp&&(tp.oninput=()=>{ui.tp=tp.value;paintRisk()});
  const pr=q("[data-mprice]");pr&&(pr.oninput=()=>{ui.price=pr.value;paintRisk()});
  const bu=q("[data-mbuy]");bu&&(bu.onclick=()=>order("buy"));const se=q("[data-msell]");se&&(se.onclick=()=>order("sell"));
  const y=q("[data-myes]");y&&(y.onclick=()=>{const d=confirmAsk;confirmAsk=null;order(d,true)});const no=q("[data-mno]");no&&(no.onclick=()=>{confirmAsk=null;rerender()});
  const cc=q("[data-mconfirm]");cc&&(cc.onchange=()=>{cfg.confirmReal=cc.checked;S.saveCfg()});
  const mm=q("[data-mmap]");mm&&(mm.onchange=()=>{const v=mm.value.trim();if(v)map[S.symNow()]=v;else delete map[S.symNow()];ls.set(LS_MAP,map);delete watched[mtSym()];ensureWatch();rerender();S.syncLinesSoon()});
  const g=q("[data-mgen]");g&&(g.onclick=async()=>{if(tokInfo&&tokInfo.has&&!confirm("El token actual dejará de funcionar. ¿Generar uno nuevo?"))return;
    try{newTok=await API().mt5NewToken();tokInfo={has:true,at:new Date().toISOString()};rerender()}catch(e){toast(e.message)}});
  const cp=q("[data-mcopy]");cp&&(cp.onclick=()=>{try{navigator.clipboard.writeText(newTok);toast("Token copiado")}catch(e){const c=q("[data-mtok]");const r=document.createRange();r.selectNodeContents(c);getSelection().removeAllRanges();getSelection().addRange(r)}});
  if(host.querySelector("[data-mbody]"))setTimeout(paint,0)}

window.EAGMT5B={
  init(shared){S=shared;S.addBroker("mt5",BROKER)},
  render,
  onOpen(){poll().then(schedule)},
  onChange(){confirmAsk=null;ensureWatch();if(S.isOpen()&&S.cfg.broker==="mt5")rerender()},
  autoConnect(){if(ls.get(LS_ACC,null))poll().then(schedule)},
  _test:{state:()=>st,cmds:()=>cmds,poll}};
})();
