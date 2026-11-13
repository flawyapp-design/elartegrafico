/* El Arte Gráfico — service worker: app instalable, caché y notificaciones */
const V = "ag-v4";
const SHELL = ["/", "/index.html", "/styles.css", "/config.js", "/js/chart.js", "/js/api.js", "/js/legal.js", "/js/app.js", "/js/player.js",
  "/assets/logo_mark.webp", "/assets/logo_circle.webp", "/assets/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;            // Supabase, videos, etc.: siempre por red
  if (u.pathname.startsWith("/data/")) {                                          // velas: primero caché (no cambian)
    e.respondWith(caches.open(V).then(async c => (await c.match(r)) || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; })));
    return;
  }
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })   // código: primero red, sin conexión usa caché
    .catch(() => caches.match(r).then(m => m || (r.mode === "navigate" ? caches.match("/index.html") : undefined))));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "El Arte Gráfico", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "El Arte Gráfico", {
    body: d.body || "", icon: d.icon || "/assets/icon-192.png", badge: d.badge || "/assets/badge-72.png",
    tag: d.tag, data: { url: d.url || "/" }, lang: "es"
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.split("#")[0] === target.split("#")[0] && "focus" in c) { c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
