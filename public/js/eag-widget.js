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
/* calculadora de lote: id del dibujo → mercado (la fórmula y el riesgo los pone charts-app en window.__eagLot) */
const OVSYM=new Map();
const TXTFAM='Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
/* Texto de dibujo: fuentes y medidas (una sola fuente de verdad para dibujar y para tocar/seleccionar) */
const TXTFAMS={inter:TXTFAM,serif:'Georgia,"Times New Roman",serif',mono:'ui-monospace,"SF Mono",Menlo,Consolas,monospace',impact:'Impact,"Arial Black","Helvetica Neue",sans-serif',hand:'"Marker Felt","Segoe Print","Comic Sans MS",cursive'};
let _txM=null;
const txtLay=(ex,ctx)=>{ex=ex||{};const c=ctx||(_txM||(_txM=document.createElement("canvas").getContext("2d")));const sz=Math.max(8,Math.min(160,+ex.size||14));
  c.font=`${ex.i?"italic ":""}${ex.b===false?"500":"700"} ${sz}px ${TXTFAMS[ex.fam]||TXTFAM}`;const lines=String(ex.text||"Texto").split("\n").slice(0,10),ws=lines.map(l=>c.measureText(l).width);
  const hasBg=!!(ex.bg&&ex.bg!=="transparent"),px=hasBg?Math.round(sz*.5):0,py=hasBg?Math.round(sz*.28):0,lh=sz*1.22,W=Math.max(8,...ws),H=lh*lines.length,ox=hasBg?0:4;
  return{sz,lines,ws,W,H,px,py,lh,hasBg,ox,w:W+px*2+ox,h:H+py*2}};
const lotOf=(id,entry,sl)=>{try{const f=window.__eagLot;return f?f(OVSYM.get(id),entry,sl)||"":""}catch(e){return""}};
/* de 2 esquinas opuestas a los 8 puntos de la caja */
/* rectángulo/zonas: 2 esquinas → 8 puntos. Ojo: un punto dibujado a la derecha de la última vela no trae hora (solo índice);
   antes se tomaba como hora 0 y el cuadro "se iba" años atrás al estirarlo. */
const okT=t=>typeof t==="number"&&t>1e11;
/* hora exacta ⇄ posición fraccionaria en las velas: así una zona queda EXACTA en cualquier temporalidad
   (antes cada esquina se pegaba a la vela más cercana: en H1/H4 la caja se encogía o desaparecía) */
const perMs=L=>{const n=L.length;if(n<2)return 60000;const d=[];for(let k=Math.max(1,n-30);k<n;k++)d.push(L[k].timestamp-L[k-1].timestamp);d.sort((a,b)=>a-b);return d[d.length>>1]||60000};
function fiOfTs(L,ts){const n=L.length;if(!n||!okT(ts))return null;const P=perMs(L);
  if(ts<=L[0].timestamp)return(ts-L[0].timestamp)/P;if(ts>=L[n-1].timestamp)return n-1+(ts-L[n-1].timestamp)/P;
  let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(L[m].timestamp<=ts)lo=m;else hi=m}
  const a=L[lo].timestamp,b=L[hi].timestamp;return lo+(b>a?(ts-a)/(b-a):0)}
function tsOfFi(L,fi){const n=L.length;if(!n||!isFinite(fi))return null;const P=perMs(L);
  if(fi<=0)return Math.round(L[0].timestamp+fi*P);if(fi>=n-1)return Math.round(L[n-1].timestamp+(fi-(n-1))*P);
  const j=Math.floor(fi);return Math.round(L[j].timestamp+(fi-j)*(L[j+1].timestamp-L[j].timestamp))}
const SELBOX=new Set();
function boxPts(a,b){const both=a.dataIndex!=null&&b.dataIndex!=null;
  const aFirst=both?a.dataIndex<=b.dataIndex:(okT(a.timestamp)&&okT(b.timestamp)?a.timestamp<=b.timestamp:(okT(a.timestamp)?true:!okT(b.timestamp)));
  const L=aFirst?a:b,R=aFirst?b:a,T=Math.max(a.value,b.value),B=Math.min(a.value,b.value);
  const mid={};if(both)mid.dataIndex=Math.round((L.dataIndex+R.dataIndex)/2);if(okT(L.timestamp)&&okT(R.timestamp))mid.timestamp=Math.round((L.timestamp+R.timestamp)/2);
  if(mid.dataIndex==null&&mid.timestamp==null){if(L.dataIndex!=null)mid.dataIndex=L.dataIndex;if(okT(L.timestamp))mid.timestamp=L.timestamp}
  const P=(x,v)=>{const o={value:v};if(x.dataIndex!=null)o.dataIndex=x.dataIndex;if(okT(x.timestamp))o.timestamp=x.timestamp;return o};
  return[P(L,T),P(R,T),P(R,B),P(L,B),P(mid,T),P(R,(T+B)/2),P(mid,B),P(L,(T+B)/2)]}
let registered=false;let EAG_TZ="America/Bogota";
/* tamaño de letra de la regla (lo pone cada gráfico en applyStyles): las etiquetas de los dibujos crecen igual que los precios */
let AXF=11;const axPad=()=>Math.round(AXF*.28);
/* eje del tiempo: siempre tamaño normal (el tamaño de letra del usuario solo agranda la regla de precios) */
const axStX=bg=>({color:"#fff",size:11,backgroundColor:bg,paddingLeft:5,paddingRight:5,paddingTop:3,paddingBottom:3,borderRadius:2});
const axSt=(bg,x)=>Object.assign({color:"#fff",size:AXF,backgroundColor:bg,paddingLeft:Math.round(AXF*.4),paddingRight:Math.round(AXF*.4),paddingTop:axPad(),paddingBottom:axPad(),borderRadius:2},x||{});
function registerAll(){
  if(registered)return;registered=true;
  /* agarrar líneas como en TradingView/Deriv: el motor solo aceptaba el clic a 2 px de la línea; ahora a 6 px (mismo dibujo) */
  try{const LineC=KC.getFigureClass&&KC.getFigureClass("line");
    if(LineC){const TOL=6;
      const near=(c,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;let t=l2?((c.x-a.x)*dx+(c.y-a.y)*dy)/l2:0;t=Math.max(0,Math.min(1,t));const px=a.x+t*dx-c.x,py=a.y+t*dy-c.y;return px*px+py*py<=TOL*TOL};
      KC.registerFigure({name:"line",
        checkEventOn:(c,attrs)=>{const L=[].concat(attrs);for(const l of L){const cs=l&&l.coordinates||[];for(let i=1;i<cs.length;i++)if(near(c,cs[i-1],cs[i]))return true}return false},
        draw:(ctx,attrs,styles)=>{new LineC({name:"line",attrs,styles}).draw(ctx)}})}}catch(e){console.warn("línea",e)}
  /* líneas horizontales y verticales: su precio queda SIEMPRE marcado en la regla y su hora abajo en el eje del tiempo
     (se envuelven las herramientas originales de klinecharts y solo se les agrega la etiqueta) */
  try{
    const lineCol=(ov,ds)=>((ov.styles||{}).line||{}).color||((ds||{}).line||{}).color||"#1677ff";
    const pf=(v,pr)=>(+v).toLocaleString("en-US",{minimumFractionDigits:pr,maximumFractionDigits:pr});
    const tf=ts=>{try{const d=new Date(ts),o={timeZone:EAG_TZ||undefined,hour12:false};const p=new Intl.DateTimeFormat("en-CA",Object.assign({month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"},o)).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});return `${p.month}-${p.day} ${p.hour==="24"?"00":p.hour}:${p.minute}`}catch(e){return""}};
    const yLab=({overlay,coordinates,precision,defaultStyles})=>{if(!coordinates.length||!overlay.points||!overlay.points.length)return[];const pr=(precision&&precision.price!=null)?precision.price:2,c=lineCol(overlay,defaultStyles);
      return[{type:"text",ignoreEvent:true,attrs:{x:0,y:coordinates[0].y,text:pf(overlay.points[0].value,pr),align:"left",baseline:"middle"},styles:axSt(c)}]};
    const xLab=({overlay,coordinates,defaultStyles})=>{if(!coordinates.length||!overlay.points||!overlay.points.length)return[];const ts=overlay.points[0].timestamp;if(!ts)return[];const c=lineCol(overlay,defaultStyles);
      return[{type:"text",ignoreEvent:true,attrs:{x:coordinates[0].x,y:3,text:tf(ts),align:"center",baseline:"top"},styles:axStX(c)}]};
    /* se reescriben las 6 líneas (mismos nombres y mismos puntos que las originales, así los dibujos guardados siguen igual) */
    const L1=(a,b)=>({type:"line",attrs:{coordinates:[a,b]}});
    const sameY=({points,performPoint})=>{if(points[0])points[0].value=performPoint.value;if(points[1])points[1].value=performPoint.value};
    const sameX=({points,performPoint})=>{[points[0],points[1]].forEach(p=>{if(!p)return;p.timestamp=performPoint.timestamp;p.dataIndex=performPoint.dataIndex})};
    const H={needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:false,createYAxisFigures:yLab};
    const V={needDefaultPointFigure:true,needDefaultXAxisFigure:false,needDefaultYAxisFigure:true,createXAxisFigures:xLab};
    KC.registerOverlay(Object.assign({name:"horizontalStraightLine",totalStep:2,
      createPointFigures:({coordinates,bounding})=>coordinates.length?[L1({x:0,y:coordinates[0].y},{x:bounding.width,y:coordinates[0].y})]:[]},H));
    KC.registerOverlay(Object.assign({name:"horizontalRayLine",totalStep:3,
      createPointFigures:({coordinates,bounding})=>{if(!coordinates.length)return[];const e={x:0,y:coordinates[0].y};if(!coordinates[1]||coordinates[0].x<coordinates[1].x)e.x=bounding.width;return[L1(coordinates[0],e)]},
      performEventPressedMove:sameY,performEventMoveForDrawing:({currentStep,points,performPoint})=>{if(currentStep===2&&points[0])performPoint.value=points[0].value}},H));
    KC.registerOverlay(Object.assign({name:"horizontalSegment",totalStep:3,
      createPointFigures:({coordinates})=>coordinates.length===2?[L1(coordinates[0],coordinates[1])]:[],
      performEventPressedMove:sameY,performEventMoveForDrawing:({currentStep,points,performPoint})=>{if(currentStep===2&&points[0])performPoint.value=points[0].value}},H));
    KC.registerOverlay(Object.assign({name:"verticalStraightLine",totalStep:2,
      createPointFigures:({coordinates,bounding})=>coordinates.length?[L1({x:coordinates[0].x,y:0},{x:coordinates[0].x,y:bounding.height})]:[]},V));
    KC.registerOverlay(Object.assign({name:"verticalRayLine",totalStep:3,
      createPointFigures:({coordinates,bounding})=>{if(!coordinates.length)return[];const e={x:coordinates[0].x,y:0};if(!coordinates[1]||coordinates[0].y<coordinates[1].y)e.y=bounding.height;return[L1(coordinates[0],e)]},
      performEventPressedMove:sameX,performEventMoveForDrawing:({currentStep,points,performPoint})=>{if(currentStep===2&&points[0]){performPoint.timestamp=points[0].timestamp;performPoint.dataIndex=points[0].dataIndex}}},V));
    KC.registerOverlay(Object.assign({name:"verticalSegment",totalStep:3,
      createPointFigures:({coordinates})=>coordinates.length===2?[L1(coordinates[0],coordinates[1])]:[],
      performEventPressedMove:sameX,performEventMoveForDrawing:({currentStep,points,performPoint})=>{if(currentStep===2&&points[0]){performPoint.timestamp=points[0].timestamp;performPoint.dataIndex=points[0].dataIndex}}},V));
  }catch(e){console.warn("etiquetas de líneas",e)}
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
      lab(cx,e.y,`${side==="long"?"▲ Compra":"▼ Venta"} ${fmt(ev,pp)} · R:B 1:${risk?(rew/risk).toFixed(2):"—"}${okDir?"":" ⚠"}${(l=>l?" · "+l:"")(lotOf(overlay.id,ev,sv))}`,"#2a2d35")]};
  ["eagLong","eagShort"].forEach(n=>KC.registerOverlay({name:n,totalStep:2,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,createPointFigures:posFig(n==="eagLong"?"long":"short")}));
  /* línea de alerta (solo se muestra; se maneja desde el panel de alertas) */
  KC.registerOverlay({name:"eagAlert",totalStep:2,needDefaultPointFigure:false,needDefaultXAxisFigure:false,needDefaultYAxisFigure:true,lock:true,
    createPointFigures:({overlay,coordinates,bounding})=>{const c=coordinates[0];if(!c)return[];const ex=overlay.extendData||{};const col="#ff9800";
      return[{type:"line",ignoreEvent:true,attrs:{coordinates:[{x:0,y:c.y},{x:bounding.width,y:c.y}]},styles:{color:col,size:1,style:"dashed",dashedValue:[6,4]}},
        {type:"text",ignoreEvent:true,attrs:{x:8,y:c.y-9,text:`🔔 ${ex.label||"Alerta"}`,baseline:"middle"},styles:{color:"#16120a",size:AXF,backgroundColor:col,paddingLeft:6,paddingRight:6,paddingTop:2,paddingBottom:2,borderRadius:4}}]}});
  /* etiqueta del precio actual en la regla: se dibuja en la capa de dibujos con el nivel MÁS BAJO,
     así las etiquetas de tus líneas, zonas y alertas SIEMPRE quedan encima del precio y se pueden leer */
  KC.registerOverlay({name:"eagLastPx",totalStep:2,lock:true,needDefaultPointFigure:false,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,
    createPointFigures:()=>[],
    createYAxisFigures:({overlay,bounding,yAxis})=>{const g=(overlay.extendData||{}).get,r=g&&g();if(!r||!yAxis)return[];
      let y;try{y=yAxis.convertToNicePixel?yAxis.convertToNicePixel(r.v):yAxis.convertToPixel(r.v)}catch(e){return[]}
      if(!isFinite(y))return[];const z=yAxis.isFromZero&&yAxis.isFromZero();
      const at={x:z?0:bounding.width,y,text:r.t,align:z?"left":"right",baseline:"middle"};if(r.w)at.width=r.w;if(r.draw)r.draw(y,!!z);
      return[{type:"text",ignoreEvent:true,attrs:at,styles:r.st}]}});
  /* Pincel: trazo libre a mano alzada */
  KC.registerOverlay({name:"eagBrush",totalStep:2,needDefaultPointFigure:false,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,
    createPointFigures:({overlay,coordinates,barSpace,yAxis})=>{if(coordinates.length<2)return[];const ex=overlay.extendData||{};
      let cs=coordinates;
      /* trazo nuevo: puntos relativos al primero (en velas y precio) → sigue la forma exacta al hacer zoom o mover el gráfico */
      if(Array.isArray(ex.rel)&&ex.rel.length>1&&yAxis&&barSpace&&barSpace.bar){const x0=coordinates[0].x,v0=overlay.points[0].value,b=barSpace.bar;
        cs=ex.rel.map(([dx,dv])=>({x:x0+dx*b,y:yAxis.convertToPixel(v0+dv)}))}
      return[{type:"line",attrs:{coordinates:cs},styles:{color:ex.hl?hexA(ex.color||"#ffeb3b",.4):(ex.color||GOLD),size:ex.size||2,smooth:false}}]}});
  /* Medir: diferencia de precio, %, velas y tiempo */
  KC.registerOverlay({name:"eagMeasure",totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
    createPointFigures:({overlay,coordinates,precision,xAxis,bounding})=>{
      if(coordinates.length<2)return[];
      const[a,b]=coordinates,p=overlay.points,pp=(precision&&precision.price)||3;
      const d=p[1].value-p[0].value,up=d>=0,col=up?"#2962ff":"#f23645",pip=Math.pow(10,-pp),ticks=Math.round(Math.abs(d)/pip);
      let bars=0;try{const L=xAxis.getParent().getChart().getDataList(),f0=fiOfTs(L,p[0].timestamp),f1=fiOfTs(L,p[1].timestamp);bars=f0!=null&&f1!=null?Math.round(f1-f0):((p[1].dataIndex!=null&&p[0].dataIndex!=null)?p[1].dataIndex-p[0].dataIndex:0)}catch(e){}
      const ms=Math.abs((p[1].timestamp||0)-(p[0].timestamp||0)),mins=Math.round(ms/6e4);
      const tt=mins>=1440?Math.floor(mins/1440)+"d "+Math.floor(mins%1440/60)+"h":mins>=60?Math.floor(mins/60)+"h "+(mins%60)+"m":mins+"m";
      const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y),mx=(a.x+b.x)/2;
      return[{type:"rect",attrs:{x,y,width:w,height:h},styles:{style:"fill",color:hexA(col,.15)}},
        {type:"line",attrs:{coordinates:[{x:mx,y:a.y},{x:mx,y:b.y}]},styles:{color:col,size:1}},
        {type:"line",attrs:{coordinates:[{x:a.x,y:(a.y+b.y)/2},{x:b.x,y:(a.y+b.y)/2}]},styles:{color:col,size:1,style:"dashed"}},
        /* la etiqueta nunca se sale de la pantalla (en el celular se cortaba el precio al mover la regla) y en pantallas angostas va en 2 líneas */
        ...(()=>{const t1=`${d>=0?"+":""}${d.toFixed(pp)} pts (${(d/p[0].value*100).toFixed(2)}%)`,t2=`${Math.abs(bars)} velas · ${tt}`,
            BW=(bounding&&bounding.width)||9999,BH=(bounding&&bounding.height)||9999,two=BW<520,lines=two?[t1,t2]:[t1+" · "+t2],
            wOf=t=>t.length*6.3+14,mw=Math.max(...lines.map(wOf)),cx=Math.max(mw/2+4,Math.min(BW-mw/2-4,mx)),lh=19,
            tot=lines.length*lh;let y0=up?y-8-tot+lh/2:y+h+8+lh/2;
            if(y0-lh/2<4)y0=up?Math.min(y+h+8+lh/2,BH-tot):4+lh/2;if(y0+tot-lh/2>BH-4)y0=Math.max(4+lh/2,y-8-tot+lh/2);
            return lines.map((t,i)=>({type:"text",ignoreEvent:true,attrs:{x:cx,y:y0+i*lh,text:t,align:"center",baseline:"middle"},
              styles:{color:"#fff",size:11,weight:i?"500":"700",backgroundColor:col,paddingLeft:6,paddingRight:6,paddingTop:3,paddingBottom:3,borderRadius:4}}))})()]}});
  /* Historial de operaciones (como MT5): flecha donde abriste, línea punteada y marca donde cerraste, con el resultado */
  KC.registerOverlay({name:"eagTradeHist",totalStep:3,needDefaultPointFigure:false,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,lock:true,
    createPointFigures:({overlay,coordinates})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,ex=overlay.extendData||{},buy=ex.side!=="sell",col=buy?"#2962ff":"#f23645",win=(+ex.profit||0)>=0;
      const tri=(c,up,fill)=>({type:"polygon",ignoreEvent:true,attrs:{coordinates:up?[{x:c.x,y:c.y-1},{x:c.x-6,y:c.y+9},{x:c.x+6,y:c.y+9}]:[{x:c.x,y:c.y+1},{x:c.x-6,y:c.y-9},{x:c.x+6,y:c.y-9}]},styles:{style:fill?"fill":"stroke",color:col,borderColor:col,borderSize:1.5}});
      const F=[{type:"line",ignoreEvent:true,attrs:{coordinates:[a,b]},styles:{color:col,size:1.2,style:"dashed",dashedValue:[4,3]}},
        tri({x:a.x,y:a.y+(buy?2:-2)},buy,true),tri({x:b.x,y:b.y+(buy?-2:2)},!buy,false)];
      if(ex.label)F.push({type:"text",ignoreEvent:true,attrs:{x:b.x+8,y:b.y,text:ex.label,align:"left",baseline:"middle"},styles:{color:"#fff",size:10.5,weight:"600",backgroundColor:win?"rgba(8,153,129,.92)":"rgba(242,54,69,.92)",paddingLeft:5,paddingRight:5,paddingTop:2,paddingBottom:2,borderRadius:4}});
      return F}});
  /* Texto */
  KC.registerOverlay({name:"eagText",totalStep:2,needDefaultPointFigure:false,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
    createPointFigures:({overlay,coordinates})=>{const c=coordinates[0];if(!c)return[];const ex=overlay.extendData||{},m=txtLay(ex);
      return[{type:"eagTxt",ignoreEvent:true,attrs:{x:c.x,y:c.y,ex}},{type:"rect",attrs:{x:c.x,y:c.y-m.h/2,width:Math.max(30,m.w),height:Math.max(16,m.h)},styles:{style:"fill",color:"rgba(0,0,0,0)"}}]}});
  /* Nota con flecha: un cuadro con tu texto y una flecha que apunta al precio/vela que marcaste */
  KC.registerOverlay({name:"eagNote",totalStep:2,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
    createPointFigures:({overlay,coordinates})=>{const c=coordinates[0];if(!c)return[];const ex=overlay.extendData||{},col=ex.color||GOLD,bg=ex.bg===null?null:(ex.bg||col);
      const tex=Object.assign({size:12,b:true,r:6,bga:1},ex,{color:ex.tc||"#ffffff",bg,text:ex.text||"Nota",fx:ex.fx||(bg?"none":"halo"),rot:0}),m=txtLay(tex),up=c.y>m.h+40,ty=up?c.y-29-m.h/2:c.y+29+m.h/2;
      return[{type:"line",attrs:{coordinates:[{x:c.x,y:up?c.y-29:c.y+29},{x:c.x,y:up?c.y-7:c.y+7}]},styles:{color:col,size:1.5}},
        {type:"polygon",attrs:{coordinates:up?[{x:c.x,y:c.y-3},{x:c.x-4.5,y:c.y-10},{x:c.x+4.5,y:c.y-10}]:[{x:c.x,y:c.y+3},{x:c.x-4.5,y:c.y+10},{x:c.x+4.5,y:c.y+10}]},styles:{style:"fill",color:col}},
        {type:"eagTxt",ignoreEvent:true,attrs:{x:c.x,y:ty,ex:tex,anc:"center"}},
        {type:"rect",attrs:{x:c.x-m.w/2,y:ty-m.h/2,width:m.w,height:m.h},styles:{style:"fill",color:"rgba(0,0,0,0)"}}]}});
  /* ===================== Herramientas extra (como TradingView) ===================== */
  {
    const LC=ov=>(((ov.styles||{}).line||{}).color)||GOLD;
    const LN=(a,b,st)=>({type:"line",attrs:{coordinates:[a,b]},styles:st});
    const PL=(pts,st)=>({type:"line",attrs:{coordinates:pts},styles:st});
    const TX=(x,y,t,o2)=>({type:"text",ignoreEvent:true,attrs:{x,y,text:t,align:(o2&&o2.al)||"center",baseline:(o2&&o2.bl)||"middle"},styles:Object.assign({color:"#fff",size:11,backgroundColor:"transparent",paddingLeft:5,paddingRight:5,paddingTop:3,paddingBottom:3,borderRadius:4},(o2&&o2.st)||{})});
    const BOXT=(x,y,t,col,o2)=>TX(x,y,t,Object.assign({},o2,{st:Object.assign({color:"#fff",backgroundColor:col,size:11,weight:"600"},(o2&&o2.st)||{})}));
    const ext=(a,b,W,H)=>{/* extiende el segmento a→b hasta el borde */const dx=b.x-a.x,dy=b.y-a.y;if(!dx&&!dy)return b;let t=1e6;if(dx>0)t=Math.min(t,(W-a.x)/dx);if(dx<0)t=Math.min(t,-a.x/dx);if(dy>0)t=Math.min(t,(H-a.y)/dy);if(dy<0)t=Math.min(t,-a.y/dy);return{x:a.x+dx*t,y:a.y+dy*t}};
    const dataOf=xAxis=>{try{return xAxis.getParent().getChart().getDataList()}catch(e){return[]}};
    const idxOf=(L,p)=>{if(!p)return null;if(p.timestamp!=null&&L.length){const fi=fiOfTs(L,p.timestamp);if(fi!=null)return Math.round(fi)}return p.dataIndex!=null?p.dataIndex:null};
    const barsOf=(xAxis,P)=>{const L=dataOf(xAxis);const a=idxOf(L,P[0]),b=idxOf(L,P[1]);return a!=null&&b!=null?Math.abs(b-a):0};
    const durTxt=ms=>{const m=Math.round(Math.abs(ms)/6e4);return m>=1440?Math.floor(m/1440)+"d "+Math.floor(m%1440/60)+"h":m>=60?Math.floor(m/60)+"h "+(m%60)+"m":m+"m"};
    const R=(n,t)=>KC.registerOverlay(Object.assign({name:n,needDefaultPointFigure:true,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false},t));
    /* Línea de información: tendencia con el cambio de precio, %, velas, tiempo y ángulo */
    R("infoLine",{totalStep:3,createPointFigures:({overlay,coordinates,precision,xAxis})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,P=overlay.points,pp=(precision&&precision.price)||3,col=LC(overlay);
      const d=P[1].value-P[0].value,bars=barsOf(xAxis,P),ang=Math.round(Math.atan2(a.y-b.y,b.x-a.x)*180/Math.PI);
      const t=`${d>=0?"+":""}${d.toFixed(pp)} (${(d/P[0].value*100).toFixed(2)}%) · ${bars} velas · ${durTxt((P[1].timestamp||0)-(P[0].timestamp||0))} · ${ang}°`;
      return[LN(a,b),BOXT(b.x,b.y+(b.y<a.y?-16:16),t,hexA(col,.92),{al:b.x>=a.x?"left":"right"})]}});
    /* Ángulo de tendencia */
    R("trendAngle",{totalStep:3,createPointFigures:({coordinates})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,ang=Math.atan2(a.y-b.y,b.x-a.x),r=Math.min(60,Math.hypot(b.x-a.x,b.y-a.y)*.6);
      const arc=[];for(let k=0;k<=16;k++){const t=-ang*k/16;arc.push({x:a.x+r*Math.cos(t),y:a.y+r*Math.sin(t)})}
      return[LN(a,b),LN(a,{x:a.x+r+20,y:a.y},{style:"dashed",dashedValue:[3,3]}),PL(arc),TX(a.x+r+24,a.y+(ang>0?-10:10),Math.round(ang*180/Math.PI)+"°",{al:"left",st:{color:"#fff",size:12,weight:"600"}})]}});
    /* Línea cruzada: horizontal + vertical */
    R("crossLine",{totalStep:2,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,createPointFigures:({coordinates,bounding})=>{const c=coordinates[0];if(!c)return[];
      return[LN({x:0,y:c.y},{x:bounding.width,y:c.y}),LN({x:c.x,y:0},{x:c.x,y:bounding.height})]}});
    /* Tendencia de regresión lineal (cierres entre los 2 puntos) con bandas de ±2 desviaciones */
    R("regressionTrend",{totalStep:3,createPointFigures:({overlay,coordinates,xAxis,yAxis})=>{if(coordinates.length<2)return[];const L=dataOf(xAxis);let i0=idxOf(L,overlay.points[0]),i1=idxOf(L,overlay.points[1]);
      if(i0==null||i1==null||!L.length)return[LN(coordinates[0],coordinates[1])];if(i0>i1){const t=i0;i0=i1;i1=t}i0=Math.max(0,i0);i1=Math.min(L.length-1,i1);const n=i1-i0+1;if(n<3)return[LN(coordinates[0],coordinates[1])];
      let sx=0,sy=0,sxy=0,sxx=0;for(let i=i0;i<=i1;i++){const x=i-i0,y=L[i].close;sx+=x;sy+=y;sxy+=x*y;sxx+=x*x}const m=(n*sxy-sx*sy)/(n*sxx-sx*sx||1),q=(sy-m*sx)/n;
      let ss=0;for(let i=i0;i<=i1;i++){const e=L[i].close-(m*(i-i0)+q);ss+=e*e}const sd=Math.sqrt(ss/n)*2;
      const X0=xAxis.convertToPixel(i0),X1=xAxis.convertToPixel(i1),Y=v=>yAxis.convertToPixel(v),v0=q,v1=m*(n-1)+q,col=LC(overlay);
      return[{type:"polygon",ignoreEvent:true,attrs:{coordinates:[{x:X0,y:Y(v0+sd)},{x:X1,y:Y(v1+sd)},{x:X1,y:Y(v1-sd)},{x:X0,y:Y(v0-sd)}]},styles:{style:"fill",color:hexA(col,.1)}},
        LN({x:X0,y:Y(v0)},{x:X1,y:Y(v1)}),LN({x:X0,y:Y(v0+sd)},{x:X1,y:Y(v1+sd)},{style:"dashed",dashedValue:[4,3]}),LN({x:X0,y:Y(v0-sd)},{x:X1,y:Y(v1-sd)},{style:"dashed",dashedValue:[4,3]})]}});
    /* Tridente de Andrews */
    R("pitchfork",{totalStep:4,createPointFigures:({coordinates,bounding})=>{const c=coordinates;if(c.length<2)return[];if(c.length<3)return[LN(c[0],c[1])];
      const m={x:(c[1].x+c[2].x)/2,y:(c[1].y+c[2].y)/2},dx=m.x-c[0].x,dy=m.y-c[0].y,W=bounding.width,H=bounding.height;
      const far=p=>ext(p,{x:p.x+dx,y:p.y+dy},W,H);
      return[LN(c[0],far(c[0])),LN(c[1],far(c[1])),LN(c[2],far(c[2])),LN(c[1],c[2],{style:"dashed",dashedValue:[3,3]})]}});
    /* Abanico de Gann */
    R("gannFan",{totalStep:3,createPointFigures:({coordinates,bounding})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,dx=b.x-a.x,dy=b.y-a.y;if(!dx)return[LN(a,b)];const F=[];
      [[8,1,"1x8"],[4,1,"1x4"],[3,1,"1x3"],[2,1,"1x2"],[1,1,"1x1"],[1,2,"2x1"],[1,3,"3x1"],[1,4,"4x1"],[1,8,"8x1"]].forEach(([kx,ky,t])=>{const e=ext(a,{x:a.x+dx*kx,y:a.y+dy*ky},bounding.width,bounding.height);
        F.push(LN(a,e,t==="1x1"?undefined:{style:"dashed",dashedValue:[4,3]}),TX(a.x+(e.x-a.x)*.92,a.y+(e.y-a.y)*.92,t,{st:{color:"#9da1aa",size:10}}))});return F}});
    /* Líneas cíclicas, ciclos de tiempo y línea sinusoidal */
    R("cyclicLines",{totalStep:3,createPointFigures:({coordinates,bounding})=>{if(coordinates.length<2)return[];const x0=coordinates[0].x,d=Math.abs(coordinates[1].x-x0);if(d<4)return[];const F=[];
      for(let x=x0;x<=bounding.width;x+=d)F.push(LN({x,y:0},{x,y:bounding.height},x===x0?undefined:{style:"dashed",dashedValue:[4,3]}));return F}});
    R("timeCycles",{totalStep:3,createPointFigures:({coordinates,bounding})=>{if(coordinates.length<2)return[];const x0=coordinates[0].x,y=coordinates[0].y,d=Math.abs(coordinates[1].x-x0);if(d<6)return[];const F=[];
      for(let x=x0;x<=bounding.width;x+=d){const P=[];for(let k=0;k<=20;k++){const t=Math.PI*k/20;P.push({x:x+d/2-d/2*Math.cos(t),y:y-d/2*Math.sin(t)})}F.push(PL(P))}return F}});
    R("sineLine",{totalStep:3,createPointFigures:({coordinates,bounding})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,hw=b.x-a.x,amp=(b.y-a.y)/2,mid=(a.y+b.y)/2;if(Math.abs(hw)<4)return[LN(a,b)];const P=[];
      for(let x=0;x<=bounding.width;x+=3)P.push({x,y:mid-amp*Math.cos(Math.PI*(x-a.x)/hw)});return[PL(P)]}});
    /* Patrones con etiquetas */
    const PAT=(n,steps,labs,extra)=>R(n,{totalStep:steps,createPointFigures:({overlay,coordinates})=>{const c=coordinates;if(c.length<2)return[];const col=LC(overlay),F=[PL(c)];
      c.forEach((p,i)=>{if(!labs[i])return;const up=i===0?(c[1]&&c[1].y>p.y):(c[i-1].y>p.y);F.push(BOXT(p.x,p.y+(up?-14:14),labs[i],hexA(col,.85),{st:{size:10,paddingTop:2,paddingBottom:2}}))});
      if(extra)F.push(...extra(c));return F}});
    PAT("headShoulders",8,["","Hombro izq.","","Cabeza","","Hombro der.",""],c=>c.length>=5?[LN(c[2],c[4],{style:"dashed",dashedValue:[5,3]})]:[]);
    PAT("trianglePattern",5,["A","B","C","D"],c=>{const F=[];if(c.length>=3)F.push(LN(c[0],c[2],{style:"dashed",dashedValue:[4,3]}));if(c.length>=4)F.push(LN(c[1],c[3],{style:"dashed",dashedValue:[4,3]}));return F});
    PAT("threeDrives",8,["0","1","A","2","B","3",""]);
    PAT("elliottCorrection",5,["0","A","B","C"]);
    PAT("elliottTriangle",7,["0","A","B","C","D","E"]);
    PAT("elliottDouble",5,["0","W","X","Y"]);
    PAT("cypherPattern",6,["X","A","B","C","D"],c=>{const F=[];if(c.length>=3)F.push(LN(c[0],c[2],{style:"dashed",dashedValue:[4,3]}));if(c.length>=5)F.push(LN(c[2],c[4],{style:"dashed",dashedValue:[4,3]}));return F});
    /* Rango de fechas y rango de precios */
    R("dateRange",{totalStep:3,createPointFigures:({overlay,coordinates,bounding,xAxis})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,P=overlay.points,x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),col="#2962ff";
      const bars=barsOf(xAxis,P),ym=(a.y+b.y)/2;
      return[{type:"rect",ignoreEvent:true,attrs:{x:x0,y:0,width:x1-x0,height:bounding.height},styles:{style:"fill",color:hexA(col,.1)}},LN({x:x0,y:0},{x:x0,y:bounding.height},{color:col}),LN({x:x1,y:0},{x:x1,y:bounding.height},{color:col}),
        LN({x:x0,y:ym},{x:x1,y:ym},{color:col}),(()=>{const t=`${bars} velas · ${durTxt((P[1].timestamp||0)-(P[0].timestamp||0))}`,w=t.length*6.3+14;
          return BOXT(Math.max(w/2+4,Math.min(bounding.width-w/2-4,(x0+x1)/2)),Math.max(16,Math.min(a.y,b.y)-16),t,col)})()]}});
    R("priceRange",{totalStep:3,createPointFigures:({overlay,coordinates,bounding,precision})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,P=overlay.points,pp=(precision&&precision.price)||3,y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y),d=P[1].value-P[0].value,col=d>=0?"#2962ff":"#f23645";
      return[{type:"rect",ignoreEvent:true,attrs:{x:0,y:y0,width:bounding.width,height:y1-y0},styles:{style:"fill",color:hexA(col,.1)}},LN({x:0,y:y0},{x:bounding.width,y:y0},{color:col}),LN({x:0,y:y1},{x:bounding.width,y:y1},{color:col}),
        LN({x:(a.x+b.x)/2,y:a.y},{x:(a.x+b.x)/2,y:b.y},{color:col}),(()=>{const t=`${d>=0?"+":""}${d.toFixed(pp)} pts (${(d/P[0].value*100).toFixed(2)}%)`,w=t.length*6.3+14;
          return BOXT(Math.max(w/2+4,Math.min(bounding.width-w/2-4,(a.x+b.x)/2)),y0-14<12?Math.min(y1+14,bounding.height-12):y0-14,t,col)})()]}});
    /* VWAP anclado: desde la vela que eliges hasta la última (sin volumen real usa el precio típico) */
    R("anchoredVWAP",{totalStep:2,needDefaultPointFigure:true,createPointFigures:({overlay,xAxis,yAxis})=>{const L=dataOf(xAxis),i0=idxOf(L,overlay.points[0]);if(i0==null||!L.length||i0>=L.length)return[];
      let pv=0,vv=0;const P=[];for(let i=Math.max(0,i0);i<L.length;i++){const k=L[i],tp=(k.high+k.low+k.close)/3,v=k.volume>0?k.volume:1;pv+=tp*v;vv+=v;P.push({x:xAxis.convertToPixel(i),y:yAxis.convertToPixel(pv/vv)})}
      const last=P[P.length-1];return[PL(P),TX(last.x+4,last.y,"VWAP",{al:"left",st:{color:LC(overlay),size:10}})]}});
    /* Formas: elipse y curva */
    R("ellipse",{totalStep:3,createPointFigures:({overlay,coordinates})=>{if(coordinates.length<2)return[];const[a,b]=coordinates,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,rx=Math.abs(b.x-a.x)/2,ry=Math.abs(b.y-a.y)/2,P=[];
      for(let k=0;k<=48;k++){const t=k/48*Math.PI*2;P.push({x:cx+rx*Math.cos(t),y:cy+ry*Math.sin(t)})}const col=LC(overlay);
      return[{type:"polygon",attrs:{coordinates:P},styles:{style:"stroke_fill",color:hexA(col,.12),borderColor:col,borderSize:(((overlay.styles||{}).line||{}).size)||1}}]}});
    R("curve",{totalStep:4,createPointFigures:({coordinates})=>{const c=coordinates;if(c.length<2)return[];if(c.length<3)return[LN(c[0],c[1])];const P=[];
      for(let k=0;k<=30;k++){const t=k/30,u=1-t;P.push({x:u*u*c[0].x+2*u*t*c[1].x+t*t*c[2].x,y:u*u*c[0].y+2*u*t*c[1].y+t*t*c[2].y})}return[PL(P)]}});
    R("polyLine",{totalStep:Number.MAX_SAFE_INTEGER,createPointFigures:({coordinates})=>coordinates.length>1?[PL(coordinates)]:[]});
    /* Marcas: flechas arriba/abajo, bandera, etiqueta de precio y emoji */
    const ARW=(n,up)=>R(n,{totalStep:2,needDefaultPointFigure:false,createPointFigures:({overlay,coordinates})=>{const c=coordinates[0];if(!c)return[];const ex=overlay.extendData||{},col=ex.color||(up?"#089981":"#f23645"),k=+ex.sc||1,s=(up?1:-1)*k,y=c.y+s*6;
      return[{type:"polygon",attrs:{coordinates:[{x:c.x,y},{x:c.x-9*k,y:y+s*11},{x:c.x-4*k,y:y+s*11},{x:c.x-4*k,y:y+s*24},{x:c.x+4*k,y:y+s*24},{x:c.x+4*k,y:y+s*11},{x:c.x+9*k,y:y+s*11}]},styles:{style:"fill",color:col}}]}});
    ARW("arrowMarkUp",true);ARW("arrowMarkDown",false);
    R("flagMark",{totalStep:2,needDefaultPointFigure:false,createPointFigures:({overlay,coordinates})=>{const c=coordinates[0];if(!c)return[];const col=(overlay.extendData||{}).color||"#f23645",k=+(overlay.extendData||{}).sc||1;
      return[LN({x:c.x,y:c.y},{x:c.x,y:c.y-30*k},{color:col,size:Math.max(2,2*k)}),{type:"polygon",attrs:{coordinates:[{x:c.x,y:c.y-30*k},{x:c.x+18*k,y:c.y-25*k},{x:c.x,y:c.y-19*k}]},styles:{style:"fill",color:col}}]}});
    R("priceLabel",{totalStep:2,needDefaultPointFigure:false,createPointFigures:({overlay,coordinates,precision})=>{const c=coordinates[0],p=overlay.points[0];if(!c||!p)return[];const pp=(precision&&precision.price)||3,ex=overlay.extendData||{},col=ex.color||GOLD,k=+ex.sc||1;
      return[LN({x:c.x,y:c.y},{x:c.x+12*k,y:c.y-16*k},{color:col,size:1}),{type:"circle",attrs:{x:c.x,y:c.y,r:2.5*Math.sqrt(k)},styles:{style:"fill",color:col}},BOXT(c.x+10*k,c.y-22*k,(+p.value).toFixed(pp),col,{al:"left",st:{color:ex.tc||"#111",size:Math.round(11*k)}})]}});
    R("eagEmoji",{totalStep:2,needDefaultPointFigure:false,createPointFigures:({overlay,coordinates})=>{const c=coordinates[0];if(!c)return[];const ex=overlay.extendData||{};
      return[{type:"text",attrs:{x:c.x,y:c.y,text:ex.text||"🚀",align:"center",baseline:"middle"},styles:{color:"#fff",size:ex.size||28,backgroundColor:"transparent",paddingLeft:2,paddingRight:2,paddingTop:2,paddingBottom:2}}]}});
  }
  /* ===================== Fibonacci profesional: niveles editables, colores por nivel, sin salir de lado a lado ===================== */
  {
    const FC={0:"#787b86",.236:"#f23645",.382:"#ff9800",.5:"#4caf50",.618:"#089981",.786:"#00bcd4",1:"#787b86",1.272:"#9c27b0",1.414:"#e91e63",1.618:"#2962ff",2:"#ff9800",2.618:"#f23645",3.618:"#9c27b0",4.236:"#e91e63"};
    const L=(arr,on)=>arr.map(v=>({v,c:FC[v]||GOLD,on:on?on.includes(v):true}));
    window.__eagFibDef={
      fibonacciLine:{levels:L([0,.236,.382,.5,.618,.786,1,1.618,2.618,3.618,4.236],[0,.236,.382,.5,.618,.786,1,1.618]),ext:"none",fill:.08,prices:true,lvl:true,side:"left",trend:true,rev:false},
      fibonacciExtension:{levels:L([0,.236,.382,.5,.618,.786,1,1.272,1.414,1.618,2,2.618,3.618,4.236],[0,.382,.618,1,1.272,1.618,2,2.618]),ext:"none",fill:.08,prices:true,lvl:true,side:"left",trend:true,rev:false},
      fibonacciSpeedResistanceFan:{levels:L([0,.25,.382,.5,.618,.75,1]),ext:"right",fill:.05,prices:false,lvl:true,side:"right",trend:true,rev:false},
      fibonacciCircle:{levels:L([.236,.382,.5,.618,.786,1,1.618,2.618],[.382,.5,.618,1,1.618]),ext:"none",fill:.04,prices:false,lvl:true,side:"right",trend:true,rev:false},
      fibTimeZone:{levels:L([0,1,2,3,5,8,13,21,34,55,89,144]).map(l=>Object.assign(l,{c:l.v<2?"#787b86":"#2962ff"})),ext:"none",fill:0,prices:false,lvl:true,side:"top",trend:false,rev:false}};
    const cfgOf=ov=>{const d=window.__eagFibDef[ov.name]||{},f=(ov.extendData||{}).fib||{};const o2=Object.assign({},d,f);o2.levels=(f.levels&&f.levels.length?f.levels:d.levels||[]).filter(l=>l&&l.on!==false&&isFinite(+l.v)).map(l=>({v:+l.v,c:l.c||GOLD}));return o2};
    const lsz=ov=>(((ov.styles||{}).line||{}).size)||1;
    const fmtL=v=>(+v).toFixed(3).replace(/\.?0+$/,"")||"0";
    const T=(x,y,t,c,al,bl,o2)=>({type:"text",ignoreEvent:true,attrs:{x,y,text:t,align:al,baseline:bl},styles:Object.assign({color:c,size:11,backgroundColor:"transparent",paddingLeft:2,paddingRight:2,paddingTop:1,paddingBottom:1},o2||{})});
    const lvTxt=(cf,l,price,pp)=>[cf.lvl?fmtL(l.v):"",cf.prices&&price!=null?`(${(+price).toFixed(pp)})`:""].filter(Boolean).join(" ");
    /* retroceso y extensión: líneas solo entre los puntos (o extendidas si lo eliges), relleno por bandas y etiqueta por nivel */
    const band=(ov,cs,bd,yAxis,pp,base,dif,xa,xb,extra)=>{const cf=cfgOf(ov);let x0=Math.min(xa,xb),x1=Math.max(xa,xb);if(x1-x0<30)x1=x0+30;
      if(cf.ext==="right"||cf.ext==="both")x1=bd.width;if(cf.ext==="left"||cf.ext==="both")x0=0;
      const lv=cf.levels.slice().sort((a,b)=>a.v-b.v).map(l=>{const val=base+dif*(cf.rev?1-l.v:l.v);return Object.assign({},l,{val,y:yAxis.convertToPixel(val)})}),F=[];
      if(cf.fill>0)for(let i=0;i<lv.length-1;i++){const a=lv[i],b=lv[i+1];F.push({type:"rect",ignoreEvent:true,attrs:{x:x0,y:Math.min(a.y,b.y),width:x1-x0,height:Math.abs(b.y-a.y)},styles:{style:"fill",color:hexA(b.c,cf.fill)}})}
      const sz=lsz(ov);lv.forEach(l=>{F.push({type:"line",attrs:{coordinates:[{x:x0,y:l.y},{x:x1,y:l.y}]},styles:{color:l.c,size:sz,style:"solid"}});
        const t=lvTxt(cf,l,l.val,pp);if(t)F.push(cf.side==="right"?T(x1+4,l.y,t,l.c,"left","middle"):T(x0-4,l.y,t,l.c,"right","middle"))});
      if(extra)F.push(...extra(cf));return F};
    KC.registerOverlay({name:"fibonacciLine",totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
      createPointFigures:({overlay,coordinates,bounding,yAxis,precision})=>{const c=coordinates,P=overlay.points;if(c.length<2||!yAxis||!P[1]||!isFinite(P[0].value)||!isFinite(P[1].value))return[];
        const pp=(precision&&precision.price)||3;
        return band(overlay,c,bounding,yAxis,pp,P[1].value,P[0].value-P[1].value,c[0].x,c[1].x,cf=>cf.trend?[{type:"line",ignoreEvent:true,attrs:{coordinates:[c[0],c[1]]},styles:{color:"#787b86",size:1,style:"dashed",dashedValue:[4,4]}}]:[])}});
    KC.registerOverlay({name:"fibonacciExtension",totalStep:4,needDefaultPointFigure:true,needDefaultXAxisFigure:true,needDefaultYAxisFigure:true,
      createPointFigures:({overlay,coordinates,bounding,yAxis,precision})=>{const c=coordinates,P=overlay.points;if(c.length<2)return[];
        const tl={type:"line",ignoreEvent:true,attrs:{coordinates:c.slice(0,3)},styles:{color:"#787b86",size:1,style:"dashed",dashedValue:[4,4]}};if(c.length<3||!yAxis)return[tl];
        const pp=(precision&&precision.price)||3,w=Math.max(60,Math.abs(c[1].x-c[0].x));
        return band(overlay,c,bounding,yAxis,pp,P[2].value,P[1].value-P[0].value,c[2].x,c[2].x+(c[2].x>=c[1].x?w:-w),cf=>cf.trend?[tl]:[])}});
    /* abanico de Fibonacci: rayos desde el primer punto por cada nivel */
    KC.registerOverlay({name:"fibonacciSpeedResistanceFan",totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,
      createPointFigures:({overlay,coordinates,bounding})=>{const c=coordinates;if(c.length<2)return[];const[a,b]=c,cf=cfgOf(overlay),F=[],sz=lsz(overlay),W=bounding.width,H=bounding.height;
        const ext=(p,q)=>{const dx=q.x-p.x,dy=q.y-p.y;if(!dx&&!dy)return q;let t=1e6;if(dx>0)t=Math.min(t,(W-p.x)/dx);if(dx<0)t=Math.min(t,-p.x/dx);if(dy>0)t=Math.min(t,(H-p.y)/dy);if(dy<0)t=Math.min(t,-p.y/dy);return{x:p.x+dx*t,y:p.y+dy*t}};
        const lv=cf.levels.slice().sort((x,y)=>x.v-y.v);const pts=[];
        lv.forEach(l=>{const q={x:b.x,y:a.y+(b.y-a.y)*l.v},e=cf.ext==="none"?q:ext(a,q);pts.push(e);F.push({type:"line",attrs:{coordinates:[a,e]},styles:{color:l.c,size:sz}});if(cf.lvl)F.push(T(e.x+(e.x>=a.x?4:-4),e.y,fmtL(l.v),l.c,e.x>=a.x?"left":"right","middle"))});
        if(cf.fill>0)for(let i=0;i<pts.length-1;i++)F.unshift({type:"polygon",ignoreEvent:true,attrs:{coordinates:[a,pts[i],pts[i+1]]},styles:{style:"fill",color:hexA(lv[i+1].c,cf.fill)}});
        if(cf.trend)F.push({type:"line",ignoreEvent:true,attrs:{coordinates:[{x:a.x,y:b.y},{x:b.x,y:b.y},{x:b.x,y:a.y}]},styles:{color:"#787b86",size:1,style:"dashed",dashedValue:[3,3]}});return F}});
    /* círculos de Fibonacci: centro en el primer punto */
    KC.registerOverlay({name:"fibonacciCircle",totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,
      createPointFigures:({overlay,coordinates})=>{const c=coordinates;if(c.length<2)return[];const[a,b]=c,R=Math.hypot(b.x-a.x,b.y-a.y),cf=cfgOf(overlay),F=[],sz=lsz(overlay);
        cf.levels.slice().sort((x,y)=>y.v-x.v).forEach(l=>{const r=R*l.v;if(r<1)return;F.push({type:"circle",attrs:{x:a.x,y:a.y,r},styles:{style:cf.fill>0?"stroke_fill":"stroke",color:hexA(l.c,cf.fill||.0001),borderColor:l.c,borderSize:sz}});
          if(cf.lvl)F.push(T(a.x+r+3,a.y,fmtL(l.v),l.c,"left","bottom"))});
        if(cf.trend)F.push({type:"line",ignoreEvent:true,attrs:{coordinates:[a,b]},styles:{color:"#787b86",size:1,style:"dashed",dashedValue:[4,4]}});return F}});
    /* zonas de tiempo de Fibonacci (con niveles editables) */
    KC.registerOverlay({name:"fibTimeZone",totalStep:3,needDefaultPointFigure:true,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,
      createPointFigures:({overlay,coordinates,bounding})=>{if(coordinates.length<2)return[];const x0=coordinates[0].x,d=coordinates[1].x-x0;if(Math.abs(d)<2)return[];const cf=cfgOf(overlay),F=[],sz=lsz(overlay);
        cf.levels.forEach(l=>{const x=x0+d*l.v;if(x<-5||x>bounding.width+5)return;F.push({type:"line",attrs:{coordinates:[{x,y:0},{x,y:bounding.height}]},styles:{color:l.c,size:sz}});if(cf.lvl)F.push(T(x+3,12,fmtL(l.v),l.c,"left","middle",{size:10}))});return F}});
  }
  /* Zona: rectángulo que se extiende a la derecha (ideal para zonas de oferta y demanda) */
  /* ===== Cajas con 8 puntos (4 esquinas + 4 a la mitad de cada lado) ===== */
  /* orden: 0 sup-izq · 1 sup-der · 2 inf-der · 3 inf-izq · 4 mitad arriba · 5 mitad derecha · 6 mitad abajo · 7 mitad izquierda */
  const exactXs=(overlay,coordinates,xAxis)=>{try{const L=xAxis.getParent().getChart().getDataList();const P=overlay.points||[];
      return coordinates.map((c,k)=>{const q=P[k];const fi=q&&okT(q.timestamp)?fiOfTs(L,q.timestamp):null;return fi==null?c.x:xAxis.convertToPixel(fi)})}catch(e){return coordinates.map(c=>c.x)}};
  const boxFig=kind=>({overlay,coordinates,bounding,xAxis,precision})=>{
    if(coordinates.length<2)return[];const ex=overlay.extendData||{};
    const xs0=exactXs(overlay,coordinates,xAxis),ys=coordinates.map(c=>c.y);let x1=Math.min(...xs0),x2=Math.max(...xs0);if(x2-x1<2)x2=x1+2;const xR=x2;const y1=Math.min(...ys),y2=Math.max(...ys),h=y2-y1;
    if(kind==="zoneR")x2=bounding.width;
    const F=[];
    /* manijas propias (en la posición exacta), solo con el dibujo seleccionado */
    const hdl=()=>{if(!SELBOX.has(overlay.id)||coordinates.length<8)return;const xm=(x1+xR)/2,ym=(y1+y2)/2,c=ex.color||((overlay.styles||{}).point||{}).borderColor||GOLD;
      [[x1,y1],[xR,y1],[xR,y2],[x1,y2],[xm,y1],[xR,ym],[xm,y2],[x1,ym]].forEach(([x,y],k)=>F.push({type:"circle",key:"hdl_"+k,attrs:{x,y,r:5},styles:{style:"stroke_fill",color:"#0b1220",borderColor:"#d9b25a",borderSize:1.5}}))};
    if(kind==="buy"||kind==="sell"){const top=kind==="buy"?(ex.up||"#089981"):(ex.dn||"#f23645"),bot=kind==="buy"?(ex.dn||"#f23645"):(ex.up||"#089981"),col=ex.color||"#b46cff",lw=ex.size||2;
      F.push({type:"rect",attrs:{x:x1,y:y1,width:x2-x1,height:h},styles:{style:"stroke_fill",color:hexA(col,.16),borderColor:col,borderSize:1}});
      F.push({type:"line",key:"edgeT",attrs:{coordinates:[{x:0,y:y1},{x:bounding.width,y:y1}]},styles:{color:top,size:lw}});
      F.push({type:"line",key:"edgeB",attrs:{coordinates:[{x:0,y:y2},{x:bounding.width,y:y2}]},styles:{color:bot,size:lw}});
      const tv=overlay.points&&overlay.points.length?Math.max(...overlay.points.map(q=>q.value)):null,bv=overlay.points&&overlay.points.length?Math.min(...overlay.points.map(q=>q.value)):null;
      const lot=tv!=null?lotOf(overlay.id,kind==="buy"?tv:bv,kind==="buy"?bv:tv):"";
      /* cuántos puntos mide la zona (de la entrada al SL) */
      const pr=(precision&&precision.price!=null)?precision.price:2,pts=tv!=null?Math.abs(tv-bv):null,ptsT=pts!=null?pts.toLocaleString("en-US",{minimumFractionDigits:pr,maximumFractionDigits:pr})+" pts":"";
      F.push({type:"text",ignoreEvent:true,attrs:{x:x1+6,y:y1+6,text:(ex.text||(kind==="buy"?"Compra":"Venta"))+(ptsT?" · "+ptsT:"")+(lot?" · "+lot:""),baseline:"top"},styles:{color:"#fff",size:11,backgroundColor:kind==="buy"?top:top,paddingLeft:6,paddingRight:6,paddingTop:2,paddingBottom:2,borderRadius:4}});
      /* etiquetas en cada línea: verde = Entrada, roja = SL (a la derecha, junto a la regla de precios) */
      const tag=(y,txt,c,above)=>F.push({type:"text",ignoreEvent:true,attrs:{x:bounding.width-6,y:above?y-4:y+4,text:txt,align:"right",baseline:above?"bottom":"top"},styles:{color:"#fff",size:AXF-.5,weight:"bold",backgroundColor:c,paddingLeft:Math.round(AXF*.45),paddingRight:Math.round(AXF*.45),paddingTop:2,paddingBottom:2,borderRadius:3}});
      tag(y1,kind==="buy"?"Entrada":"SL",top,true);tag(y2,kind==="buy"?"SL":"Entrada",bot,false);
      hdl();return F}
    const col=ex.color||GOLD;
    F.push({type:"rect",attrs:{x:x1,y:y1,width:x2-x1,height:h},styles:{style:"stroke_fill",color:ex.fill||hexA(col,.16),borderColor:col,borderSize:ex.size||1}});
    if(ex.text)F.push({type:"text",ignoreEvent:true,attrs:{x:x1+6,y:y1+h/2,text:ex.text,baseline:"middle"},styles:{color:col,size:12,backgroundColor:"transparent"}});
    hdl();return F};
  const boxMove=({points,performPointIndex:i,performPoint:pp})=>{if(!points||points.length<8||i==null||!pp)return;
    let Lp={timestamp:points[0].timestamp,dataIndex:points[0].dataIndex},Rp={timestamp:points[1].timestamp,dataIndex:points[1].dataIndex},T=points[0].value,B=points[2].value;
    const X={timestamp:pp.timestamp,dataIndex:pp.dataIndex};
    if([0,3,7].includes(i))Lp=X;if([1,2,5].includes(i))Rp=X;if([0,1,4].includes(i))T=pp.value;if([2,3,6].includes(i))B=pp.value;
    const np=boxPts(Object.assign({},Lp,{value:T}),Object.assign({},Rp,{value:B}));
    np.forEach((p,k)=>{if(p.timestamp!=null)points[k].timestamp=p.timestamp;else delete points[k].timestamp;if(p.dataIndex!=null)points[k].dataIndex=p.dataIndex;points[k].value=p.value})};
  const axY=(y,v,c,precision)=>{const pr=(precision&&precision.price!=null)?precision.price:2;return{type:"text",ignoreEvent:true,attrs:{x:0,y,text:(+v).toLocaleString("en-US",{minimumFractionDigits:pr,maximumFractionDigits:pr}),align:"left",baseline:"middle"},styles:axSt(c)}};
  const two2=n=>String(n).padStart(2,"0"),fmtT=t=>{const d=new Date(t);return `${two2(d.getDate())}/${two2(d.getMonth()+1)} ${two2(d.getHours())}:${two2(d.getMinutes())}`};
  const axX=(x,t,c)=>({type:"text",ignoreEvent:true,attrs:{x,y:3,text:fmtT(t),align:"center",baseline:"top"},styles:axStX(c)});
  /* en la regla de precios: el precio de entrada (verde) y del SL (rojo) siempre marcados */
  const boxAxis=kind=>({overlay,coordinates,bounding,precision})=>{if(coordinates.length<4||!overlay.points||overlay.points.length<4)return[];const ex=overlay.extendData||{};
    const up=ex.up||"#089981",dn=ex.dn||"#f23645",pr=(precision&&precision.price!=null)?precision.price:2;
    const f=v=>(+v).toLocaleString("en-US",{minimumFractionDigits:pr,maximumFractionDigits:pr});
    const tv=overlay.points[0].value,bv=overlay.points[3].value,ty=coordinates[0].y,by=coordinates[3].y;
    const lab=(y,v,c)=>({type:"text",ignoreEvent:true,attrs:{x:0,y,text:f(v),align:"left",baseline:"middle"},styles:axSt(c)});
    return kind==="buy"?[lab(ty,tv,up),lab(by,bv,dn)]:[lab(ty,tv,dn),lab(by,bv,up)]};
  /* zona y rectángulo: precio de arriba y de abajo siempre marcados en la regla */
  const zoneAxis=({overlay,coordinates,precision})=>{if(coordinates.length<4||!overlay.points||overlay.points.length<4)return[];const c=(overlay.extendData||{}).color||GOLD;
    return[axY(coordinates[0].y,overlay.points[0].value,c,precision),axY(coordinates[3].y,overlay.points[3].value,c,precision)]};
  [["eagZone","zoneR"],["eagRect","rect"],["eagBuyZone","buy"],["eagSellZone","sell"]].forEach(([n,k])=>KC.registerOverlay(Object.assign({name:n,totalStep:3,needDefaultPointFigure:false,needDefaultXAxisFigure:false,needDefaultYAxisFigure:false,
    createPointFigures:boxFig(k),performEventPressedMove:boxMove},(k==="buy"||k==="sell")?{createYAxisFigures:boxAxis(k)}:{createYAxisFigures:zoneAxis})));
  /* líneas horizontales y verticales: su precio (en la regla) o su hora (abajo) siempre marcados, no solo al seleccionarlas */
  try{const lc=o=>((o.styles||{}).line||{}).color||GOLD;
    const H=["horizontalStraightLine","horizontalRayLine","horizontalSegment","priceLine"],V=["verticalStraightLine","verticalRayLine","verticalSegment"];
    H.concat(V).forEach(n=>{const C=KC.getOverlayClass&&KC.getOverlayClass(n);if(!C)return;const t=new C();const isV=V.includes(n);
      const tpl={name:n,totalStep:t.totalStep,lock:false,needDefaultPointFigure:t.needDefaultPointFigure,needDefaultXAxisFigure:!isV&&t.needDefaultXAxisFigure,needDefaultYAxisFigure:isV&&t.needDefaultYAxisFigure,
        styles:t.styles||undefined,createPointFigures:t.createPointFigures,performEventPressedMove:t.performEventPressedMove,performEventMoveForDrawing:t.performEventMoveForDrawing,createXAxisFigures:t.createXAxisFigures,createYAxisFigures:t.createYAxisFigures};
      if(isV)tpl.createXAxisFigures=({overlay,coordinates})=>{const p=(overlay.points||[])[0],c=coordinates[0];return p&&c&&okT(p.timestamp)?[axX(c.x,p.timestamp,lc(overlay))]:[]};
      else tpl.createYAxisFigures=({overlay,coordinates,precision})=>{const p=(overlay.points||[])[0],c=coordinates[0];return p&&c?[axY(c.y,p.value,lc(overlay),precision)]:[]};
      Object.keys(tpl).forEach(k=>tpl[k]===undefined&&delete tpl[k]);KC.registerOverlay(tpl)})}catch(e){console.warn("ejes",e)}
  /* ---------- texto en cualquier dibujo (como TradingView): extendData.lbl = {t, c, s, b, i, h:left|center|right, v:top|middle|bottom} ---------- */
  try{
    /* letra de los textos de los dibujos: limpia y normal de ancho (antes salía gruesa por el borde negro) */
    const FAM=TXTFAM;let bgC="",bgT=0;const bgNow=()=>{const n=Date.now();if(n-bgT>1500){bgT=n;try{bgC=getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()||"#0b1020"}catch(e){bgC="#0b1020"}}return bgC};
    KC.registerFigure({name:"eagLbl",checkEventOn:()=>false,draw:(ctx,a,st)=>{if(!a.text)return;ctx.save();ctx.translate(a.x,a.y);if(a.rot)ctx.rotate(a.rot);const sz=st.size||13;
      ctx.font=`${st.italic?"italic ":""}${st.bold?"700 ":"500 "}${sz}px ${FAM}`;try{ctx.letterSpacing="0px";ctx.fontKerning="normal"}catch(e){}ctx.textAlign=a.align||"left";ctx.textBaseline=a.baseline||"bottom";
      if(st.halo){ctx.lineJoin="round";ctx.miterLimit=2;ctx.lineWidth=Math.max(2,sz/5);ctx.globalAlpha=.85;ctx.strokeStyle=bgNow();ctx.strokeText(a.text,0,a.dy||0);ctx.globalAlpha=1}
      ctx.fillStyle=st.color||GOLD;ctx.fillText(a.text,0,a.dy||0);ctx.restore()}});
    /* texto de dibujo con efectos: contorno, neón, sombra, fondo, rotación, varias líneas */
    KC.registerFigure({name:"eagTxt",checkEventOn:()=>false,draw:(ctx,a)=>{const e=a.ex||{};ctx.save();ctx.translate(a.x,a.y);const m=txtLay(e,ctx);if(a.anc==="center")ctx.translate(-m.w/2,0);if(e.rot)ctx.rotate((+e.rot||0)*Math.PI/180);
      const A=e.op!=null?Math.max(.1,Math.min(1,+e.op)):1;ctx.globalAlpha=A;ctx.textBaseline="middle";ctx.textAlign="left";
      const x0=m.ox,y0=-m.h/2,col=e.color||GOLD,fx=e.fx||(m.hasBg?"none":"halo"),fc=e.fxc||(fx==="neon"?col:"#000000");
      if(m.hasBg){ctx.beginPath();const r=e.r!=null?+e.r:4,bw=m.W+m.px*2,bh=m.h;if(ctx.roundRect)ctx.roundRect(x0,y0,bw,bh,Math.min(r,bh/2));else ctx.rect(x0,y0,bw,bh);
        ctx.fillStyle=/^#/.test(e.bg)?hexA(e.bg,e.bga!=null?+e.bga:.9):e.bg;ctx.fill();if(e.bd){ctx.lineWidth=Math.max(1,m.sz/12);ctx.strokeStyle=e.bd;ctx.stroke()}}
      m.lines.forEach((l,k)=>{const al=e.al||"left",tx=x0+m.px+(al==="center"?(m.W-m.ws[k])/2:al==="right"?m.W-m.ws[k]:0),ty=y0+m.py+m.lh*(k+.5);ctx.lineJoin="round";ctx.miterLimit=2;
        if(fx==="halo"){ctx.globalAlpha=A*.85;ctx.lineWidth=Math.max(2,m.sz/5);ctx.strokeStyle=bgNow();ctx.strokeText(l,tx,ty);ctx.globalAlpha=A}
        if(fx==="outline"){ctx.lineWidth=Math.max(2,m.sz/6);ctx.strokeStyle=fc;ctx.strokeText(l,tx,ty)}
        if(fx==="neon"){ctx.shadowColor=fc;ctx.fillStyle=fc;ctx.shadowBlur=m.sz*1.1;ctx.fillText(l,tx,ty);ctx.shadowBlur=m.sz*.45;ctx.fillText(l,tx,ty);ctx.shadowBlur=m.sz*.12}
        if(fx==="shadow"){ctx.shadowColor=hexA(fc,.75);ctx.shadowBlur=m.sz*.22;ctx.shadowOffsetX=Math.max(1,m.sz*.07);ctx.shadowOffsetY=Math.max(1,m.sz*.09)}
        ctx.fillStyle=fx==="neon"?(e.core||"#ffffff"):col;ctx.fillText(l,tx,ty);ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
        if(e.u||e.s){ctx.fillStyle=fx==="neon"?fc:col;const th=Math.max(1,m.sz/14);if(e.u)ctx.fillRect(tx,ty+m.sz*.55,m.ws[k],th);if(e.s)ctx.fillRect(tx,ty-th/2,m.ws[k],th)}});
      ctx.restore()}});
    const colOf=ov=>{const lb=(ov.extendData||{}).lbl||{},s2=ov.styles||{},ex=ov.extendData||{};return lb.c||(s2.line&&s2.line.color)||(s2.polygon&&s2.polygon.borderColor)||ex.color||GOLD};
    const HL=/^(horizontalStraightLine|horizontalRayLine|horizontalSegment|priceLine)$/,VL=/^(verticalStraightLine|verticalRayLine|verticalSegment)$/,
      TL=/^(segment|rayLine|straightLine|arrow|parallelStraightLine|priceChannelLine)$/,BX=/^(rect|eagRect|eagZone|eagBuyZone|eagSellZone)$/;
    window.__eagLblFig=(ov,cs,bd)=>{const lb=(ov.extendData||{}).lbl;if(!lb||!lb.t||!cs||!cs.length)return[];const n=ov.name,h=lb.hx?(lb.h||"center"):(BX.test(n)?(lb.h||"left"):"center"),v=lb.v||"top",sz=lb.s||13,col=colOf(ov);
      const st={color:col,size:sz,bold:!!lb.b,italic:!!lb.i,halo:"rgba(0,0,0,.35)"},F=(x,y,align,baseline,rot,dy)=>[{type:"eagLbl",ignoreEvent:true,attrs:{x,y,text:String(lb.t).slice(0,120),align,baseline,rot:rot||0,dy:dy||0},styles:st}];
      const pad=6,off=v==="top"?-4:v==="bottom"?4:0,bl=v==="top"?"bottom":v==="bottom"?"top":"middle";
      if(HL.test(n)){const y=cs[0].y;let x0=0,x1=bd.width;if(n==="horizontalRayLine"){if(cs[1]&&cs[1].x<cs[0].x){x0=0;x1=cs[0].x}else{x0=cs[0].x;x1=bd.width}}
        else if(n==="horizontalSegment"&&cs[1]){x0=Math.min(cs[0].x,cs[1].x);x1=Math.max(cs[0].x,cs[1].x)}else if(n==="priceLine"){x0=cs[0].x;x1=bd.width}
        x0=Math.max(0,x0);x1=Math.min(bd.width-60,x1);if(x1<x0)x1=x0;
        return h==="left"?F(x0+pad,y+off,"left",bl):h==="center"?F((x0+x1)/2,y+off,"center",bl):F(x1-pad,y+off,"right",bl)}
      if(VL.test(n)){const x=cs[0].x;let y0=0,y1=bd.height;if(n!=="verticalStraightLine"&&cs[1]){if(n==="verticalSegment"){y0=Math.min(cs[0].y,cs[1].y);y1=Math.max(cs[0].y,cs[1].y)}else if(cs[1].y<cs[0].y){y0=0;y1=cs[0].y}else{y0=cs[0].y;y1=bd.height}}
        /* texto girado a lo largo de la línea vertical (de abajo hacia arriba) */
        /* girado (se lee de abajo hacia arriba): "izquierda" = abajo, "derecha" = arriba */
        return h==="left"?F(x,y1-pad,"left",bl,-Math.PI/2,off):h==="center"?F(x,(y0+y1)/2,"center",bl,-Math.PI/2,off):F(x,y0+pad,"right",bl,-Math.PI/2,off)}
      if(TL.test(n)&&cs.length>=2){let a=cs[0],b=cs[1];if(b.x<a.x){const t=a;a=b;b=t}const ang=Math.atan2(b.y-a.y,b.x-a.x),L=Math.hypot(b.x-a.x,b.y-a.y)||1,ux=(b.x-a.x)/L,uy=(b.y-a.y)/L;
        const at=h==="left"?{x:a.x+ux*pad,y:a.y+uy*pad,al:"left"}:h==="center"?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,al:"center"}:{x:b.x-ux*pad,y:b.y-uy*pad,al:"right"};
        return F(at.x,at.y,at.al,bl,ang,off)}
      /* cajas: el texto va por dentro */
      const xs=cs.map(c=>c.x),ys=cs.map(c=>c.y);let x0=Math.min(...xs),x1=Math.max(...xs);const y0=Math.min(...ys),y1=Math.max(...ys);
      if(n==="eagZone")x1=bd.width-60;
      if(BX.test(n)){const tx=h==="left"?x0+pad:h==="center"?(x0+x1)/2:x1-pad,ty=v==="top"?y0+pad:v==="bottom"?y1-pad:(y0+y1)/2;
        return F(tx,ty,h,v==="top"?"top":v==="bottom"?"bottom":"middle")}
      /* el resto (Fibonacci, patrones, formas): por encima o por debajo de todo el dibujo */
      const tx=h==="left"?x0:h==="center"?(x0+x1)/2:x1,ty=v==="top"?y0-6:v==="bottom"?y1+6:(y0+y1)/2;
      return F(tx,ty,h,v==="top"?"bottom":v==="bottom"?"top":"middle")};
    const SKIP=/^(eagText|eagNote|eagMeasure|eagLong|eagShort|eagPosition|eagAlert|eagLastPx|eagBrush|eagHighlighter|eagEmoji|priceLabel)$/;
    const KEYS=["totalStep","lock","needDefaultPointFigure","needDefaultXAxisFigure","needDefaultYAxisFigure","mode","modeSensitivity","styles","createXAxisFigures","createYAxisFigures","performEventPressedMove","performEventMoveForDrawing",
      "onDrawStart","onDrawing","onDrawEnd","onClick","onDoubleClick","onRightClick","onPressedMoveStart","onPressedMoving","onPressedMoveEnd","onMouseEnter","onMouseLeave","onRemoved","onSelected","onDeselected"];
    TOOLS.forEach(g=>g.items.forEach(([n])=>{if(n==="-"||SKIP.test(n))return;const C=KC.getOverlayClass&&KC.getOverlayClass(n);if(!C)return;const t=new C(),orig=t.createPointFigures;
      const tpl={name:n};KEYS.forEach(k=>{if(t[k]!=null)tpl[k]=t[k]});
      tpl.createPointFigures=args=>{let F=[];try{F=orig?orig(args):[]}catch(e){F=[]}F=Array.isArray(F)?F:(F?[F]:[]);try{F=F.concat(window.__eagLblFig(args.overlay,args.coordinates,args.bounding))}catch(e){}return F};
      KC.registerOverlay(tpl)}))}catch(e){console.warn("texto en dibujos",e)}
  /* Línea horizontal con precio (como TradingView) */
  /* indicadores extra */
  const sma=(a,n,i)=>{if(i<n-1)return null;let s=0;for(let k=i-n+1;k<=i;k++)s+=a[k];return s/n};
  /* RSI como en TradingView: 14 periodos (Wilder), línea morada, niveles 70 / 50 / 30 y zona sombreada entre 30 y 70 */
  KC.registerIndicator({name:"RSI",shortName:"RSI",calcParams:[14],precision:2,minValue:0,maxValue:100,styles:{lines:[{color:"#7e57c2",size:1.5,style:"solid",smooth:false,dashedValue:[2,2]}]},figures:[{key:"rsi",title:"RSI: ",type:"line"}],
    calc:(L,ind)=>{const n=Math.max(2,+ind.calcParams[0]||14);let ag=0,al=0;return L.map((k,i)=>{if(!i)return{};const d=k.close-L[i-1].close,g=Math.max(d,0),l=Math.max(-d,0);
      if(i<=n){ag+=g/n;al+=l/n;if(i<n)return{}}else{ag=(ag*(n-1)+g)/n;al=(al*(n-1)+l)/n}return{rsi:al===0?100:100-100/(1+ag/al)}})},
    draw:({ctx,bounding,yAxis})=>{try{const y70=yAxis.convertToPixel(70),y30=yAxis.convertToPixel(30),y50=yAxis.convertToPixel(50),w=bounding.width;ctx.save();
      ctx.fillStyle="rgba(126,87,194,.08)";ctx.fillRect(0,Math.min(y70,y30),w,Math.abs(y30-y70));ctx.strokeStyle="rgba(120,123,134,.7)";ctx.lineWidth=1;ctx.setLineDash([4,4]);
      [y70,y30].forEach(y=>{ctx.beginPath();ctx.moveTo(0,Math.round(y)+.5);ctx.lineTo(w,Math.round(y)+.5);ctx.stroke()});ctx.strokeStyle="rgba(120,123,134,.35)";ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(0,Math.round(y50)+.5);ctx.lineTo(w,Math.round(y50)+.5);ctx.stroke();ctx.restore()}catch(e){}return false}});
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
  {g:"lines",t:"Líneas",items:[["segment","Línea de tendencia"],["rayLine","Rayo"],["infoLine","Línea de información (precio, %, velas, ángulo)"],["straightLine","Línea extendida"],["trendAngle","Ángulo de tendencia"],["arrow","Flecha"],
    ["-","Horizontales y verticales"],["horizontalStraightLine","Línea horizontal"],["horizontalRayLine","Rayo horizontal"],["horizontalSegment","Segmento horizontal"],["verticalStraightLine","Línea vertical"],["crossLine","Línea cruzada"],["priceLine","Línea de precio"],
    ["-","Canales y tridentes"],["parallelStraightLine","Canal paralelo"],["priceChannelLine","Canal de precio"],["regressionTrend","Tendencia de regresión"],["pitchfork","Tridente (Andrews)"]]},
  {g:"fib",t:"Fibonacci y Gann",items:[["fibonacciLine","Retroceso de Fibonacci"],["fibonacciExtension","Extensión de Fibonacci"],["fibonacciSegment","Segmentos de Fibonacci"],["fibTimeZone","Zonas de tiempo de Fibonacci"],["fibonacciSpeedResistanceFan","Abanico de Fibonacci"],["fibonacciCircle","Círculos de Fibonacci"],["fibonacciSpiral","Espiral de Fibonacci"],
    ["-","Gann"],["gannBox","Caja de Gann"],["gannFan","Abanico de Gann"]]},
  {g:"pat",t:"Patrones",items:[["xabcd","Patrón XABCD"],["cypherPattern","Patrón Cypher"],["abcd","Patrón ABCD"],["headShoulders","Hombro-Cabeza-Hombro"],["trianglePattern","Patrón triángulo"],["threeDrives","Tres impulsos"],
    ["-","Ondas de Elliott"],["fiveWaves","Onda de impulso (12345)"],["elliottCorrection","Onda de corrección (ABC)"],["elliottTriangle","Onda triángulo (ABCDE)"],["elliottDouble","Combinación doble (WXY)"],["threeWaves","Tres ondas"],["eightWaves","Ocho ondas"],["anyWaves","Ondas libres"],
    ["-","Ciclos"],["cyclicLines","Líneas cíclicas"],["timeCycles","Ciclos de tiempo"],["sineLine","Línea sinusoidal"]]},
  {g:"pos",t:"Predicción y medición",items:[["eagLong","Posición larga (compra)"],["eagShort","Posición corta (venta)"],["-","Medir"],["eagMeasure","Rango de fecha y precio (regla)"],["dateRange","Rango de fechas"],["priceRange","Rango de precios"],["-","Indicador"],["anchoredVWAP","VWAP anclado"]]},
  {g:"shape",t:"Formas, zonas y pincel",items:[["eagBuyZone","Zona de compra (verde arriba, roja abajo)"],["eagSellZone","Zona de venta (roja arriba, verde abajo)"],["eagZone","Zona (se extiende a la derecha)"],["eagRect","Rectángulo"],
    ["-","Formas"],["circle","Círculo"],["ellipse","Elipse"],["triangle","Triángulo"],["parallelogram","Paralelogramo"],["curve","Curva"],["polyLine","Polilínea"],["-","A mano alzada"],["eagBrush","Pincel (dibujo libre)"],["eagHighlighter","Resaltador"]]},
  {g:"txt",t:"Texto y marcas",items:[["eagText","Texto"],["eagNote","Nota con flecha"],["priceLabel","Etiqueta de precio"],["-","Marcas"],["arrowMarkUp","Flecha hacia arriba"],["arrowMarkDown","Flecha hacia abajo"],["flagMark","Bandera"],["eagEmoji","Emoji / sticker"]]}];
const TNAME={eagPosition:"Posición (antigua)",eagBrush:"Pincel (dibujo libre)",simpleAnnotation:"Nota (antigua)",simpleTag:"Etiqueta (antigua)"};TOOLS.forEach(g=>g.items.forEach(([k,t])=>{if(k!=="-")TNAME[k]=t}));
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
  stay:'<path d="M14.5 4.5l3 3L8 17l-4 1 1-4z"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M15.5 15v-1.5a2 2 0 0 1 4 0V15"/>',
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
  score:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 4v16M6.5 12h3M8 10.5v3M14.5 12h3"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  reload:'<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
  front:'<rect x="9" y="9" width="11" height="11" rx="1"/><path d="M15 9V4H4v11h5"/>'};

/* íconos de cada herramienta (24×24) */
const P=(x,y)=>`<circle cx="${x}" cy="${y}" r="1.7" fill="currentColor" stroke="none"/>`;
const TI={
  infoLine:'<path d="M4 18 15 7"/><rect x="14" y="3" width="8" height="5" rx="1"/>'+P(4,18),
  trendAngle:'<path d="M4 18 18 6M4 18h15"/><path d="M11 18a7 7 0 0 0-1.6-4.4"/>',
  crossLine:'<path d="M12 2v20M2 12h20"/>'+P(12,12),
  regressionTrend:'<path d="M3 17 21 7M3 13 21 3M3 21 21 11" stroke-dasharray="0"/>',
  pitchfork:'<path d="M3 20 12 11M8 6l13 0M12 11h9M8 16h13M8 6v10"/>',
  fibTimeZone:'<path d="M3 3v18M6 3v18M9 3v18M13 3v18M19 3v18"/>',
  gannFan:'<path d="M3 21 21 3M3 21 21 9M3 21 21 15M3 21 15 3M3 21 9 3"/>',
  cypherPattern:'<path d="m2 17 5-11 4 8 5-10 6 15"/>',
  headShoulders:'<path d="m2 18 4-7 3 4 3-11 3 11 3-4 4 7"/><path d="M5 15h14" stroke-dasharray="2 2"/>',
  trianglePattern:'<path d="m3 6 5 12 5-9 5 7 3-3"/><path d="M3 6 21 13M8 18 21 13" stroke-dasharray="2 2"/>',
  threeDrives:'<path d="m2 20 4-6 3 3 4-8 3 3 6-10"/>',
  elliottCorrection:'<path d="m3 5 6 11 5-6 7 11"/>',elliottTriangle:'<path d="m2 4 4 15 4-11 4 8 4-5 4 3"/>',elliottDouble:'<path d="m2 4 5 10 4-5 5 11 6-6"/>',
  cyclicLines:'<path d="M4 3v18M10 3v18M16 3v18M22 3v18"/>',timeCycles:'<path d="M2 18a5 5 0 0 1 10 0a5 5 0 0 1 10 0"/>',sineLine:'<path d="M2 12c3-8 6-8 9 0s6 8 9 0"/>',
  dateRange:'<path d="M5 3v18M19 3v18M5 12h14M15 9l4 3-4 3M9 9l-4 3 4 3"/>',priceRange:'<path d="M3 5h18M3 19h18M12 5v14M9 9l3-4 3 4M9 15l3 4 3-4"/>',
  anchoredVWAP:'<path d="M3 18c4-1 5-8 9-8s5 4 9 3"/><circle cx="3" cy="18" r="2"/>',
  ellipse:'<ellipse cx="12" cy="12" rx="10" ry="6"/>',curve:'<path d="M3 19C5 5 19 5 21 19"/>',polyLine:'<path d="m3 18 5-9 5 5 4-9 4 5"/>'+P(3,18)+P(21,10),
  eagHighlighter:'<path d="m14 4 6 6-9 9H5v-6z" /><path d="M4 22h16" stroke-width="3" opacity=".5"/>',
  priceLabel:'<path d="M4 20 9 15"/><rect x="9" y="6" width="12" height="8" rx="2"/>'+P(4,20),
  arrowMarkUp:'<path d="M12 4 5 12h4v8h6v-8h4z"/>',arrowMarkDown:'<path d="M12 20 5 12h4V4h6v8h4z"/>',
  flagMark:'<path d="M5 22V3M5 4h12l-3 4 3 4H5"/>',eagEmoji:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
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
  eagNote:'<rect x="3" y="3" width="18" height="10" rx="2.5"/><path d="M12 13v6"/><path d="m9.5 17.5 2.5 3 2.5-3"/>',
  simpleAnnotation:'<rect x="3" y="3" width="18" height="10" rx="2"/><path d="M12 13v8"/>'+P(12,21),
  simpleTag:'<path d="M3 12h7"/><path d="M10 7h9l2 5-2 5h-9z"/>'};
const tsvg=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${TI[k]||""}</svg>`;
const svg=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[k]||""}</svg>`;
/* el texto y los emojis no se pegan a las velas con el imán: se mueven libres */
const NOMAG=/^(eagText|eagEmoji)$/;
const MARKX=/^(eagNote|arrowMarkUp|arrowMarkDown|flagMark|priceLabel)$/;
const STDTF=[["Ticks",0],["1m",60],["2m",120],["3m",180],["5m",300],["10m",600],["15m",900],["30m",1800],["1H",3600],["2H",7200],["4H",14400],["8H",28800],["1D",86400]];
const COLORS=["#e2b55c","#f3d08a","#ffffff","#9da1aa","#2962ff","#089981","#f23645","#ff9800","#9c27b0","#e91e63","#00bcd4","#000000"];
const IND=[ // [nombre, nombre en español, dónde]
  ["MA","Media móvil (MA)","main"],["EMA","Media exponencial (EMA)","main"],["SMA","Media suavizada (SMA)","main"],["WMA","Media ponderada (WMA)","main"],
  ["BOLL","Bandas de Bollinger","main"],["DONCHIAN","Canales de Donchian","main"],["SUPERTREND","SuperTrend","main"],["SAR","SAR parabólico","main"],["BBI","BBI (promedio de medias)","main"],
  ["RSI","RSI · Relative Strength Index (fuerza relativa)","sub"],["MACD","MACD","sub"],["STOCH","Estocástico","sub"],["ATR","ATR (rango verdadero medio)","sub"],["CCI","CCI","sub"],["WR","Williams %R","sub"],["MTM","Momentum","sub"],["ROC","Tasa de cambio (ROC)","sub"],
  ["KDJ","KDJ","sub"],["DMI","DMI / ADX","sub"],["AO","Awesome Oscillator","sub"],["TRIX","TRIX","sub"],["BIAS","BIAS","sub"],["DMA","DMA","sub"],["PSY","PSY (psicológico)","sub"],["BRAR","BRAR","sub"],["CR","CR","sub"],["EMV","EMV","sub"],["VR","VR","sub"],["OBV","OBV","sub"],["PVT","PVT","sub"]];
const INDN={};IND.forEach(i=>INDN[i[0]]=i[1]);

/* estilos del motor según el tema */
function themeStyles(light,eag){
  const tx=light?"#5c616b":eag?"#93a1c4":"#9da1aa",ln=light?"#e5e6e9":eag?"#1f3266":"#24262c",cb=light?"#15171c":eag?"#2b4282":"#363a45";
  const axis={axisLine:{color:ln},tickLine:{color:ln},tickText:{color:tx,size:11}};
  const ch={line:{color:light?"#9aa0aa":"#5d626c",style:"dashed",dashedValue:[4,4]},text:{backgroundColor:cb,borderColor:cb,color:"#fff"}};
  return{xAxis:JSON.parse(JSON.stringify(axis)),yAxis:JSON.parse(JSON.stringify(axis)),separator:{color:ln},crosshair:{horizontal:JSON.parse(JSON.stringify(ch)),vertical:JSON.parse(JSON.stringify(ch))},
    candle:{tooltip:{text:{color:tx,size:11}},priceMark:{high:{color:tx},low:{color:tx}}},indicator:{tooltip:{text:{color:tx,size:11}}},
    overlay:{line:{color:GOLD,size:1},point:{color:light?"#ffffff":eag?"#060b1a":"#0b0c0e",borderColor:GOLD,borderSize:1.5,radius:4.5,activeColor:GOLD,activeBorderColor:hexA(GOLD,.28),activeBorderSize:5,activeRadius:5},
      rect:{color:hexA(GOLD,.12),borderColor:GOLD},polygon:{color:hexA(GOLD,.12),borderColor:GOLD},circle:{color:hexA(GOLD,.12),borderColor:GOLD},arc:{color:GOLD},
      text:{color:GOLD,backgroundColor:"rgba(0,0,0,0)",borderColor:"rgba(0,0,0,0)",borderSize:0,paddingLeft:2,paddingRight:2,paddingTop:1,paddingBottom:1},rectText:{color:"#16120a",backgroundColor:GOLD,borderColor:GOLD}}};
}
const deep=(a,b)=>{for(const k in b){if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])){a[k]=deep(a[k]&&typeof a[k]==="object"?a[k]:{},b[k])}else a[k]=b[k]}return a};

/* ===================== Widget ===================== */
window.EAGTools={icon:(k,s)=>tsvg(k,s),name:k=>TNAME[k]||k};
window.EAGWidget=function(o){
  registerAll();
  const root=o.container;root.classList.add("eagw");
  root.innerHTML=`<div class="wbar"><button class="wsym" title="Cambiar mercado"><b></b>${svg("caret",12)}</button><button class="wtf" title="Todas las temporalidades"><b></b>${svg("caret",11)}</button><span class="wfav"></span><span class="wsp"></span>
      <button class="wb wmtf" data-a="mtf" title="Multitemporalidad de este gráfico" hidden>${svg("mtf",17)}<span>Multi-TF</span></button><button class="wb" data-a="ind" title="Indicadores">${svg("fx")}<span>Indicadores</span></button><button class="wb" data-a="cfg" title="Ajustes del gráfico">${svg("gear")}</button><button class="wb" data-a="shot" title="Captura (descargar imagen)">${svg("cam")}</button></div>
    <div class="wbody"><div class="dbar"></div><div class="wchart"><div class="wwm"><div class="wm-s"></div><div class="wm-b">EL ARTE GRÁFICO</div></div>
${o.onTracker?`<button class="wtrk" title="Marcador de operaciones (ganadas, perdidas y total en US$)">${svg("score",15)}<span>Marcador</span></button><button class="wjr" title="Journal: tu calendario de PnL (día, semana, mes, año)">📅<span>Journal</span></button>`:""}<div class="wnav"><button data-n="left" title="Mover a la izquierda">${svg("chevl",16)}</button><button data-n="right" title="Mover a la derecha">${svg("chevr",16)}</button><i></i><button data-n="reset" title="Volver al precio actual (zoom normal)">${svg("reset",16)}</button><button data-n="reload" title="Recargar el gráfico (si se traba)">${svg("reload",16)}</button></div></div></div>
    <div class="wfoot"><span class="wrng">${[["1D",1],["5D",5],["1M",30],["3M",90],["6M",180],["1A",365],["Todo",0]].map(([t,d])=>`<button data-d="${d}" title="${d?"Ver "+t:"Ver todo el historial cargado"}">${t}</button>`).join("")}</span><span class="wsp"></span>
      <span class="wcd" title="Tiempo para el cierre de la vela"></span><span class="wclk" title="Hora de Colombia (UTC-5)"></span><i class="wsep"></i><button class="wax" data-ax="percentage" title="Escala en porcentaje">%</button><button class="wax" data-ax="log" title="Escala logarítmica">log</button><button class="wax" data-ax="normal" title="Escala normal (automática)">auto</button></div>`;
  const $=s=>root.querySelector(s),chartEl=$(".wchart"),dbar=$(".dbar");
  if(o.timezone)EAG_TZ=o.timezone;const chart=KC.init(chartEl,{locale:"es-ES",timezone:o.timezone});(window.__eagCharts=window.__eagCharts||[]).push(chart);
  let sym=o.symbol,per=o.period,theme=o.theme||"dark",extra={},gen=0,subKey=null,ready=false,selId=null;let lastTouch=false;
  const ind=Object.assign({main:[],sub:{},params:{},st:{},hid:{}},o.indicators||{});ind.st=ind.st||{};ind.hid=ind.hid||{};ind.sub=ind.sub&&!Array.isArray(ind.sub)?ind.sub:{};
  const ovs=new Map(); // id -> definición guardable
  let magnet=o.magnet||"normal",locked=false,hidden=false;let stay=false,ttWait=null;try{stay=localStorage.getItem("eag_stay")==="1"}catch(e){}
  /* mantener modo dibujo: al terminar un dibujo, la misma herramienta queda lista para el siguiente */
  const again2=n=>{if(!stay||!n||/^(eagBrush|eagHighlighter)$/.test(n))return;setTimeout(()=>{if(stay&&!drawingId)startTool(n)},80)};

  /* ---------- datos ---------- */
  const msOf=p=>p.multiplier*({tick:1e3,minute:6e4,hour:36e5,day:864e5,week:6048e5}[p.timespan]||6e4);
  /* ---------- en qué temporalidades se ve cada dibujo (v.tfv = ["5m","15m"]; vacío = todas) ---------- */
  const curTf=()=>{if(!per||per.timespan==="tick")return"Ticks";const g=msOf(per)/1000;let k="1m";for(const[t,gg]of STDTF){if(gg&&gg<=g)k=t}return k};
  /* temporalidad donde se hizo el dibujo: guardada (ctf) o, en dibujos viejos, deducida de sus puntos (cada punto cae en la apertura de una vela) */
  const tfOf=v=>{if(v.ctf)return v.ctf;const P=(v.points||[]).map(q=>+q.timestamp).filter(x=>isFinite(x)&&x>0);if(!P.length)return null;
    for(let i=STDTF.length-1;i>0;i--){const g=STDTF[i][1]*1000;if(P.every(x=>x%g===0))return STDTF[i][0]}return"Ticks"};
  const tfOk=v=>!v||(!v.hid&&(!v.tfv||!v.tfv.length||v.tfv.includes(curTf())));
  const isTk=()=>per&&per.timespan==="tick";
  /* ---------- Heikin Ashi y Renko: se calculan a partir de las velas normales (RAW) ---------- */
  let RAW=[],XF="",RBOX=0;
  const xfNow=()=>isTk()?"":((o.getXform&&o.getXform())||"");
  function haOf(c,prev){const cl=(c.open+c.high+c.low+c.close)/4,op=prev?(prev.open+prev.close)/2:(c.open+c.close)/2;
    return{timestamp:c.timestamp,open:op,high:Math.max(c.high,op,cl),low:Math.min(c.low,op,cl),close:cl,volume:c.volume||0}}
  const haList=(L,prev)=>{const out=[];let p=prev||null;L.forEach(c=>{p=haOf(c,p);out.push(p)});return out};
  /* tamaño del ladrillo: el que elija el alumno o, en automático, la mediana del rango de las velas (ignora los spikes) */
  function renkoBox(L){const b=o.getRenkoBox&&o.getRenkoBox();if(b>0)return b;const r=L.map(c=>c.high-c.low).filter(v=>v>0).sort((a,b)=>a-b);
    let m=r.length?r[Math.floor(r.length/2)]:0;if(!(m>0)){const c=L.length?L[L.length-1].close:1;m=Math.abs(c)*0.001||1}
    const e=Math.pow(10,Math.floor(Math.log10(m))),n=m/e;return(n<1.5?1:n<3.5?2:n<7.5?5:10)*e}
  /* ladrillos por precio de cierre; para cambiar de dirección hacen falta 2 ladrillos (Renko clásico) */
  function renkoList(L){if(!L.length)return[];const box=renkoBox(L);let hi=L[0].close,lo=hi,out=[];
    L.forEach(c=>{let k=0;const t=()=>c.timestamp+(k++);
      while(c.close>=hi+box){const o2=hi,c2=hi+box;out.push({timestamp:t(),open:o2,high:c2,low:o2,close:c2,volume:0});lo=hi;hi=c2}
      while(c.close<=lo-box){const o2=lo,c2=lo-box;out.push({timestamp:t(),open:o2,high:o2,low:c2,close:c2,volume:0});hi=lo;lo=c2}});
    RBOX=box;window.__renkoBox=box;return out}
  const viewOf=L=>XF==="ha"?haList(L):XF==="renko"?renkoList(L):L;
  function pushRaw(d){const n=RAW.length;if(n&&RAW[n-1].timestamp===d.timestamp)RAW[n-1]=d;else if(!n||d.timestamp>RAW[n-1].timestamp)RAW.push(d);else return false;
    if(RAW.length>20000)RAW.splice(0,RAW.length-20000);return true}
  function liveUpdate(d){if(!XF){chart.updateData(d);return}if(!pushRaw(d))return;const L=chart.getDataList();
    if(XF==="ha"){let prev=null;for(let i=L.length-1;i>=0;i--){if(L[i].timestamp<d.timestamp){prev=L[i];break}}chart.updateData(haOf(d,prev||null));return}
    if(XF==="renko"){const B=renkoList(RAW),lt=L.length?L[L.length-1].timestamp:0;B.filter(b=>b.timestamp>lt).forEach(b=>chart.updateData(b))}}
  let noMore=false;
  /* escala de precios automática otra vez (si se estiró a mano, al cambiar de mercado quedaba congelada) */
  function autoScale(){try{const ax=chart._candlePane&&chart._candlePane.getAxisComponent();if(ax){ax._autoCalcTickFlag=true;chart.adjustPaneViewport(false,true,true,true)}}catch(e){}}
  /* al cambiar de temporalidad estando atrás en el historial (buscando zonas), se queda en esa misma fecha */
  let pinTs=null;/* la fecha en la que se centró al cambiar de temporalidad: si sigue a la vista, se conserva en el siguiente cambio */
  function anchorTs(){try{const L=chart.getDataList(),r=chart.getVisibleRange();if(!L.length||!r)return null;
    if(r.realTo<L.length-2){const i=Math.max(0,Math.min(L.length-1,Math.round((r.realFrom+r.realTo)/2)));return pinTs=L[i].timestamp}
    const a=L[Math.max(0,r.realFrom)].timestamp;if(pinTs&&pinTs>=a)return pinTs;return pinTs=null}catch(e){return null}}
  function centerOn(ts){pinTs=ts;try{const L=chart.getDataList();if(!L.length)return;let i=L.findIndex(k=>k.timestamp>=ts);if(i<0)i=L.length-1;
    chart.scrollToDataIndex(i,0);for(let n=0;n<3;n++){const r=chart.getVisibleRange(),mid=(r.realFrom+r.realTo)/2,d=(i-mid)*chart.getBarSpace();if(Math.abs(d)<chart.getBarSpace())break;chart.scrollByDistance(-d,0)}}catch(e){}}
  async function loadData(anchor){
    const g=++gen;ready=false;noMore=false;
    if(subKey){o.datafeed.unsubscribe(subKey.s,subKey.p);subKey=null}
    bulk=true;try{chart.clearData()}catch(e){}bulk=false;applyDec();
    paintBar();
    const to=Date.now(),from=to-msOf(per)*990;
    let list=await o.datafeed.getHistoryKLineData(sym,per,from,to);
    if(g!==gen)return;
    const seen=new Set();list=list.filter(k=>!seen.has(k.timestamp)&&seen.add(k.timestamp)).sort((x,y)=>x.timestamp-y.timestamp);
    XF=xfNow();RAW=list.slice();
    chart.applyNewData(viewOf(list),list.length>0&&XF!=="renko");autoScale();ready=true;applyStyles();offR=null;fixOffR(true);
    o.datafeed.subscribe(sym,per,d=>{if(g===gen){liveUpdate(d);cdKick(120)}});subKey={s:sym,p:per};
    restoreDrawings();azKey=null;setTimeout(refreshAuto,50);
    if(anchor&&list.length){/* si esa fecha es más vieja que lo cargado, trae más historial (hasta 6 veces) */
      let first=list[0].timestamp,more=true;for(let n=0;n<6&&anchor<first+msOf(per)*20&&more;n++){const to2=first-1,from2=to2-msOf(per)*990;
        let old=[];try{old=await o.datafeed.getHistoryKLineData(sym,per,from2,to2)}catch(e){break}if(g!==gen)return;
        old=old.filter(k=>k.timestamp<first).sort((x,y)=>x.timestamp-y.timestamp);more=old.length>0;if(!more){noMore=true;break}
        RAW=old.concat(RAW);try{chart.applyMoreData(viewOf(old),true)}catch(e){break}first=old[0].timestamp}
      setTimeout(()=>{if(g===gen)centerOn(anchor)},30)}
  }
  chart.setLoadDataCallback(async({type,data,callback})=>{
    if(type!=="forward"||!data){callback([],false);return}
    const g=gen,to=data.timestamp-1,from=to-msOf(per)*990;
    if(noMore){callback([],false);return}
    const raw=await o.datafeed.getHistoryKLineData(sym,per,from,to);
    if(g!==gen)return;
    /* solo velas más antiguas que la primera que ya está en el gráfico; si Deriv ya no tiene más, se deja de pedir */
    const first=data.timestamp,seen=new Set(),list=raw.filter(k=>k.timestamp<first&&!seen.has(k.timestamp)&&seen.add(k.timestamp)).sort((x,y)=>x.timestamp-y.timestamp);
    if(!list.length)noMore=true;
    if(XF==="renko"){callback([],false);return}
    if(XF==="ha"){RAW=list.concat(RAW);callback(haList(list),list.length>0);return}
    RAW=list.concat(RAW);
    callback(list,list.length>0)});

  /* ---------- barra superior ---------- */
  function paintBar(){
    $(".wsym b").textContent=sym.shortName||sym.name||sym.ticker;
    $(".wtf b").textContent=per.text;$(".wm-s").textContent=`${sym.name||sym.ticker}, ${per.text}`;const dtf=dbar.querySelector(".dtf b");if(dtf)dtf.textContent=per.text;
    const favs=((o.ticksOn&&o.ticksOn())?["Ticks"]:[]).concat((o.getFavTF&&o.getFavTF())||[]);
    $(".wfav").innerHTML=favs.map(t=>`<button class="wp${t===per.text?" on":""}${t==="Ticks"?" wtk":""}" data-t="${t}"${t==="Ticks"?' title="Gráfico de ticks: cada movimiento del precio, como en MT5"':""}>${t}</button>`).join("");
    $(".wfav").querySelectorAll("button").forEach(b=>b.onclick=()=>o.onPickTF&&o.onPickTF(b.dataset.t))}
  $(".wsym").onclick=e=>{e.stopPropagation();o.onSymbolClick&&o.onSymbolClick()};
  $(".wtf").onclick=e=>{e.stopPropagation();o.onTFClick&&o.onTFClick($(".wtf"))};
  root.querySelector('[data-a="ind"]').onclick=e=>{e.stopPropagation();openInd()};
  root.querySelector('[data-a="mtf"]').onclick=e=>{e.stopPropagation();o.onToggleMtf&&o.onToggleMtf()};
  root.querySelector('[data-a="cfg"]').onclick=e=>{e.stopPropagation();o.onSettings&&o.onSettings(e.currentTarget)};
  root.querySelector('[data-a="shot"]').onclick=()=>{try{const bg=getComputedStyle(root).getPropertyValue("--chartbg").trim()||(theme==="light"?"#ffffff":"#0b0c0e");
    const url=chart.getConvertPictureUrl(true,"png",bg),a=document.createElement("a");a.href=url;a.download=`EAG_${sym.ticker}_${per.text}.png`;document.body.appendChild(a);a.click();a.remove()}catch(e){}};
  /* pantalla completa: ahora es un botón de la barra de arriba (junto a Mercados), ver charts-app.js */

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
    const L=chart.getDataList(),last=L[L.length-1];if(last&&(isTk()||XF==="renko")){cdEl.textContent=isTk()?"Ticks en vivo":"Renko · ladrillo "+RBOX;cdEl.classList.remove("soon")}else if(last){const left=Math.max(0,last.timestamp+msOf(per)-now),s2=Math.floor(left/1000),h=Math.floor(s2/3600),m=Math.floor(s2%3600/60);
      cdEl.textContent=`Cierra en ${h?h+":"+two(m):m}:${two(s2%60)}`;cdEl.classList.toggle("soon",left<10000)}};
  const clkT=setInterval(tick,1000);tick();
  /* cuenta regresiva del cierre de vela. Dos modos (Configuración → Gráfico):
     "vela"  → como MT5: al lado de la última vela, FUERA de la regla, con el nombre del mercado y debajo el reloj
     "regla" → debajo de la etiqueta del precio actual, dentro de la regla (como TradingView)
     "off"   → no se muestra */
  const cdl=document.createElement("div");cdl.className="wcdl";chartEl.appendChild(cdl);
  const cdc=document.createElement("div");cdc.className="wcdc";cdc.innerHTML='<b></b><span></span>';chartEl.appendChild(cdc);
  const cdcN=cdc.firstChild,cdcT=cdc.lastChild;
  const cdMode=()=>{if(isTk()||XF==="renko")return"off";const m=o.getCdMode&&o.getCdMode();return m==="regla"||m==="vela"?m:"off"};  /* "mtf" (por defecto): el reloj va en cada mini de la multitemporalidad, no en el gráfico grande */
  /* espacio libre a la derecha de la última vela para que el contador no tape velas (como el "desplazamiento" de MT5) */
  /* OJO: setOffsetRightDistance mueve la vista al tiempo real, así que SOLO se llama al cargar el mercado o al cambiar el modo/la letra
     (antes se llamaba en cada cuadro y al hacer zoom con la rueda el gráfico se iba para un lado) */
  let offR=null,offMode=null,offF=null;
  const wantOffR=()=>{const m=cdMode();if(m!=="vela")return 80;const f=fz(),w=cdc.offsetWidth||Math.round(f*6.6+18);return Math.max(80,Math.round((w+28)/10)*10)};
  function fixOffR(force){const d=wantOffR();if(!force&&d===offR)return;offR=d;offMode=cdMode();try{chart.setOffsetRightDistance(d)}catch(e){}}
  const symShort=()=>String(sym.shortName||sym.name||sym.ticker||"").replace(/\s+Index$/i,"").trim();
  function placeCdl(){const L=chart.getDataList(),last=L[L.length-1],mode=cdMode();if(!last||!ready||mode==="off"){cdl.hidden=true;cdc.hidden=true;if(ready&&offMode!==mode)fixOffR();return}
    try{const pt=chart.convertToPixel({timestamp:last.timestamp,value:last.close},{paneId:"candle_pane",absolute:true}),ya=chart.getSize("candle_pane","yAxis"),mn=chart.getSize("candle_pane","main");
      if(!pt||!ya||pt.y==null||pt.y<0||pt.y>ya.height){cdl.hidden=true;cdc.hidden=true;return}
      const left=Math.max(0,last.timestamp+msOf(per)-Date.now()),s2=Math.floor(left/1000),h=Math.floor(s2/3600),m=Math.floor(s2%3600/60);
      const txt=h?`${h}:${two(m)}:${two(s2%60)}`:`${two(m)}:${two(s2%60)}`;
      const up=((extra.candle||{}).bar||{}).upColor||"#089981",dn=((extra.candle||{}).bar||{}).downColor||"#f23645",col=last.close>=last.open?up:dn,f=fz();
      if(offMode!==mode)fixOffR();
      if(mode==="regla"){cdc.hidden=true;cdl.textContent=txt;cdl.style.background=col;
        /* pegado justo debajo de la etiqueta del precio, del mismo ancho y color: se ven como una sola pieza */
        const B=lpBox||{w:Math.ceil(mw("88:88",f)+Math.round(f*.4)*2),h:f+Math.round(f*.3)*2,f};
        cdl.style.left=(B.z?ya.left:ya.left+ya.width-B.w)+"px";cdl.style.width=B.w+"px";cdl.style.height=B.h+"px";cdl.style.lineHeight=B.h+"px";cdl.style.fontSize=f+"px";
        const yy=B.y!=null?B.y:pt.y;cdl.style.top=(yy-B.h/2+B.h)+"px";cdl.hidden=false;return}
      /* modo MT5: a la derecha de la última vela, justo debajo de la línea del precio */
      cdl.hidden=true;
      const bw=(()=>{try{return chart.getBarSpace()}catch(e){return 8}})(),x=pt.x+bw/2+8;
      if(!mn||pt.x==null||x<mn.left||pt.x>mn.left+mn.width+bw){cdc.hidden=true;return}
      if(cdcN.textContent!==symShort())cdcN.textContent=symShort();if(cdcT.textContent!==txt)cdcT.textContent=txt;
      cdc.classList.toggle("soon",left<10000);cdc.style.setProperty("--cdc",col);cdc.hidden=false;
      const w=cdc.offsetWidth,hh=cdc.offsetHeight,maxX=mn.left+mn.width-w-6;
      let top=pt.y+6;if(top+hh>mn.top+mn.height-4)top=pt.y-6-hh;
      cdc.style.transform=`translate(${Math.round(Math.max(mn.left+4,Math.min(x,maxX)))}px,${Math.round(top)}px)`}catch(e){cdl.hidden=true;cdc.hidden=true}}
  const cdlT=setInterval(()=>{if(!root.isConnected)return clearInterval(cdlT);placeCdl()},500);
  try{chart.subscribeAction("onScroll",placeCdl);chart.subscribeAction("onZoom",placeCdl)}catch(e){}
  /* el reloj de cierre sigue al precio cuadro a cuadro mientras mueves o estiras la escala (antes se actualizaba cada medio segundo y "saltaba") */
  let cdUntil=0,cdLoop=false;
  function cdKick(ms){cdUntil=Math.max(cdUntil,Date.now()+(ms||700));if(cdLoop)return;cdLoop=true;const f=()=>{placeCdl();if(Date.now()<cdUntil&&root.isConnected)requestAnimationFrame(f);else cdLoop=false};requestAnimationFrame(f)}
  ["pointerdown","pointermove","wheel","touchmove"].forEach(ev=>chartEl.addEventListener(ev,e=>{if(ev==="pointermove"&&!e.buttons&&e.pointerType==="mouse")return;cdKick()},{passive:true,capture:true}));

  /* clics rápidos al dibujar: el motor tomaba un 2º clic hecho antes de medio segundo (aunque fuera en otro lugar)
     como intento de doble clic y se lo "tragaba": ese punto no se marcaba. Si el clic es en otro lugar, se cuenta como clic nuevo. */
  {let lastDn=null;chartEl.addEventListener("mousedown",e=>{if(e.button!==0)return;const n=Date.now();
    if(lastDn&&n-lastDn.t<520&&Math.abs(e.clientX-lastDn.x)+Math.abs(e.clientY-lastDn.y)>=5){
      try{const se=chart._chartEvent&&chart._chartEvent._event;se&&se._resetClickTimeout&&se._resetClickTimeout()}catch(err){}}
    lastDn={x:e.clientX,y:e.clientY,t:n}},true)}
  /* estirar la regla de precios arrastrando arriba/abajo (mouse y dedo).
     El motor original escalaba según la altura absoluta del mouse en la pantalla (cerca del borde "se frenaba")
     y se detenía si el mouse se salía un poco de la regla. Aquí: proporcional al movimiento, suave, y sigue aunque salgas de la regla.
     Doble clic / doble toque en la regla: vuelve a la escala automática. */
  {let yd=null,lastTapY=0;
    const inYAxis=(cx,cy)=>{try{const r=chartEl.getBoundingClientRect(),ya=chart.getSize("candle_pane","yAxis");if(!ya)return false;const x=cx-r.left,y=cy-r.top;
      return x>=ya.left&&x<=ya.left+ya.width&&y>=ya.top&&y<=ya.top+ya.height}catch(e){return false}};
    const axC=()=>chart._candlePane&&chart._candlePane.getAxisComponent();
    const start=(cy,isTouch)=>{const ax=axC();const rg=ax&&ax.getRange&&ax.getRange();if(!rg)return false;
      let h=300;try{h=chart.getSize("candle_pane","yAxis").height||300}catch(e){}
      yd={y0:cy,rg:Object.assign({},rg),h,ax};return true};
    const move=cy=>{if(!yd)return;const {ax,rg,h}=yd,k=Math.exp((cy-yd.y0)*2.2/h),nr=rg.range*k,c=(rg.from+rg.to)/2,from=c-nr/2,to=c+nr/2;
      try{ax.setAutoCalcTickFlag?ax.setAutoCalcTickFlag(false):(ax._autoCalcTickFlag=false);
        const rf=ax.convertToRealValue(from),rt=ax.convertToRealValue(to);ax.setRange({from,to,range:nr,realFrom:rf,realTo:rt,realRange:rt-rf});
        chart.adjustPaneViewport(false,true,true,true)}catch(e){}cdKick(200)};
    const end=()=>{yd=null;document.removeEventListener("mousemove",mm,true);document.removeEventListener("mouseup",mu,true)};
    const mm=e=>{if(!yd)return;e.preventDefault();e.stopPropagation();move(e.clientY)};
    const mu=e=>{if(!yd)return;e.stopPropagation();end()};
    chartEl.addEventListener("mousedown",e=>{if(e.button!==0||!inYAxis(e.clientX,e.clientY))return;if(e.detail>=2)return;
      if(!start(e.clientY))return;e.preventDefault();e.stopPropagation();document.addEventListener("mousemove",mm,true);document.addEventListener("mouseup",mu,true)},true);
    chartEl.addEventListener("dblclick",e=>{if(inYAxis(e.clientX,e.clientY)){end();autoScale();cdKick(300)}},true);
    chartEl.addEventListener("touchstart",e=>{if(e.touches.length!==1)return;const t=e.touches[0];if(!inYAxis(t.clientX,t.clientY))return;
      const now=Date.now();if(now-lastTapY<300){lastTapY=0;autoScale();cdKick(300);e.preventDefault();e.stopPropagation();return}lastTapY=now;
      if(!start(t.clientY,true))return;e.stopPropagation()},{capture:true,passive:false});
    chartEl.addEventListener("touchmove",e=>{if(!yd)return;e.preventDefault();e.stopPropagation();move(e.touches[0].clientY)},{capture:true,passive:false});
    chartEl.addEventListener("touchend",e=>{if(yd){e.stopPropagation();end()}},true);
    chartEl.addEventListener("touchcancel",()=>{if(yd)end()},true)}
  /* rueda del mouse como en los charts de Deriv/TradingView: el zoom se ancla en la última vela (lado derecho),
     así el gráfico no se "va" para un lado. Con Ctrl o ⌘ apretado, el zoom es donde está el mouse. */
  chartEl.addEventListener("wheel",e=>{
    if(e.ctrlKey||e.metaKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)||!e.deltaY||brushOn)return;
    if(panLocked&&panLocked.split("|")[1]==="true")return;
    try{const r=chartEl.getBoundingClientRect(),mn=chart.getSize("candle_pane","main");if(!mn)return;
      const x=e.clientX-r.left;if(x<mn.left||x>mn.left+mn.width)return;
      let d=-(e.deltaY/100);if(e.deltaMode===1)d*=32;else if(e.deltaMode===2)d*=120;
      const sc=Math.sign(d)*Math.min(1,Math.abs(d));if(!sc)return;
      e.preventDefault();e.stopPropagation();
      const L=chart.getDataList(),last=L[L.length-1];let ax=mn.width;
      if(last){const pt=chart.convertToPixel({timestamp:last.timestamp,value:last.close},{paneId:"candle_pane"});if(pt&&pt.x!=null&&pt.x>=0&&pt.x<=mn.width)ax=pt.x}
      chart.zoomAtCoordinate(1+sc/10,{x:ax,y:0});cdKick()}catch(err){}},{passive:false,capture:true});

  /* ---------- navegación rápida (abajo al centro) ---------- */
  let bs0=null;setTimeout(()=>{try{bs0=chart.getBarSpace()}catch(e){}},0);
  /* botones de navegación (mover, acercar, recargar): aparecen solo al pasar el mouse por la parte de abajo del gráfico, como en TradingView */
  {const wc=root.querySelector(".wnav").parentNode,nv=root.querySelector(".wnav");let hT=null;
    const show=on=>{clearTimeout(hT);if(on)wc.classList.add("navshow");else hT=setTimeout(()=>wc.classList.remove("navshow"),450)};
    wc.addEventListener("mousemove",e=>{const r=wc.getBoundingClientRect(),y=e.clientY-r.top;show(y>r.height-130&&e.clientX-r.left<r.width-60)},{passive:true});
    wc.addEventListener("mouseleave",()=>show(false));nv.addEventListener("mouseenter",()=>show(true));
    /* en celular: aparecen unos segundos al tocar la parte de abajo */
    wc.addEventListener("touchstart",e=>{const r=wc.getBoundingClientRect(),t=e.touches[0];if(t&&t.clientY-r.top>r.height-150){clearTimeout(hT);wc.classList.add("navshow");hT=setTimeout(()=>wc.classList.remove("navshow"),3500)}},{passive:true})}
  {const jb=root.querySelector(".wjr");if(jb){jb.onclick=e=>{e.stopPropagation();window.EAGJournal&&window.EAGJournal.toggle()};jb.addEventListener("pointerdown",e=>e.stopPropagation())}}
  {const tb=root.querySelector(".wtrk");if(tb){tb.onclick=e=>{e.stopPropagation();o.onTracker()};tb.addEventListener("pointerdown",e=>e.stopPropagation())}}
  root.querySelectorAll(".wnav button").forEach(b=>b.onclick=e=>{e.stopPropagation();const n=b.dataset.n,w=chartEl.clientWidth;
    try{if(n==="left")chart.scrollByDistance(w*.35,250);else if(n==="right")chart.scrollByDistance(-w*.35,250);
      else if(n==="reset"){pinTs=null;if(bs0)chart.setBarSpace(bs0);chart.scrollToRealTime(300);autoScale()}
      else if(n==="reload"){if(o.onFullReload&&o.onFullReload()){b.classList.add("spin");return}b.classList.add("spin");setTimeout(()=>b.classList.remove("spin"),900);if(bs0)chart.setBarSpace(bs0);loadData();o.onReload&&o.onReload()}}catch(x){}});

  /* ---------- barra de dibujo ---------- */
  const lastTool=Object.assign({},o.lastTools||{});
  let menu=null;const closeMenu=()=>{if(menu){menu.remove();menu=null}};
  /* cualquier clic o toque afuera cierra el menú del dibujo; fuera del gráfico también se quita la barra de estilo */
  const outside=e=>{const t=e.target;if(!t||!t.closest)return;
    if(menu&&!menu.contains(t)&&!t.closest(".dg .more")&&!t.closest(".dg>.dt"))closeMenu();
    if(!sbar.hidden&&!sbar.contains(t)&&!chartEl.contains(t)&&!(menu&&menu.contains(t))){hideStyleBar()}};
  ["pointerdown","mousedown","touchstart"].forEach(ev=>document.addEventListener(ev,outside,{capture:true,passive:true}));
  addEventListener("blur",()=>{if(menu&&!menu.classList.contains("panel"))closeMenu()});
  const dbarFade=()=>{const t=dbar.scrollTop,h=dbar.clientHeight,H=dbar.scrollHeight;dbar.classList.toggle("more-t",t>4);dbar.classList.toggle("more-b",t+h<H-4)};
  dbar.addEventListener("scroll",()=>requestAnimationFrame(dbarFade),{passive:true});addEventListener("resize",()=>setTimeout(dbarFade,100));
  try{new ResizeObserver(()=>dbarFade()).observe(dbar)}catch(e){}try{new MutationObserver(()=>setTimeout(dbarFade,0)).observe(dbar,{childList:true})}catch(e){}
  function paintDbar(){
    dbar.innerHTML=`<div class="dmini"><button class="dt dtf" title="Temporalidad (todas)"><b>${esc(per.text)}</b></button><button class="dt" data-mi="sym" title="Cambiar mercado">${svg("list",17)}</button><button class="dt" data-mi="ind" title="Indicadores">${svg("fx",17)}</button><i class="dsep"></i></div><button class="dt" data-k="cross" title="Cursor (cancelar dibujo)">${svg("cross",21)}</button><i class="dsep"></i>`+
      TOOLS.map(g=>{const cur=lastTool[g.g]||g.items[0][0];return`<div class="dg" data-g="${g.g}"><button class="dt${cur==="eagBrush"&&brushOn?" act":""}" data-k="${cur}" title="${esc(TNAME[cur])} · doble clic: ver todas">${tsvg(cur,22)}</button><button class="more" title="${esc(g.t)}">${svg("caret",9)}</button></div>`}).join("")+
      `<i class="dsep"></i><button class="dt tg${stay?" on":""}" data-x="stay" title="${stay?"Modo dibujo fijo: activado (sigues dibujando con la misma herramienta)":"Mantener modo dibujo: dibuja seguido sin volver a elegir la herramienta"}">${svg("stay",21)}</button><button class="dt tg${magnet!=="normal"?" on":""}" data-x="magnet" title="${magnet==="strong_magnet"?"Imán fuerte":magnet==="weak_magnet"?"Imán débil":"Imán apagado"}">${svg("magnet",21)}<em>${magnet==="strong_magnet"?"F":magnet==="weak_magnet"?"D":""}</em></button>
      <button class="dt tg${locked?" on":""}" data-x="lock" title="${locked?"Desbloquear dibujos":"Bloquear todos los dibujos"}">${svg(locked?"lock":"unlock",21)}</button>
      <button class="dt tg${hidden?" on":""}" data-x="hide" title="${hidden?"Mostrar dibujos":"Ocultar todos los dibujos"}">${svg(hidden?"eyeoff":"eye",21)}</button>
      ${o.onTfav?`<button class="dt tg" data-x="tfav" title="Barra rápida de dibujos favoritos (mostrar u ocultar)"><b class="dstar">★</b></button>`:""}
      <button class="dt" data-x="clear" title="Borrar todos los dibujos de este mercado">${svg("trash",21)}</button>`;
    dbar.querySelector(".dtf").onclick=e=>{e.stopPropagation();o.onTFClick&&o.onTFClick(e.currentTarget)};
    dbar.querySelector('[data-mi="sym"]').onclick=e=>{e.stopPropagation();o.onSymbolClick&&o.onSymbolClick(e.currentTarget)};
    dbar.querySelector('[data-mi="ind"]').onclick=e=>{e.stopPropagation();openInd()};
    dbar.querySelectorAll(".dt[data-k]").forEach(b=>b.onclick=()=>{if((b.dataset.k==="eagBrush"||b.dataset.k==="eagHighlighter")&&brushOn){stopBrush();return}stopBrush();b.dataset.k==="cross"?cancelDraw():startTool(b.dataset.k)});
    /* doble clic sobre un grupo: abre la lista completa */
    /* doble clic o doble toque (también en celular) */
    dbar.querySelectorAll(".dg>.dt").forEach(b=>{let lt=0;b.addEventListener("click",e=>{const n=Date.now();if(n-lt<380){e.stopImmediatePropagation();e.preventDefault();lt=0;cancelDraw();const g=TOOLS.find(x=>x.g===b.parentNode.dataset.g);openToolMenu(g,b.parentNode)}else lt=n},true)});
    dbar.querySelectorAll(".dg .more").forEach(b=>b.onclick=e=>{e.stopPropagation();const g=TOOLS.find(x=>x.g===b.parentNode.dataset.g);openToolMenu(g,b.parentNode)});
    /* mantener presionado o deslizar sobre el botón abre la lista; soltar sobre una herramienta la elige */
    dbar.querySelectorAll(".dg>.dt").forEach(b=>{
      let st=null,tm=null,opened=false,hv=null,hvT=0;
      const open=()=>{if(opened)return;opened=true;clearTimeout(tm);const g=TOOLS.find(x=>x.g===b.parentNode.dataset.g);openToolMenu(g,b.parentNode);b.classList.add("hold")};
      b.addEventListener("pointerdown",e=>{if(e.button!==0)return;st={x:e.clientX,y:e.clientY};opened=false;tm=setTimeout(open,320);try{b.setPointerCapture(e.pointerId)}catch(x){}});
      b.addEventListener("pointermove",e=>{if(!st)return;if(e.pointerType!=="touch"&&Math.hypot(e.clientX-st.x,e.clientY-st.y)>8)open();
        if(opened&&menu){menu.querySelectorAll("button").forEach(x=>x.classList.remove("hov"));const t=document.elementFromPoint(e.clientX,e.clientY),it=t&&t.closest(".wmenu button");it&&it.classList.add("hov");if(it!==hv){hv=it;hvT=Date.now()}}});
      b.addEventListener("pointerup",e=>{clearTimeout(tm);b.classList.remove("hold");if(!st)return;st=null;
        /* igual en todos los grupos: al soltar, solo elige si te quedaste un momento encima de una herramienta; si no, la lista queda abierta para tocarla */
        if(opened){const t=document.elementFromPoint(e.clientX,e.clientY),it=t&&t.closest(".wmenu button");if(it&&it===hv&&Date.now()-hvT>=180)it.click();else if(menu)menu.querySelectorAll("button.hov").forEach(x=>x.classList.remove("hov"));hv=null;b.dataset.skip="1";setTimeout(()=>delete b.dataset.skip,50)}});
      b.addEventListener("pointercancel",()=>{clearTimeout(tm);st=null;b.classList.remove("hold")});
      b.addEventListener("click",e=>{if(b.dataset.skip){e.stopImmediatePropagation();e.preventDefault()}},true)});
    dbar.querySelector('[data-x="magnet"]').onclick=()=>{magnet=magnet==="normal"?"weak_magnet":magnet==="weak_magnet"?"strong_magnet":"normal";ovs.forEach((v,id)=>chart.overrideOverlay({id,mode:NOMAG.test(v.name)?"normal":magnet}));o.onMagnet&&o.onMagnet(magnet);paintDbar()};
    dbar.querySelector('[data-x="stay"]').onclick=()=>{stay=!stay;try{localStorage.setItem("eag_stay",stay?"1":"0")}catch(e){}if(!stay&&drawingId)cancelDraw();paintDbar();o.onToast&&o.onToast(stay?"Modo dibujo fijo: elige una herramienta y dibuja seguido. Para salir: Esc o toca este botón":"Modo dibujo fijo apagado")};
    dbar.querySelector('[data-x="lock"]').onclick=()=>{locked=!locked;ovs.forEach((v,id)=>{v.lock=locked;chart.overrideOverlay({id,lock:locked})});persist();paintDbar()};
    dbar.querySelector('[data-x="hide"]').onclick=()=>{hidden=!hidden;ovs.forEach((v,id)=>chart.overrideOverlay({id,visible:!hidden&&tfOk(v)}));guestIds.forEach(id=>{try{chart.overrideOverlay({id,visible:!hidden})}catch(e){}});paintDbar()};
    const tfb=dbar.querySelector('[data-x="tfav"]');if(tfb)tfb.onclick=e=>{e.stopPropagation();o.onTfav()};
    const cl=dbar.querySelector('[data-x="clear"]');cl.onclick=()=>{if(!ovs.size)return;if(!cl.classList.contains("confirm")){cl.classList.add("confirm");cl.title="Toca otra vez para borrar todo";setTimeout(()=>{cl.classList.remove("confirm");cl.title="Borrar todos los dibujos de este mercado"},2500);return}
      bulk=true;try{chart.removeOverlay()}catch(e){}bulk=false;ovs.clear();persist();hideStyleBar();paintDbar();guestIds=[];paintGuest();setTimeout(renderAlerts,0)};
  }
  function openToolMenu(g,anchor){closeMenu();menu=document.createElement("div");menu.className="wmenu";
    const favs=(o.getToolFav&&o.getToolFav())||[];
    menu.innerHTML=`<div class="mt">${esc(g.t)}</div>`+g.items.map(([k,t])=>k==="-"?`<div class="msec">${esc(t)}</div>`:`<button data-k="${k}" class="${(lastTool[g.g]||g.items[0][0])===k?"on":""}${toolOK(k)?"":" lk"}">${tsvg(k,20)}<span>${esc(t)}${toolOK(k)?"":' <em class="lkb">🔒 Plata</em>'}</span><i class="tst${favs.includes(k)?" on":""}" data-fav="${k}" title="${favs.includes(k)?"Quitar de la barra de favoritos":"Agregar a la barra de favoritos"}">${favs.includes(k)?"★":"☆"}</i></button>`).join("");
    document.body.appendChild(menu);const r=anchor.getBoundingClientRect();menu.style.maxWidth="calc(100vw - 16px)";menu.style.left=Math.max(8,Math.min(r.right+6,innerWidth-menu.offsetWidth-8))+"px";menu.style.top=Math.max(safeTop()+8,Math.min(r.top,innerHeight-menu.offsetHeight-8))+"px";
    menu.querySelectorAll("[data-fav]").forEach(f=>f.addEventListener("click",e=>{e.stopPropagation();o.onToolFav&&o.onToolFav(f.dataset.fav);const on=((o.getToolFav&&o.getToolFav())||[]).includes(f.dataset.fav);f.classList.toggle("on",on);f.textContent=on?"★":"☆"},true));
    menu.querySelectorAll("button").forEach(b=>b.onclick=()=>{lastTool[g.g]=b.dataset.k;o.onLastTools&&o.onLastTools(lastTool);closeMenu();stopBrush();paintDbar();startTool(b.dataset.k)})}
  let drawingId=null;
  /* ---------- pincel ---------- */
  /* ---------- puntero láser (para explicar en vivo): punto rojo con estela que se desvanece ----------
     Lo tuyo se dibuja al mover el mouse; en Modo Clase se manda a los alumnos en coordenadas del gráfico (vela + precio). */
  let laserOn=false,lzEl=null,lzCx=null,lzPts=[],lzRem=[],lzRaf=0,lzEmit=0;
  const LZ_LIFE=750,LZ_REM=1100;
  function lzEnsure(){if(lzEl)return;lzEl=document.createElement("canvas");lzEl.className="wlaser";chartEl.appendChild(lzEl);lzCx=lzEl.getContext("2d")}
  function lzDrop(){if(lzEl&&!laserOn&&!lzRem.length){lzEl.remove();lzEl=null;lzCx=null}}
  function lzKick(){if(!lzRaf)lzRaf=requestAnimationFrame(lzDraw)}
  function lzRemPx(q){try{const a=chart.convertToPixel({timestamp:q.ts,value:q.v},{paneId:"candle_pane"});if(!a||!isFinite(a.x)||!isFinite(a.y))return null;return{x:a.x+(q.f||0)*(chart.getBarSpace()||0),y:a.y,t:q.t}}catch(e){return null}}
  /* solo la bolita roja (sin estela) */
  function lzDot(h,k){const c=lzCx;if(!h||k<=0)return;
    c.save();c.shadowColor="rgba(255,30,30,.95)";c.shadowBlur=16;c.fillStyle=`rgba(255,45,45,${(0.95*k).toFixed(3)})`;c.beginPath();c.arc(h.x,h.y,6.5,0,Math.PI*2);c.fill();c.restore();
    c.fillStyle=`rgba(255,235,235,${k.toFixed(3)})`;c.beginPath();c.arc(h.x,h.y,2.4,0,Math.PI*2);c.fill()}
  function lzDraw(){lzRaf=0;if(!lzEl)return;const now=performance.now(),d=devicePixelRatio||1,W=chartEl.clientWidth,H=chartEl.clientHeight;
    if(lzEl.width!==Math.round(W*d)||lzEl.height!==Math.round(H*d)){lzEl.width=Math.round(W*d);lzEl.height=Math.round(H*d);lzEl.style.width=W+"px";lzEl.style.height=H+"px"}
    lzCx.setTransform(d,0,0,d,0,0);lzCx.clearRect(0,0,W,H);
    /* la tuya: mientras el mouse está sobre el gráfico */
    if(laserOn&&lzPts.length)lzDot(lzPts[lzPts.length-1],1);
    /* la del profe: se desliza suave entre posiciones y se apaga si deja de moverla un rato */
    lzRem=lzRem.slice(-2);let busy=false;
    if(lzRem.length){const P=lzRem.map(lzRemPx).filter(Boolean);const b=P[P.length-1];
      if(b){const a=P.length>1?P[0]:b,k=Math.min(1,(now-b.t)/140),idle=now-b.t,al=idle<2500?1:Math.max(0,1-(idle-2500)/400);
        lzDot({x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k},al);busy=al>0}
      if(!busy)lzRem=[]}
    if(busy||(lzRem.length&&performance.now()-lzRem[lzRem.length-1].t<3000))lzKick();else lzDrop()}
  chartEl.addEventListener("pointermove",e=>{if(!laserOn)return;const r=chartEl.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,now=performance.now();
    lzPts=[{x,y,t:now}];lzEnsure();lzKick();
    if(o.onLaser&&now-lzEmit>150){lzEmit=now;try{const c=chart.convertFromPixel([{x,y}],{paneId:"candle_pane"})[0];const ts=c&&tsOf(c);
      if(ts&&isFinite(c.value)){let f=0;try{const cx=chart.convertToPixel({timestamp:ts,value:c.value},{paneId:"candle_pane"}).x,bs=chart.getBarSpace()||0;if(bs>0)f=+((x-cx)/bs).toFixed(3)}catch(e){}
        o.onLaser({ts,v:+c.value,f,sym:sym&&sym.ticker})}}catch(e){}}},{passive:true});
  chartEl.addEventListener("pointerleave",()=>{if(!laserOn)return;lzPts=[];lzKick();if(o.onLaser)o.onLaser({off:1,sym:sym&&sym.ticker})});
  function setLaser(on){laserOn=!!on;chartEl.classList.toggle("lzon",laserOn);try{chart.setStyles({crosshair:{show:!laserOn}})}catch(e){}if(laserOn){lzEnsure();lzKick()}else{lzPts=[];if(!lzRem.length&&lzEl){lzEl.remove();lzEl=null;lzCx=null}else lzKick()}return laserOn}
  function laserRemote(q){if(!q)return;if(q.off){lzRem=[];lzKick();return}if(!q.ts||!isFinite(q.v))return;lzRem.push({ts:q.ts,v:q.v,f:q.f||0,t:performance.now()});if(lzRem.length>2)lzRem.shift();lzEnsure();lzKick()}
  let brushOn=false,brushEl=null,movSnap=null,ptrDown=null,boxDrag=null;
  /* ---------- zonas y rectángulos: estirar desde las líneas y los bordes; por dentro no se corren ----------
     · línea de arriba / de abajo (en cualquier parte, también fuera del recuadro): cambia ese precio
     · borde izquierdo / derecho: cambia el ancho
     · zona de compra o venta por dentro: no se mueve (solo se selecciona); para moverla entera se arrastra su etiqueta */
  /* posición exacta (fraccionaria) de una hora y de un pixel, con las velas de la temporalidad actual */
  const bxFi=q=>{const L=chart.getDataList();return okT(q.timestamp)?fiOfTs(L,q.timestamp):(q.dataIndex!=null?q.dataIndex:null)};
  const bxX=fi=>{try{return chart.convertToPixel([{dataIndex:fi,value:0}],{paneId:"candle_pane"})[0].x}catch(e){return NaN}};
  const bxY=v=>{try{return chart.convertToPixel([{dataIndex:0,value:v}],{paneId:"candle_pane"})[0].y}catch(e){return NaN}};
  function pxAt(x,y){let c=null;try{c=chart.convertFromPixel([{x,y}],{paneId:"candle_pane"})[0]}catch(e){}if(!c||!isFinite(c.value)||c.dataIndex==null)return null;
    let bs=10;try{const b=chart.getBarSpace();bs=typeof b==="number"?b:(b&&b.bar)||10}catch(e){}
    const xi=bxX(c.dataIndex);return{fi:c.dataIndex+(isFinite(xi)?(x-xi)/bs:0),value:c.value}}
  /* qué parte de la caja se tocó: manija (0-7), línea de arriba/abajo, borde, etiqueta (mover) o el interior */
  function boxHit(e){const ov=e.overlay,P=ov.points||[];if(P.length<4)return null;
    const snap=P.map(q=>Object.assign({},q)),fL=bxFi(P[0]),fR=bxFi(P[1]);if(fL==null||fR==null)return null;
    const xL=bxX(fL),xR0=bxX(fR),yT=bxY(Math.max(P[0].value,P[3].value)),yB=bxY(Math.min(P[0].value,P[3].value));
    const xR=ov.name==="eagZone"?Infinity:xR0,xM=(xL+xR0)/2,yM=(yT+yB)/2;
    const tol=ptrDown&&ptrDown.touch?14:7,ht=ptrDown&&ptrDown.touch?16:9;
    const k=String(e.figureKey||""),x=e.x,y=e.y,bs=ov.name==="eagBuyZone"||ov.name==="eagSellZone",st=pxAt(x,y);
    const R=m=>({id:ov.id,m,snap,fL,fR,st});
    const hk=/hdl_(\d)/.exec(k);if(hk)return R(+hk[1]);
    const H=[[xL,yT],[xR0,yT],[xR0,yB],[xL,yB],[xM,yT],[xR0,yM],[xM,yB],[xL,yM]];
    for(let i=0;i<8;i++)if(Math.hypot(x-H[i][0],y-H[i][1])<=ht)return R(i);
    if(/edgeT$/.test(k)||Math.abs(y-yT)<=tol)return R(4);
    if(/edgeB$/.test(k)||Math.abs(y-yB)<=tol)return R(6);
    if(y>yT&&y<yB&&Math.abs(x-xL)<=tol)return R(7);
    if(y>yT&&y<yB&&isFinite(xR)&&Math.abs(x-xR)<=tol)return R(5);
    if(bs)return R(x>=xL&&x<=xL+110&&y>=yT&&y<=yT+26?"move":"lock");
    return R("move")}
  function boxDragMove(e){if(!boxDrag||boxDrag.id!==e.overlay.id)return false;const d=boxDrag,m=d.m;if(m==="lock")return true;
    const now=pxAt(e.x,e.y);if(!now||!d.st)return true;const L=chart.getDataList(),S=d.snap;
    let fL=d.fL,fR=d.fR,T=Math.max(S[0].value,S[3].value),B=Math.min(S[0].value,S[3].value);
    if(m==="move"){const df=Math.round(now.fi-d.st.fi),dv=now.value-d.st.value;fL+=df;fR+=df;T+=dv;B+=dv}
    else{const fx=Math.round(now.fi);if([0,3,7].includes(m))fL=fx;if([1,2,5].includes(m))fR=fx;if([0,1,4].includes(m))T=now.value;if([2,3,6].includes(m))B=now.value}
    if(m==="move"){/* al mover entera conserva su posición exacta (no se pega a otra vela) */}
    const tL=m==="move"||[0,3,7].includes(m)?tsOfFi(L,fL):S[0].timestamp,tR=m==="move"||[1,2,5].includes(m)?tsOfFi(L,fR):S[1].timestamp;
    const a={value:T},b={value:B};if(okT(tL))a.timestamp=tL;else a.dataIndex=Math.round(fL);if(okT(tR))b.timestamp=tR;else b.dataIndex=Math.round(fR);
    const pts=boxPts(a,b);
    try{chart.overrideOverlay({id:e.overlay.id,points:pts})}catch(x){}return true}
  /* cuánto se movió realmente el mouse o el dedo desde que se presionó */
  chartEl.addEventListener("pointerdown",e=>{ptrDown={x:e.clientX,y:e.clientY,max:0,touch:e.pointerType!=="mouse"}},true);
  chartEl.addEventListener("pointermove",e=>{if(ptrDown&&e.buttons)ptrDown.max=Math.max(ptrDown.max,Math.hypot(e.clientX-ptrDown.x,e.clientY-ptrDown.y))},true);
  let brushHl=false;
  function startBrush(hl){cancelDraw();if(brushOn){if(!!hl===brushHl)return;stopBrush()}brushHl=!!hl;brushOn=true;setTimeout(syncPan,0);
    brushEl=document.createElement("canvas");brushEl.className="wbrush";chartEl.appendChild(brushEl);
    const fit=()=>{const r=chartEl.getBoundingClientRect(),d=devicePixelRatio||1;brushEl.width=r.width*d;brushEl.height=r.height*d;brushEl.style.width=r.width+"px";brushEl.style.height=r.height+"px"};fit();
    const cx=brushEl.getContext("2d");let pts=null;
    const pos=e=>{const r=brushEl.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
    brushEl.onpointerdown=e=>{if(e.button===2){stopBrush();return}e.preventDefault();try{brushEl.setPointerCapture(e.pointerId)}catch(x){}pts=[pos(e)];const d=devicePixelRatio||1;
      const bs=((o.getToolStyle&&o.getToolStyle("eagBrush"))||{}).ex||{};cx.setTransform(d,0,0,d,0,0);cx.strokeStyle=brushHl?hexA(bs.color||"#ffeb3b",.4):(bs.color||GOLD);cx.lineWidth=brushHl?14:(bs.size||2);cx.lineCap="round";cx.lineJoin="round";cx.beginPath();cx.moveTo(pts[0].x,pts[0].y)};
    brushEl.onpointermove=e=>{if(!pts)return;const p=pos(e),l=pts[pts.length-1];if(Math.hypot(p.x-l.x,p.y-l.y)<2.5)return;pts.push(p);cx.lineTo(p.x,p.y);cx.stroke()};
    brushEl.onpointerup=()=>{if(!pts)return;const P=pts;pts=null;cx.clearRect(0,0,brushEl.width,brushEl.height);if(P.length<2)return;
      let step=Math.ceil(P.length/400);const sel=P.filter((p,i)=>i%step===0||i===P.length-1);
      let conv=[];try{conv=chart.convertFromPixel(sel,{paneId:"candle_pane"})}catch(x){}
      if(!conv||conv.length<2)return;
      /* el trazo se guarda con su posición exacta entre velas (antes se pegaba al centro de cada vela y quedaba en escalones) */
      const c0=conv[0],ts0=tsOf(c0),v0=c0.value;if(!ts0||!isFinite(v0))return;
      let xc=null,bs=null;try{const i0=c0.dataIndex;const a=chart.convertToPixel({dataIndex:i0,value:v0},{paneId:"candle_pane"}),b=chart.convertToPixel({dataIndex:i0+1,value:v0},{paneId:"candle_pane"});xc=a.x;bs=b.x-a.x}catch(x){}
      if(!(bs>0)||!isFinite(xc))return;
      const rel=sel.map((p,i)=>[+((p.x-xc)/bs).toFixed(3),+((conv[i]&&isFinite(conv[i].value)?conv[i].value:v0)-v0).toPrecision(8)]);
      const cl=conv[conv.length-1],points=[{timestamp:ts0,value:v0},{timestamp:tsOf(cl)||ts0,value:isFinite(cl.value)?cl.value:v0}];
      const bs2=((o.getToolStyle&&o.getToolStyle("eagBrush"))||{}).ex||{};const id=makeOverlay({name:"eagBrush",points,extendData:brushHl?{color:bs2.hlColor||"#ffeb3b",size:14,hl:true,rel}:{color:bs2.color||GOLD,size:bs2.size||2,rel}},false);if(id){const v=ovs.get(id);v.done=true;v.points=points;persist()}};
    brushEl.oncontextmenu=e=>{e.preventDefault();stopBrush()};
    dbar.querySelector("[data-b]")&&dbar.querySelector("[data-b]").classList.add("act");o.onToast&&o.onToast("✏️ Pincel activo: dibuja o escribe sobre el gráfico. Esc o clic derecho para salir.")}
  function stopBrush(){if(!brushOn)return;brushOn=false;setTimeout(syncPan,0);if(brushEl){brushEl.remove();brushEl=null}dbar.querySelectorAll('.dt[data-k="eagBrush"],.dt[data-k="eagHighlighter"]').forEach(b=>b.classList.remove("act"))}
  /* celular: mientras dibujas o tienes un dibujo seleccionado, el gráfico no se mueve (así se coloca mejor con el dedo).
     PC (mouse): como en los charts de Deriv, un dibujo seleccionado NO bloquea el gráfico: se puede arrastrar y hacer zoom
     con la rueda; el dibujo se mueve solo si lo agarras a él. Mientras dibujas, la rueda sigue haciendo zoom. */
  let panLocked=null;
  function syncPan(){const touch=lastTouch||(window.matchMedia&&matchMedia("(hover:none)").matches);
    const scrollLock=!!(brushOn||drawingId||(touch&&selId)),zoomLock=!!(brushOn||(touch&&(drawingId||selId)));
    const k=scrollLock+"|"+zoomLock;if(k===panLocked)return;panLocked=k;
    try{chart.setScrollEnabled(!scrollLock);chart.setZoomEnabled(!zoomLock)}catch(e){}chartEl.classList.toggle("locked",scrollLock)}
  function cancelDraw(){hideFin();if(ttWait){const w=ttWait;ttWait=null;try{chart.removeOverlay(w.id)}catch(e){}ovs.delete(w.id);persist()}if(drawingId){try{chart.removeOverlay(drawingId)}catch(e){}ovs.delete(drawingId);drawingId=null}dbar.querySelectorAll(".dt").forEach(b=>b.classList.remove("act"));syncPan()}
  const toolOK=n=>!o.toolAllowed||o.toolAllowed(n);
  /* herramientas sin número fijo de puntos (Ondas libres): se terminan con doble clic, clic derecho o el botón «Terminar» */
  const FREE=n=>{try{const C=KC.getOverlayClass(n);return C&&new C().totalStep>1000}catch(e){return false}};
  let finBtn=null;
  function finishFree(){const id=drawingId;if(!id)return false;const ov=chart.getOverlayById(id);if(!ov||!FREE(ov.name))return false;
    if((ov.points||[]).length<3){cancelDraw();o.onToast&&o.onToast("Marca al menos 2 puntos");return true}
    {const P=ov.points,a=P[P.length-1],b=P[P.length-2];if(a&&b&&a.timestamp===b.timestamp&&a.value===b.value)P.pop()}
    try{ov.forceComplete();const st=chart.getChartStore&&chart.getChartStore();st&&st.getOverlayStore().progressInstanceComplete()}catch(e){}
    try{ov.onDrawEnd&&ov.onDrawEnd({overlay:ov})}catch(e){}drawingId=null;hideFin();syncPan();return true}
  function showFin(){hideFin();finBtn=document.createElement("button");finBtn.className="wfin";finBtn.textContent="✓ Terminar";finBtn.onclick=e=>{e.stopPropagation();finishFree()};chartEl.appendChild(finBtn)}
  function hideFin(){if(finBtn){finBtn.remove();finBtn=null}}
  function startTool(name){hideFin();if(!toolOK(name)){cancelDraw();o.onLocked&&o.onLocked("tool",TNAME[name]||name);return}if(name==="eagHighlighter"){startBrush(true);const bb=dbar.querySelector('.dt[data-k="eagHighlighter"]');bb&&bb.classList.add("act");return}if(name==="eagBrush"){startBrush();const bb=dbar.querySelector('.dt[data-k="eagBrush"]');bb&&bb.classList.add("act");return}cancelDraw();
    const ts=(o.getToolStyle&&o.getToolStyle(name))||{};
    const ex=Object.assign(name==="eagText"?{text:"Texto"}:name==="eagNote"?{text:"Nota"}:name==="eagEmoji"?{text:"🚀",size:28}:{},ts.ex||{});
    const id=makeOverlay({name,extendData:Object.keys(ex).length?ex:undefined,styles:ts.styles||undefined},true);if(!id)return;drawingId=id;syncPan();
    if(FREE(name)){showFin();o.onToast&&o.onToast("Toca cada punto. Para terminar: doble clic, clic derecho o «✓ Terminar»")}
    dbar.querySelectorAll(".dt[data-k]").forEach(b=>b.classList.toggle("act",b.dataset.k===name))}
  /* puntos para mover (como Deriv/TradingView): del color de cada dibujo */
  const lcOf=v=>{const s=(v&&v.styles)||{},e=(v&&v.extendData)||{};return(s.line&&s.line.color)||(s.polygon&&s.polygon.borderColor)||e.color||GOLD};
  const ptOf=c=>({borderColor:c,activeColor:c,activeBorderColor:/^#/.test(c)?hexA(c,.28):c});
  const withPt=v=>Object.assign({},(v&&v.styles)||{},{point:ptOf(lcOf(v))});
  function refreshPt(id){const v=ovs.get(id);if(!v)return;try{chart.overrideOverlay({id,styles:withPt(v)})}catch(e){}}
  function makeOverlay(def,drawing){
    if(!drawing&&BOX.test(def.name)&&def.points&&def.points.length===2)def=Object.assign({},def,{points:boxPts(def.points[0],def.points[1]).map(p=>({timestamp:p.timestamp,value:p.value}))});
    const id=chart.createOverlay({name:def.name,points:def.points,styles:withPt(def),extendData:def.extendData,lock:!!def.lock,visible:!hidden&&tfOk(def),mode:NOMAG.test(def.name)?"normal":magnet,
      onDrawEnd:e=>{drawingId=null;hideFin();dbar.querySelectorAll(".dt").forEach(b=>b.classList.remove("act"));setTimeout(syncPan,0);
        if((e.overlay.name==="eagLong"||e.overlay.name==="eagShort")&&e.overlay.points.length<3)autoPos(e.overlay);
        if(BOX.test(e.overlay.name)&&e.overlay.points.length<8&&e.overlay.points.length>=2){const ps=e.overlay.points;chart.overrideOverlay({id:e.overlay.id,points:boxPts({timestamp:tsOf(ps[0]),dataIndex:ps[0].dataIndex,value:ps[0].value},{timestamp:tsOf(ps[1]),dataIndex:ps[1].dataIndex,value:ps[1].value})})}
        capture(chart.getOverlayById(e.overlay.id)||e.overlay);if(e.overlay.name==="eagText"||e.overlay.name==="eagNote")setTimeout(()=>editText(e.overlay.id),30);
        if(e.overlay.name==="eagEmoji"&&!stay)setTimeout(()=>{const pt=chart.convertToPixel(e.overlay.points[0],{paneId:"candle_pane"})||{x:60,y:60};panelPos=null;openCtx(e.overlay.id,{x:pt.x+20,y:pt.y-20},true,"texto")},30);
        if(!/^(eagText|eagNote)$/.test(e.overlay.name))again2(e.overlay.name);return false},
      onPressedMoveStart:e=>{movingOv=true;chartEl.classList.add("ovdrag");try{movSnap={id:e.overlay.id,points:JSON.parse(JSON.stringify(e.overlay.points||[]))}}catch(x){movSnap=null}
        boxDrag=BOX.test(e.overlay.name)?boxHit(e):null;return false},
      onPressedMoving:e=>boxDragMove(e),
      onPressedMoveEnd:e=>{movingOv=false;chartEl.classList.remove("ovdrag");
        /* un clic con un temblor de pocos píxeles no mueve el dibujo: vuelve exacto a su lugar (antes se corría al darle clic) */
        const tiny=ptrDown&&(ptrDown.max||0)<(ptrDown.touch?12:6);
        if(tiny&&movSnap&&movSnap.id===e.overlay.id&&movSnap.points.length){try{chart.overrideOverlay({id:e.overlay.id,points:movSnap.points})}catch(x){}movSnap=null;boxDrag=null;return false}
        movSnap=null;boxDrag=null;capture(chart.getOverlayById(e.overlay.id)||e.overlay);return false},
      onMouseEnter:e=>{chartEl.classList.add("ovh");hovId=e&&e.overlay&&e.overlay.id;return false},onMouseLeave:e=>{chartEl.classList.remove("ovh");if(e&&e.overlay&&hovId===e.overlay.id)hovId=null;return false},
      onSelected:e=>{const lv=ovs.get(e.overlay.id);if(lastTouch&&lv&&lv.lock)return false;selId=e.overlay.id;SELBOX.add(e.overlay.id);showStyleBar(e.overlay.id);syncPan();return false},
      onDeselected:e=>{SELBOX.delete(e.overlay.id);if(selId===e.overlay.id){selId=null;hideStyleBar()}syncPan();return false},
      onRemoved:e=>{SELBOX.delete(e.overlay.id);if(bulk)return false;ovs.delete(e.overlay.id);if(selId===e.overlay.id){selId=null;hideStyleBar()}persist();return false},
      onDoubleClick:e=>{if(e.overlay.id!==drawingId)openCtx(e.overlay.id,e,true);return false},
      onRightClick:e=>{ovCtxAt=Date.now();try{if(e.overlay.id===drawingId){if(!finishFree())cancelDraw();return true}panelPos=null;closeMenu();openCtx(e.overlay.id,e,true,"estilo")}catch(x){}return true}});
    if(id){OVSYM.set(id,sym&&sym.ticker);ovs.set(id,{name:def.name,styles:def.styles||null,extendData:def.extendData||null,lock:!!def.lock,points:def.points||null,tfv:def.tfv&&def.tfv.length?def.tfv.slice():null,ctf:def.ctf||null,hid:!!def.hid});if(!drawing)ovs.get(id).done=true}
    return id}
  /* ---------- capas de solo lectura (Modo Clase y Zonas del profe): no se guardan ni se pueden mover ---------- */
  let guest={},guestIds=[];const guestG={};
  /* capas de otros (solo lectura): grupos independientes → Modo Clase ("clase"), chat/compartir ("social"), zonas automáticas ("__auto") */
  function rebuildGuest(){guest={};Object.keys(guestG).forEach(g=>{const L=guestG[g]||{};Object.keys(L).forEach(k=>{guest[g==="__auto"?k:g+":"+k]=L[k]})});paintGuest()}
  function paintGuest(){bulk=true;guestIds.forEach(id=>{try{chart.removeOverlay(id)}catch(e){}OVSYM.delete(id)});bulk=false;guestIds=[];if(!ready)return;
    Object.keys(guest).forEach(k=>(guest[k]||[]).forEach(d=>{if(!d||!d.name||!Array.isArray(d.points)||!d.points.length||!d.points.every(p=>p&&p.timestamp))return;
      let pts=d.points;if(BOX.test(d.name)&&pts.length===2)pts=boxPts(pts[0],pts[1]).map(p=>({timestamp:p.timestamp,value:p.value}));
      try{const id=chart.createOverlay({name:d.name,points:pts,styles:withPt(d),extendData:d.extendData,lock:true,visible:!hidden&&tfOk(d),onRightClick:()=>true,onDoubleClick:()=>true,onPressedMoveStart:()=>true});
        if(id){guestIds.push(id);OVSYM.set(id,sym&&sym.ticker)}}catch(e){}}))}
  function setGuest(layers,grp){guestG[grp||"clase"]=layers||{};rebuildGuest()}
  /* ---------- zonas automáticas de soporte y resistencia ----------
     Busca giros (máximos y mínimos locales), junta los que están a casi el mismo precio y marca como zona
     los niveles donde el precio rebotó 2 o más veces. Las más fuertes: hasta 3 arriba (resistencias) y 3 abajo (soportes). */
  function autoZones(L){L=L.slice(-600);const n=L.length,k=5;if(n<40)return[];
    const rg=L.map(c=>c.high-c.low).filter(v=>v>0).sort((a,b)=>a-b),last=L[n-1].close;
    const tol=Math.max((rg[Math.floor(rg.length/2)]||0)*1.2,Math.abs(last)*0.0002);
    const piv=[];for(let i=k;i<n-k;i++){let hi=true,lo=true;for(let j=i-k;j<=i+k;j++){if(L[j].high>L[i].high)hi=false;if(L[j].low<L[i].low)lo=false}
      if(hi)piv.push({v:L[i].high,i});if(lo)piv.push({v:L[i].low,i})}
    piv.sort((a,b)=>a.v-b.v);const cl=[];piv.forEach(p=>{const c=cl[cl.length-1];if(c&&p.v-c.sum/c.n<=tol){c.sum+=p.v;c.n++;c.ps.push(p)}else cl.push({sum:p.v,n:1,ps:[p]})});
    const Z=cl.filter(c=>c.n>=2).map(c=>{const vs=c.ps.map(p=>p.v),mid=c.sum/c.n,th=Math.max(Math.max(...vs)-Math.min(...vs),tol*0.6);
      const ix=c.ps.map(p=>p.i).sort((a,b)=>a-b),lastI=ix[ix.length-1],first=ix[Math.max(0,ix.length-2)]; /* empieza en el penúltimo toque: la etiqueta queda a la vista */return{top:mid+th/2,bot:mid-th/2,mid,n:c.n,first,score:c.n+lastI/n*1.5}});
    const pick=arr=>arr.sort((a,b)=>b.score-a.score).slice(0,3);
    const R2=pick(Z.filter(z=>z.bot>last)),S=pick(Z.filter(z=>z.top<last));
    const mk=(z,res)=>({name:"eagZone",points:[{timestamp:L[z.first].timestamp,value:z.top},{timestamp:L[n-1].timestamp,value:z.bot}],
      extendData:{color:res?"#f23645":"#089981",fill:res?"rgba(242,54,69,.09)":"rgba(8,153,129,.09)",text:`${res?"Resistencia":"Soporte"} · ${z.n} toques`,size:1}});
    return R2.map(z=>mk(z,true)).concat(S.map(z=>mk(z,false)))}
  let azKey="";
  function refreshAuto(){const on=!!(o.autoZones&&o.autoZones())&&!isTk()&&XF!=="renko";let arr=[];
    if(on&&ready){try{arr=autoZones(XF==="ha"?RAW:chart.getDataList())}catch(e){arr=[]}}
    const k=on?JSON.stringify(arr.map(z=>[z.points[0].value.toFixed(4),z.points[1].value.toFixed(4),z.extendData.text])):"";if(k===azKey)return;azKey=k;
    if(on)guestG.__auto={auto:arr};else delete guestG.__auto;rebuildGuest()}
  setInterval(()=>{if(root.isConnected)refreshAuto()},15000);
  /* copiar dibujos de otro (el profe) a los míos: se pueden deshacer */
  function importDrawings(arr){if(!sym||!Array.isArray(arr)||!arr.length)return 0;const all=loadD(),mine=all[sym.ticker]||[];
    const add=arr.filter(d=>d&&d.name&&Array.isArray(d.points)&&d.points.every(p=>p&&p.timestamp)).map(d=>Object.assign(JSON.parse(JSON.stringify(d)),{lock:false}));if(!add.length)return 0;
    const ns=JSON.stringify(mine.concat(add));hist.push(snap);fut=[];applySnap(ns);return add.length}
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
  function capture(ov){const v=ovs.get(ov.id);if(!v)return;if(!v.done&&!v.ctf)v.ctf=curTf();if(!v.done&&!v.tfv&&o.drawTfOnly&&o.drawTfOnly())v.tfv=[curTf()];v.points=(ov.points||[]).map(p=>({timestamp:tsOf(p),value:p.value}));v.done=true;v.lock=!!ov.lock;persist()}
  /* guardado por mercado (todas las temporalidades), como en TradingView */
  /* deshacer / rehacer: historial de los dibujos de este mercado */
  let hist=[],fut=[],snap="[]",bulk=false;
  function persist(){if(!sym)return;const all=loadD();const arr=[];ovs.forEach(v=>{if(v.done&&v.points&&v.points.length){const d={name:v.name,points:v.points,styles:v.styles,extendData:v.extendData,lock:v.lock};if(v.tfv&&v.tfv.length)d.tfv=v.tfv;if(v.ctf)d.ctf=v.ctf;if(v.hid)d.hid=true;arr.push(d)}});
    const ns=JSON.stringify(arr);if(ns!==snap){hist.push(snap);if(hist.length>60)hist.shift();fut=[];snap=ns}
    if(arr.length)all[sym.ticker]=arr;else delete all[sym.ticker];saveD(all);o.onDrawingsChange&&o.onDrawingsChange(sym.ticker)}
  function applySnap(ns){const all=loadD(),arr=JSON.parse(ns);if(arr.length)all[sym.ticker]=arr;else delete all[sym.ticker];saveD(all);snap=ns;restoreDrawings(true);o.onDrawingsChange&&o.onDrawingsChange(sym.ticker)}
  function undo(){if(!hist.length)return false;fut.push(snap);applySnap(hist.pop());return true}
  function redo(){if(!fut.length)return false;hist.push(snap);applySnap(fut.pop());return true}
  function restoreDrawings(keepHist){selId=null;setTimeout(syncPan,0);bulk=true;try{chart.removeOverlay()}catch(e){}bulk=false;ovs.clear();hideStyleBar();
    if(!keepHist){hist=[];fut=[];snap=JSON.stringify(loadD()[sym.ticker]||[])}
    setTimeout(renderAlerts,0);
    (loadD()[sym.ticker]||[]).forEach(d=>{if(d.points&&d.points.every(p=>p.timestamp))makeOverlay(d,false)});guestIds=[];paintGuest()}
  o.reloadDrawings=()=>{if(ready)restoreDrawings()};
  /* alertas de este mercado dibujadas como líneas naranjas punteadas */
  let alertIds=[];
  /* precio actual en la regla, por debajo de todo lo marcado (ver eagLastPx) */
  let lpId=null;
  const MCX=document.createElement("canvas").getContext("2d");
  const mw=(t,sz)=>{MCX.font=`normal ${sz}px Helvetica Neue`;return MCX.measureText(String(t)).width};
  /* ancho común de la etiqueta del precio y del reloj de cierre (cuando va en la regla), para que se vean como una sola pieza */
  let lpBox=null;
  function cdTxt(){const L=chart.getDataList(),last=L[L.length-1];if(!last)return"";const left=Math.max(0,last.timestamp+msOf(per)-Date.now()),s2=Math.floor(left/1000),h=Math.floor(s2/3600),m=Math.floor(s2%3600/60);
    return h?`${h}:${String(m).padStart(2,"0")}:${String(s2%60).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s2%60).padStart(2,"0")}`}
  function lpGet(){const L=chart.getDataList(),d=L[L.length-1];if(!d)return null;let st;try{st=chart.getStyles().candle.priceMark}catch(e){return null}
    const lm=st&&st.last;if(!st||!st.show||!lm||!lm.show)return null;
    const bg=d.close>d.open?lm.upColor:d.close<d.open?lm.downColor:lm.noChangeColor,pp=dec();let t;
    if(axisType==="percentage"){let f0=null;try{const r=chart.getVisibleRange();f0=(L[Math.max(0,r.from)]||L[0]).close}catch(e){f0=L[0].close}t=f0?((d.close-f0)/f0*100).toFixed(2)+"%":""}
    else t=(+d.close).toLocaleString("en-US",{minimumFractionDigits:pp,maximumFractionDigits:pp});
    const f=fz(),pl=Math.round(f*.4),pt=Math.round(f*.3);let w=null,padL=pl,padR=pl;
    if(cdMode()==="regla"){const c=cdTxt(),tpl=c.length>5?"8:88:88":"88:88",tw=mw(t,f),cw=Math.max(mw(tpl,f),mw(c,f));w=Math.ceil(Math.max(tw,cw)+pl*2);padL=(w-tw)/2;padR=padL;lpBox={w,h:f+pt*2,f}}else lpBox=null;
    return{v:d.close,t,w,draw:(y,z)=>{if(lpBox){lpBox.y=y;lpBox.z=z}},st:Object.assign({},lm.text,{show:true,size:f,color:"#fff",backgroundColor:bg,borderColor:bg,paddingLeft:padL,paddingRight:padR,paddingTop:pt,paddingBottom:pt,borderRadius:lpBox?0:2})}}
  function ensureLp(){if(!ready)return;if(lpId&&chart.getOverlayById(lpId))return;const L=chart.getDataList(),d=L[L.length-1];if(!d)return;
    try{lpId=chart.createOverlay({name:"eagLastPx",lock:true,zLevel:-1e6,points:[{timestamp:d.timestamp,value:d.close}],extendData:{get:lpGet}})}catch(e){lpId=null}}
  function renderAlerts(){alertIds.forEach(id=>{try{chart.removeOverlay(id)}catch(e){}});alertIds=[];ensureLp();if(!ready||!o.getAlerts)return;
    const L=chart.getDataList(),last=L[L.length-1];if(!last)return;const pp=sym.pricePrecision||3;
    (o.getAlerts(sym.ticker)||[]).forEach(a=>{const vals=a.kind==="zona"&&a.price2!=null?[+a.price,+a.price2]:[+a.price];
      vals.forEach((v,k)=>{const id=chart.createOverlay({name:"eagAlert",lock:true,onRightClick:()=>true,points:[{timestamp:last.timestamp,value:v}],extendData:{label:(a.kind==="zona"?(k?"Zona (abajo) ":"Zona (arriba) "):"Alerta ")+v.toFixed(pp)+(a.note?" · "+a.note:"")}});if(id)alertIds.push(id)})})}

  /* ---------- personalizar un dibujo: barra flotante + clic derecho ---------- */
  const sbar=document.createElement("div");sbar.className="wstyle";sbar.hidden=true;chartEl.appendChild(sbar);
  const isFill=n=>/^(rect|circle|triangle|parallelogram|eagZone|eagRect|fibonacciCircle|gannBox)$/.test(n);
  const curStyle=id=>{const v=ovs.get(id)||{},s=v.styles||{},isTxt=v.name==="eagText"||BOX.test(v.name)||v.name==="eagBrush"||MARKX.test(v.name);
    return{color:isTxt?((v.extendData||{}).color||GOLD):((s.line&&s.line.color)||(s.polygon&&s.polygon.borderColor)||GOLD),size:(v.name==="eagBrush"||BOX.test(v.name))?((v.extendData||{}).size||(v.name==="eagBrush"||/Buy|Sell/.test(v.name)?2:1)):((s.line&&s.line.size)||(s.polygon&&s.polygon.borderSize)||1),
      dash:(s.line&&s.line.style)==="dashed"?((s.line.dashedValue||[4,4])[0]<=2?"dot":"dash"):"solid",fill:s.polygon?s.polygon.color:null}};
  function setStyle(id,ch){const v=ovs.get(id);if(!v)return;const c=Object.assign(curStyle(id),ch);
    if(v.name==="eagText"||MARKX.test(v.name)||BOX.test(v.name)||v.name==="eagBrush"||/^eag(Position|Long|Short)$/.test(v.name)){v.extendData=Object.assign({},v.extendData||{},/^eag(Position|Long|Short)$/.test(v.name)?{}:{color:c.color});if(ch.size&&v.name==="eagText")v.extendData.size=10+ch.size*2;if(ch.size&&(v.name==="eagBrush"||BOX.test(v.name)))v.extendData.size=ch.size;if(ch.fill!==undefined&&BOX.test(v.name))v.extendData.fill=ch.fill;chart.overrideOverlay({id,extendData:v.extendData})}
    else{const st={line:{color:c.color,size:c.size,style:c.dash==="solid"?"solid":"dashed",dashedValue:c.dash==="dot"?[1,3]:[5,4]},
        polygon:{borderColor:c.color,borderSize:c.size,borderStyle:c.dash==="solid"?"solid":"dashed",color:c.fill!=null?c.fill:hexA(c.color,.14)},
        rect:{borderColor:c.color,borderSize:c.size,color:c.fill!=null?c.fill:hexA(c.color,.14)},circle:{borderColor:c.color,borderSize:c.size,color:c.fill!=null?c.fill:hexA(c.color,.14)},
        arc:{color:c.color,size:c.size},text:{color:c.color},rectText:{backgroundColor:c.color,borderColor:c.color}};
      v.styles=st;chart.overrideOverlay({id,styles:st})}
    refreshPt(id);persist();if(!sbar.hidden)showStyleBar(id);
    /* recordar el estilo para los próximos dibujos de esta herramienta */
    if(o.onToolStyle){const ex={};const e2=v.extendData||{};["color","size","up","dn"].forEach(k=>{if(e2[k]!=null)ex[k]=e2[k]});const pv=(o.getToolStyle&&o.getToolStyle(v.name))||{};if(pv.ex&&pv.ex.fib)ex.fib=pv.ex.fib;o.onToolStyle(v.name,{styles:v.styles||null,ex})}}
  const alertable=v=>/^(horizontalStraightLine|horizontalRayLine|horizontalSegment|priceLine|eagZone|eagRect|eagBuyZone|eagSellZone|rect|segment|rayLine|straightLine)$/.test(v.name)&&v.points&&v.points.length;
  function alertFrom(id){if(o.alertsAllowed&&!o.alertsAllowed()){o.onLocked&&o.onLocked("alert","Alertas de precio");return}const v=ovs.get(id);if(!v||!o.onCreateAlert)return;const ps=v.points.map(p=>p.value),pp=sym.pricePrecision||3,r=x=>+(+x).toFixed(pp);
    const zone=/^(eagZone|eagRect|eagBuyZone|eagSellZone|rect)$/.test(v.name)&&ps.length>1;
    /* para líneas inclinadas se usa el precio del punto más reciente */
    const price=zone?Math.max(...ps):(/^(segment|rayLine|straightLine)$/.test(v.name)?ps[ps.length-1]:ps[0]);
    o.onCreateAlert({symbol:sym.ticker,symbol_name:sym.name||sym.ticker,kind:zone?"zona":"nivel",price:r(price),price2:zone?r(Math.min(...ps)):null})}
  function removeOv(id){try{chart.removeOverlay(id)}catch(e){}ovs.delete(id);if(selId===id)selId=null;persist();hideStyleBar();closeMenu();syncPan()}
  function dupOv(id){const v=ovs.get(id);if(!v||!v.points)return;const L=chart.getDataList(),last=L[L.length-1],first=L[0],shift=(last&&first&&L.length>2)?(L[1].timestamp-L[0].timestamp)*5:0;
    const d=JSON.parse(JSON.stringify(v));d.points=d.points.map(p=>({timestamp:p.timestamp+shift,value:p.value}));const nid=makeOverlay(d,false);if(nid){ovs.get(nid).done=true;persist()}}
  function toggleLock(id){const v=ovs.get(id);if(!v)return;v.lock=!v.lock;chart.overrideOverlay({id,lock:v.lock});persist();if(!sbar.hidden)showStyleBar(id)}
  /* barra de estilo al seleccionar un dibujo — sencilla como TradingView: solo íconos, se arrastra y recuerda dónde la dejaste */
  const SBPOS="eag_sbar_pos";const sbPos=()=>{try{return JSON.parse(localStorage.getItem(SBPOS)||"null")}catch(e){return null}};
  function placeSbar(){const P=sbPos(),W=chartEl.clientWidth,H=chartEl.clientHeight,w=sbar.offsetWidth||300,h=sbar.offsetHeight||36;
    let x=P?P.fx*W:8,y=P?P.fy*H:8;x=Math.max(4,Math.min(W-w-4,x));y=Math.max(4,Math.min(H-h-4,y));sbar.style.left=x+"px";sbar.style.top=y+"px";sbar.style.transform="none"}
  const DASHI={solid:'<svg width="22" height="16" viewBox="0 0 22 16"><path d="M2 8h18" stroke="currentColor" stroke-width="2"/></svg>',dash:'<svg width="22" height="16" viewBox="0 0 22 16"><path d="M2 8h18" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"/></svg>',dot:'<svg width="22" height="16" viewBox="0 0 22 16"><path d="M2 8h18" stroke="currentColor" stroke-width="2" stroke-dasharray="1.5 3" stroke-linecap="round"/></svg>'};
  function showStyleBar(id){const v=ovs.get(id);if(!v)return;const c=curStyle(id),pos=/^eag(Position|Long|Short)$/.test(v.name);
    const txtB=v.name==="eagText"||v.name==="eagNote"?`<button data-a="txt" title="Editar texto">Aa</button>`:v.name==="eagEmoji"?`<button data-a="ptx" title="Cambiar emoji">🙂</button>`:!LBLX.test(v.name)?`<button data-a="ptx" title="Agregar texto a este dibujo">Aa</button>`:"";
    sbar.innerHTML=`<span class="sg" title="${esc(TNAME[v.name]||v.name)} · arrastra para mover esta barra">⋮⋮</span>
      <label class="cc" title="Color"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg><i style="background:${c.color}"></i><input type="color" value="${/^#/.test(c.color)?c.color.slice(0,7):GOLD}"></label>
      ${pos?"":`<button data-a="w" class="sw" title="Grosor (toca para cambiar)">${+c.size||1}px</button><button data-a="d" title="Tipo de línea (toca para cambiar)">${DASHI[c.dash]||DASHI.solid}</button>`}
      ${txtB}<button data-a="cfg" title="Configurar este dibujo">${svg("gear",16)}</button><button data-a="lock" class="${v.lock?"on":""}" title="${v.lock?"Desbloquear":"Bloquear"}">${svg(v.lock?"lock":"unlock",16)}</button><button data-a="del" title="Eliminar (Supr)">${svg("trash",16)}</button>
      <button data-a="more" title="Más: temporalidades, alerta, duplicar">⋯</button>
      <div class="smore" hidden><button data-a="pvs" class="${v.tfv&&v.tfv.length?"on":""}">${svg("eye",16)}<span>En qué temporalidades se ve</span></button>${alertable(v)?`<button data-a="alert">🔔<span>Crear alerta en este nivel</span></button>`:""}<button data-a="dup">${svg("copy",16)}<span>Duplicar</span></button></div>`;
    sbar.hidden=false;placeSbar();
    sbar.querySelector("input[type=color]").oninput=e=>{sbar.querySelector(".cc i").style.background=e.target.value};
    sbar.querySelector("input[type=color]").onchange=e=>setStyle(id,{color:e.target.value,fill:null});
    const wb=sbar.querySelector('[data-a="w"]');wb&&(wb.onclick=()=>{const n=(+curStyle(id).size||1)%4+1;setStyle(id,{size:n})});
    const db=sbar.querySelector('[data-a="d"]');db&&(db.onclick=()=>{const L=["solid","dash","dot"],cur=curStyle(id).dash||"solid";setStyle(id,{dash:L[(L.indexOf(cur)+1)%3]})});
    const tb=sbar.querySelector('[data-a="txt"]');tb&&(tb.onclick=()=>editText(id));
    const openP=t=>{const r=chartEl.getBoundingClientRect(),b=sbar.getBoundingClientRect();openCtx(id,{x:b.left-r.left,y:b.bottom-r.top+8},true,t)};
    const px2=sbar.querySelector('[data-a="ptx"]');px2&&(px2.onclick=()=>openP("texto"));const pv2=sbar.querySelector('[data-a="pvs"]');pv2&&(pv2.onclick=()=>openP("vis"));
    const mo=sbar.querySelector('[data-a="more"]'),sm=sbar.querySelector(".smore");mo.onclick=e=>{e.stopPropagation();sm.hidden=!sm.hidden;mo.classList.toggle("on",!sm.hidden)};
    sbar.querySelector('[data-a="lock"]').onclick=()=>toggleLock(id);const ab=sbar.querySelector('[data-a="alert"]');ab&&(ab.onclick=()=>alertFrom(id));sbar.querySelector('[data-a="dup"]').onclick=()=>dupOv(id);sbar.querySelector('[data-a="del"]').onclick=()=>removeOv(id);const cfb=sbar.querySelector('[data-a="cfg"]');if(cfb)cfb.onclick=()=>{const r=chartEl.getBoundingClientRect(),b=cfb.getBoundingClientRect();openCtx(id,{x:b.left-r.left-120,y:b.bottom-r.top+8},true,"estilo")};
    /* arrastrar la barra */
    const g=sbar.querySelector(".sg");g.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const r=chartEl.getBoundingClientRect(),b=sbar.getBoundingClientRect(),dx=e.clientX-b.left,dy=e.clientY-b.top;try{g.setPointerCapture(e.pointerId)}catch(x){}
      const mv=ev=>{const W=chartEl.clientWidth,H=chartEl.clientHeight;try{localStorage.setItem(SBPOS,JSON.stringify({fx:(ev.clientX-dx-r.left)/W,fy:(ev.clientY-dy-r.top)/H}))}catch(x){}placeSbar()};
      const up=()=>{g.removeEventListener("pointermove",mv);g.removeEventListener("pointerup",up)};g.addEventListener("pointermove",mv);g.addEventListener("pointerup",up)}}
  function hideStyleBar(){sbar.hidden=true}
  /* menú de clic derecho sobre un dibujo */
  let panelPos=null;
  let panelTab="estilo";
  const LBLX=/^(eagText|eagNote|eagMeasure|eagLong|eagShort|eagPosition|eagBrush|eagEmoji|priceLabel)$/;
  const lblOf=v=>{const ex=v.extendData||{};const lb=Object.assign({t:"",c:null,s:13,b:false,i:false,h:BOX.test(v.name)?"left":"center",v:"top"},ex.lbl||{});if(!lb.hx&&!BOX.test(v.name))lb.h="center";if(!ex.lbl&&ex.text&&BOX.test(v.name)){lb.t=ex.text;lb.v="middle"}return lb};
  function setLbl(id,ch,quiet){const v=ovs.get(id);if(!v)return;const lb=Object.assign(lblOf(v),ch);const ex=Object.assign({},v.extendData||{},{lbl:lb});if(BOX.test(v.name)&&ex.text)delete ex.text;
    v.extendData=ex;try{chart.overrideOverlay({id,extendData:ex})}catch(e){}if(!quiet)persist()}
  function setTfv(id,list){const v=ovs.get(id);if(!v)return;v.tfv=list&&list.length&&list.length<STDTF.length?list.slice():null;const ok=tfOk(v);try{chart.overrideOverlay({id,visible:!hidden&&ok})}catch(e){}persist();return ok}
  const ICA={left:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',center:'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',right:'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    top:'<path d="M4 4h16"/><path d="M12 8v12M8 12l4-4 4 4"/>',middle:'<path d="M4 12h16"/><path d="M12 3v5M12 16v5"/>',bottom:'<path d="M4 20h16"/><path d="M12 4v12M8 12l4 4 4-4"/>'};
  const ico=(k,n)=>`<svg width="${n||16}" height="${n||16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICA[k]}</svg>`;
  const FIBK=/^(fibonacciLine|fibonacciExtension|fibonacciSpeedResistanceFan|fibonacciCircle|fibTimeZone)$/;
  const fibCfg=v=>{const d=(window.__eagFibDef||{})[v.name]||{levels:[]},f=((v.extendData||{}).fib)||{};const c=JSON.parse(JSON.stringify(Object.assign({},d,f)));if(!f.levels||!f.levels.length)c.levels=JSON.parse(JSON.stringify(d.levels));return c};
  let fibT=null;
  function setFib(id,cf,quiet){const v=ovs.get(id);if(!v)return;v.extendData=Object.assign({},v.extendData||{},{fib:cf});try{chart.overrideOverlay({id,extendData:v.extendData})}catch(e){}
    clearTimeout(fibT);if(quiet)fibT=setTimeout(persist,500);else persist()}
  /* ---------- panel completo de la herramienta Texto ---------- */
  const TXPRE=[["Neón dorado",{color:"#fff3c4",fx:"neon",fxc:"#e2b55c",core:"#fff3c4",bg:null,size:28,b:true,fam:"inter"}],["Neón azul",{color:"#d6f6ff",fx:"neon",fxc:"#00bcd4",core:"#d6f6ff",bg:null,size:28,b:true,fam:"inter"}],
    ["Etiqueta",{color:"#16120a",fx:"none",bg:"#e2b55c",bga:1,r:6,size:14,b:true,fam:"inter"}],["Titular",{color:"#ffffff",fx:"outline",fxc:"#000000",bg:null,size:40,b:true,fam:"impact"}],
    ["Alerta",{color:"#ffffff",fx:"none",bg:"#f23645",bga:1,r:20,size:16,b:true,fam:"inter"}],["Compra",{color:"#ffffff",fx:"none",bg:"#089981",bga:1,r:20,size:16,b:true,fam:"inter"}],
    ["A mano",{color:"#f3d08a",fx:"shadow",fxc:"#000000",bg:null,size:24,b:false,fam:"hand"}],["Simple",{color:"#e2b55c",fx:"halo",bg:null,size:14,b:true,fam:"inter",i:false,u:false,s:false,rot:0,op:1}]];
  const FAMN=[["inter","Normal"],["serif","Clásica"],["mono","Código"],["impact","Impacto"],["hand","A mano"]];
  function txtPanel(ex,kind){const note=kind==="note",cK=note?"tc":"color",cDef=note?"#ffffff":GOLD,sz=+ex.size||(note?12:14),bg0=note&&ex.bg===undefined?(ex.color||GOLD):ex.bg,fx=ex.fx||(bg0&&bg0!=="transparent"?"none":"halo"),bg=bg0&&bg0!=="transparent"?bg0:"",fam=ex.fam||"inter",sw=(k,on,att)=>`<button class="sw${on?" on":""}" ${att}="${k}" style="background:${k}" title="${k}"></button>`,pick=(att,val)=>`<label class="sw pick" title="Otro color">+<input type="color" ${att} value="${/^#/.test(val||"")?String(val).slice(0,7):GOLD}"></label>`;
    return`<textarea class="ptxt ptxa" data-ot maxlength="200" rows="2" placeholder="Escribe aquí (Enter = nueva línea)">${esc(ex.text||"")}</textarea>
      <div class="ml">Estilos rápidos</div><div class="txpre">${TXPRE.map(([t,st],i)=>`<button data-xp="${i}" style="font-family:${(TXTFAMS[st.fam]||TXTFAM).replace(/"/g,"'")};${st.bg?`background:${st.bg};color:${st.color}`:`color:${st.color}`};${st.fx==="neon"?`text-shadow:0 0 6px ${st.fxc},0 0 12px ${st.fxc}`:st.fx==="outline"?"text-shadow:0 1px 0 #000,0 -1px 0 #000,1px 0 0 #000,-1px 0 0 #000;letter-spacing:.5px":""}">${t}</button>`).join("")}</div>
      <div class="ml">Tamaño <b class="txv">${sz}</b></div><div class="mrow txsz"><button class="tbn" data-xs="-">−</button><input type="range" min="8" max="120" step="1" value="${sz}" data-xsz><button class="tbn" data-xs="+">+</button></div>
      <div class="mrow">${[12,16,24,36,56,80].map(n=>`<button class="tbn${sz===n?" on":""}" data-xsn="${n}">${n}</button>`).join("")}</div>
      <div class="ml">Color${note?" del texto":""}</div><div class="mrow">${COLORS.map(k=>sw(k,(ex[cK]||cDef)===k,"data-xc")).join("")}${pick("data-xcp",ex[cK]||cDef)}</div>${note?`<div class="ml">Color de la flecha</div><div class="mrow">${COLORS.map(k=>sw(k,(ex.color||GOLD)===k,"data-xac")).join("")}${pick("data-xacp",ex.color)}</div>`:""}
      <div class="ml">Letra</div><div class="mrow">${FAMN.map(([k,t])=>`<button class="tbn${fam===k?" on":""}" data-xf="${k}" style="font-family:${TXTFAMS[k].replace(/"/g,"'")}">${t}</button>`).join("")}</div>
      <div class="mrow"><button class="tbn${ex.b!==false?" on":""}" data-xt="b" title="Negrita"><b>B</b></button><button class="tbn${ex.i?" on":""}" data-xt="i" title="Cursiva"><i>I</i></button><button class="tbn${ex.u?" on":""}" data-xt="u" title="Subrayado"><u>U</u></button><button class="tbn${ex.s?" on":""}" data-xt="s" title="Tachado"><s>S</s></button><i class="tsp"></i>${["left","center","right"].map(k=>`<button class="tbn${(ex.al||"left")===k?" on":""}" data-xa="${k}" title="${{left:"Izquierda",center:"Centro",right:"Derecha"}[k]}">${ico(k)}</button>`).join("")}</div>
      <div class="ml">Efecto</div><div class="mrow">${[["none","Ninguno"],["halo","Suave"],["outline","Contorno"],["neon","Neón"],["shadow","Sombra"]].map(([k,t])=>`<button class="tbn${fx===k?" on":""}" data-xx="${k}">${t}</button>`).join("")}</div>
      ${fx==="outline"||fx==="neon"||fx==="shadow"?`<div class="ml">Color del ${fx==="neon"?"brillo":fx==="outline"?"contorno":"sombra"}</div><div class="mrow">${COLORS.map(k=>sw(k,(ex.fxc||(fx==="neon"?ex[cK]||cDef:"#000000"))===k,"data-xfc")).join("")}${pick("data-xfcp",ex.fxc)}</div>`:""}
      <div class="ml">${note?"Caja":"Fondo"}</div><div class="mrow"><button class="sw none${bg?"":" on"}" data-xb="" title="Sin ${note?"caja":"fondo"}">⌀</button>${COLORS.map(k=>sw(k,bg===k,"data-xb")).join("")}${pick("data-xbp",bg)}</div>
      ${bg?`<div class="ml">Fondo: transparencia y bordes</div><div class="mrow txsz"><input type="range" min="10" max="100" step="5" value="${Math.round((ex.bga!=null?+ex.bga:.9)*100)}" data-xba title="Opacidad del fondo"></div>
        <div class="mrow">${[[0,"Recto"],[4,"Suave"],[10,"Redondo"],[40,"Píldora"]].map(([r,t])=>`<button class="tbn${(ex.r!=null?+ex.r:4)===r?" on":""}" data-xr="${r}">${t}</button>`).join("")}<button class="tbn${ex.bd?" on":""}" data-xbd title="Borde del color del texto">Borde</button></div>`:""}
      ${note?"":`<div class="ml">Girar <b class="txv">${+ex.rot||0}°</b></div><div class="mrow txsz"><input type="range" min="-90" max="90" step="5" value="${+ex.rot||0}" data-xrot><button class="tbn" data-xrot0>0°</button></div>`}
      <div class="ml">Opacidad <b class="txv">${Math.round((ex.op!=null?+ex.op:1)*100)}%</b></div><div class="mrow txsz"><input type="range" min="10" max="100" step="5" value="${Math.round((ex.op!=null?+ex.op:1)*100)}" data-xop></div>
      <div class="mrow"><button class="tbn wide" data-xdef>⭐ Usar este estilo en ${note?"mis próximas notas":"mis próximos textos"}</button></div>`}
  function openCtx(id,e,panel,tab){panel=true;const prev=menu&&menu.classList.contains("panel")?{x:menu.offsetLeft,y:menu.offsetTop}:null;closeMenu();const v=ovs.get(id);if(!v)return;selId=id;showStyleBar(id);const c=curStyle(id);
    if(tab)panelTab=tab;const again=t=>openCtx(id,e,panel,t);
    menu=document.createElement("div");menu.className="wmenu ctx"+(panel?" panel":"");
    const isOldTxt=v.name==="eagText"||v.name==="eagNote";const canLbl=!LBLX.test(v.name);const tf=curTf();
    const styleHTML=`<div class="mrow">${COLORS.map(k=>`<button class="sw${c.color===k?" on":""}" data-c="${k}" style="background:${k}" title="${k}"></button>`).join("")}<label class="sw pick" title="Otro color">+<input type="color" value="${/^#/.test(c.color)?c.color.slice(0,7):GOLD}"></label></div>
      ${/^(eagNote|arrowMarkUp|arrowMarkDown|flagMark|priceLabel)$/.test(v.name)&&v.name!=="eagNote"?`<div class="ml">Tamaño</div><div class="mrow">${[[.75,"S"],[1,"M"],[1.5,"L"],[2,"XL"],[3,"XXL"]].map(([k,t])=>`<button class="tbn${(+(v.extendData||{}).sc||1)===k?" on":""}" data-msc="${k}">${t}</button>`).join("")}</div>`:""}${/^eag(Position|Long|Short)$/.test(v.name)||v.name==="eagText"||MARKX.test(v.name)?"":`<div class="ml">Grosor</div><div class="mrow">${[1,2,3,4].map(n=>`<button class="wd${+c.size===n?" on":""}" data-w="${n}" title="${n}px"><i style="height:${n}px"></i></button>`).join("")}</div>
      <div class="ml">Línea</div><div class="mrow">${[["solid","Sólida"],["dash","Guiones"],["dot","Puntos"]].map(([k,t])=>`<button class="ls${c.dash===k?" on":""}" data-d="${k}" title="${t}"><i class="${k}"></i></button>`).join("")}</div>`}
      ${isFill(v.name)?`<div class="ml">Relleno</div><div class="mrow">${[0,.08,.16,.3,.5].map(a=>`<button class="fa" data-f="${a}" title="${Math.round(a*100)}%"><i style="background:${hexA(c.color,a||.0001)};${a?"":"border:1px dashed var(--dim)"}"></i></button>`).join("")}</div>`:""}`;
    const lb=lblOf(v);
    const EMO=["🚀","🔥","💰","💎","✅","❌","⚠️","🎯","📈","📉","👀","⭐","🟢","🔴","⏰","🐂","🐻","💥"];
    const textHTML=v.name==="eagEmoji"?`<div class="ml">Elige un emoji</div><div class="mrow emo">${EMO.map(k=>`<button class="tbn emj${(v.extendData||{}).text===k?" on":""}" data-emo="${k}">${k}</button>`).join("")}</div>
      <div class="ml">O escribe el tuyo</div><div class="mrow"><input class="ptxt" data-ot maxlength="8" value="${esc((v.extendData||{}).text||"")}"></div>
      <div class="ml">Tamaño</div><div class="mrow">${[20,28,36,48,64,96,128].map(n=>`<button class="tbn${+((v.extendData||{}).size||28)===n?" on":""}" data-esz="${n}">${n}</button>`).join("")}</div>`
      :v.name==="eagText"?txtPanel(v.extendData||{}):v.name==="eagNote"?txtPanel(v.extendData||{},"note")
      :isOldTxt?`<div class="ml">Texto</div><div class="mrow"><input class="ptxt" data-ot maxlength="80" value="${esc((v.extendData||{}).text||"")}" placeholder="Escribe aquí"></div>`
      :canLbl?`<div class="mrow"><input class="ptxt" data-lt maxlength="120" value="${esc(lb.t)}" placeholder="Escribe un texto para este dibujo"></div>
      <div class="ml">Color del texto</div><div class="mrow"><button class="sw${!lb.c?" on":""} auto" data-lc="" title="Igual que el dibujo">A</button>${COLORS.slice(0,10).map(k=>`<button class="sw${lb.c===k?" on":""}" data-lc="${k}" style="background:${k}"></button>`).join("")}</div>
      <div class="ml">Tamaño y estilo</div><div class="mrow"><select class="psel" data-ls>${[10,11,12,13,14,16,18,20,24,28].map(n=>`<option value="${n}"${+lb.s===n?" selected":""}>${n}</option>`).join("")}</select>
        <button class="tbn${lb.b?" on":""}" data-lb title="Negrita"><b>B</b></button><button class="tbn${lb.i?" on":""}" data-li title="Cursiva"><i>I</i></button></div>
      <div class="ml">Posición</div><div class="mrow">${["left","center","right"].map(k=>`<button class="tbn${lb.h===k?" on":""}" data-lh="${k}" title="${{left:"Izquierda",center:"Centro",right:"Derecha"}[k]}">${ico(k)}</button>`).join("")}<i class="tsp"></i>${["top","middle","bottom"].map(k=>`<button class="tbn${lb.v===k?" on":""}" data-lv="${k}" title="${{top:"Arriba",middle:"En medio",bottom:"Abajo"}[k]}">${ico(k)}</button>`).join("")}</div>`
      :`<p class="mhint">Este dibujo ya muestra sus datos y no lleva texto.</p>`;
    const sel=new Set(v.tfv&&v.tfv.length?v.tfv:STDTF.map(x=>x[0]));const all=!v.tfv||!v.tfv.length;
    const idx=STDTF.findIndex(x=>x[0]===tf),KS=STDTF.map(x=>x[0]),qL={only:[tf],up:KS.slice(Math.max(0,idx)),down:KS.slice(0,idx+1)};
    const qIs=q=>!all&&qL[q].length<KS.length&&qL[q].join()===(v.tfv||[]).join();
    const mode=all?"all":qIs("only")?"only":qIs("up")?"up":qIs("down")?"down":"custom",chips=mode==="custom"||visCustom===id;
    const lst=k=>{const L=qL[k];return L.length>4?L[0]+" · "+L[1]+" … "+L[L.length-1]:L.join(" · ")};
    const DV=[...ovs.values()].filter(x=>x.done&&x.points&&x.points.length),nAll=DV.length,nHere=DV.filter(x=>tfOf(x)===tf).length,
      byTf=(()=>{const c={};DV.forEach(x=>{const k=tfOf(x)||"?";c[k]=(c[k]||0)+1});return STDTF.map(z=>z[0]).concat("?").filter(k=>c[k]).map(k=>`${c[k]} en ${k==="?"?"sin dato":k}`).join(" · ")||"Sin dibujos"})(),symN=esc((sym&&(sym.shortName||sym.name||sym.ticker))||"este mercado");
    const visHTML=`<div class="ml">¿Dónde se ve este dibujo?</div>
      <div class="vopts">${[["all","En todas las temporalidades",""],["only",`Solo en ${esc(tf)}`,""],["up",`En ${esc(tf)} y mayores`,idx<0?"":lst("up")],["down",`En ${esc(tf)} y menores`,idx<0?"":lst("down")],["custom","Elegir a mano",mode==="custom"?(v.tfv||[]).join(" · "):""]].filter(r=>idx>=0||r[0]==="all"||r[0]==="custom").map(([k,t,sm])=>`<button class="vopt${(k==="custom"?chips:mode===k&&!chips)?" on":""}" data-tq="${k}"><i></i><span><b>${t}</b>${sm?`<small>${esc(sm)}</small>`:""}</span></button>`).join("")}</div>
      ${chips?`<div class="mrow tfc">${STDTF.map(([t])=>`<button class="tfx${sel.has(t)?" on":""}${t===tf?" cur":""}" data-tf="${t}" title="${t===tf?"Temporalidad actual":""}">${t}</button>`).join("")}</div>`:""}
      <div class="vall"><div class="ml">Todos los dibujos de ${symN} (${nAll})</div>
        <button class="vbig" data-va="own" ${nAll?"":"disabled"}><b>Cada uno en la temporalidad donde lo hice</b><small>${esc(byTf)}</small></button>
        <div class="mrow"><button class="tbn wide" data-va="only" ${nHere?"":"disabled"}>Los de ${esc(tf)} (${nHere}) solo en ${esc(tf)}</button><button class="tbn wide" data-va="all" ${nAll?"":"disabled"}>Todos en todas</button></div>
        <label class="vchk"><input type="checkbox" data-vnew${o.drawTfOnly&&o.drawTfOnly()?" checked":""}><span>Lo que dibuje de ahora en adelante, que se vea solo en la temporalidad donde lo hago</span></label></div>`;
    const isFib=FIBK.test(v.name),fc=isFib?fibCfg(v):null;
    const nivHTML=isFib?`<div class="fibl">${fc.levels.map((l,i)=>`<div class="fibr${l.on===false?" off":""}"><label class="fck"><input type="checkbox" data-fon="${i}"${l.on===false?"":" checked"}></label><input class="fiv" data-fv="${i}" type="number" step="any" value="${l.v}"><label class="fcl" style="background:${l.c}"><input type="color" data-fc="${i}" value="${/^#/.test(l.c)?l.c.slice(0,7):"#e2b55c"}"></label><button class="fix" data-fx="${i}" title="Quitar nivel">×</button></div>`).join("")}</div>
      <div class="mrow"><button class="tbn wide" data-fa="add">+ Agregar nivel</button><button class="tbn wide" data-fa="one" title="Pone todos los niveles del color del dibujo">Un solo color</button></div>
      ${v.name==="fibTimeZone"||v.name==="fibonacciCircle"?"":`<div class="ml">Extender líneas</div><div class="mrow">${(v.name==="fibonacciSpeedResistanceFan"?[["none","No"],["right","Sí"]]:[["none","No"],["left","Izquierda"],["right","Derecha"],["both","Ambos"]]).map(([k,t])=>`<button class="tbn wide${fc.ext===k?" on":""}" data-fe="${k}">${t}</button>`).join("")}</div>`}
      ${v.name==="fibTimeZone"?"":`<div class="ml">Relleno entre niveles</div><div class="mrow">${[0,.05,.08,.15,.25].map(a=>`<button class="tbn${+fc.fill===a?" on":""}" data-ff="${a}">${a?Math.round(a*100)+"%":"No"}</button>`).join("")}</div>`}
      <div class="ml">Mostrar</div><div class="mrow fopts">
        <label><input type="checkbox" data-fo="lvl"${fc.lvl?" checked":""}> Niveles</label>
        ${/^fibonacci(Line|Extension)$/.test(v.name)?`<label><input type="checkbox" data-fo="prices"${fc.prices?" checked":""}> Precios</label><label><input type="checkbox" data-fo="side"${fc.side==="right"?" checked":""}> Etiquetas a la derecha</label>`:""}
        ${v.name==="fibTimeZone"?"":`<label><input type="checkbox" data-fo="trend"${fc.trend?" checked":""}> Línea de tendencia</label>`}
        ${v.name==="fibonacciLine"?`<label><input type="checkbox" data-fo="rev"${fc.rev?" checked":""}> Invertir</label>`:""}</div>
      <div class="msep"></div><div class="mrow"><button class="tbn wide" data-fa="reset">Restablecer</button><button class="tbn wide" data-fa="def" title="Los próximos dibujos de esta herramienta salen con estos niveles y colores">Usar como predeterminado</button></div>`:"";
    const actHTML=`<div class="msep"></div>
      ${alertable(v)?`<button class="mi" data-a="alert">🔔 Crear alerta aquí…</button>`:""}
      <button class="mi" data-a="lock">${v.lock?"Desbloquear":"Bloquear"}</button><button class="mi" data-a="dup">Duplicar</button>
      <button class="mi" data-a="hide">Ocultar este dibujo</button><button class="mi danger" data-a="del">Eliminar</button>`;
    if(panel){const T=panelTab==="texto"||panelTab==="vis"||(panelTab==="niv"&&isFib)?panelTab:(isFib&&tab===undefined&&panelTab==="estilo"&&false?"niv":"estilo");
      menu.innerHTML=`<div class="ph2"><span class="mti">${tsvg(v.name,16)}<b>${esc(TNAME[v.name]||v.name)}</b></span><button class="px" title="Cerrar">×</button></div>
        <div class="ptabs">${(isFib?[["estilo","Estilo"],["niv","Niveles"],["texto","Texto"],["vis","Visibilidad"]]:[["estilo","Estilo"],["texto","Texto"],["vis","Visibilidad"]]).map(([k,t])=>`<button data-pt="${k}" class="${T===k?"on":""}">${t}${k==="vis"&&!all?" •":""}${k==="texto"&&lb.t&&canLbl?" •":""}</button>`).join("")}</div>
        <div class="pbody">${T==="estilo"?styleHTML+actHTML:T==="niv"?nivHTML:T==="texto"?textHTML:visHTML}</div>`}
    else menu.innerHTML=`<div class="mt mti">${tsvg(v.name,15)}${esc(TNAME[v.name]||v.name)}</div>${styleHTML}<div class="msep"></div>
      ${isOldTxt?`<button class="mi" data-a="txt">Editar texto…</button>`:canLbl?`<button class="mi" data-a="ptexto">Aa  ${lb.t?"Editar texto…":"Agregar texto…"}</button>`:""}
      <button class="mi" data-a="pvis">👁  Visibilidad por temporalidad…${all?"":" <em class=\"mtag\">"+v.tfv.length+"</em>"}</button>${actHTML.replace('<div class="msep"></div>',"")}`;
    document.body.appendChild(menu);
    const r=chartEl.getBoundingClientRect();let x=r.left+((e&&e.x)||40)+(panel?16:0),y=r.top+((e&&e.y)||40);
    if(panel&&(prev||panelPos)){x=(prev||panelPos).x;y=(prev||panelPos).y}
    menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+"px";menu.style.top=Math.max(safeTop()+8,Math.min(y,innerHeight-menu.offsetHeight-8))+"px";
    if(panel){const h=menu.querySelector(".ph2");menu.querySelector(".px").onclick=()=>closeMenu();
      h.addEventListener("pointerdown",ev=>{if(ev.target.closest(".px"))return;ev.preventDefault();const dx=ev.clientX-menu.offsetLeft,dy=ev.clientY-menu.offsetTop;try{h.setPointerCapture(ev.pointerId)}catch(x){}
        const mv=m=>{const st=safeTop(),nx=Math.max(0,Math.min(innerWidth-60,m.clientX-dx)),ny=Math.max(st+4,Math.min(innerHeight-40,m.clientY-dy));menu.style.left=nx+"px";menu.style.top=ny+"px";panelPos={x:nx,y:ny}};
        const up=()=>{h.removeEventListener("pointermove",mv);h.removeEventListener("pointerup",up)};h.addEventListener("pointermove",mv);h.addEventListener("pointerup",up)});
      menu.querySelectorAll("[data-pt]").forEach(b=>b.onclick=()=>again(b.dataset.pt))}
    /* estilo */
    menu.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{setStyle(id,{color:b.dataset.c,fill:null});again()});
    const pk=menu.querySelector(".pick input");pk&&(pk.onchange=ev=>{setStyle(id,{color:ev.target.value,fill:null});again()});
    menu.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{setStyle(id,{size:+b.dataset.w});again()});
    menu.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{setStyle(id,{dash:b.dataset.d});again()});
    menu.querySelectorAll("[data-msc]").forEach(b=>b.onclick=()=>{v.extendData=Object.assign({},v.extendData||{},{sc:+b.dataset.msc});try{chart.overrideOverlay({id,extendData:v.extendData})}catch(e){}persist();again()});
    menu.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{setStyle(id,{fill:hexA(curStyle(id).color,+b.dataset.f)});again()});
    /* texto */
    const ot=menu.querySelector("input[data-ot]");ot&&(ot.onkeydown=ev=>ev.stopPropagation(),ot.onchange=()=>{v.extendData=Object.assign({},v.extendData||{},{text:ot.value.trim()||(v.name==="eagText"?"Texto":"")});chart.overrideOverlay({id,extendData:v.extendData});persist()});
    if(v.name==="eagText"||v.name==="eagNote"){const note=v.name==="eagNote",cK=note?"tc":"color";const setX=(pt,re)=>{if(note&&pt.color!==undefined&&pt.__p){pt.tc=pt.color;delete pt.color}delete pt.__p;v.extendData=Object.assign({},v.extendData||{},pt);try{chart.overrideOverlay({id,extendData:v.extendData})}catch(e){}persist();if(re)again()};
      const ta=menu.querySelector("textarea[data-ot]");if(ta){ta.onkeydown=ev=>ev.stopPropagation();ta.oninput=()=>{v.extendData=Object.assign({},v.extendData||{},{text:ta.value.replace(/\s+$/,"")||"Texto"});try{chart.overrideOverlay({id,extendData:v.extendData})}catch(e){}};ta.onchange=()=>setX({text:ta.value.replace(/\s+$/,"")||"Texto"})}
      const Q=(sel,fn)=>menu.querySelectorAll(sel).forEach(fn);
      Q("[data-xp]",b=>b.onclick=()=>setX(Object.assign({__p:1,u:false,s:false,i:false,rot:0,op:1,bd:false,al:"left",bga:1,r:4},TXPRE[+b.dataset.xp][1],note?{size:Math.min(24,TXPRE[+b.dataset.xp][1].size)}:{}),true));
      const zs=menu.querySelector("[data-xsz]");if(zs){zs.oninput=()=>{const n=+zs.value;zs.closest(".mrow").previousElementSibling.querySelector(".txv").textContent=n;v.extendData=Object.assign({},v.extendData||{},{size:n});try{chart.overrideOverlay({id,extendData:v.extendData})}catch(e){}};zs.onchange=()=>setX({size:+zs.value},true)}
      Q("[data-xs]",b=>b.onclick=()=>{const n=Math.max(8,Math.min(120,(+(v.extendData||{}).size||14)+(b.dataset.xs==="+"?2:-2)));setX({size:n},true)});
      Q("[data-xsn]",b=>b.onclick=()=>setX({size:+b.dataset.xsn},true));
      Q("[data-xc]",b=>b.onclick=()=>setX({[cK]:b.dataset.xc},true));Q("[data-xcp]",i=>i.onchange=()=>setX({[cK]:i.value},true));Q("[data-xac]",b=>b.onclick=()=>setX({color:b.dataset.xac},true));Q("[data-xacp]",i=>i.onchange=()=>setX({color:i.value},true));
      Q("[data-xf]",b=>b.onclick=()=>setX({fam:b.dataset.xf},true));
      Q("[data-xt]",b=>b.onclick=()=>{const k=b.dataset.xt,ex=v.extendData||{},cur=k==="b"?ex.b!==false:!!ex[k];setX({[k]:!cur},true)});
      Q("[data-xa]",b=>b.onclick=()=>setX({al:b.dataset.xa},true));
      Q("[data-xx]",b=>b.onclick=()=>{const k=b.dataset.xx,ex=v.extendData||{};setX(k==="neon"?{fx:k,fxc:ex.fxc&&ex.fx==="neon"?ex.fxc:(ex[cK]||(note?ex.color:GOLD)||GOLD),core:"#ffffff"}:{fx:k,fxc:k==="outline"||k==="shadow"?(ex.fx===k&&ex.fxc?ex.fxc:"#000000"):ex.fxc},true)});
      Q("[data-xfc]",b=>b.onclick=()=>setX({fxc:b.dataset.xfc},true));Q("[data-xfcp]",i=>i.onchange=()=>setX({fxc:i.value},true));
      Q("[data-xb]",b=>b.onclick=()=>setX(b.dataset.xb?{bg:b.dataset.xb,fx:(v.extendData||{}).fx==="halo"?"none":(v.extendData||{}).fx}:{bg:null},true));Q("[data-xbp]",i=>i.onchange=()=>setX({bg:i.value},true));
      Q("[data-xba]",r=>{r.oninput=()=>{v.extendData=Object.assign({},v.extendData||{},{bga:+r.value/100});try{chart.overrideOverlay({id,extendData:v.extendData})}catch(e){}};r.onchange=()=>setX({bga:+r.value/100})});
      Q("[data-xr]",b=>b.onclick=()=>setX({r:+b.dataset.xr},true));Q("[data-xbd]",b=>b.onclick=()=>setX({bd:(v.extendData||{}).bd?false:((v.extendData||{})[cK]||(note?"#ffffff":GOLD))},true));
      Q("[data-xrot]",r=>{r.oninput=()=>{r.closest(".mrow").previousElementSibling.querySelector(".txv").textContent=r.value+"°";v.extendData=Object.assign({},v.extendData||{},{rot:+r.value});try{chart.overrideOverlay({id,extendData:v.extendData})}catch(e){}};r.onchange=()=>setX({rot:+r.value})});
      Q("[data-xrot0]",b=>b.onclick=()=>setX({rot:0},true));
      Q("[data-xop]",r=>{r.oninput=()=>{r.closest(".mrow").previousElementSibling.querySelector(".txv").textContent=r.value+"%";v.extendData=Object.assign({},v.extendData||{},{op:+r.value/100});try{chart.overrideOverlay({id,extendData:v.extendData})}catch(e){}};r.onchange=()=>setX({op:+r.value/100})});
      Q("[data-xdef]",b=>b.onclick=()=>{if(!o.onToolStyle)return;const ex=Object.assign({},v.extendData||{});delete ex.text;const prev=(o.getToolStyle&&o.getToolStyle(v.name))||{};o.onToolStyle(v.name,{styles:prev.styles||null,ex});o.onToast&&o.onToast(note?"Listo: tus próximas notas salen con este estilo":"Listo: tus próximos textos salen con este estilo")});}
    const lt=menu.querySelector("[data-lt]");if(lt){lt.onkeydown=ev=>{ev.stopPropagation();if(ev.key==="Enter")lt.blur()};lt.oninput=()=>setLbl(id,{t:lt.value},true);lt.onchange=()=>setLbl(id,{t:lt.value});if(panel&&panelTab==="texto"&&!lastTouch)setTimeout(()=>{try{lt.focus()}catch(x){}},30)}
    menu.querySelectorAll("[data-lc]").forEach(b=>b.onclick=()=>{setLbl(id,{c:b.dataset.lc||null});again()});
    const ls=menu.querySelector("[data-ls]");ls&&(ls.onchange=()=>{setLbl(id,{s:+ls.value})});
    const lbB=menu.querySelector("[data-lb]");lbB&&(lbB.onclick=()=>{setLbl(id,{b:!lblOf(v).b});again()});
    const lbI=menu.querySelector("[data-li]");lbI&&(lbI.onclick=()=>{setLbl(id,{i:!lblOf(v).i});again()});
    menu.querySelectorAll("[data-lh]").forEach(b=>b.onclick=()=>{setLbl(id,{h:b.dataset.lh,hx:true});again()});
    menu.querySelectorAll("[data-lv]").forEach(b=>b.onclick=()=>{setLbl(id,{v:b.dataset.lv});again()});
    menu.querySelectorAll("[data-emo]").forEach(b=>b.onclick=()=>{v.extendData=Object.assign({},v.extendData||{},{text:b.dataset.emo});chart.overrideOverlay({id,extendData:v.extendData});persist();again()});
    menu.querySelectorAll("[data-esz]").forEach(b=>b.onclick=()=>{v.extendData=Object.assign({},v.extendData||{},{size:+b.dataset.esz});chart.overrideOverlay({id,extendData:v.extendData});persist();again()});
    /* niveles (Fibonacci) */
    if(isFib){const cur=()=>fibCfg(ovs.get(id)||v);
      menu.querySelectorAll("[data-fon]").forEach(i=>i.onchange=()=>{const c=cur();c.levels[+i.dataset.fon].on=i.checked;setFib(id,c);i.closest(".fibr").classList.toggle("off",!i.checked)});
      menu.querySelectorAll("[data-fv]").forEach(i=>{i.onkeydown=ev=>ev.stopPropagation();i.oninput=()=>{const n=parseFloat(String(i.value).replace(",","."));if(!isFinite(n))return;const c=cur();c.levels[+i.dataset.fv].v=n;setFib(id,c,true)}});
      menu.querySelectorAll("[data-fc]").forEach(i=>{i.oninput=()=>{i.parentNode.style.background=i.value;const c=cur();c.levels[+i.dataset.fc].c=i.value;setFib(id,c,true)}});
      menu.querySelectorAll("[data-fx]").forEach(b=>b.onclick=()=>{const c=cur();c.levels.splice(+b.dataset.fx,1);setFib(id,c);again("niv")});
      menu.querySelectorAll("[data-fe]").forEach(b=>b.onclick=()=>{const c=cur();c.ext=b.dataset.fe;setFib(id,c);again("niv")});
      menu.querySelectorAll("[data-ff]").forEach(b=>b.onclick=()=>{const c=cur();c.fill=+b.dataset.ff;setFib(id,c);again("niv")});
      menu.querySelectorAll("[data-fo]").forEach(i=>i.onchange=()=>{const c=cur(),k=i.dataset.fo;if(k==="side")c.side=i.checked?"right":"left";else c[k]=i.checked;setFib(id,c)});
      menu.querySelectorAll("[data-fa]").forEach(b=>b.onclick=()=>{const a=b.dataset.fa,c=cur();
        if(a==="add"){const mx=Math.max(0,...c.levels.map(l=>+l.v||0));c.levels.push({v:+(mx+.5).toFixed(3),c:"#2962ff",on:true});setFib(id,c);again("niv");return}
        if(a==="one"){const col=curStyle(id).color||GOLD;c.levels.forEach(l=>l.c=col);setFib(id,c);again("niv");return}
        if(a==="reset"){const vv=ovs.get(id);if(vv){const ex=Object.assign({},vv.extendData||{});delete ex.fib;vv.extendData=ex;try{chart.overrideOverlay({id,extendData:ex})}catch(x){}persist()}again("niv");return}
        if(a==="def"&&o.onToolStyle){const vv=ovs.get(id)||v,prev=(o.getToolStyle&&o.getToolStyle(vv.name))||{};o.onToolStyle(vv.name,{styles:vv.styles||prev.styles||null,ex:Object.assign({},prev.ex||{},{fib:c})});o.onToast&&o.onToast("Listo: tus próximos "+(TNAME[vv.name]||"dibujos")+" salen con estos niveles")}})}
    /* visibilidad */
    const visDone=ok=>{if(ok)again();else{closeMenu();hideStyleBar();selId=null;o.onToast&&o.onToast(`Listo: este dibujo ya no se ve en ${tf} (sigue guardado; aparece en las temporalidades que marcaste)`)}};
    menu.querySelectorAll("[data-tf]").forEach(b=>b.onclick=()=>{visCustom=id;const t=b.dataset.tf,cur=new Set(v.tfv&&v.tfv.length?v.tfv:STDTF.map(x=>x[0]));if(cur.has(t))cur.delete(t);else cur.add(t);
      if(!cur.size){o.onToast&&o.onToast("Debe verse al menos en una temporalidad");return}visDone(setTfv(id,STDTF.map(x=>x[0]).filter(k=>cur.has(k))))});
    menu.querySelectorAll("[data-tq]").forEach(b=>b.onclick=()=>{const q=b.dataset.tq,ks=STDTF.map(x=>x[0]);let L=ks;
      if(q==="custom"){visCustom=id;again();return}visCustom=null;
      if(q==="only")L=[tf];else if(q==="up")L=ks.slice(Math.max(0,idx));else if(q==="down")L=ks.slice(0,idx+1);visDone(setTfv(id,q==="all"?null:L))});
    menu.querySelectorAll("[data-va]").forEach(b=>b.onclick=()=>{const m=b.dataset.va;let n=0;const pl=k=>k===1?"":"s";
      ovs.forEach((x,k)=>{if(!(x.done&&x.points&&x.points.length))return;const t=tfOf(x);
        if(m==="all"){setTfv(k,null);n++}else if(m==="own"){if(t){setTfv(k,[t]);n++}}else if(m==="only"&&t===tf){setTfv(k,[tf]);n++}});visCustom=null;
      const msg=m==="all"?`Listo: ${n} dibujo${pl(n)} se ven en todas las temporalidades`:m==="own"?`Listo: cada dibujo quedó en su temporalidad (${byTf})`:`Listo: ${n} dibujo${pl(n)} hecho${pl(n)} en ${tf} ahora se ven solo en ${tf}; los demás no cambiaron`;
      o.onToast&&o.onToast(msg);const me=ovs.get(id);if(me&&!tfOk(me)){closeMenu();hideStyleBar();selId=null}else again()});
    const vn=menu.querySelector("[data-vnew]");vn&&(vn.onchange=()=>{o.setDrawTfOnly&&o.setDrawTfOnly(vn.checked);o.onToast&&o.onToast(vn.checked?"Lo nuevo que dibujes se verá solo en la temporalidad donde lo hagas":"Lo nuevo que dibujes se verá en todas las temporalidades")});
    /* acciones */
    menu.querySelectorAll(".mi").forEach(b=>b.onclick=()=>{const a=b.dataset.a;
      if(a==="ptexto"||a==="pvis"){const rr=chartEl.getBoundingClientRect(),mx=menu.offsetLeft-rr.left,my=menu.offsetTop-rr.top;openCtx(id,{x:mx,y:my},true,a==="ptexto"?"texto":"vis");return}
      if(!(panel&&(a==="lock")))closeMenu();
      if(a==="alert")alertFrom(id);else if(a==="txt")editText(id);else if(a==="lock"){toggleLock(id);if(panel)again()}else if(a==="dup")dupOv(id);else if(a==="hide"){const vv=ovs.get(id);if(vv){vv.hid=true;persist()}chart.overrideOverlay({id,visible:false});hideStyleBar();o.onToast&&o.onToast("Dibujo oculto · lo vuelves a mostrar desde clic derecho → Lista de dibujos")}else if(a==="del")removeOv(id)})}
  /* editar texto en el mismo gráfico (sin ventanas del navegador) */
  function editText(id){const v=ovs.get(id),ov=chart.getOverlayById(id);if(!v||!ov||!ov.points[0])return;
    const px=chart.convertToPixel({timestamp:ov.points[0].timestamp,value:ov.points[0].value},{paneId:"candle_pane"})||{x:40,y:40};
    const box=document.createElement("div");box.className="wtxt";box.innerHTML=`<textarea rows="${Math.min(6,String((v.extendData||{}).text||"").split("\n").length)}" maxlength="200" placeholder="Escribe · Enter guarda · Shift+Enter nueva línea">${esc((v.extendData||{}).text||"")}</textarea>`;
    chartEl.appendChild(box);box.style.left=Math.max(4,Math.min(px.x,chartEl.clientWidth-230))+"px";box.style.top=Math.max(4,px.y-16)+"px";
    const inp=box.querySelector("textarea");inp.focus();inp.select();inp.oninput=()=>{inp.rows=Math.min(6,inp.value.split("\n").length)};
    let fin=false;const done=ok=>{if(fin||!box.isConnected)return;fin=true;if(ok){v.extendData=Object.assign({},v.extendData||{},{text:inp.value.replace(/^\s+|\s+$/g,"")||(v.name==="eagText"?"Texto":v.name==="eagNote"?"Nota":"")});chart.overrideOverlay({id,extendData:v.extendData});persist()}box.remove();if(ok)again2(v.name)};
    inp.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();done(true)}if(e.key==="Escape")done(false)};inp.onblur=()=>done(true)}
  root.tabIndex=-1;
  root.addEventListener("keydown",e=>{if((e.key==="Delete"||e.key==="Backspace")&&selId&&!/input|select|textarea/i.test(e.target.tagName)){removeOv(selId);selId=null}if(e.key==="Escape"){cancelDraw();closeMenu();stopBrush()}});
  /* ---------- clic derecho en el gráfico: menú como TradingView ---------- */
  let hovId=null,ovCtxAt=0;
  const pxV=v=>(+v).toLocaleString("en-US",{minimumFractionDigits:dec(),maximumFractionDigits:dec()});
  /* ---------- historial de operaciones en el gráfico (clic derecho → Mostrar historial) ---------- */
  const histOn=()=>{try{return localStorage.getItem("eag_thist")==="1"}catch(e){return false}};
  const histSet=v=>{try{localStorage.setItem("eag_thist",v?"1":"0")}catch(e){}};
  let histT=0,histK="";
  function clearHist(){try{chart.removeOverlay({groupId:"eagTradeHist"})}catch(e){}histK=""}
  async function paintHist(loud){if(!o.getTradeHistory||!sym)return;const tk=sym.ticker;let L=[];
    try{L=await o.getTradeHistory(tk,sym)||[]}catch(e){if(loud&&o.onToast)o.onToast(e.message||"No se pudo traer el historial");return}
    if(!histOn()||!sym||sym.ticker!==tk)return;
    const k=tk+"|"+L.map(t=>t.id).join(",");if(k===histK&&!loud)return;clearHist();histK=k;
    L.forEach(t=>{try{chart.createOverlay({name:"eagTradeHist",groupId:"eagTradeHist",lock:true,
      points:[{timestamp:t.openT,value:+t.openP},{timestamp:t.closeT,value:+t.closeP}],
      extendData:{side:t.side,profit:t.profit,label:(t.profit!=null?((+t.profit>=0?"+":"−")+"$"+Math.abs(+t.profit).toFixed(2)):"")+(t.tag?" · "+t.tag:"")}})}catch(e){}});
    if(loud&&o.onToast)o.onToast(L.length?`Historial: ${L.length} ${L.length===1?"operación":"operaciones"} en ${sym.shortName||sym.name||tk}`:`No hay operaciones cerradas en ${sym.shortName||sym.name||tk} (en la cuenta conectada).`)}
  addEventListener("eag-thist",()=>{if(histOn()){histT=Date.now();paintHist(false)}else clearHist()});
  setInterval(()=>{if(!histOn()){if(histK)clearHist();return}if(document.hidden)return;const n=Date.now();if(sym&&(sym.ticker!==histK.split("|")[0]||n-histT>30000)){histT=n;paintHist(false)}},5000);
  function chartMenu(ev){const r=chartEl.getBoundingClientRect(),x=ev.clientX-r.left,y=ev.clientY-r.top;let c=null;
    try{c=chart.convertFromPixel([{x,y}],{paneId:"candle_pane"})[0]}catch(e){}let ya=null;try{ya=chart.getSize("candle_pane","main")}catch(e){}
    const inMain=!!(c&&isFinite(c.value)&&!(ya&&y>ya.height));
    const L=chart.getDataList(),i=c?Math.max(0,Math.min(L.length-1,c.dataIndex)):0,ts=L[i]?L[i].timestamp:Date.now(),v=c?c.value:0,pv=pxV(v),nm=sym.shortName||sym.name||sym.ticker;
    const nInd=ind.main.length+Object.keys(ind.sub).length;
    const mac=/Mac|iPhone|iPad/.test(navigator.platform);
    const item=(k,ic,t,ks,cls)=>`<button class="mi cmi${cls?" "+cls:""}" data-m="${k}">${ic?(IC[ic]?svg(ic,17):tsvg(ic,17)):"<i></i>"}<span>${t}</span>${ks?`<em class="ks">${ks}</em>`:""}</button>`;
    const nOv=[...ovs.values()].filter(v2=>v2.done).length;
    closeMenu();menu=document.createElement("div");menu.className="wmenu ctx cmenu";
    if(!inMain)menu.innerHTML=item("reset","reset","Restablecer visualización del gráfico")+`<div class="msep"></div>`+item("inds","fx",`Lista de indicadores (${nInd})…`)+`<div class="msep"></div>`+item("cfg","gear","Opciones de configuración…");
    else menu.innerHTML=item("reset","reset","Restablecer visualización del gráfico")+`<div class="msep"></div>`+
      item("copy","copy","Copiar precio "+pv)+`<div class="msep"></div>`+
      item("alert","bell",`Añadir alerta en ${esc(nm)} a ${pv}`)+
      item("hline","horizontalStraightLine",`Dibujar línea horizontal en ${pv}`)+
      item("vline","verticalStraightLine","Dibujar línea vertical aquí")+`<div class="msep"></div>`+
      item("undo","undo","Deshacer",(mac?"⌘":"Ctrl+")+"Z",hist.length?"":"off")+item("redo","redo","Rehacer",(mac?"⇧⌘":"Ctrl+")+"Y",fut.length?"":"off")+
      item("list","list",`Lista de dibujos (${nOv})…`)+item("inds","fx",`Lista de indicadores (${nInd})…`)+
      item("hide",hidden?"eye":"eyeoff",hidden?"Mostrar los dibujos":"Ocultar los dibujos")+
      (nOv?item("clear","trash",`Borrar todos los dibujos de ${esc(nm)} (${nOv})`,"", "danger"):"")+`<div class="msep"></div>`+
      (o.getTradeHistory?item("thist","list",histOn()?"✓ Historial de operaciones (ocultar)":"Mostrar historial de operaciones"):"")+`<div class="msep"></div>`+
      item("shot","cam","Captura del gráfico")+item("cfg","gear","Opciones de configuración…");
    document.body.appendChild(menu);
    menu.style.left=Math.max(8,Math.min(ev.clientX,innerWidth-menu.offsetWidth-8))+"px";menu.style.top=Math.max(safeTop()+8,Math.min(ev.clientY,innerHeight-menu.offsetHeight-8))+"px";
    menu.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{const k=b.dataset.m;
      if(k==="clear"&&!b.classList.contains("sure")){b.classList.add("sure");b.querySelector("span").textContent="¿Seguro? Toca otra vez para borrarlos";return}
      closeMenu();
      if(k==="reset")resetView();
      else if(k==="copy"){try{await navigator.clipboard.writeText(String(+(+v).toFixed(dec())));o.onToast&&o.onToast("Precio copiado: "+pv)}catch(e){o.onToast&&o.onToast("No se pudo copiar")}}
      else if(k==="alert"){if(o.alertsAllowed&&!o.alertsAllowed()){o.onLocked&&o.onLocked("alert","Alertas de precio");return}o.onCreateAlert&&o.onCreateAlert({symbol:sym.ticker,symbol_name:sym.name||sym.ticker,kind:"nivel",price:+(+v).toFixed(dec()),price2:null})}
      else if(k==="hline"||k==="vline")quickLine(k==="hline"?"horizontalStraightLine":"verticalStraightLine",ts,v);
      else if(k==="list")openObjList();else if(k==="inds")openInd();
      else if(k==="undo")undo();else if(k==="redo")redo();
      else if(k==="hide"){const hb=dbar.querySelector('[data-x="hide"]');hb&&hb.click()}
      else if(k==="clear"){bulk=true;ovs.forEach((v2,id)=>{try{chart.removeOverlay(id)}catch(e){}});bulk=false;ovs.clear();selId=null;hideStyleBar();persist();syncPan();o.onToast&&o.onToast("Dibujos borrados · puedes deshacer con Ctrl+Z")}
      else if(k==="shot"){const sb=root.querySelector('[data-a="shot"]');sb&&sb.click()}
      else if(k==="thist"){histSet(!histOn());if(histOn())paintHist(true);else{clearHist();o.onToast&&o.onToast("Historial de operaciones oculto")}}
      else if(k==="cfg")o.onSettings&&o.onSettings(root.querySelector('[data-a="cfg"]'))})}
  /* ---------- lista de dibujos (como la lista de objetos de MT5): ver, mostrar/ocultar, bloquear, editar y borrar uno por uno o varios ---------- */
  let olPos=null,olSel=new Set();let visCustom=null;
  const descOf=v=>{const P=v.points||[],pp=dec(),ex=v.extendData||{};const t=(ex.lbl&&ex.lbl.t)||((v.name==="eagText"||v.name==="eagNote"||v.name==="eagEmoji")?ex.text:"")||"";
    const pr=P.length?P.map(q=>(+q.value).toFixed(pp)).slice(0,2).join(" → "):"";return{t,pr}};
  const fdt=ts=>{try{const d=new Date(ts);return d.toLocaleDateString("es-CO",{day:"2-digit",month:"short"})+" "+d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit",hour12:false})}catch(e){return""}};
  function openObjList(){const prev=menu&&menu.classList.contains("olist")?{x:menu.offsetLeft,y:menu.offsetTop}:null;closeMenu();
    const L=[...ovs.entries()].filter(([id,v])=>v.done&&v.points&&v.points.length);[...olSel].forEach(id=>{if(!ovs.has(id))olSel.delete(id)});
    const others=(()=>{const all=loadD(),o2=[];Object.keys(all).forEach(t=>{if(t!==sym.ticker&&Array.isArray(all[t])&&all[t].length)o2.push([t,all[t].length])});return o2})();
    menu=document.createElement("div");menu.className="wmenu ctx panel olist";
    menu.innerHTML=`<div class="ph2"><span class="mti">${svg("list",16)}<b>Dibujos · ${esc(sym.shortName||sym.name||sym.ticker)} (${L.length})</b></span><button class="px" title="Cerrar">×</button></div>
      ${L.length?`<div class="olbar"><label><input type="checkbox" data-all${olSel.size&&olSel.size===L.length?" checked":""}> Todos</label><span class="grow"></span>
        <button class="tbn" data-ob="hide" ${olSel.size?"":"disabled"} title="Ocultar / mostrar los marcados">${svg("eye",15)}</button><button class="tbn" data-ob="lock" ${olSel.size?"":"disabled"} title="Bloquear / desbloquear los marcados">${svg("lock",15)}</button><button class="tbn" data-ob="tf" ${olSel.size?"":"disabled"} title="Los marcados se verán solo en la temporalidad actual">Solo ${esc(curTf())}</button>
        <button class="tbn danger" data-ob="del" ${olSel.size?"":"disabled"}>${svg("trash",15)} Borrar${olSel.size?" ("+olSel.size+")":""}</button></div>
      <div class="olrows">${L.map(([id,v])=>{const d=descOf(v),onTf=tfOk(v)||v.hid;return`<div class="olr${olSel.has(id)?" sel":""}${v.hid?" hid":""}${selId===id?" cur":""}" data-id="${esc(id)}">
        <input type="checkbox" data-ck${olSel.has(id)?" checked":""}>
        <span class="oli" style="color:${esc(curStyle(id).color||GOLD)}">${tsvg(v.name,17)}</span>
        <span class="olt"><b>${esc(TNAME[v.name]||v.name)}${d.t?` · <em>${esc(d.t)}</em>`:""}</b><small>${d.pr}${v.points[0]&&v.points[0].timestamp?" · "+fdt(v.points[0].timestamp):""}${v.tfv&&v.tfv.length?` · solo ${esc(v.tfv.slice(0,3).join(", "))}${v.tfv.length>3?"…":""}`:""}${!onTf?" · no se ve en "+esc(curTf()):""}</small></span>
        <button class="olb${v.hid?" off":""}" data-a="hid" title="${v.hid?"Mostrar":"Ocultar"}">${svg(v.hid?"eyeoff":"eye",15)}</button>
        <button class="olb${v.lock?" on":""}" data-a="lock" title="${v.lock?"Desbloquear":"Bloquear"}">${svg(v.lock?"lock":"unlock",15)}</button>
        <button class="olb" data-a="cfg" title="Configurar">${svg("gear",15)}</button>
        <button class="olb del" data-a="del" title="Borrar">${svg("trash",15)}</button></div>`}).join("")}</div>`
      :`<p class="mhint" style="margin:14px 10px">No hay dibujos en este mercado.</p>`}
      ${others.length?`<div class="ml">Otros mercados</div><div class="olother">${others.map(([t,n])=>`<div class="olo"><span>${esc(t)} · ${n} ${n===1?"dibujo":"dibujos"}</span><button class="olb del" data-om="${esc(t)}" title="Borrar los dibujos de ${esc(t)}">${svg("trash",14)}</button></div>`).join("")}</div>`:""}`;
    document.body.appendChild(menu);
    const r=chartEl.getBoundingClientRect(),pos=prev||olPos||{x:r.left+60,y:r.top+50};menu.style.left=Math.max(8,Math.min(pos.x,innerWidth-menu.offsetWidth-8))+"px";menu.style.top=Math.max(safeTop()+8,Math.min(pos.y,innerHeight-menu.offsetHeight-8))+"px";
    const h=menu.querySelector(".ph2");menu.querySelector(".px").onclick=()=>closeMenu();
    h.addEventListener("pointerdown",ev=>{if(ev.target.closest(".px"))return;ev.preventDefault();const dx=ev.clientX-menu.offsetLeft,dy=ev.clientY-menu.offsetTop;try{h.setPointerCapture(ev.pointerId)}catch(x){}
      const mv=m=>{const nx=Math.max(0,Math.min(innerWidth-60,m.clientX-dx)),ny=Math.max(safeTop()+4,Math.min(innerHeight-40,m.clientY-dy));menu.style.left=nx+"px";menu.style.top=ny+"px";olPos={x:nx,y:ny}};
      const up=()=>{h.removeEventListener("pointermove",mv);h.removeEventListener("pointerup",up)};h.addEventListener("pointermove",mv);h.addEventListener("pointerup",up)});
    const re=()=>openObjList();
    const setHid=(id,on)=>{const v=ovs.get(id);if(!v)return;v.hid=!!on;try{chart.overrideOverlay({id,visible:!hidden&&tfOk(v)})}catch(e){}};
    const setLock=(id,on)=>{const v=ovs.get(id);if(!v)return;v.lock=!!on;try{chart.overrideOverlay({id,lock:v.lock})}catch(e){}};
    const delMany=ids=>{bulk=true;ids.forEach(id=>{try{chart.removeOverlay(id)}catch(e){}ovs.delete(id);olSel.delete(id);if(selId===id)selId=null});bulk=false;hideStyleBar();persist();syncPan()};
    menu.querySelectorAll(".olr").forEach(row=>{const id=row.dataset.id;
      row.querySelector("[data-ck]").onchange=e=>{e.target.checked?olSel.add(id):olSel.delete(id);re()};
      row.querySelectorAll("[data-a]").forEach(b=>b.onclick=e=>{e.stopPropagation();const a=b.dataset.a,v=ovs.get(id);if(!v)return;
        if(a==="hid"){setHid(id,!v.hid);persist();re()}else if(a==="lock"){setLock(id,!v.lock);persist();re()}
        else if(a==="del"){delMany([id]);o.onToast&&o.onToast("Dibujo borrado · Ctrl+Z para deshacer");re()}
        else if(a==="cfg"){const rr=chartEl.getBoundingClientRect(),mx=menu.offsetLeft+menu.offsetWidth+8-rr.left,my=menu.offsetTop-rr.top;panelPos=null;openCtx(id,{x:Math.min(mx,rr.width-320),y:my},true,"estilo")}});
      /* tocar la fila: lleva el gráfico hasta ese dibujo y lo resalta */
      row.onclick=e=>{if(e.target.closest("input,button"))return;const v=ovs.get(id);if(!v)return;selId=id;showStyleBar(id);
        try{const ts=v.points[0].timestamp;if(ts)chart.scrollToTimestamp(ts,250)}catch(x){}menu.querySelectorAll(".olr").forEach(x=>x.classList.toggle("cur",x===row))}});
    const all=menu.querySelector("[data-all]");all&&(all.onchange=()=>{if(all.checked)L.forEach(([id])=>olSel.add(id));else olSel.clear();re()});
    menu.querySelectorAll("[data-ob]").forEach(b=>b.onclick=()=>{const a=b.dataset.ob,ids=[...olSel];if(!ids.length)return;
      if(a==="del"){if(!b.classList.contains("sure")){b.classList.add("sure");b.innerHTML=`¿Borrar ${ids.length}?`;return}delMany(ids);o.onToast&&o.onToast(`${ids.length} ${ids.length===1?"dibujo borrado":"dibujos borrados"} · Ctrl+Z para deshacer`);re();return}
      if(a==="hide"){const anyVis=ids.some(id=>!(ovs.get(id)||{}).hid);ids.forEach(id=>setHid(id,anyVis))}
      if(a==="lock"){const anyUn=ids.some(id=>!(ovs.get(id)||{}).lock);ids.forEach(id=>setLock(id,anyUn))}
      if(a==="tf"){const t=curTf();ids.forEach(id=>setTfv(id,[t]));o.onToast&&o.onToast(`Listo: ${ids.length} dibujo${ids.length===1?"":"s"} ahora se ven solo en ${t}`)}
      persist();re()});
    menu.querySelectorAll("[data-om]").forEach(b=>b.onclick=()=>{const t=b.dataset.om;if(!b.classList.contains("sure")){b.classList.add("sure");b.title="Toca otra vez para borrar";b.innerHTML="¿Seguro?";return}
      const all2=loadD();delete all2[t];saveD(all2);o.onDrawingsChange&&o.onDrawingsChange(t);o.onToast&&o.onToast("Dibujos de "+t+" borrados");re()})}
  o.openObjList=()=>openObjList();
  function resetView(){pinTs=null;try{chart.setBarSpace(8);chart.scrollToRealTime(200)}catch(e){}autoScale();fixOffR(true)}
  function quickLine(name,ts,v){if(!toolOK(name)){o.onLocked&&o.onLocked("tool",TNAME[name]||name);return}
    const st=(o.getToolStyle&&o.getToolStyle(name))||{};const id=makeOverlay({name,points:[{timestamp:ts,value:v}],styles:st.styles||undefined,extendData:(st.ex&&Object.keys(st.ex).length)?st.ex:undefined},false);
    if(id){const vv=ovs.get(id);if(vv){if(!vv.done&&!vv.ctf)vv.ctf=curTf();if(!vv.tfv&&o.drawTfOnly&&o.drawTfOnly())vv.tfv=[curTf()];vv.done=true}persist()}}
  chartEl.addEventListener("contextmenu",e=>{e.preventDefault();if(drawingId){if(finishFree())return;cancelDraw();o.onToast&&o.onToast("Herramienta cancelada");return}
    const ev={clientX:e.clientX,clientY:e.clientY};setTimeout(()=>{if(Date.now()-ovCtxAt<250)return;if(lastTouch)return;chartMenu(ev)},30)});
  /* rueda del mouse (clic del centro) sobre un dibujo: lo borra */
  chartEl.addEventListener("mousedown",e=>{if(e.button!==1)return;e.preventDefault();if(drawingId)return;const id=hovId;if(!id||!ovs.has(id))return;
    const v=ovs.get(id);if(v&&v.lock){o.onToast&&o.onToast("Ese dibujo está bloqueado");return}removeOv(id);hovId=null;chartEl.classList.remove("ovh");o.onToast&&o.onToast("Dibujo borrado · Ctrl+Z para deshacer")},true);
  chartEl.addEventListener("auxclick",e=>{if(e.button===1)e.preventDefault()});

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
  /* ---------- celular: dibujar arrastrando, como MT5 (pones el dedo, arrastras y queda del tamaño que quieres) ---------- */
  {let dd=null;
    const ptAt=(x,y)=>{let p=null;try{p=chart.convertFromPixel([{x,y}],{paneId:"candle_pane"})[0]}catch(e){}if(!p||!isFinite(p.value))return null;return{timestamp:tsOf(p),dataIndex:p.dataIndex,value:p.value}};
    const rel=t=>{const r=chartEl.getBoundingClientRect();return{x:t.clientX-r.left,y:t.clientY-r.top}};
    const setPts=(id,name,a,b)=>{try{chart.overrideOverlay({id,points:BOX.test(name)?boxPts(a,b):[a,b]})}catch(e){}};
    chartEl.addEventListener("touchstart",e=>{if(dd||brushOn||e.touches.length!==1)return;
      /* segundo toque: el segundo punto va justo donde tocas (y puedes arrastrar para ajustarlo) */
      if(ttWait&&!drawingId){const w=ttWait;if(!ovs.has(w.id)){ttWait=null;return}const t=rel(e.touches[0]),p1=ptAt(t.x,t.y);if(!p1)return;e.stopPropagation();e.preventDefault();ttWait=null;
        dd={id:w.id,name:w.name,p0:w.p0,x0:w.x0,y0:w.y0,lx:t.x,ly:t.y,moved:true,second:true};setPts(w.id,w.name,w.p0,p1);syncPan();return}
      if(!drawingId)return;let ov;try{ov=chart.getOverlayById(drawingId)}catch(x){}
      if(!ov||ov.totalStep!==3||(ov.points||[]).length>1)return;const v=ovs.get(drawingId);if(!v)return;
      const t=rel(e.touches[0]),p0=ptAt(t.x,t.y);if(!p0)return;
      e.stopPropagation();e.preventDefault();
      const name=v.name,styles=v.styles,extendData=v.extendData;bulk=true;try{chart.removeOverlay(drawingId)}catch(x){}bulk=false;ovs.delete(drawingId);drawingId=null;
      const id=makeOverlay({name,styles:styles||undefined,extendData:extendData||undefined,points:[p0,p0]},false);if(!id){syncPan();return}
      dd={id,name,p0,x0:t.x,y0:t.y,lx:t.x,ly:t.y,moved:false};setPts(id,name,p0,p0);syncPan()},{capture:true,passive:false});
    chartEl.addEventListener("touchmove",e=>{if(!dd)return;e.stopPropagation();e.preventDefault();const t=rel(e.touches[0]);
      if(Math.hypot(t.x-dd.x0,t.y-dd.y0)>6)dd.moved=true;dd.lx=t.x;dd.ly=t.y;const p1=ptAt(t.x,t.y);if(p1)setPts(dd.id,dd.name,dd.p0,p1)},{capture:true,passive:false});
    const end=e=>{if(!dd)return;e.stopPropagation();e.preventDefault();const d=dd;dd=null;
      if(!d.moved){/* toque sin arrastrar: queda el primer punto y el siguiente toque pone el segundo, justo donde toques */
        ttWait={id:d.id,name:d.name,p0:d.p0,x0:d.x0,y0:d.y0};syncPan();o.onToast&&o.onToast("Ahora toca donde va el segundo punto");return}
      else if(BOX.test(d.name)||d.name==="rect"){/* zonas y rectángulos: ancho mínimo para que el cuadro del centro se vea bien */
        const W=chartEl.clientWidth,minW=Math.max(110,W*.3),dxp=d.lx-d.x0;
        if(Math.abs(dxp)<minW){const sg=dxp<0&&d.x0-minW>8?-1:1,p1=ptAt(d.x0+sg*minW,d.ly);if(p1)setPts(d.id,d.name,d.p0,p1)}}
      dbar.querySelectorAll(".dt").forEach(b=>b.classList.remove("act"));
      try{capture(chart.getOverlayById(d.id))}catch(x){}syncPan();again2(d.name)};
    chartEl.addEventListener("touchend",end,{capture:true,passive:false});chartEl.addEventListener("touchcancel",end,{capture:true,passive:false});
    /* computador: eliges la herramienta, haces clic y arrastras → el dibujo se va viendo y queda al soltar (sin otro clic).
       Si solo das clic sin arrastrar, funciona como antes (clic en el primer punto y clic en el segundo). */
    let md=null;
    let synth=false;
    chartEl.addEventListener("mousedown",e=>{if(synth||e.button!==0||dd||md||!drawingId||brushOn)return;let ov;try{ov=chart.getOverlayById(drawingId)}catch(x){}
      if(!ov||ov.totalStep!==3||(ov.points||[]).length>1)return;const t=rel(e),p0=ptAt(t.x,t.y);if(!p0)return;
      /* mientras tengas el clic oprimido, el gráfico queda quieto (no se mueve ni se arrastra) */
      e.stopImmediatePropagation();e.preventDefault();try{chart.setScrollEnabled(false);chart.setZoomEnabled(false)}catch(x){}
      md={x0:t.x,y0:t.y,p0,id:null,name:null,target:e.target,cx:e.clientX,cy:e.clientY}},true);
    addEventListener("mousemove",e=>{if(!md)return;if(!(e.buttons&1)){md=null;return}const t=rel(e);
      if(!md.id){if(Math.hypot(t.x-md.x0,t.y-md.y0)<7||!drawingId)return;const v=ovs.get(drawingId);if(!v){md=null;return}
        const name=v.name,styles=v.styles,extendData=v.extendData;bulk=true;try{chart.removeOverlay(drawingId)}catch(x){}bulk=false;ovs.delete(drawingId);drawingId=null;
        const id=makeOverlay({name,styles:styles||undefined,extendData:extendData||undefined,points:[md.p0,md.p0]},false);if(!id){md=null;syncPan();return}md.id=id;md.name=name;chartEl.classList.add("ovdrag")}
      const p1=ptAt(t.x,t.y);if(p1)setPts(md.id,md.name,md.p0,p1)},true);
    addEventListener("mouseup",e=>{if(!md)return;const d=md;md=null;
      if(!d.id){/* fue solo un clic (sin arrastrar): se le pasa al gráfico como clic normal → sigue el modo clic-clic */
        panLocked=null;syncPan();synth=true;try{const o2={bubbles:true,cancelable:true,clientX:d.cx,clientY:d.cy,button:0,view:window};
          d.target.dispatchEvent(new MouseEvent("mousedown",Object.assign({buttons:1},o2)));d.target.dispatchEvent(new MouseEvent("mouseup",Object.assign({buttons:0},o2)))}catch(x){}synth=false;return}
      e.stopPropagation();chartEl.classList.remove("ovdrag");panLocked=null;
      dbar.querySelectorAll(".dt").forEach(b=>b.classList.remove("act"));
      try{const ov=chart.getOverlayById(d.id);capture(ov);if(ov&&ov.name==="eagText")setTimeout(()=>editText(d.id),30);else if(ov)again2(ov.name)}catch(x){}
      /* un clic que llegue justo después no debe empezar nada nuevo */
      const stop=ev=>{ev.stopPropagation();ev.preventDefault()};chartEl.addEventListener("click",stop,{capture:true,once:true});setTimeout(()=>chartEl.removeEventListener("click",stop,true),60);syncPan()},true);
  }
  /* ---------- celular: tocar un dibujo es fácil (margen amplio) y doble toque abre su configuración ---------- */
  function ovDist(id,x,y){const v=ovs.get(id);if(!v)return 1e9;let ov;try{ov=chart.getOverlayById(id)}catch(e){}const pts=(ov&&ov.points)||v.points||[];if(!pts.length)return 1e9;
    let P;try{P=pts.map(p=>chart.convertToPixel({timestamp:p.timestamp!=null?p.timestamp:tsOf(p),value:p.value},{paneId:"candle_pane"}))}catch(e){return 1e9}
    P=P.filter(p=>p&&isFinite(p.x)&&isFinite(p.y));if(!P.length)return 1e9;const n=v.name,W=chartEl.clientWidth;
    const seg=(a,b,inf)=>{const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy;if(!L)return Math.hypot(x-a.x,y-a.y);let t=((x-a.x)*dx+(y-a.y)*dy)/L;if(!inf)t=Math.max(0,Math.min(1,t));return Math.hypot(x-(a.x+t*dx),y-(a.y+t*dy))};
    if(/^(horizontalStraightLine|priceLine|eagAlert)$/.test(n))return Math.abs(y-P[0].y);
    if(/^horizontal(RayLine|Segment)$/.test(n))return x>=Math.min(P[0].x,(P[1]||P[0]).x)-12?Math.abs(y-P[0].y):1e9;
    if(/^vertical/.test(n))return Math.abs(x-P[0].x);
    if(n==="straightLine"&&P[1])return seg(P[0],P[1],true);
    if(BOX.test(n)||/^(rect|eagLong|eagShort|eagMeasure|eagPosition|circle|triangle|parallelogram|fibonacciLine|eagText)$/.test(n)||/^fib|^gann|^abcd|^xabcd/.test(n)){
      const xs=P.map(p=>p.x),ys=P.map(p=>p.y);let x0=Math.min(...xs),x1=/^(eagZone|eagBuyZone|eagSellZone|fibonacciLine)$/.test(n)?W:Math.max(...xs);if(n==="eagText"){x1=x0+txtLay(v.extendData).w}
      let y0=Math.min(...ys),y1=Math.max(...ys);if(n==="eagText"){const hh=txtLay(v.extendData).h/2;y0-=hh;y1+=hh}
      if(n==="circle"&&P[1]){const r=Math.hypot(P[1].x-P[0].x,P[1].y-P[0].y);return Math.max(0,Math.hypot(x-P[0].x,y-P[0].y)-r)}
      const dx=Math.max(x0-x,0,x-x1),dy=Math.max(y0-y,0,y-y1);return Math.hypot(dx,dy)}
    let d=1e9;for(let i=0;i<P.length;i++){d=Math.min(d,Math.hypot(x-P[i].x,y-P[i].y));if(i&&n!=="eagBrush")d=Math.min(d,seg(P[i-1],P[i],false))}
    if(n==="eagBrush")for(let i=1;i<P.length;i++)d=Math.min(d,seg(P[i-1],P[i],false));
    if(n==="rayLine"&&P[1])d=Math.min(d,(()=>{const dx=P[1].x-P[0].x,dy=P[1].y-P[0].y,L=dx*dx+dy*dy;if(!L)return 1e9;const t=((x-P[0].x)*dx+(y-P[0].y)*dy)/L;return t<0?1e9:Math.hypot(x-(P[0].x+t*dx),y-(P[0].y+t*dy))})());
    return d}
  function nearOv(x,y,tol,skipLocked){let best=null,bd=tol;ovs.forEach((v,id)=>{if(hidden||(skipLocked&&v.lock))return;const d=ovDist(id,x,y);if(d<=bd){bd=d;best=id}});return best}
  function lockTip(x,y,on){const t=document.createElement("div");t.className="wlock";t.textContent=on?"🔒 Bloqueado":"🔓 Desbloqueado";t.style.left=x+"px";t.style.top=(y-46)+"px";chartEl.appendChild(t);setTimeout(()=>t.remove(),1300)}
  {let tdn=null,lastTap=null,manual=null;
    let lp=null;
    chartEl.addEventListener("pointerdown",e=>{const lt=e.pointerType!=="mouse";if(lt!==lastTouch){lastTouch=lt;syncPan()}if(e.pointerType==="mouse")return;tdn={x:e.clientX,y:e.clientY,t:Date.now(),sel:selId};
      /* mantener oprimido un dibujo = bloquear / desbloquear (como MT5) */
      clearTimeout(lp);const d0=tdn;lp=setTimeout(()=>{if(tdn!==d0||drawingId||brushOn)return;const r=chartEl.getBoundingClientRect(),x=d0.x-r.left,y=d0.y-r.top,id=nearOv(x,y,24);if(!id)return;
        tdn=null;toggleLock(id);const v=ovs.get(id);try{navigator.vibrate&&navigator.vibrate(18)}catch(x){}
        if(v&&v.lock&&selId===id){selId=null;manual=null;hideStyleBar();syncPan()}
        lockTip(x,y,v&&v.lock);o.onToast&&o.onToast(v&&v.lock?"🔒 Dibujo bloqueado: ya no se selecciona al tocar. Mantén oprimido para desbloquear.":"🔓 Dibujo desbloqueado")},560)},true);
    chartEl.addEventListener("pointermove",e=>{if(tdn&&Math.hypot(e.clientX-tdn.x,e.clientY-tdn.y)>10)clearTimeout(lp)},true);
    chartEl.addEventListener("pointerup",()=>clearTimeout(lp),true);chartEl.addEventListener("pointercancel",()=>{clearTimeout(lp);tdn=null},true);
    chartEl.addEventListener("pointerup",e=>{if(e.pointerType==="mouse"||!tdn)return;const d=tdn;tdn=null;
      if(Date.now()-d.t>350||Math.hypot(e.clientX-d.x,e.clientY-d.y)>10||drawingId||brushOn)return;
      if(e.target.closest(".wnav,.wstyle,.wcdl,.wmenu"))return;
      const r=chartEl.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      setTimeout(()=>{let id=selId;const near=nearOv(x,y,24,true);
        if(!near&&id&&id===manual&&ovDist(id,x,y)>24){selId=null;manual=null;hideStyleBar();syncPan();lastTap=null;return}
        if(!id&&near){id=near;selId=near;manual=near;showStyleBar(near);syncPan()}
        else if(id&&near&&near!==id&&ovDist(id,x,y)>24){id=near;selId=near;manual=near;showStyleBar(near);syncPan()}
        const now=Date.now();
        if(id&&lastTap&&lastTap.id===id&&now-lastTap.t<450&&Math.hypot(x-lastTap.x,y-lastTap.y)<40){lastTap=null;openCtx(id,{x,y},true);return}
        lastTap=id?{id,t:now,x,y}:null},70)});
  }
  chartEl.addEventListener("pointerdown",e=>{if(e.shiftKey&&!drawingId&&e.button===0)startTool("eagMeasure")},true);

  /* ---------- indicadores ---------- */
  function addInd(name,where,silent){const params=ind.params[name];
    const already=where==="main"?ind.main.includes(name):!!ind.sub[name];
    if(!already&&o.maxIndicators!=null){const n=ind.main.length+Object.keys(ind.sub).length;const mx=typeof o.maxIndicators==="function"?o.maxIndicators():o.maxIndicators;
      if(mx!=null&&n>=mx){if(!silent)o.onLocked&&o.onLocked("ind",`Más de ${mx} indicador${mx===1?"":"es"}`);return false}}
    if(where==="main"){if(!ind.main.includes(name))ind.main.push(name);chart.createIndicator(params?{name,calcParams:params}:name,true,{id:"candle_pane"})}
    else{if(ind.sub[name])return;const pid=chart.createIndicator(params?{name,calcParams:params}:name,false,{height:110,dragEnabled:true});ind.sub[name]=pid}
    if(ind.st&&ind.st[name])setTimeout(()=>applyIndSt(name,where),0);
    if(ind.hid[name])setTimeout(()=>{try{chart.overrideIndicator({name,visible:false},where==="main"?"candle_pane":ind.sub[name])}catch(e){}},0);
    if(!silent)o.onIndicators&&o.onIndicators(dump())}
  function rmInd(name,where){if(where==="main"){chart.removeIndicator("candle_pane",name);ind.main=ind.main.filter(x=>x!==name)}else{const pid=ind.sub[name];if(pid)chart.removeIndicator(pid,name);delete ind.sub[name]}delete ind.hid[name];o.onIndicators&&o.onIndicators(dump())}
  const dump=()=>({main:ind.main.slice(),sub:Object.keys(ind.sub),params:Object.assign({},ind.params),st:JSON.parse(JSON.stringify(ind.st||{})),hid:Object.assign({},ind.hid)});
  /* colores, grosor, tipo de línea y mostrar/ocultar de cada línea de un indicador (ind.st[nombre] = [{c,w,d,h}]) */
  const IPAL=["#FF9600","#935EBD","#2962ff","#E11D74","#01C5C4","#089981","#f23645","#e2b55c"];
  const indInst=(name,where)=>{try{return chart.getIndicatorByPaneId(where==="main"?"candle_pane":ind.sub[name],name)}catch(e){return null}};
  const indLines=(name,where)=>{const i=indInst(name,where);if(!i)return[];return(i.figures||[]).filter(f=>f.type==="line").map((f,k)=>({k,t:String(f.title||f.key||"").replace(/[:\s]+$/,"")}))};
  const lineDef=(name,where,k)=>{const i=indInst(name,where),base=((i&&i.styles&&i.styles.lines)||[])[k]||{};const u=((ind.st||{})[name]||[])[k]||{};
    return{c:u.c||base.__c||base.color||IPAL[k%IPAL.length],w:u.w||base.size||1,d:u.d!=null?u.d:base.style==="dashed",h:!!u.h}};
  function applyIndSt(name,where){const L=indLines(name,where);if(!L.length)return;const i=indInst(name,where),base=(i&&i.styles&&i.styles.lines)||[];
    const lines=L.map(({k})=>{const d=lineDef(name,where,k);return{style:d.d?"dashed":"solid",smooth:false,size:d.w,dashedValue:[4,3],color:d.h?"rgba(0,0,0,0)":d.c,__c:d.c}});
    try{chart.overrideIndicator({name,styles:{lines}},where==="main"?"candle_pane":ind.sub[name])}catch(e){}}
  function setParams(name,where,arr){ind.params[name]=arr;try{chart.overrideIndicator({name,calcParams:arr},where==="main"?"candle_pane":ind.sub[name])}catch(e){}setTimeout(()=>applyIndSt(name,where),0);o.onIndicators&&o.onIndicators(dump())}
  function setLineSt(name,where,k,ch){ind.st=ind.st||{};const a=(ind.st[name]=(ind.st[name]||[]).slice());a[k]=Object.assign({},lineDef(name,where,k),a[k]||{},ch);applyIndSt(name,where);o.onIndicators&&o.onIndicators(dump())}
  /* botones en la leyenda de cada indicador (como TradingView): ocultar · configurar · quitar */
  function indHide(name,where){const h=!ind.hid[name];if(h)ind.hid[name]=1;else delete ind.hid[name];
    try{chart.overrideIndicator({name,visible:!h},where==="main"?"candle_pane":ind.sub[name])}catch(e){}o.onIndicators&&o.onIndicators(dump())}
  try{chart.subscribeAction("onTooltipIconClick",d=>{if(!d||!d.indicatorName)return;const n=d.indicatorName,w=d.paneId==="candle_pane"?"main":"sub";
    if(d.iconId==="eye")indHide(n,w);else if(d.iconId==="cfg")openInd(n);else if(d.iconId==="del")rmInd(n,w)})}catch(e){}
  function openInd(focus){
    const ov=document.createElement("div");ov.className="wmodal";
    const render=qs=>{const q=(qs||"").toLowerCase();
      const on=(n,w)=>w==="main"?ind.main.includes(n):!!ind.sub[n];
      const rows=IND.filter(([n,t])=>!q||t.toLowerCase().includes(q)||n.toLowerCase().includes(q));
      const act=IND.filter(([n,,w])=>on(n,w));
      return`<div class="mh"><b>Indicadores</b><button class="x" data-a="close">×</button></div><input class="mq" placeholder="Buscar indicador…" value="${esc(qs||"")}">
        ${act.length?`<div class="ml">En el gráfico</div>`+act.map(([n,t,w])=>{let cp="";try{const i=chart.getIndicatorByPaneId(w==="main"?"candle_pane":ind.sub[n],n);cp=(i&&i.calcParams||[]).join(", ")}catch(e){}
          const op=openSet.has(n);const L=op?indLines(n,w):[];
          return`<div class="ir act${op?" open":""}"><span>${esc(t)}</span><input class="ip" data-n="${n}" data-w="${w}" value="${esc(cp)}" title="Periodos (separados por coma). Ej.: 20, 50, 200"><button class="x ig" data-cfg="${n}" title="Colores y líneas">⚙</button><button class="x" data-rm="${n}" data-w="${w}" title="Quitar">×</button></div>
          ${op?`<div class="icfg">${L.length?L.map(({k,t:lt})=>{const d=lineDef(n,w,k);return`<div class="icl${d.h?" off":""}"><button class="ieye" data-eye="${k}" data-n="${n}" data-w="${w}" title="${d.h?"Mostrar":"Ocultar"} esta línea">${d.h?"○":"●"}</button><span class="icn">${esc(lt||("Línea "+(k+1)))}</span>
            <label class="icc" style="background:${esc(d.c)}"><input type="color" data-col="${k}" data-n="${n}" data-w="${w}" value="${/^#[0-9a-f]{6}$/i.test(d.c)?d.c:"#e2b55c"}"></label>
            <select class="isz" data-sz="${k}" data-n="${n}" data-w="${w}">${[1,1.5,2,3,4].map(z=>`<option value="${z}"${+d.w===z?" selected":""}>${z}px</option>`).join("")}</select>
            <button class="idash${d.d?" on":""}" data-dash="${k}" data-n="${n}" data-w="${w}" title="Línea punteada">┄</button></div>`}).join(""):`<p class="ihint">Este indicador usa barras o puntos; sus colores van automáticos.</p>`}
            <p class="ihint">Periodos: escríbelos separados por coma arriba (ej. EMA <b>20, 50, 200</b>) y cada uno sale como una línea con su color.</p></div>`:""}`}).join(""):""}
        <div class="ml">Superpuestos al precio</div>${rows.filter(r=>r[2]==="main").map(([n,t,w])=>`<button class="ir${on(n,w)?" on":""}" data-add="${n}" data-w="${w}"><span>${esc(t)}</span><em>${on(n,w)?"✓":"+"}</em></button>`).join("")}
        <div class="ml">En panel inferior</div>${rows.filter(r=>r[2]==="sub").map(([n,t,w])=>`<button class="ir${on(n,w)?" on":""}" data-add="${n}" data-w="${w}"><span>${esc(t)}</span><em>${on(n,w)?"✓":"+"}</em></button>`).join("")}`};
    const box=document.createElement("div");box.className="wmbox";ov.appendChild(box);const openSet=new Set(typeof focus==="string"?[focus]:[]);
    const draw=qs=>{box.innerHTML=render(qs);const mq=box.querySelector(".mq");mq.oninput=()=>{const p=mq.selectionStart;draw(mq.value);const m=box.querySelector(".mq");m.focus();m.setSelectionRange(p,p)};
      box.querySelector('[data-a="close"]').onclick=()=>ov.remove();
      box.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{const n=b.dataset.add,w=b.dataset.w;(w==="main"?ind.main.includes(n):ind.sub[n])?rmInd(n,w):addInd(n,w);draw(mq.value)});
      box.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{rmInd(b.dataset.rm,b.dataset.w);draw(mq.value)});
      box.querySelectorAll(".ip").forEach(i=>{i.onkeydown=e=>e.stopPropagation();i.onchange=()=>{const arr=i.value.split(/[,\s]+/).map(Number).filter(x=>isFinite(x)&&x>0);if(arr.length){setParams(i.dataset.n,i.dataset.w,arr);setTimeout(()=>draw(mq.value),30)}}});
      box.querySelectorAll("[data-cfg]").forEach(b=>b.onclick=()=>{const n=b.dataset.cfg;openSet.has(n)?openSet.delete(n):openSet.add(n);draw(mq.value)});
      box.querySelectorAll("[data-col]").forEach(i=>i.oninput=()=>{i.parentNode.style.background=i.value;setLineSt(i.dataset.n,i.dataset.w,+i.dataset.col,{c:i.value})});
      box.querySelectorAll("[data-sz]").forEach(i=>i.onchange=()=>setLineSt(i.dataset.n,i.dataset.w,+i.dataset.sz,{w:+i.value}));
      box.querySelectorAll("[data-dash]").forEach(b=>b.onclick=()=>{const k=+b.dataset.dash;setLineSt(b.dataset.n,b.dataset.w,k,{d:!lineDef(b.dataset.n,b.dataset.w,k).d});draw(mq.value)});
      box.querySelectorAll("[data-eye]").forEach(b=>b.onclick=()=>{const k=+b.dataset.eye;setLineSt(b.dataset.n,b.dataset.w,k,{h:!lineDef(b.dataset.n,b.dataset.w,k).h});draw(mq.value)})};
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
  /* regla de precios con ancho FIJO: no se agranda ni se achica al acercar/alejar (se calcula con el precio más largo del mercado) */
  let axCv=null;
  function axWidth(f){if(!ready)return"auto";const L=chart.getDataList();if(!L.length)return"auto";
    let txt;if(axisType==="percentage")txt="-888.88%";
    else{let mx=0;for(const k of L)mx=Math.max(mx,Math.abs(k.high),Math.abs(k.low));const pp=dec();
      txt=(mx*10).toLocaleString("en-US",{minimumFractionDigits:pp,maximumFractionDigits:pp}).replace(/\d/g,"8")}   /* un dígito de más, por si el precio crece */
    try{axCv=axCv||document.createElement("canvas").getContext("2d");axCv.font=`${f}px Helvetica Neue, Arial, sans-serif`;return Math.ceil(axCv.measureText(txt).width+f*.9+14)}catch(e){return"auto"}}
  let axW="auto";
  /* el tamaño de letra elegido SOLO agranda la regla de precios (precios, precio actual, etiquetas de dibujos en la regla y la cruz en la regla).
     Eje del tiempo, leyenda, textos dentro del gráfico y botones quedan siempre igual, así el diseño no se desarma. */
  function applyStyles(){const f=fz(),t={size:f},B=11,tb={size:B};axW=axWidth(f);chart.setStyles(deep(deep(themeStyles(theme==="light",theme==="eag"),extra),{yAxis:{type:axisType,tickText:t,size:axW},xAxis:{tickText:tb,size:"auto"},
    crosshair:{horizontal:{text:t},vertical:{text:tb}},indicator:{tooltip:{text:{size:B},icons:[["eye","◉","Ocultar"],["cfg","⚙","Configurar"],["del","✕","Quitar"]].map(([id,icon],k)=>({id,icon,position:"middle",marginLeft:k?2:6,marginTop:3,marginRight:k===2?6:0,marginBottom:0,
      paddingLeft:4,paddingTop:2,paddingRight:4,paddingBottom:2,size:B+2,fontFamily:"Inter,system-ui,sans-serif",color:"rgba(150,160,180,.75)",activeColor:id==="del"?"#f23645":"#e2b55c",backgroundColor:"rgba(0,0,0,0)",activeBackgroundColor:"rgba(128,128,128,.18)"}))}},overlay:{text:{size:B+1},rectText:{size:B}},
    candle:{priceMark:{last:{text:{size:f,show:false}},high:{textSize:10},low:{textSize:10}},tooltip:{showRule:"always",showType:"standard",custom:legend(),text:{size:B+1,marginLeft:10,marginTop:8,marginRight:10}}}}));
    /* gráfico de ticks: línea (cada punto es un tick) */
    if(isTk()){const lc="#2962ff";chart.setStyles({candle:{type:"area",area:{lineSize:1.6,lineColor:lc,smooth:false,value:"close",backgroundColor:[{offset:0,color:"rgba(41,98,255,0.16)"},{offset:1,color:"rgba(41,98,255,0.01)"}]},
      priceMark:{high:{show:false},low:{show:false}},tooltip:{showRule:"none"}}})}
    cdl.style.fontSize=(f-0.5)+"px";cdc.style.fontSize=Math.min(f,13)+"px";AXF=f;ensureLp();if(ready&&offR!=null&&offF!==f){offF=f;fixOffR()}offF=f;placeCdl()}
  /* decimales del precio: automático o los que elija el usuario */
  const dec=()=>{const d=o.getDecimals&&o.getDecimals();return d==null||d==="auto"?(sym.pricePrecision||3):+d};
  function applyDec(){try{chart.setPriceVolumePrecision(dec(),0)}catch(e){}}
  new ResizeObserver(()=>chart.resize()).observe(chartEl);

  /* inicio */
  paintDbar();applyStyles();
  ind.main.forEach(n=>addInd(n,"main",true));const subs=Object.keys(ind.sub);ind.sub={};subs.forEach(n=>addInd(n,"sub",true));
  loadData();

  return{chart,el:root,laser:on=>setLaser(on),laserOn:()=>laserOn,laserRemote,startTool:n=>{stopBrush();startTool(n)},stopBrush:()=>stopBrush(),startBrush:()=>startBrush(),undo,redo,renderAlerts,cancelDraw:()=>cancelDraw(),
    getSymbol:()=>sym,setSymbol(s,p){if(!s||(sym&&s.ticker===sym.ticker&&s.pricePrecision===sym.pricePrecision))return;if(sym&&s.ticker!==sym.ticker)clearHist();sym=s;if(p&&p.text)per=p;loadData();try{paintBar()}catch(e){}},
    getPeriod:()=>per,getData:()=>chart.getDataList(),getRaw:()=>RAW,
    refreshXform(){if(xfNow()!==XF||XF==="renko")loadData()},setPeriod(p){if(!p||p.text===per.text)return;const a=anchorTs();per=p;loadData(a)},
    getTheme:()=>theme,setTheme(t){theme=t;applyStyles()},
    setStyles(s){extra=s||{};applyStyles()},setDecimals(){applyDec();applyStyles()},
    refreshBar:paintBar,
    setMtfButton(show,on){const b=root.querySelector('[data-a="mtf"]');b.hidden=!show;b.classList.toggle("on",!!on)},
    setDrawingBar(v){dbar.style.display=v?"":"none"},
    reloadDrawings(){if(ready)restoreDrawings()},
    reloadData(){loadData()},
    drawings(){return sym?JSON.parse(JSON.stringify(loadD()[sym.ticker]||[])):[]},
    setGuest,importDrawings,refreshAuto(){azKey=null;refreshAuto()},
    repaint(){applyStyles()}}
};
})();
