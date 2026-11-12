-- =====================================================================
-- "Estructura del mercado" pasa a ser el PRIMER módulo del curso Boom y Crash (de pago).
-- Se puede correr varias veces. No toca lecciones, videos ni ejercicios: solo cambia de curso, de orden
-- y de categoría (para que el SQL de Fundamentos no lo vuelva a mover).
-- También actualiza los textos que decían que la estructura del mercado venía en Fundamentos.
-- =====================================================================
update public.modules set
  course_id = (select id from public.courses where not base order by sort, created_at limit 1),
  category = 'Estructura',
  sort = coalesce((select min(m2.sort) from public.modules m2 join public.courses c2 on c2.id = m2.course_id
                   where not c2.base and m2.id <> public.modules.id
                     and c2.id = (select id from public.courses where not base order by sort, created_at limit 1)), 1) - 1
where lower(title) like '%estructura del mercado%'
  and exists (select 1 from public.courses where not base);

-- textos: Fundamentos ahora es bróker, MT5, sintéticos y velas
update public.slides set body = replace(replace(body,
    'bróker, MT5, velas japonesas y estructura del mercado', 'bróker, MT5, índices sintéticos y velas japonesas'),
    'velas, estructura y riesgo', 'índices sintéticos y velas japonesas')
where body like '%estructura del mercado%' or body like '%estructura y riesgo%';

update public.slides set body = 'Cuando termines Fundamentos, entra a Boom y Crash: estructura del mercado, zonas, entradas y stop loss con reglas claras.'
where image_url like '%/assets/banners/metodo.webp%';

update public.site_settings set data = jsonb_set(data, '{faq}', (
    select jsonb_agg(jsonb_build_object('q', f->>'q', 'a', replace(replace(f->>'a',
        'bróker, MT5, velas japonesas y estructura del mercado', 'qué es un bróker, MT5, índices sintéticos y velas japonesas'),
        'cómo leer las velas y la estructura del mercado', 'qué son los índices sintéticos y cómo leer las velas')) order by o)
    from jsonb_array_elements(data->'faq') with ordinality t(f, o)))
where id = 1 and jsonb_typeof(data->'faq') = 'array' and jsonb_array_length(data->'faq') > 0;

select c.title as curso, m.sort as orden, m.title as modulo, m.category as categoria, m.status
from public.modules m left join public.courses c on c.id = m.course_id
order by c.sort nulls last, m.sort;
