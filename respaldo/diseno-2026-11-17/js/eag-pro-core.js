/* EAG Charts · Estudio (Replay y Práctica) — motor de análisis y ejercicios.
   Todo se calcula con lo que muestra el propio gráfico (precio), no con un método de trading en particular.
   Funciona en el navegador (window.EAGProCore) y en node (module.exports) para pruebas. */
(function(root){
"use strict";

/* ---------------- utilidades numéricas ---------------- */
function atr(c,n){n=n||14;const out=new Array(c.length).fill(0);let s=0;
  for(let i=0;i<c.length;i++){const k=c[i],pc=i?c[i-1].close:k.open;
    const tr=Math.max(k.high-k.low,Math.abs(k.high-pc),Math.abs(k.low-pc));
    if(i<n){s+=tr;out[i]=s/(i+1)}else out[i]=(out[i-1]*(n-1)+tr)/n}
  /* mínimo para que nunca sea cero (mercados muy planos) */
  for(let i=0;i<out.length;i++)if(!(out[i]>0))out[i]=Math.max(1e-9,Math.abs(c[i].close)*1e-5);
  return out}
function ema(vals,n){const k=2/(n+1),o=new Array(vals.length);let e=vals[0];for(let i=0;i<vals.length;i++){e=i?vals[i]*k+e*(1-k):vals[i];o[i]=e}return o}
const closes=c=>c.map(k=>k.close);

/* pivotes (fractales clásicos de k velas a cada lado), solo confirmados hasta "end" */
function pivots(c,end,k){k=k||3;const H=[],L=[];
  for(let i=k;i<=end-k;i++){let hi=true,lo=true;
    for(let j=1;j<=k;j++){if(!(c[i].high>c[i-j].high&&c[i].high>=c[i+j].high))hi=false;if(!(c[i].low<c[i-j].low&&c[i].low<=c[i+j].low))lo=false}
    if(hi)H.push({i,p:c[i].high});if(lo)L.push({i,p:c[i].low})}
  return{H,L}}

/* zigzag por múltiplos de ATR: devuelve los giros confirmados hasta "end" y la pierna en curso */
function zigzag(c,A,end,mult,from){mult=mult||2.5;from=from||0;const P=[];
  let dir=0,ext={i:from,p:c[from].close},hi={i:from,p:c[from].high},lo={i:from,p:c[from].low};
  for(let i=from+1;i<=end;i++){const k=c[i],th=A[i]*mult;
    if(dir===0){if(k.high>hi.p)hi={i,p:k.high};if(k.low<lo.p)lo={i,p:k.low};
      if(hi.p-lo.p>=th){if(hi.i>lo.i){P.push({i:lo.i,p:lo.p,t:"L"});dir=1;ext=hi}else{P.push({i:hi.i,p:hi.p,t:"H"});dir=-1;ext=lo}}continue}
    if(dir===1){if(k.high>=ext.p)ext={i,p:k.high};else if(ext.p-k.low>=th){P.push({i:ext.i,p:ext.p,t:"H"});dir=-1;ext={i,p:k.low}}}
    else{if(k.low<=ext.p)ext={i,p:k.low};else if(k.high-ext.p>=th){P.push({i:ext.i,p:ext.p,t:"L"});dir=1;ext={i,p:k.high}}}}
  return{pts:P,cur:dir?{i:ext.i,p:ext.p,t:dir===1?"H":"L",open:true}:null,dir}}

/* niveles de soporte/resistencia: agrupa pivotes cercanos (tolerancia en ATR) */
function levels(c,A,end,opt){opt=opt||{};const look=opt.look||220,from=Math.max(0,end-look),tol=(opt.tol||0.6)*A[end];
  const pv=pivots(c,end,opt.k||3),all=[...pv.H.map(x=>Object.assign({h:1},x)),...pv.L.map(x=>Object.assign({h:0},x))].filter(x=>x.i>=from).sort((a,b)=>a.p-b.p);
  const cl=[];for(const x of all){const g=cl[cl.length-1];if(g&&x.p-g.max<=tol){g.items.push(x);g.max=x.p}else cl.push({items:[x],min:x.p,max:x.p})}
  return cl.map(g=>{const ps=g.items.map(x=>x.p),p=ps.reduce((a,b)=>a+b,0)/ps.length;
    return{p,lo:Math.min(...ps),hi:Math.max(...ps),touches:g.items.length,lastI:Math.max(...g.items.map(x=>x.i)),highs:g.items.filter(x=>x.h).length,lows:g.items.filter(x=>!x.h).length}})
   .filter(l=>l.touches>=(opt.minTouches||2)).sort((a,b)=>b.touches-a.touches||b.lastI-a.lastI)}

/* contexto de tendencia en el punto "end" */
function trend(c,A,end){const cl=closes(c).slice(0,end+1),e20=ema(cl,20),e50=ema(cl,50),a=A[end];
  const s20=(e20[end]-e20[Math.max(0,end-10)])/a;
  const z=zigzag(c,A,end,2.5,Math.max(0,end-260)),P=z.pts;
  const hs=P.filter(x=>x.t==="H").slice(-2),ls=P.filter(x=>x.t==="L").slice(-2);
  let st="lateral";if(hs.length===2&&ls.length===2){if(hs[1].p>hs[0].p&&ls[1].p>ls[0].p)st="alcista";else if(hs[1].p<hs[0].p&&ls[1].p<ls[0].p)st="bajista"}
  const emaDir=e20[end]>e50[end]&&s20>0.2?"alcista":e20[end]<e50[end]&&s20<-0.2?"bajista":"lateral";
  const w=c.slice(Math.max(0,end-60),end+1),hiW=Math.max(...w.map(k=>k.high)),loW=Math.min(...w.map(k=>k.low)),pos=(c[end].close-loW)/Math.max(1e-12,hiW-loW);
  return{struct:st,ema:emaDir,e20:e20[end],e50:e50[end],slope:s20,pos,hiW,loW,zz:z}}

/* ---------------- ejercicios ---------------- */
const TOPICS={
  proy:{name:"Proyección del precio",short:"Proyección",desc:"Mira el gráfico y decide hacia dónde irá el precio en las próximas velas.",icon:"↗"},
  zona:{name:"Zonas de reacción",short:"Zonas",desc:"Marca la zona donde crees que el precio va a reaccionar.",icon:"▭"},
  romp:{name:"Rompimientos",short:"Rompimientos",desc:"El precio está llegando a un nivel. ¿Lo rompe o rebota?",icon:"⇥"},
  impr:{name:"Impulso o retroceso",short:"Impulso / retroceso",desc:"Identifica si el movimiento marcado es un impulso o un retroceso.",icon:"〰"},
  mix:{name:"Examen mixto",short:"Examen",desc:"Preguntas de todos los temas, como un examen.",icon:"★"}};

const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const fx=(v,p)=>(+v).toLocaleString("en-US",{minimumFractionDigits:p,maximumFractionDigits:p});
const SHOW=150; /* velas visibles antes del punto de la pregunta */

/* proyección: sube / baja / lateral en K velas */
function genProy(c,A,t,o){const K=o.K||20;if(t+K>=c.length||t<SHOW)return null;
  const a=A[t],mv=c[t+K].close-c[t].close,r=mv/a;
  if(Math.abs(r)>0.8&&Math.abs(r)<1.4)return null; /* zona gris: no se pregunta */
  const ans=Math.abs(r)<=0.8?"lat":r>0?"up":"dn";
  let mfe=0,mae=0;for(let i=t+1;i<=t+K;i++){mfe=Math.max(mfe,c[i].high-c[t].close);mae=Math.max(mae,c[t].close-c[i].low)}
  return{type:"proy",t,K,ans,mv,r,mfe,mae,ctx:trend(c,A,t),
    q:`¿Hacia dónde irá el precio en las próximas ${K} velas?`,
    choices:[["up","Sube"],["dn","Baja"],["lat","Lateral"]],
    hint:"Lateral = termina a menos de 0.8 veces el rango promedio de una vela (ATR) de donde está ahora."}}

/* rompimiento: nivel cercano con 2+ toques; resultado claro en K velas */
function genRomp(c,A,t,o){const K=o.K||25;if(t+K>=c.length||t<SHOW)return null;const a=A[t],px=c[t].close;
  const L=levels(c,A,t-1,{look:200,tol:0.5,minTouches:2}).filter(l=>Math.abs(l.p-px)<=0.9*a&&Math.abs(l.p-px)>=0.15*a&&t-l.lastI>=4);
  if(!L.length)return null;const lv=L[0],side=lv.p>px?"res":"sop";
  let res=null,bi=-1;
  for(let i=t+1;i<=t+K;i++){const k=c[i];
    if(side==="res"){if(k.close>=lv.p+0.5*a){res="rompe";bi=i;break}if(k.low<=lv.p-1.6*a&&k.high<lv.p+0.2*a){res="rebota";bi=i;break}}
    else{if(k.close<=lv.p-0.5*a){res="rompe";bi=i;break}if(k.high>=lv.p+1.6*a&&k.low>lv.p-0.2*a){res="rebota";bi=i;break}}}
  if(!res)return null;
  /* ¿rompimiento falso? (vuelve a cerrar del otro lado del nivel antes de K) */
  let falso=false;if(res==="rompe")for(let i=bi+1;i<=t+K;i++){if(side==="res"?c[i].close<lv.p-0.3*a:c[i].close>lv.p+0.3*a){falso=true;break}}
  return{type:"romp",t,K,ans:res,level:lv,side,bi,falso,ctx:trend(c,A,t),
    q:`El precio se acerca a ${side==="res"?"una resistencia":"un soporte"} que ya tocó ${lv.touches} veces. ¿Qué pasará en las próximas ${K} velas?`,
    choices:[["rompe","Lo rompe"],["rebota","Rebota"]],
    hint:"Rompe = cierra al menos media ATR del otro lado del nivel. Rebota = se aleja 1.6 ATR sin cruzarlo."}}

/* impulso o retroceso de la última pierna completa del zigzag */
function genImpr(c,A,t,o){if(t<SHOW+20)return null;const z=zigzag(c,A,t,2.5,Math.max(0,t-300)),P=z.pts;if(P.length<5)return null;
  const n=P.length-1,leg={a:P[n-1],b:P[n]},prev={a:P[n-2],b:P[n-1]},dir=leg.b.p>leg.a.p?1:-1,len=Math.abs(leg.b.p-leg.a.p),plen=Math.abs(prev.b.p-prev.a.p);
  /* la pierna debe verse completa y no muy vieja */
  if(t-leg.b.i<2||t-leg.b.i>25||leg.a.i<t-SHOW+10)return null;
  /* estructura ANTES de la pierna */
  const before=P.slice(0,n);const hs=before.filter(x=>x.t==="H").slice(-2),ls=before.filter(x=>x.t==="L").slice(-2);
  if(hs.length<2||ls.length<2)return null;
  let tr=0;if(hs[1].p>hs[0].p&&ls[1].p>ls[0].p)tr=1;else if(hs[1].p<hs[0].p&&ls[1].p<ls[0].p)tr=-1;if(!tr)return null;
  let ans,ratio=len/Math.max(1e-12,plen);
  if(dir===tr&&ratio>=1.0)ans="imp";else if(dir!==tr&&ratio<=0.8)ans="ret";else return null;
  return{type:"impr",t,K:o.K||20,ans,leg,prev,dir,tr,ratio,pts:P.slice(-6),ctx:trend(c,A,t),
    q:"El movimiento marcado en dorado, ¿es un impulso o un retroceso?",
    choices:[["imp","Impulso"],["ret","Retroceso"]],
    hint:"Impulso: va a favor de la estructura (máximos y mínimos) y es más largo que la pierna anterior. Retroceso: va en contra y es más corto."}}

/* zonas: el alumno marca una zona; se evalúa después */
function genZona(c,A,t,o){const K=o.K||40;if(t+K>=c.length||t<SHOW)return null;
  /* que en el futuro haya movimiento real (si no, la pregunta no enseña nada) */
  let hi=-Infinity,lo=Infinity;for(let i=t+1;i<=t+K;i++){hi=Math.max(hi,c[i].high);lo=Math.min(lo,c[i].low)}
  if((hi-lo)/A[t]<3)return null;
  return{type:"zona",t,K,ctx:trend(c,A,t),auto:levels(c,A,t,{look:220,tol:0.6,minTouches:2}).slice(0,4),
    q:`Marca una zona (arriba o abajo del precio) donde esperas que el precio reaccione en las próximas ${K} velas.`,
    choices:null,hint:"Arrastra en el gráfico de arriba a abajo para marcar la zona. Puedes marcarla otra vez para corregir."}}

/* evaluar una zona [lo,hi] marcada en t */
function evalZona(c,A,t,K,lo,hi){const a=A[t],px=c[t].close;if(hi<lo){const x=hi;hi=lo;lo=x}
  if(hi-lo<0.25*a){const m=(hi+lo)/2;lo=m-0.125*a;hi=m+0.125*a}
  if(px>=lo&&px<=hi)return{res:"dentro",score:0,lo,hi};
  const up=lo>px; /* zona arriba = resistencia esperada */
  let touch=-1;for(let i=t+1;i<=t+K;i++){if(up?c[i].high>=lo:c[i].low<=hi){touch=i;break}}
  if(touch<0)return{res:"nollego",score:0,lo,hi,dist:up?lo-px:px-hi};
  for(let i=touch;i<=t+K;i++){const k=c[i];
    if(up){if(k.close>hi+0.4*a)return{res:"rompio",score:0,lo,hi,touch,at:i};if(k.low<=lo-1.5*a)return{res:"reacciono",score:1,lo,hi,touch,at:i,move:(hi-k.low)/a}}
    else{if(k.close<lo-0.4*a)return{res:"rompio",score:0,lo,hi,touch,at:i};if(k.high>=hi+1.5*a)return{res:"reacciono",score:1,lo,hi,touch,at:i,move:(k.high-lo)/a}}}
  return{res:"tibia",score:0.5,lo,hi,touch}}

const GEN={proy:genProy,romp:genRomp,impr:genImpr,zona:genZona};
/* busca un punto válido para el tema dentro de un bloque de velas */
function pick(c,topic,o){o=o||{};const A=atr(c,14),g=GEN[topic];if(!g)return null;
  const lo=SHOW+20,hi=c.length-1-(o.K||45);if(hi<=lo)return null;
  /* respuestas balanceadas: se busca primero una respuesta al azar (si no, "lateral" o "rebota" saldrían muy poco o demasiado) */
  const opts={proy:["up","dn","lat"],romp:["rompe","rebota"],impr:["imp","ret"]}[topic];const want=opts?opts[rnd(0,opts.length-1)]:null;let any=null;
  for(let n=0;n<220;n++){const t=rnd(lo,hi);const q=g(c,A,t,o);if(!q)continue;q.A=A;if(!want||q.ans===want)return q;if(!any)any=q}
  return any}

/* ---------------- textos de retroalimentación (objetivos) ---------------- */
const dirTxt=d=>d==="alcista"?"alcista":d==="bajista"?"bajista":"lateral";
function ctxText(x){const p=x.pos;const where=p>0.8?"cerca del máximo de las últimas 60 velas":p<0.2?"cerca del mínimo de las últimas 60 velas":"en la mitad del rango de las últimas 60 velas";
  const pl={alcista:"alcistas",bajista:"bajistas",lateral:"planas"}[x.ema];
  return `Antes de la pregunta: estructura ${dirTxt(x.struct)} (máximos y mínimos), medias ${pl} (EMA 20 vs EMA 50) y el precio ${where}.`}

function feedback(q,c,user,extra){const p=extra.prec||2,a=q.A[q.t],P=v=>fx(v,p);const out={ok:false,score:0,title:"",lines:[],lesson:""};
  if(q.type==="proy"){const lab={up:"subió",dn:"bajó",lat:"se quedó lateral"};out.ok=user===q.ans;out.score=out.ok?1:0;
    out.title=out.ok?"¡Bien leído!":"Esta vez no";
    out.lines.push(`En ${q.K} velas el precio ${lab[q.ans]}: ${q.mv>=0?"+":""}${P(q.mv)} (${(q.r).toFixed(1)} ATR).`);
    out.lines.push(`Lo máximo que subió: +${P(q.mfe)} · lo máximo que bajó: −${P(q.mae)}.`);
    if(extra.target!=null){const reach=extra.target>=c[q.t].close?c.slice(q.t+1,q.t+q.K+1).some(k=>k.high>=extra.target):c.slice(q.t+1,q.t+q.K+1).some(k=>k.low<=extra.target);
      out.lines.push(reach?`🎯 Tu objetivo (${P(extra.target)}) se alcanzó.`:`🎯 Tu objetivo (${P(extra.target)}) no se alcanzó.`);if(reach&&out.ok)out.score=1.25}
    out.lines.push(ctxText(q.ctx));
    const agree=(q.ctx.struct==="alcista"&&q.ans==="up")||(q.ctx.struct==="bajista"&&q.ans==="dn");
    out.lesson=q.ans==="lat"?"Cuando el precio está en medio del rango y las medias están planas, lo más común es que siga lateral: no hay ventaja clara para proyectar.":
      agree?"El precio siguió a favor de la estructura. Proyectar a favor de máximos y mínimos crecientes (o decrecientes) suele dar más probabilidad que ir en contra.":
      "Esta vez el precio fue en contra de la estructura previa. Pasa: por eso se usa stop. Fíjate si había señales de agotamiento (se acercaba a un extremo del rango, velas más pequeñas, divergencia).";}
  if(q.type==="romp"){out.ok=user===q.ans;out.score=out.ok?1:0;out.title=out.ok?"¡Correcto!":"Esta vez no";
    out.lines.push(q.ans==="rompe"?`El precio rompió ${q.side==="res"?"la resistencia":"el soporte"} en ${P(q.level.p)}.`:`El precio rebotó en ${q.side==="res"?"la resistencia":"el soporte"} de ${P(q.level.p)}.`);
    if(q.ans==="rompe"&&q.falso)out.lines.push("Ojo: después volvió a cerrar del otro lado. Fue un rompimiento falso.");
    out.lines.push(`El nivel tenía ${q.level.touches} toques. ${ctxText(q.ctx)}`);
    const withTrend=(q.side==="res"&&q.ctx.struct==="alcista")||(q.side==="sop"&&q.ctx.struct==="bajista");
    out.lesson=q.ans==="rompe"?(withTrend?"El rompimiento iba a favor de la tendencia: los niveles que se tocan muchas veces a favor de la tendencia tienden a romperse.":"Rompió aunque iba contra la estructura. Espera el cierre de vela fuera del nivel y su retesteo para confirmar.")
      :(withTrend?"Aunque iba a favor de la tendencia, el nivel aguantó. Un rebote en contra de la tendencia suele ser solo un retroceso.":"El nivel aguantó en contra de la tendencia: los soportes/resistencias a contra tendencia suelen frenar el precio.")}
  if(q.type==="impr"){out.ok=user===q.ans;out.score=out.ok?1:0;out.title=out.ok?"¡Correcto!":"Esta vez no";
    const trTxt=q.tr===1?"alcista (máximos y mínimos crecientes)":"bajista (máximos y mínimos decrecientes)";
    out.lines.push(`La estructura antes del movimiento era ${trTxt}.`);
    out.lines.push(q.ans==="imp"?`El movimiento fue a favor y midió ${(q.ratio*100).toFixed(0)}% de la pierna anterior: es un impulso.`
      :`El movimiento fue en contra y recorrió el ${(q.ratio*100).toFixed(0)}% de la pierna anterior: es un retroceso.`);
    const r=q.ratio*100;out.lesson=q.ans==="ret"?(r<=40?"Retroceso corto (menos del 40%): señal de una tendencia fuerte.":r<=65?"Retroceso medio (40–65%): la zona típica donde muchos buscan la continuación (niveles 50% y 61.8%).":"Retroceso profundo (más del 65%): la tendencia pierde fuerza; cuidado con un cambio de estructura.")
      :"Los impulsos rompen el último máximo (o mínimo) y son más largos que los retrocesos. Operar a favor del impulso suele tener mejor relación riesgo/beneficio."}
  if(q.type==="zona"){const r=extra.zr;out.score=r.score;out.ok=r.score>=1;
    const map={reacciono:"¡La zona funcionó! El precio llegó y reaccionó.",tibia:"El precio llegó a tu zona pero no reaccionó con fuerza.",rompio:"El precio llegó a tu zona y la atravesó.",nollego:"El precio no llegó a tu zona en ese tiempo.",dentro:"Marcaste la zona encima del precio actual: márcala arriba o abajo del precio."};
    out.title=r.score>=1?"¡Buena zona!":r.score>0?"Casi":"Esta vez no";out.lines.push(map[r.res]);
    if(r.res==="reacciono")out.lines.push(`Después de tocarla se movió ${r.move.toFixed(1)} ATR en contra de la llegada.`);
    const good=(extra.auto||[]).filter(z=>z.r.res==="reacciono");
    if(q.auto&&q.auto.length)out.lines.push(`Zonas que el gráfico ya mostraba (2 o más toques): ${q.auto.length}. ${good.length?`${good.length} de ellas reaccionaron.`:"Ninguna reaccionó esta vez."}`);
    out.lesson="Las mejores zonas suelen estar donde el precio ya giró varias veces (máximos y mínimos anteriores) y en el sentido de la tendencia: soportes en tendencia alcista, resistencias en bajista."}
  return out}

const API={atr,ema,pivots,zigzag,levels,trend,pick,evalZona,feedback,TOPICS,SHOW,GEN};
if(typeof module!=="undefined"&&module.exports)module.exports=API;else root.EAGProCore=API;
})(typeof window!=="undefined"?window:globalThis);
