/* Protege el código de EAG Charts al publicar: lo ofusca y lo bloquea al dominio de El Arte Gráfico.
   Si algo falla, NO detiene la publicación (deja el archivo como estaba). */
const fs = require("fs");
let JO;
try { JO = require("javascript-obfuscator"); } catch (e) { console.warn("[protect] javascript-obfuscator no disponible:", e.message); process.exit(0); }
const files = ["public/js/charts-app.js", "public/js/eag-widget.js"];
const opts = {
  compact: true, simplify: true,
  identifierNamesGenerator: "hexadecimal", renameGlobals: false,
  stringArray: true, stringArrayEncoding: ["base64"], stringArrayThreshold: 0.8, rotateStringArray: true, shuffleStringArray: true,
  controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false, debugProtection: false,
  domainLock: [".elartegrafico.com"], domainLockRedirectUrl: "https://elartegrafico.com",
  unicodeEscapeSequence: false, sourceMap: false
};
for (const f of files) {
  try {
    const src = fs.readFileSync(f, "utf8");
    const out = JO.obfuscate(src, opts).getObfuscatedCode();
    fs.writeFileSync(f, "/* © El Arte Gráfico. Todos los derechos reservados. Prohibida su copia. */\n" + out);
    console.log(`[protect] ${f}: ${src.length} → ${out.length} bytes`);
  } catch (e) { console.warn(`[protect] ${f} sin cambios:`, e.message); }
}
