/* © El Arte Gráfico. Todos los derechos reservados. */
/* EAG Charts · Contador de spikes (solo en el gráfico de ticks de Boom y Crash).
   Cuenta los ticks desde el último spike y muestra la estadística de lo que hay cargado en el gráfico.
   Es ESTADÍSTICA, no predicción: cada tick tiene la misma probabilidad de spike, sin importar cuántos van. */
(function(){
"use strict";
let X=null;
const fmtN=n=>Math.round(n).toLocaleString("es-CO");
const meta=tk=>{const m=String(tk||"").match(/^(BOOM|CRASH)(\d+)/);return m?{up:m[1]==="BOOM",avg:+m[2],name:(m[1]==="BOOM"?"Boom ":"Crash ")+m[2]}:null};
/* spikes en la lista de ticks: saltos grandes en la dirección del índice (arriba en Boom, abajo en Crash) */
function analyze(L,up){const n=L.length;if(n<30)return null;const d=[];for(let i=1;i<n;i++)d.push(L[i].close-L[i-1].close);
  const ab=d.map(Math.abs).sort((a,b)=>a-b),med=ab[Math.floor(ab.length/2)]||0,thr=Math.max(med*12,1e-9);
  const idx=[];d.forEach((v,i)=>{if((up?v:-v)>thr)idx.push({i:i+1,sz:Math.abs(v)})});
  const gaps=[];for(let k=1;k<idx.length;k++)gaps.push(idx[k].i-idx[k-1].i);
  const lastI=idx.length?idx[idx.length-1].i:-1;
  return{n,spikes:idx.length,since:lastI>=0?n-1-lastI:null,gaps,last:idx.length?idx[idx.length-1].sz:null}}
function boxOf(p){if(!p.__spk){if(p.__spkMin==null)p.__spkMin=innerWidth<700;const b=document.createElement("div");b.className="spkbox";p.el.appendChild(b);p.__spk=b;
    b.addEventListener("pointerdown",e=>e.stopPropagation());
    b.addEventListener("click",e=>{const a=e.target.closest("[data-sa]");if(!a)return;
      if(a.dataset.sa==="min"){p.__spkMin=!p.__spkMin;p.__spkH="";paint()}
      if(a.dataset.sa==="off"){X.setOff();X.toast("Contador de spikes oculto. Lo vuelves a activar en <b>Configuración → Gráfico</b>.");paint()}})}
  return p.__spk}
function place(p,b){const cv=p.el.querySelector(".kc canvas");if(!cv)return;const r=cv.getBoundingClientRect(),R=p.el.getBoundingClientRect();
  b.style.top=Math.round(r.top-R.top+10)+"px";b.style.left=Math.round(r.left-R.left+10)+"px"}
function paint(){if(!X)return;X.panes().forEach(p=>{let per,tk;try{per=p.kc.getPeriod();tk=p.kc.getSymbol().ticker}catch(e){return}
  const M=meta(tk),show=X.on()&&per&&per.timespan==="tick"&&!!M;
  if(!show){if(p.__spk){p.__spk.remove();p.__spk=null}return}
  const b=boxOf(p);place(p,b);let A=null;try{A=analyze(p.kc.getData(),M.up)}catch(e){}
  let h;
  if(!A){h=`<div class="spk-h"><b>Spikes · ${M.name}</b><span class="sp"></span><button data-sa="off" title="Ocultar contador">×</button></div><div class="spk-m">Cargando ticks…</div>`}
  else{const since=A.since,seen=since!=null,cnt=seen?since:A.n-1,avgObs=A.gaps.length?A.gaps.reduce((a,b)=>a+b,0)/A.gaps.length:null,pct=Math.min(100,cnt/M.avg*100);
    if(p.__spkMin)h=`<div class="spk-h"><b>${seen?"":"+"}${fmtN(cnt)}</b>&nbsp;ticks sin spike<span class="sp"></span><button data-sa="min" title="Ver más">▾</button></div>`;
    else h=`<div class="spk-h"><b>Spikes · ${M.name}</b><span class="sp"></span><button data-sa="min" title="Minimizar">▴</button><button data-sa="off" title="Ocultar contador">×</button></div>
      <div class="spk-l">Ticks desde el último spike</div>
      <div class="spk-n">${seen?"":"más de "}${fmtN(cnt)}</div>
      <div class="spk-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="spk-s">${cnt>M.avg?`Ya pasó el promedio de ${fmtN(M.avg)} ticks`:`Va en ${Math.round(pct)}% del promedio (${fmtN(M.avg)} ticks)`}</div>
      <div class="spk-g"><span>En el gráfico</span><b>${A.spikes} spike${A.spikes===1?"":"s"} en ${fmtN(A.n)} ticks</b>
        ${avgObs!=null?`<span>Distancia media</span><b>${fmtN(avgObs)} ticks</b><span>Más corta / larga</span><b>${fmtN(Math.min(...A.gaps))} / ${fmtN(Math.max(...A.gaps))}</b>`:""}
        ${A.last!=null?`<span>Último spike</span><b>${M.up?"+":"−"}${A.last.toFixed(2)} pts</b>`:""}</div>
      <div class="spk-w">Estadística, no predicción: cada tick tiene la misma probabilidad de spike, sin importar cuántos van. Mueve el gráfico hacia atrás para cargar más ticks.</div>`}
  if(p.__spkH!==h){p.__spkH=h;b.innerHTML=h}})}
window.EAGSpikes={init(ctx){X=ctx;window.__spkPaint=paint;setInterval(paint,700);paint()},paint};
})();
