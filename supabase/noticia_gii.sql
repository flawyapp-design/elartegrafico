-- =====================================================================
-- NOTICIA: lanzamiento del GII · Grupal Intensivo e Inmersivo
-- Queda fijada arriba en Noticias. Para ponerle el flyer: Admin → Noticias
-- → edita la publicación y sube la imagen.
-- Correr en Supabase → SQL Editor (antes, supabase/intensivo.sql). Se puede
-- correr varias veces: no la duplica.
-- =====================================================================

insert into public.posts (title, body, image_url, category, pinned, premium_only, allow_comments)
select
  '🔴 Llega el GII: Grupal Intensivo e Inmersivo, en vivo conmigo',
  'Les presento algo que no van a encontrar en otro lado: un intensivo **en vivo, dentro de EAG Charts**, nuestra propia plataforma de gráficos.

No es mirar una pantalla compartida. Cada uno está en su propio gráfico y la clase pasa ahí mismo:

- **Replay juntos:** volvemos a un día del mercado y lo vemos vela por vela, todos al mismo tiempo. Simulas tus entradas y ves si ganabas o perdías.
- **Práctica en vivo:** te doy el turno, marcas tu zona y toda la clase la ve con tu nombre.
- **Evaluación en tu gráfico:** veo tu temporalidad, hacia dónde te mueves y cómo marcas. Te corrijo en el momento y, si sirve para todos, lo muestro a la clase.
- **Mercado real en vivo:** también revisamos el mercado del momento y vemos cómo marca cada uno.
- **Voz, mano y encuestas:** me escuchas, levantas la mano para hablar y respondes encuestas rápidas.

### El método El Arte Gráfico, actualizado
Una forma nueva y más clara de leer el gráfico, con más reglas para saber cuándo entrar, cuándo salir y cuándo no hacer nada. En el intensivo lo aplicas mientras lo explico.

### Precio y cupo
- **50 USD**, pago único.
- Al terminar, sigues practicando: el **Replay y la Práctica** de EAG Charts quedan activos para que sigas estudiando.
- **Se realiza si se completa el cupo.** En la página del GII ves cuántos van inscritos.

La **Biblioteca de clases** (grabaciones) baja a **30 USD**. La diferencia: la biblioteca la ves a tu ritmo; el GII es en vivo conmigo, practicando y corrigiendo en el momento.

Reserva tu cupo aquí: https://elartegrafico.com/#intensivo',
  '', 'Anuncio', true, false, true
where not exists (select 1 from public.posts where title like '%Llega el GII%');
