/* © El Arte Gráfico. Todos los derechos reservados. */
/* EAG Charts — widget de gráfico propio (motor: KLineChart core, Apache-2.0).
   Barra superior, barra de dibujo estilo TradingView, dibujos guardados por mercado,
   menú de clic derecho para personalizar cada dibujo, indicadores en español. */
(function(){
"use strict";
const KC=window.klinecharts;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const GOLD="#e2b55c";
const DKEY="eag_draw_v1";
const loadD=()=>{try{return JSON.parse(localStorage.getItem(DKEY)||"{}")||{}}catch(e){return{}}};
const saveD=d=>{try{localStorage.setItem(DKEY,JSON.stringify(d))}catch(e){}};
const hexA=(h,a)=>{h=String(h||GOLD).replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");const n=parseInt(h.slice(0,6),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};

/* ===================== Herramientas propias ===================== */
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
      const ex=overlay.extendData||{};const cu=ex.up||"#0ecb81",cd=ex.dn||"#f6465d";
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
    const ex=overlay.extendData||{},cu=ex.up||"#0ecb81",cd=ex.dn||"#f6465d";
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
  /* Medir: diferencia de precio, %, velas y tiempo */
  KC.registerOverlay({name:"eagMeasure",totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
    createPointFigures:({overlay,coordinates,precision})=>{
      if(coordinates.length<2)return[];
      const[a,b]=coordinates,p=overlay.points,pp=(precision&&precision.price)||3;
      const d=p[1].value-p[0].value,up=d>=0,col=up?"#2962ff":"#f6465d",pip=Math.pow(10,-pp),ticks=Math.round(Math.abs(d)/pip);
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
  KC.registerOverlay({name:"eagZone",totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
    createPointFigures:({overlay,coordinates,bounding})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,ex=overlay.extendData||{};const col=ex.color||GOLD;
      const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),h=Math.abs(b.y-a.y);
      return[{type:"rect",attrs:{x,y,width:bounding.width-x,height:h},styles:{style:"stroke_fill",color:hexA(col,.16),borderColor:col,borderSize:1}},
        ...(ex.text?[{type:"text",ignoreEvent:true,attrs:{x:x+6,y:y+h/2,text:ex.text,baseline:"middle"},styles:{color:col,size:12,backgroundColor:"transparent"}}]:[])]}});
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
  KC.registerIndicator({name:"SUPERTREND",shortName:"SuperTrend",series:"price",precision:2,calcParams:[10,3],shouldOhlc:true,figures:[{key:"up",title:"Alcista: ",type:"line",styles:()=>({color:"#0ecb81"})},{key:"dn",title:"Bajista: ",type:"line",styles:()=>({color:"#f6465d"})}],
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
  {g:"shape",t:"Formas y zonas",items:[["eagZone","Zona (se extiende a la derecha)"],["rect","Rectángulo"],["circle","Círculo"],["triangle","Triángulo"],["parallelogram","Paralelogramo"]]},
  {g:"pat",t:"Patrones y ondas",items:[["xabcd","Patrón XABCD"],["abcd","Patrón ABCD"],["threeWaves","Tres ondas"],["fiveWaves","Cinco ondas (Elliott)"],["eightWaves","Ocho ondas"],["anyWaves","Ondas libres"]]},
  {g:"pos",t:"Posición y medición",items:[["eagLong","Posición larga (compra)"],["eagShort","Posición corta (venta)"],["eagMeasure","Regla: medir puntos, %, velas y tiempo"]]},
  {g:"txt",t:"Texto y notas",items:[["eagText","Texto"],["simpleAnnotation","Nota con flecha"],["simpleTag","Etiqueta de precio"]]}];
const TNAME={eagPosition:"Posición (antigua)"};TOOLS.forEach(g=>g.items.forEach(([k,t])=>TNAME[k]=t));
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
  caret:'<path d="m6 9 6 6 6-6"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
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
  eagLong:'<rect x="4" y="4" width="16" height="8" fill="#0ecb81" opacity=".45" stroke="none"/><rect x="4" y="12" width="16" height="6" fill="#f6465d" opacity=".45" stroke="none"/><path d="M4 12h16M9 9l3-3 3 3"/>',
  eagShort:'<rect x="4" y="6" width="16" height="6" fill="#f6465d" opacity=".45" stroke="none"/><rect x="4" y="12" width="16" height="8" fill="#0ecb81" opacity=".45" stroke="none"/><path d="M4 12h16M9 15l3 3 3-3"/>',
  eagPosition:'<rect x="4" y="4" width="16" height="7" fill="#0ecb81" opacity=".35" stroke="none"/><rect x="4" y="11" width="16" height="7" fill="#f6465d" opacity=".35" stroke="none"/><path d="M4 11h16"/>',
  eagMeasure:'<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  eagText:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  simpleAnnotation:'<rect x="3" y="3" width="18" height="10" rx="2"/><path d="M12 13v8"/>'+P(12,21),
  simpleTag:'<path d="M3 12h7"/><path d="M10 7h9l2 5-2 5h-9z"/>'};
const tsvg=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${TI[k]||""}</svg>`;
const svg=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[k]||""}</svg>`;
const COLORS=["#e2b55c","#f3d08a","#ffffff","#9da1aa","#2962ff","#0ecb81","#f6465d","#ff9800","#9c27b0","#e91e63","#00bcd4","#000000"];
const IND=[ // [nombre, nombre en español, dónde]
  ["MA","Media móvil (MA)","main"],["EMA","Media exponencial (EMA)","main"],["SMA","Media suavizada (SMA)","main"],["WMA","Media ponderada (WMA)","main"],
  ["BOLL","Bandas de Bollinger","main"],["DONCHIAN","Canales de Donchian","main"],["SUPERTREND","SuperTrend","main"],["SAR","SAR parabólico","main"],["BBI","BBI (promedio de medias)","main"],
  ["RSI","RSI (fuerza relativa)","sub"],["MACD","MACD","sub"],["STOCH","Estocástico","sub"],["ATR","ATR (rango verdadero medio)","sub"],["CCI","CCI","sub"],["WR","Williams %R","sub"],["MTM","Momentum","sub"],["ROC","Tasa de cambio (ROC)","sub"],
  ["KDJ","KDJ","sub"],["DMI","DMI / ADX","sub"],["AO","Awesome Oscillator","sub"],["TRIX","TRIX","sub"],["BIAS","BIAS","sub"],["DMA","DMA","sub"],["PSY","PSY (psicológico)","sub"],["BRAR","BRAR","sub"],["CR","CR","sub"],["EMV","EMV","sub"],["VR","VR","sub"],["OBV","OBV","sub"],["PVT","PVT","sub"]];
const INDN={};IND.forEach(i=>INDN[i[0]]=i[1]);

/* estilos del motor según el tema */
function themeStyles(light){
  const tx=light?"#5c616b":"#9da1aa",ln=light?"#e5e6e9":"#24262c",cb=light?"#15171c":"#363a45";
  const axis={axisLine:{color:ln},tickLine:{color:ln},tickText:{color:tx,size:11}};
  const ch={line:{color:light?"#9aa0aa":"#5d626c",style:"dashed",dashedValue:[4,4]},text:{backgroundColor:cb,borderColor:cb,color:"#fff"}};
  return{xAxis:axis,yAxis:axis,separator:{color:ln},crosshair:{horizontal:ch,vertical:ch},
    candle:{tooltip:{text:{color:tx,size:11}},priceMark:{high:{color:tx},low:{color:tx}}},indicator:{tooltip:{text:{color:tx,size:11}}},
    overlay:{line:{color:GOLD,size:1},point:{color:GOLD,borderColor:hexA(GOLD,.35),activeColor:GOLD,activeBorderColor:hexA(GOLD,.35)},
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
      <button class="wb" data-a="ind" title="Indicadores">${svg("fx")}<span>Indicadores</span></button><button class="wb" data-a="cfg" title="Ajustes del gráfico">${svg("gear")}</button><button class="wb" data-a="shot" title="Captura (descargar imagen)">${svg("cam")}</button><button class="wb" data-a="full" title="Pantalla completa">${svg("full")}</button></div>
    <div class="wbody"><div class="dbar"></div><div class="wchart"><div class="wwm"><div class="wm-s"></div><div class="wm-b">EL ARTE GRÁFICO</div></div>
      <div class="wnav"><button data-n="left" title="Mover a la izquierda">${svg("chevl",16)}</button><button data-n="right" title="Mover a la derecha">${svg("chevr",16)}</button><i></i><button data-n="reset" title="Volver al precio actual (zoom normal)">${svg("reset",16)}</button><button data-n="reload" title="Recargar el gráfico (si se traba)">${svg("reload",16)}</button></div></div></div>`;
  const $=s=>root.querySelector(s),chartEl=$(".wchart"),dbar=$(".dbar");
  const chart=KC.init(chartEl,{locale:"es-ES",timezone:o.timezone});(window.__eagCharts=window.__eagCharts||[]).push(chart);
  let sym=o.symbol,per=o.period,theme=o.theme||"dark",extra={},gen=0,subKey=null,ready=false,selId=null;
  const ind=Object.assign({main:[],sub:{},params:{}},o.indicators||{});ind.sub=ind.sub&&!Array.isArray(ind.sub)?ind.sub:{};
  const ovs=new Map(); // id -> definición guardable
  let magnet=o.magnet||"normal",locked=false,hidden=false;

  /* ---------- datos ---------- */
  const msOf=p=>p.multiplier*({minute:6e4,hour:36e5,day:864e5,week:6048e5}[p.timespan]||6e4);
  async function loadData(){
    const g=++gen;ready=false;
    if(subKey){o.datafeed.unsubscribe(subKey.s,subKey.p);subKey=null}
    chart.clearData();try{chart.setPriceVolumePrecision(sym.pricePrecision||3,0)}catch(e){}
    paintBar();
    const to=Date.now(),from=to-msOf(per)*500;
    const list=await o.datafeed.getHistoryKLineData(sym,per,from,to);
    if(g!==gen)return;
    chart.applyNewData(list,list.length>0);ready=true;
    o.datafeed.subscribe(sym,per,d=>{if(g===gen)chart.updateData(d)});subKey={s:sym,p:per};
    restoreDrawings();
  }
  chart.setLoadDataCallback(async({type,data,callback})=>{
    if(type!=="forward"||!data){callback([],false);return}
    const g=gen,to=data.timestamp-1,from=to-msOf(per)*500;
    const list=await o.datafeed.getHistoryKLineData(sym,per,from,to);
    if(g!==gen)return;callback(list,list.length>0)});

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
  root.querySelector('[data-a="cfg"]').onclick=e=>{e.stopPropagation();o.onSettings&&o.onSettings(e.currentTarget)};
  root.querySelector('[data-a="shot"]').onclick=()=>{try{const bg=getComputedStyle(root).getPropertyValue("--chartbg").trim()||(theme==="light"?"#ffffff":"#0b0c0e");
    const url=chart.getConvertPictureUrl(true,"png",bg),a=document.createElement("a");a.href=url;a.download=`EAG_${sym.ticker}_${per.text}.png`;document.body.appendChild(a);a.click();a.remove()}catch(e){}};
  root.querySelector('[data-a="full"]').onclick=()=>{const el=root.closest(".pane")||root;document.fullscreenElement?document.exitFullscreen():(el.requestFullscreen&&el.requestFullscreen())};

  /* ---------- navegación rápida (abajo al centro) ---------- */
  let bs0=null;setTimeout(()=>{try{bs0=chart.getBarSpace()}catch(e){}},0);
  root.querySelectorAll(".wnav button").forEach(b=>b.onclick=e=>{e.stopPropagation();const n=b.dataset.n,w=chartEl.clientWidth;
    try{if(n==="left")chart.scrollByDistance(w*.35,250);else if(n==="right")chart.scrollByDistance(-w*.35,250);
      else if(n==="reset"){if(bs0)chart.setBarSpace(bs0);chart.scrollToRealTime(300)}
      else if(n==="reload"){b.classList.add("spin");setTimeout(()=>b.classList.remove("spin"),900);if(bs0)chart.setBarSpace(bs0);loadData()}}catch(x){}});

  /* ---------- barra de dibujo ---------- */
  const lastTool=Object.assign({},o.lastTools||{});
  let menu=null;const closeMenu=()=>{if(menu){menu.remove();menu=null}};
  document.addEventListener("pointerdown",e=>{if(menu&&!menu.contains(e.target)&&!e.target.closest(".dg .more"))closeMenu()});
  function paintDbar(){
    dbar.innerHTML=`<div class="dmini"><button class="dt dtf" title="Temporalidad (todas)"><b>${esc(per.text)}</b></button><button class="dt" data-mi="sym" title="Cambiar mercado">${svg("list",17)}</button><button class="dt" data-mi="ind" title="Indicadores">${svg("fx",17)}</button><i class="dsep"></i></div><button class="dt" data-k="cross" title="Cursor (cancelar dibujo)">${svg("cross")}</button><button class="dt" data-k="eagMeasure" title="Regla: medir puntos (también Shift + clic)">${tsvg("eagMeasure")}</button><i class="dsep"></i>`+
      TOOLS.map(g=>{const cur=lastTool[g.g]||g.items[0][0];return`<div class="dg" data-g="${g.g}"><button class="dt" data-k="${cur}" title="${esc(TNAME[cur])}">${tsvg(cur)}</button><button class="more" title="${esc(g.t)}">${svg("caret",9)}</button></div>`}).join("")+
      `<i class="dsep"></i><button class="dt tg${magnet!=="normal"?" on":""}" data-x="magnet" title="${magnet==="strong_magnet"?"Imán fuerte":magnet==="weak_magnet"?"Imán débil":"Imán apagado"}">${svg("magnet")}<em>${magnet==="strong_magnet"?"F":magnet==="weak_magnet"?"D":""}</em></button>
      <button class="dt tg${locked?" on":""}" data-x="lock" title="${locked?"Desbloquear dibujos":"Bloquear todos los dibujos"}">${svg(locked?"lock":"unlock")}</button>
      <button class="dt tg${hidden?" on":""}" data-x="hide" title="${hidden?"Mostrar dibujos":"Ocultar todos los dibujos"}">${svg(hidden?"eyeoff":"eye")}</button>
      <button class="dt" data-x="clear" title="Borrar todos los dibujos de este mercado">${svg("trash")}</button>`;
    dbar.querySelector(".dtf").onclick=e=>{e.stopPropagation();o.onTFClick&&o.onTFClick(e.currentTarget)};
    dbar.querySelector('[data-mi="sym"]').onclick=e=>{e.stopPropagation();o.onSymbolClick&&o.onSymbolClick(e.currentTarget)};
    dbar.querySelector('[data-mi="ind"]').onclick=e=>{e.stopPropagation();openInd()};
    dbar.querySelectorAll(".dt[data-k]").forEach(b=>b.onclick=()=>b.dataset.k==="cross"?cancelDraw():startTool(b.dataset.k));
    dbar.querySelectorAll(".dg .more").forEach(b=>b.onclick=e=>{e.stopPropagation();const g=TOOLS.find(x=>x.g===b.parentNode.dataset.g);openToolMenu(g,b.parentNode)});
    /* mantener presionado o deslizar sobre el botón abre la lista; soltar sobre una herramienta la elige */
    dbar.querySelectorAll(".dg>.dt").forEach(b=>{
      let st=null,tm=null,opened=false;
      const open=()=>{if(opened)return;opened=true;clearTimeout(tm);const g=TOOLS.find(x=>x.g===b.parentNode.dataset.g);openToolMenu(g,b.parentNode);b.classList.add("hold")};
      b.addEventListener("pointerdown",e=>{if(e.button!==0)return;st={x:e.clientX,y:e.clientY};opened=false;tm=setTimeout(open,320);try{b.setPointerCapture(e.pointerId)}catch(x){}});
      b.addEventListener("pointermove",e=>{if(!st)return;if(Math.hypot(e.clientX-st.x,e.clientY-st.y)>8)open();
        if(opened&&menu){menu.querySelectorAll("button").forEach(x=>x.classList.remove("hov"));const t=document.elementFromPoint(e.clientX,e.clientY),it=t&&t.closest(".wmenu button");it&&it.classList.add("hov")}});
      b.addEventListener("pointerup",e=>{clearTimeout(tm);b.classList.remove("hold");if(!st)return;st=null;
        if(opened){const t=document.elementFromPoint(e.clientX,e.clientY),it=t&&t.closest(".wmenu button");if(it)it.click();b.dataset.skip="1";setTimeout(()=>delete b.dataset.skip,50)}});
      b.addEventListener("pointercancel",()=>{clearTimeout(tm);st=null;b.classList.remove("hold")});
      b.addEventListener("click",e=>{if(b.dataset.skip){e.stopImmediatePropagation();e.preventDefault()}},true)});
    dbar.querySelector('[data-x="magnet"]').onclick=()=>{magnet=magnet==="normal"?"weak_magnet":magnet==="weak_magnet"?"strong_magnet":"normal";ovs.forEach((v,id)=>chart.overrideOverlay({id,mode:magnet}));o.onMagnet&&o.onMagnet(magnet);paintDbar()};
    dbar.querySelector('[data-x="lock"]').onclick=()=>{locked=!locked;ovs.forEach((v,id)=>{v.lock=locked;chart.overrideOverlay({id,lock:locked})});persist();paintDbar()};
    dbar.querySelector('[data-x="hide"]').onclick=()=>{hidden=!hidden;ovs.forEach((v,id)=>chart.overrideOverlay({id,visible:!hidden}));paintDbar()};
    const cl=dbar.querySelector('[data-x="clear"]');cl.onclick=()=>{if(!ovs.size)return;if(!cl.classList.contains("confirm")){cl.classList.add("confirm");cl.title="Toca otra vez para borrar todo";setTimeout(()=>{cl.classList.remove("confirm");cl.title="Borrar todos los dibujos de este mercado"},2500);return}
      chart.removeOverlay();ovs.clear();persist();hideStyleBar();paintDbar()};
  }
  function openToolMenu(g,anchor){closeMenu();menu=document.createElement("div");menu.className="wmenu";
    const favs=(o.getToolFav&&o.getToolFav())||[];
    menu.innerHTML=`<div class="mt">${esc(g.t)}</div>`+g.items.map(([k,t])=>`<button data-k="${k}" class="${(lastTool[g.g]||g.items[0][0])===k?"on":""}">${tsvg(k,20)}<span>${esc(t)}</span><i class="tst${favs.includes(k)?" on":""}" data-fav="${k}" title="${favs.includes(k)?"Quitar de la barra de favoritos":"Agregar a la barra de favoritos"}">${favs.includes(k)?"★":"☆"}</i></button>`).join("");
    document.body.appendChild(menu);const r=anchor.getBoundingClientRect();menu.style.left=(r.right+6)+"px";menu.style.top=Math.min(r.top,innerHeight-menu.offsetHeight-8)+"px";
    menu.querySelectorAll("[data-fav]").forEach(f=>f.addEventListener("click",e=>{e.stopPropagation();o.onToolFav&&o.onToolFav(f.dataset.fav);const on=((o.getToolFav&&o.getToolFav())||[]).includes(f.dataset.fav);f.classList.toggle("on",on);f.textContent=on?"★":"☆"},true));
    menu.querySelectorAll("button").forEach(b=>b.onclick=()=>{lastTool[g.g]=b.dataset.k;o.onLastTools&&o.onLastTools(lastTool);closeMenu();paintDbar();startTool(b.dataset.k)})}
  let drawingId=null;
  function cancelDraw(){if(drawingId){try{chart.removeOverlay(drawingId)}catch(e){}ovs.delete(drawingId);drawingId=null}dbar.querySelectorAll(".dt").forEach(b=>b.classList.remove("act"))}
  function startTool(name){cancelDraw();
    const ex=name==="eagText"?{text:"Texto"}:undefined;
    const id=makeOverlay({name,extendData:ex},true);if(!id)return;drawingId=id;
    dbar.querySelectorAll(".dt[data-k]").forEach(b=>b.classList.toggle("act",b.dataset.k===name))}
  function makeOverlay(def,drawing){
    const id=chart.createOverlay({name:def.name,points:def.points,styles:def.styles,extendData:def.extendData,lock:!!def.lock,visible:!hidden,mode:magnet,
      onDrawEnd:e=>{drawingId=null;dbar.querySelectorAll(".dt").forEach(b=>b.classList.remove("act"));
        if((e.overlay.name==="eagLong"||e.overlay.name==="eagShort")&&e.overlay.points.length<3)autoPos(e.overlay);
        capture(chart.getOverlayById(e.overlay.id)||e.overlay);if(e.overlay.name==="eagText")setTimeout(()=>editText(e.overlay.id),30);return false},
      onPressedMoveEnd:e=>{capture(e.overlay);return false},
      onSelected:e=>{selId=e.overlay.id;showStyleBar(e.overlay.id);return false},
      onDeselected:e=>{if(selId===e.overlay.id){selId=null;hideStyleBar()}return false},
      onRemoved:e=>{ovs.delete(e.overlay.id);if(selId===e.overlay.id){selId=null;hideStyleBar()}persist();return false},
      onDoubleClick:e=>{if(e.overlay.name==="eagText"||e.overlay.name==="eagZone")editText(e.overlay.id);return false},
      onRightClick:e=>{openCtx(e.overlay.id,e);return true}});
    if(id){ovs.set(id,{name:def.name,styles:def.styles||null,extendData:def.extendData||null,lock:!!def.lock,points:def.points||null});if(!drawing)ovs.get(id).done=true}
    return id}
  /* stop y objetivo automáticos (1:2) según el rango reciente del gráfico */
  function autoPos(ov){const L=chart.getDataList();if(!L.length)return;const p0=ov.points[0];
    let i=p0.dataIndex!=null?p0.dataIndex:L.length-1;i=Math.max(0,Math.min(L.length-1,i));
    const seg=L.slice(Math.max(0,i-60),i+1);let hi=-Infinity,lo=Infinity;seg.forEach(k=>{hi=Math.max(hi,k.high);lo=Math.min(lo,k.low)});
    const d=Math.max((hi-lo)*.25,Math.abs(p0.value)*.0005),long=ov.name==="eagLong";
    const bar=L.length>1?L[1].timestamp-L[0].timestamp:6e4,ts=(p0.timestamp||L[i].timestamp)+bar*24;
    const pts=[{timestamp:p0.timestamp,value:p0.value},{timestamp:ts,value:long?p0.value-d:p0.value+d},{timestamp:ts,value:long?p0.value+2*d:p0.value-2*d}];
    chart.overrideOverlay({id:ov.id,points:pts})}
  function capture(ov){const v=ovs.get(ov.id);if(!v)return;v.points=(ov.points||[]).map(p=>({timestamp:p.timestamp,value:p.value}));v.done=true;v.lock=!!ov.lock;persist()}
  /* guardado por mercado (todas las temporalidades), como en TradingView */
  function persist(){if(!sym)return;const all=loadD();const arr=[];ovs.forEach(v=>{if(v.done&&v.points&&v.points.length)arr.push({name:v.name,points:v.points,styles:v.styles,extendData:v.extendData,lock:v.lock})});
    if(arr.length)all[sym.ticker]=arr;else delete all[sym.ticker];saveD(all);o.onDrawingsChange&&o.onDrawingsChange(sym.ticker)}
  function restoreDrawings(){try{chart.removeOverlay()}catch(e){}ovs.clear();hideStyleBar();
    (loadD()[sym.ticker]||[]).forEach(d=>{if(d.points&&d.points.every(p=>p.timestamp))makeOverlay(d,false)})}
  o.reloadDrawings=()=>{if(ready)restoreDrawings()};

  /* ---------- personalizar un dibujo: barra flotante + clic derecho ---------- */
  const sbar=document.createElement("div");sbar.className="wstyle";sbar.hidden=true;chartEl.appendChild(sbar);
  const isFill=n=>/^(rect|circle|triangle|parallelogram|eagZone|fibonacciCircle|gannBox)$/.test(n);
  const curStyle=id=>{const v=ovs.get(id)||{},s=v.styles||{},isTxt=v.name==="eagText"||v.name==="eagZone";
    return{color:isTxt?((v.extendData||{}).color||GOLD):((s.line&&s.line.color)||(s.polygon&&s.polygon.borderColor)||GOLD),size:(s.line&&s.line.size)||(s.polygon&&s.polygon.borderSize)||1,
      dash:(s.line&&s.line.style)==="dashed"?((s.line.dashedValue||[4,4])[0]<=2?"dot":"dash"):"solid",fill:s.polygon?s.polygon.color:null}};
  function setStyle(id,ch){const v=ovs.get(id);if(!v)return;const c=Object.assign(curStyle(id),ch);
    if(v.name==="eagText"||v.name==="eagZone"||/^eag(Position|Long|Short)$/.test(v.name)){v.extendData=Object.assign({},v.extendData||{},/^eag(Position|Long|Short)$/.test(v.name)?{}:{color:c.color});if(ch.size&&v.name==="eagText")v.extendData.size=10+ch.size*2;chart.overrideOverlay({id,extendData:v.extendData})}
    else{const st={line:{color:c.color,size:c.size,style:c.dash==="solid"?"solid":"dashed",dashedValue:c.dash==="dot"?[1,3]:[5,4]},
        polygon:{borderColor:c.color,borderSize:c.size,borderStyle:c.dash==="solid"?"solid":"dashed",color:c.fill!=null?c.fill:hexA(c.color,.14)},
        rect:{borderColor:c.color,borderSize:c.size,color:c.fill!=null?c.fill:hexA(c.color,.14)},circle:{borderColor:c.color,borderSize:c.size,color:c.fill!=null?c.fill:hexA(c.color,.14)},
        arc:{color:c.color,size:c.size},text:{color:c.color},rectText:{backgroundColor:c.color,borderColor:c.color}};
      v.styles=st;chart.overrideOverlay({id,styles:st})}
    persist();if(!sbar.hidden)showStyleBar(id)}
  function removeOv(id){try{chart.removeOverlay(id)}catch(e){}ovs.delete(id);persist();hideStyleBar();closeMenu()}
  function dupOv(id){const v=ovs.get(id);if(!v||!v.points)return;const L=chart.getDataList(),last=L[L.length-1],first=L[0],shift=(last&&first&&L.length>2)?(L[1].timestamp-L[0].timestamp)*5:0;
    const d=JSON.parse(JSON.stringify(v));d.points=d.points.map(p=>({timestamp:p.timestamp+shift,value:p.value}));const nid=makeOverlay(d,false);if(nid){ovs.get(nid).done=true;persist()}}
  function toggleLock(id){const v=ovs.get(id);if(!v)return;v.lock=!v.lock;chart.overrideOverlay({id,lock:v.lock});persist();if(!sbar.hidden)showStyleBar(id)}
  function showStyleBar(id){const v=ovs.get(id);if(!v)return;const c=curStyle(id);
    sbar.innerHTML=`<span class="sn">${tsvg(v.name,16)}${esc(TNAME[v.name]||v.name)}</span><label class="cc" title="Color"><i style="background:${c.color}"></i><input type="color" value="${/^#/.test(c.color)?c.color.slice(0,7):GOLD}"></label>
      ${/^eag(Position|Long|Short)$/.test(v.name)?"":`<select title="Grosor">${[1,2,3,4].map(n=>`<option value="${n}" ${+c.size===n?"selected":""}>${n}px</option>`).join("")}</select>
      <select title="Tipo de línea"><option value="solid" ${c.dash==="solid"?"selected":""}>━ Sólida</option><option value="dash" ${c.dash==="dash"?"selected":""}>╍ Guiones</option><option value="dot" ${c.dash==="dot"?"selected":""}>┈ Puntos</option></select>`}
      ${v.name==="eagText"||v.name==="eagZone"?`<button data-a="txt" title="Editar texto">Aa</button>`:""}
      <button data-a="lock" title="${v.lock?"Desbloquear":"Bloquear"}">${svg(v.lock?"lock":"unlock",16)}</button><button data-a="dup" title="Duplicar">${svg("copy",16)}</button><button data-a="del" title="Eliminar (Supr)">${svg("trash",16)}</button>`;
    sbar.hidden=false;
    sbar.querySelector("input[type=color]").oninput=e=>{sbar.querySelector(".cc i").style.background=e.target.value};
    sbar.querySelector("input[type=color]").onchange=e=>setStyle(id,{color:e.target.value,fill:null});
    const sels=sbar.querySelectorAll("select");if(sels[0])sels[0].onchange=e=>setStyle(id,{size:+e.target.value});if(sels[1])sels[1].onchange=e=>setStyle(id,{dash:e.target.value});
    const tb=sbar.querySelector('[data-a="txt"]');tb&&(tb.onclick=()=>editText(id));
    sbar.querySelector('[data-a="lock"]').onclick=()=>toggleLock(id);sbar.querySelector('[data-a="dup"]').onclick=()=>dupOv(id);sbar.querySelector('[data-a="del"]').onclick=()=>removeOv(id)}
  function hideStyleBar(){sbar.hidden=true}
  /* menú de clic derecho sobre un dibujo */
  function openCtx(id,e){closeMenu();const v=ovs.get(id);if(!v)return;selId=id;showStyleBar(id);const c=curStyle(id);
    menu=document.createElement("div");menu.className="wmenu ctx";
    menu.innerHTML=`<div class="mt mti">${tsvg(v.name,15)}${esc(TNAME[v.name]||v.name)}</div>
      <div class="mrow">${COLORS.map(k=>`<button class="sw${c.color===k?" on":""}" data-c="${k}" style="background:${k}" title="${k}"></button>`).join("")}<label class="sw pick" title="Otro color">+<input type="color" value="${/^#/.test(c.color)?c.color.slice(0,7):GOLD}"></label></div>
      ${/^eag(Position|Long|Short)$/.test(v.name)?"":`<div class="ml">Grosor</div><div class="mrow">${[1,2,3,4].map(n=>`<button class="wd${+c.size===n?" on":""}" data-w="${n}" title="${n}px"><i style="height:${n}px"></i></button>`).join("")}</div>
      <div class="ml">Línea</div><div class="mrow">${[["solid","Sólida"],["dash","Guiones"],["dot","Puntos"]].map(([k,t])=>`<button class="ls${c.dash===k?" on":""}" data-d="${k}" title="${t}"><i class="${k}"></i></button>`).join("")}</div>`}
      ${isFill(v.name)?`<div class="ml">Relleno</div><div class="mrow">${[0,.08,.16,.3,.5].map(a=>`<button class="fa" data-f="${a}" title="${Math.round(a*100)}%"><i style="background:${hexA(c.color,a||.0001)};${a?"":"border:1px dashed var(--dim)"}"></i></button>`).join("")}</div>`:""}
      <div class="msep"></div>
      ${v.name==="eagText"||v.name==="eagZone"?`<button class="mi" data-a="txt">Editar texto…</button>`:""}
      <button class="mi" data-a="lock">${v.lock?"Desbloquear":"Bloquear"}</button><button class="mi" data-a="dup">Duplicar</button>
      <button class="mi" data-a="hide">Ocultar este dibujo</button><button class="mi danger" data-a="del">Eliminar</button>`;
    document.body.appendChild(menu);
    const r=chartEl.getBoundingClientRect(),x=r.left+((e&&e.x)||40),y=r.top+((e&&e.y)||40);
    menu.style.left=Math.min(x,innerWidth-menu.offsetWidth-8)+"px";menu.style.top=Math.min(y,innerHeight-menu.offsetHeight-8)+"px";
    menu.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{setStyle(id,{color:b.dataset.c,fill:null});openCtx(id,e)});
    menu.querySelector(".pick input").onchange=ev=>{setStyle(id,{color:ev.target.value,fill:null});openCtx(id,e)};
    menu.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{setStyle(id,{size:+b.dataset.w});openCtx(id,e)});
    menu.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{setStyle(id,{dash:b.dataset.d});openCtx(id,e)});
    menu.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{setStyle(id,{fill:hexA(curStyle(id).color,+b.dataset.f)});openCtx(id,e)});
    menu.querySelectorAll(".mi").forEach(b=>b.onclick=()=>{const a=b.dataset.a;closeMenu();
      if(a==="txt")editText(id);else if(a==="lock")toggleLock(id);else if(a==="dup")dupOv(id);else if(a==="hide"){chart.overrideOverlay({id,visible:false});hideStyleBar()}else if(a==="del")removeOv(id)})}
  /* editar texto en el mismo gráfico (sin ventanas del navegador) */
  function editText(id){const v=ovs.get(id),ov=chart.getOverlayById(id);if(!v||!ov||!ov.points[0])return;
    const px=chart.convertToPixel({timestamp:ov.points[0].timestamp,value:ov.points[0].value},{paneId:"candle_pane"})||{x:40,y:40};
    const box=document.createElement("div");box.className="wtxt";box.innerHTML=`<input type="text" maxlength="80" value="${esc((v.extendData||{}).text||"")}" placeholder="Escribe y presiona Enter">`;
    chartEl.appendChild(box);box.style.left=Math.max(4,Math.min(px.x,chartEl.clientWidth-230))+"px";box.style.top=Math.max(4,px.y-16)+"px";
    const inp=box.querySelector("input");inp.focus();inp.select();
    const done=ok=>{if(!box.isConnected)return;if(ok){v.extendData=Object.assign({},v.extendData||{},{text:inp.value.trim()||(v.name==="eagText"?"Texto":"")});chart.overrideOverlay({id,extendData:v.extendData});persist()}box.remove()};
    inp.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter")done(true);if(e.key==="Escape")done(false)};inp.onblur=()=>done(true)}
  root.tabIndex=-1;
  root.addEventListener("keydown",e=>{if((e.key==="Delete"||e.key==="Backspace")&&selId&&!/input|select|textarea/i.test(e.target.tagName)){removeOv(selId);selId=null}if(e.key==="Escape"){cancelDraw();closeMenu()}});
  chartEl.addEventListener("contextmenu",e=>e.preventDefault());
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
  function applyStyles(){chart.setStyles(deep(themeStyles(theme==="light"),extra))}
  new ResizeObserver(()=>chart.resize()).observe(chartEl);

  /* inicio */
  paintDbar();applyStyles();
  ind.main.forEach(n=>addInd(n,"main",true));const subs=Object.keys(ind.sub);ind.sub={};subs.forEach(n=>addInd(n,"sub",true));
  loadData();

  return{chart,el:root,startTool:n=>startTool(n),
    getSymbol:()=>sym,setSymbol(s){if(!s||(sym&&s.ticker===sym.ticker&&s.pricePrecision===sym.pricePrecision))return;sym=s;loadData()},
    getPeriod:()=>per,setPeriod(p){if(!p||p.text===per.text)return;per=p;loadData()},
    getTheme:()=>theme,setTheme(t){theme=t;applyStyles()},
    setStyles(s){extra=s||{};applyStyles()},
    refreshBar:paintBar,
    setDrawingBar(v){dbar.style.display=v?"":"none"},
    reloadDrawings(){if(ready)restoreDrawings()}}
};
})();
