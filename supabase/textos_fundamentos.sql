-- =====================================================================
-- Textos y banner: "Fundamentos del trading es gratis; la estrategia de cada mercado es lo que se paga".
-- Correr DESPUÉS de curso_fundamentos.sql. Se puede correr varias veces.
-- =====================================================================

-- 1) Banner nuevo, primero en el inicio
delete from public.slides where place = 'home' and image_url like '%/assets/banners/fundamentos.webp';
insert into public.slides (place, title, body, image_url, cta_text, cta_link, sort, active) values
('home', 'Aprende trading gratis',
 'El curso Fundamentos del trading es gratis y completo con tu cuenta: bróker, MT5, velas, estructura y riesgo. Después eliges la estrategia de tu mercado.',
 'https://elartegrafico.com/assets/banners/fundamentos.webp', 'Crear cuenta gratis', '#registro', 0, true);

-- el banner del método ahora apunta a la estrategia (lo que se paga)
update public.slides set
  title = 'La estrategia de Boom y Crash',
  body = 'Cuando termines Fundamentos, aplica el método de El Arte Gráfico en Boom y Crash: zonas, entradas y stop loss con reglas claras.',
  cta_text = 'Ver precios', cta_link = '#premium', sort = 1
where place = 'home' and image_url like '%/assets/banners/metodo.webp';

-- 2) Portada y página de precios
update public.site_settings set data = data
  || jsonb_build_object(
       'heroText', 'Empieza gratis con el curso Fundamentos del trading. Cuando estés listo, elige la estrategia de El Arte Gráfico para tu mercado y practícala en gráficas reales.',
       'premiumTitle', 'Elige tu plan',
       'premiumText', 'Fundamentos del trading es gratis con tu cuenta. Lo que se paga es la estrategia de cada mercado: compra solo el curso que quieras, o suscríbete con Cobre, Plata, Oro o Diamond y tienes todos los cursos. Pagas con Binance Pay en USDT y no hay cobros automáticos.',
       'premiumItems', jsonb_build_array('Todos los cursos de estrategia, como Boom y Crash', 'Ejercicios con zona, stop loss y repetición', 'Práctica libre ilimitada', 'Desde Oro: Sala Oro con chat privado, lives y operativas'))
where id = 1;

-- 3) Preguntas frecuentes (solo si las editaste en Admin; si no, la página ya usa las nuevas)
update public.site_settings set data = jsonb_set(data, '{faq}',
  jsonb_build_array(jsonb_build_object('q', '¿Qué es gratis y qué se paga?',
    'a', 'El curso Fundamentos del trading es gratis y completo con tu cuenta: bróker, MT5, velas, estructura y gestión del riesgo. Lo que tiene costo son los cursos de estrategia para cada mercado, como Boom y Crash: lo compras una vez o lo tienes con cualquier plan.'))
  || (select coalesce(jsonb_agg(f), '[]'::jsonb) from jsonb_array_elements(data->'faq') f where f->>'q' <> '¿Qué es gratis y qué se paga?'))
where id = 1 and jsonb_typeof(data->'faq') = 'array' and jsonb_array_length(data->'faq') > 0;

-- 4) Banner de la pantalla de ingreso
update public.slides set title = 'Fundamentos del trading, gratis',
  body = 'Crea tu cuenta y haz el curso completo sin pagar: bróker, MT5, velas, estructura y riesgo.'
where place = 'login' and title in ('5 gráficas de prueba gratis');

select place, sort, title, active from public.slides where place in ('home', 'login') order by place, sort;
