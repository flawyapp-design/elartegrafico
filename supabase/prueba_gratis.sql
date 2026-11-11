-- =====================================================================
-- Prueba gratis: las cuentas gratis ven los módulos marcados como "prueba gratis"
-- (por defecto el de introducción) durante los primeros días desde que se registran
-- (7 por defecto; se cambia en Admin → Pagos). Se puede correr varias veces.
-- =====================================================================

alter table public.modules add column if not exists free boolean not null default false;

-- lanzamiento: las cuentas que ya existen también reciben sus días de prueba, contados desde hoy
insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
update public.site_settings set data = data || jsonb_build_object('trialFrom', now()) where id = 1 and not (data ? 'trialFrom');

-- marca el módulo de introducción si todavía no hay ninguno marcado
update public.modules set free = true
where not exists (select 1 from public.modules where free)
  and id = (select id from public.modules where title ilike '%introducci%' or title ilike '%bienvenida%' order by sort limit 1);

-- ¿la cuenta sigue dentro de los días de prueba?
create or replace function public.in_trial() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select greatest(u.created_at, coalesce((select (s.data->>'trialFrom')::timestamptz from public.site_settings s where s.id = 1), u.created_at)) > now() - make_interval(days => greatest(0, coalesce(
             (select (s.data->>'trialDays')::int from public.site_settings s where s.id = 1), 7)))
    from auth.users u join public.profiles p on p.id = u.id
    where u.id = auth.uid() and not p.banned), false)
$$;
grant execute on function public.in_trial() to authenticated;

-- ¿este módulo lo puede ver la cuenta de prueba?
create or replace function public.trial_module_ok(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.in_trial() and exists (select 1 from public.modules m where m.id = mid and m.free and m.status = 'publicado')
$$;
grant execute on function public.trial_module_ok(uuid) to authenticated;

create or replace function public.trial_lesson_ok(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lessons l where l.id = lid and l.status = 'publicado' and public.trial_module_ok(l.module_id))
$$;
grant execute on function public.trial_lesson_ok(uuid) to authenticated;

-- lecciones: premium, o prueba gratis en un módulo marcado
drop policy if exists "leer lecciones" on public.lessons;
create policy "leer lecciones" on public.lessons for select
  using (public.is_admin() or (status = 'publicado' and public.module_open(module_id)
         and (public.is_premium() or public.trial_module_ok(module_id))));

-- ejercicios: demo, premium, o de una lección de la prueba gratis
drop policy if exists "leer ejercicios" on public.exercises;
create policy "leer ejercicios" on public.exercises for select
  using (is_demo or public.is_premium() or (lesson_id is not null and public.trial_lesson_ok(lesson_id)));

-- calificar: los ejercicios de la prueba gratis no gastan las 5 gráficas de prueba
create or replace function public.grade_exercise(ex uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.exercises; a public.exercise_answers; used int; prem boolean; tri boolean := false;
begin
  if auth.uid() is null then return jsonb_build_object('error','login'); end if;
  select * into e from public.exercises where id = ex;
  if not found then return jsonb_build_object('error','no_existe'); end if;
  prem := public.is_premium();
  if not prem and e.lesson_id is not null then tri := public.trial_lesson_ok(e.lesson_id); end if;
  if not prem and not tri then
    if not e.is_demo then return jsonb_build_object('error','premium'); end if;
    select demo_used into used from public.profiles where id = auth.uid() for update;
    if coalesce(used,0) >= 5 then return jsonb_build_object('error','demo_agotado'); end if;
    update public.profiles set demo_used = coalesce(used,0) + 1 where id = auth.uid();
  end if;
  select * into a from public.exercise_answers where exercise_id = ex;
  return jsonb_build_object('zone', a.zone, 'sl', a.sl, 'answer', coalesce(a.answer,'{}'::jsonb), 'explain', coalesce(a.explain,''),
    'demo_left', case when prem or tri then null else 5 - (select demo_used from public.profiles where id = auth.uid()) end);
end $$;
grant execute on function public.grade_exercise(uuid) to authenticated;
