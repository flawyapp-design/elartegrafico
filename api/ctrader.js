/* Puente con cTrader Open API (Spotware) para el panel "Operar" de EAG Charts. SOLO administradores.
   - Comprueba en Supabase que quien pide es admin (con el token de su sesión).
   - Guarda en secreto el Client Secret: viene de la variable de entorno CTRADER_CLIENT_SECRET de Vercel (nunca está en el código).
   - Acciones: "token" (canjea el código de autorización), "refresh" (renueva el token) y "app" (credenciales para autenticar la app
     en el WebSocket de cTrader; solo se entregan a un admin con sesión). No guarda nada. */
const CLIENT_ID = "49178_WpEJlwpPj9cPU95MEtnRoHh1AyB826gCatrchdTvWVWPzA8kmR";
const SB_URL = "https://animmecpzvhvnwzjljxg.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaW1tZWNwenZodm53empsanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTI0OTQsImV4cCI6MjEwOTc2ODQ5NH0.yHoJUR4e_eN29TRcKFclNyUgR2g0Glk_IARbJ8438Nc";   /* clave pública (anon) de Supabase: es pública por diseño */
const ORIGINS = ["https://charts.elartegrafico.com", "https://elartegrafico.com", "https://www.elartegrafico.com", "https://academia.elartegrafico.com"];
const REDIRECTS = ["https://charts.elartegrafico.com/charts", "https://elartegrafico.com/charts", "https://www.elartegrafico.com/charts"];

async function isAdmin(sb) {
  if (typeof sb !== "string" || sb.length < 20 || sb.length > 4096) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${sb}`, "Content-Type": "application/json" }, body: "{}" });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch (e) { return false; }
}
async function tokenCall(params) {
  const u = new URL("https://openapi.ctrader.com/apps/token");
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.accessToken) throw new Error(j.description || j.errorCode || "cTrader no aceptó la autorización");
  return { accessToken: j.accessToken, refreshToken: j.refreshToken, expiresIn: j.expiresIn || 0 };
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  if (ORIGINS.includes(origin)) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.setHeader("Access-Control-Allow-Methods", "POST"); res.setHeader("Access-Control-Allow-Headers", "content-type"); return res.status(204).end(); }
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!ORIGINS.includes(origin)) return res.status(403).json({ error: "Origen no permitido" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  const secret = process.env.CTRADER_CLIENT_SECRET || "";
  if (!secret) return res.status(503).json({ error: "Falta CTRADER_CLIENT_SECRET en Vercel (Settings → Environment Variables)." });
  if (!(await isAdmin(b.sb))) return res.status(403).json({ error: "Solo administradores." });
  try {
    if (b.action === "app") return res.status(200).json({ clientId: CLIENT_ID, clientSecret: secret });
    if (b.action === "token") {
      if (!REDIRECTS.includes(b.redirect_uri) || !/^[\w\-.~]{6,1024}$/.test(b.code || "")) return res.status(400).json({ error: "Datos inválidos" });
      return res.status(200).json(await tokenCall({ grant_type: "authorization_code", code: b.code, redirect_uri: b.redirect_uri, client_id: CLIENT_ID, client_secret: secret }));
    }
    if (b.action === "refresh") {
      if (!/^[\w\-.~]{6,2048}$/.test(b.refresh_token || "")) return res.status(400).json({ error: "Datos inválidos" });
      return res.status(200).json(await tokenCall({ grant_type: "refresh_token", refresh_token: b.refresh_token, client_id: CLIENT_ID, client_secret: secret }));
    }
    return res.status(400).json({ error: "Acción desconocida" });
  } catch (e) { return res.status(400).json({ error: String(e.message || e) }); }
};
