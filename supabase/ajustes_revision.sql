-- =====================================================================
-- Ajustes de la revisión completa del sitio. Se puede correr varias veces.
-- =====================================================================

-- 1) Banner de Fundamentos con imagen sin letras (en celular ya no se mezcla con el título)
update public.slides set image_url = 'https://elartegrafico.com/assets/banners/fundamentos-v2.webp'
where image_url like '%/assets/banners/fundamentos.webp%';

-- 2) Banner de la pantalla de registro: mismo texto que el resto del sitio
update public.slides set
  title = 'Fundamentos del trading, gratis',
  body = 'Crea tu cuenta y haz el curso completo sin pagar: bróker, MT5, velas japonesas y estructura del mercado.'
where place = 'login' and (body like '%estructura y riesgo%' or title = 'Fundamentos del trading, gratis');

-- 3) Título de la sección Comunidad del inicio
update public.site_settings set data = data || '{"discordTitle": "La comunidad de El Arte Gráfico"}'::jsonb
where id = 1 and lower(coalesce(data->>'discordTitle', '')) like 'la comunidad de el arte gr%';

-- 4) Preguntas frecuentes: Diamond es vitalicio (solo si las tienes guardadas desde Admin)
update public.site_settings s set data = jsonb_set(s.data, '{faq}', (
    select jsonb_agg(case when f->>'q' = '¿Qué planes hay?'
      then jsonb_build_object('q', f->>'q', 'a', 'Cobre (1 mes), Plata (6 meses), Oro (12 meses) y Diamond, que es vitalicio: un solo pago y quedas con acceso para siempre. Todos incluyen todos los cursos; desde Plata tienes doble XP y desde Oro entras a la Sala Oro (chat privado, lives y operativas). Si solo quieres el curso de Boom y Crash, lo compras una vez y es tuyo.')
      else f end order by o)
    from jsonb_array_elements(s.data->'faq') with ordinality t(f, o)))
where s.id = 1 and jsonb_typeof(s.data->'faq') = 'array' and jsonb_array_length(s.data->'faq') > 0;

select place, title, image_url from public.slides where place in ('home', 'login') and active order by place, sort;
