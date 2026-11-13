/* © El Arte Gráfico. Todos los derechos reservados. */
/* EAG Charts — widget de gráfico propio (motor: KLineChart core, Apache-2.0).
   Barra superior, barra de dibujo estilo TradingView, dibujos guardados por mercado,
   menú de clic derecho para personalizar cada dibujo, indicadores en español. */
(function(){
"use strict";
const KC=window.klinecharts;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const GOLD="#e2b55c";
function safeTop(){let p=document.getElementById("eagSafe");if(!p){p=document.createElement("div");p.id="eagSafe";p.style.cssText="position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)";document.body.appendChild(p)}return parseFloat(getComputedStyle(p).paddingTop)||0}
const DKEY="eag_draw_v1";
const loadD=()=>{try{return JSON.parse(localStorage.getItem(DKEY)||"{}")||{}}catch(e){return{}}};
const saveD=d=>{try{localStorage.setItem(DKEY,JSON.stringify(d))}catch(e){}};
const hexA=(h,a)=>{h=String(h||GOLD).replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");const n=parseInt(h.slice(0,6),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};

/* ===================== Herramientas propias ===================== */
const BOX=/^(eagZone|eagRect|eagBuyZone|eagSellZone)$/;
/* de 2 esquinas opuestas a los 8 puntos de la caja */
function boxPts(a,b){const L=(a.timestamp||0)<=(b.timestamp||0)?a:b,R=L===a?b:a,T=Math.max(a.value,b.value),B=Math.min(a.value,b.value);
  const mid={timestamp:Math.round(((L.timestamp||0)+(R.timestamp||0))/2)};if(L.dataIndex!=null&&R.dataIndex!=null)mid.dataIndex=Math.round((L.dataIndex+R.dataIndex)/2);
  const P=(x,v)=>Object.assign(x.dataIndex!=null?{dataIndex:x.dataIndex}:{},{timestamp:x.timestamp,value:v});
  return[P(L,T),P(R,T),P(R,B),P(L,B),P(mid,T),P(R,(T+B)/2),P(mid,B),P(L,(T+B)/2)]}
let registered=false;
function registerAll(){
  if(registered)return;registered=true;
  const fmt=(v,p)=>(+v).toFixed(p);
  /* Posición larga/corta: entrada, stop y objetivo con relación riesgo/beneficio */
  KC.registerOverlay({name:"eagPosition",totalStep:4,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
    createPointFigures:({overlay,coordinates,precision})=>{
      if(coordinates.length<2)return[];
      const p=overlay.points,pp=(precision&&precision.price)||3,e=coordinates[0],s=coordinates[1],t=coordinates[2]||{x:s.x,y:e.y-(s.y-e.y)*2};
      const x1=Math.min(e.x,s.x),x2=Math.max(e.x,s.x,t.x||s.x),w=Math.max(x2-x1,40);
      const ev=p[0].value,sv=p[1].value,tv=p[2]?p[2].value:ev+(ev-sv)*2,risk=Math.abs(ev-sv),rew=Math.abs(tv-ev),long=sv<ev;
      const ex=overlay.extendData||{};const cu=ex.up||"#089981",cd=ex.dn||"#f23645";
      const pct=v=>(v/ev*100).toFixed(2)+"%";
      const lab=(x,y,txt,bg)=>({type:"text",ignoreEvent:true,attrs:{x,y,text:txt,align:"center",baseline:"middle"},styles:{color:"#fff",size:11,backgroundColor:bg,paddingLeft:6,paddingRight:6,paddingTop:3,paddingBottom:3,borderRadius:4}});
      const cx=x1+w/2;
      return[
        {type:"rect",attrs:{x:x1,y:Math.min(e.y,t.y),width:w,height:Math.abs(t.y-e.y)},styles:{style:"fill",color:hexA(cu,.18)}},
        {type:"rect",attrs:{x:x1,y:Math.min(e.y,s.y),width:w,height:Math.abs(s.y-e.y)},styles:{style:"fill",color:hexA(cd,.18)}},
        {type:"line",attrs:{coordinates:[{x:x1,y:e.y},{x:x1+w,y:e.y}]},styles:{color:"#9da1aa",size:1}},
        lab(cx,t.y+(t.y<e.y?-10:10),`Objetivo ${fmt(tv,pp)} (${pct(rew)})`,cu),
        lab(cx,s.y+(s.y<e.y?-10:10),`Stop ${fmt(sv,pp)} (${pct(risk)})`,cd),
        lab(cx,e.y,`${long?"Largo":"Corto"} · R:B 1:${risk?(rew/risk).toFixed(2):"—"}`,"#2a2d35")]}});
  /* Posición larga (compra) y corta (venta), como TradingView: un clic pone la entrada; stop y objetivo salen solos y se arrastran */
  const posFig=side=>({overlay,coordinates,precision})=>{
    if(coordinates.length<3)return[];
    const p=overlay.points,pp=(precision&&precision.price)||3,e=coordinates[0],s=coordinates[1],t=coordinates[2];
    const x1=Math.min(e.x,s.x,t.x),x2=Math.max(e.x,s.x,t.x),w=Math.max(x2-x1,30);
    const ev=p[0].value,sv=p[1].value,tv=p[2].value,risk=Math.abs(ev-sv),rew=Math.abs(tv-ev);
    const ex=overlay.extendData||{},cu=ex.up||"#089981",cd=ex.dn||"#f23645";
    const pct=v=>(v/ev*100).toFixed(2)+"%";
    const lab=(x,y,txt,bg)=>({type:"text",ignoreEvent:true,attrs:{x,y,text:txt,align:"center",baseline:"middle"},styles:{color:"#fff",size:11,backgroundColor:bg,paddingLeft:7,paddingRight:7,paddingTop:3,paddingBottom:3,borderRadius:4}});
    const cx=x1+w/2,okDir=side==="long"?(tv>ev&&sv<ev):(tv<ev&&sv>ev);
    return[
      {type:"rect",attrs:{x:x1,y:Math.min(e.y,t.y),width:w,height:Math.abs(t.y-e.y)},styles:{style:"fill",color:hexA(cu,.2)}},
      {type:"rect",attrs:{x:x1,y:Math.min(e.y,s.y),width:w,height:Math.abs(s.y-e.y)},styles:{style:"fill",color:hexA(cd,.2)}},
      {type:"line",attrs:{coordinates:[{x:x1,y:t.y},{x:x1+w,y:t.y}]},styles:{color:cu,size:1}},
      {type:"line",attrs:{coordinates:[{x:x1,y:s.y},{x:x1+w,y:s.y}]},styles:{color:cd,size:1}},
      {type:"line",attrs:{coordinates:[{x:x1,y:e.y},{x:x1+w,y:e.y}]},styles:{color:"#9da1aa",size:1}},
      lab(cx,t.y+(t.y<e.y?-11:11),`Objetivo ${fmt(tv,pp)} · ${fmt(rew,pp)} pts (${pct(rew)})`,cu),
      lab(cx,s.y+(s.y<e.y?-11:11),`Stop ${fmt(sv,pp)} · ${fmt(risk,pp)} pts (${pct(risk)})`,cd),
      lab(cx,e.y,`${side==="long"?"▲ Compra":"▼ Venta"} ${fmt(ev,pp)} · R:B 1:${risk?(rew/risk).toFixed(2):"—"}${okDir?"":" ⚠"}`,"#2a2d35")]};
  ["eagLong","eagShort"].forEach(n=>KC.registerOverlay({name:n,totalStep:2,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,createPointFigures:posFig(n==="eagLong"?"long":"short")}));
  /* línea de alerta (solo se muestra; se maneja desde el panel de alertas) */
  KC.registerOverlay({name:"eagAlert",totalStep:2,needDefaultPointFigure:false,needDefaultXAxisFigure:false,needDefaultYAxisFigure:true,lock:true,
    createPointFigures:({overlay,coordinates,bounding})=>{const c=coordinates[0];if(!c)return[];const ex=overlay.extendData||{};const col="#ff9800";
      return[{type:"line",ignoreEvent:true,attrs:{coordinates:[{x:0,y:c.y},{x:bounding.width,y:c.y}]},styles:{color:col,size:1,style:"dashed",dashedValue:[6,4]}},
        {type:"text",ignoreEvent:true,attrs:{x:8,y:c.y-9,text:`🔔 ${ex.label||"Alerta"}`,baseline:"middle"},styles:{color:"#16120a",size:11,backgroundColor:col,paddingLeft:6,paddingRight:6,paddingTop:2,paddingBottom:2,borderRadius:4}}]}});
  /* Pincel: trazo libre a mano alzada */
  KC.registerOverlay({name:"eagBrush",totalStep:2,needDefaultPointFigure:false,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,
    createPointFigures:({overlay,coordinates})=>{if(coordinates.length<2)return[];const ex=overlay.extendData||{};
      return[{type:"line",attrs:{coordinates},styles:{color:ex.color||GOLD,size:ex.size||2,smooth:true}}]}});
  /* Medir: diferencia de precio, %, velas y tiempo */
  KC.registerOverlay({name:"eagMeasure",totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
    createPointFigures:({overlay,coordinates,precision})=>{
      if(coordinates.length<2)return[];
      const[a,b]=coordinates,p=overlay.points,pp=(precision&&precision.price)||3;
      const d=p[1].value-p[0].value,up=d>=0,col=up?"#2962ff":"#f23645",pip=Math.pow(10,-pp),ticks=Math.round(Math.abs(d)/pip);
      const bars=(p[1].dataIndex!=null&&p[0].dataIndex!=null)?p[1].dataIndex-p[0].dataIndex:0;
      const ms=Math.abs((p[1].timestamp||0)-(p[0].timestamp||0)),mins=Math.round(ms/6e4);
      const tt=mins>=1440?Math.floor(mins/1440)+"d "+Math.floor(mins%1440/60)+"h":mins>=60?Math.floor(mins/60)+"h "+(mins%60)+"m":mins+"m";
      const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y),mx=(a.x+b.x)/2;
      return[{type:"rect",attrs:{x,y,width:w,height:h},styles:{style:"fill",color:hexA(col,.15)}},
        {type:"line",attrs:{coordinates:[{x:mx,y:a.y},{x:mx,y:b.y}]},styles:{color:col,size:1}},
        {type:"line",attrs:{coordinates:[{x:a.x,y:(a.y+b.y)/2},{x:b.x,y:(a.y+b.y)/2}]},styles:{color:col,size:1,style:"dashed"}},
        {type:"text",ignoreEvent:true,attrs:{x:mx,y:(up?y:y+h)+(up?-14:14),text:`${d>=0?"+":""}${d.toFixed(pp)} pts (${(d/p[0].value*100).toFixed(2)}%) · ${Math.abs(bars)} velas · ${tt}`,align:"center",baseline:"middle"},
          styles:{color:"#fff",size:11,backgroundColor:col,paddingLeft:6,paddingRight:6,paddingTop:3,paddingBottom:3,borderRadius:4}}]}});
  /* Texto */
  KC.registerOverlay({name:"eagText",totalStep:2,needDefaultPointFigure:false,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
    createPointFigures:({overlay,coordinates})=>{const c=coordinates[0];if(!c)return[];const ex=overlay.extendData||{};
      return[{type:"text",attrs:{x:c.x,y:c.y,text:ex.text||"Texto",align:"left",baseline:"middle"},styles:{color:ex.color||GOLD,size:ex.size||14,backgroundColor:ex.bg||"transparent",borderSize:0,paddingLeft:4,paddingRight:4,paddingTop:2,paddingBottom:2,borderRadius:3}}]}});
  /* Zona: rectángulo que se extiende a la derecha (ideal para zonas de oferta y demanda) */
  /* ===== Cajas con 8 puntos (4 esquinas + 4 a la mitad de cada lado) ===== */
  /* orden: 0 sup-izq · 1 sup-der · 2 inf-der · 3 inf-izq · 4 mitad arriba · 5 mitad derecha · 6 mitad abajo · 7 mitad izquierda */
  const boxFig=kind=>({overlay,coordinates,bounding})=>{
    if(coordinates.length<2)return[];const ex=overlay.extendData||{};
    const xs=coordinates.map(c=>c.x),ys=coordinates.map(c=>c.y);let x1=Math.min(...xs),x2=Math.max(...xs);const y1=Math.min(...ys),y2=Math.max(...ys),h=y2-y1;
    if(kind==="zoneR")x2=bounding.width;
    const F=[];
    if(kind==="buy"||kind==="sell"){const top=kind==="buy"?(ex.up||"#089981"):(ex.dn||"#f23645"),bot=kind==="buy"?(ex.dn||"#f23645"):(ex.up||"#089981"),col=ex.color||"#b46cff",lw=ex.size||2;
      F.push({type:"rect",attrs:{x:x1,y:y1,width:x2-x1,height:h},styles:{style:"stroke_fill",color:hexA(col,.16),borderColor:col,borderSize:1}});
      F.push({type:"line",ignoreEvent:true,attrs:{coordinates:[{x:0,y:y1},{x:bounding.width,y:y1}]},styles:{color:top,size:lw}});
      F.push({type:"line",ignoreEvent:true,attrs:{coordinates:[{x:0,y:y2},{x:bounding.width,y:y2}]},styles:{color:bot,size:lw}});
      F.push({type:"text",ignoreEvent:true,attrs:{x:x1+6,y:y1+6,text:ex.text||(kind==="buy"?"Compra":"Venta"),baseline:"top"},styles:{color:"#fff",size:11,backgroundColor:kind==="buy"?top:top,paddingLeft:6,paddingRight:6,paddingTop:2,paddingBottom:2,borderRadius:4}});
      return F}
    const col=ex.color||GOLD;
    F.push({type:"rect",attrs:{x:x1,y:y1,width:x2-x1,height:h},styles:{style:"stroke_fill",color:ex.fill||hexA(col,.16),borderColor:col,borderSize:ex.size||1}});
    if(ex.text)F.push({type:"text",ignoreEvent:true,attrs:{x:x1+6,y:y1+h/2,text:ex.text,baseline:"middle"},styles:{color:col,size:12,backgroundColor:"transparent"}});
    return F};
  const boxMove=({points,performPointIndex:i,performPoint:pp})=>{if(!points||points.length<8||i==null||!pp)return;
    let Lp={timestamp:points[0].timestamp,dataIndex:points[0].dataIndex},Rp={timestamp:points[1].timestamp,dataIndex:points[1].dataIndex},T=points[0].value,B=points[2].value;
    const X={timestamp:pp.timestamp,dataIndex:pp.dataIndex};
    if([0,3,7].includes(i))Lp=X;if([1,2,5].includes(i))Rp=X;if([0,1,4].includes(i))T=pp.value;if([2,3,6].includes(i))B=pp.value;
    const np=boxPts(Object.assign({},Lp,{value:T}),Object.assign({},Rp,{value:B}));
    np.forEach((p,k)=>{points[k].timestamp=p.timestamp;points[k].dataIndex=p.dataIndex;points[k].value=p.value})};
  [["eagZone","zoneR"],["eagRect","rect"],["eagBuyZone","buy"],["eagSellZone","sell"]].forEach(([n,k])=>KC.registerOverlay({name:n,totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:false,needDefaultYAxisFigure:true,
    createPointFigures:boxFig(k),performEventPressedMove:boxMove}));
  /* Línea horizontal con precio (como TradingView) */
  /* indicadores extra */
  const sma=(a,n,i)=>{if(i<n-1)return null;let s=0;for(let k=i-n+1;k<=i;k++)s+=a[k];return s/n};
  KC.registerIndicator({name:"ATR",shortName:"ATR",calcParams:[14],figures:[{key:"atr",title:"ATR: ",type:"line"}],
    calc:(L,ind)=>{const n=ind.calcParams[0];let prev=null;const tr=L.map((k,i)=>{const pc=i?L[i-1].close:k.close;return Math.max(k.high-k.low,Math.abs(k.high-pc),Math.abs(k.low-pc))});
      return L.map((k,i)=>{if(i<n-1)return{};if(prev==null){let s=0;for(let j=0;j<n;j++)s+=tr[j];prev=s/n}else prev=(prev*(n-1)+tr[i])/n;return{atr:prev}})}});
  KC.registerIndicator({name:"STOCH",shortName:"Estocástico",calcParams:[14,3,3],figures:[{key:"k",title:"%K: ",type:"line"},{key:"d",title:"%D: ",type:"line"}],minValue:0,maxValue:100,
    calc:(L,ind)=>{const[n,sk,sd]=ind.calcParams;const raw=L.map((k,i)=>{if(i<n-1)return null;let hh=-Infinity,ll=Infinity;for(let j=i-n+1;j<=i;j++){hh=Math.max(hh,L[j].high);ll=Math.min(ll,L[j].low)}return hh===ll?50:(k.close-ll)/(hh-ll)*100});
      const K=raw.map((v,i)=>{if(v==null||i<n-1+sk-1)return null;let s=0;for(let j=i-sk+1;j<=i;j++)s+=raw[j];return s/sk});
      return K.map((v,i)=>{if(v==null)return{};let ok=true,s=0;for(let j=i-sd+1;j<=i;j++){if(K[j]==null)ok=false;else s+=K[j]}return ok?{k:v,d:s/sd}:{k:v}})}});
  KC.registerIndicator({name:"DONCHIAN",shortName:"Donchian",series:"price",precision:2,calcParams:[20],shouldOhlc:true,figures:[{key:"up",title:"Sup: ",type:"line"},{key:"mid",title:"Med: ",type:"line"},{key:"dn",title:"Inf: ",type:"line"}],
    calc:(L,ind)=>{const n=ind.calcParams[0];return L.map((k,i)=>{if(i<n-1)return{};let hh=-Infinity,ll=Infinity;for(let j=i-n+1;j<=i;j++){hh=Math.max(hh,L[j].high);ll=Math.min(ll,L[j].low)}return{up:hh,dn:ll,mid:(hh+ll)/2}})}});
  KC.registerIndicator({name:"SUPERTREND",shortName:"SuperTrend",series:"price",precision:2,calcParams:[10,3],shouldOhlc:true,figures:[{key:"up",title:"Alcista: ",type:"line",styles:()=>({color:"#089981"})},{key:"dn",title:"Bajista: ",type:"line",styles:()=>({color:"#f23645"})}],
    calc:(L,ind)=>{const[n,m]=ind.calcParams;let atr=null,fu=0,fl=0,trend=1;
      return L.map((k,i)=>{const pc=i?L[i-1].close:k.close,tr=Math.max(k.high-k.low,Math.abs(k.high-pc),Math.abs(k.low-pc));
        atr=atr==null?tr:(atr*(n-1)+tr)/n;if(i<n)return{};const hl=(k.high+k.low)/2,bu=hl+m*atr,bl=hl-m*atr;
        fu=(bu<fu||pc>fu)?bu:fu;fl=(bl>fl||pc<fl)?bl:fl;if(trend===1&&k.close<fl)trend=-1;else if(trend===-1&&k.close>fu)trend=1;
        return trend===1?{up:fl}:{dn:fu}})}});
  KC.registerIndicator({name:"WMA",shortName:"WMA",series:"price",precision:2,calcParams:[20],shouldOhlc:true,figures:[{key:"w",title:"WMA: ",type:"line"}],
    calc:(L,ind)=>{const n=ind.calcParams[0],den=n*(n+1)/2;return L.map((k,i)=>{if(i<n-1)return{};let s=0;for(let j=0;j<n;j++)s+=L[i-j].close*(n-j);return{w:s/den}})}});
}

/* ===================== Catálogo ===================== */
const TOOLS=[
  {g:"lines",t:"Líneas",items:[["segment","Línea de tendencia"],["rayLine","Rayo"],["straightLine","Línea extendida"],["arrow","Flecha"],["horizontalStraightLine","Línea horizontal"],["horizontalRayLine","Rayo horizontal"],["horizontalSegment","Segmento horizontal"],["verticalStraightLine","Línea vertical"],["priceLine","Línea de precio"]]},
  {g:"chan",t:"Canales",items:[["parallelStraightLine","Canal paralelo"],["priceChannelLine","Canal de precio"]]},
  {g:"fib",t:"Fibonacci y Gann",items:[["fibonacciLine","Retroceso de Fibonacci"],["fibonacciExtension","Extensión de Fibonacci"],["fibonacciSegment","Segmentos de Fibonacci"],["fibonacciSpeedResistanceFan","Abanico de Fibonacci"],["fibonacciCircle","Círculos de Fibonacci"],["fibonacciSpiral","Espiral de Fibonacci"],["gannBox","Caja de Gann"]]},
  {g:"shape",t:"Formas y zonas",items:[["eagBuyZone","Zona de compra (verde arriba, roja abajo)"],["eagSellZone","Zona de venta (roja arriba, verde abajo)"],["eagZone","Zona (se extiende a la derecha)"],["eagRect","Rectángulo"],["circle","Círculo"],["triangle","Triángulo"],["parallelogram","Paralelogramo"]]},
  {g:"pat",t:"Patrones y ondas",items:[["xabcd","Patrón XABCD"],["abcd","Patrón ABCD"],["threeWaves","Tres ondas"],["fiveWaves","Cinco ondas (Elliott)"],["eightWaves","Ocho ondas"],["anyWaves","Ondas libres"]]},
  {g:"pos",t:"Posición y medición",items:[["eagLong","Posición larga (compra)"],["eagShort","Posición corta (venta)"],["eagMeasure","Regla: medir puntos, %, velas y tiempo"]]},
  {g:"txt",t:"Texto y notas",items:[["eagText","Texto"],["simpleAnnotation","Nota con flecha"],["simpleTag","Etiqueta de precio"]]}];
const TNAME={eagPosition:"Posición (antigua)",eagBrush:"Pincel (dibujo libre)"};TOOLS.forEach(g=>g.items.forEach(([k,t])=>TNAME[k]=t));
const IC={
  lines:'<path d="M4 20 20 4"/><circle cx="4" cy="20" r="1.6"/><circle cx="20" cy="4" r="1.6"/>',
  chan:'<path d="M3 15 15 3M9 21 21 9"/>',
  fib:'<path d="M3 5h18M3 10h18M3 14h18M3 19h18"/><path d="M5 19 19 5" stroke-dasharray="2 2"/>',
  shape:'<rect x="4" y="6" width="16" height="12" rx="1"/>',
  pat:'<path d="M3 17 8 7l5 8 4-10 4 12"/>',
  pos:'<path d="M5 4v16M5 12h14"/><path d="M8 8h11M8 16h11" stroke-dasharray="2 2"/>',
  txt:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  cross:'<path d="M12 3v18M3 12h18"/>',
  ruler:'<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  magnet:'<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  fx:'<path d="M9 20c2 0 2-2 2.5-5L13 6c.4-2 1-3 3-3M8 10h7M15 14l5 6M20 14l-5 6"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  cam:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  unfull:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  caret:'<path d="m6 9 6 6 6-6"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  mtf:'<rect x="3" y="3" width="18" height="10" rx="1.5"/><rect x="3" y="15" width="5" height="6" rx="1"/><rect x="9.5" y="15" width="5" height="6" rx="1"/><rect x="16" y="15" width="5" height="6" rx="1"/>',
  chevl:'<path d="m15 6-6 6 6 6"/>',chevr:'<path d="m9 6 6 6-6 6"/>',
  reset:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  reload:'<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
  front:'<rect x="9" y="9" width="11" height="11" rx="1"/><path d="M15 9V4H4v11h5"/>'};

/* íconos de cada herramienta (24×24) */
const P=(x,y)=>`<circle cx="${x}" cy="${y}" r="1.7" fill="currentColor" stroke="none"/>`;
const TI={
  segment:'<path d="M5 19 19 5"/>'+P(5,19)+P(19,5),
  rayLine:'<path d="M5 19 22 2"/>'+P(5,19)+P(13,11),
  straightLine:'<path d="M1 23 23 1"/>'+P(8,16)+P(16,8),
  arrow:'<path d="M5 19 19 5M11 5h8v8"/>',
  horizontalStraightLine:'<path d="M1 12h22"/>'+P(12,12),
  horizontalRayLine:'<path d="M6 12h17"/>'+P(6,12),
  horizontalSegment:'<path d="M5 12h14"/>'+P(5,12)+P(19,12),
  verticalStraightLine:'<path d="M12 1v22"/>'+P(12,12),
  priceLine:'<path d="M3 14h12"/><rect x="15" y="10.5" width="7" height="7" rx="1.5"/>'+P(5,14),
  parallelStraightLine:'<path d="M2 15 15 2M9 22 22 9"/>'+P(6,11)+P(13,18),
  priceChannelLine:'<path d="M2 16 16 2M2 22 22 6"/><path d="M8 20 20 8" stroke-dasharray="2 2"/>',
  fibonacciLine:'<path d="M3 4h18M3 9h18M3 13h18M3 17h18M3 21h18"/>'+P(3,4)+P(21,21),
  fibonacciExtension:'<path d="M3 20 9 8l5 7M14 5h8M14 10h8M14 15h8"/>',
  fibonacciSegment:'<path d="M4 5h10M4 10h12M4 14h14M4 19h16"/>'+P(4,19)+P(14,5),
  fibonacciSpeedResistanceFan:'<path d="M3 21 21 3M3 21 21 9M3 21 21 15M3 21h18"/>',
  fibonacciCircle:'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/>',
  fibonacciSpiral:'<path d="M12 12a2 2 0 0 1 2 2 4 4 0 0 1-4 4 6 6 0 0 1-6-6 8 8 0 0 1 8-8 10 10 0 0 1 10 10"/>',
  gannBox:'<rect x="3" y="3" width="18" height="18"/><path d="M3 21 21 3M3 12h18M12 3v18" stroke-dasharray="2 2"/>',
  eagZone:'<path d="M3 8h20M3 15h20"/><rect x="3" y="8" width="20" height="7" fill="currentColor" opacity=".18" stroke="none"/>'+P(3,8)+P(9,15),
  rect:'<rect x="4" y="6" width="16" height="12" rx="1"/>',
  circle:'<circle cx="12" cy="12" r="8"/>',
  triangle:'<path d="M12 4 21 20H3z"/>',
  parallelogram:'<path d="M7 6h14l-4 12H3z"/>',
  xabcd:'<path d="M2 18 7 6l4 9 5-11 6 14"/>'+P(2,18)+P(7,6)+P(11,15)+P(16,4)+P(22,18),
  abcd:'<path d="M3 18 9 6l5 9 7-10"/>'+P(3,18)+P(9,6)+P(14,15)+P(21,5),
  threeWaves:'<path d="M3 18 9 7l5 7 7-10"/>',
  fiveWaves:'<path d="M2 19 6 11l3 4 5-10 3 6 5-8"/>',
  eightWaves:'<path d="M1 19l3-6 2 3 3-8 2 4 3-9 3 10 3-4 3 6"/>',
  anyWaves:'<path d="M2 16c3-8 5 6 8-2s5 6 8-2 3 2 4 0"/>',
  eagLong:'<rect x="4" y="4" width="16" height="8" fill="#089981" opacity=".45" stroke="none"/><rect x="4" y="12" width="16" height="6" fill="#f23645" opacity=".45" stroke="none"/><path d="M4 12h16M9 9l3-3 3 3"/>',
  eagShort:'<rect x="4" y="6" width="16" height="6" fill="#f23645" opacity=".45" stroke="none"/><rect x="4" y="12" width="16" height="8" fill="#089981" opacity=".45" stroke="none"/><path d="M4 12h16M9 15l3 3 3-3"/>',
  eagPosition:'<rect x="4" y="4" width="16" height="7" fill="#089981" opacity=".35" stroke="none"/><rect x="4" y="11" width="16" height="7" fill="#f23645" opacity=".35" stroke="none"/><path d="M4 11h16"/>',
  eagMeasure:'<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  eagText:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  eagRect:'<rect x="4" y="6" width="16" height="12" rx="1"/>'+P(4,6)+P(20,6)+P(20,18)+P(4,18)+P(12,6)+P(12,18),
  eagBuyZone:'<path d="M2 7h20" stroke="#089981" stroke-width="2.2"/><path d="M2 17h20" stroke="#f23645" stroke-width="2.2"/><rect x="6" y="7" width="12" height="10" fill="#b46cff" opacity=".3" stroke="none"/>',
  eagSellZone:'<path d="M2 7h20" stroke="#f23645" stroke-width="2.2"/><path d="M2 17h20" stroke="#089981" stroke-width="2.2"/><rect x="6" y="7" width="12" height="10" fill="#b46cff" opacity=".3" stroke="none"/>',
  eagBrush:'<path d="M3 21c3 0 5-1.5 5-4a2.5 2.5 0 0 0-5 0"/><path d="M8 17 20 5a2.1 2.1 0 0 0-3-3L5 14"/>',
  simpleAnnotation:'<rect x="3" y="3" width="18" height="10" rx="2"/><path d="M12 13v8"/>'+P(12,21),
  simpleTag:'<path d="M3 12h7"/><path d="M10 7h9l2 5-2 5h-9z"/>'};
const tsvg=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${TI[k]||""}</svg>`;
const svg=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[k]||""}</svg>`;
const COLORS=["#e2b55c","#f3d08a","#ffffff","#9da1aa","#2962ff","#089981","#f23645","#ff9800","#9c27b0","#e91e63","#00bcd4","#000000"];
const IND=[ // [nombre, nombre en español, dónde]
  ["MA","Media móvil (MA)","main"],["EMA","Media exponencial (EMA)","main"],["SMA","Media suavizada (SMA)","main"],["WMA","Media ponderada (WMA)","main"],
  ["BOLL","Bandas de Bollinger","main"],["DONCHIAN","Canales de Donchian","main"],["SUPERTREND","SuperTrend","main"],["SAR","SAR parabólico","main"],["BBI","BBI (promedio de medias)","main"],
  ["RSI","RSI (fuerza relativa)","sub"],["MACD","MACD","sub"],["STOCH","Estocástico","sub"],["ATR","ATR (rango verdadero medio)","sub"],["CCI","CCI","sub"],["WR","Williams %R","sub"],["MTM","Momentum","sub"],["ROC","Tasa de cambio (ROC)","sub"],
  ["KDJ","KDJ","sub"],["DMI","DMI / ADX","sub"],["AO","Awesome Oscillator","sub"],["TRIX","TRIX","sub"],["BIAS","BIAS","sub"],["DMA","DMA","sub"],["PSY","PSY (psicológico)","sub"],["BRAR","BRAR","sub"],["CR","CR","sub"],["EMV","EMV","sub"],["VR","VR","sub"],["OBV","OBV","sub"],["PVT","PVT","sub"]];
const INDN={};IND.forEach(i=>INDN[i[0]]=i[1]);

/* estilos del motor según el tema */
function themeStyles(light,eag){
  const tx=light?"#5c616b":eag?"#93a1c4":"#9da1aa",ln=light?"#e5e6e9":eag?"#1f3266":"#24262c",cb=light?"#15171c":eag?"#2b4282":"#363a45";
  const axis={axisLine:{color:ln},tickLine:{color:ln},tickText:{color:tx,size:11}};
  const ch={line:{color:light?"#9aa0aa":"#5d626c",style:"dashed",dashedValue:[4,4]},text:{backgroundColor:cb,borderColor:cb,color:"#fff"}};
  return{xAxis:axis,yAxis:axis,separator:{color:ln},crosshair:{horizontal:ch,vertical:ch},
    candle:{tooltip:{text:{color:tx,size:11}},priceMark:{high:{color:tx},low:{color:tx}}},indicator:{tooltip:{text:{color:tx,size:11}}},
    overlay:{line:{color:GOLD,size:1},point:{color:light?"#ffffff":"#0b0c0e",borderColor:GOLD,borderSize:1.5,radius:4,activeColor:GOLD,activeBorderColor:hexA(GOLD,.25),activeBorderSize:5,activeRadius:4},
      rect:{color:hexA(GOLD,.12),borderColor:GOLD},polygon:{color:hexA(GOLD,.12),borderColor:GOLD},circle:{color:hexA(GOLD,.12),borderColor:GOLD},arc:{color:GOLD},
      text:{color:GOLD},rectText:{color:"#16120a",backgroundColor:GOLD,borderColor:GOLD}}};
}
const deep=(a,b)=>{for(const k in b){if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])){a[k]=deep(a[k]&&typeof a[k]==="object"?a[k]:{},b[k])}else a[k]=b[k]}return a};

/* ===================== Widget ===================== */
window.EAGTools={icon:(k,s)=>tsvg(k,s),name:k=>TNAME[k]||k};
window.EAGWidget=function(o){
  registerAll();
  const root=o.container;root.classList.add("eagw");
  root.innerHTML=`<div class="wbar"><button class="wsym" title="Cambiar mercado"><b></b>${svg("caret",12)}</button><button class="wtf" title="Todas las temporalidades"><b></b>${svg("caret",11)}</button><span class="wfav"></span><span class="wsp"></span>
      <button class="wb wmtf" data-a="mtf" title="Multitemporalidad de este gráfico" hidden>${svg("mtf",17)}<span>Multi-TF</span></button><button class="wb" data-a="ind" title="Indicadores">${svg("fx")}<span>Indicadores</span></button><button class="wb" data-a="cfg" title="Ajustes del gráfico">${svg("gear")}</button><button class="wb" data-a="shot" title="Captura (descargar imagen)">${svg("cam")}</button><button class="wb" data-a="full" title="Pantalla completa">${svg("full")}</button></div>
    <div class="wbody"><div class="dbar"></div><div class="wchart"><div class="wwm"><div class="wm-s"></div><div class="wm-b">EL ARTE GRÁFICO</div></div>
      <button class="wnavt" title="Mostrar u ocultar los botones de navegación">${svg("eye",15)}</button><div class="wnav"><button data-n="left" title="Mover a la izquierda">${svg("chevl",16)}</button><button data-n="right" title="Mover a la derecha">${svg("chevr",16)}</button><i></i><button data-n="reset" title="Volver al precio actual (zoom normal)">${svg("reset",16)}</button><button data-n="reload" title="Recargar el gráfico (si se traba)">${svg("reload",16)}</button></div></div></div>
    <div class="wfoot"><span class="wrng">${[["1D",1],["5D",5],["1M",30],["3M",90],["6M",180],["1A",365],["Todo",0]].map(([t,d])=>`<button data-d="${d}" title="${d?"Ver "+t:"Ver todo el historial cargado"}">${t}</button>`).join("")}</span><span class="wsp"></span>
      <span class="wcd" title="Tiempo para el cierre de la vela"></span><span class="wclk" title="Hora de Colombia (UTC-5)"></span><i class="wsep"></i><button class="wax" data-ax="percentage" title="Escala en porcentaje">%</button><button class="wax" data-ax="log" title="Escala logarítmica">log</button><button class="wax" data-ax="normal" title="Escala normal (automática)">auto</button></div>`;
  const $=s=>root.querySelector(s),chartEl=$(".wchart"),dbar=$(".dbar");
  const chart=KC.init(chartEl,{locale:"es-ES",timezone:o.timezone});(window.__eagCharts=window.__eagCharts||[]).push(chart);
  let sym=o.symbol,per=o.period,theme=o.theme||"dark",extra={},gen=0,subKey=null,ready=false,selId=null;
  const ind=Object.assign({main:[],sub:{},params:{}},o.indicators||{});ind.sub=ind.sub&&!Array.isArray(ind.sub)?ind.sub:{};
  const ovs=new Map(); // id -> definición guardable
  let magnet=o.magnet||"normal",locked=false,hidden=false;

  /* ---------- datos ---------- */
  const msOf=p=>p.multiplier*({minute:6e4,hour:36e5,day:864e5,week:6048e5}[p.timespan]||6e4);
  let noMore=false;
  /* escala de precios automática otra vez (si se estiró a mano, al cambiar de mercado quedaba congelada) */
  function autoScale(){try{const ax=chart._candlePane&&chart._candlePane.getAxisComponent();if(ax){ax._autoCalcTickFlag=true;chart.adjustPaneViewport(false,true,true,true)}}catch(e){}}
  async function loadData(){
    const g=++gen;ready=false;noMore=false;
    if(subKey){o.datafeed.unsubscribe(subKey.s,subKey.p);subKey=null}
    bulk=true;try{chart.clearData()}catch(e){}bulk=false;applyDec();
    paintBar();
    const to=Date.now(),from=to-msOf(per)*500;
    let list=await o.datafeed.getHistoryKLineData(sym,per,from,to);
    if(g!==gen)return;
    const seen=new Set();list=list.filter(k=>!seen.has(k.timestamp)&&seen.add(k.timestamp)).sort((x,y)=>x.timestamp-y.timestamp);
    chart.applyNewData(list,list.length>0);autoScale();ready=true;
    o.datafeed.subscribe(sym,per,d=>{if(g===gen)chart.updateData(d)});subKey={s:sym,p:per};
    restoreDrawings();
  }
  chart.setLoadDataCallback(async({type,data,callback})=>{
    if(type!=="forward"||!data){callback([],false);return}
    const g=gen,to=data.timestamp-1,from=to-msOf(per)*500;
    if(noMore){callback([],false);return}
    const raw=await o.datafeed.getHistoryKLineData(sym,per,from,to);
    if(g!==gen)return;
    /* solo velas más antiguas que la primera que ya está en el gráfico; si Deriv ya no tiene más, se deja de pedir */
    const first=data.timestamp,seen=new Set(),list=raw.filter(k=>k.timestamp<first&&!seen.has(k.timestamp)&&seen.add(k.timestamp)).sort((x,y)=>x.timestamp-y.timestamp);
    if(!list.length)noMore=true;
    callback(list,list.length>0)});

  /* ---------- barra superior ---------- */
  function paintBar(){
    $(".wsym b").textContent=sym.shortName||sym.name||sym.ticker;
    $(".wtf b").textContent=per.text;$(".wm-s").textContent=`${sym.name||sym.ticker}, ${per.text}`;const dtf=dbar.querySelector(".dtf b");if(dtf)dtf.textContent=per.text;
    const favs=(o.getFavTF&&o.getFavTF())||[];
    $(".wfav").innerHTML=favs.map(t=>`<button class="wp${t===per.text?" on":""}" data-t="${t}">${t}</button>`).join("");
    $(".wfav").querySelectorAll("button").forEach(b=>b.onclick=()=>o.onPickTF&&o.onPickTF(b.dataset.t))}
  $(".wsym").onclick=e=>{e.stopPropagation();o.onSymbolClick&&o.onSymbolClick()};
  $(".wtf").onclick=e=>{e.stopPropagation();o.onTFClick&&o.onTFClick($(".wtf"))};
  root.querySelector('[data-a="ind"]').onclick=e=>{e.stopPropagation();openInd()};
  root.querySelector('[data-a="mtf"]').onclick=e=>{e.stopPropagation();o.onToggleMtf&&o.onToggleMtf()};
  root.querySelector('[data-a="cfg"]').onclick=e=>{e.stopPropagation();o.onSettings&&o.onSettings(e.currentTarget)};
  root.querySelector('[data-a="shot"]').onclick=()=>{try{const bg=getComputedStyle(root).getPropertyValue("--chartbg").trim()||(theme==="light"?"#ffffff":"#0b0c0e");
    const url=chart.getConvertPictureUrl(true,"png",bg),a=document.createElement("a");a.href=url;a.download=`EAG_${sym.ticker}_${per.text}.png`;document.body.appendChild(a);a.click();a.remove()}catch(e){}};
  /* pantalla completa de toda la plataforma: se mantienen las barras que el usuario dejó visibles */
  root.querySelector('[data-a="full"]').onclick=()=>{const d=document,el=d.documentElement;
    if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}
    else{const f=el.requestFullscreen||el.webkitRequestFullscreen;if(f)f.call(el);else o.onFullscreenFallback&&o.onFullscreenFallback()}};
  const fsSync=()=>{const on=!!(document.fullscreenElement||document.webkitFullscreenElement),b=root.querySelector('[data-a="full"]');b.classList.toggle("on",on);b.title=on?"Salir de pantalla completa (Esc)":"Pantalla completa";b.innerHTML=svg(on?"unfull":"full")};
  document.addEventListener("fullscreenchange",fsSync);document.addEventListener("webkitfullscreenchange",fsSync);

  /* ---------- barra inferior: rangos, reloj, cierre de vela y escala ---------- */
  let axisType=o.axisType||"normal";
  root.querySelectorAll(".wrng button").forEach(b=>b.onclick=()=>{const L=chart.getDataList();if(!L.length)return;const days=+b.dataset.d,w=Math.max(100,chartEl.clientWidth-70);
    const bars=days?Math.min(L.length,Math.max(5,Math.round(days*864e5/msOf(per)))):L.length;
    try{chart.setBarSpace(Math.max(1,Math.min(40,w/bars)));chart.scrollToRealTime(250)}catch(e){}
    root.querySelectorAll(".wrng button").forEach(x=>x.classList.toggle("on",x===b));setTimeout(()=>b.classList.remove("on"),1500)});
  const paintAx=()=>root.querySelectorAll(".wax").forEach(x=>x.classList.toggle("on",x.dataset.ax===axisType));
  root.querySelectorAll(".wax").forEach(b=>b.onclick=()=>{if(b.dataset.ax==="normal")autoScale();axisType=axisType===b.dataset.ax&&b.dataset.ax!=="normal"?"normal":b.dataset.ax;applyStyles();paintAx();o.onAxisType&&o.onAxisType(axisType)});
  paintAx();
  const two=n=>String(n).padStart(2,"0"),cdEl=$(".wcd"),clkEl=$(".wclk");
  const tick=()=>{if(!root.isConnected)return clearInterval(clkT);const now=Date.now(),bog=new Date(now-5*36e5);
    clkEl.textContent=`${two(bog.getUTCHours())}:${two(bog.getUTCMinutes())}:${two(bog.getUTCSeconds())} (UTC-5)`;
    const L=chart.getDataList(),last=L[L.length-1];if(last){const left=Math.max(0,last.timestamp+msOf(per)-now),s2=Math.floor(left/1000),h=Math.floor(s2/3600),m=Math.floor(s2%3600/60);
      cdEl.textContent=`Cierra en ${h?h+":"+two(m):m}:${two(s2%60)}`;cdEl.classList.toggle("soon",left<10000)}};
  const clkT=setInterval(tick,1000);tick();
  /* cuenta regresiva del cierre de vela, debajo de la etiqueta del precio actual (como TradingView) */
  const cdl=document.createElement("div");cdl.className="wcdl";chartEl.appendChild(cdl);
  function placeCdl(){const L=chart.getDataList(),last=L[L.length-1];if(!last||!ready){cdl.hidden=true;return}
    try{const pt=chart.convertToPixel({timestamp:last.timestamp,value:last.close},{paneId:"candle_pane",absolute:true}),ya=chart.getSize("candle_pane","yAxis");
      if(!pt||!ya||pt.y==null||pt.y<0||pt.y>ya.height){cdl.hidden=true;return}
      const left=Math.max(0,last.timestamp+msOf(per)-Date.now()),s2=Math.floor(left/1000),h=Math.floor(s2/3600),m=Math.floor(s2%3600/60);
      cdl.textContent=h?`${h}:${two(m)}:${two(s2%60)}`:`${two(m)}:${two(s2%60)}`;
      const up=((extra.candle||{}).bar||{}).upColor||"#089981",dn=((extra.candle||{}).bar||{}).downColor||"#f23645";cdl.style.background=last.close>=last.open?up:dn;
      cdl.style.left=ya.left+"px";cdl.style.width=ya.width+"px";cdl.style.top=(pt.y+10)+"px";cdl.hidden=false}catch(e){cdl.hidden=true}}
  const cdlT=setInterval(()=>{if(!root.isConnected)return clearInterval(cdlT);placeCdl()},500);
  try{chart.subscribeAction("onScroll",placeCdl);chart.subscribeAction("onZoom",placeCdl)}catch(e){}

  /* ---------- navegación rápida (abajo al centro) ---------- */
  let bs0=null;setTimeout(()=>{try{bs0=chart.getBarSpace()}catch(e){}},0);
  {const wc=root.querySelector(".wnav").parentNode,nt=root.querySelector(".wnavt");let off=false;try{off=localStorage.getItem("eag_nav_off")==="1"}catch(e){}
    const paint=()=>{wc.classList.toggle("nonav",off);nt.innerHTML=svg(off?"eyeoff":"eye",15);nt.title=off?"Mostrar botones (mover, recargar)":"Ocultar botones (mover, recargar)"};paint();
    nt.onclick=e=>{e.stopPropagation();off=!off;try{localStorage.setItem("eag_nav_off",off?"1":"0")}catch(x){}document.querySelectorAll(".wchart").forEach(c=>{c.classList.toggle("nonav",off);const t=c.querySelector(".wnavt");if(t){t.innerHTML=svg(off?"eyeoff":"eye",15)}})};
    nt.addEventListener("pointerdown",e=>e.stopPropagation())}
  root.querySelectorAll(".wnav button").forEach(b=>b.onclick=e=>{e.stopPropagation();const n=b.dataset.n,w=chartEl.clientWidth;
    try{if(n==="left")chart.scrollByDistance(w*.35,250);else if(n==="right")chart.scrollByDistance(-w*.35,250);
      else if(n==="reset"){if(bs0)chart.setBarSpace(bs0);chart.scrollToRealTime(300);autoScale()}
      else if(n==="reload"){b.classList.add("spin");setTimeout(()=>b.classList.remove("spin"),900);if(bs0)chart.setBarSpace(bs0);loadData();o.onReload&&o.onReload()}}catch(x){}});

  /* ---------- barra de dibujo ---------- */
  const lastTool=Object.assign({},o.lastTools||{});
  let menu=null;const closeMenu=()=>{if(menu){menu.remove();menu=null}};
  /* cualquier clic o toque afuera cierra el menú del dibujo; fuera del gráfico también se quita la barra de estilo */
  const outside=e=>{const t=e.target;if(!t||!t.closest)return;
    if(menu&&!menu.contains(t)&&!t.closest(".dg .more")&&!t.closest(".dg>.dt"))closeMenu();
    if(!sbar.hidden&&!sbar.contains(t)&&!chartEl.contains(t)&&!(menu&&menu.contains(t))){hideStyleBar()}};
  ["pointerdown","mousedown","touchstart"].forEach(ev=>document.addEventListener(ev,outside,{capture:true,passive:true}));
  addEventListener("blur",()=>{if(menu&&!menu.classList.contains("panel"))closeMenu()});
  function paintDbar(){
    dbar.innerHTML=`<div class="dmini"><button class="dt dtf" title="Temporalidad (todas)"><b>${esc(per.text)}</b></button><button class="dt" data-mi="sym" title="Cambiar mercado">${svg("list",17)}</button><button class="dt" data-mi="ind" title="Indicadores">${svg("fx",17)}</button><i class="dsep"></i></div><button class="dt" data-k="cross" title="Cursor (cancelar dibujo)">${svg("cross",21)}</button><button class="dt" data-k="eagMeasure" title="Regla: medir puntos (también Shift + clic)">${tsvg("eagMeasure",22)}</button><button class="dt${brushOn?" act":""}" data-b="1" title="Pincel: dibuja o escribe a mano sobre el gráfico">${tsvg("eagBrush",22)}</button><i class="dsep"></i>`+
      TOOLS.map(g=>{const cur=lastTool[g.g]||g.items[0][0];return`<div class="dg" data-g="${g.g}"><button class="dt" data-k="${cur}" title="${esc(TNAME[cur])} · doble clic: ver todas">${tsvg(cur,22)}</button><button class="more" title="${esc(g.t)}">${svg("caret",9)}</button></div>`}).join("")+
      `<i class="dsep"></i><button class="dt tg${magnet!=="normal"?" on":""}" data-x="magnet" title="${magnet==="strong_magnet"?"Imán fuerte":magnet==="weak_magnet"?"Imán débil":"Imán apagado"}">${svg("magnet",21)}<em>${magnet==="strong_magnet"?"F":magnet==="weak_magnet"?"D":""}</em></button>
      <button class="dt tg${locked?" on":""}" data-x="lock" title="${locked?"Desbloquear dibujos":"Bloquear todos los dibujos"}">${svg(locked?"lock":"unlock",21)}</button>
      <button class="dt tg${hidden?" on":""}" data-x="hide" title="${hidden?"Mostrar dibujos":"Ocultar todos los dibujos"}">${svg(hidden?"eyeoff":"eye",21)}</button>
      <button class="dt" data-x="clear" title="Borrar todos los dibujos de este mercado">${svg("trash",21)}</button>`;
    dbar.querySelector(".dtf").onclick=e=>{e.stopPropagation();o.onTFClick&&o.onTFClick(e.currentTarget)};
    dbar.querySelector('[data-mi="sym"]').onclick=e=>{e.stopPropagation();o.onSymbolClick&&o.onSymbolClick(e.currentTarget)};
    dbar.querySelector('[data-mi="ind"]').onclick=e=>{e.stopPropagation();openInd()};
    dbar.querySelectorAll(".dt[data-k]").forEach(b=>b.onclick=()=>{stopBrush();b.dataset.k==="cross"?cancelDraw():startTool(b.dataset.k)});
    dbar.querySelector('[data-b]').onclick=()=>brushOn?stopBrush():startBrush();
    /* doble clic sobre un grupo: abre la lista completa */
    /* doble clic o doble toque (también en celular) */
    dbar.querySelectorAll(".dg>.dt").forEach(b=>{let lt=0;b.addEventListener("click",e=>{const n=Date.now();if(n-lt<380){e.stopImmediatePropagation();e.preventDefault();lt=0;cancelDraw();const g=TOOLS.find(x=>x.g===b.parentNode.dataset.g);openToolMenu(g,b.parentNode)}else lt=n},true)});
    dbar.querySelectorAll(".dg .more").forEach(b=>b.onclick=e=>{e.stopPropagation();const g=TOOLS.find(x=>x.g===b.parentNode.dataset.g);openToolMenu(g,b.parentNode)});
    /* mantener presionado o deslizar sobre el botón abre la lista; soltar sobre una herramienta la elige */
    dbar.querySelectorAll(".dg>.dt").forEach(b=>{
      let st=null,tm=null,opened=false;
      const open=()=>{if(opened)return;opened=true;clearTimeout(tm);const g=TOOLS.find(x=>x.g===b.parentNode.dataset.g);openToolMenu(g,b.parentNode);b.classList.add("hold")};
      b.addEventListener("pointerdown",e=>{if(e.button!==0)return;st={x:e.clientX,y:e.clientY};opened=false;tm=setTimeout(open,320);try{b.setPointerCapture(e.pointerId)}catch(x){}});
      b.addEventListener("pointermove",e=>{if(!st)return;if(e.pointerType!=="touch"&&Math.hypot(e.clientX-st.x,e.clientY-st.y)>8)open();
        if(opened&&menu){menu.querySelectorAll("button").forEach(x=>x.classList.remove("hov"));const t=document.elementFromPoint(e.clientX,e.clientY),it=t&&t.closest(".wmenu button");it&&it.classList.add("hov")}});
      b.addEventListener("pointerup",e=>{clearTimeout(tm);b.classList.remove("hold");if(!st)return;st=null;
        if(opened){const t=document.elementFromPoint(e.clientX,e.clientY),it=t&&t.closest(".wmenu button");if(it)it.click();b.dataset.skip="1";setTimeout(()=>delete b.dataset.skip,50)}});
      b.addEventListener("pointercancel",()=>{clearTimeout(tm);st=null;b.classList.remove("hold")});
      b.addEventListener("click",e=>{if(b.dataset.skip){e.stopImmediatePropagation();e.preventDefault()}},true)});
    dbar.querySelector('[data-x="magnet"]').onclick=()=>{magnet=magnet==="normal"?"weak_magnet":magnet==="weak_magnet"?"strong_magnet":"normal";ovs.forEach((v,id)=>chart.overrideOverlay({id,mode:magnet}));o.onMagnet&&o.onMagnet(magnet);paintDbar()};
    dbar.querySelector('[data-x="lock"]').onclick=()=>{locked=!locked;ovs.forEach((v,id)=>{v.lock=locked;chart.overrideOverlay({id,lock:locked})});persist();paintDbar()};
    dbar.querySelector('[data-x="hide"]').onclick=()=>{hidden=!hidden;ovs.forEach((v,id)=>chart.overrideOverlay({id,visible:!hidden}));paintDbar()};
    const cl=dbar.querySelector('[data-x="clear"]');cl.onclick=()=>{if(!ovs.size)return;if(!cl.classList.contains("confirm")){cl.classList.add("confirm");cl.title="Toca otra vez para borrar todo";setTimeout(()=>{cl.classList.remove("confirm");cl.title="Borrar todos los dibujos de este mercado"},2500);return}
      bulk=true;try{chart.removeOverlay()}catch(e){}bulk=false;ovs.clear();persist();hideStyleBar();paintDbar();setTimeout(renderAlerts,0)};
  }
  function openToolMenu(g,anchor){closeMenu();menu=document.createElement("div");menu.className="wmenu";
    const favs=(o.getToolFav&&o.getToolFav())||[];
    menu.innerHTML=`<div class="mt">${esc(g.t)}</div>`+g.items.map(([k,t])=>`<button data-k="${k}" class="${(lastTool[g.g]||g.items[0][0])===k?"on":""}">${tsvg(k,20)}<span>${esc(t)}</span><i class="tst${favs.includes(k)?" on":""}" data-fav="${k}" title="${favs.includes(k)?"Quitar de la barra de favoritos":"Agregar a la barra de favoritos"}">${favs.includes(k)?"★":"☆"}</i></button>`).join("");
    document.body.appendChild(menu);const r=anchor.getBoundingClientRect();menu.style.left=(r.right+6)+"px";menu.style.top=Math.min(r.top,innerHeight-menu.offsetHeight-8)+"px";
    menu.querySelectorAll("[data-fav]").forEach(f=>f.addEventListener("click",e=>{e.stopPropagation();o.onToolFav&&o.onToolFav(f.dataset.fav);const on=((o.getToolFav&&o.getToolFav())||[]).includes(f.dataset.fav);f.classList.toggle("on",on);f.textContent=on?"★":"☆"},true));
    menu.querySelectorAll("button").forEach(b=>b.onclick=()=>{lastTool[g.g]=b.dataset.k;o.onLastTools&&o.onLastTools(lastTool);closeMenu();paintDbar();startTool(b.dataset.k)})}
  let drawingId=null;
  /* ---------- pincel ---------- */
  let brushOn=false,brushEl=null;
  function startBrush(){cancelDraw();if(brushOn)return;brushOn=true;setTimeout(syncPan,0);
    brushEl=document.createElement("canvas");brushEl.className="wbrush";chartEl.appendChild(brushEl);
    const fit=()=>{const r=chartEl.getBoundingClientRect(),d=devicePixelRatio||1;brushEl.width=r.width*d;brushEl.height=r.height*d;brushEl.style.width=r.width+"px";brushEl.style.height=r.height+"px"};fit();
    const cx=brushEl.getContext("2d");let pts=null;
    const pos=e=>{const r=brushEl.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
    brushEl.onpointerdown=e=>{if(e.button===2){stopBrush();return}e.preventDefault();try{brushEl.setPointerCapture(e.pointerId)}catch(x){}pts=[pos(e)];const d=devicePixelRatio||1;
      const bs=((o.getToolStyle&&o.getToolStyle("eagBrush"))||{}).ex||{};cx.setTransform(d,0,0,d,0,0);cx.strokeStyle=bs.color||GOLD;cx.lineWidth=bs.size||2;cx.lineCap="round";cx.lineJoin="round";cx.beginPath();cx.moveTo(pts[0].x,pts[0].y)};
    brushEl.onpointermove=e=>{if(!pts)return;const p=pos(e),l=pts[pts.length-1];if(Math.hypot(p.x-l.x,p.y-l.y)<2.5)return;pts.push(p);cx.lineTo(p.x,p.y);cx.stroke()};
    brushEl.onpointerup=()=>{if(!pts)return;const P=pts;pts=null;cx.clearRect(0,0,brushEl.width,brushEl.height);if(P.length<2)return;
      let step=Math.ceil(P.length/300);const sel=P.filter((p,i)=>i%step===0||i===P.length-1);
      let conv=[];try{conv=chart.convertFromPixel(sel,{paneId:"candle_pane"})}catch(x){}
      const points=(conv||[]).map(c=>({timestamp:tsOf(c),value:c.value})).filter(p=>isFinite(p.value)&&p.timestamp);
      if(points.length<2)return;const bs2=((o.getToolStyle&&o.getToolStyle("eagBrush"))||{}).ex||{};const id=makeOverlay({name:"eagBrush",points,extendData:{color:bs2.color||GOLD,size:bs2.size||2}},false);if(id){const v=ovs.get(id);v.done=true;v.points=points;persist()}};
    brushEl.oncontextmenu=e=>{e.preventDefault();stopBrush()};
    dbar.querySelector("[data-b]")&&dbar.querySelector("[data-b]").classList.add("act");o.onToast&&o.onToast("✏️ Pincel activo: dibuja o escribe sobre el gráfico. Esc o clic derecho para salir.")}
  function stopBrush(){if(!brushOn)return;brushOn=false;setTimeout(syncPan,0);if(brushEl){brushEl.remove();brushEl=null}const b=dbar.querySelector("[data-b]");b&&b.classList.remove("act")}
  /* mientras dibujas o tienes un dibujo seleccionado, el gráfico no se mueve (así se coloca mejor, sobre todo en celular) */
  let panLocked=false;
  function syncPan(){const lock=!!(drawingId||selId||brushOn);if(lock===panLocked)return;panLocked=lock;try{chart.setScrollEnabled(!lock);chart.setZoomEnabled(!lock)}catch(e){}chartEl.classList.toggle("locked",lock)}
  function cancelDraw(){if(drawingId){try{chart.removeOverlay(drawingId)}catch(e){}ovs.delete(drawingId);drawingId=null}dbar.querySelectorAll(".dt").forEach(b=>b.classList.remove("act"));syncPan()}
  function startTool(name){cancelDraw();
    const ts=(o.getToolStyle&&o.getToolStyle(name))||{};
    const ex=Object.assign(name==="eagText"?{text:"Texto"}:{},ts.ex||{});
    const id=makeOverlay({name,extendData:Object.keys(ex).length?ex:undefined,styles:ts.styles||undefined},true);if(!id)return;drawingId=id;syncPan();
    dbar.querySelectorAll(".dt[data-k]").forEach(b=>b.classList.toggle("act",b.dataset.k===name))}
  function makeOverlay(def,drawing){
    if(!drawing&&BOX.test(def.name)&&def.points&&def.points.length===2)def=Object.assign({},def,{points:boxPts(def.points[0],def.points[1]).map(p=>({timestamp:p.timestamp,value:p.value}))});
    const id=chart.createOverlay({name:def.name,points:def.points,styles:def.styles,extendData:def.extendData,lock:!!def.lock,visible:!hidden,mode:magnet,
      onDrawEnd:e=>{drawingId=null;dbar.querySelectorAll(".dt").forEach(b=>b.classList.remove("act"));setTimeout(syncPan,0);
        if((e.overlay.name==="eagLong"||e.overlay.name==="eagShort")&&e.overlay.points.length<3)autoPos(e.overlay);
        if(BOX.test(e.overlay.name)&&e.overlay.points.length<8&&e.overlay.points.length>=2){const ps=e.overlay.points;chart.overrideOverlay({id:e.overlay.id,points:boxPts({timestamp:tsOf(ps[0]),dataIndex:ps[0].dataIndex,value:ps[0].value},{timestamp:tsOf(ps[1]),dataIndex:ps[1].dataIndex,value:ps[1].value})})}
        capture(chart.getOverlayById(e.overlay.id)||e.overlay);if(e.overlay.name==="eagText")setTimeout(()=>editText(e.overlay.id),30);return false},
      onPressedMoveStart:()=>{movingOv=true;return false},
      onPressedMoveEnd:e=>{movingOv=false;capture(e.overlay);return false},
      onSelected:e=>{selId=e.overlay.id;showStyleBar(e.overlay.id);syncPan();return false},
      onDeselected:e=>{if(selId===e.overlay.id){selId=null;hideStyleBar()}syncPan();return false},
      onRemoved:e=>{if(bulk)return false;ovs.delete(e.overlay.id);if(selId===e.overlay.id){selId=null;hideStyleBar()}persist();return false},
      onDoubleClick:e=>{if(e.overlay.id!==drawingId)openCtx(e.overlay.id,e,true);return false},
      onRightClick:e=>{try{if(e.overlay.id===drawingId){cancelDraw();return true}openCtx(e.overlay.id,e)}catch(x){}return true}});
    if(id){ovs.set(id,{name:def.name,styles:def.styles||null,extendData:def.extendData||null,lock:!!def.lock,points:def.points||null});if(!drawing)ovs.get(id).done=true}
    return id}
  /* stop y objetivo automáticos (1:2) según el rango reciente del gráfico */
  /* tiempo de un punto aunque esté antes de la primera vela o después de la última */
  function tsOf(p){if(p.timestamp)return p.timestamp;const L=chart.getDataList(),ms=msOf(per);if(!L.length)return Date.now();
    const i=p.dataIndex!=null?p.dataIndex:L.length-1;if(i<0)return L[0].timestamp+i*ms;if(i>L.length-1)return L[L.length-1].timestamp+(i-(L.length-1))*ms;return L[i].timestamp}
  /* stop y objetivo automáticos (1:2) proporcionales a lo que se ve en pantalla */
  function autoPos(ov){const L=chart.getDataList();if(!L.length)return;const p0=ov.points[0];
    let vr={from:Math.max(0,L.length-80),to:L.length};try{const r=chart.getVisibleRange();if(r&&r.to>r.from)vr=r}catch(e){}
    const seg=L.slice(Math.max(0,vr.from),Math.min(L.length,vr.to));let hi=-Infinity,lo=Infinity;seg.forEach(k=>{hi=Math.max(hi,k.high);lo=Math.min(lo,k.low)});
    if(!isFinite(hi)){hi=p0.value*1.002;lo=p0.value*.998}
    const d=Math.max((hi-lo)*.1,Math.abs(p0.value)*.0003),long=ov.name==="eagLong";
    const bars=Math.max(8,Math.round((vr.to-vr.from)*.16)),t0=tsOf(p0),ts=t0+bars*msOf(per);
    const pts=[{timestamp:t0,value:p0.value},{timestamp:ts,value:long?p0.value-d:p0.value+d},{timestamp:ts,value:long?p0.value+2*d:p0.value-2*d}];
    chart.overrideOverlay({id:ov.id,points:pts})}
  function capture(ov){const v=ovs.get(ov.id);if(!v)return;v.points=(ov.points||[]).map(p=>({timestamp:tsOf(p),value:p.value}));v.done=true;v.lock=!!ov.lock;persist()}
  /* guardado por mercado (todas las temporalidades), como en TradingView */
  /* deshacer / rehacer: historial de los dibujos de este mercado */
  let hist=[],fut=[],snap="[]",bulk=false;
  function persist(){if(!sym)return;const all=loadD();const arr=[];ovs.forEach(v=>{if(v.done&&v.points&&v.points.length)arr.push({name:v.name,points:v.points,styles:v.styles,extendData:v.extendData,lock:v.lock})});
    const ns=JSON.stringify(arr);if(ns!==snap){hist.push(snap);if(hist.length>60)hist.shift();fut=[];snap=ns}
    if(arr.length)all[sym.ticker]=arr;else delete all[sym.ticker];saveD(all);o.onDrawingsChange&&o.onDrawingsChange(sym.ticker)}
  function applySnap(ns){const all=loadD(),arr=JSON.parse(ns);if(arr.length)all[sym.ticker]=arr;else delete all[sym.ticker];saveD(all);snap=ns;restoreDrawings(true);o.onDrawingsChange&&o.onDrawingsChange(sym.ticker)}
  function undo(){if(!hist.length)return false;fut.push(snap);applySnap(hist.pop());return true}
  function redo(){if(!fut.length)return false;hist.push(snap);applySnap(fut.pop());return true}
  function restoreDrawings(keepHist){selId=null;setTimeout(syncPan,0);bulk=true;try{chart.removeOverlay()}catch(e){}bulk=false;ovs.clear();hideStyleBar();
    if(!keepHist){hist=[];fut=[];snap=JSON.stringify(loadD()[sym.ticker]||[])}
    setTimeout(renderAlerts,0);
    (loadD()[sym.ticker]||[]).forEach(d=>{if(d.points&&d.points.every(p=>p.timestamp))makeOverlay(d,false)})}
  o.reloadDrawings=()=>{if(ready)restoreDrawings()};
  /* alertas de este mercado dibujadas como líneas naranjas punteadas */
  let alertIds=[];
  function renderAlerts(){alertIds.forEach(id=>{try{chart.removeOverlay(id)}catch(e){}});alertIds=[];if(!ready||!o.getAlerts)return;
    const L=chart.getDataList(),last=L[L.length-1];if(!last)return;const pp=sym.pricePrecision||3;
    (o.getAlerts(sym.ticker)||[]).forEach(a=>{const vals=a.kind==="zona"&&a.price2!=null?[+a.price,+a.price2]:[+a.price];
      vals.forEach((v,k)=>{const id=chart.createOverlay({name:"eagAlert",lock:true,onRightClick:()=>true,points:[{timestamp:last.timestamp,value:v}],extendData:{label:(a.kind==="zona"?(k?"Zona (abajo) ":"Zona (arriba) "):"Alerta ")+v.toFixed(pp)+(a.note?" · "+a.note:"")}});if(id)alertIds.push(id)})})}

  /* ---------- personalizar un dibujo: barra flotante + clic derecho ---------- */
  const sbar=document.createElement("div");sbar.className="wstyle";sbar.hidden=true;chartEl.appendChild(sbar);
  const isFill=n=>/^(rect|circle|triangle|parallelogram|eagZone|eagRect|fibonacciCircle|gannBox)$/.test(n);
  const curStyle=id=>{const v=ovs.get(id)||{},s=v.styles||{},isTxt=v.name==="eagText"||BOX.test(v.name)||v.name==="eagBrush";
    return{color:isTxt?((v.extendData||{}).color||GOLD):((s.line&&s.line.color)||(s.polygon&&s.polygon.borderColor)||GOLD),size:(v.name==="eagBrush"||BOX.test(v.name))?((v.extendData||{}).size||(v.name==="eagBrush"||/Buy|Sell/.test(v.name)?2:1)):((s.line&&s.line.size)||(s.polygon&&s.polygon.borderSize)||1),
      dash:(s.line&&s.line.style)==="dashed"?((s.line.dashedValue||[4,4])[0]<=2?"dot":"dash"):"solid",fill:s.polygon?s.polygon.color:null}};
  function setStyle(id,ch){const v=ovs.get(id);if(!v)return;const c=Object.assign(curStyle(id),ch);
    if(v.name==="eagText"||BOX.test(v.name)||v.name==="eagBrush"||/^eag(Position|Long|Short)$/.test(v.name)){v.extendData=Object.assign({},v.extendData||{},/^eag(Position|Long|Short)$/.test(v.name)?{}:{color:c.color});if(ch.size&&v.name==="eagText")v.extendData.size=10+ch.size*2;if(ch.size&&(v.name==="eagBrush"||BOX.test(v.name)))v.extendData.size=ch.size;if(ch.fill!==undefined&&BOX.test(v.name))v.extendData.fill=ch.fill;chart.overrideOverlay({id,extendData:v.extendData})}
    else{const st={line:{color:c.color,size:c.size,style:c.dash==="solid"?"solid":"dashed",dashedValue:c.dash==="dot"?[1,3]:[5,4]},
        polygon:{borderColor:c.color,borderSize:c.size,borderStyle:c.dash==="solid"?"solid":"dashed",color:c.fill!=null?c.fill:hexA(c.color,.14)},
        rect:{borderColor:c.color,borderSize:c.size,color:c.fill!=null?c.fill:hexA(c.color,.14)},circle:{borderColor:c.color,borderSize:c.size,color:c.fill!=null?c.fill:hexA(c.color,.14)},
        arc:{color:c.color,size:c.size},text:{color:c.color},rectText:{backgroundColor:c.color,borderColor:c.color}};
      v.styles=st;chart.overrideOverlay({id,styles:st})}
    persist();if(!sbar.hidden)showStyleBar(id);
    /* recordar el estilo para los próximos dibujos de esta herramienta */
    if(o.onToolStyle){const ex={};const e2=v.extendData||{};["color","size","up","dn"].forEach(k=>{if(e2[k]!=null)ex[k]=e2[k]});o.onToolStyle(v.name,{styles:v.styles||null,ex})}}
  const alertable=v=>/^(horizontalStraightLine|horizontalRayLine|horizontalSegment|priceLine|eagZone|eagRect|eagBuyZone|eagSellZone|rect|segment|rayLine|straightLine)$/.test(v.name)&&v.points&&v.points.length;
  function alertFrom(id){const v=ovs.get(id);if(!v||!o.onCreateAlert)return;const ps=v.points.map(p=>p.value),pp=sym.pricePrecision||3,r=x=>+(+x).toFixed(pp);
    const zone=/^(eagZone|eagRect|eagBuyZone|eagSellZone|rect)$/.test(v.name)&&ps.length>1;
    /* para líneas inclinadas se usa el precio del punto más reciente */
    const price=zone?Math.max(...ps):(/^(segment|rayLine|straightLine)$/.test(v.name)?ps[ps.length-1]:ps[0]);
    o.onCreateAlert({symbol:sym.ticker,symbol_name:sym.name||sym.ticker,kind:zone?"zona":"nivel",price:r(price),price2:zone?r(Math.min(...ps)):null})}
  function removeOv(id){try{chart.removeOverlay(id)}catch(e){}ovs.delete(id);if(selId===id)selId=null;persist();hideStyleBar();closeMenu();syncPan()}
  function dupOv(id){const v=ovs.get(id);if(!v||!v.points)return;const L=chart.getDataList(),last=L[L.length-1],first=L[0],shift=(last&&first&&L.length>2)?(L[1].timestamp-L[0].timestamp)*5:0;
    const d=JSON.parse(JSON.stringify(v));d.points=d.points.map(p=>({timestamp:p.timestamp+shift,value:p.value}));const nid=makeOverlay(d,false);if(nid){ovs.get(nid).done=true;persist()}}
  function toggleLock(id){const v=ovs.get(id);if(!v)return;v.lock=!v.lock;chart.overrideOverlay({id,lock:v.lock});persist();if(!sbar.hidden)showStyleBar(id)}
  function showStyleBar(id){const v=ovs.get(id);if(!v)return;const c=curStyle(id);
    sbar.innerHTML=`<span class="sn">${tsvg(v.name,16)}${esc(TNAME[v.name]||v.name)}</span><label class="cc" title="Color"><i style="background:${c.color}"></i><input type="color" value="${/^#/.test(c.color)?c.color.slice(0,7):GOLD}"></label>
      ${/^eag(Position|Long|Short)$/.test(v.name)?"":`<select title="Grosor">${[1,2,3,4].map(n=>`<option value="${n}" ${+c.size===n?"selected":""}>${n}px</option>`).join("")}</select>
      <select title="Tipo de línea"><option value="solid" ${c.dash==="solid"?"selected":""}>━ Sólida</option><option value="dash" ${c.dash==="dash"?"selected":""}>╍ Guiones</option><option value="dot" ${c.dash==="dot"?"selected":""}>┈ Puntos</option></select>`}
      ${v.name==="eagText"||v.name==="eagZone"?`<button data-a="txt" title="Editar texto">Aa</button>`:""}
      ${alertable(v)?`<button data-a="alert" title="Crear alerta en este nivel">🔔</button>`:""}<button data-a="lock" title="${v.lock?"Desbloquear":"Bloquear"}">${svg(v.lock?"lock":"unlock",16)}</button><button data-a="dup" title="Duplicar">${svg("copy",16)}</button><button data-a="del" title="Eliminar (Supr)">${svg("trash",16)}</button>`;
    sbar.hidden=false;
    sbar.querySelector("input[type=color]").oninput=e=>{sbar.querySelector(".cc i").style.background=e.target.value};
    sbar.querySelector("input[type=color]").onchange=e=>setStyle(id,{color:e.target.value,fill:null});
    const sels=sbar.querySelectorAll("select");if(sels[0])sels[0].onchange=e=>setStyle(id,{size:+e.target.value});if(sels[1])sels[1].onchange=e=>setStyle(id,{dash:e.target.value});
    const tb=sbar.querySelector('[data-a="txt"]');tb&&(tb.onclick=()=>editText(id));
    sbar.querySelector('[data-a="lock"]').onclick=()=>toggleLock(id);const ab=sbar.querySelector('[data-a="alert"]');ab&&(ab.onclick=()=>alertFrom(id));sbar.querySelector('[data-a="dup"]').onclick=()=>dupOv(id);sbar.querySelector('[data-a="del"]').onclick=()=>removeOv(id)}
  function hideStyleBar(){sbar.hidden=true}
  /* menú de clic derecho sobre un dibujo */
  let panelPos=null;
  function openCtx(id,e,panel){const prev=menu&&menu.classList.contains("panel")?{x:menu.offsetLeft,y:menu.offsetTop}:null;closeMenu();const v=ovs.get(id);if(!v)return;selId=id;showStyleBar(id);const c=curStyle(id);
    const again=()=>openCtx(id,e,panel);
    menu=document.createElement("div");menu.className="wmenu ctx"+(panel?" panel":"");
    const isTxt=v.name==="eagText"||v.name==="eagZone"||v.name==="eagRect";
    menu.innerHTML=(panel?`<div class="ph2"><span class="mti">${tsvg(v.name,16)}<b>${esc(TNAME[v.name]||v.name)}</b></span><button class="px" title="Cerrar">×</button></div>`:`<div class="mt mti">${tsvg(v.name,15)}${esc(TNAME[v.name]||v.name)}</div>`)+
      (panel&&isTxt?`<div class="ml">Texto</div><div class="mrow"><input class="ptxt" maxlength="80" value="${esc((v.extendData||{}).text||"")}" placeholder="Escribe aquí"></div>`:"")+`
      <div class="mrow">${COLORS.map(k=>`<button class="sw${c.color===k?" on":""}" data-c="${k}" style="background:${k}" title="${k}"></button>`).join("")}<label class="sw pick" title="Otro color">+<input type="color" value="${/^#/.test(c.color)?c.color.slice(0,7):GOLD}"></label></div>
      ${/^eag(Position|Long|Short)$/.test(v.name)?"":`<div class="ml">Grosor</div><div class="mrow">${[1,2,3,4].map(n=>`<button class="wd${+c.size===n?" on":""}" data-w="${n}" title="${n}px"><i style="height:${n}px"></i></button>`).join("")}</div>
      <div class="ml">Línea</div><div class="mrow">${[["solid","Sólida"],["dash","Guiones"],["dot","Puntos"]].map(([k,t])=>`<button class="ls${c.dash===k?" on":""}" data-d="${k}" title="${t}"><i class="${k}"></i></button>`).join("")}</div>`}
      ${isFill(v.name)?`<div class="ml">Relleno</div><div class="mrow">${[0,.08,.16,.3,.5].map(a=>`<button class="fa" data-f="${a}" title="${Math.round(a*100)}%"><i style="background:${hexA(c.color,a||.0001)};${a?"":"border:1px dashed var(--dim)"}"></i></button>`).join("")}</div>`:""}
      <div class="msep"></div>
      ${isTxt&&!panel?`<button class="mi" data-a="txt">Editar texto…</button>`:""}
      ${alertable(v)?`<button class="mi" data-a="alert">🔔 Crear alerta aquí…</button>`:""}
      <button class="mi" data-a="lock">${v.lock?"Desbloquear":"Bloquear"}</button><button class="mi" data-a="dup">Duplicar</button>
      <button class="mi" data-a="hide">Ocultar este dibujo</button><button class="mi danger" data-a="del">Eliminar</button>`;
    document.body.appendChild(menu);
    const r=chartEl.getBoundingClientRect();let x=r.left+((e&&e.x)||40)+(panel?16:0),y=r.top+((e&&e.y)||40);
    if(panel&&(prev||panelPos)){x=(prev||panelPos).x;y=(prev||panelPos).y}
    menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+"px";menu.style.top=Math.max(safeTop()+8,Math.min(y,innerHeight-menu.offsetHeight-8))+"px";
    if(panel){const h=menu.querySelector(".ph2");menu.querySelector(".px").onclick=()=>closeMenu();
      h.addEventListener("pointerdown",ev=>{if(ev.target.closest(".px"))return;ev.preventDefault();const dx=ev.clientX-menu.offsetLeft,dy=ev.clientY-menu.offsetTop;try{h.setPointerCapture(ev.pointerId)}catch(x){}
        const mv=m=>{const st=safeTop(),nx=Math.max(0,Math.min(innerWidth-60,m.clientX-dx)),ny=Math.max(st+4,Math.min(innerHeight-40,m.clientY-dy));menu.style.left=nx+"px";menu.style.top=ny+"px";panelPos={x:nx,y:ny}};
        const up=()=>{h.removeEventListener("pointermove",mv);h.removeEventListener("pointerup",up)};h.addEventListener("pointermove",mv);h.addEventListener("pointerup",up)});
      const pt=menu.querySelector(".ptxt");pt&&(pt.onkeydown=ev=>ev.stopPropagation(),pt.onchange=()=>{v.extendData=Object.assign({},v.extendData||{},{text:pt.value.trim()||(v.name==="eagText"?"Texto":"")});chart.overrideOverlay({id,extendData:v.extendData});persist()})}
    menu.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{setStyle(id,{color:b.dataset.c,fill:null});again()});
    menu.querySelector(".pick input").onchange=ev=>{setStyle(id,{color:ev.target.value,fill:null});again()};
    menu.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{setStyle(id,{size:+b.dataset.w});again()});
    menu.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{setStyle(id,{dash:b.dataset.d});again()});
    menu.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{setStyle(id,{fill:hexA(curStyle(id).color,+b.dataset.f)});again()});
    menu.querySelectorAll(".mi").forEach(b=>b.onclick=()=>{const a=b.dataset.a;if(!(panel&&(a==="lock")))closeMenu();
      if(a==="alert")alertFrom(id);else if(a==="txt")editText(id);else if(a==="lock"){toggleLock(id);if(panel)again()}else if(a==="dup")dupOv(id);else if(a==="hide"){chart.overrideOverlay({id,visible:false});hideStyleBar()}else if(a==="del")removeOv(id)})}
  /* editar texto en el mismo gráfico (sin ventanas del navegador) */
  function editText(id){const v=ovs.get(id),ov=chart.getOverlayById(id);if(!v||!ov||!ov.points[0])return;
    const px=chart.convertToPixel({timestamp:ov.points[0].timestamp,value:ov.points[0].value},{paneId:"candle_pane"})||{x:40,y:40};
    const box=document.createElement("div");box.className="wtxt";box.innerHTML=`<input type="text" maxlength="80" value="${esc((v.extendData||{}).text||"")}" placeholder="Escribe y presiona Enter">`;
    chartEl.appendChild(box);box.style.left=Math.max(4,Math.min(px.x,chartEl.clientWidth-230))+"px";box.style.top=Math.max(4,px.y-16)+"px";
    const inp=box.querySelector("input");inp.focus();inp.select();
    const done=ok=>{if(!box.isConnected)return;if(ok){v.extendData=Object.assign({},v.extendData||{},{text:inp.value.trim()||(v.name==="eagText"?"Texto":"")});chart.overrideOverlay({id,extendData:v.extendData});persist()}box.remove()};
    inp.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter")done(true);if(e.key==="Escape")done(false)};inp.onblur=()=>done(true)}
  root.tabIndex=-1;
  root.addEventListener("keydown",e=>{if((e.key==="Delete"||e.key==="Backspace")&&selId&&!/input|select|textarea/i.test(e.target.tagName)){removeOv(selId);selId=null}if(e.key==="Escape"){cancelDraw();closeMenu();stopBrush()}});
  chartEl.addEventListener("contextmenu",e=>{e.preventDefault();if(drawingId){cancelDraw();o.onToast&&o.onToast("Herramienta cancelada")}});
  /* escala de precios con el dedo: arrastra arriba/abajo sobre los números de la derecha para estirar o encoger */
  let yDrag=null;
  chartEl.addEventListener("touchstart",e=>{if(e.touches.length!==1)return;let ya;try{ya=chart.getSize("candle_pane","yAxis")}catch(x){return}if(!ya)return;
    const r=chartEl.getBoundingClientRect(),x=e.touches[0].clientX-r.left,y=e.touches[0].clientY-r.top;
    if(x<ya.left||x>ya.left+ya.width||y>ya.height)return;const ax=chart._candlePane&&chart._candlePane.getAxisComponent();if(!ax||!ax._range)return;
    yDrag={y0:e.touches[0].clientY,ax,r0:Object.assign({},ax._range)};e.preventDefault();e.stopPropagation()},{capture:true,passive:false});
  chartEl.addEventListener("touchmove",e=>{if(!yDrag)return;e.preventDefault();e.stopPropagation();const dy=e.touches[0].clientY-yDrag.y0,k=Math.max(.2,Math.min(5,Math.exp(dy/180)));
    const r0=yDrag.r0,mid=(r0.from+r0.to)/2,half=(r0.to-r0.from)/2*k,from=mid-half,to=mid+half;
    yDrag.ax._autoCalcTickFlag=false;yDrag.ax._range=Object.assign({},r0,{from,to,range:to-from,realFrom:from,realTo:to,realRange:to-from});try{chart.adjustPaneViewport(false,true,true,true)}catch(x){}},{capture:true,passive:false});
  chartEl.addEventListener("touchend",()=>{yDrag=null},{capture:true});
  /* mover el gráfico hacia arriba y abajo arrastrando (dedo o mouse), como TradingView */
  let vpan=null,movingOv=false;
  chartEl.addEventListener("pointerdown",e=>{if(e.button!==0||drawingId||brushOn||selId||e.shiftKey)return;let ya;try{ya=chart.getSize("candle_pane","yAxis")}catch(x){return}if(!ya)return;
    const r=chartEl.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(x>=ya.left||y>ya.height)return;
    const ax=chart._candlePane&&chart._candlePane.getAxisComponent();if(!ax||!ax._range)return;
    vpan={x0:e.clientX,y0:e.clientY,ax,h:ya.height,r0:Object.assign({},ax._range),on:false}},true);
  addEventListener("pointermove",e=>{const v=vpan;if(!v||movingOv)return;const dy=e.clientY-v.y0,dx=e.clientX-v.x0;
    if(!v.on){if(Math.abs(dy)<10)return;if(Math.abs(dy)<Math.abs(dx)*.5){vpan=null;return}v.on=true}
    const r0=v.r0,sh=dy*(r0.to-r0.from)/Math.max(1,v.h),from=r0.from+sh,to=r0.to+sh;
    v.ax._autoCalcTickFlag=false;v.ax._range=Object.assign({},r0,{from,to,range:to-from,realFrom:from,realTo:to,realRange:to-from});try{chart.adjustPaneViewport(false,true,true,true)}catch(x){}});
  ["pointerup","pointercancel"].forEach(t=>addEventListener(t,()=>{vpan=null}));
  /* Shift + clic: regla rápida, como en TradingView */
  chartEl.addEventListener("pointerdown",e=>{if(e.shiftKey&&!drawingId&&e.button===0)startTool("eagMeasure")},true);

  /* ---------- indicadores ---------- */
  function addInd(name,where,silent){const params=ind.params[name];
    if(where==="main"){if(!ind.main.includes(name))ind.main.push(name);chart.createIndicator(params?{name,calcParams:params}:name,true,{id:"candle_pane"})}
    else{if(ind.sub[name])return;const pid=chart.createIndicator(params?{name,calcParams:params}:name,false,{height:110,dragEnabled:true});ind.sub[name]=pid}
    if(!silent)o.onIndicators&&o.onIndicators(dump())}
  function rmInd(name,where){if(where==="main"){chart.removeIndicator("candle_pane",name);ind.main=ind.main.filter(x=>x!==name)}else{const pid=ind.sub[name];if(pid)chart.removeIndicator(pid,name);delete ind.sub[name]}o.onIndicators&&o.onIndicators(dump())}
  const dump=()=>({main:ind.main.slice(),sub:Object.keys(ind.sub),params:Object.assign({},ind.params)});
  function setParams(name,where,arr){ind.params[name]=arr;try{chart.overrideIndicator({name,calcParams:arr},where==="main"?"candle_pane":ind.sub[name])}catch(e){}o.onIndicators&&o.onIndicators(dump())}
  function openInd(){
    const ov=document.createElement("div");ov.className="wmodal";
    const render=qs=>{const q=(qs||"").toLowerCase();
      const on=(n,w)=>w==="main"?ind.main.includes(n):!!ind.sub[n];
      const rows=IND.filter(([n,t])=>!q||t.toLowerCase().includes(q)||n.toLowerCase().includes(q));
      const act=IND.filter(([n,,w])=>on(n,w));
      return`<div class="mh"><b>Indicadores</b><button class="x" data-a="close">×</button></div><input class="mq" placeholder="Buscar indicador…" value="${esc(qs||"")}">
        ${act.length?`<div class="ml">En el gráfico</div>`+act.map(([n,t,w])=>{let cp="";try{const i=chart.getIndicatorByPaneId(w==="main"?"candle_pane":ind.sub[n],n);cp=(i&&i.calcParams||[]).join(", ")}catch(e){}
          return`<div class="ir act"><span>${esc(t)}</span><input class="ip" data-n="${n}" data-w="${w}" value="${esc(cp)}" title="Parámetros (separados por coma)"><button class="x" data-rm="${n}" data-w="${w}" title="Quitar">×</button></div>`}).join(""):""}
        <div class="ml">Superpuestos al precio</div>${rows.filter(r=>r[2]==="main").map(([n,t,w])=>`<button class="ir${on(n,w)?" on":""}" data-add="${n}" data-w="${w}"><span>${esc(t)}</span><em>${on(n,w)?"✓":"+"}</em></button>`).join("")}
        <div class="ml">En panel inferior</div>${rows.filter(r=>r[2]==="sub").map(([n,t,w])=>`<button class="ir${on(n,w)?" on":""}" data-add="${n}" data-w="${w}"><span>${esc(t)}</span><em>${on(n,w)?"✓":"+"}</em></button>`).join("")}`};
    const box=document.createElement("div");box.className="wmbox";ov.appendChild(box);
    const draw=qs=>{box.innerHTML=render(qs);const mq=box.querySelector(".mq");mq.oninput=()=>{const p=mq.selectionStart;draw(mq.value);const m=box.querySelector(".mq");m.focus();m.setSelectionRange(p,p)};
      box.querySelector('[data-a="close"]').onclick=()=>ov.remove();
      box.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{const n=b.dataset.add,w=b.dataset.w;(w==="main"?ind.main.includes(n):ind.sub[n])?rmInd(n,w):addInd(n,w);draw(mq.value)});
      box.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{rmInd(b.dataset.rm,b.dataset.w);draw(mq.value)});
      box.querySelectorAll(".ip").forEach(i=>i.onchange=()=>{const arr=i.value.split(/[,\s]+/).map(Number).filter(x=>isFinite(x)&&x>0);if(arr.length)setParams(i.dataset.n,i.dataset.w,arr)})};
    draw("");ov.onclick=e=>{if(e.target===ov)ov.remove()};document.body.appendChild(ov);box.querySelector(".mq").focus()}

  /* ---------- tema y estilos ---------- */
  /* leyenda de una línea como TradingView: mercado · temporalidad · O H L C y cambio */
  function legend(){const light=theme==="light",tx=light?"#5c616b":"#9da1aa",up=((extra.candle||{}).bar||{}).upColor||"#089981",dn=((extra.candle||{}).bar||{}).downColor||"#f23645",fg=light?"#15171c":"#ececee";
    return(d)=>{const c=d.current;if(!c)return[];const p=d.prev||c,col=c.close>=c.open?up:dn,pp=dec(),f=v=>(+v).toFixed(pp),ch=c.close-p.close,pc=p.close?ch/p.close*100:0;
      if(chartEl.clientWidth<520)return[{title:{text:`${sym.shortName||sym.name||sym.ticker} · ${per.text}`,color:fg},value:{text:"",color:fg}},{title:{text:"C",color:tx},value:{text:f(c.close),color:col}},{title:{text:"",color:tx},value:{text:`${ch>=0?"+":""}${pc.toFixed(2)}%`,color:ch>=0?up:dn}}];
      return[{title:{text:`${sym.name||sym.ticker} · ${per.text}`,color:fg},value:{text:"",color:fg}},{title:{text:"O",color:tx},value:{text:f(c.open),color:col}},{title:{text:"H",color:tx},value:{text:f(c.high),color:col}},
        {title:{text:"L",color:tx},value:{text:f(c.low),color:col}},{title:{text:"C",color:tx},value:{text:f(c.close),color:col}},{title:{text:"",color:tx},value:{text:`${ch>=0?"+":""}${f(ch)} (${ch>=0?"+":""}${pc.toFixed(2)}%)`,color:ch>=0?up:dn}}]}}
  /* tamaño de letra del gráfico (pensado para transmitir) */
  const fz=()=>+(o.getFont&&o.getFont())||11;
  function applyStyles(){const f=fz(),t={size:f};chart.setStyles(deep(deep(themeStyles(theme==="light",theme==="eag"),extra),{yAxis:{type:axisType,tickText:t},xAxis:{tickText:t},
    crosshair:{horizontal:{text:t},vertical:{text:t}},indicator:{tooltip:{text:{size:f}}},overlay:{text:{size:f+1},rectText:{size:f}},
    candle:{priceMark:{last:{text:{size:f}},high:{textSize:Math.max(10,f-1)},low:{textSize:Math.max(10,f-1)}},tooltip:{showRule:"always",showType:"standard",custom:legend(),text:{size:f+1,marginLeft:10,marginTop:8,marginRight:10}}}}));
    cdl.style.fontSize=(f-0.5)+"px"}
  /* decimales del precio: automático o los que elija el usuario */
  const dec=()=>{const d=o.getDecimals&&o.getDecimals();return d==null||d==="auto"?(sym.pricePrecision||3):+d};
  function applyDec(){try{chart.setPriceVolumePrecision(dec(),0)}catch(e){}}
  new ResizeObserver(()=>chart.resize()).observe(chartEl);

  /* inicio */
  paintDbar();applyStyles();
  ind.main.forEach(n=>addInd(n,"main",true));const subs=Object.keys(ind.sub);ind.sub={};subs.forEach(n=>addInd(n,"sub",true));
  loadData();

  return{chart,el:root,startTool:n=>{stopBrush();startTool(n)},stopBrush:()=>stopBrush(),startBrush:()=>startBrush(),undo,redo,renderAlerts,cancelDraw:()=>cancelDraw(),
    getSymbol:()=>sym,setSymbol(s){if(!s||(sym&&s.ticker===sym.ticker&&s.pricePrecision===sym.pricePrecision))return;sym=s;loadData()},
    getPeriod:()=>per,setPeriod(p){if(!p||p.text===per.text)return;per=p;loadData()},
    getTheme:()=>theme,setTheme(t){theme=t;applyStyles()},
    setStyles(s){extra=s||{};applyStyles()},setDecimals(){applyDec();applyStyles()},
    refreshBar:paintBar,
    setMtfButton(show,on){const b=root.querySelector('[data-a="mtf"]');b.hidden=!show;b.classList.toggle("on",!!on)},
    setDrawingBar(v){dbar.style.display=v?"":"none"},
    reloadDrawings(){if(ready)restoreDrawings()},
    reloadData(){loadData()}}
};
})();
