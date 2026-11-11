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
async function sendAll(keys: any, aud: string, msg: Record<string, unknown>, only?: string) {
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

const hora = (t: string) => new Date(t).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const keys = await vapid();
    if (body.action === "setup") return json({ publicKey: keys.public_key });

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
          ? { title: `🎯 Nuevo reto: ${String(it.title).slice(0, 60)}`, body: `Tienes hasta las ${hora(it.close_at)} para responder. Los primeros ${it.max_winners} en acertar ganan ${it.points} puntos.`, url, tag: `reto-${it.id}` }
          : { title: `🏆 Ya salieron los ganadores`, body: `“${String(it.title).slice(0, 60)}”: entra y mira si quedaste entre los ${it.max_winners} primeros.`, url, tag: `reto-res-${it.id}` };
        sent += (await sendAll(keys, "todos", msg)).sent;
      }
      // lanzamiento: a la hora programada se abre la academia y se avisa a todos
      try {
        const opened = await (await db("rpc/launch_claim", { method: "POST", body: "{}" })).json();
        if (opened === true) sent += (await sendAll(keys, "todos", { title: "🚀 ¡La academia ya abrió!", body: "Entra ya: empieza con tu prueba gratis del módulo de introducción.", url: "https://academia.elartegrafico.com/#inicio", tag: "launch" })).sent;
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
      return json({ items: Array.isArray(items) ? items.length : 0, sent });
    }

    // ¿quién llama? debe ser admin
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!u.ok) return json({ error: "Inicia sesión" }, 401);
    const user = await u.json();
    const prof = await (await db(`profiles?id=eq.${user.id}&select=role,banned`)).json();
    if (!prof[0] || prof[0].role !== "admin" || prof[0].banned) return json({ error: "Solo el administrador puede enviar notificaciones" }, 403);

    const title = String(body.title || "").slice(0, 80);
    const text = String(body.body || "").slice(0, 200);
    const url = String(body.url || "/").slice(0, 300);
    const aud = ["todos", "premium", "gratis", "oro"].includes(body.audience) ? body.audience : "todos";
    if (!title) return json({ error: "Escribe un título" }, 400);

    const only = typeof body.user_id === "string" && /^[0-9a-f-]{36}$/i.test(body.user_id) ? body.user_id : undefined;
    const r = await sendAll(keys, aud, { title, body: text, url, tag: body.tag || undefined }, only);
    return json({ ...r, audience: aud });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
