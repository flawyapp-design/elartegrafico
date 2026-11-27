-- =====================================================================
-- GII · GRUPAL INTENSIVO E INMERSIVO (en vivo, dentro de EAG Charts)
--   · Se vende como un "curso" más (mismo flujo de pago): kind = 'intensivo'
--   · Al aprobar el pago, el alumno queda inscrito (user_courses) y en EAG Charts
--     se le abren los gráficos, el Replay y la Práctica (los días se editan en
--     Admin → Intensivo GII).
--   · Cupo: gii_cupo() devuelve cuántos inscritos hay (para el contador público).
--   · La Biblioteca de clases (grabadas) baja a 30 USD.
-- Correr en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

alter table public.courses add column if not exists kind text not null default 'curso';

insert into public.courses (title, descr, color, icon, price, status, sort, kind)
select 'GII · Grupal Intensivo e Inmersivo',
       'Clases en vivo conmigo, dentro de EAG Charts: replay juntos, práctica, evaluación en tu propio gráfico y mercado real en vivo.',
       '#2962ff', '🔴', '50 USD', 'publicado', 80, 'intensivo'
where not exists (select 1 from public.courses where kind = 'intensivo');

-- cuántos inscritos hay (pagos aprobados o dados por el admin): para el contador del cupo
create or replace function public.gii_cupo() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.user_courses uc
  join public.courses c on c.id = uc.course_id
  where c.kind = 'intensivo'
$$;
grant execute on function public.gii_cupo() to anon, authenticated;

-- la biblioteca (grabaciones) pasa a 30 USD
update public.courses set price = '30 USD' where kind = 'biblioteca';
