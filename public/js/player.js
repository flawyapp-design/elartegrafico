/* El Arte Gráfico Academy — reproductor de ejercicios: gráfica (zona en H1/M5, SL en M5, repetición), cálculo con fórmula y opción múltiple. */
(function(){
"use strict";
const A=window.AGAPP;const {$,$$,esc,md,API,TZ,MNAME,h1Bars,m5Bars,idxAt,avgRange,toC,Chart,fmtT}=A;

/* ---------- evaluador de fórmulas (sin eval) ---------- */
function evalExpr(src,vars){
  const toks=[];const re=/\s*(\d+\.?\d*|\.\d+|[A-Za-z_][A-Za-z0-9_]*|\*\*|[-+*/^(),%])/y;let m;re.lastIndex=0;
  while(re.lastIndex<src.length){m=re.exec(src);if(!m){if(/^\s*$/.test(src.slice(re.lastIndex)))break;throw new Error("Fórmula inválida")}toks.push(m[1])}
  let i=0;const peek=()=>toks[i],next=()=>toks[i++];
  const F={round:(x,d=0)=>Math.round(x*10**d)/10**d,floor:Math.floor,ceil:Math.ceil,abs:Math.abs,min:Math.min,max:Math.max,sqrt:Math.sqrt,pow:Math.pow};
  function prim(){const t=next();if(t===undefined)throw new Error("Fórmula incompleta");
    if(t==="("){const v=add();if(next()!==")")throw new Error("Falta un paréntesis");return v}
    if(t==="-")return -pow();if(t==="+")return pow();
    if(/^[\d.]/.test(t))return parseFloat(t);
    if(F[t]&&peek()==="("){next();const args=[];if(peek()!==")"){args.push(add());while(peek()===","){next();args.push(add())}}if(next()!==")")throw new Error("Falta un paréntesis");return F[t](...args)}
    if(t in vars)return +vars[t];throw new Error("Variable desconocida: "+t)}
  function pow(){let b=prim();while(peek()==="^"||peek()==="**"){next();b=Math.pow(b,pow())}return b}
  function mul(){let v=pow();while(["*","/","%"].includes(peek())){const o=next(),r=pow();v=o==="*"?v*r:o==="/"?v/r:v%r}return v}
  function add(){let v=mul();while(peek()==="+"||peek()==="-"){const o=next(),r=mul();v=o==="+"?v+r:v-r}return v}
  const v=add();if(i<toks.length)throw new Error("Fórmula inválida");return v;
}
function genVars(spec){const out={};String(spec||"").split(/[;\n]/).map(x=>x.trim()).filter(Boolean).forEach(p=>{const m=p.match(/^([A-Za-z_]\w*)\s*=\s*(-?[\d.]+)\s*(?:\.\.\s*(-?[\d.]+)\s*(?::\s*([\d.]+))?)?$/);if(!m)return;
  const a=+m[2],b=m[3]!=null?+m[3]:a,st=m[4]!=null?+m[4]:1;const n=Math.floor((b-a)/st+1e-9);const v=a+st*Math.floor(Math.random()*(n+1));out[m[1]]=+v.toFixed(6)});return out}
const nf=(v,d=2)=>Number(v).toLocaleString("es-CO",{maximumFractionDigits:d});
window.AGFormula={evalExpr,genVars};

/* ---------- simulación de una operación ---------- */
function Trade(side,entry,sl,targetR){
  const risk=side==="buy"?entry-sl:sl-entry;
  const t={side,entry,sl,targetR,risk,valid:risk>0,status:"esperando",r:0,eIdx:null,xIdx:null,tp:side==="buy"?entry+targetR*risk:entry-targetR*risk};
  t.step=(i,b)=>{if(!t.valid||t.status==="sl"||t.status==="tp")return;
    if(t.status==="esperando"){if((side==="buy"&&b.l<=entry)||(side==="sell"&&b.h>=entry)){t.status="abierta";t.eIdx=i}else return}
    if(side==="buy"){if(b.l<=sl){t.status="sl";t.r=-1;t.xIdx=i;return}if(b.h>=t.tp){t.status="tp";t.r=targetR;t.xIdx=i;return}t.r=(b.c-entry)/risk}
    else{if(b.h>=sl){t.status="sl";t.r=-1;t.xIdx=i;return}if(b.l<=t.tp){t.status="tp";t.r=targetR;t.xIdx=i;return}t.r=(entry-b.c)/risk}};
  t.label=()=>!t.valid?"SL del lado equivocado":t.status==="esperando"?"Sin entrada":t.status==="abierta"?`Abierta ${t.r>=0?"+":""}${t.r.toFixed(2)}R`:t.status==="sl"?"Stop loss −1R":`Objetivo +${t.targetR}R`;
  return t;
}

/* ---------- ejercicio de gráfica ---------- */
async function mountChart(host,ex,o){
  const side=ex.side||"buy",tfZ=ex.tf_zone||"H1",tfS=ex.tf_sl||"M5",hasSL=tfS!=="none"&&ex.kind!=="no-operar";
  host.innerHTML=`<div class="ex">
    <div class="ex-head"><div style="display:grid;gap:8px;min-width:0">
      <div class="row"><span class="pill gold">${esc(MNAME[ex.market]||ex.market)}</span><span class="pill">${side==="sell"?"Venta":"Compra"}</span><span class="pill">Última vela: ${fmtT(ex.t_end)}</span>${o.preview?'<span class="pill info">Vista previa</span>':""}</div>
      <div class="ex-q">${esc(ex.prompt||(ex.kind==="no-operar"?"Analiza la gráfica. ¿Hay entrada o es mejor no operar?":`Marca la zona de ${side==="sell"?"venta":"compra"} en ${tfZ}${hasSL?` y después baja a ${tfS} para poner el stop loss`:""}.`))}</div></div>
      <div class="tfseg" role="tablist" aria-label="Temporalidad"><button data-tf="H1" role="tab">H1</button><button data-tf="M5" role="tab">M5</button></div></div>
    <div class="stepper" data-a="steps"></div>
    <div class="chartbox"><div class="cv" style="position:absolute;inset:0"></div></div>
    <div class="ex-bar"><div class="modes" data-a="modes"></div>
      <div class="row"><button class="btn sm ghost" data-a="none">Aquí no se opera</button><button class="btn sm gold" data-a="ok" disabled>Confirmar</button></div></div>
    <div data-a="replay"></div><div data-a="res"></div></div>`;
  const H=await h1Bars(ex.market);const iH=idxAt(H.bars,ex.t_end);
  if(iH<5){$("[data-a=res]",host).innerHTML='<div class="result bad">No hay velas para esa fecha.</div>';return null}
  const hA=Math.max(0,iH-160);const visEnd=ex.t_end+3600;const revealH=Math.max(2,ex.reveal_hours||24);
  const M=await m5Bars(ex.market,ex.t_end-3*86400,visEnd+revealH*3600);
  const m5vis=M.bars.filter(b=>b.t<visEnd),m5fut=M.bars.filter(b=>b.t>=visEnd);
  const dec=H.dec;const C=Chart.makeChart($(".cv",host));
  const D={H1:{bars:H.bars.slice(hA,iH+1),range:null},M5:{bars:m5vis,range:null}};
  const tolZ=(ex.tol_pct||0.35)*avgRange(D[tfZ].bars,D[tfZ].bars.length-1),tolS=(ex.tol_pct||0.35)*avgRange(D[tfS==="none"?"M5":tfS].bars,D[tfS==="none"?"M5":tfS].bars.length-1);
  let tf=tfZ,mode="zone",zone=null,sl=null,answered=false,lines=[];
  const setTF=t=>{if(D[tf].range==null)D[tf].range=null;tf=t;$$("[data-tf]",host).forEach(b=>{b.classList.toggle("on",b.dataset.tf===t);b.setAttribute("aria-selected",String(b.dataset.tf===t))});
    C.setData(toC(D[t].bars),dec);const n=D[t].bars.length;C.setRange(n-C.span()*(t==="M5"?0.9:1),n+(answered?2:6));drawLines();steps()};
  const drawLines=()=>{C.clearLines();
    if(zone!=null)C.addLine({price:zone,color:"#c8d0de",lineWidth:2,lineStyle:"dashed",title:"Tu zona"});
    if(sl!=null)C.addLine({price:sl,color:"#ff8a80",lineWidth:2,lineStyle:"dashed",title:"Tu SL"});
    lines.forEach(l=>C.addLine(l))};
  const steps=()=>{const st=[[`1. Zona en ${tfZ}`,zone!=null,mode==="zone"]];if(hasSL)st.push([`2. Stop loss en ${tfS}`,sl!=null,mode==="sl"]);st.push([`${hasSL?3:2}. Confirmar`,answered,false]);
    $("[data-a=steps]",host).innerHTML=ex.kind==="no-operar"?"":st.map(([t,d,on])=>`<span class="${d?"done":on?"on":""}">${t}</span>`).join("");
    $("[data-a=modes]",host).innerHTML=ex.kind==="no-operar"&&!answered?`<span class="muted" style="font-size:13.5px">Si ves entrada, marca la zona; si no, elige “Aquí no se opera”.</span>`:
      `<button data-m="zone" class="${mode==="zone"?"on":""}">Zona<span class="v">${zone!=null?zone.toFixed(dec):"—"}</span></button>${hasSL?`<button data-m="sl" class="${mode==="sl"?"on":""}">Stop loss<span class="v">${sl!=null?sl.toFixed(dec):"—"}</span></button>`:""}
       ${hasSL&&zone!=null&&sl==null&&tf!==tfS?`<button data-go="${tfS}" class="on">Ir a ${tfS} para el SL →</button>`:""}`;
    $$("[data-m]",host).forEach(b=>b.onclick=()=>{if(answered)return;mode=b.dataset.m;steps()});
    $$("[data-go]",host).forEach(b=>b.onclick=()=>{setTF(b.dataset.go)});
    $("[data-a=ok]",host).disabled=answered||zone==null||(hasSL&&sl==null)};
  $$("[data-tf]",host).forEach(b=>b.onclick=()=>setTF(b.dataset.tf));
  C.onClick(p=>{if(answered)return;const v=+p.toFixed(dec);
    if(mode==="zone"){if(tf!==tfZ){A.toast(`La zona se marca en ${tfZ}`);return}zone=v;if(hasSL){mode="sl";if(tf!==tfS)A.toast(`Ahora cambia a ${tfS} para poner el stop loss`)}}
    else{if(tf!==tfS){A.toast(`El stop loss se marca en ${tfS}`);return}sl=v}
    drawLines();steps()});
  setTF(tfZ);
  let timer=null;
  const finish=async choice=>{
    if(answered)return;answered=true;steps();
    let ans;try{ans=o.preview?o.preview:await API.grade(ex.id)}catch(e){answered=false;steps();
      const msg={premium:"Este ejercicio es para alumnos premium.",demo_agotado:"Ya usaste tus 5 gráficas de prueba.",login:"Inicia sesión para responder."}[e.message]||e.message;
      $("[data-a=res]",host).innerHTML=`<div class="result bad"><b>${esc(msg)}</b>${e.message==="demo_agotado"||e.message==="premium"?'<a class="btn gold sm" href="#premium" style="justify-self:start">Ver cómo acceder</a>':""}</div>`;return}
    const cz=ans.zone!=null?+ans.zone:null,cs=ans.sl!=null?+ans.sl:null;
    let pts=0,max=10,res,title;
    if(ex.kind==="no-operar"){res=choice==="none"?"ok":"bad";pts=res==="ok"?10:0;title=res==="ok"?"Correcto: aquí no se opera":"Aquí no había entrada"}
    else if(choice==="none"){res="bad";title="Sí había una entrada";if(hasSL)max=15}
    else{const dz=Math.abs(zone-cz);const zp=dz<=tolZ?10:dz<=2.5*tolZ?5:0;let sp=0;
      if(hasSL&&cs!=null){max=15;const ds=Math.abs(sl-cs);sp=ds<=tolS?5:ds<=2.5*tolS?2:0}
      pts=zp+sp;const pc=pts/max;res=pc>=.8?"ok":pc>=.4?"mid":"bad";title=res==="ok"?"Muy bien: zona y stop loss correctos":res==="mid"?"Cerca, revisa los detalles":"No coincide con la entrada correcta"}
    const xp=Math.round(10*pts/max);
    // repetición en M5
    if(tf!=="M5")setTF("M5");
    lines=[];if(cz!=null)lines.push({price:cz,color:"#f3d88f",lineWidth:2,title:"Zona correcta",titleLeft:true});if(cs!=null)lines.push({price:cs,color:"#ec5b52",lineWidth:1,lineStyle:"dotted",title:"SL correcto",titleLeft:true});drawLines();
    const tu=(choice!=="none"&&zone!=null&&hasSL&&sl!=null)?Trade(side,zone,sl,ex.target_r||2):null;
    const tc=(cz!=null&&cs!=null)?Trade(side,cz,cs,ex.target_r||2):null;
    const rp=$("[data-a=replay]",host);
    rp.innerHTML=`<div class="replay"><b>Repetición M5</b><button class="btn sm" data-sp="1">x1</button><button class="btn sm" data-sp="4">x4</button><button class="btn sm gold" data-sp="12">x12</button><button class="btn sm ghost" data-a="pause">Pausa</button><button class="btn sm ghost" data-a="end">Ir al final</button><span class="mono muted" data-a="clock"></span></div>
      <div class="kv" style="margin-top:10px"><div><b data-a="ru">—</b><span>Tu operación</span></div><div><b data-a="rc">—</b><span>Operación correcta${ex.target_r?` · objetivo ${ex.target_r}R`:""}</span></div></div>`;
    const base=D.M5.bars.length;let k=0,speed=12,paused=false;
    const marks=[];const mk=(t,idx,txt,color,shape,pos)=>{const b=m5fut[idx];if(b)marks.push({time:b.t+TZ,position:pos,color,shape,text:txt})};
    const upd=()=>{const f=t=>t?t.label():"—";$("[data-a=ru]",host).textContent=tu?f(tu):(choice==="none"?"No operó":"—");$("[data-a=rc]",host).textContent=ex.kind==="no-operar"?"No operar":f(tc);
      const b=m5fut[Math.max(0,k-1)];$("[data-a=clock]",host).textContent=b?fmtT(b.t):""};
    const stepOne=()=>{if(k>=m5fut.length){done();return false}const b=m5fut[k];
      [tu,tc].forEach((t,j)=>{if(!t)return;const was=t.status;t.step(k,b);if(was==="esperando"&&t.status!=="esperando")mk(0,k,j?"entrada ✓":"tu entrada",j?"#f3d88f":"#c8d0de",side==="sell"?"arrowDown":"arrowUp",side==="sell"?"aboveBar":"belowBar");
        if((t.status==="sl"||t.status==="tp")&&t.xIdx===k)mk(0,k,(j?"":"tú: ")+(t.status==="tp"?`+${t.targetR}R`:"SL"),t.status==="tp"?"#35c4a2":"#ec5b52","square","aboveBar")});
      C.push({time:b.t+TZ,open:b.o,high:b.h,low:b.l,close:b.c});k++;return true};
    const done=()=>{clearInterval(timer);timer=null;C.setMarkers(marks);upd();showResult()};
    const tickN=()=>{if(paused)return;for(let n=0;n<Math.max(1,speed/4);n++){if(!stepOne())return}C.setMarkers(marks);C.follow();upd()};
    const start=()=>{clearInterval(timer);timer=setInterval(tickN,Math.max(25,160/Math.min(speed,4)))};
    $$("[data-sp]",rp).forEach(b=>b.onclick=()=>{speed=+b.dataset.sp;$$("[data-sp]",rp).forEach(x=>x.classList.toggle("gold",x===b));paused=false;$("[data-a=pause]",rp).textContent="Pausa";if(timer)start()});
    $("[data-a=pause]",rp).onclick=e=>{paused=!paused;e.target.textContent=paused?"Seguir":"Pausa"};
    $("[data-a=end]",rp).onclick=()=>{while(stepOne());};
    let shown=false;
    const showResult=()=>{if(shown)return;shown=true;D.M5.bars=D.M5.bars.concat(m5fut);
      const hf=H.bars.slice(iH+1,iH+1+revealH);D.H1.bars=D.H1.bars.concat(hf);
      const cls=res==="ok"?"ok":res==="mid"?"mid":"bad";
      $("[data-a=res]",host).innerHTML=`<div class="result ${cls}"><b class="big">${title}${xp?` · +${xp} pts`:""}</b>
        ${ex.kind!=="no-operar"&&cz!=null?`<div class="kv"><div><b>${zone!=null&&choice!=="none"?zone.toFixed(dec):"—"}</b><span>Tu zona</span></div><div><b>${cz.toFixed(dec)}</b><span>Zona correcta</span></div>${hasSL?`<div><b>${sl!=null&&choice!=="none"?sl.toFixed(dec):"—"}</b><span>Tu stop loss</span></div><div><b>${cs!=null?cs.toFixed(dec):"—"}</b><span>Stop loss correcto</span></div>`:""}</div>`:""}
        ${ans.explain?`<div class="prose" style="font-size:15.5px">${md(ans.explain)}</div>`:""}
        <div class="row">${o.next?`<button class="btn gold" data-a="next">${esc(o.nextLabel||"Siguiente")}</button>`:""}<button class="btn sm ghost" data-a="h1">Ver H1 completo</button></div></div>`;
      const nx=$("[data-a=next]",host);if(nx)nx.onclick=()=>o.next();$("[data-a=h1]",host).onclick=()=>setTF("H1");
      o.onDone&&o.onDone({res,pts:xp});};
    start();
  };
  $("[data-a=ok]",host).onclick=()=>finish("zone");
  $("[data-a=none]",host).onclick=()=>finish("none");
  return{destroy:()=>{clearInterval(timer);try{C.destroy()}catch(e){}}};
}

/* ---------- cálculo ---------- */
async function mountCalc(host,ex,o){
  const d=ex.data||{};const vars=genVars(d.vars);const dec=d.decimals??2;
  const q=String(d.template||ex.prompt||"").replace(/\{(\w+)\}/g,(m,k)=>k in vars?nf(vars[k],4):m);
  host.innerHTML=`<div class="ex"><div class="row"><span class="pill gold">Cálculo</span>${o.preview?'<span class="pill info">Vista previa</span>':""}</div><div class="ex-q" style="font-size:17px">${esc(q)}</div>
    <form class="form" data-a="f"><label>Tu respuesta${d.unit?` (${esc(d.unit)})`:""}<input data-a="in" inputmode="decimal" autocomplete="off" placeholder="Ej. 0.35" style="max-width:240px"></label><div class="row"><button class="btn gold" data-a="ok">Comprobar</button></div></form><div data-a="res"></div></div>`;
  $("[data-a=f]",host).onsubmit=async e=>{e.preventDefault();const raw=$("[data-a=in]",host).value.replace(",",".").trim();const u=parseFloat(raw);if(!isFinite(u)){A.toast("Escribe un número");return}
    const btn=$("[data-a=ok]",host);btn.disabled=true;let ans;try{ans=o.preview?o.preview:await API.grade(ex.id)}catch(x){btn.disabled=false;$("[data-a=res]",host).innerHTML=`<div class="result bad">${esc({premium:"Ejercicio para alumnos premium.",demo_agotado:"Ya usaste tus 5 ejercicios de prueba."}[x.message]||x.message)}</div>`;return}
    let c;try{c=evalExpr((ans.answer||{}).formula||"0",vars)}catch(x){c=NaN}
    const tol=((ans.answer||{}).tol_pct??2)/100;const rel=Math.abs(u-c)/Math.max(Math.abs(c),1e-9);
    const res=rel<=tol?"ok":rel<=3*tol?"mid":"bad";const pts=res==="ok"?10:res==="mid"?5:0;
    $("[data-a=in]",host).disabled=true;
    $("[data-a=res]",host).innerHTML=`<div class="result ${res}"><b class="big">${res==="ok"?"Correcto":res==="mid"?"Muy cerca":"Incorrecto"}${pts?` · +${pts} pts`:""}</b>
      <div class="kv"><div><b>${nf(u,6)}</b><span>Tu respuesta</span></div><div><b>${isFinite(c)?nf(c,dec):"—"}</b><span>Respuesta correcta${d.unit?" ("+esc(d.unit)+")":""}</span></div></div>
      ${ans.explain?`<div class="prose" style="font-size:15.5px">${md(ans.explain)}</div>`:""}${o.next?`<div class="row"><button class="btn gold" data-a="next">${esc(o.nextLabel||"Siguiente")}</button></div>`:""}</div>`;
    const nx=$("[data-a=next]",host);if(nx)nx.onclick=()=>o.next();o.onDone&&o.onDone({res,pts})};
  return{destroy(){}};
}

/* ---------- opción múltiple ---------- */
async function mountOption(host,ex,o){
  const opts=(ex.data||{}).options||[];const nm="op"+Math.random().toString(36).slice(2,7);
  host.innerHTML=`<div class="ex"><div class="row"><span class="pill gold">Pregunta</span>${o.preview?'<span class="pill info">Vista previa</span>':""}</div><div class="ex-q" style="font-size:17px">${esc(ex.prompt)}</div>
    <form data-a="f" style="display:grid;gap:12px"><div class="opts">${opts.map((t,i)=>`<label data-i="${i}"><input type="radio" name="${nm}" value="${i}"> <span>${esc(t)}</span></label>`).join("")}</div><div class="row"><button class="btn gold" data-a="ok">Responder</button></div></form><div data-a="res"></div></div>`;
  $("[data-a=f]",host).onsubmit=async e=>{e.preventDefault();const c=$(`input[name=${nm}]:checked`,host);if(!c){A.toast("Elige una opción");return}const pick=+c.value;
    let ans;try{ans=o.preview?o.preview:await API.grade(ex.id)}catch(x){$("[data-a=res]",host).innerHTML=`<div class="result bad">${esc({premium:"Ejercicio para alumnos premium.",demo_agotado:"Ya usaste tus 5 ejercicios de prueba."}[x.message]||x.message)}</div>`;return}
    const ok=+((ans.answer||{}).correct)===pick;$$("input",host).forEach(i=>i.disabled=true);$("[data-a=ok]",host).disabled=true;
    $$("[data-i]",host).forEach(l=>{const i=+l.dataset.i;if(i===+(ans.answer||{}).correct)l.classList.add("ok");else if(i===pick)l.classList.add("bad")});
    $("[data-a=res]",host).innerHTML=`<div class="result ${ok?"ok":"bad"}"><b class="big">${ok?"Correcto · +10 pts":"Incorrecto"}</b>${ans.explain?`<div class="prose" style="font-size:15.5px">${md(ans.explain)}</div>`:""}${o.next?`<div class="row"><button class="btn gold" data-a="next">${esc(o.nextLabel||"Siguiente")}</button></div>`:""}</div>`;
    const nx=$("[data-a=next]",host);if(nx)nx.onclick=()=>o.next();o.onDone&&o.onDone({res:ok?"ok":"bad",pts:ok?10:0})};
  return{destroy(){}};
}

window.Player={mount:async(host,ex,o={})=>{try{return ex.kind==="calculo"?await mountCalc(host,ex,o):ex.kind==="opcion"?await mountOption(host,ex,o):await mountChart(host,ex,o)}
  catch(e){host.innerHTML=`<div class="result bad">No se pudo cargar el ejercicio: ${esc(e.message)}</div>`;return null}}};
})();
