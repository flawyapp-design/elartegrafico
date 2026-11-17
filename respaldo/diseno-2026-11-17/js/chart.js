/* © El Arte Gráfico. Todos los derechos reservados. Prohibida su copia o distribución sin autorización. */
/* El Arte Gráfico — motor de gráficas en canvas (sin librerías), con manejo tipo TradingView:
   - arrastrar el gráfico mueve tiempo y precio
   - arrastrar el eje de precios (derecha) estira/encoge el precio; doble clic en el eje o botón "A" = escala automática
   - arrastrar el eje de tiempo (abajo) o la rueda acerca/aleja; dos dedos en el celular también
   - líneas arrastrables (para ajustar zona y stop loss) */
(function(){
"use strict";
function makeChart(el){
  const cv=document.createElement("canvas");cv.style.cssText="position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair";el.appendChild(cv);
  const autoBtn=document.createElement("button");autoBtn.type="button";autoBtn.className="c-auto on";autoBtn.textContent="A";autoBtn.title="Escala automática del precio";el.appendChild(autoBtn);
  const ctx=cv.getContext("2d");
  const st={d:[],from:0,to:100,lines:[],marks:[],dec:2,hy:null,hx:null,click:null,W:0,H:0,badge:null,auto:true,yLo:0,yHi:1,drawCb:null,lineCb:null,hoverLine:null};
  const AX=78,BX=24,PT=12;
  const col={bg:"#071026",grid:"rgba(43,66,130,.28)",txt:"#93a1c4",up:"#35c4a2",dn:"#ec5b52",cross:"rgba(216,176,98,.55)"};
  function fit(){const r=el.getBoundingClientRect(),dpr=window.devicePixelRatio||1;st.W=Math.max(50,r.width);st.H=Math.max(50,r.height);cv.width=st.W*dpr;cv.height=st.H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
  const ro=new ResizeObserver(fit);ro.observe(el);
  function vis(){const n=st.d.length;return[Math.max(0,Math.floor(st.from)),Math.min(n-1,Math.ceil(st.to))]}
  function autoScale(){const[a,b]=vis();let lo=Infinity,hi=-Infinity;for(let i=a;i<=b;i++){const x=st.d[i];if(!x)continue;if(x.low<lo)lo=x.low;if(x.high>hi)hi=x.high}
    st.lines.forEach(l=>{if(l.fit===false)return;if(l.price<lo)lo=l.price;if(l.price>hi)hi=l.price});
    if(!isFinite(lo)){lo=0;hi=1}const pad=(hi-lo)*0.08||1;return{lo:lo-pad,hi:hi+pad}}
  function scale(){return st.auto?autoScale():{lo:st.yLo,hi:st.yHi}}
  function setAuto(on){st.auto=on;autoBtn.classList.toggle("on",on);req()}
  function toManual(){if(st.auto){const s=autoScale();st.yLo=s.lo;st.yHi=s.hi;setAuto(false)}}
  const pw=()=>st.W-AX, ph=()=>st.H-BX-PT;
  const xOf=i=>(i-st.from+0.5)*pw()/(st.to-st.from);
  const yOf=(p,sc)=>PT+(sc.hi-p)/(sc.hi-sc.lo)*ph();
  const pOf=(y,sc)=>sc.hi-(y-PT)/ph()*(sc.hi-sc.lo);
  function nice(span){const e=Math.pow(10,Math.floor(Math.log10(span/5)));const f=span/5/e;return(f<1.5?1:f<3?2:f<7?5:10)*e}
  const fmtTime=t=>{const d=new Date(t*1000).toISOString();return d.slice(8,10)+"/"+d.slice(5,7)+" "+d.slice(11,16)};
  function label(y,txt,bg,fg){ctx.font="600 11px IBM Plex Mono, monospace";ctx.fillStyle=bg;ctx.fillRect(st.W-AX+3,y-9,AX-6,18);ctx.fillStyle=fg;ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText(txt,st.W-AX+7,y)}
  function draw(){
    const W=st.W,H=st.H;if(!W)return;ctx.fillStyle=col.bg;ctx.fillRect(0,0,W,H);if(!st.d.length){st.drawCb&&st.drawCb();return}
    const sc=scale(),[a,b]=vis(),PW=pw();
    const step=nice(sc.hi-sc.lo);ctx.font="11px IBM Plex Mono, monospace";ctx.textBaseline="middle";ctx.textAlign="left";
    for(let p=Math.ceil(sc.lo/step)*step;p<=sc.hi;p+=step){const y=yOf(p,sc);if(y<PT-2||y>PT+ph()+2)continue;ctx.strokeStyle=col.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(PW,y+.5);ctx.stroke();ctx.fillStyle=col.txt;ctx.fillText(p.toFixed(st.dec),PW+7,y)}
    const bw=PW/(st.to-st.from);const every=Math.max(1,Math.ceil(90/bw));ctx.textAlign="center";ctx.textBaseline="top";
    for(let i=a;i<=b;i++){if(i%every)continue;const x=xOf(i);if(x<24||x>PW-24)continue;ctx.strokeStyle=col.grid;ctx.beginPath();ctx.moveTo(x+.5,PT);ctx.lineTo(x+.5,PT+ph());ctx.stroke();ctx.fillStyle=col.txt;ctx.fillText(fmtTime(st.d[i].time),x,H-BX+6)}
    ctx.save();ctx.beginPath();ctx.rect(0,0,PW,H-BX);ctx.clip();
    const cw=Math.max(1,Math.min(14,bw*0.7));
    for(let i=a;i<=b;i++){const k=st.d[i],x=xOf(i),up=k.close>=k.open;ctx.fillStyle=ctx.strokeStyle=up?col.up:col.dn;
      ctx.beginPath();ctx.moveTo(Math.round(x)+.5,yOf(k.high,sc));ctx.lineTo(Math.round(x)+.5,yOf(k.low,sc));ctx.lineWidth=1;ctx.stroke();
      const y1=yOf(Math.max(k.open,k.close),sc),y2=yOf(Math.min(k.open,k.close),sc);ctx.fillRect(Math.round(x-cw/2),y1,Math.round(cw),Math.max(1,y2-y1))}
    const idx=new Map();for(let i=a;i<=b;i++)idx.set(st.d[i].time,i);
    st.marks.forEach(m=>{const i=idx.get(m.time);if(i==null)return;const k=st.d[i],x=xOf(i);const above=m.position==="aboveBar";const y=above?yOf(k.high,sc)-10:yOf(k.low,sc)+10;
      ctx.fillStyle=m.color;ctx.beginPath();
      if(m.shape==="arrowUp"){ctx.moveTo(x,y-6);ctx.lineTo(x-6,y+4);ctx.lineTo(x+6,y+4)}else if(m.shape==="arrowDown"){ctx.moveTo(x,y+6);ctx.lineTo(x-6,y-4);ctx.lineTo(x+6,y-4)}
      else if(m.shape==="square"){ctx.rect(x-5,y-5,10,10)}else{ctx.arc(x,y,m.size?3:4.5,0,7)}ctx.fill();
      if(m.text){ctx.font="600 11px IBM Plex Sans, sans-serif";ctx.textAlign="center";ctx.textBaseline=above?"bottom":"top";ctx.fillText(m.text,x,above?y-8:y+8)}});
    st.lines.forEach(l=>{if(!l.band)return;const y1=yOf(l.price,sc),y2=yOf(l.band,sc);ctx.fillStyle=l.bandColor||"rgba(216,176,98,.12)";ctx.fillRect(0,Math.min(y1,y2),PW,Math.abs(y2-y1))});
    ctx.restore();
    st.lines.forEach(l=>{const y=Math.round(yOf(l.price,sc))+.5;if(y<PT-1||y>PT+ph()+1)return;const hot=st.hoverLine===l||st.dragLine===l;
      ctx.strokeStyle=l.color;ctx.lineWidth=(l.lineWidth||1)+(hot?1:0);ctx.setLineDash(l.lineStyle==="dashed"?[6,5]:l.lineStyle==="dotted"?[2,4]:[]);
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(PW,y);ctx.stroke();ctx.setLineDash([]);
      if(l.draggable){ctx.fillStyle=l.color;ctx.beginPath();ctx.arc(PW-10,y,hot?6:4.5,0,7);ctx.fill()}
      if(l.title){ctx.font="600 11px IBM Plex Sans, sans-serif";const tw=ctx.measureText(l.title).width;const lx=l.titleLeft?6:PW-tw-(l.draggable?30:14);ctx.fillStyle=l.color;ctx.fillRect(lx,y-17,tw+10,15);ctx.fillStyle="#0a0f22";ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText(l.title,lx+5,y-9.5)}
      label(y,l.price.toFixed(st.dec),l.color,"#0a0f22")});
    if(st.hy!=null&&st.hy>PT&&st.hy<PT+ph()&&st.hx<PW&&!st.dragLine){ctx.strokeStyle=col.cross;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(0,st.hy+.5);ctx.lineTo(PW,st.hy+.5);ctx.moveTo(st.hx+.5,PT);ctx.lineTo(st.hx+.5,PT+ph());ctx.stroke();ctx.setLineDash([]);
      label(st.hy,pOf(st.hy,sc).toFixed(st.dec),"#a9823a","#fff")}
    if(st.badge){ctx.font="700 13px IBM Plex Sans, sans-serif";const tw=ctx.measureText(st.badge).width;ctx.fillStyle="rgba(6,11,26,.85)";ctx.fillRect(10,10,tw+18,24);ctx.fillStyle="#f3d88f";ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText(st.badge,19,22)}
    st.drawCb&&st.drawCb();
  }
  let raf=0;const req=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;draw()})};
  const pos=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
  const clampView=()=>{const n=st.d.length,span=st.to-st.from;if(st.to>n+40){st.to=n+40;st.from=st.to-span}if(st.from<-20){st.from=-20;st.to=st.from+span}};
  const zoomX=(f,cx)=>{const span=st.to-st.from;const ns=Math.max(12,Math.min(600,span*f));const c=st.from+cx/pw()*span;st.from=c-(c-st.from)*ns/span;st.to=st.from+ns;clampView();req()};
  const lineAt=y=>{if(y==null)return null;const sc=scale();let best=null,bd=8;st.lines.forEach(l=>{if(!l.draggable)return;const d=Math.abs(yOf(l.price,sc)-y);if(d<bd){bd=d;best=l}});return best};
  const zoneOf=p=>p.x>pw()?"y":p.y>st.H-BX?"x":"plot";
  const ptrs=new Map();let down=null,pinch=null;
  cv.addEventListener("pointerdown",e=>{const p=pos(e);ptrs.set(e.pointerId,p);try{cv.setPointerCapture(e.pointerId)}catch(_){}
    if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),from:st.from,to:st.to};down=null;return}
    const z=zoneOf(p);const ln=z==="plot"?lineAt(p.y):null;const sc=scale();
    down={x:p.x,y:p.y,from:st.from,to:st.to,lo:sc.lo,hi:sc.hi,moved:false,zone:ln?"line":z,line:ln};if(ln){st.dragLine=ln;req()}});
  cv.addEventListener("pointermove",e=>{const p=pos(e);if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,p);st.hx=p.x;st.hy=p.y;
    if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(d>10){const span=(pinch.to-pinch.from)*pinch.d/d;const c=(pinch.from+pinch.to)/2;st.from=c-span/2;st.to=c+span/2;clampView();req()}return}
    if(!down){const z=zoneOf(p);st.hoverLine=z==="plot"?lineAt(p.y):null;cv.style.cursor=z==="y"?"ns-resize":z==="x"?"ew-resize":st.hoverLine?"ns-resize":"crosshair";req();return}
    const dx=p.x-down.x,dy=p.y-down.y;if(Math.abs(dx)>4||Math.abs(dy)>4)down.moved=true;if(!down.moved)return;
    if(down.zone==="line"){const sc=scale();const v=+pOf(Math.max(PT,Math.min(PT+ph(),p.y)),sc).toFixed(st.dec);down.line.price=v;st.lineCb&&st.lineCb(down.line,v);req();return}
    if(down.zone==="y"){toManual();const mid=(down.lo+down.hi)/2,half=(down.hi-down.lo)/2*Math.exp(dy*0.006);st.yLo=mid-half;st.yHi=mid+half;req();return}
    if(down.zone==="x"){const f=Math.exp(-dx*0.006);const span=(down.to-down.from)*f;st.to=down.to;st.from=down.to-Math.max(12,Math.min(600,span));clampView();req();return}
    cv.style.cursor="grabbing";const per=(down.to-down.from)/pw();st.from=down.from-dx*per;st.to=down.to-dx*per;clampView();
    if(Math.abs(dy)>6||!st.auto){toManual();const k=(down.hi-down.lo)/ph();st.yLo=down.lo+dy*k;st.yHi=down.hi+dy*k}req()});
  const up=e=>{const p=pos(e);ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;
    if(down&&!down.moved&&st.click&&down.zone==="plot"){st.click(pOf(p.y,scale()))}
    if(down&&down.zone==="line"&&down.moved&&st.lineCb)st.lineCb(down.line,down.line.price,true);
    st.dragLine=null;down=null;cv.style.cursor="crosshair";req()};
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  cv.addEventListener("pointerleave",()=>{if(!down){st.hy=null;st.hoverLine=null;req()}});
  cv.addEventListener("dblclick",e=>{const p=pos(e);if(zoneOf(p)==="y")setAuto(true)});
  cv.addEventListener("wheel",e=>{e.preventDefault();const p=pos(e);
    if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&!e.ctrlKey){const per=(st.to-st.from)/pw();st.from+=e.deltaX*per;st.to+=e.deltaX*per;clampView();req();return}
    if(zoneOf(p)==="y"){toManual();const mid=(st.yLo+st.yHi)/2,half=(st.yHi-st.yLo)/2*(e.deltaY>0?1.1:1/1.1);st.yLo=mid-half;st.yHi=mid+half;req();return}
    zoomX(e.deltaY>0?1.12:1/1.12,Math.min(p.x,pw()))},{passive:false});
  autoBtn.onclick=()=>setAuto(true);
  return{
    setData(d,dec){st.d=d;if(dec!=null)st.dec=dec;setAuto(true)},
    push(k){st.d.push(k);req()},
    length(){return st.d.length},
    setRange(f,t){st.from=f;st.to=t;req()},
    follow(){const n=st.d.length,span=st.to-st.from;if(n-1>st.to-4){st.to=n+4;st.from=st.to-span}req()},
    span(){const w=el.getBoundingClientRect().width||600;return Math.max(30,Math.min(110,Math.round(w/9)))},
    addLine(o){const l=Object.assign({},o);st.lines.push(l);req();return l},
    removeLine(l){st.lines=st.lines.filter(x=>x!==l);req()},
    clearLines(){st.lines=[];req()},
    setMarkers(m){st.marks=(m||[]).slice().sort((a,b)=>a.time-b.time);req()},
    setBadge(t){st.badge=t;req()},
    onClick(fn){st.click=fn},
    onLineDrag(fn){st.lineCb=fn},
    onDraw(fn){st.drawCb=fn},
    priceToY(p){return yOf(p,scale())},
    plotWidth(){return pw()},plotTop(){return PT},plotBottom(){return PT+ph()},
    autoscale(){setAuto(true)},
    destroy(){ro.disconnect();cv.remove();autoBtn.remove()}
  };
}
window.AGChart={makeChart};
})();
