-- =====================================================================
-- "Bienvenida e introducción" pasa a ser el PRIMER módulo del curso gratis Fundamentos del trading.
-- Se puede correr varias veces. No toca lecciones, videos ni ejercicios: solo cambia de curso y de orden.
-- =====================================================================
update public.modules set
  course_id = (select id from public.courses where base order by created_at limit 1),
  sort = coalesce((select min(m2.sort) from public.modules m2 join public.courses c2 on c2.id = m2.course_id
                   where c2.base and m2.id <> public.modules.id), 1) - 1
where (lower(title) like '%bienvenida%' or lower(title) like '%introducci%')
  and exists (select 1 from public.courses where base);

select c.title as curso, m.sort as orden, m.title as modulo, m.status
from public.modules m left join public.courses c on c.id = m.course_id
order by c.sort nulls last, m.sort;
