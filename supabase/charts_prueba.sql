-- =====================================================================
-- EAG Charts: prueba gratis de 3 días para todos los registrados + recomendaciones.
-- La prueba empieza la primera vez que el alumno abre EAG Charts (no al registrarse).
-- Los que tienen plan (o el admin) entran siempre, sin prueba.
-- Para cambiar los días: update public.site_settings set data = data || '{"chartTrialDays": 5}' where id = 1;
-- Correr una vez en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

create table if not exists public.chart_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  rating int check (rating between 1 and 5),
  feedback text check (char_length(feedback) <= 2000),
  feedback_at timestamptz
);
alter table public.chart_trials enable row level security;
drop policy if exists "prueba propia" on public.chart_trials;
create policy "prueba propia" on public.chart_trials for select using (user_id = auth.uid());

-- empieza (si no existía) y devuelve cuándo termina
create or replace function public.chart_trial()
returns table(started_at timestamptz, ends_at timestamptz, has_feedback boolean)
language plpgsql volatile security definer set search_path = public as $$
declare d int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select coalesce((data->>'chartTrialDays')::int, 3) into d from public.site_settings where id = 1;
  d := coalesce(d, 3);
  insert into public.chart_trials(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return query select t.started_at, t.started_at + make_interval(days => d), t.feedback_at is not null
    from public.chart_trials t where t.user_id = auth.uid();
end $$;
grant execute on function public.chart_trial() to authenticated;

-- guardar la opinión / recomendaciones (se puede actualizar)
create or replace function public.chart_feedback(p_rating int, p_text text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Elige de 1 a 5 estrellas'; end if;
  insert into public.chart_trials(user_id, rating, feedback, feedback_at)
    values (auth.uid(), p_rating, left(coalesce(p_text, ''), 2000), now())
  on conflict (user_id) do update set rating = excluded.rating, feedback = excluded.feedback, feedback_at = now();
end $$;
grant execute on function public.chart_feedback(int, text) to authenticated;

-- admin: ver quién la probó y qué recomiendan
drop function if exists public.admin_chart_feedback();
create function public.admin_chart_feedback()
returns table(username text, country text, premium boolean, started_at timestamptz, rating int, feedback text, feedback_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.username, p.country, coalesce(p.premium_until > now(), false), t.started_at, t.rating, t.feedback, t.feedback_at
    from public.chart_trials t join public.profiles p on p.id = t.user_id
    order by coalesce(t.feedback_at, t.started_at) desc limit 2000;
end $$;
grant execute on function public.admin_chart_feedback() to authenticated;

select 'listo' as estado, (select count(*) from public.chart_trials) as pruebas_iniciadas;
