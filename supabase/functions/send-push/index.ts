// Supabase Edge Function "send-push": envía notificaciones a los alumnos. Solo la puede usar un administrador.
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: send-push → pegar este código → Deploy.
import webpush from "npm:web-push@3.6.7";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const pick = (legacy: string, json: string) => {
  const v = Deno.env.get(legacy);
  if (v) return v;
  try { const o = JSON.parse(Deno.env.get(json) || "{}"); return o.default || Object.values(o)[0] || ""; } catch { return ""; }
};
const SR = pick("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS") as string;
const ANON = pick("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS") as string;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = (path: string, init: RequestInit = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", ...(init.headers || {}) } });

// ---------- Discord: los mismos avisos, publicados en los canales por webhook ----------
const HOOK_RE = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
let hooksCache: any = null;
async function hooks() {
  if (hooksCache) return hooksCache;
  try {
    const r = await (await db("push_config?id=eq.1&select=dc_general,dc_miembros,dc_premium")).json();
    hooksCache = Array.isArray(r) && r[0] ? r[0] : {};
  } catch { hooksCache = {}; }
  return hooksCache;
}
const absUrl = (u: unknown) => { const s = String(u || "/"); return /^https?:\/\//.test(s) ? s : "https://elartegrafico.com" + (s.startsWith("/") ? s : "/" + s); };
async function toDiscord(hook: string | null | undefined, msg: Record<string, unknown>, color = 0xD8B062) {
  if (!hook || !HOOK_RE.test(hook)) return 0;
  const url = absUrl(msg.url);
  try {
    const r = await fetch(hook + "?wait=false", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "El Arte Gráfico", avatar_url: "https://elartegrafico.com/assets/icon-192.png",
        allowed_mentions: { parse: [] },
        embeds: [{ title: String(msg.title || "").slice(0, 256), description: `${String(msg.body || "").slice(0, 1800)}\n\n**[Abrir →](${url})**`, url, color }],
      }),
    });
    return r.ok ? 1 : 0;
  } catch { return 0; }
}
// adónde va cada aviso según a quién iba dirigido
async function discordFor(aud: string, msg: Record<string, unknown>) {
  const h = await hooks();
  if (aud === "premium" || aud === "oro") return await toDiscord(h.dc_premium, msg);
  if (aud === "miembros") return await toDiscord(h.dc_miembros, msg, 0x22B892);
  return await toDiscord(h.dc_general, msg);
}

async function vapid() {
  const r = await db("push_config?id=eq.1&select=public_key,private_key");
  const rows = await r.json();
  if (Array.isArray(rows) && rows[0]) return rows[0];
  const k = webpush.generateVAPIDKeys();
  await db("push_config", { method: "POST", body: JSON.stringify({ id: 1, public_key: k.publicKey, private_key: k.privateKey }), headers: { Prefer: "resolution=ignore-duplicates" } });
  const again = await (await db("push_config?id=eq.1&select=public_key,private_key")).json();
  return again[0];
}

// envía a los suscritos (todos / premium / gratis) y limpia los que ya no existen
// campana de la web: cada envío queda guardado (una fila por envío) para verlo después en la página
async function logNotif(aud: string, msg: Record<string, unknown>, only?: string) {
  try {
    const row: Record<string, unknown> = { title: String(msg.title || "").slice(0, 120), body: String(msg.body || "").slice(0, 400), url: String(msg.url || "").slice(0, 300), tag: String(msg.tag || "").slice(0, 60), aud };
    if (only === "admins") row.admins = true; else if (only && /^[0-9a-f-]{36}$/i.test(only)) row.user_id = only;
    if (!row.title) return;
    await db("notifs", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=minimal" } });
    if (Math.random() < 0.02) await db("rpc/notifs_cleanup", { method: "POST", body: "{}" });
  } catch (_) { /* la tabla aún no existe */ }
}

async function sendAll(keys: any, aud: string, msg: Record<string, unknown>, only?: string) {
  await logNotif(aud, msg, only);
  webpush.setVapidDetails("mailto:soporte@elartegrafico.com", keys.public_key, keys.private_key);
  const subs = await (await db("push_subs?select=endpoint,p256dh,auth,user_id,profiles!inner(premium_until,banned,role,plan)&profiles.banned=is.false")).json();
  const now = Date.now();
  const list = (Array.isArray(subs) ? subs : []).filter((s: any) => {
    const prem = s.profiles?.premium_until && new Date(s.profiles.premium_until).getTime() > now;
    if (only === "admins") return s.profiles?.role === "admin";
    if (only) return s.user_id === only;
    if (aud === "oro") return (prem && ["oro", "diamond"].includes(s.profiles?.plan)) || s.profiles?.role === "admin";
    return aud === "todos" || (aud === "premium" ? prem : !prem);
  });
  const payload = JSON.stringify({ icon: "/assets/icon-192.png", badge: "/assets/badge-72.png", ...msg });
  let sent = 0, failed = 0;
  const gone: string[] = [];
  await Promise.all(list.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
      sent++;
    } catch (e: any) {
      failed++;
      if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.endpoint);
    }
  }));
  for (const ep of gone) await db(`push_subs?endpoint=eq.${encodeURIComponent(ep)}`, { method: "DELETE" });
  return { sent, failed, removed: gone.length };
}

// EAG Charts: velas de 1 minuto recientes de varios mercados (API pública de Deriv)
function derivRecent(symbols: string[]): Promise<Record<string, { epoch: number; high: number; low: number; close: number }[]>> {
  return new Promise((resolve) => {
    const out: Record<string, any[]> = {};
    let left = symbols.length, done = false;
    const finish = () => { if (done) return; done = true; try { ws.close(); } catch (_) { /* nada */ } resolve(out); };
    const ws = new WebSocket("wss://api.derivws.com/trading/v1/options/ws/public");
    const timer = setTimeout(finish, 9000);
    ws.onopen = () => symbols.forEach((s, i) => ws.send(JSON.stringify({ ticks_history: s, style: "candles", granularity: 60, end: "latest", count: 4, req_id: i + 1 })));
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data)); const i = (m.req_id || (m.echo_req && m.echo_req.req_id)) - 1;
        if (i >= 0 && symbols[i]) out[symbols[i]] = (m.candles || []).map((c: any) => ({ epoch: +c.epoch, high: +c.high, low: +c.low, close: +c.close }));
      } catch (_) { /* nada */ }
      if (--left <= 0) { clearTimeout(timer); finish(); }
    };
    ws.onerror = () => { clearTimeout(timer); finish(); };
  });
}

// EAG Charts: velas de varios mercados y temporalidades (para las alertas técnicas)
function derivCandles(reqs: { sym: string; g: number }[], count = 120): Promise<Record<string, { epoch: number; open: number; high: number; low: number; close: number }[]>> {
  return new Promise((resolve) => {
    const out: Record<string, any[]> = {};
    let left = reqs.length, done = false;
    if (!left) return resolve(out);
    const finish = () => { if (done) return; done = true; try { ws.close(); } catch (_) { /* nada */ } resolve(out); };
    const ws = new WebSocket("wss://api.derivws.com/trading/v1/options/ws/public");
    const timer = setTimeout(finish, 12000);
    ws.onopen = () => reqs.forEach((r, i) => ws.send(JSON.stringify({ ticks_history: r.sym, style: "candles", granularity: r.g, end: "latest", count, req_id: i + 1 })));
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data)); const i = (m.req_id || (m.echo_req && m.echo_req.req_id)) - 1;
        if (i >= 0 && reqs[i]) out[reqs[i].sym + "|" + reqs[i].g] = (m.candles || []).map((c: any) => ({ epoch: +c.epoch, open: +c.open, high: +c.high, low: +c.low, close: +c.close }));
      } catch (_) { /* nada */ }
      if (--left <= 0) { clearTimeout(timer); finish(); }
    };
    ws.onerror = () => { clearTimeout(timer); finish(); };
  });
}
function rsiSeries(cl: number[], n: number): (number | null)[] {
  const out: (number | null)[] = cl.map(() => null); if (cl.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = cl[i] - cl[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n; out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < cl.length; i++) { const d = cl[i] - cl[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  return out;
}
function emaSeries(cl: number[], n: number): number[] { const k = 2 / (n + 1); const out: number[] = []; cl.forEach((v, i) => out.push(i ? v * k + out[i - 1] * (1 - k) : v)); return out; }
const TFN: Record<number, string> = { 60: "1m", 120: "2m", 180: "3m", 300: "5m", 600: "10m", 900: "15m", 1800: "30m", 3600: "1H", 7200: "2H", 14400: "4H", 28800: "8H", 86400: "1D" };
const fx = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(2) : v.toFixed(3)).replace(/\.?0+$/, "");

/* alertas técnicas: cierre de vela, RSI, cruce de medias y spike. Solo miran velas YA cerradas y posteriores a la última revisión. */
async function techAlerts(keys: any, al: any[]) {
  const now = Date.now(), nowIso = new Date().toISOString();
  const need = new Map<string, { sym: string; g: number }>();
  for (const a of al) { const g = a.kind === "spike" ? 60 : (Number(a.tf) || 60); need.set(a.symbol + "|" + g, { sym: a.symbol, g }); }
  const data = await derivCandles([...need.values()].slice(0, 80), 150);
  let sent = 0; const pending: string[] = [];
  for (const a of al) {
    const g = a.kind === "spike" ? 60 : (Number(a.tf) || 60), P = a.params || {};
    const all = (data[a.symbol + "|" + g] || []).filter((c) => (c.epoch + g) * 1000 <= now);   // solo velas cerradas
    const since = new Date(a.last_check).getTime();
    const isNew = (c: { epoch: number }) => (c.epoch + g) * 1000 > since;
    if (!all.length) { continue; }
    const cl = all.map((c) => c.close), name = a.symbol_name || a.symbol, tfn = TFN[g] || (g / 60) + "m";
    let hit: string | null = null;
    if (a.kind === "cierre") {
      const lv = Number(a.price), up = a.cond !== "abajo";
      for (let i = 1; i < all.length && !hit; i++) if (isNew(all[i])) { const p0 = cl[i - 1], p1 = cl[i]; if (up ? (p0 <= lv && p1 > lv) : (p0 >= lv && p1 < lv)) hit = `vela de ${tfn} cerró ${up ? "por encima" : "por debajo"} de ${fx(lv)} (cierre ${fx(p1)})`; }
    } else if (a.kind === "rsi") {
      const n = Math.max(2, Math.min(50, Number(P.n) || 14)), lv = Number(P.lv) || 30, up = a.cond === "arriba", R = rsiSeries(cl, n);
      for (let i = 1; i < all.length && !hit; i++) if (isNew(all[i]) && R[i] != null && R[i - 1] != null) { const r0 = R[i - 1]!, r1 = R[i]!; if (up ? (r0 <= lv && r1 > lv) : (r0 >= lv && r1 < lv)) hit = `RSI(${n}) en ${tfn} ${up ? "subió de" : "bajó de"} ${lv}: ahora ${r1.toFixed(1)}`; }
    } else if (a.kind === "cruce") {
      const f = Math.max(2, Number(P.f) || 9), sl = Math.max(f + 1, Number(P.s) || 21), up = a.cond !== "bajista", F = emaSeries(cl, f), S = emaSeries(cl, sl);
      for (let i = Math.max(1, sl); i < all.length && !hit; i++) if (isNew(all[i])) { const d0 = F[i - 1] - S[i - 1], d1 = F[i] - S[i]; if (up ? (d0 <= 0 && d1 > 0) : (d0 >= 0 && d1 < 0)) hit = `la EMA ${f} cruzó ${up ? "hacia arriba" : "hacia abajo"} la EMA ${sl} en ${tfn}`; }
    } else if (a.kind === "spike") {
      const boom = /^BOOM/.test(a.symbol), rg = all.map((c) => c.high - c.low).sort((x, y) => x - y), med = rg[Math.floor(rg.length / 2)] || 0;
      const min = Number(P.min) > 0 ? Number(P.min) : Math.max(med * 6, 1e-9);
      for (let i = 0; i < all.length && !hit; i++) if (isNew(all[i])) { const c = all[i], sz = boom ? c.high - c.open : c.open - c.low; if (sz >= min) hit = `spike de ${boom ? "+" : "−"}${fx(sz)} puntos`; }
    }
    if (hit) {
      const last = cl[cl.length - 1];
      await db(`chart_alerts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify(a.repeat ? { triggered_at: nowIso, triggered_price: last, last_check: nowIso } : { active: false, triggered_at: nowIso, triggered_price: last, last_check: nowIso }) });
      sent += (await sendAll(keys, "todos", { title: `🔔 ${name}: ${hit}`.slice(0, 120), body: `${a.note ? a.note + " · " : ""}Precio ahora: ${fx(last)}. Toca para ver el gráfico.`, url: "https://charts.elartegrafico.com", tag: `alerta-${a.id}-${Math.floor(now / 60000)}` }, a.user_id)).sent;
    } else pending.push(a.id);
  }
  for (let i = 0; i < pending.length; i += 150) {
    const ids = pending.slice(i, i + 150).join(",");
    await db(`chart_alerts?id=in.(${ids})`, { method: "PATCH", body: JSON.stringify({ last_check: nowIso }) });
  }
  return sent;
}

// EAG Charts: revisa las alertas activas y avisa al celular de cada alumno
async function chartAlerts(keys: any) {
  const all = await (await db("chart_alerts?active=eq.true&select=*&limit=3000")).json();
  if (!Array.isArray(all) || !all.length) return 0;
  const tech = all.filter((a: any) => ["cierre", "rsi", "cruce", "spike"].includes(a.kind));
  let techSent = 0;
  try { if (tech.length) techSent = await techAlerts(keys, tech); } catch (_) { /* nada */ }
  const al = all.filter((a: any) => a.kind === "nivel" || a.kind === "zona");
  if (!al.length) return techSent;
  const syms = [...new Set(al.map((a: any) => a.symbol))].slice(0, 60) as string[];
  const data = await derivRecent(syms);
  let sent = 0;
  const nowIso = new Date().toISOString();
  const pending: string[] = [];
  for (const a of al) {
    const cs = (data[a.symbol] || []).filter((c) => (c.epoch + 60) * 1000 > new Date(a.last_check).getTime());
    if (!cs.length) { continue; }
    const lo = Math.min(...cs.map((c) => c.low)), hi = Math.max(...cs.map((c) => c.high));
    const p1 = Number(a.price), p2 = a.kind === "zona" && a.price2 != null ? Number(a.price2) : p1;
    const zlo = Math.min(p1, p2), zhi = Math.max(p1, p2);
    if (hi >= zlo && lo <= zhi) {
      const last = cs[cs.length - 1].close;
      const name = a.symbol_name || a.symbol;
      const what = a.kind === "zona" ? `entró a tu zona ${zlo} – ${zhi}` : `tocó tu nivel ${p1}`;
      await db(`chart_alerts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ active: false, triggered_at: nowIso, triggered_price: last, last_check: nowIso }) });
      sent += (await sendAll(keys, "todos", { title: `🔔 ${name} ${what}`, body: `${a.note ? a.note + " · " : ""}Precio ahora: ${last}. Toca para ver el gráfico.`, url: "https://charts.elartegrafico.com", tag: `alerta-${a.id}` }, a.user_id)).sent;
    } else pending.push(a.id);
  }
  // marcar como revisadas las que no se activaron
  for (let i = 0; i < pending.length; i += 150) {
    const ids = pending.slice(i, i + 150).join(",");
    await db(`chart_alerts?id=in.(${ids})`, { method: "PATCH", body: JSON.stringify({ last_check: nowIso }) });
  }
  return sent + techSent;
}

const hora = (t: string) => new Date(t).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });

Deno.serve(async (req) => {
  hooksCache = null;
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const keys = await vapid();
    if (body.action === "setup") return json({ publicKey: keys.public_key });

    // respuesta de soporte que llegó desde Discord: notificación al alumno (la llama la función discord)
    if (body.action === "dm-user") {
      const sec = req.headers.get("x-cron-secret") || "";
      const row = (await (await db("push_config?id=eq.1&select=cron_secret")).json())[0];
      if (!sec || !row?.cron_secret || sec !== row.cron_secret) return json({ error: "No autorizado" }, 403);
      const uid = String(body.user_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(uid)) return json({ error: "Usuario no válido" }, 400);
      const r = await sendAll(keys, "todos", { title: "💬 El Arte Gráfico te respondió", body: String(body.text || "").slice(0, 140), url: "https://elartegrafico.com/#mensajes", tag: "dm" }, uid);
      return json(r);
    }

    // avisos automáticos de retos (los llama Supabase cada minuto con una clave secreta)
    if (body.action === "cron") {
      const sec = req.headers.get("x-cron-secret") || "";
      const row = (await (await db("push_config?id=eq.1&select=cron_secret")).json())[0];
      if (!sec || !row?.cron_secret || sec !== row.cron_secret) return json({ error: "No autorizado" }, 403);
      const items = await (await db("rpc/reto_push_claim", { method: "POST", body: "{}" })).json();
      let sent = 0;
      for (const it of (Array.isArray(items) ? items : [])) {
        const url = `https://elartegrafico.com/#reto-${it.id}`;
        const msg = it.what === "nuevo"
          ? (Number(it.prize_usd) > 0
            ? { title: `⚡ Reto express: ${String(it.title).slice(0, 60)}`, body: `Tienes hasta las ${hora(it.close_at)}. Los primeros ${it.max_winners} en acertar ganan US$ ${Number(it.prize_usd).toFixed(2).replace(".", ",")} cada uno, retirables al instante.`, url, tag: `reto-${it.id}` }
            : { title: `🎯 Nuevo reto: ${String(it.title).slice(0, 60)}`, body: `Tienes hasta las ${hora(it.close_at)} para responder. Los primeros ${it.max_winners} en acertar ganan ${it.points} puntos.`, url, tag: `reto-${it.id}` })
          : { title: `🏆 Ya salieron los ganadores`, body: `“${String(it.title).slice(0, 60)}”: entra y mira si quedaste entre los ${it.max_winners} primeros.`, url, tag: `reto-res-${it.id}` };
        sent += (await sendAll(keys, "todos", msg)).sent;
        // Discord: el reto express completo va al canal de miembros; en el general, una invitación a hacerse miembro
        if (Number(it.prize_usd) > 0) {
          await discordFor("miembros", msg);
          if (it.what === "nuevo") await discordFor("todos", { title: "⚡ Reto express en dólares para miembros verificados", body: `Ahora mismo hay un reto con premio de US$ ${Number(it.prize_usd).toFixed(2).replace(".", ",")} por ganador, solo para miembros verificados de la comunidad. Hacerte miembro es gratis.`, url: "https://elartegrafico.com/#miembro" });
        } else await discordFor("todos", msg);
      }
      // lanzamiento: a la hora programada se abre la academia y se avisa a todos
      try {
        const opened = await (await db("rpc/launch_claim", { method: "POST", body: "{}" })).json();
        if (opened === true) {
          const m = { title: "🚀 ¡La academia ya abrió!", body: "Entra ya: el curso Fundamentos del trading es gratis con tu cuenta.", url: "https://academia.elartegrafico.com/#inicio", tag: "launch" };
          sent += (await sendAll(keys, "todos", m)).sent;
          await discordFor("todos", m);
        }
      } catch (_) { /* aún no existe */ }
      // sala Oro: borrar mensajes y fotos de más de 7 días
      try {
        const imgs: string[] = await (await db("rpc/room_cleanup_claim", { method: "POST", body: "{}" })).json();
        const paths = (Array.isArray(imgs) ? imgs : []).map((u) => String(u).split("/storage/v1/object/public/sala/")[1]).filter(Boolean);
        if (paths.length) await fetch(`${URL_}/storage/v1/object/sala`, { method: "DELETE", headers: { Authorization: `Bearer ${SR}`, apikey: SR, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: paths }) });
      } catch (_) { /* la sala aún no existe */ }
      // respuestas del chat: aviso al admin
      const dms = await (await db("rpc/dm_push_claim", { method: "POST", body: "{}" })).json();
      for (const d of (Array.isArray(dms) ? dms : [])) {
        sent += (await sendAll(keys, "todos", { title: `💬 ${d.username}${d.n > 1 ? ` (${d.n} mensajes)` : ""}`, body: String(d.body).slice(0, 140),
          url: `https://elartegrafico.com/#admin-chat-${d.user_id}`, tag: `dm-${d.user_id}` }, "admins")).sent;
      }
      // EAG Charts: alertas de precio
      try { sent += await chartAlerts(keys); } catch (_) { /* la tabla de alertas aún no existe */ }
      return json({ items: Array.isArray(items) ? items.length : 0, sent });
    }

    // ¿quién llama? debe ser admin
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!u.ok) return json({ error: "Inicia sesión" }, 401);
    const user = await u.json();
    const prof = await (await db(`profiles?id=eq.${user.id}&select=role,banned`)).json();
    if (!prof[0] || prof[0].role !== "admin" || prof[0].banned) return json({ error: "Solo el administrador puede enviar notificaciones" }, 403);

    if (body.action === "discord-test") {
      const h = await hooks(); const t = { title: "✅ Prueba de El Arte Gráfico", body: "Si ves esto, los avisos de la página ya llegan a este canal.", url: "https://elartegrafico.com/" };
      return json({ general: await toDiscord(h.dc_general, t), miembros: await toDiscord(h.dc_miembros, t, 0x22B892), premium: await toDiscord(h.dc_premium, t) });
    }
    const title = String(body.title || "").slice(0, 80);
    const text = String(body.body || "").slice(0, 200);
    const url = String(body.url || "/").slice(0, 300);
    const aud = ["todos", "premium", "gratis", "oro"].includes(body.audience) ? body.audience : "todos";
    if (!title) return json({ error: "Escribe un título" }, 400);

    const only = typeof body.user_id === "string" && /^[0-9a-f-]{36}$/i.test(body.user_id) ? body.user_id : undefined;
    const r = await sendAll(keys, aud, { title, body: text, url, tag: body.tag || undefined }, only);
    // también a Discord (salvo mensajes personales o si se desmarca "También en Discord")
    let discord = 0;
    if (!only && body.discord !== false && aud !== "gratis") {
      if (body.express) {   // reto express: completo para miembros; en el general, invitación a hacerse miembro
        discord = await discordFor("miembros", { title, body: text, url });
        await discordFor("todos", { title: "⚡ Reto express en dólares para miembros verificados", body: `Ahora mismo hay un reto${Number(body.prize_usd) > 0 ? ` con premio de US$ ${Number(body.prize_usd).toFixed(2).replace(".", ",")} por ganador` : " con premio en dólares"}, solo para miembros verificados de la comunidad. Hacerte miembro es gratis.`, url: "https://elartegrafico.com/#miembro" });
      } else discord = await discordFor(aud, { title, body: text, url });
    }
    return json({ ...r, audience: aud, discord });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
