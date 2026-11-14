/* EAG Charts · Estudio: Replay del mercado y Práctica guiada (Premium).
   Gráfico propio en canvas (velas, ejes, zoom, arrastre, pinza, dibujos) para controlar qué velas se ven y revelar el "futuro". */
(function(){
"use strict";
const C=window.EAGProCore;
let X=null; /* contexto que entrega charts-app: feed, mercados, ajustes, etc. */
const $=(s,r)=>(r||document).querySelector(s),$$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const TZ="America/Bogota";
const isTouch=()=>matchMedia("(hover:none)").matches;
const narrow=()=>innerWidth<900;
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const two=n=>String(n).padStart(2,"0");
function tparts(ts){const p=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).formatToParts(new Date(ts)).reduce((a,x)=>(a[x.type]=x.value,a),{});if(p.hour==="24")p.hour="00";return p}
const fdate=ts=>{const p=tparts(ts);return`${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`};
const fprice=(v,p)=>(+v).toLocaleString("en-US",{minimumFractionDigits:p,maximumFractionDigits:p});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ============================================================
   Gráfico del Estudio
   ============================================================ */
function SChart(host,opt){
  opt=opt||{};
  const wrap=document.createElement("div");wrap.className="sc";host.appendChild(wrap);
  const cv=document.createElement("canvas");wrap.appendChild(cv);const g=cv.getContext("2d");
  const tip=document.createElement("div");tip.className="sc-tip";tip.hidden=true;wrap.appendChild(tip);
  const S={data:[],shown:0,end:0,bw:8,prec:2,ov:[],mode:"pan",future:false,futureLabel:"",hl:null,cross:null,draft:null,fixedY:null,dirty:true,dpr:1,W:0,H:0,hideTime:false,follow:true,snapY:true};
  const SMOOTH=!!opt.smooth;let tMin=0,tMax=1,anim=false;
  /* ancho de la regla de precios según el precio más largo (para que nunca se corte) */
  let axW=70;const measureAx=()=>{if(!S.data.length)return;g.font="600 11px Inter,system-ui,sans-serif";let mx=0;const L=S.data[S.data.length-1];
    [L.high,L.low,L.close,...S.data.slice(-200).map(k=>k.high)].forEach(v=>{mx=Math.max(mx,g.measureText(fprice(v,S.prec)).width)});axW=Math.max(narrow()?52:64,Math.ceil(mx)+14)};
  const AX=()=>axW,XH=22,PADB=()=>Math.max(8,Math.round(70/S.bw));
  const plotW=()=>S.W-AX(),plotH=()=>S.H-XH;
  const xOf=i=>plotW()-(S.end-i+0.5)*S.bw;
  const iOf=x=>S.end-(plotW()-x)/S.bw+0.5;
  let yMin=0,yMax=1;
  const yOf=p=>{const h=plotH()-24;return 12+(yMax-p)/(yMax-yMin||1)*h};
  const pOf=y=>{const h=plotH()-24;return yMax-(y-12)/h*(yMax-yMin||1)};
  function resize(){const r=wrap.getBoundingClientRect();S.dpr=Math.min(3,window.devicePixelRatio||1);const w0=S.W;S.W=Math.max(50,r.width);S.H=Math.max(50,r.height);
    if(S.data.length&&!S.touched&&Math.abs(S.W-w0)>4&&S.W>120){S.needFit=true}
    cv.width=Math.round(S.W*S.dpr);cv.height=Math.round(S.H*S.dpr);cv.style.width=S.W+"px";cv.style.height=S.H+"px";if(S.needFit){S.needFit=false;fitNow()}draw()}
  const ro=new ResizeObserver(()=>resize());ro.observe(wrap);
  function clampEnd(){const pad=PADB(),minE=Math.min(S.shown-1,Math.max(5,plotW()/S.bw*0.3)),maxE=Math.max(S.shown-1+pad,0);S.end=Math.max(minE,Math.min(maxE,S.end))}
  function scale(){
    /* si estiraste la regla a mano y la vela nueva queda por fuera, vuelve a ajustarse sola (si no, las velas "desaparecen") */
    if(S.fixedY){const L=S.data[S.shown-1];if(L&&(L.high>S.fixedY[1]||L.low<S.fixedY[0]))S.fixedY=null}
    if(S.fixedY){yMin=S.fixedY[0];yMax=S.fixedY[1];return}
    const vis=plotW()/S.bw,i0=Math.max(0,Math.floor(S.end-vis)),i1=Math.min(S.shown-1,Math.ceil(S.end));let lo=Infinity,hi=-Infinity;
    for(let i=i0;i<=i1;i++){const k=S.data[i];if(!k)continue;if(k.low<lo)lo=k.low;if(k.high>hi)hi=k.high}
    for(const o of S.ov){if(o.fit===false)continue;const ps=o.type==="hline"?[o.p]:o.type==="zone"?[o.lo,o.hi]:o.type==="seg"?[o.p1,o.p2]:[];for(const p of ps){if(p<lo)lo=p;if(p>hi)hi=p}}
    if(S.draft&&S.draft.lo!=null){lo=Math.min(lo,S.draft.lo);hi=Math.max(hi,S.draft.hi)}
    if(!isFinite(lo)){lo=0;hi=1}const pad=(hi-lo)*0.08||Math.abs(hi)*0.001||1;tMin=lo-pad;tMax=hi+pad;
    /* en el replay la escala se acomoda suave (sin saltos) */
    if(SMOOTH&&!S.snapY){const k=0.18;yMin+=(tMin-yMin)*k;yMax+=(tMax-yMax)*k;if(Math.abs(tMin-yMin)+Math.abs(tMax-yMax)>(tMax-tMin)*0.002)anim=true}else{yMin=tMin;yMax=tMax;S.snapY=false}}
  function niceStep(r,n){const raw=r/n,m=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/m;return(f<1.5?1:f<3?2:f<7?5:10)*m}
  function color(v,fb){return css(v)||fb}
  function draw(){if(!S.W)return;const dpr=S.dpr;g.setTransform(dpr,0,0,dpr,0,0);
    const BG=color("--bg2","#fff"),FG=color("--fg","#111"),MUT=color("--mut","#777"),LINE=color("--line","#e5e5e5"),GOLD=color("--gold","#c9a14a");
    const UP=(X&&X.up)||"#089981",DN=(X&&X.dn)||"#f23645";
    g.fillStyle=BG;g.fillRect(0,0,S.W,S.H);if(!S.data.length)return;
    anim=false;
    if(SMOOTH&&S.follow){const tg=S.shown-1+PADB(),d=tg-S.end;if(Math.abs(d)>0.003){S.end+=d*0.2;anim=true}else S.end=tg}
    clampEnd();scale();const pw=plotW(),ph=plotH();
    /* cuadrícula y eje de precios */
    g.font="11px Inter,system-ui,sans-serif";g.textBaseline="middle";const st=niceStep(yMax-yMin,Math.max(2,Math.min(9,Math.floor(ph/48))));
    g.strokeStyle=LINE;g.lineWidth=1;g.fillStyle=MUT;
    for(let p=Math.ceil(yMin/st)*st;p<=yMax;p+=st){const y=Math.round(yOf(p))+0.5;if(y<4||y>ph-4)continue;g.beginPath();g.moveTo(0,y);g.lineTo(pw,y);g.stroke();g.fillText(fprice(p,S.prec),pw+6,y)}
    /* zona del futuro */
    const xf=xOf(S.shown-1)+S.bw/2;
    if(S.future&&xf<pw){g.fillStyle=hexA(GOLD,.07);g.fillRect(xf,0,pw-xf,ph);g.strokeStyle=hexA(GOLD,.6);g.setLineDash([5,4]);g.beginPath();g.moveTo(Math.round(xf)+.5,0);g.lineTo(Math.round(xf)+.5,ph);g.stroke();g.setLineDash([]);
      if(pw-xf>40){g.fillStyle=hexA(GOLD,.85);g.font="600 12px Inter,system-ui,sans-serif";g.textAlign="center";g.fillText(S.futureLabel||"?",xf+(pw-xf)/2,22);g.textAlign="left";g.font="11px Inter,system-ui,sans-serif"}}
    /* eje de tiempo */
    const vis=pw/S.bw,i0=Math.max(0,Math.floor(S.end-vis)-1),i1=Math.min(S.shown-1,Math.ceil(S.end)+1);
    g.fillStyle=MUT;g.textAlign="center";const every=Math.max(1,Math.round(90/S.bw));
    if(!S.hideTime)for(let i=i0;i<=i1;i++){if(i%every)continue;const k=S.data[i];if(!k)continue;const x=xOf(i);if(x<20||x>pw-20)continue;const p=tparts(k.timestamp);
      g.fillText(p.hour==="00"&&p.minute==="00"?`${p.day}/${p.month}`:`${p.hour}:${p.minute}`,x,ph+XH/2)}
    g.textAlign="left";
    g.save();g.beginPath();g.rect(0,0,pw,ph);g.clip();
    /* resaltado (pierna del zigzag, etc.) */
    for(const o of S.ov)if(o.type==="zone")drawZone(o,pw);
    /* velas */
    const bw=Math.max(1,S.bw*0.72);
    for(let i=i0;i<=i1;i++){const k=S.data[i];if(!k||!isFinite(k.high)||!isFinite(k.low))continue;const x=xOf(i),up=k.close>=k.open,c=up?UP:DN;
      g.strokeStyle=c;g.fillStyle=c;g.lineWidth=1;const xc=Math.round(x)+.5;g.beginPath();g.moveTo(xc,yOf(k.high));g.lineTo(xc,yOf(k.low));g.stroke();
      const yo=yOf(k.open),yc=yOf(k.close),top=Math.min(yo,yc),h=Math.max(1,Math.abs(yo-yc));g.fillRect(Math.round(x-bw/2),top,Math.max(1,Math.round(bw)),h)}
    for(const o of S.ov)if(o.type!=="zone")drawOv(o,pw,ph,GOLD,FG);
    if(S.draft)drawDraft(GOLD);
    g.restore();
    /* línea del último precio visible */
    const last=S.data[S.shown-1];if(last){const y=yOf(last.close),c=last.close>=last.open?UP:DN;g.strokeStyle=c;g.setLineDash([3,3]);g.beginPath();g.moveTo(0,Math.round(y)+.5);g.lineTo(pw,Math.round(y)+.5);g.stroke();g.setLineDash([]);axisLabel(y,fprice(last.close,S.prec),c,"#fff")}
    for(const o of S.ov)if(o.type==="hline"&&o.axis!==false)axisLabel(yOf(o.p),fprice(o.p,S.prec),o.color||GOLD,"#fff");
    for(const o of S.ov)if(o.type==="zone"&&o.axis){axisLabel(yOf(o.hi),fprice(o.hi,S.prec),o.color||GOLD,"#fff");axisLabel(yOf(o.lo),fprice(o.lo,S.prec),o.color||GOLD,"#fff")}
    /* cruz */
    if(S.cross&&S.cross.x<pw){const{x,y}=S.cross;g.strokeStyle=hexA(FG,.35);g.setLineDash([4,4]);g.beginPath();g.moveTo(x,0);g.lineTo(x,ph);g.moveTo(0,y);g.lineTo(pw,y);g.stroke();g.setLineDash([]);
      axisLabel(y,fprice(pOf(y),S.prec),hexA(FG,.85),BG);const i=Math.round(iOf(x)),k=S.data[i];
      if(k&&i<S.shown&&!S.hideTime){const t=fdate(k.timestamp),w=g.measureText(t).width+12;g.fillStyle=hexA(FG,.85);g.fillRect(Math.min(pw-w,Math.max(0,x-w/2)),ph+2,w,XH-4);g.fillStyle=BG;g.textAlign="center";g.fillText(t,Math.min(pw-w/2,Math.max(w/2,x)),ph+XH/2);g.textAlign="left"}}
    g.strokeStyle=LINE;g.beginPath();g.moveTo(pw+.5,0);g.lineTo(pw+.5,S.H);g.moveTo(0,ph+.5);g.lineTo(S.W,ph+.5);g.stroke();
    if(anim)req()}
  function axisLabel(y,t,bg,fg){if(y<0||y>plotH())return;const pw=plotW();g.font="600 11px Inter,system-ui,sans-serif";g.fillStyle=bg;g.fillRect(pw+1,y-9,AX()-2,18);g.fillStyle=fg;g.textBaseline="middle";g.fillText(t,pw+5,y);g.font="11px Inter,system-ui,sans-serif"}
  function drawZone(o,pw){const x1=o.i1!=null?xOf(o.i1)-S.bw/2:0,x2=o.i2!=null?xOf(o.i2)+S.bw/2:pw,y1=yOf(o.hi),y2=yOf(o.lo),c=o.color||"#b46cff";
    g.fillStyle=hexA(c,o.alpha||.14);g.fillRect(x1,y1,x2-x1,y2-y1);g.strokeStyle=c;g.lineWidth=o.w||1.2;if(o.dash)g.setLineDash(o.dash);g.strokeRect(x1+.5,y1+.5,x2-x1-1,y2-y1-1);g.setLineDash([]);
    if(o.label)tag(Math.max(x1+6,4),y1+4,o.label,c,"top")}
  function tag(x,y,t,bg,base){g.font="700 11px Inter,system-ui,sans-serif";const w=g.measureText(t).width+10;g.fillStyle=bg;rr(x,base==="top"?y:y-18,w,18,4);g.fill();g.fillStyle="#fff";g.textBaseline="middle";g.fillText(t,x+5,(base==="top"?y:y-18)+9);g.font="11px Inter,system-ui,sans-serif"}
  function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
  function drawOv(o,pw,ph,GOLD,FG){const c=o.color||GOLD;g.strokeStyle=c;g.fillStyle=c;g.lineWidth=o.w||1.6;if(o.dash)g.setLineDash(o.dash);
    if(o.type==="hline"){const y=Math.round(yOf(o.p))+.5,x1=o.i1!=null?xOf(o.i1):0;g.beginPath();g.moveTo(x1,y);g.lineTo(pw,y);g.stroke();g.setLineDash([]);if(o.label)tag(Math.max(6,x1+6),y-3,o.label,c,"bottom")}
    else if(o.type==="seg"){g.beginPath();g.moveTo(xOf(o.i1),yOf(o.p1));let x2=xOf(o.i2),y2=yOf(o.p2);if(o.ext){const dx=x2-xOf(o.i1),dy=y2-yOf(o.p1);if(Math.abs(dx)>1){const k=(pw-xOf(o.i1))/dx;x2=xOf(o.i1)+dx*k;y2=yOf(o.p1)+dy*k}}g.lineTo(x2,y2);g.stroke();g.setLineDash([]);
      if(o.label){const mx=(xOf(o.i1)+xOf(o.i2))/2,my=(yOf(o.p1)+yOf(o.p2))/2;tag(mx+6,my,o.label,c,"bottom")}}
    else if(o.type==="vline"){const x=Math.round(xOf(o.i))+.5;g.beginPath();g.moveTo(x,0);g.lineTo(x,ph);g.stroke();g.setLineDash([]);if(o.label)tag(x+4,16,o.label,c,"top")}
    else if(o.type==="mark"){const x=xOf(o.i),y=yOf(o.p),up=o.pos!=="below";const yy=up?y-10:y+10;g.beginPath();if(up){g.moveTo(x,yy+6);g.lineTo(x-6,yy-4);g.lineTo(x+6,yy-4)}else{g.moveTo(x,yy-6);g.lineTo(x-6,yy+4);g.lineTo(x+6,yy+4)}g.closePath();g.fill();
      if(o.text){g.font="700 11px Inter,system-ui,sans-serif";g.textAlign="center";g.textBaseline=up?"bottom":"top";g.fillStyle=c;g.fillText(o.text,x,up?yy-6:yy+6);g.textAlign="left";g.font="11px Inter,system-ui,sans-serif"}}
    else if(o.type==="zz"){g.beginPath();o.pts.forEach((p,k)=>{const x=xOf(p.i),y=yOf(p.p);k?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();g.setLineDash([]);
      for(const p of o.pts)if(p.lab){g.font="700 10.5px Inter,system-ui,sans-serif";g.textAlign="center";g.textBaseline=p.t==="H"?"bottom":"top";g.fillStyle=c;g.fillText(p.lab,xOf(p.i),yOf(p.p)+(p.t==="H"?-5:5));g.textAlign="left"}}
    g.setLineDash([]);g.lineWidth=1}
  function drawDraft(GOLD){const d=S.draft;if(d.type==="zone"&&d.lo!=null){drawZone({lo:d.lo,hi:d.hi,color:d.color||GOLD,alpha:.18,label:d.label},plotW())}
    if(d.type==="seg"&&d.i2!=null)drawOv({type:"seg",i1:d.i1,p1:d.p1,i2:d.i2,p2:d.p2,color:d.color||GOLD,w:2},plotW(),plotH(),GOLD)}
  function hexA(c,a){c=String(c).trim();if(c.startsWith("#")){let h=c.slice(1);if(h.length===3)h=h.split("").map(x=>x+x).join("");const n=parseInt(h.slice(0,6),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
    const m=c.match(/rgba?\(([^)]+)\)/);if(m){const p=m[1].split(",").map(x=>x.trim());return`rgba(${p[0]},${p[1]},${p[2]},${a})`}return c}
  let raf=0;const req=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;draw()})};
  /* ---------- gestos ---------- */
  const P=new Map();let drag=null,pinch=null;
  const loc=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
  cv.addEventListener("pointerdown",e=>{cv.setPointerCapture(e.pointerId);const p=loc(e);P.set(e.pointerId,p);
    if(P.size===2){const[a,b]=[...P.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),bw:S.bw,cx:(a.x+b.x)/2,end:S.end};drag=null;S.draft=null;return}
    if(p.x>plotW()){drag={kind:"yaxis",y:p.y,min:yMin,max:yMax};return}
    if(S.mode==="pan"){drag={kind:"pan",x:p.x,end:S.end,moved:false,t:Date.now()};return}
    const pr=pOf(p.y),i=Math.round(iOf(p.x));
    if(S.mode==="zone"){drag={kind:"zone",p0:pr};S.draft={type:"zone",lo:pr,hi:pr,color:opt.zoneColor};req();return}
    if(S.mode==="trend"){drag={kind:"trend"};S.draft={type:"seg",i1:i,p1:pr,i2:i,p2:pr};req();return}
    if(S.mode==="hline"||S.mode==="pick"){drag={kind:"tap",x:p.x,y:p.y}}});
  cv.addEventListener("pointermove",e=>{const p=loc(e);if(P.has(e.pointerId))P.set(e.pointerId,p);
    if(pinch&&P.size===2){const[a,b]=[...P.values()],d=Math.hypot(a.x-b.x,a.y-b.y);const nb=Math.max(1.5,Math.min(40,pinch.bw*d/pinch.d));const anchor=pinch.end-(plotW()-pinch.cx)/pinch.bw;S.bw=nb;S.end=anchor+(plotW()-pinch.cx)/nb;req();return}
    if(!drag){if(e.pointerType==="mouse"){S.cross=p.x<plotW()&&p.y<plotH()?p:null;req()}return}
    if(drag.kind==="pan"){const dx=p.x-drag.x;if(Math.abs(dx)>3){drag.moved=true;S.follow=false;S.touched=true}S.end=drag.end-dx/S.bw;if(e.pointerType==="mouse")S.cross=null;req()}
    else if(drag.kind==="yaxis"){const dy=p.y-drag.y,f=Math.exp(dy/200),mid=(drag.min+drag.max)/2,h=(drag.max-drag.min)*f/2;S.fixedY=[mid-h,mid+h];req()}
    else if(drag.kind==="zone"){const pr=pOf(p.y);S.draft.lo=Math.min(drag.p0,pr);S.draft.hi=Math.max(drag.p0,pr);tipAt(p,`${fprice(S.draft.lo,S.prec)} – ${fprice(S.draft.hi,S.prec)}`);req()}
    else if(drag.kind==="trend"){S.draft.i2=Math.round(iOf(p.x));S.draft.p2=pOf(p.y);req()}
    if(e.pointerType==="mouse"){S.cross=p.x<plotW()&&p.y<plotH()?p:null}});
  const up=e=>{const p=loc(e);P.delete(e.pointerId);if(pinch){if(P.size<2)pinch=null;return}const d=drag;drag=null;tip.hidden=true;if(!d)return;
    if(d.kind==="zone"){const z=S.draft;S.draft=null;if(z&&z.hi>z.lo&&opt.onZone)opt.onZone(z.lo,z.hi);req()}
    else if(d.kind==="trend"){const z=S.draft;S.draft=null;if(z&&(z.i2!==z.i1||Math.abs(yOf(z.p2)-yOf(z.p1))>8)&&opt.onTrend)opt.onTrend(z);req()}
    else if(d.kind==="tap"){if(Math.hypot(p.x-d.x,p.y-d.y)<12){const pr=pOf(p.y),i=Math.round(iOf(p.x));if(S.mode==="hline"&&opt.onHline)opt.onHline(pr,i);if(S.mode==="pick"&&opt.onPick)opt.onPick(pr,i)}}
    else if(d.kind==="pan"&&!d.moved&&opt.onTap)opt.onTap(pOf(p.y),Math.round(iOf(p.x)));
    if(d.kind==="pan"&&d.moved){S.follow=S.end>=S.shown-1;opt.onFollow&&opt.onFollow(S.follow)}};
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  cv.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse"&&!drag){S.cross=null;req()}});
  cv.addEventListener("dblclick",()=>{S.fixedY=null;fit();});
  cv.addEventListener("wheel",e=>{e.preventDefault();const p=loc(e);S.snapY=!SMOOTH;S.touched=true;if(e.ctrlKey||Math.abs(e.deltaY)>=Math.abs(e.deltaX)){const f=Math.exp(-e.deltaY/400),nb=Math.max(1.5,Math.min(40,S.bw*f)),anchor=iOf(p.x);S.bw=nb;S.end=anchor+(plotW()-p.x)/nb-0.5}else S.end+=e.deltaX/S.bw;req()},{passive:false});
  function tipAt(p,t){tip.textContent=t;tip.hidden=false;tip.style.left=Math.min(plotW()-140,Math.max(4,p.x+12))+"px";tip.style.top=Math.max(4,p.y-34)+"px"}
  function fitNow(){const pw=plotW();if(pw<60)return;const vis=Math.min(S.shown,narrow()?70:120);S.bw=Math.max(2,Math.min(22,(pw-64)/Math.max(20,vis)));S.end=S.shown-1+PADB();S.fixedY=null;S.follow=true;S.snapY=true}
  function fit(){fitNow();if(plotW()<60)S.needFit=true;req();opt.onFollow&&opt.onFollow(true)}
  return{
    el:wrap,
    setData(d,shown,prec){S.data=d;S.shown=Math.max(1,Math.min(d.length,shown==null?d.length:shown));if(prec!=null)S.prec=prec;S.touched=false;measureAx();resize();fit()},
    /* datos que crecen (replay): no mueve la vista si estás analizando atrás */
    setLive(d){S.data=d;S.shown=d.length;if(!SMOOTH&&S.follow)S.end=S.shown-1+PADB();req()},
    goLive(){S.follow=true;S.fixedY=null;req();opt.onFollow&&opt.onFollow(true)},get follow(){return S.follow},
    measure(){measureAx();req()},
    setShown(n,follow){const was=S.end>=S.shown-1;S.shown=Math.max(1,Math.min(S.data.length,n));if(follow!==false&&was)S.end=S.shown-1+PADB();req()},
    get shown(){return S.shown},get data(){return S.data},
    setMode(m){S.mode=m;wrap.dataset.mode=m;S.draft=null;req()},
    setOv(o){S.ov=o||[];req()},addOv(o){S.ov.push(o);req()},get ov(){return S.ov},
    setFuture(on,label){S.future=!!on;S.futureLabel=label||"";req()},
    setHideTime(h){S.hideTime=!!h;req()},
    fit,redraw:req,resize,
    destroy(){ro.disconnect();cancelAnimationFrame(raf);wrap.remove()}}
}

/* ============================================================
   Datos
   ============================================================ */
const TFS=[["1m",60],["5m",300],["15m",900],["1H",3600],["4H",14400]];
const GROUPS=[["bc","Boom/Crash"],["vol","Volatilidad"],["syn","Sintéticos (todos)"],["fx","Forex"],["all","Todos"]];
function symsOf(grp){const all=(X.syms()||[]).filter(s=>s.symbol&&!s.is_trading_suspended);
  const f={bc:s=>s.submarket==="crash_index",vol:s=>s.submarket==="random_index",syn:s=>s.market==="synthetic_index",fx:s=>s.market==="forex",all:s=>["synthetic_index","forex","cryptocurrency","commodities"].includes(s.market)}[grp]||(()=>true);
  const r=all.filter(f);return r.length?r:all}
const precOf=s=>{const v=String(s.pip||s.pip_size||0.01);return v.includes("e-")?+v.split("e-")[1]:(v.split(".")[1]||"").length};
async function candles(sym,g,o){const m=await X.feed.ask(Object.assign({ticks_history:sym,style:"candles",granularity:g},o),30000);
  /* se limpian velas incompletas y se ordenan por hora (nunca se dibuja una vela sin precio) */
  const out=(m.candles||[]).map(k=>{const t=+(k.epoch!=null?k.epoch:k.open_time),o2=+k.open,h=+k.high,l=+k.low,c=+k.close;return{timestamp:t*1000,open:o2,high:Math.max(h,o2,c),low:Math.min(l,o2,c),close:c}})
    .filter(k=>isFinite(k.timestamp)&&k.timestamp>0&&isFinite(k.open)&&isFinite(k.high)&&isFinite(k.low)&&isFinite(k.close)).sort((a,b)=>a.timestamp-b.timestamp);
  const u=[];for(const k of out)if(!u.length||k.timestamp>u[u.length-1].timestamp)u.push(k);return u}
/* velas DESPUÉS de una fecha: se pide con "end + count" (igual que el historial normal) y se recorta desde la fecha */
async function candlesAfter(sym,g,from,n){const now=Math.floor(Date.now()/1000),end=Math.min(now,from+g*n);if(end<=from)return[];
  const L=await candles(sym,g,{end,count:Math.min(5000,n+5)});return L.filter(k=>k.timestamp>from*1000)}
/* bloque al azar en el pasado: de 1 a N días atrás según la temporalidad */
async function randomBlock(sym,g,count){const now=Math.floor(Date.now()/1000),maxBack={60:25,300:120,900:300,3600:700,14400:1400}[g]||200,
  back=Math.floor((count*g)/86400)+1+Math.floor(Math.random()*maxBack),end=now-back*86400;
  return candles(sym,g,{end,count})}

/* ============================================================
   Interfaz
   ============================================================ */
let OV=null,chart=null,keyH=null,cleanup=[];
function state(){X.SAVE.pro=X.SAVE.pro||{st:{},hist:[],best:0,opt:{}};return X.SAVE.pro}
function close(){cleanup.forEach(f=>{try{f()}catch(e){}});cleanup=[];if(chart){chart.destroy();chart=null}if(OV){OV.remove();OV=null}document.documentElement.classList.remove("pro-open");if(keyH)removeEventListener("keydown",keyH,true);keyH=null}
function shell(){close();OV=document.createElement("div");OV.className="pro";document.documentElement.classList.add("pro-open");
  OV.innerHTML=`<header class="pro-h"><div class="pro-brand"><span class="pro-logo">EAG</span><b>Estudio</b><span class="pro-badge">PREMIUM</span></div>
    <nav class="pro-tabs"><button data-t="prac">🎓 Práctica</button><button data-t="replay">⏯ Replay</button></nav><button class="pro-x" title="Cerrar (Esc)" aria-label="Cerrar">×</button></header><main class="pro-m"></main>`;
  document.body.appendChild(OV);$(".pro-x",OV).onclick=close;
  $$(".pro-tabs button",OV).forEach(b=>b.onclick=()=>b.dataset.t==="prac"?pracHome():replayHome());
  keyH=e=>{if(e.key==="Escape"&&OV&&!e.defaultPrevented){const m=$(".pro-modal",OV);if(m){m.remove();e.stopPropagation();return}e.stopPropagation();e.preventDefault();close()}};addEventListener("keydown",keyH,true);
  return $(".pro-m",OV)}
function setTab(t){$$(".pro-tabs button",OV).forEach(b=>b.classList.toggle("on",b.dataset.t===t))}
function chips(name,list,cur){return`<div class="pro-chips" data-name="${name}">${list.map(([v,t])=>`<button data-v="${v}" class="${String(v)===String(cur)?"on":""}">${esc(t)}</button>`).join("")}</div>`}
function wireChips(root,onCh){$$(".pro-chips:not([data-multi])",root).forEach(c=>c.addEventListener("click",e=>{const b=e.target.closest("button[data-v]");if(!b)return;$$("button",c).forEach(x=>x.classList.toggle("on",x===b));onCh&&onCh(c.dataset.name,b.dataset.v)}))}
const chipVal=(root,n)=>{const b=$(`.pro-chips[data-name="${n}"] button.on`,root);return b?b.dataset.v:null};
function spinner(t){return`<div class="pro-load"><div class="pro-spin"></div><p>${esc(t)}</p></div>`}

/* ---------------- bloqueo premium ---------------- */
function lock(why){const m=shell();setTab("");$(".pro-tabs",OV).style.visibility="hidden";
  m.innerHTML=`<div class="pro-lock"><div class="pro-lock-i">🔒</div><h2>Estudio es exclusivo de Premium</h2>
   <p>${esc(why||"Replay del mercado y práctica guiada para entrenar tu lectura del gráfico en cualquier mercado.")}</p>
   <ul><li><b>Replay:</b> vuelve a cualquier fecha y mira el mercado vela por vela, con dibujos y operaciones simuladas.</li>
   <li><b>Práctica:</b> proyección, zonas, rompimientos e impulsos vs. retrocesos en puntos al azar de todos los mercados, con corrección al instante.</li>
   <li><b>Tu progreso:</b> aciertos por tema y racha.</li></ul>
   <div class="pro-row"><a class="pro-btn gold" href="${X.MAIN}#premium">Ver planes</a><button class="pro-btn" data-c>Ahora no</button></div></div>`;
  $("[data-c]",m).onclick=close}

/* ---------------- Práctica: inicio ---------------- */
function pracHome(){const m=shell();setTab("prac");const S=state(),o=Object.assign({topic:"proy",grp:"bc",tf:"rnd",n:10,hide:1},S.opt||{});
  const pct=t=>{const s=S.st[t];return s&&s.n?Math.round(s.ok/s.n*100)+"%":"—"};
  const tot=Object.values(S.st).reduce((a,s)=>a+(s.n||0),0),okT=Object.values(S.st).reduce((a,s)=>a+(s.ok||0),0);
  m.innerHTML=`<div class="pro-home"><section class="pro-intro"><h1>Práctica guiada</h1><p>Te llevamos a un punto al azar del pasado de un mercado. Tú lees el gráfico, respondes y te mostramos lo que pasó después, con la explicación. Todo se mide con lo que muestra el precio, no con un método en particular.</p>
     <div class="pro-kpi"><div><b>${tot}</b><span>respuestas</span></div><div><b>${tot?Math.round(okT/tot*100)+"%":"—"}</b><span>aciertos</span></div><div><b>${S.best||0}</b><span>mejor racha</span></div></div></section>
    <h3 class="pro-sub">1. ¿Qué quieres estudiar?</h3>
    <div class="pro-topics">${Object.entries(C.TOPICS).map(([k,t])=>`<button class="pro-topic${k===o.topic?" on":""}" data-k="${k}"><span class="i">${t.icon}</span><b>${t.name}</b><small>${t.desc}</small><em>${k==="mix"?"":"Aciertos: "+pct(k)}</em></button>`).join("")}</div>
    <h3 class="pro-sub">2. Mercados</h3>${chips("grp",GROUPS,o.grp)}
    <h3 class="pro-sub">3. Temporalidad</h3>${chips("tf",[["rnd","Al azar"],...TFS.map(([t])=>[t,t])],o.tf)}
    <h3 class="pro-sub">4. Preguntas</h3>${chips("n",[[5,"5"],[10,"10"],[20,"20"]],o.n)}
    <label class="pro-check"><input type="checkbox" data-hide ${o.hide?"checked":""}> Ocultar mercado y fecha hasta responder (recomendado: así no te dejas llevar por lo que ya sabes del mercado)</label>
    <div class="pro-row sticky"><button class="pro-btn gold big" data-go>Empezar práctica</button></div></div>`;
  $$(".pro-topic",m).forEach(b=>b.onclick=()=>{$$(".pro-topic",m).forEach(x=>x.classList.toggle("on",x===b))});
  wireChips(m);
  $("[data-go]",m).onclick=()=>{const opt={topic:$(".pro-topic.on",m).dataset.k,grp:chipVal(m,"grp"),tf:chipVal(m,"tf"),n:+chipVal(m,"n"),hide:$("[data-hide]",m).checked?1:0};S.opt=opt;X.save();session(opt)}}

/* ---------------- Práctica: sesión ---------------- */
function session(opt){const m=shell();setTab("prac");
  const ses={opt,i:0,score:0,ok:0,streak:0,best:0,res:[],next:null};
  m.innerHTML=`<div class="pro-ses"><div class="pro-sbar"><button class="pro-btn sm" data-back>← Salir</button><span class="pro-prog"><i></i></span><b class="pro-cnt"></b><span class="pro-sc"></span></div>
    <div class="pro-body"><div class="pro-chart"></div><aside class="pro-q"></aside></div></div>`;
  $("[data-back]",m).onclick=()=>{if(ses.i>0&&ses.res.length)finish(ses);else pracHome()};
  chart=SChart($(".pro-chart",m),{smooth:true,zoneColor:"#b46cff",onZone:(lo,hi)=>ses.cur&&ses.cur.onZone&&ses.cur.onZone(lo,hi),onPick:(p)=>ses.cur&&ses.cur.onPick&&ses.cur.onPick(p)});
  const prep=()=>prepare(opt).catch(e=>({err:e}));
  ses.next=prep();
  (async function loop(){while(ses.i<opt.n&&OV){paintTop(ses,m);const qp=ses.next;ses.next=null;
      $(".pro-q",m).innerHTML=spinner("Buscando un punto al azar en el pasado del mercado…");chart.setOv([]);
      let Q=await qp;if(!OV)return;
      if(!Q||Q.err){Q=null;for(let k=0;k<3&&!Q&&OV;k++){const r=await prep();if(r&&!r.err)Q=r}}
      if(!OV)return;
      if(!Q){$(".pro-q",m).innerHTML=`<div class="pro-err"><b>No pudimos traer datos del mercado.</b><p>Revisa tu conexión e inténtalo de nuevo.</p><button class="pro-btn gold" data-rt>Reintentar</button></div>`;
        await new Promise(r=>$("[data-rt]",m).onclick=r);ses.next=prep();continue}
      ses.next=ses.i+1<opt.n?prep():null; /* la siguiente se prepara mientras respondes */
      await ask(ses,Q,m);ses.i++}
    if(OV)finish(ses)})()}
function paintTop(ses,m){const n=ses.opt.n;$(".pro-cnt",m).textContent=`${Math.min(ses.i+1,n)} / ${n}`;$(".pro-prog i",m).style.width=(ses.i/n*100)+"%";
  $(".pro-sc",m).innerHTML=`✓ ${ses.ok} · racha ${ses.streak}`}
async function prepare(opt){const topics=["proy","romp","impr","zona"];
  for(let att=0;att<5;att++){const topic=opt.topic==="mix"?topics[Math.floor(Math.random()*topics.length)]:opt.topic;
    const L=symsOf(opt.grp),s=L[Math.floor(Math.random()*L.length)];const tf=opt.tf==="rnd"?TFS[Math.floor(Math.random()*TFS.length)]:TFS.find(x=>x[0]===opt.tf)||TFS[1];
    let c;try{c=await randomBlock(s.symbol,tf[1],640)}catch(e){continue}
    if(!c||c.length<400)continue;
    const q=C.pick(c,topic,{});if(q)return{q,c,s,tf,prec:precOf(s),topic}}
  return null}
function ask(ses,Q,m){return new Promise(done=>{const{q,c,s,tf,prec}=Q,T=C.TOPICS[q.type],hide=!!ses.opt.hide,panel=$(".pro-q",m);
  const shown=q.t+1;chart.setData(c,shown,prec);chart.setHideTime(hide);chart.setFuture(true,"¿?");chart.setMode("pan");
  const base=[];
  if(q.type==="romp")base.push({type:"hline",p:q.level.p,color:"#e2b55c",w:2,label:`${q.level.touches} toques`,i1:Math.max(0,q.level.lastI-60)});
  if(q.type==="impr"){base.push({type:"seg",i1:q.leg.a.i,p1:q.leg.a.p,i2:q.leg.b.i,p2:q.leg.b.p,color:"#e2b55c",w:4});base.push({type:"seg",i1:q.prev.a.i,p1:q.prev.a.p,i2:q.prev.b.i,p2:q.prev.b.p,color:"#8a8f98",w:2,dash:[5,4]})}
  chart.setOv(base.slice());
  const where=hide?`<span class="pro-hid">Mercado oculto · ${tf[0]}</span>`:`<span>${esc(s.display_name)} · ${tf[0]} · ${fdate(c[q.t].timestamp)}</span>`;
  let target=null,zone=null;
  const head=`<div class="pro-qh"><span class="pro-tchip">${T.icon} ${esc(T.short)}</span>${where}</div><p class="pro-qt">${esc(q.q)}</p>
    <details class="pro-how"><summary>¿Cómo se califica?</summary><p>${esc(q.hint)}</p></details>`;
  if(q.choices){panel.innerHTML=head+`<div class="pro-ch">${q.choices.map(([v,t])=>`<button class="pro-opt o-${v}" data-v="${v}">${esc(t)}</button>`).join("")}</div>`+
      (q.type==="proy"?`<button class="pro-btn sm ghost" data-tg>🎯 Marcar objetivo (opcional)</button><p class="pro-tgt" hidden></p>`:"");
    const tg=$("[data-tg]",panel);
    if(tg){tg.onclick=()=>{const on=tg.classList.toggle("on");chart.setMode(on?"pick":"pan");tg.textContent=on?"🎯 Toca el gráfico para poner tu objetivo":"🎯 Marcar objetivo (opcional)"};
      ses.cur={onPick:p=>{target=p;chart.setOv(base.concat([{type:"hline",p,color:"#1e88e5",dash:[6,4],label:"Objetivo"}]));const t=$(".pro-tgt",panel);t.hidden=false;t.textContent=`Objetivo: ${fprice(p,prec)}`;tg.classList.remove("on");tg.textContent="🎯 Cambiar objetivo";chart.setMode("pan")}}}
    $$(".pro-opt",panel).forEach(b=>b.onclick=()=>answer(b.dataset.v))}
  else{panel.innerHTML=head+`<div class="pro-zhelp">${isTouch()?"Pon el dedo en el gráfico y arrástralo hacia arriba o abajo para marcar la zona.":"Haz clic y arrastra hacia arriba o abajo en el gráfico para marcar la zona."}</div>
      <p class="pro-zv" hidden></p><div class="pro-row"><button class="pro-btn gold" data-ok disabled>Comprobar</button><button class="pro-btn" data-clr disabled>Borrar zona</button></div>`;
    chart.setMode("zone");
    ses.cur={onZone:(lo,hi)=>{const px=c[q.t].close,inside=px>=lo&&px<=hi;zone=inside?null:[lo,hi];
      chart.setOv(base.concat([{type:"zone",lo,hi,color:inside?"#f23645":"#b46cff",label:inside?"Encima del precio":"Tu zona",i1:q.t-8,axis:true}]));const v=$(".pro-zv",panel);v.hidden=false;
      v.classList.toggle("warn",inside);v.textContent=inside?"Tu zona tapa el precio actual. Márcala arriba (resistencia) o abajo (soporte) del precio.":`Tu zona: ${fprice(lo,prec)} – ${fprice(hi,prec)}`;
      $("[data-ok]",panel).disabled=inside;$("[data-clr]",panel).disabled=false}};
    $("[data-clr]",panel).onclick=()=>{zone=null;chart.setOv(base.slice());$(".pro-zv",panel).hidden=true;$("[data-ok]",panel).disabled=true;$("[data-clr]",panel).disabled=true};
    $("[data-ok]",panel).onclick=()=>zone&&answer(null)}
  async function answer(v){ses.cur=null;chart.setMode("pan");$$("button",panel).forEach(b=>b.disabled=true);
    if(v)$$(".pro-opt",panel).forEach(b=>b.classList.toggle("pick",b.dataset.v===v));
    const ex={prec,target};
    if(q.type==="zona"){ex.zr=C.evalZona(c,q.A,q.t,q.K,zone[0],zone[1]);ex.auto=(q.auto||[]).map(z=>({z,r:C.evalZona(c,q.A,q.t,q.K,z.lo,z.hi)}))}
    const fb=C.feedback(q,c,v,ex);
    /* revelar el futuro vela por vela */
    chart.setFuture(false);chart.goLive();const end=Math.min(c.length,q.t+1+q.K),tot=end-(q.t+1),dur=Math.min(4200,1400+tot*80);
    /* el futuro se revela vela por vela, cada vela formándose (apertura → extremos → cierre) */
    await new Promise(res=>{const t0=performance.now();const fr=now=>{if(!OV)return res();const x=Math.min(1,(now-t0)/dur)*tot,n=Math.floor(x),f=x-n;
      const V=c.slice(0,q.t+1+n);if(f>0&&q.t+1+n<end)V.push(partialOf(c[q.t+1+n],f));chart.setLive(V);if(x>=tot)return res();requestAnimationFrame(fr)};requestAnimationFrame(fr)});
    if(!OV)return done();chart.setLive(c.slice(0,end));chart.setHideTime(false);
    /* dibujar la explicación */
    const ov=base.slice();ov.push({type:"vline",i:q.t,color:"#e2b55c",dash:[5,4],label:"Pregunta"});
    if(q.type==="proy"){ov.push({type:"seg",i1:q.t,p1:c[q.t].close,i2:q.t+q.K,p2:c[q.t+q.K].close,color:q.ans==="up"?"#089981":q.ans==="dn"?"#f23645":"#8a8f98",w:2.5,label:(q.mv>=0?"+":"")+fprice(q.mv,prec)});if(target!=null)ov.push({type:"hline",p:target,color:"#1e88e5",dash:[6,4],label:"Objetivo"})}
    if(q.type==="romp"&&q.bi>0)ov.push({type:"mark",i:q.bi,p:q.ans==="rompe"?(q.side==="res"?c[q.bi].high:c[q.bi].low):(q.side==="res"?c[q.bi].low:c[q.bi].high),pos:(q.ans==="rompe")===(q.side==="res")?"above":"below",color:q.ans==="rompe"?"#e2b55c":"#1e88e5",text:q.ans==="rompe"?"Rompe":"Rebota"});
    if(q.type==="impr"){const lab=(p,k,arr)=>{const prevSame=arr.slice(0,k).filter(x=>x.t===p.t).pop();return prevSame?(p.t==="H"?(p.p>prevSame.p?"HH":"LH"):(p.p>prevSame.p?"HL":"LL")):""};
      ov.push({type:"zz",pts:q.pts.map((p,k,a)=>Object.assign({lab:lab(p,k,a)},p)),color:"#7e57c2",w:1.6})}
    if(q.type==="zona"){const r=ex.zr;ov.push({type:"zone",lo:r.lo,hi:r.hi,color:r.score>=1?"#089981":r.score>0?"#e2b55c":"#f23645",label:"Tu zona",i1:q.t-8,axis:true});
      (ex.auto||[]).forEach(({z,r})=>ov.push({type:"zone",lo:z.lo-q.A[q.t]*0.15,hi:z.hi+q.A[q.t]*0.15,color:"#1e88e5",alpha:.06,dash:[4,4],label:r.res==="reacciono"?"✓ zona previa":"zona previa",fit:false}))}
    chart.setOv(ov);
    /* puntaje y estadísticas */
    const S=state(),st=S.st[q.type]=S.st[q.type]||{n:0,ok:0};st.n++;if(fb.ok)st.ok++;
    ses.res.push({type:q.type,ok:fb.ok,score:fb.score});ses.score+=fb.score;if(fb.ok){ses.ok++;ses.streak++;ses.best=Math.max(ses.best,ses.streak);S.best=Math.max(S.best||0,ses.streak)}else ses.streak=0;X.save();paintTop(ses,m);
    const yours=v?q.choices.find(x=>x[0]===v):null,right=q.choices?q.choices.find(x=>x[0]===q.ans):null;
    panel.innerHTML=`<div class="pro-fb ${fb.ok?"ok":fb.score>0?"mid":"bad"}"><div class="pro-fbh"><span>${fb.ok?"✓":fb.score>0?"≈":"✗"}</span><b>${esc(fb.title)}</b></div>
      ${yours?`<p class="pro-yr">Tu respuesta: <b>${esc(yours[1])}</b>${right&&!fb.ok?` · Correcta: <b>${esc(right[1])}</b>`:""}</p>`:""}
      <ul>${fb.lines.map(l=>`<li>${esc(l)}</li>`).join("")}</ul><div class="pro-lesson"><b>Para aprender</b><p>${esc(fb.lesson)}</p></div>
      <p class="pro-src">${esc(s.display_name)} · ${tf[0]} · ${fdate(c[q.t].timestamp)} (hora Colombia)</p>
      <div class="pro-row"><button class="pro-btn gold" data-nx>${ses.i+1>=ses.opt.n?"Ver resultados":"Siguiente →"}</button></div></div>`;
    const nx=$("[data-nx]",panel);nx.onclick=()=>done();if(!isTouch())nx.focus()}
})}
function finish(ses){const m=$(".pro-m",OV);if(!m)return;const n=ses.res.length,pct=n?Math.round(ses.ok/n*100):0,S=state();
  S.hist=(S.hist||[]).concat([{d:Date.now(),topic:ses.opt.topic,n,ok:ses.ok}]).slice(-30);X.save();
  const by={};ses.res.forEach(r=>{const b=by[r.type]=by[r.type]||{n:0,ok:0};b.n++;if(r.ok)b.ok++});
  const msg=pct>=80?"¡Excelente lectura del gráfico!":pct>=60?"Muy bien, vas por buen camino.":pct>=40?"Bien. Repasa las explicaciones y vuelve a intentarlo.":"Sigue practicando: cada explicación te enseña algo nuevo.";
  if(chart){chart.destroy();chart=null}
  m.innerHTML=`<div class="pro-end"><div class="pro-ring" style="--p:${pct}"><b>${pct}%</b><span>${ses.ok} de ${n}</span></div><h2>${msg}</h2>
    <div class="pro-bk">${Object.entries(by).map(([k,b])=>`<div><span>${C.TOPICS[k].icon} ${esc(C.TOPICS[k].short)}</span><b>${b.ok}/${b.n}</b></div>`).join("")}<div><span>🔥 Mejor racha</span><b>${ses.best}</b></div></div>
    <div class="pro-row"><button class="pro-btn gold" data-again>Otra ronda</button><button class="pro-btn" data-home>Cambiar tema</button></div></div>`;
  $("[data-again]",m).onclick=()=>session(ses.opt);$("[data-home]",m).onclick=pracHome}

/* ============================================================
   Replay
   ============================================================ */
function replayHome(){const m=shell();setTab("replay");const S=state(),cur=X.cur()||{};
  const o=Object.assign({sym:cur.sym||"BOOM1000",tfs:[TFS.find(t=>t[0]===cur.tf)?cur.tf:"5m"],start:"rnd",hide:0},S.ropt||{});if(!Array.isArray(o.tfs)||!o.tfs.length)o.tfs=[o.tf||"5m"];
  const all=symsOf("all").slice().sort((a,b)=>String(a.display_name).localeCompare(String(b.display_name)));
  const dflt=new Date(Date.now()-7*86400000),p=tparts(dflt.getTime());
  m.innerHTML=`<div class="pro-home"><section class="pro-intro"><h1>Replay del mercado</h1><p>Vuelve a un momento del pasado y mira el mercado formarse vela por vela, como si fuera en vivo, en varias temporalidades a la vez. Pausa cuando quieras, analiza cada temporalidad, dibuja tus zonas y haz operaciones simuladas.</p></section>
    <h3 class="pro-sub">Mercado</h3><select class="pro-sel" data-sym>${all.map(s=>`<option value="${esc(s.symbol)}"${s.symbol===o.sym?" selected":""}>${esc(s.display_name)}</option>`).join("")}</select>
    <h3 class="pro-sub">Temporalidades <small class="pro-hint">(hasta 3, avanzan juntas)</small></h3><div class="pro-chips" data-multi="tfs">${TFS.map(([t])=>`<button data-v="${t}" class="${o.tfs.includes(t)?"on":""}">${t}</button>`).join("")}</div>
    <h3 class="pro-sub">¿Desde cuándo?</h3>${chips("start",[["rnd","Fecha al azar"],["date","Elegir fecha"]],o.start)}
    <input class="pro-sel" type="datetime-local" data-date value="${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}" ${o.start==="date"?"":"hidden"}>
    <label class="pro-check"><input type="checkbox" data-hide ${o.hide?"checked":""}> Ocultar la fecha mientras avanza (para no saber qué pasó ese día)</label>
    <div class="pro-row sticky"><button class="pro-btn gold big" data-go>Empezar replay</button></div></div>`;
  wireChips(m,(n,v)=>{if(n==="start")$("[data-date]",m).hidden=v!=="date"});
  const mc=$('[data-multi="tfs"]',m);mc.addEventListener("click",e=>{const b=e.target.closest("button[data-v]");if(!b)return;const on=$$("button.on",mc);
    if(b.classList.contains("on")){if(on.length>1)b.classList.remove("on")}else{if(on.length>=3){X.toast("Máximo 3 temporalidades");return}b.classList.add("on")}});
  $("[data-go]",m).onclick=()=>{const tfs=$$("button.on",mc).map(b=>b.dataset.v);const ro={sym:$("[data-sym]",m).value,tfs,start:chipVal(m,"start"),hide:$("[data-hide]",m).checked?1:0};S.ropt=ro;X.save();
    let at=null;if(ro.start==="date"){const v=$("[data-date]",m).value;if(!v)return;at=Date.parse(v+":00-05:00");if(!isFinite(at)||at>Date.now()-86400e3){X.toast("Elige una fecha de al menos ayer");return}}
    replay(ro,at)}}

/* ---------- motor del replay ----------
   Se avanza con velas de una temporalidad menor (la "base") y con ellas se arman las velas de cada temporalidad elegida.
   Dentro de cada vela base el precio recorre apertura → extremo → otro extremo → cierre, así las velas se forman suaves. */
const bucket=(ts,g)=>Math.floor(ts/(g*1000))*g*1000;
function partialOf(k,f){if(f<=0)return null;if(f>=1)return k;const o=k.open,c=k.close,path=c>=o?[o,k.low,k.high,c]:[o,k.high,k.low,c];
  let L=0;for(let i=1;i<4;i++)L+=Math.abs(path[i]-path[i-1]);let d=f*L,x=o,hi=o,lo=o;
  for(let i=1;i<4;i++){const a=path[i-1],b=path[i],seg=Math.abs(b-a);if(d>=seg){x=b;d-=seg}else{x=a+(b-a)*(seg?d/seg:0);d=0}hi=Math.max(hi,x);lo=Math.min(lo,x);if(d<=0)break}
  return{timestamp:k.timestamp,open:o,high:hi,low:lo,close:x}}
const mergeK=(a,b)=>({timestamp:a.timestamp,open:a.open,high:Math.max(a.high,b.high),low:Math.min(a.low,b.low),close:b.close});
async function replay(ro,at){const m=shell();setTab("replay");
  const tfs=(ro.tfs||["5m"]).map(t=>TFS.find(x=>x[0]===t)).filter(Boolean).sort((a,b)=>a[1]-b[1]).slice(0,3);if(!tfs.length)tfs.push(TFS[1]);
  const gmin=tfs[0][1],gmax=tfs[tfs.length-1][1];
  /* vela base: una temporalidad menor que la más pequeña elegida (velas más suaves); si eliges 1m, la base es 1m */
  const base=[60,300,900,3600].filter(b=>b<gmin&&gmin%b===0).pop()||gmin;
  const sym=(X.syms()||[]).find(s=>s.symbol===ro.sym)||{symbol:ro.sym,display_name:ro.sym},prec=precOf(sym);
  m.innerHTML=spinner("Cargando el mercado en "+tfs.map(t=>t[0]).join(", ")+"…");
  let start=at?Math.floor(at/1000):null;const now=Math.floor(Date.now()/1000);
  if(!start){const maxBack={60:25,300:120,900:300,3600:700,14400:1400}[gmin]||200;start=now-(2+Math.floor(Math.random()*maxBack))*86400}
  start=Math.floor(start/gmax)*gmax; /* arranca justo cuando cierra la vela más grande */
  let H=[],B=[];
  try{H=await Promise.all(tfs.map(([,g])=>candles(sym.symbol,g,{end:start-1,count:300}).then(L=>L.filter(k=>k.timestamp+g*1000<=start*1000))));
    B=(await candlesAfter(sym.symbol,base,start-1,2000)).filter(k=>k.timestamp>=start*1000)}
  catch(e){if(!OV)return;m.innerHTML=`<div class="pro-err"><b>No se pudieron traer los datos.</b><p>${esc(e.message||"")}</p><button class="pro-btn gold" data-b>Volver</button></div>`;$("[data-b]",m).onclick=replayHome;return}
  if(!OV)return;
  if(H.some(h=>h.length<20)||B.length<10){m.innerHTML=`<div class="pro-err"><b>No hay suficientes datos en esa fecha.</b><p>Prueba otra fecha u otro mercado (forex no tiene datos los fines de semana).</p><button class="pro-btn gold" data-b>Volver</button></div>`;$("[data-b]",m).onclick=replayHome;return}
  const R={j:0,f:0,play:false,mult:1,done:false,loading:false,shared:[],trend:tfs.map(()=>[]),undo:[],trades:[],open:null,act:0};
  const T=tfs.map(([lab,g],k)=>({lab,g,D:H[k].slice(),nHist:H[k].length,chart:null,V:null}));
  const tool={v:"pan"};
  const n=tfs.length,mob=narrow();
  m.innerHTML=`<div class="pro-ses pro-rp"><div class="pro-sbar"><button class="pro-btn sm" data-back>← Salir</button>
      <span class="pro-rinfo"><b>${esc(sym.display_name)}</b> · <span data-when></span></span>
      <div class="pro-tools">${[["pan","✋","Mover"],["hline","─","Horizontal"],["zone","▭","Zona"],["trend","╱","Tendencia"]].map(([k,i,t])=>`<button data-tool="${k}" title="${t}" class="${k==="pan"?"on":""}">${i}<span>${t}</span></button>`).join("")}<button data-undo title="Deshacer último dibujo">↶</button><button data-clr title="Borrar dibujos">✕</button></div></div>
    ${mob&&n>2?`<div class="pro-tftabs">${tfs.map(([t],k)=>`<button data-tt="${k}" class="${k?"":"on"}">${t}</button>`).join("")}</div>`:""}
    <div class="pro-body"><div class="pro-grid g${n}${mob&&n>2?" tabs":""}">${tfs.map(([t],k)=>`<div class="pro-pane${k?"":" on"}" data-p="${k}"><div class="pro-ph"><b>${t}</b><span data-ohlc></span><button class="pro-live" data-live hidden title="Volver a la vela actual">⟶ En vivo</button></div><div class="pro-chart"></div></div>`).join("")}</div>
      <aside class="pro-q pro-trade">
      <div class="pro-pl"><span>Operación abierta</span><b data-pl>—</b></div>
      <div class="pro-row tr"><button class="pro-btn buy" data-buy>Comprar</button><button class="pro-btn sell" data-sell>Vender</button></div><button class="pro-btn" data-closeop disabled>Cerrar operación</button>
      <div class="pro-sum"><div><span>Operaciones</span><b data-n>0</b></div><div><span>Ganadas</span><b data-w>0%</b></div><div><span>Puntos</span><b data-pts>0</b></div></div><ol class="pro-log" data-log></ol></aside></div>
    <div class="pro-ctl"><button data-prev title="Vela anterior (←)">⏮</button><button class="play" data-play title="Reproducir / pausar (espacio)">▶</button><button data-next title="Siguiente vela (→)">⏭</button>
      <div class="pro-spd">${[[0.5,"½×"],[1,"1×"],[2,"2×"],[5,"5×"],[10,"10×"],[25,"25×"]].map(([v,t])=>`<button data-spd="${v}" class="${v===1?"on":""}">${t}</button>`).join("")}</div>
      <span class="pro-spdl">velas de ${tfs[0][0]} por segundo</span></div></div>`;
  /* ---------- gráficos ---------- */
  T.forEach((t,k)=>{const host=$(`.pro-pane[data-p="${k}"] .pro-chart`,m);
    t.chart=SChart(host,{smooth:true,zoneColor:"#e2b55c",
      onFollow:f=>{$(`.pro-pane[data-p="${k}"] [data-live]`,m).hidden=f},
      onHline:p=>addDraw({kind:"s",o:{type:"hline",p,color:"#e2b55c",w:1.6,axis:true}}),
      onZone:(lo,hi)=>addDraw({kind:"s",o:{type:"zone",lo,hi,color:"#b46cff",axis:true}}),
      onTrend:z=>addDraw({kind:"t",k,o:{type:"seg",i1:z.i1,p1:z.p1,i2:z.i2,p2:z.p2,color:"#1e88e5",w:2,ext:true}})});
    t.chart.setData(t.D,t.D.length,prec);t.chart.setHideTime(!!ro.hide);t.chart.setMode(tool.v);
    $(`.pro-pane[data-p="${k}"]`,m).addEventListener("pointerdown",()=>{R.act=k;$$(".pro-pane",m).forEach(x=>x.classList.toggle("act",x.dataset.p==k))},true);
    $(`.pro-pane[data-p="${k}"] [data-live]`,m).onclick=()=>t.chart.goLive()});
  $$("[data-tt]",m).forEach(b=>b.onclick=()=>{$$("[data-tt]",m).forEach(x=>x.classList.toggle("on",x===b));$$(".pro-pane",m).forEach(x=>x.classList.toggle("on",x.dataset.p===b.dataset.tt));T[+b.dataset.tt].chart.resize()});
  function addDraw(d){R.undo.push(d);if(d.kind==="s")R.shared.push(d.o);else R.trend[d.k].push(d.o);paintOv()}
  /* ---------- armar velas ---------- */
  function commit(t,k){const b=bucket(k.timestamp,t.g),L=t.D[t.D.length-1];if(t.D.length>t.nHist&&L&&L.timestamp===b)t.D[t.D.length-1]=mergeK(L,k);else t.D.push({timestamp:b,open:k.open,high:k.high,low:k.low,close:k.close})}
  function rebuild(){T.forEach(t=>{t.D=H[T.indexOf(t)].slice();for(let i=0;i<R.j;i++)commit(t,B[i])})}
  function view(){const pk=R.j<B.length?partialOf(B[R.j],R.f):null;
    T.forEach(t=>{let V=t.D;if(pk){const b=bucket(pk.timestamp,t.g),L=t.D[t.D.length-1];
        if(t.D.length>t.nHist&&L&&L.timestamp===b){V=t.D.slice();V[V.length-1]=mergeK(L,pk)}else{V=t.D.slice();V.push({timestamp:b,open:pk.open,high:pk.high,low:pk.low,close:pk.close})}}
      t.V=V;t.chart.setLive(V);const c=V[V.length-1];if(c)$(`.pro-pane[data-p="${T.indexOf(t)}"] [data-ohlc]`,m).innerHTML=`A <i>${fprice(c.open,prec)}</i> M <i>${fprice(c.high,prec)}</i> m <i>${fprice(c.low,prec)}</i> C <i class="${c.close>=c.open?"up":"dn"}">${fprice(c.close,prec)}</i>`});
    paintInfo();paintOv()}
  const curPrice=()=>{const pk=R.j<B.length?partialOf(B[R.j],R.f):null;return pk?pk.close:(R.j?B[R.j-1].close:H[0][H[0].length-1].close)};
  const curTime=()=>R.j<B.length?B[R.j].timestamp+R.f*base*1000:(B.length?B[B.length-1].timestamp+base*1000:start*1000);
  const idxAt=(V,ts)=>{let lo=0,hi=V.length-1;while(lo<hi){const md=(lo+hi+1)>>1;if(V[md].timestamp<=ts)lo=md;else hi=md-1}return lo};
  function paintOv(){T.forEach((t,k)=>{if(!t.V)return;const ov=R.shared.slice().concat(R.trend[k]);
    if(R.open)ov.push({type:"hline",p:R.open.p,color:R.open.d>0?"#089981":"#f23645",dash:[6,4],label:(R.open.d>0?"Compra ":"Venta ")+fprice(R.open.p,prec),fit:false});
    R.trades.slice(-12).forEach(tr=>{const i0=idxAt(t.V,tr.t0),i1=idxAt(t.V,tr.t1);ov.push({type:"mark",i:i0,p:tr.p0,pos:tr.d>0?"below":"above",color:tr.d>0?"#089981":"#f23645"});ov.push({type:"seg",i1:i0,p1:tr.p0,i2:i1,p2:tr.p1,color:tr.pts>=0?"#089981":"#f23645",w:1.4,dash:[4,3],fit:false})});
    if(R.open)ov.push({type:"mark",i:idxAt(t.V,R.open.t),p:R.open.p,pos:R.open.d>0?"below":"above",color:R.open.d>0?"#089981":"#f23645"});
    t.chart.setOv(ov)})}
  function paintInfo(){$("[data-when]",m).textContent=ro.hide?"fecha oculta":fdate(curTime());
    const px=curPrice(),pl=$("[data-pl]",m);
    if(R.open){const v=(px-R.open.p)*R.open.d;pl.textContent=(v>=0?"+":"")+fprice(v,prec)+" pts";pl.className=v>=0?"up":"dn"}else{pl.textContent="—";pl.className=""}
    $("[data-closeop]",m).disabled=!R.open;$("[data-buy]",m).disabled=$("[data-sell]",m).disabled=!!R.open;
    const nT=R.trades.length,w=R.trades.filter(t=>t.pts>0).length,pts=R.trades.reduce((a,t)=>a+t.pts,0);$("[data-n]",m).textContent=nT;$("[data-w]",m).textContent=nT?Math.round(w/nT*100)+"%":"0%";
    const P=$("[data-pts]",m);P.textContent=(pts>=0?"+":"")+fprice(pts,prec);P.className=pts>=0?"up":"dn"}
  async function more(){if(R.loading||R.done)return;R.loading=true;try{const last=B[B.length-1],from=Math.floor(last.timestamp/1000);
      if(from>=Math.floor(Date.now()/1000)-base){R.done=true;return}const add=(await candlesAfter(sym.symbol,base,from,2000)).filter(k=>k.timestamp>last.timestamp);if(!add.length)R.done=true;else B.push(...add)}catch(e){}finally{R.loading=false}}
  /* ---------- reproducción ---------- */
  const perSmall=gmin/base; /* velas base por cada vela de la temporalidad menor */
  let raf=0,lastT=0;
  function frame(ts){raf=0;if(!OV||!R.play)return;const dt=lastT?Math.min(0.25,(ts-lastT)/1000):0;lastT=ts;
    R.f+=dt*R.mult*perSmall;let ch=false;
    while(R.f>=1){if(R.j>=B.length){R.f=0;break}T.forEach(t=>commit(t,B[R.j]));R.j++;R.f-=1;ch=true}
    if(B.length-R.j<300)more();
    if(R.j>=B.length){R.f=0;if(R.done&&!R.loading){setPlay(false);X.toast("Llegaste al presente: no hay más velas.");view();return}}
    view();raf=requestAnimationFrame(frame)}
  function setPlay(on){R.play=on;const b=$("[data-play]",m);b.textContent=on?"⏸":"▶";b.classList.toggle("on",on);if(on){lastT=0;if(!raf)raf=requestAnimationFrame(frame)}else if(raf){cancelAnimationFrame(raf);raf=0}}
  cleanup.push(()=>{if(raf)cancelAnimationFrame(raf);raf=0;R.play=false});
  /* avanzar/retroceder una vela completa de la temporalidad menor */
  function stepSmall(d){setPlay(false);const g=gmin;
    if(d>0){if(R.f>0){T.forEach(t=>commit(t,B[R.j]));R.j++;R.f=0}const cur=R.j<B.length?bucket(B[R.j].timestamp,g):null;if(cur==null){more();return}
      while(R.j<B.length&&bucket(B[R.j].timestamp,g)===cur){T.forEach(t=>commit(t,B[R.j]));R.j++}if(B.length-R.j<300)more()}
    else{R.f=0;if(R.j<=0)return;const prevB=bucket(B[R.j-1].timestamp,g);while(R.j>0&&bucket(B[R.j-1].timestamp,g)===prevB)R.j--;rebuild()}
    view()}
  $("[data-play]",m).onclick=()=>setPlay(!R.play);$("[data-next]",m).onclick=()=>stepSmall(1);$("[data-prev]",m).onclick=()=>stepSmall(-1);
  $$("[data-spd]",m).forEach(b=>b.onclick=()=>{R.mult=+b.dataset.spd;$$("[data-spd]",m).forEach(x=>x.classList.toggle("on",x===b))});
  $$("[data-tool]",m).forEach(b=>b.onclick=()=>{tool.v=b.dataset.tool;$$("[data-tool]",m).forEach(x=>x.classList.toggle("on",x===b));T.forEach(t=>t.chart.setMode(tool.v))});
  $("[data-undo]",m).onclick=()=>{const d=R.undo.pop();if(!d)return;if(d.kind==="s")R.shared.splice(R.shared.lastIndexOf(d.o),1);else R.trend[d.k].splice(R.trend[d.k].lastIndexOf(d.o),1);paintOv()};
  $("[data-clr]",m).onclick=()=>{R.shared=[];R.trend=tfs.map(()=>[]);R.undo=[];paintOv()};
  const openT=d=>{R.open={d,p:curPrice(),t:curTime()};paintOv();paintInfo()};
  $("[data-buy]",m).onclick=()=>openT(1);$("[data-sell]",m).onclick=()=>openT(-1);
  $("[data-closeop]",m).onclick=()=>{if(!R.open)return;const px=curPrice(),t={d:R.open.d,p0:R.open.p,t0:R.open.t,p1:px,t1:curTime(),pts:(px-R.open.p)*R.open.d};R.trades.push(t);R.open=null;
    const li=document.createElement("li");li.innerHTML=`<span>${t.d>0?"Compra":"Venta"}</span><b class="${t.pts>=0?"up":"dn"}">${t.pts>=0?"+":""}${fprice(t.pts,prec)}</b>`;$("[data-log]",m).prepend(li);paintOv();paintInfo()};
  $("[data-back]",m).onclick=()=>{setPlay(false);replayHome()};
  keyH&&removeEventListener("keydown",keyH,true);
  const kh=e=>{if(!OV)return;const t=e.target;if(t&&/INPUT|TEXTAREA|SELECT/.test(t.tagName))return;
    if(e.key===" "){e.preventDefault();e.stopPropagation();setPlay(!R.play)}else if(e.key==="ArrowRight"){e.preventDefault();e.stopPropagation();stepSmall(1)}else if(e.key==="ArrowLeft"){e.preventDefault();e.stopPropagation();stepSmall(-1)}
    else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close()}};
  keyH=kh;addEventListener("keydown",kh,true);
  T.forEach(t=>t.chart.measure());view()}

/* ============================================================
   API pública
   ============================================================ */
window.EAGPro={
  init(ctx){X=ctx},
  open(mode){if(!X)return;const a=X.access();if(!a.ok)return lock(a.why);mode==="replay"?replayHome():pracHome()},
  close,_SChart:SChart};
})();
