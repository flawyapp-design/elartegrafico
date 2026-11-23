/* EAG Charts · Gráfico flotante (ventana flotante del celular / Picture in Picture).
   El gráfico activo se dibuja en un lienzo propio y se convierte en un video que el sistema saca a una ventana flotante:
   así el alumno puede irse a TikTok a ver el live y seguir viendo el precio, las velas y sus líneas y zonas.
   Se dibuja desde los datos (no copia la pantalla), así sigue al día aunque la página quede en segundo plano. */
(function(){
"use strict";
const W=640,H=400;
let X=null,cv=null,ctx=null,video=null,stream=null,on=false,tick=null,worker=null;

const supported=()=>{const v=document.createElement("video");return !!((document.pictureInPictureEnabled&&v.requestPictureInPicture)||v.webkitSupportsPresentationMode&&typeof v.webkitSetPresentationMode==="function")&&!!HTMLCanvasElement.prototype.captureStream};
const dark=()=>!document.documentElement.classList.contains("light")&&document.documentElement.getAttribute("data-theme")!=="light";

/* reloj que no se frena en segundo plano (los Worker no se duermen como la página) */
function startTicker(fn){try{const src="let t=setInterval(()=>postMessage(0),500);onmessage=e=>{if(e.data==='stop'){clearInterval(t);close()}}";
    worker=new Worker(URL.createObjectURL(new Blob([src],{type:"text/javascript"})));worker.onmessage=fn;return}catch(e){}
  tick=setInterval(fn,500)}
function stopTicker(){if(worker){try{worker.postMessage("stop")}catch(e){}worker=null}clearInterval(tick);tick=null}

const fmt=(v,d)=>(+v).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const msOf=p=>p&&p.multiplier*({tick:1e3,minute:6e4,hour:36e5,day:864e5,week:6048e5}[p.timespan]||6e4);
function levels(kc,lo,hi){/* líneas horizontales y zonas del usuario que caen en el rango visible */
  const out=[];let D=[];try{D=kc.drawings()||[]}catch(e){}
  D.forEach(d=>{if(!d||d.hid||!Array.isArray(d.points)||!d.points.length)return;const vs=d.points.map(p=>+p.value).filter(isFinite);if(!vs.length)return;
    if(/horizontal|priceLine/i.test(d.name))out.push({k:"line",v:vs[0],t0:d.points[0].timestamp});
    else if(/zone|rect/i.test(d.name)&&vs.length>=2)out.push({k:"zone",a:Math.max(...vs),b:Math.min(...vs),buy:/Buy/.test(d.name),sell:/Sell/.test(d.name),t0:Math.min(...d.points.map(p=>p.timestamp||Infinity))})});
  return out.filter(l=>l.k==="line"?l.v>=lo&&l.v<=hi:!(l.b>hi||l.a<lo))}

function draw(){const p=X.panes()[X.active()]||X.panes()[0];if(!p||!ctx)return;let L=[],s={},per=null;
  try{L=p.kc.getData()||[];s=p.kc.getSymbol()||{};per=p.kc.getPeriod()}catch(e){}
  const dk=dark(),bg=dk?"#0b1020":"#ffffff",fg=dk?"#e8ecf4":"#131722",mut=dk?"#8a94a8":"#6b7280",grid=dk?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)",up="#089981",dn="#f23645";
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  const dec=s.pricePrecision!=null?s.pricePrecision:3,n=Math.min(L.length,48),K=L.slice(-n),last=K[K.length-1];
  /* cabecera: mercado · temporalidad · precio */
  ctx.textBaseline="middle";ctx.font="700 22px Inter,system-ui,sans-serif";ctx.fillStyle=fg;
  const name=(s.name||s.shortName||s.ticker||"")+(per&&per.text?"  ·  "+per.text:"");ctx.fillText(name,16,26);
  if(!last){ctx.fillStyle=mut;ctx.font="500 18px Inter,system-ui,sans-serif";ctx.fillText("Cargando gráfico…",16,H/2);return}
  const first=L[Math.max(0,L.length-n-1)]||K[0],chg=(last.close-first.close)/first.close*100,col=last.close>=last.open?up:dn;
  ctx.textAlign="right";ctx.font="800 26px Inter,system-ui,sans-serif";ctx.fillStyle=col;ctx.fillText(fmt(last.close,dec),W-16,26);ctx.textAlign="left";
  /* zona de velas */
  const top=54,bot=H-30,right=W-84,left=10;let hi=-Infinity,lo=Infinity;K.forEach(k=>{hi=Math.max(hi,k.high);lo=Math.min(lo,k.low)});
  const pad=(hi-lo)*.08||Math.abs(hi)*.001||1;hi+=pad;lo-=pad;const y=v=>top+(hi-v)/(hi-lo)*(bot-top);
  ctx.strokeStyle=grid;ctx.lineWidth=1;for(let i=0;i<=4;i++){const yy=top+i*(bot-top)/4;ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(W,yy);ctx.stroke();
    ctx.fillStyle=mut;ctx.font="500 12px Inter,system-ui,sans-serif";ctx.textAlign="right";ctx.fillText(fmt(hi-(hi-lo)*i/4,dec),W-8,yy);ctx.textAlign="left"}
  const bw=(right-left)/n,t0=K[0].timestamp,ms=msOf(per)||60000,xOfT=t=>left+((t-t0)/ms+.5)*bw;
  /* zonas y líneas del usuario */
  levels(p.kc,lo,hi).forEach(l=>{if(l.k==="zone"){const x0=Math.max(left,isFinite(l.t0)?xOfT(l.t0):left);ctx.fillStyle=l.sell?"rgba(242,54,69,.16)":l.buy?"rgba(8,153,129,.16)":"rgba(41,98,255,.14)";ctx.fillRect(x0,y(l.a),right-x0,y(l.b)-y(l.a))}
    else{ctx.strokeStyle="rgba(230,183,74,.9)";ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(left,y(l.v));ctx.lineTo(right,y(l.v));ctx.stroke();ctx.setLineDash([])}});
  /* velas */
  K.forEach((k,i)=>{const x=left+i*bw+bw/2,c=k.close>=k.open?up:dn;ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=Math.max(1,bw*.12);
    ctx.beginPath();ctx.moveTo(x,y(k.high));ctx.lineTo(x,y(k.low));ctx.stroke();const b1=y(Math.max(k.open,k.close)),b2=y(Math.min(k.open,k.close));ctx.fillRect(x-bw*.34,b1,bw*.68,Math.max(1.5,b2-b1))});
  /* línea y etiqueta del precio actual */
  const py=y(last.close);ctx.strokeStyle=col;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right+4,py);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=col;ctx.fillRect(right+4,py-12,W-right-6,24);ctx.fillStyle="#fff";ctx.font="700 12.5px Inter,system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(fmt(last.close,dec),(right+4+W-2)/2,py);ctx.textAlign="left";
  /* pie: variación, cierre de la vela y marca */
  ctx.font="600 13px Inter,system-ui,sans-serif";ctx.fillStyle=chg>=0?up:dn;ctx.fillText((chg>=0?"+":"")+chg.toFixed(2)+"%",16,H-14);
  if(per&&per.timespan!=="tick"){const left2=Math.max(0,last.timestamp+ms-Date.now()),s2=Math.floor(left2/1000);ctx.fillStyle=mut;ctx.fillText("Cierra en "+(s2>=3600?Math.floor(s2/3600)+":":"")+String(Math.floor(s2%3600/60)).padStart(2,"0")+":"+String(s2%60).padStart(2,"0"),110,H-14)}
  ctx.textAlign="right";ctx.fillStyle=mut;ctx.fillText("EAG Charts",W-12,H-14);ctx.textAlign="left"}

async function start(){if(on)return;if(!supported()){X.toast("Tu navegador no permite el gráfico flotante. En Android usa Chrome y en iPhone Safari actualizado.");return}
  cv=document.createElement("canvas");cv.width=W;cv.height=H;ctx=cv.getContext("2d");draw();
  stream=cv.captureStream(4);video=document.createElement("video");video.muted=true;video.playsInline=true;video.setAttribute("playsinline","");video.autoplay=true;
  video.style.cssText="position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1";document.body.appendChild(video);video.srcObject=stream;
  try{await video.play()}catch(e){}
  try{if(video.requestPictureInPicture&&document.pictureInPictureEnabled)await video.requestPictureInPicture();else video.webkitSetPresentationMode("picture-in-picture")}
  catch(e){stop();X.toast("No se pudo abrir la ventana flotante: "+(e.message||"tu navegador lo bloqueó"));return}
  on=true;paintBtn();startTicker(draw);
  video.addEventListener("leavepictureinpicture",()=>stop(),{once:true});
  video.addEventListener("webkitpresentationmodechanged",()=>{if(video&&video.webkitPresentationMode!=="picture-in-picture")stop()});
  X.toast("📺 Gráfico flotante activo. Ya puedes ir a TikTok: la ventana sigue encima.")}
function stop(){if(!on&&!video)return;on=false;stopTicker();try{if(document.pictureInPictureElement)document.exitPictureInPicture().catch(()=>{})}catch(e){}
  try{stream&&stream.getTracks().forEach(t=>t.stop())}catch(e){}if(video){video.remove();video=null}stream=null;paintBtn()}
function paintBtn(){const b=X&&X.btn;if(!b)return;b.classList.toggle("on",on);b.setAttribute("aria-pressed",String(on));b.title=on?"Cerrar el gráfico flotante":"Gráfico flotante: sal a TikTok u otra app y sigue viendo el gráfico encima"}

window.EAGPip={init(o){X=o;const b=X.btn;if(!b)return;if(!supported()){b.hidden=true;return}b.hidden=false;b.onclick=()=>on?stop():start();paintBtn()},
  toggle:()=>on?stop():start(),isOn:()=>on,_draw:()=>{if(!cv){cv=document.createElement("canvas");cv.width=W;cv.height=H;ctx=cv.getContext("2d")}draw();return cv.toDataURL("image/png")}};
})();
