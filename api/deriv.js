/* Puente con la API nueva de Deriv (solo para el panel "Operar" de EAG Charts).
   - No guarda nada: recibe el código o el token del navegador del usuario, lo pasa a Deriv y devuelve la respuesta.
   - No hay secretos aquí: la app de Deriv es pública (OAuth con PKCE). Deriv pide que el canje del código
     se haga desde un servidor, por eso existe este archivo.
   - Solo acepta pedidos desde los dominios de El Arte Gráfico y solo habla con 3 direcciones fijas de Deriv. */
const APP_ID = "34YKKItWilip0O9qQFpQ8";
const ORIGINS = ["https://charts.elartegrafico.com", "https://elartegrafico.com", "https://www.elartegrafico.com", "https://academia.elartegrafico.com"];
const REDIRECTS = ["https://charts.elartegrafico.com/charts", "https://elartegrafico.com/charts", "https://www.elartegrafico.com/charts"];
const API = "https://api.derivws.com/trading/v1/options";

const okToken = t => typeof t === "string" && t.length > 10 && t.length < 4096 && /^[\w\-.~+/=]+$/.test(t);

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  if (ORIGINS.includes(origin)) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.setHeader("Access-Control-Allow-Methods", "POST"); res.setHeader("Access-Control-Allow-Headers", "content-type"); return res.status(204).end(); }
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!ORIGINS.includes(origin)) return res.status(403).json({ error: "Origen no permitido" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  try {
    if (b.action === "token") {
      if (!REDIRECTS.includes(b.redirect_uri)) return res.status(400).json({ error: "redirect_uri no permitido" });
      if (!/^[\w\-.~]{10,512}$/.test(b.code || "") || !/^[\w\-.~]{43,128}$/.test(b.code_verifier || "")) return res.status(400).json({ error: "Datos inválidos" });
      const r = await fetch("https://auth.deriv.com/oauth2/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", client_id: APP_ID, code: b.code, code_verifier: b.code_verifier, redirect_uri: b.redirect_uri }).toString()
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) return res.status(r.status || 400).json({ error: (j && (j.error_description || j.error)) || "Deriv no aceptó el inicio de sesión" });
      return res.status(200).json({ access_token: j.access_token, expires_in: j.expires_in || 0 });
    }
    if (b.action === "accounts") {
      if (!okToken(b.token)) return res.status(400).json({ error: "Token inválido" });
      const r = await fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${b.token}`, "Deriv-App-ID": APP_ID } });
      const j = await r.json().catch(() => ({}));
      return res.status(r.status).json(j);
    }
    if (b.action === "otp") {
      if (!okToken(b.token) || !/^[\w\-]{2,40}$/.test(String(b.account_id || ""))) return res.status(400).json({ error: "Datos inválidos" });
      const r = await fetch(`${API}/accounts/${encodeURIComponent(b.account_id)}/otp`, { method: "POST", headers: { Authorization: `Bearer ${b.token}`, "Deriv-App-ID": APP_ID } });
      const j = await r.json().catch(() => ({}));
      return res.status(r.status).json(j);
    }
    return res.status(400).json({ error: "Acción desconocida" });
  } catch (e) {
    return res.status(502).json({ error: "No se pudo hablar con Deriv. Intenta de nuevo." });
  }
};
