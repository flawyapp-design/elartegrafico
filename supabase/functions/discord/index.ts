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
const SOPORTE = Deno.env.get("DISCORD_SOPORTE_CHANNEL") || "";   // canal donde se abren los tickets (hilos privados)
const SOPORTE_ROL = Deno.env.get("DISCORD_SOPORTE_ROL") || "";   // opcional: rol de tu equipo, se menciona al abrir un ticket
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

// ---------- tickets de soporte ----------
async function dcPost(channel: string, payload: unknown) {
  for (let i = 0; i < 3; i++) {
    const r = await dc(`/channels/${channel}/messages`, { method: "POST", body: JSON.stringify(payload) });
    if (r.status === 429) { const j: any = await r.json().catch(() => ({})); await wait(Math.ceil((j.retry_after || 1) * 1000)); continue; }
    if (r.ok) return (await r.json()).id as string;
    return null;
  }
  return null;
}
// si ya tenía ticket y conecta su Discord después, lo agrega a su ticket
async function addToTicket(uid: string, did: string) {
  try {
    const t = (await (await db(`dm_threads?user_id=eq.${uid}&select=dc_thread`)).json())[0];
    if (t && t.dc_thread && t.dc_thread !== "creando") await dc(`/channels/${t.dc_thread}/thread-members/${did}`, { method: "PUT" });
  } catch { /* sin ticket */ }
}
async function ticketOf(uid: string): Promise<string | null> {
  for (let i = 0; i < 6; i++) {   // si otro proceso lo está creando, espera un momento
    const t = (await (await db(`dm_threads?user_id=eq.${uid}&select=dc_thread`)).json())[0];
    if (!t || !t.dc_thread) return null;
    if (t.dc_thread !== "creando") return t.dc_thread;
    await wait(700);
  }
  return null;
}
async function ticketOpen(uid: string, p: any): Promise<string | null> {
  // reserva para que dos mensajes seguidos no abran dos tickets
  const claim = await (await db(`dm_threads?user_id=eq.${uid}&dc_thread=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ dc_thread: "creando" }) })).json();
  if (!Array.isArray(claim) || !claim.length) return await ticketOf(uid);
  const tag = p.affiliate ? " ✅" : "";
  const r = await dc(`/channels/${SOPORTE}/threads`, { method: "POST", body: JSON.stringify({ name: `🎫 ${String(p.username || "alumno").slice(0, 80)}${tag}`, type: 12, invitable: false, auto_archive_duration: 10080 }) });
  if (!r.ok) { await db(`dm_threads?user_id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ dc_thread: null }) }); return null; }
  const th: any = await r.json();
  if (p.discord_id) await dc(`/channels/${th.id}/thread-members/${p.discord_id}`, { method: "PUT" });
  const plan = p.premium_until && new Date(p.premium_until) > new Date() ? (p.plan || "premium") : "gratis";
  const intro = await dcPost(th.id, {
    content: `${SOPORTE_ROL ? `<@&${SOPORTE_ROL}> ` : ""}🎫 **Ticket de ${p.username || "alumno"}**${p.discord_id ? ` · <@${p.discord_id}>` : " · (no ha conectado su Discord)"}\nPlan: ${plan}${p.affiliate ? " · Miembro verificado ✅" : ""}\nLo que escriban aquí le llega a su chat en la página, y lo que escriba en la página aparece aquí.\nChat en la página: https://elartegrafico.com/#admin-chat-${uid}`,
    allowed_mentions: { roles: SOPORTE_ROL ? [SOPORTE_ROL] : [], users: p.discord_id ? [p.discord_id] : [] },
  });
  await db(`dm_threads?user_id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ dc_thread: th.id, dc_last: intro || null }) });
  return th.id;
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

  // ---------- Soporte: tickets en Discord ----------
  if ((action === "ticket-msg" || action === "ticket-poll") && !(await cronOk(req))) return json({ error: "No autorizado" }, 403);
  if (action === "ticket-msg") {
    if (!SOPORTE) return json({ skip: "sin canal de soporte" });
    const m = (await (await db(`dm_messages?id=eq.${body.id}&select=id,user_id,from_admin,body,dc_src`)).json())[0];
    if (!m || m.dc_src) return json({ skip: true });
    const p = (await (await db(`profiles?id=eq.${m.user_id}&select=id,username,discord_id,affiliate,plan,premium_until`)).json())[0] || {};
    let t = await ticketOf(m.user_id);
    // un mensaje de la página llegado justo con el del alumno: espera a que se abra su ticket
    for (let i = 0; !t && m.from_admin && i < 4; i++) { await wait(1200); t = await ticketOf(m.user_id); }
    if (!t) {
      if (m.from_admin) return json({ skip: "sin ticket" });
      t = await ticketOpen(m.user_id, p);
      if (!t) return json({ error: "no se pudo abrir el ticket" }, 500);
    }
    const who = m.from_admin ? "🟡 **El Arte Gráfico** (desde la página)" : `🔵 **${p.username || "Alumno"}** (desde la página)`;
    const r = await dcPost(t, { content: `${who}\n${String(m.body).slice(0, 1800)}`, allowed_mentions: { parse: [] } });
    return json({ ok: r });
  }
  if (action === "ticket-poll") {
    if (!SOPORTE) return json({ skip: true });
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const T = await (await db(`dm_threads?dc_thread=not.is.null&dc_thread=neq.creando&last_at=gt.${since}&select=user_id,dc_thread,dc_last`)).json();
    let copied = 0;
    for (const th of (Array.isArray(T) ? T : [])) {
      const p = (await (await db(`profiles?id=eq.${th.user_id}&select=discord_id`)).json())[0] || {};
      const r = await dc(`/channels/${th.dc_thread}/messages?limit=50${th.dc_last ? `&after=${th.dc_last}` : ""}`);
      if (r.status === 429) { await wait(1500); continue; }
      if (!r.ok) continue;
      const L: any[] = ((await r.json()) || []).reverse();   // del más viejo al más nuevo
      if (!L.length) continue;
      let last = th.dc_last, staffText = "";
      for (const msg of L) {
        last = msg.id;
        if (!th.dc_last) continue;          // primera vez: solo marca dónde va
        if (msg.author?.bot || msg.type !== 0 && msg.type !== 19) continue;
        let text = String(msg.content || "").trim();
        if (msg.attachments?.length) text += (text ? "\n" : "") + "📎 Adjunto en Discord: " + msg.attachments.map((a: any) => a.url).join(" ");
        if (!text) continue;
        const fromStaff = !p.discord_id || msg.author?.id !== p.discord_id;
        await db("dm_messages", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: th.user_id, from_admin: fromStaff, body: text.slice(0, 1500), dc_src: true, notified: fromStaff }) });
        if (fromStaff) staffText = text;
        copied++;
      }
      await db(`dm_threads?user_id=eq.${th.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ dc_last: last, ...(copied ? { last_at: new Date().toISOString(), open: true } : {}) }) });
      // aviso al celular del alumno cuando le responden desde Discord
      if (staffText) {
        const sec = req.headers.get("x-cron-secret") || "";
        await fetch(`${URL_}/functions/v1/send-push`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}`, "x-cron-secret": sec }, body: JSON.stringify({ action: "dm-user", user_id: th.user_id, text: staffText }) }).catch(() => {});
      }
      await wait(200);
    }
    return json({ ok: true, copied });
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
    await addToTicket(me.id, du.id);
    return json({ ok: true, name, joined, result: res, affiliate: !!me.affiliate });
  }

  // entró con "Ingresar con Discord": ya trae el token de Discord, sin pasar por la autorización otra vez
  if (action === "link-token") {
    const tok = String(body.token || "");
    if (!tok) return json({ error: "Falta el token de Discord." }, 400);
    const du: any = await (await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${tok}` } })).json().catch(() => ({}));
    if (!du || !du.id) return json({ error: "No pudimos leer tu cuenta de Discord." }, 400);
    const other = await (await db(`profiles?discord_id=eq.${du.id}&id=neq.${me.id}&select=id`)).json();
    if (Array.isArray(other) && other.length) return json({ error: "Esa cuenta de Discord ya está conectada a otro perfil de El Arte Gráfico." }, 409);
    const name = du.global_name || du.username || "";
    await db(`profiles?id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ discord_id: du.id, discord_name: name }), headers: { Prefer: "return=minimal" } });
    const jr = await dc(`/guilds/${GUILD}/members/${du.id}`, { method: "PUT", body: JSON.stringify({ access_token: tok }) });
    const res = await syncOne({ ...me, discord_id: du.id });
    await addToTicket(me.id, du.id);
    return json({ ok: true, name, joined: jr.status === 201, result: res });
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
