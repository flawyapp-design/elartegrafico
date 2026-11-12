-- =====================================================================
-- Curso base "Fundamentos del trading". Correr DESPUÉS de novedades.sql. Se puede correr varias veces.
--  - Nuevo curso "Fundamentos del trading" (primero en la lista), GRATIS y completo para cualquier
--    cuenta registrada. No se vende.
--  - Los módulos con categoría "Fundamentos" pasan a este curso (abrir cuenta, Deriv y MT5, velas…), y
--    "Bienvenida e introducción" queda como el PRIMER módulo de Fundamentos.
-- =====================================================================
alter table public.courses add column if not exists base boolean not null default false;

insert into public.courses (title, descr, color, icon, price, status, sort, base)
select 'Fundamentos del trading',
       'Lo que necesitas antes de cualquier mercado: cómo abrir tu cuenta, tu bróker y MT5, velas japonesas y estructura del mercado.',
       '#d8b062', '📚', 'Gratis', 'publicado', 0, true
where not exists (select 1 from public.courses where base);

update public.courses set sort = 0, price = 'Gratis' where base;
update public.courses set sort = greatest(sort, 1) where not base;

-- los módulos de fundamentos pasan al curso base
update public.modules set course_id = (select id from public.courses where base order by created_at limit 1)
where lower(coalesce(category, '')) like 'fundamento%'
  and lower(title) not like '%bienvenida%' and lower(title) not like '%introducci%';

-- la introducción (bienvenida, qué es un bróker, sintéticos, expectativas) va de PRIMERA en Fundamentos
update public.modules set
  course_id = (select id from public.courses where base order by created_at limit 1),
  sort = coalesce((select min(m2.sort) from public.modules m2 join public.courses c2 on c2.id = m2.course_id
                   where c2.base and m2.id <> public.modules.id), 1) - 1
where (lower(title) like '%bienvenida%' or lower(title) like '%introducci%')
  and exists (select 1 from public.courses where base);

-- acceso: el curso que compraste, o el curso gratis si tienes cuenta
create or replace function public.course_module_ok(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.modules m join public.courses c on c.id = m.course_id
    where m.id = mid and (c.base
      or exists (select 1 from public.user_courses uc where uc.user_id = auth.uid() and uc.course_id = m.course_id)))
$$;
grant execute on function public.course_module_ok(uuid) to authenticated;

-- el curso base no se puede comprar suelto
create or replace function public.no_vender_base() returns trigger
language plpgsql as $$
begin
  if new.course_id is not null and exists (select 1 from public.courses where id = new.course_id and base) then
    raise exception 'Ese curso es gratis con tu cuenta; no hay que pagarlo.';
  end if;
  return new;
end $$;
drop trigger if exists no_vender_base on public.payment_requests;
create trigger no_vender_base before insert on public.payment_requests for each row execute function public.no_vender_base();

-- revisión: así quedan tus cursos y módulos
select c.title as curso, c.base as curso_base, m.sort, m.title as modulo, m.status, m.free as prueba_gratis
from public.modules m left join public.courses c on c.id = m.course_id
order by c.sort nulls last, m.sort;
