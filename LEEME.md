# El Arte Gráfico Academy — guía de instalación

La web está lista para publicarse en **academia.elartegrafico.com**.

- Funciona **sin compilar nada**: son archivos estáticos (`public/`) y una base de datos en Supabase.
- Mientras no conectes Supabase, abre en **modo de prueba**: todo se guarda en tu navegador.
  - Administrador de prueba: `admin@elartegrafico.com` / `admin1234`.

---

## 1. GitHub (para que yo pueda hacer cambios en vivo)

1. Crea una cuenta en https://github.com (si no tienes).
2. Crea un repositorio **privado** llamado `elartegrafico-academy`.
3. Dime el nombre exacto (por ejemplo `tuusuario/elartegrafico-academy`). Yo subo el código y, desde ahí, cada cambio que haga se publica solo en la web.

## 2. Supabase (base de datos, login y archivos)

1. Crea una cuenta en https://supabase.com y un proyecto nuevo.
   - Región: **East US** (la más cercana a Colombia).
   - Guarda la contraseña de la base de datos en un lugar seguro. **No me la pases.**
2. Ve a **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y presiona **Run**.
3. (Opcional) En otra consulta pega `supabase/seed.sql` y presiona **Run**. Esto carga los textos, banners y módulos de ejemplo.
4. Ve a **Authentication → URL Configuration**:
   - **Site URL:** `https://academia.elartegrafico.com`
   - **Redirect URLs:** agrega `https://academia.elartegrafico.com/*`
5. Ve a **Authentication → Emails** y personaliza los correos (confirmación de cuenta, recuperar contraseña) con tu marca. Para enviar muchos correos conviene conectar un proveedor SMTP (Resend, Brevo…).
6. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key** (es pública por diseño; la seguridad la dan las reglas de la base de datos).
7. Pega esos dos datos en `public/config.js`.

## 3. Anti-bots (Cloudflare Turnstile, gratis)

1. Crea una cuenta en https://dash.cloudflare.com → **Turnstile → Add site**.
   - Dominio: `academia.elartegrafico.com`
2. Copia la **Site Key** en `public/config.js` (`TURNSTILE_SITE_KEY`).
3. En Supabase: **Authentication → Attack Protection → Enable Captcha protection → Turnstile** y pega la **Secret Key**.

Sin Turnstile, la web usa un captcha propio. Sirve para frenar bots simples, pero Turnstile protege de verdad porque se valida en el servidor.

## 4. Vercel (hosting) y dominio

1. Crea una cuenta en https://vercel.com con tu GitHub.
2. **Add New → Project →** importa `elartegrafico-academy`.
   - **Root Directory:** `public`
   - **Framework:** Other
   - Sin comando de build.
3. **Settings → Domains →** agrega `academia.elartegrafico.com`.
   - Vercel te mostrará un registro **CNAME** (algo como `cname.vercel-dns.com`).
   - Agrégalo en el panel DNS de donde compraste `elartegrafico.com`.
   - Lo que ya tengas en `elartegrafico.com` no se toca.

## 5. Conviértete en administrador

1. Entra a la web y **crea tu cuenta** normal.
2. En Supabase → SQL Editor ejecuta (cambia el usuario):
   ```sql
   update public.profiles set role = 'admin' where username = 'TU_USUARIO';
   ```
3. Recarga la web: verás **Administración** en tu menú.

## 6. Dar acceso premium

**Panel → Alumnos.** Tienes estas opciones por alumno:

- **Activar premium:** +30 días, +90 días o una fecha exacta.
- **Quitar premium.**
- **Suspender** la cuenta.
- **Reiniciar** sus 5 gráficas de prueba.
- **Hacer administrador.**

### Pagos con Binance Pay (semiautomático)

1. Corre `supabase/pagos.sql` en Supabase → SQL Editor (una sola vez).
2. En **Panel → Sitio y textos → Pagos con Binance Pay** pon tu Binance Pay ID y tus planes (`Nombre | días | precio`).
3. El alumno paga desde Binance y registra el **ID de orden** en la página Premium.
4. En **Panel → Pagos** revisas en tu Binance que llegó y le das **Aprobar**: se le suman los días de premium.

---

## Qué puede editar el administrador

| Sección | Qué hace |
|---|---|
| Estadísticas | Registrados, premium, visitas, visitantes únicos, horas de video, ejercicios, calificación, gráfica diaria |
| Sitio y textos | Nombre, logos, portada, tarjetas, mercados, premium, contacto, redes, aviso legal |
| Banners | Diapositivas de la portada y de la página de ingreso/registro (con imagen) |
| Módulos y lecciones | Categorías (Fundamentos, Sintéticos, Forex…), orden, borrador/publicado, video, texto |
| Ejercicios | Gráfica (zona en H1/M5, SL en M5, repetición), “no operar”, cálculo con fórmula, opción múltiple; prueba gratis, práctica o lección |
| Noticias | Publicaciones con imagen, fijadas, solo premium, comentarios |
| Opiniones | Aprobar u ocultar calificaciones de alumnos |
| Alumnos | Premium, suspensión, rol, prueba gratis |
| Archivos | Subir imágenes y videos y copiar su enlace |

## Seguridad

- Las **respuestas** de los ejercicios están en una tabla que nadie puede leer directamente. Solo se entregan al responder, a través de la función `grade_exercise`.
- Esa función solo responde si eres premium, o si es una gráfica de prueba y te quedan intentos (máximo 5).
- Las lecciones solo las leen los premium. Las noticias marcadas "solo premium" también.
- Comentan solo los premium. Las opiniones se publican solo cuando el administrador las aprueba.

## Datos de las gráficas

- **Velas:** `public/data/h1` (H1 de 2026) y `public/data/m5/<mercado>/<mes>.json` (M5 de 2026).
- **Actualizarlas:** exporta de MT5 con el script de siempre y pídeme regenerarlas.
- **Nuevos mercados** (Step, Volatility, Forex, oro): se agregan exportando sus velas.

## Ranking público y reseñas de módulos
1. Corre `supabase/ranking_publico.sql` en Supabase → SQL Editor: el ranking lo ve cualquiera (también sin cuenta), muestra la placa premium y la bandera del país, y la lista de alumnos del admin trae el país.
2. Corre `supabase/resenas_modulos.sql`: al terminar un módulo el alumno debe dejar su reseña (estrellas, cómo le pareció y qué mejorar) para abrir el siguiente. Las ves en Admin → Reseñas de módulos. Se puede desactivar por módulo en su editor ("Reseña al terminar").
