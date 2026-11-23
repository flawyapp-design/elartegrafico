/* EAG Charts · Operar con Deriv (multiplicadores, para todos; cTrader solo para el admin)
   - Inicia sesión con Deriv (OAuth con PKCE). El código se canjea en /api/deriv (servidor), como pide Deriv.
   - El token queda solo en este navegador (localStorage) hasta que vence o tocas "Desconectar".
   - Opera multiplicadores (Sube = MULTUP / Baja = MULTDOWN) con monto, multiplicador, take profit y stop loss.
   - Muestra el saldo (se puede ocultar para los lives), las posiciones abiertas con ganancia en vivo y la entrada en el gráfico. */
(function(){
"use strict";
const APP_ID=(window.AG_CONFIG||{}).DERIV_OAUTH_APP_ID||"";
const BRIDGE="/api/deriv";
const REG_URL="https://t.deriv.link?t=ZX9736UCRTEQ"; /* link de socio de El Arte Gráfico */
const LS_TOK="eag_dv_tok",LS_ACC="eag_dv_acc",LS_CFG="eag_dv_cfg",SS_PKCE="eag_dv_pkce";
const OK_HOSTS=["charts.elartegrafico.com","elartegrafico.com","www.elartegrafico.com"];
const ls={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const money=(v,cur)=>{const n=+v;if(!isFinite(n))return"—";return(n<0?"-":"")+(cur==="USD"||!cur?"$":"")+Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+(cur&&cur!=="USD"?" "+cur:"")};
const b64u=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const rnd=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return b64u(a)};

let O=null;            /* opciones que pasa charts-app */
let panel=null,ws=null,wsTimer=null,pingT=null,reqN=1,pending={},accounts=[],acc=null,bal=null,cur="USD";
let contracts={},cfInfo={},busy=false,confirmAsk=null,lastErr="";
const HAD_CFG=ls.get(LS_CFG,null)!=null;
const cfg=Object.assign({autoMult:true,broker:"dv",mode:"lote",lot:0.2,stake:1,mult:0,tp:"",sl:"",hide:false,confirmReal:true,oneClick:false},ls.get(LS_CFG,{}));
/* Lotes como en MT5: en Boom/Crash 1 lote = 1 USD por punto. Deriv solo deja operar multiplicadores por API,
   así que el lote se convierte en una operación con multiplicador que gana o pierde lo MISMO por punto:
   ganancia ≈ monto × multiplicador × (movimiento / precio de entrada)  →  monto = lote × precio ÷ multiplicador */
const lastPrice=()=>{try{const L=O.chart().getDataList();return L.length?+L[L.length-1].close:0}catch(e){return 0}};
const multsOf=sym=>{const ci=cfInfo[sym]||{};return ci.range&&ci.range.length?ci.range:[10,20,50,100,200]};
/* Para parecerse a MT5: en lotes, el multiplicador se elige solo = el MÁS BAJO que alcance con tu saldo.
   Así el margen es lo más grande posible y la operación aguanta más puntos en contra antes del cierre automático de Deriv
   (en MT5 lo que te sostiene es el saldo de la cuenta; aquí es el margen). La ganancia por punto no cambia. */
const stakeAt=(lot,m)=>{const px=lastPrice();if(!(px>0)||!(m>0)||!(lot>0))return 0;return Math.ceil(lot*px/m*100)/100};
const autoPick=(sym,skip)=>{const ms=multsOf(sym).filter(m=>!(skip&&skip.includes(m))),b=+bal;if(!ms.length)return multsOf(sym)[0];
  if(!(b>0))return ms[ms.length-1];for(const m of ms){if(stakeAt(+cfg.lot,m)<=b)return m}return ms[ms.length-1]};
const multNow=(sym,skip)=>{if(cfg.mode==="lote"&&cfg.autoMult)return autoPick(sym,skip);const m=multsOf(sym);return m.includes(+cfg.mult)?+cfg.mult:m[0]};
const stakeFor=(lot,sym,m)=>stakeAt(lot,m||multNow(sym));
const lotsOf=c=>{const e=+c.entry_spot,b=+c.buy_price,m=+c.multiplier;return e>0&&m>0?b*m/e:0};
const fmtLot=v=>(Math.round((+v||0)*100)/100).toFixed(2);   /* como MT5: 0.20, 1.00 */
const saveCfg=()=>ls.set(LS_CFG,cfg);

/* ---------- token ---------- */
const tok=()=>{const t=ls.get(LS_TOK,null);if(!t||!t.t)return null;if(t.exp&&Date.now()>t.exp-60000){ls.del(LS_TOK);return null}return t.t};
const redirectUri=()=>location.origin+"/charts";
const canLogin=()=>OK_HOSTS.includes(location.hostname)&&!!APP_ID;
async function bridge(body){
  const r=await fetch(BRIDGE,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  let j={};try{j=await r.json()}catch(e){}
  if(r.status===401){ls.del(LS_TOK);throw new Error("Tu sesión de Deriv venció. Vuelve a conectar.")}
  if(!r.ok)throw new Error((j&&(j.error&&(j.error.message||j.error))||j.message)||("Error "+r.status));
  return j}
async function login(){
  if(!canLogin()){toast("Conectar con Deriv funciona en charts.elartegrafico.com");return}
  const v=rnd(64),st=rnd(24);
  const ch=b64u(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
  try{sessionStorage.setItem(SS_PKCE,JSON.stringify({v,st,t:Date.now()}))}catch(e){}
  const u=new URL("https://auth.deriv.com/oauth2/auth");
  u.search=new URLSearchParams({response_type:"code",client_id:APP_ID,redirect_uri:redirectUri(),scope:"trade",state:st,code_challenge:ch,code_challenge_method:"S256"}).toString();
  location.href=u.toString()}
/* regreso desde Deriv: ?code=...&state=... */
async function handleCallback(){
  const q=new URLSearchParams(location.search);const code=q.get("code"),st=q.get("state"),err=q.get("error");
  if(!code&&!err)return false;
  const clean=()=>{try{history.replaceState(null,"",location.pathname+location.hash)}catch(e){}};
  let pk=null;try{pk=JSON.parse(sessionStorage.getItem(SS_PKCE)||"null")}catch(e){}
  if(err){clean();lastErr=err==="invalid_scope"?"Deriv no aceptó el permiso \"Operar\". En developers.deriv.com → Aplicaciones, edita EAG Charts y marca \"Operar\".":"Deriv canceló el inicio de sesión ("+err+").";return true}
  if(!pk||pk.st!==st){clean();lastErr="El inicio de sesión no coincide (por seguridad se canceló). Intenta de nuevo.";return true}
  try{sessionStorage.removeItem(SS_PKCE)}catch(e){}
  clean();
  try{const j=await bridge({action:"token",code,code_verifier:pk.v,redirect_uri:redirectUri()});
    ls.set(LS_TOK,{t:j.access_token,exp:j.expires_in?Date.now()+j.expires_in*1000:0});lastErr="";toast("Conectado con Deriv")}
  catch(e){lastErr=e.message}
  return true}
function logout(){closeWs();ls.del(LS_TOK);ls.del(LS_ACC);accounts=[];acc=null;bal=null;contracts={};clearLines();render()}

/* ---------- cuentas ---------- */
function parseAccounts(j){
  let a=Array.isArray(j)?j:Array.isArray(j&&j.data)?j.data:(j&&j.data&&(j.data.accounts||j.data.items))||(j&&j.accounts)||[];
  return a.map(x=>{const id=x.account_id||x.accountId||x.loginid||x.id;const t=String(x.account_type||x.type||(x.is_virtual?"demo":"")||"").toLowerCase();
    const demo=t.includes("demo")||t.includes("virtual")||/^VR/i.test(String(id));
    return{id:String(id),demo,cur:x.currency||"USD",bal:x.balance!=null?+x.balance:null}}).filter(x=>x.id&&x.id!=="undefined")}
async function loadAccounts(){
  const t=tok();if(!t)return;
  try{accounts=parseAccounts(await bridge({action:"accounts",token:t}))}catch(e){lastErr=e.message;render();return}
  const keep=ls.get(LS_ACC,null);acc=accounts.find(a=>a.id===keep)||accounts.find(a=>a.demo)||accounts[0]||null;
  if(!acc){lastErr="Tu cuenta de Deriv no tiene cuentas de opciones. Crea una (demo o real) en Deriv y vuelve a conectar.";render();return}
  ls.set(LS_ACC,acc.id);if(acc.bal!=null)bal=acc.bal;cur=acc.cur||"USD";connect()}

/* ---------- websocket autenticado ---------- */
function closeWs(){clearTimeout(wsTimer);clearInterval(pingT);if(ws){ws.onclose=null;try{ws.close()}catch(e){}}ws=null;Object.values(pending).forEach(p=>p.rej(new Error("Conexión cerrada")));pending={}}
async function connect(){
  closeWs();const t=tok();if(!t||!acc){render();return}
  setState("Conectando con tu cuenta…");
  let url;try{const j=await bridge({action:"otp",token:t,account_id:acc.id});url=(j&&j.data&&j.data.url)||(j&&j.url)}catch(e){lastErr=e.message;render();return}
  if(!url){lastErr="Deriv no devolvió la conexión de la cuenta.";render();return}
  const s=new WebSocket(url);ws=s;
  s.onopen=()=>{lastErr="";setState("");send({balance:1,subscribe:1}).catch(()=>{});send({portfolio:1}).then(r=>{((r.portfolio||{}).contracts||[]).forEach(c=>watch(c.contract_id))}).catch(()=>{});
    loadCF();pingT=setInterval(()=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({ping:1}))},25000);render()};
  s.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}
    const p=m.req_id&&pending[m.req_id];
    if(p&&!p.done){p.done=true;m.error?p.rej(new Error(m.error.message||"Error de Deriv")):p.res(m)}
    if(p&&!m.subscription)delete pending[m.req_id];
    if(m.msg_type==="balance"&&m.balance){bal=+m.balance.balance;cur=m.balance.currency||cur;paintTop()}
    if(m.msg_type==="proposal_open_contract"&&m.proposal_open_contract&&m.proposal_open_contract.contract_id)onPoc(m.proposal_open_contract);
    if(m.msg_type==="buy"&&m.buy){toast(`Operación abierta · ${money(m.buy.buy_price,cur)}`);watch(m.buy.contract_id)}};
  s.onclose=()=>{ws=null;clearInterval(pingT);if(tok()&&acc){setState("Reconectando…");wsTimer=setTimeout(connect,2500)}};
  s.onerror=()=>{}}
function send(o){return new Promise((res,rej)=>{if(!ws||ws.readyState!==1)return rej(new Error("Sin conexión con Deriv"));const id=reqN++;pending[id]={res,rej};ws.send(JSON.stringify(Object.assign({},o,{req_id:id})));
  setTimeout(()=>{if(pending[id]&&!pending[id].done){delete pending[id];rej(new Error("Deriv no respondió a tiempo"))}},20000)})}
const watched=new Set();
function watch(id){if(!id||watched.has(id))return;watched.add(id);send({proposal_open_contract:1,contract_id:id,subscribe:1}).catch(()=>watched.delete(id))}

/* qué permite el mercado (multiplicadores disponibles) */
async function loadCF(){const sym=symNow();if(!sym||cfInfo[sym]||!ws)return;cfInfo[sym]={loading:true};
  try{const r=await send({contracts_for:sym});const av=((r.contracts_for||{}).available)||[];
    const mul=av.filter(a=>/^MULT(UP|DOWN)$/.test(a.contract_type));const rng=[];mul.forEach(a=>(a.multiplier_range||[]).forEach(v=>{if(!rng.includes(+v))rng.push(+v)}));rng.sort((a,b)=>a-b);
    cfInfo[sym]={mult:mul.length>0,range:rng,types:av.map(a=>a.contract_type)}}
  catch(e){cfInfo[sym]={err:e.message}}
  render()}

/* ---------- operar ---------- */
function symNow(){try{return(O.cur()||{}).sym||""}catch(e){return""}}
function buy(dir,ok){
  if(busy||!ws)return;const sym=symNow();const stake=cfg.mode==="lote"?stakeFor(+cfg.lot,sym):+cfg.stake;
  if(!(stake>0)){toast(cfg.mode==="lote"?"Escribe el lote":"Escribe el monto");return}
  if(!acc.demo&&cfg.confirmReal&&!cfg.oneClick&&!ok){confirmAsk=dir;render();return}
  confirmAsk=null;busy=true;render();
  const lo={};if(+cfg.tp>0)lo.take_profit=+cfg.tp;if(+cfg.sl>0)lo.stop_loss=+cfg.sl;
  const auto=cfg.mode==="lote"&&cfg.autoMult,tried=[];
  const go=()=>{const mult=multNow(sym,tried),st=cfg.mode==="lote"?stakeFor(+cfg.lot,sym,mult):+cfg.stake;
    const L=Object.assign({},lo);if(L.stop_loss&&L.stop_loss>st)delete L.stop_loss; /* Deriv no acepta un SL mayor que el margen */
    const parameters={amount:st,basis:"stake",contract_type:dir==="up"?"MULTUP":"MULTDOWN",currency:cur,multiplier:mult,underlying_symbol:sym};
    if(Object.keys(L).length)parameters.limit_order=L;
    send({buy:"1",price:st,parameters}).then(r=>{busy=false;if(r.buy)watch(r.buy.contract_id);if(lo.stop_loss&&!L.stop_loss)toast(`El SL de ${money(lo.stop_loss,cur)} es mayor que el margen (${money(st,cur)}): quedó sin SL y se cierra sola al perder el margen.`);render()})
      .catch(e=>{/* si Deriv no acepta ese monto (máximo/mínimo del mercado), prueba con el siguiente multiplicador */
        if(auto&&/max|máx|min|mín|stake|monto|amount|exceed|supera/i.test(e.message||"")&&tried.length<4){tried.push(mult);const nx=multNow(sym,tried);if(nx!==mult)return go()}
        busy=false;toast(e.message);render()})};
  go()}
function sell(id){const c=contracts[id];if(c)c._closing=true;render();
  send({sell:+id,price:0}).then(r=>{toast(`Cerrada · ${money((r.sell||{}).sold_for,cur)}`)}).catch(e=>{if(c)c._closing=false;toast(e.message);render()})}
function onPoc(p){const id=String(p.contract_id);const old=contracts[id]||{};contracts[id]=Object.assign(old,p);
  if(+p.is_sold===1||p.status==="sold"||p.status==="won"||p.status==="lost"){
    const pr=+p.profit;if(!old._done){old._done=true;toast(`${pr>=0?"Ganaste":"Perdiste"} ${money(Math.abs(pr),cur)} · ${p.underlying_symbol||""}`)}
    setTimeout(()=>{delete contracts[id];syncLines();render()},4000)}
  syncLinesSoon();paintPos()}

/* ---------- líneas en el gráfico: entrada, TP y SL (se arrastran como en MT5) ---------- */
let lineMap={},lineT=null,drag=null;
const GREEN="#089981",RED="#f23645",BLUE="#2962ff";
function regLine(){const KC=window.klinecharts;if(!KC||regLine.done)return;regLine.done=true;
  KC.registerOverlay({name:"eagTradeLine",totalStep:2,lock:true,needDefaultPointFigure:false,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,
    createPointFigures:({overlay,coordinates,bounding})=>{const c=coordinates[0];if(!c)return[];const e=overlay.extendData||{};
      return[{type:"line",ignoreEvent:true,attrs:{coordinates:[{x:0,y:c.y},{x:bounding.width,y:c.y}]},styles:{style:e.solid?"solid":"dashed",dashedValue:[6,4],color:e.col,size:e.solid?1.6:1.2}},
        {type:"text",ignoreEvent:true,attrs:{x:e.right?Math.round(bounding.width*.56):8,y:c.y-3,text:e.txt||"",align:e.right?"center":"left",baseline:"bottom"},styles:{color:"#fff",size:12,weight:"700",backgroundColor:e.col,borderColor:e.col,paddingLeft:7,paddingRight:7,paddingTop:4,paddingBottom:4,borderRadius:4}}]},
    createYAxisFigures:({overlay,coordinates,bounding,yAxis})=>{const c=coordinates[0];if(!c)return[];const e=overlay.extendData||{};const z=yAxis&&yAxis.isFromZero&&yAxis.isFromZero();
      return[{type:"text",ignoreEvent:true,attrs:{x:z?0:bounding.width,y:c.y,text:e.ax||"",align:z?"left":"right",baseline:"middle"},styles:{color:"#fff",size:11,backgroundColor:e.col,borderColor:e.col,paddingLeft:4,paddingRight:4,paddingTop:3,paddingBottom:3,borderRadius:2}}]}})}
function chartNow(){try{return O.chart()}catch(e){return null}}
function clearLines(){Object.values(lineMap).forEach(l=>{try{l.chart.removeOverlay(l.id)}catch(e){}});lineMap={}}
const syncLinesSoon=()=>{if(lineT)return;lineT=setTimeout(()=>{lineT=null;syncLines()},250)};
/* matemática del multiplicador: ganancia al precio P */
const isUp=c=>c.contract_type==="MULTUP";
const pnlAt=(c,P)=>{const e=+c.entry_spot,k=(+c.buy_price)*(+c.multiplier)/e;return isUp(c)?k*(P-e):k*(e-P)};
const priceFor=(c,amt,kind)=>{const e=+c.entry_spot,k=(+c.buy_price)*(+c.multiplier)/e;const d=amt/k;   /* puntos */
  const sign=(kind==="tp")===isUp(c)?1:-1;return e+sign*d};
const kindAt=(c,P)=>{const above=P>+c.entry_spot;return isUp(c)?(above?"tp":"sl"):(above?"sl":"tp")};
const lvl=(c,kind)=>{const lo=c.limit_order||{},o=kind==="tp"?lo.take_profit:lo.stop_loss;if(!o)return null;
  const amt=Math.abs(+(o.order_amount!=null?o.order_amount:o));if(!(amt>0))return null;const v=o.value!=null&&isFinite(+o.value)?+o.value:priceFor(c,amt,kind);return{amt,price:v}};
const decs=c=>{const s=String(c.entry_spot||"");return s.includes(".")?s.split(".")[1].length:2};
/* ---------- brokers: cada uno entrega sus posiciones con el mismo formato ----------
   pos = {key, sym, up, entry, tp, sl, pnl, label, t, dec, edit:true}  ·  setLevel(key, "tp"|"sl", precio|null)  ·  preview(pos, kind, precio) */
const BROKERS={};
function derivPositions(){return Object.values(contracts).filter(c=>+c.is_sold!==1&&c.entry_spot!=null).map(c=>{const pr=+c.profit,lt=lotsOf(c),T=lvl(c,"tp"),S=lvl(c,"sl");
  return{key:"dv:"+c.contract_id,sym:c.underlying_symbol,up:isUp(c),entry:+c.entry_spot,tp:T?T.price:null,sl:S?S.price:null,tpTxt:T?`TP +${money(T.amt,cur)}`:"",slTxt:S?`SL -${money(S.amt,cur)}`:"",
    pnl:pr,label:`${isUp(c)?"▲ Compra":"▼ Venta"} ${lt?fmtLot(lt)+" lotes":"x"+(c.multiplier||"")} · ${pr>=0?"+":""}${money(pr,cur)}`,t:(c.entry_spot_time||c.date_start||0)*1000,dec:decs(c),c}})}
BROKERS.dv={positions:()=>ws?derivPositions():[],
  preview:(p,kind,P)=>`${kind==="tp"?"TP +":"SL -"}${money(Math.abs(pnlAt(p.c,P)),cur)}`,
  setLevel:(p,kind,P,from)=>{const c=p.c;
    if(P==null){setLimit(c,kind,null);return}
    let amt=Math.abs(pnlAt(c,P));if(kind==="sl"&&amt>+c.buy_price){amt=+c.buy_price;toast("El stop loss no puede ser mayor al margen: se dejó en "+money(amt,cur))}
    const lo=c.limit_order=Object.assign({},c.limit_order||{});lo[kind==="tp"?"take_profit":"stop_loss"]={order_amount:amt,value:String(P)};
    if(from&&from!=="e"&&from!==kind){setLimit(c,from,null);delete lo[from==="tp"?"take_profit":"stop_loss"]}
    setLimit(c,kind,amt);paintPos()}};
const allPositions=()=>{const out=[];Object.values(BROKERS).forEach(b=>{try{out.push(...b.positions())}catch(e){}});return out};
const brokerOf=key=>BROKERS[String(key).split(":")[0]];
function want(p){const out=[];const G=p.pnl>=0?GREEN:RED;
  out.push({k:"e",price:p.entry,ex:{col:G,solid:true,txt:p.label,ax:p.entry.toFixed(p.dec)}});
  ["tp","sl"].forEach(k=>{if(drag&&drag.key===p.key&&drag.from===k)return;const v=p[k];if(v==null)return;
    out.push({k,price:v,ex:{col:k==="tp"?GREEN:RED,right:true,txt:p[k+"Txt"]||k.toUpperCase(),ax:(+v).toFixed(p.dec)}})});
  if(drag&&drag.key===p.key&&drag.price!=null){const k=kindOf(p,drag.price);const b=brokerOf(p.key);
    out.push({k:"drag",price:drag.price,ex:{col:k==="tp"?GREEN:RED,right:true,txt:`${b.preview(p,k,drag.price)}  · suelta para fijar`,ax:drag.price.toFixed(p.dec)}})}
  return out}
const kindOf=(p,P)=>(P>p.entry)===p.up?"tp":"sl";
function syncLines(){regLine();const ch=chartNow(),sym=symNow();const keep={};
  if(ch)allPositions().forEach(p=>{if(p.sym!==sym)return;
    want(p).forEach(w=>{const key=p.key+"|"+w.k;keep[key]=1;let l=lineMap[key];if(l&&(l.chart!==ch||!ch.getOverlayById(l.id))){try{l.chart.removeOverlay(l.id)}catch(e){}l=null}
      const pt={timestamp:p.t||Date.now(),value:w.price};
      if(!l){try{const oid=ch.createOverlay({name:"eagTradeLine",lock:true,zLevel:w.k==="drag"?7:w.k==="e"?6:5,points:[pt],extendData:w.ex});if(oid)lineMap[key]={chart:ch,id:oid,price:w.price,pk:p.key,k:w.k}}catch(e){}}
      else{try{ch.overrideOverlay({id:l.id,points:[pt],extendData:w.ex});l.price=w.price}catch(e){}}})});
  Object.keys(lineMap).forEach(key=>{if(!keep[key]){const l=lineMap[key];try{l.chart.removeOverlay(l.id)}catch(e){}delete lineMap[key]}})}

/* arrastrar: desde la entrada crea TP o SL (según el lado); desde TP/SL lo mueve; soltar sobre la entrada o doble clic lo quita */
function paneDom(){const ch=chartNow();try{return ch&&ch.getDom("candle_pane","main")}catch(e){return null}}
function yToPrice(y){const ch=chartNow();try{let p=ch.convertFromPixel([{x:10,y}],{paneId:"candle_pane"});if(Array.isArray(p))p=p[0];const v=p&&+p.value;return isFinite(v)?v:null}catch(e){return null}}
function priceToY(v){const ch=chartNow();try{const p=ch.convertToPixel({value:v},{paneId:"candle_pane"});return p&&p.y}catch(e){return null}}
function hitLine(clientY,tol){const dom=paneDom();if(!dom)return null;const r=dom.getBoundingClientRect(),y=clientY-r.top;let best=null;
  Object.values(lineMap).forEach(l=>{if(l.k==="drag")return;const ly=priceToY(l.price);if(ly==null)return;const d=Math.abs(ly-y);if(d<=tol&&(!best||d<best.d||(d===best.d&&l.k!=="e")))best={d,l}});
  return best&&best.l}
let lastHit={key:"",t:0};
function setLimit(c,kind,amt){const id=+c.contract_id;const lo={};lo[kind==="tp"?"take_profit":"stop_loss"]=amt==null?null:Math.round(amt*100)/100;
  return send({contract_update:1,contract_id:id,limit_order:lo}).then(()=>toast(amt==null?`${kind==="tp"?"Take profit":"Stop loss"} quitado`:`${kind==="tp"?"Take profit":"Stop loss"}: ${money(amt,cur)}`)).catch(e=>toast(e.message))}
const posByKey=k=>allPositions().find(p=>p.key===k);
function startDrag(e,cy,touch){if(!Object.keys(lineMap).length)return;const dom=paneDom();if(!dom)return;const t=e.target;if(!dom.contains(t)&&!(t&&t.tagName==="CANVAS"&&dom.parentNode&&dom.parentNode.contains(t)))return;
  const r=dom.getBoundingClientRect();if(e.clientX!=null&&(e.clientX<r.left||e.clientX>r.right))return;
  const l=hitLine(cy,touch?14:7);if(!l)return;const p=posByKey(l.pk);if(!p)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation();
  const key=l.pk+"|"+l.k,now=Date.now();
  if(l.k!=="e"&&lastHit.key===key&&now-lastHit.t<380){lastHit={key:"",t:0};brokerOf(p.key).setLevel(p,l.k,null);return}   /* doble clic: quitar */
  lastHit={key,t:now};
  drag={key:p.key,from:l.k,y0:cy,moved:false,price:null};document.documentElement.classList.add("trd-dragging")}
function moveDrag(cy){if(!drag)return;if(!drag.moved&&Math.abs(cy-drag.y0)<4)return;drag.moved=true;const dom=paneDom();if(!dom)return;
  drag.price=yToPrice(cy-dom.getBoundingClientRect().top);syncLines()}
let dragJustEnded=false;
function endDrag(){if(!drag)return;const d=drag;drag=null;dragJustEnded=true;setTimeout(()=>dragJustEnded=false,60);document.documentElement.classList.remove("trd-dragging");
  const p=posByKey(d.key);if(!p||!d.moved||d.price==null){syncLines();return}const b=brokerOf(p.key);
  const ey=priceToY(p.entry),py=priceToY(d.price);
  if(ey!=null&&py!=null&&Math.abs(ey-py)<6){if(d.from!=="e")b.setLevel(p,d.from,null);syncLines();return}   /* soltó sobre la entrada: quitar */
  b.setLevel(p,kindOf(p,d.price),d.price,d.from);syncLines()}
/* se usa pointerdown (llega antes que mousedown/touchstart): así el gráfico no se mueve mientras arrastras el TP/SL */
const stopAll=e=>{if(drag){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation()}};
document.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;startDrag(e,e.clientY,e.pointerType!=="mouse")},true);
["mousedown","touchstart"].forEach(t=>document.addEventListener(t,stopAll,{capture:true,passive:false}));
document.addEventListener("pointermove",e=>{if(drag){moveDrag(e.clientY);stopAll(e);return}
  if(e.pointerType!=="mouse")return;const dom=paneDom();if(!dom||!Object.keys(lineMap).length)return;const r=dom.getBoundingClientRect();
  const inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;dom.classList.toggle("trd-hov",inside&&!!hitLine(e.clientY,7))},true);
["mousemove","touchmove"].forEach(t=>document.addEventListener(t,stopAll,{capture:true,passive:false}));
document.addEventListener("pointerup",e=>{if(drag){stopAll(e);endDrag()}},true);
document.addEventListener("pointercancel",()=>{if(drag)endDrag()},true);
["mouseup","touchend"].forEach(t=>document.addEventListener(t,e=>{if(dragJustEnded){e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation()}},true));

/* ---------- panel ---------- */
let stateMsg="";
function setState(t){stateMsg=t;render()}
function toast(t){try{O&&O.toast?O.toast(t):console.log(t)}catch(e){}}
function open(){if(!panel){panel=document.createElement("div");panel.className="trd";document.body.appendChild(panel);dragPanel()}
  panel.hidden=false;render();if(cfg.broker==="ct"&&window.EAGCT){window.EAGCT.onOpen();return}if(cfg.broker==="mt5"&&window.EAGMT5B){window.EAGMT5B.onOpen();return}if(tok()&&!ws&&!accounts.length)loadAccounts();else if(ws)loadCF()}
function close(){if(panel)panel.hidden=true}
function dragPanel(){let st=null;panel.addEventListener("pointerdown",e=>{const h=e.target.closest(".trd-h");if(!h||e.target.closest("button,select"))return;const r=panel.getBoundingClientRect();st={x:e.clientX-r.left,y:e.clientY-r.top};h.setPointerCapture(e.pointerId)});
  panel.addEventListener("pointermove",e=>{if(!st)return;panel.style.left=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,e.clientX-st.x))+"px";panel.style.top=Math.max(4,Math.min(innerHeight-60,e.clientY-st.y))+"px";panel.style.right="auto"});
  panel.addEventListener("pointerup",()=>{st=null})}
function paintTop(){if(!panel||panel.hidden)return;const b=panel.querySelector("[data-bal]");if(b)b.textContent=cfg.hide?"••••••":money(bal,cur)}
function paintPos(){if(!panel||panel.hidden)return;const box=panel.querySelector(".trd-pos");if(!box)return;
  const L=Object.values(contracts).sort((a,b)=>(b.date_start||0)-(a.date_start||0));
  const tot=L.filter(c=>+c.is_sold!==1).reduce((s,c)=>s+(+c.profit||0),0);
  box.innerHTML=L.length?`<div class="trd-ph"><b>Abiertas (${L.filter(c=>+c.is_sold!==1).length})</b><span class="${tot>=0?"t-up":"t-dn"}">${tot>=0?"+":""}${money(tot,cur)}</span>${L.filter(c=>+c.is_sold!==1&&+c.is_valid_to_sell===1).length>1?`<button class="trd-x" data-closeall>Cerrar todas</button>`:""}</div>`+
    L.map(c=>{const pr=+c.profit,up=c.contract_type==="MULTUP",sold=+c.is_sold===1;return`<div class="trd-row${sold?" sold":""}">
      <span class="trd-d ${up?"t-up":"t-dn"}">${up?"▲":"▼"}</span><span class="trd-s"><b>${esc(c.underlying_symbol||"")}</b><small>${lotsOf(c)?esc(fmtLot(lotsOf(c)))+" lotes · ":""}x${esc(c.multiplier||"")} · ${money(c.buy_price,cur)}${c.limit_order&&c.limit_order.take_profit?` · TP ${money(c.limit_order.take_profit.order_amount,cur)}`:""}${c.limit_order&&c.limit_order.stop_loss?` · SL ${money(c.limit_order.stop_loss.order_amount,cur)}`:""}</small></span>
      <span class="trd-p ${pr>=0?"t-up":"t-dn"}">${pr>=0?"+":""}${money(pr,cur)}</span>
      ${sold?`<span class="trd-done">${pr>=0?"Ganada":"Perdida"}</span>`:`<button class="trd-x" data-sell="${esc(c.contract_id)}" ${c._closing||+c.is_valid_to_sell!==1?"disabled":""}>${c._closing?"…":"Cerrar"}</button>`}</div>`}).join(""):`<div class="trd-empty">Sin operaciones abiertas</div>`;
  box.querySelectorAll("[data-sell]").forEach(b=>b.onclick=()=>sell(b.dataset.sell));
  const ca=box.querySelector("[data-closeall]");ca&&(ca.onclick=()=>Object.values(contracts).forEach(c=>{if(+c.is_sold!==1&&+c.is_valid_to_sell===1)sell(c.contract_id)}))}
function render(){if(!panel||panel.hidden)return;const t=tok(),sym=symNow(),ci=cfInfo[sym]||{};
  const CT=window.EAGCT,isCT=CT&&cfg.broker==="ct",MT=window.EAGMT5B,isMT=MT&&cfg.broker==="mt5";
  const head=`<div class="trd-h"><b>Operar</b><span class="trd-tag">${O&&O.admin?"admin":"Deriv · Multiplicadores"}</span><span class="sp"></span>
    <button class="trd-ic" data-hide title="${cfg.hide?"Mostrar saldo":"Ocultar saldo (para lives)"}">${cfg.hide?"🙈":"👁"}</button><button class="trd-ic" data-close title="Cerrar panel">×</button></div>
    ${CT||MT?`<div class="trd-brk">${[CT&&["ct","cTrader · Lotes"],MT&&["mt5","MT5"],["dv","Deriv · Opciones"]].filter(Boolean).map(([k,t])=>`<button data-brk="${k}" class="${(cfg.broker===k||(k==="dv"&&!isCT&&!isMT))?"on":""}">${t}</button>`).join("")}</div>`:""}`;
  if(isCT){panel.innerHTML=head+`<div class="trd-b" data-ctb></div>`;bindHead();CT.render(panel.querySelector("[data-ctb]"));return}
  if(isMT){panel.innerHTML=head+`<div class="trd-b" data-mtb></div>`;bindHead();MT.render(panel.querySelector("[data-mtb]"));return}
  if(!t){panel.innerHTML=head+`<div class="trd-b"><p class="trd-help">Conecta tu cuenta de Deriv para comprar y vender desde el gráfico. Inicias sesión en la página de Deriv; aquí nunca se escribe tu contraseña.</p>
    ${lastErr?`<div class="trd-err">${esc(lastErr)}</div>`:""}
    ${canLogin()?`<button class="trd-go" data-login>Conectar con Deriv</button>`:`<div class="trd-err">Para conectar, abre los charts en <b>charts.elartegrafico.com</b>.${APP_ID?"":" Falta el App ID de Deriv en la configuración."}</div>`}
    <a class="trd-reg" href="${REG_URL}" target="_blank" rel="noopener">¿No tienes cuenta de Deriv? <b>Créala gratis aquí</b> →</a>
    <p class="trd-fine">Usa primero la cuenta <b>demo</b> para probar. Operar tiene riesgo: puedes perder lo que inviertes.</p></div>`;bind();return}
  const accSel=accounts.length?`<select data-acc>${accounts.map(a=>`<option value="${esc(a.id)}"${acc&&a.id===acc.id?" selected":""}>${a.demo?"Demo":"Real"} · ${esc(a.id)}</option>`).join("")}</select>`:"";
  const real=acc&&!acc.demo;
  const mults=multsOf(sym),mN=multNow(sym),lotMode=cfg.mode==="lote";
  panel.innerHTML=head+`<div class="trd-b">
    <div class="trd-acc ${real?"real":"demo"}">${accSel}<span class="trd-bal"><small>Saldo</small><b data-bal>${cfg.hide?"••••••":money(bal,cur)}</b></span></div>
    ${real?`<div class="trd-warn">Cuenta REAL: es dinero de verdad.</div>`:""}
    ${stateMsg?`<div class="trd-state">${esc(stateMsg)}</div>`:""}${lastErr?`<div class="trd-err">${esc(lastErr)}</div>`:""}
    <div class="trd-sym"><b>${esc(sym||"—")}</b><button class="trd-1c${cfg.oneClick?" on":""}" data-oneclick title="Un clic: compra o vende al instante, sin confirmación. Atajos: Shift+B compra · Shift+S vende">⚡ Un clic ${cfg.oneClick?"ON":"OFF"}</button></div>
    <div class="trd-mode"><button data-mode="lote" class="${lotMode?"on":""}">Lotes</button><button data-mode="monto" class="${lotMode?"":"on"}">Monto $</button></div>
    ${ci.mult===false?`<div class="trd-err">${esc(sym)} no permite multiplicadores por la API de Deriv.</div>`:""}
    ${lotMode?`<label class="trd-f"><span>Lote <small>(1 lote = 1 USD por punto, como en MT5)</small></span><input data-k="lot" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(cfg.lot)}"></label>
    <div class="trd-chips">${[0.2,0.5,1,2,5].map(v=>`<button data-lt="${v}" class="${+cfg.lot===v?"on":""}">${v}</button>`).join("")}</div>
    <div class="trd-mg" data-mg></div>`:
    `<label class="trd-f"><span>Monto (${esc(cur)})</span><input data-k="stake" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(cfg.stake)}"></label>
    <div class="trd-chips">${[1,5,10,25,50].map(v=>`<button data-st="${v}" class="${+cfg.stake===v?"on":""}">${v}</button>`).join("")}</div>`}
    <details class="trd-adv"${lotMode?"":" open"}><summary>${lotMode?"Margen y cierre automático":"Multiplicador"}</summary>
      ${lotMode?`<label class="trd-ck"><input type="checkbox" data-auto ${cfg.autoMult?"checked":""}> Multiplicador automático (como MT5: el más bajo que alcance con tu saldo, para aguantar más)</label>`:""}
      <label class="trd-f"><span>Multiplicador <small>(más alto = menos margen, pero se cierra sola con menos puntos en contra)</small></span><select data-k="mult" ${lotMode&&cfg.autoMult?"disabled":""}>${mults.map(v=>`<option value="${v}"${mN===v?" selected":""}>x${v}</option>`).join("")}</select></label></details>
    <div class="trd-two"><label class="trd-f"><span>Take profit $ <small data-pts="tp">(opcional)</small></span><input data-k="tp" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(cfg.tp)}" placeholder="—"></label>
      <label class="trd-f"><span>Stop loss $ <small data-pts="sl">(opcional)</small></span><input data-k="sl" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(cfg.sl)}" placeholder="—"></label></div>
    <div class="trd-warn" data-slw hidden></div>
    ${confirmAsk?`<div class="trd-conf"><p>¿Abrir <b>${confirmAsk==="up"?"▲ Compra":"▼ Venta"}</b> ${lotMode?`de <b>${esc(fmtLot(+cfg.lot))} lotes</b> (margen ${money(stakeFor(+cfg.lot,sym),cur)})`:`por <b>${money(cfg.stake,cur)}</b>`} en cuenta REAL?</p><div><button class="trd-x" data-cno>Cancelar</button><button class="trd-go t-${confirmAsk}" data-cyes>Sí, abrir</button></div></div>`:
    `<div class="trd-bt"><button class="trd-buy t-up" data-buy="up" ${busy||!ws||ci.mult===false?"disabled":""}>▲ ${lotMode?"Comprar "+esc(fmtLot(+cfg.lot||0)):"Sube"}</button><button class="trd-buy t-dn" data-buy="dn" ${busy||!ws||ci.mult===false?"disabled":""}>▼ ${lotMode?"Vender "+esc(fmtLot(+cfg.lot||0)):"Baja"}</button></div>`}
    <div class="trd-pos"></div>
    <div class="trd-ft">${real?`<label class="trd-ck"><input type="checkbox" data-confirm ${cfg.confirmReal?"checked":""}> Confirmar cada operación en real</label>`:""}<button class="trd-lnk" data-logout>Desconectar Deriv</button></div></div>`;
  bind();paintPos();paintMg()}
/* margen del lote y a cuántos puntos se cierra sola (se actualiza con el precio) */
function paintMg(){if(!panel||panel.hidden)return;const sym=symNow(),px=lastPrice(),lotMode=cfg.mode==="lote",m=multNow(sym),lot=+cfg.lot||0;
  const st=lotMode?stakeFor(lot,sym,m):+cfg.stake||0,ppt=lotMode?lot:(px>0?st*m/px:0); /* US$ por punto */
  const el=panel.querySelector("[data-mg]");
  if(el){const room=px>0?px/m:0,f=v=>v.toFixed(v<10?2:v<100?1:0),poor=+bal>0&&st>+bal;
    el.innerHTML=px>0?`<div>Margen <b>${money(st,cur)}</b> · x${m}${cfg.autoMult?" <i>auto</i>":""}</div>
      <div>Aguanta <b>~${f(room)} pts</b> en contra antes del cierre automático de Deriv</div>
      ${comm[sym+"|"+m]!=null?`<div>Comisión al abrir ≈ <b>${money(comm[sym+"|"+m]*st,cur)}</b></div>`:""}
      ${poor?`<div class="trd-bad">Tu saldo no alcanza para este lote ni con el multiplicador más alto. Baja el lote.</div>`:""}`:"Esperando precio…";
    if(px>0&&!poor)askComm(sym,m,st)}
  /* TP y SL en puntos (como en MT5) */
  ["tp","sl"].forEach(k=>{const e=panel.querySelector(`[data-pts="${k}"]`);if(!e)return;const v=+cfg[k];e.textContent=v>0&&ppt>0?`= ${(v/ppt).toFixed(v/ppt<10?2:1)} pts`:"(opcional)"});
  const w=panel.querySelector("[data-slw]");if(w){const bad=+cfg.sl>0&&st>0&&+cfg.sl>st;w.hidden=!bad;if(bad)w.textContent=`El SL (${money(+cfg.sl,cur)}) es mayor que el margen (${money(st,cur)}): Deriv cerraría la operación antes de llegar a tu SL. ${lotMode?(cfg.autoMult?"Baja el SL o súbele al lote.":"Baja el SL o usa un multiplicador más bajo."):"Súbele al monto o baja el SL."}`}}
/* comisión de Deriv: se pregunta una vez sin comprar (proposal) y se guarda como % del margen por mercado y multiplicador */
const comm={};let commT=0,commK="";
function askComm(sym,m,st){const k=sym+"|"+m;if(!ws||!(st>0)||comm[k]!==undefined||k===commK)return;clearTimeout(commT);commT=setTimeout(()=>{commK=k;
  send({proposal:1,amount:st,basis:"stake",contract_type:"MULTUP",currency:cur,multiplier:m,underlying_symbol:sym}).then(r=>{const c=r.proposal&&r.proposal.commission;comm[k]=c!=null&&st>0?+c/st:null}).catch(()=>{comm[k]=null}).finally(()=>{commK=""})},700)}
setInterval(paintMg,1000);
/* atajos de un clic (solo con el panel abierto y "Un clic" activo) */
addEventListener("keydown",e=>{if(!panel||panel.hidden||cfg.broker!=="dv"||!cfg.oneClick||!e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&t.closest&&t.closest("input,textarea,select,[contenteditable]"))return;
  const k=e.key.toLowerCase();if(k==="b"){e.preventDefault();buy("up",true)}else if(k==="s"){e.preventDefault();buy("dn",true)}});
function bindHead(){const q=s=>panel.querySelector(s);
  q("[data-close]").onclick=close;const h=q("[data-hide]");h&&(h.onclick=()=>{cfg.hide=!cfg.hide;saveCfg();render()});
  panel.querySelectorAll("[data-brk]").forEach(b=>b.onclick=()=>{cfg.broker=b.dataset.brk;saveCfg();confirmAsk=null;render();if(cfg.broker==="dv"&&tok()&&!ws&&!accounts.length)loadAccounts();if(cfg.broker==="mt5"&&window.EAGMT5B)window.EAGMT5B.onOpen()})}
function bind(){const q=s=>panel.querySelector(s),qa=s=>panel.querySelectorAll(s);bindHead();
  const lg=q("[data-login]");lg&&(lg.onclick=login);
  const lo=q("[data-logout]");lo&&(lo.onclick=logout);
  const as=q("[data-acc]");as&&(as.onchange=()=>{acc=accounts.find(a=>a.id===as.value)||acc;ls.set(LS_ACC,acc.id);bal=acc.bal;cur=acc.cur||"USD";contracts={};watched.clear();clearLines();confirmAsk=null;connect()});
  qa("[data-k]").forEach(i=>{i.oninput=i.onchange=()=>{cfg[i.dataset.k]=i.value;saveCfg();if(i.dataset.k==="stake")qa("[data-st]").forEach(b=>b.classList.toggle("on",+b.dataset.st===+i.value));
    if(i.dataset.k==="lot"){qa("[data-lt]").forEach(b=>b.classList.toggle("on",+b.dataset.lt===+i.value));const l=fmtLot(+i.value||0);const u=q('[data-buy="up"]'),d=q('[data-buy="dn"]');u&&(u.textContent="▲ Comprar "+l);d&&(d.textContent="▼ Vender "+l)}
    if(["lot","mult","tp","sl","stake"].includes(i.dataset.k))paintMg()}});
  const au=q("[data-auto]");au&&(au.onchange=()=>{cfg.autoMult=au.checked;saveCfg();render()});
  qa("[data-st]").forEach(b=>b.onclick=()=>{cfg.stake=+b.dataset.st;saveCfg();render()});
  qa("[data-lt]").forEach(b=>b.onclick=()=>{cfg.lot=+b.dataset.lt;saveCfg();render()});
  qa("[data-mode]").forEach(b=>b.onclick=()=>{cfg.mode=b.dataset.mode;saveCfg();render()});
  const oc=q("[data-oneclick]");oc&&(oc.onclick=()=>{cfg.oneClick=!cfg.oneClick;saveCfg();confirmAsk=null;render();toast(cfg.oneClick?"Un clic activado: las órdenes se envían al instante":"Un clic desactivado")});
  qa("[data-buy]").forEach(b=>b.onclick=()=>buy(b.dataset.buy));
  const cy=q("[data-cyes]");cy&&(cy.onclick=()=>{const d=confirmAsk;confirmAsk=null;buy(d,true)});
  const cn=q("[data-cno]");cn&&(cn.onclick=()=>{confirmAsk=null;render()});
  const ck=q("[data-confirm]");ck&&(ck.onchange=()=>{cfg.confirmReal=ck.checked;saveCfg()})}

/* al cambiar de mercado o de gráfico activo */
function onChange(){if(ws)loadCF();syncLines();render()}

/* lo que comparte el panel con otros brokers (cTrader vive en eag-ctrader.js) */
const SHARED={get O(){return O},cfg,saveCfg,toast,money,esc,fmtLot,symNow,chart:chartNow,lastPrice,syncLinesSoon,render:()=>render(),isOpen:()=>!!panel&&!panel.hidden,
  addBroker:(id,b)=>{BROKERS[id]=b},paintLines:()=>syncLines()};
window.EAGTrade={
  async init(o){O=o;const CT=o.admin?window.EAGCT:null;
    /* para el público: solo Deriv (multiplicadores) y, la primera vez, en modo monto */
    if(!o.admin){try{delete window.EAGCT}catch(e){window.EAGCT=undefined}try{delete window.EAGMT5B}catch(e){window.EAGMT5B=undefined}if(cfg.broker!=="dv"||!HAD_CFG){cfg.broker="dv";if(!HAD_CFG)cfg.mode="monto";saveCfg()}}
    if(CT)CT.init(SHARED);const MT=o.admin?window.EAGMT5B:null;if(MT){MT.init(SHARED);if(o.autoConnect)MT.autoConnect()}
    const ctHad=CT?await CT.handleCallback():false;if(ctHad){cfg.broker="ct";saveCfg();open();return}
    const had=await handleCallback();if(had){cfg.broker="dv";saveCfg();open();return}
    if(tok()&&ls.get(LS_ACC,null)!=null&&o.autoConnect)loadAccounts();if(CT&&o.autoConnect)CT.autoConnect()},
  open,close,onChange:()=>{onChange();window.EAGCT&&window.EAGCT.onChange();window.EAGMT5B&&window.EAGMT5B.onChange()},
  _test:{parseAccounts,onPoc,contracts:()=>contracts,lines:()=>lineMap,dragS:()=>drag}};
})();
