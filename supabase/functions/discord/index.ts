// Supabase Edge Function "discord": conecta la cuenta de Discord del alumno y le pone/quita el rol de Afiliado.
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: discord → pegar este código → Deploy.
// Secrets (Edge Functions → Secrets):
//   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET  (Discord Developer Portal → tu app → OAuth2)
//   DISCORD_BOT_TOKEN                         (tu app → Bot → Reset Token)
//   DISCORD_GUILD_ID                          (ID del servidor)
//   DISCORD_ROLE_AFILIADO                     (ID del rol "Afiliado")
// Importante: en "Verify JWT" deja la verificación APAGADA (la función revisa la sesión por su cuenta).

const URL_ = Deno.env.get("SUPABASE_URL")!;
const pick = (legacy: string, json: string) => {
  const v = Deno.env.get(legacy);
  if (v) return v;
  try { const o = JSON.parse(Deno.env.get(json) || "{}"); return o.default || Object.values(o)[0] || ""; } catch { return ""; }
};
const SR = pick("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS") as string;
const ANON = pick("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS") as string;
const CID = Deno.env.get("DISCORD_CLIENT_ID") || "";
const CSEC = Deno.env.get("DISCORD_CLIENT_SECRET") || "";
const BOT = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const GUILD = Deno.env.get("DISCORD_GUILD_ID") || "";
const ROLE = Deno.env.get("DISCORD_ROLE_AFILIADO") || "";
const READY = !!(CID && CSEC && BOT && GUILD && ROLE);
const ALLOWED = ["https://elartegrafico.com/", "https://www.elartegrafico.com/", "http://localhost:8766/"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = (path: string, init: RequestInit = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", ...(init.headers || {}) } });
const dc = (path: string, init: RequestInit = {}) =>
  fetch(`https://discord.com/api/v10${path}`, { ...init, headers: { Authorization: `Bot ${BOT}`, "Content-Type": "application/json", "X-Audit-Log-Reason": "El Arte Grafico: afiliado verificado", ...(init.headers || {}) } });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sessionUser(req: Request) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!t || t === ANON) return null;
  const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${t}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}
async function profile(id: string) {
  const r = await db(`profiles?id=eq.${id}&select=id,role,affiliate,banned,discord_id,discord_name,discord_role`);
  const L = await r.json();
  return Array.isArray(L) ? L[0] : null;
}
async function cronOk(req: Request) {
  const s = req.headers.get("x-cron-secret");
  if (!s) return false;
  const r = await (await db("push_config?id=eq.1&select=cron_secret")).json();
  return Array.isArray(r) && r[0] && r[0].cron_secret === s;
}

// pone o quita el rol según si es afiliado verificado; respeta los límites de Discord
async function syncOne(p: any): Promise<string> {
  if (!p || !p.discord_id) return "sin-discord";
  const want = !!p.affiliate && !p.banned;
  for (let i = 0; i < 3; i++) {
    const r = await dc(`/guilds/${GUILD}/members/${p.discord_id}/roles/${ROLE}`, { method: want ? "PUT" : "DELETE" });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await wait(Math.ceil(((j as any).retry_after || 1) * 1000)); continue; }
    if (r.status === 204 || r.ok) {
      if (!!p.discord_role !== want) await db(`profiles?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ discord_role: want }), headers: { Prefer: "return=minimal" } });
      return want ? "rol-puesto" : "rol-quitado";
    }
    const j: any = await r.json().catch(() => ({}));
    if (j.code === 10007) { // no está en el servidor
      if (p.discord_role) await db(`profiles?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ discord_role: false }), headers: { Prefer: "return=minimal" } });
      return "no-esta-en-el-servidor";
    }
    if (j.code === 50013) return "falta-permiso: sube el rol del bot por encima del rol Afiliado";
    return `error-${r.status}`;
  }
  return "limite";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const action = body.action || "";

  if (action === "config") return json({ clientId: CID || null, ready: READY });
  if (!READY) return json({ error: "Discord aún no está configurado (faltan los secretos de la función)." }, 400);

  // llamada automática desde la base de datos cuando cambia el afiliado de alguien
  if (action === "sync" && (await cronOk(req))) {
    if (body.user_id) return json({ result: await syncOne(await profile(body.user_id)) });
  }

  const user = await sessionUser(req);
  if (!user) return json({ error: "Inicia sesión de nuevo." }, 401);
  const me = await profile(user.id);
  if (!me) return json({ error: "No encontramos tu perfil." }, 404);

  if (action === "link") {
    const redirect = String(body.redirect || "");
    if (!ALLOWED.includes(redirect)) return json({ error: "Dirección de regreso no permitida." }, 400);
    const tr = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CID, client_secret: CSEC, grant_type: "authorization_code", code: String(body.code || ""), redirect_uri: redirect }),
    });
    const tk: any = await tr.json().catch(() => ({}));
    if (!tr.ok || !tk.access_token) return json({ error: "Discord no aceptó la conexión. Inténtalo otra vez." }, 400);
    const du: any = await (await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${tk.access_token}` } })).json();
    if (!du || !du.id) return json({ error: "No pudimos leer tu cuenta de Discord." }, 400);
    // una cuenta de Discord solo puede estar en un perfil
    const other = await (await db(`profiles?discord_id=eq.${du.id}&id=neq.${me.id}&select=id`)).json();
    if (Array.isArray(other) && other.length) return json({ error: "Esa cuenta de Discord ya está conectada a otro perfil de El Arte Gráfico." }, 409);
    const name = du.global_name || du.username || "";
    if (me.discord_id && me.discord_id !== du.id && me.discord_role) await syncOne({ ...me, affiliate: false });
    await db(`profiles?id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ discord_id: du.id, discord_name: name, discord_role: false }), headers: { Prefer: "return=minimal" } });
    // si no está en el servidor, lo agrega (permiso guilds.join)
    const jr = await dc(`/guilds/${GUILD}/members/${du.id}`, { method: "PUT", body: JSON.stringify({ access_token: tk.access_token }) });
    const joined = jr.status === 201;
    const res = await syncOne({ ...me, discord_id: du.id, discord_role: false });
    return json({ ok: true, name, joined, result: res, affiliate: !!me.affiliate });
  }

  if (action === "unlink") {
    if (me.discord_id && me.discord_role) await syncOne({ ...me, affiliate: false });
    await db(`profiles?id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ discord_id: null, discord_name: null, discord_role: false }), headers: { Prefer: "return=minimal" } });
    return json({ ok: true });
  }

  if (action === "resync") return json({ result: await syncOne(me) });

  // solo admin: revisa a todos los conectados
  if (action === "sync") {
    if (me.role !== "admin") return json({ error: "Solo administradores." }, 403);
    const L = await (await db("profiles?discord_id=not.is.null&select=id,affiliate,banned,discord_id,discord_role&limit=2000")).json();
    const out: Record<string, number> = {};
    for (const p of (Array.isArray(L) ? L : [])) {
      const r = await syncOne(p);
      out[r] = (out[r] || 0) + 1;
      await wait(250);
    }
    return json({ ok: true, total: Array.isArray(L) ? L.length : 0, out });
  }
  return json({ error: "Acción desconocida." }, 400);
});
