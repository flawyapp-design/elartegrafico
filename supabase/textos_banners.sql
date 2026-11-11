-- =====================================================================
-- Banners nuevos del inicio + textos actualizados. Se puede correr varias veces.
--  - Los banners que tenías en el inicio quedan APAGADOS (no se borran): los puedes
--    volver a prender en Admin → Banners.
--  - Actualiza el texto de la página de precios, la tarjeta "Comunidad" y la fecha de los textos legales.
-- =====================================================================

-- 1) Banners del inicio
update public.slides set active = false where place = 'home' and image_url not like '%/assets/banners/%';
delete from public.slides where place = 'home' and image_url like '%/assets/banners/%';
insert into public.slides (place, title, body, image_url, cta_text, cta_link, sort, active) values
('home', 'Lee el gráfico como un arte',
 'El método de El Arte Gráfico para Boom y Crash: estructura, zonas, entradas y stop loss con reglas claras. Crea tu cuenta gratis y pruébalo.',
 'https://elartegrafico.com/assets/banners/metodo.webp', 'Empieza gratis', '#registro', 1, true),
('home', '¿Ganaste? Lo sabrás en 3 horas',
 'Cada día un reto nuevo. Los 5 primeros en acertar ganan puntos que cambias por USDT, pero nadie lo sabe hasta el final.',
 'https://elartegrafico.com/assets/banners/retos.webp', 'Ver el reto de hoy', '#retos', 2, true),
('home', 'Bienvenido a la Sala Oro',
 'Chat privado, lives y operativas para los traders Oro y Diamond. Comparte tus gráficas con los que van en serio.',
 'https://elartegrafico.com/assets/banners/sala-oro.webp', 'Ver planes', '#premium', 3, true),
('home', 'Que todos vean tu progreso',
 'Sube en el ranking y muestra tu nivel, tus placas y tus retos ganados. Toca cualquier nombre para ver su perfil.',
 'https://elartegrafico.com/assets/banners/ranking.webp', 'Ver ranking', '#ranking', 4, true);

-- 2) Textos del sitio
insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
update public.site_settings set data = data
  || jsonb_build_object(
       'premiumTitle', 'Elige tu plan',
       'premiumText', 'Suscríbete con Cobre, Plata, Oro o Diamond, o compra solo el curso. Todos los planes incluyen la academia completa. Pagas con Binance Pay en USDT y no hay cobros automáticos.',
       'premiumItems', jsonb_build_array('La academia completa, con todos los cursos', 'Ejercicios con zona, stop loss y repetición', 'Práctica libre ilimitada', 'Desde Oro: Sala Oro con chat privado, lives y operativas'))
where id = 1;

-- tarjeta "Comunidad" de "Qué vas a aprender"
update public.site_settings set data = jsonb_set(data, '{cards}', (
    select jsonb_agg(case when c->>'title' = 'Comunidad'
      then jsonb_build_object('title', 'Comunidad', 'text', 'Noticias, retos diarios con premios y, desde el plan Oro, la Sala Oro: chat privado, lives y operativas.')
      else c end order by o)
    from jsonb_array_elements(data->'cards') with ordinality t(c, o)))
where id = 1 and jsonb_typeof(data->'cards') = 'array';

-- 3) Fecha de los textos legales (sale como "Última actualización")
update public.site_settings set data = jsonb_set(data, '{legalInfo}', coalesce(data->'legalInfo', '{}'::jsonb) || '{"date":"11 de noviembre de 2026"}'::jsonb)
where id = 1;

-- 4) Revisión: si esta consulta muestra algún nombre (terminos, privacidad, pagos, retos…), ese texto legal
--    lo habías editado a mano y NO tomará la versión nueva. Entra a Admin → Legal y toca
--    "Restaurar texto base" en ese documento. Si sale vacío, todo quedó actualizado.
select jsonb_object_keys(coalesce(data->'legalDocs', '{}'::jsonb)) as textos_legales_editados_a_mano
from public.site_settings where id = 1;
