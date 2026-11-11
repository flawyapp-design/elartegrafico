// Supabase Edge Function "send-push": envía notificaciones a los alumnos. Solo la puede usar un administrador.
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: send-push → pegar este código → Deploy.
import webpush from "npm:web-push@3.6.7";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const keys = await vapid();
    if (body.action === "setup") return json({ publicKey: keys.public_key });

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
    const aud = ["todos", "premium", "gratis"].includes(body.audience) ? body.audience : "todos";
    if (!title) return json({ error: "Escribe un título" }, 400);

    webpush.setVapidDetails("mailto:soporte@elartegrafico.com", keys.public_key, keys.private_key);
    const subs = await (await db("push_subs?select=endpoint,p256dh,auth,user_id,profiles!inner(premium_until,banned)&profiles.banned=is.false")).json();
    const now = Date.now();
    const list = (Array.isArray(subs) ? subs : []).filter((s: any) => {
      const prem = s.profiles?.premium_until && new Date(s.profiles.premium_until).getTime() > now;
      return aud === "todos" || (aud === "premium" ? prem : !prem);
    });
    const payload = JSON.stringify({ title, body: text, url, icon: "/assets/icon-192.png", badge: "/assets/badge-72.png", tag: body.tag || undefined });
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
    return json({ sent, failed, removed: gone.length, audience: aud });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
