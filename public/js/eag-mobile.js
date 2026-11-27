/* EAG Charts · Modo celular (estilo MT5).
   Solo se activa en teléfonos (html.m5). En el PC no cambia nada.
   - El gráfico ocupa casi toda la pantalla.
   - Arriba: mercado, temporalidad e íconos (indicadores, dibujo).
   - Abajo, una barra de pestañas fija: Mercados · Gráfico · Operar · Chat · Más.
   - "Más" abre una hoja con todo lo demás (Journal, Marcador, Avisos, Alertas, Estudio, diseño, perfil, clase, ajustes…).
   Todo reutiliza los botones de siempre (se les hace clic), así no se pierde ninguna función.
   Se puede volver a la vista clásica desde Más. */
(function(){
"use strict";
let X=null,bar=null,sheet=null,on=false;
const $=s=>document.querySelector(s);
const tap=id=>{const el=document.getElementById(id);if(el&&!el.disabled){el.click();return true}return false};
const IC={
  mkt:'<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  chart:'<path d="M9 5v14M15 3v18M6 8h6v8H6zM12 6h6v10h-6z"/>',
  trade:'<path d="M7 17l5-5 4 4 5-6"/><path d="M15 10h6v6"/><path d="M3 21h18"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
  more:'<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  ind:'<path d="M5 20c2-8 4-12 7-12s5 4 7 12"/><path d="M4 4h4M6 2v4"/>'};
const svg=(k,s)=>`<svg width="${s||22}" height="${s||22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
const num=el=>{const t=el&&el.textContent?parseInt(el.textContent,10):0;return isFinite(t)?t:0};

/* ---------- barra de pestañas de abajo ---------- */
function buildBar(){bar=document.createElement("nav");bar.className="m5bar";bar.setAttribute("aria-label","Secciones");
  bar.innerHTML=[["mkt","mkt","Mercados"],["chart","chart","Gráfico"],["trade","trade","Operar"],["chat","chat","Chat"],["more","more","Más"]]
    .map(([k,ic,t])=>`<button data-m="${k}" class="${k==="chart"?"on":""}">${svg(ic)}<span>${t}</span><b class="m5n" hidden></b></button>`).join("");
  document.getElementById("appw").appendChild(bar);
  bar.querySelectorAll("[data-m]").forEach(b=>b.onclick=e=>{e.stopPropagation();go(b.dataset.m)});
  setInterval(badges,1500);badges()}
function setOn(k){bar&&bar.querySelectorAll("[data-m]").forEach(b=>b.classList.toggle("on",b.dataset.m===k))}
const trOpen=()=>{try{return!!(window.EAGTrade&&window.EAGTrade.isOpen&&window.EAGTrade.isOpen())}catch(e){return false}};
const chOpen=()=>{try{return!!(window.EAGSocial&&window.EAGSocial.isOpen&&window.EAGSocial.isOpen())}catch(e){return false}};
function closeAll(){closeSheet();if(isWlOpen())tap("wlx");try{trOpen()&&window.EAGTrade.close()}catch(e){}try{chOpen()&&window.EAGSocial.close()}catch(e){}
  try{const J=document.querySelector(".jr:not([hidden])");J&&window.EAGJournal&&window.EAGJournal.toggle(false)}catch(e){}}
function go(k){if(k!=="more")closeSheet();
  if(k==="chart"){closeAll();setOn("chart");return}
  if(k==="mkt"){if(isWlOpen()){tap("wlx");setOn("chart");return}closeAll();tap("wlb");setOn("mkt");return}
  if(k==="trade"&&!document.getElementById("trb")){go("alerts");return}
  if(k==="trade"){if(trOpen()){window.EAGTrade.close();setOn("chart")}else{closeAll();tap("trb");setOn("trade")}return}
  if(k==="alerts"){closeAll();tap("alb");return}
  if(k==="chat"){if(chOpen()){window.EAGSocial.close();setOn("chart")}else{closeAll();tap("chb");setOn("chat")}return}
  if(k==="more"){sheet&&!sheet.hidden?closeSheet():openSheet()}}
function badges(){if(!bar)return;const set=(k,n)=>{const b=bar.querySelector(`[data-m="${k}"] .m5n`);if(!b)return;b.hidden=!n;b.textContent=n>99?"99+":n};
  set("chat",window.EAGSocial&&window.EAGSocial.unread?window.EAGSocial.unread():0);set("more",num($("#ntb .ntb-n")));
  /* si se cerró lo que estaba abierto, vuelve a marcar "Gráfico" */
  const cur=bar.querySelector("[data-m].on");if(cur&&cur.dataset.m!=="chart"&&!(sheet&&!sheet.hidden)){const k=cur.dataset.m,open=k==="mkt"?isWlOpen():k==="trade"?trOpen():k==="chat"?chOpen():false;if(!open)setOn("chart")}}
const isWlOpen=()=>{const m=$("#main");return!!(m&&m.classList.contains("wlopen"))};

/* ---------- hoja "Más" ---------- */
function tiles(){const T=[],add=(id,ic,t,fn,badge)=>T.push({id,ic,t,fn,badge});const vis=id=>{const e=document.getElementById(id);return e&&!e.hidden};
  add("draw","✏️",X.SAVE.m5draw?"Ocultar dibujo":"Herramientas de dibujo",()=>{X.SAVE.m5draw=!X.SAVE.m5draw;X.save();apply()});
  add("jr","📅","Journal",()=>window.EAGJournal&&window.EAGJournal.toggle(true));
  add("plan","🎯","Plan y lote",()=>window.EAGJournal&&window.EAGJournal.openPlan());
  add("trk","➕","Marcador",()=>{const b=document.querySelector(".wtrk");b&&b.click()});
  add("ntb","📥","Avisos",()=>tap("ntb"),num($("#ntb .ntb-n")));
  add("alb","🔔","Alertas de precio",()=>tap("alb"));
  add("prob","🎓","Estudio",()=>tap("prob"));
  if(window.EAGReplay)add("rp","⏪","Replay",()=>window.EAGReplay.quick({}));
  add("lay","🪟","Diseño",null);
  add("pfb","🗂️","Perfil",()=>tap("pfb"));
  if(vis("clb")||document.getElementById("clb"))add("clb","🔴","Modo Clase",()=>tap("clb"));
  add("shot","📸","Captura",()=>{const b=document.querySelector('.pane.act [data-a="shot"]')||document.querySelector('[data-a="shot"]');b&&b.click()});
  add("lzb","🔦","Láser",()=>tap("lzb"));
  if(vis("pipb"))add("pipb","📺","Gráfico flotante",()=>tap("pipb"));
  add("ftw","📑","Pestañas de mercados",()=>{X.SAVE.m5tabs=!X.SAVE.m5tabs;X.save();apply();X.toast(X.SAVE.m5tabs?"Pestañas de mercados visibles":"Pestañas ocultas (usa Mercados abajo)")});
  add("cfgb","⚙️","Configuración",()=>tap("cfgb"));
  if(vis("instb"))add("instb","📲","Instalar app",()=>tap("instb"));
  if(vis("fsb"))add("fsb","⛶","Pantalla completa",()=>tap("fsb"));
  add("acad","🏠","Academia",()=>{const a=document.querySelector(".brand");a&&(location.href=a.href)});
  add("classic","🖥️","Vista clásica",()=>{X.SAVE.m5off=true;X.save();X.toast("Vista clásica. Para volver: ⋯ → Modo celular");setTimeout(()=>location.reload(),900)});
  return T}
function openSheet(){if(!sheet){sheet=document.createElement("div");sheet.className="m5sheet";sheet.hidden=true;document.getElementById("appw").appendChild(sheet);
    sheet.addEventListener("pointerdown",e=>{if(e.target===sheet)closeSheet()})}
  sheet.innerHTML=`<div class="m5s" role="dialog" aria-label="Más"><i class="m5grab"></i>
    <div class="m5lay"><small>Diseño</small><div>${[...document.querySelectorAll(".lay button[data-l]")].filter(b=>["l1","l2v","mtf"].includes(b.dataset.l)).map(b=>`<button data-l="${b.dataset.l}" class="${b.classList.contains("on")?"on":""}">${b.querySelector("svg")?b.querySelector("svg").outerHTML:""}<span>${b.dataset.l==="l1"?"1 gráfico":b.dataset.l==="l2v"?"2 gráficos":"Multi-TF"}</span></button>`).join("")}</div></div>
    <div class="m5grid">${tiles().filter(t=>t.id!=="lay").map(t=>`<button data-t="${t.id}"><span class="m5ic">${t.ic}${t.badge?`<b>${t.badge}</b>`:""}</span><small>${t.t}</small></button>`).join("")}</div></div>`;
  sheet.hidden=false;requestAnimationFrame(()=>sheet.classList.add("open"));setOn("more");
  const T=tiles();sheet.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{const t=T.find(x=>x.id===b.dataset.t);closeSheet();setTimeout(()=>{try{t&&t.fn&&t.fn()}catch(e){}},60)});
  sheet.querySelectorAll(".m5lay [data-l]").forEach(b=>b.onclick=()=>{const L=document.querySelector(`.lay button[data-l="${b.dataset.l}"]`);if(L){if(L.classList.contains("cur")&&b.dataset.l!=="mtf"){document.querySelector(".lay").classList.add("open")}L.click();document.querySelector(".lay").classList.remove("open")}closeSheet()})}
function closeSheet(){if(!sheet||sheet.hidden)return;sheet.classList.remove("open");setTimeout(()=>{sheet.hidden=true},200);setOn("chart")}

/* ---------- cabecera de cada gráfico: íconos de indicadores y dibujo ---------- */
function decorate(){document.querySelectorAll(".wbar").forEach(w=>{if(w.querySelector(".m5w"))return;const g=document.createElement("span");g.className="m5w";
  g.innerHTML=`<button class="m5wb${X.SAVE.m5draw?" on":""}" data-mi="pen" title="Herramientas de dibujo" aria-label="Herramientas de dibujo">${svg("pen",20)}</button>`;w.appendChild(g);
  g.querySelector('[data-mi="pen"]').onclick=e=>{e.stopPropagation();X.SAVE.m5draw=!X.SAVE.m5draw;X.save();apply()}})}
function apply(){const h=document.documentElement;h.classList.toggle("m5",on);h.classList.toggle("m5-draw",on&&!!X.SAVE.m5draw);h.classList.toggle("m5-tabs",on&&!!X.SAVE.m5tabs);
  document.querySelectorAll('.m5wb[data-mi="pen"]').forEach(b=>b.classList.toggle("on",!!X.SAVE.m5draw));
  setTimeout(()=>dispatchEvent(new Event("resize")),60)}

window.EAGMobile={init(o){X=o;if(!o.isPhone||X.SAVE.m5off)return;on=true;apply();buildBar();decorate();
    new MutationObserver(()=>decorate()).observe(document.getElementById("grid")||document.body,{childList:true,subtree:true})},
  isOn:()=>on,enable(){if(!X)return;X.SAVE.m5off=false;X.save();location.reload()}};
})();
